// docs/master/evidencias/scrum893/rojos-893b.mjs — SCRUM-893b
//
// Los dos rojos del pie de Stripe, inyectados de verdad en `src/` y con `tsc` entre uno y otro.
// Uso (desde la raíz del árbol, con TODO comiteado):  node docs/master/evidencias/scrum893/rojos-893b.mjs
//
// Cada mutación tiene que tumbar SU mitad y sólo la suya:
//   A · el pie sale siempre  (el código de antes) → caen los tres casos «NO dice»
//   B · el pie no sale nunca                      → caen los dos casos «SIGUE saliendo»
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const FUENTE = path.join(RAIZ, 'src', 'modules', 'billing', 'app', 'routes', 'payInvoice.routes.ts');
const TEST = 'tests/scrum893b-el-pie-de-stripe.test.mjs';
const TSC = path.join(RAIZ, 'node_modules', 'typescript', 'bin', 'tsc');
const DIV = '<div class="trust-sub">Procesado por Stripe · Nunca vemos los datos de tu tarjeta</div>';
const SANO = "${pasaPorStripe ? '" + DIV + "' : ''}";

const git = (...a) => execFileSync('git', a, { cwd: RAIZ, encoding: 'utf8' }).trim();

if (git('status', '--porcelain')) {
  console.error('🔴 CIEGO: el árbol tiene cambios sin comitear; restaurar se los llevaría. No se inyecta nada.');
  process.exit(2);
}

function compilar() {
  const r = spawnSync(process.execPath, [TSC], { cwd: RAIZ, encoding: 'utf8' });
  if (r.status !== 0) {
    console.error('🔴 CIEGO: el build falla, así que la tanda mediría un dist/ viejo.\n' + r.stdout + r.stderr);
    process.exit(2);
  }
}

/** Corre el banco y devuelve los nombres que caen, leídos del TAP (fuera del árbol). */
function caen() {
  const tap = path.join(os.tmpdir(), `rojos-893b-${process.pid}.tap`);
  const env = { ...process.env };
  delete env.FORCE_COLOR;
  spawnSync(process.execPath,
    ['--test', '--test-force-exit', '--test-reporter=tap', `--test-reporter-destination=${tap}`, TEST],
    { cwd: RAIZ, env, encoding: 'utf8' });
  const lineas = fs.readFileSync(tap, 'utf8').split(/\r?\n/);
  fs.rmSync(tap);
  const total = lineas.filter((l) => /^(not )?ok \d+ - /.test(l)).length;
  if (total !== 5) {
    console.error(`🔴 CIEGO: el banco registró ${total} casos y son 5.`);
    process.exit(2);
  }
  return lineas.filter((l) => /^not ok \d+ - /.test(l)).map((l) => l.replace(/^not ok \d+ - /, ''));
}

function mutar(nombre, reemplazo, esperados) {
  const antes = fs.readFileSync(FUENTE, 'utf8');
  if (antes.split(SANO).length !== 2) {
    console.error('🔴 CIEGO: el fuente no contiene exactamente una vez la línea sana; la mutación no se aplicaría.');
    process.exit(2);
  }
  fs.writeFileSync(FUENTE, antes.replace(SANO, reemplazo));
  const numstat = git('diff', '--numstat');
  compilar();
  const rojos = caen();
  git('restore', '--source=HEAD', '--worktree', '--', 'src/modules/billing/app/routes/payInvoice.routes.ts');
  console.log(`\n${nombre}\n  git diff --numstat: ${numstat}\n  caen ${rojos.length} de 5:`);
  for (const r of rojos) console.log(`    · ${r}`);
  const ok = rojos.length === esperados.length && esperados.every((e) => rojos.some((r) => r.includes(e)));
  console.log(ok ? '  ✔ cae lo suyo y sólo lo suyo' : `  ✘ se esperaban exactamente: ${esperados.join(' | ')}`);
  return ok;
}

compilar();
const base = caen();
console.log(`BASE sin mutar: caen ${base.length} de 5`);
if (base.length) process.exit(1);

const a = mutar('A · el pie sale SIEMPRE (el código de antes)', DIV,
  ['sólo transferencia', 'sólo Bizum manual', 'ninguna vía']);
const b = mutar('B · el pie no sale NUNCA', '',
  ['con tarjeta (Connect activo)', 'sin tarjeta pero con Bizum automático']);

compilar();
const fin = caen();
console.log(`\nRESTAURADO: caen ${fin.length} de 5 · git status: «${git('status', '--porcelain')}»`);
process.exit(a && b && fin.length === 0 ? 0 : 1);
