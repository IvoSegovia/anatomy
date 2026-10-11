// QA en navegador (Chromium headless vía Playwright): recorre todos los pasos, recoge errores de
// consola, comprueba controles y guarda capturas y hojas de contactos.
// Uso: node examples/rsi-lab/qa.mjs [--out dir] [--size 1440x900] [--only 3] [--reduced]
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const out = resolve(opt("--out", join(HERE, "shots")));
const [W, H] = opt("--size", "1440x900").split("x").map(Number);
const only = opt("--only") ? Number(opt("--only")) : null;
mkdirSync(out, { recursive: true });

let chromium;
try {
  chromium = createRequire(import.meta.url)("playwright").chromium;
} catch {
  chromium = createRequire("/opt/node22/lib/node_modules/")("playwright").chromium;
}
const exe = process.env.CHROME_PATH || "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1, reducedMotion: args.includes("--reduced") ? "reduce" : "no-preference" });
const errors = [];
page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && errors.push(`${m.type()}: ${m.text()}`));
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
await page.goto(pathToFileURL(join(HERE, "rsi-lab.html")).href);
await page.waitForTimeout(800);

const beats = await page.evaluate(() => window.__sceneQA.beats());
const total = await page.evaluate(() => window.__sceneQA.total());
console.log(`${beats.length} pasos · duración guiada ${(total / 60).toFixed(1)} min a 1×`);
const shots = [];
for (let i = 0; i < beats.length; i++) {
  const id = beats[i];
  const chapter = Number(id.split(".")[0]);
  if (only && chapter !== only) continue;
  await page.evaluate((index) => {
    const d = window.__sceneQA.director;
    d.seek(index, 1, { forceEnter: true });
    d.flyTo(d.cameraFor(d.beat), 0);
    window.__sceneQA.ctx.wake();
  }, i);
  await page.waitForTimeout(chapter === 8 ? 900 : 260);
  const file = join(out, `beat-${id.replace(/\./g, "_")}.png`);
  await page.screenshot({ path: file });
  shots.push({ id, file });
}
// Hojas de contactos por capítulo
const byChapter = {};
for (const s of shots) (byChapter[s.id.split(".")[0]] ||= []).push(s);
for (const [c, list] of Object.entries(byChapter)) {
  const html = `<html><body style="margin:0;background:#000;display:grid;grid-template-columns:repeat(3,1fr);gap:4px">${list.map((s) => `<div style="position:relative"><img src="${pathToFileURL(s.file).href}" style="width:100%;display:block"><span style="position:absolute;left:6px;top:4px;color:#fff;font:14px monospace;background:#000a;padding:1px 4px">${s.id}</span></div>`).join("")}</body></html>`;
  const sheet = join(out, `sheet-${c}.html`);
  writeFileSync(sheet, html);
  const p2 = await browser.newPage({ viewport: { width: 1800, height: 400 } });
  await p2.goto(pathToFileURL(sheet).href);
  await p2.waitForTimeout(300);
  await p2.screenshot({ path: join(out, `sheet-${c}.png`), fullPage: true });
  await p2.close();
}
console.log(errors.length ? `ERRORES:\n${errors.join("\n")}` : "sin errores de consola");
await browser.close();
process.exit(errors.length ? 1 : 0);
