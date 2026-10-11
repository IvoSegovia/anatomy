import { makeRng } from "./rng.mjs";

export const BUDGET = 64;
export const TYPES = ["ERROR", "TRACE", "DEBUG", "WARN", "INFO"];

const MODULES = {
  parse: ["parse_line", "parse_num", "split_cols"],
  fmt: ["fmt_fecha", "fmt_moneda", "fmt_tabla"],
  calc: ["promedio", "tasa", "redondear"],
  cache: ["cache_get", "cache_put", "expirar"],
  geo: ["distancia", "proyectar", "rumbo"],
  pay: ["cobrar", "reembolso", "total_iva"],
};
export const CAUSES = {
  espacios: { debug: "la entrada ' 3' llega sin recortar espacios", key: "recortar", error: "ValueError con entrada ' 3'", errorKey: "ValueError" },
  cero: { debug: "divisor igual a 0 cuando la lista está vacía", key: "divisor", error: "ZeroDivisionError al dividir", errorKey: "ZeroDivisionError" },
  indice: { debug: "índice 5 fuera de rango con longitud 5", key: "índice", error: "IndexError índice 5", errorKey: "IndexError" },
  zona: { debug: "fecha sin zona horaria se interpreta como UTC", key: "zona", error: "desfase de 3 horas", errorKey: "desfase" },
  obsoleto: { debug: "clave obsoleta tras actualizar el valor", key: "obsoleta", error: "devuelve valor viejo", errorKey: "viejo" },
  redondeo: { debug: "convierte 2.5 en 2 por redondeo bancario", key: "bancario", error: "esperado 3 obtenido 2", errorKey: "obtenido" },
};
export const FAMILIES = {
  F1: "causa sólo en una línea DEBUG",
  F2: "causa en el propio mensaje de ERROR",
  F3: "cadena de dos saltos (dos TRACE necesarias)",
  F4: "registro con muchos reintentos duplicados",
};

const INFO_TEXT = [
  "INFO arranque cargando configuración de entorno desde env/prod.yaml con 34 claves",
  "INFO conectando con la base de datos de pruebas en el puerto 5432 sin TLS",
  "INFO compilando 128 módulos del proyecto con caché incremental activada",
  "INFO semilla de pruebas fijada para reproducibilidad del banco local",
  "INFO descubiertas 41 pruebas en 9 archivos del directorio tests",
  "INFO limpiando directorio temporal y artefactos de la ejecución anterior",
  "INFO montando sistema de archivos simulado con 3 volúmenes de solo lectura",
  "INFO versión del intérprete 3.11 con optimizaciones de depuración activas",
  "INFO preparando datos de ejemplo de 2400 filas para las pruebas de integración",
  "INFO registrando 12 complementos de pruebas y 4 accesorios compartidos",
  "INFO red simulada con latencia variable entre 10 y 900 milisegundos",
  "INFO trabajadores paralelos 4 asignados con memoria máxima de 512 MB",
];
const WARN_TEXT = [
  "WARN io.leer_cfg API obsoleta usar leer_config",
  "WARN fmt.fmt_tabla ancho de columna excede 120",
  "WARN auth.token expira en menos de 5 minutos",
  "WARN db.pool conexiones al 80 por ciento",
];

const words = (text) => text.trim().split(/\s+/).length;
const line = (type, text, tags = {}) => ({ type, text, tokens: words(text), tags });

export function makeTask(seed, family = null) {
  const rng = makeRng(seed * 9973 + 17);
  const fam = family ?? ["F1", "F2", "F3", "F4"][rng.int(0, 3)];
  const modNames = Object.keys(MODULES);
  const mod = rng.pick(modNames);
  const [fnA, fnB] = rng.shuffle(MODULES[mod]);
  const cause = rng.pick(Object.keys(CAUSES));
  const testName = `test_${fnA}_${rng.int(1, 9)}`;
  const decoyMod = rng.pick(modNames.filter((name) => name !== mod));
  const decoyFn = rng.pick(MODULES[decoyMod]);
  const decoyTest = `test_${decoyFn}_red`;
  const culprit = fam === "F3" ? `${mod}.${fnB}` : `${mod}.${fnA}`;

  const startup = rng.shuffle(INFO_TEXT).slice(0, rng.int(0, 8)).map((text) => line("INFO", text));
  const warns = rng.shuffle(WARN_TEXT).slice(0, rng.int(0, 2)).map((text) => line("WARN", text));
  const decoyCount = fam === "F4" ? 2 : rng.int(1, 2);
  const decoyBlocks = [];
  const retryLines = [];
  const used = new Set([mod]);
  for (let d = 0; d < decoyCount; d++) {
    const decoyMod = rng.pick(modNames.filter((name) => !used.has(name)));
    used.add(decoyMod);
    const decoyFn = rng.pick(MODULES[decoyMod]);
    const decoyTest = `test_${decoyFn}_red`;
    const retries = fam === "F4" ? rng.int(2, 3) : 1;
    const block = [];
    for (let attempt = 0; attempt < retries; attempt++) {
      block.push(line("ERROR", `ERROR ${decoyTest} tiempo de espera agotado tras 2.0 s`, { decoy: true, dup: attempt > 0 }));
      block.push(line("TRACE", `TRACE ${decoyTest} -> ${decoyMod}.${decoyFn} (${decoyMod}.py:88)`, { decoy: true, dup: attempt > 0 }));
      block.push(line("DEBUG", `DEBUG ${decoyMod}.${decoyFn} ${CAUSES[rng.pick(Object.keys(CAUSES))].debug}`, { decoy: true, dup: attempt > 0 }));
    }
    decoyBlocks.push(block);
    retryLines.push(line("INFO", `INFO ${decoyTest} reintento superado sin errores`, { retryOk: true }));
  }
  const progress = Array.from({ length: rng.int(0, 3) }, () => line("INFO", `INFO prueba test_${rng.pick(MODULES[rng.pick(modNames)])}_${rng.int(1, 9)} correcta en ${rng.int(3, 90)} ms`));

  const evidence = [];
  if (fam === "F3") {
    evidence.push(line("TRACE", `TRACE ${testName} -> ${mod}.${fnA} (${mod}.py:${rng.int(10, 99)})`, { evidence: "E2" }));
    evidence.push(line("TRACE", `TRACE ${mod}.${fnA} -> ${mod}.${fnB} (${mod}.py:${rng.int(100, 199)})`, { evidence: "E2b" }));
  } else {
    evidence.push(line("TRACE", `TRACE ${testName} -> ${culprit} (${mod}.py:${rng.int(10, 99)})`, { evidence: "E2" }));
  }
  if (fam === "F4") evidence.push(line("TRACE", evidence[0].text, { evidence: "E2", dup: true }));
  if (fam !== "F2") evidence.push(line("DEBUG", `DEBUG ${culprit} ${CAUSES[cause].debug}`, { evidence: "E3" }));
  else evidence.push(line("DEBUG", `DEBUG ${culprit} entrada recibida con 3 campos`, {}));
  const errorText = fam === "F2" ? `ERROR ${testName} ${CAUSES[cause].error}` : `ERROR ${testName} resultado distinto del esperado`;
  const chain = [...evidence, line("ERROR", errorText, { evidence: "E1" })];
  const summary = line("INFO", `INFO resumen 41 pruebas 1 fallo ${decoyCount} inestables`);

  const early = rng.next() < 0.3;
  const blocks = early ? [chain, ...decoyBlocks] : [...decoyBlocks, chain];
  const lateRetry = rng.next() < 0.35;
  const lines = [...startup, ...warns.slice(0, 1), ...blocks[0], ...progress.slice(0, 1), ...blocks.slice(1).flat(), ...warns.slice(1), ...progress.slice(1)];
  if (!lateRetry) lines.push(...retryLines);
  lines.push(summary);
  if (lateRetry) lines.push(...retryLines);
  lines.forEach((entry, index) => (entry.index = index));
  const required = lines.filter((entry) => entry.tags.evidence && !entry.tags.dup).map((entry) => entry.index);
  return { seed, family: fam, testName, culprit, cause, early, lines, required, totalTokens: lines.reduce((t, l) => t + l.tokens, 0) };
}

export const makeSplit = (base, count, families = null) => Array.from({ length: count }, (_, index) => makeTask(base + index, families ? families[index % families.length] : null));
export const SPLITS = {
  dev: { base: 100, count: 16, label: "desarrollo" },
  valid: { base: 200, count: 40, label: "validación" },
  test: { base: 300, count: 60, label: "prueba reservada" },
  audit: { base: 400, count: 40, label: "auditoría" },
};

export const VERSIONS = {
  v0: { id: "v0", name: "registros completos", dedupe: false, weights: { ERROR: 0, TRACE: 0, DEBUG: 0, WARN: 0, INFO: 0 }, link: 0, select: "orden", tie: "antiguas", keepLast: 0 },
  v1: { id: "v1", name: "evidencia relevante + sin duplicados", dedupe: true, weights: { ERROR: 3, TRACE: 2, DEBUG: 1, WARN: 0, INFO: 0 }, link: 2, select: "puntuación", tie: "recientes", keepLast: 0 },
  v2: { id: "v2", name: "poda agresiva (sólo ERROR y TRACE)", dedupe: true, weights: { ERROR: 3, TRACE: 2, DEBUG: -1, WARN: -1, INFO: -1 }, link: 2, select: "puntuación", tie: "recientes", keepLast: 0 },
  v3: { id: "v3", name: "v1 + recortar cada línea a 6 palabras", dedupe: true, weights: { ERROR: 3, TRACE: 2, DEBUG: 1, WARN: 0, INFO: 0 }, link: 2, select: "puntuación", tie: "recientes", keepLast: 0, clip: 6 },
};

const testOf = (text) => (text.match(/\b(test_[a-z_]+_(?:\d|red))\b/) || [])[1] || null;
const traceOf = (text) => {
  const match = text.match(/^TRACE (\S+) -> (\S+) /);
  return match ? { from: match[1], to: match[2] } : null;
};

export function manageContext(log, genome, budget = BUDGET) {
  const trace = [];
  let pool = log.map((entry) => ({ ...entry, full: entry.text }));
  const status = new Map(log.map((entry) => [entry.index, "presupuesto"]));
  if (genome.dedupe) {
    const seen = new Set();
    const before = pool.length;
    pool = pool.filter((entry) => {
      if (seen.has(entry.text)) {
        status.set(entry.index, "duplicada");
        return false;
      }
      seen.add(entry.text);
      return true;
    });
    trace.push(`deduplicar: ${before} → ${pool.length} líneas`);
  }
  if (genome.clip) {
    let saved = 0;
    pool = pool.map((entry) => {
      if (entry.tokens <= genome.clip) return entry;
      saved += entry.tokens - genome.clip;
      return { ...entry, text: entry.text.split(/\s+/).slice(0, genome.clip).join(" "), tokens: genome.clip, clipped: true };
    });
    trace.push(`recortar a ${genome.clip} palabras: ${saved} tokens ahorrados`);
  }
  const failing = new Set(pool.filter((entry) => entry.type === "ERROR").map((entry) => testOf(entry.text)).filter(Boolean));
  const linked = new Set(failing);
  for (const entry of pool) {
    const t = traceOf(entry.text);
    if (t && linked.has(t.from)) linked.add(t.to);
  }
  for (const entry of pool) {
    const t = traceOf(entry.text);
    if (t && linked.has(t.from)) linked.add(t.to);
  }
  const mentions = (text) => [...linked].some((name) => text.includes(name));
  pool.forEach((entry) => {
    const w = genome.weights[entry.type];
    entry.drop = w < 0;
    entry.score = w < 0 ? -Infinity : w + (genome.link && mentions(entry.text) ? genome.link : 0);
  });
  pool.filter((entry) => entry.drop).forEach((entry) => status.set(entry.index, "tipo"));
  const dropped = pool.filter((entry) => entry.drop).length;
  if (dropped) trace.push(`descartar por tipo: ${dropped} líneas`);
  const candidates = pool.filter((entry) => !entry.drop);
  const chosen = new Set();
  let used = 0;
  const take = (entry) => {
    if (chosen.has(entry.index) || used + entry.tokens > budget) return false;
    chosen.add(entry.index);
    used += entry.tokens;
    return true;
  };
  if (genome.keepLast) candidates.slice(-genome.keepLast).forEach(take);
  if (genome.select === "orden") {
    for (const entry of candidates) if (!take(entry)) break;
  } else {
    const ranked = [...candidates].sort((a, b) => b.score - a.score || (genome.tie === "recientes" ? b.index - a.index : a.index - b.index));
    ranked.forEach(take);
  }
  const context = pool.filter((entry) => chosen.has(entry.index)).sort((a, b) => a.index - b.index);
  context.forEach((entry) => status.set(entry.index, entry.clipped ? "recortada" : "incluida"));
  trace.push(`seleccionar (${genome.select}): ${context.length} líneas, ${used}/${budget} tokens`);
  return { context, used, trace, status };
}

const causeFromText = (text, type) => Object.keys(CAUSES).find((key) => text.split(/\s+/).includes(type === "ERROR" ? CAUSES[key].errorKey : CAUSES[key].key)) || null;

export function solve(context) {
  const steps = [];
  const passed = new Set(context.filter((entry) => entry.tags.retryOk || /reintento superado/.test(entry.text)).map((entry) => testOf(entry.text)));
  const errors = context.filter((entry) => entry.type === "ERROR").map((entry) => ({ test: testOf(entry.text), text: entry.text }));
  const seenTests = new Set();
  for (const error of [...errors].reverse()) {
    if (!error.test || seenTests.has(error.test)) continue;
    seenTests.add(error.test);
    if (passed.has(error.test)) {
      steps.push(`${error.test}: descartado (reintento superado)`);
      continue;
    }
    let target = null;
    let from = error.test;
    for (let hop = 0; hop < 3; hop++) {
      const link = context.map((entry) => traceOf(entry.text)).find((t) => t && t.from === from);
      if (!link) break;
      target = link.to;
      from = link.to;
    }
    if (!target) {
      steps.push(`${error.test}: sin TRACE → función desconocida`);
      continue;
    }
    let cause = causeFromText(error.text, "ERROR");
    if (!cause) {
      const debug = context.find((entry) => entry.type === "DEBUG" && entry.text.startsWith(`DEBUG ${target} `));
      cause = debug ? causeFromText(debug.text, "DEBUG") : null;
    }
    if (!cause) {
      steps.push(`${error.test}: función ${target}, causa no visible`);
      continue;
    }
    steps.push(`${error.test}: función ${target}, causa «${cause}»`);
    return { answer: { culprit: target, cause }, steps };
  }
  steps.push("sin diagnóstico");
  return { answer: null, steps };
}

const runObservers = new Set();
export function observeRuns(fn) {
  runObservers.add(fn);
  return () => runObservers.delete(fn);
}

export function runTask(task, genome, budget = BUDGET) {
  for (const fn of runObservers) fn(task, genome);
  const managed = manageContext(task.lines, genome, budget);
  const kept = new Set(managed.context.map((entry) => entry.index));
  const coverage = task.required.filter((index) => kept.has(index)).length / task.required.length;
  const { answer, steps } = solve(managed.context);
  const success = !!answer && answer.culprit === task.culprit && answer.cause === task.cause;
  return { seed: task.seed, family: task.family, success, coverage, cost: managed.used, answer, steps, managed, kept };
}

export function evaluate(genome, tasks, budget = BUDGET) {
  const runs = tasks.map((task) => runTask(task, genome, budget));
  const n = runs.length;
  return {
    runs,
    n,
    success: runs.filter((run) => run.success).length / n,
    coverage: runs.reduce((t, run) => t + run.coverage, 0) / n,
    cost: runs.reduce((t, run) => t + run.cost, 0) / n,
  };
}

export function pairedBootstrap(a, b, { resamples = 2000, seed = 4242 } = {}) {
  const rng = makeRng(seed);
  const diffs = a.runs.map((run, index) => (b.runs[index].success ? 1 : 0) - (run.success ? 1 : 0));
  const n = diffs.length;
  const mean = diffs.reduce((t, v) => t + v, 0) / n;
  const samples = [];
  for (let r = 0; r < resamples; r++) {
    let total = 0;
    for (let i = 0; i < n; i++) total += diffs[Math.floor(rng.next() * n)];
    samples.push(total / n);
  }
  samples.sort((x, y) => x - y);
  const low = samples[Math.floor(0.025 * resamples)];
  const high = samples[Math.ceil(0.975 * resamples) - 1];
  const wins = diffs.filter((d) => d > 0).length;
  const losses = diffs.filter((d) => d < 0).length;
  return { mean, low, high, wins, losses, ties: n - wins - losses, p: signTest(wins, losses) };
}

export function signTest(wins, losses) {
  const n = wins + losses;
  if (!n) return 1;
  const k = Math.min(wins, losses);
  let total = 0;
  let c = 1;
  for (let i = 0; i <= k; i++) {
    if (i > 0) c = (c * (n - i + 1)) / i;
    total += c;
  }
  return Math.min(1, (2 * total) / 2 ** n);
}

export function verdictOf(ci) {
  if (ci.low > 0) return "mejora";
  if (ci.high < 0) return "regresión";
  return "sin diferencia concluyente";
}

export const COMPOSITE = { lambda: 0.1 };
export const compositeOf = (result, budget = BUDGET) => result.success - COMPOSITE.lambda * (result.cost / budget);

export function promotionDecision(active, candidate, ci, budget = BUDGET) {
  const gate = ci.high < 0 ? "rechazo: regresión de corrección" : null;
  const promote = !gate && ci.low > 0;
  return {
    promote,
    archive: true,
    reason: gate || (promote ? "promover: IC95 de Δéxito > 0" : "archivar sin promover: evidencia insuficiente"),
    compositeActive: compositeOf(active, budget),
    compositeCandidate: compositeOf(candidate, budget),
  };
}

export function pseudocodeOf(genome) {
  const lines = [`función contexto_${genome.id}(registro, B = ${BUDGET}):`];
  if (genome.dedupe) lines.push("  registro ← quitar líneas repetidas");
  if (genome.clip) lines.push(`  cada línea ← sus primeras ${genome.clip} palabras`);
  const drops = TYPES.filter((type) => genome.weights[type] < 0);
  if (drops.length) lines.push(`  registro ← descartar tipos ${drops.join(", ")}`);
  if (genome.select === "orden") {
    lines.push("  para cada línea en orden de aparición:");
    lines.push("    si cabe en B: añadirla; si no: detenerse");
  } else {
    const ws = TYPES.filter((type) => genome.weights[type] > 0).map((type) => `${type} ${genome.weights[type]}`).join(", ");
    lines.push(`  puntaje ← peso por tipo (${ws || "todos 0"})`);
    if (genome.link) lines.push(`         + ${genome.link} si menciona una prueba fallida o su traza`);
    if (genome.keepLast) lines.push(`  reservar primero las ${genome.keepLast} últimas líneas`);
    lines.push(`  ordenar por puntaje (empates: más ${genome.tie})`);
    lines.push("  añadir mientras quepa en B");
    lines.push("  restaurar el orden cronológico");
  }
  lines.push("  devolver contexto");
  return lines.join("\n");
}
