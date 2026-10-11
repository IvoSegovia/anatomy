export const TASK = {
  enunciado: "Escribe promedio(xs): la media aritmética de una lista de números; para la lista vacía, devolver 0.",
  pruebas: [
    { entrada: [1, 2, 3], esperado: 2 },
    { entrada: [5], esperado: 5 },
    { entrada: [], esperado: 0 },
    { entrada: [1, 2], esperado: 1.5 },
  ],
};

function promedio_intento1(xs) {
  let suma = 0;
  for (const x of xs) suma += x;
  return suma / xs.length;
}
function promedio_intento2(xs) {
  if (xs.length === 0) return 0;
  let suma = 0;
  for (const x of xs) suma += x;
  return Math.round(suma / xs.length);
}
function promedio_intento3(xs) {
  if (xs.length === 0) return 0;
  let suma = 0;
  for (const x of xs) suma += x;
  return suma / xs.length;
}

export const ATTEMPTS = [
  { id: 1, fn: promedio_intento1 },
  { id: 2, fn: promedio_intento2 },
  { id: 3, fn: promedio_intento3 },
];
export const sourceOf = (attempt) => attempt.fn.toString();

export function runTests(fn) {
  return TASK.pruebas.map((prueba) => {
    let obtenido;
    let error = null;
    try {
      obtenido = fn([...prueba.entrada]);
    } catch (problem) {
      error = String(problem);
    }
    const ok = !error && Object.is(obtenido, prueba.esperado) || (!error && obtenido === prueba.esperado);
    return { ...prueba, obtenido, ok, error };
  });
}

const show = (value) => (Number.isNaN(value) ? "NaN" : JSON.stringify(value));

export function reflectionNote(results) {
  const failed = results.filter((r) => !r.ok);
  if (!failed.length) return null;
  const first = failed[0];
  return `Falla promedio(${show(first.entrada)}): se obtuvo ${show(first.obtenido)} y se esperaba ${show(first.esperado)}. Revisar ese caso antes de reintentar.`;
}

export function runReflection() {
  const memory = [];
  const log = [];
  for (const attempt of ATTEMPTS) {
    const results = runTests(attempt.fn);
    const passed = results.filter((r) => r.ok).length;
    const note = reflectionNote(results);
    log.push({ attempt: attempt.id, source: sourceOf(attempt), results, passed, memoryBefore: [...memory], note });
    if (!note) break;
    memory.push(note);
  }
  return { log, memory };
}
