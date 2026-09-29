-- Phase 6: preserve scheduled-post history when a post is cancelled.
alter table public.socialmedia_posts
  drop constraint if exists socialmedia_posts_status_check,
  add constraint socialmedia_posts_status_check
    check (status in ('draft','scheduled','publishing','published','failed','cancelled'));

create index if not exists socialmedia_posts_profile_id_status_idx
  on public.socialmedia_posts(profile_id, status);
