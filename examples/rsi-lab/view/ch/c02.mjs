import { baseVisibility, explode, trayCamera, rackCamera, trayRegion, cutAbove, fade } from "../common.mjs";
import { VOCAB, tokenize } from "../../model/tokenizer.mjs";
import { f2, f3, esc, T } from "../helpers.mjs";
import { el } from "../ui.mjs";

const cards = (n) => Array.from({ length: 10 }, (_, i) => `card${i}`).slice(0, n);

export function rackSetup(ctx) {
  baseVisibility(ctx, { rack: true });
  explode(ctx, 1);
  ctx.theta(ctx.store.print0, "inferencia: sin cambios");
  for (const id of ["head-b0-0", "head-b0-1", "head-b1-0", "head-b1-1"]) ctx.state(id, { open: 0 });
}

function vocabTable(ids) {
  const used = new Set(ids);
  return `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:2px 10px;font:11.5px var(--mono)">${VOCAB.map((s, i) => `<span style="color:${used.has(i) ? "var(--c-in)" : "var(--ink-3)"}">${String(i).padStart(2, " ")} <b style="color:${used.has(i) ? "var(--ink)" : "var(--ink-2)"};font-weight:500">${esc(s)}</b></span>`).join("")}</div>`;
}

export function tokenDesk(ctx, desk) {
  const input = el("input", { type: "text", value: ctx.user.text, "aria-label": "Texto de entrada (vocabulario de juguete)", style: "flex:1;min-width:120px;background:var(--panel-2);border:1px solid var(--line-2);border-radius:5px;padding:3px 6px;font:12px var(--mono)" });
  const status = el("div", { class: "note" });
  const selects = el("div", { class: "row" });
  const draw = () => {
    const pieces = tokenize(ctx.user.text);
    const bad = pieces.filter((p) => p.id < 0);
    const ids = ctx.store.ids();
    status.innerHTML = bad.length ? `<span class="bad-t">Símbolos fuera del vocabulario ignorados: ${bad.map((p) => esc(p.symbol)).join(" ")}</span>` : `${ids.length} tokens · vocabulario de juguete de 16 símbolos`;
    selects.innerHTML = "";
    ids.forEach((id, i) => {
      const sel = el("select", { "aria-label": `Token en la posición ${i}`, style: "background:var(--panel-2);border:1px solid var(--line-2);border-radius:4px;font:11px var(--mono);padding:1px" });
      VOCAB.forEach((s, j) => sel.append(el("option", { value: j, selected: j === id }, s)));
      sel.addEventListener("change", () => {
        const next = [...ctx.store.ids()];
        next[i] = Number(sel.value);
        ctx.user.tokens = next;
        ctx.user.text = next.map((j) => VOCAB[j]).join(" ");
        input.value = ctx.user.text;
        recompute(ctx);
        draw();
      });
      selects.append(sel);
    });
  };
  input.addEventListener("change", () => {
    ctx.user.text = input.value;
    ctx.user.tokens = null;
    recompute(ctx);
    draw();
  });
  desk.append(el("div", { class: "row" }, el("label", {}, "texto"), input), selects, status, el("div", { class: "note" }, "Cambiar un token recalcula todos los objetos que dependen de él: X₀, Q, K, V, A, logits… Los pesos no cambian."));
  draw();
}

import { TRAY, TRAY_Z } from "../rack.mjs";
const edge = (which) => {
  const spots = { E: [6 + 32, 4], P: [6 + 20, 40], X0: [104 + 12, 4] };
  const [x, y] = spots[which];
  return [TRAY.x + x, TRAY.y + y, TRAY_Z.emb + 4];
};

export function recompute(ctx) {
  for (const [id] of ctx.engine.objects) if (/^(mx-X0|card|t-|vec-|bars-out|card-next|mx-Wu)/.test(id)) ctx.engine.dirty(id);
  ctx.say(`Tokens: ${ctx.store.ids().map((id) => VOCAB[id]).join(" ")}. Se recalcularon las activaciones.`);
  ctx.refresh();
}

export const chapter2 = {
  title: "De tokens a representaciones",
  question: "¿Qué recibe el modelo y cómo se convierte un texto en vectores?",
  setup(ctx) {
    rackSetup(ctx);
    cutAbove(ctx, "emb");
  },
  desk(ctx) {
    ctx.desk("Entrada (vocabulario de juguete)", (desk) => tokenDesk(ctx, desk));
  },
  beats: [
    {
      id: "2.1",
      dur: 7,
      scale: "model",
      camera: () => trayRegion("emb", [0, 0, 186, 96], { pad: 30, area: { left: 0, right: 300 } }),
      caption: (ctx) => `Entrada breve: <b>«${esc(ctx.user.text)}»</b>. Se usará un vocabulario <b>de juguete</b> de 16 símbolos, no la tokenización de un modelo comercial.`,
      changed: { contexto: "cambió" },
      more: (ctx) => `<p>El vocabulario completo, con su identificador:</p>${vocabTable(ctx.store.ids())}<p>La segmentación es codiciosa: en cada posición se toma el símbolo más largo del vocabulario que coincide, ignorando espacios.</p>`,
      pose(ctx, t) {
        cutAbove(ctx, "emb", ctx.still.matches ? 1 : Math.min(1, t * 2.2));
        ctx.show(cards(10), false);
        ctx.state("mx-X0", { upto: 0 });
        ctx.focus(["tray-emb", "tray-emb-front"]);
        ctx.tag("t-text", "tray-emb", `«${esc(ctx.user.text)}»`, { d: [40, 50, 18], cls: "name", role: "in" });
      },
    },
    {
      id: "2.2",
      dur: 8,
      events: 6,
      scale: "model",
      camera: () => trayRegion("emb", [0, 0, 186, 96], { pad: 30, area: { left: 0, right: 300 } }),
      caption: (ctx) => {
        const ids = ctx.store.ids();
        const e = Math.min(ids.length, Math.max(1, ctx.event));
        return `Segmentación: ${ids.slice(0, e).map((id) => `<b>${esc(VOCAB[id])}</b>`).join(" · ")}${e < ids.length ? " · …" : ""}`;
      },
      changed: { contexto: "cambió" },
      pose(ctx, t, e) {
        const n = ctx.store.ids().length;
        const shown = Math.min(n, Math.ceil((t * 6 * n) / 6));
        cards(10).forEach((id, i) => ctx.pose(id, { visible: i < shown, state: { showId: false, lit: i === shown - 1 } }));
        ctx.state("mx-X0", { upto: 0 });
        ctx.focus(["tray-emb", ...cards(n)]);
      },
    },
    {
      id: "2.3",
      dur: 7,
      scale: "model",
      camera: () => trayRegion("emb", [0, 0, 186, 96], { pad: 30, area: { left: 0, right: 300 } }),
      caption: (ctx) => `Cada token se reemplaza por su <b>identificador</b> entero: ${ctx.store.ids().map((id) => `${esc(VOCAB[id])}→<b>${id}</b>`).join(", ")}.`,
      changed: { contexto: "cambió" },
      more: (ctx) => `<p>El identificador es sólo un índice en la tabla del vocabulario:</p>${vocabTable(ctx.store.ids())}`,
      pose(ctx) {
        const n = ctx.store.ids().length;
        cards(10).forEach((id, i) => ctx.pose(id, { visible: i < n, state: { showId: true } }));
        ctx.state("mx-X0", { upto: 0 });
        ctx.focus(["tray-emb", ...cards(n)]);
        ctx.panel("vocab", { title: "Vocabulario de juguete (16)", html: vocabTable(ctx.store.ids()), provKind: "ilus", provText: "vocabulario inventado", width: 300, dock: "right", top: 96 });
      },
    },
    {
      id: "2.4",
      dur: 12,
      events: 6,
      scale: "model",
      camera: () => trayRegion("emb", [0, 0, 186, 96], { pad: 20, area: { left: 340 } }),
      caption: (ctx) => {
        const ids = ctx.store.ids();
        const i = Math.min(ids.length - 1, Math.max(0, ctx.event - 1));
        return `Búsqueda en la tabla de embeddings: la fila <b>E[${ids[i]}]</b> (violeta, parámetro) se copia como vector de «${esc(VOCAB[ids[i]])}» (cian, activación).`;
      },
      changed: { contexto: "cambió" },
      more: `<p>Una búsqueda en la tabla equivale a multiplicar un vector one-hot del token por E: sólo sobrevive una fila. E es un <b>parámetro</b> (violeta); la fila copiada pasa a ser una <b>activación</b> (cian).</p><p>Pasa el puntero por las celdas para ver sus valores.</p>`,
      pose(ctx, t, e) {
        const ids = ctx.store.ids();
        const n = ids.length;
        const upto = Math.min(n, Math.ceil(t * n));
        const i = Math.max(0, upto - 1);
        cards(10).forEach((id, j) => ctx.pose(id, { visible: j < n, state: { showId: true, lit: j === i } }));
        ctx.state("mx-E", { rowHi: ids[i] });
        const tr = ctx.store.trace();
        ctx.state("mx-X0", { upto, values: tr.tok, rowHi: i });
        ctx.engine.objects.get("mx-X0").cell = (r, c) => ({ title: `vector del token ${r}: E[${ids[r]}][${c}] = ${f3(tr.tok[r][c])}`, rows: [["operación", `copiar la fila ${ids[r]} de E`], ["token", VOCAB[ids[r]]]] });
        ctx.focus(["mx-E", "mx-X0", `card${i}`]);
        ctx.tag("lbl-E", "mx-E", "E · 16×8 · parámetro", { local: edge("E"), role: "w" });
        ctx.tag("lbl-X0", "mx-X0", "vectores de token · n×8", { local: edge("X0"), role: "in" });
        ctx.panel("f-emb", { title: "Búsqueda", provKind: "local", html: `<div class="formula">${T("x", "in")}<sub>${i}</sub> = ${T("E", "w")}[${T(String(ids[i]), "in")}]</div><div class="subst">${tr.tok[i].map(f2).join("  ")}</div>`, width: 330 });
      },
    },
    {
      id: "2.5",
      dur: 10,
      events: 6,
      scale: "model",
      camera: () => trayRegion("emb", [0, 0, 186, 96], { pad: 20, area: { left: 340 } }),
      caption: (ctx) => {
        const i = Math.min(ctx.store.ids().length - 1, Math.max(0, ctx.event - 1));
        return `Posición: se suma la fila <b>P[${i}]</b>. X₀[${i}] = E[id] + P[${i}]. Así el mismo token en otra posición da otro vector.`;
      },
      changed: { contexto: "cambió" },
      pose(ctx, t, e) {
        const ids = ctx.store.ids();
        const n = ids.length;
        const upto = Math.min(n, Math.ceil(t * n));
        const i = Math.max(0, upto - 1);
        const tr = ctx.store.trace();
        const mixed = tr.X0.map((row, r) => (r < upto ? row : tr.tok[r]));
        cards(10).forEach((id, j) => ctx.pose(id, { visible: j < n, state: { showId: true, lit: j === i } }));
        ctx.state("mx-P", { rowHi: i });
        ctx.state("mx-E", {});
        ctx.state("mx-X0", { values: mixed, rowHi: i });
        ctx.engine.objects.get("mx-X0").cell = (r, c) => ({ title: `X₀[${r},${c}] = ${f3(mixed[r][c])}`, rows: [["E[id][c]", f3(tr.tok[r][c])], ["P[t][c]", r < upto ? f3(tr.pos[r][c]) : "aún no sumado"], ["operación", "suma elemento a elemento"]] });
        ctx.focus(["mx-P", "mx-X0"]);
        ctx.tag("lbl-P", "mx-P", "P · 10×8 · posiciones", { local: edge("P"), role: "w" });
        ctx.tag("lbl-X0", "mx-X0", "X₀ = E[ids] + P", { local: edge("X0"), role: "in" });
        ctx.panel("f-pos", { title: "Suma de posición", provKind: "local", html: `<div class="formula">${T("X", "in")}<sub>0</sub>[${i}] = ${T("E", "w")}[${ids[i]}] + ${T("P", "w")}[${i}]</div><div class="subst">${tr.X0[i].map(f2).join("  ")}</div>`, width: 330 });
      },
    },
    {
      id: "2.6",
      dur: 9,
      scale: "model",
      camera: () => rackCamera(1),
      caption: "X₀ (n×8) entra al flujo residual del bloque 1. <b>Prueba</b>: cambia un token en la mesa de control y observa qué se recalcula. Con pesos aleatorios no hay comprensión lingüística.",
      changed: { contexto: "cambió" },
      more: `<p><b>Dimensiones</b>: n tokens × d_model = 8. La anchura 8 se mantiene a lo largo de todo el flujo residual.</p><p>Los pesos de este Transformer son aleatorios (semilla 7). Sus predicciones no implican comprensión: sirven para mostrar mecanismos con números reales.</p>`,
      pose(ctx, t) {
        cutAbove(ctx, "emb", ctx.still.matches ? 0 : 1 - Math.min(1, t * 2));
        const n = ctx.store.ids().length;
        cards(10).forEach((id, j) => ctx.pose(id, { visible: j < n, state: { showId: false } }));
        ctx.state("mx-X0", {});
        ctx.state("mx-P", {});
        ctx.focus(["tray-emb", "mx-X0", "tray-b0", "blk-b0", "vec-b0"]);
        ctx.state("vec-b0", { which: "X", x: 140 });
        ctx.tag("lbl-X0b", "mx-X0", "X₀", { local: edge("X0"), role: "in" });
      },
    },
  ],
};
