// Escala «modelo»: el Transformer como bastidor de bandejas dentro del gabinete del modelo.
// Al explotar, las bandejas suben (la identidad de cada objeto se conserva: mismo id, se traslada).
// Contenido real: cada matriz muestra los valores calculados por model/transformer.mjs.
import * as k from "../../../kit/iso-kit.mjs";
import { matrixSvg, planeCentre } from "./matrix.mjs";
import { tray, tokenCard, S, L, D, at } from "./shapes.mjs";
import { M } from "./lab.mjs";

const plan0 = M.modelo.plan;
export const TRAY = { x: plan0.x + 7, y: plan0.y + 7, w: plan0.w - 14, d: plan0.d - 14, r: 2 };
export const TRAYS = ["emb", "b0", "b1", "out"];
export const TRAY_NAMES = { emb: "Embeddings y posición", b0: "Bloque 1", b1: "Bloque 2", out: "Salida" };
export const TRAY_Z = { emb: 10, b0: 26, b1: 42, out: 58 }; // dentro del gabinete
export const LIFT = { emb: 110, b0: 190, b1: 270, out: 350 }; // altura explosionada del fondo de cada bandeja
export const liftOf = (id, share) => [0, 0, (LIFT[id] - TRAY_Z[id]) * share];

const T = TRAY;
// Coordenadas locales de la bandeja → mundo (z = fondo de la bandeja en el gabinete).
const W = (id, x, y, dz = 0) => [T.x + x, T.y + y, TRAY_Z[id] + 1.4 + dz];

// Marco horizontal para una matriz tendida sobre la bandeja: filas a lo largo de +x, columnas a lo largo de +y.
export const flatFrame = (id, x, y, dz, c, { rowsAlong = "x" } = {}) =>
  rowsAlong === "x" ? { o: W(id, x, y, dz), u: [0, c, 0], v: [c, 0, 0] } : { o: W(id, x, y, dz), u: [c, 0, 0], v: [0, c, 0] };

// Posiciones de piezas dentro de las bandejas de bloque.
export const BLOCK = {
  bus: { x: 6, y: 80, w: 172, d: 6 },
  ln1: { x: 14, y: 48, w: 10, d: 24, h: 6 },
  h0: { x: 32, y: 8, w: 34, d: 30, h: 10 },
  h1: { x: 32, y: 44, w: 34, d: 30, h: 10 },
  wo: { x: 74, y: 24, c: 1.6 },
  addA: { x: 94, y: 83 },
  ln2: { x: 104, y: 48, w: 10, d: 24, h: 6 },
  w1: { x: 120, y: 6, c: 1.15 },
  gelu: { x: 134, y: 22, w: 8, d: 16, h: 7 },
  w2: { x: 146, y: 6, c: 1.15 },
  addB: { x: 170, y: 83 },
};

function block(id) {
  const out = [];
  return (P, state = {}) => {
    const parts = [];
    const z = TRAY_Z[id] + 1.4;
    const box = (b, tone = "mid", role) => {
      const plan = { x: T.x + b.x, y: T.y + b.y, w: b.w, d: b.d, r: 1.2 };
      return `<g${role ? ` data-role="${role}"` : ""}>${S(k.slabOf(plan, z, b.h, P, 3, 0.4), { tone })}</g>`;
    };
    // bus residual (flujo de activaciones)
    const bus = { x: T.x + BLOCK.bus.x, y: T.y + BLOCK.bus.y, w: BLOCK.bus.w, d: BLOCK.bus.d, r: 1 };
    parts.push(`<g data-role="in">${S(k.slabOf(bus, z, 1.6, P, 3, 0.4), { tone: "mid" })}</g>`);
    parts.push(L(k.lineOnTop([bus.x + 2, bus.y + bus.d / 2], [bus.x + bus.w - 2, bus.y + bus.d / 2], z + 1.6, P), { tone: "lo" }));
    parts.push(box(BLOCK.ln1, "mid"));
    parts.push(box(BLOCK.ln2, "mid"));
    parts.push(box(BLOCK.gelu, "mid"));
    for (const add of [BLOCK.addA, BLOCK.addB]) {
      parts.push(`<g data-role="in">${S(k.cylinder(T.x + add.x, T.y + add.y, 4.2, z + 1.6, 2.4, P, 24, 0.4), { tone: "hi" })}</g>`);
      const [cx, cy] = [T.x + add.x, T.y + add.y];
      parts.push(L(k.lineOnTop([cx - 2.2, cy], [cx + 2.2, cy], z + 4, P) + k.lineOnTop([cx, cy - 2.2], [cx, cy + 2.2], z + 4, P), { tone: "hi" }));
    }
    return parts.join("");
  };
}

function headBox(id, h) {
  return (P, state = {}) => {
    const b = BLOCK[`h${h}`];
    const z = TRAY_Z[id] + 1.4;
    const plan = { x: T.x + b.x, y: T.y + b.y, w: b.w, d: b.d, r: 1.6 };
    const open = state.open ?? 0;
    const parts = [S(k.slabOf(plan, z, b.h - 2, P, 4, 0.5), { tone: "mid", inner: L(k.sideSeam(plan, z + 3, P, 4), { tone: "faint" }) })];
    if (open < 0.98) {
      const lid = k.slabOf(k.insetPlan(plan, -0.6), z + b.h - 2 + open * 30, 2, P, 4, 0.5);
      parts.push(`<g style="opacity:${(1 - open).toFixed(2)}">${S(lid, { tone: "mid" })}${D(k.corners(plan, 2.5).map(([x, y]) => at([x, y, z + b.h + open * 30], P)), { size: 0.45 })}</g>`);
    }
    return parts.join("");
  };
}

export const LEVEL = { emb: 10, b0: 20, b1: 30, out: 40 };
export function buildRack(engine, store) {
  engine.group("modelo", { anchor: [plan0.x + plan0.w / 2, plan0.y + plan0.d / 2, 20] });
  const trayOf = (object) => (object.parent ? object.parent.replace("tray-", "") : null);
  const add = (object) => {
    const id = trayOf(object);
    const level = object.level ?? (id && LEVEL[id] !== undefined ? LEVEL[id] + 1 : undefined);
    return engine.add({ className: "pick", group: "modelo", ...object, level });
  };
  for (const id of TRAYS) {
    add({ id: `tray-${id}`, layer: 2, level: LEVEL[id], anchor: [T.x + T.w / 2, T.y + T.d / 2, TRAY_Z[id]], build: (P) => tray(T, TRAY_Z[id], P, "back"), pose: { visible: false } });
    add({ id: `tray-${id}-front`, layer: 2, level: LEVEL[id] + 3, anchor: [T.x + T.w / 2, T.y + T.d / 2, TRAY_Z[id] + 3], build: (P) => tray(T, TRAY_Z[id], P, "front"), parent: `tray-${id}`, pose: { visible: false }, info: `tray-${id}` });
  }
  // ---- bandeja de embeddings ----
  const E = { x: 6, y: 6, c: 4 }; // tabla E: 16 filas (vocabulario) a lo largo de +x, 8 columnas a lo largo de +y
  const Pp = { x: 6, y: 24, c: 4 }; // tabla P: 10 filas (se dibuja en y = Pp.y + 18)
  const X0 = { x: 104, y: 6, c: 4 };
  add({ id: "mx-E", layer: 2, anchor: planeCentre(flatFrame("emb", E.x, E.y, 0.4, E.c), 16, 8), parent: "tray-emb", role: "w", pose: { visible: false, state: {} }, info: "mx-E",
    build: (P, s = {}) => matrixSvg(P, { rows: 16, cols: 8, frame: flatFrame("emb", E.x, E.y, 0.4, E.c), role: "w", values: store.params0.E, highlight: s.highlight, rowHi: s.rowHi, normal: [0, 0, -0.5] }) });
  add({ id: "mx-P", layer: 2, anchor: planeCentre(flatFrame("emb", Pp.x, Pp.y + 18, 0.4, Pp.c), 10, 8), parent: "tray-emb", role: "w", pose: { visible: false, state: {} }, info: "mx-P",
    build: (P, s = {}) => matrixSvg(P, { rows: 10, cols: 8, frame: flatFrame("emb", Pp.x, Pp.y + 18, 0.4, Pp.c), role: "w", values: store.params0.P, rowHi: s.rowHi, normal: [0, 0, -0.5] }) });
  add({ id: "mx-X0", layer: 2, anchor: planeCentre(flatFrame("emb", X0.x, X0.y, 0.4, X0.c), 6, 8), parent: "tray-emb", role: "in", pose: { visible: false, state: {} }, info: "mx-X0",
    build: (P, s = {}) => {
      const tr = store.trace();
      const n = tr.X0.length;
      return matrixSvg(P, { rows: n, cols: 8, frame: flatFrame("emb", X0.x, X0.y, 0.4, X0.c), role: "in", values: tr.X0, pending: s.upto !== undefined ? (i) => i >= s.upto : null, rowHi: s.rowHi, normal: [0, 0, -0.5] });
    } });
  // tarjetas de token (en la bandeja de embeddings, carril delantero)
  for (let i = 0; i < 10; i++) {
    add({ id: `card${i}`, layer: 2, anchor: [T.x + 107 + i * 8, T.y + 81, TRAY_Z.emb + 2], parent: "tray-emb", role: "in", pose: { visible: false, state: {} }, info: "card",
      build: (P, s = {}) => {
        const ids = store.ids();
        if (i >= ids.length) return "";
        const plan = { x: T.x + 104 + i * 8, y: T.y + 74, w: 7, d: 14, r: 1 };
        return `<g data-role="in">${tokenCard(plan, TRAY_Z.emb + 1.4, P, s.showId ? String(ids[i]) : store.VOCAB[ids[i]], { lit: s.lit })}</g>`;
      } });
  }
  // ---- bandejas de bloque ----
  for (const [b, id] of [[0, "b0"], [1, "b1"]]) {
    add({ id: `blk-${id}`, layer: 2, anchor: [T.x + 90, T.y + 60, TRAY_Z[id] + 4], parent: `tray-${id}`, pose: { visible: false }, info: `blk`, build: block(id) });
    for (const h of [0, 1]) {
      const bx = BLOCK[`h${h}`];
      add({ id: `head-${id}-${h}`, layer: 2, anchor: [T.x + bx.x + bx.w / 2, T.y + bx.y + bx.d / 2, TRAY_Z[id] + 6], parent: `tray-${id}`, pose: { visible: false, state: {} }, info: "head", build: headBox(id, h) });
    }
    const blockOf = () => store.trace().blocks[b];
    const p = store.params0.blocks[b];
    add({ id: `mx-${id}-wo`, layer: 2, anchor: planeCentre(flatFrame(id, BLOCK.wo.x, BLOCK.wo.y, 3, BLOCK.wo.c), 8, 8), parent: `tray-${id}`, role: "w", pose: { visible: false, state: {} }, info: "mx-wo",
      build: (P) => matrixSvg(P, { rows: 8, cols: 8, frame: flatFrame(id, BLOCK.wo.x, BLOCK.wo.y, 3, BLOCK.wo.c), role: "w", values: p.Wo, normal: [0, 0, -0.5] }) });
    add({ id: `mx-${id}-w1`, layer: 2, anchor: planeCentre(flatFrame(id, BLOCK.w1.x, BLOCK.w1.y, 3, BLOCK.w1.c), 8, 32), parent: `tray-${id}`, role: "w", pose: { visible: false, state: {} }, info: "mx-w1",
      build: (P) => matrixSvg(P, { rows: 8, cols: 32, frame: flatFrame(id, BLOCK.w1.x, BLOCK.w1.y, 3, BLOCK.w1.c), role: "w", values: p.W1, normal: [0, 0, -0.5], gap: 0.06 }) });
    add({ id: `mx-${id}-w2`, layer: 2, anchor: planeCentre(flatFrame(id, BLOCK.w2.x, BLOCK.w2.y, 3, BLOCK.w2.c, { rowsAlong: "y" }), 32, 8), parent: `tray-${id}`, role: "w", pose: { visible: false, state: {} }, info: "mx-w2",
      build: (P) => matrixSvg(P, { rows: 32, cols: 8, frame: flatFrame(id, BLOCK.w2.x, BLOCK.w2.y, 3, BLOCK.w2.c, { rowsAlong: "y" }), role: "w", values: p.W2, normal: [0, 0, -0.5], gap: 0.06 }) });
    // estado del flujo residual en la última posición (vector de 8) sobre el bus: X → H → Y
    add({ id: `vec-${id}`, layer: 2, anchor: W(id, 150, 70, 3), parent: `tray-${id}`, role: "in", pose: { visible: false, state: {} }, info: "resid",
      build: (P, s = {}) => {
        const tr = blockOf();
        const which = s.which || "Y";
        const vec = (which === "X" ? tr.X : which === "H" ? tr.H : tr.Y);
        const n = vec.length;
        return matrixSvg(P, { rows: n, cols: 8, frame: flatFrame(id, s.x ?? 140, 56, 3, 1.4), role: "in", values: vec, rowHi: n - 1, normal: [0, 0, -0.5] });
      } });
  }
  // ---- bandeja de salida ----
  add({ id: "out-base", layer: 2, anchor: [T.x + 90, T.y + 50, TRAY_Z.out + 3], parent: "tray-out", pose: { visible: false }, info: "out",
    build: (P) => {
      const z = TRAY_Z.out + 1.4;
      const parts = [];
      parts.push(S(k.slabOf({ x: T.x + 12, y: T.y + 30, w: 10, d: 24, r: 1.2 }, z, 6, P, 3, 0.4), { tone: "mid" })); // LN_f
      parts.push(S(k.slabOf({ x: T.x + 70, y: T.y + 6, w: 96, d: 8, r: 1 }, z, 1.2, P, 3), { tone: "lo" })); // regla de logits
      parts.push(S(k.slabOf({ x: T.x + 70, y: T.y + 46, w: 96, d: 8, r: 1 }, z, 1.2, P, 3), { tone: "lo" })); // regla de probabilidades
      return parts.join("");
    } });
  add({ id: "mx-Wu", layer: 2, anchor: planeCentre(flatFrame("out", 30, 18, 3, 1.6), 8, 16), parent: "tray-out", role: "w", pose: { visible: false, state: {} }, info: "mx-Wu",
    build: (P, s = {}) => matrixSvg(P, { rows: 8, cols: 16, frame: flatFrame("out", 32, 18, 3, 1.6), role: s.role || "w", values: s.values || store.params0.Wu, highlight: s.highlight, colHi: s.colHi, normal: [0, 0, -0.5] }) });
  // gradiente de W_U flotando sobre la superficie de pesos (naranja)
  add({ id: "mx-gWu", layer: 2, level: LEVEL.out + 2, anchor: planeCentre(flatFrame("out", 32, 18, 12, 1.6), 8, 16), parent: "tray-out", role: "g", pose: { visible: false, state: {} }, info: "mx-gWu",
    build: (P, s = {}) => (s.values ? matrixSvg(P, { rows: 8, cols: 16, frame: flatFrame("out", 32, 18, 12, 1.6), role: "g", values: s.values, normal: [0, 0, -0.4] }) : "") });
  // barras de logits y probabilidades (16 símbolos) + tarjeta del token elegido
  add({ id: "bars-out", layer: 2, anchor: [T.x + 118, T.y + 30, TRAY_Z.out + 4], parent: "tray-out", pose: { visible: false, state: {} }, info: "bars-out",
    build: (P, s = {}) => {
      const z = TRAY_Z.out + 2.6;
      const tr = store.trace();
      const logits = s.logits || tr.logits;
      const probs = s.probs || tr.probs;
      const parts = [];
      const lmax = Math.max(...logits.map(Math.abs));
      for (let j = 0; j < 16; j++) {
        const x = T.x + 72 + j * 5.8;
        const hl = logits[j] / lmax * 14;
        const bar = { x, y: T.y + 8, w: 3.6, d: 4, r: 0.4 };
        if (s.showLogits !== false) parts.push(`<g data-role="${logits[j] >= 0 ? "in" : "off"}">${S(k.slabOf(bar, z, Math.max(0.4, Math.abs(hl)), P, 2), { tone: "hi" })}</g>`);
        const hp = probs[j] * 40;
        const pb = { x, y: T.y + 48, w: 3.6, d: 4, r: 0.4 };
        const chosen = s.chosen === j;
        const target = s.target === j;
        if (s.showProbs !== false) parts.push(`<g data-role="${chosen ? "ok" : target ? "g" : "in"}">${S(k.slabOf(pb, z, Math.max(0.3, hp), P, 2), { tone: "hi", lit: chosen })}</g>`);
      }
      return parts.join("");
    } });
  add({ id: "card-next", layer: 2, anchor: [T.x + 176, T.y + 70, TRAY_Z.out + 3], parent: "tray-out", role: "ok", pose: { visible: false, state: {} }, info: "card",
    build: (P, s = {}) => (s.id === undefined ? "" : `<g data-role="${s.role || "ok"}">${tokenCard({ x: T.x + 170, y: T.y + 64, w: 9, d: 14, r: 1 }, TRAY_Z.out + 1.4, P, store.VOCAB[s.id], { lit: true })}</g>`) });
}

export const EMB = { E: { x: 10, y: 10, c: 1.5 }, P: { x: 10, y: 52, c: 1.5 }, X0: { x: 120, y: 30, c: 1.5 } };
export { W as trayPoint };
