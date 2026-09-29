# Omnisocial Security Model

## API identity
API keys are hashed with SHA-256 and scoped to an Omnisocial profile. Authentication resolves the profile from the key; callers do not supply a profile ID to select a different owner's accounts.

## Secret handling
Provider access and refresh tokens are stored server-side in encrypted secret storage. API account responses expose account metadata, not provider tokens.

## Authorization boundary
API account and post operations are profile-scoped. Media paths must begin with the authenticated profile ID and path traversal using `..` is rejected.

## Request protection
Publish requests have a 1 MB JSON body limit, idempotency-key validation, fixed-window per-key rate limiting, no-store responses, and request IDs. Media uploads have a 100 MB limit.

## Publishing safety
Draft and scheduled posts have explicit management rules. Scheduled cancellation preserves destination history. Publishing workers exclude cancelled posts from retry processing.

## Production checklist
- Keep API keys only in secret/credential storage.
- Revoke exposed keys immediately.
- Do not log provider tokens or API keys.
- Review connected-account ownership before any publish operation.
- Keep Supabase service-role credentials server-side only.
- Verify CI and production deployment before release.
