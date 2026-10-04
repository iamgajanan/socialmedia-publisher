import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type WorkerType = "publish" | "oauth_health" | "notifications";

type WorkerRunResult = Record<string, unknown>;

export async function startWorkerRun(workerType: WorkerType): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("socialmedia_worker_runs")
      .insert({ worker_type: workerType, status: "running" })
      .select("id")
      .single();

    if (error) throw error;
    return data.id;
  } catch (error) {
    console.error("[ops] worker run start logging failed", error);
    return null;
  }
}

export async function finishWorkerRun(
  runId: string | null,
  status: "succeeded" | "failed",
  result: WorkerRunResult = {},
  errorMessage?: string,
) {
  if (!runId) return;

  try {
    const admin = createAdminClient();
    const { data: run } = await admin
      .from("socialmedia_worker_runs")
      .select("started_at")
      .eq("id", runId)
      .maybeSingle();

    const finishedAt = new Date();
    const startedAt = run?.started_at ? new Date(run.started_at) : finishedAt;
    const durationMs = Math.max(0, finishedAt.getTime() - startedAt.getTime());

    const { error } = await admin
      .from("socialmedia_worker_runs")
      .update({
        status,
        finished_at: finishedAt.toISOString(),
        duration_ms: durationMs,
        result,
        error_message: errorMessage?.slice(0, 1000) ?? null,
      })
      .eq("id", runId);

    if (error) throw error;
  } catch (error) {
    console.error("[ops] worker run finish logging failed", error);
  }
}
