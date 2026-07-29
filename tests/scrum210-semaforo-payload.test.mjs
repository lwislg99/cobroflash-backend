// SCRUM-210 · EL PAYLOAD DEL ÁMBAR — lo que no se puede negociar.
//
// Al confirmar un ámbar el front devuelve `avisoId` + `avisoVersion`, NUNCA un booleano.
// El motivo no es de estilo: si solo se manda «aceptó», el día que cambie el microcopy el
// AuditLog MIENTE — dice que el usuario aceptó un texto que ya no es el que se le mostró, y
// deja de servir como escudo. Las DOS piezas hacen falta: el id dice QUÉ aceptó, la versión
// dice QUÉ TEXTO vio. Con una sola no se reproduce lo que había en pantalla.
//
// Por eso este guard vigila las dos por separado y se probó EN ROJO dos veces, quitando cada
// campo del payload de forma independiente: un solo rojo no distingue si el test mira las dos.
//
// El front es vanilla y no se importa: se evalúa la función en un `window` de mentira, igual
// que hacen scrum153b-annulled-vistas y scrum37-plan-front-vs-back.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const FUENTE = fs.readFileSync(path.join(RAIZ, 'public', 'dashboard', 'js', 'semaforoFiscal.js'), 'utf8');

function cargar(nombre, hasta) {
  const cuerpo = FUENTE.slice(FUENTE.indexOf(`function ${nombre}`), FUENTE.indexOf(hasta));
  // eslint-disable-next-line no-new-func
  return new Function(`${cuerpo}; return ${nombre};`)();
}
const buildAvisoPayload = cargar('buildAvisoPayload', 'function renderRojo');

const AVISO = { color: 'ambar', avisoId: 'AMBAR_CLIENTE_SIN_NIF', avisoVersion: 0 };

// ── 1. El payload LLEVA las dos piezas ───────────────────────────────────────────────────
// Estos dos asserts son los que se rompen si alguien deja de mandar un campo. Son el rojo que
// se provocó a mano quitando `avisoId:` y luego `avisoVersion:` del objeto que devuelve la
// función: cada supresión tumba EXACTAMENTE uno, que es la prueba de que miran cosas distintas.

test('SCRUM-210 · el payload de confirmación lleva avisoId', () => {
  const p = buildAvisoPayload(AVISO, 'emitir_igualmente');
  assert.equal(p.avisoId, 'AMBAR_CLIENTE_SIN_NIF',
    '🔴 sin avisoId el AuditLog no sabe QUÉ aceptó el usuario');
});

test('SCRUM-210 · el payload de confirmación lleva avisoVersion', () => {
  const p = buildAvisoPayload(AVISO, 'emitir_igualmente');
  assert.ok(Object.prototype.hasOwnProperty.call(p, 'avisoVersion'),
    '🔴 sin avisoVersion el AuditLog no sabe QUÉ TEXTO vio el usuario');
  assert.equal(p.avisoVersion, 0);
});

test('SCRUM-210 · el payload NO es un booleano ni lo contiene', () => {
  const p = buildAvisoPayload(AVISO, 'emitir_igualmente');
  assert.deepEqual(Object.keys(p).sort(), ['avisoId', 'avisoVersion', 'opcion']);
  assert.ok(!Object.values(p).some((v) => typeof v === 'boolean'),
    '🔴 un booleano «aceptó» es justo lo que este ticket prohíbe');
});

// ── 2. La ENTRADA incompleta se rechaza, no se completa sola ─────────────────────────────
// Un payload cojo es peor que ninguno: parece que hay prueba y no la hay.

test('SCRUM-210 · un aviso sin avisoId no produce payload', () => {
  assert.throws(
    () => buildAvisoPayload({ avisoVersion: 0 }, 'emitir_igualmente'),
    /sin_avisoId/,
  );
});

test('SCRUM-210 · un aviso sin avisoVersion no produce payload', () => {
  assert.throws(
    () => buildAvisoPayload({ avisoId: 'AMBAR_CLIENTE_SIN_NIF' }, 'emitir_igualmente'),
    /sin_avisoVersion/,
  );
});

// La trampa del 0: la versión de HOY es 0 (catálogo de SCRUM-207 sin publicar). Un guard
// escrito como `if (!aviso.avisoVersion)` la trataría como ausente y rompería el caso normal,
// no el defectuoso. El caso de prueba cae DENTRO del mecanismo: comprueba la AUSENCIA.
test('SCRUM-210 · avisoVersion 0 es una versión VÁLIDA, no una ausencia', () => {
  const p = buildAvisoPayload({ avisoId: 'ROJO_SIN_LINEAS', avisoVersion: 0 }, 'x');
  assert.equal(p.avisoVersion, 0);
});

// ── 3. El catálogo: ids SEMÁNTICOS para que SCRUM-207 los ADOPTE ─────────────────────────

test('SCRUM-210 · los ids del catálogo son semánticos y el id del payload es el del aviso', () => {
  const ids = ['AMBAR_PLAZO_VENCIDO', 'AMBAR_CLIENTE_SIN_NIF', 'ROJO_SIN_LINEAS', 'ROJO_ANULADA', 'ROJO_MESES_DISTINTOS'];
  ids.forEach((id) => {
    assert.match(FUENTE, new RegExp(`avisoId: '${id}'`), `falta el aviso ${id} en el catálogo`);
    // El payload devuelve el id TAL CUAL: si se transformara, el catálogo real de SCRUM-207
    // no podría adoptarlo sin migrar datos ya escritos en AuditLog.
    assert.equal(buildAvisoPayload({ avisoId: id, avisoVersion: 0 }, 'x').avisoId, id);
  });
});

test('SCRUM-210 · el hueco del asesor sigue SIN rellenar y VISIBLE en el código', () => {
  assert.match(FUENTE, /const PENDIENTE_ASESOR = '\[PENDIENTE ASESOR\]'/,
    '🔴 el hueco fiscal se rellenó o se escondió: eso lo decide el asesor, no el código');
});
