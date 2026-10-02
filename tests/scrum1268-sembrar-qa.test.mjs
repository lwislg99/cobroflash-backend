// tests/scrum1268-sembrar-qa.test.mjs — SCRUM-1268
//
// La única escritura en producción para QA, probada SIN RED: un `fetch` falso que se comporta como
// el panel (con estado: lo que se crea, existe en la siguiente llamada) y apunta cada llamada.
// Lo que se mide son los dos cerrojos y la idempotencia, cada uno con su control:
//   · el de CUENTA: si el servidor no dice merchant 46 + owner, no sale NINGUNA escritura;
//   · el de LISTA BLANCA: una ruta fuera de ella se rechaza antes de la red;
//   · emitir es irreversible: repetir la orden NO vuelve a emitir.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { temporal, borrarTemporal } from './_temporal.mjs'; // SCRUM-864 · se borra pase lo que pase
import {
  ejecutar, escrituraPermitida, escritura, comprobarCuentaQA, MERCHANT_QA, NOMBRE_CLIENTE_QA,
  TITULO_TRABAJO_QA, MOVIL_CLIENTE_QA, MARCA_PRESUPUESTO_QA, CABECERA_QA, PIE_QA,
} from '../scripts/qa/sembrar-qa.mjs';
import { Rechazo } from '../scripts/qa/sesion-panel.mjs';
// 🔴 SCRUM-1268c · LOS ESQUEMAS DE VERDAD, no una imitación. El panel falso de abajo aceptaba
// CUALQUIER cuerpo en `POST /quote/create`, y el guion salió con `tax: 21` cuando el esquema exige
// la FRACCIÓN desde SCRUM-217: este test daba verde y en producción cada `sembrar` moría con
// `400 validation_error`, con la cuenta QA a CERO presupuestos. Un servidor de mentira que dice que
// sí a todo prueba el guion contra sí mismo. Ahora el cuerpo pasa por el mismo esquema que en la ruta.
import { CreateQuoteSchema, customerCreateSchema } from '../dist/core/validation/schemas.js';

// El rojo, declarado: lo ejecuta `npm run meta:mutaciones`.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Sin el cerrojo de cuenta: escribiría en el merchant que tenga la sesión.
    fichero: 'scripts/qa/sembrar-qa.mjs',
    de: 'if (me.merchantId !== MERCHANT_QA || me.isOwner !== true) {',
    a: 'if (false) {',
    cae: 'SCRUM-1268 · 🔴 CERROJO: si el servidor no dice merchant 46 y owner, no sale NINGUNA escritura',
  },
  {
    // Sin la lista blanca: cualquier escritura no prohibida saldría.
    fichero: 'scripts/qa/sembrar-qa.mjs',
    de: 'if (!ESCRITURAS.some(([mm, re]) => mm === m && re.test(u.pathname))) {',
    a: 'if (false) {',
    cae: 'SCRUM-1268 · 🔴 LISTA BLANCA: lo que no está, se rechaza ANTES de la red (y lo que está, pasa)',
  },
  {
    // Emitir otra vez un albarán ya emitido: cada repetición quemaría un número de la serie.
    fichero: 'scripts/qa/sembrar-qa.mjs',
    de: "  if (albaran.estado !== 'emitido') {\n    albaran = await escribir(",
    a: "  if (true) {\n    albaran = await escribir(",
    cae: 'SCRUM-1268 · 🔴 IDEMPOTENTE: repetir no crea nada ni vuelve a EMITIR (no quema números ALB)',
  },
  {
    // Sin buscar la marca: cada ejecución dejaría un presupuesto más (el servidor no deduplica).
    fichero: 'scripts/qa/sembrar-qa.mjs',
    de: '    if (d.customer && d.customer.id === cliente.id && textos.includes(MARCA_PRESUPUESTO_QA)) conMarca.push(d);',
    a: '    if (false) conMarca.push(d);',
    cae: 'SCRUM-1268 · 🔴 IDEMPOTENTE: repetir no crea nada ni vuelve a EMITIR (no quema números ALB)',
  },
  {
    // Sin la relectura: un 201 con la cabecera perdida saldría como «hecho».
    fichero: 'scripts/qa/sembrar-qa.mjs',
    de: '    if (presupuesto.docHeaderText !== CABECERA_QA || presupuesto.docFooterText !== PIE_QA) {',
    a: '    if (false) {',
    cae: 'SCRUM-1268b · 🔴 presupuesto: se RELEE; si el servidor se comió la cabecera, lo dice y sale 1',
  },
  {
    // SCRUM-1268c · el IVA en porcentaje: el esquema de verdad lo rechaza (400), y el sembrado muere.
    fichero: 'scripts/qa/sembrar-qa.mjs',
    de: "price: 10, tax: 0.21 }",
    a: "price: 10, tax: 21 }",
    cae: 'SCRUM-1268 · sembrar desde cero: cliente, trabajo, albarán EMITIDO y parte en borrador, con sus ids',
  },
];

const COOKIE = 'pf_session=tok1268abcdef';

function resp(status, cuerpo) {
  return { status, headers: new Headers(), text: async () => (cuerpo === undefined ? '' : JSON.stringify(cuerpo)) };
}

/** Un panel falso, con estado. `falla` permite forzar una respuesta por «MÉTODO ruta». */
function panel({ me = { merchantId: MERCHANT_QA, isOwner: true, merchantName: 'PruebaQA' }, falla = {}, trabajosDeRelleno = 0, clientesExtra = [], idempotencia = null, presupuestosDeRelleno = 0, pierdeCabecera = false } = {}) {
  const s = {
    clientes: [...clientesExtra], trabajos: [], albaranes: [], partes: [], emisiones: 0, presupuestos: [], presupuestosRelleno: [],
    merchant: { name: 'PruebaQA', legalName: 'Pruebas QA SL', taxId: 'B00000000', address: 'Calle Prueba 1', retencionIrpfDeclarada: false, retencionIrpfTipo: null },
  };
  for (let i = 0; i < trabajosDeRelleno; i++) s.trabajos.push({ id: 9000 + i, tituloPropio: 'otro', customer: { id: 1 } });
  for (let i = 0; i < presupuestosDeRelleno; i++) s.presupuestosRelleno.push({ id: 7000 + i, number: i, status: 'draft', customerId: -1, relleno: true, docHeaderText: null, docFooterText: null });
  let id = 100;
  const llamadas = [];
  const fetchFn = async (url, init = {}) => {
    const u = new URL(url);
    const m = init.method || 'GET';
    const clave = `${m} ${u.pathname}`;
    const cuerpo = init.body ? JSON.parse(init.body) : null;
    llamadas.push({ m, ruta: u.pathname + u.search, cuerpo, cookie: init.headers && init.headers.cookie });
    if (falla[clave]) return resp(falla[clave], { error: 'forzado' });
    if (clave === 'GET /admin/me') return resp(200, me);
    if (clave === 'GET /admin/customers') return resp(200, s.clientes.filter((c) => c.name.includes(u.searchParams.get('search') || '')));
    const invalido = (esquema) => {
      const v = esquema.safeParse(cuerpo);
      return v.success ? null : resp(400, { error: 'validation_error', issues: v.error.issues });
    };
    if (clave === 'POST /admin/customers') { const no = invalido(customerCreateSchema); if (no) return no; }
    if (clave === 'POST /quote/create') { const no = invalido(CreateQuoteSchema); if (no) return no; }
    if (clave === 'POST /admin/customers') { const c ={ id: ++id, ...cuerpo }; s.clientes.push(c); return resp(201, c); }
    if (clave === 'GET /admin/jobs') return resp(200, s.trabajos);
    if (clave === 'POST /admin/jobs') { const j = { id: ++id, tituloPropio: cuerpo.titulo, customer: { id: cuerpo.customerId } }; s.trabajos.push(j); return resp(201, j); }
    let r = u.pathname.match(/^\/admin\/jobs\/(\d+)\/albaranes$/);
    if (r && m === 'POST') {
      const previo = s.albaranes.find((a) => a.clave === cuerpo.claveIdempotencia);
      if (previo) return resp(200, { ...previo, idempotencia: idempotencia || 'repetida' });
      const a = { id: ++id, numero: `ALB-${id}`, jobId: Number(r[1]), estado: 'borrador', clave: cuerpo.claveIdempotencia };
      s.albaranes.push(a);
      return resp(201, { ...a, idempotencia: idempotencia || 'aplicada' });
    }
    r = u.pathname.match(/^\/admin\/albaranes\/(\d+)\/emitir$/);
    if (r && m === 'POST') { const a = s.albaranes.find((x) => x.id === Number(r[1])); s.emisiones++; a.estado = 'emitido'; return resp(200, a); }
    if (clave === 'GET /admin/partes') return resp(200, { partes: s.partes });
    if (clave === 'POST /admin/partes') { const p = { id: ++id, numero: `PT-${id}`, jobId: cuerpo.jobId, estado: 'borrador' }; s.partes.push(p); return resp(201, p); }
    // Presupuestos (SCRUM-1268b): la lista NO trae cabecera ni pie, como la de verdad; el detalle sí.
    if (clave === 'GET /admin/quotes') {
      const q = u.searchParams.get('search') || '';
      const cli = (id) => s.clientes.find((c) => c.id === id) || { name: '—' };
      return resp(200, [...s.presupuestos, ...s.presupuestosRelleno].filter((p) => cli(p.customerId).name.includes(q) || p.relleno)
        .map((p) => ({ id: p.id, number: p.number, customerName: p.relleno ? NOMBRE_CLIENTE_QA : cli(p.customerId).name, status: p.status })));
    }
    r = u.pathname.match(/^\/admin\/quotes\/(\d+)$/);
    if (r && m === 'GET') {
      const p = [...s.presupuestos, ...s.presupuestosRelleno].find((x) => x.id === Number(r[1]));
      if (!p) return resp(404, { error: 'not_found' });
      return resp(200, { id: p.id, number: p.number, status: p.status, docHeaderText: p.docHeaderText, docFooterText: p.docFooterText, customer: { id: p.customerId } });
    }
    if (clave === 'POST /quote/create') {
      const p = { id: ++id, number: 260000 + id, status: 'draft', customerId: cuerpo.customer_id, docHeaderText: cuerpo.docHeaderText ?? null, docFooterText: cuerpo.docFooterText ?? null, cuerpo };
      if (pierdeCabecera) p.docHeaderText = null; // un eslabón que se come el campo: el 201 sale igual
      s.presupuestos.push(p);
      return resp(201, { id: p.id, number: p.number, status: p.status, total: '12.10', currency: 'EUR' });
    }
    if (clave === 'GET /admin/merchant') return resp(200, { ...s.merchant });
    if (clave === 'PUT /admin/merchant') {
      // Como el servidor de verdad: el esquema DESCARTA en silencio lo que no conoce (el defecto del
      // IRPF), y aquí además se simula el de SCRUM-1227 (guardar borra un campo que no se envió).
      const { retencionIrpfDeclarada, retencionIrpfTipo, ...conocidos } = cuerpo;
      s.merchant = { ...s.merchant, ...conocidos, address: null };
      s.respuestaPut = { ...s.merchant, secretoCrudo: 'NO-DEBE-SALIR-1268' };
      return resp(200, s.respuestaPut);
    }
    return resp(404, { error: 'ruta no simulada' });
  };
  return { fetchFn, llamadas, s };
}

async function correr(argv, p, { sesion = COOKIE } = {}) {
  const dir = temporal('scrum1268-');
  try {
    const rutaSesion = path.join(dir, 'sesion.txt');
    if (sesion !== null) fs.writeFileSync(rutaSesion, sesion);
    const out = [];
    const err = [];
    const fichero = (nombre, contenido) => { const f = path.join(dir, nombre); fs.writeFileSync(f, contenido); return f; };
    const args = typeof argv === 'function' ? argv(fichero) : argv;
    const codigo = await ejecutar(args, { fetchFn: p.fetchFn, rutaSesion, out: (x) => out.push(x), err: (x) => err.push(x) });
    return { codigo, out: out.join('\n'), err: err.join('\n') };
  } finally { borrarTemporal(dir); }
}

const escrituras = (p) => p.llamadas.filter((l) => l.m !== 'GET');

test('SCRUM-1268 · sembrar desde cero: cliente, trabajo, albarán EMITIDO y parte en borrador, con sus ids', async () => {
  const p = panel();
  const r = await correr(['sembrar'], p);
  assert.equal(r.codigo, 0, r.err);
  assert.equal(p.s.clientes.length, 1);
  assert.equal(p.s.clientes[0].name, NOMBRE_CLIENTE_QA);
  assert.equal(p.s.clientes[0].mobile, MOVIL_CLIENTE_QA);
  assert.equal(p.s.trabajos[0].tituloPropio, TITULO_TRABAJO_QA);
  assert.equal(p.s.albaranes[0].estado, 'emitido');
  assert.equal(p.s.partes[0].estado, 'borrador');
  assert.equal(p.s.emisiones, 1);
  assert.equal(p.s.presupuestos.length, 1);
  assert.equal(p.s.presupuestos[0].docHeaderText, CABECERA_QA);
  assert.equal(p.s.presupuestos[0].docFooterText, PIE_QA);
  assert.equal(p.s.presupuestos[0].cuerpo.merchant_id, MERCHANT_QA, 'el merchant del cuerpo es el que dijo el servidor');
  assert.equal(p.s.presupuestos[0].customerId, p.s.clientes[0].id, 'y es del cliente QA');
  for (const x of ['cliente', 'trabajo', 'albarán', 'parte', 'presupuesto']) assert.match(r.out, new RegExp(`${x}\\s+#\\d+`), `el informe da el id de ${x}`);
  assert.match(r.out, /EMITIDO ahora/);
  assert.ok(escrituras(p).every((l) => l.cookie === COOKIE), 'cada escritura lleva la sesión');
});

test('SCRUM-1268 · 🔴 IDEMPOTENTE: repetir no crea nada ni vuelve a EMITIR (no quema números ALB)', async () => {
  const p = panel();
  assert.equal((await correr(['sembrar'], p)).codigo, 0);
  const r = await correr(['sembrar'], p);
  assert.equal(r.codigo, 0, r.err);
  assert.equal(p.s.clientes.length, 1);
  assert.equal(p.s.trabajos.length, 1);
  assert.equal(p.s.albaranes.length, 1);
  assert.equal(p.s.partes.length, 1);
  assert.equal(p.s.presupuestos.length, 1, 'el servidor NO deduplica presupuestos: lo hace la marca');
  assert.equal(p.s.emisiones, 1, 'un albarán ya emitido NO se vuelve a emitir');
  for (const x of ['cliente', 'trabajo', 'parte', 'presupuesto']) assert.match(r.out, new RegExp(`${x}\\s+#\\d+.*ya estaba`), `${x}: ya estaba`);
  assert.match(r.out, /albarán\s+#\d+.*· ya estaba · ya estaba emitido \(no se repite\)/);
});

test('SCRUM-1268 · 🔴 CERROJO: si el servidor no dice merchant 46 y owner, no sale NINGUNA escritura', async () => {
  // El id 1 es el demo: el login por defecto de sesion-panel es demo@yaqu.app, la cuenta equivocada más probable.
  const DEMO = { merchantId: 1, isOwner: true }; // MERCHANT DEMO A PROPOSITO (SCRUM-409): el cerrojo tiene que rechazar la cuenta demo
  for (const me of [DEMO, { merchantId: MERCHANT_QA, isOwner: false }, { merchantId: String(MERCHANT_QA), isOwner: true }, {}]) {
    const p = panel({ me });
    const r = await correr(['sembrar'], p);
    assert.equal(r.codigo, 3, `me=${JSON.stringify(me)}: ${r.err}`);
    assert.match(r.err, /NO ES LA CUENTA QA/);
    assert.equal(escrituras(p).length, 0, `me=${JSON.stringify(me)}: salió una escritura`);
    const q = panel({ me });
    assert.equal((await correr((f) => ['perfil', f('v.json', '{"taxId":"B11111111"}')], q)).codigo, 3);
    assert.equal(escrituras(q).length, 0);
  }
  // Control positivo: con la cuenta QA sí escribe (si no, «cero escrituras» no probaría nada).
  const ok = panel();
  assert.equal((await correr(['sembrar'], ok)).codigo, 0);
  assert.ok(escrituras(ok).length > 0);
});

test('SCRUM-1268 · 🔴 LISTA BLANCA: lo que no está, se rechaza ANTES de la red (y lo que está, pasa)', async () => {
  const fuera = [
    ['PUT', '/admin/jobs/3'], ['POST', '/admin/customers/5/notas'], ['PATCH', '/admin/merchant'], ['DELETE', '/admin/customers/1'],
    ['POST', '/admin/albaranes/1/enviar-para-firmar'], ['POST', '/admin/albaranes/1/convertir-en-factura'],
    ['POST', '/admin/invoices'], ['POST', '/admin/onboarding/complete'], ['PUT', '/admin/merchant?x=1'],
    ['POST', '//evil.example/admin/customers'], ['GET', '/admin/customers'],
    ['POST', '/quote/abc/decision'], ['POST', '/admin/quotes/7/send-whatsapp'], ['POST', '/admin/quotes/7/invoice'], ['POST', '/quote/create?x=1'],
  ];
  for (const [m, r] of fuera) assert.throws(() => escrituraPermitida(m, r), Rechazo, `${m} ${r} tenía que rechazarse`);
  const dentro = [['POST', '/admin/customers'], ['POST', '/admin/jobs'], ['POST', '/admin/jobs/7/albaranes'], ['POST', '/admin/albaranes/7/emitir'], ['POST', '/admin/partes'], ['PUT', '/admin/merchant'], ['POST', '/quote/create']];
  for (const [m, r] of dentro) assert.doesNotThrow(() => escrituraPermitida(m, r), `${m} ${r} está en la lista`);
  // Y con una cuenta de verdad comprobada, la ruta de fuera tampoco toca la red.
  const p = panel();
  const cuenta = await comprobarCuentaQA(p.fetchFn, COOKIE);
  const antes = p.llamadas.length;
  for (const [m, r] of fuera) await assert.rejects(escritura(p.fetchFn, m, r, { cuenta }), Rechazo);
  assert.equal(p.llamadas.length, antes, 'una escritura rechazada llegó a la red');
});

test('SCRUM-1268 · 🔴 una cuenta FABRICADA (no salida del servidor) no escribe', async () => {
  const p = panel();
  await assert.rejects(escritura(p.fetchFn, 'POST', '/admin/customers', { cuenta: { merchantId: MERCHANT_QA, cookie: COOKIE } }), Rechazo);
  await assert.rejects(escritura(p.fetchFn, 'POST', '/admin/customers', {}), Rechazo);
  assert.equal(p.llamadas.length, 0);
});

test('SCRUM-1268 · fail-closed: un alta que no da 2xx lo DICE, sale 1 y no sigue escribiendo', async () => {
  const p = panel({ falla: { 'POST /admin/customers': 500 } });
  const r = await correr(['sembrar'], p);
  assert.equal(r.codigo, 1);
  assert.match(r.err, /POST \/admin\/customers → 500/);
  assert.equal(escrituras(p).length, 1, 'tras el fallo no sale ninguna escritura más');
});

test('SCRUM-1268 · fail-closed: dos clientes con el nombre exacto → no elige, no escribe', async () => {
  const dup = [{ id: 1, name: NOMBRE_CLIENTE_QA }, { id: 2, name: NOMBRE_CLIENTE_QA }];
  const p = panel({ clientesExtra: dup });
  const r = await correr(['sembrar'], p);
  assert.equal(r.codigo, 1);
  assert.match(r.err, /no elijo/);
  assert.equal(escrituras(p).length, 0);
});

test('SCRUM-1268 · fail-closed: la lista de trabajos llega llena y el nuestro no está → «no lo sé», no crea otro', async () => {
  const p = panel({ trabajosDeRelleno: 200 });
  const r = await correr(['sembrar'], p);
  assert.equal(r.codigo, 1);
  assert.match(r.err, /llega llena/);
  assert.ok(!escrituras(p).some((l) => l.ruta === '/admin/jobs'), 'no se crea un trabajo a ciegas');
});

test('SCRUM-1268 · fail-closed: si el servidor no aplica la clave de idempotencia, NO se emite', async () => {
  const p = panel({ idempotencia: 'no_solicitada' });
  const r = await correr(['sembrar'], p);
  assert.equal(r.codigo, 1);
  assert.equal(p.s.emisiones, 0);
});

test('SCRUM-1268b · presupuesto: dos con la marca → no elige, no crea otro', async () => {
  const p = panel();
  assert.equal((await correr(['sembrar'], p)).codigo, 0);
  const primero = p.s.presupuestos[0];
  p.s.presupuestos.push({ ...primero, id: primero.id + 1000 });
  const r = await correr(['sembrar'], p);
  assert.equal(r.codigo, 1);
  assert.match(r.err, new RegExp(`2 presupuestos con la marca ${MARCA_PRESUPUESTO_QA.replace(/[[\]]/g, '\\$&')}`));
  assert.equal(p.s.presupuestos.length, 2, 'no se crea un tercero');
});

test('SCRUM-1268b · presupuesto: la lista llega llena y el nuestro no está → «no lo sé», no crea', async () => {
  const p = panel({ presupuestosDeRelleno: 100 });
  const r = await correr(['sembrar'], p);
  assert.equal(r.codigo, 1);
  assert.match(r.err, /lista de presupuestos llega llena \(100\)/);
  assert.ok(!escrituras(p).some((l) => l.ruta === '/quote/create'), 'no se crea un presupuesto a ciegas');
  // Control: con 99 la lista NO está llena, y sí se crea.
  const q = panel({ presupuestosDeRelleno: 99 });
  assert.equal((await correr(['sembrar'], q)).codigo, 0);
  assert.equal(q.s.presupuestos.length, 1);
});

test('SCRUM-1268b · 🔴 presupuesto: se RELEE; si el servidor se comió la cabecera, lo dice y sale 1', async () => {
  const p = panel({ pierdeCabecera: true });
  const r = await correr(['sembrar'], p);
  assert.equal(r.codigo, 1, 'un 201 con la cabecera perdida no es «hecho»');
  assert.match(r.err, /al releerlo la cabecera o el pie NO son los enviados/);
});

test('SCRUM-1268 · perfil: imprime la RELECTURA campo a campo, caza lo descartado y lo borrado sin enviar, y no la respuesta cruda', async () => {
  const p = panel();
  const valores = { taxId: 'B22222222', retencionIrpfDeclarada: true, retencionIrpfTipo: 15 };
  const r = await correr((f) => ['perfil', f('v.json', JSON.stringify(valores))], p);
  assert.equal(r.codigo, 0, r.err);
  assert.match(r.out, /OK\s+taxId/);
  assert.match(r.out, /DISTINTO\s+retencionIrpfDeclarada/, 'lo que el esquema descarta en silencio se ve (el defecto del IRPF)');
  assert.match(r.out, /DISTINTO\s+retencionIrpfTipo/);
  assert.match(r.out, /CAMBIÓ SIN ENVIARSE address/, 'lo que se borra sin enviarse se ve (la familia de SCRUM-1227)');
  // Respaldo de la negación de abajo: el PUT SÍ devolvió ese dato, así que su ausencia en la salida mide algo.
  assert.ok(JSON.stringify(p.s.respuestaPut).includes('NO-DEBE-SALIR-1268'), 'el PUT falso tenía que devolver el dato crudo');
  assert.ok(!(r.out + r.err).includes('NO-DEBE-SALIR-1268'), 'la respuesta cruda del PUT no se imprime');
  assert.equal(escrituras(p).length, 1);
});

test('SCRUM-1268 · perfil: slug e invoiceSeriesPrefix se rechazan sin tocar la red', async () => {
  for (const v of [{ slug: 'x' }, { invoiceSeriesPrefix: 'Z' }, {}, []]) {
    const p = panel();
    const r = await correr((f) => ['perfil', f('v.json', JSON.stringify(v))], p);
    assert.equal(r.codigo, 3, JSON.stringify(v));
    assert.equal(p.llamadas.length, 0);
  }
});

test('SCRUM-1268 · sin sesión → CIEGO (2), sin red; orden desconocida → 3', async () => {
  const p = panel();
  const r = await correr(['sembrar'], p, { sesion: null });
  assert.equal(r.codigo, 2);
  assert.match(r.err, /CIEGO/);
  assert.equal(p.llamadas.length, 0);
  assert.equal((await correr(['borrar'], p)).codigo, 3);
  assert.equal(p.llamadas.length, 0);
});
