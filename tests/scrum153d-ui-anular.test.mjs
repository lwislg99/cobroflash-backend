// SCRUM-153 (c) — la UI de anular (sin gate: solo lee ficheros; ni BD ni red).
//
// LO QUE PROTEGE ESTE FICHERO no es «que el botón exista»: es que la pantalla no invite a
// anular cuando lo que toca es rectificar, y que quien anule sepa qué está haciendo.
//
// «Anular» y «Rectificar» suenan a lo mismo para quien no es fiscalista, y si salen como
// botones hermanos el pro elegirá ANULAR por ser la palabra que suena a lo que quiere. Son
// cosas distintas: anular = la factura NUNCA DEBIÓ EXISTIR · R1 = la operación sí existió y hay
// que corregirla. Por eso la separación visual es requisito, no decoración.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { soloEjecutable } from './_guard-texto.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DETALLE = fs.readFileSync(
  path.join(RAIZ, 'public', 'dashboard', 'js', 'invoiceDetailView.js'),
  'utf8',
);
const RUTA = fs.readFileSync(
  path.join(RAIZ, 'src', 'modules', 'system', 'app', 'routes', 'invoicesAdmin.routes.ts'),
  'utf8',
);
const CODIGO = soloEjecutable(DETALLE); // principio 10: sobre líneas ejecutables, no prosa

// ── 1. LOS DOS LISTADOS DE MOTIVOS NO PUEDEN SEPARARSE ───────────────────────────────────
//
// El backend rechaza con 422 cualquier motivo fuera de su lista. Si el `<select>` ofrece uno
// que el backend no conoce, el pro elige, confirma… y le sale un error después de haber
// decidido anular. Y al revés: un motivo nuevo en el backend que nadie añade al select es una
// opción que no existe para quien la necesita. Es el fallo de ADMIN_ONLY_ROUTES (SCRUM-158):
// dos listas a mano que deben cuadrar.

const motivosFront = [...CODIGO.matchAll(/valor:\s*'([a-z_]+)'/g)].map((m) => m[1]);
const motivosBack = (RUTA.match(/const MOTIVOS_ANULACION = \[([^\]]+)\]/) || [, ''])[1]
  .split(',')
  .map((s) => s.trim().replace(/^'|'$/g, ''))
  .filter(Boolean);

test('SCRUM-153 · los motivos del select y los del backend son los MISMOS', () => {
  assert.ok(motivosBack.length > 0, 'no se pudo leer la lista del backend');
  assert.deepEqual(
    [...motivosFront].sort(),
    [...motivosBack].sort(),
    '🔴 el desplegable de motivos y la lista que valida el backend han divergido. Un motivo que ' +
      'el backend no conoce da un 422 DESPUÉS de que el pro haya decidido anular; uno que falta ' +
      'en el select es una opción que no existe para quien la necesita.',
  );
});

test('SCRUM-153 · los cuatro motivos describen «no hubo operación»', () => {
  // No es cosmético: es lo que hace CUMPLIBLE la regla anular ≠ R1. Si aparece un motivo del
  // tipo «importe incorrecto», eso es una rectificativa y el menú estaría invitando al error.
  assert.deepEqual(
    [...motivosFront].sort(),
    ['datos_cliente', 'duplicada', 'error_sin_operacion', 'prueba'],
    '🔴 la lista de motivos cambió. Los cuatro valores son situaciones en las que la operación ' +
      'NO existió; añadir uno donde el trabajo SÍ se hizo convierte el desplegable en una ' +
      'invitación a anular lo que había que rectificar.',
  );
});

// ── 2. NO SON BOTONES HERMANOS ───────────────────────────────────────────────────────────

test('SCRUM-153 · anular NO vive en la misma fila que rectificar', () => {
  assert.ok(
    /page\.appendChild\(zona\)/.test(CODIGO),
    '🔴 la zona de anular debe colgar de `page` (sección propia), no de `actions`',
  );
  assert.ok(
    !/actions\.appendChild\(btnAnular\)/.test(CODIGO),
    '🔴 el botón de anular ha vuelto a la fila de acciones, al lado de «Rectificar factura». ' +
      'Son las dos palabras que el pro confunde, y juntas elegirá ANULAR por sonar a lo que ' +
      'quiere. La separación visual ES el requisito.',
  );
  assert.ok(
    /detail-section/.test(CODIGO.slice(CODIGO.indexOf('zona-anular') - 400, CODIGO.indexOf('zona-anular') + 200)),
    '🔴 la zona debe reutilizar el componente `detail-section` del inventario AB3, no uno nuevo',
  );
});

test('SCRUM-153 · la pantalla explica cuándo NO anular', () => {
  assert.ok(
    /Rectificar en vez de anular|usa\s+Rectificar/i.test(DETALLE),
    '🔴 falta el texto que manda a Rectificar cuando el trabajo SÍ se hizo. Sin él, la ' +
      'separación visual no basta: hay que decir en qué caso cada una.',
  );
});

// ── 3. Confirmación explícita, no un clic suelto ─────────────────────────────────────────

test('SCRUM-153 · no se puede anular sin elegir motivo', () => {
  assert.ok(
    /btnSi\.disabled = !motivo\.value/.test(CODIGO),
    '🔴 el botón de confirmar debe nacer deshabilitado y habilitarse SOLO al elegir motivo. Es ' +
      'la mitad de la confirmación explícita: obliga a mirar la lista, que es donde el pro se ' +
      'da cuenta de si lo que quiere es rectificar.',
  );
  assert.ok(/id="anul-si" disabled/.test(DETALLE), '🔴 nace habilitado');
});

test('SCRUM-153 · el aviso dice las tres cosas que hay que saber', () => {
  const avisos = [
    [/No se borra nada/i, 'que no borra nada'],
    [/no se reutiliza/i, 'que el número no se reutiliza'],
    [/conserva su registro y su huella/i, 'que conserva registro y huella'],
  ];
  for (const [re, que] of avisos) {
    assert.ok(
      re.test(DETALLE),
      `🔴 el aviso de confirmación no dice ${que}. Es una acción irreversible sobre un ` +
        `documento fiscal: quien la ejecuta tiene que saber exactamente qué queda después.`,
    );
  }
});

// ── 4. Admin-only con el patrón de SCRUM-89: deshabilitado, no escondido ─────────────────

test('SCRUM-153 · a un técnico se le muestra deshabilitado con explicación', () => {
  assert.ok(
    /lockActionForRole\(btnAnular\)/.test(CODIGO),
    '🔴 falta el patrón de SCRUM-89. Esconder el botón enseña que la acción no existe; ' +
      'deshabilitarlo con la explicación enseña que existe y quién puede hacerla.',
  );
  assert.ok(/roleLockedNote\(\)/.test(CODIGO), '🔴 falta la nota que explica por qué está bloqueado');
});

// ── 5. Solo donde procede ────────────────────────────────────────────────────────────────

test('SCRUM-153 · no se ofrece sobre pagadas, rectificativas ni justificantes', () => {
  const bloque = CODIGO.slice(CODIGO.indexOf('const puedeAnular'), CODIGO.indexOf('const puedeAnular') + 260);
  assert.ok(/st === 'pending'/.test(bloque), '🔴 se ofrece sobre una PAGADA: el dinero entró, la operación existió → devolución + R1');
  assert.ok(/type !== 'R1'/.test(bloque), '🔴 se ofrece sobre una rectificativa');
  assert.ok(/J-/.test(bloque), '🔴 se ofrece sobre un justificante J- (V0-0: nunca entra en la cadena)');
});
