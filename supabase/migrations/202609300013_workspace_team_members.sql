-- Phase 12A: workspace/team foundation
-- Existing profile_id columns are retained as created_by/legacy ownership fields.
-- workspace_id becomes the shared ownership boundary for team-enabled resources.

create schema if not exists private;

create table if not exists public.socialmedia_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My workspace',
  owner_profile_id uuid not null references public.socialmedia_profiles(id) on delete restrict,
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.socialmedia_workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.socialmedia_workspaces(id) on delete cascade,
  profile_id uuid not null references public.socialmedia_profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member','viewer')),
  status text not null default 'active' check (status in ('active','invited','suspended')),
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, profile_id)
);

alter table public.socialmedia_profiles add column if not exists workspace_id uuid;
alter table public.socialmedia_social_accounts add column if not exists workspace_id uuid;
alter table public.socialmedia_posts add column if not exists workspace_id uuid;

-- Backfill one workspace per existing profile. This preserves every current user's data.
do $$
declare
  profile_row record;
  workspace_row public.socialmedia_workspaces;
begin
  for profile_row in select id, coalesce(nullif(trim(workspace_name), ''), 'My workspace') as workspace_name, timezone from public.socialmedia_profiles loop
    select * into workspace_row from public.socialmedia_workspaces where owner_profile_id = profile_row.id order by created_at asc limit 1;
    if workspace_row.id is null then
      insert into public.socialmedia_workspaces (name, owner_profile_id, timezone)
      values (profile_row.workspace_name, profile_row.id, coalesce(profile_row.timezone, 'Asia/Kolkata'))
      returning * into workspace_row;
    end if;
    update public.socialmedia_profiles set workspace_id = workspace_row.id where id = profile_row.id and workspace_id is distinct from workspace_row.id;
    insert into public.socialmedia_workspace_members (workspace_id, profile_id, role, status)
    values (workspace_row.id, profile_row.id, 'owner', 'active')
    on conflict (workspace_id, profile_id) do update set role = 'owner', status = 'active', updated_at = now();
    update public.socialmedia_social_accounts set workspace_id = workspace_row.id where profile_id = profile_row.id and workspace_id is null;
    update public.socialmedia_posts set workspace_id = workspace_row.id where profile_id = profile_row.id and workspace_id is null;
  end loop;
end $$;

alter table public.socialmedia_profiles drop constraint if exists socialmedia_profiles_workspace_id_fkey;
alter table public.socialmedia_profiles add constraint socialmedia_profiles_workspace_id_fkey foreign key (workspace_id) references public.socialmedia_workspaces(id) on delete restrict;
alter table public.socialmedia_social_accounts drop constraint if exists socialmedia_social_accounts_workspace_id_fkey;
alter table public.socialmedia_social_accounts add constraint socialmedia_social_accounts_workspace_id_fkey foreign key (workspace_id) references public.socialmedia_workspaces(id) on delete cascade;
alter table public.socialmedia_posts drop constraint if exists socialmedia_posts_workspace_id_fkey;
alter table public.socialmedia_posts add constraint socialmedia_posts_workspace_id_fkey foreign key (workspace_id) references public.socialmedia_workspaces(id) on delete cascade;
alter table public.socialmedia_profiles alter column workspace_id set not null;
alter table public.socialmedia_social_accounts alter column workspace_id set not null;
alter table public.socialmedia_posts alter column workspace_id set not null;

create unique index if not exists socialmedia_workspaces_owner_profile_id_uidx on public.socialmedia_workspaces(owner_profile_id);
create index if not exists socialmedia_workspace_members_workspace_id_idx on public.socialmedia_workspace_members(workspace_id);
create index if not exists socialmedia_workspace_members_profile_id_idx on public.socialmedia_workspace_members(profile_id);
create index if not exists socialmedia_social_accounts_workspace_id_idx on public.socialmedia_social_accounts(workspace_id);
create index if not exists socialmedia_posts_workspace_id_created_at_idx on public.socialmedia_posts(workspace_id, created_at desc);

create or replace function public.socialmedia_workspace_set_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists socialmedia_workspaces_updated_at on public.socialmedia_workspaces;
create trigger socialmedia_workspaces_updated_at before update on public.socialmedia_workspaces for each row execute function public.socialmedia_workspace_set_updated_at();
drop trigger if exists socialmedia_workspace_members_updated_at on public.socialmedia_workspace_members;
create trigger socialmedia_workspace_members_updated_at before update on public.socialmedia_workspace_members for each row execute function public.socialmedia_workspace_set_updated_at();

-- Compatibility triggers keep current OAuth/composer writes working while the application
-- is moved from profile ownership to workspace ownership in the next phase.
create or replace function private.socialmedia_fill_workspace_id()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.workspace_id is null then
    select p.workspace_id into new.workspace_id
    from public.socialmedia_profiles p
    where p.id = new.profile_id;
  end if;
  if new.workspace_id is null then
    raise exception 'Workspace is required for profile %', new.profile_id using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.socialmedia_fill_workspace_id() from public, anon, authenticated;
drop trigger if exists socialmedia_social_accounts_workspace_id on public.socialmedia_social_accounts;
create trigger socialmedia_social_accounts_workspace_id before insert or update of profile_id, workspace_id on public.socialmedia_social_accounts for each row execute function private.socialmedia_fill_workspace_id();
drop trigger if exists socialmedia_posts_workspace_id on public.socialmedia_posts;
create trigger socialmedia_posts_workspace_id before insert or update of profile_id, workspace_id on public.socialmedia_posts for each row execute function private.socialmedia_fill_workspace_id();

drop function if exists private.socialmedia_user_workspace_ids();
create or replace function private.socialmedia_user_workspace_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select wm.workspace_id from public.socialmedia_workspace_members wm
  where wm.profile_id = (select auth.uid()) and wm.status in ('active', 'invited')
$$;

drop function if exists private.socialmedia_user_workspace_role(uuid);
create or replace function private.socialmedia_user_workspace_role(target_workspace_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select wm.role from public.socialmedia_workspace_members wm
  where wm.workspace_id = target_workspace_id and wm.profile_id = (select auth.uid()) and wm.status in ('active', 'invited') limit 1
$$;

revoke all on function private.socialmedia_user_workspace_ids() from public, anon;
grant execute on function private.socialmedia_user_workspace_ids() to authenticated;
revoke all on function private.socialmedia_user_workspace_role(uuid) from public, anon;
grant execute on function private.socialmedia_user_workspace_role(uuid) to authenticated;
grant usage on schema private to authenticated;

alter table public.socialmedia_workspaces enable row level security;
alter table public.socialmedia_workspace_members enable row level security;

create policy socialmedia_workspaces_select_member on public.socialmedia_workspaces for select to authenticated using (id in (select private.socialmedia_user_workspace_ids()));
create policy socialmedia_workspaces_update_admin on public.socialmedia_workspaces for update to authenticated using ((select private.socialmedia_user_workspace_role(id)) in ('owner','admin')) with check ((select private.socialmedia_user_workspace_role(id)) in ('owner','admin'));
create policy socialmedia_workspace_members_select_member on public.socialmedia_workspace_members for select to authenticated using (workspace_id in (select private.socialmedia_user_workspace_ids()));
create policy socialmedia_workspace_members_insert_admin on public.socialmedia_workspace_members for insert to authenticated with check ((select private.socialmedia_user_workspace_role(workspace_id)) in ('owner','admin'));
create policy socialmedia_workspace_members_update_admin on public.socialmedia_workspace_members for update to authenticated using ((select private.socialmedia_user_workspace_role(workspace_id)) in ('owner','admin')) with check ((select private.socialmedia_user_workspace_role(workspace_id)) in ('owner','admin'));
create policy socialmedia_workspace_members_delete_admin on public.socialmedia_workspace_members for delete to authenticated using ((select private.socialmedia_user_workspace_role(workspace_id)) in ('owner','admin'));

-- Read access is now workspace-scoped. Write policies for posts are also workspace-scoped;
-- social account writes remain server-owned through the OAuth callback.
drop policy if exists socialmedia_social_accounts_select_own on public.socialmedia_social_accounts;
create policy socialmedia_social_accounts_select_workspace on public.socialmedia_social_accounts for select to authenticated using (workspace_id in (select private.socialmedia_user_workspace_ids()));

drop policy if exists socialmedia_posts_select_own on public.socialmedia_posts;
drop policy if exists socialmedia_posts_insert_own on public.socialmedia_posts;
drop policy if exists socialmedia_posts_update_own on public.socialmedia_posts;
drop policy if exists socialmedia_posts_delete_own on public.socialmedia_posts;
create policy socialmedia_posts_select_workspace on public.socialmedia_posts for select to authenticated using (workspace_id in (select private.socialmedia_user_workspace_ids()));
create policy socialmedia_posts_insert_workspace on public.socialmedia_posts for insert to authenticated with check (workspace_id in (select private.socialmedia_user_workspace_ids()));
create policy socialmedia_posts_update_workspace on public.socialmedia_posts for update to authenticated using (workspace_id in (select private.socialmedia_user_workspace_ids())) with check (workspace_id in (select private.socialmedia_user_workspace_ids()));
create policy socialmedia_posts_delete_workspace on public.socialmedia_posts for delete to authenticated using (workspace_id in (select private.socialmedia_user_workspace_ids()));

drop policy if exists socialmedia_post_platforms_select_own on public.socialmedia_post_platforms;
drop policy if exists socialmedia_post_platforms_insert_own on public.socialmedia_post_platforms;
drop policy if exists socialmedia_post_platforms_update_own on public.socialmedia_post_platforms;
drop policy if exists socialmedia_post_platforms_delete_own on public.socialmedia_post_platforms;
create policy socialmedia_post_platforms_select_workspace on public.socialmedia_post_platforms for select to authenticated using (exists (select 1 from public.socialmedia_posts p where p.id = post_id and p.workspace_id in (select private.socialmedia_user_workspace_ids())));
create policy socialmedia_post_platforms_insert_workspace on public.socialmedia_post_platforms for insert to authenticated with check (
  exists (select 1 from public.socialmedia_posts p where p.id = post_id and p.workspace_id in (select private.socialmedia_user_workspace_ids()))
  and exists (select 1 from public.socialmedia_social_accounts a where a.id = social_account_id and a.workspace_id in (select private.socialmedia_user_workspace_ids()))
);
create policy socialmedia_post_platforms_update_workspace on public.socialmedia_post_platforms for update to authenticated using (exists (select 1 from public.socialmedia_posts p where p.id = post_id and p.workspace_id in (select private.socialmedia_user_workspace_ids()))) with check (
  exists (select 1 from public.socialmedia_posts p where p.id = post_id and p.workspace_id in (select private.socialmedia_user_workspace_ids()))
  and exists (select 1 from public.socialmedia_social_accounts a where a.id = social_account_id and a.workspace_id in (select private.socialmedia_user_workspace_ids()))
);
create policy socialmedia_post_platforms_delete_workspace on public.socialmedia_post_platforms for delete to authenticated using (exists (select 1 from public.socialmedia_posts p where p.id = post_id and p.workspace_id in (select private.socialmedia_user_workspace_ids())));

revoke insert, update, delete on public.socialmedia_social_accounts from authenticated;

comment on table public.socialmedia_workspaces is 'Shared OmniSocial workspace boundary for teams, social accounts, posts, billing, and permissions.';
comment on table public.socialmedia_workspace_members is 'Workspace membership and RBAC records for owner/admin/member/viewer access.';
comment on column public.socialmedia_social_accounts.workspace_id is 'Workspace that owns this connected social destination.';
comment on column public.socialmedia_posts.workspace_id is 'Workspace that owns this post and its publishing lifecycle.';
