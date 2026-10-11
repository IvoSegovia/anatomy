// Capítulo 3 — Atención causal por dentro (escala «tensores»).
import { baseVisibility, explode, cubeCamera, trayCamera, framesFor, TENSOR_IDS, cutAbove } from "../common.mjs";
import { lerpFrame } from "../tensors.mjs";
import { cellCentre } from "../matrix.mjs";
import { ease } from "../engine.mjs";
import { f2, f3, T, esc } from "../helpers.mjs";
import { el } from "../ui.mjs";
import { rackSetup } from "./c02.mjs";
import { VOCAB } from "../../model/tokenizer.mjs";

const rowOf = (ctx) => Math.min(ctx.store.ids().length - 1, Math.max(0, ctx.user.row));
const headData = (ctx) => {
  const tr = ctx.store.trace();
  return { tr, head: tr.blocks[0].heads[ctx.user.head], block: tr.blocks[0], p: ctx.store.params0.blocks[0] };
};

// Plano de fórmulas: cada término está vinculado (color e identidad) a un objeto de la escena.
function attnPanel(ctx, active, subst = "") {
  const on = (key) => active.includes(key);
  const html = `<div class="formula">
    <div>${T("Q", "in", "t-Q", on("Q"))} = ${T("X", "in", "t-X", on("X"))}${T("W<sub>Q</sub>", "w", "t-Wq", on("Q"))}, &nbsp;${T("K", "in", "t-K", on("K"))} = ${T("X", "in", "t-X", on("X"))}${T("W<sub>K</sub>", "w", "t-Wk", on("K"))}, &nbsp;${T("V", "in", "t-V", on("V"))} = ${T("X", "in", "t-X", on("X"))}${T("W<sub>V</sub>", "w", "t-Wv", on("V"))}</div>
    <div>${T("A", "in", "t-S", on("A"))} = ${T("softmax", "", "", on("soft"))}( ${T("Q", "in", "t-Q", on("QK"))}${T("K<sup>T</sup>", "in", "t-K", on("QK"))} ${T("/ √d<sub>k</sub>", "", "", on("scale"))} ${T("+ M", "off", "", on("mask"))} )</div>
    <div>${T("Z", "in", "t-Z", on("Z"))} = ${T("A", "in", "t-S", on("Z"))}${T("V", "in", "t-V", on("Z"))}</div></div>
    <div class="subst">${subst}</div>`;
  ctx.panel("attn", { title: `Cabeza ${ctx.user.head + 1} · bloque 1 · d_k = 4`, html, provKind: "local", width: 420, dock: "left" });
}

function numbers(ctx, planeId, frameKey, row, values, { prefix = "", cols, n } = {}) {
  const frames = framesFor(ctx.store.ids().length);
  const frame = typeof frameKey === "string" ? frames[frameKey] : frameKey;
  (cols || values.map((_, j) => j)).forEach((j) => {
    const v = values[j];
    ctx.label(`${prefix}${planeId}-${row}-${j}`, { obj: planeId, local: cellCentre(frame, row, j), cls: "num", html: `<span>${v === -Infinity ? "−∞" : f2(v)}</span>`, minPx: 9 });
  });
}

function planesBase(ctx, { at = {}, pending = {}, values = {}, masked = {}, opacity = {}, highlight = {}, rowHi = {} } = {}) {
  for (const id of ["t-X", "t-Wq", "t-Wk", "t-Wv", "t-Q", "t-K", "t-V", "t-S", "t-Z"]) {
    ctx.pose(id, {
      visible: (opacity[id] ?? 1) > 0,
      opacity: opacity[id] ?? 1,
      state: { at: typeof at[id] === "string" ? at[id] : undefined, frame: typeof at[id] === "object" ? at[id] : undefined, pending: pending[id], values: values[id], masked: masked[id], highlight: highlight[id], rowHi: rowHi[id] },
    });
  }
}

export const chapter3 = {
  title: "Atención causal por dentro",
  question: "¿Cómo decide una posición cuánto tomar de las anteriores?",
  setup(ctx) {
    rackSetup(ctx);
    baseVisibility(ctx, { rack: true, tensors: true });
    explode(ctx, 1);
    // las bandejas superiores se retiran para no tapar la cabeza abierta (corte)
    cutAbove(ctx, "b0");
    // dentro de la bandeja del bloque 1 sólo queda la cabeza abierta (corte)
    for (const id of ["blk-b0", "mx-b0-wo", "mx-b0-w1", "mx-b0-w2", "vec-b0", "head-b0-0", "head-b0-1"]) ctx.show(id, false);
    ctx.state(`head-b0-${ctx.user.head}`, { open: 1 });
    for (const id of ["t-cube1", "t-cube2", "t-cube3"]) ctx.state(id, {});
  },
  desk(ctx) {
    ctx.desk("Cabeza y fila", (desk) => {
      const heads = el("div", { class: "seg", role: "group", "aria-label": "Cabeza" });
      [0, 1].forEach((h) => {
        const b = el("button", { "aria-pressed": ctx.user.head === h ? "true" : "false" }, `cabeza ${h + 1}`);
        b.addEventListener("click", () => {
          ctx.state(`head-b0-${ctx.user.head}`, { open: 0 });
          ctx.user.head = h;
          heads.querySelectorAll("button").forEach((x, i) => x.setAttribute("aria-pressed", i === h ? "true" : "false"));
          ctx.state(`head-b0-${h}`, { open: 1 });
          for (const [id] of ctx.engine.objects) if (id.startsWith("t-")) ctx.engine.dirty(id);
          ctx.refresh();
        });
        heads.append(b);
      });
      const rowSel = el("select", { "aria-label": "Fila (posición) que se anima", style: "background:var(--panel-2);border:1px solid var(--line-2);border-radius:4px" });
      const fill = () => {
        rowSel.innerHTML = "";
        ctx.store.ids().forEach((id, i) => rowSel.append(el("option", { value: i, selected: i === rowOf(ctx) }, `fila ${i} · «${VOCAB[id]}»`)));
      };
      fill();
      rowSel.addEventListener("change", () => {
        ctx.user.row = Number(rowSel.value);
        ctx.refresh();
      });
      desk.append(el("div", { class: "row" }, el("label", {}, "cabeza"), heads), el("div", { class: "row" }, el("label", {}, "fila animada"), rowSel), el("div", { class: "note" }, "Pasa el puntero por cualquier celda: verás sus operandos, la operación y el resultado. Haz clic para fijarla en el inspector."));
    });
  },
  beats: [
    {
      id: "3.1",
      dur: 8,
      scale: "tensor",
      camera: (ctx) => cubeCamera(ctx, ["c1", "c2", "c3"], { pad: 30 }),
      camSeconds: 2.2,
      caption: "Se abre la cabeza 1 del bloque 1. Dentro: <b>X</b> (la entrada de la subcapa, ya normalizada con LN₁) y los pesos <b>W_Q, W_K, W_V</b> (8×4 cada uno).",
      changed: { contexto: "activo" },
      more: `<p><b>X</b> es la entrada de la subcapa de atención <i>después</i> de la normalización elegida (pre-LN): X = LN₁(X₀). Tiene una fila por posición y 8 columnas.</p><p>Las matrices se dibujan como superficies inspeccionables: celda llena = valor positivo; celda con borde = negativo; intensidad = |valor|. La posición de cada superficie en el espacio es conceptual.</p>`,
      pose(ctx, t) {
        const n = ctx.store.ids().length;
        const u = ease(t * 1.5);
        planesBase(ctx, { pending: { "t-Q": () => true, "t-K": () => true, "t-V": () => true, "t-S": () => true, "t-Z": () => true }, opacity: { "t-X": u, "t-Wq": u, "t-Wk": u, "t-Wv": u, "t-Q": u * 0.8, "t-K": u * 0.8, "t-V": u * 0.8, "t-S": 0, "t-Z": 0 } });
        ctx.state("t-cube1", {});
        ctx.pose("t-cube2", { opacity: 0, visible: false });
        ctx.pose("t-cube3", { opacity: 0, visible: false });
        ctx.focus(["t-X", "t-Wq", "t-Wk", "t-Wv", "t-Q", "t-K", "t-V", "t-cube1", `head-b0-${ctx.user.head}`]);
        ctx.tag("lb-X", "t-X", "X = LN₁(X₀) · n×8", { dz: 0, role: "in", d: [0, 6, 10] });
        ctx.tag("lb-W", "t-Wk", "W_Q · W_K · W_V", { dz: 10, role: "w" });
        attnPanel(ctx, ["X"]);
      },
    },
    {
      id: "3.2",
      dur: 13,
      events: 3,
      scale: "tensor",
      camera: (ctx) => cubeCamera(ctx, "c1", { pad: 40 }),
      caption: (ctx) => {
        const e = Math.max(1, ctx.event);
        const name = ["Q", "K", "V"][e - 1];
        return `<b>${name} = X·W_${name}</b>: cada celda es el producto de una fila de X por una columna de W_${name}. La línea muestra los 8 productos que se suman.`;
      },
      changed: { contexto: "activo" },
      more: `<p>Producto matricial en 3D: X ocupa la cara izquierda, los pesos la cara superior y el resultado la cara derecha. La celda (i, j) del resultado acumula los 8 productos X[i,k]·W[k,j] alineados en el volumen.</p><p>Calcular [Q K V] = X·[W_Q W_K W_V] de una vez es lo mismo que tres productos por separado.</p>`,
      pose(ctx, t, e) {
        const { head, block, p } = headData(ctx);
        const i = rowOf(ctx);
        const step = Math.max(1, e);
        const done = { "t-Q": step > 1 || t * 3 > 0.6, "t-K": step > 2 || (step === 2 && t * 3 - 1 > 0.6), "t-V": step >= 3 && t * 3 - 2 > 0.6 };
        planesBase(ctx, { pending: { "t-Q": done["t-Q"] ? null : () => true, "t-K": done["t-K"] ? null : () => true, "t-V": done["t-V"] ? null : () => true }, opacity: { "t-S": 0, "t-Z": 0 }, rowHi: { "t-X": i } });
        const key = ["Wq", "Wk", "Wv"][step - 1];
        const col = (step - 1) * 4;
        const products = block.ln1.out[i].map((x, k) => x * p[key][ctx.user.head][k][0]);
        const upto = Math.min(8, Math.ceil(((t * 3) % 1 || 1) * 8));
        ctx.state("t-cube1", { pick: { i, j: col, products, upto: e > step ? 8 : upto } });
        const target = ["t-Q", "t-K", "t-V"][step - 1];
        ctx.state(target, { pending: done[target] ? null : () => true, highlight: new Set([`${i},0`]) });
        ctx.focus(["t-X", `t-${key}`, target, "t-cube1"]);
        const name = ["Q", "K", "V"][step - 1];
        const value = head[name][i][0];
        attnPanel(ctx, [name, "X"], `${name}[${i},0] = Σₖ X[${i},k]·W_${name}[k,0]\n  = ${products.map(f2).join(" + ")}\n  = <b>${f3(value)}</b>`);
        ctx.tag("lb-tgt", target, `${name} · n×4`, { dz: 6, role: "in" });
      },
    },
    {
      id: "3.3",
      dur: 15,
      events: 7,
      scale: "tensor",
      camera: (ctx) => cubeCamera(ctx, ["c1", "c2"], { pad: 30 }),
      caption: (ctx) => {
        const i = rowOf(ctx);
        const e = ctx.event;
        if (e <= 1) return "Q pasa a la cara izquierda del segundo cubo; K se coloca arriba <b>transpuesta</b> (Kᵀ).";
        const j = Math.min(ctx.store.ids().length - 1, e - 2);
        return `Fila ${i} de Q · fila ${j} de K = <b>Q_${i}·K_${j}</b>: cuánto «coincide» la consulta de la posición ${i} con la clave de la posición ${j}.`;
      },
      changed: { contexto: "activo" },
      more: `<p>(QKᵀ)<sub>ij</sub> = Σ<sub>k</sub> Q<sub>ik</sub>K<sub>jk</sub> es un producto punto entre la consulta de la posición i y la clave de la posición j. Se calcula para todos los j, también los futuros; la máscara llega después.</p>`,
      pose(ctx, t, e) {
        const n = ctx.store.ids().length;
        const F = framesFor(n);
        const { head } = headData(ctx);
        const i = rowOf(ctx);
        const move = ease(Math.min(1, t * 7));
        const j = e <= 1 ? -1 : Math.min(n - 1, Math.floor((t * 7 - 1) * (n / 6)));
        const doneJ = (c) => c <= j;
        ctx.pose("t-cube2", { visible: true, opacity: move });
        planesBase(ctx, {
          at: { "t-Q": lerpFrame(F.Q1, F.Q2, move), "t-K": lerpFrame(F.K1, F.K2, move) },
          values: {},
          pending: { "t-S": (r, c) => r !== i || !doneJ(c) },
          opacity: { "t-S": move, "t-Z": 0, "t-X": 0.35, "t-Wq": 0.25, "t-Wk": 0.25, "t-Wv": 0.25 },
          rowHi: { "t-Q": i },
        });
        ctx.state("t-cube1", {});
        if (j >= 0) {
          const products = head.Q[i].map((q, k) => q * head.K[j][k]);
          ctx.state("t-cube2", { pick: { i, j, products, upto: 4 } });
          ctx.state("t-K", { rowHi: j, frame: F.K2 });
          numbers(ctx, "t-S", "S", i, head.S[i], { cols: Array.from({ length: j + 1 }, (_, c) => c) });
          attnPanel(ctx, ["QK"], `(QKᵀ)[${i},${j}] = Q_${i}·K_${j} = ${products.map(f2).join(" + ")} = <b>${f3(head.S[i][j])}</b>`);
        } else {
          ctx.state("t-cube2", {});
          attnPanel(ctx, ["QK"], "K (n×4) se transpone a Kᵀ (4×n): sus filas pasan a ser columnas.");
        }
        ctx.focus(["t-Q", "t-K", "t-S", "t-cube2"]);
        ctx.tag("lb-q", "t-Q", "Q", { dz: 4, role: "in" });
        ctx.tag("lb-k", "t-K", "Kᵀ", { dz: 6, role: "in" });
        ctx.tag("lb-s", "t-S", "QKᵀ · n×n", { dz: 4, role: "in" });
      },
    },
    {
      id: "3.4",
      dur: 7,
      scale: "tensor",
      camera: (ctx) => cubeCamera(ctx, "c2", { pad: 50 }),
      caption: "Las demás filas se calculan igual. <b>Escalado</b>: se divide todo por √d_k = √4 = 2 para que los productos no crezcan con la dimensión.",
      changed: { contexto: "activo" },
      more: `<p>Sin el escalado, con d_k grande los productos punto tienen varianza grande y el softmax se satura (Vaswani et al., 2017).</p>`,
      refs: ["vaswani"],
      pose(ctx, t) {
        const n = ctx.store.ids().length;
        const F = framesFor(n);
        const { head } = headData(ctx);
        const i = rowOf(ctx);
        const u = ease(t * 1.4);
        const values = head.S.map((row, r) => row.map((v, c) => v + (head.Sscaled[r][c] - v) * u));
        planesBase(ctx, { at: { "t-Q": F.Q2, "t-K": F.K2 }, values: { "t-S": values }, opacity: { "t-Z": 0, "t-X": 0.25, "t-Wq": 0.2, "t-Wk": 0.2, "t-Wv": 0.2 }, rowHi: { "t-S": i } });
        ctx.state("t-cube2", {});
        numbers(ctx, "t-S", "S", i, values[i]);
        ctx.focus(["t-S", "t-cube2"]);
        attnPanel(ctx, ["scale"], `fila ${i}: ${head.S[i].map(f2).join("  ")}\n÷ 2 →    ${head.Sscaled[i].map(f2).join("  ")}`);
        ctx.tag("lb-s", "t-S", "QKᵀ / √d_k", { dz: 4, role: "in" });
      },
    },
    {
      id: "3.5",
      dur: 7,
      scale: "tensor",
      camera: (ctx) => cubeCamera(ctx, "c2", { pad: 50 }),
      caption: "<b>Máscara causal M</b>: 0 donde j ≤ i (pasado y presente), −∞ donde j > i (futuro). Una posición no puede mirar tokens posteriores.",
      changed: { contexto: "activo" },
      pose(ctx) {
        const n = ctx.store.ids().length;
        const F = framesFor(n);
        const { head } = headData(ctx);
        const i = rowOf(ctx);
        planesBase(ctx, { at: { "t-Q": F.Q2, "t-K": F.K2 }, values: { "t-S": head.Smasked }, masked: { "t-S": (r, c) => c > r }, opacity: { "t-Z": 0, "t-X": 0.25, "t-Wq": 0.2, "t-Wk": 0.2, "t-Wv": 0.2 }, rowHi: { "t-S": i } });
        numbers(ctx, "t-S", "S", i, head.Smasked[i]);
        ctx.focus(["t-S"]);
        attnPanel(ctx, ["mask"], `M[${i},j] = ${Array.from({ length: n }, (_, j) => (j <= i ? "0" : "−∞")).join("  ")}\nfila ${i} + M → ${head.Smasked[i].map((v) => (v === -Infinity ? "−∞" : f2(v))).join("  ")}`);
        ctx.tag("lb-s", "t-S", "QKᵀ/√d_k + M", { dz: 4, role: "in" });
      },
    },
    {
      id: "3.6",
      dur: 10,
      events: 2,
      scale: "tensor",
      camera: (ctx) => cubeCamera(ctx, "c2", { pad: 50 }),
      caption: (ctx) => (ctx.event <= 1 ? `<b>Softmax</b> por fila: exponenciar y dividir por la suma. La fila ${rowOf(ctx)} suma 1; las posiciones futuras reciben exactamente 0.` : "Todas las filas normalizadas: <b>A</b>, una distribución de pesos por posición."),
      changed: { contexto: "activo" },
      more: `<p>softmax(z)<sub>j</sub> = e<sup>z<sub>j</sub></sup> / Σ<sub>l</sub> e<sup>z<sub>l</sub></sup>. Como e<sup>−∞</sup> = 0, la máscara se convierte en peso cero exacto.</p><p>La verificación en vivo comprueba que cada fila suma 1 (error ≤ 10⁻¹²) y que todo peso futuro es 0.</p>`,
      pose(ctx, t, e) {
        const n = ctx.store.ids().length;
        const F = framesFor(n);
        const { head } = headData(ctx);
        const i = rowOf(ctx);
        const all = e >= 2;
        const values = head.Smasked.map((row, r) => (all || r === i ? head.A[r] : row));
        planesBase(ctx, { at: { "t-Q": F.Q2, "t-K": F.K2 }, values: { "t-S": values }, masked: { "t-S": (r, c) => c > r && !(all || r === i) }, opacity: { "t-Z": 0, "t-X": 0.25, "t-Wq": 0.2, "t-Wk": 0.2, "t-Wv": 0.2 }, rowHi: { "t-S": i } });
        numbers(ctx, "t-S", "S", i, head.A[i]);
        ctx.focus(["t-S"]);
        const finite = head.Sscaled[i].map((v, j) => (j <= i ? v : null));
        const top = Math.max(...finite.filter((v) => v !== null));
        const exps = finite.map((v) => (v === null ? 0 : Math.exp(v - top)));
        const sum = exps.reduce((a, b) => a + b, 0);
        attnPanel(ctx, ["soft"], `e^(z−máx): ${exps.map((v) => f3(v)).join("  ")}\nΣ = ${f3(sum)}\nA[${i}] = ${head.A[i].map(f3).join("  ")}\nΣ A[${i}] = ${head.A[i].reduce((a, b) => a + b, 0).toFixed(12)}`);
        ctx.tag("lb-s", "t-S", all ? "A · cada fila suma 1" : "softmax fila a fila", { dz: 4, role: "in" });
      },
    },
    {
      id: "3.7",
      dur: 12,
      events: 2,
      scale: "tensor",
      camera: (ctx) => cubeCamera(ctx, ["c2", "c3"], { pad: 30 }),
      caption: (ctx) => (ctx.event <= 1 ? "A se traslada a la cara izquierda del tercer cubo y V (de la primera etapa) a la cara superior." : `<b>Z = A·V</b>: la salida de la posición ${rowOf(ctx)} es una mezcla de los valores V ponderada por su fila de A.`),
      changed: { contexto: "activo" },
      pose(ctx, t, e) {
        const n = ctx.store.ids().length;
        const F = framesFor(n);
        const { head } = headData(ctx);
        const i = rowOf(ctx);
        const move = e <= 1 ? ease(Math.min(1, t * 2)) : 1;
        ctx.pose("t-cube3", { visible: true, opacity: move });
        const zDone = e >= 2 ? Math.min(4, Math.ceil((t * 2 - 1) * 5)) : 0;
        planesBase(ctx, {
          at: { "t-Q": F.Q2, "t-K": F.K2, "t-S": lerpFrame(F.S, F.A3, move), "t-V": lerpFrame(F.V1, F.V3, move) },
          values: { "t-S": head.A },
          pending: { "t-Z": (r, c) => r !== i || c >= zDone },
          opacity: { "t-Z": move, "t-X": 0.2, "t-Wq": 0.15, "t-Wk": 0.15, "t-Wv": 0.15, "t-Q": 0.35, "t-K": 0.35 },
          rowHi: { "t-S": i },
        });
        if (e >= 2) {
          const j = Math.max(0, zDone - 1);
          ctx.state("t-cube3", { pick: { i, j, products: head.A[i].map((a, t2) => a * head.V[t2][j]), upto: n } });
          numbers(ctx, "t-Z", "Z", i, head.Z[i], { cols: Array.from({ length: zDone }, (_, c) => c) });
          attnPanel(ctx, ["Z"], `Z[${i},${j}] = Σₜ A[${i},t]·V[t,${j}] = ${head.A[i].map((a, t2) => `${f2(a)}·${f2(head.V[t2][j])}`).join(" + ")}\n  = <b>${f3(head.Z[i][j])}</b>`);
        } else {
          ctx.state("t-cube3", {});
          attnPanel(ctx, ["Z"], "A (n×n) y V (n×4) forman el tercer producto.");
        }
        ctx.focus(["t-S", "t-V", "t-Z", "t-cube3"]);
        ctx.tag("lb-a", "t-S", "A", { dz: 4, role: "in" });
        ctx.tag("lb-v", "t-V", "V", { dz: 6, role: "in" });
        ctx.tag("lb-z", "t-Z", "Z · n×4", { dz: 4, role: "in" });
      },
    },
    {
      id: "3.8",
      dur: 8,
      scale: "tensor",
      camera: (ctx) => cubeCamera(ctx, ["c1", "c2", "c3"], { pad: 24 }),
      caption: "Una advertencia: los pesos de atención muestran <b>de dónde se mezcla información</b>, no una explicación completa del razonamiento del modelo.",
      changed: { contexto: "activo" },
      more: `<p>Hay muchas operaciones más (otras cabezas, W_O, la MLP, los residuales, el segundo bloque) que transforman la información. Leer una fila de A como «el modelo pensó en X» es una sobreinterpretación.</p>`,
      refs: ["vaswani"],
      pose(ctx) {
        const n = ctx.store.ids().length;
        const F = framesFor(n);
        const { head } = headData(ctx);
        planesBase(ctx, { at: { "t-Q": F.Q2, "t-K": F.K2, "t-S": F.A3, "t-V": F.V3 }, values: { "t-S": head.A } });
        for (const id of ["t-cube1", "t-cube2", "t-cube3"]) ctx.pose(id, { visible: true, opacity: 1, state: {} });
        ctx.focus(null);
        attnPanel(ctx, [], "Prueba: cambia un token (capítulo 2) o la fila y la cabeza en la mesa de control.");
        ctx.tag("lb-a", "t-S", "A (pesos de atención)", { dz: 4, role: "in" });
        ctx.tag("lb-z", "t-Z", "Z", { dz: 4, role: "in" });
      },
    },
  ],
};
