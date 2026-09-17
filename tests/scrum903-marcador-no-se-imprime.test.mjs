// tests/scrum903-marcador-no-se-imprime.test.mjs — SCRUM-903
//
// UN MARCADOR DE MICROCOPY SIN ESCRIBIR NO LLEGA AL PAPEL.
//
// 🔒 Una pantalla mal rotulada se arregla y se recarga. Un PDF mal rotulado ya está en el móvil de
// un cliente, y ahí no llega ningún despliegue. Lo que se cambia aquí NO es el texto —ése es del
// fundador, regla 30— sino QUIÉN se entera de que falta: hoy el cliente que recibe el papel, a
// partir de aquí quien genera el documento.
//
// Los dos caminos que imprimen, medidos en el censo del ticket:
//   ① `generateInvoicePdf` → cabecera del desglose de IVA, sólo con MÁS DE UN tipo impositivo.
//   ② `generateAlbaranPdf` → «En calidad de», cuando el id guardado no es uno de los seis válidos.
//      Este segundo venía clasificado en el ticket como respuesta de API. No lo es: se imprime.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MARCADOR = '[PENDIENTE microcopy oficial]';

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL FILTRO, CON SUS DOS MITADES
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-903 · 🔴 un marcador NO pasa al documento: lanza', async () => {
  const { textoParaDocumento, llevaMarcadorPendiente } = await import('../dist/core/documentos/sinMarcadorPendiente.js');

  assert.equal(llevaMarcadorPendiente(MARCADOR), true);
  assert.throws(() => textoParaDocumento(MARCADOR, 'sitio de prueba'), /microcopy_sin_firmar/,
    '🔴 el marcador ha pasado de largo y se imprimiría');
  // Y las OTRAS formas del marcador, no sólo la principal: el censo encontró cuatro.
  for (const m of ['[PENDIENTE]', '[PENDIENTE ASESOR]', '[PENDIENTE …]', 'Presupuesto nº [PENDIENTE microcopy oficial]']) {
    assert.throws(() => textoParaDocumento(m, 'x'), /microcopy_sin_firmar/,
      `🔴 la forma «${m}» se cuela: un censo calibrado a una sola grafía no es un censo`);
  }
  // El fallo tiene que decir DÓNDE: lo leerá alguien que no estaba aquí cuando se escribió.
  assert.throws(() => textoParaDocumento(MARCADOR, 'factura · cabecera del desglose'),
    /factura · cabecera del desglose/, '🔴 el error no dice qué sitio iba a imprimirlo');
});

test('SCRUM-903 · ✅ un texto REAL pasa intacto — la otra mitad', async () => {
  const { textoParaDocumento, llevaMarcadorPendiente } = await import('../dist/core/documentos/sinMarcadorPendiente.js');

  // Sin esto, «lanza siempre» pasaría por «lanza cuando toca», y el filtro sería un apagón.
  for (const t of ['Base imponible', 'El propio cliente', 'Encargado o personal de la obra', '', 'IVA 21%']) {
    assert.equal(textoParaDocumento(t, 'x'), t, `🔴 ha bloqueado un texto legítimo: «${t}»`);
    assert.equal(llevaMarcadorPendiente(t), false);
  }
  assert.equal(textoParaDocumento(null, 'x'), null, 'un hueco no es un marcador: quien pinta decide');
  assert.equal(textoParaDocumento(undefined, 'x'), undefined);
  assert.equal(llevaMarcadorPendiente(123), false, 'lo que no es cadena no puede llevar marcador');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① LA FACTURA — el sitio que el ticket señaló
// ═════════════════════════════════════════════════════════════════════════════════════════

const facturaBase = (extra) => ({
  number: 'J-2026-QA' + crypto.randomBytes(3).toString('hex'),
  merchant: { name: 'QA Fontanería', legalName: 'QA SL', address: 'C/ Test 1' },
  customer: { name: 'Cliente QA' },
  currency: 'EUR', total: '100.00', type: 'JUST',
  ...extra,
});

test('SCRUM-903 · 🔴 factura con DOS tipos de IVA: el PDF no se genera, y dice por qué', async () => {
  // Es el camino exacto del ticket: `tiposDeIva.length > 1` entra en el bloque del desglose, y ahí
  // el rótulo de la cabecera es el marcador. Antes esto producía un PDF con
  // `[PENDIENTE microcopy oficial]` impreso en una factura.
  const { generateInvoicePdf } = await import('../dist/lib/pdf.js');
  await assert.rejects(
    () => generateInvoicePdf(facturaBase({
      total: '131.00',
      lines: [
        { concept: 'Mano de obra', qty: 1, price: 100, tax: 21 },
        { concept: 'Material reducido', qty: 1, price: 100, tax: 10 },
      ],
    })),
    /microcopy_sin_firmar/,
    '🔴 la factura se ha generado CON el marcador impreso dentro. Ese PDF ya no se recupera.',
  );
});

test('SCRUM-903 · ✅ factura con UN solo tipo de IVA: se genera como siempre', async () => {
  // La otra mitad, y la que impide que el arreglo sea «no se generan facturas». El camino de un
  // solo tipo ni siquiera toca el rótulo del desglose.
  const { generateInvoicePdf } = await import('../dist/lib/pdf.js');
  const { outPath } = await generateInvoicePdf(facturaBase({
    total: '121.00',
    lines: [{ concept: 'Mano de obra', qty: 1, price: 100, tax: 21 }],
  }));
  assert.ok(fs.existsSync(outPath), '🔴 se ha roto la generación normal de facturas');
  assert.ok(fs.statSync(outPath).size > 1000, '🔴 el PDF sale vacío');
  const crudo = fs.readFileSync(outPath, 'latin1');
  assert.ok(!crudo.includes('PENDIENTE microcopy'), '🔴 hay un marcador en el PDF por otra vía');
  fs.rmSync(outPath, { force: true });
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② EL ALBARÁN — el camino que el ticket daba por «respuesta de API» y se imprime
// ═════════════════════════════════════════════════════════════════════════════════════════

// Un PNG de 1×1 de verdad: el bloque de firma sólo se pinta si hay trazo, y con una cadena
// inventada el `catch` de ese bloque se lo comería y el test mediría otra cosa.
const FIRMA_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ'
  + 'AAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const albaranBase = (firmadoPorCalidad) => ({
  signatureData: FIRMA_PNG,
  merchantId: 9901,
  numero: 'ALB-QA-' + crypto.randomBytes(3).toString('hex'),
  fecha: new Date('2026-09-17T08:00:00.000Z'),
  emisionAt: new Date('2026-09-17T08:00:00.000Z'),
  version: 1,
  modoValoracion: 'SIN_VALORAR',
  merchant: { address: 'C/ Test 1', logoUrl: null, whatsappPhone: null },
  customer: { taxId: 'B00000000' },
  merchantName: 'QA Fontanería', merchantLegalName: 'QA SL', merchantTaxId: 'B11111111',
  customerName: 'Cliente QA',
  lineas: [{ concepto: 'Revisión de caldera', cantidad: 1, unidad: 'ud' }],
  firmadoPorNombre: 'Ana Ruiz',
  firmadoPorCalidad,
  firmadoAt: new Date('2026-09-17T09:00:00.000Z'),
});

test('SCRUM-903 · 🔴 albarán con una calidad DESCONOCIDA: el PDF no se genera', async () => {
  // `etiquetaCalidad` devuelve el marcador para cualquier id que no sea uno de los seis. Medido:
  // basta un cambio de mayúsculas. Y el PDF del albarán se GUARDA en disco, así que lo que se
  // imprima una vez se queda impreso y se va con el cliente.
  const { generateAlbaranPdf } = await import('../dist/modules/jobs/infra/albaranPdf.service.js');
  await assert.rejects(
    () => generateAlbaranPdf(albaranBase('administrador')),
    /microcopy_sin_firmar/,
    '🔴 el albarán se ha generado con «[PENDIENTE microcopy oficial]» en la línea «En calidad de»',
  );
});

test('SCRUM-903 · ✅ albarán con una de las SEIS calidades válidas: se genera y la imprime', async () => {
  const { generateAlbaranPdf } = await import('../dist/modules/jobs/infra/albaranPdf.service.js');
  const r = await generateAlbaranPdf(albaranBase('encargado_o_personal_de_obra'));
  const ruta = r && (r.diskPath || r.outPath || r.path);
  assert.ok(ruta && fs.existsSync(ruta), '🔴 se ha roto la generación normal de albaranes');
  const crudo = fs.readFileSync(ruta, 'latin1');
  assert.ok(!crudo.includes('PENDIENTE microcopy'), '🔴 hay un marcador impreso en el albarán');
  fs.rmSync(ruta, { force: true });
});

test('SCRUM-903 · 🔴 el `catch` vacío del bloque de firma NO se traga el marcador', async () => {
  // 🔴 ESTE CASO EXISTE PORQUE EL PRIMER ARREGLO ERA PEOR QUE EL DEFECTO. El bloque de firma
  // termina en `catch {}` —está para que un PNG corrupto no tumbe el documento—, así que con la
  // comprobación DENTRO el resultado no era «no se genera»: era un albarán **sin bloque de firma
  // entero**, sin trazo, sin nombre y sin fecha, en silencio. Por eso la etiqueta se resuelve
  // fuera del `try`. Si alguien la devuelve adentro, este caso cae.
  const { generateAlbaranPdf } = await import('../dist/modules/jobs/infra/albaranPdf.service.js');
  const antes = fs.existsSync(path.join(RAIZ, 'storage')) ? 1 : 0;

  await assert.rejects(
    () => generateAlbaranPdf(albaranBase('calidad_que_nadie_ha_definido')),
    /microcopy_sin_firmar/,
    '🔴 el error se ha perdido: o se imprime el marcador, o sale un albarán firmado SIN su firma',
  );
  assert.equal(antes, antes); // el estado del disco no es lo medido aquí; lo es que el error suba
});

test('SCRUM-903 · ✅ las seis etiquetas están escritas: ninguna devuelve marcador', async () => {
  // El comentario de `albaranPdf.service.ts` afirmaba lo contrario («mientras las seis sigan sin
  // aprobar, esto imprime el marcador») y llevaba tiempo siendo falso. Esto ata la afirmación a la
  // medida: si alguna etiqueta se retira, cae aquí y no en el papel de un cliente.
  const m = await import('../dist/modules/jobs/domain/albaranFirmante.js');
  for (const id of m.FIRMANTE_CALIDAD_IDS) {
    const etiqueta = m.etiquetaCalidad(id);
    assert.ok(etiqueta && !String(etiqueta).includes('[PENDIENTE'),
      `🔴 la calidad «${id}» imprimiría un marcador en el albarán: ${JSON.stringify(etiqueta)}`);
  }
  assert.equal(m.etiquetaCalidad('id_que_no_existe'), '[PENDIENTE microcopy oficial]',
    '🔴 si esto deja de devolver el marcador, el guard de arriba ya no vigila nada');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL TRINQUETE: los dos generadores, y que nadie añada un tercero sin filtro
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-903 · ⛔ TODO generador de PDF filtra sus marcadores', () => {
  // Por IDENTIDAD y no por número de línea (SCRUM-636: referenciar por posición caduca).
  const generadores = [
    'src/modules/invoicing/infra/pdf/pdf.service.ts',
    'src/modules/jobs/infra/albaranPdf.service.ts',
  ];
  // Si aparece un tercer generador, esta lista deja de describir el árbol y hay que mirarlo.
  const todos = [];
  const recorrer = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) recorrer(p);
      else if (e.name.endsWith('.ts') && /new PDFDocument/.test(fs.readFileSync(p, 'utf8'))) {
        todos.push(path.relative(RAIZ, p).split(path.sep).join('/'));
      }
    }
  };
  recorrer(path.join(RAIZ, 'src'));
  assert.deepEqual(todos.sort(), [...generadores].sort(),
    '🔴 ha aparecido (o desaparecido) un generador de PDF. Si es nuevo, NADIE comprueba que no '
    + 'imprima un marcador: revísalo y añádelo aquí.');

  for (const g of generadores) {
    const src = fs.readFileSync(path.join(RAIZ, g), 'utf8');
    assert.ok(/textoParaDocumento/.test(src),
      `🔴 ${g} no filtra: un marcador suyo llegaría al papel`);
    // Y el filtro tiene que envolver al marcador, no estar puesto en cualquier otro sitio.
    const sinFiltrar = src.split('\n').filter((l) =>
      /doc\.text\(/.test(l) && /MARCADOR_MICROCOPY|etiquetaCalidad|\[PENDIENTE/.test(l)
      && !/textoParaDocumento/.test(l));
    assert.deepEqual(sinFiltrar, [],
      `🔴 ${g} imprime un marcador sin pasar por el filtro`);
  }
});
