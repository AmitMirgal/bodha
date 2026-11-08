const { LRUCache } = require('./src/lru');

function clocked(opts) {
  const clock = { t: 0 };
  const cache = new LRUCache({ ...opts, now: () => clock.t });
  return { cache, clock };
}

// ---- bugs ----
test('bugs', 'an entry expires exactly when its age reaches ttlMs', () => {
  const { cache, clock } = clocked({ capacity: 5, ttlMs: 100 });
  cache.set('a', 1);
  clock.t = 99;
  expect(cache.get('a')).toBe(1);
  clock.t = 100;
  expect(cache.get('a')).toBe(undefined);
});
test('bugs', 'reading a key makes it the most recently used', () => {
  const { cache } = clocked({ capacity: 2 });
  cache.set('a', 1);
  cache.set('b', 2);
  cache.get('a');
  cache.set('c', 3);
  expect(cache.get('a')).toBe(1);
  expect(cache.get('b')).toBe(undefined);
});
test('bugs', 'overwriting a key does not use up extra space', () => {
  const { cache } = clocked({ capacity: 2 });
  cache.set('a', 1);
  cache.set('a', 2);
  cache.set('b', 3);
  expect(cache.size).toBe(2);
  expect(cache.get('a')).toBe(2);
  expect(cache.get('b')).toBe(3);
});
test('bugs', 'expired entries do not count toward size or capacity', () => {
  const { cache, clock } = clocked({ capacity: 2, ttlMs: 10 });
  cache.set('a', 1);
  clock.t = 20;
  expect(cache.get('a')).toBe(undefined);
  expect(cache.size).toBe(0);
  cache.set('b', 2);
  cache.set('c', 3);
  expect(cache.get('b')).toBe(2);
  expect(cache.get('c')).toBe(3);
});
test('bugs', 'any string works as a key, even ones like "constructor"', () => {
  const { cache } = clocked({ capacity: 1 });
  cache.set('a', 1);
  cache.set('constructor', 2);
  expect(cache.get('a')).toBe(undefined);
  expect(cache.get('constructor')).toBe(2);
  expect(cache.size).toBe(1);
});

// ---- feature ----
test('feature', 'stats counts hits, misses and size', () => {
  const { cache } = clocked({ capacity: 3 });
  cache.set('a', 1);
  cache.get('a');
  cache.get('nope');
  expect(cache.stats()).toEqual({ hits: 1, misses: 1, hitRate: 0.5, size: 1 });
});
test('feature', 'hitRate is 0 before any lookups', () => {
  const { cache } = clocked({ capacity: 3 });
  expect(cache.stats().hitRate).toBe(0);
});
test('feature', 'an expired lookup counts as a miss', () => {
  const { cache, clock } = clocked({ capacity: 3, ttlMs: 5 });
  cache.set('a', 1);
  clock.t = 5;
  cache.get('a');
  expect(cache.stats().misses).toBe(1);
});
test('feature', 'delete removes a key and reports whether it existed', () => {
  const { cache } = clocked({ capacity: 3 });
  cache.set('a', 1);
  expect(cache.delete('a')).toBe(true);
  expect(cache.delete('a')).toBe(false);
  expect(cache.get('a')).toBe(undefined);
  expect(cache.size).toBe(0);
});

// ---- perf ----
function lcg(seed) {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}
// A slow but obviously-correct model to compare against.
function model(capacity) {
  const order = [];
  const vals = new Map();
  return {
    get(k) {
      if (!vals.has(k)) return undefined;
      order.splice(order.indexOf(k), 1);
      order.push(k);
      return vals.get(k);
    },
    set(k, v) {
      if (vals.has(k)) order.splice(order.indexOf(k), 1);
      else if (order.length >= capacity) vals.delete(order.shift());
      order.push(k);
      vals.set(k, v);
    },
  };
}

test('perf', 'matches a reference LRU over a long random workload', () => {
  const cache = new LRUCache({ capacity: 50 });
  const ref = model(50);
  const rnd = lcg(3);
  for (let i = 0; i < 5000; i++) {
    const k = 'k' + Math.floor(rnd() * 120);
    if (rnd() < 0.5) {
      cache.set(k, i);
      ref.set(k, i);
    } else {
      expect(cache.get(k)).toBe(ref.get(k));
    }
  }
});
test('perf', '300,000 operations on a 20,000-entry cache in under 1s', () => {
  const cap = 20000;
  const cache = new LRUCache({ capacity: cap });
  const rnd = lcg(11);
  const keys = [];
  for (let i = 0; i < 300000; i++) keys.push('k' + Math.floor(rnd() * 40000));
  const t0 = performance.now();
  for (let i = 0; i < keys.length; i++) {
    if (i % 2) cache.set(keys[i], i);
    else cache.get(keys[i]);
  }
  const ms = performance.now() - t0;
  expect(cache.size <= cap).toBe(true);
  expect(ms).toBeLessThan(1000);
});
