import fs from 'node:fs';
import path from 'node:path';

// Runs each challenge's starter and reference through the same harness the browser uses.
globalThis.self = {};
let results;
let fatal;
self.postMessage = (m) => {
  if (m.type === 'plan') results = [];
  if (m.type === 'result') results.push(m.result);
  if (m.type === 'fatal') fatal = m.message;
};
(0, eval)(fs.readFileSync('public/harness.js', 'utf8'));

function load(dir) {
  const files = {};
  const walk = (d) => {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) walk(p);
      else files[path.relative(dir, p).split(path.sep).join('/')] = fs.readFileSync(p, 'utf8');
    }
  };
  walk(dir);
  return files;
}

let bad = 0;
for (const id of fs.readdirSync('challenges')) {
  const tests = fs.readFileSync(`challenges/${id}/tests.js`, 'utf8');
  for (const kind of ['starter', 'reference']) {
    results = [];
    fatal = undefined;
    self.onmessage({ data: { files: load(`challenges/${id}/${kind}`), tests } });
    console.log(`\n${id}/${kind}` + (fatal ? ` FATAL ${fatal}` : ''));
    for (const t of results) console.log(`  ${t.pass ? 'ok  ' : 'FAIL'} [${t.task}] ${t.name}${t.pass ? '' : ' -> ' + t.error}`);
    const failing = results.filter((t) => !t.pass).length;
    // Starters should fail something. References should pass everything.
    if (fatal || (kind === 'reference' && failing) || (kind === 'starter' && !failing)) bad++;
  }
}
console.log(bad ? `\n${bad} problem(s)` : '\nall challenges look right');
process.exit(bad ? 1 : 0);
