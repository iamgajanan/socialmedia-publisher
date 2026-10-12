-- Keep the private usage RPC result types aligned with its RETURNS TABLE contract.
create or replace function private.socialmedia_workspace_usage(
  target_workspace_id uuid,
  target_period_start date
)
returns table (
  posts_created bigint,
  posts_published bigint,
  ai_generations bigint,
  api_requests bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $workspace_usage$
begin
  if not exists (
    select 1
    from public.socialmedia_workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.profile_id = (select auth.uid())
      and wm.status = 'active'
  ) then
    raise exception 'Not authorized to read workspace usage' using errcode = '42501';
  end if;

  return query
  select
    (select count(*) from public.socialmedia_posts p
      where p.workspace_id = target_workspace_id
        and p.created_at >= target_period_start::timestamptz
        and p.created_at < (target_period_start + interval '1 month')) as posts_created,
    (select count(*) from public.socialmedia_posts p
      where p.workspace_id = target_workspace_id
        and p.status = 'published'
        and p.published_at >= target_period_start::timestamptz
        and p.published_at < (target_period_start + interval '1 month')) as posts_published,
    (select count(*) from public.socialmedia_ai_generations g
      where g.workspace_id = target_workspace_id
        and g.created_at >= target_period_start::timestamptz
        and g.created_at < (target_period_start + interval '1 month')) as ai_generations,
    coalesce((select u.api_requests from public.socialmedia_workspace_usage_monthly u
      where u.workspace_id = target_workspace_id
        and u.period_start = target_period_start), 0)::bigint as api_requests;
end;
$workspace_usage$;
