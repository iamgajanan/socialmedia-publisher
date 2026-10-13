export type BlueskySessionBundleInput = {
  accessToken: string;
  refreshToken?: string;
  privateJwk: object;
  publicJwk: object;
  pdsUrl: string;
  issuer: string;
  did: string;
};

export function buildBlueskySessionBundles(input: BlueskySessionBundleInput) {
  const common = {
    privateJwk: input.privateJwk,
    publicJwk: input.publicJwk,
    pdsUrl: input.pdsUrl,
    issuer: input.issuer,
    did: input.did,
  };

  return {
    accessTokenBundle: JSON.stringify({ accessToken: input.accessToken, ...common }),
    refreshTokenBundle: input.refreshToken
      ? JSON.stringify({ refreshToken: input.refreshToken, ...common })
      : null,
  };
}
