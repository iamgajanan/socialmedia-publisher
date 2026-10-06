import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncAnalyticsForProfile } from "@/lib/analytics/sync";

export const maxDuration = 60;

export async function POST() {
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  if (error || !claims?.claims?.sub) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  try {
    const result = await syncAnalyticsForProfile(String(claims.claims.sub));
    return NextResponse.json({ ok: true, ...result });
  } catch (syncError) {
    return NextResponse.json({ ok: false, error: syncError instanceof Error ? syncError.message : "Analytics sync failed." }, { status: 500 });
  }
}
