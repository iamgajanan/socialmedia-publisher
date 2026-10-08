import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api/api-auth";
import { generatePlatformContent } from "@/lib/ai/content-engine";
import { createAdminClient } from "@/lib/supabase/admin";

function json(body: unknown, status: number, requestId: string) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } }); }

export async function POST(request: Request) {
  const requestId = randomUUID();
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return json({ error: auth.error, code: "authentication_failed" }, auth.status, requestId);
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "Request body must be valid JSON.", code: "invalid_json" }, 400, requestId); }
  const input = body as Record<string, unknown>;
  const platforms = Array.isArray(input.platforms) ? input.platforms.filter((value): value is string => typeof value === "string") : [];
  try {
    const result = await generatePlatformContent({ profileId: auth.profileId, masterContent: typeof input.master_content === "string" ? input.master_content : "", platforms, brandVoice: typeof input.brand_voice === "string" ? input.brand_voice : "", instructions: typeof input.instructions === "string" ? input.instructions : "", variations: typeof input.variations === "number" ? input.variations : 1, requireApproval: input.require_approval === true });
    return json({ success: true, generation: result.generation, variants: result.variants }, 200, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI content generation failed.";
    return json({ error: message, code: "ai_content_generation_failed" }, 400, requestId);
  }
}

export async function GET(request: Request) {
  const requestId = randomUUID();
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return json({ error: auth.error, code: "authentication_failed" }, auth.status, requestId);
  const limit = Math.min(50, Math.max(1, Number(new URL(request.url).searchParams.get("limit") ?? "20")));
  const admin = createAdminClient();
  const { data, error } = await admin.from("socialmedia_ai_generations").select("id,master_content,requested_platforms,model,status,requires_approval,approved_at,created_at").eq("profile_id", auth.profileId).eq("workspace_id", auth.workspaceId).order("created_at", { ascending: false }).limit(limit);
  if (error) return json({ error: "Unable to load AI content history.", code: "ai_history_failed" }, 500, requestId);
  return json({ success: true, generations: data ?? [] }, 200, requestId);
}
