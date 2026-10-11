import { VOCAB } from "../../model/tokenizer.mjs";
import { esc } from "../helpers.mjs";

const n2 = (x) => (Math.round(x * 100) / 100).toFixed(2).replace("-", "−");
const row = (list) => list.map(n2).join("  ");
const toks = (ctx) => ctx.store.ids().map((id) => `«${esc(VOCAB[id])}»`);
const tokenCues = (count) => Array.from({ length: count }, (_, j) => ({ at: j / count + 0.01, op: "token", targets: [`card${j}`] }));

export const N02 = {
  "2.1": [
    {
      concept: "token",
      look: ["tray-emb", "tray-emb-front"],
      orient: (ctx) => `Empezamos por la entrada del modelo. El texto es corto: «${esc(ctx.user.text)}». El modelo no trabaja con letras: primero hay que cortar el texto en [[token|tokens]], piezas tomadas de un vocabulario fijo. Este vocabulario es de juguete, 16 símbolos inventados para la demostración; no es el de un modelo comercial.`,
    },
  ],
  "2.2": [
    {
      span: 6,
      concept: "token",
      look: ["tray-emb", "tray-emb-front"],
      orient: "Mirá la bandeja de entrada. Recorremos el texto de izquierda a derecha y, en cada posición, tomamos el símbolo más largo del vocabulario que coincida. Cada pieza será una tarjeta, y su lugar en la fila es su posición: 0, 1, 2…",
      act: "Se corta el texto en tokens, una tarjeta por pieza.",
      cues: tokenCues(6),
      result: (ctx) => `Quedaron ${ctx.store.ids().length} tokens: ${toks(ctx).join(" ")}. Los espacios no cuentan, y «def» es un solo token porque está entero en el vocabulario. Todavía no hay ningún número: sólo piezas en orden.`,
    },
  ],
  "2.3": [
    {
      concept: "identificador",
      look: ["tray-emb", "tray-emb-front"],
      orient: (ctx) => `Cada token se reemplaza por su [[identificador|identificador]], su número de lugar en el vocabulario: ${ctx.store.ids().map((id) => `«${esc(VOCAB[id])}» → ${id}`).join(", ")}. El número no mide nada; sólo dice qué fila de una tabla hay que buscar. El panel de la derecha muestra el vocabulario completo.`,
    },
  ],
  "2.4": [
    {
      concept: "embedding",
      look: ["mx-E", "mx-X0", "card0"],
      orient: (ctx) => {
        const id = ctx.store.ids()[0];
        return `Ahora cada identificador busca su [[embedding|embedding]]: una fila de la tabla {{mx-E|E}}, de 16 filas por 8 columnas. E es un parámetro (violeta): guarda 8 números por símbolo del vocabulario. Mirá la fila ${id} de E, la de «${esc(VOCAB[id])}»: la vamos a copiar a la posición 0.`;
      },
      act: "Se copia la fila de E a la posición 0.",
      cues: [{ at: 0.5, op: "lookup", targets: ["mx-E", "mx-X0"] }],
      result: (ctx) => `La posición 0 ya tiene un [[vector|vector]] de 8 números en cian: ${row(ctx.store.trace().tok[0])}. Esa copia es una activación de esta entrada; la tabla E no cambió. Ocho es la [[dimension|dimensión]] del modelo: todos los vectores del flujo tendrán ese ancho.`,
    },
    {
      span: 5,
      concept: "embedding",
      look: ["mx-E", "mx-X0"],
      orient: "Las demás posiciones hacen lo mismo, cada una con su identificador. Si un token se repitiera, copiaría exactamente la misma fila de E: la búsqueda no sabe nada del resto del texto.",
      act: "Una fila de E por cada token restante.",
      cues: Array.from({ length: 5 }, (_, j) => ({ at: (j + 0.5) / 5, op: "lookup", targets: ["mx-E", "mx-X0"] })),
      result: (ctx) => `{{mx-X0|Los vectores de token}} forman una tabla de ${ctx.store.ids().length} filas por 8 columnas. Todavía no indican dónde está cada token: «f» tendría el mismo vector en la posición 1 o en la 4.`,
    },
  ],
  "2.5": [
    {
      concept: "posicion",
      look: ["mx-P", "mx-X0"],
      orient: "Falta la posición. La tabla {{mx-P|P}} tiene una fila por cada lugar posible del texto, hasta 10. A la fila de la posición 0 le sumamos P[0], número a número: una suma simple de dos vectores de 8.",
      act: "X₀[0] = E[id] + P[0].",
      cues: [{ at: 0.5, op: "sum", targets: ["mx-X0"] }],
      result: (ctx) => `La fila 0 de {{mx-X0|X₀}} cambió a ${row(ctx.store.trace().X0[0])}: ahora combina qué token es y dónde está. P también es un parámetro; la suma creó una activación nueva sin modificar ninguna tabla.`,
    },
    {
      span: 5,
      concept: "posicion",
      look: ["mx-P", "mx-X0"],
      orient: "Cada posición recibe su propia fila de P: la posición 1 suma P[1], la 2 suma P[2], y así. Por eso el mismo token en dos lugares distintos termina con vectores distintos.",
      act: "Se suma P[t] a cada posición t.",
      cues: Array.from({ length: 5 }, (_, j) => ({ at: (j + 0.5) / 5, op: "sum", targets: ["mx-X0"] })),
      result: (ctx) => `Ya tenemos {{mx-X0|X₀}}: ${ctx.store.ids().length} filas por 8 columnas, la entrada del primer bloque. En todo este capítulo ningún parámetro cambió: cambiaron sólo las activaciones de esta entrada.`,
    },
  ],
  "2.6": [
    {
      concept: "residual",
      look: ["tray-emb", "mx-X0", "tray-b0", "blk-b0", "vec-b0"],
      orient: "X₀ entra al [[residual|flujo residual]] del bloque 1: un carril que recorre todo el modelo con ancho 8. Probá cambiar un token en la mesa de control: se recalculan X₀ y todo lo que depende de él, mientras los parámetros quedan iguales. Con parámetros aleatorios no hay comprensión lingüística detrás de estos números.",
    },
  ],
};
