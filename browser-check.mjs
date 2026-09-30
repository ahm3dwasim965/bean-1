import { createRequire } from "node:module";
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium, firefox, devices } = require("playwright");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
const evidence = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../evidence");
const mime = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".png": "image/png", ".svg": "image/svg+xml" };

const server = http.createServer(async (request, response) => {
  const raw = new URL(request.url, "http://127.0.0.1").pathname;
  const relative = raw === "/" ? "index.html" : raw.replace(/^\//, "");
  const filePath = path.resolve(root, relative);
  if (!filePath.startsWith(root)) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  try {
    const bytes = await readFile(filePath);
    response.writeHead(200, { "Content-Type": mime[path.extname(filePath)] || "application/octet-stream" });
    response.end(bytes);
  } catch {
    response.writeHead(404).end("Not found");
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const base = `http://127.0.0.1:${address.port}`;
const tests = [];

function record(browser, viewport, check, passed, detail) {
  tests.push({ browser, viewport, check, passed, detail });
}

async function testDesktop(browserType, browserName) {
  let browser;
  try {
    browser = await browserType.launch({ headless: true });
  } catch (error) {
    record(browserName, "1440x900", "Browser launch", false, error.message);
    return;
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const scriptErrors = [];
  page.on("pageerror", (error) => scriptErrors.push(error.message));
  await page.goto(`${base}/index.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("beanBoutiqueWelcomeSeenV1", "true"));
  await page.reload({ waitUntil: "domcontentloaded" });
  record(browserName, "1440x900", "Home title", (await page.title()) === "Bean Boutique Coffee Shop", await page.title());
  record(browserName, "1440x900", "Navigation count", (await page.locator("#primary-navigation a").count()) === 6, `${await page.locator("#primary-navigation a").count()} links`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
  record(browserName, "1440x900", "No horizontal overflow", overflow, `${await page.evaluate(() => document.documentElement.scrollWidth)} px document width`);
  await page.screenshot({ path: path.join(evidence, `${browserName.toLowerCase()}-home-desktop.png`), fullPage: true });

  await page.goto(`${base}/coffee.html`, { waitUntil: "domcontentloaded" });
  await page.locator("[data-add-to-cart]").first().click();
  await page.goto(`${base}/cart.html`, { waitUntil: "domcontentloaded" });
  record(browserName, "1440x900", "Cart persistence", (await page.locator("#cartItems tr").count()) === 1, `${await page.locator("#cartItems tr").count()} saved row`);

  await page.goto(`${base}/coffee.html`, { waitUntil: "domcontentloaded" });
  await page.locator("#coffeeSearch").fill("jasmine");
  const visible = await page.locator("[data-coffee-card]:visible").count();
  record(browserName, "1440x900", "Animated product search", visible === 1, `${visible} result for jasmine`);

  await page.goto(`${base}/events.html`, { waitUntil: "domcontentloaded" });
  await page.locator("#eventRegistration button[type='submit']").click();
  record(browserName, "1440x900", "Form validation", (await page.locator("#registrationStatus").textContent()).includes("correct"), await page.locator("#registrationStatus").textContent());
  record(browserName, "1440x900", "Uncaught script errors", scriptErrors.length === 0, scriptErrors.join(" | ") || "None");
  await page.screenshot({ path: path.join(evidence, `${browserName.toLowerCase()}-events-desktop.png`), fullPage: true });
  await browser.close();
}

async function testMobile() {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    record("Chromium mobile emulation", "Pixel 7", "Browser launch", false, error.message);
    return;
  }
  const context = await browser.newContext({ ...devices["Pixel 7"] });
  const page = await context.newPage();
  await page.goto(`${base}/coffee.html`, { waitUntil: "domcontentloaded" });
  const toggleVisible = await page.locator("[data-nav-toggle]").isVisible();
  await page.locator("[data-nav-toggle]").click();
  const navVisible = await page.locator("#primary-navigation").isVisible();
  record("Chromium mobile emulation", "Pixel 7", "Responsive navigation", toggleVisible && navVisible, `toggle=${toggleVisible}, menu=${navVisible}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
  record("Chromium mobile emulation", "Pixel 7", "No horizontal overflow", overflow, `${await page.evaluate(() => document.documentElement.scrollWidth)} px document width`);
  await page.screenshot({ path: path.join(evidence, "chromium-coffee-mobile.png"), fullPage: true });
  await browser.close();
}

await testDesktop(chromium, "Chromium");
await testDesktop(firefox, "Firefox");
await testMobile();
server.close();

const summary = {
  scope: "Automated browser testing. Pixel 7 is emulated, not a physical device.",
  passed: tests.filter((item) => item.passed).length,
  failed: tests.filter((item) => !item.passed).length,
  tests
};
await import("node:fs/promises").then(({ writeFile }) => writeFile(path.join(evidence, "browser-results.json"), JSON.stringify(summary, null, 2)));
console.log(JSON.stringify(summary, null, 2));
process.exitCode = summary.failed ? 1 : 0;
