-- Phase 6: permit cancellation of scheduled posts.
drop trigger if exists socialmedia_posts_status_transition on public.socialmedia_posts;
create trigger socialmedia_posts_status_transition
before update of status on public.socialmedia_posts
for each row
when (new.status <> 'cancelled')
execute function public.socialmedia_validate_post_transition();
