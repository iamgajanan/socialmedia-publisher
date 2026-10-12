# Analytics sync operations

The production Vercel cron runs `/api/cron/analytics` daily at 03:00 UTC (08:30 India Standard Time). Vercel sends the configured `CRON_SECRET` as a Bearer token; do not place the secret in source control or in the URL.

The route processes connected profiles concurrently and writes operational run state to `socialmedia_analytics_sync_runs`. Provider metric collection is independent of the run-history insert: if run logging fails, the route emits a structured error and continues syncing.

## Verify recent runs

Run this query with an administrative database connection:

```sql
select status, count(*) as runs, max(started_at) as latest_started_at
from public.socialmedia_analytics_sync_runs
where started_at >= now() - interval '7 days'
group by status
order by status;

select profile_id, status, accounts_scanned, accounts_succeeded,
       accounts_failed, posts_scanned, metrics_written, error_count,
       started_at, finished_at
from public.socialmedia_analytics_sync_runs
order by started_at desc
limit 20;
```

Investigate a missing daily run as a scheduler/configuration issue. Investigate `partial` or `failed` runs using the stored error summary, and verify provider token validity and permissions before re-running.
