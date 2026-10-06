-- Phase 28: automatically emit core lifecycle events from existing tables.
create or replace function public.socialmedia_emit_post_webhook_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare event_name text;
begin
  if tg_op = 'INSERT' then
    event_name := 'post.created';
  elsif new.status is distinct from old.status then
    event_name := case new.status
      when 'scheduled' then 'post.scheduled'
      when 'publishing' then 'post.publishing'
      when 'published' then 'post.published'
      when 'failed' then 'post.failed'
      when 'cancelled' then 'post.cancelled'
      else null
    end;
  elsif new.content is distinct from old.content or new.media_urls is distinct from old.media_urls then
    event_name := 'post.updated';
  end if;
  if event_name is not null then
    perform public.socialmedia_record_webhook_event(new.profile_id,event_name,'post',new.id,jsonb_build_object('post_id',new.id,'status',new.status,'scheduled_at',new.scheduled_at,'published_at',new.published_at));
  end if;
  return new;
end;
$$;

drop trigger if exists socialmedia_posts_webhook_events on public.socialmedia_posts;
create trigger socialmedia_posts_webhook_events after insert or update on public.socialmedia_posts for each row execute function public.socialmedia_emit_post_webhook_event();

create or replace function public.socialmedia_emit_account_webhook_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare event_name text;
begin
  if tg_op = 'INSERT' then event_name := 'account.connected';
  elsif old.status is distinct from new.status and new.status = 'disconnected' then event_name := 'account.disconnected';
  elsif old.status is distinct from new.status and new.status = 'connected' then event_name := 'account.connected';
  end if;
  if event_name is not null then
    perform public.socialmedia_record_webhook_event(new.profile_id,event_name,'social_account',new.id,jsonb_build_object('social_account_id',new.id,'platform',new.platform,'account_name',new.account_name,'status',new.status));
  end if;
  return new;
end;
$$;

drop trigger if exists socialmedia_social_accounts_webhook_events on public.socialmedia_social_accounts;
create trigger socialmedia_social_accounts_webhook_events after insert or update on public.socialmedia_social_accounts for each row execute function public.socialmedia_emit_account_webhook_event();

revoke execute on function public.socialmedia_emit_post_webhook_event() from public, anon, authenticated;
revoke execute on function public.socialmedia_emit_account_webhook_event() from public, anon, authenticated;
