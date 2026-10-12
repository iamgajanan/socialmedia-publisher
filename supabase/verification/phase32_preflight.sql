-- Phase 32 production migration preflight (READ ONLY).
-- Run against the confirmed OmniSocial Supabase project BEFORE applying
-- 202610080002_phase32_multitenant_branding_usage.sql.
-- This script never writes rows or changes schema. It fails closed if prerequisites
-- are missing or if the migration's required profile-to-workspace backfills cannot succeed.

do $phase32_preflight$
declare
  requirement record;
  missing_items text[] := array[]::text[];
  problem_count bigint;
begin
  for requirement in
    select * from (values
      ('socialmedia_profiles'),
      ('socialmedia_workspaces'),
      ('socialmedia_workspace_members'),
      ('socialmedia_social_accounts'),
      ('socialmedia_posts'),
      ('socialmedia_api_keys'),
      ('socialmedia_ai_generations'),
      ('socialmedia_ai_content_variants'),
      ('socialmedia_mcp_audit_logs')
    ) as expected(table_name)
  loop
    if to_regclass(format('public.%I', requirement.table_name)) is null then
      missing_items := array_append(missing_items, format('table public.%I', requirement.table_name));
    end if;
  end loop;

  if cardinality(missing_items) > 0 then
    raise exception 'Phase 32 preflight failed; missing prerequisite tables: %',
      array_to_string(missing_items, ', ');
  end if;

  for requirement in
    select * from (values
      ('socialmedia_profiles', 'id'),
      ('socialmedia_profiles', 'workspace_id'),
      ('socialmedia_workspaces', 'id'),
      ('socialmedia_workspaces', 'name'),
      ('socialmedia_workspace_members', 'workspace_id'),
      ('socialmedia_workspace_members', 'profile_id'),
      ('socialmedia_social_accounts', 'profile_id'),
      ('socialmedia_social_accounts', 'workspace_id'),
      ('socialmedia_posts', 'profile_id'),
      ('socialmedia_posts', 'workspace_id'),
      ('socialmedia_api_keys', 'profile_id'),
      ('socialmedia_ai_generations', 'profile_id'),
      ('socialmedia_ai_content_variants', 'generation_id'),
      ('socialmedia_ai_content_variants', 'profile_id'),
      ('socialmedia_mcp_audit_logs', 'profile_id')
    ) as expected(table_name, column_name)
  loop
    if not exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = requirement.table_name
        and c.column_name = requirement.column_name
    ) then
      missing_items := array_append(
        missing_items,
        format('column public.%I.%I', requirement.table_name, requirement.column_name)
      );
    end if;
  end loop;

  if cardinality(missing_items) > 0 then
    raise exception 'Phase 32 preflight failed; missing prerequisite columns: %',
      array_to_string(missing_items, ', ');
  end if;

  execute $query$
    select count(*)
    from public.socialmedia_profiles p
    left join public.socialmedia_workspaces w on w.id = p.workspace_id
    where p.workspace_id is null or w.id is null
  $query$ into problem_count;
  if problem_count > 0 then
    raise exception 'Phase 32 preflight failed: % profile(s) have no valid workspace; repair before migration',
      problem_count;
  end if;

  execute $query$
    select count(*)
    from public.socialmedia_social_accounts a
    left join public.socialmedia_profiles p on p.id = a.profile_id
    left join public.socialmedia_workspaces w on w.id = a.workspace_id
    where p.id is null or a.workspace_id is null or w.id is null
  $query$ into problem_count;
  if problem_count > 0 then
    raise exception 'Phase 32 preflight failed: % social account(s) have invalid profile/workspace ownership',
      problem_count;
  end if;

  execute $query$
    select count(*)
    from public.socialmedia_posts p
    left join public.socialmedia_profiles pr on pr.id = p.profile_id
    left join public.socialmedia_workspaces w on w.id = p.workspace_id
    where pr.id is null or p.workspace_id is null or w.id is null
  $query$ into problem_count;
  if problem_count > 0 then
    raise exception 'Phase 32 preflight failed: % post(s) have invalid profile/workspace ownership',
      problem_count;
  end if;

  execute $query$
    select count(*)
    from public.socialmedia_api_keys k
    left join public.socialmedia_profiles p on p.id = k.profile_id
    where p.id is null or p.workspace_id is null
  $query$ into problem_count;
  if problem_count > 0 then
    raise exception 'Phase 32 preflight failed: % API key(s) cannot be backfilled from a valid profile workspace',
      problem_count;
  end if;

  execute $query$
    select count(*)
    from public.socialmedia_ai_generations g
    left join public.socialmedia_profiles p on p.id = g.profile_id
    where p.id is null or p.workspace_id is null
  $query$ into problem_count;
  if problem_count > 0 then
    raise exception 'Phase 32 preflight failed: % AI generation(s) cannot be backfilled from a valid profile workspace',
      problem_count;
  end if;

  execute $query$
    select count(*)
    from public.socialmedia_ai_content_variants v
    left join public.socialmedia_ai_generations g on g.id = v.generation_id
    left join public.socialmedia_profiles p on p.id = v.profile_id
    where g.id is null or p.id is null or p.workspace_id is null
  $query$ into problem_count;
  if problem_count > 0 then
    raise exception 'Phase 32 preflight failed: % AI variant(s) cannot be assigned a valid workspace',
      problem_count;
  end if;

  execute $query$
    select count(*)
    from public.socialmedia_mcp_audit_logs l
    left join public.socialmedia_profiles p on p.id = l.profile_id
    where p.id is null or p.workspace_id is null
  $query$ into problem_count;
  if problem_count > 0 then
    raise exception 'Phase 32 preflight failed: % MCP audit log(s) cannot be assigned a valid workspace',
      problem_count;
  end if;

  execute $query$
    select count(*)
    from public.socialmedia_profiles p
    where not exists (
      select 1
      from public.socialmedia_workspace_members wm
      where wm.profile_id = p.id
        and wm.workspace_id = p.workspace_id
        and wm.status = 'active'
    )
  $query$ into problem_count;
  if problem_count > 0 then
    raise exception 'Phase 32 preflight warning: % profile(s) lack active membership in their assigned workspace; reconcile membership before release',
      problem_count;
  end if;

  raise notice 'Phase 32 preflight passed: prerequisite tables, columns, and profile/workspace ownership are consistent';
end
$phase32_preflight$;

select 'Phase 32 preflight passed; no data or schema was modified' as preflight_result;
