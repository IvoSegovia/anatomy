import { VOCAB } from "../../model/tokenizer.mjs";
import { argmax, temperatureProbs, prefillCache, stepWithCache, forward } from "../../model/transformer.mjs";
import { esc } from "../helpers.mjs";

const n2 = (x) => (Math.round(x * 100) / 100).toFixed(2).replace("-", "−");
const n3 = (x) => (Math.round(x * 1000) / 1000).toFixed(3).replace("-", "−");
const vec = (v) => `(${v.map(n2).join(", ")})`;
const last = (m) => m[m.length - 1];
const tok = (id) => `«${esc(VOCAB[id])}»`;
const b0 = (ctx) => ctx.store.trace().blocks[0];

export const N04 = {
  "4.1": [
    {
      concept: "cabeza",
      look: ["head-b0-0", "head-b0-1", "mx-b0-wo", "blk-b0"],
      orient: "Volvemos a la escala del bloque 1. Hay dos [[cabeza|cabezas]] de atención, {{head-b0-0|cabeza 1}} y {{head-b0-1|cabeza 2}}; cada una calculó su Z, 4 números por posición. Se ponen una al lado de la otra (4 + 4 = 8) y se multiplican por {{mx-b0-wo|W_O}}, una matriz de parámetros de 8×8, que combina lo que encontró cada cabeza.",
      act: "Las salidas de las dos cabezas viajan a W_O y se combinan.",
      cues: [{ at: 0.1, op: "transfer", targets: ["head-b0-0", "head-b0-1"] }, { at: 0.7, op: "matmul", targets: ["mx-b0-wo"] }],
      result: (ctx) => `La última fila de la atención combinada es ${vec(last(b0(ctx).attnOut))}. Cada cabeza usa sus propios parámetros, así que puede mezclar información de otra manera. W_O tampoco cambió.`,
    },
  ],
  "4.2": [
    {
      concept: "residual",
      look: ["blk-b0", "vec-b0"],
      orient: "Ahora la [[residual|conexión residual]]. El vector de entrada X no se reemplaza: viaja por el carril cian y se le **suma** la salida de la atención. H = X + atención. Así cada subcapa agrega una corrección en vez de borrar lo anterior.",
      act: "Sumamos la salida de la atención a X.",
      cues: [{ at: 0.45, op: "sum", targets: ["vec-b0"] }],
      result: (ctx) => {
        const b = b0(ctx);
        return `Última fila: X = ${vec(last(b.X))}, más la atención ${vec(last(b.attnOut))}, da H = **${vec(last(b.H))}**. Si la atención aportara cero, H sería igual a X: la información de entrada nunca se pierde por completo.`;
      },
    },
  ],
  "4.3": [
    {
      concept: "layernorm",
      look: ["blk-b0", "vec-b0"],
      orient: "Siguiente subcapa: la MLP. Antes se normaliza H con [[layernorm|LayerNorm]] (LN₂): a cada fila se le resta su media y se la divide por su desvío; después se reescala con dos parámetros, γ y β. Sirve para que los números lleguen en una escala parecida.",
      act: "LN₂ normaliza cada fila de H.",
      cues: [{ at: 0.9, op: "normalize", targets: ["blk-b0"] }],
      seconds: 1.2,
      result: (ctx) => `Última fila de LN₂(H): ${vec(last(b0(ctx).ln2.out))}. Su media es casi 0 y su desvío casi 1. H no se modificó: LayerNorm produce una copia normalizada que entra a la MLP.`,
    },
    {
      concept: "mlp",
      look: ["mx-b0-w1", "blk-b0"],
      orient: "La [[mlp|MLP]] transforma cada posición por separado. Primero {{mx-b0-w1|W₁}} lleva los 8 números a 32. Después [[gelu|GELU]], una curva suave que ves en el panel, deja pasar casi intactos los valores positivos y achica los negativos.",
      act: "u = LN₂(H)·W₁ + b₁ y después GELU(u), componente a componente.",
      cues: [{ at: 0.9, op: "matmul", targets: ["mx-b0-w1"] }],
      seconds: 1.2,
      result: (ctx) => {
        const b = b0(ctx);
        return `Primeros 8 de los 32 valores: u = ${vec(last(b.U).slice(0, 8))} y GELU(u) = ${vec(last(b.G).slice(0, 8))}. Los negativos quedan cerca de 0 y los positivos casi iguales. Esa curva es lo que permite a la MLP algo más que multiplicar matrices.`;
      },
    },
    {
      concept: "residual",
      look: ["mx-b0-w2", "blk-b0", "vec-b0"],
      orient: "{{mx-b0-w2|W₂}} vuelve de 32 números a 8, y el resultado se suma otra vez al carril residual: Y = H + MLP(LN₂(H)). Es la segunda corrección del bloque.",
      act: "Proyección a 8 y segunda suma residual.",
      cues: [{ at: 0.3, op: "matmul", targets: ["mx-b0-w2"] }, { at: 0.9, op: "sum", targets: ["vec-b0"] }],
      seconds: 1.4,
      result: (ctx) => `Última fila de Y: **${vec(last(b0(ctx).Y))}**. Termina el bloque 1: entró X, sale Y, con el mismo ancho de 8. Todo lo calculado son activaciones; ningún parámetro cambió.`,
    },
  ],
  "4.4": [
    {
      concept: "residual",
      look: ["blk-b1", "vec-b1", "head-b1-0", "head-b1-1", "mx-b1-wo", "mx-b1-w1", "mx-b1-w2"],
      orient: (ctx) => `El {{tray-b1|bloque 2}} repite exactamente las mismas operaciones con otros parámetros: atención con dos cabezas, suma residual, LayerNorm, MLP y otra suma. Su entrada es la Y del bloque 1. La última fila de su salida es ${vec(last(ctx.store.trace().blocks[1].Y))}.`,
    },
  ],
  "4.5": [
    {
      concept: "layernorm",
      look: ["out-base", "tray-out"],
      orient: "Para predecir el siguiente token sólo se usa la **última posición**: su vector final, h_n. Las otras posiciones ya influyeron en él a través de la atención. Primero pasa por una LayerNorm final.",
      act: "LN_f normaliza h_n.",
      cues: [{ at: 0.9, op: "normalize", targets: ["out-base"] }],
      seconds: 1.2,
      result: (ctx) => `h_n = ${vec(ctx.store.trace().hLast)} → LN_f(h_n) = ${vec(ctx.store.trace().lnf.out)}.`,
    },
    {
      concept: "logit",
      look: ["mx-Wu", "bars-out"],
      orient: "{{mx-Wu|W_U}}, de 8×16, convierte ese vector en 16 [[logit|logits]]: un número por símbolo del vocabulario. Un logit es una puntuación sin normalizar: más alto significa más favorecido.",
      act: "LN_f(h_n)·W_U + b_U da 16 logits.",
      cues: [{ at: 0.9, op: "matmul", targets: ["mx-Wu"] }],
      seconds: 1.2,
      result: (ctx) => {
        const tr = ctx.store.trace();
        const best = argmax(tr.logits);
        return `Mirá las {{bars-out|barras}}: arriba los logits (las grises son negativas). El más alto es el de ${tok(best)}, con ${n2(tr.logits[best])}. Todavía no es una probabilidad.`;
      },
    },
    {
      concept: "softmax",
      look: ["bars-out"],
      orient: "Igual que en la atención, [[softmax|softmax]] convierte esos 16 logits en números entre 0 y 1 que suman 1: las probabilidades del siguiente token.",
      act: "Softmax sobre los 16 logits.",
      cues: [{ at: 0.9, op: "normalize", targets: ["bars-out"] }],
      seconds: 1.2,
      result: (ctx) => {
        const tr = ctx.store.trace();
        const top = [...tr.probs.keys()].sort((a, b) => tr.probs[b] - tr.probs[a]).slice(0, 3);
        return `Las más probables: ${top.map((j) => `${tok(j)} ${n3(tr.probs[j])}`).join(", ")}. Con parámetros aleatorios, que gane ${tok(top[0])} no significa que el modelo entienda código.`;
      },
    },
  ],
  "4.6": [
    {
      concept: "argmax",
      look: ["bars-out", "card-next"],
      orient: "¿Cómo se elige el siguiente token? La regla más simple es [[argmax|argmax]]: tomar siempre el más probable.",
      act: "Elegimos el más probable.",
      cues: [{ at: 0.9, op: "token", targets: ["card-next"] }],
      seconds: 1,
      result: (ctx) => {
        const tr = ctx.store.trace();
        const g = argmax(tr.probs);
        return `argmax elige ${tok(g)}, con p = ${n3(tr.probs[g])}. Es determinista: con la misma entrada, siempre el mismo token. Elegir no cambia nada del modelo: sólo lee las probabilidades ya calculadas.`;
      },
    },
    {
      concept: "temperatura",
      look: ["bars-out", "card-next"],
      orient: (ctx) => `La alternativa es sortear con [[temperatura|temperatura]] T: se dividen los logits por T antes de softmax y se elige al azar según esas probabilidades. Con T menor que 1 la distribución se concentra; mayor que 1, se aplana. Ahora T = ${ctx.user.temperature.toFixed(2)} y la semilla del sorteo es ${ctx.user.sampleSeed}.`,
      act: "Sorteo con temperatura.",
      cues: [{ at: 0.9, op: "token", targets: ["card-next"] }],
      seconds: 1,
      result: (ctx) => {
        const tr = ctx.store.trace();
        const pT = temperatureProbs(tr.logits, ctx.user.temperature);
        const id = ctx.store.generation().sampled.generated[0].id;
        return `Salió ${tok(id)}, que con T = ${ctx.user.temperature.toFixed(2)} tenía probabilidad ${n3(pT[id])}. La temperatura sólo cambia cómo se elige: no toca ningún parámetro. Con la misma semilla el sorteo se repite exactamente.`;
      },
    },
  ],
  "4.7": [
    {
      concept: "cache_kv",
      look: ["tray-b0", "tray-b1"],
      orient: "Si el modelo genera varios tokens seguidos, recalcular todo cada vez repetiría trabajo. La [[cache_kv|caché KV]] guarda K y V de cada posición, en cada bloque y cabeza, después de procesar el texto inicial.",
      act: "Se procesa el texto inicial y se guardan K y V.",
      cues: [{ at: 0.9, op: "transfer", targets: ["tray-b0", "tray-b1"] }],
      seconds: 1,
      result: (ctx) => `Quedaron guardadas ${ctx.store.ids().length} filas de K y de V en cada una de las 4 cabezas (2 bloques × 2 cabezas). Son activaciones de esta entrada, no parámetros.`,
    },
    {
      concept: "cache_kv",
      look: ["tray-b0", "tray-b1"],
      orient: "Para el token siguiente basta con calcular **una fila nueva** por cabeza. Las anteriores no cambian, porque con la máscara causal K y V de una posición sólo dependen de los tokens anteriores a ella.",
      act: "Se calcula sólo la fila nueva y se reutiliza el resto.",
      cues: [{ at: 0.9, op: "lookup", targets: ["tray-b0", "tray-b1"] }],
      seconds: 1,
      result: (ctx) => {
        const ids = ctx.store.ids();
        const params = ctx.store.params0;
        const { cache, last: lastStep } = prefillCache(params, ids);
        const next = argmax(lastStep.logits);
        const step = stepWithCache(params, cache, next);
        const full = forward(params, [...ids, next]);
        const diff = Math.max(...step.logits.map((v, i) => Math.abs(v - full.logits[i])));
        return `Diferencia máxima entre los logits con caché y recalculando todo: ${diff.toExponential(1)}, es decir, cero a precisión de máquina. Mismo resultado, menos cuentas.`;
      },
    },
    {
      concept: "cache_kv",
      look: ["tray-b0", "tray-b1"],
      orient: (ctx) => `¿Y si cambia un token del medio, por ejemplo el de la posición ${Math.min(3, ctx.store.ids().length - 1)}? Todo lo que dependía de él deja de valer.`,
      act: "Se cambia un token y se marca lo que ya no sirve.",
      cues: [{ at: 0.9, op: "mask", label: "filas invalidadas", targets: ["tray-b0", "tray-b1"] }],
      seconds: 1,
      result: (ctx) => {
        const p = Math.min(3, ctx.store.ids().length - 1);
        return `Se invalidan las filas desde la posición ${p} en adelante, en los dos bloques: dependían del token cambiado. Las filas 0 a ${p - 1} siguen siendo válidas y se reutilizan.`;
      },
    },
  ],
  "4.8": [
    {
      concept: "inferencia",
      look: null,
      orient: (ctx) => `Generamos texto, el contexto creció y los cálculos cambiaron, pero **ningún parámetro cambió**. La huella de θ, un código de 8 caracteres calculado sobre los 2048 parámetros, sigue siendo ${ctx.store.print0}, la misma del principio. Eso es inferencia. En el capítulo siguiente sí vamos a cambiar parámetros.`,
    },
  ],
};
