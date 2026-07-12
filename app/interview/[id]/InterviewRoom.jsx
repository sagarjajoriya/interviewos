"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { streamNDJSON } from "@/lib/client/ndjson";
import { LEVELS, INTERVIEW_TYPES } from "@/lib/interview/personas";
import Markdown from "@/app/components/Markdown";
import { useVoice } from "./useVoice";

export default function InterviewRoom({ id }) {
  const [config, setConfig] = useState(null);
  const [messages, setMessages] = useState([]); // {role, content}
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [ended, setEnded] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);

  const voice = useVoice();
  const voiceOnRef = useRef(voiceOn);
  voiceOnRef.current = voiceOn;

  // Remember the user's voice preference across sessions.
  useEffect(() => {
    setVoiceOn(localStorage.getItem("interviewos.voice") === "1");
  }, []);
  function toggleVoice() {
    setVoiceOn((v) => {
      const next = !v;
      localStorage.setItem("interviewos.voice", next ? "1" : "0");
      if (!next) voice.stopSpeaking();
      return next;
    });
  }

  const scrollRef = useRef(null);
  const openedRef = useRef(false); // guard against StrictMode double-open

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  // Run one interviewer turn (opening if no message).
  const runTurn = useCallback(
    async (message) => {
      setStreaming(true);
      setError("");
      setMessages((m) => [...m, { role: "interviewer", content: "", streaming: true }]);
      scrollToBottom();
      try {
        await streamNDJSON(`/api/interviews/${id}/turn`, { message }, (ev) => {
          if (ev.type === "chunk") {
            if (voiceOnRef.current) voice.speakChunk(ev.text);
            setMessages((m) => {
              const copy = [...m];
              const last = copy[copy.length - 1];
              if (last?.role === "interviewer") {
                copy[copy.length - 1] = { ...last, content: last.content + ev.text };
              }
              return copy;
            });
            scrollToBottom();
          } else if (ev.type === "done") {
            if (voiceOnRef.current) voice.speakFlush();
            setMessages((m) => {
              const copy = [...m];
              const last = copy[copy.length - 1];
              if (last?.role === "interviewer") copy[copy.length - 1] = { ...last, streaming: false };
              return copy;
            });
            if (ev.ended) setEnded(true);
          } else if (ev.type === "error") {
            setError(ev.message || "The interviewer had trouble responding.");
          }
        });
      } catch (err) {
        setError(err.message || "Connection error. Please try again.");
        // drop the empty placeholder on failure
        setMessages((m) => {
          const last = m[m.length - 1];
          if (last?.role === "interviewer" && !last.content) return m.slice(0, -1);
          return m.map((x, i) => (i === m.length - 1 ? { ...x, streaming: false } : x));
        });
      } finally {
        setStreaming(false);
        scrollToBottom();
      }
    },
    // speakChunk/speakFlush are stable useCallbacks; listing them (not `voice`)
    // keeps runTurn stable so the mount effect doesn't re-fire.
    [id, scrollToBottom, voice.speakChunk, voice.speakFlush]
  );

  // Load session on mount; auto-start the opening turn if fresh.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/interviews/${id}`);
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        const session = await res.json();
        if (cancelled) return;
        setConfig(session.config);
        setMessages(session.history.map((t) => ({ role: t.role, content: t.content })));
        setEnded(session.status === "completed");
        setLoading(false);

        if (session.history.length === 0 && session.status === "active" && !openedRef.current) {
          openedRef.current = true;
          runTurn(undefined);
        }
      } catch {
        if (!cancelled) {
          setError("Could not load the interview.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, runTurn]);

  async function send() {
    const text = input.trim();
    if (!text || streaming || ended) return;
    setInput("");
    setMessages((m) => [...m, { role: "candidate", content: text }]);
    scrollToBottom();
    await runTurn(text);
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  if (notFound) {
    return (
      <Centered>
        <h1 className="text-2xl font-semibold">Interview not found</h1>
        <p className="text-muted mt-2">This interview may have expired.</p>
        <Link href="/" className="btn-accent mt-6 inline-block">Start a new interview</Link>
      </Centered>
    );
  }

  const answered = messages.filter((m) => m.role === "candidate").length;
  const target = config?.numQuestions || 6;
  const progress = Math.min(100, Math.round((answered / (target * 1.5)) * 100));

  return (
    <div className="flex-1 flex flex-col min-h-0 h-screen">
      {/* Header */}
      <header className="border-b border-border bg-surface/85 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center gap-3">
          <Link href="/" className="text-sm text-muted hover:text-foreground shrink-0">← Exit</Link>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">
              {config ? config.role : "Interview"}
              {config?.company ? <span className="text-muted"> · {config.company}</span> : null}
            </div>
            <div className="text-xs text-muted truncate">
              {config
                ? `${LEVELS[config.level]?.label} · ${INTERVIEW_TYPES[config.type]?.label} interview`
                : "Loading…"}
            </div>
          </div>
          {voice.supported && !ended && (
            <button
              onClick={toggleVoice}
              title={voiceOn ? "Voice mode on — interviewer speaks aloud" : "Turn on voice mode"}
              className={`text-sm rounded-lg border px-3 py-1.5 shrink-0 transition ${
                voiceOn
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border text-muted hover:text-foreground hover:border-accent/50"
              }`}
            >
              {voiceOn ? "🔊 Voice on" : "🔇 Voice off"}
            </button>
          )}
          {ended ? (
            <Link href={`/report/${id}`} className="btn-accent text-sm shrink-0">View report →</Link>
          ) : (
            <Link
              href={`/report/${id}`}
              className="text-sm rounded-lg border border-border px-3 py-1.5 text-muted hover:text-foreground hover:border-accent/50 shrink-0"
            >
              End & get report
            </Link>
          )}
        </div>
        <div className="h-0.5 bg-surface-2">
          <div className="h-full bg-accent transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </header>

      {/* Transcript */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
        <div className="mx-auto max-w-3xl px-4 py-6 space-y-5">
          {loading && <SkeletonBubble />}

          {messages.map((m, i) => (
            <Bubble key={i} role={m.role} name={config?.candidateName}>
              {m.content ? (
                <Markdown>{m.content}</Markdown>
              ) : m.streaming ? (
                <span className="typing"><span /><span /><span /></span>
              ) : null}
            </Bubble>
          ))}

          {error && (
            <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2 max-w-md">
              {error}
            </div>
          )}

          {ended && (
            <div className="rounded-xl border border-accent/40 bg-accent/10 p-5 text-center animate-rise">
              <div className="font-medium">That wraps up the interview 🎯</div>
              <p className="text-sm text-muted mt-1">Ready to see how you did?</p>
              <Link href={`/report/${id}`} className="btn-accent mt-4 inline-block">
                View your evaluation report →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      {!ended && (
        <div className="border-t border-border bg-surface/85 backdrop-blur">
          <div className="mx-auto max-w-3xl px-4 py-3">
            <div
              className={`flex items-end gap-2 rounded-xl border bg-surface shadow-sm p-2 transition ${
                voice.listening ? "border-danger/50 ring-2 ring-danger/15" : "border-border focus-within:border-accent/60"
              }`}
            >
              <textarea
                value={voice.listening ? voice.interim || "" : input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                disabled={streaming || loading}
                readOnly={voice.listening}
                placeholder={
                  voice.listening
                    ? "Listening… speak your answer"
                    : streaming
                      ? "Interviewer is responding…"
                      : "Type your answer… (Enter to send, Shift+Enter for newline)"
                }
                className="flex-1 resize-none bg-transparent px-2 py-1.5 text-[0.95rem] outline-none max-h-40 disabled:opacity-60"
                style={{ minHeight: "2.25rem" }}
              />
              {voice.supported && (
                <button
                  onClick={() => {
                    if (voice.listening) {
                      voice.stopListening();
                    } else if (!streaming && !loading) {
                      voice.startListening((text) =>
                        setInput((cur) => (cur ? `${cur} ${text}` : text))
                      );
                    }
                  }}
                  disabled={streaming || loading}
                  title={voice.listening ? "Stop dictating" : "Dictate your answer"}
                  className={`shrink-0 h-9 w-9 grid place-items-center rounded-lg border transition disabled:opacity-40 ${
                    voice.listening
                      ? "border-danger/50 bg-danger/10 text-danger animate-pulse"
                      : "border-border text-muted hover:text-foreground hover:border-accent/50"
                  }`}
                >
                  {voice.listening ? "■" : "🎙"}
                </button>
              )}
              <button
                onClick={send}
                disabled={!input.trim() || streaming || loading || voice.listening}
                className="btn-accent shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
            <p className="text-[11px] text-muted mt-1.5 px-1">
              {voice.listening
                ? "Click ■ when you finish speaking — your words land in the box for review before sending."
                : voice.speaking
                  ? "Interviewer is speaking — start dictating to interrupt."
                  : "Answer naturally, as you would to a real interviewer."}
            </p>
          </div>
        </div>
      )}

      <style jsx global>{`
        .btn-accent {
          background: var(--accent);
          color: #fff;
          font-weight: 500;
          border-radius: 0.6rem;
          padding: 0.5rem 0.9rem;
          font-size: 0.9rem;
          transition: background 0.15s, opacity 0.15s;
        }
        .btn-accent:hover { background: color-mix(in srgb, var(--accent) 88%, #000); }
      `}</style>
    </div>
  );
}

function Bubble({ role, name, children }) {
  const isInterviewer = role === "interviewer";
  return (
    <div className={`flex gap-3 animate-rise ${isInterviewer ? "" : "flex-row-reverse"}`}>
      <div
        className={`h-8 w-8 shrink-0 rounded-full grid place-items-center text-xs font-semibold ${
          isInterviewer ? "bg-accent/20 text-accent-2" : "bg-surface-2 text-muted border border-border"
        }`}
        title={isInterviewer ? "Interviewer" : name || "You"}
      >
        {isInterviewer ? "AI" : (name || "You").slice(0, 1).toUpperCase()}
      </div>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-[0.95rem] shadow-sm ${
          isInterviewer
            ? "bg-surface border border-border rounded-tl-sm"
            : "bg-accent/10 border border-accent/20 rounded-tr-sm"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function SkeletonBubble() {
  return (
    <div className="flex gap-3">
      <div className="h-8 w-8 rounded-full bg-surface-2 animate-pulse" />
      <div className="h-16 w-2/3 rounded-2xl bg-surface-2 animate-pulse" />
    </div>
  );
}

function Centered({ children }) {
  return (
    <main className="flex-1 grid place-items-center px-4">
      <div className="text-center">{children}</div>
    </main>
  );
}
