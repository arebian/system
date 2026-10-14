-- THE SYSTEM 2.1 — quest date reconciliation + Mage Grand Archive

create or replace function public.system_accept_quest_by_title_v2(
  p_title text,
  p_duration_seconds integer default 86400,
  p_metadata jsonb default '{}'::jsonb,
  p_assigned_for date default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth'
as $$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles;
  v_lib public.quest_library;
  v_uq public.user_quests;
  v_for_date date := coalesce(p_assigned_for, current_date);
  v_duration integer;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  v_duration := least(greatest(coalesce(p_duration_seconds, 86400), 60), 86400);

  select * into v_profile from public.profiles where id = v_user;
  if not found then raise exception 'PROFILE_NOT_READY'; end if;

  select * into v_lib
  from public.quest_library q
  where q.active = true
    and upper(q.title) = upper(trim(p_title))
    and q.quest_type = 'MUST'
    and q.min_level <= coalesce(v_profile.level, 1)
    and (
      q.class_affinity is null
      or cardinality(q.class_affinity) = 0
      or upper(v_profile.class) = any(q.class_affinity)
    )
  limit 1;

  if not found then raise exception 'MUST_QUEST_NOT_AVAILABLE'; end if;

  select * into v_uq
  from public.user_quests
  where user_id = v_user
    and quest_id = v_lib.id
    and assigned_for = v_for_date
  order by created_at desc
  limit 1
  for update;

  if found and v_uq.status = 'COMPLETED' then
    return jsonb_build_object('duplicate', true, 'quest', to_jsonb(v_uq), 'server_now', now());
  end if;

  if found and v_uq.status = 'FAILED' then
    raise exception 'QUEST_ALREADY_FAILED';
  end if;

  if not found then
    insert into public.user_quests(
      user_id, quest_id, assigned_for, quest_type, title_snapshot,
      objective_snapshot, category, status, source, accepted_at, expires_at,
      xp_reward, xp_penalty, attribute_reward, attribute_delta,
      consequence, metadata
    ) values (
      v_user, v_lib.id, v_for_date, v_lib.quest_type, v_lib.title,
      v_lib.objective, v_lib.category, 'ACCEPTED', 'PLATFORM_V2', now(),
      now() + make_interval(secs => v_duration),
      v_lib.xp_reward, v_lib.failure_xp_penalty, v_lib.attribute_reward,
      v_lib.attribute_delta,
      case when coalesce(v_lib.failure_xp_penalty, 0) > 0
        then '-' || v_lib.failure_xp_penalty || ' XP'
        else null end,
      jsonb_build_object(
        'library_code', v_lib.code,
        'adapter', 'TITLE_V2',
        'accepted_by', 'SYSTEM_API',
        'assigned_for', v_for_date
      ) || coalesce(p_metadata, '{}'::jsonb)
    )
    returning * into v_uq;
  else
    update public.user_quests
    set status = 'ACCEPTED',
        accepted_at = coalesce(accepted_at, now()),
        expires_at = case
          when status = 'ASSIGNED' or accepted_at is null or expires_at is null
            then now() + make_interval(secs => v_duration)
          else expires_at
        end,
        metadata = coalesce(metadata, '{}'::jsonb)
          || coalesce(p_metadata, '{}'::jsonb)
          || jsonb_build_object('assigned_for', v_for_date, 'adapter', 'TITLE_V2'),
        updated_at = now()
    where id = v_uq.id
    returning * into v_uq;
  end if;

  return jsonb_build_object(
    'quest', to_jsonb(v_uq),
    'server_now', now(),
    'assigned_for', v_for_date
  );
end;
$$;

create or replace function public.system_complete_quest_by_title_v2(
  p_title text,
  p_metadata jsonb default '{}'::jsonb,
  p_assigned_for date default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth'
as $$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles;
  v_lib public.quest_library;
  v_uq public.user_quests;
  v_result jsonb;
  v_orchestration jsonb;
  v_for_date date := coalesce(p_assigned_for, current_date);
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_profile from public.profiles where id = v_user;
  if not found then raise exception 'PROFILE_NOT_READY'; end if;

  select * into v_lib
  from public.quest_library q
  where q.active = true
    and upper(q.title) = upper(trim(p_title))
    and q.min_level <= coalesce(v_profile.level, 1)
    and (
      q.class_affinity is null
      or cardinality(q.class_affinity) = 0
      or upper(v_profile.class) = any(q.class_affinity)
    )
  order by
    case when upper(v_profile.class) = any(coalesce(q.class_affinity, array[]::text[])) then 0 else 1 end,
    case q.quest_type when 'MUST' then 0 when 'CLASS' then 1 when 'DAILY' then 2 else 3 end
  limit 1;

  if not found then raise exception 'QUEST_NOT_AVAILABLE'; end if;

  select * into v_uq
  from public.user_quests
  where user_id = v_user
    and quest_id = v_lib.id
    and assigned_for = v_for_date
  order by created_at desc
  limit 1
  for update;

  if found and v_uq.status = 'COMPLETED' then
    return jsonb_build_object(
      'duplicate', true,
      'quest', to_jsonb(v_uq),
      'profile', to_jsonb(v_profile),
      'assigned_for', v_for_date
    );
  end if;

  if found and v_uq.status = 'FAILED' then
    raise exception 'QUEST_ALREADY_FAILED';
  end if;

  if not found then
    insert into public.user_quests(
      user_id, quest_id, assigned_for, quest_type, title_snapshot,
      objective_snapshot, category, status, source, accepted_at, expires_at,
      xp_reward, xp_penalty, attribute_reward, attribute_delta,
      consequence, metadata
    ) values (
      v_user, v_lib.id, v_for_date, v_lib.quest_type, v_lib.title,
      v_lib.objective, v_lib.category,
      case when v_lib.quest_type = 'MUST' then 'ACCEPTED' else 'ASSIGNED' end,
      'PLATFORM_V2',
      case when v_lib.quest_type = 'MUST' then now() else null end,
      now() + interval '24 hours',
      v_lib.xp_reward, v_lib.failure_xp_penalty, v_lib.attribute_reward,
      v_lib.attribute_delta,
      case when coalesce(v_lib.failure_xp_penalty, 0) > 0
        then '-' || v_lib.failure_xp_penalty || ' XP'
        else null end,
      jsonb_build_object(
        'library_code', v_lib.code,
        'adapter', 'TITLE_V2',
        'assigned_for', v_for_date
      ) || coalesce(p_metadata, '{}'::jsonb)
    )
    returning * into v_uq;
  elsif v_lib.quest_type = 'MUST' and v_uq.status = 'ASSIGNED' then
    update public.user_quests
    set status = 'ACCEPTED',
        accepted_at = now(),
        expires_at = now() + interval '24 hours',
        metadata = coalesce(metadata, '{}'::jsonb)
          || coalesce(p_metadata, '{}'::jsonb)
          || jsonb_build_object('assigned_for', v_for_date, 'adapter', 'TITLE_V2'),
        updated_at = now()
    where id = v_uq.id
    returning * into v_uq;
  end if;

  v_result := public.system_complete_quest(
    v_uq.id,
    coalesce(p_metadata, '{}'::jsonb)
      || jsonb_build_object('completion_adapter', 'TITLE_V2', 'assigned_for', v_for_date)
  );

  update public.profiles
  set momentum = coalesce(momentum, 0) + case when v_lib.quest_type = 'MUST' then 2 else 1 end,
      streak = coalesce(streak, 0) + case when v_lib.quest_type = 'MUST' then 0 else 1 end,
      updated_at = now()
  where id = v_user;

  begin
    v_orchestration := public.system_orchestrate_progression();
  exception when others then
    v_orchestration := jsonb_build_object('error', sqlerrm);
  end;

  select * into v_profile from public.profiles where id = v_user;

  return v_result || jsonb_build_object(
    'profile', to_jsonb(v_profile),
    'library_code', v_lib.code,
    'quest_type', v_lib.quest_type,
    'assigned_for', v_for_date,
    'orchestration', v_orchestration
  );
end;
$$;

grant execute on function public.system_accept_quest_by_title_v2(text, integer, jsonb, date) to authenticated;
grant execute on function public.system_complete_quest_by_title_v2(text, jsonb, date) to authenticated;

create table if not exists public.mage_books (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  author text not null,
  category text not null,
  book_rank text not null check (book_rank in ('E','D','C','B','A','S')),
  difficulty integer not null default 1 check (difficulty between 1 and 6),
  estimated_pages integer,
  xp_reward integer not null default 100 check (xp_reward >= 0),
  primary_attribute text not null default 'INTELLIGENCE',
  secondary_attribute text,
  description text,
  why_it_matters text,
  active boolean not null default true,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_mage_books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.mage_books(id) on delete cascade,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','PAUSED','COMPLETED')),
  current_page integer not null default 0 check (current_page >= 0),
  total_minutes integer not null default 0 check (total_minutes >= 0),
  reflection text,
  started_at timestamptz not null default now(),
  last_read_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, book_id)
);

create table if not exists public.mage_reading_sessions (
  id bigint generated by default as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.mage_books(id) on delete cascade,
  session_date date not null,
  minutes integer not null check (minutes between 1 and 240),
  page_from integer not null default 0,
  page_to integer not null default 0,
  xp_awarded boolean not null default false,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_mage_books_user on public.user_mage_books(user_id, status);
create index if not exists idx_mage_reading_sessions_user_date on public.mage_reading_sessions(user_id, session_date);

alter table public.mage_books enable row level security;
alter table public.user_mage_books enable row level security;
alter table public.mage_reading_sessions enable row level security;

drop policy if exists mage_books_authenticated_read on public.mage_books;
create policy mage_books_authenticated_read on public.mage_books for select to authenticated using (active = true);
drop policy if exists user_mage_books_own_read on public.user_mage_books;
create policy user_mage_books_own_read on public.user_mage_books for select to authenticated using (auth.uid() = user_id);
drop policy if exists mage_reading_sessions_own_read on public.mage_reading_sessions;
create policy mage_reading_sessions_own_read on public.mage_reading_sessions for select to authenticated using (auth.uid() = user_id);

grant select on public.mage_books to authenticated;
grant select on public.user_mage_books to authenticated;
grant select on public.mage_reading_sessions to authenticated;

create or replace function public.system_mage_rank_order(p_rank text)
returns integer language sql immutable as $$
  select case upper(coalesce(p_rank, 'E')) when 'E' then 1 when 'D' then 2 when 'C' then 3 when 'B' then 4 when 'A' then 5 when 'S' then 6 else 1 end;
$$;

create or replace function public.system_mage_knowledge_rank()
returns text language plpgsql security definer set search_path to 'public','auth' as $$
declare v_user uuid:=auth.uid(); v_class text; v_e int:=0; v_d int:=0; v_c int:=0; v_b int:=0; v_a int:=0; v_total int:=0;
begin
 if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
 select upper(class) into v_class from public.profiles where id=v_user;
 if v_class is distinct from 'MAGE' then return 'LOCKED'; end if;
 select count(*) filter(where mb.book_rank='E'),count(*) filter(where mb.book_rank='D'),count(*) filter(where mb.book_rank='C'),count(*) filter(where mb.book_rank='B'),count(*) filter(where mb.book_rank='A'),count(*)
 into v_e,v_d,v_c,v_b,v_a,v_total
 from public.user_mage_books umb join public.mage_books mb on mb.id=umb.book_id where umb.user_id=v_user and umb.status='COMPLETED';
 if v_a>=2 and v_total>=10 then return 'S'; end if; if v_b>=2 and v_total>=8 then return 'A'; end if; if v_c>=2 and v_total>=6 then return 'B'; end if; if v_d>=2 and v_total>=4 then return 'C'; end if; if v_e>=2 then return 'D'; end if; return 'E';
end $$;

create or replace function public.system_mage_archive_state()
returns jsonb language plpgsql security definer set search_path to 'public','auth' as $$
declare v_user uuid:=auth.uid(); v_class text; v_rank text; v_books jsonb; v_active uuid; v_completed int:=0;
begin
 if v_user is null then raise exception 'AUTH_REQUIRED'; end if; select upper(class) into v_class from public.profiles where id=v_user;
 if v_class is distinct from 'MAGE' then return jsonb_build_object('locked',true,'reason','MAGE_CLASS_REQUIRED','knowledge_rank','LOCKED','books','[]'::jsonb); end if;
 v_rank:=public.system_mage_knowledge_rank();
 select umb.book_id into v_active from public.user_mage_books umb where umb.user_id=v_user and umb.status='ACTIVE' order by umb.updated_at desc limit 1;
 select count(*) into v_completed from public.user_mage_books where user_id=v_user and status='COMPLETED';
 select coalesce(jsonb_agg(jsonb_build_object('id',mb.id,'slug',mb.slug,'title',mb.title,'author',mb.author,'category',mb.category,'rank',mb.book_rank,'difficulty',mb.difficulty,'estimated_pages',mb.estimated_pages,'xp_reward',mb.xp_reward,'primary_attribute',mb.primary_attribute,'secondary_attribute',mb.secondary_attribute,'description',mb.description,'why_it_matters',mb.why_it_matters,'featured',mb.featured,'unlocked',public.system_mage_rank_order(mb.book_rank)<=public.system_mage_rank_order(v_rank),'progress',case when umb.id is null then null else jsonb_build_object('status',umb.status,'current_page',umb.current_page,'total_minutes',umb.total_minutes,'reflection',umb.reflection,'started_at',umb.started_at,'last_read_at',umb.last_read_at,'completed_at',umb.completed_at) end) order by public.system_mage_rank_order(mb.book_rank),mb.difficulty,mb.title),'[]'::jsonb) into v_books from public.mage_books mb left join public.user_mage_books umb on umb.book_id=mb.id and umb.user_id=v_user where mb.active=true;
 return jsonb_build_object('locked',false,'knowledge_rank',v_rank,'active_book_id',v_active,'completed_count',v_completed,'books',v_books,'generated_at',now());
end $$;

create or replace function public.system_start_mage_book(p_book_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public','auth' as $$
declare v_user uuid:=auth.uid(); v_class text; v_rank text; v_book public.mage_books; v_progress public.user_mage_books;
begin
 if v_user is null then raise exception 'AUTH_REQUIRED'; end if; select upper(class) into v_class from public.profiles where id=v_user; if v_class is distinct from 'MAGE' then raise exception 'MAGE_CLASS_REQUIRED'; end if;
 v_rank:=public.system_mage_knowledge_rank(); select * into v_book from public.mage_books where id=p_book_id and active=true; if not found then raise exception 'BOOK_NOT_FOUND'; end if; if public.system_mage_rank_order(v_book.book_rank)>public.system_mage_rank_order(v_rank) then raise exception 'BOOK_RANK_LOCKED'; end if;
 select * into v_progress from public.user_mage_books where user_id=v_user and book_id=p_book_id for update; if found and v_progress.status='COMPLETED' then return jsonb_build_object('duplicate',true,'progress',to_jsonb(v_progress),'knowledge_rank',v_rank); end if;
 update public.user_mage_books set status='PAUSED',updated_at=now() where user_id=v_user and status='ACTIVE' and book_id<>p_book_id;
 insert into public.user_mage_books(user_id,book_id,status,started_at,updated_at) values(v_user,p_book_id,'ACTIVE',now(),now()) on conflict(user_id,book_id) do update set status='ACTIVE',updated_at=now() returning * into v_progress;
 insert into public.journey_events(user_id,event_type,title,detail,source,source_id,xp_delta,metadata) values(v_user,'BOOK_STARTED',v_book.title,'Mage Archive reading mission activated.','MAGE_ARCHIVE',v_book.id::text,0,jsonb_build_object('rank',v_book.book_rank,'author',v_book.author));
 return jsonb_build_object('progress',to_jsonb(v_progress),'book',to_jsonb(v_book),'knowledge_rank',v_rank);
end $$;

create or replace function public.system_log_mage_reading(p_book_id uuid,p_current_page integer,p_minutes integer,p_note text default null,p_session_date date default null)
returns jsonb language plpgsql security definer set search_path to 'public','auth' as $$
declare v_user uuid:=auth.uid(); v_class text; v_book public.mage_books; v_progress public.user_mage_books; v_date date:=coalesce(p_session_date,current_date); v_old_page int; v_new_page int; v_award boolean:=false; v_profile public.profiles;
begin
 if v_user is null then raise exception 'AUTH_REQUIRED'; end if; select upper(class) into v_class from public.profiles where id=v_user; if v_class is distinct from 'MAGE' then raise exception 'MAGE_CLASS_REQUIRED'; end if; if coalesce(p_minutes,0)<1 or p_minutes>240 then raise exception 'INVALID_READING_MINUTES'; end if;
 select * into v_book from public.mage_books where id=p_book_id and active=true; if not found then raise exception 'BOOK_NOT_FOUND'; end if; select * into v_progress from public.user_mage_books where user_id=v_user and book_id=p_book_id for update; if not found then raise exception 'BOOK_NOT_STARTED'; end if; if v_progress.status='COMPLETED' then raise exception 'BOOK_ALREADY_COMPLETED'; end if;
 v_old_page:=coalesce(v_progress.current_page,0); v_new_page:=greatest(v_old_page,greatest(0,coalesce(p_current_page,v_old_page))); if v_book.estimated_pages is not null then v_new_page:=least(v_new_page,v_book.estimated_pages); end if;
 if p_minutes>=5 and not exists(select 1 from public.mage_reading_sessions where user_id=v_user and session_date=v_date and xp_awarded=true) then v_award:=true; end if;
 insert into public.mage_reading_sessions(user_id,book_id,session_date,minutes,page_from,page_to,xp_awarded,note) values(v_user,p_book_id,v_date,p_minutes,v_old_page,v_new_page,v_award,nullif(trim(coalesce(p_note,'')),''));
 update public.user_mage_books set status='ACTIVE',current_page=v_new_page,total_minutes=total_minutes+p_minutes,last_read_at=now(),updated_at=now() where id=v_progress.id returning * into v_progress;
 if v_award then select * into v_profile from public.system_award_xp(10,'MAGE_ARCHIVE','DAILY READING',jsonb_build_object('book_id',p_book_id,'session_date',v_date)); else select * into v_profile from public.profiles where id=v_user; end if;
 return jsonb_build_object('progress',to_jsonb(v_progress),'daily_xp',case when v_award then 10 else 0 end,'profile',to_jsonb(v_profile),'knowledge_rank',public.system_mage_knowledge_rank());
end $$;

create or replace function public.system_complete_mage_book(p_book_id uuid,p_reflection text)
returns jsonb language plpgsql security definer set search_path to 'public','auth' as $$
declare v_user uuid:=auth.uid(); v_class text; v_book public.mage_books; v_progress public.user_mage_books; v_profile public.profiles; v_required_page int; v_rank text;
begin
 if v_user is null then raise exception 'AUTH_REQUIRED'; end if; select upper(class) into v_class from public.profiles where id=v_user; if v_class is distinct from 'MAGE' then raise exception 'MAGE_CLASS_REQUIRED'; end if; if length(trim(coalesce(p_reflection,'')))<20 then raise exception 'REFLECTION_TOO_SHORT'; end if;
 select * into v_book from public.mage_books where id=p_book_id and active=true; if not found then raise exception 'BOOK_NOT_FOUND'; end if; select * into v_progress from public.user_mage_books where user_id=v_user and book_id=p_book_id for update; if not found then raise exception 'BOOK_NOT_STARTED'; end if; if v_progress.status='COMPLETED' then return jsonb_build_object('duplicate',true,'progress',to_jsonb(v_progress),'knowledge_rank',public.system_mage_knowledge_rank()); end if;
 v_required_page:=case when v_book.estimated_pages is null then 1 else greatest(1,floor(v_book.estimated_pages*0.85)::integer) end; if v_progress.current_page<v_required_page then raise exception 'BOOK_PROGRESS_INCOMPLETE'; end if;
 update public.user_mage_books set status='COMPLETED',reflection=trim(p_reflection),completed_at=now(),updated_at=now() where id=v_progress.id returning * into v_progress;
 select * into v_profile from public.system_award_xp(v_book.xp_reward,'MAGE_ARCHIVE','BOOK CLEARED — '||v_book.title,jsonb_build_object('book_id',v_book.id,'book_rank',v_book.book_rank,'author',v_book.author));
 perform public.system_add_attribute(v_book.primary_attribute,2,'MAGE_ARCHIVE',v_book.title,jsonb_build_object('book_id',v_book.id,'book_rank',v_book.book_rank)); if v_book.secondary_attribute is not null and trim(v_book.secondary_attribute)<>'' then perform public.system_add_attribute(v_book.secondary_attribute,1,'MAGE_ARCHIVE',v_book.title,jsonb_build_object('book_id',v_book.id,'book_rank',v_book.book_rank)); end if;
 insert into public.journey_events(user_id,event_type,title,detail,source,source_id,xp_delta,metadata) values(v_user,'BOOK_COMPLETE',v_book.title,trim(p_reflection),'MAGE_ARCHIVE',v_book.id::text,v_book.xp_reward,jsonb_build_object('rank',v_book.book_rank,'author',v_book.author,'category',v_book.category));
 v_rank:=public.system_mage_knowledge_rank(); begin perform public.system_orchestrate_progression(); exception when others then null; end; select * into v_profile from public.profiles where id=v_user;
 return jsonb_build_object('progress',to_jsonb(v_progress),'book',to_jsonb(v_book),'profile',to_jsonb(v_profile),'knowledge_rank',v_rank,'xp_awarded',v_book.xp_reward);
end $$;

grant execute on function public.system_mage_knowledge_rank() to authenticated;
grant execute on function public.system_mage_archive_state() to authenticated;
grant execute on function public.system_start_mage_book(uuid) to authenticated;
grant execute on function public.system_log_mage_reading(uuid,integer,integer,text,date) to authenticated;
grant execute on function public.system_complete_mage_book(uuid,text) to authenticated;

insert into public.mage_books(slug,title,author,category,book_rank,difficulty,estimated_pages,xp_reward,primary_attribute,secondary_attribute,description,why_it_matters,featured) values
('the-alchemist','The Alchemist','Paulo Coelho','STORY','E',1,208,90,'CREATIVITY','INTELLIGENCE','A short, story-driven journey about purpose, choices and persistence.','Accessible fiction makes the first reading rank enjoyable instead of academic.',true),
('who-moved-my-cheese','Who Moved My Cheese?','Spencer Johnson','DISCIPLINE','E',1,96,80,'DISCIPLINE','FOCUS','A very short parable about adapting when circumstances change.','Fast to finish and useful for establishing the identity of someone who completes books.',false),
('make-your-bed','Make Your Bed','William H. McRaven','DISCIPLINE','E',1,144,90,'DISCIPLINE','FOCUS','Short lessons on responsibility, resilience and small disciplined actions.','Simple chapters connect reading directly to everyday execution.',true),
('richest-man-in-babylon','The Richest Man in Babylon','George S. Clason','WEALTH','E',2,194,100,'WEALTH','INTELLIGENCE','Financial principles taught through short parables set in ancient Babylon.','Introduces saving and money behavior through stories rather than technical finance.',true),
('tuesdays-with-morrie','Tuesdays with Morrie','Mitch Albom','STORY','E',2,224,100,'CHARISMA','INTELLIGENCE','A reflective story about relationships, work, mortality and what matters.','Builds emotional reading stamina without becoming conceptually dense.',false),
('atomic-habits','Atomic Habits','James Clear','DISCIPLINE','D',2,320,150,'DISCIPLINE','FOCUS','A practical framework for building good habits and reducing bad ones.','Turns the new reading habit into a system that can improve the rest of the player.',true),
('psychology-of-money','The Psychology of Money','Morgan Housel','WEALTH','D',2,256,150,'WEALTH','INTELLIGENCE','Short stories about behavior, risk, patience and decision-making with money.','Finance becomes understandable through human behavior rather than formulas.',true),
('compound-effect','The Compound Effect','Darren Hardy','DISCIPLINE','D',2,176,130,'DISCIPLINE','WEALTH','A straightforward argument for consistent small actions compounding over time.','Reinforces consistency and long-term thinking.',false),
('ikigai','Ikigai','Héctor García and Francesc Miralles','HEALTH','D',2,208,130,'RECOVERY','INTELLIGENCE','A light exploration of purpose, routines, community and longevity.','Adds health and life-balance reading without a highly technical entry barrier.',false),
('the-little-prince','The Little Prince','Antoine de Saint-Exupéry','STORY','D',2,112,120,'CREATIVITY','CHARISMA','A short philosophical story about adulthood, relationships and meaning.','Keeps fiction inside the progression tree while rewarding reflection.',false),
('deep-work','Deep Work','Cal Newport','FOCUS','C',3,304,200,'FOCUS','DISCIPLINE','A case for sustained concentration and strategies for protecting focused work.','The reader must move from consuming ideas to changing how attention is used.',true),
('i-will-teach-you-to-be-rich','I Will Teach You to Be Rich','Ramit Sethi','WEALTH','C',3,352,210,'WEALTH','DISCIPLINE','A practical personal-finance system covering spending, saving and investing behavior.','Requires applying a structured money system rather than only learning concepts.',true),
('mans-search-for-meaning','Man''s Search for Meaning','Viktor E. Frankl','PSYCHOLOGY','C',3,184,200,'INTELLIGENCE','DISCIPLINE','A memoir and psychological reflection on meaning, suffering and responsibility.','Short in length but deeper in emotional and conceptual weight.',true),
('obstacle-is-the-way','The Obstacle Is the Way','Ryan Holiday','DISCIPLINE','C',3,224,190,'DISCIPLINE','INTELLIGENCE','Stoic-inspired lessons on perception, action and persistence through difficulty.','Encourages applying a mental framework to real setbacks.',false),
('why-we-sleep','Why We Sleep','Matthew Walker','HEALTH','C',3,368,200,'RECOVERY','INTELLIGENCE','A broad popular-science discussion of sleep and its role in health and performance.','Introduces longer-form health reading and evidence-based reflection.',false),
('outlive','Outlive','Peter Attia with Bill Gifford','HEALTH','B',4,496,280,'RECOVERY','ENDURANCE','A long-form framework for thinking about longevity, exercise and preventive health.','Longer and more technical; the reader must synthesize several health domains.',true),
('simple-path-to-wealth','The Simple Path to Wealth','JL Collins','WEALTH','B',4,286,250,'WEALTH','DISCIPLINE','A long-term approach to saving, investing and financial independence.','Moves wealth reading toward real strategy and patience.',true),
('essentialism','Essentialism','Greg McKeown','FOCUS','B',4,288,240,'FOCUS','DISCIPLINE','A framework for deliberately choosing what matters and eliminating the nonessential.','Demands prioritization and behavioral change rather than passive agreement.',false),
('thinking-in-bets','Thinking in Bets','Annie Duke','PSYCHOLOGY','B',4,288,250,'INTELLIGENCE','FOCUS','Decision-making under uncertainty using probabilistic thinking and feedback.','Builds more advanced judgment and self-correction.',false),
('grit','Grit','Angela Duckworth','PSYCHOLOGY','B',4,352,240,'DISCIPLINE','INTELLIGENCE','Research and stories about sustained effort, interest and long-term goals.','Requires connecting research claims with the reader''s own persistence systems.',false),
('intelligent-investor','The Intelligent Investor','Benjamin Graham','WEALTH','A',5,640,380,'WEALTH','INTELLIGENCE','A classic, detailed approach to value investing, risk and investor temperament.','Dense finance that rewards slow reading, notes and repeated interpretation.',true),
('thinking-fast-and-slow','Thinking, Fast and Slow','Daniel Kahneman','PSYCHOLOGY','A',5,512,360,'INTELLIGENCE','FOCUS','A long exploration of intuitive and deliberate thinking, judgment and bias.','Conceptually dense and best read with notes and examples.',true),
('antifragile','Antifragile','Nassim Nicholas Taleb','PSYCHOLOGY','A',5,544,380,'INTELLIGENCE','DISCIPLINE','A wide-ranging argument about systems that can benefit from volatility and stress.','Nonlinear ideas and argumentative style require patient interpretation.',false),
('meditations','Meditations','Marcus Aurelius','PHILOSOPHY','A',5,304,330,'DISCIPLINE','INTELLIGENCE','Personal Stoic reflections on judgment, character, duty and self-command.','The challenge is not page count but slow reflection and application.',true),
('laws-of-human-nature','The Laws of Human Nature','Robert Greene','PSYCHOLOGY','A',5,624,370,'CHARISMA','INTELLIGENCE','A long collection of historical examples and interpretations of human behavior.','Length and density require sustained attention and critical reading.',false),
('poor-charlies-almanack','Poor Charlie''s Almanack','Charles T. Munger, edited by Peter D. Kaufman','WEALTH','S',6,548,520,'INTELLIGENCE','WEALTH','A collection of speeches and mental models spanning investing, psychology and decision-making.','Cross-disciplinary thinking rewards rereading, synthesis and application.',true),
('security-analysis','Security Analysis','Benjamin Graham and David Dodd','WEALTH','S',6,736,650,'WEALTH','INTELLIGENCE','A highly detailed foundational text on analyzing securities and investment value.','Technical density makes it a long-term study mission rather than casual reading.',true),
('behave','Behave','Robert M. Sapolsky','HEALTH','S',6,800,620,'INTELLIGENCE','CHARISMA','A large synthesis of biology, neuroscience, psychology and behavior.','Breadth and technical depth demand sustained study and synthesis.',true),
('brothers-karamazov','The Brothers Karamazov','Fyodor Dostoevsky','STORY','S',6,824,580,'CREATIVITY','INTELLIGENCE','A long literary novel exploring family, morality, faith, responsibility and freedom.','Proves reading endurance through demanding fiction as well as nonfiction.',false),
('beginning-of-infinity','The Beginning of Infinity','David Deutsch','PHILOSOPHY','S',6,496,560,'INTELLIGENCE','CREATIVITY','A dense argument about explanations, knowledge, progress and the reach of reason.','Requires abstract thinking and active synthesis across multiple domains.',false)
on conflict(slug) do update set title=excluded.title,author=excluded.author,category=excluded.category,book_rank=excluded.book_rank,difficulty=excluded.difficulty,estimated_pages=excluded.estimated_pages,xp_reward=excluded.xp_reward,primary_attribute=excluded.primary_attribute,secondary_attribute=excluded.secondary_attribute,description=excluded.description,why_it_matters=excluded.why_it_matters,active=true,featured=excluded.featured,updated_at=now();
