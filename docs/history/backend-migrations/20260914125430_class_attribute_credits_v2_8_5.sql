-- THE SYSTEM 2.8.5 — Class-aligned attributes and server-authoritative credits.
--
-- This migration deliberately does not rewrite earned player attributes. It only
-- calibrates untouched legacy rows that still exactly match the old all-10
-- placeholder defaults, then makes all future quest-credit allocation atomic.

create table if not exists public.attribute_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_quest_id uuid not null unique references public.user_quests(id) on delete cascade,
  source_title text not null,
  source_category text not null,
  eligible_attributes text[] not null,
  credits_awarded integer not null check (credits_awarded between 1 and 3),
  credits_spent integer not null default 0 check (credits_spent >= 0 and credits_spent <= credits_awarded),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(eligible_attributes) between 1 and 3),
  check (
    eligible_attributes <@ array[
      'STRENGTH', 'SPEED', 'ENDURANCE', 'INTELLIGENCE', 'FOCUS',
      'DISCIPLINE', 'WEALTH', 'CHARISMA', 'CREATIVITY', 'RECOVERY'
    ]::text[]
  )
);

create table if not exists public.attribute_credit_allocations (
  id bigint generated always as identity primary key,
  credit_id uuid not null references public.attribute_credit_ledger(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  attribute_name text not null check (
    attribute_name in (
      'STRENGTH', 'SPEED', 'ENDURANCE', 'INTELLIGENCE', 'FOCUS',
      'DISCIPLINE', 'WEALTH', 'CHARISMA', 'CREATIVITY', 'RECOVERY'
    )
  ),
  amount integer not null check (amount between 1 and 3),
  created_at timestamptz not null default now()
);

create index if not exists attribute_credit_ledger_user_pending_idx
  on public.attribute_credit_ledger (user_id, created_at desc)
  where credits_spent < credits_awarded;

create index if not exists attribute_credit_allocations_user_created_idx
  on public.attribute_credit_allocations (user_id, created_at desc);

alter table public.attribute_credit_ledger enable row level security;
alter table public.attribute_credit_allocations enable row level security;

revoke all on table public.attribute_credit_ledger from public, anon, authenticated;
revoke all on table public.attribute_credit_allocations from public, anon, authenticated;
grant select on table public.attribute_credit_ledger to authenticated;
grant select on table public.attribute_credit_allocations to authenticated;

drop policy if exists "Players can view own attribute credit ledger" on public.attribute_credit_ledger;
create policy "Players can view own attribute credit ledger"
  on public.attribute_credit_ledger
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Players can view own attribute allocations" on public.attribute_credit_allocations;
create policy "Players can view own attribute allocations"
  on public.attribute_credit_allocations
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Class defaults are used only for a newly created attributes row. Existing
-- earned values are never overwritten by profile initialization.
create or replace function public.system_initialize_profile(
  p_name text,
  p_age integer,
  p_gender text,
  p_class text,
  p_fingerprint text default null,
  p_profile_data jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles;
  v_attributes public.attributes;
  v_class text := upper(trim(coalesce(p_class, 'COMMANDER')));
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'INVALID_NAME';
  end if;

  if p_age is null or p_age < 13 or p_age > 120 then
    raise exception 'INVALID_AGE';
  end if;

  if v_class not in ('COMMANDER', 'TANK', 'ASSASSIN', 'MAGE', 'RANGER') then
    raise exception 'INVALID_CLASS';
  end if;

  insert into public.profiles(
    id, name, age, gender, class, level, xp, streak, momentum,
    fingerprint, profile_data, current_class_since
  )
  values (
    v_user,
    trim(p_name),
    p_age,
    nullif(trim(coalesce(p_gender, '')), ''),
    v_class,
    1,
    0,
    0,
    0,
    p_fingerprint,
    coalesce(p_profile_data, '{}'::jsonb)
      - array['xp', 'level', 'streak', 'momentum', 'attributes', 'masteredSkills', 'bossQuests', 'rewards', 'customInventory']::text[],
    now()
  )
  on conflict (id) do update
  set
    name = excluded.name,
    age = excluded.age,
    gender = excluded.gender,
    fingerprint = coalesce(public.profiles.fingerprint, excluded.fingerprint),
    profile_data = coalesce(public.profiles.profile_data, '{}'::jsonb) || excluded.profile_data,
    updated_at = now()
  returning * into v_profile;

  insert into public.attributes(
    user_id, strength, speed, endurance, intelligence, focus,
    discipline, wealth, charisma, creativity, recovery
  )
  values (
    v_user,
    case v_class
      when 'MAGE' then 4 when 'COMMANDER' then 5 when 'TANK' then 15 when 'ASSASSIN' then 7 when 'RANGER' then 8
    end,
    case v_class
      when 'MAGE' then 5 when 'COMMANDER' then 5 when 'TANK' then 5 when 'ASSASSIN' then 15 when 'RANGER' then 13
    end,
    case v_class
      when 'MAGE' then 5 when 'COMMANDER' then 6 when 'TANK' then 14 when 'ASSASSIN' then 8 when 'RANGER' then 15
    end,
    case v_class
      when 'MAGE' then 15 when 'COMMANDER' then 8 when 'TANK' then 6 when 'ASSASSIN' then 7 when 'RANGER' then 7
    end,
    case v_class
      when 'MAGE' then 13 when 'COMMANDER' then 11 when 'TANK' then 8 when 'ASSASSIN' then 14 when 'RANGER' then 10
    end,
    case v_class
      when 'MAGE' then 9 when 'COMMANDER' then 13 when 'TANK' then 12 when 'ASSASSIN' then 12 when 'RANGER' then 9
    end,
    case v_class
      when 'MAGE' then 5 when 'COMMANDER' then 10 when 'TANK' then 4 when 'ASSASSIN' then 5 when 'RANGER' then 4
    end,
    case v_class
      when 'MAGE' then 5 when 'COMMANDER' then 15 when 'TANK' then 5 when 'ASSASSIN' then 5 when 'RANGER' then 5
    end,
    case v_class
      when 'MAGE' then 11 when 'COMMANDER' then 7 when 'TANK' then 5 when 'ASSASSIN' then 10 when 'RANGER' then 6
    end,
    case v_class
      when 'MAGE' then 8 when 'COMMANDER' then 8 when 'TANK' then 10 when 'ASSASSIN' then 7 when 'RANGER' then 12
    end
  )
  on conflict (user_id) do nothing;

  select * into v_attributes
  from public.attributes
  where user_id = v_user;

  return jsonb_build_object(
    'profile', to_jsonb(v_profile),
    'attributes', to_jsonb(v_attributes)
  );
end;
$function$;

revoke all on function public.system_initialize_profile(text, integer, text, text, text, jsonb) from public, anon;
grant execute on function public.system_initialize_profile(text, integer, text, text, text, jsonb) to authenticated;

-- Calibrate only untouched legacy placeholder rows. A player who has earned or
-- otherwise changed any attribute keeps every existing value exactly as-is.
update public.attributes a
set
  strength = case upper(p.class) when 'MAGE' then 4 when 'COMMANDER' then 5 when 'TANK' then 15 when 'ASSASSIN' then 7 when 'RANGER' then 8 else a.strength end,
  speed = case upper(p.class) when 'MAGE' then 5 when 'COMMANDER' then 5 when 'TANK' then 5 when 'ASSASSIN' then 15 when 'RANGER' then 13 else a.speed end,
  endurance = case upper(p.class) when 'MAGE' then 5 when 'COMMANDER' then 6 when 'TANK' then 14 when 'ASSASSIN' then 8 when 'RANGER' then 15 else a.endurance end,
  intelligence = case upper(p.class) when 'MAGE' then 15 when 'COMMANDER' then 8 when 'TANK' then 6 when 'ASSASSIN' then 7 when 'RANGER' then 7 else a.intelligence end,
  focus = case upper(p.class) when 'MAGE' then 13 when 'COMMANDER' then 11 when 'TANK' then 8 when 'ASSASSIN' then 14 when 'RANGER' then 10 else a.focus end,
  discipline = case upper(p.class) when 'MAGE' then 9 when 'COMMANDER' then 13 when 'TANK' then 12 when 'ASSASSIN' then 12 when 'RANGER' then 9 else a.discipline end,
  wealth = case upper(p.class) when 'MAGE' then 5 when 'COMMANDER' then 10 when 'TANK' then 4 when 'ASSASSIN' then 5 when 'RANGER' then 4 else a.wealth end,
  charisma = case upper(p.class) when 'MAGE' then 5 when 'COMMANDER' then 15 when 'TANK' then 5 when 'ASSASSIN' then 5 when 'RANGER' then 5 else a.charisma end,
  creativity = case upper(p.class) when 'MAGE' then 11 when 'COMMANDER' then 7 when 'TANK' then 5 when 'ASSASSIN' then 10 when 'RANGER' then 6 else a.creativity end,
  recovery = case upper(p.class) when 'MAGE' then 8 when 'COMMANDER' then 8 when 'TANK' then 10 when 'ASSASSIN' then 7 when 'RANGER' then 12 else a.recovery end,
  updated_at = now()
from public.profiles p
where p.id = a.user_id
  and a.strength = 10
  and a.speed = 10
  and a.endurance = 10
  and a.intelligence = 10
  and a.focus = 10
  and a.discipline = 10
  and a.wealth = 10
  and a.charisma = 10
  and a.creativity = 10
  and a.recovery = 10
  and not exists (
    select 1
    from public.progression_events e
    where e.user_id = a.user_id
      and e.attribute_name is not null
  );

create or replace function public.system_class_credit_attributes_v1(p_class text)
returns text[]
language plpgsql
immutable
set search_path = ''
as $function$
begin
  return case upper(trim(coalesce(p_class, 'COMMANDER')))
    when 'MAGE' then array['INTELLIGENCE', 'FOCUS', 'CREATIVITY']::text[]
    when 'COMMANDER' then array['CHARISMA', 'DISCIPLINE', 'FOCUS']::text[]
    when 'TANK' then array['STRENGTH', 'ENDURANCE', 'DISCIPLINE']::text[]
    when 'ASSASSIN' then array['SPEED', 'FOCUS', 'DISCIPLINE']::text[]
    when 'RANGER' then array['ENDURANCE', 'SPEED', 'RECOVERY']::text[]
    else array['DISCIPLINE', 'FOCUS', 'RECOVERY']::text[]
  end;
end;
$function$;

create or replace function public.system_quest_credit_attributes_v1(
  p_category text,
  p_attribute_reward text,
  p_class text
)
returns text[]
language plpgsql
immutable
set search_path = ''
as $function$
declare
  v_category text := upper(trim(coalesce(p_category, '')));
  v_reward text := upper(trim(coalesce(p_attribute_reward, '')));
  v_attributes text[];
begin
  v_attributes := case v_category
    when 'PHYSICAL' then array['STRENGTH', 'ENDURANCE', 'RECOVERY']::text[]
    when 'LEARNING' then array['INTELLIGENCE', 'FOCUS', 'CREATIVITY']::text[]
    when 'FOCUS' then array['FOCUS', 'DISCIPLINE', 'INTELLIGENCE']::text[]
    when 'DISCIPLINE' then array['DISCIPLINE', 'FOCUS', 'RECOVERY']::text[]
    when 'RECOVERY' then array['RECOVERY', 'ENDURANCE', 'DISCIPLINE']::text[]
    when 'HEALTH' then array['RECOVERY', 'ENDURANCE', 'DISCIPLINE']::text[]
    when 'NUTRITION' then array['RECOVERY', 'ENDURANCE', 'DISCIPLINE']::text[]
    when 'WEALTH' then array['WEALTH', 'DISCIPLINE', 'INTELLIGENCE']::text[]
    when 'SOCIAL' then array['CHARISMA', 'FOCUS', 'DISCIPLINE']::text[]
    when 'HOME' then array['DISCIPLINE', 'FOCUS', 'RECOVERY']::text[]
    when 'HYGIENE' then array['DISCIPLINE', 'RECOVERY', 'FOCUS']::text[]
    when 'CLASS' then public.system_class_credit_attributes_v1(p_class)
    else public.system_class_credit_attributes_v1(p_class)
  end;

  if v_reward in (
    'STRENGTH', 'SPEED', 'ENDURANCE', 'INTELLIGENCE', 'FOCUS',
    'DISCIPLINE', 'WEALTH', 'CHARISMA', 'CREATIVITY', 'RECOVERY'
  ) and not (v_reward = any(v_attributes)) then
    v_attributes := array_prepend(v_reward, v_attributes[1:2]);
  end if;

  return v_attributes;
end;
$function$;

create or replace function public.system_quest_attribute_credit_amount_v1(
  p_quest_type text,
  p_difficulty text
)
returns integer
language sql
immutable
set search_path = ''
as $function$
  select case
    when upper(coalesce(p_difficulty, '')) = 'ELITE' then 3
    when upper(coalesce(p_quest_type, '')) = 'MUST' then 2
    when upper(coalesce(p_difficulty, '')) = 'HARD' then 2
    else 1
  end;
$function$;

revoke all on function public.system_class_credit_attributes_v1(text) from public, anon, authenticated;
revoke all on function public.system_quest_credit_attributes_v1(text, text, text) from public, anon, authenticated;
revoke all on function public.system_quest_attribute_credit_amount_v1(text, text) from public, anon, authenticated;

-- Quest completion stays authoritative. XP is awarded as before, but the old
-- immediate attribute mutation is exchanged for a server-created credit with
-- a server-computed eligible-attribute list and daily earned-credit cap.
create or replace function public.system_complete_quest(
  p_user_quest_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_quest public.user_quests;
  v_profile public.profiles;
  v_streak jsonb;
  v_credit public.attribute_credit_ledger;
  v_credit_summary jsonb := jsonb_build_object('status', 'NOT_EARNED');
  v_proof_type text := upper(trim(coalesce(p_metadata->>'proof_type', '')));
  v_has_credit_proof boolean := false;
  v_difficulty text := '';
  v_requested_credits integer := 0;
  v_earned_today integer := 0;
  v_granted_credits integer := 0;
  v_daily_credit_cap constant integer := 4;
  v_eligible_attributes text[];
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_quest
  from public.user_quests
  where id = p_user_quest_id
    and user_id = v_user
  for update;

  if not found then raise exception 'QUEST_NOT_FOUND'; end if;
  if v_quest.status = 'COMPLETED' then raise exception 'QUEST_ALREADY_COMPLETED'; end if;
  if v_quest.status = 'FAILED' then raise exception 'QUEST_ALREADY_FAILED'; end if;
  if v_quest.expires_at is not null and v_quest.expires_at < now() then raise exception 'QUEST_EXPIRED'; end if;

  update public.user_quests
  set
    status = 'COMPLETED',
    completed_at = now(),
    updated_at = now(),
    metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb)
  where id = v_quest.id
  returning * into v_quest;

  select * into v_profile
  from public.system_award_xp(
    v_quest.xp_reward,
    'QUEST',
    v_quest.title_snapshot,
    jsonb_build_object('user_quest_id', v_quest.id, 'quest_type', v_quest.quest_type)
  );

  v_has_credit_proof :=
    v_proof_type in ('TIME', 'PERFORMANCE', 'LEARNING', 'RESULT', 'PHOTO', 'VIDEO', 'GPS', 'HONOR')
    and nullif(trim(coalesce(p_metadata->>'proof_verified_at', '')), '') is not null;

  if v_has_credit_proof then
    select coalesce(q.difficulty, '')
    into v_difficulty
    from public.quest_library q
    where q.id = v_quest.quest_id;

    v_requested_credits := public.system_quest_attribute_credit_amount_v1(
      v_quest.quest_type,
      v_difficulty
    );

    if v_requested_credits = 1 and v_quest.quest_type = 'MUST' then
      v_requested_credits := 2;
    end if;

    select coalesce(sum(credit.credits_awarded), 0)
    into v_earned_today
    from public.attribute_credit_ledger credit
    join public.user_quests completed_quest
      on completed_quest.id = credit.user_quest_id
    where credit.user_id = v_user
      and completed_quest.assigned_for = v_quest.assigned_for;

    v_granted_credits := greatest(
      0,
      least(v_requested_credits, v_daily_credit_cap - v_earned_today)
    );

    if v_granted_credits > 0 then
      v_eligible_attributes := public.system_quest_credit_attributes_v1(
        v_quest.category,
        v_quest.attribute_reward,
        v_profile.class
      );

      insert into public.attribute_credit_ledger(
        user_id,
        user_quest_id,
        source_title,
        source_category,
        eligible_attributes,
        credits_awarded,
        metadata
      )
      values (
        v_user,
        v_quest.id,
        v_quest.title_snapshot,
        v_quest.category,
        v_eligible_attributes,
        v_granted_credits,
        jsonb_build_object(
          'quest_type', v_quest.quest_type,
          'proof_type', v_proof_type,
          'assigned_for', v_quest.assigned_for,
          'daily_credit_cap', v_daily_credit_cap
        )
      )
      on conflict (user_quest_id) do nothing
      returning * into v_credit;

      if v_credit.id is not null then
        v_credit_summary := to_jsonb(v_credit) || jsonb_build_object(
          'status', 'READY',
          'credits_available', v_credit.credits_awarded - v_credit.credits_spent
        );
      else
        v_credit_summary := jsonb_build_object('status', 'ALREADY_RECORDED');
      end if;
    else
      v_credit_summary := jsonb_build_object(
        'status', 'DAILY_CAP_REACHED',
        'daily_credit_cap', v_daily_credit_cap,
        'earned_today', v_earned_today
      );
    end if;
  else
    v_credit_summary := jsonb_build_object('status', 'PROOF_RECEIPT_REQUIRED');
  end if;

  insert into public.journey_events(
    user_id, event_type, title, detail, source, source_id, xp_delta, metadata
  )
  values (
    v_user,
    'QUEST_COMPLETE',
    v_quest.title_snapshot,
    v_quest.objective_snapshot,
    'QUEST',
    v_quest.id::text,
    v_quest.xp_reward,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('attribute_credit', v_credit_summary)
  );

  v_streak := public.system_recalculate_daily_streak();
  select * into v_profile from public.profiles where id = v_user;

  return jsonb_build_object(
    'quest', to_jsonb(v_quest),
    'profile', to_jsonb(v_profile),
    'streak', v_streak,
    'attribute_credit', v_credit_summary
  );
end;
$function$;

revoke all on function public.system_complete_quest(uuid, jsonb) from public, anon;
grant execute on function public.system_complete_quest(uuid, jsonb) to authenticated;

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

  insert into public.attributes(user_id)
  values (v_user)
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

  select * into v_profile
  from public.profiles
  where id = v_user;

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

