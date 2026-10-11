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
await page.waitForTimeout(800);

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? `  (${detail})` : ""}`);
};
const state = () => page.evaluate(() => window.__sceneQA.state);
const shot = (name) => page.screenshot({ path: join(out, `${name}.png`) });
const stepIndex = (id) => page.evaluate((sid) => window.__sceneQA.lesson.steps.findIndex((s) => s.id === sid), id);
const go = async (id, phase = "orient") => {
  await page.evaluate(([i, ph]) => window.__sceneQA.go(i, ph), [await stepIndex(id), phase]);
  await page.waitForTimeout(250);
};
const guide = () => page.evaluate(() => document.querySelector(".insp-body").textContent);
const settle = () => page.waitForFunction(() => window.__sceneQA.director.S.stepTo === null && !window.__sceneQA.director.S.camAnim, null, { timeout: 10000 }).catch(() => {});

const s0 = await state();
check("abre en la pestaña Guía, paso 1.1, orientación", s0.tab === "guide" && s0.step === "1.1" && s0.phase === "orient", `${s0.tab} · ${s0.step} · ${s0.phase}`);

await go("3.2a");
let s = await state();
check("la orientación detiene la escena antes de la operación", s.phase === "orient" && !s.playing);
await page.click(".learn-primary");
await page.waitForTimeout(150);
const afterPerform = (await state()).phase;
if (args.includes("--reduced")) check("movimiento reducido: «Ver la operación» salta sin animar a la operación o su resultado", afterPerform === "act" || afterPerform === "result", afterPerform);
else check("«Ver la operación» pasa a la fase de operación", afterPerform === "act");
await settle();
await page.waitForTimeout(300);
s = await state();
check("al terminar la animación queda en «Resultado»", s.phase === "result", s.phase);
const resultText = await guide();
check("el resultado nombra el valor calculado de la celda", /Q\[3,0\] vale/.test(resultText), resultText.slice(0, 80).replace(/\s+/g, " "));

await page.keyboard.press("ArrowLeft");
await page.waitForTimeout(300);
check("← vuelve a la orientación del mismo paso", (await state()).phase === "orient");
await page.keyboard.press("ArrowRight");
await settle();
await page.waitForTimeout(300);
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(300);
s = await state();
check("→ avanza a la siguiente idea (3.2b, orientación)", s.step === "3.2b" && s.phase === "orient", `${s.step} · ${s.phase}`);

const before = await page.evaluate(() => window.__sceneQA.events.length);
await page.keyboard.press("r");
await settle();
await page.waitForTimeout(300);
const fired = await page.evaluate((n) => window.__sceneQA.events.slice(n).map((e) => e.id), before);
check("R repite la operación y vuelve a emitir sus eventos una vez", fired.length === 2 && new Set(fired).size === 2, fired.join(" "));

await page.click('[data-act="simple"]');
await page.waitForTimeout(150);
check("«Explicámelo más simple» abre una explicación propia del concepto", /Más simple · Q, K y V/.test(await guide()));
await page.click('[data-act="example"]');
await page.waitForTimeout(150);
check("«Ver un ejemplo» muestra números pequeños con su procedencia", /Ejemplo/.test(await guide()) && /ejemplo ilustrativo|resultado calculado/.test(await guide()));
const term = await page.$(".guide .g-text:not(.dim) .term, .guide .g-text .term");
if (term) {
  await term.click();
  await page.waitForTimeout(150);
  check("un término abre el glosario con definición y «Mostrar en la escena»", /Glosario/.test(await guide()));
}
await go("3.6a");
const ref = await page.$('.guide .g-text .ref[data-ref="t-S"]');
if (ref) {
  await ref.click();
  await page.waitForTimeout(200);
  const lbl = await page.evaluate(() => !!document.querySelector(".lbl.spot"));
  check("una referencia del texto señala el objeto en la escena", lbl);
}

await page.click(".mode button:nth-child(1)");
await page.evaluate(() => window.__sceneQA.lesson.setWpm(3000));
await page.click(".play");
await page.waitForTimeout(400);
check("▶ inicia la reproducción automática", (await state()).playing);
await page.waitForTimeout(7200);
s = await state();
check("tras la espera mínima de lectura (6 s) ejecuta la operación sola", s.phase !== "orient" || s.step !== "3.6a", `${s.step} · ${s.phase}`);
await page.evaluate(() => window.__sceneQA.lesson.setWpm(140));
await page.click(".play");
await page.waitForTimeout(200);
const paused = await state();
await page.waitForTimeout(1500);
const still = await state();
check("pausar congela el punto actual", !still.playing && still.step === paused.step && Math.abs(still.t - paused.t) < 1e-9);

await go("3.1");
await page.click(".play");
await page.waitForTimeout(300);
await page.evaluate(() => window.__sceneQA.seek(3, 3, 1));
await page.waitForTimeout(300);
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
  check("tooltip de celda muestra operandos y resultado", /Q_i·K_j/.test(tip) && /A\[i,j\]/.test(tip), tip.slice(0, 60));
  await page.mouse.click(cellBox.x, cellBox.y);
  await page.waitForTimeout(300);
  check("inspeccionar una celda pausa y abre la ficha", !(await state()).playing && /celda 3,1/.test(await page.evaluate(() => document.querySelector(".insp-body").textContent)));
} else check("celda S[3,1] presente", false);

if (!args.includes("--reduced")) {
  await page.click("[data-tab=guide]");
  await go("3.2a");
  await page.evaluate(() => (window.__sceneQA.director.S.speed = 0.25));
  await page.click(".learn-primary");
  await page.waitForTimeout(250);
  const midT = await page.evaluate(() => window.__sceneQA.director.S.t);
  await page.click(".insp-body .g-text .term");
  await page.waitForTimeout(400);
  const frozen = await page.evaluate(() => ({ phase: window.__sceneQA.lesson.L.phase, frozen: window.__sceneQA.lesson.L.frozen, t: window.__sceneQA.director.S.t, moving: window.__sceneQA.director.S.stepTo !== null }));
  check("sin reproducción automática, abrir el glosario a mitad de la operación la congela en su punto", frozen.phase === "act" && frozen.frozen && !frozen.moving && frozen.t >= midT, `t = ${frozen.t.toFixed(3)}`);
  await page.evaluate(() => (window.__sceneQA.director.S.speed = 1));
  await page.click(".learn-primary");
  await settle();
  await page.waitForTimeout(300);
  check("«Seguir la operación» la completa desde ese punto", (await state()).phase === "result");
}

await go("1.2g");
await settle();
const evalBox = await page.evaluate(() => {
  const el = document.querySelector('[data-obj="evaluador"] .iso-fill');
  const b = el.getBoundingClientRect();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
});
await page.mouse.click(evalBox.x, evalBox.y);
await page.waitForTimeout(300);
const insp = await page.evaluate(() => document.querySelector(".insp-body").textContent);
check("clic en un módulo abre su ficha con entradas y salidas", /Evaluador/.test(insp) && /Entradas/.test(insp));
const goBtn = await page.$(".insp-body [data-go]");
if (goBtn) {
  await goBtn.click();
  await page.waitForTimeout(200);
  check("recorrer entradas/salidas desde la ficha", !/^Evaluador$/.test(await page.evaluate(() => document.querySelector(".insp-body h2").textContent)));
}
await page.click('[data-tab="checks"]');
await page.waitForTimeout(2500);
const checks = await page.evaluate(() => document.querySelector(".insp-body").textContent);
const m = checks.match(/(\d+)\/(\d+) correctas/);
check("verificación en vivo: todas correctas", m && m[1] === m[2], m ? m[0] : checks.slice(0, 60));
await page.click('[data-tab="guide"]');

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
check("rueda acerca", (await state()).camera.scale > cam1.scale * 1.2);
check("aparece «Volver a la explicación»", !!(await page.$(".back-tour.on")));
await page.click(".back-tour.on");
await page.waitForFunction(() => !window.__sceneQA.director.S.camAnim, null, { timeout: 8000 }).catch(() => {});
check("«Volver a la explicación» restablece la cámara guiada", Math.abs((await state()).camera.azimuth - cam0.azimuth) < 0.5);

await page.keyboard.press("n");
await page.waitForTimeout(250);
const hidden = await page.evaluate(() => ({ app: document.getElementById("app").classList.contains("no-narrator"), badge: getComputedStyle(document.querySelector(".narrator-off")).display !== "none", caption: getComputedStyle(document.querySelector(".caption")).display === "none" }));
check("N oculta el narrador escrito y deja un aviso para mostrarlo", hidden.app && hidden.badge && hidden.caption);
await shot("i-narrador-oculto");
await page.keyboard.press("n");
await page.waitForTimeout(250);
check("N vuelve a mostrarlo", !(await page.evaluate(() => document.getElementById("app").classList.contains("no-narrator"))) && /Capítulo/.test(await guide()));

await go("3.1");
const text1 = await guide();
await page.click('.desk .seg button:nth-child(2)');
await page.waitForTimeout(300);
const text2 = await guide();
check("cambiar la cabeza recalcula el texto del narrador", /cabeza 1/.test(text1) && /cabeza 2/.test(text2) && text1 !== text2);
await page.click('.desk .seg button:nth-child(1)');

await go("2.4a");
const x0Before = await page.evaluate(() => window.__sceneQA.store.trace().X0[3].join(","));
const sel = await page.$('.desk select[aria-label="Token en la posición 3"]');
if (sel) {
  await sel.selectOption({ label: "y" });
  await page.waitForTimeout(400);
  const after2 = await page.evaluate(() => ({ x0: window.__sceneQA.store.trace().X0[3].join(","), print: window.__sceneQA.store.print0 }));
  check("cambiar un token recalcula X₀", after2.x0 !== x0Before);
  check("cambiar un token no cambia θ", after2.print === "f0b9c189", after2.print);
}

await go("5.6a");
const eta = await page.$('.desk input[aria-label^="Tasa de aprendizaje"]');
if (eta) {
  await eta.evaluate((el) => {
    el.value = String(Math.log10(0.2));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.waitForTimeout(300);
  check("η desde la mesa de control actualiza el narrador", /η = 0.2/.test(await guide()), `η = ${(await state()).user.eta}`);
}

await page.click(".transport .icon-btn");
await page.waitForTimeout(400);
s = await state();
check("reiniciar vuelve al paso 1.1 y a los valores iniciales", s.step === "1.1" && s.user.text === "def f(x):" && s.user.eta === 0.5);

await page.keyboard.press("i");
await page.waitForTimeout(200);
check("I oculta el panel lateral", await page.evaluate(() => document.querySelector(".inspector").hasAttribute("hidden")));
await page.keyboard.press("i");
check("sin desplazamiento horizontal de la página", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));

console.log(errors.length ? `ERRORES:\n${errors.join("\n")}` : "sin errores de consola");
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} comprobaciones de interacción correctas`);
await browser.close();
process.exit(failed || errors.length ? 1 : 0);
