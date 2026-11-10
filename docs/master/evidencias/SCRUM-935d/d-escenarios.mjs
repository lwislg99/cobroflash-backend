// Corre scrum810 + scrum810b en el clon para cada escenario (HEAD, origin/main) y dice pass/fail.
import { execFileSync, spawnSync } from 'node:child_process';
const [clon, M, D, E, DE, MD] = process.argv.slice(2);
const git = (...a) => execFileSync('git', ['-C', clon, ...a], { encoding: 'utf8' }).trim();
const escenarios = [
  ['0 · CONTROL: main sin tocar (HEAD=M, main=M)', M, M],
  ['1 · CONTROL POSITIVO: S5 sin la línea, como PR (HEAD=D, main=M)', D, M],
  ['2 · sólo la línea, como PR (HEAD=E, main=M)', E, M],
  ['3 · línea YA en main, luego S5 sin línea: merge de CI (HEAD=E+D, main=E)', MD, E],
  ['4 · JUNTAS en un PR (HEAD=DE, main=M)', DE, M],
  ['5 · juntas YA en main, el PR siguiente (HEAD=DE, main=DE)', DE, DE],
];
const env = { ...process.env, NO_COLOR: '1' };
delete env.FORCE_COLOR; delete env.NODE_TEST_CONTEXT; delete env.NODE_OPTIONS;
for (const [rotulo, head, main] of escenarios) {
  git('-c', 'advice.detachedHead=false', 'checkout', '-q', '--detach', head);
  git('update-ref', 'refs/remotes/origin/main', main);
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=spec',
    'tests/scrum810-el-suelo-a-la-primera.test.mjs', 'tests/scrum810b-los-suelos-derivados.test.mjs'],
  { cwd: clon, env, encoding: 'utf8', timeout: 300000 });
  const out = r.stdout || '';
  const num = (k) => (out.match(new RegExp(`ℹ ${k} (\\d+)`)) || [])[1];
  const caidos = [...out.matchAll(/^✖ (.+?) \(\d/gm)].map((m) => m[1]).filter((n, i, a) => a.indexOf(n) === i);
  console.log(`${rotulo}\n   status ${r.status} · tests ${num('tests')} · pass ${num('pass')} · fail ${num('fail')}${caidos.length ? `\n   caen: ${caidos.join(' | ')}` : ''}`);
}
