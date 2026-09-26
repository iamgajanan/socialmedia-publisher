drop policy if exists "social_media_assets_update_own" on storage.objects;
create policy "social_media_assets_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'social-media-assets'
  and owner_id = (select auth.uid()::text)
)
with check (
  bucket_id = 'social-media-assets'
  and owner_id = (select auth.uid()::text)
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "social_media_assets_insert_own" on storage.objects;
create policy "social_media_assets_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'social-media-assets'
  and owner_id = (select auth.uid()::text)
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);