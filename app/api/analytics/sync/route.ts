import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncAnalyticsForProfile } from "@/lib/analytics/sync";

export const maxDuration = 60;

export async function POST() {
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  if (error || !claims?.claims?.sub) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const profileId = String(claims.claims.sub);
  const admin = createAdminClient();
  const startedAt = new Date().toISOString();
  const { data: run, error: runError } = await admin
    .from("socialmedia_analytics_sync_runs")
    .insert({ profile_id: profileId, status: "running", started_at: startedAt })
    .select("id")
    .single();

  if (runError || !run?.id) {
    return NextResponse.json({ ok: false, error: "Unable to start analytics sync." }, { status: 500 });
  }

  try {
    const result = await syncAnalyticsForProfile(profileId, run.id);
    return NextResponse.json({ ok: true, ...result, runId: run.id });
  } catch (syncError) {
    await admin
      .from("socialmedia_analytics_sync_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_count: 1,
        errors: [{ error: syncError instanceof Error ? syncError.message : "Analytics sync failed." }],
      })
      .eq("id", run.id);
    return NextResponse.json({ ok: false, error: syncError instanceof Error ? syncError.message : "Analytics sync failed.", runId: run.id }, { status: 500 });
  }
}
