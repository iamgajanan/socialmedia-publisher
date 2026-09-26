-- Phase 9: indexes supporting post history search/filter and detail queries.
create index if not exists socialmedia_posts_profile_status_created_idx
  on public.socialmedia_posts(profile_id, status, created_at desc);

create index if not exists socialmedia_posts_profile_scheduled_idx
  on public.socialmedia_posts(profile_id, scheduled_at)
  where scheduled_at is not null;

create index if not exists socialmedia_post_platforms_post_status_idx
  on public.socialmedia_post_platforms(post_id, status);
