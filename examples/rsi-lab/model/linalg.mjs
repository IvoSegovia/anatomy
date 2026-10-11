// Álgebra lineal mínima con matrices como listas de filas (arrays de números).
// Cada función comprueba dimensiones: un error de forma lanza una excepción.

export const shapeOf = (matrix) => [matrix.length, matrix.length ? matrix[0].length : 0];
export const zeros = (rows, cols) => Array.from({ length: rows }, () => new Array(cols).fill(0));
export const copy = (matrix) => matrix.map((row) => [...row]);

export function matmul(a, b) {
  const [n, k] = shapeOf(a);
  const [k2, m] = shapeOf(b);
  if (k !== k2) throw new Error(`matmul: dimensiones incompatibles ${n}×${k} · ${k2}×${m}`);
  const out = zeros(n, m);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      let total = 0;
      for (let t = 0; t < k; t++) total += a[i][t] * b[t][j];
      out[i][j] = total;
    }
  }
  return out;
}

export function vecmat(vector, matrix) {
  const [k, m] = shapeOf(matrix);
  if (vector.length !== k) throw new Error(`vecmat: ${vector.length} · ${k}×${m}`);
  const out = new Array(m).fill(0);
  for (let j = 0; j < m; j++) for (let t = 0; t < k; t++) out[j] += vector[t] * matrix[t][j];
  return out;
}

export const transpose = (matrix) => {
  const [n, m] = shapeOf(matrix);
  return Array.from({ length: m }, (_, j) => Array.from({ length: n }, (_, i) => matrix[i][j]));
};

export function add(a, b) {
  const [n, m] = shapeOf(a);
  const [n2, m2] = shapeOf(b);
  if (n !== n2 || m !== m2) throw new Error(`add: ${n}×${m} + ${n2}×${m2}`);
  return a.map((row, i) => row.map((value, j) => value + b[i][j]));
}

export const addRow = (matrix, vector) => matrix.map((row) => row.map((value, j) => value + vector[j]));
export const scale = (matrix, factor) => matrix.map((row) => row.map((value) => value * factor));
export const dot = (a, b) => a.reduce((total, value, index) => total + value * b[index], 0);
export const sum = (list) => list.reduce((total, value) => total + value, 0);
export const columns = (matrix, from, to) => matrix.map((row) => row.slice(from, to));
export const hconcat = (blocks) => blocks[0].map((_, i) => blocks.flatMap((block) => block[i]));

// softmax estable: resta el máximo finito; exp(-Infinity) = 0 exactamente.
export function softmax(vector) {
  const finite = vector.filter(Number.isFinite);
  const top = finite.length ? Math.max(...finite) : 0;
  const exps = vector.map((value) => (value === -Infinity ? 0 : Math.exp(value - top)));
  const total = sum(exps);
  return exps.map((value) => value / total);
}

export function layerNormRow(row, gain, bias, eps) {
  const n = row.length;
  const mean = sum(row) / n;
  const variance = sum(row.map((value) => (value - mean) ** 2)) / n;
  const inv = 1 / Math.sqrt(variance + eps);
  const normed = row.map((value) => (value - mean) * inv);
  return { mean, variance, normed, out: normed.map((value, j) => value * gain[j] + bias[j]) };
}

// GELU, aproximación tanh (la que usa GPT-2): 0.5·x·(1 + tanh(√(2/π)·(x + 0.044715·x³))).
export const gelu = (x) => 0.5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x * x * x)));

export const randomMatrix = (rng, rows, cols, std) => Array.from({ length: rows }, () => Array.from({ length: cols }, () => rng.normal() * std));
export const randomVector = (rng, length, std) => Array.from({ length }, () => rng.normal() * std);
export const flatten = (matrix) => matrix.flat();
