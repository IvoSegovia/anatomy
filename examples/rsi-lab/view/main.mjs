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
import { makeBus } from "./bus.mjs";
import { makeSound, renderOffline, SOUND_OPS } from "./sound.mjs";
import { makeLesson, plainOf, wordsOf } from "./lesson.mjs";
import { SCRIPTS } from "./guide/index.mjs";
import { CONCEPTS } from "./guide/concepts.mjs";

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

const beatScoped = { labels: new Set(), panels: new Map() };
let changedNow = {};
let selection = null;
let wakeLoop = () => {};

function syncDisclaimer() {
  let offset = 0;
  for (const node of beatScoped.panels.values()) {
    const d = node._dock;
    if (d && d.dock === "right" && d.top < 210) offset = Math.max(offset, d.right + d.width + 14);
  }
  ref.disclaimer.style.right = offset ? `${offset}px` : "";
}

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
    if (set) for (const id of [...set]) {
      let parent = engine.objects.get(id)?.parent;
      while (parent) {
        set.add(parent);
        set.add(`${parent}-front`);
        parent = engine.objects.get(parent)?.parent;
      }
    }
    ref.svg.toggleAttribute("data-focus", !!set);
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
    style.top = `calc(${top ?? 78}px + var(--chips-extra, 0px))`;
    style.maxHeight = dock === "left" ? `calc(100% - ${top ?? 78}px - var(--chips-extra, 0px) - var(--desk-h, 0px) - 40px)` : `calc(100% - ${top ?? 78}px - var(--chips-extra, 0px) - 104px)`;
    style.left = dock === "left" ? `${left ?? 12}px` : "";
    style.right = dock === "right" ? `${right ?? 12}px` : "";
    if (dock === "center") {
      style.left = "50%";
      style.transform = "translateX(-50%)";
    } else style.transform = "";
    node._dock = { dock, top: top ?? 78, right: right ?? 12, width: width ?? 420 };
    syncDisclaimer();
    return node;
  },
  closePanel(id) {
    const node = beatScoped.panels.get(id);
    if (node) node.remove();
    beatScoped.panels.delete(id);
    syncDisclaimer();
  },
  clearBeat() {
    for (const id of beatScoped.labels) engine.unlabel(id);
    beatScoped.labels.clear();
    for (const node of beatScoped.panels.values()) node.remove();
    beatScoped.panels.clear();
    syncDisclaimer();
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
    if (lesson) lesson.render();
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
  follow(spec) {
    if (director.S.mode !== "tour" || director.S.manualCam) return;
    director.flyTo(director.cameraFor({ camera: spec }), 1.1);
  },
};

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
      app.classList.toggle("show-theta", !!chapter.showTheta);
      if (chapter.desk) chapter.desk(ctx);
    },
    beat(beat) {
      ctx.scale(beat.scale || "lab");
      const changed = typeof beat.changed === "function" ? beat.changed(ctx) : beat.changed;
      ctx.changed(changed || {});
      if (!selection && ctx.tab !== "guide") renderInspector(ctx, null);
    },
    applied(beat) {
      if (typeof beat.changed === "function") ctx.changed(beat.changed(ctx));
      if (lesson) lesson.applyLook();
    },
  },
});
ctx.director = director;
ctx.theta(store.print0, "sin cambios");
const bus = makeBus();
const sound = makeSound();
ctx.tab = "guide";
var lesson = makeLesson({ director, ctx, ref, bus, sound, scripts: SCRIPTS, concepts: CONCEPTS });
ctx.lesson = lesson;
let chipTimer = null;
bus.on((event) => {
  sound.play(event.op, { delay: event.delay || 0, id: event.id });
  ref.opChip.innerHTML = `<span data-op="${event.op}">♪ ${event.label}</span>`;
  ref.opChip.classList.add("on");
  clearTimeout(chipTimer);
  chipTimer = setTimeout(() => ref.opChip.classList.remove("on"), 1400);
  for (const id of event.targets || []) {
    const entry = engine.objects.get(id);
    if (!entry) continue;
    entry.el.classList.remove("flash");
    void entry.el.getBoundingClientRect();
    entry.el.classList.add("flash");
    setTimeout(() => entry.el.classList.remove("flash"), 700 + (event.delay || 0) * 1000);
  }
});
let spotTimer = null;
ctx.spotlight = (ids, label) => {
  const present = ids.filter((id) => engine.objects.get(id) && engine.objects.get(id).pose.visible !== false);
  if (!present.length) {
    ctx.say("Ese objeto no está visible en este paso.");
    ref.opChip.innerHTML = `<span>Ese objeto no está visible en este paso</span>`;
    ref.opChip.classList.add("on");
    clearTimeout(chipTimer);
    chipTimer = setTimeout(() => ref.opChip.classList.remove("on"), 1600);
    return;
  }
  ctx.focus(present);
  engine.unlabel("spotlight");
  engine.label("spotlight", { obj: present[0], dz: 8, cls: "tag spot", html: `<span>◂ ${label || present[0]}</span>` });
  clearTimeout(spotTimer);
  spotTimer = setTimeout(() => {
    engine.unlabel("spotlight");
    lesson.applyLook();
    wakeLoop();
  }, 2600);
  wakeLoop();
};
const refreshSound = () => {
  ref.soundBtn.setAttribute("aria-pressed", sound.enabled ? "true" : "false");
  ref.soundBtn.textContent = sound.enabled ? (sound.prefs.muted ? "Sonido en silencio" : "Sonidos activos") : sound.prefs.wanted ? "Activar sonidos (recordado)" : "Activar sonidos";
};
sound.onChange(refreshSound);
refreshSound();
ref.soundBtn.addEventListener("click", async () => {
  if (sound.enabled) sound.disable();
  else await sound.enable();
  refreshSound();
  if (ctx.tab === "guide") lesson.render();
});

function buildTimeline() {
  ref.timeline.innerHTML = '<div class="track"></div><div class="fill"></div>';
  const total = lesson.total;
  let lastC = -1;
  lesson.steps.forEach((step, i) => {
    const x = (lesson.starts[i] / total) * 100;
    if (step.beat.c !== lastC) {
      ref.timeline.append(el("div", { class: "tick", style: `left:${x}%` }));
      ref.timeline.append(el("div", { class: "num", style: `left:${x}%` }, String(step.beat.c + 1)));
      lastC = step.beat.c;
    } else ref.timeline.append(el("div", { class: "ev", style: `left:${x}%` }));
  });
  ref.head = el("div", { class: "head" });
  ref.timeline.append(ref.head);
}
buildTimeline();
const mmss = (s) => (s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}` : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`);
function updateTimeline() {
  const share = lesson.position() / lesson.total;
  ref.timeline.querySelector(".fill").style.width = `${share * 100}%`;
  ref.head.style.left = `${share * 100}%`;
  const step = lesson.step;
  ref.clock.textContent = `${mmss(lesson.position())} / ${mmss(lesson.total)} estimado`;
  ref.clock.title = `Tiempo estimado de la lección: lectura a ${lesson.L.wpm} palabras por minuto más 2,5 s por bloque (mínimo 6 s), más el tiempo de cada animación. Paso ${step.index + 1} de ${lesson.steps.length}.`;
  ref.timeline.setAttribute("aria-valuenow", String(Math.round(share * 100)));
  ref.timeline.setAttribute("aria-valuetext", `Capítulo ${step.beat.c + 1}, paso ${step.id}, ${step.index + 1} de ${lesson.steps.length}`);
  ref.backTour.classList.toggle("on", director.S.manualCam);
}
function seekShare(share) {
  lesson.seekShare(share);
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

let raf = 0;
let last = 0;
let dirtyFrame = true;
function frame(now) {
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
  last = now;
  const moving = director.tick(dt);
  lesson.frame();
  engine.render();
  updateTimeline();
  const busy = moving || director.S.playing || director.S.stepTo !== null || director.S.camAnim || dirtyFrame || (lesson.L.phase === "act" && !lesson.L.frozen) || lesson.L.entering;
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
document.addEventListener("visibilitychange", () => {
  if (document.hidden) lesson.pause("pestaña oculta");
  else wakeLoop();
});
new ResizeObserver(() => {
  engine.measure();
  engine.setInset(insetFor());
  if (!director.S.manualCam) director.flyTo(director.cameraFor(director.beat), 0);
  wakeLoop();
}).observe(ref.stage);
new ResizeObserver(() => {
  const on = ref.desk.classList.contains("on") && getComputedStyle(ref.desk).position === "absolute";
  ref.stage.style.setProperty("--desk-h", `${on ? Math.round(ref.desk.getBoundingClientRect().height) : 0}px`);
}).observe(ref.desk);
new ResizeObserver(() => {
  const h = Math.round(ref.changed.getBoundingClientRect().height);
  if (!h) return;
  ref.stage.style.setProperty("--chips-h", `${h}px`);
  ref.stage.style.setProperty("--chips-extra", `${Math.max(0, h - 26)}px`);
}).observe(ref.changed);
function insetFor() {
  const narrow = engine.size.w < 760;
  if (!narrow) return { top: 70, bottom: 70, left: 0, right: 0 };
  const cap = ref.caption.getBoundingClientRect().height || 70;
  ref.stage.style.setProperty("--cap-h", `${Math.round(cap + 16)}px`);
  return { top: 92, bottom: Math.round(cap + 16 + engine.size.h * 0.3), left: 0, right: 0 };
}
engine.setInset(insetFor());

ref.play.addEventListener("click", () => {
  if (lesson.L.auto) lesson.pause();
  else lesson.play();
  wakeLoop();
});
ref.next.addEventListener("click", () => {
  lesson.next();
  wakeLoop();
});
ref.prev.addEventListener("click", () => {
  lesson.prev();
  wakeLoop();
});
ref.learnPrimary.addEventListener("click", () => {
  lesson.next();
  wakeLoop();
});
ref.learnRepeat.addEventListener("click", () => {
  lesson.repeat();
  wakeLoop();
});
ref.reset.addEventListener("click", () => {
  lesson.pause();
  store.restore(JSON.parse(JSON.stringify(ctx.defaults)));
  lesson.L.stack = [];
  lesson.L.trail = [];
  director.S.history = [];
  director.S.manualCam = false;
  director.S.activeBeat = -1;
  lesson.enter(0);
  director.flyTo(director.cameraFor(director.beat));
  wakeLoop();
});
ctx.defaults = JSON.parse(JSON.stringify(store.user));
ref.speedSel.addEventListener("change", () => {
  director.S.speed = Number(ref.speedSel.value);
  wakeLoop();
});
ref.wpmSel.addEventListener("change", () => {
  lesson.setWpm(Number(ref.wpmSel.value));
  buildTimeline();
  wakeLoop();
});
ref.chapterButtons.forEach((button, c) =>
  button.addEventListener("click", () => {
    lesson.goToChapter(c);
    director.flyTo(director.cameraFor(director.beat));
    wakeLoop();
  }),
);
const setMode = (mode) => {
  director.setMode(mode);
  ref.modeTour.setAttribute("aria-pressed", mode === "tour" ? "true" : "false");
  ref.modeFree.setAttribute("aria-pressed", mode === "free" ? "true" : "false");
  app.classList.toggle("explore", mode === "free");
  if (mode === "free") lesson.pause("explorar");
  wakeLoop();
};
const setNarrator = (on) => {
  lesson.setNarrator(on);
  app.classList.toggle("no-narrator", !on);
  ref.narratorBtn.setAttribute("aria-pressed", on ? "true" : "false");
  if (!on && ctx.tab === "guide" && !ref.inspector.hasAttribute("hidden")) {
    ref.inspector.dataset.closedByNarrator = "1";
    toggleInspector(false);
  } else if (on && ref.inspector.dataset.closedByNarrator) {
    delete ref.inspector.dataset.closedByNarrator;
    toggleInspector(true);
  }
  wakeLoop();
};
ref.narratorBtn.addEventListener("click", () => setNarrator(!lesson.L.narrator));
ref.modeTour.addEventListener("click", () => setMode("tour"));
ref.modeFree.addEventListener("click", () => setMode("free"));
ref.backTour.addEventListener("click", () => {
  director.guidedCamera();
  selectTab("guide");
  lesson.applyLook();
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
function selectTab(key) {
  for (const [name, other] of Object.entries(ref.tabButtons)) other.setAttribute("aria-selected", name === key ? "true" : "false");
  ctx.tab = key;
  renderInspector(ctx, selection);
}
for (const [key, button] of Object.entries(ref.tabButtons)) button.addEventListener("click", () => selectTab(key));
ref.inspBody.addEventListener("click", (event) => {
  if (ctx.tab === "guide") {
    lesson.handleClick(event);
    wakeLoop();
  }
});
ref.inspBody.addEventListener("input", (event) => ctx.tab === "guide" && lesson.handleInput(event));
ref.inspBody.addEventListener("pointerover", (event) => ctx.tab === "guide" && lesson.handleHover(event));
ref.inspBody.addEventListener("pointerout", (event) => ctx.tab === "guide" && lesson.handleLeave(event));
ref.desk.addEventListener("input", () => lesson.interrupt("parámetro"), true);
ref.desk.addEventListener("change", () => lesson.interrupt("parámetro"), true);

const SCALE_CHAPTER = { lab: 0, model: 1, tensor: 2 };
let scaleHistory = [];
for (const [key, button] of Object.entries(ref.scaleButtons))
  button.addEventListener("click", () => {
    if (ctx.currentScale === key) return;
    scaleHistory.push(lesson.L.i);
    lesson.goToChapter(SCALE_CHAPTER[key]);
    director.S.manualCam = false;
    director.flyTo(director.cameraFor(director.beat));
    wakeLoop();
  });
ref.backScale.addEventListener("click", () => goBack());
function goBack() {
  const index = scaleHistory.pop();
  if (index !== undefined) lesson.enter(index);
  else if (ctx.currentScale === "tensor") lesson.goToChapter(1);
  else if (ctx.currentScale === "model") lesson.goToChapter(0);
  director.S.manualCam = false;
  director.flyTo(director.cameraFor(director.beat));
  wakeLoop();
}

const pointers = new Map();
let drag = null;
let pinch = null;
const manual = () => {
  director.stopCamera();
  director.S.manualCam = true;
  lesson.interrupt("cámara");
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
  lesson.applyLook();
  wakeLoop();
});

function hit(event) {
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
    if (ctx.tab !== "guide") renderInspector(ctx, null);
    director.apply();
    wakeLoop();
    return;
  }
  const entry = engine.objects.get(id);
  const target = entry.info || id;
  engine.objects.get(id).el.setAttribute("data-sel", "");
  ctx.focus([id, `${id}-front`, ...(entry.parent ? [entry.parent] : [])]);
  if (cell && entry.cell) {
    const [i, j] = cell.getAttribute("data-cell").split(",").map(Number);
    selection = { id: target, cell: entry.cell(i, j), obj: id, i, j };
    if (entry.onCell) entry.onCell(i, j, ctx);
  } else selection = target;
  lesson.interrupt("inspección");
  if (ref.inspector.hasAttribute("hidden")) toggleInspector(true);
  selectTab("obj");
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

const HELP = [
  ["Intro", "acción principal: «Ver la operación» o «Continuar»"],
  ["→ / ←", "avanzar a la fase siguiente / volver a la anterior, con sus parámetros"],
  ["R", "repetir esta operación"],
  ["Espacio", "reproducción automática / pausa"],
  ["N", "mostrar u ocultar el narrador escrito"],
  ["X", "silenciar o reactivar los sonidos al instante"],
  ["[ / ]", "capítulo anterior / siguiente"],
  ["Q / E", "girar la cámara (acimut entre 0° y 90°)"],
  ["W / S", "inclinar la cámara (elevación entre 18° y 62°)"],
  ["+ / −", "acercar / alejar"],
  ["C", "volver a la cámara guiada"],
  ["I", "mostrar u ocultar el panel lateral"],
  ["M", "alternar Aprender / Explorar"],
  ["Esc", "volver a la escala anterior"],
  ["0", "reiniciar"],
  ["Mayús + arrastrar", "desplazar la cámara"],
];
ref.help.addEventListener("click", () => {
  selection = { help: HELP };
  toggleInspector(true);
  selectTab("obj");
});
window.addEventListener("keydown", (event) => {
  if (event.target.closest && event.target.closest("input, select, textarea")) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const key = event.key;
  const act = (fn) => {
    event.preventDefault();
    fn();
    wakeLoop();
  };
  if (key === "Enter") {
    if (event.target.closest && event.target.closest("button, a, [role=slider]")) return;
    act(() => lesson.next());
  } else if (key === " ") act(() => (lesson.L.auto ? lesson.pause() : lesson.play()));
  else if (key === "ArrowRight") act(() => lesson.next());
  else if (key === "ArrowLeft") act(() => lesson.prev());
  else if (key === "r" || key === "R") act(() => lesson.repeat());
  else if (key === "n" || key === "N") act(() => setNarrator(!lesson.L.narrator));
  else if (key === "x" || key === "X") act(() => sound.setMuted(!sound.prefs.muted));
  else if (key === "]") act(() => lesson.goToChapter(Math.min(9, lesson.step.beat.c + 1)));
  else if (key === "[") act(() => lesson.goToChapter(Math.max(0, lesson.step.beat.c - (lesson.step.index > lesson.steps.findIndex((s) => s.beat.c === lesson.step.beat.c) ? 0 : 1))));
  else if (key === "q" || key === "Q") act(() => (manual(), engine.setCamera({ azimuth: engine.cam.azimuth - 10 })));
  else if (key === "e" || key === "E") act(() => (manual(), engine.setCamera({ azimuth: engine.cam.azimuth + 10 })));
  else if (key === "w" || key === "W") act(() => (manual(), engine.setCamera({ elevation: engine.cam.elevation + 4 })));
  else if (key === "s" || key === "S") act(() => (manual(), engine.setCamera({ elevation: engine.cam.elevation - 4 })));
  else if (key === "+" || key === "=") act(() => (manual(), engine.setCamera({ scale: engine.cam.scale * 1.2 })));
  else if (key === "-" || key === "_") act(() => (manual(), engine.setCamera({ scale: engine.cam.scale / 1.2 })));
  else if (key === "c" || key === "C") act(() => (director.guidedCamera(), lesson.applyLook()));
  else if (key === "i" || key === "I") act(() => toggleInspector());
  else if (key === "m" || key === "M") act(() => setMode(director.S.mode === "tour" ? "free" : "tour"));
  else if (key === "Escape") act(() => goBack());
  else if (key === "0") act(() => ref.reset.click());
  else if (key === "?" || key === "h" || key === "H") act(() => ref.help.click());
});

window.__sceneQA = {
  get state() {
    return { beat: director.beat.id, chapter: director.beat.c + 1, t: director.S.t, event: director.eventOf(director.beat, director.S.t), playing: lesson.L.auto, mode: director.S.mode, camera: { ...engine.cam }, changed: changedNow, user: JSON.parse(JSON.stringify(store.user)), step: lesson.step.id, stepIndex: lesson.L.i, phase: lesson.L.phase, narrator: lesson.L.narrator, tab: ctx.tab };
  },
  seek: (chapter, beat = 0, t = 0) => {
    director.seek(director.chapterStart(chapter - 1) + beat, t);
    director.flyTo(director.cameraFor(director.beat), 0);
    wakeLoop();
  },
  go(index, phase = "orient") {
    director.S.manualCam = false;
    lesson.enter(index, phase);
    director.flyTo(director.cameraFor(director.beat), 0);
    if (director.S.stepTo !== null) director.animateTo(director.S.stepTo, 0);
    wakeLoop();
  },
  steps: () => lesson.steps.map((s) => {
    const orient = lesson.textOf(s.orient);
    const act = lesson.textOf(s.act);
    const result = lesson.textOf(s.result);
    const refs = [...`${orient} ${act} ${result}`.matchAll(/\{\{([^|}]+)\|/g)].flatMap((m) => m[1].split(","));
    const terms = [...`${orient} ${act} ${result}`.matchAll(/\[\[([^|\]]+)\|/g)].map((m) => m[1]);
    return { id: s.id, beat: s.beat.id, from: s.from, to: s.to, missing: !!s.missing, words: { orient: wordsOf(orient), act: wordsOf(act), result: wordsOf(result) }, refs, terms, concept: s.concept || null, cues: (typeof s.cues === "function" ? s.cues(ctx) : s.cues || []).map((c) => c.op), look: Array.isArray(s.look) ? s.look : null };
  }),
  objectIds: () => [...engine.objects.keys()],
  concepts: () => Object.keys(CONCEPTS),
  missing: () => lesson.missing,
  total: () => lesson.total,
  beats: () => director.beats.map((b) => b.id),
  events: bus.log,
  sound,
  soundOps: SOUND_OPS.map((o) => o.op),
  renderOffline,
  lesson,
  store,
  engine,
  director,
  ctx,
};

lesson.enter(0);
director.flyTo(director.cameraFor(director.beat), 0);
wakeLoop();
