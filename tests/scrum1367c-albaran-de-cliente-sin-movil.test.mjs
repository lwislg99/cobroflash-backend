// tests/scrum1367c-albaran-de-cliente-sin-movil.test.mjs — SCRUM-1367c
//
// La orden `sin-movil` de `scripts/qa/sembrar-albaranes.mjs`: un albarán EMITIDO de un cliente que no
// tiene ni móvil ni teléfono (lo que SCRUM-1302 no pudo ver en la cuenta QA). Probada SIN RED, con un
// panel falso con estado. NADA de esto se ha ejecutado contra producción: se mide la CAPACIDAD.
//   · el cliente nace SIN número, y lo dice el validador de verdad del servidor, no el panel falso;
//   · si alguien le puso un número, la orden se niega ANTES de escribir;
//   · lo que quedó se RELEE: un cliente que vuelve con número sale 1, no 0;
//   · repetir la orden no crea, no emite y no duplica;
//   · no añade ninguna escritura a la lista, y no firma, factura, cobra ni envía.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { temporal, borrarTemporal } from './_temporal.mjs'; // SCRUM-864 · se borra pase lo que pase
import {
  ejecutar, ESCRITURAS_DE_ALBARAN, LINEAS_QA, NOMBRE_CLIENTE_SIN_MOVIL, TITULO_TRABAJO_SIN_MOVIL,
  claveAlbaranSinMovil, claveAlbaranFotos, claveAlbaranFirmado,
} from '../scripts/qa/sembrar-albaranes.mjs';
import { MERCHANT_QA, NOMBRE_CLIENTE_QA, TITULO_TRABAJO_QA, PROHIBIDAS, claveAlbaranQA } from '../scripts/qa/sembrar-qa.mjs';
// Las reglas DE VERDAD del servidor (lección de SCRUM-1268c): un panel que dice que sí a todo prueba
// el guion contra sí mismo.
import { customerCreateSchema } from '../dist/core/validation/schemas.js';
import { datosDeTrabajoDirecto } from '../dist/modules/jobs/domain/trabajoDirecto.js';
import { validarLineas, canTransitionAlbaran } from '../dist/modules/jobs/domain/albaran.service.js';

// El rojo, declarado: lo ejecuta `npm run meta:mutaciones`.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Sin mirar el número del cliente que ya existe: se le colgaría un albarán a un cliente CON móvil.
    fichero: 'scripts/qa/sembrar-albaranes.mjs',
    de: '  if (cliente && numerosDe(cliente).length) {',
    a: '  if (false) {',
    cae: 'SCRUM-1367c · ⑦ 🔴 si al cliente le pusieron un número, se niega ANTES de escribir nada',
  },
  {
    // Sin la relectura: un cliente que el servidor devolvió con número saldría como «sin móvil».
    fichero: 'scripts/qa/sembrar-albaranes.mjs',
    de: '  if (releido.id !== cliente.id || numerosDe(releido).length) {',
    a: '  if (false) {',
    cae: 'SCRUM-1367c · ⑦ 🔴 el cliente se RELEE: si vuelve con número, sale 1 y el caso no se da por hecho',
  },
  {
    // Un teléfono fijo también es un sitio al que mandar algo: mirar sólo `mobile` deja pasar medio caso.
    fichero: 'scripts/qa/sembrar-albaranes.mjs',
    de: "const numerosDe = (c) => ['mobile', 'phone'].filter((k) => !sinNumero(c[k]));",
    a: "const numerosDe = (c) => ['mobile'].filter((k) => !sinNumero(c[k]));",
    cae: 'SCRUM-1367c · ⑦ 🔴 si al cliente le pusieron un número, se niega ANTES de escribir nada',
  },
];

const COOKIE = 'pf_session=tok1367cabcdef';

function resp(status, cuerpo) {
  return { status, headers: new Headers(), text: async () => (cuerpo === undefined ? '' : JSON.stringify(cuerpo)) };
}

/**
 * Un panel falso con estado, que arranca con el sembrado base (el cliente QA CON móvil y su Trabajo).
 * El alta de cliente pasa por `customerCreateSchema` y la de trabajo por `datosDeTrabajoDirecto`, los
 * dos de `dist/`. `numeroAlReleer`: el servidor devuelve la ficha con un número que el alta no llevaba.
 */
function panel({
  me = { merchantId: MERCHANT_QA, isOwner: true, merchantName: 'PruebaQA' },
  clienteYa = null, numeroAlReleer = null, gemelos = 0,
} = {}) {
  let id = 700;
  const s = {
    clientes: [{ id: 61, name: NOMBRE_CLIENTE_QA, mobile: '34000001268', phone: null }],
    trabajos: [{ id: 76, tituloPropio: TITULO_TRABAJO_QA, customer: { id: 61 } }],
    albaranes: [],
  };
  if (clienteYa) s.clientes.push({ id: ++id, name: NOMBRE_CLIENTE_SIN_MOVIL, mobile: null, phone: null, ...clienteYa });
  for (let i = 0; i < gemelos; i++) s.clientes.push({ id: ++id, name: NOMBRE_CLIENTE_SIN_MOVIL, mobile: null, phone: null });
  const llamadas = [];
  const cara = (a) => ({ id: a.id, jobId: a.jobId, numero: a.numero, estado: a.estado, lineas: a.lineas, notas: a.notas });
  const fetchFn = async (url, init = {}) => {
    const u = new URL(url);
    const m = init.method || 'GET';
    const clave = `${m} ${u.pathname}`;
    const cuerpo = init.body ? JSON.parse(init.body) : null;
    llamadas.push({ m, ruta: u.pathname + u.search, cuerpo, cookie: init.headers && init.headers.cookie });
    if (clave === 'GET /admin/me') return resp(200, me);
    if (clave === 'GET /admin/jobs') return resp(200, s.trabajos);
    if (clave === 'GET /admin/customers') {
      const q = (u.searchParams.get('search') || '').toLowerCase();
      return resp(200, s.clientes.filter((c) => c.name.toLowerCase().includes(q)));
    }
    if (clave === 'POST /admin/customers') {
      const v = customerCreateSchema.safeParse(cuerpo);
      if (!v.success) return resp(400, { error: 'validation_error', details: v.error.issues });
      const c = { id: ++id, name: v.data.name, mobile: v.data.mobile ?? null, phone: v.data.phone ?? null, notes: v.data.notes ?? null };
      s.clientes.push(c);
      return resp(201, c);
    }
    let r = u.pathname.match(/^\/admin\/customers\/(\d+)$/);
    if (r && m === 'GET') {
      const c = s.clientes.find((x) => x.id === Number(r[1]));
      if (!c) return resp(404, { error: 'not_found' });
      return resp(200, numeroAlReleer ? { ...c, ...numeroAlReleer } : c);
    }
    if (clave === 'POST /admin/jobs') {
      const v = datosDeTrabajoDirecto(cuerpo);
      if (!v.ok) return resp(400, { error: v.error });
      if (!s.clientes.some((c) => c.id === v.datos.customerId)) return resp(404, { error: 'customer_not_found' });
      const j = { id: ++id, tituloPropio: cuerpo.titulo, customer: { id: v.datos.customerId } };
      s.trabajos.push(j);
      return resp(201, j);
    }
    r = u.pathname.match(/^\/admin\/jobs\/(\d+)\/albaranes$/);
    if (r && m === 'POST') {
      const ya = s.albaranes.find((a) => a.clave === cuerpo.claveIdempotencia);
      if (ya) return resp(200, { ...cara(ya), idempotencia: 'repetida' });
      const v = validarLineas(cuerpo.lineas, 'SIN_VALORAR');
      if (!v.ok) return resp(400, { error: 'lineas_invalidas', message: v.error });
      const a = { id: ++id, jobId: Number(r[1]), numero: null, estado: 'borrador', lineas: v.lineas, notas: cuerpo.notas ?? null, clave: cuerpo.claveIdempotencia };
      s.albaranes.push(a);
      return resp(201, { ...cara(a), idempotencia: 'aplicada' });
    }
    r = u.pathname.match(/^\/admin\/albaranes\/(\d+)\/emitir$/);
    if (r && m === 'POST') {
      const a = s.albaranes.find((x) => x.id === Number(r[1]));
      if (!a) return resp(404, { error: 'not_found' });
      if (!canTransitionAlbaran(a.estado, 'emitido')) return resp(409, { error: 'invalid_transition' });
      a.estado = 'emitido'; a.numero = `ALB-QA-${a.id}`;
      return resp(200, cara(a));
    }
    return resp(404, { error: `ruta no simulada: ${clave}` });
  };
  return { fetchFn, llamadas, s };
}

/** Banco: la sesión en un temporal, y la orden contra el panel falso. */
function banco(opciones = {}) {
  const dir = temporal('scrum1367c-');
  const rutaSesion = path.join(dir, 'sesion.txt');
  fs.writeFileSync(rutaSesion, COOKIE + '\n');
  const p = panel(opciones);
  const out = [];
  const err = [];
  const correr = (argv) => {
    out.length = 0; err.length = 0;
    return ejecutar(argv, { fetchFn: p.fetchFn, rutaSesion, out: (x) => out.push(x), err: (x) => err.push(x) });
  };
  const escrituras = () => p.llamadas.filter((l) => l.m !== 'GET');
  const de = (sufijo) => escrituras().filter((l) => l.ruta.endsWith(sufijo));
  return { ...p, out, err, correr, escrituras, de, todo: () => [...out, ...err].join('\n'), limpiar: () => borrarTemporal(dir) };
}

const sinMovil = (s) => s.clientes.filter((c) => c.name === NOMBRE_CLIENTE_SIN_MOVIL);

test('SCRUM-1367c · ⑦ «sin-movil» desde el sembrado base: cliente SIN número, su trabajo y su albarán emitido UNA vez', async () => {
  const b = banco();
  try {
    assert.equal(await b.correr(['sin-movil']), 0, b.todo());
    const altas = b.de('/admin/customers');
    assert.equal(altas.length, 1);
    assert.deepEqual(Object.keys(altas[0].cuerpo).sort(), ['name', 'notes'], 'el alta lleva algo más que el nombre y la nota');
    const [cliente] = sinMovil(b.s);
    assert.equal(cliente.mobile, null);
    assert.equal(cliente.phone, null);
    const trabajo = b.s.trabajos.find((j) => j.tituloPropio === TITULO_TRABAJO_SIN_MOVIL);
    assert.equal(trabajo.customer.id, cliente.id, 'el trabajo no cuelga del cliente sin móvil');
    assert.equal(b.s.albaranes.length, 1);
    const [a] = b.s.albaranes;
    assert.equal(a.jobId, trabajo.id, 'el albarán cuelga del Trabajo QA de base, que es de un cliente CON móvil');
    assert.equal(a.clave, claveAlbaranSinMovil(trabajo.id));
    assert.equal(a.estado, 'emitido');
    assert.deepEqual(a.lineas.map((l) => l.cantidad), LINEAS_QA.map((l) => l.cantidad));
    assert.equal(b.de('/emitir').length, 1);
    assert.match(b.out.join('\n'), /cliente al RELEER: sin móvil y sin teléfono/);
    assert.match(b.out.join('\n'), /CREADO[\s\S]*CREADO[\s\S]*CREADO · EMITIDO ahora/);
    for (const l of b.escrituras()) {
      assert.equal(PROHIBIDAS.some((re) => re.test(l.ruta)), false, `salió una escritura prohibida: ${l.m} ${l.ruta}`);
      assert.equal(l.cookie, COOKIE);
    }
    assert.equal(b.escrituras().length, 4, 'cliente, trabajo, albarán y emitir: ni una más');
  } finally { b.limpiar(); }
});

test('SCRUM-1367c · ⑦ repetir «sin-movil» no crea cliente, trabajo ni albarán, y no emite otra vez', async () => {
  const b = banco();
  try {
    assert.equal(await b.correr(['sin-movil']), 0, b.todo());
    b.llamadas.length = 0;
    assert.equal(await b.correr(['sin-movil']), 0, b.todo());
    assert.equal(sinMovil(b.s).length, 1);
    assert.equal(b.s.trabajos.length, 2, 'control: el de base y el del caso');
    assert.equal(b.s.albaranes.length, 1);
    assert.equal(b.de('/admin/customers').length, 0);
    assert.equal(b.de('/admin/jobs').length, 0);
    assert.equal(b.de('/emitir').length, 0, 'emitió otra vez: gasta un número ALB');
    assert.match(b.out.join('\n'), /ya estaba[\s\S]*ya estaba[\s\S]*ya estaba · ya estaba emitido \(no se repite\)/);
  } finally { b.limpiar(); }
});

test('SCRUM-1367c · ⑦ 🔴 si al cliente le pusieron un número, se niega ANTES de escribir nada', async () => {
  for (const clienteYa of [{ mobile: '34000001367' }, { phone: '34000001368' }]) {
    const b = banco({ clienteYa });
    try {
      assert.equal(await b.correr(['sin-movil']), 1, JSON.stringify(clienteYa));
      assert.match(b.err.join('\n'), /ya no es el caso «sin móvil»\. No se ha escrito nada/);
      assert.match(b.err.join('\n'), new RegExp(`TIENE ${Object.keys(clienteYa)[0]}`));
      assert.equal(b.escrituras().length, 0, 'le colgó un trabajo o un albarán a un cliente con número');
    } finally { b.limpiar(); }
  }
  // Control: el mismo cliente, ya existente y SIN número, sí sirve y no se crea otro.
  const b = banco({ clienteYa: {} });
  try {
    assert.equal(await b.correr(['sin-movil']), 0, b.todo());
    assert.equal(b.de('/admin/customers').length, 0);
    assert.equal(b.s.albaranes.length, 1);
  } finally { b.limpiar(); }
});

test('SCRUM-1367c · ⑦ 🔴 el cliente se RELEE: si vuelve con número, sale 1 y el caso no se da por hecho', async () => {
  const b = banco({ numeroAlReleer: { mobile: '34000001367' } });
  try {
    assert.equal(await b.correr(['sin-movil']), 1);
    assert.match(b.err.join('\n'), /al RELEER, el cliente #\d+ tiene mobile\. El caso NO está completo/);
    assert.deepEqual(b.out, [], 'un caso incompleto no escribe por stdout como si estuviera hecho');
  } finally { b.limpiar(); }
});

test('SCRUM-1367c · ⑦ con dos clientes de ese nombre no elige uno a ciegas: sale 1 sin escribir', async () => {
  const b = banco({ gemelos: 2 });
  try {
    assert.equal(await b.correr(['sin-movil']), 1);
    assert.match(b.err.join('\n'), /hay 2 clientes/);
    assert.equal(b.escrituras().length, 0);
  } finally { b.limpiar(); }
});

test('SCRUM-1367c · ⑦ 🔴 CUENTA: si el servidor no dice merchant 46 y owner, «sin-movil» no escribe', async () => {
  for (const me of [{ merchantId: 987654, isOwner: true, merchantName: 'Otra cuenta inventada' }, { merchantId: MERCHANT_QA, isOwner: false, merchantName: 'PruebaQA' }]) {
    const b = banco({ me });
    try {
      assert.equal(await b.correr(['sin-movil']), 3, b.todo());
      assert.equal(b.escrituras().length, 0);
      assert.match(b.err.join('\n'), /NO ES LA CUENTA QA/);
    } finally { b.limpiar(); }
  }
});

test('SCRUM-1367c · ⑦ no ensancha la lista de escrituras y su albarán no es el de ningún otro caso', () => {
  assert.equal(ESCRITURAS_DE_ALBARAN.length, 2, 'el caso «sin-movil» no necesita ninguna escritura nueva');
  const claves = new Set([claveAlbaranSinMovil(76), claveAlbaranFotos(76), claveAlbaranFirmado(76), claveAlbaranQA(76)]);
  assert.equal(claves.size, 4);
  assert.notEqual(NOMBRE_CLIENTE_SIN_MOVIL, NOMBRE_CLIENTE_QA);
  // La búsqueda del panel es por subcadena: si un nombre contuviera al otro, buscar el cliente de
  // base devolvería también éste. Ninguno contiene al otro, ni los títulos de sus trabajos.
  assert.equal(NOMBRE_CLIENTE_SIN_MOVIL.includes(NOMBRE_CLIENTE_QA) || NOMBRE_CLIENTE_QA.includes(NOMBRE_CLIENTE_SIN_MOVIL), false);
  assert.equal(TITULO_TRABAJO_SIN_MOVIL.includes(TITULO_TRABAJO_QA) || TITULO_TRABAJO_QA.includes(TITULO_TRABAJO_SIN_MOVIL), false);
});
