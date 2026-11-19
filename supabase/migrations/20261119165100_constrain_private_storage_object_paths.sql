drop policy if exists proof_files_select_own on storage.objects;
drop policy if exists proof_files_insert_own on storage.objects;
drop policy if exists proof_files_update_own on storage.objects;
drop policy if exists proof_files_delete_own on storage.objects;

create policy proof_files_select_own
on storage.objects for select to authenticated
using (
  bucket_id = 'proofs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and array_length(storage.foldername(name), 1) = 1
);

create policy proof_files_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id = 'proofs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and array_length(storage.foldername(name), 1) = 1
);

create policy proof_files_update_own
on storage.objects for update to authenticated
using (
  bucket_id = 'proofs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and array_length(storage.foldername(name), 1) = 1
)
with check (
  bucket_id = 'proofs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and array_length(storage.foldername(name), 1) = 1
);

create policy proof_files_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'proofs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and array_length(storage.foldername(name), 1) = 1
);

drop policy if exists class_special_clip_read on storage.objects;
drop policy if exists class_special_clip_upload on storage.objects;
drop policy if exists class_special_clip_delete on storage.objects;

create policy class_special_clip_read
on storage.objects for select to authenticated
using (
  bucket_id = 'class-special-clips'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and array_length(storage.foldername(name), 1) = 2
);

create policy class_special_clip_upload
on storage.objects for insert to authenticated
with check (
  bucket_id = 'class-special-clips'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and array_length(storage.foldername(name), 1) = 2
  and exists (
    select 1
    from public.class_special_sessions s
    where s.user_id = (select auth.uid())
      and s.id::text = (storage.foldername(objects.name))[2]
      and s.class = 'COMMANDER'
      and s.status = 'ACTIVE'
      and s.expires_at > now()
  )
);

create policy class_special_clip_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'class-special-clips'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and array_length(storage.foldername(name), 1) = 2
);
