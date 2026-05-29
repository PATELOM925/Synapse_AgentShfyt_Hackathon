"""
Synapse AI FastAPI application.

Startup: initializes OrchestratorLifecycle + connects KB MCP server.
Shutdown: graceful cleanup.

Ports:
  FastAPI backend: 8000
  KB MCP server:   8888 (run separately: python -m synapse.mcp_server.kb_server)
  Next.js frontend: 3001 (Langfuse occupies 3000)
"""

from __future__ import annotations

import os
import sys
from contextlib import asynccontextmanager

from dotenv import load_dotenv

# Load .env before importing orchestrator (it reads settings on import)
_env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(_env_path, override=True)

# Ensure Continuum is importable if installed as editable local dep
_CONTINUUM_SRC = os.path.join(
    os.path.dirname(__file__), "..", "..", "..", "continuum", "src"
)
if os.path.isdir(_CONTINUUM_SRC) and _CONTINUUM_SRC not in sys.path:
    sys.path.insert(0, _CONTINUUM_SRC)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from synapse.agents.lifecycle import close_synapse_app, get_synapse_app
from synapse.routers import assess, diagnose, knowledge_map, memory, notes, tutor, student


@asynccontextmanager
async def lifespan(app: FastAPI):
    synapse = get_synapse_app()
    await synapse.initialize()
    yield
    await close_synapse_app()


app = FastAPI(
    title="Synapse AI",
    description="Personalized AI tutoring platform — Diagnose → Teach → Verify",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3001",
        "http://localhost:3000",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(diagnose.router)
app.include_router(tutor.router)
app.include_router(assess.router)
app.include_router(notes.router)
app.include_router(knowledge_map.router)
app.include_router(memory.router)
app.include_router(student.router)


@app.get("/health")
async def health():
    """Health check — verifies all Continuum services are reachable."""
    from orchestrator.core import get_health_checker

    checker = get_health_checker()
    result = await checker.check_all()
    return result.to_dict() if hasattr(result, "to_dict") else {"status": "ok"}


@app.get("/")
async def root():
    return {
        "service": "Synapse AI",
        "version": "0.1.0",
        "docs": "/docs",
        "health": "/health",
    }
