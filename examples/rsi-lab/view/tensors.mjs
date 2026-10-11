import { matrixSvg, cubeFrames, cubeSvg, planeCentre, cellCentre } from "./matrix.mjs";
import { lerp3, add3, mul3 } from "./engine.mjs";
import { TRAY, TRAY_Z } from "./rack.mjs";
import { f2, f3 } from "./helpers.mjs";

export const CELL = 2;
const T = TRAY;

export function cubeLayout(n) {
  const z0 = TRAY_Z.b0 + 1.4 + 18 + n * CELL;
  return {
    c1: cubeFrames([T.x + 30, T.y + 70, z0], n, 8, 12, CELL),
    c2: cubeFrames([T.x + 64, T.y + 64, z0], n, 4, n, CELL),
    c3: cubeFrames([T.x + 92, T.y + 60, z0], n, n, 4, CELL),
  };
}

const sub = (frame, from) => ({ o: add3(frame.o, mul3(frame.u, from)), u: frame.u, v: frame.v });
export const lerpFrame = (a, b, t) => ({ o: lerp3(a.o, b.o, t), u: lerp3(a.u, b.u, t), v: lerp3(a.v, b.v, t) });

export function framesFor(n) {
  const L = cubeLayout(n);
  return {
    X: L.c1.A,
    Wq: sub(L.c1.B, 0),
    Wk: sub(L.c1.B, 4),
    Wv: sub(L.c1.B, 8),
    Q1: sub(L.c1.C, 0),
    K1: sub(L.c1.C, 4),
    V1: sub(L.c1.C, 8),
    Q2: L.c2.A,
    K2: { o: L.c2.B.o, u: L.c2.B.v, v: L.c2.B.u },
    S: L.c2.C,
    A3: L.c3.A,
    V3: L.c3.B,
    Z: L.c3.C,
    layout: L,
  };
}

export function buildTensors(engine, store) {
  const headOf = () => {
    const tr = store.trace();
    const h = store.user.head;
    return { tr, h, block: tr.blocks[0], head: tr.blocks[0].heads[h], p: store.params0.blocks[0] };
  };
  const plane = (id, rows, cols, role, valuesOf, cellOf) =>
    engine.add({
      id,
      layer: 2,
      group: "modelo",
      level: 22,
      parent: "tray-b0",
      className: "pick",
      role,
      info: "head",
      anchor: [0, 0, 0],
      pose: { visible: false, state: {} },
      build: (P, s = {}) => {
        const n = store.ids().length;
        const r = typeof rows === "function" ? rows(n) : rows;
        const c = typeof cols === "function" ? cols(n) : cols;
        const DEFAULT_AT = { X: "X", Wq: "Wq", Wk: "Wk", Wv: "Wv", Q: "Q1", K: "K1", V: "V1", S: "S", Z: "Z" };
        const frame = s.frame || framesFor(n)[s.at || DEFAULT_AT[id.slice(2)]];
        const entry = engine.objects.get(id);
        entry.anchor = planeCentre(frame, r, c);
        return matrixSvg(P, { rows: r, cols: c, frame, role: s.role || role, values: s.values || valuesOf(), highlight: s.highlight, rowHi: s.rowHi, colHi: s.colHi, pending: s.pending, masked: s.masked, dimCells: s.dim, scaleMax: s.scaleMax, pad: 0.25, normal: s.normal || [0, 0, 0] });
      },
      cell: cellOf,
    });
  const rowsN = (n) => n;
  const hv = () => headOf().head;
  plane("t-X", rowsN, 8, "in", () => headOf().block.ln1.out, (i, j) => {
    const { block } = headOf();
    return { title: `X[${i},${j}] = ${f3(block.ln1.out[i][j])}`, rows: [["entrada", `X₀ fila ${i} (flujo residual)`], ["operación", `LN₁: (x − μ)/√(σ² + ε)·γ + β, μ = ${f3(block.ln1.mean[i])}, σ² = ${f3(block.ln1.variance[i])}`], ["salida", f3(block.ln1.out[i][j])]], more: "X es la entrada de la subcapa de atención después de la normalización (pre-LN)." };
  });
  const wcell = (name, key) => (i, j) => {
    const { p, h } = headOf();
    return { title: `${name}[${i},${j}] = ${f3(p[key][h][i][j])}`, rows: [["tipo", "parámetro (fijo en inferencia)"], ["forma", "8×4"], ["cabeza", String(h + 1)]] };
  };
  plane("t-Wq", 8, 4, "w", () => headOf().p.Wq[headOf().h], wcell("W_Q", "Wq"));
  plane("t-Wk", 8, 4, "w", () => headOf().p.Wk[headOf().h], wcell("W_K", "Wk"));
  plane("t-Wv", 8, 4, "w", () => headOf().p.Wv[headOf().h], wcell("W_V", "Wv"));
  const proj = (name, key, wkey) => (i, j) => {
    const { block, p, h, head } = headOf();
    const terms = block.ln1.out[i].map((x, t) => x * p[wkey][h][t][j]);
    return { title: `${name}[${i},${j}] = ${f3(head[key][i][j])}`, rows: [["entradas", `fila ${i} de X · columna ${j} de W_${name}`], ["operación", `Σ_k X[${i},k]·W[k,${j}] = ${terms.map(f2).join(" + ")}`], ["salida", f3(head[key][i][j])]] };
  };
  plane("t-Q", rowsN, 4, "in", () => hv().Q, proj("Q", "Q", "Wq"));
  plane("t-K", rowsN, 4, "in", () => hv().K, proj("K", "K", "Wk"));
  plane("t-V", rowsN, 4, "in", () => hv().V, proj("V", "V", "Wv"));
  plane("t-S", rowsN, rowsN, "in", () => hv().S, (i, j) => {
    const head = hv();
    const masked = j > i;
    return {
      title: `fila ${i}, columna ${j}`,
      rows: [
        ["Q_i·K_j", `${head.Q[i].map((q, t) => `${f2(q)}·${f2(head.K[j][t])}`).join(" + ")} = ${f3(head.S[i][j])}`],
        ["÷√d_k", `${f3(head.S[i][j])} / 2 = ${f3(head.Sscaled[i][j])}`],
        ["+ M", masked ? "−∞ (posición futura)" : "0 (permitida)"],
        ["A[i,j]", masked ? "0 exactamente" : `e^{${f3(head.Sscaled[i][j])}} / Σ = ${f3(head.A[i][j])}`],
        ["fila i suma", f3(head.A[i].reduce((t, v) => t + v, 0))],
      ],
      more: "El peso A[i,j] indica cuánto aporta el valor de la posición j a la salida de la posición i. Estas ponderaciones no equivalen a una explicación completa del razonamiento del modelo.",
    };
  });
  plane("t-Z", rowsN, 4, "in", () => hv().Z, (i, j) => {
    const head = hv();
    return { title: `Z[${i},${j}] = ${f3(head.Z[i][j])}`, rows: [["operación", `Σ_t A[${i},t]·V[t,${j}]`], ["términos", head.A[i].map((a, t) => `${f2(a)}·${f2(head.V[t][j])}`).join(" + ")], ["salida", f3(head.Z[i][j])]] };
  });
  for (const [id, key, dims] of [["t-cube1", "c1", (n) => [n, 8, 12]], ["t-cube2", "c2", (n) => [n, 4, n]], ["t-cube3", "c3", (n) => [n, n, 4]]]) {
    engine.add({
      id,
      layer: 2,
      group: "modelo",
      level: 22,
      parent: "tray-b0",
      info: "head",
      anchor: [0, 0, 0],
      bias: -2,
      pose: { visible: false, state: {} },
      build: (P, s = {}) => {
        const n = store.ids().length;
        const [nn, kk, m] = dims(n);
        const frames = cubeLayout(n)[key];
        const entry = engine.objects.get(id);
        const v = frames.volume;
        entry.anchor = [v.x0 + v.X / 2, v.y0 - v.Y / 2, v.z0 - v.Z / 2];
        return cubeSvg(P, { frames, n: nn, kk, m, c: CELL, pick: s.pick });
      },
    });
  }
}
