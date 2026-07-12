"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LEVELS, INTERVIEW_TYPES } from "@/lib/interview/personas";

const REC_LABEL = {
  strong_hire: ["Strong Hire", "var(--success)"],
  hire: ["Hire", "var(--success)"],
  lean_hire: ["Lean Hire", "var(--warning)"],
  no_hire: ["No Hire", "var(--danger)"],
  strong_no_hire: ["Strong No Hire", "var(--danger)"],
};

export default function HistoryList() {
  const [interviews, setInterviews] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/interviews")
      .then((r) => r.json())
      .then((d) => setInterviews(d.interviews || []))
      .catch(() => setError("Could not load your interviews."));
  }, []);

  return (
    <main className="flex-1 w-full">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold">Your interviews</h1>
            <p className="text-sm text-muted mt-1">Past sessions and their evaluations.</p>
          </div>
          <Link
            href="/"
            className="rounded-lg bg-accent text-white text-sm font-medium px-4 py-2 hover:opacity-90"
          >
            New interview
          </Link>
        </div>

        {error && <p className="text-danger text-sm">{error}</p>}

        {interviews === null && !error && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-surface-2 animate-pulse" />
            ))}
          </div>
        )}

        {interviews?.length === 0 && (
          <div className="rounded-2xl border border-border bg-surface/70 p-10 text-center">
            <p className="text-muted">No interviews yet.</p>
            <Link href="/" className="inline-block mt-4 rounded-lg bg-accent text-white text-sm font-medium px-4 py-2 hover:opacity-90">
              Start your first interview →
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {interviews?.map((iv) => {
            const done = iv.status === "completed";
            const rec = iv.recommendation ? REC_LABEL[iv.recommendation] : null;
            return (
              <Link
                key={iv.id}
                href={done ? `/report/${iv.id}` : `/interview/${iv.id}`}
                className="block rounded-xl border border-border bg-surface/70 p-4 hover:border-accent/50 transition animate-rise"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {iv.role}
                      {iv.company ? <span className="text-muted font-normal"> · {iv.company}</span> : null}
                    </div>
                    <div className="text-xs text-muted mt-1">
                      {LEVELS[iv.level]?.label} · {INTERVIEW_TYPES[iv.type]?.label} ·{" "}
                      {new Date(iv.createdAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {rec ? (
                      <span className="text-sm font-medium" style={{ color: rec[1] }}>
                        {rec[0]}{iv.overallScore ? ` · ${iv.overallScore}/5` : ""}
                      </span>
                    ) : done ? (
                      <span className="text-sm text-muted">Completed</span>
                    ) : (
                      <span className="text-xs rounded-full border border-accent/40 bg-accent/10 text-accent-2 px-2.5 py-1">
                        In progress
                      </span>
                    )}
                    <span className="text-muted">→</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
