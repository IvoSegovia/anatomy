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
  return lines;
}

export function analyse(reports, analystGenome) {
  const seen = {};
  let total = 0;
  let visible = 0;
  for (const lines of reports) {
    const all = lines.filter((entry) => entry.tags.diag);
    total += all.length;
    const { context } = manageContext(lines, analystGenome, BUDGET);
    for (const entry of context.filter((e) => e.tags.diag)) {
      visible += 1;
      seen[entry.tags.diag] = (seen[entry.tags.diag] || 0) + 1;
    }
  }
  return { seen, total, visible, quality: total ? visible / total : 1 };
}

export function propose(parent, analysis, rng, memory, failingTypes) {
  const g = withId(parent.genome, "", "");
  const ranked = Object.entries(analysis.seen).filter(([kind]) => kind !== "otro").sort((a, b) => b[1] - a[1]);
  let note;
  if (ranked.length) {
    const kind = ranked[0][0];
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
        const type = rng.pick(failingTypes.presupuesto || ["DEBUG"]);
        g.weights[type] = clampW(g.weights[type] + 1);
        note = `dirigida: subir el peso de ${type}`;
      }
    } else if (kind === "tipo") {
      const type = rng.pick(failingTypes.tipo || ["DEBUG"]);
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
    note = `${note ? "repetida → " : ""}aleatoria: cambiar ${field}`;
  }
  return { genome: g, note };
}

const validGenome = (g) => TYPES.some((type) => g.weights[type] >= 0) && g.weights.ERROR >= 0;

export function runLoop({
  mode = "B",
  seed = 1,
  budget = 900,
  noise = 0,
  families = null,
  nVal = 40,
  explore = 0.3,
  criterion = "estricto",
  lambda = 0.1,
  start = VERSIONS.v0,
  metaMutation = true,
} = {}) {
  const rng = makeRng(seed * 131 + 1);
  const metaRng = makeRng(seed * 389 + 2);
  const noiseRng = makeRng(seed * 977 + 5);
  const dev = makeSplit(SPLITS.dev.base, SPLITS.dev.count, families);
  const valAll = makeSplit(SPLITS.valid.base, SPLITS.valid.count, families);
  const audit = makeSplit(SPLITS.audit.base, SPLITS.audit.count);
  const test = makeSplit(SPLITS.test.base, SPLITS.test.count);
  const auditOf = (genome) => audit.filter((task) => runTask(task, genome).success).length / audit.length;
  const testOf = (genome) => test.filter((task) => runTask(task, genome).success).length / test.length;
  const memory = new Set();
  let spent = 0;
  let counter = 0;
  const root = { id: start.id, genome: withId(start, start.id, start.name), parent: null, strategy: { nVal, explore }, audit: auditOf(start) };
  const archive = [root];
  let active = root;
  let analyst = mode === "A" ? withId(VERSIONS.v0, "v0", VERSIONS.v0.name) : active.genome;
  let strategy = { nVal, explore };
  const valQueries = new Map();
  const cycles = [];
  let lastValid = root;
  const evalVal = (genome, tasks) => tasks.map((task) => {
    const run = runTask(task, genome);
    const flip = noise > 0 && noiseRng.next() < noise;
    return { ...run, success: flip ? !run.success : run.success, flipped: flip };
  });
  const devCost = dev.length;
  while (spent + devCost + strategy.nVal <= budget) {
    const cycle = { index: cycles.length + 1, analyst: analyst.id || "v0", strategy: { ...strategy } };
    const parent = rng.next() < strategy.explore && archive.length > 1 ? rng.pick(archive) : active;
    cycle.parent = parent.id;
    const devRuns = dev.map((task) => runTask(task, parent.genome));
    spent += devCost;
    const failing = dev.map((task, i) => ({ task, run: devRuns[i] })).filter((x) => !x.run.success);
    const reports = failing.map(({ task, run }) => reportOf(task, run, parent.id));
    const analysis = analyse(reports, analyst);
    const failingTypes = {};
    failing.forEach(({ task, run }) => diagnose(task, run).forEach((d) => (failingTypes[d.kind] = [...(failingTypes[d.kind] || []), d.type])));
    cycle.analysis = analysis;
    cycle.devSuccess = devRuns.filter((r) => r.success).length / dev.length;
    const proposal = propose(parent, analysis, rng, memory, failingTypes);
    counter += 1;
    const id = `c${counter}`;
    const genome = withId(proposal.genome, id, proposal.note);
    cycle.proposal = proposal.note;
    cycle.candidate = id;
    memory.add(keyOf(genome));
    let candidateStrategy = { ...strategy };
    if (mode === "B" && metaMutation && metaRng.next() < 0.25) {
      candidateStrategy = { ...strategy, nVal: metaRng.pick([10, 20, 40].filter((n) => n !== strategy.nVal)) };
      cycle.meta = `estrategia: ${strategy.nVal} → ${candidateStrategy.nVal} tareas de validación por candidata`;
    }
    if (!validGenome(genome)) {
      cycle.built = false;
      cycle.outcome = "inválida (no se archiva)";
      cycles.push(cycle);
      continue;
    }
    cycle.built = true;
    const tasks = valAll.slice(0, strategy.nVal);
    const key = tasks.map((t) => t.seed).join(",");
    valQueries.set(key, (valQueries.get(key) || 0) + 1);
    const activeRuns = evalVal(active.genome, tasks);
    const candRuns = evalVal(genome, tasks);
    spent += strategy.nVal;
    const proxyOf = (run) => (run.managed.context.length ? run.managed.context.filter((e) => e.type === "ERROR" || e.type === "TRACE").length / run.managed.context.length : 0);
    const pack = (runs) => ({ runs, success: runs.filter((r) => r.success).length / runs.length, cost: runs.reduce((t, r) => t + r.cost, 0) / runs.length, proxy: runs.reduce((t, r) => t + proxyOf(r), 0) / runs.length });
    const a = pack(activeRuns);
    const c = pack(candRuns);
    const ci = pairedBootstrap(a, c, { resamples: 1000, seed: seed * 17 + counter });
    cycle.val = { active: a.success, candidate: c.success, ci, n: tasks.length, costA: a.cost, costC: c.cost };
    const version = { id, genome, parent: parent.id, strategy: candidateStrategy, cycle: cycle.index, valSuccess: c.success };
    archive.push(version);
    const composite = (x) => x.success - lambda * (x.cost / BUDGET);
    const visibleOf = (x) => (criterion === "compuesto" ? composite(x) : criterion === "proxy" ? x.proxy : x.success);
    const promote = criterion === "estricto" ? ci.low > 0 : visibleOf(c) > visibleOf(a);
    cycle.visible = visibleOf(c);
    cycle.visibleActive = visibleOf(a);
    cycle.promoted = promote;
    if (promote) {
      version.audit = auditOf(genome);
      cycle.auditBefore = active.audit;
      cycle.auditAfter = version.audit;
      cycle.validImprovement = version.audit > active.audit;
      active = version;
      if (version.audit >= lastValid.audit) lastValid = version;
      if (mode === "B") {
        analyst = genome;
        strategy = candidateStrategy;
      }
      cycle.outcome = `promovida (Δéxito val ${ci.mean >= 0 ? "+" : ""}${ci.mean.toFixed(2)})`;
    } else cycle.outcome = ci.high < 0 ? "archivada · regresión" : "archivada sin promover";
    cycle.active = active.id;
    cycle.activeAudit = active.audit;
    cycle.spent = spent;
    cycles.push(cycle);
  }
  const promotions = cycles.filter((c) => c.promoted).length;
  const valid = cycles.filter((c) => c.validImprovement).length;
  return {
    mode,
    seed,
    cycles,
    archive,
    active,
    lastValid,
    spent,
    startAudit: root.audit,
    finalAudit: active.audit,
    finalTest: testOf(active.genome),
    startTest: testOf(root.genome),
    lastValidTest: testOf(lastValid.genome),
    promotions,
    validImprovements: valid,
    costPerImprovement: valid ? spent / valid : null,
    meanQuality: cycles.length ? cycles.reduce((t, c) => t + (c.analysis ? c.analysis.quality : 0), 0) / cycles.length : 0,
    maxValQueries: Math.max(0, ...valQueries.values()),
    pseudocode: pseudocodeOf(active.genome),
  };
}

export function compareModes({ seeds = 10, ...options } = {}) {
  const rows = [];
  for (let seed = 1; seed <= seeds; seed++) rows.push({ seed, A: runLoop({ ...options, mode: "A", seed }), B: runLoop({ ...options, mode: "B", seed }) });
  return rows;
}
