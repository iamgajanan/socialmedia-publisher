# Webhook delivery operations

## Delivery safety

- Delivery is HTTPS-only and rejects embedded URL credentials, localhost/private/reserved destinations, and DNS answers containing any non-public address.
- The worker pins the validated DNS answer for the outbound TLS request to reduce DNS-rebinding risk.
- Redirects are not followed. Configure the webhook to point at its final HTTPS endpoint.
- Request timeouts are 10 seconds. Transient failures (timeouts, HTTP 408/429, and HTTP 5xx) use bounded exponential backoff. Redirects and other HTTP 4xx responses are treated as permanent for that delivery.

## What to monitor

Watch `socialmedia_worker_runs` for the webhooks worker and `socialmedia_webhook_deliveries` for backlog/failure growth. Alert on:
- a failed worker run;
- a sustained rise in failed deliveries;
- pending deliveries older than the retry schedule;
- repeated 401/403/404 responses, which usually require endpoint or credential correction rather than retries.

The worker stores HTTP response status on failed deliveries so the failure reason can be grouped without parsing free-form response text.

## Read-only production checks

```sql
select status, response_status, count(*) as deliveries
from public.socialmedia_webhook_deliveries
group by status, response_status
order by status, response_status;

select worker_type, status, count(*) as runs,
       max(started_at) as last_started_at
from public.socialmedia_worker_runs
where started_at >= now() - interval '24 hours'
group by worker_type, status
order by worker_type, status;

select count(*) as overdue_pending_deliveries
from public.socialmedia_webhook_deliveries
where status = 'pending'
  and next_attempt_at < now() - interval '30 minutes';
```

Do not disable customer webhooks automatically. Investigate the endpoint owner and recent response class first. A 404 indicates the configured path is not present at the destination; correct the endpoint and re-enable the webhook if needed.
