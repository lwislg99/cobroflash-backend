// tests/scrum1189b-tipo-contra-la-ruta-real.test.mjs — SCRUM-1189, el viaje del tipo contra el servidor DE VERDAD
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL «TIPO DE INTERVENCIÓN» QUE SE MARCA, SE GUARDA — MEDIDO CONTRA LA RUTA, NO CONTRA UN DOBLE
//
// El arreglo entró con SCRUM-1175 PR-C (#1855): `change` del radio → `PATCH /admin/partes/:id
// { tipo }`. Su test (`scrum1175c`) contesta el PATCH con un servidor FALSO que se traga cualquier
// `tipo`. Eso no ve lo que más fácil se rompe aquí: que el `value` del radio deje de ser uno de los
// `TIPOS_PARTE` que la ruta acepta. Con el doble, un radio `reparacion` pasa en verde; con la ruta,
// es un 400 `tipo_invalido`, la vista repinta desde el servidor y el tipo se pierde otra vez.
//
// ── EL BANCO: EL VIAJE, NO EL GESTO ──────────────────────────────────────────────────────────────
// La VISTA de verdad (`parteDetailView.js`, con `vm`) hablando con la RUTA de verdad
// (`dist/…/partes.routes.js`, base doblada por `_envio-doblado.mjs`). El cuerpo NO se construye a
// mano: se lee el que manda la vista, y lo que se mira es lo que queda GUARDADO en la fila.
//
// CONTROL POSITIVO: la misma vista SIN el oyente del radio tiene que dejar el tipo en null —si este
// banco no ve esa diferencia, no sabe fallar—, y la ruta tiene que rechazar un tipo que no existe.
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

const PARTE_ID = 1189;
const JOB_ID = 11890;
const TECNICO = 11891;

function filaDelParte({ tipo = null, estado = 'borrador' } = {}) {
  return {
    id: PARTE_ID, merchantId: MERCHANT, jobId: JOB_ID, customerId: null,
    numero: 'PT-2026-1189', fecha: '2026-09-29T08:00:00.000Z', obra: null, referencia: null,
    entrada: null, salida: null, desplazamientos: null, kilometros: null, tecnicos: [],
    tipo, notas: null, estado,
    lineas: [{ id: 'a', bloque: 'mano_obra', unds: 1, descripcion: 'Revisión de la central' }],
    firmadoAt: estado === 'borrador' ? null : '2026-09-29T10:00:00.000Z',
    firmadoPorNombre: estado === 'borrador' ? null : 'Cliente', firmadoPorCalidad: null,
    firmadoTecnicoAt: null, firmadoTecnicoNombre: null, contenidoHash: null, contenidoVersion: null,
  };
}

function manejador(router, metodo, ruta) {
  const capa = router.stack.find((l) => l.route && l.route.path === ruta && l.route.methods[metodo]);
  assert.ok(capa, `🔴 CIEGO: no encuentro ${metodo.toUpperCase()} ${ruta} en el router de partes`);
  const pila = capa.route.stack;
  return pila[pila.length - 1].handle;
}

/** El servidor de verdad sobre una fila en memoria. Devuelve la fila y el `apiRequest` de la vista. */
function servidorDeVerdad(fila) {
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
  const pedidas = [];
  const respuestas = [];
  const apiRequest = async (ruta, o = {}) => {
    const metodo = (o.method || 'GET').toLowerCase();
    const body = o.body ? JSON.parse(o.body) : undefined;
    pedidas.push({ metodo, ruta, body });
    assert.equal(ruta, '/admin/partes/' + PARTE_ID, `🔴 CIEGO: la vista pidió una ruta que este banco no sirve: ${ruta}`);
    const h = manejador(router, metodo, '/:id');
    const r = { status: 200, data: undefined };
    const res = { status(s) { r.status = s; return res; }, json(j) { r.data = copia(j); return res; } };
    await h({ params: { id: String(PARTE_ID) }, body, merchantId: MERCHANT, userRole: 'tecnico', teamMemberId: TECNICO }, res);
    respuestas.push({ metodo, status: r.status, data: r.data });
    if (r.status >= 400) throw new Error('HTTP ' + r.status + ' ' + JSON.stringify(r.data));
    return r.data;
  };
  return { apiRequest, pedidas, respuestas, escrituras: () => pedidas.filter((p) => p.metodo !== 'get') };
}

/** Monta la vista (la de verdad, o la que se le pase) contra ese servidor. */
async function montar(srv, fuente = FUENTE) {
  const reg = { porId: new Map(), selectoresNoSoportados: [] };
  const ctx = {
    console, window: null, Date, Array, Object, String, Number, JSON, Promise, Error, isFinite,
    document: { createElement: (t) => nodo(t, reg) },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fuente, ctx, { filename: 'parteDetailView.js' });
  const cont = nodo('div', reg);
  assert.equal(await ctx.renderParteDetailView(cont, PARTE_ID, { apiRequest: srv.apiRequest }), true,
    '🔴 NO PUDE MIRAR: la vista no pintó el parte');
  const radios = todos(cont).filter((x) => x.getAttribute && x.getAttribute('name') === 'parte-tipo');
  return { cont, radios };
}

const marcados = (radios) => radios.filter((x) => x.getAttribute('checked') != null).map((x) => x.getAttribute('value'));

async function marcar(radios, valor) {
  const radio = radios.find((x) => x.getAttribute('value') === valor);
  assert.ok(radio, `🔴 NO PUDE MIRAR: no hay radio con value=${valor}`);
  for (const x of radios) x.checked = x === radio;
  radio.disparar('change');
  await vaciar();
}

// ═══ SUELO ═════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1189b · SUELO: la ruta de verdad entrega el parte y la vista pinta los tres tipos, ninguno marcado', async () => {
  const fila = filaDelParte();
  const { radios } = await montar(servidorDeVerdad(fila));
  assert.equal(radios.length, 3, '🔴 NO PUDE MIRAR: no están los tres radios del tipo');
  assert.deepEqual(marcados(radios), [], '🔴 un parte sin tipo sale con uno marcado');
});

// ═══ ① EL VIAJE ════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1189b · 🔴 cada tipo: marcar → la vista manda { tipo } → la RUTA lo acepta → queda en la fila → al reabrir sale marcado', async () => {
  const fila = filaDelParte();
  const srv = servidorDeVerdad(fila);
  const { radios } = await montar(srv);
  const valores = radios.map((x) => x.getAttribute('value'));
  for (const valor of valores) {
    await marcar(radios, valor);
    const ultima = srv.escrituras().at(-1);
    assert.deepEqual(ultima && ultima.body, { tipo: valor }, `🔴 marcar «${valor}» no manda { tipo } a la ruta`);
    assert.equal(srv.respuestas.at(-1).status, 200,
      `🔴 la ruta RECHAZA el tipo «${valor}» que pinta la vista: ${JSON.stringify(srv.respuestas.at(-1).data)}`);
    assert.equal(fila.tipo, valor, `🔴 «${valor}» no queda guardado en la fila`);
    const { radios: reabiertos } = await montar(srv);
    assert.deepEqual(marcados(reabiertos), [valor], `🔴 al reabrir, el tipo «${valor}» se ha perdido`);
  }
  assert.equal(srv.escrituras().length, valores.length, '🔴 una escritura por tipo marcado, ni más ni menos');
});

test('SCRUM-1189b · cambiar de tipo sobre uno ya guardado lo sustituye', async () => {
  const fila = filaDelParte({ tipo: 'mantenimiento' });
  const srv = servidorDeVerdad(fila);
  const { radios } = await montar(srv);
  assert.deepEqual(marcados(radios), ['mantenimiento'], '🔴 NO PUDE MIRAR: el tipo guardado no sale marcado');
  await marcar(radios, 'instalacion');
  assert.equal(fila.tipo, 'instalacion');
});

// ═══ ② CONTROLES ═══════════════════════════════════════════════════════════════════════════════

test('SCRUM-1189b · CONTROL: un parte SIN tipo marcado se guarda igual que antes — tocar la obra no manda tipo ni lo cambia', async () => {
  const fila = filaDelParte();
  const srv = servidorDeVerdad(fila);
  const { cont } = await montar(srv);
  const obra = todos(cont).find((x) => x.getAttribute && x.getAttribute('data-parte-campo') === 'obra');
  assert.ok(obra, '🔴 NO PUDE MIRAR: no está la casilla de la obra');
  obra.value = 'C/ Mayor 3';
  obra.disparar('change');
  await vaciar();
  assert.equal(srv.escrituras().length, 1, '🔴 NO PUDE MIRAR: guardar la obra no escribió');
  assert.equal('tipo' in srv.escrituras()[0].body, false, '🔴 guardar otro campo arrastra el tipo');
  assert.equal(fila.obra, 'C/ Mayor 3');
  assert.equal(fila.tipo, null, '🔴 un parte sin tipo ha acabado con uno');
});

test('SCRUM-1189b · CONTROL POSITIVO: sin el oyente del radio, este banco VE que el tipo no se guarda', async () => {
  const oyente = "guardarCampo('tipo', radio.value);";
  assert.equal(FUENTE.split(oyente).length, 2, '🔴 NO PUDE MIRAR: no encuentro el oyente del tipo en la vista (¿ha cambiado de forma?)');
  const fila = filaDelParte();
  const srv = servidorDeVerdad(fila);
  const { radios } = await montar(srv, FUENTE.replace(oyente, ''));
  await marcar(radios, 'instalacion');
  assert.equal(srv.escrituras().length, 0);
  assert.equal(fila.tipo, null, '🔴 el banco no distingue la vista rota de la buena: no sabe fallar');
});

test('SCRUM-1189b · CONTROL POSITIVO: la ruta de verdad RECHAZA un tipo que no existe (el doble de 1175c no)', async () => {
  const fila = filaDelParte();
  const srv = servidorDeVerdad(fila);
  await assert.rejects(
    srv.apiRequest('/admin/partes/' + PARTE_ID, { method: 'PATCH', body: JSON.stringify({ tipo: 'reparacion' }) }),
    /tipo_invalido/,
    '🔴 la ruta se traga un tipo inventado: este banco no distinguiría un radio con el value mal escrito');
  assert.equal(fila.tipo, null);
});

test('SCRUM-1189b · CONTROL: con el parte FIRMADO los radios salen deshabilitados y marcar no escribe', async () => {
  const fila = filaDelParte({ tipo: 'mantenimiento', estado: 'firmado' });
  const srv = servidorDeVerdad(fila);
  const { radios } = await montar(srv);
  assert.equal(radios.length, 3, '🔴 NO PUDE MIRAR: no están los radios en el firmado');
  assert.ok(radios.every((x) => x.getAttribute('disabled') != null), '🔴 un parte firmado deja cambiar el tipo');
  assert.equal(fila.tipo, 'mantenimiento');
});
