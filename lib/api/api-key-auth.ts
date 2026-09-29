import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { hashApiKey, isApiKey, normalizeApiKey, type ApiKeyRecord } from "@/lib/api/api-key-core";

type ApiKeyAuthResult = {
  profileId: string;
  apiKey: ApiKeyRecord;
};

function mapRecord(row: Record<string, unknown>): ApiKeyRecord {
  return {
    id: String(row.id),
    profileId: String(row.profile_id),
    name: String(row.name),
    tokenPrefix: String(row.token_prefix),
    createdAt: String(row.created_at),
    lastUsedAt: typeof row.last_used_at === "string" ? row.last_used_at : null,
    revokedAt: typeof row.revoked_at === "string" ? row.revoked_at : null,
  };
}

export async function resolveApiKey(rawToken: string): Promise<ApiKeyAuthResult | null> {
  const token = normalizeApiKey(rawToken);
  if (!isApiKey(token)) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("socialmedia_api_keys")
    .select("id, profile_id, name, token_prefix, created_at, last_used_at, revoked_at")
    .eq("token_hash", hashApiKey(token))
    .is("revoked_at", null)
    .maybeSingle();

  if (error || !data) return null;

  const apiKey = mapRecord(data as Record<string, unknown>);
  await admin
    .from("socialmedia_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", apiKey.id)
    .is("revoked_at", null);

  return { profileId: apiKey.profileId, apiKey };
}

export function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization) return null;

  const [scheme, value] = authorization.trim().split(/\s+/, 2);
  if (!scheme || scheme.toLowerCase() !== "bearer" || !value) return null;

  return value.trim() || null;
}

export async function authenticateApiRequest(request: Request): Promise<ApiKeyAuthResult | null> {
  const token = getBearerToken(request);
  if (!token) return null;
  return resolveApiKey(token);
}
