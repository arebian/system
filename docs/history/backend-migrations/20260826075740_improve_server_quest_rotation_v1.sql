create or replace function public.system_generate_daily_quests(p_for_date date default current_date)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_class text; v_level int; v_q record; v_count int:=0; v_ids jsonb:='[]'::jsonb;
begin
 if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
 select class,level into v_class,v_level from public.profiles where id=v_user;
 if v_class is null then raise exception 'PROFILE_NOT_READY'; end if;
 for v_q in
   select q.* from public.quest_library q
   where q.active=true and q.min_level<=coalesce(v_level,1)
     and (q.class_affinity is null or cardinality(q.class_affinity)=0 or upper(v_class)=any(q.class_affinity))
     and coalesce(q.frequency,'ROTATING') in ('DAILY','ROTATING','ANY')
     and not exists(select 1 from public.user_quests uq where uq.user_id=v_user and uq.quest_id=q.id and uq.assigned_for=p_for_date)
   order by
     case when q.frequency='DAILY' then 0 else 1 end,
     case when upper(v_class)=any(coalesce(q.class_affinity,array[]::text[])) then 0 else 1 end,
     md5(v_user::text||p_for_date::text||q.id::text)
   limit 4
 loop
   insert into public.user_quests(user_id,quest_id,assigned_for,quest_type,title_snapshot,objective_snapshot,category,status,source,expires_at,xp_reward,xp_penalty,attribute_reward,attribute_delta,consequence,metadata)
   values(v_user,v_q.id,p_for_date,v_q.quest_type,v_q.title,v_q.objective,v_q.category,'ASSIGNED','SYSTEM',((p_for_date+1)::timestamp at time zone 'UTC'),v_q.xp_reward,v_q.failure_xp_penalty,v_q.attribute_reward,v_q.attribute_delta,case when coalesce(v_q.failure_xp_penalty,0)>0 then '-'||v_q.failure_xp_penalty||' XP' else null end,jsonb_build_object('generated_by','SYSTEM','library_code',v_q.code,'rotation_seed',md5(v_user::text||p_for_date::text)))
   returning id into v_q.id;
   v_ids:=v_ids||jsonb_build_array(v_q.id); v_count:=v_count+1;
 end loop;
 return jsonb_build_object('assigned',v_count,'quest_ids',v_ids,'date',p_for_date);
end $$;
revoke all on function public.system_generate_daily_quests(date) from public,anon;
grant execute on function public.system_generate_daily_quests(date) to authenticated,service_role;
