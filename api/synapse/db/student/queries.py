"""
Student database queries (Prisma SQLite).
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OWNER: Student developer
Tables: students, knowledge_maps, quiz_sessions, assessments, notes
"""
from __future__ import annotations
import json
from synapse.db.client import get_client
from synapse.models import KnowledgeMap, Assessment, GradeReport, SmartNotes


# ── Students ──────────────────────────────────────────────────────────────────

async def upsert_student(student_id: str, email: str = "", name: str = "") -> dict:
    client = get_client()
    student = await client.student.upsert(
        where={"id": student_id},
        data={
            "create": {"id": student_id, "email": email, "name": name},
            "update": {"email": email, "name": name}
        }
    )
    return student.model_dump() if student else {}


async def get_student(student_id: str) -> dict | None:
    client = get_client()
    student = await client.student.find_unique(where={"id": student_id})
    return student.model_dump() if student else None


# ── Knowledge Maps ─────────────────────────────────────────────────────────────

async def save_knowledge_map(km: KnowledgeMap) -> dict:
    client = get_client()
    # Prisma doesn't have upsert without a unique field. KnowledgeMap ID is UUID.
    # Since we don't have the KnowledgeMap ID before saving often, we might need to find first by studentId
    existing = await client.knowledgemap.find_first(
        where={"studentId": km.student_id},
        order={"updatedAt": "desc"}
    )
    topics_str = json.dumps([t.model_dump() for t in km.topics])
    
    if existing:
        km_record = await client.knowledgemap.update(
            where={"id": existing.id},
            data={"topics": topics_str, "overallMastery": km.overall_mastery}
        )
    else:
        km_record = await client.knowledgemap.create(
            data={
                "studentId": km.student_id,
                "topics": topics_str,
                "overallMastery": km.overall_mastery
            }
        )
    return km_record.model_dump() if km_record else {}


async def load_knowledge_map(student_id: str) -> KnowledgeMap | None:
    client = get_client()
    km_record = await client.knowledgemap.find_first(
        where={"studentId": student_id},
        order={"updatedAt": "desc"}
    )
    if not km_record:
        return None
    
    try:
        topics_data = json.loads(km_record.topics) if km_record.topics else []
    except json.JSONDecodeError:
        topics_data = []

    return KnowledgeMap(
        student_id=km_record.studentId,
        topics=topics_data,
        overall_mastery=km_record.overallMastery,
    )


# ── Quiz Sessions ──────────────────────────────────────────────────────────────

async def save_quiz_session(student_id: str, topics: list[str], quiz_json: dict) -> str:
    """Persist a generated quiz so correct answers are available at evaluation time."""
    client = get_client()
    quiz = await client.quizsession.create(
        data={
            "studentId": student_id,
            "topics": json.dumps(topics),
            "quiz": json.dumps(quiz_json),
        }
    )
    return quiz.id


async def load_quiz_session(student_id: str) -> dict | None:
    """Load the most recent quiz for a student."""
    client = get_client()
    quiz = await client.quizsession.find_first(
        where={"studentId": student_id},
        order={"createdAt": "desc"}
    )
    if not quiz:
        return None
    
    res = quiz.model_dump()
    try:
        res["topics"] = json.loads(quiz.topics) if quiz.topics else []
        res["quiz"] = json.loads(quiz.quiz) if quiz.quiz else {}
    except Exception:
        pass
    return res


# ── Assessments ────────────────────────────────────────────────────────────────

async def save_assessment(assessment: Assessment) -> dict:
    client = get_client()
    record = await client.assessment.create(
        data={
            "id": assessment.id,
            "studentId": assessment.student_id,
            "topic": assessment.topic,
            "questions": json.dumps([q.model_dump() for q in assessment.questions]),
        }
    )
    return record.model_dump()


async def load_assessment(assessment_id: str) -> dict | None:
    client = get_client()
    record = await client.assessment.find_unique(where={"id": assessment_id})
    if not record:
        return None
        
    res = record.model_dump()
    try:
        res["questions"] = json.loads(record.questions) if record.questions else []
    except Exception:
        pass
    # Mapping Prisma fields back to Supabase-like names
    res["student_id"] = res.pop("studentId", None)
    res["created_at"] = res.pop("createdAt", None)
    return res


async def save_grade_report(report: GradeReport) -> dict:
    client = get_client()
    record = await client.gradereport.create(
        data={
            "assessmentId": report.assessment_id,
            "studentId": report.student_id,
            "topic": report.topic,
            "score": report.score,
            "perQuestion": json.dumps([q.model_dump() for q in report.per_question]),
            "updatedStatus": json.dumps(report.updated_status.model_dump()),
        }
    )
    return record.model_dump()


# ── Notes ─────────────────────────────────────────────────────────────────────

async def save_notes(notes: SmartNotes) -> dict:
    client = get_client()
    record = await client.studentnote.create(
        data={
            "studentId": notes.student_id,
            "topic": notes.topic,
            "summary": notes.summary,
            "sections": json.dumps([s.model_dump() for s in notes.sections]),
            "keyConcepts": json.dumps(notes.key_concepts),
            "sources": json.dumps([s.model_dump() for s in notes.sources]),
        }
    )
    return record.model_dump()


async def list_notes(student_id: str) -> list[dict]:
    client = get_client()
    records = await client.studentnote.find_many(
        where={"studentId": student_id},
        order={"createdAt": "desc"}
    )
    
    result = []
    for r in records:
        result.append({
            "id": r.id,
            "topic": r.topic,
            "summary": r.summary,
            "created_at": r.createdAt
        })
    return result


# ── Flashcards ─────────────────────────────────────────────────────────────────

async def save_flashcards(student_id: str, topic: str, cards: list[dict]) -> dict:
    client = get_client()
    record = await client.flashcard.create(
        data={
            "studentId": student_id,
            "topic": topic,
            "cards": json.dumps(cards),
        }
    )
    return record.model_dump()


async def get_flashcards(student_id: str, topic: str) -> list[dict]:
    client = get_client()
    record = await client.flashcard.find_first(
        where={
            "studentId": student_id,
            "topic": topic
        },
        order={"createdAt": "desc"}
    )
    if not record:
        return []
    
    try:
        return json.loads(record.cards) if record.cards else []
    except Exception:
        return []


# ── Class discovery ────────────────────────────────────────────────────────────

async def get_class_by_code(code: str) -> dict | None:
    client = get_client()
    classroom = await client.classroom.find_unique(where={"joinCode": code.upper()})
    if not classroom:
        return None
    
    res = classroom.model_dump()
    res["join_code"] = res.pop("joinCode", None)
    res["teacher_id"] = res.pop("teacherId", None)
    return res


async def get_enrolled_classes(student_id: str) -> list[dict]:
    client = get_client()
    enrollments = await client.enrollment.find_many(
        where={"studentId": student_id},
        include={"classroom": True}
    )
    
    classes = []
    for enr in enrollments:
        if enr.classroom:
            res = enr.classroom.model_dump()
            res["join_code"] = res.pop("joinCode", None)
            res["teacher_id"] = res.pop("teacherId", None)
            try:
                res["topics"] = json.loads(enr.classroom.topics) if enr.classroom.topics else []
            except Exception:
                res["topics"] = []
            classes.append(res)
    return classes
