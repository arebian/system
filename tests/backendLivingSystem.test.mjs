import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { buildWeeklyPlan } from "../supabase/functions/_shared/weeklyBossCore.js";

test("backend migration enforces review ownership, proof binding, idempotency and weekly reward limits", { timeout: 120000 }, async t => {
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
  for (const filename of (await readdir(directory)).filter(n => n.endsWith(".sql")).sort()) await db.exec(await readFile(new URL(filename, directory), "utf8"));
  const uid = "00000000-0000-4000-8000-000000000001", other = "00000000-0000-4000-8000-000000000002";
  await db.exec(`insert into auth.users(id) values('${uid}'),('${other}');
    insert into public.profiles(id,name,age,class,level,streak) values('${uid}','Test Hunter',25,'MAGE',10,3),('${other}','Other Hunter',25,'MAGE',10,3);
    insert into public.attributes(user_id) values('${uid}'),('${other}');
    select set_config('request.jwt.claim.sub','${uid}',false);`);
  const today = (await db.query("select current_date::text as day")).rows[0].day;
  await db.exec(`insert into public.quest_library(code,title,objective,category,quest_type,difficulty,xp_reward,min_level,metadata)
    values('test-living-read','TEST LIVING READ','Read for 20 minutes','LEARNING','STANDARD','NORMAL',45,1,'{"proof_type":"RESULT"}');`);
  const snapshot = (await db.query("select public.system_quest_review_context_v1('TEST LIVING READ',current_date) as value")).rows[0].value;
  await assert.rejects(db.query("select public.system_quest_review_context_v1('TEST LIVING READ',current_date+1)"), /QUEST_DATE_INVALID/);
  const proof = { type: "RESULT", detail: "red 25 mins finshed chapter 3", note: "", takeaways: [], imagePath: "", honorConfirmed: false };
  const metadata = { proof_type: proof.type, proof_detail: proof.detail, proof_takeaways: [], proof_honor_confirmed: false, legacy_key: `${today}-living-read` };
  const complete = data => db.query("select public.system_complete_quest_by_title_v2('TEST LIVING READ',$1::jsonb,current_date) as value", [JSON.stringify(data)]);
  await assert.rejects(complete(metadata), /APPROVED_REVIEW_REQUIRED/);
  assert.equal((await db.query("select xp from public.profiles where id=$1", [uid])).rows[0].xp, 0);
  async function receipt(userId, targetType, targetId, snap, evidence, decision = "APPROVE") {
    return (await db.query(`insert into public.system_quest_reviews(user_id,target_type,target_id,assigned_for,snapshot,proof,decision,reason,model)
      values($1,$2,$3,current_date,$4::jsonb,$5::jsonb,$6,'Fixture review','fixture') returning id`,
    [userId, targetType, targetId, JSON.stringify(snap), JSON.stringify(evidence), decision])).rows[0].id;
  }
  const wrongOwner = await receipt(other, "QUEST", snapshot.target_id, snapshot, proof);
  await assert.rejects(complete({ ...metadata, proof_review_id: wrongOwner }), /REVIEW_NOT_VALID/);
  const id = await receipt(uid, "QUEST", snapshot.target_id, snapshot, proof);
  await db.query("update public.system_quest_reviews set expires_at=now()-interval '1 second' where id=$1", [id]);
  await assert.rejects(complete({ ...metadata, proof_review_id: id }), /REVIEW_NOT_VALID/);
  await db.query("update public.system_quest_reviews set expires_at=now()+interval '30 minutes' where id=$1", [id]);
  await assert.rejects(complete({ ...metadata, proof_review_id: id, proof_detail: "different evidence" }), /PROOF_CHANGED/);
  const accepted = (await complete({ ...metadata, proof_review_id: id })).rows[0].value;
  assert.equal(accepted.quest.status, "COMPLETED");
  const xpAfter = (await db.query("select xp,level from public.profiles where id=$1", [uid])).rows[0];
  assert.equal((await complete({ ...metadata, proof_review_id: id })).rows[0].value.duplicate, true);
  assert.deepEqual((await db.query("select xp,level from public.profiles where id=$1", [uid])).rows[0], xpAfter);

  await db.exec(`set role authenticated;`);
  await assert.rejects(db.exec(`insert into public.system_quest_reviews(user_id,target_type,target_id,snapshot,proof,decision,reason,model) values('${uid}','QUEST','x','{}','{}','APPROVE','fake','fake')`), /permission denied/);
  assert.equal((await db.query("select count(*)::int as count from public.system_quest_reviews")).rows[0].count, 1);
  await db.exec("reset role");
  const privileges = (await db.query(`select has_function_privilege('anon','public.system_accept_weekly_boss_v1(uuid)','execute') as anon,
    has_schema_privilege('authenticated','system_private','usage') as internal`)).rows[0];
  assert.equal(privileges.anon, false); assert.equal(privileges.internal, false);

  // Text cannot impersonate an existing timer or a different GPS session.
  const gpsLibrary = (await db.query(`insert into public.quest_library(code,title,objective,category,quest_type,difficulty,xp_reward,metadata)
    values('test-living-gps','TEST LIVING GPS','Complete the linked route','PHYSICAL','STANDARD','NORMAL',30,'{"proof_type":"GPS"}') returning id`)).rows[0].id;
  const gpsQuest = (await db.query(`insert into public.user_quests(user_id,quest_id,assigned_for,quest_type,title_snapshot,objective_snapshot,category,xp_reward)
    values($1,$2,current_date,'STANDARD','TEST LIVING GPS','Complete the linked route','PHYSICAL',30) returning id`, [uid, gpsLibrary])).rows[0].id;
  await assert.rejects(db.query("select public.system_complete_quest($1,'{\"proof_type\":\"HONOR\"}')", [gpsQuest]), /SERVER_ACTIVITY_REQUIRED/);
  const gpsSession = (await db.query("insert into public.gps_sessions(user_id,quest_id,gps_verified,status) values($1,$2,true,'VERIFIED') returning id", [uid, gpsQuest])).rows[0].id;
  const gpsCompletion = (await db.query("select public.system_complete_quest($1,$2::jsonb) as value", [gpsQuest, JSON.stringify({ gps_session_id: gpsSession, proof_type: "GPS" })])).rows[0].value;
  assert.equal(gpsCompletion.quest.status, "COMPLETED");
  const wakeLibrary = (await db.query(`insert into public.quest_library(code,title,objective,category,quest_type,difficulty,xp_reward,metadata)
    values('test-living-wake','NO-SNOOZE PROTOCOL','Wake at the committed time','DISCIPLINE','DAILY','NORMAL',20,'{"proof_type":"TIME"}') returning id`)).rows[0].id;
  const wakeQuest = (await db.query(`insert into public.user_quests(user_id,quest_id,assigned_for,quest_type,title_snapshot,objective_snapshot,category,xp_reward)
    values($1,$2,current_date,'DAILY','NO-SNOOZE PROTOCOL','Wake at the committed time','DISCIPLINE',20) returning id`, [uid, wakeLibrary])).rows[0].id;
  const wakeMetadata = JSON.stringify({ proof_type: "TIME", context: "DAILY_WAKE" });
  await assert.rejects(db.query("select public.system_complete_quest($1,$2::jsonb)", [wakeQuest, wakeMetadata]), /SERVER_ACTIVITY_REQUIRED/);
  await db.query("insert into public.routine_checkins(user_id,checkin_type,occurred_at,timezone,status) values($1,'WAKE',now(),'UTC','ON_TIME')", [uid]);
  assert.equal((await db.query("select public.system_complete_quest($1,$2::jsonb) as value", [wakeQuest, wakeMetadata])).rows[0].value.quest.status, "COMPLETED");

  // Reestablish the earned key conditions; the earlier quest legitimately recalculates streak.
  await db.exec(`update public.profiles set streak=3 where id='${uid}';`);
  const plan = buildWeeklyPlan({ need: "BREAKFAST", days: 7, storage: "FREEZER" }, xpAfter.level);
  const draft = (await db.query("insert into public.system_weekly_boss_plans(user_id,plan) values($1,$2::jsonb) returning id", [uid, JSON.stringify(plan)])).rows[0].id;
  const boss = (await db.query("select public.system_accept_weekly_boss_v1($1) as value", [draft])).rows[0].value.boss;
  assert.equal((await db.query("select public.system_accept_weekly_boss_v1($1) as value", [draft])).rows[0].value.duplicate, true);
  assert.equal((await db.query("select public.system_resolve_active_boss() as value")).rows[0].value.reason, "WEEKLY_RESULT_REVIEW_REQUIRED");
  await assert.rejects(db.query("select public.system_complete_weekly_boss_v1($1,$2)", [boss.id, id]), /CHECKPOINTS_REMAIN/);
  const objectives = (await db.query("select id from public.boss_quest_objectives where boss_quest_id=$1", [boss.id])).rows;
  for (const objective of objectives) await db.query("select public.system_set_boss_objective($1,true)", [objective.id]);
  await db.query("update public.boss_quests set hp=0 where id=$1", [boss.id]);
  assert.equal((await db.query("select public.system_resolve_active_boss() as value")).rows[0].value.reason, "WEEKLY_RESULT_REVIEW_REQUIRED");
  await assert.rejects(db.query("select public.system_complete_weekly_boss_v1($1,$2)", [boss.id, id]), /WEEKLY_REVIEW_REQUIRED/);
  const bossSnapshot = { kind: "WEEKLY_PREPARATION", objective: plan.objective, target_id: String(boss.id), remaining_checkpoints: 0 };
  const bossReceipt = await receipt(uid, "BOSS", String(boss.id), bossSnapshot, { detail: "Seven breakfasts ready, three chilled and four frozen." });
  const beforeAttrs = (await db.query("select discipline,recovery from public.attributes where user_id=$1", [uid])).rows[0];
  const victory = (await db.query("select public.system_complete_weekly_boss_v1($1,$2) as value", [boss.id, bossReceipt])).rows[0].value;
  assert.equal(victory.resolved, true);
  const afterAttrs = (await db.query("select discipline,recovery from public.attributes where user_id=$1", [uid])).rows[0];
  assert.equal(afterAttrs.discipline - beforeAttrs.discipline, 4);
  assert.equal(afterAttrs.recovery - beforeAttrs.recovery, 2);
  assert.equal((await db.query("select public.system_complete_weekly_boss_v1($1,$2) as value", [boss.id, bossReceipt])).rows[0].value.duplicate, true);
  assert.deepEqual((await db.query("select discipline,recovery from public.attributes where user_id=$1", [uid])).rows[0], afterAttrs);
  assert.equal((await db.query("select public.system_weekly_boss_status_v1() as value")).rows[0].value.can_assign, false);
  const another = (await db.query("insert into public.system_weekly_boss_plans(user_id,plan) values($1,$2::jsonb) returning id", [uid, JSON.stringify(plan)])).rows[0].id;
  await assert.rejects(db.query("select public.system_accept_weekly_boss_v1($1)", [another]), /WEEKLY_COOLDOWN/);
  await db.exec(`select set_config('request.jwt.claim.sub','${other}',false);`);
  await assert.rejects(db.query("select public.system_complete_weekly_boss_v1($1,$2)", [boss.id, bossReceipt]), /WEEKLY_BOSS_NOT_FOUND/);

  // Equipping is a reversible server loadout, never a repeatable stat award.
  await db.exec(`select set_config('request.jwt.claim.sub','${uid}',false);`);
  const earnedBefore = (await db.query("select * from public.attributes where user_id=$1", [uid])).rows[0];
  const loadout = (await db.query("select public.system_sync_equipment_unlocks_v1() as value")).rows[0].value;
  const runner = loadout.items.find(item => item.slug === "runners-edge");
  assert.ok(runner);
  const inventoryCount = (await db.query("select count(*)::int as n from public.user_inventory where user_id=$1", [uid])).rows[0].n;
  await db.query("select public.system_sync_equipment_unlocks_v1()");
  assert.equal((await db.query("select count(*)::int as n from public.user_inventory where user_id=$1", [uid])).rows[0].n, inventoryCount);
  const equip = id => db.query("select public.system_set_inventory_state($1,true,null) as value", [id]);
  const equipped = (await equip(runner.id)).rows[0].value;
  assert.equal(equipped.equipment.bonuses.SPEED, 5);
  assert.equal(equipped.equipment.effective_attributes.SPEED, earnedBefore.speed + 5);
  assert.equal((await equip(runner.id)).rows[0].value.equipment.bonuses.SPEED, 5);
  await db.query("insert into public.user_inventory(user_id,catalog_item_id,equipped) select $1,catalog_item_id,true from public.user_inventory where id=$2", [uid,runner.id]);
  assert.equal((await db.query("select public.system_equipment_loadout_v1() as value")).rows[0].value.bonuses.SPEED, 5);
  const removed = (await db.query("select public.system_set_inventory_state($1,false,null) as value", [runner.id])).rows[0].value;
  assert.equal(removed.equipment.bonuses.SPEED, 0);
  assert.equal(removed.equipment.effective_attributes.SPEED, earnedBefore.speed);
  await db.query("select public.system_add_custom_inventory('FAKE POWER','GEAR','MYTHIC','+999 SPEED',null,null)");
  const personal = (await db.query("select id from public.user_inventory where user_id=$1 and custom_name='FAKE POWER'", [uid])).rows[0];
  assert.equal((await equip(personal.id)).rows[0].value.equipment.bonuses.SPEED, 0);
  const locked = (await db.query("insert into public.user_inventory(user_id,catalog_item_id) select $1,id from public.item_catalog where slug='focus-crystal' returning id", [uid])).rows[0];
  await assert.rejects(equip(locked.id), /ITEM_LEVEL_REQUIRED/);
  await db.exec(`select set_config('request.jwt.claim.sub','${other}',false);`);
  await assert.rejects(equip(runner.id), /INVENTORY_ITEM_NOT_FOUND/);
  assert.deepEqual((await db.query("select * from public.attributes where user_id=$1", [uid])).rows[0], earnedBefore);
  const equipmentPrivileges = (await db.query("select has_function_privilege('anon','public.system_equipment_loadout_v1()','execute') as anon")).rows[0];
  assert.equal(equipmentPrivileges.anon, false);
});
