# Project Brain Guardian: System Documentation

## Module Overview
**Module Name**: Project Brain Guardian
**Module ID**: module_project_brain_guardian
**Maintainer**: System Documentation Architect (AI Agent)
**Status**: Active
**Last Updated**: 2026-01-04

## Description
The **Project Brain Guardian** is a system automation tool designed to bridge the gap between codebase changes and the project's persistent knowledge base in Google Drive. It ensures that technical documentation and the central `project_data` registry are always in sync with the latest code state.

## Core Capabilities
1.  **Registry Management**: Automatically updates `project_data.json` with version bumps, timestamps, and change summaries.
2.  **Cloud Sync**: Encrypted, authenticated backup of documentation and registry files to a designated Google Drive folder using a Service Account.
3.  **Local Mirroring**: Maintains a local `project_brain_backup` directory for redundancy.

## Architecture
- **Trigger**: Currently manual invocation (CLI) or AI Agent triggered. Future: Watcher/Git Hook.
- **Authentication**: Uses Google Cloud Service Account (`service-account-key.json`).
- **Configuration**: Uses `.env` for sensitve IDs (`GDRIVE_BACKUP_FOLDER_ID`).

## Usage
\`\`\`bash
npx ts-node scripts/project_brain_guardian.ts "<ModuleName>" "<ChangeSummary>" "<PathToFile>"
\`\`\`

---

# AI Agents Complete Registry
*Documentation Date: 2026-01-04*

## Overview
This document provides a comprehensive registry of ALL AI agents in the AI-LMS System. The system uses a sophisticated multi-agent architecture with specialized agents for different educational tasks.

---

## 1. TUTORING & CHAT AGENTS

### 1.1 Teacher Persona Bots
**Location:** `src/services/ai/prompts.ts`

| Persona ID | Hebrew Name | Behavior | Best For |
|------------|-------------|----------|----------|
| `teacher` | המורה המלווה | Gently corrects, encouraging tone | Default tutoring |
| `socratic` | המנחה הסוקרטי | Answers questions with questions | Critical thinking development |
| `concise` | התמציתי | Short 2-3 sentence responses | Quick help, time-pressed students |
| `coach` | המאמן המאתגר | Challenges students to go deeper | Advanced learners |

**Integration Point:** `src/components/AiTutor.tsx`
**Model:** GPT-4o-mini via OpenAI Proxy
**Safety Features:** Distress detection, input validation, security filtering

---

## 2. EXAM GENERATION PIPELINE (3-Stage)

### 2.1 Stage 1: Exam Architect
**Location:** `functions/src/services/examArchitect.ts`
**Prompts:** `functions/src/ai/examPrompts.ts`

**Role:** Strategic test planner (The "Brain")
**Responsibilities:**
- Holistic source material analysis
- Test structure and question specification
- Bloom taxonomy level assignment
- Topic coverage balancing

**Config:** Temperature 0.3 (deterministic)
**Output:** `ExamSkeleton` object with time estimates, difficulty levels, point allocation

### 2.2 Stage 2: Exam Generator
**Location:** `functions/src/services/examGenerator.ts`

**Role:** Question creator (The "Hands")
**Supported Question Types:**
- Multiple Choice (MCQ)
- True/False
- Fill-in-the-Blank
- Ordering/Sequencing
- Open-ended questions

**Config:** Temperature 0.3 (deterministic)
**Output:** Generated questions with distractor analysis and grading rubrics

### 2.3 Stage 3: Exam Guardian
**Location:** `functions/src/services/examGuardian.ts`

**Role:** Quality assurance validator
**Validation Checks:**
- Hint/teaching content leak detection
- Formal, objective tone validation
- Answer reveal detection in feedback
- Bias detection (cultural, gender, socioeconomic)
- Accessibility evaluation

**Config:** Temperature 0.1 (very strict)
**Output:** Quality score (0-100) + detailed validation report

---

## 3. CONTENT GENERATION AGENTS

### 3.1 Unit Skeleton Generator (Brain)
**Location:** `functions/src/controllers/aiController.ts`

**Functions:**
- `generateTeacherLessonPlan()` - Creates 5E Model lesson plans
- `generateStudentUnitSkeleton()` - Creates interactive learning units

**Role:** Holistic commander - plans structure without writing specific content
**Output:** Roadmap with logical boundaries and topic assignments

### 3.2 Step Content Generator (Hands)
**Location:** `functions/src/controllers/aiController.ts`
**Function:** `generateStepContent()`

**Role:** Focused executor - writes content within boundaries set by Brain
**Features:** Multi-modal content support (text + images)

### 3.3 Question Generator Suite
**Location:** `src/services/ai/geminiApi.ts`

| Function | Question Type |
|----------|---------------|
| `generateSingleMultipleChoiceQuestion()` | Multiple Choice |
| `generateSingleOpenQuestion()` | Open-ended |
| `generateCategorizationQuestion()` | Sorting/Categorization |
| `generateOrderingQuestion()` | Sequencing |
| `generateFillInBlanksQuestion()` | Cloze/Fill-in-blank |
| `generateMemoryGame()` | Matching pairs game |

### 3.4 Content Validation Agent
**Location:** `src/services/ai/geminiApi.ts`
**Function:** `validateContent()`

**Validation Criteria:**
- Readability score
- Cognitive load assessment
- CEFR level compliance
- Structural integrity

### 3.5 Content Refinement Agent
**Location:** `src/services/ai/geminiApi.ts`
**Function:** `refineContentWithPedagogy()`

**Purpose:** Improves content clarity, accuracy, and engagement based on pedagogical instructions

### 3.6 AI Auto-Fix Agent
**Location:** `functions/src/controllers/aiController.ts`
**Function:** `attemptAutoFix()`

**Purpose:** Automatically repairs validation failures
**Config:** Temperature 0.3

---

## 4. ASSESSMENT & GRADING AGENTS

### 4.1 Automated Grading Service
**Location:** `src/services/gradingService.ts`
**Function:** `gradeBatch()`

**Features:**
- Batch processing of student answers
- Rubric-based evaluation
- Constructive feedback generation

### 4.2 Student Answer Evaluator
**Location:** `src/services/ai/geminiApi.ts`
**Function:** `checkOpenQuestionAnswer()`

**Modes:**
- **Learning Mode:** Guiding, scaffolded feedback
- **Exam Mode:** Strict, objective evaluation

**Output:** Status (correct/partial/incorrect) + contextual feedback

### 4.3 Grading Agent
**Location:** `src/services/ai/geminiApi.ts`
**Function:** `generateGrading()`

**Output:** JSON with grades (0-100) + Hebrew feedback

---

## 5. ANALYTICS & PROFILING AGENTS

### 5.1 Student Analysis Agent
**Location:** `src/services/ai/geminiApi.ts`
**Function:** `generateStudentAnalysis()`

**Output:**
- Strengths & weaknesses
- Psychological learning profile
- Engagement score

### 5.2 Class Analysis Agent
**Location:** `src/services/ai/geminiApi.ts`
**Function:** `generateClassAnalysis()`

**Output:**
- Class-level strengths
- Common weak skills
- Actionable teaching strategies
- Class "vibe" assessment

### 5.3 Student Report Generator
**Location:** `src/services/ai/geminiApi.ts`
**Function:** `generateStudentReport()`

**Output:** Comprehensive JSON report with:
- Summary
- Knowledge assessment
- Depth of understanding
- Expression quality
- Personalized recommendations

---

## 6. ADAPTIVE LEARNING AGENT

### 6.1 Adaptive Content Service
**Location:** `src/services/adaptiveContentService.ts`
**Function:** `enrichActivityBlock()`

**Enrichment Features:**
- IRT Beta difficulty estimation
- Bloom taxonomy classification
- Error tagging for distractors
- Misconception analysis for wrong answers

---

## 7. MEDIA GENERATION AGENTS

### 7.1 Podcast Script Generator
**Location:** `src/services/audioGenerator.ts`
**Function:** `generateScript()`

**Format:** Two-host educational dialogue
- **Dan:** Analytical, explains concepts
- **Noa:** Curious, asks clarifying questions

**Config:** Temperature 0.7 (creative), Hebrew language

### 7.2 Detailed Script Generator
**Location:** `src/services/ai/geminiApi.ts`
**Function:** `generatePodcastScript()`

**Output:** `DialogueScript` with speaker roles and emotional cues

### 7.3 Image Generation (DALL-E 3)
**Location:** `src/services/ai/geminiApi.ts`
**Function:** `generateAiImage()`

**Cost:** $0.040 per image
**Features:** Fallback mechanism, provider selection

### 7.4 Image Generation (Imagen 3)
**Location:** `src/services/ai/imagenService.ts`
**Function:** `generateImagenImage()`

**Cost:** $0.020 per image (50% cheaper)
**Status:** Optional, requires Cloud Function deployment

### 7.5 Infographic Generator
**Location:** `src/services/ai/geminiApi.ts`
**Function:** `generateInfographicFromText()`

**Supported Types:**
- Flowchart
- Timeline
- Comparison
- Cycle diagram

**Features:**
- Dual-tier caching (memory + Firebase Storage)
- Analytics tracking
- Hebrew-optimized prompts

### 7.6 Text-to-Speech (ElevenLabs)
**Location:** `src/services/elevenLabs.ts`

**Features:**
- Multi-language voice support
- Automatic Hebrew/English detection
- Gendered voice options (Dan/Noa)

---

## 8. INFRASTRUCTURE AGENTS

### 8.1 OpenAI Proxy Function
**Location:** `functions/src/index.ts`
**Function:** `openaiProxy`

**Security Features:**
- Firebase Auth validation
- Rate limiting (by request type)
- Cost control and monitoring

### 8.2 YouTube Transcription
**Location:** `functions/src/index.ts`
**Function:** `transcribeYoutube()`

**Features:** Multi-language caption support, fallback strategy

### 8.3 Imagen Proxy
**Location:** `functions/src/imagenProxy.ts`

**Functions:**
- `generateImagenImage()` - Image generation
- `imagenHealthCheck()` - Service health monitoring
- `imagenStats()` - Usage statistics

---

## 9. QA & TESTING AGENTS

### 9.1 IDO QA Agent
**Location:** `scripts/ido_qa_agent.ts`

**Persona:** Simulates a 14-year-old student tester
**Capabilities:**
- Static analysis (Readiness Check)
- Dynamic user interaction simulation
- Bug report generation

**Output:** JSON test reports with pass/fail status and issues found

---

## 10. MODEL CONFIGURATION MATRIX

| Use Case | Model | Temperature | Cost Level |
|----------|-------|-------------|------------|
| Primary Generation | GPT-4o-mini | 0.3-0.5 | Low |
| Quality Validation | GPT-4o | 0.1 | Medium |
| Creative Content | GPT-4o-mini | 0.7 | Low |
| Strict Validation | GPT-4o | 0.1 | Medium |
| Image (Standard) | DALL-E 3 | N/A | $0.040 |
| Image (Economy) | Imagen 3 | N/A | $0.020 |

---

## 11. PROMPT FILES REGISTRY

| File Path | Purpose |
|-----------|---------|
| `src/services/ai/prompts.ts` | Bot personas, validation prompts |
| `src/prompts/pedagogicalPrompts.ts` | Linguistic validation rules |
| `src/prompts/audioPrompts.ts` | Podcast script generation |
| `functions/src/ai/prompts.ts` | Backend skeleton & step prompts |
| `functions/src/ai/examPrompts.ts` | Exam 3-stage pipeline prompts |

---

## Change Log
- **2026-01-04**: Added complete AI Agents Registry documentation
- **2026-01-01**: Initial release. Implemented registry logic and Google Drive V3 API integration.
