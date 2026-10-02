// tests/scrum1367-sembrar-casos.test.mjs — SCRUM-1367
//
// Los cuatro casos que le faltan a la cuenta QA, probados SIN RED: un `fetch` falso con estado (lo
// que se crea, existe en la llamada siguiente) que apunta cada llamada. NADA de esto se ha ejecutado
// contra producción: aquí se mide la CAPACIDAD y sus cerrojos, cada uno con su control.
//   · el de CUENTA: si el servidor no dice merchant 46 + owner, ninguna de las cuatro órdenes escribe;
//   · el de LISTA: lo único que se añade a `sembrar-qa.mjs` es ACEPTAR un presupuesto;
//   · ninguna orden emite documento, cobra ni envía;
//   · repetir una orden no crea nada, y lo que no se pudo ver se DICE (sale 1, no 0).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { temporal, borrarTemporal } from './_temporal.mjs'; // SCRUM-864 · se borra pase lo que pase
import {
  ejecutar, escrituraDeCasoPermitida, ESCRITURAS_DE_CASOS, MARCA_ACEPTADO, MARCA_PLAN, PLAN_QA,
  PERFIL_FISCAL_QA, TOPE_PARTES_POR_ORDEN,
} from '../scripts/qa/sembrar-casos.mjs';
import { MERCHANT_QA, NOMBRE_CLIENTE_QA, TITULO_TRABAJO_QA, escrituraPermitida } from '../scripts/qa/sembrar-qa.mjs';
import { Rechazo } from '../scripts/qa/sesion-panel.mjs';
// Los esquemas DE VERDAD (lección de SCRUM-1268c): un servidor de mentira que dice que sí a todo
// prueba el guion contra sí mismo.
import { CreateQuoteSchema, merchantProfileUpdateSchema } from '../dist/core/validation/schemas.js';
import { validateCustomBillingPlan } from '../dist/modules/quotes/domain/billingPlan.js';

// El rojo, declarado: lo ejecuta `npm run meta:mutaciones`.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Sin la lista de casos: cualquier escritura no prohibida saldría por la puerta de los casos.
    fichero: 'scripts/qa/sembrar-casos.mjs',
    de: '  if (!ESCRITURAS_DE_CASOS.some(([mm, re]) => mm === m && re.test(u.pathname))) {',
    a: '  if (false) {',
    cae: 'SCRUM-1367 · 🔴 LISTA: lo único que se añade es ACEPTAR; lo demás se rechaza antes de la red',
  },
  {
    // Aceptar otra vez lo ya aceptado: la orden dejaría de ser repetible sin escribir.
    fichero: 'scripts/qa/sembrar-casos.mjs',
    de: "  if (presupuesto.status !== 'accepted') {\n    if (presupuesto.status !== 'draft')",
    a: "  if (true) {\n    if (false)",
    cae: 'SCRUM-1367 · ① repetir «aceptado» no crea ni acepta nada',
  },
  {
    // Sin exigir el Trabajo: «aceptado» saldría como hecho con medio caso.
    fichero: 'scripts/qa/sembrar-casos.mjs',
    de: '  if (!trabajo) {\n    throw new NoPude(`el presupuesto #${presupuesto.id} está aceptado, pero su Trabajo',
    a: '  if (false) {\n    throw new NoPude(`el presupuesto #${presupuesto.id} está aceptado, pero su Trabajo',
    cae: 'SCRUM-1367 · ① 🔴 si el Trabajo no aparece, el caso NO está completo: sale 1 y lo dice',
  },
  {
    // Sin la relectura del plan: un alta que perdió el plan saldría como «plan propio».
    fichero: 'scripts/qa/sembrar-casos.mjs',
    de: '  if (presupuesto.hasCustomPlan !== true || tramos.length !== PLAN_QA.length) {',
    a: '  if (false) {',
    cae: 'SCRUM-1367 · ② 🔴 el plan se RELEE: si el servidor se lo comió, sale 1',
  },
  {
    // Pisar un dato fiscal que alguien puso.
    fichero: 'scripts/qa/sembrar-casos.mjs',
    de: '  if (ajenos.length) {',
    a: '  if (false) {',
    cae: 'SCRUM-1367 · ③ 🔴 un dato fiscal que NO es el de prueba no se pisa: sale 1 sin escribir',
  },
  {
    // «Sólo mide» que escribe.
    fichero: 'scripts/qa/sembrar-casos.mjs',
    de: '  if (!crearHasta) {',
    a: '  if (false) {',
    cae: 'SCRUM-1367 · ④ sin --crear-hasta SÓLO MIDE: cero escrituras, y dice que no hay',
  },
];

const COOKIE = 'pf_session=tok1367abcdef';
const ID_CLIENTE = 10;
const ID_TRABAJO_QA = 76;

function resp(status, cuerpo) {
  return { status, headers: new Headers(), text: async () => (cuerpo === undefined ? '' : JSON.stringify(cuerpo)) };
}

/**
 * Un panel falso con estado, que ARRANCA con el sembrado base ya hecho (cliente QA, su Trabajo y un
 * albarán): los casos se montan encima. Las formas son las de `src/` leídas el 2-oct-2026:
 * la lista de presupuestos no trae cabecera ni plan y el detalle sí; `/admin/albaranes` → `{filas}`;
 * `/admin/partes` → `{partes}`; aceptar crea el Trabajo con `totalAceptado` = total del presupuesto.
 */
function panel({
  me = { merchantId: MERCHANT_QA, isOwner: true, merchantName: 'PruebaQA' },
  sinBase = false, sinTrabajoAlAceptar = false, pierdePlan = false,
  merchant = {}, albaranes = [205], partes = [], proximoParte = 200,
} = {}) {
  const s = {
    clientes: sinBase ? [] : [{ id: ID_CLIENTE, name: NOMBRE_CLIENTE_QA }],
    trabajos: sinBase ? [] : [{ id: ID_TRABAJO_QA, tituloPropio: TITULO_TRABAJO_QA, customer: { id: ID_CLIENTE }, quote: null, totalAceptado: null }],
    albaranes: albaranes.map((id) => ({ id, numero: `AB-${id}`, estado: 'emitido' })),
    partes: partes.map((id) => ({ id, jobId: ID_TRABAJO_QA, estado: 'borrador' })),
    presupuestos: [],
    merchant: { name: 'PruebaQA', legalName: null, taxId: null, address: null, whatsappPhone: null, ...merchant },
  };
  let id = 300;
  let idParte = proximoParte;
  const llamadas = [];
  const fetchFn = async (url, init = {}) => {
    const u = new URL(url);
    const m = init.method || 'GET';
    const clave = `${m} ${u.pathname}`;
    const cuerpo = init.body ? JSON.parse(init.body) : null;
    llamadas.push({ m, ruta: u.pathname + u.search, cuerpo, cookie: init.headers && init.headers.cookie });
    if (clave === 'GET /admin/me') return resp(200, me);
    if (clave === 'GET /admin/customers') return resp(200, s.clientes.filter((c) => c.name.includes(u.searchParams.get('search') || '')));
    if (clave === 'GET /admin/jobs') return resp(200, s.trabajos);
    if (clave === 'GET /admin/albaranes') return resp(200, { filas: s.albaranes });
    if (clave === 'GET /admin/partes') return resp(200, { partes: s.partes });
    if (clave === 'POST /admin/partes') {
      const p = { id: idParte++, jobId: cuerpo.jobId, estado: 'borrador' };
      s.partes.push(p);
      return resp(201, p);
    }
    if (clave === 'GET /admin/quotes') {
      return resp(200, s.presupuestos.map((p) => ({ id: p.id, number: p.number, customerName: NOMBRE_CLIENTE_QA, status: p.status })));
    }
    let r = u.pathname.match(/^\/admin\/quotes\/(\d+)$/);
    if (r && m === 'GET') {
      const p = s.presupuestos.find((x) => x.id === Number(r[1]));
      if (!p) return resp(404, { error: 'not_found' });
      const propio = Array.isArray(p.plan) && p.plan.length > 0;
      return resp(200, {
        id: p.id, number: p.number, status: p.status, docHeaderText: p.docHeaderText, docFooterText: null,
        customer: { id: p.customerId }, hasCustomPlan: propio,
        billingPlan: propio ? p.plan.map((t) => ({ label: t.label, percentage: t.percentage })) : [{ label: 'TOTAL', percentage: 100 }],
      });
    }
    if (clave === 'POST /quote/create') {
      const v = CreateQuoteSchema.safeParse(cuerpo);
      if (!v.success) return resp(400, { error: 'validation_error', issues: v.error.issues });
      if (cuerpo.customBillingPlan != null && !validateCustomBillingPlan(cuerpo.customBillingPlan).ok) return resp(400, { error: 'invalid_billing_plan' });
      const p = {
        id: ++id, number: 260000 + id, status: 'draft', customerId: cuerpo.customer_id, total: 121,
        docHeaderText: cuerpo.docHeaderText ?? null, plan: pierdePlan ? null : (cuerpo.customBillingPlan ?? null), cuerpo,
      };
      s.presupuestos.push(p);
      return resp(201, { id: p.id, number: p.number, status: p.status });
    }
    r = u.pathname.match(/^\/admin\/quotes\/(\d+)\/accept$/);
    if (r && m === 'POST') {
      const p = s.presupuestos.find((x) => x.id === Number(r[1]));
      if (!p) return resp(404, { error: 'not_found' });
      p.status = 'accepted';
      if (!sinTrabajoAlAceptar && !s.trabajos.some((j) => j.quote && j.quote.id === p.id)) {
        s.trabajos.push({ id: ++id, tituloPropio: null, customer: { id: p.customerId }, quote: { id: p.id }, totalAceptado: p.total });
      }
      return resp(200, { id: p.id, status: p.status, acceptedAt: '2026-10-02T00:00:00.000Z' });
    }
    if (clave === 'GET /admin/merchant') return resp(200, { ...s.merchant });
    if (clave === 'PUT /admin/merchant') {
      const v = merchantProfileUpdateSchema.safeParse(cuerpo);
      if (!v.success) return resp(400, { error: 'validation_error', issues: v.error.issues });
      s.merchant = { ...s.merchant, ...v.data };
      return resp(200, { ...s.merchant });
    }
    return resp(404, { error: 'ruta no simulada' });
  };
  return { fetchFn, llamadas, s };
}

async function correr(argv, p, { sesion = COOKIE } = {}) {
  const dir = temporal('scrum1367-');
  try {
    const rutaSesion = path.join(dir, 'sesion.txt');
    if (sesion !== null) fs.writeFileSync(rutaSesion, sesion);
    const out = [];
    const err = [];
    const codigo = await ejecutar(argv, { fetchFn: p.fetchFn, rutaSesion, esperar: async () => {}, out: (x) => out.push(x), err: (x) => err.push(x) });
    return { codigo, out: out.join('\n'), err: err.join('\n') };
  } finally { borrarTemporal(dir); }
}

const escrituras = (p) => p.llamadas.filter((l) => l.m !== 'GET');
const rutasEscritas = (p) => escrituras(p).map((l) => `${l.m} ${l.ruta}`);
/** Nada de lo que la casa prohíbe: ni documento, ni cobro, ni envío. Con su control en el último test. */
const TOCA_DINERO_O_ENVIO = /enviar|factur|invoice|convertir|cobro|pago|payment|stripe|emitir/i;
const sinDineroNiEnvio = (p) => rutasEscritas(p).filter((x) => TOCA_DINERO_O_ENVIO.test(x));

test('SCRUM-1367 · ① «aceptado» desde el sembrado base: crea el presupuesto, lo ACEPTA y ve su Trabajo con importe', async () => {
  const p = panel();
  const r = await correr(['aceptado'], p);
  assert.equal(r.codigo, 0, r.err);
  assert.deepEqual(rutasEscritas(p), ['POST /quote/create', `POST /admin/quotes/${p.s.presupuestos[0].id}/accept`]);
  assert.equal(p.s.presupuestos.length, 1);
  assert.equal(p.s.presupuestos[0].status, 'accepted');
  assert.ok(p.s.presupuestos[0].docHeaderText.includes(MARCA_ACEPTADO), 'lleva la marca: es lo que lo hace repetible');
  assert.equal(p.s.presupuestos[0].cuerpo.merchant_id, MERCHANT_QA);
  assert.equal(p.s.presupuestos[0].customerId, ID_CLIENTE);
  assert.match(escrituras(p)[1].cuerpo.comment, /PRUEBA/, 'la aceptación dice en su comentario que es de prueba');
  assert.match(r.out, /ACEPTADO ahora/);
  assert.match(r.out, /trabajo\s+#\d+ · con su presupuesto aceptado · importe aceptado 121/);
  assert.match(r.out, /no se ha emitido ningún documento, ni cobrado, ni enviado nada/);
  assert.deepEqual(sinDineroNiEnvio(p), []);
  assert.ok(escrituras(p).every((l) => l.cookie === COOKIE), 'cada escritura lleva la sesión');
});

test('SCRUM-1367 · ① repetir «aceptado» no crea ni acepta nada', async () => {
  const p = panel();
  assert.equal((await correr(['aceptado'], p)).codigo, 0);
  const antes = escrituras(p).length;
  assert.equal(antes, 2, 'control: la primera pasada SÍ escribió');
  const r = await correr(['aceptado'], p);
  assert.equal(r.codigo, 0, r.err);
  assert.equal(escrituras(p).length, antes, 'la segunda pasada no escribe nada');
  assert.equal(p.s.presupuestos.length, 1);
  assert.match(r.out, /ya estaba · ya estaba aceptado \(no se repite\)/);
});

test('SCRUM-1367 · ① 🔴 si el Trabajo no aparece, el caso NO está completo: sale 1 y lo dice', async () => {
  const p = panel({ sinTrabajoAlAceptar: true });
  const r = await correr(['aceptado'], p);
  assert.equal(r.codigo, 1);
  assert.match(r.err, /NO PUDE: .*está aceptado, pero su Trabajo no aparece entre los 1 de la lista/);
  assert.match(r.err, /El caso NO está completo/);
});

test('SCRUM-1367 · ① sin el sembrado base (ningún cliente QA) no escribe nada y dice qué correr antes', async () => {
  const p = panel({ sinBase: true });
  const r = await correr(['aceptado'], p);
  assert.equal(r.codigo, 1);
  assert.deepEqual(escrituras(p), []);
  assert.match(r.err, /hay 0 clientes .* corre antes `node scripts\/qa\/sembrar-qa\.mjs sembrar`/);
});

test('SCRUM-1367 · ② «plan»: presupuesto en borrador con plan de cobro PROPIO, que pasa el validador de verdad', async () => {
  assert.deepEqual(validateCustomBillingPlan(PLAN_QA), { ok: true }, 'el plan de prueba es un plan válido para el servidor');
  const p = panel();
  const r = await correr(['plan'], p);
  assert.equal(r.codigo, 0, r.err);
  assert.deepEqual(rutasEscritas(p), ['POST /quote/create'], 'el plan viaja en el alta: una sola escritura');
  assert.deepEqual(p.s.presupuestos[0].plan, PLAN_QA);
  assert.equal(p.s.presupuestos[0].status, 'draft', 'se queda en borrador: nadie lo acepta');
  assert.ok(p.s.presupuestos[0].docHeaderText.includes(MARCA_PLAN));
  assert.match(r.out, /· draft · plan propio de 2 tramos · CREADO/);
  const r2 = await correr(['plan'], p);
  assert.equal(r2.codigo, 0, r2.err);
  assert.equal(escrituras(p).length, 1, 'repetir no crea otro');
  assert.match(r2.out, /ya estaba/);
});

test('SCRUM-1367 · ② 🔴 el plan se RELEE: si el servidor se lo comió, sale 1', async () => {
  const p = panel({ pierdePlan: true });
  const r = await correr(['plan'], p);
  assert.equal(r.codigo, 1);
  assert.match(r.err, /NO tiene plan propio de 2 tramos \(hasCustomPlan=false, tramos=1\)/);
});

test('SCRUM-1367 · ① y ② no se confunden: cada orden busca SU marca', async () => {
  const p = panel();
  assert.equal((await correr(['plan'], p)).codigo, 0);
  assert.equal((await correr(['aceptado'], p)).codigo, 0);
  assert.equal(p.s.presupuestos.length, 2);
  const [conPlan, aceptado] = p.s.presupuestos;
  assert.equal(conPlan.status, 'draft', 'el del plan sigue en borrador: «aceptado» no lo tocó');
  assert.equal(aceptado.status, 'accepted');
  assert.equal(aceptado.plan, null);
});

test('SCRUM-1367 · ③ «perfil-fiscal» rellena los cuatro campos vacíos con datos que DICEN que son de prueba', async () => {
  assert.match(PERFIL_FISCAL_QA.legalName, /PRUEBAS QA/);
  assert.match(PERFIL_FISCAL_QA.legalName, /NO ES UNA EMPRESA REAL/);
  assert.match(PERFIL_FISCAL_QA.taxId, /^[A-Z]0{8}$/, 'NIF todo ceros: provincia 00, que no existe');
  assert.match(PERFIL_FISCAL_QA.address, /prueba/i);
  assert.match(PERFIL_FISCAL_QA.whatsappPhone, /^340\d{8}$/, 'móvil del rango imposible de SCRUM-262');
  assert.deepEqual(Object.keys(PERFIL_FISCAL_QA).sort(), ['address', 'legalName', 'taxId', 'whatsappPhone']);
  const p = panel();
  const r = await correr(['perfil-fiscal'], p);
  assert.equal(r.codigo, 0, r.err);
  assert.deepEqual(rutasEscritas(p), ['PUT /admin/merchant']);
  assert.deepEqual(escrituras(p)[0].cuerpo, PERFIL_FISCAL_QA, 'se envían esos cuatro y nada más');
  for (const [k, v] of Object.entries(PERFIL_FISCAL_QA)) assert.equal(p.s.merchant[k], v, `${k} pasó el esquema de verdad y quedó guardado`);
  assert.match(r.out, /resumen: 4 enviados · 0 no se releen igual · 0 cambiaron sin enviarse/);
  assert.match(r.out, /son datos DE PRUEBA/);
  assert.match(r.out, /dejará de verificar/, 'avisa de la firma de los albaranes anteriores');
  const r2 = await correr(['perfil-fiscal'], p);
  assert.equal(r2.codigo, 0, r2.err);
  assert.equal(escrituras(p).length, 1, 'repetir no vuelve a escribir');
  assert.match(r2.out, /ya estaba puesto, campo a campo: no se escribe nada/);
});

test('SCRUM-1367 · ③ 🔴 un dato fiscal que NO es el de prueba no se pisa: sale 1 sin escribir', async () => {
  const p = panel({ merchant: { taxId: 'B12345674' } });
  const r = await correr(['perfil-fiscal'], p);
  assert.equal(r.codigo, 1);
  assert.deepEqual(escrituras(p), []);
  assert.equal(p.s.merchant.taxId, 'B12345674');
  assert.match(r.err, /el perfil ya trae taxId con un valor que no es el de prueba/);
});

test('SCRUM-1367 · ④ sin --crear-hasta SÓLO MIDE: cero escrituras, y dice que no hay', async () => {
  const p = panel({ albaranes: [205], partes: [77] });
  const r = await correr(['mismo-id'], p);
  assert.equal(r.codigo, 0, r.err);
  assert.deepEqual(escrituras(p), []);
  assert.match(r.out, /población: 1 albaranes, 1 partes/);
  assert.match(r.out, /NO HAY ninguno\. Albaranes: #205 · partes: #77\./);
  // Control positivo: cuando SÍ hay, lo ve (y tampoco escribe).
  const q = panel({ albaranes: [205], partes: [77, 205] });
  const rq = await correr(['mismo-id'], q);
  assert.equal(rq.codigo, 0, rq.err);
  assert.match(rq.out, /HAY: el albarán #205 y el parte #205 comparten id/);
  assert.deepEqual(escrituras(q), []);
});

test('SCRUM-1367 · ④ con --crear-hasta crea partes en borrador hasta coincidir, y para ahí', async () => {
  const p = panel({ albaranes: [205], proximoParte: 203 });
  const r = await correr(['mismo-id', '--crear-hasta', '10'], p);
  assert.equal(r.codigo, 0, r.err);
  assert.deepEqual(rutasEscritas(p), ['POST /admin/partes', 'POST /admin/partes', 'POST /admin/partes']);
  assert.ok(escrituras(p).every((l) => l.cuerpo.jobId === ID_TRABAJO_QA), 'cuelgan del Trabajo QA');
  assert.match(r.out, /HECHO: el parte #205 comparte id con el albarán #205 · partes creados: 3 \(#203, #204, #205\)/);
});

test('SCRUM-1367 · ④ 🔴 si el contador de partes ya pasó del mayor albarán, para al primero y lo dice (no quema el tope)', async () => {
  const p = panel({ albaranes: [205], proximoParte: 400 });
  const r = await correr(['mismo-id', '--crear-hasta', '10'], p);
  assert.equal(r.codigo, 1);
  assert.equal(escrituras(p).length, 1, 'un solo parte creado, no diez');
  assert.match(r.err, /el contador de partes \(#400\) ya pasó del mayor albarán de la cuenta \(#205\)/);
  assert.match(r.err, /Creados y que se quedan: #400/);
});

test('SCRUM-1367 · ④ --crear-hasta se agota sin coincidir: sale 1 y dice cuántos dejó', async () => {
  const p = panel({ albaranes: [205], proximoParte: 100 });
  const r = await correr(['mismo-id', '--crear-hasta', '2'], p);
  assert.equal(r.codigo, 1);
  assert.equal(escrituras(p).length, 2);
  assert.match(r.err, /creados 2 partes \(#100, #101\) y ninguno coincide todavía; el mayor albarán es #205/);
});

test('SCRUM-1367 · 🔴 CERROJO DE CUENTA: si el servidor no dice merchant 46 y owner, NINGUNA de las cuatro órdenes escribe', async () => {
  const ordenes = [['aceptado'], ['plan'], ['perfil-fiscal'], ['mismo-id', '--crear-hasta', '5']];
  for (const me of [{ merchantId: 1, isOwner: true, merchantName: 'Demo' }, { merchantId: MERCHANT_QA, isOwner: false, merchantName: 'PruebaQA' }]) {
    for (const orden of ordenes) {
      const p = panel({ me });
      const r = await correr(orden, p);
      assert.equal(r.codigo, 3, `${orden[0]} con ${JSON.stringify(me)}`);
      assert.match(r.err, /NO ES LA CUENTA QA/);
      assert.deepEqual(escrituras(p), [], `${orden[0]}: ni una escritura`);
    }
  }
  // Control: con la cuenta QA, esas mismas cuatro órdenes SÍ escriben (el cerrojo no es un muro).
  for (const orden of ordenes) {
    const p = panel({ proximoParte: 205 });
    const r = await correr(orden, p);
    assert.equal(r.codigo, 0, `${orden[0]}: ${r.err}`);
    assert.ok(escrituras(p).length >= 1, `${orden[0]} escribe con la cuenta QA`);
  }
});

test('SCRUM-1367 · 🔴 LISTA: lo único que se añade es ACEPTAR; lo demás se rechaza antes de la red', () => {
  assert.equal(ESCRITURAS_DE_CASOS.length, 1, 'si esta lista crece, crece lo que se puede escribir en producción');
  assert.equal(escrituraDeCasoPermitida('POST', '/admin/quotes/12/accept').pathname, '/admin/quotes/12/accept');
  const fuera = [
    ['POST', '/admin/quotes/12/invoice'], ['POST', '/admin/quotes/12/reject'], ['DELETE', '/admin/quotes/12'],
    ['PATCH', '/admin/quotes/12/billing-plan'], ['POST', '/admin/quotes/12/enviar-whatsapp'], ['GET', '/admin/quotes/12/accept'],
    ['POST', '/admin/quotes/12/accept?x=1'], ['POST', '/admin/quotes/abc/accept'], ['POST', '/admin/invoices'],
    ['POST', '/admin/jobs/3/cobro'], ['POST', '/admin/quotes/12/accept/pago'],
  ];
  for (const [m, ruta] of fuera) assert.throws(() => escrituraDeCasoPermitida(m, ruta), Rechazo, `${m} ${ruta}`);
  // Y la puerta de `sembrar-qa.mjs` NO se ha ensanchado: aceptar sigue sin estar en su lista blanca.
  assert.throws(() => escrituraPermitida('POST', '/admin/quotes/12/accept'), Rechazo);
});

test('SCRUM-1367 · uso: orden desconocida y argumentos de más salen 3; sin sesión, CIEGO (2); nada toca la red', async () => {
  const malos = [[], ['sembrar'], ['aceptado', '--crear-hasta', '3'], ['mismo-id', '--crear-hasta'], ['mismo-id', '--crear-hasta', '0'],
    ['mismo-id', '--crear-hasta', String(TOPE_PARTES_POR_ORDEN + 1)], ['mismo-id', '--crear-hasta', '3x'], ['plan', 'extra']];
  for (const argv of malos) {
    const p = panel();
    const r = await correr(argv, p);
    assert.equal(r.codigo, 3, JSON.stringify(argv));
    assert.deepEqual(p.llamadas, [], `${JSON.stringify(argv)}: ni una llamada`);
  }
  const p = panel();
  const r = await correr(['aceptado'], p, { sesion: null });
  assert.equal(r.codigo, 2);
  assert.match(r.err, /^CIEGO — no hay sesión guardada/);
  assert.deepEqual(p.llamadas, []);
});

test('SCRUM-1367 · control del instrumento: el filtro de «dinero o envío» SÍ ve una ruta de emitir', () => {
  assert.ok(TOCA_DINERO_O_ENVIO.test('POST /admin/albaranes/3/emitir'));
  assert.ok(TOCA_DINERO_O_ENVIO.test('POST /admin/quotes/3/invoice'));
  assert.ok(!TOCA_DINERO_O_ENVIO.test('POST /admin/quotes/3/accept'));
});
