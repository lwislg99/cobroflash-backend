// SCRUM-302 (C2) · EL PATRÓN DE DETALLE, APLICADO AL ALBARÁN — Y SUS TRES PREMISAS MEDIDAS.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// UNA SOLA LEY
//
// La maquinaria del patrón (destinos, reglas, resolutor, marcador de microcopy) se extrajo de
// `invoiceActionsRegistry.js` a `patronDetalleAcciones.js` al abrir C2. Si el albarán se hubiera
// llevado su copia, hoy habría **dos registros del mismo hecho** — el defecto de las dos listas
// que esta casa lleva toda la semana pagando. Aquí se comprueba que sigue habiendo una.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LAS TRES PREMISAS, Y DOS DE ELLAS DESMIENTEN AL ENUNCIADO
//
//   1. El estado NO se llama «Enviado»: son `borrador | emitido | firmado`.
//   2. «Facturado» NO es un estado: es un derivado de TRES valores, y aplanarlo pierde el
//      `parcial`, que en una obra por fases es el caso normal.
//   3. El **libro de líneas facturadas** (`AlbaranLineaFacturada`) NO referencia al presupuesto:
//      ata `albaranId + lineaIndex → invoiceId`, y nada más. Por eso esta página no ofrece
//      ninguna vista de «lo facturado vs lo presupuestado» sacada de ese libro.
//
// Las tres se comprueban **contra el schema y el dominio**, no contra el enunciado: es la misma
// clase de error que el ticket confiesa haber cometido en B2.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ⚠️ LA PREMISA 3 DECÍA OTRA COSA, Y CADUCÓ EL 5-AGO-2026 CON SCRUM-367
//
// Decía: «las líneas del albarán NO se pueden casar con las del presupuesto: no hay campo que las
// ate». Eso **ya no es cierto**: `AlbaranLinea.quoteLineIndex` existe desde SCRUM-367
// (`albaran.service.ts:56`), se conserva al editar (`:128-149`), se valida contra el rango real
// (`jobs.routes.ts:664-667`) y lo escribe el prellenado (`jobDetailView.js:313`).
//
// El TEST de abajo nunca midió eso: mide el modelo `AlbaranLineaFacturada`, donde efectivamente no
// hay referencia al presupuesto, y sigue verde con razón. Lo que caducó fue **este comentario**,
// que afirmaba algo del sistema entero mientras el test comprobaba un rincón.
//
// 🔴 LA LECCIÓN, porque costó una decisión tomada sobre una premisa falsa:
//
//   Un comentario que afirma un HECHO DEL SISTEMA caduca cuando el sistema cambia, y nadie lo
//   revisa porque no está en ninguna suite. Un comentario que describe LO QUE MIDE EL TEST DE AL
//   LADO no puede caducar sin que el test caiga.
//
// Por eso la premisa 3 se ha reescrito para decir qué mide, no qué pasa en el mundo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8');
const require_ = createRequire(import.meta.url);

const ley = require_(path.join(RAIZ, 'public/dashboard/js/patronDetalleAcciones.js'));
const { ALBARAN_ACTION_REGISTRY, ALBARAN_STATES } =
  require_(path.join(RAIZ, 'public/dashboard/js/albaranActionsRegistry.js'));
const SCHEMA = leer('prisma', 'schema.prisma');
// SCRUM-301: el eje de cobro ya existe en runtime, así que se lee del valor compilado y no del
// texto del fichero. Un assert sobre la prosa cae cuando alguien reordena un comentario; éste no.
const { ESTADOS_COBRO } = require_(path.join(RAIZ, 'dist/modules/jobs/domain/albaranFacturacion.js'));

// ═════════════════════════════════════════════════════════════════════════════════════════
// 1 · PREMISA DESMENTIDA: los estados reales
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-302 · los estados del albarán son los del MODELO, y «Enviado» no es uno', () => {
  // Derivado del schema, no copiado del ticket.
  const bloque = SCHEMA.slice(SCHEMA.indexOf('model Albaran '), SCHEMA.indexOf('model Albaran ') + 1200);
  const comentario = bloque.match(/estado\s+String\s+@default\("borrador"\)\s*\/\/\s*([^\n]+)/);
  assert.ok(comentario, '🔴 no encuentro la declaración de `estado` en el modelo Albaran');
  const delModelo = comentario[1].split('(')[0].split('|').map((s) => s.trim()).filter(Boolean);

  assert.deepEqual(
    ALBARAN_STATES, delModelo,
    `🔴 la tabla usa estados que el modelo no tiene. Modelo: ${delModelo.join(' | ')}. ` +
      'El enunciado hablaba de «Enviado» y NO existe: es la misma equivocación que el ticket ' +
      'confiesa de B2, y con una columna inventada ninguna transición cuadra.',
  );
  assert.ok(!ALBARAN_STATES.includes('Enviado') && !ALBARAN_STATES.includes('enviado'));
});

test('SCRUM-302 · «enviado para firmar» se trata como DERIVADO, no como estado', () => {
  // El schema lo dice: `enviadoParaFirmaAt != null && estado === 'emitido'`. Si apareciera como
  // estado en la tabla, el registro estaría describiendo un modelo que no existe.
  assert.match(SCHEMA, /enviadoParaFirmaAt != null && estado === 'emitido'/,
    '🔴 ha cambiado la definición del derivado en el modelo: revisar antes de fiarse de la tabla');
  assert.ok(!ALBARAN_STATES.some((e) => /enviad/i.test(e)));
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 2 · PREMISA: «facturado» es un derivado de TRES valores y no se aplana
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-302 · «facturado» NO es un estado de la tabla, y conserva sus tres valores', () => {
  // SCRUM-301: este assert miraba el TEXTO de la unión (`EstadoCobro = 'sin_facturar' | …`). El eje
  // pasó a existir en RUNTIME —`ESTADOS_COBRO` como const, con el tipo derivado de ella— para que
  // las pestañas del listado global se puedan construir sin enumerar nada a mano. La premisa que
  // este test protege no ha cambiado ni un ápice; lo que cambia es dónde se lee, y ahora se lee del
  // valor COMPILADO en vez de la prosa del fichero: si alguien quita un valor, esto sigue cayendo,
  // y ya no cae por reordenar un comentario.
  assert.deepEqual([...ESTADOS_COBRO], ['sin_facturar', 'parcial', 'facturado'],
    '🔴 el derivado ha dejado de tener tres valores');
  assert.ok(!ALBARAN_STATES.includes('facturado'),
    '🔴 «facturado» se ha metido como estado. Aplanarlo pierde el PARCIAL — y en una obra por ' +
    'fases el parcial es el caso normal, no la excepción.');
  // Y la acción de facturar es CONTEXTUAL: depende del derivado, no de un booleano.
  const facturar = ALBARAN_ACTION_REGISTRY.find((a) => a.id === 'btnFacturar');
  assert.ok(facturar?.cuando, '🔴 facturar no depende del contexto: entonces se pinta también cuando no queda nada');
});

test('SCRUM-302 · con el albarán ya facturado del todo, facturar NO ocupa la primaria', () => {
  const facturar = ALBARAN_ACTION_REGISTRY.find((a) => a.id === 'btnFacturar');
  assert.equal(ley.destinoEfectivo(facturar, 'firmado', { 'valorado-con-pendiente': true }), 'primaria');
  assert.equal(
    ley.destinoEfectivo(facturar, 'firmado', { 'valorado-con-pendiente': false }), 'oculta',
    '🔴 se ofrece «facturar» cuando ya no queda nada pendiente: el pro pulsa y no hay nada que hacer',
  );
  assert.equal(
    ley.destinoEfectivo(facturar, 'firmado', {}), 'oculta',
    '🔴 sin contexto se pinta igual. Ante la duda, el patrón se apoya en que la primaria sea de fiar.',
  );
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 3 · PREMISA: el LIBRO DE LÍNEAS FACTURADAS no referencia al presupuesto
//
// ⚠️ Ojo con el título de antes («nada ata las líneas del albarán con las del presupuesto»): eso
// dejó de ser cierto con SCRUM-367 y `quoteLineIndex`. Lo que este test mide —y lo único que
// midió nunca— es el modelo `AlbaranLineaFacturada`. Ver la cabecera del fichero.
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-302 · el libro de líneas facturadas no referencia al presupuesto (y no se finge)', () => {
  const bloque = SCHEMA.slice(SCHEMA.indexOf('model AlbaranLineaFacturada'));
  const fin = bloque.indexOf('\n}');
  const modelo = bloque.slice(0, fin);
  assert.match(modelo, /lineaIndex/, '🔴 el libro ya no referencia la línea del albarán');
  assert.doesNotMatch(
    modelo, /quote|presupuesto/i,
    '🔴 ha aparecido una referencia al presupuesto en el libro de líneas facturadas. Si ahora SÍ ' +
    'se pueden casar, esta premisa cambia y hay que rehacer la decisión, no seguir asumiéndola.',
  );
  // Y la vista no ofrece ninguna comparación: lo que no se puede casar, no se enseña casado.
  const registro = leer('public', 'dashboard', 'js', 'albaranActionsRegistry.js');
  assert.doesNotMatch(registro.replace(/^\s*\/\/.*$/gm, ''), /comparar|vsPresupuesto|casar/i,
    '🔴 hay una acción que promete comparar albarán y presupuesto, y esa correspondencia no existe');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 4 · LA LEY · una sola, y el albarán la cumple
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-302 · la tabla del albarán cumple la ley en TODOS sus estados', () => {
  for (const ctx of [{ 'valorado-con-pendiente': true }, { 'valorado-con-pendiente': false }, {}]) {
    const fallos = ley.incumplimientosDeLaLey(ALBARAN_ACTION_REGISTRY, ALBARAN_STATES, ctx);
    assert.deepEqual(fallos, [], `🔴 la tabla incumple el patrón con ctx=${JSON.stringify(ctx)}:\n    ${fallos.join('\n    ')}`);
  }
});

test('SCRUM-302 · cada estado tiene UN siguiente paso, y ninguno se queda sin acciones', () => {
  for (const estado of ALBARAN_STATES) {
    const ctx = { 'valorado-con-pendiente': true };
    const destinos = ALBARAN_ACTION_REGISTRY.map((a) => ley.destinoEfectivo(a, estado, ctx));
    assert.equal(destinos.filter((d) => d === 'primaria').length, 1,
      `🔴 «${estado}» no tiene exactamente un siguiente paso`);
    assert.ok(destinos.some((d) => d !== 'oculta'), `🔴 «${estado}» se queda sin ninguna acción visible`);
  }
});

test('SCRUM-302 · SUELO: hay UNA ley y la factura la comparte', () => {
  // Si alguien vuelve a escribir el resolutor dentro de un registro, esto cae.
  const factura = leer('public', 'dashboard', 'js', 'invoiceActionsRegistry.js');
  const albaran = leer('public', 'dashboard', 'js', 'albaranActionsRegistry.js');
  // RESPALDO de la negación de abajo (SCRUM-237): el patrón SÍ casa donde la ley vive de verdad.
  // Sin este hermano, un `doesNotMatch` con una regex rota sería verde para siempre y no probaría
  // nada — el patrón de scrum73 que aquel ticket cerró.
  assert.match(
    leer('public', 'dashboard', 'js', 'patronDetalleAcciones.js'), /function destinoEfectivo/,
    '🔴 el resolutor no está en la ley compartida: entonces la negación de abajo no significa nada',
  );
  for (const [nombre, src] of [['factura', factura], ['albarán', albaran]]) {
    assert.doesNotMatch(
      src.replace(/^\s*\/\/.*$/gm, ''), /function destinoEfectivo/,
      `🔴 el registro de ${nombre} define su PROPIO resolutor: dos leyes del mismo patrón se ` +
      'separan solas, que es el defecto de las dos listas otra vez',
    );
  }
  assert.match(factura, /patronDetalleAcciones\.js/, '🔴 la factura ya no comparte la ley');
  assert.ok(typeof ley.incumplimientosDeLaLey === 'function' && typeof ley.destinoEfectivo === 'function');
});
