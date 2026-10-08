# Omnisocial API

Production base URL: https://socialmedia-publisher-gules.vercel.app

## Authentication

All API endpoints use a workspace-scoped Bearer API key. Each key is also tied to the profile that created it for auditability.

    Authorization: Bearer $API_KEY

The API key resolves both the calling profile and its active workspace. Tenant-owned resources are filtered by workspace so one workspace cannot read another workspace's publishing data. Provider OAuth tokens are never returned. Keep API keys server-side and store them in an automation platform's secret/credential storage.

Every `/api/v1/*` response includes `X-Request-Id`. Supply an `X-Request-Id` header when you need to correlate an automation request with server logs; otherwise OmniSocial generates one.

## Supported platforms

Accounts: facebook, instagram, threads, linkedin, x, youtube, tiktok.
Publishing: facebook, instagram, threads, linkedin, youtube, tiktok.

## Endpoints

### GET /api/v1/accounts

Lists connected accounts available to the authenticated workspace. Optional query: platforms=instagram,facebook.

### POST /api/v1/media

Uploads one image/video using multipart/form-data. Field name: file. Maximum upload: 100 MB. Use the returned `media_path` when publishing.

### POST /api/v1/publish

Creates an immediate publish or a future scheduled post. Immediate requests omit `scheduled_at`; scheduled requests must use a future timestamp. Existing worker behavior remains the single publishing path.

Rules: platforms 1–6 unique values; text max 5,000 characters; media_paths max 20; at least text or one media file; scheduled_at must be future when supplied. Media must belong to the authenticated profile and platform/media capability rules are validated.

### GET /api/v1/posts

Lists workspace-owned posts. Query parameters: status, platform, from, to, limit (1–50, default 20), offset (0–10000, default 0).

### GET /api/v1/posts/{postId}

Returns one workspace-owned post and destination publishing results.

### PATCH /api/v1/posts/{postId}

Only draft and scheduled posts are editable. Fields: content, media_paths, scheduled_at.

### DELETE /api/v1/posts/{postId}

Draft posts are deleted; scheduled posts are cancelled. Posts already publishing cannot be cancelled.

## Phase 29 analytics

### GET /api/v1/analytics/overview
### GET /api/v1/analytics/posts
### GET /api/v1/analytics/accounts
### GET /api/v1/analytics/reports

These endpoints expose workspace-scoped analytics snapshots captured by the Phase 29 provider sync layer. They are read-only and can be consumed by n8n, MCP tools, or other automation clients.

## Phase 31 AI content engine

### POST /api/v1/ai/content

Transforms master content into platform-native variants for `instagram`, `linkedin`, `x`, `facebook`, `threads`, `tiktok`, and `youtube`.

Request:

    {
      "master_content": "New product launch next Friday.",
      "platforms": ["instagram", "linkedin", "x"],
      "brand_voice": "confident and friendly",
      "instructions": "Use a direct CTA and do not invent facts.",
      "variations": 2,
      "require_approval": true
    }

Each variant includes caption, optional title, hashtags, CTA, media recommendations, character count, character limit, and validation warnings. The generation and variants are persisted to the workspace and retain the calling profile for auditability. `OPENAI_API_KEY` is required server-side; the model is configurable with `OPENAI_CONTENT_MODEL` and defaults to `gpt-6-luna`.

### GET /api/v1/ai/content

Lists recent AI generations for the authenticated workspace.

### GET /api/v1/ai/content/{id}

Returns one generation and all platform variants.

### POST /api/v1/ai/content/{id}

Use `{ "action": "approve" }` to mark a generation and its variants approved. Approval never publishes content by itself.

## Phase 30 MCP server

### POST /api/mcp

OmniSocial exposes a stateless authenticated MCP endpoint. The modern MCP `2026-07-28` request model is supported through `server/discover`, `tools/list`, and `tools/call`; legacy `initialize` clients are also accepted for compatibility. The endpoint does not create MCP sessions.

Authenticate with the same profile-scoped API key:

    Authorization: Bearer $API_KEY

Available tools:

- `list_connected_accounts` — read-only connected-account discovery.
- `publish_post` — immediate publishing; requires `confirm=true`.
- `schedule_post` — future publishing; requires `confirm=true`.
- `get_post_status` — read publishing status.
- `get_analytics` — read Phase 29 analytics overview/posts/accounts/reports.
- `generate_platform_content` — call the Phase 31 content engine.

There is intentionally no MCP tool for deleting posts or disconnecting social accounts. Every MCP tool call is audited against the caller's profile and API key without storing provider OAuth secrets.

High-impact actions use an explicit confirmation argument. A client that omits `confirm=true` receives a machine-readable `confirmation_required` response and must ask the user before retrying.

## Errors

API errors use an `error` message and, where the condition is machine-actionable, a stable `code`. Common statuses: 400 invalid request, 401 authentication, 404 not found, 409 conflict, 413 too large, 415 unsupported media, 429 rate limited, 503 protection unavailable. HTTP 429 includes `Retry-After`.

## Limits

Publish JSON requests are limited to 1 MB. Media uploads are limited to 100 MB. API rate limit is 120 requests/minute per API key.

## n8n integration

Recommended flow: n8n → POST `/api/v1/media` when media is needed → POST `/api/v1/publish` → GET `/api/v1/posts/{post_id}` when status is needed. For AI workflows, n8n can call POST `/api/v1/ai/content` before publishing. Store the API key in an n8n credential/secret.

## OpenAPI

The machine-readable specification is docs/openapi.yaml.
