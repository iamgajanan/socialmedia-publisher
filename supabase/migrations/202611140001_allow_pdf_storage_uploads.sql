-- Allow LinkedIn PDF document uploads to the existing private media bucket.
-- Keep the current image/video allowlist and 100 MB upload limit unchanged.
update storage.buckets
set allowed_mime_types = array[
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
  'application/pdf'
]::text[]
where id = 'social-media-assets';
