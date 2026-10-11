import { baseVisibility, explode, moduleCamera, labCamera } from "../common.mjs";
import { table, prov } from "../helpers.mjs";

const KIND = {
  teo: '<span class="prov" data-p="ilus" style="border-color:#ab8dff66;color:#ddd0ff">propuesta teórica</span>',
  emp: '<span class="prov" data-p="cita" style="border-color:#4fd38366;color:#c6f2d7">resultado empírico</span>',
  did: '<span class="prov" data-p="sim">demostración didáctica</span>',
};

const CARDS = {
  godel: {
    title: "Gödel Machine · Schmidhuber",
    anchor: ["evaluador", "proponente"],
    kind: KIND.teo,
    html: `<p style="margin:4px 0">Jürgen Schmidhuber, <a href="https://arxiv.org/abs/cs/0309048" target="_blank" rel="noopener">arXiv cs/0309048</a> (2003; versión 5 de 2006).</p>
      <p style="margin:4px 0"><b>Idea</b>: un sistema que puede reescribir cualquier parte de su propio código, incluido su buscador de demostraciones, <b>sólo</b> cuando encuentra una demostración formal de que la reescritura aumenta su utilidad esperada. El hardware, el entorno, el código inicial y la función de utilidad se describen con axiomas.</p>
      <p style="margin:4px 0"><b>En el laboratorio</b>: sustituye el evaluador estadístico por una prueba formal.</p>
      <p style="margin:4px 0"><b>Límites</b>: buscar esas demostraciones puede ser enormemente costoso, y una mejora útil puede no ser demostrable dentro del sistema formal. Además exige formalizar entorno y utilidad. Es una propuesta teórica, no un resultado medido.</p>`,
  },
  dgm: {
    title: "Darwin Gödel Machine · Zhang et al.",
    anchor: ["archivo", "codigo"],
    kind: KIND.emp,
    html: `<p style="margin:4px 0">J. Zhang, S. Hu, C. Lu, R. Lange, J. Clune, <a href="https://arxiv.org/abs/2505.22954" target="_blank" rel="noopener">arXiv 2505.22954</a> (mayo de 2025).</p>
      <p style="margin:4px 0"><b>Idea</b>: agentes de programación que modifican su propio código usando <b>modelos base congelados</b>. Mantiene un <b>archivo ramificado</b> de agentes: se elige un padre, se genera un hijo modificado y se evalúa en benchmarks de programación.</p>
      <p style="margin:4px 0"><b>Resultado reportado</b> ${prov("cita")}: SWE-bench de 20,0 % a 50,0 %; Polyglot de 14,2 % a 30,7 %. En sus ablaciones, quitar la automodificación o el archivo abierto empeora el resultado.</p>
      <p style="margin:4px 0"><b>Diseñado desde fuera</b>: el modelo base (no se entrena), los benchmarks y la evaluación, y el bucle externo de selección y archivo. Los experimentos se hicieron con aislamiento y supervisión humana.</p>
      <p style="margin:4px 0"><b>Límites</b>: es costoso; mejora a un agente de programación en benchmarks concretos. No es lo mismo que RSI general.</p>`,
  },
  alphaevolve: {
    title: "AlphaEvolve · Novikov et al.",
    anchor: ["estC", "entorno"],
    kind: KIND.emp,
    html: `<p style="margin:4px 0">A. Novikov et al. (Google DeepMind), <a href="https://arxiv.org/abs/2506.13131" target="_blank" rel="noopener">arXiv 2506.13131</a> (junio de 2025; anuncio del 14 de mayo de 2025).</p>
      <p style="margin:4px 0"><b>Idea</b>: modelos de lenguaje proponen cambios de código, <b>evaluadores automáticos</b> los puntúan y una <b>base de datos evolutiva</b> selecciona qué programas seguir variando. Es como la estación C, pero con un LLM como proponente.</p>
      <p style="margin:4px 0"><b>Resultados reportados</b> ${prov("cita")}: un procedimiento para multiplicar matrices complejas 4×4 con 48 multiplicaciones escalares, la primera mejora sobre Strassen (1969) en ese caso. Una heurística de planificación de centros de datos que recupera en promedio un 0,7 % de los recursos de cómputo de Google. Un núcleo de la arquitectura de Gemini un 23 % más rápido, que reduce un 1 % el tiempo de entrenamiento de Gemini.</p>
      <p style="margin:4px 0"><b>Límites</b>: necesita una métrica que se pueda evaluar automáticamente. Mejorar un algoritmo usado en la infraestructura (incluso la que entrena al modelo) es una retroalimentación parcial e indirecta: no demuestra RSI general.</p>`,
  },
};

function card(ctx, key) {
  const c = CARDS[key];
  ctx.panel(`card-${key}`, { title: c.title, html: `<div style="margin-bottom:4px">${c.kind}</div>${c.html}`, width: 450 });
}

export const chapter9 = {
  title: "Conexión con investigaciones reales",
  question: "¿Qué se ha propuesto y qué se ha medido fuera de esta demostración?",
  setup(ctx) {
    baseVisibility(ctx, { rack: false, agent: true });
    explode(ctx, 0);
    ctx.show("ctx-lines", false);
  },
  beats: [
    {
      id: "9.1",
      dur: 13,
      scale: "lab",
      camera: () => moduleCamera(CARDS.godel.anchor, 20, { area: { left: 470 } }),
      caption: "<b>Gödel Machine</b> (propuesta teórica): reescribirse sólo con una demostración formal de que la reescritura es útil. Precisa, pero buscar esas pruebas puede ser inviable.",
      changed: { evaluador: "prueba formal (teoría)" },
      refs: ["godel"],
      pose(ctx, t) {
        ctx.focus(CARDS.godel.anchor);
        ctx.tag("pin-g", "evaluador", "◆ Gödel Machine", { dz: 40, role: "w", cls: "name" });
        if (t >= 0.5) card(ctx, "godel");
      },
    },
    {
      id: "9.2",
      dur: 13,
      scale: "lab",
      camera: () => moduleCamera(CARDS.dgm.anchor, 20, { area: { left: 470 } }),
      caption: "<b>Darwin Gödel Machine</b> (resultado empírico): un archivo ramificado de agentes de programación que modifican su código con modelos base congelados.",
      changed: { codigo: "agente (DGM)", pesos: "fijo" },
      refs: ["dgm"],
      pose(ctx, t) {
        ctx.focus([...CARDS.dgm.anchor, "cart-v0", "cart-v1", "cart-v2", "cart-v3"]);
        ctx.tag("pin-d", "archivo", "◆ DGM", { dz: 30, role: "ok", cls: "name" });
        if (t >= 0.5) card(ctx, "dgm");
        if (t >= 0.5) ctx.panel("tree", { title: "Archivo ramificado (esquema)", provKind: "ilus", html: `<pre class="code">agente₀
 ├─ agente₁ ── agente₄ ── agente₇
 │            └─ agente₅
 └─ agente₂ ── agente₃ ── agente₆ …</pre><div class="subst">Cualquier agente archivado puede ser padre, no sólo el mejor: esa apertura es parte del diseño.</div>`, width: 450, top: 470 });
      },
    },
    {
      id: "9.3",
      dur: 13,
      scale: "lab",
      camera: () => labCamera(),
      caption: "<b>AlphaEvolve</b> (resultado empírico): propuestas de código hechas por un LLM, evaluación automática y búsqueda evolutiva. Mejorar un algoritmo de infraestructura no es demostrar RSI general.",
      changed: { codigo: "algoritmos", infra: "planificación (citada)" },
      refs: ["alphaevolve"],
      pose(ctx, t) {
        ctx.focus([...CARDS.alphaevolve.anchor, "c-archive", "c-bins"]);
        ctx.tag("pin-a", "estC", "◆ AlphaEvolve", { dz: 30, role: "g", cls: "name" });
        if (t >= 0.5) card(ctx, "alphaevolve");
      },
    },
    {
      id: "9.4",
      dur: 8,
      scale: "lab",
      camera: () => labCamera(),
      caption: "Son trabajos distintos, con tipos de evidencia distintos. No forman una sola arquitectura.",
      changed: {},
      pose(ctx) {
        ctx.panel("cmp", {
          title: "Comparación",
          html: table(["trabajo", "tipo", "qué cambia", "cómo se valida", "qué queda fijo"], [["Gödel Machine", "propuesta teórica", "todo el código", "demostración formal", "axiomas, utilidad"], ["DGM", "resultado empírico", "código del agente", "benchmarks de programación", "modelo base, bucle externo"], ["AlphaEvolve", "resultado empírico", "programas evaluables", "evaluadores automáticos", "modelos, evaluadores"], ["esta página", "demostración didáctica", "gestor de contexto", "bootstrap pareado, auditoría", "θ, protocolo, reglas del proponente"]]),
          width: 560,
        });
      },
    },
  ],
};
