# Production Readiness Runbook

## Required production configuration

Configure these as server-side Vercel Production environment variables:

- `SITE_URL`: canonical HTTPS production origin.
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SOCIAL_OAUTH_ENCRYPTION_KEY`: unique 32-byte base64 key for production.
- `CRON_SECRET`: unique random secret.
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

Configure provider credentials only for platforms that have completed their provider-side app setup:

- Meta: `META_APP_ID`, `META_APP_SECRET`, `META_GRAPH_VERSION`, profile URLs and publishing scopes.
- LinkedIn: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, publishing scopes.
- X: `X_CLIENT_ID`, `X_CLIENT_SECRET`, publishing scopes.
- YouTube: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, upload scope.
- TikTok: `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, publishing scope.

## OAuth production callback

Every provider application must register:

`https://<production-domain>/api/social/oauth/callback`

The application now refuses to silently fall back to localhost for OAuth callback construction in production.

## Deployment

The repository contains a manual GitHub Actions workflow at `.github/workflows/deploy-vercel.yml`.

Configure these GitHub Actions secrets before using it:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

The workflow runs the complete quality gate before deploying a prebuilt production artifact.

## Scheduled jobs

`vercel.json` schedules both:

- `/api/cron/publish` every minute
- `/api/cron/notifications` every minute

Both routes require `Authorization: Bearer <CRON_SECRET>`.

## Post-deployment smoke checks

1. Open `/api/health` and confirm `{"ok":true,"service":"socialmedia-publisher"}`.
2. Open `/auth/login`.
3. Confirm unauthenticated `/dashboard` redirects to login.
4. Sign in and verify dashboard/settings.
5. Verify OAuth callback URLs and connect one configured provider.
6. Create a draft and a scheduled post.
7. Verify the publishing and notification cron jobs execute.
8. Confirm Resend delivery and notification deduplication.
9. Review Vercel runtime errors after the first production traffic window.

## Final audit scope

The codebase has automated coverage for lint, TypeScript, unit tests, migration integrity, production hardening, build, production startup, and E2E smoke tests. The remaining production-only checks depend on real provider credentials, the production domain, and live Vercel environment configuration; they must not be replaced with fabricated credentials or mock production claims.
