-- Least-privilege hardening for the shared public schema.
-- Preserve service_role/postgres access and all row-level policies. Browser roles
-- receive only the SQL operations supported by the existing RLS policies.
-- notification_logs has RLS enabled but no policy and is server-managed.

do $grant_hardening$
declare
  target record;
begin
  for target in
    select n.nspname, c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and (c.relname like 'socialmedia\_%' escape '\\' or c.relname = 'notification_logs')
  loop
    execute format(
      'revoke all privileges on table %I.%I from public, anon, authenticated',
      target.nspname,
      target.relname
    );
  end loop;

  -- Serial/identity sequences belonging to the same application tables must
  -- not be independently usable by browser roles.
  for target in
    select n.nspname, c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'S'
      and (
        c.relname like 'socialmedia\_%' escape '\\'
        or c.relname like 'notification_logs\_%' escape '\\'
      )
  loop
    execute format(
      'revoke all privileges on sequence %I.%I from public, anon, authenticated',
      target.nspname,
      target.relname
    );
  end loop;

  -- These helper functions are trigger-only; direct RPC execution is not
  -- part of the browser API. Server-only SECURITY DEFINER functions already
  -- have explicit service_role grants and remain unchanged.
  for target in
    select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'socialmedia\_%' escape '\\'
  loop
    execute format(
      'revoke execute on function %I.%I(%s) from public, anon, authenticated',
      target.nspname,
      target.proname,
      target.args
    );
  end loop;
end;
$grant_hardening$;

-- Regrant only the operations supported by existing RLS policies and needed
-- by current browser-side reads/writes. Sensitive operational tables remain
-- service_role-only.

grant select on table
  public.socialmedia_account_analytics,
  public.socialmedia_ai_content_variants,
  public.socialmedia_ai_generations,
  public.socialmedia_mcp_audit_logs,
  public.socialmedia_notification_logs,
  public.socialmedia_plans,
  public.socialmedia_post_analytics,
  public.socialmedia_social_accounts
to authenticated;

grant select, insert, update, delete on table
  public.socialmedia_posts,
  public.socialmedia_post_platforms,
  public.socialmedia_profiles,
  public.socialmedia_users,
  public.socialmedia_webhooks
to authenticated;

grant select, update on table
  public.socialmedia_workspace_members,
  public.socialmedia_workspaces
to authenticated;

grant select on table public.socialmedia_workspace_usage_monthly to authenticated;

-- Prevent new public-schema tables, sequences, and functions created by either
-- migration owner from silently inheriting browser access. Existing unrelated
-- tables are not changed by these default-privilege rules.
alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated;
alter default privileges for role supabase_admin in schema public
  revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon, authenticated;
alter default privileges for role supabase_admin in schema public
  revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role supabase_admin in schema public
  revoke execute on functions from public, anon, authenticated;

comment on table public.notification_logs is
  'Server-managed notification history. RLS enabled; browser-role table privileges revoked.';
