import { getRepo } from "@/lib/db/store";
import { streamInterviewerTurn } from "@/lib/interview/engine";

export const runtime = "nodejs";

/**
 * POST /api/interviews/:id/turn
 *
 * Body: { message?: string }
 *   - Omit `message` for the very first (opening) turn.
 *   - Otherwise `message` is the candidate's answer.
 *
 * Streams the interviewer's reply as NDJSON:
 *   { "type": "chunk", "text": "..." }         (repeated)
 *   { "type": "done", "ended": bool, "status": "active"|"completed" }
 *   { "type": "error", "message": "..." }
 */
export async function POST(request, { params }) {
  const { id } = await params;
  const repo = getRepo();
  const session = repo.get(id);

  if (!session) {
    return json({ error: "Interview not found" }, 404);
  }
  if (session.status === "completed") {
    return json({ error: "Interview already completed" }, 409);
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    // no body is valid for the opening turn
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const isOpening = session.history.length === 0;

  if (!isOpening && !message) {
    return json({ error: "Message is required" }, 400);
  }
  if (message.length > 5000) {
    return json({ error: "Message too long" }, 400);
  }

  // Record the candidate's answer before generating the interviewer's reply.
  if (message) {
    repo.appendTurn(id, "candidate", message);
  }

  const encoder = new TextEncoder();
  const config = session.config;
  const history = session.history;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        const gen = streamInterviewerTurn(config, history);
        let result = { text: "", ended: false };
        while (true) {
          const { value, done } = await gen.next();
          if (done) {
            result = value;
            break;
          }
          send({ type: "chunk", text: value });
        }

        // Persist the interviewer's completed turn.
        repo.appendTurn(id, "interviewer", result.text);
        if (result.ended) {
          repo.setStatus(id, "completed");
        }
        send({ type: "done", ended: result.ended, status: result.ended ? "completed" : "active" });
      } catch (err) {
        console.error("[turn] generation error:", err);
        const status = err?.status ?? err?.code;
        const message =
          status === 429
            ? "Rate limit reached on the AI provider (free-tier quota). Wait a minute and try again — if it keeps happening, today's quota for this model is used up."
            : status === 401 || status === 403
              ? "The AI provider rejected the API key. Check GEMINI_API_KEY in .env.local and restart the server."
              : "The interviewer had trouble responding. Please try again.";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
