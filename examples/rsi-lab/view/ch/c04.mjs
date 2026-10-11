import { baseVisibility, explode, trayRegion, rackCamera, cutAbove, fade } from "../common.mjs";
import { f2, f3, T, esc, lineChart } from "../helpers.mjs";
import { el } from "../ui.mjs";
import { rackSetup } from "./c02.mjs";
import { VOCAB } from "../../model/tokenizer.mjs";
import { gelu } from "../../model/linalg.mjs";
import { argmax, temperatureProbs, prefillCache, stepWithCache, forward, invalidateFrom, paramPrint } from "../../model/transformer.mjs";

const last = (m) => m[m.length - 1];
const vec = (v) => `[${v.map(f2).join(", ")}]`;

function blockPanel(ctx, active, subst) {
  const on = (key) => active.includes(key);
  const html = `<div class="formula">
    <div>${T("MHA", "", "", on("mha"))}(${T("X̃", "in")}) = [${T("Z<sub>1</sub>", "in", "", on("mha"))} ${T("Z<sub>2</sub>", "in", "", on("mha"))}] ${T("W<sub>O</sub>", "w", "mx-b0-wo", on("mha"))}</div>
    <div>${T("H", "in", "", on("H"))} = ${T("X", "in", "", on("H"))} + MHA(${T("LN<sub>1</sub>", "", "", on("H"))}(X))</div>
    <div>${T("Y", "in", "", on("Y"))} = ${T("H", "in", "", on("Y"))} + ${T("MLP", "", "", on("Y"))}(${T("LN<sub>2</sub>", "", "", on("Y"))}(H))</div>
    <div>MLP(u) = ${T("GELU", "", "", on("gelu"))}(u ${T("W<sub>1</sub>", "w", "mx-b0-w1", on("gelu"))} + b<sub>1</sub>) ${T("W<sub>2</sub>", "w", "mx-b0-w2", on("gelu"))} + b<sub>2</sub></div></div>
    <div class="subst">${subst || ""}</div>`;
  ctx.panel("block", { title: "Bloque pre-LN (elección didáctica)", provKind: "local", html, width: 380 });
}

function outPanel(ctx, active, subst) {
  const on = (key) => active.includes(key);
  const html = `<div class="formula"><div>${T("z", "in", "", on("z"))} = ${T("LN<sub>f</sub>", "", "", on("z"))}(${T("h<sub>n</sub>", "in")}) ${T("W<sub>U</sub>", "w", "mx-Wu", on("z"))} + b<sub>U</sub></div>
    <div>${T("p", "in", "", on("p"))} = softmax(${T("z", "in")}), &nbsp; ${T("p<sub>T</sub>", "in", "", on("T"))} ∝ exp(z / ${T("T", "", "", on("T"))})</div></div><div class="subst">${subst || ""}</div>`;
  ctx.panel("out", { title: "Salida y siguiente token", provKind: "local", html, width: 380 });
}

function kvDiagram(n, newRow, invalidFrom) {
  const cell = 13;
  const blocks = [];
  for (let b = 0; b < 2; b++)
    for (let h = 0; h < 2; h++) {
      const rows = [];
      for (let t = 0; t < n; t++) {
        const inval = invalidFrom !== null && t >= invalidFrom;
        const fresh = newRow !== null && t === newRow;
        const color = inval ? "#3a3d44" : fresh ? "#ffffff" : "var(--c-in)";
        rows.push(`<rect x="${t * cell}" y="0" width="${cell - 2}" height="10" rx="1.5" fill="${color}" opacity="${inval ? 1 : fresh ? 0.95 : 0.7}"/>${inval ? `<path d="M${t * cell} 10L${t * cell + cell - 2} 0" stroke="#ff6a6a" stroke-width="1"/>` : ""}`);
      }
      blocks.push(`<g transform="translate(70 ${(b * 2 + h) * 18})">${rows.join("")}</g><text x="0" y="${(b * 2 + h) * 18 + 9}">bloque ${b + 1} · c${h + 1}</text>`);
    }
  return `<svg class="chart" viewBox="0 0 ${80 + n * cell} 76">${blocks.join("")}</svg>`;
}

export const chapter4 = {
  title: "Bloque completo y siguiente token",
  showTheta: true,
  question: "¿Cómo se convierte el estado de la última posición en una predicción?",
  setup(ctx) {
    rackSetup(ctx);
    for (const id of ["head-b0-0", "head-b0-1"]) ctx.state(id, { open: 0 });
    ctx.state("vec-b0", { which: "X", x: 136 });
    ctx.state("vec-b1", { which: "X", x: 136 });
    ctx.state("mx-Wu", {});
    ctx.state("bars-out", {});
    ctx.state("card-next", {});
  },
  desk(ctx) {
    ctx.desk("Muestreo y caché", (desk) => {
      const value = el("span", { class: "val" }, ctx.user.temperature.toFixed(2));
      const slider = el("input", { type: "range", min: "0.1", max: "3", step: "0.05", value: String(ctx.user.temperature), "aria-label": "Temperatura de muestreo T" });
      slider.addEventListener("input", () => {
        ctx.user.temperature = Number(slider.value);
        value.textContent = ctx.user.temperature.toFixed(2);
        ctx.engine.dirty("bars-out");
        ctx.refresh();
      });
      const seed = el("input", { type: "number", min: "1", max: "999", value: String(ctx.user.sampleSeed), "aria-label": "Semilla del muestreo", style: "width:64px;background:var(--panel-2);border:1px solid var(--line-2);border-radius:4px;padding:1px 4px" });
      seed.addEventListener("change", () => {
        ctx.user.sampleSeed = Math.max(1, Math.round(Number(seed.value) || 1));
        ctx.refresh();
      });
      desk.append(el("div", { class: "row" }, el("label", {}, "temperatura T"), slider, value), el("div", { class: "row" }, el("label", {}, "semilla del muestreo"), seed), el("div", { class: "note" }, "T sólo reescala logits al muestrear: no cambia pesos. Con la misma semilla, el muestreo se repite exactamente."));
    });
  },
  beats: [
    {
      id: "4.1",
      dur: 9,
      scale: "model",
      camera: () => trayRegion("b0", [0, 0, 186, 96], { area: { left: 400 } }),
      caption: "Las dos cabezas producen Z₁ y Z₂ (n×4 cada una). Se <b>concatenan</b> (n×8) y se proyectan con <b>W_O</b> (8×8).",
      changed: { contexto: "activo" },
      more: `<p>Cada cabeza aprende a mezclar información de forma distinta. La concatenación vuelve a la anchura 8 y W_O las combina.</p>`,
      pose(ctx, t) {
        cutAbove(ctx, "b0");
        fade(ctx, ["blk-b0", "mx-b0-wo", "mx-b0-w1", "mx-b0-w2", "vec-b0", "head-b0-0", "head-b0-1"], 1);
        const tr = ctx.store.trace().blocks[0];
        ctx.focus(["head-b0-0", "head-b0-1", "mx-b0-wo", "blk-b0"]);
        ctx.tag("lb-h0", "head-b0-0", "cabeza 1 → Z₁", { dz: 8, role: "in" });
        ctx.tag("lb-h1", "head-b0-1", "cabeza 2 → Z₂", { dz: 8, role: "in" });
        ctx.tag("lb-wo", "mx-b0-wo", "W_O · 8×8", { dz: 6, role: "w" });
        blockPanel(ctx, ["mha"], `última fila: Z₁ = ${vec(last(tr.heads[0].Z))}\n            Z₂ = ${vec(last(tr.heads[1].Z))}\n[Z₁ Z₂] W_O = ${vec(last(tr.attnOut))}`);
        if (!ctx.still.matches && t > 0.001 && t < 0.999) for (let i = 0; i < 2; i++) ctx.pulse(i, { path: [[ -280 + 48, -233 + 22 + i * 36, 220], [-280 + 80, -233 + 30, 222]].map(([x, y, z]) => [x, y, z]), s: (t * 1.5 + i * 0.5) % 1, role: "in" });
      },
    },
    {
      id: "4.2",
      dur: 9,
      scale: "model",
      camera: () => trayRegion("b0", [0, 0, 186, 96], { area: { left: 400 } }),
      caption: "<b>Conexión residual</b>: el objeto de entrada X se conserva por el bus cian y se le <b>suma</b> la salida de la atención: H = X + MHA(LN(X)).",
      changed: { contexto: "activo" },
      more: `<p>La suma residual no reemplaza X: lo conserva y le añade una corrección. Por eso la anchura (8) es la misma en todo el flujo.</p>`,
      pose(ctx, t) {
        cutAbove(ctx, "b0");
        const tr = ctx.store.trace().blocks[0];
        const which = t < 0.45 ? "X" : "H";
        ctx.state("vec-b0", { which, x: 136 });
        ctx.focus(["blk-b0", "vec-b0", "mx-b0-wo"]);
        ctx.tag("lb-vec", "vec-b0", which === "X" ? "X (se conserva)" : "H = X + MHA", { dz: 6, role: "in" });
        blockPanel(ctx, ["H"], `última fila\n X   = ${vec(last(tr.X))}\n+MHA = ${vec(last(tr.attnOut))}\n H   = ${vec(last(tr.H))}`);
      },
    },
    {
      id: "4.3",
      dur: 11,
      events: 3,
      scale: "model",
      camera: () => trayRegion("b0", [90, 0, 186, 96], { area: { left: 400 } }),
      caption: (ctx) => ["<b>LN₂</b> normaliza H fila a fila.", "<b>W₁</b> (8→32) y <b>GELU</b>: una no linealidad suave aplicada componente a componente.", "<b>W₂</b> (32→8) y segunda suma residual: <b>Y = H + MLP(LN(H))</b>."][Math.max(0, ctx.event - 1)],
      changed: { contexto: "activo" },
      more: `<p>GELU(x) = 0.5·x·(1 + tanh(√(2/π)(x + 0.044715 x³))) (aproximación con tanh). Deja pasar casi intactos los valores positivos grandes y atenúa los negativos.</p>`,
      refs: ["gelu", "gpt2"],
      pose(ctx, t, e) {
        cutAbove(ctx, "b0");
        const tr = ctx.store.trace().blocks[0];
        const u = last(tr.U);
        const g = last(tr.G);
        ctx.state("vec-b0", { which: e >= 3 ? "Y" : "H", x: 136 });
        ctx.focus(e <= 1 ? ["blk-b0", "vec-b0"] : e === 2 ? ["mx-b0-w1", "blk-b0"] : ["mx-b0-w2", "blk-b0", "vec-b0"]);
        ctx.tag("lb-w1", "mx-b0-w1", "W₁ · 8×32", { dz: 6, role: "w" });
        ctx.tag("lb-w2", "mx-b0-w2", "W₂ · 32×8", { dz: 6, role: "w" });
        const xs = Array.from({ length: 61 }, (_, i) => -4 + i * (8 / 60));
        const chart = lineChart([{ values: xs.map(gelu), cls: "tr" }], { w: 340, h: 120, xLabel: "x (−4 … 4)", yLabel: "GELU(x)", yMin: -0.5, yMax: 4, xTicks: [0, 30, 60] });
        blockPanel(ctx, e <= 1 ? ["Y"] : ["gelu"], e === 0 ? `H última fila = ${vec(last(tr.H))}` : e === 1 ? `LN₂(H) última fila = ${vec(last(tr.ln2.out))}` : e === 2 ? `u = LN₂(H)W₁ + b₁ (primeros 8 de 32): ${u.slice(0, 8).map(f2).join(" ")}…\nGELU(u): ${g.slice(0, 8).map(f2).join(" ")}…` : `Y = H + MLP = ${vec(last(tr.Y))}`);
        if (e === 1 || e === 2) ctx.panel("gelu", { title: "GELU", html: chart, width: 360, top: 330 });
      },
    },
    {
      id: "4.4",
      dur: 6,
      scale: "model",
      camera: () => trayRegion("b1", [0, 0, 186, 96], { area: { left: 400 } }),
      caption: "El <b>bloque 2</b> repite la misma operación con otros pesos: Y₂ = H₂ + MLP(LN(H₂)), H₂ = Y₁ + MHA(LN(Y₁)).",
      changed: { contexto: "activo" },
      pose(ctx, t) {
        cutAbove(ctx, "b1", 1, ctx.still.matches ? 1 : Math.min(1, t * 2.5));
        const tr = ctx.store.trace().blocks[1];
        ctx.state("vec-b1", { which: "Y", x: 136 });
        ctx.focus(["blk-b1", "vec-b1", "head-b1-0", "head-b1-1", "mx-b1-wo", "mx-b1-w1", "mx-b1-w2"]);
        ctx.tag("lb-v1", "vec-b1", "Y₂ (n×8)", { dz: 6, role: "in" });
        blockPanel(ctx, ["H", "Y"], `última fila de Y₂ = ${vec(last(tr.Y))}`);
      },
    },
    {
      id: "4.5",
      dur: 11,
      events: 3,
      scale: "model",
      camera: () => trayRegion("out", [0, 0, 186, 96], { area: { left: 400 } }),
      caption: (ctx) => ["Sólo la <b>última posición</b> predice el siguiente token: h_n pasa por la LayerNorm final.", "<b>W_U</b> (8×16) da 16 logits, uno por símbolo del vocabulario (gris: negativos).", "<b>softmax</b>: 16 probabilidades que suman 1. Con estos pesos aleatorios, el resultado no expresa comprensión."][Math.max(0, ctx.event - 1)],
      changed: { contexto: "activo" },
      pose(ctx, t, e) {
        cutAbove(ctx, "out", 1, ctx.still.matches || e > 1 ? 1 : Math.min(1, t * 6));
        const tr = ctx.store.trace();
        ctx.state("bars-out", { showLogits: e >= 2, showProbs: e >= 3, chosen: e >= 3 ? argmax(tr.probs) : undefined });
        ctx.state("card-next", {});
        ctx.focus(e <= 1 ? ["out-base"] : e === 2 ? ["mx-Wu", "bars-out"] : ["bars-out"]);
        ctx.tag("lb-wu", "mx-Wu", "W_U · 8×16", { dz: 6, role: "w" });
        ctx.tag("lb-bars", "bars-out", e >= 3 ? "logits (arriba) · p (abajo)" : "logits", { dz: 14, role: "in" });
        const top = [...tr.probs.keys()].sort((a, b) => tr.probs[b] - tr.probs[a]).slice(0, 4);
        outPanel(ctx, e <= 1 ? ["z"] : e === 2 ? ["z"] : ["p"], e <= 1 ? `h_n = ${vec(tr.hLast)}\nLN_f(h_n) = ${vec(tr.lnf.out)}` : e === 2 ? `z = ${tr.logits.map(f2).join(" ")}` : `más probables: ${top.map((j) => `«${esc(VOCAB[j])}» ${f3(tr.probs[j])}`).join(" · ")}\nΣ p = ${tr.probs.reduce((a, b) => a + b, 0).toFixed(12)}`);
      },
    },
    {
      id: "4.6",
      dur: 10,
      events: 2,
      scale: "model",
      camera: () => trayRegion("out", [60, 0, 186, 96], { area: { left: 400 } }),
      caption: (ctx) => (ctx.event <= 1 ? `<b>argmax</b>: elegir siempre el más probable → «${esc(VOCAB[argmax(ctx.store.trace().probs)])}».` : `<b>Muestreo con temperatura</b> T = ${ctx.user.temperature.toFixed(2)} (semilla ${ctx.user.sampleSeed}) → «${esc(VOCAB[ctx.store.generation().sampled.generated[0].id])}». T > 1 aplana p; T < 1 la concentra.`),
      changed: { contexto: "activo" },
      more: `<p>p_T(i) = exp(z_i/T) / Σ exp(z_j/T). Cuando T → 0 tiende a argmax; cuando T crece tiende a la uniforme. El muestreo usa un generador con semilla: se puede repetir exactamente.</p>`,
      pose(ctx, t, e) {
        cutAbove(ctx, "out");
        const tr = ctx.store.trace();
        const gen = ctx.store.generation();
        const greedy = argmax(tr.probs);
        const pT = temperatureProbs(tr.logits, ctx.user.temperature);
        const chosen = e === 0 ? undefined : e === 1 ? greedy : gen.sampled.generated[0].id;
        ctx.state("bars-out", { showLogits: true, showProbs: true, probs: e <= 1 ? tr.probs : pT, chosen });
        ctx.state("card-next", chosen === undefined ? {} : { id: chosen });
        ctx.focus(["bars-out", "card-next"]);
        ctx.tag("lb-next", "card-next", "siguiente token", { dz: 8, role: "ok" });
        outPanel(ctx, e <= 1 ? ["p"] : ["T"], e <= 1 ? `argmax p = ${greedy} («${esc(VOCAB[greedy])}», p = ${f3(tr.probs[greedy])})` : `p_T (T = ${ctx.user.temperature.toFixed(2)}): ${pT.map((v) => v.toFixed(2)).join(" ")}\nmuestra (semilla ${ctx.user.sampleSeed}) = ${chosen} «${esc(VOCAB[chosen])}»`);
      },
    },
    {
      id: "4.7",
      dur: 13,
      events: 3,
      scale: "model",
      camera: () => rackCamera(1),
      caption: (ctx) => ["<b>Caché KV</b>: al procesar el prefijo se guardan K y V de cada posición, en cada bloque y cabeza.", "Para el token siguiente sólo se calcula <b>una fila nueva</b> por bloque y cabeza; las anteriores se reutilizan. Resultado idéntico al recálculo completo.", "Si cambia el prefijo en la posición p, las entradas de posiciones ≥ p quedan <b>invalidadas</b>; las anteriores siguen sirviendo."][Math.max(0, ctx.event - 1)],
      changed: { contexto: "cambió" },
      more: `<p>En un decodificador causal, K y V de la posición t sólo dependen de los tokens 0…t. Por eso se pueden guardar. Si se cambia el token de la posición p, todo lo que depende de él (posiciones ≥ p, en todos los bloques) hay que recalcularlo.</p>`,
      pose(ctx, t, e) {
        const ids = ctx.store.ids();
        const n = ids.length;
        const params = ctx.store.params0;
        const { cache, last: lastStep } = prefillCache(params, ids);
        const next = argmax(lastStep.logits);
        const step = stepWithCache(params, cache, next);
        const full = forward(params, [...ids, next]);
        const diff = Math.max(...step.logits.map((v, i) => Math.abs(v - full.logits[i])));
        const p = Math.min(3, n - 1);
        const diagram = e <= 1 ? kvDiagram(n, null, null) : e === 2 ? kvDiagram(n + 1, n, null) : kvDiagram(n, null, p);
        const kept = invalidateFrom(cache, p);
        ctx.panel("kv", {
          title: "Caché KV · 2 bloques × 2 cabezas",
          provKind: "local",
          html: `${diagram}<div class="legend"><span style="color:var(--c-in)"><i></i>guardada</span><span style="color:#fff"><i></i>calculada ahora</span><span style="color:#ff6a6a"><i></i>invalidada</span></div><div class="subst">${e <= 1 ? `prefijo de ${n} tokens: ${n} filas K y V por bloque y cabeza` : e === 2 ? `token ${n}: «${esc(VOCAB[next])}» · filas nuevas calculadas: 1 por bloque y cabeza\n|logits(caché) − logits(recálculo)| máx = ${diff.toExponential(1)}` : `cambiar el token ${p} invalida las filas ${p}…${n - 1}; se conservan ${kept.blocks[0].K[0].length} filas`}</div>`,
          width: 380,
        });
        ctx.focus(["tray-b0", "tray-b1", "head-b0-0", "head-b0-1", "head-b1-0", "head-b1-1"]);
      },
    },
    {
      id: "4.8",
      dur: 6,
      scale: "model",
      camera: () => rackCamera(1),
      caption: "La conversación avanza (el contexto crece), pero <b>ningún peso cambió</b>: la huella de θ es la misma que al principio.",
      changed: { contexto: "cambió" },
      pose(ctx) {
        ctx.theta(paramPrint(ctx.store.params0), `idéntica a la inicial (${ctx.store.print0})`);
        ctx.focus(null);
        const gen = ctx.store.generation();
        ctx.panel("gen", { title: "Generación (argmax)", provKind: "local", html: `<div class="subst">${esc(ctx.store.ids().map((id) => VOCAB[id]).join(" "))} <b>${esc(gen.greedy.generated.map((g) => VOCAB[g.id]).join(" "))}</b>\nθ antes: ${ctx.store.print0} · θ después: ${paramPrint(ctx.store.params0)}</div>`, width: 360 });
      },
    },
  ],
};
