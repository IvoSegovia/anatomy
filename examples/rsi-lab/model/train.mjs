// Entrenamiento REAL de una parte del Transformer: la cabeza de salida.
// Cambio de escala declarado: el cuerpo (embeddings y 2 bloques) queda CONGELADO; sólo se
// entrenan θ = {γ_f (8), β_f (8), W_U (8×16), b_U (16)} = 160 parámetros.
//   n = (h − μ)/σ      u = γ ⊙ n + β      z = u·W_U + b_U      p = softmax(z)      L = −log p_y
// Gradientes por retropropagación (regla de la cadena), comprobables por diferencias finitas.
import { fingerprint } from "./rng.mjs";
import { forward, CONFIG } from "./transformer.mjs";
import { softmax, layerNormRow } from "./linalg.mjs";
import { tokenize, VOCAB } from "./tokenizer.mjs";

const D = CONFIG.dModel;
const VSZ = CONFIG.vocab;

export const headOf = (params) => ({ g: [...params.lnf.g], b: [...params.lnf.b], Wu: params.Wu.map((row) => [...row]), bu: [...params.bu] });
export const withHead = (params, head) => ({ ...params, lnf: { g: [...head.g], b: [...head.b] }, Wu: head.Wu.map((row) => [...row]), bu: [...head.bu] });

export const flatHead = (head) => [...head.g, ...head.b, ...head.Wu.flat(), ...head.bu];
export function unflatHead(values) {
  const g = values.slice(0, D);
  const b = values.slice(D, 2 * D);
  const Wu = Array.from({ length: D }, (_, i) => values.slice(2 * D + i * VSZ, 2 * D + (i + 1) * VSZ));
  const bu = values.slice(2 * D + D * VSZ);
  return { g, b, Wu, bu };
}
export const headSize = () => 2 * D + D * VSZ + VSZ;
export const headPrint = (head) => fingerprint(flatHead(head));

// Ejemplos: prefijo de 6 tokens → token objetivo. Conjuntos SEPARADOS: los de validación
// nunca intervienen en un gradiente.
export const TRAIN_TEXT = [
  ["def f(x):", "return"],
  ["if x<0:return", "0"],
  ["return x*2+f", "("],
  ["return f(x)+", "1"],
  ["if y<2:return", "y"],
  ["def f(y):", "return"],
];
export const VALID_TEXT = [
  ["def f(2):", "return"],
  ["if y<0:return", "0"],
  ["return f(y)+", "1"],
  ["if x<1:return", "x"],
];

export function examplesOf(params, pairs) {
  return pairs.map(([text, target]) => {
    const ids = tokenize(text).map((piece) => piece.id);
    if (ids.length !== 6 || ids.includes(-1)) throw new Error(`ejemplo inválido: ${text}`);
    const h = forward(params, ids).hLast; // característica congelada del cuerpo
    return { text, ids, target: VOCAB.indexOf(target), h };
  });
}

// Pérdida media y gradiente analítico sobre un lote.
export function lossAndGrad(head, examples) {
  const grad = { g: new Array(D).fill(0), b: new Array(D).fill(0), Wu: Array.from({ length: D }, () => new Array(VSZ).fill(0)), bu: new Array(VSZ).fill(0) };
  let loss = 0;
  const each = [];
  for (const example of examples) {
    const { normed } = layerNormRow(example.h, new Array(D).fill(1), new Array(D).fill(0), CONFIG.eps);
    const u = normed.map((value, j) => head.g[j] * value + head.b[j]);
    const z = head.bu.map((bias, k) => bias + u.reduce((total, value, j) => total + value * head.Wu[j][k], 0));
    const p = softmax(z);
    const top = Math.max(...z);
    const l = top + Math.log(z.reduce((total, value) => total + Math.exp(value - top), 0)) - z[example.target]; // −log p_y estable (log-sum-exp)
    loss += l;
    each.push({ p, loss: l, z, u, n: normed, target: example.target });
    const dz = p.map((value, k) => (value - (k === example.target ? 1 : 0)) / examples.length); // ∂L/∂z = p − e_y
    for (let k = 0; k < VSZ; k++) grad.bu[k] += dz[k];
    const du = new Array(D).fill(0);
    for (let j = 0; j < D; j++) {
      for (let k = 0; k < VSZ; k++) {
        grad.Wu[j][k] += u[j] * dz[k]; // ∂L/∂W_U = uᵀ (p − e_y)
        du[j] += head.Wu[j][k] * dz[k]; // ∂L/∂u = W_U (p − e_y)
      }
      grad.g[j] += du[j] * normed[j]; // ∂L/∂γ = ∂L/∂u ⊙ n
      grad.b[j] += du[j]; // ∂L/∂β = ∂L/∂u
    }
  }
  return { loss: loss / examples.length, grad, each };
}

export const lossOf = (head, examples) => lossAndGrad(head, examples).loss;
export const accuracyOf = (head, examples) => lossAndGrad(head, examples).each.filter((e) => e.p.indexOf(Math.max(...e.p)) === e.target).length / examples.length;

// Diferencias finitas centrales sobre TODOS los parámetros de la cabeza.
export function finiteDifferenceCheck(head, examples, step = 1e-5) {
  const analytic = flatHead(lossAndGrad(head, examples).grad);
  const base = flatHead(head);
  let worst = 0;
  let worstIndex = 0;
  const numeric = base.map((_, index) => {
    const plus = [...base];
    const minus = [...base];
    plus[index] += step;
    minus[index] -= step;
    const value = (lossOf(unflatHead(plus), examples) - lossOf(unflatHead(minus), examples)) / (2 * step);
    const error = Math.abs(value - analytic[index]) / Math.max(1e-8, Math.abs(value) + Math.abs(analytic[index]));
    if (error > worst) {
      worst = error;
      worstIndex = index;
    }
    return value;
  });
  return { worst, worstIndex, analytic, numeric, count: base.length };
}

// SGD: θ ← θ − η·g
export function sgdStep(head, grad, eta) {
  const theta = flatHead(head);
  const g = flatHead(grad);
  return { head: unflatHead(theta.map((value, index) => value - eta * g[index])), delta: g.map((value) => -eta * value) };
}

// Adam (Kingma y Ba, 2014). Estado {m, v, t}.
//   m ← β1 m + (1−β1) g      v ← β2 v + (1−β2) g²      m̂ = m/(1−β1^t)      v̂ = v/(1−β2^t)
//   θ ← θ − η m̂ / (√v̂ + ε)
export const ADAM = { beta1: 0.9, beta2: 0.999, eps: 1e-8 };
export const adamInit = () => ({ m: new Array(headSize()).fill(0), v: new Array(headSize()).fill(0), t: 0 });

export function adamStep(head, grad, state, eta, { beta1, beta2, eps } = ADAM) {
  const theta = flatHead(head);
  const g = flatHead(grad);
  const t = state.t + 1;
  const m = state.m.map((value, index) => beta1 * value + (1 - beta1) * g[index]);
  const v = state.v.map((value, index) => beta2 * value + (1 - beta2) * g[index] * g[index]);
  const c1 = 1 - beta1 ** t;
  const c2 = 1 - beta2 ** t;
  const mhat = m.map((value) => value / c1);
  const vhat = v.map((value) => value / c2);
  const delta = mhat.map((value, index) => (-eta * value) / (Math.sqrt(vhat[index]) + eps));
  return { head: unflatHead(theta.map((value, index) => value + delta[index])), state: { m, v, t }, delta, mhat, vhat, c1, c2 };
}

// Ejecuta k pasos y devuelve la historia completa (para la línea de tiempo y la verificación).
export function runTraining(params, { optimizer = "sgd", eta = 0.5, steps = 40 } = {}) {
  const train = examplesOf(params, TRAIN_TEXT);
  const valid = examplesOf(params, VALID_TEXT);
  let head = headOf(params);
  let state = adamInit();
  const history = [{ step: 0, head, train: lossOf(head, train), valid: lossOf(head, valid), print: headPrint(head) }];
  for (let step = 1; step <= steps; step++) {
    const { grad, loss } = lossAndGrad(head, train);
    let result;
    if (optimizer === "adam") {
      result = adamStep(head, grad, state, eta);
      state = result.state;
    } else result = sgdStep(head, grad, eta);
    head = result.head;
    history.push({ step, head, grad, lossBefore: loss, train: lossOf(head, train), valid: lossOf(head, valid), print: headPrint(head), delta: result.delta, mhat: result.mhat, vhat: result.vhat, c1: result.c1, c2: result.c2, adam: optimizer === "adam" ? state : null });
  }
  return { train, valid, history };
}
