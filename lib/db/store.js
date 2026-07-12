import { randomUUID } from "node:crypto";

/**
 * Interview persistence, hidden behind a small repository interface.
 *
 * Today this is an in-memory Map (survives dev hot-reload via globalThis). To
 * move to Postgres/SQLite/Redis later, implement the same methods in a new file
 * and swap `getRepo()` — no API-route or UI changes required.
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
}

// Persist a single instance across Next.js dev module reloads.
const globalKey = "__interviewos_repo__";
/** @returns {InMemoryRepo} */
export function getRepo() {
  if (!globalThis[globalKey]) {
    globalThis[globalKey] = new InMemoryRepo();
  }
  return globalThis[globalKey];
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
