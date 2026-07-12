import { GeminiProvider } from "./gemini.js";

/**
 * Provider registry. To add a new vendor (Groq, OpenAI, Ollama, ...):
 *   1. Create lib/llm/<vendor>.js implementing the BaseLLMProvider contract.
 *   2. Register a factory here.
 *   3. Set LLM_PROVIDER=<vendor> in the environment.
 * No application code changes required.
 *
 * @type {Record<string, () => import("./provider.js").LLMProvider>}
 */
const REGISTRY = {
  gemini: () =>
    new GeminiProvider({
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.LLM_MODEL,
    }),
  // groq: () => new GroqProvider({ apiKey: process.env.GROQ_API_KEY, model: process.env.LLM_MODEL }),
};

/** @type {import("./provider.js").LLMProvider | null} */
let cached = null;

/**
 * Returns the configured LLM provider (singleton per server process).
 * @returns {import("./provider.js").LLMProvider}
 */
export function getLLM() {
  if (cached) return cached;
  const key = (process.env.LLM_PROVIDER || "gemini").toLowerCase();
  const factory = REGISTRY[key];
  if (!factory) {
    throw new Error(
      `Unknown LLM_PROVIDER "${key}". Available: ${Object.keys(REGISTRY).join(", ")}`
    );
  }
  cached = factory();
  return cached;
}
