import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncAnalyticsForProfile } from "@/lib/analytics/sync";

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
  const admin = createAdminClient();
  const { data: profiles, error } = await admin.from("socialmedia_social_accounts").select("profile_id").eq("status", "connected");
  if (error) return NextResponse.json({ ok: false, error: "Unable to discover analytics profiles." }, { status: 500 });
  const profileIds = [...new Set((profiles ?? []).map((row) => row.profile_id))];
  const results = [];
  for (const profileId of profileIds) {
    const { data: run } = await admin.from("socialmedia_analytics_sync_runs").insert({ profile_id: profileId, status: "running", started_at: new Date().toISOString() }).select("id").single();
    try {
      const result = await syncAnalyticsForProfile(profileId, run?.id);
      results.push({ profileId, ...result });
    } catch (error) {
      if (run?.id) await admin.from("socialmedia_analytics_sync_runs").update({ status: "failed", finished_at: new Date().toISOString(), error_count: 1, errors: [{ error: error instanceof Error ? error.message : "Analytics sync failed." }] }).eq("id", run.id);
      results.push({ profileId, error: error instanceof Error ? error.message : "Analytics sync failed." });
    }
  }
  return NextResponse.json({ ok: true, profiles: profileIds.length, results });
}

export async function GET(request: Request) { return POST(request); }
