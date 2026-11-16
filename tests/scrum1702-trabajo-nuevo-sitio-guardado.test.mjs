// SCRUM-1702 · camino 1 (decisión del orquestador, SCRUM-1702 c.21501): en «Trabajo nuevo», bajo la
// «Dirección de la obra», el MISMO «Elegir un sitio guardado» que el presupuesto y la ficha del
// Trabajo (`sitiosGuardados.montarSelector`, SCRUM-1144). Manda DOC-12 (SCRUM-602): la dirección se
// ELIGE con una pulsación y nunca se rellena sola.
//
// QUÉ MIDE ESTO: EJECUTA `jobNuevoModal.js` con `sitiosGuardados.js` REALES en el banco de vistas
// (`_banco-vistas.mjs`), elige un cliente en el `<select>` del modal, pulsa el botón y el sitio, y
// lee el cuerpo del `POST /admin/jobs` que sale al pulsar «Abrir trabajo».
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODAL = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/jobNuevoModal.js'), 'utf8');

const CLIENTES = [{ id: 86, name: 'Cliente A' }, { id: 85, name: 'Cliente B' }];
const SITIOS = {
  86: { sitios: [{ id: 1, name: 'Nave del polígono', address: 'Calle Uno 1', city: 'Leganés', postalCode: '28911' }] },
  85: { sitios: [] },
};
// Lo que `sitiosGuardados.componerDireccionSitio` escribe para ese sitio (el formato es suyo, no de aquí).
const DIRECCION_86 = 'Calle Uno 1, 28911, Leganés';

const espera = () => new Promise((r) => setImmediate(r));

async function montar() {
  const posts = [];
  const pedidas = [];
  const b = cargarDashboard(RAIZ, {
    datos: (ruta, opts) => {
      pedidas.push(ruta);
      if (ruta === '/admin/customers') return CLIENTES;
      const m = /^\/admin\/customers\/(\d+)\/sites$/.exec(ruta);
      if (m) return SITIOS[m[1]] || { sitios: [] };
      if (ruta === '/admin/jobs' && opts && opts.method === 'POST') { posts.push(JSON.parse(opts.body)); return { id: 1 }; }
      return {};
    },
  });
  assert.equal(typeof b.ctx.abrirModalTrabajoNuevo, 'function', '🔴 NO PUDE MIRAR: el banco no carga jobNuevoModal.js');
  assert.equal(typeof b.ctx.sitiosGuardados?.montarSelector, 'function', '🔴 NO PUDE MIRAR: el banco no carga sitiosGuardados.js');
  b.ctx.abrirModalTrabajoNuevo(() => {});
  await espera(); await espera();
  const nodos = () => todos(b.ctx.document.body);
  const porId = (id) => nodos().find((n) => n._id === id);
  const sel = porId('tn-cliente');
  const campo = porId('tn-direccion');
  assert.ok(sel && campo, '🔴 NO PUDE MIRAR: el modal no pinta #tn-cliente / #tn-direccion');
  const boton = () => nodos().find((n) => String(n.className || '').includes('sitios-guardados__boton'));
  const elegir = (v) => {
    sel.value = v;
    assert.equal(String(sel.value), String(v), `🔴 NO PUDE MIRAR: el <select> del banco no acepta «${v}»`);
    sel.disparar('change');
  };
  return { b, sel, campo, boton, elegir, posts, pedidas, porId, nodos };
}

test('1702 · sin cliente elegido, el botón está pero NO se enseña', async () => {
  const { boton } = await montar();
  assert.ok(boton(), '🔴 «Elegir un sitio guardado» no está en «Trabajo nuevo»');
  assert.equal(boton().textContent, 'Elegir un sitio guardado');
  assert.equal(boton().hidden, true, 'sin cliente se enseña un botón que no puede hacer nada');
});

test('1702 · con cliente: se enseña, y la dirección NO se rellena sola (DOC-12)', async () => {
  const { boton, campo, elegir, pedidas } = await montar();
  elegir('86');
  await espera();
  assert.equal(boton().hidden, false, 'con cliente elegido el botón sigue escondido');
  assert.equal(campo.value, '', '🔴 DOC-12: la dirección se ha rellenado sin que nadie la elija');
  assert.ok(!pedidas.some((r) => /\/sites$/.test(r)), 'se piden los sitios sin que nadie pulse el botón');
});

test('1702 · pulsar el botón y un sitio escribe su dirección, y «Abrir trabajo» la manda', async () => {
  const { boton, campo, elegir, posts, nodos, porId } = await montar();
  elegir('86');
  boton().click();
  await espera(); await espera();
  const opcion = nodos().find((n) => String(n.className || '').includes('sitios-guardados__opcion'));
  assert.ok(opcion, '🔴 la lista no ofrece el sitio guardado del cliente');
  opcion.click();
  assert.equal(campo.value, DIRECCION_86);
  // El modal lo engancha con `onclick` (no con un oyente), igual que lo pulsa el test de 1681c.
  porId('tn-crear').onclick();
  await espera(); await espera();
  assert.equal(posts.length, 1, '«Abrir trabajo» no manda nada');
  assert.equal(posts[0].customerId, 86);
  assert.equal(posts[0].direccion, DIRECCION_86, 'el trabajo no se crea con la dirección elegida');
});

test('1702 · cliente sin sitios: el campo sigue vacío y libre', async () => {
  const { boton, campo, elegir, nodos } = await montar();
  elegir('85');
  boton().click();
  await espera(); await espera();
  assert.ok(!nodos().some((n) => String(n.className || '').includes('sitios-guardados__opcion')));
  assert.equal(campo.value, '');
  assert.notEqual(campo.disabled, true);
});

test('1702 · cambiar de cliente cierra la lista del anterior', async () => {
  const { boton, elegir, porId } = await montar();
  elegir('86');
  boton().click();
  await espera(); await espera();
  assert.equal(porId('tn-sitios-guardados').hidden, false, '🔴 NO PUDE MIRAR: la lista no llegó a abrirse');
  elegir('85');
  assert.equal(porId('tn-sitios-guardados').hidden, true, 'la lista abierta sigue ofreciendo los sitios del cliente anterior');
  assert.equal(boton().hidden, false);
});

test('1702 · volver a «Selecciona un cliente…» esconde el botón otra vez', async () => {
  const { boton, elegir } = await montar();
  elegir('86');
  elegir('');
  assert.equal(boton().hidden, true);
});

test('1702 · cero texto nuevo: el modal no escribe el rótulo, lo pinta el control compartido', () => {
  assert.ok(!MODAL.includes("'Elegir un sitio guardado'"), 'jobNuevoModal.js escribe su propia copia del rótulo');
  assert.ok(MODAL.includes('sitiosGuardados.montarSelector'), 'jobNuevoModal.js no usa el control compartido');
});
