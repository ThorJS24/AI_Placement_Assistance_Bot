# API Documentation

## POST /api/auth/signup

**Summary**: Signup

**Responses**:
- 200: Successful Response
- 422: Validation Error

## POST /api/auth/login

**Summary**: Login

**Responses**:
- 200: Successful Response
- 422: Validation Error

## POST /api/auth/logout

**Summary**: Logout

**Responses**:
- 200: Successful Response

## GET /api/auth/me

**Summary**: Me

**Responses**:
- 200: Successful Response

## POST /api/chat/stream

**Summary**: Stream Chat

**Description**: Streams the assistant's reply as plain text chunks (fetch-based streaming,
not a strict SSE parser - the frontend just reads and appends each chunk).

The actual token loop stays a *synchronous* generator on purpose: Starlette
runs sync generators in a thread pool automatically, so one slow LLM call
never blocks the event loop for other students' requests. Disconnect
detection (stopping early if the student hits "stop generating" or closes
the tab) instead runs as a small concurrent asyncio task that flips a
threading.Event the generator checks between chunks - this way we get real
early-exit without giving up the thread-pooled streaming.

**Parameters**:
- x-student-name (header): 
- x-student-pin (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## GET /api/chat/history/{session_id}

**Summary**: Get History

**Parameters**:
- session_id (path) (Required): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## PATCH /api/chat/message/{message_id}/feedback

**Summary**: Set Message Feedback

**Parameters**:
- message_id (path) (Required): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## GET /api/chat/suggestions

**Summary**: Get Suggestions

**Responses**:
- 200: Successful Response

## GET /api/chat/sessions

**Summary**: List Sessions

**Description**: This student's chat conversations, most recently active first - powers
the ChatGPT-style history list in the sidebar.

**Parameters**:
- x-student-name (header): 
- x-student-pin (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## DELETE /api/chat/sessions/{session_id}

**Summary**: Delete Session

**Parameters**:
- session_id (path) (Required): 
- x-student-name (header): 
- x-student-pin (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## PATCH /api/chat/sessions/{session_id}

**Summary**: Rename Session

**Parameters**:
- session_id (path) (Required): 
- x-student-name (header): 
- x-student-pin (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## POST /api/resume/build

**Summary**: Build Resume

**Parameters**:
- x-student-name (header): 
- x-student-pin (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## GET /api/resume/download/{filename}

**Summary**: Download Resume

**Parameters**:
- filename (path) (Required): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## GET /api/resume/list

**Summary**: List Saved Resumes

**Description**: This student's previously built resume drafts - powers the "My saved
resumes" panel so a student can come back and re-edit one later.

**Parameters**:
- x-student-name (header): 
- x-student-pin (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## GET /api/resume/{resume_id}

**Summary**: Get Saved Resume

**Parameters**:
- resume_id (path) (Required): 
- x-student-name (header): 
- x-student-pin (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## DELETE /api/resume/{resume_id}

**Summary**: Delete Saved Resume

**Parameters**:
- resume_id (path) (Required): 
- x-student-name (header): 
- x-student-pin (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## POST /api/resume/analyze

**Summary**: Analyze Resume

**Parameters**:
- x-student-name (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## GET /api/roadmap/templates

**Summary**: Templates

**Responses**:
- 200: Successful Response

## POST /api/roadmap/generate

**Summary**: Generate

**Parameters**:
- x-student-name (header): 
- x-student-pin (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## GET /api/roadmap/history

**Summary**: History

**Parameters**:
- x-student-name (header): 
- x-student-pin (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## POST /api/roadmap/pdf

**Summary**: Roadmap Pdf

**Responses**:
- 200: Successful Response
- 422: Validation Error

## GET /api/roadmap/pdf/download/{filename}

**Summary**: Download Roadmap Pdf

**Parameters**:
- filename (path) (Required): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## POST /api/roadmap/image

**Summary**: Roadmap Image Export

**Responses**:
- 200: Successful Response
- 422: Validation Error

## GET /api/roadmap/image/download/{filename}

**Summary**: Download Roadmap Image

**Parameters**:
- filename (path) (Required): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## GET /api/roadmap/image/ai-available

**Summary**: Ai Image Available

**Description**: Whether the optional AI-illustrated image extra is configured on
this deployment (see .env.example's IMAGE_GEN_API_KEY) - the frontend
uses this to decide whether to even show that option.

**Responses**:
- 200: Successful Response

## POST /api/roadmap/image/ai

**Summary**: Roadmap Ai Image Export

**Parameters**:
- x-student-name (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## POST /api/mock/start

**Summary**: Start

**Parameters**:
- x-student-name (header): 
- x-student-pin (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## POST /api/mock/start/stream

**Summary**: Start Stream

**Description**: Live-mode variant of /start: streams the opening question sentence by
sentence (each with its own already-synthesized audio clip, when
voice_mode is on) instead of waiting for the whole question and a single
audio file - see MockInterview.jsx's live-mode audio queue player.

**Parameters**:
- x-student-name (header): 
- x-student-pin (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## POST /api/mock/transcribe

**Summary**: Transcribe

**Parameters**:
- x-student-name (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## POST /api/mock/next

**Summary**: Next Turn

**Parameters**:
- x-student-name (header): 
- x-student-pin (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## POST /api/mock/next/stream

**Summary**: Next Turn Stream

**Description**: Live-mode variant of /next: streams feedback text as soon as it's
generated, then the next question sentence by sentence with each
sentence's audio synthesized as it completes - the biggest single
contributor to feeling "live" rather than turn-based, since the student
starts hearing the next question well before the model has finished
writing all of it.

**Parameters**:
- x-student-name (header): 
- x-student-pin (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## POST /api/mock/finish

**Summary**: Finish

**Parameters**:
- x-student-name (header): 
- x-student-pin (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## GET /api/mock/history

**Summary**: History

**Description**: This student's past mock interview attempts, most recent first - each
entry includes the score and stored report so the frontend can render a
trend view without re-running the interview.

**Parameters**:
- x-student-name (header): 
- x-student-pin (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## POST /api/mock/report/pdf

**Summary**: Report Pdf Export

**Responses**:
- 200: Successful Response
- 422: Validation Error

## GET /api/mock/report/download/{filename}

**Summary**: Download Report Pdf

**Parameters**:
- filename (path) (Required): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## GET /api/mock/audio/{filename}

**Summary**: Get Audio

**Parameters**:
- filename (path) (Required): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## POST /api/live-interview/sessions

**Summary**: Create Session

**Parameters**:
- x-student-name (header): 
- x-student-pin (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## GET /api/live-interview/history

**Summary**: History

**Parameters**:
- x-student-name (header): 
- x-student-pin (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## GET /api/live-interview/sessions/{session_id}

**Summary**: Get Session

**Parameters**:
- session_id (path) (Required): 
- x-student-name (header): 
- x-student-pin (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## POST /api/live-interview/sessions/{session_id}/end

**Summary**: End Session

**Description**: Graceful end triggered from the REST side (e.g. the client's "End
interview" button after its WS already closed, or as a fallback if the
WS connection never came up at all). Idempotent: ending an
already-ended session just re-returns its existing report rather than
re-running evaluation.

**Parameters**:
- session_id (path) (Required): 
- x-student-name (header): 
- x-student-pin (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## GET /api/live-interview/audio/{filename}

**Summary**: Get Audio

**Parameters**:
- filename (path) (Required): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## GET /api/technical/dsa/topics

**Summary**: Dsa Topics

**Responses**:
- 200: Successful Response

## GET /api/technical/dsa/companies

**Summary**: Dsa Companies

**Description**: Distinct companies tagged in the DSA bank (e.g. TCS, Amazon) - powers
the company filter, mirroring how real campus placement prep tools let
students target a specific recruiter's question style.

**Responses**:
- 200: Successful Response

## POST /api/technical/dsa/question

**Summary**: Dsa Question

**Parameters**:
- x-student-name (header): 
- x-student-pin (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## POST /api/technical/dsa/question/{question_id}

**Summary**: Dsa Question By Id

**Description**: Reopen one specific question directly - used by the "Bookmarked
questions" panel to jump back into a question a student starred
earlier, instead of the filtered-random flow /dsa/question uses.

**Parameters**:
- question_id (path) (Required): 
- x-student-name (header): 
- x-student-pin (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## GET /api/technical/bookmarks

**Summary**: List Bookmarks

**Parameters**:
- x-student-name (header): 
- x-student-pin (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## POST /api/technical/bookmarks/{question_id}

**Summary**: Add Bookmark

**Parameters**:
- question_id (path) (Required): 
- x-student-name (header): 
- x-student-pin (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## DELETE /api/technical/bookmarks/{question_id}

**Summary**: Remove Bookmark

**Parameters**:
- question_id (path) (Required): 
- x-student-name (header): 
- x-student-pin (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## POST /api/technical/dsa/run

**Summary**: Dsa Run

**Parameters**:
- x-student-name (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## POST /api/technical/dsa/log

**Summary**: Dsa Log

**Responses**:
- 200: Successful Response
- 422: Validation Error

## POST /api/technical/dsa/review

**Summary**: Dsa Review

**Parameters**:
- x-student-name (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## POST /api/technical/contest/start

**Summary**: Contest Start

**Parameters**:
- x-student-name (header): 
- x-student-pin (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## POST /api/technical/contest/finish

**Summary**: Contest Finish

**Responses**:
- 200: Successful Response
- 422: Validation Error

## GET /api/technical/leaderboard

**Summary**: Leaderboard

**Description**: Department-wide DSA leaderboard - a batch-level motivator, deliberately
not scoped to one student (see storage.leaderboard's docstring).

**Responses**:
- 200: Successful Response

## GET /api/technical/quiz/topics

**Summary**: Quiz Topics

**Responses**:
- 200: Successful Response

## POST /api/technical/quiz/build

**Summary**: Quiz Build

**Parameters**:
- x-student-name (header): 
- x-student-pin (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## POST /api/technical/quiz/grade

**Summary**: Quiz Grade

**Parameters**:
- x-student-name (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## POST /api/technical/quiz/finish

**Summary**: Quiz Finish

**Responses**:
- 200: Successful Response
- 422: Validation Error

## GET /api/technical/stats

**Summary**: Stats

**Description**: Personal solve-rate dashboard: overall + broken down by topic and
difficulty across the DSA, quiz, and contest rounds, plus a recent timeline.

**Parameters**:
- x-student-name (header): 
- x-student-pin (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## POST /api/technical/stats/pdf

**Summary**: Stats Pdf

**Description**: Export this student's own solve-rate breakdown as a PDF - a printable
record to bring to a placement drive, mirroring the resume/roadmap/
interview-report export pattern (this was previously the only module
with saved history and no export option).

**Parameters**:
- x-student-name (header): 
- x-student-pin (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## GET /api/technical/stats/pdf/download/{filename}

**Summary**: Download Stats Pdf

**Parameters**:
- filename (path) (Required): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## GET /api/settings/status

**Summary**: Status

**Description**: Fast: engine reachability checks run concurrently with a short
timeout and are cached for a few seconds (see core/llm.py's
engine_status), so this responds quickly even when Ollama/Groq are
unreachable, instead of stalling app/page loads.

**Responses**:
- 200: Successful Response

## GET /api/settings/voices

**Summary**: Voices

**Responses**:
- 200: Successful Response

## POST /api/settings/test

**Summary**: Test Message

**Responses**:
- 200: Successful Response

## PATCH /api/settings/branding

**Summary**: Update Branding

**Parameters**:
- x-admin-passcode (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## PATCH /api/settings/passcode

**Summary**: Update Passcode

**Parameters**:
- x-admin-passcode (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## PATCH /api/settings/engine

**Summary**: Update Engine

**Parameters**:
- x-admin-passcode (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## PATCH /api/settings/voice

**Summary**: Update Voice

**Parameters**:
- x-admin-passcode (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## GET /api/dashboard/counts

**Summary**: Counts

**Responses**:
- 200: Successful Response

## POST /api/admin/login

**Summary**: Login

**Parameters**:
- x-admin-passcode (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## GET /api/admin/overview

**Summary**: Overview

**Parameters**:
- x-admin-passcode (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## GET /api/admin/export.csv

**Summary**: Export Csv

**Parameters**:
- x-admin-passcode (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## POST /api/admin/export/pdf

**Summary**: Export Pdf

**Parameters**:
- x-admin-passcode (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## GET /api/admin/export/pdf/download/{filename}

**Summary**: Download Export Pdf

**Parameters**:
- filename (path) (Required): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## GET /api/admin/questions/dsa

**Summary**: List Dsa Questions

**Parameters**:
- x-admin-passcode (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## POST /api/admin/questions/dsa

**Summary**: Create Dsa Question

**Parameters**:
- x-admin-passcode (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## PATCH /api/admin/questions/dsa/{question_id}

**Summary**: Update Dsa Question

**Parameters**:
- question_id (path) (Required): 
- x-admin-passcode (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## DELETE /api/admin/questions/dsa/{question_id}

**Summary**: Delete Dsa Question

**Parameters**:
- question_id (path) (Required): 
- x-admin-passcode (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## GET /api/admin/questions/quiz

**Summary**: List Quiz Questions

**Parameters**:
- x-admin-passcode (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## POST /api/admin/questions/quiz

**Summary**: Create Quiz Question

**Parameters**:
- x-admin-passcode (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## PATCH /api/admin/questions/quiz/{question_id}

**Summary**: Update Quiz Question

**Parameters**:
- question_id (path) (Required): 
- x-admin-passcode (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## DELETE /api/admin/questions/quiz/{question_id}

**Summary**: Delete Quiz Question

**Parameters**:
- question_id (path) (Required): 
- x-admin-passcode (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## GET /api/admin/trends/activity

**Summary**: Activity Trend

**Parameters**:
- days (query): 
- x-admin-passcode (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## GET /api/admin/trends/solve-rate

**Summary**: Solve Rate Trend

**Parameters**:
- days (query): 
- x-admin-passcode (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## GET /api/admin/trends/readiness

**Summary**: Readiness Distribution

**Parameters**:
- x-admin-passcode (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## GET /api/profile

**Summary**: Get Profile

**Parameters**:
- x-student-name (header): 
- x-student-pin (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## POST /api/profile

**Summary**: Save Profile

**Parameters**:
- x-student-name (header): 
- x-student-pin (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## GET /api/preferences

**Summary**: Get Preferences

**Parameters**:
- x-student-name (header): 
- x-student-pin (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## PATCH /api/preferences

**Summary**: Update Preferences

**Parameters**:
- x-student-name (header): 
- x-student-pin (header): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

## GET /api/health

**Summary**: Health

**Responses**:
- 200: Successful Response

## GET /{full_path}

**Summary**: Spa Fallback

**Parameters**:
- full_path (path) (Required): 

**Responses**:
- 200: Successful Response
- 422: Validation Error

