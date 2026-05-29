# Implementation Plan: Synapse Student Backend

## Database Schema (Prisma)
We will extend the FUSE base schema to support the Synapse requirements.

### Core Entities to Add/Modify:
- `User`: Add a `role` enum (`TEACHER`, `STUDENT`).
- `Course`: Created by a Teacher, contains a unique `inviteCode`.
- `CourseEnrollment`: Join table mapping `Student` to `Course`.
- `CourseMaterial`: Files (PDF, etc.) uploaded by the Teacher for a Course.
- `CourseTopic`: Syllabus topics uploaded by the Teacher.
- `KnowledgeGap`: Tracks specific identified gaps for a student per topic.
- `TopicProgress`: Student's specific state in a topic (chat history, flashcard progress, quiz scores).

## Backend Split (Python FastAPI)

### Teacher Backend (Awais's Domain)
- **Routes:** `/api/teacher/courses`, `/api/teacher/courses/{id}/materials`, `/api/teacher/courses/{id}/topics`
- **Agents:** Classroom summarization, Knowledge Gap aggregation.

### Student Backend (AI's Domain)
- **Routes:** 
  - `/api/student/join` (using invite code)
  - `/api/student/courses/{id}/topics` (list topics)
  - `/api/student/topics/{id}/knowledge-gap` (initiate manual or AI assessment)
  - `/api/student/topics/{id}/chat` (interactive AI tutor)
  - `/api/student/topics/{id}/smart-notes` (generate/fetch)
  - `/api/student/topics/{id}/flashcards` (generate/fetch)
  - `/api/student/topics/{id}/quiz` (generate based on chat context)
- **Agents:**
  - **KnowledgeGapAgent:** Assesses understanding by asking questions.
  - **TutorAgent:** Conversational chat based on selected learning style.
  - **QuizGenerationAgent:** Creates personalized quizzes based on the interaction history.

## Execution Steps
1. **Database Update:** Update `schema.prisma` with the new tables (collaborating with Teacher side constraints).
2. **Prisma Generation:** Run `npx prisma generate` & `npx prisma db push`.
3. **Pydantic Models Update:** Update `backend/synapse/models.py` with Student view structures.
4. **Student Routers Setup:** Create `backend/synapse/routers/student.py` and hook it into `app.py`.
5. **Agent Implementation:** Implement the AI gap assessment and personalized quiz logic in `backend/synapse/agents`.
