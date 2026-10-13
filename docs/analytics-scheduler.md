# Analytics sync schedule

The production analytics sync is scheduled by Vercel Cron at **11:15 UTC daily** via `vercel.json`.

- Endpoint: `GET /api/cron/analytics` (delegates to the same protected handler as POST).
- Authentication: Vercel sends `Authorization: Bearer $CRON_SECRET`; the handler checks it with a constant-time comparison. Keep `CRON_SECRET` configured in the Vercel Production environment.
- Runtime records: each connected profile writes a row to `socialmedia_analytics_sync_runs`. Successful provider metrics are upserted into `socialmedia_account_analytics` and, where published destinations exist, `socialmedia_post_analytics`.
- Failure visibility: Vercel Cron does not automatically retry failed invocations. Check Vercel runtime logs for `/api/cron/analytics` and inspect run status, account counts, error count, and latest `captured_at` values in Supabase after each run.

Vercel cron schedules use UTC. On Hobby, the schedule is limited to once per day and can execute within the configured hour rather than at an exact minute. The daily schedule is intentionally conservative; do not add a second scheduler for this endpoint unless duplicate invocation/idempotency behavior is reviewed first.
