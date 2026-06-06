"""
Synapse AI FastAPI application.
SHARED — do not edit without a PR from both developers.

Ports:
  API:             8000
  KB MCP server:   8888   (python -m synapse.mcp_server.kb_server)
  Frontend:        3001   (Supabase Studio occupies 54323 by default)
"""
from __future__ import annotations
import os, sys
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"), override=True)
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env.local"), override=True)
_CONTINUUM_SRC = os.path.join(os.path.dirname(__file__), "..", "..", "continuum", "src")
if os.path.isdir(_CONTINUUM_SRC) and _CONTINUUM_SRC not in sys.path:
    sys.path.insert(0, _CONTINUUM_SRC)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ── Student routers (student developer owns these) ────────────────────────────
from synapse.routers.student import (
    diagnose, tutor, assess, notes, knowledge_map,
    classroom as classroom_router,
    auth as student_auth,
    classes as student_classes,
    flashcards as student_flashcards,
    pipeline as student_pipeline,
)

# ── Teacher routers (teacher developer owns these) ────────────────────────────
from synapse.routers.teacher import auth as teacher_auth, classes, analytics, reports

from synapse.agents.lifecycle import close_synapse_app, get_synapse_app


@asynccontextmanager
async def lifespan(app: FastAPI):
    await get_synapse_app().initialize()
    yield
    await close_synapse_app()


app = FastAPI(
    title="Synapse AI",
    description="Personalized AI tutoring — Student + Teacher routes",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://localhost:3000", "http://127.0.0.1:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Mount student routes (/student/...) ───────────────────────────────────────
app.include_router(diagnose.router)
app.include_router(tutor.router)
app.include_router(assess.router)
app.include_router(notes.router)
app.include_router(knowledge_map.router)
app.include_router(classroom_router.router)
app.include_router(student_auth.router)
app.include_router(student_classes.router)
app.include_router(student_flashcards.router)
app.include_router(student_pipeline.router)

# ── Mount teacher routes (/teacher/...) ───────────────────────────────────────
app.include_router(teacher_auth.router)
app.include_router(classes.router)
app.include_router(analytics.router)
app.include_router(reports.router)


@app.get("/health")
async def health():
    from orchestrator.core import get_health_checker
    result = await get_health_checker().check_all()
    return result.to_dict() if hasattr(result, "to_dict") else {"status": "ok"}


@app.get("/")
async def root():
    return {
        "service": "Synapse AI",
        "version": "0.1.0",
        "routes": {
            "student": ["/student/auth/register", "/student/auth/{id}",
                        "/student/classes/join", "/student/classes/{student_id}",
                        "/student/classes/{classroom_id}/topics",
                        "/student/diagnose/quiz", "/student/diagnose/evaluate",
                        "/student/knowledge-map/{id}", "/student/tutor/stream",
                        "/student/assess/{topic}", "/student/assess/grade",
                        "/student/notes/", "/student/notes/{student_id}",
                        "/student/classrooms/invites/{student_id}",
                        "/student/classrooms/invites/{code}/accept",
                        "/student/classrooms/knowledge-gap/start",
                        "/student/flashcards/", "/student/flashcards/{student_id}/{topic}"],
            "teacher": ["/teacher/auth/register", "/teacher/auth/{id}",
                        "/teacher/classes/{teacher_id}/all", "/teacher/classes/",
                        "/teacher/classes/{id}", "/teacher/classes/{id}/syllabus",
                        "/teacher/classes/{id}/enroll", "/teacher/classes/{id}/invite",
                        "/teacher/classes/{id}/invites", "/teacher/classes/{id}/materials",
                        "/teacher/analytics/{classroom_id}",
                        "/teacher/reports/{classroom_id}/summary"],
        },
        "docs": "/docs",
        "health": "/health",
    }
