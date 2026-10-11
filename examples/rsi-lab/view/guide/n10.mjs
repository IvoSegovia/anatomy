import { SCENARIOS } from "../../model/limits.mjs";
import { esc } from "../helpers.mjs";

const pc = (x) => `${Math.round(x * 100)} %`;
const run = (ctx) => ctx.store.limits();
const lessonOf = (ctx, name) => (ctx.user.scenario === name ? SCENARIOS[name].lesson(run(ctx)) : "");
const scenarioCues = [{ at: 0.2, op: "evaluate", targets: ["evaluador"] }, { at: 0.55, op: "evaluate", targets: ["evaluador"] }];
const look = ["evaluador", "datos", "entorno", "archivo"];

export const N10 = {
  "10.1": [
    {
      concept: "protocolo",
      look,
      orient: (ctx) => `Última pregunta: ¿qué puede salir mal? A la izquierda está la mesa de límites: presupuesto de búsqueda, ruido del evaluador, diversidad de tareas, coste de validación, diversidad de candidatos y el criterio de promoción. Cada control tiene un efecto definido en el código del bucle. Primero, el protocolo cuidadoso: ${esc(lessonOf(ctx, "base"))}`,
    },
  ],
  "10.2": [
    {
      concept: "sobreajuste",
      look,
      orient: "Primer fallo: [[sobreajuste|sobreajuste]] a la validación. Cambian dos piezas del protocolo: sólo 10 tareas de validación, siempre las mismas, con un 15 % de resultados invertidos al azar (pruebas inestables); y el criterio pasa a ser «estimación puntual mayor», sin intervalo.",
      act: "Se corre el bucle con esta configuración.",
      cues: scenarioCues,
      seconds: 1.6,
      result: (ctx) => `${esc(lessonOf(ctx, "sobreajuste"))} La causa: con pocas tareas ruidosas, alguna candidata gana por azar, y consultar una y otra vez el mismo conjunto convierte ese azar en promociones.`,
    },
  ],
  "10.3": [
    {
      concept: "metrica_proxy",
      look,
      orient: "Segundo fallo: una [[metrica_proxy|métrica imperfecta]]. El criterio ya no es acertar tareas: es aumentar la proporción de líneas ERROR y TRACE en el contexto, algo que parece relacionado con encontrar errores.",
      act: "Se corre el bucle con esta configuración.",
      cues: scenarioCues,
      seconds: 1.6,
      result: (ctx) => `${esc(lessonOf(ctx, "metrica"))} La causa: la métrica medía algo que suele acompañar al éxito, no el éxito.`,
    },
  ],
  "10.4": [
    {
      concept: "diversidad",
      look,
      orient: "Tercer fallo: pérdida de [[diversidad|diversidad]]. La probabilidad de explorar el archivo baja a 0: cada candidata sale siempre de la versión activa, aunque el archivo guarde otras.",
      act: "Se corre el bucle con esta configuración.",
      cues: scenarioCues,
      seconds: 1.6,
      result: (ctx) => `${esc(lessonOf(ctx, "diversidad"))} La causa: si todas las variantes salen del mismo punto, un mal comienzo arrastra a toda la búsqueda.`,
    },
  ],
  "10.5": [
    {
      concept: "diversidad",
      look: ["evaluador", "datos", "entorno", "archivo", "codigo"],
      orient: "Cuarto fallo: regresión fuera del dominio. Desarrollo y validación sólo tienen la familia F2, donde la causa está escrita en el propio mensaje de error. Además el criterio es la métrica compuesta **sin** puerta de corrección, con λ = 0.3: el ahorro pesa mucho.",
      act: "Se corre el bucle con esta configuración.",
      cues: scenarioCues,
      seconds: 1.6,
      result: (ctx) => `${esc(lessonOf(ctx, "dominio"))} La causa: lo que se midió no representaba las tareas en las que se iba a usar.`,
    },
    {
      concept: "auditoria",
      look: ["codigo", "archivo", "evaluador"],
      orient: "¿Cómo se recupera? El archivo guarda todas las versiones y la [[auditoria|auditoría]] midió cada una al promoverla. Se puede volver a la última versión cuya auditoría no retrocedió.",
      act: "Volver a la última versión válida.",
      cues: [{ at: 0.7, op: "lookup", label: "versión recuperada del archivo", targets: ["archivo", "codigo"] }],
      seconds: 1.2,
      result: (ctx) => {
        const r = run(ctx);
        return `Se restaura ${esc(r.lastValid.id)}. En la prueba final, evaluada al terminar, obtiene ${pc(r.lastValidTest)} frente a ${pc(r.finalTest)} de la versión descartada. Ojo: la auditoría se usó para elegir a qué versión volver, así que participó en la selección; el número independiente es el de la prueba final.`;
      },
    },
  ],
  "10.6": [
    {
      concept: "presupuesto",
      look,
      orient: "Quinto fallo: agotamiento del presupuesto. El límite de búsqueda baja a 200 ejecuciones.",
      act: "Se corre el bucle con esta configuración.",
      cues: scenarioCues,
      seconds: 1.6,
      result: (ctx) => `${esc(lessonOf(ctx, "presupuesto"))} La causa: cada ciclo cuesta lo mismo, haya o no una buena idea, y el presupuesto se reserva entero antes de empezar.`,
    },
  ],
  "10.7": [
    {
      concept: "archivo",
      look: ["codigo", "archivo", "evaluador", "cart-v1"],
      orient: "Cada fallo salió de cambiar una sola pieza del protocolo. Las defensas también son piezas: validación amplia con un criterio que tenga intervalo, una métrica que mida lo que importa, exploración del archivo, diversidad de tareas, presupuesto suficiente, auditoría para poder volver atrás y una prueba reservada para informar. El panel muestra la versión restaurada: es código del gestor, no parámetros del modelo.",
    },
  ],
  "10.8": [
    {
      span: 2,
      concept: "rsi",
      look: ["datos", "contexto"],
      orient: "Recapitulemos el mecanismo de esta demostración en el orden en que realmente se ejecuta. Una tarea de desarrollo produce un **registro**, y el gestor de contexto activo hace la **selección**: qué líneas entran en los 64 tokens.",
      act: "Registro → selección.",
      cues: [{ at: 0.1, op: "transfer", targets: ["datos"] }, { at: 0.6, op: "mask", label: "selección del gestor", targets: ["contexto"] }],
      seconds: 2.4,
    },
    {
      span: 2,
      concept: "informe_fallo",
      look: ["contexto", "proponente", "codigo"],
      orient: "Si la tarea falla, su informe pasa por el gestor del analista: eso decide el **diagnóstico visible**. Con él, las reglas del proponente construyen una **propuesta**: un cambio en el código del gestor.",
      act: "Diagnóstico visible → propuesta.",
      cues: [{ at: 0.1, op: "transfer", targets: ["proponente"] }, { at: 0.6, op: "transfer", targets: ["codigo"] }],
      seconds: 2.4,
    },
    {
      span: 2,
      concept: "protocolo",
      look: ["entorno", "evaluador", "codigo"],
      orient: "La **prueba**: la versión activa y la candidata se ejecutan en las mismas tareas de validación, con el presupuesto reservado. Si cumple el criterio, la candidata pasa a ser la **versión** activa; si no, queda en el archivo.",
      act: "Prueba → versión.",
      cues: [{ at: 0.15, op: "evaluate", targets: ["evaluador"] }, { at: 0.7, op: "promote", targets: ["codigo"] }],
      seconds: 2.4,
    },
    {
      concept: "autorreferencia",
      look: ["contexto", "datos", "proponente"],
      orient: "Y vuelve a empezar: la versión activa filtra el **siguiente registro** y el siguiente informe. El Transformer quedó fuera de esta cadena: en un sistema real, un modelo de lenguaje podría ocupar el lugar del proponente; aquí lo estudiamos por separado.",
      act: "Siguiente registro.",
      cues: [{ at: 0.2, op: "transfer", targets: ["contexto"] }],
      seconds: 1.6,
    },
  ],
  "10.9": [
    {
      concept: "rsi",
      look: null,
      orient: (ctx) => {
        const rows = ctx.store.loopReady() ? ctx.store.loopCompare() : null;
        const better = rows ? rows.filter((r) => r.B.finalTest > r.A.finalTest + 1e-9).length : null;
        return `Tres preguntas para cualquier afirmación de automejora: **¿qué cambió?** (contexto, pesos, código, datos, evaluador o infraestructura), **¿qué evidencia lo respalda?** (datos separados, presupuesto contado) y **¿ayuda a producir mejores cambios?** (medido, no supuesto). En este laboratorio, la tercera respuesta fue «${better === null ? "depende de la semilla" : `en ${better} de 12 semillas`}», con reglas inventadas para la demostración.`;
      },
    },
  ],
};
