-- 2.9.1 — make every active Mage Archive catalog slot an in-app edition.
--
-- This intentionally updates catalog rows in place. user_mage_books keeps the
-- same book_id, so existing reading progress remains attached to the player's
-- current mission while its commercial/outside-link metadata is replaced by a
-- curated public-domain edition. The client accepts only these reader keys.

begin;

with curated (
  slug,
  title,
  author,
  category,
  estimated_pages,
  primary_attribute,
  secondary_attribute,
  description,
  why_it_matters,
  featured,
  gutenberg_ebook
) as (
  values
    ('make-your-bed', 'Self Help; with Illustrations of Conduct and Perseverance', 'Samuel Smiles', 'DISCIPLINE', 340, 'DISCIPLINE', 'FOCUS', 'A foundational guide to self-reliance, steady effort and personal conduct.', 'Builds a serious base for daily execution without relying on motivation alone.', true, 935),
    ('the-alchemist', 'How to Live on 24 Hours a Day', 'Arnold Bennett', 'FOCUS', 96, 'FOCUS', 'DISCIPLINE', 'A concise guide to using daily time deliberately for learning, reflection and growth.', 'Turns the ordinary day into a real resource instead of an excuse.', true, 2274),
    ('the-art-of-war', 'The Art of War', 'Sun Tzu, translated by Lionel Giles', 'STRATEGY', 111, 'INTELLIGENCE', 'FOCUS', 'A concise classic on strategy, preparation, self-command and choosing battles with care.', 'Builds disciplined thinking about preparation, timing, leverage and calm decisions.', true, 132),
    ('richest-man-in-babylon', 'The Power of Concentration', 'William Walker Atkinson', 'FOCUS', 180, 'FOCUS', 'DISCIPLINE', 'A practical early guide to attention, willpower and sustained mental effort.', 'Gives the Mage a direct training text for controlling attention.', true, 1570),
    ('tuesdays-with-morrie', 'Talks on Talking', 'Grenville Kleiser', 'CHARISMA', 180, 'CHARISMA', 'FOCUS', 'A practical guide to clearer conversation, natural presence and effective expression.', 'Builds social confidence through deliberate communication practice.', false, 17476),
    ('who-moved-my-cheese', 'The Secret Garden', 'Frances Hodgson Burnett', 'RECOVERY', 256, 'RECOVERY', 'CREATIVITY', 'A transformation story about attention, nature, restoration and renewed strength.', 'An accessible first book that connects care, environment and recovery.', false, 17396),
    ('atomic-habits', 'The Autobiography of Benjamin Franklin', 'Benjamin Franklin', 'DISCIPLINE', 220, 'DISCIPLINE', 'WEALTH', 'Franklin''s account of learning, work, enterprise and his famous virtue practice.', 'Connects personal standards with long-term practical achievement.', true, 148),
    ('ikigai', 'The Aesop for Children', 'Aesop, illustrated by Milo Winter', 'DISCIPLINE', 150, 'DISCIPLINE', 'INTELLIGENCE', 'Short fables that make consequences, judgment and character easy to examine.', 'Trains reflection through compact stories with clear decisions and tradeoffs.', false, 19994),
    ('compound-effect', 'The Jungle Book', 'Rudyard Kipling', 'STORY', 276, 'DISCIPLINE', 'CREATIVITY', 'Stories about belonging, rules, self-command and freedom inside a demanding world.', 'Uses memorable narrative to examine responsibility and identity.', false, 236),
    ('psychology-of-money', 'The Call of the Wild', 'Jack London', 'ENDURANCE', 180, 'ENDURANCE', 'RECOVERY', 'A survival story about adaptation, resilience and responding under pressure.', 'Builds reading momentum while keeping the lesson grounded in endurance.', true, 215),
    ('the-little-prince', 'Walden, and On The Duty Of Civil Disobedience', 'Henry David Thoreau', 'PHILOSOPHY', 224, 'CREATIVITY', 'CHARISMA', 'A reflection on deliberate living, self-reliance and personal conscience.', 'Builds independent thought and a calmer relationship with comfort and distraction.', false, 205),
    ('deep-work', 'The Art of Logical Thinking; Or, The Laws of Reasoning', 'William Walker Atkinson', 'INTELLIGENCE', 220, 'INTELLIGENCE', 'FOCUS', 'A practical guide to concepts, judgment, induction and deduction.', 'Builds the mental discipline behind careful analysis and decisions.', true, 41838),
    ('i-will-teach-you-to-be-rich', 'How to Live: Rules for Healthful Living Based on Modern Science', 'Irving Fisher and Eugene Lyman Fisk', 'HEALTH', 320, 'RECOVERY', 'INTELLIGENCE', 'A historic practical guide to hygiene, activity, nutrition and recovery habits.', 'Connects the Fuel and Recovery systems to a more deliberate health baseline.', true, 19598),
    ('mans-search-for-meaning', 'Narrative of the Life of Frederick Douglass, an American Slave', 'Frederick Douglass', 'RESILIENCE', 160, 'DISCIPLINE', 'INTELLIGENCE', 'A firsthand account of literacy, courage, freedom and self-determination.', 'A serious short work about agency, perseverance and the value of learning.', true, 23),
    ('obstacle-is-the-way', 'The Strange Case of Dr. Jekyll and Mr. Hyde', 'Robert Louis Stevenson', 'PSYCHOLOGY', 128, 'INTELLIGENCE', 'DISCIPLINE', 'A compact study in character, impulse, consequences and the divided self.', 'Supports honest reflection on identity and the habits that shape it.', false, 43),
    ('why-we-sleep', 'The Republic', 'Plato, translated by Benjamin Jowett', 'PHILOSOPHY', 416, 'INTELLIGENCE', 'DISCIPLINE', 'A foundational dialogue on justice, character, leadership and how a person should live.', 'Strengthens clear reasoning about values, responsibility and the systems that shape conduct.', false, 1497),
    ('essentialism', 'The Elements of Style', 'William Strunk, Jr.', 'CREATIVITY', 96, 'CREATIVITY', 'FOCUS', 'A compact manual for writing with clarity, precision and economy.', 'Turns thought into cleaner language, notes and communication.', false, 37134),
    ('grit', 'White Fang', 'Jack London', 'ENDURANCE', 288, 'ENDURANCE', 'DISCIPLINE', 'An endurance story about survival, adversity, adaptation and transformation.', 'Builds sustained reading stamina through a demanding but accessible narrative.', false, 910),
    ('outlive', 'On the Origin of Species', 'Charles Darwin', 'SCIENCE', 520, 'INTELLIGENCE', 'FOCUS', 'A foundational scientific argument built from evidence, observation and reasoning.', 'Develops patience with long-form evidence and serious scientific thought.', true, 1228),
    ('simple-path-to-wealth', 'The Federalist Papers', 'Alexander Hamilton, John Jay and James Madison', 'STRATEGY', 560, 'INTELLIGENCE', 'DISCIPLINE', 'A dense collection of arguments about systems, incentives, power and governance.', 'Builds structured reasoning about rules, institutions and long-term consequences.', true, 1404),
    ('thinking-in-bets', 'The Hound of the Baskervilles', 'Arthur Conan Doyle', 'PSYCHOLOGY', 256, 'INTELLIGENCE', 'FOCUS', 'A focused mystery that rewards evidence, uncertainty and careful observation.', 'Exercises inference without confusing a fast assumption for proof.', false, 2852),
    ('intelligent-investor', 'The Theory of the Leisure Class', 'Thorstein Veblen', 'WEALTH', 400, 'WEALTH', 'INTELLIGENCE', 'A rigorous examination of status, consumption and the social meaning of wealth.', 'Builds a more critical relationship with money, incentives and display.', true, 833),
    ('laws-of-human-nature', 'The Picture of Dorian Gray', 'Oscar Wilde', 'PSYCHOLOGY', 288, 'CHARISMA', 'INTELLIGENCE', 'A philosophical novel about influence, vanity, identity and moral consequence.', 'Encourages clearer thought about image, character and personal accountability.', false, 174),
    ('antifragile', 'The Prince', 'Niccolò Machiavelli', 'STRATEGY', 160, 'INTELLIGENCE', 'DISCIPLINE', 'A concise classic on power, judgment, leadership and political strategy.', 'Creates a serious base for thinking about incentives and strategic decisions.', false, 1232),
    ('meditations', 'Meditations', 'Marcus Aurelius', 'PHILOSOPHY', 256, 'DISCIPLINE', 'INTELLIGENCE', 'Personal Stoic reflections on judgment, character, duty and self-command.', 'The challenge is slow reflection and application, not only page count.', true, 2680),
    ('thinking-fast-and-slow', 'The Time Machine', 'H. G. Wells', 'PHILOSOPHY', 128, 'CREATIVITY', 'INTELLIGENCE', 'A compact thought experiment about progress, systems, class and long consequences.', 'Strengthens imagination while demanding careful interpretation of a changing world.', true, 35),
    ('security-analysis', 'An Inquiry into the Nature and Causes of the Wealth of Nations', 'Adam Smith', 'ECONOMICS', 1000, 'WEALTH', 'INTELLIGENCE', 'A foundational study of labor, trade, markets and the forces that shape collective wealth.', 'Provides an enduring base for higher-rank economic thinking rather than short-term hype.', true, 3300),
    ('behave', 'Moby Dick; Or, The Whale', 'Herman Melville', 'LITERATURE', 720, 'FOCUS', 'CREATIVITY', 'An epic novel about obsession, leadership, fate and the cost of a single-minded pursuit.', 'Demands long-form attention and gives the reader material for serious reflection.', true, 2701),
    ('poor-charlies-almanack', 'The Count of Monte Cristo', 'Alexandre Dumas and Auguste Maquet', 'LITERATURE', 1240, 'DISCIPLINE', 'INTELLIGENCE', 'A major work of planning, patience, consequence, justice and mercy.', 'An endurance mission that rewards steady progress across a genuinely long book.', true, 1184),
    ('beginning-of-infinity', 'The Odyssey', 'Homer, translated by Samuel Butler', 'PHILOSOPHY', 416, 'ENDURANCE', 'CREATIVITY', 'An enduring epic of perseverance, return, judgment, loyalty and leadership.', 'Builds long-range reading stamina through a foundational work of human storytelling.', false, 1727),
    ('brothers-karamazov', 'The Brothers Karamazov', 'Fyodor Dostoyevsky, translated by Constance Garnett', 'LITERATURE', 824, 'CREATIVITY', 'INTELLIGENCE', 'A long literary novel exploring family, morality, faith, responsibility and freedom.', 'Proves reading endurance through demanding fiction as well as nonfiction.', false, 28054)
)
update public.mage_books as book
set
  title = curated.title,
  author = curated.author,
  category = curated.category,
  estimated_pages = curated.estimated_pages,
  primary_attribute = curated.primary_attribute,
  secondary_attribute = curated.secondary_attribute,
  description = curated.description,
  why_it_matters = curated.why_it_matters,
  featured = curated.featured,
  legal_read_url = 'https://www.gutenberg.org/ebooks/' || curated.gutenberg_ebook::text,
  legal_read_label = 'PROJECT GUTENBERG • PUBLIC-DOMAIN SOURCE',
  embedded_reader_key = curated.slug,
  updated_at = now()
from curated
where book.slug = curated.slug;

alter table public.mage_books
  drop constraint if exists mage_books_active_in_app_reader;

alter table public.mage_books
  add constraint mage_books_active_in_app_reader
  check (
    not active or
    embedded_reader_key is not null
  );

do $$
begin
  if exists (
    select 1
    from public.mage_books
    where active
      and embedded_reader_key is null
  ) then
    raise exception 'ACTIVE_MAGE_BOOK_MISSING_IN_APP_READER_KEY';
  end if;
end;
$$;

comment on constraint mage_books_active_in_app_reader on public.mage_books is
  'Every active Grand Archive catalog entry must resolve to THE SYSTEM in-app public-domain reader.';

commit;
