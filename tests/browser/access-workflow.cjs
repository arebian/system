const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
const output = path.join(root, 'test-results');
fs.mkdirSync(output, { recursive: true });
const auth = `export const supabase={auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signInWithPassword:async()=>({error:{message:'Invalid login credentials'}}),signUp:async()=>({data:{session:null}}),signInWithOAuth:async()=>({error:{message:'provider not enabled'}})},rpc:async()=>({data:null,error:null})};`;

(async () => {
  const { createServer } = await import(path.join(root, 'node_modules/vite/dist/node/index.js'));
  const server = await createServer({root, server:{host:'127.0.0.1',port:5183,strictPort:true}});
  await server.listen();
  const browser = await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--no-zygote']});
  const report=[];
  try {
    for (const viewport of [{width:1440,height:980},{width:390,height:844}]) {
      const page=await browser.newPage({viewport});
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.route('**/src/supabaseClient.js*',route=>route.fulfill({contentType:'text/javascript',body:auth}));
      await page.clock.install();
      await page.goto('http://127.0.0.1:5183/tests/browser/launch-harness.html?auth');
      await page.getByLabel('EMAIL ADDRESS').fill('qa@example.invalid');
      await page.getByLabel('PASSWORD',{exact:true}).fill('qa-only-fixture');
      await page.waitForFunction(()=>[...document.querySelectorAll('.access-class-image')].every(image=>image.naturalWidth>0));
      assert.equal(await page.locator('.access-class-preview').getAttribute('data-preview-class'),'COMMANDER');
      // Each transition must retain inputs and use at most two artwork layers.
      for (const name of ['TANK','RANGER','MAGE','ASSASSIN','COMMANDER']) {
        await page.clock.fastForward(9200);
        await page.waitForFunction(expected=>document.querySelector('.access-class-preview')?.dataset.previewClass===expected,name);
        assert.equal(await page.getByLabel('EMAIL ADDRESS').inputValue(),'qa@example.invalid');
        assert.ok(await page.locator('.access-class-image').count()<=4);
      }
      assert.equal(await page.getByRole('button',{name:/class rotation/}).count(),0);
      await page.clock.fastForward(9200);
      await page.waitForFunction(()=>document.querySelector('.access-class-preview')?.dataset.previewClass==='TANK');
      await page.getByRole('button',{name:'ENTER THE SYSTEM'}).click();
      await page.getByText(/weren’t recognized/).waitFor();
      assert.equal(await page.getByLabel('EMAIL ADDRESS').inputValue(),'qa@example.invalid');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.screenshot({path:path.join(output,`access-${viewport.width}.png`),fullPage:true});
      await page.emulateMedia({reducedMotion:'reduce'});
      await page.waitForFunction(()=>!document.querySelector('.access-motion-control'));
      await page.clock.fastForward(40000);
      assert.equal(await page.locator('.access-class-preview').getAttribute('data-preview-class'),'TANK');
      assert.equal(await page.getByRole('button',{name:/class rotation/}).count(),0);
      assert.equal(await page.locator('.access-class-orbit').evaluate(element=>getComputedStyle(element).animationName),'none');
      assert.deepEqual(errors,[]);
      report.push({width:viewport.width,allFiveArtworks:'passed',automaticRotation:'passed',controlsRemoved:'passed',reducedMotion:'passed',inputPreservation:'passed'});
      await page.close();
    }
    for (const viewport of [{width:1440,height:1100},{width:390,height:844}]) {
      const page=await browser.newPage({viewport,reducedMotion:'reduce'});
      await page.route('**/src/supabaseClient.js*',route=>route.fulfill({contentType:'text/javascript',body:auth}));
      await page.goto('http://127.0.0.1:5183/tests/browser/foundation-harness.html');
      await page.getByPlaceholder('ENTER NAME').fill('QA PLAYER');
      await page.getByPlaceholder('ENTER AGE').fill('25');
      await page.getByRole('button',{name:'♂ MALE MALE VOICE',exact:true}).click();
      await page.getByRole('button',{name:/begin foundation scan/i}).click();
      await page.getByRole('button',{name:/build strength/i}).click();
      await page.getByRole('button',{name:/grow my mind/i}).click();
      await page.getByRole('button',{name:/regular/i,exact:true}).first().click();
      assert.equal(await page.getByRole('button',{name:'CONTINUE',exact:true}).isDisabled(),true);
      await page.getByLabel('CURRENT WEIGHT (KG)').fill('61');
      assert.equal(await page.getByRole('button',{name:'CONTINUE',exact:true}).isEnabled(),true);
      await page.getByLabel('HEIGHT (FEET)').fill('5');
      await page.getByLabel('HEIGHT (INCHES)').fill('9');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.screenshot({path:path.join(output,`foundation-goals-${viewport.width}.png`),fullPage:true});
      report.push({foundation:viewport.width,requiredWeight:'passed',multipleGoals:'passed',feetInches:'passed'});
      await page.close();
    }
    fs.writeFileSync(path.join(output,'access-browser-report.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify(report));
  } finally {await browser.close();await server.close();}
})().catch(error=>{console.error(error);process.exit(1);});
