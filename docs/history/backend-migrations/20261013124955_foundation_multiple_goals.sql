-- 2.9.6: preserve multiple improvement goals and one main priority.
-- Weight is required for new saves; height stays optional in canonical cm.
-- Existing profiles, class selection and authoritative progression are untouched.
create or replace function public.system_save_foundation_scan_v1(
  p_scan jsonb,
  p_fuel jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_scan jsonb := coalesce(p_scan, '{}'::jsonb);
  v_fuel jsonb := coalesce(p_fuel, '{}'::jsonb);
  v_primary_focus text;
  v_focus_goals text[] := array[]::text[];
  v_goal_json jsonb;
  v_goal text;
  v_experience text;
  v_activity_level text;
  v_main_obstacle text;
  v_daily_minutes integer;
  v_meals_per_day text;
  v_equipment text;
  v_food_preference text;
  v_food_budget text;
  v_weight_text text;
  v_height_text text;
  v_calorie_text text;
  v_protein_text text;
  v_weight numeric;
  v_height numeric;
  v_calorie_target integer := 0;
  v_protein_target integer := 0;
  v_recommended_goal text := 'MAINTAIN';
  v_selected_goal text;
  v_profile_data jsonb;
  v_clean_scan jsonb;
  v_clean_fuel jsonb;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if jsonb_typeof(v_scan) <> 'object' or jsonb_typeof(v_fuel) <> 'object' then
    raise exception 'INVALID_FOUNDATION_SCAN';
  end if;

  v_primary_focus := upper(trim(coalesce(v_scan->>'primaryFocus', '')));
  v_experience := upper(trim(coalesce(v_scan->>'experience', '')));
  v_activity_level := upper(trim(coalesce(v_scan->>'activityLevel', '')));
  v_main_obstacle := upper(trim(coalesce(v_scan->>'mainObstacle', '')));
  v_meals_per_day := upper(trim(coalesce(v_scan->>'mealsPerDay', '')));
  v_equipment := upper(trim(coalesce(v_scan->>'equipment', '')));
  v_food_preference := upper(trim(coalesce(v_scan->>'foodPreference', '')));
  v_food_budget := upper(trim(coalesce(v_scan->>'foodBudget', '')));

  if v_scan ? 'focusGoals' then
    if jsonb_typeof(v_scan->'focusGoals') <> 'array' then
      raise exception 'INVALID_FOCUS_GOALS';
    end if;
    if jsonb_array_length(v_scan->'focusGoals') < 1
       or jsonb_array_length(v_scan->'focusGoals') > 6 then
      raise exception 'INVALID_FOCUS_GOALS';
    end if;

    for v_goal_json in select value from jsonb_array_elements(v_scan->'focusGoals') loop
      if jsonb_typeof(v_goal_json) <> 'string' then
        raise exception 'INVALID_FOCUS_GOALS';
      end if;
      v_goal := upper(trim(v_goal_json #>> '{}'));
      if v_goal not in ('STRENGTH', 'BODY_COMPOSITION', 'FITNESS', 'FOCUS', 'CONFIDENCE', 'KNOWLEDGE') then
        raise exception 'INVALID_FOUNDATION_FOCUS';
      end if;
      if not (v_goal = any(v_focus_goals)) then
        v_focus_goals := array_append(v_focus_goals, v_goal);
      end if;
    end loop;
    if v_primary_focus = '' then v_primary_focus := v_focus_goals[1]; end if;
    if not (v_primary_focus = any(v_focus_goals)) then
      raise exception 'INVALID_FOUNDATION_FOCUS';
    end if;
    v_focus_goals := array_prepend(v_primary_focus, array_remove(v_focus_goals, v_primary_focus));
  else
    -- Old clients keep their single valid priority.
    v_focus_goals := array[v_primary_focus];
  end if;

  if v_primary_focus not in ('STRENGTH', 'BODY_COMPOSITION', 'FITNESS', 'FOCUS', 'CONFIDENCE', 'KNOWLEDGE') then
    raise exception 'INVALID_FOUNDATION_FOCUS';
  end if;

  if v_experience not in ('NEW', 'RETURNING', 'REGULAR', 'EXPERIENCED') then
    raise exception 'INVALID_FOUNDATION_EXPERIENCE';
  end if;

  if v_activity_level not in ('LOW', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE') then
    raise exception 'INVALID_ACTIVITY_LEVEL';
  end if;

  if v_main_obstacle not in ('CONSISTENCY', 'TIME', 'ENERGY', 'DISTRACTIONS', 'CONFIDENCE') then
    raise exception 'INVALID_MAIN_OBSTACLE';
  end if;

  if coalesce(v_scan->>'dailyMinutes', '') not in ('10', '20', '30', '45', '60') then
    raise exception 'INVALID_DAILY_MINUTES';
  end if;
  v_daily_minutes := (v_scan->>'dailyMinutes')::integer;

  if v_meals_per_day not in ('ONE_TO_TWO', 'THREE', 'FOUR_PLUS', 'IRREGULAR') then
    raise exception 'INVALID_MEAL_RHYTHM';
  end if;

  if v_equipment not in ('BODYWEIGHT', 'HOME', 'GYM', 'OUTDOOR') then
    raise exception 'INVALID_TRAINING_ACCESS';
  end if;

  if v_food_preference not in ('NO_RESTRICTIONS', 'VEGETARIAN', 'DAIRY_FREE', 'PORK_FREE') then
    raise exception 'INVALID_FOOD_PREFERENCE';
  end if;

  if v_food_budget not in ('BASIC', 'FLEXIBLE', 'OPEN') then
    raise exception 'INVALID_FOOD_BUDGET';
  end if;

  v_weight_text := nullif(trim(coalesce(v_scan->>'weightKg', '')), '');
  if v_weight_text is null then raise exception 'WEIGHT_REQUIRED'; end if;
  if v_weight_text is not null then
    if v_weight_text !~ '^[0-9]+([.][0-9]+)?$' then
      raise exception 'INVALID_WEIGHT';
    end if;
    v_weight := v_weight_text::numeric;
    if v_weight < 30 or v_weight > 350 then
      raise exception 'INVALID_WEIGHT';
    end if;
  end if;

  v_height_text := nullif(trim(coalesce(v_scan->>'heightCm', '')), '');
  if v_height_text is not null then
    if v_height_text !~ '^[0-9]+([.][0-9]+)?$' then
      raise exception 'INVALID_HEIGHT';
    end if;
    v_height := v_height_text::numeric;
    if v_height < 120 or v_height > 230 then
      raise exception 'INVALID_HEIGHT';
    end if;
  end if;

  if v_primary_focus = 'STRENGTH' and v_weight is not null and v_height is not null
     and v_weight / power(v_height / 100, 2) < 20.5 then
    v_recommended_goal := 'BULK';
  end if;

  v_selected_goal := upper(trim(coalesce(nullif(v_fuel->>'goal', ''), v_recommended_goal)));
  if v_selected_goal not in ('CUT', 'MAINTAIN', 'BULK') then
    raise exception 'INVALID_FUEL_GOAL';
  end if;

  v_calorie_text := nullif(trim(coalesce(v_fuel->>'calorieTarget', '')), '');
  if v_calorie_text is not null then
    if v_calorie_text !~ '^[0-9]+$' then
      raise exception 'INVALID_CALORIE_TARGET';
    end if;
    v_calorie_target := v_calorie_text::integer;
    if v_calorie_target <> 0 and (v_calorie_target < 1200 or v_calorie_target > 5000) then
      raise exception 'INVALID_CALORIE_TARGET';
    end if;
  end if;

  v_protein_text := nullif(trim(coalesce(v_fuel->>'proteinTarget', '')), '');
  if v_protein_text is not null then
    if v_protein_text !~ '^[0-9]+$' then
      raise exception 'INVALID_PROTEIN_TARGET';
    end if;
    v_protein_target := v_protein_text::integer;
    if v_protein_target <> 0 and (v_protein_target < 45 or v_protein_target > 250) then
      raise exception 'INVALID_PROTEIN_TARGET';
    end if;
  end if;

  v_clean_scan := jsonb_strip_nulls(
    jsonb_build_object(
      'primaryFocus', v_primary_focus,
      'focusGoals', to_jsonb(v_focus_goals),
      'experience', v_experience,
      'activityLevel', v_activity_level,
      'mainObstacle', v_main_obstacle,
      'dailyMinutes', v_daily_minutes,
      'weightKg', v_weight,
      'heightCm', v_height,
      'mealsPerDay', v_meals_per_day,
      'equipment', v_equipment,
      'foodPreference', v_food_preference,
      'foodBudget', v_food_budget,
      'recommendedFuelGoal', v_recommended_goal,
      'selectedFuelGoal', v_selected_goal,
      'estimatedCalorieTarget', v_calorie_target,
      'estimatedProteinTarget', v_protein_target,
      'version', 2,
      'completedAt', clock_timestamp()
    )
  );

  v_clean_fuel := jsonb_build_object(
    'goal', v_selected_goal,
    'calorieTarget', v_calorie_target,
    'proteinTarget', v_protein_target
  );

  update public.profiles
  set
    profile_data = coalesce(profile_data, '{}'::jsonb)
      || jsonb_build_object(
        'foundationScan', v_clean_scan,
        'fuel', v_clean_fuel
      ),
    updated_at = now()
  where id = v_user
  returning profile_data into v_profile_data;

  if not found then
    raise exception 'PROFILE_NOT_INITIALIZED';
  end if;

  return jsonb_build_object(
    'foundationScan', v_profile_data->'foundationScan',
    'fuel', v_profile_data->'fuel'
  );
end;
$function$;

revoke all on function public.system_save_foundation_scan_v1(jsonb, jsonb) from public, anon;
grant execute on function public.system_save_foundation_scan_v1(jsonb, jsonb) to authenticated;

