"""
Pydantic data models for Synapse AI.
SHARED — do not edit without a PR. Both student and teacher routes import from here.
"""
from __future__ import annotations
from typing import Literal
from pydantic import BaseModel, Field
import uuid


# ── Shared identifiers ─────────────────────────────────────────────────────────

def new_id() -> str:
    return str(uuid.uuid4())


# ── Source material ────────────────────────────────────────────────────────────

class SourceChunk(BaseModel):
    title: str
    locator: str
    text: str


# ── Knowledge Map ──────────────────────────────────────────────────────────────

class TopicStatus(BaseModel):
    topic: str
    level: Literal["strong", "moderate", "needs_improvement"]
    evidence: str


class KnowledgeMap(BaseModel):
    student_id: str
    topics: list[TopicStatus]
    overall_mastery: float = Field(ge=0.0, le=1.0)


# ── Learning Profile ───────────────────────────────────────────────────────────

class LearningProfile(BaseModel):
    modality: Literal["visual", "text", "audio"] = "text"
    pace: Literal["deep", "methodical"] = "methodical"


# ── Diagnostic ────────────────────────────────────────────────────────────────

class MCQChoice(BaseModel):
    label: str
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


# ── Assessment ─────────────────────────────────────────────────────────────────

class AssessmentQuestion(BaseModel):
    id: str
    topic: str
    type: Literal["mcq", "short_answer"]
    prompt: str
    choices: list[MCQChoice] | None = None
    correct_label: str | None = None
    model_answer: str | None = None
    rationale: str


class Assessment(BaseModel):
    id: str = Field(default_factory=new_id)
    topic: str
    student_id: str
    questions: list[AssessmentQuestion]


class AssessmentAnswer(BaseModel):
    question_id: str
    response: str


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


NoteSection.model_rebuild()


class SmartNotes(BaseModel):
    topic: str
    student_id: str
    summary: str
    sections: list[NoteSection]
    key_concepts: list[str]
    sources: list[SourceChunk] = Field(default_factory=list)


# ── API request shapes ─────────────────────────────────────────────────────────

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
    content: str = ""


# ── Classroom workflow DTOs ────────────────────────────────────────────────────

class InviteStudentRequest(BaseModel):
    student_id: str


class ClassroomInvite(BaseModel):
    id: str = Field(default_factory=new_id)
    classroom_id: str
    student_id: str
    teacher_id: str
    code: str
    status: Literal["pending", "accepted", "revoked"] = "pending"
    expires_at: str | None = None


class InviteAcceptance(BaseModel):
    student_id: str


class ClassroomMaterialCreate(BaseModel):
    title: str
    material_url: str
    content_type: str = "application/pdf"
    description: str = ""


class ClassroomMaterialBatchCreate(BaseModel):
    materials: list[ClassroomMaterialCreate]


class ClassroomMaterial(BaseModel):
    id: str = Field(default_factory=new_id)
    classroom_id: str
    teacher_id: str
    title: str
    material_url: str
    content_type: str = "application/pdf"
    description: str = ""


class KnowledgeGapStartRequest(BaseModel):
    student_id: str
    classroom_id: str
    mode: Literal["manual", "ai"] = "ai"
    topics: list[str] = Field(default_factory=list)
    max_topics: int = Field(default=3, ge=1, le=8)


# ── Flashcards ────────────────────────────────────────────────────────────────

class Flashcard(BaseModel):
    front: str
    back: str


class FlashcardsRequest(BaseModel):
    student_id: str
    topic: str
    content: str = ""


class FlashcardsResponse(BaseModel):
    student_id: str
    topic: str
    flashcards: list[Flashcard]


# ── Student auth / class join ──────────────────────────────────────────────────

class StudentAuthRequest(BaseModel):
    id: str
    email: str
    name: str = ""


class StudentJoinRequest(BaseModel):
    student_id: str
    code: str


# ── Teacher models ─────────────────────────────────────────────────────────────

class Teacher(BaseModel):
    id: str = Field(default_factory=new_id)
    email: str
    name: str
    institution: str = ""


class Student(BaseModel):
    id: str = Field(default_factory=new_id)
    email: str
    name: str
    teacher_id: str | None = None


class Classroom(BaseModel):
    id: str = Field(default_factory=new_id)
    teacher_id: str
    name: str
    description: str = ""
    topics: list[str] = Field(default_factory=list)
    join_code: str | None = None


class Enrollment(BaseModel):
    classroom_id: str
    student_id: str


class ClassroomCreate(BaseModel):
    teacher_id: str
    name: str
    description: str = ""
    topics: list[str] = Field(default_factory=list)
    join_code: str | None = None


class SyllabusUpload(BaseModel):
    classroom_id: str
    teacher_id: str
    topics: list[str]
    description: str = ""


class CohortAnalytics(BaseModel):
    classroom_id: str
    total_students: int
    avg_mastery: float
    topic_breakdown: list[TopicStatus]
    struggling_topics: list[str]
