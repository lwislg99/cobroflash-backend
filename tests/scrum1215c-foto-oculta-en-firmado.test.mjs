// tests/scrum1215c-foto-oculta-en-firmado.test.mjs — SCRUM-1215 (lote 3, firma c.17494)
//
// «📷 Añadir foto» se ofrecía en el «⋮» de un albarán FIRMADO, y en ese estado el servidor
// responde SIEMPRE 409 `albaran_locked`. Era un botón cuya única respuesta posible es un error.
//
// Lo que se fija aquí son las DOS mitades a la vez, porque la tabla por sí sola no dice por qué:
//   1. el servidor sigue rechazando la foto en `firmado` (si un día la admite, este test lo dice y
//      el botón se puede volver a ofrecer: la ocultación deja de tener motivo);
//   2. la tabla del registro NO la ofrece en `firmado`, y SÍ en borrador y emitido, donde funciona.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const { ALBARAN_ACTION_REGISTRY } = require(path.join(RAIZ, 'public/dashboard/js/albaranActionsRegistry.js'));

// El handler de la ruta, sin comentarios: un guard por texto casaría con el comentario que lo explica.
function handlerDeFotos() {
  const src = fs.readFileSync(path.join(RAIZ, 'src/modules/jobs/app/routes/albaranes.routes.ts'), 'utf8');
  const i = src.indexOf("router.post('/:id/fotos'");
  assert.ok(i >= 0, '🔴 no encuentro `router.post(\'/:id/fotos\'` en albaranes.routes.ts: no puedo mirar, que no es lo mismo que «no hay nada»');
  const j = src.indexOf('router.', i + 10);
  return src.slice(i, j < 0 ? undefined : j)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

test('SCRUM-1215 · el servidor rechaza la foto en un albarán firmado (el motivo de ocultarla)', () => {
  const h = handlerDeFotos();
  assert.match(h, /albaran\.estado\s*===\s*'firmado'/,
    '🔴 el POST de fotos ya no mira `firmado`. Si ahora admite fotos en un albarán firmado, la ' +
    'ocultación de `btnFoto` en `albaranActionsRegistry.js` ha perdido su motivo: revísala.');
  assert.match(h, /status\(409\)[\s\S]{0,80}albaran_locked/,
    '🔴 el rechazo en `firmado` ya no es 409 `albaran_locked`');
});

test('SCRUM-1215 · la tabla no ofrece «Añadir foto» en firmado, y sí donde funciona', () => {
  const foto = ALBARAN_ACTION_REGISTRY.find((a) => a.id === 'btnFoto');
  assert.ok(foto, '🔴 `btnFoto` ha desaparecido del registro');
  assert.equal(foto.destinos.firmado, 'oculta',
    '🔴 `btnFoto` vuelve a ofrecerse en `firmado`, donde el servidor responde siempre 409');
  assert.equal(foto.destinos.borrador, 'overflow', '🔴 `btnFoto` ya no se ofrece en borrador, donde sí funciona');
  assert.equal(foto.destinos.emitido, 'overflow', '🔴 `btnFoto` ya no se ofrece en emitido, donde sí funciona');
});
