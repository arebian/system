insert into public.achievements (slug,name,description,category,rarity,xp_reward,icon,criteria)
values
('first-blood','FIRST BLOOD','Complete your first registered quest.','QUEST','RARE',50,'⚔',jsonb_build_object('type','quest_count','target',1)),
('seven-day-streak','SEVEN DAY STREAK','Maintain a seven-day streak.','DISCIPLINE','EPIC',120,'◈',jsonb_build_object('type','streak','target',7)),
('boss-slayer-c','C-RANK SLAYER','Defeat your first C-rank Boss Quest.','BOSS','RARE',150,'◆',jsonb_build_object('type','boss_rank','rank','C','target',1)),
('boss-slayer-s','S-RANK SLAYER','Defeat an S-rank Boss Quest.','BOSS','MYTHIC',600,'♛',jsonb_build_object('type','boss_rank','rank','S','target',1)),
('skill-master','SKILL MASTER','Master your first tracked skill.','SKILL','EPIC',180,'✦',jsonb_build_object('type','mastered_skills','target',1)),
('ten-skills','TENFOLD MASTERY','Master ten tracked skills.','SKILL','LEGENDARY',500,'✧',jsonb_build_object('type','mastered_skills','target',10)),
('first-5k','FIRST 5K','Record a completed 5 km run.','ENDURANCE','RARE',100,'⌖',jsonb_build_object('type','performance_metric','metric','RUN DISTANCE','target',5,'unit','km')),
('first-10k','FIRST 10K','Record a completed 10 km run.','ENDURANCE','EPIC',220,'⌖',jsonb_build_object('type','performance_metric','metric','RUN DISTANCE','target',10,'unit','km')),
('wealth-keeper','WEALTH KEEPER','Log ten genuine wealth actions.','WEALTH','EPIC',180,'¤',jsonb_build_object('type','wealth_logs','target',10)),
('goal-complete','OBJECTIVE CLEARED','Complete your first Major Goal.','GOAL','RARE',150,'◎',jsonb_build_object('type','completed_goals','target',1)),
('proof-of-work','PROOF OF WORK','Archive your first proof record.','JOURNEY','RARE',60,'▣',jsonb_build_object('type','proof_count','target',1)),
('ascended-101','ASCENDED','Reach Level 101 and awaken your evolved form.','EVOLUTION','MYTHIC',1000,'⬢',jsonb_build_object('type','level','target',101))
on conflict (slug) do nothing;
