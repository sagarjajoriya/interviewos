import { getLLM } from "../llm/index.js";
import {
  buildInterviewerSystem,
  directorNote,
  buildReportRequest,
  REPORT_SCORE_KEYS,
} from "./prompts.js";

export const END_TOKEN = "<<END_INTERVIEW>>";
const AVG_ANSWERS_PER_TOPIC = 1.5;

/**
 * A session's history is a list of turns:
 *   { role: "interviewer" | "candidate", content: string }
 */

/** Number of candidate answers recorded so far. */
function answersGiven(history) {
  return history.filter((t) => t.role === "candidate").length;
}

/**
 * Map interview history to the vendor-neutral ChatMessage[] the LLM expects,
 * plus a leading user primer (so the conversation always starts on a user turn,
 * which providers like Gemini require) and the private director note appended
 * as the final user turn for this generation.
 */
function buildTurnMessages(config, history) {
  const answers = answersGiven(history);
  const isFirstTurn = history.length === 0;
  const topicsCovered = Math.round(answers / AVG_ANSWERS_PER_TOPIC);

  /** @type {import("../llm/provider.js").ChatMessage[]} */
  const messages = [];
  if (!isFirstTurn) {
    // Anchor on a user turn so role alternation is always valid.
    messages.push({ role: "user", content: "Let's begin the interview." });
    for (const turn of history) {
      messages.push({
        role: turn.role === "interviewer" ? "assistant" : "user",
        content: turn.content,
      });
    }
  }

  const note = directorNote({ topicsCovered, numQuestions: config.numQuestions, isFirstTurn });
  messages.push({ role: "user", content: note });

  return messages;
}

/** True once enough ground has been covered that we should wrap up. */
export function shouldWrapUp(config, history) {
  const answers = answersGiven(history);
  const topicsCovered = Math.round(answers / AVG_ANSWERS_PER_TOPIC);
  const hardCap = config.numQuestions * 2;
  return topicsCovered >= config.numQuestions || answers >= hardCap;
}

/**
 * Stream the interviewer's next turn. Yields text chunks (with the END token
 * stripped from what the candidate sees). Returns the final cleaned text and
 * whether the interview ended, via the provided `onDone` callback.
 *
 * @param {Object} config
 * @param {Array<{role:string,content:string}>} history
 * @returns {AsyncGenerator<string, {text:string, ended:boolean}>}
 */
export async function* streamInterviewerTurn(config, history) {
  const llm = getLLM();
  const system = buildInterviewerSystem(config);
  const messages = buildTurnMessages(config, history);

  let raw = "";
  let emitted = "";
  for await (const chunk of llm.streamChat({ system, messages, temperature: 0.8 })) {
    raw += chunk;
    // Hold back a small tail so we never emit a partially-formed END token.
    const clean = raw.replace(END_TOKEN, "");
    const safeUpTo = Math.max(0, clean.length - END_TOKEN.length);
    const toEmit = clean.slice(emitted.length, safeUpTo);
    if (toEmit) {
      emitted += toEmit;
      yield toEmit;
    }
  }
  const finalText = raw.replace(END_TOKEN, "").trim();
  const remainder = finalText.slice(emitted.length);
  if (remainder) yield remainder;

  const ended = raw.includes(END_TOKEN);
  return { text: finalText, ended };
}

/** Render history as a plain-text transcript for evaluation. */
export function renderTranscript(config, history) {
  return history
    .map((t) => `${t.role === "interviewer" ? "Interviewer" : "Candidate"}: ${t.content}`)
    .join("\n\n");
}

/** Coerce a raw model score into an integer 1-5. */
function clampScore(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 3;
  return Math.min(5, Math.max(1, n));
}

const VALID_RECS = ["strong_hire", "hire", "lean_hire", "no_hire", "strong_no_hire"];

/** Normalize/validate the model's report JSON into a trusted shape. */
function normalizeReport(raw) {
  const scores = {};
  for (const key of REPORT_SCORE_KEYS) {
    scores[key] = clampScore(raw?.scores?.[key]);
  }
  const avg = REPORT_SCORE_KEYS.reduce((s, k) => s + scores[k], 0) / REPORT_SCORE_KEYS.length;
  const asArray = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()) : []);

  return {
    summary: typeof raw?.summary === "string" ? raw.summary.trim() : "No summary produced.",
    scores,
    overallScore: raw?.overallScore ? clampScore(raw.overallScore) : clampScore(avg),
    recommendation: VALID_RECS.includes(raw?.recommendation) ? raw.recommendation : "lean_hire",
    strengths: asArray(raw?.strengths),
    concerns: asArray(raw?.concerns),
    questionHighlights: Array.isArray(raw?.questionHighlights)
      ? raw.questionHighlights
          .filter((h) => h && typeof h.topic === "string" && typeof h.assessment === "string")
          .map((h) => ({ topic: h.topic.trim(), assessment: h.assessment.trim() }))
      : [],
    followUpSuggestions: asArray(raw?.followUpSuggestions),
  };
}

/** Generate a structured evaluation report from a completed interview. */
export async function generateReport(config, history) {
  const llm = getLLM();
  const transcript = renderTranscript(config, history);
  const { system, messages } = buildReportRequest(config, transcript);
  const raw = await llm.generateJSON({ system, messages, temperature: 0.3 });
  return normalizeReport(raw);
}
