create table public.quest_library (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  objective text not null,
  system_message text,
  category text not null check (category in ('DISCIPLINE','PHYSICAL','FOCUS','HEALTH','RECOVERY','HYGIENE','NUTRITION','HOME','WEALTH','LEARNING','SOCIAL','CLASS')),
  quest_type text not null check (quest_type in ('DAILY','CLASS','MUST','RARE','STANDARD')),
  difficulty text not null default 'NORMAL' check (difficulty in ('EASY','NORMAL','HARD','ELITE')),
  class_affinity text[] not null default '{}'::text[],
  attribute_reward text check (attribute_reward is null or attribute_reward in ('STRENGTH','SPEED','ENDURANCE','INTELLIGENCE','FOCUS','DISCIPLINE','WEALTH','CHARISMA','CREATIVITY','RECOVERY')),
  attribute_delta integer not null default 0,
  xp_reward integer not null default 0 check (xp_reward >= 0),
  failure_xp_penalty integer not null default 0 check (failure_xp_penalty >= 0),
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  min_level integer not null default 1 check (min_level >= 1),
  health_value smallint not null default 0 check (health_value between 0 and 5),
  procrastination_tag text,
  frequency text not null default 'ROTATING' check (frequency in ('DAILY','ROTATING','WEEKLY','RARE','ON_DEMAND')),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_quests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quest_id uuid references public.quest_library(id) on delete set null,
  assigned_for date not null default current_date,
  quest_type text not null check (quest_type in ('DAILY','CLASS','MUST','RARE','STANDARD')),
  title_snapshot text not null,
  objective_snapshot text not null,
  category text not null,
  status text not null default 'ASSIGNED' check (status in ('ASSIGNED','ACCEPTED','COMPLETED','FAILED','DECLINED','EXPIRED','IGNORED')),
  source text not null default 'SYSTEM',
  accepted_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  expires_at timestamptz,
  xp_reward integer not null default 0,
  xp_penalty integer not null default 0,
  attribute_reward text,
  attribute_delta integer not null default 0,
  consequence text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index user_quests_user_date_idx on public.user_quests(user_id, assigned_for desc);
create index user_quests_status_idx on public.user_quests(user_id, status);
create index quest_library_category_idx on public.quest_library(category, quest_type, active);

alter table public.quest_library enable row level security;
alter table public.user_quests enable row level security;

revoke all on table public.quest_library from anon;
revoke all on table public.user_quests from anon;

grant select on table public.quest_library to authenticated;
grant select, insert, update, delete on table public.user_quests to authenticated;
grant all on table public.quest_library to service_role;
grant all on table public.user_quests to service_role;

create policy "quest_library_authenticated_read"
on public.quest_library
for select
to authenticated
using (active = true);

create policy "user_quests_select_own"
on public.user_quests
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "user_quests_insert_own"
on public.user_quests
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "user_quests_update_own"
on public.user_quests
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "user_quests_delete_own"
on public.user_quests
for delete
to authenticated
using ((select auth.uid()) = user_id);
