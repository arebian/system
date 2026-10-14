-- 2.9.1 follow-up guard: an active Archive entry must resolve to one of the
-- reader keys shipped by THE SYSTEM. A non-empty arbitrary key is not enough:
-- it would let a catalog edit bypass the focused in-app reader.

begin;

alter table public.mage_books
  drop constraint if exists mage_books_active_in_app_reader;

alter table public.mage_books
  add constraint mage_books_active_in_app_reader
  check (
    not active or (
      embedded_reader_key is not null
      and embedded_reader_key in (
        'make-your-bed',
        'the-alchemist',
        'the-art-of-war',
        'richest-man-in-babylon',
        'tuesdays-with-morrie',
        'who-moved-my-cheese',
        'atomic-habits',
        'ikigai',
        'compound-effect',
        'psychology-of-money',
        'the-little-prince',
        'deep-work',
        'i-will-teach-you-to-be-rich',
        'mans-search-for-meaning',
        'obstacle-is-the-way',
        'why-we-sleep',
        'essentialism',
        'grit',
        'outlive',
        'simple-path-to-wealth',
        'thinking-in-bets',
        'intelligent-investor',
        'laws-of-human-nature',
        'antifragile',
        'meditations',
        'thinking-fast-and-slow',
        'security-analysis',
        'behave',
        'poor-charlies-almanack',
        'beginning-of-infinity',
        'brothers-karamazov'
      )
    )
  );

comment on constraint mage_books_active_in_app_reader on public.mage_books is
  'Every active Grand Archive catalog entry must use a reader key shipped by THE SYSTEM 2.9.1 curated public-domain reader.';

commit;
