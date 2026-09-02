import { useEffect, useRef, useState } from "react";
import { Code2, Shuffle, Play, Sparkles, RotateCcw, CheckCircle2, XCircle, BarChart3, Trophy, Timer, Flag, Star, Download, Lock } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import Spinner from "../components/Spinner.jsx";
import CodeEditor from "../components/CodeEditor.jsx";
import useLockdown from "../components/useLockdown.js";
import LockdownBanner from "../components/LockdownBanner.jsx";
import useNotifications from "../components/useNotifications.js";
import NotificationStack from "../components/NotificationStack.jsx";
import { apiGet, apiPost, apiDelete, ApiError } from "../api/client.js";

export default function TechnicalInterview() {
  const [tab, setTab] = useState("dsa");
  return (
    <div>
      <PageHeader
        icon={Code2}
        title="Technical Interview Practice"
        subtitle="Solve real DSA problems with instant grading, or get quizzed on CS fundamentals."
      />
      <div className="mb-5 inline-flex flex-wrap rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
        {[
          { id: "dsa", label: "🧮 DSA Coding Round" },
          { id: "contest", label: "🏁 Contest" },
          { id: "quiz", label: "🧠 Concept Q&A Round" },
          { id: "stats", label: "📈 My Stats" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              tab === t.id ? "bg-white dark:bg-slate-800 text-brand-700 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "dsa" ? <DsaTab /> : tab === "contest" ? <ContestTab /> : tab === "quiz" ? <QuizTab /> : <StatsTab />}
    </div>
  );
}

function RateBar({ label, total, correct, solveRate }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-300">{label}</span>
        <span className="text-slate-400 dark:text-slate-500">{correct}/{total} · {solveRate}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className={`h-full rounded-full ${solveRate >= 70 ? "bg-emerald-500" : solveRate >= 40 ? "bg-amber-500" : "bg-red-500"}`}
          style={{ width: `${Math.min(100, Math.max(0, solveRate))}%` }}
        />
      </div>
    </div>
  );
}

function Leaderboard() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    apiGet("/technical/leaderboard").then(setRows).catch(() => setRows([]));
  }, []);
  if (!rows || rows.length === 0) return null;
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Trophy size={16} className="text-gold-600" />
        <h3 className="font-semibold text-slate-900 dark:text-slate-100">Department DSA leaderboard</h3>
      </div>
      <ol className="space-y-1.5">
        {rows.map((r, i) => (
          <li key={r.name} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm even:bg-slate-50 dark:even:bg-slate-900">
            <span className="w-5 shrink-0 text-right font-semibold text-slate-400 dark:text-slate-500">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate font-medium text-slate-800 dark:text-slate-200">{r.name}</span>
            <span className="text-slate-500 dark:text-slate-400">{r.solved} solved</span>
            <span className="text-xs text-slate-400 dark:text-slate-500">{r.accuracy}% accuracy</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function StatsTab() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [pdfFallbackUrl, setPdfFallbackUrl] = useState("");

  useEffect(() => {
    apiGet("/technical/stats")
      .then(setStats)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load your stats."));
  }, []);

  const downloadPdf = async () => {
    setPdfLoading(true);
    setPdfError("");
    setPdfFallbackUrl("");
    try {
      const { download_pdf } = await apiPost("/technical/stats/pdf", {});
      // window.open returns null (no throw) when a popup blocker intercepts
      // it — fall back to a visible link the student can click themselves.
      const win = window.open(download_pdf, "_blank");
      if (!win) {
        setPdfFallbackUrl(download_pdf);
      }
    } catch (err) {
      setPdfError(err instanceof ApiError ? err.message : "Couldn't generate the PDF.");
    } finally {
      setPdfLoading(false);
    }
  };

  if (error) return <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-400">{error}</div>;
  if (!stats) return <div className="card p-8 text-center"><Spinner label="Loading your stats..." /></div>;

  if (stats.overall.total === 0) {
    return (
      <div className="space-y-5">
        <div className="card p-8 text-center text-sm text-slate-400 dark:text-slate-500">
          No graded attempts yet — solve a DSA question or answer a quiz question, and your solve-rate breakdown will show up here.
        </div>
        <Leaderboard />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
              <BarChart3 size={22} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.overall.solve_rate}%</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Overall solve rate — {stats.overall.correct}/{stats.overall.total} graded attempts</p>
            </div>
          </div>
          <button className="btn-secondary shrink-0" onClick={downloadPdf} disabled={pdfLoading}>
            {pdfLoading ? <Spinner label="Preparing PDF..." /> : <><Download size={16} /> Export PDF</>}
          </button>
        </div>
        {stats.by_round_type.length > 0 && (
          <div className="mt-4 flex gap-4 text-sm text-slate-500 dark:text-slate-400">
            {stats.by_round_type.map((r) => (
              <span key={r.name}>{r.name === "dsa" ? "🧮 DSA" : r.name === "quiz" ? "🧠 Quiz" : r.name}: {r.solve_rate}% ({r.correct}/{r.total})</span>
            ))}
          </div>
        )}
        {pdfError && <div role="alert" className="mt-3 rounded-xl bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-400">{pdfError}</div>}
        {pdfFallbackUrl && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-800 dark:text-amber-300">
            Your browser blocked the popup.{" "}
            <a href={pdfFallbackUrl} target="_blank" rel="noreferrer" className="font-semibold underline">
              Click here to open the PDF
            </a>
          </div>
        )}
      </div>

      <div className="card space-y-4 p-5">
        <h3 className="font-semibold text-slate-900 dark:text-slate-100">By topic — spot your weak areas</h3>
        {stats.by_topic.map((t) => (
          <RateBar key={t.name} label={t.name} total={t.total} correct={t.correct} solveRate={t.solve_rate} />
        ))}
      </div>

      <div className="card space-y-4 p-5">
        <h3 className="font-semibold text-slate-900 dark:text-slate-100">By difficulty</h3>
        {stats.by_difficulty.map((d) => (
          <RateBar key={d.name} label={d.name} total={d.total} correct={d.correct} solveRate={d.solve_rate} />
        ))}
      </div>

      <Leaderboard />
    </div>
  );
}

function DsaTab() {
  const [topics, setTopics] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [topic, setTopic] = useState("Any");
  const [difficulty, setDifficulty] = useState("Any");
  const [company, setCompany] = useState("Any");
  const [solvedIds, setSolvedIds] = useState([]);
  const [question, setQuestion] = useState(null);
  const [code, setCode] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [reviewing, setReviewing] = useState(false);
  const [review, setReview] = useState("");
  const [error, setError] = useState("");
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);
  const [matchNote, setMatchNote] = useState("");

  useEffect(() => {
    apiGet("/technical/dsa/topics").then(setTopics).catch(() => {});
    apiGet("/technical/dsa/companies").then(setCompanies).catch(() => {});
    apiGet("/technical/bookmarks").then(setBookmarks).catch(() => {});
  }, []);

  const isBookmarked = !!question && bookmarks.some((b) => b.id === question.id);

  const toggleBookmark = async () => {
    if (!question) return;
    try {
      if (isBookmarked) {
        await apiDelete(`/technical/bookmarks/${question.id}`);
        setBookmarks((prev) => prev.filter((b) => b.id !== question.id));
      } else {
        await apiPost(`/technical/bookmarks/${question.id}`, {});
        setBookmarks((prev) => [question, ...prev]);
      }
    } catch {
      // Best-effort — bookmarking isn't the critical path, so fail quietly
      // rather than interrupting the student with an error banner.
    }
  };

  const newQuestion = async () => {
    setError("");
    setResult(null);
    setReview("");
    setMatchNote("");
    setLoadingQuestion(true);
    try {
      const q = await apiPost("/technical/dsa/question", { topic, difficulty, company, exclude_ids: solvedIds });
      setQuestion(q);
      setCode(q.starter_code);
      setMatchNote(q.match_note || "");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No questions match those filters.");
      setQuestion(null);
    } finally {
      setLoadingQuestion(false);
    }
  };

  const reopenBookmark = async (id) => {
    setError("");
    setResult(null);
    setReview("");
    setMatchNote("");
    setLoadingQuestion(true);
    try {
      const q = await apiPost(`/technical/dsa/question/${id}`, {});
      setQuestion(q);
      setCode(q.starter_code);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reopen that question — it may no longer be available.");
    } finally {
      setLoadingQuestion(false);
    }
  };

  const run = async () => {
    setRunning(true);
    setError("");
    try {
      const res = await apiPost("/technical/dsa/run", { code, test_cases: question.test_cases });
      setResult(res);
      const logBody = {
        session_id: question.session_id, title: question.title, code,
        topic: question.topic || "", difficulty: question.difficulty || "",
      };
      if (res.all_passed && !solvedIds.includes(question.id)) {
        setSolvedIds((prev) => [...prev, question.id]);
        await apiPost("/technical/dsa/log", { ...logBody, passed: true });
      } else if (!res.all_passed && res.compiled) {
        await apiPost("/technical/dsa/log", { ...logBody, passed: false });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't run your code.");
    } finally {
      setRunning(false);
    }
  };

  const getReview = async () => {
    setReviewing(true);
    try {
      const { feedback } = await apiPost("/technical/dsa/review", {
        title: question.title, description: question.description, code, all_passed: !!result?.all_passed,
      });
      setReview(feedback);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't get AI review.");
    } finally {
      setReviewing(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label" htmlFor="dsa-topic">Topic</label>
          <select id="dsa-topic" className="input" value={topic} onChange={(e) => setTopic(e.target.value)}>
            <option>Any</option>
            {topics.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="dsa-difficulty">Difficulty</label>
          <select id="dsa-difficulty" className="input" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            {["Any", "Easy", "Medium", "Hard"].map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="dsa-company">Asked at</label>
          <select id="dsa-company" className="input" value={company} onChange={(e) => setCompany(e.target.value)}>
            <option>Any</option>
            {companies.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <button className="btn-primary" onClick={newQuestion} disabled={loadingQuestion}>
          {loadingQuestion ? <Spinner label="Loading..." /> : <><Shuffle size={16} /> New question</>}
        </button>
        <span className="ml-auto text-sm text-slate-500 dark:text-slate-400">✅ Solved this session: {solvedIds.length}</span>
      </div>

      {bookmarks.length > 0 && (
        <div className="card p-4">
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">
            <Star size={14} className="text-amber-500" fill="currentColor" /> Bookmarked questions
          </h4>
          <div className="flex flex-wrap gap-2">
            {bookmarks.map((b) => (
              <button
                key={b.id}
                className="badge bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                onClick={() => reopenBookmark(b.id)}
                disabled={loadingQuestion}
              >
                {b.title} <span className="ml-1 text-slate-400 dark:text-slate-500">· {b.difficulty}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-400 whitespace-pre-wrap">{error}</div>}
      {matchNote && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-800 dark:text-amber-300">
          ℹ️ {matchNote}
        </div>
      )}

      {!question ? (
        <div className="card p-8 text-center text-sm text-slate-400 dark:text-slate-500">Click "New question" to get started.</div>
      ) : (
        <div className="card space-y-4 p-5">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
              {question.title} <span className="text-sm font-normal text-slate-400 dark:text-slate-500">· {question.topic} · {question.difficulty}</span>
              <button
                className={`ml-1 ${isBookmarked ? "text-amber-500 hover:text-amber-600 dark:hover:text-amber-400" : "text-slate-300 hover:text-amber-500"}`}
                onClick={toggleBookmark}
                aria-label={isBookmarked ? "Remove bookmark" : "Bookmark this question"}
                title={isBookmarked ? "Remove bookmark" : "Bookmark this question"}
              >
                <Star size={18} fill={isBookmarked ? "currentColor" : "none"} />
              </button>
            </h3>
            {question.companies?.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {question.companies.map((c) => (
                  <span key={c} className="badge bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">Asked at {c}</span>
                ))}
              </div>
            )}
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{question.description}</p>
          </div>

          <details className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-sm">
            <summary className="cursor-pointer font-medium text-slate-700 dark:text-slate-300">📥 Input / Output format</summary>
            <p className="mt-2 whitespace-pre-wrap text-slate-600 dark:text-slate-400"><strong>Input:</strong> {question.input_format}</p>
            <p className="mt-1 whitespace-pre-wrap text-slate-600 dark:text-slate-400"><strong>Output:</strong> {question.output_format}</p>
          </details>

          {question.hints?.length > 0 && (
            <details className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-sm">
              <summary className="cursor-pointer font-medium text-slate-700 dark:text-slate-300">💡 Hints</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-600 dark:text-slate-400">
                {question.hints.map((h, i) => <li key={i}>{h}</li>)}
              </ul>
            </details>
          )}

          <div>
            <label className="label">Your solution (read from stdin with input(), print your answer)</label>
            <CodeEditor value={code} onChange={setCode} ariaLabel="Your solution (read from stdin with input(), print your answer)" />
          </div>

          <div className="flex gap-3">
            <button className="btn-primary" onClick={run} disabled={running}>
              {running ? <Spinner label="Running..." /> : <><Play size={16} /> Run against test cases</>}
            </button>
            {result && (
              <button className="btn-secondary" onClick={getReview} disabled={reviewing}>
                {reviewing ? <Spinner label="Reviewing..." /> : <><Sparkles size={16} /> Get AI code review</>}
              </button>
            )}
          </div>

          {result && (
            <div className="space-y-3">
              {!result.compiled ? (
                <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-400">Syntax error: {result.compile_error}</div>
              ) : result.all_passed ? (
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-3 text-sm font-medium text-emerald-700 dark:text-emerald-400">✅ All {result.total_count} test cases passed!</div>
              ) : (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-3 text-sm font-medium text-amber-700 dark:text-amber-400">⚠️ {result.passed_count}/{result.total_count} test cases passed.</div>
              )}
              {result.results?.map((tc, i) => (
                <details key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-sm">
                  <summary className="cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                    Test case {i + 1}: {tc.passed ? "✅ Passed" : "❌ Failed"}
                  </summary>
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
{`Input:\n${tc.input}\nExpected:\n${tc.expected}\nGot:\n${tc.actual}`}
                  </pre>
                  {tc.error && <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">⚠️ {tc.error}</p>}
                </details>
              ))}
            </div>
          )}

          {review && <div className="rounded-xl bg-brand-50 p-4 text-sm text-brand-900">{review}</div>}
        </div>
      )}
    </div>
  );
}

function formatClock(secs) {
  const s = Math.max(0, Math.round(secs));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function ContestTab() {
  const [companies, setCompanies] = useState([]);
  const [company, setCompany] = useState("Any");
  const [numQuestions, setNumQuestions] = useState(3);
  const [durationMins, setDurationMins] = useState(20);
  const [stage, setStage] = useState("setup"); // setup | running | done
  const [error, setError] = useState("");
  const [lockdownEnabled, setLockdownEnabled] = useState(true);
  const [endedEarly, setEndedEarly] = useState(false);

  const [sessionId, setSessionId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [code, setCode] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [results, setResults] = useState([]);
  const [durationSecs, setDurationSecs] = useState(0);
  const [secsLeft, setSecsLeft] = useState(0);
  const [finishData, setFinishData] = useState(null);
  const startedAtRef = useRef(null);
  const finishingRef = useRef(false);
  const resultsRef = useRef(results);
  resultsRef.current = results;
  const notifications = useNotifications();

  const lockdown = useLockdown({
    active: lockdownEnabled && stage === "running",
    maxStrikes: 2,
    onViolation: (v) => {
      notifications.push({
        tone: v.severe ? "danger" : "warning",
        title: v.severe ? "Serious violation detected" : "Violation detected",
        message: v.label,
      });
    },
    onLimitExceeded: (violations) => {
      setEndedEarly(true);
      notifications.push({
        tone: "danger",
        title: "Assessment ended",
        message: "Too many proctoring violations were detected — your contest was submitted automatically.",
        durationMs: 8000,
      });
      finish(resultsRef.current, violations);
    },
  });

  useEffect(() => {
    apiGet("/technical/dsa/companies").then(setCompanies).catch(() => {});
  }, []);

  useEffect(() => {
    if (stage !== "running") return;
    // Derive the countdown from actual elapsed wall-clock time each tick,
    // rather than decrementing a counter — a plain decrementing interval
    // drifts against the real elapsed time browsers use for scoring
    // (elapsed_secs, computed the same way in finish() below) whenever the
    // tab is backgrounded/throttled, so the on-screen clock and the actual
    // score used to be able to disagree.
    const tick = () => {
      const elapsed = (Date.now() - (startedAtRef.current || Date.now())) / 1000;
      setSecsLeft(Math.max(0, durationSecs - elapsed));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [stage, durationSecs]);

  useEffect(() => {
    if (stage === "running" && secsLeft === 0) finish(results);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secsLeft, stage]);

  const start = async () => {
    setError("");
    try {
      const data = await apiPost("/technical/contest/start", { company, num_questions: numQuestions, duration_mins: durationMins });
      setSessionId(data.session_id);
      setQuestions(data.questions);
      setDurationSecs(data.duration_secs);
      setSecsLeft(data.duration_secs);
      setIdx(0);
      setCode(data.questions[0]?.starter_code || "");
      setResult(null);
      setResults([]);
      setEndedEarly(false);
      startedAtRef.current = Date.now();
      finishingRef.current = false;
      setStage("running");
      if (lockdownEnabled) await lockdown.enterFullscreen();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't start the contest.");
    }
  };

  const submit = async () => {
    const q = questions[idx];
    setRunning(true);
    setError("");
    try {
      const res = await apiPost("/technical/dsa/run", { code, test_cases: q.test_cases });
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't run your code.");
    } finally {
      setRunning(false);
    }
  };

  const recordAndAdvance = () => {
    const q = questions[idx];
    const entry = { question_id: q.id, title: q.title, topic: q.topic || "", difficulty: q.difficulty || "", passed: !!result?.all_passed, code };
    const nextResults = [...results, entry];
    setResults(nextResults);
    setResult(null);
    if (idx + 1 >= questions.length) {
      finish(nextResults);
    } else {
      setIdx((i) => i + 1);
      setCode(questions[idx + 1]?.starter_code || "");
    }
  };

  const finish = async (finalResults, violations = []) => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    lockdown.exitFullscreen();
    const elapsed = (Date.now() - (startedAtRef.current || Date.now())) / 1000;
    try {
      const data = await apiPost("/technical/contest/finish", {
        session_id: sessionId, results: finalResults, elapsed_secs: elapsed, duration_secs: durationSecs, violations,
      });
      setFinishData(data);
    } catch {
      setFinishData({ score: 0, solved: finalResults.filter((r) => r.passed).length, total: finalResults.length || questions.length });
    }
    setStage("done");
  };

  if (stage === "setup") {
    return (
      <div className="card space-y-4 p-5">
        <NotificationStack notifications={notifications.notifications} onDismiss={notifications.dismiss} />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          A small, time-boxed set of DSA questions — like an online assessment round. Score is based on how many you
          solve, with a small bonus for finishing early.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="contest-company">Company style</label>
            <select id="contest-company" className="input" value={company} onChange={(e) => setCompany(e.target.value)}>
              <option>Any</option>
              {companies.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="contest-num-questions">Questions: {numQuestions}</label>
            <input id="contest-num-questions" type="range" min={1} max={8} value={numQuestions} onChange={(e) => setNumQuestions(Number(e.target.value))} className="w-full accent-brand-600" />
          </div>
          <div>
            <label className="label" htmlFor="contest-duration">Time limit: {durationMins} min</label>
            <input id="contest-duration" type="range" min={5} max={60} step={5} value={durationMins} onChange={(e) => setDurationMins(Number(e.target.value))} className="w-full accent-brand-600" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={lockdownEnabled}
            onChange={(e) => setLockdownEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-brand-600"
          />
          <Lock size={15} className="text-brand-600" /> Enable proctoring — blocks copy/paste, right-click &amp;
          dev-tools shortcuts; flags tab switches &amp; leaving fullscreen (browsers don't let a page fully prevent
          those two). Auto-submits after 2 violations.
        </label>
        {error && <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-400 whitespace-pre-wrap">{error}</div>}
        <button className="btn-primary" onClick={start}><Flag size={16} /> Start contest</button>
      </div>
    );
  }

  if (stage === "running") {
    const q = questions[idx];
    const low = secsLeft <= 60;
    return (
      <div className="space-y-4">
        {lockdownEnabled && (
          <>
            <NotificationStack notifications={notifications.notifications} onDismiss={notifications.dismiss} />
            <LockdownBanner strikes={lockdown.strikes} maxStrikes={lockdown.maxStrikes} />
          </>
        )}
        <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <span className="text-sm text-slate-500 dark:text-slate-400">Question {idx + 1} of {questions.length}</span>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${low ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"}`}>
            <Timer size={14} /> {formatClock(secsLeft)}
          </span>
        </div>

        <div className="card space-y-4 p-5">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {q.title} <span className="text-sm font-normal text-slate-400 dark:text-slate-500">· {q.topic} · {q.difficulty}</span>
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{q.description}</p>
          </div>

          <CodeEditor value={code} onChange={setCode} />

          <div className="flex flex-wrap gap-3">
            <button className="btn-primary" onClick={submit} disabled={running}>
              {running ? <Spinner label="Running..." /> : <><Play size={16} /> Run against test cases</>}
            </button>
            <button className="btn-secondary" onClick={recordAndAdvance}>
              {idx + 1 >= questions.length ? "Finish contest" : "Next question"}
            </button>
          </div>

          {error && <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-400 whitespace-pre-wrap">{error}</div>}

          {result && (
            !result.compiled ? (
              <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-400">Syntax error: {result.compile_error}</div>
            ) : result.all_passed ? (
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-3 text-sm font-medium text-emerald-700 dark:text-emerald-400">✅ All {result.total_count} test cases passed!</div>
            ) : (
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-3 text-sm font-medium text-amber-700 dark:text-amber-400">⚠️ {result.passed_count}/{result.total_count} test cases passed.</div>
            )
          )}
        </div>
      </div>
    );
  }

  // done
  return (
    <div className="animate-slide-up space-y-5">
      <NotificationStack notifications={notifications.notifications} onDismiss={notifications.dismiss} />
      <div className="card p-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-50 text-gold-600">
          <Trophy size={26} />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Contest complete!</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Solved {finishData?.solved ?? 0} of {finishData?.total ?? questions.length}
        </p>
        <p className="mt-2 text-3xl font-bold text-brand-700">{finishData?.score ?? 0}</p>
        <p className="text-xs text-slate-400 dark:text-slate-500">score (out of 100)</p>
        {endedEarly && (
          <p className="mt-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-800 dark:text-amber-300">
            🔒 Ended early — too many proctoring violations were detected.
          </p>
        )}
      </div>
      <button className="btn-primary" onClick={() => setStage("setup")}>
        <RotateCcw size={16} /> Start another contest
      </button>
    </div>
  );
}

function QuizTab() {
  const [topics, setTopics] = useState([]);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [numQuestions, setNumQuestions] = useState(6);
  const [includeAi, setIncludeAi] = useState(true);
  const [stage, setStage] = useState("setup");
  const [questions, setQuestions] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [log, setLog] = useState([]);
  const [choice, setChoice] = useState(null);
  const [textAnswer, setTextAnswer] = useState("");
  const [grading, setGrading] = useState(false);
  const [verdict, setVerdict] = useState(null); // { correct, note }
  const [error, setError] = useState("");
  const [lockdownEnabled, setLockdownEnabled] = useState(true);
  const [endedEarly, setEndedEarly] = useState(false);
  const scoreRef = useRef(score);
  scoreRef.current = score;
  const idxRef = useRef(idx);
  idxRef.current = idx;
  const notifications = useNotifications();

  const finishQuiz = async (violations = []) => {
    lockdown.exitFullscreen();
    const pct = Math.round((100 * scoreRef.current) / questions.length);
    try {
      await apiPost("/technical/quiz/finish", { session_id: sessionId, score_pct: pct, log, violations });
    } catch {
      /* non-fatal */
    }
    setStage("done");
  };

  const lockdown = useLockdown({
    active: lockdownEnabled && stage === "running",
    maxStrikes: 2,
    onViolation: (v) => {
      notifications.push({
        tone: v.severe ? "danger" : "warning",
        title: v.severe ? "Serious violation detected" : "Violation detected",
        message: v.label,
      });
    },
    onLimitExceeded: (violations) => {
      setEndedEarly(true);
      notifications.push({
        tone: "danger",
        title: "Assessment ended",
        message: "Too many proctoring violations were detected — your quiz was submitted automatically.",
        durationMs: 8000,
      });
      finishQuiz(violations);
    },
  });

  useEffect(() => {
    apiGet("/technical/quiz/topics").then((t) => {
      setTopics(t);
      setSelectedTopics(t);
    }).catch(() => {});
  }, []);

  const toggleTopic = (t) => {
    setSelectedTopics((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const startQuiz = async () => {
    setError("");
    try {
      const data = await apiPost("/technical/quiz/build", { topics: selectedTopics, num_questions: numQuestions, include_ai: includeAi });
      setQuestions(data.questions);
      setSessionId(data.session_id);
      setIdx(0);
      setScore(0);
      setLog([]);
      setChoice(null);
      setTextAnswer("");
      setVerdict(null);
      setEndedEarly(false);
      setStage("running");
      if (lockdownEnabled) await lockdown.enterFullscreen();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't build the quiz.");
    }
  };

  const submitAnswer = async () => {
    const q = questions[idx];
    setGrading(true);
    setError("");
    try {
      if (q.type === "mcq") {
        const correct = choice === q.answer;
        await apiPost("/technical/quiz/grade", {
          session_id: sessionId, question: q.question, user_answer: choice,
          is_mcq: true, mcq_correct: correct, explanation: q.explanation || "",
          topic: q.topic || "", difficulty: q.difficulty || "",
        });
        setVerdict({ correct, note: q.explanation || "" });
        if (correct) setScore((s) => s + 1);
        setLog((l) => [...l, { question: q.question, answer: choice, correct }]);
      } else {
        const { correct, feedback } = await apiPost("/technical/quiz/grade", {
          session_id: sessionId, question: q.question, reference_answer: q.answer || "", user_answer: textAnswer, is_mcq: false,
          topic: q.topic || "", difficulty: q.difficulty || "",
        });
        setVerdict({ correct, note: feedback });
        if (correct) setScore((s) => s + 1);
        setLog((l) => [...l, { question: q.question, answer: textAnswer, correct }]);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't grade that answer.");
    } finally {
      setGrading(false);
    }
  };

  const next = async () => {
    setChoice(null);
    setTextAnswer("");
    setVerdict(null);
    if (idx + 1 >= questions.length) {
      await finishQuiz();
    } else {
      setIdx((i) => i + 1);
    }
  };

  if (stage === "setup") {
    return (
      <div className="card space-y-4 p-5">
        <NotificationStack notifications={notifications.notifications} onDismiss={notifications.dismiss} />
        <div>
          <label className="label">Topics</label>
          <div className="flex flex-wrap gap-2">
            {topics.map((t) => (
              <button
                key={t}
                onClick={() => toggleTopic(t)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  selectedTopics.includes(t) ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="quiz-num-questions">Number of questions: {numQuestions}</label>
          <input id="quiz-num-questions" type="range" min={3} max={15} value={numQuestions} onChange={(e) => setNumQuestions(Number(e.target.value))} className="w-full accent-brand-600" />
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={includeAi} onChange={(e) => setIncludeAi(e.target.checked)} className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-brand-600" />
          <Sparkles size={15} className="text-brand-600" /> Include AI-generated bonus questions if the curated bank runs short
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={lockdownEnabled}
            onChange={(e) => setLockdownEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-brand-600"
          />
          <Lock size={15} className="text-brand-600" /> Enable proctoring — blocks copy/paste, right-click &amp;
          dev-tools shortcuts; flags tab switches &amp; leaving fullscreen (browsers don't let a page fully prevent
          those two). Auto-submits after 2 violations.
        </label>
        {error && <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-400 whitespace-pre-wrap">{error}</div>}
        <button className="btn-primary" onClick={startQuiz} disabled={selectedTopics.length === 0}>🚀 Start quiz</button>
      </div>
    );
  }

  if (stage === "running") {
    const q = questions[idx];
    return (
      <div className="space-y-4">
        {lockdownEnabled && (
          <>
            <NotificationStack notifications={notifications.notifications} onDismiss={notifications.dismiss} />
            <LockdownBanner strikes={lockdown.strikes} maxStrikes={lockdown.maxStrikes} />
          </>
        )}
        <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
          <span>Question {idx + 1} of {questions.length}</span>
          <span>Score: {score}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div className="h-full rounded-full bg-brand-600 transition-all duration-500" style={{ width: `${(idx / questions.length) * 100}%` }} />
        </div>

        <div className="card p-5">
          <p className="mb-4 text-sm font-medium text-slate-800 dark:text-slate-200">
            <span className="mr-2 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">{q.topic} · {q.difficulty}</span>
            {q.question}
          </p>

          {q.type === "mcq" ? (
            <div className="space-y-2">
              {q.options.map((opt) => (
                <label key={opt} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm ${
                  choice === opt ? "border-brand-500 bg-brand-50" : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900"
                }`}>
                  <input type="radio" name="mcq" className="text-brand-600" checked={choice === opt} onChange={() => setChoice(opt)} disabled={!!verdict} />
                  {opt}
                </label>
              ))}
            </div>
          ) : (
            <textarea aria-label="Your answer" className="input" rows={4} value={textAnswer} onChange={(e) => setTextAnswer(e.target.value)} disabled={!!verdict} />
          )}

          {error && <div role="alert" className="mt-3 rounded-xl bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-400">{error}</div>}

          {!verdict ? (
            <button
              className="btn-primary mt-4"
              onClick={submitAnswer}
              disabled={grading || (q.type === "mcq" ? !choice : !textAnswer.trim())}
            >
              {grading ? <Spinner label="Grading..." /> : "Submit"}
            </button>
          ) : (
            <>
              <div role="status" aria-live="polite" className={`mt-4 flex items-start gap-2 rounded-xl p-3 text-sm ${verdict.correct ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300" : "bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300"}`}>
                {verdict.correct ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <XCircle size={16} className="mt-0.5 shrink-0" />}
                <span>
                  {verdict.correct ? "Correct! " : "Not quite. "}{verdict.note}
                  {!verdict.correct && q.type !== "mcq" && <div className="mt-1 text-slate-500 dark:text-slate-400">Model answer: {q.answer}</div>}
                </span>
              </div>
              <button className="btn-primary mt-4" onClick={next}>Next ➡️</button>
            </>
          )}
        </div>
      </div>
    );
  }

  // done
  const pct = Math.round((100 * score) / questions.length);
  const weak = {};
  log.forEach((entry, i) => {
    if (!entry.correct) weak[questions[i].topic] = (weak[questions[i].topic] || 0) + 1;
  });
  return (
    <div className="animate-slide-up space-y-5">
      <NotificationStack notifications={notifications.notifications} onDismiss={notifications.dismiss} />
      <div className="card p-5">
        <h2 className="mb-3 text-lg font-bold text-slate-900 dark:text-slate-100">📊 Quiz complete!</h2>
        {endedEarly && (
          <p className="mb-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-800 dark:text-amber-300">
            🔒 Ended early — too many proctoring violations were detected.
          </p>
        )}
        <p className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-300">Score: {score} / {questions.length} ({pct}%)</p>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700" style={{ width: `${pct}%` }} />
        </div>
        {Object.keys(weak).length > 0 ? (
          <div className="mt-4">
            <p className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">📌 Topics to revisit</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-400">
              {Object.entries(weak).sort((a, b) => b[1] - a[1]).map(([t, n]) => <li key={t}>{t} ({n} missed)</li>)}
            </ul>
          </div>
        ) : (
          <p className="mt-4 text-sm font-medium text-emerald-700 dark:text-emerald-400">No weak topics detected this round — great job!</p>
        )}
      </div>
      <button className="btn-primary" onClick={() => setStage("setup")}>
        <RotateCcw size={16} /> Start a new quiz
      </button>
    </div>
  );
}
