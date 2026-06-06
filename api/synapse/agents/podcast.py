"""
Podcast Pipeline — Generates an audio summary using ElevenLabs.
"""
import os
import uuid
import asyncio
from orchestrator import AgentMemoryScope, get_logger
from synapse.agents.lifecycle import SynapseApp
from elevenlabs.client import ElevenLabs
from elevenlabs import save

logger = get_logger(__name__)

async def generate_podcast(app: SynapseApp, student_id: str, topic: str) -> dict:
    """
    Generate a podcast script using an LLM agent, and then convert it to audio using ElevenLabs.
    """
    agent = app.make_agent(
        name=f"podcast-{topic[:20].replace(' ', '-').lower()}",
        instructions=(
            "You are Synapse AI's Podcast Script Writer.\n"
            "1. Call get_topic_sources to retrieve source material.\n"
            "2. Write a highly engaging, concise (1-2 minutes) audio script explaining the core concepts.\n"
            "3. Do not include any stage directions like [Host] or [Upbeat music]. Just pure spoken text.\n"
            "4. Make it sound enthusiastic, clear, and easy to understand.\n"
        ),
        gateway_mode="quality",
        max_turns=3,
        memory=False,
    )

    try:
        prompt = f"Write an engaging podcast script for the topic: {topic}"
        result = await app.runner.run(agent=agent, input=prompt, user_id=student_id)
        script = result.content or ""
        
        # Clean up any potential markdown or stage directions just in case
        script = script.replace("*", "").replace("[", "").replace("]", "")
        
        # Connect to ElevenLabs
        api_key = os.getenv("ELEVENLABS_API_KEY")
        voice_id = os.getenv("ELEVENLABS_VOICE_ID", "CwhRBWXzGAHq8TQ4Fs17")
        model_id = os.getenv("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2")
        
        if not api_key:
            logger.warning("ELEVENLABS_API_KEY not found. Skipping audio generation.")
            return {"topic": topic, "script": script, "audio_url": None, "error": "No API key"}

        client = ElevenLabs(api_key=api_key)
        
        # Run ElevenLabs generation in a thread since it's a blocking network call
        def _generate_audio():
            audio_generator = client.generate(
                text=script,
                voice=voice_id,
                model=model_id,
            )
            audio_bytes = b"".join(chunk for chunk in audio_generator if chunk)
            return audio_bytes

        audio_bytes = await asyncio.to_thread(_generate_audio)
        
        # Save to public directory
        public_dir = os.path.join(os.path.dirname(__file__), "../../../../frontend/public/audio")
        os.makedirs(public_dir, exist_ok=True)
        
        filename = f"{topic.replace(' ', '_').lower()}.mp3"
        filepath = os.path.join(public_dir, filename)
        
        with open(filepath, "wb") as f:
            f.write(audio_bytes)
            
        audio_url = f"/audio/{filename}"
        
        return {"topic": topic, "script": script, "audio_url": audio_url}
        
    except Exception as e:
        logger.error(f"Podcast generation failed for {topic}: {e}")
        return {"topic": topic, "script": None, "audio_url": None, "error": str(e)}
