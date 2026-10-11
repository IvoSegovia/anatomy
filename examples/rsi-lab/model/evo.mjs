import { makeRng } from "./rng.mjs";

export const CAPACITY = 100;
const OPS = ["+", "-", "*", "min", "max"];
const VARS = ["s", "r", "k"];
const CONSTS = [1, 2, 5, 10];

export const SEEDS = {
  primero: ["neg", ["var", "k"]],
  peor: ["-", ["var", "r"], ["var", "s"]],
};
export const BASELINES = {
  "primer ajuste": SEEDS.primero,
  "mejor ajuste": ["-", ["var", "s"], ["var", "r"]],
};

export function evalExpr(node, env) {
  switch (node[0]) {
    case "var": return env[node[1]];
    case "const": return node[1];
    case "neg": return -evalExpr(node[1], env);
    case "+": return evalExpr(node[1], env) + evalExpr(node[2], env);
    case "-": return evalExpr(node[1], env) - evalExpr(node[2], env);
    case "*": return evalExpr(node[1], env) * evalExpr(node[2], env);
    case "min": return Math.min(evalExpr(node[1], env), evalExpr(node[2], env));
    case "max": return Math.max(evalExpr(node[1], env), evalExpr(node[2], env));
    default: throw new Error(`nodo desconocido ${node[0]}`);
  }
}

export function show(node) {
  switch (node[0]) {
    case "var": return node[1];
    case "const": return String(node[1]);
    case "neg": return `−${show(node[1])}`;
    case "min": case "max": return `${node[0]}(${show(node[1])}, ${show(node[2])})`;
    default: return `(${show(node[1])} ${node[0] === "-" ? "−" : node[0] === "*" ? "·" : node[0]} ${show(node[2])})`;
  }
}
export const sizeOf = (node) => (node[0] === "var" || node[0] === "const" ? 1 : 1 + node.slice(1).reduce((t, child) => t + sizeOf(child), 0));
export const varsOf = (node, out = new Set()) => {
  if (node[0] === "var") out.add(node[1]);
  else if (node[0] !== "const") node.slice(1).forEach((child) => varsOf(child, out));
  return out;
};

export function makeSequence(seed, length = 100) {
  const rng = makeRng(seed * 7919 + 3);
  return Array.from({ length }, () => rng.int(20, 70));
}
export const TRAIN_SEQS = Array.from({ length: 16 }, (_, i) => makeSequence(500 + i));
export const HOLDOUT_SEQS = Array.from({ length: 24 }, (_, i) => makeSequence(900 + i));

export function pack(program, items) {
  const bins = [];
  for (const s of items) {
    let best = -1;
    let bestScore = -Infinity;
    bins.forEach((r, k) => {
      if (r < s) return;
      const score = evalExpr(program, { s, r, k });
      if (score > bestScore) {
        bestScore = score;
        best = k;
      }
    });
    if (best < 0) bins.push(CAPACITY - s);
    else bins[best] -= s;
  }
  const lower = Math.ceil(items.reduce((t, v) => t + v, 0) / CAPACITY);
  return { bins: bins.length, lower, excess: bins.length / lower - 1, fill: bins.map((r) => CAPACITY - r) };
}

export const scoreOn = (program, seqs) => seqs.reduce((t, seq) => t + pack(program, seq).excess, 0) / seqs.length;

function randomTree(rng, depth) {
  if (depth <= 0 || rng.next() < 0.35) return rng.next() < 0.7 ? ["var", rng.pick(VARS)] : ["const", rng.pick(CONSTS)];
  return [rng.pick(OPS), randomTree(rng, depth - 1), randomTree(rng, depth - 1)];
}
const paths = (node, at = []) => [at, ...(node[0] === "var" || node[0] === "const" ? [] : node.slice(1).flatMap((child, i) => paths(child, [...at, i + 1])))];
const getAt = (node, path) => path.reduce((n, i) => n[i], node);
function setAt(node, path, value) {
  if (!path.length) return value;
  const copy = [...node];
  copy[path[0]] = setAt(node[path[0]], path.slice(1), value);
  return copy;
}

export function mutate(program, rng) {
  const spots = paths(program);
  const spot = rng.pick(spots);
  const here = getAt(program, spot);
  const kind = rng.next();
  let replacement;
  let label;
  if (kind < 0.45) {
    replacement = randomTree(rng, 2);
    label = "reemplazar subárbol";
  } else if (kind < 0.75 && (here[0] === "var" || here[0] === "const")) {
    replacement = rng.next() < 0.6 ? ["var", rng.pick(VARS)] : ["const", rng.pick(CONSTS)];
    label = "cambiar hoja";
  } else if (OPS.includes(here[0])) {
    replacement = [rng.pick(OPS), here[1], here[2]];
    label = "cambiar operador";
  } else {
    replacement = [rng.pick(OPS), here, randomTree(rng, 1)];
    label = "envolver en operación";
  }
  const child = setAt(program, spot, replacement);
  return sizeOf(child) > 11 ? { program, label: "descartada (demasiado grande)", invalid: true } : { program: child, label };
}

export function cellOf(program) {
  const size = sizeOf(program);
  const sizeBin = size <= 2 ? 0 : size <= 4 ? 1 : size <= 7 ? 2 : 3;
  const used = [...varsOf(program)].sort().join("") || "∅";
  return `${sizeBin}|${used}`;
}

export function runEvolution({ budget = 192, perCandidate = 4, temperature = 0.03, seed = 3, start = SEEDS.peor } = {}) {
  const rng = makeRng(seed);
  const archive = new Map();
  let spent = 0;
  const events = [];
  const evaluateOn = (program) => {
    const seqs = Array.from({ length: perCandidate }, () => TRAIN_SEQS[Math.floor(rng.next() * TRAIN_SEQS.length)]);
    spent += perCandidate;
    return scoreOn(program, seqs);
  };
  const insert = (program, score, parentCell, mutation) => {
    const cell = cellOf(program);
    const incumbent = archive.get(cell);
    const accepted = !incumbent || score < incumbent.score;
    if (accepted) archive.set(cell, { program, score, cell, born: events.length });
    events.push({ program, text: show(program), score, cell, accepted, replaced: !!incumbent && accepted, parentCell, mutation, spent });
  };
  insert(start, evaluateOn(start), null, "semilla");
  while (spent + perCandidate <= budget) {
    const elites = [...archive.values()];
    const weights = elites.map((e) => Math.exp(-(e.score - Math.min(...elites.map((x) => x.score))) / Math.max(1e-4, temperature)));
    const total = weights.reduce((t, w) => t + w, 0);
    const parent = elites[rng.categorical(weights.map((w) => w / total))];
    const { program, label, invalid } = mutate(parent.program, rng);
    if (invalid) {
      events.push({ program, text: show(program), score: null, cell: null, accepted: false, parentCell: parent.cell, mutation: label, spent });
      continue;
    }
    insert(program, evaluateOn(program), parent.cell, label);
  }
  const elites = [...archive.values()].sort((a, b) => a.score - b.score);
  const best = elites[0];
  return { events, archive: elites, best, bestHoldout: scoreOn(best.program, HOLDOUT_SEQS), candidates: events.length, spent };
}
