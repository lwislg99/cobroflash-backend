// tests/scrum1751-aviso-de-visita-nueva.test.mjs — SCRUM-1751
//
// EL AVISO «¿Empezar una visita nueva?», EN LAS DOS PUERTAS AL PARTE.
//
// D2 (SCRUM-1686): un parte por visita. Las dos puertas —«Abrir parte» en la fila de la lista y
// «+ Nuevo parte» en la ficha del trabajo— crean un parte cuando no encuentran un borrador que
// abrir. Hasta SCRUM-1751 lo creaban sin decir nada, también cuando el último parte del trabajo
// estaba ya FIRMADO: quien volvía a mirar lo de ayer se encontraba con un parte vacío recién
// creado, de una visita que no existe.
//
// QUÉ ATA ESTE FICHERO (la aceptación del encargo):
//   · con el último parte FIRMADO y ningún borrador → sale el aviso, con el texto firmado, y NO
//     se crea nada hasta pulsar «Crear parte nuevo»; «Cancelar» no crea ni navega;
//   · con un borrador → todo como antes, sin aviso;
//   · sin ningún parte → se crea sin aviso (es la primera visita: no hay nada que confundir).
//
// QUÉ NO MIDE: el aspecto (lo dan las capturas del registro a 390 y 1280) ni que el servidor
// ordene la lista por fecha descendente (lo hace `partes.routes.ts`; aquí se le da ya ordenada).
//
// POBLACIÓN: 2 puertas × los casos de abajo, sobre el banco de vistas (`_banco-vistas.mjs`), que
// ejecuta los scripts REALES del panel. Cada caso tiene su SUELO: si la puerta no se encuentra, el
// test cae diciendo CIEGO, no pasa en vacío.

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { datosDelCenso } from '../scripts/_datos-del-censo.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const reparto = require(path.join(RAIZ, 'public/dashboard/js/jobDocsReparto.js'));

// El texto FIRMADO (SCRUM-1751; ficha en `docs/microcopy/`). Aquí va escrito otra vez A PROPÓSITO:
// si el test lo leyera del código, cambiar el código cambiaría también lo que el test exige.
const TITULO = '¿Empezar una visita nueva?';
const CUERPO = 'El último parte de este trabajo ya está firmado. Si sigues, se crea un parte nuevo para otra visita.';
const CREAR = 'Crear parte nuevo';
const CANCELAR = 'Cancelar';

const clases = (n) => String((n && n.className) || '').split(/\s+/).filter(Boolean);
const tiene = (n, c) => clases(n).includes(c);
const texto = (n) => todos(n).map((x) => x._texto || '').join(' ').replace(/\s+/g, ' ').trim();
const plano = (x) => JSON.parse(JSON.stringify(x)); // los objetos nacen en el realm del vm
const espera = () => new Promise((ok) => setTimeout(ok, 20));

/** Los modales de Trabajos abiertos AHORA (cuelgan de `document.body`, fuera de la vista). */
const modales = (banco) => todos(banco.ctx.document.body).filter((n) => tiene(n, 'jobs-modal'));
const botonDe = (raiz, rotulo) => todos(raiz).filter((n) => n.tagName === 'BUTTON' && texto(n) === rotulo);

// ── La regla, sola ───────────────────────────────────────────────────────────────────────────────

test('SCRUM-1751 · existe `pideAvisoDeVisitaNueva` y la exporta la pieza del reparto', () => {
  assert.equal(typeof reparto.pideAvisoDeVisitaNueva, 'function',
    '🔴 CIEGO: `jobDocsReparto.js` no exporta `pideAvisoDeVisitaNueva`; las dos puertas no tendrían una regla común');
});

test('SCRUM-1751 · la regla: último FIRMADO y ningún borrador → avisa; cualquier otra cosa → no', () => {
  const f = reparto.pideAvisoDeVisitaNueva;
  assert.equal(typeof f, 'function', '🔴 CIEGO: no hay regla que probar');
  const casos = [
    ['sólo uno firmado', [{ id: 9, estado: 'firmado' }], true],
    ['dos firmados', [{ id: 9, estado: 'firmado' }, { id: 8, estado: 'firmado' }], true],
    ['ningún parte', [], false],
    ['sólo un borrador', [{ id: 9, estado: 'borrador' }], false],
    ['firmado reciente y un borrador anterior', [{ id: 9, estado: 'firmado' }, { id: 8, estado: 'borrador' }], false],
    ['borrador reciente y un firmado anterior', [{ id: 9, estado: 'borrador' }, { id: 8, estado: 'firmado' }], false],
    ['el último no está firmado ni es borrador', [{ id: 9, estado: 'otro' }, { id: 8, estado: 'firmado' }], false],
    ['no es una lista', null, false],
    ['una lista con huecos', [null, { id: 9, estado: 'firmado' }], true],
  ];
  for (const [nombre, partes, esperado] of casos) {
    assert.equal(f(partes), esperado, `🔴 ${nombre}: la regla dice ${f(partes)} y se esperaba ${esperado}`);
  }
});

// ── Las dos puertas ──────────────────────────────────────────────────────────────────────────────
// Cada puerta se monta con SU vista y da lo mismo: el botón, lo que se ha pedido a la red y adónde
// se ha navegado. `partes` son los partes DEL trabajo, ya ordenados del más reciente al más viejo.

const HOY = new Date().toISOString();
const ANTES = new Date(Date.now() - 2 * 86400000).toISOString();

async function puertaDeLaLista({ partes, falla = false }) {
  const dc = datosDelCenso();
  dc.enVista('renderJobsView');
  const altas = [];
  const navegado = [];
  const avisos = [];
  const datos = (url, opts) => {
    const p = new URL(String(url), 'https://yaqu.app').pathname;
    const metodo = (opts && opts.method) || 'GET';
    if (p === '/admin/jobs') {
      const base = dc.datos('/admin/jobs')[0];
      return [{ ...structuredClone(base), id: 101, status: 'en_curso', titulo: 'T-uno', tituloPropio: 'T-uno' }];
    }
    if (p === '/admin/partes' && metodo === 'GET') return { partes: partes.map((x) => ({ jobId: 101, ...x })) };
    if (p === '/admin/partes' && metodo === 'POST') {
      altas.push(JSON.parse(opts.body));
      if (falla) throw new Error('red caída');
      return { id: 77 };
    }
    return dc.datos(url, opts);
  };
  const banco = cargarDashboard(RAIZ, { datos });
  banco.ctx.renderAppView = (vista, o) => { navegado.push([vista, o]); };
  const r = await pintarVista(banco, 'renderJobsView');
  assert.equal(r.error, null, `🔴 SUELO: la lista no monta (${r.error && r.error.message})`);
  banco.ctx.showToast = (t) => { avisos.push(t); };
  const [boton] = botonDe(r.contenedor, 'Abrir parte');
  assert.ok(boton, '🔴 CIEGO: la lista no pinta «Abrir parte» en el trabajo en curso');
  return { banco, boton, altas, navegado, avisos, jobId: 101, creado: 77 };
}

async function puertaDeLaFicha({ partes, falla = false }) {
  const j = {
    id: 7, status: 'en_curso', createdAt: '2026-09-01T09:00:00Z', titulo: 'Revisión anual',
    customer: { id: 3, name: 'IES' }, asignados: [], operario: null,
    albaranes: [], gastos: [], notes: '', quote: { currency: 'EUR' }, direccion: null,
    partes,
  };
  const banco = cargarDashboard(RAIZ);
  const altas = [];
  const navegado = [];
  const avisos = [];
  banco.ctx.apiRequest = async (u, opts) => {
    if (/\/admin\/team/.test(u)) return [];
    if (/\/admin\/merchant/.test(u)) return { name: 'Epipe', timezone: 'UTC' };
    if (/\/admin\/partes/.test(u)) {
      if (opts && opts.method === 'POST') {
        altas.push(JSON.parse(opts.body));
        if (falla) throw new Error('red caída');
        return { id: 99, numero: 'PT-2026-099', estado: 'borrador', fecha: HOY, jobId: j.id };
      }
      return { partes: partes.map((p) => ({ ...p, jobId: j.id })) };
    }
    if (/gastos/.test(u)) return [];
    return j;
  };
  banco.ctx.appUserRole = 'admin';
  const r = await pintarVista(banco, 'renderJobDetailView');
  assert.equal(r.error, null, `🔴 SUELO: la ficha no monta (${r.error && r.error.message})`);
  banco.ctx.renderAppView = (vista, o) => { navegado.push([vista, o]); };
  banco.ctx.showToast = (t) => { avisos.push(t); };
  const boton = todos(r.contenedor).find((n) => n.getAttribute && n.getAttribute('data-abrir-parte') === '1');
  assert.ok(boton, '🔴 CIEGO: la ficha no pinta la puerta `data-abrir-parte`');
  return { banco, boton, altas, navegado, avisos, jobId: 7, creado: 99 };
}

const FIRMADO = { id: 9, numero: 'PT-2026-009', estado: 'firmado', fecha: HOY };
const BORRADOR_DE_HOY = { id: 12, numero: 'PT-2026-012', estado: 'borrador', fecha: HOY };

// Cada caso es una función de la puerta (`montar`), y se registra abajo UNA vez por puerta con su
// nombre ESCRITO: un nombre construido en un bucle no lo ve la señal por nombres (SCRUM-1415).
  const casoAvisa = (montar) => async () => {
    const p = await montar({ partes: [FIRMADO] });
    p.boton.click();
    await espera();
    const abiertos = modales(p.banco);
    assert.equal(abiertos.length, 1, `🔴 se esperaba UN aviso y hay ${abiertos.length}: el parte se crea sin preguntar`);
    const [m] = abiertos;
    assert.equal(m.getAttribute('role'), 'dialog', '🔴 el aviso no es un diálogo para quien lo oye');
    const titulo = todos(m).filter((n) => tiene(n, 'jobs-modal-titulo')).map(texto);
    assert.deepEqual(titulo, [TITULO], `🔴 el título es ${JSON.stringify(titulo)}`);
    const cuerpo = todos(m).filter((n) => tiene(n, 'jobs-modal-cuerpo')).map(texto);
    assert.deepEqual(cuerpo, [CUERPO], `🔴 el cuerpo es ${JSON.stringify(cuerpo)}`);
    const botones = todos(m).filter((n) => n.tagName === 'BUTTON');
    assert.deepEqual(botones.map(texto), [CANCELAR, CREAR], `🔴 los botones son ${JSON.stringify(botones.map(texto))}`);
    assert.ok(tiene(botones[1], 'btn-primary'), `🔴 «${CREAR}» no es la primaria: «${botones[1].className}»`);
    assert.ok(!tiene(botones[0], 'btn-primary'), `🔴 «${CANCELAR}» también es primaria: dos primarias en un aviso`);
    assert.deepEqual(p.altas, [], '🔴 creó el parte ANTES de que nadie contestara al aviso');
    assert.deepEqual(plano(p.navegado), [], '🔴 navegó antes de que nadie contestara al aviso');
  };

  const casoCrea = (montar) => async () => {
    const p = await montar({ partes: [FIRMADO] });
    p.boton.click();
    await espera();
    const [crear] = modales(p.banco).flatMap((m) => botonDe(m, CREAR));
    assert.ok(crear, `🔴 CIEGO: no hay «${CREAR}» que pulsar`);
    crear.click();
    await espera();
    assert.deepEqual(p.altas, [{ jobId: p.jobId }], `🔴 se esperaba UN alta del trabajo ${p.jobId}: ${JSON.stringify(p.altas)}`);
    assert.deepEqual(plano(p.navegado), [['parte-detail', { parteId: p.creado }]], `🔴 navegó a ${JSON.stringify(p.navegado)}`);
    assert.equal(modales(p.banco).length, 0, '🔴 el aviso sigue abierto encima del parte recién creado');
  };

  const casoCancela = (montar) => async () => {
    const p = await montar({ partes: [FIRMADO] });
    p.boton.click();
    await espera();
    const [cancelar] = modales(p.banco).flatMap((m) => botonDe(m, CANCELAR));
    assert.ok(cancelar, `🔴 CIEGO: no hay «${CANCELAR}» que pulsar`);
    cancelar.click();
    await espera();
    assert.deepEqual(p.altas, [], '🔴 «Cancelar» creó un parte');
    assert.deepEqual(plano(p.navegado), [], '🔴 «Cancelar» navegó');
    assert.equal(modales(p.banco).length, 0, '🔴 el aviso sigue abierto tras «Cancelar»');
    assert.ok(!p.boton.disabled, '🔴 la puerta se queda deshabilitada tras «Cancelar»: un botón muerto');
  };

  const casoFalla = (montar) => async () => {
    const p = await montar({ partes: [FIRMADO], falla: true });
    p.boton.click();
    await espera();
    const [crear] = modales(p.banco).flatMap((m) => botonDe(m, CREAR));
    assert.ok(crear, `🔴 CIEGO: no hay «${CREAR}» que pulsar`);
    crear.click();
    await espera();
    assert.equal(p.altas.length, 1, '🔴 CIEGO: el alta no llegó a intentarse, así que su fallo no se ha probado');
    assert.deepEqual(plano(p.navegado), [], '🔴 navegó a un parte que no se creó');
    assert.deepEqual(plano(p.avisos), ['No se ha podido abrir el parte. Vuelve a intentarlo.'],
      `🔴 el fallo del alta no se dice (o se dice con otro texto): ${JSON.stringify(p.avisos)}`);
  };

  const casoConBorrador = (montar) => async () => {
    const p = await montar({ partes: [FIRMADO, BORRADOR_DE_HOY] });
    p.boton.click();
    await espera();
    assert.equal(modales(p.banco).length, 0, '🔴 sale el aviso habiendo un borrador que abrir');
    assert.deepEqual(p.altas, [], '🔴 creó un parte habiendo un borrador');
    assert.deepEqual(plano(p.navegado), [['parte-detail', { parteId: 12 }]], `🔴 navegó a ${JSON.stringify(p.navegado)}`);
  };

  const casoSinPartes = (montar) => async () => {
    const p = await montar({ partes: [] });
    p.boton.click();
    await espera();
    assert.equal(modales(p.banco).length, 0, '🔴 sale el aviso sin que haya ningún parte firmado');
    assert.deepEqual(p.altas, [{ jobId: p.jobId }], `🔴 se esperaba UN alta: ${JSON.stringify(p.altas)}`);
    assert.deepEqual(plano(p.navegado), [['parte-detail', { parteId: p.creado }]]);
  };

test('SCRUM-1751 · lista · «Abrir parte» · último parte FIRMADO y sin borrador → sale el aviso, con el texto firmado, y NO crea', casoAvisa(puertaDeLaLista));
test('SCRUM-1751 · lista · «Abrir parte» · «Crear parte nuevo» crea UNO, lo abre y cierra el aviso', casoCrea(puertaDeLaLista));
test('SCRUM-1751 · lista · «Abrir parte» · «Cancelar» no crea, no navega, cierra el aviso y deja la puerta viva', casoCancela(puertaDeLaLista));
test('SCRUM-1751 · lista · «Abrir parte» · si el alta falla tras aceptar, sale el aviso de siempre y no navega', casoFalla(puertaDeLaLista));
test('SCRUM-1751 · lista · «Abrir parte» · con un BORRADOR, todo como antes: lo abre, sin aviso y sin crear', casoConBorrador(puertaDeLaLista));
test('SCRUM-1751 · lista · «Abrir parte» · sin NINGÚN parte, crea el de la primera visita sin aviso', casoSinPartes(puertaDeLaLista));

test('SCRUM-1751 · ficha · «+ Nuevo parte» · último parte FIRMADO y sin borrador → sale el aviso, con el texto firmado, y NO crea', casoAvisa(puertaDeLaFicha));
test('SCRUM-1751 · ficha · «+ Nuevo parte» · «Crear parte nuevo» crea UNO, lo abre y cierra el aviso', casoCrea(puertaDeLaFicha));
test('SCRUM-1751 · ficha · «+ Nuevo parte» · «Cancelar» no crea, no navega, cierra el aviso y deja la puerta viva', casoCancela(puertaDeLaFicha));
test('SCRUM-1751 · ficha · «+ Nuevo parte» · si el alta falla tras aceptar, sale el aviso de siempre y no navega', casoFalla(puertaDeLaFicha));
test('SCRUM-1751 · ficha · «+ Nuevo parte» · con un BORRADOR, todo como antes: lo abre, sin aviso y sin crear', casoConBorrador(puertaDeLaFicha));
test('SCRUM-1751 · ficha · «+ Nuevo parte» · sin NINGÚN parte, crea el de la primera visita sin aviso', casoSinPartes(puertaDeLaFicha));

test('SCRUM-1751 · ficha · firmado HOY y un borrador de OTRO día: crea como antes, sin aviso (hay borrador)', async () => {
  // La ficha sólo ABRE el borrador de HOY (SCRUM-1694); con uno de otro día crea el de esta visita.
  // El aviso no cambia eso: con un borrador, todo como antes.
  const p = await puertaDeLaFicha({ partes: [FIRMADO, { id: 11, numero: 'PT-2026-011', estado: 'borrador', fecha: ANTES }] });
  p.boton.click();
  await espera();
  assert.equal(modales(p.banco).length, 0, '🔴 sale el aviso habiendo un borrador');
  assert.deepEqual(p.altas, [{ jobId: 7 }]);
  assert.deepEqual(plano(p.navegado), [['parte-detail', { parteId: 99 }]]);
});

test('SCRUM-1751 · lista · el firmado es de OTRO trabajo: no avisa, crea el de éste', async () => {
  const p = await puertaDeLaLista({ partes: [{ ...FIRMADO, jobId: 999 }] });
  p.boton.click();
  await espera();
  assert.equal(modales(p.banco).length, 0, '🔴 avisa por el parte firmado de OTRO trabajo');
  assert.deepEqual(p.altas, [{ jobId: 101 }]);
});
