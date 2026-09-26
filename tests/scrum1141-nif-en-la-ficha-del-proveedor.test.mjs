// tests/scrum1141-nif-en-la-ficha-del-proveedor.test.mjs — SCRUM-1141
//
// El servidor acepta `taxId` en `POST`/`PUT /admin/providers` desde SCRUM-960, y contesta
// `taxId_invalido` cuando el NIF no cuadra. La pantalla no tenía dónde teclearlo: servidor hecho,
// CERO pantalla. Esto mide la PANTALLA MONTADA (banco de vistas), no el fuente:
//
//   1. el alta pinta un campo `taxId` y lo ENVÍA en el cuerpo del POST;
//   2. vacío viaja como `null` («sin constar», SCRUM-960), no como cadena vacía;
//   3. el `taxId_invalido` del servidor se enseña en castellano, nunca el código crudo.
//
// ⛔ NO se valida el NIF en el navegador: el servidor ya valida (negativo del ticket).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Monta Proveedores con un servidor de mentira que apunta cada POST y contesta lo que se le diga. */
async function montar(respuestaAlPost) {
  const posts = [];
  const datos = (url, opciones) => {
    const u = String(url || '');
    if (u.indexOf('/admin/merchant') !== -1) return { id: 7, name: 'QA' };
    if (/\/admin\/providers\b/.test(u)) {
      if (opciones && String(opciones.method || '').toUpperCase() === 'POST') {
        posts.push(JSON.parse(opciones.body));
        return respuestaAlPost;
      }
      return { ok: true, items: [] };
    }
    if (/\/billing\/plans/.test(u)) return { plans: [], currentPlan: null, founding: null };
    return [];
  };
  const banco = cargarDashboard(RAIZ, { datos });
  const r = await pintarVista(banco, 'renderProvidersView');
  assert.equal(r.error, null, `🔴 renderProvidersView no monta: ${r.error && r.error.message}`);
  const nodos = todos(r.contenedor);
  const campo = (n) => nodos.filter((x) => x.tagName === 'INPUT' && x.getAttribute && x.getAttribute('name') === n)[0];
  const crear = nodos.filter((x) => x.tagName === 'BUTTON' && /crear proveedor/i.test(x.textContent || ''))[0];
  const texto = () => todos(r.contenedor).map((x) => x.textContent || '').join(' ');
  return { posts, campo, crear, texto };
}

const espera = () => new Promise((ok) => setTimeout(ok, 30));

test('SCRUM-1141 · 🔴 el alta pinta el campo NIF y lo ENVÍA en el POST', async () => {
  const p = await montar({ ok: true, item: { id: 1 } });
  const nif = p.campo('taxId');
  assert.ok(nif, '🔴 el formulario de alta no tiene campo `taxId`');
  assert.ok(p.crear, 'CIEGO: sin botón «Crear proveedor» no hay envío que medir');
  p.campo('name').value = 'Proveedor QA';
  nif.value = ' B12345674 ';
  p.crear.click();
  await espera();
  assert.equal(p.posts.length, 1, 'CIEGO: el POST no salió');
  assert.equal(p.posts[0].taxId, 'B12345674');
});

test('SCRUM-1141 · vacío viaja como `null` («sin constar»), no como ""', async () => {
  const p = await montar({ ok: true, item: { id: 1 } });
  p.campo('name').value = 'Proveedor QA';
  p.crear.click();
  await espera();
  assert.equal(p.posts.length, 1, 'CIEGO: el POST no salió');
  assert.ok('taxId' in p.posts[0], '🔴 el cuerpo no lleva `taxId`');
  assert.equal(p.posts[0].taxId, null);
});

test('SCRUM-1141 · 🔴 `taxId_invalido` se pinta en castellano, nunca el código crudo', async () => {
  const p = await montar({ ok: false, error: 'taxId_invalido' });
  p.campo('name').value = 'Proveedor QA';
  p.campo('taxId').value = 'X';
  p.crear.click();
  await espera();
  assert.equal(p.posts.length, 1, 'CIEGO: el POST no salió');
  const t = p.texto();
  assert.ok(!/taxId_invalido/.test(t), '🔴 se enseña el código crudo');
  assert.match(t, /Ese NIF\/CIF no es válido\. Compruébalo\./);
});
