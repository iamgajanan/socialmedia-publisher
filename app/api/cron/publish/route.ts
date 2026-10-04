import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runPublishingWorker } from "@/lib/publishing/worker";

export const maxDuration = 300;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const actual = Buffer.from(header);
  const target = Buffer.from(expected);
  return actual.length === target.length && timingSafeEqual(actual, target);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  try {
    const result = await runPublishingWorker();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("cron_publish_worker_failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "Publishing worker failed." }, { status: 500 });
  }
}
export async function GET(request: Request) { return POST(request); }
