-- Phase 23: performance indexes for scheduled/retry worker scans and platform-filtered history.
-- These indexes keep high-frequency worker queries bounded as post volume grows.

create index if not exists socialmedia_posts_status_scheduled_idx
  on public.socialmedia_posts(status, scheduled_at)
  where scheduled_at is not null;

create index if not exists socialmedia_post_platforms_status_retry_idx
  on public.socialmedia_post_platforms(status, next_retry_at)
  where next_retry_at is not null;

create index if not exists socialmedia_post_platforms_status_attempt_idx
  on public.socialmedia_post_platforms(status, last_attempt_at)
  where last_attempt_at is not null;

create index if not exists socialmedia_post_platforms_platform_post_idx
  on public.socialmedia_post_platforms(platform, post_id);
