// tests/scrum889b-quitar-linea-guardada.test.mjs — SCRUM-889, segundo PR
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA «×» DE UNA LÍNEA GUARDADA, SIN QUE NINGÚN PRECIO CAMBIE DE LÍNEA
//
// El `PATCH` de `lineas` reemplaza la lista entera y conservaba los precios de la oficina casando
// por ÍNDICE (`previas[i]` con el mismo bloque y descripción). Quitar la línea del medio corre las
// de detrás: la tercera se queda SIN su precio, o —si se llama igual que la segunda— con el precio
// DE LA SEGUNDA. Y los precios se pueden poner en borrador. Por eso la «×» se pintaba sin cable.
//
// DECIDIDO (orquestador, opción 1): los precios se casan por IDENTIDAD de línea. El id vive DENTRO
// del JSON `ParteTrabajo.lineas`: no es cambio de schema. No entra en el sello, y no es dinero.
//
// ── EL BANCO ─────────────────────────────────────────────────────────────────────────────────
// · La RUTA de verdad (`dist/…/partes.routes.js`), con la base doblada por `_envio-doblado.mjs`.
//   El cliente se imita como es: pide el parte, y devuelve lo que recibió menos la línea quitada.
//   Así el test no sabe CÓMO se casa, sólo mide que ningún precio cambie de línea.
// · La VISTA de verdad (`parteDetailView.js`) con `vm`, para la «×».
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { inyectarBase, moduloDeDist, MERCHANT } from './_envio-doblado.mjs';
import { nodo } from './_banco-vistas.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const RUTAS = '../dist/modules/jobs/app/routes/partes.routes.js';
const copia = (x) => JSON.parse(JSON.stringify(x));

const PARTE_ID = 889;
// SCRUM-992 · el parte ya no es SUELTO: un técnico solo abre partes de SUS trabajos, y uno sin trabajo no es
// de nadie. El fixture cuelga el parte de un trabajo cuyo operario es el técnico que llama; lo que este test
// vigila (que quitar una línea no mueva su precio a otra) no cambia ni una aserción.
const JOB_ID = 8890;
const TECNICO = 8891;

/** Un parte en BORRADOR con tres líneas valoradas por la oficina, como están hoy en la base: sin id. */
function parteGuardado(lineas) {
  return {
    id: PARTE_ID, merchantId: MERCHANT, jobId: JOB_ID, customerId: null,
    numero: 'PT-2026-889', fecha: '2026-09-16T08:00:00.000Z', obra: 'C/ Mayor 3', referencia: null,
    entrada: '09:00', salida: null, desplazamientos: null, kilometros: null, tecnicos: [],
    tipo: 'reparacion_asistencia', lineas, notas: null, estado: 'borrador',
    firmadoAt: null, firmadoPorNombre: null, firmadoPorCalidad: null,
    firmadoTecnicoAt: null, firmadoTecnicoNombre: null, contenidoHash: null, contenidoVersion: null,
  };
}

const DISTINTAS = [
  { bloque: 'mano_obra', unds: 1, descripcion: 'Desmontar cuadro', precioUnitario: 10, tipoIva: 0.21 },
  { bloque: 'mano_obra', unds: 2, descripcion: 'Cablear línea', precioUnitario: 20, tipoIva: 0.21 },
  { bloque: 'mano_obra', unds: 3, descripcion: 'Montar magnetotérmico', precioUnitario: 30, tipoIva: 0.21 },
];
/** La segunda y la tercera se llaman igual: con el casado por índice, la tercera hereda el precio de la segunda. */
const IGUALES = [
  { bloque: 'mano_obra', unds: 1, descripcion: 'Desmontar cuadro', precioUnitario: 10, tipoIva: 0.21 },
  { bloque: 'mano_obra', unds: 2, descripcion: 'Hora de oficial', precioUnitario: 20, tipoIva: 0.21 },
  { bloque: 'mano_obra', unds: 3, descripcion: 'Hora de oficial', precioUnitario: 30, tipoIva: 0.21 },
];

function manejador(router, metodo, ruta) {
  const capa = router.stack.find((l) => l.route && l.route.path === ruta && l.route.methods[metodo]);
  assert.ok(capa, `🔴 CIEGO: no encuentro ${metodo.toUpperCase()} ${ruta} en el router de partes`);
  const pila = capa.route.stack;
  return pila[pila.length - 1].handle;
}

/** La base doblada con UN parte, y las tres rutas que usa el cliente, de verdad. */
function banco(lineas) {
  const fila = parteGuardado(copia(lineas));
  inyectarBase({
    'parteTrabajo.findFirst': ({ where }) =>
      (where.id === fila.id && where.merchantId === MERCHANT ? copia(fila) : null),
    'job.findFirst': ({ where }) =>
      (where.id === JOB_ID && where.merchantId === MERCHANT
        ? { operarioId: TECNICO, assignedUserId: null, assignees: [] }
        : null),
    'parteTrabajo.update': ({ where, data }) => {
      assert.equal(where.id, fila.id);
      Object.assign(fila, copia(data));
      return copia(fila);
    },
  }, [RUTAS]);
  const router = moduloDeDist(RUTAS).default;
  const llamar = (metodo, ruta) => async ({ body, rol }) => {
    const h = manejador(router, metodo, ruta);
    const r = { status: 200, data: undefined };
    const res = { status(s) { r.status = s; return res; }, json(j) { r.data = copia(j); return res; } };
    await h({ params: { id: String(PARTE_ID) }, body, merchantId: MERCHANT, userRole: rol, teamMemberId: rol === 'tecnico' ? TECNICO : null }, res);
    return r;
  };
  const get = llamar('get', '/:id');
  const patch = llamar('patch', '/:id');
  const oficina = llamar('get', '/:id/oficina');
  return {
    fila,
    /** Lo que el móvil del técnico recibe. */
    delTecnico: async () => (await get({ rol: 'tecnico' })).data.lineas,
    /** El técnico manda la lista entera, como la vista. */
    guarda: async (lineasDelTecnico) => patch({ body: { lineas: lineasDelTecnico }, rol: 'tecnico' }),
    /** Lo que ve la oficina: unds, descripción y precio de cada línea. */
    precios: async () => (await oficina({ rol: 'admin' })).data.lineas
      .map((l) => ({ unds: l.unds, descripcion: l.descripcion, precio: l.precioUnitario })),
    lineasDeOficina: async () => (await oficina({ rol: 'admin' })).data.lineas,
    valora: async (precios) => patch({ body: { precios }, rol: 'admin' }),
  };
}

const sin = (lista, i) => lista.filter((_, j) => j !== i);
const soloPrecio = (lineas) => lineas.map((l) => ({ unds: l.unds, descripcion: l.descripcion, precio: l.precioUnitario }));

// ═══ SUELO ═════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-889b · SUELO: el banco guarda las 3 líneas con su precio y el técnico las recibe', async () => {
  const b = banco(DISTINTAS);
  assert.deepEqual(await b.precios(), soloPrecio(DISTINTAS),
    '🔴 NO PUDE MIRAR: la oficina no ve las 3 líneas con precio. Todo lo de abajo mediría un parte sin precios.');
  assert.equal((await b.delTecnico()).length, 3, '🔴 NO PUDE MIRAR: el técnico no recibe las 3 líneas.');
});

// ═══ ① EL ROJO ═════════════════════════════════════════════════════════════════════════════════

test('SCRUM-889b · 🔴 quitar la línea del MEDIO: la tercera conserva SU precio', async () => {
  const b = banco(DISTINTAS);
  const r = await b.guarda(sin(await b.delTecnico(), 1));
  assert.equal(r.status, 200);
  assert.deepEqual(await b.precios(), soloPrecio(sin(DISTINTAS, 1)),
    '🔴 al quitar la línea del medio, la de detrás ha perdido su precio: se casaba por índice.');
});

test('SCRUM-889b · 🔴 quitar la del medio cuando la tercera SE LLAMA IGUAL: no hereda el precio de la segunda', async () => {
  const b = banco(IGUALES);
  await b.guarda(sin(await b.delTecnico(), 1));
  assert.deepEqual(await b.precios(), soloPrecio(sin(IGUALES, 1)),
    '🔴 la tercera línea se ha quedado con el precio de la SEGUNDA: un precio ha cambiado de línea.');
});

test('SCRUM-889b · 🔴 quitar la del medio DESPUÉS de otro guardado (líneas ya con id en la base)', async () => {
  const b = banco(DISTINTAS);
  const lineas = await b.delTecnico();
  lineas[0].unds = 4;
  await b.guarda(lineas);
  await b.guarda(sin(await b.delTecnico(), 1));
  const esperado = soloPrecio(sin(DISTINTAS, 1));
  esperado[0].unds = 4;
  assert.deepEqual(await b.precios(), esperado);
});

test('SCRUM-889b · 🔴 la oficina valora con la pantalla vieja tras quitar una línea: el precio NO cae en otra', async () => {
  const b = banco(DISTINTAS);
  const vistaDeOficina = await b.lineasDeOficina();   // la oficina abrió el parte con 3 líneas
  await b.guarda(sin(await b.delTecnico(), 1));        // el técnico quita la del medio
  const r = await b.valora([{ indice: 1, id: vistaDeOficina[1].id, precioUnitario: 99 }]);
  assert.notEqual(r.status, 200, '🔴 se ha aceptado un precio para una línea que ya no existe');
  assert.deepEqual(await b.precios(), soloPrecio(sin(DISTINTAS, 1)),
    '🔴 el precio de la línea quitada ha caído en la de detrás.');
});

// ═══ ② POSITIVO: lo que ya funcionaba sigue igual ════════════════════════════════════════════

test('SCRUM-889b · quitar la ÚLTIMA deja las otras dos con su precio', async () => {
  const b = banco(DISTINTAS);
  await b.guarda(sin(await b.delTecnico(), 2));
  assert.deepEqual(await b.precios(), soloPrecio(sin(DISTINTAS, 2)));
});

test('SCRUM-889b · editar las UNDS de una línea conserva su precio; editar la descripción lo suelta, como antes', async () => {
  const b = banco(DISTINTAS);
  const lineas = await b.delTecnico();
  lineas[1].unds = 5;
  lineas[2].descripcion = 'Montar diferencial';
  await b.guarda(lineas);
  assert.deepEqual(await b.precios(), [
    { unds: 1, descripcion: 'Desmontar cuadro', precio: 10 },
    { unds: 5, descripcion: 'Cablear línea', precio: 20 },
    { unds: 3, descripcion: 'Montar diferencial', precio: null },
  ]);
});

test('SCRUM-889b · un cliente ANTIGUO (sin id) que devuelve la lista igual no pierde ningún precio', async () => {
  const b = banco(DISTINTAS);
  await b.guarda(DISTINTAS.map((l) => ({ bloque: l.bloque, unds: l.unds, descripcion: l.descripcion })));
  assert.deepEqual(await b.precios(), soloPrecio(DISTINTAS));
});

test('SCRUM-889b · añadir una línea al final: las de antes conservan su precio y la nueva no tiene', async () => {
  const b = banco(DISTINTAS);
  await b.guarda([...(await b.delTecnico()), { bloque: 'materiales', unds: 1, descripcion: 'Caja estanca' }]);
  assert.deepEqual(await b.precios(), [
    ...soloPrecio(DISTINTAS),
    { unds: 1, descripcion: 'Caja estanca', precio: null },
  ]);
});

test('SCRUM-889b · la oficina valora con el id de una línea que sigue ahí: se aplica a ESA línea', async () => {
  const b = banco(DISTINTAS);
  const vista = await b.lineasDeOficina();
  const r = await b.valora([{ indice: 2, id: vista[2].id, precioUnitario: 33 }]);
  assert.equal(r.status, 200);
  assert.equal((await b.precios())[2].precio, 33);
});

test('SCRUM-889b · la oficina con la pantalla ANTIGUA (sólo índice) sigue valorando', async () => {
  const b = banco(DISTINTAS);
  const r = await b.valora([{ indice: 0, precioUnitario: 11 }]);
  assert.equal(r.status, 200);
  assert.equal((await b.precios())[0].precio, 11);
});

// ═══ ③ NEGATIVO: ningún precio cambia de línea, ni se duplica ═══════════════════════════════

test('SCRUM-889b · un id REPETIDO en la petición no clona el precio', async () => {
  const b = banco(DISTINTAS);
  const lineas = await b.delTecnico();
  await b.guarda([lineas[0], { ...lineas[0] }]);
  const p = await b.precios();
  assert.equal(p.filter((l) => l.precio === 10).length, 1, '🔴 un precio se ha duplicado en otra línea');
});

test('SCRUM-889b · un id que no existe no trae precio', async () => {
  const b = banco(DISTINTAS);
  await b.guarda([{ id: 'no-existe', bloque: 'mano_obra', unds: 1, descripcion: 'Desmontar cuadro' }]);
  assert.deepEqual(await b.precios(), [{ unds: 1, descripcion: 'Desmontar cuadro', precio: null }]);
});

test('SCRUM-889b · el id de línea NO entra en el sello del parte', async () => {
  const { computeParteContentHash, PARTE_CONTENIDO_VERSION_ACTUAL } =
    await import('../dist/modules/jobs/domain/parteTrabajo.js');
  const params = (lineas) => ({
    numero: 'PT-1', fecha: '2026-09-16T08:00:00.000Z', cliente: null, obra: null, referencia: null,
    entrada: null, salida: null, desplazamientos: null, kilometros: null, tecnicos: [], tipo: null,
    lineas, notas: null, firmadoPorNombre: null, firmadoPorCalidad: null,
  });
  const sinId = DISTINTAS.map(({ bloque, unds, descripcion }) => ({ bloque, unds, descripcion }));
  const conId = sinId.map((l, i) => ({ ...l, id: 'l' + i }));
  assert.equal(
    computeParteContentHash(params(conId), PARTE_CONTENIDO_VERSION_ACTUAL),
    computeParteContentHash(params(sinId), PARTE_CONTENIDO_VERSION_ACTUAL),
    '🔴 el id de línea ha entrado en el sello: un parte firmado antes dejaría de verificar.');
});

// ═══ ④ LA VISTA: la «×» de una línea guardada ═══════════════════════════════════════════════

const VISTA = path.join(RAIZ, 'public', 'dashboard', 'js', 'parteDetailView.js');
const vaciar = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r)); };

async function abrirVista({ patchFalla = false } = {}) {
  const reg = { porId: new Map(), selectoresNoSoportados: [] };
  const ctx = {
    console, window: null, Date, Array, Object, String, Number, JSON, Promise, Error, isFinite,
    document: { createElement: (t) => nodo(t, reg) },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(VISTA, 'utf8'), ctx, { filename: 'parteDetailView.js' });
  const cont = nodo('div', reg);
  const parte = {
    id: 7, numero: 'PT-2026-889', clienteNombre: null, fecha: '2026-09-16T08:00:00.000Z', obra: null,
    referencia: null, entrada: null, salida: null, desplazamientos: null, kilometros: null, tecnicos: [],
    tipo: null, notas: null, estado: 'borrador',
    lineas: [
      { id: 'a', bloque: 'mano_obra', unds: 1, descripcion: 'Desmontar cuadro' },
      { id: 'b', bloque: 'mano_obra', unds: 2, descripcion: 'Cablear línea' },
      { id: 'c', bloque: 'materiales', unds: 3, descripcion: 'Magnetotérmico 16 A' },
    ],
    puedeEditarContenido: { ok: true, motivo: null }, puedeEditarPrecios: { ok: true, motivo: null },
  };
  const srv = { pedidas: [] };
  srv.apiRequest = async (ruta, o = {}) => {
    const metodo = o.method || 'GET';
    const cuerpo = o.body ? JSON.parse(o.body) : null;
    srv.pedidas.push({ metodo, ruta, cuerpo });
    if (metodo === 'GET') return copia(parte);
    if (patchFalla) throw new Error('sin red');
    if (cuerpo.lineas) parte.lineas = cuerpo.lineas;
    return { ok: true };
  };
  srv.escrituras = () => srv.pedidas.filter((p) => p.metodo !== 'GET');
  srv.lecturas = () => srv.pedidas.filter((p) => p.metodo === 'GET').length;
  assert.equal(await ctx.renderParteDetailView(cont, 7, { apiRequest: srv.apiRequest }), true,
    '🔴 NO PUDE MIRAR: la vista no pintó el parte');
  return { cont, srv };
}

const equisGuardadas = (cont) => cont.querySelectorAll('.parte-quitar-linea').filter((b) => b.hasAttribute('data-indice'));

test('SCRUM-889b · 🔴 la «×» de una línea guardada la quita: lista entera SIN ella, CON los ids, y relee', async () => {
  const { cont, srv } = await abrirVista();
  const equis = equisGuardadas(cont);
  assert.equal(equis.length, 3, '🔴 NO PUDE MIRAR: no hay tres «×» de líneas guardadas');
  assert.ok(cont.innerHTML.includes('Cablear línea'), 'control: antes de quitarla, la línea SÍ está pintada');
  const leidas = srv.lecturas();
  const x = equis.find((b) => b.getAttribute('data-indice') === '1');
  assert.ok(x.dispararClick() > 0, '🔴 la «×» de una línea guardada NO TIENE ESCUCHADOR.');
  await vaciar();
  const escritas = srv.escrituras();
  assert.equal(escritas.length, 1, '🔴 quitar una línea guardada no ha escrito nada');
  assert.deepEqual(escritas[0].cuerpo, {
    lineas: [
      { id: 'a', bloque: 'mano_obra', unds: 1, descripcion: 'Desmontar cuadro' },
      { id: 'c', bloque: 'materiales', unds: 3, descripcion: 'Magnetotérmico 16 A' },
    ],
  }, '🔴 la lista mandada no es la de antes sin la línea quitada, con sus ids');
  assert.ok(srv.lecturas() > leidas, '🔴 tras quitarla no se relee el parte del servidor');
  // Sobre el ÚLTIMO marcado pintado y no sobre `querySelectorAll`: el banco añade los nodos de cada
  // `innerHTML` a los de antes (no reemplaza), así que tras releer seguiría viendo las 3 filas viejas.
  const pintado = cont.innerHTML;
  assert.equal((pintado.match(/data-parte-linea="/g) || []).length, 2, '🔴 la línea quitada sigue en pantalla');
  assert.ok(!pintado.includes('Cablear línea'), '🔴 la línea quitada sigue en pantalla');
  assert.ok(pintado.includes('Desmontar cuadro') && pintado.includes('Magnetotérmico 16 A'),
    '🔴 al quitar una línea han desaparecido otras');
});

test('SCRUM-889b · editar una línea también devuelve los ids', async () => {
  const { cont, srv } = await abrirVista();
  const unds = cont.querySelectorAll('input.parte-linea-unds').find((x) => x.getAttribute('data-linea-unds') === '2');
  unds.value = '4';
  unds.disparar('change');
  await vaciar();
  assert.deepEqual(srv.escrituras()[0].cuerpo.lineas.map((l) => l.id), ['a', 'b', 'c'],
    '🔴 al editar una línea se mandan las líneas SIN id: la siguiente «×» volvería a casar por índice');
});

test('SCRUM-889b · si quitarla FALLA, la línea sigue en pantalla', async () => {
  const { cont, srv } = await abrirVista({ patchFalla: true });
  equisGuardadas(cont).find((b) => b.getAttribute('data-indice') === '0').dispararClick();
  await vaciar();
  assert.equal(srv.escrituras().length, 1, 'control: se intentó');
  assert.equal(equisGuardadas(cont).length, 3, '🔴 la línea ha desaparecido de la pantalla sin haberse quitado');
});
