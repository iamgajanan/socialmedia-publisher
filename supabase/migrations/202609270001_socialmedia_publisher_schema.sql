-- OmniSocial social publishing schema
create table if not exists public.socialmedia_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.socialmedia_social_accounts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.socialmedia_profiles(id) on delete cascade,
  platform text not null,
  account_name text not null,
  external_account_id text not null,
  username text,
  avatar_url text,
  status text not null default 'connected' check (status in ('connected','disconnected','error')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, platform, external_account_id)
);

create table if not exists public.socialmedia_posts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.socialmedia_profiles(id) on delete cascade,
  content text not null default '',
  media_urls jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','scheduled','publishing','published','failed')),
  scheduled_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.socialmedia_post_platforms (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.socialmedia_posts(id) on delete cascade,
  social_account_id uuid not null references public.socialmedia_social_accounts(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','scheduled','publishing','published','failed')),
  platform_post_id text,
  error_message text,
  scheduled_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (post_id, social_account_id)
);

create index if not exists socialmedia_social_accounts_profile_id_idx on public.socialmedia_social_accounts(profile_id);
create index if not exists socialmedia_posts_profile_id_created_at_idx on public.socialmedia_posts(profile_id, created_at desc);
create index if not exists socialmedia_posts_profile_id_scheduled_at_idx on public.socialmedia_posts(profile_id, scheduled_at);
create index if not exists socialmedia_post_platforms_post_id_idx on public.socialmedia_post_platforms(post_id);
create index if not exists socialmedia_post_platforms_account_id_idx on public.socialmedia_post_platforms(social_account_id);

create or replace function public.socialmedia_set_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

create or replace function public.socialmedia_create_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.socialmedia_profiles (id, display_name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), nullif(trim(new.raw_user_meta_data ->> 'name'), '')))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists socialmedia_profiles_updated_at on public.socialmedia_profiles;
create trigger socialmedia_profiles_updated_at before update on public.socialmedia_profiles for each row execute function public.socialmedia_set_updated_at();
drop trigger if exists socialmedia_social_accounts_updated_at on public.socialmedia_social_accounts;
create trigger socialmedia_social_accounts_updated_at before update on public.socialmedia_social_accounts for each row execute function public.socialmedia_set_updated_at();
drop trigger if exists socialmedia_posts_updated_at on public.socialmedia_posts;
create trigger socialmedia_posts_updated_at before update on public.socialmedia_posts for each row execute function public.socialmedia_set_updated_at();
drop trigger if exists socialmedia_post_platforms_updated_at on public.socialmedia_post_platforms;
create trigger socialmedia_post_platforms_updated_at before update on public.socialmedia_post_platforms for each row execute function public.socialmedia_set_updated_at();

drop trigger if exists socialmedia_on_auth_user_created on auth.users;
create trigger socialmedia_on_auth_user_created after insert on auth.users for each row execute function public.socialmedia_create_profile();

alter table public.socialmedia_profiles enable row level security;
alter table public.socialmedia_social_accounts enable row level security;
alter table public.socialmedia_posts enable row level security;
alter table public.socialmedia_post_platforms enable row level security;

create policy socialmedia_profiles_select_own on public.socialmedia_profiles for select to authenticated using (id = auth.uid());
create policy socialmedia_profiles_insert_own on public.socialmedia_profiles for insert to authenticated with check (id = auth.uid());
create policy socialmedia_profiles_update_own on public.socialmedia_profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy socialmedia_profiles_delete_own on public.socialmedia_profiles for delete to authenticated using (id = auth.uid());

create policy socialmedia_social_accounts_select_own on public.socialmedia_social_accounts for select to authenticated using (profile_id = auth.uid());
create policy socialmedia_social_accounts_insert_own on public.socialmedia_social_accounts for insert to authenticated with check (profile_id = auth.uid());
create policy socialmedia_social_accounts_update_own on public.socialmedia_social_accounts for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy socialmedia_social_accounts_delete_own on public.socialmedia_social_accounts for delete to authenticated using (profile_id = auth.uid());

create policy socialmedia_posts_select_own on public.socialmedia_posts for select to authenticated using (profile_id = auth.uid());
create policy socialmedia_posts_insert_own on public.socialmedia_posts for insert to authenticated with check (profile_id = auth.uid());
create policy socialmedia_posts_update_own on public.socialmedia_posts for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy socialmedia_posts_delete_own on public.socialmedia_posts for delete to authenticated using (profile_id = auth.uid());

create policy socialmedia_post_platforms_select_own on public.socialmedia_post_platforms for select to authenticated using (exists (select 1 from public.socialmedia_posts p where p.id = post_id and p.profile_id = auth.uid()));
create policy socialmedia_post_platforms_insert_own on public.socialmedia_post_platforms for insert to authenticated with check (
  exists (select 1 from public.socialmedia_posts p where p.id = post_id and p.profile_id = auth.uid())
  and exists (select 1 from public.socialmedia_social_accounts a where a.id = social_account_id and a.profile_id = auth.uid())
);
create policy socialmedia_post_platforms_update_own on public.socialmedia_post_platforms for update to authenticated using (
  exists (select 1 from public.socialmedia_posts p where p.id = post_id and p.profile_id = auth.uid())
) with check (
  exists (select 1 from public.socialmedia_posts p where p.id = post_id and p.profile_id = auth.uid())
  and exists (select 1 from public.socialmedia_social_accounts a where a.id = social_account_id and a.profile_id = auth.uid())
);
create policy socialmedia_post_platforms_delete_own on public.socialmedia_post_platforms for delete to authenticated using (
  exists (select 1 from public.socialmedia_posts p where p.id = post_id and p.profile_id = auth.uid())
);
