import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { approveGeneration } from "@/lib/ai/content-engine";

async function profileId() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  return claims?.claims?.sub ? String(claims.claims.sub) : null;
}

export async function GET() {
  const id = await profileId();
  if (!id) return NextResponse.json({ error: "Authentication required.", code: "authentication_required" }, { status: 401 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("socialmedia_ai_generations").select("id,master_content,brand_voice,instructions,requested_platforms,model,status,requires_approval,approved_at,approved_by,created_at,updated_at").eq("profile_id", id).eq("requires_approval", true).order("created_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: "Unable to load approval queue.", code: "approval_queue_failed" }, { status: 500 });
  const ids = (data ?? []).map((item) => item.id);
  const { data: variants, error: variantsError } = ids.length ? await admin.from("socialmedia_ai_content_variants").select("id,generation_id,platform,variation,title,caption,hashtags,cta,media_recommendations,character_count,character_limit,validation,approval_status,created_at").in("generation_id", ids).order("platform").order("variation") : { data: [], error: null };
  if (variantsError) return NextResponse.json({ error: "Unable to load approval variants.", code: "approval_variants_failed" }, { status: 500 });
  const variantMap = new Map<string, typeof variants>();
  for (const variant of variants ?? []) variantMap.set(variant.generation_id, [...(variantMap.get(variant.generation_id) ?? []), variant]);
  return NextResponse.json({ success: true, approvals: (data ?? []).map((generation) => ({ ...generation, variants: variantMap.get(generation.id) ?? [] })) });
}

export async function PATCH(request: Request) {
  const id = await profileId();
  if (!id) return NextResponse.json({ error: "Authentication required.", code: "authentication_required" }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON.", code: "invalid_json" }, { status: 400 }); }
  const generationId = typeof body.generation_id === "string" ? body.generation_id : "";
  const action = body.action === "approve" || body.action === "reject" ? body.action : "";
  if (!generationId || !action) return NextResponse.json({ error: "generation_id and action (approve or reject) are required.", code: "invalid_approval_action" }, { status: 400 });
  const admin = createAdminClient();
  if (action === "approve") {
    try {
      const generation = await approveGeneration(id, generationId, id);
      return NextResponse.json({ success: true, generation });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to approve generation.", code: "approval_failed" }, { status: 404 });
    }
  }
  const { data: current, error: currentError } = await admin.from("socialmedia_ai_generations").select("id,status,requires_approval").eq("id", generationId).eq("profile_id", id).maybeSingle();
  if (currentError) return NextResponse.json({ error: "Unable to load generation for rejection.", code: "rejection_lookup_failed" }, { status: 500 });
  if (!current || !current.requires_approval) return NextResponse.json({ error: "Generation not found or does not require approval.", code: "rejection_not_available" }, { status: 404 });
  if (current.status === "approved" || current.status === "rejected") return NextResponse.json({ error: "Generation has already been resolved.", code: "rejection_already_resolved" }, { status: 409 });

  const { data: generation, error } = await admin.from("socialmedia_ai_generations").update({ status: "rejected", updated_at: new Date().toISOString() }).eq("id", generationId).eq("profile_id", id).select("id,status,approved_at,approved_by").single();
  if (error || !generation) return NextResponse.json({ error: "Unable to reject generation.", code: "rejection_failed" }, { status: 500 });

  const { error: variantsError } = await admin.from("socialmedia_ai_content_variants").update({ approval_status: "rejected", updated_at: new Date().toISOString() }).eq("generation_id", generationId).eq("profile_id", id);
  if (variantsError) return NextResponse.json({ error: "Unable to reject generated variants.", code: "rejection_variants_failed" }, { status: 500 });
  return NextResponse.json({ success: true, generation });
}
