"""
Optional Docker-based execution backend for core/code_judge.py.

When Docker is installed *and* its daemon is reachable, each test case is
run inside a throwaway `python:3.11-slim` container with the network
disabled, memory/CPU/pid limits, and a read-only root filesystem — real
process/filesystem/network isolation on top of (not instead of) the
existing AST import/call blocklist and compile check in code_judge.py.

Availability is detected once per process and cached (see
`docker_available()`) so we never shell out to `docker` on every single
test-case run — a submission with 10 test cases does 1 detection check,
not 10.

Every failure mode here — Docker not installed, daemon not running,
permission denied, no internet to pull `python:3.11-slim` on first use,
container runtime error — is caught and treated as "Docker isn't usable
right now," which the caller (code_judge.run_against_tests) turns into a
transparent fallback to the plain subprocess path. This module must NEVER
raise out to the caller and NEVER block app startup: a bare department PC
with no Docker installed has to keep working completely unchanged.
"""
from __future__ import annotations

import shutil
import subprocess
import sys

_DOCKER_IMAGE = "python:3.11-slim"

# Cached once per process. None = not yet checked, True/False = checked.
_docker_available_cache: bool | None = None


def docker_available() -> bool:
    """Detect (once per process, then cached) whether `docker` is on PATH
    and its daemon actually responds. Never raises."""
    global _docker_available_cache
    if _docker_available_cache is not None:
        return _docker_available_cache

    available = False
    try:
        if shutil.which("docker") is not None:
            proc = subprocess.run(
                ["docker", "info"],
                capture_output=True,
                text=True,
                timeout=3,
            )
            available = proc.returncode == 0
    except Exception:  # noqa: BLE001 - any failure here just means "not usable"
        available = False

    _docker_available_cache = available
    return available


def reset_cache_for_tests() -> None:
    """Test-only hook to force re-detection instead of trusting the
    process-wide cache."""
    global _docker_available_cache
    _docker_available_cache = None


class DockerUnavailableError(Exception):
    """Raised internally when a specific `docker run` invocation fails in a
    way that means this run couldn't use Docker (image pull failure, daemon
    hiccup mid-run, etc). Callers should catch this and fall back to the
    subprocess judge for that test case — it is NOT the same as a student's
    code failing/timing out inside a container that started fine."""


def run_in_container(full_source: str, stdin_data: str, timeout_secs: float) -> subprocess.CompletedProcess:
    """Run `full_source` inside a locked-down, ephemeral python:3.11-slim
    container, piping `stdin_data` in via stdin — mirrors the shape of the
    plain `subprocess.run([sys.executable, "-c", full_source], ...)` call
    in code_judge.py so the caller can treat the result the same way.

    Raises DockerUnavailableError if the *container itself* couldn't be
    started/run (e.g. first-time image pull failed for lack of internet) —
    this is distinct from the student's code timing out or crashing inside
    a container that started fine, which comes back as a normal
    CompletedProcess/TimeoutExpired like the subprocess path.
    """
    cmd = [
        "docker", "run", "--rm", "-i",
        "--network=none",
        "--memory=256m",
        "--cpus=0.5",
        "--pids-limit=64",
        "--read-only",
        "--tmpfs", "/tmp",
        "-e", "PYTHONDONTWRITEBYTECODE=1",
        _DOCKER_IMAGE,
        "python3", "-c", full_source,
    ]
    try:
        proc = subprocess.run(
            cmd,
            input=stdin_data,
            capture_output=True,
            text=True,
            timeout=timeout_secs,
        )
    except subprocess.TimeoutExpired:
        # A genuine timeout of the student's code (or, rarely, a hung
        # container) — let the caller handle this exactly like the
        # subprocess path's TimeoutExpired.
        raise
    except FileNotFoundError as exc:
        # docker binary vanished between detection and use — treat as
        # "Docker isn't usable right now."
        raise DockerUnavailableError(str(exc)) from exc
    except OSError as exc:
        # Covers Windows named-pipe/daemon errors, permission errors, etc.
        raise DockerUnavailableError(str(exc)) from exc

    # Exit code 125 is Docker's own convention for "the container never
    # actually ran" (e.g. couldn't pull the image — no internet on first
    # use, registry unreachable, daemon hiccup) — as opposed to any other
    # exit code, which came from the student's python3 process actually
    # running inside the container (a real pass/fail/crash for that test
    # case, not a Docker-availability problem). Only 125 should trigger a
    # fallback to the subprocess judge.
    if proc.returncode == 125:
        raise DockerUnavailableError(
            f"docker run could not start the container (exit 125): {proc.stderr.strip()[:500]}"
        )
    return proc
