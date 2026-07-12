import { GoogleGenAI } from "@google/genai";
import { BaseLLMProvider, parseJSONLoose } from "./provider.js";

/**
 * Google Gemini adapter (default: Gemini Flash).
 *
 * Maps the vendor-neutral ChatMessage[] onto Gemini's `contents` format and
 * exposes streaming, single-shot, and JSON-mode calls.
 */
export class GeminiProvider extends BaseLLMProvider {
  name = "gemini";

  /**
   * @param {Object} opts
   * @param {string} opts.apiKey
   * @param {string} [opts.model]
   */
  constructor({ apiKey, model }) {
    super();
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    this.model = model || "gemini-3.5-flash";
    this.client = new GoogleGenAI({ apiKey });
  }

  /** @param {import("./provider.js").ChatMessage[]} messages */
  #toContents(messages) {
    return messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
  }

  /** @param {import("./provider.js").ChatRequest} req */
  #config(req, extra = {}) {
    return {
      ...(req.system ? { systemInstruction: req.system } : {}),
      temperature: req.temperature ?? 0.7,
      ...(req.maxTokens ? { maxOutputTokens: req.maxTokens } : {}),
      ...extra,
    };
  }

  /** @param {import("./provider.js").ChatRequest} req */
  async *streamChat(req) {
    const stream = await this.client.models.generateContentStream({
      model: this.model,
      contents: this.#toContents(req.messages),
      config: this.#config(req),
    });
    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) yield text;
    }
  }

  /** @param {import("./provider.js").ChatRequest} req */
  async generateJSON(req) {
    const res = await this.client.models.generateContent({
      model: this.model,
      contents: this.#toContents(req.messages),
      config: this.#config(req, {
        temperature: req.temperature ?? 0.3,
        responseMimeType: "application/json",
      }),
    });
    return parseJSONLoose(res.text);
  }
}
