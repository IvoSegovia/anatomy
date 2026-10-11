export const N09 = {
  "9.1": [
    {
      concept: "evidencia_tipos",
      look: ["evaluador", "proponente"],
      orient: "Tres trabajos reales, con tipos de evidencia distintos. Primero la [[evidencia_tipos|propuesta teórica]] Gödel Machine (Schmidhuber, 2003): un sistema que reescribe cualquier parte de su código sólo si encuentra una **demostración formal** de que el cambio aumenta su utilidad. En nuestro laboratorio, sería reemplazar el {{evaluador|evaluador}} estadístico por una prueba matemática.",
      act: "Se ubica la propuesta sobre el laboratorio.",
      cues: [{ at: 0.5, op: "lookup", targets: ["evaluador"] }],
      seconds: 1,
      result: "Qué permite pensar: una automejora con garantías. Qué **no** permite concluir: que sea practicable. Buscar esas demostraciones puede ser enormemente costoso, una mejora útil puede no ser demostrable, y hay que formalizar el entorno y la utilidad. No hay un resultado medido.",
    },
  ],
  "9.2": [
    {
      concept: "evidencia_tipos",
      look: ["archivo", "codigo"],
      orient: "Darwin Gödel Machine (Zhang y otros, 2025), un **resultado empírico**. Agentes de programación modifican su propio código con modelos base **congelados**, y un {{archivo|archivo ramificado}} guarda los agentes: cualquiera puede ser padre del siguiente. Es lo más parecido a nuestros capítulos 7 y 8, con un modelo de lenguaje en lugar del proponente de reglas.",
      act: "Se ubica el trabajo sobre el laboratorio.",
      cues: [{ at: 0.5, op: "lookup", targets: ["archivo"] }],
      seconds: 1,
      result: "Lo que reporta (resultado citado): en SWE-bench, de 20,0 % a 50,0 %; en Polyglot, de 14,2 % a 30,7 %, y quitar el archivo abierto o la automodificación empeora el resultado. Lo que no permite concluir: una automejora general. El modelo base, los benchmarks y el bucle externo los diseñaron personas, y se midió en tareas de programación concretas.",
    },
  ],
  "9.3": [
    {
      concept: "evidencia_tipos",
      look: ["estC", "entorno"],
      orient: "AlphaEvolve (Novikov y otros, Google DeepMind, 2025), otro **resultado empírico**. Un modelo de lenguaje propone cambios de código, evaluadores automáticos los puntúan y una base de datos evolutiva decide qué seguir variando. Es como nuestra {{estC|estación C}}, con un modelo de lenguaje en lugar de mutaciones al azar.",
      act: "Se ubica el trabajo sobre el laboratorio.",
      cues: [{ at: 0.5, op: "lookup", targets: ["estC"] }],
      seconds: 1,
      result: "Lo que reporta (resultado citado): multiplicar matrices complejas de 4×4 con 48 multiplicaciones escalares, una heurística que recupera en promedio el 0,7 % del cómputo de los centros de datos de Google y núcleos de entrenamiento más rápidos. Lo que no permite concluir: automejora recursiva general. Necesita una métrica evaluable automáticamente, y mejorar la infraestructura es una retroalimentación parcial e indirecta.",
    },
  ],
  "9.4": [
    {
      concept: "evidencia_tipos",
      look: null,
      orient: "Son trabajos distintos, con evidencia distinta: una propuesta teórica y dos resultados medidos en dominios concretos. No forman una sola arquitectura ni una escalera. La tabla del panel compara qué cambia en cada uno, cómo se valida y qué queda fijo. Las cifras son citas: conviene verificarlas en los artículos enlazados en la pestaña Fuentes.",
    },
  ],
};
