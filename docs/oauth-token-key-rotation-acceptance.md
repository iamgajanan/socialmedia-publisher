# OAuth token key-rotation acceptance

The dedicated `SOCIAL_OAUTH_ENCRYPTION_KEY` is the primary encryption key for new OAuth ciphertext. The compatibility decryptor supports existing ciphertext encrypted with the legacy service-role-derived key so existing provider sessions can be preserved during rotation.

## One-time scheduled acceptance

The one-time rotation is gated by the production-only environment variables:

- `OAUTH_TOKEN_ROTATION_ENABLED=true`
- `OAUTH_TOKEN_ROTATION_STARTED_AT=2026-10-13T17:00:00.000Z`

The existing `/api/cron/analytics` route is protected by `CRON_SECRET` and runs the acceptance once. It re-encrypts stored access/refresh tokens only for rows older than the cutoff, then performs read-only profile checks for connected accounts. It records a result in `socialmedia_worker_runs` using the existing `oauth_health` worker type and logs only counts, provider names, account IDs, and safe error codes. It never returns or logs token material and never publishes content.

The old ad-hoc `/api/ops/oauth-key-rotation-acceptance` endpoint has been removed; the temporary `OAUTH_TOKEN_ROTATION_SECRET` is disabled. After the scheduled run is verified, set `OAUTH_TOKEN_ROTATION_ENABLED=false`. Do not remove the legacy decryption fallback until all stored rows are verified to decrypt under the dedicated key and a rollback window has passed.

## Provider limitations

- X refresh responses can rotate the refresh token; the replacement must be persisted.
- LinkedIn personal-post analytics are skipped when the granted scopes do not include `r_member_postAnalytics`. Publishing can still work with `w_member_social`, but analytics metrics remain unavailable until the provider grants the analytics scope.
- Live profile smoke checks are read-only and do not publish test posts.
