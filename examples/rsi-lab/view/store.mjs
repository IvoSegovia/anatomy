// Estado común: parámetros que el usuario puede cambiar + cálculos memoizados.
// Todas las vistas leen de aquí; ninguna vista modifica un resultado calculado.
import { initParams, forward, paramPrint, paramCount, generate, prefillCache, invalidateFrom, temperatureProbs, argmax, CONFIG } from "../model/transformer.mjs";
import { tokenize, VOCAB } from "../model/tokenizer.mjs";
import { runTraining, finiteDifferenceCheck, examplesOf, TRAIN_TEXT, VALID_TEXT, headOf, withHead, headPrint, headSize } from "../model/train.mjs";
import { runReflection } from "../model/reflection.mjs";
import { runReinforce, ppoUpdate, sampleBatch, rewardTable, ACTIONS, nextBaseline } from "../model/rl.mjs";
import { runEvolution, BASELINES, scoreOn, HOLDOUT_SEQS, show as showProgram, pack, SEEDS } from "../model/evo.mjs";
import { SPLITS, makeSplit, VERSIONS, evaluate, pairedBootstrap, verdictOf, runTask, compositeOf, promotionDecision, pseudocodeOf, BUDGET } from "../model/agent.mjs";
import { runLoop } from "../model/loop.mjs";
import { runScenario, SCENARIOS, CONTROLS, optionsOf } from "../model/limits.mjs";
import { makeRng } from "../model/rng.mjs";

export const DEFAULTS = {
  text: "def f(x):",
  tokens: null, // ids si el usuario cambia tokens directamente
  head: 0,
  block: 0,
  row: 3,
  temperature: 0.8,
  sampleSeed: 11,
  optimizer: "sgd",
  eta: 0.5,
  trainStep: 1,
  example: 0,
  rlMode: "reinforce",
  rlAlpha: 1.0,
  evoPer: 4,
  evoTemp: 0.03,
  task: 14,
  versionA: "v0",
  versionB: "v1",
  loopSeed: 2,
  loopMode: "B",
  limits: { budget: 900, noise: 0, diversity: 4, nVal: 40, explore: 0.3, criterion: "estricto" },
  scenario: "base",
  rolledBack: false,
  activeVersion: "v0",
  loops: { 1: true, 2: true, 3: true },
};

export function makeStore() {
  const user = JSON.parse(JSON.stringify(DEFAULTS));
  const memo = new Map();
  const cached = (name, key, compute) => {
    const k = `${name}|${key}`;
    if (!memo.has(k)) {
      memo.set(k, compute());
      if (memo.size > 120) memo.delete(memo.keys().next().value);
    }
    return memo.get(k);
  };
  const params0 = initParams();
  const print0 = paramPrint(params0);

  const store = {
    user,
    params0,
    print0,
    VOCAB,
    CONFIG,
    restore(next) {
      for (const key of Object.keys(user)) delete user[key];
      Object.assign(user, JSON.parse(JSON.stringify(next)));
    },
    ids() {
      if (user.tokens) return user.tokens;
      return tokenize(user.text).map((piece) => piece.id).filter((id) => id >= 0).slice(0, CONFIG.maxLen);
    },
    pieces: () => tokenize(user.text),
    trace() {
      const ids = store.ids();
      return cached("trace", ids.join(","), () => forward(params0, ids));
    },
    cache() {
      const ids = store.ids();
      return cached("cache", ids.join(","), () => prefillCache(params0, ids));
    },
    generation() {
      const ids = store.ids();
      return cached("gen", `${ids.join(",")}|${user.temperature}|${user.sampleSeed}`, () => ({
        greedy: generate(params0, ids, 3, { temperature: 0 }),
        sampled: generate(params0, ids, 3, { temperature: user.temperature, seed: user.sampleSeed }),
      }));
    },
    tempProbs() {
      return temperatureProbs(store.trace().logits, user.temperature);
    },
    training(opt = user.optimizer, eta = user.eta) {
      return cached("train", `${opt}|${eta}`, () => runTraining(params0, { optimizer: opt, eta, steps: 40 }));
    },
    finiteDiff() {
      return cached("fd", "0", () => {
        const train = examplesOf(params0, TRAIN_TEXT);
        return finiteDifferenceCheck(headOf(params0), train);
      });
    },
    reflection: () => cached("refl", "0", () => runReflection()),
    rl() {
      return cached("rl", `${user.rlAlpha}`, () => runReinforce({ alpha: user.rlAlpha }));
    },
    ppo() {
      return cached("ppo", "0", () => {
        const table = rewardTable();
        const theta = [0, 0, 0, 0];
        const batch = sampleBatch(theta, table, { n: 8, seed: 5001 });
        return { table, batch, update: ppoUpdate(theta, batch, 0.5, { alpha: 1.0, eps: 0.2, epochs: 4 }) };
      });
    },
    evo() {
      return cached("evo", `${user.evoPer}|${user.evoTemp}`, () => runEvolution({ perCandidate: user.evoPer, temperature: user.evoTemp }));
    },
    evoBaselines: () => cached("evob", "0", () => Object.fromEntries([...Object.entries(BASELINES), ["peor ajuste", SEEDS.peor]].map(([name, p]) => [name, scoreOn(p, HOLDOUT_SEQS)]))),
    splits: () => cached("splits", "0", () => Object.fromEntries(Object.entries(SPLITS).map(([k, s]) => [k, makeSplit(s.base, s.count)]))),
    evals() {
      return cached("evals", "0", () => {
        const sets = store.splits();
        const out = {};
        for (const v of Object.keys(VERSIONS)) out[v] = { dev: evaluate(VERSIONS[v], sets.dev), valid: evaluate(VERSIONS[v], sets.valid), test: evaluate(VERSIONS[v], sets.test) };
        return out;
      });
    },
    compare(a, b, split = "valid") {
      return cached("cmp", `${a}|${b}|${split}`, () => {
        const ev = store.evals();
        const ci = pairedBootstrap(ev[a][split], ev[b][split]);
        return { ci, verdict: verdictOf(ci), decision: promotionDecision(ev[a][split], ev[b][split], ci) };
      });
    },
    loop() {
      return cached("loop", `${user.loopMode}|${user.loopSeed}`, () => runLoop({ mode: user.loopMode, seed: user.loopSeed }));
    },
    loopCompare() {
      return cached("loopcmp", "0", () => {
        const rows = [];
        for (let seed = 1; seed <= 12; seed++) rows.push({ seed, A: summary(runLoop({ mode: "A", seed })), B: summary(runLoop({ mode: "B", seed })) });
        return rows;
      });
    },
    // Versión por partes (no bloquea la interfaz): una semilla por tarea.
    loopCompareAsync(done) {
      if (memo.has("loopcmp|0")) return done(memo.get("loopcmp|0"));
      if (store._pending) return store._pending.push(done);
      store._pending = [done];
      const rows = [];
      let seed = 1;
      const step = () => {
        rows.push({ seed, A: summary(runLoop({ mode: "A", seed })), B: summary(runLoop({ mode: "B", seed })) });
        seed += 1;
        if (seed <= 12) setTimeout(step, 0);
        else {
          memo.set("loopcmp|0", rows);
          const list = store._pending;
          store._pending = null;
          list.forEach((fn) => fn(rows));
        }
      };
      setTimeout(step, 0);
    },
    loopReady: () => memo.has("loopcmp|0"),
    limits() {
      const values = user.limits;
      return cached("limits", JSON.stringify(values) + user.scenario, () => {
        const scenario = SCENARIOS[user.scenario];
        return runLoop({ ...optionsOf(values), mode: scenario.mode, seed: scenario.seed });
      });
    },
    scenarioValues: (name) => ({ ...SCENARIOS[name].values }),
  };
  return store;
}

function summary(run) {
  return {
    cycles: run.cycles.length,
    spent: run.spent,
    startTest: run.startTest,
    finalTest: run.finalTest,
    startAudit: run.startAudit,
    finalAudit: run.finalAudit,
    promotions: run.promotions,
    valid: run.validImprovements,
    costPer: run.costPerImprovement,
    quality: run.meanQuality,
    audits: run.cycles.map((c) => c.activeAudit),
  };
}

export { VOCAB, ACTIONS, VERSIONS, BUDGET, SCENARIOS, CONTROLS, pseudocodeOf, showProgram, pack, HOLDOUT_SEQS, headSize, paramCount, argmax, invalidateFrom, nextBaseline, compositeOf, runTask, makeRng, withHead, headPrint };
