-- 2.8.7 — curated, lawful reader links for selected public-domain Archive titles.
--
-- The app still uses the existing provider search for all other books. These
-- links prevent a player from being sent to a region-dependent preview for the
-- few catalog entries intentionally chosen to have a verified public reader.

begin;

alter table public.mage_books
  add column if not exists legal_read_url text,
  add column if not exists legal_read_label text;

alter table public.mage_books
  drop constraint if exists mage_books_legal_read_url_https;

alter table public.mage_books
  add constraint mage_books_legal_read_url_https
  check (
    legal_read_url is null or
    legal_read_url ~ '^https://'
  );

-- Do not rewrite a title if any player has already received it. The four
-- substitutions below are only used on untouched catalog slots.
update public.mage_books as book
set
  title = 'Walden, and On The Duty Of Civil Disobedience',
  author = 'Henry David Thoreau',
  category = 'PHILOSOPHY',
  estimated_pages = 224,
  description = 'A practical reflection on deliberate living, self-reliance and personal conscience.',
  why_it_matters = 'Builds independent thought and a calmer relationship with comfort, status and distraction.',
  legal_read_url = 'https://www.gutenberg.org/ebooks/205',
  legal_read_label = 'READ WALDEN ON PROJECT GUTENBERG',
  updated_at = now()
where book.slug = 'the-little-prince'
  and not exists (
    select 1
    from public.user_mage_books as assigned
    where assigned.book_id = book.id
  );

update public.mage_books as book
set
  title = 'The Republic',
  author = 'Plato',
  category = 'PHILOSOPHY',
  estimated_pages = 416,
  description = 'A foundational dialogue on justice, character, leadership and how a person should live.',
  why_it_matters = 'Strengthens clear reasoning about values, responsibility and the systems that shape conduct.',
  legal_read_url = 'https://www.gutenberg.org/ebooks/1497',
  legal_read_label = 'READ THE REPUBLIC ON PROJECT GUTENBERG',
  updated_at = now()
where book.slug = 'why-we-sleep'
  and not exists (
    select 1
    from public.user_mage_books as assigned
    where assigned.book_id = book.id
  );

update public.mage_books as book
set
  title = 'The Prince',
  author = 'Niccolò Machiavelli',
  category = 'STRATEGY',
  estimated_pages = 160,
  description = 'A concise classic on power, judgement, leadership and political strategy.',
  why_it_matters = 'Creates a serious base for thinking about incentives, consequences and strategic decisions.',
  legal_read_url = 'https://www.gutenberg.org/ebooks/1232',
  legal_read_label = 'READ THE PRINCE ON PROJECT GUTENBERG',
  updated_at = now()
where book.slug = 'antifragile'
  and not exists (
    select 1
    from public.user_mage_books as assigned
    where assigned.book_id = book.id
  );

update public.mage_books as book
set
  title = 'An Inquiry into the Nature and Causes of the Wealth of Nations',
  author = 'Adam Smith',
  category = 'ECONOMICS',
  estimated_pages = 1000,
  description = 'A foundational study of labor, trade, markets and the forces that shape collective wealth.',
  why_it_matters = 'Provides an enduring base for higher-rank economic thinking rather than short-term financial hype.',
  legal_read_url = 'https://www.gutenberg.org/ebooks/3300',
  legal_read_label = 'READ WEALTH OF NATIONS ON PROJECT GUTENBERG',
  updated_at = now()
where book.slug = 'security-analysis'
  and not exists (
    select 1
    from public.user_mage_books as assigned
    where assigned.book_id = book.id
  );

-- Existing public-domain books keep their titles and only receive a stable
-- legal reader route. This is safe even when a player has already selected
-- them because it does not alter their progression record.
update public.mage_books
set
  legal_read_url = 'https://www.gutenberg.org/ebooks/2680',
  legal_read_label = 'READ MEDITATIONS ON PROJECT GUTENBERG',
  updated_at = now()
where slug = 'meditations';

update public.mage_books
set
  legal_read_url = 'https://www.gutenberg.org/ebooks/28054',
  legal_read_label = 'READ THE BROTHERS KARAMAZOV ON PROJECT GUTENBERG',
  updated_at = now()
where slug = 'brothers-karamazov';

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

commit;
