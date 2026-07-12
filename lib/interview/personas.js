/**
 * Interview configuration vocabulary: types, seniority levels, and interviewer
 * personas. Kept as plain data so the UI and the prompt builder share one
 * source of truth.
 */

export const INTERVIEW_TYPES = {
  behavioral: {
    id: "behavioral",
    label: "Behavioral",
    blurb: "Past experience, teamwork, conflict, ownership (STAR-style).",
    guidance:
      "Focus on real past situations. Probe for specifics: what THEY did, the outcome, and what they learned. Watch for vague, hypothetical, or 'we' answers that hide the candidate's own contribution.",
  },
  technical: {
    id: "technical",
    label: "Technical",
    blurb: "Role-specific knowledge, problem solving, trade-offs.",
    guidance:
      "Ask role-appropriate technical questions. Probe reasoning and trade-offs rather than trivia. If an answer is shallow, ask 'why' or 'how would that behave under X' to test depth.",
  },
  system_design: {
    id: "system_design",
    label: "System Design",
    blurb: "Architecture, scalability, and design trade-offs.",
    guidance:
      "Present an open-ended design problem and let the candidate drive. Push on scale, failure modes, data modeling, and trade-offs. Reward structured thinking over memorized answers.",
  },
  mixed: {
    id: "mixed",
    label: "Mixed",
    blurb: "A realistic blend of behavioral and technical.",
    guidance:
      "Blend behavioral and technical questions the way a real hiring interview does. Open behavioral, move into role-specific depth, and adapt to what the candidate reveals.",
  },
};

export const LEVELS = {
  intern: { id: "intern", label: "Intern", expectation: "foundational knowledge, eagerness to learn, coachability" },
  junior: { id: "junior", label: "Junior", expectation: "solid fundamentals, guided execution, growth mindset" },
  mid: { id: "mid", label: "Mid-level", expectation: "independent delivery, sound trade-offs, some ambiguity handling" },
  senior: { id: "senior", label: "Senior", expectation: "technical leadership, systems thinking, mentoring, high ownership" },
  staff: { id: "staff", label: "Staff+", expectation: "org-level impact, deep expertise, driving ambiguity to clarity" },
};

export const PERSONAS = {
  friendly: {
    id: "friendly",
    label: "Friendly & warm",
    style:
      "Warm, encouraging, and conversational. Put the candidate at ease with light acknowledgements, but stay professional and still probe rigorously.",
  },
  neutral: {
    id: "neutral",
    label: "Professional & neutral",
    style:
      "Calm, professional, and neutral — like an experienced hiring manager. Courteous acknowledgements, no excessive praise, steady pace.",
  },
  challenging: {
    id: "challenging",
    label: "Rigorous & challenging",
    style:
      "Direct and rigorous, like a demanding senior interviewer. Politely push back on weak reasoning and pursue depth. Never rude, but does not let vague answers slide.",
  },
};

export const DEFAULTS = {
  type: "mixed",
  level: "mid",
  persona: "neutral",
  numQuestions: 6,
};

/** Clamp/normalize a raw config object coming from the client. */
export function normalizeConfig(raw = {}) {
  const type = INTERVIEW_TYPES[raw.type] ? raw.type : DEFAULTS.type;
  const level = LEVELS[raw.level] ? raw.level : DEFAULTS.level;
  const persona = PERSONAS[raw.persona] ? raw.persona : DEFAULTS.persona;
  const numQuestions = Math.min(12, Math.max(3, Number(raw.numQuestions) || DEFAULTS.numQuestions));
  return {
    candidateName: String(raw.candidateName || "").trim().slice(0, 80) || "Candidate",
    role: String(raw.role || "").trim().slice(0, 120) || "Software Engineer",
    company: String(raw.company || "").trim().slice(0, 120),
    focus: String(raw.focus || "").trim().slice(0, 400),
    type,
    level,
    persona,
    numQuestions,
  };
}
