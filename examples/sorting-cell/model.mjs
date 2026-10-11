// The sorting cell as one pure timeline. Every position, count and reading on the page
// comes from at(τ): 1 world unit is 5 mm, τ is simulated seconds at 1× speed.
export const CELL = {
  MM: 5,
  BELT_TOP: 70,
  BELT_T: 0.8,
  ROLLER_R: 4,
  DRUM_R: 6.8,
  ROLLERS: Array.from({ length: 14 }, (_, i) => -58 - 16 * i),
  DRUMS: [-282, -42],
  DOC: { L: 60, W: 42, T: 0.8 },
  WAIT_X: -255,
  STOP_X: -82.4,
  SCAN_X: -160,
  EYES: [-205, -98],
  COL: [10, 0],
  L1: 52,
  L2: 46,
  CUP_H: 3,
  HEAD_H: 3,
  LIFT: 86,
  TRAY_FLOOR: 50,
  SHEET: 0.5,
  TRAYS: [
    { key: "pol", name: "Pólizas", label: "PÓLIZAS", at: [10, -85], out: [0, -1], base: 14 },
    { key: "pro", name: "Procedimientos", label: "PROCEDIMIENTOS", at: [100, 0], out: [1, 0], base: 11 },
    { key: "rev", name: "Revisión manual", label: "REVISIÓN MANUAL", at: [10, 85], out: [0, 1], base: 3 },
  ],
  V: 50,
  T: 3.2,
  THRESHOLD: 0.8,
  DPI: 300,
  LINES: 3508,
};

const C = CELL;
const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const ease = (t) => {
  const u = clamp(t, 0, 1);
  return u * u * (3 - 2 * u);
};
const smooth = (a, b, x) => ease((x - a) / (b - a));

// Arm cycle, measured from the moment a document reaches the stopper.
export const STEPS = { down: 0.3, grip: 0.45, up: 0.75, there: 1.6, lower: 1.9, drop: 2.05, rise: 2.3, back: 3.15 };
const ARRIVE = (C.STOP_X - C.WAIT_X) / C.V;
const SCAN_IN = (C.SCAN_X - C.DOC.L / 2 - C.WAIT_X) / C.V;
const SCAN_OUT = (C.SCAN_X + C.DOC.L / 2 - C.WAIT_X) / C.V;
const DECIDE = SCAN_OUT + 0.12;

function hash(n) {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function docOf(n) {
  const r = hash(n * 7 + 3);
  const kind = r < 0.47 ? 0 : 1;
  const conf = 0.62 + 0.37 * hash(n * 13 + 1);
  const cls = conf < C.THRESHOLD ? 2 : kind;
  return { n, id: `DOC-${String(n + 140).padStart(4, "0")}`, kind, cls, conf, layout: hash(n * 31 + 5) < 0.5 ? 0 : 1 };
}

function ik([x, y], prefer) {
  const dx = x - C.COL[0];
  const dy = y - C.COL[1];
  const d = Math.min(Math.hypot(dx, dy), C.L1 + C.L2 - 0.01);
  const c2 = (d * d - C.L1 * C.L1 - C.L2 * C.L2) / (2 * C.L1 * C.L2);
  const q2 = Math.acos(clamp(c2, -1, 1));
  let q1 = Math.atan2(dy, dx) - Math.atan2(C.L2 * Math.sin(q2), C.L1 + C.L2 * Math.cos(q2));
  while (q1 < prefer - Math.PI) q1 += TAU;
  while (q1 > prefer + Math.PI) q1 -= TAU;
  return [q1, q2];
}

export function joints([q1, q2]) {
  const e = [C.COL[0] + C.L1 * Math.cos(q1), C.COL[1] + C.L1 * Math.sin(q1)];
  const w = [e[0] + C.L2 * Math.cos(q1 + q2), e[1] + C.L2 * Math.sin(q1 + q2)];
  return { e, w };
}

const PICK = [C.STOP_X, 0];
const Q_PICK = ik(PICK, Math.PI);
const Q_TRAY = [ik(C.TRAYS[0].at, Q_PICK[0] + Math.PI / 2), ik(C.TRAYS[1].at, Q_PICK[0] + Math.PI), ik(C.TRAYS[2].at, Q_PICK[0] - Math.PI / 2)];
const DOC_TOP = C.BELT_TOP + C.DOC.T;

const releaseOf = (n) => n * C.T;
const arriveOf = (n) => releaseOf(n) + ARRIVE;
const dropOf = (n) => arriveOf(n) + STEPS.drop;

export function countsAt(tau) {
  const counts = C.TRAYS.map((t) => t.base);
  const last = Math.floor((tau - ARRIVE - STEPS.drop) / C.T);
  for (let n = 0; n <= last; n++) counts[docOf(n).cls]++;
  return counts;
}

const stackTop = (count) => C.TRAY_FLOOR + (count % 30) * C.SHEET;

export function stageOf(n, tau) {
  const r = releaseOf(n);
  const u = tau - r;
  if (u < 0) return { key: "mag", name: "En el alimentador", step: 0 };
  if (u < SCAN_IN) return { key: "feed", name: "Alimentación", step: 1 };
  if (u < SCAN_OUT) return { key: "scan", name: "Escaneo", step: 2 };
  if (u < ARRIVE) return { key: "class", name: u < DECIDE ? "Clasificando" : "Clasificado", step: 3 };
  const a = u - ARRIVE;
  if (a < STEPS.up) return { key: "pick", name: "Recogida", step: 4 };
  if (a < STEPS.drop) return { key: "move", name: "Traslado", step: 5 };
  return { key: "tray", name: "En bandeja", step: 6 };
}

export function at(tau) {
  const travel = C.V * tau;
  const k = Math.floor((tau - ARRIVE) / C.T);
  const u = tau - ARRIVE - k * C.T;
  const counts = countsAt(tau);
  const docs = [];
  let carried = null;
  const first = Math.max(0, Math.floor((tau - ARRIVE - STEPS.drop) / C.T));
  const next = Math.max(0, Math.floor(tau / C.T) + 1);
  for (let n = first; n <= next; n++) {
    const d = docOf(n);
    const r = releaseOf(n);
    if (tau < r && n !== next) continue;
    const since = tau - r;
    if (since >= ARRIVE + STEPS.drop) continue;
    const x = since < 0 ? C.WAIT_X : Math.min(C.WAIT_X + C.V * since, C.STOP_X);
    const scan = clamp((x + C.DOC.L / 2 - C.SCAN_X) / C.DOC.L, 0, 1);
    const known = since >= DECIDE;
    const entry = { ...d, x, y: 0, z: C.BELT_TOP, scan, known, since, stage: stageOf(n, tau) };
    if (since >= ARRIVE + STEPS.down) {
      entry.held = true;
      carried = entry;
    }
    docs.push(entry);
  }

  // Arm, in joint space, with the quill height of the cups' lower face.
  let q = Q_PICK;
  let z = C.LIFT;
  let vacuum = false;
  let target = -1;
  if (k >= 0) {
    const d = docOf(k);
    target = d.cls;
    const qt = Q_TRAY[d.cls];
    const deposit = stackTop(counts[d.cls] - (u >= STEPS.drop ? 1 : 0)) + C.DOC.T;
    const S = STEPS;
    const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    if (u < S.down) z = C.LIFT + (DOC_TOP - C.LIFT) * smooth(0, S.down, u);
    else if (u < S.grip) z = DOC_TOP;
    else if (u < S.up) z = DOC_TOP + (C.LIFT - DOC_TOP) * smooth(S.grip, S.up, u);
    else if (u < S.there) q = mix(Q_PICK, qt, smooth(S.up, S.there, u));
    else if (u < S.lower) { q = qt; z = C.LIFT + (deposit - C.LIFT) * smooth(S.there, S.lower, u); }
    else if (u < S.drop) { q = qt; z = deposit; }
    else if (u < S.rise) { q = qt; z = deposit + (C.LIFT - deposit) * smooth(S.drop, S.rise, u); }
    else if (u < S.back) q = mix(qt, Q_PICK, smooth(S.rise, S.back, u));
    vacuum = u >= S.down && u < S.drop;
    if (u >= S.rise) target = -1;
  }
  const { e, w } = joints(q);
  if (carried) {
    carried.x = w[0];
    carried.y = w[1];
    carried.z = z - C.DOC.T;
  }

  // Scanner light follows the paper under the line, with soft edges.
  let light = 0;
  let scanning = null;
  for (const d of docs) {
    const lead = d.x + C.DOC.L / 2 - C.SCAN_X;
    const tail = C.SCAN_X - (d.x - C.DOC.L / 2);
    if (!d.held) light = Math.max(light, smooth(-6, 2, lead) * smooth(-6, 2, tail));
    if (d.scan > 0 && d.scan < 1 && !d.held) scanning = d;
  }
  const eyes = C.EYES.map((ex) => docs.some((d) => !d.held && Math.abs(d.x - ex) < C.DOC.L / 2));
  const decided = docs.filter((d) => d.known).sort((a, b) => b.n - a.n)[0] ?? null;
  return { tau, travel, roll: travel / C.ROLLER_R, drum: travel / C.DRUM_R, docs, carried, q, e, w, z, vacuum, target, light, scanning, decided, eyes, counts, stacks: counts.map(stackTop), cycle: k, phase: u };
}

export const TIMES = { ARRIVE, SCAN_IN, SCAN_OUT, DECIDE, DROP: ARRIVE + STEPS.drop };
export const timeOf = { releaseOf, arriveOf, dropOf };
