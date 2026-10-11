// Utilidades de presentación compartidas por los capítulos: números, fórmulas, procedencia,
// tablas y gráficos SVG 2D (planos legibles).
export const f2 = (v) => (v === -Infinity ? "−∞" : v === Infinity ? "∞" : Number.isNaN(v) ? "NaN" : (v < 0 ? "−" : "") + Math.abs(v).toFixed(2));
export const f3 = (v) => (v === -Infinity ? "−∞" : (v < 0 ? "−" : "") + Math.abs(v).toFixed(3));
export const pct = (v) => `${(v * 100).toFixed(0)} %`;
export const pct1 = (v) => `${(v * 100).toFixed(1)} %`;
export const sgn = (v) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2);
export const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const PROV = {
  local: "cálculo local verificable",
  cita: "resultado externo citado",
  sim: "simulación conceptual",
  ilus: "dato ilustrativo",
};
export const prov = (kind, extra = "") => `<span class="prov" data-p="${kind}" title="Procedencia: ${PROV[kind]}">${PROV[kind]}${extra ? ` · ${extra}` : ""}</span>`;

// Término de fórmula vinculado a un objeto de la escena (data-ref) y a un rol de color.
export const T = (text, role = "", ref = "", on = false) => `<span class="t ${role}${on ? " on" : ""}"${ref ? ` data-ref="${ref}"` : ""}>${text}</span>`;

export function table(head, rows, { on = -1 } = {}) {
  return `<table class="tbl"><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((row, i) => `<tr${i === on ? ' class="on"' : ""}>${row.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

// Gráfico de líneas: series = [{ values, cls, label }]; marcador opcional en x = cursor.
export function lineChart(series, { w = 360, h = 150, xLabel = "", yLabel = "", yMax, yMin = 0, cursor, marks = [], xTicks } = {}) {
  const pad = { l: 34, r: 8, t: 8, b: 24 };
  const n = Math.max(...series.map((s) => s.values.length));
  const all = series.flatMap((s) => s.values.filter(Number.isFinite));
  const top = yMax ?? Math.max(1e-9, ...all) * 1.05;
  const X = (i) => pad.l + (i / Math.max(1, n - 1)) * (w - pad.l - pad.r);
  const Y = (v) => pad.t + (1 - (Math.min(top, Math.max(yMin, v)) - yMin) / (top - yMin)) * (h - pad.t - pad.b);
  const out = [`<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(yLabel)} frente a ${esc(xLabel)}">`];
  for (let g = 0; g <= 4; g++) {
    const v = yMin + ((top - yMin) * g) / 4;
    out.push(`<line class="grid" x1="${pad.l}" x2="${w - pad.r}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${pad.l - 4}" y="${Y(v) + 3}" text-anchor="end">${v.toFixed(top - yMin < 2 ? 2 : 1)}</text>`);
  }
  out.push(`<path class="ax" d="M${pad.l} ${pad.t}V${h - pad.b}H${w - pad.r}"/>`);
  const ticks = xTicks || [0, Math.floor((n - 1) / 2), n - 1];
  for (const t of ticks) out.push(`<text x="${X(t)}" y="${h - pad.b + 13}" text-anchor="middle">${t}</text>`);
  out.push(`<text x="${w - pad.r}" y="${h - 2}" text-anchor="end">${esc(xLabel)}</text><text x="2" y="${pad.t - 1}" text-anchor="start">${esc(yLabel)}</text>`);
  for (const s of series) {
    const pts = s.values.map((v, i) => (Number.isFinite(v) ? `${X(i).toFixed(1)},${Y(v).toFixed(1)}` : null)).filter(Boolean);
    out.push(`<polyline class="ln ${s.cls}" points="${pts.join(" ")}"/>`);
    if (s.dots) s.values.forEach((v, i) => Number.isFinite(v) && out.push(`<circle class="dot" cx="${X(i)}" cy="${Y(v)}" r="2.2" fill="currentColor" style="color:${s.dots}"/>`));
  }
  for (const m of marks) out.push(`<circle cx="${X(m.i)}" cy="${Y(m.v)}" r="3.4" fill="none" stroke="${m.color || "#fff"}" stroke-width="1.2"/>${m.text ? `<text x="${X(m.i) + 5}" y="${Y(m.v) - 5}" style="fill:${m.color || "#ddd"}">${esc(m.text)}</text>` : ""}`);
  if (cursor !== undefined) out.push(`<line class="cur" x1="${X(cursor)}" x2="${X(cursor)}" y1="${pad.t}" y2="${h - pad.b}"/>`);
  out.push("</svg>");
  return out.join("");
}

// Barras horizontales simples (por ejemplo, probabilidades de una política).
export function barList(items, { max = 1, w = 300 } = {}) {
  return `<div style="display:grid;grid-template-columns:auto 1fr auto;gap:3px 8px;align-items:center;font-size:11.5px">${items
    .map((it) => `<span style="color:var(--ink-2)">${esc(it.label)}</span><span style="height:8px;background:#1b1d22;border-radius:2px;position:relative"><span style="position:absolute;left:0;top:0;bottom:0;width:${Math.max(0, Math.min(1, it.value / max)) * 100}%;background:var(--c-${it.role || "in"});border-radius:2px;opacity:${it.dim ? 0.4 : 1}"></span></span><span class="kv">${it.text ?? it.value.toFixed(2)}</span>`)
    .join("")}</div>`;
}
