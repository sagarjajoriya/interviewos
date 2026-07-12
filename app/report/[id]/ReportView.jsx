"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LEVELS, INTERVIEW_TYPES } from "@/lib/interview/personas";
import Markdown from "@/app/components/Markdown";

const DIMENSIONS = [
  ["technical_competency", "Technical competency"],
  ["communication", "Communication"],
  ["problem_solving", "Problem solving"],
  ["experience_ownership", "Experience & ownership"],
  ["culture_collaboration", "Collaboration & growth"],
];

const RECOMMENDATION = {
  strong_hire: { label: "Strong Hire", color: "var(--success)", tint: "rgba(52,211,153,0.15)" },
  hire: { label: "Hire", color: "var(--success)", tint: "rgba(52,211,153,0.12)" },
  lean_hire: { label: "Lean Hire", color: "var(--warning)", tint: "rgba(251,191,36,0.14)" },
  no_hire: { label: "No Hire", color: "var(--danger)", tint: "rgba(248,113,113,0.13)" },
  strong_no_hire: { label: "Strong No Hire", color: "var(--danger)", tint: "rgba(248,113,113,0.18)" },
};

export default function ReportView({ id }) {
  const [config, setConfig] = useState(null);
  const [history, setHistory] = useState([]);
  const [report, setReport] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error | notfound
  const [error, setError] = useState("");
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sres = await fetch(`/api/interviews/${id}`);
        if (sres.status === 404) {
          if (!cancelled) setStatus("notfound");
          return;
        }
        const session = await sres.json();
        if (cancelled) return;
        setConfig(session.config);
        setHistory(session.history);

        const rres = await fetch(`/api/interviews/${id}/report`, { method: "POST" });
        const data = await rres.json();
        if (cancelled) return;
        if (!rres.ok) {
          setError(data.error || "Could not generate the report.");
          setStatus("error");
          return;
        }
        setReport(data.report);
        setStatus("ready");
      } catch {
        if (!cancelled) {
          setError("Something went wrong loading your report.");
          setStatus("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (status === "notfound") {
    return (
      <Centered>
        <h1 className="text-2xl font-semibold">Report not found</h1>
        <Link href="/" className="btn-accent mt-6 inline-block">Start a new interview</Link>
      </Centered>
    );
  }

  if (status === "loading") {
    return (
      <Centered>
        <div className="typing mb-4"><span /><span /><span /></div>
        <h1 className="text-xl font-medium">Evaluating your interview…</h1>
        <p className="text-muted mt-2 text-sm">Reviewing the transcript against the rubric.</p>
      </Centered>
    );
  }

  if (status === "error") {
    return (
      <Centered>
        <h1 className="text-2xl font-semibold">Couldn&apos;t build the report</h1>
        <p className="text-muted mt-2">{error}</p>
        <div className="flex gap-3 justify-center mt-6">
          <Link href={`/interview/${id}`} className="rounded-lg border border-border px-4 py-2 text-sm hover:border-accent/50">
            Back to interview
          </Link>
          <Link href="/" className="btn-accent">New interview</Link>
        </div>
      </Centered>
    );
  }

  const rec = RECOMMENDATION[report.recommendation] || RECOMMENDATION.lean_hire;

  return (
    <main className="flex-1 w-full">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="text-sm text-muted hover:text-foreground">← Home</Link>
          <span className="text-xs text-muted">Interview report</span>
        </div>

        {/* Verdict card */}
        <section className="rounded-2xl border border-border bg-surface/70 p-6 sm:p-8 animate-rise">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs text-muted uppercase tracking-wide">Recommendation</div>
              <div className="text-2xl font-semibold mt-1" style={{ color: rec.color }}>{rec.label}</div>
              <div className="text-sm text-muted mt-1">
                {config?.role} · {LEVELS[config?.level]?.label} · {INTERVIEW_TYPES[config?.type]?.label}
              </div>
            </div>
            <ScoreDial value={report.overallScore} />
          </div>
          <p className="mt-5 leading-relaxed text-foreground/90">{report.summary}</p>
        </section>

        {/* Dimension scores */}
        <section className="mt-6 rounded-2xl border border-border bg-surface/70 p-6 sm:p-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-4">Rubric breakdown</h2>
          <div className="space-y-4">
            {DIMENSIONS.map(([key, label]) => (
              <ScoreBar key={key} label={label} value={report.scores[key]} />
            ))}
          </div>
          <p className="text-xs text-muted mt-4">Scored 1–5 · 3 meets the bar for this level.</p>
        </section>

        {/* Strengths & concerns */}
        <div className="grid gap-6 sm:grid-cols-2 mt-6">
          <ListCard title="Strengths" color="var(--success)" items={report.strengths} empty="No notable strengths recorded." />
          <ListCard title="Concerns" color="var(--danger)" items={report.concerns} empty="No major concerns raised." />
        </div>

        {/* Highlights */}
        {report.questionHighlights?.length > 0 && (
          <section className="mt-6 rounded-2xl border border-border bg-surface/70 p-6 sm:p-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-4">Notable moments</h2>
            <div className="space-y-4">
              {report.questionHighlights.map((h, i) => (
                <div key={i} className="border-l-2 border-accent/40 pl-4">
                  <div className="text-sm font-medium">{h.topic}</div>
                  <div className="text-sm text-muted mt-0.5">{h.assessment}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Follow-ups */}
        {report.followUpSuggestions?.length > 0 && (
          <section className="mt-6 rounded-2xl border border-border bg-surface/70 p-6 sm:p-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-4">For the next round</h2>
            <ul className="space-y-2">
              {report.followUpSuggestions.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="text-accent-2">→</span>
                  <span className="text-foreground/90">{s}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Transcript */}
        <section className="mt-6">
          <button
            onClick={() => setShowTranscript((s) => !s)}
            className="text-sm text-muted hover:text-foreground"
          >
            {showTranscript ? "▾ Hide" : "▸ Show"} full transcript ({history.length} messages)
          </button>
          {showTranscript && (
            <div className="mt-3 rounded-2xl border border-border bg-surface/70 p-5 space-y-4">
              {history.map((t, i) => (
                <div key={i}>
                  <div className="text-xs font-semibold text-muted mb-1">
                    {t.role === "interviewer" ? "Interviewer" : config?.candidateName || "You"}
                  </div>
                  <div className="text-sm">
                    <Markdown>{t.content}</Markdown>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="flex gap-3 justify-center mt-10">
          <Link href="/" className="btn-accent">Start a new interview</Link>
        </div>
      </div>

      <style jsx global>{`
        .btn-accent {
          background: var(--accent);
          color: #fff;
          font-weight: 500;
          border-radius: 0.6rem;
          padding: 0.6rem 1.1rem;
          font-size: 0.9rem;
        }
        .btn-accent:hover { background: color-mix(in srgb, var(--accent) 88%, #fff); }
      `}</style>
    </main>
  );
}

function ScoreBar({ label, value }) {
  const pct = (value / 5) * 100;
  const color = value >= 4 ? "var(--success)" : value >= 3 ? "var(--accent-2)" : "var(--warning)";
  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="text-foreground/90">{label}</span>
        <span className="text-muted tabular-nums">{value}/5</span>
      </div>
      <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function ScoreDial({ value }) {
  const pct = Math.round((value / 5) * 100);
  const color = value >= 4 ? "var(--success)" : value >= 3 ? "var(--accent-2)" : "var(--warning)";
  return (
    <div
      className="relative h-20 w-20 rounded-full grid place-items-center"
      style={{ background: `conic-gradient(${color} ${pct}%, var(--surface-2) ${pct}%)` }}
    >
      <div className="h-15 w-15 rounded-full bg-surface grid place-items-center" style={{ height: "3.75rem", width: "3.75rem" }}>
        <span className="text-lg font-semibold tabular-nums">{value}</span>
        <span className="sr-only">out of 5</span>
      </div>
    </div>
  );
}

function ListCard({ title, color, items, empty }) {
  return (
    <section className="rounded-2xl border border-border bg-surface/70 p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color }}>{title}</h2>
      {items?.length ? (
        <ul className="space-y-2.5">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed">
              <span style={{ color }} className="mt-0.5">•</span>
              <span className="text-foreground/90">{it}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">{empty}</p>
      )}
    </section>
  );
}

function Centered({ children }) {
  return (
    <main className="flex-1 grid place-items-center px-4 py-16">
      <div className="text-center max-w-md">{children}</div>
      <style jsx global>{`
        .btn-accent {
          background: var(--accent);
          color: #fff;
          font-weight: 500;
          border-radius: 0.6rem;
          padding: 0.6rem 1.1rem;
          font-size: 0.9rem;
        }
      `}</style>
    </main>
  );
}
