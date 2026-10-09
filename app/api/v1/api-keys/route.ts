import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceAdmin } from "@/lib/workspace/server";
import { generateApiKey } from "@/lib/api/api-key-core";

const createApiKeySchema = z.object({
  name: z.string().trim().min(1).max(80),
});

function isMissingWorkspaceColumn(error: { code?: string; message?: string } | null | undefined) {
  return Boolean(error && (error.code === "PGRST204" || error.code === "42703") && /workspace_id/i.test(error.message ?? ""));
}

function publicKey(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    name: String(row.name),
    tokenPrefix: String(row.token_prefix),
    createdAt: String(row.created_at),
    lastUsedAt: typeof row.last_used_at === "string" ? row.last_used_at : null,
    revokedAt: typeof row.revoked_at === "string" ? row.revoked_at : null,
  };
}

export async function GET() {
  const context = await requireWorkspaceAdmin();
  const admin = createAdminClient();
  const workspaceQuery = await admin
    .from("socialmedia_api_keys")
    .select("id, name, token_prefix, created_at, last_used_at, revoked_at")
    .eq("workspace_id", context.workspace.id)
    .order("created_at", { ascending: false });

  if (!workspaceQuery.error) {
    return NextResponse.json({ apiKeys: (workspaceQuery.data ?? []).map((row) => publicKey(row as Record<string, unknown>)) });
  }

  // Phase 32's workspace_id migration may not have reached the connected production database yet.
  // The legacy schema scopes keys to profile_id, so only show keys owned by this signed-in profile.
  if (isMissingWorkspaceColumn(workspaceQuery.error)) {
    const legacyQuery = await admin
      .from("socialmedia_api_keys")
      .select("id, name, token_prefix, created_at, last_used_at, revoked_at")
      .eq("profile_id", context.profileId)
      .order("created_at", { ascending: false });
    if (!legacyQuery.error) {
      return NextResponse.json({ apiKeys: (legacyQuery.data ?? []).map((row) => publicKey(row as Record<string, unknown>)) });
    }
  }

  console.error("api_key_list_failed", { profileId: context.profileId, workspaceId: context.workspace.id, code: workspaceQuery.error.code, message: workspaceQuery.error.message });
  return NextResponse.json({ error: "Unable to load API keys. Please verify the API-key database migration." }, { status: 500 });
}

export async function POST(request: Request) {
  const context = await requireWorkspaceAdmin();

  const parsed = createApiKeySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "A key name between 1 and 80 characters is required." }, { status: 400 });
  }

  const generated = generateApiKey();
  const admin = createAdminClient();
  const values = {
    profile_id: context.profileId,
    workspace_id: context.workspace.id,
    name: parsed.data.name,
    token_prefix: generated.tokenPrefix,
    token_hash: generated.tokenHash,
  };

  let { data, error } = await admin
    .from("socialmedia_api_keys")
    .insert(values)
    .select("id, name, token_prefix, created_at")
    .single();

  // Keep key creation working against the pre-Phase-32 schema. In that schema,
  // API keys are profile-scoped; never broaden the fallback to another profile.
  if (isMissingWorkspaceColumn(error)) {
    const legacyResult = await admin
      .from("socialmedia_api_keys")
      .insert({
        profile_id: context.profileId,
        name: parsed.data.name,
        token_prefix: generated.tokenPrefix,
        token_hash: generated.tokenHash,
      })
      .select("id, name, token_prefix, created_at")
      .single();
    data = legacyResult.data;
    error = legacyResult.error;
  }

  if (error || !data) {
    console.error("api_key_create_failed", { profileId: context.profileId, workspaceId: context.workspace.id, code: error?.code, message: error?.message });
    return NextResponse.json({ error: "Unable to create API key. Please verify the API-key database migration." }, { status: 500 });
  }

  return NextResponse.json({
    apiKey: {
      ...publicKey(data as Record<string, unknown>),
      token: generated.token,
    },
    warning: "Copy this token now. Omnisocial does not store the raw token and cannot show it again.",
  }, { status: 201 });
}
