import { NextResponse } from "next/server";
import { runReminders } from "@/lib/reminders";

// Triggered on a schedule (Vercel Cron, GitHub Actions, cron-job.org, etc.).
// Protect it with the CRON_SECRET so only your scheduler can run it.
//
// Call as:  GET /api/cron/reminders?secret=YOUR_CRON_SECRET
//      or:  with header  Authorization: Bearer YOUR_CRON_SECRET
export async function GET(req: Request) {
  const url = new URL(req.url);
  const provided =
    url.searchParams.get("secret") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  const expected = process.env.CRON_SECRET;
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const summary = await runReminders();
  return NextResponse.json({ ok: true, ...summary });
}
