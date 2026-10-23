// SCRUM-1499c · corre la población de lectores del esquema sobre una variante de schema.prisma.
// uso: node correr.mjs <worktree> <poblacion.txt> <variante> <salida.tap>
import { spawnSync, execFileSync } from 'node:child_process';
import { readFileSync, existsSync, rmSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [wt, pob, variante, tap] = process.argv.slice(2);
const aqui = dirname(fileURLToPath(import.meta.url));
const ficheros = readFileSync(pob, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
const restaurar = () => execFileSync('git', ['-C', wt, 'checkout', '--', 'prisma/schema.prisma']);

restaurar();
const m = spawnSync(process.execPath, [join(aqui, '1499c-variantes-del-esquema.mjs'), join(wt, 'prisma/schema.prisma'), variante], { encoding: 'utf8' });
process.stdout.write(m.stdout + m.stderr);
if (m.status !== 0) { restaurar(); console.log('MUTACION NO APLICADA → CIEGO'); process.exit(3); }
const diff = execFileSync('git', ['-C', wt, 'diff', '--numstat', '--', 'prisma/schema.prisma'], { encoding: 'utf8' }).trim();
console.log(`diff del esquema: «${diff || '(vacío)'}»`);

if (existsSync(tap)) rmSync(tap);
const env = { ...process.env };
for (const k of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'FORCE_COLOR']) delete env[k];
const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-reporter=tap', `--test-reporter-destination=${tap}`, ...ficheros],
  { cwd: wt, env, encoding: 'utf8', maxBuffer: 1 << 28 });
restaurar();
const quedo = execFileSync('git', ['-C', wt, 'status', '--porcelain', '--', 'prisma/schema.prisma'], { encoding: 'utf8' }).trim();
console.log(`exit node --test: ${r.status} · esquema restaurado: ${quedo === '' ? 'sí' : 'NO → ' + quedo}`);
if (!existsSync(tap)) { console.log('SIN TAP → CIEGO'); process.exit(4); }
const t = readFileSync(tap, 'utf8');
console.log(`TAP: ${statSync(tap).size} B`);
const sum = (k) => (t.match(new RegExp(`^# ${k} (\\d+)$`, 'm')) || [])[1];
console.log(`tests ${sum('tests')} · pass ${sum('pass')} · fail ${sum('fail')} · skipped ${sum('skipped')} · cancelled ${sum('cancelled')} · ficheros ${ficheros.length}`);
const caen = [...t.matchAll(/^\s*not ok \d+ - (.*)$/gm)].map((x) => x[1]);
console.log(`not ok (todos los niveles): ${caen.length}`);
for (const c of caen) console.log('  ✖ ' + c);
