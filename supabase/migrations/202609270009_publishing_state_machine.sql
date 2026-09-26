-- Phase 8G: database-enforced publishing state machine.
create or replace function public.socialmedia_validate_post_transition()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if old.status = 'draft' and new.status = 'scheduled' then
    return new;
  elsif old.status = 'scheduled' and new.status in ('draft', 'publishing', 'failed') then
    return new;
  elsif old.status = 'publishing' and new.status in ('scheduled', 'published', 'failed') then
    return new;
  elsif old.status = 'failed' and new.status in ('draft', 'scheduled') then
    return new;
  end if;

  raise exception 'Invalid socialmedia_posts status transition: % -> %', old.status, new.status
    using errcode = 'check_violation';
end;
$$;

create or replace function public.socialmedia_validate_platform_transition()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if old.status = 'pending' and new.status = 'scheduled' then
    return new;
  elsif old.status = 'scheduled' and new.status in ('pending', 'publishing', 'failed') then
    return new;
  elsif old.status = 'publishing' and new.status in ('scheduled', 'published', 'failed') then
    return new;
  elsif old.status = 'failed' and new.status in ('pending', 'scheduled') then
    return new;
  end if;

  raise exception 'Invalid socialmedia_post_platforms status transition: % -> %', old.status, new.status
    using errcode = 'check_violation';
end;
$$;

drop trigger if exists socialmedia_posts_status_transition on public.socialmedia_posts;
create trigger socialmedia_posts_status_transition
before update of status on public.socialmedia_posts
for each row execute function public.socialmedia_validate_post_transition();

drop trigger if exists socialmedia_post_platforms_status_transition on public.socialmedia_post_platforms;
create trigger socialmedia_post_platforms_status_transition
before update of status on public.socialmedia_post_platforms
for each row execute function public.socialmedia_validate_platform_transition();

revoke execute on function public.socialmedia_validate_post_transition() from public;
revoke execute on function public.socialmedia_validate_platform_transition() from public;
