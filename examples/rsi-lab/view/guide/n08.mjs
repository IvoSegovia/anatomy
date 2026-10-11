import { manageContext, BUDGET } from "../../model/agent.mjs";
import { readDiagnosis } from "../../model/loop.mjs";
import { traceOf, metricsOf } from "../ch/c08.mjs";
import { esc } from "../helpers.mjs";

const pc = (x) => `${Math.round(x * 100)} %`;
const seenWith = (detail, genome) => manageContext(detail.raw, genome, BUDGET).context.filter((l) => readDiagnosis(l.text)).length;
const totalDiag = (detail) => detail.raw.filter((l) => l.tags.diag).length;
const ruleLine = (c) => (c.rule === "aleatoria" ? `no llegó ningún diagnóstico legible, así que se activa la regla aleatoria: «${esc(c.proposal)}»` : `se activa la regla «${esc(c.rule)}»: «${esc(c.proposal)}»`);
const diffText = (c) => (c.diff.length ? c.diff.map(esc).join("; ") : "ningún cambio");
const evalText = (c) =>
  c.built
    ? `${esc(c.activeBefore)} acierta ${pc(c.val.active)} y ${esc(c.candidate)} ${pc(c.val.candidate)} en las mismas ${c.val.n} tareas de validación. Motivo: ${esc(c.reason)}. **${esc(c.outcome)}.** Presupuesto de búsqueda: ${c.before.search} → ${c.after.search} de ${c.after.limit} ejecuciones.`
    : "La candidata es inválida y no se evalúa: se cobra el análisis de desarrollo y se libera la reserva de validación.";

const decisionCues = (c) => (c && c.built ? [{ at: 0.3, op: "evaluate", targets: ["evaluador"] }, { at: 0.92, op: c.promoted ? "promote" : "reject", targets: ["codigo"] }] : [{ at: 0.5, op: "reject", label: "candidata inválida", targets: ["codigo"] }]);

export const N08 = {
  "8.1": [
    {
      concept: "proponente",
      look: ["codigo", "proponente", "cart-an", "route3"],
      orient: "Hasta ahora las variantes eran guionadas. En este capítulo las produce un [[proponente|proponente de reglas]], a partir de [[informe_fallo|informes de fallo]] de tareas de desarrollo, y el bucle arranca otra vez desde v0. Lo nuevo: el proponente lee cada informe **a través del gestor de contexto de la versión activa** (el cartucho {{cart-an|analista}}). El Transformer no interviene en este proceso.",
    },
  ],
  "8.2": [
    {
      concept: "estado",
      look: ["codigo", "proponente", "archivo"],
      orient: "El estado del sistema que puede cambiar es [[estado|S_t = (θ_t, código_t, memoria_t, estrategia_t)]]. Aquí θ queda congelado. Cambian el código (el gestor), la memoria del proponente (qué variantes ya probó) y, en el modo B, la estrategia: cuántas tareas de validación usa por candidata. El presupuesto y el protocolo de evaluación quedan fuera de S_t: los fija quien diseña el experimento.",
    },
  ],
  "8.3": [
    {
      span: 3,
      concept: "proponente",
      look: ["archivo", "proponente", "codigo", "datos"],
      orient: "El ciclo tiene siete pasos. Los tres primeros: elegir un padre del archivo (casi siempre la versión activa), analizar los informes de fallo de ese padre en las 16 tareas de desarrollo y proponer una variante con las reglas.",
      act: "Pasos 1 a 3: padre, análisis, propuesta.",
      cues: [{ at: 0.05, op: "lookup", targets: ["archivo"] }, { at: 0.5, op: "transfer", targets: ["proponente"] }],
      seconds: 3,
    },
    {
      span: 4,
      concept: "protocolo",
      look: ["entorno", "evaluador", "archivo", "codigo"],
      orient: "Los cuatro siguientes: ejecutar la candidata con presupuesto definido, evaluarla contra la activa y archivarla, promoverla sólo si cumple el criterio y, en el modo B, usar la versión promovida en los ciclos siguientes. Un ciclo completo reserva 16 ejecuciones de desarrollo más dos veces las de validación.",
      act: "Pasos 4 a 7: ejecutar, evaluar y archivar, promover, reutilizar.",
      cues: [{ at: 0.1, op: "evaluate", targets: ["evaluador"] }, { at: 0.75, op: "transfer", targets: ["codigo"] }],
      seconds: 3,
    },
  ],
  "8.4": [
    {
      concept: "informe_fallo",
      look: ["proponente", "cart-an", "datos"],
      orient: (ctx) => {
        const { run, P } = traceOf(ctx);
        return `Seguimos un ciclo real: modo ${run.mode}, semilla ${run.seed}, ciclo ${P.index}. En el panel está un informe de fallo de una tarea de desarrollo: una cabecera de líneas INFO, líneas DEBUG con el diagnóstico (en negrita) y el ERROR. El proponente no lo lee entero: lo lee a través del gestor del analista, ${esc(P.analyst)}, con un límite de 64 tokens.`;
      },
      act: "El gestor del analista elige qué líneas del informe llegan al proponente.",
      cues: [{ at: 0.4, op: "mask", label: "líneas que no llegan", targets: ["cart-an"] }],
      seconds: 1.4,
      result: (ctx) => {
        const { P } = traceOf(ctx);
        const d = P.analysis.details[0];
        const seen = seenWith(d, P.analystGenome);
        return `Con ${esc(P.analyst)} llegan **${seen} de ${totalDiag(d)}** diagnósticos de este informe. ${seen === 0 ? "La cabecera INFO llena los 64 tokens antes de que aparezcan: es el mismo problema que tenía v0 con la evidencia de la tarea 114, ahora en la lectura de los informes." : "Los diagnósticos entran en los 64 tokens."}`;
      },
    },
    {
      concept: "proponente",
      look: ["proponente", "codigo", "cart-an"],
      orient: "Esto es todo lo que recibe el proponente: la lista de diagnósticos que llegaron. Sus reglas son fijas: si ve «excluida por presupuesto», cambia cómo se seleccionan las líneas; si ve «descartada por filtro de tipo», deja de descartar ese tipo; si no ve nada legible, cambia un campo al azar.",
      act: "El proponente aplica sus reglas a esa entrada.",
      cues: [{ at: 0.9, op: "transfer", targets: ["codigo"] }],
      seconds: 1.4,
      result: (ctx) => {
        const { P } = traceOf(ctx);
        return `Con lo que recibió, ${ruleLine(P)}. Cambio en el gestor: ${diffText(P)}. La propuesta sale de esa entrada y de reglas escritas; no es un guion ni un modelo de lenguaje.`;
      },
    },
    {
      concept: "protocolo",
      look: ["evaluador", "entorno", "archivo", "codigo"],
      orient: (ctx) => {
        const { P } = traceOf(ctx);
        return P.built ? `La candidata ${esc(P.candidate)} se mide contra la activa, ${esc(P.activeBefore)}, en las mismas ${P.val.n} tareas de validación. Cada ejecución se cobra al presupuesto de búsqueda: 16 de desarrollo ya gastadas más ${2 * P.val.n} de validación, porque se ejecutan las dos versiones.` : "La candidata de este ciclo quedó inválida (descarta incluso los ERROR).";
      },
      act: "Se ejecutan la activa y la candidata, y se aplica el criterio.",
      cues: (ctx) => decisionCues(traceOf(ctx).P),
      seconds: 1.6,
      result: (ctx) => evalText(traceOf(ctx).P),
    },
  ],
  "8.5": [
    {
      concept: "contrafactual",
      look: ["proponente", "cart-an", "datos"],
      orient: (ctx) => {
        const { run, P, Q, promoted } = traceOf(ctx);
        if (!Q) return "Con esta semilla no hubo un ciclo siguiente.";
        const who = run.mode === "B" && promoted ? `La versión promovida, ${esc(P.candidate)}, pasa a ser el gestor del analista.` : run.mode === "A" ? "En el modo A el analista sigue siendo v0 aunque haya promociones." : "No hubo promoción, así que el analista no cambia.";
        return `${who} Ciclo ${Q.index}: otro informe de fallo. La columna izquierda muestra qué habría llegado con el analista anterior (${esc(P.analyst)}); la derecha, lo que llega ahora con ${esc(Q.analyst)}. Es el mismo informe.`;
      },
      act: "Mismo informe, filtrado por los dos gestores.",
      cues: [{ at: 0.1, op: "transfer", label: "el gestor promovido pasa al analista", targets: ["cart-an"] }, { at: 0.6, op: "mask", label: "líneas que no llegan", targets: ["cart-an"] }],
      seconds: 1.6,
      result: (ctx) => {
        const { P, Q } = traceOf(ctx);
        if (!Q) return "Sin ciclo siguiente.";
        const d = Q.analysis.details[0];
        const before = seenWith(d, P.analystGenome);
        const now = seenWith(d, Q.analystGenome);
        return `Con ${esc(P.analyst)} habrían llegado ${before} de ${totalDiag(d)} diagnósticos; con ${esc(Q.analyst)} llegan **${now}**. ${now !== before ? `La diferencia viene del cambio promovido en el ciclo anterior (${diffText(P)}): ese cambio ahora también decide qué lee el proponente.` : "El cambio del ciclo anterior no modificó lo que lee el proponente en este informe."}`;
      },
    },
    {
      concept: "autorreferencia",
      look: ["proponente", "codigo", "cart-an"],
      orient: "Mismas reglas, otra entrada. Veamos qué regla se activa ahora.",
      act: "El proponente aplica sus reglas.",
      cues: [{ at: 0.9, op: "transfer", targets: ["codigo"] }],
      seconds: 1.4,
      result: (ctx) => {
        const { P, Q } = traceOf(ctx);
        if (!Q) return "Sin ciclo siguiente.";
        const directedNow = Q.rule !== "aleatoria";
        const before = seenWith(Q.analysis.details[0], P.analystGenome);
        const tail = directedNow && P.rule === "aleatoria" && before === 0 ? ` Con el analista anterior habría sido aleatoria. Ahí está la [[autorreferencia|autorreferencia]] de esta demostración: la modificación volvió a intervenir en el proceso que produce modificaciones.` : "";
        return `Ahora ${ruleLine(Q)}. El cambio completo está en el panel.${tail}`;
      },
    },
    {
      concept: "protocolo",
      look: ["evaluador", "entorno", "archivo", "codigo"],
      orient: "Que la propuesta sea dirigida no la hace buena. Se evalúa con el mismo protocolo que cualquier otra.",
      act: "Se ejecutan la activa y la candidata, y se aplica el criterio.",
      cues: (ctx) => decisionCues(traceOf(ctx).Q),
      seconds: 1.6,
      result: (ctx) => {
        const { Q } = traceOf(ctx);
        if (!Q) return "Sin ciclo siguiente.";
        return `${evalText(Q)} Todavía hay que medir si esto ayuda en general: repetir el ciclo no garantiza progresar.`;
      },
    },
  ],
  "8.6": [
    {
      concept: "ab",
      look: ["archivo", "proponente", "evaluador", "codigo"],
      orient: "¿Ayuda en general que las versiones promovidas participen? Comparamos dos modos con las mismas semillas, los mismos datos, el mismo criterio y el mismo presupuesto máximo: **A**, con el analista fijo en v0, y **B**, donde el analista es la versión activa.",
      act: "Se corre el bucle completo en los dos modos.",
      cues: [{ at: 0.9, op: "evaluate", targets: ["evaluador"] }],
      seconds: 1.4,
      result: (ctx) => {
        const seed = ctx.user.loopSeed;
        const rows = ctx.store.loopReady() ? ctx.store.loopCompare() : null;
        if (!rows) return "Calculando las 24 corridas…";
        const r = rows.find((x) => x.seed === seed) || rows[0];
        return `Semilla ${r.seed}: en la prueba final, que se usa una sola vez al terminar, A llega a ${pc(r.A.finalTest)} y B a ${pc(r.B.finalTest)}. La línea del gráfico es la auditoría de la versión activa, ciclo a ciclo. Un caso no alcanza.`;
      },
    },
    {
      concept: "ab",
      look: ["archivo", "proponente", "evaluador", "codigo"],
      orient: "Ahora las doce semillas. Cada columna es una semilla: gris, A; naranja, B.",
      act: "Doce corridas por modo.",
      cues: [{ at: 0.9, op: "evaluate", targets: ["evaluador"] }],
      seconds: 1.4,
      result: (ctx) => {
        const rows = ctx.store.loopReady() ? ctx.store.loopCompare() : null;
        if (!rows) return "Calculando las 24 corridas…";
        const better = rows.filter((r) => r.B.finalTest > r.A.finalTest + 1e-9).length;
        const worse = rows.filter((r) => r.B.finalTest < r.A.finalTest - 1e-9).length;
        const stuck = rows.filter((r) => r.A.promotions === 0 && r.B.promotions === 0).length;
        return `En la prueba final, B termina mejor en ${better} semillas, igual en ${rows.length - better - worse} y peor en ${worse}.${stuck ? ` En ${stuck} de ellas ningún modo logró promover nada.` : ""} Cerrar el bucle ayudó en este experimento, pero no en todas las semillas, y estas cifras dependen de reglas inventadas para la demostración.`;
      },
    },
  ],
  "8.7": [
    {
      concept: "mejora_valida",
      look: ["evaluador", "archivo", "entorno"],
      orient: (ctx) => {
        const rows = ctx.store.loopReady() ? ctx.store.loopCompare() : null;
        if (!rows) return "Calculando las 24 corridas…";
        const m = metricsOf(rows);
        return `Tres medidas separadas, no un único marcador de «inteligencia»: **rendimiento** (prueba final media: A ${pc(m.A.test)}, B ${pc(m.B.test)}), **[[mejora_valida|mejoras válidas]]** (A ${m.A.valid}, B ${m.B.valid}) y **coste por mejora** (A ${m.A.costPer}, B ${m.B.costPer}). Abajo, el gasto medio por categoría: el límite de búsqueda es el mismo, ${m.limit}; auditoría y prueba tienen presupuesto aparte.`;
      },
    },
  ],
  "8.8": [
    {
      concept: "autorreferencia",
      look: ["route3", "archivo", "proponente", "cart-an"],
      orient: "Reutilizar un sistema modificado introduce autorreferencia, pero no demuestra por sí solo una aceleración de la mejora: eso hay que medirlo, y puede no ocurrir. Además, lo que se modifica aquí es la configuración del gestor de un agente simulado, con reglas escritas por nosotros. No es entrenar el Transformer ni una automejora general, ilimitada o garantizada.",
    },
  ],
};
