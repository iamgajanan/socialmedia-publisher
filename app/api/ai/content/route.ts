import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generatePlatformContent } from "@/lib/ai/content-engine";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const profileId = claims?.claims?.sub ? String(claims.claims.sub) : null;
  if (!profileId) return NextResponse.json({ error: "Authentication required.", code: "authentication_required" }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON.", code: "invalid_json" }, { status: 400 }); }
  const platforms = Array.isArray(body.platforms) ? body.platforms.filter((value): value is string => typeof value === "string") : [];
  try {
    const result = await generatePlatformContent({ profileId, masterContent: typeof body.master_content === "string" ? body.master_content : "", platforms, brandVoice: typeof body.brand_voice === "string" ? body.brand_voice : "", instructions: typeof body.instructions === "string" ? body.instructions : "", variations: typeof body.variations === "number" ? body.variations : 1, requireApproval: body.require_approval === true });
    return NextResponse.json({ success: true, generation: result.generation, variants: result.variants });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "AI content generation failed.", code: "ai_content_generation_failed" }, { status: 400 });
  }
}
