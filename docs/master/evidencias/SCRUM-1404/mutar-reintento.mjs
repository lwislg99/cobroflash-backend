// docs/master/evidencias/SCRUM-1404/mutar-reintento.mjs — SCRUM-1404
//
// ¿El test del reintento CAE cuando el reintento está mal? Muta la copia COMPILADA
// (`dist/modules/invoicing/domain/reintentoSellado.js`, que git ignora), corre el test y la
// restaura. No toca `src/`.
//
//   node docs/master/evidencias/SCRUM-1404/mutar-reintento.mjs      (después de compilar)
//
// Cada mutación dice si se APLICÓ (cuántas veces casó su ancla: tiene que ser 1) antes de decir
// si el test la vio. Una mutación que no se aplica y un test que no la ve dan el mismo verde.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const RAIZ = path.resolve(import.meta.dirname, '../../../..');
const SUJETO = path.join(RAIZ, 'dist/modules/invoicing/domain/reintentoSellado.js');
const TEST = 'tests/scrum1404b-el-reintento-del-sellado.test.mjs';
const original = fs.readFileSync(SUJETO, 'utf8');

const MUTACIONES = [
  ['sin el cinturón «sin huella»', '&& !f.vfHash && ', '&& '],
  ['el borde de D se queda fuera (>= pasa a >)', 'f.createdAt.getTime() >= desde.getTime()', 'f.createdAt.getTime() > desde.getTime()'],
  ['sin la condición de la fecha', ' && f.createdAt.getTime() >= desde.getTime()', ''],
  ['sin la condición del estado', 'f.vfEstado === selladoEstado_1.SELLADO_PENDIENTE && ', ''],
  ['la fecha de corte acepta una anterior al suelo', 'desde.getTime() < new Date(exports.SUELO_DE_LA_FECHA_DE_CORTE).getTime()', 'false'],
  ['sin tope: nunca se agota', 'fallos.cuantos >= exports.TOPE_DE_FALLOS', 'false'],
  ['sin espera: siempre toca', '>= esperaS * 1000 ?', '>= 0 ?'],
  ['sin fecha de corte la pasada actúa igual', 'corte.desde === null', 'false'],
  ['la pasada no vuelve a exigir las tres condiciones', '!entraEnElReintento(f, desde)', 'false'],
  // El segundo cinturón del tope (comentario 18857, c).
  ['segundo cinturón: nunca hay nada fuera de plazo', 'if (vencida && !cerrada)', 'if (false)'],
  ['segundo cinturón: el borde del plazo entra (> pasa a >=)', 'f.createdAt.getTime() > plazoMs', 'f.createdAt.getTime() >= plazoMs'],
  ['segundo cinturón: cuenta también la que esta pasada sella', 'if (vencida && !cerrada)', 'if (vencida)'],
  ['segundo cinturón: fuera de plazo no pide mirar', 'if (p.fueraDePlazo.length)', 'if (false)'],
  ['segundo cinturón: el plazo olvida la espera inicial', 'let s = exports.ESPERA_INICIAL_S;', 'let s = 0;'],
  ['segundo cinturón: el plazo no crece con las esperas', 's += esperaTrasFalloS(k)', 's += exports.ESPERA_INICIAL_S'],
  ['segundo cinturón: la cuenta sólo sale cuando hay algo', '`pendientes fuera de plazo (m', 'p.fueraDePlazo.length === 0 ? `sin novedad` : `pendientes fuera de plazo (m'],
  // La acción que se cuenta: si deja de ser la que el sellado escribe, el caso de AST tiene que caer.
  ['la acción contada ya no es la que el sellado escribe', "exports.ACCION_DEL_SELLADO_FALLIDO = 'sellado_fallido'", "exports.ACCION_DEL_SELLADO_FALLIDO = 'sellado_fallado'"],
];

function correr() {
  const entorno = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP };
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-reporter=tap', TEST], { cwd: RAIZ, env: entorno, encoding: 'utf8' });
  const cuenta = (que) => Number((new RegExp(`^# ${que} (\\d+)`, 'm').exec(r.stdout || '') || [])[1] ?? NaN);
  return { tests: cuenta('tests'), fail: cuenta('fail'), status: r.status };
}

let mal = 0;
try {
  const base = correr();
  console.log(`POBLACION=${MUTACIONES.length} mutaciones · BASE sin mutar: tests ${base.tests} · fail ${base.fail}`);
  if (!(base.tests > 0) || base.fail !== 0) { console.log('CIEGO: la base no sale limpia; ninguna mutación se puede juzgar'); process.exit(2); }
  for (const [nombre, ancla, cambio] of MUTACIONES) {
    const veces = original.split(ancla).length - 1;
    if (veces !== 1) { console.log(`CIEGA  · ${nombre} · el ancla casa ${veces} veces`); mal += 1; continue; }
    fs.writeFileSync(SUJETO, original.replace(ancla, cambio));
    const r = correr();
    const veredicto = !Number.isFinite(r.tests) ? 'CIEGA ' : r.fail > 0 ? 'VIVA  ' : 'MUDA  ';
    if (veredicto !== 'VIVA  ') mal += 1;
    console.log(`${veredicto} · ${nombre} · tests ${r.tests} · fail ${r.fail}`);
  }
} finally {
  fs.writeFileSync(SUJETO, original);
}
const despues = correr();
console.log(`RESTAURADO: ${fs.readFileSync(SUJETO, 'utf8') === original ? 'idéntico' : 'DISTINTO'} · tests ${despues.tests} · fail ${despues.fail}`);
console.log(`no vivas: ${mal}`);
console.log(`EXIT=${mal ? 1 : 0}`);
process.exit(mal ? 1 : 0);
