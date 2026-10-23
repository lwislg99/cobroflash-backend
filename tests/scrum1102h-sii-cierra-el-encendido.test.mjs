// SCRUM-1102h · W + V: QUIEN DECLARA EL SII NO SE QUEDA CON LA FACTURACIÓN ENCENDIDA SIN QUE NADIE LO VEA.
//
// GO del fundador en SCRUM-1102 c.20472 («W + V ahora»; M va a SCRUM-1585).
//   · W — `cambiarFlagFiscal` se niega a ENCENDER `INVOICING_ES_ENABLED` si el SII no es «No».
//     «Sí» y «No consta» se niegan con códigos DISTINTOS: uno pide que se vaya, el otro que conteste.
//   · V — el guard de SCRUM-1097 (y su aviso programado) lista, de los acreditados, quién tiene el
//     SII distinto de «No», y la foral aparte, como «pendiente del asesor».
//
// Población declarada de W: las 3 respuestas × {encender, apagar} + `undefined` (una lectura que no
// trae la columna) + SIF_ENABLED, que no se toca. Control positivo de cada negativa: el MISMO doble
// con «No» enciende y escribe su fila.
import test from 'node:test';
import assert from 'node:assert/strict';
import { casosEscritos } from './_casos-escritos.mjs';

const { cambiarFlagFiscal, ErrorCambioFlag } = await import('../dist/modules/system/domain/flagFiscal.service.js');
const { medirAcreditacion, declaradoPorAcreditados, lineasDeclarado } = await import('../scripts/guard-acreditacion-invoicing-es.mjs');
const { construirAviso } = await import('../scripts/aviso-programado-acreditacion-invoicing-es.mjs');

const ACTOR = { tipo: 'sistema', teamMemberId: null, ref: 'test' };
const MERCHANT = (sii, foral = null, flags = null) => {
  const m = { id: 7, email: 'pro@ejemplo.es', country: 'ES', flags, domicilioFiscalForal: foral };
  if (sii !== 'ausente') m.llevaLibrosPorSii = sii;
  return m;
};

function clienteFalso(merchant) {
  const registro = { updates: [], auditorias: [], selects: [] };
  const tx = {
    merchant: {
      findUnique: async (args) => { registro.selects.push(args.select); return merchant; },
      update: async (args) => { registro.updates.push(args); return merchant; },
    },
    auditLog: { create: async (args) => { registro.auditorias.push(args.data); } },
    $transaction: async (fn) => fn(tx),
  };
  return { cliente: tx, registro };
}

const pedir = (over = {}) => ({
  merchantId: 7, flag: 'INVOICING_ES_ENABLED', valorNuevo: true,
  confirmacion: 'pro@ejemplo.es', actor: ACTOR, ...over,
});

// ── W ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-1102h · W · control positivo: con el SII en «No» se enciende y la fila guarda lo declarado', async () => {
  const { cliente, registro } = clienteFalso(MERCHANT(false, true));
  const r = await cambiarFlagFiscal(pedir(), cliente);
  assert.deepEqual(r, { anterior: false, nuevo: true });
  assert.equal(registro.updates.length, 1);
  assert.equal(registro.auditorias.length, 1);
  // La foral NO bloquea: viaja en la fila para poder acreditar qué constaba al encender.
  assert.equal(registro.auditorias[0].meta.llevaLibrosPorSii, false);
  assert.equal(registro.auditorias[0].meta.domicilioFiscalForal, true);
});

test('SCRUM-1102h · W · el select pide las dos columnas (sin ellas, «No» llegaría como undefined)', async () => {
  const { cliente, registro } = clienteFalso(MERCHANT(false));
  await cambiarFlagFiscal(pedir(), cliente);
  assert.equal(registro.selects[0].llevaLibrosPorSii, true);
  assert.equal(registro.selects[0].domicilioFiscalForal, true);
});

const NEGATIVAS = [
  { caso: '«Sí»', sii: true, codigo: 'sii_declarado' },
  { caso: '«No consta» (NULL)', sii: null, codigo: 'sii_no_consta' },
  { caso: 'sin la columna (undefined)', sii: 'ausente', codigo: 'sii_no_consta' },
];

const noEnciende = casosEscritos(NEGATIVAS, (f) => `SCRUM-1102h · W · con el SII en ${f.caso} NO se enciende: ${f.codigo}, sin update y sin fila`, async (f) => {
  const { cliente, registro } = clienteFalso(MERCHANT(f.sii));
  await assert.rejects(
    () => cambiarFlagFiscal(pedir(), cliente),
    (e) => e instanceof ErrorCambioFlag && e.codigo === f.codigo,
  );
  assert.equal(registro.updates.length, 0, '🔴 se encendió la facturación a quien no ha dicho «No» al SII');
  assert.equal(registro.auditorias.length, 0);
});
test('SCRUM-1102h · W · con el SII en «Sí» NO se enciende: sii_declarado, sin update y sin fila', noEnciende(0));
test('SCRUM-1102h · W · con el SII en «No consta» (NULL) NO se enciende: sii_no_consta, sin update y sin fila', noEnciende(1));
test('SCRUM-1102h · W · con el SII en sin la columna (undefined) NO se enciende: sii_no_consta, sin update y sin fila', noEnciende(2));
noEnciende.todos();

const apaga = casosEscritos(NEGATIVAS, (f) => `SCRUM-1102h · W · con el SII en ${f.caso} APAGAR sí se puede`, async (f) => {
  const { cliente, registro } = clienteFalso(MERCHANT(f.sii, null, { INVOICING_ES_ENABLED: true }));
  const r = await cambiarFlagFiscal(pedir({ valorNuevo: false }), cliente);
  assert.deepEqual(r, { anterior: true, nuevo: false });
  assert.equal(registro.updates.length, 1);
});
test('SCRUM-1102h · W · con el SII en «Sí» APAGAR sí se puede', apaga(0));
test('SCRUM-1102h · W · con el SII en «No consta» (NULL) APAGAR sí se puede', apaga(1));
test('SCRUM-1102h · W · con el SII en sin la columna (undefined) APAGAR sí se puede', apaga(2));
apaga.todos();

test('SCRUM-1102h · W · SIF_ENABLED no la gobierna esta puerta', async () => {
  const { cliente, registro } = clienteFalso(MERCHANT(true));
  await cambiarFlagFiscal(pedir({ flag: 'SIF_ENABLED' }), cliente);
  assert.equal(registro.updates.length, 1);
});

test('SCRUM-1102h · W · la confirmación equivocada sigue negándose ANTES que el SII', async () => {
  const { cliente } = clienteFalso(MERCHANT(true));
  await assert.rejects(
    () => cambiarFlagFiscal(pedir({ confirmacion: 'otro@ejemplo.es' }), cliente),
    (e) => e.codigo === 'confirmacion_no_coincide',
  );
});

// ── V ────────────────────────────────────────────────────────────────────────────────────

const fila = (over) => ({ id: 2, flags: null, Invoice: [], ...over });
const ON = { INVOICING_ES_ENABLED: true };

test('SCRUM-1102h · V · el guard pide las dos columnas en su única consulta', async () => {
  let select;
  await medirAcreditacion({ merchant: { findMany: async (a) => { select = a.select; return [fila({})]; } } });
  assert.equal(select.llevaLibrosPorSii, true);
  assert.equal(select.domicilioFiscalForal, true);
});

test('SCRUM-1102h · V · de los acreditados separa SII «Sí», «No consta» y foral; «No» y los no acreditados no salen', async () => {
  const r = await medirAcreditacion({
    merchant: {
      findMany: async () => [
        fila({ id: 3, flags: ON, llevaLibrosPorSii: true }),
        fila({ id: 4, flags: ON, llevaLibrosPorSii: null, domicilioFiscalForal: true }),
        fila({ id: 5, flags: ON }), // sin la columna: cuenta como «No consta»
        fila({ id: 6, flags: ON, llevaLibrosPorSii: false }), // control: «No» no sale
        fila({ id: 8, Invoice: [{ id: 1 }], llevaLibrosPorSii: true }), // acreditado por el brazo (b)
        fila({ id: 9, llevaLibrosPorSii: true, domicilioFiscalForal: true }), // no acreditado: no sale
      ],
    },
  });
  assert.deepEqual(r.filas.map((f) => f.id), [3, 4, 5, 6, 8]);
  assert.deepEqual(r.siiDeclarado, [{ id: 3 }, { id: 8 }]);
  assert.deepEqual(r.siiNoConsta, [{ id: 4 }, { id: 5 }]);
  assert.deepEqual(r.foralPendienteAsesor, [{ id: 4 }]);
});

test('SCRUM-1102h · V · sin nada declarado no hay líneas; con algo, una por cada lista', () => {
  assert.deepEqual(lineasDeclarado(declaradoPorAcreditados([{ id: 1, llevaLibrosPorSii: false }])), []);
  const l = lineasDeclarado(declaradoPorAcreditados([
    { id: 1, llevaLibrosPorSii: true }, { id: 2, llevaLibrosPorSii: null, domicilioFiscalForal: true },
  ]));
  assert.equal(l.length, 3);
  assert.match(l[0], /^SII declarado .*id 1$/);
  assert.match(l[1], /^SII sin contestar .*id 2$/);
  assert.match(l[2], /^domicilio foral declarado.*SCRUM-1264.*id 2$/);
});

test('SCRUM-1102h · V · el correo del aviso programado lleva las líneas del SII', () => {
  const resultado = { ciego: false, floor: 4, filas: [{ id: 3 }], siiDeclarado: [{ id: 3 }], siiNoConsta: [], foralPendienteAsesor: [] };
  const a = construirAviso({ resultado, host: 'h/b', ahora: new Date('2026-10-23T06:00:00Z') });
  assert.match(a.cuerpo, /merchant id\(s\): 3\nSII declarado \(llevaLibrosPorSii=true\): id 3$/);
});
