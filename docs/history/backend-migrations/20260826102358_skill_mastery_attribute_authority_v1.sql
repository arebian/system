create or replace function public.system_evaluate_skill(p_skill_id bigint)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare
  v_user uuid:=auth.uid(); v_skill public.skills; v_us public.user_skills; v_target numeric; v_value numeric:=0; v_verified boolean:=false; v_reason text:='INSUFFICIENT_EVIDENCE'; v_req jsonb; v_records integer; v_learning_minutes numeric; v_gps_distance numeric; v_proof_count integer; v_mastered_now boolean:=false; v_profile public.profiles; v_attr text; v_attr_delta integer:=0;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.system_skill_available(p_skill_id) then raise exception 'SKILL_LOCKED_OR_UNAVAILABLE'; end if;
  select * into v_skill from public.skills where id=p_skill_id and is_active=true;
  if not found then raise exception 'SKILL_NOT_FOUND'; end if;
  insert into public.user_skills(user_id,skill_id,status,started_at,updated_at) values(v_user,p_skill_id,'IN_PROGRESS',now(),now()) on conflict(user_id,skill_id) do update set status=case when public.user_skills.status='MASTERED' then 'MASTERED' else 'IN_PROGRESS' end,started_at=coalesce(public.user_skills.started_at,now()),updated_at=now();
  select * into v_us from public.user_skills where user_id=v_user and skill_id=p_skill_id for update;
  if v_us.status='MASTERED' then return jsonb_build_object('mastered',true,'already_mastered',true,'skill_id',p_skill_id,'status',v_us.status); end if;
  v_req:=coalesce(v_skill.mastery_requirements,'{}'::jsonb); v_target:=coalesce(v_skill.mastery_target,0);
  if v_skill.category in ('LEARNING','COGNITION','FOCUS','RESEARCH','SYNTHESIS','TEACHING','MASTERY','SYSTEMS','INTELLIGENCE') or (v_skill.class_affinity @> array['MAGE']::text[] and v_req<>'{}'::jsonb) then
    select count(*),coalesce(sum(duration_minutes),0) into v_records,v_learning_minutes from public.learning_records where user_id=v_user and (skill_id=p_skill_id or skill_id is null);
    v_value:=case when coalesce(v_req->>'records','')<>'' then v_records when coalesce(v_req->>'min_hours','')<>'' then v_learning_minutes/60.0 when v_skill.mastery_unit='minutes' then v_learning_minutes when v_skill.mastery_unit='hours' then v_learning_minutes/60.0 else v_records end;
    v_verified:=true;
    if coalesce(v_req->>'records','')<>'' and v_records<(v_req->>'records')::integer then v_verified:=false; end if;
    if coalesce(v_req->>'min_minutes','')<>'' and v_learning_minutes<(v_req->>'min_minutes')::numeric then v_verified:=false; end if;
    if coalesce(v_req->>'min_hours','')<>'' and v_learning_minutes<(v_req->>'min_hours')::numeric*60 then v_verified:=false; end if;
    if coalesce(v_req->>'requires_summary','false')='true' and exists(select 1 from public.learning_records where user_id=v_user and (skill_id=p_skill_id or skill_id is null) and length(trim(learning_summary))<20) then v_verified:=false; end if;
    if coalesce(v_req->>'requires_takeaways','')<>'' and exists(select 1 from public.learning_records where user_id=v_user and (skill_id=p_skill_id or skill_id is null) and jsonb_array_length(coalesce(key_takeaways,'[]'::jsonb))<(v_req->>'requires_takeaways')::integer) then v_verified:=false; end if;
    if coalesce(v_req->>'requires_application','false')='true' and exists(select 1 from public.learning_records where user_id=v_user and (skill_id=p_skill_id or skill_id is null) and coalesce(length(trim(application_plan)),0)<10) then v_verified:=false; end if;
    if v_target>0 and v_value<v_target and coalesce(v_req->>'records','')='' and coalesce(v_req->>'min_hours','')='' and coalesce(v_req->>'min_minutes','')='' then v_verified:=false; end if;
    v_reason:=case when v_verified then 'LEARNING_EVIDENCE_VERIFIED' else 'LEARNING_REQUIREMENTS_INCOMPLETE' end;
  elsif lower(coalesce(v_skill.mastery_unit,'')) in ('km','minutes','minutes_max') or v_skill.category in ('ENDURANCE','RUNNING','EXPLORATION') then
    select coalesce(max(distance_km),0) into v_gps_distance from public.gps_sessions where user_id=v_user and gps_verified=true;
    if lower(coalesce(v_skill.mastery_unit,''))='km' or coalesce(v_req->>'distance_km','')<>'' then v_value:=v_gps_distance; if coalesce(v_req->>'distance_km','')<>'' then v_target:=(v_req->>'distance_km')::numeric; end if; v_verified:=v_target>0 and v_value>=v_target;
    elsif lower(coalesce(v_skill.mastery_unit,''))='minutes' then select coalesce(max(duration_seconds)/60.0,0) into v_value from public.gps_sessions where user_id=v_user and gps_verified=true; v_verified:=v_target>0 and v_value>=v_target;
    elsif lower(coalesce(v_skill.mastery_unit,''))='minutes_max' then select coalesce(min(duration_seconds)/60.0,999999) into v_value from public.gps_sessions where user_id=v_user and gps_verified=true and distance_km>=5; v_verified:=v_target>0 and v_value<=v_target;
    else v_value:=v_gps_distance; v_verified:=coalesce(v_req->>'distance_km','')<>'' and v_value>=(v_req->>'distance_km')::numeric; end if;
    v_reason:=case when v_verified then 'GPS_EVIDENCE_VERIFIED' else 'GPS_REQUIREMENTS_INCOMPLETE' end;
  else
    select count(*) into v_proof_count from public.proof_records where user_id=v_user and verification_status='VERIFIED' and related_event_type='SKILL' and related_event_id=p_skill_id::text;
    v_verified:=v_proof_count>0;
    select coalesce(max(submitted_value),0) into v_value from public.skill_attempts where user_id=v_user and skill_id=p_skill_id and (proof_record_id is null or exists(select 1 from public.proof_records pr where pr.id=proof_record_id and pr.verification_status='VERIFIED'));
    if v_target>0 then v_verified:=v_verified and v_value>=v_target; end if;
    v_reason:=case when v_verified then 'VERIFIED_PROOF_ACCEPTED' else 'VERIFIED_PROOF_REQUIRED' end;
  end if;
  update public.user_skills set progress_value=v_value,progress_unit=v_skill.mastery_unit,best_value=greatest(coalesce(best_value,0),coalesce(v_value,0)),status=case when v_verified then 'MASTERED' else 'IN_PROGRESS' end,mastered_at=case when v_verified then coalesce(mastered_at,now()) else mastered_at end,updated_at=now() where user_id=v_user and skill_id=p_skill_id returning * into v_us;
  if v_verified then
    select * into v_profile from public.system_award_xp(v_skill.xp_reward,'SKILL',v_skill.name,jsonb_build_object('skill_id',v_skill.id));
    v_attr:=upper(coalesce(v_skill.primary_attribute,''));
    if v_attr in ('STRENGTH','SPEED','ENDURANCE','INTELLIGENCE','FOCUS','DISCIPLINE','WEALTH','CHARISMA','CREATIVITY','RECOVERY') then v_attr_delta:=2; perform public.system_add_attribute(v_attr,v_attr_delta,'SKILL',v_skill.name,jsonb_build_object('skill_id',v_skill.id)); end if;
    insert into public.journey_events(user_id,event_type,title,detail,source,source_id,xp_delta,attribute_name,attribute_delta,metadata) values(v_user,'SKILL_MASTERED',v_skill.name,v_reason,'SKILL',v_skill.id::text,v_skill.xp_reward,nullif(v_attr,''),v_attr_delta,jsonb_build_object('value',v_value,'unit',v_skill.mastery_unit));
    v_mastered_now:=true;
  end if;
  return jsonb_build_object('mastered',v_verified,'mastered_now',v_mastered_now,'reason',v_reason,'skill_id',p_skill_id,'value',v_value,'target',v_target,'unit',v_skill.mastery_unit,'status',v_us.status,'attribute',nullif(v_attr,''),'attribute_delta',v_attr_delta);
end $$;
revoke all on function public.system_evaluate_skill(bigint) from public,anon;
grant execute on function public.system_evaluate_skill(bigint) to authenticated,service_role;
