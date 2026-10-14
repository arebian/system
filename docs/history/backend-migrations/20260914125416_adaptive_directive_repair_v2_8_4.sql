-- THE SYSTEM 2.8.4 — Adaptive directives must be class-compatible Standards.
-- The previous browser-only selector could choose another class's Must quest,
-- which the authoritative completion RPC correctly rejected.

insert into public.quest_library (
  code,
  title,
  objective,
  system_message,
  category,
  quest_type,
  difficulty,
  class_affinity,
  attribute_reward,
  attribute_delta,
  xp_reward,
  failure_xp_penalty,
  duration_minutes,
  min_level,
  health_value,
  procrastination_tag,
  frequency,
  active,
  metadata
) values
  (
    'adaptive_physical_momentum_walk',
    'MOMENTUM WALK',
    'Move for 20 minutes at a safe, self-selected pace. Stop if pain or dizziness appears.',
    'Physical consistency is rebuilt through a controlled, repeatable session.',
    'PHYSICAL',
    'STANDARD',
    'EASY',
    '{}'::text[],
    'ENDURANCE',
    1,
    35,
    0,
    20,
    1,
    5,
    'START_SMALL',
    'ROTATING',
    true,
    jsonb_build_object('adaptive', true, 'proof_type', 'PERFORMANCE')
  ),
  (
    'adaptive_physical_mobility_baseline',
    'MOBILITY BASELINE',
    'Complete 10 minutes of gentle mobility for the areas that feel stiff today. Keep every movement controlled.',
    'Restore range before asking the body for more output.',
    'PHYSICAL',
    'STANDARD',
    'EASY',
    '{}'::text[],
    'SPEED',
    1,
    30,
    0,
    10,
    1,
    4,
    'LOW_FRICTION',
    'ROTATING',
    true,
    jsonb_build_object('adaptive', true, 'proof_type', 'PERFORMANCE')
  ),
  (
    'adaptive_physical_foundation_set',
    'FOUNDATION SET',
    'Complete one short bodyweight or resistance set that matches your current ability, then record the result.',
    'A modest completed set is stronger than an ambitious plan left undone.',
    'PHYSICAL',
    'STANDARD',
    'EASY',
    '{}'::text[],
    'STRENGTH',
    1,
    35,
    0,
    12,
    1,
    4,
    'START_SMALL',
    'ROTATING',
    true,
    jsonb_build_object('adaptive', true, 'proof_type', 'PERFORMANCE')
  )
on conflict (code) do update set
  title = excluded.title,
  objective = excluded.objective,
  system_message = excluded.system_message,
  category = excluded.category,
  quest_type = excluded.quest_type,
  difficulty = excluded.difficulty,
  class_affinity = excluded.class_affinity,
  attribute_reward = excluded.attribute_reward,
  attribute_delta = excluded.attribute_delta,
  xp_reward = excluded.xp_reward,
  failure_xp_penalty = excluded.failure_xp_penalty,
  duration_minutes = excluded.duration_minutes,
  min_level = excluded.min_level,
  health_value = excluded.health_value,
  procrastination_tag = excluded.procrastination_tag,
  frequency = excluded.frequency,
  active = excluded.active,
  metadata = excluded.metadata,
  updated_at = now();

create or replace function public.system_resolve_adaptive_quest_v2(
  p_category_order text[] default array[]::text[]
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles;
  v_order text[] := array[]::text[];
  v_directive public.quest_library;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_profile
  from public.profiles
  where id = v_user;

  if not found then
    raise exception 'PROFILE_NOT_READY';
  end if;

  select coalesce(
    array_agg(source.category order by source.position),
    array[]::text[]
  )
  into v_order
  from (
    select upper(value) as category, min(ordinality) as position
    from unnest(coalesce(p_category_order, array[]::text[]))
      with ordinality as requested(value, ordinality)
    where upper(value) = any(array[
      'PHYSICAL',
      'WEALTH',
      'LEARNING',
      'FOCUS',
      'RECOVERY'
    ])
    group by upper(value)
  ) source;

  if cardinality(v_order) = 0 then
    v_order := array[
      'PHYSICAL',
      'WEALTH',
      'LEARNING',
      'FOCUS',
      'RECOVERY'
    ];
  end if;

  select * into v_directive
  from public.quest_library q
  where q.active = true
    and q.quest_type = 'STANDARD'
    and upper(q.category) = any(v_order)
    and q.min_level <= coalesce(v_profile.level, 1)
    and (
      cardinality(q.class_affinity) = 0
      or upper(coalesce(v_profile.class, '')) = any(q.class_affinity)
    )
  order by
    array_position(v_order, upper(q.category)),
    md5(v_user::text || ':' || current_date::text || ':' || q.code),
    q.health_value desc,
    q.code asc
  limit 1;

  if not found then
    return jsonb_build_object(
      'directive', null,
      'reason', 'NO_COMPATIBLE_ADAPTIVE_DIRECTIVE'
    );
  end if;

  return jsonb_build_object(
    'directive',
    jsonb_build_object(
      'id', v_directive.id,
      'code', v_directive.code,
      'name', v_directive.title,
      'task', v_directive.objective,
      'category', v_directive.category,
      'xp', v_directive.xp_reward,
      'attribute', v_directive.attribute_reward,
      'attribute_delta', v_directive.attribute_delta,
      'proof_type', coalesce(v_directive.metadata->>'proof_type', ''),
      'metadata', v_directive.metadata
    )
  );
end;
$function$;

revoke all on function public.system_resolve_adaptive_quest_v2(text[]) from public, anon;
grant execute on function public.system_resolve_adaptive_quest_v2(text[]) to authenticated;

