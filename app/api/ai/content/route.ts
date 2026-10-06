import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generatePlatformContent } from "@/lib/ai/content-engine";
import { createAdminClient } from "@/lib/supabase/admin";

async function profileId() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  return claims?.claims?.sub ? String(claims.claims.sub) : null;
}

export async function POST(request: Request) {
  const id = await profileId();
  if (!id) return NextResponse.json({ error: "Authentication required.", code: "authentication_required" }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON.", code: "invalid_json" }, { status: 400 }); }
  const platforms = Array.isArray(body.platforms) ? body.platforms.filter((value): value is string => typeof value === "string") : [];
  try {
    const result = await generatePlatformContent({ profileId: id, masterContent: typeof body.master_content === "string" ? body.master_content : "", platforms, brandVoice: typeof body.brand_voice === "string" ? body.brand_voice : "", instructions: typeof body.instructions === "string" ? body.instructions : "", variations: typeof body.variations === "number" ? body.variations : 1, requireApproval: body.require_approval === true });
    return NextResponse.json({ success: true, generation: result.generation, variants: result.variants });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "AI content generation failed.", code: "ai_content_generation_failed" }, { status: 400 });
  }
}

export async function GET() {
  const id = await profileId();
  if (!id) return NextResponse.json({ error: "Authentication required.", code: "authentication_required" }, { status: 401 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("socialmedia_ai_generations").select("id,master_content,requested_platforms,model,status,requires_approval,approved_at,created_at").eq("profile_id", id).order("created_at", { ascending: false }).limit(20);
  if (error) return NextResponse.json({ error: "Unable to load AI history.", code: "ai_history_failed" }, { status: 500 });
  return NextResponse.json({ success: true, generations: data ?? [] });
}
