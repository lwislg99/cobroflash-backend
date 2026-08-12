// tests/scrum507-cantidad-supuesta.test.mjs — SCRUM-507
//
// UNA CANTIDAD PROPUESTA POR LA IA SE TIENE QUE PODER DISTINGUIR DE UNA QUE ESCRIBIÓ UNA PERSONA.
//
// ── EL DEFECTO DE FONDO, y no es el número ────────────────────────────────────────────────
// SCRUM-504 alineó el producto en «una cantidad ilegible es 0». `ai.service.ts:140` quedó fuera y
// sigue proponiendo `1`. Pero el problema no es 0-contra-1: es que **una cantidad inventada por la
// IA es indistinguible de una que tecleó el profesional**. Elija Luis lo que elija —0, 1 marcado, o
// no proponer la línea—, lo primero que hace falta es SABER cuál se inventó.
//
// Por eso esto entra sin esperar a la decisión: **no la condiciona y sirve para las tres.**
//
// ── 🔴 Y NO ES SOLO `qty`: SON TRES ───────────────────────────────────────────────────────
// `price` y `tax` caen a 0 por el mismo `|| 0`, en silencio. El de `tax` es el que más pesa: una
// línea con IVA ilegible se propone como **0 %**.
//
// ⚠️ LOS VALORES NO SE TOCAN. Cambiarlos es la decisión del fundador; esto solo los DECLARA.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { soloEjecutable } from './_guard-texto.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const SERVICIO = 'src/modules/ai/domain/ai.service.ts';

/** El mapeo real del servicio, ejercitado sin red: se reproduce su expresión desde el fuente. */
function mapearComoElServicio(l) {
  const supuestos = [];
  if (!Number.isFinite(Number(l.qty)) || Number(l.qty) <= 0) supuestos.push('qty');
  if (!Number.isFinite(Number(l.price)) || Number(l.price) < 0) supuestos.push('price');
  if (!Number.isFinite(Number(l.tax)) || Number(l.tax) < 0) supuestos.push('tax');
  return {
    concept: String(l.concept || '').trim(),
    qty: Math.max(0.01, Number(l.qty) || 1),
    price: Math.max(0, Number(l.price) || 0),
    tax: Math.min(1, Math.max(0, Number(l.tax) || 0)),
    supuestos,
  };
}

const leer = (p) => {
  try {
    return fs.readFileSync(path.join(RAIZ, p), 'utf8');
  } catch (e) {
    assert.fail(`🔴 no se pudo leer ${p} (${e && e.code ? e.code : e}). «Lo declara» y «no supe mirar» son el mismo verde.`);
  }
};

// ── 1 · CONTROL NEGATIVO, PRIMERO ─────────────────────────────────────────────────────────

test('SCRUM-507 · 🔴 CONTROL NEGATIVO: una propuesta LEGIBLE sale exactamente igual que hoy', () => {
  const legibles = [
    { concept: 'Mano de obra', qty: 3, price: 35, tax: 0.21 },
    { concept: 'Descalcificador', qty: 1, price: 690, tax: 0.21 },
    { concept: 'Material vario', qty: 2.5, price: 12.4, tax: 0.1 },
  ];
  for (const l of legibles) {
    const r = mapearComoElServicio(l);
    assert.equal(r.qty, l.qty, '🔴 la cantidad legible ha cambiado');
    assert.equal(r.price, l.price, '🔴 el precio legible ha cambiado');
    assert.equal(r.tax, l.tax, '🔴 el IVA legible ha cambiado');
    assert.deepEqual(r.supuestos, [],
      `🔴 se marca como SUPUESTA una línea que la IA leyó bien (${JSON.stringify(l)}). Una marca que `
      + 'sale cuando no toca se aprende a ignorar, y entonces deja de señalar lo que sí se inventó.');
  }
});

// ── 2 · EL POSITIVO: se distingue lo inventado ────────────────────────────────────────────

test('SCRUM-507 · 🔴 la cantidad INVENTADA queda declarada, y sigue valiendo lo mismo que hoy', () => {
  // Lo que el modelo devuelve cuando no entiende la cantidad: vacío, texto, cero, negativo.
  for (const qty of ['', 'dos unidades', null, undefined, 0, -4, NaN, {}]) {
    const r = mapearComoElServicio({ concept: 'Tubo', qty, price: 10, tax: 0.21 });
    assert.ok(r.supuestos.includes('qty'),
      `🔴 la cantidad ${JSON.stringify(qty)} se inventó y NO se declara.\n\n`
      + '  Esa línea llega al profesional con un número que él no escribió y que no puede\n'
      + '  distinguir del suyo. Ése es el defecto, no el valor concreto.');
    // Y el valor NO se toca: cambiarlo es la decisión del fundador, no de este ticket.
    assert.equal(r.qty, Math.max(0.01, Number(qty) || 1), '🔴 este ticket NO cambia el valor');
  }
});

test('SCRUM-507 · 🔴 no es solo la cantidad: el PRECIO y el IVA también se inventan', () => {
  const sinPrecio = mapearComoElServicio({ concept: 'Tubo', qty: 2, price: 'a convenir', tax: 0.21 });
  assert.deepEqual(sinPrecio.supuestos, ['price'],
    '🔴 un precio ilegible cae a 0 en silencio y no se declara.');

  const sinIva = mapearComoElServicio({ concept: 'Tubo', qty: 2, price: 10, tax: 'el normal' });
  assert.deepEqual(sinIva.supuestos, ['tax'],
    '🔴 UN IVA ILEGIBLE SE PROPONE COMO 0 % Y NO SE DICE. Es el que más pesa de los tres: la línea '
    + 'sale exenta sin que nadie lo haya decidido.');

  const nada = mapearComoElServicio({ concept: 'Tubo' });
  assert.deepEqual(nada.supuestos, ['qty', 'price', 'tax'],
    '🔴 una línea entera inventada tiene que declarar los tres campos.');
});

// ── 3 · EL SERVICIO LO DEVUELVE DE VERDAD ─────────────────────────────────────────────────

test('SCRUM-507 · el servicio DEVUELVE `supuestos`, y sin tocar los valores', () => {
  const src = soloEjecutable(leer(SERVICIO));
  assert.match(src, /supuestos,/,
    '🔴 EL SERVICIO HA DEJADO DE DECLARAR LO QUE SE INVENTA.\n\n'
    + '  Sin ese campo, una cantidad propuesta por la IA vuelve a ser indistinguible de una que\n'
    + '  escribió el profesional — que es la condición de cierre de este ticket, elija el fundador\n'
    + '  la opción que elija.');
  assert.match(src, /qty: Math\.max\(0\.01, Number\(l\.qty\) \|\| 1\)/,
    '🔴 se ha CAMBIADO el valor de la cantidad. Elegir entre 0, 1-marcado o no-proponer es decisión '
    + 'del fundador (SCRUM-507); este ticket solo DECLARA lo que ya pasaba.');
});

test('SCRUM-507 · CONTROL POSITIVO del instrumento: la función hermana sí resuelve la cantidad aparte', () => {
  // Si el barrido no encontrara nada en este fichero, «no hay más invenciones» significaría «no supe
  // mirar». La hermana de albarán tiene su `cantidadUtilizable`, con su criterio escrito y distinto.
  const src = leer(SERVICIO);
  assert.match(src, /function cantidadUtilizable/,
    '🔴 el instrumento no encuentra la función hermana: el censo de «dónde inventa la IA» no vale.');
});
