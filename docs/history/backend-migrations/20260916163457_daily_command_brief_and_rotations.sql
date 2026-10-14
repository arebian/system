-- THE SYSTEM 2.9.0 — DAILY COMMAND BRIEF + QUEST ROTATION
--
-- This migration keeps progression authoritative while making the player’s
-- daily direction clearer. It adds enough class and adaptive directives to
-- sustain a genuine seven-day rotation, and exposes a read-only command
-- summary for the Dashboard. No command response awards XP, accepts a Must,
-- applies a penalty, or changes a player record.

create index if not exists user_quests_rotation_lookup_idx
  on public.user_quests (user_id, quest_id, assigned_for desc);

-- Seven class directives per class: the original three plus four additional
-- realistic, class-aligned rotations. The browser may present them, but the
-- title adapter and XP remain Supabase-authoritative.
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
    'class_assassin_single_thread_strike',
    'SINGLE-THREAD STRIKE',
    'Complete 25 uninterrupted minutes on one meaningful objective with your phone out of reach. Record the concrete result.',
    'Precision begins by removing competing targets.',
    'FOCUS', 'CLASS', 'NORMAL', array['ASSASSIN']::text[], 'FOCUS', 1, 35, 0, 25, 1, 4, 'DEEP_FOCUS', 'ROTATING', true,
    jsonb_build_object('proof_type', 'RESULT', 'class_rotation', true)
  ),
  (
    'class_assassin_clean_footwork',
    'CLEAN FOOTWORK',
    'Complete 15 minutes of controlled footwork, balance or coordination practice. Stop before form becomes sloppy.',
    'Speed without control is only noise.',
    'PHYSICAL', 'CLASS', 'NORMAL', array['ASSASSIN']::text[], 'SPEED', 1, 35, 0, 15, 1, 4, 'CONTROLLED_MOTION', 'ROTATING', true,
    jsonb_build_object('proof_type', 'PERFORMANCE', 'class_rotation', true)
  ),
  (
    'class_assassin_precision_reset',
    'PRECISION RESET',
    'Complete 10 minutes of controlled ankle, hip and shoulder mobility, then identify one movement that feels cleaner.',
    'A sharp system restores its range before demanding speed.',
    'RECOVERY', 'CLASS', 'EASY', array['ASSASSIN']::text[], 'RECOVERY', 1, 30, 0, 10, 1, 3, 'LOW_FRICTION', 'ROTATING', true,
    jsonb_build_object('proof_type', 'PERFORMANCE', 'class_rotation', true)
  ),
  (
    'class_assassin_decisive_cut',
    'DECISIVE CUT',
    'Remove one avoidable distraction from your next work block and complete the first meaningful action it was delaying.',
    'The cleanest strike is the one made after hesitation is removed.',
    'DISCIPLINE', 'CLASS', 'NORMAL', array['ASSASSIN']::text[], 'DISCIPLINE', 1, 35, 0, 20, 1, 4, 'REMOVE_FRICTION', 'ROTATING', true,
    jsonb_build_object('proof_type', 'RESULT', 'class_rotation', true)
  ),
  (
    'class_tank_load_bearing',
    'LOAD BEARING',
    'Complete 3 controlled strength sets at an appropriate load. Keep two good reps in reserve and record the sets.',
    'Durability is built through repeatable force, not reckless force.',
    'PHYSICAL', 'CLASS', 'NORMAL', array['TANK']::text[], 'STRENGTH', 1, 40, 0, 25, 1, 5, 'CONTROLLED_STRENGTH', 'ROTATING', true,
    jsonb_build_object('proof_type', 'PERFORMANCE', 'class_rotation', true)
  ),
  (
    'class_tank_frame_repair',
    'FRAME REPAIR',
    'Spend 12 minutes restoring hips, shoulders and trunk with gentle mobility. Leave the session feeling better, not exhausted.',
    'A strong frame is maintained before it is tested.',
    'RECOVERY', 'CLASS', 'EASY', array['TANK']::text[], 'RECOVERY', 1, 30, 0, 12, 1, 3, 'RECOVER_FIRST', 'ROTATING', true,
    jsonb_build_object('proof_type', 'PERFORMANCE', 'class_rotation', true)
  ),
  (
    'class_tank_hold_standard',
    'HOLD THE STANDARD',
    'Finish one responsibility you would normally postpone before entertainment or passive scrolling.',
    'A Tank does not lower the standard when no one is watching.',
    'DISCIPLINE', 'CLASS', 'NORMAL', array['TANK']::text[], 'DISCIPLINE', 1, 35, 0, 20, 1, 4, 'FINISH_FIRST', 'ROTATING', true,
    jsonb_build_object('proof_type', 'RESULT', 'class_rotation', true)
  ),
  (
    'class_tank_slow_force',
    'SLOW FORCE',
    'Perform one familiar strength movement with a slow controlled lowering phase for 3 sets. Stop if technique breaks.',
    'Control under load is the foundation of real force.',
    'PHYSICAL', 'CLASS', 'NORMAL', array['TANK']::text[], 'STRENGTH', 1, 35, 0, 20, 1, 4, 'TEMPO_CONTROL', 'ROTATING', true,
    jsonb_build_object('proof_type', 'PERFORMANCE', 'class_rotation', true)
  ),
  (
    'class_mage_teach_back',
    'TEACH BACK',
    'Study one idea for 20 minutes, then explain it in your own words without reading from the source. Record three takeaways.',
    'Knowledge becomes power when it can survive outside the page.',
    'LEARNING', 'CLASS', 'NORMAL', array['MAGE']::text[], 'INTELLIGENCE', 1, 40, 0, 20, 1, 5, 'ACTIVE_RECALL', 'ROTATING', true,
    jsonb_build_object('proof_type', 'LEARNING', 'class_rotation', true)
  ),
  (
    'class_mage_research_distillation',
    'RESEARCH DISTILLATION',
    'Research one question for 30 minutes and reduce it into a concise answer with three useful facts or actions.',
    'Information is not intelligence until it is distilled.',
    'LEARNING', 'CLASS', 'NORMAL', array['MAGE']::text[], 'INTELLIGENCE', 1, 45, 0, 30, 1, 5, 'DEEP_RESEARCH', 'ROTATING', true,
    jsonb_build_object('proof_type', 'LEARNING', 'class_rotation', true)
  ),
  (
    'class_mage_focus_sanctuary',
    'FOCUS SANCTUARY',
    'Protect a 25-minute distraction-free block for your most valuable work. State the concrete output when it ends.',
    'The mind needs defended territory before it can go deep.',
    'FOCUS', 'CLASS', 'NORMAL', array['MAGE']::text[], 'FOCUS', 1, 35, 0, 25, 1, 4, 'DEEP_FOCUS', 'ROTATING', true,
    jsonb_build_object('proof_type', 'RESULT', 'class_rotation', true)
  ),
  (
    'class_mage_knowledge_bridge',
    'KNOWLEDGE BRIDGE',
    'Apply something you learned this week to a real problem, task or decision, then record the result.',
    'The strongest knowledge crosses into real life.',
    'LEARNING', 'CLASS', 'NORMAL', array['MAGE']::text[], 'INTELLIGENCE', 1, 40, 0, 20, 1, 4, 'APPLY_LEARNING', 'ROTATING', true,
    jsonb_build_object('proof_type', 'RESULT', 'class_rotation', true)
  ),
  (
    'class_ranger_terrain_scan',
    'TERRAIN SCAN',
    'Move outdoors for 25 minutes at a comfortable, sustainable pace. Notice your breathing and keep it controlled.',
    'The Ranger reads the terrain without forcing the pace.',
    'PHYSICAL', 'CLASS', 'NORMAL', array['RANGER']::text[], 'ENDURANCE', 1, 35, 0, 25, 1, 4, 'OUTDOOR_MOTION', 'ROTATING', true,
    jsonb_build_object('proof_type', 'PERFORMANCE', 'class_rotation', true)
  ),
  (
    'class_ranger_long_horizon',
    'LONG HORIZON',
    'Complete 30 minutes of continuous walking, jogging or cycling at a pace you can maintain without a hard finish.',
    'Distance is built by respecting the horizon.',
    'PHYSICAL', 'CLASS', 'NORMAL', array['RANGER']::text[], 'ENDURANCE', 1, 40, 0, 30, 1, 5, 'SUSTAINED_PACE', 'ROTATING', true,
    jsonb_build_object('proof_type', 'PERFORMANCE', 'class_rotation', true)
  ),
  (
    'class_ranger_route_recovery',
    'ROUTE RECOVERY',
    'Take a 15-minute easy walk, then complete five minutes of calf, hip and ankle mobility.',
    'A long path requires maintenance between the hard miles.',
    'RECOVERY', 'CLASS', 'EASY', array['RANGER']::text[], 'RECOVERY', 1, 30, 0, 20, 1, 3, 'RECOVER_FIRST', 'ROTATING', true,
    jsonb_build_object('proof_type', 'PERFORMANCE', 'class_rotation', true)
  ),
  (
    'class_ranger_adaptive_pace',
    'ADAPTIVE PACE',
    'Complete 20 minutes of steady movement. Adjust the pace once if needed, but do not stop early without a real reason.',
    'Adaptability keeps the Ranger moving when conditions change.',
    'PHYSICAL', 'CLASS', 'NORMAL', array['RANGER']::text[], 'ENDURANCE', 1, 35, 0, 20, 1, 4, 'PACING', 'ROTATING', true,
    jsonb_build_object('proof_type', 'PERFORMANCE', 'class_rotation', true)
  ),
  (
    'class_commander_operational_map',
    'OPERATIONAL MAP',
    'Write the three outcomes that would make today successful, then complete the first concrete step toward the most important one.',
    'Command begins by defining what success looks like.',
    'FOCUS', 'CLASS', 'NORMAL', array['COMMANDER']::text[], 'DISCIPLINE', 1, 35, 0, 20, 1, 4, 'PRIORITIZE', 'ROTATING', true,
    jsonb_build_object('proof_type', 'RESULT', 'class_rotation', true)
  ),
  (
    'class_commander_clear_signal',
    'CLEAR SIGNAL',
    'Make one delayed decision and communicate it clearly in a sentence or short message. Record the outcome.',
    'Clarity is a form of leadership.',
    'FOCUS', 'CLASS', 'NORMAL', array['COMMANDER']::text[], 'CHARISMA', 1, 35, 0, 15, 1, 4, 'DECIDE', 'ROTATING', true,
    jsonb_build_object('proof_type', 'RESULT', 'class_rotation', true)
  ),
  (
    'class_commander_delegation_drill',
    'DELEGATION DRILL',
    'Turn one task into a clear three-step handoff or plan: owner, outcome and deadline. Use it or save it for the next opportunity.',
    'A Commander makes the next move obvious.',
    'LEARNING', 'CLASS', 'NORMAL', array['COMMANDER']::text[], 'DISCIPLINE', 1, 35, 0, 20, 1, 4, 'PLAN_HANDOFF', 'ROTATING', true,
    jsonb_build_object('proof_type', 'RESULT', 'class_rotation', true)
  ),
  (
    'class_commander_after_action_review',
    'AFTER-ACTION REVIEW',
    'Review one completed task. Record what worked, what failed and the one adjustment you will make next time.',
    'Review turns activity into command experience.',
    'LEARNING', 'CLASS', 'NORMAL', array['COMMANDER']::text[], 'INTELLIGENCE', 1, 40, 0, 20, 1, 4, 'REFLECT', 'ROTATING', true,
    jsonb_build_object('proof_type', 'RESULT', 'class_rotation', true)
  ),
  (
    'adaptive_assassin_motion_precision',
    'MOTION PRECISION',
    'Complete 12 minutes of controlled footwork, balance or coordination work. Record the cleanest movement you achieved.',
    'The adaptive layer is restoring precision without overloading the body.',
    'PHYSICAL', 'STANDARD', 'EASY', array['ASSASSIN']::text[], 'SPEED', 1, 35, 0, 12, 1, 4, 'START_SMALL', 'ROTATING', true,
    jsonb_build_object('adaptive', true, 'proof_type', 'PERFORMANCE', 'class_rotation', true)
  ),
  (
    'adaptive_assassin_focus_reset',
    'FOCUS RESET',
    'Remove one distraction and complete a 15-minute single-task block. Record the output, not just the time.',
    'The adaptive layer is rebuilding sharpness through one clean target.',
    'FOCUS', 'STANDARD', 'EASY', array['ASSASSIN']::text[], 'FOCUS', 1, 30, 0, 15, 1, 4, 'REMOVE_FRICTION', 'ROTATING', true,
    jsonb_build_object('adaptive', true, 'proof_type', 'RESULT', 'class_rotation', true)
  ),
  (
    'adaptive_tank_foundation_load',
    'FOUNDATION LOAD',
    'Complete one controlled strength circuit at an appropriate level, then record the sets and any adjustment you made.',
    'The adaptive layer is protecting the Tank’s base before adding intensity.',
    'PHYSICAL', 'STANDARD', 'EASY', array['TANK']::text[], 'STRENGTH', 1, 35, 0, 15, 1, 4, 'START_SMALL', 'ROTATING', true,
    jsonb_build_object('adaptive', true, 'proof_type', 'PERFORMANCE', 'class_rotation', true)
  ),
  (
    'adaptive_tank_recovery_armor',
    'RECOVERY ARMOR',
    'Spend 10 minutes on controlled mobility for the areas carrying the most tension today.',
    'The adaptive layer is reinforcing recovery before more load is added.',
    'RECOVERY', 'STANDARD', 'EASY', array['TANK']::text[], 'RECOVERY', 1, 30, 0, 10, 1, 3, 'LOW_FRICTION', 'ROTATING', true,
    jsonb_build_object('adaptive', true, 'proof_type', 'PERFORMANCE', 'class_rotation', true)
  ),
  (
    'adaptive_mage_recall_chain',
    'RECALL CHAIN',
    'Learn one small concept, close the source, then write three points you can recall without checking.',
    'The adaptive layer is converting passive input into usable memory.',
    'LEARNING', 'STANDARD', 'EASY', array['MAGE']::text[], 'INTELLIGENCE', 1, 35, 0, 15, 1, 4, 'ACTIVE_RECALL', 'ROTATING', true,
    jsonb_build_object('adaptive', true, 'proof_type', 'LEARNING', 'class_rotation', true)
  ),
  (
    'adaptive_mage_cognitive_reset',
    'COGNITIVE RESET',
    'Take a 10-minute screen-free reset, then choose and write the next single task you will complete.',
    'The adaptive layer is clearing mental noise before deeper work.',
    'RECOVERY', 'STANDARD', 'EASY', array['MAGE']::text[], 'RECOVERY', 1, 30, 0, 10, 1, 3, 'CLEAR_NOISE', 'ROTATING', true,
    jsonb_build_object('adaptive', true, 'proof_type', 'RESULT', 'class_rotation', true)
  ),
  (
    'adaptive_ranger_base_zone',
    'BASE ZONE',
    'Move continuously for 20 minutes at a pace where you can still speak in short sentences.',
    'The adaptive layer is rebuilding endurance without turning every day into a test.',
    'PHYSICAL', 'STANDARD', 'EASY', array['RANGER']::text[], 'ENDURANCE', 1, 35, 0, 20, 1, 4, 'SUSTAINED_PACE', 'ROTATING', true,
    jsonb_build_object('adaptive', true, 'proof_type', 'PERFORMANCE', 'class_rotation', true)
  ),
  (
    'adaptive_ranger_terrain_recovery',
    'TERRAIN RECOVERY',
    'Complete a 10-minute easy walk followed by five minutes of calf, hip and ankle mobility.',
    'The adaptive layer is keeping the route open through recovery.',
    'RECOVERY', 'STANDARD', 'EASY', array['RANGER']::text[], 'RECOVERY', 1, 30, 0, 15, 1, 3, 'RECOVER_FIRST', 'ROTATING', true,
    jsonb_build_object('adaptive', true, 'proof_type', 'PERFORMANCE', 'class_rotation', true)
  ),
  (
    'adaptive_commander_priority_stack',
    'PRIORITY STACK',
    'Choose one outcome that matters today, define its first three actions, then complete action one.',
    'The adaptive layer is restoring command through a clear next move.',
    'FOCUS', 'STANDARD', 'EASY', array['COMMANDER']::text[], 'DISCIPLINE', 1, 35, 0, 15, 1, 4, 'PRIORITIZE', 'ROTATING', true,
    jsonb_build_object('adaptive', true, 'proof_type', 'RESULT', 'class_rotation', true)
  ),
  (
    'adaptive_commander_signal_check',
    'SIGNAL CHECK',
    'Review one message, request or commitment you have delayed. Decide the response and record what you communicated.',
    'The adaptive layer is turning avoidance into a clear signal.',
    'FOCUS', 'STANDARD', 'EASY', array['COMMANDER']::text[], 'CHARISMA', 1, 30, 0, 15, 1, 3, 'DECIDE', 'ROTATING', true,
    jsonb_build_object('adaptive', true, 'proof_type', 'RESULT', 'class_rotation', true)
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

-- Daily generation now deliberately owns just the Daily + one compatible
-- Class directive. Must directives remain accepted 24-hour contracts, Rare
-- events remain rare, and Adaptive directives remain recommendations.
create or replace function public.system_generate_daily_quests(
  p_for_date date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles;
  v_quest public.quest_library;
  v_new_id uuid;
  v_count integer := 0;
  v_ids jsonb := '[]'::jsonb;
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

  -- A player can open more than one device at once. Serialize daily
  -- generation so two sessions cannot create separate Class directives.
  perform pg_advisory_xact_lock(
    hashtextextended(
      'daily-quests:' ||
      v_user::text ||
      ':' ||
      p_for_date::text,
      0
    )
  );

  for v_quest in
    (
      select q.*
      from public.quest_library q
      where q.active = true
        and q.quest_type = 'DAILY'
        and q.min_level <= coalesce(v_profile.level, 1)
        and (
          cardinality(q.class_affinity) = 0
          or upper(v_profile.class) = any(q.class_affinity)
        )
        and not exists (
          select 1
          from public.user_quests uq
          where uq.user_id = v_user
            and uq.quest_type = 'DAILY'
            and uq.assigned_for = p_for_date
        )
        and not exists (
          select 1
          from public.user_quests uq
          where uq.user_id = v_user
            and uq.quest_id = q.id
            and uq.assigned_for = p_for_date
        )
      order by md5(v_user::text || ':' || p_for_date::text || ':' || q.id::text)
      limit 1
    )
    union all
    (
      select q.*
      from public.quest_library q
      where q.active = true
        and q.quest_type = 'CLASS'
        and q.min_level <= coalesce(v_profile.level, 1)
        and upper(v_profile.class) = any(q.class_affinity)
        and not exists (
          select 1
          from public.user_quests uq
          where uq.user_id = v_user
            and uq.quest_type = 'CLASS'
            and uq.assigned_for = p_for_date
        )
        and not exists (
          select 1
          from public.user_quests uq
          where uq.user_id = v_user
            and uq.quest_id = q.id
            and uq.assigned_for >= p_for_date - 6
        )
      order by md5(v_user::text || ':' || p_for_date::text || ':' || q.id::text)
      limit 1
    )
  loop
    insert into public.user_quests (
      user_id,
      quest_id,
      assigned_for,
      quest_type,
      title_snapshot,
      objective_snapshot,
      category,
      status,
      source,
      expires_at,
      xp_reward,
      xp_penalty,
      attribute_reward,
      attribute_delta,
      consequence,
      metadata
    ) values (
      v_user,
      v_quest.id,
      p_for_date,
      v_quest.quest_type,
      v_quest.title,
      v_quest.objective,
      v_quest.category,
      'ASSIGNED',
      'SYSTEM',
      ((p_for_date + 1)::timestamp at time zone 'UTC'),
      v_quest.xp_reward,
      v_quest.failure_xp_penalty,
      v_quest.attribute_reward,
      v_quest.attribute_delta,
      case when coalesce(v_quest.failure_xp_penalty, 0) > 0
        then '-' || v_quest.failure_xp_penalty || ' XP'
        else null end,
      jsonb_build_object(
        'generated_by', 'SYSTEM',
        'library_code', v_quest.code,
        'rotation_window_days', case when v_quest.quest_type = 'CLASS' then 7 else 0 end,
        'rotation_seed', md5(v_user::text || p_for_date::text)
      )
    )
    returning id into v_new_id;

    v_ids := v_ids || jsonb_build_array(v_new_id);
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object(
    'assigned', v_count,
    'quest_ids', v_ids,
    'date', p_for_date,
    'rotation_window_days', 7
  );
end;
$function$;

-- The adaptive resolver prioritizes the player’s current weak category, but
-- it cannot surface the same completed/assigned directive in the last seven
-- assigned days. A deterministic compatibility fallback remains available
-- only when the catalogue has genuinely exhausted the rotation window.
create or replace function public.system_resolve_adaptive_quest_v2(
  p_category_order text[] default array[]::text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles;
  v_order text[] := array[]::text[];
  v_directive public.quest_library;
  v_rotation_mode text := 'UNUSED_7_DAY_ROTATION';
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
    and not exists (
      select 1
      from public.user_quests uq
      where uq.user_id = v_user
        and uq.quest_id = q.id
        and uq.assigned_for >= current_date - 6
    )
  order by
    array_position(v_order, upper(q.category)),
    case when upper(coalesce(v_profile.class, '')) = any(q.class_affinity) then 0 else 1 end,
    md5(v_user::text || ':' || current_date::text || ':' || q.code),
    q.health_value desc,
    q.code asc
  limit 1;

  if not found then
    v_rotation_mode := 'CATALOGUE_FALLBACK';

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
      case when upper(coalesce(v_profile.class, '')) = any(q.class_affinity) then 0 else 1 end,
      md5(v_user::text || ':' || current_date::text || ':' || q.code),
      q.health_value desc,
      q.code asc
    limit 1;
  end if;

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
      'message', coalesce(v_directive.system_message, ''),
      'category', v_directive.category,
      'xp', v_directive.xp_reward,
      'attribute', v_directive.attribute_reward,
      'attribute_delta', v_directive.attribute_delta,
      'proof_type', coalesce(v_directive.metadata->>'proof_type', ''),
      'rotation_window_days', 7,
      'rotation_mode', v_rotation_mode,
      'metadata', v_directive.metadata
    )
  );
end;
$function$;

revoke all on function public.system_resolve_adaptive_quest_v2(text[]) from public, anon;
grant execute on function public.system_resolve_adaptive_quest_v2(text[]) to authenticated;

-- Read-only Dashboard command. It returns the player’s actual active Must
-- directive (if one exists), their current Class directive or next fresh
-- class rotation, and the live unspent-credit total.
create or replace function public.system_daily_command_brief_v1(
  p_assigned_for date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles;
  v_for_date date := coalesce(p_assigned_for, current_date);
  v_active_must public.user_quests;
  v_active_class public.user_quests;
  v_class_library public.quest_library;
  v_credits integer := 0;
  v_must_payload jsonb;
  v_class_payload jsonb;
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

  select * into v_active_must
  from public.user_quests uq
  where uq.user_id = v_user
    and uq.quest_type = 'MUST'
    and uq.assigned_for = v_for_date
    and uq.status = 'ACCEPTED'
    and (uq.expires_at is null or uq.expires_at >= now())
  order by uq.expires_at asc nulls last, uq.created_at asc
  limit 1;

  if found then
    v_must_payload := jsonb_build_object(
      'status', 'ACTIVE',
      'title', v_active_must.title_snapshot,
      'objective', v_active_must.objective_snapshot,
      'category', v_active_must.category,
      'xp', v_active_must.xp_reward,
      'penalty', v_active_must.xp_penalty,
      'expires_at', v_active_must.expires_at,
      'quest_id', v_active_must.id
    );
  else
    v_must_payload := jsonb_build_object(
      'status', 'NONE',
      'title', 'NO MUST DIRECTIVE ACTIVE',
      'objective', 'Open the Quest Board when you are ready to accept a 24-hour directive.',
      'xp', 0,
      'penalty', 0
    );
  end if;

  select * into v_active_class
  from public.user_quests uq
  where uq.user_id = v_user
    and uq.quest_type = 'CLASS'
    and uq.assigned_for = v_for_date
    and uq.status in ('ASSIGNED', 'ACCEPTED', 'COMPLETED')
  order by
    case uq.status when 'ASSIGNED' then 0 when 'ACCEPTED' then 1 else 2 end,
    uq.created_at asc
  limit 1;

  if found then
    select * into v_class_library
    from public.quest_library q
    where q.id = v_active_class.quest_id;

    v_class_payload := jsonb_build_object(
      'status', case when v_active_class.status = 'COMPLETED' then 'COMPLETE' else 'READY' end,
      'code', coalesce(v_class_library.code, v_active_class.metadata->>'library_code', ''),
      'title', v_active_class.title_snapshot,
      'objective', v_active_class.objective_snapshot,
      'message', coalesce(v_class_library.system_message, 'Class alignment directive selected from the live rotation.'),
      'category', v_active_class.category,
      'xp', v_active_class.xp_reward,
      'attribute', v_active_class.attribute_reward,
      'attribute_delta', v_active_class.attribute_delta,
      'proof_type', coalesce(v_class_library.metadata->>'proof_type', 'HONOR'),
      'rotation_window_days', 7,
      'rotation_mode', 'ASSIGNED_TODAY'
    );
  else
    select * into v_class_library
    from public.quest_library q
    where q.active = true
      and q.quest_type = 'CLASS'
      and q.min_level <= coalesce(v_profile.level, 1)
      and upper(v_profile.class) = any(q.class_affinity)
      and not exists (
        select 1
        from public.user_quests uq
        where uq.user_id = v_user
          and uq.quest_id = q.id
          and uq.assigned_for >= v_for_date - 6
      )
    order by md5(v_user::text || ':' || v_for_date::text || ':' || q.id::text)
    limit 1;

    if not found then
      select * into v_class_library
      from public.quest_library q
      where q.active = true
        and q.quest_type = 'CLASS'
        and q.min_level <= coalesce(v_profile.level, 1)
        and upper(v_profile.class) = any(q.class_affinity)
      order by md5(v_user::text || ':' || v_for_date::text || ':' || q.id::text)
      limit 1;
    end if;

    if found then
      v_class_payload := jsonb_build_object(
        'status', 'READY',
        'code', v_class_library.code,
        'title', v_class_library.title,
        'objective', v_class_library.objective,
        'message', coalesce(v_class_library.system_message, 'Class alignment directive selected from the live rotation.'),
        'category', v_class_library.category,
        'xp', v_class_library.xp_reward,
        'attribute', v_class_library.attribute_reward,
        'attribute_delta', v_class_library.attribute_delta,
        'proof_type', coalesce(v_class_library.metadata->>'proof_type', 'HONOR'),
        'rotation_window_days', 7,
        'rotation_mode', 'UNUSED_7_DAY_ROTATION'
      );
    else
      v_class_payload := jsonb_build_object(
        'status', 'NONE',
        'title', 'CLASS DIRECTIVE UNAVAILABLE',
        'objective', 'The class catalogue is synchronizing. Retry without resetting progression.',
        'xp', 0,
        'rotation_window_days', 7
      );
    end if;
  end if;

  select coalesce(sum(greatest(0, credit.credits_awarded - credit.credits_spent)), 0)
  into v_credits
  from public.attribute_credit_ledger credit
  where credit.user_id = v_user;

  return jsonb_build_object(
    'status', 'READY',
    'assigned_for', v_for_date,
    'generated_at', now(),
    'must_directive', v_must_payload,
    'class_directive', v_class_payload,
    'progress', jsonb_build_object(
      'unspent_credits', v_credits,
      'level', v_profile.level,
      'streak', v_profile.streak,
      'class', v_profile.class
    ),
    'rotation', jsonb_build_object(
      'window_days', 7,
      'rule', 'NO_REPEAT_WHEN_A_COMPATIBLE_UNUSED_DIRECTIVE_EXISTS'
    )
  );
end;
$function$;

revoke all on function public.system_daily_command_brief_v1(date) from public, anon;
grant execute on function public.system_daily_command_brief_v1(date) to authenticated;

