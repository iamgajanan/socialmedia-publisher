-- Phase 29 — Analytics & Reporting API
-- Provider-neutral storage for post/destination and account analytics snapshots.
-- Publishing data remains the source of truth for delivery counts; these tables
-- hold optional provider metrics such as impressions, reach and engagement.

create table if not exists public.socialmedia_post_analytics (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.socialmedia_profiles(id) on delete cascade,
  post_id uuid not null references public.socialmedia_posts(id) on delete cascade,
  post_platform_id uuid not null references public.socialmedia_post_platforms(id) on delete cascade,
  social_account_id uuid not null references public.socialmedia_social_accounts(id) on delete cascade,
  platform text not null,
  platform_post_id text,
  period_start timestamptz not null,
  period_end timestamptz not null,
  impressions bigint not null default 0 check (impressions >= 0),
  reach bigint not null default 0 check (reach >= 0),
  likes bigint not null default 0 check (likes >= 0),
  comments bigint not null default 0 check (comments >= 0),
  shares bigint not null default 0 check (shares >= 0),
  saves bigint not null default 0 check (saves >= 0),
  clicks bigint not null default 0 check (clicks >= 0),
  video_views bigint not null default 0 check (video_views >= 0),
  engagement_rate numeric(12,6),
  raw_metrics jsonb not null default '{}'::jsonb,
  source text not null default 'provider',
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end > period_start),
  unique (post_platform_id, period_start, period_end, source)
);

create table if not exists public.socialmedia_account_analytics (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.socialmedia_profiles(id) on delete cascade,
  social_account_id uuid not null references public.socialmedia_social_accounts(id) on delete cascade,
  platform text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  follower_count bigint,
  impressions bigint not null default 0 check (impressions >= 0),
  reach bigint not null default 0 check (reach >= 0),
  likes bigint not null default 0 check (likes >= 0),
  comments bigint not null default 0 check (comments >= 0),
  shares bigint not null default 0 check (shares >= 0),
  saves bigint not null default 0 check (saves >= 0),
  clicks bigint not null default 0 check (clicks >= 0),
  video_views bigint not null default 0 check (video_views >= 0),
  engagement_rate numeric(12,6),
  raw_metrics jsonb not null default '{}'::jsonb,
  source text not null default 'provider',
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end > period_start),
  unique (social_account_id, period_start, period_end, source)
);

create index if not exists socialmedia_post_analytics_profile_period_idx
  on public.socialmedia_post_analytics(profile_id, period_start desc, period_end desc);
create index if not exists socialmedia_post_analytics_post_platform_idx
  on public.socialmedia_post_analytics(post_platform_id, captured_at desc);
create index if not exists socialmedia_post_analytics_platform_idx
  on public.socialmedia_post_analytics(profile_id, platform, captured_at desc);
create index if not exists socialmedia_account_analytics_profile_period_idx
  on public.socialmedia_account_analytics(profile_id, period_start desc, period_end desc);
create index if not exists socialmedia_account_analytics_account_idx
  on public.socialmedia_account_analytics(social_account_id, captured_at desc);

-- Reuse the project's standard updated_at trigger.
drop trigger if exists socialmedia_post_analytics_updated_at on public.socialmedia_post_analytics;
create trigger socialmedia_post_analytics_updated_at
  before update on public.socialmedia_post_analytics
  for each row execute function public.socialmedia_set_updated_at();

drop trigger if exists socialmedia_account_analytics_updated_at on public.socialmedia_account_analytics;
create trigger socialmedia_account_analytics_updated_at
  before update on public.socialmedia_account_analytics
  for each row execute function public.socialmedia_set_updated_at();

alter table public.socialmedia_post_analytics enable row level security;
alter table public.socialmedia_account_analytics enable row level security;

create policy socialmedia_post_analytics_select_own
  on public.socialmedia_post_analytics for select to authenticated
  using (profile_id = auth.uid());

create policy socialmedia_account_analytics_select_own
  on public.socialmedia_account_analytics for select to authenticated
  using (profile_id = auth.uid());

-- Analytics ingestion is server/provider infrastructure. Do not expose insert,
-- update or delete policies to browser clients.
revoke all on table public.socialmedia_post_analytics from anon, authenticated;
revoke all on table public.socialmedia_account_analytics from anon, authenticated;

grant select on table public.socialmedia_post_analytics to authenticated;
grant select on table public.socialmedia_account_analytics to authenticated;
