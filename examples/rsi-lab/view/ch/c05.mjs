import { explode, trayRegion, rackCamera, cutAbove } from "../common.mjs";
import { f2, f3, T, esc, lineChart, prov } from "../helpers.mjs";
import { el } from "../ui.mjs";
import { rackSetup } from "./c02.mjs";
import { VOCAB } from "../../model/tokenizer.mjs";
import { lossAndGrad, headPrint, headOf, flatHead, ADAM } from "../../model/train.mjs";
import { argmax } from "../../model/transformer.mjs";

const run = (ctx) => ctx.store.training();
const stepOf = (ctx) => Math.max(0, Math.min(40, ctx.user.trainStep));
const exOf = (ctx) => run(ctx).train[Math.min(5, ctx.user.example)];

function showHead(ctx, head, ex, { target = true, gradient = null } = {}) {
  const { each } = lossAndGrad(head, [ex]);
  const e = each[0];
  ctx.state("mx-Wu", { values: head.Wu, role: "w" });
  ctx.state("bars-out", { logits: e.z, probs: e.p, target: target ? ex.target : undefined, chosen: argmax(e.p), showLogits: true, showProbs: true });
  ctx.state("mx-gWu", { values: gradient });
  ctx.show("mx-gWu", !!gradient);
  return e;
}

function trainPanel(ctx, active, subst) {
  const on = (k) => active.includes(k);
  const opt = ctx.user.optimizer;
  const html = `<div class="formula">
    <div>${T("L", "bad", "", on("L"))} = −log ${T("p", "in", "", on("L"))}(objetivo)</div>
    <div>${T("g", "g", "mx-gWu", on("g"))} = ∇<sub>θ</sub> L &nbsp;(retropropagación)</div>
    <div>${opt === "sgd" ? `${T("θ'", "w", "", on("upd"))} = ${T("θ", "w")} − ${T("η", "g", "", on("upd"))}${T("g", "g")} &nbsp;<span style="font-size:12px;color:var(--ink-3)">(SGD)</span>` : `${T("θ'", "w", "", on("upd"))} = ${T("θ", "w")} − ${T("η", "g", "", on("upd"))} ${T("m̂", "g", "", on("adam"))} / (√${T("v̂", "g", "", on("adam"))} + ε) &nbsp;<span style="font-size:12px;color:var(--ink-3)">(Adam)</span>`}</div></div>
    <div class="subst">${subst || ""}</div>`;
  ctx.panel("train", { title: `Entrenamiento de la cabeza · ${opt === "sgd" ? "SGD" : "Adam"} · η = ${ctx.user.eta}`, provKind: "local", html, width: 400 });
}

function curves(ctx, cursor, { opt = ctx.user.optimizer, eta = ctx.user.eta, title = "Pérdida por paso" } = {}) {
  const r = ctx.store.training(opt, eta);
  const tr = r.history.map((h) => h.train);
  const va = r.history.map((h) => h.valid);
  const vmin = va.indexOf(Math.min(...va));
  const cap = Math.min(8, Math.max(...tr.slice(0, 3), ...va.slice(0, 3)) * 1.1);
  const chart = lineChart([{ values: tr, cls: "tr" }, { values: va, cls: "va" }], { w: 380, h: 160, xLabel: "paso", yLabel: "pérdida (nats)", yMax: cap, cursor, marks: [{ i: vmin, v: va[vmin], color: "#e7e8ea", text: `mín. validación (paso ${vmin})` }], xTicks: [0, 10, 20, 30, 40] });
  ctx.panel("curves", { title, provKind: "local", html: `${chart}<div class="legend"><span style="color:var(--c-in)"><i></i>entrenamiento (6 ejemplos)</span><span style="color:#e7e8ea"><i style="background:none;border-top:2px dashed #e7e8ea;height:0"></i>validación (4 ejemplos separados)</span></div>`, width: 410, top: 300 });
}

export const chapter5 = {
  title: "Cómo cambian realmente los pesos",
  question: "¿Qué diferencia hay entre usar un modelo y entrenarlo?",
  setup(ctx) {
    rackSetup(ctx);
    cutAbove(ctx, "out");
    ctx.state("card-next", {});
  },
  exit(ctx) {
    ctx.show("mx-gWu", false);
    ctx.state("mx-Wu", {});
    ctx.state("bars-out", {});
    ctx.theta(ctx.store.print0, "sin cambios");
  },
  desk(ctx) {
    ctx.desk("Entrenamiento", (desk) => {
      const seg = el("div", { class: "seg", role: "group", "aria-label": "Optimizador" });
      ["sgd", "adam"].forEach((name) => {
        const b = el("button", { "aria-pressed": ctx.user.optimizer === name ? "true" : "false" }, name === "sgd" ? "SGD" : "Adam");
        b.addEventListener("click", () => {
          ctx.user.optimizer = name;
          ctx.user.eta = name === "adam" ? 0.05 : 0.5;
          seg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
          sync();
          ctx.refresh();
        });
        seg.append(b);
      });
      const etaVal = el("span", { class: "val" });
      const eta = el("input", { type: "range", min: "-2", max: "0.6", step: "0.01", "aria-label": "Tasa de aprendizaje η (escala logarítmica)" });
      eta.addEventListener("input", () => {
        ctx.user.eta = Number((10 ** Number(eta.value)).toPrecision(2));
        etaVal.textContent = ctx.user.eta;
        ctx.refresh();
      });
      const stepVal = el("span", { class: "val" });
      const step = el("input", { type: "range", min: "0", max: "40", step: "1", "aria-label": "Paso de entrenamiento" });
      step.addEventListener("input", () => {
        ctx.user.trainStep = Number(step.value);
        stepVal.textContent = ctx.user.trainStep;
        ctx.refresh();
      });
      const ex = el("select", { "aria-label": "Ejemplo de entrenamiento", style: "background:var(--panel-2);border:1px solid var(--line-2);border-radius:4px;font:11px var(--mono)" });
      run(ctx).train.forEach((e, i) => ex.append(el("option", { value: i }, `${e.text} → ${VOCAB[e.target]}`)));
      ex.addEventListener("change", () => {
        ctx.user.example = Number(ex.value);
        ctx.refresh();
      });
      const again = el("button", { class: "btn" }, "repetir desde θ₀ (semilla fija)");
      again.addEventListener("click", () => {
        ctx.user.trainStep = 0;
        sync();
        ctx.refresh();
      });
      const sync = () => {
        eta.value = String(Math.log10(ctx.user.eta));
        etaVal.textContent = ctx.user.eta;
        step.value = String(ctx.user.trainStep);
        stepVal.textContent = ctx.user.trainStep;
        ex.value = String(ctx.user.example);
      };
      ctx.syncTrainDesk = sync;
      desk.append(el("div", { class: "row" }, el("label", {}, "optimizador"), seg), el("div", { class: "row" }, el("label", {}, "η"), eta, etaVal), el("div", { class: "row" }, el("label", {}, "paso"), step, stepVal), el("div", { class: "row" }, el("label", {}, "ejemplo"), ex), el("div", { class: "row" }, again), el("div", { class: "note" }, "η es el tamaño del paso del optimizador. No tiene relación con la velocidad de reproducción de la barra inferior."));
      sync();
    });
  },
  beats: [
    {
      id: "5.1",
      dur: 9,
      events: 2,
      scale: "model",
      camera: () => rackCamera(1),
      caption: (ctx) => (ctx.event <= 1 ? "El mismo indicador de parámetros de antes: en <b>inferencia</b> (capítulos 2–4) la huella de θ no cambió nunca." : "En <b>entrenamiento</b> un procedimiento modifica θ con datos y una función objetivo. Lo veremos cambiar."),
      changed: (ctx) => (ctx.event <= 1 ? { contexto: "activo" } : { pesos: "cambiará", datos: "entrenamiento" }),
      pose(ctx, t, e) {
        ctx.theta(ctx.store.print0, e <= 1 ? "inferencia: idéntica" : "entrenamiento: va a cambiar");
        ctx.focus(["tray-out", "mx-Wu", "out-base"]);
        ctx.tag("lb-frozen0", "tray-b1", "cuerpo congelado", { dz: 12, role: "off" });
      },
    },
    {
      id: "5.2",
      dur: 7,
      scale: "model",
      camera: () => rackCamera(1),
      caption: "<b>Cambio de escala declarado</b>: entrenar todo el Transformer excede esta demostración. Se entrenan sólo γ_f, β_f, W_U y b_U: <b>160 parámetros reales</b> de la cabeza de salida. El cuerpo (1888) queda congelado.",
      changed: { pesos: "cabeza: 160", datos: "entrenamiento" },
      more: `<p>Con el cuerpo congelado, cada ejemplo produce un vector h (salida del bloque 2 en la última posición) que no cambia. Sobre él se entrena una red pequeña y diferenciable: LN (sin estadística aprendida) → γ ⊙ n + β → W_U → softmax.</p><p>Todos los gradientes, pesos y pérdidas mostrados se calculan aquí y se pueden comprobar con diferencias finitas (pestaña Verificación).</p>`,
      pose(ctx) {
        ctx.focus(["tray-out", "mx-Wu", "out-base"]);
        ctx.tag("lb-frozen", "tray-b0", "congelado · gris", { dz: 12, role: "off" });
        ctx.tag("lb-train", "mx-Wu", "entrenable: γ, β, W_U, b_U", { dz: 6, role: "w" });
        trainPanel(ctx, [], "θ_cabeza = {γ_f (8), β_f (8), W_U (8×16), b_U (16)} = 160 parámetros\nθ_cuerpo: E, P, 2 bloques = 1888 parámetros (fijos)");
      },
    },
    {
      id: "5.3",
      dur: 8,
      scale: "model",
      camera: () => trayRegion("out", [0, 0, 186, 96], { area: { left: 420 } }),
      caption: (ctx) => {
        const ex = exOf(ctx);
        const e = lossAndGrad(headOf(ctx.store.params0), [ex]).each[0];
        return `Ejemplo de entrenamiento «${esc(ex.text)}» → objetivo «${esc(VOCAB[ex.target])}» (naranja). Hoy el modelo le asigna <b>p = ${f3(e.p[ex.target])}</b>.`;
      },
      changed: { datos: "ejemplo de entrenamiento" },
      pose(ctx) {
        const ex = exOf(ctx);
        const head = run(ctx).history[0].head;
        const e = showHead(ctx, head, ex);
        ctx.focus(["bars-out", "mx-Wu"]);
        ctx.tag("lb-tgt", "bars-out", `objetivo «${esc(VOCAB[ex.target])}» · p = ${f3(e.p[ex.target])}`, { dz: 16, role: "g" });
        trainPanel(ctx, ["L"], `predicción: argmax = «${esc(VOCAB[argmax(e.p)])}»\np(objetivo «${esc(VOCAB[ex.target])}») = ${f3(e.p[ex.target])}`);
      },
    },
    {
      id: "5.4",
      dur: 7,
      scale: "model",
      camera: () => trayRegion("out", [0, 0, 186, 96], { area: { left: 420 } }),
      caption: (ctx) => {
        const ex = exOf(ctx);
        const e = lossAndGrad(headOf(ctx.store.params0), [ex]).each[0];
        return `<b>Pérdida de entropía cruzada</b>: L = −log p(objetivo) = −log ${f3(e.p[ex.target])} = <b>${f3(e.loss)}</b> nats. Si p → 1, L → 0.`;
      },
      changed: { datos: "ejemplo de entrenamiento" },
      pose(ctx) {
        const ex = exOf(ctx);
        const r = run(ctx);
        showHead(ctx, r.history[0].head, ex);
        ctx.focus(["bars-out"]);
        trainPanel(ctx, ["L"], `L(este ejemplo) = ${f3(lossAndGrad(r.history[0].head, [ex]).loss)}\nL media en los 6 de entrenamiento = ${f3(r.history[0].train)}\nL media en los 4 de validación   = ${f3(r.history[0].valid)}`);
      },
    },
    {
      id: "5.5",
      dur: 12,
      events: 3,
      scale: "model",
      camera: () => trayRegion("out", [0, 0, 186, 96], { area: { left: 420 } }),
      caption: (ctx) => ["Retropropagación, paso 1: ∂L/∂z = p − e_y. El objetivo recibe un empuje hacia arriba y los demás hacia abajo.", "Paso 2: ∂L/∂W_U = uᵀ(p − e_y), un producto exterior de 8×16 (superficie <b>naranja</b> sobre W_U).", "Paso 3: ∂L/∂γ y ∂L/∂β por la regla de la cadena. Comprobado contra diferencias finitas en los 160 parámetros."][Math.max(0, ctx.event - 1)],
      changed: { pesos: "gradiente calculado (aún sin aplicar)" },
      more: (ctx) => {
        const fd = ctx.store.finiteDiff();
        return `<p>Regla de la cadena desde la pérdida hacia los parámetros:</p><p class="kv">∂L/∂z = p − e_y<br>∂L/∂W_U = uᵀ (p − e_y)<br>∂L/∂u = W_U (p − e_y)<br>∂L/∂γ = ∂L/∂u ⊙ n &nbsp; ∂L/∂β = ∂L/∂u</p><p>Diferencias finitas centrales (h = 10⁻⁵) en los 160 parámetros: error relativo máximo <b>${fd.worst.toExponential(2)}</b>. ${prov("local")}</p>`;
      },
      pose(ctx, t, e) {
        const ex = exOf(ctx);
        const r = run(ctx);
        const head = r.history[0].head;
        const { grad, each } = lossAndGrad(head, r.train);
        const one = lossAndGrad(head, [ex]).each[0];
        showHead(ctx, head, ex, { gradient: e >= 2 ? grad.Wu : null });
        ctx.focus(e >= 2 ? ["mx-gWu", "mx-Wu"] : ["bars-out"]);
        if (e >= 2) ctx.tag("lb-g", "mx-gWu", "g = ∂L/∂W_U · naranja", { dz: 8, role: "g" });
        const dz = one.p.map((p, k) => p - (k === ex.target ? 1 : 0));
        const fd = ctx.store.finiteDiff();
        trainPanel(ctx, ["g"], e <= 1 ? `∂L/∂z (este ejemplo) = ${dz.map(f2).join(" ")}` : e === 2 ? `‖∂L/∂W_U‖ (media de 6 ejemplos) = ${Math.hypot(...grad.Wu.flat()).toFixed(3)}` : `∂L/∂γ = ${grad.g.map(f2).join(" ")}\n∂L/∂β = ${grad.b.map(f2).join(" ")}\ndiferencias finitas: error rel. máx ${fd.worst.toExponential(2)}`);
      },
    },
    {
      id: "5.6",
      dur: 9,
      events: 2,
      scale: "model",
      camera: () => trayRegion("out", [0, 0, 186, 96], { area: { left: 420 } }),
      caption: (ctx) => {
        const r = ctx.store.training("sgd", 0.5);
        return ctx.event <= 1 ? "<b>Paso de SGD</b>: θ' = θ − η·g con η = 0.5. La superficie violeta cambia y la <b>huella de θ cambia</b>." : `Pérdida de entrenamiento: ${f3(r.history[0].train)} → <b>${f3(r.history[1].train)}</b>; de validación: ${f3(r.history[0].valid)} → ${f3(r.history[1].valid)}.`;
      },
      changed: { pesos: "cambió (160)", datos: "entrenamiento" },
      pose(ctx, t, e) {
        const r = ctx.store.training("sgd", 0.5);
        const ex = exOf(ctx);
        const head = r.history[1].head;
        showHead(ctx, head, ex, { gradient: null });
        ctx.theta(r.history[1].print, `cabeza actualizada (antes ${r.history[0].print})`, true);
        ctx.focus(["mx-Wu", "bars-out"]);
        ctx.tag("lb-w", "mx-Wu", "W_U después del paso", { dz: 6, role: "w" });
        trainPanel(ctx, ["upd"], `θ_cabeza: ${r.history[0].print} → ${r.history[1].print}\nmáx |Δθ| = ${Math.max(...r.history[1].delta.map(Math.abs)).toFixed(4)}\nL entrenamiento ${f3(r.history[0].train)} → ${f3(r.history[1].train)}`);
      },
    },
    {
      id: "5.7",
      dur: 13,
      events: 4,
      scale: "model",
      camera: () => trayRegion("out", [0, 0, 186, 96], { area: { left: 420 } }),
      caption: (ctx) => {
        const r = run(ctx);
        const va = r.history.map((h) => h.valid);
        const vmin = va.indexOf(Math.min(...va));
        return ctx.event < 3 ? "Cuarenta pasos: la pérdida de entrenamiento baja en cada paso…" : `…pero la de validación deja de bajar en el paso <b>${vmin}</b> y luego sube: <b>mejorar entrenamiento no garantiza mejorar validación</b> (sobreajuste).`;
      },
      changed: { pesos: "cambió", datos: "entrenamiento (validación aparte)" },
      pose(ctx, t, e) {
        const r = run(ctx);
        const k = Math.round(Math.min(1, t) * 40);
        ctx.user.trainStep = k;
        if (ctx.syncTrainDesk) ctx.syncTrainDesk();
        showHead(ctx, r.history[k].head, exOf(ctx));
        ctx.theta(r.history[k].print, `paso ${k}`, k > 0);
        curves(ctx, k);
        trainPanel(ctx, ["upd"], `paso ${k}: L_entr = ${f3(r.history[k].train)} · L_val = ${f3(r.history[k].valid)}`);
        ctx.focus(["mx-Wu", "bars-out"]);
      },
    },
    {
      id: "5.8",
      dur: 9,
      events: 2,
      scale: "model",
      camera: () => trayRegion("out", [0, 0, 186, 96], { area: { left: 420 } }),
      caption: (ctx) => {
        const r = ctx.store.training("sgd", 1.2);
        const h = r.history.map((x) => x.train);
        const up = h.findIndex((v, i) => i > 0 && v > h[i - 1]);
        return ctx.event <= 1 ? `Con <b>η = 1.2</b>, el paso ${up} <b>empeora</b> la pérdida de entrenamiento (${f3(h[up - 1])} → ${f3(h[up])}): el paso se pasa del mínimo. Después vuelve a bajar.` : "Con <b>η = 3</b> la pérdida diverge. La tasa de aprendizaje es un hiperparámetro del optimizador, no una velocidad de animación.";
      },
      changed: { pesos: "cambió" },
      pose(ctx, t, e) {
        const eta = e <= 1 ? 1.2 : 3;
        const r = ctx.store.training("sgd", eta);
        const h = r.history.map((x) => x.train);
        const k = e <= 1 ? h.findIndex((v, i) => i > 0 && v > h[i - 1]) : 6;
        curves(ctx, k, { opt: "sgd", eta, title: `Pérdida por paso · SGD · η = ${eta}` });
        showHead(ctx, r.history[Math.max(0, k)].head, exOf(ctx));
        ctx.theta(r.history[Math.max(0, k)].print, `η = ${eta}, paso ${k}`, true);
        trainPanel(ctx, ["upd"], `η = ${eta}: L_entr por paso = ${h.slice(0, 11).map((v) => (v > 999 ? v.toExponential(1) : f2(v))).join(" → ")}`);
        ctx.focus(["mx-Wu", "bars-out"]);
      },
    },
    {
      id: "5.9",
      dur: 11,
      events: 2,
      scale: "model",
      camera: () => trayRegion("out", [0, 0, 186, 96], { area: { left: 420 } }),
      caption: (ctx) => (ctx.event <= 1 ? "<b>Adam</b> no es SGD: guarda el primer momento m (media de g) y el segundo v (media de g²), corrige su sesgo y escala cada paso por parámetro." : "Curvas con Adam (η = 0.05): baja muy rápido en entrenamiento y también sobreajusta en validación. Ecuaciones completas en el inspector."),
      changed: { pesos: "cambió (Adam)" },
      more: `<p class="kv">g_t = ∇θ L(θ_{t−1})<br>m_t = β₁ m_{t−1} + (1 − β₁) g_t<br>v_t = β₂ v_{t−1} + (1 − β₂) g_t²<br>m̂_t = m_t / (1 − β₁ᵗ)<br>v̂_t = v_t / (1 − β₂ᵗ)<br>θ_t = θ_{t−1} − η m̂_t / (√v̂_t + ε)</p><p>Valores por defecto (Kingma y Ba, 2014): β₁ = 0.9, β₂ = 0.999, ε = 10⁻⁸. En el paso 1, la corrección de sesgo hace m̂ = g y v̂ = g², así que Δθ ≈ −η·signo(g).</p>`,
      refs: ["adam"],
      pose(ctx, t, e) {
        const r = ctx.store.training("adam", 0.05);
        const k = e <= 1 ? 1 : Math.round(Math.min(1, (t - 0.5) * 2) * 40);
        const h = r.history[Math.max(1, k)];
        const idx = [16, 17, 18];
        const g = flatHead(h.grad);
        const opt = ctx.user.optimizer;
        ctx.user.optimizer = "adam";
        trainPanel(ctx, ["adam"], e <= 1 ? `paso t = 1 (parámetros W_U[0,0..2]):\n g  = ${idx.map((i) => f3(g[i])).join("  ")}\n m  = ${idx.map((i) => f3(h.adam.m[i])).join("  ")}   (β₁ = ${ADAM.beta1})\n v  = ${idx.map((i) => h.adam.v[i].toExponential(2)).join("  ")}   (β₂ = ${ADAM.beta2})\n m̂ = m/(1−β₁¹) = ${idx.map((i) => f3(h.mhat[i])).join("  ")}\n v̂ = v/(1−β₂¹) = ${idx.map((i) => h.vhat[i].toExponential(2)).join("  ")}\n Δθ = ${idx.map((i) => f3(h.delta[i])).join("  ")}` : `Adam, paso ${k}: L_entr = ${f3(r.history[k].train)} · L_val = ${f3(r.history[k].valid)}`);
        ctx.user.optimizer = opt;
        curves(ctx, k, { opt: "adam", eta: 0.05, title: "Pérdida por paso · Adam · η = 0.05" });
        showHead(ctx, r.history[Math.max(0, k)].head, exOf(ctx));
        ctx.theta(r.history[Math.max(0, k)].print, `Adam, paso ${k}`, true);
        ctx.focus(["mx-Wu", "bars-out"]);
      },
    },
  ],
};
