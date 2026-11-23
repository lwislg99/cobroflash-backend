// tests/scrum1316l-medio-de-cobro-con-iva-10.test.mjs — SCRUM-1316l (J1, 24-nov-2026)
//
// 🔴 CON UNA LÍNEA AL 10 % DE IVA, MARCAR COBRADA A MANO EXIGE DECIR CÓMO SE COBRÓ.
// RDL 29/2026, desde el 1-dic-2026: el 10 % en obras de vivienda depende del medio de pago. Decisión del
// fundador en SCRUM-1316 c.22438 («1-Sí a las 5»): obligatorio SOLO en facturas con alguna línea al 10 %;
// el resto sigue como hoy. Literales firmados: T3 (c.22438) y T4 (= el aviso firmado en c.22424).
//
// Tres puertas, las tres medidas aquí:
//   · `PUT /admin/invoices/:id/status` — por HTTP, con `requireRole('admin')` de la ruta (A10, SCRUM-1344).
//   · `POST /admin/invoices/bulk-paid` — el lote no lleva selector: las del 10 % se quedan fuera con T3.
//   · la ficha de factura, en el banco de vistas: selector obligatorio y T4 al elegir «efectivo».
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { inyectarBase, moduloDeDist, MERCHANT } from './_envio-doblado.mjs';
import { reqDeSesion } from './_arnes-de-router.mjs';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const require = createRequire(import.meta.url);
const express = require('express');
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Las mutaciones que tienen que tumbarme (SCRUM-745). Una por pieza. */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El servidor deja de exigir el medio con línea al 10 %.
    fichero: 'src/modules/system/invoiceAdmin.ts',
    de: "if (status === 'paid' && llevaLineaAlDiez(existing.lines) && !(campoMetodo as { paidVia?: string }).paidVia) {",
    a: 'if (false) {',
    cae: 'SCRUM-1316l · PUT /:id/status · 🔴 ① con línea al 10 % y sin paidVia → 422 con T3, y no se escribe',
  },
  {
    // El lote deja de apartar las del 10 %.
    fichero: 'src/modules/system/app/routes/invoicesAdmin.routes.ts',
    de: 'const idsDelLote = ids.filter((id) => !sinMetodo.includes(id));',
    a: 'const idsDelLote = ids;',
    cae: 'SCRUM-1316l · bulk-paid · 🔴 ⑤ la del 10 % se queda fuera con T3 y las demás se marcan',
  },
  {
    // La ficha deja de enseñar el aviso al elegir efectivo.
    fichero: 'public/dashboard/js/invoiceDetailView.js',
    de: 'avisoEfectivo.hidden = !window.avisoDeEfectivoVisible(true, window.metodoElegido(selMetodo));',
    a: 'avisoEfectivo.hidden = true;',
    cae: 'SCRUM-1316l · ficha · 🔴 ⑨ con línea al 10 %, el selector es obligatorio y «efectivo» enseña T4',
  },
];

const T3 = 'Elige cómo lo has cobrado: en esta factura hay IVA al 10 %.';
const T4 = 'Desde el 1 de diciembre de 2026, el IVA del 10 % en obras de vivienda solo se aplica si el cliente paga con tarjeta, transferencia bancaria, cheque nominativo o ingreso en cuenta. Si cobras en efectivo, consúltalo con tu asesor.';

const AL_10 = [{ concept: 'ZZ reforma baño', qty: 1, price: 100, tax: 0.1 }, { concept: 'ZZ material', qty: 1, price: 50, tax: 0.21 }];
const AL_21 = [{ concept: 'ZZ reparación', qty: 1, price: 100, tax: 0.21 }];

// ── El servidor ──────────────────────────────────────────────────────────────────────────
const CON_10 = 5;
const SIN_10 = 6;
const DE_OTRO = 7;
const filasIniciales = () => new Map([
  [CON_10, { id: CON_10, merchantId: MERCHANT, status: 'pending', paidAt: null, type: 'F1', number: 'F-2026-0005', total: 160.5, lines: AL_10 }],
  [SIN_10, { id: SIN_10, merchantId: MERCHANT, status: 'pending', paidAt: null, type: 'F1', number: 'F-2026-0006', total: 121, lines: AL_21 }],
  [DE_OTRO, { id: DE_OTRO, merchantId: MERCHANT + 1, status: 'pending', paidAt: null, type: 'F1', number: 'F-2026-0007', total: 110, lines: AL_10 }],
]);
let FILAS = filasIniciales();

const registro = { updates: [], updateManys: [], auditorias: [] };
inyectarBase({
  'invoice.findFirst': (args) => {
    const fila = FILAS.get(args?.where?.id);
    return fila && fila.merchantId === args?.where?.merchantId ? { ...fila } : null;
  },
  'invoice.update': (args) => {
    const fila = FILAS.get(args?.where?.id);
    if (!fila || fila.status !== args?.where?.status) {
      throw Object.assign(new Error('Record to update not found.'), { code: 'P2025' });
    }
    registro.updates.push(args);
    return { ...fila, ...args.data };
  },
  // Hace cumplir el `where` del lote: ids, merchant y estados excluidos.
  'invoice.findMany': (args) => {
    const w = args?.where || {};
    const ids = w.id?.in || [];
    const fuera = w.status?.notIn || [];
    return [...FILAS.values()]
      .filter((f) => ids.includes(f.id) && f.merchantId === w.merchantId && !fuera.includes(f.status)
        && (w.status === undefined || typeof w.status !== 'string' || f.status === w.status))
      .map((f) => ({ ...f }));
  },
  'invoice.updateMany': (args) => {
    registro.updateManys.push(args);
    const w = args?.where || {};
    let n = 0;
    for (const f of FILAS.values()) {
      if ((w.id?.in || []).includes(f.id) && f.merchantId === w.merchantId && !(w.status?.notIn || []).includes(f.status)) {
        Object.assign(f, args.data); n++;
      }
    }
    return { count: n };
  },
  'merchant.findUnique': () => ({ id: MERCHANT, timezone: 'Europe/Madrid' }),
  'auditLog.create': (args) => { registro.auditorias.push(args?.data); return { id: 1 }; },
});

const facturas = moduloDeDist('../dist/modules/system/app/routes/invoicesAdmin.routes.js').default;
const dominio = moduloDeDist('../dist/modules/system/invoiceAdmin.js');
const vista = require(path.join(RAIZ, 'public', 'dashboard', 'js', 'invoicesView.js'));

const app = express();
app.use(express.json());
app.use('/admin/invoices', (req, _res, next) => {
  Object.assign(req, reqDeSesion({ rol: 'admin', merchantId: MERCHANT }));
  next();
}, facturas);
const servidor = http.createServer(app);
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
const PUERTO = servidor.address().port;
test.after(() => servidor.close());

async function pedir(metodo, ruta, cuerpo) {
  FILAS = filasIniciales();
  registro.updates.length = 0;
  registro.updateManys.length = 0;
  registro.auditorias.length = 0;
  const texto = JSON.stringify(cuerpo);
  const callar = console.error; console.error = () => {};
  try {
    return await new Promise((ok, mal) => {
      const req = http.request({
        host: '127.0.0.1', port: PUERTO, path: ruta, method: metodo, agent: false,
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(texto) },
      }, (res) => {
        let t = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { t += c; });
        res.on('end', () => ok({
          status: res.statusCode, body: t ? JSON.parse(t) : null,
          updates: [...registro.updates], updateManys: [...registro.updateManys], auditorias: [...registro.auditorias],
        }));
      });
      req.on('error', mal);
      req.end(texto);
    });
  } finally { console.error = callar; }
}
const marcar = (id, cuerpo) => pedir('PUT', `/admin/invoices/${id}/status`, cuerpo);
const lote = (cuerpo) => pedir('POST', '/admin/invoices/bulk-paid', cuerpo);

test('SCRUM-1316l · el literal T3 del servidor es el FIRMADO en c.22438, byte a byte', () => {
  assert.equal(dominio.COPY_METODO_OBLIGATORIO_IVA_10, T3);
  assert.equal(vista.COPY_IVA_10.eligeMetodo, T3, '🔴 la pantalla y el servidor dicen T3 distinto');
  assert.equal(vista.COPY_IVA_10.avisoEfectivo, T4, '🔴 T4 no es el texto firmado en c.22424');
});

test('SCRUM-1316l · PUT /:id/status · 🔴 ① con línea al 10 % y sin paidVia → 422 con T3, y no se escribe', async () => {
  const r = await marcar(CON_10, { status: 'paid' });
  assert.equal(r.status, 422, `🔴 responde ${r.status} ${JSON.stringify(r.body)}`);
  assert.deepEqual(r.body, { error: 'metodo_de_cobro_obligatorio', message: T3 });
  assert.equal(r.updates.length, 0, '🔴 se ha escrito la factura pese al rechazo');
  assert.equal(r.auditorias.length, 0, '🔴 se ha auditado un marcado que no ocurrió');
});

test('SCRUM-1316l · PUT /:id/status · 🔴 ② con línea al 10 % y un paidVia que el conjunto cerrado no reconoce → 422 con T3', async () => {
  const r = await marcar(CON_10, { status: 'paid', paidVia: 'cheque_nominativo' });
  assert.equal(r.status, 422, `🔴 responde ${r.status}`);
  assert.equal(r.body?.message, T3);
  assert.equal(r.updates.length, 0);
});

test('SCRUM-1316l · PUT /:id/status · ③ con línea al 10 % y paidVia → cobrada, con el método escrito', async () => {
  for (const via of ['transfer', 'cash']) {
    const r = await marcar(CON_10, { status: 'paid', paidVia: via });
    assert.equal(r.status, 200, `responde ${r.status} ${JSON.stringify(r.body)}`);
    assert.equal(r.updates.length, 1, 'CIEGO: la base doblada no ha recibido el update');
    assert.equal(r.updates[0].data.status, 'paid');
    assert.equal(r.updates[0].data.paidVia, via, '🔴 el método declarado no se escribe');
  }
});

test('SCRUM-1316l · PUT /:id/status · ④ POSITIVO: sin línea al 10 % y sin paidVia → cobrada como hoy', async () => {
  const r = await marcar(SIN_10, { status: 'paid' });
  assert.equal(r.status, 200, `🔴 una factura al 21 % sin método ya no se marca: ${r.status} ${JSON.stringify(r.body)}`);
  assert.equal(r.updates.length, 1);
  assert.deepEqual(Object.keys(r.updates[0].data).sort(), ['paidAt', 'status'], 'el update escribe campos que antes no escribía');
});

test('SCRUM-1316l · PUT /:id/status · ④bis CONTROL: la regla solo mira el paso a cobrada — expired sobre una del 10 % no la exige', async () => {
  const r = await marcar(CON_10, { status: 'expired' });
  assert.equal(r.status, 200, `responde ${r.status} ${JSON.stringify(r.body)}`);
  assert.equal(r.updates.length, 1);
});

test('SCRUM-1316l · bulk-paid · 🔴 ⑤ la del 10 % se queda fuera con T3 y las demás se marcan', async () => {
  const r = await lote({ ids: [CON_10, SIN_10] });
  assert.equal(r.status, 200, `responde ${r.status} ${JSON.stringify(r.body)}`);
  assert.equal(r.updateManys.length, 1, 'CIEGO: la base doblada no ha recibido el updateMany');
  assert.deepEqual(r.updateManys[0].where.id.in, [SIN_10], '🔴 el lote marca una factura del 10 % sin medio');
  assert.deepEqual(r.body, { ok: true, updated: 1, sinMetodo: [CON_10], message: T3 });
  const audit = r.auditorias.find((a) => a.action === 'marcar_pagado_manual');
  assert.deepEqual(audit?.meta?.sinMetodo, [CON_10], 'la auditoría no deja escrito qué se quedó fuera');
});

test('SCRUM-1316l · bulk-paid · ⑥ solo con facturas del 10 % no se marca ninguna', async () => {
  const r = await lote({ ids: [CON_10] });
  assert.equal(r.status, 200);
  assert.deepEqual(r.updateManys[0].where.id.in, [], '🔴 el lote marca la factura del 10 %');
  assert.deepEqual(r.body, { ok: true, updated: 0, sinMetodo: [CON_10], message: T3 });
});

test('SCRUM-1316l · bulk-paid · ⑦ POSITIVO: sin facturas del 10 % la respuesta es la de siempre', async () => {
  const r = await lote({ ids: [SIN_10] });
  assert.deepEqual(r.body, { ok: true, updated: 1 });
  assert.deepEqual(r.updateManys[0].where.id.in, [SIN_10]);
});

test('SCRUM-1316l · ⑧ servidor y pantalla dicen lo mismo de «lleva línea al 10 %»', () => {
  const casos = [
    [AL_10, true], [AL_21, false], [[], false], [null, false], ['no', false],
    [[{ qty: 1, price: 5, tax: 0.1 + 1e-12 }], true],
    [[{ qty: 1, price: 5, tax: 0.105 }], false],
    [[{ concept: '1. APARTADO', apartado: true, tax: 0.1 }, { qty: 1, price: 5, tax: 0.21 }], false],
    [[{ qty: 1, price: 5, tax: '0.10' }], true],
  ];
  for (const [lineas, esperado] of casos) {
    assert.equal(dominio.llevaLineaAlDiez(lineas), esperado, `servidor: ${JSON.stringify(lineas)}`);
    assert.equal(vista.llevaLineaAlDiez(lineas), esperado, `pantalla: ${JSON.stringify(lineas)}`);
  }
  assert.equal(vista.avisoDeEfectivoVisible(true, vista.METODO_EFECTIVO), true);
  assert.equal(vista.avisoDeEfectivoVisible(false, vista.METODO_EFECTIVO), false);
  assert.equal(vista.avisoDeEfectivoVisible(true, 'transfer'), false);
  assert.equal(vista.avisoDeEfectivoVisible(true, null), false);
});

test('SCRUM-1316l · ⑧bis el mensaje del lote: solo T3 si no se marcó ninguna, las dos cosas si se marcaron otras', () => {
  const base = vista.resultadoMarcadoEnBloque({ escrituraOk: true, recargaOk: true, marcadas: 1 });
  assert.equal(vista.resultadoConIvaAlDiez(base, { updated: 1 }), base, 'sin facturas fuera, el mensaje cambia');
  const mixto = vista.resultadoConIvaAlDiez(base, { updated: 1, sinMetodo: [5] });
  assert.equal(mixto.texto, base.texto + ' ' + T3);
  assert.equal(mixto.tono, 'warning');
  const cero = vista.resultadoMarcadoEnBloque({ escrituraOk: true, recargaOk: true, marcadas: 0 });
  const soloT3 = vista.resultadoConIvaAlDiez(cero, { updated: 0, sinMetodo: [5] });
  assert.deepEqual(soloT3, { tono: 'error', texto: T3, seMarcaron: false },
    '🔴 con todas fuera por el 10 %, el lote dice «ya estaban pagadas o anuladas», que es falso');
});

// ── La ficha, en el banco de vistas ─────────────────────────────────────────────────────────
const METODOS = [
  { valor: 'bizum_manual', rotulo: 'Bizum' }, { valor: 'card', rotulo: 'tarjeta' },
  { valor: 'transfer', rotulo: 'transferencia' }, { valor: 'cash', rotulo: 'efectivo' },
];
async function ficha(lineas) {
  const factura = {
    id: 7, number: 'F-2026-0007', status: 'pending', type: 'F1', total: 160.5, currency: 'EUR',
    createdAt: '2026-11-21T10:00:00.000Z', customerName: 'ZZCLIENTE Ejemplo', customer: { id: 1, name: 'ZZCLIENTE Ejemplo' },
    lines: lineas, rectifiedBy: [],
  };
  const banco = cargarDashboard(RAIZ);
  banco.ctx.appModoEmision = 'fiscal';
  banco.ctx.appMetodosDeclarables = METODOS;
  const pedidas = [];
  banco.ctx.fetch = async (u, o) => {
    pedidas.push({ u: String(u), o });
    return { ok: true, json: async () => (/\/admin\/invoices\/7$/.test(String(u)) ? factura : []) };
  };
  banco.ctx.apiRequest = async () => [];
  const r = await pintarVista(banco, 'renderInvoiceDetailView', 7);
  assert.equal(r.error, null, `🔴 la ficha revienta al abrirse: ${r.error && r.error.message}`);
  const nodos = () => todos(r.contenedor);
  const sel = nodos().find((n) => n.tagName === 'SELECT' && n._id === 'metodo-cobro-factura');
  const aviso = nodos().find((n) => n._id === 'metodo-cobro-factura-aviso');
  const boton = nodos().find((n) => n.tagName === 'BUTTON' && (n.textContent || '').trim() === 'Marcar como cobrada');
  return { sel, aviso, boton, nodos, pedidas };
}

test('SCRUM-1316l · ficha · 🔴 ⑨ con línea al 10 %, el selector es obligatorio y «efectivo» enseña T4', async () => {
  const f = await ficha(AL_10);
  assert.ok(f.sel, '🔴 CIEGO: la ficha no pinta el selector «¿Cómo lo has cobrado?»');
  assert.equal(f.sel.required, true, '🔴 con línea al 10 % el selector no es obligatorio');
  assert.ok(f.aviso, '🔴 no hay aviso T4 en la ficha');
  assert.equal(f.aviso.textContent, T4);
  assert.equal(f.aviso.hidden, true, '🔴 el aviso sale antes de elegir efectivo');
  f.sel.value = 'cash'; f.sel.disparar('change');
  assert.equal(f.aviso.hidden, false, '🔴 al elegir «efectivo» no se enseña T4');
  f.sel.value = 'transfer'; f.sel.disparar('change');
  assert.equal(f.aviso.hidden, true, '🔴 T4 sigue a la vista con «transferencia»');
});

test('SCRUM-1316l · ficha · 🔴 ⑩ con línea al 10 % y sin elegir, «Marcar como cobrada» dice T3 y no llama al servidor', async () => {
  const f = await ficha(AL_10);
  assert.ok(f.boton, '🔴 CIEGO: no encuentro «Marcar como cobrada»');
  const antes = f.pedidas.length;
  await f.boton.disparar('click');
  assert.equal(f.pedidas.slice(antes).filter((p) => /\/status$/.test(p.u)).length, 0, '🔴 se ha mandado el PUT sin medio');
  assert.ok(f.nodos().some((n) => (n.textContent || '').includes(T3)), '🔴 la ficha no enseña T3');
});

test('SCRUM-1316l · ficha · ⑪ POSITIVO: sin línea al 10 %, el selector sigue opcional y no hay aviso', async () => {
  const f = await ficha(AL_21);
  assert.ok(f.sel, '🔴 CIEGO: la ficha no pinta el selector');
  assert.notEqual(f.sel.required, true, '🔴 sin línea al 10 % el selector se ha vuelto obligatorio');
  assert.equal(f.aviso, undefined, '🔴 sin línea al 10 % la ficha pinta el aviso T4');
});
