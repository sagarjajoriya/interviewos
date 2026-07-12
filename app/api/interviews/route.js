import { NextResponse } from "next/server";
import { getRepo, toPublicSession, toSessionSummary } from "@/lib/db/store";
import { normalizeConfig } from "@/lib/interview/personas";

export const runtime = "nodejs";

/** GET /api/interviews — recent interviews (summaries, newest first). */
export async function GET() {
  const sessions = getRepo().list(50);
  return NextResponse.json({ interviews: sessions.map(toSessionSummary) });
}

/** POST /api/interviews — create a new interview session from a config. */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const config = normalizeConfig(body);
  const session = getRepo().create(config);
  return NextResponse.json(toPublicSession(session), { status: 201 });
}
