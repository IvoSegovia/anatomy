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
import { renderInspector, infoFor } from "./inspector.mjs";
import { nameOf } from "./names.mjs";
import { prov, esc } from "./helpers.mjs";
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

const windows = { closed: new Set(), auto: !matchMedia("(max-width: 760px)").matches };
const syncDisclaimer = () => {};

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
      node.classList.toggle("min", windows.closed.has(id) || !windows.auto);
    }
    const head = `<h4><button class="pl-toggle" data-pl="${id}" title="Mostrar u ocultar esta ventana (V: todas)"><span class="pl-arrow" aria-hidden="true">▾</span><span>${title || "Datos"}</span></button>${provKind ? prov(provKind, provText) : ""}<button class="x" data-pl="${id}" aria-label="Cerrar la ventana «${String(title || "Datos").replace(/<[^>]+>/g, "")}»">×</button></h4>`;
    const content = head + `<div class="pl-body">${html}</div>`;
    if (node._html !== content) {
      node.innerHTML = content;
      node._html = content;
    }
    const style = node.style;
    const y = Math.max(12, (top ?? 78) - 64);
    style.width = width ? `${width}px` : "";
    style.top = `${y}px`;
    style.maxHeight = dock === "left" ? `calc(100% - ${y}px - var(--desk-h, 40px) - 24px)` : `calc(100% - ${y}px - 64px)`;
    style.left = dock === "left" ? (left !== undefined ? `${left}px` : "calc(var(--rail-w, 140px) + 20px)") : "";
    style.right = dock === "right" ? `${right ?? 12}px` : "";
    if (dock === "center") {
      style.left = "50%";
      style.transform = "translateX(-50%)";
    } else style.transform = "";
    node._dock = { dock, top: y, right: right ?? 12, width: width ?? 420 };
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
    if (ctx.unpick) ctx.unpick();
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
    ref.theta.innerHTML = `<span class="h">θ · 2048 parámetros</span><span class="print${flash ? " flash" : ""}" title="Huella FNV-1a de todos los parámetros del modelo: cambia si cambia un solo bit. ${note}">${print}</span><span class="note">${note}</span>`;
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
    ref.desk.classList.toggle("min", ref.desk.dataset.open !== "1");
    const open = !ref.desk.classList.contains("min");
    const toggle = el("button", { class: "pl-toggle", "aria-expanded": open ? "true" : "false", title: "Mostrar u ocultar los controles de esta escena" }, el("span", { class: "pl-arrow", "aria-hidden": "true" }, open ? "▾" : "▸"), el("span", {}, `Mesa de control · ${title}`));
    const close = el("button", { class: "x", "aria-label": "Cerrar la mesa de control" }, "×");
    const flip = (next) => {
      ref.desk.dataset.open = next ? "1" : "";
      ref.desk.classList.toggle("min", !next);
      toggle.setAttribute("aria-expanded", next ? "true" : "false");
      toggle.firstChild.textContent = next ? "▾" : "▸";
    };
    toggle.addEventListener("click", () => flip(ref.desk.classList.contains("min")));
    close.addEventListener("click", () => flip(false));
    ref.desk.append(el("h3", {}, toggle, close));
    const body = el("div", { class: "desk-body" });
    ref.desk.append(body);
    build(body);
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
    ref.backScale.hidden = name === "lab";
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
      ref.chapterBtn.innerHTML = `<span class="n">${c + 1}</span><span class="t">${esc(chapter.title)}</span><span class="caret" aria-hidden="true">▾</span>`;
      ref.chapterBtn.setAttribute("aria-label", `Capítulo ${c + 1} de ${CHAPTERS.length}: ${chapter.title}. Elegir capítulo`);
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
sound.onChange(() => ctx.tab === "settings" && renderSettings());

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
  const bar = ref.inspBody.querySelector(".g-wait i");
  if (bar) bar.style.width = `${(lesson.waitShare() * 100).toFixed(1)}%`;
}
setInterval(() => {
  if (lesson.L.auto && lesson.L.timer && !document.hidden) updateTimeline();
}, 200);
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
  const w = Math.round(ref.rail.getBoundingClientRect().width);
  if (w) ref.stage.style.setProperty("--rail-w", `${w}px`);
}).observe(ref.rail);
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
function resetLesson() {
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
}
ctx.defaults = JSON.parse(JSON.stringify(store.user));
const openChapters = (open) => {
  ref.chapterList.hidden = !open;
  ref.chapterBtn.setAttribute("aria-expanded", open ? "true" : "false");
  if (open) (ref.chapterList.querySelector('[aria-current="true"]') || ref.chapterButtons[0]).focus();
};
ref.chapterBtn.addEventListener("click", () => openChapters(ref.chapterList.hidden));
document.addEventListener("pointerdown", (event) => {
  if (!ref.chapterList.hidden && !ref.chapterMenu.contains(event.target)) openChapters(false);
});
ref.chapterButtons.forEach((button, c) =>
  button.addEventListener("click", () => {
    openChapters(false);
    lesson.goToChapter(c);
    director.flyTo(director.cameraFor(director.beat));
    wakeLoop();
  }),
);
const setMode = (mode) => {
  director.setMode(mode);
  app.classList.toggle("explore", mode === "free");
  if (mode === "free") lesson.pause("explorar");
  if (ctx.tab === "settings") renderSettings();
  wakeLoop();
};
const setWindows = (open) => {
  windows.auto = open;
  if (open) windows.closed.clear();
  for (const [id, node] of beatScoped.panels) {
    node.classList.toggle("min", !open);
    if (!open) windows.closed.add(id);
  }
  if (ctx.tab === "settings") renderSettings();
};
ref.planes.addEventListener("click", (event) => {
  const button = event.target.closest("[data-pl]");
  if (!button) return;
  const id = button.getAttribute("data-pl");
  const node = beatScoped.panels.get(id);
  if (!node) return;
  const close = button.classList.contains("x") ? true : !node.classList.contains("min");
  node.classList.toggle("min", close);
  if (close) windows.closed.add(id);
  else windows.closed.delete(id);
});
ref.backTour.addEventListener("click", () => {
  director.guidedCamera();
  if (director.S.mode === "free") setMode("tour");
  lesson.applyLook();
  wakeLoop();
});
const toggleInspector = (force) => {
  const open = force ?? ref.inspector.hasAttribute("hidden");
  ref.inspector.toggleAttribute("hidden", !open);
  ref.inspectorToggle.setAttribute("aria-pressed", open ? "true" : "false");
  app.classList.toggle("no-narrator", !open);
  lesson.setNarrator(open);
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
const HELP = [
  ["Espacio", "reproducción automática / pausa"],
  ["→ o Intro", "siguiente: «Ver la operación» o «Continuar»"],
  ["←", "volver a la fase anterior, con sus parámetros"],
  ["R", "repetir esta operación"],
  ["N o I", "mostrar u ocultar el panel con la explicación"],
  ["V", "mostrar u ocultar las ventanas de datos"],
  ["X", "silenciar o reactivar los sonidos"],
  ["[ / ]", "capítulo anterior / siguiente"],
  ["+ / −", "acercar / alejar"],
  ["Q / E, W / S", "girar / inclinar la cámara"],
  ["C", "volver a la cámara guiada"],
  ["M", "alternar Aprender / Explorar"],
  ["Esc", "cerrar el rótulo o volver a la escala anterior"],
  ["0", "reiniciar"],
];
function renderSettings() {
  const speed = director.S.speed;
  ref.inspBody.innerHTML = `<div class="settings">
    <h2>Ajustes</h2>
    <h3>Sonido</h3>${lesson.soundsHtml()}
    <h3>Reproducción</h3>
    <div class="set-row"><label class="set-inline">animación <select data-set="speed" aria-label="Velocidad de la animación">${[0.5, 0.75, 1, 1.5, 2].map((v) => `<option value="${v}" ${v === speed ? "selected" : ""}>${v}×</option>`).join("")}</select></label>
    <label class="set-inline">lectura <select data-set="wpm" aria-label="Ritmo de lectura de la reproducción automática">${[110, 140, 170].map((v) => `<option value="${v}" ${v === lesson.L.wpm ? "selected" : ""}>${v} palabras/min</option>`).join("")}</select></label></div>
    <p class="kv">La velocidad sólo cambia el ritmo de los movimientos; no cambia ningún cálculo. Con el panel oculto, la reproducción automática no espera el tiempo de lectura.</p>
    <h3>Escena</h3>
    <label class="set-check"><input type="checkbox" data-set="windows" ${windows.auto ? "checked" : ""}> Abrir las ventanas de datos (fórmulas, registros, tablas) al llegar a cada paso</label>
    <label class="set-check"><input type="checkbox" data-set="explore" ${director.S.mode === "free" ? "checked" : ""}> Explorar libremente: cámara libre, sin seguir la explicación (M)</label>
    <div class="set-row"><button class="btn" data-set="reset">Reiniciar la lección (0)</button></div>
    <h3>Ratón y táctil</h3>
    <p>Arrastrar: mover la vista. Rueda o pellizco: acercar o alejar. Botón derecho o Mayús + arrastrar: girar. Clic en un objeto o una celda: su nombre y qué hace, encima de él.</p>
    <h3>Teclado</h3><dl class="io">${HELP.map(([a, b]) => `<dt class="kv">${esc(a)}</dt><dd>${esc(b)}</dd>`).join("")}</dl>
  </div>`;
}
ctx.renderSettings = renderSettings;
function settingsAction(event) {
  const target = event.target;
  const set = target.getAttribute && target.getAttribute("data-set");
  if (event.type === "click") {
    const button = target.closest("[data-act],[data-set]");
    if (!button) return;
    const act = button.getAttribute("data-act");
    if (act === "sound-toggle") (sound.enabled ? Promise.resolve(sound.disable()) : sound.enable()).then(renderSettings);
    else if (act === "listen") sound.preview(button.getAttribute("data-op"));
    else if (button.getAttribute("data-set") === "reset") resetLesson();
    return;
  }
  if (target.getAttribute("data-act")) return lesson.handleInput(event);
  if (set === "speed") director.S.speed = Number(target.value);
  else if (set === "wpm") {
    lesson.setWpm(Number(target.value));
    buildTimeline();
  } else if (set === "windows") setWindows(target.checked);
  else if (set === "explore") setMode(target.checked ? "free" : "tour");
  wakeLoop();
}
ref.inspBody.addEventListener("click", (event) => {
  if (ctx.tab === "guide") {
    lesson.handleClick(event);
    wakeLoop();
  } else if (ctx.tab === "settings") settingsAction(event);
});
ref.inspBody.addEventListener("change", (event) => ctx.tab === "settings" && settingsAction(event));
ref.inspBody.addEventListener("input", (event) => {
  if (ctx.tab === "guide") lesson.handleInput(event);
  else if (ctx.tab === "settings" && event.target.getAttribute("data-act") === "volume") lesson.handleInput(event);
});
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

let awakeTimer = null;
const wakeControls = () => {
  ref.stage.classList.add("awake");
  clearTimeout(awakeTimer);
  awakeTimer = setTimeout(() => ref.stage.classList.remove("awake"), 2500);
};
ref.stage.addEventListener("pointermove", wakeControls);
ref.stage.addEventListener("pointerdown", wakeControls);
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
  drag = { x: event.clientX, y: event.clientY, az: engine.cam.azimuth, el: engine.cam.elevation, target: [...engine.cam.target], pan: !(event.shiftKey || event.button === 2), moved: false };
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
const firstSentence = (html) => {
  const text = String(html || "").replace(/<[^>]+>/g, "").trim();
  const cut = text.search(/[.:;](\s|$)/);
  const sentence = cut > 20 ? text.slice(0, cut + 1) : text;
  return sentence.length > 150 ? `${sentence.slice(0, 147)}…` : sentence;
};
function unpick() {
  engine.unlabel("pick");
  ref.tip.classList.remove("pinned", "on");
  for (const node of ref.svg.querySelectorAll("[data-sel]")) node.removeAttribute("data-sel");
}
ctx.unpick = unpick;
function pickCard(title, text, { more = false } = {}) {
  return `<span class="pick-card"><button class="x" data-pick="close" aria-label="Cerrar">×</button><b>${title}</b>${text ? `<em>${text}</em>` : ""}${more ? '<button class="link" data-pick="more">Detalles en el panel ›</button>' : ""}</span>`;
}
ref.labels.addEventListener("click", (event) => {
  const button = event.target.closest("[data-pick]");
  if (!button) return;
  if (button.getAttribute("data-pick") === "more") {
    if (ref.inspector.hasAttribute("hidden")) toggleInspector(true);
    selectTab("obj");
  }
  unpick();
  director.apply();
  wakeLoop();
});
ref.tip.addEventListener("click", (event) => {
  const button = event.target.closest("[data-pick]");
  if (!button) return;
  if (button.getAttribute("data-pick") === "more") {
    if (ref.inspector.hasAttribute("hidden")) toggleInspector(true);
    selectTab("obj");
  }
  unpick();
  wakeLoop();
});
function click(event) {
  const { cell, id } = hit(event);
  unpick();
  if (!id) {
    selection = null;
    if (ctx.tab === "obj") renderInspector(ctx, null);
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
    const info = entry.cell(i, j);
    selection = { id: target, cell: info, obj: id, i, j };
    if (entry.onCell) entry.onCell(i, j, ctx);
    if (info) {
      const row = info.rows.find(([key]) => /\[i,j\]|salida|resultado/i.test(key)) || info.rows.find(([key]) => /operación/.test(key));
      const owner = nameOf(id);
      ref.tip.innerHTML = pickCard(`${owner ? `${esc(owner[0])} · ` : ""}${info.title}`, row ? `${row[0]}: ${row[1]}` : "", { more: true });
      const box = ref.stage.getBoundingClientRect();
      ref.tip.style.left = `${Math.max(8, Math.min(box.width - 300, event.clientX - box.left - 120))}px`;
      ref.tip.style.top = `${Math.max(8, event.clientY - box.top - 96)}px`;
      ref.tip.classList.add("on", "pinned");
    }
  } else {
    selection = target;
    const info = infoFor(ctx, target);
    const named = nameOf(id) || (info ? [info.title, firstSentence(info.what)] : [id, ""]);
    engine.label("pick", { obj: id, dz: 6, cls: "tag pick", html: pickCard(esc(named[0]), esc(named[1]), { more: !!info }) });
  }
  lesson.interrupt("inspección");
  if (ctx.tab === "obj") renderInspector(ctx, selection);
  wakeLoop();
}
function hover(event) {
  if (ref.tip.classList.contains("pinned")) return;
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
ref.svg.addEventListener("pointerleave", () => ref.tip.classList.contains("pinned") || ref.tip.classList.remove("on"));
ctx.inspectFromList = (id) => {
  selection = id;
  renderInspector(ctx, id);
};

ref.help.addEventListener("click", () => {
  if (ref.inspector.hasAttribute("hidden")) toggleInspector(true);
  selectTab("settings");
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
  else if (key === "n" || key === "N") act(() => toggleInspector());
  else if (key === "v" || key === "V") act(() => setWindows(![...beatScoped.panels.values()].some((node) => !node.classList.contains("min"))));
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
  else if (key === "Escape") act(() => (engine.labels.has("pick") || ref.tip.classList.contains("pinned") || !ref.chapterList.hidden ? (unpick(), openChapters(false), director.apply()) : goBack()));
  else if (key === "0") act(() => resetLesson());
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
