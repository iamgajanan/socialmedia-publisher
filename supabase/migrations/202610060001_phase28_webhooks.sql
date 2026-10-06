-- Phase 28: customer webhook subscriptions, durable events, and delivery attempts.
create table if not exists public.socialmedia_webhooks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.socialmedia_profiles(id) on delete cascade,
  url text not null,
  description text,
  secret text not null,
  events text[] not null default '{}',
  status text not null default 'active' check (status in ('active','paused','failing')),
  failure_count integer not null default 0,
  last_delivery_at timestamptz,
  last_success_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (url ~ '^https://')
);

create index if not exists socialmedia_webhooks_profile_idx on public.socialmedia_webhooks(profile_id);

create table if not exists public.socialmedia_webhook_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.socialmedia_profiles(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists socialmedia_webhook_events_profile_created_idx on public.socialmedia_webhook_events(profile_id, created_at desc);

create table if not exists public.socialmedia_webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  webhook_id uuid not null references public.socialmedia_webhooks(id) on delete cascade,
  event_id uuid not null references public.socialmedia_webhook_events(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','delivered','failed')),
  attempt integer not null default 0,
  response_status integer,
  response_body text,
  next_attempt_at timestamptz not null default now(),
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  unique (webhook_id, event_id)
);
create index if not exists socialmedia_webhook_deliveries_pending_idx on public.socialmedia_webhook_deliveries(status, next_attempt_at);
create index if not exists socialmedia_webhook_deliveries_event_idx on public.socialmedia_webhook_deliveries(event_id);

alter table public.socialmedia_webhooks enable row level security;
alter table public.socialmedia_webhook_events enable row level security;
alter table public.socialmedia_webhook_deliveries enable row level security;

create policy socialmedia_webhooks_owner_select on public.socialmedia_webhooks for select to authenticated using (profile_id = auth.uid());
create policy socialmedia_webhooks_owner_insert on public.socialmedia_webhooks for insert to authenticated with check (profile_id = auth.uid());
create policy socialmedia_webhooks_owner_update on public.socialmedia_webhooks for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy socialmedia_webhooks_owner_delete on public.socialmedia_webhooks for delete to authenticated using (profile_id = auth.uid());

revoke all on public.socialmedia_webhook_events from public, anon, authenticated;
revoke all on public.socialmedia_webhook_deliveries from public, anon, authenticated;
grant select, insert, update, delete on public.socialmedia_webhooks to authenticated;
grant all on public.socialmedia_webhook_events to service_role;
grant all on public.socialmedia_webhook_deliveries to service_role;

create or replace function public.socialmedia_webhooks_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists socialmedia_webhooks_updated_at on public.socialmedia_webhooks;
create trigger socialmedia_webhooks_updated_at before update on public.socialmedia_webhooks for each row execute function public.socialmedia_webhooks_updated_at();
