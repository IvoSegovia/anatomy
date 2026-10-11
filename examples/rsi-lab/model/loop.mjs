import { makeRng } from "./rng.mjs";
import { VERSIONS, BUDGET, TYPES, makeSplit, SPLITS, runTask, manageContext, pairedBootstrap, pseudocodeOf } from "./agent.mjs";

const clampW = (value) => Math.max(-1, Math.min(3, value));
const keyOf = (genome) => JSON.stringify([genome.dedupe, TYPES.map((type) => genome.weights[type]), genome.link, genome.select, genome.tie, genome.keepLast, genome.clip || 0]);
const withId = (genome, id, name) => ({ ...genome, weights: { ...genome.weights }, id, name });

export function diagnose(task, run) {
  if (run.success) return [];
  const out = [];
  for (const index of task.required) {
    const state = run.managed.status.get(index);
    const entry = task.lines[index];
    if (state === "presupuesto") out.push({ kind: "presupuesto", type: entry.type, detail: `${entry.type} excluida por presupuesto` });
    else if (state === "tipo") out.push({ kind: "tipo", type: entry.type, detail: `${entry.type} descartada por filtro de tipo` });
    else if (state === "recortada" && entry.type === "DEBUG") out.push({ kind: "recorte", type: entry.type, detail: "recorte eliminó la palabra clave" });
  }
  if (!out.length && run.answer && run.answer.culprit !== task.culprit) out.push({ kind: "señuelo", type: "INFO", detail: "eligió un señuelo sin ver «reintento superado»" });
  const dupTokens = run.managed.context.filter((entry) => entry.tags.dup).reduce((t, e) => t + e.tokens, 0);
  if (dupTokens >= 12) out.push({ kind: "duplicados", type: "INFO", detail: `${dupTokens} tokens en líneas repetidas` });
  if (!out.length) out.push({ kind: "otro", type: "INFO", detail: "sin causa identificada" });
  return out;
}

export function reportOf(task, run, versionId) {
  const header = [
    `INFO ejecución de la tarea ${task.seed} con el gestor ${versionId} y presupuesto ${BUDGET}`,
    `INFO entorno aislado preparado con 41 pruebas y red simulada activa`,
    `INFO registro original de ${task.lines.length} líneas y ${task.totalTokens} tokens`,
    `INFO contexto final de ${run.managed.context.length} líneas y ${run.cost} tokens`,
    `INFO el solucionador simbólico evaluó ${run.steps.length} hipótesis`,
    `INFO duración simulada de la ejecución 3.2 segundos`,
  ];
  const lines = header.map((text) => ({ type: "INFO", text, tokens: text.split(/\s+/).length, tags: {} }));
  for (const d of diagnose(task, run)) {
    const text = `DEBUG diag ${task.testName} ${d.kind} ${d.detail}`;
    lines.push({ type: "DEBUG", text, tokens: text.split(/\s+/).length, tags: { diag: d.kind } });
  }
  const text = `ERROR ${task.testName} tarea fallida respuesta ${run.answer ? run.answer.culprit : "ninguna"}`;
  lines.push({ type: "ERROR", text, tokens: text.split(/\s+/).length, tags: {} });
  lines.forEach((entry, index) => (entry.index = index));
  lines.source = { seed: task.seed, version: versionId };
  return lines;
}

const DIAG_RE = /^DEBUG diag \S+ (\S+)(?: (\S+))?/;
export function readDiagnosis(text) {
  const match = text.match(DIAG_RE);
  if (!match) return null;
  return { kind: match[1], type: TYPES.includes(match[2]) ? match[2] : null };
}

export function analyse(reports, analystGenome, { keepDetails = 2 } = {}) {
  const seen = {};
  const seenTypes = {};
  const details = [];
  let total = 0;
  let visible = 0;
  reports.forEach((lines, r) => {
    total += lines.filter((entry) => entry.tags.diag).length;
    const managed = manageContext(lines, analystGenome, BUDGET);
    const read = [];
    for (const entry of managed.context) {
      const diag = readDiagnosis(entry.text);
      if (!diag) continue;
      visible += 1;
      read.push(diag);
      seen[diag.kind] = (seen[diag.kind] || 0) + 1;
      if (diag.type) seenTypes[diag.kind] = [...(seenTypes[diag.kind] || []), diag.type];
    }
    if (r < keepDetails)
      details.push({
        source: lines.source,
        raw: lines,
        lines: lines.map((entry) => ({ index: entry.index, type: entry.type, text: entry.text, tokens: entry.tokens, diag: !!entry.tags.diag, status: managed.status.get(entry.index) })),
        used: managed.used,
        read,
      });
  });
  return { seen, seenTypes, total, visible, quality: total ? visible / total : null, details };
}

export const RULES = {
  presupuesto: "si el diagnóstico dice «excluida por presupuesto»: seleccionar por puntuación; si ya lo hace, quitar duplicados; si ya lo hace, subir el peso del tipo excluido",
  tipo: "si dice «descartada por filtro de tipo»: dejar de descartar ese tipo",
  recorte: "si dice «recorte eliminó la palabra clave»: recortar menos",
  señuelo: "si dice «eligió un señuelo»: dar más puntaje a las líneas que mencionan pruebas fallidas",
  duplicados: "si dice «tokens en líneas repetidas»: quitar duplicados",
  aleatoria: "sin diagnóstico legible, o con una propuesta ya probada: mutación aleatoria de un campo",
};

export function propose(parent, analysis, rng, memory) {
  const g = withId(parent.genome, "", "");
  const ranked = Object.entries(analysis.seen).filter(([kind]) => kind !== "otro").sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const typesOf = (kind) => (analysis.seenTypes[kind] && analysis.seenTypes[kind].length ? analysis.seenTypes[kind] : ["DEBUG"]);
  let note;
  let rule = null;
  if (ranked.length) {
    const kind = ranked[0][0];
    rule = kind;
    if (kind === "presupuesto") {
      if (g.select === "orden") {
        g.select = "puntuación";
        g.tie = "recientes";
        g.weights = { ERROR: 3, TRACE: 2, DEBUG: 1, WARN: 0, INFO: 0 };
        note = "dirigida: seleccionar por puntuación en vez de por orden";
      } else if (!g.dedupe) {
        g.dedupe = true;
        note = "dirigida: quitar duplicados para liberar presupuesto";
      } else {
        const type = rng.pick(typesOf("presupuesto"));
        g.weights[type] = clampW(g.weights[type] + 1);
        note = `dirigida: subir el peso de ${type}`;
      }
    } else if (kind === "tipo") {
      const type = rng.pick(typesOf("tipo"));
      g.weights[type] = 1;
      note = `dirigida: dejar de descartar ${type}`;
    } else if (kind === "recorte") {
      g.clip = g.clip ? (g.clip >= 10 ? 0 : g.clip + 2) : 0;
      note = "dirigida: recortar menos las líneas";
    } else if (kind === "señuelo") {
      g.link = Math.min(3, g.link + 1);
      if (g.link === 3) g.weights.INFO = clampW(g.weights.INFO + 1);
      note = "dirigida: priorizar líneas que mencionan pruebas fallidas";
    } else {
      g.dedupe = true;
      note = "dirigida: quitar duplicados";
    }
  }
  let random = null;
  if (!note || memory.has(keyOf(g))) {
    const field = rng.pick(["dedupe", "weight", "weight", "link", "select", "tie", "clip"]);
    if (field === "dedupe") g.dedupe = !g.dedupe;
    else if (field === "weight") {
      const type = rng.pick(TYPES);
      g.weights[type] = clampW(g.weights[type] + (rng.next() < 0.5 ? -1 : 1));
    } else if (field === "link") g.link = rng.int(0, 3);
    else if (field === "select") g.select = g.select === "orden" ? "puntuación" : "orden";
    else if (field === "tie") g.tie = g.tie === "recientes" ? "antiguas" : "recientes";
    else g.clip = rng.pick([0, 0, 6, 8]);
    random = field;
    note = `${note ? "repetida → " : ""}aleatoria: cambiar ${field}`;
  }
  return { genome: g, note, rule: random ? "aleatoria" : rule, directedRule: rule, ranked, random };
}

export function genomeDiff(a, b) {
  const out = [];
  if (a.select !== b.select) out.push(`selección: ${a.select} → ${b.select}`);
  if (a.dedupe !== b.dedupe) out.push(`duplicados: ${a.dedupe ? "se quitan" : "se conservan"} → ${b.dedupe ? "se quitan" : "se conservan"}`);
  for (const type of TYPES) if (a.weights[type] !== b.weights[type]) out.push(`peso ${type}: ${a.weights[type]} → ${b.weights[type]}`);
  if (a.link !== b.link) out.push(`bonificación por mencionar la prueba fallida: ${a.link} → ${b.link}`);
  if (a.tie !== b.tie) out.push(`empates: más ${a.tie} → más ${b.tie}`);
  if ((a.clip || 0) !== (b.clip || 0)) out.push(`recorte por línea: ${a.clip || "no"} → ${b.clip || "no"}`);
  return out;
}

const validGenome = (g) => TYPES.some((type) => g.weights[type] >= 0) && g.weights.ERROR >= 0;

export const SEARCH_BUDGET = 1600;
export const PROTOCOL = {
  unit: "ejecuciones de tareas del banco (una llamada a runTask); no es tiempo, FLOPs ni dinero",
  search: "desarrollo + validación, incluida la reevaluación de la versión activa en cada comparación",
  separate: "auditoría (40 por versión medida) y prueba final (60 por versión evaluada al terminar) tienen presupuesto aparte",
  reserve: "un ciclo empieza sólo si lo que queda cubre desarrollo + 2 × validación; no hay lotes parciales; si la candidata es inválida, la reserva de validación se libera sin ejecutarse",
  cache: "sin caché: cada evaluación se ejecuta y se cobra",
};
export const CATEGORIES = ["desarrollo", "validación", "auditoría", "prueba"];
const SEARCH = new Set(["desarrollo", "validación"]);

export function makeLedger(limit) {
  const used = { desarrollo: 0, validación: 0, auditoría: 0, prueba: 0 };
  const search = () => used.desarrollo + used.validación;
  return {
    limit,
    used,
    search,
    remaining: () => limit - search(),
    total: () => CATEGORIES.reduce((t, key) => t + used[key], 0),
    charge(category, n = 1) {
      if (!(category in used)) throw new Error(`categoría desconocida: ${category}`);
      if (SEARCH.has(category) && search() + n > limit) throw new Error(`presupuesto de búsqueda excedido: ${search() + n} > ${limit}`);
      used[category] += n;
    },
    snapshot: () => ({ ...used, search: search(), limit }),
  };
}

const ACCESS = {
  ejecutor: { desarrollo: ["búsqueda"] },
  selector: { validación: ["búsqueda"] },
  auditor: { auditoría: ["búsqueda", "final"] },
  "evaluador final": { prueba: ["final"] },
};

export function makeGate({ families = null, testBase = SPLITS.test.base, ledger }) {
  const sets = {
    desarrollo: makeSplit(SPLITS.dev.base, SPLITS.dev.count, families),
    validación: makeSplit(SPLITS.valid.base, SPLITS.valid.count, families),
    auditoría: makeSplit(SPLITS.audit.base, SPLITS.audit.count),
    prueba: makeSplit(testBase, SPLITS.test.count),
  };
  const log = [];
  let phase = "búsqueda";
  return {
    log,
    sizes: Object.fromEntries(Object.entries(sets).map(([key, list]) => [key, list.length])),
    get phase() {
      return phase;
    },
    freeze() {
      phase = "final";
      log.push({ consumer: "protocolo", split: null, phase, n: 0, what: "versión final fijada" });
    },
    run(consumer, split, genome, count) {
      const allowed = ACCESS[consumer] && ACCESS[consumer][split];
      if (!allowed || !allowed.includes(phase)) throw new Error(`acceso no permitido: ${consumer} → ${split} en la fase ${phase}`);
      const tasks = sets[split].slice(0, count ?? sets[split].length);
      log.push({ consumer, split, phase, n: tasks.length, version: genome.id });
      return tasks.map((task) => {
        ledger.charge(split, 1);
        return { ...runTask(task, genome), task };
      });
    },
    handOver(consumer, split, what, n) {
      log.push({ consumer, split, phase, n, what });
    },
  };
}

export function runLoop({
  mode = "B",
  seed = 1,
  budget = SEARCH_BUDGET,
  noise = 0,
  families = null,
  nVal = 40,
  explore = 0.3,
  criterion = "estricto",
  lambda = 0.1,
  start = VERSIONS.v0,
  metaMutation = true,
  testBase = SPLITS.test.base,
  probe = null,
} = {}) {
  const rng = makeRng(seed * 131 + 1);
  const metaRng = makeRng(seed * 389 + 2);
  const noiseRng = makeRng(seed * 977 + 5);
  const ledger = makeLedger(budget);
  const gate = makeGate({ families, testBase, ledger });
  const devCount = gate.sizes.desarrollo;
  const rate = (runs) => runs.filter((run) => run.success).length / runs.length;
  const auditOf = (genome) => rate(gate.run("auditor", "auditoría", genome));
  const memory = new Set();
  let counter = 0;
  const root = { id: start.id, genome: withId(start, start.id, start.name), parent: null, strategy: { nVal, explore }, audit: auditOf(start) };
  const archive = [root];
  let active = root;
  let analyst = mode === "A" ? withId(VERSIONS.v0, "v0", VERSIONS.v0.name) : active.genome;
  let strategy = { nVal, explore };
  const valQueries = new Map();
  const cycles = [];
  let lastValid = root;
  let stopReason = null;
  const evalVal = (genome, n) =>
    gate.run("selector", "validación", genome, n).map((run) => {
      const flip = noise > 0 && noiseRng.next() < noise;
      return { ...run, success: flip ? !run.success : run.success, flipped: flip };
    });
  for (;;) {
    const need = devCount + 2 * strategy.nVal;
    if (ledger.remaining() < need) {
      stopReason = `quedan ${ledger.remaining()} ejecuciones y un ciclo completo necesita ${need}`;
      break;
    }
    const cycle = { index: cycles.length + 1, analyst: analyst.id || "v0", analystGenome: analyst, activeBefore: active.id, strategy: { ...strategy }, reserved: need, before: ledger.snapshot() };
    const parent = rng.next() < strategy.explore && archive.length > 1 ? rng.pick(archive) : active;
    cycle.parent = parent.id;
    const devRuns = gate.run("ejecutor", "desarrollo", parent.genome);
    const devTasks = devRuns.map((run) => run.seed);
    const failing = devRuns.filter((run) => !run.success);
    const reports = failing.map((run) => reportOf(run.task, run, parent.id));
    gate.handOver("proponente", "desarrollo", "informes de fallo", reports.length);
    const analysis = analyse(reports, analyst);
    cycle.analysis = analysis;
    cycle.devSuccess = rate(devRuns);
    cycle.devTasks = devTasks;
    const proposal = propose(parent, analysis, rng, memory);
    if (probe && probe.propose) probe.propose({ cycle: cycle.index, parent: parent.id, analyst: analyst.id, reportSeeds: reports.map((lines) => lines.source.seed), analysis, proposal: proposal.note });
    counter += 1;
    const id = `c${counter}`;
    const genome = withId(proposal.genome, id, proposal.note);
    cycle.proposal = proposal.note;
    cycle.rule = proposal.rule;
    cycle.ranked = proposal.ranked;
    cycle.diff = genomeDiff(parent.genome, genome);
    cycle.parentGenome = parent.genome;
    cycle.candidateGenome = genome;
    cycle.candidate = id;
    memory.add(keyOf(genome));
    let candidateStrategy = { ...strategy };
    if (mode === "B" && metaMutation && metaRng.next() < 0.25) {
      candidateStrategy = { ...strategy, nVal: metaRng.pick([10, 20, 40].filter((n) => n !== strategy.nVal)) };
      cycle.meta = `estrategia: ${strategy.nVal} → ${candidateStrategy.nVal} tareas de validación por candidata`;
    }
    if (!validGenome(genome)) {
      cycle.built = false;
      cycle.outcome = "inválida (no se evalúa ni se archiva)";
      cycle.released = 2 * strategy.nVal;
      cycle.after = ledger.snapshot();
      cycle.spent = ledger.search();
      cycles.push(cycle);
      continue;
    }
    cycle.built = true;
    const key = `${strategy.nVal}`;
    valQueries.set(key, (valQueries.get(key) || 0) + 1);
    const activeRuns = evalVal(active.genome, strategy.nVal);
    const candRuns = evalVal(genome, strategy.nVal);
    const proxyOf = (run) => (run.managed.context.length ? run.managed.context.filter((e) => e.type === "ERROR" || e.type === "TRACE").length / run.managed.context.length : 0);
    const pack = (runs) => ({ runs, success: rate(runs), cost: runs.reduce((t, r) => t + r.cost, 0) / runs.length, proxy: runs.reduce((t, r) => t + proxyOf(r), 0) / runs.length });
    const a = pack(activeRuns);
    const c = pack(candRuns);
    const ci = pairedBootstrap(a, c, { resamples: 1000, seed: seed * 17 + counter });
    cycle.val = { active: a.success, candidate: c.success, ci, n: strategy.nVal, costA: a.cost, costC: c.cost };
    const version = { id, genome, parent: parent.id, strategy: candidateStrategy, cycle: cycle.index, valSuccess: c.success };
    archive.push(version);
    const composite = (x) => x.success - lambda * (x.cost / BUDGET);
    const visibleOf = (x) => (criterion === "compuesto" ? composite(x) : criterion === "proxy" ? x.proxy : x.success);
    const promote = criterion === "estricto" ? ci.low > 0 : visibleOf(c) > visibleOf(a);
    cycle.visible = visibleOf(c);
    cycle.visibleActive = visibleOf(a);
    cycle.promoted = promote;
    cycle.reason =
      criterion === "estricto"
        ? promote
          ? `IC95 de Δéxito [${ci.low.toFixed(2)}, ${ci.high.toFixed(2)}] queda entero por encima de 0`
          : ci.high < 0
            ? `IC95 de Δéxito [${ci.low.toFixed(2)}, ${ci.high.toFixed(2)}] queda entero por debajo de 0: regresión`
            : `IC95 de Δéxito [${ci.low.toFixed(2)}, ${ci.high.toFixed(2)}] incluye 0: evidencia insuficiente`
        : `puntuación visible ${visibleOf(c).toFixed(3)} ${promote ? ">" : "≤"} ${visibleOf(a).toFixed(3)} de la activa`;
    if (promote) {
      version.audit = auditOf(genome);
      cycle.auditBefore = active.audit;
      cycle.auditAfter = version.audit;
      cycle.validImprovement = version.audit > active.audit;
      cycle.replaced = active.id;
      active = version;
      if (version.audit >= lastValid.audit) lastValid = version;
      if (mode === "B") {
        cycle.analystNext = genome.id;
        analyst = genome;
        strategy = candidateStrategy;
      }
      cycle.outcome = `promovida (Δéxito val ${ci.mean >= 0 ? "+" : ""}${ci.mean.toFixed(2)})`;
    } else cycle.outcome = ci.high < 0 ? "archivada · regresión" : "archivada sin promover";
    cycle.active = active.id;
    cycle.activeAudit = active.audit;
    cycle.after = ledger.snapshot();
    cycle.spent = ledger.search();
    cycles.push(cycle);
  }
  gate.freeze();
  if (probe && probe.freeze) probe.freeze({ active: active.id, lastValid: lastValid.id, cycles: cycles.length });
  const testOf = (genome) => rate(gate.run("evaluador final", "prueba", genome));
  const finalTest = testOf(active.genome);
  const startTest = testOf(root.genome);
  const lastValidTest = lastValid === active ? finalTest : testOf(lastValid.genome);
  const promotions = cycles.filter((c) => c.promoted).length;
  const valid = cycles.filter((c) => c.validImprovement).length;
  const qualities = cycles.map((c) => c.analysis && c.analysis.quality).filter((q) => q !== null && q !== undefined);
  return {
    mode,
    seed,
    cycles,
    archive,
    active,
    lastValid,
    spent: ledger.search(),
    ledger: ledger.snapshot(),
    access: gate.log,
    stopReason,
    budget,
    startAudit: root.audit,
    finalAudit: active.audit,
    finalTest,
    startTest,
    lastValidTest,
    promotions,
    validImprovements: valid,
    costPerImprovement: valid ? ledger.search() / valid : null,
    meanQuality: qualities.length ? qualities.reduce((t, q) => t + q, 0) / qualities.length : null,
    maxValQueries: Math.max(0, ...valQueries.values()),
    pseudocode: pseudocodeOf(active.genome),
  };
}

export function compareModes({ seeds = 10, ...options } = {}) {
  const rows = [];
  for (let seed = 1; seed <= seeds; seed++) rows.push({ seed, A: runLoop({ ...options, mode: "A", seed }), B: runLoop({ ...options, mode: "B", seed }) });
  return rows;
}
