-- Phase 28: fix the PL/pgSQL variable/column ambiguity in webhook event queuing.
create or replace function public.socialmedia_record_webhook_event(
  p_profile_id uuid,
  p_event_type text,
  p_aggregate_type text,
  p_aggregate_id uuid,
  p_payload jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  if p_event_type not in (
    'post.created','post.updated','post.scheduled','post.publishing',
    'post.published','post.failed','post.cancelled',
    'account.connected','account.disconnected','media.uploaded'
  ) then
    raise exception 'Unsupported webhook event type';
  end if;

  insert into public.socialmedia_webhook_events(profile_id, event_type, payload)
  values (p_profile_id, p_event_type, coalesce(p_payload, '{}'::jsonb))
  returning id into v_event_id;

  insert into public.socialmedia_webhook_deliveries(webhook_id, event_id)
  select w.id, v_event_id
  from public.socialmedia_webhooks w
  where w.profile_id = p_profile_id
    and w.status in ('active','failing')
    and (cardinality(w.events) = 0 or p_event_type = any(w.events))
  on conflict (webhook_id, event_id) do nothing;

  return v_event_id;
end;
$$;

revoke execute on function public.socialmedia_record_webhook_event(uuid,text,text,uuid,jsonb) from public, anon, authenticated;
