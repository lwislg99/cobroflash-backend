// docs/master/evidencias/SCRUM-1324/negativos.mjs — SCRUM-1324b
//
// Los dos guards que tumbaron el PR #2047, vistos en ROJO otra vez DESPUÉS del arreglo. El arreglo
// fue cambiar el vigía (lee los obligatorios del único lector, y no mira en qué máquina corre); esto
// comprueba que no se calló a ningún guard: si alguien vuelve a hacer lo que hacía la rama, caen.
//
// Cada negativo deshace el arreglo o repite el defecto en un fichero NUEVO, corre los dos guards y
// apunta QUÉ caso cae, por su nombre. Primero la BASE sin tocar (A3). Un negativo que no cambia el
// árbol aborta: un rojo que no se inyectó y un verde no se distinguen. Al acabar restaura y lo
// comprueba por sha256 y con `git status`.
//
//   node docs/master/evidencias/SCRUM-1324/negativos.mjs     (desde la raíz, con el árbol limpio)
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const SUJETO = join(RAIZ, 'scripts', 'vigia-silencio-de-main.mjs');
const TESTS = [
  join('tests', 'scrum702-suelo-misma-poblacion.test.mjs'),
  join('tests', 'scrum853-avisador-solo-obligatorio.test.mjs'),
];
const CAE_702 = 'SCRUM-702 · 🔴 no entra NINGUNA dependencia del entorno nueva sin declararla';
const CAE_853 = '🔴 CENSO · en scripts/ y en los workflows, UN solo sitio lee la lista de obligatorios';
const sha = (t) => createHash('sha256').update(t).digest('hex');

const COPIA_DEL_LECTOR = [
  'const reglas = await gh(`repos/${REPO}/rules/branches/main`);',
  '  const obligatorios = reglas',
  "    .filter((r) => r.type === 'required_status_checks')",
  '    .flatMap((r) => r.parameters.required_status_checks.map((c) => c.context));',
].join('\n');

// [nombre, qué guard tiene que caer, cómo se inyecta]
const NEGATIVOS = [
  ['N1 el vigía vuelve a copiar la lectura de las reglas', CAE_853, { en: SUJETO,
    busca: 'const obligatorios = checksObligatoriosDeReglas(await gh(`repos/${REPO}/rules/branches/main`));',
    pone: COPIA_DEL_LECTOR }],
  ['N2 el vigía vuelve a elegir `gh` según la plataforma', CAE_702, { en: SUJETO,
    busca: "...(process.env.GH_BIN ? [process.env.GH_BIN] : []), ...RUTAS_GH]",
    pone: "...(process.env.GH_BIN ? [process.env.GH_BIN] : []), ...(process.platform === 'win32' ? [...RUTAS_GH].reverse() : RUTAS_GH)]" }],
  ['N3 OTRO script nuevo copia la lectura de las reglas', CAE_853, {
    crea: join(RAIZ, 'scripts', '_negativo-1324-copia.mjs'),
    con: "export const leer = (reglas) => reglas.filter((r) => r.type === 'required_status_checks');\n" }],
  ['N4 OTRO script nuevo mira en qué máquina corre', CAE_702, {
    crea: join(RAIZ, 'scripts', '_negativo-1324-plataforma.mjs'),
    con: "export const enWindows = () => process.platform === 'win32';\n" }],
];

const correr = () => {
  // El entorno del hijo, a mano: sin el contexto ni el color del proceso que lo lanza (A21).
  const env = { ...process.env };
  for (const k of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'FORCE_COLOR']) delete env[k];
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...TESTS], { cwd: RAIZ, env, encoding: 'utf8' });
  const lineas = r.stdout.split('\n');
  const pasan = lineas.filter((l) => /^ok \d+ - /.test(l)).length;
  const caen = lineas.filter((l) => /^not ok \d+ - /.test(l)).map((l) => l.replace(/^not ok \d+ - /, '').trim());
  return { exit: r.status, pasan, caen };
};

const original = readFileSync(SUJETO, 'utf8');
const huella = sha(original);
console.log(`POBLACION negativos=${NEGATIVOS.length} · guards=${TESTS.length} · sujeto sha256 ${huella.slice(0, 16)}`);

const base = correr();
console.log(`BASE sin tocar: exit ${base.exit} · pasan ${base.pasan} · caen ${base.caen.length}`);
if (base.exit !== 0 || base.pasan === 0) { console.log('CIEGO — la base no está verde: ningún negativo vale.'); console.log('EXIT=2'); process.exit(2); }

let mudos = 0;
try {
  for (const [nombre, esperado, como] of NEGATIVOS) {
    let aplicada;
    if (como.crea) {
      if (existsSync(como.crea)) { console.log(`CIEGO — ${nombre}: el fichero del negativo ya existía`); process.exitCode = 2; break; }
      writeFileSync(como.crea, como.con);
      aplicada = existsSync(como.crea);
    } else {
      if (original.split(como.busca).length !== 2) { console.log(`CIEGO — ${nombre}: el ancla no aparece exactamente una vez`); process.exitCode = 2; break; }
      writeFileSync(como.en, original.replace(como.busca, () => como.pone));
      aplicada = sha(readFileSync(como.en, 'utf8')) !== huella;
    }
    const r = aplicada ? correr() : null;
    if (como.crea) rmSync(como.crea, { force: true }); else writeFileSync(como.en, original);
    if (!aplicada) { console.log(`CIEGO — ${nombre}: el negativo no cambió el árbol`); process.exitCode = 2; break; }
    const cazado = r.caen.length === 1 && r.caen[0] === esperado;
    if (!cazado) mudos++;
    console.log(`${cazado ? 'CAE   ' : 'MUDO  '} ${nombre} · exit ${r.exit} · pasan ${r.pasan} de ${base.pasan} · caen ${r.caen.length}: ${r.caen.join(' | ')}`);
  }
} finally {
  writeFileSync(SUJETO, original);
  for (const [, , como] of NEGATIVOS) if (como.crea) rmSync(como.crea, { force: true });
}
const intacto = sha(readFileSync(SUJETO, 'utf8')) === huella;
console.log(`sujeto restaurado: ${intacto ? 'IDÉNTICO' : '🔴 DISTINTO'} (sha256 ${sha(readFileSync(SUJETO, 'utf8')).slice(0, 16)})`);
const estado = spawnSync('git', ['status', '--porcelain', '--', 'scripts', 'tests'], { cwd: RAIZ, encoding: 'utf8' });
const limpio = estado.status === 0 && estado.stdout.trim() === '';
console.log(`git status de scripts/ y tests/: ${limpio ? 'limpio' : `🔴 ${JSON.stringify(estado.stdout)}`}`);
const despues = correr();
console.log(`BASE después: exit ${despues.exit} · pasan ${despues.pasan} · caen ${despues.caen.length}`);
const salida = process.exitCode === 2 ? 2 : (mudos || !intacto || !limpio || despues.exit !== 0 ? 1 : 0);
console.log(`negativos cazados por el guard esperado ${NEGATIVOS.length - mudos} de ${NEGATIVOS.length} · mudos ${mudos}`);
console.log(`EXIT=${salida}`);
process.exitCode = salida;
