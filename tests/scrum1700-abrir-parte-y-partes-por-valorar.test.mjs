// tests/scrum1700-abrir-parte-y-partes-por-valorar.test.mjs — SCRUM-1700 (T7 de SCRUM-1686, S4)
//
// LO PRIMERO QUE VE EL OPERARIO DEL PILOTO: un Trabajo EN CURSO lleva a SU parte con un botón.
//
// Textos FIRMADOS por el fundador en la tanda N1-N13 de SCRUM-1686 («si firmo», c.21470):
//   · N1 · «Abrir parte» — Lista de Trabajos, trabajo EN CURSO, botón principal.
//   · N2 · «Partes por valorar · 2» — Menú, entrada de la oficina, con el número de partes
//     firmados esperando precio.
//
// Lo que se fija aquí, montando la vista REAL en el banco (sin navegador):
//   ① la fila EN CURSO lleva UN «Abrir parte» primario; las de otro estado, ninguno;
//   ② va FUERA de `.jobs-acciones` (que es la escalera, y `guard:escalera-por-estado` la compara
//     con el detalle — mismo criterio que «Ver detalle», SCRUM-1562f);
//   ③ abre el BORRADOR del Trabajo si lo hay (no un parte firmado de otra visita) y si no, lo CREA:
//     ni seis partes vacíos por entrar a mirar, ni escribir encima de una visita ya firmada (D2);
//   ④ la puerta vieja de la cabecera («Partes por valorar» junto a «Nuevo trabajo») ya no está: la
//     entrada vive en el menú;
//   ⑤ el menú dice cuántos esperan; si no se sabe, el rótulo a secas (nunca un número inventado),
//     y el operario ni lo pide (la ruta es de admin).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { datosDelCenso } from '../scripts/_datos-del-censo.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const clase = (n) => String((n && n.className) || '');
const tiene = (n, c) => new RegExp(`\\b${c}\\b`).test(clase(n));
const rotulo = (n) => todos(n).map((x) => x._texto || '').join(' ').replace(/\s+/g, ' ').trim();
const antepasados = (n) => { const r = []; for (let p = n._padre; p; p = p._padre) r.push(p); return r; };
const botones = (raiz, texto) => todos(raiz).filter((n) => n.tagName === 'BUTTON' && rotulo(n) === texto);

const ESTADOS = ['en_curso', 'agendado', 'terminado'];

/** Monta la lista con tres Trabajos (uno por estado) y una red que anota lo que se pide. */
async function montar({ partes = [], creado = { id: 77 } } = {}) {
  const dc = datosDelCenso();
  dc.enVista('renderJobsView');
  const pedidas = [];
  const navegado = [];
  const datos = (url, opts) => {
    const p = String(url).replace(/^https?:\/\/[^/]+/, '').replace(/[?#].*$/, '');
    const metodo = (opts && opts.method) || 'GET';
    pedidas.push(`${metodo} ${p}${opts && opts.body ? ' ' + opts.body : ''}`);
    if (p === '/admin/jobs') {
      const base = dc.datos('/admin/jobs')[0];
      return ESTADOS.map((status, i) => ({ ...structuredClone(base), id: 101 + i, status, titulo: `T-${status}`, tituloPropio: `T-${status}` }));
    }
    if (p === '/admin/partes' && metodo === 'GET') return { partes };
    if (p === '/admin/partes' && metodo === 'POST') return creado;
    return dc.datos(url, opts);
  };
  const banco = cargarDashboard(RAIZ, { datos });
  banco.ctx.renderAppView = (vista, o) => { navegado.push([vista, o]); };
  const r = await pintarVista(banco, 'renderJobsView');
  assert.equal(r.error, null, `🔴 la lista revienta: ${r.error && r.error.message}`);
  const filas = r.contenedor ? todos(r.contenedor).filter((n) => n.tagName === 'TR' && tiene(n, 'jobs-fila')) : [];
  assert.equal(filas.length, ESTADOS.length, `🔴 CIEGO: pedí ${ESTADOS.length} Trabajos y salen ${filas.length} filas`);
  const porEstado = Object.fromEntries(ESTADOS.map((e) => [e, filas.find((f) => rotulo(f).includes(`T-${e}`))]));
  for (const e of ESTADOS) assert.ok(porEstado[e], `🔴 CIEGO: no encuentro la fila del Trabajo ${e}`);
  return { banco, r, porEstado, pedidas, navegado };
}

const espera = () => new Promise((ok) => setTimeout(ok, 20));

test('SCRUM-1700 ① · la fila EN CURSO lleva UN «Abrir parte» primario; las demás, ninguno', async () => {
  const { porEstado } = await montar();
  const enCurso = botones(porEstado.en_curso, 'Abrir parte');
  assert.equal(enCurso.length, 1, `🔴 la fila en curso tiene ${enCurso.length} «Abrir parte» (N1 pide uno)`);
  assert.ok(tiene(enCurso[0], 'btn-primary'), `🔴 «Abrir parte» es «${clase(enCurso[0])}»: N1 lo firma como botón PRINCIPAL`);
  for (const e of ['agendado', 'terminado']) {
    assert.equal(botones(porEstado[e], 'Abrir parte').length, 0, `🔴 la fila ${e} también ofrece «Abrir parte»; N1 es del trabajo EN CURSO`);
  }
});

test('SCRUM-1700 ② · «Abrir parte» va FUERA de `.jobs-acciones` (la escalera), en la celda de su fila', async () => {
  const { porEstado } = await montar();
  const [b] = botones(porEstado.en_curso, 'Abrir parte');
  assert.ok(b, '🔴 CIEGO: no hay «Abrir parte» que ubicar');
  const arriba = antepasados(b);
  assert.equal(arriba.find((p) => tiene(p, 'jobs-acciones')), undefined,
    '🔴 «Abrir parte» cuelga de `.jobs-acciones`: la lista propondría algo que el detalle no propone (guard:escalera-por-estado).');
  assert.ok(arriba.includes(porEstado.en_curso), '🔴 «Abrir parte» no cuelga de su propia fila');
  assert.ok(tiene(b._padre, 'jobs-celda-acciones'), `🔴 el padre de «Abrir parte» es «${clase(b._padre)}»`);
  assert.equal(b.dataset && b.dataset.filaNoNavega, '1', '🔴 el clic en «Abrir parte» también navegaría a la ficha del Trabajo');
});

test('SCRUM-1700 ③ · abre el BORRADOR de ESTE trabajo, no el firmado ni el de otro, y no crea nada', async () => {
  const partes = [
    { id: 9, jobId: 101, estado: 'firmado' },
    { id: 5, jobId: 999, estado: 'borrador' },
    { id: 8, jobId: 101, estado: 'borrador' },
  ];
  const { porEstado, pedidas, navegado } = await montar({ partes });
  botones(porEstado.en_curso, 'Abrir parte')[0].click();
  await espera();
  assert.equal(pedidas.filter((p) => p.startsWith('POST /admin/partes')).length, 0, `🔴 creó un parte habiendo un borrador: ${pedidas.join(' | ')}`);
  assert.deepEqual(JSON.parse(JSON.stringify(navegado.at(-1))), ['parte-detail', { parteId: 8 }], `🔴 navegó a ${JSON.stringify(navegado.at(-1))}`);
});

test('SCRUM-1700 ③ · sin borrador (sólo uno firmado), CREA el parte de esta visita y lo abre', async () => {
  const { porEstado, pedidas, navegado } = await montar({ partes: [{ id: 9, jobId: 101, estado: 'firmado' }], creado: { id: 77 } });
  botones(porEstado.en_curso, 'Abrir parte')[0].click();
  await espera();
  const post = pedidas.filter((p) => p.startsWith('POST /admin/partes'));
  assert.equal(post.length, 1, `🔴 se esperaba UN alta de parte: ${pedidas.join(' | ')}`);
  assert.deepEqual(JSON.parse(post[0].slice('POST /admin/partes '.length)), { jobId: 101 });
  assert.deepEqual(JSON.parse(JSON.stringify(navegado.at(-1))), ['parte-detail', { parteId: 77 }]);
});

test('SCRUM-1700 ④ · la cabecera de la lista ya no lleva la puerta vieja «Partes por valorar»', async () => {
  const { banco } = await montar();
  const todo = todos(banco.ctx.document.body);
  assert.equal(todo.filter((n) => n.id === 'jobs-partes-valorar').length, 0, '🔴 sigue el botón #jobs-partes-valorar en la cabecera');
  assert.equal(todo.filter((n) => n.tagName === 'BUTTON' && rotulo(n) === 'Partes por valorar').length, 0,
    '🔴 sigue un botón «Partes por valorar» en la lista de Trabajos: la entrada vive en el menú (N2)');
});

function conRotulo() {
  const b = cargarDashboard(RAIZ, {});
  assert.equal(typeof b.ctx.contarPartesPorValorar, 'function', '🔴 `app.js` no publica `contarPartesPorValorar`');
  const span = b.mk('span');
  span.id = 'nav-partes-oficina-label';
  span.textContent = 'Partes por valorar';
  b.ctx.document.body.appendChild(span);
  return { b, span };
}

test('SCRUM-1700 ⑤ · el menú dice cuántos esperan: «Partes por valorar · 2»', async () => {
  const { b, span } = conRotulo();
  const pedidas = [];
  const n = await b.ctx.contarPartesPorValorar(b.ctx.document, async (ruta) => { pedidas.push(ruta); return { pendientes: [{ id: 1 }, { id: 2 }], firmadosLeidos: 5 }; }, 'admin');
  assert.deepEqual(pedidas, ['/admin/partes/oficina/pendientes']);
  assert.equal(n, 2);
  assert.equal(span.textContent, 'Partes por valorar · 2');
});

test('SCRUM-1700 ⑤ · sin ninguno, o sin saberlo, el rótulo a secas; el operario no lo pide', async () => {
  for (const [caso, respuesta] of [['cero', { pendientes: [], firmadosLeidos: 3 }], ['forma rara', { nada: true }]]) {
    const { b, span } = conRotulo();
    await b.ctx.contarPartesPorValorar(b.ctx.document, async () => respuesta, 'admin');
    assert.equal(span.textContent, 'Partes por valorar', `🔴 caso ${caso}: «${span.textContent}»`);
  }
  {
    const { b, span } = conRotulo();
    span.textContent = 'Partes por valorar · 4';
    await b.ctx.contarPartesPorValorar(b.ctx.document, async () => { throw new Error('red'); }, 'admin');
    assert.equal(span.textContent, 'Partes por valorar', '🔴 un fallo de red deja un número viejo a la vista');
  }
  {
    const { b } = conRotulo();
    const pedidas = [];
    await b.ctx.contarPartesPorValorar(b.ctx.document, async (r) => { pedidas.push(r); return { pendientes: [] }; }, 'tecnico');
    assert.deepEqual(pedidas, [], '🔴 el operario pide una ruta de admin (403 seguro)');
  }
});
