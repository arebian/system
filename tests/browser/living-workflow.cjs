const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
const output = path.join(root, 'test-results');
fs.mkdirSync(output, { recursive: true });
const cloudExports = [...fs.readFileSync(path.join(root, 'src/systemCloud.js'), 'utf8').matchAll(/^export (?:async )?function (\w+)/gm)].map(m => m[1]);
const cloud = cloudExports.map(name => `export async function ${name}(args){${['bootstrapAuthoritativeProfile','hydrateStructuredProfile'].includes(name) ? 'return window.qaProfile;' : name === 'setInventoryStateOnBackend' ? 'window.qaSetEquipment(args);return {};' : 'return {};'}}`).join('\n');
const api = `
import {buildWeeklyPlan} from '/supabase/functions/_shared/weeklyBossCore.js';
export async function reviewQuestOnBackend({proof,verificationMode}){
 window.qaVerificationMode=verificationMode;
 if(verificationMode==='SELF_REPORTED')return {id:'self-review',decision:'APPROVE',reason:'Completion recorded as self-reported. No AI verification was performed.'};
 if(window.qaOffline)throw new Error('Connection interrupted. Please retry.');
 window.qaLastEvidence=proof;
 return proof.detail.includes('25')?{id:'review-1',decision:'APPROVE',reason:'You exceeded the reading target.',question:''}:{decision:'INCOMPLETE',reason:'Ten minutes remain.',question:'How many minutes did you read in total?'};
}
export async function livingSystemAction(action,p={}){
 const state=window.qaWeeklyState;
 if(action==='weekly_boss_status')return structuredClone(state);
 if(action==='prepare_weekly_boss'){window.qaDraft={id:'draft-1',plan:buildWeeklyPlan(p.intake,10)};return structuredClone(window.qaDraft);}
 if(action==='accept_weekly_boss'){
  const plan=window.qaDraft.plan;state.can_assign=false;
  state.active={id:42,title:plan.title,status:'ACTIVE',xp_reward:plan.reward.xp,deadline:new Date(Date.now()+604800000).toISOString(),metadata:{kind:'WEEKLY_PREPARATION',weekly_plan:plan},objectives:plan.steps.map((s,i)=>({id:i+1,position:i+1,is_complete:false}))};
  window.qaProfile.bossQuests=[{id:'BOSS-42',name:plan.title,status:'ACTIVE',xp:plan.reward.xp,metadata:state.active.metadata}];return {boss:state.active};
 }
 if(action==='weekly_boss_checkpoint'){state.active.objectives.find(o=>o.id===p.objective_id).is_complete=p.complete;return {};}
 if(action==='review_weekly_boss')return {id:'boss-review',decision:p.proof.detail.includes('7')?'APPROVE':'INCOMPLETE',reason:'Result assessed.',question:''};
 if(action==='complete_weekly_boss'){
  window.qaCompletions++;state.latest={...state.active,status:'COMPLETE'};state.active=null;state.next_available_at=new Date(Date.now()+604800000).toISOString();
  window.qaProfile.bossQuests[0].status='COMPLETE';window.qaProfile.attributes.DISCIPLINE+=4;return {resolved:true};
 }
 return {};
}`;
(async () => {
  const { createServer } = await import(path.join(root, 'node_modules/vite/dist/node/index.js'));
  const server = await createServer({ root, server: { host: '127.0.0.1', port: 5186, strictPort: true } });
  await server.listen();
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, headless: true, args: ['--no-sandbox','--disable-dev-shm-usage'] });
  const report = [];
  try {
    for (const width of [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 960 }, reducedMotion: 'reduce' });
      await context.route('**/src/systemCloud.js*', route => route.fulfill({ contentType: 'text/javascript', body: cloud }));
      await context.route('**/src/systemLivingApi.js*', route => route.fulfill({ contentType: 'text/javascript', body: api }));
      await context.route('**/src/supabaseClient.js*', route => route.fulfill({ contentType: 'text/javascript', body: 'export const supabase={auth:{getSession:async()=>({data:{session:null}})},rpc:async()=>({data:null,error:null})};' }));
      const page = await context.newPage();
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto('http://127.0.0.1:5186/tests/browser/living-harness.html?mode=celebration');
      const dialog = page.getByRole('dialog'); await dialog.waitFor();
      assert.equal(await dialog.getByText('D-RANK', { exact: true }).count(), 1);
      assert.equal(await page.evaluate(() => window.qaSounds), 1, 'Strict Mode must not replay sound');
      await page.screenshot({ path: path.join(output, `rank-celebration-${width}.png`) });
      await page.keyboard.press('Escape'); await page.getByText('QA flow complete').waitFor();
      await page.goto('http://127.0.0.1:5186/tests/browser/living-harness.html?mode=proof');
      assert.equal(await page.getByLabel('COMPLETION METHOD').inputValue(), 'SELF_REPORTED');
      await page.getByLabel('RESULT NOTE — OUTCOME').fill('Completed the required reps.');
      await page.getByRole('button', { name: 'COMPLETE QUEST · SELF-REPORTED', exact: true }).click();
      await page.getByText('CONFIRM THAT THE OBJECTIVE IS COMPLETE BEFORE SUBMITTING.').waitFor();
      assert.equal(await page.evaluate(() => window.qaCompletions), 0);
      await page.getByRole('checkbox').check();
      await page.getByRole('button', { name: 'COMPLETE QUEST · SELF-REPORTED', exact: true }).dblclick();
      await page.getByText('QA flow complete').waitFor();
      assert.equal(await page.evaluate(() => window.qaSubmittedProof.verificationMode), 'SELF_REPORTED');
      assert.equal(await page.evaluate(() => window.qaCompletions), 1);
      await page.goto('http://127.0.0.1:5186/tests/browser/living-harness.html?mode=proof');
      await page.getByLabel('COMPLETION METHOD').selectOption('AI');
      await page.getByLabel('RESULT NOTE — OUTCOME').fill('red 10 mins');
      await page.getByRole('button', { name: 'SUBMIT PROOF', exact: true }).click();
      await page.getByText('Ten minutes remain.').waitFor();
      assert.equal(await page.getByLabel('RESULT NOTE — OUTCOME').inputValue(), 'red 10 mins');
      await page.getByLabel('ANSWER THE SYSTEM').fill('25 mins total, finshed chapter 3');
      await page.evaluate(() => { window.qaOffline = true; });
      await page.getByRole('button', { name: 'SUBMIT PROOF', exact: true }).click();
      await page.getByText('Connection interrupted. Please retry.').waitFor();
      assert.equal(await page.getByLabel('ANSWER THE SYSTEM').inputValue(), '25 mins total, finshed chapter 3');
      await page.screenshot({ path: path.join(output, `proof-follow-up-${width}.png`), fullPage: true });
      await page.evaluate(() => { window.qaOffline = false; });
      await page.getByRole('button', { name: 'SUBMIT PROOF', exact: true }).dblclick();
      await page.getByText('QA flow complete').waitFor();
      assert.equal(await page.evaluate(() => window.qaCompletions), 1);
      assert.match(await page.evaluate(() => window.qaSubmittedProof.detail), /red 10 mins.*\nAdditional detail: 25 mins/);
      await page.goto('http://127.0.0.1:5186/tests/browser/living-harness.html?mode=boss');
      await page.getByRole('button', { name: 'PREPARE MY WEEKLY BOSS', exact: true }).click();
      await page.getByRole('heading', { name: 'PREPARE YOUR FUEL', exact: true }).waitFor();
      await page.screenshot({ path: path.join(output, `weekly-plan-${width}.png`), fullPage: true });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.getByRole('button', { name: 'ACCEPT THIS BOSS', exact: true }).click();
      const checks = page.locator('.weekly-check input'); await checks.first().waitFor();
      assert.equal(await page.getByRole('button', { name: 'SUBMIT FINISHED RESULT', exact: true }).isDisabled(), true);
      for (let i = 0; i < 4; i++) { await checks.nth(i).check(); await page.getByRole('button', { name: 'REFRESH STATUS', exact: true }).waitFor({ state: 'visible' }); await page.waitForFunction(() => !document.querySelector('.weekly-boss').getAttribute('aria-busy') || document.querySelector('.weekly-boss').getAttribute('aria-busy') === 'false'); }
      await page.getByLabel('YOUR RESULT', { exact: true }).fill('7 breakfasts done, 3 chilled and 4 frozen in labelled containers.');
      await page.getByRole('button', { name: 'SUBMIT FINISHED RESULT', exact: true }).click();
      await page.getByText('Boss defeated. Your preparation and rewards are recorded.').waitFor();
      assert.equal(await page.evaluate(() => window.qaCompletions), 1);
      assert.equal(await page.evaluate(() => window.qaAppliedProfile.bossQuests[0].status), 'COMPLETE');
      await page.goto('http://127.0.0.1:5186/tests/browser/living-harness.html?mode=inventory');
      await page.locator('.loot-card').first().click();
      await page.getByRole('button', { name: 'EQUIP', exact: true }).click();
      await page.getByRole('button', { name: 'UNEQUIP', exact: true }).waitFor();
      await page.getByLabel('Active equipment bonuses').getByText('+5 SPEED', { exact: true }).waitFor();
      assert.equal(await page.evaluate(() => window.qaAppliedProfile.attributes.SPEED), 12);
      await page.getByRole('button', { name: 'UNEQUIP', exact: true }).click();
      await page.getByRole('button', { name: 'EQUIP', exact: true }).waitFor();
      assert.equal(await page.evaluate(() => window.qaAppliedProfile.equipment.bonuses.SPEED), 0);
      await page.goto('http://127.0.0.1:5186/tests/browser/living-harness.html?mode=music');
      await page.getByRole('button', { name: 'PLAY TEST MUSIC' }).click();
      await page.getByText('PLAYING', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'ASSASSIN TRACK' }).click();
      await page.getByText('PLAYING', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'PAUSE TEST MUSIC' }).click();
      await page.getByText('PAUSED', { exact: true }).waitFor();
      await page.goto('http://127.0.0.1:5186/tests/browser/living-harness.html?mode=appearance');
      assert.ok(await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.class-emblem-atmosphere')).opacity) >= 0.15));
      await page.screenshot({ path: path.join(output, `assassin-light-${width}.png`), fullPage: true });
      assert.deepEqual(errors, []);
      report.push({ width, rankReveal: 'passed', proofRecovery: 'passed', weeklyBoss: 'passed', equipment: 'passed', audio: 'passed', assassinLight: 'passed', errors });
      await context.close();
    }
    fs.writeFileSync(path.join(output, 'living-browser-report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally { await browser.close(); await server.close(); }
})().catch(error => { console.error(error); process.exit(1); });
