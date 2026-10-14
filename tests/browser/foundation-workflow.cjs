const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "../..");
const output = path.join(root, "test-results");
fs.mkdirSync(output, { recursive: true });

(async () => {
  const { createServer } = await import(
    path.join(root, "node_modules/vite/dist/node/index.js"),
  );
  const server = await createServer({
    root,
    server: {
      host: "127.0.0.1",
      port: 5181,
      strictPort: true,
    },
  });
  await server.listen();

  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--no-zygote",
    ],
    headless: true,
  });

  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route('**/src/systemProfileApi.js*', route => route.fulfill({contentType:'text/javascript',body:`export async function syncProfileToCloud(profile) { window.savedFoundation=profile; if(window.rejectSave){window.rejectSave=false;return {ok:false,error:new Error('Failed to fetch')};}return {ok:true}; }`}));

    await page.goto("http://127.0.0.1:5181/tests/browser/foundation-harness.html");
    await page.getByPlaceholder("ENTER NAME").fill("Zaid");
    await page.getByPlaceholder("ENTER AGE").fill("21");
    await page.getByRole("button", { name: "♂ MALE MALE VOICE", exact: true }).click();
    await page.getByRole("button", { name: /begin foundation scan/i }).click();

    await page.getByRole("button", { name: /build strength/i }).click();
    await page.getByRole("button", { name: /grow my mind/i }).click();
    assert.equal(await page.locator('.focus-grid .selected').count(), 2);
    await page.getByRole("button", { name: /build strength/i }).click();
    assert.match(await page.locator('.foundation-focus-summary').textContent(), /grow my mind/);
    await page.getByRole("button", { name: /grow my mind/i }).click();
    await page.getByRole("button", { name: /build strength/i }).click();
    await page.getByRole("button", { name: /grow confidence/i }).click();
    await page.getByRole("button", { name: /returning/i }).click();
    assert.equal(await page.getByRole("button", { name: "CONTINUE", exact: true }).isDisabled(), true);
    await page.getByLabel("CURRENT WEIGHT (KG)").fill("60.5");
    await page.getByLabel("HEIGHT (FEET)").fill("5");
    await page.getByLabel("HEIGHT (INCHES)").fill("12");
    assert.equal(await page.getByRole("button", { name: "CONTINUE", exact: true }).isDisabled(), true);
    await page.getByLabel("HEIGHT (INCHES)").fill("11");
    await page.getByRole("button", { name: "CONTINUE" }).click();

    await page.getByRole("button", { name: /on my feet/i }).click();
    await page.getByRole("button", { name: "20 MIN" }).click();
    await page.getByRole("button", { name: "STAYING CONSISTENT" }).click();
    await page.getByRole("button", { name: /gym access/i }).click();
    await page.getByRole("button", { name: /continue to fuel/i }).click();
    await page.getByRole("button", { name: "3 MEALS" }).click();
    await page.getByRole("button", { name: "NO FOOD RESTRICTIONS" }).click();
    await page.getByRole("button", { name: /keep it basic/i }).click();
    await page.getByRole("button", { name: /see class ideas/i }).click();

    assert.equal(await page.locator(".path-card.selected").count(), 0, "A class was selected automatically");
    await page.getByRole("button", { name: /tank/i }).click();
    await page.getByRole("button", { name: /review foundation brief/i }).click();
    await page.getByText("BULK", { exact: true }).first().waitFor();
    await page.getByRole("button", { name: /cut/i }).click();
    await page.evaluate(() => window.rejectSave=true);
    await page.getByRole("button", { name: /initialize system/i }).click();
    await page.getByRole("alert").waitFor();
    assert.equal(await page.evaluate(() => Boolean(window.completedFoundationProfile)), false);
    assert.equal(await page.locator('.foundation-goal.selected strong').textContent(), 'CUT');
    await page.getByRole("button", { name: /initialize system/i }).click();
    await page.waitForFunction(() => Boolean(window.completedFoundationProfile));

    const profile = await page.evaluate(() => window.completedFoundationProfile);
    assert.equal(profile.path, "TANK");
    assert.deepEqual(profile.foundationScan.focusGoals, ["STRENGTH", "CONFIDENCE"]);
    assert.equal(profile.foundationScan.weightKg, 60.5);
    assert.equal(profile.foundationScan.heightCm, 180.3);
    assert.equal(profile.foundationScan.recommendedFuelGoal, "BULK");
    assert.equal(profile.foundationScan.selectedFuelGoal, "CUT");
    assert.equal(profile.fuel.goal, "CUT");
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      true,
      "Mobile overflow detected",
    );
    assert.deepEqual(errors, []);
    await page.screenshot({ path: path.join(output, "foundation-login-mobile.png"), fullPage: true });
    console.log(JSON.stringify({ foundation_scan: "passed", mobile: "passed" }));
  } finally {
    await browser.close();
    await server.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
