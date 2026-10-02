-- Free plan: 10 posts per rolling month and one publishing user.
-- The usage window starts when the first post is created and resets one month later.

insert into public.socialmedia_plans (
  code,
  name,
  monthly_price_inr,
  monthly_price_usd,
  max_team_members,
  max_users,
  max_social_accounts,
  monthly_post_limit,
  unlimited_publishing
)
values (
  'free',
  'Free',
  0,
  0,
  1,
  1,
  10,
  10,
  false
)
on conflict (code) do update set
  name = excluded.name,
  monthly_price_inr = excluded.monthly_price_inr,
  monthly_price_usd = excluded.monthly_price_usd,
  max_team_members = excluded.max_team_members,
  max_users = excluded.max_users,
  max_social_accounts = excluded.max_social_accounts,
  monthly_post_limit = excluded.monthly_post_limit,
  unlimited_publishing = excluded.unlimited_publishing,
  updated_at = now();

alter table public.socialmedia_workspaces
  add column if not exists post_usage_started_at timestamptz,
  add column if not exists post_usage_count integer not null default 0;

alter table public.socialmedia_workspaces
  drop constraint if exists socialmedia_workspaces_post_usage_count_check;

alter table public.socialmedia_workspaces
  add constraint socialmedia_workspaces_post_usage_count_check
  check (post_usage_count >= 0);

-- New signups that do not explicitly choose a plan start on Free.
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
  selected_plan := case lower(coalesce(new.raw_user_meta_data ->> 'plan', 'free'))
    when 'starter' then 'starter'
    when 'pro' then 'pro'
    when 'premium' then 'premium'
    else 'free'
  end;
  select id into selected_plan_id from public.socialmedia_plans where code = selected_plan;

  insert into public.socialmedia_profiles (id, display_name)
  values (new.id, nullif(profile_name, 'My workspace'))
  on conflict (id) do nothing;

  select workspace_id into new_workspace_id
  from public.socialmedia_profiles
  where id = new.id;

  if new_workspace_id is null then
    insert into public.socialmedia_workspaces (name, owner_profile_id, plan_id)
    values (profile_name || '''s workspace', new.id, selected_plan_id)
    returning id into new_workspace_id;
    update public.socialmedia_profiles
    set workspace_id = new_workspace_id
    where id = new.id;
  end if;

  insert into public.socialmedia_workspace_members (workspace_id, profile_id, role, status, joined_at)
  values (new_workspace_id, new.id, 'owner', 'active', now())
  on conflict (workspace_id, profile_id) do update
    set role = 'owner', status = 'active', updated_at = now();

  return new;
end;
$$;
revoke execute on function public.socialmedia_create_profile() from public, anon, authenticated;

-- Enforce the quota at the database boundary so both the web app and public API
-- receive the same protection. A workspace row lock serializes concurrent creates.
create or replace function public.socialmedia_enforce_post_limit()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_limit integer;
  v_unlimited boolean;
  v_started_at timestamptz;
  v_used integer;
  v_now timestamptz := now();
begin
  v_workspace_id := new.workspace_id;

  if v_workspace_id is null then
    select p.workspace_id into v_workspace_id
    from public.socialmedia_profiles p
    where p.id = new.profile_id;
    new.workspace_id := v_workspace_id;
  end if;

  if v_workspace_id is null then
    raise exception 'WORKSPACE_NOT_FOUND';
  end if;

  select p.monthly_post_limit, p.unlimited_publishing, w.post_usage_started_at, w.post_usage_count
    into v_limit, v_unlimited, v_started_at, v_used
  from public.socialmedia_workspaces w
  join public.socialmedia_plans p on p.id = w.plan_id
  where w.id = v_workspace_id
  for update of w;

  if not found then
    raise exception 'WORKSPACE_NOT_FOUND';
  end if;

  if coalesce(v_unlimited, false) or coalesce(v_limit, 0) = 0 then
    return new;
  end if;

  if v_started_at is null or v_now >= v_started_at + interval '1 month' then
    update public.socialmedia_workspaces
    set post_usage_started_at = v_now,
        post_usage_count = 1,
        updated_at = v_now
    where id = v_workspace_id;
    return new;
  end if;

  if coalesce(v_used, 0) >= v_limit then
    raise exception 'POST_LIMIT_REACHED';
  end if;

  update public.socialmedia_workspaces
  set post_usage_count = coalesce(post_usage_count, 0) + 1,
      updated_at = v_now
  where id = v_workspace_id;

  return new;
end;
$$;

revoke all on function public.socialmedia_enforce_post_limit() from public, anon, authenticated;

drop trigger if exists socialmedia_posts_plan_limit_trigger on public.socialmedia_posts;
create trigger socialmedia_posts_plan_limit_trigger
before insert on public.socialmedia_posts
for each row execute function public.socialmedia_enforce_post_limit();

-- Used only when a newly-created post has to be rolled back by application logic
-- after a downstream destination insert fails.
create or replace function public.socialmedia_release_post_usage(p_workspace_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  update public.socialmedia_workspaces
  set post_usage_count = greatest(post_usage_count - 1, 0),
      updated_at = now()
  where id = p_workspace_id
    and post_usage_count > 0;
end;
$$;

revoke all on function public.socialmedia_release_post_usage(uuid) from public, anon, authenticated;
comment on column public.socialmedia_workspaces.post_usage_started_at is 'Start of the current rolling free-plan post quota window.';
comment on column public.socialmedia_workspaces.post_usage_count is 'Posts created in the current rolling free-plan quota window.';
