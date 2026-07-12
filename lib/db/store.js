import { randomUUID } from "node:crypto";
import { SqliteRepo } from "./sqlite.js";

/**
 * Interview persistence, hidden behind a small repository interface.
 *
 * Default driver is SQLite (node:sqlite, zero deps) — sessions survive
 * restarts. Set DB_DRIVER=memory for ephemeral storage (tests, throwaway
 * environments). To move to Postgres/Redis later, implement the same methods
 * in a new file and register it in `getRepo()` — no API-route or UI changes.
 *
 * @typedef {Object} Session
 * @property {string} id
 * @property {Object} config
 * @property {"active"|"completed"} status
 * @property {Array<{role:"interviewer"|"candidate", content:string, at:number}>} history
 * @property {Object|null} report
 * @property {number} createdAt
 * @property {number} updatedAt
 */

class InMemoryRepo {
  constructor() {
    /** @type {Map<string, Session>} */
    this.sessions = new Map();
  }

  /** @param {Object} config @returns {Session} */
  create(config) {
    const now = Date.now();
    const session = {
      id: randomUUID(),
      config,
      status: "active",
      history: [],
      report: null,
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  /** @param {string} id @returns {Session|null} */
  get(id) {
    return this.sessions.get(id) || null;
  }

  /** @param {string} id @param {"interviewer"|"candidate"} role @param {string} content */
  appendTurn(id, role, content) {
    const s = this.sessions.get(id);
    if (!s) throw new Error("Session not found");
    s.history.push({ role, content, at: Date.now() });
    s.updatedAt = Date.now();
    return s;
  }

  /** @param {string} id @param {"active"|"completed"} status */
  setStatus(id, status) {
    const s = this.sessions.get(id);
    if (!s) throw new Error("Session not found");
    s.status = status;
    s.updatedAt = Date.now();
    return s;
  }

  /** @param {string} id @param {Object} report */
  setReport(id, report) {
    const s = this.sessions.get(id);
    if (!s) throw new Error("Session not found");
    s.report = report;
    s.status = "completed";
    s.updatedAt = Date.now();
    return s;
  }

  /** @param {number} [limit] @returns {Session[]} newest first */
  list(limit = 50) {
    return [...this.sessions.values()]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }
}

// Persist a single instance across Next.js dev module reloads.
const globalKey = "__interviewos_repo__";
/** @returns {InMemoryRepo|SqliteRepo} */
export function getRepo() {
  if (!globalThis[globalKey]) {
    const driver = (process.env.DB_DRIVER || "sqlite").toLowerCase();
    globalThis[globalKey] =
      driver === "memory" ? new InMemoryRepo() : new SqliteRepo(process.env.DB_FILE);
  }
  return globalThis[globalKey];
}

/** Compact view for list/history pages — no full transcript payload. */
export function toSessionSummary(s) {
  return {
    id: s.id,
    role: s.config.role,
    company: s.config.company,
    candidateName: s.config.candidateName,
    type: s.config.type,
    level: s.config.level,
    status: s.status,
    answers: s.history.filter((t) => t.role === "candidate").length,
    overallScore: s.report?.overallScore ?? null,
    recommendation: s.report?.recommendation ?? null,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

/** Public view of a session (no internal-only fields leaked to clients). */
export function toPublicSession(s) {
  if (!s) return null;
  return {
    id: s.id,
    config: s.config,
    status: s.status,
    history: s.history.map((t) => ({ role: t.role, content: t.content, at: t.at })),
    report: s.report,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}
