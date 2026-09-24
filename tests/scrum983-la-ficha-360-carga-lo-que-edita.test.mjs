// tests/scrum983-la-ficha-360-carga-lo-que-edita.test.mjs — SCRUM-983
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EDITAR SÓLO LA NOTA DESDE LA FICHA 360 BORRABA SEIS DATOS DEL CLIENTE
//
// Medido en staging el 21-sep-2026 (`3ac838a5`), con una sonda en navegador: un cliente con todo
// relleno → ficha 360 → Editar → se escribe SÓLO en Notas → Guardar. El PUT salió con
// `taxId:null, legalName:null, companyId:null, contactKind:null, tipoDestinatario:null` y
// `billingPeriodicity:"NINGUNA"`, y el cliente perdió los seis. Sin error y sin aviso.
//
// La causa son DOS eslabones, y por eso aquí hay dos mitades:
//   · el SERVIDOR: `GET /admin/customers/:id/detail` seleccionaba 9 campos y ninguno de esos seis,
//     así que el modal los rellenaba VACÍOS;
//   · el FRONT: el modal mandaba lo que había en el control aunque no lo hubiera cargado nunca,
//     y un control vacío viaja como `null`, que Prisma escribe.
// Cualquiera de las dos por separado vuelve a abrir el hueco el día que alguien añada un campo
// al modal sin añadirlo al `select`.
//
// 🔴 POR QUÉ SCRUM-692 NO LO CAZÓ, y es la lección entera. Su propiedad era «un formulario sólo
// envía lo que MUESTRA»: cada clave del payload tiene que leer un control. Y aquí el control
// EXISTÍA —el campo NIF se ve en el modal—; lo que faltaba es que se hubiera LLENADO con el dato de
// verdad. El guard era más débil que el contrato: medía que hubiera control, no que el control
// tuviera el valor que el profesional tiene guardado. Por eso este fichero no toca el suyo: le
// añade la mitad que le faltaba.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { telefonoDePrueba } from '../scripts/_telefonos-prueba.mjs'; // SCRUM-262: el rango imposible

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUTA = 'src/modules/system/app/routes/customersAdmin.routes.ts';
const FICHA = 'public/dashboard/js/customerDetailView.js';

// Los seis que se perdían, medidos. Se escriben aquí y no se deducen: son el testigo del defecto.
const LOS_SEIS = ['taxId', 'legalName', 'companyId', 'contactKind', 'tipoDestinatario', 'billingPeriodicity'];

/** Las claves del `select` del cliente en `GET /:id/detail`, leídas por AST del TS. */
function camposDelDetail() {
  const src = fs.readFileSync(path.join(RAIZ, RUTA), 'utf8');
  const sf = ts.createSourceFile(RUTA, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let handler = null;
  (function walk(n) {
    if (!handler && ts.isCallExpression(n) && n.expression.getText() === 'router.get'
        && n.arguments[0] && ts.isStringLiteral(n.arguments[0]) && n.arguments[0].text === '/:id/detail') {
      handler = n;
    }
    n.forEachChild(walk);
  })(sf);
  if (!handler) return null;
  let claves = null;
  (function walk(n) {
    if (claves) return;
    if (ts.isCallExpression(n) && /prisma\.customer\.findFirst$/.test(n.expression.getText())) {
      const arg = n.arguments[0];
      const sel = arg && ts.isObjectLiteralExpression(arg)
        && arg.properties.find((p) => p.name && p.name.getText() === 'select');
      if (sel && ts.isPropertyAssignment(sel) && ts.isObjectLiteralExpression(sel.initializer)) {
        claves = sel.initializer.properties.map((p) => p.name.getText());
      }
    }
    n.forEachChild(walk);
  })(handler);
  return claves;
}

/** Los campos `customer.X` con los que el modal de edición de la ficha 360 rellena sus controles. */
function camposQueRellenaElModal() {
  const src = fs.readFileSync(path.join(RAIZ, FICHA), 'utf8');
  const sf = ts.createSourceFile(FICHA, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let fn = null;
  (function walk(n) {
    if (!fn && ts.isFunctionDeclaration(n) && n.name && n.name.text === 'openEdit360Modal') fn = n;
    n.forEachChild(walk);
  })(sf);
  if (!fn) return null;
  const leidos = new Set();
  (function walk(n) {
    if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'customer') {
      leidos.add(n.name.text);
    }
    n.forEachChild(walk);
  })(fn);
  return [...leidos].sort();
}

// ═══ ① SUELO ═════════════════════════════════════════════════════════════════════════════

test('SCRUM-983 · 🔴 SUELO: los dos extractores VEN lo que tienen que ver', () => {
  const detail = camposDelDetail();
  assert.ok(Array.isArray(detail), `🔴 CIEGO: no encuentro el \`select\` del cliente en GET /:id/detail (${RUTA}).`);
  assert.ok(detail.length >= 9, `🔴 CIEGO: el select del /detail sólo tiene ${detail.length} claves; tenía 9 antes de este ticket.`);
  const modal = camposQueRellenaElModal();
  assert.ok(Array.isArray(modal), '🔴 CIEGO: no encuentro `openEdit360Modal` en la ficha 360.');
  assert.ok(modal.length >= 10, `🔴 CIEGO: el modal sólo lee ${modal.length} campos del cliente, y rellena al menos 10.`);
  // Control positivo por nombre: los dos ven `name`, y el modal ve los seis del defecto.
  assert.ok(detail.includes('name') && modal.includes('name'), '🔴 CIEGO: ninguno ve «name».');
  for (const k of LOS_SEIS) assert.ok(modal.includes(k), `🔴 CIEGO: el extractor del modal no ve «customer.${k}», que el modal SÍ lee.`);
});

// ═══ ② EL SERVIDOR: lo que el modal rellena, el /detail lo trae ════════════════════════

test('SCRUM-983 · 🔴 todo campo con el que el modal de la ficha 360 RELLENA un control viene en el /detail', () => {
  const detail = new Set(camposDelDetail());
  const faltan = camposQueRellenaElModal().filter((k) => !detail.has(k));
  assert.deepEqual(faltan, [],
    '🔴 EL MODAL DE LA FICHA 360 RELLENA CONTROLES CON CAMPOS QUE EL /detail NO TRAE:\n    ' + faltan.join(', ') +
    '\n\n  Cada uno se pinta VACÍO en el modal aunque el cliente lo tenga guardado, y al pulsar Guardar' +
    '\n  el vacío viaja y BORRA el dato. Medido en staging el 21-sep-2026: editar sólo la nota borró' +
    '\n  el NIF, la razón social, el vínculo con la empresa, la forma jurídica, el tipo de' +
    `\n  destinatario y la periodicidad. Añade el campo al \`select\` de ${RUTA} (GET /:id/detail).`);
});

// ═══ ④ SCRUM-1033 · la cabecera de la ficha 360 también necesita sus campos en el /detail ══

// Los siete que pide SCRUM-1033: etiquetas, dirección (5) y referencia interna.
const LOS_SIETE_DE_1033 = ['tags', 'billingAddress', 'billingCity', 'billingPostalCode', 'billingProvince', 'billingCountry', 'internalRef'];

test('SCRUM-1033 · 🔴 el select del /detail trae etiquetas, dirección y referencia interna', () => {
  const detail = new Set(camposDelDetail());
  const faltan = LOS_SIETE_DE_1033.filter((k) => !detail.has(k));
  assert.deepEqual(faltan, [],
    '🔴 LA CABECERA DE LA FICHA 360 (SCRUM-1033) PINTA CHIPS DE CAMPOS QUE EL /detail NO TRAE:\n    '
    + faltan.join(', ') + `\n\n  Añádelos al \`select\` de ${RUTA} (GET /:id/detail).`);
});

// ═══ ⑤ SCRUM-1033 · un técnico (u otro merchant) no ve el cliente ajeno a través del /detail ══
//
// AST, no DB (A2/A3): el mismo camino que ya usan los censos de tenencia de SCRUM-289/348 —
// el filtro se lee del TEXTO, literal, no se ejecuta contra una base. Amplía el `select` no
// tiene que poder ensanchar el `where`: sigue siendo el mismo cliente, del mismo merchant.
test('SCRUM-1033 · 🔴 el `where` del /detail sigue filtrando por `merchantId: req.merchantId` (no se ve el cliente ajeno)', () => {
  const src = fs.readFileSync(path.join(RAIZ, RUTA), 'utf8');
  const sf = ts.createSourceFile(RUTA, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let handler = null;
  (function walk(n) {
    if (!handler && ts.isCallExpression(n) && n.expression.getText() === 'router.get'
        && n.arguments[0] && ts.isStringLiteral(n.arguments[0]) && n.arguments[0].text === '/:id/detail') {
      handler = n;
    }
    n.forEachChild(walk);
  })(sf);
  assert.ok(handler, '🔴 CIEGO: no encuentro el handler de GET /:id/detail.');

  let where = null;
  (function walk(n) {
    if (where) return;
    if (ts.isCallExpression(n) && /prisma\.customer\.findFirst$/.test(n.expression.getText())) {
      const arg = n.arguments[0];
      const w = arg && ts.isObjectLiteralExpression(arg)
        && arg.properties.find((p) => p.name && p.name.getText() === 'where');
      if (w && ts.isPropertyAssignment(w) && ts.isObjectLiteralExpression(w.initializer)) where = w.initializer;
    }
    n.forEachChild(walk);
  })(handler);
  assert.ok(where, '🔴 CIEGO: no encuentro el `where` de `prisma.customer.findFirst` en /:id/detail.');

  const merchantIdProp = where.properties.find((p) => p.name && p.name.getText() === 'merchantId');
  assert.ok(merchantIdProp, '🔴 EL `where` DEL /detail YA NO FILTRA POR `merchantId`: un cliente de otro merchant sería visible.');
  assert.equal(merchantIdProp.initializer.getText(), 'req.merchantId',
    `🔴 EL \`where\` DEL /detail FILTRA POR ALGO QUE NO ES \`req.merchantId\` (es \`${merchantIdProp.initializer.getText()}\`): la tenencia se rompe.`);
});

// ═══ ③ EL FRONT, POR EFECTO: lo que no se cargó no viaja ════════════════════════════════

/** Monta la ficha 360 de verdad con el `customer` dado, edita SÓLO la nota y devuelve el PUT. */
async function guardarSoloLaNota(customer) {
  const peticiones = [];
  const banco = cargarDashboard(RAIZ, {
    datos: (url, opciones) => {
      const u = String(url || '');
      peticiones.push({ url: u, opciones });
      if (/\/admin\/customers\/\d+\/detail$/.test(u)) {
        return { customer, quotes: [], invoices: [], events: [], stats: { totalQuotes: 0, acceptedQuotes: 0, totalBilled: 0, totalPaid: 0, totalExpenses: 0, profit: 0 } };
      }
      if (/\/admin\/customers\/\d+$/.test(u)) return { ...customer };
      return [];
    },
  });
  assert.deepEqual(banco.fallos, [], 'un script del panel no cargó: nada de lo de abajo mediría');
  const r = await pintarVista(banco, 'renderCustomer360View', customer.id);
  assert.equal(r.error, null, `la ficha 360 no montó: ${r.error && r.error.message}`);

  const porId = (id) => todos(banco.ctx.document.body).find((n) => n.id === id) || null;
  const editar = porId('btn-edit-360');
  assert.ok(editar && typeof editar.onclick === 'function', '🔴 CIEGO: no encuentro el botón «Editar» de la ficha 360 con su oyente.');
  editar.onclick();
  const notas = porId('e360-notes');
  assert.ok(notas, '🔴 CIEGO: pulsar «Editar» no abrió el modal (no hay #e360-notes).');
  notas.value = 'timbre roto';
  const guardar = porId('e360-save');
  assert.ok(guardar && typeof guardar.onclick === 'function', '🔴 CIEGO: el modal no tiene «Guardar cambios» con su oyente.');
  await guardar.onclick();
  for (let i = 0; i < 20; i++) await new Promise((res) => setImmediate(res));

  const put = peticiones.find((p) => p.opciones?.method === 'PUT' && /\/admin\/customers\/\d+$/.test(p.url));
  assert.ok(put, `🔴 pulsar Guardar no produjo un PUT. Peticiones: ${JSON.stringify(peticiones.map((p) => p.url))}`);
  return JSON.parse(put.opciones.body);
}

const CLIENTE_COMPLETO = {
  id: 3929, name: 'Cliente QA 983', phone: telefonoDePrueba(983), mobile: null, email: 'qa983@example.test',
  notes: 'nota vieja', portalToken: null, createdAt: '2026-09-01T00:00:00.000Z', waOptOut: false,
  taxId: '12345678Z', legalName: 'Razón Social QA', companyId: 3928, contactKind: 'PERSONA',
  tipoDestinatario: 'EMPRESARIO', billingPeriodicity: 'MENSUAL',
};

test('SCRUM-983 · 🔴 POR EFECTO: con lo que el /detail trae HOY, editar sólo la nota NO cambia los seis', async () => {
  // El `customer` se construye con EXACTAMENTE las claves que el `select` del /detail devuelve: el
  // banco hace de servidor, pero el contrato lo pone el servidor de verdad, leído por AST.
  const claves = camposDelDetail();
  const customer = Object.fromEntries(claves.map((k) => [k, CLIENTE_COMPLETO[k] ?? null]));
  const put = await guardarSoloLaNota(customer);

  // Control positivo: la nota SÍ viaja. Sin esto, un modal que no mandara nada pasaría todo.
  assert.equal(put.notes, 'timbre roto', '🔴 CONTROL POSITIVO ROTO: la nota no ha viajado; el guardado no mide nada.');

  const cambiados = LOS_SEIS.filter((k) => k in put && put[k] !== CLIENTE_COMPLETO[k]);
  assert.deepEqual(cambiados.map((k) => `${k}: ${JSON.stringify(CLIENTE_COMPLETO[k])} → ${JSON.stringify(put[k])}`), [],
    '🔴 EDITAR SÓLO LA NOTA DESDE LA FICHA 360 SOBRESCRIBE DATOS DEL CLIENTE. El PUT lleva:\n    '
    + cambiados.map((k) => `${k}: ${JSON.stringify(CLIENTE_COMPLETO[k])} → ${JSON.stringify(put[k])}`).join('\n    '));
});

test('SCRUM-983 · 🔴 POR EFECTO: un campo que el modal NO cargó no viaja (ausente ≠ null)', async () => {
  // La segunda mitad, independiente del servidor: aunque el /detail vuelva a perder un campo, el
  // modal no puede convertir «no lo sé» en «bórralo».
  const { taxId, legalName, companyId, ...sinLosTres } = CLIENTE_COMPLETO;
  const put = await guardarSoloLaNota(sinLosTres);
  assert.equal(put.notes, 'timbre roto', '🔴 CONTROL POSITIVO ROTO: la nota no ha viajado.');
  const viajan = ['taxId', 'legalName', 'companyId'].filter((k) => k in put);
  assert.deepEqual(viajan, [],
    '🔴 EL MODAL MANDA CAMPOS QUE NUNCA CARGÓ: ' + viajan.map((k) => `${k}=${JSON.stringify(put[k])}`).join(', ')
    + '\n  El control estaba vacío porque el dato no llegó, no porque el profesional lo vaciara, y'
    + '\n  un `null` en el PUT lo BORRA. Lo que no se cargó, no viaja.');
  // Y lo que SÍ se cargó sigue viajando: vaciar a propósito tiene que seguir siendo posible (SCRUM-692 ⑤).
  assert.ok('contactKind' in put && 'tipoDestinatario' in put && 'billingPeriodicity' in put,
    '🔴 el modal ha dejado de mandar campos que SÍ cargó: entonces ya no se pueden editar.');
});
