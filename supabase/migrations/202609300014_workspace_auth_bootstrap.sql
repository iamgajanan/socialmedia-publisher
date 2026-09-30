-- Phase 12A: every newly created auth user receives one owner workspace.
-- Uses an explicit search_path for the SECURITY DEFINER trigger function.

create or replace function public.socialmedia_create_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_name text;
  workspace_id uuid;
begin
  profile_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    'My workspace'
  );

  insert into public.socialmedia_profiles (id, display_name)
  values (new.id, nullif(profile_name, 'My workspace'))
  on conflict (id) do nothing;

  select p.workspace_id into workspace_id
  from public.socialmedia_profiles p
  where p.id = new.id;

  if workspace_id is null then
    insert into public.socialmedia_workspaces (name, owner_profile_id)
    values (profile_name || '''s workspace', new.id)
    returning id into workspace_id;

    update public.socialmedia_profiles
    set workspace_id = workspace_id
    where id = new.id;
  end if;

  insert into public.socialmedia_workspace_members (workspace_id, profile_id, role, status)
  values (workspace_id, new.id, 'owner', 'active')
  on conflict (workspace_id, profile_id) do update
    set role = 'owner', status = 'active', updated_at = now();

  return new;
end;
$$;

revoke execute on function public.socialmedia_create_profile() from public, anon, authenticated;
