import { runLoop, SEARCH_BUDGET } from "./loop.mjs";
import { VERSIONS } from "./agent.mjs";

export const FAMILY_ORDER = ["F2", "F1", "F3", "F4"];
export const CRITERIA = {
  estricto: "IC95 pareado de Δéxito > 0",
  ingenuo: "éxito puntual mayor (sin intervalo)",
  compuesto: "éxito − λ·coste mayor (sin puerta)",
  proxy: "densidad de ERROR/TRACE mayor (métrica imperfecta)",
};
export const CONTROLS = {
  budget: { label: "presupuesto de búsqueda", unit: "ejecuciones de desarrollo + validación", min: 100, max: 3000, step: 100, value: SEARCH_BUDGET },
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

const pct = (x) => `${Math.round(x * 100)} %`;
const promotedDiffs = (r) => r.cycles.filter((c) => c.promoted).flatMap((c) => c.diff);

export const SCENARIOS = {
  base: {
    label: "protocolo cuidadoso",
    values: { budget: SEARCH_BUDGET, noise: 0, diversity: 4, nVal: 40, explore: 0.3, criterion: "estricto" },
    mode: "B",
    seed: 2,
    lesson: (r) => `Criterio estricto (IC95 > 0) y 40 tareas de validación: ${r.promotions} promociones, y la prueba final pasa de ${pct(r.startTest)} a ${pct(r.finalTest)}.`,
    holds: (r) => r.promotions > 0 && r.finalTest > r.startTest,
  },
  sobreajuste: {
    label: "sobreajuste al benchmark",
    values: { budget: SEARCH_BUDGET, noise: 0.15, diversity: 4, nVal: 10, explore: 0.3, criterion: "ingenuo", start: "v1", metaMutation: false },
    mode: "B",
    seed: 14,
    lesson: (r) => `Las mismas 10 tareas de validación, con un 15 % de resultados invertidos al azar, se consultan en cada ciclo y se promueve con la estimación puntual: ${r.promotions} promociones, y la prueba final baja de ${pct(r.startTest)} a ${pct(r.finalTest)}.`,
    holds: (r) => r.promotions > 1 && r.finalTest < r.startTest && r.maxValQueries > 1,
  },
  metrica: {
    label: "métrica imperfecta",
    values: { budget: SEARCH_BUDGET, noise: 0, diversity: 4, nVal: 40, explore: 0.3, criterion: "proxy", start: "v1", metaMutation: false },
    mode: "B",
    seed: 1,
    lesson: (r) => `Se promueve lo que aumente la proporción de líneas ERROR/TRACE en el contexto. El cambio promovido (${promotedDiffs(r).join("; ") || "ninguno"}) la sube porque los reintentos repetidos son ERROR y TRACE, pero ocupan el lugar de la evidencia: la prueba final baja de ${pct(r.startTest)} a ${pct(r.finalTest)}.`,
    holds: (r) => r.promotions > 0 && r.finalTest < r.startTest && promotedDiffs(r).some((d) => d.startsWith("duplicados: se quitan → se conservan")),
  },
  diversidad: {
    label: "pérdida de diversidad",
    values: { budget: SEARCH_BUDGET, noise: 0, diversity: 4, nVal: 40, explore: 0, criterion: "estricto", metaMutation: false },
    mode: "A",
    seed: 8,
    lesson: (r) => `Sin explorar padres del archivo, cada candidata sale de la versión activa: la búsqueda queda en un solo linaje y termina con ${pct(r.finalTest)} en la prueba final. Abajo, la misma semilla explorando el archivo.`,
    holds: (r, other) => other && other.finalTest > r.finalTest,
  },
  dominio: {
    label: "regresión fuera del dominio",
    values: { budget: SEARCH_BUDGET, noise: 0, diversity: 1, nVal: 40, explore: 0.3, criterion: "compuesto", lambda: 0.3, start: "v1", metaMutation: false },
    mode: "B",
    seed: 8,
    lesson: (r) => `Desarrollo y validación sólo contienen la familia F2 (la causa está en el propio mensaje de error). Lo que allí parece igual y más barato falla en las otras familias: la prueba final, con las cuatro, baja de ${pct(r.startTest)} a ${pct(r.finalTest)}.`,
    holds: (r) => r.promotions > 0 && r.finalTest < r.startTest && r.lastValidTest > r.finalTest,
  },
  presupuesto: {
    label: "agotamiento del presupuesto",
    values: { budget: 200, noise: 0, diversity: 4, nVal: 40, explore: 0.3, criterion: "estricto" },
    mode: "B",
    seed: 1,
    lesson: (r) => `Un ciclo completo reserva 16 ejecuciones de desarrollo + 2 × 40 de validación = 96. Con ${r.budget} caben ${r.cycles.length} ciclos y ${r.promotions ? "sólo hubo " + r.promotions + " promoción" : "ninguno alcanza para probar una mejora"}.`,
    holds: (r) => r.promotions === 0,
  },
};

export function runScenario(name, overrides = {}) {
  const scenario = SCENARIOS[name];
  const values = { ...scenario.values, ...overrides };
  return { scenario, values, result: runLoop({ ...optionsOf(values), mode: scenario.mode, seed: scenario.seed }) };
}
