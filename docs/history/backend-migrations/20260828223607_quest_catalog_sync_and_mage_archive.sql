-- Keep the live Must Quest catalog aligned with the current React client.
insert into public.quest_library
(code,title,objective,system_message,category,quest_type,difficulty,class_affinity,attribute_reward,attribute_delta,xp_reward,failure_xp_penalty,duration_minutes,min_level,health_value,procrastination_tag,frequency,active,metadata)
values
('must_important_first','IMPORTANT FIRST','Spend at least 25 minutes on the most important unfinished responsibility.','Do not allow minor tasks to protect the major one.','FOCUS','MUST','HARD',array[]::text[],'FOCUS',1,70,30,25,1,2,'PRIORITY','ROTATING',true,'{}'::jsonb),
('must_mental_lock','MENTAL LOCK','Choose one task and work without unnecessary switching for 30 minutes.','Attention is a weapon. Stop dropping it.','FOCUS','MUST','NORMAL',array[]::text[],'FOCUS',1,65,25,30,1,2,'DISTRACTION','ROTATING',true,'{}'::jsonb),
('must_assassin_footwork','FOOTWORK PROTOCOL','Complete 3 rounds: 60 seconds light footwork, 10 bodyweight squats, 8 controlled push-ups or incline push-ups. Rest 45 seconds between rounds. Finish with a 5-minute brisk walk.','Speed begins with controlled movement.','PHYSICAL','MUST','NORMAL',array['ASSASSIN']::text[],'SPEED',1,65,25,15,1,4,null,'ROTATING',true,'{}'::jsonb),
('must_assassin_quick_body','QUICK BODY','Complete 20 alternating reverse lunges, 20 mountain climbers per side, 30 seconds plank, then 10 minutes of brisk walking. Move with control, not panic.','Precision before speed.','PHYSICAL','MUST','NORMAL',array['ASSASSIN']::text[],'SPEED',1,65,25,15,1,4,null,'ROTATING',true,'{}'::jsonb),
('must_assassin_mobility','MOBILITY STRIKE','Complete 2 rounds: 10 slow squats, 10 scapular push-ups, 30 seconds hip-flexor stretch per side, 30 seconds calf stretch per side, then 5 minutes easy movement.','A restricted body cannot move cleanly.','RECOVERY','MUST','NORMAL',array['ASSASSIN']::text[],'RECOVERY',1,60,25,15,1,5,null,'ROTATING',true,'{}'::jsonb),
('must_tank_iron_foundation','IRON FOUNDATION','Complete 3 rounds: 10 controlled push-ups or incline push-ups, 15 bodyweight squats, 30-second plank. Rest 60 seconds between rounds.','Build the frame before loading the frame.','PHYSICAL','MUST','NORMAL',array['TANK']::text[],'STRENGTH',1,65,25,15,1,4,null,'ROTATING',true,'{}'::jsonb),
('must_tank_structural_check','STRUCTURAL CHECK','Complete 3 sets of 12 squats, 3 sets of 8 push-ups or incline push-ups, and 3 sets of a 20-second side plank per side. Rest as needed.','Durability is maintained, not assumed.','PHYSICAL','MUST','HARD',array['TANK']::text[],'STRENGTH',1,70,25,20,1,4,null,'ROTATING',true,'{}'::jsonb),
('must_tank_recovery_armor','RECOVERY ARMOR','Walk for 15 minutes, then complete 5 minutes of gentle shoulder, hip and ankle mobility. No max-effort work required.','Recovery is part of strength.','RECOVERY','MUST','NORMAL',array['TANK']::text[],'RECOVERY',1,60,25,20,1,5,null,'ROTATING',true,'{}'::jsonb),
('must_mage_body_mind_reset','BODY / MIND RESET','Walk briskly for 15 minutes, then complete 2 rounds of 10 bodyweight squats, a 20-second plank and 10 shoulder circles each direction.','A clear mind still requires a functioning body.','RECOVERY','MUST','NORMAL',array['MAGE']::text[],'RECOVERY',1,60,25,20,1,5,null,'ROTATING',true,'{}'::jsonb),
('must_mage_cognitive_mobility','COGNITIVE MOBILITY','Complete 10 minutes of walking plus 5 minutes of mobility: 30 seconds hip-flexor stretch per side, 30 seconds calf stretch per side, 10 thoracic rotations per side and 10 slow squats.','Restore circulation. Return sharper.','RECOVERY','MUST','NORMAL',array['MAGE']::text[],'RECOVERY',1,60,25,15,1,5,null,'ROTATING',true,'{}'::jsonb),
('must_mage_scholars_circuit','SCHOLAR''S CIRCUIT','Complete 2 rounds: 8 controlled push-ups or incline push-ups, 12 squats, 20-second plank and 60 seconds easy marching. Rest 45 seconds between rounds.','Intelligence does not excuse physical neglect.','PHYSICAL','MUST','NORMAL',array['MAGE']::text[],'ENDURANCE',1,65,25,15,1,4,null,'ROTATING',true,'{}'::jsonb),
('must_ranger_base_distance','BASE DISTANCE','Complete 20 minutes of continuous walking or easy jogging. You must remain able to speak in short sentences throughout.','The first weapon of endurance is pacing.','PHYSICAL','MUST','NORMAL',array['RANGER']::text[],'ENDURANCE',1,65,25,20,1,5,null,'ROTATING',true,'{}'::jsonb),
('must_ranger_pace_control','PACE CONTROL','Complete 5 minutes easy walking, 10 minutes brisk walking or easy jogging, then 5 minutes easy walking. Do not turn the middle block into a sprint.','Control the pace. Own the distance.','PHYSICAL','MUST','NORMAL',array['RANGER']::text[],'ENDURANCE',1,65,25,20,1,5,null,'ROTATING',true,'{}'::jsonb),
('must_ranger_trail_legs','TRAIL LEGS','Complete 3 rounds: 12 bodyweight squats, 10 reverse lunges per side and 20 calf raises. Rest 60 seconds between rounds, then walk for 5 minutes.','Prepare the legs for distance.','PHYSICAL','MUST','HARD',array['RANGER']::text[],'ENDURANCE',1,70,25,20,1,4,null,'ROTATING',true,'{}'::jsonb),
('must_commander_command_body','COMMAND BODY','Complete 3 rounds: 10 push-ups or incline push-ups, 12 squats and a 25-second plank. Rest 60 seconds between rounds.','You cannot command what you consistently neglect.','PHYSICAL','MUST','NORMAL',array['COMMANDER']::text[],'DISCIPLINE',1,65,25,15,1,4,null,'ROTATING',true,'{}'::jsonb),
('must_commander_field_readiness','FIELD READINESS','Complete a 15-minute brisk walk, then 2 rounds of 10 squats and 8 controlled push-ups or incline push-ups.','Readiness is a daily standard.','PHYSICAL','MUST','NORMAL',array['COMMANDER']::text[],'ENDURANCE',1,65,25,20,1,5,null,'ROTATING',true,'{}'::jsonb),
('must_commander_maintenance_order','MAINTENANCE ORDER','Complete 10 minutes of easy walking and 5 minutes of shoulder, hip and ankle mobility. This is a maintenance order, not a max-effort session.','Preserve the asset.','RECOVERY','MUST','NORMAL',array['COMMANDER']::text[],'RECOVERY',1,60,25,15,1,5,null,'ROTATING',true,'{}'::jsonb)
on conflict (code) do update set
 title=excluded.title,
 objective=excluded.objective,
 system_message=excluded.system_message,
 category=excluded.category,
 quest_type=excluded.quest_type,
 difficulty=excluded.difficulty,
 class_affinity=excluded.class_affinity,
 attribute_reward=excluded.attribute_reward,
 attribute_delta=excluded.attribute_delta,
 xp_reward=excluded.xp_reward,
 failure_xp_penalty=excluded.failure_xp_penalty,
 duration_minutes=excluded.duration_minutes,
 active=true,
 updated_at=now();

create table if not exists public.mage_book_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  author text not null,
  rank text not null check (rank in ('E','D','C','B','A','S')),
  category text not null,
  difficulty smallint not null default 1 check (difficulty between 1 and 6),
  page_count integer not null check (page_count > 0),
  xp_reward integer not null default 100 check (xp_reward >= 0),
  primary_attribute text not null check (primary_attribute in ('INTELLIGENCE','FOCUS','DISCIPLINE','WEALTH','CHARISMA','CREATIVITY','RECOVERY','ENDURANCE')),
  secondary_attribute text check (secondary_attribute is null or secondary_attribute in ('INTELLIGENCE','FOCUS','DISCIPLINE','WEALTH','CHARISMA','CREATIVITY','RECOVERY','ENDURANCE')),
  summary text not null default '',
  is_story boolean not null default false,
  featured boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mage_book_catalog_rank_idx on public.mage_book_catalog(rank,active,created_at desc);

alter table public.mage_book_catalog enable row level security;
grant select on public.mage_book_catalog to authenticated;
drop policy if exists mage_book_catalog_read on public.mage_book_catalog;
create policy mage_book_catalog_read on public.mage_book_catalog for select to authenticated using (active=true);

create table if not exists public.mage_reading_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.mage_book_catalog(id) on delete cascade,
  status text not null default 'READING' check (status in ('READING','PAUSED','COMPLETED')),
  current_page integer not null default 0 check (current_page >= 0),
  minutes_read integer not null default 0 check (minutes_read >= 0),
  reflection text not null default '',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(user_id,book_id)
);

create index if not exists mage_reading_progress_user_idx on public.mage_reading_progress(user_id,status,updated_at desc);
alter table public.mage_reading_progress enable row level security;
grant select,insert,update,delete on public.mage_reading_progress to authenticated;
drop policy if exists mage_reading_progress_select_own on public.mage_reading_progress;
drop policy if exists mage_reading_progress_insert_own on public.mage_reading_progress;
drop policy if exists mage_reading_progress_update_own on public.mage_reading_progress;
drop policy if exists mage_reading_progress_delete_own on public.mage_reading_progress;
create policy mage_reading_progress_select_own on public.mage_reading_progress for select to authenticated using (user_id=auth.uid());
create policy mage_reading_progress_insert_own on public.mage_reading_progress for insert to authenticated with check (user_id=auth.uid());
create policy mage_reading_progress_update_own on public.mage_reading_progress for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy mage_reading_progress_delete_own on public.mage_reading_progress for delete to authenticated using (user_id=auth.uid());

create or replace function public.mage_start_book(p_book_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public','auth'
as $$
declare
  v_user uuid := auth.uid();
  v_class text;
  v_book public.mage_book_catalog;
  v_progress public.mage_reading_progress;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select class into v_class from public.profiles where id=v_user;
  if upper(coalesce(v_class,'')) <> 'MAGE' then raise exception 'MAGE_CLASS_REQUIRED'; end if;
  select * into v_book from public.mage_book_catalog where id=p_book_id and active=true;
  if not found then raise exception 'BOOK_NOT_FOUND'; end if;

  update public.mage_reading_progress
  set status='PAUSED', updated_at=now()
  where user_id=v_user and status='READING' and book_id<>p_book_id;

  insert into public.mage_reading_progress(user_id,book_id,status)
  values(v_user,p_book_id,'READING')
  on conflict(user_id,book_id) do update
    set status=case when public.mage_reading_progress.status='COMPLETED' then 'COMPLETED' else 'READING' end,
        updated_at=now()
  returning * into v_progress;

  return jsonb_build_object('book',to_jsonb(v_book),'progress',to_jsonb(v_progress));
end;
$$;

grant execute on function public.mage_start_book(uuid) to authenticated;

create or replace function public.mage_log_reading(p_book_id uuid, p_pages integer default 0, p_minutes integer default 0)
returns jsonb
language plpgsql
security definer
set search_path to 'public','auth'
as $$
declare
  v_user uuid := auth.uid();
  v_class text;
  v_book public.mage_book_catalog;
  v_progress public.mage_reading_progress;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if coalesce(p_pages,0) < 0 or coalesce(p_minutes,0) < 0 then raise exception 'INVALID_READING_LOG'; end if;
  if coalesce(p_pages,0) > 100 or coalesce(p_minutes,0) > 240 then raise exception 'READING_LOG_TOO_LARGE'; end if;
  if coalesce(p_pages,0)=0 and coalesce(p_minutes,0)=0 then raise exception 'EMPTY_READING_LOG'; end if;

  select class into v_class from public.profiles where id=v_user;
  if upper(coalesce(v_class,'')) <> 'MAGE' then raise exception 'MAGE_CLASS_REQUIRED'; end if;
  select * into v_book from public.mage_book_catalog where id=p_book_id and active=true;
  if not found then raise exception 'BOOK_NOT_FOUND'; end if;

  insert into public.mage_reading_progress(user_id,book_id,status,current_page,minutes_read)
  values(v_user,p_book_id,'READING',least(v_book.page_count,coalesce(p_pages,0)),coalesce(p_minutes,0))
  on conflict(user_id,book_id) do update
    set current_page=least(v_book.page_count,public.mage_reading_progress.current_page+coalesce(p_pages,0)),
        minutes_read=public.mage_reading_progress.minutes_read+coalesce(p_minutes,0),
        status=case when public.mage_reading_progress.status='COMPLETED' then 'COMPLETED' else 'READING' end,
        updated_at=now()
  returning * into v_progress;

  return jsonb_build_object('book',to_jsonb(v_book),'progress',to_jsonb(v_progress));
end;
$$;

grant execute on function public.mage_log_reading(uuid,integer,integer) to authenticated;

create or replace function public.mage_complete_book(p_book_id uuid, p_reflection text default '')
returns jsonb
language plpgsql
security definer
set search_path to 'public','auth'
as $$
declare
  v_user uuid := auth.uid();
  v_class text;
  v_book public.mage_book_catalog;
  v_progress public.mage_reading_progress;
  v_profile public.profiles;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select class into v_class from public.profiles where id=v_user;
  if upper(coalesce(v_class,'')) <> 'MAGE' then raise exception 'MAGE_CLASS_REQUIRED'; end if;

  select * into v_book from public.mage_book_catalog where id=p_book_id and active=true;
  if not found then raise exception 'BOOK_NOT_FOUND'; end if;

  select * into v_progress from public.mage_reading_progress
  where user_id=v_user and book_id=p_book_id for update;
  if not found then raise exception 'READING_NOT_STARTED'; end if;
  if v_progress.status='COMPLETED' then
    select * into v_profile from public.profiles where id=v_user;
    return jsonb_build_object('duplicate',true,'book',to_jsonb(v_book),'progress',to_jsonb(v_progress),'profile',to_jsonb(v_profile));
  end if;
  if v_progress.current_page < v_book.page_count then raise exception 'BOOK_NOT_FINISHED'; end if;
  if length(trim(coalesce(p_reflection,''))) < 12 then raise exception 'REFLECTION_REQUIRED'; end if;

  update public.mage_reading_progress
  set status='COMPLETED', reflection=trim(p_reflection), completed_at=now(), updated_at=now()
  where id=v_progress.id returning * into v_progress;

  select * into v_profile from public.system_award_xp(
    v_book.xp_reward,'MAGE_BOOK',v_book.title,
    jsonb_build_object('book_id',v_book.id,'rank',v_book.rank,'category',v_book.category)
  );
  perform public.system_add_attribute(
    v_book.primary_attribute,2,'MAGE_BOOK',v_book.title,
    jsonb_build_object('book_id',v_book.id,'rank',v_book.rank)
  );
  if v_book.secondary_attribute is not null and v_book.secondary_attribute<>v_book.primary_attribute then
    perform public.system_add_attribute(
      v_book.secondary_attribute,1,'MAGE_BOOK',v_book.title,
      jsonb_build_object('book_id',v_book.id,'rank',v_book.rank)
    );
  end if;

  insert into public.journey_events(user_id,event_type,title,detail,source,source_id,xp_delta,metadata)
  values(v_user,'BOOK_COMPLETE',v_book.title,trim(p_reflection),'MAGE_ARCHIVE',v_book.id::text,v_book.xp_reward,
         jsonb_build_object('rank',v_book.rank,'author',v_book.author,'category',v_book.category));

  select * into v_profile from public.profiles where id=v_user;
  return jsonb_build_object('book',to_jsonb(v_book),'progress',to_jsonb(v_progress),'profile',to_jsonb(v_profile));
end;
$$;

grant execute on function public.mage_complete_book(uuid,text) to authenticated;

insert into public.mage_book_catalog
(slug,title,author,rank,category,difficulty,page_count,xp_reward,primary_attribute,secondary_attribute,summary,is_story,featured)
values
('the-alchemist','The Alchemist','Paulo Coelho','E','STORY',1,208,80,'CREATIVITY','INTELLIGENCE','A short story-led entry point for building a consistent reading habit.',true,true),
('who-moved-my-cheese','Who Moved My Cheese?','Spencer Johnson','E','DISCIPLINE',1,96,70,'DISCIPLINE','INTELLIGENCE','A very short parable about adapting when circumstances change.',true,false),
('make-your-bed','Make Your Bed','William H. McRaven','E','DISCIPLINE',1,144,75,'DISCIPLINE','FOCUS','Simple lessons about standards, resilience and starting with small wins.',false,false),
('richest-man-babylon','The Richest Man in Babylon','George S. Clason','E','WEALTH',1,194,85,'WEALTH','DISCIPLINE','Money principles taught through accessible parables and stories.',true,true),
('tuesdays-with-morrie','Tuesdays with Morrie','Mitch Albom','E','LIFE',1,224,80,'CHARISMA','INTELLIGENCE','An approachable story about relationships, priorities and meaning.',true,false),
('atomic-habits','Atomic Habits','James Clear','D','DISCIPLINE',2,320,120,'DISCIPLINE','FOCUS','A practical system for building and maintaining better habits.',false,true),
('psychology-of-money','The Psychology of Money','Morgan Housel','D','WEALTH',2,256,125,'WEALTH','INTELLIGENCE','Short stories and lessons about behavior, risk and money decisions.',true,true),
('compound-effect','The Compound Effect','Darren Hardy','D','DISCIPLINE',2,208,110,'DISCIPLINE','WEALTH','How small repeated choices accumulate into larger outcomes.',false,false),
('monk-sold-ferrari','The Monk Who Sold His Ferrari','Robin Sharma','D','GROWTH',2,224,110,'DISCIPLINE','INTELLIGENCE','A story-driven personal-development book about priorities and self-command.',true,false),
('little-prince','The Little Prince','Antoine de Saint-Exupéry','D','STORY',2,112,100,'CREATIVITY','CHARISMA','A compact story that rewards reflection while keeping reading enjoyable.',true,false),
('deep-work','Deep Work','Cal Newport','C','FOCUS',3,304,170,'FOCUS','DISCIPLINE','A deeper framework for concentration and high-value focused work.',false,true),
('mans-search-meaning','Man''s Search for Meaning','Viktor E. Frankl','C','PSYCHOLOGY',3,184,165,'INTELLIGENCE','DISCIPLINE','A demanding reflection on meaning, suffering and human choice.',false,true),
('obstacle-is-way','The Obstacle Is the Way','Ryan Holiday','C','DISCIPLINE',3,224,155,'DISCIPLINE','INTELLIGENCE','A practical introduction to using difficulty as material for action.',false,false),
('teach-you-rich','I Will Teach You to Be Rich','Ramit Sethi','C','WEALTH',3,352,175,'WEALTH','DISCIPLINE','A hands-on personal-finance system covering spending, saving and investing.',false,false),
('why-we-sleep','Why We Sleep','Matthew Walker','C','HEALTH',3,368,175,'RECOVERY','INTELLIGENCE','A broad exploration of sleep and why recovery matters.',false,false),
('outlive','Outlive','Peter Attia with Bill Gifford','B','HEALTH',4,496,230,'RECOVERY','ENDURANCE','A long-form health and longevity book that demands slower, more deliberate reading.',false,true),
('simple-path-wealth','The Simple Path to Wealth','JL Collins','B','WEALTH',4,286,215,'WEALTH','DISCIPLINE','A focused long-term framework for saving, investing and financial independence.',false,false),
('essentialism','Essentialism','Greg McKeown','B','FOCUS',4,288,205,'FOCUS','DISCIPLINE','A more demanding framework for deciding what deserves your limited attention.',false,false),
('thinking-in-bets','Thinking in Bets','Annie Duke','B','DECISION',4,288,215,'INTELLIGENCE','FOCUS','Decision-making under uncertainty, with emphasis on separating process from outcome.',false,false),
('cant-hurt-me','Can''t Hurt Me','David Goggins','B','DISCIPLINE',4,364,220,'DISCIPLINE','ENDURANCE','A demanding memoir centered on discomfort, self-command and endurance.',true,false),
('intelligent-investor','The Intelligent Investor','Benjamin Graham','A','WEALTH',5,640,320,'WEALTH','INTELLIGENCE','A dense investing classic that rewards note-taking and patient rereading.',false,true),
('thinking-fast-slow','Thinking, Fast and Slow','Daniel Kahneman','A','PSYCHOLOGY',5,512,315,'INTELLIGENCE','FOCUS','A long and concept-heavy examination of judgment, bias and decision systems.',false,true),
('antifragile','Antifragile','Nassim Nicholas Taleb','A','DECISION',5,544,330,'INTELLIGENCE','DISCIPLINE','A challenging argument about systems that can benefit from volatility and stress.',false,false),
('meditations','Meditations','Marcus Aurelius','A','PHILOSOPHY',5,304,290,'DISCIPLINE','INTELLIGENCE','Short entries that become difficult through reflection rather than sheer length.',false,true),
('influence','Influence','Robert B. Cialdini','A','PSYCHOLOGY',5,592,310,'CHARISMA','INTELLIGENCE','A substantial study of persuasion principles and the psychology behind them.',false,false),
('security-analysis','Security Analysis','Benjamin Graham and David Dodd','S','WEALTH',6,736,450,'WEALTH','INTELLIGENCE','A highly technical investing text intended for slow study rather than casual reading.',false,true),
('behave','Behave','Robert M. Sapolsky','S','HEALTH',6,800,440,'INTELLIGENCE','RECOVERY','A large interdisciplinary exploration of human behavior and biology.',false,true),
('brothers-karamazov','The Brothers Karamazov','Fyodor Dostoevsky','S','STORY',6,824,420,'INTELLIGENCE','CREATIVITY','A long literary challenge that builds reading endurance and rewards deep reflection.',true,true),
('poor-charlies-almanack','Poor Charlie''s Almanack','Charles T. Munger','S','WEALTH',6,548,430,'INTELLIGENCE','WEALTH','A wide-ranging collection on judgment, mental models and decision-making.',false,true),
('beginning-infinity','The Beginning of Infinity','David Deutsch','S','PHILOSOPHY',6,496,430,'INTELLIGENCE','FOCUS','A concept-dense exploration of explanation, knowledge and progress.',false,false)
on conflict (slug) do update set
 title=excluded.title,
 author=excluded.author,
 rank=excluded.rank,
 category=excluded.category,
 difficulty=excluded.difficulty,
 page_count=excluded.page_count,
 xp_reward=excluded.xp_reward,
 primary_attribute=excluded.primary_attribute,
 secondary_attribute=excluded.secondary_attribute,
 summary=excluded.summary,
 is_story=excluded.is_story,
 featured=excluded.featured,
 active=true,
 updated_at=now();
