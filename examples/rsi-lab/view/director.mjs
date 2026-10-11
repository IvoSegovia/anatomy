// Director del recorrido: línea de tiempo de capítulos → pasos (beats) → eventos.
// Cada paso es determinista: pose(ctx, t) depende sólo del estado y de t ∈ [0, 1].
// Los eventos son fronteras t = k/n; al cruzarlas se guarda un estado (para retroceder).
import { ease, lerp, lerp3 } from "./engine.mjs";

export function makeDirector({ chapters, engine, ref, ctx, hooks = {} }) {
  // PACE ajusta el ritmo global del recorrido guiado (≈ 11 min a 1×); no afecta a ningún cálculo.
  const PACE = 0.86;
  const beats = [];
  chapters.forEach((chapter, c) => chapter.beats.forEach((beat, b) => beats.push({ events: 1, ...beat, dur: (beat.dur ?? 8) * PACE, chapter, c, b })));
  const total = beats.reduce((t, beat) => t + beat.dur, 0);
  const startOf = beats.map((_, i) => beats.slice(0, i).reduce((t, beat) => t + beat.dur, 0));
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const S = {
    beat: 0,
    t: 0,
    playing: false,
    speed: 1,
    mode: "tour",
    manualCam: false,
    history: [],
    camAnim: null,
    activeChapter: -1,
    activeBeat: -1,
    stepTo: null,
  };

  const beatAt = () => beats[S.beat];
  const eventOf = (beat, t) => Math.min(beat.events, Math.floor(t * beat.events + 1e-9));

  function snapshot() {
    return { beat: S.beat, t: S.t, user: JSON.parse(JSON.stringify(ctx.user)) };
  }
  function save() {
    const snap = snapshot();
    const last = S.history[S.history.length - 1];
    if (!last || last.beat !== snap.beat || Math.abs(last.t - snap.t) > 1e-6 || JSON.stringify(last.user) !== JSON.stringify(snap.user)) S.history.push(snap);
    if (S.history.length > 400) S.history.shift();
  }

  function cameraFor(beat) {
    const spec = typeof beat.camera === "function" ? beat.camera(ctx) : beat.camera;
    if (!spec) return null;
    if (spec.points) {
      const fit = engine.fit(spec.points, { pad: spec.pad ?? 28, azimuth: spec.azimuth ?? 45, elevation: spec.elevation ?? 30, maxScale: spec.maxScale ?? 40, area: spec.area });
      if (spec.zoom) fit.scale *= spec.zoom;
      return fit;
    }
    return { azimuth: 45, elevation: 30, ...spec };
  }

  function flyTo(cam, seconds = 1.4) {
    if (!cam) return;
    if (still.matches || seconds <= 0) {
      engine.setCamera(cam);
      S.camAnim = null;
      return;
    }
    S.camAnim = { from: { ...engine.cam, target: [...engine.cam.target] }, to: cam, age: 0, seconds };
  }

  function enter(index, { fly = true } = {}) {
    const beat = beats[index];
    if (beat.c !== S.activeChapter) {
      if (S.activeChapter >= 0 && chapters[S.activeChapter].exit) chapters[S.activeChapter].exit(ctx);
      S.activeChapter = beat.c;
      if (beat.chapter.setup) beat.chapter.setup(ctx);
      hooks.chapter && hooks.chapter(beat.chapter, beat.c);
    }
    if (S.activeBeat !== index) {
      S.activeBeat = index;
      ctx.clearBeat();
      if (beat.enter) beat.enter(ctx);
      hooks.beat && hooks.beat(beat, index);
      if (fly && S.mode === "tour" && !S.manualCam) flyTo(cameraFor(beat), beat.camSeconds ?? 1.4);
    }
  }

  function apply() {
    const beat = beatAt();
    enter(S.beat);
    const e = eventOf(beat, S.t);
    if (beat.pose) beat.pose(ctx, S.t, e);
    hooks.applied && hooks.applied(beat, S.t, e);
  }

  function seek(index, t = 0, opts = {}) {
    S.beat = Math.max(0, Math.min(beats.length - 1, index));
    S.t = Math.max(0, Math.min(1, t));
    if (opts.forceEnter) S.activeBeat = -1;
    apply();
    save();
  }

  // Avanza el reloj narrativo.
  function tick(dt) {
    let moving = false;
    if (S.camAnim) {
      S.camAnim.age += dt;
      const u = ease(Math.min(1, S.camAnim.age / S.camAnim.seconds));
      const { from, to } = S.camAnim;
      engine.setCamera({
        target: lerp3(from.target, to.target ?? from.target, u),
        scale: Math.exp(lerp(Math.log(from.scale), Math.log(to.scale ?? from.scale), u)),
        azimuth: lerp(from.azimuth, to.azimuth ?? from.azimuth, u),
        elevation: lerp(from.elevation, to.elevation ?? from.elevation, u),
      });
      if (u >= 1) S.camAnim = null;
      moving = true;
    }
    if (S.stepTo !== null) {
      const beat = beatAt();
      const before = S.t;
      S.t = Math.min(S.stepTo, S.t + (dt * S.speed) / Math.max(0.35, Math.min(1.2, beat.dur / beat.events)));
      if (still.matches) S.t = S.stepTo;
      if (S.t >= S.stepTo - 1e-9) {
        S.t = S.stepTo;
        S.stepTo = null;
        apply();
        save();
      } else apply();
      if (before !== S.t) moving = true;
    } else if (S.playing) {
      const beat = beatAt();
      const before = eventOf(beat, S.t);
      S.t += (dt * S.speed) / beat.dur;
      if (still.matches) S.t = Math.min(1, Math.ceil(S.t * beat.events + 1e-9) / beat.events);
      if (S.t >= 1) {
        S.t = 1;
        apply();
        save();
        if (S.beat < beats.length - 1 && S.mode === "tour") {
          S.beat += 1;
          S.t = 0;
          apply();
        } else S.playing = false;
      } else {
        apply();
        if (eventOf(beat, S.t) !== before) save();
      }
      moving = true;
    }
    return moving;
  }

  function nextEvent() {
    S.playing = false;
    const beat = beatAt();
    if (S.t >= 1 - 1e-9) {
      if (S.beat >= beats.length - 1) return;
      S.beat += 1;
      S.t = 0;
      apply();
      save();
      const next = beatAt();
      S.stepTo = 1 / next.events;
    } else {
      const e = eventOf(beat, S.t);
      S.stepTo = Math.min(1, (e + 1) / beat.events);
    }
  }

  function prevEvent() {
    S.playing = false;
    S.stepTo = null;
    // estado guardado anterior distinto del actual
    const here = snapshot();
    while (S.history.length) {
      const snap = S.history.pop();
      const same = snap.beat === here.beat && Math.abs(snap.t - here.t) < 1e-6 && JSON.stringify(snap.user) === JSON.stringify(here.user);
      if (!same) {
        ctx.restoreUser(snap.user);
        S.beat = snap.beat;
        S.t = snap.t;
        apply();
        S.history.push(snap);
        return true;
      }
    }
    // sin historia: ir al inicio del paso o al final del anterior
    if (S.t > 0) seek(S.beat, 0);
    else if (S.beat > 0) seek(S.beat - 1, 1);
    return false;
  }

  function chapterStart(c) {
    return beats.findIndex((beat) => beat.c === c);
  }

  return {
    beats,
    total,
    startOf,
    S,
    seek,
    tick,
    apply,
    nextEvent,
    prevEvent,
    flyTo,
    cameraFor,
    chapterStart,
    eventOf,
    get beat() {
      return beatAt();
    },
    get position() {
      return startOf[S.beat] + S.t * beatAt().dur;
    },
    play() {
      if (S.t >= 1 && S.beat >= beats.length - 1) seek(0, 0);
      S.playing = true;
      S.stepTo = null;
    },
    pause() {
      S.playing = false;
      S.stepTo = null;
    },
    setMode(mode) {
      S.mode = mode;
      if (mode === "tour") {
        S.manualCam = false;
        flyTo(cameraFor(beatAt()));
      }
    },
    guidedCamera() {
      S.manualCam = false;
      flyTo(cameraFor(beatAt()));
    },
    stopCamera() {
      S.camAnim = null;
    },
  };
}
