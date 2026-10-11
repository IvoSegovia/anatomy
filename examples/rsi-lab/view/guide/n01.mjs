import { VERSIONS, runTask } from "../../model/agent.mjs";
import { esc } from "../helpers.mjs";

const TASK = 14;
const taskOf = (ctx) => ctx.store.splits().dev[TASK];
const v0Run = (ctx) => runTask(taskOf(ctx), VERSIONS.v0);
const evidence = (task) => task.lines.filter((line) => line.tags.evidence && !line.tags.dup);
const intro = (ctx) => {
  const task = taskOf(ctx);
  return `la tarea ${task.seed}: averiguar por qué falla la prueba ${esc(task.testName)} leyendo el registro de una ejecución`;
};

const module = (id, text) => ({ concept: id === "codigo" ? "gestor_contexto" : id === "modelo" ? "demo_vs_real" : id === "datos" ? "particiones" : id === "entorno" ? "presupuesto" : id === "evaluador" ? "criterio" : id === "archivo" ? "archivo" : id === "contexto" ? "contexto" : "observacion", look: id === "modelo" ? ["modelo", "modelo-front"] : [id], orient: text });

export const N01 = {
  "1.1": [
    {
      concept: "rsi",
      orient: "Esta lección intenta responder una pregunta: **¿qué tendría que cambiar en un sistema de IA para que su próxima versión también pudiera producir mejores mejoras?** La recorremos en un laboratorio dibujado como maqueta. Cada módulo es un componente del sistema; las posiciones y distancias son conceptuales, no la disposición física de una computadora.",
    },
  ],
  "1.2": [
    module("modelo", (ctx) => `Seguimos un ejemplo concreto: ${intro(ctx)}. Primer módulo: {{modelo|el modelo θ}}. En un agente real sería un modelo de lenguaje que lee el registro y propone una respuesta. Acá hay un Transformer de juguete que estudiaremos por dentro, pero que **no** resuelve esta tarea: esa parte la hacen reglas programadas.`),
    module("contexto", (ctx) => {
      const task = taskOf(ctx);
      return `{{contexto|Contexto}}: lo que el sistema tiene delante en un paso. Para esta tarea son las líneas del registro que entran en un espacio limitado de 64 tokens; aquí cada palabra cuenta como un token. El registro completo tiene ${task.lines.length} líneas y ${task.totalTokens} tokens, así que no cabe entero: algo hay que dejar afuera.`;
    }),
    module("herramientas", (ctx) => `{{herramientas|Herramientas}}: ejecutan pruebas y leen registros. Producen [[observacion|observaciones]] externas, por ejemplo que ${esc(taskOf(ctx).testName)} dio un resultado distinto del esperado. Esas observaciones pueden volver al contexto en el paso siguiente. No son parámetros ni código del agente: son datos nuevos que llegan desde afuera.`),
    module("codigo", "{{codigo|Código del agente}}: el programa que decide cómo trabajar. Para nosotros importa su [[gestor_contexto|gestor de contexto]], la regla que elige qué líneas del registro entran en esos 64 tokens. Hoy está en la versión {{cart-v0|v0}}. Es lo que esta lección va a modificar."),
    module("datos", (ctx) => `{{datos|Datos}}: el banco de tareas, en cuatro [[particiones|cajones separados]]. Desarrollo (16 tareas, para analizar fallos), validación (40, para comparar versiones), prueba reservada (60, para medir al final) y auditoría (40, una medición fuera de la búsqueda). Nuestra tarea, la ${taskOf(ctx).seed}, es de desarrollo.`),
    module("entorno", "{{entorno|Entorno de ejecución}}: el recinto donde se ejecutan las tareas, con un [[presupuesto|presupuesto]] contado en ejecuciones. Cada vez que una versión del gestor se prueba con una tarea se gasta una ejecución. No es tiempo, ni potencia de cálculo, ni dinero: es un contador."),
    module("evaluador", (ctx) => {
      const task = taskOf(ctx);
      return `{{evaluador|Evaluador}}: decide con un [[criterio|criterio]] explícito. En nuestra tarea, éxito significa nombrar la función culpable (${esc(task.culprit)}) y la causa correcta. Para comparar dos versiones no alcanza una tarea: usa muchas, siempre las mismas para ambas.`;
    }),
    module("archivo", "{{archivo|Archivo de versiones}}: guarda cada variante del gestor que se probó, también las que no ganaron. Guardar no es promover: sólo una versión está activa. El archivo permite volver atrás y explorar desde versiones anteriores."),
  ],
  "1.3": [
    {
      concept: "inferencia",
      look: ["contexto"],
      orient: "Antes de seguir distinguimos cuatro tipos de cambio. El primero es la [[inferencia|inferencia]]: usar el modelo tal como está. Cambian el contexto y las activaciones, los números calculados para cada entrada. Los parámetros θ quedan fijos. Un Transformer, por sí solo, hace esto: responder no lo modifica.",
    },
    {
      concept: "entrenamiento",
      look: ["modelo", "modelo-front"],
      orient: "Segundo tipo: [[entrenamiento|entrenamiento]]. Un procedimiento modifica los parámetros θ usando datos y una función objetivo que mide el error. Después de entrenar, el mismo texto produce otros números porque cambió la receta del modelo. Lo veremos con cifras reales en el capítulo 5.",
    },
    {
      concept: "mejora_agente",
      look: ["codigo", "herramientas"],
      orient: "Tercero: [[mejora_agente|mejora del agente]]. Cambian sus herramientas, su memoria, su código o su estrategia, y θ puede quedar intacto. Reemplazar el gestor de contexto v0 por otro es de este tipo: el mismo modelo, otra manera de elegir qué leer.",
    },
    {
      concept: "rsi",
      look: ["codigo", "proponente", "archivo", "evaluador"],
      orient: "Cuarto: [[rsi|automejora recursiva]]. Lo que se modificó vuelve a intervenir en el proceso que produce las siguientes modificaciones. No basta con mejorar una vez: hay que medir si mejora la capacidad de mejorar. Tener conciencia, conversar consigo mismo, ampliar el contexto o generar datos sintéticos no es, por sí solo, automejora recursiva.",
    },
  ],
  "1.4": [
    {
      concept: "demo_vs_real",
      look: ["route1", "datos", "contexto", "modelo", "modelo-front", "herramientas", "entorno", "evaluador"],
      orient: "Primer bucle, en cian: **resolver una tarea**. El registro sale de {{datos|Datos}}, el gestor lo recorta para el {{contexto|contexto}} y con eso se intenta un diagnóstico; las {{herramientas|herramientas}} y el {{evaluador|evaluador}} devuelven el resultado al contexto. La ruta pasa por el {{modelo|modelo}} como pasaría en un agente real; en esta demostración, ese tramo es una conexión conceptual.",
      act: "Seguí el pulso cian a lo largo de la ruta.",
      cues: [{ at: 0.05, op: "transfer", targets: ["route1"] }],
      result: "En este bucle cambian el contexto y las activaciones. No cambian los parámetros θ ni el código del agente: el sistema hace lo que ya sabe hacer. Quien diagnostica aquí es un solucionador de reglas declaradas, no el Transformer.",
    },
  ],
  "1.5": [
    {
      concept: "proponente",
      look: ["route2", "evaluador", "proponente", "codigo", "entorno", "archivo"],
      orient: "Segundo bucle, naranja: **modificar el sistema**. El {{evaluador|evaluador}} informa qué falló; el {{proponente|proponente}} analiza esos informes y construye una variante del {{codigo|código}}; la variante se ejecuta en el {{entorno|entorno}}, se evalúa y se guarda en el {{archivo|archivo}}. El proponente de esta demostración sigue reglas programadas.",
      act: "Seguí el pulso naranja.",
      cues: [{ at: 0.05, op: "transfer", targets: ["route2"] }],
      result: "Aquí sí cambia algo del sistema: el código del agente, si la variante cumple un criterio explícito. Pero el proceso que propone variantes sigue siendo el mismo. Mejora el agente; todavía no hay recursión.",
    },
  ],
  "1.6": [
    {
      concept: "autorreferencia",
      look: ["route3", "archivo", "proponente"],
      orient: "Tercer bucle, punteado blanco: las versiones promovidas vuelven al {{proponente|proponente}}. En esta demostración, el proponente lee los informes de fallo **a través del gestor de contexto de la versión activa**. Si el gestor mejoró, quizá el proponente llegue a ver diagnósticos que antes quedaban afuera.",
      act: "Seguí el pulso blanco entre el archivo y el proponente.",
      cues: [{ at: 0.05, op: "transfer", targets: ["route3"] }],
      result: "Ahí aparece la [[autorreferencia|autorreferencia]]: lo modificado participa en producir la siguiente modificación. Que el bucle se cierre no garantiza progreso. En el capítulo 8 lo mediremos con el mismo presupuesto para dos modos.",
    },
  ],
  "1.7": [
    {
      span: 2,
      concept: "gestor_contexto",
      look: ["contexto", "ctx-lines", "cart-v0", "datos"],
      orient: (ctx) => `Veamos el bucle 1 en acción con la tarea ${taskOf(ctx).seed}. A la izquierda está el registro completo, ${taskOf(ctx).lines.length} líneas. El gestor {{cart-v0|v0}} hace lo más simple: toma las líneas en el orden en que aparecen y se detiene cuando se llenan los 64 tokens del {{contexto|contexto}}.`,
      act: "v0 copia líneas en orden hasta llenar 64 tokens; lo que no cabe, cae.",
      cues: [{ at: 0.1, op: "transfer", targets: ["contexto"] }, { at: 0.96, op: "mask", label: "líneas que no cupieron", targets: ["ctx-lines"] }],
      result: (ctx) => {
        const run = v0Run(ctx);
        const ev = evidence(taskOf(ctx));
        return `Entraron ${run.managed.context.length} líneas, ${run.cost} de 64 tokens. Las {{ctx-lines|tiras rojas caídas}} no cupieron, y entre ellas están las ${ev.length} líneas que identifican la falla real: la TRACE que lleva a ${esc(taskOf(ctx).culprit)}, el DEBUG con la causa y el ERROR de la prueba. Cobertura de evidencia: ${Math.round(run.coverage * 100)} %.`;
      },
    },
    {
      concept: "solucionador",
      look: ["contexto", "evaluador"],
      orient: "Con ese contexto, el [[solucionador|solucionador simbólico]] intenta un diagnóstico. Es una regla fija: busca el último ERROR visible, sigue su TRACE hasta una función y busca un DEBUG que nombre la causa. Sólo puede usar lo que el gestor dejó entrar.",
      act: "El solucionador recorre el contexto y el evaluador compara su respuesta.",
      cues: [{ at: 0.6, op: "evaluate", targets: ["evaluador"] }],
      result: (ctx) => {
        const run = v0Run(ctx);
        return run.answer
          ? `Concluyó ${esc(run.answer.culprit)}, con causa «${esc(run.answer.cause)}». Es un señuelo: esa prueba falló por tiempo y se reintentó con éxito, pero la línea que lo dice no cupo. **Fallo.** Este fallo concreto es el que el agente intentará evitar cambiando su gestor de contexto.`
          : "No encontró la causa en lo que quedó visible. **Fallo.** Este fallo concreto es el que el agente intentará evitar cambiando su gestor de contexto.";
      },
    },
  ],
  "1.8": [
    {
      concept: "demo_vs_real",
      look: ["modelo", "modelo-front", "tray-emb", "tray-b0", "tray-b1", "tray-out"],
      orient: "Antes de mejorar el agente entramos al {{modelo|modelo θ}}. Su gabinete se abre en capas: cada bandeja es una etapa del Transformer de juguete. Los capítulos 2 a 5 estudian cómo calcula y cómo se entrena. Recordá: en esta demostración no resuelve las tareas ni propone cambios; es un objeto de estudio aparte.",
    },
  ],
};
