import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runWebhookWorker } from "@/lib/webhooks/worker";
import { finishWorkerRun, startWorkerRun } from "@/lib/ops/worker-runs";

export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const runId = await startWorkerRun("webhooks");
  try {
    const result = await runWebhookWorker();
    await finishWorkerRun(runId, "succeeded", result);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook worker failed.";
    await finishWorkerRun(runId, "failed", {}, message);
    return NextResponse.json({ ok: false, error: "Webhook worker failed." }, { status: 500 });
  }
}

export async function GET(request: Request) { return POST(request); }
