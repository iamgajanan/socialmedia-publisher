-- Phase 28: customer webhooks and durable event delivery
create table if not exists public.socialmedia_webhooks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.socialmedia_profiles(id) on delete cascade,
  url text not null,
  secret text not null,
  status text not null default 'active' check (status in ('active','disabled','failing')),
  events text[] not null default '{}',
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_delivery_at timestamptz,
  last_success_at timestamptz,
  failure_count integer not null default 0
);

create table if not exists public.socialmedia_webhook_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.socialmedia_profiles(id) on delete cascade,
  event_type text not null,
  aggregate_type text not null,
  aggregate_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.socialmedia_webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  webhook_id uuid not null references public.socialmedia_webhooks(id) on delete cascade,
  event_id uuid not null references public.socialmedia_webhook_events(id) on delete cascade,
  attempt integer not null default 0,
  status text not null default 'pending' check (status in ('pending','delivered','failed')),
  response_status integer,
  response_body text,
  next_attempt_at timestamptz not null default now(),
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  unique (webhook_id, event_id)
);

create index if not exists socialmedia_webhooks_profile_idx on public.socialmedia_webhooks(profile_id);
create index if not exists socialmedia_webhook_events_profile_created_idx on public.socialmedia_webhook_events(profile_id, created_at desc);
create index if not exists socialmedia_webhook_deliveries_due_idx on public.socialmedia_webhook_deliveries(status, next_attempt_at);
create index if not exists socialmedia_webhook_deliveries_webhook_idx on public.socialmedia_webhook_deliveries(webhook_id, created_at desc);

alter table public.socialmedia_webhooks enable row level security;
alter table public.socialmedia_webhook_events enable row level security;
alter table public.socialmedia_webhook_deliveries enable row level security;

create policy socialmedia_webhooks_select_own on public.socialmedia_webhooks for select to authenticated using (profile_id = auth.uid());
create policy socialmedia_webhooks_insert_own on public.socialmedia_webhooks for insert to authenticated with check (profile_id = auth.uid());
create policy socialmedia_webhooks_update_own on public.socialmedia_webhooks for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy socialmedia_webhooks_delete_own on public.socialmedia_webhooks for delete to authenticated using (profile_id = auth.uid());
create policy socialmedia_webhook_events_select_own on public.socialmedia_webhook_events for select to authenticated using (profile_id = auth.uid());
create policy socialmedia_webhook_deliveries_select_own on public.socialmedia_webhook_deliveries for select to authenticated using (exists (select 1 from public.socialmedia_webhooks w where w.id = webhook_id and w.profile_id = auth.uid()));

-- Keep the event catalog centralized so clients can validate registrations consistently.
create or replace function public.socialmedia_record_webhook_event(
  p_profile_id uuid,
  p_event_type text,
  p_aggregate_type text,
  p_aggregate_id uuid,
  p_payload jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare event_id uuid;
begin
  if p_event_type not in ('post.created','post.updated','post.scheduled','post.publishing','post.published','post.failed','post.cancelled','account.connected','account.disconnected','media.uploaded') then
    raise exception 'Unsupported webhook event type';
  end if;
  insert into public.socialmedia_webhook_events(profile_id,event_type,aggregate_type,aggregate_id,payload)
  values (p_profile_id,p_event_type,p_aggregate_type,p_aggregate_id,coalesce(p_payload,'{}'::jsonb)) returning id into event_id;
  insert into public.socialmedia_webhook_deliveries(webhook_id,event_id)
  select w.id,event_id from public.socialmedia_webhooks w
  where w.profile_id=p_profile_id and w.status='active' and (cardinality(w.events)=0 or p_event_type = any(w.events))
  on conflict (webhook_id,event_id) do nothing;
  return event_id;
end;
$$;
revoke execute on function public.socialmedia_record_webhook_event(uuid,text,text,uuid,jsonb) from public, anon, authenticated;
