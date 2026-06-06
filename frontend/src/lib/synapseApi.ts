/**
 * Synapse AI — typed client for the FastAPI backend (localhost:8000).
 * All student and teacher routes are covered here.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`POST ${path} → ${res.status}: ${err}`);
  }
  return res.json();
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GET ${path} → ${res.status}: ${err}`);
  }
  return res.json();
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TopicStatus {
  topic: string;
  level: "strong" | "moderate" | "needs_improvement";
  evidence: string;
}

export interface KnowledgeMap {
  student_id: string;
  topics: TopicStatus[];
  overall_mastery: number;
}

export interface DiagnosticQuestion {
  id: string;
  topic: string;
  prompt: string;
  choices: { label: string; text: string }[];
  correct_label: string;
  rationale: string;
}

export interface DiagnosticQuiz {
  student_id: string;
  topics: string[];
  questions: DiagnosticQuestion[];
}

export interface SmartNotes {
  topic: string;
  student_id: string;
  summary: string;
  sections: { heading: string; content: string; subsections?: unknown[] }[];
  key_concepts: string[];
  sources: { title: string; locator: string; text: string }[];
}

export interface Flashcard {
  front: string;
  back: string;
}

export interface FlashcardsResponse {
  student_id: string;
  topic: string;
  flashcards: Flashcard[];
}

export interface AssessmentQuestion {
  id: string;
  topic: string;
  type: "mcq" | "short_answer";
  prompt: string;
  choices?: { label: string; text: string }[] | null;
  correct_label?: string | null;
  model_answer?: string | null;
  rationale: string;
}

export interface Assessment {
  id: string;
  topic: string;
  student_id: string;
  questions: AssessmentQuestion[];
}

export interface GradeReport {
  assessment_id: string;
  topic: string;
  student_id: string;
  score: number;
  per_question: {
    question_id: string;
    correct: boolean;
    student_response: string;
    correct_answer: string;
    rationale: string;
  }[];
  updated_status: TopicStatus;
}

export interface LearningProfile {
  modality: "visual" | "text" | "audio";
  pace: "deep" | "methodical";
}

export interface ClassroomInfo {
  classroom_id: string;
  name: string;
  description: string;
  topics: string[];
  teacher_id: string;
}

// ── Student auth ───────────────────────────────────────────────────────────────

export const studentApi = {
  register: (id: string, email: string, name: string) =>
    post("/student/auth/register", { id, email, name }),

  getProfile: (studentId: string) =>
    get(`/student/auth/${studentId}`),

  // ── Classes ──────────────────────────────────────────────────────────────────

  joinClass: (studentId: string, code: string): Promise<ClassroomInfo> =>
    post("/student/classes/join", { student_id: studentId, code }),

  listClasses: (studentId: string) =>
    get<{ student_id: string; classrooms: ClassroomInfo[] }>(`/student/classes/${studentId}`),

  getTopics: (classroomId: string) =>
    get<{ classroom_id: string; topics: string[] }>(`/student/classes/${classroomId}/topics`),

  // ── Accept invite (Om's flow) ────────────────────────────────────────────────

  acceptInvite: (inviteCode: string, studentId: string) =>
    post(`/student/classrooms/invites/${inviteCode}/accept`, { student_id: studentId }),

  getInviteContext: (inviteCode: string, studentId?: string) =>
    get(`/student/classrooms/invites/code/${inviteCode}${studentId ? `?student_id=${studentId}` : ""}`),

  listInvites: (studentId: string, status?: string) =>
    get(`/student/classrooms/invites/${studentId}${status ? `?status=${status}` : ""}`),

  // ── Knowledge gap ────────────────────────────────────────────────────────────

  startKnowledgeGap: (studentId: string, classroomId: string, mode: "manual" | "ai" = "ai", topics: string[] = []) =>
    post<DiagnosticQuiz>("/student/classrooms/knowledge-gap/start", {
      student_id: studentId,
      classroom_id: classroomId,
      mode,
      topics,
    }),

  diagnoseQuiz: (studentId: string, topics: string[]) =>
    post<DiagnosticQuiz>("/student/diagnose/quiz", { student_id: studentId, topics }),

  diagnoseEvaluate: (studentId: string, topics: string[], answers: { question_id: string; selected_label: string }[]) =>
    post<KnowledgeMap>("/student/diagnose/evaluate", { student_id: studentId, topics, answers }),

  getKnowledgeMap: (studentId: string) =>
    get<KnowledgeMap | null>(`/student/knowledge-map/${studentId}`),

  // ── Materials ────────────────────────────────────────────────────────────────

  generateMaterials: (studentId: string, topics: string[]) =>
    post("/student/pipeline/generate", { student_id: studentId, topics }),

  generateNotes: (studentId: string, topic: string, content = "") =>
    post<SmartNotes>("/student/notes/", { student_id: studentId, topic, content }),

  listNotes: (studentId: string) =>
    get<{ student_id: string; notes: unknown[] }>(`/student/notes/${studentId}`),

  generateFlashcards: (studentId: string, topic: string, content = "") =>
    post<FlashcardsResponse>("/student/flashcards/", { student_id: studentId, topic, content }),

  getFlashcards: (studentId: string, topic: string) =>
    get<FlashcardsResponse>(`/student/flashcards/${studentId}/${encodeURIComponent(topic)}`),

  // ── Assessment ───────────────────────────────────────────────────────────────

  createAssessment: (studentId: string, topic: string) =>
    get<Assessment>(`/student/assess/${encodeURIComponent(topic)}?student_id=${studentId}`),

  gradeAssessment: (assessmentId: string, studentId: string, topic: string, answers: { question_id: string; response: string }[]) =>
    post<GradeReport>("/student/assess/grade", {
      assessment_id: assessmentId,
      student_id: studentId,
      topic,
      answers,
    }),

  memoryQuiz: (studentId: string, topic: string, chatSummary = "") =>
    post<Assessment>("/student/pipeline/memory-quiz", {
      student_id: studentId,
      topic,
      chat_summary: chatSummary,
    }),

  // ── Tutor (SSE stream) ───────────────────────────────────────────────────────

  tutorStream(studentId: string, topic: string, message: string, profile?: Partial<LearningProfile>): EventSource {
    // SSE: POST body must be passed via query or a pre-flight is needed.
    // Backend uses POST for body, so we use fetch + ReadableStream instead.
    throw new Error("Use tutorStreamFetch instead");
  },

  async *tutorStreamFetch(
    studentId: string,
    topic: string,
    message: string,
    profile: LearningProfile = { modality: "text", pace: "methodical" },
    signal?: AbortSignal,
  ): AsyncGenerator<{ type: string; [k: string]: unknown }> {
    const res = await fetch(`${BASE}/student/tutor/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId, topic, message, profile }),
      signal,
    });
    if (!res.ok) throw new Error(`Tutor stream failed: ${res.status}`);
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            yield JSON.parse(line.slice(6));
          } catch {}
        }
      }
    }
  },
};

// ── Teacher API ───────────────────────────────────────────────────────────────

export const teacherApi = {
  register: (id: string, email: string, name: string, institution = "") =>
    post("/teacher/auth/register", { id, email, name, institution }),

  getProfile: (teacherId: string) =>
    get(`/teacher/auth/${teacherId}`),

  createClass: (teacherId: string, name: string, description = "", topics: string[] = [], joinCode?: string) =>
    post("/teacher/classes/", { teacher_id: teacherId, name, description, topics, join_code: joinCode }),

  listClasses: (teacherId: string) =>
    get<{ classrooms: unknown[] }>(`/teacher/classes/${teacherId}/all`),

  getClass: (classroomId: string) =>
    get(`/teacher/classes/${classroomId}`),

  uploadSyllabus: (classroomId: string, teacherId: string, topics: string[], description = "") =>
    post(`/teacher/classes/${classroomId}/syllabus`, {
      classroom_id: classroomId,
      teacher_id: teacherId,
      topics,
      description,
    }),

  enrollStudent: (classroomId: string, studentId: string) =>
    post(`/teacher/classes/${classroomId}/enroll?student_id=${studentId}`, {}),

  getAnalytics: (classroomId: string) =>
    get(`/teacher/analytics/${classroomId}`),

  getReport: (classroomId: string) =>
    get(`/teacher/reports/${classroomId}/summary`),
};
