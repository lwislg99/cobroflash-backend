// tests/scrum1788a-emisor-no-pisa-la-tabla.test.mjs — SCRUM-1788a
//
// 🔴 EL DEFECTO (visto en producción el 21-nov-2026, primera factura real sin VeriFactu): en el PDF
// de FACTURA, un EMISOR de 5 líneas (razón social, NIF/CIF, dirección, teléfono y correo) se pinta
// encima de la cabecera de la tabla de conceptos. La tabla no empezaba debajo del bloque más alto:
// `pdf.service.ts` colocaba el cursor por debajo del CLIENTE (`cy + 16`) y el `doc.y` del emisor se
// perdía al pintar el cliente en su columna. Con un cliente de 2 líneas, cualquier emisor de más de
// 4 se metía en la banda de la cabecera.
//
// GO del fundador (regla 40): SCRUM-1788 c.22299, «Sí go». Sin texto nuevo, sin cambiar qué datos salen.
//
// CÓMO SE MIDE: posiciones de texto LEÍDAS DEL PDF (`lineasDePdf`), no a ojo. En el PDF la `y`
// crece hacia ARRIBA: una línea del emisor está por encima de la cabecera si su `y` es mayor.
//
// El PDF del PRESUPUESTO (`generateQuotePdf`) no comparte el defecto: pinta emisor y cliente uno
// DEBAJO del otro con el cursor corrido (`doc.text` sin coordenadas), no en dos columnas.
//
// SCRUM-1787w (24-nov-2026) · la FACTURA pasa al dibujo del presupuesto, firmado en SCRUM-1787
// c.22428 (GO c.22416): emisor y cliente en UNA columna. Decisión del orquestador en SCRUM-1787
// c.22442: se RETIRA el antiguo caso ② («con el cliente como bloque más alto, el emisor no mueve la
// tabla»), que era una propiedad del dibujo de DOS columnas: en una columna, un emisor más largo baja
// la tabla por definición. Lo que este test protege se queda: la tabla empieza SIEMPRE debajo del
// bloque más alto y nada se pisa (SCRUM-1788 c.22321). El caso ① se recongela a la nueva geometría:
// la dirección larga ahora parte por «Ciudad | Ficticia» (12 pt, ancho entero), no por donde partía.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { lineasDePdf } from './_texto-del-pdf.mjs';

/**
 * La banda de la cabecera mide 16 de alto y su texto empieza 4 por debajo de su borde superior
 * (`doc.rect(M, doc.y, W, 16)` y `thY = doc.y + 4`). Una línea del emisor cuya base quede a menos
 * de 16 por encima de la base de «CONCEPTO» toca la banda (8 pt de cabecera + 4 de margen + el
 * descendente de 9 pt ya pasan de 11). Medido el 21-nov-2026 con el defecto: 6,7.
 */
const HUECO_MINIMO = 16;

const CLIENTE = { name: 'Cliente QA', email: 'cliente@ejemplo.invalid' };

// Emisor FABRICADO de seis líneas impresas (la dirección parte en dos). Nada de datos reales.
const EMISOR_LARGO = {
  name: 'Fontanería Ficticia', legalName: 'Fontanería Ficticia del Norte SL', taxId: 'B00000000',
  address: 'Calle Inventada de los Ejemplos Larguísimos 123, Portal 4, Escalera B, 28000 Ciudad Ficticia',
  phone: '+34 000 000 000', email: 'facturas@ejemplo.invalid',
};

async function lineasDeFactura(sufijo, merchant) {
  const { generateInvoicePdf } = await import('../dist/lib/pdf.js');
  const { outPath } = await generateInvoicePdf({
    number: `F-2026-QA1788${sufijo}`, merchant, customer: CLIENTE,
    currency: 'EUR', total: 12.1, qrData: '', type: 'F1',
    lines: [{ concept: 'Mano de obra', qty: 1, unitPrice: 10, vatRate: 21 }],
  });
  try {
    const r = lineasDePdf(fs.readFileSync(outPath));
    assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF (${sufijo}): ${r.motivo}. Sin líneas no hay posiciones que comparar.`);
    return r.lineas;
  } finally {
    fs.rmSync(outPath, { force: true });
  }
}

/** La `y` de la cabecera de la tabla. Exactamente una línea la lleva: si no, no sé dónde está la tabla. */
function yDeLaCabecera(lineas) {
  // SCRUM-1787w · literal FIRMADO en SCRUM-1787 c.22428 (GO c.22416): cabecera «Concepto · Cant. · Precio · IVA% · IMPORTE».
  const cab = lineas.filter((l) => /^(IMPORTE|TOTAL)IVA%PrecioCant\.$/.test(l.texto));
  assert.equal(cab.length, 1, `🔴 CIEGO: esperaba 1 cabecera de tabla y hay ${cab.length}`);
  return cab[0].y;
}

/** Las líneas que imprime el emisor, buscadas por su CONTENIDO. Cada dato tiene que aparecer. */
function lineasDelEmisor(lineas, merchant) {
  // SCRUM-1787w · literal FIRMADO en SCRUM-1787 c.22428 (GO c.22416): «NIF: » sustituye a «NIF/CIF: » en el emisor.
  const datos = [merchant.legalName, `NIF: ${merchant.taxId}`, merchant.phone, merchant.email].filter(Boolean);
  const out = [];
  for (const d of datos) {
    const l = lineas.filter((x) => x.texto.includes(d));
    assert.equal(l.length, 1, `🔴 CIEGO: el dato del emisor «${d}» sale en ${l.length} líneas; esperaba 1`);
    out.push(l[0]);
  }
  if (merchant.address) {
    // La dirección larga parte en dos: se buscan su principio y su final.
    // SCRUM-1787w (c.22428, decisión c.22442): el corte no se adivina con un trozo fijo; el final es
    // la ÚNICA línea que no lleva el principio y cuyo texto entero es la cola de la dirección.
    const inicio = merchant.address.slice(0, 20);
    const l1 = lineas.filter((x) => x.texto.includes(inicio));
    assert.equal(l1.length, 1, `🔴 CIEGO: el principio de dirección «${inicio}» sale en ${l1.length} líneas`);
    out.push(l1[0]);
    const l2 = lineas.filter((x) => x.texto.trim() && !x.texto.includes(inicio) && merchant.address.endsWith(x.texto.trim()));
    assert.equal(l2.length, 1, `🔴 CIEGO: el final de la dirección sale en ${l2.length} líneas; esperaba 1`);
    out.push(l2[0]);
  }
  return out;
}

test('1788a ① · un emisor de 6 líneas termina POR ENCIMA de la cabecera de la tabla', async () => {
  const lineas = await lineasDeFactura('L', EMISOR_LARGO);
  const yCab = yDeLaCabecera(lineas);
  const emisor = lineasDelEmisor(lineas, EMISOR_LARGO);
  // Población declarada: 6 datos del emisor (razón social, NIF, dirección en 2 líneas, teléfono, correo).
  assert.equal(emisor.length, 6, `población: 6 líneas del emisor, salen ${emisor.length}`);
  const solapadas = emisor
    .filter((l) => l.y - yCab < HUECO_MINIMO)
    .map((l) => `«${l.texto}» a ${(l.y - yCab).toFixed(2)} de la cabecera`);
  assert.deepEqual(solapadas, [], '🔴 el emisor se monta sobre la cabecera de la tabla (SCRUM-1788)');
});

// (El antiguo caso ② se retiró en SCRUM-1787w por decisión de SCRUM-1787 c.22442: medía una
// propiedad del dibujo de dos columnas, que la firma de c.22428 retiró. Ver la cabecera.)

// Mutación que tiene que tumbar ①: la tabla vuelve a colocarse sólo por debajo del CLIENTE.
// SCRUM-1787w · desde la columna única (c.22426 fila 5, GO c.22416) no hay `finEmisorY`: el defecto
// vuelve si el cliente se pinta otra vez arriba, a la altura de la cabecera, en vez de en flujo.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts',
    de: '  doc.text(`Cliente: ${nombreCliente}`);\n',
    a: '  doc.text(`Cliente: ${nombreCliente}`, M + 300, headerY);\n',
    cae: '1788a ① · un emisor de 6 líneas termina POR ENCIMA de la cabecera de la tabla',
  },
];
