// docs/master/evidencias/SCRUM-1404/mutar-guarda.mjs — SCRUM-1404
//
// ¿LA SONDA DEL RESELLADO CAE CUANDO LA GUARDA NO ESTÁ? Quita del COMPILADO
// (`dist/modules/invoicing/domain/verifactu.service.js`, que git ignora) la guarda de «ya sellada»
// de `applyVeriFactu` (SCRUM-1330), corre `sonda-resellado.mjs` y lo restaura. No toca `src/`.
//
//   node docs/master/evidencias/SCRUM-1404/mutar-guarda.mjs      (después de compilar `dist/`)
//
// Tres pasadas de la sonda, en este orden: la BASE sin mutar (si no sale limpia, nada de lo demás
// se puede juzgar), la MUTADA, y otra vez limpia tras RESTAURAR. Antes de creerse la mutada dice
// si la mutación se APLICÓ: cuántas veces casó el ancla (tiene que ser una) y que el compilado
// cambió. Una mutación que no se aplica y una sonda que no la ve dan el mismo verde.
//
// Lo que tiene que caer está escrito abajo, ANTES de correr, y se compara como CONJUNTO: no basta
// con que caiga el mismo número de comprobaciones.
//
// La idea y la primera versión son de la sesión jv-j1a (SCRUM-1507, comentario 19509). Aquélla se
// llamaba dos veces a mano (`mutar` y `restaurar`) y guardaba el original en una copia junto al
// compilado: si la segunda llamada no llegaba, el árbol se quedaba con la guarda quitada. Ésta
// guarda el original en memoria y lo devuelve al SALIR, salga por donde salga.
//
// ⚠️ LO QUE NO CUBRE, MEDIDO el 14-oct-2026: matado a lo bruto (SIGKILL) con el compilado ya
// mutado, este proceso no ejecuta ningún manejador de salida y `dist/` SE QUEDA SIN LA GUARDA. Un
// corte ordenado (`process.exit`) sí lo devuelve; un kill, no.
// Lo que impide que eso acabe en un verde falso: la siguiente pasada toma como original lo que hay
// en disco, su BASE cae en las mismas comprobaciones y dice «CIEGO: la base no sale limpia», sale
// con 2 y no muta nada. Se arregla volviendo a compilar `dist/`.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mutacionesDeclaradas } from '../../../../scripts/meta-guard-mutaciones.mjs';

const RAIZ = path.resolve(import.meta.dirname, '../../../..');
const SUJETO = path.join(RAIZ, 'dist/modules/invoicing/domain/verifactu.service.js');
const SONDA = path.join(import.meta.dirname, 'sonda-resellado.mjs');

// LA MUTACIÓN NO SE ESCRIBE AQUÍ: se toma del catálogo del meta-guard (SCRUM-1387). La declara, en
// su `MUTACIONES_QUE_ME_TUMBAN`, el test que la guarda tiene en la tanda; se lee por AST, sin
// importar el test (importarlo lo ejecutaría). Allí está declarada sobre el FUENTE; aquí se aplica
// al compilado, donde esa línea sale igual, y por eso se exige que case una vez en los dos.
const TEST_QUE_LA_DECLARA = 'tests/scrum1330-una-sellada-no-se-resella.test.mjs';
const FUENTE = 'src/modules/invoicing/domain/verifactu.service.ts';
const declaradas = mutacionesDeclaradas(fs.readFileSync(path.join(RAIZ, TEST_QUE_LA_DECLARA), 'utf8'), TEST_QUE_LA_DECLARA)
  .filter((d) => d.fichero === FUENTE);
if (declaradas.length !== 1) {
  console.log(`POBLACION=0 · CIEGO: ${TEST_QUE_LA_DECLARA} declara ${declaradas.length} mutaciones sobre ${FUENTE}; se esperaba una`);
  console.log('EXIT=2');
  process.exit(2);
}
const ANCLA = declaradas[0].de;
const CAMBIO = declaradas[0].a;

// Lo que tiene que caer con la guarda quitada, declarado antes de correr. `caso · comprobación`.
const TIENE_QUE_CAER = [
  'S · escrituras que tocan la huella',
  'S · huella, anterior, instante y QR intactos',
  'S · lo único escrito sobre la factura',
  'S · avisó de que la conserva',
  'S2 · escrituras que tocan la huella',
  'S2 · la huella es la de P',
];

if (!fs.existsSync(SUJETO)) {
  console.log('POBLACION=0 · CIEGO: no hay compilado. Falta compilar `dist/` antes de correr esto.');
  console.log('EXIT=2');
  process.exit(2);
}
const original = fs.readFileSync(SUJETO, 'utf8');
const sha = (texto) => createHash('sha256').update(texto).digest('hex').slice(0, 16);

// Un `finally` no cubre `process.exit`: el compilado se devuelve aquí, en la salida del proceso.
process.on('exit', () => {
  if (fs.readFileSync(SUJETO, 'utf8') !== original) fs.writeFileSync(SUJETO, original);
});

/** Corre la sonda en un proceso aparte, con el entorno hecho a mano, y lee qué comprobó. */
function correr() {
  const entorno = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP };
  const r = spawnSync(process.execPath, [SONDA], { cwd: RAIZ, env: entorno, encoding: 'utf8' });
  const pasan = [];
  const caen = [];
  let caso = null;
  for (const linea of String(r.stdout ?? '').split(/\r?\n/)) {
    const titulo = /^(P|S|S2) · /.exec(linea);
    if (titulo) { caso = titulo[1]; continue; }
    const m = /^ {2}(ok {2}|CAE ) · (.*?): /.exec(linea);
    if (!m) continue;
    (m[1] === 'CAE ' ? caen : pasan).push(`${caso} · ${m[2]}`);
  }
  return { pasan, caen, hechas: pasan.length + caen.length, status: r.status };
}

/** Tres estados, no dos: una pasada que no comprobó nada no es ni limpia ni caída. */
function estadoDe(r) {
  if (r.hechas === 0) return 'CIEGA';
  if (r.caen.length === 0 && r.status === 0) return 'LIMPIA';
  return 'CAE';
}
const contar = (r) => `comprobaciones ${r.hechas} · caen ${r.caen.length} · salida ${r.status}`;

function terminar(codigo) {
  console.log(`EXIT=${codigo}`);
  process.exit(codigo);
}

console.log(`POBLACION=1 mutación (la guarda de «ya sellada») · ${TIENE_QUE_CAER.length} comprobaciones declaradas como «tiene que caer»`);

const base = correr();
console.log(`BASE sin mutar      · ${estadoDe(base)} · ${contar(base)}`);
if (estadoDe(base) !== 'LIMPIA') {
  console.log('CIEGO: la base no sale limpia; la mutación no se puede juzgar');
  for (const c of base.caen) console.log(`   cae en la base: ${c}`);
  terminar(2);
}
const desconocidas = TIENE_QUE_CAER.filter((c) => !base.pasan.includes(c));
if (desconocidas.length) {
  console.log('CIEGO: lo declarado nombra comprobaciones que la sonda no hace:');
  for (const c of desconocidas) console.log(`   ${c}`);
  terminar(2);
}

const veces = original.split(ANCLA).length - 1;
const vecesEnElFuente = fs.readFileSync(path.join(RAIZ, FUENTE), 'utf8').split(ANCLA).length - 1;
console.log(`la mutación declarada en ${TEST_QUE_LA_DECLARA}: su ancla casa ${veces} vez/veces en el compilado y ${vecesEnElFuente} en el fuente`);
if (veces !== 1 || vecesEnElFuente !== 1) {
  console.log('CIEGO: el ancla tiene que casar una sola vez en cada uno');
  terminar(2);
}
const mutado = original.replace(ANCLA, CAMBIO);
fs.writeFileSync(SUJETO, mutado);
const enDisco = fs.readFileSync(SUJETO, 'utf8');
console.log(`mutación aplicada   · el compilado cambió: ${enDisco !== original} · ${sha(original)} -> ${sha(enDisco)}`);
if (enDisco === original) {
  console.log('CIEGO: la mutación no llegó al disco');
  terminar(2);
}

const mutada = correr();
console.log(`MUTADA              · ${estadoDe(mutada)} · ${contar(mutada)}`);
for (const c of mutada.caen) console.log(`   cae: ${c}`);

fs.writeFileSync(SUJETO, original);
const restaurado = fs.readFileSync(SUJETO, 'utf8') === original;
const despues = correr();
console.log(`RESTAURADO          · el compilado es el de antes: ${restaurado} · ${estadoDe(despues)} · ${contar(despues)}`);

const faltan = TIENE_QUE_CAER.filter((c) => !mutada.caen.includes(c));
const sobran = mutada.caen.filter((c) => !TIENE_QUE_CAER.includes(c));
for (const c of faltan) console.log(`   TENÍA QUE CAER y no cae: ${c}`);
for (const c of sobran) console.log(`   CAE sin estar declarada: ${c}`);

let veredicto;
if (estadoDe(mutada) === 'CIEGA') veredicto = 'CIEGA — la sonda mutada no comprobó nada';
else if (estadoDe(mutada) === 'LIMPIA') veredicto = 'MUDA — la sonda no ve que falta la guarda';
else if (faltan.length || sobran.length) veredicto = 'VIVA, PERO NO COMO SE DECLARÓ';
else veredicto = 'VIVA — cae lo declarado y sólo lo declarado';
console.log(`VEREDICTO: ${veredicto}`);

const bien = veredicto.startsWith('VIVA —') && restaurado && estadoDe(despues) === 'LIMPIA';
terminar(bien ? 0 : 1);
