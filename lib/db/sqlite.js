import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * SQLite-backed repository using Node's built-in `node:sqlite` driver.
 * Zero external dependencies. Implements the same interface as the in-memory
 * repo in store.js, plus `list()` for the history page.
 *
 * Storage is document-style: config/history/report are JSON columns. This
 * mirrors the repo API exactly and ports trivially to Postgres (jsonb) later.
 *
 * The methods are async even though `node:sqlite` is synchronous: the repo
 * contract has to hold for network-backed drivers (Postgres) too, so callers
 * always await. Every method returns a freshly-read snapshot — callers must
 * use the returned value rather than holding an earlier one.
 */
export class SqliteRepo {
  /** @param {string} [file] Path to the db file (defaults to ./data/interviewos.db) */
  constructor(file) {
    const dbPath = file || path.join(process.cwd(), "data", "interviewos.db");
    mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS sessions (
        id         TEXT PRIMARY KEY,
        config     TEXT NOT NULL,
        status     TEXT NOT NULL DEFAULT 'active',
        history    TEXT NOT NULL DEFAULT '[]',
        report     TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at DESC);
    `);
  }

  /** @returns {import("./store.js").Session|null} */
  #row2session(row) {
    if (!row) return null;
    return {
      id: row.id,
      config: JSON.parse(row.config),
      status: row.status,
      history: JSON.parse(row.history),
      report: row.report ? JSON.parse(row.report) : null,
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
    };
  }

  async create(config) {
    const now = Date.now();
    const id = randomUUID();
    this.db
      .prepare(
        "INSERT INTO sessions (id, config, status, history, report, created_at, updated_at) VALUES (?, ?, 'active', '[]', NULL, ?, ?)"
      )
      .run(id, JSON.stringify(config), now, now);
    return this.get(id);
  }

  async get(id) {
    const row = this.db.prepare("SELECT * FROM sessions WHERE id = ?").get(id);
    return this.#row2session(row);
  }

  async appendTurn(id, role, content) {
    const s = await this.get(id);
    if (!s) throw new Error("Session not found");
    s.history.push({ role, content, at: Date.now() });
    this.db
      .prepare("UPDATE sessions SET history = ?, updated_at = ? WHERE id = ?")
      .run(JSON.stringify(s.history), Date.now(), id);
    return this.get(id);
  }

  async setStatus(id, status) {
    const res = this.db
      .prepare("UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?")
      .run(status, Date.now(), id);
    if (res.changes === 0) throw new Error("Session not found");
    return this.get(id);
  }

  async setReport(id, report) {
    const res = this.db
      .prepare("UPDATE sessions SET report = ?, status = 'completed', updated_at = ? WHERE id = ?")
      .run(JSON.stringify(report), Date.now(), id);
    if (res.changes === 0) throw new Error("Session not found");
    return this.get(id);
  }

  /**
   * Recent sessions for the history page (newest first).
   * @param {number} [limit]
   * @returns {import("./store.js").Session[]}
   */
  async list(limit = 50) {
    const rows = this.db
      .prepare("SELECT * FROM sessions ORDER BY created_at DESC LIMIT ?")
      .all(Math.min(200, Math.max(1, limit)));
    return rows.map((r) => this.#row2session(r));
  }
}
