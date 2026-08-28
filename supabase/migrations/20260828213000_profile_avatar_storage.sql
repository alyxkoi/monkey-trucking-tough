-- Private, per-user profile avatars for the authenticated Control Center.
-- No business tables or records are changed. The stable object key makes each
-- successful upload replace the previous image without accumulating old files.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'user-avatars',
  'user-avatars',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists user_avatars_select_own on storage.objects;
create policy user_avatars_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'user-avatars' and name = auth.uid()::text || '/avatar');

drop policy if exists user_avatars_insert_own on storage.objects;
create policy user_avatars_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'user-avatars' and name = auth.uid()::text || '/avatar');

drop policy if exists user_avatars_update_own on storage.objects;
create policy user_avatars_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'user-avatars' and name = auth.uid()::text || '/avatar')
  with check (bucket_id = 'user-avatars' and name = auth.uid()::text || '/avatar');

drop policy if exists user_avatars_delete_own on storage.objects;
create policy user_avatars_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'user-avatars' and name = auth.uid()::text || '/avatar');

commit;
