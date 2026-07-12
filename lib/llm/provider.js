/**
 * LLM Provider contract.
 *
 * Every provider (Gemini, Groq, OpenAI, local, ...) implements this shape.
 * The rest of the app depends ONLY on this interface — never on a vendor SDK —
 * so switching providers is a matter of adding one adapter file and flipping
 * the `LLM_PROVIDER` env var.
 *
 * Message shape (vendor-neutral):
 *   { role: "user" | "assistant", content: string }
 *
 * @typedef {Object} ChatMessage
 * @property {"user"|"assistant"} role
 * @property {string} content
 *
 * @typedef {Object} ChatRequest
 * @property {string} [system]           System / persona instruction.
 * @property {ChatMessage[]} messages    Conversation so far.
 * @property {number} [temperature]      Sampling temperature (0-1).
 * @property {number} [maxTokens]        Max output tokens.
 *
 * @typedef {Object} LLMProvider
 * @property {string} name
 * @property {(req: ChatRequest) => Promise<string>} chat
 *           Returns the full assistant message as a string.
 * @property {(req: ChatRequest) => AsyncIterable<string>} streamChat
 *           Yields incremental text chunks as they are generated.
 * @property {(req: ChatRequest) => Promise<any>} generateJSON
 *           Forces a JSON response and returns the parsed object. The desired
 *           shape must be described in the prompt (portable across vendors).
 */

/**
 * Base class providers can extend. `chat` is derived from `streamChat` so an
 * adapter only strictly needs to implement streaming + JSON.
 */
export class BaseLLMProvider {
  /** @type {string} */
  name = "base";

  /** @param {import("./provider.js").ChatRequest} _req @returns {AsyncIterable<string>} */
  // eslint-disable-next-line require-yield
  async *streamChat(_req) {
    throw new Error(`${this.name}: streamChat() not implemented`);
  }

  /** @param {import("./provider.js").ChatRequest} req @returns {Promise<string>} */
  async chat(req) {
    let out = "";
    for await (const chunk of this.streamChat(req)) out += chunk;
    return out;
  }

  /** @param {import("./provider.js").ChatRequest} _req @returns {Promise<any>} */
  async generateJSON(_req) {
    throw new Error(`${this.name}: generateJSON() not implemented`);
  }
}

/**
 * Best-effort extraction of a JSON object from a model response that may be
 * wrapped in prose or ```json fences. Providers that support native JSON mode
 * should prefer that; this is the portable fallback.
 * @param {string} text
 */
export function parseJSONLoose(text) {
  if (!text) throw new Error("Empty response, expected JSON");
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // strip code fences
    const fenced = trimmed.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    try {
      return JSON.parse(fenced);
    } catch {
      // grab the outermost {...}
      const start = fenced.indexOf("{");
      const end = fenced.lastIndexOf("}");
      if (start !== -1 && end > start) {
        return JSON.parse(fenced.slice(start, end + 1));
      }
      throw new Error("Could not parse JSON from model response");
    }
  }
}
