// Punto de entrada: arma la interfaz, el motor, el laboratorio, el estado común y el director.
import * as k from "../../../kit/iso-kit.mjs";
import { makeEngine, add3 } from "./engine.mjs";
import { buildShell, renderChanged, el } from "./ui.mjs";
import { buildLab, MAIN, BENCH, INFO, ROUTES, pointAlong } from "./lab.mjs";
import { buildRack } from "./rack.mjs";
import { buildTensors } from "./tensors.mjs";
import { buildStations } from "./stations.mjs";
import { makeStore } from "./store.mjs";
import { makeDirector } from "./director.mjs";
import { CHAPTERS } from "./chapters.mjs";
import { renderInspector } from "./inspector.mjs";
import { prov } from "./helpers.mjs";

const app = document.getElementById("app");
const ref = buildShell(app, CHAPTERS);
const engine = makeEngine({ stage: ref.stage, svg: ref.svg, labelLayer: ref.labels });
const store = makeStore();
const still = matchMedia("(prefers-reduced-motion: reduce)");
engine.measure();
buildLab(engine);
buildRack(engine, store);
buildTensors(engine, store);
buildStations(engine, store);

// ---------------- contexto compartido por los capítulos ----------------
const beatScoped = { labels: new Set(), panels: new Map() };
let changedNow = {};
let selection = null;
let wakeLoop = () => {};

const ctx = {
  engine,
  ref,
  store,
  user: store.user,
  k,
  still,
  INFO,
  ROUTES,
  pointAlong,
  show(ids, visible = true) {
    for (const id of [].concat(ids)) engine.pose(id, { visible });
  },
  only(ids) {
    const keep = new Set(ids);
    for (const [id] of engine.objects) engine.pose(id, { visible: keep.has(id) });
  },
  pose(id, pose) {
    engine.pose(id, pose);
  },
  state(id, state) {
    engine.pose(id, { state });
  },
  focus(ids) {
    const set = ids ? new Set([].concat(ids).filter(Boolean)) : null;
    // la bandeja (padre) de un objeto enfocado sigue visible como contexto
    if (set) for (const id of [...set]) {
      let parent = engine.objects.get(id)?.parent;
      while (parent) {
        set.add(parent);
        set.add(`${parent}-front`);
        parent = engine.objects.get(parent)?.parent;
      }
    }
    ref.svg.toggleAttribute("data-focus", !!set);
    // lo que descansa sobre un objeto enfocado (su grupo, nivel > 0) y sus hijos también se iluminan
    for (const [id, entry] of engine.objects) entry.el.toggleAttribute("data-on", !!set && (set.has(id) || (entry.parent && set.has(entry.parent)) || (entry.group && entry.level > 0 && set.has(entry.group))));
  },
  label(id, spec) {
    beatScoped.labels.add(id);
    return engine.label(id, spec);
  },
  tag(id, obj, text, { role = "", dz = 0, cls = "tag", local, d, at } = {}) {
    const entry = ctx.label(id, { obj, at, dz, local, d, cls, html: `<span>${text}</span>` });
    entry.el.dataset.r = role;
    return entry;
  },
  panel(id, { title = "", html = "", provKind, provText, dock = "left", top, left, right, width } = {}) {
    let node = beatScoped.panels.get(id);
    if (!node) {
      node = el("div", { class: "plane on", "data-panel": id });
      ref.planes.append(node);
      beatScoped.panels.set(id, node);
    }
    const head = title || provKind ? `<h4><span>${title}</span>${provKind ? prov(provKind, provText) : ""}</h4>` : "";
    const content = head + html;
    if (node._html !== content) {
      node.innerHTML = content;
      node._html = content;
    }
    const style = node.style;
    style.width = width ? `${width}px` : "";
    style.top = `${top ?? 78}px`;
    style.left = dock === "left" ? `${left ?? 12}px` : "";
    style.right = dock === "right" ? `${right ?? 12}px` : "";
    if (dock === "center") {
      style.left = "50%";
      style.transform = "translateX(-50%)";
    } else style.transform = "";
    return node;
  },
  closePanel(id) {
    const node = beatScoped.panels.get(id);
    if (node) node.remove();
    beatScoped.panels.delete(id);
  },
  clearBeat() {
    for (const id of beatScoped.labels) engine.unlabel(id);
    beatScoped.labels.clear();
    for (const node of beatScoped.panels.values()) node.remove();
    beatScoped.panels.clear();
    ctx.pulsesOff();
    ctx.focus(null);
  },
  changed(next, fixedNote) {
    changedNow = next || {};
    renderChanged(ref, changedNow, fixedNote);
  },
  theta(print, note = "", flash = false) {
    ref.theta.innerHTML = `<span>θ modelo: 2048 parámetros</span><span class="print${flash ? " flash" : ""}" title="Huella FNV-1a de todos los parámetros: cambia si cambia un solo bit">huella ${print}</span><span>${note}</span>`;
  },
  pulse(i, spec) {
    const id = `pulse${i}`;
    if (!spec) return engine.pose(id, { visible: false });
    let at = spec.at;
    if (spec.route) at = pointAlong(ROUTES[spec.route].points, spec.s);
    if (spec.path) at = pointAlong(spec.path, spec.s);
    engine.pose(id, { visible: true, state: { at: add3(at, [0, 0, spec.lift ?? 1.2]), role: spec.role || ROUTES[spec.route]?.role || "in", r: spec.r } });
  },
  pulsesOff() {
    for (let i = 0; i < 6; i++) engine.pose(`pulse${i}`, { visible: false });
  },
  desk(title, build) {
    ref.desk.innerHTML = "";
    if (!build) {
      ref.desk.classList.remove("on");
      ref.stage.classList.remove("has-desk");
      return;
    }
    ref.desk.classList.add("on");
    ref.stage.classList.add("has-desk");
    if (engine.size.w < 760 && !ref.desk.dataset.touched) {
      ref.desk.classList.add("min");
      ref.stage.classList.add("desk-min");
    }
    const toggle = el("button", { "aria-expanded": ref.desk.classList.contains("min") ? "false" : "true", title: "Plegar o desplegar la mesa de control" }, ref.desk.classList.contains("min") ? "desplegar" : "plegar");
    toggle.addEventListener("click", () => {
      ref.desk.dataset.touched = "1";
      const min = ref.desk.classList.toggle("min");
      ref.stage.classList.toggle("desk-min", min);
      toggle.textContent = min ? "desplegar" : "plegar";
      toggle.setAttribute("aria-expanded", min ? "false" : "true");
    });
    ref.desk.append(el("h3", {}, el("span", {}, `Mesa de control · ${title}`), toggle));
    build(ref.desk);
  },
  refresh() {
    director.apply();
    wakeLoop();
  },
  restoreUser(user) {
    store.restore(user);
    ctx.onUserRestore && ctx.onUserRestore();
  },
  inspect(id) {
    selection = id;
    renderInspector(ctx, selection);
  },
  say(text) {
    ref.live.textContent = text;
  },
  scale(name) {
    for (const [key, button] of Object.entries(ref.scaleButtons)) button.setAttribute("aria-current", key === name ? "true" : "false");
    ctx.currentScale = name;
  },
  get beat() {
    return director.beat;
  },
  get event() {
    return director.eventOf(director.beat, director.S.t);
  },
  get t() {
    return director.S.t;
  },
  wake: () => wakeLoop(),
  // Cámara que sigue un evento dentro de un paso (sólo en el recorrido guiado).
  follow(spec) {
    if (director.S.mode !== "tour" || director.S.manualCam) return;
    director.flyTo(director.cameraFor({ camera: spec }), 1.1);
  },
};

// ---------------- director ----------------
const director = makeDirector({
  chapters: CHAPTERS,
  engine,
  ref,
  ctx,
  hooks: {
    chapter(chapter, c) {
      ref.chapterButtons.forEach((button, i) => {
        button.setAttribute("aria-current", i === c ? "true" : "false");
        button.classList.toggle("done", i < c);
      });
      ref.desk.classList.remove("on");
      ref.stage.classList.remove("has-desk");
      if (chapter.desk) chapter.desk(ctx);
    },
    beat(beat) {
      ctx.scale(beat.scale || "lab");
      ref.capStep.textContent = `${beat.c + 1}.${beat.b + 1} · ${beat.chapter.title}`;
      const text = typeof beat.caption === "function" ? beat.caption(ctx) : beat.caption;
      ref.capText.innerHTML = text || "";
      ctx.say(`${beat.chapter.title}. ${(text || "").replace(/<[^>]+>/g, "")}`);
      const changed = typeof beat.changed === "function" ? beat.changed(ctx) : beat.changed;
      ctx.changed(changed || {});
      if (!selection) renderInspector(ctx, null);
    },
    applied(beat) {
      if (typeof beat.caption === "function") ref.capText.innerHTML = beat.caption(ctx);
      if (typeof beat.changed === "function") ctx.changed(beat.changed(ctx));
    },
  },
});
ctx.director = director;
ctx.theta(store.print0, "sin cambios");

// ---------------- línea de tiempo ----------------
function buildTimeline() {
  ref.timeline.innerHTML = '<div class="track"></div><div class="fill"></div>';
  const total = director.total;
  let lastC = -1;
  director.beats.forEach((beat, i) => {
    const x = (director.startOf[i] / total) * 100;
    if (beat.c !== lastC) {
      ref.timeline.append(el("div", { class: "tick", style: `left:${x}%` }));
      ref.timeline.append(el("div", { class: "num", style: `left:${x}%` }, String(beat.c + 1)));
      lastC = beat.c;
    }
    for (let e = 1; e < beat.events; e++) ref.timeline.append(el("div", { class: "ev", style: `left:${((director.startOf[i] + (beat.dur * e) / beat.events) / total) * 100}%` }));
  });
  ref.head = el("div", { class: "head" });
  ref.timeline.append(ref.head);
}
buildTimeline();
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
function updateTimeline() {
  const share = director.position / director.total;
  ref.timeline.querySelector(".fill").style.width = `${share * 100}%`;
  ref.head.style.left = `${share * 100}%`;
  const beat = director.beat;
  const e = director.eventOf(beat, director.S.t);
  ref.clock.textContent = `${mmss(director.position / director.S.speed)} / ${mmss(director.total / director.S.speed)} · ev ${e}/${beat.events}`;
  ref.timeline.setAttribute("aria-valuenow", String(Math.round(share * 100)));
  ref.timeline.setAttribute("aria-valuetext", `Capítulo ${beat.c + 1}, paso ${beat.b + 1}, evento ${e} de ${beat.events}`);
  ref.play.textContent = director.S.playing ? "❚❚" : "▶";
  ref.play.setAttribute("aria-label", director.S.playing ? "Pausar" : "Reproducir");
  ref.backTour.classList.toggle("on", director.S.manualCam && director.S.mode === "tour");
}
function seekShare(share) {
  const time = share * director.total;
  let i = director.startOf.findIndex((start, j) => time >= start && time < start + director.beats[j].dur);
  if (i < 0) i = director.beats.length - 1;
  const t = (time - director.startOf[i]) / director.beats[i].dur;
  const beat = director.beats[i];
  director.seek(i, Math.round(t * beat.events) / beat.events);
  wakeLoop();
}
ref.timeline.addEventListener("pointerdown", (event) => {
  const box = ref.timeline.getBoundingClientRect();
  seekShare(Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)));
});
ref.timeline.addEventListener("keydown", (event) => {
  if (event.key === "Home") seekShare(0);
  if (event.key === "End") seekShare(0.999);
});

// ---------------- bucle de render ----------------
let raf = 0;
let last = 0;
let dirtyFrame = true;
function frame(now) {
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
  last = now;
  const moving = director.tick(dt);
  engine.render();
  updateTimeline();
  const busy = moving || director.S.playing || director.S.stepTo !== null || director.S.camAnim || dirtyFrame;
  dirtyFrame = false;
  if (busy && !document.hidden) raf = requestAnimationFrame(frame);
  else {
    raf = 0;
    last = 0;
  }
}
wakeLoop = () => {
  dirtyFrame = true;
  if (!raf) raf = requestAnimationFrame(frame);
};
document.addEventListener("visibilitychange", () => !document.hidden && wakeLoop());
new ResizeObserver(() => {
  engine.measure();
  engine.setInset(insetFor());
  if (!director.S.manualCam) director.flyTo(director.cameraFor(director.beat), 0);
  wakeLoop();
}).observe(ref.stage);
function insetFor() {
  const narrow = engine.size.w < 760;
  if (!narrow) return { top: 70, bottom: 70, left: 0, right: 0 };
  const cap = ref.caption.getBoundingClientRect().height || 70;
  ref.stage.style.setProperty("--cap-h", `${Math.round(cap + 16)}px`);
  return { top: 92, bottom: Math.round(cap + 16 + engine.size.h * 0.3), left: 0, right: 0 };
}
engine.setInset(insetFor());

// ---------------- controles ----------------
ref.play.addEventListener("click", () => {
  if (director.S.playing) director.pause();
  else director.play();
  wakeLoop();
});
ref.next.addEventListener("click", () => {
  director.nextEvent();
  wakeLoop();
});
ref.prev.addEventListener("click", () => {
  director.prevEvent();
  wakeLoop();
});
ref.reset.addEventListener("click", () => {
  store.restore(JSON.parse(JSON.stringify(ctx.defaults)));
  director.S.history = [];
  director.S.manualCam = false;
  director.seek(0, 0, { forceEnter: true });
  director.flyTo(director.cameraFor(director.beat));
  wakeLoop();
});
ctx.defaults = JSON.parse(JSON.stringify(store.user));
ref.speedSel.addEventListener("change", () => {
  director.S.speed = Number(ref.speedSel.value);
  wakeLoop();
});
ref.chapterButtons.forEach((button, c) =>
  button.addEventListener("click", () => {
    director.seek(director.chapterStart(c), 0);
    if (director.S.mode === "tour") director.S.manualCam = false;
    director.flyTo(director.cameraFor(director.beat));
    wakeLoop();
  }),
);
const setMode = (mode) => {
  director.setMode(mode);
  ref.modeTour.setAttribute("aria-pressed", mode === "tour" ? "true" : "false");
  ref.modeFree.setAttribute("aria-pressed", mode === "free" ? "true" : "false");
  if (mode === "free") director.pause();
  wakeLoop();
};
ref.modeTour.addEventListener("click", () => setMode("tour"));
ref.modeFree.addEventListener("click", () => setMode("free"));
ref.backTour.addEventListener("click", () => {
  director.guidedCamera();
  wakeLoop();
});
const toggleInspector = (force) => {
  const open = force ?? ref.inspector.hasAttribute("hidden");
  ref.inspector.toggleAttribute("hidden", !open);
  ref.inspectorToggle.setAttribute("aria-pressed", open ? "true" : "false");
  requestAnimationFrame(() => {
    engine.measure();
    wakeLoop();
  });
};
ref.inspectorToggle.addEventListener("click", () => toggleInspector());
if (window.innerWidth < 1100) toggleInspector(false);
for (const [key, button] of Object.entries(ref.tabButtons))
  button.addEventListener("click", () => {
    for (const other of Object.values(ref.tabButtons)) other.setAttribute("aria-selected", other === button ? "true" : "false");
    ctx.tab = key;
    renderInspector(ctx, selection);
  });
ctx.tab = "obj";

// Escalas: ir a la escala elegida dentro del capítulo actual.
const SCALE_CHAPTER = { lab: 0, model: 1, tensor: 2 };
let scaleHistory = [];
for (const [key, button] of Object.entries(ref.scaleButtons))
  button.addEventListener("click", () => {
    if (ctx.currentScale === key) return;
    scaleHistory.push(director.S.beat);
    const target = ctx.scaleBeat ? ctx.scaleBeat(key) : director.chapterStart(SCALE_CHAPTER[key]);
    director.seek(target, 1);
    director.S.manualCam = false;
    director.flyTo(director.cameraFor(director.beat));
    wakeLoop();
  });
ref.backScale.addEventListener("click", () => goBack());
function goBack() {
  const index = scaleHistory.pop();
  if (index !== undefined) director.seek(index, 1);
  else if (ctx.currentScale === "tensor") director.seek(director.chapterStart(1), 1);
  else if (ctx.currentScale === "model") director.seek(director.chapterStart(0), 0);
  director.S.manualCam = false;
  director.flyTo(director.cameraFor(director.beat));
  wakeLoop();
}

// Cámara manual: arrastrar gira, Mayús/botón derecho/dos dedos desplaza, rueda o pellizco acerca.
const pointers = new Map();
let drag = null;
let pinch = null;
const manual = () => {
  director.stopCamera();
  director.S.manualCam = true;
};
ref.svg.addEventListener("contextmenu", (event) => event.preventDefault());
ref.svg.addEventListener("pointerdown", (event) => {
  ref.svg.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, [event.clientX, event.clientY]);
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinch = { dist: Math.hypot(a[0] - b[0], a[1] - b[1]), scale: engine.cam.scale, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], target: [...engine.cam.target] };
    drag = null;
    return;
  }
  drag = { x: event.clientX, y: event.clientY, az: engine.cam.azimuth, el: engine.cam.elevation, target: [...engine.cam.target], pan: event.shiftKey || event.button === 2, moved: false };
});
ref.svg.addEventListener("pointermove", (event) => {
  if (pointers.has(event.pointerId)) pointers.set(event.pointerId, [event.clientX, event.clientY]);
  if (pinch && pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
    manual();
    engine.setCamera({ scale: pinch.scale * (dist / pinch.dist) });
    wakeLoop();
    return;
  }
  if (!drag) return hover(event);
  const dx = event.clientX - drag.x;
  const dy = event.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < 4) return;
  drag.moved = true;
  ref.svg.classList.add("grabbing");
  manual();
  if (!drag.pan) engine.setFast(true);
  if (drag.pan) {
    const box = ref.stage.getBoundingClientRect();
    const a = engine.screenToWorld([drag.x - box.left, drag.y - box.top], drag.target[2]);
    const b = engine.screenToWorld([event.clientX - box.left, event.clientY - box.top], drag.target[2]);
    engine.setCamera({ target: [drag.target[0] - (b[0] - a[0]), drag.target[1] - (b[1] - a[1]), drag.target[2]] });
  } else engine.setCamera({ azimuth: drag.az - dx * 0.25, elevation: drag.el + dy * 0.15 });
  wakeLoop();
});
const endPointer = (event) => {
  pointers.delete(event.pointerId);
  engine.setFast(false);
  wakeLoop();
  if (pointers.size < 2) pinch = null;
  ref.svg.classList.remove("grabbing");
  if (drag && !drag.moved && event.type === "pointerup") click(event);
  drag = null;
};
ref.svg.addEventListener("pointerup", endPointer);
ref.svg.addEventListener("pointercancel", endPointer);
ref.svg.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    manual();
    const box = ref.stage.getBoundingClientRect();
    const p = [event.clientX - box.left, event.clientY - box.top];
    const before = engine.screenToWorld(p, engine.cam.target[2]);
    engine.setCamera({ scale: engine.cam.scale * Math.exp(-event.deltaY * 0.0015) });
    const after = engine.screenToWorld(p, engine.cam.target[2]);
    engine.setCamera({ target: [engine.cam.target[0] + before[0] - after[0], engine.cam.target[1] + before[1] - after[1], engine.cam.target[2]] });
    wakeLoop();
  },
  { passive: false },
);
const camStep = (fn) => () => {
  manual();
  fn();
  wakeLoop();
};
ref.rotL.addEventListener("click", camStep(() => engine.setCamera({ azimuth: engine.cam.azimuth - 15 })));
ref.rotR.addEventListener("click", camStep(() => engine.setCamera({ azimuth: engine.cam.azimuth + 15 })));
ref.zoomIn.addEventListener("click", camStep(() => engine.setCamera({ scale: engine.cam.scale * 1.25 })));
ref.zoomOut.addEventListener("click", camStep(() => engine.setCamera({ scale: engine.cam.scale / 1.25 })));
ref.camReset.addEventListener("click", () => {
  director.guidedCamera();
  wakeLoop();
});

// Selección e inspección: clic en un objeto o en una celda.
function hit(event) {
  // con captura de puntero, event.target es el SVG: se busca el elemento real bajo el puntero
  const under = document.elementFromPoint(event.clientX, event.clientY);
  const target = under && under.closest ? under : event.target.closest ? event.target : null;
  if (!target) return {};
  const cell = target.closest("[data-cell]");
  const obj = target.closest("[data-obj]");
  return { cell, obj, id: obj && obj.getAttribute("data-obj") };
}
function click(event) {
  const { cell, id } = hit(event);
  for (const node of ref.svg.querySelectorAll("[data-sel]")) node.removeAttribute("data-sel");
  if (!id) {
    selection = null;
    renderInspector(ctx, null);
    director.apply(); // restaura el foco del paso
    wakeLoop();
    return;
  }
  const entry = engine.objects.get(id);
  const target = entry.info || id;
  engine.objects.get(id).el.setAttribute("data-sel", "");
  // resaltar lo elegido y atenuar el resto (incluye su parte frontal o sus hijos)
  ctx.focus([id, `${id}-front`, ...(entry.parent ? [entry.parent] : [])]);
  if (cell && entry.cell) {
    const [i, j] = cell.getAttribute("data-cell").split(",").map(Number);
    selection = { id: target, cell: entry.cell(i, j), obj: id, i, j };
    if (entry.onCell) entry.onCell(i, j, ctx);
  } else selection = target;
  if (ref.inspector.hasAttribute("hidden") && window.innerWidth >= 760) toggleInspector(true);
  for (const other of Object.values(ref.tabButtons)) other.setAttribute("aria-selected", other === ref.tabButtons.obj ? "true" : "false");
  ctx.tab = "obj";
  renderInspector(ctx, selection);
  wakeLoop();
}
function hover(event) {
  const { cell, id } = hit(event);
  const entry = id && engine.objects.get(id);
  if (cell && entry && entry.cell) {
    const [i, j] = cell.getAttribute("data-cell").split(",").map(Number);
    const info = entry.cell(i, j);
    if (info) {
      ref.tip.innerHTML = `<div class="tt">${info.title}</div>${info.rows.map(([key, value]) => `<div><span class="k">${key}</span> ${value}</div>`).join("")}`;
      const box = ref.stage.getBoundingClientRect();
      const x = Math.min(box.width - 350, event.clientX - box.left + 14);
      ref.tip.style.left = `${Math.max(8, x)}px`;
      ref.tip.style.top = `${Math.max(8, event.clientY - box.top + 14)}px`;
      ref.tip.classList.add("on");
      return;
    }
  }
  ref.tip.classList.remove("on");
}
ref.svg.addEventListener("pointerleave", () => ref.tip.classList.remove("on"));
ctx.inspectFromList = (id) => {
  selection = id;
  renderInspector(ctx, id);
};

// Teclado
const HELP = [
  ["Espacio", "reproducir / pausar"],
  ["→ / ←", "avanzar un evento / retroceder al estado guardado anterior"],
  ["[ / ]", "capítulo anterior / siguiente"],
  ["Q / E", "girar la cámara"],
  ["W / S", "inclinar la cámara"],
  ["+ / −", "acercar / alejar"],
  ["R", "restablecer la cámara guiada"],
  ["I", "mostrar u ocultar el inspector"],
  ["M", "alternar recorrido / exploración"],
  ["Esc", "volver a la escala anterior"],
  ["Mayús + arrastrar", "desplazar la cámara"],
];
ref.help.addEventListener("click", () => {
  selection = { help: HELP };
  toggleInspector(true);
  renderInspector(ctx, selection);
});
window.addEventListener("keydown", (event) => {
  if (event.target.closest && event.target.closest("input, select, textarea")) return;
  const key = event.key;
  const act = (fn) => {
    event.preventDefault();
    fn();
    wakeLoop();
  };
  if (key === " ") act(() => (director.S.playing ? director.pause() : director.play()));
  else if (key === "ArrowRight") act(() => director.nextEvent());
  else if (key === "ArrowLeft") act(() => director.prevEvent());
  else if (key === "]") act(() => director.seek(director.chapterStart(Math.min(9, director.beat.c + 1)), 0));
  else if (key === "[") act(() => director.seek(director.chapterStart(Math.max(0, director.beat.c - (director.S.t > 0 || director.beat.b > 0 ? 0 : 1))), 0));
  else if (key === "q" || key === "Q") act(() => (manual(), engine.setCamera({ azimuth: engine.cam.azimuth - 10 })));
  else if (key === "e" || key === "E") act(() => (manual(), engine.setCamera({ azimuth: engine.cam.azimuth + 10 })));
  else if (key === "w" || key === "W") act(() => (manual(), engine.setCamera({ elevation: engine.cam.elevation + 4 })));
  else if (key === "s" || key === "S") act(() => (manual(), engine.setCamera({ elevation: engine.cam.elevation - 4 })));
  else if (key === "+" || key === "=") act(() => (manual(), engine.setCamera({ scale: engine.cam.scale * 1.2 })));
  else if (key === "-" || key === "_") act(() => (manual(), engine.setCamera({ scale: engine.cam.scale / 1.2 })));
  else if (key === "r" || key === "R") act(() => director.guidedCamera());
  else if (key === "i" || key === "I") act(() => toggleInspector());
  else if (key === "m" || key === "M") act(() => setMode(director.S.mode === "tour" ? "free" : "tour"));
  else if (key === "Escape") act(() => goBack());
  else if (key === "0") act(() => ref.reset.click());
});

// Automatización y QA
window.__sceneQA = {
  get state() {
    return { beat: director.beat.id, chapter: director.beat.c + 1, t: director.S.t, event: director.eventOf(director.beat, director.S.t), playing: director.S.playing, mode: director.S.mode, camera: { ...engine.cam }, changed: changedNow, user: JSON.parse(JSON.stringify(store.user)) };
  },
  seek: (chapter, beat = 0, t = 0) => {
    director.seek(director.chapterStart(chapter - 1) + beat, t);
    director.flyTo(director.cameraFor(director.beat), 0);
    wakeLoop();
  },
  beats: () => director.beats.map((b) => b.id),
  total: () => director.total,
  store,
  engine,
  director,
  ctx,
};

director.seek(0, 0);
director.flyTo(director.cameraFor(director.beat), 0);
wakeLoop();
