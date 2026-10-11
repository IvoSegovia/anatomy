import { baseVisibility, explode, mainCamera, moduleCamera } from "../common.mjs";
import { f2, f3, esc, table, pct, lineChart, prov } from "../helpers.mjs";
import { el } from "../ui.mjs";
import { BUDGET, manageContext, pseudocodeOf } from "../../model/agent.mjs";
import { RULES } from "../../model/loop.mjs";

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

export function traceOf(ctx) {
  const run = ctx.store.loop();
  const p = run.cycles.findIndex((c) => c.promoted);
  const P = run.cycles[Math.max(0, p)];
  const Q = run.cycles[Math.max(0, p) + 1] || null;
  return { run, p, P, Q, promoted: p >= 0 };
}

const traceCamera = () => moduleCamera(["proponente", "codigo", "datos", "evaluador", "archivo"], 8, { area: { left: 500 } });

const STATUS = { incluida: ["✓", "ok-t", "llega"], presupuesto: ["✗", "bad-t", "no cupo"], tipo: ["⊘", "off-t", "tipo descartado"], duplicada: ["≡", "off-t", "duplicada"], recortada: ["✂", "g-t", "recortada"] };

function statusCell(state) {
  if (!state) return '<span class="off-t">·</span>';
  const [mark, cls, word] = STATUS[state] || ["·", "off-t", state];
  return `<span class="${cls}">${mark} ${word}</span>`;
}

function reportTable(detail, columns) {
  const rows = detail.raw.map((line) => {
    const text = line.text.length > 46 ? `${line.text.slice(0, 45)}…` : line.text;
    const cls = line.tags.diag ? ' class="on"' : "";
    return `<tr${cls}><td>L${line.index}</td><td style="text-align:left;white-space:nowrap">${line.tags.diag ? "<b>" : ""}${esc(text)}${line.tags.diag ? "</b>" : ""}</td>${columns.map((col) => `<td>${statusCell(col.status.get(line.index))}</td>`).join("")}</tr>`;
  });
  return `<table class="tbl rep"><tr><th>línea</th><th style="text-align:left">texto (en negrita, diagnósticos)</th>${columns.map((c) => `<th>${esc(c.label)}</th>`).join("")}</tr>${rows.join("")}</table>`;
}

const statusOf = (lines, genome) => manageContext(lines, genome, BUDGET).status;

function traceCaption(ctx, which) {
  const { P, Q, promoted } = traceOf(ctx);
  const c = which === "P" ? P : Q;
  if (!c) return "No hay un ciclo siguiente: el presupuesto se agotó.";
  return `Ciclo ${c.index} · analista ${c.analyst} · ${c.outcome}${which === "P" && !promoted ? " · (ninguna promoción con esta semilla)" : ""}`;
}

function traceChanged(ctx, which) {
  const c = traceOf(ctx)[which];
  if (!c) return {};
  return { codigo: c.promoted ? `${c.candidate} promovida` : `${c.candidate} a prueba`, contexto: `analista: ${c.analyst}`, datos: "desarrollo y validación", infra: `búsqueda ${c.after.search}/${c.after.limit}` };
}

function tracePose(ctx, which, e) {
  const { run, P, Q } = traceOf(ctx);
  const c = which === "P" ? P : Q;
  ctx.show("cart-an", true);
  ctx.state("cart-an", { slot: "analyst", role: "in", lit: e <= 1 });
  ctx.tag("lb-an", "cart-an", `analista: ${c ? c.analyst : "—"}`, { dz: 12, role: "in" });
  ctx.tag("lb-prop", "proponente", "proponente de reglas", { dz: 58, role: "g" });
  if (!c) {
    ctx.panel("trace", { title: "Sin ciclo siguiente", html: `<div class="subst">${esc(run.stopReason || "")}</div>`, width: 480 });
    return;
  }
  const detail = c.analysis.details[0];
  const title = `Ciclo ${c.index} · modo ${run.mode} · semilla ${run.seed}`;
  if (e <= 1) {
    const columns = [];
    if (which === "Q" && P) columns.push({ label: `con ${P.analyst} (antes)`, status: statusOf(detail.raw, P.analystGenome) });
    columns.push({ label: `con ${c.analyst}`, status: statusOf(detail.raw, c.analystGenome) });
    const seen = detail.read.length;
    const total = detail.raw.filter((l) => l.tags.diag).length;
    const shown = e >= 1 ? columns : columns.map((col) => ({ ...col, status: new Map() }));
    ctx.focus(["proponente", "cart-an", "datos"]);
    ctx.panel("trace", { title, provKind: "local", html: `<div class="subst">informe de fallo de la tarea de desarrollo ${detail.source.seed} (versión ${detail.source.version}) · el analista lee con un límite de ${BUDGET} tokens</div>${reportTable(detail, shown)}${e >= 1 ? `<div class="subst">diagnósticos que llegan al proponente: <b>${seen} de ${total}</b> en este informe · ${c.analysis.visible} de ${c.analysis.total} en todos los informes del ciclo</div>` : ""}`, width: 500 });
    if (e >= 1 && !ctx.still.matches) ctx.pulse(0, { route: 3, s: 0.6, role: "hi" });
    return;
  }
  if (e === 2) {
    const ranked = c.ranked.length ? c.ranked.map(([kind, n]) => `${kind} × ${n}`).join(", ") : "nada legible";
    const ruleText = c.rule === "aleatoria" ? RULES.aleatoria : RULES[c.rule];
    ctx.focus(["proponente", "codigo", "cart-an"]);
    ctx.panel("trace", {
      title,
      provKind: "sim",
      provText: "reglas programadas",
      html: `${table(["entrada del proponente", ""], [["diagnósticos vistos", esc(ranked)], ["tipos de línea mencionados", esc(Object.entries(c.analysis.seenTypes).map(([k, v]) => `${k}: ${[...new Set(v)].join(", ")}`).join(" · ") || "—")]])}
        <div class="subst">regla que se activa: <b>${esc(ruleText)}</b>\npropuesta: ${esc(c.proposal)}</div>
        <div class="subst">cambio en el gestor (${esc(c.parent)} → ${esc(c.candidate)}):\n${c.diff.length ? c.diff.map((d) => `  ${esc(d)}`).join("\n") : "  (ninguno)"}</div>
        <pre class="code">${esc(pseudocodeOf(c.candidateGenome))}</pre>`,
      width: 500,
    });
    return;
  }
  ctx.focus(["evaluador", "entorno", "archivo", "codigo"]);
  ctx.state("evaluador", { value: c.val ? c.val.candidate : 0, ok: !!c.promoted, fail: c.built && !c.promoted });
  const v = c.val;
  ctx.panel("trace", {
    title,
    provKind: "local",
    html: c.built
      ? `${table(["", c.activeBefore, c.candidate], [[`éxito en ${v.n} tareas de validación`, pct(v.active), pct(v.candidate)], ["coste medio (tokens)", v.costA.toFixed(1), v.costC.toFixed(1)]])}
        <div class="subst">Δéxito = ${v.ci.mean >= 0 ? "+" : ""}${v.ci.mean.toFixed(3)} · IC95 [${v.ci.low.toFixed(3)}, ${v.ci.high.toFixed(3)}]\nmotivo: <b class="${c.promoted ? "ok-t" : "bad-t"}">${esc(c.reason)}</b>\nresultado: <b>${esc(c.outcome)}</b>\npresupuesto de búsqueda: ${c.before.search} → ${c.after.search} de ${c.after.limit} (desarrollo +${c.after.desarrollo - c.before.desarrollo}, validación +${c.after.validación - c.before.validación})${c.promoted ? `\nauditoría (fuera de la búsqueda): ${pct(c.auditBefore)} → ${pct(c.auditAfter)}` : ""}</div>`
      : `<div class="subst">candidata inválida: no se evalúa. Se cobró el desarrollo (+16) y se liberó la reserva de validación.</div>`,
    width: 500,
  });
}

function compareChart(rows, key = "finalTest", label = "prueba final") {
  const w = 400;
  const h = 150;
  const pad = { l: 34, r: 10, t: 10, b: 26 };
  const X = (i) => pad.l + ((i + 0.5) / rows.length) * (w - pad.l - pad.r);
  const Y = (v) => pad.t + (1 - v) * (h - pad.t - pad.b);
  const out = [`<svg class="chart" viewBox="0 0 ${w} ${h}">`];
  for (const v of [0, 0.25, 0.5, 0.75, 1]) out.push(`<line class="grid" x1="${pad.l}" x2="${w - pad.r}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${pad.l - 4}" y="${Y(v) + 3}" text-anchor="end">${(v * 100).toFixed(0)}%</text>`);
  rows.forEach((r, i) => {
    const a = r.A[key];
    const b = r.B[key];
    const color = b > a + 1e-9 ? "var(--c-ok)" : b < a - 1e-9 ? "var(--c-bad)" : "var(--c-off)";
    out.push(`<line x1="${X(i)}" x2="${X(i)}" y1="${Y(a)}" y2="${Y(b)}" stroke="${color}" stroke-width="1.6"/>`);
    out.push(`<circle cx="${X(i)}" cy="${Y(a)}" r="3.2" fill="var(--c-off)"/><circle cx="${X(i)}" cy="${Y(b)}" r="3.2" fill="var(--c-g)"/>`);
    out.push(`<text x="${X(i)}" y="${h - 10}" text-anchor="middle">${r.seed}</text>`);
  });
  out.push(`<text x="${w - pad.r}" y="${h - 1}" text-anchor="end">semilla</text><text x="2" y="${pad.t - 2}">${label}</text></svg>`);
  return out.join("");
}

export function metricsOf(rows) {
  const out = { limit: rows[0].A.ledger.limit };
  for (const m of ["A", "B"]) {
    const list = rows.map((r) => r[m]);
    const mean = (f) => list.reduce((t, r) => t + f(r), 0) / list.length;
    const valid = list.reduce((t, r) => t + r.valid, 0);
    const search = list.reduce((t, r) => t + r.ledger.search, 0);
    const qualities = list.map((r) => r.quality).filter((q) => q !== null && q !== undefined);
    out[m] = {
      test: mean((r) => r.finalTest),
      audit: mean((r) => r.finalAudit),
      valid,
      costPer: valid ? `${Math.round(search / valid)} ejecuciones` : "no aplicable",
      quality: qualities.length ? pct(qualities.reduce((t, q) => t + q, 0) / qualities.length) : "no aplicable",
      dev: Math.round(mean((r) => r.ledger.desarrollo)),
      val: Math.round(mean((r) => r.ledger.validación)),
      search: Math.round(mean((r) => r.ledger.search)),
      aud: Math.round(mean((r) => r.ledger.auditoría)),
      tst: Math.round(mean((r) => r.ledger.prueba)),
    };
  }
  return out;
}

export const chapter8 = {
  title: "Dónde aparece la recursión",
  question: "¿Cuándo una modificación interviene en su propio proceso de mejora, y qué hay que medir?",
  setup(ctx) {
    baseVisibility(ctx, { rack: false, agent: true });
    explode(ctx, 0);
    ctx.theta(ctx.store.print0, "modelo base congelado");
    ctx.state("cart-v0", { slot: "active", role: "in" });
    ctx.show(["cart-v1", "cart-v2", "cart-v3"], false);
    ctx.show("cart-v0", true);
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
      desk.append(el("div", { class: "row" }, seg), el("div", { class: "row" }, el("label", {}, "semilla"), seed), el("div", { class: "note" }, "Mismo presupuesto máximo de búsqueda en A y B (1600 ejecuciones de desarrollo + validación). Simulación conceptual: las reglas del proponente son declaradas; las evaluaciones se ejecutan."));
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
        ctx.tag("lb-an", "cart-an", "analista: gestor de la versión activa", { dz: 12, role: "in" });
        ctx.tag("lb-prop", "proponente", "proponente de reglas", { dz: 34, role: "g" });
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
      dur: 15,
      events: 3,
      scale: "lab",
      camera: traceCamera,
      caption: (ctx) => traceCaption(ctx, "P"),
      changed: (ctx) => traceChanged(ctx, "P"),
      more: `<p>Ciclo real de <span class="kv">runLoop</span> con la semilla y el modo de la mesa de control. El proponente aplica reglas programadas a lo que el gestor del analista deja ver de cada informe de fallo; no hay un modelo de lenguaje. La evaluación usa las mismas tareas de validación para la versión activa y la candidata, y cada ejecución se cobra al presupuesto de búsqueda.</p>`,
      pose(ctx, t, e) {
        tracePose(ctx, "P", e);
      },
    },
    {
      id: "8.5",
      dur: 15,
      events: 3,
      scale: "lab",
      camera: traceCamera,
      caption: (ctx) => traceCaption(ctx, "Q"),
      changed: (ctx) => traceChanged(ctx, "Q"),
      more: `<p>El contrafactual de la columna izquierda aplica el gestor del analista anterior al mismo informe. Es un cálculo, no una animación preparada: cambia si cambiás la semilla o el modo.</p>`,
      pose(ctx, t, e) {
        tracePose(ctx, "Q", e);
      },
    },
    {
      id: "8.6",
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
            html: `${lineChart([{ values: pad(series(A)), cls: "A" }, { values: pad(series(B)), cls: "B" }], { w: 400, h: 150, xLabel: "ciclo", yLabel: "auditoría de la activa (fuera de la búsqueda)", yMax: 1, xTicks: [0, Math.floor((n - 1) / 2), n - 1] })}<div class="legend"><span style="color:var(--c-off)"><i></i>A · proponente fijo</span><span style="color:var(--c-g)"><i></i>B · versiones participan</span></div>${table(["", "A", "B"], [["ciclos (mismo presupuesto)", A.cycles.length, B.cycles.length], ["promociones", A.promotions, B.promotions], ["calidad media del análisis", pct(A.meanQuality), pct(B.meanQuality)], ["auditoría final", pct(A.finalAudit), pct(B.finalAudit)]])}`,
            width: 440,
          });
        } else {
          const rows = ctx.store.loopReady() ? ctx.store.loopCompare() : null;
          ctx.panel("ab", { title: "A frente a B · 12 semillas · mismo presupuesto", provKind: "sim", html: rows ? `${compareChart(rows)}<div class="legend"><span style="color:var(--c-off)"><i></i>A</span><span style="color:var(--c-g)"><i></i>B</span><span style="color:var(--c-ok)"><i></i>B mejor</span><span style="color:var(--c-bad)"><i></i>B peor</span></div>` : '<p class="kv">calculando…</p>', width: 440 });
        }
      },
    },
    {
      id: "8.7",
      dur: 10,
      scale: "lab",
      camera: () => moduleCamera(["archivo", "proponente", "evaluador", "codigo"], 10, { area: { left: 450 } }),
      caption: "Tres medidas separadas, no un único marcador de «inteligencia»: <b>rendimiento en tareas</b>, <b>capacidad de producir mejoras válidas</b> y <b>coste por mejora</b>.",
      changed: { evaluador: "mide 3 cosas" },
      more: `<p>«Mejora válida»: una promoción cuya versión también mejora en la auditoría independiente (que el bucle no ve). El coste por mejora cuenta todas las ejecuciones de tareas gastadas por el bucle.</p><p>Una mejora en tareas de programación puede ser evidencia indirecta de mejor capacidad de automodificación, pero no es una equivalencia garantizada.</p>`,
      pose(ctx) {
        const rows = ctx.store.loopReady() ? ctx.store.loopCompare() : null;
        ctx.focus(["evaluador", "archivo", "entorno"]);
        if (!rows) return ctx.panel("metrics", { title: "Tres medidas", html: '<p class="kv">calculando…</p>', width: 460 });
        const m = metricsOf(rows);
        ctx.panel("metrics", {
          title: "Tres medidas · 12 semillas · mismo protocolo",
          provKind: "sim",
          html:
            table(["medida", "A", "B"], [
              ["1 · rendimiento: prueba final (media)", pct(m.A.test), pct(m.B.test)],
              ["  auditoría final (media)", pct(m.A.audit), pct(m.B.audit)],
              ["2 · mejoras válidas (total)", m.A.valid, m.B.valid],
              ["3 · coste por mejora válida", m.A.costPer, m.B.costPer],
              ["calidad del análisis (media)", m.A.quality, m.B.quality],
            ]) +
            table(["ejecuciones de tareas (media por corrida)", "A", "B"], [
              ["desarrollo", m.A.dev, m.B.dev],
              ["validación (activa + candidata)", m.A.val, m.B.val],
              [`búsqueda = desarrollo + validación (límite ${m.limit})`, m.A.search, m.B.search],
              ["auditoría (presupuesto aparte)", m.A.aud, m.B.aud],
              ["prueba final (presupuesto aparte)", m.A.tst, m.B.tst],
            ]) +
            `<div class="subst">Mejora válida = promoción cuya auditoría supera la de la versión que reemplaza. Coste por mejora = ejecuciones de búsqueda ÷ mejoras válidas; «no aplicable» si no hubo ninguna.</div>`,
          width: 470,
        });
      },
    },
    {
      id: "8.8",
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
