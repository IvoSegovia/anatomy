import { baseVisibility, explode, moduleCamera, mainCamera } from "../common.mjs";
import { f2, f3, esc, table, pct, pct1, prov, sgn } from "../helpers.mjs";
import { el } from "../ui.mjs";
import { VERSIONS, pseudocodeOf, BUDGET, compositeOf, runTask } from "../../model/agent.mjs";
import { contextState, logPanelHtml, DEV_TASK } from "./c01.mjs";

const devTask = (ctx) => ctx.store.splits().dev[ctx.user.task ?? DEV_TASK];

function diffHtml(a, b) {
  const A = pseudocodeOf(VERSIONS[a]).split("\n");
  const B = pseudocodeOf(VERSIONS[b]).split("\n");
  const setA = new Set(A.slice(1));
  const setB = new Set(B.slice(1));
  const lines = [`<span class="hl">${esc(B[0])}</span>`];
  for (const line of A.slice(1)) if (!setB.has(line)) lines.push(`<span class="del">- ${esc(line)}</span>`);
  for (const line of B.slice(1)) lines.push(setA.has(line) ? `  ${esc(line)}` : `<span class="add">+ ${esc(line)}</span>`);
  return `<pre class="code">${lines.join("\n")}</pre>`;
}

function grid(runs, label) {
  const cells = runs.map((r) => `<span title="tarea ${r.seed} (${r.family}): ${r.success ? "acierto" : "fallo"}" style="display:inline-block;width:8px;height:8px;margin:1px;border-radius:1.5px;background:${r.success ? "var(--c-ok)" : "var(--c-bad)"};opacity:${r.success ? 0.9 : 0.75}"></span>`).join("");
  return `<div style="display:grid;grid-template-columns:34px 1fr;align-items:center;gap:6px;margin:3px 0"><span class="kv">${label}</span><span style="line-height:0">${cells}</span></div>`;
}

function compareHtml(ctx, a, b, { decision = true } = {}) {
  const ev = ctx.store.evals();
  const { ci, verdict } = ctx.store.compare(a, b);
  const va = ev[a].valid;
  const vb = ev[b].valid;
  const verdictCls = verdict === "mejora" ? "ok-t" : verdict === "regresión" ? "bad-t" : "off-t";
  return `${grid(va.runs, a)}${grid(vb.runs, b)}
    ${table(["", a, b], [["éxito (40 tareas)", pct(va.success), pct(vb.success)], ["cobertura de evidencia", pct(va.coverage), pct(vb.coverage)], ["coste (tokens/tarea)", va.cost.toFixed(1), vb.cost.toFixed(1)]])}
    <div class="subst">Δéxito = ${sgn(ci.mean)} · IC95 bootstrap pareado [${sgn(ci.low)}, ${sgn(ci.high)}]\ngana ${b}: ${ci.wins} · gana ${a}: ${ci.losses} · empates: ${ci.ties} · prueba de signos p = ${ci.p < 0.001 ? "< 0.001" : ci.p.toFixed(3)}\nveredicto: <b class="${verdictCls}">${verdict}</b></div>`;
}

export const chapter7 = {
  title: "Una automejora concreta del agente",
  question: "¿Puede el agente mejorar su propio gestor de contexto, y cómo sabemos si mejoró?",
  setup(ctx) {
    baseVisibility(ctx, { rack: false, agent: true });
    explode(ctx, 0);
    ctx.theta(ctx.store.print0, "modelo base congelado");
    ctx.state("cart-v0", { slot: "active", role: "in" });
    for (const v of ["v1", "v2", "v3"]) ctx.show(`cart-${v}`, false);
    ctx.show("ctx-lines", true);
    ctx.state("ctx-lines", {});
    ctx.state("datos", {});
    ctx.state("evaluador", { value: 0 });
    for (const r of [1, 2, 3]) ctx.state(`route${r}`, { off: true });
  },
  exit(ctx) {
    ctx.state("datos", {});
    ctx.state("evaluador", { value: 0 });
    for (const r of [1, 2, 3]) ctx.state(`route${r}`, { off: false });
  },
  desk(ctx) {
    ctx.desk("Banco de tareas", (desk) => {
      const task = el("select", { "aria-label": "Tarea de desarrollo", style: "background:var(--panel-2);border:1px solid var(--line-2);border-radius:4px;font:11px var(--mono)" });
      ctx.store.splits().dev.forEach((t, i) => task.append(el("option", { value: i, selected: i === (ctx.user.task ?? DEV_TASK) }, `tarea ${t.seed} · ${t.family}${t.early ? " · temprana" : ""}`)));
      task.addEventListener("change", () => {
        ctx.user.task = Number(task.value);
        ctx.refresh();
      });
      const lamVal = el("span", { class: "val" }, (ctx.user.lambda ?? 0.1).toFixed(2));
      const lam = el("input", { type: "range", min: "0", max: "3", step: "0.05", value: String(ctx.user.lambda ?? 0.1), "aria-label": "Peso λ del coste en la métrica compuesta" });
      lam.addEventListener("input", () => {
        ctx.user.lambda = Number(lam.value);
        lamVal.textContent = ctx.user.lambda.toFixed(2);
        ctx.refresh();
      });
      desk.append(el("div", { class: "row" }, el("label", {}, "tarea de desarrollo"), task), el("div", { class: "row" }, el("label", {}, "λ (peso del coste)"), lam, lamVal), el("div", { class: "note" }, "Métrica compuesta = éxito − λ·coste/presupuesto (sin unidades). La puerta de corrección rechaza toda regresión de éxito, sea cual sea λ."));
    });
    ctx.user.task = ctx.user.task ?? DEV_TASK;
  },
  beats: [
    {
      id: "7.1",
      dur: 7,
      scale: "lab",
      camera: mainCamera,
      caption: "El modelo base queda <b>congelado</b> (gris). Lo que puede cambiar es el <b>código del agente</b>: su gestor de contexto, hoy en la versión <b>v0</b>.",
      changed: { pesos: "fijo", codigo: "v0 activo" },
      more: `<p>En esta escena no se entrena nada. El agente es una tubería local y controlada: gestor de contexto → solucionador simbólico (reglas declaradas). Las <b>propuestas</b> de código v1, v2 y v3 son <b>guionadas</b>; su ejecución y todas las métricas del banco se calculan aquí.</p>`,
      pose(ctx) {
        ctx.focus(["modelo", "modelo-front", "codigo", "cart-v0"]);
        ctx.tag("lb-frozen", "modelo", "θ congelado", { dz: 92, role: "off" });
        ctx.tag("lb-v0", "cart-v0", "gestor de contexto v0 (activo)", { dz: 12, role: "in" });
      },
    },
    {
      id: "7.2",
      dur: 12,
      events: 3,
      scale: "lab",
      camera: () => moduleCamera(["contexto", "datos", "evaluador"], 6, { area: { left: 440 } }),
      caption: (ctx) => ["Una tarea de <b>desarrollo</b> (cajón abierto): sus registros completos sí son visibles para el agente y para el proponente.", "v0 recorre el registro en orden: <b>el presupuesto se agota</b> con el arranque y los reintentos; la evidencia del final queda fuera.", "Resultado: <b>fallo</b>. Se registra qué faltaba: es la observación concreta que motivará un cambio."][Math.max(0, ctx.event - 1)],
      changed: { codigo: "v0", datos: "desarrollo" },
      pose(ctx, t, e) {
        const task = devTask(ctx);
        const { run, kept, dropped } = contextState(task, VERSIONS.v0);
        ctx.state("datos", { open: "dev" });
        ctx.state("ctx-lines", { kept: e >= 2 ? kept : kept.slice(0, Math.ceil(kept.length * t * 3)), dropped: e >= 2 ? dropped : [] });
        ctx.state("contexto", { used: 0, fill: Math.min(1, run.cost / BUDGET) });
        ctx.state("evaluador", { value: 0, fail: e >= 3 && !run.success, ok: e >= 3 && run.success });
        ctx.focus(["contexto", "ctx-lines", "datos", "evaluador", "cart-v0", "codigo"]);
        ctx.panel("log", { title: `Tarea ${task.seed} (${task.family}) · gestor v0`, provKind: "local", html: logPanelHtml(task, run) + `<div class="subst">contexto ${run.cost}/${BUDGET} tokens · cobertura ${pct(run.coverage)} · ${run.success ? '<b class="ok-t">acierto</b>' : '<b class="bad-t">fallo</b>'}\nsolucionador: ${esc(run.steps.join(" | "))}</div>`, width: 430 });
      },
    },
    {
      id: "7.3",
      dur: 10,
      scale: "lab",
      camera: () => moduleCamera(["proponente", "codigo", "contexto"], 8, { area: { left: 440 } }),
      caption: "Diagnóstico: «la evidencia quedó fuera por presupuesto». Propuesta <b>v1</b> (<b>guionada</b>): quitar duplicados, puntuar por relevancia y llenar el presupuesto con lo más relevante.",
      changed: { codigo: "variante v1 propuesta" },
      more: `<p>El cambio está escrito de antemano para esta demostración: no hay un LLM generándolo detrás de un indicador de carga. Lo que se calcula de verdad es su ejecución sobre el banco y sus métricas.</p>`,
      pose(ctx) {
        ctx.show("cart-v1", true);
        ctx.state("cart-v1", { slot: "proposer", role: "g", lit: true });
        ctx.focus(["proponente", "cart-v1", "cart-v0", "codigo"]);
        ctx.tag("lb-v1", "cart-v1", "v1 · propuesta guionada", { dz: 12, role: "g" });
        ctx.panel("diff", { title: "v0 → v1 (pseudocódigo)", provKind: "ilus", provText: "propuesta guionada", html: diffHtml("v0", "v1"), width: 430 });
      },
    },
    {
      id: "7.4",
      dur: 9,
      scale: "lab",
      camera: () => moduleCamera(["contexto", "datos", "evaluador"], 6, { area: { left: 440 } }),
      caption: (ctx) => {
        const run = runTask(devTask(ctx), VERSIONS.v1);
        return `Misma tarea, mismo presupuesto, gestor <b>v1</b>: la evidencia entra (verde) y el solucionador ${run.success ? "<b>acierta</b>" : "<b>sigue fallando</b>"}. Un caso no basta para decidir.`;
      },
      changed: { codigo: "v1 a prueba", datos: "desarrollo" },
      pose(ctx) {
        const task = devTask(ctx);
        const { run, kept, dropped } = contextState(task, VERSIONS.v1);
        ctx.state("ctx-lines", { kept, dropped });
        ctx.state("contexto", { used: 0, fill: Math.min(1, run.cost / BUDGET) });
        ctx.state("evaluador", { value: run.coverage, ok: run.success, fail: !run.success });
        ctx.focus(["contexto", "ctx-lines", "evaluador", "cart-v1"]);
        ctx.panel("log", { title: `Tarea ${task.seed} · gestor v1`, provKind: "local", html: logPanelHtml(task, run) + `<div class="subst">${esc(run.managed.trace.join(" · "))}\ncontexto ${run.cost}/${BUDGET} · cobertura ${pct(run.coverage)} · ${run.success ? '<b class="ok-t">acierto</b>' : '<b class="bad-t">fallo</b>'}</div>`, width: 430 });
      },
    },
    {
      id: "7.5",
      dur: 13,
      events: 2,
      scale: "lab",
      camera: () => moduleCamera(["datos", "evaluador", "codigo", "archivo"], 6, { area: { left: 440 } }),
      caption: (ctx) => (ctx.event <= 1 ? "<b>Validación</b>: v0 y v1 con las <b>mismas 40 tareas</b>, el mismo presupuesto y semillas compatibles. El proponente sólo ve agregados." : `IC95 de Δéxito por encima de 0: <b>mejora</b>. v1 se <b>promueve</b> a versión activa; v0 queda en el archivo.`),
      changed: (ctx) => (ctx.event <= 1 ? { codigo: "v1 a prueba", datos: "validación" } : { codigo: "cambió: v1 activo", datos: "validación" }),
      more: `<p>Bootstrap pareado: se remuestrean las 40 tareas con reemplazo (2000 veces, semilla fija) y se calcula la diferencia de tasas de éxito en cada remuestreo. El intervalo del 95 % se toma de los percentiles 2.5 y 97.5.</p><p>Criterio de promoción: IC95 de Δéxito &gt; 0 en validación, con el mismo presupuesto de contexto (64 tokens).</p>`,
      pose(ctx, t, e) {
        ctx.state("datos", { open: "valid" });
        const ev = ctx.store.evals();
        ctx.state("evaluador", { value: e >= 2 ? ev.v1.valid.success : ev.v0.valid.success, ok: e >= 2, fail: false });
        if (e >= 2) {
          ctx.state("cart-v1", { slot: "active", role: "in", lit: true });
          ctx.state("cart-v0", { slot: "arch0", role: "off" });
        } else {
          ctx.state("cart-v1", { slot: "proposer", role: "g" });
          ctx.state("cart-v0", { slot: "active", role: "in" });
        }
        ctx.show("ctx-lines", false);
        ctx.focus(["datos", "evaluador", "codigo", "archivo", "cart-v0", "cart-v1"]);
        ctx.panel("cmp", { title: "v0 frente a v1 · validación (40 tareas)", provKind: "local", html: compareHtml(ctx, "v0", "v1"), width: 440 });
      },
    },
    {
      id: "7.6",
      dur: 12,
      events: 2,
      scale: "lab",
      camera: () => moduleCamera(["evaluador", "codigo", "archivo", "proponente"], 6, { area: { left: 440 } }),
      caption: (ctx) => {
        const lam = ctx.user.lambda ?? 0.1;
        const ev = ctx.store.evals();
        const c1 = ev.v1.valid.success - lam * (ev.v1.valid.cost / BUDGET);
        const c2 = ev.v2.valid.success - lam * (ev.v2.valid.cost / BUDGET);
        return ctx.event <= 1 ? "Propuesta <b>v2</b> (guionada): «ahorrar presupuesto» quedándose sólo con ERROR y TRACE. Es <b>más barata</b>…" : `…pero es una <b>regresión</b> de corrección. Con λ = ${lam.toFixed(2)} la métrica compuesta ${c2 > c1 ? "<b>prefiere v2</b>" : "prefiere v1"}; la <b>puerta de corrección</b> la rechaza igual.`;
      },
      changed: { codigo: "v1 activo · v2 a prueba", datos: "validación" },
      more: `<p>Métrica compuesta declarada: éxito (fracción de tareas, 0–1) − λ · coste/presupuesto (tokens/64, 0–1). Ambas sin unidades; λ fija el canje.</p><p>Una menor latencia o un menor coste no deben compensar <b>en silencio</b> una caída inaceptable de corrección. Por eso hay una puerta previa: si el IC95 de Δéxito queda por debajo de 0, se rechaza, sea cual sea λ. Prueba λ en la mesa de control.</p>`,
      pose(ctx, t, e) {
        ctx.show("cart-v2", true);
        ctx.state("cart-v2", { slot: e >= 2 ? "arch1" : "proposer", role: e >= 2 ? "bad" : "g", lit: e < 2 });
        ctx.state("cart-v1", { slot: "active", role: "in" });
        ctx.state("cart-v0", { slot: "arch0", role: "off" });
        const ev = ctx.store.evals();
        const lam = ctx.user.lambda ?? 0.1;
        const comp = (v) => ev[v].valid.success - lam * (ev[v].valid.cost / BUDGET);
        ctx.state("evaluador", { value: ev.v2.valid.success, fail: e >= 2, ok: false });
        ctx.focus(["evaluador", "cart-v2", "cart-v1", "codigo", "archivo"]);
        ctx.panel("diff", { title: "v1 → v2", provKind: "ilus", provText: "propuesta guionada", html: diffHtml("v1", "v2"), width: 440 });
        if (e >= 2) ctx.panel("cmp", { title: "v1 frente a v2 · validación", provKind: "local", top: 280, html: compareHtml(ctx, "v1", "v2") + `<div class="subst">compuesta (λ = ${lam.toFixed(2)}): v1 ${f3(comp("v1"))} · v2 ${f3(comp("v2"))}\npuerta de corrección: <b class="bad-t">rechazo</b> (IC95 de Δéxito &lt; 0)</div>`, width: 440 });
      },
    },
    {
      id: "7.7",
      dur: 10,
      scale: "lab",
      camera: () => moduleCamera(["evaluador", "codigo", "archivo", "proponente"], 6, { area: { left: 440 } }),
      caption: "Propuesta <b>v3</b> (guionada): «recortar cada línea a 6 palabras». Ahorra espacio, pero a veces corta la palabra clave de la causa: gana en unas tareas y pierde en otras. <b>Sin diferencia concluyente</b>.",
      changed: { codigo: "v1 activo · v3 a prueba", datos: "validación" },
      pose(ctx) {
        ctx.show("cart-v3", true);
        ctx.state("cart-v3", { slot: "arch2", role: "off" });
        ctx.state("cart-v2", { slot: "arch1", role: "bad" });
        ctx.state("evaluador", { value: ctx.store.evals().v3.valid.success, ok: false, fail: false });
        ctx.focus(["evaluador", "cart-v3", "archivo"]);
        ctx.panel("cmp", { title: "v1 frente a v3 · validación", provKind: "local", html: diffHtml("v1", "v3") + compareHtml(ctx, "v1", "v3"), width: 440 });
      },
    },
    {
      id: "7.8",
      dur: 8,
      scale: "lab",
      camera: () => moduleCamera(["archivo", "codigo"], 10, { area: { left: 440 } }),
      caption: "<b>Archivar no es promover</b>. v2 se conserva: es la variante más barata y puede servir para explorar. Pero no reemplaza a la versión activa v1.",
      changed: { codigo: "v1 activo" },
      pose(ctx) {
        ctx.focus(["archivo", "cart-v0", "cart-v2", "cart-v3", "codigo", "cart-v1"]);
        for (const v of ["v0", "v2", "v3"]) ctx.tag(`lb-${v}`, `cart-${v}`, v, { dz: 10, role: v === "v2" ? "bad" : "off" });
        ctx.tag("lb-v1a", "cart-v1", "v1 · activa", { dz: 12, role: "in" });
        const ev = ctx.store.evals();
        const row = (v, state) => [v, VERSIONS[v].name, pct(ev[v].valid.success), ev[v].valid.cost.toFixed(1), state];
        ctx.panel("arch", {
          title: "Archivo de versiones",
          provKind: "local",
          html: `<pre class="code">v0 ── v1 (activa)
       ├── v2  archivada: más barata, regresión de éxito
       └── v3  archivada: sin diferencia concluyente</pre>${table(["versión", "gestor", "éxito val.", "coste", "estado"], [row("v0", "archivada"), row("v1", '<b class="ok-t">activa</b>'), row("v2", '<span class="bad-t">archivada</span>'), row("v3", "archivada")])}`,
          width: 460,
        });
      },
    },
    {
      id: "7.9",
      dur: 8,
      scale: "lab",
      camera: () => moduleCamera(["datos", "evaluador"], 10, { area: { left: 440 } }),
      caption: (ctx) => `<b>Prueba final reservada</b>, usada una sola vez al terminar: v1 acierta en ${pct(ctx.store.evals().v1.test.success)} de 60 tareas nuevas (v0, como referencia: ${pct(ctx.store.evals().v0.test.success)}). Este número no vuelve a la búsqueda.`,
      changed: { codigo: "v1 activo", datos: "prueba (uso único)" },
      pose(ctx) {
        ctx.state("datos", { open: "test" });
        const ev = ctx.store.evals();
        ctx.state("evaluador", { value: ev.v1.test.success, ok: true });
        ctx.focus(["datos", "evaluador"]);
        ctx.panel("test", { title: "Prueba reservada (60 tareas)", provKind: "local", html: `${grid(ev.v0.test.runs, "v0")}${grid(ev.v1.test.runs, "v1")}<div class="subst">v0 ${pct(ev.v0.test.success)} → v1 ${pct(ev.v1.test.success)}\nv2 y v3 no se evalúan en prueba: no fueron elegidas.\nEn validación v1 obtuvo ${pct(ev.v1.valid.success)}; la diferencia con prueba es normal.</div>`, width: 430 });
      },
    },
    {
      id: "7.10",
      dur: 8,
      scale: "lab",
      camera: () => moduleCamera(["datos", "proponente", "evaluador"], 10, { area: { left: 440 } }),
      caption: "Ojo: v1, v2 y v3 se compararon con las <b>mismas 40 tareas</b> de validación. Consultarlas una y otra vez también puede sobreajustar la elección a ese conjunto.",
      changed: { codigo: "v1 activo" },
      more: `<p>Separación de datos en esta escena:</p><ul><li><b>Desarrollo</b> (16 tareas): registros completos; el proponente los lee para diagnosticar.</li><li><b>Validación</b> (40): sólo agregados; sirven para seleccionar.</li><li><b>Prueba reservada</b> (60): una única medición al final; nunca retroalimenta.</li></ul><p>El registro de accesos de model/agent.mjs lanza un error si el proponente intenta leer la prueba (comprobado en la verificación).</p>`,
      pose(ctx) {
        ctx.state("datos", {});
        ctx.focus(["datos", "proponente"]);
        ctx.panel("access", { title: "Registro de accesos", provKind: "local", html: table(["quién", "partición", "qué ve"], [["proponente", "desarrollo", "registros completos"], ["proponente", "validación", "sólo agregados (3 consultas)"], ["proponente", "prueba", '<span class="bad-t">bloqueado</span>'], ["informe final", "prueba", "1 consulta, al terminar"]]), width: 420 });
      },
    },
  ],
};
