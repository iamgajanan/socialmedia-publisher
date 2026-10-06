-- Phase 28 follow-up: keep one webhook registration per profile + destination URL
-- and enrich post lifecycle payloads with the information automation consumers need.

-- Older development/testing runs could have created the same destination URL more
-- than once. Keep the newest registration and let the FK cascade remove its
-- duplicate delivery rows before adding the uniqueness guarantee.
with ranked as (
  select
    id,
    row_number() over (
      partition by profile_id, lower(btrim(url))
      order by created_at desc, id desc
    ) as rn
  from public.socialmedia_webhooks
)
delete from public.socialmedia_webhooks w
using ranked r
where w.id = r.id
  and r.rn > 1;

create unique index if not exists socialmedia_webhooks_profile_url_unique_idx
  on public.socialmedia_webhooks(profile_id, lower(btrim(url)));

-- Replace the post trigger with a richer event envelope. The destination list is
-- resolved at event creation time, so post.published contains the actual social
-- accounts/platforms and provider post IDs that were published.
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
    perform public.socialmedia_record_webhook_event(
      new.profile_id,
      event_name,
      'post',
      new.id,
      jsonb_build_object(
        'post_id', new.id,
        'content', new.content,
        'media_urls', new.media_urls,
        'status', new.status,
        'scheduled_at', new.scheduled_at,
        'published_at', new.published_at,
        'created_at', new.created_at,
        'updated_at', new.updated_at,
        'platforms', coalesce(
          (
            select to_jsonb(array_agg(distinct a.platform order by a.platform))
            from public.socialmedia_post_platforms pp
            join public.socialmedia_social_accounts a on a.id = pp.social_account_id
            where pp.post_id = new.id
          ),
          '[]'::jsonb
        ),
        'destinations', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'social_account_id', a.id,
                'platform', a.platform,
                'account_name', a.account_name,
                'username', a.username,
                'status', pp.status,
                'platform_post_id', pp.platform_post_id,
                'scheduled_at', pp.scheduled_at,
                'published_at', pp.published_at,
                'error_message', pp.error_message
              )
              order by a.platform, a.account_name
            )
            from public.socialmedia_post_platforms pp
            join public.socialmedia_social_accounts a on a.id = pp.social_account_id
            where pp.post_id = new.id
          ),
          '[]'::jsonb
        )
      )
    );
  end if;

  return new;
end;
$$;

revoke execute on function public.socialmedia_emit_post_webhook_event() from public, anon, authenticated;
