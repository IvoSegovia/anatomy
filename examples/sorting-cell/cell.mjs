// Every part of the sorting cell, built for any camera. Each item carries its convex
// footprint and height range, so the page can order the drawing by separating planes
// at whatever azimuth the reader turns the scene to.
export function makeCell(k, G, C) {
  const BT = C.BELT_TOP;
  const RZ = BT - C.BELT_T - C.ROLLER_R;
  const DZ = BT - C.DRUM_R;
  const FR = { x0: -292, x1: -34, yi: 29.5, yo: 33.5, z0: 54, z1: 72 };
  const PLATE = { x: -322, y: -134, w: 474, d: 268, r: 10 };
  const FIT = [];
  for (const x of [PLATE.x, PLATE.x + PLATE.w]) for (const y of [PLATE.y, PLATE.y + PLATE.d]) for (const z of [-15, 0]) FIT.push([x, y, z]);
  FIT.push([-170, -50, 138], [-150, 50, 138], [-290, -24, 98], [-223, 24, 98], [-16, 0, 150], [36, 0, 150], [10, -26, 150], [10, 26, 150], [132, -112, 106], [140, -96, 76]);

  const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const circ = (cx, cy, r) => {
    const R = r / Math.cos(Math.PI / 8);
    return Array.from({ length: 8 }, (_, i) => [cx + R * Math.cos((i + 0.5) * Math.PI / 4), cy + R * Math.sin((i + 0.5) * Math.PI / 4)]);
  };
  const planFp = (p) => rect(p.x, p.y, p.x + p.w, p.y + p.d);
  const box = (x0, y0, x1, y1, r = 1) => ({ x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), d: Math.abs(y1 - y0), r });
  const item = (id, group, fp, z0, z1, svg, bias = 0) => ({ id, group, fp, z0, z1, svg, bias });

  function stadium(a, b, r, steps = 10) {
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = ang + Math.PI / 2 + (i / steps) * Math.PI;
      pts.push([a[0] + r * Math.cos(t), a[1] + r * Math.sin(t)]);
    }
    for (let i = 0; i <= steps; i++) {
      const t = ang - Math.PI / 2 + (i / steps) * Math.PI;
      pts.push([b[0] + r * Math.cos(t), b[1] + r * Math.sin(t)]);
    }
    return pts;
  }

  function tools(P) {
    const S = (paths, style) => k.solidSvg(paths, style);
    const L = (d, style) => k.lineSvg(d, style);
    const D = (pts, style) => k.dotsSvg(pts, style);
    const at = (p) => k.iso(p, P);
    const [vx, vy] = k.towardViewer(P);
    const faces = (nx, ny) => nx * vx + ny * vy > 0.06;
    const m3 = (o, ex, ey) => {
      const O = at(o);
      const A = at([o[0] + ex[0], o[1] + ex[1], o[2] + ex[2]]);
      const B = at([o[0] + ey[0], o[1] + ey[1], o[2] + ey[2]]);
      const f = (v) => Math.round(v * 1000) / 1000;
      return `matrix(${f(A[0] - O[0])} ${f(A[1] - O[1])} ${f(B[0] - O[0])} ${f(B[1] - O[1])} ${f(O[0])} ${f(O[1])})`;
    };
    // A vertical face with outward normal n: local x runs screen-right, local y runs down.
    const faceM = (o, n) => m3(o, [n[1], -n[0], 0], [0, 0, -1]);
    // Text lying on a top face, turned to read left to right from wherever the camera is.
    const readTop = (o) => {
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      const O = at(o);
      let best = dirs[0];
      let bestX = -Infinity;
      for (const d of dirs) {
        const p = at([o[0] + d[0], o[1] + d[1], o[2]]);
        if (p[0] - O[0] > bestX) { bestX = p[0] - O[0]; best = d; }
      }
      const perp = [[-best[1], best[0]], [best[1], -best[0]]];
      const pick = perp.map((d) => at([o[0] + d[0], o[1] + d[1], o[2]])[1] - O[1]);
      const ey = pick[0] > pick[1] ? perp[0] : perp[1];
      return m3(o, [best[0], best[1], 0], [ey[0], ey[1], 0]);
    };
    const quad = (pts) => k.pathOf(pts.map(at), true);
    // A closed rounded slot drawn in a vertical face plane: a vent, a window, a door.
    const faceRect = (o, n, w, h) => {
      const ex = [n[1], -n[0], 0];
      const p = (u, v) => [o[0] + ex[0] * u, o[1] + ex[1] * u, o[2] - v];
      return quad([p(0, 0), p(w, 0), p(w, h), p(0, h)]);
    };
    return { S, L, D, at, faces, faceM, readTop, quad, faceRect, vx, vy };
  }

  // ---------------------------------------------------------------- static parts
  function staticItems(P) {
    const { S, L, D, at, faces, faceM, readTop, quad, faceRect } = tools(P);
    const out = [];
    const put = (...args) => out.push(item(...args));

    // Base: a machined floor plate on levelling feet.
    put("halo", "base", planFp(PLATE), -16, -15.9, `<path class="iso-halo" d="${k.haloOf(PLATE, -15, 15, P)}"/>`);
    for (const [x, y] of k.corners(PLATE, 26).concat([[-85, PLATE.y + 26], [-85, PLATE.y + PLATE.d - 26]])) {
      put(`foot${x},${y}`, "base", circ(x, y, 8), -15, -10, S(k.cylinder(x, y, 8, -15, 1.6, P, 28), { tone: "lo" }) + S(k.cylinder(x, y, 6, -13.4, 3.4, P, 28), { tone: "mid" }));
    }
    {
      let svg = S(k.slabOf(PLATE, -10, 10, P, 8, 1.6), { tone: "lo" });
      svg += L(k.planOutline(k.insetPlan(PLATE, 6), 0, P), { tone: "faint" });
      const screws = k.corners(PLATE, 12);
      svg += L(screws.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" });
      svg += D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 });
      // Anchor bolts in the plate grid, two per fixture.
      const anchors = [[-280, -46], [-280, 46], [-52, -46], [-52, 46], [36, -36], [36, 36], [-16, 30]];
      svg += L(anchors.map(([x, y]) => k.ring(x, y, 1.8, 0, P, 14)).join(""), { tone: "faint" });
      svg += D(anchors.map(([x, y]) => at([x, y, 0])), { size: 0.4, tone: "lo" });
      put("plate", "base", planFp(PLATE), -10, 0, svg);
    }
    {
      const strip = { x: -300, y: 120, w: 250, d: 7, r: 1 };
      const t = k.topTicks(strip.x + 5, strip.x + strip.w - 5, 4, 5, strip.y + 0.8, 0.6, [2, 3.8], P);
      put("ruler", "base", planFp(strip), 0, 0.6, S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }) + L(t.minor, { tone: "lo" }) + L(t.major, { tone: "mid" }) + D([at([strip.x + 2.5, strip.y + 3.5, 0.6]), at([strip.x + strip.w - 2.5, strip.y + 3.5, 0.6])], { size: 0.45 }));
    }
    {
      const lp = { x: 70, y: 102, w: 54, d: 18, r: 1.5 };
      let svg = S(k.slabOf(lp, 0, 0.8, P, 4), { tone: "lo" }) + L(k.planOutline(k.insetPlan(lp, 1.6), 0.8, P, 4), { tone: "faint" });
      svg += L(k.lineOnTop([75, 112], [104, 112], 0.8, P), { tone: "lo", free: true }) + L(k.lineOnTop([75, 115.5], [96, 115.5], 0.8, P), { tone: "lo", free: true });
      svg += k.faceTextSvg(readTop([97, 107, 0.8]), "CELDA 01 · 400 V", { size: 3.6, tone: "mid", anchor: "middle" });
      svg += D([at([lp.x + 3, lp.y + 3, 0.8]), at([lp.x + lp.w - 3, lp.y + lp.d - 3, 0.8])], { size: 0.45 });
      put("nameplate", "base", planFp(lp), 0, 0.8, svg);
    }
    // Cable duct on the floor, cabinet to scanner and to the arm base.
    const ducts = [box(-170, -133, 104, -128, 1), box(-164, -128, -156, -52, 1), box(46, -128, 54, -6, 1), box(25, -6, 54, 6, 1), box(96, -128, 104, -120, 1)];
    ducts.forEach((p, i) => {
      let svg = S(k.slabOf(p, 0, 4, P, 2, 0.4), { tone: "mid" }) + L(k.planOutline(k.insetPlan(p, 1.4), 4, P, 2), { tone: "faint" });
      const long = p.w > p.d;
      const clips = [];
      for (let s = 14; s < (long ? p.w : p.d) - 6; s += 26) clips.push(long ? k.lineOnTop([p.x + s, p.y], [p.x + s, p.y + p.d], 4, P) : k.lineOnTop([p.x, p.y + s], [p.x + p.w, p.y + s], 4, P));
      svg += L(clips.join(""), { tone: "lo" });
      put(`duct${i}`, "control", planFp(p), 0, 4, svg);
    });

    // ------------------------------------------------ conveyor: legs, frames, motor
    for (const lx of [-270, -62]) {
      for (const sy of [-1, 1]) {
        const y = sy * (FR.yi + FR.yo) / 2;
        put(`legfoot${lx}${sy}`, "cinta", circ(lx, y, 3.8), 0, 5, S(k.cylinder(lx, y, 3.8, 0, 2, P, 20), { tone: "lo" }) + S(k.cylinder(lx, y, 1.5, 2, 3, P, 14), { tone: "mid", crease: "none" }));
        const lp = box(lx - 3, sy * FR.yi, lx + 3, sy * FR.yo, 0.6);
        put(`leg${lx}${sy}`, "cinta", planFp(lp), 5, FR.z0, S(k.slabOf(lp, 5, FR.z0 - 5, P, 2, 0.3), { tone: "mid" }) + D([at([lx, y, FR.z0 - 4])], { size: 0.4 }));
      }
      const bp = box(lx - 2, -FR.yi, lx + 2, FR.yi, 0.6);
      put(`brace${lx}`, "cinta", planFp(bp), 16, 20, S(k.slabOf(bp, 16, 4, P, 2, 0.3), { tone: "mid" }) + D([at([lx, -FR.yi + 2, 20]), at([lx, FR.yi - 2, 20])], { size: 0.4 }));
    }
    for (const sy of [-1, 1]) {
      const bp = box(-267, sy * 30.5, -65, sy * 32.5, 0.6);
      put(`rail${sy}`, "cinta", planFp(bp), 16, 20, S(k.slabOf(bp, 16, 4, P, 2, 0.3), { tone: "lo" }));
    }
    for (const sy of [-1, 1]) {
      const fp = box(FR.x0, sy * FR.yi, FR.x1, sy * FR.yo, 1);
      let svg = S(k.slabOf(fp, FR.z0, FR.z1 - FR.z0, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(fp, FR.z0 + 4, P, 3), { tone: "faint" }) });
      if (faces(0, sy)) {
        const yo = sy * FR.yo;
        const xs = C.ROLLERS.concat(C.DRUMS);
        svg += L(xs.map((x) => k.sideRing([x, yo, RZ], 1.5, "y", P, 14)).join(""), { tone: "lo" });
        svg += D(xs.map((x) => at([x, yo, RZ])), { size: 0.45, tone: "mid" });
      }
      svg += D([at([FR.x0 + 3, sy * 31.5, FR.z1]), at([FR.x1 - 3, sy * 31.5, FR.z1])], { size: 0.4 });
      put(`frame${sy}`, "cinta", planFp(fp), FR.z0, FR.z1, svg);
    }
    // Stopper: a cross member, a short air cylinder and its pin between the belts.
    {
      const cm = box(-55, -FR.yi, -47, FR.yi, 0.6);
      put("stopbar", "cinta", planFp(cm), 50, 54, S(k.slabOf(cm, 50, 4, P, 2, 0.3), { tone: "mid" }) + D([at([-51, -26, 54]), at([-51, 26, 54])], { size: 0.4 }));
      put("stopcyl", "cinta", circ(-51, 0, 2.2), 54, 60, S(k.cylinder(-51, 0, 2.2, 54, 6, P, 22, 0.3), { tone: "mid", inner: L(k.sideArc(-51, 0, 2.2, 57, P, 14), { tone: "faint" }) }));
      put("stoppin", "cinta", circ(-51, 0, 1.1), 60, 74, S(k.cylinder(-51, 0, 1.1, 60, 14, P, 16), { tone: "hi", crease: "lo" }));
    }
    // Gearmotor on the drive drum, outside the +y frame.
    {
      const gb = box(-48, FR.yo, -36, 42, 1);
      put("gearbox", "cinta", planFp(gb), 55, 71, S(k.slabOf(gb, 55, 16, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(gb, 63, P, 3), { tone: "faint" }) }) + D([at([-45, 38, 71]), at([-39, 38, 71])], { size: 0.45 }));
      const F = G.frameOf([-42, 42, DZ], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
      let svg = S(G.disc(0, 22, 6, F, P), { tone: "mid" });
      svg += k.fadedSvg(G.ribsOf(F, 0, 22, 6, 18, P, { fade: [0.1, 0.55] }), { tone: "lo" });
      put("motor", "cinta", rect(-48, 42, -36, 64), DZ - 6, DZ + 6, svg);
      const Ff = G.frameOf([-42, 64, DZ], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
      let fan = S(G.disc(0, 3, 6.4, Ff, P), { tone: "mid" });
      if (faces(0, 1)) fan += L(G.circleOf(Ff, 3, 4.2, P) + G.circleOf(Ff, 3, 2.2, P), { tone: "faint" }) + D([at([-42, 67, DZ])], { size: 0.5 });
      put("fan", "cinta", rect(-48.4, 64, -35.6, 67), DZ - 6.4, DZ + 6.4, fan);
      const tb = box(-46, 46, -38, 56, 0.8);
      put("termbox", "cinta", planFp(tb), DZ + 6, DZ + 10, S(k.slabOf(tb, DZ + 6, 4, P, 2, 0.4), { tone: "mid" }) + L(k.planOutline(k.insetPlan(tb, 1.4), DZ + 10, P, 2), { tone: "faint" }) + D([at([-44.6, 47.4, DZ + 10]), at([-39.4, 54.6, DZ + 10])], { size: 0.4 }));
    }
    // Photo-eyes on brackets, looking down at the paper.
    for (const ex of C.EYES) {
      const bp = box(ex - 3, -FR.yo, ex + 3, -12, 0.6);
      put(`eyebr${ex}`, "cinta", planFp(bp), FR.z1, FR.z1 + 2, S(k.slabOf(bp, FR.z1, 2, P, 2, 0.3), { tone: "mid" }) + D([at([ex, -31.5, FR.z1 + 2])], { size: 0.4 }));
      const hp = box(ex - 3, -19, ex + 3, -12, 0.8);
      put(`eye${ex}`, "cinta", planFp(hp), FR.z1 + 2, FR.z1 + 10, S(k.slabOf(hp, FR.z1 + 2, 8, P, 2, 0.4), { tone: "mid", inner: L(k.sideSeam(hp, FR.z1 + 7, P, 2), { tone: "faint" }) }));
    }
    // Bottom-feed magazine: side guides on brackets, back stop, separation gate.
    for (const sy of [-1, 1]) {
      const gp = box(-287, sy * 22, -223, sy * 24, 0.5);
      let svg = S(k.slabOf(gp, FR.z1, 26, P, 2, 0.3), { tone: "mid" });
      put(`guide${sy}`, "cinta", planFp(gp), FR.z1, FR.z1 + 26, svg);
      for (const bx of [-277, -241]) {
        const bp = box(bx, sy * 24, bx + 8, sy * FR.yo, 0.5);
        put(`gbr${bx}${sy}`, "cinta", planFp(bp), FR.z1, FR.z1 + 4, S(k.slabOf(bp, FR.z1, 4, P, 2, 0.3), { tone: "mid" }) + D([at([bx + 4, sy * 30, FR.z1 + 4])], { size: 0.4 }));
      }
    }
    {
      const bs = box(-290, -24, -287, 24, 0.5);
      put("backstop", "cinta", planFp(bs), FR.z1, FR.z1 + 26, S(k.slabOf(bs, FR.z1, 26, P, 2, 0.3), { tone: "mid" }));
      const bar = box(-223, -24, -219, 24, 0.6);
      put("gatebar", "cinta", planFp(bar), 80, 84, S(k.slabOf(bar, 80, 4, P, 2, 0.4), { tone: "mid" }) + D([at([-221, -22.5, 84]), at([-221, 22.5, 84])], { size: 0.4 }));
      const blade = box(-222.5, -21, -219.5, 21, 0.4);
      put("gateblade", "cinta", planFp(blade), BT + C.DOC.T + 0.8, 80, S(k.slabOf(blade, BT + C.DOC.T + 0.8, 80 - BT - C.DOC.T - 0.8, P, 2), { tone: "mid", inner: L(k.sideSeam(blade, 75, P, 2), { tone: "faint" }) }));
      put("gateknob", "cinta", circ(-221, 9, 2.6), 84, 88, S(k.cylinder(-221, 9, 2.6, 84, 4, P, 20), { tone: "mid" }) + L(k.knurl(-221, 9, 2.6, 84, 88, 18, P), { tone: "lo" }) + L(k.lineOnTop([-221, 9], [-221, 11.6], 88, P), { tone: "hi" }));
    }

    // ------------------------------------------------ scanner gantry
    for (const sy of [-1, 1]) {
      const bp = box(-174, sy * 36, -146, sy * 52, 1.2);
      put(`tbase${sy}`, "escaner", planFp(bp), 0, 2, S(k.slabOf(bp, 0, 2, P, 3, 0.4), { tone: "lo" }) + D(k.corners(bp, 2.6).map(([x, y]) => at([x, y, 2])), { size: 0.45 }));
      const tp = box(-168, sy * 38, -152, sy * 48, 1.2);
      let svg = S(k.slabOf(tp, 2, 122, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(tp, 30, P, 3), { tone: "faint" }) });
      if (faces(0, sy)) {
        const o = [sy > 0 ? -166 : -154, sy * 48, 108];
        svg += `<path class="cl-window" d="${faceRect(o, [0, sy], 12, 14)}"/>`;
        svg += L(faceRect([sy > 0 ? -165 : -155, sy * 48, 86], [0, sy], 10, 44), { tone: "faint" });
        svg += D([at([-160, sy * 48, 112])], { size: 0.5, tone: "mid" });
      }
      put(`tower${sy}`, "escaner", planFp(tp), 2, 124, svg);
    }
    {
      const bp = box(-170, -50, -150, 50, 1.4);
      let svg = S(k.slabOf(bp, 124, 10, P, 3, 0.8), { tone: "mid", inner: L(k.sideSeam(bp, 128, P, 3), { tone: "faint" }) });
      svg += L(k.planOutline(k.insetPlan(bp, 3), 134, P, 3), { tone: "faint" });
      svg += D([[-166, -46], [-154, -46], [-166, 46], [-154, 46]].map(([x, y]) => at([x, y, 134])), { size: 0.5 });
      put("bridge", "escaner", planFp(bp), 124, 134, svg);
      put("gland", "escaner", circ(-160, -40, 2.4), 134, 138, S(k.cylinder(-160, -40, 2.4, 134, 4, P, 18), { tone: "mid" }) + L(k.knurl(-160, -40, 2.4, 134, 138, 14, P), { tone: "lo" }));
      for (const hx of [-169, -153]) for (const hy of [-20, 18]) {
        const hp = box(hx, hy, hx + 2, hy + 2, 0.3);
        put(`hang${hx}${hy}`, "escaner", planFp(hp), 108, 124, S(k.slabOf(hp, 108, 16, P, 2), { tone: "mid", crease: "none" }));
      }
      const head = box(-165, -11, -155, 11, 1.2);
      let hs = S(k.slabOf(head, 108, 16, P, 3, 0.5), { tone: "hi", crease: "lo", inner: L(k.sideSeam(head, 112, P, 3), { tone: "faint" }) });
      const fins = [];
      for (const sx of [-1, 1]) if (faces(sx, 0)) for (let y = -8; y <= 8; y += 4) fins.push(k.segment([sx > 0 ? -155 : -165, y, 113], [sx > 0 ? -155 : -165, y, 124], P));
      hs += L(fins.join(""), { tone: "lo" });
      put("head", "escaner", planFp(head), 108, 124, hs);
      put("lens", "escaner", circ(-160, 0, 3.2), 103, 108, S(k.cylinder(-160, 0, 3.2, 103, 5, P, 28), { tone: "mid", inner: L(k.sideArc(-160, 0, 3.2, 106, P, 18), { tone: "faint" }) }));
    }

    // ------------------------------------------------ SCARA base
    {
      const [cx, cy] = C.COL;
      const bolts = Array.from({ length: 8 }, (_, i) => [cx + 13 * Math.cos((i / 8) * Math.PI * 2 + 0.3), cy + 13 * Math.sin((i / 8) * Math.PI * 2 + 0.3)]);
      put("flange", "brazo", circ(cx, cy, 16), 0, 4, S(k.cylinder(cx, cy, 16, 0, 4, P, 40, 0.6), { tone: "mid" }) + L(k.ring(cx, cy, 13, 4, P, 48), { tone: "faint" }) + D(bolts.map(([x, y]) => at([x, y, 4])), { size: 0.55, tone: "mid" }));
      put("column", "brazo", circ(cx, cy, 11), 4, 96, S(k.cylinder(cx, cy, 11, 4, 92, P, 36), { tone: "mid", crease: "none", inner: L([30, 62].map((z) => k.sideArc(cx, cy, 11, z, P, 28)).join(""), { tone: "faint" }) }));
      put("j1", "brazo", circ(cx, cy, 13.5), 96, 104, S(k.cylinder(cx, cy, 13.5, 96, 8, P, 40, 0.6), { tone: "mid", inner: L(k.sideArc(cx, cy, 13.5, 99, P, 32), { tone: "faint" }) }) + L(k.knurl(cx, cy, 13.5, 98.4, 104, 40, P, 0.6), { tone: "lo" }));
    }

    // ------------------------------------------------ trays on pedestals
    C.TRAYS.forEach((t, ti) => {
      const [cx, cy] = t.at;
      const pl = box(cx - 28, cy - 19, cx + 28, cy + 19, 1.5);
      put(`plinth${ti}`, "bandejas", planFp(pl), 0, 3, S(k.slabOf(pl, 0, 3, P, 3, 0.5), { tone: "lo" }) + D(k.corners(pl, 3).map(([x, y]) => at([x, y, 3])), { size: 0.45 }));
      const co = box(cx - 22, cy - 14, cx + 22, cy + 14, 1.5);
      put(`ped${ti}`, "bandejas", planFp(co), 3, 47, S(k.slabOf(co, 3, 44, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(co, 40, P, 3), { tone: "faint" }) }));
      const fl = box(cx - 34, cy - 25, cx + 34, cy + 25, 2);
      put(`tfloor${ti}`, "bandejas", planFp(fl), 47, 50, S(k.slabOf(fl, 47, 3, P, 4, 0.5), { tone: "mid" }) + L(k.planOutline(k.insetPlan(fl, 5), 50, P, 3), { tone: "faint" }));
      const walls = [box(cx - 34, cy - 25, cx + 34, cy - 23, 0.8), box(cx - 34, cy + 23, cx + 34, cy + 25, 0.8), box(cx - 34, cy - 23, cx - 32, cy + 23, 0.4), box(cx + 32, cy - 23, cx + 34, cy + 23, 0.4)];
      walls.forEach((w, wi) => {
        let svg = S(k.slabOf(w, 50, 12, P, 2, 0.3), { tone: "mid" });
        if (wi < 2) svg += D([at([w.x + 3, w.y + 1, 62]), at([w.x + w.w - 3, w.y + 1, 62])], { size: 0.4 });
        put(`wall${ti}${wi}`, "bandejas", planFp(w), 50, 62, svg);
      });
      const [ox, oy] = t.out;
      const lc = [cx + ox * 36, cy + oy * 36];
      const lp = ox ? box(lc[0] - 4.5, lc[1] - 24, lc[0] + 4.5, lc[1] + 24, 1) : box(lc[0] - 24, lc[1] - 4.5, lc[0] + 24, lc[1] + 4.5, 1);
      let ls = S(k.slabOf(lp, 0, 0.8, P, 3), { tone: "lo" }) + L(k.planOutline(k.insetPlan(lp, 1.2), 0.8, P, 3), { tone: "faint" });
      ls += k.faceTextSvg(readTop([lc[0], lc[1], 0.8]) + " translate(0 1.6)", t.label, { size: t.label.length > 10 ? 4 : 5, tone: "hi", anchor: "middle" });
      put(`label${ti}`, "bandejas", planFp(lp), 0, 0.8, ls);
    });

    // ------------------------------------------------ control cabinet
    {
      const pl = box(68, -122, 142, -94, 1.5);
      put("cplinth", "control", planFp(pl), 0, 4, S(k.slabOf(pl, 0, 4, P, 3, 0.5), { tone: "lo" }));
      const bd = box(70, -120, 140, -96, 1.5);
      let svg = S(k.slabOf(bd, 4, 72, P, 3, 0.8), { tone: "mid", inner: L(k.sideSeam(bd, 70, P, 3), { tone: "faint" }) });
      if (faces(0, 1)) {
        svg += L(faceRect([73, -96, 72], [0, 1], 64, 62), { tone: "lo" });
        svg += D([at([74.5, -96, 66]), at([74.5, -96, 18])], { size: 0.45 });
        svg += L(faceRect([80, -96, 64], [0, 1], 22, 9), { tone: "faint" });
      }
      if (faces(0, -1)) svg += L(faceRect([137, -120, 72], [0, -1], 64, 62), { tone: "faint" });
      for (const sx of [-1, 1]) if (faces(sx, 0)) {
        const x = sx > 0 ? 140 : 70;
        const vents = [];
        for (let i = 0; i < 6; i++) vents.push(faceRect([x, sx > 0 ? -102 - 0 : -114, 64 - i * 4.5], [sx, 0], 12, 1.6));
        svg += L(vents.join(""), { tone: "lo" });
      }
      put("cabinet", "control", planFp(bd), 4, 76, svg);
      const hp = box(127, -96, 129.5, -94.4, 0.5);
      put("handle", "control", planFp(hp), 34, 50, S(k.slabOf(hp, 34, 16, P, 2), { tone: "mid" }));
      put("estopbase", "control", circ(82, -110, 4.5), 76, 79, S(k.cylinder(82, -110, 4.5, 76, 3, P, 28), { tone: "mid" }));
      put("estop", "control", circ(82, -110, 5.2), 79, 82.5, S(k.cylinder(82, -110, 5.2, 79, 3.5, P, 32, 0.5), { tone: "hi", crease: "lo" }) + L(k.ring(82, -110, 3, 82.5, P, 24), { tone: "faint" }));
      put("lightpost", "control", circ(132, -112, 1.4), 76, 86, S(k.cylinder(132, -112, 2.6, 76, 1.5, P, 20), { tone: "mid" }) + S(k.cylinder(132, -112, 1.4, 77.5, 8.5, P, 16), { tone: "mid", crease: "none" }));
    }
    return out;
  }

  // ---------------------------------------------------------------- moving parts
  function docSvg(P, d, x, y, z, { lit = false, scan = 1 } = {}) {
    const { S, L, D, at } = tools(P);
    const { L: DL, W } = C.DOC;
    const top = z + C.DOC.T;
    const plan = { x: x - DL / 2, y: y - W / 2, w: DL, d: W, r: 0.8 };
    const skew = d.cls === 2 ? 0.1 : 0;
    const P2 = (u, v) => [x + u + v * skew, y + v];
    const read = (u) => (u + DL / 2) / DL <= scan + 1e-6;
    const rows = { read: [], unread: [] };
    const row = (u, v0, v1) => rows[read(u) ? "read" : "unread"].push(k.onTop([P2(u, v0), P2(u, v1)], top, P));
    const dots = [];
    let boxes = "";
    if (d.kind === 0) {
      boxes += k.onTop([P2(-26, -17), P2(-20, -17), P2(-20, -11), P2(-26, -11)], top, P, true);
      row(-23, -8, 14);
      [-15, -11, -7, -3, 1, 5, 9, 13].forEach((u, i) => {
        row(u, -17, -4 + ((i * 5) % 3));
        row(u, 2, 9 + ((i * 7) % 8));
      });
      row(22, 4, 16);
      boxes += k.ring(x + 22, y - 10, 4, top, P, 18);
    } else {
      row(-24, -17, 10);
      for (let i = 0; i < 8; i++) {
        const u = -17 + i * 4.4;
        dots.push(at([...P2(u, -16), top]));
        row(u, -13, 6 + ((i * 11 + d.n) % 11));
      }
      boxes += k.onTop([P2(19, -17), P2(26, -17), P2(26, 17), P2(19, 17)], top, P, true) + k.onTop([P2(22.5, -17), P2(22.5, 17)], top, P);
    }
    if (d.cls === 2) boxes += k.onTop(Array.from({ length: 22 }, (_, i) => P2(12 + 4.5 * Math.cos((i / 22) * Math.PI * 2), 10 + 4.5 * Math.sin((i / 22) * Math.PI * 2))), top, P, true);
    let svg = S(k.slabOf(plan, z, C.DOC.T, P, 2), { tone: lit ? "hi" : "mid", lit, crease: "none" });
    svg += L(boxes, { tone: "lo" });
    svg += L(rows.read.join(""), { tone: lit ? "hi" : "mid", free: true }) + L(rows.unread.join(""), { tone: "faint", free: true });
    if (dots.length) svg += D(dots, { size: 0.45, tone: "mid" });
    return svg;
  }

  // Geometry that only changes with the camera (roller barrels, belt slabs, stacks).
  let memoKey = "";
  let memo = new Map();
  const once = (P, key, make) => {
    const pk = `${P.azimuth}|${P.elevation}|${P.scale}|${P.origin[0]}|${P.origin[1]}`;
    if (pk !== memoKey) { memoKey = pk; memo = new Map(); }
    if (!memo.has(key)) memo.set(key, make());
    return memo.get(key);
  };

  function dynamicItems(P, M, opt = {}) {
    const { S, L, D, at, faceM, faces, faceRect } = tools(P);
    const out = [];
    const put = (...args) => out.push(item(...args));

    // Rollers turn with the belt: the ribs are the flats of a knurled tube.
    C.ROLLERS.forEach((x, i) => {
      const F = G.frameOf([x, 0, RZ], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
      const svg = once(P, `roller${i}`, () => S(G.disc(-29, 29, C.ROLLER_R, F, P, { steps: 32 }), { tone: "mid" })) + k.fadedSvg(G.ribsOf(F, -29, 29, C.ROLLER_R, 8, P, { phase: -M.roll, fade: [0.12, 0.6] }), { tone: "lo" });
      put(`roller${i}`, "cinta", rect(x - 4, -29, x + 4, 29), RZ - 4, RZ + 4, svg);
    });
    C.DRUMS.forEach((x, i) => {
      const F = G.frameOf([x, 0, DZ], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
      const svg = once(P, `drum${i}`, () => S(G.disc(-27, 27, C.DRUM_R, F, P, { steps: 40 }), { tone: "mid" })) + k.fadedSvg(G.ribsOf(F, -27, 27, C.DRUM_R, 12, P, { phase: -M.drum, fade: [0.12, 0.6] }), { tone: "lo" });
      put(`drum${i}`, "cinta", rect(x - C.DRUM_R, -27, x + C.DRUM_R, 27), DZ - C.DRUM_R, DZ + C.DRUM_R, svg);
    });
    // Twin flat belts, with the splice and cleat marks travelling along.
    for (const sy of [-1, 1]) {
      const bp = box(C.DRUMS[0], sy * 9, C.DRUMS[1], sy * 21, 0.5);
      let svg = once(P, `belt${sy}`, () => S(k.slabOf(bp, BT - C.BELT_T, C.BELT_T, P, 2), { tone: "lo", crease: "none" }));
      const marks = [];
      const pitch = 20;
      const off = ((M.travel % pitch) + pitch) % pitch;
      for (let s = C.DRUMS[0] + off; s < C.DRUMS[1]; s += pitch) marks.push(k.lineOnTop([s, sy * 9], [s, sy * 21], BT, P));
      svg += L(marks.join(""), { tone: "faint" });
      put(`belt${sy}`, "cinta", planFp(bp), BT - C.BELT_T, BT, svg, 2);
    }
    // Magazine stack: sheets waiting above the next one on the belt.
    {
      const count = 44 - (((M.cycle % 24) + 24) % 24);
      const h = count * 0.42;
      const z0 = BT + C.DOC.T;
      const sp = { x: C.WAIT_X - 30, y: -21, w: 60, d: 42, r: 0.8 };
      const svg = once(P, `mag${count}`, () => {
        const seams = [];
        for (let z = z0 + 1.2; z < z0 + h - 0.5; z += 1.2) seams.push(k.sideSeam(sp, z, P, 2));
        const rows = [];
        for (let u = -22; u <= 22; u += 5) rows.push(k.onTop([[C.WAIT_X + u, -15], [C.WAIT_X + u, 2 + ((u * 7 + 60) % 13)]], z0 + h, P));
        return S(k.slabOf(sp, z0, h, P, 2), { tone: "mid", crease: "none", inner: L(seams.join(""), { tone: "faint" }) }) + L(rows.join(""), { tone: "faint", free: true });
      });
      put("magstack", "cinta", planFp(sp), z0, z0 + h, svg);
    }
    // Eye LEDs.
    C.EYES.forEach((ex, i) => {
      const on = M.eyes[i];
      put(`led${ex}`, "cinta", circ(ex, -15.5, 1), FR.z1 + 10, FR.z1 + 11, once(P, `led${ex}${on}`, () => `<g class="cl-led"${on ? " data-on" : ""}>${S(k.cylinder(ex, -15.5, 1, FR.z1 + 10, 1, P, 14), { tone: on ? "hi" : "lo", crease: "none" })}</g>`));
    });

    // Documents. The followed one, or else the newest classified one, is the lit accent.
    const litN = opt.follow ?? (M.decided ? M.decided.n : M.scanning ? M.scanning.n : -1);
    for (const d of M.docs) {
      const z = d.z;
      const svg = docSvg(P, d, d.x, d.y, z, { lit: d.n === litN, scan: d.since < 0 ? 0 : d.scan });
      put(`doc${d.n}`, d.held ? "brazo" : "cinta", rect(d.x - 30, d.y - 21, d.x + 30, d.y + 21), z, z + C.DOC.T, `<g data-doc="${d.n}">${svg}</g>`, 1);
    }

    // Scanner light: two sheets from the line lights meeting on the scan line.
    {
      const a = M.light;
      const lz = BT + C.DOC.T + 0.05;
      const sheet = (x0) => `<path class="cl-sheet" style="opacity:${(0.1 + 0.5 * a).toFixed(3)}" d="${k.pathOf([at([x0, -21, 102]), at([x0, 21, 102]), at([C.SCAN_X, 21, lz]), at([C.SCAN_X, -21, lz])], true)}"/>`;
      put("sheetA", "escaner", rect(-166, -21, C.SCAN_X, 21), lz + 0.01, 102, sheet(-166), 5);
      put("sheetB", "escaner", rect(C.SCAN_X, -21, -154, 21), lz + 0.01, 102, sheet(-154), 5);
      put("scanline", "escaner", rect(C.SCAN_X - 0.3, -21, C.SCAN_X + 0.3, 21), lz, lz + 0.001, `<path class="iso-line cl-scan" style="opacity:${(0.35 + 0.65 * a).toFixed(3)}" d="${k.lineOnTop([C.SCAN_X, -21], [C.SCAN_X, 21], lz, P)}"/>`, 6);
      for (const [i, x0] of [[0, -170], [1, -154]]) {
        const bp = box(x0, -24, x0 + 4, 24, 0.6);
        put(`lamp${i}`, "escaner", planFp(bp), 102, 108, `<g class="cl-lamp" style="--glow:${a.toFixed(3)}">${once(P, `lamp${i}`, () => S(k.slabOf(bp, 102, 6, P, 2, 0.3), { tone: "mid" }))}</g>`);
      }
      // Display on whichever tower face the reader can see.
      for (const sy of [-1, 1]) {
        if (!faces(0, sy)) continue;
        const o = [sy > 0 ? -166 : -154, sy * 48.05, 108];
        let text = "LISTO";
        let sub = "300 ppp";
        if (M.scanning) { text = `LEE ${Math.round(M.scanning.scan * 100)}%`; sub = `${Math.round(M.scanning.scan * C.LINES)} lín`; }
        else if (M.decided) { text = ["PÓL", "PRO", "REV"][M.decided.cls] + " " + M.decided.conf.toFixed(2); sub = M.decided.id; }
        const svg = `<g transform="${faceM(o, [0, sy])}"><text class="cl-digits" x="6" y="6.2" font-size="3.4" text-anchor="middle">${text}</text><text class="cl-digits" data-dim x="6" y="11" font-size="2.6" text-anchor="middle">${sub}</text></g>`;
        put(`display${sy}`, "escaner", rect(-166, sy * 48, -154, sy * 48.3), 94, 108, svg, 1);
      }
    }

    // SCARA links, quill and vacuum head, posed from the model's joints.
    {
      const [cx, cy] = C.COL;
      const { e, w } = M;
      const r1 = stadium([cx, cy], e, 11);
      let s1 = S(k.extrude(r1, 104, 8, P, { bevel: 0.6 }), { tone: "hi", crease: "lo" });
      s1 += L(k.onTop(stadium([cx, cy], e, 7.5), 112, P, true), { tone: "faint" });
      s1 += L(k.ring(cx, cy, 4, 112, P, 20), { tone: "lo" }) + D([at([cx, cy, 112])], { size: 0.5, tone: "hi" });
      put("link1", "brazo", r1, 104, 112, s1);
      const r2 = stadium(e, w, 9);
      let s2 = S(k.extrude(r2, 112, 7, P, { bevel: 0.5 }), { tone: "hi", crease: "lo" });
      s2 += L(k.onTop(stadium(e, w, 6), 119, P, true), { tone: "faint" });
      put("link2", "brazo", r2, 112, 119, s2);
      put("elbow", "brazo", circ(e[0], e[1], 7), 119, 123, S(k.cylinder(e[0], e[1], 7, 119, 4, P, 32, 0.4), { tone: "mid" }) + L(k.ring(e[0], e[1], 4.5, 123, P, 24), { tone: "faint" }) + D([at([e[0], e[1], 123])], { size: 0.5 }));
      put("wrist", "brazo", circ(w[0], w[1], 8), 119, 135, S(k.cylinder(w[0], w[1], 8, 119, 16, P, 36, 0.5), { tone: "mid", inner: L(k.sideArc(w[0], w[1], 8, 123, P, 24), { tone: "faint" }) }) + L(k.knurl(w[0], w[1], 8, 122.4, 135, 28, P, 0.6), { tone: "lo" }) + L(k.ring(w[0], w[1], 3.6, 135, P, 20), { tone: "faint" }));
      const cupsBottom = M.z;
      const headZ = cupsBottom + C.CUP_H;
      const headTop = headZ + C.HEAD_H;
      const shaftTop = headTop + 66;
      if (shaftTop > 135) put("shaftUp", "brazo", circ(w[0], w[1], 2.4), 135, shaftTop, S(k.cylinder(w[0], w[1], 2.4, 135, shaftTop - 135, P, 18), { tone: "hi", crease: "none" }) + S(k.cylinder(w[0], w[1], 3, shaftTop, 1.4, P, 18), { tone: "mid" }));
      put("shaftDn", "brazo", circ(w[0], w[1], 2.4), headTop, 112, S(k.cylinder(w[0], w[1], 2.4, headTop + 2, 110 - headTop, P, 18), { tone: "hi", crease: "none" }) + S(k.cylinder(w[0], w[1], 3.6, headTop, 2, P, 22), { tone: "mid" }));
      const hp = box(w[0] - 15, w[1] - 11, w[0] + 15, w[1] + 11, 1.4);
      put("vhead", "brazo", planFp(hp), headZ, headTop, S(k.slabOf(hp, headZ, C.HEAD_H, P, 3, 0.4), { tone: "mid" }) + D(k.corners(hp, 2.4).map(([x, y]) => at([x, y, headTop])), { size: 0.4 }));
      put("vfit", "brazo", circ(w[0] + 9, w[1] + 6, 1.8), headTop, headTop + 3, `<g class="cl-led"${M.vacuum ? " data-on" : ""}>${S(k.cylinder(w[0] + 9, w[1] + 6, 1.8, headTop, 3, P, 16), { tone: M.vacuum ? "hi" : "mid" })}</g>`);
      const cups = [[-10, -6], [10, -6], [-10, 6], [10, 6]].map(([dx, dy]) => [w[0] + dx, w[1] + dy]);
      const csvg = cups
        .sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P))
        .map(([x, y]) => S(k.cylinder(x, y, 3, cupsBottom, 1.6, P, 22), { tone: "mid" }) + S(k.cylinder(x, y, 1.6, cupsBottom + 1.6, 1.4, P, 16), { tone: "mid", crease: "none" }))
        .join("");
      put("cups", "brazo", rect(w[0] - 13, w[1] - 9, w[0] + 13, w[1] + 9), cupsBottom, headZ, csvg);
    }

    // Stacks in the trays grow with each drop.
    C.TRAYS.forEach((t, ti) => {
      const [cx, cy] = t.at;
      const top = M.stacks[ti];
      const h = top - C.TRAY_FLOOR;
      if (h < 0.3) return;
      const sp = { x: cx - 30, y: cy - 21, w: 60, d: 42, r: 0.8 };
      const svg = once(P, `stack${ti}|${top}`, () => {
      const seams = [];
      for (let z = C.TRAY_FLOOR + 1; z < top - 0.4; z += 1) seams.push(k.sideSeam(sp, z, P, 2));
      let svg = S(k.slabOf(sp, C.TRAY_FLOOR, h, P, 2), { tone: "mid", crease: "none", inner: L(seams.join(""), { tone: "faint" }) });
      const rows = [];
      for (let u = -20; u <= 20; u += 5) rows.push(k.onTop([[cx + u, cy - 15], [cx + u, cy + 4 + ((u * 7 + 40) % 11)]], top, P));
      svg += L(rows.join(""), { tone: "faint", free: true });
      return svg;
      });
      put(`stack${ti}`, "bandejas", planFp(sp), C.TRAY_FLOOR, top, svg);
    });

    // Stack light: green running, amber paused.
    {
      const run = !opt.paused;
      const segs = [[86, 92, run], [92, 98, !run], [98, 104, false]];
      segs.forEach(([z0, z1, on], i) => {
        put(`beacon${i}`, "control", circ(132, -112, 3), z0, z1, once(P, `beacon${i}${on}`, () => `<g class="cl-led"${on ? " data-on" : ""}>${S(k.cylinder(132, -112, 3, z0, z1 - z0, P, 24), { tone: on ? "hi" : "mid", inner: L(k.sideArc(132, -112, 3, z0 + 0.01, P, 18), { tone: "faint" }) })}</g>`));
      });
      put("beaconcap", "control", circ(132, -112, 3.2), 104, 105.6, once(P, "cap", () => S(k.cylinder(132, -112, 3.2, 104, 1.6, P, 24, 0.3), { tone: "mid" })));
    }
    return out;
  }

  // ---------------------------------------------------------------- painter's order
  // Items whose height ranges don't overlap go lower first. Otherwise a vertical plane
  // that separates the footprints decides: the side facing the viewer is drawn later.
  function sortItems(items, P) {
    const cam = k.cameraOf(P);
    const v = [cam.cosA, cam.sinA];
    for (const it of items) {
      if (it._P !== P) {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, cx = 0, cy = 0;
        for (const [x, y] of it.fp) {
          cx += x; cy += y;
          for (const z of [it.z0, it.z1]) {
            const [sx, sy] = k.iso([x, y, z], P);
            if (sx < x0) x0 = sx; if (sx > x1) x1 = sx; if (sy < y0) y0 = sy; if (sy > y1) y1 = sy;
          }
        }
        cx /= it.fp.length; cy /= it.fp.length;
        it._bb = [x0, y0, x1, y1];
        it._depth = k.depthOf([cx, cy, (it.z0 + it.z1) / 2], P);
        it._P = P;
      }
    }
    const n = items.length;
    const after = Array.from({ length: n }, () => []);
    const indeg = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      const a = items[i];
      for (let j = i + 1; j < n; j++) {
        const b = items[j];
        if (a._bb[2] <= b._bb[0] + 0.2 || b._bb[2] <= a._bb[0] + 0.2 || a._bb[3] <= b._bb[1] + 0.2 || b._bb[3] <= a._bb[1] + 0.2) continue;
        const c = compare(a, b, v);
        if (c < 0) { after[i].push(j); indeg[j]++; } else { after[j].push(i); indeg[i]++; }
      }
    }
    const done = new Array(n).fill(false);
    const order = [];
    const key = (i) => items[i]._depth + items[i].bias * 0.01;
    for (let step = 0; step < n; step++) {
      let pick = -1;
      for (let i = 0; i < n; i++) if (!done[i] && indeg[i] === 0 && (pick < 0 || key(i) < key(pick))) pick = i;
      if (pick < 0) for (let i = 0; i < n; i++) if (!done[i] && (pick < 0 || key(i) < key(pick))) pick = i;
      done[pick] = true;
      order.push(items[pick]);
      for (const j of after[pick]) indeg[j]--;
    }
    return order;
  }

  function compare(a, b, v) {
    if (a.z1 <= b.z0 + 1e-3) return -1;
    if (b.z1 <= a.z0 + 1e-3) return 1;
    const s = separate(a.fp, b.fp, v);
    if (s) return s;
    return a._depth + a.bias * 10 < b._depth + b.bias * 10 ? -1 : 1;
  }

  function separate(A, B, v) {
    for (const poly of [A, B]) {
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i];
        const q = poly[(i + 1) % poly.length];
        const nx = q[1] - p[1];
        const ny = p[0] - q[0];
        const len = Math.hypot(nx, ny);
        if (len < 1e-9) continue;
        const s = (nx * v[0] + ny * v[1]) / len;
        if (Math.abs(s) < 1e-4) continue;
        let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
        for (const [x, y] of A) { const t = (x * nx + y * ny) / len; if (t < a0) a0 = t; if (t > a1) a1 = t; }
        for (const [x, y] of B) { const t = (x * nx + y * ny) / len; if (t < b0) b0 = t; if (t > b1) b1 = t; }
        if (a1 <= b0 + 0.05) return s > 0 ? -1 : 1;
        if (b1 <= a0 + 0.05) return s > 0 ? 1 : -1;
      }
    }
    return 0;
  }

  // A camera that keeps the scale fixed for a given elevation, so turning never zooms.
  function cameraFor(azimuth, elevation, W, H, pad = 22) {
    const U = { origin: [0, 0], scale: 1, azimuth, elevation };
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of FIT) {
      const [sx, sy] = k.iso(p, U);
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
    const scale = Math.min((W - pad * 2) / (x1 - x0), (H - pad * 2) / (y1 - y0));
    return { origin: [W / 2 - ((x0 + x1) / 2) * scale, H / 2 - ((y0 + y1) / 2) * scale], scale, azimuth, elevation };
  }

  return { staticItems, dynamicItems, sortItems, cameraFor, FR };
}
