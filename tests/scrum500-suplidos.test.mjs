// SCRUM-500 (A2-c) · LOS SUPLIDOS: FUERA DE BASE IMPONIBLE, SIN IVA, DENTRO DEL TOTAL.
//
// Sin gate: funciones puras + AST. Ni BD, ni red, ni navegador.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ ES UN SUPLIDO
//
// Lo que el profesional paga POR CUENTA del cliente y le repercute tal cual: sin IVA y sin
// margen — una tasa municipal, el visado de un colegio, una licencia de obra. Poner ahí un
// material propio es un ERROR FISCAL: el material se compra para uno y se revende con su IVA y
// su margen; el suplido es dinero ajeno que solo pasa por la cuenta del profesional.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 POR QUÉ ESTE TICKET EXISTE SEPARADO DE SCRUM-293
//
// Por el CRUCE con la retención. La retención se practica sobre la base imponible; si el suplido
// se coló en la base, el error se cobra DOS veces —una en la cuota de IVA y otra en la retención—
// y ninguna de las dos chirría al mirar la factura. §1 escribe esa aritmética A MANO: un test que
// recalcula con las mismas funciones que está probando no prueba nada.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import {
  MARCA_SUPLIDO,
  leerMarcaSuplido,
  importeSuplido,
  totalSuplidos,
  partirPorSuplido,
  desgloseConSuplidos,
} from '../dist/modules/invoicing/domain/suplidos.js';
import { calcVatBreakdown } from '../dist/modules/invoicing/domain/vat.service.js';
import { grossOfLines } from '../dist/modules/invoicing/domain/invoiceLines.service.js';
import { bloqueRetencion, calcularRetencion } from '../dist/modules/invoicing/domain/retencionIrpf.js';
import { CreateQuoteSchema } from '../dist/core/validation/schemas.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

// `quoteSuplido.js` es un script clásico puro (ni DOM ni red): se evalúa y publica sus funciones
// en el objeto global que reciba. Misma técnica que SCRUM-229 con `quoteMargen.js` — así se
// prueba el COMPORTAMIENTO del front, no la forma de su fuente.
const front = {};
new Function('window', leer('public/dashboard/js/quoteSuplido.js'))(front);

const eur = (n) => n.toFixed(2).replace('.', ',') + ' €';

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO — si lo importado no está, todo lo de abajo pasaría en vacío.
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-500 · suelo: las piezas existen y se pueden ejecutar', () => {
  for (const [nombre, fn] of [
    ['desgloseConSuplidos', desgloseConSuplidos], ['totalSuplidos', totalSuplidos],
    ['leerMarcaSuplido', leerMarcaSuplido], ['bloqueRetencion', bloqueRetencion],
    ['front.lineaParaPayload', front.lineaParaPayload], ['front.esSuplido', front.esSuplido],
  ]) {
    assert.equal(typeof fn, 'function', `🔴 no se pudo cargar \`${nombre}\`: los asserts de abajo `
      + 'estarían pasando sobre nada.');
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 1 · 🔴 EL CASO CRUZADO: RETENCIÓN + SUPLIDO EN LA MISMA FACTURA
//       La aritmética, ESCRITA A MANO. Es donde se equivoca todo el mundo.
// ═════════════════════════════════════════════════════════════════════════════════════════

/** La factura del caso. Tiene número para que los fallos puedan NOMBRARLA. */
const FACTURA = 'F-2026-0041';
const LINEAS_CRUZADAS = [
  { concept: 'Mano de obra', qty: 10, price: 80, tax: 0.21 },
  { concept: 'Tasa municipal de licencia', qty: 1, price: 50, tax: 0, [MARCA_SUPLIDO]: true },
];

// ─── LOS NÚMEROS, A MANO Y UNO A UNO ────────────────────────────────────────────────────
//
//   base imponible      800,00   = 10 × 80,00        ← la tasa NO entra (regla ①)
//   cuota IVA 21 %      168,00   = 800,00 × 0,21     ← la tasa NO lleva IVA (regla ②)
//   suplidos             50,00   =  1 × 50,00
//   ─────────────────────────────────────────────────────────────────────────────────────
//   TOTAL FACTURA     1.018,00   = 800,00 + 168,00 + 50,00   ← el cliente SÍ lo paga (regla ③)
//   retención 15 %      120,00   = 800,00 × 0,15     ← sobre la base SIN suplidos
//   líquido a percibir  898,00   = 1.018,00 − 120,00
//
// NINGUNO de estos seis números sale de llamar a la función que se está probando.
const BASE = 800.00;
const CUOTA = 168.00;
const SUPLIDOS = 50.00;
const TOTAL = 1018.00;
const RETENCION = 120.00;
const LIQUIDO = 898.00;

// Y los TRES errores clásicos, cada uno con lo que cuesta. Se usan como contraste: si el
// resultado bueno coincide con uno de éstos, es que se cometió.
const BASE_MAL = 850.00;      // suplido dentro de la base
const CUOTA_MAL = 178.50;     // 850,00 × 0,21 → +10,50 € de IVA que nadie debía
const RETENCION_MAL_BASE = 127.50;  // 850,00 × 0,15 → +7,50 €
const RETENCION_MAL_TOTAL = 152.70; // 1.018,00 × 0,15 → +32,70 €

test('SCRUM-500 · 🔴 CASO CRUZADO · retención + suplido: los seis números, a mano', () => {
  const d = desgloseConSuplidos(LINEAS_CRUZADAS);
  assert.equal(d.ok, true, `🔴 no se pudo desglosar la factura ${FACTURA}: ${d.motivo}`);

  // ① FUERA DE LA BASE IMPONIBLE
  assert.equal(d.base, BASE,
    `🔴 SE HA COLADO UN SUPLIDO EN LA BASE IMPONIBLE DE ${FACTURA}.\n\n`
    + `  «${LINEAS_CRUZADAS[1].concept}» son ${eur(SUPLIDOS)} pagados POR CUENTA del cliente.\n`
    + `  Base esperada: ${eur(BASE)} (solo la mano de obra). Base obtenida: ${eur(d.base)}.\n`
    + `  Diferencia: ${eur(d.base - BASE)} — exactamente el suplido que no debía estar ahí.\n`
    + `  Un suplido no es contraprestación del servicio: es un reembolso. Si entra en la base,\n`
    + `  la base infla la cuota Y la retención, y ninguna de las dos cosas chirría al mirarla.`);
  assert.notEqual(d.base, BASE_MAL,
    `🔴 la base de ${FACTURA} es ${eur(BASE_MAL)}: es la base CON el suplido dentro.`);

  // ② SIN IVA
  assert.equal(d.cuota, CUOTA,
    `🔴 LA CUOTA DE IVA DE ${FACTURA} NO ES LA DE SU BASE.\n\n`
    + `  Esperada ${eur(CUOTA)} (= ${eur(BASE)} × 21 %). Obtenida ${eur(d.cuota)}.\n`
    + `  Si son ${eur(CUOTA_MAL)}, se está cobrando el 21 % sobre los ${eur(SUPLIDOS)} de la tasa:\n`
    + `  ${eur(CUOTA_MAL - CUOTA)} de IVA sobre un importe que YA ERA un impuesto.`);
  assert.equal(d.suplidos, SUPLIDOS, `🔴 el total de suplidos de ${FACTURA} no es ${eur(SUPLIDOS)}`);

  // ③ DENTRO DEL TOTAL — el error simétrico, y el que deja al profesional sin cobrar
  assert.equal(d.total, TOTAL,
    `🔴 EL TOTAL DE ${FACTURA} NO INCLUYE EL SUPLIDO.\n\n`
    + `  Esperado ${eur(TOTAL)} = ${eur(BASE)} + ${eur(CUOTA)} + ${eur(SUPLIDOS)}. `
    + `Obtenido ${eur(d.total)}.\n`
    + `  Sacar el suplido de la base NO es sacarlo de la factura: el cliente lo paga. Una factura\n`
    + `  que se lo deja fuera pide ${eur(SUPLIDOS)} menos de los que el profesional ha adelantado.`);

  // ─── Y LA RETENCIÓN, SOBRE LA BASE DE ARRIBA ───────────────────────────────────────────
  const bloque = bloqueRetencion({ baseImponible: d.base, total: d.total, tipo: 15 });
  assert.equal(bloque.retencion, RETENCION,
    `🔴 LA RETENCIÓN DE ${FACTURA} NO ESTÁ CALCULADA SOBRE LA BASE SIN SUPLIDOS.\n\n`
    + `  Esperada ${eur(RETENCION)} (= ${eur(BASE)} × 15 %). Obtenida ${eur(bloque.retencion)}.\n`
    + `    · ${eur(RETENCION_MAL_BASE)} = base CON el suplido (${eur(BASE_MAL)} × 15 %) → `
    + `${eur(RETENCION_MAL_BASE - RETENCION)} de más\n`
    + `    · ${eur(RETENCION_MAL_TOTAL)} = sobre el TOTAL (${eur(TOTAL)} × 15 %) → `
    + `${eur(RETENCION_MAL_TOTAL - RETENCION)} de más`);
  assert.equal(bloque.liquido, LIQUIDO,
    `🔴 el líquido a percibir de ${FACTURA} no es ${eur(LIQUIDO)} (= ${eur(TOTAL)} − ${eur(RETENCION)})`);

  // El cruce, dicho de la otra forma: los dos errores que comparten causa NO pueden coincidir
  // con el resultado bueno. Si alguno lo hiciera, el vector de arriba no distinguiría nada.
  assert.notEqual(RETENCION, RETENCION_MAL_BASE);
  assert.notEqual(CUOTA, CUOTA_MAL);
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LOS DOS ERRORES NO CUESTAN LO MISMO, Y MEDIRLO CAMBIA LO QUE HAY QUE ENTREGAR ANTES.
//
// El comentario que escribí primero decía que el suplido en la base cuesta 10,50 € de IVA MÁS
// 7,50 € de retención, siempre. **Medido, es falso.** Depende de a qué tipo esté la línea:
//
//   ① la tasa escrita HOY como una línea normal al 21 %  → +10,50 € de IVA  y  +7,50 € de retención
//   ② la tasa al 0 % (lo que produce la casilla desde hoy) → 0 € de IVA  y  +7,50 € de retención
//
// De ahí sale el orden del ticket, y no al revés: la casilla se entrega YA porque ① es dinero
// cobrado de más y se corta con `tax: 0`, sin tocar nada sellado. Y el cable sigue haciendo falta
// porque ② no se cura con la casilla: la base sigue siendo 850,00 € y la retención se practica
// sobre ella. **El 0 % quita el IVA, pero no saca el importe de la base.**
// ─────────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-500 · 🔴 ① la tasa al 21 %: se cobra IVA sobre un impuesto (lo que corta la casilla)', () => {
  // La misma factura tal y como se escribe HOY sin la casilla: la tasa es una línea más, y se le
  // pone el IVA general porque el editor lo siembra solo.
  const comoSeHaceHoy = [
    { concept: 'Mano de obra', qty: 10, price: 80, tax: 0.21 },
    { concept: 'Tasa municipal de licencia', qty: 1, price: 50, tax: 0.21 },
  ];
  const bd = calcVatBreakdown(comoSeHaceHoy);
  assert.equal(bd.base, BASE_MAL, `🔴 el contraste no contrasta: la base tenía que ser ${eur(BASE_MAL)}`);
  assert.equal(bd.cuota, CUOTA_MAL,
    `🔴 esperaba la cuota MALA ${eur(CUOTA_MAL)} y sale ${eur(bd.cuota)}`);
  assert.equal(bd.cuota - CUOTA, 10.50,
    `🔴 EL IVA DE MÁS DE ${FACTURA} YA NO SON 10,50 €, SINO ${eur(bd.cuota - CUOTA)}. Son los `
    + `${eur(SUPLIDOS)} de la tasa al 21 %: impuesto sobre un importe que YA era un impuesto.`);
  assert.equal(calcularRetencion(bd.base, 15) - RETENCION, 7.50,
    '🔴 y la retención sobre esa misma base inflada ya no son 7,50 € de más.');
});

test('SCRUM-500 · 🔴 ② con el IVA ya a 0, el IVA se salva pero la RETENCIÓN sigue mal', () => {
  // Esto es lo que produce la casilla HOY: la tasa marcada, al 0 %, y el resto sin cablear.
  const bd = calcVatBreakdown(LINEAS_CRUZADAS);
  assert.equal(bd.cuota, CUOTA,
    `🔴 con la tasa al 0 % la cuota tiene que ser la buena, ${eur(CUOTA)}: la casilla ya corta `
    + 'el IVA sobre el suplido sin tocar nada sellado.');
  assert.equal(bd.cuota - CUOTA, 0, '🔴 con la línea al 0 % no se pierde ni un céntimo de IVA');

  // 🔴 PERO la base NO se ha limpiado — y ahí es donde sigue viva la mitad cara.
  assert.equal(bd.base, BASE_MAL,
    `🔴 la base de \`calcVatBreakdown\` ya no es ${eur(BASE_MAL)}: sería que ha aprendido a `
    + 'saltarse líneas, y eso es el camino de emisión (regla 38), que este ticket NO toca.');
  assert.equal(calcularRetencion(bd.base, 15) - RETENCION, 7.50,
    `🔴 LA RETENCIÓN SOBRE LA BASE SIN LIMPIAR DE ${FACTURA} YA NO SON 7,50 € DE MÁS.\n\n`
    + '  Es el motivo de que el cable siga haciendo falta: poner el IVA a 0 quita el impuesto,\n'
    + `  pero NO saca los ${eur(SUPLIDOS)} de la base. Quien calcule la retención tiene que\n`
    + '  tomarla de `desgloseConSuplidos().base`, nunca de `calcVatBreakdown().base`.');

  // Y la prueba de que la pieza entregada aquí sí lo resuelve, sobre esas mismas líneas.
  const d = desgloseConSuplidos(LINEAS_CRUZADAS);
  assert.equal(calcularRetencion(d.base, 15), RETENCION,
    '🔴 con la base de `desgloseConSuplidos` la retención tiene que ser la buena, 120,00 €.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 2 · CONTROL NEGATIVO · UNA FACTURA SIN SUPLIDOS SALE EXACTAMENTE COMO HOY
// ═════════════════════════════════════════════════════════════════════════════════════════

// El MISMO vector congelado de `scrum293-retencion-control-negativo.test.mjs`, que es el que
// vigila el desglose que `registro.builder.ts` manda literal al XML. Si esto se mueve, se movió
// lo sellado — y se movió por culpa de este ticket, que no toca ese camino.
const LINEAS_NORMALES = [
  { qty: 3, price: 45.5, tax: 0.21 },
  { qty: 1, price: 120, tax: 0.21 },
  { qty: 2.5, price: 18.3, tax: 0.10 },
];
const BASE_CONGELADA = 302.25;   // 136,50 + 120,00 + 45,75
const CUOTA_CONGELADA = 58.44;   // 53,86 (21 % s/256,50) + 4,58 (10 % s/45,75)
const BRUTO_CONGELADO = 360.69;  // lo que acaba en `Invoice.total`

test('SCRUM-500 · 🔴 CONTROL NEGATIVO: sin suplidos, el desglose es EL MISMO, hasta el céntimo', () => {
  const d = desgloseConSuplidos(LINEAS_NORMALES);
  assert.equal(d.ok, true);

  assert.equal(d.base, BASE_CONGELADA,
    `🔴 SE HA MOVIDO LA BASE DE UNA FACTURA SIN SUPLIDOS: ${eur(d.base)} en vez de `
    + `${eur(BASE_CONGELADA)}. Esa base es la que va literal al XML sellado.`);
  assert.equal(d.cuota, CUOTA_CONGELADA, '🔴 se ha movido la cuota de una factura sin suplidos');
  assert.equal(d.suplidos, 0, '🔴 una factura sin líneas marcadas tiene 0,00 € de suplidos');
  assert.equal(d.total, BRUTO_CONGELADO,
    `🔴 el total de una factura sin suplidos ya no es el de \`grossOfLines\`: ${eur(d.total)} `
    + `frente a ${eur(BRUTO_CONGELADO)}.`);

  // Y la comparación FUERTE: el desglose entero, campo a campo, contra el de siempre.
  const hoy = calcVatBreakdown(LINEAS_NORMALES);
  assert.deepEqual(
    { base: d.base, cuota: d.cuota, entries: d.entries },
    { base: hoy.base, cuota: hoy.cuota, entries: hoy.entries },
    '🔴 sin suplidos, `desgloseConSuplidos` tiene que devolver LO MISMO que `calcVatBreakdown`. '
    + 'No «parecido»: lo mismo — es la misma llamada sobre el mismo array.');
  assert.equal(d.total, grossOfLines(LINEAS_NORMALES),
    '🔴 sin suplidos el total tiene que ser exactamente `grossOfLines`, que es lo que se sella.');
});

test('SCRUM-500 · una factura sin suplidos declara 0,00 €, y eso NO es lo mismo que «no consta»', () => {
  const t = totalSuplidos(LINEAS_NORMALES);
  assert.equal(t.ok, true);
  assert.equal(t.total, 0);
  assert.equal(t.lineas, 0,
    '🔴 se han contado líneas de suplido donde no hay ninguna marcada.');
  // El matiz que justifica que la columna sea nullable y SIN default: esto es un 0,00 DECLARADO
  // (se miraron las líneas y no había), no un NULL. La columna guarda uno u otro, nunca los dos
  // colapsados — que es el defecto que la retención necesitó dos columnas para evitar.
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 3 · 🔴 EL SUELO · UNA MARCA ILEGIBLE NO SE DEGRADA A «NO ES SUPLIDO»
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-500 · 🔴 SUELO: una marca ilegible NO pasa por «no es suplido»', () => {
  // «No es suplido» es el valor de la inmensa mayoría de las líneas: es el PEOR sitio para
  // degradar, porque un fallo de lectura produce el resultado que se ve normal y nadie lo nota.
  for (const basura of ['sí', 'true', 'false', 1, 0, null, {}, []]) {
    const l = { qty: 1, price: 50, tax: 0, [MARCA_SUPLIDO]: basura };
    const lectura = leerMarcaSuplido(l);
    assert.equal(lectura.ok, false,
      `🔴 la marca ${JSON.stringify(basura)} se ha interpretado en vez de declararse ilegible. `
      + 'Alguien escribió algo ahí; si no se entiende, no se adivina.');

    // Y lo que importa: la ilegibilidad LLEGA ARRIBA. No se queda en la función de leer.
    const t = totalSuplidos([l]);
    assert.equal(t.ok, false,
      `🔴 con la marca ${JSON.stringify(basura)}, \`totalSuplidos\` ha devuelto un número. `
      + 'Ese número diría «no hay suplidos» sin que nadie lo haya comprobado, y acabaría escrito '
      + 'en la columna como un 0,00 declarado.');
    const d = desgloseConSuplidos([l]);
    assert.equal(d.ok, false,
      `🔴 con la marca ${JSON.stringify(basura)}, el desglose ha salido igual: la línea se habría `
      + 'metido en la base imponible con su IVA, que es exactamente el error del ticket.');
    assert.match(d.motivo, /línea 1/,
      '🔴 el motivo no dice QUÉ línea es. Sin eso, un presupuesto de 12 líneas no se puede arreglar.');
  }
});

test('SCRUM-500 · la marca AUSENTE sí es un «no» legítimo, y la explícita se respeta', () => {
  // La ausencia es lo que tienen todas las líneas de siempre: si eso fallara, no se podría
  // facturar nada. Es la frontera exacta entre «no consta» y «no se entiende».
  assert.deepEqual(leerMarcaSuplido({ qty: 1, price: 10 }), { ok: true, suplido: false });
  assert.deepEqual(leerMarcaSuplido({ [MARCA_SUPLIDO]: false }), { ok: true, suplido: false });
  assert.deepEqual(leerMarcaSuplido({ [MARCA_SUPLIDO]: true }), { ok: true, suplido: true });
  assert.equal(leerMarcaSuplido(null).ok, false, '🔴 una línea nula no es una línea normal');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 4 · LA COLUMNA · UNA SOLA FUENTE PARA SU VALOR
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-500 · el valor de la columna sale de las líneas y suma varios suplidos', () => {
  const lineas = [
    { concept: 'Mano de obra', qty: 10, price: 80, tax: 0.21 },
    { concept: 'Tasa municipal', qty: 1, price: 50, tax: 0, [MARCA_SUPLIDO]: true },
    { concept: 'Visado del colegio', qty: 2, price: 32.5, tax: 0, [MARCA_SUPLIDO]: true },
  ];
  // A mano: 50,00 + (2 × 32,50 = 65,00) = 115,00
  const t = totalSuplidos(lineas);
  assert.equal(t.ok, true);
  assert.equal(t.total, 115.00,
    `🔴 el total de suplidos es ${eur(t.total)} y a mano son ${eur(115)} `
    + '(50,00 de la tasa + 65,00 del visado).');
  assert.equal(t.lineas, 2,
    '🔴 pueden ser VARIOS suplidos en la misma factura: por eso el concepto vive en su línea y '
    + 'la columna solo lleva el total.');

  // Un suplido NO lleva margen: su importe es cantidad × precio y nada más.
  assert.equal(importeSuplido(lineas[2]), 65.00);

  // Y el desglose los saca a los dos de la base: 800,00 · 168,00 · 115,00 · 1.083,00
  const d = desgloseConSuplidos(lineas);
  assert.equal(d.base, 800.00);
  assert.equal(d.cuota, 168.00);
  assert.equal(d.total, 1083.00, `🔴 800,00 + 168,00 + 115,00 = 1.083,00 y salen ${eur(d.total)}`);

  const p = partirPorSuplido(lineas);
  assert.equal(p.sujetas.length, 1);
  assert.equal(p.suplidos.length, 2);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 5 · LA CASILLA · EL FRONT NO PUEDE MANDAR UN SUPLIDO CON IVA
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-500 · 🔴 marcar suplido FUERZA el IVA a 0 en el payload, venga de donde venga', () => {
  // El caso que la interfaz sola no cubre: una línea marcada que NUNCA pasó por el `change` de la
  // casilla — un borrador restaurado, una plantilla, la IA. El input deshabilitado no la protege.
  const salida = front.lineaParaPayload({ concept: 'Tasa', qty: 1, price: 50, tax: 0.21, suplido: true });
  assert.equal(salida.tax, 0,
    `🔴 una línea marcada como suplido ha salido hacia el servidor con IVA ${salida.tax}. `
    + 'Deshabilitar el input no basta: hay tres caminos que rellenan una línea sin tocarlo.');
  assert.equal(salida.suplido, true, '🔴 se perdió la marca por el camino');
  assert.equal(salida.price, 50, '🔴 el precio del suplido no se toca: se repercute TAL CUAL');

  // Control negativo: una línea normal sale idéntica, sin marca añadida.
  const normal = front.lineaParaPayload({ concept: 'Mano de obra', qty: 2, price: 80, tax: 0.21, suplido: false });
  assert.deepEqual(normal, { concept: 'Mano de obra', qty: 2, price: 80, tax: 0.21 },
    '🔴 una línea NO marcada tiene que salir exactamente como entró — sin `suplido: false` ni '
    + 'ningún otro añadido. La ausencia ya significa «no es un suplido».');

  // Y no muta lo que recibe: la vista previa y el borrador siguen leyendo el original.
  const origen = { concept: 'Tasa', qty: 1, price: 50, tax: 0.21, suplido: true };
  front.lineaParaPayload(origen);
  assert.equal(origen.tax, 0.21, '🔴 `lineaParaPayload` ha mutado la línea que le pasaron');
});

test('SCRUM-500 · el disparador de la hoja DICE que la línea es un suplido', () => {
  // Con «IVA 0 %» a secas, un suplido y una línea exenta se leen igual en la lista — y no son lo
  // mismo. Esto es lo que `scrum139-hoja-ajustes.test.mjs` (F4) exigía por texto y ahora se
  // exige por comportamiento: los dos casos de siempre siguen intactos y el nuevo se distingue.
  assert.equal(front.resumenAjustes(false, 21, 0), 'IVA 21 %');
  assert.equal(front.resumenAjustes(false, 10, 15), 'IVA 10 % · Margen 15 %');
  assert.match(front.resumenAjustes(true, 0, 0), /Suplido/,
    '🔴 una línea marcada no se distingue en el disparador: el profesional tendría que abrir la '
    + 'hoja de cada línea para saber cuáles son suplidos.');
  assert.notEqual(front.resumenAjustes(true, 0, 0), front.resumenAjustes(false, 0, 0),
    '🔴 un suplido y una línea al 0 % dicen lo mismo. Una está exenta y la otra ni siquiera es '
    + 'base imponible.');
});

test('SCRUM-500 · 🔴 LA PUERTA · el servidor rechaza un suplido con IVA, y la marca NO se borra', () => {
  const base = {
    merchant_id: 1, customer_id: 1, currency: 'EUR',
    lines: [{ concept: 'Tasa municipal', qty: 1, price: 50, tax: 0, suplido: true }],
  };

  // ① La marca SOBREVIVE al validador. Sin declararla en el schema, `z.object` la borra en
  // silencio y la casilla del editor no llegaría nunca a `Quote.lines`: la pantalla diría
  // «suplido» y la base de datos guardaría una línea normal. Nadie se enteraría.
  const ok = CreateQuoteSchema.parse(base);
  assert.equal(ok.lines[0].suplido, true,
    '🔴 el validador ha BORRADO la marca de suplido. zod quita las claves que no conoce, así que '
    + 'declararla no es cosmética: es lo único que hace que la casilla sirva para algo.');

  // ② Y un suplido con IVA se rechaza EN LA PUERTA. El front ya fuerza `tax: 0`, pero el front no
  // es el único que llama a esta ruta.
  const conIva = { ...base, lines: [{ ...base.lines[0], tax: 0.21 }] };
  const r = CreateQuoteSchema.safeParse(conIva);
  assert.equal(r.success, false,
    '🔴 SE HA ACEPTADO UN SUPLIDO CON IVA DEL 21 %. Repercutir IVA sobre un suplido es cobrar '
    + 'impuesto sobre impuesto, y con el validador abierto está a un `curl` de distancia.');
  const dice = JSON.stringify(r.error.issues);
  assert.match(dice, /Tasa municipal/,
    '🔴 el error no NOMBRA la línea. En un presupuesto de 12, sin el concepto no se sabe cuál arreglar.');

  // ③ Control negativo: una línea normal al 21 % sigue pasando exactamente igual que siempre.
  const normal = { ...base, lines: [{ concept: 'Mano de obra', qty: 2, price: 80, tax: 0.21 }] };
  assert.equal(CreateQuoteSchema.safeParse(normal).success, true,
    '🔴 se ha roto el presupuesto de siempre: una línea sin marca al 21 % tiene que pasar.');
});

test('SCRUM-500 · 🔴 la casilla y el cálculo usan LA MISMA clave', () => {
  // Dos literales `'suplido'` en dos ficheros son dos cosas que pueden separarse el día que una
  // se renombre — y entonces la casilla marca algo que el dominio no lee. Silencioso: la factura
  // sale, sin suplidos, y con IVA sobre la tasa.
  assert.equal(front.MARCA_SUPLIDO, MARCA_SUPLIDO,
    `🔴 el front marca con «${front.MARCA_SUPLIDO}» y el dominio lee «${MARCA_SUPLIDO}».`);
  // Suelo: si las dos fueran `undefined`, la igualdad de arriba pasaría sin significar nada.
  assert.equal(typeof MARCA_SUPLIDO, 'string');
  assert.ok(MARCA_SUPLIDO.length > 0);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 6 · REGLA 30 · LA MICROCOPY VA CON MARCADOR
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-500 · los textos nuevos llevan `[PENDIENTE microcopy oficial]` delante', () => {
  const MARCADOR = '[PENDIENTE microcopy oficial]';
  for (const [nombre, texto] of [['ROTULO_SUPLIDO', front.ROTULO_SUPLIDO], ['AVISO_SUPLIDO', front.AVISO_SUPLIDO]]) {
    assert.ok(texto && texto.startsWith(MARCADOR),
      `🔴 \`${nombre}\` no empieza por el marcador. Regla 30: la microcopy la aprueba el fundador, `
      + 'y un rótulo provisional que se lee bien se queda para siempre.');
    assert.ok(texto.length > MARCADOR.length + 20,
      `🔴 \`${nombre}\` es solo el marcador. El aviso tiene que poder LEERSE para probarlo: es el `
      + 'texto que evita el error fiscal en el momento exacto de cometerlo.');
  }
  // El aviso dice la frontera que importa, no una definición de diccionario.
  assert.match(front.AVISO_SUPLIDO, /material/i,
    '🔴 el aviso no menciona el material. Confundir un material propio con un suplido es EL error '
    + 'de este campo, y el aviso existe para nombrarlo.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 7 · REGLA 38 · ESTE TICKET NO TOCA EL CAMINO SELLADO
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-500 · 🔴 `suplidos.ts` LLAMA a `calcVatBreakdown`, no la reimplementa', () => {
  // La tentación de este ticket es copiar el bucle del IVA para «filtrar de paso». Eso serían dos
  // desgloses distintos calculando el mismo dinero — el defecto de SCRUM-504, cinco copias que
  // divergieron. Aquí se exige por AST que la llamada exista.
  const src = leer('src/modules/invoicing/domain/suplidos.ts');
  const sf = ts.createSourceFile('x.ts', src, ts.ScriptTarget.Latest, true);
  let llamadas = 0;
  let bucles = 0;
  const visitar = (n) => {
    if (ts.isCallExpression(n) && n.expression.getText(sf) === 'calcVatBreakdown') llamadas += 1;
    // Un `map`/`reduce` sobre `entries` o cualquier acumulación de `tax` sería reimplementar.
    if (ts.isPropertyAccessExpression(n) && n.name.getText(sf) === 'tax') bucles += 1;
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  assert.equal(llamadas, 1,
    `🔴 \`suplidos.ts\` llama ${llamadas} veces a \`calcVatBreakdown\` y tiene que llamarla UNA. `
    + 'Cero = se ha reimplementado el desglose; más de una = hay dos recorridos que pueden diverger.');
  assert.equal(bucles, 0,
    '🔴 `suplidos.ts` está leyendo `.tax` de las líneas: eso es calcular IVA por su cuenta. El IVA '
    + 'lo calcula `calcVatBreakdown` sobre las líneas ya filtradas, y solo ella.');
});

test('SCRUM-500 · 🔴 `vat.service.ts` no ha aprendido lo que es un suplido', () => {
  // Regla 38: el camino del que el sellado saca su base NO se toca en este ticket. Si esta palabra
  // apareciera ahí, el filtro se habría metido dentro de la función que consumen 16 ficheros.
  const sinComentarios = leer('src/modules/invoicing/domain/vat.service.ts')
    .replace(/\/\*[\s\S]*?\*\//g, '')   // el guard se cazaría a sí mismo en el comentario que lo
    .replace(/(^|[^:])\/\/.*$/gm, '$1'); // explica: se lee el CÓDIGO, no lo que se dice de él
  assert.ok(!/suplido/i.test(sinComentarios),
    '🔴 `vat.service.ts` menciona los suplidos en su CÓDIGO. Esa función alimenta la base que '
    + '`registro.builder.ts` manda literal al XML sellado: filtrar ahí es camino de emisión '
    + '(regla 38) y necesita GO del fundador con el diff delante.');
  // Suelo: si el despojado se quedara vacío, el `!test` de arriba pasaría por no haber texto.
  assert.ok(/calcVatBreakdown/.test(sinComentarios),
    '🔴 al quitar los comentarios se ha quedado sin código: el guard estaría mirando la nada.');
});
