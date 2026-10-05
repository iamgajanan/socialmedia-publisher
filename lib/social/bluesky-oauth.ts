import "server-only";

import { createHash, createPrivateKey, generateKeyPairSync, randomUUID, sign } from "node:crypto";

type Jwk = { kty: string; crv: string; x: string; y: string; d?: string; kid?: string; alg?: string };
type AuthMetadata = { authorization_endpoint: string; token_endpoint: string; pushed_authorization_request_endpoint?: string };

type Json = Record<string, unknown>;

function b64(value: Buffer | string) {
  return Buffer.from(value).toString("base64url");
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest();
}

function randomVerifier() {
  return b64(Buffer.from(randomUUID() + randomUUID()));
}

export function createPkce() {
  const verifier = randomVerifier();
  return { verifier, challenge: b64(sha256(verifier)) };
}

export function createDpopKey() {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const publicJwk = publicKey.export({ format: "jwk" }) as Jwk;
  const privateJwk = privateKey.export({ format: "jwk" }) as Jwk;
  const thumbprint = b64(sha256(JSON.stringify({ crv: publicJwk.crv, kty: publicJwk.kty, x: publicJwk.x, y: publicJwk.y })));
  return { publicJwk, privateJwk, thumbprint };
}

export function createDpopProof(privateJwk: Jwk, publicJwk: Jwk, method: string, url: string, accessToken?: string, nonce?: string) {
  const header = { typ: "dpop+jwt", alg: "ES256", jwk: publicJwk };
  const payload: Json = { jti: randomUUID(), htm: method.toUpperCase(), htu: new URL(url).origin + new URL(url).pathname, iat: Math.floor(Date.now() / 1000) };
  if (accessToken) payload.ath = b64(sha256(accessToken));
  if (nonce) payload.nonce = nonce;
  const encodedHeader = b64(JSON.stringify(header));
  const encodedPayload = b64(JSON.stringify(payload));
  const input = `${encodedHeader}.${encodedPayload}`;
  const key = createPrivateKey({ key: privateJwk, format: "jwk" });
  const signature = sign("sha256", Buffer.from(input), { key, dsaEncoding: "ieee-p1363" });
  return `${input}.${signature.toString("base64url")}`;
}

async function json<T extends Json>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export async function discoverBlueskyAuthServer(pdsUrl: string) {
  const resource = await fetch(`${pdsUrl.replace(/\/$/, "")}/.well-known/oauth-protected-resource`, { cache: "no-store" });
  if (!resource.ok) throw new Error("Unable to discover the Bluesky authorization server.");
  const resourceMetadata = await json<{ authorization_servers?: string[] }>(resource);
  const issuer = resourceMetadata.authorization_servers?.[0];
  if (!issuer) throw new Error("Bluesky did not return an authorization server.");
  const metadataResponse = await fetch(`${issuer}/.well-known/oauth-authorization-server`, { cache: "no-store" });
  if (!metadataResponse.ok) throw new Error("Unable to load Bluesky authorization server metadata.");
  return { issuer, metadata: await json<AuthMetadata>(metadataResponse) };
}

export async function postDpopForm(url: string, form: URLSearchParams, privateJwk: Jwk, publicJwk: Jwk, nonce?: string) {
  const send = (dpopNonce?: string) => fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", DPoP: createDpopProof(privateJwk, publicJwk, "POST", url, undefined, dpopNonce) },
    body: form,
    cache: "no-store",
  });
  let response = await send(nonce);
  if (!response.ok && response.headers.get("DPoP-Nonce")) response = await send(response.headers.get("DPoP-Nonce")!);
  return response;
}

export async function dpopFetch(url: string, accessToken: string, privateJwk: Jwk, publicJwk: Jwk, init: RequestInit = {}) {
  const send = (nonce?: string) => fetch(url, {
    ...init,
    headers: { ...(init.headers ?? {}), Accept: "application/json", Authorization: `DPoP ${accessToken}`, DPoP: createDpopProof(privateJwk, publicJwk, init.method ?? "GET", url, accessToken, nonce) },
    cache: "no-store",
  });
  let response = await send();
  if (!response.ok && response.headers.get("DPoP-Nonce")) response = await send(response.headers.get("DPoP-Nonce")!);
  return response;
}

export function parseJwk(value: string) { return JSON.parse(value) as Jwk; }
export function serializeJwk(value: Jwk) { return JSON.stringify(value); }
