# Synapse: Brain & Memory

## Project Overview
**Product Name:** Synapse
**Branch:** `build2`
**Base:** Built on top of the FUSE product.
**Core Concept:** An AI tutor that learns you before it teaches you, grounding every lesson in authentic material and checking understanding as it goes.

## Team Split & Roles
- **Awais / Teacher Backend:** Responsible for the Teacher view backend (Courses, Student Invites, Material/Syllabus Upload, Knowledge Gap Assessment Reception, Classroom Chat Summary).
- **AI / Student Backend:** Responsible for the Student view backend (Classroom access, Knowledge Gap Generation/Selection, Topic Chat Interface, Smart Notes, Flashcards, Personalized Quizzes).
- **Aman / Frontend:** Responsible for frontend implementation and tweaks for both views.

## Core Workflows (Student View)
1. **Onboarding / Classroom Joining:** Student accepts an invite using a specific userid and opens the classroom.
2. **Knowledge Gap Identification:**
   - **Manual:** Student flags topics as "concept is new" or "no clue".
   - **AI-Agent:** AI asks questions per topic to assess understanding. Generates feedback and a report identifying critical knowledge gaps.
3. **Topic Learning Interface (Chat):**
   - **Top Bar Tools:** Learning Style Smart Notes (Visual/Audio/Text), Flashcards, Quiz.
   - **Chatbot Interaction:** Learn concepts conversationally.
   - **Assessments (Quiz):** Clicking 'start' generates a personalized quiz based on chat interactions to assess improvement. Results update the knowledge report sent to the teacher.

## Context Constraints
- Must align database changes (Prisma) so that they work for both Teacher and Student sides seamlessly.
- Avoid conflicts with Awais (Teacher backend) by ensuring clean separation of concerns in routes and agent logic.
