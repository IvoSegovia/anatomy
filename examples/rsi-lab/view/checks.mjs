import { forward, prefillCache, paramPrint, generate, initParams } from "../model/transformer.mjs";
import { examplesOf, TRAIN_TEXT, headOf, lossAndGrad, adamStep, adamInit, flatHead, ADAM } from "../model/train.mjs";
import { runReflection } from "../model/reflection.mjs";
import { softmax } from "../model/linalg.mjs";
import { gradLogPi } from "../model/rl.mjs";
import { SPLITS, makeSplit, observeRuns } from "../model/agent.mjs";
import { runLoop } from "../model/loop.mjs";

export function liveChecks(store) {
  const out = [];
  const check = (name, ok, detail = "") => out.push({ name, ok: !!ok, detail });
  const params = store.params0;
  const before = paramPrint(params);
  const ids = store.ids();
  const tr = forward(params, ids);
  let mask = true;
  let row = 0;
  let dims = true;
  for (const block of tr.blocks)
    for (const head of block.heads) {
      if (head.Q.length !== ids.length || head.Q[0].length !== 4 || head.A[0].length !== ids.length) dims = false;
      head.A.forEach((r, i) => {
        r.forEach((v, j) => j > i && v !== 0 && (mask = false));
        row = Math.max(row, Math.abs(r.reduce((t, v) => t + v, 0) - 1));
      });
    }
  check(`máscara causal: peso 0 en el futuro (${ids.length} tokens actuales)`, mask);
  check("cada fila de A suma 1", row < 1e-12, `error máx ${row.toExponential(1)}`);
  check("dimensiones Q, K, V, A coherentes con n", dims && tr.X0[0].length === 8 && tr.logits.length === 16);
  check("p(siguiente) suma 1", Math.abs(tr.probs.reduce((t, v) => t + v, 0) - 1) < 1e-12);
  const { last } = prefillCache(params, ids);
  check("caché KV = pasada completa", Math.max(...last.logits.map((v, i) => Math.abs(v - tr.logits[i]))) < 1e-12);
  generate(params, ids, 2, { temperature: 0.8, seed: 3 });
  check("inferencia y muestreo no cambian θ", paramPrint(params) === before, before);
  check("θ coincide con la inicialización de semilla 7", paramPrint(initParams()) === before);
  const fd = store.finiteDiff();
  check("gradiente = diferencias finitas (160 parámetros)", fd.worst < 1e-6, `error rel. ${fd.worst.toExponential(1)}`);
  const train = examplesOf(params, TRAIN_TEXT);
  let head = headOf(params);
  let state = adamInit();
  const ref = flatHead(head);
  const m = ref.map(() => 0);
  const v = ref.map(() => 0);
  let err = 0;
  for (let t = 1; t <= 3; t++) {
    const g = flatHead(lossAndGrad(head, train).grad);
    for (let i = 0; i < ref.length; i++) {
      m[i] = ADAM.beta1 * m[i] + (1 - ADAM.beta1) * g[i];
      v[i] = ADAM.beta2 * v[i] + (1 - ADAM.beta2) * g[i] * g[i];
      ref[i] -= (0.05 * (m[i] / (1 - ADAM.beta1 ** t))) / (Math.sqrt(v[i] / (1 - ADAM.beta2 ** t)) + ADAM.eps);
    }
    const step = adamStep(head, lossAndGrad(head, train).grad, state, 0.05);
    head = step.head;
    state = step.state;
    err = Math.max(err, ...flatHead(head).map((x, i) => Math.abs(x - ref[i])));
  }
  check("Adam = referencia escalar (3 pasos)", err < 1e-12, `dif ${err.toExponential(1)}`);
  runReflection();
  check("reflexión: θ sin cambios", paramPrint(params) === before);
  const theta = [0.2, -0.4, 0.6, 0];
  const g = gradLogPi(theta, 2);
  const h = 1e-6;
  const plus = [...theta];
  plus[1] += h;
  const minus = [...theta];
  minus[1] -= h;
  const num = (Math.log(softmax(plus)[2]) - Math.log(softmax(minus)[2])) / (2 * h);
  check("∇ log π = e_a − π", Math.abs(num - g[1]) < 1e-8);
  const seeds = Object.values(SPLITS).map((s) => new Set(makeSplit(s.base, s.count).map((t) => t.seed)));
  check("particiones disjuntas", seeds.every((a, i) => seeds.every((b, j) => i === j || [...a].every((x) => !b.has(x)))));
  const order = [];
  const stop = observeRuns((task) => order.push(task.seed >= SPLITS.test.base && task.seed < SPLITS.test.base + 100 ? "prueba" : "otra"));
  let seedsOk = true;
  const run = runLoop({ mode: "B", seed: 2, budget: 300, probe: { propose: (input) => (seedsOk = seedsOk && input.reportSeeds.every((s) => s >= SPLITS.dev.base && s < SPLITS.dev.base + SPLITS.dev.count)), freeze: () => order.push("fijada") } });
  stop();
  const fixedAt = order.indexOf("fijada");
  check("ruta real: la prueba reservada sólo se ejecuta tras fijar la versión final", fixedAt >= 0 && order.slice(0, fixedAt).every((x) => x !== "prueba") && order.slice(fixedAt).includes("prueba"));
  check("ruta real: el proponente sólo recibe informes de desarrollo", seedsOk && run.ledger.search <= 300, `${run.ledger.search}/300 ejecuciones de búsqueda`);
  return out;
}
