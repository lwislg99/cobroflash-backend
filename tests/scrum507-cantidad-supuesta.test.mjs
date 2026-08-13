// tests/scrum507-cantidad-supuesta.test.mjs — SCRUM-507
//
// UNA CANTIDAD PROPUESTA POR LA IA SE TIENE QUE PODER DISTINGUIR DE UNA QUE ESCRIBIÓ UNA PERSONA.
//
// ── EL DEFECTO DE FONDO, y no es el número ────────────────────────────────────────────────
// SCRUM-504 alineó el producto en «una cantidad ilegible es 0». `ai.service.ts:140` quedó fuera y
// seguía proponiendo `1`. Pero el problema no era 0-contra-1: es que **una cantidad inventada por la
// IA era indistinguible de una que tecleó el profesional**. Y no era solo `qty`: `price` y `tax`
// caían a 0 por el mismo `|| 0`, en silencio.
//
// ── LA DECISIÓN DEL FUNDADOR (2-ago-2026), y por qué son DOS respuestas distintas ─────────
//   · `qty` y `price` → **se proponen y se marcan**. Un número raro se VE: el profesional lo mira,
//     lo corrige y sigue. La marca solo tiene que decirle cuál no escribió él.
//   · `tax` → **la línea NO se propone**, y se dice cuál. Un 0 % no se ve: *parece una decisión que
//     alguien tomó*. La asimetría de coste lo cierra — una línea que falta se añade a mano en diez
//     segundos; una exenta que no debía serlo se descubre en una inspección.
//
// ── 🔴 ESTE FICHERO EJERCITA EL CÓDIGO QUE CORRE, NO UNA COPIA ────────────────────────────
// La primera versión reproducía el mapeo en un doble local, porque vivía dentro de
// `suggestQuoteLines`, detrás de la llamada al modelo. **Lo medí y no valía**: al romper el
// servicio a propósito, cuatro rojos que tenían que salir **seguían verdes** — el test medía la
// copia. Por eso el criterio se sacó a `lineasSugeridas.ts`, que es puro, y aquí se importa de
// `dist/`. Un test que mide una copia del criterio es el mismo defecto que persigue el ticket.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { soloEjecutable } from './_guard-texto.mjs';
import { mapearLineasSugeridas } from '../dist/modules/ai/domain/lineasSugeridas.js';

const RAIZ = path.resolve(import.meta.dirname, '..');
const SERVICIO = 'src/modules/ai/domain/ai.service.ts';
const CRITERIO = 'src/modules/ai/domain/lineasSugeridas.ts';

/** Una línea suelta por el mapeo REAL. */
const mapear = (l) => {
  const r = mapearLineasSugeridas([l]);
  return r.lineas[0] ?? { descartada: r.descartadas[0] };
};

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
  const { lineas, descartadas } = mapearLineasSugeridas(legibles);
  assert.deepEqual(descartadas, [],
    '🔴 se ha DESCARTADO una línea que la IA leyó bien. Descartar de más es quitarle trabajo del '
    + 'presupuesto a alguien que no se va a dar cuenta de que falta.');
  assert.equal(lineas.length, legibles.length, '🔴 se ha perdido alguna línea legible por el camino');
  for (let i = 0; i < legibles.length; i++) {
    assert.equal(lineas[i].concept, legibles[i].concept, '🔴 el concepto ha cambiado');
    assert.equal(lineas[i].qty, legibles[i].qty, '🔴 la cantidad legible ha cambiado');
    assert.equal(lineas[i].price, legibles[i].price, '🔴 el precio legible ha cambiado');
    assert.equal(lineas[i].tax, legibles[i].tax, '🔴 el IVA legible ha cambiado');
    assert.deepEqual(lineas[i].supuestos, [],
      `🔴 se marca como SUPUESTA una línea que la IA leyó bien (${JSON.stringify(legibles[i])}). Una `
      + 'marca que sale cuando no toca se aprende a ignorar, y entonces deja de señalar lo inventado.');
  }
});

// ── 2 · `qty` Y `price`: SE PROPONEN, PERO SE DICE CUÁL SE INVENTÓ ─────────────────────────

test('SCRUM-507 · 🔴 la cantidad INVENTADA queda declarada, y nombrando la línea', () => {
  // Lo que el modelo devuelve cuando no entiende la cantidad: vacío, texto, cero, negativo.
  for (const qty of ['', 'dos unidades', null, undefined, 0, -4, NaN, {}]) {
    const r = mapear({ concept: 'Tubo de cobre 15 mm', qty, price: 10, tax: 0.21 });
    assert.ok(r.supuestos?.includes('qty'),
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
    const r = mapear({ concept: 'Tubo', qty, price: 10, tax: 0.21 });
    assert.equal(r.qty, 1, `🔴 la cantidad ${qty} no cae a 1: ha vuelto el 0,01`);
    assert.ok(r.supuestos.includes('qty'), '🔴 y sigue teniendo que constar como supuesta');
  }
});

test('SCRUM-507 · 🔴 el PRECIO inventado también se declara, y por separado', () => {
  const r = mapear({ concept: 'Tubo', qty: 2, price: 'a convenir', tax: 0.21 });
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
    const { lineas, descartadas } = mapearLineasSugeridas([l]);
    assert.deepEqual(descartadas, [{ concept: 'Instalación caldera', motivo: 'iva_ilegible' }],
      `🔴 SE HA VUELTO A PROPONER UNA LÍNEA CON IVA ILEGIBLE (tax=${JSON.stringify(tax)}).\n\n`
      + '  Sale al 0 %, y un 0 % *parece una decisión que alguien tomó*: una cantidad rara se ve, un\n'
      + '  IVA a cero no. La asimetría de coste lo cierra — una línea que falta se añade a mano en\n'
      + '  diez segundos; una exenta que no debía serlo se descubre en una inspección.');
    assert.deepEqual(lineas, [], '🔴 la línea descartada se propone igualmente');
  }
  // 🔴 EL 21 NO ES UN DESPISTE DE LA LISTA: el contrato del servicio es la FRACCIÓN (0,21). Un `21`
  // es el modelo hablando en porcentaje, y colarlo multiplicaría el impuesto por cien.
});

test('SCRUM-507 · 🔴 el concepto de la descartada NO se pierde', () => {
  const { descartadas } = mapearLineasSugeridas([{ concept: 'Descalcificador', qty: 1, price: 690, tax: null }]);
  assert.equal(descartadas[0]?.concept, 'Descalcificador',
    '🔴 la línea desaparece SIN DECIR de qué era. Desaparecer en silencio es otro fallo mudo con la '
    + 'misma forma que el que arregla este ticket: el profesional tiene que saber QUÉ trabajo no se '
    + 'propuso para poder escribirlo a mano.');
});

test('SCRUM-507 · una propuesta MIXTA no contamina: cae la mala y salen las buenas', () => {
  const { lineas, descartadas } = mapearLineasSugeridas([
    { concept: 'Mano de obra', qty: 3, price: 35, tax: 0.21 },
    { concept: 'Junta tórica', qty: null, price: 2, tax: 0.21 },
    { concept: 'Instalación caldera', qty: 1, price: 1200, tax: null },
  ]);
  assert.deepEqual(lineas.map((l) => l.concept), ['Mano de obra', 'Junta tórica'],
    '🔴 una línea mala se lleva por delante a las buenas (o al revés). El descarte es POR LÍNEA.');
  assert.deepEqual(lineas[0].supuestos, [], '🔴 la línea legible sale marcada por culpa de otra');
  assert.deepEqual(lineas[1].supuestos, ['qty'], '🔴 la línea con cantidad inventada no queda marcada');
  assert.deepEqual(descartadas, [{ concept: 'Instalación caldera', motivo: 'iva_ilegible' }]);
});

// ── 4 · EL CRITERIO ESTÁ DONDE SE PUEDE MEDIR, Y LLEGA HASTA LA PANTALLA ───────────────────

test('SCRUM-507 · el servicio USA el criterio, no lo reimplementa', () => {
  // Si `suggestQuoteLines` volviera a mapear por su cuenta, este fichero seguiría verde midiendo un
  // módulo que ya no manda — que es exactamente cómo se me escapó la primera vez.
  const src = soloEjecutable(leer(SERVICIO));
  assert.match(src, /return mapearLineasSugeridas\(parsed\)/,
    '🔴 EL SERVICIO HA VUELTO A MAPEAR POR SU CUENTA. Dos sitios decidiendo lo mismo discrepan, y '
    + 'los tests se quedan midiendo el que no corre.');
  assert.ok(!/supuestos\.push/.test(src),
    '🔴 el servicio ha recuperado su propia copia del criterio: una fuente para el mismo hecho.');
});

test('SCRUM-507 · el criterio DESCARTA por IVA y DECLARA lo supuesto', () => {
  const src = soloEjecutable(leer(CRITERIO));
  assert.match(src, /qty: cantidadUtilizable\(l\?\.qty\)/,
    '🔴 la cantidad ha dejado de salir de `cantidadUtilizable`. Esa función YA resolvía la '
    + 'incoherencia del 0,01, y duplicar el criterio es tener dos fuentes para el mismo hecho: '
    + 'discreparán, y el día que discrepen nadie mirará aquí.');
  assert.match(src, /const tax = ivaLegible\(l\?\.tax\)/,
    '🔴 el IVA ha vuelto a leerse con `Number()`. `Number(null)`, `Number("")`, `Number(false)` y '
    + '`Number([])` valen **0**: con eso, un modelo que se calla el impuesto vuelve a producir una '
    + 'línea EXENTA, que es justo el caso que este ticket cierra.');
});

test('SCRUM-507 · la ruta DEVUELVE las descartadas al navegador', () => {
  // Si el criterio las aparta y la ruta no las manda, el descarte es indistinguible de que el
  // modelo nunca leyera esa línea: se habría cambiado un fallo mudo por otro.
  const ruta = soloEjecutable(leer('src/modules/ai/app/routes/ai.routes.ts'));
  assert.match(ruta, /descartadas: propuesta\.descartadas/,
    '🔴 LA RUTA SE COME LAS DESCARTADAS. El navegador no puede decir qué línea falta si no le llega.');
});

test('SCRUM-507 · el navegador PINTA las dos cosas, y como marcador sin aprobar (regla 30)', () => {
  const vista = leer('public/dashboard/js/aiQuoteAssistant.js');
  const ejecutable = soloEjecutable(vista);
  assert.match(ejecutable, /descartadas = data\.descartadas/,
    '🔴 el navegador ha dejado de LEER las descartadas de la respuesta: la lista se queda vacía y el '
    + 'aviso no sale nunca. El profesional no se entera de que falta una línea.');
  assert.match(ejecutable, /ai-lineas-descartadas/,
    '🔴 el aviso de líneas descartadas ha desaparecido de la pantalla.');
  assert.match(ejecutable, /ai-linea-supuesta/,
    '🔴 la marca por línea ha desaparecido: vuelve a ser indistinguible lo suyo de lo inventado.');
  assert.equal((vista.match(/\[PENDIENTE microcopy oficial/g) || []).length, 2,
    '🔴 los dos textos tienen que ser MARCADORES hasta que el fundador los firme (regla 30). Y aquí '
    + 'no es cosmético: el texto es lo único que separa «revisa este número» de «esto está mal».');
});

test('SCRUM-507 · CONTROL POSITIVO del instrumento: la función hermana existe y se lee', () => {
  // Si el barrido no encontrara nada, «no hay más invenciones» significaría «no supe mirar».
  // `cantidadUtilizable` es la referencia comprobable de que sí se está leyendo el fuente.
  assert.match(leer(CRITERIO), /export function cantidadUtilizable/,
    '🔴 el instrumento no encuentra la función hermana: el censo de «dónde inventa la IA» no vale.');
});
