-- Phase 28: webhook worker support in the existing worker observability table.
create table if not exists public.socialmedia_worker_runs (
  id uuid primary key default gen_random_uuid(),
  worker_type text not null,
  status text not null default 'running' check (status in ('running','succeeded','failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,
  result jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.socialmedia_worker_runs
  drop constraint if exists socialmedia_worker_runs_worker_type_check;

alter table public.socialmedia_worker_runs
  add constraint socialmedia_worker_runs_worker_type_check
  check (worker_type in ('publish','oauth_health','notifications','webhooks'));

create index if not exists socialmedia_worker_runs_type_created_idx
  on public.socialmedia_worker_runs(worker_type, created_at desc);
create index if not exists socialmedia_worker_runs_status_created_idx
  on public.socialmedia_worker_runs(status, created_at desc);

alter table public.socialmedia_worker_runs enable row level security;
revoke all on public.socialmedia_worker_runs from anon, authenticated;
grant select, insert, update, delete on public.socialmedia_worker_runs to service_role;
