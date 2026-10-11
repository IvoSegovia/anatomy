import { makeRng, fingerprint } from "./rng.mjs";
import { matmul, transpose, scale, softmax, layerNormRow, gelu, randomMatrix, randomVector, addRow, add, columns, hconcat, vecmat, dot, shapeOf } from "./linalg.mjs";
import { VOCAB } from "./tokenizer.mjs";

export const CONFIG = { vocab: 16, dModel: 8, heads: 2, dHead: 4, blocks: 2, dMlp: 32, maxLen: 10, eps: 1e-5, seed: 7 };

export function initParams(seed = CONFIG.seed) {
  const rng = makeRng(seed);
  const { vocab, dModel, heads, dHead, blocks, dMlp, maxLen } = CONFIG;
  const params = {
    E: randomMatrix(rng, vocab, dModel, 1),
    P: randomMatrix(rng, maxLen, dModel, 0.5),
    blocks: [],
    lnf: { g: new Array(dModel).fill(1), b: new Array(dModel).fill(0) },
    Wu: null,
    bu: new Array(vocab).fill(0),
  };
  for (let index = 0; index < blocks; index++) {
    params.blocks.push({
      ln1: { g: new Array(dModel).fill(1), b: new Array(dModel).fill(0) },
      Wq: Array.from({ length: heads }, () => randomMatrix(rng, dModel, dHead, 0.45)),
      Wk: Array.from({ length: heads }, () => randomMatrix(rng, dModel, dHead, 0.45)),
      Wv: Array.from({ length: heads }, () => randomMatrix(rng, dModel, dHead, 0.45)),
      Wo: randomMatrix(rng, heads * dHead, dModel, 0.35),
      ln2: { g: new Array(dModel).fill(1), b: new Array(dModel).fill(0) },
      W1: randomMatrix(rng, dModel, dMlp, 0.35),
      b1: randomVector(rng, dMlp, 0.1),
      W2: randomMatrix(rng, dMlp, dModel, 0.18),
      b2: randomVector(rng, dModel, 0.05),
    });
  }
  params.Wu = randomMatrix(rng, dModel, vocab, 0.6);
  return params;
}

export function flatParams(params) {
  const out = [...params.E.flat(), ...params.P.flat()];
  for (const block of params.blocks) {
    out.push(...block.ln1.g, ...block.ln1.b);
    for (const name of ["Wq", "Wk", "Wv"]) for (const head of block[name]) out.push(...head.flat());
    out.push(...block.Wo.flat(), ...block.ln2.g, ...block.ln2.b, ...block.W1.flat(), ...block.b1, ...block.W2.flat(), ...block.b2);
  }
  out.push(...params.lnf.g, ...params.lnf.b, ...params.Wu.flat(), ...params.bu);
  return out;
}

export const paramCount = (params) => flatParams(params).length;
export const paramPrint = (params) => fingerprint(flatParams(params));

export function causalMask(n) {
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (j <= i ? 0 : -Infinity)));
}

const layerNorm = (matrix, ln) => {
  const rows = matrix.map((row) => layerNormRow(row, ln.g, ln.b, CONFIG.eps));
  return { mean: rows.map((r) => r.mean), variance: rows.map((r) => r.variance), normed: rows.map((r) => r.normed), out: rows.map((r) => r.out) };
};

export function attentionHead(X, Wq, Wk, Wv) {
  const n = X.length;
  const Q = matmul(X, Wq);
  const K = matmul(X, Wk);
  const V = matmul(X, Wv);
  const S = matmul(Q, transpose(K));
  const dk = shapeOf(Wq)[1];
  const Sscaled = scale(S, 1 / Math.sqrt(dk));
  const M = causalMask(n);
  const Smasked = add(Sscaled, M);
  const A = Smasked.map(softmax);
  const Z = matmul(A, V);
  return { Q, K, V, S, Sscaled, M, Smasked, A, Z, dk };
}

export function forward(params, ids) {
  const n = ids.length;
  if (n < 1 || n > CONFIG.maxLen) throw new Error(`longitud ${n} fuera de 1..${CONFIG.maxLen}`);
  const tok = ids.map((id) => [...params.E[id]]);
  const pos = ids.map((_, index) => [...params.P[index]]);
  const X0 = add(tok, pos);
  const blocks = [];
  let X = X0;
  for (const block of params.blocks) {
    const ln1 = layerNorm(X, block.ln1);
    const heads = block.Wq.map((_, h) => attentionHead(ln1.out, block.Wq[h], block.Wk[h], block.Wv[h]));
    const concat = hconcat(heads.map((head) => head.Z));
    const attnOut = matmul(concat, block.Wo);
    const H = add(X, attnOut);
    const ln2 = layerNorm(H, block.ln2);
    const U = addRow(matmul(ln2.out, block.W1), block.b1);
    const G = U.map((row) => row.map(gelu));
    const mlpOut = addRow(matmul(G, block.W2), block.b2);
    const Y = add(H, mlpOut);
    blocks.push({ X, ln1, heads, concat, attnOut, H, ln2, U, G, mlpOut, Y });
    X = Y;
  }
  const hLast = X[n - 1];
  const head = headForward(params, hLast);
  return { ids, tokens: ids.map((id) => VOCAB[id]), tok, pos, X0, blocks, hidden: X, hLast, ...head };
}

export function headForward(params, h) {
  const lnf = layerNormRow(h, params.lnf.g, params.lnf.b, CONFIG.eps);
  const logits = vecmat(lnf.out, params.Wu).map((value, j) => value + params.bu[j]);
  const probs = softmax(logits);
  return { lnf, logits, probs };
}

export const argmax = (list) => list.reduce((best, value, index) => (value > list[best] ? index : best), 0);

export function temperatureProbs(logits, temperature) {
  if (!(temperature > 0)) throw new Error("la temperatura debe ser positiva");
  return softmax(logits.map((value) => value / temperature));
}

export function sampleToken(logits, temperature, rng) {
  const probs = temperatureProbs(logits, temperature);
  return { id: rng.categorical(probs), probs };
}

export function emptyCache() {
  return { ids: [], blocks: Array.from({ length: CONFIG.blocks }, () => ({ K: [[], []], V: [[], []] })), rowsComputed: 0 };
}

export function invalidateFrom(cache, position) {
  const out = { ids: cache.ids.slice(0, position), blocks: cache.blocks.map((block) => ({ K: block.K.map((rows) => rows.slice(0, position)), V: block.V.map((rows) => rows.slice(0, position)) })), rowsComputed: cache.rowsComputed };
  return out;
}

export function stepWithCache(params, cache, id) {
  const position = cache.ids.length;
  let x = params.E[id].map((value, j) => value + params.P[position][j]);
  const next = { ids: [...cache.ids, id], blocks: [], rowsComputed: cache.rowsComputed + 1 };
  params.blocks.forEach((block, b) => {
    const ln1 = layerNormRow(x, block.ln1.g, block.ln1.b, CONFIG.eps).out;
    const K = [];
    const V = [];
    const zs = block.Wq.map((_, h) => {
      const q = vecmat(ln1, block.Wq[h]);
      const k = vecmat(ln1, block.Wk[h]);
      const v = vecmat(ln1, block.Wv[h]);
      const keys = [...cache.blocks[b].K[h], k];
      const values = [...cache.blocks[b].V[h], v];
      K.push(keys);
      V.push(values);
      const weights = softmax(keys.map((key) => dot(q, key) / Math.sqrt(CONFIG.dHead)));
      return values[0].map((_, j) => weights.reduce((total, w, t) => total + w * values[t][j], 0));
    });
    const attn = vecmat(zs.flat(), block.Wo);
    const hrow = x.map((value, j) => value + attn[j]);
    const ln2 = layerNormRow(hrow, block.ln2.g, block.ln2.b, CONFIG.eps).out;
    const g = vecmat(ln2, block.W1).map((value, j) => gelu(value + block.b1[j]));
    const mlp = vecmat(g, block.W2).map((value, j) => value + block.b2[j]);
    x = hrow.map((value, j) => value + mlp[j]);
    next.blocks.push({ K, V });
  });
  return { cache: next, hidden: x, ...headForward(params, x) };
}

export function prefillCache(params, ids) {
  let cache = emptyCache();
  let last = null;
  for (const id of ids) {
    last = stepWithCache(params, cache, id);
    cache = last.cache;
  }
  return { cache, last };
}

export function generate(params, ids, steps, { temperature = 0, seed = 11 } = {}) {
  const rng = makeRng(seed);
  let { cache, last } = prefillCache(params, ids);
  const out = [];
  for (let step = 0; step < steps && cache.ids.length < CONFIG.maxLen; step++) {
    const choice = temperature > 0 ? sampleToken(last.logits, temperature, rng).id : argmax(last.logits);
    out.push({ id: choice, probs: temperature > 0 ? temperatureProbs(last.logits, temperature) : last.probs });
    last = stepWithCache(params, cache, choice);
    cache = last.cache;
  }
  return { generated: out, cache };
}

export { columns };
