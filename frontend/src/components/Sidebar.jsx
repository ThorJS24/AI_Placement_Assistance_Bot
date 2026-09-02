import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  GraduationCap, MessageSquare, FileText, Map, Mic, Radio, Code2, Settings, X, User, Pencil, Sun, Moon,
  Palette, ChevronLeft, ChevronRight, LogOut,
} from "lucide-react";
import StatusPill from "./StatusPill.jsx";
import PreferencesPanel from "./PreferencesPanel.jsx";
import { getLocalPreferences, syncPreferences } from "../lib/preferences.js";

function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));

  const toggle = () => {
    const next = !dark;
    setDark(next);
    syncPreferences({ dark_mode: next ? "dark" : "light" });
  };

  return (
    <button
      onClick={toggle}
      className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium text-white/70 transition-colors duration-150 hover:bg-white/10 hover:text-white"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
      {dark ? "Light mode" : "Dark mode"}
    </button>
  );
}

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: GraduationCap, end: true },
  { to: "/chat", label: "AI Chatbot", icon: MessageSquare },
  { to: "/resume", label: "Resume Builder", icon: FileText },
  { to: "/roadmap", label: "Roadmap Generator", icon: Map },
  { to: "/mock-interview", label: "Mock Interview", icon: Mic },
  { to: "/live-interview", label: "Live AI Interview", icon: Radio },
  { to: "/technical-interview", label: "Technical Interview", icon: Code2 },
];

export default function Sidebar({ open, onClose, appTitle, departmentName, collegeName, studentName, onEditProfile, onLogout }) {
  const [collapsed, setCollapsed] = useState(() => getLocalPreferences().sidebar_collapsed);
  const [showPrefs, setShowPrefs] = useState(false);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    syncPreferences({ sidebar_collapsed: next });
  };

  // Collapse (icon-only) is a desktop-only affordance — the mobile sidebar
  // is a full-width overlay that only appears when explicitly opened, where
  // an icon-only mode would just make it harder to use with no space saved.
  const navItemClass = ({ isActive }) =>
    `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors duration-150 ${
      collapsed ? "lg:justify-center lg:px-2" : ""
    } ${
      isActive ? "bg-white dark:bg-slate-800 text-brand-800 shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white"
    }`;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed z-40 inset-y-0 left-0 w-72 shrink-0 transform bg-gradient-to-b from-brand-950 via-brand-900 to-brand-950
          text-white transition-all duration-200 lg:sticky lg:inset-auto lg:top-0 lg:h-screen lg:translate-x-0 lg:self-start
          ${collapsed ? "lg:w-20" : "lg:w-72"}
          ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-full flex-col overflow-y-auto">
          <div className={`flex items-center justify-between px-5 pt-6 pb-4 ${collapsed ? "lg:justify-center lg:px-2" : ""}`}>
            <div className={`flex items-center gap-2.5 ${collapsed ? "lg:flex-col lg:gap-1" : ""}`}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
                <GraduationCap size={20} />
              </div>
              <div className={`leading-tight ${collapsed ? "lg:hidden" : ""}`}>
                <p className="text-sm font-semibold">{appTitle || "Placement Assistant"}</p>
                {collegeName && <p className="text-[11px] text-white/60">{collegeName}</p>}
                <p className="text-[11px] text-white/50">{departmentName}</p>
              </div>
            </div>
            <button
              className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white lg:hidden"
              onClick={onClose}
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          </div>

          <nav className="flex-1 space-y-1 px-3 py-2">
            {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} onClick={onClose} title={label} className={navItemClass}>
                <Icon size={18} className="shrink-0" />
                <span className={collapsed ? "lg:hidden" : ""}>{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="space-y-2 px-3 pb-4">
            <NavLink to="/settings" onClick={onClose} title="Settings" className={navItemClass}>
              <Settings size={18} className="shrink-0" />
              <span className={collapsed ? "lg:hidden" : ""}>Settings</span>
            </NavLink>
            <button
              onClick={onEditProfile}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium text-white/70 transition-colors duration-150 hover:bg-white/10 hover:text-white ${
                collapsed ? "lg:justify-center lg:px-2" : ""
              }`}
              title="Edit your academic profile"
            >
              <User size={18} className="shrink-0" />
              <span className={`min-w-0 flex-1 truncate ${collapsed ? "lg:hidden" : ""}`}>{studentName}</span>
              <Pencil size={13} className={`shrink-0 opacity-60 ${collapsed ? "lg:hidden" : ""}`} />
            </button>
            <ThemeToggle />
            <button
              onClick={() => setShowPrefs(true)}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium text-white/70 transition-colors duration-150 hover:bg-white/10 hover:text-white ${
                collapsed ? "lg:justify-center lg:px-2" : ""
              }`}
              title="Appearance & preferences"
              aria-label="Appearance & preferences"
            >
              <Palette size={18} className="shrink-0" />
              <span className={collapsed ? "lg:hidden" : ""}>Appearance</span>
            </button>
            <button
              onClick={toggleCollapsed}
              className={`hidden w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium text-white/70 transition-colors duration-150 hover:bg-white/10 hover:text-white lg:flex ${
                collapsed ? "lg:justify-center lg:px-2" : ""
              }`}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight size={18} className="shrink-0" /> : <ChevronLeft size={18} className="shrink-0" />}
              <span className={collapsed ? "lg:hidden" : ""}>Collapse</span>
            </button>
            <button
              onClick={onLogout}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium text-white/70 transition-colors duration-150 hover:bg-white/10 hover:text-white ${
                collapsed ? "lg:justify-center lg:px-2" : ""
              }`}
              title="Log out"
              aria-label="Log out"
            >
              <LogOut size={18} className="shrink-0" />
              <span className={collapsed ? "lg:hidden" : ""}>Log out</span>
            </button>
            <div className={`rounded-xl bg-white/5 px-3.5 py-3 ${collapsed ? "lg:hidden" : ""}`}>
              <StatusPill />
            </div>
            <NavLink
              to="/admin"
              onClick={onClose}
              className={`block px-1 text-center text-[11px] text-white/30 transition-colors hover:text-white/60 ${collapsed ? "lg:hidden" : ""}`}
            >
              Placement cell admin
            </NavLink>
          </div>
        </div>
      </aside>

      {showPrefs && (
        <PreferencesPanel
          onClose={() => setShowPrefs(false)}
          collapsed={collapsed}
          onCollapsedChange={(next) => setCollapsed(next)}
        />
      )}
    </>
  );
}
