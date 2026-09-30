-- Phase 13: simple publishing users, not login/team members.
-- One authenticated owner can create multiple logical publishing users.
-- Each publishing user can own multiple social destinations while sharing one login.

alter table public.socialmedia_plans
  add column if not exists max_users integer;

update public.socialmedia_plans
set max_users = max_team_members
where max_users is null;

alter table public.socialmedia_plans
  alter column max_users set default 5;

create table if not exists public.socialmedia_users (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.socialmedia_workspaces(id) on delete cascade,
  name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists socialmedia_users_workspace_id_idx
  on public.socialmedia_users(workspace_id, created_at);

alter table public.socialmedia_social_accounts
  add column if not exists socialmedia_user_id uuid references public.socialmedia_users(id) on delete set null;

alter table public.socialmedia_posts
  add column if not exists socialmedia_user_id uuid references public.socialmedia_users(id) on delete set null;

alter table public.socialmedia_post_platforms
  add column if not exists socialmedia_user_id uuid references public.socialmedia_users(id) on delete set null;

create index if not exists socialmedia_social_accounts_user_id_idx
  on public.socialmedia_social_accounts(socialmedia_user_id);
create index if not exists socialmedia_posts_user_id_idx
  on public.socialmedia_posts(socialmedia_user_id);
create index if not exists socialmedia_post_platforms_user_id_idx
  on public.socialmedia_post_platforms(socialmedia_user_id);

-- Create one logical publishing user for each existing workspace and attach
-- existing social destinations to that user. No OAuth or publishing ownership
-- is changed: profile_id remains the authenticated owner.
insert into public.socialmedia_users (workspace_id, name)
select w.id, coalesce(nullif(trim(p.display_name), ''), 'Default user')
from public.socialmedia_workspaces w
join public.socialmedia_profiles p on p.id = w.owner_profile_id
where not exists (
  select 1 from public.socialmedia_users u where u.workspace_id = w.id
);

update public.socialmedia_social_accounts a
set socialmedia_user_id = u.id
from public.socialmedia_profiles p
join public.socialmedia_users u on u.workspace_id = p.workspace_id
where p.id = a.profile_id
  and a.socialmedia_user_id is null;

update public.socialmedia_posts p
set socialmedia_user_id = u.id
from public.socialmedia_profiles pr
join public.socialmedia_users u on u.workspace_id = pr.workspace_id
where pr.id = p.profile_id
  and p.socialmedia_user_id is null;

update public.socialmedia_post_platforms pp
set socialmedia_user_id = p.socialmedia_user_id
from public.socialmedia_posts p
where p.id = pp.post_id
  and pp.socialmedia_user_id is null;

alter table public.socialmedia_users enable row level security;

drop policy if exists socialmedia_users_select_owner on public.socialmedia_users;
create policy socialmedia_users_select_owner on public.socialmedia_users
for select to authenticated
using (
  workspace_id = (select workspace_id from public.socialmedia_profiles where id = (select auth.uid()))
);

drop policy if exists socialmedia_users_insert_owner on public.socialmedia_users;
create policy socialmedia_users_insert_owner on public.socialmedia_users
for insert to authenticated
with check (
  workspace_id = (select workspace_id from public.socialmedia_profiles where id = (select auth.uid()))
);

drop policy if exists socialmedia_users_update_owner on public.socialmedia_users;
create policy socialmedia_users_update_owner on public.socialmedia_users
for update to authenticated
using (workspace_id = (select workspace_id from public.socialmedia_profiles where id = (select auth.uid())))
with check (workspace_id = (select workspace_id from public.socialmedia_profiles where id = (select auth.uid())));

drop policy if exists socialmedia_users_delete_owner on public.socialmedia_users;
create policy socialmedia_users_delete_owner on public.socialmedia_users
for delete to authenticated
using (workspace_id = (select workspace_id from public.socialmedia_profiles where id = (select auth.uid())));

create or replace function public.socialmedia_enforce_user_limit()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  allowed integer;
  used integer;
begin
  select p.max_users into allowed
  from public.socialmedia_workspaces w
  join public.socialmedia_plans p on p.id = w.plan_id
  where w.id = new.workspace_id;
  select count(*) into used from public.socialmedia_users where workspace_id = new.workspace_id;
  if allowed is not null and used >= allowed then
    raise exception 'USER_LIMIT_REACHED';
  end if;
  return new;
end;
$$;

drop trigger if exists socialmedia_users_limit_trigger on public.socialmedia_users;
create trigger socialmedia_users_limit_trigger
before insert on public.socialmedia_users
for each row execute function public.socialmedia_enforce_user_limit();

create or replace function public.socialmedia_enforce_social_account_limit()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  allowed integer;
  used integer;
begin
  select p.max_social_accounts into allowed
  from public.socialmedia_workspaces w
  join public.socialmedia_plans p on p.id = w.plan_id
  where w.id = new.workspace_id;
  select count(*) into used from public.socialmedia_social_accounts where workspace_id = new.workspace_id;
  if allowed is not null and used >= allowed then
    raise exception 'SOCIAL_ACCOUNT_LIMIT_REACHED';
  end if;
  return new;
end;
$$;

drop trigger if exists socialmedia_social_accounts_limit_trigger on public.socialmedia_social_accounts;
create trigger socialmedia_social_accounts_limit_trigger
before insert on public.socialmedia_social_accounts
for each row execute function public.socialmedia_enforce_social_account_limit();
