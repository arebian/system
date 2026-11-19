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
    assert.ifError(forgedUpdate.error);
    assert.deepEqual(forgedUpdate.data, [], "Authenticated clients must not rewrite canonical history");
  }

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
      "direct progression and journey history writes rejected",
      "direct XP and attribute award helpers rejected",
    ],
  }, null, 2));
} finally {
  if (uploaded.length) await admin.storage.from("proofs").remove(uploaded);
  for (const fixture of historyFixtures) {
    await admin.from(fixture.table).delete().in("id", fixture.ids);
  }
  for (const id of users) await admin.auth.admin.deleteUser(id);
}
