// tests/scrum841-el-escritor-del-albaran.test.mjs — SCRUM-841
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// EL CLIENTE DE UN ALBARÁN EMITIDO SE ESCRIBE AL EMITIRLO.
//
// `albaranes` tenía desde SCRUM-729 (paso 6) las mismas cinco columnas de congelado que
// `invoices` y el mismo hueco: **no las escribía nadie**. PASO 0 medido el 15-sep-2026 con el
// handler REAL y `prisma` de doble — lo que llegaba a la base al emitir era exactamente
// `{"estado":"emitido"}`, cero de cinco.
//
// Sin gate y SIN BASE: se invoca `POST /admin/albaranes/:id/emitir` de verdad (patrón
// SCRUM-302 / SCRUM-263 / SCRUM-257b) y se captura el `data` que llega a `albaran.update`.
// Ni una firma se ha cambiado para poder mirar.
//
// ── LOS CONTROLES, Y CUÁL DECIDE ──────────────────────────────────────────────────────────────
//
//   ① POSITIVO ............. emitir escribe los CINCO, con los valores de la ficha de ENTONCES.
//   ② SIN LISTA A MANO ..... los cinco nombres salen de `CAMPOS_CONGELADOS`, no de un literal
//                            copiado aquí: el día que haya un sexto, este test lo exige solo.
//   ③ 🔴 EL INSTRUMENTO SABE FALLAR ... el mismo comprobador, contra el `data` de ANTES del
//                            ticket (`{estado:'emitido'}`), tiene que decir que faltan los cinco.
//                            Sin esto, ① podría estar verde sin comprobar nada.
//   ④ 🔴 EL QUE DECIDE ..... el segundo POST **no re-congela**. Un reintento que reescribiera el
//                            retrato con la ficha de hoy es el defecto entero por la otra puerta:
//                            el documento seguiría cambiando solo, y encima sin que nadie emita.
//   ⑤ REGLA 2 ............. la ficha se lee filtrando por el merchant del request.
//   ⑥ SIN PUERTA LATERAL ... ningún otro `albaran.update` de `src/` pone `estado: 'emitido'`.
//   ⑦ CONTROL POSITIVO DE ⑥ . sobre una fuente sintética con la fuga dentro, el guard la ve.
//
// ── LO QUE ESTE TEST **NO** AFIRMA ────────────────────────────────────────────────────────────
//
// No afirma que ningún documento IMPRIMA la columna: no hay lector todavía, y es deliberado
// (`albaranEmision.ts`). El PDF sigue resolviendo por `contenidoSegunVersion` exactamente igual
// que ayer. Tampoco toca el sobre de la firma, que congela su propio `cliente` al FIRMAR.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

import { telefonoDePrueba } from '../scripts/_telefonos-prueba.mjs'; // SCRUM-262: rango imposible

const RAIZ = path.resolve(import.meta.dirname, '..');
const DIST = '../dist/';

// 🔴 LOS CINCO NOMBRES NO SE ESCRIBEN AQUÍ. Salen del módulo que los define (SCRUM-729): una
// segunda lista en el test es una segunda fuente, y se queda atrás sin que nadie lo note.
const { CAMPOS_CONGELADOS } = await import(DIST + 'modules/invoicing/domain/clienteCongelado.js');
const { datosDeAlbaranEmitido } = await import(DIST + 'modules/jobs/domain/albaranEmision.js');
const moduloPrisma = await import(DIST + 'core/db/prisma.js');
const routerDe = (mod) => mod.default?.default ?? mod.default;

// ── el mundo de la prueba ─────────────────────────────────────────────────────────────────────

/** La ficha del cliente EL DÍA EN QUE SE EMITE. */
const FICHA_DE_ENTONCES = {
  name: 'Ferretería Pepe',
  legalName: 'Ferretería Pepe SL',
  taxId: 'B99999999',
  email: 'pepe@ferre.test',
  phone: telefonoDePrueba(2),
};

const ALBARAN_BORRADOR = {
  id: 7, merchantId: 7, jobId: 42, numero: 'ALB-2026-0003',
  fecha: new Date('2026-09-15T10:00:00Z'), modoValoracion: 'SIN_VALORAR',
  lineas: [{ concepto: 'Bajante PVC 110', cantidad: 3, unidad: 'm' }],
  estado: 'borrador', version: 1, signatureUrl: null, firmadoAt: null,
  evidenciaFirma: null, notas: null, pdfUrl: null, invoiceId: null,
  customerName: null, customerLegalName: null, customerTaxId: null,
  customerEmail: null, customerPhone: null,
};

/**
 * Invoca el handler REAL y devuelve lo que llegó a la base y a quién se le preguntó.
 *
 * ⚠️ CONTROL POSITIVO DENTRO: si la ruta no existiera, esto FALLA nombrándolo en vez de devolver
 * un «no escribió nada» que no ha comprobado nada.
 */
async function invocarEmitir(albaran, ficha = FICHA_DE_ENTONCES) {
  let dataDelUpdate = null;
  let whereDeLaFicha = null;
  let vecesQueSeActualizo = 0;

  moduloPrisma.prisma.albaran = {
    findFirst: async () => albaran,
    update: async ({ data }) => {
      vecesQueSeActualizo += 1;
      dataDelUpdate = data;
      return { ...albaran, ...data };
    },
  };
  moduloPrisma.prisma.job = {
    findFirst: async () => ({ id: albaran.jobId, merchantId: albaran.merchantId, customerId: 5 }),
  };
  moduloPrisma.prisma.customer = {
    findFirst: async ({ where }) => { whereDeLaFicha = where; return ficha; },
  };

  const router = routerDe(await import(DIST + 'modules/jobs/app/routes/albaranes.routes.js'));
  const capa = router.stack.find((l) => l.route?.path === '/:id/emitir' && l.route?.methods?.post);
  assert.ok(capa, '🔴 NO EXISTE POST /:id/emitir. Sin endpoint no hay nada que medir aquí.');

  let salida = null;
  const res = {
    status(c) { this._c = c; return this; },
    json(b) { salida = { code: this._c ?? 200, body: b }; return this; },
    setHeader() { return this; },
  };
  const hs = capa.route.stack;
  await hs[hs.length - 1].handle(
    { params: { id: String(albaran.id) }, body: {}, merchantId: albaran.merchantId, query: {}, headers: {} },
    res, () => {},
  );
  return { salida, dataDelUpdate, whereDeLaFicha, vecesQueSeActualizo };
}

/** EL COMPROBADOR, uno solo: lo usan ① y ③, y por eso ③ demuestra que ① discrimina. */
function camposCongeladosQueFaltan(data) {
  return CAMPOS_CONGELADOS.filter((c) => !data || !Object.prototype.hasOwnProperty.call(data, c));
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ① POSITIVO
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-841 · ① emitir un albarán escribe los CINCO campos del cliente', async () => {
  const { salida, dataDelUpdate } = await invocarEmitir(ALBARAN_BORRADOR);

  assert.equal(salida?.code, 200, `🔴 no se emitió: ${JSON.stringify(salida)}`);
  assert.ok(dataDelUpdate, '🔴 no se llamó a `albaran.update`');
  assert.equal(dataDelUpdate.estado, 'emitido', '🔴 la transición de estado se perdió');

  assert.deepEqual(camposCongeladosQueFaltan(dataDelUpdate), [],
    '🔴 SE EMITE EL ALBARÁN Y NO SE CONGELA EL CLIENTE. Es el defecto de SCRUM-841: las columnas '
    + 'están aplicadas desde SCRUM-729 y el documento entregado sigue reimprimiendo la ficha de HOY.');

  // Y los VALORES son los de la ficha de entonces, no cualquier cosa con la forma correcta.
  assert.equal(dataDelUpdate.customerName, FICHA_DE_ENTONCES.name);
  assert.equal(dataDelUpdate.customerLegalName, FICHA_DE_ENTONCES.legalName);
  assert.equal(dataDelUpdate.customerTaxId, FICHA_DE_ENTONCES.taxId);
  assert.equal(dataDelUpdate.customerEmail, FICHA_DE_ENTONCES.email);
  assert.equal(dataDelUpdate.customerPhone, FICHA_DE_ENTONCES.phone);
});

test('SCRUM-841 · ② los cinco nombres se DERIVAN, no se copian', async () => {
  // Si alguien añade un sexto campo congelado a `clienteCongelado.ts`, ① empieza a exigirlo sin
  // que haya que acordarse de tocar este fichero. Aquí sólo se comprueba que la fuente es esa.
  assert.ok(CAMPOS_CONGELADOS.length >= 5, '🔴 la fuente de nombres se quedó vacía o corta');
  const { dataDelUpdate } = await invocarEmitir(ALBARAN_BORRADOR);
  for (const campo of CAMPOS_CONGELADOS) {
    assert.ok(Object.prototype.hasOwnProperty.call(dataDelUpdate, campo), `🔴 falta ${campo}`);
  }
  // El helper y la ruta escriben EL MISMO conjunto: comparación de conjuntos, no de cuentas.
  const delHelper = Object.keys(datosDeAlbaranEmitido({
    customerName: 'x', customerLegalName: null, customerTaxId: null, customerEmail: null, customerPhone: null,
  })).sort();
  assert.deepEqual(
    delHelper,
    ['customerEmail', 'customerLegalName', 'customerName', 'customerPhone', 'customerTaxId', 'estado'],
    '🔴 el helper dejó de escribir el conjunto que se espera de él');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ③ EL INSTRUMENTO SABE FALLAR — sin esto, ① no vale
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-841 · 🔴 ③ el comprobador de ① DISTINGUE: contra el mundo de antes, cae', () => {
  // Esto es literalmente lo que el handler mandaba a la base antes de este ticket, medido.
  const DATA_DE_ANTES = { estado: 'emitido' };
  const faltan = camposCongeladosQueFaltan(DATA_DE_ANTES);
  assert.deepEqual(faltan, [...CAMPOS_CONGELADOS],
    '🔴 EL COMPROBADOR NO DISCRIMINA: da por bueno el `data` de antes del ticket, así que el '
    + 'verde de ① no significa nada. Un control que no puede fallar no es un control.');
  // Y sobre el vacío absoluto también, para que no dependa de la forma del objeto.
  assert.equal(camposCongeladosQueFaltan(null).length, CAMPOS_CONGELADOS.length);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ④ EL QUE DECIDE — el reintento no puede reescribir el retrato
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-841 · 🔴 ④ el segundo POST NO re-congela: un albarán ya emitido no se toca', async () => {
  const YA_EMITIDO = {
    ...ALBARAN_BORRADOR,
    estado: 'emitido',
    customerName: 'Ferretería Pepe',
    customerLegalName: 'Ferretería Pepe SL',
    customerTaxId: 'B99999999',
    customerEmail: 'pepe@ferre.test',
    customerPhone: telefonoDePrueba(2),
  };
  // La ficha ha CAMBIADO desde que se emitió. Si el reintento re-congelara, el documento pasaría
  // a declarar un cliente que el día de la entrega no constaba.
  const FICHA_DE_HOY = {
    name: 'Ferretería Pepe e Hijos',
    legalName: 'Ferretería Pepe e Hijos SL',
    taxId: 'B11111111',
    email: 'nuevo@ferre.test',
    phone: telefonoDePrueba(3),
  };

  const { salida, vecesQueSeActualizo, dataDelUpdate } = await invocarEmitir(YA_EMITIDO, FICHA_DE_HOY);

  assert.equal(salida?.code, 200, '🔴 el reintento debe seguir siendo idempotente y devolver 200');
  assert.equal(vecesQueSeActualizo, 0,
    '🔴 EL REINTENTO REESCRIBE. Un segundo POST sobre un albarán ya emitido volvió a tocar la fila: '
    + 'el retrato pasaría a ser el de HOY y el documento cambiaría solo, sin que nadie lo emita.');
  assert.equal(dataDelUpdate, null, '🔴 llegó un `data` a la base en un camino que no debe escribir');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ⑤ REGLA 2
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-841 · ⑤ la ficha se lee filtrando por merchant (regla 2)', async () => {
  const { whereDeLaFicha } = await invocarEmitir(ALBARAN_BORRADOR);
  assert.ok(whereDeLaFicha, '🔴 no se leyó ninguna ficha de cliente');
  assert.equal(whereDeLaFicha.merchantId, ALBARAN_BORRADOR.merchantId,
    '🔴 SIN FILTRO DE MERCHANT. El nombre y el NIF de un cliente de otro profesional podrían '
    + 'quedar congelados dentro de un documento entregado.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ⑥ + ⑦ SIN PUERTA LATERAL — por AST, nunca por texto (SCRUM-203)
// ═══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Busca `*.albaran.update({ ... data: { estado: 'emitido' ... } })` escrito A MANO.
 *
 * Por AST y no por `grep` por el motivo de SCRUM-203: un guard de texto se caza a sí mismo en el
 * comentario que explica la prohibición, y aquí ese comentario existe.
 */
function fugasDeEstadoEmitido(codigo, nombre) {
  const sf = ts.createSourceFile(nombre, codigo, ts.ScriptTarget.Latest, true);
  const fugas = [];
  (function visitar(n) {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
      && n.expression.name.getText() === 'update'
      && /(^|\.)albaran$/.test(n.expression.expression.getText())) {
      const arg = n.arguments[0];
      if (arg && ts.isObjectLiteralExpression(arg)) {
        for (const prop of arg.properties) {
          if (!ts.isPropertyAssignment(prop) || prop.name.getText() !== 'data') continue;
          if (!ts.isObjectLiteralExpression(prop.initializer)) continue; // pasa por un helper
          for (const campo of prop.initializer.properties) {
            if (ts.isPropertyAssignment(campo) && campo.name.getText() === 'estado'
              && ts.isStringLiteral(campo.initializer) && campo.initializer.text === 'emitido') {
              const { line } = sf.getLineAndCharacterOfPosition(campo.getStart());
              fugas.push(`${nombre}:${line + 1}`);
            }
          }
        }
      }
    }
    ts.forEachChild(n, visitar);
  })(sf);
  return fugas;
}

function ficherosTs(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficherosTs(p, acc);
    else if (e.name.endsWith('.ts')) acc.push(p);
  }
  return acc;
}

test('SCRUM-841 · ⑥ ningún otro sitio de src/ emite un albarán a mano', () => {
  const ficheros = ficherosTs(path.join(RAIZ, 'src'));
  assert.ok(ficheros.length > 100, `🔴 el censo sólo vio ${ficheros.length} ficheros: está ciego`);

  const fugas = ficheros.flatMap((f) => fugasDeEstadoEmitido(
    fs.readFileSync(f, 'utf8'), path.relative(RAIZ, f).replace(/\\/g, '/')));

  assert.deepEqual(fugas, [],
    '🔴 HAY UN EMISOR DE ALBARANES QUE NO PASA POR `datosDeAlbaranEmitido`, y por tanto emite con '
    + 'las cinco columnas del cliente a NULL:\n  ' + fugas.join('\n  '));
});

test('SCRUM-841 · 🔴 ⑦ CONTROL POSITIVO: el guard ⑥ ve la fuga cuando la hay', () => {
  // Fuente sintética: si el guard no la caza, su cero de arriba era «no he mirado».
  const CON_FUGA = `
    async function emitirPorLaPuertaDeAtras(prisma, id) {
      return prisma.albaran.update({ where: { id }, data: { estado: 'emitido' } });
    }
  `;
  const vistas = fugasDeEstadoEmitido(CON_FUGA, 'sintetico.ts');
  assert.equal(vistas.length, 1,
    '🔴 EL GUARD ⑥ ESTÁ CIEGO: no ve un `albaran.update` con `estado: emitido` escrito a mano, '
    + 'así que su lista vacía no significa que no haya puertas laterales.');

  // Y el negativo del control: lo que SÍ pasa por el helper no se cuenta como fuga.
  const SIN_FUGA = `
    async function emitirBien(prisma, id, cliente) {
      return prisma.albaran.update({ where: { id }, data: datosDeAlbaranEmitido(cliente) });
    }
  `;
  assert.deepEqual(fugasDeEstadoEmitido(SIN_FUGA, 'sintetico2.ts'), [],
    '🔴 el guard marca como fuga el camino correcto: daría un rojo permanente sin defecto detrás.');
});
