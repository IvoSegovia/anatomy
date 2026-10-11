// Piezas de taller construidas con el kit Anatomy (sólidos sombreados en cuatro tonos,
// biseles, tornillos, costuras, placas de rótulo). Cada función devuelve marcado SVG para P.
import * as k from "../../../kit/iso-kit.mjs";

const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const at = (p, P) => k.iso(p, P);
const byDepth = (points, P) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

// Placa base sobre patas, con ranura perimetral, tornillos y regla.
export function basePlate(plan, P, { thick = 12, foot = 6, ruler = true } = {}) {
  const out = [`<path class="iso-halo" d="${k.haloOf(plan, -thick - foot, thick, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(plan, 26), P)) {
    out.push(S(k.cylinder(x, y, 9, -thick - foot, 2, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 7, -thick - foot + 2, foot - 2, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(plan, -thick, thick, P, 10, 1.6), { tone: "mid", inner: L(k.sideSeam(plan, -thick / 2, P, 10), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(plan, 7), 0, P, 10), { tone: "lo" }));
  const screws = k.corners(plan, 13);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.6, 0, P, 18)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0], P)), { size: 0.55 }));
  if (ruler) {
    const strip = { x: plan.x + 40, y: plan.y + plan.d - 18, w: plan.w - 80, d: 7, r: 1 };
    out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
    const t = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 5, 5, strip.y + 0.8, 0.6, [2, 3.8], P);
    out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
    out.push(D([at([strip.x + 2, strip.y + 3.5, 0.6], P), at([strip.x + strip.w - 2, strip.y + 3.5, 0.6], P)], { size: 0.45 }));
  }
  return out.join("");
}

// Caja de instrumento: cuerpo con bisel, costura, tapa, tornillos en la tapa y placa de rótulo frontal.
export function cabinet(plan, z, h, P, { tone = "mid", lid = 3, lit = false, screws = true, seam = true, className = "" } = {}) {
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(k.insetPlan(plan, -2), z, 0.1, P)}" style="filter:blur(6px)"/>`);
  const body = k.slabOf(plan, z, h - lid, P, 6, 0.8);
  out.push(S(body, { tone, lit, className, inner: seam ? L(k.sideSeam(plan, z + (h - lid) * 0.35, P, 6), { tone: "faint" }) : "" }));
  const top = k.insetPlan(plan, -0.8);
  out.push(S(k.slabOf(top, z + h - lid, lid, P, 6, 0.8), { tone, lit, className }));
  if (screws) {
    const pts = k.corners(top, 4.2);
    out.push(D(pts.map(([x, y]) => at([x, y, z + h], P)), { size: 0.5 }));
  }
  return out.join("");
}

// Placa de rótulo sobre una cara superior: tres líneas de «texto» (libres) y dos tornillos.
export function labelPlate(plan, z, P) {
  const out = [S(k.slabOf(plan, z, 0.8, P, 3), { tone: "lo" })];
  out.push(L(k.planOutline(k.insetPlan(plan, 1.4), z + 0.8, P, 3), { tone: "faint" }));
  const rows = [0.3, 0.52, 0.72];
  rows.forEach((share, index) => {
    const y = plan.y + plan.d * share;
    const x0 = plan.x + 4;
    const x1 = plan.x + plan.w - 4 - index * plan.w * 0.18;
    out.push(L(k.lineOnTop([x0, y], [x1, y], z + 0.8, P), { tone: "lo", free: true }));
  });
  return out.join("");
}

// Lámpara de estado: base, collar y cúpula; `state` = "ok" | "fail" | "off".
export function lamp(x, y, z, P, state = "off", r = 3.2) {
  const out = [S(k.cylinder(x, y, r + 1.4, z, 1.6, P, 24), { tone: "lo" })];
  out.push(S(k.cylinder(x, y, r, z + 1.6, 2.2, P, 24, 0.4), { tone: "mid" }));
  out.push(`<g class="lamp" data-state="${state}">${S(k.cylinder(x, y, r - 0.8, z + 3.8, 1.4, P, 24), { tone: "hi" })}</g>`);
  return out.join("");
}

// Indicador de cuadrante con aguja (valor 0..1 sobre 270°).
export function gauge(x, y, z, R, P, value = 0, { tone = "hi", needleClass = "needle" } = {}) {
  const out = [S(k.cylinder(x, y, R + 1.2, z, 2, P, 48), { tone: "lo" })];
  out.push(S(k.cylinder(x, y, R, z + 2, 4, P, 64, 0.6), { tone, crease: "lo" }));
  out.push(L(k.knurl(x, y, R, z + 3, z + 6, 64, P, 0.3), { tone: "lo" }));
  const top = z + 6;
  out.push(L(k.ring(x, y, R - 1.6, top, P, 56), { tone: "lo" }));
  const t = k.radialTicks(x, y, R - 2, 30, 5, top, [1.1, 2.4], P, -0.75 * Math.PI, 1.5 * Math.PI);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  const angle = -0.75 * Math.PI + 1.5 * Math.PI * Math.max(0, Math.min(1, value));
  const tip = [x + Math.sin(angle) * (R - 3), y - Math.cos(angle) * (R - 3)];
  const tail = [x - Math.sin(angle) * 2, y + Math.cos(angle) * 2];
  out.push(`<path class="iso-line ${needleClass}" data-tone="lit" data-free="start" d="${k.lineOnTop(tail, tip, top + 0.2, P)}" style="stroke-width:1.1"/>`);
  out.push(L(k.ring(x, y, 1.1, top + 0.2, P, 12), { tone: "mid" }));
  return out.join("");
}

// Perilla moleteada con puntero.
export function knob(x, y, z, r, P, angle = 0) {
  const out = [S(k.cylinder(x, y, r, z, 3.4, P, 32), { tone: "mid" })];
  out.push(L(k.knurl(x, y, r, z, z + 3.4, 36, P), { tone: "lo" }));
  out.push(L(k.lineOnTop([x, y], [x + Math.sin(angle) * (r - 0.8), y - Math.cos(angle) * (r - 0.8)], z + 3.4, P), { tone: "hi", free: "end" }));
  return out.join("");
}

// Cartucho (versión de código): cuerpo, agarre y ventana de etiqueta.
export function cartridge(plan, z, h, P, { tone = "hi", lit = false, className = "" } = {}) {
  const out = [S(k.slabOf(plan, z, h, P, 3, 0.5), { tone, lit, className, inner: L(k.sideSeam(plan, z + h * 0.45, P, 3), { tone: "faint" }) })];
  const grip = { x: plan.x + plan.w * 0.25, y: plan.y + plan.d * 0.3, w: plan.w * 0.5, d: plan.d * 0.4, r: 1 };
  out.push(L(k.planOutline(grip, z + h, P, 3), { tone: "lo" }));
  return out.join("");
}

// Bandeja de bastidor: fondo y paredes. part = "back" (fondo + paredes traseras) | "front" (paredes delanteras).
export function tray(plan, z, P, part = "back", { wall = 2.2, h = 5, tone = "mid", className = "" } = {}) {
  const out = [];
  const view = k.towardViewer(P);
  const walls = [
    { plan: { x: plan.x, y: plan.y, w: plan.w, d: wall, r: 0.6 }, n: [0, -1] },
    { plan: { x: plan.x, y: plan.y + plan.d - wall, w: plan.w, d: wall, r: 0.6 }, n: [0, 1] },
    { plan: { x: plan.x, y: plan.y, w: wall, d: plan.d, r: 0.6 }, n: [-1, 0] },
    { plan: { x: plan.x + plan.w - wall, y: plan.y, w: wall, d: plan.d, r: 0.6 }, n: [1, 0] },
  ];
  const front = (wallDef) => wallDef.n[0] * view[0] + wallDef.n[1] * view[1] > 0;
  if (part === "back") {
    out.push(`<path class="iso-halo" d="${k.haloOf(plan, z, 0.1, P)}" style="filter:blur(5px)"/>`);
    out.push(S(k.slabOf(plan, z, 1.4, P, 4, 0.6), { tone: "lo", className }));
    out.push(L(k.planOutline(k.insetPlan(plan, wall + 2), z + 1.4, P, 4), { tone: "faint" }));
    for (const w of walls.filter((wd) => !front(wd))) out.push(S(k.slabOf(w.plan, z + 1.4, h, P, 2, 0.3), { tone, className }));
  } else {
    for (const w of walls.filter(front)) out.push(S(k.slabOf(w.plan, z + 1.4, h, P, 2, 0.3), { tone, className }));
  }
  return out.join("");
}

// Tarjeta de token: losa fina con su símbolo grabado encima.
export function tokenCard(plan, z, P, text, { lit = false, className = "card" } = {}) {
  const out = [S(k.slabOf(plan, z, 1.6, P, 3, 0.4), { tone: "hi", lit, className })];
  if (text !== undefined) out.push(k.faceTextSvg(k.topMatrix([plan.x + plan.w / 2, plan.y + plan.d * 0.62], z + 1.6, P, "x"), text, { size: Math.min(plan.d * 0.42, 4.2), tone: "hi", anchor: "middle" }));
  return out.join("");
}

// Canal en el suelo para una ruta (dos bordes tenues).
export function channel(points, z, P) {
  return L(k.onTop(points, z, P), { tone: "faint" });
}

export { S, L, D, at, byDepth };
