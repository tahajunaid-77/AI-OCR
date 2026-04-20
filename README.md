# AI OCR Exam Evaluator

An AI-powered exam paper evaluation system that lets a user upload an image of an answer sheet, extract text with OCR, detect the document structure, evaluate answers, and return detailed feedback question by question.

This repository contains:
- a `backend/` service built with Node.js, Express, TypeScript, and MongoDB
- a `frontend/` app built with Next.js, React, TypeScript, and Tailwind CSS

## What This Project Does

The app accepts an uploaded exam paper image and processes it through a multi-step pipeline:

1. The frontend uploads the image to the backend.
2. The backend stores a submission record with `PENDING` status.
3. OCR extracts raw text from the uploaded image.
4. The evaluation layer detects whether the content looks like MCQ or paragraph answers.
5. Questions and student answers are extracted from the OCR text.
6. The answers are graded using language-model-assisted evaluation plus fallback heuristics.
7. A result object is stored with marks, percentage, question-wise feedback, and an overall summary.
8. The frontend polls the submission status and displays the result page when processing finishes.

## Current Tech Stack

### Backend

- Runtime: `Node.js`
- Framework: `Express`
- Language: `TypeScript`
- Database: `MongoDB` with `Mongoose`
- Validation: `Joi`
- File uploads: `Multer`
- Image preprocessing: `Sharp`
- OCR providers: `OCR.space` as primary, `API4AI` as fallback
- NLP providers: `Groq` as configured primary, `OpenAI` as fallback
- Logging: `Winston`

### Frontend

- Framework: `Next.js 16`
- UI library: `React 19`
- Language: `TypeScript`
- Styling: `Tailwind CSS 4`
- HTTP client: `Axios`
- Notifications: `react-hot-toast`
- Icons: `lucide-react`
- State helper available: `zustand`

## Architecture

```text
frontend (Next.js)
  -> uploads image to /v1/exam/submission
  -> redirects to /results/:id
  -> polls submission status

backend (Express)
  -> saves uploaded image to disk
  -> creates MongoDB submission record
  -> runs OCR
  -> extracts questions and answers
  -> evaluates answers
  -> stores final result in MongoDB
```

### Main backend areas

- `backend/src/APIs/exam/management`
  Used for CRUD operations on predefined exam templates.

- `backend/src/APIs/exam/submission`
  Used for upload, processing, retry, fetch, and delete submission flows.

- `backend/src/services/ocr.service.ts`
  Handles OCR, image quality checks, and OCR normalization.

- `backend/src/services/evaluation.service.ts`
  Handles document type detection, question extraction, answer evaluation, and overall feedback.

- `backend/src/services/textParser.service.ts`
  Contains a simpler parser for predefined exam evaluation mode.

## How The App Works In Detail

### 1. Frontend upload flow

The home page in `frontend/app/page.tsx` allows the user to:
- choose an image
- validate file type and size on the client
- preview the file
- submit it using multipart form data

The frontend currently sends `examId = "auto"` and relies on the backend's intelligent processing flow rather than requiring a predefined exam template.

### 2. Submission creation

`POST /v1/exam/submission`:
- stores the uploaded file on disk
- creates a MongoDB submission record
- marks it `PENDING`
- starts async background processing

### 3. OCR processing

The OCR service:
- validates image quality
- preprocesses the image using `sharp`
- sends the image to `OCR.space`
- falls back to `API4AI` if needed
- normalizes OCR output to reduce formatting noise

### 4. Document understanding

The evaluation layer tries to determine whether the uploaded content is:
- `MCQ`
- `PARAGRAPH`

It uses:
- heuristics based on OCR structure
- language model assistance when available
- fallback extraction logic when the model output is poor or unavailable

### 5. Answer extraction

The backend tries to identify:
- question headings
- answer blocks
- MCQ options and selected answers
- paragraph subheadings versus true top-level questions

Recent extraction logic also reduces OCR-noise issues by:
- filtering junk headings
- merging support headings into the current block
- preserving one answer block when content is really one paragraph answer with sub-sections

### 6. Evaluation

For paragraph and short answers:
- the app uses an NLP provider to score the answer, estimate similarity, produce feedback, and suggest a brief correct answer
- if the model fails, fallback scoring uses concept matching and cosine similarity

For MCQs:
- the app asks the configured NLP provider to determine the correct option and compare it to the student's answer
- if the provider fails, a fallback response is returned instead of pretending confidence

### 7. Result storage and display

The backend stores:
- OCR text
- extracted answers
- per-question evaluation results
- total marks
- percentage
- final feedback

The results page:
- polls every few seconds while the submission is `PENDING` or `PROCESSING`
- shows extracted OCR text
- shows marks, status, feedback, and question-by-question results

## Data Model Overview

### Exam

An exam contains:
- `title`
- `subject`
- `totalMarks`
- `questions[]`
- `createdBy`

Each question may contain:
- `questionNumber`
- `questionText`
- `questionType`
- `marks`
- `options`
- `correctAnswer`
- `keyConcepts`
- `rubric`

### Submission

A submission contains:
- `examId`
- `studentId`
- `imageUrl`
- `fileName`
- `fileSize`
- `mimeType`
- `status`
- `extractedText`
- `extractedAnswers[]`
- `evaluationResults[]`
- `totalMarksObtained`
- `totalMarks`
- `percentage`
- `feedback`
- `processingError`

Submission statuses:
- `PENDING`
- `PROCESSING`
- `COMPLETED`
- `FAILED`

## API Overview

Base API root:

```text
/v1
```

### Exam management routes

- `POST /v1/exam/management`
- `GET /v1/exam/management`
- `GET /v1/exam/management/:examId`
- `PUT /v1/exam/management/:examId`
- `DELETE /v1/exam/management/:examId`

### Submission routes

- `POST /v1/exam/submission`
- `GET /v1/exam/submission`
- `GET /v1/exam/submission/:submissionId`
- `GET /v1/exam/submission/exam/:examId`
- `POST /v1/exam/submission/:submissionId/retry`
- `DELETE /v1/exam/submission/:submissionId`

## Setup

### Prerequisites

- `Node.js 18+`
- `MongoDB`
- one or more OCR API keys
- one or more NLP API keys

### Backend setup

```bash
cd backend
npm install
```

Create a `.env` file in `backend/` with values like:

```env
ENV=development
PORT=5000
SERVER_URL=http://localhost:5000
DATABASE_URL=mongodb://localhost:27017/ai-exam-evaluator

ACCESS_TOKEN_SECRET=replace-me-with-a-long-secret
REFRESH_TOKEN_SECRET=replace-me-with-a-long-secret

API4AI_API_KEY=
OCR_SPACE_API_KEY=

GROQ_API_KEY=
GROQ_API_URL=https://api.groq.com/openai/v1

OPENAI_API_KEY=
OPENAI_API_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4.1-mini

NLP_PROVIDER=auto

MAX_FILE_SIZE=10485760
UPLOAD_DIR=uploads/exam-papers
ALLOWED_FILE_TYPES=image/jpeg,image/png,application/pdf
```

Run the backend:

```bash
npm run start:dev
```

### Frontend setup

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/v1
```

Run the frontend:

```bash
npm run dev
```

Open:

- frontend: `http://localhost:3000`
- backend API: `http://localhost:5000/v1`

## Package Breakdown

### Backend runtime dependencies

- `axios`: HTTP client for OCR and NLP API calls
- `bcrypt`: hashing utility for user/auth modules
- `chalk`: terminal color formatting
- `colorette`: color helpers for CLI output
- `cookie-parser`: cookie parsing middleware
- `cors`: CORS middleware
- `countries-and-timezones`: timezone and country helpers
- `cross-env`: cross-platform environment variable handling in scripts
- `dayjs`: date/time utilities
- `dotenv-flow`: environment variable loading
- `execa`: child process execution helpers
- `express`: backend web framework
- `form-data`: multipart requests to OCR providers
- `helmet`: security headers
- `inquirer`: interactive CLI prompts
- `joi`: request and env validation
- `jsonwebtoken`: token support
- `libphonenumber-js`: phone number utilities
- `mongoose`: MongoDB ODM
- `multer`: file upload middleware
- `ora`: CLI spinners
- `progress`: CLI progress bar utilities
- `rate-limiter-flexible`: request limiting
- `resend`: email integration
- `semver`: semantic version helpers
- `sharp`: image preprocessing before OCR
- `source-map-support`: stack trace improvements
- `ts-migrate-mongoose`: migration support
- `uuid`: ID generation
- `winston`: application logging
- `winston-mongodb`: MongoDB-backed logging

### Backend dev dependencies

- `@commitlint/cli`
- `@commitlint/config-conventional`
- `@eslint/js`
- `@types/bcrypt`
- `@types/cookie-parser`
- `@types/cors`
- `@types/express`
- `@types/jest`
- `@types/jsonwebtoken`
- `@types/multer`
- `@types/node`
- `@types/source-map-support`
- `@types/supertest`
- `@types/uuid`
- `commitlint-config-gitmoji`
- `devmoji`
- `eslint`
- `eslint-config-prettier`
- `eslint-plugin-react`
- `globals`
- `husky`
- `jest`
- `lint-staged`
- `nodemon`
- `prettier`
- `supertest`
- `ts-jest`
- `ts-node`
- `typescript`
- `typescript-eslint`

### Frontend dependencies

- `next`: React framework for the frontend
- `react`: UI library
- `react-dom`: React DOM renderer
- `axios`: HTTP client
- `zustand`: lightweight state management
- `react-hot-toast`: toast notifications
- `lucide-react`: icons
- `clsx`: className composition
- `tailwind-merge`: merge Tailwind class strings

### Frontend dev dependencies

- `@tailwindcss/postcss`
- `@types/node`
- `@types/react`
- `@types/react-dom`
- `eslint`
- `eslint-config-next`
- `tailwindcss`
- `typescript`

## Scripts

### Backend

- `npm run build`
- `npm run start:dev`
- `npm run serve`
- `npm run test`
- `npm run lint`
- `npm run lint:fix`
- `npm run format:check`
- `npm run format:fix`
- `npm run migrate:dev`
- `npm run migrate:prod`

### Frontend

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`

## Limitations and Notes

- PDF processing is defined in config and upload rules, but PDF OCR is not fully implemented yet.
- The intelligent grading flow does not require a predefined exam template.
- Some older docs in the repo may describe earlier provider choices; the actual code should be treated as the source of truth.
- OCR accuracy still depends heavily on image quality, handwriting clarity, and document layout.
- Secrets should live in environment files and should never be committed to GitHub.

## Recommended GitHub Notes

If you are publishing this repository:
- remove any real API keys from tracked files
- add `.env` files to `.gitignore`
- rotate any keys that have already been exposed

## Folder Structure

```text
ai-ocr-exam/
├─ backend/
│  ├─ src/
│  │  ├─ APIs/
│  │  ├─ services/
│  │  ├─ config/
│  │  ├─ handlers/
│  │  ├─ middlewares/
│  │  └─ utils/
│  ├─ uploads/
│  └─ package.json
├─ frontend/
│  ├─ app/
│  ├─ components/
│  ├─ lib/
│  └─ package.json
└─ README.md
```

## Summary

This project is an end-to-end OCR and AI evaluation system for exam papers. It combines image upload, OCR, document parsing, answer extraction, model-assisted grading, and a simple frontend for result display. The current implementation is designed to be practical for experimentation and demos, while still having a clean enough structure to extend into a fuller production system.
