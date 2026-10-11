export const NAMES = {
  plate: ["Mesa del laboratorio", "La base de la maqueta. Las posiciones son conceptuales: no representan hardware."],
  bench: ["Banco de estaciones", "Aquí están las estaciones A, B y C del capítulo 6."],
  route1: ["Bucle 1 · resolver una tarea", "Cian: el agente lee el contexto, usa herramientas y responde. Nada del sistema cambia."],
  route2: ["Bucle 2 · modificar el sistema", "Naranja: se propone un cambio en el código del agente, se prueba y se evalúa."],
  route3: ["Bucle 3 · mejorar cómo se mejora", "Blanco punteado: una versión promovida participa en las propuestas siguientes."],
  modelo: ["Modelo θ", "El Transformer: convierte un contexto de tokens en probabilidades del siguiente token. Sus 2048 parámetros no cambian al usarlo."],
  datos: ["Datos", "Tareas separadas en desarrollo, validación, prueba reservada y auditoría."],
  contexto: ["Contexto", "Lo que el sistema tiene delante ahora: tokens, o líneas de registro elegidas por el gestor."],
  herramientas: ["Herramientas", "Ejecutan pruebas y leen registros: traen observaciones externas."],
  entorno: ["Entorno de ejecución", "Donde se ejecutan las versiones candidatas, con un presupuesto fijo."],
  codigo: ["Código del agente", "El gestor de contexto activo y la estrategia de experimentos: lo que la automejora modifica aquí."],
  proponente: ["Proponente de reglas", "Lee los diagnósticos visibles y propone un cambio con reglas programadas. No es un modelo de lenguaje."],
  evaluador: ["Evaluador", "Compara versiones en las mismas tareas y decide con un criterio estadístico explícito."],
  archivo: ["Archivo de versiones", "Guarda cada variante válida. Guardar no es promover: sólo una versión está activa."],
  estA: ["Estación A · reflexión", "Generar, probar, anotar el error y reintentar. Cambia la memoria; θ no cambia."],
  estB: ["Estación B · REINFORCE", "Una política pequeña aprende qué estrategia de lectura da más aciertos."],
  estC: ["Estación C · búsqueda evolutiva", "Muta programas, los evalúa con presupuesto y guarda los diversos."],
  "a-gen": ["Generador (guionado)", "Entrega un intento de código para promedio(lista). Los intentos están escritos de antemano."],
  "a-tests": ["Ejecutor de pruebas", "Ejecuta de verdad las 4 pruebas sobre el intento y marca cuáles fallan."],
  "a-memory": ["Memoria de notas", "Guarda la nota de reflexión que vuelve al contexto del intento siguiente."],
  "a-theta": ["θ congelado", "Los parámetros del modelo no cambian en esta estación."],
  "b-policy": ["Política π", "Probabilidad de elegir cada una de 4 estrategias de lectura de registros."],
  "b-batch": ["Lote de episodios", "Cada episodio prueba una estrategia en una tarea real: recompensa 1 si acierta."],
  "b-baseline": ["Baseline b", "Media de recompensas de lotes anteriores. La ventaja es R − b."],
  "c-archive": ["Archivo de diversidad", "Guarda el mejor programa de cada celda de comportamiento."],
  "c-bins": ["Máquinas del planificador", "Los programas reparten trabajos en máquinas de capacidad 100: menos máquinas, mejor."],
  "ctx-lines": ["Líneas del contexto", "Las líneas del registro que el gestor dejó entrar en 64 tokens."],
  "cart-v0": ["Gestor de contexto v0", "Código que decide qué líneas del registro entran al contexto."],
  "cart-v1": ["Gestor de contexto v1", "Variante del gestor que conserva las líneas que nombran la causa."],
  "cart-v2": ["Gestor de contexto v2", "Variante que ahorra espacio quedándose sólo con ERROR y TRACE."],
  "cart-v3": ["Gestor de contexto v3", "Variante con otro orden de prioridades; sin diferencia clara con v1."],
  "cart-an": ["Gestor del analista", "El gestor con el que se leen los informes de fallo antes de proponer."],
  "tray-emb": ["Bandeja de embeddings", "Busca el vector de cada token, le suma el de su posición y produce X₀."],
  "tray-b0": ["Bloque 1", "Atención y MLP, cada una sumada al flujo residual."],
  "tray-b1": ["Bloque 2", "La misma operación que el bloque 1, con otros parámetros."],
  "tray-out": ["Bandeja de salida", "Convierte el último estado en 16 logits y probabilidades."],
  "mx-E": ["Tabla de embeddings E", "Parámetro: una fila de 8 números por cada uno de los 16 símbolos."],
  "mx-P": ["Tabla de posiciones P", "Parámetro: un vector por posición, que se suma al del token."],
  "mx-X0": ["X₀", "Activación: vector del token más vector de su posición, una fila por posición."],
  "mx-Wu": ["W_U", "Parámetro: proyecta el estado final a 16 logits, uno por símbolo."],
  "mx-gWu": ["Gradiente de W_U", "Cuánto cambia la pérdida si cambia un poco cada parámetro de W_U."],
  "bars-out": ["Logits y probabilidades", "Arriba, los logits; abajo, p = softmax(logits). Verde: el token elegido."],
  "card-next": ["Siguiente token", "El token elegido a partir de las probabilidades."],
  "t-X": ["X · entrada de la cabeza", "Activación: una fila por posición del flujo residual."],
  "t-Wq": ["W_Q", "Parámetro: convierte cada fila de X en una consulta."],
  "t-Wk": ["W_K", "Parámetro: convierte cada fila de X en una clave."],
  "t-Wv": ["W_V", "Parámetro: convierte cada fila de X en un valor."],
  "t-Q": ["Q · consultas", "Activación: qué busca cada posición. Q = X·W_Q."],
  "t-K": ["K · claves", "Activación: cómo se ofrece cada posición para ser encontrada. K = X·W_K."],
  "t-V": ["V · valores", "Activación: lo que aporta cada posición si se la elige. V = X·W_V."],
  "t-S": ["Puntuaciones → atención", "QKᵀ/√d_k más la máscara; tras softmax, cada fila suma 1."],
  "t-Z": ["Z · salida de la cabeza", "Z = A·V: mezcla de valores ponderada por la atención."],
  "t-cube1": ["Productos X·W", "Cada columna del cubo suma 8 productos: así sale una celda de Q, K o V."],
  "t-cube2": ["Productos Q·Kᵀ", "Cada columna suma 4 productos: la puntuación entre dos posiciones."],
  "t-cube3": ["Productos A·V", "Cada columna suma productos de atención por valor: una celda de Z."],
};

const BY_PREFIX = [
  [/^card\d+$/, ["Tarjeta de token", "Un token del contexto. En el capítulo 2 se puede cambiar y todo se recalcula."]],
  [/^head-b(\d)-(\d)$/, (m) => [`Cabeza ${Number(m[2]) + 1} · bloque ${Number(m[1]) + 1}`, "Atención causal: cada posición mezcla información de las anteriores."]],
  [/^blk-b(\d)$/, (m) => [`Piezas del bloque ${Number(m[1]) + 1}`, "LayerNorm, dos cabezas, W_O, suma residual, MLP y otra suma residual."]],
  [/^mx-b(\d)-wo$/, (m) => [`W_O · bloque ${Number(m[1]) + 1}`, "Parámetro: mezcla las salidas de las dos cabezas."]],
  [/^mx-b(\d)-w1$/, (m) => [`W₁ · bloque ${Number(m[1]) + 1}`, "Parámetro: primera proyección de la MLP, de 8 a 32."]],
  [/^mx-b(\d)-w2$/, (m) => [`W₂ · bloque ${Number(m[1]) + 1}`, "Parámetro: segunda proyección de la MLP, de 32 a 8."]],
  [/^vec-b(\d)$/, (m) => [`Flujo residual · bloque ${Number(m[1]) + 1}`, "La entrada se conserva y se le suma la salida de cada subcapa."]],
  [/^out-base$/, () => ["Salida", "LayerNorm final, W_U, logits y softmax."]],
];

export function nameOf(id) {
  if (NAMES[id]) return NAMES[id];
  const base = id.replace(/-front$/, "");
  if (NAMES[base]) return NAMES[base];
  for (const [re, value] of BY_PREFIX) {
    const m = base.match(re);
    if (m) return typeof value === "function" ? value(m) : value;
  }
  return null;
}
