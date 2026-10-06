-- Phase 29 completion: analytics sync state, freshness, and reporting indexes.
create table if not exists public.socialmedia_analytics_sync_runs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.socialmedia_profiles(id) on delete cascade,
  status text not null check (status in ('running','succeeded','partial','failed')),
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  accounts_scanned integer not null default 0,
  accounts_succeeded integer not null default 0,
  accounts_failed integer not null default 0,
  posts_scanned integer not null default 0,
  metrics_written integer not null default 0,
  error_count integer not null default 0,
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists socialmedia_analytics_sync_runs_profile_requested_idx
  on public.socialmedia_analytics_sync_runs(profile_id, requested_at desc);

create index if not exists socialmedia_post_analytics_reporting_idx
  on public.socialmedia_post_analytics(profile_id, platform, period_end desc, captured_at desc);

create index if not exists socialmedia_account_analytics_reporting_idx
  on public.socialmedia_account_analytics(profile_id, platform, period_end desc, captured_at desc);

alter table public.socialmedia_analytics_sync_runs enable row level security;
create policy socialmedia_analytics_sync_runs_select_own
  on public.socialmedia_analytics_sync_runs for select to authenticated
  using (profile_id = auth.uid());
revoke insert, update, delete on table public.socialmedia_analytics_sync_runs from anon, authenticated;
grant select on table public.socialmedia_analytics_sync_runs to authenticated;
