-- Synthetic accounts and report fixtures are rolled back; no player changed.
begin;
do $test$
declare v_user uuid := gen_random_uuid(); v_other uuid := gen_random_uuid(); v_count integer; v_checks integer := 0;
begin
  assert not has_function_privilege('anon','public.system_accept_quest_by_title_v2(text,integer,jsonb,date)','execute'), 'Anonymous acceptance exposed';
  assert not has_function_privilege('anon','public.system_complete_quest_by_title_v2(text,jsonb,date)','execute'), 'Anonymous completion exposed';
  assert has_function_privilege('authenticated','public.system_accept_quest_by_title_v2(text,integer,jsonb,date)','execute'), 'Player acceptance unavailable';
  assert has_function_privilege('authenticated','public.system_complete_quest_by_title_v2(text,jsonb,date)','execute'), 'Player completion unavailable';
  assert not has_function_privilege('anon','public.system_report_client_error_v1(text,text,text)','execute'), 'Anonymous telemetry exposed';
  v_checks := 5;
  insert into auth.users(id,email) values(v_user,'launch-check-'||v_user||'@example.invalid'),(v_other,'launch-check-'||v_other||'@example.invalid');
  insert into public.profiles(id,name,age,class) values(v_user,'Launch check',25,'MAGE'),(v_other,'Other check',25,'TANK');
  perform set_config('request.jwt.claim.sub',v_user::text,true);
  perform set_config('role','authenticated',true);
  assert public.system_report_client_error_v1('REQUEST_TIMEOUT','ARCHIVE','2.9.6'), 'Report not saved'; v_checks:=v_checks+1;
  begin
    perform public.system_report_client_error_v1('https://private.invalid?token=secret','AI','2.9.6');
    raise exception 'Unstructured private report accepted';
  exception when others then assert sqlerrm='INVALID_ERROR_EVENT',sqlerrm; end;
  v_checks:=v_checks+1;
  begin
    perform 1 from public.client_error_events;
    raise exception 'Player can read raw telemetry';
  exception when insufficient_privilege then null; end;
  v_checks:=v_checks+1;
  for v_count in 2..20 loop assert public.system_report_client_error_v1('REQUEST_TIMEOUT','ARCHIVE','2.9.6'); end loop;
  assert not public.system_report_client_error_v1('REQUEST_TIMEOUT','ARCHIVE','2.9.6'), 'Report rate limit failed'; v_checks:=v_checks+1;
  perform set_config('request.jwt.claim.sub',v_other::text,true);
  assert public.system_report_client_error_v1('NETWORK_UNAVAILABLE','NETWORK','2.9.6'), 'Account rate limit leaked'; v_checks:=v_checks+1;
  perform set_config('role','postgres',true);
  assert (select count(*) from public.client_error_events where user_id=v_user)=20, 'Incorrect report ownership'; v_checks:=v_checks+1;
  assert (select count(*) from public.client_error_events where user_id=v_other)=1, 'Incorrect second owner'; v_checks:=v_checks+1;
  perform set_config('request.jwt.claim.sub','',true);
  begin perform public.system_report_client_error_v1('REQUEST_TIMEOUT','AI','2.9.6'); raise exception 'Missing identity accepted';
  exception when others then assert sqlerrm='AUTH_REQUIRED',sqlerrm; end;
  v_checks:=v_checks+1;
  perform set_config('the_system.launch_checks',v_checks::text,true);
end;
$test$;
select jsonb_build_object('checks_passed',current_setting('the_system.launch_checks')::integer,'rollback',true) as report;
rollback;
