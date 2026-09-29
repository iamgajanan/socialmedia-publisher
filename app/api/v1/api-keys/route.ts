import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { generateApiKey } from "@/lib/api/api-key-core";

const createApiKeySchema = z.object({
  name: z.string().trim().min(1).max(80),
});

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

async function getUserId() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return String(data.claims.sub);
}

export async function GET() {
  const profileId = await getUserId();
  if (!profileId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("socialmedia_api_keys")
    .select("id, name, token_prefix, created_at, last_used_at, revoked_at")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "Unable to load API keys." }, { status: 500 });

  return NextResponse.json({ apiKeys: (data ?? []).map((row) => publicKey(row as Record<string, unknown>)) });
}

export async function POST(request: Request) {
  const profileId = await getUserId();
  if (!profileId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const parsed = createApiKeySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "A key name between 1 and 80 characters is required." }, { status: 400 });
  }

  const generated = generateApiKey();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("socialmedia_api_keys")
    .insert({
      profile_id: profileId,
      name: parsed.data.name,
      token_prefix: generated.tokenPrefix,
      token_hash: generated.tokenHash,
    })
    .select("id, name, token_prefix, created_at")
    .single();

  if (error || !data) {
    console.error("api_key_create_failed", { profileId, code: error?.code, message: error?.message });
    return NextResponse.json({ error: "Unable to create API key." }, { status: 500 });
  }

  return NextResponse.json({
    apiKey: {
      ...publicKey(data as Record<string, unknown>),
      token: generated.token,
    },
    warning: "Copy this token now. Omnisocial does not store the raw token and cannot show it again.",
  }, { status: 201 });
}
