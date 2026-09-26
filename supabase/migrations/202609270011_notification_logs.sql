-- Phase 11: notification queue, delivery logs, retry state, and deduplication.
create table if not exists public.socialmedia_notification_logs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.socialmedia_profiles(id) on delete cascade,
  event_type text not null check (event_type in ('post_scheduled','post_published','post_failed','account_disconnected','token_expired')),
  dedupe_key text not null unique,
  post_id uuid references public.socialmedia_posts(id) on delete cascade,
  social_account_id uuid references public.socialmedia_social_accounts(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','sending','sent','failed')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists socialmedia_notification_logs_queue_idx on public.socialmedia_notification_logs(status,next_attempt_at);
create index if not exists socialmedia_notification_logs_profile_created_idx on public.socialmedia_notification_logs(profile_id,created_at desc);
alter table public.socialmedia_notification_logs enable row level security;
drop policy if exists socialmedia_notification_logs_select_own on public.socialmedia_notification_logs;
create policy socialmedia_notification_logs_select_own on public.socialmedia_notification_logs for select to authenticated using (profile_id = auth.uid());
drop policy if exists socialmedia_notification_logs_insert_own on public.socialmedia_notification_logs;
create policy socialmedia_notification_logs_insert_own on public.socialmedia_notification_logs for insert to authenticated with check (profile_id = auth.uid());
drop trigger if exists socialmedia_notification_logs_updated_at on public.socialmedia_notification_logs;
create trigger socialmedia_notification_logs_updated_at before update on public.socialmedia_notification_logs for each row execute function public.socialmedia_set_updated_at();