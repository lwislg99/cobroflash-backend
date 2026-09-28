// tests/scrum1239-alta-cliente-sin-conexion.test.mjs — SCRUM-1239
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL ALTA DE CLIENTE DICE «REVISA LOS DATOS» CUANDO LO QUE SE CAYÓ ES LA CONEXIÓN
//
// El genérico firmado en SCRUM-1199 —«No se ha podido guardar el cliente. Revisa los datos e
// inténtalo de nuevo.»— es falso cuando los datos están bien: manda al profesional a mirar donde no
// es (la forma de SCRUM-828). `api.js` ya distingue los tres casos y la pantalla los aplanaba:
//
//   · sin cobertura        → `err.sinRed`   (fetch rechaza)
//   · se cortó a mitad     → `err.incierto` (el POST venció el plazo: PUEDE haberse guardado)
//   · el servidor revienta → `err.status >= 500`
//
// Textos: SCRUM-1239 comentario 17386. Los tres mandan a mirar la lista antes de crearlo otra vez:
// en ninguno se puede saber si se guardó, y afirmar que no invitaría a crear un duplicado.
//
// ── EL BANCO ─────────────────────────────────────────────────────────────────────────────────
// El modal REAL, con `api.js` REAL: sólo se dobla `fetch`. Cada caso se PROVOCA en la red, no se
// fabrica el error a mano — si `api.js` dejara de marcarlo, este test tiene que enterarse.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { constaAprobado } from './_microcopy-aprobada.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SIN_CONEXION = 'Sin conexión. Vuelve a intentarlo cuando tengas cobertura, y mira la lista antes de crearlo otra vez.';
const SIN_CONFIRMAR = 'Se cortó la conexión y no sabemos si el cliente se ha guardado. Mira la lista antes de crearlo otra vez.';
const FALLO_SERVIDOR = 'No hemos podido completar el guardado. Inténtalo de nuevo en un rato, y mira la lista antes de crearlo otra vez.';
const GENERICO = 'No se ha podido guardar el cliente. Revisa los datos e inténtalo de nuevo.';

/** Una respuesta HTTP como la entrega `fetch`. */
function respuesta(status, cuerpo) {
  return {
    ok: status < 400, status, statusText: '',
    headers: { get: () => 'application/json' },
    json: async () => cuerpo, text: async () => JSON.stringify(cuerpo),
  };
}

/**
 * Monta el modal real, pulsa Guardar y devuelve lo que se pintó. `alGuardar(opts)` decide qué hace
 * la red con el POST del alta: devolver una respuesta, rechazar, o no volver nunca.
 */
async function avisoPintado(alGuardar, { plazoMs } = {}) {
  let altas = 0;
  const banco = cargarDashboard(RAIZ, {
    red: {
      navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } },
      fetch: async (url, opts) => {
        const alta = /\/admin\/customers$/.test(String(url)) && opts && opts.method === 'POST';
        if (!alta) return respuesta(200, []);
        altas++;
        return alGuardar(opts);
      },
    },
  });
  assert.deepEqual(banco.fallos, [], 'un script del panel no cargó: nada de lo de abajo mediría');
  const r = await pintarVista(banco, 'renderCustomersView');
  assert.equal(r.error, null, `la vista de Clientes no montó: ${r.error && r.error.message}`);
  if (plazoMs) banco.ctx.PLAZO_RED_MS = plazoMs;

  banco.ctx.altaClienteModal.abrirNuevo({});
  const nodos = todos(banco.ctx.document.body);
  const control = (nombre) => nodos.filter((n) => n.name === nombre)[0];
  control('name').value = 'Fontanería Ejemplo';
  control('phone').value = '600000000';

  const formularios = nodos.filter((n) => n.tagName === 'FORM' && (n._oyentes.submit || []).length);
  assert.equal(formularios.length, 1, '🔴 CIEGO: no encuentro el formulario del modal con su oyente de Guardar');
  formularios[0].disparar('submit');
  for (let i = 0; i < 20; i++) await new Promise((res) => setImmediate(res));
  if (plazoMs) await new Promise((res) => setTimeout(res, plazoMs + 30));
  for (let i = 0; i < 20; i++) await new Promise((res) => setImmediate(res));

  assert.equal(altas, 1, `🔴 CIEGO: el Guardar tenía que mandar UN alta a la red y mandó ${altas}`);
  return todos(banco.ctx.document.body).map((n) => n.textContent || '').join(' | ');
}

/** Un POST que la red acepta y no devuelve nunca… salvo que lo aborten, como el navegador. */
function noVuelve(opts) {
  return new Promise((_ok, ko) => {
    const s = opts && opts.signal;
    if (s) s.addEventListener('abort', () => { const e = new Error('The operation was aborted.'); e.name = 'AbortError'; ko(e); });
  });
}

test('SCRUM-1239 · los tres literales constan FIRMADOS en docs/microcopy', () => {
  for (const t of [SIN_CONEXION, SIN_CONFIRMAR, FALLO_SERVIDOR]) {
    assert.ok(constaAprobado(t).length > 0, `🔴 «${t}» no consta aprobado: no se pinta un texto sin firma (regla 39)`);
  }
});

test('SCRUM-1239 · 🔴 SIN COBERTURA (fetch rechaza) no dice «Revisa los datos»', async () => {
  const pintado = await avisoPintado(async () => { throw new TypeError('Failed to fetch'); });
  assert.ok(pintado.includes(SIN_CONEXION), `🔴 sin cobertura no se pinta su aviso. Hoy pinta el genérico de 1199: ${pintado.includes(GENERICO)}. Pantalla: ${pintado.slice(0, 300)}`);
  assert.ok(!pintado.includes(GENERICO), '🔴 se manda a revisar unos datos que están bien');
  assert.ok(!pintado.includes('Failed to fetch'), '🔴 el error del navegador, en inglés, en pantalla');
});

test('SCRUM-1239 · 🔴 SE CORTÓ A MITAD (el POST vence el plazo) dice que no lo sabemos', async () => {
  const pintado = await avisoPintado(noVuelve, { plazoMs: 5 });
  assert.ok(pintado.includes(SIN_CONFIRMAR), `🔴 el POST vencido no pinta «no sabemos». Hoy pinta el genérico de 1199: ${pintado.includes(GENERICO)}. Pantalla: ${pintado.slice(0, 300)}`);
  assert.ok(!pintado.includes(GENERICO));
  assert.ok(!pintado.includes(SIN_CONEXION), '🔴 un POST vencido PUDO guardarse: no es «sin conexión» (SCRUM-459)');
});

test('SCRUM-1239 · 🔴 EL SERVIDOR REVIENTA (500 sin `message`) no culpa a los datos', async () => {
  const pintado = await avisoPintado(async () => respuesta(500, { error: 'internal_error' }));
  assert.ok(pintado.includes(FALLO_SERVIDOR), `🔴 un 500 no pinta su aviso. Hoy pinta el genérico de 1199: ${pintado.includes(GENERICO)}. Pantalla: ${pintado.slice(0, 300)}`);
  assert.ok(!pintado.includes(GENERICO));
  assert.ok(!pintado.includes('internal_error'), '🔴 el código en crudo en pantalla');
});

// ═══ CONTROLES — lo de SCRUM-1199 sigue igual ════════════════════════════════════════════════

test('SCRUM-1239 · ✅ un 400 que no es de campo sigue en el genérico de 1199', async () => {
  const pintado = await avisoPintado(async () => respuesta(400, { error: 'empresa_no_valida' }));
  assert.ok(pintado.includes(GENERICO), `el 400 sin campo ya no pinta el genérico: ${pintado.slice(0, 300)}`);
  assert.ok(!pintado.includes(SIN_CONEXION) && !pintado.includes(FALLO_SERVIDOR));
});

test('SCRUM-1239 · ✅ un mensaje humano del servidor sigue ganando, también en un 500', async () => {
  const humano = 'Mensaje propio del servidor.';
  const pintado = await avisoPintado(async () => respuesta(500, { error: 'algo', message: humano }));
  assert.ok(pintado.includes(humano), `🔴 el aviso nuevo se ha tragado un mensaje específico: ${pintado.slice(0, 300)}`);
  assert.ok(!pintado.includes(FALLO_SERVIDOR));
});
