import { baseVisibility, explode, labCamera, mainCamera, moduleCamera, rackCamera, M, RACK_IDS } from "../common.mjs";
import { VERSIONS, runTask } from "../../model/agent.mjs";
import { esc, prov } from "../helpers.mjs";
import { el } from "../ui.mjs";

const MODULES = [
  ["modelo", "Modelo θ", "calcula una distribución sobre el siguiente token; en esta demostración no resuelve las tareas ni propone cambios"],
  ["contexto", "Contexto", "entradas, tokens y activaciones: lo que el modelo ve en cada paso"],
  ["herramientas", "Herramientas", "ejecutan pruebas y leen registros: producen observaciones externas"],
  ["codigo", "Código del agente", "gestor de contexto y estrategia de experimentos: lo que aquí se modificará"],
  ["datos", "Datos", "desarrollo, validación, prueba reservada (sellada) y auditoría"],
  ["entorno", "Entorno de ejecución", "recinto aislado con presupuesto definido"],
  ["evaluador", "Evaluador", "criterio explícito para comparar versiones"],
  ["archivo", "Archivo de versiones", "guarda variantes comparables; guardar no es promover"],
];

export const DEV_TASK = 14;

export function contextState(task, genome) {
  const run = runTask(task, genome);
  const kept = run.managed.context.map((line) => ({ tokens: line.tokens, evidence: !!line.tags.evidence && !line.tags.dup, decoy: !!line.tags.decoy, type: line.type }));
  const keptSet = run.kept;
  const dropped = task.lines.filter((line) => !keptSet.has(line.index) && run.managed.status.get(line.index) === "presupuesto").map((line) => ({ tokens: line.tokens, evidence: !!line.tags.evidence && !line.tags.dup }));
  return { run, kept, dropped };
}

export function logPanelHtml(task, run, { upto = Infinity } = {}) {
  const rows = task.lines.slice(0, upto).map((line) => {
    const state = run.managed.status.get(line.index);
    const ev = line.tags.evidence && !line.tags.dup;
    const mark = state === "incluida" || state === "recortada" ? (ev ? '<span class="ok-t">●</span>' : '<span class="in-t">●</span>') : ev ? '<span class="bad-t">✗</span>' : '<span class="off-t">·</span>';
    const why = state === "incluida" ? "" : state === "recortada" ? " (recortada)" : state === "duplicada" ? " (duplicada)" : state === "tipo" ? " (tipo descartado)" : " (sin presupuesto)";
    const style = ev ? "color:var(--ink)" : "";
    return `<div style="${style}"><span style="color:var(--ink-4)">L${line.index}</span> ${mark} ${esc(line.text)}<span style="color:var(--ink-4)">${why}</span></div>`;
  });
  return `<div style="font:10.5px/1.45 var(--mono);max-height:230px;overflow:auto;color:var(--ink-3)">${rows.join("")}</div>`;
}

export const chapter1 = {
  title: "El laboratorio y sus tres bucles",
  question: "¿Qué tendría que cambiar en un sistema de IA para que su próxima versión también pudiera producir mejores mejoras?",
  setup(ctx) {
    baseVisibility(ctx, { rack: false, agent: true });
    explode(ctx, 0);
    ctx.show(["tray-emb", "tray-b0", "tray-b1", "tray-out", "tray-emb-front", "tray-b0-front", "tray-b1-front", "tray-out-front"], true);
    for (const id of ["cart-v1", "cart-v2", "cart-v3"]) ctx.show(id, false);
    ctx.state("cart-v0", { slot: "active", role: "in" });
    ctx.show("ctx-lines", false);
    ctx.state("contexto", { used: 0 });
    for (const r of [1, 2, 3]) ctx.state(`route${r}`, { off: false });
    ctx.state("evaluador", { value: 0 });
    ctx.theta(ctx.store.print0, "sin cambios");
  },
  desk(ctx) {
    ctx.desk("Aislar bucles", (desk) => {
      const row = el("div", { class: "row" });
      for (const r of [1, 2, 3]) {
        const button = el("button", { class: "btn", "aria-pressed": "true", title: ctx.ROUTES[r].name }, `Bucle ${r}`);
        button.addEventListener("click", () => {
          ctx.user.loops[r] = !ctx.user.loops[r];
          button.setAttribute("aria-pressed", ctx.user.loops[r] ? "true" : "false");
          button.style.opacity = ctx.user.loops[r] ? 1 : 0.5;
          for (const k of [1, 2, 3]) ctx.state(`route${k}`, { off: !ctx.user.loops[k] });
          ctx.refresh();
        });
        row.append(button);
      }
      desk.append(row, el("div", { class: "note" }, "Cian: resolver una tarea. Naranja discontinua: modificar el sistema. Blanca punteada: evaluar si la nueva versión mejora el proceso que produce mejoras."));
    });
  },
  beats: [
    {
      id: "1.1",
      dur: 9,
      scale: "lab",
      camera: labCamera,
      caption: (ctx) => `<b>${ctx.beat.chapter.question}</b>`,
      changed: {},
      more: `<p>Esta experiencia distingue cuatro tipos de cambio:</p><ul>
        <li><b>Inferencia</b>: cambian activaciones y contexto; los pesos permanecen fijos.</li>
        <li><b>Entrenamiento</b>: un procedimiento modifica parámetros usando datos y una función objetivo.</li>
        <li><b>Mejora del agente</b>: cambian herramientas, memoria, código o estrategia de trabajo.</li>
        <li><b>Automejora recursiva (RSI)</b>: modificaciones del sistema vuelven a intervenir en el proceso que produce modificaciones posteriores. Hay que medir si mejoran esa capacidad: cerrar un bucle no garantiza progreso.</li></ul>
        <p>Un Transformer no incorpora RSI por naturaleza. RSI tampoco es sinónimo de conciencia, de conversar consigo mismo, de aumentar el contexto o de generar datos sintéticos.</p>`,
      enter(ctx) {
        ctx.focus(null);
      },
    },
    {
      id: "1.2",
      dur: 16,
      events: 8,
      scale: "lab",
      camera: mainCamera,
      caption: (ctx) => {
        const e = Math.max(1, ctx.event);
        const [, name, text] = MODULES[e - 1];
        return `<b>${name}</b>: ${text}.`;
      },
      changed: {},
      more: `<p>Ocho módulos forman el laboratorio. La disposición es <b>conceptual</b>: las distancias no representan nada físico.</p><p>Haz clic en un módulo para ver su función, sus entradas y sus salidas en este inspector.</p>`,
      pose(ctx, t, e) {
        const shown = Math.max(1, e);
        MODULES.forEach(([id, name], index) => {
          if (index < shown) ctx.tag(`m-${id}`, id, name, { dz: M[id].h + 6, cls: "name" });
        });
        ctx.focus([MODULES[shown - 1][0], MODULES[shown - 1][0] === "modelo" ? "modelo-front" : null].filter(Boolean));
      },
    },
    {
      id: "1.3",
      dur: 12,
      events: 4,
      scale: "lab",
      camera: mainCamera,
      caption: (ctx) =>
        [
          "<b>Inferencia</b>: cambian el contexto y las activaciones; θ queda fijo.",
          "<b>Entrenamiento</b>: un procedimiento cambia θ con datos y una función objetivo.",
          "<b>Mejora del agente</b>: cambian herramientas, memoria, código o estrategia; θ puede quedar fijo.",
          "<b>Automejora recursiva</b>: lo modificado vuelve a intervenir en cómo se producen las siguientes modificaciones. Hay que medirlo.",
        ][Math.max(0, ctx.event - 1)],
      changed: (ctx) => [{}, { contexto: "activo" }, { pesos: "cambió" }, { codigo: "cambió", contexto: "activo" }, { codigo: "cambió", evaluador: "mide el proceso" }][Math.max(0, ctx.event)] || {},
      more: `<p>El indicador «¿Qué cambió?» de arriba se mantiene durante todo el recorrido. Dice qué coordenadas del sistema cambian en cada momento y cuáles permanecen fijas (gris).</p>`,
      pose(ctx, t, e) {
        const focus = [[], ["contexto"], ["modelo", "modelo-front"], ["codigo", "herramientas"], ["codigo", "proponente", "archivo", "evaluador"]][Math.max(0, e)];
        ctx.focus(focus.length ? focus : null);
        ctx.panel("defs", {
          title: "Cuatro tipos de cambio",
          html: `<div style="display:grid;gap:6px;font-size:12px">${[
            ["Inferencia", "contexto, activaciones", "θ fijo"],
            ["Entrenamiento", "θ (parámetros)", "datos + objetivo"],
            ["Mejora del agente", "herramientas, memoria, código, estrategia", "θ puede seguir fijo"],
            ["Automejora recursiva", "lo anterior, aplicado al proceso de mejora", "requiere medir si mejora ese proceso"],
          ]
            .map(([a, b, c], i) => `<div style="opacity:${i < e ? 1 : 0.35}"><b style="color:var(--ink)">${a}</b> — cambia: ${b} · ${c}</div>`)
            .join("")}<div class="note" style="color:var(--ink-3);margin-top:4px">No es RSI por sí solo: conciencia, conversación consigo mismo, ampliar el contexto, generar datos sintéticos.</div></div>`,
          width: 330,
        });
      },
    },
    ...[1, 2, 3].map((r) => ({
      id: `1.${3 + r}`,
      dur: 9,
      scale: "lab",
      camera: mainCamera,
      caption: [
        "<b>Bucle 1 · resolver una tarea</b>: datos → contexto → modelo → herramientas → entorno → evaluador → contexto.",
        "<b>Bucle 2 · modificar el sistema</b>: el evaluador informa al proponente, que construye una variante del código; se ejecuta, se evalúa y se archiva.",
        "<b>Bucle 3 · evaluar el proceso</b>: las versiones promovidas vuelven a participar en el análisis. ¿Mejoran la capacidad de producir mejoras? Cerrar el bucle no lo garantiza.",
      ][r - 1],
      changed: [{ contexto: "activo" }, { codigo: "variante", evaluador: "fijo" }, { codigo: "participa", evaluador: "mide el proceso" }][r - 1],
      more: `<p>${ctx_more(r)}</p>`,
      pose(ctx, t) {
        for (const k of [1, 2, 3]) ctx.state(`route${k}`, { off: k !== r || !ctx.user.loops[k] });
        const stops = ctx.ROUTES[r].stops;
        ctx.focus([`route${r}`, ...stops, ...(stops.includes("modelo") ? ["modelo-front"] : [])]);
        if (r === 1) ctx.tag("lb-concept", "modelo", "conexión conceptual · aquí diagnostica un solucionador de reglas", { dz: M.modelo.h + 10, role: "off" });
        if (r === 2) ctx.tag("lb-rules", "proponente", "proponente de reglas programadas", { dz: M.proponente.h + 8, role: "g" });
        if (ctx.still.matches || t <= 0.001) return;
        for (let i = 0; i < 3; i++) ctx.pulse(i, { route: r, s: (t * 1.4 + i / 3) % 1, role: ctx.ROUTES[r].role === "hi" ? "hi" : ctx.ROUTES[r].role });
      },
    })),
    {
      id: "1.7",
      dur: 12,
      events: 3,
      scale: "lab",
      camera: () => moduleCamera(["contexto", "datos", "evaluador", "codigo"], 10),
      caption: (ctx) =>
        [
          "El ejemplo transversal: un agente de programación depura una tarea de desarrollo con su gestor de contexto <b>v0</b>.",
          "v0 llena el presupuesto de 64 tokens con registros completos desde el inicio: la evidencia del final <b>no cabe</b> (tiras rojas caídas).",
          failText(ctx),
        ][Math.max(0, ctx.event - 1)],
      changed: { contexto: "cambió", datos: "fijo" },
      more: (ctx) => {
        const task = ctx.store.splits().dev[DEV_TASK];
        return `<p>Tarea de desarrollo ${task.seed} (familia ${task.family}). El «agente» de estas escenas no es un LLM: un gestor de contexto elige líneas del registro y un <b>solucionador simbólico</b> de reglas declaradas intenta identificar función y causa.</p><p>Verde: evidencia necesaria dentro del contexto. Rojo caído: evidencia que no cupo. ${prov("local")}</p>`;
      },
      pose(ctx, t, e) {
        for (const k of [1, 2, 3]) ctx.state(`route${k}`, { off: k !== 1 });
        const task = ctx.store.splits().dev[DEV_TASK];
        const { run, kept, dropped } = contextState(task, VERSIONS.v0);
        ctx.show("ctx-lines", true);
        const share = e <= 1 ? Math.min(1, t * 3) : 1;
        ctx.state("ctx-lines", { kept: kept.slice(0, Math.ceil(kept.length * share)), dropped: e >= 2 ? dropped : [] });
        ctx.state("contexto", { used: 0, fill: (run.cost / 64) * share });
        ctx.state("evaluador", { value: 0, fail: e >= 3 });
        ctx.focus(["contexto", "ctx-lines", "datos", "evaluador", "cart-v0", "codigo"]);
        ctx.tag("lbl-v0", "cart-v0", "gestor v0", { dz: 12, role: "in" });
        ctx.panel("log", { title: `Registro de la tarea ${task.seed} · gestor v0`, provKind: "local", html: logPanelHtml(task, run) + `<div class="subst">contexto: ${run.cost}/64 tokens · cobertura de evidencia ${(run.coverage * 100).toFixed(0)} %${e >= 3 ? ` · <b class="bad-t">fallo</b>: ${esc(run.steps[run.steps.length - 1])}` : ""}</div>`, width: 430, dock: "left" });
        if (e < 1) ctx.pulse(0, { route: 1, s: t * 3 * 0.2, role: "in" });
      },
    },
    {
      id: "1.8",
      dur: 8,
      scale: "model",
      camera: () => rackCamera(1),
      camSeconds: 2.4,
      caption: "La cámara entra en el modelo: las bandejas del bastidor suben fuera del gabinete (<b>vista explosionada</b>). En esta demostración el modelo no produce las propuestas del agente.",
      changed: { contexto: "activo" },
      more: `<p>A partir de aquí el mismo laboratorio se ve a escala <b>modelo</b>: cada bandeja del bastidor es una etapa del Transformer didáctico y conserva su identidad al subir.</p>`,
      pose(ctx, t) {
        ctx.show("ctx-lines", false);
        ctx.state("evaluador", { value: 0, fail: false });
        ctx.show(RACK_IDS.filter((id) => !id.startsWith("card")), true);
        explode(ctx, t);
        ctx.focus(["modelo", "modelo-front", "tray-emb", "tray-b0", "tray-b1", "tray-out", "tray-emb-front", "tray-b0-front", "tray-b1-front", "tray-out-front"]);
      },
    },
  ],
};

function failText(ctx) {
  const task = ctx.store.splits().dev[DEV_TASK];
  const { run } = contextState(task, VERSIONS.v0);
  return run.answer
    ? `Sin la evidencia, el solucionador se queda con un <b>señuelo</b> (${esc(run.answer.culprit)}): <b>fallo</b>. Este fallo concreto es lo que el agente intentará mejorar.`
    : "El solucionador no encuentra la causa: <b>fallo</b>. Este fallo concreto es lo que el agente intentará mejorar.";
}

function ctx_more(r) {
  return [
    "En este bucle el sistema usa lo que ya es: el contexto cambia en cada paso y los parámetros θ del modelo no. Las observaciones de herramientas y del evaluador vuelven al contexto.",
    "Aquí cambia el código del agente (por ejemplo, su gestor de contexto). Una variante sólo se promueve si cumple un criterio explícito sobre tareas de validación.",
    "La recursión aparece cuando la versión promovida participa en el análisis y la propuesta de las siguientes variantes. Eso introduce autorreferencia, pero no demuestra por sí solo una aceleración de la mejora: hay que medirlo con el mismo presupuesto.",
  ][r - 1];
}
