-- Run as the project database owner. Isolated synthetic accounts, rolled back.
-- Tests the real RPCs under authenticated roles; no player is changed.
begin;
do $test$
declare
  v_user uuid; v_other uuid:=gen_random_uuid(); v_class text; v_state jsonb;
  v_result jsonb; v_session uuid; v_gps uuid; v_before integer; v_after integer;
  v_xp integer; v_path text; v_rows integer; v_error text; v_checks integer:=0;
begin
  insert into auth.users(id,email) values(v_other,'class-check-other-'||v_other||'@example.invalid');
  insert into public.profiles(id,name,age,class) values(v_other,'Class check other',25,'COMMANDER');

  foreach v_class in array array['COMMANDER','TANK','ASSASSIN','RANGER','MAGE'] loop
    v_user:=gen_random_uuid();
    insert into auth.users(id,email) values(v_user,'class-check-'||v_user||'@example.invalid');
    insert into public.profiles(id,name,age,class) values(v_user,'Class check',25,v_class);
    insert into public.attributes(user_id) values(v_user);
    perform set_config('request.jwt.claim.sub',v_user::text,true);
    perform set_config('role','authenticated',true);
    v_state:=public.system_class_special_state_v1();
    assert v_state->>'class'=v_class,'Wrong class state'; v_checks:=v_checks+1;
    if v_class='MAGE' then
      assert v_state->'policy'->>'route'='archive','Mage route missing';
      v_state:=public.system_mage_archive_state();
      assert not (v_state->>'locked')::boolean,'Mage archive locked';
      assert jsonb_array_length(v_state->'books')>0,'Mage catalogue empty';
      assert not exists(select 1 from jsonb_array_elements(v_state->'books') b where coalesce(b->>'embedded_reader_key','')=''),'Missing in-app edition';
      begin perform public.system_start_class_special_v1('MAGE'); raise exception 'Mage start should fail';
      exception when others then assert sqlerrm='USE_THE_GRAND_ARCHIVE',sqlerrm; end;
      v_checks:=v_checks+4;
      perform set_config('role','postgres',true);
      continue;
    end if;
    v_state:=public.system_start_class_special_v1(v_class);
    v_session:=(v_state->'session'->>'id')::uuid;
    assert v_session is not null,'Session missing';
    assert (public.system_start_class_special_v1(v_class)->'session'->>'id')::uuid=v_session,'Start must resume';
    v_checks:=v_checks+2;
    begin perform public.system_complete_class_special_v1(v_session,'{}'); raise exception 'Empty proof should fail';
    exception when others then assert sqlerrm in ('SPECIAL_TIMER_IN_PROGRESS','REFLECTION_REQUIRES_20_TO_2000_CHARACTERS'),sqlerrm; end;
    v_checks:=v_checks+1;
    begin update public.class_special_sessions set xp_reward=99 where id=v_session; raise exception 'Client may not edit rewards';
    exception when insufficient_privilege then null; end;
    v_checks:=v_checks+1;
    perform set_config('request.jwt.claim.sub',v_other::text,true);
    select count(*) into v_rows from public.class_special_sessions where id=v_session;
    assert v_rows=0,'RLS leaked another account';
    begin perform public.system_complete_class_special_v1(v_session,'{}'); raise exception 'Cross-owner claim should fail';
    exception when others then assert sqlerrm='SPECIAL_SESSION_NOT_FOUND',sqlerrm; end;
    v_checks:=v_checks+2;
    perform set_config('request.jwt.claim.sub',v_user::text,true);
    perform set_config('role','postgres',true);
    update public.class_special_sessions set started_at=clock_timestamp()-interval '26 minutes' where id=v_session;
    v_result:=jsonb_build_object('reflection','Completed the practice with controlled effort and a clear result.');
    if v_class='COMMANDER' then
      v_path:=v_user::text||'/'||v_session::text||'/clip.webm';
      v_result:=v_result||jsonb_build_object('storage_path',v_path,'duration_seconds',35);
      perform set_config('role','authenticated',true);
      begin perform public.system_complete_class_special_v1(v_session,v_result); raise exception 'Missing video should fail';
      exception when others then assert sqlerrm='PRIVATE_VIDEO_NOT_UPLOADED',sqlerrm; end;
      v_checks:=v_checks+1;
      perform set_config('role','postgres',true);
      -- Metadata-only fixture tests the database gate, not a physical camera.
      insert into storage.objects(bucket_id,name,owner_id,metadata) values('class-special-clips',v_path,v_user::text,'{"size":20000,"mimetype":"video/webm"}');
    elsif v_class='TANK' then
      v_result:=v_result||jsonb_build_object('exercise','Bodyweight squat','sets','[{"reps":12,"load_kg":0},{"reps":12,"load_kg":0},{"reps":10,"load_kg":0}]'::jsonb);
      perform set_config('role','authenticated',true);
      begin perform public.system_complete_class_special_v1(v_session,v_result||'{"sets":[{"reps":-2,"load_kg":0}]}'); raise exception 'Invalid sets should fail';
      exception when others then assert sqlerrm='RECORD_3_TO_12_SETS',sqlerrm; end;
      v_checks:=v_checks+1;
      perform set_config('role','postgres',true);
    elsif v_class='RANGER' then
      v_gps:=gen_random_uuid();
      insert into public.gps_sessions(id,user_id,status,gps_verified,duration_seconds,distance_km,started_at,ended_at,metadata,route)
      values(v_gps,v_user,'COMPLETED',false,1201,1.2,clock_timestamp()-interval '21 minutes',clock_timestamp(),jsonb_build_object('mission_source_id',v_session),
        '[{"lat":-1.28,"lon":36.82},{"lat":-1.29,"lon":36.82}]');
      v_result:=jsonb_build_object('gps_session_id',v_gps);
      perform set_config('role','authenticated',true);
      begin perform public.system_complete_class_special_v1(v_session,v_result); raise exception 'Unverified GPS should fail';
      exception when others then assert sqlerrm='COMPLETE_THE_LINKED_20_MINUTE_GPS_ROUTE',sqlerrm; end;
      v_checks:=v_checks+1;
      perform set_config('role','postgres',true);
      update public.gps_sessions set gps_verified=true where id=v_gps;
    end if;
    select xp into v_before from public.profiles where id=v_user;
    perform set_config('role','authenticated',true);
    v_state:=public.system_complete_class_special_v1(v_session,v_result);
    assert (v_state->>'reward_awarded')::boolean,'Reward not awarded';
    v_xp:=(v_state->'session'->>'xp_reward')::integer;
    assert v_state->'session'->>'status'='COMPLETED','Completion not recorded';
    assert not (public.system_complete_class_special_v1(v_session,v_result)->>'reward_awarded')::boolean,'Duplicate reward';
    assert public.system_start_class_special_v1(v_class)->'completed_today' <> 'null'::jsonb,'Daily reward limit missing';
    if v_class='COMMANDER' then assert (v_state->'session'->'result'->>'eye_contact_assessed')::boolean=false,'False gaze assessment'; v_checks:=v_checks+1; end if;
    v_checks:=v_checks+4;
    perform set_config('role','postgres',true);
    select coalesce(sum(xp_delta),0) into v_after from public.progression_events where user_id=v_user and source='CLASS_SPECIAL';
    assert v_after=v_xp,'Wrong or duplicate XP';
    select count(*) into v_rows from public.progression_events where user_id=v_user and source='CLASS_SPECIAL' and attribute_delta=1;
    assert v_rows=1,'Wrong attribute award count';
    select count(*) into v_rows from public.journey_events where user_id=v_user and source_id=v_session::text;
    assert v_rows=1,'Duplicate or missing journey receipt';
    v_checks:=v_checks+3;
  end loop;
  -- Cancellation, expired sessions and class changes cannot claim.
  perform set_config('request.jwt.claim.sub',v_other::text,true);
  perform set_config('role','authenticated',true);
  v_state:=public.system_start_class_special_v1('COMMANDER'); v_session:=(v_state->'session'->>'id')::uuid;
  perform public.system_cancel_class_special_v1(v_session);
  begin perform public.system_complete_class_special_v1(v_session,'{}'); raise exception 'Cancelled claim should fail';
  exception when others then assert sqlerrm='SPECIAL_SESSION_CANCELLED',sqlerrm; end;
  v_checks:=v_checks+1;
  v_state:=public.system_start_class_special_v1('COMMANDER'); v_session:=(v_state->'session'->>'id')::uuid;
  perform set_config('role','postgres',true);
  update public.class_special_sessions set expires_at=clock_timestamp()-interval '1 second' where id=v_session;
  perform set_config('role','authenticated',true);
  begin perform public.system_complete_class_special_v1(v_session,'{}'); raise exception 'Expired claim should fail';
  exception when others then assert sqlerrm='SPECIAL_SESSION_EXPIRED',sqlerrm; end;
  v_state:=public.system_start_class_special_v1('COMMANDER');
  assert (v_state->'session'->>'id')::uuid<>v_session,'Expired session did not reset';
  v_session:=(v_state->'session'->>'id')::uuid;
  v_checks:=v_checks+2;
  perform set_config('role','postgres',true);
  update public.profiles set class='TANK' where id=v_other;
  perform set_config('role','authenticated',true);
  begin perform public.system_complete_class_special_v1(v_session,'{}'); raise exception 'Changed class claim should fail';
  exception when others then assert sqlerrm='CLASS_CHANGED_REFRESH',sqlerrm; end;
  v_state:=public.system_start_class_special_v1('TANK');
  assert v_state->'session'->>'class'='TANK','Class change did not start correct practice';
  v_checks:=v_checks+2;
  perform set_config('role','postgres',true);
  perform set_config('system.class_check_report',jsonb_build_object('checks_passed',v_checks,'classes',5,'rollback',true)::text,true);
end $test$;
select current_setting('system.class_check_report')::jsonb as report;
rollback;
