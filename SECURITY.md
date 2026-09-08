# 🛡️ Security Policy

## Overview
**CHRIST (Deemed to be University) AI Placement Assistance Bot** is designed with a **privacy-first, local-first architecture**. All student data, resume text, interview recordings, and code submissions remain securely stored on campus hardware in a local SQLite database (`storage/app.db`) and are never transmitted to third parties unless an optional cloud engine is explicitly configured.

---

## 🔒 Security Architecture & Measures

### 1. Code Judge Execution Isolation (Docker & Subprocess)
- **Docker Container Sandbox**: When Docker is installed and running, DSA code submissions execute in an ephemeral `python:3.11-slim` container with:
  - `--net=none` (Network disabled)
  - Memory caps (512 MB) and CPU limits
  - Read-only filesystem (`read_only=True`)
- **Subprocess Fallback**: If Docker is unavailable, execution falls back to an AST-sanitized subprocess with execution timeouts, memory rlimits, and import/call blocklists blocking `os`, `sys`, `subprocess`, `socket`, `shutil`, `importlib`, and disk access.

### 2. Authentication & Session Identity
- **httpOnly Cookie Authentication**: Sessions are managed server-side using cryptographically secure httpOnly cookies.
- **Session Identity Middleware**: Request identities are authenticated at the middleware layer before reaching endpoint logic, preventing parameter tampering.

### 3. TPO Administration Security
- **Hashed Admin Passcode**: Administrative functions (branding, AI tuning, assessment lockdown rules) are protected behind an admin passcode header (`X-Admin-Passcode`).
- **Brute-Force Protection**: Rate limiting enforced per IP bucket for authentication attempts.

---

## 🚨 Reporting a Vulnerability

If you discover a security vulnerability or potential privacy flaw, please report it directly to the repository maintainer:

- **Maintainer**: ThorJS24 (Department of CSE, CHRIST University)
- **Email**: `mail@christuniversity.in` / `tj240@christuniversity.in`
- **GitHub**: Submit a Private Vulnerability Report via [GitHub Security Advisories](https://github.com/ThorJS24/AI_Placement_Assistance_Bot/security/advisories)

Please do **NOT** post security vulnerabilities in public GitHub issues. Vulnerabilities reported privately will be acknowledged within 24 hours and patched promptly.

---

## 📋 Security Checklist for Department Deployment

- [x] Change the default `ADMIN_PASSCODE` in `.env` or via Settings before production deployment.
- [x] Install Docker Engine on department server PCs for containerized code execution.
- [x] Use HTTPS or `localhost` / `127.0.0.1` binding to ensure browser WebRTC/Audio Recording permissions.
