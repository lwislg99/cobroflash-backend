// Los dos rojos de SCRUM-1288c, sobre src/ (nunca dist/): cada mutación exige casar UNA vez, imprime su
// numstat y se restaura con git. Exige árbol limpio al empezar.
// Uso, desde la raíz del árbol:  node <ruta>/mutar-1288c.mjs
//   M1 · la plantilla vuelve a pegar el total a la moneda        → el trinquete del censo tiene que caer («resucitada»)
//   M2 · quien llama vuelve a pasar `toFixed(2)` (un texto)      → `tsc --noEmit` tiene que fallar: el tipo es `number`
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const RAIZ = process.cwd();
const entorno = { ...process.env };
for (const v of ['FORCE_COLOR', 'NODE_OPTIONS', 'QA_DB_TEST', 'LIBRO_PG_URL']) delete entorno[v];
const git = (...a) => spawnSync('git', a, { cwd: RAIZ, encoding: 'utf8' });
const sucio = () => git('status', '--porcelain').stdout.trim();
if (sucio()) { console.error('🔴 el árbol no está limpio: no se muta nada'); process.exit(2); }
console.log(`POBLACION · 2 mutaciones · HEAD ${git('rev-parse', 'HEAD').stdout.trim()}`);

function tests(ficheros) {
  const tap = path.join(os.tmpdir(), `mut1288c-${process.pid}-${Date.now()}.tap`);
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-reporter=tap', `--test-reporter-destination=${tap}`, ...ficheros], { cwd: RAIZ, env: entorno, encoding: 'utf8' });
  const l = fs.existsSync(tap) ? fs.readFileSync(tap, 'utf8').split(/\r?\n/) : [];
  if (fs.existsSync(tap)) fs.unlinkSync(tap);
  const n = (k) => Number((l.find((x) => x.startsWith(`# ${k} `)) || '').split(' ')[2] ?? NaN);
  const caidos = l.filter((x) => /^not ok \d+ - /.test(x)).map((x) => x.replace(/^not ok \d+ - /, '').slice(0, 110));
  return { salida: r.status, tests: n('tests'), fail: n('fail'), caidos };
}
function mutar(fichero, busca, pon) {
  const ruta = path.join(RAIZ, fichero);
  const t = fs.readFileSync(ruta, 'utf8');
  const veces = t.split(busca).length - 1;
  if (veces !== 1) { console.log(`  CIEGO: «${busca}» casa ${veces} veces en ${fichero}`); return false; }
  fs.writeFileSync(ruta, t.replace(busca, pon));
  console.log(`  numstat: ${git('diff', '--numstat').stdout.trim()}`);
  return true;
}
function restaurar() {
  git('restore', '--source=HEAD', '--staged', '--worktree', '.');
  console.log(`  restaurado · git status: [${sucio()}]`);
}
const TRINQUETE = ['tests/scrum1288b-el-importe-pegado-a-la-moneda.test.mjs', 'tests/scrum1452-gemelo-crudo.test.mjs'];

const base = tests(TRINQUETE);
console.log(`BASE (antes) · trinquete: ${base.tests} tests · ${base.fail} caídos · salida ${base.salida}`);
if (base.fail !== 0 || !(base.tests > 0)) { console.error('🔴 la base no está verde: no se muta nada'); process.exit(2); }

console.log('M1 · la plantilla vuelve a pegar el total a la moneda');
if (mutar('src/modules/messaging/domain/merchantNotifications.ts', '${formatMoneyEs(total, currency)}', '${total} ${currency}')) {
  const r = tests(TRINQUETE);
  console.log(`  ${r.fail > 0 ? 'ROJO' : 'VERDE'} · ${r.tests} tests · ${r.fail} caídos · ${r.caidos.join(' || ')}`);
  restaurar();
}

console.log('M2 · quien llama vuelve a pasar toFixed(2)');
if (mutar('src/modules/system/app/routes/quotesAdmin.routes.ts', 'total: Number(quote.total), // SCRUM-1288c', 'total: Number(quote.total).toFixed(2), // SCRUM-1288c')) {
  const tsc = path.join(RAIZ, 'node_modules', 'typescript', 'bin', 'tsc');
  const r = spawnSync(process.execPath, [tsc, '--noEmit', '-p', '.'], { cwd: RAIZ, env: entorno, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const errores = (r.stdout || '').split(/\r?\n/).filter((x) => /error TS\d+/.test(x));
  console.log(`  ${r.status !== 0 && errores.length ? 'ROJO' : 'VERDE'} · tsc --noEmit salida ${r.status} · ${errores.length} error(es) · ${(errores[0] || '').slice(0, 200)}`);
  restaurar();
}

const fin = tests(TRINQUETE);
console.log(`BASE (después) · trinquete: ${fin.tests} tests · ${fin.fail} caídos · salida ${fin.salida}`);
console.log('EXIT=0');
