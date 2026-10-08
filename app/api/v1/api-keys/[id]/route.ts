import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceAdmin } from "@/lib/workspace/server";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const workspaceContext = await requireWorkspaceAdmin();
  const { id } = await context.params;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("socialmedia_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", workspaceContext.workspace.id)
    .is("revoked_at", null)
    .select("id, name, token_prefix, created_at, last_used_at, revoked_at")
    .maybeSingle();

  if (error) {
    console.error("api_key_revoke_failed", { profileId: workspaceContext.profileId, workspaceId: workspaceContext.workspace.id, apiKeyId: id, code: error.code, message: error.message });
    return NextResponse.json({ error: "Unable to revoke API key." }, { status: 500 });
  }

  if (!data) return NextResponse.json({ error: "API key not found or already revoked." }, { status: 404 });

  return NextResponse.json({
    apiKey: {
      id: String(data.id),
      name: String(data.name),
      tokenPrefix: String(data.token_prefix),
      createdAt: String(data.created_at),
      lastUsedAt: typeof data.last_used_at === "string" ? data.last_used_at : null,
      revokedAt: String(data.revoked_at),
    },
  });
}
