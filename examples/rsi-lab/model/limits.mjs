// Escena 10: controles de límites. Cada control tiene un efecto DEFINIDO en runLoop:
//   presupuesto        → budget: ejecuciones de tareas totales disponibles para el bucle
//   ruido del evaluador → noise: probabilidad de invertir cada resultado de validación (pruebas inestables)
//   diversidad de tareas → families: cuántas familias aparecen en desarrollo y validación (la prueba siempre tiene 4)
//   coste de validación → nVal: tareas de validación consumidas por cada candidata
//   diversidad de candidatos → explore: probabilidad de elegir un padre distinto de la versión activa
import { runLoop } from "./loop.mjs";
import { VERSIONS } from "./agent.mjs";

export const FAMILY_ORDER = ["F2", "F1", "F3", "F4"];
export const CRITERIA = {
  estricto: "IC95 pareado de Δéxito > 0",
  ingenuo: "éxito puntual mayor (sin intervalo)",
  compuesto: "éxito − λ·coste mayor (sin puerta)",
  proxy: "densidad de ERROR/TRACE mayor (métrica imperfecta)",
};
export const CONTROLS = {
  budget: { label: "presupuesto de cómputo", unit: "ejecuciones", min: 120, max: 1500, step: 60, value: 900 },
  noise: { label: "ruido del evaluador", unit: "prob. de invertir", min: 0, max: 0.3, step: 0.05, value: 0 },
  diversity: { label: "diversidad de tareas", unit: "familias", min: 1, max: 4, step: 1, value: 4 },
  nVal: { label: "coste de validación", unit: "tareas/candidata", options: [10, 20, 40], value: 40 },
  explore: { label: "diversidad de candidatos", unit: "prob. de explorar", min: 0, max: 0.6, step: 0.1, value: 0.3 },
};

export function optionsOf(values) {
  return {
    budget: values.budget,
    noise: values.noise,
    families: values.diversity >= 4 ? null : FAMILY_ORDER.slice(0, values.diversity),
    nVal: values.nVal,
    explore: values.explore,
    criterion: values.criterion || "estricto",
    lambda: values.lambda ?? 0.1,
    start: VERSIONS[values.start || "v0"],
    metaMutation: values.metaMutation ?? true,
  };
}

// Escenarios de fallo concretos (cada uno es sólo una combinación de controles).
export const SCENARIOS = {
  base: { label: "protocolo cuidadoso", values: { budget: 900, noise: 0, diversity: 4, nVal: 40, explore: 0.3, criterion: "estricto" }, mode: "B", seed: 2,
    lesson: "Criterio estricto (IC95 > 0), validación amplia: las promociones se confirman en la prueba independiente." },
  sobreajuste: { label: "sobreajuste al benchmark", values: { budget: 900, noise: 0.15, diversity: 4, nVal: 10, explore: 0.3, criterion: "ingenuo", start: "v1", metaMutation: false }, mode: "B", seed: 1,
    lesson: "Las mismas 10 tareas ruidosas se consultan una y otra vez y se promueve con la estimación puntual: la puntuación visible sube por azar y la prueba baja." },
  metrica: { label: "métrica imperfecta", values: { budget: 900, noise: 0, diversity: 4, nVal: 40, explore: 0.3, criterion: "proxy", start: "v1", metaMutation: false }, mode: "B", seed: 7,
    lesson: "Se optimiza la densidad de líneas ERROR/TRACE en el contexto. Descartar DEBUG la sube, pero quita la causa que el solucionador necesita." },
  diversidad: { label: "pérdida de diversidad", values: { budget: 900, noise: 0, diversity: 4, nVal: 40, explore: 0, criterion: "estricto", metaMutation: false }, mode: "A", seed: 8,
    lesson: "Sin explorar padres del archivo, la búsqueda queda atrapada en un linaje. Con exploración 0.5 y la misma semilla llega más lejos." },
  dominio: { label: "regresión fuera del dominio", values: { budget: 900, noise: 0, diversity: 1, nVal: 40, explore: 0.3, criterion: "compuesto", lambda: 0.3, start: "v1", metaMutation: false }, mode: "B", seed: 8,
    lesson: "Desarrollo y validación sólo contienen la familia F2 (causa en el mensaje). Lo que allí parece igual y más barato falla en las otras familias de la prueba." },
  presupuesto: { label: "agotamiento del presupuesto", values: { budget: 160, noise: 0, diversity: 4, nVal: 40, explore: 0.3, criterion: "estricto" }, mode: "B", seed: 1,
    lesson: "Cada ciclo cuesta 16 ejecuciones de análisis + 40 de validación: con 160 sólo caben 2 ciclos y ninguno alcanza a probar una mejora." },
};

export function runScenario(name, overrides = {}) {
  const scenario = SCENARIOS[name];
  const values = { ...scenario.values, ...overrides };
  return { scenario, values, result: runLoop({ ...optionsOf(values), mode: scenario.mode, seed: scenario.seed }) };
}
