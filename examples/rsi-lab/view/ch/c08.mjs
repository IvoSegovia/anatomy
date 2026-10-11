// Capítulo 8 — Dónde aparece la recursión.
import { baseVisibility, explode, mainCamera, moduleCamera } from "../common.mjs";
import { f2, f3, esc, table, pct, lineChart, prov } from "../helpers.mjs";
import { el } from "../ui.mjs";
import { VERSIONS, BUDGET, runTask, makeSplit, SPLITS } from "../../model/agent.mjs";
import { reportOf, analyse, diagnose } from "../../model/loop.mjs";

const PSEUDO = [
  ["Elegir un padre del archivo", ["archivo"]],
  ["Analizar registros de desarrollo (con el gestor del analista)", ["proponente", "datos"]],
  ["Proponer y construir una variante", ["proponente", "codigo"]],
  ["Ejecutarla con presupuesto definido", ["entorno"]],
  ["Evaluar y archivar las variantes válidas", ["evaluador", "archivo"]],
  ["Promover una versión sólo si cumple el criterio", ["codigo", "evaluador"]],
  ["Usar las versiones seleccionadas en ciclos posteriores", ["proponente", "codigo"]],
];

function pseudoHtml(active) {
  return `<pre class="code">${PSEUDO.map(([text], i) => (i === active ? `<span class="hl">${i + 1}. ${esc(text)}</span>` : `${i + 1}. ${esc(text)}`)).join("\n")}</pre>`;
}

function analysisDemo(ctx) {
  const dev = makeSplit(SPLITS.dev.base, SPLITS.dev.count);
  const failing = dev.map((task) => ({ task, run: runTask(task, VERSIONS.v0) })).filter((x) => !x.run.success);
  const reports = failing.map(({ task, run }) => reportOf(task, run, "v0"));
  return { reports, failing, withV0: analyse(reports, VERSIONS.v0), withV1: analyse(reports, VERSIONS.v1), withV2: analyse(reports, VERSIONS.v2) };
}

function compareChart(rows) {
  // final de auditoría por semilla: A (gris) y B (naranja)
  const w = 400;
  const h = 150;
  const pad = { l: 34, r: 10, t: 10, b: 26 };
  const X = (i) => pad.l + ((i + 0.5) / rows.length) * (w - pad.l - pad.r);
  const Y = (v) => pad.t + (1 - v) * (h - pad.t - pad.b);
  const out = [`<svg class="chart" viewBox="0 0 ${w} ${h}">`];
  for (const v of [0, 0.25, 0.5, 0.75, 1]) out.push(`<line class="grid" x1="${pad.l}" x2="${w - pad.r}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${pad.l - 4}" y="${Y(v) + 3}" text-anchor="end">${(v * 100).toFixed(0)}%</text>`);
  rows.forEach((r, i) => {
    const a = r.A.finalAudit;
    const b = r.B.finalAudit;
    const color = b > a + 1e-9 ? "var(--c-ok)" : b < a - 1e-9 ? "var(--c-bad)" : "var(--c-off)";
    out.push(`<line x1="${X(i)}" x2="${X(i)}" y1="${Y(a)}" y2="${Y(b)}" stroke="${color}" stroke-width="1.6"/>`);
    out.push(`<circle cx="${X(i)}" cy="${Y(a)}" r="3.2" fill="var(--c-off)"/><circle cx="${X(i)}" cy="${Y(b)}" r="3.2" fill="var(--c-g)"/>`);
    out.push(`<text x="${X(i)}" y="${h - 10}" text-anchor="middle">${r.seed}</text>`);
  });
  out.push(`<text x="${w - pad.r}" y="${h - 1}" text-anchor="end">semilla</text><text x="2" y="${pad.t - 2}">auditoría final</text></svg>`);
  return out.join("");
}

export const chapter8 = {
  title: "Dónde aparece la recursión",
  question: "¿Cuándo una modificación interviene en su propio proceso de mejora, y qué hay que medir?",
  setup(ctx) {
    baseVisibility(ctx, { rack: false, agent: true });
    explode(ctx, 0);
    ctx.theta(ctx.store.print0, "modelo base congelado");
    ctx.state("cart-v0", { slot: "arch0", role: "off" });
    ctx.state("cart-v1", { slot: "active", role: "in" });
    ctx.state("cart-v2", { slot: "arch1", role: "bad" });
    ctx.state("cart-v3", { slot: "arch2", role: "off" });
    ctx.show(["cart-v0", "cart-v1", "cart-v2", "cart-v3"], true);
    ctx.show("cart-an", false);
    ctx.show("ctx-lines", false);
    ctx.store.loopCompareAsync(() => ctx.refresh());
  },
  desk(ctx) {
    ctx.desk("Bucle A / B", (desk) => {
      const seg = el("div", { class: "seg", role: "group", "aria-label": "Modo" });
      ["A", "B"].forEach((m) => {
        const b = el("button", { "aria-pressed": ctx.user.loopMode === m ? "true" : "false" }, m === "A" ? "A · proponente fijo" : "B · versiones participan");
        b.addEventListener("click", () => {
          ctx.user.loopMode = m;
          seg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
          ctx.refresh();
        });
        seg.append(b);
      });
      const seed = el("select", { "aria-label": "Semilla", style: "background:var(--panel-2);border:1px solid var(--line-2);border-radius:4px" });
      for (let s = 1; s <= 12; s++) seed.append(el("option", { value: s, selected: s === ctx.user.loopSeed }, `semilla ${s}`));
      seed.addEventListener("change", () => {
        ctx.user.loopSeed = Number(seed.value);
        ctx.refresh();
      });
      desk.append(el("div", { class: "row" }, seg), el("div", { class: "row" }, el("label", {}, "semilla"), seed), el("div", { class: "note" }, "Mismo presupuesto total (900 ejecuciones de tareas) en A y B. Simulación conceptual: las reglas del proponente son declaradas; las evaluaciones se ejecutan."));
    });
  },
  beats: [
    {
      id: "8.1",
      dur: 8,
      scale: "lab",
      camera: mainCamera,
      camSeconds: 2.2,
      caption: "La cámara vuelve al laboratorio. El gestor mejorado <b>v1</b> ahora también lo usa el <b>proponente</b> para leer los registros del siguiente ciclo.",
      changed: { codigo: "v1 activo", contexto: "del analista: v1" },
      pose(ctx, t) {
        ctx.show("cart-an", true);
        ctx.state("cart-an", { slot: "analyst", role: "in", lit: true, lift: (1 - Math.min(1, t * 1.5)) * 14 });
        ctx.focus(["codigo", "cart-v1", "proponente", "cart-an", "route3"]);
        ctx.tag("lb-an", "cart-an", "v1 en el analista", { dz: 12, role: "in" });
        ctx.tag("lb-act", "cart-v1", "v1 activo", { dz: 12, role: "in" });
        if (!ctx.still.matches) ctx.pulse(0, { route: 3, s: (t * 1.4) % 1, role: "hi" });
      },
    },
    {
      id: "8.2",
      dur: 9,
      scale: "lab",
      camera: () => moduleCamera(["codigo", "proponente", "archivo"], 10, { area: { left: 430 } }),
      caption: "Estado del sistema <b>S_t = (θ_t, código_t, memoria_t, estrategia_t)</b>. En este experimento cambian código, memoria y (en el modo B) estrategia; θ no.",
      changed: { codigo: "cambia", contexto: "memoria cambia" },
      more: `<p>La infraestructura (entorno, presupuesto) y el protocolo de evaluación (particiones, criterio estadístico) se indican <b>aparte</b> de S_t: aquí están fijos, diseñados desde fuera del bucle.</p>`,
      pose(ctx) {
        ctx.focus(["codigo", "proponente", "archivo", "cart-v1", "cart-an"]);
        ctx.panel("state", {
          title: "S_t y lo que puede cambiar aquí",
          html: table(["coordenada", "contenido", "¿cambia?"], [["θ_t", "pesos del modelo base (2048)", '<span class="off-t">no: congelado</span>'], ["código_t", "genoma del gestor de contexto", '<span class="g-t">sí</span>'], ["memoria_t", "notas del proponente: variantes ya probadas", '<span class="g-t">sí</span>'], ["estrategia_t", "tareas de validación por candidata, exploración", '<span class="g-t">sí (modo B)</span>'], ["aparte", "infraestructura y protocolo de evaluación", '<span class="off-t">fijos</span>']]),
          width: 430,
        });
      },
    },
    {
      id: "8.3",
      dur: 15,
      events: 7,
      scale: "lab",
      camera: mainCamera,
      caption: (ctx) => `Ciclo de mejora · ${ctx.event}. <b>${PSEUDO[Math.max(0, ctx.event - 1)][0]}</b>.`,
      changed: { codigo: "variante", contexto: "memoria" },
      pose(ctx, t, e) {
        const i = Math.max(0, e - 1);
        ctx.focus([...PSEUDO[i][1], ...(PSEUDO[i][1].includes("codigo") ? ["cart-v1"] : []), ...(PSEUDO[i][1].includes("proponente") ? ["cart-an"] : [])]);
        ctx.panel("pseudo", { title: "Pseudocódigo del bucle", html: pseudoHtml(i), width: 400 });
        const route = i <= 2 ? 3 : 2;
        if (!ctx.still.matches) ctx.pulse(0, { route, s: (t * 7) % 1, role: route === 3 ? "hi" : "g" });
      },
    },
    {
      id: "8.4",
      dur: 13,
      events: 3,
      scale: "lab",
      camera: () => moduleCamera(["proponente", "codigo", "datos"], 10, { area: { left: 440 } }),
      caption: (ctx) => {
        const d = analysisDemo(ctx);
        return ["Los fallos de desarrollo de v0 producen <b>informes</b>: una cabecera verbosa y una línea DEBUG con el diagnóstico.", `Leídos con el gestor <b>v0</b> (64 tokens desde el inicio), el analista ve <b>${d.withV0.visible} de ${d.withV0.total}</b> diagnósticos: propone a ciegas.`, `Leídos con <b>v1</b>, ve <b>${d.withV1.visible} de ${d.withV1.total}</b>: puede dirigir la propuesta. Aquí la mejora interviene en el proceso que produce mejoras.`][Math.max(0, ctx.event - 1)];
      },
      changed: { codigo: "v1 activo", contexto: "analista: v1" },
      more: `<p>Esta dependencia está calculada: el analista aplica el mismo gestor de contexto a sus propios informes de fallo. Un gestor que descarta líneas DEBUG (como v2) también dejaría de ver los diagnósticos: una «mejora» puede empeorar el proceso de mejora.</p>`,
      pose(ctx, t, e) {
        const d = analysisDemo(ctx);
        const report = d.reports[0];
        const shown = e >= 3 ? d.withV1 : d.withV0;
        ctx.focus(["proponente", "cart-an", "datos"]);
        const lines = report.map((l) => `${l.tags.diag ? '<span class="g-t">' : ""}${esc(l.text)}${l.tags.diag ? "</span>" : ""}`).join("\n");
        ctx.panel("report", {
          title: `Informe de fallo · tarea ${d.failing[0].task.seed}`,
          provKind: "local",
          html: `<div class="subst" style="font-size:10.5px">${lines}</div>${e >= 2 ? table(["analista lee con", "diagnósticos visibles"], [["v0 (desde el inicio)", `${d.withV0.visible}/${d.withV0.total}`], ["v1 (relevancia)", `${d.withV1.visible}/${d.withV1.total}`], ["v2 (sin DEBUG)", `${d.withV2.visible}/${d.withV2.total}`]]) : ""}${e >= 3 ? `<div class="subst">causas visibles con v1: ${Object.entries(d.withV1.seen).map(([k, v]) => `${k} ×${v}`).join(", ")}</div>` : ""}`,
          width: 440,
        });
      },
    },
    {
      id: "8.5",
      dur: 16,
      events: 2,
      scale: "lab",
      camera: () => moduleCamera(["archivo", "proponente", "evaluador", "codigo"], 10, { area: { left: 450 } }),
      caption: (ctx) => {
        if (ctx.event <= 1) return `Un caso (semilla ${ctx.user.loopSeed}): auditoría de la versión activa ciclo a ciclo, <b>A</b> (proponente y estrategia fijos) frente a <b>B</b> (las versiones promovidas participan).`;
        const rows = ctx.store.loopReady() ? ctx.store.loopCompare() : null;
        if (!rows) return "Calculando 24 ejecuciones del bucle…";
        const better = rows.filter((r) => r.B.finalAudit > r.A.finalAudit + 1e-9).length;
        const worse = rows.filter((r) => r.B.finalAudit < r.A.finalAudit - 1e-9).length;
        return `Doce semillas, mismo presupuesto: B <b>mejora</b> en ${better}, <b>se estanca</b> igual que A en ${12 - better - worse} y <b>retrocede</b> en ${worse}. Cerrar el bucle no garantiza progreso.`;
      },
      changed: { codigo: "cambia", contexto: "memoria", evaluador: "fijo" },
      pose(ctx, t, e) {
        ctx.focus(["archivo", "proponente", "evaluador", "codigo"]);
        if (e <= 1) {
          const prev = ctx.user.loopMode;
          ctx.user.loopMode = "A";
          const A = ctx.store.loop();
          ctx.user.loopMode = "B";
          const B = ctx.store.loop();
          ctx.user.loopMode = prev;
          const series = (r) => [r.startAudit, ...r.cycles.map((c) => c.activeAudit ?? NaN)];
          const n = Math.max(A.cycles.length, B.cycles.length) + 1;
          const pad = (v) => v.concat(new Array(n - v.length).fill(NaN));
          ctx.panel("ab", {
            title: `A frente a B · semilla ${ctx.user.loopSeed}`,
            provKind: "sim",
            html: `${lineChart([{ values: pad(series(A)), cls: "A" }, { values: pad(series(B)), cls: "B" }], { w: 400, h: 150, xLabel: "ciclo", yLabel: "auditoría de la versión activa", yMax: 1, xTicks: [0, Math.floor((n - 1) / 2), n - 1] })}<div class="legend"><span style="color:var(--c-off)"><i></i>A · proponente fijo</span><span style="color:var(--c-g)"><i></i>B · versiones participan</span></div>${table(["", "A", "B"], [["ciclos (mismo presupuesto)", A.cycles.length, B.cycles.length], ["promociones", A.promotions, B.promotions], ["calidad media del análisis", pct(A.meanQuality), pct(B.meanQuality)], ["auditoría final", pct(A.finalAudit), pct(B.finalAudit)]])}`,
            width: 440,
          });
        } else {
          const rows = ctx.store.loopReady() ? ctx.store.loopCompare() : null;
          ctx.panel("ab", { title: "A frente a B · 12 semillas · mismo presupuesto", provKind: "sim", html: rows ? `${compareChart(rows)}<div class="legend"><span style="color:var(--c-off)"><i></i>A</span><span style="color:var(--c-g)"><i></i>B</span><span style="color:var(--c-ok)"><i></i>B mejor</span><span style="color:var(--c-bad)"><i></i>B peor</span></div>` : '<p class="kv">calculando…</p>', width: 440 });
        }
      },
    },
    {
      id: "8.6",
      dur: 10,
      scale: "lab",
      camera: () => moduleCamera(["archivo", "proponente", "evaluador", "codigo"], 10, { area: { left: 450 } }),
      caption: "Tres medidas separadas, no un único marcador de «inteligencia»: <b>rendimiento en tareas</b>, <b>capacidad de producir mejoras válidas</b> y <b>coste por mejora</b>.",
      changed: { evaluador: "mide 3 cosas" },
      more: `<p>«Mejora válida»: una promoción cuya versión también mejora en la auditoría independiente (que el bucle no ve). El coste por mejora cuenta todas las ejecuciones de tareas gastadas por el bucle.</p><p>Una mejora en tareas de programación puede ser evidencia indirecta de mejor capacidad de automodificación, pero no es una equivalencia garantizada.</p>`,
      pose(ctx) {
        const rows = ctx.store.loopReady() ? ctx.store.loopCompare() : null;
        ctx.focus(["evaluador", "archivo"]);
        if (!rows) return ctx.panel("metrics", { title: "Tres medidas", html: '<p class="kv">calculando…</p>', width: 440 });
        const mean = (key, m) => rows.reduce((t, r) => t + r[m][key], 0) / rows.length;
        const sum = (key, m) => rows.reduce((t, r) => t + r[m][key], 0);
        const costPer = (m) => {
          const valid = sum("valid", m);
          return valid ? (sum("spent", m) / valid).toFixed(0) : "—";
        };
        ctx.panel("metrics", {
          title: "Tres medidas · media de 12 semillas",
          provKind: "sim",
          html: table(["medida", "A", "B"], [["rendimiento: auditoría final", pct(mean("finalAudit", "A")), pct(mean("finalAudit", "B"))], ["rendimiento: prueba final (uso único)", pct(mean("finalTest", "A")), pct(mean("finalTest", "B"))], ["mejoras válidas (total)", sum("valid", "A"), sum("valid", "B")], ["coste por mejora válida (ejecuciones)", costPer("A"), costPer("B")], ["calidad del análisis", pct(mean("quality", "A")), pct(mean("quality", "B"))]]) + `<div class="subst">Simulación conceptual: las reglas del proponente son inventadas para esta demostración; las ejecuciones del banco de tareas y el criterio estadístico son reales.</div>`,
          width: 450,
        });
      },
    },
    {
      id: "8.7",
      dur: 8,
      scale: "lab",
      camera: mainCamera,
      caption: "Reutilizar un sistema modificado introduce <b>autorreferencia</b>. No demuestra por sí sola una <b>aceleración</b> de la mejora: eso hay que medirlo, y puede no ocurrir.",
      changed: { codigo: "cambia", contexto: "memoria" },
      pose(ctx, t) {
        ctx.focus(["route3", "archivo", "proponente", "cart-an"]);
        if (!ctx.still.matches) for (let i = 0; i < 2; i++) ctx.pulse(i, { route: 3, s: (t * 1.2 + i / 2) % 1, role: "hi" });
      },
    },
  ],
};
