const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
(async () => {
 const root=path.resolve(__dirname,'../..');
 const {createServer}=await import(path.join(root,'node_modules/vite/dist/node/index.js'));
 const server=await createServer({root,server:{host:'127.0.0.1',port:5187,strictPort:true}});
 await server.listen();
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const report=[];
 const cloud=`
 let rows=[];
 const tasks=[
  {id:'timer-task',pillar:'PHYSICAL',title:'FOCUSED MOVEMENT',objective:'Complete a focused movement session and record what improved.',difficulty:'NORMAL',duration_minutes:1,xp_reward:20,proof_type:'TIMER'},
  {id:'photo-task',pillar:'INTELLECT',title:'READ AND CAPTURE',objective:'Read a short section and capture a useful takeaway.',difficulty:'NORMAL',duration_minutes:10,xp_reward:25,proof_type:'PHOTO'},
  {id:'note-task',pillar:'DISCIPLINE',title:'PLAN TOMORROW',objective:'Prepare tomorrow\'s priorities and record the result.',difficulty:'NORMAL',duration_minutes:5,xp_reward:15,proof_type:'NOTE'},
  {id:'social-task',pillar:'SOCIAL',title:'REACH OUT',objective:'Make a thoughtful connection and record the outcome.',difficulty:'NORMAL',duration_minutes:5,xp_reward:15,proof_type:'NOTE'}
 ];
 export async function fetchQuestTaskLibrary(){return tasks;}
 export async function fetchQuestObjectives(){return rows;}
 export async function proposeQuestObjectivesOnBackend({taskIds}){rows=taskIds.map((id,i)=>{const t=tasks.find(x=>x.id===id);return {id:'objective-'+id,task_id:id,pillar:t.pillar,title_snapshot:t.title,objective_snapshot:t.objective,difficulty:t.difficulty,duration_minutes:t.duration_minutes,xp_reward:t.xp_reward,proof_type:t.proof_type,status:'PROPOSED'};});return {objectives:rows};}
 export async function decideQuestObjectiveOnBackend({objectiveId,decision}){const status=decision==='ACCEPT'?'ACCEPTED':'REJECTED';rows=rows.map(x=>x.id===objectiveId?{...x,status}:x);return {status};}
 export async function fetchQuestObjectiveTimer(id){return window.qaTimers?.[id]||null;}
 export async function startQuestObjectiveTimer(id){const item=rows.find(x=>x.id===id);const session={id:'timer-'+id,objective_id:id,status:'RUNNING',started_at:new Date(Date.now()-item.duration_minutes*60000-2000).toISOString(),elapsed_seconds:0};window.qaTimers={...(window.qaTimers||{}),[id]:session};return session;}
 export async function finishQuestObjectiveTimer(id){const session=Object.values(window.qaTimers||{}).find(x=>x.id===id);const done={...session,status:'COMPLETED',elapsed_seconds:session?60:0};window.qaTimers={...window.qaTimers,[session.objective_id]:done};return {session:done};}
 export async function uploadProofImage(file){window.qaUploadedFile={name:file.name,type:file.type};return {path:'qa-private/'+file.name};}
 export async function completeQuestObjectiveOnBackend({objectiveId}){rows=rows.map(x=>x.id===objectiveId?{...x,status:'COMPLETED'}:x);window.qaXpClaims=(window.qaXpClaims||0)+1;return {objective:rows.find(x=>x.id===objectiveId)};}
 export async function bootstrapAuthoritativeProfile(){return {id:'qa-profile'};}
 export async function hydrateStructuredProfile(x){return x;}
 `;
 const api=`
 export async function reviewQuestObjectiveOnBackend(args){
  window.qaReviewCalls=(window.qaReviewCalls||[]).concat([args]);
  if(args.imagePath && !window.qaPhotoClarified){window.qaPhotoClarified=true;return {id:'photo-clarify',decision:'CLARIFY',reason:'Add the key takeaway from the page.',question:'What did you learn?'};}
  return {id:'review-'+window.qaReviewCalls.length,decision:'APPROVE',reason:'Evidence meets the objective.',question:''};
 }
 `;
 try {
  for(const width of [390,1440]){
   const context=await browser.newContext({viewport:{width,height:960},reducedMotion:'reduce'});
   await context.route('**/src/systemCloud.js*',r=>r.fulfill({contentType:'text/javascript',body:cloud}));
   await context.route('**/src/systemLivingApi.js*',r=>r.fulfill({contentType:'text/javascript',body:api}));
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:5187/tests/browser/objective-harness.html');
   await page.getByText('MINI-QUEST OBJECTIVES').waitFor();
   const generate=page.getByRole('button',{name:'GENERATE 3 OBJECTIVES'});
   await generate.waitFor({state:'visible'});await generate.click();
   await page.getByText('FOCUSED MOVEMENT').waitFor();
   assert.equal(await page.locator('.quest-objective-item').count(),3);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
   // Reject one proposal, then replace it without losing accepted objectives.
   const cards=page.locator('.quest-objective-item');
   await cards.nth(2).getByRole('button',{name:'REJECT'}).click();
   await cards.nth(0).getByRole('button',{name:'ACCEPT'}).click();
   await cards.nth(1).getByRole('button',{name:'ACCEPT'}).click();
   await page.getByRole('button',{name:'GENERATE 1 REPLACEMENT OBJECTIVE'}).waitFor();
   await page.getByRole('button',{name:'GENERATE 1 REPLACEMENT OBJECTIVE'}).click();
   await page.getByText('SYSTEM recommendations are ready. Review each objective before accepting.').waitFor();
   assert.equal(await page.locator('.quest-objective-item').count(),3);
   const timerCard=page.locator('.quest-objective-item').filter({hasText:'FOCUSED MOVEMENT'});
   await timerCard.getByRole('button',{name:/START .* VERIFIED TIMER/}).click();
   await timerCard.getByRole('button',{name:'VERIFY TIMER COMPLETION'}).waitFor({state:'visible'});
   await timerCard.getByRole('button',{name:'VERIFY TIMER COMPLETION'}).click();
   await timerCard.getByText(/SERVER TIMER VERIFIED/).waitFor();
   await timerCard.locator('textarea').fill('Completed the planned movement session and improved my form.');
   await timerCard.getByRole('button',{name:'SUBMIT TIMER FOR AI REVIEW'}).click();
   await timerCard.getByText('APPROVE // SYSTEM REVIEW').waitFor();
   await timerCard.getByRole('button',{name:/CONFIRM & CLAIM/}).click();
   await timerCard.getByText(/SERVER XP RECORDED/).waitFor();
   const photoCard=page.locator('.quest-objective-item').filter({hasText:'READ AND CAPTURE'});
   await photoCard.locator('input[type=file]').setInputFiles({name:'proof.png',mimeType:'image/png',buffer:Buffer.from('fake image bytes')});
   await photoCard.getByText('PHOTO ATTACHED').waitFor();
   await photoCard.locator('textarea').fill('I read the chapter and captured the main lesson.');
   await photoCard.getByRole('button',{name:'SUBMIT EVIDENCE FOR AI REVIEW'}).click();
   await photoCard.getByText('CLARIFY // SYSTEM REVIEW').waitFor();
   await photoCard.locator('textarea').fill('I read the chapter and learned how to structure a clear daily plan.');
   await photoCard.getByRole('button',{name:'SUBMIT EVIDENCE FOR AI REVIEW'}).click();
   await photoCard.getByText('APPROVE // SYSTEM REVIEW').waitFor();
   await photoCard.getByRole('button',{name:/CONFIRM & CLAIM/}).click();
   await photoCard.getByText(/SERVER XP RECORDED/).waitFor();
   assert.equal(await page.evaluate(()=>window.qaXpClaims),2);
   assert.equal(await page.evaluate(()=>window.qaReviewCalls.length),3);
   assert.equal(await page.evaluate(()=>window.qaUploadedFile.type),'image/png');
   assert.deepEqual(errors,[]);
   report.push({viewport:width,objectiveGeneration:'passed',rejectAndReplacement:'passed',verifiedTimer:'passed',photoUploadAndClarification:'passed',explicitXpClaims:'passed',horizontalOverflow:false,consoleErrors:errors});
   await context.close();
  }
  console.log(JSON.stringify(report));
 } finally {await browser.close();await server.close();}
})().catch(e=>{console.error(e);process.exit(1);});