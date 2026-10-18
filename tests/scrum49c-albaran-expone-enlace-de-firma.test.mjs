// tests/scrum49c-albaran-expone-enlace-de-firma.test.mjs — SCRUM-49c
//
// LA FICHA DEL ALBARÁN LLEVA SU CREDENCIAL DE FIRMA, Y SÓLO LA FICHA.
//
// El presupuesto y la factura exponen su token público (`payToken`) y la pantalla compone el enlace.
// El albarán no exponía el suyo (`firmaToken`), así que no había forma de copiar el enlace de firma
// desde el panel. Ahora `GET /admin/albaranes/:id` lo devuelve. Tres cosas que no pueden cambiar:
//   · sólo sale si existe: la ruta LEE, no lo genera (lo crea el primer envío para firmar);
//   · un técnico que no es dueño del trabajo sigue recibiendo 404, sin token (SCRUM-467);
//   · `serializeAlbaran`, que usan las listas y otras respuestas, NO lo lleva.
//
// La app REAL (`_banco-camino-real.mjs`) por HTTP, con Prisma doblado.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { montarAppReal, bancoDePrisma, sesionesDe } from './_banco-camino-real.mjs';

const require = createRequire(import.meta.url);
const app = await montarAppReal();
after(() => app.cerrar());
const M = 4903;
const TECNICO = { id: 9, role: 'tecnico', name: 'T', status: 'active', merchantId: M };
const ses = sesionesDe(M, TECNICO);
const TOKEN = 'c'.repeat(32);

const ALBARAN = {
  id: 8, merchantId: M, jobId: 80, numero: 'A-0008', fecha: new Date('2026-10-18T00:00:00Z'),
  modoValoracion: 'SIN_VALORAR', lineas: [], estado: 'emitido', version: 1, firmadoAt: null,
  notas: null, invoiceId: null, enviadoParaFirmaAt: null,
};

/** El trabajo es del técnico sólo si `suyo`. */
async function ficha({ firmaToken, token = ses.PROPIETARIO, suyo = true }) {
  bancoDePrisma().programar({
    authSession: ses.tabla,
    merchant: { findUnique: async () => ({ ...ses.merchant, country: 'ES', email: 'qa4903@test.local', flags: null }) },
    albaran: { findFirst: async () => ({ ...ALBARAN, firmaToken }) },
    job: { findFirst: async () => ({ id: 80, titulo: 'T', direccion: null, customerId: null, quoteId: null, operarioId: suyo ? TECNICO.id : 999, assignedUserId: null, assignees: [] }) },
  });
  return app.pedir(`/admin/albaranes/${ALBARAN.id}`, { token });
}

test('SCRUM-49c · la ficha devuelve el token de firma cuando existe', async () => {
  const r = await ficha({ firmaToken: TOKEN });
  assert.equal(r.status, 200, `suelo: ${r.status} ${r.texto?.slice(0, 200)}`);
  assert.equal(r.json.firmaToken, TOKEN, '🔴 la ficha no lleva la credencial: no se puede copiar el enlace de firma');
});

test('SCRUM-49c · sin envío previo no hay token, y la ficha NO lo genera', async () => {
  const r = await ficha({ firmaToken: null });
  assert.equal(r.status, 200);
  assert.ok(Object.hasOwn(r.json, 'firmaToken'), 'el campo viaja, aunque vacío');
  assert.equal(r.json.firmaToken, null);
  const escrituras = bancoDePrisma().escrituras.filter((e) => e.modelo === 'albaran');
  assert.deepEqual(escrituras, [], '🔴 leer la ficha ha escrito en el albarán');
});

test('SCRUM-49c · 🔴 un técnico que no es dueño del trabajo recibe 404, sin token', async () => {
  const r = await ficha({ firmaToken: TOKEN, token: ses.TECNICO, suyo: false });
  assert.equal(r.status, 404);
  assert.ok(!r.texto.includes(TOKEN), '🔴 la credencial sale en la respuesta de un albarán ajeno');
});

test('SCRUM-49c · control: el técnico dueño del trabajo sí la ve', async () => {
  const r = await ficha({ firmaToken: TOKEN, token: ses.TECNICO, suyo: true });
  assert.equal(r.status, 200, `suelo: ${r.status} ${r.texto?.slice(0, 200)}`);
  assert.equal(r.json.firmaToken, TOKEN);
});

test('SCRUM-49c · 🔴 `serializeAlbaran` (listas y demás respuestas) NO lleva el token', () => {
  const { serializeAlbaran } = require('../dist/modules/jobs/domain/albaran.service.js');
  const s = serializeAlbaran({ ...ALBARAN, firmaToken: TOKEN });
  assert.ok(!Object.hasOwn(s, 'firmaToken'), '🔴 el serializador común expone la credencial');
  assert.ok(!JSON.stringify(s).includes(TOKEN));
});
