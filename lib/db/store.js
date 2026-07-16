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
 * Contract: every method is async, and every return value is a point-in-time
 * *snapshot* — never a live handle into the store. A session object does not
 * observe later writes, so after a mutation callers must use the value that
 * mutation returned. (Holding a pre-write snapshot across an `appendTurn` is
 * what made the interviewer reply to a stale transcript under SQLite while
 * appearing correct under the in-memory driver.)
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

  /**
   * Deep-copy on the way in and out, so callers can never hold a live
   * reference into the store. Without this the in-memory driver silently
   * "works" where a real (serializing) driver would not — see the note on
   * snapshot semantics above.
   * @param {Session|null} s @returns {Session|null}
   */
  #snapshot(s) {
    return s ? structuredClone(s) : null;
  }

  /** @param {Object} config @returns {Promise<Session>} */
  async create(config) {
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
    this.sessions.set(session.id, structuredClone(session));
    return session;
  }

  /** @param {string} id @returns {Promise<Session|null>} */
  async get(id) {
    return this.#snapshot(this.sessions.get(id) || null);
  }

  /** @param {string} id @param {"interviewer"|"candidate"} role @param {string} content */
  async appendTurn(id, role, content) {
    const s = this.sessions.get(id);
    if (!s) throw new Error("Session not found");
    s.history.push({ role, content, at: Date.now() });
    s.updatedAt = Date.now();
    return this.#snapshot(s);
  }

  /** @param {string} id @param {"active"|"completed"} status */
  async setStatus(id, status) {
    const s = this.sessions.get(id);
    if (!s) throw new Error("Session not found");
    s.status = status;
    s.updatedAt = Date.now();
    return this.#snapshot(s);
  }

  /** @param {string} id @param {Object} report */
  async setReport(id, report) {
    const s = this.sessions.get(id);
    if (!s) throw new Error("Session not found");
    s.report = report;
    s.status = "completed";
    s.updatedAt = Date.now();
    return this.#snapshot(s);
  }

  /** @param {number} [limit] @returns {Promise<Session[]>} newest first */
  async list(limit = 50) {
    return [...this.sessions.values()]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit)
      .map((s) => this.#snapshot(s));
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
