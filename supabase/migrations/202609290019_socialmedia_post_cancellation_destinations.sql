-- Phase 6: allow cancellation of connected publishing destinations.
-- A cancelled destination may retain its connected social account for result history.
alter table public.socialmedia_post_platforms
  drop constraint if exists socialmedia_post_platforms_destination_check,
  add constraint socialmedia_post_platforms_destination_check
    check (
      (status = 'skipped' and platform is not null)
      or
      (status <> 'skipped' and social_account_id is not null)
    );
