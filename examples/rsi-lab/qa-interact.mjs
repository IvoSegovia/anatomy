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
const aboutText = await page.evaluate(() => { const a = document.querySelector(".about"); return a && !a.hidden ? a.textContent : ""; });
check("al abrir, una presentación explica qué es el laboratorio y qué permite", /Qué muestra/.test(aboutText) && /Qué permite/.test(aboutText) && /Qué no es/.test(aboutText));
await page.click('.about [data-about="start"]');
check("«Empezar» la cierra", await page.evaluate(() => document.querySelector(".about").hidden));
const chrome = await page.evaluate(() => ({
  top: document.querySelectorAll(".top button:not(.chapter-list button)").length,
  transport: document.querySelectorAll(".transport button").length,
  stageButtonsVisible: [...document.querySelectorAll(".stage button")].filter((b) => { const r = b.getBoundingClientRect(); const cs = getComputedStyle(b.closest(".autohide") || b); return r.width && cs.opacity !== "0" && getComputedStyle(b).visibility !== "hidden"; }).length,
  legacy: !!document.querySelector(".disclaimer, .narrator-off, .sound-btn, .mode"),
}));
check("interfaz mínima: 3 botones arriba, 3 abajo y sin leyendas fijas sobre la escena", chrome.top === 3 && chrome.transport === 3 && !chrome.legacy, `arriba ${chrome.top} · abajo ${chrome.transport} · visibles en la escena ${chrome.stageButtonsVisible}`);
check("«¿Qué cambió?» es una columna a la izquierda", await page.evaluate(() => { const r = document.querySelector(".rail").getBoundingClientRect(); const st = document.querySelector(".stage").getBoundingClientRect(); return r.left - st.left < 20 && r.height > r.width; }));

await page.evaluate(() => window.__sceneQA.lesson.setWpm(140));
await page.click(".play");
await page.waitForTimeout(2600);
const clockA = await page.evaluate(() => document.querySelector(".clock").textContent);
await page.waitForTimeout(2000);
const playing = await page.evaluate(() => ({ clock: document.querySelector(".clock").textContent, bar: parseFloat((document.querySelector(".g-wait i") || { style: {} }).style.width || "0") }));
check("▶ avanza enseguida: el reloj corre y la barra de lectura se llena", clockA !== playing.clock && playing.bar > 0, `${clockA} → ${playing.clock} · barra ${playing.bar.toFixed(0)} %`);
await page.click(".play");

await go("3.2a");
let s = await state();
check("la orientación detiene la escena antes de la operación", s.phase === "orient" && !s.playing);
await page.click(".transport .next");
await page.waitForTimeout(150);
const afterPerform = (await state()).phase;
if (args.includes("--reduced")) check("movimiento reducido: «Ver la operación» salta sin animar a la operación o su resultado", afterPerform === "act" || afterPerform === "result", afterPerform);
else check("▶| «Ver la operación» pasa a la fase de operación", afterPerform === "act");
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
check("«Más simple» abre una explicación propia del concepto", /Más simple · Q, K y V/.test(await guide()));
await page.click('.g-box [data-act="close-box"]');
await page.waitForTimeout(150);
check("la explicación desplegada se cierra con su botón ×", !(await page.$(".g-box")));
await page.click('[data-act="example"]');
await page.waitForTimeout(150);
check("«Un ejemplo» muestra números pequeños con su procedencia", /Ejemplo/.test(await guide()) && /ejemplo ilustrativo|resultado calculado/.test(await guide()));
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

const plane = await page.$('.plane[data-panel="attn"]');
if (plane) {
  await page.click('.plane[data-panel="attn"] h4 .x');
  await page.waitForTimeout(150);
  const closed = await page.evaluate(() => document.querySelector('.plane[data-panel="attn"]').classList.contains("min"));
  await go("3.6b");
  const still = await page.evaluate(() => document.querySelector('.plane[data-panel="attn"]')?.classList.contains("min"));
  check("× cierra la ventana de datos y queda cerrada en el paso siguiente", closed && still);
  await page.click('.plane[data-panel="attn"] .pl-toggle');
  await page.waitForTimeout(150);
  check("su título la vuelve a abrir", !(await page.evaluate(() => document.querySelector('.plane[data-panel="attn"]').classList.contains("min"))));
  await page.keyboard.press("v");
  await page.waitForTimeout(150);
  const allMin = await page.evaluate(() => [...document.querySelectorAll(".plane")].every((p) => p.classList.contains("min")));
  await page.keyboard.press("v");
  check("V oculta y vuelve a mostrar todas las ventanas", allMin && !(await page.evaluate(() => document.querySelector('.plane[data-panel="attn"]').classList.contains("min"))));
} else check("ventana de la cabeza presente en 3.6", false);
check("la mesa de control empieza plegada", await page.evaluate(() => document.querySelector(".desk").classList.contains("min")));

await go("3.6a");
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
const frozenState = await state();
check("pausar congela el punto actual", !frozenState.playing && frozenState.step === paused.step && Math.abs(frozenState.t - paused.t) < 1e-9);

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
  check("pasar por una celda muestra operandos y resultado", /Q_i·K_j/.test(tip) && /A\[i,j\]/.test(tip), tip.slice(0, 60));
  await page.mouse.click(cellBox.x, cellBox.y);
  await page.waitForTimeout(300);
  const card = await page.evaluate(() => (document.querySelector(".tip.pinned .pick-card") || {}).textContent || "");
  const tab = (await state()).tab;
  check("clic en una celda: rótulo breve encima, sin cambiar el panel, y la lección se pausa", card.length > 0 && tab === "guide" && !(await state()).playing, card.slice(0, 50));
  await page.click(".tip.pinned [data-pick=more]");
  await page.waitForTimeout(200);
  check("«Detalles en el panel» abre la ficha de la celda", /celda 3,1/.test(await guide()));
} else check("celda S[3,1] presente", false);
await page.click("[data-tab=guide]");

if (!args.includes("--reduced")) {
  await go("3.2a");
  await page.evaluate(() => (window.__sceneQA.director.S.speed = 0.25));
  await page.click(".transport .next");
  await page.waitForTimeout(250);
  const midT = await page.evaluate(() => window.__sceneQA.director.S.t);
  await page.click(".insp-body .g-text .term");
  await page.waitForTimeout(400);
  const frozen = await page.evaluate(() => ({ phase: window.__sceneQA.lesson.L.phase, frozen: window.__sceneQA.lesson.L.frozen, t: window.__sceneQA.director.S.t, moving: window.__sceneQA.director.S.stepTo !== null }));
  check("sin reproducción automática, abrir el glosario a mitad de la operación la congela en su punto", frozen.phase === "act" && frozen.frozen && !frozen.moving && frozen.t >= midT, `t = ${frozen.t.toFixed(3)}`);
  await page.evaluate(() => (window.__sceneQA.director.S.speed = 1));
  await page.click(".transport .next");
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
const pickText = await page.evaluate(() => (document.querySelector(".lbl.pick") || {}).textContent || "");
check("clic en un módulo: su nombre y qué hace, encima de él", /Evaluador/.test(pickText) && /criterio/.test(pickText) && (await state()).tab === "guide", pickText.slice(0, 60));
await page.click(".lbl.pick [data-pick=more]");
await page.waitForTimeout(200);
const insp = await guide();
check("«Detalles en el panel» abre la ficha con entradas y salidas", /Evaluador/.test(insp) && /Entradas/.test(insp));
const goBtn = await page.$(".insp-body [data-go]");
if (goBtn) {
  await goBtn.click();
  await page.waitForTimeout(200);
  check("recorrer entradas/salidas desde la ficha", !/^Evaluador$/.test(await page.evaluate(() => document.querySelector(".insp-body h2").textContent)));
}
await page.mouse.click(evalBox.x, evalBox.y);
await page.waitForTimeout(200);
await page.keyboard.press("Escape");
await page.waitForTimeout(200);
check("Esc cierra el rótulo", !(await page.$(".lbl.pick")));
await go("1.1");
await settle();
const focus0 = await page.evaluate(() => document.querySelector("svg.scene").hasAttribute("data-focus"));
const box11 = await page.evaluate(() => { const b = document.querySelector('[data-obj="evaluador"] .iso-fill').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
await page.mouse.click(box11.x, box11.y);
await page.waitForTimeout(200);
const dimmed = await page.evaluate(() => document.querySelector("svg.scene").hasAttribute("data-focus"));
const emptyPt = await page.evaluate(() => { const b = document.querySelector(".stage").getBoundingClientRect(); return { x: b.x + b.width - 30, y: b.y + b.height - 70 }; });
await page.mouse.click(emptyPt.x, emptyPt.y);
await page.waitForTimeout(250);
const back = await page.evaluate(() => ({ focus: document.querySelector("svg.scene").hasAttribute("data-focus"), sel: !!document.querySelector("[data-sel]"), pick: !!document.querySelector(".lbl.pick") }));
check("clic en una zona vacía: la vista vuelve a la inicial, sin nada seleccionado", !focus0 && dimmed && !back.focus && !back.sel && !back.pick);
await page.mouse.click(box11.x, box11.y);
await page.waitForTimeout(200);
await page.click(".lbl.pick [data-pick=close]");
await page.waitForTimeout(250);
check("cerrar el rótulo con × también devuelve la vista inicial", await page.evaluate(() => !document.querySelector("svg.scene").hasAttribute("data-focus") && !document.querySelector("[data-sel]")));
const plateHit = await page.evaluate(() => { const els = [...document.querySelectorAll('[data-obj="plate"] .iso-fill, [data-obj="plate"] path')]; for (const e of els) { const b = e.getBoundingClientRect(); for (const [fx, fy] of [[0.2, 0.5], [0.5, 0.85], [0.8, 0.5], [0.5, 0.2]]) { const x = b.x + b.width * fx, y = b.y + b.height * fy; const t = document.elementFromPoint(x, y); if (t && t.closest("[data-obj]")?.getAttribute("data-obj") === "plate") return { x, y }; } } return null; });
if (plateHit) {
  await page.mouse.click(plateHit.x, plateHit.y);
  await page.waitForTimeout(200);
  check("clic en el piso del laboratorio vuelve a mostrar la presentación", await page.evaluate(() => !document.querySelector(".about").hidden));
  await page.click('.about [data-about="close"]');
} else check("piso del laboratorio alcanzable con un clic", false);
await page.click('[data-tab="refs"]');
await page.click(".live-checks summary");
await page.click("[data-run-checks]");
await page.waitForTimeout(2500);
const checks = await guide();
const m = checks.match(/(\d+)\/(\d+) correctas/);
check("verificación en vivo (Referencias): todas correctas", m && m[1] === m[2], m ? m[0] : checks.slice(0, 60));
await page.click('[data-tab="guide"]');

const cam0 = (await state()).camera;
const box = await page.evaluate(() => {
  const b = document.querySelector(".stage").getBoundingClientRect();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
});
await page.mouse.move(box.x, box.y + 150);
await page.mouse.down();
for (let i = 1; i <= 10; i++) await page.mouse.move(box.x - i * 30, box.y + 150 + i * 3);
await page.mouse.up();
await page.waitForTimeout(300);
const cam1 = (await state()).camera;
check("arrastrar desplaza la vista sin girarla", Math.hypot(cam1.target[0] - cam0.target[0], cam1.target[1] - cam0.target[1]) > 5 && Math.abs(cam1.azimuth - cam0.azimuth) < 1e-9);
await page.mouse.move(box.x, box.y + 150);
await page.mouse.down({ button: "right" });
for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + i * 12, box.y + 150);
await page.mouse.up({ button: "right" });
await page.waitForTimeout(300);
const cam2 = (await state()).camera;
check("botón derecho + arrastrar gira", Math.abs(cam2.azimuth - cam1.azimuth) > 5, `acimut ${cam1.azimuth.toFixed(1)} → ${cam2.azimuth.toFixed(1)}`);
await page.mouse.wheel(0, -400);
await page.waitForTimeout(300);
const cam3 = (await state()).camera;
check("rueda acerca", cam3.scale > cam2.scale * 1.2);
await page.mouse.move(box.x, box.y);
await page.mouse.down();
for (let i = 1; i <= 20; i++) await page.mouse.move(box.x + i * 60, box.y);
await page.mouse.up();
await page.waitForTimeout(200);
const cam4 = (await state()).camera;
check("con zoom y panel abierto se puede seguir desplazando sin tope", Math.hypot(cam4.target[0] - cam3.target[0], cam4.target[1] - cam3.target[1]) > 20);
check("aparece «Volver a la explicación»", !!(await page.$(".back-tour.on")));
await page.click(".back-tour.on");
await page.waitForFunction(() => !window.__sceneQA.director.S.camAnim, null, { timeout: 8000 }).catch(() => {});
check("«Volver a la explicación» restablece la cámara guiada", Math.abs((await state()).camera.azimuth - cam0.azimuth) < 0.5);

await page.keyboard.press("n");
await page.waitForTimeout(250);
check("N oculta el panel (y con él el narrador)", await page.evaluate(() => document.querySelector(".inspector").hasAttribute("hidden") && document.getElementById("app").classList.contains("no-narrator")));
await shot("i-panel-oculto");
await go("3.2a");
await page.click(".play");
await page.waitForTimeout(4200);
s = await state();
check("con el panel oculto, ▶ no espera el tiempo de lectura", s.phase !== "orient" || s.step !== "3.2a", `${s.step} · ${s.phase}`);
await page.click(".play");
await page.keyboard.press("n");
await page.waitForTimeout(250);
check("N vuelve a mostrarlo", !(await page.evaluate(() => document.getElementById("app").classList.contains("no-narrator"))) && /Capítulo/.test(await guide()));

await page.click(".chapter-btn");
await page.waitForTimeout(150);
const listOpen = await page.evaluate(() => !document.querySelector(".chapter-list").hidden);
await page.click('.chapter-list [data-chapter="4"]');
await page.waitForTimeout(400);
s = await state();
check("el menú de capítulos lista los 10 y lleva al elegido", listOpen && s.chapter === 5 && (await page.evaluate(() => document.querySelector(".chapter-list").hidden)), `capítulo ${s.chapter}`);

await go("3.1");
await page.click(".desk .pl-toggle");
await page.waitForTimeout(150);
const text1 = await guide();
await page.click('.desk .seg button:nth-child(2)');
await page.waitForTimeout(300);
const text2 = await guide();
check("cambiar la cabeza recalcula el texto del narrador", /cabeza 1/.test(text1) && /cabeza 2/.test(text2) && text1 !== text2);
await page.click('.desk .seg button:nth-child(1)');
await page.click(".desk h3 .x");
check("la mesa de control se cierra con ×", await page.evaluate(() => document.querySelector(".desk").classList.contains("min")));

await go("2.4a");
await page.click(".desk .pl-toggle");
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

await page.click(".top .icon-btn[aria-label='Ajustes y atajos']");
await page.waitForTimeout(200);
const settings = await guide();
check("«?» abre Ajustes: sonido, ritmo, ventanas, reinicio y atajos", /Activar sonidos/.test(settings) && /lectura/.test(settings) && /ventanas de datos/.test(settings) && /Teclado/.test(settings));
await page.click('[data-set="reset"]');
await page.waitForTimeout(400);
s = await state();
check("reiniciar (en Ajustes) vuelve al paso 1.1 y a los valores iniciales", s.step === "1.1" && s.user.text === "def f(x):" && s.user.eta === 0.5);
await page.click('[data-tab="guide"]');

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
