// SCRUM-655 (T6, sprint Tecnosel) · APARTADOS, NUMERACIÓN DERIVADA Y DESCRIPCIÓN LARGA.
//
// Sin gate: funciones puras + un DOM de juguete. Ni BD, ni red, ni navegador.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ ES UN APARTADO, Y POR QUÉ ES UNA LÍNEA
//
// Un presupuesto de obra se lee por bloques: «1. DEMOLICIONES», y debajo sus partidas numeradas
// 1.01, 1.02… El apartado es UNA LÍNEA MARCADA dentro del mismo `Quote.lines`, no un array
// aparte: `lines` es plano y TODOS sus consumidores lo recorren, así que un array de apartados
// cambiaría la forma para todos y rompería el caso simple. Una cabecera es aditiva.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL CANAL, QUE ES LA TRAMPA DEL TICKET
//
// «Multilínea» no describe el texto: describe el CANAL. Medidos los tres antes de construir:
//
//   PDF ........ YA RESUELTO (`partirConceptoYDescripcion`, SCRUM-603). No se toca.
//   Pantalla ... el hueco real: la vista metía el concepto como HTML, y el HTML COLAPSA los
//                saltos. Ocho renglones de texto técnico salían en una línea corrida.
//   WhatsApp ... NO ES UN CANAL para este dato: `concept` no aparece ni una vez en
//                `whatsapp.ts` y el presupuesto viaja como ENLACE. No se construye.
//
// Y la pantalla NO se arregla con `white-space: pre-line`: eso protegería un salto que el HTML ya
// no tiene, y desde Node no hay forma de comprobar que el estilo esté puesto. Se arregla con
// ESTRUCTURA — un elemento por renglón—, que es lo que estos tests miden.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// Del dominio solo entra `lineasQueSuman`: la marca y `esApartado` son internos suyos (SCRUM-411).
// Que front y dominio usen la MISMA clave se prueba por COMPORTAMIENTO, no comparando cadenas.
import { lineasQueSuman } from '../dist/modules/quotes/domain/apartados.js';
import { calcTotal } from '../dist/core/utils/utils.js';
import { numeroConRevision, vigenteDe, esVigente } from '../dist/modules/quotes/domain/revision.js';
import { CreateQuoteSchema } from '../dist/core/validation/schemas.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// El módulo del front es un script clásico puro: se evalúa y publica sus funciones en el objeto
// que reciba. Misma técnica que SCRUM-229/500 — así se prueba COMPORTAMIENTO, no la forma del .js.
const front = {};
/** La clave la pone el FRONT; el dominio la guarda para sí. Las fixtures usan la del front. */
new Function('window', fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/quoteApartados.js'), 'utf8'))(front);
const MARCA_APARTADO = front.MARCA_APARTADO;

/**
 * DOM de juguete: lo justo que usa `celdaConcepto`. Se construye aquí, a la vista, para que el
 * test mida el ÁRBOL DE NODOS QUE SALE y no una cadena que alguien haya escrito a mano.
 */
function documentoDeJuguete() {
  const crear = (tag) => ({
    tag, className: '', textContent: '', hijos: [],
    appendChild(n) { this.hijos.push(n); return n; },
  });
  return { createElement: crear };
}
/** Todos los nodos del árbol, en orden. */
const todos = (n, out = []) => { out.push(n); n.hijos.forEach((h) => todos(h, out)); return out; };
/** Los renglones de descripción que han sobrevivido al render. */
const renglones = (celda) => todos(celda).filter((n) => n.className === 'quote-line-desc');

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 0 · SUELO — si las piezas no cargan, todo lo de abajo pasaría en vacío.
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-655 · suelo: las piezas existen y se ejecutan', () => {
  for (const [nombre, fn] of [
    ['lineasQueSuman', lineasQueSuman], ['calcTotal', calcTotal],
    ['front.numerarLineas', front.numerarLineas], ['front.celdaConcepto', front.celdaConcepto],
    ['vigenteDe', vigenteDe],
  ]) {
    assert.equal(typeof fn, 'function', `🔴 no se pudo cargar \`${nombre}\`: los asserts de abajo `
      + 'estarían pasando sobre nada.');
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 1 · 🔴 CONTROL POSITIVO, Y VA PRIMERO
//       Un presupuesto de UNA línea SIN apartados funciona EXACTAMENTE igual que hoy.
//       Añadir estructura y romper el caso simple es EL fallo típico de este ticket, y los
//       tests del caso nuevo darían verde igual.
// ═════════════════════════════════════════════════════════════════════════════════════════

const SIMPLE = [{ concept: 'Mano de obra', qty: 2, price: 100, tax: 0.21 }];

test('SCRUM-655 · 🔴 CONTROL POSITIVO ① el total de un presupuesto simple no se mueve', () => {
  // El número, a mano: 2 × 100 = 200, +21 % = 242,00. No sale de llamar a lo que se prueba.
  assert.equal(calcTotal(SIMPLE), 242,
    '🔴 SE HA MOVIDO EL TOTAL DE UN PRESUPUESTO SIN APARTADOS. 2 × 100,00 € al 21 % son 242,00 €. '
    + 'Este ticket añade estructura; si toca el importe de quien no la usa, está roto.');
});

test('SCRUM-655 · 🔴 CONTROL POSITIVO ② sin apartados NO se numera nada', () => {
  const n = front.numerarLineas(SIMPLE);
  assert.equal(n.length, 1);
  assert.equal(n[0].numero, null,
    `🔴 a una línea de un presupuesto sin apartados se le ha puesto el número «${n[0].numero}». `
    + 'La inmensa mayoría de los presupuestos no tiene apartados y tienen que salir como salían.');
  assert.equal(n[0].cabecera, false);
});

test('SCRUM-655 · 🔴 CONTROL POSITIVO ③ un concepto de una línea da UNA celda y sin descripción', () => {
  const celda = front.celdaConcepto(documentoDeJuguete(), 'Mano de obra');
  const titulos = todos(celda).filter((x) => x.className === 'quote-line-titulo');
  assert.equal(titulos.length, 1);
  assert.equal(titulos[0].textContent, 'Mano de obra');
  assert.equal(renglones(celda).length, 0,
    '🔴 un concepto sin saltos ha generado renglones de descripción: se estaría inventando texto '
    + 'en el documento que ve el cliente.');
});

test('SCRUM-655 · 🔴 CONTROL POSITIVO ④ la puerta sigue exigiendo cantidad y precio', () => {
  const base = { merchant_id: 1, customer_id: 1, currency: 'EUR' };
  assert.equal(CreateQuoteSchema.safeParse({ ...base, lines: SIMPLE }).success, true,
    '🔴 se ha roto el presupuesto de siempre: una línea normal completa tiene que pasar.');
  // Hacer `qty` opcional en el objeto NO puede relajar la puerta para las líneas normales.
  const sinQty = CreateQuoteSchema.safeParse({ ...base, lines: [{ concept: 'Mano de obra', price: 100, tax: 0.21 }] });
  assert.equal(sinQty.success, false,
    '🔴 UNA LÍNEA NORMAL SIN CANTIDAD HA PASADO EL VALIDADOR. Para que quepa una cabecera se hizo '
    + '`qty` opcional en el objeto; si el refine no la vuelve a exigir, la puerta del dinero queda '
    + 'más floja que antes de este ticket.');
  assert.match(JSON.stringify(sinQty.error.issues), /Mano de obra/,
    '🔴 el error no NOMBRA la línea: en un presupuesto de 30 no se sabría cuál arreglar.');
  // Y un `qty: 0` sigue rechazándose, como desde SCRUM-504.
  assert.equal(CreateQuoteSchema.safeParse({ ...base, lines: [{ concept: 'X', qty: 0, price: 100 }] }).success, false);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 2 · 🔴 LA NUMERACIÓN ES DERIVADA DE LA POSICIÓN
// ═════════════════════════════════════════════════════════════════════════════════════════

const CON_APARTADOS = [
  { concept: 'DEMOLICIONES', [MARCA_APARTADO]: true },
  { concept: 'Picado de alicatado', qty: 12, price: 18, tax: 0.21 },
  { concept: 'Retirada de escombro', qty: 1, price: 240, tax: 0.21 },
  { concept: 'INSTALACIÓN ELÉCTRICA', [MARCA_APARTADO]: true },
  { concept: 'Cuadro general', qty: 1, price: 480, tax: 0.21 },
];

test('SCRUM-655 · 🔴 los números salen de la POSICIÓN: 1.01, 1.02, 2.01', () => {
  const n = front.numerarLineas(CON_APARTADOS);
  assert.deepEqual(n.map((x) => x.numero), ['1', '1.01', '1.02', '2', '2.01'],
    '🔴 la numeración derivada no da la serie esperada. Es lo que el cliente cita al responder: '
    + '«quítame la 1.03» tiene que señalar a una línea y solo a una.');
});

test('SCRUM-655 · 🔴 mover una línea RECOLOCA los números solos', () => {
  // Se mueve «Retirada de escombro» al segundo apartado. Nadie teclea un número.
  const movido = [
    CON_APARTADOS[0], CON_APARTADOS[1], CON_APARTADOS[3], CON_APARTADOS[2], CON_APARTADOS[4],
  ];
  assert.deepEqual(front.numerarLineas(movido).map((x) => x.numero), ['1', '1.01', '2', '2.01', '2.02'],
    '🔴 al mover una línea los números NO se han recolocado. Si hay que reescribirlos a mano, dos '
    + 'líneas acabarán con el mismo y el presupuesto dejará de poder citarse.');
});

test('SCRUM-655 · 🔴 DOS LÍNEAS NO PUEDEN COMPARTIR NÚMERO, y se comprueba sobre una lista larga', () => {
  // 3 apartados × 15 líneas: si el mecanismo estuviera mal (un contador que no se reinicia, un
  // relleno de ceros que colisiona) saldría un duplicado aquí y no en el ejemplo de cinco.
  const largo = [];
  for (let a = 1; a <= 3; a++) {
    largo.push({ concept: `APARTADO ${a}`, [MARCA_APARTADO]: true });
    for (let i = 1; i <= 15; i++) largo.push({ concept: `Partida ${a}-${i}`, qty: 1, price: 10, tax: 0 });
  }
  const numeros = front.numerarLineas(largo).filter((x) => !x.cabecera).map((x) => x.numero);
  assert.equal(numeros.length, 45, '🔴 no se han numerado las 45 partidas');
  assert.equal(new Set(numeros).size, numeros.length,
    '🔴 HAY NÚMEROS REPETIDOS: ' + numeros.filter((x, i) => numeros.indexOf(x) !== i).join(', ')
    + '. Si dos líneas pueden acabar con el mismo, el mecanismo está mal y el cliente no sabe cuál '
    + 'está pidiendo quitar.');
  assert.equal(numeros[9], '1.10', '🔴 el paso de 1.09 a 1.10 no mantiene el formato N.NN');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 3 · 🔴 LAS CABECERAS NO SUMAN
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-655 · 🔴 una cabecera no mueve el total — y antes no era «no sumaba»: era NaN', () => {
  // A mano: 12 × 18 = 216 · 240 · 480 = 936 de base, +21 % = 1.132,56.
  const esperado = Math.round(936 * 1.21 * 100) / 100;
  const total = calcTotal(CON_APARTADOS);
  assert.equal(total, esperado,
    `🔴 EL TOTAL DE UN PRESUPUESTO CON APARTADOS ES ${total} Y DEBERÍA SER ${esperado}.\n`
    + '  Si sale NaN, la cabecera está entrando en la suma: no lleva cantidad ni precio y\n'
    + '  `undefined * undefined` contamina el total entero. Una cabecera no es que no sume:\n'
    + '  sin filtrarla, deja el presupuesto SIN total.');
  assert.ok(Number.isFinite(total), '🔴 el total no es un número finito');
});

test('SCRUM-655 · 🔴 EL ROJO DEL FUNDADOR: mete precio en una cabecera y el total NO se mueve', () => {
  const sinTrampa = calcTotal(CON_APARTADOS);
  const conTrampa = calcTotal(CON_APARTADOS.map((l, i) => (i === 0 ? { ...l, qty: 5, price: 999 } : l)));
  assert.equal(conTrampa, sinTrampa,
    `🔴 UNA CABECERA CON IMPORTE HA MOVIDO EL TOTAL: ${sinTrampa} → ${conTrampa}.\n`
    + '  Las cabeceras se filtran por su MARCA, no por «no tener precio». Filtrar por el precio\n'
    + '  dejaría que un título cobrara en cuanto alguien le metiera un número por descuido.');
  assert.equal(lineasQueSuman(CON_APARTADOS).length, 3, '🔴 no son 3 las líneas que suman');
});

test('SCRUM-655 · la puerta RECHAZA una cabecera con importes, nombrándola', () => {
  const r = CreateQuoteSchema.safeParse({
    merchant_id: 1, customer_id: 1, currency: 'EUR',
    lines: [{ concept: 'DEMOLICIONES', apartado: true, qty: 5, price: 999 }],
  });
  assert.equal(r.success, false,
    '🔴 se ha aceptado un apartado con cantidad y precio. El total ya lo ignora, pero aceptarlo '
    + 'deja creer a quien lo escribió que ese título cobra.');
  assert.match(JSON.stringify(r.error.issues), /DEMOLICIONES/, '🔴 el error no nombra el apartado');
  // Y la marca SOBREVIVE al validador: sin declararla, zod la borra y el apartado no llega nunca.
  const ok = CreateQuoteSchema.parse({
    merchant_id: 1, customer_id: 1, currency: 'EUR',
    lines: [{ concept: 'DEMOLICIONES', apartado: true }, { concept: 'Picado', qty: 1, price: 10 }],
  });
  assert.equal(ok.lines[0].apartado, true,
    '🔴 el validador ha BORRADO la marca de apartado. zod quita las claves que no conoce, así que '
    + 'declararla es lo único que hace que la pantalla y la base digan lo mismo.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 4 · 🔴 LA DESCRIPCIÓN LARGA, SOBRE EL RESULTADO RENDERIZADO
// ═════════════════════════════════════════════════════════════════════════════════════════

/** Una línea real de la empresa: ocho renglones de texto técnico dentro del concepto. */
const OCHO_RENGLONES = [
  'Cuadro general de mando y protección',
  'Suministro e instalación de cuadro general con envolvente de superficie',
  'Interruptor general automático de 40 A, curva C',
  'Interruptor diferencial de 40 A / 30 mA, clase A',
  'Seis circuitos independientes con su magnetotérmico',
  'Bornas de neutro y tierra independientes por circuito',
  'Rotulado de cada circuito en el frontal del cuadro',
  'Comprobación de continuidad y medida de aislamiento',
].join('\n');

test('SCRUM-655 · 🔴 los OCHO renglones sobreviven al render, uno por elemento', () => {
  const celda = front.celdaConcepto(documentoDeJuguete(), OCHO_RENGLONES);
  const desc = renglones(celda);
  assert.equal(desc.length, 7,
    '🔴 SE HA APLANADO LA DESCRIPCIÓN DE «Cuadro general de mando y protección».\n\n'
    + `  El concepto trae 8 renglones: 1 título + 7 de descripción. Han sobrevivido ${desc.length}.\n`
    + '  En el HTML un salto de línea NO es un salto: se colapsa a un espacio, y los ocho\n'
    + '  renglones de texto técnico salen en una línea corrida. Cada renglón tiene que ser su\n'
    + '  propio elemento — estructura, no `white-space`, que desde aquí no se puede comprobar.');
  // Y el texto de cada uno llega ENTERO, no recortado a la segunda línea.
  assert.equal(desc[0].textContent, 'Suministro e instalación de cuadro general con envolvente de superficie');
  assert.equal(desc[6].textContent, 'Comprobación de continuidad y medida de aislamiento',
    '🔴 se ha perdido el ÚLTIMO renglón: recortar la descripción es perder texto del documento.');
  const titulo = todos(celda).find((x) => x.className === 'quote-line-titulo');
  assert.equal(titulo.textContent, 'Cuadro general de mando y protección');
});

test('SCRUM-655 · el texto va como TEXTO, no como marcado', () => {
  // Se construye con `textContent`, así que un concepto con `<` no puede inyectar nada aunque
  // nadie se acuerde de escaparlo. Esto lo garantiza la forma de construir, no un escape.
  const celda = front.celdaConcepto(documentoDeJuguete(), 'Perfil <b>reforzado</b>\nAcero S275');
  const titulo = todos(celda).find((x) => x.className === 'quote-line-titulo');
  assert.equal(titulo.textContent, 'Perfil <b>reforzado</b>',
    '🔴 el concepto ha pasado por un intérprete de HTML en vez de ir como texto.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 5 · 🔴 REVISIONES · crear la .1 NO destruye la original
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-655 · 🔴 la revisión .1 CONVIVE con la original, y se ve cuál está vigente', () => {
  const original = { numero: 'P2004226', revision: 0 };
  const grupo = [original];

  // Se «crea» la revisión: se AÑADE. Nada se sustituye.
  const revisada = { numero: 'P2004226', revision: 1 };
  grupo.push(revisada);

  assert.equal(grupo.length, 2,
    '🔴 crear la revisión ha dejado UN documento. Entonces «revisar» es «sobrescribir con otro '
    + 'nombre», y el cliente que pregunta por lo que firmó no tiene dónde mirarlo.');
  assert.ok(grupo.includes(original), '🔴 la ORIGINAL ha desaparecido del grupo');

  assert.equal(numeroConRevision(original), 'P2004226',
    '🔴 la original no puede pintar un «.0»: diría que existe otra versión cuando no la hay.');
  assert.equal(numeroConRevision(revisada), 'P2004226.1');

  assert.equal(esVigente(revisada, grupo), true, '🔴 la vigente tiene que ser la revisión más alta');
  assert.equal(esVigente(original, grupo), false, '🔴 la original ha quedado marcada como vigente');
  assert.equal(vigenteDe(grupo), revisada);

  // Y una tercera revisión desplaza a la .1 sin borrar a nadie.
  const tercera = { numero: 'P2004226', revision: 2 };
  grupo.push(tercera);
  assert.equal(vigenteDe(grupo), tercera);
  assert.equal(grupo.length, 3, '🔴 al añadir la .2 ha desaparecido alguna anterior');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 6 · SUELO DE CEGUERA Y LA CLAVE COMPARTIDA
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-655 · 🔴 SUELO DE CEGUERA: cero apartados en un presupuesto que los tiene', () => {
  const cuantos = front.cuantosApartados(CON_APARTADOS);
  assert.ok(cuantos > 0,
    '🔴 CIEGO: el generador devuelve CERO apartados en un presupuesto que tiene DOS. Un cero aquí '
    + 'no significa «este presupuesto es simple»: significa que la marca no se está leyendo, y '
    + 'entonces todos los verdes de arriba estarían midiendo un presupuesto plano.');
  assert.equal(cuantos, 2, `🔴 se han contado ${cuantos} apartados y hay 2`);
  // Y el contraste: sobre uno simple tiene que dar cero de verdad.
  assert.equal(front.cuantosApartados(SIMPLE), 0);
});

test('SCRUM-655 · 🔴 el front y el dominio marcan con LA MISMA clave — probado por EFECTO', () => {
  // No se comparan dos constantes: se marca una línea CON LA CLAVE DEL FRONT y se comprueba que
  // el TOTAL DEL DOMINIO la salta. Si las claves se separasen, el dominio no reconocería la marca,
  // la cabecera entraría en la suma y el total volvería a ser NaN sin que nadie tocara nada.
  // Comparar las cadenas solo demostraría que dos literales son iguales; esto demuestra que la
  // marca FUNCIONA de un lado al otro.
  const lineas = [
    { concept: 'DEMOLICIONES', [front.MARCA_APARTADO]: true },
    { concept: 'Picado', qty: 2, price: 50, tax: 0 },
  ];
  assert.equal(calcTotal(lineas), 100,
    `🔴 EL DOMINIO NO RECONOCE LA MARCA QUE PONE EL FRONT («${front.MARCA_APARTADO}»).\n`
    + '  La cabecera ha entrado en la suma: 2 × 50,00 € son 100,00 € y sale otra cosa —NaN si la\n'
    + '  cabecera aporta `undefined`—. Front y dominio están marcando con claves distintas.');
  assert.equal(lineasQueSuman(lineas).length, 1,
    '🔴 la línea marcada por el front no la filtra el dominio: son claves distintas.');

  // Y el criterio también es el mismo: SOLO el booleano `true`.
  for (const basura of ['sí', 1, 'true', {}, null]) {
    const l = { concept: 'X', [front.MARCA_APARTADO]: basura, qty: 1, price: 10 };
    assert.equal(front.esApartado(l), false,
      `🔴 el front interpreta ${JSON.stringify(basura)} como apartado`);
    assert.equal(lineasQueSuman([l]).length, 1,
      `🔴 el dominio ha tratado ${JSON.stringify(basura)} como cabecera y la ha sacado de la suma: `
      + 'una línea con una marca ilegible NO puede dejar de cobrarse en silencio.');
  }
});
