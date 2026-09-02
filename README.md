# 🎓 AI Placement Assistance Platform

An all-in-one, **free and open-source** AI placement preparation suite, built for department use.
A modern React web interface backed by a FastAPI service - runs entirely on your own machine, no
mandatory cloud accounts, no per-use cost, and your students' data never has to leave the campus
network unless you explicitly turn on the optional cloud engine.

## Modules

1. **💬 AI Chatbot** - placement/career guidance, grounded with your department's own FAQ knowledge base.
2. **📄 Resume Builder & Analyzer** - build an ATS-friendly resume (DOCX + PDF export), or upload an
   existing resume for an AI-generated ATS score and section-by-section feedback.
3. **🗺️ Roadmap Generator** - personalized, week-by-week learning roadmap for a target role, blending
   curated department templates with AI personalization.
4. **🎤 Mock Interview (Speech-to-Speech)** - the AI asks interview questions out loud, the student
   answers by voice, it adapts follow-ups in real time, and ends with a detailed performance report.
5. **💻 Technical Interview** - a DSA coding round (Python, real test cases, instant grading, with a
   built-in code editor) and a CS-fundamentals concept quiz (OOP / DBMS / OS / Computer Networks /
   Aptitude / HR), both with AI-graded feedback.

Every module keeps a durable history in a local SQLite database (`storage/app.db`), so nothing is lost
between restarts.

---

## Architecture

- **Frontend:** React + Vite + Tailwind CSS - a single-page app (`frontend/`) with a real chat interface,
  a code editor for the DSA round, browser-native microphone recording for the mock interview, smooth
  animations, and a responsive layout that works on any screen size.
- **Backend:** FastAPI (`backend/`) - a JSON API under `/api/*` that does all the real work: talking to
  the AI engine, running the code judge, generating resumes, transcribing speech, and persisting history.
- **One process to run it.** The frontend is compiled to static files once during setup and served
  directly by the same backend process. In everyday use there is exactly one thing to start
  (`run.bat` / `run.sh`) and one port to open - Node.js is only needed during the one-time setup step
  that builds the interface, not to run the app afterward.

```
Browser  ⇄  FastAPI (backend/main.py, port 8000)  ⇄  Ollama / Groq, faster-whisper, pyttsx3, SQLite
              └── serves the pre-built React app (frontend/dist) at the same time
```

---

## Why this design

- **Works fully offline, for free, forever.** The default AI engine is [Ollama](https://ollama.com),
  running a small open-weight model on your own CPU - no API key, no signup, no per-token cost, no data
  leaving the machine.
- **Optional cloud speed boost.** If you add a free [Groq](https://console.groq.com) API key, the app
  automatically prefers it (much faster responses) and silently falls back to local Ollama if the cloud
  is ever unreachable - you get speed when available and reliability always. This "auto" behavior is
  controlled by `LLM_BACKEND` in `.env`.
- **Speech works offline too.** Speech-to-text uses [faster-whisper](https://github.com/SYSTRAN/faster-whisper)
  running locally; text-to-speech uses the OS's own voices via `pyttsx3`. Both can optionally use faster/
  higher-quality cloud alternatives (Groq Whisper, Microsoft Edge TTS) if you prefer.
- **No vendor lock-in.** Every dependency is free/open-source. The whole app is plain, readable Python
  and React source you and your department can audit and modify.

---

## Requirements

- Windows, macOS, or Linux
- Python 3.10 – 3.12 ([python.org](https://www.python.org/downloads/) - check "Add python.exe to PATH" on Windows)
- Node.js 18+ LTS ([nodejs.org](https://nodejs.org)) - **only needed once**, during setup, to build the
  web interface. Not required to run the app afterward.
- ~5 GB free disk space (for the local AI model + speech model, downloaded once)
- A microphone (for the Mock Interview module - the rest of the app works fine without one)

---

## Quick start (Windows)

1. Double-click **`setup.bat`**. It will:
   - create a Python virtual environment (`.venv`) and install the backend dependencies
   - copy `.env.example` → `.env`
   - run `npm install` and build the web interface (`frontend/dist`)
   - pull the default local AI model with Ollama, if Ollama is installed
2. Double-click **`run.bat`**. Your browser opens automatically to the app.

> Don't have Ollama installed? The setup script will tell you. You can either install it for free
> from [ollama.com](https://ollama.com) (recommended, fully offline), or skip it and add a free Groq
> API key instead (see **Configuration** below) - the app works either way.

## Quick start (macOS / Linux)

```bash
chmod +x setup.sh run.sh
./setup.sh
./run.sh
```

---

## Configuration

All settings live in `.env` (created automatically from `.env.example` on first setup). Key options:

| Setting | What it does |
|---|---|
| `LLM_BACKEND` | `auto` (recommended): prefer Groq if configured, fall back to Ollama. Or force `ollama` / `groq`. |
| `OLLAMA_MODEL` | Local model name, default `llama3.2` (3B, fast, works on any laptop). For better quality on a machine with 16GB+ RAM, try `llama3.1:8b`. |
| `GROQ_API_KEY` | Optional - free key from [console.groq.com/keys](https://console.groq.com/keys). Leave blank to stay fully offline. |
| `STT_BACKEND` / `TTS_BACKEND` | Speech engine choices for the Mock Interview module - see `.env.example` for all options. |
| `SERVER_HOST` / `SERVER_PORT` | Where the app runs, default `127.0.0.1:8000`. |
| `APP_TITLE` / `DEPARTMENT_NAME` | Rebrand the app for your department. |
| `LIVE_INTERVIEW_ENABLED` / `LIVE_INTERVIEW_MAX_DURATION_SECS` / `LIVE_INTERVIEW_IDLE_TIMEOUT_SECS` / `LIVE_INTERVIEW_MAX_CONCURRENT_PER_STUDENT` | Live AI Interview (`/live-interview`) - same LLM/STT/TTS engines as above, no new provider/secret. See `.env.example`. |

**Live AI Interview note:** turn detection and barge-in run entirely client-side via `@ricky0123/vad-web` (a browser ONNX Silero VAD, MIT licensed). Its model + WASM runtime + AudioWorklet script are checked into `frontend/public/vad/` so they're served correctly in both `npm run dev` and the production build with no extra setup - see the comment at the top of `frontend/src/pages/live-interview/vad.js`.

You can also check live engine status and get setup help any time from the **⚙️ Settings** page inside the app.

---

## Project structure

```
AI_Placement_Assisstance_Bot/
├── backend/
│   ├── main.py                # FastAPI app: mounts /api/* routers + serves the built frontend
│   ├── run_server.py          # what run.bat/run.sh actually launches (reads .env, opens the browser)
│   ├── config.py               # central configuration, loaded from .env
│   ├── routers/                # one file per module's API endpoints (thin - no business logic)
│   ├── core/                   # reusable engines: llm.py, stt.py, tts.py, storage.py, ...
│   ├── modules/                # business logic per feature (framework-independent, unit-testable)
│   ├── data/                   # editable JSON content: DSA bank, concept quiz bank, FAQ, roadmap templates
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/               # one file per module's UI
│   │   ├── components/          # shared UI: Sidebar, CodeEditor, Markdown renderer, ...
│   │   └── api/client.js        # fetch wrappers for the backend API
│   ├── dist/                    # production build output (generated by setup, gitignored)
│   └── package.json
├── storage/                    # runtime data: app.db (SQLite) + generated files (gitignored)
├── setup.bat / run.bat          # Windows launchers
├── setup.sh / run.sh             # macOS/Linux launchers
└── .env.example
```

### Customizing content for your department

Everything in `backend/data/` is plain, human-editable JSON - no code changes needed:

- `placement_faq.json` - add your department's real placement process, deadlines, and policies;
  the chatbot automatically retrieves relevant entries and grounds its answers in them.
- `dsa_questions.json` - add/remove coding questions (each has stdin/stdout test cases).
- `topic_questions.json` - add/remove CS-fundamentals quiz questions.
- `roadmap_templates.json` - add curated roadmap templates for roles specific to your recruiters.

---

## Development mode (optional, for editing the UI)

If you want to actively edit the React frontend and see changes live, run backend and frontend as two
processes instead of the built, single-process mode:

```bash
# Terminal 1 - backend on port 8000
.venv\Scripts\activate  (or: source .venv/bin/activate)
cd backend
python run_server.py

# Terminal 2 - frontend dev server on port 5173, with hot reload
cd frontend
npm run dev
```

Open `http://localhost:5173` - Vite proxies `/api/*` calls to the backend automatically (see
`frontend/vite.config.js`). When you're done editing, run `npm run build` again so `run.bat`/`run.sh`
serves your changes in the normal single-process mode.

---

## Known scope & limitations (please read before deploying)

- **Code execution sandboxing:** the DSA judge (`backend/core/code_judge.py`) automatically uses a real
  Docker sandbox when Docker is installed and its daemon is running - each submission executes in an
  ephemeral `python:3.11-slim` container with the network disabled, memory/CPU/pid limits, and a
  read-only filesystem, giving genuine process/filesystem/network isolation. Docker is entirely
  **optional**: it is not a requirement anywhere in setup, and if it isn't installed (or isn't running)
  the judge transparently falls back to the original approach - an isolated subprocess with a timeout,
  which safely contains crashes/infinite loops for trusted students practicing on their own machine but
  is **not** a hardened multi-tenant sandbox. If you plan to expose this app to anonymous users over the
  public internet, make sure Docker (or another real sandbox like gVisor/nsjail) is actually installed
  and running on the host - without it, the subprocess-only fallback still applies and the same caution
  as before holds.
- **Speech accuracy:** transcription quality depends on microphone quality and background noise; students
  can always edit the transcript before submitting an answer.
- **AI-generated content** (feedback, roadmaps, quiz grading) can occasionally be imperfect - the app is
  designed as a practice tool to build confidence and identify gaps, not as an infallible authority.
- **Single-machine, single-session use.** This build is intended for one person running it locally at a
  time. It can be run on multiple department PCs independently, but does not (yet) support multiple
  concurrent users sharing one running instance with separate logins.
- **Microphone access requires a "secure context".** Browsers only allow microphone access on `localhost`
  or HTTPS - this works out of the box since the app runs on `127.0.0.1`, but if you ever put it behind a
  different hostname/IP you'll need HTTPS for the Mock Interview module's recording to work.

---

## Troubleshooting

- **"No AI engine is reachable"** → open the ⚙️ Settings page in the app for a live diagnosis, or check:
  is `ollama serve` running? Did you `ollama pull llama3.2`? Is `GROQ_API_KEY` correct in `.env`?
- **`setup.bat`/`setup.sh` fails on `npm install` or `npm run build`** → make sure Node.js 18+ is
  installed (`node --version`) and that you have a normal internet connection during setup.
- **Page loads but shows "Frontend is not built yet"** → the build step didn't complete; re-run
  `setup.bat`/`setup.sh`, or manually run `cd frontend && npm install && npm run build`.
- **Microphone recorder doesn't work** → check that your browser has granted microphone permission for
  `http://127.0.0.1:8000` (or whatever `SERVER_HOST`/`SERVER_PORT` you configured).
- **Text-to-speech is silent** → on Windows, pyttsx3 needs at least one installed SAPI5 voice (present by
  default on Windows). If it still fails, switch `TTS_BACKEND=edge` in `.env` (needs internet).
- **First response is slow** → the first call to a local model/Whisper after starting the app loads it
  into memory; subsequent responses are much faster.
- **Port 8000 already in use** → change `SERVER_PORT` in `.env` to something else (e.g. `8080`) and
  restart with `run.bat`/`run.sh`.

---

Built for academic placement-preparation use. Free and open-source end to end.
