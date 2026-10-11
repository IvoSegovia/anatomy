import { VOCAB } from "../../model/tokenizer.mjs";
import { esc } from "../helpers.mjs";
import { VERSIONS, runTask } from "../../model/agent.mjs";
import { paramPrint } from "../../model/transformer.mjs";

const n2 = (x) => (x === -Infinity ? "−∞" : (Math.round(x * 100) / 100).toFixed(2).replace("-", "−"));
const row = (list) => list.map(n2).join("  ");
const rowOf = (ctx) => Math.min(ctx.store.ids().length - 1, Math.max(0, ctx.user.row));
const head = (ctx) => ctx.store.trace().blocks[0].heads[ctx.user.head];
const tok = (ctx, i) => esc(VOCAB[ctx.store.ids()[i]]);

export const CONCEPTS = {
  evidencia_tipos: {
    title: "Tipos de evidencia",
    def: "Propuesta teórica (un diseño con argumentos, sin medición), resultado empírico (algo medido en tareas concretas) y demostración didáctica (como este laboratorio: reglas inventadas para mostrar un mecanismo).",
    simple: "No es lo mismo un plano de un puente, un puente que aguantó una prueba de carga y una maqueta para explicar cómo funciona.",
    example: () => ({ html: "Gödel Machine: propuesta teórica. Darwin Gödel Machine y AlphaEvolve: resultados empíricos. Esta lección: demostración didáctica.", prov: "cita" }),
    where: [],
  },
  metrica_proxy: {
    title: "Métrica sustituta (imperfecta)",
    def: "Una medida fácil de calcular que se usa en lugar de lo que realmente importa porque suele acompañarlo. Optimizarla puede separarla de lo que importa.",
    simple: "Si premiás a un alumno por cantidad de páginas escritas, aprende a escribir más páginas, no necesariamente mejores.",
    example: () => ({ html: "Proporción de líneas ERROR/TRACE en el contexto en lugar de la tasa de aciertos.", prov: "local" }),
    where: ["evaluador"],
  },
  diversidad: {
    title: "Diversidad",
    def: "Variedad en las tareas usadas para medir y en los puntos de partida de las variantes. Sin ella, la búsqueda puede ajustarse a un caso particular o quedar atrapada en un camino.",
    simple: "Si sólo practicás un tipo de ejercicio, te va bien en ése. Si siempre empezás desde el mismo borrador, sus errores se heredan.",
    example: () => ({ html: "Validación con una sola familia de tareas; exploración del archivo con probabilidad 0.", prov: "local" }),
    where: ["datos", "archivo"],
  },

  evidencia: {
    title: "Evidencia y diagnóstico",
    def: "Las líneas del registro que permiten identificar la falla real: la TRACE que lleva a la función culpable y el DEBUG (o el ERROR) que nombra la causa.",
    simple: "Son las pistas que resuelven el caso. Si el gestor las deja afuera, el detective no puede usarlas aunque existan.",
    example: (ctx) => {
      const task = ctx.store.splits().dev[ctx.user.task ?? 14];
      return { html: task.lines.filter((l) => l.tags.evidence && !l.tags.dup).map((l) => `L${l.index} ${esc(l.text)}`).join("<br>"), prov: "local" };
    },
    where: ["ctx-lines", "contexto"],
  },
  ic95: {
    title: "Intervalo de confianza del 95 % (bootstrap pareado)",
    def: "Se remuestrean las tareas con reemplazo muchas veces, se calcula la diferencia de éxito en cada remuestreo y se toman los percentiles 2.5 y 97.5. Si el intervalo queda entero por encima de 0, la mejora es difícil de explicar por azar.",
    simple: "Es preguntarse: si hubiera tocado otro sorteo de tareas parecidas, ¿seguiría ganando? Se simula ese sorteo miles de veces.",
    example: (ctx) => {
      const { ci } = ctx.store.compare("v0", "v1");
      return { html: `v0 → v1: diferencia ${ci.mean.toFixed(3)}, intervalo [${ci.low.toFixed(3)}, ${ci.high.toFixed(3)}] con 2000 remuestreos.`, prov: "local" };
    },
    where: ["evaluador"],
  },
  metrica_compuesta: {
    title: "Métrica compuesta",
    def: "éxito − λ·(coste/64): combina corrección y coste en un solo número. λ fija cuánto éxito se acepta cambiar por ahorro.",
    simple: "Es poner precio al ahorro. Con λ alto, ahorrar tokens pesa mucho; con λ = 0, sólo importa acertar.",
    example: () => ({ html: "éxito 0.80 y coste 62/64 con λ = 0.1 → 0.80 − 0.1·0.97 = 0.70.", prov: "ilus" }),
    where: ["evaluador"],
  },
  puerta: {
    title: "Puerta de corrección",
    def: "Una regla previa a cualquier métrica combinada: si el intervalo de la diferencia de éxito queda entero por debajo de 0, la candidata se rechaza.",
    simple: "Primero, no romper lo que funciona. Recién después se discute si es más barato.",
    example: (ctx) => {
      const { ci } = ctx.store.compare("v1", "v2");
      return { html: `v1 → v2: intervalo [${ci.low.toFixed(2)}, ${ci.high.toFixed(2)}] → rechazo.`, prov: "local" };
    },
    where: ["evaluador"],
  },
  prueba_reservada: {
    title: "Prueba reservada",
    def: "Tareas que no se usan para analizar, comparar ni elegir. Se evalúan una sola vez, al final, para informar el resultado de la versión elegida.",
    simple: "Es el examen final que nadie vio. Si lo usaras para decidir qué estudiar, dejaría de medir lo que sabés.",
    example: () => ({ html: "60 tareas (semillas 300–359). En el bucle, la puerta de datos las rechaza hasta que la versión final queda fijada.", prov: "local" }),
    where: ["datos"],
  },
  informe_fallo: {
    title: "Informe de fallo",
    def: "El registro que produce cada tarea de desarrollo fallida: una cabecera INFO, una línea DEBUG por diagnóstico y el ERROR final. Es lo único que el proponente analiza.",
    simple: "Es el parte de un accidente. Si el lector sólo puede leer las primeras líneas y el parte empieza con datos de rutina, se pierde lo importante.",
    example: () => ({ html: "DEBUG diag test_fmt_fecha_2 presupuesto TRACE excluida por presupuesto", prov: "local" }),
    where: ["proponente", "datos"],
  },
  estado: {
    title: "Estado del sistema S_t",
    def: "S_t = (θ_t, código_t, memoria_t, estrategia_t): todo lo que el bucle puede cambiar en el ciclo t. Presupuesto y protocolo de evaluación quedan fuera.",
    simple: "Es la lista de perillas que el sistema puede tocar de sí mismo. Las reglas del juego (cuánto se puede gastar, cómo se evalúa) no están en esa lista.",
    example: () => ({ html: "θ: 2048 parámetros congelados · código: genoma del gestor · memoria: variantes probadas · estrategia: 10, 20 o 40 tareas de validación por candidata.", prov: "local" }),
    where: ["codigo", "proponente"],
  },
  protocolo: {
    title: "Protocolo de evaluación y presupuesto",
    def: "Cada ciclo reserva 16 ejecuciones de desarrollo y 2 × n de validación (activa y candidata) y sólo empieza si caben. Se cobra cada ejecución real. Auditoría y prueba final tienen presupuesto aparte.",
    simple: "Antes de empezar una ronda se aparta la plata que cuesta entera. Si no alcanza, no se empieza a medias.",
    example: (ctx) => {
      const run = ctx.store.loop();
      return { html: `Esta corrida: desarrollo ${run.ledger.desarrollo}, validación ${run.ledger.validación}, búsqueda ${run.ledger.search}/${run.ledger.limit}; auditoría ${run.ledger.auditoría}; prueba ${run.ledger.prueba}.`, prov: "local" };
    },
    where: ["entorno", "evaluador"],
  },
  contrafactual: {
    title: "Contrafactual",
    def: "Calcular qué habría pasado si sólo cambiara una cosa: aquí, el mismo informe leído con el gestor anterior.",
    simple: "Es repetir la escena cambiando un solo detalle para ver si ese detalle importaba.",
    example: () => ({ html: "Mismo informe: con v0 llegan 0 diagnósticos; con el gestor promovido llegan todos (semilla 2, ciclo 2).", prov: "sim" }),
    where: ["cart-an", "proponente"],
  },
  ab: {
    title: "Comparación A/B",
    def: "Correr el mismo experimento en dos modos que difieren en un solo mecanismo, con las mismas semillas, datos, criterio y presupuesto máximo.",
    simple: "Dos recetas iguales salvo un ingrediente: si cambia el sabor, fue el ingrediente.",
    example: () => ({ html: "A: el analista es siempre v0. B: el analista es la versión activa. Todo lo demás igual.", prov: "sim" }),
    where: ["proponente", "archivo"],
  },
  mejora_valida: {
    title: "Mejora válida",
    def: "Una promoción cuya auditoría (medición fuera de la búsqueda) supera la de la versión que reemplaza.",
    simple: "No alcanza con que el bucle diga que mejoró: una medición que el bucle no ve tiene que estar de acuerdo.",
    example: () => ({ html: "Ciclo con auditoría 15 % → 52 %: mejora válida. Ciclo promovido con auditoría 70 % → 52 %: promoción no válida.", prov: "ilus" }),
    where: ["evaluador"],
  },
  auditoria: {
    title: "Auditoría",
    def: "40 tareas fuera de la búsqueda que miden cada versión promovida. El bucle no las usa para proponer ni para promover; si se usan para decidir a qué versión volver, pasan a participar en la selección.",
    simple: "Un inspector externo que mira cada versión que se aprueba. Si además le pedís que elija cuál conservar, deja de ser sólo inspector.",
    example: () => ({ html: "Semillas 400–439: disjuntas de desarrollo, validación y prueba.", prov: "local" }),
    where: ["datos", "evaluador"],
  },

  layernorm: {
    title: "LayerNorm",
    def: "Normalización por fila: (x − media) / desvío, y después γ·(…) + β, con γ y β parámetros. Deja cada vector con una escala parecida.",
    simple: "Es como pasar notas de distintos profesores a una misma escala antes de compararlas: se centran y se ajustan para que no dominen las más grandes.",
    example: () => ({ html: "(2, 4, 6): media 4, desvío 1.63 → (−1.22, 0, 1.22) con γ = 1 y β = 0.", prov: "ilus" }),
    where: ["blk-b0", "out-base"],
  },
  mlp: {
    title: "MLP (perceptrón multicapa)",
    def: "Dos multiplicaciones de matrices con una función no lineal en el medio: W₁ (8→32), GELU, W₂ (32→8). Se aplica a cada posición por separado.",
    simple: "Agranda cada vector a 32 números, los dobla con una curva y lo vuelve a achicar a 8. Sin la curva, todo se reduciría a una sola multiplicación.",
    example: (ctx) => {
      const b = ctx.store.trace().blocks[0];
      const n = b.U.length - 1;
      return { html: `Última posición: 8 números → 32 (u₀ = ${(Math.round(b.U[n][0] * 100) / 100).toFixed(2)}) → GELU → 8.`, prov: "local" };
    },
    where: ["mx-b0-w1", "mx-b0-w2"],
  },
  gelu: {
    title: "GELU",
    def: "GELU(x) = 0.5·x·(1 + tanh(√(2/π)(x + 0.044715 x³))). Una curva suave: deja casi igual los positivos grandes y lleva a casi 0 los negativos.",
    simple: "Es una puerta suave: lo que es claramente positivo pasa, lo negativo se apaga, y cerca de 0 hay una transición gradual.",
    example: () => ({ html: "GELU(2) = 1.95; GELU(0) = 0; GELU(−2) = −0.05.", prov: "local" }),
    where: ["mx-b0-w1"],
  },
  logit: {
    title: "Logit",
    def: "Una puntuación sin normalizar para cada símbolo del vocabulario. Softmax los convierte en probabilidades.",
    simple: "Son notas crudas: más alta, más favorecido. Pueden ser negativas y no suman nada en particular.",
    example: (ctx) => ({ html: `Los 16 logits de la última posición: ${row(ctx.store.trace().logits)}.`, prov: "local" }),
    where: ["bars-out"],
  },
  argmax: {
    title: "argmax",
    def: "Elegir siempre la opción con la probabilidad más alta. Es determinista.",
    simple: "Es elegir el número más alto de la lista, sin sorteo.",
    example: () => ({ html: "p = (0.1, 0.7, 0.2) → argmax elige la segunda.", prov: "ilus" }),
    where: ["bars-out", "card-next"],
  },
  temperatura: {
    title: "Temperatura",
    def: "Un número T que divide los logits antes de softmax al sortear. T < 1 concentra la probabilidad; T > 1 la reparte.",
    simple: "Con temperatura baja casi siempre sale el favorito; con temperatura alta salen más sorpresas. No cambia el modelo, sólo cómo se elige.",
    example: () => ({ html: "Logits (2, 0): con T = 1 → (0.88, 0.12); con T = 2 → (0.73, 0.27).", prov: "ilus" }),
    where: ["bars-out"],
  },
  cache_kv: {
    title: "Caché KV",
    def: "Guardar K y V de cada posición ya procesada, en cada bloque y cabeza, para no recalcularlos al generar el token siguiente.",
    simple: "Es tomar apuntes de lo que ya se leyó. Para la palabra nueva sólo hace falta procesar esa palabra y consultar los apuntes.",
    example: (ctx) => ({ html: `Prefijo de ${ctx.store.ids().length} tokens: ${ctx.store.ids().length} filas de K y V guardadas en 4 cabezas; el token siguiente agrega 1 fila en cada una.`, prov: "local" }),
    where: ["tray-b0", "tray-b1"],
  },
  huella: {
    title: "Huella de θ",
    def: "Un código de 8 caracteres calculado sobre los bytes de todos los parámetros (FNV-1a). Si cambia un solo bit de un parámetro, cambia la huella.",
    simple: "Es como el número de control de un documento: no dice qué cambió, pero sí si algo cambió.",
    example: (ctx) => ({ html: `Huella inicial de los 2048 parámetros: ${ctx.store.print0}.`, prov: "local" }),
    where: [],
  },
  congelado: {
    title: "Parámetros congelados",
    def: "Parámetros que el entrenamiento no modifica. Aquí, los 1888 del cuerpo del Transformer (embeddings y dos bloques).",
    simple: "Es entrenar sólo la última pieza de una máquina y dejar el resto atornillado.",
    example: () => ({ html: "2048 parámetros en total: 160 de la cabeza de salida se entrenan, 1888 quedan fijos.", prov: "local" }),
    where: ["tray-emb", "tray-b0", "tray-b1"],
  },
  cabeza_salida: {
    title: "Cabeza de salida",
    def: "La parte final del modelo que convierte el vector de la última posición en probabilidades: LayerNorm final (γ_f, β_f), W_U y b_U.",
    simple: "Es la etapa que traduce el estado interno del modelo a «qué token sigue».",
    example: () => ({ html: "8 (γ_f) + 8 (β_f) + 8×16 (W_U) + 16 (b_U) = 160 parámetros.", prov: "local" }),
    where: ["mx-Wu", "tray-out"],
  },
  objetivo: {
    title: "Objetivo (etiqueta)",
    def: "El token que debería seguir en un ejemplo de entrenamiento. Se usa para medir el error.",
    simple: "Es la respuesta correcta del ejercicio.",
    example: (ctx) => {
      const ex = ctx.store.training().train[0];
      return { html: `«${esc(ex.text)}» → «${esc(VOCAB[ex.target])}».`, prov: "ilus" };
    },
    where: ["bars-out"],
  },
  perdida: {
    title: "Pérdida (entropía cruzada)",
    def: "L = −log p(objetivo). Vale 0 si el modelo da probabilidad 1 al objetivo y crece cuanto menor es esa probabilidad. Se mide en nats.",
    simple: "Es una multa: chica si el modelo apostó fuerte por la respuesta correcta, grande si casi no la consideró.",
    example: () => ({ html: "p = 0.5 → L = 0.69; p = 0.05 → L = 3.00; p = 1 → L = 0.", prov: "ilus" }),
    where: ["bars-out"],
  },
  gradiente: {
    title: "Gradiente",
    def: "La lista de derivadas de la pérdida respecto de cada parámetro: cuánto aumentaría la pérdida si cada uno subiera un poquito.",
    simple: "Es una brújula por parámetro: apunta hacia donde la pérdida crece. Para mejorar, se camina en sentido contrario.",
    example: () => ({ html: "Si ∂L/∂w = 0.5, subir w en 0.01 sube la pérdida unos 0.005; bajarlo la baja.", prov: "ilus" }),
    where: ["mx-gWu"],
  },
  regla_cadena: {
    title: "Regla de la cadena (retropropagación)",
    def: "Para derivar una composición de funciones se multiplican las derivadas de cada etapa, desde la pérdida hacia atrás hasta cada parámetro.",
    simple: "Si una perilla mueve un engranaje y el engranaje mueve una aguja, cuánto mueve la perilla a la aguja es el producto de los dos efectos.",
    example: () => ({ html: "∂L/∂W_U = uᵀ·(p − e_y): la señal de los logits multiplicada por la entrada de W_U.", prov: "local" }),
    where: ["mx-gWu"],
  },
  diferencias_finitas: {
    title: "Diferencias finitas",
    def: "Aproximar una derivada moviendo el parámetro un poco: (L(θ + h) − L(θ − h)) / 2h. Sirve para comprobar el gradiente calculado.",
    simple: "Es probar empujando: movés la perilla un pelito para cada lado y mirás cuánto se mueve la aguja.",
    example: () => ({ html: "h = 10⁻⁵ en cada uno de los 160 parámetros.", prov: "local" }),
    where: ["mx-gWu"],
  },
  sgd: {
    title: "SGD (descenso por gradiente)",
    def: "θ' = θ − η·g: cada parámetro se mueve en sentido contrario a su gradiente, escalado por la tasa de aprendizaje η.",
    simple: "Bajar una ladera dando pasos en la dirección más empinada hacia abajo. η es el largo del paso.",
    example: () => ({ html: "θ = 1.0, g = 0.4, η = 0.5 → θ' = 1.0 − 0.5·0.4 = 0.8.", prov: "ilus" }),
    where: ["mx-Wu"],
  },
  tasa_aprendizaje: {
    title: "Tasa de aprendizaje (η)",
    def: "El factor que escala cada paso del optimizador. No es la velocidad de la animación.",
    simple: "Es el largo de cada paso al bajar la ladera. Muy corto, tardás mucho; muy largo, te pasás del fondo y podés terminar más arriba.",
    example: () => ({ html: "En el capítulo 5: η = 0.5 converge, η = 1.2 empeora algún paso y luego converge, η = 3 diverge.", prov: "local" }),
    where: [],
  },
  sobreajuste: {
    title: "Sobreajuste",
    def: "Mejorar en los datos usados para ajustar mientras empeora en datos nuevos.",
    simple: "Es memorizar las respuestas de la guía de ejercicios: la guía sale perfecta y el examen no.",
    example: (ctx) => {
      const va = ctx.store.training().history.map((h) => h.valid);
      return { html: `Validación mínima en el paso ${va.indexOf(Math.min(...va))}; después sube aunque el entrenamiento siga bajando.`, prov: "local" };
    },
    where: [],
  },
  adam: {
    title: "Adam",
    def: "Optimizador que lleva dos promedios por parámetro: m (del gradiente) y v (del gradiente al cuadrado), corrige su sesgo inicial y usa θ' = θ − η·m̂/(√v̂ + ε).",
    simple: "Cada parámetro tiene su propio tamaño de paso: los que tienen gradientes grandes y ruidosos avanzan con más cuidado.",
    example: () => ({ html: "β₁ = 0.9, β₂ = 0.999, ε = 10⁻⁸ (Kingma y Ba, 2014).", prov: "cita" }),
    where: ["mx-Wu"],
  },
  reflexion: {
    title: "Reflexión con herramientas",
    def: "Intentar, ejecutar pruebas, escribir una nota sobre el error y reintentar con la nota en el contexto. Cambia la memoria, no los parámetros.",
    simple: "Es anotar en un papel «la última vez falló con la lista vacía» y leerlo antes de volver a intentar.",
    example: (ctx) => ({ html: `Nota 1: «${esc(ctx.store.reflection().log[0].note)}»`, prov: "local" }),
    where: ["a-memory", "a-tests"],
  },
  tres_estaciones: {
    title: "Señal y modificación",
    def: "Para cada método conviene preguntar qué señal recibe (pruebas, recompensa, puntuación) y qué modifica (contexto, parámetros de una política, código).",
    simple: "¿Cómo se entera de que lo hizo bien? ¿Y qué cambia cuando se entera?",
    example: () => ({ html: "A: observaciones → memoria. B: recompensa → 4 parámetros. C: puntuación → programa.", prov: "local" }),
    where: ["estA", "estB", "estC"],
  },
  politica: {
    title: "Política",
    def: "Una regla, con parámetros, que asigna probabilidades a las acciones posibles. Aquí: π = softmax(θ) sobre 4 estrategias de lectura.",
    simple: "Es un dado cargado: los parámetros deciden cuánto pesa cada cara. Aprender es recargar el dado.",
    example: () => ({ html: "θ = (0, 0, 0, 0) → π = (0.25, 0.25, 0.25, 0.25).", prov: "local" }),
    where: ["b-policy"],
  },
  reinforce: {
    title: "REINFORCE",
    def: "Un método de aprendizaje por refuerzo: θ ← θ + α · media(Â · ∇log π(a)). Sube la probabilidad de las acciones que salieron mejor de lo esperado.",
    simple: "Si una jugada salió mejor de lo habitual, la hacés un poco más probable; si salió peor, un poco menos.",
    example: () => ({ html: "∇log π(a) = e_a − π: para la acción tomada, 1 − π(a); para las otras, −π(otra).", prov: "local" }),
    where: ["b-policy", "b-batch"],
  },
  recompensa: {
    title: "Recompensa",
    def: "Un número que dice qué tan bien salió un episodio. Aquí, 1 si el solucionador acertó la tarea y 0 si no.",
    simple: "Es un pulgar arriba o abajo, sin explicación de por qué.",
    example: () => ({ html: "Estrategia «relevancia sin duplicados» en una tarea de desarrollo: acierta → 1.", prov: "local" }),
    where: ["b-batch"],
  },
  baseline: {
    title: "Línea de base",
    def: "Un valor de referencia que se resta a la recompensa. Si no depende de la acción elegida, reduce la variación del gradiente sin sesgarlo.",
    simple: "Es comparar contra «lo normal»: sacar 7 es bueno si lo habitual es 5 y malo si lo habitual es 9.",
    example: () => ({ html: "Media móvil: b ← 0.8·b + 0.2·(recompensa media del lote anterior).", prov: "local" }),
    where: ["b-baseline"],
  },
  ventaja: {
    title: "Ventaja",
    def: "Â = R − b: cuánto mejor (o peor) de lo esperado salió un episodio.",
    simple: "La diferencia entre lo que sacaste y lo que solías sacar.",
    example: () => ({ html: "R = 1, b = 0.5 → Â = 0.5; R = 0 → Â = −0.5.", prov: "ilus" }),
    where: ["b-batch"],
  },
  ppo: {
    title: "PPO (objetivo recortado)",
    def: "Reutiliza un lote varias épocas con la razón r = π_nueva/π_vieja y el objetivo min(r·Â, recorte(r, 1−ε, 1+ε)·Â), que deja de empujar cuando r se aleja más de ε.",
    simple: "Permite aprender varias veces del mismo lote, pero con un freno: si ya te moviste bastante, no sigas empujando en esa dirección.",
    example: () => ({ html: "ε = 0.2: si Â > 0 y r ya pasó 1.2, ese término deja de dar gradiente.", prov: "local" }),
    where: ["b-policy"],
  },
  evolucion: {
    title: "Búsqueda evolutiva de programas",
    def: "Generar variantes de un programa, evaluarlas con una puntuación y quedarse con las mejores para seguir variándolas.",
    simple: "Probar muchas versiones con cambios chiquitos, quedarte con las que funcionan y seguir cambiando a partir de ellas.",
    example: () => ({ html: "Semilla (r − s) → mutación → (s − r): pasa de preferir la máquina más vacía a la más llena.", prov: "ilus" }),
    where: ["c-archive", "c-bins"],
  },
  mutacion: {
    title: "Mutación",
    def: "Un cambio aleatorio y pequeño en un programa: cambiar una operación, una variable o una constante.",
    simple: "Es cambiar una pieza al azar para ver qué pasa.",
    example: () => ({ html: "(r − s) → (r + s) cambiando la resta por una suma.", prov: "ilus" }),
    where: ["c-archive"],
  },
  archivo_diversidad: {
    title: "Archivo de diversidad",
    def: "Un archivo con celdas por características del programa (tamaño, variables usadas); en cada celda se guarda la mejor candidata. También llamado MAP-Elites.",
    simple: "En vez de un solo campeón, un campeón por categoría. Así hay más caminos para seguir explorando.",
    example: (ctx) => ({ html: `${ctx.store.evo().archive.length} celdas ocupadas en esta corrida.`, prov: "local" }),
    where: ["c-archive"],
  },
  optimismo: {
    title: "Optimismo por selección",
    def: "Si se elige la mejor entre muchas puntuaciones ruidosas, su puntuación tiende a sobreestimar su rendimiento real.",
    simple: "Si muchos tiran una moneda 4 veces, el que sacó 4 caras no tiene una moneda mejor: tuvo suerte. Por eso hay que volver a medir con datos nuevos.",
    example: (ctx) => {
      const evo = ctx.store.evo();
      return { html: `Mejor candidata: ${(evo.best.score * 100).toFixed(1)} % en entrenamiento, ${(evo.bestHoldout * 100).toFixed(1)} % en reserva.`, prov: "local" };
    },
    where: ["c-archive"],
  },

  rsi: {
    title: "Automejora recursiva",
    def: "Un proceso en el que lo que se modificó del sistema vuelve a intervenir en el proceso que produce las siguientes modificaciones. Hay que medir si eso mejora la capacidad de mejorar; cerrar el bucle no lo garantiza.",
    simple: "Mejorar una herramienta es una cosa. Usar la herramienta mejorada para fabricar la siguiente herramienta es otra: ahí la mejora se aplica al propio proceso de mejorar. Puede ayudar, no servir o empeorar; hay que medirlo.",
    example: () => ({ html: "En esta demostración: el gestor de contexto mejorado también se usa para leer los informes de fallo que analiza el proponente. Si con él se ven mejores diagnósticos, las propuestas siguientes pueden cambiar.", prov: "sim" }),
    where: ["route3", "proponente", "archivo"],
  },
  demo_vs_real: {
    title: "Qué hace el Transformer en esta demostración",
    def: "El Transformer de juguete se estudia por dentro (capítulos 2–5), pero no resuelve las tareas del banco ni propone cambios. Esas partes las hacen reglas programadas: un solucionador simbólico y un proponente de reglas.",
    simple: "En un agente real, el modelo de lenguaje leería el registro y propondría código. Aquí, para poder verificar cada número, esos papeles los cumplen reglas escritas a mano. Donde el dibujo conecta el modelo con esas tareas, es una conexión conceptual.",
    example: () => ({ html: "La regla del solucionador: tomar el último ERROR visible, seguir su TRACE hasta una función y buscar un DEBUG con la causa. No hay ningún token del Transformer en esa cadena.", prov: "local" }),
    where: ["modelo", "proponente"],
  },
  contexto: {
    title: "Contexto",
    def: "Lo que el sistema tiene delante en un paso: tokens para el modelo, o líneas de registro para el agente. Tiene un límite de tamaño.",
    simple: "Es la hoja que el sistema puede leer ahora. Si la hoja es chica, hay que elegir qué copiar en ella.",
    example: (ctx) => ({ html: `La tarea ${ctx.store.splits().dev[14].seed} tiene ${ctx.store.splits().dev[14].totalTokens} tokens de registro y el contexto admite 64.`, prov: "local" }),
    where: ["contexto"],
  },
  observacion: {
    title: "Observación externa",
    def: "Un resultado que viene de ejecutar algo fuera del modelo: una prueba que falla, un mensaje de error, una salida de un programa.",
    simple: "Es lo que el sistema aprende mirando el mundo en vez de pensando: por ejemplo, «la prueba falló con este error».",
    example: (ctx) => ({ html: `ERROR ${esc(ctx.store.splits().dev[14].testName)} resultado distinto del esperado`, prov: "local" }),
    where: ["herramientas"],
  },
  gestor_contexto: {
    title: "Gestor de contexto",
    def: "La regla del agente que elige qué líneas de un registro entran en el contexto limitado (aquí, 64 tokens). Es código del agente, no un parámetro del modelo.",
    simple: "Imaginá que tenés que resumir un informe largo en una tarjeta. El gestor decide qué renglones copiar. Si copia los primeros y la clave estaba al final, la tarjeta no sirve.",
    example: () => ({ html: "v0: copiar en orden hasta llenar. v1: quitar duplicados, puntuar ERROR 3, TRACE 2, DEBUG 1, sumar puntos si la línea menciona la prueba fallida y copiar por puntaje.", prov: "local" }),
    where: ["codigo", "cart-v0", "contexto"],
  },
  particiones: {
    title: "Particiones de datos",
    def: "Conjuntos de tareas separados por su uso: desarrollo (analizar fallos), validación (comparar versiones), auditoría (medir fuera de la búsqueda) y prueba reservada (medir una sola vez al final).",
    simple: "Es como estudiar con unos ejercicios, practicar con otros, y rendir el examen con unos que nunca viste. Si estudiás con el examen, la nota deja de decir cuánto sabés.",
    example: () => ({ html: "Semillas 100–115 desarrollo, 200–239 validación, 300–359 prueba reservada, 400–439 auditoría: no se repite ninguna.", prov: "local" }),
    where: ["datos"],
  },
  presupuesto: {
    title: "Presupuesto de ejecuciones",
    def: "Cuántas veces se puede ejecutar una tarea del banco con alguna versión del gestor. Es un contador de ejecuciones, no tiempo, potencia de cálculo ni dinero.",
    simple: "Cada vez que probás una versión con una tarea, gastás una ficha. Las fichas son limitadas y hay que repartirlas entre analizar y comparar.",
    example: () => ({ html: "Un ciclo del bucle gasta 16 ejecuciones de desarrollo y 2 × 40 de validación (la versión activa y la candidata): 96 fichas.", prov: "local" }),
    where: ["entorno"],
  },
  criterio: {
    title: "Criterio de evaluación",
    def: "La regla explícita que decide si una versión es mejor que otra, sobre las mismas tareas.",
    simple: "Antes de comparar hay que decir qué cuenta como ganar. Si la regla es vaga, cualquier cambio parece una mejora.",
    example: () => ({ html: "Criterio estricto: promover sólo si el intervalo de confianza del 95 % de la diferencia de éxito queda entero por encima de 0.", prov: "local" }),
    where: ["evaluador"],
  },
  archivo: {
    title: "Archivo de versiones",
    def: "El registro de todas las variantes válidas que se probaron, con su origen. Guardar no es promover: una sola versión está activa.",
    simple: "Es el cajón donde guardás todos los borradores, también los que no elegiste. Sirve para volver atrás o probar otro camino.",
    example: () => ({ html: "En el capítulo 7: v1 activa, v0, v2 y v3 archivadas.", prov: "local" }),
    where: ["archivo"],
  },
  inferencia: {
    title: "Inferencia",
    def: "Usar el modelo con sus parámetros fijos para calcular una salida a partir de una entrada.",
    simple: "Es usar la calculadora: apretás teclas y sale un resultado. La calculadora no cambia por usarla.",
    example: (ctx) => {
      const generated = ctx.store.generation().greedy.generated.length;
      return { html: `Huella de los 2048 parámetros antes de generar: ${ctx.store.print0}. Después de generar ${generated} tokens: ${paramPrint(ctx.store.params0)}.`, prov: "local" };
    },
    where: ["modelo", "contexto"],
  },
  entrenamiento: {
    title: "Entrenamiento",
    def: "Un procedimiento que modifica los parámetros del modelo usando datos y una función objetivo que mide el error.",
    simple: "Es reajustar la calculadora para que, con los mismos datos, se equivoque menos. Después, la misma entrada da otro resultado.",
    example: () => ({ html: "En el capítulo 5 un paso de descenso por gradiente cambia los 160 parámetros de la cabeza de salida y la pérdida baja.", prov: "local" }),
    where: ["modelo"],
  },
  mejora_agente: {
    title: "Mejora del agente",
    def: "Cambiar las herramientas, la memoria, el código o la estrategia de un agente, con o sin cambiar los parámetros del modelo.",
    simple: "El mismo trabajador con otro método: lee distinto, anota distinto, prueba distinto. No hace falta cambiar al trabajador.",
    example: () => ({ html: "Reemplazar el gestor v0 (copiar en orden) por v1 (copiar por relevancia) con el modelo congelado.", prov: "local" }),
    where: ["codigo", "herramientas"],
  },
  proponente: {
    title: "Proponente de reglas",
    def: "El componente que analiza informes de fallo y construye una variante del gestor. En esta demostración sigue reglas programadas; no es un modelo de lenguaje.",
    simple: "Es una lista de «si pasa esto, probá aquello». Si el informe dice que una línea quedó afuera por falta de espacio, propone ordenar por importancia.",
    example: () => ({ html: "Regla «presupuesto»: si un diagnóstico dice «excluida por presupuesto», seleccionar por puntuación en vez de por orden.", prov: "local" }),
    where: ["proponente"],
  },
  autorreferencia: {
    title: "Autorreferencia",
    def: "Que una parte modificada del sistema intervenga en el proceso que la modifica.",
    simple: "Usar el gestor nuevo para leer los informes que sirven para diseñar el próximo gestor.",
    example: () => ({ html: "Modo B del capítulo 8: el gestor de la versión activa filtra los informes de fallo antes de que el proponente los lea.", prov: "sim" }),
    where: ["proponente", "route3"],
  },
  solucionador: {
    title: "Solucionador simbólico",
    def: "Una regla fija que intenta diagnosticar la tarea con lo que hay en el contexto: último ERROR visible → su TRACE → función → DEBUG con la causa. No aprende.",
    simple: "Es un detective con un procedimiento fijo. Si la pista no está en la hoja que le diste, no la puede usar.",
    example: (ctx) => {
      const run = runTask(ctx.store.splits().dev[14], VERSIONS.v1);
      return { html: `Con el contexto de v1 en la tarea 114: ${esc(run.steps[run.steps.length - 1])}.`, prov: "local" };
    },
    where: ["contexto", "evaluador"],
  },
  token: {
    title: "Token",
    def: "Una pieza de texto tomada de un vocabulario fijo. El modelo trabaja con secuencias de tokens, no con letras.",
    simple: "Es como cortar una frase en fichas de un juego. Cada ficha tiene que estar en la caja del vocabulario.",
    example: (ctx) => ({ html: `«${esc(ctx.user.text)}» → ${ctx.store.ids().map((id) => `«${esc(VOCAB[id])}»`).join(" ")}`, prov: "local" }),
    where: ["card0", "card1", "card2"],
  },
  identificador: {
    title: "Identificador",
    def: "El número entero que indica el lugar de un token en el vocabulario. No mide nada: sólo dice qué fila buscar.",
    simple: "Es el número de casillero de cada ficha. Que «x» sea el 3 no significa que valga 3.",
    example: (ctx) => ({ html: ctx.store.ids().map((id) => `«${esc(VOCAB[id])}» → ${id}`).join(", "), prov: "local" }),
    where: ["card0"],
  },
  embedding: {
    title: "Embedding",
    def: "El vector de números que la tabla E guarda para cada token del vocabulario. Es un parámetro; su copia para una posición es una activación.",
    simple: "Cada ficha tiene una tarjeta con 8 números en un fichero. Buscar el embedding es sacar la tarjeta y copiarla.",
    example: (ctx) => ({ html: `E[${ctx.store.ids()[0]}] (fila de «${esc(VOCAB[ctx.store.ids()[0]])}»): ${row(ctx.store.params0.E[ctx.store.ids()[0]])}`, prov: "local" }),
    where: ["mx-E"],
  },
  vector: {
    title: "Vector",
    def: "Una lista ordenada de números. Aquí cada posición del texto se representa con un vector de 8 números.",
    simple: "Una fila de una tabla. Ocho casilleros con números.",
    example: () => ({ html: "(0.12, −0.80, 1.05, 0.33, −0.41, 0.07, 0.95, −1.20): un vector de dimensión 8 (ejemplo ilustrativo).", prov: "ilus" }),
    where: ["mx-X0"],
  },
  dimension: {
    title: "Dimensión (d_model)",
    def: "Cuántos números tiene cada vector del flujo del modelo. Aquí, 8. Los modelos comerciales usan miles.",
    simple: "Es el ancho del carril: todo lo que viaja por el modelo tiene 8 números de ancho.",
    example: () => ({ html: "X₀ tiene 6 filas (posiciones) × 8 columnas (dimensión).", prov: "local" }),
    where: ["mx-X0"],
  },
  posicion: {
    title: "Embedding de posición",
    def: "Un vector por posición (tabla P) que se suma al vector del token para que el modelo distinga el mismo token en lugares distintos.",
    simple: "La misma palabra al principio o al final de una frase cumple papeles distintos. Sumar P marca el lugar.",
    example: (ctx) => ({ html: `X₀[0] = E[${ctx.store.ids()[0]}] + P[0] = ${row(ctx.store.trace().X0[0])}`, prov: "local" }),
    where: ["mx-P", "mx-X0"],
  },
  residual: {
    title: "Flujo residual",
    def: "El carril por el que viaja la representación de cada posición a lo largo del modelo. Cada subcapa le suma una corrección en vez de reemplazarla.",
    simple: "Es una nota que pasa de mano en mano: cada uno agrega algo al margen, pero nadie borra lo anterior.",
    example: (ctx) => {
      const b = ctx.store.trace().blocks[0];
      const n = b.X.length - 1;
      return { html: `Última fila: X = ${row(b.X[n])}; H = X + atención = ${row(b.H[n])}.`, prov: "local" };
    },
    where: ["vec-b0", "blk-b0"],
  },

  activacion: {
    title: "Activación",
    def: "Un número calculado por el modelo para una entrada concreta. Cambia si cambia el texto; no se guarda en el modelo.",
    simple: "Pensá en una calculadora con una fórmula fija. Los números que aparecen en la pantalla al usarla son activaciones: dependen de lo que escribiste. La fórmula no cambia.",
    example: (ctx) => ({ html: `La fila ${rowOf(ctx)} de X para «${tok(ctx, rowOf(ctx))}»: ${row(ctx.store.trace().blocks[0].ln1.out[rowOf(ctx)])}. Si cambiás ese token en el capítulo 2, estos ocho números cambian.`, prov: "local" }),
    where: ["t-X", "t-Q", "t-K", "t-V", "t-Z"],
  },
  parametro: {
    title: "Parámetro (peso aprendible)",
    def: "Un número guardado en el modelo que el entrenamiento puede ajustar. Durante el uso del modelo (inferencia) no cambia.",
    simple: "Es como la receta de la calculadora. Las mismas recetas se aplican a cualquier texto. Sólo el entrenamiento, en el capítulo 5, las reescribe.",
    example: (ctx) => ({ html: `Primera columna de W_Q: ${row(ctx.store.params0.blocks[0].Wq[ctx.user.head].map((r) => r[0]))}. Son 8 de los 2048 parámetros del modelo.`, prov: "local" }),
    where: ["t-Wq", "t-Wk", "t-Wv"],
  },
  qkv: {
    title: "Q, K y V",
    def: "Tres vectores que una cabeza de atención calcula para cada posición multiplicando su fila de X por tres matrices de parámetros: Q = X·W_Q (consulta), K = X·W_K (clave), V = X·W_V (valor).",
    simple: "De los mismos ocho números salen tres resúmenes distintos de cuatro números cada uno, porque se multiplican por tres matrices distintas. Uno se usa para comparar (Q), otro para ser comparado (K) y otro para aportar contenido (V). Los nombres describen ese papel en la cuenta; el modelo no hace preguntas.",
    example: () => ({ html: "Fila (1, 2) y matriz de una columna (3, −1): 1·3 + 2·(−1) = 1. Con otra columna, (0, 2): 1·0 + 2·2 = 4. Misma fila, columnas distintas, resultados distintos.", prov: "ilus" }),
    where: ["t-Q", "t-K", "t-V"],
  },
  celda: {
    title: "Celda de un producto de matrices",
    def: "Cada celda de C = A·B es la suma de los productos de una fila de A por una columna de B, número a número.",
    simple: "Tomás una fila y una columna del mismo largo, multiplicás los pares que están en la misma posición y sumás todo. Ese único número va a la celda donde se cruzan la fila y la columna.",
    example: () => ({ html: "Fila (2, 1, 0) · columna (1, 3, 5) = 2·1 + 1·3 + 0·5 = 5.", prov: "ilus" }),
    where: ["t-cube1"],
  },
  transpuesta: {
    title: "Transpuesta (Kᵀ)",
    def: "La misma matriz con filas y columnas intercambiadas. Si K tiene 6 filas y 4 columnas, Kᵀ tiene 4 filas y 6 columnas.",
    simple: "Es girar la tabla: lo que estaba en la fila 2 pasa a la columna 2. Los números no cambian, sólo dónde están. Hace falta para que Q·Kᵀ compare cada consulta con cada clave.",
    example: () => ({ html: "Matriz [[1, 2], [3, 4]] → transpuesta [[1, 3], [2, 4]].", prov: "ilus" }),
    where: ["t-K"],
  },
  producto_punto: {
    title: "Producto punto",
    def: "Suma de los productos de dos vectores número a número. Es grande y positivo cuando los vectores apuntan en direcciones parecidas.",
    simple: "Multiplicás cada par de números que están en la misma posición y sumás. Si los dos vectores «van hacia el mismo lado», el resultado es alto.",
    example: (ctx) => {
      const h = head(ctx);
      const i = rowOf(ctx);
      return { html: `Q_${i} · K_0 = ${h.Q[i].map((q, k) => `${n2(q)}·${n2(h.K[0][k])}`).join(" + ")} = ${n2(h.S[i][0])}.`, prov: "local" };
    },
    where: ["t-cube2", "t-S"],
  },
  puntuacion: {
    title: "Puntuación de atención",
    def: "El producto punto entre la consulta de una posición y la clave de otra, antes de escalar y normalizar. Puede ser negativo y no suma 1.",
    simple: "Es una nota cruda de parecido entre dos posiciones. Todavía no dice «cuánto tomar»: para eso hay que bloquear el futuro y pasar las notas por softmax.",
    example: (ctx) => ({ html: `Fila ${rowOf(ctx)} de QKᵀ: ${row(head(ctx).S[rowOf(ctx)])}. Hay negativas y la suma no es 1.`, prov: "local" }),
    where: ["t-S"],
  },
  escalado: {
    title: "Escalado por √d_k",
    def: "Dividir las puntuaciones por la raíz de la dimensión de K y Q (aquí √4 = 2) para que no crezcan con la dimensión.",
    simple: "Con vectores largos, las sumas de productos salen muy grandes y softmax daría casi todo a una sola posición. Dividir achica las distancias sin cambiar el orden.",
    example: () => ({ html: "Puntuaciones (4, 2) → divididas por 2: (2, 1). La primera sigue siendo mayor.", prov: "ilus" }),
    where: ["t-S"],
  },
  mascara: {
    title: "Máscara causal",
    def: "Una matriz M que se suma a las puntuaciones: 0 donde la posición j es anterior o igual a i, −∞ donde j es posterior. Impide usar información futura.",
    simple: "Al leer de izquierda a derecha, la posición 3 puede mirar las posiciones 0, 1, 2 y 3, pero no las que vienen después. La máscara tapa esas celdas con −∞, que softmax convierte en 0.",
    example: (ctx) => {
      const i = rowOf(ctx);
      const n = ctx.store.ids().length;
      return { html: `Para la fila ${i}: M = ${Array.from({ length: n }, (_, j) => (j <= i ? "0" : "−∞")).join("  ")}.`, prov: "local" };
    },
    where: ["t-S"],
  },
  softmax: {
    title: "Softmax",
    def: "softmax(z)_j = e^{z_j} / Σ_l e^{z_l}. Convierte una fila de números en valores entre 0 y 1 que suman 1.",
    simple: "Primero hacés que todo sea positivo elevando e a cada número; los grandes crecen mucho más. Después dividís por el total, y así obtenés proporciones que suman 1.",
    example: () => ({ html: "Puntuaciones (1, 0): e¹ = 2,72 y e⁰ = 1; suma 3,72 → (0,73, 0,27). Con −∞: e^−∞ = 0, así que esa proporción es 0.", prov: "ilus" }),
    where: ["t-S"],
  },
  coef_atencion: {
    title: "Coeficientes de atención (A)",
    def: "Las proporciones que da softmax en cada fila: cuánto aporta el valor V de cada posición a la nueva representación. Se calculan para cada entrada; no son parámetros.",
    simple: "Son porcentajes de mezcla. Si una fila dice (0,7, 0,3), la nueva representación es 70 % del primer valor y 30 % del segundo. Cambian con el texto; los parámetros, no.",
    example: (ctx) => ({ html: `Fila ${rowOf(ctx)} de A: ${row(head(ctx).A[rowOf(ctx)])} (suma ${n2(head(ctx).A[rowOf(ctx)].reduce((a, b) => a + b, 0))}).`, prov: "local" }),
    where: ["t-S"],
  },
  mezcla: {
    title: "Mezcla ponderada (Z = A·V)",
    def: "Cada fila de Z suma los vectores V de todas las posiciones, cada uno multiplicado por su coeficiente de atención.",
    simple: "Como preparar un color: 70 % de un tarro y 30 % de otro. Los coeficientes dicen las proporciones y V dice qué hay en cada tarro.",
    example: () => ({ html: "Ejemplo ilustrativo de dos posiciones: coeficientes (0,7, 0,3), V₀ = (1, 0), V₁ = (0, 2) → 0,7·(1, 0) + 0,3·(0, 2) = (0,7, 0,6).", prov: "ilus" }),
    where: ["t-Z", "t-V"],
  },
  cabeza: {
    title: "Cabeza de atención",
    def: "Un juego de tres matrices W_Q, W_K, W_V con su cálculo de atención. Este modelo tiene dos cabezas por bloque, que trabajan en paralelo con parámetros distintos.",
    simple: "Dos cabezas son dos maneras distintas de comparar y mezclar las mismas posiciones, porque usan matrices distintas. Sus resultados se juntan después.",
    example: (ctx) => ({ html: `Fila ${rowOf(ctx)} de A en la cabeza 1: ${row(ctx.store.trace().blocks[0].heads[0].A[rowOf(ctx)])}; en la cabeza 2: ${row(ctx.store.trace().blocks[0].heads[1].A[rowOf(ctx)])}.`, prov: "local" }),
    where: ["head-b0-0", "head-b0-1"],
  },
  interpretacion: {
    title: "Límite de interpretación",
    def: "Los coeficientes de atención muestran de dónde se mezcla información en una cabeza. No son una explicación completa de por qué el modelo produce su salida.",
    simple: "Saber de qué tarros se tomó pintura no dice para qué se va a usar el color. Además, con parámetros aleatorios, ninguna mezcla tiene un significado lingüístico aprendido.",
    example: () => ({ html: "Los parámetros de este modelo se generaron al azar con semilla 7: no fue entrenado con texto, así que sus coeficientes no reflejan gramática.", prov: "local" }),
    where: ["t-S"],
  },
};
