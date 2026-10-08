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
  const runId: string | undefined = undefined;

  // The analytics sync table was introduced after the provider snapshot tables.
  // Keep syncing functional for legacy production databases where that migration
  // has not been applied yet; sync health is optional metadata, not a prerequisite.
  const { data: run } = await admin
    .from("socialmedia_analytics_sync_runs")
    .insert({ profile_id: profileId, status: "running", started_at: new Date().toISOString() })
    .select("id")
    .maybeSingle();
  const effectiveRunId = run?.id ?? runId;

  try {
    const result = await syncAnalyticsForProfile(profileId, effectiveRunId);
    return NextResponse.json({ ok: true, ...result, ...(effectiveRunId ? { runId: effectiveRunId } : {}) });
  } catch (syncError) {
    if (effectiveRunId) {
      await admin
        .from("socialmedia_analytics_sync_runs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          error_count: 1,
          errors: [{ error: syncError instanceof Error ? syncError.message : "Analytics sync failed." }],
        })
        .eq("id", effectiveRunId);
    }
    return NextResponse.json({ ok: false, error: syncError instanceof Error ? syncError.message : "Analytics sync failed.", ...(runId ? { runId } : {}) }, { status: 500 });
  }
}
