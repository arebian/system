const assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const path=require('node:path');
const fs=require('node:fs');
const root=path.resolve(__dirname,'../..');
const output=path.join(root,'test-results');fs.mkdirSync(output,{recursive:true});
const {chromium}=require('playwright');
const mock=`
const path=new URLSearchParams(location.search).get('class');
const config={COMMANDER:[30,35,'CHARISMA','COMMAND PRESENCE'],TANK:[0,45,'STRENGTH','IRON LEDGER'],ASSASSIN:[1500,40,'FOCUS','SILENT TARGET'],RANGER:[1200,40,'ENDURANCE','TRAIL MARKER']};
const [target,xp,attr,title]=config[path]||[0,0,'','THE GRAND ARCHIVE'];
window.calls=[];window.mockState={class:path,server_now:new Date().toISOString(),policy:{target_seconds:target,xp_reward:xp,attribute_reward:attr},session:null,recent:[],completed_today:null};
function snapshot(){return structuredClone({...window.mockState,server_now:new Date().toISOString()});}
export async function loadClassSpecial(){window.calls.push('load');return snapshot();}
export async function startClassSpecial(){window.calls.push('start');window.mockState.session||={id:'00000000-0000-4000-8000-000000000001',user_id:'qa-user',class:path,title,status:'ACTIVE',target_seconds:target,started_at:new Date().toISOString(),expires_at:new Date(Date.now()+86400000).toISOString(),xp_reward:xp,attribute_reward:attr};return snapshot();}
export async function cancelClassSpecial(){window.calls.push('cancel');window.mockState.session=null;return snapshot();}
export async function completeClassSpecial(id,result){window.calls.push('complete');if(window.rejectNext){window.rejectNext=false;throw new Error('CONNECTION_TEMPORARILY_UNAVAILABLE');}window.submitted=result;const session={...window.mockState.session,status:'COMPLETED',completed_at:new Date().toISOString(),result};window.mockState.completed_today=session;window.mockState.session=null;return {session,reward_awarded:true};}
export async function uploadClassSpecialClip(){window.calls.push('upload');return 'qa-user/session/clip.webm';}
export async function deleteClassSpecialClip(){window.calls.push('delete');}
`;
(async()=>{
 const {createServer}=await import(path.join(root,'node_modules/vite/dist/node/index.js'));
 const server=await createServer({root,server:{host:'127.0.0.1',port:5180,strictPort:true}});await server.listen();
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--no-zygote'],headless:true});
 const report=[];
 try {
 for(const cls of ['COMMANDER','TANK','ASSASSIN','RANGER','MAGE']){
   const page=await browser.newPage({viewport:{width:1280,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/src/systemClassSpecialApi.js*',r=>r.fulfill({contentType:'text/javascript',body:mock}));
   await page.clock.install();
   await page.goto(`http://127.0.0.1:5180/tests/browser/class-special-harness.html?class=${cls}`);
   await page.waitForSelector('.class-special-workspace,.class-training-route');
   if(cls==='TANK'){
     await page.getByRole('button',{name:'START STRENGTH LOG'}).click();
     await page.getByPlaceholder('e.g. Bodyweight squat').fill('Bodyweight squat');
     for(let i=1;i<=3;i++)await page.getByLabel(`Set ${i} reps`,{exact:true}).fill('12');
     await page.locator('textarea').fill('Kept a controlled pace and improved my form on set three.');
     await page.evaluate(()=>window.rejectNext=true);
     await page.getByRole('button',{name:'SAVE PRACTICE & CLAIM REWARD'}).click();
     await page.getByRole('alert').waitFor();
     assert.equal(await page.getByPlaceholder('e.g. Bodyweight squat').inputValue(),'Bodyweight squat');
     await page.getByRole('button',{name:'SAVE PRACTICE & CLAIM REWARD'}).click();
     await page.getByText('TODAY’S SPECIAL COMPLETE',{exact:true}).waitFor();
     assert.equal((await page.evaluate(()=>window.submitted.sets)).length,3);
   } else if(cls==='ASSASSIN'){
     await page.getByRole('button',{name:'START 25-MINUTE FOCUS BLOCK'}).click();
     await page.getByLabel('Focus countdown').waitFor();
     assert.equal(await page.getByRole('button',{name:'SAVE PRACTICE & CLAIM REWARD'}).isDisabled(),true);
     await page.clock.fastForward(1500001);
     await page.waitForFunction(()=>document.querySelector('output')?.textContent==='00:00');
     await page.locator('textarea').fill('Finished the supplier report and checked all of the totals.');
     await page.screenshot({path:path.join(output,'assassin-timer.png'),fullPage:true});
     await page.getByRole('button',{name:'SAVE PRACTICE & CLAIM REWARD'}).click();
     await page.getByText('TODAY’S SPECIAL COMPLETE',{exact:true}).waitFor();
   } else if(cls==='RANGER'){
     await page.getByRole('button',{name:'OPEN GPS TRACKER'}).click();
     assert.equal(await page.evaluate(()=>window.selectedTab),'training');
     assert.equal(await page.evaluate(()=>window.savedProfile.activeGpsMission.source),'CLASS_SPECIAL');
     await page.clock.fastForward(1201000);
     await page.evaluate(()=>window.mockState.gps_candidate={id:'gps-test',distance_km:1.2,duration_seconds:1201});
     await page.getByRole('button',{name:'REFRESH ROUTE STATUS'}).click();
     await page.getByRole('button',{name:'SAVE PRACTICE & CLAIM REWARD'}).click();
     await page.getByText('TODAY’S SPECIAL COMPLETE',{exact:true}).waitFor();
     assert.equal(await page.evaluate(()=>window.submitted.gps_session_id),'gps-test');
   } else if(cls==='COMMANDER'){
     await page.evaluate(()=>{
       const canvas=document.createElement('canvas');canvas.width=320;canvas.height=240;
       const stream=canvas.captureStream();
       Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>stream});
       window.MediaRecorder=class { static isTypeSupported(t){return t==='video/mp4';}constructor(){this.mimeType='video/mp4';this.state='inactive';}start(){this.state='recording';}stop(){this.state='inactive';queueMicrotask(()=>{this.ondataavailable?.({data:new Blob(['recording-fixture'],{type:'video/mp4'})});this.onstop?.();});}};
     });
     await page.getByRole('button',{name:'START FRONT-CAMERA RECORDING'}).click();
     await page.clock.fastForward(10000);
     await page.getByRole('button',{name:'STOP & REVIEW RECORDING'}).click();
     assert.equal(await page.getByRole('button',{name:'SAVE PRACTICE & CLAIM REWARD'}).isDisabled(),true);
     await page.getByRole('button',{name:'× DISCARD CLIP & RETAKE'}).click();
     assert.equal(await page.locator('video[controls]').count(),0);
     assert.equal(await page.evaluate(()=>window.calls.includes('upload')),false);
     await page.getByRole('button',{name:'START FRONT-CAMERA RECORDING'}).click();
     await page.clock.fastForward(31000);
     await page.getByRole('button',{name:'STOP & REVIEW RECORDING'}).click();
     await page.locator('textarea').fill('I held eye contact while explaining my idea and will slow down next time.');
     await page.getByRole('button',{name:'SAVE PRACTICE & CLAIM REWARD'}).click();
     await page.getByText('TODAY’S SPECIAL COMPLETE',{exact:true}).waitFor();
     assert.ok(await page.evaluate(()=>window.submitted.duration_seconds>=30));
   }else{
     await page.getByRole('button',{name:'OPEN ARCHIVE'}).click();
     assert.equal(await page.evaluate(()=>window.selectedTab),'archive');
   }
   assert.deepEqual(errors,[]);report.push({class:cls,workflow:'passed'});
   await page.close();
 }
 for(const cls of ['COMMANDER','TANK','ASSASSIN','RANGER','MAGE']){
   const page=await browser.newPage({viewport:{width:390,height:844}});
   await page.route('**/src/systemClassSpecialApi.js*',r=>r.fulfill({contentType:'text/javascript',body:mock}));
   await page.goto(`http://127.0.0.1:5180/tests/browser/class-special-harness.html?class=${cls}&theme=light`);
   await page.waitForSelector('.class-special-workspace,.class-training-route');
   if(cls==='TANK'){await page.getByRole('button',{name:'START STRENGTH LOG'}).click();await page.getByPlaceholder('e.g. Bodyweight squat').waitFor();}
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,cls+' overflows mobile');
   await page.screenshot({path:path.join(output,`${cls.toLowerCase()}-mobile.png`),fullPage:true});
   report.push({class:cls,mobileLight:'passed'});await page.close();
 }
 fs.writeFileSync(path.join(output,'browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();await server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
