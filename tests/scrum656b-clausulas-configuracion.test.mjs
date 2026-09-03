// tests/scrum656b-clausulas-configuracion.test.mjs — SCRUM-656 (T7 fase B)
//
// LA VÍCTIMA: un cliente que discute la garantía de un trabajo, y un presupuesto que salió sin la
// cláusula que el profesional creía que llevaba — o CON una que había quitado a propósito.
//
// La fase A dejó el motor (`clausulas.ts`) y el pie del PDF (`pdf.service.ts:972`). Lo que faltaba
// no era pintar: era **poder escribir**. Este fichero prueba las dos escrituras y la que decide
// todo — que excluir en UN presupuesto no toca a los demás.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { soloCodigo } from './_solo-codigo.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const {
  clausulasParaDocumento, normalizarClausulasParaGuardar, leerClausulasDelMerchant,
} = await import('../dist/modules/quotes/domain/clausulas.js');

// Las tres de Tecnosel, tal como están en sus presupuestos.
const DEL_MERCHANT = [
  { id: 'garantia', titulo: 'GARANTÍA', texto: 'Dos años sobre el material instalado.' },
  { id: 'alcance', titulo: 'ALCANCE', texto: 'No incluye los trabajos de albañilería, carpintería, pintura y en general, cualquier concepto o elemento no especificado en la oferta.' },
  { id: 'validez', titulo: 'PLAZO DE VALIDEZ', texto: 'Treinta días desde la fecha de emisión.' },
];

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL ROJO QUE IMPORTA: excluir en UNO no puede quitarla de los DEMÁS
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-656b · 🔴 excluir una cláusula en un presupuesto NO la quita de los demás', () => {
  // El presupuesto de una obra donde no se da garantía porque el material lo pone el cliente.
  const conExclusion = clausulasParaDocumento(DEL_MERCHANT, ['garantia']);
  const normal = clausulasParaDocumento(DEL_MERCHANT, []);
  const otroConLaSuya = clausulasParaDocumento(DEL_MERCHANT, ['validez']);

  assert.deepEqual(conExclusion.map((c) => c.id), ['alcance', 'validez'],
    '🔴 la exclusión no ha quitado la cláusula de SU presupuesto');

  // 🔴 LO QUE DECIDE: la configuración del merchant no se ha tocado.
  assert.deepEqual(normal.map((c) => c.id), ['garantia', 'alcance', 'validez'],
    '🔴 EXCLUIR HA BORRADO. Quitar la garantía de un presupuesto ha dejado sin garantía a TODOS ' +
    'los demás: la configuración del merchant no se toca al excluir, y el siguiente presupuesto ' +
    'tiene que volver a llevarla.');
  assert.deepEqual(otroConLaSuya.map((c) => c.id), ['garantia', 'alcance'],
    '🔴 la exclusión de un presupuesto se está aplicando a otro');

  // Y la lista de origen, intacta como objeto: nadie la ha mutado por el camino.
  assert.equal(DEL_MERCHANT.length, 3, '🔴 se ha mutado la configuración del merchant');
  assert.equal(DEL_MERCHANT[0].id, 'garantia');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 Y CAE CON EL MECANISMO VIEJO: hasta hoy NO HABÍA DÓNDE GUARDARLO
// ═════════════════════════════════════════════════════════════════════════════════════════

/**
 * El bloque `data: { … }` del `tx.quote.create`, acotado por sus llaves.
 *
 * 🔴 ATADO AL BLOQUE, NO AL FICHERO. Un guard que buscara `clausulasExcluidas` en todo
 * `quotes.routes.ts` daría verde con las LECTURAS que ya existían (`:215`, `:553`) y con el
 * comentario que explica esto mismo. Hoy han caído cuatro guards de texto por eso.
 */
function bloqueDelCreate() {
  const fuente = fs.readFileSync(
    path.join(RAIZ, 'src', 'modules', 'quotes', 'app', 'routes', 'quotes.routes.ts'), 'utf8');
  const marca = 'tx.quote.create({';
  const ini = fuente.indexOf(marca);
  assert.ok(ini > 0, '🔴 ESCÁNER CIEGO: no encuentro `tx.quote.create` en quotes.routes.ts');
  // Llaves balanceadas desde la apertura del objeto: no una ventana de tamaño fijo, que mide la
  // longitud del código y no lo que quiere vigilar.
  let i = fuente.indexOf('{', ini + marca.length - 1);
  let nivel = 0;
  for (; i < fuente.length; i++) {
    if (fuente[i] === '{') nivel++;
    else if (fuente[i] === '}') { nivel--; if (nivel === 0) break; }
  }
  assert.ok(nivel === 0, '🔴 ESCÁNER CIEGO: no se cierran las llaves del `create`');
  return fuente.slice(ini, i + 1);
}

test('SCRUM-656b · 🔴 el `create` del presupuesto GUARDA la exclusión (antes solo se leía)', () => {
  const bloque = bloqueDelCreate();

  // SUELO: el bloque tiene que ser el del create de verdad, no un trozo cualquiera.
  assert.ok(bloque.includes('merchantId:') && bloque.includes('quoteNumber'),
    '🔴 ESCÁNER CIEGO: el bloque acotado no es el `data` del create');

  assert.ok(/\bclausulasExcluidas\s*:/.test(bloque),
    '🔴 EL CREATE NO GUARDA `clausulasExcluidas`.\n' +
    '   El PDF la LEE (`quotes.routes.ts:215`) y el esquema la ACEPTA, así que desde fuera parece\n' +
    '   que la exclusión funciona. Sin esta línea, el profesional quita la garantía de UN\n' +
    '   presupuesto, se guarda el presupuesto sin la exclusión, y el PDF sale CON la garantía.');

  assert.ok(/\bivaModo\s*:/.test(bloque),
    '🔴 EL CREATE NO GUARDA `ivaModo`. Es el defecto de la fase A: `quotesView.js:3294` lo manda\n' +
    '   y `quotes.routes.ts:213` lo lee para el PDF, pero nadie lo escribía — el PDF recibía\n' +
    '   `null` SIEMPRE y el documento salía con el IVA sumado aunque se eligiera «no incluido».');
});

test('SCRUM-656b · 🔴 y el PERFIL guarda las cláusulas del merchant', () => {
  const esquema = fs.readFileSync(path.join(RAIZ, 'src', 'core', 'validation', 'schemas.ts'), 'utf8');
  const ini = esquema.indexOf('export const merchantProfileUpdateSchema');
  assert.ok(ini > 0, '🔴 ESCÁNER CIEGO: no encuentro el esquema del perfil');
  const bloque = esquema.slice(ini, esquema.indexOf('\n});', ini));
  assert.ok(/\bclausulasPresupuesto\s*:/.test(bloque),
    '🔴 el perfil del merchant no acepta `clausulasPresupuesto`: no hay dónde escribirlas, y la ' +
    'pantalla de Configuración no tendría a qué llamar.');

  const servicio = fs.readFileSync(path.join(RAIZ, 'src', 'modules', 'system', 'merchantAdmin.ts'), 'utf8');
  assert.ok(servicio.includes('normalizarClausulasParaGuardar'),
    '🔴 el perfil guarda las cláusulas SIN SANEAR: una con el texto vacío quedaría en ' +
    'Configuración, visible para el profesional, y no saldría jamás en el PDF.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// CONTROL POSITIVO: un merchant SIN cláusulas saca el MISMO PDF que hoy
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-656b · CONTROL POSITIVO: sin cláusulas configuradas no se abre NADA', () => {
  for (const vacio of [null, undefined, []]) {
    assert.deepEqual(clausulasParaDocumento(vacio, null), [],
      `🔴 con la configuración «${String(vacio)}» sale algo. El PDF abriría una sección ` +
      '«CONDICIONES» vacía, que es peor que no ponerla.');
  }
  // Y el pie del PDF solo abre sección si hay alguna: comprobado sobre su propio código.
  const pdf = fs.readFileSync(
    path.join(RAIZ, 'src', 'modules', 'invoicing', 'infra', 'pdf', 'pdf.service.ts'), 'utf8');
  const i = pdf.indexOf('clausulasParaDocumento(');
  assert.ok(i > 0, '🔴 ESCÁNER CIEGO: el pie del PDF ya no llama al motor');
  assert.ok(/if \(clausulasDelDocumento\.length > 0\)/.test(pdf.slice(i, i + 400)),
    '🔴 el PDF no comprueba que haya cláusulas antes de abrir la sección');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LA ESCRITURA: ids estables, y nada a medias
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-656b · 🔴 el `id` NO se recalcula al reeditar: la exclusión seguiría a otra cláusula', () => {
  // El profesional reedita: cambia el texto de la garantía y reordena.
  const reeditadas = normalizarClausulasParaGuardar([
    { id: 'alcance', titulo: 'ALCANCE', texto: 'Otro alcance.' },
    { id: 'garantia', titulo: 'GARANTÍA', texto: 'Tres años ahora.' },
  ]);
  assert.deepEqual(reeditadas.map((c) => c.id), ['alcance', 'garantia'],
    '🔴 LOS ids HAN CAMBIADO AL REEDITAR. Un presupuesto que excluía «garantia» pasaría a ' +
    'excluir otra cláusula, o ninguna, y saldría un PDF con una condición que el profesional ' +
    'había retirado a propósito. No falla nada: solo sale mal el papel.');

  // Y una nueva recibe un id que no choca con los que ya hay.
  const conNueva = normalizarClausulasParaGuardar([
    { id: 'garantia', titulo: 'GARANTÍA', texto: 'Dos años.' },
    { titulo: 'FORMA DE PAGO', texto: '50% al aceptar.' },
  ]);
  assert.equal(conNueva.length, 2);
  assert.equal(conNueva[0].id, 'garantia', 'la que ya tenía id lo conserva');
  assert.ok(conNueva[1].id && conNueva[1].id !== 'garantia',
    '🔴 la cláusula nueva ha recibido un id vacío o repetido');

  // Un id REPETIDO es tan peligroso como uno cambiado: excluir uno excluiría los dos.
  const repetido = normalizarClausulasParaGuardar([
    { id: 'x', titulo: 'A', texto: 'a' },
    { id: 'x', titulo: 'B', texto: 'b' },
  ]);
  assert.notEqual(repetido[0].id, repetido[1].id,
    '🔴 dos cláusulas con el MISMO id: excluir una quitaría las dos del documento');
});

test('SCRUM-656b · lo que no es pintable no se GUARDA, no solo no se pinta', () => {
  const guardadas = normalizarClausulasParaGuardar([
    { id: 'a', titulo: 'GARANTÍA', texto: '  Dos años.  ' },
    { id: 'b', titulo: 'SIN TEXTO', texto: '   ' },
    { id: 'c', titulo: '', texto: 'párrafo suelto' },
    'esto no es una cláusula',
    null,
  ]);
  assert.deepEqual(guardadas.map((c) => c.id), ['a'],
    '🔴 se ha guardado una cláusula que el PDF no pintará jamás. El profesional la vería en su ' +
    'pantalla de ajustes y no saldría en ningún documento: el producto le miente.');
  assert.equal(guardadas[0].texto, 'Dos años.', 'se guarda recortada');
});

test('SCRUM-656b · el tope existe y no se pasa', () => {
  const TOPE_ESPERADO = 10;   // por la superficie: no se importa la constante (SCRUM-411)
  const muchas = Array.from({ length: TOPE_ESPERADO + 5 }, (_, i) => ({
    id: `c${i}`, titulo: `T${i}`, texto: `x${i}`,
  }));
  assert.equal(normalizarClausulasParaGuardar(muchas).length, TOPE_ESPERADO,
    "🔴 el tope no se está aplicando al guardar: un pie de página tiene fondo");
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 SUELO: «no ha configurado ninguna» ≠ «no supe leerlas»
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-656b · 🔴 SUELO: una columna ILEGIBLE no se lee como «no tiene ninguna»', () => {
  assert.deepEqual(leerClausulasDelMerchant(null), { ok: true, clausulas: [] });
  assert.deepEqual(leerClausulasDelMerchant(undefined), { ok: true, clausulas: [] });
  assert.deepEqual(leerClausulasDelMerchant([]), { ok: true, clausulas: [] });

  for (const roto of ['{"garantia":1}', 42, {}, true]) {
    assert.deepEqual(leerClausulasDelMerchant(roto), { ok: false, motivo: 'ilegible' },
      `🔴 «${String(roto)}» se está leyendo como «no ha configurado ninguna». En pantalla las dos ` +
      'son una lista vacía y significan lo contrario: la segunda es un PDF saliendo SIN las ' +
      'condiciones que el profesional cree que lleva, y nadie se entera hasta la discusión.');
  }

  const bien = leerClausulasDelMerchant(DEL_MERCHANT);
  assert.equal(bien.ok, true);
  assert.equal(bien.clausulas.length, 3, '🔴 el lector no ve las que sí están: sería ciego');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ⛔ CONTROL NEGATIVO: las cláusulas no tocan un céntimo
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-656b · ⛔ el módulo de cláusulas no hace ni una operación de dinero', () => {
  const fuente = fs.readFileSync(
    path.join(RAIZ, 'src', 'modules', 'quotes', 'domain', 'clausulas.ts'), 'utf8');
  // Sin comentarios: la cabecera habla de garantías y de dinero en prosa, y un guard de texto se
  // caza a sí mismo en el comentario que explica lo que prohíbe.
  //
  // 🔴 Con `soloCodigo` (SCRUM-693/694), no con un regex propio: el casero se come código real en
  // cuanto un literal lleva `//`, y deja pasar cadenas escritas dentro de un bloque.
  const codigo = soloCodigo(fuente, 'clausulas.ts');
  assert.ok(codigo.includes('export function clausulasParaDocumento'),
    '🔴 CIEGO: el despojador se ha llevado el código que hay que mirar');

  for (const patron of [/\bprecio/i, /\bimporte/i, /\btotal\b/i, /\bIVA\b/, /\bcuota\b/i, /[*/+]\s*100\b/]) {
    assert.ok(!patron.test(codigo),
      `🔴 el módulo de cláusulas hace aritmética o toca dinero (${patron}). Las condiciones del ` +
      'pie no cambian ni un céntimo del documento.');
  }
});
