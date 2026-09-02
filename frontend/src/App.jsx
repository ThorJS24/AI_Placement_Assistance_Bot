import { lazy, Suspense, useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import { Menu } from "lucide-react";
import Sidebar from "./components/Sidebar.jsx";
import Onboarding from "./components/Onboarding.jsx";
import Spinner from "./components/Spinner.jsx";
import Login from "./pages/Login.jsx";
import { apiGet, authMe, authLogout, setStudentName } from "./api/client.js";
import { applyPreferences, saveLocalPreferences } from "./lib/preferences.js";

// Home/Chatbot stay eager — Home is the near-universal landing page and
// Chatbot is the next most common destination, so there's no benefit to
// splitting them out. The heavier, less-universally-visited pages are
// route-level code-split instead, so a student's first paint only has to
// parse/execute whichever single page they actually land on.
import Home from "./pages/Home.jsx";
import Chatbot from "./pages/Chatbot.jsx";
const ResumeBuilder = lazy(() => import("./pages/ResumeBuilder.jsx"));
const RoadmapGenerator = lazy(() => import("./pages/RoadmapGenerator.jsx"));
const MockInterview = lazy(() => import("./pages/MockInterview.jsx"));
const LiveInterview = lazy(() => import("./pages/LiveInterview.jsx"));
const TechnicalInterview = lazy(() => import("./pages/TechnicalInterview.jsx"));
const SettingsPage = lazy(() => import("./pages/Settings.jsx"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard.jsx"));

const ONBOARDING_DONE_KEY = "onboarding_done";

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [identity, setIdentity] = useState({ app_title: "AI Placement Assistance Platform", department_name: "", college_name: "" });
  const [showOnboarding, setShowOnboarding] = useState(false);
  // "checking" | "in" | "out" — real accounts now gate the whole app (see
  // backend/core/auth.py + main.py's session-enforcing middleware); every
  // page below this point assumes a verified session exists.
  const [authStatus, setAuthStatus] = useState("checking");
  const [username, setUsername] = useState("");

  // Branding is exempt from the auth gate (see main.py's
  // _AUTH_EXEMPT_EXACT) specifically so the login screen itself can show
  // the department's name/logo before anyone has signed in.
  useEffect(() => {
    apiGet("/settings/status")
      .then((s) => setIdentity({ app_title: s.app_title, department_name: s.department_name, college_name: s.college_name }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    authMe()
      .then((me) => {
        setUsername(me.username);
        setStudentName(me.username);
        setAuthStatus("in");
        if (!localStorage.getItem(ONBOARDING_DONE_KEY)) setShowOnboarding(true);
      })
      .catch(() => setAuthStatus("out"));
  }, []);

  // Reconcile appearance preferences against the student's server-saved
  // copy once authenticated — main.jsx already applied the localStorage
  // copy before first paint (instant, offline-safe), this just catches a
  // fresh browser up if the student set preferences on another device
  // under the same account. No-op on a network error.
  useEffect(() => {
    if (authStatus !== "in") return;
    apiGet("/preferences")
      .then((server) => {
        applyPreferences(server);
        saveLocalPreferences(server);
      })
      .catch(() => {});
  }, [authStatus]);

  const closeOnboarding = () => {
    localStorage.setItem(ONBOARDING_DONE_KEY, "1");
    setShowOnboarding(false);
  };

  const handleLogout = async () => {
    await authLogout().catch(() => {});
    setUsername("");
    setAuthStatus("out");
  };

  if (authStatus === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Spinner label="Loading..." size={20} />
      </div>
    );
  }

  if (authStatus === "out") {
    return (
      <Login
        appTitle={identity.app_title}
        departmentName={identity.department_name}
        collegeName={identity.college_name}
        onAuthenticated={(name) => {
          setUsername(name);
          setStudentName(name);
          setAuthStatus("in");
          if (!localStorage.getItem(ONBOARDING_DONE_KEY)) setShowOnboarding(true);
        }}
      />
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
      {showOnboarding && <Onboarding onDone={closeOnboarding} />}
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        appTitle={identity.app_title}
        departmentName={identity.department_name}
        collegeName={identity.college_name}
        studentName={username}
        onEditProfile={() => setShowOnboarding(true)}
        onLogout={handleLogout}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 px-4 py-3 backdrop-blur lg:hidden">
          <button className="rounded-lg p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{identity.app_title}</span>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <div className="mx-auto w-full max-w-6xl animate-fade-in">
            <Suspense fallback={<div className="flex justify-center py-16"><Spinner label="Loading..." size={20} /></div>}>
              <Routes>
                <Route path="/" element={<Home onEditProfile={() => setShowOnboarding(true)} />} />
                <Route path="/chat" element={<Chatbot />} />
                <Route path="/resume" element={<ResumeBuilder />} />
                <Route path="/roadmap" element={<RoadmapGenerator />} />
                <Route path="/mock-interview" element={<MockInterview />} />
                <Route path="/live-interview" element={<LiveInterview />} />
                <Route path="/technical-interview" element={<TechnicalInterview />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="*" element={<Home />} />
              </Routes>
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
