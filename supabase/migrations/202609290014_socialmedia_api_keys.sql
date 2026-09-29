-- Phase API-1: user-scoped Omnisocial API credentials.
create table if not exists public.socialmedia_api_keys (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.socialmedia_profiles(id) on delete cascade,
  name text not null,
  token_prefix text not null,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists socialmedia_api_keys_profile_id_idx
  on public.socialmedia_api_keys(profile_id);

create index if not exists socialmedia_api_keys_profile_active_idx
  on public.socialmedia_api_keys(profile_id, revoked_at);

comment on table public.socialmedia_api_keys is 'Hashed Omnisocial API credentials scoped to one socialmedia_profiles row. Raw tokens are never stored.';
comment on column public.socialmedia_api_keys.token_prefix is 'Non-secret token prefix used to identify a key in the dashboard.';
comment on column public.socialmedia_api_keys.token_hash is 'SHA-256 hash of the complete API token. Raw tokens are never stored.';

alter table public.socialmedia_api_keys enable row level security;
revoke all on public.socialmedia_api_keys from public, anon, authenticated;
grant select, insert, update, delete on public.socialmedia_api_keys to service_role;
