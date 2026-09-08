# 📚 CHRIST (Deemed to be University) - AI Placement Assistance Platform Wiki

Welcome to the **AI Placement Assistance Platform Wiki**! This documentation serves as the comprehensive architectural guide, deployment manual, and feature roadmap for **CHRIST (Deemed to be University) Department of Computer Science and Engineering (CSE)**.

---

## 📖 Table of Contents

1. [System Architecture & Overview](#1-system-architecture--overview)
2. [Module Guide](#2-module-guide)
   - [AI Chatbot](#1-ai-chatbot)
   - [ATS Resume Builder & Analyzer](#2-ats-resume-builder--analyzer)
   - [Roadmap Generator](#3-career-roadmap-generator)
   - [Zoom Video Call Live AI Interview](#4-real-time-zoom-video-call-ai-interview)
   - [Fused LeetCode + HackerRank IDE Workspace](#5-fused-leetcode--hackerrank-multi-domain-ide)
   - [Settings & System Administration](#6-settings--department-administration)
3. [Installation & Deployment Manual](#3-installation--deployment-manual)
4. [Security & Isolation Policy](#4-security--isolation-policy)
5. [Frequently Asked Questions (FAQ)](#5-frequently-asked-questions)

---

## 1. System Architecture & Overview

The platform uses a single-process deployment model:

```
Browser Interface (React + Vite + Tailwind CSS)
       │
       ▼ (HTTP REST API / WebSockets)
FastAPI Backend (backend/main.py - Port 8000)
       │
  ┌────┴───────────────────────────┬────────────────────────────┐
  ▼                                ▼                            ▼
SQLite Database              Execution Judge            Speech Engine
(storage/app.db)         (Docker / SQLite Engine)  (faster-whisper / Edge TTS)
```

- **Frontend**: Built with React 18, Vite, Tailwind CSS, Lucide icons, and KaTeX math rendering.
- **Backend**: FastAPI with Uvicorn, SQLite storage (`storage/app.db`), Pydantic validation, and AST code safety checks.
- **Offline / Cloud Dual Execution**: Supports local Ollama models (`llama3.2`) for offline operation or optional Groq Cloud API acceleration with automatic fallback.

---

## 2. Module Guide

### 1. AI Chatbot
- Grounded in department FAQ dataset (`backend/data/placement_faq.json`).
- Features a **Read Out Loud (Text-to-Speech)** button for audio playback.

### 2. ATS Resume Builder & Analyzer
- **Proportional Live Canvas**: Renders resume content sized for a single A4 page.
- **Print Stylesheet Isolation**: CSS `@media print` rules ensure 0 top margin shift and 0 blank pages on export.
- **Sub-score Analysis**: Evaluates Formatting, Keyword Density, Impact Verbs, and Section Completeness.

### 3. Career Roadmap Generator
- Personalizes learning paths based on student stream, semester, target role, and preferred companies.
- Combines curated templates (`roadmap_templates.json`) with AI custom generation.

### 4. Real-Time Zoom Video Call AI Interview
- **2-Tile Video Grid**: Host AI Interviewer avatar + Candidate Webcam Feed (`navigator.mediaDevices.getUserMedia`).
- **Control Bar**: Mute mic, toggle camera, raise hand, in-meeting chat drawer, and end call dialog.
- **Hands-Free VAD**: Integrated Silero VAD (`@ricky0123/vad-web`) handles speech detection automatically.

### 5. Fused LeetCode + HackerRank Multi-Domain IDE
- **VS Code IDE Clone**: File extension tabs, active line number gutter highlighting, Dark+ status bar (`Ln X, Col Y`, `UTF-8`).
- **5 Domain Tracks**: 226 questions spanning DSA & Algorithms, SQL & Databases, System Design, Web Dev & APIs, and CS Fundamentals.
- **In-Memory SQLite Engine**: Executes candidate SQL queries against setup tables in real time.

### 6. Settings & Department Administration
- **Student Preferences**: Unlocked access for students to configure Academic Profile, Theme Ramps (CHRIST Navy & Gold, Ocean, Forest, Crimson), IDE defaults, and Speech Rate.
- **Department Administration**: Passcode-protected control panel for Branding, AI Model Tuning (Temperature, Tokens, Persona), and Assessment Lockdown rules.

---

## 3. Installation & Deployment Manual

### Windows Quick Start
1. Double-click `setup.bat` (installs dependencies, builds React frontend to `frontend/dist`).
2. Double-click `run.bat` (launches FastAPI server and opens browser to `http://127.0.0.1:8000`).

### macOS / Linux Quick Start
```bash
chmod +x setup.sh run.sh
./setup.sh
./run.sh
```

---

## 4. Security & Isolation Policy

- Refer to [SECURITY.md](SECURITY.md) for vulnerability reporting guidelines and sandboxing policies.
- Docker sandbox (`python:3.11-slim` with `--net=none`) isolates untrusted DSA code execution.
- Administrative endpoints require `X-Admin-Passcode` validation with rate-limited auth buckets.

---

© 2026 CHRIST (Deemed to be University) - Department of Computer Science and Engineering.
