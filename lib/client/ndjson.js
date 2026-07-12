/**
 * POST to an NDJSON streaming endpoint and dispatch each parsed line.
 * Client-side only (uses fetch streaming).
 *
 * @param {string} url
 * @param {any} body
 * @param {(event: any) => void} onEvent  Called for every parsed JSON line.
 * @param {AbortSignal} [signal]
 */
export async function streamNDJSON(url, body, onEvent, signal) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
    signal,
  });

  if (!res.ok) {
    let message = "Request failed";
    try {
      const data = await res.json();
      message = data.error || message;
    } catch {}
    throw new Error(message);
  }
  if (!res.body) throw new Error("No response stream");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let nl;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) onEvent(JSON.parse(line));
    }
  }
  const rest = buffer.trim();
  if (rest) onEvent(JSON.parse(rest));
}
