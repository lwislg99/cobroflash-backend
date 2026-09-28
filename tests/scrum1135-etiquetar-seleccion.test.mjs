// SCRUM-1135 · LA SELECCIÓN DE CLIENTES POR FIN SE PUEDE ETIQUETAR.
//
// `POST /admin/customers/bulk-tags` (SCRUM-1059) estaba construido y la sonda AST de SCRUM-1185 lo
// daba SIN consumidor: la barra de selección de la lista sólo contaba. Aquí se mide la pantalla REAL
// (banco de vistas), pulsando: marcar dos clientes → escribir la etiqueta → «Añadir etiqueta» → qué
// petición sale, qué aviso queda y si la lista se recarga.
//
// Textos firmados en SCRUM-1135 comentario 17447 (registro:
// docs/microcopy/2026-09-28-SCRUM-1135-etiquetar-seleccion.md). Los motivos por cliente que devuelve
// el servidor NO se pintan (son textos suyos sin firmar), y el error de red tampoco se pinta crudo
// (el «Failed to fetch» de SCRUM-1200): hay un caso para cada uno.

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { constaAprobado } from './_microcopy-aprobada.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const espera = () => new Promise((r) => setTimeout(r, 30));

const cliente = (id, name, tags = null) => ({
  id, name, phone: null, mobile: null, email: null, notes: null, portalToken: null,
  createdAt: '2026-09-01T00:00:00.000Z', waOptOut: false, taxId: null, tags,
});
const CLIENTES = [cliente(11351, 'Ana Etiqueta 1135'), cliente(11352, 'Bea Etiqueta 1135', ['vip']), cliente(11353, 'Carla Etiqueta 1135')];

/**
 * Monta la lista con `rol` y una respuesta para `bulk-tags`. `respuesta` puede ser un objeto (200)
 * o la cadena 'sin-red' (el `fetch` lanza, como el navegador sin cobertura).
 */
async function montar({ rol = 'admin', respuesta = { actualizados: 0, resultados: [] } } = {}) {
  const peticiones = [];
  const datos = (url) => (/\/admin\/customers/.test(String(url)) ? CLIENTES : []);
  const red = {
    fetch: async (url, opts = {}) => {
      const u = String(url);
      peticiones.push({ url: u, metodo: String(opts.method || 'GET').toUpperCase(), cuerpo: opts.body ? JSON.parse(opts.body) : null });
      if (/\/admin\/customers\/bulk-tags$/.test(u)) {
        if (respuesta === 'sin-red') throw new TypeError('Failed to fetch');
        return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => respuesta, text: async () => '' };
      }
      return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => datos(u), text: async () => '' };
    },
  };
  const banco = cargarDashboard(RAIZ, { rol, red, datos });
  assert.deepEqual(banco.fallos, [], 'un script del panel no cargó: nada de lo de abajo mediría');
  const r = await pintarVista(banco, 'renderCustomersView');
  assert.equal(r.error, null, `la lista de clientes no montó: ${r.error && r.error.message}`);
  await espera();
  const c = r.contenedor;
  const casillas = todos(c).filter((n) => n.tagName === 'INPUT' && n.type === 'checkbox'
    && /Etiqueta 1135/.test(n.getAttribute('aria-label') || ''));
  assert.equal(casillas.length, CLIENTES.length, `🔴 CIEGO: ${casillas.length} casillas de fila y hay ${CLIENTES.length} clientes`);
  const acciones = todos(c).find((n) => n.className === 'barra-seleccion-etiquetar') || null;
  const boton = (t) => (acciones ? todos(acciones).find((n) => n.tagName === 'BUTTON' && (n.textContent || '').trim() === t) : null);
  const campo = acciones ? todos(acciones).find((n) => n.tagName === 'INPUT') : null;
  const aviso = () => { const a = todos(c).find((n) => n.className && String(n.className).split(' ')[0] === 'alert'); return a ? { texto: a.textContent, clase: a.className } : null; };
  const marcar = (i) => { casillas[i].checked = true; casillas[i].disparar('change'); };
  return { c, peticiones, acciones, campo, boton, aviso, marcar };
}

test('SCRUM-1135 · 🔴 marcar dos, escribir, «Añadir etiqueta» → POST bulk-tags con los dos ids, y la lista se recarga', async () => {
  const m = await montar({ respuesta: { actualizados: 1, resultados: [{ id: 11351, actualizado: true }, { id: 11352, actualizado: false, motivo: 'Ya la tenía' }] } });
  assert.ok(m.acciones, '🔴 la barra de selección no tiene acciones de etiquetar: la ruta sigue sin consumidor');
  assert.equal(m.acciones.style.display, 'none', 'con cero marcados no se ofrece etiquetar');
  m.marcar(0); m.marcar(1);
  assert.equal(m.acciones.style.display, 'flex', 'con dos marcados se ofrece');
  const anadir = m.boton('Añadir etiqueta');
  assert.ok(anadir && m.boton('Quitar etiqueta') && m.campo, '🔴 faltan el campo o los dos botones');
  assert.equal(anadir.disabled, true, 'con el campo vacío no se puede añadir');
  m.campo.value = '  vip  ';
  m.campo.disparar('input');
  assert.equal(anadir.disabled, false);

  const antes = m.peticiones.length;
  await anadir.disparar('click');
  await espera();
  const nuevas = m.peticiones.slice(antes);
  const post = nuevas.find((p) => p.metodo === 'POST');
  assert.ok(post && post.url.endsWith('/admin/customers/bulk-tags'), `🔴 no salió el POST a bulk-tags: ${JSON.stringify(nuevas)}`);
  assert.deepEqual(post.cuerpo, { ids: [11351, 11352], accion: 'add', etiqueta: 'vip' });
  assert.ok(nuevas.slice(nuevas.indexOf(post) + 1).some((p) => p.metodo === 'GET' && /\/admin\/customers/.test(p.url)),
    '🔴 tras etiquetar la lista no se recarga: las etiquetas nuevas no se verían');
  const a = m.aviso();
  assert.equal(a && a.texto, 'Etiqueta añadida a 1 cliente · 1 ya la tenía o no caben más etiquetas');
  assert.ok(!/Ya la tenía/.test(a.texto), 'el motivo del servidor (sin firmar) no se pinta');
});

test('SCRUM-1135 · «Quitar etiqueta» manda remove, y el recuento usa los textos de quitar', async () => {
  const m = await montar({ respuesta: { actualizados: 2, resultados: [{ id: 11351, actualizado: true }, { id: 11352, actualizado: true }, { id: 11353, actualizado: false, motivo: 'No la tenía' }] } });
  m.marcar(0); m.marcar(1); m.marcar(2);
  m.campo.value = 'vip'; m.campo.disparar('input');
  const antes = m.peticiones.length;
  await m.boton('Quitar etiqueta').disparar('click');
  await espera();
  const post = m.peticiones.slice(antes).find((p) => p.metodo === 'POST');
  assert.equal(post && post.cuerpo.accion, 'remove');
  assert.equal(m.aviso().texto, 'Etiqueta quitada de 2 clientes · 1 no la tenía');
});

test('SCRUM-1135 · 🔴 sin red: sale el texto firmado, NUNCA el «Failed to fetch» del navegador', async () => {
  const m = await montar({ respuesta: 'sin-red' });
  m.marcar(0);
  m.campo.value = 'vip'; m.campo.disparar('input');
  await m.boton('Añadir etiqueta').disparar('click');
  await espera();
  const a = m.aviso();
  assert.equal(a && a.texto, 'No se pudieron cambiar las etiquetas');
  assert.match(a.clase, /error/);
  assert.equal(m.boton('Añadir etiqueta').disabled, false, 'tras el fallo se puede reintentar');
});

test('SCRUM-1135 · a un técnico no se le ofrece: la ruta es requireRole(admin) y daría 403', async () => {
  const m = await montar({ rol: 'tecnico' });
  assert.equal(m.acciones, null, '🔴 el técnico ve acciones de etiquetar que acaban en 403');
  // Suelo: la selección sigue existiendo para él; lo único que no tiene es la acción.
  m.marcar(0);
});

test('SCRUM-1135 · resumenDelEtiquetado: singular, plural y «ninguno cambió»', () => {
  const FC = cargarDashboard(RAIZ).ctx.filtroClientes;
  const res = (accion, n, m) => FC.resumenDelEtiquetado(accion, {
    actualizados: n,
    resultados: [...Array(n)].map(() => ({ actualizado: true })).concat([...Array(m)].map(() => ({ actualizado: false }))),
  });
  assert.deepEqual({ ...res('add', 3, 0) }, { texto: 'Etiqueta añadida a 3 clientes', tipo: 'success' });
  assert.deepEqual({ ...res('add', 0, 2) }, { texto: '2 ya la tenían o no caben más etiquetas', tipo: null });
  assert.deepEqual({ ...res('remove', 1, 0) }, { texto: 'Etiqueta quitada de 1 cliente', tipo: 'success' });
  assert.deepEqual({ ...res('remove', 0, 4) }, { texto: '4 no la tenían', tipo: null });
});

test('SCRUM-1135 · cada texto de la acción consta firmado en SCRUM-1135, y «20» no aparece', () => {
  const T = cargarDashboard(RAIZ).ctx.filtroClientes.TEXTOS_ETIQUETADO;
  const valores = Object.values(T);
  assert.equal(valores.length, 12, 'doce ranuras: las del comentario 17447');
  for (const t of valores) {
    assert.ok(constaAprobado(t).some((f) => f.includes('SCRUM-1135')), `🔴 «${t}» no consta firmado en SCRUM-1135`);
    assert.ok(!/\b20\b/.test(t), `🔴 «${t}» escribe el tope a mano (vive en MAXIMO_POR_CLIENTE)`);
  }
  // Control negativo: la versión propuesta con el «20», rechazada en la firma, no consta.
  assert.deepEqual(constaAprobado('1 ya la tenía o ya tiene 20 etiquetas'), []);
});
