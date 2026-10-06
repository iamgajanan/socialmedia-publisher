-- Allow the operations dashboard to record webhook worker runs.
alter table if exists public.socialmedia_worker_runs drop constraint if exists socialmedia_worker_runs_worker_type_check;
alter table if exists public.socialmedia_worker_runs
  add constraint socialmedia_worker_runs_worker_type_check
  check (worker_type in ('publish','oauth_health','notifications','webhooks'));
