create index if not exists socialmedia_post_platforms_post_account_idx
on public.socialmedia_post_platforms(post_id, social_account_id);

create index if not exists socialmedia_posts_profile_status_idx
on public.socialmedia_posts(profile_id, status, created_at desc);
