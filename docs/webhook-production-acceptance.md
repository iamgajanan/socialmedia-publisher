# Production webhook acceptance — 2026-10-13

## Result

The active OmniSocial production webhook endpoint accepted a fresh signed delivery through the production delivery worker.

- Active endpoint: `https://n8n.omnidecoder.live/webhook/omnisocial`
- Event type: `media.uploaded` (explicit acceptance-test payload; no real media object was created)
- Event ID: `ea974724-a83e-45fa-9595-27a114de2faa`
- Delivery ID: `54a12c58-4017-4607-a26a-48779864341a`
- Event queued at: `2026-10-13T17:19:54.802814Z`
- Worker run: `a0f89e76-6f46-41b4-9f44-f4dea309ab81`
- Worker result: `processed=1, delivered=1, failed=0, skipped=0`
- Receiver response: HTTP `200`, body `{"ok":true,"source":"n8n","message":"OmniSocial webhook received"}`
- Delivery attempt: `1`; final status: `delivered`
- Post-acceptance state: active hook remains `active`, `failure_count=0`, and there are no pending webhook deliveries.

The worker ran automatically after the event was queued; this was not a manually marked delivery.

## Legacy test endpoint

The stale test webhook URL was `https://n8n.omnidecoder.live/webhook-test/omnisocial`.

- Historical failures: 51 HTTP `404` deliveries.
- Last recorded attempt before cleanup: `2026-10-09T13:22:44.486Z`.
- The endpoint had no successful deliveries and was in `failing` state with `failure_count=6`.
- On 2026-10-13, the stale subscription was changed to `paused` so new events no longer target the inactive test URL.
- The production URL above remains the only active webhook for this profile.

The old 404s were test-endpoint configuration failures, not failures from the active production endpoint. Do not reactivate the test URL unless its n8n webhook trigger is deliberately re-registered and tested.

## Operational follow-up

- Keep the active production endpoint and its signing secret unchanged.
- Monitor `socialmedia_webhook_deliveries` and `socialmedia_worker_runs` for future failures.
- If a test workflow is needed, register its `/webhook-test/` URL only while the corresponding n8n workflow is listening; otherwise keep that subscription paused.
