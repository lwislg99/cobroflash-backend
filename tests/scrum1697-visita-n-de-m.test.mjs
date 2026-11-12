// SCRUM-1697 (T4 de la ③ de SCRUM-1686) · «VISITA {n} DE {m}» EN LA CABECERA DEL PARTE.
//
// M2 del máster (073c67ade, SCRUM-1686 c.21479): un trabajo, varios partes, uno por visita; «la
// visita ES su parte». «Visita {n} de {m}» (N4) cuenta los partes del trabajo por `fecha` y, a igual
// fecha, por `numero`; `m` = todos los partes del trabajo, también los borradores.
// Texto FIRMADO: N4 de la tanda N1-N13 de SCRUM-1686 (c.21471 según el máster) — «Visita {n} de {m}»,
// cabecera del parte, con varios en el trabajo.
//
// Lo que se fija:
//   ① el orden es fecha y, a igual fecha, número; m cuenta también los borradores;
//   ② con un solo parte en el trabajo no se dice nada (N4 es «con varios»);
//   ③ un parte que no está en la lista, o sin trabajo, no inventa un número;
//   ④ la cabecera lo pinta con el texto firmado, tras el número del parte;
//   ⑤ si el trabajo no se pudo leer, la cabecera se queda sin número (falla cerrado).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PARTES = Object.freeze([
  { id: 21, numero: 'PT-2026-012', fecha: '2026-11-12T08:00:00.000Z', estado: 'borrador' },
  { id: 13, numero: 'PT-2026-005', fecha: '2026-11-10T08:00:00.000Z', estado: 'firmado' },
  { id: 17, numero: 'PT-2026-009', fecha: '2026-11-11T08:00:00.000Z', estado: 'firmado' },
  { id: 16, numero: 'PT-2026-008', fecha: '2026-11-11T08:00:00.000Z', estado: 'firmado' },
]);

const BASE = Object.freeze({
  id: 17, numero: 'PT-2026-009', clienteNombre: 'Cliente de pruebas', jobId: 77,
  fecha: '2026-11-11T08:00:00.000Z', obra: null, referencia: null,
  entrada: '09:10', salida: '11:40', desplazamientos: 1, kilometros: 8,
  tecnicos: [], tipo: null,
  lineas: [{ bloque: 'mano_obra', unds: 1, descripcion: 'Revisión' }],
  notas: null, estado: 'firmado', firmoElCliente: true, firmoElTecnico: false,
  puedeEditarContenido: { ok: false, motivo: 'firmado' }, puedeEditarPrecios: { ok: true, motivo: null },
});

const attr = (n, a) => (n.getAttribute ? n.getAttribute(a) : null);
const texto = (n) => todos(n).map((x) => x._texto || '').join('').replace(/\s+/g, ' ').trim();
const visitaEn = (c) => {
  const n = todos(c).find((x) => attr(x, 'data-parte-visita') === '1');
  return n ? texto(n) : null;
};

test('SCRUM-1697 · el texto es el firmado (N4), literal', () => {
  const b = cargarDashboard(RAIZ);
  assert.equal(b.ctx.PARTE_TEXTOS.visitaDeLas, 'Visita {n} de {m}');
});

test('SCRUM-1697 ① orden por fecha y, a igual fecha, por número; m cuenta los borradores', () => {
  const { ctx } = cargarDashboard(RAIZ);
  const v = ctx.parteVisitaDelParte;
  assert.equal(typeof v, 'function', 'falta `parteVisitaDelParte`');
  assert.deepEqual({ ...v(13, PARTES) }, { n: 1, m: 4 });
  assert.deepEqual({ ...v(16, PARTES) }, { n: 2, m: 4 }, 'a igual fecha, PT-…-008 va antes que PT-…-009');
  assert.deepEqual({ ...v(17, PARTES) }, { n: 3, m: 4 });
  assert.deepEqual({ ...v(21, PARTES) }, { n: 4, m: 4 }, 'el borrador cuenta');
});

test('SCRUM-1697 ②③ con uno solo, fuera de la lista o sin lista: nada', () => {
  const { ctx } = cargarDashboard(RAIZ);
  const v = ctx.parteVisitaDelParte;
  assert.equal(v(13, [PARTES[1]]), null, 'un solo parte en el trabajo: no se dice «Visita 1 de 1»');
  assert.equal(v(99, PARTES), null, 'un parte que no está en la lista no inventa un número');
  assert.equal(v(13, null), null);
  assert.equal(v(13, []), null);
});

test('SCRUM-1697 ④ la cabecera dice «PT-… · Visita n de m» tras leer el trabajo', async () => {
  const b = cargarDashboard(RAIZ);
  const c = b.mk('div');
  assert.equal(b.ctx.renderParte(c, BASE), true, '🔴 SUELO: la vista se negó a pintar');
  assert.equal(visitaEn(c), '', 'antes de leer el trabajo la cabecera no lleva número');
  const pedidas = [];
  const pedir = async (ruta) => { pedidas.push(ruta); return { id: 77, partes: PARTES.map((p) => ({ ...p })) }; };
  await b.ctx.partePintarVisita(c, BASE, pedir);
  assert.deepEqual(pedidas, ['/admin/jobs/77']);
  assert.equal(visitaEn(c), '· Visita 3 de 4');
});

test('SCRUM-1697 ⑤ falla cerrado: sin trabajo no pide; si la lectura falla, sin número', async () => {
  const b = cargarDashboard(RAIZ);
  const c = b.mk('div');
  b.ctx.renderParte(c, { ...BASE, jobId: null });
  let pidio = false;
  await b.ctx.partePintarVisita(c, { ...BASE, jobId: null }, async () => { pidio = true; return {}; });
  assert.equal(pidio, false, 'un parte sin trabajo no tiene visitas que contar');
  assert.equal(visitaEn(c), '');

  const c2 = b.mk('div');
  b.ctx.renderParte(c2, BASE);
  await b.ctx.partePintarVisita(c2, BASE, async () => { throw new Error('sin red'); });
  assert.equal(visitaEn(c2), '', 'sin la lista no se pone un número');
});
