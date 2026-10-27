// tests/scrum1545c-tiers-de-plantilla-con-forma.test.mjs — SCRUM-1545 (punto 3 de su aceptación)
//
// 🔴 `POST /admin/templates` Y `PUT /admin/templates/:id` GUARDABAN `tiers` SIN MIRAR SU FORMA.
//
// Cualquier JSON entraba en la columna: un objeto, un texto, dos opciones, una opción sin líneas.
// Hoy no lo manda nadie (SCRUM-1545, «quién lo manda: nadie»), así que no ha mordido; el día que un
// consumidor aplique la plantilla (punto 2), leería como «3 opciones» lo que no lo es.
//
// La forma NO se inventa aquí: es la MISMA regla que acepta un presupuesto de 3 opciones,
// `CreateQuoteSchema.shape.tiers` (`schemas.ts`). Una plantilla que el presupuesto rechazaría no se
// guarda. Los casos de abajo comparan el veredicto de la ruta con el de ese esquema, uno a uno.
//
// Sin texto: el 400 lleva un código (`invalid_tiers`), como `name_required` y `lines_required`.
// `null` (vaciar, SCRUM-1188d) y la clave ausente siguen como estaban.
//
// ── EL BANCO ────────────────────────────────────────────────────────────────────────────────
// El handler de `dist/` de verdad, con la base doblada por `_envio-doblado.mjs` (sin estado: se mide
// el `data` que la ruta le pasa a `create`/`update`), igual que `scrum1188c`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { inyectarBase, moduloDeDist, MERCHANT } from './_envio-doblado.mjs';
import { reqDeSesion } from './_arnes-de-router.mjs';

const GUARDADA = Object.freeze({
  id: 7, merchantId: MERCHANT, name: 'Reforma de baño', currency: 'EUR',
  lines: [{ concept: 'Alicatado', qty: 1, price: 100 }], tiers: null, paymentTerms: null,
});

const escrituras = [];
inyectarBase({
  'quoteTemplate.findFirst': () => ({ ...GUARDADA }),
  'quoteTemplate.create': (args) => { escrituras.push(args); return { id: 8, ...args.data }; },
  'quoteTemplate.update': (args) => { escrituras.push(args); return { ...GUARDADA, ...args.data }; },
});

const router = moduloDeDist('../dist/modules/templates/app/routes/templates.routes.js').default;
const { CreateQuoteSchema } = moduloDeDist('../dist/core/validation/schemas.js');
const { Prisma } = moduloDeDist('@prisma/client');
const REGLA_DEL_PRESUPUESTO = CreateQuoteSchema.shape.tiers;

function handlerDe(metodo, ruta) {
  const capa = router.stack.find((l) => l.route && l.route.path === ruta && l.route.methods[metodo]);
  assert.ok(capa, `🔴 CIEGO: no encuentro ${metodo.toUpperCase()} ${ruta} en templates.routes`);
  return capa.route.stack[capa.route.stack.length - 1].handle;
}

/** Llama al handler con ese cuerpo, tal como llega de `express.json()`. */
async function pedir(metodo, cuerpo) {
  const handler = handlerDe(metodo, metodo === 'post' ? '/' : '/:id');
  escrituras.length = 0;
  const r = { status: 200, data: undefined };
  const res = { status(s) { r.status = s; return res; }, json(j) { r.data = j; return res; } };
  const body = JSON.parse(JSON.stringify(cuerpo));
  const callar = console.error; console.error = () => {};
  try {
    await handler(reqDeSesion({ rol: 'admin', merchantId: MERCHANT, params: { id: '7' }, body }), res);
  } finally { console.error = callar; }
  return { ...r, escrituras: [...escrituras] };
}

const LINEAS = [{ concept: 'Alicatado', qty: 1, price: 100 }];
const opcion = (id, extra = {}) => ({ id, label: id, lines: LINEAS, ...extra });
const TRES = [opcion('good'), opcion('better', { recommended: true }), opcion('best')];
const CUERPO_POST = { name: 'Baño', currency: 'EUR', lines: LINEAS };

const MALAS = [
  ['un objeto, no una lista', { good: TRES[0] }],
  ['un texto', 'good,better,best'],
  ['dos opciones', TRES.slice(0, 2)],
  ['cuatro opciones', [...TRES, opcion('best')]],
  ['lista vacía', []],
  ['una opción con id inventado', [TRES[0], TRES[1], opcion('premium')]],
  ['una opción sin líneas', [TRES[0], TRES[1], opcion('best', { lines: [] })]],
  ['una opción sin etiqueta', [TRES[0], TRES[1], { id: 'best', lines: LINEAS }]],
  ['una línea sin precio', [TRES[0], TRES[1], opcion('best', { lines: [{ concept: 'x', qty: 1 }] })]],
];

test('SCRUM-1545c · CONTROL: los casos malos los rechaza también el presupuesto, y el bueno lo acepta', () => {
  assert.equal(REGLA_DEL_PRESUPUESTO.safeParse(TRES).success, true, '🔴 CIEGO: el caso bueno no es bueno para el presupuesto');
  for (const [nombre, tiers] of MALAS) {
    assert.equal(REGLA_DEL_PRESUPUESTO.safeParse(tiers).success, false, `🔴 CIEGO: «${nombre}» lo acepta el presupuesto: no es un caso malo`);
  }
});

const cuerpoDe = (metodo, tiers) => (metodo === 'post' ? { ...CUERPO_POST, tiers } : { tiers });
const OK = { post: 201, put: 200 };

async function lasMalasNoSeGuardan(metodo) {
  for (const [nombre, tiers] of MALAS) {
    const r = await pedir(metodo, cuerpoDe(metodo, tiers));
    assert.equal(r.status, 400, `🔴 ${metodo} con ${nombre} responde ${r.status}: se ha guardado`);
    assert.deepEqual(r.data, { error: 'invalid_tiers' });
    assert.equal(r.escrituras.length, 0, `🔴 ${metodo} con ${nombre} ha escrito en la base`);
  }
}

async function lasBuenasSeGuardan(metodo) {
  const r = await pedir(metodo, cuerpoDe(metodo, TRES));
  assert.equal(r.status, OK[metodo], `🔴 ${metodo} con tres opciones buenas responde ${r.status}`);
  assert.equal(r.escrituras.length, 1);
  assert.deepEqual(r.escrituras[0].data.tiers, REGLA_DEL_PRESUPUESTO.parse(TRES));
}

async function elNullSigueVaciando(metodo) {
  const r = await pedir(metodo, cuerpoDe(metodo, null));
  assert.equal(r.status, OK[metodo]);
  assert.equal(r.escrituras[0].data.tiers, Prisma.DbNull);
}

test('SCRUM-1545c · POST · 🔴 una forma que el presupuesto rechaza NO se guarda: 400 invalid_tiers y ninguna escritura', () => lasMalasNoSeGuardan('post'));
test('SCRUM-1545c · PUT · 🔴 una forma que el presupuesto rechaza NO se guarda: 400 invalid_tiers y ninguna escritura', () => lasMalasNoSeGuardan('put'));
test('SCRUM-1545c · POST · tres opciones bien formadas se guardan, tal como las deja la regla del presupuesto', () => lasBuenasSeGuardan('post'));
test('SCRUM-1545c · PUT · tres opciones bien formadas se guardan, tal como las deja la regla del presupuesto', () => lasBuenasSeGuardan('put'));
test('SCRUM-1545c · POST · `tiers: null` sigue vaciando (Prisma.DbNull, SCRUM-1188d)', () => elNullSigueVaciando('post'));
test('SCRUM-1545c · PUT · `tiers: null` sigue vaciando (Prisma.DbNull, SCRUM-1188d)', () => elNullSigueVaciando('put'));

test('SCRUM-1545c · POST sin la clave `tiers` guarda la plantilla sin opciones, como siempre', async () => {
  const r = await pedir('post', CUERPO_POST);
  assert.equal(r.status, 201);
  assert.equal(r.escrituras[0].data.tiers, Prisma.DbNull);
});

test('SCRUM-1545c · PUT sin la clave `tiers` no la toca', async () => {
  const r = await pedir('put', { name: 'Baño' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.escrituras[0].data, { name: 'Baño' });
});
