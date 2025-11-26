# Project Spec: AI-Powered LMS (The "Bionic Teacher")

## 1. Vision
We are building a next-gen Learning Management System (LMS) that replaces "passive management" with "active AI partnership".
Unlike the legacy system (which was static and manual), this new system uses AI to:
- **Generate Content:** Automatically create lessons, quizzes, and leveled texts from raw documents.
- **Auto-Grade:** Grade open-ended questions and provide formative feedback.
- **Personalize:** Adapt content difficulty (Scaffolding) for each student in real-time.

## 2. Core User Roles
1.  **Publisher/Admin:** Uploads raw content (PDF/DOCX) -> AI converts it to structured interactive units.
2.  **Teacher:** Reviews AI-generated content, assigns it to classes, monitors real-time dashboards.
3.  **Student:** Interacts with the content. Needs a gamified, RTL (Hebrew) interface with "Help/Hint" features.

## 3. Technical Architecture
- **Frontend:** React, Vite, TypeScript, Tailwind CSS.
- **Language:** Hebrew (RTL) is the primary interface.
- **Data Structure (See `src/types.ts`):**
    - `Course` > `Module` > `LearningUnit` > `ActivityBlock`.
    - Content is modular (Blocks), not monolithic pages.

## 4. Key Modules to Build

### A. The Ingestion Wizard (Priority 1)
* **Goal:** Allow uploading a source file and parsing it into a structured lesson.
* **UI:** Drag & drop zone, split-screen (Raw Text vs. Structured Preview).
* **AI Logic:** Parse text into "Explanation", "Example", and "Question" blocks automatically.

### B. The AI Studio (Editor)
* **Goal:** Edit and refine the generated content.
* **Features:**
    - **Levelizer:** One-click generation of 3 difficulty levels (Easy, Medium, Hard) for the same text.
    - **Activity Gen:** Generate multiple-choice questions from text.

### C. The Student Player
* **Goal:** Display the content to the end-user.
* **Features:**
    - **Clean, distraction-free reading mode.**
    - **Interactive widgets for questions.**
    - **"Ask AI Tutor" chat bubble for help.**

## 5. Design Guidelines
- **Look & Feel:** Clean, modern, white/gray backgrounds with distinct primary colors for actions.
- **Typography:** Sans-serif, readable Hebrew fonts.
- **Layout:** Strict RTL support. Sidebar on the Right.

---
*Use this document to understand the context of every task I give you.*
