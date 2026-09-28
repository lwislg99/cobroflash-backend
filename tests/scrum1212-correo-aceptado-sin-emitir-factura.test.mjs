// tests/scrum1212-correo-aceptado-sin-emitir-factura.test.mjs — SCRUM-1212 (punto 1)
//
// 🔴 EL CORREO «PRESUPUESTO ACEPTADO» DECÍA «Ya puedes emitir la factura.» A TODOS.
//
// Con `INVOICING_ES_ENABLED` en OFF, un merchant ES real no puede emitir factura por YaQu (regla 24):
// esa frase es una afirmación fiscal FALSA. Decisión del orquestador (28-sep): se OCULTA, no se
// reescribe (patrón de SCRUM-1160), con el mismo criterio que `facturaFiscalDisponible()` del panel:
// sólo en modo `fiscal` o `demo`, y con el modo desconocido, fuera (falla cerrado, SCRUM-905).
//
// EL VIAJE ENTERO, no la función suelta: merchant → `modoEmisionVisible` (la fuente única, real) →
// `sendMerchantQuoteAcceptedEmail` (real) → el HTML que se entregaría. Solo se dobla el EMISOR de
// correo (`enviarCorreo`): ⛔ ni un byte de red, ni una base.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(import.meta.url);
const rutaDe = (r) => requiere.resolve(path.join(RAIZ, r));

const FRASE = 'Ya puedes emitir la factura.';
const enviados = [];
{
  const f = rutaDe('dist/integrations/enviarCorreo.js');
  requiere.cache[f] = {
    id: f, filename: f, loaded: true,
    exports: {
      enviarCorreo: async (a) => { enviados.push(a); return { enviado: true, proveedor: 'doble' }; },
      resultadoSinDestino: () => ({ enviado: false, motivo: 'sin_destino' }),
    },
  };
  delete requiere.cache[rutaDe('dist/modules/messaging/domain/merchantNotifications.js')];
}
const { sendMerchantQuoteAcceptedEmail } = requiere(path.join(RAIZ, 'dist/modules/messaging/domain/merchantNotifications.js'));
const { modoEmisionVisible } = requiere(path.join(RAIZ, 'dist/modules/invoicing/domain/modoVisible.js'));

// El entorno no puede decidir por el test: el flag se lee del merchant, no de la máquina.
delete process.env.INVOICING_ES_ENABLED;

async function correoPara(merchant) {
  enviados.length = 0;
  await sendMerchantQuoteAcceptedEmail({
    merchantId: merchant?.id ?? 7, merchantEmail: 'pro@example.invalid', merchantName: 'Fontanería QA',
    customerName: 'Cliente QA', quoteId: 41, total: '100.00', currency: 'EUR',
    modoEmision: modoEmisionVisible(merchant),
  });
  assert.equal(enviados.length, 1, '🔴 CIEGO: el doble no ha visto el correo, así que no se mide nada');
  return enviados[0].html;
}

test('🔴 SCRUM-1212 · ES real con INVOICING_ES_ENABLED en OFF → «Ya puedes emitir la factura» NO sale', async () => {
  const merchant = { id: 7, email: 'pro@example.invalid', country: 'ES', flags: {} };
  assert.equal(modoEmisionVisible(merchant), 'receipt', 'premisa: sin el flag, un ES real va en justificante');
  const html = await correoPara(merchant);
  assert.ok(!html.includes(FRASE), '🔴 el correo le dice a un ES sin facturación que emita la factura (regla 24)');
  // Control positivo: el resto del correo sigue ahí (se oculta UNA frase, no se vacía el correo).
  assert.ok(html.includes('Presupuesto aceptado'), '🔴 el correo se ha quedado sin su contenido');
});

test('🔴 SCRUM-1212 · modo desconocido (sin merchant) → tampoco sale: falla cerrado', async () => {
  const html = await correoPara(null);
  assert.ok(!html.includes(FRASE), '🔴 no saber el modo ha autorizado una afirmación fiscal');
});

test('SCRUM-1212 · con el flag en ON (modo fiscal) la frase SIGUE — control positivo del criterio', async () => {
  const merchant = { id: 7, email: 'pro@example.invalid', country: 'ES', flags: { INVOICING_ES_ENABLED: true } };
  assert.equal(modoEmisionVisible(merchant), 'fiscal');
  assert.ok((await correoPara(merchant)).includes(FRASE), '🔴 se ha borrado la frase también donde es cierta');
});

test('SCRUM-1212 · el merchant demo (modo demo) la conserva, igual que el panel', async () => {
  const merchant = { id: 1, email: 'demo@yaqu.app', country: 'ES', flags: {} };
  assert.equal(modoEmisionVisible(merchant), 'demo');
  assert.ok((await correoPara(merchant)).includes(FRASE));
});
