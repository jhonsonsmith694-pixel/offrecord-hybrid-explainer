// Headless-Chrome verification for the OffRecord built app.
// Serves dist/ over HTTP, loads it, and checks rendering + UI wiring.
// Run: node verification/verify.mjs  (from app/)
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = new URL("../dist/", import.meta.url).pathname;
const OUT = new URL("../verification/", import.meta.url).pathname;
const PORT = 4180;

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const server = http.createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (path === "/") path = "/index.html";
    const data = await readFile(join(DIST, path));
    res.writeHead(200, { "Content-Type": MIME[extname(path)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});

await new Promise((r) => server.listen(PORT, r));
console.log(`serving dist/ on http://127.0.0.1:${PORT}`);

const browser = await chromium.launch({
  executablePath: "/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome",
  args: ["--no-sandbox"],
});
const failures = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("console", (msg) => {
  if (msg.type() === "error") failures.push(`console error: ${msg.text()}`);
});
page.on("pageerror", (err) => failures.push(`page error: ${err.message}`));
page.on("requestfailed", (req) => failures.push(`request failed: ${req.url()} ${req.failure()?.errorText}`));

await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

const checks = [];
const check = (name, ok, extra = "") => {
  checks.push({ name, ok, extra });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
};

check("title", (await page.title()).includes("OffRecord"), await page.title());
check("header visible", await page.locator("h1").first().isVisible());
check(
  "setup banner visible (Firebase not configured — expected)",
  await page.locator("#setup-banner").isVisible()
);
check(
  "Explain button disabled without config (expected)",
  await page.locator("#explain-btn").isDisabled()
);
check(
  "on-device status mentions unavailability",
  (await page.locator("#ondevice-status").textContent()).length > 10,
  await page.locator("#ondevice-status").textContent()
);

// Sample button fills the textarea and updates the char count.
await page.locator('[data-sample="terms"]').click();
await page.waitForTimeout(300);
const text = await page.locator("#input-text").inputValue();
check("sample fills textarea", text.length > 200, `${text.length} chars`);
check(
  "char count updates",
  (await page.locator("#char-count").textContent()).includes("characters"),
  await page.locator("#char-count").textContent()
);

// Mode selector + private toggle exist and are interactive.
await page.locator("#mode").selectOption("on-device");
check(
  "mode selector works",
  (await page.locator("#mode").inputValue()) === "on-device"
);
await page.locator("#private-toggle").check();
check("private toggle works", await page.locator("#private-toggle").isChecked());

// No horizontal overflow at desktop width.
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth
);
check("no horizontal overflow (1280px)", overflow <= 0, `overflow=${overflow}px`);

await page.screenshot({ path: OUT + "desktop-1280.png", fullPage: true });

// Mobile width.
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(400);
const mOverflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth
);
check("no horizontal overflow (390px)", mOverflow <= 0, `overflow=${mOverflow}px`);
await page.screenshot({ path: OUT + "mobile-390.png", fullPage: true });

await browser.close();
server.close();

console.log("\n--- unexpected errors ---");
if (failures.length === 0) console.log("(none)");
else failures.forEach((f) => console.log(" - " + f));

const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length || failures.length ? 1 : 0);
