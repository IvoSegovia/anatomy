// Motor de escena: proyección isométrica del kit Anatomy + cámara + objetos + etiquetas.
// La geometría se construye con el kit a escala base (BASE) y la cámara aplica zoom/desplazamiento
// como transformación 2D. Girar (acimut/elevación) reconstruye los trazados de lo visible.
import * as k from "../../../kit/iso-kit.mjs";

export const BASE = 8;
const NS = "http://www.w3.org/2000/svg";
const UNIT = Math.sqrt(1.6);

export const lerp = (a, b, t) => a + (b - a) * t;
export const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
export const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul3 = (a, s) => [a[0] * s, a[1] * s, a[2] * s];

export function makeEngine({ stage, svg, labelLayer }) {
  const root = document.createElementNS(NS, "g");
  root.setAttribute("class", "cam");
  svg.appendChild(root);
  const layers = Array.from({ length: 5 }, (_, index) => {
    const g = document.createElementNS(NS, "g");
    g.setAttribute("data-layer", String(index));
    root.appendChild(g);
    return g;
  });
  const objects = new Map();
  const labels = new Map();
  const groupDefs = new Map();
  const cam = { target: [0, 0, 0], scale: 1.4, azimuth: 45, elevation: 30 };
  let P = { origin: [0, 0], scale: BASE, azimuth: 45, elevation: 30 };
  let rotated = true;
  let size = { w: 1, h: 1 };
  let inset = { top: 0, right: 0, bottom: 0, left: 0 };
  let orderKey = ["", "", "", "", ""];
  let lod = 1;
  let fast = false; // detalle reducido mientras se arrastra la cámara
  let lastMs = 0;

  const measure = () => {
    const box = stage.getBoundingClientRect();
    size = { w: Math.max(1, box.width), h: Math.max(1, box.height) };
    svg.setAttribute("viewBox", `0 0 ${size.w} ${size.h}`);
  };

  // Mundo → pantalla (px del escenario).
  const factor = () => cam.scale / BASE;
  const centre = () => [inset.left + (size.w - inset.left - inset.right) / 2, inset.top + (size.h - inset.top - inset.bottom) / 2];
  function toScreen(point) {
    const p = k.iso(point, P);
    const t = k.iso(cam.target, P);
    const f = factor();
    const [cx, cy] = centre();
    return [cx + (p[0] - t[0]) * f, cy + (p[1] - t[1]) * f];
  }
  const pxPerUnit = () => cam.scale * UNIT;

  function add(object) {
    const el = document.createElementNS(NS, "g");
    el.setAttribute("data-obj", object.id);
    if (object.className) el.setAttribute("class", object.className);
    if (object.role) el.setAttribute("data-role", object.role);
    const entry = { layer: 2, bias: 0, anchor: [0, 0, 0], pose: { offset: [0, 0, 0], opacity: 1, visible: true }, ...object, el, dirty: true, version: 0 };
    entry.pose = { offset: [0, 0, 0], opacity: 1, visible: true, ...(object.pose || {}) };
    layers[entry.layer].appendChild(el);
    objects.set(object.id, entry);
    return entry;
  }

  function remove(id) {
    const entry = objects.get(id);
    if (!entry) return;
    entry.el.remove();
    objects.delete(id);
  }

  // Cambia la pose de un objeto. `state` (datos que cambian la forma) obliga a reconstruir.
  function pose(id, next) {
    const entry = objects.get(id);
    if (!entry) return;
    if (next.state !== undefined) {
      entry.pose.state = next.state;
      entry.dirty = true;
    }
    for (const key of Object.keys(next)) if (key !== "state") entry.pose[key] = next[key];
  }

  function label(id, spec) {
    let entry = labels.get(id);
    if (!entry) {
      const el = document.createElement("div");
      el.className = `lbl ${spec.cls || ""}`;
      el.dataset.label = id;
      labelLayer.appendChild(el);
      entry = { el, spec: {} };
      labels.set(id, entry);
    }
    entry.spec = { ...entry.spec, ...spec };
    if (spec.html !== undefined && entry.html !== spec.html) {
      entry.el.innerHTML = spec.html;
      entry.html = spec.html;
    }
    if (spec.cls !== undefined) entry.el.className = `lbl ${spec.cls}`;
    return entry;
  }
  function unlabel(id) {
    const entry = labels.get(id);
    if (entry) entry.el.remove();
    labels.delete(id);
  }
  function clearLabels(prefix) {
    for (const id of [...labels.keys()]) if (!prefix || id.startsWith(prefix)) unlabel(id);
  }

  function setCamera(next) {
    if (next.azimuth !== undefined && next.azimuth !== cam.azimuth) rotated = true;
    if (next.elevation !== undefined && next.elevation !== cam.elevation) rotated = true;
    Object.assign(cam, next);
    cam.azimuth = Math.max(0, Math.min(90, cam.azimuth));
    cam.elevation = Math.max(18, Math.min(62, cam.elevation));
    cam.scale = Math.max(0.25, Math.min(40, cam.scale));
  }

  // Encaje: escala y objetivo para que estos puntos quepan en el área útil.
  // area: márgenes extra (px) ocupados por planos acoplados; el encuadre se centra en el resto.
  function fit(points, { pad = 24, azimuth = cam.azimuth, elevation = cam.elevation, maxScale = 40, area = {} } = {}) {
    const unit = { origin: [0, 0], scale: 1, azimuth, elevation };
    const flat = points.map((point) => k.iso(point, unit));
    const xs = flat.map(([x]) => x);
    const ys = flat.map(([, y]) => y);
    const extra = { left: 0, right: 0, top: 0, bottom: 0, ...area };
    const narrow = size.w < 760;
    if (narrow) extra.left = extra.right = 0;
    const w = size.w - inset.left - inset.right - extra.left - extra.right - pad * 2;
    const h = size.h - inset.top - inset.bottom - extra.top - extra.bottom - pad * 2;
    const scale = Math.min(maxScale, Math.min(w / Math.max(1e-6, Math.max(...xs) - Math.min(...xs)), h / Math.max(1e-6, Math.max(...ys) - Math.min(...ys))));
    // objetivo: el punto del mundo que debe quedar en el centro del escenario
    const shift = [(extra.left - extra.right) / 2 / (scale * UNIT), (extra.top - extra.bottom) / 2 / (scale * UNIT)];
    const mid = [(Math.max(...xs) + Math.min(...xs)) / 2 - shift[0] * UNIT, (Math.max(...ys) + Math.min(...ys)) / 2 - shift[1] * UNIT];
    // resolver un punto 3D que proyecte a `mid` en el plano z = media de los puntos
    const zMid = points.reduce((t, p) => t + p[2], 0) / points.length;
    const target = unproject(mid, zMid, unit);
    return { scale, target, azimuth, elevation };
  }

  function unproject([sx, sy], z, projection) {
    const { sinA, cosA, sinE, cosE, k: kk } = k.cameraOf(projection);
    // sx = (x sinA − y cosA)kk ; sy = ((x cosA + y sinA) sinE − z cosE)kk
    const a = sx / kk;
    const b = (sy / kk + z * cosE) / sinE;
    return [a * sinA + b * cosA, -a * cosA + b * sinA, z];
  }

  // Pantalla → mundo sobre un plano z (para orbitar alrededor del punto bajo el puntero).
  function screenToWorld([px, py], z = cam.target[2]) {
    const t = k.iso(cam.target, P);
    const f = factor();
    const [cx, cy] = centre();
    const local = [(px - cx) / f + t[0], (py - cy) / f + t[1]];
    return unproject(local, z, P);
  }

  function render() {
    const started = performance.now();
    if (rotated) {
      P = { origin: [0, 0], scale: BASE, azimuth: cam.azimuth, elevation: cam.elevation };
      for (const entry of objects.values()) entry.dirty = true;
      rotated = false;
    }
    const t = k.iso(cam.target, P);
    const f = factor();
    const [cx, cy] = centre();
    root.setAttribute("transform", `translate(${(cx - t[0] * f).toFixed(2)} ${(cy - t[1] * f).toFixed(2)}) scale(${f.toFixed(5)})`);
    const ppu = pxPerUnit();
    const buckets = [[], [], [], [], []];
    for (const entry of objects.values()) {
      const { pose: p } = entry;
      const shown = p.visible !== false && p.opacity > 0.005 && (!entry.minPx || ppu >= entry.minPx) && (!entry.maxPx || ppu <= entry.maxPx) && !(fast && entry.heavy);
      if (!shown) {
        if (entry.shown !== false) {
          entry.el.style.display = "none";
          entry.shown = false;
        }
        continue;
      }
      if (entry.shown === false || entry.shown === undefined) {
        entry.el.style.display = "";
        entry.shown = true;
      }
      if (entry.dirty) {
        entry.el.innerHTML = entry.build(P, p.state, entry);
        entry.dirty = false;
      }
      const off = offsetOf(entry);
      const tr = off[0] || off[1] || off[2] ? k.translateAlong(P, off) : "";
      if (tr !== entry.tr) {
        if (tr) entry.el.setAttribute("transform", tr);
        else entry.el.removeAttribute("transform");
        entry.tr = tr;
      }
      const op = p.opacity >= 0.999 ? "" : p.opacity.toFixed(3);
      if (op !== entry.op) {
        entry.el.style.opacity = op;
        entry.op = op;
      }
      const depth = k.depthOf(add3(entry.anchor, off), P) + (entry.bias || 0);
      buckets[entry.layer].push([depth, entry]);
    }
    buckets.forEach((list, index) => {
      if (index === 0) return;
      // Orden jerárquico: los miembros de un grupo se ordenan por (nivel, profundidad) y el
      // grupo entero ocupa la profundidad de su ancla entre los demás objetos.
      const groups = new Map();
      const top = [];
      for (const item of list) {
        const g = item[1].group;
        if (!g || !groupDefs.has(g)) {
          top.push(item);
          continue;
        }
        if (!groups.has(g)) {
          const def = groupDefs.get(g);
          const holder = [k.depthOf(def.anchor, P) + (def.bias || 0), null, []];
          groups.set(g, holder);
          top.push(holder);
        }
        groups.get(g)[2].push(item);
      }
      top.sort((a, b) => a[0] - b[0]);
      list.length = 0;
      for (const item of top) {
        if (item[1]) list.push(item);
        else {
          item[2].sort((a, b) => (a[1].level || 0) - (b[1].level || 0) || a[0] - b[0]);
          list.push(...item[2]);
        }
      }
      const key = list.map(([, entry]) => entry.id).join("|");
      if (key !== orderKey[index]) {
        const fragment = document.createDocumentFragment();
        for (const [, entry] of list) fragment.appendChild(entry.el);
        layers[index].appendChild(fragment);
        orderKey[index] = key;
      }
    });
    placeLabels();
    lastMs = performance.now() - started;
  }

  function offsetOf(entry) {
    let off = entry.pose.offset || [0, 0, 0];
    let parent = entry.parent ? objects.get(entry.parent) : null;
    let guard = 0;
    while (parent && guard++ < 6) {
      off = add3(off, parent.pose.offset || [0, 0, 0]);
      parent = parent.parent ? objects.get(parent.parent) : null;
    }
    return off;
  }

  function placeLabels() {
    const ppu = pxPerUnit();
    for (const [, entry] of labels) {
      const { spec, el } = entry;
      let at = spec.at;
      if (spec.obj) {
        const object = objects.get(spec.obj);
        if (!object || object.pose.visible === false || object.shown === false) {
          el.style.display = "none";
          continue;
        }
        at = add3(add3(spec.local || object.anchor, offsetOf(object)), spec.dz ? [0, 0, spec.dz] : spec.d || [0, 0, 0]);
      }
      const hidden = spec.hidden || !at || (spec.minPx && ppu < spec.minPx) || (spec.maxPx && ppu > spec.maxPx);
      if (hidden) {
        el.style.display = "none";
        continue;
      }
      const [x, y] = toScreen(at);
      const inside = x > -40 && y > -40 && x < size.w + 40 && y < size.h + 40;
      el.style.display = inside ? "" : "none";
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }
  }

  return {
    k,
    cam,
    get P() {
      return P;
    },
    objects,
    labels,
    add,
    remove,
    group(id, def) {
      groupDefs.set(id, def);
    },
    pose,
    label,
    unlabel,
    clearLabels,
    setCamera,
    fit,
    render,
    measure,
    toScreen,
    screenToWorld,
    pxPerUnit,
    setInset(next) {
      inset = { ...inset, ...next };
    },
    get size() {
      return size;
    },
    markAll() {
      for (const entry of objects.values()) entry.dirty = true;
    },
    dirty(id) {
      const entry = objects.get(id);
      if (entry) entry.dirty = true;
    },
    set lod(value) {
      lod = value;
    },
    // Activa el modo rápido sólo si el último fotograma fue costoso.
    setFast(on) {
      const next = on && lastMs > 24;
      if (next === fast) return;
      fast = next;
    },
    get lastMs() {
      return lastMs;
    },
    get lod() {
      return lod;
    },
  };
}
