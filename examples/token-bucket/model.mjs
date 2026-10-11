// The token bucket itself: the only place the numbers come from. The drawing
// moves coins and reads this model; it never keeps a second count of its own.
export const CAP = 10;
export const RATES = [0.5, 1, 1.5, 2, 2.5];
export const RATE_START = 1;

export function createBucket(cap = CAP) {
  return {
    cap,
    tokens: cap,
    granted: 0,
    denied: 0,
    spilled: 0,
    // is there room for one more token, counting `incoming` coins already on their way?
    hasRoom(incoming = 0) { return this.tokens + incoming < this.cap; },
    // a token arrives from the mint: kept if there is room, otherwise discarded
    add() {
      if (this.tokens < this.cap) { this.tokens += 1; return "added"; }
      this.spilled += 1;
      return "spilled";
    },
    // a token the mint already decided to throw away
    discard() { this.spilled += 1; return "spilled"; },
    // a request arrives: it takes one token or it is refused
    take() {
      if (this.tokens > 0) { this.tokens -= 1; this.granted += 1; return "granted"; }
      this.denied += 1;
      return "denied";
    },
  };
}

// The same bucket in continuous time, the way it is usually written down. The drawing is this
// formula with the tokens arriving one at a time.
export const refilled = (tokens, rate, seconds, cap = CAP) => Math.min(cap, tokens + rate * seconds);

// How many requests a bucket lets through in `seconds` if they arrive `every` seconds apart.
export function passes(requests, every, rate, cap = CAP) {
  const bucket = createBucket(cap);
  let ok = 0, clock = 0, mint = 0;
  for (let i = 0; i < requests; i++) {
    clock = i * every;
    while (mint + 1 / rate <= clock + 1e-9) { mint += 1 / rate; bucket.add(); }
    if (bucket.take() === "granted") ok++;
  }
  return ok;
}

if (process.argv[1] && process.argv[1].endsWith("model.mjs") && process.argv.includes("--test")) {
  const assert = (await import("node:assert")).default;
  assert.equal(passes(10, 0.01, 1), 10);          // a full bucket passes a burst of its capacity at once
  assert.equal(passes(20, 0.01, 1), 10);          // and not one more
  assert.equal(passes(100, 1, 1), 100);           // at exactly the refill rate nothing is refused
  assert.ok(passes(200, 0.25, 1) <= 10 + 200 * 0.25 * 1 + 1);  // long run: capacity + rate x time
  const b = createBucket(); for (let i = 0; i < 12; i++) b.take();
  assert.deepEqual([b.tokens, b.granted, b.denied], [0, 10, 2]);
  assert.equal(b.add(), "added"); assert.equal(createBucket().add(), "spilled");
  console.log("model ok");
}
