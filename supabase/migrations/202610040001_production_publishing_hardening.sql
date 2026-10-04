-- Phase 17: production publishing hardening.
-- Keep stale in-flight destination scans bounded as the publishing table grows.
create index if not exists socialmedia_post_platforms_stale_publishing_idx
  on public.socialmedia_post_platforms(last_attempt_at, id)
  where status = 'publishing' and last_attempt_at is not null;
