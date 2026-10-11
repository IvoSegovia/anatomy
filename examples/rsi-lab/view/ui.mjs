// Esqueleto de la interfaz: barra superior, escenario, HUD, inspector y transporte.
export const CHANGE_KEYS = [
  ["contexto", "Contexto"],
  ["pesos", "Pesos"],
  ["codigo", "Código"],
  ["datos", "Datos"],
  ["evaluador", "Evaluador"],
  ["infra", "Infraestructura"],
];

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "html") node.innerHTML = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of children.flat()) if (child !== undefined && child !== null && child !== false) node.append(child.nodeType ? child : document.createTextNode(String(child)));
  return node;
}

export function buildShell(app, chapters) {
  const ref = {};
  ref.top = el("header", { class: "top" });
  ref.brand = el("div", { class: "brand", html: "Anatomía de la automejora recursiva<small>del Transformer al sistema que mejora cómo se mejora</small>" });
  ref.mode = el("div", { class: "mode", role: "group", "aria-label": "Modo" });
  ref.modeTour = el("button", { "aria-pressed": "true", title: "Recorrido guiado (cámara y avance automáticos)" }, "Recorrido");
  ref.modeFree = el("button", { "aria-pressed": "false", title: "Exploración libre (cámara y controles manuales)" }, "Explorar");
  ref.mode.append(ref.modeTour, ref.modeFree);
  ref.chapters = el("nav", { class: "chapters", "aria-label": "Capítulos" });
  ref.chapterButtons = chapters.map((chapter, index) => {
    const button = el("button", { title: `${index + 1}. ${chapter.title}`, "aria-label": `Capítulo ${index + 1}: ${chapter.title}` }, String(index + 1));
    ref.chapters.append(button);
    return button;
  });
  ref.inspectorToggle = el("button", { class: "icon-btn", title: "Inspector (I)", "aria-pressed": "true", "aria-controls": "inspector" }, "Inspector");
  ref.help = el("button", { class: "icon-btn", title: "Atajos de teclado (?)" }, "?");
  ref.top.append(ref.brand, ref.chapters, ref.mode, ref.inspectorToggle, ref.help);

  ref.stage = el("section", { class: "stage", "aria-label": "Escena del laboratorio", tabindex: "0" });
  ref.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  ref.svg.setAttribute("class", "scene iso-svg");
  ref.svg.setAttribute("role", "img");
  ref.svg.setAttribute("aria-label", "Laboratorio computacional isométrico: modelo, contexto, herramientas, código del agente, datos, entorno, evaluador y archivo de versiones, con los tres bucles de mejora.");
  ref.labels = el("div", { class: "labels", "aria-hidden": "true" });
  ref.changed = el("div", { class: "hud changed", role: "status", "aria-label": "¿Qué cambió?" });
  ref.theta = el("div", { class: "hud theta" });
  ref.scalemap = el("div", { class: "hud scalemap" });
  ref.scales = el("div", { class: "scales", role: "group", "aria-label": "Escala" });
  ref.scaleButtons = {};
  [["lab", "Laboratorio"], ["model", "Modelo"], ["tensor", "Tensores"]].forEach(([key, name], index) => {
    if (index) ref.scales.append(el("span", { class: "sep", "aria-hidden": "true" }, "›"));
    const button = el("button", { "data-scale": key }, name);
    ref.scaleButtons[key] = button;
    ref.scales.append(button);
  });
  ref.backScale = el("button", { class: "icon-btn", title: "Volver a la escala anterior (Esc)" }, "← volver");
  ref.camtools = el("div", { class: "camtools" });
  ref.rotL = el("button", { class: "icon-btn", title: "Girar a la izquierda (Q)", "aria-label": "Girar a la izquierda" }, "⟲");
  ref.rotR = el("button", { class: "icon-btn", title: "Girar a la derecha (E)", "aria-label": "Girar a la derecha" }, "⟳");
  ref.zoomOut = el("button", { class: "icon-btn", title: "Alejar (−)", "aria-label": "Alejar" }, "−");
  ref.zoomIn = el("button", { class: "icon-btn", title: "Acercar (+)", "aria-label": "Acercar" }, "+");
  ref.camReset = el("button", { class: "icon-btn", title: "Restablecer cámara (R)" }, "⌂ cámara");
  ref.camtools.append(ref.rotL, ref.rotR, ref.zoomOut, ref.zoomIn, ref.camReset);
  ref.scalemap.append(el("div", { style: "display:flex;gap:6px" }, ref.backScale, ref.scales), ref.camtools);
  ref.caption = el("div", { class: "hud caption", "aria-live": "polite" });
  ref.capStep = el("div", { class: "step" });
  ref.capText = el("div", { class: "txt" });
  ref.backTour = el("button", { class: "btn back-tour" }, "Volver a la cámara guiada");
  ref.caption.append(ref.capStep, ref.capText, ref.backTour);
  ref.desk = el("div", { class: "hud desk", role: "region", "aria-label": "Mesa de control de la escena" });
  ref.disclaimer = el("div", { class: "hud disclaimer" }, "Representación conceptual: la posición de una matriz en la escena no es su ubicación física en una GPU.");
  ref.tip = el("div", { class: "tip", role: "tooltip" });
  ref.planes = el("div", { class: "planes" });
  ref.stage.append(ref.svg, ref.labels, ref.planes, ref.changed, ref.theta, ref.scalemap, ref.caption, ref.desk, ref.disclaimer, ref.tip);

  ref.inspector = el("aside", { class: "inspector", id: "inspector", "aria-label": "Inspector" });
  ref.tabs = el("div", { class: "insp-tabs", role: "tablist" });
  ref.tabButtons = {};
  [["obj", "Objeto"], ["notation", "Notación"], ["checks", "Verificación"], ["refs", "Fuentes"]].forEach(([key, name]) => {
    const button = el("button", { role: "tab", "aria-selected": key === "obj" ? "true" : "false", "data-tab": key }, name);
    ref.tabButtons[key] = button;
    ref.tabs.append(button);
  });
  ref.inspBody = el("div", { class: "insp-body", role: "tabpanel" });
  ref.inspector.append(ref.tabs, ref.inspBody);

  ref.transport = el("footer", { class: "transport", "aria-label": "Reproducción" });
  ref.reset = el("button", { class: "icon-btn", title: "Reiniciar el recorrido (0)" }, "⟲ reiniciar");
  ref.prev = el("button", { class: "icon-btn", title: "Retroceder al estado guardado anterior (←)", "aria-label": "Retroceder un evento" }, "◀");
  ref.play = el("button", { class: "icon-btn play", title: "Reproducir / pausar (espacio)", "aria-label": "Reproducir" }, "▶");
  ref.next = el("button", { class: "icon-btn", title: "Avanzar un evento (→)", "aria-label": "Avanzar un evento" }, "▶|");
  ref.speed = el("div", { class: "grp speed" });
  ref.speedSel = el("select", { "aria-label": "Velocidad de reproducción (no cambia cálculos)", title: "Velocidad de reproducción: sólo cambia el ritmo de la animación, no el presupuesto de cómputo ni la tasa de aprendizaje" });
  for (const value of [0.5, 0.75, 1, 1.5, 2, 3]) ref.speedSel.append(el("option", { value, selected: value === 1 }, `${value}×`));
  ref.speed.append(el("label", {}, "velocidad"), ref.speedSel);
  ref.timeline = el("div", { class: "timeline", role: "slider", tabindex: "0", "aria-label": "Línea de tiempo del recorrido", "aria-valuemin": "0", "aria-valuemax": "100" });
  ref.clock = el("div", { class: "clock" });
  ref.transport.append(el("div", { class: "grp" }, ref.reset, ref.prev, ref.play, ref.next), ref.speed, ref.timeline, ref.clock);

  ref.live = el("div", { class: "sr", "aria-live": "polite" });
  app.append(ref.top, ref.stage, ref.inspector, ref.transport, ref.live);
  return ref;
}

export function renderChanged(ref, changed, fixedNote) {
  ref.changed.innerHTML = "";
  ref.changed.append(el("span", { class: "h" }, "¿Qué cambió?"));
  for (const [key, name] of CHANGE_KEYS) {
    const value = changed[key] || "fijo";
    const state = value === "fijo" ? "fijo" : value === "activo" ? "activo" : "cambió";
    const detail = typeof value === "string" && !["fijo", "activo", "cambió"].includes(value) ? value : state;
    ref.changed.append(el("span", { class: "chip", "data-s": state, title: `${name}: ${detail}` }, el("i"), el("b", {}, name), el("em", {}, detail)));
  }
}
