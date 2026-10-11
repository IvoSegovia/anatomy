import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import { kitScript } from "../../scripts/inline-kit.mjs";
import { CAP, RATES, RATE_START } from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 720;
const HEIGHT = 470;

// ── world ───────────────────────────────────────────────────────────────────────────────────
const PLATE = { x: -82, y: -76, w: 166, d: 152, r: 10 };
const PLATE_H = 10;
const FOOT_H = 5;

const COIN_R = 14;
const COIN_H = 3.6;
const BED_Z = 4; // top of the bed the stack stands on
const BED = { x: -27, y: -20, w: 73, d: 40, r: 2 };
const POSTS = [[-21.5, -21.5], [21.5, -21.5], [-21.5, 21.5], [21.5, 21.5]];
const POST_R = 2.4;
const FRAME_Z = 52; // the four bars that tie the posts
const FRAME_H = 4;
const COIN_Z = (i) => BED_Z + i * COIN_H;
const CAP_Z = COIN_Z(CAP); // the stop collar: the bucket holds this many

const PIVOT = [-54, 0]; // the mint arm turns about this post
const ARM = 54; // arm reach: the coin cup sits this far out
const ARM_Z = 62;
const ARM_H = 5;
const CARRY_Z = 57; // underside of a carried coin
const MINT = [-54, -54]; // the coin source, at the back
const SPILL = [-54, 54]; // the reject drum, at the front
const PAD_Z = CARRY_Z; // a coin waits on the mint pad at this height
const DROP_Z = 40; // top of the spill box
const SOCKET_R = COIN_R + 0.6;
const PSI_MINT = -Math.PI / 2;
const PSI_CAGE = 0;
const PSI_SPILL = Math.PI / 2;

const PUSH_FROM = -15; // tip of the pusher bar at rest, touching the bottom coin
const PUSH_STROKE = 34;
const BOX = { x: 46, y: -22, w: 28, d: 44, r: 3 };
const KNOB = [-2, 44];

const C = { PIVOT, ARM, ARM_Z, ARM_H, CARRY_Z, KNOB, RATES };

const P = k.fitProjection(
  [
    ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
    [PIVOT[0], PIVOT[1], ARM_Z + ARM_H + 4],
    [POSTS[3][0], POSTS[3][1], FRAME_Z + FRAME_H],
    [MINT[0], MINT[1], ARM_Z + ARM_H + 6],
    [PIVOT[0] - 26, PIVOT[1], ARM_Z + ARM_H + 4],
  ],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 42 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const depth = (x, y) => k.depthOf([x, y, 0], P);
const byDepth = (points) => [...points].sort((a, b) => depth(a[0], a[1]) - depth(b[0], b[1]));
const slide = (x, y, z) => k.translateAlong(P, [x, y, z]);

// ── the two parts that are rebuilt while they move ──────────────────────────────────────────
// They take the kit as an argument so the page can run the very same code as this build.
function armSvg(kit, P, C, psi) {
  const [px, py] = C.PIVOT;
  const cos = Math.cos(psi), sin = Math.sin(psi);
  const turn = (ring) => ring.map(([u, v]) => [px + u * cos - v * sin, py + u * sin + v * cos]);
  const out = [];
  const bar = kit.extrude(turn(kit.ringOf({ x: -14, y: -4, w: C.ARM + 4 + 14, d: 8, r: 3.8 }, 5)), C.ARM_Z, C.ARM_H, P, { bevel: 0.5 });
  const weight = kit.extrude(turn(kit.ringOf({ x: -24, y: -5.6, w: 10.4, d: 11.2, r: 2 }, 3)), C.ARM_Z, C.ARM_H, P, { bevel: 0.4 });
  const tip = [px + C.ARM * cos, py + C.ARM * sin];
  // the suction cup hangs under the tip, the coin hangs from the cup
  out.push(kit.solidSvg(kit.cylinder(tip[0], tip[1], 4.4, C.CARRY_Z + 3.6, C.ARM_Z - C.CARRY_Z - 3.6, P, 20), { tone: "lo" }));
  out.push(kit.solidSvg(kit.cylinder(tip[0], tip[1], 2.2, C.CARRY_Z + 3.6, 0.8, P, 14), { tone: "mid", crease: "none" }));
  out.push(kit.solidSvg(weight, { tone: "mid" }));
  out.push(kit.solidSvg(bar, { tone: "mid" }));
  const top = C.ARM_Z + C.ARM_H;
  const along = (a, b) => [[px + a * cos, py + a * sin], [px + b * cos, py + b * sin]];
  const [g0, g1] = along(11, C.ARM - 1);
  out.push(kit.lineSvg(kit.lineOnTop(g0, g1, top, P), { tone: "faint" }));
  out.push(kit.dotsSvg([along(C.ARM - 1, 0)[0], along(11, 0)[0]].map(([x, y]) => kit.iso([x, y, top], P)), { size: 0.45 }));
  out.push(kit.dotsSvg([along(-19, 0)[0]].map(([x, y]) => kit.iso([x, y, top], P)), { size: 0.45 }));
  out.push(kit.solidSvg(kit.cylinder(px, py, 6.4, top, 3, P, 28, 0.4), { tone: "hi" }));
  out.push(kit.lineSvg(kit.ring(px, py, 3.6, top + 3, P, 20), { tone: "lo" }));
  out.push(kit.dotsSvg([kit.iso([px, py, top + 3], P)], { size: 0.5, tone: "hi" }));
  return out.join("");
}

function knobPointerSvg(kit, P, C, rate) {
  const [x, y] = C.KNOB;
  const first = C.RATES[0], last = C.RATES[C.RATES.length - 1];
  const share = (rate - first) / (last - first);
  const angle = (-135 + share * 270) * Math.PI / 180; // 0 points to -y, clockwise from above
  const z = 8 + 5.2;
  const a = [x - Math.sin(angle) * 1.2, y + Math.cos(angle) * 1.2];
  const b = [x + Math.sin(angle) * 6.2, y - Math.cos(angle) * 6.2];
  return kit.lineSvg(kit.lineOnTop(a, b, z, P), { tone: "lit", free: "end" });
}

// ── static art ──────────────────────────────────────────────────────────────────────────────
function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // ruler strip along the near edge
  const strip = { x: -26, y: PLATE.y + PLATE.d - 15, w: 98, d: 7, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.8, 0.6, [2, 3], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 2, strip.y + 3.5, 0.6]), at([strip.x + strip.w - 2, strip.y + 3.5, 0.6])], { size: 0.45 }));
  // label plate at the back right
  const label = { x: 34, y: -66, w: 42, d: 13, r: 1.6 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.4), 0.8, P, 3), { tone: "faint" }));
  out.push(D(k.corners(label, 3.2).map(([x, y]) => at([x, y, 0.8])), { size: 0.4 }));
  out.push(k.faceTextSvg(k.topMatrix([label.x + label.w / 2, label.y + label.d / 2 + 1], 0.8, P, "x"), "TOKEN BUCKET", { size: 3.2, tone: "mid", anchor: "middle" }));
  return out.join("");
}

function bed() {
  const out = [];
  out.push(S(k.slabOf(BED, 0, BED_Z, P, 4, 0.5), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(BED, 2.4), BED_Z, P, 4), { tone: "faint" }));
  out.push(D(k.corners(BED, 4.6).map(([x, y]) => at([x, y, BED_Z])), { size: 0.45 }));
  // the lane the coin slides along
  out.push(L(k.lineOnTop([-8, 0], [BED.x + BED.w - 3, 0], BED_Z, P), { tone: "faint", dotted: true }));
  return out.join("");
}

function rail(y) {
  const plan = { x: BED.x + 1, y, w: BED.x + BED.w - 3 - (BED.x + 1) + 4, d: 1.8, r: 0.6 };
  const out = [S(k.slabOf(plan, BED_Z, 5, P, 2, 0.35), { tone: "mid" })];
  out.push(D([at([plan.x + 4, y + 0.9, BED_Z + 5]), at([plan.x + plan.w - 4, y + 0.9, BED_Z + 5])], { size: 0.4 }));
  return out.join("");
}

function post([px, py], index) {
  const out = [];
  const graduated = index === 1 || index === 2;
  out.push(S(k.cylinder(px, py, 3.6, BED_Z, 1.6, P, 22), { tone: "mid" }));
  out.push(S(k.cylinder(px, py, POST_R, BED_Z + 1.6, FRAME_Z - BED_Z - 1.6, P, 20), { tone: "mid", crease: "none" }));
  if (graduated) {
    const arcs = [];
    for (let i = 1; i < CAP; i++) if (i !== 5) arcs.push(k.sideArc(px, py, POST_R, COIN_Z(i), P, 12));
    out.push(L(arcs.join(""), { tone: "lo" }));
    out.push(S(k.cylinder(px, py, 3.1, COIN_Z(5) - 0.5, 1, P, 20), { tone: "mid" }));
  }
  out.push(S(k.cylinder(px, py, 3.1, CAP_Z - 0.6, 1.2, P, 20), { tone: "hi" })); // the stop collar
  out.push(S(k.cylinder(px, py, 3.4, FRAME_Z, FRAME_H, P, 22, 0.35), { tone: "mid" }));
  out.push(D([at([px, py, FRAME_Z + FRAME_H])], { size: 0.45 }));
  return out.join("");
}

function bar(plan) {
  const out = [S(k.slabOf(plan, FRAME_Z, FRAME_H, P, 2, 0.3), { tone: "mid" })];
  const long = plan.w > plan.d;
  const mid = long ? [plan.x + plan.w / 2, plan.y + plan.d / 2] : [plan.x + plan.w / 2, plan.y + plan.d / 2];
  out.push(D([at([mid[0], mid[1], FRAME_Z + FRAME_H])], { size: 0.4 }));
  return out.join("");
}

function solenoid() {
  const plan = { x: -44, y: -12, w: 17, d: 24, r: 2 };
  const out = [`<path class="iso-halo" d="${k.haloOf(plan, 0, 13, P)}"/>`];
  const seams = [9, 10.4, 11.8].map((z) => L(k.sideSeam(plan, z, P, 4), { tone: "faint" })).join("");
  out.push(S(k.slabOf(plan, 0, 13, P, 4, 0.6), { tone: "mid", inner: seams }));
  out.push(S(k.slabOf(k.insetPlan(plan, 1.2), 13, 1.4, P, 3, 0.3), { tone: "mid" }));
  out.push(D(k.corners(plan, 3.4).map(([x, y]) => at([x, y, 14.4])), { size: 0.42 }));
  // the mouth the pusher bar comes out of
  const x = plan.x + plan.w;
  out.push(L([[-9.6, 3.2], [9.6, 3.2], [9.6, 7.6], [-9.6, 7.6]].map(([y, z], index, list) => k.segment([x, y, z], [x, list[(index + 1) % 4][0], list[(index + 1) % 4][1]], P)).join(""), { tone: "lo" }));
  return out.join("");
}

function pusherBar() {
  const plan = { x: -27, y: -8, w: 12, d: 16, r: 1 };
  const out = [S(k.slabOf(plan, BED_Z, 3, P, 3, 0.35), { tone: "mid" })];
  out.push(L(k.lineOnTop([plan.x, 0], [plan.x + plan.w, 0], BED_Z + 3, P), { tone: "faint" }));
  out.push(D([at([plan.x + 2.4, -5, BED_Z + 3]), at([plan.x + 2.4, 5, BED_Z + 3])], { size: 0.4 }));
  return out.join("");
}

function requestButton() {
  const x = -35.5, y = 0;
  const out = [S(k.cylinder(x, y, 4.4, 0, 0.001, P, 24), { tone: "lo", flat: true })];
  out.push(S(k.cylinder(x, y, 3.4, 14.4, 2.6, P, 28, 0.4), { tone: "hi" }));
  out.push(L(k.ring(x, y, 2, 17, P, 20), { tone: "lo" }));
  return out.join("");
}

function buttonSeat() {
  const x = -35.5, y = 0;
  return L(k.ring(x, y, 4.4, 14.4, P, 28), { tone: "lo" });
}

function pillar() {
  const [x, y] = PIVOT;
  const out = [`<path class="iso-halo" d="${k.haloOf({ x: x - 9, y: y - 9, w: 18, d: 18, r: 9 }, 0, 3, P)}"/>`];
  out.push(S(k.cylinder(x, y, 9, 0, 3, P, 36, 0.5), { tone: "mid" }));
  out.push(D(byDepth([[x - 6.2, y - 6.2], [x + 6.2, y - 6.2], [x - 6.2, y + 6.2], [x + 6.2, y + 6.2]]).map(([a, b]) => at([a, b, 3])), { size: 0.4 }));
  out.push(S(k.cylinder(x, y, 5, 3, 55, P, 28), { tone: "mid", crease: "none" }));
  out.push(L(k.knurl(x, y, 5, 17, 42, 14, P, 0.3), { tone: "lo" }));
  for (const z of [16, 40]) out.push(S(k.cylinder(x, y, 6.4, z, 3, P, 28, 0.3), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, 7.6, 58, 4, P, 32, 0.4), { tone: "mid" }));
  return out.join("");
}

function tower(centre, top, tone) {
  const [cx, cy] = centre;
  const out = [`<path class="iso-halo" d="${k.haloOf({ x: cx - 18, y: cy - 18, w: 36, d: 36, r: 18 }, 0, 4, P)}"/>`];
  out.push(S(k.cylinder(cx, cy, 18, 0, 3, P, 44, 0.5), { tone: "lo" }));
  out.push(S(k.cylinder(cx, cy, 16.4, 3, top - 7, P, 44), { tone, crease: "none", inner: [14, 30, top - 14].map((z) => L(k.sideArc(cx, cy, 16.4, z, P, 22), { tone: "faint" })).join("") }));
  out.push(L(k.knurl(cx, cy, 16.4, 14, 30, 40, P, 0.3) + k.knurl(cx, cy, 16.4, 30, top - 14, 40, P, 0.3), { tone: "lo" }));
  out.push(S(k.cylinder(cx, cy, 17.6, top - 4, 4, P, 48, 0.5), { tone }));
  out.push(L(k.ring(cx, cy, SOCKET_R, top, P, 48) + k.ring(cx, cy, SOCKET_R - 1.6, top, P, 48), { tone: "lo" }));
  out.push(D(byDepth([0, 1, 2, 3, 4, 5].map((i) => [cx + 16.3 * Math.cos((i * Math.PI) / 3 + 0.5), cy + 16.3 * Math.sin((i * Math.PI) / 3 + 0.5)])).map(([x, y]) => at([x, y, top])), { size: 0.42 }));
  return out.join("");
}

function grantedBox() {
  const lid = { x: BOX.x + 1, y: BOX.y + 1, w: BOX.w - 2, d: BOX.d - 2, r: 2.4 };
  const out = [`<path class="iso-halo" d="${k.haloOf(BOX, 0, 24, P)}"/>`];
  const seams = [6, 17].map((z) => L(k.sideSeam(BOX, z, P, 5), { tone: "faint" })).join("");
  out.push(S(k.slabOf(BOX, 0, 24, P, 5, 0.6), { tone: "mid", inner: seams }));
  out.push(S(k.slabOf(lid, 24, 2, P, 4, 0.4), { tone: "mid" }));
  out.push(D(k.dotGrid(BOX.x + 6, BOX.y + 8, 4, 8, 4.1, 26, P), { size: 0.4, tone: "lo" }));
  out.push(D(k.corners(lid, 2.6).map(([x, y]) => at([x, y, 26])), { size: 0.42 }));
  return out.join("");
}

function rateKnob() {
  const [x, y] = KNOB;
  const out = [`<path class="iso-halo" d="${k.haloOf({ x: x - 13, y: y - 13, w: 26, d: 26, r: 13 }, 0, 2, P)}"/>`];
  out.push(S(k.cylinder(x, y, 13, 0, 2.4, P, 48, 0.4), { tone: "lo" }));
  const ticks = k.radialTicks(x, y, 9.6, 20, 5, 2.4, [1.3, 2.4], P, (-135 * Math.PI) / 180, (270 * Math.PI) / 180);
  out.push(L(k.ring(x, y, 9.6, 2.4, P, 56), { tone: "lo" }));
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(S(k.cylinder(x, y, 7.6, 2.4, 5.6, P, 36, 0.4), { tone: "hi" }));
  out.push(L(k.sideArc(x, y, 7.6, 3.6, P, 24), { tone: "faint" }));
  out.push(L(k.knurl(x, y, 7.6, 3.6, 8, 30, P, 0.3), { tone: "lo" }));
  out.push(L(k.ring(x, y, 5.4, 8, P, 28), { tone: "lo" }));
  out.push(D([at([x, y, 8])], { size: 0.5, tone: "hi" }));
  return out.join("");
}

// ── coins ───────────────────────────────────────────────────────────────────────────────────
function coinSvg() {
  const out = [S(k.cylinder(0, 0, COIN_R, 0, COIN_H, P, 56, 0.5), { tone: "hi" })];
  out.push(L(k.knurl(0, 0, COIN_R, 0.5, COIN_H - 0.5, 72, P, 0.2), { tone: "lo" }));
  out.push(L(k.ring(0, 0, COIN_R - 2.2, COIN_H, P, 48) + k.ring(0, 0, 4.6, COIN_H, P, 24), { tone: "faint" }));
  out.push(D([at([0, 0, COIN_H])], { size: 0.5, tone: "mid" }));
  return out.join("");
}

function floatRing() {
  const [px, py] = POSTS[2];
  const out = [S(k.cylinder(px, py, 3.8, 0, 1.8, P, 22, 0.25), { tone: "hi", lit: true })];
  out.push(S(k.slabOf({ x: px - 9, y: py - 1.4, w: 6, d: 2.8, r: 0.7 }, 0, 1.8, P, 2, 0.2), { tone: "hi", lit: true }));
  return out.join("");
}

// A coin sunk in a socket is hidden by the socket's near wall: keep only what is above the near
// half of the rim, in screen space.
function clipAbove(centre, z, id) {
  const az = (P.azimuth * Math.PI) / 180;
  const arc = [];
  for (let i = 0; i <= 28; i++) {
    const theta = az - Math.PI / 2 + (Math.PI * i) / 28;
    arc.push(k.iso([centre[0] + SOCKET_R * Math.cos(theta), centre[1] + SOCKET_R * Math.sin(theta), z], P));
  }
  const first = arc[0], last = arc[arc.length - 1];
  const polygon = [[first[0] - 8, first[1]], ...arc, [last[0] + 8, last[1]], [last[0] + 8, -600], [first[0] - 8, -600]];
  return `<clipPath id="${id}"><path d="${k.pathOf(polygon, true)}"/></clipPath>`;
}

// ── assemble, back to front ─────────────────────────────────────────────────────────────────
const coin = coinSvg();
const items = [];
const put = (key, svg) => items.push({ key, svg });

put(-1e6, plate());
put(-100, bed());
put(depth(SPILL[0], SPILL[1]), tower(SPILL, DROP_Z, "mid"));
put(depth(PIVOT[0], PIVOT[1]), pillar());
put(depth(-35.5, 0), solenoid() + buttonSeat());
put(depth(MINT[0], MINT[1]), tower(MINT, PAD_Z, "mid"));
put(depth(KNOB[0], KNOB[1]), rateKnob());
put(depth(60, 0), grantedBox());

// the cage: keys are set by hand where the pieces interlock
put(-30, post(POSTS[0], 0));
put(-8.2, post(POSTS[1], 1));
put(-8.1, post(POSTS[2], 2));
put(-7, rail(-17));
put(-9.5, bar({ x: -18.1, y: -23.5, w: 36.2, d: 4, r: 0.8 }));
put(-9.4, bar({ x: -23.5, y: -18.1, w: 4, d: 36.2, r: 0.8 }));

const stack = Array.from({ length: CAP }, (_, i) => `<g data-part="coin" data-i="${i}" transform="${slide(0, 0, COIN_Z(i))}">${coin}</g>`).join("");
const exits = Array.from({ length: 3 }, (_, i) => `<g data-part="exit" data-i="${i}" display="none" transform="${slide(0, 0, BED_Z)}">${coin}</g>`).join("");
put(
  0,
  `<g data-slot="cage">` +
    `<g data-part="bar" transform="${slide(0, 0, 0)}">${pusherBar()}</g>` +
    exits +
    `<g data-part="stack" transform="${slide(0, 0, 0)}">${stack}</g>` +
    `</g>`,
);

put(depth(9.5, 17), rail(15.2));
put(14.4, bar({ x: -18.1, y: 19.5, w: 36.2, d: 4, r: 0.8 }));
put(16, bar({ x: 19.5, y: -18.1, w: 4, d: 36.2, r: 0.8 }));
put(30, post(POSTS[3], 3));
put(31, `<g data-part="ring" transform="${slide(0, 0, COIN_Z(CAP))}">${floatRing()}</g>`);
put(depth(-35.5, 0) + 0.5, `<g data-part="button" transform="${slide(0, 0, 0)}">${requestButton()}</g>`);

items.sort((a, b) => a.key - b.key);

const knobPointer = `<g data-part="pointer">${knobPointerSvg(k, P, C, RATE_START)}</g>`;
const top =
  `<g data-slot="top">` +
  `<g clip-path="url(#clip-mint)"><g data-part="pad" transform="${slide(MINT[0], MINT[1], PAD_Z)}">${coin}</g></g>` +
  Array.from({ length: 3 }, () => `<g data-part="flyer-clip"><g data-part="flyer" display="none" transform="${slide(0, 0, 0)}">${coin}</g></g>`).join("") +
  `<g data-part="arm">${armSvg(k, P, C, PSI_MINT)}</g>` +
  `</g>`;

const defs = `<defs>${clipAbove(MINT, PAD_Z, "clip-mint")}${clipAbove(SPILL, DROP_Z, "clip-spill")}</defs>`;

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    `A token bucket built as a bench machine. A cage holds a stack of coins, one coin per token, at most ${CAP}. A mint arm swings round a post and brings one new coin every 1 over the refill rate seconds. If the cage has room the coin is dropped on the stack; if it is full the arm carries it on and drops it into a reject box, so the surplus is lost. A pusher bar pushes the bottom coin out of the cage each time a request arrives, and when the cage is empty it can only nudge at nothing: the request is refused.`,
  body: [defs, ...items.map((item) => item.svg), knobPointer, top],
});

// ── the page's live part ────────────────────────────────────────────────────────────────────
const model = readFileSync(join(HERE, "model.mjs"), "utf8").split("if (process.argv")[0].replace(/^export /gm, "");
const LIVE_CONSTANTS = { CAP, COIN_R, COIN_H, BED_Z, PUSH_STROKE, PUSH_FROM, PSI_MINT, PSI_CAGE, PSI_SPILL, MINT, SPILL, PIVOT, ARM, CARRY_Z, PAD_Z, DROP_Z, RATE_START };

const live = `
${model}
const P = ${JSON.stringify(P)};
const C = ${JSON.stringify(C)};
const K = ${JSON.stringify(LIVE_CONSTANTS)};
const armSvg = ${armSvg.toString()};
const knobPointerSvg = ${knobPointerSvg.toString()};
const kit = { extrude, ringOf, cylinder, solidSvg, lineSvg, dotsSvg, lineOnTop, ring, iso };

const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const one = (name) => svg.querySelector('[data-part="' + name + '"]');
const many = (name) => [...svg.querySelectorAll('[data-part="' + name + '"]')];
const els = { arm: one("arm"), bar: one("bar"), stack: one("stack"), ring: one("ring"), button: one("button"), pointer: one("pointer"), pad: one("pad") };
const coins = many("coin").sort((a, b) => a.dataset.i - b.dataset.i);
const cage = svg.querySelector('[data-slot="cage"]');
const flyers = many("flyer").map((el) => ({ el, wrap: el.parentNode, phase: "none", x: 0, y: 0, z: 0, vz: 0 }));
const exits = many("exit").map((el) => ({ el, active: false, age: 0, held: false }));

const at = (x, y, z) => translateAlong(P, [x, y, z]);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const show = (el, on) => (on ? el.removeAttribute("display") : el.setAttribute("display", "none"));
const GRAVITY = 700, SINK_TO = 14;
const GRANT_TIME = 0.36, DENY_TIME = 0.2, PUSH_OUT = 0.16;

const bucket = createBucket(K.CAP);
let rate = K.RATE_START, rateShown = rate, pointerDrawn = null;
let cycle = 0, carry = null, dest = null, psi = K.PSI_MINT, armDrawn = null, padRise = 1;
let lift = 0, holds = 0, stroke = null, queued = 0, pressed = 0;
let note = "", noteAge = 99;
let touring = !still.matches, clock = 0, idleTimer = 0, frame = 0, last = 0, visible = false;

const say = (word) => { note = word; noteAge = 0; };
const armEnd = (angle) => [K.PIVOT[0] + K.ARM * Math.cos(angle), K.PIVOT[1] + K.ARM * Math.sin(angle)];
const stackTop = () => K.BED_Z + lift + bucket.tokens * K.COIN_H;
const coming = () => flyers.filter((f) => f.phase === "fall").length;

// A coin is drawn in the layer where it physically is: on the arm above everything, inside the cage
// between its back and front posts, or over the reject box's socket (clipped by the socket's wall).
function phaseOf(f, phase) {
  f.phase = phase;
  show(f.el, phase !== "none");
  if (phase === "none") return;
  if (phase === "fall") cage.appendChild(f.wrap);
  else els.arm.parentNode.insertBefore(f.wrap, els.arm);
  if (phase === "spill") f.wrap.setAttribute("clip-path", "url(#clip-spill)");
  else f.wrap.removeAttribute("clip-path");
}

function pickUp() {
  const f = flyers.find((x) => x.phase === "none");
  if (!f) return;
  const [x, y] = armEnd(K.PSI_MINT);
  Object.assign(f, { x, y, z: K.CARRY_Z, vz: 0 });
  phaseOf(f, "carry");
  carry = f; dest = null; padRise = 0;
}

function stepArm(dt, calm) {
  const period = 1 / rate;
  cycle += dt;
  if (calm) {
    if (cycle >= period) { cycle -= period; if (bucket.hasRoom()) bucket.add(); else { bucket.discard(); say("spilled"); } }
    psi = K.PSI_MINT; padRise = 1;
    return;
  }
  if (cycle >= period) { cycle -= period; pickUp(); }
  const u = cycle / period;
  if (carry && dest === null && u >= 0.02) dest = bucket.hasRoom(coming()) ? "cage" : "spill";
  const there = dest === "spill" ? K.PSI_SPILL : K.PSI_CAGE;
  if (u < 0.02) psi = K.PSI_MINT;
  else if (u < 0.45) psi = lerp(K.PSI_MINT, there, smoothstep(0.02, 0.42, u));
  else psi = lerp(there, K.PSI_MINT, smoothstep(0.45, 0.85, u));
  if (carry && u >= 0.42) {
    const [x, y] = armEnd(psi);
    Object.assign(carry, { x, y, z: K.CARRY_Z, vz: 0 });
    phaseOf(carry, dest === "spill" ? "spill" : "fall");
    carry = null;
  }
  if (!carry && u >= 0.45 && padRise < 1) padRise = Math.min(1, padRise + dt / (0.35 * period));
}

function stepFlyers(dt) {
  for (const f of flyers) {
    if (f.phase === "carry") {
      const [x, y] = armEnd(psi);
      f.x = x; f.y = y;
    } else if (f.phase === "fall" || f.phase === "spill") {
      f.vz -= GRAVITY * dt;
      f.z += f.vz * dt;
      if (f.phase === "fall" && f.z <= stackTop()) { bucket.add(); phaseOf(f, "none"); }
      else if (f.phase === "spill" && f.z <= SINK_TO) { bucket.discard(); say("spilled"); phaseOf(f, "none"); }
    }
  }
}

const exitX = (age) => {
  if (age < PUSH_OUT) return K.PUSH_STROKE * (age / PUSH_OUT);
  const s = clamp((age - PUSH_OUT) / 0.42, 0, 1);
  return K.PUSH_STROKE + (60 - K.PUSH_STROKE) * (1 - Math.pow(1 - s, 2.2));
};
const barOffset = (s) => (s.kind === "deny" ? (s.age < DENY_TIME ? 5 * Math.sin((Math.PI * s.age) / DENY_TIME) : 0) : s.age < PUSH_OUT ? K.PUSH_STROKE * (s.age / PUSH_OUT) : K.PUSH_STROKE * (1 - smoothstep(PUSH_OUT, GRANT_TIME, s.age)));

function startStroke(calm) {
  if (stroke || queued === 0) return;
  queued -= 1;
  pressed = 1;
  const result = bucket.take();
  say(result);
  if (calm) return;
  if (result === "granted") {
    const e = exits.find((x) => !x.active);
    if (e) { Object.assign(e, { active: true, age: 0, held: true }); show(e.el, true); holds += 1; lift += K.COIN_H; }
    stroke = { age: 0, kind: "grant" };
  } else stroke = { age: 0, kind: "deny" };
}

function request() {
  queued = Math.min(queued + 1, 3);
  startStroke(still.matches);
}

function step(dt, calm) {
  if (touring) {
    clock += dt;
    const t = clock % 24;
    const due = (from, to, every) => t >= from && t < to && Math.floor((t - from) / every) !== Math.floor((t - dt - from) / every);
    if (due(3, 11, 0.42) || due(15, 16.2, 0.4)) request();
  }
  stepArm(dt, calm);
  stepFlyers(dt);
  if (stroke) {
    stroke.age += dt;
    if (stroke.age >= (stroke.kind === "deny" ? DENY_TIME : GRANT_TIME)) { stroke = null; startStroke(false); }
  }
  for (const e of exits) {
    if (!e.active) continue;
    e.age += dt;
    if (e.held && exitX(e.age) >= 2 * K.COIN_R + 0.5) { e.held = false; holds -= 1; }
    if (e.age > 0.7) { e.active = false; show(e.el, false); }
  }
  if (holds <= 0) { lift -= lift * (1 - Math.exp(-dt / 0.055)); if (lift < 0.002) lift = 0; }
  pressed = Math.max(0, pressed - dt / 0.18);
  noteAge += dt;
  rateShown += (rate - rateShown) * (1 - Math.exp(-dt / 0.12));
  if (Math.abs(rate - rateShown) < 0.001) rateShown = rate;
}

function draw() {
  const n = bucket.tokens;
  coins.forEach((el, i) => show(el, i < n));
  els.stack.setAttribute("transform", at(0, 0, lift));
  els.ring.setAttribute("transform", at(0, 0, clamp(stackTop(), K.BED_Z, K.BED_Z + K.CAP * K.COIN_H) - 0.9));
  els.bar.setAttribute("transform", at(stroke ? barOffset(stroke) : 0, 0, 0));
  els.button.setAttribute("transform", at(0, 0, -1.4 * Math.sin(Math.PI * clamp(pressed, 0, 1))));
  for (const e of exits) if (e.active) e.el.setAttribute("transform", at(exitX(e.age), 0, K.BED_Z));
  if (armDrawn === null || Math.abs(armDrawn - psi) > 0.0004) { els.arm.innerHTML = armSvg(kit, P, C, psi); armDrawn = psi; }
  for (const f of flyers) if (f.phase !== "none") f.el.setAttribute("transform", at(f.x, f.y, f.z));
  show(els.pad, padRise > 0.001);
  els.pad.setAttribute("transform", at(K.MINT[0], K.MINT[1], lerp(K.PAD_Z - 22, K.PAD_Z, smoothstep(0, 1, padRise))));
  if (pointerDrawn !== rateShown) { els.pointer.innerHTML = knobPointerSvg(kit, P, C, rateShown); pointerDrawn = rateShown; }
  const text = n + "/" + K.CAP + " tokens · " + rate.toFixed(1) + "/s" + (noteAge < 1.6 ? " · " + note : "");
  if (readout.textContent !== text) readout.textContent = text;
}

function loop(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  step(dt, still.matches);
  draw();
  frame = visible ? requestAnimationFrame(loop) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(loop); } };
const steer = () => { touring = false; clearTimeout(idleTimer); idleTimer = setTimeout(() => { touring = !still.matches; clock = 0; }, 6000); };
function setRate(next) {
  if (next === rate) return;
  cycle = (cycle / (1 / rate)) / next; // keep the arm where it is in its swing
  rate = next;
}

new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointerdown", () => { steer(); request(); run(); });
stage.addEventListener("keydown", (event) => {
  const index = RATES.indexOf(rate);
  if (event.key === " " || event.key === "Enter") { event.preventDefault(); steer(); request(); }
  else if (event.key === "ArrowRight" || event.key === "ArrowUp") { event.preventDefault(); steer(); setRate(RATES[Math.min(RATES.length - 1, index + 1)]); }
  else if (event.key === "ArrowLeft" || event.key === "ArrowDown") { event.preventDefault(); steer(); setRate(RATES[Math.max(0, index - 1)]); }
  else return;
  run();
});
window.__tb = { bucket, flyers, exits };
pickUp();
draw();
`;

const body = k.plateHtml({
  fig: "Fig 1",
  title: "Token bucket",
  hint: "Click to send a request · ← → refill rate",
  readout: `${CAP}/${CAP} tokens · ${RATE_START.toFixed(1)}/s`,
  keys: [
    { mark: "raised", label: `Tokens: the bucket holds at most ${CAP}` },
    { mark: "lit", label: "Level ring: rides the top token" },
  ],
  caption: `A token bucket never holds more than ${CAP} tokens. The mint arm brings one every 1 / rate seconds; if the bucket is full the new token is thrown away. Each request takes one token or, with none left, is refused. A burst of ${CAP} passes at once, but over a long time no more than the rate gets through.`,
  body: `<div class="iso-stage" tabindex="0" role="group" aria-label="Token bucket: space or enter sends a request, arrow keys change the refill rate">${svg}</div>`,
});

const file = theme === "light" ? "token-bucket-light.html" : "token-bucket.html";
writeFileSync(join(HERE, file), k.pageHtml({ title: "Token bucket", theme, body, script: kitScript() + live }));
console.log("wrote", file);
