import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const reduced = process.argv.includes("--reduced");
let chromium;
try {
  chromium = createRequire(import.meta.url)("playwright").chromium;
} catch {
  chromium = createRequire("/opt/node22/lib/node_modules/")("playwright").chromium;
}
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/opt/pw-browsers/chromium", args: ["--autoplay-policy=user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: reduced ? "reduce" : "no-preference" });
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

const features = await page.evaluate(async () => {
  const q = window.__sceneQA;
  const sr = 44100;
  const out = {};
  for (const op of q.soundOps) {
    const x = await q.renderOffline(op, { sampleRate: sr, level: 0.5 });
    let peak = 0;
    let first = -1;
    let last = -1;
    for (let i = 0; i < x.length; i++) {
      const a = Math.abs(x[i]);
      if (a > peak) peak = a;
      if (a > 1e-3) {
        if (first < 0) first = i;
        last = i;
      }
    }
    const frame = Math.round(sr * 0.01);
    const env = [];
    for (let i = first; i < last; i += frame) {
      let e = 0;
      for (let j = i; j < Math.min(last, i + frame); j++) e += x[j] * x[j];
      env.push(Math.sqrt(e / frame));
    }
    const top = Math.max(...env);
    let pulses = 0;
    let armed = true;
    for (const e of env) {
      if (armed && e > top * 0.45) {
        pulses += 1;
        armed = false;
      } else if (e < top * 0.2) armed = true;
    }
    const zcr = (a, b) => {
      let n = 0;
      for (let i = a + 1; i < b; i++) if ((x[i - 1] < 0) !== (x[i] < 0)) n += 1;
      return (n / 2) * (sr / Math.max(1, b - a));
    };
    const third = Math.floor((last - first) / 3);
    const f1 = zcr(first, first + third);
    const f3 = zcr(last - third, last);
    const N = 1024;
    let peakAt = first;
    for (let i = first; i < last; i++) if (Math.abs(x[i]) === peak) peakAt = i;
    const start = Math.max(0, Math.min(x.length - N, peakAt - N / 4));
    const frameData = new Float64Array(N);
    for (let n = 0; n < N; n++) frameData[n] = x[start + n] * (0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (N - 1)));
    let num = 0;
    let den = 0;
    for (let kk = 1; kk < N / 2; kk++) {
      let re = 0;
      let im = 0;
      for (let n = 0; n < N; n++) {
        re += frameData[n] * Math.cos((2 * Math.PI * kk * n) / N);
        im -= frameData[n] * Math.sin((2 * Math.PI * kk * n) / N);
      }
      const mag = Math.hypot(re, im);
      num += mag * ((kk * sr) / N);
      den += mag;
    }
    out[op] = {
      peak,
      duration: (last - first) / sr,
      startJump: Math.abs(x[first]),
      tail: Math.abs(x[x.length - 1]),
      pulses,
      centroid: den ? num / den : 0,
      contour: f3 / Math.max(1, f1),
    };
  }
  return out;
});

const ops = Object.keys(features);
for (const op of ops) {
  const f = features[op];
  console.log(`  ${op.padEnd(10)} pico ${f.peak.toFixed(3)} · ${(f.duration * 1000).toFixed(0)} ms · pulsos ${f.pulses} · centroide ${f.centroid.toFixed(0)} Hz · contorno ${f.contour.toFixed(2)}`);
}
check("las 12 familias se generan con Web Audio en un contexto sin conexión", ops.length === 12 && ops.every((op) => features[op].duration > 0.02));
check("ninguna familia satura (pico < 0.9 con volumen 0.5)", ops.every((op) => features[op].peak < 0.9), `máx ${Math.max(...ops.map((op) => features[op].peak)).toFixed(3)}`);
check("sin clics al empezar ni al terminar (envolventes con rampa)", ops.every((op) => features[op].startJump < 0.02 && features[op].tail < 1e-3));
check("todas son breves (< 600 ms): no compiten con la lectura", ops.every((op) => features[op].duration < 0.6));
const vec = (f) => [Math.log(f.duration * 1000) / 2, f.pulses / 2, Math.log(Math.max(50, f.centroid)) * 1.2, Math.log(Math.max(0.2, f.contour)) * 1.5];
let minD = Infinity;
let pair = "";
for (let i = 0; i < ops.length; i++)
  for (let j = i + 1; j < ops.length; j++) {
    const a = vec(features[ops[i]]);
    const b = vec(features[ops[j]]);
    const d = Math.hypot(...a.map((v, k) => v - b[k]));
    if (d < minD) {
      minD = d;
      pair = `${ops[i]}–${ops[j]}`;
    }
  }
check("cada familia difiere de las demás en duración, pulsos, timbre o contorno (medido, no escuchado)", minD > 0.25, `distancia mínima ${minD.toFixed(2)} entre ${pair}`);
check("promoción sube y rechazo baja (convención declarada en la leyenda)", features.promote.contour > 1.2 && features.reject.contour < 0.85 && features.gradient.contour < 0.85, `promover ${features.promote.contour.toFixed(2)} · rechazar ${features.reject.contour.toFixed(2)} · gradiente ${features.gradient.contour.toFixed(2)}`);

const guideOff = await page.evaluate(() => {
  const q = window.__sceneQA;
  q.go(q.lesson.steps.findIndex((s) => s.id === "3.6a"), "result");
  return document.querySelector(".insp-body .g-text:not(.dim)").textContent;
});
await page.click(".sound-btn");
await page.waitForTimeout(400);
const audio = await page.evaluate(() => ({ enabled: window.__sceneQA.sound.enabled, state: window.__sceneQA.sound.state }));
check("«Activar sonidos» crea y reanuda el AudioContext desde un clic", audio.enabled && audio.state === "running", audio.state);
const guideOn = await page.evaluate(() => document.querySelector(".insp-body .g-text:not(.dim)").textContent);
check("la explicación es idéntica con el sonido activado o apagado", guideOn === guideOff);

const idx = (id) => page.evaluate((sid) => window.__sceneQA.lesson.steps.findIndex((s) => s.id === sid), id);
const logLen = () => page.evaluate(() => window.__sceneQA.sound.log.length);
const logFrom = (n) => page.evaluate((k) => window.__sceneQA.sound.log.slice(k).map((e) => ({ op: e.op, id: e.id, played: e.played, reason: e.reason })), n);
const settle = () => page.waitForFunction(() => window.__sceneQA.director.S.stepTo === null, null, { timeout: 10000 }).catch(() => {});

await page.evaluate((i) => window.__sceneQA.go(i), await idx("3.2a"));
let n0 = await logLen();
await page.click(".learn-primary");
await settle();
await page.waitForTimeout(500);
let played = (await logFrom(n0)).filter((e) => e.played);
check("una operación suena una vez por señal (3.2a: producto y suma)", played.length === 2 && played[0].op === "matmul" && played[1].op === "sum", played.map((e) => e.op).join(", "));
const ids = played.map((e) => e.id);
check("sin duplicados: cada evento tiene un identificador propio", new Set(ids).size === ids.length);

n0 = await logLen();
await page.evaluate(() => window.__sceneQA.lesson.seekShare(0.62));
await page.waitForTimeout(400);
await page.evaluate(() => window.__sceneQA.lesson.seekShare(0.2));
await page.waitForTimeout(400);
check("buscar en la línea de tiempo no reproduce sonidos intermedios", (await logFrom(n0)).every((e) => !e.played));

await page.evaluate((i) => window.__sceneQA.go(i), await idx("3.3b"));
await page.click(".learn-primary");
await page.waitForTimeout(500);
await page.click(".play");
await page.click(".play");
await page.waitForTimeout(200);
n0 = await logLen();
await page.waitForTimeout(2000);
const afterPause = await logFrom(n0);
check("después de pausar no suena nada", afterPause.every((e) => !e.played), `${afterPause.filter((e) => e.played).length} sonidos`);
const stopped = await page.evaluate(() => window.__sceneQA.sound.log.some((e) => e.op === "silencio"));
check("pausar cancela lo programado y apaga suave lo activo", stopped && (await page.evaluate(() => window.__sceneQA.sound.activeVoices())) === 0);

await page.evaluate((i) => window.__sceneQA.go(i), await idx("3.5"));
n0 = await logLen();
await page.keyboard.press("r");
await settle();
await page.waitForTimeout(400);
const first = (await logFrom(n0)).filter((e) => e.played).length;
n0 = await logLen();
await page.keyboard.press("r");
await settle();
await page.waitForTimeout(400);
const second = (await logFrom(n0)).filter((e) => e.played).length;
check("«Repetir esta operación» vuelve a habilitar su sonido, una vez por repetición", first === 1 && second === 1, `${first} y ${second}`);

await page.keyboard.press("x");
n0 = await logLen();
await page.keyboard.press("r");
await settle();
await page.waitForTimeout(300);
const muted = await logFrom(n0);
check("X silencia al instante (las señales se registran, no suenan)", muted.some((e) => e.reason === "silenciado") && muted.every((e) => !e.played));
await page.keyboard.press("x");

await page.evaluate((i) => window.__sceneQA.go(i), await idx("3.3b"));
await page.click(".learn-primary");
await page.waitForTimeout(300);
await page.evaluate(() => {
  Object.defineProperty(document, "hidden", { value: true, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
});
n0 = await logLen();
await page.waitForTimeout(1500);
check("ocultar la pestaña detiene la lección y no suena nada", (await logFrom(n0)).every((e) => !e.played) && !(await page.evaluate(() => window.__sceneQA.lesson.L.auto)));
await page.evaluate(() => {
  Object.defineProperty(document, "hidden", { value: false, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
});

if (reduced) {
  await page.evaluate((i) => window.__sceneQA.go(i), await idx("3.2a"));
  n0 = await logLen();
  await page.click(".learn-primary");
  await page.waitForTimeout(900);
  const red = (await logFrom(n0)).filter((e) => e.played);
  check("movimiento reducido: la operación salta al resultado y sus dos señales suenan escalonadas", red.length === 2 && (await page.evaluate(() => window.__sceneQA.lesson.L.phase)) === "result");
}

console.log(errors.length ? `ERRORES:\n${errors.join("\n")}` : "sin errores de consola");
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} comprobaciones de audio correctas`);
console.log("Límite: se midieron las señales generadas y los eventos; no se evaluó perceptualmente (en este entorno no hay salida de audio).");
await browser.close();
process.exit(failed || errors.length ? 1 : 0);
