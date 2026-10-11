import { baseVisibility, explode, mainCamera, moduleCamera, labCamera, rackCamera, M } from "../common.mjs";
import { f2, esc, table, pct, lineChart, prov } from "../helpers.mjs";
import { el } from "../ui.mjs";
import { SCENARIOS, CONTROLS, CRITERIA } from "../../model/limits.mjs";
import { pseudocodeOf } from "../../model/agent.mjs";

function loadScenario(ctx, name) {
  ctx.user.scenario = name;
  ctx.user.limits = { ...ctx.user.limits, ...SCENARIOS[name].values, criterion: SCENARIOS[name].values.criterion || "estricto" };
  ctx.user.rolledBack = false;
  if (ctx.syncLimitsDesk) ctx.syncLimitsDesk();
}

function limitsPanel(ctx, { title, lesson, extra } = {}) {
  const run = ctx.store.limits();
  const vis = [];
  const aud = [run.startAudit];
  const visStart = run.cycles.length ? run.cycles[0].visibleActive : NaN;
  vis.push(visStart);
  for (const c of run.cycles) {
    vis.push(c.promoted ? c.visible : c.visibleActive ?? NaN);
    aud.push(c.activeAudit ?? aud[aud.length - 1]);
  }
  const n = vis.length;
  const marks = run.cycles.map((c, i) => (c.promoted ? { i: i + 1, v: aud[i + 1], color: c.auditAfter < c.auditBefore ? "#ff6a6a" : "#4fd383" } : null)).filter(Boolean);
  const visDelta = (vis[n - 1] ?? 0) - (vis[0] ?? 0);
  const audDelta = run.finalAudit - run.startAudit;
  const alarm = visDelta > 0.005 && audDelta < -0.005;
  const rolled = ctx.user.rolledBack;
  const criterion = ctx.user.limits.criterion || "estricto";
  const html = `${lineChart([{ values: vis, cls: "va" }, { values: aud, cls: "tr" }], { w: 420, h: 150, xLabel: "ciclo", yLabel: "puntuación", yMax: 1, marks, xTicks: [0, Math.floor((n - 1) / 2), n - 1] })}
    <div class="legend"><span style="color:#e7e8ea"><i style="background:none;border-top:2px dashed #e7e8ea;height:0"></i>visible (${esc(CRITERIA[criterion])})</span><span style="color:var(--c-in)"><i></i>auditoría independiente</span></div>
    ${table(["", "inicio", "final"], [["puntuación visible", f2(vis[0] ?? NaN), f2(vis[n - 1] ?? NaN)], ["auditoría (no la ve el bucle)", pct(run.startAudit), pct(run.finalAudit)], ["ciclos · promociones", "", `${run.cycles.length} · ${run.promotions}`], ["presupuesto gastado", "", `${run.spent} / ${ctx.user.limits.budget}`], ["consultas a la misma validación", "", run.maxValQueries], ["versiones en el archivo", "", run.archive.length]])}
    ${alarm ? `<div class="subst"><b class="bad-t">La puntuación visible mejora y la auditoría empeora.</b></div>` : ""}
    ${rolled ? `<div class="subst">Vuelta a la última versión válida <b>${esc(run.lastValid.id)}</b>: auditoría ${pct(run.lastValid.audit)} · prueba final (uso único) ${pct(run.lastValidTest)} frente a ${pct(run.finalTest)} de la versión descartada.</div>` : ""}
    ${lesson ? `<div class="subst">${esc(lesson)}</div>` : ""}
    ${extra ? extra(run) : ""}`;
  ctx.panel("limits", { title: title || "Mesa de límites", provKind: "sim", html, width: 450, dock: "right", top: 136 });
  ctx.state("evaluador", { value: Math.max(0, Math.min(1, vis[n - 1] ?? 0)), ok: !alarm && audDelta >= 0, fail: alarm });
  ctx.state("entorno", { budget: run.spent / ctx.user.limits.budget });
  ctx.state("datos", { open: "audit" });
  return { run, alarm };
}

const scenarioBeat = (id, name, caption, extra = {}) => ({
  id,
  dur: 9,
  scale: "lab",
  camera: () => moduleCamera(["evaluador", "datos", "entorno", "archivo"], 6, { area: { left: 330, right: 470 } }),
  caption,
  changed: { codigo: "cambia", evaluador: name === "metrica" ? "métrica imperfecta" : "fijo", datos: name === "dominio" ? "poca diversidad" : "fijo", infra: name === "presupuesto" ? "presupuesto corto" : "fijo" },
  enter(ctx) {
    loadScenario(ctx, name);
  },
  pose(ctx) {
    if (ctx.user.scenario !== name) loadScenario(ctx, name);
    ctx.focus(["evaluador", "datos", "entorno", "archivo"]);
    let extra;
    if (name === "diversidad") {
      const keep = ctx.user.limits.explore;
      ctx.user.limits = { ...ctx.user.limits, explore: 0.5 };
      const other = ctx.store.limits();
      ctx.user.limits = { ...ctx.user.limits, explore: keep };
      extra = (run) => `<h4 class="sub"><span>Misma semilla, explorando el archivo (0.5)</span>${prov("sim")}</h4><div class="subst">auditoría final: exploración ${keep} → ${pct(run.finalAudit)} · exploración 0.5 → ${pct(other.finalAudit)}</div>`;
    }
    limitsPanel(ctx, { title: SCENARIOS[name].label, lesson: SCENARIOS[name].lesson, extra });
  },
  ...extra,
});

const FINAL = [
  ["datos", "<b>Dato</b>: una tarea entra desde el cajón de desarrollo."],
  ["modelo", "<b>Activaciones</b>: el contexto se convierte en vectores y atención dentro del modelo (θ fijo)."],
  ["proponente", "<b>Propuesta</b>: el proponente analiza los registros y propone una variante del código."],
  ["entorno", "<b>Experimento</b>: la variante se ejecuta con un presupuesto definido."],
  ["evaluador", "<b>Evidencia</b>: el evaluador compara versiones sobre las mismas tareas, con un criterio explícito."],
  ["codigo", "<b>Cambio del sistema</b>: sólo si cumple el criterio, la variante pasa a estar activa."],
  ["proponente", "<b>Siguiente propuesta</b>: la versión activa participa en el próximo análisis. ¿Lo hace mejor? Hay que medirlo otra vez."],
];

export const chapter10 = {
  title: "Límites del bucle y cierre",
  question: "¿Qué puede salir mal en un bucle de automejora, y cómo se detecta?",
  setup(ctx) {
    baseVisibility(ctx, { rack: false, agent: true });
    explode(ctx, 0);
    ctx.show("ctx-lines", false);
    ctx.state("cart-v1", { slot: "active", role: "in" });
  },
  exit(ctx) {
    ctx.state("datos", {});
    ctx.state("entorno", {});
    ctx.state("evaluador", { value: 0 });
  },
  desk(ctx) {
    ctx.desk("Límites", (desk) => {
      const inputs = {};
      const vals = {};
      for (const [key, spec] of Object.entries(CONTROLS)) {
        const val = el("span", { class: "val" });
        vals[key] = val;
        let input;
        if (spec.options) {
          input = el("select", { "aria-label": spec.label, style: "background:var(--panel-2);border:1px solid var(--line-2);border-radius:4px" });
          spec.options.forEach((o) => input.append(el("option", { value: o }, String(o))));
        } else input = el("input", { type: "range", min: spec.min, max: spec.max, step: spec.step, "aria-label": `${spec.label} (${spec.unit})` });
        input.addEventListener(spec.options ? "change" : "input", () => {
          ctx.user.limits = { ...ctx.user.limits, [key]: Number(input.value) };
          ctx.user.rolledBack = false;
          val.textContent = input.value;
          ctx.refresh();
        });
        inputs[key] = input;
        desk.append(el("div", { class: "row" }, el("label", { title: spec.unit }, spec.label), input, val));
      }
      const crit = el("select", { "aria-label": "Criterio de promoción", style: "background:var(--panel-2);border:1px solid var(--line-2);border-radius:4px;max-width:100%" });
      for (const [k, v] of Object.entries(CRITERIA)) crit.append(el("option", { value: k }, `${k}: ${v}`));
      crit.addEventListener("change", () => {
        ctx.user.limits = { ...ctx.user.limits, criterion: crit.value };
        ctx.user.rolledBack = false;
        ctx.refresh();
      });
      desk.append(el("div", { class: "row" }, el("label", {}, "criterio"), crit));
      const scen = el("div", { class: "row" });
      for (const [k, v] of Object.entries(SCENARIOS)) {
        const b = el("button", { class: "btn" }, v.label);
        b.addEventListener("click", () => {
          loadScenario(ctx, k);
          ctx.refresh();
        });
        scen.append(b);
      }
      const back = el("button", { class: "btn warn" }, "volver a la última versión válida");
      back.addEventListener("click", () => {
        ctx.user.rolledBack = true;
        ctx.refresh();
      });
      desk.append(el("div", { class: "note" }, "Escenarios:"), scen, el("div", { class: "row" }, back), el("div", { class: "note" }, "Cada control tiene un efecto definido en model/limits.mjs. La velocidad de reproducción no cambia ningún resultado."));
      ctx.syncLimitsDesk = () => {
        for (const [key, input] of Object.entries(inputs)) {
          input.value = String(ctx.user.limits[key]);
          vals[key].textContent = String(ctx.user.limits[key]);
        }
        crit.value = ctx.user.limits.criterion || "estricto";
      };
      ctx.syncLimitsDesk();
    });
  },
  beats: [
    {
      id: "10.1",
      dur: 9,
      scale: "lab",
      camera: () => moduleCamera(["evaluador", "datos", "entorno", "archivo"], 6, { area: { left: 330, right: 470 } }),
      caption: "<b>Mesa de límites</b>: presupuesto, ruido del evaluador, diversidad de tareas, coste de validación y diversidad de candidatos. Cada control tiene un efecto definido en el modelo.",
      changed: { codigo: "cambia" },
      more: `<ul><li><b>Presupuesto</b>: ejecuciones de tareas disponibles para el bucle.</li><li><b>Ruido del evaluador</b>: probabilidad de invertir cada resultado de validación (pruebas inestables). La auditoría no tiene ruido.</li><li><b>Diversidad de tareas</b>: familias presentes en desarrollo y validación. La auditoría y la prueba tienen las 4.</li><li><b>Coste de validación</b>: tareas de validación por candidata.</li><li><b>Diversidad de candidatos</b>: probabilidad de elegir un padre del archivo distinto de la versión activa.</li></ul><p>Todo esto es una simulación conceptual: las reglas del proponente son inventadas. Las ejecuciones del banco y el criterio estadístico son reales.</p>`,
      enter(ctx) {
        loadScenario(ctx, "base");
      },
      pose(ctx) {
        ctx.focus(["evaluador", "datos", "entorno", "archivo"]);
        limitsPanel(ctx, { title: SCENARIOS[ctx.user.scenario].label, lesson: SCENARIOS[ctx.user.scenario].lesson });
      },
    },
    scenarioBeat("10.2", "sobreajuste", "<b>Sobreajuste al benchmark</b>: diez tareas ruidosas, consultadas una y otra vez y promoviendo con la estimación puntual. Lo visible sube por azar; la auditoría, no."),
    scenarioBeat("10.3", "metrica", "<b>Métrica imperfecta</b>: optimizar la densidad de líneas ERROR/TRACE premia descartar DEBUG… y con él la causa que el solucionador necesita."),
    scenarioBeat("10.4", "diversidad", "<b>Pérdida de diversidad</b>: sin explorar padres del archivo, la búsqueda se queda en un linaje."),
    scenarioBeat("10.5", "dominio", "<b>Regresión fuera del dominio</b>: validación con una sola familia de tareas. La puntuación visible <b>mejora</b> y la auditoría independiente <b>empeora</b>. Usa «volver a la última versión válida».", { events: 2, dur: 11, pose(ctx, t, e) {
      if (ctx.user.scenario !== "dominio") loadScenario(ctx, "dominio");
      ctx.user.rolledBack = e >= 2;
      ctx.focus(["evaluador", "datos", "entorno", "archivo", "codigo"]);
      limitsPanel(ctx, { title: SCENARIOS.dominio.label, lesson: SCENARIOS.dominio.lesson });
    } }),
    scenarioBeat("10.6", "presupuesto", "<b>Agotamiento del presupuesto</b>: cada ciclo cuesta análisis + validación; con poco presupuesto, no alcanza para probar una mejora."),
    {
      id: "10.7",
      dur: 9,
      scale: "lab",
      camera: () => moduleCamera(["codigo", "archivo", "evaluador"], 8, { area: { left: 330, right: 470 } }),
      caption: "Por eso se guarda un <b>archivo</b> y se audita con datos independientes: se puede <b>volver a la última versión válida</b> cuando lo visible y lo independiente divergen.",
      changed: { codigo: "vuelta atrás" },
      enter(ctx) {
        loadScenario(ctx, "dominio");
        ctx.user.rolledBack = true;
      },
      pose(ctx) {
        ctx.user.rolledBack = true;
        ctx.focus(["codigo", "archivo", "evaluador", "cart-v1"]);
        limitsPanel(ctx, {
          title: "Vuelta atrás",
          lesson: "Válida = promovida sin retroceder en la auditoría. La prueba final sigue reservada: se usa una vez, para informar.",
          extra: (run) => `<h4 class="sub"><span>Versión restaurada: ${esc(run.lastValid.id)}</span>${prov("local")}</h4><pre class="code">${esc(pseudocodeOf(run.lastValid.genome))}</pre>`,
        });
      },
    },
    {
      id: "10.8",
      dur: 20,
      events: 7,
      scale: "lab",
      camera: () => mainCamera(),
      caption: (ctx) => FINAL[Math.max(0, ctx.event - 1)][1],
      changed: (ctx) => [{}, { datos: "tarea" }, { contexto: "activaciones" }, { codigo: "propuesta" }, { infra: "ejecución" }, { evaluador: "evidencia" }, { codigo: "cambió" }, { codigo: "participa", contexto: "memoria" }][Math.max(0, ctx.event)] || {},
      pose(ctx, t, e) {
        const i = Math.max(0, e - 1);
        const [id] = FINAL[i];
        const next = FINAL[Math.min(FINAL.length - 1, i + 1)][0];
        ctx.state("datos", {});
        ctx.state("evaluador", { value: e >= 5 ? 0.78 : 0, ok: e >= 5 });
        ctx.focus([id, ...(id === "modelo" ? ["modelo-front"] : []), ...(id === "codigo" ? ["cart-v1"] : []), ...(id === "proponente" ? ["cart-an"] : [])]);
        const a = [M[id].plan.x + M[id].plan.w / 2, M[id].plan.y + M[id].plan.d / 2, M[id].h + 6];
        const b = [M[next].plan.x + M[next].plan.w / 2, M[next].plan.y + M[next].plan.d / 2, M[next].h + 6];
        const u = (t * 7) % 1;
        if (!ctx.still.matches) ctx.pulse(0, { path: [a, [a[0], a[1], a[2] + 30], [b[0], b[1], b[2] + 30], b], s: u, role: ["in", "in", "g", "g", "ok", "g", "hi"][i], lift: 0 });
        ctx.tag("fin-lbl", id, ["dato", "activaciones", "propuesta", "experimento", "evidencia", "cambio del sistema", "siguiente propuesta"][i], { dz: M[id].h + 14, cls: "name", role: ["in", "in", "g", "g", "ok", "g", ""][i] });
        if (ctx.followKey !== `${ctx.beat.id}-${i}`) {
          ctx.followKey = `${ctx.beat.id}-${i}`;
          ctx.follow(moduleCamera([id, next], 30, { area: { left: 0 } }));
        }
      },
    },
    {
      id: "10.9",
      dur: 10,
      scale: "lab",
      camera: () => labCamera(),
      camSeconds: 2.4,
      caption: "Tres preguntas comprobables para cualquier afirmación de automejora: <b>¿Qué cambió? ¿Qué evidencia lo respalda? ¿Ayuda a producir mejores cambios?</b>",
      changed: {},
      more: `<p>A lo largo del recorrido:</p><ul><li>Una operación matemática (atención, softmax) produce activaciones; no cambia pesos.</li><li>Entrenar cambia pesos; sólo se confía en la mejora si se valida con datos separados.</li><li>Un agente puede mejorar su código con el modelo congelado, si un criterio explícito lo respalda.</li><li>La recursión aparece cuando lo mejorado interviene en el proceso que mejora. Si eso acelera o frena la mejora es una pregunta empírica, no una consecuencia automática.</li></ul><p>No hay aquí ninguna curva de crecimiento exponencial: los resultados medidos muestran mejoras, estancamientos y retrocesos.</p>`,
      pose(ctx) {
        ctx.focus(null);
        ctx.panel("q", { title: "Preguntas comprobables", html: `<div class="formula" style="white-space:normal;font-size:17px;line-height:1.8">¿Qué cambió?<br>¿Qué evidencia lo respalda?<br>¿Ayuda a producir mejores cambios?</div>`, dock: "center", top: 120, width: 420 });
      },
    },
  ],
};
