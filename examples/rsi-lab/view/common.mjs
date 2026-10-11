import * as k from "../../../kit/iso-kit.mjs";
import { M, MAIN, BENCH, boxOf, centreOf, LAB_IDS } from "./lab.mjs";
import { TRAY, TRAYS, TRAY_Z, LIFT, liftOf } from "./rack.mjs";
import { ease } from "./engine.mjs";
import { framesFor, cubeLayout } from "./tensors.mjs";

export const RACK_IDS = ["mx-E", "mx-P", "mx-X0", ...Array.from({ length: 10 }, (_, i) => `card${i}`), "blk-b0", "blk-b1", "head-b0-0", "head-b0-1", "head-b1-0", "head-b1-1", "mx-b0-wo", "mx-b0-w1", "mx-b0-w2", "mx-b1-wo", "mx-b1-w1", "mx-b1-w2", "vec-b0", "vec-b1", "out-base", "mx-Wu", "bars-out", "card-next"];
export const TENSOR_IDS = ["t-X", "t-Wq", "t-Wk", "t-Wv", "t-Q", "t-K", "t-V", "t-S", "t-Z", "t-cube1", "t-cube2", "t-cube3"];
export const STATION_IDS = ["a-gen", "a-tests", "a-memory", "a-theta", "b-policy", "b-batch", "b-baseline", "c-archive", "c-bins"];
export const AGENT_IDS = ["ctx-lines", "cart-v0", "cart-v1", "cart-v2", "cart-v3"];
export const TRAY_IDS = TRAYS.flatMap((id) => [`tray-${id}`, `tray-${id}-front`]);

export function baseVisibility(ctx, { rack = false, tensors = false, stations = true, agent = false } = {}) {
  const show = new Set([...LAB_IDS, ...(stations ? STATION_IDS : []), ...(rack ? [...TRAY_IDS, ...RACK_IDS] : []), ...(tensors ? TENSOR_IDS : []), ...(agent ? AGENT_IDS : [])]);
  for (const [id] of ctx.engine.objects) if (!id.startsWith("pulse")) ctx.engine.pose(id, { visible: show.has(id) });
}

export function explode(ctx, share, { stagger = true, shrinkFront = true } = {}) {
  const s = Math.max(0, Math.min(1, share));
  TRAYS.forEach((id, index) => {
    const local = stagger ? ease(Math.max(0, Math.min(1, s * 1.6 - (3 - index) * 0.2))) : s;
    ctx.engine.pose(`tray-${id}`, { offset: liftOf(id, local), visible: true });
  });
  const front = ctx.engine.objects.get("modelo-front");
  if (front) front.level = s > 0.05 ? 5 : 100;
  ctx.engine.pose("modelo-front", { opacity: shrinkFront ? 1 - 0.6 * s : 1 });
}

export const labCamera = () => ({ points: [...k.boxCorners(MAIN, -18, 60), ...k.boxCorners(BENCH, -18, 10)], pad: 18 });
export const mainCamera = () => ({ points: k.boxCorners(MAIN, -18, 70), pad: 18 });
export const moduleCamera = (ids, extra = 30, opts = {}) => ({ points: ids.flatMap((id) => boxOf(id, extra)), pad: 30, ...opts });

export function trayBox(id, share = 1, dz = 0) {
  const z = TRAY_Z[id] + (LIFT[id] - TRAY_Z[id]) * share;
  return k.boxCorners(TRAY, z - 2, z + 16 + dz);
}
export const rackCamera = (share = 1) => ({ points: [...TRAYS.flatMap((id) => trayBox(id, share)), ...k.boxCorners(M.modelo.plan, 0, 84)], pad: 24 });
export const trayCamera = (id, opts = {}) => ({ points: trayBox(id, 1, opts.dz ?? 10), pad: opts.pad ?? 40, ...opts });
export function trayRegion(id, [x0, y0, x1, y1], opts = {}) {
  const z = LIFT[id] + 1.4;
  const out = [];
  for (const x of [TRAY.x + x0, TRAY.x + x1]) for (const y of [TRAY.y + y0, TRAY.y + y1]) for (const dz of [0, opts.h ?? 8]) out.push([x, y, z + dz]);
  return { points: out, pad: opts.pad ?? 30, area: opts.area ?? { left: 360 }, azimuth: opts.azimuth ?? 45, elevation: opts.elevation ?? 34 };
}
export function cutAbove(ctx, keep, share = 1, reveal = 1) {
  const order = ["emb", "b0", "b1", "out"];
  const hide = new Set(order.slice(order.indexOf(keep) + 1));
  const rack = new Set([...RACK_IDS, ...TRAY_IDS]);
  for (const [id, entry] of ctx.engine.objects) {
    const tray = id.startsWith("tray-") ? id.replace("tray-", "").replace("-front", "") : entry.parent ? entry.parent.replace("tray-", "") : null;
    if (!tray) continue;
    if (hide.has(tray)) ctx.pose(id, { visible: share < 0.999, opacity: Math.max(0, 1 - share) });
    else if (rack.has(id) && !id.startsWith("card")) ctx.pose(id, { visible: true, opacity: tray === keep ? reveal : 1 });
  }
}
export function fade(ctx, ids, value) {
  for (const id of ids) ctx.pose(id, { visible: value > 0.001, opacity: Math.max(0, Math.min(1, value)) });
}

export function cubeCamera(ctx, which, opts = {}) {
  const n = ctx.store.ids().length;
  const L = cubeLayout(n);
  const lift = LIFT.b0 - TRAY_Z.b0;
  const boxes = [].concat(which).map((key) => {
    const v = L[key].volume;
    const out = [];
    for (const x of [v.x0 - 1, v.x0 + v.X + 2]) for (const y of [v.y0 + 2, v.y0 - v.Y - 1]) for (const z of [v.z0 + 2, v.z0 - v.Z - 1]) out.push([x, y, z + lift]);
    return out;
  });
  return { points: boxes.flat(), pad: opts.pad ?? 50, azimuth: opts.azimuth ?? 38, elevation: opts.elevation ?? 26, area: { left: 440, bottom: 40 }, ...opts };
}

export { M, centreOf, framesFor, cubeLayout, TRAY, TRAY_Z, LIFT };

export const segment = (t, n) => {
  const k = Math.min(n, Math.max(1, Math.floor(t * n - 1e-9) + 1));
  return { k, u: Math.max(0, Math.min(1, t * n - (k - 1))) };
};
