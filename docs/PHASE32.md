# Phase 32 — White-Label SaaS / Multi-Tenant Infrastructure

Phase 32 completes the tenant-aware SaaS foundation on top of the existing workspace/team and Stripe billing architecture.

## Delivered

- Workspace switching for users who belong to multiple workspaces.
- Workspace-isolated branding: name, logo URL, primary colour, accent colour, and custom-domain reservation.
- Tenant ownership columns for AI generations, AI variants, MCP audit logs, and API keys.
- Workspace-scoped API key management for workspace admins.
- API authentication now resolves both the calling profile and workspace.
- Accounts and posts API reads are workspace-scoped.
- AI history is workspace-scoped.
- MCP audit records include the workspace tenant.
- Monthly workspace usage foundation for posts created, posts published, AI generations, and authenticated API requests.
- Workspace usage dashboard with plan capacity for team members and connected social accounts.
- Existing workspace/team/billing flows remain the source of truth for membership, roles, plans, and Stripe subscription state.

## White-label model

Branding is stored on socialmedia_workspaces, so the same user can switch between memberships without leaking identity or branding across tenants.

Custom-domain storage is intentionally only the identity/configuration layer in this phase. DNS verification, certificate provisioning, and host-based request routing remain a later infrastructure step.

## Tenant boundary

The API key contains no raw provider credentials. A valid key resolves to the calling profile, workspace tenant, and API key identity. Tenant-owned resources must use the resolved workspace id in addition to existing profile/audit ownership fields.

## Usage

The usage dashboard reads the current calendar month in UTC. API request usage is incremented only after authentication and rate-limit checks succeed.

Publishing, connected-account, and team limits continue to use the existing plan enforcement paths. The Phase 32 usage dashboard makes those limits visible without duplicating the enforcement logic.

## Verification

Automated CI should run lint, typecheck, unit tests, integration tests, build, production server checks, and e2e smoke tests.

Manual acceptance should cover workspace switching, tenant isolation, branding persistence, usage counters, workspace API keys, and existing billing/social publishing regressions.
