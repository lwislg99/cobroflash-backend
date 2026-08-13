// tests/scrum507-cantidad-supuesta.test.mjs — SCRUM-507
//
// UNA CANTIDAD PROPUESTA POR LA IA SE TIENE QUE PODER DISTINGUIR DE UNA QUE ESCRIBIÓ UNA PERSONA.
//
// ── EL DEFECTO DE FONDO, y no es el número ────────────────────────────────────────────────
// SCRUM-504 alineó el producto en «una cantidad ilegible es 0». `ai.service.ts:140` quedó fuera y
// seguía proponiendo `1`. Pero el problema no era 0-contra-1: es que **una cantidad inventada por la
// IA era indistinguible de una que tecleó el profesional**.
//
// ── Y NO ERA SOLO `qty`: ERAN TRES ────────────────────────────────────────────────────────
// `price` y `tax` caían a 0 por el mismo `|| 0`, en silencio. El de `tax` es el que más pesa: una
// línea con IVA ilegible se proponía como **0 %**.
//
// ── LA DECISIÓN DEL FUNDADOR (2-ago-2026), y por qué son DOS respuestas distintas ─────────
//   · `qty` y `price` → **se proponen y se marcan**. Un número raro se VE: el profesional lo mira,
//     lo corrige y sigue. La marca solo tiene que decirle cuál no escribió él.
//   · `tax` → **la línea NO se propone**, y se dice cuál. Un 0 % no se ve: *parece una decisión que
//     alguien tomó*. La asimetría de coste lo cierra — una línea que falta se añade a mano en diez
//     segundos; una exenta que no debía serlo se descubre en una inspección.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { soloEjecutable } from './_guard-texto.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const SERVICIO = 'src/modules/ai/domain/ai.service.ts';

/**
 * 🔴 `Number(null)`, `Number('')`, `Number(false)` y `Number([])` valen **0**: con `Number()` a
 * secas, un modelo que se calla el impuesto produce una línea EXENTA. Solo es IVA lo que ES un
 * número —o una cadena con un número dentro— y cae en [0, 1] (el contrato es la fracción, 0,21).
 */
function ivaLegible(bruto) {
  const enRango = (n) => (Number.isFinite(n) && n >= 0 && n <= 1 ? n : null);
  if (typeof bruto === 'number') return enRango(bruto);
  if (typeof bruto === 'string' && bruto.trim() !== '') return enRango(Number(bruto.trim()));
  return null;
}

/**
 * El mapeo real del servicio, ejercitado sin red: se reproduce su decisión línea a línea.
 * Devuelve `{ descartada }` cuando la línea NO se propone, o la línea propuesta con `supuestos`.
 */
function mapearComoElServicio(l) {
  const tax = ivaLegible(l.tax);
  if (tax === null) {
    return { descartada: { concept: String(l.concept || '').trim(), motivo: 'iva_ilegible' } };
  }
  const qtyBruto = Number(l.qty);
  const priceBruto = Number(l.price);
  const supuestos = [];
  if (!Number.isFinite(qtyBruto) || qtyBruto <= 0) supuestos.push('qty');
  if (!Number.isFinite(priceBruto) || priceBruto < 0) supuestos.push('price');
  return {
    concept: String(l.concept || '').trim(),
    qty: Number.isFinite(qtyBruto) && qtyBruto > 0 ? qtyBruto : 1,  // `cantidadUtilizable`, REUTILIZADA
    price: Math.max(0, priceBruto || 0),
    tax,
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
    { concept: 'Suministro exento', qty: 1, price: 40, tax: 0 },   // un 0 % que SÍ dijo el modelo
  ];
  for (const l of legibles) {
    const r = mapearComoElServicio(l);
    assert.equal(r.descartada, undefined,
      `🔴 se ha DESCARTADO una línea que la IA leyó bien (${JSON.stringify(l)}). Descartar de más es `
      + 'quitarle trabajo del presupuesto a alguien que no se va a dar cuenta.');
    assert.equal(r.qty, l.qty, '🔴 la cantidad legible ha cambiado');
    assert.equal(r.price, l.price, '🔴 el precio legible ha cambiado');
    assert.equal(r.tax, l.tax, '🔴 el IVA legible ha cambiado');
    assert.deepEqual(r.supuestos, [],
      `🔴 se marca como SUPUESTA una línea que la IA leyó bien (${JSON.stringify(l)}). Una marca que `
      + 'sale cuando no toca se aprende a ignorar, y entonces deja de señalar lo que sí se inventó.');
  }
});

// ── 2 · `qty` Y `price`: SE PROPONEN, PERO SE DICE CUÁL SE INVENTÓ ─────────────────────────

test('SCRUM-507 · 🔴 la cantidad INVENTADA queda declarada, y nombrando la línea', () => {
  // Lo que el modelo devuelve cuando no entiende la cantidad: vacío, texto, cero, negativo.
  for (const qty of ['', 'dos unidades', null, undefined, 0, -4, NaN, {}]) {
    const r = mapearComoElServicio({ concept: 'Tubo de cobre 15 mm', qty, price: 10, tax: 0.21 });
    assert.ok(r.supuestos.includes('qty'),
      `🔴 la cantidad de «Tubo de cobre 15 mm» se inventó (${JSON.stringify(qty)}) y NO se declara.\n\n`
      + '  Esa línea llega al profesional con un número que él no escribió y que no puede\n'
      + '  distinguir del suyo. Ése es el defecto, no el valor concreto.');
  }
});

test('SCRUM-507 · 🔴 la rareza del 0,01 muere al REUTILIZAR la función hermana', () => {
  // `Math.max(0.01, Number(x) || 1)` mandaba el 0 a **1** (por falsy) y el -4 a **0,01** — «0,01
  // unidades» de algo. Dos ilegibles, dos respuestas distintas y ninguna explicable. La hermana de
  // albarán ya tenía el criterio escrito: `cantidadUtilizable` manda los dos a 1.
  for (const qty of [0, -4, -0.5]) {
    const r = mapearComoElServicio({ concept: 'Tubo', qty, price: 10, tax: 0.21 });
    assert.equal(r.qty, 1, `🔴 la cantidad ${qty} no cae a 1: ha vuelto el 0,01`);
    assert.ok(r.supuestos.includes('qty'), '🔴 y sigue teniendo que constar como supuesta');
  }
});

test('SCRUM-507 · 🔴 el PRECIO inventado también se declara, y por separado', () => {
  const r = mapearComoElServicio({ concept: 'Tubo', qty: 2, price: 'a convenir', tax: 0.21 });
  assert.deepEqual(r.supuestos, ['price'],
    '🔴 un precio ilegible cae a 0 en silencio y no se declara. Y `supuestos` tiene que decir QUÉ '
    + 'campo — «esta línea tiene algo inventado» no le dice al profesional dónde mirar.');
  assert.equal(r.price, 0, '🔴 el valor del precio ilegible cambia: la decisión era marcarlo, no moverlo');
});

// ── 3 · `tax`: LA LÍNEA NO SE PROPONE, Y SE DICE CUÁL ──────────────────────────────────────

test('SCRUM-507 · 🔴 una línea con IVA ILEGIBLE no se propone', () => {
  // 🔴 LOS CUATRO DEL MEDIO SON EL FILO DEL TICKET: `Number(null)`, `Number('')`, `Number(false)` y
  // `Number([])` valen **0**. Con `Number()` a secas los cuatro pasaban el filtro y salían como una
  // línea EXENTA — el caso más caro, y el único que no se ve.
  for (const tax of ['el normal', null, '', false, [], undefined, NaN, -0.1, 1.5, 21, {}]) {
    const l = { concept: 'Instalación caldera', qty: 1, price: 1200, tax };
    const r = mapearComoElServicio(l);
    assert.deepEqual(r.descartada, { concept: 'Instalación caldera', motivo: 'iva_ilegible' },
      `🔴 SE HA VUELTO A PROPONER UNA LÍNEA CON IVA ILEGIBLE (tax=${JSON.stringify(tax)}).\n\n`
      + '  Sale al 0 %, y un 0 % *parece una decisión que alguien tomó*: una cantidad rara se ve, un\n'
      + '  IVA a cero no. La asimetría de coste lo cierra — una línea que falta se añade a mano en\n'
      + '  diez segundos; una exenta que no debía serlo se descubre en una inspección.');
    assert.equal(r.qty, undefined, '🔴 la línea descartada no se propone: no lleva valores');
  }
  // 🔴 EL 21 NO ES UN DESPISTE DE LA LISTA: el contrato del servicio es la FRACCIÓN (0,21). Un `21`
  // es el modelo hablando en porcentaje, y colarlo multiplicaría el impuesto por cien.
});

test('SCRUM-507 · 🔴 el concepto de la descartada NO se pierde', () => {
  const r = mapearComoElServicio({ concept: 'Descalcificador', qty: 1, price: 690, tax: null });
  assert.equal(r.descartada.concept, 'Descalcificador',
    '🔴 la línea desaparece SIN DECIR de qué era. Desaparecer en silencio es otro fallo mudo con la '
    + 'misma forma que el que arregla este ticket: el profesional tiene que saber QUÉ trabajo no se '
    + 'propuso para poder escribirlo a mano.');
});

// ── 4 · EL SERVICIO Y LA RUTA LO HACEN DE VERDAD ──────────────────────────────────────────

test('SCRUM-507 · el servicio DESCARTA por IVA y DECLARA lo supuesto', () => {
  const src = soloEjecutable(leer(SERVICIO));
  assert.match(src, /supuestos,/,
    '🔴 EL SERVICIO HA DEJADO DE DECLARAR LO QUE SE INVENTA.\n\n'
    + '  Sin ese campo, una cantidad propuesta por la IA vuelve a ser indistinguible de una que\n'
    + '  escribió el profesional — que es la condición de cierre de este ticket.');
  assert.match(src, /qty: cantidadUtilizable\(l\?\.qty\)/,
    '🔴 la cantidad ha dejado de salir de `cantidadUtilizable`. Esa función YA resolvía la '
    + 'incoherencia del 0,01, y duplicar el criterio es tener dos fuentes para el mismo hecho: '
    + 'discreparán, y el día que discrepen nadie mirará aquí.');
  assert.match(src, /descartadas\.push\(\{ concept, motivo: 'iva_ilegible' \}\)/,
    '🔴 UNA LÍNEA CON IVA ILEGIBLE HA VUELTO A PROPONERSE, o se descarta sin dejar rastro de cuál.');
  assert.match(src, /const tax = ivaLegible\(l\?\.tax\)/,
    '🔴 el IVA ha vuelto a leerse con `Number()`. `Number(null)`, `Number("")`, `Number(false)` y '
    + '`Number([])` valen **0**: con eso, un modelo que se calla el impuesto vuelve a producir una '
    + 'línea EXENTA, que es justo el caso que este ticket cierra.');
});

test('SCRUM-507 · la ruta DEVUELVE las descartadas al navegador', () => {
  // Si el servicio las aparta y la ruta no las manda, el descarte es indistinguible de que el
  // modelo nunca leyera esa línea: se habría cambiado un fallo mudo por otro.
  const ruta = soloEjecutable(leer('src/modules/ai/app/routes/ai.routes.ts'));
  assert.match(ruta, /descartadas: propuesta\.descartadas/,
    '🔴 LA RUTA SE COME LAS DESCARTADAS. El navegador no puede decir qué línea falta si no le llega.');
});

test('SCRUM-507 · el navegador PINTA las dos cosas, y como marcador sin aprobar (regla 30)', () => {
  const vista = leer('public/dashboard/js/aiQuoteAssistant.js');
  assert.match(soloEjecutable(vista), /descartadas/,
    '🔴 el aviso de líneas descartadas ha desaparecido de la pantalla: el profesional no se entera.');
  assert.match(soloEjecutable(vista), /ai-linea-supuesta/,
    '🔴 la marca por línea ha desaparecido: vuelve a ser indistinguible lo suyo de lo inventado.');
  assert.equal((vista.match(/\[PENDIENTE microcopy oficial/g) || []).length, 2,
    '🔴 los dos textos tienen que ser MARCADORES hasta que el fundador los firme (regla 30). Y aquí '
    + 'no es cosmético: el texto es lo único que separa «revisa este número» de «esto está mal».');
});

test('SCRUM-507 · CONTROL POSITIVO del instrumento: la función hermana existe y se lee', () => {
  // Si el barrido no encontrara nada en este fichero, «no hay más invenciones» significaría «no supe
  // mirar». `cantidadUtilizable` es la referencia comprobable de que sí se está leyendo el fuente.
  const src = leer(SERVICIO);
  assert.match(src, /function cantidadUtilizable/,
    '🔴 el instrumento no encuentra la función hermana: el censo de «dónde inventa la IA» no vale.');
});
