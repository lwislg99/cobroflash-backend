// tests/scrum1317-productos-del-operario.test.mjs — SCRUM-1317 (BUGS.md · P1-1317)
//
// LA PANTALLA DE PRODUCTOS, MONTADA CON ROL DE OPERARIO.
//
// Hasta el 1-oct-2026 ningún test lo hacía: el banco de vistas usa `admin` por defecto, así que
// toda pantalla que se bifurca por rol se medía por una sola rama. Por la otra, Productos
// reventaba: SCRUM-597 le retira al operario «Coste» y «Margen %», y unas líneas después se
// cableaban los tres campos sin mirar si seguían ahí. El `TypeError` cortaba `renderProductsView`
// antes de `refresh()`, y la lista —que S1 le da en lectura— salía vacía. Medido en Edge sobre
// `main`: 0 filas con 1 producto en el servidor.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const respirar = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r)); };
const texto = (n) => todos(n).map((x) => (x.hijos.length ? '' : String(x.textContent || ''))).join(' ');
/** Por atributo O por campo: el alta se pinta con marcado y otras piezas asignan `.name`. */
const campo = (n, nombre) => todos(n).find((x) => x.tagName === 'INPUT' && (x.getAttribute('name') || x.name) === nombre) || null;

const datos = (url) => {
  if (/\/admin\/merchant/.test(url)) return { id: 1, name: 'Taller', defaultCurrency: 'EUR', country: 'ES' };
  if (/\/admin\/products/.test(url)) return { ok: true, items: [{ id: 1, name: 'Grifo monomando', price: 40, isActive: true }] };
  if (/\/admin\/providers/.test(url)) return { ok: true, items: [] };
  return [];
};

async function montar(rol) {
  const b = cargarDashboard(RAIZ, { rol, datos });
  b.ctx.appMerchantId = 1;
  const v = await pintarVista(b, 'renderProductsView');
  await respirar();
  return { b, v };
}

test('SCRUM-1317 · 🔴 con rol de OPERARIO, Productos monta y pinta su lista', async () => {
  const { v } = await montar('tecnico');
  assert.equal(v.error, null, `🔴 Productos LANZA con rol de operario: ${v.error && v.error.message}`);
  assert.equal(v.noMedida, null, `🔴 ${v.noMedida}`);
  assert.match(texto(v.contenedor), /Grifo monomando/, '🔴 la lista de productos del operario sale vacía');
  // Lo que le retira SCRUM-597 sigue retirado: el arreglo no es devolverle los campos.
  assert.equal(campo(v.contenedor, 'cost'), null, '🔴 al operario se le pinta «Coste»');
  assert.equal(campo(v.contenedor, 'margen'), null, '🔴 al operario se le pinta «Margen %»');
});

test('SCRUM-1317 · control: con rol de ADMIN la pantalla es la de siempre, y el margen se sigue calculando', async () => {
  const { v } = await montar('admin');
  assert.equal(v.error, null, `🔴 Productos no monta con rol de admin: ${v.error && v.error.message}`);
  assert.match(texto(v.contenedor), /Grifo monomando/);
  const coste = campo(v.contenedor, 'cost');
  const precio = campo(v.contenedor, 'price');
  const margen = campo(v.contenedor, 'margen');
  assert.ok(coste && precio && margen, '🔴 CIEGO: el alta del admin ya no tiene coste, precio y margen');

  // El cableado, por EFECTO: coste 50 y precio 100, y el margen se rellena solo.
  coste.value = '50';
  precio.value = '100';
  precio.disparar('input');
  assert.notEqual(String(margen.value || ''), '', '🔴 al admin ya no se le calcula el margen al escribir el precio');
});
