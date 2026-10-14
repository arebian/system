with req(workout_slug, skill_slug, minimum_status) as (values
('push-foundation','incline-push-up','AVAILABLE'),
('push-strength-i','push-up','MASTERED'),
('push-strength-ii','decline-push-up','MASTERED'),
('pull-foundation','dead-hang','AVAILABLE'),
('pull-strength-i','pull-up','AVAILABLE'),
('pull-strength-ii','chest-to-bar-pull-up','AVAILABLE'),
('handstand-foundation','pike-push-up','AVAILABLE'),
('handstand-balance','wall-handstand-30','MASTERED'),
('handstand-press-path','freestanding-handstand-20','MASTERED'),
('handstand-press-path','pike-compression','MASTERED'),
('muscle-up-prep','chest-to-bar-pull-up','MASTERED'),
('muscle-up-prep','straight-bar-dip','MASTERED'),
('planche-base','push-up','MASTERED'),
('planche-advanced','tuck-planche','AVAILABLE'),
('front-lever-base','tuck-front-lever','AVAILABLE'),
('front-lever-advanced','advanced-tuck-front-lever','MASTERED'),
('back-lever-base','skin-the-cat','MASTERED'),
('human-flag-prep','vertical-flag-support','AVAILABLE'),
('l-sit-path','l-sit-tuck','AVAILABLE'),
('dragon-flag-prep','dragon-flag-negative','AVAILABLE'),
('single-leg-strength','bulgarian-split-squat','AVAILABLE'),
('five-k-builder','run-3k','MASTERED'),
('full-body-ascension','pull-up','MASTERED'),
('full-body-ascension','dip-progression','MASTERED')
), resolved as (
select wt.id workout_id, s.id skill_id, req.minimum_status
from req join public.workout_templates wt on wt.slug=req.workout_slug join public.skills s on s.slug=req.skill_slug
)
insert into public.workout_skill_requirements(workout_id,skill_id,minimum_status)
select workout_id,skill_id,minimum_status from resolved
on conflict(workout_id,skill_id) do update set minimum_status=excluded.minimum_status;
