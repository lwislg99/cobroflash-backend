// tests/scrum632c-el-payload-se-construye.test.mjs — SCRUM-632c
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 CREAR UN PRESUPUESTO DEJÓ DE FUNCIONAR EN `main`, Y MI SUITE ESTABA EN VERDE.
//
// El defecto, que es mío (SCRUM-632): `const desc` se declaraba DENTRO de un `try { … } catch {}`
// y el spread que la usa —`...(desc ? { description: desc } : {})`— está sesenta líneas más
// abajo, FUERA del bloque. `const` es de ámbito de BLOQUE, así que cada línea válida de un
// presupuesto lanzaba:
//
//     ReferenceError: desc is not defined
//         at js/quotesView.js  ← dentro del manejador de «Generar presupuesto»
//
// ── LA LECCIÓN, Y VA ESCRITA AQUÍ PORQUE ES EL MOTIVO DE ESTE FICHERO ────────────────────────
//
// La tanda de SCRUM-632 salió con SEIS MIL CIENTO SESENTA Y TRES tests en verde, y **ninguno
// pasaba por aquí**. Todos mis casos miraban el fuente —que la clave estuviera escrita, que los
// sitios de defecto ya no borraran— o el PDF ya generado. Ninguno EJECUTABA la construcción del
// payload, que es la línea que el profesional pulsa.
//
// Un guard que lee el fuente habría dicho «la clave `description` está ahí»: y estaba. Lo que no
// estaba era que se pudiera llegar a ella. Por eso este caso EJECUTA la región real del fichero
// en vez de leerla: es la única forma de que un `ReferenceError` se vea.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VISTA = path.join(RAIZ, 'public/dashboard/js/quotesView.js');

/**
 * La región REAL que construye una línea del payload: desde `let conceptForPdf` hasta el cierre
 * del `payloadLines.push(...)`.
 *
 * 🔴 SUELO: si no se encuentra, esto FALLA. Ejecutar el vacío daría un verde que no significa
 * nada — y ése es exactamente el error que este fichero existe para no repetir.
 */
function regionDelPayload() {
  const src = fs.readFileSync(VISTA, 'utf8');
  const ini = src.indexOf('      let conceptForPdf = concept;');
  assert.ok(ini >= 0,
    '🔴 CIEGO: no encuentro el arranque de la construcción del payload en `quotesView.js`. '
    + 'O cambió de forma o se movió: en los dos casos hay que mirarlo antes de fiarse de lo de abajo.');
  const fin = src.indexOf('}));', ini) + 4;
  assert.ok(fin > ini + 4, '🔴 CIEGO: no encuentro el cierre de `payloadLines.push(...)`.');
  const region = src.slice(ini, fin);
  assert.ok(region.split('\n').length > 30,
    `🔴 CIEGO: la región son ${region.split('\n').length} líneas. Con eso no hay nada que ejecutar.`);
  return region;
}

/** Ejecuta la región con una línea VÁLIDA y devuelve lo que se empujó al payload. */
function construir({ descripcion = '', casillaMarcada = false, datasetDesc = '' } = {}) {
  const line = {
    descInput: { value: descripcion },
    conceptInput: { dataset: datasetDesc ? { pfProductDescription: datasetDesc } : {} },
    costeInput: { value: '' },
    dtoInput: { value: '' },
    suplidoCheck: { checked: false },
  };
  const stubs = {
    concept: 'Grifo monomando', safeQty: 1, safePrice: 100, safeVat: 21,
    descCheck: { checked: casillaMarcada },
    line,
    payloadLines: [],
    // Las piezas puras que la región llama viven en sus propios módulos y tienen sus tests: aquí
    // se doblan para que lo que se mida sea ESTA región y no la aritmética de las otras.
    costeParaPayload: () => ({}),
    lineaParaPayload: (o) => o,
    window: { quoteDescuentos: { descuentoParaPayload: () => ({}) } },
  };
  new Function(...Object.keys(stubs), regionDelPayload())(...Object.values(stubs));
  return stubs.payloadLines;
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL CONTROL QUE DECIDE: con una línea válida, el payload SE CONSTRUYE
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-632c · 🔴 una línea VÁLIDA no revienta: el presupuesto se puede crear', () => {
  let lineas;
  assert.doesNotThrow(() => { lineas = construir(); },
    '🔴 CREAR UN PRESUPUESTO REVIENTA. Es el defecto de SCRUM-632c: una variable declarada dentro '
    + 'de un `try` y usada fuera. Cada línea válida lanzaba `ReferenceError` en el manejador de '
    + '«Generar presupuesto», así que el profesional no podía crear NI UN presupuesto.');
  assert.equal(lineas.length, 1, `🔴 la línea válida no llegó al payload: ${JSON.stringify(lineas)}`);
  assert.equal(lineas[0].concept, 'Grifo monomando', '🔴 el concepto no viaja');
  assert.equal(lineas[0].qty, 1);
  assert.equal(lineas[0].price, 100);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ✅ POSITIVO · con descripción escrita: viaja en `description` Y pegada al `concept`
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-632c · ✅ con descripción y casilla marcada: viaja en `description` Y en el `concept`', () => {
  const [l] = construir({ descripcion: 'Incluye desmontaje y sellado', casillaMarcada: true });

  assert.equal(l.description, 'Incluye desmontaje y sellado',
    '🔴 la descripción no viaja como CLAVE propia. Es el dato de la línea (SCRUM-632).');
  assert.match(l.concept, /Grifo monomando\nIncluye desmontaje y sellado/,
    '🔴 la descripción no se pega al `concept`. Es lo que el PDF sabe leer hoy '
    + '(`partirConceptoYDescripcion`, SCRUM-603), y el camino de emisión no se toca.');
});

test('SCRUM-632c · con descripción pero la casilla SIN marcar: viaja la clave, NO se pega al papel', () => {
  const [l] = construir({ descripcion: 'Nota interna', casillaMarcada: false });

  assert.equal(l.description, 'Nota interna',
    '🔴 la clave deja de viajar cuando la casilla no está marcada. La casilla decide si SALE EN EL '
    + 'PDF, no si el dato existe: son dos cosas distintas y el ticket las separó.');
  assert.equal(l.concept, 'Grifo monomando',
    '🔴 la descripción se pegó al concepto con la casilla SIN marcar: saldría en el papel sin que '
    + 'nadie lo pidiera.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ✅ NEGATIVO · sin descripción, la clave NO viaja
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-632c · ✅ NEGATIVO: sin descripción, la clave NO viaja (ausente ≠ vacío)', () => {
  const [l] = construir({ descripcion: '' });

  assert.equal('description' in l, false,
    '🔴 se ha estampado una `description` vacía. Una línea que nadie tocó tiene que seguir siendo '
    + 'el MISMO objeto que antes de SCRUM-632: que la clave FALTE significa «esta línea no lleva '
    + 'descripción», y un `""` convertiría ese silencio en un dato.');
  assert.equal(l.concept, 'Grifo monomando', '🔴 el concepto ha cambiado en una línea sin descripción');
});

test('SCRUM-632c · el respaldo del `dataset` sigue vivo para borradores anteriores al campo', () => {
  const [l] = construir({ descripcion: '', datasetDesc: 'Del catálogo, borrador viejo', casillaMarcada: true });

  assert.equal(l.description, 'Del catálogo, borrador viejo',
    '🔴 una línea que viene de un borrador ANTERIOR al campo pierde su descripción. El `dataset` '
    + 'es el respaldo para justo ese caso.');
});
