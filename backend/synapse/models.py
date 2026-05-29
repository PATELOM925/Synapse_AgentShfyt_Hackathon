"""Pydantic data models for Synapse AI."""

from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field


# ── Source Material ────────────────────────────────────────────────────────────

class SourceChunk(BaseModel):
    title: str
    locator: str  # e.g. "Chapter 3, p.42" or "Section 2.1"
    text: str


# ── Knowledge Map ──────────────────────────────────────────────────────────────

class TopicStatus(BaseModel):
    topic: str
    level: Literal["strong", "moderate", "needs_improvement"]
    evidence: str = Field(description="One sentence explaining why this level was assigned")


class KnowledgeMap(BaseModel):
    student_id: str
    topics: list[TopicStatus]
    overall_mastery: float = Field(ge=0.0, le=1.0, description="0=novice, 1=expert")


# ── Learning Profile ───────────────────────────────────────────────────────────

class LearningProfile(BaseModel):
    modality: Literal["visual", "text", "audio"] = "text"
    pace: Literal["deep", "methodical"] = "methodical"


# ── Diagnostic Quiz ────────────────────────────────────────────────────────────

class MCQChoice(BaseModel):
    label: str  # A, B, C, D
    text: str


class DiagnosticQuestion(BaseModel):
    id: str
    topic: str
    prompt: str
    choices: list[MCQChoice]
    correct_label: str
    rationale: str


class DiagnosticQuiz(BaseModel):
    student_id: str
    topics: list[str]
    questions: list[DiagnosticQuestion]


class QuizAnswer(BaseModel):
    question_id: str
    selected_label: str


class DiagnosticSubmission(BaseModel):
    student_id: str
    topics: list[str]
    answers: list[QuizAnswer]


# ── Assessment ─────────────────────────────────────────────────────────────────

class AssessmentQuestion(BaseModel):
    id: str
    topic: str
    type: Literal["mcq", "short_answer"]
    prompt: str
    choices: list[MCQChoice] | None = None  # MCQ only
    correct_label: str | None = None        # MCQ only
    model_answer: str | None = None         # short_answer only
    rationale: str


class Assessment(BaseModel):
    id: str
    topic: str
    student_id: str
    questions: list[AssessmentQuestion]


class AssessmentAnswer(BaseModel):
    question_id: str
    response: str  # label for MCQ, free text for short_answer


class AssessmentSubmission(BaseModel):
    assessment_id: str
    student_id: str
    topic: str
    answers: list[AssessmentAnswer]


class QuestionResult(BaseModel):
    question_id: str
    correct: bool
    student_response: str
    correct_answer: str
    rationale: str


class GradeReport(BaseModel):
    assessment_id: str
    topic: str
    student_id: str
    score: float = Field(ge=0.0, le=1.0)
    per_question: list[QuestionResult]
    updated_status: TopicStatus


# ── Smart Notes ────────────────────────────────────────────────────────────────

class NoteSection(BaseModel):
    heading: str
    content: str
    subsections: list[NoteSection] = Field(default_factory=list)


NoteSection.model_rebuild()  # required for self-referential model


class SmartNotes(BaseModel):
    topic: str
    student_id: str
    summary: str = Field(description="2-3 sentence overview")
    sections: list[NoteSection]
    key_concepts: list[str]
    sources: list[SourceChunk] = Field(default_factory=list)


# ── Comprehension Check (emitted inline by Tutor) ─────────────────────────────

class ComprehensionCheck(BaseModel):
    question: str
    hint: str = ""
    expected_insight: str


# ── API request/response shapes ────────────────────────────────────────────────

class DiagnoseRequest(BaseModel):
    student_id: str
    topics: list[str]


class DiagnoseEvaluateRequest(BaseModel):
    student_id: str
    topics: list[str]
    answers: list[QuizAnswer]


class TutorStreamRequest(BaseModel):
    student_id: str
    topic: str
    message: str
    profile: LearningProfile = Field(default_factory=LearningProfile)


class NotesRequest(BaseModel):
    student_id: str
    topic: str
    content: str = ""  # optional pre-extracted content


class CoordinatorRequest(BaseModel):
    student_id: str
    message: str
    profile: LearningProfile = Field(default_factory=LearningProfile)


# ── Student API request/response shapes ────────────────────────────────────────

class StudentJoinRequest(BaseModel):
    invite_code: str
    student_id: str


class GapAssessmentRequest(BaseModel):
    student_id: str
    topic_id: str
    mode: Literal["manual", "ai"]
    manual_level: Literal["new", "no_clue"] | None = None


class TopicQuizRequest(BaseModel):
    student_id: str
    topic_id: str


class TopicQuizResult(BaseModel):
    score: int
    feedback: str
