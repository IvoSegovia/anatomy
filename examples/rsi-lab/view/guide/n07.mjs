import { VERSIONS, runTask, BUDGET } from "../../model/agent.mjs";
import { esc } from "../helpers.mjs";

const pc = (x) => `${Math.round(x * 100)} %`;
const sg = (x) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(2)}`;
const taskOf = (ctx) => ctx.store.splits().dev[ctx.user.task ?? 14];
const ev = (ctx) => ctx.store.evals();
const cmp = (ctx, a, b) => ctx.store.compare(a, b);
const evidenceIds = (task) => task.lines.filter((l) => l.tags.evidence && !l.tags.dup).map((l) => `L${l.index}`);
const keptRange = (run) => {
  const kept = [...run.kept].sort((a, b) => a - b);
  return kept.length ? `L${kept[0]}–L${kept[kept.length - 1]}` : "ninguna";
};
const causeLine = (task) => task.lines.find((l) => l.tags.evidence === "E3") || task.lines.find((l) => l.tags.evidence === "E1");

export const N07 = {
  "7.1": [
    {
      concept: "mejora_agente",
      look: ["modelo", "modelo-front", "codigo", "cart-v0"],
      orient: "Ahora el agente mejora su propio gestor de contexto. El {{modelo|modelo base}} queda congelado (gris): sus parámetros no cambian en todo el capítulo. Lo que puede cambiar es el {{codigo|código del agente}}, su gestor, hoy {{cart-v0|v0}}. Aviso: las variantes de este capítulo, v1, v2 y v3, son **propuestas guionadas**, escritas de antemano. Lo que se calcula de verdad es cómo les va en el banco de tareas.",
    },
  ],
  "7.2": [
    {
      span: 3,
      concept: "gestor_contexto",
      look: ["contexto", "ctx-lines", "datos", "evaluador", "cart-v0"],
      orient: (ctx) => {
        const task = taskOf(ctx);
        return `Volvemos a la tarea ${task.seed} con v0. En el panel, cada línea del registro tiene su número, de L0 a L${task.lines.length - 1}, para poder seguirla. Las tres que hacen falta para acertar son ${evidenceIds(task).join(", ")}: la evidencia de la falla real.`;
      },
      act: "v0 copia en orden hasta llenar 64 tokens, y el solucionador decide con eso.",
      cues: [{ at: 0.1, op: "transfer", targets: ["contexto"] }, { at: 0.66, op: "mask", label: "líneas que no cupieron", targets: ["ctx-lines"] }, { at: 0.95, op: "evaluate", targets: ["evaluador"] }],
      result: (ctx) => {
        const task = taskOf(ctx);
        const run = runTask(task, VERSIONS.v0);
        return `v0 conserva ${keptRange(run)} y pierde ${evidenceIds(task).join(", ")}. ${run.success ? "Aun así acierta en esta tarea." : `El solucionador concluye ${esc(run.answer ? run.answer.culprit : "nada")}: **fallo**.`} Es el mismo caso del capítulo 1.`;
      },
    },
  ],
  "7.3": [
    {
      concept: "gestor_contexto",
      look: ["proponente", "cart-v1", "cart-v0", "codigo"],
      orient: "Se registra el diagnóstico: «la evidencia quedó fuera por presupuesto». A partir de él se escribe una variante, {{cart-v1|v1}}: quitar líneas duplicadas, dar puntos a cada línea según su tipo (ERROR 3, TRACE 2, DEBUG 1) y por mencionar la prueba fallida, y llenar los 64 tokens con las de más puntaje. El panel muestra el cambio en pseudocódigo. Es una propuesta guionada.",
    },
  ],
  "7.4": [
    {
      concept: "gestor_contexto",
      look: ["contexto", "ctx-lines", "cart-v1"],
      orient: "Ahora el **mismo registro** pasa por v1, con el mismo límite de 64 tokens. El panel tiene dos columnas: qué conservó v0 y qué conserva v1. Así podés seguir una misma línea, por ejemplo L3, en las dos ramas.",
      act: "v1 quita duplicados, puntúa cada línea y copia las de mayor puntaje.",
      cues: [{ at: 0.2, op: "mask", label: "líneas descartadas", targets: ["ctx-lines"] }, { at: 0.8, op: "transfer", targets: ["contexto"] }],
      result: (ctx) => {
        const run = runTask(taskOf(ctx), VERSIONS.v1);
        return `v1 conserva ${run.managed.context.length} líneas (${run.cost} de ${BUDGET} tokens). Deja afuera las INFO del arranque, que valen 0 puntos, y se queda con las ERROR, TRACE y DEBUG que caben.`;
      },
    },
    {
      concept: "evidencia",
      look: ["contexto", "ctx-lines", "evaluador"],
      orient: "Fijate en las filas resaltadas con ★: la evidencia. Compará sus dos columnas.",
      act: "Se comparan las dos ramas y el solucionador decide con cada una.",
      cues: [{ at: 0.9, op: "evaluate", targets: ["evaluador"] }],
      result: (ctx) => {
        const task = taskOf(ctx);
        const r0 = runTask(task, VERSIONS.v0);
        const r1 = runTask(task, VERSIONS.v1);
        const line = causeLine(task);
        const lost0 = r0.managed.status.get(line.index) !== "incluida";
        const kept1 = r1.managed.status.get(line.index) === "incluida";
        return `L${line.index}, «${esc(line.text)}», es el [[evidencia|diagnóstico]]: dice dónde y por qué falla. ${lost0 ? "v0 la perdió porque llega tarde en el registro y el espacio ya estaba lleno" : "v0 también la conservó"}; ${kept1 ? "v1 la conserva porque puntúa DEBUG y suma puntos por mencionar una función de la prueba fallida" : "v1 tampoco la conservó"}. Con v1 el solucionador ${r1.success ? `**acierta**: ${esc(r1.answer.culprit)}, causa «${esc(r1.answer.cause)}»` : "**sigue fallando**"}.`;
      },
    },
  ],
  "7.5": [
    {
      concept: "particiones",
      look: ["datos", "evaluador"],
      orient: "Una sola tarea no alcanza para decidir. Se comparan v0 y v1 en las **mismas 40 tareas de validación**, con el mismo límite. En el panel cada cuadradito es una tarea: verde acierto, rojo fallo.",
      act: "Se ejecutan v0 y v1 en las 40 tareas.",
      cues: [{ at: 0.9, op: "evaluate", targets: ["evaluador"] }],
      seconds: 1.4,
      result: (ctx) => {
        const e = ev(ctx);
        const { ci } = cmp(ctx, "v0", "v1");
        return `v0 acierta ${pc(e.v0.valid.success)} y v1 ${pc(e.v1.valid.success)}. Tarea por tarea, v1 gana en ${ci.wins}, pierde en ${ci.losses} y empata en ${ci.ties}. Diferencia media: ${sg(ci.mean)}.`;
      },
    },
    {
      concept: "ic95",
      look: ["evaluador", "codigo", "archivo", "cart-v1", "cart-v0"],
      orient: "El [[criterio|criterio]] de promoción, fijado antes de mirar: promover sólo si el [[ic95|intervalo de confianza del 95 %]] de la diferencia de éxito queda entero por encima de 0. Así un azar favorable en pocas tareas no alcanza.",
      act: "Se aplica el criterio.",
      cues: [{ at: 0.9, op: "promote", targets: ["cart-v1", "codigo"] }],
      seconds: 1.2,
      result: (ctx) => {
        const { ci, verdict } = cmp(ctx, "v0", "v1");
        return `IC95 de la diferencia: [${sg(ci.low)}, ${sg(ci.high)}]: **${verdict}**. {{cart-v1|v1}} pasa a la ranura activa y {{cart-v0|v0}} queda en el archivo. Cambió el código del agente; el modelo no.`;
      },
    },
  ],
  "7.6": [
    {
      concept: "metrica_compuesta",
      look: ["cart-v2", "evaluador", "codigo"],
      orient: "Segunda propuesta guionada, {{cart-v2|v2}}: ahorrar espacio quedándose sólo con líneas ERROR y TRACE.",
      act: "v2 se evalúa en las mismas 40 tareas.",
      cues: [{ at: 0.9, op: "evaluate", targets: ["evaluador"] }],
      seconds: 1.2,
      result: (ctx) => {
        const e = ev(ctx);
        return `v2 es más barata: ${e.v2.valid.cost.toFixed(1)} tokens por tarea frente a ${e.v1.valid.cost.toFixed(1)} de v1. Pero acierta ${pc(e.v2.valid.success)} contra ${pc(e.v1.valid.success)}.`;
      },
    },
    {
      concept: "puerta",
      look: ["cart-v2", "evaluador", "archivo"],
      orient: (ctx) => `¿Compensa el ahorro? Una [[metrica_compuesta|métrica compuesta]] resta al éxito λ·coste/64, con λ = ${(ctx.user.lambda ?? 0.1).toFixed(2)} (podés cambiarlo en la mesa). Pero antes hay una [[puerta|puerta de corrección]]: si el éxito empeora con claridad, se rechaza, valga lo que valga la métrica.`,
      act: "Se aplica la puerta de corrección.",
      cues: [{ at: 0.9, op: "reject", targets: ["cart-v2"] }],
      seconds: 1.2,
      result: (ctx) => {
        const e = ev(ctx);
        const { ci } = cmp(ctx, "v1", "v2");
        const lam = ctx.user.lambda ?? 0.1;
        const comp = (v) => e[v].valid.success - lam * (e[v].valid.cost / BUDGET);
        return `IC95 de la diferencia: [${sg(ci.low)}, ${sg(ci.high)}], entero por debajo de 0: **regresión**. Con λ = ${lam.toFixed(2)} la métrica compuesta ${comp("v2") > comp("v1") ? "preferiría v2" : "también prefiere v1"}; la puerta la rechaza igual. v2 perdió la causa: descartó las líneas DEBUG.`;
      },
    },
  ],
  "7.7": [
    {
      concept: "ic95",
      look: ["cart-v3", "evaluador", "archivo"],
      orient: "Tercera propuesta guionada, {{cart-v3|v3}}: recortar cada línea a sus primeras 6 palabras, para que entren más líneas en los 64 tokens.",
      act: "v3 se evalúa en las mismas 40 tareas.",
      cues: [{ at: 0.9, op: "evaluate", targets: ["evaluador"] }],
      seconds: 1.2,
      result: (ctx) => {
        const { ci, verdict } = cmp(ctx, "v1", "v3");
        return `Diferencia ${sg(ci.mean)}, IC95 [${sg(ci.low)}, ${sg(ci.high)}]: incluye el 0, así que **${verdict}**. Gana en ${ci.wins} tareas y pierde en ${ci.losses}: a veces el recorte deja afuera la palabra que nombra la causa.`;
      },
    },
  ],
  "7.8": [
    {
      concept: "archivo",
      look: ["archivo", "cart-v0", "cart-v2", "cart-v3", "codigo", "cart-v1"],
      orient: "**Archivar no es promover.** {{cart-v2|v2}} y {{cart-v3|v3}} se guardan en el {{archivo|archivo}} junto con {{cart-v0|v0}}: v2 es la más barata y podría servir como punto de partida para otra exploración. Pero la versión activa sigue siendo {{cart-v1|v1}}.",
    },
  ],
  "7.9": [
    {
      concept: "prueba_reservada",
      look: ["datos", "evaluador"],
      orient: (ctx) => {
        const e = ev(ctx);
        return `Al terminar, la [[prueba_reservada|prueba reservada]]: 60 tareas que no se usaron para nada. Se evalúa una sola vez la versión elegida: v1 acierta ${pc(e.v1.test.success)}; como referencia, v0 ${pc(e.v0.test.success)}. Este número no vuelve a la búsqueda: si lo usáramos para elegir, dejaría de ser independiente.`;
      },
    },
  ],
  "7.10": [
    {
      concept: "particiones",
      look: ["datos", "proponente"],
      orient: "Un riesgo que queda: v1, v2 y v3 se compararon con las mismas 40 tareas de validación. Consultarlas una y otra vez también puede sobreajustar la elección a ese conjunto. Por eso hay auditoría y prueba reservada aparte, y un registro de accesos que dice quién leyó qué. En el capítulo 8 ese registro sale del bucle real.",
    },
  ],
};
