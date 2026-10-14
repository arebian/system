insert into public.title_catalog (slug,name,category,rarity,class_affinity,minimum_level,icon,description,metadata) values
('first-blood','FIRST BLOOD','ACHIEVEMENT','RARE',null,1,'◆','Awarded for the first completed System objective','{}'),
('scholar','SCHOLAR','LEARNING','RARE',null,1,'✦','Awarded for meaningful learning progress','{}'),
('early-riser','EARLY RISER','DISCIPLINE','RARE',null,1,'☀','Awarded for consistent early-day discipline','{}'),
('void-reaper','VOID REAPER','ASCENSION','MYTHIC','ASSASSIN',101,'♠','Level 101 Assassin evolution','{"identity":"The shadow no longer follows you. It answers to you."}'),
('iron-colossus','IRON COLOSSUS','ASCENSION','MYTHIC','TANK',101,'⬢','Level 101 Tank evolution','{"identity":"Endurance has become authority."}'),
('arcane-sovereign','ARCANE SOVEREIGN','ASCENSION','MYTHIC','MAGE',101,'✧','Level 101 Mage evolution','{"identity":"Knowledge is no longer collected. It is commanded."}'),
('wildbound-hunter','WILDBOUND HUNTER','ASCENSION','MYTHIC','RANGER',101,'⌖','Level 101 Ranger evolution','{"identity":"Distance, terrain and fatigue have become familiar territory."}'),
('sovereign-commander','SOVEREIGN COMMANDER','ASCENSION','MYTHIC','COMMANDER',101,'♛','Level 101 Commander evolution','{"identity":"The System now recognizes command as your natural state."}')
on conflict (slug) do update set
  name=excluded.name,
  category=excluded.category,
  rarity=excluded.rarity,
  class_affinity=excluded.class_affinity,
  minimum_level=excluded.minimum_level,
  icon=excluded.icon,
  description=excluded.description,
  metadata=excluded.metadata,
  active=true;
