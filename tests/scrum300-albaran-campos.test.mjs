// SCRUM-300 (C5) · LOS TRES CAMPOS NUEVOS LLEGAN AL DOCUMENTO, no solo a la base.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTE FICHERO SE ESCRIBE HOY, Y NO SE BORRA LA LÍNEA QUE LO NOMBRABA
//
// `docs/master/SCRUM-300.md` declaraba cuatro tests. Tres no estaban en `main`, y el guard de
// SCRUM-391 lo cazó. Medido uno a uno:
//
//   · `scrum300-albaran-firmado-por` y `scrum300-microcopy-firmante` viven en
//     `origin/scrum-300-firmado-por` —la rama B, que NO se mergeó—, y lo que comprobaban está
//     cubierto por `scrum300-firmante-ids-y-microcopy` (los seis ids, las seis etiquetas, los
//     topes, el suelo del lugar vacío). Ahí la salida legítima es retirar la declaración.
//
//   · ÉSTE —`scrum300-albaran-campos`— venía de `scrum-300-campos-albaran` (PR #492, CERRADA) y
//     **no existe en ninguna rama**. Y lo que comprobaba NO lo cubre nadie: se midió que
//     `generateAlbaranPdf` no tiene ni un solo consumidor en `tests/`, y que `tests/_pdf-texto.mjs`
//     —el lector de texto de PDF que sí entró con la fusión— está HUÉRFANO. O sea: el PDF pinta
//     los tres campos y nada lo comprueba.
//
// Por eso se escribe en vez de borrarse. Y por eso el alcance es EXACTAMENTE ése: el DOCUMENTO.
// El dominio (ids, etiquetas, topes) ya está cubierto y no se duplica aquí.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ⚠️ QUE EL DATO ESTÉ GUARDADO NO PRUEBA QUE SALGA IMPRESO
//
// Los tests de PDF de esta casa comprobaban tamaño y `%PDF-`, y **un PDF con los campos en blanco
// pasa esas dos**. Aquí se abre el documento y se lee su texto.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { textoDePdf, contiene } from './_pdf-texto.mjs';
import { generateAlbaranPdf } from '../dist/modules/jobs/infra/albaranPdf.service.js';
import { ALBARAN_ROTULOS } from '../dist/modules/jobs/domain/albaranFirmante.js';

const SIG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const DOMICILIO_FISCAL = 'Calle del Domicilio Fiscal 1, Madrid';
const LUGAR = 'C/ Mayor 12, 3 B';
const FIRMANTE = 'Paco el encargado';

function params(extra = {}) {
  return {
    merchantId: 990000 + Math.floor(Math.random() * 9000),
    numero: 'ALB-T300-' + Math.random().toString(36).slice(2, 8),
    fecha: new Date('2026-08-01T10:00:00Z'),
    emisionAt: new Date('2026-07-28T09:00:00Z'),
    version: 1,
    modoValoracion: 'SIN_VALORAR',
    // El emisor SÍ tiene domicilio fiscal: es lo que hace posible la confusión que vigila el suelo.
    // 🔴 SCRUM-452: `merchant` y `customer` ya SOLO llevan lo que el sobre NO congela. El nombre
    // del emisor, su NIF y el nombre del cliente llegan resueltos por versión —`emisor`,
    // `emisorNif`, `cliente`— desde `contenidoSegunVersion`, igual que `obra` desde SCRUM-300.
    // `address` sigue aquí porque el sello no lo nombra, y es justo lo que mide el suelo de abajo:
    // que el domicilio fiscal NO se cuele como lugar de entrega.
    merchant: { address: DOMICILIO_FISCAL },
    customer: { taxId: null },
    emisor: 'Torres SL',
    emisorNif: 'B12345678',
    cliente: 'Ana Pérez',
    obra: LUGAR,
    fechaEntrega: new Date('2026-08-02T00:00:00Z'),
    referenciaTrabajo: 'Fuga en cocina',
    lineas: [{ concepto: 'Mano de obra', cantidad: 2, unidad: 'h' }],
    totales: null,
    notas: null,
    signatureData: SIG,
    firmadoAt: new Date('2026-08-02T12:00:00Z'),
    firmadoPorNombre: FIRMANTE,
    firmadoPorCalidad: 'encargado_o_personal_de_obra',
    evidencia: null,
    ...extra,
  };
}

async function textoDelPdf(extra) {
  const { outPath } = await generateAlbaranPdf(params(extra));
  const txt = textoDePdf(outPath);
  try { fs.unlinkSync(outPath); } catch { /* el temporal da igual */ }
  return txt;
}

// ── SUELO: el lector de PDF ve algo ─────────────────────────────────────────

test('SCRUM-300 · SUELO: el lector saca texto del PDF generado', async () => {
  // Sin esto, todas las aserciones de abajo pasarían a base de no encontrar nada — que es como
  // un test de documento deja de mirar sin que se note. Ya pasó una vez: el lector devolvió DOS
  // bytes porque miraba paréntesis y el texto iba en hexadecimal.
  const txt = await textoDelPdf();
  assert.ok(txt.length > 100, `🔴 solo he sacado ${txt.length} bytes de texto: el lector no está leyendo`);
  assert.ok(contiene(txt, 'ALBAR'), '🔴 no aparece ni el título: el lector no ve el documento');
});

// ── ① Los tres campos, en el DOCUMENTO ──────────────────────────────────────

test('SCRUM-300 · el LUGAR DE ENTREGA sale impreso, con su rótulo', async () => {
  const txt = await textoDelPdf();
  assert.ok(contiene(txt, ALBARAN_ROTULOS.lugarEntrega), 'falta el rótulo del LUGAR DE ENTREGA');
  assert.ok(contiene(txt, LUGAR), 'falta el VALOR del lugar de entrega');
});

test('SCRUM-300 · la FECHA DE ENTREGA sale impresa, y es distinta de la de emisión', async () => {
  // El motivo del campo: un albarán se prepara un día y se entrega otro. Si solo saliera una
  // fecha, el campo no serviría para nada.
  const txt = await textoDelPdf();
  assert.ok(contiene(txt, ALBARAN_ROTULOS.fechaEntrega), 'falta el rótulo de la FECHA DE ENTREGA');
  assert.ok(contiene(txt, '02/08/2026'), 'falta la fecha de ENTREGA');
  assert.ok(contiene(txt, '28/07/2026'), 'falta la fecha de EMISIÓN: las dos tienen que verse');
});

test('SCRUM-300 · QUIÉN FIRMA sale impreso bajo el trazo', async () => {
  // Es la parte valiosa del ticket: sin nombre, la firma es un garabato anónimo.
  const txt = await textoDelPdf();
  assert.ok(contiene(txt, ALBARAN_ROTULOS.pdfFirmadoPor), 'falta el rótulo de QUIÉN FIRMA');
  assert.ok(contiene(txt, FIRMANTE), 'falta el NOMBRE de quien firma');
});

// ── ② EL SUELO FISCAL: sin lugar de entrega NO se inventa una dirección ─────

test('SCRUM-300 · SUELO: sin lugar de entrega, el domicilio FISCAL no ocupa su sitio', async () => {
  // Poner una dirección equivocada en un documento de entrega es peor que dejarla vacía: el
  // cliente lo firma sin mirar y luego el papel dice que se entregó donde no fue.
  const txt = await textoDelPdf({ obra: null });
  assert.ok(
    !contiene(txt, `${ALBARAN_ROTULOS.lugarEntrega}: ${DOMICILIO_FISCAL}`),
    '🔴 el domicilio FISCAL del emisor se está colando como lugar de entrega',
  );
});

test('SCRUM-300 · control del control: el domicilio fiscal SÍ sigue en el bloque del emisor', async () => {
  // Si el suelo de arriba pasara porque el domicilio ya no se imprime en ninguna parte, no
  // estaría probando nada.
  const txt = await textoDelPdf({ obra: null });
  assert.ok(contiene(txt, DOMICILIO_FISCAL), 'el domicilio fiscal debe seguir imprimiéndose donde le toca');
});

// ── 🔴 UN HUECO QUE SALIÓ AL HACER SCRUM-452, Y NO ERA PEQUEÑO ───────────────────────────
//
// Al cambiar de dónde saca el PDF el emisor y el receptor, el papel salió con «Emisor:» y
// «Receptor:» VACÍOS con la fixture vieja — y LA TANDA ENTERA SIGUIÓ VERDE. Ningún test
// comprobaba los dos campos que identifican a las partes del documento: quién entrega y quién
// recibe. Se comprobaba el lugar de entrega, la referencia, las fechas, el firmante… y no ellos.
//
// Va aquí y no en el fichero de 452 porque no es de v:3: es del PDF del albarán, sea de la versión
// que sea. Que estuviera vacío no lo habría dicho nadie.

test('SCRUM-300 · el papel IMPRIME el emisor y el receptor, que son las partes del documento', async () => {
  const txt = await textoDelPdf();

  assert.ok(contiene(txt, 'Torres SL'),
    '🔴 EL PAPEL NO IMPRIME EL EMISOR. Un albarán sin quién entrega no identifica a una de las dos ' +
    'partes: es el documento que el profesional le enseña al cliente para que lo firme.');
  assert.ok(contiene(txt, 'B12345678'),
    '🔴 el papel no imprime el NIF del emisor.');
  assert.ok(contiene(txt, 'Ana Pérez'),
    '🔴 EL PAPEL NO IMPRIME EL RECEPTOR. Sin quién recibe, la entrega no consta contra nadie.');

  // CONTROL: los rótulos existen aunque el valor faltara, así que buscarlos no demuestra nada por
  // sí solo. Se exige que el VALOR vaya pegado a su rótulo y no en cualquier parte del papel.
  const i = txt.indexOf('Emisor:');
  assert.ok(i >= 0 && contiene(txt.slice(i, i + 60), 'Torres SL'),
    `🔴 «Torres SL» no está junto al rótulo «Emisor:». Trozo: ${JSON.stringify(txt.slice(i, i + 60))}`);
  const j = txt.indexOf('Receptor:');
  assert.ok(j >= 0 && contiene(txt.slice(j, j + 60), 'Ana Pérez'),
    `🔴 «Ana Pérez» no está junto al rótulo «Receptor:». Trozo: ${JSON.stringify(txt.slice(j, j + 60))}`);
});
