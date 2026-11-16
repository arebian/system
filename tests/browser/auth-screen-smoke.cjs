const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require("playwright");

(async () => {
  const root = path.resolve(__dirname, "../..");
  const { createServer } = await import(path.join(root, "node_modules/vite/dist/node/index.js"));
  const server = await createServer({ root, server: { host: "127.0.0.1", port: 5188, strictPort: true } });
  await server.listen();
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const report = [];
  try {
    for (const width of [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.route("**/src/supabaseClient.js*", route => route.fulfill({
        contentType: "text/javascript",
        body: `
          export const __qaCalls=[];
          export const supabase={
            auth:{
              getSession:async()=>({data:{session:null},error:null}),
              onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
              signUp:async({email,password})=>{__qaCalls.push({action:"signUp",email,password});return {data:{user:{id:"qa-user"},session:null},error:null};},
              signInWithPassword:async({email,password})=>{__qaCalls.push({action:"signIn",email,password});return {data:{user:null,session:null},error:{message:"Invalid login credentials"}};},
              signInWithOAuth:async()=>({data:{url:"https://example.test/oauth"},error:null})
            }
          };
        `
      }));
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto("http://127.0.0.1:5188/");
      await page.getByRole("heading", {name:"Welcome back."}).waitFor();
      await page.getByLabel("EMAIL ADDRESS").fill("player@example.test");
      await page.locator("#access-password").fill("wrong-password");
      await page.getByRole("button", {name:"ENTER THE SYSTEM"}).click();
      await page.getByRole("status").getByText(/weren’t recognized/i).waitFor();
      await page.getByRole("tab", {name:"Create account"}).click();
      await page.getByRole("heading", {name:"Begin your progression."}).waitFor();
      await page.locator("#access-password").fill("short");
      await page.getByRole("button", {name:"CREATE MY ACCOUNT"}).click();
      await page.getByRole("status").getByText(/at least 8 characters/i).waitFor();
      await page.locator("#access-password").fill("strong-test-password");
      await page.getByRole("button", {name:"CREATE MY ACCOUNT"}).click();
      await page.getByRole("status").getByText(/Account created. Check your email/i).waitFor();
      const call = await page.evaluate(() => window.__qaCalls?.[0]);
      assert.equal(await page.evaluate(() => document.querySelector("#access-email").value), "player@example.test");
      assert.deepEqual(errors, []);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      report.push({viewport:width,loginScreen:"passed",invalidCredentialsFeedback:"passed",accountCreationValidation:"passed",signupConfirmation:"passed",horizontalOverflow:false,consoleErrors:errors});
      await context.close();
    }
    console.log(JSON.stringify(report));
  } finally { await browser.close(); await server.close(); }
})().catch(error => { console.error(error); process.exit(1); });
