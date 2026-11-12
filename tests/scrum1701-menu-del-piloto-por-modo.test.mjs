// SCRUM-1701 · D3 (firmada por el fundador en SCRUM-1686 c.21461): con `INVOICING_ES_ENABLED` en
// OFF (el servidor manda `modoEmision: 'receipt'`), la barra NO enseña Facturas, Cobros, Libro de
// registro ni Facturas recibidas. Se lee el modo que ya existe; no hay flag nuevo.
//
// Se EJECUTA `aplicarModoALaBarra` (y antes `aplicarRolALaBarra`, como en `initApp`) sobre el
// `<nav>` REAL de `index.html`, en el banco de vistas, y se lee lo que quedó a la vista.
//
// FUERA de este ticket, a propósito: lo que ve el OPERARIO (la medida ①bis de SCRUM-1686). Aquí el
// rol sólo entra para comprobar que los dos filtros juntos no dejan un rótulo encima de nada.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = fs.readFileSync(path.join(RAIZ, 'public/dashboard/index.html'), 'utf8');
const APP = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/app.js'), 'utf8');

// Las cuatro de D3, por su `data-view`. Escritas a mano A PROPÓSITO: son el objeto de la firma.
const CERRADAS_POR_D3 = ['invoices', 'cobros', 'libro-registro', 'facturas-recibidas'];

function navDe(html) {
  const m = /<nav class="sidebar-nav"[^>]*>([^]*?)<\/nav>/.exec(html);
  assert.ok(m, '🔴 CIEGO: no encuentro <nav class="sidebar-nav"> en index.html');
  return m[1].replace(/<!--[^]*?-->/g, '');
}

function barraPara(rol, modo) {
  const b = cargarDashboard(RAIZ, { rol });
  assert.equal(typeof b.ctx.aplicarModoALaBarra, 'function', '🔴 `app.js` no publica `aplicarModoALaBarra`');
  const cont = b.mk('nav');
  cont.className = 'sidebar-nav';
  b.ctx.document.body.appendChild(cont);
  cont.innerHTML = navDe(HTML);
  b.ctx.aplicarRolALaBarra(b.ctx.document, rol);
  b.ctx.aplicarModoALaBarra(b.ctx.document, modo);
  const oculto = (n) => String(n.style.display) === 'none';
  const visibles = [];
  const secciones = [];
  let actual = null;
  for (const n of cont.children) {
    const clases = String(n.className || '').split(/\s+/);
    if (clases.includes('nav-section-label')) {
      actual = { rotulo: String(n.textContent || '').trim(), oculto: oculto(n), aLaVista: 0 };
      secciones.push(actual);
    } else if (clases.includes('nav-item')) {
      if (!oculto(n)) { visibles.push(n.dataset.view); if (actual) actual.aLaVista += 1; }
    }
  }
  return { visibles, secciones };
}

test('1701 · control positivo: la barra de index.html tiene 18 entradas y las cuatro de D3 están', () => {
  const { visibles } = barraPara('admin', 'fiscal');
  assert.equal(visibles.length, 18, `🔴 CIEGO: esperaba 18 entradas, leo ${visibles.length}: ${visibles.join(', ')}`);
  for (const v of CERRADAS_POR_D3) assert.ok(visibles.includes(v), `🔴 CIEGO: «${v}» no está en la barra`);
});

test('1701 · con OFF (receipt) salen EXACTAMENTE las cuatro de D3, y nada más', () => {
  const antes = barraPara('admin', 'fiscal').visibles;
  const { visibles, secciones } = barraPara('admin', 'receipt');
  const quitadas = antes.filter((v) => !visibles.includes(v));
  assert.deepEqual([...quitadas].sort(), [...CERRADAS_POR_D3].sort(), `🔴 se quitaron: ${quitadas.join(', ')}`);
  assert.equal(visibles.length, 14);
  for (const s of secciones) assert.equal(s.oculto, s.aLaVista === 0, `🔴 rótulo «${s.rotulo}»: oculto=${s.oculto} con ${s.aLaVista} a la vista`);
});

test('1701 · modo fiscal: la barra no pierde nada', () => {
  assert.equal(barraPara('admin', 'fiscal').visibles.length, 18);
});
test('1701 · modo demo: la barra no pierde nada', () => {
  assert.equal(barraPara('admin', 'demo').visibles.length, 18);
});
test('1701 · modo null (no se sabe): la barra no pierde nada', () => {
  assert.equal(barraPara('admin', null).visibles.length, 18);
});
test('1701 · modo undefined: la barra no pierde nada', () => {
  assert.equal(barraPara('admin', undefined).visibles.length, 18);
});

test('1701 · operario + receipt: los dos filtros juntos no dejan un rótulo encima de nada', () => {
  const { visibles, secciones } = barraPara('tecnico', 'receipt');
  for (const v of CERRADAS_POR_D3) assert.ok(!visibles.includes(v), `🔴 «${v}» sigue a la vista`);
  for (const s of secciones) assert.equal(s.oculto, s.aLaVista === 0, `🔴 rótulo «${s.rotulo}»: oculto=${s.oculto} con ${s.aLaVista} a la vista`);
});

// La barra real no tiene hoy ninguna sección que se vacíe SÓLO por la suma de los dos filtros, así
// que este caso se fabrica: una entrada de admin y una de receipt bajo el mismo rótulo. El rol deja
// la de receipt a la vista (y con ella el rótulo); el modo la quita y tiene que cerrar el rótulo.
test('1701 · un rótulo que se vacía por la SUMA de rol y modo, se cierra', () => {
  const b = cargarDashboard(RAIZ, { rol: 'tecnico' });
  const cont = b.mk('nav');
  cont.className = 'sidebar-nav';
  b.ctx.document.body.appendChild(cont);
  cont.innerHTML = '<div class="nav-section-label">Uno</div><button class="nav-item" data-view="a">A</button>'
    + '<div class="nav-section-label">Dos</div><button class="nav-item" data-view="b" data-rol="admin">B</button>'
    + '<button class="nav-item" data-view="c" data-oculta-en-modo="receipt">C</button>';
  b.ctx.aplicarRolALaBarra(b.ctx.document, 'tecnico');
  const [uno, , dos] = cont.children;
  assert.notEqual(String(dos.style.display), 'none', '🔴 CIEGO: el rol solo ya cerraba «Dos»; el caso no prueba nada');
  b.ctx.aplicarModoALaBarra(b.ctx.document, 'receipt');
  assert.equal(String(dos.style.display), 'none', '🔴 «Dos» queda encima de nada');
  assert.notEqual(String(uno.style.display), 'none', '🔴 «Uno» tiene una entrada a la vista y se cerró');
});

test('1701 · la declaración vive en index.html y sólo la llevan las cuatro', () => {
  const nav = navDe(HTML);
  const declaradas = [...nav.matchAll(/<button\b[^>]*\bdata-oculta-en-modo="receipt"[^>]*>/g)]
    .map((m) => (/data-view="([^"]+)"/.exec(m[0]) || [])[1]);
  assert.deepEqual([...declaradas].sort(), [...CERRADAS_POR_D3].sort());
});

// (b) · decisión del orquestador (coherencia con D3, reversible): el atajo de Inicio a Facturas
// «Pendientes de cobro» lee el MISMO interruptor. Se PINTA la Inicio en el banco y se busca el botón.
async function atajoACobroEnInicio(modo) {
  const b = cargarDashboard(RAIZ);
  b.ctx.appModoEmision = modo;
  const r = await pintarVista(b, 'renderHomeView');
  assert.equal(r.error, null, `🔴 NO PUDE MIRAR: renderHomeView no monta (${r.error})`);
  const nodos = todos(r.contenedor);
  assert.ok(nodos.some((n) => n._id === 'btn-add-customer'), '🔴 NO PUDE MIRAR: la Inicio no pinta sus acciones rápidas');
  return nodos.some((n) => n._id === 'btn-view-pending');
}

test('1701b · con receipt, la Inicio NO enseña el atajo «Pendientes de cobro»', async () => {
  assert.equal(await atajoACobroEnInicio('receipt'), false);
});
test('1701b · con fiscal, el atajo sigue', async () => {
  assert.equal(await atajoACobroEnInicio('fiscal'), true);
});
test('1701b · con demo, el atajo sigue', async () => {
  assert.equal(await atajoACobroEnInicio('demo'), true);
});
test('1701b · con null (no se sabe), el atajo sigue', async () => {
  assert.equal(await atajoACobroEnInicio(null), true);
});

test('1701 · initApp aplica el modo a la barra, y DESPUÉS del rol', () => {
  const rol = APP.indexOf('aplicarRolALaBarra(document, window.appUserRole)');
  const modo = APP.indexOf('aplicarModoALaBarra(document, window.appModoEmision)');
  assert.ok(rol > 0, '🔴 CIEGO: no encuentro la llamada del rol en app.js');
  assert.ok(modo > rol, '🔴 initApp no llama a aplicarModoALaBarra con window.appModoEmision después del rol');
});
