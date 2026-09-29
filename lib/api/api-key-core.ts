import { createHash, randomBytes } from "node:crypto";

const API_KEY_PREFIX = "omi_live_";
const API_KEY_RANDOM_BYTES = 32;

export type ApiKeyRecord = {
  id: string;
  profileId: string;
  name: string;
  tokenPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export function generateApiKey(): { token: string; tokenPrefix: string; tokenHash: string } {
  const randomPart = randomBytes(API_KEY_RANDOM_BYTES).toString("base64url");
  const token = API_KEY_PREFIX + randomPart;
  return {
    token,
    tokenPrefix: token.slice(0, API_KEY_PREFIX.length + 8),
    tokenHash: hashApiKey(token),
  };
}

export function hashApiKey(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function normalizeApiKey(value: string): string {
  return value.trim();
}

export function isApiKey(value: string): boolean {
  return value.startsWith(API_KEY_PREFIX) && value.length > API_KEY_PREFIX.length + 20;
}
