// Estación B: aprendizaje por refuerzo con una POLÍTICA PEQUEÑA (4 parámetros), no con el Transformer.
// Acción = estrategia de lectura del registro; recompensa = 1 si el solucionador simbólico
// acierta en una tarea de desarrollo muestreada, 0 si no (se ejecuta de verdad).
//   π_θ(a) = softmax(θ)_a        ∇_θ log π_θ(a) = e_a − π_θ
//   REINFORCE con baseline b:    ĝ = (1/N) Σ_i (R_i − b) ∇_θ log π_θ(a_i);   θ ← θ + α ĝ
// b es una media móvil de recompensas de lotes ANTERIORES: no depende de las acciones del lote actual.
import { makeRng } from "./rng.mjs";
import { softmax } from "./linalg.mjs";
import { VERSIONS, runTask, makeSplit, SPLITS } from "./agent.mjs";

export const ACTIONS = [
  { id: "inicio", label: "leer desde el inicio", genome: VERSIONS.v0 },
  { id: "errores", label: "sólo ERROR y TRACE", genome: VERSIONS.v2 },
  { id: "relevancia", label: "relevancia sin duplicados", genome: VERSIONS.v1 },
  { id: "final", label: "leer las últimas líneas", genome: { id: "fin", name: "últimas líneas", dedupe: false, weights: { ERROR: 0, TRACE: 0, DEBUG: 0, WARN: 0, INFO: 0 }, link: 0, select: "puntuación", tie: "recientes", keepLast: 0 } },
];

export function rewardTable(tasks = makeSplit(SPLITS.dev.base, SPLITS.dev.count)) {
  return ACTIONS.map((action) => tasks.map((task) => (runTask(task, action.genome).success ? 1 : 0)));
}

export const gradLogPi = (theta, action) => {
  const pi = softmax(theta);
  return pi.map((p, k) => (k === action ? 1 : 0) - p);
};

// Un lote de N episodios con la política actual. Semilla por lote: reproducible.
export function sampleBatch(theta, table, { n = 8, seed = 1 } = {}) {
  const rng = makeRng(seed);
  const pi = softmax(theta);
  return Array.from({ length: n }, () => {
    const action = rng.categorical(pi);
    const task = Math.floor(rng.next() * table[0].length);
    return { action, task, reward: table[action][task], piAtSample: pi[action] };
  });
}

export function reinforceUpdate(theta, batch, baseline, alpha) {
  const grad = new Array(theta.length).fill(0);
  const per = batch.map((episode) => {
    const advantage = episode.reward - baseline;
    const g = gradLogPi(theta, episode.action);
    g.forEach((value, k) => (grad[k] += (advantage * value) / batch.length));
    return { ...episode, advantage, gradLog: g };
  });
  return { theta: theta.map((value, k) => value + alpha * grad[k]), grad, per };
}

export const BASELINE_DECAY = 0.8;
export const nextBaseline = (baseline, batch) => BASELINE_DECAY * baseline + (1 - BASELINE_DECAY) * (batch.reduce((t, e) => t + e.reward, 0) / batch.length);

export function runReinforce({ updates = 30, n = 8, alpha = 1.0, seed = 5, baseline0 = 0.5, table = rewardTable() } = {}) {
  let theta = [0, 0, 0, 0];
  let baseline = baseline0;
  const history = [{ update: 0, theta, pi: softmax(theta), baseline }];
  for (let u = 1; u <= updates; u++) {
    const batch = sampleBatch(theta, table, { n, seed: seed * 1000 + u });
    const step = reinforceUpdate(theta, batch, baseline, alpha); // baseline calculado ANTES de este lote
    theta = step.theta;
    const used = baseline;
    baseline = nextBaseline(baseline, batch);
    history.push({ update: u, theta, pi: softmax(theta), baseline, baselineUsed: used, batch: step.per, grad: step.grad, meanReward: batch.reduce((t, e) => t + e.reward, 0) / n });
  }
  return { table, history, expected: table.map((row) => row.reduce((t, v) => t + v, 0) / row.length) };
}

// ---------- PPO (ampliación opcional) ----------
// r_i(θ) = π_θ(a_i) / π_old(a_i);  L(θ) = (1/N) Σ min(r_i A_i, clip(r_i, 1−ε, 1+ε) A_i)
// ∇L: cada término aporta A_i r_i ∇log π_θ(a_i) salvo cuando el recorte está activo (gradiente 0).
export function ppoObjective(theta, oldPi, batch, eps) {
  const pi = softmax(theta);
  return batch.reduce((total, e) => {
    const r = pi[e.action] / oldPi[e.action];
    const clipped = Math.min(Math.max(r, 1 - eps), 1 + eps);
    return total + Math.min(r * e.advantage, clipped * e.advantage);
  }, 0) / batch.length;
}

export function ppoGrad(theta, oldPi, batch, eps) {
  const pi = softmax(theta);
  const grad = new Array(theta.length).fill(0);
  const per = batch.map((e) => {
    const r = pi[e.action] / oldPi[e.action];
    const active = (e.advantage > 0 && r > 1 + eps) || (e.advantage < 0 && r < 1 - eps);
    if (!active) gradLogPi(theta, e.action).forEach((value, k) => (grad[k] += (e.advantage * r * value) / batch.length));
    return { ...e, ratio: r, clipped: active };
  });
  return { grad, per };
}

export function ppoUpdate(theta, batch, baseline, { alpha = 1.0, eps = 0.2, epochs = 4 } = {}) {
  const oldPi = softmax(theta);
  const withAdv = batch.map((e) => ({ ...e, advantage: e.reward - baseline }));
  let current = [...theta];
  const epochsLog = [];
  for (let k = 0; k < epochs; k++) {
    const { grad, per } = ppoGrad(current, oldPi, withAdv, eps);
    current = current.map((value, j) => value + alpha * grad[j]);
    epochsLog.push({ theta: current, per, objective: ppoObjective(current, oldPi, withAdv, eps) });
  }
  return { theta: current, epochs: epochsLog, oldPi };
}
