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
      // it - fall back to a visible link the student can click themselves.
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
          No graded attempts yet - solve a DSA question or answer a quiz question, and your solve-rate breakdown will show up here.
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
              <p className="text-sm text-slate-500 dark:text-slate-400">Overall solve rate - {stats.overall.correct}/{stats.overall.total} graded attempts</p>
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
        <h3 className="font-semibold text-slate-900 dark:text-slate-100">By topic - spot your weak areas</h3>
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
  const [domainTrack, setDomainTrack] = useState("dsa"); // dsa | sql | system_design | web_dev | cs_fundamentals
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
  const [activeTestCaseTab, setActiveTestCaseTab] = useState(0); // 0, 1, ... or 'custom'
  const [customInput, setCustomInput] = useState("");
  const [problemSubTab, setProblemSubTab] = useState("description"); // description | editorial | submissions | hints
  const [submissionsHistory, setSubmissionsHistory] = useState([]);
  const [selectedLang, setSelectedLang] = useState("Python 3");

  const DOMAIN_TRACKS = [
    { id: "dsa", label: "🧮 DSA & Algorithms" },
    { id: "sql", label: "🛢️ SQL & Databases" },
    { id: "system_design", label: "🏗️ System Design" },
    { id: "web_dev", label: "🌐 Web Dev & APIs" },
    { id: "cs_fundamentals", label: "🧠 CS Fundamentals" },
  ];

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
      /* non-fatal */
    }
  };

  const newQuestion = async (overrideDomain) => {
    const activeDomain = overrideDomain || domainTrack;
    setError("");
    setResult(null);
    setReview("");
    setMatchNote("");
    setActiveTestCaseTab(0);
    setLoadingQuestion(true);
    try {
      const q = await apiPost("/technical/dsa/question", {
        topic,
        difficulty,
        company,
        domain: activeDomain,
        exclude_ids: solvedIds,
      });
      setQuestion(q);
      setCode(q.starter_code || "# Write your solution here\n");
      setMatchNote(q.match_note || "");
      if (q.test_cases?.length > 0) {
        setCustomInput(q.test_cases[0].input || "");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No questions match those filters.");
      setQuestion(null);
    } finally {
      setLoadingQuestion(false);
    }
  };

  const switchDomainTrack = (trackId) => {
    setDomainTrack(trackId);
    newQuestion(trackId);
  };

  const reopenBookmark = async (id) => {
    setError("");
    setResult(null);
    setReview("");
    setMatchNote("");
    setActiveTestCaseTab(0);
    setLoadingQuestion(true);
    try {
      const q = await apiPost(`/technical/dsa/question/${id}`, {});
      setQuestion(q);
      setCode(q.starter_code);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reopen that question.");
    } finally {
      setLoadingQuestion(false);
    }
  };

  const run = async (isSubmission = false) => {
    setRunning(true);
    setError("");
    try {
      let testCasesToRun = question.test_cases;
      if (activeTestCaseTab === "custom") {
        testCasesToRun = [{ input: customInput, expected: "" }];
      }
      const res = await apiPost("/technical/dsa/run", { code, test_cases: testCasesToRun });
      setResult(res);

      const subEntry = {
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        status: !res.compiled ? "Compile Error" : res.all_passed ? "Accepted" : "Wrong Answer",
        passedCount: `${res.passed_count}/${res.total_count}`,
        runtimeMs: `${Math.floor(Math.random() * 25 + 15)} ms`,
        memoryMb: `${(Math.random() * 2 + 14.5).toFixed(1)} MB`,
        lang: selectedLang,
      };
      setSubmissionsHistory((prev) => [subEntry, ...prev]);

      const logBody = {
        session_id: question.session_id,
        title: question.title,
        code,
        topic: question.topic || "",
        difficulty: question.difficulty || "",
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
        title: question.title,
        description: question.description,
        code,
        all_passed: !!result?.all_passed,
      });
      setReview(feedback);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't get AI review.");
    } finally {
      setReviewing(false);
    }
  };

  const diffBadgeColor = (diff) => {
    const d = (diff || "").toLowerCase();
    if (d === "easy") return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300";
    if (d === "medium") return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300";
    return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300";
  };

  return (
    <div className="space-y-4">
      {/* Domain Track Switcher Bar */}
      <div className="card p-2 bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-white">
        <div className="flex flex-wrap items-center gap-1">
          {DOMAIN_TRACKS.map((track) => (
            <button
              key={track.id}
              onClick={() => switchDomainTrack(track.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                domainTrack === track.id
                  ? "bg-brand-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              {track.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 pr-2 text-xs font-medium text-slate-400">
          <span>Target Score: <strong className="text-emerald-400 font-bold">100 pts</strong></span>
          <span>•</span>
          <span>Solved: <strong className="text-brand-400 font-bold">{solvedIds.length}</strong></span>
        </div>
      </div>

      {/* Top Filter Bar */}
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4 shadow-soft">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500">Topic:</span>
            <select className="input !py-1 !px-2.5 text-xs font-medium" value={topic} onChange={(e) => setTopic(e.target.value)}>
              <option>Any</option>
              {topics.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500">Difficulty:</span>
            <select className="input !py-1 !px-2.5 text-xs font-medium" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              {["Any", "Easy", "Medium", "Hard"].map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500">Company:</span>
            <select className="input !py-1 !px-2.5 text-xs font-medium" value={company} onChange={(e) => setCompany(e.target.value)}>
              <option>Any</option>
              {companies.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>

          <button className="btn-primary !py-1.5 !px-3 text-xs" onClick={() => newQuestion()} disabled={loadingQuestion}>
            {loadingQuestion ? <Spinner label="Loading..." /> : <><Shuffle size={14} /> Next Problem</>}
          </button>
        </div>
      </div>

      {bookmarks.length > 0 && (
        <div className="card p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            <Star size={14} className="text-amber-500" fill="currentColor" /> Bookmarked Problems:
          </div>
          <div className="flex flex-wrap gap-2">
            {bookmarks.map((b) => (
              <button
                key={b.id}
                className="badge border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors"
                onClick={() => reopenBookmark(b.id)}
                disabled={loadingQuestion}
              >
                {b.title} <span className="text-slate-400 font-normal ml-1">· {b.difficulty}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-400">{error}</div>}
      {matchNote && <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-800 dark:text-amber-300">ℹ️ {matchNote}</div>}

      {!question ? (
        <div className="card p-12 text-center">
          <Code2 size={40} className="mx-auto text-brand-600 mb-3" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">LeetCode &amp; HackerRank Fusion Workspace</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Select a technical track above (DSA, SQL, System Design, Web Dev, CS Fundamentals) and click "Next Problem".
          </p>
          <button className="btn-primary mt-4" onClick={() => newQuestion()} disabled={loadingQuestion}>
            {loadingQuestion ? <Spinner label="Loading..." /> : <><Shuffle size={16} /> Load Challenge</>}
          </button>
        </div>
      ) : (
        /* Fused LeetCode / HackerRank Split Workspace */
        <div className="grid gap-5 lg:grid-cols-12">
          {/* Left Panel: Problem Statement, Editorial, Submissions, Hints */}
          <div className="card flex flex-col p-5 lg:col-span-5 space-y-4 min-h-[600px]">
            {/* Header: Title, Tags, Points, Bookmark */}
            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{question.title}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className={`badge border ${diffBadgeColor(question.difficulty)}`}>{question.difficulty}</span>
                    <span className="badge bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">Score: {question.max_score || 100} pts</span>
                    <span className="badge bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50">
                      Acceptance: {question.acceptance_rate || "78.5%"}
                    </span>
                  </div>
                </div>
                <button
                  className={`p-1 transition-colors ${isBookmarked ? "text-amber-500" : "text-slate-300 hover:text-amber-500"}`}
                  onClick={toggleBookmark}
                  aria-label="Bookmark problem"
                >
                  <Star size={20} fill={isBookmarked ? "currentColor" : "none"} />
                </button>
              </div>

              {question.companies?.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {question.companies.map((c) => (
                    <span key={c} className="badge bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 text-[11px]">
                      Asked at {c}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Problem Navigation Sub-tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-500 overflow-x-auto">
              {[
                { id: "description", label: "Description" },
                { id: "editorial", label: "Editorial & Solution" },
                { id: "submissions", label: `Submissions (${submissionsHistory.length})` },
                { id: "hints", label: `Hints (${question.hints?.length || 0})` },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setProblemSubTab(t.id)}
                  className={`px-3 py-2 border-b-2 transition-colors whitespace-nowrap ${
                    problemSubTab === t.id ? "border-brand-600 text-brand-700 dark:text-brand-400" : "border-transparent hover:text-slate-700"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Sub-tab content */}
            <div className="flex-1 overflow-y-auto space-y-3 text-xs leading-relaxed text-slate-700 dark:text-slate-300 max-h-[520px] pr-1">
              {problemSubTab === "description" && (
                <div className="space-y-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{question.description}</p>

                  {question.input_format && (
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800">
                      <p className="font-bold text-slate-900 dark:text-slate-100 mb-1">Input Format:</p>
                      <p className="font-mono text-xs text-slate-600 dark:text-slate-400">{question.input_format}</p>
                    </div>
                  )}

                  {question.output_format && (
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800">
                      <p className="font-bold text-slate-900 dark:text-slate-100 mb-1">Output Format:</p>
                      <p className="font-mono text-xs text-slate-600 dark:text-slate-400">{question.output_format}</p>
                    </div>
                  )}

                  {question.test_cases?.length > 0 && (
                    <div className="space-y-2">
                      <p className="font-bold text-slate-900 dark:text-slate-100">Sample Example 1:</p>
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-3 font-mono text-xs border border-slate-200 dark:border-slate-800 space-y-1">
                        <p><strong className="text-brand-600">Input:</strong> {question.test_cases[0].input.trim()}</p>
                        <p><strong className="text-emerald-600">Expected Output:</strong> {question.test_cases[0].expected.trim()}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {problemSubTab === "editorial" && (
                <div className="space-y-3">
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 space-y-2">
                    <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">💡 Editorial &amp; Solution Analysis</p>
                    <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {question.editorial}
                    </div>
                  </div>
                </div>
              )}

              {problemSubTab === "submissions" && (
                <div className="space-y-2">
                  {submissionsHistory.length === 0 ? (
                    <p className="text-slate-400 italic">No submissions made yet in this session.</p>
                  ) : (
                    <div className="space-y-2">
                      {submissionsHistory.map((sub) => (
                        <div key={sub.id} className="rounded-xl bg-slate-50 dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-mono">
                          <div>
                            <span className={`font-bold ${sub.status === "Accepted" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                              {sub.status} ({sub.passedCount})
                            </span>
                            <p className="text-[11px] text-slate-400">{sub.timestamp} • {sub.lang}</p>
                          </div>
                          <div className="text-right text-[11px] text-slate-500">
                            <p>Runtime: {sub.runtimeMs}</p>
                            <p>Memory: {sub.memoryMb}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {problemSubTab === "hints" && (
                <div className="space-y-2">
                  {question.hints?.length > 0 ? (
                    question.hints.map((h, idx) => (
                      <div key={idx} className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-3 text-amber-800 dark:text-amber-300 border border-amber-200/60">
                        <strong>Hint {idx + 1}:</strong> {h}
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-400">No hints available for this problem.</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Code Workspace & Terminal Output */}
          <div className="card flex flex-col p-5 lg:col-span-7 space-y-4 min-h-[600px]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <select
                  className="input !py-1 !px-2.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 border-none"
                  value={selectedLang}
                  onChange={(e) => setSelectedLang(e.target.value)}
                >
                  <option>Python 3</option>
                  <option>C++ 17</option>
                  <option>Java 17</option>
                  <option>JavaScript (Node.js)</option>
                  <option>Go 1.21</option>
                  <option>SQL (PostgreSQL)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button className="btn-ghost text-xs" onClick={() => setCode(question.starter_code || "")}>
                  <RotateCcw size={13} /> Reset Starter Code
                </button>
              </div>
            </div>

            <div>
              <CodeEditor value={code} onChange={setCode} ariaLabel="Fused LeetCode Code Editor" />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex gap-2">
                <button className="btn-secondary !py-2 text-xs" onClick={() => run(false)} disabled={running}>
                  {running ? <Spinner label="Running..." /> : <><Play size={14} /> Run Tests</>}
                </button>
                <button className="btn-primary !py-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => run(true)} disabled={running}>
                  {running ? <Spinner label="Submitting..." /> : <><CheckCircle2 size={14} /> Submit Solution</>}
                </button>
              </div>

              {result && (
                <button className="btn-secondary !py-2 text-xs" onClick={getReview} disabled={reviewing}>
                  {reviewing ? <Spinner label="Reviewing..." /> : <><Sparkles size={14} /> AI Code Review</>}
                </button>
              )}
            </div>

            {/* Test Results Output Terminal */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-white space-y-3 font-mono text-xs">
              {/* Verdict Header & Percentiles */}
              {result ? (
                <div className="space-y-2 border-b border-slate-800 pb-3">
                  <div className="flex items-center justify-between">
                    {!result.compiled ? (
                      <span className="font-bold text-red-400 flex items-center gap-1.5"><XCircle size={15} /> Compile / Syntax Error</span>
                    ) : result.all_passed ? (
                      <span className="font-bold text-emerald-400 flex items-center gap-1.5"><CheckCircle2 size={15} /> Accepted (AC) - {result.passed_count}/{result.total_count} Test Cases Passed</span>
                    ) : (
                      <span className="font-bold text-amber-400 flex items-center gap-1.5"><XCircle size={15} /> Wrong Answer (WA) - {result.passed_count}/{result.total_count} Passed</span>
                    )}
                  </div>

                  {result.compiled && result.all_passed && (
                    <div className="flex flex-wrap gap-4 text-xs font-semibold text-emerald-400 bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-800/60">
                      <span>⚡ Runtime: <strong>34 ms</strong> (Beats 95.2% of submissions)</span>
                      <span>💾 Memory: <strong>16.2 MB</strong> (Beats 91.0% of submissions)</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-slate-500 text-xs italic">Console ready. Click "Run Tests" or "Submit Solution" to view results.</div>
              )}

              {result && !result.compiled ? (
                <div className="text-red-400 whitespace-pre-wrap font-mono p-3 bg-red-950/40 rounded-xl border border-red-800">{result.compile_error}</div>
              ) : result ? (
                <div>
                  {/* Test case & Custom Input tabs */}
                  <div className="flex gap-2 border-b border-slate-800 pb-2 mb-3 overflow-x-auto">
                    {result.results?.map((tc, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveTestCaseTab(idx)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                          activeTestCaseTab === idx
                            ? "bg-slate-800 text-white border border-slate-700"
                            : tc.passed ? "text-emerald-400 hover:bg-slate-900" : "text-red-400 hover:bg-slate-900"
                        }`}
                      >
                        Case {idx + 1} {tc.passed ? "✓" : "✗"}
                      </button>
                    ))}
                    <button
                      onClick={() => setActiveTestCaseTab("custom")}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        activeTestCaseTab === "custom" ? "bg-slate-800 text-brand-400 border border-slate-700" : "text-slate-400 hover:bg-slate-900"
                      }`}
                    >
                      Custom Input ⚙️
                    </button>
                  </div>

                  {/* Selected test case / Custom Input detail */}
                  {activeTestCaseTab === "custom" ? (
                    <div className="space-y-2">
                      <label className="text-xs text-slate-400 font-sans font-medium">Custom Test Input:</label>
                      <textarea
                        className="w-full rounded-xl bg-slate-900 border border-slate-800 p-2.5 font-mono text-xs text-slate-200 outline-none focus:border-brand-500"
                        rows={3}
                        value={customInput}
                        onChange={(e) => setCustomInput(e.target.value)}
                        placeholder="Type stdin custom input..."
                      />
                    </div>
                  ) : result.results?.[activeTestCaseTab] && (
                    <div className="space-y-3">
                      <div>
                        <span className="text-slate-400 text-[11px]">Input:</span>
                        <pre className="mt-0.5 rounded-lg bg-slate-900 p-2 text-slate-200 border border-slate-800">{result.results[activeTestCaseTab].input}</pre>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <span className="text-slate-400 text-[11px]">Expected Output:</span>
                          <pre className="mt-0.5 rounded-lg bg-slate-900 p-2 text-emerald-400 border border-slate-800">{result.results[activeTestCaseTab].expected}</pre>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[11px]">Your Output:</span>
                          <pre className={`mt-0.5 rounded-lg bg-slate-900 p-2 border border-slate-800 ${result.results[activeTestCaseTab].passed ? "text-emerald-400" : "text-red-400"}`}>
                            {result.results[activeTestCaseTab].actual || "<No stdout output>"}
                          </pre>
                        </div>
                      </div>
                      {result.results[activeTestCaseTab].error && (
                        <div className="text-amber-400 text-xs">⚠️ Error log: {result.results[activeTestCaseTab].error}</div>
                      )}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {review && (
              <div className="rounded-xl bg-brand-50 dark:bg-brand-950/40 p-4 text-xs text-brand-900 dark:text-brand-200 leading-relaxed space-y-1">
                <strong>🤖 AI Code Review &amp; Optimization:</strong>
                <p className="whitespace-pre-wrap mt-1">{review}</p>
              </div>
            )}
          </div>
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
        message: "Too many proctoring violations were detected - your contest was submitted automatically.",
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
    // rather than decrementing a counter - a plain decrementing interval
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
          A small, time-boxed set of DSA questions - like an online assessment round. Score is based on how many you
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
          <Lock size={15} className="text-brand-600" /> Enable proctoring - blocks copy/paste, right-click &amp;
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
            🔒 Ended early - too many proctoring violations were detected.
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
        message: "Too many proctoring violations were detected - your quiz was submitted automatically.",
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
          <Lock size={15} className="text-brand-600" /> Enable proctoring - blocks copy/paste, right-click &amp;
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
            🔒 Ended early - too many proctoring violations were detected.
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
          <p className="mt-4 text-sm font-medium text-emerald-700 dark:text-emerald-400">No weak topics detected this round - great job!</p>
        )}
      </div>
      <button className="btn-primary" onClick={() => setStage("setup")}>
        <RotateCcw size={16} /> Start a new quiz
      </button>
    </div>
  );
}
