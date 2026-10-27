// docs/master/evidencias/scrum1387b/simular-el-aterrizaje.mjs — SCRUM-1387b
//
// LA PREGUNTA: ¿caduca este PR mientras espera, como caducó el #2286? Aquél llevaba 23 nombres escritos
// y cada banco que entraba en `main` lo dejaba en rojo. Aquí se fabrica ESE caso en un clon desechable:
//
//   1. `main` (el commit dado) recibe un banco con lista propia MIENTRAS esta rama espera;
//   2. esta rama se mezcla en ese `main` (lo que prueba el CI: el merge, no la rama);
//      → tiene que PASAR, con un heredado más que hoy;
//   3. después entra otro banco con lista propia;
//      → tiene que CAER, nombrando sólo ése.
//
//   node docs/master/evidencias/scrum1387b/simular-el-aterrizaje.mjs <sha de main>
//
// No toca este árbol: todo ocurre en un clon (`--shared`) dentro del temporal del sistema, que se borra.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const TEST = 'tests/scrum1387-banco-nuevo-va-al-catalogo.test.mjs';
const MAIN = process.argv[2];
if (!/^[0-9a-f]{40}$/.test(MAIN || '')) { console.log('uso: simular-el-aterrizaje.mjs <sha de main, 40 hex>'); process.exit(2); }
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1387b-aterrizaje-'));
const CLON = path.join(TMP, 'clon');
const git = (args, cwd = CLON) => execFileSync('git',
  ['-c', 'user.name=simulacion', '-c', 'user.email=simulacion@invalid', '-c', 'commit.gpgsign=false', ...args],
  { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function correr() {
  const salida = path.join(TMP, `pasada-${Date.now()}.tap`);
  const env = { ...process.env };
  for (const k of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'FORCE_COLOR']) delete env[k];
  spawnSync(process.execPath, ['--test', '--test-reporter=tap', `--test-reporter-destination=${salida}`, TEST],
    { cwd: CLON, env, encoding: 'utf8' });
  const tap = fs.existsSync(salida) ? fs.readFileSync(salida, 'utf8') : '';
  const n = (k) => Number((tap.match(new RegExp(`^# ${k} (\\d+)`, 'm')) || [])[1] ?? NaN);
  return { total: n('tests'), pasan: n('pass'), caen: n('fail'), tap, poblacion: (tap.match(/^# (población: .*)$/m) || [])[1] || '(sin población)' };
}
const numero = (r, palabra) => Number((r.poblacion.match(new RegExp(`(\\d+) ${palabra}`)) || [])[1] ?? NaN);
function meterBanco(nombre, mensaje) {
  const guion = `docs/master/evidencias/${nombre}/mutar.mjs`;
  fs.mkdirSync(path.join(CLON, path.dirname(guion)), { recursive: true });
  fs.writeFileSync(path.join(CLON, guion), 'const LISTA_PROPIA = [{ de: "a", a: "b" }];\n');
  git(['add', '--', guion]);
  git(['commit', '-q', '-m', mensaje]);
  return guion;
}

let mal = 0;
const dice = (ok, texto) => { if (!ok) mal += 1; console.log(`${ok ? 'OK ' : 'MAL'} | ${texto}`); };
try {
  const RAMA = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: RAIZ, encoding: 'utf8' }).trim();
  const sucio = execFileSync('git', ['status', '--porcelain'], { cwd: RAIZ, encoding: 'utf8' }).trim();
  console.log(`rama (HEAD de este árbol) ${RAMA}${sucio ? ' · ⚠️ con cambios sin comitear, que la simulación NO ve' : ''}`);
  console.log(`main de partida .......... ${MAIN}`);
  execFileSync('git', ['clone', '--quiet', '--shared', '--no-checkout', RAIZ, CLON], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git(['checkout', '-q', '--detach', MAIN]);
  dice(!fs.existsSync(path.join(CLON, TEST)), 'control: en ese main el test todavía NO existe');

  // 1 · entra un banco con lista propia mientras la rama espera
  const enVuelo = meterBanco('__entra-mientras-espera__', 'un banco entra en main mientras el PR espera');
  // 2 · la rama aterriza: es el merge que prueba el CI
  git(['merge', '-q', '--no-ff', '-m', 'Merge de la rama de SCRUM-1387b (simulado)', RAMA]);
  const a = correr();
  console.log(`   ${a.poblacion}`);
  dice(a.total > 0 && a.caen === 0, `al aterrizar con un banco que entró en vuelo: ${a.total} casos · ${a.pasan} pasan · ${a.caen} caen (tiene que pasar)`);
  dice(a.tap.includes('heredado · docs/master/evidencias/__entra-mientras-espera__ ·'), `el que entró en vuelo (${enVuelo}) sale como HEREDADO`);
  const heredadosAlAterrizar = numero(a, 'heredados');

  // 3 · después de aterrizar entra otro
  const tardio = meterBanco('__entra-despues__', 'un banco entra en main DESPUÉS de la regla');
  const b = correr();
  console.log(`   ${b.poblacion}`);
  dice(b.caen === 1 && b.tap.includes(`docs/master/evidencias/__entra-despues__ → ${tardio}`),
    `el que entra después: ${b.total} casos · ${b.pasan} pasan · ${b.caen} caen (tiene que caer 1 y nombrarlo)`);
  dice(!b.tap.includes('__entra-mientras-espera__ →'), 'y NO nombra al que entró en vuelo');
  dice(numero(b, 'heredados') === heredadosAlAterrizar && numero(b, 'nuevos') === 1,
    `heredados ${numero(b, 'heredados')} (igual que al aterrizar: ${heredadosAlAterrizar}) · nuevos ${numero(b, 'nuevos')}`);
} finally {
  fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 3 });
}
console.log(`mal ${mal}`);
console.log(`EXIT=${mal ? 1 : 0}`);
process.exit(mal ? 1 : 0);
