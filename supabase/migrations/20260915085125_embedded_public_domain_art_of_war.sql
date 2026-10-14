-- 2.8.8 — a first-party, locally embedded public-domain Archive edition.
--
-- This adds an E-rank book rather than rewriting a player-owned catalog
-- record. The PDF itself is bundled with the frontend; the backend only tells
-- the authorized Archive client that it is the trusted embedded edition.

begin;

alter table public.mage_books
  add column if not exists embedded_reader_key text;

alter table public.mage_books
  drop constraint if exists mage_books_embedded_reader_key_format;

alter table public.mage_books
  add constraint mage_books_embedded_reader_key_format
  check (
    embedded_reader_key is null or
    embedded_reader_key ~ '^[a-z0-9-]+$'
  );

insert into public.mage_books (
  slug,
  title,
  author,
  category,
  book_rank,
  difficulty,
  estimated_pages,
  xp_reward,
  primary_attribute,
  secondary_attribute,
  description,
  why_it_matters,
  active,
  featured,
  legal_read_url,
  legal_read_label,
  embedded_reader_key,
  updated_at
)
values (
  'the-art-of-war',
  'The Art of War',
  'Sun Tzu, translated by Lionel Giles',
  'STRATEGY',
  'E',
  2,
  111,
  45,
  'INTELLIGENCE',
  'FOCUS',
  'A concise classic on strategy, preparation, self-command and choosing battles with care.',
  'Builds disciplined thinking about preparation, timing, leverage and calm decision-making under pressure.',
  true,
  true,
  'https://www.gutenberg.org/ebooks/132',
  'VIEW PROJECT GUTENBERG SOURCE',
  'the-art-of-war',
  now()
)
on conflict (slug) do update
set
  title = excluded.title,
  author = excluded.author,
  category = excluded.category,
  book_rank = excluded.book_rank,
  difficulty = excluded.difficulty,
  estimated_pages = excluded.estimated_pages,
  xp_reward = excluded.xp_reward,
  primary_attribute = excluded.primary_attribute,
  secondary_attribute = excluded.secondary_attribute,
  description = excluded.description,
  why_it_matters = excluded.why_it_matters,
  active = excluded.active,
  featured = excluded.featured,
  legal_read_url = excluded.legal_read_url,
  legal_read_label = excluded.legal_read_label,
  embedded_reader_key = excluded.embedded_reader_key,
  updated_at = now();

create or replace function public.system_mage_archive_state()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_class text;
  v_rank text;
  v_books jsonb;
  v_active uuid;
  v_completed int := 0;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select upper(class)
  into v_class
  from public.profiles
  where id = v_user;

  if v_class is distinct from 'MAGE' then
    return jsonb_build_object(
      'locked', true,
      'reason', 'MAGE_CLASS_REQUIRED',
      'knowledge_rank', 'LOCKED',
      'books', '[]'::jsonb
    );
  end if;

  v_rank := public.system_mage_knowledge_rank();

  select assigned.book_id
  into v_active
  from public.user_mage_books as assigned
  where assigned.user_id = v_user
    and assigned.status = 'ACTIVE'
  order by assigned.updated_at desc
  limit 1;

  select count(*)
  into v_completed
  from public.user_mage_books
  where user_id = v_user
    and status = 'COMPLETED';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', book.id,
        'slug', book.slug,
        'title', book.title,
        'author', book.author,
        'category', book.category,
        'rank', book.book_rank,
        'difficulty', book.difficulty,
        'estimated_pages', book.estimated_pages,
        'xp_reward', book.xp_reward,
        'primary_attribute', book.primary_attribute,
        'secondary_attribute', book.secondary_attribute,
        'description', book.description,
        'why_it_matters', book.why_it_matters,
        'featured', book.featured,
        'legal_read_url', book.legal_read_url,
        'legal_read_label', book.legal_read_label,
        'embedded_reader_key', book.embedded_reader_key,
        'unlocked', public.system_mage_rank_order(book.book_rank) <= public.system_mage_rank_order(v_rank),
        'progress', case
          when assigned.id is null then null
          else jsonb_build_object(
            'status', assigned.status,
            'current_page', assigned.current_page,
            'total_minutes', assigned.total_minutes,
            'reflection', assigned.reflection,
            'started_at', assigned.started_at,
            'last_read_at', assigned.last_read_at,
            'completed_at', assigned.completed_at
          )
        end
      )
      order by public.system_mage_rank_order(book.book_rank), book.difficulty, book.title
    ),
    '[]'::jsonb
  )
  into v_books
  from public.mage_books as book
  left join public.user_mage_books as assigned
    on assigned.book_id = book.id
    and assigned.user_id = v_user
  where book.active = true;

  return jsonb_build_object(
    'locked', false,
    'knowledge_rank', v_rank,
    'active_book_id', v_active,
    'completed_count', v_completed,
    'books', v_books,
    'generated_at', now()
  );
end;
$$;

revoke all on function public.system_mage_archive_state() from public, anon;
grant execute on function public.system_mage_archive_state() to authenticated;

commit;
