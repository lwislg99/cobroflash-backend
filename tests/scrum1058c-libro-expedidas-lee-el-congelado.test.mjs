// tests/scrum1058c-libro-expedidas-lee-el-congelado.test.mjs — SCRUM-1058c (carril J1)
//
// EL LIBRO DE EXPEDIDAS TIENE QUE DECLARAR EL DESTINATARIO QUE SE CONGELÓ AL EMITIR.
//
// Medido por J1 el 21-oct-2026 (tramo «1058 · visto bueno de J1» de `docs/master/SCRUM-1058.md`):
// `leerLibroExpedidasDelTrimestre` resuelve NIF y nombre del destinatario contra la ficha VIVA del
// cliente (`customer.findMany` por `customerId`), y el `select` del libro ni trae las columnas
// congeladas de la factura. Corregir el NIF de un cliente reescribe así el libro de sus facturas
// pasadas, mientras el PDF y el XML —que pasan por `clienteDelDocumento`— conservan el congelado:
// dos documentos fiscales con dos destinatarios para la misma factura. El defecto de SCRUM-729, en
// un quinto lector.
//
// 🔴 POR LA RUTA MONTADA, NO POR EL HANDLER. Arranca `dist/app.js` entero con el banco de
// SCRUM-597 (`_banco-camino-real.mjs`) y pide `GET /admin/libros/expedidas.csv` con la cookie del
// propietario: pasa por `requireAuth`, `requireRole('admin')` y el montaje de `app.ts` (A10: «un
// test que saca el handler de su ruta prueba el handler, no la ruta»).
//
// ⚠️ EL DOBLE RESPETA EL `select`, y es lo que hace que el verde signifique algo. Prisma sólo
// devuelve las columnas pedidas; un doble que devolviera la fila entera daría el congelado a un
// lector que nunca lo pidió. Aquí `invoice.findMany` y `customer.findMany` proyectan por
// `args.select` y filtran por `merchantId` (y `customer` además por `id in`).
//
// ⚠️ LAS COLUMNAS CONGELADAS LAS ESCRIBE LA FUNCIÓN DE LA CASA (`congelarDesdeFicha`), no el test:
// si un día cambia qué se congela, esta muestra cambia con ella.
//
// POBLACIÓN: 2 facturas del 3T-2026 del merchant 1058, un tipo de IVA cada una → 2 filas; más 1
// factura de otro merchant que la consulta no debe traer. Se comprueba contando las filas del CSV
// por número (conjunto, no cuenta) antes de mirar ningún NIF.
//
// HOY CAE el caso «ficha cambiada» (por eso esta rama NO se empuja hasta que el fundador dé el GO
// del arreglo, que va aparte en `docs/master/evidencias/SCRUM-1058/arreglo-1058c.diff`). Los demás
// casos pasan hoy y tienen que seguir pasando con el arreglo puesto.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { montarAppReal, bancoDePrisma, sesionesDe } from './_banco-camino-real.mjs';

const require = createRequire(import.meta.url);
const app = await montarAppReal();
after(() => app.cerrar());

const MIO = 1058;
const OTRO = 1059;
const ses = sesionesDe(MIO, { id: 9, role: 'tecnico', merchantId: MIO });

const { congelarDesdeFicha, CAMPOS_CONGELADOS } = require('../dist/modules/invoicing/domain/clienteCongelado.js');
const { COLUMNAS_EXPEDIDAS } = require('../dist/modules/fiscal/librosAeat/librosAeat.js');
const { CSV_SEPARADOR } = require('../dist/modules/exports/domain/exportData.js');

const DIA = new Date('2026-08-10T10:00:00.000Z'); // 3T-2026
const RUTA = '/admin/libros/expedidas.csv?a%C3%B1o=2026&trimestre=3';

/** La ficha del día de la emisión, y la de después de corregirla. */
const FICHA_AL_EMITIR = { id: 10, merchantId: MIO, name: 'Fusionado', legalName: 'Fusionado SL', taxId: 'B11111111', email: null, phone: null };
const FICHA_CORREGIDA = { ...FICHA_AL_EMITIR, name: 'Principal', legalName: 'Principal SA', taxId: 'B22222222' };

const factura = (id, merchantId, number, congelado) => ({
  id, merchantId, number, createdAt: DIA, paidAt: DIA, type: 'F1',
  total: 121, currency: 'EUR', status: 'paid',
  customerId: 10, quoteId: null, chargeId: null, albaranRefs: null,
  lines: [{ concept: 'Trabajo', qty: 1, price: 100, tax: 0.21 }],
  vfHash: 'h' + id,
  // Las cinco columnas: congeladas por la función de la casa, o a NULL (factura anterior al escritor).
  ...(congelado ? congelarDesdeFicha(congelado) : Object.fromEntries(CAMPOS_CONGELADOS.map((c) => [c, null]))),
});

/** F-CONG se emitió con el congelado; F-ANTIGUA es anterior al escritor (columnas a NULL). */
const FACTURAS = [
  factura(1, MIO, 'F-CONG', FICHA_AL_EMITIR),
  factura(2, MIO, 'F-ANTIGUA', null),
  factura(3, OTRO, 'F-AJENA', { ...FICHA_AL_EMITIR, merchantId: OTRO, taxId: 'B99999999' }),
];

/** Proyecta una fila por el `select` de Prisma: sólo lo pedido llega al lector. */
function proyectar(fila, select) {
  if (!select) return { ...fila };
  return Object.fromEntries(Object.keys(select).filter((k) => select[k] && k in fila).map((k) => [k, fila[k]]));
}

function programar(ficha) {
  const fichas = [ficha];
  bancoDePrisma().programar({
    authSession: ses.tabla,
    merchant: { findUnique: async () => ({ ...ses.merchant, country: 'ES', taxId: 'B00000000', flags: null, criterioCaja: null }) },
    invoice: {
      findMany: async (a) => FACTURAS
        .filter((f) => f.merchantId === a?.where?.merchantId)
        .map((f) => proyectar(f, a?.select)),
    },
    customer: {
      findMany: async (a) => {
        const ids = a?.where?.id?.in;
        return fichas
          .filter((c) => c.merchantId === a?.where?.merchantId && (!Array.isArray(ids) || ids.includes(c.id)))
          .map((c) => proyectar(c, a?.select));
      },
    },
  });
}

/** Lee el CSV del libro: filas por número de factura, con las columnas por su clave. */
function leerCsv(texto) {
  const lineas = texto.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l !== '');
  const cabecera = lineas[0].split(CSV_SEPARADOR);
  const idx = Object.fromEntries(COLUMNAS_EXPEDIDAS.map((c) => [c.clave, cabecera.indexOf(c.rotulo)]));
  for (const [clave, i] of Object.entries(idx)) assert.ok(i >= 0, `suelo: la cabecera no trae «${clave}»: ${lineas[0]}`);
  const porNumero = new Map();
  for (const l of lineas.slice(1)) {
    const c = l.split(CSV_SEPARADOR);
    porNumero.set(c[idx.serieNumero], { nif: c[idx.nifDestinatario], nombre: c[idx.nombreDestinatario] });
  }
  return porNumero;
}

async function pedirLibro(ficha) {
  programar(ficha);
  const r = await app.pedir(RUTA, { token: ses.PROPIETARIO });
  assert.equal(r.status, 200, `suelo: ${RUTA} → ${r.status} ${String(r.texto).slice(0, 200)}`);
  return r;
}

test('SCRUM-1058c · suelo: la ruta montada responde y declara su población (las 2 facturas del merchant, nada ajeno)', async () => {
  const { app: expressApp } = require('../dist/app.js');
  assert.ok(expressApp, 'suelo: dist/app.js no exporta la app');
  programar(FICHA_AL_EMITIR);
  const r = await app.pedir(RUTA, { token: ses.PROPIETARIO });
  assert.equal(r.status, 200, `suelo: ${r.status} ${String(r.texto).slice(0, 200)}`);
  const filas = leerCsv(r.texto);
  assert.deepEqual([...filas.keys()].sort(), ['F-ANTIGUA', 'F-CONG'], 'población: las dos facturas del merchant, y la ajena fuera');
});

test('SCRUM-1058c · el control: con la ficha SIN cambiar, la factura congelada sale con su NIF y su razón social', async () => {
  const filas = leerCsv((await pedirLibro(FICHA_AL_EMITIR)).texto);
  assert.deepEqual(filas.get('F-CONG'), { nif: 'B11111111', nombre: 'Fusionado SL' });
});

test('SCRUM-1058c · 🔴 con la ficha CORREGIDA, la factura congelada sigue declarando el destinatario del día de la emisión', async () => {
  const r = await pedirLibro(FICHA_CORREGIDA);
  assert.equal(r.status, 200);
  const filas = leerCsv(r.texto);
  assert.equal(filas.size, 2, `población: ${[...filas.keys()].join(', ')}`);
  assert.deepEqual(filas.get('F-CONG'), { nif: 'B11111111', nombre: 'Fusionado SL' },
    '🔴 el libro de expedidas ha reescrito el destinatario de una factura emitida con la ficha de HOY: '
    + 'el PDF y el XML de la misma factura dicen B11111111 (clienteDelDocumento) y el libro otra cosa. '
    + 'El libro tiene que leer las columnas congeladas de la factura, como los otros cuatro lectores.');
});

test('SCRUM-1058c · la factura anterior al escritor (columnas a NULL) sigue saliendo con la ficha viva, la de hoy', async () => {
  const filas = leerCsv((await pedirLibro(FICHA_CORREGIDA)).texto);
  assert.deepEqual(filas.get('F-ANTIGUA'), { nif: 'B22222222', nombre: 'Principal SA' });
});

test('SCRUM-1058c · el libro sólo LEE: ninguna escritura en el banco', async () => {
  await pedirLibro(FICHA_CORREGIDA);
  assert.deepEqual(bancoDePrisma().escrituras, []);
});
