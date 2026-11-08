// Runs inside a Web Worker. Loads the candidate's files as CommonJS modules,
// runs the hidden tests against them and posts the results back.
const norm = (p) => {
  const out = [];
  for (const seg of p.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') out.pop();
    else out.push(seg);
  }
  return out.join('/');
};

const fmt = (v) => {
  try {
    const s = JSON.stringify(v);
    return s === undefined ? String(v) : s;
  } catch {
    return String(v);
  }
};

function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => deepEqual(a[k], b[k]));
}

function expect(actual) {
  return {
    toBe(want) {
      if (!Object.is(actual, want)) throw new Error(`Expected ${fmt(want)}, got ${fmt(actual)}`);
    },
    toEqual(want) {
      if (!deepEqual(actual, want)) throw new Error(`Expected ${fmt(want)}, got ${fmt(actual)}`);
    },
    toBeLessThan(want) {
      if (!(actual < want)) throw new Error(`Expected under ${fmt(want)}, got ${Math.round(actual)}`);
    },
    toThrow(match) {
      let err;
      let threw = false;
      try {
        actual();
      } catch (e) {
        threw = true;
        err = e;
      }
      if (!threw) throw new Error('Expected it to throw, but it did not');
      if (match && !String(err && err.message).includes(match)) {
        throw new Error(`Expected an error containing "${match}", got "${err && err.message}"`);
      }
    },
    not: {
      toThrow() {
        try {
          actual();
        } catch (e) {
          throw new Error(`Expected no error, got "${e && e.message}"`);
        }
      },
    },
  };
}

self.onmessage = (e) => {
  const { files, tests } = e.data;
  const cache = new Map();

  const makeRequire = (dir) => (req) => {
    if (!req.startsWith('.')) throw new Error(`Cannot find module '${req}'. Only relative imports work here.`);
    const base = norm(`${dir}/${req}`);
    const path = [base, `${base}.js`, `${base}/index.js`].find((c) => c in files);
    if (!path) throw new Error(`Cannot find module '${req}'`);
    if (cache.has(path)) return cache.get(path).exports;
    const module = { exports: {} };
    cache.set(path, module);
    const parent = path.split('/').slice(0, -1).join('/');
    new Function('module', 'exports', 'require', `${files[path]}\n//# sourceURL=${path}`)(
      module,
      module.exports,
      makeRequire(parent),
    );
    return module.exports;
  };

  const queue = [];
  const test = (task, name, fn) => queue.push({ task, name, fn });

  try {
    new Function('require', 'test', 'expect', tests)(makeRequire(''), test, expect);
  } catch (err) {
    // A module failed to load (usually a syntax error), so no test can run.
    self.postMessage({ type: 'fatal', message: String((err && err.message) || err) });
    return;
  }

  // Report as we go, so one slow or stuck test can't hide the results of the others.
  self.postMessage({ type: 'plan', tests: queue.map(({ task, name }) => ({ task, name })) });
  for (const { task, name, fn } of queue) {
    const t0 = performance.now();
    let result;
    try {
      fn();
      result = { task, name, pass: true, ms: performance.now() - t0 };
    } catch (err) {
      result = { task, name, pass: false, error: String((err && err.message) || err), ms: performance.now() - t0 };
    }
    self.postMessage({ type: 'result', result });
  }
  self.postMessage({ type: 'done' });
};
