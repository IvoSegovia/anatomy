import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
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
mkdirSync(out, { recursive: true });
let chromium;
try {
  chromium = createRequire(import.meta.url)("playwright").chromium;
} catch {
  chromium = createRequire("/opt/node22/lib/node_modules/")("playwright").chromium;
}
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: W, height: H }, reducedMotion: args.includes("--reduced") ? "reduce" : "no-preference" });
const errors = [];
page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && errors.push(`${m.type()}: ${m.text()}`));
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
await page.goto(pathToFileURL(join(HERE, "rsi-lab.html")).href);
await page.waitForTimeout(700);

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? `  (${detail})` : ""}`);
};
const state = () => page.evaluate(() => window.__sceneQA.state);
const shot = (name) => page.screenshot({ path: join(out, `${name}.png`) });

let s0 = await state();
await page.click(".play");
await page.waitForTimeout(1500);
let s1 = await state();
check("reproducir avanza el tiempo narrativo", s1.playing && (s1.t > s0.t || s1.beat !== s0.beat), `${s0.beat}@${s0.t.toFixed(2)} → ${s1.beat}@${s1.t.toFixed(2)}`);
await page.click(".play");
await page.waitForTimeout(300);
const paused = await state();
await page.waitForTimeout(800);
const still = await state();
check("pausar congela el instante", !still.playing && still.t === paused.t && still.beat === paused.beat);

await page.evaluate(() => window.__sceneQA.seek(1, 1, 0));
await page.waitForTimeout(200);
const before = await state();
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(1500);
const after = await state();
check("→ avanza exactamente un evento", after.beat === before.beat && after.event === before.event + 1, `evento ${before.event} → ${after.event}`);
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(1500);
await page.keyboard.press("ArrowLeft");
await page.waitForTimeout(300);
const back = await state();
check("← restaura el estado guardado anterior", back.beat === after.beat && back.event === after.event, `vuelve al evento ${back.event}`);

await page.click('.chapters button:nth-child(3)');
await page.waitForTimeout(1800);
const ch3 = await state();
check("botón de capítulo 3", ch3.chapter === 3, ch3.beat);
await shot("i-ch3");

await page.evaluate(() => window.__sceneQA.seek(3, 3, 1));
await page.waitForTimeout(500);
const cellBox = await page.evaluate(() => {
  const el = document.querySelector('[data-obj="t-S"] [data-cell="3,1"]');
  if (!el) return null;
  const b = el.getBoundingClientRect();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
});
if (cellBox) {
  await page.mouse.move(cellBox.x, cellBox.y);
  await page.waitForTimeout(250);
  const tip = await page.evaluate(() => (document.querySelector(".tip.on") || {}).textContent || "");
  check("tooltip de celda muestra operandos y resultado", /Q_i·K_j/.test(tip) && /A\[i,j\]/.test(tip), tip.slice(0, 80));
  await shot("i-tooltip");
  await page.mouse.click(cellBox.x, cellBox.y);
  await page.waitForTimeout(300);
  const insp = await page.evaluate(() => document.querySelector(".insp-body").textContent);
  check("clic en celda la fija en el inspector", /celda 3,1/.test(insp), insp.slice(0, 60));
} else check("celda S[3,1] presente", false);

await page.evaluate(() => window.__sceneQA.seek(1, 1, 1));
await page.waitForTimeout(400);
const evalBox = await page.evaluate(() => {
  const el = document.querySelector('[data-obj="evaluador"] .iso-fill');
  const b = el.getBoundingClientRect();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
});
await page.mouse.click(evalBox.x, evalBox.y);
await page.waitForTimeout(300);
const insp2 = await page.evaluate(() => document.querySelector(".insp-body").textContent);
check("clic en un módulo abre su ficha", /Evaluador/.test(insp2) && /Entradas/.test(insp2), insp2.slice(0, 60));
const goButtons = await page.$$(".insp-body [data-go]");
if (goButtons.length) {
  await goButtons[0].click();
  await page.waitForTimeout(200);
  const insp3 = await page.evaluate(() => document.querySelector(".insp-body h2").textContent);
  check("recorrer entradas/salidas desde el inspector", insp3 && !/Evaluador/.test(insp3), insp3);
}
await shot("i-inspect");

await page.click('[data-tab="checks"]');
await page.waitForTimeout(1200);
const checks = await page.evaluate(() => document.querySelector(".insp-body").textContent);
const m = checks.match(/(\d+)\/(\d+) correctas/);
check("verificación en vivo: todas correctas", m && m[1] === m[2], m ? m[0] : checks.slice(0, 80));
await shot("i-checks");
await page.click('[data-tab="obj"]');

const cam0 = (await state()).camera;
const box = await page.evaluate(() => {
  const b = document.querySelector(".stage").getBoundingClientRect();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
});
await page.mouse.move(box.x, box.y + 150);
await page.mouse.down();
for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + i * 12, box.y + 150 + i * 3);
await page.mouse.up();
await page.waitForTimeout(300);
const cam1 = (await state()).camera;
check("arrastrar gira la cámara", Math.abs(cam1.azimuth - cam0.azimuth) > 5, `acimut ${cam0.azimuth.toFixed(1)} → ${cam1.azimuth.toFixed(1)}`);
await page.mouse.wheel(0, -400);
await page.waitForTimeout(300);
const cam2 = (await state()).camera;
check("rueda acerca", cam2.scale > cam1.scale * 1.2, `${cam1.scale.toFixed(2)} → ${cam2.scale.toFixed(2)}`);
const backBtn = await page.$(".back-tour.on");
check("aparece «volver a la cámara guiada»", !!backBtn);
await shot("i-camera");
await page.keyboard.press("r");
await page.waitForFunction(() => !window.__sceneQA.director.S.camAnim, null, { timeout: 8000 }).catch(() => {});
const cam3 = (await state()).camera;
check("R restablece la cámara guiada", Math.abs(cam3.azimuth - cam0.azimuth) < 0.5, `acimut ${cam3.azimuth.toFixed(1)}`);

await page.click(".mode button:nth-child(2)");
await page.waitForTimeout(200);
check("modo exploración", (await state()).mode === "free");
await page.click(".mode button:nth-child(1)");

await page.evaluate(() => window.__sceneQA.seek(2, 4, 1));
await page.waitForTimeout(400);
const x0Before = await page.evaluate(() => window.__sceneQA.store.trace().X0[3].join(","));
const sel = await page.$('.desk select[aria-label="Token en la posición 3"]');
if (sel) {
  await sel.selectOption({ label: "y" });
  await page.waitForTimeout(400);
  const after2 = await page.evaluate(() => ({ x0: window.__sceneQA.store.trace().X0[3].join(","), ids: window.__sceneQA.store.ids().join(","), print: window.__sceneQA.store.print0 }));
  check("cambiar un token recalcula X₀ y lo que depende de él", after2.x0 !== x0Before, `ids ${after2.ids}`);
  check("cambiar un token no cambia θ", after2.print === "f0b9c189", after2.print);
  await shot("i-retoken");
} else check("selector de token presente", false);

await page.evaluate(() => window.__sceneQA.seek(5, 6, 1));
await page.waitForTimeout(500);
const eta = await page.$('.desk input[aria-label^="Tasa de aprendizaje"]');
if (eta) {
  await eta.evaluate((el) => {
    el.value = String(Math.log10(1.2));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.waitForTimeout(300);
  const u = (await state()).user;
  check("η desde la mesa de control", Math.abs(u.eta - 1.2) < 0.01, `η = ${u.eta}`);
}

await page.click(".transport .icon-btn");
await page.waitForTimeout(400);
const reset = await state();
check("reiniciar vuelve al paso 1.1 y a los valores iniciales", reset.beat === "1.1" && reset.user.text === "def f(x):" && reset.user.eta === 0.5);

await page.keyboard.press("i");
await page.waitForTimeout(200);
const hidden = await page.evaluate(() => document.querySelector(".inspector").hasAttribute("hidden"));
check("I oculta el inspector", hidden);
await page.keyboard.press("i");

const scroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
check("sin desplazamiento horizontal de la página", scroll);

console.log(errors.length ? `ERRORES:\n${errors.join("\n")}` : "sin errores de consola");
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} comprobaciones de interacción correctas`);
await browser.close();
process.exit(failed || errors.length ? 1 : 0);
