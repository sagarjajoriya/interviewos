import { NextResponse } from "next/server";
import { getRepo, toPublicSession } from "@/lib/db/store";

export const runtime = "nodejs";

/** GET /api/interviews/:id — fetch a session (for restore / report view). */
export async function GET(_request, { params }) {
  const { id } = await params;
  const session = getRepo().get(id);
  if (!session) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }
  return NextResponse.json(toPublicSession(session));
}
