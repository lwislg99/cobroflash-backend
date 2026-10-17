// tests/scrum1560-datos-de-muestra-con-forma.test.mjs — SCRUM-1560
//
// El censo táctil monta cada vista del banco con datos de muestra. Medido el 16-oct-2026 sobre
// `ce054fb4`: 28 rutas recibían un `[]` de relleno (varias son OBJETO en el servidor), seis el dato de OTRA ruta y cinco vistas de detalle
// se montaban sin id: el banco pintaba pantallas que el producto no alcanza («undefined» en
// Referidos, en Inicio, en Exportar…). Aquí se fija:
//   · el comprobador de forma SABE fallar (forma mala → cae) y sabe absolver (forma buena → pasa);
//   · las respuestas VIEJAS del censo, con su forma, caen contra el contrato del servidor;
//   · cada ruta recibe SU dato (su ejemplo casa con su contrato, no con el de otra);
//   · ninguna vista pide una ruta sin contrato, y ninguna pinta «undefined» ni «NaN».
// Sin BD ni red: lee ficheros y monta el banco en memoria.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CONTRATOS, comprobarForma, contratoDe, datosDelCenso, ARGUMENTOS_DEL_CENSO, IDS,
} from '../scripts/_datos-del-censo.mjs';
import { serializar, CLIENTES_DE_MUESTRA, TRABAJO_DE_MUESTRA } from '../scripts/_pagina-panel.mjs';
import { cargarDashboard, pintarVista } from './_banco-vistas.mjs';
import { soloCodigo } from './_solo-codigo.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const de = (ruta) => {
  const c = contratoDe(ruta);
  assert.ok(c, `🔴 sin contrato para ${ruta}`);
  return c;
};

test('CONTROL · el comprobador cae con la forma mala y pasa con la buena, en sus cuatro reglas', () => {
  const obj = { ejemplo: '/x', forma: 'objeto', claves: ['a', 'b'] };
  const arr = { ejemplo: '/y', forma: 'array', elemento: ['id'] };
  assert.deepEqual(comprobarForma(obj, { a: 1, b: null }), [], 'objeto con sus claves (null vale: es un valor)');
  assert.deepEqual(comprobarForma(arr, [{ id: 1 }, { id: 2 }]), [], 'array con sus elementos');
  assert.deepEqual(comprobarForma(arr, []), [], 'un array VACÍO es una forma del servidor');
  assert.equal(comprobarForma(obj, []).length, 1, 'array donde el servidor da objeto');
  assert.equal(comprobarForma(arr, {}).length, 1, 'objeto donde el servidor da array');
  assert.equal(comprobarForma(obj, null).length, 1, 'null donde el servidor da objeto');
  assert.equal(comprobarForma(obj, { a: 1 }).length, 1, 'falta una clave');
  assert.equal(comprobarForma(arr, [{ id: 1 }, 'x']).length, 1, 'un elemento que no es objeto');
  assert.equal(comprobarForma(arr, [{ nombre: 'x' }]).length, 1, 'un elemento sin su clave');
  const sobre = { ejemplo: '/z', forma: 'objeto', claves: ['ok', 'items'], elementosDe: { items: ['concepto'] } };
  assert.deepEqual(comprobarForma(sobre, { ok: true, items: [{ concepto: 'a' }] }), [], 'lista anidada con sus elementos');
  assert.equal(comprobarForma(sobre, { ok: true, items: [{ id: 1 }] }).length, 1, 'lista anidada con el elemento de OTRA ruta');
  assert.equal(comprobarForma(sobre, { ok: true, items: {} }).length, 1, 'lista anidada que no es array');
});

test('🔴 EL ROJO DE ANTES: lo que servía el censo viejo cae contra el contrato del servidor', () => {
  // Las respuestas que daba `DATOS` hasta SCRUM-1560, ruta por ruta, tal cual.
  const viejo = [
    ['/admin/referral', []],
    ['/admin/connect/status', []],
    ['/admin/metrics/home', []],
    ['/admin/reports/pl', []],
    ['/admin/expenses/summary', []],
    ['/admin/exports/datos.zip/info', []],
    ['/admin/albaranes', []],
    ['/admin/partes/oficina/pendientes', []],
    ['/admin/customers/1/historial', CLIENTES_DE_MUESTRA],
    ['/admin/customers/1/whatsapp', CLIENTES_DE_MUESTRA],
    ['/admin/jobs/1/gastos', TRABAJO_DE_MUESTRA],
    ['/admin/albaranes/31/fotos', { id: 1, estado: 'borrador', lines: [], items: [] }],
    ['/admin/albaranes/pendientes-facturar', { id: 1, estado: 'borrador', lines: [], items: [] }],
    ['/admin/albaranes/31', { id: 1, estado: 'borrador', lines: [], items: [] }],
    ['/admin/products/frequent-concepts', { ok: true, items: [{ id: 1, name: 'Grifo' }] }],
    ['/admin/billing/plans', { plans: [], currentPlan: null, founding: null }],
  ];
  const absueltos = viejo.filter(([r, v]) => comprobarForma(de(r), v).length === 0).map(([r]) => r);
  assert.deepEqual(absueltos, [], `🔴 el contrato absuelve una respuesta que el servidor no da: ${absueltos.join(', ')}`);
});

test('🔴 SCRUM-1560d · los tres fixtures COMPARTIDOS de antes caen contra su contrato del servidor', () => {
  // Tal como estaban en `_pagina-panel.mjs` hasta SCRUM-1560d (recortados a lo que decide).
  const clienteViejo = { id: 1, name: 'x', phone: '34000000001', email: 'a@b.es', notes: '', tags: [], createdAt: '2026-01-15T10:00:00Z' };
  const viejo = [
    ['/admin/customers', [clienteViejo]],
    ['/admin/customers/1/detail', { customer: clienteViejo, quotes: [{ id: 11, quoteNumber: 'P', status: 'accepted', total: 1, currency: 'EUR', createdAt: 'x' }],
      invoices: [{ id: 21, number: 'F', status: 'paid', total: 1, currency: 'EUR', createdAt: 'x', pdfUrl: '/x.pdf' }], stats: {}, events: [] }],
    ['/admin/jobs/1', { id: 1, title: 'Reforma de baño', status: 'en_curso', customer: { id: 5 }, albaranes: [], invoices: [] }],
  ];
  const absueltos = viejo.filter(([r, v]) => comprobarForma(de(r), v).length === 0).map(([r]) => r);
  assert.deepEqual(absueltos, [], `🔴 el contrato absuelve un fixture que el servidor no da: ${absueltos.join(', ')}`);
  // Y los de ahora no traen lo que el servidor NUNCA manda: `title` en el Trabajo ni `tags: []`.
  assert.ok(!('title' in TRABAJO_DE_MUESTRA), 'el Trabajo de muestra vuelve a llevar `title`');
  const vacias = CLIENTES_DE_MUESTRA.filter((c) => Array.isArray(c.tags) && c.tags.length === 0).map((c) => c.name);
  assert.deepEqual(vacias, [], 'clientes con `tags: []`, que `normalizarTags` convierte en null');
});

test('cada contrato: su dato cumple, su ejemplo casa con ÉL (no con el de otra ruta) y su fuente existe', () => {
  assert.ok(CONTRATOS.length >= 45, `sólo ${CONTRATOS.length} contratos: se perdieron rutas`);
  const fallos = [];
  for (const c of CONTRATOS) {
    fallos.push(...comprobarForma(c, c.dato()));
    if (contratoDe(c.ejemplo) !== c) fallos.push(`${c.ejemplo} lo contesta ${contratoDe(c.ejemplo)?.ejemplo ?? 'nadie'}`);
    const fichero = c.fuente.split(' ')[0];
    if (!fs.existsSync(path.join(RAIZ, fichero))) { fallos.push(`${c.ejemplo}: la fuente ${fichero} no existe`); continue; }
    // Anclado por IDENTIDAD: el literal de la ruta tiene que seguir en su router.
    if (fichero.startsWith('src/')) {
      if (!c.get) fallos.push(`${c.ejemplo}: fuente del servidor sin \`get\``);
      else if (!new RegExp(`\\.get\\(\\s*['"]${c.get.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`).test(fs.readFileSync(path.join(RAIZ, fichero), 'utf8'))) {
        fallos.push(`${c.ejemplo}: ${fichero} ya no tiene \`.get('${c.get}'\``);
      }
    }
  }
  const delServidor = CONTRATOS.filter((c) => c.fuente.startsWith('src/')).length;
  assert.ok(delServidor >= 40, `sólo ${delServidor} contratos citan el servidor`);
  assert.deepEqual(fallos, []);
});

test('las seis rutas que recibían el dato de OTRA tienen ahora el suyo', () => {
  const pares = [
    ['/admin/customers/7/historial', '/admin/customers'],
    ['/admin/customers/7/whatsapp', '/admin/customers'],
    ['/admin/jobs/7/gastos', '/admin/jobs/1'],
    ['/admin/albaranes/7/fotos', '/admin/albaranes/31'],
    ['/admin/albaranes/pendientes-facturar', '/admin/albaranes/31'],
    ['/admin/products/frequent-concepts', '/admin/products'],
  ];
  for (const [pedida, ajena] of pares) assert.notEqual(de(pedida), de(ajena), `${pedida} sigue recibiendo el dato de ${ajena}`);
  // Con consulta y con URL entera (el detalle de factura pide por `fetch` con origen).
  assert.equal(de('/admin/quotes?status=sent').ejemplo, '/admin/quotes');
  assert.equal(de('https://yaqu.app/admin/invoices/21').ejemplo, '/admin/invoices/21');
});

test('las cinco vistas de detalle se montan con el id de su dato, no con NaN ni undefined', () => {
  const esperado = {
    renderJobDetailView: IDS.trabajo, renderQuoteDetailView: IDS.presupuesto, renderInvoiceDetailView: IDS.factura,
    renderAlbaranDetailView: IDS.albaran, renderParteDetailView: IDS.parte,
  };
  for (const [fn, id] of Object.entries(esperado)) {
    assert.deepEqual(ARGUMENTOS_DEL_CENSO[fn], [id], fn);
    assert.ok(Number.isInteger(id), `${fn}: ${id}`);
  }
  assert.equal(de(`/admin/jobs/${IDS.trabajo}`).dato().id, IDS.trabajo);
  assert.equal(de(`/admin/albaranes/${IDS.albaran}`).dato().id, IDS.albaran);
  assert.equal(de(`/admin/partes/${IDS.parte}`).dato().id, IDS.parte);
  assert.equal(de(`/admin/quotes/${IDS.presupuesto}`).dato().id, IDS.presupuesto);
  assert.equal(de(`/admin/invoices/${IDS.factura}`).dato().id, IDS.factura);
});

test('el censo usa ESTOS datos y estos argumentos, no un relleno propio (código sin comentarios)', () => {
  const fuente = soloCodigo(fs.readFileSync(path.join(RAIZ, 'scripts/censo-objetivo-tactil-panel.mjs'), 'utf8'), 'censo-objetivo-tactil-panel.mjs');
  assert.match(fuente, /=\s*datosDelCenso\(\)/, 'el censo ya no llama a datosDelCenso()');
  assert.match(fuente, /ARGUMENTOS_DEL_CENSO\[fn\]/, 'el censo ya no monta las vistas con ARGUMENTOS_DEL_CENSO');
  assert.doesNotMatch(fuente, /return\s*\[\s*\]\s*;/, 'ha vuelto un `return []` de relleno al censo');
  assert.match(fuente, /DC\.sinContrato\.size\)\s*\{\s*noSupe\(/, 'una ruta sin contrato ya no hace salir al censo con 2');
});

test('🔴 en el banco: ninguna vista pide una ruta sin contrato, ni con NaN/undefined, ni pinta «undefined»', async () => {
  const dc = datosDelCenso();
  const b0 = cargarDashboard(RAIZ);
  const vistas = Object.keys(b0.ctx).filter((k) => /^render[A-Z].*View$/.test(k) && typeof b0.ctx[k] === 'function').sort();
  // Suelo: con cero vistas o cero rutas, los «ninguna» de abajo no dirían nada.
  assert.ok(vistas.length >= 25, `sólo ${vistas.length} vistas en el banco`);
  const pintan = [];
  for (const fn of vistas) {
    dc.enVista(fn);
    const r = await pintarVista(cargarDashboard(RAIZ, { datos: dc.datos }), fn, ...(ARGUMENTOS_DEL_CENSO[fn] || []));
    assert.ok(!r.error, `${fn} no monta: ${r.error && r.error.message}`);
    const n = (serializar(r.contenedor).match(/\bundefined\b|\bNaN\b/g) || []).length;
    if (n) pintan.push(`${fn} ×${n}`);
  }
  assert.ok(dc.servidas.size >= 40, `sólo ${dc.servidas.size} rutas servidas: el banco ya no pide por aquí`);
  assert.deepEqual([...dc.sinContrato.keys()], [], 'rutas pedidas SIN contrato (reciben null)');
  const rotas = [...dc.servidas.keys()].filter((k) => /NaN|undefined|null/.test(k));
  assert.deepEqual(rotas, [], 'rutas pedidas con un id que no existe');
  assert.deepEqual(pintan, [], 'vistas que pintan «undefined» o «NaN» con los datos del censo');
});
