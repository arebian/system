const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..');
const output=path.join(root,'test-results');fs.mkdirSync(output,{recursive:true});
const cloudExports=[...fs.readFileSync(path.join(root,'src/systemCloud.js'),'utf8').matchAll(/^export (?:async )?function (\w+)/gm)].map(m=>m[1]);
const special=['loadClassSpecial','startClassSpecial','cancelClassSpecial','completeClassSpecial','uploadClassSpecialClip','deleteClassSpecialClip'].map(name=>`export async function ${name}(){return {class:window.qaProfile.path,server_now:new Date().toISOString(),policy:{target_seconds:1500},recent:[],session:null};}`).join('\n');
const overrides={
 bootstrapAuthoritativeProfile:'return window.qaProfile;',hydrateStructuredProfile:'return window.qaProfile;',saveCloudPreferences:'return {};',
 loadTrainingCatalog:'return {skills:[],workouts:[]};',
 loadDailyCommandBrief:`return {status:'READY',assigned_for:new Date().toLocaleDateString('en-CA'),progress:{class:window.qaProfile.path,level:1,streak:0,unspent_credits:0},class_directive:{title:'QA CLASS ACTION',objective:'A real class action',xp:30}};`,
 loadMageArchive:`const books=fallbackArchiveBooks('S').map(b=>({...b,fallback:false}));const book=books.find(b=>b.embedded_reader_key===new URLSearchParams(location.search).get('book'))||books[1];return {knowledge_rank:'S',active_book_id:book.id,books_completed:0,books};`,
 getSystemIntelligenceStatus:`return {online:false,model_connected:false};`,getSystemIntelligenceContext:'return {profile:window.qaProfile};',getSystemIntelligenceHistory:'return [];',loadAttributeCredits:'return [];',evaluateAdaptiveQuest:'return {quest:null};',
};
const cloud=`import {fallbackArchiveBooks} from '/src/systemArchiveFallback.js';\n`+cloudExports.map(name=>`export async function ${name}(...args){${overrides[name]||'return {};'}}`).join('\n');
const auth=`export const supabase={auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signInWithPassword:async()=>({error:{message:'Invalid login credentials'}}),signUp:async()=>({data:{session:null}}),signInWithOAuth:async()=>({error:{message:'provider not enabled'}})},rpc:async()=>({data:null,error:null})};`;
(async()=>{
 const {createServer}=await import(path.join(root,'node_modules/vite/dist/node/index.js'));
 const server=await createServer({root,server:{host:'127.0.0.1',port:5182,strictPort:true}});await server.listen();
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--no-zygote'],headless:true});
 const report=[];
 try {
  const context=await browser.newContext();
  await context.route('**/src/systemCloud.js*',r=>r.fulfill({contentType:'text/javascript',body:cloud}));
  await context.route('**/src/supabaseClient.js*',r=>r.fulfill({contentType:'text/javascript',body:auth}));
  await context.route('**/src/systemClassSpecialApi.js*',r=>r.fulfill({contentType:'text/javascript',body:special}));
  for(const viewport of [{width:1440,height:980},{width:390,height:844}]) {
   const page=await context.newPage();await page.setViewportSize(viewport);const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:5182/tests/browser/launch-harness.html?auth');
   await page.getByLabel('EMAIL ADDRESS').fill('qa@example.invalid');
   await page.getByLabel('PASSWORD',{exact:true}).fill('secret-test-fixture');
   await page.getByRole('button',{name:'Show password'}).click();
   assert.equal(await page.locator('#access-password').getAttribute('type'),'text');
   await page.getByRole('button',{name:'ENTER THE SYSTEM'}).click();
   await page.getByText(/weren’t recognized/).waitFor();
   assert.equal(await page.getByLabel('EMAIL ADDRESS').inputValue(),'qa@example.invalid');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:path.join(output,`login-${viewport.width}.png`),fullPage:true});
   assert.deepEqual(errors,[]);await page.close();
   report.push({login:viewport.width,errorRecovery:'passed'});
  }
  for(const cls of ['COMMANDER','TANK','ASSASSIN','RANGER','MAGE']) {
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`http://127.0.0.1:5182/tests/browser/launch-harness.html?class=${cls}`);
   await page.locator('.navigation').waitFor();
   for(const tab of ['ATTRIBUTES','QUESTS','TRAINING','CLASS SPECIAL','FUEL SYSTEM','PROGRESS','INVENTORY','JOURNEY','TROPHY ROOM','SYSTEM']) {
     await page.locator('.navigation button').filter({hasText:tab==='SYSTEM' ? /^(?:⌁\s*)?SYSTEM$/ : new RegExp(tab+'$')}).click();
     await page.waitForTimeout(80);
     assert.equal(await page.locator('.system-runtime-failure,.system-section-recovery').count(),0,cls+' '+tab+' crashed');
   }
   await page.getByRole('button',{name:'Open System Intelligence',exact:true}).click();
   await page.locator('.system-intelligence-float-panel').waitFor();
   assert.deepEqual(errors,[]);await page.close();report.push({class:cls,navigation:'passed'});console.log(cls+' navigation passed');
  }
  const books=JSON.parse(fs.readFileSync(path.join(root,'public/books/text/manifest.json'),'utf8')).editions;
  for(const book of books) {
   if(book.key==='the-art-of-war') continue; // PDF header/content checked by unit suite.
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`http://127.0.0.1:5182/tests/browser/launch-harness.html?class=MAGE&book=${book.key}`);
   await page.locator('.navigation button').filter({hasText:'GRAND ARCHIVE'}).click();
   await page.getByRole('button',{name:'READ NOW',exact:true}).first().click();
   await page.locator('.mage-reader-native-copy').waitFor();
   const first=await page.locator('.mage-reader-native-copy').textContent();
   await page.locator('.mage-reader-page-control button').filter({hasText:'→'}).click();
   assert.notEqual(await page.locator('.mage-reader-native-copy').textContent(),first);
   assert.equal(await page.locator('.mage-reader-page-control input').inputValue(),'2');
   assert.equal(await page.locator('.mage-reader-stage iframe').count(),0);
   if(book.key==='the-alchemist') await page.screenshot({path:path.join(output,'archive-reader.png')});
   assert.deepEqual(errors,[]);await page.close();console.log(book.key+' reader passed');
  }
  report.push({nativeReaders:30,pageTurns:'passed'});
  fs.writeFileSync(path.join(output,'launch-browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 } finally {await browser.close();await server.close();}
})().catch(error=>{console.error(error);process.exit(1)});
