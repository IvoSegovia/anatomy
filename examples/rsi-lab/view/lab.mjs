// El laboratorio a escala «laboratorio»: bancos, módulos, rutas de los tres bucles y fichas
// de información para el inspector. Representación CONCEPTUAL: posiciones sin significado físico.
import * as k from "../../../kit/iso-kit.mjs";
import { basePlate, cabinet, labelPlate, lamp, gauge, knob, cartridge, S, L, D, at } from "./shapes.mjs";

export const MAIN = { x: -320, y: -262, w: 640, d: 524, r: 16 };
export const BENCH = { x: 362, y: -262, w: 262, d: 524, r: 14 };

// Planos de los módulos (x, y, ancho, fondo) y altura.
export const M = {
  modelo: { plan: { x: -305, y: -247, w: 200, d: 110, r: 5 }, h: 84, name: "Modelo θ" },
  archivo: { plan: { x: -85, y: -247, w: 150, d: 72, r: 4 }, h: 18, name: "Archivo de versiones" },
  codigo: { plan: { x: 90, y: -247, w: 120, d: 86, r: 4 }, h: 46, name: "Código del agente" },
  datos: { plan: { x: -302, y: 0, w: 74, d: 176, r: 4 }, h: 50, name: "Datos" },
  contexto: { plan: { x: -190, y: -100, w: 172, d: 40, r: 3 }, h: 8, name: "Contexto" },
  proponente: { plan: { x: 40, y: -112, w: 112, d: 78, r: 4 }, h: 26, name: "Proponente" },
  herramientas: { plan: { x: -196, y: 124, w: 100, d: 72, r: 4 }, h: 30, name: "Herramientas" },
  entorno: { plan: { x: -56, y: 118, w: 124, d: 98, r: 4 }, h: 40, name: "Entorno de ejecución" },
  evaluador: { plan: { x: 150, y: 86, w: 124, d: 104, r: 4 }, h: 30, name: "Evaluador" },
  estA: { plan: { x: 382, y: -240, w: 222, d: 144, r: 5 }, h: 6, name: "A · Reflexión y herramientas" },
  estB: { plan: { x: 382, y: -72, w: 222, d: 144, r: 5 }, h: 6, name: "B · Aprendizaje por refuerzo" },
  estC: { plan: { x: 382, y: 96, w: 222, d: 144, r: 5 }, h: 6, name: "C · Búsqueda evolutiva" },
};
export const centreOf = (id, dz = 0) => {
  const { plan, h } = M[id];
  return [plan.x + plan.w / 2, plan.y + plan.d / 2, h + dz];
};
export const boxOf = (id, extra = 0) => {
  const { plan, h } = M[id];
  return k.boxCorners(k.insetPlan(plan, -extra), 0, h + extra);
};

// Puertos en el suelo (z = 0.4) para las rutas de los bucles.
const port = (id, side, share = 0.5) => {
  const { plan } = M[id];
  if (side === "+x") return [plan.x + plan.w + 6, plan.y + plan.d * share, 0.4];
  if (side === "-x") return [plan.x - 6, plan.y + plan.d * share, 0.4];
  if (side === "+y") return [plan.x + plan.w * share, plan.y + plan.d + 6, 0.4];
  return [plan.x + plan.w * share, plan.y - 6, 0.4];
};

const z = 0.4;
export const ROUTES = {
  1: {
    name: "Bucle 1 · resolver una tarea",
    role: "in",
    stops: ["datos", "contexto", "modelo", "herramientas", "entorno", "evaluador", "contexto"],
    points: [[-250, -6, z], [-250, -80, z], [-196, -80, z], [-190, -80, z], [-125, -80, z], [-125, -106, z], [-125, -131, z], [-215, -131, z], [-215, 105, z], [-146, 105, z], [-146, 118, z], [-146, 160, z], [-90, 160, z], [-62, 160, z], [74, 177, z], [110, 177, z], [144, 177, z], [212, 177, z], [212, 60, z], [-30, 60, z], [-30, -54, z]],
  },
  2: {
    name: "Bucle 2 · modificar el sistema",
    role: "g",
    stops: ["evaluador", "proponente", "codigo", "entorno", "evaluador", "archivo"],
    points: [[170, 80, z], [170, 10, z], [120, 10, z], [120, -28, z], [120, -118, z], [120, -155, z], [216, -204, z], [244, -204, z], [244, 40, z], [40, 40, z], [40, 112, z], [40, 140, z], [74, 128, z], [144, 128, z], [280, 110, z], [300, 110, z], [300, -150, z], [-10, -150, z], [-10, -169, z]],
  },
  3: {
    name: "Bucle 3 · ¿mejora el proceso que produce mejoras?",
    role: "hi",
    stops: ["archivo", "proponente", "archivo"],
    points: [[71, -211, z], [80, -211, z], [80, -118, z], [60, -118, z], [60, -169, z]],
  },
};

export function pointAlong(points, s) {
  const lengths = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const d = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1], points[i][2] - points[i - 1][2]);
    lengths.push(d);
    total += d;
  }
  let target = Math.max(0, Math.min(1, s)) * total;
  for (let i = 0; i < lengths.length; i++) {
    if (target <= lengths[i] || i === lengths.length - 1) {
      const t = lengths[i] ? Math.min(1, target / lengths[i]) : 0;
      const a = points[i];
      const b = points[i + 1];
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    }
    target -= lengths[i];
  }
  return points[points.length - 1];
}

// ---------- Constructores de módulos ----------
function buildModeloShell(P, state = {}) {
  // Gabinete abierto con postes, techo y paneles de vidrio (corte): la parte trasera.
  const { plan, h } = M.modelo;
  const out = [`<path class="iso-halo" d="${k.haloOf(plan, 0, 0.1, P)}" style="filter:blur(8px)"/>`];
  out.push(S(k.slabOf(plan, 0, 6, P, 6, 1), { tone: "mid", inner: L(k.sideSeam(plan, 3, P, 6), { tone: "faint" }) }));
  const posts = k.corners(plan, 5);
  const view = k.towardViewer(P);
  const back = posts.filter(([x, y]) => (x - (plan.x + plan.w / 2)) * view[0] + (y - (plan.y + plan.d / 2)) * view[1] < 0);
  for (const [x, y] of back) out.push(S(k.slabOf({ x: x - 3, y: y - 3, w: 6, d: 6, r: 1 }, 6, h - 10, P, 2, 0.4), { tone: "mid" }));
  // panel trasero (paredes −x y −y) como placas finas con nervios
  out.push(S(k.slabOf({ x: plan.x + 2, y: plan.y + 2, w: plan.w - 4, d: 2.4, r: 0.6 }, 6, h - 10, P, 2), { tone: "lo" }));
  out.push(S(k.slabOf({ x: plan.x + 2, y: plan.y + 2, w: 2.4, d: plan.d - 4, r: 0.6 }, 6, h - 10, P, 2), { tone: "lo" }));
  // guías de bandejas en la pared trasera
  for (const z of [16, 32, 48, 64]) out.push(L(k.segment([plan.x + 4.4, plan.y + 4.4, z], [plan.x + plan.w - 4, plan.y + 4.4, z], P) + k.segment([plan.x + 4.4, plan.y + 4.4, z], [plan.x + 4.4, plan.y + plan.d - 4, z], P), { tone: "lo" }));
  return out.join("");
}
function buildModeloFront(P, state = {}) {
  const { plan, h } = M.modelo;
  const out = [];
  const posts = k.corners(plan, 5);
  const view = k.towardViewer(P);
  const front = posts.filter(([x, y]) => (x - (plan.x + plan.w / 2)) * view[0] + (y - (plan.y + plan.d / 2)) * view[1] >= 0);
  for (const [x, y] of front) out.push(S(k.slabOf({ x: x - 3, y: y - 3, w: 6, d: 6, r: 1 }, 6, h - 10, P, 2, 0.4), { tone: "mid" }));
  // marcos del vidrio en las caras frontales (+x, +y)
  const z0 = 6;
  const z1 = h - 4;
  const fx = plan.x + plan.w - 2;
  const fy = plan.y + plan.d - 2;
  const glassX = [[fx, plan.y + 6, z0], [fx, fy - 4, z0], [fx, fy - 4, z1], [fx, plan.y + 6, z1]].map((p) => at(p, P));
  const glassY = [[plan.x + 6, fy, z0], [fx - 4, fy, z0], [fx - 4, fy, z1], [plan.x + 6, fy, z1]].map((p) => at(p, P));
  const poly = (pts) => `M${pts.map((p) => p.map((v) => v.toFixed(1)).join(" ")).join("L")}Z`;
  out.push(`<path class="glass" d="${poly(glassX)}"/><path class="glass" d="${poly(glassY)}"/>`);
  out.push(L(k.segment([fx, plan.y + 6, z0 + (z1 - z0) * 0.5], [fx, fy - 4, z0 + (z1 - z0) * 0.5], P) + k.segment([plan.x + 6, fy, z0 + (z1 - z0) * 0.5], [fx - 4, fy, z0 + (z1 - z0) * 0.5], P), { tone: "faint" }));
  // techo
  out.push(S(k.slabOf(k.insetPlan(plan, -1), h - 10, 6, P, 6, 1), { tone: "mid" }));
  out.push(D(k.corners(plan, 6).map(([x, y]) => at([x, y, h - 4], P)), { size: 0.5 }));
  out.push(labelPlate({ x: plan.x + plan.w - 52, y: plan.y + 14, w: 40, d: 18, r: 1.5 }, h - 4, P));
  return out.join("");
}

function buildDatos(P, state = {}) {
  const { plan, h } = M.datos;
  const out = [cabinet(plan, 0, h, P, { tone: "mid" })];
  // cuatro cajones en la cara +x: desarrollo, validación, prueba (sellada), auditoría
  const names = ["dev", "valid", "test", "audit"];
  const x = plan.x + plan.w;
  const span = (plan.d - 12) / 4;
  names.forEach((name, index) => {
    const y0 = plan.y + 6 + index * span;
    const open = state.open === name ? 14 : 0;
    const front = { x: x - 1 + open, y: y0 + 2, w: 3, d: span - 4, r: 0.8 };
    if (open) out.push(S(k.slabOf({ x: x - 1, y: y0 + 3, w: open, d: span - 6, r: 0.5 }, 9, 26, P, 2), { tone: "lo" }));
    out.push(S(k.slabOf(front, 7, h - 18, P, 2, 0.4), { tone: name === "test" ? "lo" : "mid", className: `drawer d-${name}` }));
    out.push(S(k.slabOf({ x: front.x + 3, y: y0 + span / 2 - 5, w: 2, d: 10, r: 0.8 }, 20, 4, P, 2), { tone: "mid" }));
    if (name === "test") {
      // candado: precinto de la prueba reservada
      out.push(S(k.slabOf({ x: front.x + 3, y: y0 + span / 2 - 3, w: 3, d: 6, r: 1 }, 30, 7, P, 2), { tone: "hi" }));
      out.push(L(k.sideRing([front.x + 4.5, y0 + span / 2, 38.5], 2, "x", P, 16), { tone: "mid" }));
    }
  });
  return out.join("");
}

function buildContexto(P, state = {}) {
  const { plan, h } = M.contexto;
  const out = [S(k.slabOf(plan, 0, 4, P, 4, 0.8), { tone: "mid", className: "ctx-base" })];
  // diez ranuras (máximo 10 posiciones) y una regla de presupuesto en el borde frontal
  const slot = (plan.w - 14) / 10;
  for (let i = 0; i < 10; i++) out.push(L(k.planOutline({ x: plan.x + 7 + i * slot + 1, y: plan.y + 6, w: slot - 2, d: plan.d - 16, r: 1 }, 4, P, 3), { tone: i < (state.used ?? 6) ? "lo" : "faint" }));
  const strip = { x: plan.x + 6, y: plan.y + plan.d - 8, w: plan.w - 12, d: 5, r: 0.8 };
  out.push(S(k.slabOf(strip, 4, 0.6, P, 2), { tone: "lo", crease: "none" }));
  const t = k.topTicks(strip.x + 2, strip.x + strip.w - 2, 4, 4, strip.y + 0.6, 4.6, [1.4, 2.8], P);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  if (state.fill !== undefined) {
    const w = (strip.w - 4) * Math.min(1, state.fill);
    out.push(`<path class="bar" data-r="${state.fill > 0.98 ? "bad" : "in"}" d="${k.planOutline({ x: strip.x + 2, y: strip.y + 1.4, w, d: 2.2, r: 0.4 }, 4.7, P, 2)}"/>`);
  }
  return out.join("");
}

function buildHerramientas(P) {
  const { plan, h } = M.herramientas;
  const out = [cabinet(plan, 0, h, P)];
  // ejecutor de pruebas: cuatro lámparas y una perilla; lector de registros: rodillo
  for (let i = 0; i < 4; i++) out.push(lamp(plan.x + 16 + i * 12, plan.y + 18, h, P, "off", 3));
  out.push(knob(plan.x + plan.w - 16, plan.y + 18, h, 5, P, 0.6));
  out.push(S(k.slabOf({ x: plan.x + 10, y: plan.y + 36, w: plan.w - 20, d: 22, r: 2 }, h, 3, P, 3, 0.4), { tone: "lo" }));
  out.push(L(k.planOutline({ x: plan.x + 14, y: plan.y + 40, w: plan.w - 28, d: 14, r: 1.5 }, h + 3, P, 3), { tone: "faint" }));
  return out.join("");
}

function buildEntorno(P, state = {}) {
  const { plan, h } = M.entorno;
  const out = [S(k.slabOf(plan, 0, 6, P, 5, 1), { tone: "mid" })];
  // recinto aislado (sandbox): vidrio sobre bastidor
  const inner = k.insetPlan(plan, 6);
  out.push(S(k.slabOf(inner, 6, 2, P, 4), { tone: "lo" }));
  out.push(`<path class="glass" d="${k.slabOf(inner, 8, h - 10, P, 3).fill}"/>`);
  out.push(L(k.slabOf(inner, 8, h - 10, P, 3).outline, { tone: "lo" }));
  out.push(S(k.slabOf(k.insetPlan(plan, 4), h - 2, 2, P, 4, 0.6), { tone: "mid" }));
  // medidor de presupuesto
  const meter = { x: plan.x + 8, y: plan.y + plan.d - 4.5, w: plan.w - 16, d: 3, r: 0.6 };
  out.push(S(k.slabOf(meter, 6, 0.6, P, 2), { tone: "lo", crease: "none" }));
  if (state.budget !== undefined) out.push(`<path class="bar" data-r="${state.budget > 0.95 ? "bad" : "g"}" d="${k.planOutline({ x: meter.x + 0.5, y: meter.y + 0.6, w: (meter.w - 1) * Math.min(1, state.budget), d: 1.8, r: 0.3 }, 6.7, P, 2)}"/>`);
  // planificador de trabajos (bandejas de máquinas)
  for (let i = 0; i < 5; i++) out.push(S(k.slabOf({ x: inner.x + 8 + i * 18, y: inner.y + 10, w: 12, d: 22, r: 1.2 }, 8, 6 + (i % 3) * 3, P, 2, 0.3), { tone: "mid" }));
  return out.join("");
}

function buildCodigo(P, state = {}) {
  const { plan, h } = M.codigo;
  const out = [cabinet(plan, 0, h, P)];
  // ranura del gestor de contexto (cartucho) y ranura de estrategia
  const slotA = { x: plan.x + 14, y: plan.y + 16, w: 40, d: 22, r: 2 };
  const slotB = { x: plan.x + 66, y: plan.y + 16, w: 40, d: 22, r: 2 };
  out.push(L(k.planOutline(slotA, h, P, 3) + k.planOutline(slotB, h, P, 3), { tone: "lo" }));
  out.push(labelPlate({ x: plan.x + 14, y: plan.y + 50, w: 50, d: 20, r: 1.5 }, h, P));
  out.push(knob(plan.x + 90, plan.y + 60, h, 6, P, 1.2));
  return out.join("");
}

function buildProponente(P, state = {}) {
  const { plan, h } = M.proponente;
  const out = [cabinet(plan, 0, h, P)];
  // atril de análisis: placa inclinada (registros) y ranura del analista
  out.push(S(k.slabOf({ x: plan.x + 10, y: plan.y + 10, w: 50, d: 34, r: 2 }, h, 2, P, 3, 0.4), { tone: "lo" }));
  for (let i = 0; i < 5; i++) out.push(L(k.lineOnTop([plan.x + 14, plan.y + 16 + i * 5.5], [plan.x + 56 - (i % 2) * 10, plan.y + 16 + i * 5.5], h + 2, P), { tone: "lo", free: true }));
  out.push(L(k.planOutline({ x: plan.x + 70, y: plan.y + 14, w: 30, d: 20, r: 2 }, h, P, 3), { tone: "lo" }));
  out.push(lamp(plan.x + 85, plan.y + 52, h, P, state.lamp || "off", 3.4));
  return out.join("");
}

function buildEvaluador(P, state = {}) {
  const { plan, h } = M.evaluador;
  const out = [cabinet(plan, 0, h, P)];
  out.push(gauge(plan.x + 38, plan.y + 46, h, 22, P, state.value ?? 0));
  out.push(lamp(plan.x + 86, plan.y + 26, h, P, state.ok ? "ok" : "off", 4));
  out.push(lamp(plan.x + 86, plan.y + 46, h, P, state.fail ? "fail" : "off", 4));
  out.push(labelPlate({ x: plan.x + 74, y: plan.y + 62, w: 36, d: 22, r: 1.5 }, h, P));
  return out.join("");
}

function buildArchivo(P, state = {}) {
  const { plan, h } = M.archivo;
  const out = [S(k.slabOf(plan, 0, h - 8, P, 5, 1), { tone: "mid" })];
  // riel con ranuras para cartuchos de versión
  out.push(S(k.slabOf(k.insetPlan(plan, 4), h - 8, 3, P, 4, 0.5), { tone: "lo" }));
  const slots = 8;
  for (let i = 0; i < slots; i++) out.push(L(k.planOutline({ x: plan.x + 10 + i * 18, y: plan.y + 12, w: 12, d: plan.d - 24, r: 1 }, h - 5, P, 2), { tone: "faint" }));
  return out.join("");
}

function buildStation(id) {
  return (P) => {
    const { plan, h } = M[id];
    const out = [S(k.slabOf(plan, 0, h, P, 5, 0.8), { tone: "lo" })];
    out.push(L(k.planOutline(k.insetPlan(plan, 5), h, P, 5), { tone: "faint" }));
    out.push(labelPlate({ x: plan.x + 10, y: plan.y + plan.d - 26, w: 44, d: 18, r: 1.5 }, h, P));
    return out.join("");
  };
}

function buildRoute(id) {
  return (P, state = {}) => {
    const route = ROUTES[id];
    const d = k.onTop(route.points.map(([x, y]) => [x, y]), 0.4, P);
    const cls = state.off ? "route off" : "route";
    return `<path class="route-bed" d="${d}"/><path class="${cls}" data-loop="${id}" d="${d}"/>`;
  };
}

function buildPulse(P, state = {}) {
  const r = (state.r || 2.4) * k.cameraOf(P).k;
  const [x, y] = k.iso(state.at || [0, 0, 0], P);
  return `<g class="pulse" data-r="${state.role || "in"}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}"/></g>`;
}

export const INFO = {};
const info = (id, data) => (INFO[id] = data);

info("modelo", {
  title: "Modelo θ (Transformer didáctico)",
  kind: "módulo · pesos",
  role: "w",
  what: "Transforma un contexto de tokens en una distribución sobre el siguiente token. En inferencia sus 2048 parámetros θ no cambian.",
  inputs: ["contexto"],
  outputs: ["proponente", "herramientas"],
  op: "p(siguiente | contexto) = softmax(LN_f(h_n)·W_U + b_U)",
  prov: "local",
  more: "Arquitectura didáctica decoder-only: vocabulario 16, d_model 8, 2 cabezas de 4, 2 bloques, MLP 32, pre-LayerNorm. Pesos aleatorios con semilla 7: no hay comprensión lingüística detrás de sus predicciones.",
});
info("contexto", { title: "Contexto", kind: "módulo · entradas", role: "in", what: "La ventana de entrada: tokens del modelo (escena 2) o líneas de registro elegidas por el gestor de contexto (escena 7), siempre bajo un presupuesto.", inputs: ["datos", "evaluador"], outputs: ["modelo"], op: "contexto = gestor(registro, presupuesto)", prov: "local", more: "Cambiar el contexto cambia las activaciones, no los pesos." });
info("datos", { title: "Datos", kind: "módulo · particiones", role: "in", what: "Cuatro cajones: desarrollo (registros visibles al proponente), validación (sólo agregados), prueba reservada (sellada) y auditoría (escenas 8 y 10).", inputs: [], outputs: ["contexto"], op: "tareas = generar(semilla)", prov: "local", more: "Las tareas son sintéticas y reproducibles: misma semilla, mismo registro. La prueba reservada nunca retroalimenta la búsqueda." });
info("herramientas", { title: "Herramientas", kind: "módulo", role: "in", what: "Ejecutor de pruebas y lector de registros. Producen observaciones externas (resultados, errores) que pueden entrar al contexto.", inputs: ["modelo"], outputs: ["entorno"], op: "observación = ejecutar(código, pruebas)", prov: "local" });
info("entorno", { title: "Entorno de ejecución", kind: "módulo · infraestructura", role: "off", what: "Recinto aislado donde se ejecutan candidatas con un presupuesto definido (barra naranja). Incluye un planificador de trabajos.", inputs: ["codigo", "herramientas"], outputs: ["evaluador"], op: "resultado = ejecutar(variante, tareas, presupuesto)", prov: "local", more: "La infraestructura y el protocolo de evaluación se indican aparte del estado S_t: en este experimento no se modifican." });
info("codigo", { title: "Código del agente", kind: "módulo · código", role: "g", what: "Ranuras con el gestor de contexto activo y la estrategia de experimentos. Es lo que la automejora del agente modifica en este experimento.", inputs: ["proponente"], outputs: ["entorno", "contexto"], op: "código_{t+1} = promover(variante) si cumple el criterio", prov: "local" });
info("proponente", { title: "Proponente", kind: "módulo", role: "in", what: "Analiza registros de desarrollo y propone variantes. En el modo B lee los informes a través del gestor de contexto de la versión promovida: ahí aparece la autorreferencia.", inputs: ["evaluador", "archivo"], outputs: ["codigo"], op: "variante = proponer(padre, análisis(registros), memoria)", prov: "sim", more: "Sus reglas son declaradas (no es un LLM). Las propuestas v1–v3 de la escena 7 son guionadas." });
info("evaluador", { title: "Evaluador", kind: "módulo · criterio", role: "ok", what: "Compara versiones sobre las mismas tareas y semillas con un criterio explícito: IC95 pareado de Δéxito > 0 para promover.", inputs: ["entorno"], outputs: ["archivo", "proponente"], op: "veredicto = bootstrap pareado (2000 remuestreos, semilla fija)", prov: "local" });
info("archivo", { title: "Archivo de versiones", kind: "módulo · historia", role: "off", what: "Guarda toda variante válida (también las subóptimas y diversas). Guardar no es promover: sólo una versión está activa.", inputs: ["evaluador"], outputs: ["proponente"], op: "archivo ← archivo ∪ {variante válida}", prov: "local" });
info("estA", { title: "Estación A · Reflexión y herramientas", kind: "estación", role: "in", what: "Generar, probar, observar el error, escribir una nota y reintentar. Cambia el contexto/memoria; θ no cambia.", prov: "local" });
info("estB", { title: "Estación B · REINFORCE con baseline", kind: "estación", role: "w", what: "Una política pequeña (4 parámetros) elige estrategias de lectura; la recompensa sale de ejecutar el solucionador en tareas reales del banco.", prov: "local" });
info("estC", { title: "Estación C · Búsqueda evolutiva de programas", kind: "estación", role: "g", what: "Muta funciones de prioridad de un planificador de trabajos, las evalúa con presupuesto por candidata y guarda un archivo de diversidad.", prov: "local" });
for (const id of [1, 2, 3]) info(`route${id}`, { title: ROUTES[id].name, kind: "ruta de dependencias", role: ROUTES[id].role === "hi" ? "off" : ROUTES[id].role, what: id === 1 ? "Datos → contexto → modelo → herramientas → entorno → evaluador → contexto. Cambian activaciones y contexto; θ fijo." : id === 2 ? "Evaluador → proponente → código → entorno → evaluador → archivo. Cambia el código del agente si una variante cumple el criterio." : "Archivo → proponente: las versiones promovidas vuelven a participar en el análisis. Hay que medir si eso mejora la capacidad de producir mejoras: cerrar el bucle no lo garantiza.", prov: "local" });

export function buildLab(engine) {
  const add = (object) => engine.add(object);
  add({ id: "plate", layer: 0, anchor: [0, 0, -6], build: (P) => basePlate(MAIN, P) });
  add({ id: "bench", layer: 0, anchor: [470, 0, -6], build: (P) => basePlate(BENCH, P, { ruler: false }) });
  for (const id of [1, 2, 3]) add({ id: `route${id}`, layer: 1, anchor: [0, 0, 0], className: "pick", build: buildRoute(id) });
  const mod = (id, build, extra = {}) => {
    if (id !== "modelo") engine.group(id, { anchor: centreOf(id, -M[id].h / 2) });
    return add({ id, layer: 2, anchor: centreOf(id, -M[id].h / 2), className: "pick", build, group: id, level: 0, ...extra });
  };
  mod("modelo", buildModeloShell, { anchor: [-200, -180, 10], group: "modelo", level: 0 });
  add({ id: "modelo-front", layer: 2, anchor: [-200, -180, 10], group: "modelo", level: 100, build: buildModeloFront, className: "pick", info: "modelo" });
  mod("datos", buildDatos);
  mod("contexto", buildContexto, { pose: { state: { used: 6 } } });
  mod("herramientas", buildHerramientas);
  mod("entorno", buildEntorno);
  mod("codigo", buildCodigo);
  mod("proponente", buildProponente);
  mod("evaluador", buildEvaluador);
  mod("archivo", buildArchivo);
  for (const id of ["estA", "estB", "estC"]) mod(id, buildStation(id));
  for (let i = 0; i < 6; i++) add({ id: `pulse${i}`, layer: 3, anchor: [0, 0, 0], build: buildPulse, pose: { visible: false, state: {} } });
}

export const LAB_IDS = ["plate", "bench", "route1", "route2", "route3", "modelo", "modelo-front", "datos", "contexto", "herramientas", "entorno", "codigo", "proponente", "evaluador", "archivo", "estA", "estB", "estC"];
