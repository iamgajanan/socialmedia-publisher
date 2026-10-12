# Analytics sync operations

The analytics route is intentionally scheduled by an external scheduler rather than Vercel Cron, because the production project uses Vercel Hobby and the existing minute-level workers are externally scheduled. Add a daily request to the existing scheduler (for example, the user's n8n workflow) at 03:00 UTC (08:30 India Standard Time):

- Method: `GET`
- Path: `/api/cron/analytics`
- Header: `Authorization: Bearer <CRON_SECRET>`
- Cadence: daily; adjust only after considering provider API quotas.

Keep `CRON_SECRET` in the scheduler's secret store; never place it in source control or the URL.

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
