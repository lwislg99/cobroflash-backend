// SCRUM-163 — `PUBLIC_BASE_URL` tiene que ser una URL de verdad.
//
// Nace de un fallo real: staging llevaba el PLACEHOLDER LITERAL de las instrucciones
// (`https://<TU-URL-DE-STAGING>`). Como esa variable es la raíz de todo enlace absoluto que
// genera el sistema, quedaron rotos los enlaces de pago, los recibos y los magic links de
// acceso e invitación — y `confirm-bizum` devolvía 500, porque se llama a sí mismo por
// `${BASE_URL}/webhooks/psp`: el pro no podía confirmar un Bizum que el cliente ya había pagado.
//
// Se prueba la función PURA (sin arrancar la app ni tocar process.env), que es donde vive la
// decisión. El cableado del arranque va en `index.ts`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { invalidPublicBaseUrl } from '../dist/core/config/env.js';

test('SCRUM-163: caza el placeholder EXACTO que tenía staging', () => {
  const motivo = invalidPublicBaseUrl('https://<TU-URL-DE-STAGING>');
  assert.ok(motivo, 'el valor que rompió staging debe rechazarse');
  assert.match(motivo, /placeholder/i, `el motivo debe explicar qué pasa, y fue: ${motivo}`);
});

test('SCRUM-163: caza el resto de valores sin sustituir o inservibles', () => {
  const malos = [
    '',                              // vacía
    '   ',                           // solo espacios
    'https://<PON-TU-URL>',          // cualquier <…>
    'https://TU-URL-DE-PRODUCCION',  // marcador sin ángulos
    'https://example.com',           // dominio de ejemplo
    'yaqu.app',                      // sin esquema → no es URL
    'ftp://yaqu.app',                // esquema que no sirve para enlaces web
    'no es una url',
  ];
  for (const v of malos) {
    assert.ok(invalidPublicBaseUrl(v), `debería rechazarse: ${JSON.stringify(v)}`);
  }
});

test('SCRUM-163: NO estorba a los valores legítimos (incluido el default de dev)', () => {
  const buenos = [
    'https://yaqu.app',
    'https://yaqu-staging-production.up.railway.app',
    'http://localhost:3000',   // default de dev: no debe reventar el arranque local
    'https://yaqu.app/',       // con barra final
  ];
  for (const v of buenos) {
    assert.equal(invalidPublicBaseUrl(v), null, `debería aceptarse: ${v} (motivo: ${invalidPublicBaseUrl(v)})`);
  }
});
