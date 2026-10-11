export function makeRng(seed) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => {
    let total = 0;
    for (let i = 0; i < 12; i++) total += next();
    return total - 6;
  };
  const int = (low, high) => low + Math.floor(next() * (high - low + 1));
  const pick = (list) => list[Math.floor(next() * list.length)];
  const shuffle = (list) => {
    const out = [...list];
    for (let index = out.length - 1; index > 0; index--) {
      const other = Math.floor(next() * (index + 1));
      [out[index], out[other]] = [out[other], out[index]];
    }
    return out;
  };
  const categorical = (probs) => {
    const u = next();
    let total = 0;
    for (let index = 0; index < probs.length; index++) {
      total += probs[index];
      if (u < total) return index;
    }
    return probs.length - 1;
  };
  return { next, normal, int, pick, shuffle, categorical };
}

export function fingerprint(values) {
  const view = new DataView(new ArrayBuffer(8));
  let hash = 0x811c9dc5;
  for (const value of values) {
    view.setFloat64(0, value);
    for (let byte = 0; byte < 8; byte++) {
      hash ^= view.getUint8(byte);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  }
  return hash.toString(16).padStart(8, "0");
}
