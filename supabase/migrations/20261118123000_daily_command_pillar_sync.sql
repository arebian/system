-- THE SYSTEM: expose all three authoritative pillar quests to the Daily Command Brief.
create or replace function public.system_daily_pillar_directives_v1(
  p_assigned_for date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_for_date date := coalesce(p_assigned_for, current_date);
  v_result jsonb;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'quest_id', q.id,
        'pillar', upper(q.metadata->>'target_pillar'),
        'title', q.title_snapshot,
        'objective', q.objective_snapshot,
        'status', q.status,
        'xp', q.xp_reward,
        'expires_at', q.expires_at,
        'completed_missions', coalesce(o.completed_missions, 0),
        'total_missions', 3,
        'cement', coalesce(p.cement, 0)
      )
      order by case upper(q.metadata->>'target_pillar')
        when 'DISCIPLINE' then 1
        when 'PHYSICAL' then 2
        when 'MENTAL' then 3
        else 4
      end
    ),
    '[]'::jsonb
  )
  into v_result
  from public.user_quests q
  left join lateral (
    select count(*) filter (where objective.status = 'COMPLETED')::integer as completed_missions
    from public.user_quest_objectives objective
    where objective.user_quest_id = q.id
      and objective.user_id = v_user
  ) o on true
  left join public.user_pillar_progress p
    on p.user_id = q.user_id
   and p.pillar = upper(q.metadata->>'target_pillar')
  where q.user_id = v_user
    and q.quest_type = 'MUST'
    and q.assigned_for = v_for_date
    and q.metadata->>'pillar_quest' = 'true'
    and upper(q.metadata->>'target_pillar') in ('DISCIPLINE', 'PHYSICAL', 'MENTAL')
    and q.status in ('ACCEPTED', 'COMPLETED', 'FAILED');

  return v_result;
end;
$function$;

revoke all on function public.system_daily_pillar_directives_v1(date) from public, anon;
grant execute on function public.system_daily_pillar_directives_v1(date) to authenticated;
