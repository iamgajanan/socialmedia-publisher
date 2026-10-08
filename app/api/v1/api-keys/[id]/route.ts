import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceAdmin } from "@/lib/workspace/server";

async function getUserId() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return String(data.claims.sub);
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const profileId = await getUserId();
  if (!profileId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { id } = await context.params;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("socialmedia_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("profile_id", profileId)
    .is("revoked_at", null)
    .select("id, name, token_prefix, created_at, last_used_at, revoked_at")
    .maybeSingle();

  if (error) {
    console.error("api_key_revoke_failed", { profileId, apiKeyId: id, code: error.code, message: error.message });
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
