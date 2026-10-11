// Piezas de las escenas 6–10: estaciones A, B y C, tiras de registro en la bandeja de contexto
// y cartuchos de versión del gestor de contexto.
import * as k from "../../../kit/iso-kit.mjs";
import { M } from "./lab.mjs";
import { lamp, gauge, cartridge, tokenCard, S, L, D, at } from "./shapes.mjs";
import { BUDGET } from "../model/agent.mjs";

const plan = (id) => M[id].plan;
const top = (id) => M[id].h;

export function buildStations(engine, store) {
  const groupOf = (id) => (id.startsWith("a-") ? "estA" : id.startsWith("b-") ? "estB" : id.startsWith("c-") ? "estC" : id === "ctx-lines" ? "contexto" : undefined);
  const add = (object) => engine.add({ className: "pick", pose: { visible: true, state: {} }, group: groupOf(object.id), level: 1, ...object });

  // ---------- Estación A: reflexión ----------
  const A = plan("estA");
  const zA = top("estA");
  add({ id: "a-gen", anchor: [A.x + 40, A.y + 40, zA + 10], info: "a-gen", build: (P, s = {}) => {
    const g = { x: A.x + 14, y: A.y + 16, w: 52, d: 46, r: 3 };
    const out = [S(k.slabOf(g, zA, 16, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(g, zA + 6, P, 4), { tone: "faint" }) })];
    out.push(S(k.slabOf({ x: g.x + 8, y: g.y + 10, w: 36, d: 6, r: 1 }, zA + 16, 1, P, 2), { tone: "lo" }));
    if (s.attempt) out.push(`<g data-role="g">${tokenCard({ x: g.x + 14, y: g.y + 22, w: 24, d: 14, r: 1.5 }, zA + 16, P, `intento ${s.attempt}`, { lit: true })}</g>`);
    return out.join("");
  } });
  add({ id: "a-tests", anchor: [A.x + 110, A.y + 40, zA + 8], info: "a-tests", build: (P, s = {}) => {
    const g = { x: A.x + 84, y: A.y + 18, w: 62, d: 40, r: 3 };
    const out = [S(k.slabOf(g, zA, 10, P, 4, 0.8), { tone: "mid" })];
    const results = s.results || [];
    for (let i = 0; i < 4; i++) out.push(lamp(g.x + 10 + i * 14, g.y + 14, zA + 10, P, results[i] === undefined ? "off" : results[i] ? "ok" : "fail", 3.6));
    out.push(L(k.planOutline({ x: g.x + 6, y: g.y + 26, w: g.w - 12, d: 9, r: 1 }, zA + 10, P, 2), { tone: "faint" }));
    return out.join("");
  } });
  add({ id: "a-memory", anchor: [A.x + 180, A.y + 40, zA + 4], info: "a-memory", build: (P, s = {}) => {
    const g = { x: A.x + 162, y: A.y + 18, w: 44, d: 52, r: 2 };
    const out = [S(k.slabOf(g, zA, 3, P, 3, 0.6), { tone: "lo" })];
    const notes = s.notes || 0;
    for (let i = 0; i < notes; i++) out.push(`<g data-role="in">${S(k.slabOf({ x: g.x + 4 + i * 1.5, y: g.y + 4 + i * 1.5, w: 34, d: 40, r: 1 }, zA + 3 + i * 1.6, 1.2, P, 2, 0.3), { tone: "hi", lit: i === notes - 1 })}</g>`);
    for (let i = 0; i < 4; i++) out.push(L(k.lineOnTop([g.x + 8 + (notes ? notes * 1.5 : 0), g.y + 12 + i * 7], [g.x + 34 + (notes ? notes * 1.5 : 0) - (i % 2) * 8, g.y + 12 + i * 7], zA + 3 + Math.max(0, notes) * 1.6 + (notes ? 0 : 0.1), P), { tone: notes ? "lo" : "faint", free: true }));
    return out.join("");
  } });
  add({ id: "a-theta", anchor: [A.x + 40, A.y + 100, zA + 4], info: "a-theta", role: "off", build: (P) => {
    const g = { x: A.x + 74, y: A.y + 84, w: 38, d: 30, r: 2 };
    return `<g data-role="off">${S(k.slabOf(g, zA, 8, P, 3, 0.6), { tone: "lo" })}</g>` + L(k.planOutline(k.insetPlan(g, 4), zA + 8, P, 3), { tone: "faint" });
  } });

  // ---------- Estación B: REINFORCE ----------
  const B = plan("estB");
  const zB = top("estB");
  add({ id: "b-policy", anchor: [B.x + 70, B.y + 60, zB + 8], info: "b-policy", build: (P, s = {}) => {
    const out = [S(k.slabOf({ x: B.x + 14, y: B.y + 14, w: 120, d: 92, r: 3 }, zB, 3, P, 4, 0.6), { tone: "mid" })];
    const theta = s.theta || [0, 0, 0, 0];
    const pi = s.pi || [0.25, 0.25, 0.25, 0.25];
    const grad = s.grad || null;
    for (let a = 0; a < 4; a++) {
      const x = B.x + 24 + a * 28;
      // θ_a: varilla violeta (altura ∝ θ_a + 3)
      const ht = Math.max(0.6, (theta[a] + 3) * 3);
      out.push(`<g data-role="w">${S(k.slabOf({ x, y: B.y + 22, w: 7, d: 7, r: 1 }, zB + 3, ht, P, 2, 0.3), { tone: "hi" })}</g>`);
      // π(a): barra cian (altura ∝ probabilidad)
      out.push(`<g data-role="in">${S(k.slabOf({ x, y: B.y + 40, w: 7, d: 14, r: 1 }, zB + 3, Math.max(0.4, pi[a] * 40), P, 2, 0.3), { tone: "hi", lit: s.best === a })}</g>`);
      // gradiente ĝ_a: flecha naranja hacia arriba o abajo sobre la barra
      if (grad) {
        const g = grad[a] * 30;
        const base = zB + 3 + Math.max(0.4, pi[a] * 40) + 2;
        const tip = base + g;
        out.push(`<path class="wire" data-r="g" d="${k.segment([x + 3.5, B.y + 47, base], [x + 3.5, B.y + 47, tip], P)}" style="stroke-width:2"/>`);
        out.push(`<path class="wire" data-r="g" d="${k.segment([x + 1.5, B.y + 47, tip - Math.sign(g) * 2], [x + 3.5, B.y + 47, tip], P)}${k.segment([x + 5.5, B.y + 47, tip - Math.sign(g) * 2], [x + 3.5, B.y + 47, tip], P)}" style="stroke-width:2"/>`);
      }
      out.push(L(k.planOutline({ x: x - 2, y: B.y + 62, w: 11, d: 36, r: 1 }, zB + 3, P, 2), { tone: "faint" }));
    }
    return out.join("");
  } });
  add({ id: "b-batch", anchor: [B.x + 70, B.y + 80, zB + 6], info: "b-batch", build: (P, s = {}) => {
    const out = [];
    for (const [i, e] of (s.batch || []).entries()) {
      const x = B.x + 22 + e.action * 28;
      const y = B.y + 64 + (s.slot ? s.slot[i] : i % 4) * 8;
      out.push(`<g data-role="${e.reward ? "ok" : "bad"}">${S(k.slabOf({ x, y, w: 7, d: 6, r: 1 }, zB + 3, 2, P, 2, 0.3), { tone: "hi" })}</g>`);
    }
    return out.join("");
  } });
  add({ id: "b-baseline", anchor: [B.x + 170, B.y + 60, zB + 6], info: "b-baseline", build: (P, s = {}) => {
    const out = [S(k.slabOf({ x: B.x + 146, y: B.y + 30, w: 56, d: 60, r: 3 }, zB, 4, P, 4, 0.6), { tone: "mid" })];
    out.push(gauge(B.x + 174, B.y + 60, zB + 4, 20, P, s.b ?? 0.5));
    return out.join("");
  } });

  // ---------- Estación C: búsqueda evolutiva ----------
  const C = plan("estC");
  const zC = top("estC");
  add({ id: "c-archive", anchor: [C.x + 60, C.y + 60, zC + 6], info: "c-archive", build: (P, s = {}) => {
    const g = { x: C.x + 12, y: C.y + 12, w: 100, d: 96, r: 3 };
    const out = [S(k.slabOf(g, zC, 3, P, 4, 0.6), { tone: "mid" })];
    const cols = s.cols || ["r", "rs", "krs", "ks", "s", "k", "kr"];
    const cw = (g.w - 8) / 4;
    const ch = (g.d - 8) / cols.length;
    for (let r = 0; r < 4; r++) for (let c = 0; c < cols.length; c++) out.push(L(k.planOutline({ x: g.x + 4 + r * cw + 0.8, y: g.y + 4 + c * ch + 0.8, w: cw - 1.6, d: ch - 1.6, r: 0.6 }, zC + 3, P, 2), { tone: "faint" }));
    for (const e of s.elites || []) {
      const [sizeBin, vars] = e.cell.split("|");
      const c = cols.indexOf(vars);
      if (c < 0) continue;
      const h = Math.max(0.8, (0.22 - e.score) * 120);
      out.push(`<g data-role="${e.best ? "ok" : "g"}">${S(k.slabOf({ x: g.x + 4 + Number(sizeBin) * cw + 2, y: g.y + 4 + c * ch + 1.4, w: cw - 4, d: ch - 2.8, r: 0.6 }, zC + 3, h, P, 2, 0.3), { tone: "hi", lit: e.fresh })}</g>`);
    }
    return out.join("");
  } });
  add({ id: "c-bins", anchor: [C.x + 160, C.y + 60, zC + 6], info: "c-bins", build: (P, s = {}) => {
    const g = { x: C.x + 124, y: C.y + 14, w: 84, d: 100, r: 3 };
    const out = [S(k.slabOf(g, zC, 3, P, 4, 0.6), { tone: "lo" })];
    const fills = s.fills || [];
    const n = Math.min(12, fills.length || 0);
    for (let i = 0; i < 12; i++) {
      const x = g.x + 6 + (i % 4) * 19;
      const y = g.y + 8 + Math.floor(i / 4) * 30;
      out.push(L(k.planOutline({ x, y, w: 14, d: 22, r: 1 }, zC + 3, P, 2), { tone: "faint" }));
      if (i < n) out.push(`<g data-role="in">${S(k.slabOf({ x: x + 1, y: y + 1, w: 12, d: 20, r: 0.8 }, zC + 3, (fills[i] / 100) * 16, P, 2, 0.3), { tone: "hi" })}</g>`);
    }
    return out.join("");
  } });

  // ---------- Tiras de registro en la bandeja de contexto (escena 7) ----------
  const X = plan("contexto");
  const zX = top("contexto");
  const per = (X.w - 12) / BUDGET; // longitud por token
  add({ id: "ctx-lines", layer: 2, anchor: [X.x + X.w / 2, X.y + X.d / 2, zX + 2], bias: 2, info: "ctx-lines", pose: { visible: false, state: {} }, build: (P, s = {}) => {
    const out = [];
    let x = X.x + 6;
    const lane = (s.lanes || 1) > 1;
    for (const line of s.kept || []) {
      const w = line.tokens * per;
      const role = line.evidence ? "ok" : "in";
      out.push(`<g data-role="${role}">${S(k.slabOf({ x: x + 0.3, y: X.y + 9, w: Math.max(0.6, w - 0.6), d: 14, r: 0.6 }, zX, line.evidence ? 2.6 : 1.4, P, 2, 0.2), { tone: "hi", lit: !!line.evidence })}</g>`);
      x += w;
    }
    // las que no caben caen fuera de la bandeja (delante, en rojo)
    let xo = X.x + 6;
    for (const line of s.dropped || []) {
      const w = line.tokens * per * 0.5;
      out.push(`<g data-role="bad" style="opacity:.75">${S(k.slabOf({ x: xo, y: X.y + X.d + 8, w: Math.max(0.6, w - 0.4), d: 8, r: 0.4 }, 0, line.evidence ? 2 : 1, P, 2), { tone: "hi" })}</g>`);
      xo += w;
    }
    return out.join("");
  } });

  // ---------- Cartuchos de versión ----------
  const Cd = plan("codigo");
  const Ar = plan("archivo");
  const Pr = plan("proponente");
  const slots = {
    active: { x: Cd.x + 16, y: Cd.y + 18, z: top("codigo") },
    analyst: { x: Pr.x + 72, y: Pr.y + 16, z: top("proponente") },
    proposer: { x: Pr.x + 14, y: Pr.y + 52, z: top("proponente") },
  };
  for (let i = 0; i < 8; i++) slots[`arch${i}`] = { x: Ar.x + 9 + i * 18, y: Ar.y + 14, z: top("archivo") - 5 };
  for (const v of ["v0", "v1", "v2", "v3", "an"]) {
    add({ id: `cart-${v}`, layer: 2, anchor: [0, 0, 0], info: "cart", pose: { visible: false, state: {} }, build: (P, s = {}) => {
      const slot = slots[s.slot || "arch0"];
      const w = s.slot && s.slot.startsWith("arch") ? 14 : 36;
      const d = s.slot && s.slot.startsWith("arch") ? 44 : 18;
      const g = { x: slot.x + (s.dx || 0), y: slot.y + (s.dy || 0), w, d, r: 1.5 };
      const z = slot.z + (s.lift || 0);
      const entry = engine.objects.get(`cart-${v}`);
      entry.anchor = [g.x + w / 2, g.y + d / 2, z + 4];
      const key = s.slot || "arch0";
      entry.group = key === "active" ? "codigo" : key.startsWith("arch") ? "archivo" : "proponente";
      entry.level = 1;
      const role = s.role || "off";
      return `<g data-role="${role}">${cartridge(g, z, 7, P, { tone: "hi", lit: !!s.lit })}</g>`;
    } });
  }
  return { slots };
}
