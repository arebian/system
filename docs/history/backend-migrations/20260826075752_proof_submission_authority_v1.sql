create or replace function public.system_submit_proof(
 p_title text,p_proof_type text,p_storage_path text default null,p_mime_type text default null,p_file_size bigint default null,p_related_event_type text default null,p_related_event_id text default null,p_note text default null,p_metadata jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_id bigint;
begin
 if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
 if length(trim(coalesce(p_title,'')))<2 then raise exception 'INVALID_PROOF_TITLE'; end if;
 if upper(coalesce(p_proof_type,'')) not in ('IMAGE','VIDEO','GPS','LEARNING','DOCUMENT','CHECKIN','OTHER') then raise exception 'INVALID_PROOF_TYPE'; end if;
 insert into public.proof_records(user_id,title,proof_type,note,storage_path,mime_type,file_size,related_event_type,related_event_id,metadata,verification_status,verification_source)
 values(v_user,trim(p_title),upper(p_proof_type),p_note,p_storage_path,p_mime_type,p_file_size,p_related_event_type,p_related_event_id,coalesce(p_metadata,'{}'::jsonb),'PENDING','SYSTEM') returning id into v_id;
 return jsonb_build_object('proof_id',v_id,'verification_status','PENDING');
end $$;
revoke all on function public.system_submit_proof(text,text,text,text,bigint,text,text,text,jsonb) from public,anon;
grant execute on function public.system_submit_proof(text,text,text,text,bigint,text,text,text,jsonb) to authenticated,service_role;
