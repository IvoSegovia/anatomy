import { ACTIONS } from "../../model/rl.mjs";
import { softmax } from "../../model/linalg.mjs";
import { show, evalExpr } from "../../model/evo.mjs";
import { esc } from "../helpers.mjs";

const n2 = (x) => (Math.round(x * 100) / 100).toFixed(2).replace("-", "−");
const pct = (x) => `${(Math.round(x * 1000) / 10).toFixed(1)} %`;
const refl = (ctx) => ctx.store.reflection().log;
const testsText = (entry) => entry.results.filter((r) => !r.ok).map((r) => `promedio(${esc(JSON.stringify(r.entrada))})`).join(" y ");
const actName = (i) => `«${ACTIONS[i].label}»`;

function likeBestFit(program) {
  const value = (s, r, k) => evalExpr(program, { s, r, k });
  for (const s of [20, 45, 70])
    for (const k of [0, 3])
      for (let r = 20; r < 100; r += 10) if (!(value(s, r, k) > value(s, r + 10, k))) return false;
  for (const s of [20, 70]) for (const r of [30, 60]) if (value(s, r, 0) !== value(s, r, 3)) return false;
  return true;
}

const attemptSteps = (n) => [
  {
    span: 2,
    concept: "reflexion",
    look: ["a-gen", "a-tests", "a-memory"],
    orient: (ctx) =>
      n === 1
        ? "Estación A: [[reflexion|reflexión con herramientas]]. La tarea es escribir promedio(lista) y hay 4 pruebas. Los intentos de código son **propuestas guionadas**: los escribimos de antemano, no los genera un modelo. Lo que sí se ejecuta de verdad son las pruebas, y lo que cambia es la memoria."
        : `Intento ${n}. La {{a-memory|memoria}} con ${n - 1 === 1 ? "la nota anterior" : "las notas anteriores"} entra al contexto del siguiente intento, también guionado. Veamos si las pruebas lo confirman.`,
    act: `Entra el intento ${n} y el ejecutor corre las 4 pruebas.`,
    cues: [{ at: 0.1, op: "transfer", targets: ["a-gen"] }, { at: 0.95, op: "evaluate", targets: ["a-tests"] }],
    seconds: 2,
    result: (ctx) => {
      const entry = refl(ctx)[n - 1];
      return entry.passed === 4 ? `**4 de 4 pruebas correctas.** Las notas guardadas cubrieron los dos casos que fallaban. En toda la estación, ningún parámetro del modelo cambió: cambió el contexto, porque la memoria entró en él.` : `${entry.passed} de 4 correctas. Falla ${testsText(entry)}. Ese resultado es una [[observacion|observación]] externa: viene de ejecutar el código, no de que el sistema se juzgue a sí mismo.`;
    },
  },
  ...(n < 3
    ? [
        {
          concept: "reflexion",
          look: ["a-memory"],
          orient: "Ahora se escribe una nota que resume la prueba fallida. Aquí la nota es una plantilla fija, no texto de un modelo de lenguaje.",
          act: "Se guarda la nota en memoria.",
          cues: [{ at: 0.9, op: "transfer", targets: ["a-memory"] }],
          seconds: 1.2,
          result: (ctx) => `Nota ${n}: «${esc(refl(ctx)[n - 1].note)}». La {{a-memory|memoria}} creció; θ no cambió. La «mejora» de esta estación vive en el contexto del próximo intento.`,
        },
      ]
    : []),
];

export const N06 = {
  "6.1": [
    {
      concept: "tres_estaciones",
      look: ["estA", "estB", "estC"],
      orient: "Tres estaciones con mecanismos distintos que pueden contribuir a mejorar un sistema. Para cada una nos preguntamos dos cosas: **qué señal recibe** (qué le dice si lo hizo bien) y **qué modifica**. No forman una secuencia obligatoria ni son, por sí solas, automejora recursiva.",
    },
  ],
  "6.2": [...attemptSteps(1), ...attemptSteps(2), ...attemptSteps(3)],
  "6.3": [
    {
      concept: "politica",
      look: ["b-policy", "b-batch"],
      orient: "Estación B: aprendizaje por refuerzo con [[reinforce|REINFORCE]]. Una [[politica|política]] pequeña elige entre 4 estrategias para leer registros. Sus 4 parámetros θ (varillas violetas) se convierten en probabilidades π con softmax (barras cian). Al principio las cuatro tienen la misma probabilidad.",
      act: "La política elige 8 estrategias al azar según π.",
      cues: [{ at: 0.9, op: "token", label: "8 elecciones", targets: ["b-batch"] }],
      seconds: 1.2,
      result: (ctx) => {
        const h = ctx.store.rl().history[1];
        return `El {{b-batch|lote}} tiene 8 episodios: ${h.batch.map((b) => ACTIONS[b.action].label).slice(0, 3).join(", ")}… Cada uno se va a ejecutar sobre una tarea real de desarrollo con el solucionador.`;
      },
    },
    {
      concept: "recompensa",
      look: ["b-batch"],
      orient: "Se ejecuta cada episodio. La señal es una [[recompensa|recompensa]]: 1 si el solucionador acertó la tarea con esa estrategia de lectura, 0 si no. Esta es la señal de la estación B: un número, no una explicación.",
      act: "Se ejecutan los 8 episodios.",
      cues: [{ at: 0.9, op: "evaluate", targets: ["b-batch"] }],
      seconds: 1.2,
      result: (ctx) => {
        const h = ctx.store.rl().history[1];
        return `${h.batch.filter((b) => b.reward).length} de 8 episodios dieron recompensa 1 (verde). Recompensa media del lote: ${n2(h.meanReward)}.`;
      },
    },
    {
      concept: "baseline",
      look: ["b-baseline", "b-batch"],
      orient: "La recompensa sola no dice si un episodio fue mejor que lo habitual. Se compara con una [[baseline|línea de base]] b, una media de lotes **anteriores**. La [[ventaja|ventaja]] es Â = R − b: positiva si salió mejor de lo esperado.",
      act: "Se resta la línea de base a cada recompensa.",
      cues: [{ at: 0.9, op: "sum", label: "Â = R − b", targets: ["b-baseline"] }],
      seconds: 1.2,
      result: (ctx) => {
        const h = ctx.store.rl().history[1];
        return `Aquí b = ${n2(h.baselineUsed)} (todavía no hubo lotes, así que es el valor inicial). Los episodios con R = 1 tienen Â = ${n2(1 - h.baselineUsed)}; los de R = 0, Â = ${n2(-h.baselineUsed)}. b no depende de las acciones de este lote: por eso no sesga el gradiente.`;
      },
    },
    {
      concept: "gradiente",
      look: ["b-policy"],
      orient: "Para cada episodio, ∇log π(a) indica cómo cambiar θ para que esa acción sea más probable. Se multiplica por su ventaja y se promedia: el [[gradiente|gradiente]] ĝ empuja hacia las acciones que salieron mejor de lo esperado y aleja de las peores.",
      act: "Se calcula ĝ = media de Â · ∇log π(a).",
      cues: [{ at: 0.9, op: "gradient", targets: ["b-policy"] }],
      seconds: 1.2,
      result: (ctx) => `ĝ = (${ctx.store.rl().history[1].grad.map(n2).join(", ")}). Las flechas naranjas muestran ese empujón sobre cada parámetro. Todavía no cambió nada.`,
    },
    {
      concept: "politica",
      look: ["b-policy"],
      orient: (ctx) => `Ahora se actualiza la política: θ ← θ + α·ĝ, con α = ${ctx.user.rlAlpha}. Fijate en las varillas violetas, los parámetros de la política, y en las barras cian, sus probabilidades.`,
      act: "θ ← θ + α·ĝ.",
      cues: [{ at: 0.9, op: "update", targets: ["b-policy"] }],
      seconds: 1.2,
      result: (ctx) => {
        const h = ctx.store.rl().history[1];
        return `θ = (${h.theta.map(n2).join(", ")}) y π = (${softmax(h.theta).map(n2).join(", ")}). Cambiaron **4 parámetros de esta política**, no los del Transformer.`;
      },
    },
    {
      concept: "politica",
      look: ["b-policy"],
      orient: "Repetimos lote, recompensa, ventaja, gradiente y actualización 30 veces.",
      act: "30 actualizaciones.",
      cues: [{ at: 0.1, op: "update", targets: ["b-policy"] }, { at: 0.55, op: "update", targets: ["b-policy"] }, { at: 0.95, op: "update", targets: ["b-policy"] }],
      seconds: 3,
      result: (ctx) => {
        const rl = ctx.store.rl();
        const pi = softmax(rl.history[rl.history.length - 1].theta);
        const best = rl.expected.indexOf(Math.max(...rl.expected));
        const top = pi.indexOf(Math.max(...pi));
        return `Después de 30 actualizaciones, π da ${n2(pi[top])} a ${actName(top)}. ${top === best ? `Es la estrategia con más recompensa esperada en estas tareas (${n2(rl.expected[best])}).` : `La de más recompensa esperada es ${actName(best)}: 30 actualizaciones no alcanzaron.`} La señal fue sólo un número por episodio.`;
      },
    },
  ],
  "6.4": [
    {
      concept: "ppo",
      look: ["b-policy", "b-batch"],
      orient: "Una ampliación opcional: [[ppo|PPO]]. En vez de usar cada lote una sola vez, lo reutiliza varias épocas. Para no alejarse demasiado de la política que generó el lote, mide la razón r = π_nueva(a) / π_vieja(a) de cada episodio.",
      act: "Primera época sobre el mismo lote.",
      cues: [{ at: 0.9, op: "update", targets: ["b-policy"] }],
      seconds: 1.2,
      result: (ctx) => `En la primera época todas las razones valen 1 (todavía no hubo cambios) y todos los términos están activos. Objetivo L^CLIP = ${n2(ctx.store.ppo().update.epochs[0].objective)}.`,
    },
    {
      concept: "ppo",
      look: ["b-policy", "b-batch"],
      orient: "Después de varias épocas, algunas razones se alejan de 1. El objetivo **recortado** usa min(r·Â, recorte(r, 0.8, 1.2)·Â): cuando un episodio ya se movió más de ε = 0.2 en la dirección favorable, su gradiente vale 0 y deja de empujar.",
      act: "Cuarta época.",
      cues: [{ at: 0.9, op: "update", targets: ["b-policy"] }],
      seconds: 1.2,
      result: (ctx) => {
        const ep = ctx.store.ppo().update.epochs[3];
        return `En la cuarta época, ${ep.per.filter((p) => p.clipped).length} de 8 términos quedaron recortados (gradiente 0). Es un freno: limita cuánto cambia la política con un mismo lote.`;
      },
    },
  ],
  "6.5": [
    {
      concept: "evolucion",
      look: ["c-archive", "c-bins"],
      orient: "Estación C: [[evolucion|búsqueda evolutiva de programas]]. El programa decide en qué máquina poner cada trabajo: calcula una prioridad(s, r, k) con s = tamaño del trabajo, r = espacio libre de la máquina y k = su número, y elige la de mayor prioridad. La semilla es «peor ajuste»: preferir la máquina con **más** espacio libre.",
      act: "Se evalúa la semilla en secuencias de trabajos.",
      cues: [{ at: 0.9, op: "evaluate", targets: ["c-bins"] }],
      seconds: 1.2,
      result: (ctx) => `La señal de esta estación es una puntuación: el exceso de máquinas usadas sobre el mínimo posible. La semilla tiene ${pct(ctx.store.evo().events[0].score)} de exceso en las secuencias de entrenamiento.`,
    },
    {
      concept: "evolucion",
      look: ["c-archive", "c-bins"],
      orient: "Ahora se proponen variantes: [[mutacion|mutaciones]] aleatorias del programa, como cambiar un signo o una constante. No hay un modelo de lenguaje: el azar propone y la evaluación decide. Cada candidata se evalúa en algunas secuencias de entrenamiento.",
      act: "Se proponen y evalúan candidatas.",
      cues: [{ at: 0.05, op: "transfer", targets: ["c-archive"] }, { at: 0.5, op: "evaluate", targets: ["c-bins"] }, { at: 0.95, op: "evaluate", targets: ["c-bins"] }],
      seconds: 3,
      result: (ctx) => `La curva muestra el mejor exceso encontrado hasta cada candidata. Lo que cambia en esta estación es **código**: el texto del programa.`,
    },
    {
      concept: "archivo_diversidad",
      look: ["c-archive"],
      orient: "No se guarda sólo la mejor. El [[archivo_diversidad|archivo de diversidad]] tiene celdas por tamaño del programa y variables que usa, y en cada celda conserva la mejor candidata. Así la búsqueda puede seguir explorando por caminos distintos.",
      act: "Se completa el archivo.",
      cues: [{ at: 0.9, op: "lookup", targets: ["c-archive"] }],
      seconds: 1.2,
      result: (ctx) => `${ctx.store.evo().archive.length} celdas ocupadas, cada una con un programa distinto. Explorar desde varias celdas evita quedarse con una sola idea.`,
    },
    {
      concept: "optimismo",
      look: ["c-archive", "c-bins"],
      orient: (ctx) => `El presupuesto total es fijo: 192 evaluaciones. Con ${ctx.user.evoPer} secuencias por candidata, cada puntuación es ruidosa, y elegir la mejor entre muchas puntuaciones ruidosas favorece a las que tuvieron suerte. Es el [[optimismo|optimismo por selección]].`,
      act: "Se mide la mejor candidata en secuencias reservadas.",
      cues: [{ at: 0.9, op: "evaluate", targets: ["c-bins"] }],
      seconds: 1.2,
      result: (ctx) => {
        const evo = ctx.store.evo();
        return `En entrenamiento la mejor tuvo ${pct(evo.best.score)} de exceso; en 24 secuencias reservadas, ${pct(evo.bestHoldout)}. ${evo.best.score < evo.bestHoldout - 0.005 ? "Era optimista: la selección eligió en parte el azar." : "Esta vez la diferencia es chica."}`;
      },
    },
    {
      concept: "evolucion",
      look: ["c-archive", "c-bins"],
      orient: "Comparación honesta: todos los programas se miden en las mismas secuencias reservadas, que la búsqueda nunca vio.",
      act: "Se comparan los programas de referencia con el encontrado.",
      cues: [{ at: 0.9, op: "evaluate", targets: ["c-bins"] }],
      seconds: 1.2,
      result: (ctx) => {
        const evo = ctx.store.evo();
        const base = ctx.store.evoBaselines();
        const same = likeBestFit(evo.best.program);
        return `Peor ajuste: ${pct(base["peor ajuste"])}; primer ajuste: ${pct(base["primer ajuste"])}; mejor ajuste: ${pct(base["mejor ajuste"])}; encontrado, ${esc(show(evo.best.program))}: ${pct(evo.bestHoldout)}. ${same ? "Evaluándolo, el programa encontrado ordena las máquinas igual que «mejor ajuste»: la búsqueda redescubrió una regla conocida con otra escritura." : "Es una regla distinta de las tres de referencia."}`;
      },
    },
  ],
  "6.6": [
    {
      concept: "tres_estaciones",
      look: ["estA", "estB", "estC"],
      orient: "Resumen: **A** recibe observaciones de pruebas y modifica el contexto (su memoria). **B** recibe una recompensa numérica y modifica los 4 parámetros de una política. **C** recibe una puntuación y modifica el código de un programa. Ninguna tocó los parámetros del Transformer, y ninguna, por sí sola, mejora cómo se producen las mejoras.",
    },
  ],
};
