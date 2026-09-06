// tests/scrum771-el-emisor-no-valida-el-tipo.test.mjs — SCRUM-771
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// EL EMISOR ACEPTABA EL TIPO DE IVA QUE LE DIERAN
//
// SCRUM-760 cerró UNA puerta —la de la voz— y dejó medido y escrito lo que faltaba:
// `invalidTipoIva` y `TIPOS_IVA_ES_BP` no aparecían ni en `invoicing/` ni en `fiscal/`. O sea que
// cualquier otra boca llegaba a la fila de la factura sin que nadie mirase el número. Y aquí ya no
// hablamos de una casilla mal pintada: hablamos de un DOCUMENTO FISCAL con un tipo de IVA que
// nadie comprobó, con su número de serie gastado.
//
// ── EL ROJO, MEDIDO POR EL CAMINO REAL Y **NO** POR LA VOZ (6-sep-2026) ───────────────────
// Por «la mano»: `POST /admin/invoices` (factura suelta), handler REAL, emisor REAL, con la BASE
// DE DATOS doblada por el punto que el propio código ofrece (`global.prisma`, `prisma.ts:13`).
//
//     tax = 1     (100 %) → HTTP 201 · factura ESCRITA · nº 2026-CF-007
//     tax = 0.15  ( 15 %) → HTTP 201 · factura ESCRITA
//     tax = 0.5   ( 50 %) → HTTP 201 · factura ESCRITA
//
// La puerta de la suelta (`facturaSuelta.ts:132`) sólo miraba el RANGO —`tax < 0 || tax > 1`—, así
// que el 100 % pasaba por el borde: `1 > 1` es falso. El 15 % ni siquiera rozaba el borde.
//
// ── DÓNDE SE VALIDA, Y POR QUÉ AHÍ ────────────────────────────────────────────────────────
// 🔴 EN EL LLAMADOR, NUNCA DENTRO DEL EMISOR. Meterlo en `invoicing/` o en `fiscal/` sería
// modificar el camino de emisión (regla 38), y eso es del fundador. Cada boca llama al portón
// justo antes de pedir número — el mismo sitio y la misma razón que `exigirLineasFacturables`
// (SCRUM-246): descubrirlo con el número ya gastado deja dos salidas y las dos son malas.
//
// ── LO QUE **NO** SE HA HECHO ─────────────────────────────────────────────────────────────
// ⛔ NO se toca `invalidTipoIva`: se DERIVA de ella. Aquí no hay una segunda lista de tipos.
// ⛔ NO se toca nada dentro de `invoicing/` ni de `fiscal/`. Leer sí; tocar no.
// ⛔ NO se toca la doble unidad de `tipoIva`. A la factura SIEMPRE llega fracción.
// ⛔ NO se añade copy de pantalla. El rechazo es FALLO CERRADO y su motivo va al log del
//    servidor; el texto que lee el profesional es microcopy y la firma el fundador (regla 30).
// ═══════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import { analizarArbol } from './_embudo-factura.mjs';
import {
  tipoIvaNoEmitible, exigirTiposDeIvaEmitibles, esErrorTipoIvaNoEmitible,
  ERROR_TIPO_IVA_NO_EMITIBLE,
} from '../dist/core/validation/tiposIvaEmitibles.js';
import { invalidTipoIva, TIPOS_IVA_ES_BP } from '../dist/core/validation/fiscalInput.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(RAIZ, 'src');

const PORTON = 'exigirTiposDeIvaEmitibles';
const EMBUDO = 'allocateInvoiceNumber';
const EMISOR = 'emitInvoice';

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 1 · EL CENSO DE BOCAS — derivado, no escrito a mano
//
// La población NO se enumera aquí: se ancla en `allocateInvoiceNumber`, y quien garantiza que
// ésa es la población COMPLETA es SCRUM-203 («ninguna creación de factura se salta el embudo»).
// Es la misma forma que usa SCRUM-246 para su portón de líneas, y por la misma razón.
//
// 🔴 Y CON UNA DIFERENCIA DELIBERADA RESPECTO A SCRUM-246: allí la lista de llamadores de
// `emitInvoice` está CABLEADA (`LLAMADORES_DE_EMIT`, dos ficheros) y el árbol tiene TRES —
// `invoicesAdmin.routes.ts` (C7-suelta) entró después y aquella lista no creció. Aquí la lista se
// DERIVA del árbol, y la comprobación es por LLAMADA y no por fichero: un fichero con dos bocas
// —que es el caso de `invoicesAdmin`— pasaría un control por fichero teniendo una sin proteger.
// ═══════════════════════════════════════════════════════════════════════════════════════════

const fuentesTs = (d, out = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) fuentesTs(p, out);
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
};
const rel = (p) => path.relative(RAIZ, p).split(path.sep).join('/');
const esFuncion = (n) => ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n)
  || ts.isArrowFunction(n) || ts.isMethodDeclaration(n);
const nombreLlamada = (n) => {
  const c = n.expression;
  return ts.isPropertyAccessExpression(c) ? c.name.text : ts.isIdentifier(c) ? c.text : null;
};

/** Posición de la primera llamada a `nombre` dentro de un nodo, o null. */
function posicionDe(nodo, nombre) {
  let pos = null;
  const v = (n) => {
    if (ts.isCallExpression(n) && nombreLlamada(n) === nombre) {
      const p = n.getStart();
      if (pos === null || p < pos) pos = p;
    }
    ts.forEachChild(n, v);
  };
  ts.forEachChild(nodo, v);
  return pos;
}

/** El texto de una propiedad de un argumento objeto, o null si no es legible. */
function propTexto(llamada, indiceArg, clave, sf) {
  const arg = llamada.arguments[indiceArg];
  if (!arg || !ts.isObjectLiteralExpression(arg)) return null;
  const p = arg.properties.find((x) => x.name && x.name.getText(sf) === clave);
  if (!p || !ts.isPropertyAssignment(p)) return null;
  return p.initializer.getText(sf);
}

/**
 * Cada boca del árbol, con su etiqueta de camino y si el portón la cubre.
 *
 * `etiqueta` sale del código (`camino:` del embudo, `origen:` del emisor) y NO de una lista de
 * aquí: si mañana nace un camino nuevo, aparece solo. Cuando no se puede leer, se marca
 * `ilegible` y el guard falla declarándose CIEGO en vez de darla por buena.
 */
function bocas() {
  const out = [];
  for (const p of fuentesTs(SRC)) {
    const sf = ts.createSourceFile(p, fs.readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const r = rel(p);
    const visitar = (n, pila) => {
      const nueva = esFuncion(n) ? [...pila, n] : pila;
      if (ts.isCallExpression(n)) {
        const nom = nombreLlamada(n);
        const tipo = nom === EMBUDO ? 'embudo' : nom === EMISOR ? 'emisor' : null;
        if (tipo) {
          const pos = n.getStart();
          let posPorton = null;
          for (const fn of nueva) {
            const q = posicionDe(fn, PORTON);
            if (q !== null && q < pos && (posPorton === null || q > posPorton)) posPorton = q;
          }
          const etiqueta = tipo === 'embudo'
            ? propTexto(n, 2, 'camino', sf)
            : propTexto(n, 1, 'origen', sf);
          out.push({
            fichero: r, tipo,
            linea: sf.getLineAndCharacterOfPosition(pos).line + 1,
            etiqueta: etiqueta === null ? null : etiqueta.replace(/['"]/g, ''),
            protegida: posPorton !== null,
          });
        }
      }
      ts.forEachChild(n, (h) => visitar(h, nueva));
    };
    ts.forEachChild(sf, (n) => visitar(n, []));
  }
  return out;
}

/**
 * LA ÚNICA EXENCIÓN POR DELEGACIÓN. `emitInvoice` es el helper compartido: recibe la transacción
 * y no ve las líneas antes que su llamador. Sus llamadores se comprueban UNO A UNO abajo.
 */
const DELEGA = 'src/modules/invoicing/domain/invoicing.service.ts';

/**
 * 🔴 LA ÚNICA EXCEPCIÓN DECLARADA, Y NO ES UN DESCUIDO: LA RECTIFICATIVA (C5).
 *
 * Medido: `invoicesAdmin.routes.ts` construye las líneas de la R1 copiando las de la ORIGINAL
 * (`{ ...l, price: -(...) }`), tipo de IVA incluido. Si una factura YA EMITIDA lleva un tipo
 * imposible —que es exactamente el daño que este ticket viene a impedir de aquí en adelante—,
 * poner el portón aquí **bloquearía la R1**, y la R1 es lo ÚNICO con lo que se corrige una
 * factura emitida (regla 29: no se edita ni se borra).
 *
 * O sea que gatear la R1 no evitaría ningún daño nuevo y dejaría el daño viejo sin arreglo
 * posible. Y no abre puerta: para meter un tipo imposible por una R1 haría falta una ORIGINAL con
 * un tipo imposible, y todas las bocas que emiten originales SÍ están gateadas.
 */
const EXCEPCION_DECLARADA = { etiqueta: 'C5', motivo: 'la rectificativa copia las líneas de la original (regla 29)' };

test('SCRUM-771 · CENSO: toda boca que emite comprueba el tipo de IVA antes de pedir número', () => {
  const todas = bocas();

  // ── SUELO · cero bocas se lee igual que «todas protegidas» ───────────────────────────────
  const delEmbudo = todas.filter((b) => b.tipo === 'embudo');
  const creaciones = analizarArbol(SRC); // el analizador OFICIAL de SCRUM-203
  assert.ok(
    creaciones.length > 0,
    '🔴 CENSO CIEGO: el analizador oficial de SCRUM-203 no ve ninguna creación de factura.',
  );
  assert.equal(
    delEmbudo.length, creaciones.length,
    `🔴 CENSO CIEGO: ${delEmbudo.length} llamadas al embudo y ${creaciones.length} creaciones de `
      + 'factura. Si no cuadran, o el embudo cambió de nombre o hay una creación que no pasa por '
      + 'él — y en los dos casos este censo ha dejado de ver el árbol entero.',
  );

  // ── ✅ CONTROL POSITIVO · el censo encuentra LA BOCA QUE YA CONOCEMOS ────────────────────
  // Es la que midió SCRUM-760: `albaranes.routes.ts` → `tax: l.tipoIva / 100` → `emitInvoice`.
  // Un censo que no la encuentre está ciego, devuelva la lista que devuelva.
  const conocida = todas.find(
    (b) => b.tipo === 'emisor'
      && b.fichero === 'src/modules/jobs/app/routes/albaranes.routes.ts'
      && b.etiqueta === 'C7-parcial',
  );
  assert.ok(
    conocida,
    '🔴 CENSO CIEGO: no encuentro la boca de SCRUM-760 (C7-parcial en albaranes.routes.ts). '
      + `Bocas vistas: ${todas.map((b) => `${b.fichero}:${b.linea}[${b.etiqueta}]`).join(', ')}`,
  );

  // ── CEGUERA DECLARADA · una boca cuyo camino no se puede leer NO se da por buena ─────────
  const ilegibles = todas
    .filter((b) => b.etiqueta === null && b.fichero !== DELEGA)
    .map((b) => `${b.fichero}:${b.linea} (${b.tipo})`);
  assert.deepEqual(
    ilegibles, [],
    '🔴 CENSO CIEGO: hay bocas cuyo `camino`/`origen` no se puede leer por AST:\n    · '
      + ilegibles.join('\n    · ')
      + '\n\n  No se dan por protegidas ni por desprotegidas: no se han podido medir. Si la '
      + 'construcción es legítima, hay que enseñarle al censo a leerla — no bajarle el listón.',
  );

  // ── EL VEREDICTO ────────────────────────────────────────────────────────────────────────
  const desprotegidas = todas
    .filter((b) => !b.protegida)
    .filter((b) => !(b.tipo === 'embudo' && b.fichero === DELEGA)) // delega: se comprueba abajo
    .filter((b) => b.etiqueta !== EXCEPCION_DECLARADA.etiqueta)
    .map((b) => `${b.fichero}:${b.linea} [${b.etiqueta}]`);

  assert.deepEqual(
    desprotegidas, [],
    '🔴 HAY UNA EMISIÓN QUE NO COMPRUEBA EL TIPO DE IVA:\n    · ' + desprotegidas.join('\n    · ')
      + `\n\n  Llama a \`${PORTON}(lineas)\` ANTES de pedir número, junto a `
      + '`exigirLineasFacturables`. Un tipo que no existe en un documento fiscal no se puede\n'
      + '  arreglar después: una factura emitida no se edita ni se borra (regla 29).\n\n'
      + '  Si tu caso es como la rectificativa —copia líneas de un documento YA emitido— no lo\n'
      + '  metas en la excepción sin hablarlo: sería declarar que hay una emisión cuyo tipo de\n'
      + '  IVA no comprueba nadie.',
  );

  // La excepción declarada tiene que SEGUIR EXISTIENDO: si desaparece, sobra la excepción.
  assert.ok(
    todas.some((b) => b.etiqueta === EXCEPCION_DECLARADA.etiqueta),
    `🔴 la excepción declarada (${EXCEPCION_DECLARADA.etiqueta}) ya no existe en el árbol: `
      + 'bórrala de aquí en vez de dejar una exención que no exime a nadie.',
  );
});

test('SCRUM-771 · la delegación no es un agujero: CADA llamador de `emitInvoice` comprueba', () => {
  const llamadores = bocas().filter((b) => b.tipo === 'emisor');

  // Derivado, no cableado. SCRUM-246 tiene aquí una lista escrita a mano que se quedó corta.
  assert.ok(
    llamadores.length >= 4,
    `🔴 CENSO CIEGO: veo ${llamadores.length} llamadas a \`${EMISOR}\` y el árbol tiene 4 caminos `
      + 'C7. Si el emisor cambió de nombre, este guard dejó de vigilar.',
  );

  const sinPorton = llamadores.filter((b) => !b.protegida).map((b) => `${b.fichero}:${b.linea} [${b.etiqueta}]`);
  assert.deepEqual(
    sinPorton, [],
    '🔴 UN LLAMADOR DE `emitInvoice` NO COMPRUEBA EL TIPO:\n    · ' + sinPorton.join('\n    · ')
      + '\n\n  `emitInvoice` está exento PORQUE delega: recibe la transacción y no ve las líneas\n'
      + '  antes que su llamador. Si un llamador deja de comprobar, la exención pasa de\n'
      + '  justificada a falsa y no hay nada que lo diga.',
  );

  // Y la comprobación es POR LLAMADA, no por fichero: `invoicesAdmin.routes.ts` tiene DOS bocas
  // (la suelta y la rectificativa) y un control por fichero pasaría con una sola protegida.
  const enInvoicesAdmin = bocas().filter((b) => b.fichero === 'src/modules/system/app/routes/invoicesAdmin.routes.ts');
  assert.ok(
    enInvoicesAdmin.length >= 2,
    '🔴 el caso que hace falta para probar que el censo mira por LLAMADA y no por fichero ha '
      + 'desaparecido del árbol (invoicesAdmin tenía dos bocas: C7-suelta y C5).',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 2 · LA REGLA, EJERCITADA — y el filo: los SIETE siguen pasando
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-771 · el portón RECHAZA el tipo imposible y NOMBRA el valor', () => {
  for (const [tax, aparece] of [[1, '100 %'], [0.15, '15 %'], [0.5, '50 %'], [21, '21']]) {
    const motivo = tipoIvaNoEmitible([{ concept: 'x', qty: 1, price: 100, tax }]);
    assert.ok(motivo, `🔴 un IVA de ${tax} pasa el portón`);
    assert.ok(
      motivo.includes(aparece),
      `🔴 el motivo no nombra el valor recibido (${tax}): «${motivo}»`,
    );
    assert.match(motivo, /línea 1/, 'y dice QUÉ línea, que es lo que lo hace accionable');
  }

  // El motivo SALE de `invalidTipoIva`: no es un segundo texto que dirá otra cosa el día que
  // aquél cambie. Es la misma prueba que se le hizo al de SCRUM-760.
  assert.equal(
    tipoIvaNoEmitible([{ tax: 1 }]),
    `línea 1: el IVA ${invalidTipoIva(1)}`,
    '🔴 el motivo NO se deriva de `invalidTipoIva`',
  );
});

test('SCRUM-771 · ✅ CONTROL POSITIVO: los SIETE tipos españoles siguen pasando, uno a uno', () => {
  // El 2 %, el 5 % y el 7,5 % están ahí A PROPÓSITO: una rectificativa puede tener que rectificar
  // una operación de aquellas ventanas. Un portón que los tirase rompería una rectificativa.
  const fracciones = [0, 0.02, 0.04, 0.05, 0.075, 0.10, 0.21];
  assert.equal(fracciones.length, TIPOS_IVA_ES_BP.size, 'se prueban los SIETE, no una selección');

  for (const f of fracciones) {
    assert.equal(
      tipoIvaNoEmitible([{ concept: 'x', qty: 1, price: 100, tax: f }]), null,
      `🔴 el tipo del ${f * 100} % ya no se puede emitir`,
    );
  }
  // Y una factura entera con los siete a la vez tampoco se cae.
  assert.equal(tipoIvaNoEmitible(fracciones.map((tax) => ({ tax }))), null);
});

test('SCRUM-771 · el portón juzga el valor QUE EL EMISOR VA A USAR, no el que venga escrito', () => {
  // `calcVatBreakdown` (`vat.service.ts:54`) hace `Number(l?.tax) || 0` y de ahí salen la base, la
  // cuota y el `CuotaTotal` que se sella. Si el portón juzgara otro valor, rechazaría líneas que
  // el sistema calcula bien — una línea exenta SIN campo `tax` es 0 % para el calculador.
  assert.equal(tipoIvaNoEmitible([{ concept: 'exenta', qty: 1, price: 10 }]), null, 'sin `tax` → 0 %');
  assert.equal(tipoIvaNoEmitible([{ tax: null }]), null);
  assert.equal(tipoIvaNoEmitible([{ tax: undefined }]), null);
  assert.equal(tipoIvaNoEmitible(null), null, 'sin líneas no hay tipo que juzgar');
  assert.equal(tipoIvaNoEmitible([]), null);
});

test('SCRUM-771 · el portón LANZA, y su error se distingue por código', () => {
  assert.doesNotThrow(() => exigirTiposDeIvaEmitibles([{ tax: 0.21 }]));

  let capturado = null;
  try { exigirTiposDeIvaEmitibles([{ tax: 1 }]); } catch (e) { capturado = e; }
  assert.ok(capturado, '🔴 no lanza: un valor se puede ignorar y un `throw` no');
  assert.equal(capturado.code, ERROR_TIPO_IVA_NO_EMITIBLE);
  assert.ok(esErrorTipoIvaNoEmitible(capturado));
  assert.ok(!esErrorTipoIvaNoEmitible(new Error('otra cosa')), 'y no confunde con cualquier error');
  assert.match(String(capturado.detalle), /100 %/, 'el detalle NOMBRA el valor');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 2 bis · 🔴 EL CONTROL QUE DECIDE — por el camino REAL, y NO por la voz
//
// Handler REAL de `POST /admin/invoices` (la factura suelta: «la mano»), emisor REAL, y la BASE
// DE DATOS doblada por el punto que el propio código ofrece — `prisma.ts` cachea su instancia en
// `global.prisma` cuando `NODE_ENV !== 'production'`. Se dobla la BD, nunca el producto.
//
// ⚠️ El router se carga con `import()` DINÁMICO y no arriba: los `import` estáticos se evalúan
// antes que cualquier línea de este fichero, así que el doble llegaría tarde y el test montaría
// un cliente de Prisma de verdad contra una base que no existe.
//
// ⛔ NO TOCA NINGUNA BASE. El `$transaction` es del doble y no hay conexión por ningún lado.
// ═══════════════════════════════════════════════════════════════════════════════════════════

const MERCHANT_DOBLE = {
  id: 71, email: 'pro@ejemplo.invalid', country: 'ES',
  flags: { INVOICING_ES_ENABLED: true }, defaultCurrency: 'EUR',
  invoiceSeriesYear: 2026, nextInvoiceNumber: 7, invoiceSeriesPrefix: 'CF',
};

/**
 * El doble se crea UNA VEZ y se reinicia entre llamadas.
 *
 * 🔴 Y no es un detalle de estilo: `prisma.ts` resuelve su instancia **una sola vez**
 * (`globalForPrisma.prisma ?? new PrismaClient()`), así que reasignar `global.prisma` en la
 * segunda llamada ya no llega a nadie — el router sigue con el primer doble. Lo aprendí viendo
 * caer el control positivo con el portón funcionando: el rojo acusaba al caso, no al producto.
 */
const ESTADO = { fila: null };
const MODELOS_DOBLE = {
  $executeRaw: async () => 1,
  merchant: { findUnique: async () => MERCHANT_DOBLE, update: async () => ({}) },
  auditLog: { create: async () => ({ id: 1 }) },
  invoice: {
    findUnique: async () => null,
    findFirst: async () => null,
    update: async ({ data }) => ({ id: 99, ...data }),
    create: async ({ data }) => {
      ESTADO.fila = data;
      return { id: 99, ...data, total: { toString: () => String(data.total) } };
    },
  },
};
globalThis.prisma = {
  ...MODELOS_DOBLE,
  customer: { findFirst: async () => ({ id: 7 }) },
  $transaction: async (cb) => cb(MODELOS_DOBLE),
};

/** Emite una factura suelta con ese tipo. Devuelve qué contestó y QUÉ SE ESCRIBIÓ (o no). */
async function emitirPorLaMano(tax) {
  ESTADO.fila = null;

  const mod = await import('../dist/modules/system/app/routes/invoicesAdmin.routes.js');
  const router = mod.default?.stack ? mod.default : mod.default?.default;
  assert.ok(router?.stack, '🔴 no he podido cargar el router de facturas: no estaría midiendo nada');
  const capa = router.stack.find((l) => l.route?.path === '/' && l.route?.methods?.post);
  assert.ok(capa, '🔴 `POST /admin/invoices` ya no existe: la boca de «la mano» cambió de sitio');
  const handler = capa.route.stack[capa.route.stack.length - 1].handle;

  let salida = null;
  const req = {
    // id INVENTADO (SCRUM-409): el demo no se comporta como un merchant normal —marca de agua,
    // política de WhatsApp por id, pasarela desviada— y un fixture ahí mediría otra cosa.
    merchantId: 71,
    user: { id: 7, role: 'admin', email: 'pro@ejemplo.invalid' },
    body: { customerId: 7, lines: [{ concept: 'Reparación de bajante', qty: 1, price: 100, tax }] },
  };
  const res = {
    status: (c) => ({ json: (b) => { salida = { http: c, body: b }; } }),
    json: (b) => { salida = { http: 200, body: b }; },
  };
  const logs = [];
  const orig = console.error;
  console.error = (...a) => logs.push(a.map(String).join(' '));
  try { await handler(req, res, () => {}); } finally { console.error = orig; }
  return { salida, fila: ESTADO.fila, logs };
}

test('SCRUM-771 · 🔴 EL CONTROL QUE DECIDE: un 100 % por «la mano» NO llega a emitirse', async () => {
  const r = await emitirPorLaMano(1);

  assert.equal(
    r.fila, null,
    '🔴 SE HA ESCRITO UNA FACTURA CON UN 100 % DE IVA. Antes de este ticket pasaba: la puerta de '
      + 'la suelta sólo miraba el RANGO (`tax > 1`), y `1 > 1` es falso, así que el 100 % entraba '
      + `por el borde. Fila escrita: ${JSON.stringify(r.fila)}`,
  );
  assert.ok(
    r.logs.some((l) => l.includes(ERROR_TIPO_IVA_NO_EMITIBLE) && l.includes('100 %')),
    '🔴 se ha rechazado sin decir por qué ni con qué valor. El motivo tiene que NOMBRAR el valor '
      + `y queda en el log del servidor, no en la pantalla. Log: ${JSON.stringify(r.logs)}`,
  );
  // FALLO CERRADO. El 500 no es una elección de producto: es lo que ya hacía el `catch` de la
  // ruta con cualquier error no tipado. Traducirlo a un 4xx con su texto es MICROCOPY y la firma
  // el fundador (regla 30) — va en su propio ticket, con marcador y caja medida.
  assert.equal(r.salida?.http, 500, 'y no se entrega documento');
});

test('SCRUM-771 · ✅ CONTROL POSITIVO por el camino real: los SIETE se emiten igual que antes', async () => {
  for (const f of [0, 0.02, 0.04, 0.05, 0.075, 0.10, 0.21]) {
    const r = await emitirPorLaMano(f);
    assert.equal(
      r.salida?.http, 201,
      `🔴 el ${f * 100} % ha dejado de emitirse: HTTP ${r.salida?.http} `
        + `${JSON.stringify(r.salida?.body)} · log: ${JSON.stringify(r.logs)}`,
    );
    assert.ok(r.fila, `🔴 el ${f * 100} % contesta 201 y NO escribe factura`);
    assert.equal(r.fila.lines[0].tax, f, `🔴 el ${f * 100} % llega alterado a la fila`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 3 · EL TRINQUETE · la lista de tipos sigue viviendo en UN solo fichero
//
// Todo lo de arriba seguiría verde el día que alguien copie la lista dentro del portón: las dos
// copias empezarían a separarse en silencio, y la que se quede atrás acabará admitiendo un tipo
// que no existe o tirando uno que sí. Se mide por AST, que es lo único que distingue «llama a la
// regla» de «trae la regla dentro».
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-771 · la lista de tipos españoles vive en UN solo fichero de `src/`', () => {
  const ficheros = fuentesTs(SRC);
  assert.ok(ficheros.length > 100, `🔴 CENSO CIEGO: sólo ${ficheros.length} ficheros .ts en src/`);

  const declaran = ficheros.filter((p) => {
    const sf = ts.createSourceFile(path.basename(p), fs.readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true);
    let hay = false;
    const v = (n) => {
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'TIPOS_IVA_ES_BP') hay = true;
      ts.forEachChild(n, v);
    };
    ts.forEachChild(sf, v);
    return hay;
  }).map(rel);

  assert.deepEqual(
    declaran, ['src/core/validation/fiscalInput.ts'],
    '🔴 la lista de tipos de IVA españoles está declarada en más de un sitio (o en ninguno, y '
      + 'entonces este censo está ciego). El portón de emisión DERIVA de `invalidTipoIva`: si '
      + 'alguien le mete su propia lista, las dos derivan y una acaba emitiendo un tipo que no '
      + 'existe.',
  );
});

test('SCRUM-771 · el portón LLAMA a `invalidTipoIva`, no reimplementa la regla', () => {
  const fuente = fs.readFileSync(path.join(SRC, 'core/validation/tiposIvaEmitibles.ts'), 'utf8');
  const sf = ts.createSourceFile('tiposIvaEmitibles.ts', fuente, ts.ScriptTarget.Latest, true);
  const llamadas = [];
  const v = (n) => {
    if (ts.isCallExpression(n)) llamadas.push(n.expression.getText(sf));
    ts.forEachChild(n, v);
  };
  ts.forEachChild(sf, v);

  assert.ok(
    llamadas.includes('invalidTipoIva'),
    `🔴 el portón no consulta la regla fiscal. Llama a: [${[...new Set(llamadas)].join(', ')}]`,
  );
});
