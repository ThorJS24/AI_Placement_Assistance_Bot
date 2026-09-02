// Hand-rolled, dependency-free SVG charts for the admin "Trends" tab. No new
// npm package is added on purpose - the frontend's registry access is
// unreliable in some environments, so these charts are plain SVG driven by
// plain arithmetic, fully verifiable with esbuild alone (no chart library to
// trust). Colors use `stroke="currentColor"`/`fill="currentColor"` paired
// with a Tailwind text-* className, so each series picks up the app's
// existing palette (and dark mode) for free, the same trick READINESS_STYLE
// already uses for badges elsewhere in the admin dashboard.

import { useEffect, useState } from "react";
import { Activity, TrendingUp } from "lucide-react";
import Spinner from "./Spinner.jsx";
import { apiAdminGet, ApiError } from "../api/client.js";

// Small inline donut-slice icon, drawn by hand rather than pulled from
// lucide-react -- npm registry lookups aren't reliable in every environment
// this app gets built in, so this sidesteps needing to verify a less-common
// icon name (e.g. "PieChart"/"ChartPie") actually exists in the installed
// lucide-react version before shipping.
function PieChartGlyph({ size = 16, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M21 12a9 9 0 1 1-9-9v9z" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M12 3a9 9 0 0 1 9 9h-9V3z" fill="currentColor" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  );
}

const CHART_W = 600;
const CHART_H = 200;
const PAD_L = 34;
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 24;

function formatShortDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function scaleX(i, count) {
  if (count <= 1) return PAD_L;
  return PAD_L + (i / (count - 1)) * (CHART_W - PAD_L - PAD_R);
}

function scaleY(value, max) {
  const usable = CHART_H - PAD_T - PAD_B;
  if (max <= 0) return CHART_H - PAD_B;
  return PAD_T + usable - (value / max) * usable;
}

// Builds an SVG path string from a list of values, skipping (breaking the
// line at) any null/undefined entries -- used for solve-rate, where a day
// with zero graded attempts is genuinely "no data" rather than "0%".
function linePath(values, max) {
  let d = "";
  let drawing = false;
  values.forEach((v, i) => {
    if (v == null) {
      drawing = false;
      return;
    }
    const x = scaleX(i, values.length);
    const y = scaleY(v, max);
    d += `${drawing ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)} `;
    drawing = true;
  });
  return d.trim();
}

function AxisFrame({ dates, max, yTicks = 4 }) {
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => Math.round((max / yTicks) * i));
  // Thin out x-axis labels so they don't overlap on wide date ranges.
  const step = Math.max(1, Math.ceil(dates.length / 7));
  return (
    <g>
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={PAD_L}
            x2={CHART_W - PAD_R}
            y1={scaleY(t, max)}
            y2={scaleY(t, max)}
            className="stroke-slate-100 dark:stroke-slate-800"
            strokeWidth="1"
          />
          <text x={PAD_L - 6} y={scaleY(t, max) + 3} textAnchor="end" className="fill-slate-400 dark:fill-slate-500" fontSize="9">
            {t}
          </text>
        </g>
      ))}
      {dates.map((d, i) =>
        i % step === 0 ? (
          <text
            key={d}
            x={scaleX(i, dates.length)}
            y={CHART_H - 6}
            textAnchor="middle"
            className="fill-slate-400 dark:fill-slate-500"
            fontSize="9"
          >
            {formatShortDate(d)}
          </text>
        ) : null
      )}
    </g>
  );
}

const ACTIVITY_SERIES = [
  { key: "chat_sessions", label: "Chat sessions", colorClass: "text-brand-600" },
  { key: "resumes", label: "Resumes", colorClass: "text-emerald-500" },
  { key: "roadmaps", label: "Roadmaps", colorClass: "text-amber-500" },
  { key: "mock_interviews", label: "Mock interviews", colorClass: "text-purple-500" },
  { key: "technical_interviews", label: "Technical rounds", colorClass: "text-rose-500" },
];

function ActivityTrendChart({ data }) {
  const dates = data.map((d) => d.date);
  const max = Math.max(1, ...ACTIVITY_SERIES.flatMap((s) => data.map((d) => d[s.key] || 0)));
  return (
    <div>
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full" role="img" aria-label="Daily activity trend">
        <AxisFrame dates={dates} max={max} />
        {ACTIVITY_SERIES.map((s) => {
          const values = data.map((d) => d[s.key] || 0);
          return (
            <path
              key={s.key}
              d={linePath(values, max)}
              fill="none"
              className={s.colorClass}
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          );
        })}
        {ACTIVITY_SERIES.map((s) =>
          data.map((d, i) =>
            d[s.key] ? (
              <circle
                key={`${s.key}-${d.date}`}
                cx={scaleX(i, data.length)}
                cy={scaleY(d[s.key], max)}
                r="2.2"
                className={s.colorClass}
                fill="currentColor"
              >
                <title>
                  {formatShortDate(d.date)} - {s.label}: {d[s.key]}
                </title>
              </circle>
            ) : null
          )
        )}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
        {ACTIVITY_SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className={`h-2 w-2 rounded-full ${s.colorClass}`} style={{ backgroundColor: "currentColor" }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function SolveRateChart({ data }) {
  const dates = data.map((d) => d.date);
  const rates = data.map((d) => d.solve_rate);
  const maxAttempts = Math.max(1, ...data.map((d) => d.total || 0));
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">Solve rate (%) - gap means no attempts that day</p>
        <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full" role="img" aria-label="Solve rate trend">
          <AxisFrame dates={dates} max={100} />
          <path d={linePath(rates, 100)} fill="none" className="text-brand-600" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
          {data.map((d, i) =>
            d.solve_rate != null ? (
              <circle key={d.date} cx={scaleX(i, data.length)} cy={scaleY(d.solve_rate, 100)} r="2.2" className="text-brand-600" fill="currentColor">
                <title>
                  {formatShortDate(d.date)} - {d.solve_rate}% ({d.correct}/{d.total})
                </title>
              </circle>
            ) : null
          )}
        </svg>
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">Questions attempted per day</p>
        <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full" role="img" aria-label="Attempts per day">
          <AxisFrame dates={dates} max={maxAttempts} />
          {data.map((d, i) => {
            const barW = Math.max(2, (CHART_W - PAD_L - PAD_R) / data.length - 3);
            const x = scaleX(i, data.length) - barW / 2;
            const y = scaleY(d.total || 0, maxAttempts);
            return (
              <rect key={d.date} x={x} y={y} width={barW} height={CHART_H - PAD_B - y} className="text-brand-300 dark:text-brand-700" fill="currentColor" rx="1">
                <title>
                  {formatShortDate(d.date)} - {d.total} attempted
                </title>
              </rect>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

const READINESS_COLORS = {
  green: { colorClass: "text-emerald-500", label: "Ready" },
  amber: { colorClass: "text-amber-500", label: "In progress" },
  red: { colorClass: "text-red-500", label: "Not started" },
};

function ReadinessDonut({ dist }) {
  const total = (dist.green || 0) + (dist.amber || 0) + (dist.red || 0);
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const order = ["green", "amber", "red"];

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 120 120" width="120" height="120" role="img" aria-label="Readiness distribution">
        <circle cx="60" cy="60" r={radius} fill="none" className="stroke-slate-100 dark:stroke-slate-800" strokeWidth="16" />
        {total === 0
          ? null
          : order.map((key) => {
              const count = dist[key] || 0;
              if (!count) return null;
              const frac = count / total;
              const dash = frac * circumference;
              const el = (
                <circle
                  key={key}
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="none"
                  className={READINESS_COLORS[key].colorClass}
                  stroke="currentColor"
                  strokeWidth="16"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 60 60)"
                >
                  <title>
                    {READINESS_COLORS[key].label}: {count} ({Math.round(frac * 100)}%)
                  </title>
                </circle>
              );
              offset += dash;
              return el;
            })}
        <text x="60" y="64" textAnchor="middle" className="fill-slate-700 dark:fill-slate-200" fontSize="22" fontWeight="700">
          {total}
        </text>
      </svg>
      <div className="space-y-1.5">
        {order.map((key) => (
          <div key={key} className="flex items-center gap-2 text-sm">
            <span className={`h-2.5 w-2.5 rounded-full ${READINESS_COLORS[key].colorClass}`} style={{ backgroundColor: "currentColor" }} />
            <span className="text-slate-600 dark:text-slate-300">{READINESS_COLORS[key].label}</span>
            <span className="text-slate-400 dark:text-slate-500">{dist[key] || 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const RANGE_OPTIONS = [
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
  { label: "60d", days: 60 },
];

export default function TrendsPanel() {
  const [days, setDays] = useState(14);
  const [activity, setActivity] = useState(null);
  const [solveRate, setSolveRate] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([
      apiAdminGet(`/admin/trends/activity?days=${days}`),
      apiAdminGet(`/admin/trends/solve-rate?days=${days}`),
      apiAdminGet("/admin/trends/readiness"),
    ])
      .then(([a, s, r]) => {
        if (cancelled) return;
        setActivity(a);
        setSolveRate(s);
        setReadiness(r);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load trends.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-1">
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.days}
            onClick={() => setDays(opt.days)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              days === opt.days
                ? "bg-brand-600 text-white"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {error && <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-400">{error}</div>}

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-400 dark:text-slate-500">
          <Spinner label="Loading trends..." />
        </div>
      ) : (
        !error && (
          <>
            <div className="card p-5">
              <div className="mb-3 flex items-center gap-2">
                <Activity size={16} className="text-brand-600" />
                <h2 className="font-semibold text-slate-900 dark:text-slate-100">Daily activity</h2>
              </div>
              <ActivityTrendChart data={activity} />
            </div>

            <div className="card p-5">
              <div className="mb-3 flex items-center gap-2">
                <TrendingUp size={16} className="text-brand-600" />
                <h2 className="font-semibold text-slate-900 dark:text-slate-100">DSA / quiz solve rate</h2>
              </div>
              <SolveRateChart data={solveRate} />
            </div>

            <div className="card p-5">
              <div className="mb-3 flex items-center gap-2">
                <PieChartGlyph size={16} className="text-brand-600" />
                <h2 className="font-semibold text-slate-900 dark:text-slate-100">Current readiness split</h2>
                <span className="text-xs text-slate-400 dark:text-slate-500">snapshot, not affected by the date range above</span>
              </div>
              <ReadinessDonut dist={readiness} />
            </div>
          </>
        )
      )}
    </div>
  );
}
