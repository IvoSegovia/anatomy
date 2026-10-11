
const D = __DATA__;
const C = MODEL.CELL;
const cell = makeCell(K, G, C);
const stage = document.querySelector(".cl-stage");
const svg = stage.querySelector("svg");
const view = svg.querySelector("[data-view]");
const readout = document.querySelector("[data-readout]");
const hint = document.querySelector('[data-corner="hint"]');
const info = document.querySelector("[data-info]");
const speedInput = document.querySelector("[data-speed]");
const speedOut = document.querySelector("[data-speed-out]");
const pauseBtn = document.querySelector('[data-act="pause"]');
const followBtn = document.querySelector('[data-act="follow"]');
const wireBtn = document.querySelector('[data-act="wire"]');
const chips = [...document.querySelectorAll("[data-group-btn]")];
const status = document.querySelector("[data-status]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const { W, H } = D;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const nf = (v, d = 0) => v.toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d });

const GROUPS = {
  cinta: { name: "Cinta de rodillos", hint: "Cinta y alimentador" },
  escaner: { name: "Escáner de línea", hint: "Escáner iluminado" },
  brazo: { name: "Brazo SCARA", hint: "Brazo articulado" },
  bandejas: { name: "Bandejas de salida", hint: "Bandejas" },
  control: { name: "Armario de control", hint: "Armario y baliza" },
};
const STAGES = ["Alimentación", "Escaneo", "Clasificación", "Recogida", "Traslado", "En bandeja"];

const S = {
  tau: D.tau0,
  speed: 1,
  paused: still.matches,
  az: D.AZ, azT: D.AZ, el: D.EL, elT: D.EL,
  cx: W / 2, cy: H / 2, zoom: 1,
  focus: null,
  follow: null, followClock: 0, followDone: 0, followSummary: null,
  wire: false,
};
let P = null, Pkey = "", statics = [];
const nodes = new Map();
for (const g of [...view.children]) { nodes.set(g.dataset.id, g); g._svg = g.innerHTML; }

function camera() {
  const az = Math.round(S.az * 4) / 4, el = Math.round(S.el * 4) / 4;
  const key = `${az}|${el}`;
  if (key === Pkey) return false;
  P = cell.cameraFor(az, el, W, H);
  Pkey = key;
  statics = cell.staticItems(P);
  return true;
}

function render(order) {
  const seen = new Set();
  let cursor = view.firstChild;
  for (const it of order) {
    seen.add(it.id);
    let g = nodes.get(it.id);
    if (!g) {
      g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("class", "cl-item");
      g.dataset.id = it.id;
      nodes.set(it.id, g);
    }
    if (g.dataset.group !== it.group) g.dataset.group = it.group;
    if (g._svg !== it.svg) { g.innerHTML = it.svg; g._svg = it.svg; }
    if (cursor !== g) view.insertBefore(g, cursor);
    else cursor = cursor.nextSibling;
  }
  for (const [id, g] of nodes) if (!seen.has(id)) { g.remove(); nodes.delete(id); }
}

function groupBox(order, group) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const it of order) if (it.group === group) {
    x0 = Math.min(x0, it._bb[0]); y0 = Math.min(y0, it._bb[1]); x1 = Math.max(x1, it._bb[2]); y1 = Math.max(y1, it._bb[3]);
  }
  return [x0, y0, x1, y1];
}

let M = null, order = [];
function step(dt) {
  const calm = still.matches;
  if (!S.paused) S.tau += dt * S.speed;
  const f = calm ? 1 : 1 - Math.exp(-dt / 0.22);
  S.az += (S.azT - S.az) * f;
  S.el += (S.elT - S.el) * f;
  if (Math.abs(S.azT - S.az) < 0.02) S.az = S.azT;
  if (Math.abs(S.elT - S.el) < 0.02) S.el = S.elT;
  camera();
  M = MODEL.at(S.tau);

  if (S.follow !== null) {
    const st = MODEL.stageOf(S.follow, S.tau);
    if (!S.paused) S.followClock += dt;
    if (st.key === "tray") {
      if (!S.followDone) S.followDone = S.followClock;
      if (S.followClock - S.followDone > 1.6) {
        const d = MODEL.docOf(S.follow);
        S.followSummary = { id: d.id, tray: C.TRAYS[d.cls].name, conf: d.conf, secs: S.followDone };
        S.follow = null;
        announce(`${d.id} depositado en ${C.TRAYS[d.cls].name}.`);
      }
    }
  }

  const dyn = cell.dynamicItems(P, M, { follow: S.follow ?? undefined, paused: S.paused });
  order = cell.sortItems(statics.concat(dyn), P);
  render(order);

  // Camera target: the followed sheet, the inspected mechanism, or the whole cell.
  let tx = W / 2, ty = H / 2, tz = 1;
  if (S.follow !== null) {
    const d = M.docs.find((e) => e.n === S.follow);
    if (d) { [tx, ty] = iso([d.x, d.y, d.z], P); tz = 2.1; }
  } else if (S.focus) {
    const [x0, y0, x1, y1] = groupBox(order, S.focus);
    if (isFinite(x0)) { tx = (x0 + x1) / 2; ty = (y0 + y1) / 2; tz = clamp(Math.min(W / (x1 - x0), H / (y1 - y0)) * 0.72, 1, 2.6); }
  }
  const g = calm ? 1 : 1 - Math.exp(-dt / 0.35);
  S.cx += (tx - S.cx) * g; S.cy += (ty - S.cy) * g; S.zoom += (tz - S.zoom) * g;
  const half = (v, z, span) => clamp(v, span / (2 * z), span - span / (2 * z));
  const cx = half(S.cx, S.zoom, W), cy = half(S.cy, S.zoom, H);
  view.setAttribute("transform", `translate(${(W / 2).toFixed(2)} ${(H / 2).toFixed(2)}) scale(${S.zoom.toFixed(4)}) translate(${(-cx).toFixed(2)} ${(-cy).toFixed(2)})`);
  ui();
  return !S.paused || Math.abs(S.azT - S.az) > 0 || Math.abs(S.elT - S.el) > 0 || Math.abs(tz - S.zoom) > 0.002 || Math.hypot(tx - S.cx, ty - S.cy) > 0.2;
}

const realV = () => 0.25 * S.speed;
const perHour = () => 3600 / (C.T / S.speed);
function ui() {
  const v = realV();
  const last = M.decided;
  const text = `${nf(perHour())} doc/h · ${nf(v, 2)} m/s${last ? ` · ${last.id} → ${C.TRAYS[last.cls].name}` : ""}`;
  if (readout.textContent !== text) readout.textContent = text;
  const html = panel();
  if (info._html !== html) { info.innerHTML = html; info._html = html; }
}

const row = (k, v) => `<div class="cl-spec"><span>${k}</span><b>${v}</b></div>`;
function panel() {
  const v = realV();
  if (S.follow !== null) {
    const d = MODEL.docOf(S.follow);
    const st = MODEL.stageOf(S.follow, S.tau);
    const live = M.docs.find((e) => e.n === S.follow);
    const known = live ? live.known : st.step >= 4;
    const steps = STAGES.map((name, i) => `<li${i + 1 < st.step ? " data-done" : ""}${i + 1 === st.step ? " data-now" : ""}>${name}</li>`).join("");
    let where = st.step === 0 ? "esperando en el fondo del alimentador" : live ? `a ${nf(((C.STOP_X - live.x) * C.MM) / 10)} cm del tope` : "";
    if (live && st.step === 2) where = `${nf(live.scan * C.LINES)} de ${nf(C.LINES)} líneas leídas`;
    if (live && live.held) where = `en las ventosas a ${nf((live.z - C.TRAY_FLOOR) * C.MM)} mm sobre el fondo de bandeja`;
    const verdict = known ? `${C.TRAYS[d.cls].name} · confianza ${nf(d.conf * 100)} %${d.cls === 2 ? " (bajo el umbral del 80 %)" : ""}` : "pendiente de lectura";
    return `<div class="cl-info-head"><b>${d.id}</b><span>${d.kind === 0 ? "maquetación de póliza" : "maquetación de procedimiento"}</span></div><ol class="cl-steps">${steps}</ol>${row("Estado", st.name)}${row("Destino", verdict)}${row("Recorrido", where || "—")}${row("Tiempo", `${nf(S.followClock, 1)} s`)}`;
  }
  if (S.focus === "cinta") {
    const rpm = (v / (Math.PI * 0.04)) * 60;
    const onBelt = M.docs.filter((d) => !d.held && d.since >= 0).length;
    return head("cinta", "Cinta de dos bandas sobre 14 rodillos de Ø40 mm. Un alimentador por fricción suelta la hoja inferior bajo la compuerta (holgura de una hoja) y un tope neumático la retiene para la recogida.") + row("Velocidad de banda", `${nf(v, 2)} m/s`) + row("Rodillos", `${nf(rpm)} rpm`) + row("Hojas en la cinta", nf(onBelt)) + row("Fotocélulas", M.eyes.map((e) => (e ? "●" : "○")).join(" ")) + row("Paso entre hojas", `${nf(C.V * C.T * C.MM)} mm`);
  }
  if (S.focus === "escaner") {
    const rate = v / (25.4e-3 / C.DPI);
    const sc = M.scanning;
    return head("escaner", "Cámara de línea a 300 ppp entre dos barras LED. La luz sube cuando la hoja pasa bajo la línea; la cadencia de líneas sigue a la velocidad de la banda, así la imagen nunca se estira.") + row("Cadencia", `${nf(rate / 1000, 2)} kHz`) + row("Lectura", sc ? `${sc.id} · ${nf(sc.scan * 100)} %` : "en espera") + row("Imagen A4", "2 480 × 3 508 px") + row("Umbral de confianza", "80 %") + row("Última decisión", M.decided ? `${M.decided.id} → ${C.TRAYS[M.decided.cls].name} (${nf(M.decided.conf * 100)} %)` : "—");
  }
  if (S.focus === "brazo") {
    const deg = (r) => nf((((r * 180) / Math.PI) % 360 + 360) % 360, 0);
    return head("brazo", "Brazo SCARA de dos eslabones (260 y 230 mm) con husillo vertical y cuatro ventosas de Ø30 mm. Interpola en espacio articular y mantiene la hoja alineada con la bandeja.") + row("Hombro θ₁", `${deg(M.q[0])}°`) + row("Codo θ₂", `${deg(M.q[1])}°`) + row("Ventosas", M.vacuum ? "vacío −60 kPa" : "libres") + row("Altura de ventosas", `${nf((M.z - C.BELT_TOP) * C.MM)} mm sobre la banda`) + row("Destino", M.target >= 0 ? C.TRAYS[M.target].name : "volviendo al tope");
  }
  if (S.focus === "bandejas") {
    return head("bandejas", "Tres bandejas de 340 × 250 mm sobre pedestales. Cada depósito sube la pila 2,5 mm; la pila se vacía a las 30 hojas.") + C.TRAYS.map((t, i) => row(t.name, `${nf(M.counts[i])} hojas`)).join("");
  }
  if (S.focus === "control") {
    return head("control", "Armario con el PLC y el variador de la cinta. La baliza verde indica ciclo en marcha; ámbar, pausa.") + row("Estado", S.paused ? "en pausa" : "en marcha") + row("Ciclo", `${nf(C.T / S.speed, 2)} s`) + row("Producción", `${nf(perHour())} doc/h`) + row("Total clasificado", nf(M.counts.reduce((a, b) => a + b, 0)));
  }
  const sum = S.followSummary ? `<p class="cl-note">${S.followSummary.id} llegó a ${S.followSummary.tray} en ${nf(S.followSummary.secs, 1)} s, con ${nf(S.followSummary.conf * 100)} % de confianza.</p>` : "";
  return `<div class="cl-info-head"><b>Celda en marcha</b><span>clic en un mecanismo para inspeccionarlo</span></div>${C.TRAYS.map((t, i) => row(t.name, `${nf(M.counts[i])} hojas`)).join("")}${row("Ciclo", `${nf(C.T / S.speed, 2)} s por documento`)}${sum}`;
}
function head(g, text) {
  return `<div class="cl-info-head"><b>${GROUPS[g].name}</b><span>${text}</span></div>`;
}

// ---------------------------------------------------------------- loop
let frame = 0, last = 0, visible = false;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const going = step(dt);
  frame = visible && going ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
const announce = (text) => { status.textContent = text; };

// ---------------------------------------------------------------- controls
function setFocus(g) {
  S.focus = S.focus === g ? null : g;
  if (S.focus) S.follow = null;
  S.focus ? svg.setAttribute("data-focus", S.focus) : svg.removeAttribute("data-focus");
  chips.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.groupBtn === S.focus)));
  followBtn.setAttribute("aria-pressed", "false");
  announce(S.focus ? `Inspeccionando: ${GROUPS[S.focus].name}.` : "Vista de toda la celda.");
  run();
}
function follow() {
  if (S.follow !== null) { S.follow = null; followBtn.setAttribute("aria-pressed", "false"); announce("Seguimiento detenido."); run(); return; }
  S.follow = Math.max(0, Math.floor(S.tau / C.T) + 1);
  S.followClock = 0; S.followDone = 0; S.followSummary = null;
  S.focus = null; svg.removeAttribute("data-focus");
  chips.forEach((b) => b.setAttribute("aria-pressed", "false"));
  followBtn.setAttribute("aria-pressed", "true");
  if (S.paused) togglePause();
  announce(`Siguiendo ${MODEL.docOf(S.follow).id} desde el alimentador.`);
  run();
}
function togglePause() {
  S.paused = !S.paused;
  pauseBtn.textContent = S.paused ? "Reanudar" : "Pausa";
  pauseBtn.setAttribute("aria-pressed", String(S.paused));
  run();
}
function setSpeed(v) {
  S.speed = clamp(Math.round(v * 4) / 4, 0.25, 3);
  speedInput.value = String(S.speed);
  speedOut.textContent = `${nf(S.speed, 2)}× · ${nf(realV(), 2)} m/s`;
  run();
}
function rotate(by) { S.azT += by; run(); }
function tilt(by) { S.elT = clamp(S.elT + by, 14, 62); run(); }
function resetView() { S.azT = D.AZ + Math.round((S.azT - D.AZ) / 360) * 360; S.elT = D.EL; if (S.focus) setFocus(S.focus); run(); }
function toggleWire() {
  S.wire = !S.wire;
  S.wire ? svg.setAttribute("data-wire", "") : svg.removeAttribute("data-wire");
  wireBtn.setAttribute("aria-pressed", String(S.wire));
}

document.querySelector('[data-act="left"]').addEventListener("click", () => rotate(-45));
document.querySelector('[data-act="right"]').addEventListener("click", () => rotate(45));
document.querySelector('[data-act="reset"]').addEventListener("click", resetView);
pauseBtn.addEventListener("click", togglePause);
followBtn.addEventListener("click", follow);
wireBtn.addEventListener("click", toggleWire);
speedInput.addEventListener("input", () => setSpeed(Number(speedInput.value)));
chips.forEach((b) => b.addEventListener("click", () => setFocus(b.dataset.groupBtn)));

let drag = null;
stage.addEventListener("pointerdown", (e) => {
  drag = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
});
stage.addEventListener("pointermove", (e) => {
  if (drag && e.pointerId === drag.id) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) > 4) { drag.moved = true; stage.setPointerCapture(e.pointerId); stage.dataset.dragging = ""; }
    if (drag.moved) {
      const box = svg.getBoundingClientRect();
      const k = 360 / box.width;
      S.azT -= dx * k * 0.6;
      if (e.pointerType !== "touch") tilt(dy * 0.18);
      drag.x = e.clientX; drag.y = e.clientY;
      run();
    }
    return;
  }
  const g = e.target.closest?.(".cl-item");
  const name = g && GROUPS[g.dataset.group] ? `${GROUPS[g.dataset.group].hint} · clic para inspeccionar` : "Arrastra para girar · clic para inspeccionar";
  if (hint.textContent !== name) hint.textContent = name;
});
const end = (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  if (!drag.moved && e.type === "pointerup") {
    const g = e.target.closest?.(".cl-item");
    const grp = g && GROUPS[g.dataset.group] ? g.dataset.group : null;
    if (grp) setFocus(grp);
    else if (S.focus) setFocus(S.focus);
  }
  delete stage.dataset.dragging;
  drag = null;
};
stage.addEventListener("pointerup", end);
stage.addEventListener("pointercancel", end);
stage.addEventListener("pointerleave", () => { hint.textContent = "Arrastra para girar · clic para inspeccionar"; });
stage.addEventListener("keydown", (e) => {
  const map = {
    ArrowLeft: () => rotate(e.shiftKey ? -45 : -15), ArrowRight: () => rotate(e.shiftKey ? 45 : 15),
    ArrowUp: () => tilt(5), ArrowDown: () => tilt(-5),
    " ": togglePause, f: follow, F: follow, w: toggleWire, W: toggleWire, Home: resetView,
    "+": () => setSpeed(S.speed + 0.25), "-": () => setSpeed(S.speed - 0.25),
    1: () => setFocus("cinta"), 2: () => setFocus("escaner"), 3: () => setFocus("brazo"), 4: () => setFocus("bandejas"), 5: () => setFocus("control"),
    Escape: () => { if (S.follow !== null) follow(); else if (S.focus) setFocus(S.focus); },
  };
  const act = map[e.key];
  if (!act) return;
  e.preventDefault();
  act();
});
still.addEventListener?.("change", () => run());
pauseBtn.textContent = S.paused ? "Reanudar" : "Pausa";
pauseBtn.setAttribute("aria-pressed", String(S.paused));
setSpeed(1);
step(0);
