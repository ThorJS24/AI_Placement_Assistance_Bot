import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  GraduationCap, MessageSquare, FileText, Map, Mic, Code2, ArrowRight,
  Users, FileCheck, Route as RouteIcon, Headphones, Terminal, BookOpen, Pencil,
} from "lucide-react";
import { apiGet } from "../api/client.js";

const MODULES = [
  {
    to: "/chat", icon: MessageSquare, title: "AI Placement Chatbot",
    desc: "Ask anything about placements, resumes, interview strategy, or specific companies — grounded in your department's own FAQ.",
  },
  {
    to: "/resume", icon: FileText, title: "Resume Builder & Analyzer",
    desc: "Build an ATS-friendly resume from scratch and download it as DOCX/PDF, or get an AI-powered ATS score on an existing one.",
  },
  {
    to: "/roadmap", icon: Map, title: "Roadmap Generator",
    desc: "A personalized, week-by-week learning roadmap for your target role, grounded in real, free resources.",
  },
  {
    to: "/mock-interview", icon: Mic, title: "Mock Interview (Speech-to-Speech)",
    desc: "A fully spoken interview simulation — the AI asks out loud, you answer by voice, and it adapts in real time.",
  },
  {
    to: "/technical-interview", icon: Code2, title: "Technical Interview",
    desc: "Solve Python DSA problems against real test cases with instant feedback, or get quizzed on core CS topics.",
  },
];

const STAT_META = [
  { key: "chat_sessions", label: "Chat sessions", icon: Users },
  { key: "resumes_built", label: "Resumes built", icon: FileCheck },
  { key: "roadmaps_generated", label: "Roadmaps made", icon: RouteIcon },
  { key: "mock_interviews", label: "Mock interviews", icon: Headphones },
  { key: "technical_interviews", label: "Technical rounds", icon: Terminal },
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
        className="card mb-6 flex w-full items-center gap-3 p-4 text-left transition-colors hover:border-brand-200"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <BookOpen size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Add your stream, semester, and subjects</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Optional — helps the chatbot and roadmap tailor advice to where you actually are.</p>
        </div>
        <ArrowRight size={16} className="shrink-0 text-slate-400 dark:text-slate-500" />
      </button>
    );
  }

  return (
    <button onClick={onEditProfile} className="card mb-6 flex w-full flex-wrap items-center gap-2 p-4 text-left transition-colors hover:border-brand-200">
      <BookOpen size={16} className="shrink-0 text-brand-600" />
      {profile.stream && <span className="badge bg-brand-50 text-brand-700">{profile.stream}</span>}
      {profile.specialization && <span className="badge bg-gold-50 text-gold-700">{profile.specialization}</span>}
      {profile.semester && <span className="badge bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">Semester {profile.semester}</span>}
      {profile.subjects?.length > 0 && (
        <span className="badge bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">{profile.subjects.length} subject{profile.subjects.length > 1 ? "s" : ""} this semester</span>
      )}
      <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-slate-400 dark:text-slate-500">
        <Pencil size={12} /> Edit
      </span>
    </button>
  );
}

export default function Home({ onEditProfile }) {
  const [counts, setCounts] = useState(null);

  useEffect(() => {
    apiGet("/dashboard/counts").then(setCounts).catch(() => {});
  }, []);

  return (
    <div className="pb-10">
      <div className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 px-6 py-10 text-white shadow-soft sm:px-10 sm:py-12">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
            <GraduationCap size={26} />
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-white/80">
            FREE · OPEN-SOURCE · RUNS LOCALLY
          </span>
        </div>
        <h1 className="relative mt-5 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
          AI Placement Assistance Platform
        </h1>
        <p className="relative mt-3 max-w-2xl text-white/80">
          An all-in-one placement preparation suite — chat with a career assistant, build an
          ATS-friendly resume, get a personalized roadmap, and rehearse both spoken and
          technical interviews. No cost, no vendor lock-in, your data stays on this machine.
        </p>
      </div>

      <ProfileCard onEditProfile={onEditProfile} />

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {STAT_META.map(({ key, label, icon: Icon }) => (
          <div key={key} className="card animate-slide-up p-4">
            <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
              <Icon size={16} />
              <span className="text-xs font-medium">{label}</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
              {counts ? counts[key] : <span className="inline-block h-6 w-8 animate-pulse-soft rounded bg-slate-200 dark:bg-slate-700" />}
            </p>
          </div>
        ))}
      </div>

      <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">Choose a module</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {MODULES.map(({ to, icon: Icon, title, desc }) => (
          <Link
            key={to}
            to={to}
            className="card group flex flex-col gap-3 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-brand-200"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 transition-colors group-hover:bg-brand-600 group-hover:text-white">
              <Icon size={19} />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
            <p className="flex-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{desc}</p>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
              Open module
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
