-- Phase 12: workspace, team membership, and subscription-plan foundation.
-- Self-contained migration for existing and fresh databases.

create table if not exists public.socialmedia_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('starter','pro','premium')),
  name text not null,
  monthly_price_inr integer not null check (monthly_price_inr >= 0),
  monthly_price_usd integer not null check (monthly_price_usd >= 0),
  max_team_members integer not null check (max_team_members >= 1),
  max_social_accounts integer not null check (max_social_accounts >= 1),
  monthly_post_limit integer not null check (monthly_post_limit >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.socialmedia_plans (code, name, monthly_price_inr, monthly_price_usd, max_team_members, max_social_accounts, monthly_post_limit)
values
  ('starter', 'Starter', 999, 9, 5, 10, 100),
  ('pro', 'Pro', 1999, 19, 20, 30, 500),
  ('premium', 'Premium', 2999, 29, 50, 100, 2000)
on conflict (code) do update set
  name = excluded.name,
  monthly_price_inr = excluded.monthly_price_inr,
  monthly_price_usd = excluded.monthly_price_usd,
  max_team_members = excluded.max_team_members,
  max_social_accounts = excluded.max_social_accounts,
  monthly_post_limit = excluded.monthly_post_limit,
  updated_at = now();

alter table public.socialmedia_profiles add column if not exists workspace_id uuid;

create table if not exists public.socialmedia_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My workspace',
  owner_profile_id uuid not null references public.socialmedia_profiles(id) on delete restrict,
  plan_id uuid not null references public.socialmedia_plans(id),
  subscription_status text not null default 'trialing' check (subscription_status in ('trialing','active','past_due','cancelled','incomplete')),
  timezone text not null default 'Asia/Kolkata',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.socialmedia_workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.socialmedia_workspaces(id) on delete cascade,
  profile_id uuid not null references public.socialmedia_profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member','viewer')),
  status text not null default 'invited' check (status in ('invited','active','suspended')),
  invited_at timestamptz not null default now(),
  joined_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (workspace_id, profile_id)
);

insert into public.socialmedia_workspaces (name, owner_profile_id, plan_id)
select coalesce(nullif(trim(p.display_name), ''), 'My workspace') || '''s workspace', p.id,
       (select id from public.socialmedia_plans where code = 'starter')
from public.socialmedia_profiles p
where not exists (select 1 from public.socialmedia_workspaces w where w.owner_profile_id = p.id);

update public.socialmedia_profiles p
set workspace_id = w.id
from public.socialmedia_workspaces w
where w.owner_profile_id = p.id and p.workspace_id is distinct from w.id;

insert into public.socialmedia_workspace_members (workspace_id, profile_id, role, status, joined_at)
select w.id, w.owner_profile_id, 'owner', 'active', now()
from public.socialmedia_workspaces w
where not exists (select 1 from public.socialmedia_workspace_members m where m.workspace_id = w.id and m.profile_id = w.owner_profile_id);

alter table public.socialmedia_social_accounts add column if not exists workspace_id uuid;
alter table public.socialmedia_posts add column if not exists workspace_id uuid;
alter table public.socialmedia_post_platforms add column if not exists workspace_id uuid;

update public.socialmedia_social_accounts a set workspace_id = p.workspace_id
from public.socialmedia_profiles p where p.id = a.profile_id and a.workspace_id is null;
update public.socialmedia_posts p set workspace_id = pr.workspace_id
from public.socialmedia_profiles pr where pr.id = p.profile_id and p.workspace_id is null;
update public.socialmedia_post_platforms pp set workspace_id = p.workspace_id
from public.socialmedia_posts p where p.id = pp.post_id and pp.workspace_id is null;

alter table public.socialmedia_social_accounts add constraint socialmedia_social_accounts_workspace_fk
  foreign key (workspace_id) references public.socialmedia_workspaces(id) on delete cascade;
alter table public.socialmedia_posts add constraint socialmedia_posts_workspace_fk
  foreign key (workspace_id) references public.socialmedia_workspaces(id) on delete cascade;
alter table public.socialmedia_post_platforms add constraint socialmedia_post_platforms_workspace_fk
  foreign key (workspace_id) references public.socialmedia_workspaces(id) on delete cascade;

create index if not exists socialmedia_profiles_workspace_id_idx on public.socialmedia_profiles(workspace_id);
create index if not exists socialmedia_social_accounts_workspace_id_idx on public.socialmedia_social_accounts(workspace_id);
create index if not exists socialmedia_posts_workspace_id_created_at_idx on public.socialmedia_posts(workspace_id, created_at desc);
create index if not exists socialmedia_post_platforms_workspace_id_idx on public.socialmedia_post_platforms(workspace_id);
create index if not exists socialmedia_workspace_members_workspace_id_idx on public.socialmedia_workspace_members(workspace_id);
create index if not exists socialmedia_workspace_members_profile_id_idx on public.socialmedia_workspace_members(profile_id);

create or replace function public.socialmedia_create_profile()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  profile_name text;
  selected_plan text;
  selected_plan_id uuid;
  new_workspace_id uuid;
begin
  profile_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), nullif(trim(new.raw_user_meta_data ->> 'name'), ''), 'My workspace');
  selected_plan := case lower(coalesce(new.raw_user_meta_data ->> 'plan', 'starter')) when 'pro' then 'pro' when 'premium' then 'premium' else 'starter' end;
  select id into selected_plan_id from public.socialmedia_plans where code = selected_plan;

  insert into public.socialmedia_profiles (id, display_name) values (new.id, nullif(profile_name, 'My workspace')) on conflict (id) do nothing;
  select workspace_id into new_workspace_id from public.socialmedia_profiles where id = new.id;

  if new_workspace_id is null then
    insert into public.socialmedia_workspaces (name, owner_profile_id, plan_id) values (profile_name || '''s workspace', new.id, selected_plan_id) returning id into new_workspace_id;
    update public.socialmedia_profiles set workspace_id = new_workspace_id where id = new.id;
  end if;

  insert into public.socialmedia_workspace_members (workspace_id, profile_id, role, status, joined_at)
  values (new_workspace_id, new.id, 'owner', 'active', now())
  on conflict (workspace_id, profile_id) do update set role = 'owner', status = 'active', updated_at = now();
  return new;
end;
$$;
revoke execute on function public.socialmedia_create_profile() from public, anon, authenticated;

update public.socialmedia_social_accounts a set workspace_id = p.workspace_id from public.socialmedia_profiles p where p.id = a.profile_id and a.workspace_id is null;
update public.socialmedia_posts p set workspace_id = pr.workspace_id from public.socialmedia_profiles pr where pr.id = p.profile_id and p.workspace_id is null;
update public.socialmedia_post_platforms pp set workspace_id = p.workspace_id from public.socialmedia_posts p where p.id = pp.post_id and pp.workspace_id is null;

alter table public.socialmedia_plans enable row level security;
alter table public.socialmedia_workspaces enable row level security;
alter table public.socialmedia_workspace_members enable row level security;

drop policy if exists socialmedia_plans_select_authenticated on public.socialmedia_plans;
create policy socialmedia_plans_select_authenticated on public.socialmedia_plans for select to authenticated using (true);

drop policy if exists socialmedia_workspaces_select_member on public.socialmedia_workspaces;
create policy socialmedia_workspaces_select_member on public.socialmedia_workspaces for select to authenticated using (
  id = (select workspace_id from public.socialmedia_profiles where id = (select auth.uid()))
);

drop policy if exists socialmedia_workspaces_update_owner on public.socialmedia_workspaces;
create policy socialmedia_workspaces_update_owner on public.socialmedia_workspaces for update to authenticated using (
  owner_profile_id = (select auth.uid())
) with check (owner_profile_id = (select auth.uid()));

drop policy if exists socialmedia_workspace_members_select_member on public.socialmedia_workspace_members;
create policy socialmedia_workspace_members_select_member on public.socialmedia_workspace_members for select to authenticated using (
  workspace_id = (select workspace_id from public.socialmedia_profiles where id = (select auth.uid()))
);

drop policy if exists socialmedia_workspace_members_update_owner on public.socialmedia_workspace_members;
create policy socialmedia_workspace_members_update_owner on public.socialmedia_workspace_members for update to authenticated using (
  workspace_id = (select workspace_id from public.socialmedia_profiles where id = (select auth.uid()))
  and exists (select 1 from public.socialmedia_workspaces w where w.id = workspace_id and w.owner_profile_id = (select auth.uid()))
) with check (
  workspace_id = (select workspace_id from public.socialmedia_profiles where id = (select auth.uid()))
);

-- Existing profile-owned policies remain intact for compatibility. The workspace
-- columns establish the shared boundary without changing publishing behavior yet.
