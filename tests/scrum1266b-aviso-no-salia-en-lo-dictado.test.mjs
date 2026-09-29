// tests/scrum1266b-aviso-no-salia-en-lo-dictado.test.mjs — SCRUM-1266, los dos textos firmados
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL DATO QUE LA MÁQUINA ESCRIBIÓ Y EL DICTADO NO DECÍA, EN LA TABLA DEL PARTE
//
// El PR #1950 hizo que la marca SOBREVIVIERA hasta la tabla del parte, pero no la pintaba: el
// técnico no sabía qué palabra mirar. Firmados en SCRUM-1266 c.17498:
//   · aviso bajo la descripción: «No salía en lo dictado: Honeywell, Galaxy»
//   · botón «Es correcto», que limpia la marca SIN tocar la descripción.
// Condiciones de la firma: sólo con el parte EDITABLE · nunca en el PDF y el sello no se mueve ·
// el botón no toca la descripción · una lista larga no deforma la línea.
//
// ── EL BANCO: EL VIAJE, NO EL GESTO ──────────────────────────────────────────────────────────────
// La VISTA de verdad (`parteDetailView.js`, con `vm`) hablando con la RUTA de verdad
// (`dist/…/partes.routes.js`, base doblada por `_envio-doblado.mjs`). Lo que el botón manda lo
// digiere el servidor que hay en producción, y lo que se mira es lo que queda GUARDADO.
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
const VISTA = path.join(RAIZ, 'public', 'dashboard', 'js', 'parteDetailView.js');
const copia = (x) => JSON.parse(JSON.stringify(x));
const vaciar = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r)); };

const PARTE_ID = 1266;
const JOB_ID = 12660;
const TECNICO = 12661;
const MARCADA = 'Cambio de central Honeywell Galaxy';
const AVISO = 'No salía en lo dictado: Honeywell, Galaxy';

function filaDelParte({ estado = 'borrador', lineas } = {}) {
  return {
    id: PARTE_ID, merchantId: MERCHANT, jobId: JOB_ID, customerId: null,
    numero: 'PT-2026-1266', fecha: '2026-09-29T08:00:00.000Z', obra: null, referencia: null,
    entrada: null, salida: null, desplazamientos: null, kilometros: null, tecnicos: [],
    tipo: 'reparacion_asistencia', notas: null, estado,
    lineas: lineas || [
      { id: 'a', bloque: 'mano_obra', unds: 1, descripcion: MARCADA, datosNoRespaldados: ['Honeywell', 'Galaxy'] },
      { id: 'b', bloque: 'materiales', unds: 2, descripcion: 'Detector volumétrico' },
    ],
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

/** La vista de verdad, cableada a la ruta de verdad. `patchFalla` corta la red en los PATCH. */
async function abrir({ estado, lineas, patchFalla = false } = {}) {
  const fila = filaDelParte({ estado, lineas });
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
  const apiRequest = async (ruta, o = {}) => {
    const metodo = (o.method || 'GET').toLowerCase();
    const body = o.body ? JSON.parse(o.body) : undefined;
    pedidas.push({ metodo, ruta, body });
    if (metodo !== 'get' && patchFalla) throw new Error('sin red');
    const h = manejador(router, metodo, '/:id');
    const r = { status: 200, data: undefined };
    const res = { status(s) { r.status = s; return res; }, json(j) { r.data = copia(j); return res; } };
    await h({ params: { id: String(PARTE_ID) }, body, merchantId: MERCHANT, userRole: 'tecnico', teamMemberId: TECNICO }, res);
    if (r.status >= 400) throw new Error('HTTP ' + r.status + ' ' + JSON.stringify(r.data));
    return r.data;
  };
  const reg = { porId: new Map(), selectoresNoSoportados: [] };
  const ctx = {
    console, window: null, Date, Array, Object, String, Number, JSON, Promise, Error, isFinite,
    document: { createElement: (t) => nodo(t, reg) },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(VISTA, 'utf8'), ctx, { filename: 'parteDetailView.js' });
  const cont = nodo('div', reg);
  assert.equal(await ctx.renderParteDetailView(cont, PARTE_ID, { apiRequest }), true,
    '🔴 NO PUDE MIRAR: la vista no pintó el parte');
  const escrituras = () => pedidas.filter((p) => p.metodo !== 'get');
  const boton = (i) => cont.querySelectorAll('[data-es-correcto]').find((b) => b.getAttribute('data-es-correcto') === String(i));
  return { fila, cont, reg, escrituras, boton, ctx };
}

// ═══ SUELO ═════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1266b · SUELO: el servidor de verdad entrega la marca a la vista', async () => {
  const { cont } = await abrir();
  assert.ok(cont.innerHTML.includes(MARCADA), '🔴 NO PUDE MIRAR: la línea marcada no se ha pintado');
  assert.ok(cont.innerHTML.includes('data-linea-desc="0"'), '🔴 NO PUDE MIRAR: el parte no se pintó editable');
});

// ═══ ① LO FIRMADO SE PINTA, CON SUS PALABRAS ════════════════════════════════════════════════════

test('SCRUM-1266b · 🔴 la línea marcada lleva «No salía en lo dictado: Honeywell, Galaxy» y «Es correcto»', async () => {
  const { cont, boton } = await abrir();
  const html = cont.innerHTML;
  assert.ok(html.includes(AVISO), '🔴 el aviso firmado no se pinta, o no nombra los datos como se firmó');
  assert.ok(boton(0), '🔴 la línea marcada no tiene «Es correcto»');
  assert.ok(html.includes('>Es correcto</button>'), '🔴 el botón no dice el literal firmado');
  assert.equal((html.match(/data-no-dictado="/g) || []).length, 1,
    '🔴 la línea SIN marca también lleva el aviso');
});

test('SCRUM-1266b · 🔴 con el parte FIRMADO no se pinta ni el aviso ni el botón (condición 1)', async () => {
  const { cont, boton } = await abrir({ estado: 'firmado' });
  assert.ok(cont.innerHTML.includes(MARCADA), 'control: la línea marcada SÍ está en pantalla');
  assert.ok(!cont.innerHTML.includes('data-linea-desc='), 'control: el parte se pintó en solo lectura');
  assert.ok(!cont.innerHTML.includes('No salía en lo dictado'), '🔴 un parte firmado grita un aviso que ya no se puede resolver');
  assert.equal(boton(0), undefined, '🔴 un parte firmado ofrece «Es correcto»');
});

// ═══ ② EL BOTÓN: LIMPIA LA MARCA Y NO TOCA LA DESCRIPCIÓN ═══════════════════════════════════════

test('SCRUM-1266b · 🔴 «Es correcto» deja la línea SIN marca en la base, con la descripción INTACTA', async () => {
  const { fila, cont, boton, escrituras } = await abrir();
  assert.ok(boton(0).dispararClick() > 0, '🔴 «Es correcto» NO TIENE ESCUCHADOR');
  await vaciar();
  assert.equal(escrituras().length, 1, '🔴 «Es correcto» no ha guardado nada');
  const guardada = fila.lineas.find((l) => l.id === 'a');
  assert.equal(guardada.descripcion, MARCADA, '🔴 «Es correcto» ha cambiado la descripción (condición 3)');
  assert.equal(guardada.datosNoRespaldados, undefined, '🔴 la marca sigue guardada tras «Es correcto»');
  assert.equal(fila.lineas.length, 2, '🔴 al limpiar la marca se ha perdido una línea');
  assert.ok(!cont.querySelector('[data-no-dictado="0"]') || cont.querySelector('[data-no-dictado="0"]')._padre == null,
    '🔴 el aviso sigue en pantalla tras «Es correcto»');
});

test('SCRUM-1266b · 🔴 corregir la descripción y DESPUÉS «Es correcto» no deshace la corrección', async () => {
  // Antes, cada guardado se armaba desde las líneas tal y como vinieron al abrir: el segundo mandaba
  // la descripción VIEJA. Medido contra la vista de main: la corrección se perdía en la base.
  const { fila, cont, boton } = await abrir();
  const desc = cont.querySelectorAll('input.parte-linea-desc').find((x) => x.getAttribute('data-linea-desc') === '0');
  desc.value = 'Cambio de central Honeywell Galaxy Flex';
  desc.disparar('change');
  await vaciar();
  boton(0).dispararClick();
  await vaciar();
  const guardada = fila.lineas.find((l) => l.id === 'a');
  assert.equal(guardada.descripcion, 'Cambio de central Honeywell Galaxy Flex',
    '🔴 «Es correcto» ha devuelto la descripción de antes de corregirla');
  assert.equal(guardada.datosNoRespaldados, undefined);
});

test('SCRUM-1266b · 🔴 editar la cantidad DESPUÉS de corregir la descripción no la deshace', async () => {
  const { fila, cont } = await abrir();
  const desc = cont.querySelectorAll('input.parte-linea-desc').find((x) => x.getAttribute('data-linea-desc') === '1');
  desc.value = 'Detector volumétrico doble';
  desc.disparar('change');
  await vaciar();
  const unds = cont.querySelectorAll('input.parte-linea-unds').find((x) => x.getAttribute('data-linea-unds') === '1');
  unds.value = '3';
  unds.disparar('change');
  await vaciar();
  const guardada = fila.lineas.find((l) => l.id === 'b');
  assert.deepEqual([guardada.unds, guardada.descripcion], [3, 'Detector volumétrico doble'],
    '🔴 guardar la cantidad ha devuelto la descripción de antes');
});

test('SCRUM-1266b · el blur de la descripción y «Es correcto» a la vez: gana lo último, sin re-marcar', async () => {
  const { fila, cont, boton } = await abrir();
  const desc = cont.querySelectorAll('input.parte-linea-desc').find((x) => x.getAttribute('data-linea-desc') === '0');
  desc.value = 'Cambio de central Honeywell Galaxy 48';
  desc.disparar('change');       // sin esperar: el clic llega con el guardado anterior en vuelo
  boton(0).dispararClick();
  await vaciar();
  const guardada = fila.lineas.find((l) => l.id === 'a');
  assert.equal(guardada.descripcion, 'Cambio de central Honeywell Galaxy 48');
  assert.equal(guardada.datosNoRespaldados, undefined, '🔴 el guardado del blur ha vuelto a marcar la línea');
});

test('SCRUM-1266b · corregir la descripción ACORTA el aviso, sin releer', async () => {
  const { cont } = await abrir();
  const desc = cont.querySelectorAll('input.parte-linea-desc').find((x) => x.getAttribute('data-linea-desc') === '0');
  desc.value = 'Cambio de central Honeywell';
  desc.disparar('change');
  await vaciar();
  const textos = cont.querySelectorAll('[data-no-dictado-texto]').map((n) => n.textContent);
  assert.ok(textos.length >= 1, '🔴 el aviso ha desaparecido aunque Honeywell sigue escrito');
  assert.equal(textos[textos.length - 1], 'No salía en lo dictado: Honeywell',
    '🔴 el aviso sigue nombrando un dato que ya no está en la descripción');
});

test('SCRUM-1266b · si «Es correcto» FALLA, la marca se queda y se dice con `noSeGuardo`', async () => {
  const { fila, cont, boton } = await abrir({ patchFalla: true });
  boton(0).dispararClick();
  await vaciar();
  assert.deepEqual(fila.lineas[0].datosNoRespaldados, ['Honeywell', 'Galaxy'], 'control: no se guardó nada');
  // `insertAdjacentHTML` en una fila no reescribe el `innerHTML` del contenedor en el banco: se busca el nodo.
  assert.ok(cont.querySelector('[data-linea-no-guardada]'), '🔴 el fallo no se dice');
  assert.ok(boton(0) && !boton(0).disabled, '🔴 tras fallar, «Es correcto» se queda deshabilitado y no se puede reintentar');
});

// ═══ ③ EL SELLO NO SE MUEVE, Y LA LÍNEA NO SE DEFORMA ═══════════════════════════════════════════

test('SCRUM-1266b · 🔴 el sello del parte es el mismo con marca, sin marca y con la marca vacía (condición 2)', async () => {
  const { computeParteContentHash, PARTE_CONTENIDO_VERSION_ACTUAL } =
    await import('../dist/modules/jobs/domain/parteTrabajo.js');
  const params = (lineas) => ({
    numero: 'PT-1', fecha: '2026-09-29T08:00:00.000Z', cliente: null, obra: null, referencia: null,
    entrada: null, salida: null, desplazamientos: null, kilometros: null, tecnicos: [], tipo: null,
    lineas, notas: null, firmadoPorNombre: null, firmadoPorCalidad: null,
  });
  const base = [{ bloque: 'mano_obra', unds: 1, descripcion: MARCADA }];
  const sin = computeParteContentHash(params(base), PARTE_CONTENIDO_VERSION_ACTUAL);
  assert.equal(computeParteContentHash(params([{ ...base[0], datosNoRespaldados: ['Honeywell', 'Galaxy'] }]), PARTE_CONTENIDO_VERSION_ACTUAL), sin,
    '🔴 PARA: la marca ha entrado en el sello — algo se ha colado en el camino canónico');
  assert.equal(computeParteContentHash(params([{ ...base[0], datosNoRespaldados: [] }]), PARTE_CONTENIDO_VERSION_ACTUAL), sin,
    '🔴 PARA: la marca vacía de «Es correcto» mueve el sello');
});

test('SCRUM-1266b · el parte no tiene PDF propio: la marca no llega a ningún documento', () => {
  // «Nunca en el PDF» (condición 2): medido que hoy NO EXISTE un PDF del parte. Si nace uno, este
  // test obliga a mirar si lee la marca antes de que salga.
  const pdfs = [];
  const recorrer = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) recorrer(p);
      else if (/\.ts$/.test(e.name) && /datosNoRespaldados/.test(fs.readFileSync(p, 'utf8'))) pdfs.push(path.relative(RAIZ, p));
    }
  };
  recorrer(path.join(RAIZ, 'src'));
  assert.ok(pdfs.length >= 2, '🔴 NO PUDE MIRAR: no encuentro ni los ficheros que SÍ usan la marca');
  const conPdf = pdfs.filter((p) => /pdf/i.test(p));
  assert.deepEqual(conPdf, [], '🔴 un fichero de PDF lee la marca del dato no dictado');
});

test('SCRUM-1266b · una lista LARGA no ensancha la columna: el texto parte por cualquier sitio y el botón baja', async () => {
  const largos = Array.from({ length: 20 }, (_, i) => 'Modelo' + i + 'XXXXXXXXXXXXXXXXXXXX');
  const { cont } = await abrir({
    lineas: [{ id: 'a', bloque: 'mano_obra', unds: 1, descripcion: largos.join(' '), datosNoRespaldados: largos }],
  });
  const html = cont.innerHTML;
  const aviso = html.slice(html.indexOf('data-no-dictado="0"'));
  assert.ok(html.includes('No salía en lo dictado: ' + largos.join(', ')), '🔴 la lista larga no se pinta entera');
  assert.match(aviso, /flex-wrap:wrap/, '🔴 el botón no puede bajar de renglón');
  assert.match(aviso, /overflow-wrap:anywhere/, '🔴 un dato sin espacios ensancharía la columna');
  assert.match(aviso, /min-width:0/, '🔴 sin min-width:0 el texto no se encoge dentro de la celda');
});
