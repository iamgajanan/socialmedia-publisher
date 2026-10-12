import { NextResponse } from "next/server";

import { approveGeneration } from "@/lib/ai/content-engine";
import { createAdminClient } from "@/lib/supabase/admin";
import { getApiWorkspaceContext } from "@/lib/workspace/api-context";

export async function GET() {
  const context = await getApiWorkspaceContext();
  if (!context.ok) {
    return NextResponse.json(
      { error: context.error, code: context.status === 401 ? "authentication_required" : context.status === 403 ? "workspace_access_denied" : "workspace_context_unavailable" },
      { status: context.status },
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("socialmedia_ai_generations")
    .select("id,master_content,brand_voice,instructions,requested_platforms,model,status,requires_approval,approved_at,approved_by,created_at,updated_at")
    .eq("profile_id", context.profileId)
    .eq("workspace_id", context.workspaceId)
    .eq("requires_approval", true)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("ai_approval_queue_lookup_failed", { profileId: context.profileId, workspaceId: context.workspaceId, code: error.code, message: error.message });
    return NextResponse.json({ error: "Unable to load approval queue.", code: "approval_queue_failed" }, { status: 500 });
  }

  const ids = (data ?? []).map((item) => item.id);
  const { data: variants, error: variantsError } = ids.length
    ? await admin
        .from("socialmedia_ai_content_variants")
        .select("id,generation_id,platform,variation,title,caption,hashtags,cta,media_recommendations,character_count,character_limit,validation,approval_status,created_at")
        .in("generation_id", ids)
        .eq("profile_id", context.profileId)
        .eq("workspace_id", context.workspaceId)
        .order("platform")
        .order("variation")
    : { data: [], error: null };

  if (variantsError) {
    console.error("ai_approval_variants_lookup_failed", { profileId: context.profileId, workspaceId: context.workspaceId, code: variantsError.code, message: variantsError.message });
    return NextResponse.json({ error: "Unable to load approval variants.", code: "approval_variants_failed" }, { status: 500 });
  }

  const variantMap = new Map<string, typeof variants>();
  for (const variant of variants ?? []) {
    variantMap.set(variant.generation_id, [...(variantMap.get(variant.generation_id) ?? []), variant]);
  }

  return NextResponse.json({
    success: true,
    approvals: (data ?? []).map((generation) => ({
      ...generation,
      variants: variantMap.get(generation.id) ?? [],
    })),
  });
}

export async function PATCH(request: Request) {
  const context = await getApiWorkspaceContext();
  if (!context.ok) {
    return NextResponse.json(
      { error: context.error, code: context.status === 401 ? "authentication_required" : context.status === 403 ? "workspace_access_denied" : "workspace_context_unavailable" },
      { status: context.status },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON.", code: "invalid_json" }, { status: 400 });
  }

  const generationId = typeof body.generation_id === "string" ? body.generation_id : "";
  const action = body.action === "approve" || body.action === "reject" ? body.action : "";
  if (!generationId || !action) {
    return NextResponse.json({ error: "generation_id and action (approve or reject) are required.", code: "invalid_approval_action" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (action === "approve") {
    try {
      const generation = await approveGeneration(context.profileId, context.workspaceId, generationId, context.profileId);
      return NextResponse.json({ success: true, generation });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to approve generation.", code: "approval_failed" }, { status: 404 });
    }
  }

  const { data: current, error: currentError } = await admin
    .from("socialmedia_ai_generations")
    .select("id,status,requires_approval")
    .eq("id", generationId)
    .eq("profile_id", context.profileId)
    .eq("workspace_id", context.workspaceId)
    .maybeSingle();

  if (currentError) {
    console.error("ai_generation_rejection_lookup_failed", { profileId: context.profileId, workspaceId: context.workspaceId, code: currentError.code, message: currentError.message });
    return NextResponse.json({ error: "Unable to load generation for rejection.", code: "rejection_lookup_failed" }, { status: 500 });
  }

  if (!current || !current.requires_approval) {
    return NextResponse.json({ error: "Generation not found or does not require approval.", code: "rejection_not_available" }, { status: 404 });
  }

  if (current.status === "approved" || current.status === "rejected") {
    return NextResponse.json({ error: "Generation has already been resolved.", code: "rejection_already_resolved" }, { status: 409 });
  }

  const { data: generation, error } = await admin
    .from("socialmedia_ai_generations")
    .update({ status: "rejected", updated_at: new Date().toISOString() })
    .eq("id", generationId)
    .eq("profile_id", context.profileId)
    .eq("workspace_id", context.workspaceId)
    .select("id,status,approved_at,approved_by")
    .maybeSingle();

  if (error) {
    console.error("ai_generation_rejection_failed", { profileId: context.profileId, workspaceId: context.workspaceId, code: error.code, message: error.message });
    return NextResponse.json({ error: "Unable to reject generation.", code: "rejection_failed" }, { status: 500 });
  }

  if (!generation) {
    return NextResponse.json({ error: "Generation not found in the current workspace.", code: "generation_not_found" }, { status: 404 });
  }

  const { error: variantsError } = await admin
    .from("socialmedia_ai_content_variants")
    .update({ approval_status: "rejected", updated_at: new Date().toISOString() })
    .eq("generation_id", generationId)
    .eq("profile_id", context.profileId)
    .eq("workspace_id", context.workspaceId);

  if (variantsError) {
    console.error("ai_generation_rejection_variants_failed", { profileId: context.profileId, workspaceId: context.workspaceId, code: variantsError.code, message: variantsError.message });
    return NextResponse.json({ error: "Unable to reject generated variants.", code: "rejection_variants_failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true, generation });
}
