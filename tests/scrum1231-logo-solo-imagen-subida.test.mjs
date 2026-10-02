// tests/scrum1231-logo-solo-imagen-subida.test.mjs — SCRUM-1231
//
// 🔴 PRIVACIDAD DEL CLIENTE FINAL. `logoUrl` admitía una URL cualquiera, y seis páginas públicas
// (Bizum, selector de pago, albarán, portal, aceptación del presupuesto, perfil público) la pintan
// en un `<img src>`: el navegador del cliente final conectaba con un servidor elegido por el
// profesional, que ninguna política de privacidad puede nombrar. Decisión de Javier (28-sep-2026):
// solo imagen subida. La subida ya existía; el arreglo es QUITAR la rama `z.string().url()`.
//
// Y lo que se midió al quitarla, que el ticket no decía:
//   · `url()` no era «http(s)»: aceptaba cualquier esquema. Por ahí pasaba un `data:` de cualquier
//     tipo y tamaño (se saltaba el tope de 1,5M de la otra rama) y un `javascript:`.
//   · La cuenta demo guarda un `data:image/svg+xml` sembrado SIN pasar por el esquema
//     (`scripts/seed-demo.mjs`). Configuración manda `logoUrl` siempre: sin la segunda mitad de
//     este arreglo, la demo no podría volver a guardar NADA de su perfil (SCRUM-1161 otra vez).
//
// ⛔ Sin red ni base. ⚠️ SUELO: la ruta `PUT /admin/merchant` no se ejecuta aquí (vive en `app.ts`,
// que arranca el servidor entero); se prueban sus dos piezas y se comprueba, sobre el código sin
// comentarios, que la ruta las usa y filtra por `req.merchantId`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { soloCodigo } from './_solo-codigo.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const { merchantProfileUpdateSchema, sinLogoHeredadoIntacto } = await import('../dist/core/validation/schemas.js');

const PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const SUBIDAS = {
  png: `data:image/png;base64,${PIXEL}`,
  jpeg: `data:image/jpeg;base64,${PIXEL}`,
  jpg: `data:image/jpg;base64,${PIXEL}`,
  webp: `data:image/webp;base64,${PIXEL}`,
};
const NO_SUBIDAS = {
  'URL https externa': 'https://logos.example.invalid/mi-logo.png',
  'URL http externa': 'http://logos.example.invalid/mi-logo.png',
  'URL sin esquema (//)': '//logos.example.invalid/mi-logo.png',
  'data: de un tipo no admitido (SVG)': `data:image/svg+xml;base64,${PIXEL}`,
  'data: que no es imagen': `data:text/html;base64,${PIXEL}`,
  'esquema javascript:': 'javascript:void(0)',
  'ruta local': '/logo-demo.png',
};

/** Lo que hace la ruta, con el logo guardado dado: valida, y si cae por el logo, reintenta sin el heredado intacto. */
function comoLaRuta(body, logoGuardado) {
  let r = merchantProfileUpdateSchema.safeParse(body);
  if (!r.success && r.error.issues.some((i) => i.path[0] === 'logoUrl')) {
    r = merchantProfileUpdateSchema.safeParse(sinLogoHeredadoIntacto(body, logoGuardado));
  }
  return r;
}

test('SCRUM-1231 · CONTROL POSITIVO: la imagen subida sigue entrando (png, jpeg, jpg, webp), y quitar el logo también', () => {
  for (const [tipo, uri] of Object.entries(SUBIDAS)) {
    const r = merchantProfileUpdateSchema.safeParse({ logoUrl: uri });
    assert.equal(r.success, true, `🔴 la imagen subida en ${tipo} ya no entra: el arreglo ha cerrado de más`);
    assert.equal(r.data.logoUrl, uri);
  }
  assert.equal(merchantProfileUpdateSchema.safeParse({ logoUrl: null }).data.logoUrl, null, '🔴 «Quitar» ya no funciona');
  assert.equal('logoUrl' in merchantProfileUpdateSchema.safeParse({}).data, false);
});

test('🔴 SCRUM-1231 · nada que no sea una imagen subida entra como logo', () => {
  const colados = Object.entries(NO_SUBIDAS)
    .filter(([, v]) => merchantProfileUpdateSchema.safeParse({ logoUrl: v }).success)
    .map(([k]) => k);
  assert.equal(Object.keys(NO_SUBIDAS).length, 7, 'la población de este test son 7 casos');
  assert.deepEqual(colados, [], '🔴 el navegador del cliente final volvería a ir a donde diga el profesional');
});

test('🔴 SCRUM-1231 · el tope de tamaño ya no se puede rodear', () => {
  const enorme = `data:image/png;base64,${'A'.repeat(1_500_001)}`;
  assert.equal(merchantProfileUpdateSchema.safeParse({ logoUrl: enorme }).success, false,
    '🔴 un data: de más de 1,5M entra (antes pasaba por la rama `url()`)');
});

test('🔴 SCRUM-1231 · un logo heredado que vuelve SIN TOCAR no tumba el guardado, y no se reescribe', () => {
  for (const [caso, heredado] of Object.entries(NO_SUBIDAS)) {
    const r = comoLaRuta({ name: 'Fontanería QA', iban: null, logoUrl: heredado }, heredado);
    assert.equal(r.success, true, `🔴 con un logo heredado (${caso}) no se puede guardar nada del perfil`);
    assert.equal(r.data.name, 'Fontanería QA', 'el resto del formulario se guarda');
    assert.equal('logoUrl' in r.data, false, '🔴 el heredado no se reescribe: se deja como está');
  }
});

test('🔴 SCRUM-1231 · pero CAMBIAR a otra URL externa se rechaza, con o sin heredado (mutante: retirar siempre)', () => {
  const vieja = NO_SUBIDAS['URL https externa'];
  const nueva = 'https://otro.example.invalid/logo.png';
  assert.equal(comoLaRuta({ name: 'X', logoUrl: nueva }, vieja).success, false, '🔴 se cuela una URL externa NUEVA');
  assert.equal(comoLaRuta({ name: 'X', logoUrl: nueva }, null).success, false);
  assert.equal(comoLaRuta({ name: 'X', logoUrl: nueva }, undefined).success, false);
  assert.equal(comoLaRuta({ name: 'X', logoUrl: '' }, '').success, false, 'una cadena vacía no es «el heredado»');
  // y desde un heredado se puede pasar a una imagen subida, o quitarlo
  assert.equal(comoLaRuta({ logoUrl: SUBIDAS.png }, vieja).data.logoUrl, SUBIDAS.png);
  assert.equal(comoLaRuta({ logoUrl: null }, vieja).data.logoUrl, null);
});

test('SCRUM-1231 · `sinLogoHeredadoIntacto` no toca lo que no es suyo', () => {
  const body = { name: 'X', logoUrl: 'https://a.example.invalid/l.png' };
  assert.equal(sinLogoHeredadoIntacto(body, 'https://b.example.invalid/l.png'), body);
  assert.deepEqual(sinLogoHeredadoIntacto(body, body.logoUrl), { name: 'X' });
  assert.deepEqual(body, { name: 'X', logoUrl: 'https://a.example.invalid/l.png' }, 'no muta el cuerpo recibido');
  for (const raro of [null, undefined, 'texto', 7, ['a']]) assert.equal(sinLogoHeredadoIntacto(raro, 'x'), raro);
});

test('SCRUM-1231 · la ruta PUT /admin/merchant usa las dos piezas y lee el logo de SU merchant (regla 2)', () => {
  const app = soloCodigo(fs.readFileSync(path.join(RAIZ, 'src/app.ts'), 'utf8'), 'app.ts');
  const i = app.indexOf("app.put('/admin/merchant'");
  assert.ok(i >= 0, '🔴 CIEGO: no encuentro la ruta PUT /admin/merchant en app.ts');
  const ruta = app.slice(i, app.indexOf('\napp.', i + 10));
  assert.ok(ruta.length > 200, `🔴 CIEGO: el bloque de la ruta mide ${ruta.length}`);
  assert.match(ruta, /sinLogoHeredadoIntacto\(req\.body,\s*actual\?\.logoUrl\)/, '🔴 la ruta no reintenta sin el logo heredado');
  assert.match(ruta, /where:\s*\{\s*id:\s*req\.merchantId\s*\}/, '🔴 el logo guardado no se lee por req.merchantId');
  assert.match(ruta, /path\[0\]\s*===\s*'logoUrl'/, '🔴 el reintento ya no está condicionado a que falle el logo');
});
