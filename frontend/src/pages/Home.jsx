import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  GraduationCap, MessageSquare, FileText, Map, Mic, Code2, ArrowRight,
  Users, FileCheck, Route as RouteIcon, Headphones, Terminal, BookOpen, Pencil,
  Sparkles, Trophy, CheckCircle2, Zap, Target, Lightbulb, ShieldCheck, Play
} from "lucide-react";
import { apiGet, getStudentName } from "../api/client.js";

const MODULES = [
  {
    to: "/chat", icon: MessageSquare, title: "01. AI Placement Chatbot", tag: "General Chatbot",
    badge: "24/7 AI Assistance",
    desc: "Ask anything about placement drives, company-specific patterns, interview tips, and salary negotiation grounded in department FAQs.",
    color: "from-blue-500 to-indigo-600",
  },
  {
    to: "/resume", icon: FileText, title: "02. ATS Resume Builder & Canvas", tag: "Resume Builder",
    badge: "Live ATS Canvas & Analyzer",
    desc: "Build an ATS-optimized resume with real-time A4 live canvas preview, sub-score analysis (Formatting, Keywords, Impact), and DOCX/PDF export.",
    color: "from-emerald-500 to-teal-600",
  },
  {
    to: "/roadmap", icon: Map, title: "03. Roadmap Generator", tag: "Roadmap Generator",
    badge: "Personalized Career Path",
    desc: "Generate a custom week-by-week technical learning plan for your target role with curated free courses and project ideas.",
    color: "from-violet-500 to-purple-600",
  },
  {
    to: "/live-interview", icon: Mic, title: "04. Live AI Voice Interview", tag: "Mock Interview",
    badge: "Speech-to-Speech & VAD",
    desc: "Experience a hands-free, voice-first mock interview. The interviewer speaks out loud, you respond via microphone with instant barge-in support.",
    color: "from-amber-500 to-orange-600",
  },
  {
    to: "/technical-interview", icon: Code2, title: "05. Technical Interview (DSA)", tag: "Technical Interview",
    badge: "Python Judge & Contest",
    desc: "Solve LeetCode-style Python DSA problems with automated unit testing, sandboxed execution, concept quizzes, and department leaderboards.",
    color: "from-rose-500 to-pink-600",
  },
];

const STAT_META = [
  { key: "chat_sessions", label: "Chat Consultations", icon: Users },
  { key: "resumes_built", label: "Resumes Built", icon: FileCheck },
  { key: "roadmaps_generated", label: "Roadmaps Generated", icon: RouteIcon },
  { key: "mock_interviews", label: "Mock Interviews", icon: Headphones },
  { key: "technical_interviews", label: "DSA Submissions", icon: Terminal },
];

const DAILY_TIPS = [
  "Quantify your resume bullets! Use numbers, percentages, or time saved (e.g., 'Reduced API latency by 35%').",
  "During technical interviews, talk through your thought process before writing code to demonstrate problem-solving structure.",
  "Tailor your professional summary to match keywords from the specific job description you're applying for.",
  "Practice voice interviews out loud to build confidence and reduce verbal fillers ('um', 'uh', 'like').",
  "Review core CS fundamentals: Data Structures, Algorithms, DBMS, Operating Systems, and System Design concepts."
];

function ProfileCard({ onEditProfile }) {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    apiGet("/profile").then(setProfile).catch(() => {});
  }, []);

  if (!profile) return null;
  const hasProfile = profile.stream || profile.specialization || profile.semester || profile.subjects?.length > 0;

  if (!hasProfile) {
    return (
      <button
        onClick={onEditProfile}
        className="card mb-6 flex w-full items-center gap-3 p-4 text-left transition-all hover:border-brand-300 hover:shadow-md"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <BookOpen size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Complete your Academic Profile</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Add your stream, semester, and subjects so the AI tailors career advice specifically for you.</p>
        </div>
        <span className="btn-secondary !py-1 text-xs">Set up now</span>
      </button>
    );
  }

  return (
    <div className="card mb-6 flex w-full flex-wrap items-center justify-between gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase text-slate-400">Academic Track:</span>
        {profile.stream && <span className="badge bg-brand-50 text-brand-700 font-semibold">{profile.stream}</span>}
        {profile.specialization && <span className="badge bg-gold-50 text-gold-700">{profile.specialization}</span>}
        {profile.semester && <span className="badge bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">Semester {profile.semester}</span>}
        {profile.subjects?.length > 0 && (
          <span className="badge bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">{profile.subjects.length} Subjects</span>
        )}
      </div>
      <button onClick={onEditProfile} className="btn-ghost text-xs text-brand-600">
        <Pencil size={12} /> Edit Profile
      </button>
    </div>
  );
}

export default function Home({ onEditProfile }) {
  const [counts, setCounts] = useState(null);
  const studentName = getStudentName() || "Student";
  const randomTip = DAILY_TIPS[Math.floor(Math.random() * DAILY_TIPS.length)];

  useEffect(() => {
    apiGet("/dashboard/counts").then(setCounts).catch(() => {});
  }, []);

  return (
    <div className="space-y-8 pb-10">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-800 via-brand-900 to-slate-950 p-6 text-white shadow-xl sm:p-10">
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 backdrop-blur">
              <GraduationCap size={28} className="text-brand-300" />
            </div>
            <div>
              <span className="rounded-full bg-emerald-500/20 border border-emerald-400/30 px-3 py-0.5 text-xs font-semibold text-emerald-300">
                Placement Command Center Active
              </span>
              <p className="text-xs text-white/60">CIA 3 Assessment Project Module Suite</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/70">
            <ShieldCheck size={14} className="text-emerald-400" /> Local &amp; Private · Fully Offline Capable
          </div>
        </div>

        <div className="relative mt-6 max-w-3xl">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Welcome back, <span className="text-brand-300">{studentName}</span> 👋
          </h1>
          <p className="mt-3 text-base text-white/80 leading-relaxed">
            Your centralized AI assistant for campus placement readiness. Build ATS resumes, practice spoken &amp; technical interviews, generate career roadmaps, and chat with AI grounded in department guidelines.
          </p>
        </div>

        {/* Quick Launch Shortcuts */}
        <div className="relative mt-8 flex flex-wrap gap-3 border-t border-white/10 pt-6">
          <Link to="/resume" className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-white/20 hover:scale-105">
            <FileText size={15} /> Build ATS Resume
          </Link>
          <Link to="/live-interview" className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/20 border border-emerald-400/30 px-4 py-2 text-xs font-semibold text-emerald-300 transition-all hover:bg-emerald-500/30 hover:scale-105">
            <Mic size={15} /> Launch Live AI Interview
          </Link>
          <Link to="/technical-interview" className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-white/20 hover:scale-105">
            <Code2 size={15} /> Practice DSA Code Judge
          </Link>
        </div>
      </div>

      {/* Profile Card */}
      <ProfileCard onEditProfile={onEditProfile} />

      {/* Live Activity Counter Widgets */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Platform Activity &amp; Preparation Metrics</h2>
          <span className="text-xs text-slate-400">Live Department Data</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {STAT_META.map(({ key, label, icon: Icon }) => (
            <div key={key} className="card p-4 transition-all hover:border-brand-200 hover:shadow-sm">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <Icon size={16} className="text-brand-600 dark:text-brand-400" />
                <span className="text-xs font-medium">{label}</span>
              </div>
              <p className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                {counts ? counts[key] : <span className="inline-block h-6 w-8 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Placement Tip of the Day */}
      <div className="rounded-2xl border border-amber-200/80 bg-amber-50/70 dark:bg-amber-950/30 p-4 text-amber-900 dark:text-amber-200">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-amber-100 dark:bg-amber-900/50 p-2 text-amber-700 dark:text-amber-300">
            <Lightbulb size={20} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400">Placement Tip of the Day</p>
            <p className="mt-1 text-sm leading-relaxed">{randomTip}</p>
          </div>
        </div>
      </div>

      {/* All 5 CIA 3 Modules Grid */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Placement Preparation Modules</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Select any of the 5 core modules to begin practicing</p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map(({ to, icon: Icon, title, tag, badge, desc, color }) => (
            <Link
              key={to}
              to={to}
              className="card group flex flex-col justify-between p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-brand-300"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${color} text-white shadow-md transition-transform group-hover:scale-110`}>
                    <Icon size={22} />
                  </div>
                  <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    {badge}
                  </span>
                </div>

                <span className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">{tag}</span>
                <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                  {title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {desc}
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-700 dark:text-brand-400">
                  Launch Module <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                </span>
                <span className="text-[11px] text-slate-400">CIA 3 Module</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

