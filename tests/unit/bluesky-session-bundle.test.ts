import test from "node:test";
import assert from "node:assert/strict";
import { buildBlueskySessionBundles } from "../../lib/social/bluesky-session-bundle.ts";

test("Bluesky access and refresh session bundles preserve the DID", () => {
  const result = buildBlueskySessionBundles({
    accessToken: "access-token",
    refreshToken: "refresh-token",
    privateJwk: { kty: "EC", d: "private" },
    publicJwk: { kty: "EC", x: "public" },
    pdsUrl: "https://bsky.social",
    issuer: "https://bsky.social",
    did: "did:plc:example",
  });

  assert.equal(JSON.parse(result.accessTokenBundle).did, "did:plc:example");
  assert.equal(JSON.parse(result.refreshTokenBundle!).did, "did:plc:example");
  assert.equal(JSON.parse(result.accessTokenBundle).accessToken, "access-token");
  assert.equal(JSON.parse(result.refreshTokenBundle!).refreshToken, "refresh-token");
});

test("Bluesky session bundle omits refresh bundle when no refresh token is returned", () => {
  const result = buildBlueskySessionBundles({
    accessToken: "access-token",
    privateJwk: { kty: "EC", d: "private" },
    publicJwk: { kty: "EC", x: "public" },
    pdsUrl: "https://bsky.social",
    issuer: "https://bsky.social",
    did: "did:plc:example",
  });

  assert.equal(result.refreshTokenBundle, null);
});
