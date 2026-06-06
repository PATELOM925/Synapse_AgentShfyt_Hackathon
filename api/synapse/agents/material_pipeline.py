"""
Material Pipeline — ScatterAgent-based parallel generation with handoff.

Flow:
  1. After knowledge-gap assessment grades → scatter notes + flashcards per topic (parallel)
  2. After tutor chat ends → memory-informed quiz using Redis conversation + Mem0 USER scope

Continuum features used:
  - ScatterAgent: each topic split into two branches (notes + flashcards) running concurrently
  - AgentMemoryScope.USER: long-term student memory (Mem0) feeds quiz personalization
  - Redis session: short-term tutor conversation context carried into quiz generation
"""
from __future__ import annotations

import asyncio
import json
from orchestrator import AgentMemoryScope, get_logger
from orchestrator.agent.workflow.scatter import create_scatter_agent
from orchestrator.agent.types import MergeStrategy, FailStrategy
from synapse.agents.lifecycle import SynapseApp
from synapse.agents.notes import generate_notes
from synapse.agents.flashcards import generate_flashcards
from synapse.agents.podcast import generate_podcast
from synapse.db.student.queries import save_notes, save_flashcards

logger = get_logger(__name__)


# ── Per-topic scatter: notes + flashcards in parallel ─────────────────────────

async def _scatter_one_topic(app: SynapseApp, student_id: str, topic: str) -> dict:
    """Run notes and flashcards generation for a single topic using ScatterAgent."""
    notes_agent = app.make_agent(
        name=f"notes-{topic[:24].replace(' ', '-').lower()}",
        instructions=(
            "You are Synapse AI's Smart Notes Generator.\n"
            "1. Call get_topic_sources to retrieve source material.\n"
            "2. Call search_source_material for additional context.\n"
            "3. Synthesize hierarchical study notes.\n\n"
            'Return ONLY JSON: {"topic":"...","student_id":"...","summary":"...","sections":[...],"key_concepts":[...],"sources":[]}'
        ),
        gateway_mode="quality",
        max_turns=10,
        memory=True,
        memory_scope=AgentMemoryScope.USER,
        tool_attention_k=4,
    )
    flashcards_agent = app.make_agent(
        name=f"fc-{topic[:24].replace(' ', '-').lower()}",
        instructions=(
            "You are Synapse AI's Flashcard Generator.\n"
            "1. Call get_topic_sources to retrieve source material.\n"
            "2. Generate 10-15 flashcards with front (question/term) and back (answer + source cite).\n\n"
            'Return ONLY JSON: {"student_id":"...","topic":"...","flashcards":[{"front":"...","back":"..."}]}'
        ),
        gateway_mode="quality",
        max_turns=10,
        memory=True,
        memory_scope=AgentMemoryScope.USER,
        tool_attention_k=4,
    )

    scatter = create_scatter_agent(
        name=f"scatter-{topic[:20].replace(' ', '-').lower()}",
        agents=[notes_agent, flashcards_agent],
        input_slices=[
            f"Generate smart notes for student '{student_id}' on topic: {topic}",
            f"Generate flashcards for student '{student_id}' on topic: {topic}",
        ],
        merge_strategy=MergeStrategy.STRUCTURED,
        fail_strategy=FailStrategy.CONTINUE_ON_ERROR,
        timeout=120,
    )

    try:
        scatter_task = app.runner.run(agent=scatter, input=f"Study materials for: {topic}", user_id=student_id)
        podcast_task = generate_podcast(app, student_id, topic)
        
        result, podcast_res = await asyncio.gather(scatter_task, podcast_task, return_exceptions=True)
        
        raw = "{}"
        if not isinstance(result, Exception):
            raw = result.content or "{}"
        else:
            logger.error("Scatter failed for topic %s: %s", topic, result)
            
        # STRUCTURED merge returns JSON dict keyed by agent name
        try:
            parts = json.loads(raw)
        except Exception:
            parts = {}

        notes_raw = parts.get(notes_agent.name, "")
        fc_raw = parts.get(flashcards_agent.name, "")

        def _xj(c: str) -> str:
            c = (c or "").strip()
            if c.startswith("```"):
                lines = c.splitlines()
                c = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
            return c.strip()

        notes_data, fc_data = None, None
        try:
            notes_data = json.loads(_xj(notes_raw))
        except Exception as e:
            logger.warning("Notes parse failed for %s: %s", topic, e)
        try:
            fc_data = json.loads(_xj(fc_raw))
        except Exception as e:
            logger.warning("Flashcards parse failed for %s: %s", topic, e)

        return {"topic": topic, "notes": notes_data, "flashcards": fc_data, "podcast": podcast_res if not isinstance(podcast_res, Exception) else None}
    except Exception as e:
        logger.error("Scatter failed for topic %s: %s", topic, e)
        return {"topic": topic, "notes": None, "flashcards": None, "error": str(e)}


async def generate_study_materials(
    app: SynapseApp,
    student_id: str,
    topics: list[str],
) -> list[dict]:
    """
    Scatter notes + flashcards generation across all topics in parallel.
    Returns list of {topic, notes, flashcards} — also persists to Supabase.
    """
    tasks = [_scatter_one_topic(app, student_id, topic) for topic in topics]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    output = []
    for r in results:
        if isinstance(r, Exception):
            logger.error("Material generation error: %s", r)
            continue
        output.append(r)

        # Persist notes
        if r.get("notes"):
            try:
                from synapse.models import SmartNotes, NoteSection, SourceChunk
                n = r["notes"]
                notes_obj = SmartNotes(
                    topic=n.get("topic", r["topic"]),
                    student_id=n.get("student_id", student_id),
                    summary=n.get("summary", ""),
                    sections=[NoteSection(**s) for s in n.get("sections", [])],
                    key_concepts=n.get("key_concepts", []),
                    sources=[SourceChunk(**s) for s in n.get("sources", [])],
                )
                await save_notes(notes_obj)
            except Exception as e:
                logger.warning("Notes persist failed for %s: %s", r["topic"], e)

        # Persist flashcards
        if r.get("flashcards"):
            try:
                cards = r["flashcards"].get("flashcards", [])
                await save_flashcards(student_id, r["topic"], cards)
            except Exception as e:
                logger.warning("Flashcards persist failed for %s: %s", r["topic"], e)

    return output


# ── Memory-informed quiz (handoff from tutor session) ─────────────────────────

MEMORY_QUIZ_INSTRUCTIONS = """You are Synapse AI's Personalized Quiz Generator.

You have access to:
1. The student's long-term memory (their knowledge gaps, learning patterns) via your built-in memory
2. The tutor conversation summary provided below
3. Source material via get_topic_sources and search_source_material

Use these to generate a quiz that targets the EXACT gaps and misconceptions this student showed
during the tutoring session — not generic questions.

Return ONLY this JSON:
{
  "id": "<uuid>",
  "topic": "<topic>",
  "student_id": "<id>",
  "questions": [
    {
      "id": "q1",
      "topic": "<topic>",
      "type": "mcq",
      "prompt": "...",
      "choices": [{"label":"A","text":"..."},{"label":"B","text":"..."},{"label":"C","text":"..."},{"label":"D","text":"..."}],
      "correct_label": "B",
      "model_answer": null,
      "rationale": "Targets the student's confusion about X (source: ...)"
    }
  ]
}"""


async def generate_memory_quiz(
    app: SynapseApp,
    student_id: str,
    topic: str,
    chat_summary: str = "",
) -> dict:
    """
    Generate a personalized quiz using:
    - student's long-term Mem0 memory (USER scope)
    - tutor chat summary passed in
    - RAG from KB server
    """
    import uuid
    agent = app.make_agent(
        name="synapse-memory-quiz",
        instructions=MEMORY_QUIZ_INSTRUCTIONS,
        gateway_mode="quality",
        max_turns=12,
        memory=True,
        memory_scope=AgentMemoryScope.USER,  # loads student's accumulated knowledge gaps
        tool_attention_k=5,
    )

    context = f"Tutor chat summary:\n{chat_summary}\n\n" if chat_summary else ""
    prompt = (
        f"{context}"
        f"Student: {student_id}\n"
        f"Topic: {topic}\n"
        f"Quiz ID: {uuid.uuid4()}\n\n"
        f"Generate a personalized quiz targeting this student's specific gaps. "
        f"Call get_topic_sources('{topic}') first."
    )

    response = await app.runner.run(agent=agent, input=prompt, user_id=student_id)

    def _xj(c: str) -> str:
        c = (c or "").strip()
        if c.startswith("```"):
            lines = c.splitlines()
            c = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
        return c.strip()

    try:
        return json.loads(_xj(response.content or "{}"))
    except Exception as e:
        logger.error("Memory quiz parse error: %s | %s", e, (response.content or "")[:300])
        raise
