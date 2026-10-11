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
  ref.chapterMenu = el("div", { class: "chapter-menu" });
  ref.chapterBtn = el("button", { class: "chapter-btn", "aria-haspopup": "true", "aria-expanded": "false", title: "Elegir capítulo ([ y ])" });
  ref.chapterList = el("ol", { class: "chapter-list", hidden: true, role: "menu", "aria-label": "Capítulos" });
  ref.chapterButtons = chapters.map((chapter, index) => {
    const button = el("button", { role: "menuitem", "data-chapter": index }, el("span", { class: "n" }, String(index + 1)), el("span", {}, chapter.title));
    ref.chapterList.append(el("li", {}, button));
    return button;
  });
  ref.chapterMenu.append(ref.chapterBtn, ref.chapterList);
  ref.inspectorToggle = el("button", { class: "icon-btn", title: "Mostrar u ocultar el panel con la explicación (N o I)", "aria-pressed": "true", "aria-controls": "inspector" }, "Panel");
  ref.help = el("button", { class: "icon-btn", title: "Ajustes y atajos de teclado (?)", "aria-label": "Ajustes y atajos" }, "?");
  ref.top.append(ref.brand, ref.chapterMenu, el("div", { class: "spacer" }), ref.inspectorToggle, ref.help);

  ref.stage = el("section", { class: "stage", "aria-label": "Escena del laboratorio", tabindex: "0" });
  ref.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  ref.svg.setAttribute("class", "scene iso-svg");
  ref.svg.setAttribute("role", "img");
  ref.svg.setAttribute("aria-label", "Laboratorio computacional isométrico: modelo, contexto, herramientas, código del agente, datos, entorno, evaluador y archivo de versiones, con los tres bucles de mejora.");
  ref.labels = el("div", { class: "labels" });
  ref.rail = el("div", { class: "hud rail" });
  ref.changed = el("div", { class: "changed", role: "status", "aria-label": "¿Qué cambió?" });
  ref.theta = el("div", { class: "theta" });
  ref.rail.append(ref.changed, ref.theta);
  ref.scalemap = el("div", { class: "hud scalemap autohide" });
  ref.scales = el("div", { class: "scales", role: "group", "aria-label": "Escala" });
  ref.scaleButtons = {};
  [["lab", "Laboratorio"], ["model", "Modelo"], ["tensor", "Tensores"]].forEach(([key, name], index) => {
    if (index) ref.scales.append(el("span", { class: "sep", "aria-hidden": "true" }, "›"));
    const button = el("button", { "data-scale": key }, name);
    ref.scaleButtons[key] = button;
    ref.scales.append(button);
  });
  ref.backScale = el("button", { class: "icon-btn backscale", title: "Volver a la escala anterior (Esc)", "aria-label": "Volver a la escala anterior" }, "←");
  ref.camtools = el("div", { class: "camtools" });
  ref.rotL = el("button", { class: "icon-btn", title: "Girar a la izquierda (Q)", "aria-label": "Girar a la izquierda" }, "⟲");
  ref.rotR = el("button", { class: "icon-btn", title: "Girar a la derecha (E)", "aria-label": "Girar a la derecha" }, "⟳");
  ref.zoomOut = el("button", { class: "icon-btn", title: "Alejar (−)", "aria-label": "Alejar" }, "−");
  ref.zoomIn = el("button", { class: "icon-btn", title: "Acercar (+)", "aria-label": "Acercar" }, "+");
  ref.camReset = el("button", { class: "icon-btn", title: "Volver a la cámara guiada (C)", "aria-label": "Volver a la cámara guiada" }, "⌂");
  ref.camtools.append(ref.rotL, ref.rotR, ref.zoomOut, ref.zoomIn, ref.camReset);
  ref.scalemap.append(ref.backScale, ref.scales, ref.camtools);
  ref.caption = el("div", { class: "hud caption", "aria-live": "polite" });
  ref.capText = el("div", { class: "txt" });
  ref.caption.append(ref.capText);
  ref.backTour = el("button", { class: "hud btn back-tour" }, "Volver a la explicación");
  ref.desk = el("div", { class: "hud desk min", role: "region", "aria-label": "Mesa de control de la escena" });
  ref.opChip = el("div", { class: "hud opchip", "aria-hidden": "true" });
  ref.tip = el("div", { class: "tip", role: "tooltip" });
  ref.planes = el("div", { class: "planes" });
  ref.stage.append(ref.svg, ref.labels, ref.planes, ref.rail, ref.scalemap, ref.caption, ref.backTour, ref.desk, ref.opChip, ref.tip);

  ref.inspector = el("aside", { class: "inspector", id: "inspector", "aria-label": "Panel lateral" });
  ref.tabs = el("div", { class: "insp-tabs", role: "tablist" });
  ref.tabButtons = {};
  [["guide", "Guía"], ["obj", "Objeto"], ["refs", "Referencias"], ["settings", "Ajustes"]].forEach(([key, name]) => {
    const button = el("button", { role: "tab", "aria-selected": key === "guide" ? "true" : "false", "data-tab": key }, name);
    ref.tabButtons[key] = button;
    ref.tabs.append(button);
  });
  ref.inspBody = el("div", { class: "insp-body", role: "tabpanel" });
  ref.inspector.append(ref.tabs, ref.inspBody);

  ref.transport = el("footer", { class: "transport", "aria-label": "Reproducción" });
  ref.prev = el("button", { class: "icon-btn", title: "Volver a la fase anterior, con sus parámetros (←)", "aria-label": "Volver a la fase anterior" }, "◀");
  ref.play = el("button", { class: "icon-btn play", title: "Reproducción automática (espacio)", "aria-label": "Reproducción automática" }, "▶");
  ref.next = el("button", { class: "icon-btn next", title: "Siguiente (→ o Intro)", "aria-label": "Siguiente" }, "▶|");
  ref.timeline = el("div", { class: "timeline", role: "slider", tabindex: "0", "aria-label": "Línea de tiempo de la lección", "aria-valuemin": "0", "aria-valuemax": "100" });
  ref.clock = el("div", { class: "clock" });
  ref.transport.append(el("div", { class: "grp" }, ref.prev, ref.play, ref.next), ref.timeline, ref.clock);

  ref.live = el("div", { class: "sr", "aria-live": "polite" });
  app.append(ref.top, ref.stage, ref.inspector, ref.transport, ref.live);
  return ref;
}

export function renderChanged(ref, changed) {
  ref.changed.innerHTML = "";
  ref.changed.append(el("span", { class: "h" }, "¿Qué cambió?"));
  for (const [key, name] of CHANGE_KEYS) {
    const value = changed[key] || "fijo";
    const state = value === "fijo" ? "fijo" : value === "activo" ? "activo" : "cambió";
    const detail = typeof value === "string" && !["fijo", "activo", "cambió"].includes(value) ? value : state;
    ref.changed.append(el("span", { class: "chip", "data-s": state, title: `${name}: ${detail}` }, el("i"), el("b", {}, name), el("em", {}, state)));
  }
}
