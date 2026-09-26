-- Phase 8F: stable idempotency key for each post/destination publishing operation.
alter table public.socialmedia_post_platforms
  add column if not exists idempotency_key text;

create unique index if not exists socialmedia_post_platforms_idempotency_key_idx
  on public.socialmedia_post_platforms(idempotency_key)
  where idempotency_key is not null;
