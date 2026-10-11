// Capítulo 6 — Algoritmos que pueden contribuir a la mejora (tres estaciones).
import { baseVisibility, explode, moduleCamera } from "../common.mjs";
import { f2, f3, T, esc, table, lineChart, barList, pct1, prov } from "../helpers.mjs";
import { el } from "../ui.mjs";
import { ACTIONS } from "../../model/rl.mjs";
import { softmax } from "../../model/linalg.mjs";
import { show as showProgram, pack, HOLDOUT_SEQS, TRAIN_SEQS, BASELINES, scoreOn } from "../../model/evo.mjs";
import { paramPrint } from "../../model/transformer.mjs";

const stationCam = (id) => () => moduleCamera([id], 18, { area: { left: 430 }, elevation: 38 });

function reflectionState(ctx, e) {
  const { log } = ctx.store.reflection();
  // eventos: 1 intento1, 2 pruebas1, 3 nota1, 4 intento2, 5 pruebas2, 6 nota2, 7 intento3, 8 pruebas3
  const attempt = Math.min(3, Math.floor((Math.max(1, e) - 1) / 3) + 1);
  const phase = (Math.max(1, e) - 1) % 3; // 0 intento, 1 pruebas, 2 nota
  const entry = log[attempt - 1];
  const notes = Math.min(log.length - 1, attempt - 1 + (phase === 2 ? 1 : 0));
  return { log, attempt, phase, entry, notes };
}

export const chapter6 = {
  title: "Algoritmos que pueden contribuir a la mejora",
  question: "¿Qué cambia exactamente en cada método: el contexto, una política o un programa?",
  setup(ctx) {
    baseVisibility(ctx, { rack: false });
    explode(ctx, 0);
    ctx.theta(ctx.store.print0, "sin cambios");
    ctx.state("a-gen", {});
    ctx.state("a-tests", {});
    ctx.state("a-memory", {});
    ctx.state("b-policy", {});
    ctx.state("b-batch", {});
    ctx.state("c-archive", {});
    ctx.state("c-bins", {});
  },
  desk(ctx) {
    ctx.desk("Estaciones", (desk) => {
      const alphaVal = el("span", { class: "val" }, ctx.user.rlAlpha.toFixed(2));
      const alpha = el("input", { type: "range", min: "0.1", max: "4", step: "0.1", value: String(ctx.user.rlAlpha), "aria-label": "Tasa de aprendizaje α de la política (estación B)" });
      alpha.addEventListener("input", () => {
        ctx.user.rlAlpha = Number(alpha.value);
        alphaVal.textContent = ctx.user.rlAlpha.toFixed(2);
        ctx.refresh();
      });
      const per = el("div", { class: "seg", role: "group", "aria-label": "Presupuesto por candidata" });
      [1, 2, 4, 8].forEach((n) => {
        const b = el("button", { "aria-pressed": ctx.user.evoPer === n ? "true" : "false" }, String(n));
        b.addEventListener("click", () => {
          ctx.user.evoPer = n;
          per.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
          ctx.refresh();
        });
        per.append(b);
      });
      const tempVal = el("span", { class: "val" }, ctx.user.evoTemp);
      const temp = el("input", { type: "range", min: "-2.7", max: "-0.5", step: "0.05", value: String(Math.log10(ctx.user.evoTemp)), "aria-label": "Temperatura de selección de padres (estación C)" });
      temp.addEventListener("input", () => {
        ctx.user.evoTemp = Number((10 ** Number(temp.value)).toPrecision(2));
        tempVal.textContent = ctx.user.evoTemp;
        ctx.refresh();
      });
      desk.append(
        el("div", { class: "note" }, "B · REINFORCE"),
        el("div", { class: "row" }, el("label", {}, "α (política)"), alpha, alphaVal),
        el("div", { class: "note" }, "C · búsqueda evolutiva (presupuesto total fijo: 192 evaluaciones)"),
        el("div", { class: "row" }, el("label", {}, "secuencias por candidata"), per),
        el("div", { class: "row" }, el("label", {}, "temperatura de selección"), temp, tempVal),
        el("div", { class: "note" }, "Temperatura baja: aprovechar (padres casi siempre el mejor). Alta: explorar (padres del archivo al azar)."),
      );
    });
  },
  beats: [
    {
      id: "6.1",
      dur: 7,
      scale: "lab",
      camera: () => moduleCamera(["estA", "estB", "estC"], 10, { area: { left: 0 } }),
      caption: "Tres estaciones con mecanismos distintos. <b>No</b> forman una secuencia obligatoria de RSI: cada una cambia una cosa diferente.",
      changed: {},
      pose(ctx) {
        ctx.tag("lbA", "estA", "A · reflexión y herramientas", { dz: 30, cls: "name" });
        ctx.tag("lbB", "estB", "B · aprendizaje por refuerzo", { dz: 30, cls: "name" });
        ctx.tag("lbC", "estC", "C · búsqueda evolutiva de programas", { dz: 30, cls: "name" });
      },
    },
    {
      id: "6.2",
      dur: 20,
      events: 8,
      scale: "lab",
      camera: stationCam("estA"),
      caption: (ctx) => {
        const { attempt, phase, entry } = reflectionState(ctx, ctx.event);
        if (phase === 0) return `<b>A · Intento ${attempt}</b>: una solución <b>guionada</b> (escrita de antemano) entra al generador.`;
        if (phase === 1) return `El ejecutor corre las 4 pruebas <b>de verdad</b>: ${entry.passed}/4 correctas.`;
        return "Se observa el error y se escribe una <b>nota en memoria</b> para el siguiente intento. θ no cambia.";
      },
      changed: (ctx) => ({ contexto: "cambió (memoria)", pesos: "fijo" }),
      more: `<p>Como en Reflexion (Shinn et al., 2023), la retroalimentación se guarda como texto en una memoria que entra al contexto del siguiente intento, sin actualizar pesos. Aquí los intentos son guionados y la nota es una plantilla que resume la prueba fallida: no hay un LLM. Lo que sí se ejecuta son las pruebas.</p><p>La huella de θ se comprueba antes y después: idéntica.</p>`,
      refs: ["reflexion"],
      pose(ctx, t, e) {
        const { log, attempt, phase, entry, notes } = reflectionState(ctx, e);
        ctx.state("a-gen", { attempt });
        ctx.state("a-tests", { results: phase >= 1 ? entry.results.map((r) => r.ok) : [] });
        ctx.state("a-memory", { notes });
        ctx.focus(["a-gen", "a-tests", "a-memory", "a-theta"]);
        ctx.tag("lb-gen", "a-gen", "generador (guionado)", { dz: 14, role: "g" });
        ctx.tag("lb-tests", "a-tests", "ejecutor de pruebas", { dz: 12, role: phase >= 1 ? (entry.passed === 4 ? "ok" : "bad") : "" });
        ctx.tag("lb-mem", "a-memory", `memoria · ${notes} nota${notes === 1 ? "" : "s"}`, { dz: 10, role: "in" });
        ctx.tag("lb-th", "a-theta", "θ congelado", { dz: 10, role: "off" });
        const rows = phase >= 1 ? entry.results.map((r) => `${r.ok ? '<span class="ok-t">✓</span>' : '<span class="bad-t">✗</span>'} promedio(${esc(JSON.stringify(r.entrada))}) → ${Number.isNaN(r.obtenido) ? "NaN" : esc(JSON.stringify(r.obtenido))} (esperado ${r.esperado})`).join("\n") : "";
        const memory = log[attempt - 1].memoryBefore.concat(phase === 2 && entry.note ? [entry.note] : []);
        ctx.panel("refl", {
          title: `Intento ${attempt} · propuesta guionada`,
          provKind: "local",
          provText: "pruebas ejecutadas",
          html: `<pre class="code">${esc(entry.source)}</pre>${rows ? `<div class="subst">${rows}</div>` : ""}<h4 style="margin-top:8px">memoria en el contexto</h4><div class="subst">${memory.length ? memory.map((m, i) => `${i + 1}. ${esc(m)}`).join("\n") : "(vacía)"}</div><div class="subst">θ antes ${ctx.store.print0} · θ ahora ${paramPrint(ctx.store.params0)}</div>`,
          width: 420,
        });
      },
    },
    {
      id: "6.3",
      dur: 20,
      events: 6,
      scale: "lab",
      camera: stationCam("estB"),
      caption: (ctx) =>
        [
          "<b>B · Lote</b>: la política π_θ elige 8 estrategias de lectura (acciones); cada episodio se ejecuta sobre una tarea de desarrollo.",
          "<b>Recompensa</b> R ∈ {0, 1}: el solucionador acertó (verde) o no (rojo).",
          "<b>Baseline</b> b: media móvil de lotes anteriores (no depende de las acciones de este lote). <b>Ventaja</b> Â = R − b.",
          "<b>Gradiente</b>: ĝ = media de Â·∇log π(a). Flechas naranjas: hacia dónde empuja a cada probabilidad.",
          "<b>Actualizar la política</b>: θ ← θ + α ĝ. Cambian las varillas violetas (θ) y con ellas las barras cian (π).",
          "Tras 30 actualizaciones, π se concentra en la estrategia con más recompensa esperada.",
        ][Math.max(0, ctx.event - 1)],
      changed: { pesos: "política: 4 parámetros", contexto: "fijo" },
      more: (ctx) => {
        const rl = ctx.store.rl();
        return `<p>π_θ(a) = softmax(θ)_a. Para la softmax, ∇_θ log π(a) = e_a − π: sube la acción tomada y baja las demás, en proporción a su probabilidad.</p><p>Con baseline independiente de la acción, E[∇log π(a)·b] = 0, así que el gradiente sigue insesgado y con menos varianza.</p><p>No confundir: <b>R</b> (recompensa observada), <b>Â</b> (ventaja: R − b) y <b>π(a)</b> (probabilidad).</p><p>Recompensa esperada de cada acción en las 16 tareas de desarrollo: ${rl.expected.map((v, a) => `${ACTIONS[a].label} ${v.toFixed(2)}`).join(" · ")} ${prov("local")}</p>`;
      },
      pose(ctx, t, e) {
        const rl = ctx.store.rl();
        const u = e >= 6 ? Math.max(1, Math.round(1 + Math.min(1, (t - 5 / 6) * 6) * 29)) : 1;
        const h = rl.history[u];
        const prev = rl.history[u - 1];
        const showBatch = e >= 1;
        const theta = e >= 5 ? h.theta : prev.theta;
        const pi = softmax(theta);
        ctx.state("b-policy", { theta, pi, grad: e >= 4 && e < 6 ? h.grad : null, best: rl.expected.indexOf(Math.max(...rl.expected)) });
        ctx.state("b-batch", { batch: showBatch ? h.batch.map((b) => ({ ...b, reward: e >= 2 ? b.reward : 1 })) : [] });
        ctx.state("b-baseline", { b: h.baselineUsed });
        ctx.focus(["b-policy", "b-batch", "b-baseline"]);
        ctx.tag("lb-theta", "b-policy", "θ (violeta) · π (cian)", { dz: 34, role: "w" });
        ctx.tag("lb-b", "b-baseline", `baseline b = ${f2(h.baselineUsed)}`, { dz: 14, role: "" });
        const rows = h.batch.map((b, i) => [i + 1, ACTIONS[b.action].label, e >= 2 ? b.reward : "·", e >= 3 ? f2(h.baselineUsed) : "·", e >= 3 ? `<span class="${b.advantage >= 0 ? "ok-t" : "bad-t"}">${f2(b.advantage)}</span>` : "·", e >= 4 ? `[${b.gradLog.map(f2).join(" ")}]` : "·"]);
        ctx.panel("rl", {
          title: `REINFORCE con baseline · actualización ${u}`,
          provKind: "local",
          html: `<div class="formula" style="font-size:13.5px">${T("ĝ", "g", "", e === 4)} = ¹⁄ₙ Σ ${T("Â", "", "", e === 3)}<sub>i</sub> ∇<sub>θ</sub> log ${T("π", "in")}<sub>θ</sub>(a<sub>i</sub>), &nbsp; ${T("θ", "w", "", e === 5)} ← θ + α ĝ</div>${e < 6 ? table(["#", "acción", "R", "b", "Â = R − b", "∇log π(a)"], rows) : ""}${e >= 4 ? `<div class="subst">ĝ = [${h.grad.map(f3).join(" ")}]</div>` : ""}<div style="margin-top:6px">${barList(ACTIONS.map((a, k) => ({ label: a.label, value: pi[k], text: f2(pi[k]), role: "in" })))}</div>${e >= 6 ? lineChart(ACTIONS.map((_, k) => ({ values: rl.history.map((x) => x.pi[k]), cls: k === 2 ? "tr" : "A" })), { w: 380, h: 110, xLabel: "actualización", yLabel: "π(a)", yMax: 1, cursor: u, xTicks: [0, 10, 20, 30] }) : ""}`,
          width: 430,
        });
      },
    },
    {
      id: "6.4",
      dur: 10,
      events: 2,
      scale: "lab",
      camera: stationCam("estB"),
      caption: (ctx) => (ctx.event <= 1 ? "<b>PPO</b> (ampliación opcional): reutiliza el mismo lote varias épocas, con la razón r = π_θ(a)/π_old(a)." : "El objetivo <b>recortado</b> min(r·Â, clip(r, 1−ε, 1+ε)·Â) anula el gradiente cuando r ya se alejó más de ε = 0.2 en la dirección favorable."),
      changed: { pesos: "política: 4 parámetros" },
      more: `<p>L^CLIP(θ) = E[min(r(θ)Â, clip(r(θ), 1−ε, 1+ε)Â)] (Schulman et al., 2017). Aquí se implementa sobre la misma política de 4 parámetros, con 4 épocas sobre un lote de 8 episodios. Su gradiente se comprueba con diferencias finitas en verify.mjs.</p>`,
      refs: ["ppo"],
      pose(ctx, t, e) {
        const { batch, update } = ctx.store.ppo();
        const epoch = e <= 1 ? 0 : 3;
        const ep = update.epochs[epoch];
        ctx.state("b-policy", { theta: ep.theta, pi: softmax(ep.theta) });
        ctx.state("b-batch", { batch });
        ctx.focus(["b-policy", "b-batch"]);
        const rows = ep.per.map((b, i) => [i + 1, ACTIONS[b.action].label, b.reward, f2(b.advantage), f3(b.ratio), b.clipped ? '<span class="g-t">recortado (∇ = 0)</span>' : "activo"]);
        ctx.panel("ppo", { title: `PPO · época ${epoch + 1} de 4 · ε = 0.2`, provKind: "local", html: `<div class="formula" style="font-size:13.5px">L<sup>CLIP</sup> = ¹⁄ₙ Σ min( r<sub>i</sub>Â<sub>i</sub>, clip(r<sub>i</sub>, 0.8, 1.2) Â<sub>i</sub> )</div>${table(["#", "acción", "R", "Â", "r = π/π_old", "término"], rows)}<div class="subst">objetivo L^CLIP = ${f3(ep.objective)}</div>`, width: 430 });
      },
    },
    {
      id: "6.5",
      dur: 20,
      events: 5,
      scale: "lab",
      camera: stationCam("estC"),
      caption: (ctx) => {
        const evo = ctx.store.evo();
        return [
          "<b>C · Semilla</b>: un planificador de trabajos que asigna cada trabajo a la máquina con <b>más</b> espacio libre («peor ajuste»).",
          "<b>Proponer variantes</b>: mutaciones aleatorias del programa (sin LLM). Cada una se evalúa en secuencias de trabajos.",
          `<b>Archivo de diversidad</b>: se guarda la mejor de cada celda (tamaño × variables usadas). ${evo.archive.length} celdas ocupadas.`,
          "<b>Presupuesto por candidata</b>: con pocas secuencias por candidata, la mejor puntuación de entrenamiento es optimista (ruido + selección).",
          "Comparación honesta en <b>secuencias reservadas</b> que la búsqueda no vio.",
        ][Math.max(0, ctx.event - 1)];
      },
      changed: { codigo: "programa candidato", infra: "planificador (si se adoptara)" },
      more: (ctx) => {
        const base = ctx.store.evoBaselines();
        return `<p>Programas: expresiones prioridad(s, r, k) con s = tamaño del trabajo, r = espacio libre de la máquina, k = índice de la máquina. Se elige la máquina con mayor prioridad entre las que tienen sitio.</p><p>Exceso de máquinas sobre la cota ⌈Σs/100⌉ en 24 secuencias reservadas: ${Object.entries(base).map(([k, v]) => `${k} ${pct1(v)}`).join(" · ")}. ${prov("local")}</p><p>Seleccionar la mejor respuesta por puntuación <b>no</b> es aprendizaje por refuerzo: aquí no se actualiza ninguna política.</p>`;
      },
      pose(ctx, t, e) {
        const evo = ctx.store.evo();
        const N = evo.events.length;
        const upto = e <= 1 ? 1 : e === 2 ? Math.max(2, Math.round(Math.min(1, t * 5 - 1) * N * 0.5)) : N;
        const seen = evo.events.slice(0, upto);
        const elites = new Map();
        for (const ev of seen) if (ev.accepted) elites.set(ev.cell, { cell: ev.cell, score: ev.score, fresh: ev === seen[seen.length - 1] });
        const best = [...elites.values()].sort((a, b) => a.score - b.score)[0];
        if (best) best.best = true;
        const current = seen[seen.length - 1];
        const fills = pack(current.program, HOLDOUT_SEQS[0]).fill;
        ctx.state("c-archive", { elites: [...elites.values()] });
        ctx.state("c-bins", { fills });
        ctx.focus(["c-archive", "c-bins"]);
        ctx.tag("lb-arch", "c-archive", "archivo MAP-Elites", { dz: 18, role: "g" });
        ctx.tag("lb-bins", "c-bins", "máquinas (llenado)", { dz: 18, role: "in" });
        const base = ctx.store.evoBaselines();
        const series = [];
        let bestSoFar = Infinity;
        evo.events.forEach((ev) => {
          if (ev.score !== null) bestSoFar = Math.min(bestSoFar, ev.score);
          series.push(bestSoFar);
        });
        const html = `<div class="subst">candidata ${upto}/${N} · ${esc(current.mutation)}\nprioridad(s, r, k) = <b>${esc(current.text)}</b>\npuntuación (exceso, secuencias de entrenamiento) = ${current.score === null ? "—" : pct1(current.score)} ${current.accepted ? '<span class="ok-t">→ archivada</span>' : '<span class="off-t">→ descartada</span>'}</div>
          ${lineChart([{ values: series.slice(0, upto).concat(new Array(N - upto).fill(NaN)), cls: "B" }], { w: 380, h: 110, xLabel: "candidata", yLabel: "mejor exceso (entr.)", yMin: 0, yMax: 0.25, xTicks: [0, Math.floor(N / 2), N - 1] })}
          ${e >= 4 ? `<div class="subst">mejor en entrenamiento: ${pct1(evo.best.score)} con ${ctx.user.evoPer} secuencia(s)/candidata\nmisma candidata en reserva: <b>${pct1(evo.bestHoldout)}</b>${evo.best.score < evo.bestHoldout - 0.005 ? '  <span class="g-t">(optimismo por selección)</span>' : ""}</div>` : ""}
          ${e >= 5 ? table(["programa", "exceso en reserva"], [["peor ajuste (semilla)", pct1(base["peor ajuste"])], ["primer ajuste", pct1(base["primer ajuste"])], ["mejor ajuste", pct1(base["mejor ajuste"])], [`<b>mejor encontrado</b>: ${esc(showProgram(evo.best.program))}`, `<b>${pct1(evo.bestHoldout)}</b>`]]) : ""}`;
        ctx.panel("evo", { title: `Búsqueda evolutiva · ${ctx.user.evoPer} sec./candidata · T = ${ctx.user.evoTemp}`, provKind: "local", html, width: 430 });
      },
    },
    {
      id: "6.6",
      dur: 8,
      scale: "lab",
      camera: () => moduleCamera(["estA", "estB", "estC"], 10, { area: { left: 430 } }),
      caption: "Qué cambió en cada estación: <b>A</b> contexto y memoria · <b>B</b> los pesos de una política pequeña · <b>C</b> un programa. Ninguna tocó θ del Transformer.",
      changed: { contexto: "A", pesos: "B: política", codigo: "C: programa" },
      pose(ctx) {
        ctx.panel("sum", {
          title: "Qué cambia en cada método",
          html: table(["estación", "cambia", "θ del modelo"], [["A · reflexión", "contexto / memoria", "fijo"], ["B · REINFORCE / PPO", "parámetros de una política", "fijo"], ["C · evolución", "código de un programa", "fijo"]]) + `<div class="subst">• Elegir una respuesta por puntuación no es RL si no se actualiza una política.\n• Generar datos sintéticos no modifica pesos hasta que alguien entrena con ellos.\n• Ninguno de estos métodos es, por sí solo, automejora recursiva.</div>`,
          width: 420,
        });
      },
    },
  ],
};
