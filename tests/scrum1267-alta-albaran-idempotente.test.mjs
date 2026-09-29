// tests/scrum1267-alta-albaran-idempotente.test.mjs — SCRUM-1267
//
// EL ALTA DE ALBARÁN NO MANDABA `claveIdempotencia`, y el servidor la honra desde SCRUM-358. Si la
// respuesta del POST se pierde y el profesional reintenta, el servidor no puede saber que es el
// mismo albarán y reserva el número siguiente: DOS albaranes, con números seguidos.
//
// Se mide el VIAJE, no el gesto: la ficha REAL del Trabajo en el banco, la hoja de alta de verdad,
// el `apiRequest` REAL de `api.js` (el banco solo pone el `fetch`) y, al otro lado, un servidor que
// hace lo que hace `jobs.routes.ts`: la clave pasa por la `normalizarClaveIdempotencia` REAL (dist)
// y, si ya la conoce, devuelve el albarán original sin reservar número.
//
// 🔴 El aviso que decide si esto sirve (S1): la clave se acuña UNA VEZ y se REUTILIZA en el
// reintento. Acuñada en cada clic, los dos POST llevarían claves distintas y saldrían dos.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cargarDashboard, pintarVista } from './_banco-vistas.mjs';
import { telefonoDePrueba } from '../scripts/_telefonos-prueba.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { normalizarClaveIdempotencia } = await import(
  pathToFileURL(path.join(RAIZ, 'dist/modules/jobs/domain/albaranIdempotencia.js')).href);

const JOB = {
  id: 42, status: 'en_curso', createdAt: '2026-09-01T09:00:00Z', titulo: 'Reparación caldera',
  customer: { id: 5, name: 'Cliente Uno', phone: telefonoDePrueba(1), mobile: null },
  asignados: [], operario: null, albaranes: [], gastos: [], notes: '',
  quote: null, direccion: null, totalAceptado: 0, totalCobrado: 0,
};
const respirar = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const respuesta = (status, cuerpo) => ({
  ok: status >= 200 && status < 300, status, statusText: 'OK',
  headers: { get: () => 'application/json' },
  json: async () => cuerpo, blob: async () => ({}), text: async () => JSON.stringify(cuerpo),
});

/**
 * El servidor del alta. `perderRespuestas` = cuántas respuestas de POST se pierden a la vuelta (el
 * albarán SÍ se crea). `ignorarClave` = el servidor de antes de SCRUM-358: el CONTROL NEGATIVO.
 */
function servidor({ perderRespuestas = 0, ignorarClave = false } = {}) {
  const creados = [];
  const porClave = new Map();
  const posts = [];
  let perdidas = 0;
  const fetch = async (url, opts = {}) => {
    const u = String(url);
    const metodo = String(opts.method || 'GET').toUpperCase();
    if (metodo === 'POST' && /\/admin\/jobs\/42\/albaranes$/.test(u)) {
      const cuerpo = JSON.parse(opts.body);
      posts.push(cuerpo);
      const n = normalizarClaveIdempotencia(ignorarClave ? undefined : cuerpo.claveIdempotencia);
      if (!n.ok) return respuesta(400, { error: n.error, message: n.message });
      let alb = n.clave ? porClave.get(n.clave) : null;
      if (!alb) {
        alb = { id: 500 + creados.length + 1, numero: `AB2600${creados.length + 1}`, estado: 'borrador' };
        creados.push(alb);
        if (n.clave) porClave.set(n.clave, alb);
      }
      if (perdidas < perderRespuestas) { perdidas++; throw new TypeError('Failed to fetch'); }
      return respuesta(201, alb);
    }
    if (/\/admin\/albaranes\/serie/.test(u)) return respuesta(200, { siguiente: `AB2600${creados.length + 1}` });
    if (/\/admin\/team/.test(u) || /gastos/.test(u)) return respuesta(200, []);
    if (/\/admin\/partes/.test(u)) return respuesta(200, { partes: [] });
    if (/\/admin\/merchant/.test(u)) return respuesta(200, { name: 'Epipe' });
    return respuesta(200, JOB);
  };
  return { fetch, creados, posts };
}

async function pulsar(nodo) {
  const fns = (nodo._oyentes && nodo._oyentes.click) || [];
  assert.ok(fns.length > 0, `🔴 CIEGO: «${nodo.textContent}» no tiene ningún oyente de clic`);
  await Promise.all(fns.map((fn) => fn.call(nodo, { type: 'click', target: nodo, preventDefault() {}, stopPropagation() {} })));
  await respirar(20);
}
const botonPorTexto = (doc, texto) => [...doc.querySelectorAll('button')].find((b) => String(b.textContent).trim() === texto) || null;

async function montar(srv) {
  const banco = cargarDashboard(RAIZ, { red: { fetch: srv.fetch } });
  banco.ctx.appUserRole = 'admin';
  const r = await pintarVista(banco, 'renderJobDetailView');
  assert.equal(r.error, null, `SUELO: la ficha no monta (${r.error && r.error.message})`);
  return banco.ctx.document;
}

/** Abre la hoja de alta y rellena una línea. Devuelve el botón «Crear albarán» de ESA hoja. */
async function abrirHoja(doc) {
  const nuevo = botonPorTexto(doc, '+ Nuevo albarán');
  assert.ok(nuevo, 'CIEGO: no encuentro «+ Nuevo albarán»');
  await pulsar(nuevo);
  const overlays = doc.querySelectorAll('.modal-overlay');
  const overlay = overlays[overlays.length - 1];
  assert.ok(overlay, 'CIEGO: la hoja de alta no se abrió');
  const [concepto, cantidad] = overlay.querySelectorAll('.input');
  assert.ok(concepto && cantidad, 'CIEGO: no encuentro los campos de la línea');
  concepto.value = 'Sustituir termostato';
  cantidad.value = '1';
  const crear = [...overlay.querySelectorAll('button')].find((b) => String(b.textContent).trim() === 'Crear albarán');
  assert.ok(crear, 'CIEGO: la hoja no tiene «Crear albarán»');
  return crear;
}

test('SCRUM-1267 · 🔴 EL VIAJE: la respuesta se pierde, se reintenta, y sale UN solo albarán', async () => {
  const srv = servidor({ perderRespuestas: 1 });
  const doc = await montar(srv);
  const crear = await abrirHoja(doc);
  await pulsar(crear);            // el POST llega, el albarán se crea, la respuesta muere
  assert.equal(srv.posts.length, 1, 'SUELO: el primer clic no llegó al POST');
  await pulsar(crear);            // el profesional no sabe si salió: reintenta desde la MISMA hoja
  assert.equal(srv.posts.length, 2, 'SUELO: el reintento no llegó al POST (¿la hoja se cerró o bloqueó el botón?)');

  const [a, b] = srv.posts.map((p) => p.claveIdempotencia);
  assert.equal(typeof a, 'string', '🔴 el alta NO manda `claveIdempotencia`');
  assert.equal(a, b, '🔴 el reintento lleva OTRA clave: se acuña en cada clic y no protege de nada');
  assert.ok(normalizarClaveIdempotencia(a).ok && normalizarClaveIdempotencia(a).clave, '🔴 el servidor rechaza la clave que manda el front');
  assert.equal(srv.creados.length, 1, `🔴 salen ${srv.creados.length} albaranes con números seguidos`);
});

test('SCRUM-1267 · CONTROL NEGATIVO: el mismo viaje contra un servidor que IGNORA la clave saca DOS', async () => {
  // Sin esto, un servidor de mentira que deduplicara siempre haría pasar el test de arriba sin clave.
  const srv = servidor({ perderRespuestas: 1, ignorarClave: true });
  const doc = await montar(srv);
  const crear = await abrirHoja(doc);
  await pulsar(crear);
  await pulsar(crear);
  assert.equal(srv.posts.length, 2, 'SUELO: no hubo dos POST');
  assert.equal(srv.creados.length, 2, '🔴 el servidor de mentira deduplica sin clave: el test de arriba no mediría nada');
});

test('SCRUM-1267 · 🔴 dos altas LEGÍTIMAS (dos hojas) llevan claves DISTINTAS y salen dos', async () => {
  // La otra mitad de la idempotencia: la clave es por intento de alta, no por Trabajo. Si fuera fija,
  // el segundo albarán de verdad de un Trabajo se «deduplicaría» contra el primero y no existiría.
  const srv = servidor();
  const doc = await montar(srv);
  await pulsar(await abrirHoja(doc));
  await pulsar(await abrirHoja(doc));
  assert.equal(srv.posts.length, 2, 'SUELO: no hubo dos altas');
  assert.notEqual(srv.posts[0].claveIdempotencia, srv.posts[1].claveIdempotencia,
    '🔴 dos hojas distintas comparten clave: el segundo albarán legítimo se perdería');
  assert.equal(srv.creados.length, 2);
});

test('SCRUM-1267 · el cuerpo del alta no cambia de forma: solo se AÑADE la clave', async () => {
  const srv = servidor();
  const doc = await montar(srv);
  await pulsar(await abrirHoja(doc));
  assert.equal(srv.posts.length, 1);
  const { claveIdempotencia, ...resto } = srv.posts[0];
  assert.ok(claveIdempotencia);
  assert.equal(resto.lineas.length, 1, '🔴 la línea rellenada ya no viaja');
  assert.equal(resto.lineas[0].concepto, 'Sustituir termostato');
});
