insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'social-media-assets',
  'social-media-assets',
  false,
  104857600,
  array[
    'image/jpeg','image/png','image/webp','image/gif','image/avif',
    'video/mp4','video/webm','video/quicktime','video/x-matroska'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "social_media_assets_insert_own" on storage.objects;
create policy "social_media_assets_insert_own"
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'social-media-assets'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "social_media_assets_select_own" on storage.objects;
create policy "social_media_assets_select_own"
on storage.objects
for select to authenticated
using (
  bucket_id = 'social-media-assets'
  and owner_id = (select auth.uid()::text)
);

drop policy if exists "social_media_assets_delete_own" on storage.objects;
create policy "social_media_assets_delete_own"
on storage.objects
for delete to authenticated
using (
  bucket_id = 'social-media-assets'
  and owner_id = (select auth.uid()::text)
);
