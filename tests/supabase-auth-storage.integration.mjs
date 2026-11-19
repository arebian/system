import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.API_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
for (const [name, value] of Object.entries({ url, anonKey, serviceKey })) {
  if (!value) throw new Error(`Missing local Supabase environment value: ${name}`);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const password = `Local-QA-${stamp}-Aa9!`;
const users = [];
const uploaded = [];
const uploadedClips = [];
const historyFixtures = [];
const makeUser = async (suffix) => {
  const email = `system-qa-${suffix}-${stamp}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  users.push(data.user.id);
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const signed = await client.auth.signInWithPassword({ email, password });
  if (signed.error) throw signed.error;
  assert.equal(signed.data.user.id, data.user.id);
  return { id: data.user.id, client, accessToken: signed.data.session.access_token };
};

try {
  const first = await makeUser("one");
  const second = await makeUser("two");
  const identity = { primary: "DISCIPLINE", secondary: ["PHYSICAL", "INTELLECT"] };

  const initialized = await first.client.rpc("system_initialize_profile", {
    p_name: "LOCAL QA PLAYER", p_age: 25, p_gender: "Prefer not to say",
    p_class: "MAGE", p_fingerprint: null, p_profile_data: { identity },
  });
  assert.ifError(initialized.error);
  assert.equal(initialized.data.profile.id, first.id);
  assert.deepEqual(initialized.data.profile.profile_data.identity, identity);

  const ownProfile = await first.client.from("profiles").select("id,profile_data").eq("id", first.id).single();
  assert.ifError(ownProfile.error);
  assert.deepEqual(ownProfile.data.profile_data.identity, identity);

  const forgedProfileUpdate = await first.client.from("profiles").update({
    profile_data: { identity, xp: 999999 },
  }).eq("id", first.id).select("id");
  assert.ok(forgedProfileUpdate.error, "Players must not directly update canonical profile state");

  const directProfileDelete = await first.client.from("profiles").delete().eq("id", first.id).select("id");
  assert.ok(directProfileDelete.error, "Players must reset through the authenticated reset RPC, not delete profiles directly");

  const forgedAttributeUpdate = await first.client.from("attributes").update({
    strength: 9999,
  }).eq("user_id", first.id).select("user_id");
  assert.ok(forgedAttributeUpdate.error, "Players must not directly edit canonical attributes");

  const forgedQuestUpdate = await first.client.from("user_quests").update({
    status: "COMPLETED",
  }).eq("user_id", first.id).select("id");
  assert.ok(forgedQuestUpdate.error, "Players must not directly complete parent quests");

  const forgedObjectiveUpdate = await first.client.from("user_quest_objectives").update({
    status: "COMPLETED",
  }).eq("user_id", first.id).select("id");
  assert.ok(forgedObjectiveUpdate.error, "Players must not directly complete quest objectives");

  const edgeHeaders = {
    apikey: anonKey,
    Authorization: `Bearer ${first.accessToken}`,
    "Content-Type": "application/json",
  };
  const edgeHealth = await fetch(`${url}/functions/v1/system-api`, {
    method: "POST", headers: edgeHeaders, body: JSON.stringify({ action: "health" }),
  });
  assert.equal(edgeHealth.status, 200, "Authenticated Edge Function health action must succeed");
  const healthBody = await edgeHealth.json();
  assert.equal(healthBody.data.status, "ONLINE");
  assert.equal(healthBody.data.user_id, first.id);

  const bootstrapResponse = await fetch(`${url}/functions/v1/system-api`, {
    method: "POST", headers: edgeHeaders, body: JSON.stringify({ action: "bootstrap" }),
  });
  assert.equal(bootstrapResponse.status, 200, "Authenticated Edge Function bootstrap must succeed");
  const bootstrapBody = await bootstrapResponse.json();
  assert.equal(bootstrapBody.data.profile.id, first.id);
  assert.deepEqual(bootstrapBody.data.profile.profile_data.identity, identity);

  const taskLibrary = await first.client.from("quest_task_library").select("id,pillar").limit(3);
  assert.ifError(taskLibrary.error);
  assert.ok(Array.isArray(taskLibrary.data), "Authenticated player can read the curated objective library");

  const crossProfile = await first.client.from("profiles").select("id").eq("id", second.id);
  assert.ifError(crossProfile.error);
  assert.deepEqual(crossProfile.data, [], "RLS must hide another authenticated user's profile");

  const anonymous = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const unauthenticatedInit = await anonymous.rpc("system_initialize_profile", {
    p_name: "UNAUTHENTICATED", p_age: 25, p_gender: null, p_class: "MAGE",
    p_fingerprint: null, p_profile_data: {},
  });
  assert.ok(unauthenticatedInit.error, "Profile initialization must reject an unauthenticated caller");

  const proofPath = `${first.id}/integration-proof.png`;
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const upload = await first.client.storage.from("proofs").upload(proofPath, bytes, {
    contentType: "image/png", upsert: false,
  });
  assert.ifError(upload.error);
  uploaded.push(proofPath);

  const clipPath = `${first.id}/local-qa-session/qa-clip.webm`;
  const clipUpload = await admin.storage.from("class-special-clips").upload(
    clipPath,
    new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]),
    { contentType: "video/webm", upsert: false },
  );
  assert.ifError(clipUpload.error);
  uploadedClips.push(clipPath);

  const ownDownload = await first.client.storage.from("proofs").download(proofPath);
  assert.ifError(ownDownload.error);
  assert.ok(ownDownload.data);

  const foreignDownload = await second.client.storage.from("proofs").download(proofPath);
  assert.ok(foreignDownload.error, "Storage RLS must deny another user access to this proof");

  const signedUrl = await admin.storage.from("proofs").createSignedUrl(proofPath, 60);
  assert.ifError(signedUrl.error);
  assert.ok(signedUrl.data.signedUrl);

  // Canonical history is backend-authored. A player may read only their own
  // rows, but cannot create or rewrite progression/journey records directly.
  for (const table of ["progression_events", "journey_events"]) {
    const ownFixture = await admin.from(table).insert({
      user_id: first.id,
      event_type: "LOCAL_QA_FIXTURE",
      title: "LOCAL QA HISTORY",
      xp_delta: 0,
      metadata: { test_fixture: true },
    }).select("id").single();
    assert.ifError(ownFixture.error);
    const foreignFixture = await admin.from(table).insert({
      user_id: second.id,
      event_type: "LOCAL_QA_FIXTURE",
      title: "FOREIGN LOCAL QA HISTORY",
      xp_delta: 0,
      metadata: { test_fixture: true },
    }).select("id").single();
    assert.ifError(foreignFixture.error);
    historyFixtures.push({ table, ids: [ownFixture.data.id, foreignFixture.data.id] });

    const ownRead = await first.client.from(table).select("id").eq("id", ownFixture.data.id);
    assert.ifError(ownRead.error);
    assert.equal(ownRead.data.length, 1, "Player can read their own canonical history");

    const foreignRead = await first.client.from(table).select("id").eq("id", foreignFixture.data.id);
    assert.ifError(foreignRead.error);
    assert.deepEqual(foreignRead.data, [], "RLS must hide another user's canonical history");

    const forgedInsert = await first.client.from(table).insert({
      user_id: first.id,
      event_type: "FORGED_QA_EVENT",
      title: "FORGED HISTORY",
      xp_delta: 9999,
      metadata: {},
    }).select("id");
    assert.ok(forgedInsert.error, "Authenticated clients must not forge canonical history");

    const forgedUpdate = await first.client.from(table).update({
      title: "TAMPERED HISTORY",
      xp_delta: 9999,
    }).eq("id", ownFixture.data.id).select("id");
    assert.ok(forgedUpdate.error, "Authenticated clients must not rewrite canonical history");

    const forgedDelete = await first.client.from(table).delete().eq("id", ownFixture.data.id).select("id");
    assert.ok(forgedDelete.error, "Authenticated clients must not erase canonical history");
  }

  const bossFixture = await admin.from("boss_quests").insert({
    user_id: first.id,
    title: "LOCAL QA BOSS",
    rank: "C",
    category: "DISCIPLINE",
    status: "ACTIVE",
    xp_reward: 0,
    max_hp: 100,
    hp: 100,
    system_assigned: true,
  }).select("id").single();
  assert.ifError(bossFixture.error);

  const forgedBossDamage = await first.client.from("boss_damage_events").insert({
    user_id: first.id,
    boss_quest_id: bossFixture.data.id,
    source_type: "FORGED_QA_DAMAGE",
    damage: 999,
    hp_before: 100,
    hp_after: 0,
    metadata: {},
  }).select("id");
  assert.ok(forgedBossDamage.error, "Authenticated clients must not forge boss damage history");

  const forgedXp = await first.client.rpc("system_award_xp", {
    p_amount: 9999,
    p_source: "LOCAL_QA_FORGED",
    p_title: "FORGED XP",
    p_metadata: {},
  });
  assert.ok(forgedXp.error, "Players must not call the internal XP award helper");

  const forgedAttribute = await first.client.rpc("system_add_attribute", {
    p_attribute: "STRENGTH",
    p_delta: 99,
    p_source: "LOCAL_QA_FORGED",
    p_title: "FORGED ATTRIBUTE",
    p_metadata: {},
  });
  assert.ok(forgedAttribute.error, "Players must not call the internal attribute award helper");

  const reset = await first.client.functions.invoke("system-api", {
    body: { action: "delete_player_data" },
  });
  assert.ifError(reset.error);
  assert.equal(reset.data.data.profile_deleted, true);
  assert.equal(reset.data.data.auth_account_preserved, true);

  const survivingAuth = await first.client.auth.getUser();
  assert.ifError(survivingAuth.error);
  assert.equal(survivingAuth.data.user.id, first.id, "Character reset must preserve the Auth account");

  const removedProfile = await admin.from("profiles").select("id").eq("id", first.id);
  assert.ifError(removedProfile.error);
  assert.deepEqual(removedProfile.data, [], "Character reset must remove the old profile");

  for (const fixture of historyFixtures) {
    const ownRows = await admin.from(fixture.table).select("id").eq("id", fixture.ids[0]);
    assert.ifError(ownRows.error);
    assert.deepEqual(ownRows.data, [], "Character reset must remove the player's history");
    const otherRows = await admin.from(fixture.table).select("id").eq("id", fixture.ids[1]);
    assert.ifError(otherRows.error);
    assert.equal(otherRows.data.length, 1, "Character reset must not delete another player's history");
  }

  const remainingProofs = await admin.storage.from("proofs").list(first.id, { limit: 100 });
  assert.ifError(remainingProofs.error);
  assert.deepEqual(remainingProofs.data, [], "Character reset must remove private proof files");

  const remainingClips = await admin.storage.from("class-special-clips").list(first.id, { limit: 100 });
  assert.ifError(remainingClips.error);
  assert.deepEqual(remainingClips.data, [], "Character reset must recursively remove private class clips");

  console.log(JSON.stringify({
    status: "passed",
    checks: [
      "real local Auth signup and password session",
      "authenticated profile initialization",
      "authenticated Edge Function health and user binding",
      "authenticated Edge Function bootstrap and profile hydration",
      "identity persistence in profile_data",
      "cross-user profile isolation by RLS",
      "unauthenticated profile initialization rejected",
      "private proof upload and owner download",
      "cross-user proof download denied",
      "service-side signed URL creation",
      "owner-only reads for progression and journey history",
      "direct progression and journey history writes, updates and deletes rejected",
      "direct boss damage history writes rejected",
      "direct XP and attribute award helpers rejected",
      "complete character reset removes user data and private proof and nested class-clip files",
      "character reset preserves Auth account and other players data",
    ],
  }, null, 2));
} finally {
  if (uploaded.length) await admin.storage.from("proofs").remove(uploaded);
  if (uploadedClips.length) await admin.storage.from("class-special-clips").remove(uploadedClips);
  for (const fixture of historyFixtures) {
    await admin.from(fixture.table).delete().in("id", fixture.ids);
  }
  for (const id of users) await admin.auth.admin.deleteUser(id);
}
