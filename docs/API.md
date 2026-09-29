# Omnisocial API

Production base URL: https://socialmedia-publisher-gules.vercel.app

## Authentication

All API endpoints use a profile-scoped Bearer API key.

    Authorization: Bearer $API_KEY

The API key resolves the Omnisocial profile and the API only uses that profile's connected accounts. Provider OAuth tokens are never returned. Keep API keys server-side and store them in an automation platform's secret/credential storage.

## Supported platforms

Accounts: facebook, instagram, threads, linkedin, x, youtube, tiktok.
Publishing: facebook, instagram, threads, linkedin, youtube, tiktok.

## Endpoints

### GET /api/v1/accounts

Lists connected accounts owned by the authenticated profile. Optional query: platforms=instagram,facebook.

    curl -s "https://socialmedia-publisher-gules.vercel.app/api/v1/accounts?platforms=instagram,facebook" -H "Authorization: Bearer $API_KEY"

Response contains account metadata only, never provider secrets.

### POST /api/v1/media

Uploads one image/video using multipart/form-data. Field name: file. Maximum upload: 100 MB.

    curl -i -X POST "https://socialmedia-publisher-gules.vercel.app/api/v1/media" -H "Authorization: Bearer $API_KEY" -F "file=@./photo.jpg;type=image/jpeg"

Use the returned media_path when publishing.

### POST /api/v1/publish

Creates an immediate queued post or a future scheduled post.

Request:

    {
      "platforms": ["instagram", "facebook"],
      "text": "Hello from Omnisocial",
      "media_paths": ["<profile-id>/...-photo.jpg"],
      "scheduled_at": "2026-10-01T12:00:00.000Z"
    }

Rules: platforms 1–6 unique values; text max 5,000 characters; media_paths max 20; at least text or one media file; scheduled_at must be future when supplied. Media must belong to the authenticated profile and platform/media capability rules are validated.

    curl -i -X POST "https://socialmedia-publisher-gules.vercel.app/api/v1/publish" -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" -H "Idempotency-Key: publish-$(date +%s)" -d '{"platforms":["instagram"],"text":"Hello from Omnisocial"}'

Idempotency-Key is optional, 1–128 characters. Reusing it with the same request body safely returns the stored successful response. Reusing it with a different body returns HTTP 409.

### GET /api/v1/posts

Lists profile-owned posts. Query parameters: status, platform, from, to, limit (1–50, default 20), offset (0–10000, default 0).

    curl -s "https://socialmedia-publisher-gules.vercel.app/api/v1/posts?status=scheduled&platform=instagram&limit=20" -H "Authorization: Bearer $API_KEY"

### GET /api/v1/posts/{postId}

Returns one profile-owned post and destination publishing results.

    curl -s "https://socialmedia-publisher-gules.vercel.app/api/v1/posts/POST_ID" -H "Authorization: Bearer $API_KEY"

### PATCH /api/v1/posts/{postId}

Only draft and scheduled posts are editable. Fields: content, media_paths, scheduled_at. scheduled_at must be future.

    curl -i -X PATCH "https://socialmedia-publisher-gules.vercel.app/api/v1/posts/POST_ID" -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" -d '{"content":"Updated post","scheduled_at":"2026-10-02T12:00:00.000Z"}'

### DELETE /api/v1/posts/{postId}

Draft posts are deleted; scheduled posts are cancelled. Posts already publishing cannot be cancelled. Cancellation preserves destination history and marks pending/scheduled destinations as skipped with reason cancelled.

    curl -i -X DELETE "https://socialmedia-publisher-gules.vercel.app/api/v1/posts/POST_ID" -H "Authorization: Bearer $API_KEY"

## Limits and errors

Publish JSON requests are limited to 1 MB. Media uploads are limited to 100 MB. API rate limit is 120 requests/minute per API key; HTTP 429 includes Retry-After. Common statuses: 400 invalid request, 401 authentication, 404 not found, 409 conflict, 413 too large, 415 unsupported media, 429 rate limited, 503 protection unavailable.

Publishing responses include X-Request-Id and Cache-Control: no-store.

## n8n integration

Recommended flow: n8n → POST /api/v1/media when media is needed → POST /api/v1/publish → GET /api/v1/posts/{post_id} when status is needed. Store the API key in an n8n credential/secret. For scheduled posts, send scheduled_at to Omnisocial unless the workflow intentionally owns scheduling.

## OpenAPI

The machine-readable specification is docs/openapi.yaml.
