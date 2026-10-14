-- Run as the project database owner. Synthetic accounts are rolled back.
begin;
do $test$
declare
  v_user uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_missing uuid := gen_random_uuid();
  v_result jsonb;
  v_other_profile jsonb;
  v_checks integer := 0;
begin
  insert into auth.users(id, email)
  values
    (v_user, 'foundation-check-' || v_user || '@example.invalid'),
    (v_other, 'foundation-other-' || v_other || '@example.invalid');

  insert into public.profiles(id, name, age, class, profile_data)
  values
    (v_user, 'Foundation check', 25, 'TANK', '{}'::jsonb),
    (v_other, 'Foundation other', 25, 'MAGE', '{"marker":"UNCHANGED"}'::jsonb);

  perform set_config('request.jwt.claim.sub', v_user::text, true);
  perform set_config('role', 'authenticated', true);

  v_result := public.system_save_foundation_scan_v1(
    '{
      "primaryFocus":"STRENGTH",
      "experience":"RETURNING",
      "activityLevel":"MODERATE",
      "mainObstacle":"CONSISTENCY",
      "dailyMinutes":20,
      "weightKg":60,
      "heightCm":180,
      "mealsPerDay":"THREE",
      "equipment":"GYM",
      "foodPreference":"NO_RESTRICTIONS",
      "foodBudget":"BASIC",
      "selectedFuelGoal":"BULK"
    }'::jsonb,
    '{"goal":"CUT","calorieTarget":1500,"proteinTarget":96}'::jsonb
  );

  assert v_result->'foundationScan'->>'recommendedFuelGoal' = 'BULK', 'Server recommendation was not calculated';
  assert v_result->'foundationScan'->>'selectedFuelGoal' = 'CUT', 'Player choice was not preserved';
  assert (v_result->'foundationScan'->>'completedAt') is not null, 'Server completion time missing';
  assert (v_result->'fuel'->>'calorieTarget')::integer = 1500, 'Fuel target missing';
  v_checks := v_checks + 4;

  begin
    perform public.system_save_foundation_scan_v1(
      '{
        "primaryFocus":"STRENGTH",
        "experience":"RETURNING",
        "activityLevel":"MODERATE",
        "mainObstacle":"CONSISTENCY",
        "dailyMinutes":20,
        "weightKg":60,
        "mealsPerDay":"THREE",
        "equipment":"GYM",
        "foodPreference":"NO_RESTRICTIONS",
        "foodBudget":"BASIC"
      }'::jsonb,
      '{"goal":"RECOMP"}'::jsonb
    );
    raise exception 'Invalid fuel goal should fail';
  exception
    when others then
      assert sqlerrm = 'INVALID_FUEL_GOAL', sqlerrm;
  end;
  v_checks := v_checks + 1;

  perform set_config('request.jwt.claim.sub', v_missing::text, true);
  begin
    perform public.system_save_foundation_scan_v1(
      '{
        "primaryFocus":"FOCUS",
        "weightKg":60,
        "experience":"NEW",
        "activityLevel":"LOW",
        "mainObstacle":"TIME",
        "dailyMinutes":10,
        "mealsPerDay":"IRREGULAR",
        "equipment":"BODYWEIGHT",
        "foodPreference":"NO_RESTRICTIONS",
        "foodBudget":"BASIC"
      }'::jsonb,
      '{"goal":"MAINTAIN"}'::jsonb
    );
    raise exception 'Missing profile should fail';
  exception
    when others then
      assert sqlerrm = 'PROFILE_NOT_INITIALIZED', sqlerrm;
  end;
  v_checks := v_checks + 1;

  perform set_config('role', 'postgres', true);
  select profile_data into v_other_profile
  from public.profiles
  where id = v_other;
  assert v_other_profile->>'marker' = 'UNCHANGED', 'Foundation RPC changed another player';
  v_checks := v_checks + 1;

  perform set_config('system.foundation_scan_report', jsonb_build_object(
    'checks_passed', v_checks,
    'rollback', true
  )::text, true);
end $test$;
select current_setting('system.foundation_scan_report')::jsonb as report;
rollback;
