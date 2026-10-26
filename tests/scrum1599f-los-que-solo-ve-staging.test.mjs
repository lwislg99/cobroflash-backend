// SCRUM-1599f · EL TRINQUETE de los tests que SÓLO corren contra staging (diseño B de SCRUM-1599).
//
// El hecho (SCRUM-1599 c.20713): 46 ficheros llevan un `skip` que nombra `QA_DB_TEST` y no tienen
// segundo destino. CI los salta en CADA PR —83 casos— y el único que los corre es
// `npm run test:staging:gated`, a mano y con turno. En esta máquina, el último recibo de esa tanda
// era del 4-sep-2026. Cuatro de ellos estuvieron en rojo entre 31 y 46 días sin que nadie lo viera.
//
// La decisión (SCRUM-1599 c.20715 ①, del fundador): los 46 pasan, por lotes, al banco desechable que
// CI ya levanta (la forma `QA_DB_TEST` **o** `LIBRO_PG_URL` de SCRUM-876e/f), «con un trinquete exacto
// sobre el 46 que no deja cambiarlo sin decisión». Éste es ese trinquete.
//
// QUÉ CUENTA. Un fichero está en la población si (a) alguna llamada `test(`/`it(` lleva un `skip` cuya
// expresión nombra `QA_DB_TEST`, y (b) su CÓDIGO no tiene segundo destino: ni importa
// `./_banco-libro.mjs` ni lee `process.env.LIBRO_PG_URL`. Las dos cosas por AST, no por texto: el
// comentario que explica cómo correr un test nombra las dos variables y no conecta nada (A23 #2 y #5).
//
// LAS DOS MITADES (A23 #7). Se compara el CONJUNTO, no la cuenta (A3: un número igual deja pasar
// «he perdido uno y he ganado otro»):
//   · un fichero que ENTRA (un gateado nuevo sólo de staging) → rojo: o se le da el banco, o la
//     excepción se decide y se escribe aquí con su motivo;
//   · un fichero que SALE sin que nadie lo haya migrado (lo borraron, cambió su gate, el extractor
//     se descarriló) → rojo también. Salir migrado es la dirección buena, y se quita de la lista en
//     el MISMO PR que lo migra, que es lo que hace 1599f con sus cuatro.
//
// EL POSITIVO SE SIEMBRA (cicatriz ② del equipo). Al extractor se le pasa, junto al árbol, un
// fichero FABRICADO aquí con la forma exacta de un gateado sólo de staging. Si no lo encuentra, el
// censo dice CIEGO y no compara nada: un extractor que no ve el sembrado tampoco ve los 42. El
// positivo no se toma del árbol a propósito: el día que se migre el último, un positivo prestado se
// jubilaría con él y el trinquete se quedaría mudo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { leerSiSigueAhi, exigirCorpusLeido } from './_barrido-estable.mjs'; // SCRUM-740

const AQUI = path.dirname(fileURLToPath(import.meta.url));

/**
 * LA POBLACIÓN DECLARADA — 22 = los 46 de SCRUM-1599 c.20713 menos los 4 que migra 1599f
 * (scrum104, scrum106, scrum109, scrum135), los 7 que migra 1599h (scrum131, scrum22, scrum51,
 * scrum57, scrum58, scrum593d, webhooks-idempotencia), los 7 que migra 1599i (pdfs, scrum120,
 * scrum136, scrum148, scrum24, scrum66, scrum90) y los 6 que migra 1599k (scrum17, scrum207,
 * scrum222, scrum74, scrum76, scrum94). Uno por línea (A23 #15), en orden alfabético.
 * Esta lista sólo BAJA, y sólo en el PR que migra el fichero. Para que SUBA hace falta una decisión
 * escrita en SCRUM-1599 y su motivo al lado de la línea.
 */
const SOLO_STAGING = Object.freeze([
  'scrum115-wa-fallo-registrado.test.mjs',
  // scrum116 NO se migra en 1599f: `sendInvoicePaymentReminders()` recorre TODAS las facturas de
  // la base (lo dice su cabecera) y en el banco de la tanda, que comparten los ficheros que corren a
  // la vez, escribiría sobre filas de otros tests. Leído en el código, no intentado.
  'scrum116-recordatorio-candado.test.mjs',
  'scrum127-paywall-bloquea.test.mjs',
  'scrum170-facturacion-parcial.test.mjs',
  'scrum171a-consolidar-cliente.test.mjs',
  'scrum173-cadena-verifactu-serializada.test.mjs',
  'scrum178-emision-manual.test.mjs',
  'scrum221-export-fiscal-cero-bytes.test.mjs',
  'scrum234-carrera-serie.gated.test.mjs',
  'scrum25-export-zip.test.mjs',
  'scrum25-exports.test.mjs',
  // scrum574 NO se migra en 1599h: su caso «CONTRA POSTGRES: tras la migración, cada cliente sigue
  // siendo el mismo» compara los clientes de una base REAL ya migrada con el PASO 0 de `railway` y
  // `yaqu_dev_javier`. En el banco vacío cae con «⛔ NO SUPE MIRAR: cero clientes», por diseño
  // (medido en el banco local, no sólo leído). Su sitio es staging.
  'scrum574-mismo-cliente-tras-migracion.test.mjs',
  'scrum592-concurrencia-serie.test.mjs',
  'scrum73-verifactu-gate.test.mjs',
  'scrum767-cura-concurrencia.test.mjs',
  'scrum781-concurrencia-de-la-factura.test.mjs',
  'scrum793-la-carrera-del-token.test.mjs',
  'scrum814-carrera-del-tramo.gated.test.mjs',
  'scrum82-zip-verifactu.test.mjs',
  // scrum85 NO se migra en 1599i: con la base vacía el cobro A sale con id=1, y su
  // `!body.includes('/pay/card/1')` casa DENTRO del token cuando éste empieza por «1»: en el banco
  // sería intermitente. Medido por jv-j6bv en SCRUM-1218 c.20840 (llegó por el orquestador; 1599i no
  // lo ha repetido). Vuelve cuando se arregle esa aserción, no antes.
  'scrum85-pay-routes-token.test.mjs',
  'scrum92-login-operario.test.mjs',
  'tenancy-permisos.test.mjs',
]);

// El sembrado: la forma de un gateado sólo de staging, tal como la escribe hoy el árbol.
const SEMBRADO = '__sembrado-1599f__.test.mjs';
const FUENTE_SEMBRADA = [
  "import './_staging-db.mjs';",
  "import test from 'node:test';",
  "const ENABLED = process.env.QA_DB_TEST === '1';",
  "test('sembrado', { skip: !ENABLED && 'sin QA_DB_TEST=1 · npm run test:staging:gated' }, async () => {});",
].join('\n');
// Y su gemelo MIGRADO, con la forma de 1599f: no puede entrar en la población.
const MIGRADO = '__migrado-1599f__.test.mjs';
const FUENTE_MIGRADA = [
  "import './_staging-db.mjs';",
  "import { URL_BANCO } from './_banco-libro.mjs';",
  "import test from 'node:test';",
  "const ENABLED = process.env.QA_DB_TEST === '1' || URL_BANCO !== '';",
  "test('migrado', { skip: !ENABLED && 'sin QA_DB_TEST=1 ni LIBRO_PG_URL · npm run test:staging:gated' }, async () => {});",
].join('\n');

/** ¿Este fuente es un gateado SÓLO de staging? Por AST (ver la cabecera). */
export function soloStaging(src) {
  const sf = ts.createSourceFile('x.mjs', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let gateStaging = false;
  let segundoDestino = false;
  const visitar = (n) => {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)
      && n.moduleSpecifier.text === './_banco-libro.mjs') segundoDestino = true;
    if (ts.isPropertyAccessExpression(n) && n.name.text === 'LIBRO_PG_URL'
      && n.expression.getText(sf) === 'process.env') segundoDestino = true;
    if (ts.isCallExpression(n) && /^(test|it)$/.test(n.expression.getText(sf))) {
      for (const a of n.arguments) {
        if (!ts.isObjectLiteralExpression(a)) continue;
        for (const p of a.properties) {
          if (ts.isPropertyAssignment(p) && p.name.getText(sf) === 'skip'
            && nombraQaDbTest(p.initializer, sf)) gateStaging = true;
        }
      }
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return gateStaging && !segundoDestino;
}

/** La expresión del `skip` nombra QA_DB_TEST: en un literal (el motivo) o en un identificador. */
function nombraQaDbTest(expr, sf) {
  let si = false;
  const mirar = (n) => {
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && n.text.includes('QA_DB_TEST')) si = true;
    if (ts.isTemplateExpression(n) && n.getText(sf).includes('QA_DB_TEST')) si = true;
    ts.forEachChild(n, mirar);
  };
  mirar(expr);
  return si;
}

/**
 * El censo sobre una lista de fuentes `{ nombre, src }`. Exige ver el sembrado: si no lo ve,
 * devuelve CIEGO y no da población, porque un extractor que no ve el caso fabricado no ve nada.
 */
export function censar(fuentes) {
  const poblacion = fuentes.filter((f) => f.src.includes('QA_DB_TEST') && soloStaging(f.src)).map((f) => f.nombre);
  if (!poblacion.includes(SEMBRADO)) return { veredicto: 'CIEGO', poblacion: [] };
  return { veredicto: 'MIRADO', poblacion: poblacion.filter((n) => n !== SEMBRADO && n !== MIGRADO).sort() };
}

function fuentesDelArbol() {
  const ficheros = fs.readdirSync(AQUI).filter((f) => f.endsWith('.test.mjs'));
  const fuentes = [];
  for (const f of ficheros) {
    const src = leerSiSigueAhi(path.join(AQUI, f));
    if (src !== null) fuentes.push({ nombre: f, src });
  }
  exigirCorpusLeido(fuentes.length, 1000, 'SCRUM-1599f · los que sólo ve staging');
  return fuentes;
}

const sembradas = () => [{ nombre: SEMBRADO, src: FUENTE_SEMBRADA }, { nombre: MIGRADO, src: FUENTE_MIGRADA }];

test('SCRUM-1599f · los que SÓLO corren contra staging son exactamente los 22 declarados', () => {
  const arbol = fuentesDelArbol();
  const { veredicto, poblacion } = censar([...arbol, ...sembradas()]);
  assert.equal(veredicto, 'MIRADO', '🔴 CIEGO: el extractor no ve el gateado sembrado, así que tampoco ve los del árbol');
  const declarados = [...SOLO_STAGING].sort();
  const entran = poblacion.filter((f) => !declarados.includes(f));
  const salen = declarados.filter((f) => !poblacion.includes(f));
  assert.deepEqual(
    { entran, salen }, { entran: [], salen: [] },
    `🔴 LA POBLACIÓN DE LOS QUE SÓLO VE STAGING HA CAMBIADO (sobre ${arbol.length} ficheros leídos).\n`
      + `  ENTRAN (gateados sólo de staging sin declarar): ${entran.join(', ') || '—'}\n`
      + `  SALEN (declarados que ya no lo son): ${salen.join(', ') || '—'}\n`
      + '  Si sale porque lo has migrado al banco desechable, quítalo de SOLO_STAGING en el mismo PR.\n'
      + '  Si entra, dale el segundo destino (tests/_banco-libro.mjs); que se quede sólo en staging lo\n'
      + '  decide el fundador en SCRUM-1599, y se escribe aquí con su motivo.',
  );
  assert.equal(poblacion.length, 22, `🔴 población ${poblacion.length}, declarada 22`);
});

test('SCRUM-1599f · sin el sembrado el censo dice CIEGO, no verde', () => {
  const arbol = fuentesDelArbol();
  const r = censar(arbol);
  assert.equal(r.veredicto, 'CIEGO', '🔴 el censo ha dado población sin ver su positivo sembrado');
  assert.deepEqual(r.poblacion, []);
});

test('SCRUM-1599f · CONTROLES: el sembrado entra, su gemelo migrado no, y un comentario no conecta nada', () => {
  assert.equal(soloStaging(FUENTE_SEMBRADA), true, '🔴 la forma sólo-staging no se reconoce');
  assert.equal(soloStaging(FUENTE_MIGRADA), false, '🔴 la forma migrada de 1599f se cuenta como sólo-staging');
  // Un fichero que sólo NOMBRA el banco en un comentario sigue sin segundo destino (A23 #2).
  const conComentario = `// LIBRO_PG_URL=<banco> npm test · import { URL_BANCO } from './_banco-libro.mjs'\n${FUENTE_SEMBRADA}`;
  assert.equal(soloStaging(conComentario), true, '🔴 un comentario que nombra el banco cuenta como migración');
  // Y un salto que no nombra QA_DB_TEST (el de otra variable) no es de esta población.
  assert.equal(soloStaging(FUENTE_SEMBRADA.replace(/QA_DB_TEST/g, 'OTRA_VARIABLE')), false,
    '🔴 un salto de otra variable entra en la población de staging');
});
