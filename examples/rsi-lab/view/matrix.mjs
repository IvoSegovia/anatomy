// Matrices como superficies inspeccionables y cubos de producto matricial.
// Codificación: celda llena = valor positivo, celda con borde = negativo, intensidad = |valor|/máx.
// Celdas enmascaradas (−∞) en gris con un trazo diagonal. Todo en coordenadas del mundo.
import * as k from "../../../kit/iso-kit.mjs";
import { add3, mul3 } from "./engine.mjs";

const r1 = (v) => Math.round(v * 10) / 10;
const pathOf = (pts) => `M${pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join("L")}Z`;

// frame: { o: esquina de la celda (0,0), u: paso de columna, v: paso de fila } (vectores del mundo)
export const cellCorner = (frame, i, j) => add3(add3(frame.o, mul3(frame.u, j)), mul3(frame.v, i));
export const cellCentre = (frame, i, j) => add3(add3(frame.o, mul3(frame.u, j + 0.5)), mul3(frame.v, i + 0.5));
export const planeCentre = (frame, rows, cols) => add3(add3(frame.o, mul3(frame.u, cols / 2)), mul3(frame.v, rows / 2));

// Construye el marcado de una matriz.
// spec: { rows, cols, values (matriz o null), role, frame, scaleMax, highlight: Set("i,j"), rowHi, colHi,
//         dimCells: Set, masked: (i,j)=>bool, plate: true, title }
export function matrixSvg(P, spec) {
  const { rows, cols, frame, role = "input", values } = spec;
  const gap = spec.gap ?? 0.08;
  const project = (point) => k.iso(point, P);
  const out = [];
  // placa: paralelogramo con un canto que sugiere grosor
  const pad = spec.pad ?? 0.35;
  const o = add3(add3(frame.o, mul3(frame.u, -pad)), mul3(frame.v, -pad));
  const U = mul3(frame.u, cols + 2 * pad);
  const V = mul3(frame.v, rows + 2 * pad);
  const corners = [o, add3(o, U), add3(add3(o, U), V), add3(o, V)].map(project);
  if (spec.plate !== false) {
    const n = spec.normal || [0, 0, -0.6];
    const back = [o, add3(o, U), add3(add3(o, U), V), add3(o, V)].map((p) => project(add3(p, n)));
    out.push(`<path class="mx-edge" d="${pathOf(back)}"/>`);
    out.push(`<path class="mx-plate" d="${pathOf(corners)}"/>`);
  }
  let max = spec.scaleMax;
  if (!max && values) {
    max = 1e-9;
    for (const row of values) for (const value of row) if (Number.isFinite(value)) max = Math.max(max, Math.abs(value));
  }
  const cells = [];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const a = cellCorner(frame, i + gap, j + gap);
      const b = add3(a, mul3(frame.u, 1 - 2 * gap));
      const c = add3(b, mul3(frame.v, 1 - 2 * gap));
      const d = add3(a, mul3(frame.v, 1 - 2 * gap));
      const quad = [a, b, c, d].map(project);
      const key = `${i},${j}`;
      const value = values ? values[i][j] : null;
      const masked = spec.masked ? spec.masked(i, j) : value === -Infinity;
      let cls = "cell";
      let alpha = 0.18;
      if (masked) cls += " mask";
      else if (value !== null && value !== undefined) {
        alpha = 0.12 + 0.78 * Math.min(1, Math.abs(value) / max);
        cls += value < 0 ? " neg" : " pos";
      } else cls += " empty";
      if (spec.highlight && spec.highlight.has(key)) cls += " hl";
      if (spec.rowHi !== undefined && spec.rowHi === i) cls += " rowhi";
      if (spec.colHi !== undefined && spec.colHi === j) cls += " colhi";
      if (spec.dimCells && spec.dimCells.has(key)) cls += " dim";
      if (spec.pending && spec.pending(i, j)) cls += " pending";
      let mark = "";
      if (masked) mark = `<path class="mask-mark" d="M${r1(quad[0][0])} ${r1(quad[0][1])}L${r1(quad[2][0])} ${r1(quad[2][1])}"/>`;
      cells.push(`<path class="${cls}" data-cell="${key}" style="--a:${alpha.toFixed(3)}" d="${pathOf(quad)}"/>${mark}`);
    }
  }
  out.push(`<g class="mx-cells" data-role="${role}">${cells.join("")}</g>`);
  out.push(`<path class="mx-frame" d="${pathOf(corners)}"/>`);
  return out.join("");
}

// Cubo del producto C = A·B (n×k · k×m). Ejes: k → +x, j → −y, i → −z.
// Devuelve los marcos de A (cara +y), B (cara superior) y C (cara +x) y la geometría del volumen.
export function cubeFrames(origin, n, kk, m, c, faceGap = 0.6) {
  const [x0, y0, z0] = origin; // esquina frontal-superior: x = x0 + k·c, y = y0 − j·c, z = z0 − i·c
  return {
    A: { o: [x0, y0 + faceGap, z0], u: [c, 0, 0], v: [0, 0, -c] }, // filas i hacia abajo, columnas k a lo largo de +x
    B: { o: [x0, y0, z0 + faceGap], u: [0, -c, 0], v: [c, 0, 0] }, // filas k a lo largo de +x, columnas j hacia −y
    C: { o: [x0 + kk * c + faceGap, y0, z0], u: [0, -c, 0], v: [0, 0, -c] }, // filas i, columnas j
    volume: { x0, y0, z0, X: kk * c, Y: m * c, Z: n * c },
    point: (i, j, t) => [x0 + (t + 0.5) * c, y0 - (j + 0.5) * c, z0 - (i + 0.5) * c],
  };
}

// Aristas visibles del volumen (líneas tenues) y, si hay celda elegida, la fila de productos.
export function cubeSvg(P, spec) {
  const { frames, n, kk, m } = spec;
  const { x0, y0, z0, X, Y, Z } = frames.volume;
  const project = (p) => k.iso(p, P);
  const out = [];
  const corners = {
    a: [x0, y0, z0], b: [x0 + X, y0, z0], c: [x0 + X, y0 - Y, z0], d: [x0, y0 - Y, z0],
    e: [x0, y0, z0 - Z], f: [x0 + X, y0, z0 - Z], g: [x0 + X, y0 - Y, z0 - Z], h: [x0, y0 - Y, z0 - Z],
  };
  const edge = (p, q) => `M${project(p).map(r1).join(" ")}L${project(q).map(r1).join(" ")}`;
  const edges = [["a", "b"], ["b", "c"], ["c", "d"], ["d", "a"], ["e", "f"], ["f", "g"], ["a", "e"], ["b", "f"], ["c", "g"]];
  out.push(`<path class="cube-edge" d="${edges.map(([p, q]) => edge(corners[p], corners[q])).join("")}"/>`);
  if (spec.pick) {
    const { i, j, products, upto = kk, sum } = spec.pick;
    const max = Math.max(1e-9, ...products.map(Math.abs));
    const line = [];
    for (let t = 0; t < kk; t++) {
      const p = frames.point(i, j, t);
      const [sx, sy] = project(p);
      const shown = t < upto;
      const value = products[t];
      const radius = (0.35 + 0.65 * Math.abs(value) / max) * spec.c * 0.32 * k.cameraOf(P).k;
      line.push(`<circle class="prod ${value < 0 ? "neg" : "pos"}${shown ? "" : " pending"}" data-prod="${t}" cx="${r1(sx)}" cy="${r1(sy)}" r="${r1(radius)}"/>`);
      // proyecciones: de A[i,t] y de B[t,j] hacia el punto del producto
      if (shown) {
        const fromA = add3(cellCentre(frames.A, i, t), [0, 0, 0]);
        const fromB = cellCentre(frames.B, t, j);
        out.push(`<path class="prod-ray" d="${edge(fromA, p)}${edge(fromB, p)}"/>`);
      }
    }
    const start = frames.point(i, j, 0);
    const end = cellCentre(frames.C, i, j);
    out.push(`<path class="prod-sum" d="${edge(start, end)}"/>`);
    out.push(line.join(""));
  }
  return out.join("");
}
