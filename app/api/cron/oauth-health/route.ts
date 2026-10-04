import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runFacebookOAuthHealthChecks } from "@/lib/social/oauth-health";
import { finishWorkerRun, startWorkerRun } from "@/lib/ops/worker-runs";

export const maxDuration = 60;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const runId = await startWorkerRun("oauth_health");
  try {
    const result = await runFacebookOAuthHealthChecks();
    await finishWorkerRun(runId, "succeeded", result);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "OAuth health worker failed.";
    console.error("cron_oauth_health_failed", message);
    await finishWorkerRun(runId, "failed", {}, message);
    return NextResponse.json(
      { ok: false, error: "OAuth health worker failed." },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return POST(request);
}
