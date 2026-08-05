// SCRUM-300 (C5): lugar de entrega, fecha de entrega y QUIÉN FIRMA.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA PREMISA DEL TICKET ESTABA DESMENTIDA, Y ESO CAMBIÓ EL DISEÑO
//
// El ticket daba por hecho que el lugar de obra salía de `Job.direccion`. Medido: NADIE escribe
// `Job.direccion` —ningún esquema de validación la acepta y sus únicas apariciones en `src/` son
// lecturas— y `Customer` no tiene dirección. El sello de la firma (`buildFirmaEvidencia`) llevaba
// meses metiendo `obra: job.direccion` en el hash, o sea sellando SIEMPRE `null`.
//
// Por eso el lugar de entrega es un campo PROPIO del albarán y por eso el sobre sube a v:2.
//
// ⚠️ Los sobres v:1 NO se recalculan, NO se migran y NO se tocan (decisión del fundador): con su
// `obra: null` son la verdad de lo que se firmó.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ SE COMPRUEBA, Y POR QUÉ ASÍ
//
//   ① Los tres campos llegan AL DOCUMENTO. Se abre el PDF y se lee su texto (`_pdf-texto.mjs`),
//      no la fila de la BD: que el dato esté guardado no prueba que salga impreso.
//   ② SUELO — si no hay lugar de entrega, NO se cae al domicilio fiscal. Una dirección
//      equivocada en un albarán firmado es peor que un hueco: el cliente lo firma sin mirar.
//   ③ Retrocompatibilidad — un albarán firmado ANTES (v:1, cuatro campos a null) se imprime
//      sin romperse y se sigue pudiendo facturar.
//   ④ Control positivo del sobre — un contenido v:2 sin tocar recalcula el MISMO hash, y
//      cambiar el lugar de entrega lo cambia. Sin esto no sabríamos si al mover el sello lo
//      hemos roto.
//   ⑤ Las dos listas de microcopy (TS y el JS del dashboard) dicen lo mismo.
//
// Todo es PURO: sin BD, sin red, sin gate. Corre siempre en `npm test`.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { textoDePdf, contiene } from './_pdf-texto.mjs';
import { generateAlbaranPdf } from '../dist/modules/jobs/infra/albaranPdf.service.js';
import { computeAlbaranContentHash, EVIDENCIA_VERSION_ACTUAL } from '../dist/modules/jobs/domain/albaran.service.js';
import { COPY, CALIDAD_FIRMANTE, PENDIENTE, leerFirmante, codificarCalidad, decodificarCalidad }
  from '../dist/modules/jobs/domain/albaranFirmaCopy.js';
import { estadoCobroAlbaran, facturadoPorLinea } from '../dist/modules/jobs/domain/albaranFacturacion.js';

const SIG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const DOMICILIO_FISCAL = 'Calle del Domicilio Fiscal 1, Madrid';
const LUGAR = 'C/ Mayor 12, 3 B';
const FIRMANTE = 'Paco el encargado';

/** Un albarán FIRMADO, con los campos que se le pasen por encima. */
function pdfParams(extra = {}) {
  return {
    merchantId: 990000 + Math.floor(Math.random() * 9000),
    numero: 'ALB-T300-' + Math.random().toString(36).slice(2, 8),
    fecha: new Date('2026-08-01T10:00:00Z'),
    emisionAt: new Date('2026-07-28T09:00:00Z'),
    version: 1,
    modoValoracion: 'SIN_VALORAR',
    // El emisor SÍ tiene domicilio fiscal: es lo que hace posible la confusión que vigila ②.
    merchant: { name: 'Fontanería Torres', legalName: 'Torres SL', taxId: 'B12345678', address: DOMICILIO_FISCAL },
    customer: { name: 'Ana Pérez', legalName: null, taxId: null },
    lugarEntrega: LUGAR,
    fechaEntrega: new Date('2026-08-02T00:00:00Z'),
    referenciaTrabajo: 'Fuga en cocina',
    lineas: [{ concepto: 'Mano de obra', cantidad: 2, unidad: 'h' }],
    totales: null,
    notas: null,
    signatureData: SIG,
    firmadoAt: new Date('2026-08-02T12:00:00Z'),
    firmadoPorNombre: FIRMANTE,
    firmadoPorCalidad: 'encargado_o_personal_obra',
    evidencia: null,
    ...extra,
  };
}

async function textoDelPdfDe(extra) {
  const { outPath } = await generateAlbaranPdf(pdfParams(extra));
  const txt = textoDePdf(outPath);
  try { fs.unlinkSync(outPath); } catch { /* el temporal da igual */ }
  return txt;
}

// ── ① Los tres campos llegan al DOCUMENTO ────────────────────────────────────

test('SCRUM-300: los tres campos nuevos salen impresos en el PDF firmado', async () => {
  const txt = await textoDelPdfDe();

  // Cada uno con su propio mensaje: si se cae, dice CUÁL falta sin tener que investigar.
  assert.ok(contiene(txt, COPY.lugarEntrega.label), 'falta el rótulo del LUGAR DE ENTREGA en el PDF');
  assert.ok(contiene(txt, LUGAR), 'falta el VALOR del lugar de entrega en el PDF');
  assert.ok(contiene(txt, COPY.fechaEntrega.label), 'falta el rótulo de la FECHA DE ENTREGA en el PDF');
  assert.ok(contiene(txt, '02/08/2026'), 'falta el VALOR de la fecha de entrega en el PDF');
  assert.ok(contiene(txt, COPY.firmadoPorNombre.label), 'falta el rótulo de QUIÉN FIRMA en el PDF');
  assert.ok(contiene(txt, FIRMANTE), 'falta el NOMBRE de quien firma en el PDF');
});

test('SCRUM-300: la fecha de entrega es DISTINTA de la de emisión y se ven las dos', async () => {
  // El motivo del campo: un albarán se prepara un día y se entrega otro.
  const txt = await textoDelPdfDe();
  assert.ok(contiene(txt, '28/07/2026'), 'falta la fecha de EMISIÓN');
  assert.ok(contiene(txt, '02/08/2026'), 'falta la fecha de ENTREGA');
});

test('SCRUM-300: la calidad del firmante se imprime, con su texto libre si lo hay', async () => {
  const txt = await textoDelPdfDe({ firmadoPorCalidad: codificarCalidad('otra_persona', 'Vecina del 3º') });
  assert.ok(contiene(txt, 'Vecina del 3'), 'el texto libre de «otra persona» no llega al PDF');
});

// ── ② SUELO: sin lugar de entrega NO se inventa una dirección ────────────────

test('SCRUM-300 · SUELO: sin lugar de entrega NO aparece el domicilio fiscal en su sitio', async () => {
  const txt = await textoDelPdfDe({ lugarEntrega: null });

  // Se dice que no se pidió, con las palabras aprobadas...
  assert.ok(
    contiene(txt, `${COPY.lugarEntrega.label}: ${COPY.noSePidio}`),
    'sin lugar de entrega, el PDF debe decir exactamente «No se pidió al firmar»',
  );
  // ...y NUNCA con la dirección del profesional pegada detrás del rótulo. Ésta es la aserción
  // que importa: el domicilio fiscal sigue saliendo arriba, en el bloque del EMISOR, que es su
  // sitio; lo que no puede es colarse como lugar de entrega.
  assert.ok(
    !contiene(txt, `${COPY.lugarEntrega.label}: ${DOMICILIO_FISCAL}`),
    'el domicilio FISCAL del emisor se está colando como lugar de entrega',
  );
});

test('SCRUM-300 · SUELO: el domicilio fiscal sigue en el bloque del emisor (no se ha borrado)', async () => {
  // Control del control: si el suelo de arriba pasara porque el domicilio ya no se imprime en
  // ninguna parte, no estaría probando nada.
  const txt = await textoDelPdfDe({ lugarEntrega: null });
  assert.ok(contiene(txt, DOMICILIO_FISCAL), 'el domicilio fiscal del emisor debe seguir imprimiéndose donde le toca');
});

// ── ③ Retrocompatibilidad con lo firmado ANTES (v:1) ─────────────────────────

const ALBARAN_VIEJO = {
  lugarEntrega: null,
  fechaEntrega: null,
  firmadoPorNombre: null,
  firmadoPorCalidad: null,
  evidencia: {
    v: 1, canal: 'in_situ', firmadoAt: '2026-05-04T09:12:00.000Z', ip: null, ua: null,
    tokenId: null, firmante: 'Ana Pérez', hashAlg: 'sha256',
    contentHash: 'a'.repeat(64),
  },
};

test('SCRUM-300 · retrocompatibilidad: un albarán firmado ANTES se imprime sin romperse', async () => {
  const { outPath } = await generateAlbaranPdf(pdfParams(ALBARAN_VIEJO));
  const buf = fs.readFileSync(outPath);
  assert.equal(buf.subarray(0, 5).toString(), '%PDF-', 'el PDF de un albarán antiguo no se genera');
  assert.ok(buf.length > 1000, `PDF sospechosamente pequeño (${buf.length}b)`);

  const txt = textoDePdf(outPath);
  try { fs.unlinkSync(outPath); } catch { /* temporal */ }

  // Los huecos se explican, no se dejan mudos.
  assert.ok(contiene(txt, COPY.noSePidio), 'un albarán antiguo debe decir «No se pidió al firmar», no dejar el hueco vacío');
  // Y su certificado v:1 se sigue imprimiendo con el firmante que tenía.
  assert.ok(contiene(txt, 'Ana Pérez'), 'el certificado del albarán antiguo pierde su firmante');
  assert.ok(contiene(txt, ALBARAN_VIEJO.evidencia.contentHash), 'el hash v:1 debe imprimirse TAL CUAL (no se recalcula)');
});

test('SCRUM-300 · retrocompatibilidad: un albarán antiguo se sigue pudiendo facturar', async () => {
  // Las funciones de facturación no miran los campos nuevos; se comprueba explícitamente que
  // un albarán sin ellos sigue recorriendo el camino de cobro.
  const lineas = [{ concepto: 'Mano de obra', cantidad: 2, unidad: 'h' }];
  assert.equal(estadoCobroAlbaran(lineas, facturadoPorLinea([])), 'sin_facturar');
  assert.equal(estadoCobroAlbaran(lineas, facturadoPorLinea([{ lineaIndex: 0, cantidad: 2, invoiceId: 7 }])), 'facturado');
  assert.equal(estadoCobroAlbaran(lineas, facturadoPorLinea([{ lineaIndex: 0, cantidad: 1, invoiceId: 7 }])), 'parcial');
});

// ── ④ Control positivo del sobre ─────────────────────────────────────────────

const CONTENIDO_V2 = {
  numero: 'ALB-2026-001',
  fecha: new Date('2026-08-01T10:00:00Z'),
  modoValoracion: 'SIN_VALORAR',
  lineas: [{ concepto: 'Mano de obra', cantidad: 2, unidad: 'h' }],
  notas: null,
  lugarEntrega: LUGAR,
  fechaEntrega: new Date('2026-08-02T00:00:00Z'),
  firmadoPorNombre: FIRMANTE,
  firmadoPorCalidad: 'encargado_o_personal_obra',
  referenciaTrabajo: 'Fuga en cocina',
  cliente: 'Ana Pérez',
  emisor: 'Torres SL',
  emisorNif: 'B12345678',
};

test('SCRUM-300 · control positivo: el mismo contenido v:2 recalcula el MISMO hash', () => {
  const a = computeAlbaranContentHash(CONTENIDO_V2);
  const b = computeAlbaranContentHash({ ...CONTENIDO_V2, fecha: new Date('2026-08-01T10:00:00Z') });
  assert.equal(a, b, 'el sello dejó de ser determinista al cambiarlo');
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.equal(EVIDENCIA_VERSION_ACTUAL, 2, 'la versión del sobre debe ser 2 desde SCRUM-300');
});

test('SCRUM-300 · los campos nuevos ESTÁN sellados: cambiarlos cambia el hash', () => {
  const base = computeAlbaranContentHash(CONTENIDO_V2);
  // Si alguno de estos no entrara al hash, se podría cambiar después de firmar sin dejar rastro,
  // que es exactamente lo que le pasaba a `obra` (iba dentro, pero siempre null).
  assert.notEqual(base, computeAlbaranContentHash({ ...CONTENIDO_V2, lugarEntrega: 'Otro sitio' }), 'lugarEntrega NO está sellado');
  assert.notEqual(base, computeAlbaranContentHash({ ...CONTENIDO_V2, fechaEntrega: new Date('2026-08-09T00:00:00Z') }), 'fechaEntrega NO está sellada');
  assert.notEqual(base, computeAlbaranContentHash({ ...CONTENIDO_V2, firmadoPorNombre: 'Otro nombre' }), 'firmadoPorNombre NO está sellado');
  assert.notEqual(base, computeAlbaranContentHash({ ...CONTENIDO_V2, firmadoPorCalidad: 'portero_o_conserje' }), 'firmadoPorCalidad NO está sellada');
});

test('SCRUM-300 · un lugar de entrega vacío no colisiona con uno con texto', () => {
  assert.notEqual(
    computeAlbaranContentHash({ ...CONTENIDO_V2, lugarEntrega: null }),
    computeAlbaranContentHash({ ...CONTENIDO_V2, lugarEntrega: '' }),
  );
});

// ── La declaración del firmante: obligatoria y validada ──────────────────────

test('SCRUM-300: sin nombre NO se firma, y el error lleva mensaje', () => {
  for (const cuerpo of [{}, { firmadoPorNombre: '' }, { firmadoPorNombre: '   ' }]) {
    const r = leerFirmante(cuerpo);
    assert.ok('error' in r, `debería rechazar ${JSON.stringify(cuerpo)}`);
    assert.equal(r.error.error, 'firma_sin_nombre');
    assert.ok(r.error.message, 'la respuesta debe llevar texto para la persona (SCRUM-275)');
  }
});

test('SCRUM-300: el nombre se normaliza y una calidad desconocida se RECHAZA', () => {
  assert.deepEqual(leerFirmante({ firmadoPorNombre: '  Paco   el  encargado ' }), { nombre: 'Paco el encargado', calidad: null });
  const malo = leerFirmante({ firmadoPorNombre: 'Paco', firmadoPorCalidad: 'jefe_supremo' });
  assert.ok('error' in malo, 'una calidad que no está en la lista no se guarda «por si acaso»');
  assert.equal(malo.error.error, 'firma_calidad_desconocida');
});

test('SCRUM-300: «otra persona» conserva el texto libre y se puede volver a leer', () => {
  const r = leerFirmante({ firmadoPorNombre: 'Paco', firmadoPorCalidad: 'otra_persona', firmadoPorCalidadOtra: 'Vecina del 3º' });
  assert.ok(!('error' in r));
  assert.deepEqual(decodificarCalidad(r.calidad), { id: 'otra_persona', textoLibre: 'Vecina del 3º' });
});

test('SCRUM-300: ninguna calidad viene marcada por defecto', () => {
  // Una casilla premarcada es una declaración que el firmante no ha hecho.
  const r = leerFirmante({ firmadoPorNombre: 'Paco' });
  assert.equal(r.calidad, null, 'sin elegir calidad NO se guarda ninguna');
});

// ── ⑤ Las dos listas de microcopy dicen lo mismo ─────────────────────────────

test('SCRUM-300: el microcopy del dashboard no se ha separado del módulo', () => {
  // El dashboard es JS vanilla y no puede importar el TS, así que hay dos copias. Esto es lo
  // único que impide que se separen sin que nadie se entere.
  const js = fs.readFileSync(path.join(process.cwd(), 'public/dashboard/js/signaturePad.js'), 'utf8');

  assert.ok(js.includes(COPY.firmadoPorNombre.label), 'el rótulo del dashboard ya no coincide con el aprobado');
  assert.ok(js.includes(COPY.firmadoPorNombre.ayuda), 'el texto de ayuda del dashboard ya no coincide con el aprobado');
  assert.ok(js.includes(COPY.firmadoPorNombre.chip), 'el chip del dashboard ya no coincide con el aprobado');

  for (const c of CALIDAD_FIRMANTE) {
    assert.ok(js.includes(`'${c.id}'`), `falta la calidad '${c.id}' en el pad de firma del dashboard`);
  }

  // El editor del albarán es la TERCERA copia de estos textos (pad de firma, página pública y
  // aquí). Se ata igual: si alguien reescribe un rótulo en el editor y no en el módulo, rojo.
  const editor = fs.readFileSync(path.join(process.cwd(), 'public/dashboard/js/jobDetailView.js'), 'utf8');
  for (const campo of ['lugarEntrega', 'fechaEntrega']) {
    assert.ok(editor.includes(COPY[campo].label), `el editor del albarán no usa el rótulo aprobado de ${campo}`);
    assert.ok(editor.includes(COPY[campo].ayuda), `el editor del albarán no usa la ayuda aprobada de ${campo}`);
  }
});

test('SCRUM-300: el editor manda los dos campos al backend (si no, nacen muertos)', () => {
  // Un campo que se pinta pero no se envía es peor que no tenerlo: el pro cree que lo guardó.
  const editor = fs.readFileSync(path.join(process.cwd(), 'public/dashboard/js/jobDetailView.js'), 'utf8');
  const cuerpo = editor.match(/const body = \{ lineas: out[^}]*\}/);
  assert.ok(cuerpo, 'no encuentro el cuerpo del PATCH del editor de albarán');
  // Se busca la CLAVE con sus dos puntos, no la subcadena: al probar este guard en rojo cambié
  // `lugarEntrega` por `lugarEntregaX` y siguió verde, porque una contiene a la otra. Un guard
  // que se traga un nombre mal escrito no vigila nada.
  assert.match(cuerpo[0], /\blugarEntrega:/, 'el editor NO envía lugarEntrega en el PATCH');
  assert.match(cuerpo[0], /\bfechaEntrega:/, 'el editor NO envía fechaEntrega en el PATCH');
});

test('SCRUM-300: las etiquetas de calidad siguen marcadas como PENDIENTES', () => {
  // Regla 30: mientras el fundador no apruebe el texto, se ve el marcador. Si alguien inventa
  // una etiqueta y la da por buena, esto se pone rojo.
  for (const c of CALIDAD_FIRMANTE) {
    assert.equal(c.etiqueta, PENDIENTE, `la calidad '${c.id}' lleva un texto que NADIE ha aprobado`);
  }
});
