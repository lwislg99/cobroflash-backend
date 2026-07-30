// SCRUM-219 · QUIEN ESPERA UNA TRANSACCIÓN RECIBE UNA TRANSACCIÓN — en toda la población,
// no solo en el embudo de facturas.
//
// ── ESTO NO ES HIGIENE DE TIPOS ──────────────────────────────────────────────────────────
//
// Lo único que hoy impide un hueco en la numeración FISCAL es que la RESERVA del número y la
// CREACIÓN de la factura vivan en la MISMA transacción: el rollback deshace el incremento de
// `nextInvoiceNumber` junto con el `insert`. Si alguien reservara en una transacción y creara
// en otra, el hueco pasa de imposible a REAL — y un salto en la serie hay que justificarlo
// ante Hacienda (medido por la sesión 2 en SCRUM-234; regla 29: deshacer es justamente lo que
// crea el hueco). Este fichero sostiene esa propiedad.
//
// ── POR QUÉ UN GUARD Y NO EL COMPILADOR, medido y no supuesto ────────────────────────────
//
// `Prisma.TransactionClient` es `Omit<PrismaClient, "$connect" | "$disconnect" | "$on" |
// "$transaction" | "$extends">`. Le FALTAN miembros respecto al cliente global, y por tipado
// estructural tener miembros de más no impide la asignación: por eso pasar el cliente global
// donde se espera una transacción COMPILA LIMPIO. Medido con `tsc` y con control negativo
// (`const n: number = 'texto'`) para descartar una sonda ciega.
//
// Marcar el tipo (*branded type*) TAMPOCO sirve, y esa es la medida que cierra la discusión:
// la marca rechaza igual el `tx` REAL que entrega `$transaction`, porque ese `tx` tampoco la
// lleva. Adoptarla obligaría a castear en las 29 fronteras de `$transaction` de `src/` o a
// envolverlas en un helper — o sea a MODIFICAR el camino de emisión, que es STOP (regla 38).
// El guard es la única salida que no lo es. Y este guard solo LEE: sin STOP.
//
// ── QUÉ AÑADE SOBRE SCRUM-207 ────────────────────────────────────────────────────────────
//
// La comprobación de cada call site NO se reescribe: es `analizarDelegacion` de
// `_misma-tx.mjs`, con su regla fail-closed ya probada (un receptor cuyo origen no se puede
// declarar cuenta como fuga). Lo que cambia es A QUIÉN se aplica. En 207 la población estaba
// CABLEADA a un nombre (`EMBUDO = 'allocateInvoiceNumber'`) más una delegada, y eso dejaba
// fuera `allocateQuoteNumber` y `allocateAlbaranNumber` — no son fiscales, pero son la misma
// clase de defecto: un hueco en la serie de presupuestos o de albaranes. Aquí la población se
// DERIVA de la estructura, así que la quinta función entra sola el día que se escriba.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { poblacionTx, poblacionEnFuente } from './_tx-poblacion.mjs';
import { analizarDelegacion } from './_misma-tx.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(AQUI, '..', 'src');

/**
 * Las cuatro medidas el 30-jul-2026. Es un RATCHET a la BAJA: si alguna deja de aparecer, el
 * analizador se ha quedado ciego para ella. Que aparezca una QUINTA no es un fallo — entra
 * sola en la vigilancia, que es justo el objetivo de derivar la población de la estructura.
 */
const CONOCIDAS = ['allocateInvoiceNumber', 'emitInvoice', 'allocateAlbaranNumber', 'allocateQuoteNumber'];

/**
 * Los 12 call sites medidos POR AST. Mismo criterio: ratchet a la baja.
 *
 * El censo inicial de este ticket dijo 14 y estaba mal sumado sobre un `grep` (7+2+1+2 = 12).
 * Lo cazó este mismo suelo al exigir la cifra, que es exactamente para lo que está: una
 * constante que nadie comprueba es una creencia, no una medida.
 */
const CALL_SITES_MEDIDOS = 12;

// ── SUELO, EN DOS MITADES ────────────────────────────────────────────────────────────────
//
// El guard de abajo es NEGATIVO: afirma «ninguna llamada pasa el cliente global». Un cero es
// la respuesta buena y también la de un analizador que no miró nada. Las dos mitades separan
// los casos: ① reconoce lo que persigue, ② recorrió el árbol real y encontró la población.

test('SCRUM-219 · ① el analizador de población ve lo que espera transacción y NO lo demás', () => {
  // Positivo 1: función declarada. El índice del parámetro importa — `analizarDelegacion` lo
  // usa para saber QUÉ argumento mirar, y equivocarlo comprobaría el argumento de al lado.
  const decl = poblacionEnFuente(
    'export async function reservar(tx: Prisma.TransactionClient, id: number) { return id; }');
  assert.deepEqual(decl.map((d) => [d.fnNombre, d.indiceParam]), [['reservar', 0]],
    '🔴 no reconoce una función declarada que espera transacción');

  // Positivo 2: el parámetro NO siempre es el primero.
  const segundo = poblacionEnFuente(
    'export function emitir(input: any, tx: Prisma.TransactionClient) { return input; }');
  assert.deepEqual(segundo.map((d) => [d.fnNombre, d.indiceParam]), [['emitir', 1]],
    '🔴 se equivoca de índice cuando el tx no es el primer parámetro');

  // Positivo 3: arrow asignada a const.
  assert.equal(poblacionEnFuente('const f = (tx: Prisma.TransactionClient) => 1;').length, 1,
    '🔴 no reconoce una arrow asignada a const');

  // Negativo 1: el tipado ESTRUCTURAL no entra, y es deliberado. `audit.service.ts:225-227`
  // se tipa así a propósito —con el motivo escrito— para poder inyectar un doble en los
  // tests. Marcarlo sería dar rojo contra una decisión razonada, y un guard que estorba en el
  // código bueno acaba desactivado: la forma más silenciosa de perder un guard.
  assert.deepEqual(poblacionEnFuente('function reg(tx: { auditLog: { create: Function } }) { return tx; }'), [],
    '🔴 marca el tipado estructural deliberado de audit.service como si fuera población');

  // Negativo 2: el nombre en un COMENTARIO no es un nodo. Sin esto, este mismo fichero —que
  // escribe la palabra que vigila para explicarla— se cazaría a sí mismo.
  assert.deepEqual(poblacionEnFuente('// ojo: nunca pases el global a un Prisma.TransactionClient\nconst y = 1;'), [],
    '🔴 el analizador mira TEXTO y no nodos: se cazaría a sí mismo');

  // Negativo 3: la arrow ANÓNIMA de `$transaction` no es población. Es donde NACE la
  // transacción, no una función a la que nadie pueda llamar mal; incluirla sería vigilarse
  // a sí misma y además no tiene nombre al que referirse.
  assert.deepEqual(
    poblacionEnFuente('await prisma.$transaction(async (tx: Prisma.TransactionClient) => { await tx.a.b(); });'),
    [], '🔴 mete el callback de $transaction en la población: se vigilaría a sí mismo');
});

test('SCRUM-219 · ② la población REAL de src/ contiene las cuatro conocidas', () => {
  const poblacion = poblacionTx(SRC);

  assert.ok(poblacion.length > 0,
    '🔴 no se ha encontrado NINGUNA función que espere transacción. El cero del guard de abajo ' +
    'no significaría «no hay fugas», sino «no se miró». Revisa que src/ existe y se recorre.');

  const nombres = poblacion.map((p) => p.fnNombre);
  const ausentes = CONOCIDAS.filter((n) => !nombres.includes(n));
  assert.deepEqual(ausentes, [],
    '🔴 el analizador ha dejado de ver funciones que SÍ esperan transacción:\n    ' +
    ausentes.join(', ') +
    '\n\n  No es que hayan desaparecido del código: es que el analizador ya no las reconoce, y ' +
    'todo lo que dependa de ellas queda sin vigilar en silencio.\n  Población vista:\n    ' +
    poblacion.map((p) => `${p.ruta}:${p.linea} ${p.fnNombre} (param ${p.indiceParam})`).join('\n    '));
});

// ── EL GUARD ─────────────────────────────────────────────────────────────────────────────

test('SCRUM-219 · toda llamada a quien espera transacción le pasa una transacción de verdad', () => {
  const poblacion = poblacionTx(SRC);
  const llamadas = analizarDelegacion(SRC, poblacion.map(
    ({ fnNombre, indiceParam }) => ({ fnNombre, indiceParam })));

  // Segunda mitad del suelo: la población puede estar bien y aun así no haberse encontrado
  // NINGUNA llamada — un `analizarDelegacion` que no recorre nada devuelve [] y el guard
  // pasaría en verde sin haber mirado un solo call site.
  assert.ok(llamadas.length >= CALL_SITES_MEDIDOS,
    `🔴 se han analizado ${llamadas.length} call sites y el 30-jul-2026 había ${CALL_SITES_MEDIDOS}. ` +
    'Menos no significa que se hayan eliminado llamadas: significa que el analizador no las ' +
    'está encontrando, y entonces su verde no vale nada.\n  Vistas:\n    ' +
    llamadas.map((l) => `${l.ruta}:${l.linea} ${l.fnNombre}(${l.receptor})`).join('\n    '));

  const fugas = llamadas.filter((l) => !l.ok);
  assert.deepEqual(
    fugas.map((f) => `${f.ruta}:${f.linea} ${f.fnNombre}(${f.receptor}) — origen: ${f.origenDelReceptor}`),
    [],
    '🔴 SE ESTÁ PASANDO ALGO QUE NO ES UNA TRANSACCIÓN A QUIEN ESPERA UNA:\n    ' +
    fugas.map((f) => `${f.ruta}:${f.linea} ${f.fnNombre}(${f.receptor}) — origen: ${f.origenDelReceptor}`)
      .join('\n    ') +
    '\n\n  El compilador NO lo impide: `Prisma.TransactionClient` es `Omit<PrismaClient, …>`, así\n' +
    '  que el cliente global es estructuralmente asignable y esa llamada compila limpia.\n\n' +
    '  Lo que se pierde no es un detalle de estilo: sin transacción no hay rollback. En el caso\n' +
    '  fiscal eso convierte un hueco en la numeración de imposible en REAL —se reserva el número,\n' +
    '  falla lo siguiente y el número ya está consumido—, y un salto en la serie hay que\n' +
    '  justificarlo ante Hacienda. En presupuestos y albaranes es el mismo defecto sin el peso\n' +
    '  fiscal.\n\n' +
    '  Origen `DESCONOCIDO` es fail-closed a propósito: si no se puede DECLARAR que el receptor\n' +
    '  es transaccional, no se da por bueno. Si la llamada es legítima, el arreglo es tipar el\n' +
    '  parámetro como `Prisma.TransactionClient`, no relajar este guard.');
});
