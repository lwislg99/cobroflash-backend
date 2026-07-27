// SCRUM-124 (r29, recon "prohibiciones sin mecanismo" — SIN gate, corre en `npm test`
// normal, puro: sin BD, sin red, sin servidor): el HTML de /p/:slug (perfil público del
// merchant) NUNCA incluye precios, email, NIF ni dirección.
//
// De dónde sale: el propio publicProfile.routes.ts lo dice en su comentario de cabecera
// ("NUNCA público: precios, clientes, volumen, email, NIF, dirección exacta") — una
// prohibición ESCRITA, hasta ahora sin nada que la hiciera cumplir salvo que el `select`
// de Prisma no pida esos campos. Eso protege HOY, pero no protege de que alguien amplíe el
// `select` (para otra cosa) y el HTML empiece a interpolar un campo sensible sin querer.
//
// Se probó extrayendo la construcción del HTML a una función PURA (buildPublicProfileHtml,
// SCRUM-124 r29 hermano) — así el test no necesita BD ni servidor: le pasa un objeto
// fabricado y mira el HTML que sale.
//
// CANARIO (SCRUM-108, mismo patrón): antes de comprobar la AUSENCIA de los 4 campos
// sensibles, hay que demostrar que el HTML de verdad se construye con datos — si no, un
// bug que dejara el HTML vacío haría pasar los 4 asserts de ausencia sin haber probado
// nada. Por eso el objeto fabricado lleva un canario PÚBLICO (el nombre) que SÍ debe
// aparecer, y cuatro canarios PROHIBIDOS (email/NIF/dirección/precio) con valores únicos
// que NUNCA deben aparecer — ni por casualidad, ni porque alguien reutilice el objeto
// completo del merchant en vez del recorte que la función espera.
import test from 'node:test';
import assert from 'node:assert/strict';

const { buildPublicProfileHtml } = await import('../dist/modules/system/domain/publicProfile.service.js');

const CANARIO_NOMBRE = 'Fontanería CANARIO-PUBLICO S.L.';
const CANARIO_EMAIL = 'canario-prohibido-9f3a@no-existe.test';
const CANARIO_NIF = 'CANARIO-NIF-B12345678';
const CANARIO_DIRECCION = 'CANARIO-DIRECCION Calle Falsa 123, 28080 Madrid';
const CANARIO_PRECIO = 'CANARIO-PRECIO-987654.32'; // approvalThreshold: lo más parecido a "precio" que tiene Merchant

// Objeto DELIBERADAMENTE más ancho que PublicProfileMerchant: simula que alguien, por lo
// que sea, le pasa el merchant COMPLETO en vez del recorte — el test tiene que seguir en
// verde sin que estos 4 campos aparezcan, no solo cuando el caller es disciplinado.
const merchantConDatosSensibles = {
  name: CANARIO_NOMBRE,
  logoUrl: null,
  trade: 'fontanero',
  profileZones: ['Chamberí', 'Retiro'],
  profileYears: 8,
  whatsappPhone: '600111222',
  googleReviewUrl: 'https://g.page/r/ejemplo',
  country: 'ES',
  brandColor: '#16a34a',
  // Campos que la función NO debería leer nunca — presentes a propósito, como si el
  // caller hubiera pasado el Merchant entero de Prisma.
  email: CANARIO_EMAIL,
  taxId: CANARIO_NIF,
  address: CANARIO_DIRECCION,
  approvalThreshold: CANARIO_PRECIO,
};

test('SCRUM-124 (r29): el perfil público construye HTML de verdad (guarda de presencia)', () => {
  const html = buildPublicProfileHtml(merchantConDatosSensibles, { slug: 'test', src: 'profile' });
  assert.ok(typeof html === 'string' && html.length > 0, 'buildPublicProfileHtml no devolvió HTML');
  assert.ok(
    html.includes(CANARIO_NOMBRE),
    'CANARIO ROTO: el nombre del merchant (dato PÚBLICO legítimo) ni siquiera aparece — ' +
      'si esto falla, los asserts de ausencia de abajo no prueban nada: podrían pasar ' +
      'porque el HTML está vacío, no porque el dato sensible se excluya de verdad.',
  );
});

test('SCRUM-124 (r29): el perfil público NUNCA incluye email, NIF, dirección ni precio', () => {
  const html = buildPublicProfileHtml(merchantConDatosSensibles, { slug: 'test', src: 'profile' });

  assert.ok(!html.includes(CANARIO_EMAIL), `🔴 FUGA: el email del merchant aparece en /p/:slug`);
  assert.ok(!html.includes(CANARIO_NIF), `🔴 FUGA: el NIF del merchant aparece en /p/:slug`);
  assert.ok(!html.includes(CANARIO_DIRECCION), `🔴 FUGA: la dirección del merchant aparece en /p/:slug`);
  assert.ok(!html.includes(CANARIO_PRECIO), `🔴 FUGA: un importe (approvalThreshold) aparece en /p/:slug`);
});
