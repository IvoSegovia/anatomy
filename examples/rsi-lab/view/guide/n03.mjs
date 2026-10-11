import { VOCAB } from "../../model/tokenizer.mjs";
import { esc } from "../helpers.mjs";

const n2 = (x) => (x === -Infinity ? "−∞" : (Math.round(x * 100) / 100).toFixed(2).replace("-", "−"));
const row = (list) => list.map(n2).join("  ");
const rowOf = (ctx) => Math.min(ctx.store.ids().length - 1, Math.max(0, ctx.user.row));
const tok = (ctx, i) => `«${esc(VOCAB[ctx.store.ids()[i]])}»`;
const data = (ctx) => {
  const tr = ctx.store.trace();
  const i = rowOf(ctx);
  const h = tr.blocks[0].heads[ctx.user.head];
  const p = ctx.store.params0.blocks[0];
  const x = tr.blocks[0].ln1.out[i];
  const prod = (key) => x.map((v, k) => v * p[key][ctx.user.head][k][0]);
  return { tr, i, h, x, prod, n: ctx.store.ids().length, hd: ctx.user.head + 1 };
};
const argmax = (list) => list.reduce((best, v, j) => (v > list[best] ? j : best), 0);

export const N03 = {
  "3.1": [
    {
      concept: "activacion",
      look: ["t-X", "t-Wq", "t-Wk", "t-Wv"],
      cap: "Mirá: X (cian) y las tres matrices W (violeta)",
      orient: (ctx) => {
        const { n, hd } = data(ctx);
        return `Entramos en la cabeza ${hd} del bloque 1. Mirá la superficie cian {{t-X|X}}: tiene ${n} filas, una por posición del texto, y 8 columnas. Cada fila representa un token en esta etapa: son [[activacion|activaciones]], calculadas para esta entrada. Encima están {{t-Wq|W_Q}}, {{t-Wk|W_K}} y {{t-Wv|W_V}}, en violeta: son [[parametro|parámetros]] del modelo y no cambian mientras se usa.`;
      },
    },
  ],
  "3.2": [
    {
      concept: "qkv",
      look: ["t-X", "t-Wq", "t-cube1"],
      orient: (ctx) => {
        const { i } = data(ctx);
        return `Mirá la fila iluminada de {{t-X|X}}: es la posición ${i}, el token ${tok(ctx, i)}. Contiene ocho números que representan esa posición. A partir de esos mismos números vamos a calcular tres vectores diferentes: [[qkv|Q, K y V]]. Primero seguimos cómo se obtiene la primera celda de Q, con la primera columna de {{t-Wq|W_Q}}.`;
      },
      act: "Multiplicamos cada número de la fila por el de W_Q que le corresponde y sumamos los ocho productos.",
      cues: [{ at: 0.04, op: "matmul", targets: ["t-X", "t-Wq", "t-cube1"] }, { at: 0.82, op: "sum", label: "suma de los ocho productos", targets: ["t-Q"] }],
      result: (ctx) => {
        const { i, h, prod } = data(ctx);
        return `La [[celda|celda]] Q[${i},0] vale **${n2(h.Q[i][0])}**: la suma de ${prod("Wq").map(n2).join(" + ")}. Con las otras tres columnas de W_Q se completa la fila ${i} de {{t-Q|Q}}: cuatro números. Cambió la representación de la posición; {{t-Wq|W_Q}} no cambió: es un parámetro fijo y se usa igual para todas las filas.`;
      },
    },
    {
      concept: "qkv",
      look: ["t-X", "t-Wk", "t-cube1"],
      orient: (ctx) => {
        const { i } = data(ctx);
        return `Con la misma fila ${i} de {{t-X|X}} calculamos ahora la clave K, usando otra matriz de parámetros: {{t-Wk|W_K}}. La operación es idéntica, ocho productos y una suma por celda. Sólo cambian los números de la matriz, y por eso el resultado cumple otra función: K permitirá que las demás posiciones comparen su consulta con esta.`;
      },
      act: "Misma fila de X, ahora por la primera columna de W_K.",
      cues: [{ at: 0.04, op: "matmul", targets: ["t-X", "t-Wk", "t-cube1"] }, { at: 0.82, op: "sum", label: "suma de los ocho productos", targets: ["t-K"] }],
      result: (ctx) => {
        const { i, h } = data(ctx);
        return `K[${i},0] vale **${n2(h.K[i][0])}**, distinto de Q[${i},0] = ${n2(h.Q[i][0])}, aunque ambos salen de los mismos ocho números. La diferencia está sólo en W_Q y W_K. «Consulta» y «clave» nombran el papel de cada vector en la cuenta siguiente; no significa que el modelo formule una pregunta.`;
      },
    },
    {
      concept: "qkv",
      look: ["t-X", "t-Wv", "t-cube1"],
      orient: (ctx) => {
        const { i } = data(ctx);
        return `Falta el tercer vector: el valor V, con {{t-Wv|W_V}}. V es lo que la posición ${i} aportará cuando otra posición tome información de ella. Al terminar, cada fila de X quedará convertida en tres vectores de cuatro números.`;
      },
      act: "Fila de X por la primera columna de W_V.",
      cues: [{ at: 0.04, op: "matmul", targets: ["t-X", "t-Wv", "t-cube1"] }, { at: 0.82, op: "sum", label: "suma de los ocho productos", targets: ["t-V"] }],
      result: (ctx) => {
        const { i, h, n } = data(ctx);
        return `V[${i},0] vale **${n2(h.V[i][0])}**. Las ${n} filas se calculan de la misma manera, cada una por su cuenta: {{t-Q|Q}}, {{t-K|K}} y {{t-V|V}} tienen ${n} filas y 4 columnas. Ninguna matriz W cambió; lo nuevo son activaciones propias de esta entrada.`;
      },
    },
  ],
  "3.3": [
    {
      concept: "transpuesta",
      look: ["t-Q", "t-K"],
      orient: (ctx) => {
        const { i } = data(ctx);
        return `Ahora seguimos la consulta {{t-Q|Q}} de la posición ${i}. La vamos a comparar con la clave {{t-K|K}} de cada posición. Para ordenar todas esas comparaciones en una tabla, K se coloca [[transpuesta|transpuesta]], Kᵀ: sus filas pasan a ser columnas. Los números no cambian, sólo su lugar.`;
      },
      act: "Q pasa a la cara izquierda del segundo cubo; K, girada, a la cara superior.",
      cues: [{ at: 0.1, op: "transfer", targets: ["t-Q", "t-K"] }],
    },
    {
      concept: "producto_punto",
      span: 6,
      look: ["t-Q", "t-K", "t-S", "t-cube2"],
      orient: (ctx) => {
        const { i } = data(ctx);
        return `Cada comparación es un [[producto_punto|producto punto]]: multiplicamos Q de la posición ${i} por K de otra posición, número a número (cuatro pares), y sumamos. Un número alto indica que esos dos vectores apuntan en direcciones parecidas. Vamos a recorrer las claves de todas las posiciones, en orden.`;
      },
      act: (ctx) => `Q de la posición ${rowOf(ctx)} · K de cada posición: cuatro productos y una suma por celda.`,
      cues: [{ at: 0.03, op: "matmul", targets: ["t-cube2", "t-S"] }],
      result: (ctx) => {
        const { i, h } = data(ctx);
        const best = argmax(h.S[i]);
        const future = best > i ? ` Esa posición es posterior a la ${i}: enseguida veremos qué pasa con ella.` : "";
        return `La fila ${i} de {{t-S|QKᵀ}} tiene una [[puntuacion|puntuación]] por posición: ${row(h.S[i])}. La más alta es la de la posición ${best}, ${tok(ctx, best)}.${future} Una puntuación todavía no es un porcentaje: hay negativas y no suman 1.`;
      },
    },
  ],
  "3.4": [
    {
      concept: "escalado",
      look: ["t-S"],
      orient: "Antes de normalizar, toda la tabla {{t-S|QKᵀ}} se divide por √d_k = √4 = 2. Con vectores más largos, los productos punto crecerían y el paso siguiente daría casi todo a una sola posición. Dividir acorta las distancias entre puntuaciones sin cambiar su orden.",
      act: "Dividimos cada celda por 2.",
      result: (ctx) => {
        const { i, h } = data(ctx);
        return `Fila ${i}: ${row(h.S[i])} → **${row(h.Sscaled[i])}**. El orden se mantiene: la más alta sigue siendo la misma. Este [[escalado|escalado]] es una constante de la fórmula, no un parámetro aprendido.`;
      },
    },
  ],
  "3.5": [
    {
      concept: "mascara",
      look: ["t-S"],
      orient: (ctx) => {
        const { i } = data(ctx);
        return `La posición ${i} puede usar su propio token y los anteriores. Las posiciones posteriores deben quedar excluidas: al predecir el siguiente token no se puede mirar lo que todavía no fue escrito. Para eso se suma la [[mascara|máscara causal]] M: 0 en las celdas permitidas y −∞ en las del futuro.`;
      },
      act: "Sumamos M: las celdas del futuro pasan a −∞.",
      cues: [{ at: 0.35, op: "mask", targets: ["t-S"] }],
      result: (ctx) => {
        const { i, h, n } = data(ctx);
        const blocked = Array.from({ length: n }, (_, j) => j).filter((j) => j > i);
        const best = argmax(h.Sscaled[i]);
        const note = best > i ? ` La puntuación más alta, la de la posición ${best}, quedó bloqueada.` : "";
        return blocked.length
          ? `Mirá las celdas bloqueadas de la fila ${i}: posiciones ${blocked.join(", ")}.${note} Después de normalizar, su contribución será exactamente cero. Las demás no cambiaron: sumar 0 las deja igual.`
          : `La fila ${i} es la última posición: no tiene futuro que bloquear, así que M no cambia ninguna de sus celdas. Probá otra fila en la mesa de control para ver celdas bloqueadas.`;
      },
    },
  ],
  "3.6": [
    {
      concept: "softmax",
      look: ["t-S"],
      orient: (ctx) => {
        const { i } = data(ctx);
        return `Ahora convertimos las puntuaciones de la fila ${i} en proporciones con [[softmax|softmax]]: elevamos e a cada puntuación y dividimos cada resultado por la suma. Así todos los valores quedan entre 0 y 1 y la fila suma 1. Como e^−∞ = 0, lo bloqueado queda en cero.`;
      },
      act: (ctx) => `Exponenciar y dividir por la suma, en la fila ${rowOf(ctx)}.`,
      cues: [{ at: 0.1, op: "normalize", targets: ["t-S"] }],
      result: (ctx) => {
        const { i, h } = data(ctx);
        return `La fila ${i} de {{t-S|A}} es **${row(h.A[i])}** y suma 1. Son [[coef_atencion|coeficientes de atención]]: cuánto contribuirá el valor V de cada posición a la nueva representación de la posición ${i}. No son parámetros del modelo: se recalculan para cada entrada.`;
      },
    },
    {
      concept: "softmax",
      look: ["t-S"],
      orient: "Las otras filas se normalizan de la misma manera, cada una por separado y con su propia máscara. La fila 0 sólo puede mirarse a sí misma: tiene una sola puntuación permitida, así que su único coeficiente valdrá 1.",
      act: "Softmax en todas las filas.",
      cues: [{ at: 0.1, op: "normalize", targets: ["t-S"] }],
      result: "Toda la tabla {{t-S|A}} quedó normalizada: cada fila suma 1 y el triángulo de arriba a la derecha, el futuro, vale 0. La pestaña Verificación del inspector comprueba ambas cosas con un error menor que 10⁻¹².",
    },
  ],
  "3.7": [
    {
      concept: "mezcla",
      look: ["t-S", "t-V"],
      orient: (ctx) => `Falta combinar. La fila ${rowOf(ctx)} de {{t-S|A}} dice cuánto tomar de cada posición; los vectores {{t-V|V}} dicen qué hay en cada una. Para multiplicarlos, A pasa a la cara izquierda del tercer cubo y V a la cara superior.`,
      act: "A y V se colocan en el tercer cubo.",
      cues: [{ at: 0.1, op: "transfer", targets: ["t-S", "t-V"] }],
    },
    {
      concept: "mezcla",
      look: ["t-S", "t-V", "t-Z", "t-cube3"],
      orient: (ctx) => {
        const { i } = data(ctx);
        return `Cada número de {{t-Z|Z}} es una mezcla. Si dos contribuciones fueran 0,7 y 0,3 (ejemplo ilustrativo de dos posiciones), tomaríamos 0,7 veces el primer vector V más 0,3 veces el segundo. Acá usamos los coeficientes reales de la fila ${i}, uno por posición.`;
      },
      act: (ctx) => `Z de la posición ${rowOf(ctx)} = suma de A[${rowOf(ctx)}, t] · V de cada posición t, columna por columna.`,
      cues: [{ at: 0.04, op: "matmul", targets: ["t-cube3"] }, { at: 0.9, op: "sum", label: "mezcla terminada", targets: ["t-Z"] }],
      result: (ctx) => {
        const { i, h } = data(ctx);
        const ranked = h.A[i].map((a, j) => [a, j]).filter(([a]) => a > 0).sort((a, b) => b[0] - a[0]).slice(0, 2);
        return `La fila ${i} de {{t-Z|Z}} es **${row(h.Z[i])}**. Lo que más pesa viene de ${ranked.map(([a, j]) => `la posición ${j} (${n2(a)})`).join(" y ")}; las posiciones futuras aportan exactamente 0. Es la salida de esta cabeza para la posición ${i}: una representación nueva que mezcla información de su pasado.`;
      },
    },
  ],
  "3.8": [
    {
      concept: "interpretacion",
      look: ["t-S", "t-Z"],
      orient: (ctx) => {
        const { i, h } = data(ctx);
        const best = argmax(h.A[i]);
        return `Una advertencia antes de seguir. {{t-S|A}} muestra de dónde se mezcla información en esta cabeza, no una explicación del razonamiento del modelo. Que la posición ${i} tome más de ${tok(ctx, best)} no significa nada lingüístico: estos parámetros son aleatorios. Además, otra cabeza, W_O, la MLP y un segundo bloque siguen transformando la información.`;
      },
    },
  ],
};
