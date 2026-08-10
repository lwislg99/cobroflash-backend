// BLOQUE B · TODA ENTRADA DE LA BARRA LATERAL SOBREVIVE A UNA RECARGA.
//
// ────────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO QUE LO TRAE
//
// `albaranes` estaba en la barra desde que C1 (SCRUM-301) le dio sección propia, tenía su `case`
// en el dispatch… y NO estaba en `HASH_VIEWS`. Medido: esa lista se tocó por última vez en
// SCRUM-296 (`libro-registro`) y la sección de albaranes llegó DESPUÉS. **No faltaba por ningún
// motivo: faltaba porque la lista se mantiene a mano y hay TRES sitios que actualizar** —el
// dispatch, el menú y esta lista— y el tercero se olvida.
//
// Lo que costaba: quien recargaba estando en Albaranes, o guardaba el enlace, perdía la vista y
// caía fuera. En una sección de documentos que el cliente firma, perder el enlace no es cosmético.
//
// ⚠️ Este guard mira UNA dirección: barra → hash. La otra —vistas del router sin entrada en la
// barra— es otro ticket y necesita leer los `case` del dispatch distinguiendo los alias de
// compatibilidad (`case 'operarios'` → `return renderView('team')`, SCRUM-136). No se hace aquí.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = path.join(RAIZ, 'public/dashboard/index.html');
const APP = path.join(RAIZ, 'public/dashboard/js/app.js');

/** Las entradas que pinta la barra, leídas del HTML donde están escritas a mano. */
function entradasDeLaBarra() {
  const html = fs.readFileSync(INDEX, 'utf8');
  return [...html.matchAll(/data-view="([a-z-]+)"/g)].map((m) => m[1]);
}

/** Las vistas navegables por hash, leídas de la lista real de `app.js`. */
function vistasPorHash() {
  const js = fs.readFileSync(APP, 'utf8');
  // Se recorta hasta el `]` que cierra: la lista está partida en varias líneas.
  const m = js.match(/const HASH_VIEWS = \[([\s\S]*?)\]/);
  if (!m) return null;
  return [...m[1].matchAll(/'([a-z-]+)'/g)].map((x) => x[1]);
}

test('BLOQUE B · SUELO: se leen las dos listas, o el guard se declara ciego', () => {
  // Sin esto, un cambio de formato en cualquiera de las dos dejaría el test comparando vacíos:
  // verde por no ver nada, que es como un guard deja de vigilar sin que se note.
  const barra = entradasDeLaBarra();
  const hash = vistasPorHash();
  assert.ok(barra.length >= 15,
    `🔴 CIEGO: solo se leen ${barra.length} entradas de la barra en index.html (se esperan ~18). `
    + 'El detector no está mirando: la comparación de abajo no significa nada.');
  assert.ok(hash && hash.length >= 15,
    `🔴 CIEGO: no se ha podido leer \`HASH_VIEWS\` de app.js (${hash ? hash.length : 'null'}). `
    + 'Si cambió de forma, hay que enseñarle la nueva ANTES de fiarse de este archivo.');
});

test('BLOQUE B · 🔴 ninguna entrada de la barra se pierde al recargar', () => {
  const hash = new Set(vistasPorHash() || []);
  const huerfanas = entradasDeLaBarra().filter((v) => !hash.has(v));
  assert.deepEqual(huerfanas, [],
    '🔴 HAY ENTRADAS EN LA BARRA QUE NO SOBREVIVEN A UNA RECARGA.\n\n'
    + '  Quien esté en esa sección y recargue —o guarde el enlace— pierde la vista y cae fuera.\n\n'
    + '  QUÉ HACER: añadir la vista a `HASH_VIEWS` en app.js. Son TRES sitios los que hay que\n'
    + '  tocar al crear una sección (el `case` del dispatch, la entrada del menú y esta lista)\n'
    + '  y el tercero es el que se olvida: así se quedó fuera `albaranes` desde SCRUM-301.\n\n'
    + '  ⚠️ Lo que NO se hace es quitar la entrada de la barra para que el test pase: eso\n'
    + '  esconde la sección en vez de arreglar el enlace.');
});

test('BLOQUE B · las vistas de DETALLE siguen fuera del hash, a propósito', () => {
  // El contrapeso del test anterior: si alguien «arregla» un hueco metiendo en HASH_VIEWS una
  // vista de ficha, el deep-link abriría una ficha SIN id — una pantalla vacía que parece un
  // fallo de datos. Estas se quedan fuera y esto lo deja escrito.
  const hash = vistasPorHash() || [];
  const detalles = hash.filter((v) => /-detail$/.test(v));
  assert.deepEqual(detalles, [],
    `🔴 hay vistas de detalle en \`HASH_VIEWS\`: ${detalles.join(', ')}. Necesitan un id que el `
    + 'hash no lleva, así que el enlace abriría una ficha vacía.');
});
