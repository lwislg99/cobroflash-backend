// tests/scrum1787t-pdf-vence-fecha-larga.test.mjs — SCRUM-1787t
//
// QUÉ SE PIDE (decisión del fundador, SCRUM-1787 c.22390 punto 3: «unificar al formato largo en la
// página de pago y el PDF»; GO regla 40 para `generateInvoicePdf`: SCRUM-1787 c.22408): en el PDF de
// FACTURA, la línea `Vence el …` pasa a la fecha LARGA es-ES, con las MISMAS opciones que ya usa la
// página pública de pago (SCRUM-1787q, `payInvoice.routes.ts`) y en la zona del negocio. La `Fecha:`
// de expedición NO cambia (dd/mm/aaaa).
//
// CÓMO SE MIDE: sobre el TEXTO y las POSICIONES leídos del PDF fabricado (`lineasDePdf`), no sobre el
// fuente. En el PDF la `y` crece hacia ARRIBA y la `x` es donde EMPIEZA la línea.
//
// ① `dueDate` 2026-12-23 → `Vence el 23 de diciembre de 2026`, y la `Fecha:` sigue en dd/mm/aaaa
// ② el día es el de la ZONA del negocio (23:30Z del 23 ya es 24 en Madrid; sin zona, el 23)
// ③ el mes más largo (septiembre, día 30) cabe en UNA línea, alineada a la derecha y sin pisar la
//    columna del logo (x > M + 120, el ancho máximo del logo de la cabecera)
// ④ control: sin `dueDate`, no hay línea `Vence el`
// ⑤ la cadena es la de la página de pago: mismas opciones (`es-ES`, zona, mes largo, año), leídas del
//    fuente de J2; el día, por superficie (c.22436): el del PDF en ⑥
// ⑥ SCRUM-1787x (c.22431): un día de una cifra sale sin cero («Vence el 5 de diciembre de 2026»)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lineasDePdf } from './_texto-del-pdf.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El vencimiento vuelve al formato de la «Fecha:» (dd/mm/aaaa).
    fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts',
    de: 'doc.text(`Vence el ${fechaLargaDeVencimiento(params.dueDate)}`',
    a: 'doc.text(`Vence el ${dateStr(params.dueDate)}`',
    cae: 'SCRUM-1787t ① «Vence el» sale con la fecha larga y la «Fecha:» sigue en dd/mm/aaaa',
  },
  {
    // SCRUM-1787x: el día vuelve a llevar cero a la izquierda («05 de diciembre»).
    fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts',
    de: "zonaDelMerchant({ timezone: params.zona }), day: 'numeric', month: 'long'",
    a: "zonaDelMerchant({ timezone: params.zona }), day: '2-digit', month: 'long'",
    cae: 'SCRUM-1787x ⑥ un día de una cifra sale sin cero a la izquierda',
  },
];

const { generateInvoicePdf } = await import('../dist/modules/invoicing/infra/pdf/pdf.service.js');

const EMISOR = { name: 'Oficio Ficticio', legalName: 'Oficio Ficticio SL', taxId: 'B00000000', address: 'Calle Inventada 1, 28000 Ciudad Ficticia' };
const CLIENTE = { name: 'Cliente QA', email: 'cliente@ejemplo.invalid' };
const M = 50; // margen de `generateInvoicePdf`
const ANCHO_LOGO = 120; // `fit: [120, 44]` del logo de la cabecera

let serie = 0;
async function lineasDeFactura(extra = {}) {
  serie += 1;
  const { outPath } = await generateInvoicePdf({
    number: `F-2026-QA1787T${serie}`, invoiceId: 1787, merchantId: 1787,
    merchant: EMISOR, customer: CLIENTE, currency: 'EUR', total: '121.00', qrData: '', type: 'F1',
    createdAt: new Date('2026-11-05T10:00:00.000Z'),
    lines: [{ concept: 'Mano de obra', qty: 1, price: 100, tax: 0.21 }],
    zona: 'Europe/Madrid', merchantCriterioCaja: null,
    ...extra,
  });
  try {
    const r = lineasDePdf(fs.readFileSync(outPath));
    assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF: ${r.motivo}. Un vacío se leería como «no lo dice».`);
    return r.lineas;
  } finally {
    fs.rmSync(outPath, { force: true });
  }
}

function laLinea(lineas, trozo) {
  const l = lineas.filter((x) => x.texto.includes(trozo));
  assert.equal(l.length, 1, `🔴 «${trozo}» sale en ${l.length} líneas; esperaba 1`);
  return l[0];
}

test('SCRUM-1787t ① «Vence el» sale con la fecha larga y la «Fecha:» sigue en dd/mm/aaaa', async () => {
  // 12:00Z del 23-dic: el 23 en cualquier zona de España.
  const lineas = await lineasDeFactura({ dueDate: new Date('2026-12-23T12:00:00.000Z') });
  assert.equal(laLinea(lineas, 'Fecha:').texto.trim(), 'Fecha: 05/11/2026', '🔴 la «Fecha:» de expedición ha cambiado de formato');
  assert.equal(laLinea(lineas, 'Vence el').texto.trim(), 'Vence el 23 de diciembre de 2026', '🔴 el vencimiento no sale en formato largo');
});

test('SCRUM-1787t ② el día del vencimiento largo es el de la zona del negocio', async () => {
  const instante = new Date('2026-12-23T23:30:00.000Z'); // 00:30 del 24 en Madrid; 23 en UTC
  const madrid = await lineasDeFactura({ dueDate: instante, zona: 'Europe/Madrid' });
  assert.equal(laLinea(madrid, 'Vence el').texto.trim(), 'Vence el 24 de diciembre de 2026');
  const sinZona = await lineasDeFactura({ dueDate: instante, zona: null });
  assert.equal(laLinea(sinZona, 'Vence el').texto.trim(), 'Vence el 23 de diciembre de 2026');
});

test('SCRUM-1787t ③ el mes más largo cabe en una línea, a la derecha y sin pisar el logo', async () => {
  const lineas = await lineasDeFactura({ dueDate: new Date('2026-09-30T12:00:00.000Z') });
  const vence = laLinea(lineas, 'Vence el');
  assert.equal(vence.texto.trim(), 'Vence el 30 de septiembre de 2026', '🔴 la fecha larga se corta o parte en dos líneas');
  assert.ok(vence.x > M + ANCHO_LOGO, `🔴 «Vence el» empieza en x=${vence.x}: pisa la columna del logo (hasta ${M + ANCHO_LOGO})`);
  const fecha = laLinea(lineas, 'Fecha:');
  assert.ok(vence.x < fecha.x, `🔴 «Vence el» (x=${vence.x}) no es más largo que «Fecha:» (x=${fecha.x}): no está alineado a la derecha como ella`);
  assert.ok(vence.y < fecha.y, `🔴 «Vence el» (y=${vence.y}) no está debajo de «Fecha:» (y=${fecha.y})`);
  // Ninguna otra línea a la altura del vencimiento: nada lo pisa.
  const misma = lineas.filter((l) => l !== vence && Math.abs(l.y - vence.y) < 6);
  assert.deepEqual(misma.map((l) => l.texto), [], '🔴 hay texto a la misma altura que «Vence el»');
});

test('SCRUM-1787t ④ control: sin vencimiento no hay línea «Vence el»', async () => {
  const lineas = await lineasDeFactura({});
  assert.equal(laLinea(lineas, 'Fecha:').texto.trim(), 'Fecha: 05/11/2026'); // positivo: el lector ve la cabecera
  assert.equal(lineas.filter((l) => l.texto.includes('Vence el')).length, 0, '🔴 una factura sin vencimiento imprime «Vence el»');
});

// SCRUM-1787x (decisión del fundador, SCRUM-1787 c.22431: «4-Sí ok quita el 0»; dentro del GO c.22408):
// el día va SIN cero a la izquierda. ① (23), ② (24) y ③ (30) llevan días de dos cifras y no cambian; este
// caso es el único que lo distingue: con `day: '2-digit'` sale «05 de diciembre».
test('SCRUM-1787x ⑥ un día de una cifra sale sin cero a la izquierda', async () => {
  const lineas = await lineasDeFactura({ dueDate: new Date('2026-12-05T12:00:00.000Z') });
  assert.equal(laLinea(lineas, 'Fecha:').texto.trim(), 'Fecha: 05/11/2026', '🔴 la «Fecha:» de expedición ha cambiado de formato');
  assert.equal(laLinea(lineas, 'Vence el').texto.trim(), 'Vence el 5 de diciembre de 2026', '🔴 el día del vencimiento sale con cero a la izquierda');
});

// ⑤ partido por SCRUM-1787 c.22436 (orquestador J): el DÍA cambia en dos carriles (PDF J1 → 1787x; página de
// pago J2 → 1787y) que no pueden entrar en el mismo PR. ⑤ sigue exigiendo a las DOS superficies la misma zona,
// el mismo mes y el mismo año; el día se comprueba por superficie: el PDF en ⑥ («Vence el 5 de diciembre de
// 2026»), la página en el test de 1787y. Cuando 1787y esté en main, 1787z vuelve a fijar `day: 'numeric'` aquí.
test('SCRUM-1787t ⑤ las opciones son las de la página de pago (SCRUM-1787q)', () => {
  const OPCIONES = "toLocaleDateString('es-ES', { timeZone: zonaDelMerchant(";
  const RESTO = "month: 'long', year: 'numeric' })";
  const pago = fs.readFileSync(path.join(RAIZ, 'src/modules/billing/app/routes/payInvoice.routes.ts'), 'utf8');
  const pdf = fs.readFileSync(path.join(RAIZ, 'src/modules/invoicing/infra/pdf/pdf.service.ts'), 'utf8');
  for (const [nombre, src] of [['payInvoice.routes.ts', pago], ['pdf.service.ts', pdf]]) {
    const i = src.indexOf(OPCIONES);
    assert.ok(i >= 0, `🔴 ${nombre} ya no formatea con «${OPCIONES}»: las dos superficies pueden divergir`);
    const trozo = src.slice(i, i + 200);
    assert.ok(trozo.includes(RESTO), `🔴 ${nombre}: las opciones de la fecha larga no son «${RESTO}»`);
    assert.match(trozo, /\bday: '(?:numeric|2-digit)', month: 'long'/, `🔴 ${nombre}: la fecha larga ya no lleva el día delante del mes`);
  }
});
