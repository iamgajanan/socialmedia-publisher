-- Phase 1: OAuth health monitoring.
create table if not exists public.socialmedia_oauth_health_checks (
  id uuid primary key default gen_random_uuid(),
  social_account_id uuid not null references public.socialmedia_social_accounts(id) on delete cascade,
  status text not null check (status in ('healthy','expiring','invalid','error')),
  checked_at timestamptz not null default now(),
  token_expires_at timestamptz,
  http_status integer,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists socialmedia_oauth_health_checks_account_checked_at_idx
  on public.socialmedia_oauth_health_checks(social_account_id, checked_at desc);

alter table public.socialmedia_oauth_health_checks enable row level security;

revoke insert, update, delete on public.socialmedia_oauth_health_checks from anon, authenticated;
grant select on public.socialmedia_oauth_health_checks to authenticated;
grant select, insert, update, delete on public.socialmedia_oauth_health_checks to service_role;

create policy socialmedia_oauth_health_checks_select_own
  on public.socialmedia_oauth_health_checks
  for select to authenticated
  using (
    exists (
      select 1
      from public.socialmedia_social_accounts account
      where account.id = social_account_id
        and account.profile_id = auth.uid()
    )
  );
