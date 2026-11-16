import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { recommendQuestObjectives, objectiveProposalSummary } from "../src/systemQuestObjectivesCore.js";

test("multi-objective quests enforce proposals, replacement, timer proof, reviewed XP and parent completion", { timeout: 120000 }, async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`SET TIME ZONE 'UTC'; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid primary key,email text);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$SELECT coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'authenticated')$$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$SELECT jsonb_build_object('sub',auth.uid(),'role',auth.role())$$;
    GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
    CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text primary key,name text,public boolean DEFAULT false,file_size_limit bigint,allowed_mime_types text[]);
    CREATE TABLE storage.objects(id uuid primary key DEFAULT gen_random_uuid(),bucket_id text,name text,owner uuid,owner_id text);
    CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$SELECT string_to_array($1,'/')$$;`);
  const directory = new URL("../supabase/migrations/", import.meta.url);
  for (const filename of (await readdir(directory)).filter(n => n.endsWith(".sql")).sort()) {
    try { await db.exec(await readFile(new URL(filename, directory), "utf8")); }
    catch (error) { throw new Error(`Migration ${filename} failed: ${error.message}; position=${error.position ?? "unknown"}`, { cause: error }); }
  }

  const user = "00000000-0000-4000-8000-000000000091";
  const other = "00000000-0000-4000-8000-000000000092";
  await db.exec(`insert into auth.users(id) values('${user}'),('${other}');
    insert into public.profiles(id,name,age,class,level,streak) values('${user}','Quest Tester',25,'MAGE',10,3),('${other}','Other Tester',25,'TANK',10,1);
    insert into public.attributes(user_id) values('${user}'),('${other}');
    select set_config('request.jwt.claim.sub','${user}',false);`);

  const photoTask = (await db.query(`insert into public.quest_task_library(code,title,objective,pillar,difficulty,duration_minutes,min_level,xp_reward,proof_type)
    values('QA_PHOTO','PHOTO TASK','Capture evidence of the completed task.','SOCIAL','NORMAL',10,1,12,'PHOTO') returning id`)).rows[0].id;
  const taskRows = (await db.query(`select id,code from public.quest_task_library where code in ('PHYSICAL_MOVE','INTELLECT_READ','DISCIPLINE_FOCUS_BLOCK')`)).rows;
  const taskIds = Object.fromEntries(taskRows.map(row => [row.code,row.id]));
  const parentId = (await db.query(`insert into public.user_quests(user_id,quest_id,assigned_for,quest_type,title_snapshot,objective_snapshot,category,xp_reward,status)
    select '${user}'::uuid,id,current_date,'DAILY','NO ZERO DAY','Complete all three focused objectives.','DISCIPLINE',50,'ASSIGNED'
    from public.quest_library where code='NO_ZERO_DAY' limit 1 returning id`)).rows[0]?.id;
  let questId = parentId;
  if (!questId) {
    const libraryId = (await db.query(`insert into public.quest_library(code,title,objective,category,quest_type,difficulty,xp_reward,min_level,metadata)
      values('QA_NO_ZERO_DAY','NO ZERO DAY','Complete all three focused objectives.','DISCIPLINE','DAILY','NORMAL',50,1,'{}') returning id`)).rows[0].id;
    questId = (await db.query(`insert into public.user_quests(user_id,quest_id,assigned_for,quest_type,title_snapshot,objective_snapshot,category,xp_reward,status)
      values('${user}', '${libraryId}', current_date,'DAILY','NO ZERO DAY','Complete all three focused objectives.','DISCIPLINE',50,'ASSIGNED') returning id`)).rows[0].id;
  }

  const propose = ids => db.query("select public.system_propose_quest_objectives($1,$2::uuid[],$3::text[]) as value", [questId, ids, ids.map(() => "QA recommendation")]);
  const initialIds = [taskIds.PHYSICAL_MOVE, taskIds.INTELLECT_READ, taskIds.DISCIPLINE_FOCUS_BLOCK];
  const proposed = (await propose(initialIds)).rows[0].value;
  assert.equal(proposed.objectives.length, 3, "SYSTEM must propose exactly three objectives");
  const objectiveByTask = new Map(proposed.objectives.map(row => [row.task_id,row]));
  const rows = proposed.objectives;
  const rejected = rows[0];
  await db.query("select public.system_decide_quest_objective($1,'REJECT')", [rejected.id]);
  await db.query("select public.system_decide_quest_objective($1,'ACCEPT')", [rows[1].id]);
  await db.query("select public.system_decide_quest_objective($1,'ACCEPT')", [rows[2].id]);
  await assert.rejects(propose([rejected.task_id]), /TASK_ALREADY_USED_FOR_PARENT/);
  const replacement = (await propose([photoTask])).rows[0].value.objectives;
  assert.equal(replacement.length, 3, "replacement should preserve the two accepted objectives");
  assert.equal(replacement.filter(row => row.status === "ACCEPTED").length, 2);
  assert.equal(replacement.filter(row => row.status === "PROPOSED").length, 1);
  assert.ok(replacement.some(row => row.status === "REJECTED") === false, "rejected history is excluded from active response");
  const photoObjective = replacement.find(row => row.task_id === photoTask);
  await db.query("select public.system_decide_quest_objective($1,'ACCEPT')", [photoObjective.id]);

  await assert.rejects(db.query("update public.user_quests set status='COMPLETED' where id=$1", [questId]), /QUEST_OBJECTIVES_INCOMPLETE/);

  // An accepted timer objective cannot finish early. Server elapsed time is authoritative.
  const timerObjective = replacement.find(row => row.proof_type === "TIMER");
  const started = (await db.query("select public.system_start_quest_objective_timer($1) as value", [timerObjective.id])).rows[0].value.session;
  const resumed = (await db.query("select public.system_start_quest_objective_timer($1) as value", [timerObjective.id])).rows[0].value;
  assert.equal(resumed.resumed, true, "a refresh/restart resumes the existing running timer");
  const early = (await db.query("select public.system_finish_quest_objective_timer($1) as value", [started.id])).rows[0].value;
  assert.equal(early.status, "TOO_EARLY", "server must reject an early timer finish");
  await db.query("update public.user_quest_objective_timer_sessions set started_at=now()-interval '90 minutes' where id=$1", [started.id]);
  const finished = (await db.query("select public.system_finish_quest_objective_timer($1) as value", [started.id])).rows[0].value;
  assert.equal(finished.session.status, "COMPLETED");
  assert.ok(finished.session.elapsed_seconds >= timerObjective.duration_minutes * 60);
  assert.equal((await db.query("select public.system_finish_quest_objective_timer($1) as value", [started.id])).rows[0].value.duplicate, true);

  // An objective cannot claim XP with a missing, foreign, expired, or non-APPROVE review.
  const completeWith = (objectiveId, reviewId) => db.query("select public.system_complete_quest_objective($1,$2) as value", [objectiveId,reviewId]);
  const beforeXp = (await db.query("select xp from public.profiles where id=$1", [user])).rows[0].xp;
  await assert.rejects(completeWith(photoObjective.id, "00000000-0000-4000-8000-000000000099"), /OBJECTIVE_REVIEW_NOT_FOUND/);
  async function addReview(owner, objectiveId, decision = "APPROVE") {
    return (await db.query(`insert into public.system_quest_reviews(user_id,target_type,target_id,assigned_for,snapshot,proof,decision,reason,model)
      values($1,'OBJECTIVE',$2,current_date,'{"kind":"QUEST_OBJECTIVE"}'::jsonb,'{"detail":"Completed the objective and recorded the result."}'::jsonb,$3,'Fixture review','fixture') returning id`,
      [owner,objectiveId,decision])).rows[0].id;
  }
  const foreignReview = await addReview(other, photoObjective.id);
  await assert.rejects(completeWith(photoObjective.id, foreignReview), /OBJECTIVE_REVIEW_NOT_FOUND/);
  const clarifyReview = await addReview(user, photoObjective.id, "CLARIFY");
  await assert.rejects(completeWith(photoObjective.id, clarifyReview), /OBJECTIVE_REVIEW_NOT_APPROVED/);
  const expiredReview = await addReview(user, photoObjective.id);
  await db.query("update public.system_quest_reviews set expires_at=now()-interval '1 second' where id=$1", [expiredReview]);
  await assert.rejects(completeWith(photoObjective.id, expiredReview), /OBJECTIVE_REVIEW_EXPIRED/);
  const approvedReviews = new Map();
  for (const objective of replacement.filter(row => row.status === "ACCEPTED" || row.status === "PROPOSED")) {
    const reviewId = await addReview(user, objective.id);
    approvedReviews.set(objective.id, reviewId);
  }
  for (const objective of replacement) {
    const reviewId = approvedReviews.get(objective.id);
    const result = (await completeWith(objective.id, reviewId)).rows[0].value;
    assert.equal(result.duplicate, false);
    assert.equal(result.objective.status, "COMPLETED");
    const after = (await db.query("select xp from public.profiles where id=$1", [user])).rows[0].xp;
    assert.ok(after > beforeXp, "approved objective completion must award server-side XP");
    const duplicate = (await completeWith(objective.id, reviewId)).rows[0].value;
    assert.equal(duplicate.duplicate, true, "retry must not award XP twice");
    assert.equal((await db.query("select xp from public.profiles where id=$1", [user])).rows[0].xp, after);
  }
  await db.query("update public.user_quests set status='COMPLETED' where id=$1", [questId]);
  assert.equal((await db.query("select status from public.user_quests where id=$1", [questId])).rows[0].status, "COMPLETED");

  const otherParent = (await db.query(`insert into public.user_quests(user_id,quest_id,assigned_for,quest_type,title_snapshot,objective_snapshot,category,xp_reward,status)
    select '${other}'::uuid,id,current_date,'DAILY','NO ZERO DAY','Other player quest.','DISCIPLINE',50,'ASSIGNED'
    from public.quest_library where code='QA_NO_ZERO_DAY' returning id`)).rows[0].id;
  await db.exec(`select set_config('request.jwt.claim.sub','${user}',false);`);
  await assert.rejects(db.query("select public.system_propose_quest_objectives($1,$2::uuid[],'{}')", [otherParent,initialIds]), /QUEST_NOT_FOUND/);
});

test("adaptive objective recommendations respect identity, balance, recency and three-task limit", () => {
  const tasks = [
    { id: "p1", title: "Move", pillar: "PHYSICAL", difficulty: "EASY", duration_minutes: 10, proof_type: "HONOR" },
    { id: "i1", title: "Read", pillar: "INTELLECT", difficulty: "NORMAL", duration_minutes: 20, proof_type: "NOTE" },
    { id: "d1", title: "Plan", pillar: "DISCIPLINE", difficulty: "HARD", duration_minutes: 5, proof_type: "NOTE" },
    { id: "w1", title: "Build", pillar: "WEALTH", difficulty: "NORMAL", duration_minutes: 20, proof_type: "TIMER" },
    { id: "w2", title: "Scale", pillar: "WEALTH", difficulty: "HARD", duration_minutes: 35, proof_type: "TIMER" },
    { id: "s1", title: "Connect", pillar: "SOCIAL", difficulty: "NORMAL", duration_minutes: 5, proof_type: "HONOR" },
  ];
  const identity = { primary: "WEALTH", secondary: ["SOCIAL", "MENTAL"] };
  const hard = recommendQuestObjectives(tasks, identity, { level: 8, recentCompletionRate: 92 }, 3);
  assert.equal(hard.length, 3);
  assert.deepEqual(new Set(hard.map(row => row.pillar)), new Set(["PHYSICAL", "INTELLECT", "WEALTH"]));
  assert.ok(hard.some(row => row.difficulty === "HARD"), "high completion rate and level should adapt toward harder tasks");
  const easy = recommendQuestObjectives(tasks, identity, { level: 2, recentCompletionRate: 30 }, 3);
  assert.ok(easy.every(row => row.difficulty === "EASY" || row.difficulty === "NORMAL"));
  const recent = [{ title: "Move", date: new Date().toISOString() }];
  const withoutRepeat = recommendQuestObjectives(tasks, identity, { level: 2, recentCompletionRate: 50, questLog: recent }, 3);
  assert.ok(!withoutRepeat.some(row => row.title === "Move"));
  const summary = objectiveProposalSummary([{ status: "ACCEPTED" }, { status: "PROPOSED" }, { status: "COMPLETED" }]);
  assert.deepEqual(summary, { total: 3, accepted: 1, proposed: 1, completed: 1, allAccepted: false });
});
