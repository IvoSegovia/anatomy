import { VOCAB } from "../../model/tokenizer.mjs";
import { lossAndGrad, headOf } from "../../model/train.mjs";
import { argmax } from "../../model/transformer.mjs";
import { esc } from "../helpers.mjs";
import { sgdEta, trackedParam } from "../ch/c05.mjs";

const n2 = (x) => (Math.round(x * 100) / 100).toFixed(2).replace("-", "−");
const n3 = (x) => (Math.round(x * 1000) / 1000).toFixed(3).replace("-", "−");
const tok = (id) => `«${esc(VOCAB[id])}»`;
const train = (ctx) => ctx.store.training();
const exOf = (ctx) => train(ctx).train[Math.min(5, ctx.user.example)];
const one = (ctx) => lossAndGrad(headOf(ctx.store.params0), [exOf(ctx)]).each[0];
const optName = (ctx) => (ctx.user.optimizer === "sgd" ? "SGD" : "Adam");

export const N05 = {
  "5.1": [
    {
      concept: "huella",
      look: null,
      orient: "Hasta ahora cambiaban los resultados de los cálculos, pero los parámetros seguían iguales. Mirá arriba a la izquierda la [[huella|huella de θ]]: un código corto calculado sobre los 2048 parámetros. Si cambiara uno solo de ellos, aunque fuera en el último decimal, la huella cambiaría.",
    },
    {
      concept: "entrenamiento",
      look: null,
      orient: "En este capítulo vamos a modificarlos. Primero comparamos la predicción con el objetivo. Esa diferencia se resume en la pérdida. Después calculamos cómo responde la pérdida a pequeños cambios de cada parámetro, y movemos cada uno un poco en la dirección que la achica.",
    },
  ],
  "5.2": [
    {
      concept: "congelado",
      look: ["mx-Wu", "tray-out"],
      orient: "Un cambio de escala, dicho de entrada: entrenar todo el Transformer excede esta demostración. Entrenamos sólo la [[cabeza_salida|cabeza de salida]]: γ_f y β_f de la LayerNorm final, {{mx-Wu|W_U}} y b_U, 160 parámetros reales. Los otros 1888 quedan [[congelado|congelados]]: el cuerpo del modelo calcula exactamente igual que antes.",
    },
  ],
  "5.3": [
    {
      concept: "objetivo",
      look: ["bars-out", "mx-Wu"],
      orient: (ctx) => {
        const ex = exOf(ctx);
        const e = one(ctx);
        return `Un ejemplo de entrenamiento: el texto «${esc(ex.text)}» y su [[objetivo|objetivo]], el token que debería seguir: ${tok(ex.target)}, en naranja en las {{bars-out|barras}}. Hoy el modelo le asigna p = ${n3(e.p[ex.target])}. Su favorito es ${tok(argmax(e.p))}.`;
      },
    },
  ],
  "5.4": [
    {
      concept: "perdida",
      look: ["bars-out"],
      orient: (ctx) => {
        const ex = exOf(ctx);
        const e = one(ctx);
        const r = train(ctx);
        return `La diferencia entre predicción y objetivo se resume en la [[perdida|pérdida]]: L = −log p(objetivo). Si p fuera 1, L valdría 0; cuanto más chica es p, más grande es L. Acá L = −log ${n3(e.p[ex.target])} = **${n3(e.loss)}**. La media en los 6 ejemplos de entrenamiento es ${n3(r.history[0].train)}; en los 4 de validación, ${n3(r.history[0].valid)}. La validación sólo mide: nunca se usa para cambiar parámetros.`;
      },
    },
  ],
  "5.5": [
    {
      concept: "gradiente",
      look: ["bars-out"],
      orient: "Ahora calculamos cómo responde la pérdida a pequeños cambios. Empezamos por los logits: ∂L/∂z = p − e_y, donde e_y vale 1 en el objetivo y 0 en el resto. Para el objetivo da un número negativo (conviene subir su logit) y para los demás, positivo (conviene bajarlos).",
      act: "Se calcula ∂L/∂z para este ejemplo.",
      cues: [{ at: 0.9, op: "gradient", targets: ["bars-out"] }],
      seconds: 1.4,
      result: (ctx) => {
        const ex = exOf(ctx);
        const e = one(ctx);
        return `Para el objetivo ${tok(ex.target)}: ∂L/∂z = ${n3(e.p[ex.target])} − 1 = **${n3(e.p[ex.target] - 1)}**, el único negativo. Para el favorito ${tok(argmax(e.p))}: ${n3(e.p[argmax(e.p)])}.`;
      },
    },
    {
      concept: "regla_cadena",
      look: ["mx-gWu", "mx-Wu"],
      orient: "La [[regla_cadena|regla de la cadena]] lleva esa señal hacia atrás, hasta {{mx-Wu|W_U}}: ∂L/∂W_U = uᵀ(p − e_y), una tabla de 8×16 con un número por parámetro. Es el [[gradiente|gradiente]]: indica en qué dirección aumentaría la pérdida si se moviera cada parámetro.",
      act: "El gradiente aparece sobre W_U, en naranja.",
      cues: [{ at: 0.9, op: "gradient", targets: ["mx-gWu"] }],
      seconds: 1.4,
      result: (ctx) => {
        const r = train(ctx);
        const g = lossAndGrad(r.history[0].head, r.train).grad.Wu;
        return `El {{mx-gWu|gradiente de W_U}}, promedio de los 6 ejemplos, tiene norma ${n3(Math.hypot(...g.flat()))}. Todavía no cambió nada: el gradiente es una medición, no una actualización.`;
      },
    },
    {
      concept: "diferencias_finitas",
      look: ["mx-gWu", "mx-Wu"],
      orient: "Lo mismo para γ_f y β_f. ¿Cómo sabemos que estas derivadas están bien? Con [[diferencias_finitas|diferencias finitas]]: se mueve cada parámetro un poquito hacia arriba y hacia abajo y se mide cuánto cambia la pérdida.",
      act: "Se calculan ∂L/∂γ y ∂L/∂β y se comparan con diferencias finitas.",
      cues: [{ at: 0.9, op: "gradient", targets: ["mx-gWu"] }],
      seconds: 1.4,
      result: (ctx) => `Error relativo máximo entre el gradiente calculado y las diferencias finitas, en los 160 parámetros: ${ctx.store.finiteDiff().worst.toExponential(1)}. Coinciden: las derivadas están bien.`,
    },
  ],
  "5.6": [
    {
      concept: "sgd",
      look: ["mx-Wu"],
      orient: (ctx) => {
        const eta = sgdEta(ctx);
        const p = trackedParam(ctx, eta);
        return `Ahora sí modificamos parámetros. [[sgd|SGD]] mueve cada uno en dirección contraria a su gradiente: θ' = θ − η·g, con [[tasa_aprendizaje|tasa de aprendizaje]] η = ${eta}. Seguimos uno concreto, resaltado en {{mx-Wu|W_U}}: W_U[${p.r}, ${tok(p.target)}]. Vale ${n3(p.before)} y su gradiente es ${n3(p.g)}.`;
      },
      act: "θ' = θ − η·g en los 160 parámetros a la vez.",
      cues: [{ at: 0.9, op: "update", targets: ["mx-Wu"] }],
      seconds: 1.4,
      result: (ctx) => {
        const eta = sgdEta(ctx);
        const p = trackedParam(ctx, eta);
        const r = ctx.store.training("sgd", eta);
        return `W_U[${p.r}, ${tok(p.target)}] pasó de ${n3(p.before)} a ${n3(p.before)} − ${eta}·(${n3(p.g)}) = **${n3(p.after)}**. Los otros 159 se movieron igual, cada uno según su gradiente. La huella de θ cambió: ${r.history[0].print} → ${r.history[1].print}. El cuerpo del Transformer no cambió.`;
      },
    },
    {
      concept: "perdida",
      look: ["mx-Wu", "bars-out"],
      orient: "¿Sirvió? Medimos la pérdida otra vez con los parámetros nuevos, en los ejemplos de entrenamiento y en los de validación. Los de validación no se usaron para calcular el gradiente.",
      act: "Se recalcula la pérdida.",
      cues: [{ at: 0.9, op: "evaluate", targets: ["bars-out"] }],
      seconds: 1,
      result: (ctx) => {
        const r = ctx.store.training("sgd", sgdEta(ctx));
        const [a, b] = [r.history[0], r.history[1]];
        return `Entrenamiento: ${n3(a.train)} → **${n3(b.train)}**. Validación: ${n3(a.valid)} → **${n3(b.valid)}**. ${b.valid < a.valid ? "En este paso bajaron las dos." : "La de entrenamiento bajó, pero la de validación no."}`;
      },
    },
  ],
  "5.7": [
    {
      span: 2,
      concept: "sobreajuste",
      look: ["mx-Wu", "bars-out"],
      orient: (ctx) => `Repetimos el paso 40 veces con los mismos 6 ejemplos (${optName(ctx)}, η = ${ctx.user.eta}). Mirá el gráfico: cian es la pérdida de entrenamiento; blanca punteada, la de validación, medida con 4 ejemplos que nunca se usan para actualizar.`,
      act: "Pasos 1 a 20.",
      cues: [{ at: 0.05, op: "update", targets: ["mx-Wu"] }, { at: 0.5, op: "update", targets: ["mx-Wu"] }, { at: 0.95, op: "update", targets: ["mx-Wu"] }],
      seconds: 3,
      result: (ctx) => {
        const h = train(ctx).history[20];
        return `Paso 20: entrenamiento ${n3(h.train)}, validación ${n3(h.valid)}.`;
      },
    },
    {
      span: 2,
      concept: "sobreajuste",
      look: ["mx-Wu", "bars-out"],
      orient: "Seguimos hasta el paso 40. Fijate en la curva blanca.",
      act: "Pasos 21 a 40.",
      cues: [{ at: 0.05, op: "update", targets: ["mx-Wu"] }, { at: 0.5, op: "update", targets: ["mx-Wu"] }, { at: 0.95, op: "evaluate", targets: ["bars-out"] }],
      seconds: 3,
      result: (ctx) => {
        const r = train(ctx);
        const va = r.history.map((h) => h.valid);
        const vmin = va.indexOf(Math.min(...va));
        return vmin < 40
          ? `La validación tuvo su mínimo en el paso ${vmin} (${n3(va[vmin])}) y después subió a ${n3(va[40])}, mientras el entrenamiento siguió bajando hasta ${n3(r.history[40].train)}. Eso es [[sobreajuste|sobreajuste]]: mejorar en los datos de entrenamiento no garantiza mejorar en datos nuevos.`
          : `Con esta η la validación siguió bajando hasta el paso 40 (${n3(va[40])}). Con η = 0.5 se ve otra cosa: su mínimo llega antes y después sube.`;
      },
    },
  ],
  "5.8": [
    {
      concept: "tasa_aprendizaje",
      look: ["mx-Wu", "bars-out"],
      orient: "¿Y si η es más grande? Con η = 1.2 cada paso mueve los parámetros más del doble que antes.",
      act: "40 pasos de SGD con η = 1.2.",
      cues: [{ at: 0.9, op: "update", targets: ["mx-Wu"] }],
      seconds: 1.2,
      result: (ctx) => {
        const h = ctx.store.training("sgd", 1.2).history.map((x) => x.train);
        const up = h.findIndex((v, i) => i > 0 && v > h[i - 1]);
        return `En el paso ${up} la pérdida de entrenamiento **subió** (${n3(h[up - 1])} → ${n3(h[up])}): el paso se pasó del mínimo. Después volvió a bajar. Una actualización puede empeorar las cosas.`;
      },
    },
    {
      concept: "tasa_aprendizaje",
      look: ["mx-Wu", "bars-out"],
      orient: "Ahora η = 3.",
      act: "40 pasos de SGD con η = 3.",
      cues: [{ at: 0.9, op: "update", targets: ["mx-Wu"] }],
      seconds: 1.2,
      result: "La pérdida diverge: los pasos son tan grandes que cada uno empeora el anterior. La [[tasa_aprendizaje|tasa de aprendizaje]] es un parámetro del optimizador, no la velocidad de la animación: la velocidad de abajo no cambia ningún cálculo.",
    },
  ],
  "5.9": [
    {
      concept: "adam",
      look: ["mx-Wu"],
      orient: "[[adam|Adam]] es otro optimizador. Guarda dos promedios por parámetro: m, del gradiente, y v, del gradiente al cuadrado. Corrige el sesgo del inicio (al principio m y v valen casi 0) y divide cada paso por √v. Así cada parámetro tiene su propio tamaño de paso.",
      act: "Primer paso de Adam con η = 0.05.",
      cues: [{ at: 0.9, op: "update", targets: ["mx-Wu"] }],
      seconds: 1.2,
      result: "En el primer paso, m y v se corrigen dividiendo por (1 − 0.9) y (1 − 0.999): el resultado es que cada parámetro se mueve casi exactamente η en contra del signo de su gradiente. El panel muestra los números de tres parámetros.",
    },
    {
      concept: "sobreajuste",
      look: ["mx-Wu", "bars-out"],
      orient: "Ahora 40 pasos de Adam, con los mismos ejemplos y la misma validación.",
      act: "Pasos 2 a 40 con Adam.",
      cues: [{ at: 0.1, op: "update", targets: ["mx-Wu"] }, { at: 0.95, op: "evaluate", targets: ["bars-out"] }],
      seconds: 3,
      result: (ctx) => {
        const r = ctx.store.training("adam", 0.05);
        const va = r.history.map((h) => h.valid);
        const vmin = va.indexOf(Math.min(...va));
        return `Con η = 0.05, Adam baja el entrenamiento hasta ${n3(r.history[40].train)}. La validación tiene su mínimo en el paso ${vmin} y termina en ${n3(va[40])}: también sobreajusta. Un optimizador más rápido no corrige que haya pocos datos.`;
      },
    },
  ],
};
