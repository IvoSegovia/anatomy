import { prov, esc, f2 } from "./helpers.mjs";
import { liveChecks } from "./checks.mjs";

export const SOURCES = [
  { id: "vaswani", title: "Vaswani et al., «Attention Is All You Need» (2017)", url: "https://arxiv.org/abs/1706.03762", use: "Escenas 3–4: atención escalada por √d_k, múltiples cabezas, máscara causal en el decodificador.", kind: "método" },
  { id: "gpt2", title: "Radford et al., «Language Models are Unsupervised Multitask Learners» (2019)", url: "https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf", use: "Escena 4: LayerNorm a la entrada de cada subbloque y LayerNorm final adicional (pre-LN), GELU.", kind: "método" },
  { id: "gelu", title: "Hendrycks y Gimpel, «Gaussian Error Linear Units (GELUs)» (2016)", url: "https://arxiv.org/abs/1606.08415", use: "Escena 4: activación GELU (aquí, la aproximación con tanh).", kind: "método" },
  { id: "adam", title: "Kingma y Ba, «Adam: A Method for Stochastic Optimization» (2014)", url: "https://arxiv.org/abs/1412.6980", use: "Escena 5: momentos m y v, corrección de sesgo, β1 = 0.9, β2 = 0.999, ε = 10⁻⁸.", kind: "método" },
  { id: "ppo", title: "Schulman et al., «Proximal Policy Optimization Algorithms» (2017)", url: "https://arxiv.org/abs/1707.06347", use: "Escena 6B: razón de probabilidades y objetivo recortado (ε = 0.2).", kind: "método" },
  { id: "reflexion", title: "Shinn et al., «Reflexion: Language Agents with Verbal Reinforcement Learning» (2023)", url: "https://arxiv.org/abs/2303.11366", use: "Escena 6A: retroalimentación verbal guardada en memoria entre intentos, sin actualizar pesos.", kind: "método" },
  { id: "godel", title: "Schmidhuber, «Gödel Machines: Self-Referential Universal Problem Solvers Making Provably Optimal Self-Improvements» (2003; v5 2006)", url: "https://arxiv.org/abs/cs/0309048", use: "Escena 9: propuesta teórica.", kind: "propuesta teórica" },
  { id: "dgm", title: "Zhang, Hu, Lu, Lange y Clune, «Darwin Gödel Machine: Open-Ended Evolution of Self-Improving Agents» (2025)", url: "https://arxiv.org/abs/2505.22954", use: "Escena 9: resultado empírico.", kind: "resultado empírico" },
  { id: "alphaevolve", title: "Novikov et al., «AlphaEvolve: A coding agent for scientific and algorithmic discovery» (2025)", url: "https://arxiv.org/abs/2506.13131", use: "Escena 9: resultado empírico.", kind: "resultado empírico" },
];

const NOTATION = [
  ["token", "unidad discreta de entrada; aquí, uno de 16 símbolos de juguete."],
  ["id", "índice entero del token en el vocabulario (0–15)."],
  ["E ∈ ℝ^{16×8}", "tabla de embeddings: fila id = vector del token (violeta: parámetro)."],
  ["P ∈ ℝ^{10×8}", "tabla de posiciones aprendidas: fila t = vector de la posición t."],
  ["X ∈ ℝ^{n×8}", "estado del flujo residual: una fila por posición (cian: activación). X₀ = E[id] + P[t]."],
  ["d_model = 8, d_k = 4", "anchura del flujo residual y de cada cabeza."],
  ["LN(x)", "normalización por capa: γ ⊙ (x − μ)/√(σ² + ε) + β, con μ y σ² de cada fila."],
  ["W_Q, W_K, W_V ∈ ℝ^{8×4}", "proyecciones de una cabeza (parámetros)."],
  ["Q, K, V ∈ ℝ^{n×4}", "consultas, claves y valores: Q = X W_Q, etc. (activaciones)."],
  ["QKᵀ", "matriz n×n de productos punto: (QKᵀ)_{ij} = Σ_k Q_{ik} K_{jk}."],
  ["M", "máscara causal: 0 si j ≤ i, −∞ si j > i (posiciones futuras)."],
  ["softmax(z)_j", "e^{z_j} / Σ_l e^{z_l}; cada fila suma 1 y e^{−∞} = 0."],
  ["A ∈ ℝ^{n×n}", "pesos de atención (escena 3). No confundir con la ventaja Â de la escena 6."],
  ["Z = A V", "combinación ponderada de valores, por cabeza."],
  ["W_O ∈ ℝ^{8×8}", "proyección tras concatenar las cabezas."],
  ["H, Y", "H = X + MHA(LN(X)); Y = H + MLP(LN(H)) (conexiones residuales)."],
  ["GELU(x)", "0.5·x·(1 + tanh(√(2/π)(x + 0.044715 x³)))."],
  ["W_U, b_U", "proyección final al vocabulario (logits)."],
  ["logits z", "puntuaciones sin normalizar del siguiente token."],
  ["p", "distribución del siguiente token: softmax(z)."],
  ["T > 0", "temperatura de muestreo: p_T ∝ exp(z / T). T no cambia pesos."],
  ["θ", "conjunto de parámetros (pesos). Huella: resumen FNV-1a que cambia si cambia un bit."],
  ["L = −log p(objetivo)", "pérdida de entropía cruzada de un ejemplo."],
  ["g = ∇_θ L", "gradiente: cuánto cambia L ante un cambio pequeño de cada parámetro (naranja)."],
  ["η", "tasa de aprendizaje (tamaño de paso). Distinta de la velocidad de reproducción."],
  ["m, v", "Adam: medias móviles de g y de g²; m̂, v̂ con corrección de sesgo."],
  ["π_θ(a)", "política: probabilidad de elegir la acción a."],
  ["R", "recompensa de un episodio (0 o 1)."],
  ["b", "baseline: media móvil de recompensas de lotes anteriores (no depende de la acción actual)."],
  ["Â = R − b", "ventaja: cuánto mejor (o peor) fue el episodio que lo esperado."],
  ["r(θ)", "PPO: razón π_θ(a)/π_old(a); el recorte limita r a [1−ε, 1+ε]."],
  ["S_t", "estado del sistema: (θ_t, código_t, memoria_t, estrategia_t)."],
  ["IC95", "intervalo de confianza del 95 % por bootstrap pareado (2000 remuestreos, semilla fija)."],
];

const TOPICS = {
  card: { title: "Tarjeta de token", kind: "entrada", role: "in", what: "Un token del contexto, con su símbolo de juguete. En la escena 2 puedes cambiarlo en la mesa de control: todo lo que depende de él se recalcula.", prov: "local" },
  "mx-E": { title: "Tabla de embeddings E", kind: "parámetro · 16×8", role: "w", what: "Cada fila es el vector asignado a un símbolo del vocabulario de juguete. Buscar un token = copiar su fila.", op: "x_tok = E[id]", prov: "local", more: "Valores aleatorios con semilla 7 (sin entrenar): no codifican significado." },
  "mx-P": { title: "Tabla de posiciones P", kind: "parámetro · 10×8", role: "w", what: "Un vector aprendido por posición (0–9). Se suma al vector del token.", op: "X₀[t] = E[id_t] + P[t]", prov: "local" },
  "mx-X0": { title: "X₀: entrada del primer bloque", kind: "activación · n×8", role: "in", what: "Una fila por posición: vector del token + vector de la posición.", op: "X₀ = E[ids] + P[0..n−1]", prov: "local" },
  "tray-emb": { title: "Bandeja de embeddings", kind: "bandeja del bastidor", role: "w", what: "Búsqueda en E, suma de P y salida X₀ hacia el flujo residual.", prov: "local" },
  "tray-b0": { title: "Bloque 1 (pre-LN)", kind: "bandeja del bastidor", role: "w", what: "H = X + MHA(LN(X)); Y = H + MLP(LN(H)). El bus cian es el flujo residual: se conserva y se le suman las salidas de las subcapas.", prov: "local" },
  "tray-b1": { title: "Bloque 2 (pre-LN)", kind: "bandeja del bastidor", role: "w", what: "La misma operación que el bloque 1 con otros pesos.", prov: "local" },
  "tray-out": { title: "Bandeja de salida", kind: "bandeja del bastidor", role: "w", what: "LayerNorm final, proyección W_U a 16 logits, softmax y selección del siguiente token.", prov: "local" },
  blk: { title: "Piezas del bloque", kind: "operaciones", role: "in", what: "LN₁ → dos cabezas → concatenar → W_O → suma residual → LN₂ → W₁ → GELU → W₂ → suma residual.", prov: "local" },
  head: { title: "Cabeza de atención causal", kind: "operación · d_k = 4", role: "w", what: "Calcula Q, K, V, los productos QKᵀ, escala por √d_k, enmascara el futuro, normaliza con softmax y combina V.", prov: "local" },
  "mx-wo": { title: "W_O", kind: "parámetro · 8×8", role: "w", what: "Mezcla las salidas concatenadas de las dos cabezas.", prov: "local" },
  "mx-w1": { title: "W₁ (MLP)", kind: "parámetro · 8×32", role: "w", what: "Primera proyección de la MLP: 8 → 32.", prov: "local" },
  "mx-w2": { title: "W₂ (MLP)", kind: "parámetro · 32×8", role: "w", what: "Segunda proyección de la MLP: 32 → 8.", prov: "local" },
  resid: { title: "Flujo residual", kind: "activación", role: "in", what: "El objeto de entrada se conserva y se le suma la salida de cada subcapa.", prov: "local" },
  out: { title: "Salida", kind: "operaciones", role: "in", what: "LN_f(h_n) · W_U + b_U = logits; softmax = p.", prov: "local" },
  "mx-Wu": { title: "W_U: proyección al vocabulario", kind: "parámetro · 8×16", role: "w", what: "Convierte el estado de la última posición en 16 logits. En la escena 5 es parte de los 160 parámetros que se entrenan.", prov: "local" },
  "bars-out": { title: "Logits y probabilidades", kind: "activación · 16", role: "in", what: "Arriba: logits (altura ∝ valor, gris si negativo). Abajo: p = softmax(logits); verde = token elegido; naranja = objetivo (escena 5).", prov: "local" },
};

export function infoFor(ctx, id) {
  if (!id) return null;
  return ctx.INFO[id] || TOPICS[id] || (ctx.extraInfo && ctx.extraInfo[id]) || null;
}

const roleWord = { in: "entrada / activación", w: "peso / parámetro", g: "gradiente / actualización", ok: "cumple el criterio", bad: "falla / regresión", off: "congelado / fijo / inactivo" };

export function renderInspector(ctx, selection) {
  const body = ctx.ref.inspBody;
  const tab = ctx.tab || "guide";
  if (tab === "guide") {
    if (ctx.lesson) ctx.lesson.render();
    return;
  }
  if (tab === "settings") {
    if (ctx.renderSettings) ctx.renderSettings();
    return;
  }
  if (tab === "refs") {
    body.innerHTML = `<h2>Referencias</h2>
    <details open><summary>Fuentes primarias</summary><div class="refs">${SOURCES.map((s) => `<p><a href="${s.url}" target="_blank" rel="noopener">${esc(s.title)}</a><br><span class="kind">${esc(s.kind)}</span> · ${esc(s.use)}</p>`).join("")}</div>
    <p class="kv">Las cifras citadas en el capítulo 9 se contrastaron con los resúmenes publicados de cada artículo.</p></details>
    <details><summary>Notación y colores</summary><p>Cada símbolo se define antes de usarse en la escena. Los colores codifican el papel de cada objeto y siempre van con etiqueta. La posición de una matriz en la escena es conceptual: no es su ubicación física en una GPU.</p>
    <div class="io" style="grid-template-columns:auto 1fr">${["in", "w", "g", "ok", "bad", "off"].map((r) => `<dt><span class="chip" style="height:18px"><i style="background:var(--c-${r})"></i></span></dt><dd>${roleWord[r]}</dd>`).join("")}</div>
    <dl class="io">${NOTATION.map(([a, b]) => `<dt class="kv">${esc(a)}</dt><dd>${esc(b)}</dd>`).join("")}</dl>
    <p>${prov("local")} se calcula en esta página y se puede comprobar. ${prov("cita")} proviene de un artículo enlazado. ${prov("sim")} o ${prov("ilus")} resulta de reglas declaradas por esta demostración, no de un sistema real.</p></details>
    <details class="live-checks"><summary>Verificación en vivo</summary><p>Comprobaciones ejecutadas en tu navegador con el mismo código que mueve la escena. La batería completa está en <span class="kv">verify.mjs</span>.</p><div class="checks-out"><button class="btn" data-run-checks>Ejecutar ahora</button></div></details>`;
    const run = body.querySelector("[data-run-checks]");
    run.addEventListener("click", () => {
      const out = body.querySelector(".checks-out");
      out.innerHTML = '<p class="kv">calculando…</p>';
      setTimeout(() => {
        const results = liveChecks(ctx.store);
        out.innerHTML = `<ul class="checks">${results.map((r) => `<li class="${r.ok ? "" : "x"}">${esc(r.name)}${r.detail ? ` <span class="kv">(${esc(r.detail)})</span>` : ""}</li>`).join("")}</ul><p class="kv">${results.filter((r) => r.ok).length}/${results.length} correctas</p>`;
      }, 30);
    });
    return;
  }
  const beat = ctx.beat;
  if (selection && selection.cell) {
    const c = selection.cell;
    const info = infoFor(ctx, selection.id);
    body.innerHTML = `<div class="kind">celda ${selection.i},${selection.j}${info ? ` · ${esc(info.title)}` : ""}</div><h2>${c.title}</h2>
      <dl class="io">${c.rows.map(([a, b]) => `<dt>${a}</dt><dd class="kv">${b}</dd>`).join("")}</dl>
      ${c.more ? `<h3>Explicación</h3><p>${c.more}</p>` : ""}<p>${prov(c.prov || "local")}</p>`;
    return;
  }
  const info = typeof selection === "string" ? infoFor(ctx, selection) : null;
  if (info) {
    const link = (ids, label) =>
      ids && ids.length
        ? `<dt>${label}</dt><dd>${ids.map((id) => `<button data-go="${id}">${esc((infoFor(ctx, id) || { title: id }).title)}</button>`).join("")}</dd>`
        : "";
    body.innerHTML = `<div class="kind">${esc(info.kind || "")}${info.role ? ` · <span class="${info.role}-t">${roleWord[info.role] || ""}</span>` : ""}</div><h2>${esc(info.title)}</h2>
      <p>${info.what || ""}</p>
      <h3>Entradas → operación → salidas</h3><dl class="io">${link(info.inputs, "entradas")}${info.op ? `<dt>operación</dt><dd class="kv">${esc(info.op)}</dd>` : ""}${link(info.outputs, "salidas")}</dl>
      ${info.more ? `<details open><summary>Más detalle</summary><p>${info.more}</p></details>` : ""}
      <p>${prov(info.prov || "local")}</p>`;
    body.querySelectorAll("[data-go]").forEach((button) =>
      button.addEventListener("click", () => {
        const id = button.getAttribute("data-go");
        ctx.inspectFromList(id);
        ctx.focus([id, `${id}-front`]);
        ctx.wake();
      }),
    );
    return;
  }
  const more = typeof beat.more === "function" ? beat.more(ctx) : beat.more;
  body.innerHTML = `<div class="kind">capítulo ${beat.c + 1} · paso ${beat.b + 1}</div><h2>${esc(beat.chapter.title)}</h2>
    ${beat.chapter.question ? `<p><b style="color:var(--ink)">${beat.chapter.question}</b></p>` : ""}
    ${more || `<p>${beat.title || ""}</p>`}
    ${beat.refs ? `<h3>Fuentes</h3><div class="refs">${beat.refs.map((id) => SOURCES.find((s) => s.id === id)).filter(Boolean).map((s) => `<p><a href="${s.url}" target="_blank" rel="noopener">${esc(s.title)}</a></p>`).join("")}</div>` : ""}
    <p class="kv" style="margin-top:14px;color:var(--ink-4)">Clic en cualquier objeto o celda de la escena: su nombre aparece encima y el detalle, aquí.</p>`;
}
