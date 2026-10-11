import { el } from "./ui.mjs";
import { esc } from "./helpers.mjs";
import { SOUND_OPS, SOUND_NOTE } from "./sound.mjs";

const PLAIN = {
  contexto: ["Contexto", "lo que el sistema tiene delante ahora: tokens, activaciones, registros"],
  pesos: ["Pesos", "los parámetros aprendidos del modelo (θ)"],
  codigo: ["Código", "el programa del agente, por ejemplo su gestor de contexto"],
  datos: ["Datos", "las tareas o ejemplos que se usan"],
  evaluador: ["Evaluador", "las pruebas y el criterio que deciden"],
  infra: ["Infraestructura", "el presupuesto y el entorno donde se ejecuta"],
};
const OP_NAME = Object.fromEntries(SOUND_OPS.map((o) => [o.op, o.name]));
const CLOSE = '<button class="x" data-act="close-box" aria-label="Cerrar">×</button>';

export const plainOf = (html) =>
  String(html || "")
    .replace(/\{\{[^|}]+\|([^}]+)\}\}/g, "$1")
    .replace(/\[\[[^|\]]+\|([^\]]+)\]\]/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z]+;/g, " ")
    .trim();
export const wordsOf = (html) => plainOf(html).split(/\s+/).filter(Boolean).length;

export function richText(html) {
  return String(html || "")
    .replace(/\{\{([^|}]+)\|([^}]+)\}\}/g, (_, id, label) => `<button class="ref" data-ref="${id}" title="Mostrar en la escena">${label}</button>`)
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, (_, key, label) => `<button class="term" data-term="${key}" title="Ver en el glosario">${label}</button>`)
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
}

export function makeLesson({ director, ctx, ref, bus, sound, scripts, concepts }) {
  const steps = [];
  const missing = [];
  director.beats.forEach((beat, bi) => {
    const defs = scripts[beat.id] || [];
    let k = 1;
    defs.forEach((def, si) => {
      const span = def.span ?? 1;
      const to = def.last ? beat.events : Math.min(beat.events, k + span - 1);
      steps.push({ ...def, id: defs.length > 1 ? `${beat.id}${String.fromCharCode(97 + si)}` : beat.id, part: si + 1, parts: defs.length, beat, bi, from: k, to });
      k = to + 1;
    });
    if (k <= beat.events || !defs.length) {
      missing.push(beat.id);
      const caption = (c) => (typeof beat.caption === "function" ? beat.caption(c) : beat.caption) || "";
      steps.push({ id: `${beat.id}${defs.length ? "z" : ""}`, beat, bi, from: k, to: beat.events, part: defs.length + 1, parts: defs.length + 1, orient: caption, missing: true });
    }
  });
  steps.forEach((step, index) => (step.index = index));

  const L = {
    i: 0,
    phase: "orient",
    auto: false,
    narrator: true,
    wpm: 140,
    box: null,
    trail: [],
    stack: [],
    armed: null,
    armCount: 0,
    timer: null,
    waitUntil: 0,
    waitStart: 0,
    waitTotal: 0,
    remaining: null,
    entering: false,
    explored: false,
  };
  const listeners = new Set();
  const notify = () => listeners.forEach((fn) => fn());

  const step = () => steps[L.i];
  const tOf = (s, k) => k / s.beat.events;
  const startT = (s) => tOf(s, s.from - 1) + (s.from > 1 ? 1e-6 : 0);
  const endT = (s) => tOf(s, s.to);
  const textOf = (fnOrText) => (typeof fnOrText === "function" ? fnOrText(ctx) : fnOrText) || "";
  const hasAct = (s) => !!s.act;
  const animSeconds = (s) => {
    if (s.seconds) return s.seconds;
    const share = (s.to - s.from + 1) / s.beat.events;
    return Math.max(1.6, Math.min(5, s.beat.dur * share * 0.9));
  };
  const readSeconds = (html) => {
    const words = wordsOf(html);
    if (!words) return 0;
    return Math.max(6, (words / L.wpm) * 60 + 2.5);
  };
  const lookOf = (s) => (typeof s.look === "function" ? s.look(ctx) : s.look) || null;

  function estimate(s) {
    const orient = readSeconds(textOf(s.orient));
    const result = readSeconds(textOf(s.result));
    const anim = hasAct(s) || s.to >= s.from ? animSeconds(s) : 0;
    return orient + anim + result + (s.from === 1 ? 1.4 : 0);
  }
  let estimates = [];
  let starts = [];
  let total = 0;
  function recompute() {
    estimates = steps.map(estimate);
    starts = [];
    total = 0;
    for (const e of estimates) {
      starts.push(total);
      total += e;
    }
  }

  function snapshot() {
    return { i: L.i, phase: L.phase, user: JSON.parse(JSON.stringify(ctx.user)) };
  }
  function pushStack() {
    const snap = snapshot();
    const last = L.stack[L.stack.length - 1];
    if (!last || last.i !== snap.i || last.phase !== snap.phase || JSON.stringify(last.user) !== JSON.stringify(snap.user)) L.stack.push(snap);
    if (L.stack.length > 300) L.stack.shift();
  }

  function clearTimer() {
    if (L.timer) clearTimeout(L.timer);
    L.timer = null;
  }
  function cancelSound() {
    L.armed = null;
    sound.stopAll();
  }

  function remember() {
    const s = step();
    const html = textOf(L.phase === "result" ? s.result : s.orient);
    if (!html) return;
    const key = `${s.id}:${L.phase === "result" ? "r" : "o"}`;
    if (L.trail.length && L.trail[0].chapter !== s.beat.c) L.trail = [];
    if (!L.trail.some((entry) => entry.key === key)) L.trail.push({ key, chapter: s.beat.c, id: s.id, html });
  }

  function applyLook() {
    const s = step();
    if (!s) return;
    const look = lookOf(s);
    if (look && L.phase !== "act") ctx.focus(look);
  }

  function enter(i, phase = "orient", { push = true, restore = null } = {}) {
    clearTimer();
    cancelSound();
    L.remaining = null;
    L.waitTotal = 0;
    L.frozen = false;
    L.i = Math.max(0, Math.min(steps.length - 1, i));
    const s = step();
    if (restore) ctx.restoreUser(restore);
    L.box = null;
    L.phase = phase;
    director.S.stepTo = null;
    const sameBeat = director.S.beat === s.bi;
    if (phase === "result" || phase === "done") director.seek(s.bi, endT(s));
    else if (!hasAct(s)) {
      director.seek(s.bi, startT(s));
      L.entering = true;
      director.animateTo(endT(s), still() ? 0 : Math.min(2.2, animSeconds(s)));
    } else director.seek(s.bi, startT(s));
    if (!sameBeat && director.S.mode === "tour" && !director.S.manualCam) director.flyTo(director.cameraFor(s.beat), s.beat.camSeconds ?? 1.4);
    applyLook();
    if (push) pushStack();
    remember();
    render();
    ctx.say(plainOf(textOf(phase === "result" ? s.result : s.orient)));
    if (L.auto) schedule();
    ctx.wake();
  }

  const still = () => ctx.still.matches;

  function perform() {
    const s = step();
    if (!hasAct(s) || L.phase === "act") return;
    L.frozen = false;
    clearTimer();
    if (L.phase !== "orient") director.seek(s.bi, startT(s));
    L.phase = "act";
    L.box = null;
    L.armCount += 1;
    const listed = typeof s.cues === "function" ? s.cues(ctx) : s.cues;
    const cues = (listed || (s.op ? [{ at: 0.12, op: s.op }] : [])).map((cue, index) => ({ ...cue, index, fired: false }));
    L.armed = { step: s.id, arm: L.armCount, cues };
    director.animateTo(endT(s), still() ? 0 : animSeconds(s));
    pushStack();
    render();
    ctx.say(plainOf(textOf(s.act)));
    ctx.wake();
  }

  function fire(cue, delay = 0) {
    const s = step();
    const targets = typeof cue.targets === "function" ? cue.targets(ctx) : cue.targets || lookOf(s) || [];
    bus.emit({ id: `${s.id}#${cue.index}@${L.armed.arm}`, op: cue.op, label: cue.label || OP_NAME[cue.op] || cue.op, targets, step: s.id, phase: "act", data: cue.data ? cue.data(ctx) : null, delay });
  }

  function frame() {
    const s = step();
    if (L.entering && director.S.stepTo === null) {
      L.entering = false;
      applyLook();
      if (L.auto) schedule();
    }
    if (L.phase !== "act" || !L.armed) return;
    const span = endT(s) - startT(s);
    const u = span > 0 ? (director.S.t - startT(s)) / span : 1;
    let order = 0;
    for (const cue of L.armed.cues) {
      if (!cue.fired && u >= cue.at - 1e-6) {
        cue.fired = true;
        fire(cue, still() ? order * 0.16 : 0);
        order += 1;
      }
    }
    if (director.S.stepTo === null && u >= 1 - 1e-6) {
      L.armed = null;
      L.waitTotal = 0;
      L.remaining = null;
      L.phase = s.result ? "result" : "done";
      applyLook();
      pushStack();
      remember();
      render();
      if (s.result) ctx.say(plainOf(textOf(s.result)));
      if (L.auto) schedule();
    }
  }

  function next() {
    const s = step();
    if (L.phase === "orient" && hasAct(s)) return perform();
    if (L.phase === "act") {
      if (!resumeAct()) director.animateTo(endT(s), 0);
      return;
    }
    if (L.i < steps.length - 1) enter(L.i + 1);
    else {
      L.auto = false;
      clearTimer();
      render();
    }
  }

  function prev() {
    clearTimer();
    L.auto = false;
    const here = snapshot();
    while (L.stack.length) {
      const snap = L.stack.pop();
      const same = snap.i === here.i && snap.phase === here.phase && JSON.stringify(snap.user) === JSON.stringify(here.user);
      if (!same && snap.phase !== "act") {
        enter(snap.i, snap.phase, { push: false, restore: snap.user });
        L.stack.push(snap);
        return;
      }
    }
    if (L.phase !== "orient") enter(L.i, "orient", { push: false });
    else if (L.i > 0) enter(L.i - 1, steps[L.i - 1].result ? "result" : "orient", { push: false });
  }

  function repeat() {
    const s = step();
    if (!hasAct(s)) return enter(L.i, "orient");
    L.auto = false;
    clearTimer();
    cancelSound();
    director.seek(s.bi, startT(s));
    L.phase = "orient";
    perform();
  }

  function schedule() {
    clearTimer();
    if (!L.auto) return;
    const s = step();
    if (L.phase === "act" || L.entering || director.S.camAnim) {
      L.timer = setTimeout(schedule, 250);
      return;
    }
    const html = textOf(L.phase === "result" ? s.result : s.orient);
    const full = (L.narrator ? readSeconds(html) : wordsOf(html) ? 2.5 : 0) * 1000;
    const wait = L.remaining ?? full;
    L.remaining = null;
    L.waitTotal = Math.max(full, wait);
    L.waitStart = performance.now() - (L.waitTotal - wait);
    L.waitUntil = performance.now() + wait;
    L.timer = setTimeout(() => {
      L.timer = null;
      if (!L.auto) return;
      next();
    }, wait);
    render();
  }

  function resumeAct() {
    if (!L.frozen) return false;
    const s = step();
    const left = Math.max(0, endT(s) - director.S.t);
    const span = Math.max(1e-9, endT(s) - startT(s));
    director.animateTo(endT(s), still() ? 0 : (animSeconds(s) * left) / span);
    L.frozen = false;
    return true;
  }
  function play() {
    if (L.auto) return;
    L.auto = true;
    if (L.phase === "done" && L.i >= steps.length - 1) enter(0);
    resumeAct();
    schedule();
    notify();
    renderTransport();
  }
  function waitShare() {
    if (!L.waitTotal) return 0;
    const now = L.auto && L.timer ? performance.now() : L.remaining !== null ? L.waitUntil - L.remaining : L.waitStart;
    return Math.max(0, Math.min(1, (now - L.waitStart) / L.waitTotal));
  }
  function pause(reason = "") {
    if (L.auto && L.timer) {
      L.remaining = Math.max(0, L.waitUntil - performance.now());
      L.waitUntil = performance.now();
    }
    L.auto = false;
    clearTimer();
    if (L.phase === "act" && director.S.stepTo !== null) {
      director.S.stepTo = null;
      director.S.stepRate = null;
      L.frozen = true;
    }
    sound.stopAll();
    if (reason) L.pausedBy = reason;
    notify();
    renderTransport();
    render();
  }
  function interrupt(reason) {
    if (L.auto || (L.phase === "act" && director.S.stepTo !== null)) pause(reason);
  }

  function goToChapter(c) {
    const index = steps.findIndex((s) => s.beat.c === c);
    if (index >= 0) {
      director.S.manualCam = false;
      enter(index);
    }
  }
  function goToBeat(bi) {
    const index = steps.findIndex((s) => s.bi === bi);
    if (index >= 0) enter(index);
  }

  function changedBox() {
    const s = step();
    const changed = (typeof s.beat.changed === "function" ? s.beat.changed(ctx) : s.beat.changed) || {};
    const rows = Object.entries(PLAIN).map(([key, [name, what]]) => {
      const value = changed[key] || "fijo";
      const state = value === "fijo" ? "permanece fijo" : value === "activo" ? "se calcula ahora, sin guardarse" : `cambia: ${value}`;
      return `<li data-s="${value === "fijo" ? "fijo" : value === "activo" ? "activo" : "cambió"}"><b>${name}</b> <span class="what">(${what})</span>: ${esc(state)}</li>`;
    });
    const fixed = textOf(s.fixed);
    return `${fixed ? `<p>${richText(fixed)}</p>` : ""}<ul class="plainchg">${rows.join("")}</ul>`;
  }

  function boxHtml() {
    const s = step();
    if (!L.box) return "";
    if (L.box.kind === "simple") {
      const c = concepts[s.concept];
      return `<div class="g-box"><div class="g-box-h">Más simple · ${esc(c.title)}${CLOSE}</div>${richText(textOf(c.simple))}</div>`;
    }
    if (L.box.kind === "example") {
      const c = concepts[s.concept];
      const ex = (s.example || c.example)(ctx);
      return `<div class="g-box"><div class="g-box-h">Ejemplo · ${esc(c.title)}${CLOSE} ${ex.prov ? `<span class="prov" data-p="${ex.prov}">${ex.prov === "local" ? "resultado calculado" : ex.prov === "ilus" ? "ejemplo ilustrativo" : ex.prov === "sim" ? "simulación conceptual" : "resultado citado"}</span>` : ""}</div>${richText(ex.html)}</div>`;
    }
    if (L.box.kind === "term") {
      const c = concepts[L.box.key];
      if (!c) return "";
      const ex = c.example ? c.example(ctx) : null;
      const where = c.where ? (typeof c.where === "function" ? c.where(ctx) : c.where) : null;
      return `<div class="g-box"><div class="g-box-h">Glosario · ${esc(c.title)}${CLOSE}</div><p>${richText(textOf(c.def))}</p>${ex ? `<p class="g-ex">${richText(ex.html)}</p>` : ""}${where && where.length ? `<button class="btn" data-act="show" data-ids="${where.join(",")}">Mostrar en la escena</button>` : `<p class="kv">No tiene un objeto propio en esta escena.</p>`}</div>`;
    }
    if (L.box.kind === "more") {
      const more = typeof s.beat.more === "function" ? s.beat.more(ctx) : s.beat.more;
      return `<div class="g-box"><div class="g-box-h">Ampliación${CLOSE}</div>${more || "<p>Sin ampliación para este paso.</p>"}</div>`;
    }
    return "";
  }

  function soundsHtml() {
    const on = sound.enabled;
    return `<div class="set-row"><button class="btn${on ? " primary" : ""}" data-act="sound-toggle" aria-pressed="${on}">${on ? "Sonidos activos" : "Activar sonidos"}</button>
      <label class="set-inline">volumen <input type="range" min="0" max="1" step="0.05" value="${sound.prefs.volume}" data-act="volume" aria-label="Volumen general"></label>
      <label class="set-inline"><input type="checkbox" data-act="mute" ${sound.prefs.muted ? "checked" : ""}> silencio (X)</label></div>
      <p class="kv">Cada familia de operaciones tiene una señal propia. Todo se entiende sin sonido.</p>
      <details><summary>Qué suena en cada operación</summary><ul class="legend-snd">${SOUND_OPS.map((o) => `<li><button class="btn" data-act="listen" data-op="${o.op}" ${on ? "" : "disabled"}>▶</button><div><b>${esc(o.name)}</b> · <span class="kv">${esc(o.hint)}</span><br><span>${esc(o.when)}</span></div></li>`).join("")}</ul>
      <p class="kv">${esc(SOUND_NOTE)}</p></details>`;
  }

  function primaryLabel() {
    const s = step();
    if (L.phase === "orient" && hasAct(s)) return "Ver la operación";
    if (L.phase === "act") return L.frozen ? "Seguir la operación" : "Saltar al resultado";
    if (L.i >= steps.length - 1) return "Fin del recorrido";
    return "Continuar";
  }

  function phaseList() {
    const s = step();
    const phases = [["orient", "Orientación"]];
    if (hasAct(s)) phases.push(["act", "Operación"]);
    if (s.result) phases.push(["result", "Resultado"]);
    const current = L.phase === "done" ? "orient" : L.phase;
    return `<ol class="phases" aria-label="Fases de este paso">${phases.map(([key, name]) => `<li ${key === current ? 'aria-current="step"' : ""}>${name}</li>`).join("")}</ol>`;
  }

  function guideHtml() {
    const s = step();
    const beat = s.beat;
    const orient = textOf(s.orient);
    const act = textOf(s.act);
    const result = textOf(s.result);
    let main = "";
    if (L.phase === "orient" || (L.phase === "done" && !result)) main = `<div class="g-text">${richText(orient)}</div>`;
    else if (L.phase === "act") main = `<div class="g-text dim">${richText(orient)}</div><div class="g-act" role="status">▸ ${richText(act)}</div>`;
    else main = `<div class="g-text dim small">${richText(orient)}</div><div class="g-text">${richText(result)}</div>`;
    const c = s.concept && concepts[s.concept];
    const trail = L.trail.filter((entry) => entry.chapter === beat.c);
    return `<div class="guide${L.narrator ? "" : " off"}">
      <div class="kind">Capítulo ${beat.c + 1} · paso ${beat.c + 1}.${beat.b + 1}${s.parts > 1 ? ` · parte ${s.part} de ${s.parts}` : ""}</div>
      <h2>${esc(beat.chapter.title)}</h2>
      ${phaseList()}
      ${main}
      ${L.auto && L.timer ? `<div class="g-wait" role="progressbar" aria-label="Tiempo de lectura antes de seguir"><i style="width:${(waitShare() * 100).toFixed(1)}%"></i></div>` : ""}
      <div class="g-actions">
        <button class="btn primary" data-act="primary">${primaryLabel()}</button>
        ${hasAct(s) ? '<button class="btn" data-act="repeat" title="Repetir esta operación (R)">↻ Repetir</button>' : ""}
        ${L.i > 0 ? '<button class="btn ghost" data-act="back" title="Volver (←)">← Atrás</button>' : ""}
      </div>
      <div class="g-help">
        ${c ? `<button class="link" data-act="simple" aria-pressed="${L.box?.kind === "simple"}">Más simple</button><button class="link" data-act="example" aria-pressed="${L.box?.kind === "example"}">Un ejemplo</button>` : ""}
        ${beat.more ? `<button class="link" data-act="more" aria-pressed="${L.box?.kind === "more"}">Ampliar</button>` : ""}
      </div>
      ${boxHtml()}
      <details class="g-fixed"><summary>Qué cambia y qué permanece fijo</summary>${changedBox()}</details>
      <details class="g-trail"><summary>Lo leído en este capítulo (${trail.length})</summary>${trail.map((entry) => `<div class="g-old"><span class="kv">${esc(entry.id)}</span> ${richText(entry.html)}</div>`).join("")}</details>
      ${s.missing ? '<p class="kv">Este paso todavía no tiene guion propio.</p>' : ""}
    </div>`;
  }

  function render() {
    if (!steps.length) return;
    const s = step();
    if (ctx.tab === "guide") ref.inspBody.innerHTML = guideHtml();
    const act = textOf(s.act);
    const cap = !L.narrator && L.phase === "act" ? `▸ ${plainOf(act)}` : "";
    ref.capText.textContent = cap;
    ref.caption.classList.toggle("empty", !cap);
    renderTransport();
    notify();
  }

  function renderTransport() {
    const s = step();
    if (!s) return;
    ref.next.title = `${primaryLabel()} (→ o Intro)`;
    ref.next.setAttribute("aria-label", primaryLabel());
    ref.play.textContent = L.auto ? "❚❚" : "▶";
    ref.play.setAttribute("aria-label", L.auto ? "Pausar la reproducción automática" : "Reproducción automática");
    ref.play.title = L.auto ? "Pausar (espacio)" : `Reproducción automática: avanza solo, con ${L.wpm} palabras por minuto de lectura (espacio)`;
  }

  function position() {
    const s = step();
    if (!s) return 0;
    const est = estimates[L.i] || 0;
    const orient = readSeconds(textOf(s.orient));
    const anim = animSeconds(s);
    let within = 0;
    if (L.phase === "act") {
      const span = endT(s) - startT(s);
      within = orient + (span > 0 ? Math.max(0, Math.min(1, (director.S.t - startT(s)) / span)) : 1) * anim;
    } else if (L.phase === "result" || L.phase === "done") within = orient + anim + waitShare() * readSeconds(textOf(s.result));
    else within = waitShare() * orient;
    return starts[L.i] + Math.min(est, within);
  }
  function seekShare(share) {
    const time = share * total;
    let index = starts.findIndex((start, j) => time >= start && time < start + estimates[j]);
    if (index < 0) index = steps.length - 1;
    L.auto = false;
    enter(index);
  }

  function handleClick(event) {
    const button = event.target.closest("[data-act],[data-ref],[data-term]");
    if (!button) return;
    const refId = button.getAttribute("data-ref");
    if (refId) {
      interrupt("referencia");
      ctx.spotlight(refId.split(","), button.textContent);
      return;
    }
    const term = button.getAttribute("data-term");
    if (term) {
      interrupt("glosario");
      L.box = L.box && L.box.kind === "term" && L.box.key === term ? null : { kind: "term", key: term };
      render();
      return;
    }
    const act = button.getAttribute("data-act");
    if (act === "primary") next();
    else if (act === "repeat") repeat();
    else if (act === "back") prev();
    else if (act === "close-box") {
      L.box = null;
      render();
    } else if (["simple", "example", "more"].includes(act)) {
      interrupt(act);
      L.box = L.box && L.box.kind === act ? null : { kind: act };
      render();
    } else if (act === "show") {
      ctx.spotlight(button.getAttribute("data-ids").split(","), "");
    } else if (act === "sound-toggle") {
      (sound.enabled ? Promise.resolve(sound.disable()) : sound.enable()).then(() => render());
    } else if (act === "listen") sound.preview(button.getAttribute("data-op"));
  }
  function handleInput(event) {
    const act = event.target.getAttribute("data-act");
    if (act === "volume") sound.setVolume(Number(event.target.value));
    if (act === "mute") sound.setMuted(event.target.checked);
  }
  function handleHover(event) {
    const button = event.target.closest("[data-ref]");
    if (!button) return;
    const ids = button.getAttribute("data-ref").split(",");
    ctx.focus(ids);
    ctx.wake();
  }
  function handleLeave(event) {
    if (!event.target.closest || !event.target.closest("[data-ref]")) return;
    applyLook();
    if (!lookOf(step())) director.apply();
    ctx.wake();
  }

  recompute();
  return {
    steps,
    missing,
    L,
    get step() {
      return step();
    },
    get total() {
      return total;
    },
    get starts() {
      return starts;
    },
    estimates: () => estimates,
    readSeconds,
    animSeconds,
    position,
    seekShare,
    enter,
    perform,
    next,
    prev,
    repeat,
    play,
    pause,
    interrupt,
    frame,
    render,
    applyLook,
    goToChapter,
    goToBeat,
    recompute,
    handleClick,
    handleInput,
    handleHover,
    handleLeave,
    onChange(fn) {
      listeners.add(fn);
    },
    setNarrator(on) {
      if (L.narrator === on) return;
      L.narrator = on;
      if (L.auto && L.timer) schedule();
      render();
    },
    soundsHtml,
    waitShare,
    setWpm(wpm) {
      L.wpm = wpm;
      recompute();
      render();
    },
    textOf,
  };
}
