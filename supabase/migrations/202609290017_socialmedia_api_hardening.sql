-- API-5: production API hardening for rate limiting and publish idempotency.

create table if not exists public.socialmedia_api_rate_limits (
  api_key_id uuid primary key references public.socialmedia_api_keys(id) on delete cascade,
  profile_id uuid not null references public.socialmedia_profiles(id) on delete cascade,
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists socialmedia_api_rate_limits_profile_id_idx
  on public.socialmedia_api_rate_limits(profile_id);

alter table public.socialmedia_api_rate_limits enable row level security;
revoke all on public.socialmedia_api_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.socialmedia_api_rate_limits to service_role;

create or replace function public.socialmedia_consume_api_rate_limit(
  p_api_key_id uuid,
  p_profile_id uuid,
  p_limit integer default 120,
  p_window_seconds integer default 60
)
returns table(allowed boolean, retry_after_seconds integer)
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_count integer;
  v_retry integer;
begin
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'Invalid rate limit configuration';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
  );

  insert into public.socialmedia_api_rate_limits (
    api_key_id, profile_id, window_started_at, request_count, updated_at
  )
  values (p_api_key_id, p_profile_id, v_window_start, 1, v_now)
  on conflict (api_key_id) do update
    set profile_id = excluded.profile_id,
        window_started_at = case
          when socialmedia_api_rate_limits.window_started_at < excluded.window_started_at
            then excluded.window_started_at
          else socialmedia_api_rate_limits.window_started_at
        end,
        request_count = case
          when socialmedia_api_rate_limits.window_started_at < excluded.window_started_at
            then 1
          else socialmedia_api_rate_limits.request_count + 1
        end,
        updated_at = excluded.updated_at;

  select r.window_started_at, r.request_count
    into v_window_start, v_count
  from public.socialmedia_api_rate_limits r
  where r.api_key_id = p_api_key_id;

  v_retry := greatest(
    1,
    ceil(extract(epoch from ((v_window_start + make_interval(secs => p_window_seconds)) - v_now)))::integer
  );

  return query select v_count <= p_limit, v_retry;
end;
$$;

revoke all on function public.socialmedia_consume_api_rate_limit(uuid, uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.socialmedia_consume_api_rate_limit(uuid, uuid, integer, integer) to service_role;

create table if not exists public.socialmedia_api_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  api_key_id uuid not null references public.socialmedia_api_keys(id) on delete cascade,
  profile_id uuid not null references public.socialmedia_profiles(id) on delete cascade,
  idempotency_key text not null,
  request_hash text not null,
  status text not null check (status in ('processing','completed')),
  response_status integer,
  response_body jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  unique (api_key_id, idempotency_key)
);

create index if not exists socialmedia_api_idempotency_keys_profile_created_idx
  on public.socialmedia_api_idempotency_keys(profile_id, created_at desc);

create index if not exists socialmedia_api_idempotency_keys_expires_at_idx
  on public.socialmedia_api_idempotency_keys(expires_at);

alter table public.socialmedia_api_idempotency_keys enable row level security;
revoke all on public.socialmedia_api_idempotency_keys from public, anon, authenticated;
grant select, insert, update, delete on public.socialmedia_api_idempotency_keys to service_role;

comment on table public.socialmedia_api_rate_limits is 'Server-side per-API-key fixed-window request counters. Never exposed to API callers.';
comment on table public.socialmedia_api_idempotency_keys is 'Server-side publish request deduplication records scoped to one API key and profile.';
