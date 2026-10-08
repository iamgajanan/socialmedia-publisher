-- Allow AI approval generations to be explicitly rejected.
-- Phase 30/31 originally allowed approved but omitted rejected, which caused
-- the rejection API update to fail at the database constraint.

alter table public.socialmedia_ai_generations
drop constraint if exists socialmedia_ai_generations_status_check;

alter table public.socialmedia_ai_generations
add constraint socialmedia_ai_generations_status_check
check (status in ('processing', 'completed', 'partial', 'failed', 'approved', 'rejected'));
