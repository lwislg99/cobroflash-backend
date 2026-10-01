// docs/master/evidencias/SCRUM-1324/mutar.mjs — SCRUM-1324
//
// El test, visto en ROJO. Aplica una mutación cada vez a `scripts/vigia-silencio-de-main.mjs`,
// corre el test y apunta QUÉ casos caen; después restaura el fichero y comprueba, por sha256, que
// quedó idéntico. Primero la BASE sin mutar (A3): sin ella, un test inestable se lee como mutante
// muerto. Una mutación que no se aplica aborta: un rojo que no se inyectó y un verde no se distinguen.
//
//   node docs/master/evidencias/SCRUM-1324/mutar.mjs        (desde la raíz, con el árbol limpio)
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const SUJETO = join(RAIZ, 'scripts', 'vigia-silencio-de-main.mjs');
const TEST = join('tests', 'scrum1324-nadie-vigila-el-silencio.test.mjs');
const sha = (t) => createHash('sha256').update(t).digest('hex');

const MUTACIONES = [
  ['M01 umbral de rojos 5 → 4', 'export const UMBRAL_ROJOS_SEGUIDOS = 5;', 'export const UMBRAL_ROJOS_SEGUIDOS = 4;'],
  ['M02 umbral de rojos 5 → 6', 'export const UMBRAL_ROJOS_SEGUIDOS = 5;', 'export const UMBRAL_ROJOS_SEGUIDOS = 6;'],
  ['M03 umbral de runs sin ejecutar 22 → 23', 'export const UMBRAL_RUNS_SIN_EJECUTAR = 22;', 'export const UMBRAL_RUNS_SIN_EJECUTAR = 23;'],
  ['M04 umbral de horas de cron 10 → 11', 'export const UMBRAL_HORAS_DE_CRON = 10;', 'export const UMBRAL_HORAS_DE_CRON = 11;'],
  ['M05 el rojo del obligatorio también avisa', "(f.estado === 'ROJO-SOSTENIDO' && !f.obligatorio)", "(f.estado === 'ROJO-SOSTENIDO')"],
  ['M06 el silencio deja de avisar', "f.estado === 'SILENCIO' || (f.estado", "(f.estado"],
  ['M07 un job ausente del run no cuenta como hueco', "estado: r.jobs[job] ?? 'ausente' }", "estado: r.jobs[job] ?? 'pendiente' }"],
  ['M08 un solo rojo de cron ya avisa', 'export const MINIMO_ROJOS_DE_CRON = 2;', 'export const MINIMO_ROJOS_DE_CRON = 1;'],
  ['M09 los commits de main sin run no cuentan', 'huecosSinEjecutar(serie).vivo + (sinRun ?? 0);', 'huecosSinEjecutar(serie).vivo;'],
  ['M10 sin lista de obligatorios sigue adelante', 'if (!Array.isArray(obligatorios)) {', 'if (false) {'],
  ['M11 un run sin ejecutar rompe la racha roja', "    if (!EJECUTO.has(s.estado)) continue;\n    if (s.estado === 'failure') {", "    if (s.estado === 'failure') {"],
  ['M12 el veredicto mira también el futuro', 'const vistos = runs.filter((r) => r.creado <= ahora);', 'const vistos = runs;'],
  ['M13 nunca hay nada sin declarar', '.filter((k) => !declarados.has(k)).sort();', '.filter(() => false);'],
  ['M14 el cron que no llega no es silencio', 'if (fila.horasSinRun > U.horas) {', 'if (false) {'],
  ['M15 la tasa de fallo se mide con las rachas largas dentro', '.filter((r) => r.tamano >= N).reduce((a, r) => a + r.tamano, 0);', '.filter(() => false).reduce((a, r) => a + r.tamano, 0);'],
];

const correr = () => {
  // El entorno del hijo, a mano: sin el contexto ni el color del proceso que lo lanza (A21).
  const env = { ...process.env };
  for (const k of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'FORCE_COLOR']) delete env[k];
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', TEST], { cwd: RAIZ, env, encoding: 'utf8' });
  const lineas = r.stdout.split('\n');
  const pasan = lineas.filter((l) => /^ok \d+ - /.test(l)).length;
  const caen = lineas.filter((l) => /^not ok \d+ - /.test(l)).map((l) => (/SCRUM-1324 · (.)/.exec(l) || [0, '?'])[1]);
  return { exit: r.status, pasan, caen };
};

const original = readFileSync(SUJETO, 'utf8');
const huella = sha(original);
console.log(`POBLACION mutaciones=${MUTACIONES.length} · sujeto sha256 ${huella.slice(0, 16)}`);

const base = correr();
console.log(`BASE sin mutar: exit ${base.exit} · pasan ${base.pasan} · caen ${base.caen.length}`);
if (base.exit !== 0 || base.pasan !== 8) { console.log('CIEGO — la base no está verde con sus 8 casos: ninguna mutación vale.'); console.log('EXIT=2'); process.exit(2); }

let vivas = 0;
try {
  for (const [nombre, busca, pone] of MUTACIONES) {
    if (original.split(busca).length !== 2) { console.log(`CIEGO — ${nombre}: el ancla no aparece exactamente una vez`); process.exitCode = 2; break; }
    const mutado = original.replace(busca, () => pone);
    writeFileSync(SUJETO, mutado);
    const aplicada = sha(readFileSync(SUJETO, 'utf8')) !== huella;
    const r = aplicada ? correr() : null;
    writeFileSync(SUJETO, original);
    if (!aplicada) { console.log(`CIEGO — ${nombre}: la mutación no cambió el fichero`); process.exitCode = 2; break; }
    const viva = r.caen.length === 0;
    if (viva) vivas++;
    console.log(`${viva ? 'VIVA  ' : 'MUERTA'} ${nombre} · exit ${r.exit} · pasan ${r.pasan} · caen ${r.caen.length}: ${r.caen.join(' ')}`);
  }
} finally {
  writeFileSync(SUJETO, original);
}
const intacto = sha(readFileSync(SUJETO, 'utf8')) === huella;
console.log(`sujeto restaurado: ${intacto ? 'IDÉNTICO' : '🔴 DISTINTO'} (sha256 ${sha(readFileSync(SUJETO, 'utf8')).slice(0, 16)})`);
const despues = correr();
console.log(`BASE después: exit ${despues.exit} · pasan ${despues.pasan} · caen ${despues.caen.length}`);
const salida = process.exitCode === 2 ? 2 : (vivas || !intacto || despues.exit !== 0 ? 1 : 0);
console.log(`mutaciones muertas ${MUTACIONES.length - vivas} de ${MUTACIONES.length} · vivas ${vivas}`);
console.log(`EXIT=${salida}`);
process.exitCode = salida;
