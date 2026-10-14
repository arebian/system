-- THE SYSTEM 2.8.5 follow-up hardening.
-- Keep every credit allocation fast and ensure a rare legacy profile with no
-- attributes row is initialized with its class baseline rather than all-10s.

create index if not exists attribute_credit_allocations_credit_id_idx
  on public.attribute_credit_allocations (credit_id);

create or replace function public.system_allocate_attribute_credit_v1(
  p_credit_id uuid,
  p_attribute text,
  p_amount integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_credit public.attribute_credit_ledger;
  v_attributes public.attributes;
  v_profile public.profiles;
  v_attribute text := upper(trim(coalesce(p_attribute, '')));
  v_before integer := 0;
  v_after integer := 0;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_amount is null or p_amount < 1 or p_amount > 3 then
    raise exception 'INVALID_CREDIT_AMOUNT';
  end if;

  if v_attribute not in (
    'STRENGTH', 'SPEED', 'ENDURANCE', 'INTELLIGENCE', 'FOCUS',
    'DISCIPLINE', 'WEALTH', 'CHARISMA', 'CREATIVITY', 'RECOVERY'
  ) then
    raise exception 'INVALID_ATTRIBUTE';
  end if;

  select * into v_profile
  from public.profiles
  where id = v_user;

  if not found then
    raise exception 'PROFILE_NOT_READY';
  end if;

  select * into v_credit
  from public.attribute_credit_ledger
  where id = p_credit_id
    and user_id = v_user
  for update;

  if not found then
    raise exception 'ATTRIBUTE_CREDIT_NOT_FOUND';
  end if;

  if v_attribute <> all(v_credit.eligible_attributes) then
    raise exception 'ATTRIBUTE_NOT_ELIGIBLE_FOR_CREDIT';
  end if;

  if v_credit.credits_spent + p_amount > v_credit.credits_awarded then
    raise exception 'INSUFFICIENT_ATTRIBUTE_CREDITS';
  end if;

  insert into public.attributes(
    user_id, strength, speed, endurance, intelligence, focus,
    discipline, wealth, charisma, creativity, recovery
  )
  values (
    v_user,
    case upper(v_profile.class)
      when 'MAGE' then 4 when 'COMMANDER' then 5 when 'TANK' then 15 when 'ASSASSIN' then 7 when 'RANGER' then 8 else 5
    end,
    case upper(v_profile.class)
      when 'MAGE' then 5 when 'COMMANDER' then 5 when 'TANK' then 5 when 'ASSASSIN' then 15 when 'RANGER' then 13 else 5
    end,
    case upper(v_profile.class)
      when 'MAGE' then 5 when 'COMMANDER' then 6 when 'TANK' then 14 when 'ASSASSIN' then 8 when 'RANGER' then 15 else 6
    end,
    case upper(v_profile.class)
      when 'MAGE' then 15 when 'COMMANDER' then 8 when 'TANK' then 6 when 'ASSASSIN' then 7 when 'RANGER' then 7 else 8
    end,
    case upper(v_profile.class)
      when 'MAGE' then 13 when 'COMMANDER' then 11 when 'TANK' then 8 when 'ASSASSIN' then 14 when 'RANGER' then 10 else 11
    end,
    case upper(v_profile.class)
      when 'MAGE' then 9 when 'COMMANDER' then 13 when 'TANK' then 12 when 'ASSASSIN' then 12 when 'RANGER' then 9 else 13
    end,
    case upper(v_profile.class)
      when 'MAGE' then 5 when 'COMMANDER' then 10 when 'TANK' then 4 when 'ASSASSIN' then 5 when 'RANGER' then 4 else 10
    end,
    case upper(v_profile.class)
      when 'MAGE' then 5 when 'COMMANDER' then 15 when 'TANK' then 5 when 'ASSASSIN' then 5 when 'RANGER' then 5 else 15
    end,
    case upper(v_profile.class)
      when 'MAGE' then 11 when 'COMMANDER' then 7 when 'TANK' then 5 when 'ASSASSIN' then 10 when 'RANGER' then 6 else 7
    end,
    case upper(v_profile.class)
      when 'MAGE' then 8 when 'COMMANDER' then 8 when 'TANK' then 10 when 'ASSASSIN' then 7 when 'RANGER' then 12 else 8
    end
  )
  on conflict (user_id) do nothing;

  select * into v_attributes
  from public.attributes
  where user_id = v_user
  for update;

  v_before := case v_attribute
    when 'STRENGTH' then v_attributes.strength
    when 'SPEED' then v_attributes.speed
    when 'ENDURANCE' then v_attributes.endurance
    when 'INTELLIGENCE' then v_attributes.intelligence
    when 'FOCUS' then v_attributes.focus
    when 'DISCIPLINE' then v_attributes.discipline
    when 'WEALTH' then v_attributes.wealth
    when 'CHARISMA' then v_attributes.charisma
    when 'CREATIVITY' then v_attributes.creativity
    when 'RECOVERY' then v_attributes.recovery
  end;

  execute format(
    'update public.attributes set %I = %I + $1, updated_at = now() where user_id = $2 returning *',
    lower(v_attribute),
    lower(v_attribute)
  )
  into v_attributes
  using p_amount, v_user;

  v_after := case v_attribute
    when 'STRENGTH' then v_attributes.strength
    when 'SPEED' then v_attributes.speed
    when 'ENDURANCE' then v_attributes.endurance
    when 'INTELLIGENCE' then v_attributes.intelligence
    when 'FOCUS' then v_attributes.focus
    when 'DISCIPLINE' then v_attributes.discipline
    when 'WEALTH' then v_attributes.wealth
    when 'CHARISMA' then v_attributes.charisma
    when 'CREATIVITY' then v_attributes.creativity
    when 'RECOVERY' then v_attributes.recovery
  end;

  update public.attribute_credit_ledger
  set
    credits_spent = credits_spent + p_amount,
    updated_at = now()
  where id = v_credit.id
  returning * into v_credit;

  insert into public.attribute_credit_allocations(
    credit_id, user_id, attribute_name, amount
  )
  values (
    v_credit.id, v_user, v_attribute, p_amount
  );

  insert into public.progression_events(
    user_id, event_type, source, title, xp_delta,
    level_before, level_after, attribute_name, attribute_delta, metadata
  )
  values (
    v_user,
    'ATTRIBUTE_CREDIT_ALLOCATED',
    'ATTRIBUTE_CREDIT',
    v_credit.source_title,
    0,
    v_profile.level,
    v_profile.level,
    v_attribute,
    v_after - v_before,
    jsonb_build_object(
      'credit_id', v_credit.id,
      'user_quest_id', v_credit.user_quest_id,
      'eligible_attributes', v_credit.eligible_attributes
    )
  );

  return jsonb_build_object(
    'credit', to_jsonb(v_credit),
    'attributes', to_jsonb(v_attributes),
    'attribute', v_attribute,
    'amount', p_amount,
    'remaining', v_credit.credits_awarded - v_credit.credits_spent
  );
end;
$function$;

revoke all on function public.system_allocate_attribute_credit_v1(uuid, text, integer) from public, anon;
grant execute on function public.system_allocate_attribute_credit_v1(uuid, text, integer) to authenticated;

