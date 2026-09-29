-- API-4: support partial platform results and API post status reporting.
alter table public.socialmedia_post_platforms
  alter column social_account_id drop not null,
  add column if not exists platform text;

update public.socialmedia_post_platforms p
set platform = a.platform
from public.socialmedia_social_accounts a
where p.social_account_id = a.id
  and p.platform is null;

alter table public.socialmedia_post_platforms
  drop constraint if exists socialmedia_post_platforms_status_check,
  add constraint socialmedia_post_platforms_status_check
    check (status in ('pending','scheduled','publishing','published','failed','skipped')),
  drop constraint if exists socialmedia_post_platforms_destination_check,
  add constraint socialmedia_post_platforms_destination_check
    check (
      (status = 'skipped' and social_account_id is null and platform is not null)
      or
      (status <> 'skipped' and social_account_id is not null)
    );

create unique index if not exists socialmedia_post_platforms_post_platform_idx
  on public.socialmedia_post_platforms(post_id, platform)
  where platform is not null;

create index if not exists socialmedia_post_platforms_platform_status_idx
  on public.socialmedia_post_platforms(platform, status);

create or replace function public.socialmedia_validate_platform_transition()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if old.status = 'pending' and new.status in ('scheduled', 'skipped') then
    return new;
  elsif old.status = 'scheduled' and new.status in ('pending', 'publishing', 'failed', 'skipped') then
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

drop trigger if exists socialmedia_post_platforms_status_transition on public.socialmedia_post_platforms;
create trigger socialmedia_post_platforms_status_transition
before update of status on public.socialmedia_post_platforms
for each row execute function public.socialmedia_validate_platform_transition();

revoke execute on function public.socialmedia_validate_platform_transition() from public;
