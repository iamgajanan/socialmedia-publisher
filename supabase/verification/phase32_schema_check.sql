-- Read-only verification for the Phase 32 migration.
-- Run this in the target Supabase project's SQL editor AFTER applying migrations.
-- It raises an exception on the first missing/unsafe schema contract and does not mutate data.

do $verify$
declare
  requirement record;
  missing_items text[] := array[]::text[];
  usage_rpc regprocedure := to_regprocedure('public.socialmedia_workspace_usage(uuid,date)');
  record_rpc regprocedure := to_regprocedure('public.socialmedia_record_api_request(uuid,date)');
begin
  for requirement in
    select * from (values
      ('socialmedia_workspaces', 'slug'),
      ('socialmedia_workspaces', 'logo_url'),
      ('socialmedia_workspaces', 'primary_color'),
      ('socialmedia_workspaces', 'accent_color'),
      ('socialmedia_workspaces', 'custom_domain'),
      ('socialmedia_ai_generations', 'workspace_id'),
      ('socialmedia_ai_content_variants', 'workspace_id'),
      ('socialmedia_mcp_audit_logs', 'workspace_id'),
      ('socialmedia_api_keys', 'workspace_id'),
      ('socialmedia_workspace_members', 'created_at'),
      ('socialmedia_workspace_usage_monthly', 'workspace_id'),
      ('socialmedia_workspace_usage_monthly', 'period_start'),
      ('socialmedia_workspace_usage_monthly', 'api_requests')
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
    raise exception 'Phase 32 verification failed; missing: %', array_to_string(missing_items, ', ');
  end if;

  if to_regclass('public.socialmedia_workspace_usage_monthly') is null then
    raise exception 'Phase 32 verification failed; usage table is missing';
  end if;

  if not exists (
    select 1 from pg_class c
    where c.oid = to_regclass('public.socialmedia_workspace_usage_monthly')
      and c.relrowsecurity
  ) then
    raise exception 'Phase 32 verification failed; usage table RLS is not enabled';
  end if;

  for requirement in
    select * from (values
      ('socialmedia_workspaces', 'socialmedia_workspaces_primary_color_check'),
      ('socialmedia_workspaces', 'socialmedia_workspaces_accent_color_check'),
      ('socialmedia_ai_generations', 'socialmedia_ai_generations_workspace_id_fkey'),
      ('socialmedia_ai_content_variants', 'socialmedia_ai_content_variants_workspace_id_fkey'),
      ('socialmedia_mcp_audit_logs', 'socialmedia_mcp_audit_logs_workspace_id_fkey'),
      ('socialmedia_api_keys', 'socialmedia_api_keys_workspace_id_fkey')
    ) as expected(table_name, constraint_name)
  loop
    if not exists (
      select 1
      from pg_constraint c
      where c.conrelid = to_regclass(format('public.%I', requirement.table_name))
        and c.conname = requirement.constraint_name
    ) then
      raise exception 'Phase 32 verification failed; missing constraint public.%.%',
        requirement.table_name, requirement.constraint_name;
    end if;
  end loop;

  for requirement in
    select unnest(array[
      'socialmedia_workspaces_slug_uidx',
      'socialmedia_workspaces_custom_domain_uidx',
      'socialmedia_ai_generations_workspace_created_idx',
      'socialmedia_ai_variants_workspace_created_idx',
      'socialmedia_mcp_audit_workspace_created_idx',
      'socialmedia_api_keys_workspace_created_idx',
      'socialmedia_workspace_usage_monthly_period_idx'
    ]) as index_name
  loop
    if not exists (
      select 1 from pg_indexes i
      where i.schemaname = 'public'
        and i.indexname = requirement.index_name
    ) then
      raise exception 'Phase 32 verification failed; missing index public.%', requirement.index_name;
    end if;
  end loop;

  if to_regprocedure('private.socialmedia_user_workspace_ids()') is null then
    raise exception 'Phase 32 verification failed; private workspace membership helper is missing';
  end if;

  if not has_schema_privilege('authenticated', 'private', 'USAGE') then
    raise exception 'Phase 32 verification failed; authenticated role lacks usage on the private schema';
  end if;

  if not has_function_privilege('authenticated', 'private.socialmedia_user_workspace_ids()', 'EXECUTE')
     or has_function_privilege('anon', 'private.socialmedia_user_workspace_ids()', 'EXECUTE') then
    raise exception 'Phase 32 verification failed; private workspace membership helper grants are incorrect';
  end if;

  if not (select p.prosecdef from pg_proc p where p.oid = to_regprocedure('private.socialmedia_user_workspace_ids()')::oid) then
    raise exception 'Phase 32 verification failed; workspace membership helper must bypass member-table RLS safely';
  end if;

  if usage_rpc is null then
    raise exception 'Phase 32 verification failed; socialmedia_workspace_usage(uuid,date) is missing';
  end if;

  if record_rpc is null then
    raise exception 'Phase 32 verification failed; socialmedia_record_api_request(uuid,date) is missing';
  end if;

  if not has_function_privilege('authenticated', usage_rpc::oid, 'EXECUTE')
     or has_function_privilege('anon', usage_rpc::oid, 'EXECUTE') then
    raise exception 'Phase 32 verification failed; usage RPC grants are incorrect';
  end if;

  if not has_function_privilege('service_role', record_rpc::oid, 'EXECUTE')
     or has_function_privilege('anon', record_rpc::oid, 'EXECUTE')
     or has_function_privilege('authenticated', record_rpc::oid, 'EXECUTE') then
    raise exception 'Phase 32 verification failed; API request RPC grants are incorrect';
  end if;

  if not (select p.prosecdef from pg_proc p where p.oid = usage_rpc::oid) then
    raise exception 'Phase 32 verification failed; usage RPC must be SECURITY DEFINER with an explicit membership check';
  end if;

  if position('socialmedia_workspace_members' in pg_get_functiondef(usage_rpc::oid)) = 0
     or position('auth.uid()' in pg_get_functiondef(usage_rpc::oid)) = 0 then
    raise exception 'Phase 32 verification failed; usage RPC is missing its workspace membership authorization check';
  end if;

  if not (select p.prosecdef from pg_proc p where p.oid = record_rpc::oid) then
    raise exception 'Phase 32 verification failed; API request RPC must remain SECURITY DEFINER';
  end if;
end
$verify$;

select 'Phase 32 schema, constraints, indexes, functions, and grants verified' as verification_result;
