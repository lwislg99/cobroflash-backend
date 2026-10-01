// tests/scrum1302a-marca-en-la-vista-de-oficina.test.mjs — SCRUM-1302 (A)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL DUEÑO EDITA LA DESCRIPCIÓN DE UNA LÍNEA MARCADA Y EL AVISO DEL DATO INVENTADO SE VA
//
// Medido el 29-sep por S4 pulsando, y otra vez el 30-sep sobre `b6243e1c`: la marca de SCRUM-1266
// SIGUE en la base, pero la pantalla la pierde. El `PATCH /admin/partes/:id` responde con rol
// `admin` la vista de OFICINA (`serializeParteParaLaOficina`), cuyas líneas no llevaban
// `datosNoRespaldados`; la ficha hace `parte.lineas = r.lineas` y repinta el aviso con eso. Con el
// técnico no pasa (su vista sí la lleva), y cambiando la CANTIDAD tampoco (ese camino no repinta el
// aviso). Por eso SCRUM-1266 lo dio por bueno: se probó un camino, no todos los que lo alcanzan.
//
// ── EL BANCO: LA VISTA DE VERDAD CONTRA LA RUTA DE VERDAD ────────────────────────────────────────
// `parteDetailView.js` en `vm`, hablando con `dist/…/partes.routes.js` (base doblada por
// `_envio-doblado.mjs`), con los DOS roles: se cambia sólo `userRole`. No se construye a mano la
// respuesta de la ruta: lo que se mide es lo que la ruta devuelve y lo que la ficha pinta con ello.
//
// CONTROL POSITIVO: el técnico conserva el aviso por el mismo camino (si el banco no lo ve, no sabe
// distinguir); y corregir el dato de verdad lo quita también para el dueño (el aviso sigue a lo
// escrito, no se queda pegado).
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { inyectarBase, moduloDeDist, MERCHANT } from './_envio-doblado.mjs';
import { nodo, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const RUTAS = '../dist/modules/jobs/app/routes/partes.routes.js';
const VISTA = path.join(RAIZ, 'public', 'dashboard', 'js', 'parteDetailView.js');
const FUENTE = fs.readFileSync(VISTA, 'utf8');
const copia = (x) => JSON.parse(JSON.stringify(x));
const vaciar = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r)); };

const PARTE_ID = 1302;
const JOB_ID = 13020;
const TECNICO = 13021;
const INVENTADA = 'Revisión de central Honeywell Galaxy';
const MARCA = ['Honeywell', 'Galaxy'];

function filaDelParte() {
  return {
    id: PARTE_ID, merchantId: MERCHANT, jobId: JOB_ID, customerId: null,
    numero: 'PT-2026-1302', fecha: '2026-09-30T08:00:00.000Z', obra: null, referencia: null,
    entrada: null, salida: null, desplazamientos: null, kilometros: null, tecnicos: [],
    tipo: null, notas: null, estado: 'borrador',
    lineas: [
      { id: 'a', bloque: 'mano_obra', unds: 1, descripcion: INVENTADA, datosNoRespaldados: MARCA },
      { id: 'b', bloque: 'mano_obra', unds: 2, descripcion: 'Purga del circuito' },
    ],
    firmadoAt: null, firmadoPorNombre: null, firmadoPorCalidad: null,
    firmadoTecnicoAt: null, firmadoTecnicoNombre: null, contenidoHash: null, contenidoVersion: null,
  };
}

function manejador(router, metodo, ruta) {
  const capa = router.stack.find((l) => l.route && l.route.path === ruta && l.route.methods[metodo]);
  assert.ok(capa, `🔴 CIEGO: no encuentro ${metodo.toUpperCase()} ${ruta} en el router de partes`);
  const pila = capa.route.stack;
  return pila[pila.length - 1].handle;
}

/** La ruta de verdad sobre una fila en memoria, pedida con el ROL que se diga. */
function servidorDeVerdad(fila, userRole) {
  inyectarBase({
    'parteTrabajo.findFirst': ({ where }) =>
      (where.id === fila.id && where.merchantId === MERCHANT ? copia(fila) : null),
    'job.findFirst': ({ where }) =>
      (where.id === JOB_ID && where.merchantId === MERCHANT
        ? { operarioId: TECNICO, assignedUserId: null, assignees: [] } : null),
    'parteTrabajo.update': ({ where, data }) => {
      assert.equal(where.id, fila.id);
      Object.assign(fila, copia(data));
      return copia(fila);
    },
  }, [RUTAS]);
  const router = moduloDeDist(RUTAS).default;
  const respuestas = [];
  const apiRequest = async (ruta, o = {}) => {
    const metodo = (o.method || 'GET').toLowerCase();
    const body = o.body ? JSON.parse(o.body) : undefined;
    assert.equal(ruta, '/admin/partes/' + PARTE_ID, `🔴 CIEGO: la vista pidió una ruta que este banco no sirve: ${ruta}`);
    const h = manejador(router, metodo, '/:id');
    const r = { status: 200, data: undefined };
    const res = { status(s) { r.status = s; return res; }, json(j) { r.data = copia(j); return res; } };
    await h({ params: { id: String(PARTE_ID) }, body, merchantId: MERCHANT, userRole, teamMemberId: TECNICO }, res);
    respuestas.push({ metodo, status: r.status, data: r.data });
    if (r.status >= 400) throw new Error('HTTP ' + r.status + ' ' + JSON.stringify(r.data));
    return r.data;
  };
  return { apiRequest, respuestas };
}

async function montar(srv) {
  const reg = { porId: new Map(), selectoresNoSoportados: [] };
  const ctx = {
    console, window: null, Date, Array, Object, String, Number, JSON, Promise, Error, isFinite,
    document: { createElement: (t) => nodo(t, reg) },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(FUENTE, ctx, { filename: 'parteDetailView.js' });
  const cont = nodo('div', reg);
  assert.equal(await ctx.renderParteDetailView(cont, PARTE_ID, { apiRequest: srv.apiRequest }), true,
    '🔴 NO PUDE MIRAR: la vista no pintó el parte');
  return cont;
}

const casilla = (cont, atributo, i) => todos(cont).find((x) => x.getAttribute && x.getAttribute(atributo) === String(i));
const aviso = (cont) => casilla(cont, 'data-no-dictado', 0);

async function editarDescripcion(cont, valor) {
  const desc = casilla(cont, 'data-linea-desc', 0);
  assert.ok(desc, '🔴 NO PUDE MIRAR: no está la descripción editable de la línea 0');
  desc.value = valor;
  desc.disparar('change');
  await vaciar();
}

for (const rol of ['admin', 'tecnico']) {
  test(`SCRUM-1302 A · 🔴 ${rol}: editar la descripción de una línea marcada CONSERVA el aviso mientras el dato siga escrito`, async () => {
    const fila = filaDelParte();
    const srv = servidorDeVerdad(fila, rol);
    const cont = await montar(srv);
    assert.ok(aviso(cont), `🔴 SUELO: ${rol} no ve el aviso ni al abrir; lo de abajo no mediría nada`);

    await editarDescripcion(cont, INVENTADA + ' y purga');
    const patch = srv.respuestas.find((r) => r.metodo === 'patch');
    assert.ok(patch && patch.status === 200, `🔴 NO PUDE MIRAR: el PATCH no salió o falló: ${JSON.stringify(patch)}`);
    assert.deepEqual(fila.lineas[0].datosNoRespaldados, MARCA, '🔴 la marca se ha perdido EN LA BASE, no sólo en pantalla');
    assert.deepEqual(patch.data.lineas[0].datosNoRespaldados, MARCA,
      `🔴 la ruta con rol ${rol} responde la línea SIN la marca, aunque la base la conserva: ` + JSON.stringify(patch.data.lineas[0]));
    assert.ok(aviso(cont),
      `🔴 con rol ${rol}, tras editar la descripción el aviso del dato inventado DESAPARECE de la pantalla (y la marca sigue en la base).`);
  });
}

test('SCRUM-1302 A · ✅ el dueño que CORRIGE el dato ve irse el aviso (sigue a lo escrito, no se queda pegado)', async () => {
  const fila = filaDelParte();
  const srv = servidorDeVerdad(fila, 'admin');
  const cont = await montar(srv);
  assert.ok(aviso(cont), '🔴 SUELO: el dueño no ve el aviso al abrir');
  await editarDescripcion(cont, 'Revisión de central');
  assert.equal(fila.lineas[0].datosNoRespaldados, undefined, '🔴 el dato está corregido y la base sigue marcándolo');
  assert.equal(aviso(cont), undefined, '🔴 el dato está corregido y el aviso sigue en la pantalla del dueño');
});

test('SCRUM-1302 A · ✅ una línea SIN marca sale de la vista de oficina sin el campo (no se inventa una marca vacía)', async () => {
  const fila = filaDelParte();
  const srv = servidorDeVerdad(fila, 'admin');
  const cont = await montar(srv);
  await editarDescripcion(cont, INVENTADA + ' y purga');
  const patch = srv.respuestas.find((r) => r.metodo === 'patch');
  assert.ok(patch && patch.status === 200, '🔴 NO PUDE MIRAR: el PATCH no salió');
  assert.equal(patch.data.lineas[1].descripcion, 'Purga del circuito', '🔴 NO PUDE MIRAR: la línea 1 no es la esperada');
  assert.equal('datosNoRespaldados' in patch.data.lineas[1], false,
    '🔴 una línea sin dato inventado sale de la vista de oficina con `datosNoRespaldados`');
  assert.equal(typeof patch.data.lineas[1].importe, 'object', '🔴 NO PUDE MIRAR: la respuesta no es la vista de oficina');
});
