import { NextResponse } from "next/server";
import { getRepo, toPublicSession } from "@/lib/db/store";
import { normalizeConfig } from "@/lib/interview/personas";

export const runtime = "nodejs";

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
