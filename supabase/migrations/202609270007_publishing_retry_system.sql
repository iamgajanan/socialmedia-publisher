-- Phase 8E: per-destination retry metadata for scheduled publishing.
alter table public.socialmedia_post_platforms
  add column if not exists retry_count integer not null default 0,
  add column if not exists max_retries integer not null default 3,
  add column if not exists next_retry_at timestamptz,
  add column if not exists last_attempt_at timestamptz;

alter table public.socialmedia_post_platforms
  drop constraint if exists socialmedia_post_platforms_retry_count_check,
  drop constraint if exists socialmedia_post_platforms_max_retries_check;

alter table public.socialmedia_post_platforms
  add constraint socialmedia_post_platforms_retry_count_check check (retry_count >= 0),
  add constraint socialmedia_post_platforms_max_retries_check check (max_retries between 0 and 10);

create index if not exists socialmedia_post_platforms_retry_queue_idx
  on public.socialmedia_post_platforms(status, next_retry_at)
  where status = 'failed' and next_retry_at is not null;
