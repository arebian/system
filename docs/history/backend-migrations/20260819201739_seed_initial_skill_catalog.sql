insert into public.skills (slug,name,class_affinity,category,difficulty,description,progression_group,unlock_level,xp_reward,primary_attribute,equipment,safety_notes,is_active,sort_order) values
('explosive-push-up','EXPLOSIVE PUSH-UP',ARRAY['ASSASSIN']::text[],'POWER','BEGINNER','Progression skill from THE SYSTEM ASSASSIN tree.','PUSH',5,50,'SPEED',NULL,'Advanced calisthenics skill; unlocks in the game do not prove physical readiness.',true,1),
('archer-push-up','ARCHER PUSH-UP',ARRAY['ASSASSIN']::text[],'CONTROL','BEGINNER','Progression skill from THE SYSTEM ASSASSIN tree.','PUSH',10,75,'SPEED',NULL,'Advanced calisthenics skill; unlocks in the game do not prove physical readiness.',true,2),
('shrimp-squat','SHRIMP SQUAT',ARRAY['ASSASSIN']::text[],'BALANCE','INTERMEDIATE','Progression skill from THE SYSTEM ASSASSIN tree.','MOVEMENT',15,90,'SPEED',NULL,'Advanced calisthenics skill; unlocks in the game do not prove physical readiness.',true,3),
('wall-handstand','WALL HANDSTAND',ARRAY['ASSASSIN']::text[],'SKILL','INTERMEDIATE','Progression skill from THE SYSTEM ASSASSIN tree.','PUSH',18,100,'SPEED',NULL,'Advanced calisthenics skill; unlocks in the game do not prove physical readiness.',true,4),
('freestanding-handstand','FREESTANDING HANDSTAND',ARRAY['ASSASSIN']::text[],'MASTER','INTERMEDIATE','Progression skill from THE SYSTEM ASSASSIN tree.','PUSH',25,160,'SPEED',NULL,'Advanced calisthenics skill; unlocks in the game do not prove physical readiness.',true,5),
('one-arm-push-up','ONE-ARM PUSH-UP',ARRAY['ASSASSIN']::text[],'MASTER','ADVANCED','Progression skill from THE SYSTEM ASSASSIN tree.','PUSH',35,220,'SPEED',NULL,'Advanced calisthenics skill; unlocks in the game do not prove physical readiness.',true,6),
('handstand-push-up','HANDSTAND PUSH-UP',ARRAY['ASSASSIN','TANK']::text[],'MASTER','ADVANCED','Progression skill from THE SYSTEM ASSASSIN tree.','PUSH',40,250,'STRENGTH',NULL,'Advanced calisthenics skill; unlocks in the game do not prove physical readiness.',true,7),
('90-degree-push-up','90 DEGREE PUSH-UP',ARRAY['ASSASSIN']::text[],'LEGENDARY','ELITE','Progression skill from THE SYSTEM ASSASSIN tree.','PUSH',55,400,'SPEED',NULL,'Advanced calisthenics skill; unlocks in the game do not prove physical readiness.',true,8),
('one-arm-handstand','ONE-ARM HANDSTAND',ARRAY['ASSASSIN']::text[],'LEGENDARY','LEGENDARY','Progression skill from THE SYSTEM ASSASSIN tree.','PUSH',70,650,'SPEED',NULL,'Advanced calisthenics skill; unlocks in the game do not prove physical readiness.',true,9),
('decline-push-up','DECLINE PUSH-UP',ARRAY['TANK']::text[],'STRENGTH','BEGINNER','Progression skill from THE SYSTEM TANK tree.','PUSH',5,45,'STRENGTH',NULL,'Advanced calisthenics skill; unlocks in the game do not prove physical readiness.',true,10),
('dip-progression','DIP PROGRESSION',ARRAY['TANK']::text[],'STRENGTH','BEGINNER','Progression skill from THE SYSTEM TANK tree.','PUSH',10,70,'STRENGTH',NULL,'Advanced calisthenics skill; unlocks in the game do not prove physical readiness.',true,11),
('bulgarian-split-squat','BULGARIAN SPLIT SQUAT',ARRAY['TANK']::text[],'STRENGTH','INTERMEDIATE','Progression skill from THE SYSTEM TANK tree.','MOVEMENT',15,80,'STRENGTH',NULL,'Advanced calisthenics skill; unlocks in the game do not prove physical readiness.',true,12),
('chest-to-bar-pull-up','CHEST-TO-BAR PULL-UP',ARRAY['TANK']::text[],'POWER','INTERMEDIATE','Progression skill from THE SYSTEM TANK tree.','PULL',22,120,'STRENGTH',NULL,'Advanced calisthenics skill; unlocks in the game do not prove physical readiness.',true,13),
('pistol-squat','PISTOL SQUAT',ARRAY['TANK']::text[],'MASTER','ADVANCED','Progression skill from THE SYSTEM TANK tree.','MOVEMENT',30,180,'STRENGTH',NULL,'Advanced calisthenics skill; unlocks in the game do not prove physical readiness.',true,14),
('front-lever','FRONT LEVER',ARRAY['TANK']::text[],'LEGENDARY','ELITE','Progression skill from THE SYSTEM TANK tree.','PULL',55,400,'STRENGTH',NULL,'Advanced calisthenics skill; unlocks in the game do not prove physical readiness.',true,15),
('planche-progression','PLANCHE PROGRESSION',ARRAY['TANK']::text[],'LEGENDARY','LEGENDARY','Progression skill from THE SYSTEM TANK tree.','PUSH',65,500,'STRENGTH',NULL,'Advanced calisthenics skill; unlocks in the game do not prove physical readiness.',true,16),
('20-min-deep-work','20 MIN DEEP WORK',ARRAY['MAGE']::text[],'FOCUS','BEGINNER','Progression skill from THE SYSTEM MAGE tree.','MIND',1,30,'INTELLIGENCE',NULL,NULL,true,17),
('active-recall','ACTIVE RECALL',ARRAY['MAGE']::text[],'INTELLIGENCE','BEGINNER','Progression skill from THE SYSTEM MAGE tree.','MIND',5,45,'INTELLIGENCE',NULL,NULL,true,18),
('memory-drill','MEMORY DRILL',ARRAY['MAGE']::text[],'INTELLIGENCE','BEGINNER','Progression skill from THE SYSTEM MAGE tree.','MIND',8,55,'INTELLIGENCE',NULL,NULL,true,19),
('60-min-deep-work','60 MIN DEEP WORK',ARRAY['MAGE']::text[],'MASTER','INTERMEDIATE','Progression skill from THE SYSTEM MAGE tree.','MIND',12,90,'INTELLIGENCE',NULL,NULL,true,20),
('mental-arithmetic','MENTAL ARITHMETIC',ARRAY['MAGE']::text[],'COGNITION','INTERMEDIATE','Progression skill from THE SYSTEM MAGE tree.','MIND',18,110,'INTELLIGENCE',NULL,NULL,true,21),
('knowledge-synthesis','KNOWLEDGE SYNTHESIS',ARRAY['MAGE']::text[],'MASTER','INTERMEDIATE','Progression skill from THE SYSTEM MAGE tree.','MIND',25,160,'INTELLIGENCE',NULL,NULL,true,22),
('2-hour-knowledge-raid','2 HOUR KNOWLEDGE RAID',ARRAY['MAGE']::text[],'LEGENDARY','ADVANCED','Progression skill from THE SYSTEM MAGE tree.','MIND',40,300,'INTELLIGENCE',NULL,NULL,true,23),
('teach-what-you-learned','TEACH WHAT YOU LEARNED',ARRAY['MAGE']::text[],'LEGENDARY','ELITE','Progression skill from THE SYSTEM MAGE tree.','MIND',50,380,'INTELLIGENCE',NULL,NULL,true,24),
('5-km-run','5 KM RUN',ARRAY['RANGER']::text[],'ENDURANCE','BEGINNER','Progression skill from THE SYSTEM RANGER tree.','RUNNING',5,70,'ENDURANCE',NULL,NULL,true,25),
('hill-intervals','HILL INTERVALS',ARRAY['RANGER']::text[],'POWER','BEGINNER','Progression skill from THE SYSTEM RANGER tree.','RUNNING',10,90,'ENDURANCE',NULL,'Advanced calisthenics skill; unlocks in the game do not prove physical readiness.',true,26),
('mobility-flow','MOBILITY FLOW',ARRAY['RANGER']::text[],'MOBILITY','INTERMEDIATE','Progression skill from THE SYSTEM RANGER tree.','MOVEMENT',12,60,'ENDURANCE',NULL,NULL,true,27),
('10-km-run','10 KM RUN',ARRAY['RANGER']::text[],'MASTER','INTERMEDIATE','Progression skill from THE SYSTEM RANGER tree.','RUNNING',25,170,'ENDURANCE',NULL,NULL,true,28),
('trail-challenge','TRAIL CHALLENGE',ARRAY['RANGER']::text[],'ENDURANCE','ADVANCED','Progression skill from THE SYSTEM RANGER tree.','RUNNING',30,190,'ENDURANCE',NULL,NULL,true,29),
('long-distance-mission','LONG DISTANCE MISSION',ARRAY['RANGER']::text[],'MASTER','ADVANCED','Progression skill from THE SYSTEM RANGER tree.','RUNNING',40,260,'ENDURANCE',NULL,NULL,true,30),
('endurance-gauntlet','ENDURANCE GAUNTLET',ARRAY['RANGER']::text[],'LEGENDARY','ELITE','Progression skill from THE SYSTEM RANGER tree.','RUNNING',55,420,'ENDURANCE',NULL,NULL,true,31),
('commander-circuit','COMMANDER CIRCUIT',ARRAY['COMMANDER']::text[],'BALANCED','BEGINNER','Progression skill from THE SYSTEM COMMANDER tree.','DISCIPLINE',5,70,'DISCIPLINE',NULL,NULL,true,32),
('iron-discipline','IRON DISCIPLINE',ARRAY['COMMANDER']::text[],'DISCIPLINE','BEGINNER','Progression skill from THE SYSTEM COMMANDER tree.','DISCIPLINE',10,90,'DISCIPLINE',NULL,NULL,true,33),
('tactical-endurance','TACTICAL ENDURANCE',ARRAY['COMMANDER']::text[],'BALANCED','INTERMEDIATE','Progression skill from THE SYSTEM COMMANDER tree.','DISCIPLINE',18,130,'DISCIPLINE',NULL,NULL,true,34),
('first-order','FIRST ORDER',ARRAY['COMMANDER']::text[],'DISCIPLINE','INTERMEDIATE','Progression skill from THE SYSTEM COMMANDER tree.','DISCIPLINE',22,120,'DISCIPLINE',NULL,NULL,true,35),
('master-of-routine','MASTER OF ROUTINE',ARRAY['COMMANDER']::text[],'MASTER','ADVANCED','Progression skill from THE SYSTEM COMMANDER tree.','DISCIPLINE',30,210,'DISCIPLINE',NULL,NULL,true,36),
('commander-trial','COMMANDER TRIAL',ARRAY['COMMANDER']::text[],'LEGENDARY','ELITE','Progression skill from THE SYSTEM COMMANDER tree.','DISCIPLINE',50,500,'DISCIPLINE',NULL,NULL,true,37),
('sovereign-protocol','SOVEREIGN PROTOCOL',ARRAY['COMMANDER']::text[],'LEGENDARY','LEGENDARY','Progression skill from THE SYSTEM COMMANDER tree.','DISCIPLINE',70,700,'DISCIPLINE',NULL,NULL,true,38)
on conflict (slug) do update set name=excluded.name,class_affinity=excluded.class_affinity,category=excluded.category,difficulty=excluded.difficulty,description=excluded.description,progression_group=excluded.progression_group,unlock_level=excluded.unlock_level,xp_reward=excluded.xp_reward,primary_attribute=excluded.primary_attribute,equipment=excluded.equipment,safety_notes=excluded.safety_notes,is_active=excluded.is_active,sort_order=excluded.sort_order,updated_at=now();

insert into public.skill_prerequisites (skill_id, prerequisite_skill_id, minimum_status)
select s.id, p.id, 'MASTERED'
from (values
 ('freestanding-handstand','wall-handstand'),
 ('one-arm-push-up','archer-push-up'),
 ('memory-drill','active-recall'),
 ('60-min-deep-work','20-min-deep-work'),
 ('knowledge-synthesis','active-recall'),
 ('teach-what-you-learned','knowledge-synthesis'),
 ('10-km-run','5-km-run'),
 ('long-distance-mission','10-km-run'),
 ('sovereign-protocol','commander-trial')
) as v(skill_slug, prereq_slug)
join public.skills s on s.slug = v.skill_slug
join public.skills p on p.slug = v.prereq_slug
on conflict (skill_id, prerequisite_skill_id) do update set minimum_status = excluded.minimum_status;
