# OmniSocial Webhooks

Phase 28 adds customer webhook infrastructure for automation systems and customer backends.

## UI

Open **Webhooks** from the OmniSocial sidebar. From there you can register an HTTPS endpoint, choose event types, copy the one-time signing secret, queue a signed test event, and inspect the endpoint status.

## Endpoints

All management endpoints currently use the authenticated OmniSocial session.

- `GET /api/v1/webhooks` — list the current user's webhook registrations and supported events.
- `POST /api/v1/webhooks` — create a webhook.
- `PATCH /api/v1/webhooks/:id` — update URL, events, description, or active/disabled state.
- `DELETE /api/v1/webhooks/:id` — delete a webhook and its delivery records.
- `POST /api/v1/webhooks/:id/test` — queue a signed test event.
- `GET /api/v1/webhooks/:id/deliveries` — inspect the latest 50 delivery attempts.
- `POST /api/cron/webhooks` — internal delivery worker; protected by `CRON_SECRET`.

## Register a webhook

```json
{
  "url": "https://customer.example.com/omnisocial/webhook",
  "events": ["post.published", "post.failed", "account.connected"],
  "description": "Production automation"
}
```

The create response returns a `whsec_...` signing secret once. Store it securely; it is not returned by list/update endpoints.

## Event catalog

- `post.created`
- `post.updated`
- `post.scheduled`
- `post.publishing`
- `post.published`
- `post.failed`
- `post.cancelled`
- `account.connected`
- `account.disconnected`
- `media.uploaded`

Post creation/status transitions and social-account connection/status transitions are emitted automatically by database triggers. `media.uploaded` is part of the public event contract and should be emitted by the media-upload flow when a media asset is persisted.

## Delivery format

```json
{
  "id": "event-uuid",
  "type": "post.published",
  "created_at": "2026-10-06T10:00:00.000Z",
  "data": {
    "post_id": "post-uuid",
    "status": "published"
  }
}
```

Headers:

- `X-OmniSocial-Event-Id`
- `X-OmniSocial-Event`
- `X-OmniSocial-Timestamp`
- `X-OmniSocial-Signature: v1=<hex>`

The signature is HMAC-SHA256 over:

```text
<unix_timestamp>.<raw_request_body>
```

Use the webhook secret returned during registration. Reject requests with an invalid signature or an unacceptable timestamp age. Verify the exact raw request body before parsing it and compare signatures in constant time. citeturn0search3

## Retry behavior

Delivery is asynchronous. Failed requests are retried with increasing delays and stop after six attempts. Delivery status, HTTP response status/body, attempt count, timestamps, and failure state are retained for operational inspection. Consumers should treat delivery as at-least-once and deduplicate by `X-OmniSocial-Event-Id`. citeturn0search0

## Security

- Only HTTPS webhook URLs are accepted.
- Secrets are generated server-side.
- Secrets are returned only during creation.
- Webhook registration/list/update/delete is scoped to the authenticated profile.
- Delivery worker uses the server-side Supabase service-role key and is protected by `CRON_SECRET`.
- Never log webhook secrets.
- Do not perform slow work before acknowledging a valid delivery; persist/queue first and return 2xx quickly. citeturn0search0turn0search3
