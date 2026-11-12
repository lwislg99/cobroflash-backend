// SCRUM-1681 ③ · desde «Trabajo nuevo» se da de alta el cliente SIN SALIR, y no se preselecciona
// el primero de la lista sin que nadie lo elija.
//
// Medido en yaqu.app (SCRUM-1658, 10-nov-2026): el `<select>` traía sólo los clientes, con el
// primero elegido de oficio; con un cliente nuevo había que cerrar, ir a Clientes y volver.
//
// QUÉ MIDE ESTO: EJECUTA `public/dashboard/js/jobNuevoModal.js` tal cual, en `vm`, con un DOM de
// juguete que sólo sabe lo que el modal usa: el `<select>` parsea sus `<option>` y lleva `value`
// como el navegador (al pintar elige la primera; un valor que no existe deja `''`). El alta abre
// `window.altaClienteModal.abrirNuevo` —el MISMO formulario de Clientes (SCRUM-591)— y aquí se
// comprueba qué hace el modal con lo que ese formulario le entrega. Que el formulario queda ENCIMA
// y que el recorrido entero funciona en un navegador real está medido con la sonda
// `sondas-s2/prod-1681c.mjs` y escrito en `docs/master/SCRUM-1681.md`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');
const MODAL = leer('public/dashboard/js/jobNuevoModal.js');
const PRESUPUESTO = leer('public/dashboard/js/quotesView.js');

function selectDeJuguete() {
  let opciones = [];
  let valor = '';
  const oyentes = {};
  return {
    get innerHTML() { return ''; },
    set innerHTML(html) {
      opciones = [...String(html).matchAll(/<option value="([^"]*)"\s*>([^<]*)<\/option>/g)].map((m) => ({ value: m[1], text: m[2] }));
      valor = opciones.length ? opciones[0].value : '';
    },
    get value() { return valor; },
    set value(v) { valor = opciones.some((o) => o.value === String(v)) ? String(v) : ''; },
    get opciones() { return opciones; },
    addEventListener(tipo, f) { (oyentes[tipo] = oyentes[tipo] || []).push(f); },
    elegir(v) { this.value = v; (oyentes.change || []).forEach((f) => f({ target: this })); },
  };
}

/** Monta el modal con `clientes` y devuelve los mandos. */
async function montar(clientes) {
  const sel = selectDeJuguete();
  const alerta = { style: {}, textContent: '', className: '' };
  const btn = { disabled: false };
  const campos = { '#tn-tipo': { value: '' }, '#tn-direccion': { value: '' }, '#tn-descripcion': { value: '' } };
  const nodos = { '#tn-cliente': sel, '#tn-alert': alerta, '#tn-crear': btn, '#tn-cerrar': {}, '.modal': { prepend() {} }, ...campos };
  const overlay = { className: '', innerHTML: '', querySelector: (q) => nodos[q], addEventListener() {}, remove() {} };
  const altas = [];
  const posts = [];
  const ctx = {
    document: { createElement: () => overlay, body: { appendChild() {} } },
    cabeceraModal: () => ({}),
    escHtml: (s) => String(s),
    altaClienteModal: { abrirNuevo: (o) => altas.push(o) },
    apiRequest: (url, opts) => {
      if (url === '/admin/customers') return Promise.resolve(clientes);
      posts.push({ url, cuerpo: JSON.parse(opts.body) });
      return Promise.resolve({ id: 1 });
    },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(MODAL, ctx, { filename: 'jobNuevoModal.js' });
  ctx.abrirModalTrabajoNuevo(() => {});
  await new Promise((r) => setImmediate(r));
  return { sel, alerta, btn, altas, posts };
}

const DOS = [{ id: 86, name: 'Cliente A' }, { id: 85, name: 'Cliente B' }];

test('SCRUM-1681 ③ · el selector abre VACÍO («Selecciona un cliente…») y con «+ Nuevo cliente» justo detrás', async () => {
  const { sel } = await montar(DOS);
  assert.deepEqual(sel.opciones.slice(0, 2).map((o) => [o.value, o.text]),
    [['', 'Selecciona un cliente…'], ['__alta_cliente__', '+ Nuevo cliente']],
    'las dos primeras entradas no son el hueco y el alta: con un cliente nuevo hay que salir a Clientes');
  assert.equal(sel.value, '', 'se preselecciona un cliente que nadie ha elegido');
  assert.deepEqual(sel.opciones.slice(2).map((o) => o.value), ['86', '85'], 'los clientes ya no están detrás del alta');
});

test('SCRUM-1681 ③ · elegir «+ Nuevo cliente» abre el alta de Clientes y NO deja la acción marcada', async () => {
  const { sel, altas } = await montar(DOS);
  sel.elegir('86');
  sel.elegir('__alta_cliente__');
  assert.equal(altas.length, 1, 'elegir «+ Nuevo cliente» no abre el formulario de alta');
  assert.equal(typeof altas[0].alGuardar, 'function', 'el alta no le devuelve el cliente al modal');
  assert.equal(sel.value, '86', 'tras elegir el alta el selector no vuelve a lo que tenía (si se cancela, queda la acción marcada)');
});

test('SCRUM-1681 ③ · el cliente creado queda ELEGIDO y «Abrir trabajo» lo manda', async () => {
  const { sel, btn, altas, posts } = await montar(DOS);
  sel.elegir('__alta_cliente__');
  altas[0].alGuardar({ id: 990001, name: 'Recién creado' });
  assert.equal(sel.value, '990001', 'el cliente recién creado no queda elegido');
  assert.ok(sel.opciones.some((o) => o.value === '990001' && o.text === 'Recién creado'));
  assert.equal(btn.disabled, false);
  btn.onclick();
  await new Promise((r) => setImmediate(r));
  assert.equal(posts.length, 1);
  assert.equal(posts[0].cuerpo.customerId, 990001, 'el trabajo no se abre a nombre del cliente recién creado');
});

test('SCRUM-1681 ③ · sin NINGÚN cliente: lo dice, y la salida está en el propio desplegable', async () => {
  const { sel, btn, alerta, altas } = await montar([]);
  assert.equal(btn.disabled, true);
  assert.equal(alerta.textContent, 'Primero necesitas un cliente.');
  assert.ok(sel.opciones.some((o) => o.value === '__alta_cliente__'), 'sin clientes no hay forma de crear uno desde aquí');
  sel.elegir('__alta_cliente__');
  altas[0].alGuardar({ id: 7, name: 'El primero' });
  assert.equal(sel.value, '7');
  assert.equal(btn.disabled, false, 'tras crear el primer cliente «Abrir trabajo» sigue apagado');
  assert.equal(alerta.textContent, '', 'el aviso «Primero necesitas un cliente.» sigue a la vista con el cliente ya creado');
});

test('SCRUM-1681 ③ · cero texto nuevo: los dos rótulos son, palabra por palabra, los del selector del presupuesto', () => {
  // Regla 39: aquí no se estrena ninguno. Si el presupuesto cambia el suyo, este rojo obliga a
  // decidir si cambian los dos — no a que diverjan en silencio.
  for (const t of ['Selecciona un cliente…', '+ Nuevo cliente']) {
    assert.ok(PRESUPUESTO.includes(`"${t}"`), `«${t}» ya no está en quotesView.js: este modal pinta un texto que nadie firma`);
    assert.ok(MODAL.includes(`'${t}'`), `jobNuevoModal.js no pinta «${t}»`);
  }
});
