// tests/scrum1640-lote-marca-cero.test.mjs — SCRUM-1640 ① (J1, 30-oct-2026)
//
// «SE HAN MARCADO COMO PAGADAS» CUANDO SE HAN MARCADO CERO.
//
// El servidor se salta las facturas ya pagadas o anuladas (`invoicesAdmin.routes.ts`, `updateMany`
// con `NO_SE_MARCAN_PAGADAS_EN_LOTE`), así que un lote puede devolver `updated: 0`. La casilla sólo
// sale en las que se pueden marcar, de modo que hace falta una carrera: dos pestañas o una lista
// vieja. Textos firmados en SCRUM-1640 comentario 21292.
//
// 🔴 DOS PISOS, Y EL SEGUNDO ES EL QUE MIDE LA PANTALLA. SCRUM-1215l ejecutó la función pura y de
// ahí salió este ticket; pero `reload()` se tragaba su propio error, así que la función NUNCA
// recibía `recargaOk: false` desde la pantalla: el aviso de la recarga no podía salir, y lo que se
// veía era el `✓`. Un test de la función sola sigue verde con ese defecto puesto.
//
// LO QUE NO SABE: el color del aviso (CSS) ni cómo lo anuncia un lector de pantalla.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const F_VISTA = path.join(RAIZ, 'public', 'dashboard', 'js', 'invoicesView.js');
const { resultadoMarcadoEnBloque, COPY_BULK_PAGADAS } = createRequire(import.meta.url)(F_VISTA);

export const MUTACIONES_QUE_ME_TUMBAN = [
  // Vuelve el defecto del ticket: con cero se dice que se marcaron.
  { fichero: 'public/dashboard/js/invoicesView.js', de: 'if (marcadas === 0) {', a: 'if (false) {', cae: 'cero marcadas y recarga bien' },
  // Se pierde la mitad de la recarga: con cero y sin recarga, no se avisa de la lista vieja.
  { fichero: 'public/dashboard/js/invoicesView.js', de: 'texto: recargaOk ? COPY_BULK_PAGADAS.ningunaMarcada : COPY_BULK_PAGADAS.ningunaMarcadaRecargaFallida', a: 'texto: COPY_BULK_PAGADAS.ningunaMarcada', cae: 'cero marcadas y recarga rota' },
  // El aviso de cero sale en verde.
  { fichero: 'public/dashboard/js/invoicesView.js', de: "return { tono: 'warning', texto: recargaOk ?", a: "return { tono: 'success', texto: recargaOk ?", cae: 'cero marcadas y recarga bien' },
  // `reload()` vuelve a callarse que la lista no se pudo leer: la pantalla dice ✓.
  { fichero: 'public/dashboard/js/invoicesView.js', de: "statusBox.style.display = 'block';\n        return false;", a: "statusBox.style.display = 'block';\n        return true;", cae: 'se marcan y la recarga cae' },
  // El lote deja de mirar lo que contesta `reload()`.
  { fichero: 'public/dashboard/js/invoicesView.js', de: 'try { recargaOk = await reload(); } catch { recargaOk = false; }', a: 'try { await reload(); recargaOk = true; } catch { recargaOk = false; }', cae: 'se marcan y la recarga cae' },
  // La salida de la lista vacía deja de contar como recarga buena.
  { fichero: 'public/dashboard/js/invoicesView.js', de: "setCount('0 facturas');\n          return true;", a: "setCount('0 facturas');\n          return;", cae: 'la lista se queda vacía' },
];

// Copiados de SCRUM-1640 comentario 21292, byte a byte: el test no los lee del código que vigila.
const CERO = 'No se ha marcado ninguna: ya estaban pagadas o anuladas.';
const CERO_SIN_RECARGA = 'No se ha marcado ninguna: ya estaban pagadas o anuladas. La lista no se ha podido actualizar. Recárgala para verla al día.';
const SIN_RECARGA = 'Se han marcado como pagadas, pero la lista no se ha podido actualizar. Recárgala para verla al día.';

// ── La función pura ─────────────────────────────────────────────────────────────────────────────

test('SCRUM-1640 · 🔴 cero marcadas y recarga bien: el literal firmado, en aviso', () => {
  const r = resultadoMarcadoEnBloque({ escrituraOk: true, recargaOk: true, marcadas: 0 });
  assert.deepEqual({ ...r }, { tono: 'warning', texto: CERO, seMarcaron: false });
});

test('SCRUM-1640 · 🔴 cero marcadas y recarga rota: el otro literal firmado, en aviso', () => {
  const r = resultadoMarcadoEnBloque({ escrituraOk: true, recargaOk: false, marcadas: 0 });
  assert.deepEqual({ ...r }, { tono: 'warning', texto: CERO_SIN_RECARGA, seMarcaron: false });
});

test('SCRUM-1640 · 🔵 con 1 o más no cambia nada', () => {
  assert.deepEqual({ ...resultadoMarcadoEnBloque({ escrituraOk: true, recargaOk: true, marcadas: 1 }) },
    { tono: 'success', texto: '✓ 1 factura marcada como pagada.', seMarcaron: true });
  assert.deepEqual({ ...resultadoMarcadoEnBloque({ escrituraOk: true, recargaOk: true, marcadas: 3 }) },
    { tono: 'success', texto: '✓ 3 facturas marcadas como pagadas.', seMarcaron: true });
  assert.deepEqual({ ...resultadoMarcadoEnBloque({ escrituraOk: true, recargaOk: false, marcadas: 1 }) },
    { tono: 'warning', texto: SIN_RECARGA, seMarcaron: true });
  assert.equal(COPY_BULK_PAGADAS.recargaFallida, SIN_RECARGA);
});

test('SCRUM-1640 · 🔵 si la escritura falló, manda ese fallo aunque el recuento sea cero', () => {
  const r = resultadoMarcadoEnBloque({ escrituraOk: false, recargaOk: true, marcadas: 0 });
  assert.equal(r.tono, 'error');
  assert.equal(r.texto, COPY_BULK_PAGADAS.escrituraFallida);
});

// ── La pantalla: POST y recarga de verdad, por el `fetch` del banco ─────────────────────────────

const PENDIENTE = { id: 301, number: 'F-2026-0301', status: 'pending', total: 121, currency: 'EUR', createdAt: '2026-10-20T10:00:00Z', customerName: 'Cliente' };

const respuesta = (ok, cuerpo) => ({
  ok, status: ok ? 200 : 500, headers: { get: () => 'application/json' },
  json: async () => cuerpo, blob: async () => ({}), text: async () => JSON.stringify(cuerpo),
});

/** Monta Facturas, marca la casilla y pulsa el lote. Devuelve el aviso que queda a la vista. */
async function pulsarLote({ marcadas, recargaOk, listaTrasElLote = [PENDIENTE] }) {
  const llamadas = [];
  let posts = 0;
  const fetch = async (url, opts = {}) => {
    const u = String(url);
    llamadas.push(`${opts.method || 'GET'} ${u}`);
    if (/\/admin\/invoices\/bulk-paid/.test(u)) { posts += 1; return respuesta(true, { ok: true, updated: marcadas }); }
    if (/\/admin\/invoices(\?|$)/.test(u)) return posts === 0 ? respuesta(true, [PENDIENTE]) : respuesta(recargaOk, listaTrasElLote);
    return respuesta(true, []);
  };
  const banco = cargarDashboard(RAIZ, { red: { fetch } });
  assert.deepEqual(banco.fallos, [], '🔴 CIEGO: el dashboard no carga entero en el banco.');
  const r = await pintarVista(banco, 'renderInvoicesView');
  assert.equal(r.error, null, `🔴 CIEGO: la vista revienta al montarse: ${r.error}`);

  const casilla = todos(r.contenedor).find((n) => n.tagName === 'INPUT' && n.className === 'inv-row-check');
  assert.ok(casilla, '🔴 CIEGO: no hay casilla que marcar; sin ella este test no pulsa nada.');
  casilla.checked = true;
  for (const f of casilla._oyentes.change) await f.call(casilla, { type: 'change', stopPropagation() {} });

  const boton = todos(r.contenedor).find((n) => n.id === 'bulk-paid-btn');
  assert.ok(boton, '🔴 CIEGO: no encuentro el botón del lote.');
  for (const f of boton._oyentes.click) await f.call(boton, { type: 'click' });
  assert.equal(posts, 1, `🔴 CIEGO: el POST del lote no salió. Llamadas: ${llamadas.join(' · ')}`);

  const visibles = todos(r.contenedor).filter((n) => /^alert\b/.test(String(n.className)) && n.style.display === 'block');
  assert.equal(visibles.length, 1, `🔴 CIEGO: esperaba UN aviso a la vista y hay ${visibles.length}`);
  return { tono: String(visibles[0].className).replace(/^alert\s*/, ''), texto: visibles[0].textContent };
}

test('SCRUM-1640 · 🔴 PANTALLA: cero marcadas y recarga bien', async () => {
  assert.deepEqual(await pulsarLote({ marcadas: 0, recargaOk: true }), { tono: 'warning', texto: CERO });
});

test('SCRUM-1640 · 🔴 PANTALLA: cero marcadas y la recarga cae', async () => {
  assert.deepEqual(await pulsarLote({ marcadas: 0, recargaOk: false }), { tono: 'warning', texto: CERO_SIN_RECARGA });
});

test('SCRUM-1640 · 🔴 PANTALLA: se marcan y la recarga cae, y eso no sale como un éxito', async () => {
  assert.deepEqual(await pulsarLote({ marcadas: 2, recargaOk: false }), { tono: 'warning', texto: SIN_RECARGA });
});

test('SCRUM-1640 · 🔵 PANTALLA: se marcan y la recarga va bien, igual que antes', async () => {
  assert.deepEqual(await pulsarLote({ marcadas: 2, recargaOk: true }), { tono: 'success', texto: '✓ 2 facturas marcadas como pagadas.' });
});

// La salida temprana de `reload()` con la lista vacía: es el caso NORMAL de «Pendientes», donde
// marcarlas todas deja la tabla sin filas. Si esa salida no dice que la recarga fue bien, el
// profesional lee que la lista no se actualizó justo cuando ha ido todo bien.
test('SCRUM-1640 · 🔵 PANTALLA: se marcan todas, la lista se queda vacía y eso sigue siendo un éxito', async () => {
  assert.deepEqual(await pulsarLote({ marcadas: 1, recargaOk: true, listaTrasElLote: [] }),
    { tono: 'success', texto: '✓ 1 factura marcada como pagada.' });
});
