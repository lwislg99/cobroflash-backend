// tests/scrum1233e-trabajos-y-parte-sin-tripa.test.mjs — SCRUM-1233e (carril S4)
//
// Los dos sitios de S4 que SCRUM-1233 dejó declarados y sin arreglar:
//
// ① `jobsView.js` · `avisoDeFallo(prefijo, err)` — el ÚNICO punto por el que la lista de Trabajos
//    enseña un fallo (guardar el estado, asignar técnicos, generar el cobro). Su detalle caía a
//    `err.message`, así que un 500 sin frase pintaba «No se pudo guardar: API 500: internal_error», y
//    sin red «…: Failed to fetch». Ahora pasa por `mensajeParaPersona`: sin frase del servidor, el
//    prefijo solo, que es un literal que la pantalla ya usaba.
// ② `parteDetailView.js` · el rechazo de la firma del parte (que no sea `parte_vacio`) subía
//    `r.error.message` CRUDO al contrato del pad, que espera un texto ya traducido (SCRUM-1233
//    c.17504). Ahora dice lo mismo que el albarán ante el mismo rechazo: `mensajeDeFalloAlFirmar`.
//
// Los dos se miden con el `apiRequest` REAL: el error es el que fabrica `api.js` de verdad ante esa
// respuesta, no uno escrito a mano con la forma que creemos que tiene.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard } from './_banco-vistas.mjs';
import { montarAlmacen, porQueEstariaCiego } from './_banco-almacen-local.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const respuesta = (status, cuerpo) => ({
  ok: status >= 200 && status < 300, status, statusText: String(status),
  headers: { get: () => 'application/json' },
  json: async () => cuerpo, blob: async () => ({}), text: async () => JSON.stringify(cuerpo),
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ① LA LISTA DE TRABAJOS
// ═══════════════════════════════════════════════════════════════════════════════════════════════

/** Pide con el `apiRequest` real, recoge el error que fabrica y lo pasa por `avisoDeFallo`. */
async function avisoTrasFallo(alPedir, prefijo) {
  const banco = cargarDashboard(RAIZ, { red: { fetch: async () => alPedir() } });
  const { ctx } = banco;
  assert.equal(typeof ctx.avisoDeFallo, 'function', 'CIEGO: jobsView.js no publica `avisoDeFallo`');
  assert.equal(typeof ctx.apiRequest, 'function', 'CIEGO: api.js no publica `apiRequest`');
  const toasts = [];
  ctx.showToast = (texto, tipo) => { toasts.push({ texto, tipo }); };
  let err = null;
  try { await ctx.apiRequest('/admin/jobs/1', { method: 'PATCH', body: '{}' }); } catch (e) { err = e; }
  assert.ok(err, 'SUELO: la petición no falló; no hay fallo que enseñar');
  ctx.avisoDeFallo(prefijo, err);
  assert.equal(toasts.length, 1, `CIEGO: avisoDeFallo no ha pintado ningún aviso (${toasts.length})`);
  assert.equal(toasts[0].tipo, 'error');
  return { texto: toasts[0].texto, err };
}

test('SCRUM-1233e · 🔴 Trabajos: un 500 sin frase enseña el prefijo, no «API 500: internal_error»', async () => {
  const { texto, err } = await avisoTrasFallo(() => respuesta(500, { error: 'internal_error' }), 'No se pudo guardar');
  // Control del instrumento: el error que fabrica api.js SÍ lleva la tripa en `message`; si no la
  // llevara, este test pasaría también con el código viejo y no probaría nada.
  assert.match(String(err.message), /500|internal_error/, `CIEGO: el error de api.js ya no lleva la tripa: ${err.message}`);
  assert.equal(texto, 'No se pudo guardar');
});

test('SCRUM-1233e · 🔴 Trabajos: sin red no enseña el «Failed to fetch» del navegador', async () => {
  const { texto, err } = await avisoTrasFallo(() => { throw new TypeError('Failed to fetch'); }, 'No se pudo generar el cobro');
  assert.match(String(err.message), /Failed to fetch/, `CIEGO: el error de api.js ya no lleva el texto del navegador: ${err.message}`);
  assert.equal(texto, 'No se pudo generar el cobro');
});

test('SCRUM-1233e · CONTROL: la frase del servidor para una persona SÍ sale detrás del prefijo', async () => {
  const { texto } = await avisoTrasFallo(() => respuesta(409, { error: 'x', message: 'Tu cuenta está en pausa.' }), 'No se pudo guardar');
  assert.equal(texto, 'No se pudo guardar: Tu cuenta está en pausa.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ② LA FIRMA DEL PARTE RECHAZADA
// ═══════════════════════════════════════════════════════════════════════════════════════════════

const PARTE = {
  id: 7, numero: 'PT-2026-001', clienteNombre: 'Comunidad Los Olivos',
  fecha: '2026-09-16T08:00:00.000Z', obra: 'C/ Mayor 3', referencia: null,
  entrada: null, salida: null, desplazamientos: null, kilometros: null, tecnicos: [],
  tipo: 'reparacion_asistencia', notas: null, estado: 'borrador',
  lineas: [{ bloque: 'mano_obra', unds: 2, descripcion: 'Revisión de caldera' }],
  firmoElCliente: false, firmoElTecnico: false,
  puedeEditarContenido: { ok: true, motivo: null },
  puedeEditarPrecios: { ok: true, motivo: null },
};

/** Firma un parte contra un POST que responde `alFirmar`; devuelve lo que el pad enseñaría. */
async function avisoDelPad(alFirmar) {
  const red = {
    fetch: async (url, opts) => {
      const metodo = (opts && opts.method) || 'GET';
      return metodo === 'GET' ? respuesta(200, PARTE) : respuesta(alFirmar.status, alFirmar.data);
    },
    navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } },
  };
  const b = montarAlmacen(RAIZ, { dashboard: { red } });
  const ciego = porQueEstariaCiego(b, RAIZ);
  assert.equal(ciego, null, `🔴 BANCO CIEGO: ${ciego}`);
  let onConfirm = null;
  const abierto = b.ctx.firmarParte(PARTE, {
    abrirPad: (o) => { onConfirm = o.onConfirm; }, alFirmar: async () => {}, avisar: () => {},
  }, 'cliente');
  assert.ok(abierto && onConfirm, 'SUELO: el pad no se ha abierto; no se ha firmado nada');
  try {
    await onConfirm('data:image/png;base64,' + 'A'.repeat(300), { firmadoPorNombre: 'Ana Ruiz' });
  } catch (e) {
    return String(e && e.message);
  }
  assert.fail('SUELO: la firma rechazada CERRÓ el pad; no hay aviso que medir');
}

const FALLO_AL_FIRMAR = 'No hemos podido registrar la firma';

test('SCRUM-1233e · 🔴 parte: un rechazo sin frase dice lo del albarán, no «API 400: firma_invalida»', async () => {
  const aviso = await avisoDelPad({ status: 400, data: { error: 'firma_invalida' } });
  assert.equal(/API 4|firma_invalida/.test(aviso), false, `🔴 la tripa del sistema en el pad: ${aviso}`);
  assert.equal(aviso, FALLO_AL_FIRMAR);
});

// No es un control: en `origin/main` cae (salía la frase sola, sin el molde). Es el comportamiento nuevo.
test('SCRUM-1233e · parte: un rechazo con frase la enseña, con el mismo molde que el albarán', async () => {
  const aviso = await avisoDelPad({ status: 400, data: { error: 'firma_sin_nombre', message: 'Falta el nombre de quien firma.' } });
  assert.equal(aviso, `${FALLO_AL_FIRMAR} (Falta el nombre de quien firma.)`);
});

test('SCRUM-1233e · CONTROL: `parte_vacio` sigue diciendo SU texto firmado, no el del albarán', async () => {
  const b = montarAlmacen(RAIZ, { dashboard: { red: { fetch: async () => respuesta(200, PARTE) } } });
  const esperado = b.ctx.PARTE_TEXTOS && b.ctx.PARTE_TEXTOS.parteVacioNoSeFirma;
  assert.equal(typeof esperado, 'string', 'CIEGO: el dashboard no publica PARTE_TEXTOS.parteVacioNoSeFirma');
  const aviso = await avisoDelPad({ status: 409, data: { error: 'parte_vacio', message: 'un parte sin ninguna línea no se puede firmar' } });
  assert.equal(aviso, esperado);
});
