import { initParams, forward, paramCount, paramPrint, prefillCache, stepWithCache, invalidateFrom, generate, temperatureProbs, CONFIG, causalMask } from "./model/transformer.mjs";
import { tokenize } from "./model/tokenizer.mjs";
import { examplesOf, TRAIN_TEXT, VALID_TEXT, headOf, lossAndGrad, finiteDifferenceCheck, sgdStep, adamStep, adamInit, flatHead, runTraining, ADAM } from "./model/train.mjs";
import { runReflection } from "./model/reflection.mjs";
import { softmax } from "./model/linalg.mjs";
import { gradLogPi, runReinforce, ppoObjective, ppoGrad, sampleBatch, rewardTable } from "./model/rl.mjs";
import { runEvolution, TRAIN_SEQS, HOLDOUT_SEQS } from "./model/evo.mjs";
import { SPLITS, makeSplit, VERSIONS, evaluate, pairedBootstrap, verdictOf, makeTask, observeRuns } from "./model/agent.mjs";
import { runLoop, makeGate, makeLedger, analyse, propose, reportOf, SEARCH_BUDGET } from "./model/loop.mjs";
import { makeRng } from "./model/rng.mjs";
import { runTask } from "./model/agent.mjs";
import { optionsOf } from "./model/limits.mjs";
import { runScenario, SCENARIOS } from "./model/limits.mjs";
import { fingerprint } from "./model/rng.mjs";

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });
const close = (a, b, tol) => Math.abs(a - b) <= tol;

const params = initParams();
const print0 = paramPrint(params);
const ids = tokenize("def f(x):").map((t) => t.id);
check("tokenización de juguete: 6 tokens con ids válidos", ids.length === 6 && ids.every((id) => id >= 0 && id < 16), ids.join(","));
check("número de parámetros = 2048", paramCount(params) === 2048, String(paramCount(params)));
const trace = forward(params, ids);
const dims = [];
const shape = (m) => `${m.length}×${m[0].length}`;
dims.push(shape(trace.X0) === "6×8");
for (const block of trace.blocks) {
  dims.push(shape(block.ln1.out) === "6×8", shape(block.concat) === "6×8", shape(block.H) === "6×8", shape(block.U) === "6×32", shape(block.G) === "6×32", shape(block.Y) === "6×8");
  for (const head of block.heads) dims.push(shape(head.Q) === "6×4", shape(head.K) === "6×4", shape(head.V) === "6×4", shape(head.S) === "6×6", shape(head.A) === "6×6", shape(head.Z) === "6×4");
}
dims.push(trace.logits.length === 16, trace.probs.length === 16);
check("dimensiones de todos los intermedios", dims.every(Boolean), `${dims.length} comprobaciones`);
let maskOk = true;
let rowErr = 0;
for (const block of trace.blocks) for (const head of block.heads) head.A.forEach((row, i) => {
  row.forEach((value, j) => { if (j > i && value !== 0) maskOk = false; });
  rowErr = Math.max(rowErr, Math.abs(row.reduce((t, v) => t + v, 0) - 1));
});
check("máscara causal: peso exactamente 0 en posiciones futuras", maskOk);
check("cada fila de A suma 1", rowErr < 1e-12, `error máx ${rowErr.toExponential(2)}`);
check("la máscara M vale 0 o −∞", causalMask(6).flat().every((v) => v === 0 || v === -Infinity));
check("p(siguiente token) suma 1", close(trace.probs.reduce((t, v) => t + v, 0), 1, 1e-12));
const { last } = prefillCache(params, ids);
check("caché KV reproduce la pasada completa", Math.max(...last.logits.map((v, i) => Math.abs(v - trace.logits[i]))) < 1e-12);
const gen = generate(params, ids, 2, { temperature: 0 });
const full = forward(params, [...ids, gen.generated[0].id]);
const cached = stepWithCache(params, prefillCache(params, ids).cache, gen.generated[0].id);
check("paso con caché = recomputar todo (7 tokens)", Math.max(...cached.logits.map((v, i) => Math.abs(v - full.logits[i]))) < 1e-12);
const changed = [...ids];
changed[3] = 14;
const kept = invalidateFrom(prefillCache(params, ids).cache, 3);
const fresh = prefillCache(params, changed).cache;
let prefixSame = true;
kept.blocks.forEach((block, b) => block.K.forEach((rows, h) => rows.forEach((row, t) => row.forEach((v, j) => { if (v !== fresh.blocks[b].K[h][t][j]) prefixSame = false; }))));
const laterDiffer = fresh.blocks[1].K[0][3].some((v, j) => v !== prefillCache(params, ids).cache.blocks[1].K[0][3][j]);
check("invalidación: entradas < p siguen válidas, ≥ p cambian", prefixSame && kept.blocks[0].K[0].length === 3 && laterDiffer);
const tp = temperatureProbs(trace.logits, 0.7);
check("muestreo con temperatura: distribución suma 1", close(tp.reduce((t, v) => t + v, 0), 1, 1e-12));
check("inferencia y generación NO cambian θ (huella)", paramPrint(params) === print0, print0);

const train = examplesOf(params, TRAIN_TEXT);
const valid = examplesOf(params, VALID_TEXT);
check("ejemplos de entrenamiento y validación disjuntos", train.every((t) => valid.every((v) => v.text !== t.text)));
const head0 = headOf(params);
const fd = finiteDifferenceCheck(head0, train);
check("gradiente analítico vs diferencias finitas (160 parámetros)", fd.worst < 1e-6, `error relativo máx ${fd.worst.toExponential(2)}`);
const { grad } = lossAndGrad(head0, train);
const sgd = sgdStep(head0, grad, 0.5);
check("SGD: θ' = θ − η g exactamente", flatHead(sgd.head).every((v, i) => v === flatHead(head0)[i] - 0.5 * flatHead(grad)[i]));
let refTheta = flatHead(head0);
let refM = refTheta.map(() => 0);
let refV = refTheta.map(() => 0);
let head = head0;
let state = adamInit();
let adamErr = 0;
for (let t = 1; t <= 5; t++) {
  const g = flatHead(lossAndGrad(head, train).grad);
  for (let i = 0; i < refTheta.length; i++) {
    refM[i] = ADAM.beta1 * refM[i] + (1 - ADAM.beta1) * g[i];
    refV[i] = ADAM.beta2 * refV[i] + (1 - ADAM.beta2) * g[i] ** 2;
    const mh = refM[i] / (1 - ADAM.beta1 ** t);
    const vh = refV[i] / (1 - ADAM.beta2 ** t);
    refTheta[i] -= (0.05 * mh) / (Math.sqrt(vh) + ADAM.eps);
  }
  const step = adamStep(head, lossAndGrad(head, train).grad, state, 0.05);
  head = step.head;
  state = step.state;
  adamErr = Math.max(adamErr, ...flatHead(head).map((v, i) => Math.abs(v - refTheta[i])));
}
check("Adam = referencia escalar independiente (5 pasos)", adamErr < 1e-12, `dif máx ${adamErr.toExponential(2)}`);
const first = adamStep(head0, grad, adamInit(), 0.05);
check("Adam t=1: corrección de sesgo da Δθ ≈ −η·signo(g)", first.delta.every((d, i) => { const g = flatHead(grad)[i]; return Math.abs(g) < 1e-6 || close(d, -0.05 * Math.sign(g), 1e-6); }));
const run05 = runTraining(params, { eta: 0.5, steps: 40 });
const tr = run05.history.map((h) => h.train);
const va = run05.history.map((h) => h.valid);
const vmin = va.indexOf(Math.min(...va));
check("η=0.5: pérdida de entrenamiento siempre baja", tr.every((v, i) => i === 0 || v < tr[i - 1]));
check("η=0.5: validación baja y luego sube (sobreajuste)", vmin > 0 && vmin < va.length - 1 && va[va.length - 1] > va[vmin] + 0.3, `mínimo en el paso ${vmin}`);
const run12 = runTraining(params, { eta: 1.2, steps: 40 });
check("η=1.2: algún paso EMPEORA la pérdida de entrenamiento y luego converge", run12.history.some((h, i) => i > 0 && h.train > run12.history[i - 1].train) && run12.history[40].train < run12.history[0].train * 0.05);
const run3 = runTraining(params, { eta: 3, steps: 8 });
check("η=3: la pérdida diverge", run3.history[8].train > 100 * run3.history[0].train);
check("el entrenamiento no modifica el cuerpo congelado", paramPrint(params) === print0);
const altValid = VALID_TEXT.map(([text]) => [text, "-"]);
const runAlt = (() => {
  const original = VALID_TEXT.map((pair) => [...pair]);
  VALID_TEXT.splice(0, VALID_TEXT.length, ...altValid);
  const out = runTraining(params, { eta: 0.5, steps: 10 });
  VALID_TEXT.splice(0, VALID_TEXT.length, ...original);
  return out;
})();
const runRef = runTraining(params, { eta: 0.5, steps: 10 });
check("la validación no entra en el gradiente (cambiar sus objetivos no altera θ)", runAlt.history.every((h, i) => h.print === runRef.history[i].print) && runAlt.history[5].valid !== runRef.history[5].valid);

const before = paramPrint(params);
const reflection = runReflection();
check("reflexión: el intento 3 pasa todas las pruebas ejecutadas", reflection.log[reflection.log.length - 1].passed === 4);
check("reflexión: la memoria cambia (2 notas)", reflection.memory.length === 2);
check("reflexión: θ sin cambios", paramPrint(params) === before);

const theta = [0.3, -0.2, 0.5, 0.1];
const pi = softmax(theta);
let rlErr = 0;
for (let a = 0; a < 4; a++) {
  const g = gradLogPi(theta, a);
  for (let k = 0; k < 4; k++) {
    const plus = [...theta]; plus[k] += 1e-6;
    const minus = [...theta]; minus[k] -= 1e-6;
    const num = (Math.log(softmax(plus)[a]) - Math.log(softmax(minus)[a])) / 2e-6;
    rlErr = Math.max(rlErr, Math.abs(num - g[k]));
  }
}
check("∇ log π = e_a − π (diferencias finitas)", rlErr < 1e-8, rlErr.toExponential(2));
const rl = runReinforce();
const bestAction = rl.expected.indexOf(Math.max(...rl.expected));
const finalPi = rl.history[rl.history.length - 1].pi;
check("REINFORCE: la política concentra prob. en la mejor acción", finalPi.indexOf(Math.max(...finalPi)) === bestAction, finalPi.map((p) => p.toFixed(2)).join(" "));
check("baseline calculado antes de cada lote (independiente de sus acciones)", rl.history.slice(2).every((h, i) => h.baselineUsed === rl.history[i + 1].baseline));
const table = rewardTable();
const batch = sampleBatch(theta, table, { n: 8, seed: 9 }).map((e) => ({ ...e, advantage: e.reward - 0.5 }));
const oldPi = softmax([0.25, -0.1, 0.45, 0.05]);
const { grad: pg } = ppoGrad(theta, oldPi, batch, 0.2);
let ppoErr = 0;
for (let k = 0; k < 4; k++) {
  const plus = [...theta]; plus[k] += 1e-6;
  const minus = [...theta]; minus[k] -= 1e-6;
  ppoErr = Math.max(ppoErr, Math.abs((ppoObjective(plus, oldPi, batch, 0.2) - ppoObjective(minus, oldPi, batch, 0.2)) / 2e-6 - pg[k]));
}
check("PPO: gradiente del objetivo recortado = diferencias finitas", ppoErr < 1e-6, ppoErr.toExponential(2));

const e1 = runEvolution();
const e2 = runEvolution();
check("búsqueda evolutiva reproducible con semilla", JSON.stringify(e1.events.map((e) => [e.text, e.score])) === JSON.stringify(e2.events.map((e) => [e.text, e.score])));
check("presupuesto de evaluaciones respetado", e1.spent <= 192, `${e1.spent}/192`);
check("secuencias de reserva distintas de las de entrenamiento", HOLDOUT_SEQS.every((s) => TRAIN_SEQS.every((t) => JSON.stringify(t) !== JSON.stringify(s))));

const sets = Object.fromEntries(Object.entries(SPLITS).map(([k, s]) => [k, makeSplit(s.base, s.count)]));
const seedsOf = (list) => new Set(list.map((t) => t.seed));
const allSeeds = Object.values(sets).map(seedsOf);
check("desarrollo, validación, prueba y auditoría disjuntos", allSeeds.every((a, i) => allSeeds.every((b, j) => i === j || [...a].every((s) => !b.has(s)))));
check("tareas reproducibles (misma semilla, mismo registro)", JSON.stringify(makeTask(123)) === JSON.stringify(makeTask(123)));
const ev = Object.fromEntries(["v0", "v1", "v2", "v3"].map((v) => [v, evaluate(VERSIONS[v], sets.valid)]));
const v01 = verdictOf(pairedBootstrap(ev.v0, ev.v1));
const v12 = verdictOf(pairedBootstrap(ev.v1, ev.v2));
const v13 = verdictOf(pairedBootstrap(ev.v1, ev.v3));
check("v0 → v1: mejora; v1 → v2: regresión; v1 → v3: sin diferencia concluyente", v01 === "mejora" && v12 === "regresión" && v13 === "sin diferencia concluyente", `${v01} · ${v12} · ${v13}`);
check("versiones comparadas con las mismas tareas y presupuesto", ["v1", "v2", "v3"].every((v) => ev[v].runs.every((r, i) => r.seed === ev.v0.runs[i].seed)));
check("bootstrap reproducible", JSON.stringify(pairedBootstrap(ev.v1, ev.v3)) === JSON.stringify(pairedBootstrap(ev.v1, ev.v3)));

const loopPrint = paramPrint(params);
const splitOfSeed = (seed) => ({ 1: "desarrollo", 2: "validación", 3: "prueba", 4: "auditoría", 7: "prueba" })[Math.floor(seed / 100)];
function observed(options) {
  const count = { desarrollo: 0, validación: 0, auditoría: 0, prueba: 0 };
  const order = [];
  const proposals = [];
  const stop = observeRuns((task) => {
    count[splitOfSeed(task.seed)] += 1;
    order.push(splitOfSeed(task.seed));
  });
  const run = runLoop({ ...options, probe: { propose: (input) => (proposals.push(input), order.push("propuesta")), freeze: () => order.push("fijada") } });
  stop();
  return { run, count, order, proposals };
}
const sameBook = (o) => ["desarrollo", "validación", "auditoría", "prueba"].every((k) => o.count[k] === o.run.ledger[k]);
const grid = [];
for (let seed = 1; seed <= 12; seed++) for (const mode of ["A", "B"]) grid.push(observed({ mode, seed }));
check("contabilidad = ejecuciones observadas en runTask (12 semillas × A y B)", grid.every(sameBook), `${grid.length} corridas, desglose por conjunto`);
check(`búsqueda (desarrollo + validación) ≤ ${SEARCH_BUDGET} en todas las corridas`, grid.every((o) => o.count.desarrollo + o.count.validación <= SEARCH_BUDGET), `máx ${Math.max(...grid.map((o) => o.count.desarrollo + o.count.validación))}`);
const s12 = ["A", "B"].map((mode) => observed({ mode, seed: 12, budget: 900 }));
check("semilla 12 con límite 900: lo ejecutado ya no supera el límite", s12.every((o) => sameBook(o) && o.count.desarrollo + o.count.validación <= 900), s12.map((o) => `${o.run.mode} ${o.count.desarrollo}+${o.count.validación}`).join(" · "));
const small = [0, 50, 95, 96, 150, 200, 333].flatMap((budget) => ["A", "B"].map((mode) => ({ budget, o: observed({ mode, seed: 6, budget }) })));
check("límites pequeños: nunca se excede y no hay lotes parciales", small.every(({ budget, o }) => sameBook(o) && o.run.ledger.search <= budget && o.run.cycles.every((c) => c.after.desarrollo - c.before.desarrollo === 16 && c.after.validación - c.before.validación === (c.built ? 2 * c.strategy.nVal : 0))), small.map(({ budget, o }) => `${budget}:${o.run.cycles.length}`).join(" "));
const perCycle = grid.flatMap((o) => o.run.cycles);
const resized = perCycle.filter((c) => c.strategy.nVal !== 40);
check("validación de tamaño cambiante (B): se cobra 2 × nVal efectivo", resized.length > 0 && perCycle.every((c) => c.after.validación - c.before.validación === (c.built ? 2 * c.strategy.nVal : 0)), `${resized.length} ciclos con nVal ≠ 40`);
const invalid = perCycle.filter((c) => !c.built);
check("candidata inválida: se cobra el desarrollo y se libera la validación", invalid.length > 0 && invalid.every((c) => c.after.validación === c.before.validación && c.after.desarrollo - c.before.desarrollo === 16), `${invalid.length} candidatas inválidas`);
check("cada ciclo empieza sólo si cabe completo", perCycle.every((c) => c.before.limit - c.before.search >= c.reserved));
const testAfterFreeze = (o) => {
  const at = o.order.indexOf("fijada");
  return at >= 0 && !o.order.slice(0, at).includes("prueba") && o.order.slice(at).includes("prueba") && !o.order.slice(at).includes("propuesta");
};
check("prueba reservada: sólo después de fijar la versión final (orden observado)", grid.every(testAfterFreeze));
check("el proponente sólo recibe informes de tareas de desarrollo", grid.every((o) => o.proposals.every((p) => p.reportSeeds.every((seed) => splitOfSeed(seed) === "desarrollo"))), `${grid.reduce((t, o) => t + o.proposals.length, 0)} propuestas observadas`);
const allowed = { ejecutor: ["desarrollo"], proponente: ["desarrollo"], selector: ["validación"], auditor: ["auditoría"], "evaluador final": ["prueba"], protocolo: [null] };
check("registro de accesos de la ruta real: cada consumidor sólo toca lo suyo", grid.every((o) => o.run.access.every((a) => allowed[a.consumer] && allowed[a.consumer].includes(a.split) && (a.split !== "prueba" || a.phase === "final"))));
let refused = false;
try {
  makeGate({ ledger: makeLedger(100) }).run("evaluador final", "prueba", VERSIONS.v0);
} catch {
  refused = true;
}
let refused2 = false;
try {
  makeGate({ ledger: makeLedger(100) }).run("selector", "prueba", VERSIONS.v0);
} catch {
  refused2 = true;
}
check("la misma puerta que usa runLoop rechaza la prueba durante la búsqueda", refused && refused2);
const counterfactual = ["A", "B"].map((mode) => [runLoop({ mode, seed: 5 }), runLoop({ mode, seed: 5, testBase: 700 })]);
const trajectory = (r) => JSON.stringify(r.cycles.map((c) => [c.parent, c.proposal, c.promoted, c.active, c.spent]));
check("cambiar sólo la prueba reservada no cambia propuestas, promociones ni versión elegida", counterfactual.every(([a, b]) => trajectory(a) === trajectory(b) && a.active.id === b.active.id), counterfactual.map(([a, b]) => `${a.mode}: prueba ${a.finalTest.toFixed(2)} → ${b.finalTest.toFixed(2)} con otra prueba`).join(" · "));
const A = runLoop({ mode: "A", seed: 3 });
const B = runLoop({ mode: "B", seed: 3 });
check("semillas compatibles: el primer ciclo propone lo mismo", A.cycles[0].proposal === B.cycles[0].proposal && A.cycles[0].parent === B.cycles[0].parent);
check("el bucle no toca θ del modelo base", paramPrint(params) === loopPrint);

const devTasks = makeSplit(SPLITS.dev.base, SPLITS.dev.count);
const failingReports = devTasks.map((task) => ({ task, run: runTask(task, VERSIONS.v0) })).filter((x) => !x.run.success).map(({ task, run }) => reportOf(task, run, "v0"));
const seenBy = (genome) => analyse(failingReports, genome);
const blind = seenBy(VERSIONS.v0);
const sighted = seenBy(VERSIONS.v1);
check("analista v0 no ve ningún diagnóstico; v1 sí (mismos informes)", blind.visible === 0 && sighted.visible > 0, `${blind.visible} frente a ${sighted.visible} de ${sighted.total} líneas de diagnóstico`);
const parent = { id: "v0", genome: { ...VERSIONS.v0, weights: { ...VERSIONS.v0.weights } } };
const pBlind = propose(parent, blind, makeRng(9), new Set());
const pSighted = propose(parent, sighted, makeRng(9), new Set());
check("la propuesta sale de lo visible: sin diagnóstico es aleatoria, con diagnóstico es dirigida", pBlind.rule === "aleatoria" && pSighted.rule !== "aleatoria" && pSighted.note !== pBlind.note, `${pBlind.note} · ${pSighted.note}`);
const stripped = failingReports.map((lines) => Object.assign(lines.map((e) => (e.tags.diag ? { ...e, text: "DEBUG diag" } : e)), { source: lines.source }));
const pStripped = propose(parent, analyse(stripped, VERSIONS.v1), makeRng(9), new Set());
check("contrafactual: borrar el texto del diagnóstico vuelve aleatoria la propuesta", pStripped.rule === "aleatoria");
const bDirected = grid.filter((o) => o.run.mode === "B").flatMap((o) => o.run.cycles).filter((c) => c.rule && c.rule !== "aleatoria").length;
const aDirected = grid.filter((o) => o.run.mode === "A").flatMap((o) => o.run.cycles).filter((c) => c.rule && c.rule !== "aleatoria").length;
check("en A (analista v0 fijo) ninguna propuesta es dirigida; en B, tras promover, sí", aDirected === 0 && bDirected > 0, `A ${aDirected} · B ${bDirected} propuestas dirigidas`);

for (const [name, sc] of Object.entries(SCENARIOS)) {
  const r = runScenario(name).result;
  const other = name === "diversidad" ? runScenario(name, { explore: 0.5 }).result : null;
  check(`escenario «${sc.label}»: lo que narra se cumple en la corrida`, sc.holds(r, other), sc.lesson(r).slice(0, 90));
}
const repA = runLoop({ mode: "A", seed: 3 });
check("bucle reproducible", fingerprint(repA.cycles.map((c) => c.val ? c.val.candidate : -1)) === fingerprint(A.cycles.map((c) => c.val ? c.val.candidate : -1)));

const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.name}${r.detail ? `  (${r.detail})` : ""}`);
console.log(`\n${results.length - failed.length}/${results.length} verificaciones correctas`);
export { results };
if (failed.length) process.exit(1);
