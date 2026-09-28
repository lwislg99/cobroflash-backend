// tests/scrum1227-perfil-ida-y-vuelta.test.mjs — SCRUM-1227
//
// 🔴 PÉRDIDA DE DATOS SILENCIOSA: guardar CUALQUIER ajuste en Configuración borraba las cláusulas del
// presupuesto, los bloques de la Home, el criterio de caja y la retención IRPF.
//
// La cadena: `getMerchantProfile` tiene un `select` EXPLÍCITO y cinco campos que el PUT escribe no
// salían en el GET → la pantalla los recibía vacíos → el formulario los manda SIEMPRE al guardar
// (`settingsView.js`, `const payload = {…}`) → se machacaban con el vacío.
//
// LA LECCIÓN, y por eso este test es una IDA Y VUELTA y no otra comprobación de escritura:
// `scrum656b` probaba que el PUT ACEPTA las cláusulas, no que el GET las DEVUELVA. Media vuelta
// probada es lo mismo que ninguna cuando el defecto está en la otra media.
//
// El criterio se DERIVA de la pantalla: las claves se leen del `payload` de `settingsView.js`, así
// que un campo nuevo en el formulario sin su línea en el `select` pone esto rojo. ⛔ Sin red ni base.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const moduloPrisma = await import('../dist/core/db/prisma.js');
const { getMerchantProfile, updateMerchantProfile } = await import('../dist/modules/system/merchantAdmin.js');

/** Las claves que Configuración manda al guardar, leídas de su `payload`. */
function clavesQueGuardaLaPantalla() {
  const sv = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/settingsView.js'), 'utf8');
  const i = sv.indexOf('const payload = {');
  assert.ok(i >= 0, '🔴 CIEGO: no encuentro el `payload` del guardado de Configuración');
  const cuerpo = sv.slice(i, sv.indexOf('\n      };', i));
  return [...cuerpo.matchAll(/^\s{8}(\w+):/gm)].map((m) => m[1]);
}

// Lo que el profesional tiene guardado y el formulario le devolvería al servidor.
const GUARDADO = {
  name: 'Fontanería QA', legalName: 'Fontanería QA SL', taxId: 'B00000000', address: 'C/ Mayor 1',
  criterioCaja: true, whatsappPhone: '34600000000', defaultCurrency: 'EUR', invoiceSeriesPrefix: 'CF',
  retencionIrpfDeclarada: true, retencionIrpfTipo: 15, logoUrl: null, googleReviewUrl: null,
  country: 'ES', iban: null, clabe: null, bizumPhone: null,
  notifyEmailOnPaid: true, notifyEmailOnQuoteAccepted: false, notifyEmailWeeklyDigest: true,
  homePrefs: { showTechPhotoToClient: true, bloqueCobros: false },
  brandColor: null, approvalThreshold: null,
  clausulasPresupuesto: [{ id: 'garantia', titulo: 'Garantía', texto: 'Seis meses sobre la mano de obra.' }],
};

function baseQueRecuerda() {
  const fila = { id: 7, email: 'pro@example.invalid', timezone: null, flags: null };
  moduloPrisma.prisma.merchant = {
    // Respeta el `select` como la base de verdad: lo que no se pide, no sale.
    findUnique: async ({ select }) => Object.fromEntries(
      Object.keys(select).filter((k) => select[k]).map((k) => [k, k in fila ? fila[k] : null]),
    ),
    update: async ({ data }) => Object.assign(fila, data),
  };
  moduloPrisma.prisma.invoice = { findMany: async () => [] };
}

const originales = { merchant: moduloPrisma.prisma.merchant, invoice: moduloPrisma.prisma.invoice };
test.after(() => Object.assign(moduloPrisma.prisma, originales));

test('SCRUM-1227 · el banco cubre TODO lo que la pantalla guarda (si no, lo de abajo mide de menos)', () => {
  const claves = clavesQueGuardaLaPantalla();
  assert.ok(claves.length >= 20, `🔴 CIEGO: solo leo ${claves.length} claves del payload`);
  const sinValor = claves.filter((k) => !(k in GUARDADO));
  assert.deepEqual(sinValor, [], '🔴 la pantalla guarda campos que este test no prueba: añádelos a GUARDADO');
});

test('🔴 SCRUM-1227 · IDA Y VUELTA: todo lo que Configuración guarda vuelve en el GET', async () => {
  baseQueRecuerda();
  await updateMerchantProfile(7, structuredClone(GUARDADO));
  const perfil = await getMerchantProfile(7);
  const perdidos = clavesQueGuardaLaPantalla().filter((k) => !(k in perfil));
  assert.deepEqual(perdidos, [],
    '🔴 estos campos se GUARDAN y no VUELVEN: la pantalla los recibe vacíos y el siguiente guardado '
    + 'de cualquier ajuste los borra. Añádelos al `select` de `getMerchantProfile`.');
});

test('🔴 SCRUM-1227 · y vuelven CON SU VALOR: cláusulas, Home, criterio de caja y retención', async () => {
  baseQueRecuerda();
  await updateMerchantProfile(7, structuredClone(GUARDADO));
  const p = await getMerchantProfile(7);
  assert.deepEqual(p.clausulasPresupuesto.map((c) => c.id), ['garantia'], '🔴 las cláusulas no vuelven');
  assert.deepEqual(p.homePrefs, GUARDADO.homePrefs, '🔴 la Home no vuelve: la «fusión» de SCRUM-1042 fusiona contra vacío');
  assert.equal(p.criterioCaja, true, '🔴 el criterio de caja vuelve como «no consta»');
  assert.equal(p.retencionIrpfDeclarada, true);
  assert.equal(p.retencionIrpfTipo, 15, '🔴 la retención IRPF vuelve como «no consta»');
});
