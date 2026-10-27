// docs/master/evidencias/SCRUM-1404/mutar-declaracion.mjs — SCRUM-1404
//
// ¿El caso «la excepción está DECLARADA y sigue montada» CAE cuando la declaración se estropea?
// Muta `scripts/_sin-consumir-declarados.json` EN SITIO (es un fichero seguido por git), corre el
// test y lo restaura. Por eso se lanza con el árbol limpio y comprueba al final que quedó idéntico.
//
//   node docs/master/evidencias/SCRUM-1404/mutar-declaracion.mjs      (después de compilar)
//
// Cada mutación dice si se APLICÓ (su ancla tiene que casar 1 vez) antes de decir si el test la vio.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const RAIZ = path.resolve(import.meta.dirname, '../../../..');
const SUJETO = path.join(RAIZ, 'scripts/_sin-consumir-declarados.json');
const TEST = 'tests/scrum1404b-el-reintento-del-sellado.test.mjs';
const CASO = 'la excepción está DECLARADA y sigue montada';
const original = fs.readFileSync(SUJETO, 'utf8');
const M = 'src/modules/invoicing/domain/reintentoSellado.ts';

const lineaDe = (nombre) => original.split('\n').find((l) => l.includes(`"export · ${M}::${nombre}"`)) ?? '';

const MUTACIONES = [
  ['se borra una de las tres piezas declaradas', lineaDe('conclusionDelReintento') + '\n', ''],
  ['la declaración ya no dice quién la retira', 'QUIEN LA RETIRA: el PR-2 de SCRUM-1404', 'QUIEN LA RETIRA: mas adelante'],
  ['una pieza cambia de ticket', lineaDe('resumenDelReintento'), lineaDe('resumenDelReintento').replace('"ticket":"SCRUM-1404"', '"ticket":"SCRUM-1185"')],
  ['una pieza nombra una función que el módulo no exporta', `${M}::resumenDelReintento"`, `${M}::resumenQueNoExiste"`],
];

function correr() {
  const entorno = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP };
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-reporter=tap', TEST], { cwd: RAIZ, env: entorno, encoding: 'utf8' });
  const salida = r.stdout || '';
  const cuenta = (que) => Number((new RegExp(`^# ${que} (\\d+)`, 'm').exec(salida) || [])[1] ?? NaN);
  const lineasDelCaso = salida.split('\n').filter((l) => /^(not )?ok \d+ - /.test(l) && l.includes(CASO));
  return { tests: cuenta('tests'), fail: cuenta('fail'), caso: lineasDelCaso.length, casoCae: lineasDelCaso.some((l) => l.startsWith('not ok')) };
}

let mal = 0;
try {
  const base = correr();
  console.log(`POBLACION=${MUTACIONES.length} mutaciones · BASE sin mutar: tests ${base.tests} · fail ${base.fail} · el caso sale ${base.caso} vez`);
  if (!(base.tests > 0) || base.fail !== 0 || base.caso !== 1) { console.log('CIEGO: la base no sale limpia o el caso no está; ninguna mutación se puede juzgar'); process.exit(2); }
  for (const [nombre, ancla, cambio] of MUTACIONES) {
    const veces = ancla ? original.split(ancla).length - 1 : 0;
    if (veces !== 1) { console.log(`CIEGA  · ${nombre} · el ancla casa ${veces} veces`); mal += 1; continue; }
    fs.writeFileSync(SUJETO, original.replace(ancla, cambio));
    const r = correr();
    let veredicto = 'MUDA  ';
    if (!Number.isFinite(r.tests) || r.caso !== 1) veredicto = 'CIEGA ';
    else if (r.casoCae) veredicto = 'VIVA  ';
    if (veredicto !== 'VIVA  ') mal += 1;
    console.log(`${veredicto} · ${nombre} · tests ${r.tests} · fail ${r.fail} · cae el caso: ${r.casoCae}`);
  }
} finally {
  fs.writeFileSync(SUJETO, original);
}
const despues = correr();
console.log(`RESTAURADO: ${fs.readFileSync(SUJETO, 'utf8') === original ? 'idéntico' : 'DISTINTO'} · tests ${despues.tests} · fail ${despues.fail}`);
console.log(`no vivas: ${mal}`);
console.log(`EXIT=${mal ? 1 : 0}`);
process.exit(mal ? 1 : 0);
