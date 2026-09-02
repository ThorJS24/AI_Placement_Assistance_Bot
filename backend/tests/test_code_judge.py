"""Tests for core/code_judge.py's sandboxed DSA judge.

Every case here was also independently verified by running the exact same
assertions as a standalone script (no pytest) against the real subprocess-
based judge before this file was written, so these aren't just
aspirational — they're confirmed to pass against the current
code_judge.py.
"""
from __future__ import annotations

import time

import pytest

from core import code_judge


def test_correct_solution_passes():
    code = "n = int(input())\nprint(n * 2)\n"
    result = code_judge.run_against_tests(code, [{"input": "5\n", "expected": "10"}])
    assert result.all_passed
    assert result.passed_count == 1


def test_wrong_answer_fails_without_crashing():
    code = "n = int(input())\nprint(n)\n"  # doesn't double it
    result = code_judge.run_against_tests(code, [{"input": "5\n", "expected": "10"}])
    assert result.compiled
    assert not result.all_passed
    assert result.passed_count == 0


def test_syntax_error_reported_cleanly_not_as_a_crash():
    code = "def broken(:\n    pass"
    result = code_judge.run_against_tests(code, [{"input": "", "expected": ""}])
    assert result.compiled is False
    assert "Line" in result.compile_error


@pytest.mark.parametrize(
    "bad_code",
    [
        "import os\nprint(os.getcwd())",
        "open('/etc/passwd').read()",
        "eval('1+1')",
        "import subprocess\nsubprocess.run(['ls'])",
    ],
)
def test_blocked_imports_and_calls_rejected(bad_code):
    result = code_judge.run_against_tests(bad_code, [{"input": "", "expected": ""}])
    assert result.compiled is False
    assert "isn't allowed" in result.compile_error


def test_sys_and_input_are_deliberately_not_blocked():
    # sys (fast stdin reads) and input/print are the judge's whole reason
    # for existing — explicitly excluded from the blocklist, see
    # code_judge.py's module docstring.
    code = "import sys\nline = sys.stdin.readline().strip()\nprint(line.upper())\n"
    result = code_judge.run_against_tests(code, [{"input": "hello\n", "expected": "HELLO"}])
    assert result.all_passed


def test_multiple_test_cases_all_checked_independently():
    code = "n = int(input())\nprint(n + 1)\n"
    result = code_judge.run_against_tests(
        code, [{"input": "1\n", "expected": "2"}, {"input": "5\n", "expected": "6"}, {"input": "9\n", "expected": "100"}]
    )
    assert result.total_count == 3
    assert result.passed_count == 2
    assert not result.all_passed


def test_infinite_loop_times_out_rather_than_hanging():
    t0 = time.time()
    code = "while True:\n    pass\n"
    result = code_judge.run_against_tests(code, [{"input": "", "expected": ""}])
    elapsed = time.time() - t0
    assert not result.all_passed
    assert "Timed out" in result.results[0].error
    assert elapsed < 15  # generous ceiling — should be ~config.CODE_EXEC_TIMEOUT_SECS
