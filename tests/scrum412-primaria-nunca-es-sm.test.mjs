// SCRUM-412 · NINGUNA ACCIÓN PRIMARIA DE PANTALLA PUEDE SER `btn-sm`.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA REGLA BUENA, Y POR QUÉ NO ES «NO EXISTE btn-sm»
//
// SCRUM-380 arregló el CTA del Trabajo y dejó censados 12 usos más de `btn-primary btn-sm`. El
// guard de entonces los DECLARABA sin prohibirlos, a propósito: **un guard no distingue una
// primaria de pantalla de una acción de fila, y una persona sí**. Convertirlo en prohibición
// entonces habría puesto once pantallas en rojo de golpe, que es un rediseño encubierto.
//
// Aquí se cierra ese hueco: las doce están clasificadas UNA POR UNA con el criterio del fundador
// —«es primaria si es la acción que la pantalla existe para que hagas; si al quitarla la pantalla
// sigue teniendo sentido, no lo es»—. Las que eran primaria pierden el `btn-sm`; las demás se
// quedan **declaradas con su motivo**, abajo.
//
// ⚠️ SCRUM-352 NO SE TOCA: `btn-sm` sigue midiendo 30 px y su control negativo sigue verde. Lo
// que se prohíbe no es el tamaño pequeño: es que la acción principal lo lleve.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(RAIZ, 'public/dashboard/js');

/**
 * LAS DIEZ QUE SE QUEDAN, con su motivo. La clave es `fichero:variable`, NO el número de línea:
 * un censo anclado a líneas caduca al primer commit y obliga a reeditarlo por nada.
 *
 * Clasificadas el 10-ago-2026 leyendo cada sitio. Las dos que faltan —`btnBizum` del detalle de
 * factura y `+ Nuevo justificante` del listado— eran PRIMARIA y perdieron el `btn-sm`.
 */
const DECLARADAS = {
  'invoiceDetailView.js:btnPdf':
    'FILA/secundaria. No es primaria y no lo dice mi gusto: `invoiceActionsRegistry` la declara '
    + '`secundaria` en los CUATRO estados. ⚠️ Que esté pintada con `btn-primary` contradice al '
    + 'registro — hallazgo aparte, no se arregla aquí para no mezclar dos cosas en un ticket.',
  'jobDetailView.js:consolidaConfirm':
    'BARRA DE SELECCIÓN. Aparece solo al entrar en modo selección; la pantalla del Trabajo tiene '
    + 'sentido completo sin ella.',
  'jobDetailView.js:goM':
    'MODAL de rotura por mes. Es la confirmación de un diálogo, no la acción de la pantalla.',
  'jobDetailView.js:bz':
    'FILA de cobro. Es el segundo toque del Bizum dentro de una fila, no la acción del Trabajo.',
  'jobDetailView.js:save':
    'MODAL (sheet del editor de albarán). «Guardar cambios» de un diálogo.',
  'quoteRequestsView.js:btnQuote':
    'FILA. Va dentro de la tarjeta de CADA solicitud: hay tantos como solicitudes.',
  'quotesDetailView.js:btnGuardar':
    'MODAL/editor de tramos. Confirma una edición abierta, no es lo que la pantalla existe para hacer.',
  'quotesListView.js:btnApprove':
    'FILA. Un «✓ Aprobar» por cada presupuesto pendiente de la lista.',
  'templatesView.js:btnUse':
    'FILA. Un «Usar» por cada plantilla.',
  'signaturePad.js:okBtn':
    'MODAL de firma. ⚠️ DECLARADO CON DUDA, y se dice en vez de decidirlo solo: es un modal, pero '
    + 'lo pulsa el CLIENTE en una obra y es el momento más irrepetible del producto (SCRUM-404). '
    + 'Si el fundador decide que un modal así cuenta como primaria, sale de esta lista.',
};

/** Todos los `btn-primary btn-sm` que hay, con el nombre de su variable. */
function censo() {
  const out = [];
  for (const f of fs.readdirSync(DIR)) {
    if (!f.endsWith('.js')) continue;
    const lineas = fs.readFileSync(path.join(DIR, f), 'utf8').split('\n');
    lineas.forEach((l, i) => {
      const m = l.match(/(\w+)\.className\s*=\s*['"]btn-primary btn-sm['"]/);
      if (m) out.push({ clave: `${f}:${m[1]}`, fichero: f, linea: i + 1 });
    });
  }
  return out;
}

test('SCRUM-412 · SUELO: el censo sigue viendo los botones', () => {
  // Si el detector dejara de encontrarlos, la prohibición de abajo pasaría por no ver nada — que
  // es exactamente como un guard deja de vigilar sin que se note.
  const c = censo();
  assert.ok(c.length > 0, '🔴 el censo no encuentra ningún `btn-primary btn-sm`: el detector no mira');
});

test('SCRUM-412 · 🔴 PROHIBICIÓN: un `btn-primary btn-sm` nuevo tiene que declararse', () => {
  // La regla es «ninguna acción PRIMARIA DE PANTALLA puede ser btn-sm», no «no existe btn-sm».
  // Como el guard no sabe distinguirlas, lo que exige es que cada una esté CLASIFICADA por una
  // persona: si aparece una sin declarar, el rojo pide esa decisión — no un cambio de tamaño.
  const sinDeclarar = censo().filter((x) => !(x.clave in DECLARADAS));
  assert.deepEqual(
    sinDeclarar.map((x) => `${x.fichero}:${x.linea} (${x.clave.split(':')[1]})`), [],
    '🔴 HAY UN `btn-primary btn-sm` SIN CLASIFICAR.\n\n'
    + '  Decide qué es y actúa en consecuencia:\n'
    + '    · PRIMARIA DE PANTALLA (la acción que la pantalla existe para que hagas) → quítale\n'
    + '      `btn-sm`, como el CTA del Trabajo en SCRUM-380. A 30 px no se pulsa con guantes.\n'
    + '    · ACCIÓN DE FILA o DE MODAL → añádela a DECLARADAS con su motivo.\n\n'
    + '  ⚠️ Lo que NO se hace es subir `btn-sm` en el CSS: eso rompe el control negativo de\n'
    + '  SCRUM-352 y convierte todos los botones pequeños en normales.',
  );
});

test('SCRUM-412 · la lista de declaradas no se llena de fantasmas', () => {
  // El otro lado del trinquete: si alguien arregla un botón y no lo saca de la lista, la lista
  // deja de describir el código y el siguiente se fía de algo que ya no es cierto.
  const claves = new Set(censo().map((x) => x.clave));
  const fantasmas = Object.keys(DECLARADAS).filter((k) => !claves.has(k));
  assert.deepEqual(fantasmas, [],
    `🔴 estas declaraciones ya no corresponden a ningún botón: ${fantasmas.join(', ')}. `
    + 'O se arreglaron y hay que quitarlas de la lista, o cambiaron de nombre.');
});

test('SCRUM-412 · las dos que ERAN primaria ya no llevan `btn-sm`', () => {
  const invoiceDetail = fs.readFileSync(path.join(DIR, 'invoiceDetailView.js'), 'utf8');
  const invoicesList = fs.readFileSync(path.join(DIR, 'invoicesView.js'), 'utf8');
  assert.ok(!/btnBizum\.className\s*=\s*'btn-primary btn-sm'/.test(invoiceDetail),
    '🔴 `btnBizum` vuelve a ser `btn-sm`, y el registro de C2 lo declara PRIMARIA en `pending`');
  assert.ok(!/nuevaFacturaBtn\.className\s*=\s*'btn-primary btn-sm'/.test(invoicesList),
    '🔴 el botón de crear factura vuelve a ser `btn-sm`: es la primaria de su pantalla');
});

test('SCRUM-412 · SCRUM-352 intacto: `btn-sm` sigue midiendo 30', () => {
  // La condición innegociable. Si alguien «arregla» esto por el CSS, cae aquí además de en 352.
  const css = fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8');
  assert.match(css, /\.btn\.btn-sm\s*\{[^}]*min-height:\s*30px/,
    '🔴 `.btn.btn-sm` ha dejado de medir 30px');
  assert.ok(!/\.btn-primary\.btn-sm\s*\{[^}]*min-height:\s*44px/.test(css),
    '🔴 alguien ha subido `.btn-primary.btn-sm` en el CSS: es el atajo que rompe SCRUM-352');
});
