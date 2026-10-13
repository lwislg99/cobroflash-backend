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

// Cada mutación acaba en una de TRES. Una pasada sin recuento, o un `tsc` que no llegó a decir nada del
// fichero mutado, no es un VERDE: es no haber mirado. Hasta el 13-oct las dos se pintaban igual, y el
// guion salía 0 pasara lo que pasara. Lo cazó el censo de SCRUM-622 en el PR #2340.
const cuenta = { ROJO: 0, VERDE: 0, CIEGO: 0 };

console.log('M1 · la plantilla vuelve a pegar el total a la moneda');
if (mutar('src/modules/messaging/domain/merchantNotifications.ts', '${formatMoneyEs(total, currency)}', '${total} ${currency}')) {
  const r = tests(TRINQUETE);
  let sale;
  if (!(r.tests > 0) || Number.isNaN(r.fail)) sale = 'CIEGO';
  else if (r.fail > 0) sale = 'ROJO';
  else sale = 'VERDE';
  cuenta[sale]++;
  console.log(`  ${sale} · ${r.tests} tests · ${r.fail} caídos · ${r.caidos.join(' || ')}`);
  restaurar();
} else cuenta.CIEGO++;

console.log('M2 · quien llama vuelve a pasar toFixed(2)');
const MUTADO_M2 = 'src/modules/system/app/routes/quotesAdmin.routes.ts';
if (mutar(MUTADO_M2, 'total: Number(quote.total), // SCRUM-1288c', 'total: Number(quote.total).toFixed(2), // SCRUM-1288c')) {
  const tsc = path.join(RAIZ, 'node_modules', 'typescript', 'bin', 'tsc');
  const r = spawnSync(process.execPath, [tsc, '--noEmit', '-p', '.'], { cwd: RAIZ, env: entorno, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const errores = (r.stdout || '').split(/\r?\n/).filter((x) => /error TS\d+/.test(x));
  // Sólo cuenta el error que nombra el fichero mutado: uno de otro sitio no dice nada de esta mutación.
  const suyos = errores.filter((x) => x.split('\\').join('/').includes(MUTADO_M2));
  let sale;
  if (r.status === 0) sale = 'VERDE';
  else if (suyos.length) sale = 'ROJO';
  else sale = 'CIEGO';
  cuenta[sale]++;
  console.log(`  ${sale} · tsc --noEmit salida ${r.status} · ${errores.length} error(es) · ${(suyos[0] || errores[0] || '').slice(0, 200)}`);
  restaurar();
} else cuenta.CIEGO++;

const fin = tests(TRINQUETE);
console.log(`BASE (después) · trinquete: ${fin.tests} tests · ${fin.fail} caídos · salida ${fin.salida}`);
const baseRota = fin.fail !== 0 || !(fin.tests > 0);
console.log(`RECUENTO · 2 mutaciones · ${cuenta.ROJO} ROJO · ${cuenta.VERDE} VERDE · ${cuenta.CIEGO} CIEGO`);
const salida = cuenta.VERDE || cuenta.CIEGO || baseRota ? 1 : 0;
console.log(`EXIT=${salida}`);
process.exit(salida);
