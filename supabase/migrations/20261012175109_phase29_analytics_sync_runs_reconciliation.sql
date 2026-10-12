-- Forward-only reconciliation for the Phase 29 analytics sync health table.
-- The application treats run history as operational metadata; provider metric writes
-- remain independent of this table so missing run logging never blocks analytics sync.

create table if not exists public.socialmedia_analytics_sync_runs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.socialmedia_profiles(id) on delete cascade,
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'partial', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  accounts_scanned integer not null default 0 check (accounts_scanned >= 0),
  accounts_succeeded integer not null default 0 check (accounts_succeeded >= 0),
  accounts_failed integer not null default 0 check (accounts_failed >= 0),
  posts_scanned integer not null default 0 check (posts_scanned >= 0),
  metrics_written integer not null default 0 check (metrics_written >= 0),
  error_count integer not null default 0 check (error_count >= 0),
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists socialmedia_analytics_sync_runs_profile_started_idx
  on public.socialmedia_analytics_sync_runs(profile_id, started_at desc);

create index if not exists socialmedia_analytics_sync_runs_status_started_idx
  on public.socialmedia_analytics_sync_runs(status, started_at desc);

alter table public.socialmedia_analytics_sync_runs enable row level security;
revoke all on table public.socialmedia_analytics_sync_runs from anon, authenticated;
grant all on table public.socialmedia_analytics_sync_runs to service_role;

comment on table public.socialmedia_analytics_sync_runs is
  'Service-only operational history for analytics provider synchronization.';
