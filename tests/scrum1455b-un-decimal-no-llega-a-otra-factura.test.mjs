// tests/scrum1455b-un-decimal-no-llega-a-otra-factura.test.mjs — SCRUM-1455b (J1, 20-oct-2026)
//
// 🔴 UN ID DECIMAL EN LA URL ACTÚA SOBRE LA FACTURA DE SU PARTE ENTERA. Medido por la RUTA REAL, con
// Prisma y Postgres de verdad (`docs/evidencias/scrum1455/sonda-factura.mjs.txt` y su salida): siete de
// las dieciséis lecturas de id de la factura validan con `Number.isNaN`, un `31.5` pasa, Prisma lo TRUNCA,
// y `POST /admin/invoices/31.5/annul` ANULA Y SELLA en la cadena VeriFactu la factura 31. `rectify` de la
// `34.5` emite una R1 que rectifica la 34. Es un acto fiscal sobre un documento que no es el pedido
// (regla 29), dentro del mismo comercio: no cruza la tenencia.
//
// Nació ROJO en siete casos: las siete rutas son cobro y camino de emisión (`status`, `pay`, `unpay`,
// `send-email`, `annul`, `rectify`, `regenerate-pdf`). Las puso en verde cambiar `Number.isNaN(id)` por
// `!cabeEnColumnaInt(id)` en esas siete líneas, con la firma del fundador (SCRUM-1456 c.18731 para seis,
// SCRUM-1455 c.20593 para `send-email`), no este test.
//
// ── EL BANCO ──────────────────────────────────────────────────────────────────────────────
// La base doblada de `scrum1456`: anota cada consulta y los números que viajan en ella. La propiedad que
// se comprueba es la del defecto: con `1.5` NINGUNA consulta recibe un número no entero. Y cada lectura
// lleva su CONTROL: con un id correcto la ruta SÍ consulta, y no lo rechaza; sin eso, un 400 a todo
// pasaría igual.
import test from 'node:test';
import assert from 'node:assert/strict';
import { inyectarBase, moduloDeDist, MERCHANT } from './_envio-doblado.mjs';
import { reqDeSesion } from './_arnes-de-router.mjs';
import { casosEscritos } from './_casos-escritos.mjs';

const consultas = [];
const decimales = [];
function numerosDe(v, acc = []) {
  if (typeof v === 'number') acc.push(v);
  else if (v && typeof v === 'object' && !(v instanceof Date)) for (const x of Object.values(v)) numerosDe(x, acc);
  return acc;
}
function vacio(metodo) {
  if (metodo === 'findMany') return [];
  if (metodo === 'count') return 0;
  if (metodo === 'aggregate') return { _max: {}, _count: 0 };
  if (metodo === 'findUnique' || metodo === 'findFirst') return null;
  if (metodo === 'updateMany' || metodo === 'deleteMany') return { count: 0 };
  return {};
}
inyectarBase(new Proxy({}, {
  get: (_t, clave) => (args) => {
    const nombre = String(clave);
    consultas.push(nombre);
    for (const n of numerosDe(args)) if (!Number.isInteger(n)) decimales.push(`${nombre}(${n})`);
    return vacio(nombre.split('.').pop());
  },
}));

const FACTURAS = '../dist/modules/system/app/routes/invoicesAdmin.routes.js';
const WEBHOOK = '../dist/modules/invoicing/app/routes/invoice.routes.js';

/** [módulo, verbo, ruta] — las 14 lecturas de id de la factura (re-medidas el 20-oct sobre `main`; `pay` y `unpay`, desmontadas en SCRUM-1250b). */
const LECTURAS = [
  [FACTURAS, 'get', '/:id'],
  [FACTURAS, 'post', '/:id/payment-anomaly'],
  [FACTURAS, 'get', '/:id/dispute-package'],
  [FACTURAS, 'put', '/:id/tags'],
  [FACTURAS, 'put', '/:id/status'],
  [FACTURAS, 'post', '/:id/resend-whatsapp'],
  [FACTURAS, 'post', '/:id/send-email'],
  [FACTURAS, 'post', '/:id/send-reminder'],
  [FACTURAS, 'post', '/:id/annul'],
  [FACTURAS, 'post', '/:id/rectify'],
  [FACTURAS, 'post', '/:id/regenerate-pdf'],
  [FACTURAS, 'get', '/:id/pdf'],
  [FACTURAS, 'patch', '/:id/asignados'],
  [WEBHOOK, 'post', '/:id/paid-webhook'],
];

// Un cuerpo que pasa las validaciones de forma de cada ruta, para que lo único que decida sea el id.
const CUERPO = { tags: [], assignedUserIds: [], status: 'paid', motivo: 'duplicada', amount: 10 };

function pedidor([modulo, verbo, ruta]) {
  const router = moduloDeDist(modulo).default;
  const capa = router.stack.find((l) => l.route && l.route.path === ruta && l.route.methods[verbo]);
  assert.ok(capa, `🔴 CIEGO: no encuentro ${verbo.toUpperCase()} ${ruta} en ${modulo}`);
  const h = capa.route.stack[capa.route.stack.length - 1].handle;
  return async (valor) => {
    consultas.length = 0;
    decimales.length = 0;
    const r = { status: 200 };
    const res = new Proxy({}, {
      get: (_t, p) => {
        if (p === 'then') return undefined; // un `res` que contesta a `then` cuelga el `async` (SCRUM-1379b)
        if (p === 'status') return (s) => { r.status = s; return res; };
        return () => res;
      },
    });
    const callar = console.error; console.error = () => {};
    try {
      await h(reqDeSesion({
        rol: 'admin', merchantId: MERCHANT, method: verbo.toUpperCase(), params: { id: valor }, query: {},
        body: { ...CUERPO }, teamMemberId: null,
      }), res);
    } finally { console.error = callar; }
    return { status: r.status, consultas: consultas.length, decimales: [...decimales] };
  };
}

const nombreDe = ([modulo, verbo, ruta]) =>
  `${verbo.toUpperCase()} ${modulo === WEBHOOK ? '/invoice' : '/admin/invoices'} ${ruta}`;

test('SCRUM-1455b · el censo: las 14 rutas con `:id` de los dos routers de factura son las 14 de este fichero', () => {
  const conId = [];
  for (const m of [FACTURAS, WEBHOOK]) {
    for (const l of moduloDeDist(m).default.stack) {
      if (!l.route || !l.route.path.includes(':id')) continue;
      for (const v of Object.keys(l.route.methods)) conId.push(`${m} ${v} ${l.route.path}`);
    }
  }
  assert.ok(conId.length > 0, '🔴 CIEGO: los routers no exponen ninguna ruta');
  assert.deepEqual(conId.sort(), LECTURAS.map((l) => l.join(' ')).sort(),
    'una ruta de factura con `:id` nueva (o quitada) tiene que entrar en LECTURAS');
});

const decimal = casosEscritos(LECTURAS, (l) => `SCRUM-1455b · ${nombreDe(l)} · 🔴 un id decimal → 400, y ninguna consulta recibe un decimal`, async (l) => {
  const pedir = pedidor(l);
  for (const v of ['1.5', '31.5', '0.5']) {
    const r = await pedir(v);
    assert.deepEqual(r.decimales, [], `🔴 con ${v} el decimal LLEGA a la base (${r.decimales.join(', ')}): Prisma lo trunca y la ruta actúa sobre la factura ${Math.trunc(Number(v))}`);
    assert.equal(r.status, 400, `🔴 con ${v} responde ${r.status}: la ruta lo ha dejado pasar`);
  }
});
const control = casosEscritos(LECTURAS, (l) => `SCRUM-1455b · ${nombreDe(l)} · CONTROL: un id correcto llega a la base y no se rechaza`, async (l) => {
  const pedir = pedidor(l);
  const r = await pedir('7');
  assert.ok(r.consultas > 0, `🔴 CIEGO: con un id correcto la ruta no ha consultado la base (status ${r.status})`);
  assert.notEqual(r.status, 400, '🔴 un id correcto se rechaza: el arreglo sería peor que el defecto');
});

test('SCRUM-1455b · GET /admin/invoices /:id · 🔴 un id decimal → 400, y ninguna consulta recibe un decimal', decimal(0));
test('SCRUM-1455b · GET /admin/invoices /:id · CONTROL: un id correcto llega a la base y no se rechaza', control(0));
test('SCRUM-1455b · POST /admin/invoices /:id/payment-anomaly · 🔴 un id decimal → 400, y ninguna consulta recibe un decimal', decimal(1));
test('SCRUM-1455b · POST /admin/invoices /:id/payment-anomaly · CONTROL: un id correcto llega a la base y no se rechaza', control(1));
test('SCRUM-1455b · GET /admin/invoices /:id/dispute-package · 🔴 un id decimal → 400, y ninguna consulta recibe un decimal', decimal(2));
test('SCRUM-1455b · GET /admin/invoices /:id/dispute-package · CONTROL: un id correcto llega a la base y no se rechaza', control(2));
test('SCRUM-1455b · PUT /admin/invoices /:id/tags · 🔴 un id decimal → 400, y ninguna consulta recibe un decimal', decimal(3));
test('SCRUM-1455b · PUT /admin/invoices /:id/tags · CONTROL: un id correcto llega a la base y no se rechaza', control(3));
test('SCRUM-1455b · PUT /admin/invoices /:id/status · 🔴 un id decimal → 400, y ninguna consulta recibe un decimal', decimal(4));
test('SCRUM-1455b · PUT /admin/invoices /:id/status · CONTROL: un id correcto llega a la base y no se rechaza', control(4));
test('SCRUM-1455b · POST /admin/invoices /:id/resend-whatsapp · 🔴 un id decimal → 400, y ninguna consulta recibe un decimal', decimal(5));
test('SCRUM-1455b · POST /admin/invoices /:id/resend-whatsapp · CONTROL: un id correcto llega a la base y no se rechaza', control(5));
test('SCRUM-1455b · POST /admin/invoices /:id/send-email · 🔴 un id decimal → 400, y ninguna consulta recibe un decimal', decimal(6));
test('SCRUM-1455b · POST /admin/invoices /:id/send-email · CONTROL: un id correcto llega a la base y no se rechaza', control(6));
test('SCRUM-1455b · POST /admin/invoices /:id/send-reminder · 🔴 un id decimal → 400, y ninguna consulta recibe un decimal', decimal(7));
test('SCRUM-1455b · POST /admin/invoices /:id/send-reminder · CONTROL: un id correcto llega a la base y no se rechaza', control(7));
test('SCRUM-1455b · POST /admin/invoices /:id/annul · 🔴 un id decimal → 400, y ninguna consulta recibe un decimal', decimal(8));
test('SCRUM-1455b · POST /admin/invoices /:id/annul · CONTROL: un id correcto llega a la base y no se rechaza', control(8));
test('SCRUM-1455b · POST /admin/invoices /:id/rectify · 🔴 un id decimal → 400, y ninguna consulta recibe un decimal', decimal(9));
test('SCRUM-1455b · POST /admin/invoices /:id/rectify · CONTROL: un id correcto llega a la base y no se rechaza', control(9));
test('SCRUM-1455b · POST /admin/invoices /:id/regenerate-pdf · 🔴 un id decimal → 400, y ninguna consulta recibe un decimal', decimal(10));
test('SCRUM-1455b · POST /admin/invoices /:id/regenerate-pdf · CONTROL: un id correcto llega a la base y no se rechaza', control(10));
test('SCRUM-1455b · GET /admin/invoices /:id/pdf · 🔴 un id decimal → 400, y ninguna consulta recibe un decimal', decimal(11));
test('SCRUM-1455b · GET /admin/invoices /:id/pdf · CONTROL: un id correcto llega a la base y no se rechaza', control(11));
test('SCRUM-1455b · PATCH /admin/invoices /:id/asignados · 🔴 un id decimal → 400, y ninguna consulta recibe un decimal', decimal(12));
test('SCRUM-1455b · PATCH /admin/invoices /:id/asignados · CONTROL: un id correcto llega a la base y no se rechaza', control(12));
test('SCRUM-1455b · POST /invoice /:id/paid-webhook · 🔴 un id decimal → 400, y ninguna consulta recibe un decimal', decimal(13));
test('SCRUM-1455b · POST /invoice /:id/paid-webhook · CONTROL: un id correcto llega a la base y no se rechaza', control(13));
decimal.todos();
control.todos();
