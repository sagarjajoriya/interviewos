"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { INTERVIEW_TYPES, LEVELS, PERSONAS, DEFAULTS } from "@/lib/interview/personas";

export default function SetupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    candidateName: "",
    role: "",
    company: "",
    type: DEFAULTS.type,
    level: DEFAULTS.level,
    persona: DEFAULTS.persona,
    numQuestions: DEFAULTS.numQuestions,
    focus: "",
    resume: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function loadResumeFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 200 * 1024) {
      setError("Resume file too large — please keep it under 200 KB of text.");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((f) => ({ ...f, resume: String(reader.result || "").slice(0, 20000) }));
      setError("");
    };
    reader.onerror = () => setError("Could not read that file.");
    reader.readAsText(file);
    e.target.value = "";
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function start(e) {
    e.preventDefault();
    if (!form.role.trim()) {
      setError("Please enter the role you're interviewing for.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed to create interview");
      const session = await res.json();
      router.push(`/interview/${session.id}`);
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <main className="flex-1 w-full">
      <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
        <header className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> AI Interviewer · text mode
            </div>
            <Link
              href="/history"
              className="inline-flex items-center rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-muted hover:text-foreground hover:border-accent/50 transition"
            >
              Past interviews →
            </Link>
          </div>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
            Interview<span className="text-accent-2">OS</span>
          </h1>
          <p className="mt-4 text-muted text-lg max-w-xl mx-auto">
            A realistic, adaptive interview that listens, asks intelligent follow-ups, and
            hands you a detailed, rubric-based evaluation at the end.
          </p>
        </header>

        <form
          onSubmit={start}
          className="card rounded-2xl p-6 sm:p-8"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Your name" hint="How the interviewer will address you">
              <input
                className="input"
                placeholder="e.g. Alex"
                value={form.candidateName}
                onChange={set("candidateName")}
                maxLength={80}
              />
            </Field>
            <Field label="Role" required hint="The position you're interviewing for">
              <input
                className="input"
                placeholder="e.g. Senior Frontend Engineer"
                value={form.role}
                onChange={set("role")}
                maxLength={120}
              />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 mt-5">
            <Field label="Company" hint="Optional — adds realistic context">
              <input
                className="input"
                placeholder="e.g. Acme Inc."
                value={form.company}
                onChange={set("company")}
                maxLength={120}
              />
            </Field>
            <Field label="Seniority level">
              <select className="input" value={form.level} onChange={set("level")}>
                {Object.values(LEVELS).map((l) => (
                  <option key={l.id} value={l.id}>{l.label}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mt-6">
            <Label>Interview type</Label>
            <div className="grid gap-3 sm:grid-cols-2 mt-2">
              {Object.values(INTERVIEW_TYPES).map((t) => (
                <Choice
                  key={t.id}
                  active={form.type === t.id}
                  onClick={() => setForm((f) => ({ ...f, type: t.id }))}
                  title={t.label}
                  desc={t.blurb}
                />
              ))}
            </div>
          </div>

          <div className="mt-6">
            <Label>Interviewer style</Label>
            <div className="grid gap-3 sm:grid-cols-3 mt-2">
              {Object.values(PERSONAS).map((p) => (
                <Choice
                  key={p.id}
                  active={form.persona === p.id}
                  onClick={() => setForm((f) => ({ ...f, persona: p.id }))}
                  title={p.label}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 mt-6">
            <Field
              label={`Interview length — ${form.numQuestions} topics`}
              hint="Approx. number of primary questions"
            >
              <input
                type="range"
                min={3}
                max={12}
                value={form.numQuestions}
                onChange={(e) => setForm((f) => ({ ...f, numQuestions: Number(e.target.value) }))}
                className="w-full accent-[var(--accent)] mt-3"
              />
            </Field>
            <Field label="Focus areas" hint="Optional — skills or themes to probe">
              <input
                className="input"
                placeholder="e.g. React performance, system design"
                value={form.focus}
                onChange={set("focus")}
                maxLength={400}
              />
            </Field>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground/90">
                Resume <span className="text-muted font-normal">(optional, recommended)</span>
              </span>
              <label className="text-xs text-accent-2 hover:underline cursor-pointer">
                Load from .txt / .md file
                <input type="file" accept=".txt,.md,text/plain,text/markdown" className="hidden" onChange={loadResumeFile} />
              </label>
            </div>
            <span className="block text-xs text-muted mt-0.5 mb-2">
              Paste your resume — the interviewer will ask about your actual projects and experience.
            </span>
            <textarea
              className="input resize-y"
              rows={form.resume ? 8 : 3}
              placeholder="Paste your resume text here…"
              value={form.resume}
              onChange={set("resume")}
              maxLength={20000}
            />
            {form.resume && (
              <div className="flex justify-between text-[11px] text-muted mt-1">
                <span>✓ Interviewer will tailor questions to this resume</span>
                <span>{form.resume.length.toLocaleString()} / 20,000</span>
              </div>
            )}
          </div>

          {error && (
            <p className="mt-5 text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-7 w-full rounded-xl bg-accent hover:bg-accent/90 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-3.5 transition ring-focus"
          >
            {submitting ? "Preparing your interview…" : "Start interview →"}
          </button>
          <p className="mt-3 text-center text-xs text-muted">
            You can end the interview anytime and get your report.
          </p>
        </form>
      </div>

      <style jsx global>{`
        .input {
          width: 100%;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 0.6rem;
          padding: 0.65rem 0.8rem;
          color: var(--foreground);
          font-size: 0.95rem;
          outline: none;
          box-shadow: 0 1px 2px rgba(28, 30, 43, 0.03);
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .input:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(90, 91, 216, 0.15);
        }
        .input::placeholder {
          color: var(--muted);
          opacity: 0.7;
        }
      `}</style>
    </main>
  );
}

function Label({ children }) {
  return <span className="text-sm font-medium text-foreground/90">{children}</span>;
}

function Field({ label, hint, required, children }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground/90">
        {label} {required && <span className="text-accent-2">*</span>}
      </span>
      {hint ? (
        <span className="block text-xs text-muted mt-0.5 mb-2">{hint}</span>
      ) : (
        <span className="block mb-2" />
      )}
      {children}
    </label>
  );
}

function Choice({ active, onClick, title, desc }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl border p-3.5 transition ${
        active
          ? "border-accent bg-accent/5 ring-1 ring-accent"
          : "border-border bg-surface hover:border-accent/50 hover:shadow-sm"
      }`}
    >
      <div className="text-sm font-medium">{title}</div>
      {desc && <div className="text-xs text-muted mt-1 leading-snug">{desc}</div>}
    </button>
  );
}
