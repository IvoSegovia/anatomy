export const SOUND_OPS = [
  { op: "token", name: "Entrada de un token", hint: "clic breve y seco", when: "un token entra a la secuencia o se elige el siguiente" },
  { op: "lookup", name: "Lectura de una tabla", hint: "dos destellos agudos iguales", when: "se recupera una fila guardada: un embedding, una posición, una versión del archivo" },
  { op: "matmul", name: "Producto de matrices", hint: "cuatro pulsos regulares", when: "filas por columnas: Q, K, V, QKᵀ, A·V, W_O, W_U" },
  { op: "sum", name: "Suma o acumulación", hint: "golpes graves redondos que terminan en una nota", when: "se suman contribuciones: la conexión residual, una mezcla de vectores" },
  { op: "normalize", name: "Normalización", hint: "tono que vibra y se estabiliza", when: "softmax o LayerNorm reescalan una fila" },
  { op: "mask", name: "Bloqueo o descarte", hint: "golpe sordo y apagado", when: "se bloquean posiciones futuras o un gestor descarta líneas" },
  { op: "transfer", name: "Transferencia entre módulos", hint: "barrido suave de ruido", when: "un dato pasa de un módulo del laboratorio a otro" },
  { op: "gradient", name: "Propagación del gradiente", hint: "deslizamiento descendente", when: "se calcula cómo responde la pérdida a cada parámetro" },
  { op: "update", name: "Actualización de parámetros", hint: "doble pulso de timbre áspero", when: "un parámetro aprendible cambia de valor" },
  { op: "evaluate", name: "Evaluación terminada", hint: "una nota corta de madera", when: "terminan de ejecutarse pruebas o tareas" },
  { op: "promote", name: "Promoción de una versión", hint: "dos notas ascendentes", when: "una candidata cumple el criterio y pasa a ser la activa" },
  { op: "reject", name: "Rechazo o regresión", hint: "dos notas descendentes suaves", when: "una candidata no cumple el criterio o empeora" },
];
export const SOUND_NOTE = "Subir o bajar de altura es una convención para reconocer la operación: no representa el signo del gradiente ni ninguna medición física.";

const VOICES = {
  token(v, t) {
    v.noise({ t, dur: 0.028, peak: 0.2, band: 2600, q: 1.2 });
    v.tone({ t, type: "sine", f: 1700, attack: 0.002, decay: 0.034, peak: 0.1 });
    return 0.07;
  },
  lookup(v, t) {
    for (const dt of [0, 0.085]) {
      v.tone({ t: t + dt, type: "sine", f: 1318, attack: 0.003, decay: 0.07, peak: 0.15 });
      v.tone({ t: t + dt, type: "sine", f: 2636, attack: 0.002, decay: 0.035, peak: 0.045 });
    }
    return 0.2;
  },
  matmul(v, t) {
    for (let i = 0; i < 4; i++) v.tone({ t: t + i * 0.085, type: "sine", f: 523.25, attack: 0.004, decay: 0.055, peak: 0.19 });
    return 0.37;
  },
  sum(v, t) {
    [0, 0.085, 0.15].forEach((dt) => v.tone({ t: t + dt, type: "sine", f: 150, fTo: 92, glide: 0.08, attack: 0.004, decay: 0.085, peak: 0.3 }));
    v.tone({ t: t + 0.23, type: "triangle", f: 329.6, attack: 0.012, decay: 0.22, peak: 0.15 });
    return 0.48;
  },
  normalize(v, t) {
    v.tone({ t, type: "sine", f: 600, attack: 0.025, decay: 0.36, peak: 0.15, vibrato: { rate: 13, depth: 48, settle: 0.27 } });
    return 0.42;
  },
  mask(v, t) {
    v.noise({ t, dur: 0.05, peak: 0.26, lowpass: 380 });
    v.tone({ t, type: "sine", f: 85, attack: 0.003, decay: 0.07, peak: 0.24 });
    return 0.1;
  },
  transfer(v, t) {
    v.noise({ t, dur: 0.24, peak: 0.11, band: 700, bandTo: 2600, q: 2.5, attack: 0.05 });
    return 0.32;
  },
  gradient(v, t) {
    v.tone({ t, type: "sine", f: 1100, fTo: 360, glide: 0.26, attack: 0.015, decay: 0.29, peak: 0.14 });
    return 0.33;
  },
  update(v, t) {
    for (const dt of [0, 0.075]) v.tone({ t: t + dt, type: "square", f: 392, attack: 0.003, decay: 0.05, peak: 0.075, lowpass: 1600 });
    return 0.16;
  },
  evaluate(v, t) {
    v.tone({ t, type: "sine", f: 523.25, attack: 0.002, decay: 0.2, peak: 0.19 });
    v.tone({ t, type: "sine", f: 2093, attack: 0.001, decay: 0.03, peak: 0.055 });
    return 0.24;
  },
  promote(v, t) {
    v.tone({ t, type: "triangle", f: 523.25, attack: 0.008, decay: 0.15, peak: 0.17 });
    v.tone({ t: t + 0.13, type: "triangle", f: 783.99, attack: 0.008, decay: 0.24, peak: 0.17 });
    return 0.4;
  },
  reject(v, t) {
    v.tone({ t, type: "triangle", f: 466.16, attack: 0.012, decay: 0.17, peak: 0.13, lowpass: 1200 });
    v.tone({ t: t + 0.15, type: "triangle", f: 349.23, attack: 0.012, decay: 0.26, peak: 0.13, lowpass: 1200 });
    return 0.45;
  },
};

function voiceKit(ac, out, onSource) {
  let noiseBuffer = null;
  const noiseOf = () => {
    if (noiseBuffer) return noiseBuffer;
    noiseBuffer = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let state = 12345;
    for (let i = 0; i < data.length; i++) {
      state = (Math.imul(state, 1103515245) + 12345) >>> 0;
      data[i] = state / 2147483648 - 1;
    }
    return noiseBuffer;
  };
  const envelope = (param, t, attack, decay, peak) => {
    param.setValueAtTime(0, t);
    param.linearRampToValueAtTime(peak, t + attack);
    param.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    param.setValueAtTime(0, t + attack + decay + 0.004);
  };
  return {
    tone({ t, type = "sine", f, fTo, glide, attack = 0.005, decay = 0.1, peak = 0.2, lowpass, vibrato }) {
      const end = t + attack + decay + 0.03;
      const osc = ac.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(f, t);
      if (fTo) osc.frequency.exponentialRampToValueAtTime(fTo, t + (glide ?? attack + decay));
      if (vibrato) {
        const lfo = ac.createOscillator();
        const depth = ac.createGain();
        lfo.frequency.value = vibrato.rate;
        depth.gain.setValueAtTime(vibrato.depth, t);
        depth.gain.linearRampToValueAtTime(0, t + vibrato.settle);
        lfo.connect(depth).connect(osc.frequency);
        lfo.start(t);
        lfo.stop(end);
        onSource(lfo);
      }
      const gain = ac.createGain();
      envelope(gain.gain, t, attack, decay, peak);
      let node = osc;
      if (lowpass) {
        const filter = ac.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = lowpass;
        osc.connect(filter);
        node = filter;
      }
      node.connect(gain).connect(out);
      osc.start(t);
      osc.stop(end);
      onSource(osc);
    },
    noise({ t, dur, peak, band, bandTo, q = 1, lowpass, attack = 0.003 }) {
      const src = ac.createBufferSource();
      src.buffer = noiseOf();
      const filter = ac.createBiquadFilter();
      if (lowpass) {
        filter.type = "lowpass";
        filter.frequency.value = lowpass;
      } else {
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(band, t);
        if (bandTo) filter.frequency.exponentialRampToValueAtTime(bandTo, t + dur);
        filter.Q.value = q;
      }
      const gain = ac.createGain();
      envelope(gain.gain, t, attack, dur, peak);
      src.connect(filter).connect(gain).connect(out);
      src.start(t);
      src.stop(t + attack + dur + 0.03);
      onSource(src);
    },
  };
}

function masterChain(ac, level) {
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -20;
  comp.knee.value = 12;
  comp.ratio.value = 4;
  comp.attack.value = 0.003;
  comp.release.value = 0.15;
  const master = ac.createGain();
  master.gain.value = level;
  master.connect(comp).connect(ac.destination);
  return master;
}

export async function renderOffline(op, { sampleRate = 44100, level = 0.5 } = {}) {
  const Offline = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  const ac = new Offline(1, Math.round(sampleRate * 0.8), sampleRate);
  const master = masterChain(ac, level);
  VOICES[op](voiceKit(ac, master, () => {}), 0.02);
  const buffer = await ac.startRendering();
  return buffer.getChannelData(0);
}

const KEY = "rsi-lab.sonido";
function loadPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (raw && typeof raw.volume === "number") return { volume: Math.max(0, Math.min(1, raw.volume)), muted: !!raw.muted, wanted: !!raw.wanted };
  } catch {}
  return { volume: 0.5, muted: false, wanted: false };
}
function savePrefs(prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {}
}

export function makeSound() {
  const prefs = loadPrefs();
  const sources = new Set();
  const lastAt = new Map();
  const log = [];
  let ac = null;
  let master = null;
  let kit = null;
  let enabled = false;
  const listeners = new Set();
  const notify = () => listeners.forEach((fn) => fn());
  const level = () => (prefs.muted ? 0 : prefs.volume * 0.9);
  const track = (src) => {
    sources.add(src);
    src.onended = () => sources.delete(src);
  };
  function ensure() {
    if (ac) return true;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return false;
    ac = new AC();
    master = masterChain(ac, level());
    kit = voiceKit(ac, master, track);
    return true;
  }
  function setLevel(ramp = 0.03) {
    if (!ac) return;
    const now = ac.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(level(), now + ramp);
  }
  const api = {
    prefs,
    log,
    get enabled() {
      return enabled;
    },
    get state() {
      return ac ? ac.state : "sin crear";
    },
    onChange(fn) {
      listeners.add(fn);
    },
    async enable() {
      if (!ensure()) return false;
      try {
        await ac.resume();
      } catch {}
      enabled = true;
      prefs.wanted = true;
      savePrefs(prefs);
      setLevel();
      notify();
      return true;
    },
    disable() {
      api.stopAll();
      enabled = false;
      prefs.wanted = false;
      savePrefs(prefs);
      if (ac) ac.suspend().catch(() => {});
      notify();
    },
    setVolume(value) {
      prefs.volume = Math.max(0, Math.min(1, value));
      savePrefs(prefs);
      setLevel();
      notify();
    },
    setMuted(muted) {
      prefs.muted = !!muted;
      savePrefs(prefs);
      if (prefs.muted) api.stopAll();
      setLevel(0.02);
      notify();
    },
    play(op, { delay = 0, id = "" } = {}) {
      const entry = { op, id, at: performance.now(), played: false, reason: "" };
      log.push(entry);
      if (log.length > 400) log.shift();
      if (!VOICES[op]) return (entry.reason = "desconocida"), false;
      if (!enabled || !ac || ac.state !== "running") return (entry.reason = "sonido desactivado"), false;
      if (prefs.muted) return (entry.reason = "silenciado"), false;
      const now = ac.currentTime;
      const when = now + 0.012 + Math.min(1.5, delay);
      if ((lastAt.get(op) ?? -1) > when - 0.09) return (entry.reason = "demasiado seguido"), false;
      if (sources.size > 28) return (entry.reason = "demasiadas voces"), false;
      VOICES[op](kit, when);
      lastAt.set(op, when);
      entry.played = true;
      return true;
    },
    stopAll() {
      if (!ac) return;
      const now = ac.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0, now + 0.05);
      for (const src of sources) {
        try {
          src.stop(now + 0.06);
        } catch {}
      }
      sources.clear();
      lastAt.clear();
      master.gain.setValueAtTime(0, now + 0.07);
      master.gain.linearRampToValueAtTime(level(), now + 0.1);
      log.push({ op: "silencio", at: performance.now(), played: false, reason: "cancelar" });
    },
    preview(op) {
      return api.play(op, { id: "leyenda" });
    },
    activeVoices: () => sources.size,
  };
  return api;
}
