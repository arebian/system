insert into public.item_catalog (slug,name,item_type,rarity,power,required_level,bonus_text,icon,metadata) values
('runners-edge','RUNNER''S EDGE','GEAR','RARE',18,5,'+5 SPEED','◈','{"affinity":"SPEED","secondary":"ENDURANCE"}'::jsonb),
('iron-key','IRON KEY','KEY','EPIC',35,10,'+8 STRENGTH','◆','{"affinity":"STRENGTH","unlock":"THE FORGE"}'::jsonb),
('focus-crystal','FOCUS CRYSTAL','ARTIFACT','LEGENDARY',60,20,'+10 FOCUS','✦','{"affinity":"FOCUS","secondary":"DISCIPLINE"}'::jsonb),
('vanguard-emblem','VANGUARD EMBLEM','EMBLEM','EPIC',85,30,'+10 DISCIPLINE','⚜','{"affinity":"DISCIPLINE"}'::jsonb),
('ascendant-core','ASCENDANT CORE','CORE','MYTHIC',140,50,'+15 ALL ROUND','⬢','{"affinity":"ALL"}'::jsonb)
on conflict (slug) do update set
name=excluded.name,item_type=excluded.item_type,rarity=excluded.rarity,power=excluded.power,required_level=excluded.required_level,bonus_text=excluded.bonus_text,icon=excluded.icon,metadata=excluded.metadata,active=true;
