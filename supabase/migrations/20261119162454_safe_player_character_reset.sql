-- Reset one authenticated player's character while preserving their Auth account.
-- All user-owned rows are deleted transactionally; the Edge Function removes
-- private storage objects before invoking this RPC.
create or replace function public.system_delete_player_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_table record;
  v_rows bigint;
  v_total bigint := 0;
  v_tables integer := 0;
  v_profile_deleted boolean := false;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  perform 1 from auth.users where id = v_user for update;
  if not found then
    raise exception 'AUTH_REQUIRED';
  end if;

  -- class_special_sessions has a NO ACTION FK to gps_sessions, so it must
  -- be removed first. Other user-owned child relationships are CASCADE or
  -- SET NULL and are safe regardless of the remaining table order.
  for v_table in
    select c.table_schema, c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema
     and t.table_name = c.table_name
    where c.table_schema in ('public', 'system_private')
      and t.table_type = 'BASE TABLE'
      and c.column_name = 'user_id'
    group by c.table_schema, c.table_name
    order by
      case when c.table_schema = 'public' and c.table_name = 'class_special_sessions' then 0 else 1 end,
      c.table_schema,
      c.table_name
  loop
    execute format('delete from %I.%I where user_id = $1', v_table.table_schema, v_table.table_name)
      using v_user;
    get diagnostics v_rows = row_count;
    v_total := v_total + v_rows;
    v_tables := v_tables + 1;
  end loop;

  delete from public.profiles where id = v_user;
  get diagnostics v_rows = row_count;
  v_profile_deleted := v_rows > 0;
  v_total := v_total + v_rows;

  return jsonb_build_object(
    'deleted_rows', v_total,
    'tables_processed', v_tables,
    'profile_deleted', v_profile_deleted,
    'auth_account_preserved', true
  );
end;
$function$;

revoke all on function public.system_delete_player_data() from public;
revoke all on function public.system_delete_player_data() from anon;
grant execute on function public.system_delete_player_data() to authenticated;

comment on function public.system_delete_player_data() is
  'Deletes all player-owned public/private database rows and their profile, but preserves the authenticated Supabase Auth account. Call through system-api after private storage cleanup.';
