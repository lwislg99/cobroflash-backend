// tests/scrum294c-criterio-del-merchant.test.mjs — SCRUM-294 (fase C)
//
// EL CABLE: del merchant al libro, sin colapsar los tres estados.
//
// La fase B decide QUÉ FECHA devenga (`campoDeDevengo`, cerrada). Ésta decide **si se le pasa la
// pregunta**, que es lo único que faltaba. Se prueba entero sin base de datos: la decisión es pura.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(import.meta.url);

const { criterioParaElLibro } = require_(path.join(RAIZ, 'dist/modules/invoicing/domain/criterioDelMerchant.js'));
const { campoDeDevengo, CAMPO_EMISION, CAMPO_COBRO } =
  require_(path.join(RAIZ, 'dist/modules/invoicing/domain/devengoPorCaja.js'));

// ── SUELO ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-294c · SUELO: el cable existe y las dos puntas hablan', () => {
  assert.equal(typeof criterioParaElLibro, 'function', '🔴 el cable no está exportado.');
  // Control positivo del INSTRUMENTO: la fase B tiene que seguir distinguiendo las dos fechas. Si
  // devolviera lo mismo para `true` y `false`, nada de lo de abajo probaría nada.
  assert.equal(campoDeDevengo(true), CAMPO_COBRO);
  assert.equal(campoDeDevengo(false), CAMPO_EMISION);
  assert.notEqual(CAMPO_COBRO, CAMPO_EMISION, '🔴 las dos fechas son la misma: no hay nada que decidir.');
});

// ── 🔴 CONTROL NEGATIVO: EL MERCHANT DE SIEMPRE NO CAMBIA ───────────────────────────────────

test('SCRUM-294c · 🔴 CONTROL NEGATIVO: sin criterio de caja se devenga por EMISIÓN, como hoy', () => {
  // El que DECLARA que no.
  const declaraQueNo = criterioParaElLibro({ criterioCaja: false });
  assert.deepEqual(declaraQueNo, { criterioCaja: false });
  assert.equal(campoDeDevengo(declaraQueNo.criterioCaja), CAMPO_EMISION,
    '🔴 un negocio que declara NO estar en criterio de caja ha dejado de devengar por emisión. Es ' +
    'la inmensa mayoría: se le habría cambiado el trimestre de todas sus facturas.');

  // Y el que no ha contestado: el libro NO recibe la clave, así que hace lo de siempre.
  const noConsta = criterioParaElLibro({ criterioCaja: null });
  assert.equal('criterioCaja' in noConsta, false,
    '🔴 se le está pasando al libro una declaración que NADIE ha hecho. Con la clave presente, ' +
    '`campoDeDevengo` LANZA sobre `null` y el libro se rompería para todo merchant que aún no ha ' +
    'contestado — que hoy son todos.');
});

// ── 🔴 LOS TRES ESTADOS, Y QUE NULL NO ES FALSE ─────────────────────────────────────────────

test('SCRUM-294c · 🔴 NULL no se comporta como `false`: no recorren el mismo camino', () => {
  const noConsta = criterioParaElLibro({ criterioCaja: null });
  const declaraQueNo = criterioParaElLibro({ criterioCaja: false });

  assert.notDeepEqual(noConsta, declaraQueNo,
    '🔴 «no consta» y «declara que no» producen lo MISMO. Se han colapsado dos estados que la ' +
    'columna guarda por separado: `false` es una declaración del negocio y `NULL` es que nadie se ' +
    'lo ha preguntado. El día que el devengo cambie para quien declara, arrastraría también a ' +
    'quien no ha contestado.');

  // La diferencia, dicha: uno evalúa una declaración, el otro no evalúa nada.
  assert.deepEqual(noConsta, {});
  assert.deepEqual(declaraQueNo, { criterioCaja: false });
});

test('SCRUM-294c · los tres estados nativos, uno a uno', () => {
  assert.deepEqual(criterioParaElLibro({ criterioCaja: true }), { criterioCaja: true });
  assert.deepEqual(criterioParaElLibro({ criterioCaja: false }), { criterioCaja: false });
  assert.deepEqual(criterioParaElLibro({ criterioCaja: null }), {});
  // `undefined` es lo que devuelve Prisma cuando la columna aún no está en el modelo: mismo caso
  // que `null` — no consta —, y no un error.
  assert.deepEqual(criterioParaElLibro({}), {});
});

test('SCRUM-294c · 🔴 acogido al RECC: el libro devenga por COBRO', () => {
  const acogido = criterioParaElLibro({ criterioCaja: true });
  assert.equal(campoDeDevengo(acogido.criterioCaja), CAMPO_COBRO,
    '🔴 un negocio acogido al criterio de caja sigue devengando por emisión: liquidaría IVA que ' +
    'todavía no ha cobrado, que es exactamente lo que el RECC existe para evitar.');
});

// ── 🔴 EL SUELO: UNA LECTURA QUE FALLA NO SE DEGRADA ────────────────────────────────────────

test('SCRUM-294c · 🔴 SUELO: si el merchant no se pudo leer, LANZA — no cae a «sin criterio»', () => {
  for (const ilegible of [null, undefined]) {
    assert.throws(() => criterioParaElLibro(ilegible), /no se ha podido leer el merchant/,
      `🔴 con el merchant «${String(ilegible)}» se devuelve «no consta» en silencio. «Sin criterio ` +
      'de caja» es el caso de la mayoría, así que degradar a él esconde el fallo PARA SIEMPRE: el ' +
      'acogido al RECC declararía como todos los demás y nadie lo notaría jamás.');
  }
});

test('SCRUM-294c · un valor que no es booleano NO se traduce aquí: lo rechaza la fase B', () => {
  // Traducirlo en este módulo sería decidir dos veces sobre el mismo dato, y las dos decisiones
  // podrían separarse. Se deja pasar tal cual, y `campoDeDevengo` —que ya sabe— lanza.
  const raro = criterioParaElLibro({ criterioCaja: 'sí' });
  assert.deepEqual(raro, { criterioCaja: 'sí' });
  assert.throws(() => campoDeDevengo(raro.criterioCaja), /no se puede decidir el devengo/,
    '🔴 un valor no reconocido acaba eligiendo una fecha en vez de lanzar.');
});
