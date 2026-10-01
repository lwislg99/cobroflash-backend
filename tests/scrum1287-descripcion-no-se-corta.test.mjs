// tests/scrum1287-descripcion-no-se-corta.test.mjs — SCRUM-1287, la descripción de la línea del parte
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 A 390 PX LA CASILLA CORTABA LA DESCRIPCIÓN, Y CON ELLA LO QUE EL AVISO DEL DATO INVENTADO NOMBRA
//
// MEDIDO en yaqu.app (29-sep-2026, parte QA, 390 px): el `<input>` medía 182 px y se cortaban 30 de las
// 39 descripciones del catálogo de gremios (77 %). El aviso decía «No salía en lo dictado: Honeywell,
// Galaxy» y esas palabras no se veían. Ahora es un `<textarea rows="1">` que crece hacia abajo.
//
// Lo que el banco NO puede medir, y se midió en el navegador real (Chrome, 390 px, código local servido
// sobre yaqu.app, sin escribir nada): la fila de una descripción CORTA es idéntica píxel a píxel a la del
// `input` (0 píxeles distintos) · con cinco líneas largas, 0 casillas cortadas, sin scroll horizontal, y
// «Firmar aquí mismo» y «Es correcto» reciben el toque. Registro en docs/master/SCRUM-1287.md.
//
// ── EL BANCO: EL VIAJE, NO EL GESTO ──────────────────────────────────────────────────────────────
// La VISTA de verdad contra la RUTA de verdad (`dist/…/partes.routes.js`), como `scrum1266b`. Lo que se
// mira es lo que queda GUARDADO.
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
const copia = (x) => JSON.parse(JSON.stringify(x));
const vaciar = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r)); };

const PARTE_ID = 1287;
const JOB_ID = 12870;
const TECNICO = 12871;
// Larga, con acento, con `&` y con los datos marcados: lo que el banco tiene que devolver ENTERO.
const LARGA = 'Sustitución de la central Honeywell Galaxy & módulo de 8 zonas';

function filaDelParte({ estado = 'borrador' } = {}) {
  return {
    id: PARTE_ID, merchantId: MERCHANT, jobId: JOB_ID, customerId: null,
    numero: 'PT-2026-1287', fecha: '2026-09-29T08:00:00.000Z', obra: null, referencia: null,
    entrada: null, salida: null, desplazamientos: null, kilometros: null, tecnicos: [],
    tipo: null, notas: null, estado,
    lineas: [
      { id: 'a', bloque: 'mano_obra', unds: 1, descripcion: LARGA, datosNoRespaldados: ['Honeywell', 'Galaxy'] },
      { id: 'b', bloque: 'materiales', unds: 2, descripcion: 'Cable' },
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

async function abrir({ estado } = {}) {
  const fila = filaDelParte({ estado });
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
  const desc = (i) => todos(cont).find((x) => x.getAttribute && x.getAttribute('data-linea-desc') === String(i));
  return { fila, cont, desc, escrituras: () => pedidas.filter((p) => p.metodo !== 'get') };
}

// ═══ SUELO: el banco lee la descripción ENTERA de un textarea (límite declarado en SCRUM-1278) ═════

test('SCRUM-1287 · SUELO: la descripción larga, con acento y «&», llega ENTERA a `.value` del campo', async () => {
  const { desc } = await abrir();
  const d = desc(0);
  assert.ok(d, '🔴 NO PUDE MIRAR: no está la casilla de la descripción');
  assert.equal(d.value, LARGA, '🔴 el banco lee la descripción vacía o a medias: todo lo de abajo mediría nada');
});

// ═══ ① LA FORMA ════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1287 · 🔴 la descripción editable es un textarea de UNA fila con la misma clase y atributo, no un input', async () => {
  const { cont, desc } = await abrir();
  const d = desc(0);
  assert.equal(d.tagName, 'TEXTAREA', '🔴 la descripción sigue siendo un campo de una línea que corta el texto');
  assert.equal(d.getAttribute('rows'), '1');
  assert.ok(d.classList.contains('parte-linea-desc'), '🔴 ha perdido su clase (y con ella su aspecto)');
  const campos = todos(cont).filter((x) => x.classList && x.classList.contains('parte-linea-desc'));
  assert.equal(campos.length, 2, '🔴 NO PUDE MIRAR: no están las dos descripciones');
  assert.ok(campos.every((x) => x.tagName === 'TEXTAREA'), '🔴 queda algún input de descripción');
});

test('SCRUM-1287 · la línea NUEVA («Añadir línea») también nace como textarea de una fila', async () => {
  const { cont } = await abrir();
  const anadir = todos(cont).find((x) => x.classList && x.classList.contains('parte-anadir'));
  assert.ok(anadir, '🔴 NO PUDE MIRAR: no hay «Añadir línea»');
  anadir.dispararClick();
  await vaciar();
  const nueva = todos(cont).find((x) => x.getAttribute && x.getAttribute('data-nueva-desc') === '1');
  assert.ok(nueva, '🔴 NO PUDE MIRAR: no apareció la línea nueva');
  assert.equal(nueva.tagName, 'TEXTAREA');
  assert.equal(nueva.getAttribute('rows'), '1');
});

test('SCRUM-1287 · CONTROL: un parte FIRMADO sigue sin campos — celdas de texto, como hoy', async () => {
  const { cont } = await abrir({ estado: 'firmado' });
  assert.equal(/parte-linea-desc/.test(cont.innerHTML), false, '🔴 un parte firmado pinta una casilla editable');
  assert.ok(cont.innerHTML.includes('Honeywell Galaxy &amp; módulo'), '🔴 NO PUDE MIRAR: no se pintó la descripción');
});

// ═══ ② SIGUE SIENDO UNA LÍNEA DE TEXTO ═════════════════════════════════════════════════════════

test('SCRUM-1287 · Intro no mete un salto (con el input no lo metía): se cancela', async () => {
  const { desc } = await abrir();
  const oyentes = (desc(0)._oyentes || {}).keydown || [];
  assert.ok(oyentes.length > 0, '🔴 nadie escucha el teclado de la descripción: Intro metería un salto');
  let cancelado = 0;
  for (const f of oyentes) f({ key: 'Enter', preventDefault() { cancelado += 1; } });
  assert.ok(cancelado > 0, '🔴 Intro no se cancela');
  let otra = 0;
  for (const f of oyentes) f({ key: 'a', preventDefault() { otra += 1; } });
  assert.equal(otra, 0, 'CONTROL: cualquier otra tecla se escribe');
});

test('SCRUM-1287 · 🔴 el VIAJE: un salto pegado se guarda como espacio, y lo corregido llega a la base', async () => {
  const { desc, fila, escrituras } = await abrir();
  const d = desc(0);
  d.value = 'Sustitución de la central\nHoneywell Galaxy & módulo de 16 zonas';
  d.disparar('input');
  assert.equal(d.value, 'Sustitución de la central Honeywell Galaxy & módulo de 16 zonas',
    '🔴 un salto pegado se queda en la descripción');
  d.disparar('change');
  await vaciar();
  assert.equal(escrituras().length, 1, '🔴 NO PUDE MIRAR: corregir la descripción no escribió');
  assert.equal(fila.lineas[0].descripcion, 'Sustitución de la central Honeywell Galaxy & módulo de 16 zonas');
  assert.equal(fila.lineas[1].descripcion, 'Cable', 'la otra línea no se toca');
});
