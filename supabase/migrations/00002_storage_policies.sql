-- Storage policies for the audio bucket
-- Allows authenticated and anonymous users to upload/read audio files
-- Application-level auth (session tokens) is enforced by API routes

create policy "Allow audio uploads"
  on storage.objects for insert
  with check (bucket_id = 'audio');

create policy "Allow audio reads"
  on storage.objects for select
  using (bucket_id = 'audio');

create policy "Allow audio updates"
  on storage.objects for update
  using (bucket_id = 'audio');
