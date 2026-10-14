-- Synthetic profiles only. All changes are rolled back.
begin;
do $test$
declare
  v_user uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_scan jsonb := '{"primaryFocus":"STRENGTH","focusGoals":["strength","KNOWLEDGE","CONFIDENCE","STRENGTH"],"experience":"RETURNING","activityLevel":"MODERATE","mainObstacle":"CONSISTENCY","dailyMinutes":20,"weightKg":60.5,"heightCm":180.3,"mealsPerDay":"THREE","equipment":"GYM","foodPreference":"NO_RESTRICTIONS","foodBudget":"BASIC"}'::jsonb;
  v_result jsonb;
  v_case jsonb;
  v_class text;
  v_xp integer;
  v_checks integer := 0;
begin
  assert not has_function_privilege('anon','public.system_save_foundation_scan_v1(jsonb,jsonb)','EXECUTE');
  assert has_function_privilege('authenticated','public.system_save_foundation_scan_v1(jsonb,jsonb)','EXECUTE');
  v_checks := v_checks + 2;
  insert into auth.users(id,email) values (v_user,'foundation-goals-'||v_user||'@example.invalid'),(v_other,'foundation-goals-'||v_other||'@example.invalid');
  insert into public.profiles(id,name,age,class,xp,profile_data) values (v_user,'Goals check',25,'MAGE',250,'{}'::jsonb),(v_other,'Other goals check',25,'TANK',0,'{"marker":"UNCHANGED"}'::jsonb);
  perform set_config('request.jwt.claim.sub',v_user::text,true);
  perform set_config('role','authenticated',true);
  v_result := public.system_save_foundation_scan_v1(v_scan,'{"goal":"CUT","calorieTarget":1525,"proteinTarget":97}'::jsonb);
  assert v_result->'foundationScan'->'focusGoals' = '["STRENGTH","KNOWLEDGE","CONFIDENCE"]'::jsonb;
  assert v_result->'foundationScan'->>'primaryFocus' = 'STRENGTH';
  assert (v_result->'foundationScan'->>'weightKg')::numeric = 60.5;
  assert (v_result->'foundationScan'->>'heightCm')::numeric = 180.3;
  assert v_result->'foundationScan'->>'selectedFuelGoal' = 'CUT';
  assert v_result->'foundationScan'->>'version' = '2';
  v_checks := v_checks + 6;

  v_result := public.system_save_foundation_scan_v1(v_scan - 'focusGoals' - 'heightCm','{"goal":"MAINTAIN"}'::jsonb);
  assert v_result->'foundationScan'->'focusGoals' = '["STRENGTH"]'::jsonb;
  assert not (v_result->'foundationScan' ? 'heightCm');
  v_checks := v_checks + 2;

  v_result := public.system_save_foundation_scan_v1((v_scan - 'primaryFocus') || '{"focusGoals":["KNOWLEDGE","CONFIDENCE"],"xp":999999}'::jsonb,'{}'::jsonb);
  assert v_result->'foundationScan'->>'primaryFocus' = 'KNOWLEDGE';
  select class,xp into v_class,v_xp from public.profiles where id=v_user;
  assert v_class = 'MAGE' and v_xp = 250, 'Goals changed class or progression';
  v_checks := v_checks + 2;

  for v_case in select value from jsonb_array_elements('[{"focusGoals":{}},{"focusGoals":[]},{"focusGoals":[1]},{"focusGoals":["INVALID"]},{"focusGoals":["KNOWLEDGE"]},{"focusGoals":["STRENGTH","STRENGTH","STRENGTH","STRENGTH","STRENGTH","STRENGTH","STRENGTH"]}]'::jsonb) loop
    begin
      perform public.system_save_foundation_scan_v1(v_scan || v_case,'{}'::jsonb);
      raise exception 'INVALID_GOALS_ACCEPTED';
    exception when others then
      assert sqlerrm in ('INVALID_FOCUS_GOALS','INVALID_FOUNDATION_FOCUS'), sqlerrm;
    end;
    v_checks := v_checks + 1;
  end loop;
  begin
    perform public.system_save_foundation_scan_v1(v_scan - 'weightKg','{}'::jsonb);
    raise exception 'MISSING_WEIGHT_ACCEPTED';
  exception when others then assert sqlerrm = 'WEIGHT_REQUIRED',sqlerrm; end;
  v_checks := v_checks + 1;

  perform set_config('request.jwt.claim.sub','',true);
  begin
    perform public.system_save_foundation_scan_v1(v_scan,'{}'::jsonb);
    raise exception 'MISSING_IDENTITY_ACCEPTED';
  exception when others then assert sqlerrm = 'AUTH_REQUIRED',sqlerrm; end;
  v_checks := v_checks + 1;
  perform set_config('role','postgres',true);
  assert (select profile_data->>'marker' from public.profiles where id=v_other) = 'UNCHANGED';
  v_checks := v_checks + 1;
  perform set_config('system.foundation_goals_report',jsonb_build_object('checks_passed',v_checks,'rollback',true)::text,true);
end $test$;
select current_setting('system.foundation_goals_report')::jsonb as report;
rollback;
