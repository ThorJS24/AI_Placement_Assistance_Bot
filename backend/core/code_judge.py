"""
A minimal, dependency-free "judge" for the Technical Interview module's
DSA coding round: runs a student's Python solution against the question's
test cases with a hard timeout, and reports pass/fail per test case.

Two execution backends, chosen automatically per process (see
core/docker_judge.py):
  - If Docker is installed AND its daemon is reachable, each test case
    runs inside a real Docker sandbox: an ephemeral python:3.11-slim
    container with the network disabled, memory/CPU/pid limits, and a
    read-only filesystem - genuine process/filesystem/network isolation.
  - Otherwise (no Docker installed, daemon not running, or a container
    couldn't be started for any reason - e.g. no internet to pull the
    image on first use) this transparently falls back to the original
    subprocess-only sandbox below.

Docker detection happens once per process and is cached, so a bare
department PC with no Docker installed keeps working completely
unchanged and pays no per-run cost probing for it. See README's "Known
scope & limitations" section for the full honesty note.

Scope & honesty note for the subprocess fallback (documented for the
department too, see README): this isolates *crashes and infinite loops*
via a subprocess + timeout, plus a memory cap and an import/call
blocklist (below), which together cover the realistic accident/abuse
cases for an academic self-practice tool used by trusted students on
their own machines - a runaway loop, an accidental memory bomb, or a
copy-pasted "let me just check" `os.system` call. Without Docker, it is
still NOT a hardened multi-tenant sandbox (no seccomp/network
jail/filesystem jail) - do not expose this over the public internet to
untrusted users unless Docker (or another real sandbox like gVisor/nsjail)
is actually installed and available on the host.

Every safety layer below (code size limits, the AST import/call
blocklist, the compile check) applies identically regardless of which
execution backend runs - Docker is an *additional* isolation layer, not
a replacement for them.
"""
from __future__ import annotations

import ast
import logging
import subprocess
import sys
import textwrap
from dataclasses import dataclass, field

import config
from core import docker_judge

logger = logging.getLogger(__name__)

try:
    import resource  # POSIX only - absent on Windows, which run.bat targets
except ImportError:  # pragma: no cover - Windows
    resource = None

# A DSA solution never legitimately needs filesystem, process, network, or
# subprocess/threading access - blocking these closes the cheapest,
# highest-value hole in an otherwise timeout-only sandbox (see docstring)
# without touching the 99% of normal solutions that only need stdlib data
# structures/algorithms. Deliberately NOT blocked: `sys` (very common for
# fast stdin reads via `sys.stdin` in competitive-programming style code)
# and `input`/`print` (the whole point of the judge is reading stdin and
# printing an answer). This is a blocklist, not a real sandbox: it stops
# the obvious/careless case (`import os`, `open(...)`), not a determined
# attempt at obfuscated bypass.
_BLOCKED_MODULES = {
    "os", "subprocess", "socket", "shutil", "ctypes", "multiprocessing",
    "threading", "importlib", "pty", "pickle", "marshal", "code", "pdb",
    "signal", "resource", "ftplib", "http", "urllib", "requests", "asyncio",
}
_BLOCKED_CALLS = {"eval", "exec", "compile", "__import__", "open"}


class CodeTooLargeError(ValueError):
    """Raised when a student's submitted code exceeds the configured size
    guardrails (see config.MAX_CODE_BYTES / MAX_CODE_LINES)."""


class UnsafeCodeError(ValueError):
    """Raised when a student's submission imports or calls something outside
    the DSA judge's supported surface (see _BLOCKED_MODULES/_BLOCKED_CALLS)."""


def validate_code_size(code: str) -> None:
    byte_len = len(code.encode("utf-8", errors="ignore"))
    if byte_len > config.MAX_CODE_BYTES:
        raise CodeTooLargeError(
            f"Submitted code is {byte_len:,} bytes, which is over the {config.MAX_CODE_BYTES:,}-byte limit. "
            "Trim it down - this is meant for a single solution, not a whole project."
        )
    line_count = code.count("\n") + 1
    if line_count > config.MAX_CODE_LINES:
        raise CodeTooLargeError(
            f"Submitted code has {line_count:,} lines, which is over the {config.MAX_CODE_LINES:,}-line limit."
        )


def validate_code_safety(code: str) -> None:
    """Reject obvious attempts to reach outside the sandbox (filesystem,
    process, network, interpreter internals) before ever executing the
    code. A syntax error here is NOT this function's job to report - if
    the code doesn't parse, run_against_tests' own compile step reports
    that cleanly; we just skip the safety walk in that case."""
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                root = alias.name.split(".")[0]
                if root in _BLOCKED_MODULES:
                    raise UnsafeCodeError(
                        f"'import {alias.name}' isn't allowed here - this judge runs solutions in a "
                        "restricted sandbox with no filesystem/process/network access. Solve it with "
                        "plain data structures and algorithms."
                    )
        elif isinstance(node, ast.ImportFrom):
            root = (node.module or "").split(".")[0]
            if root in _BLOCKED_MODULES:
                raise UnsafeCodeError(
                    f"'from {node.module} import ...' isn't allowed here - this judge runs solutions in "
                    "a restricted sandbox with no filesystem/process/network access."
                )
        elif isinstance(node, ast.Call):
            fn = node.func
            name = fn.id if isinstance(fn, ast.Name) else (fn.attr if isinstance(fn, ast.Attribute) else None)
            if name in _BLOCKED_CALLS:
                raise UnsafeCodeError(
                    f"'{name}(...)' isn't allowed here - read from stdin and print your answer instead."
                )


def _limit_child_resources() -> None:
    """Best-effort memory cap for the subprocess, applied via `preexec_fn`
    on POSIX only (the `resource` module doesn't exist on Windows, which
    run.bat targets - this silently becomes a no-op there, same as before;
    the timeout is still the primary guard on every platform)."""
    if resource is None:
        return
    try:
        mem_bytes = 256 * 1024 * 1024  # 256MB - generous for any real DSA solution
        resource.setrlimit(resource.RLIMIT_AS, (mem_bytes, mem_bytes))
    except (ValueError, OSError):
        pass  # some platforms/containers don't allow setrlimit - fail open, timeout still applies


@dataclass
class TestCaseResult:
    input: str
    expected: str
    actual: str
    passed: bool
    error: str = ""


@dataclass
class JudgeResult:
    results: list[TestCaseResult] = field(default_factory=list)
    compiled: bool = True
    compile_error: str = ""

    @property
    def passed_count(self) -> int:
        return sum(1 for r in self.results if r.passed)

    @property
    def total_count(self) -> int:
        return len(self.results)

    @property
    def all_passed(self) -> bool:
        return self.compiled and self.total_count > 0 and self.passed_count == self.total_count


def _normalize(s: str) -> str:
    return "\n".join(line.rstrip() for line in s.strip().splitlines())


def run_against_tests(student_code: str, test_cases: list[dict], driver_template: str | None = None) -> JudgeResult:
    """
    test_cases: [{"input": "<stdin text>", "expected": "<expected stdout>"}]
    driver_template: optional code appended after the student's code, e.g. to
        call a specific function with parsed stdin and print the result.
        If omitted, the student's code is expected to read stdin / print itself.
    """
    result = JudgeResult()

    full_source = student_code
    if driver_template:
        full_source = student_code + "\n\n" + driver_template

    # Quick syntax/compile check first so we can give a clean error message.
    try:
        compile(full_source, "<student_solution>", "exec")
    except SyntaxError as exc:
        result.compiled = False
        result.compile_error = f"Line {exc.lineno}: {exc.msg}"
        return result

    # Import/call safety check - separate from the compile step above so a
    # blocked import surfaces as its own clear error rather than looking
    # like a syntax problem. Only the student's own code is checked (not
    # driver_template, which is our own trusted code).
    try:
        validate_code_safety(student_code)
    except UnsafeCodeError as exc:
        result.compiled = False
        result.compile_error = str(exc)
        return result

    # preexec_fn (used for the memory rlimit) isn't supported on Windows at
    # all - subprocess.Popen raises ValueError just for passing it, so it
    # has to be omitted entirely there, not just made a no-op.
    extra_kwargs = {} if sys.platform == "win32" else {"preexec_fn": _limit_child_resources}

    # Detected once per process and cached inside docker_judge - cheap to
    # check on every call to run_against_tests.
    use_docker = docker_judge.docker_available()

    for case in test_cases:
        stdin_data = case.get("input", "")
        expected = case.get("expected", "")
        try:
            if use_docker:
                try:
                    proc = docker_judge.run_in_container(
                        full_source, stdin_data, config.CODE_EXEC_TIMEOUT_SECS + 3
                    )
                except docker_judge.DockerUnavailableError as exc:
                    # Docker exists but couldn't actually run this container
                    # (e.g. no internet to pull the image on first use) -
                    # fall back to the subprocess sandbox for this run
                    # rather than hard-failing the submission.
                    logger.warning("Docker execution unavailable, falling back to subprocess sandbox: %s", exc)
                    proc = subprocess.run(
                        [sys.executable, "-c", full_source],
                        input=stdin_data,
                        capture_output=True,
                        text=True,
                        timeout=config.CODE_EXEC_TIMEOUT_SECS,
                        **extra_kwargs,
                    )
            else:
                proc = subprocess.run(
                    [sys.executable, "-c", full_source],
                    input=stdin_data,
                    capture_output=True,
                    text=True,
                    timeout=config.CODE_EXEC_TIMEOUT_SECS,
                    **extra_kwargs,
                )
            actual = proc.stdout
            err = proc.stderr.strip()
            passed = _normalize(actual) == _normalize(expected) and not err
            result.results.append(TestCaseResult(stdin_data, expected, actual.strip(), passed, err))
        except subprocess.TimeoutExpired:
            result.results.append(
                TestCaseResult(stdin_data, expected, "", False, f"Timed out after {config.CODE_EXEC_TIMEOUT_SECS}s (possible infinite loop).")
            )
        except Exception as exc:  # noqa: BLE001
            result.results.append(TestCaseResult(stdin_data, expected, "", False, str(exc)))

    return result


def starter_stub(function_signature: str) -> str:
    """Produce a friendly starter code block for a question's editor pane."""
    return textwrap.dedent(f"""\
        # Write your solution below.
        # Read input from stdin and print your answer (see the problem statement).

        {function_signature}
            pass
    """)
