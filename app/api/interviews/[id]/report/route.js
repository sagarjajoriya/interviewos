import { NextResponse } from "next/server";
import { getRepo } from "@/lib/db/store";
import { generateReport } from "@/lib/interview/engine";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/interviews/:id/report — generate (or return cached) evaluation.
 * Requires at least one full exchange to produce something meaningful.
 */
export async function POST(_request, { params }) {
  const { id } = await params;
  const repo = getRepo();
  const session = repo.get(id);

  if (!session) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }
  if (session.report) {
    return NextResponse.json({ report: session.report, cached: true });
  }

  const answers = session.history.filter((t) => t.role === "candidate").length;
  if (answers === 0) {
    return NextResponse.json(
      { error: "Not enough of the interview has happened to evaluate yet." },
      { status: 400 }
    );
  }

  try {
    const report = await generateReport(session.config, session.history);
    repo.setReport(id, report);
    return NextResponse.json({ report, cached: false });
  } catch (err) {
    console.error("[report] generation error:", err);
    return NextResponse.json(
      { error: "Could not generate the report. Please try again." },
      { status: 502 }
    );
  }
}
