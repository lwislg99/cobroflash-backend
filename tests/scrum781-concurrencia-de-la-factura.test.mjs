// tests/scrum781-concurrencia-de-la-factura.test.mjs — SCRUM-781
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 DIEZ FACTURAS EMITIDAS A LA VEZ — la carrera del EMISOR, provocada y no inferida
//
// Nace de un hueco que declaré yo misma al cerrar SCRUM-592: *«El emisor usa el mismo
// `pg_advisory_xact_lock` y el mismo `SERIE_LOCK_NS` —leído, no supuesto—, pero eso es una
// inferencia, no una medición: no hay un test que ponga diez emisiones de factura a competir.»*
//
// ── ⚠️ Y ME CORRIJO, PORQUE EL HUECO ESTABA MAL DECLARADO ───────────────────────────────
//
// **DOS emisiones concurrentes SÍ estaban probadas**: `scrum234-carrera-serie.gated.test.mjs`
// las provocó el 02-ago-2026, en los DOS sentidos (sin cerrojo → `P2002`; con cerrojo → números
// consecutivos), tres veces cada uno. Lo que NO existía es:
//
//   · **DIEZ** a la vez — que es donde la cola del cerrojo se nota;
//   · y la medición del **coste**, que es la pregunta que decide si esto es urgente o teórico.
//
// ── POR QUÉ ESTE FICHERO NO REUTILIZA AQUÉL ─────────────────────────────────────────────
//
// 🔴 Porque `scrum234-carrera-serie.gated.test.mjs` importa `./_staging-db.mjs`: apunta a
// STAGING. Este encargo prohíbe ejecutar nada contra staging, así que **no se ha corrido**. Éste
// va contra `yaqu_dev_javier` y **se niega a arrancar** si la clave apunta a otro sitio — el
// mismo guard por DESTINO que usa `scrum592-concurrencia-serie.test.mjs`.
//
// ── QUÉ SE EMITE, Y POR QUÉ POR EL EMISOR DE VERDAD ─────────────────────────────────────
//
// Se llama a `emitInvoice`, no a `allocateInvoiceNumber` a secas. La pregunta es el coste de UNA
// EMISIÓN, y el emisor hace más cosas dentro de la transacción que el reservador: el `auditLog`
// de SCRUM-207 y el `invoice.create`. Medir sólo el reservador mediría otra cosa.
//
// ⚠️ Las facturas que crea son de un merchant QA de usar y tirar, en la base de DESARROLLO, y las
// limpia `withMerchant`. No son documentos fiscales de nadie: la regla 29 protege lo emitido de
// un merchant real, no un fixture de una base de desarrollo. Se dice en vez de darlo por hecho.
//
// ── EL GATE ─────────────────────────────────────────────────────────────────────────────
// Sin `QA_DB_TEST=1` esto SE SALTA, y el salto declara su motivo (SCRUM-419/456).
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url'; // SCRUM-730: `pathname` no decodifica
import { withMerchant } from './_merchant-fixture.mjs';

const ENABLED = process.env.QA_DB_TEST === '1';
// ⚠️ El motivo del salto va LITERAL en cada test y no en una constante: el guard de SCRUM-456
// lo lee por AST sobre el FUENTE, y un identificador no lo puede resolver — lo daría por
// «salto sin motivo». Se repite el texto a propósito; la alternativa es un salto mudo.

const RAIZ = process.cwd();
let prisma = null;
let emitInvoice = null;

if (ENABLED) {
  const { PrismaClient } = await import(pathToFileURL(RAIZ + '/node_modules/@prisma/client/default.js').href);
  const { parseBDSegura } = await import(pathToFileURL(RAIZ + '/scripts/_db-guard.mjs').href);
  ({ emitInvoice } = await import('../dist/modules/invoicing/domain/invoicing.service.js'));
  // 🔴 SÓLO DESARROLLO. Este test EMITE facturas, así que se niega a arrancar contra cualquier
  // otra base en vez de fiarse de quién lo lance. Mismo criterio que SCRUM-592.
  const linea = fs.readFileSync('.env', 'utf8').split('\n').find((l) => l.startsWith('DATABASE_URL_DEV='));
  const url = linea?.slice('DATABASE_URL_DEV='.length).trim().replace(/^["']|["']$/g, '');
  const info = url ? parseBDSegura(url) : null;
  assert.ok(info && info.base === 'yaqu_dev_javier',
    '🔴 PARO: este test EMITE FACTURAS y la clave de desarrollo no apunta a `yaqu_dev_javier`.');
  prisma = new PrismaClient({ datasources: { db: { url } } });
}

/**
 * Un merchant QA con lo justo para que el camino FISCAL se recorra de verdad, más su cliente.
 *
 * `flags.INVOICING_ES_ENABLED: true` no es cosmético: sin él `getEmissionMode` devuelve
 * `receipt` y `allocateInvoiceNumber` sale por la rama del justificante — que **no toca la serie
 * fiscal** y por tanto no tiene carrera que medir. Sería un verde sobre el mecanismo equivocado.
 */
async function conMerchantYCliente(fn) {
  return withMerchant(prisma, {
    name: `QA-781-${process.pid}-${Date.now()}`,
    email: `qa-781-${process.pid}-${Date.now()}@test.local`,
    country: 'ES',
    taxId: 'B12345678',
    flags: { INVOICING_ES_ENABLED: true },
    invoiceSeriesPrefix: 'QA',
    nextInvoiceNumber: 1,
    invoiceSeriesYear: null,
  }, async (m) => {
    const cliente = await prisma.customer.create({
      data: { merchantId: m.id, name: `QA-781-cliente-${Date.now()}` },
      select: { id: true },
    });
    return fn(m, cliente);
  });
}

/** Una emisión COMPLETA por el emisor real. `timeout` explícito: ver la nota de los diez. */
const emitir = (m, cliente, timeout) => prisma.$transaction((tx) => emitInvoice(tx, {
  merchantId: m.id,
  customerId: cliente.id,
  total: '100.00',
  currency: 'EUR',
  type: 'F1',
  lines: [{ concept: 'QA-781', qty: 1, price: 100, tax: 0.21 }],
  quoteId: null,
  actor: { tipo: 'sistema', ref: 'qa_scrum781' },
  origen: 'C7-suelta',
}), { timeout, maxWait: timeout });

// ═════════════════════════════════════════════════════════════════════════════════════════
// 1 · SUELO Y CONTROL POSITIVO — el instrumento VE moverse el contador
//
// Sin esto, el «ni un duplicado» de abajo no distingue «el cerrojo funciona» de «no se ha
// emitido nada». Es exactamente el control que hizo creíble el resultado del presupuesto.
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-781 · SUELO: UNA emisión avanza el contador fiscal exactamente 1', { skip: !ENABLED && 'sin QA_DB_TEST=1 · necesita Postgres real: el cerrojo que se prueba es pg_advisory_xact_lock' }, async () => {
  await conMerchantYCliente(async (m, cliente) => {
    const antes = await prisma.merchant.findUnique({
      where: { id: m.id }, select: { nextInvoiceNumber: true, invoiceSeriesYear: true },
    });
    const inv = await emitir(m, cliente, 30_000);
    const despues = await prisma.merchant.findUnique({
      where: { id: m.id }, select: { nextInvoiceNumber: true, invoiceSeriesYear: true },
    });

    assert.equal(antes.nextInvoiceNumber, 1, 'el merchant QA arranca con la serie sin estrenar');
    assert.equal(despues.nextInvoiceNumber, 2,
      `🔴 el contador no avanzó de 1 a 2 (quedó en ${despues.nextInvoiceNumber}). Si el contador `
      + 'no se mueve, cualquier «no hay duplicados» de este fichero mide una base quieta.');
    assert.equal(despues.invoiceSeriesYear, new Date().getFullYear());
    assert.match(inv.number, /^\d{4}-QA-\d{3}$/,
      `🔴 el número no tiene la forma de la serie fiscal: ${inv.number}. Si sale un J-, el `
      + 'merchant se ha ido por el camino del justificante y no hay carrera que medir.');
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 2 · LA CARRERA
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-781 · 🔴 DOS emisiones SIMULTÁNEAS no cogen el mismo número', { skip: !ENABLED && 'sin QA_DB_TEST=1 · necesita Postgres real: el cerrojo que se prueba es pg_advisory_xact_lock' }, async () => {
  await conMerchantYCliente(async (m, cliente) => {
    const [a, b] = await Promise.all([emitir(m, cliente, 30_000), emitir(m, cliente, 30_000)]);
    assert.notEqual(a.number, b.number,
      `🔴 LAS DOS EMISIONES HAN COGIDO ${a.number}. Dos facturas con el mismo número son dos `
      + 'documentos fiscales que no se pueden distinguir, y una factura emitida no se renumera.');
    const seqs = [a.number, b.number].map((n) => Number(n.slice(-3))).sort((x, y) => x - y);
    assert.deepEqual(seqs, [1, 2], `🔴 la serie no es correlativa: ${JSON.stringify(seqs)}`);
  });
});

test('SCRUM-781 · 🔴 y con DIEZ a la vez tampoco: ni un duplicado ni un salto', { skip: !ENABLED && 'sin QA_DB_TEST=1 · necesita Postgres real: el cerrojo que se prueba es pg_advisory_xact_lock' }, async () => {
  // Dos podrían pasar por suerte. Diez, no. Y diez es donde se ve la COLA del cerrojo.
  //
  // 🔴 EL `timeout` DE 60 s NO ES PARA QUE PASE: ES PARA QUE MIDA LO QUE DICE. El cerrojo
  // SERIALIZA, así que la décima transacción espera a las nueve anteriores. Con el de Prisma por
  // defecto (5.000 ms) esto puede caer por TIEMPO y el rojo diría «duplicado» cuando lo que hay
  // es «lento» — un test que acierta el veredicto y miente en el diagnóstico.
  //
  // ⚠️ EL COSTE NO SE ESCONDE AQUÍ: se mide aparte, con su dispersión, en
  // `scripts/medir-concurrencia-emision.mjs`, y va en la entrada de máster. Este test responde
  // «¿se corrompe la serie?»; aquél responde «¿cuánto cuesta y cuándo revienta?».
  await conMerchantYCliente(async (m, cliente) => {
    const invs = await Promise.all(Array.from({ length: 10 }, () => emitir(m, cliente, 60_000)));
    const numeros = invs.map((i) => i.number);
    const seqs = numeros.map((n) => Number(n.slice(-3))).sort((a, b) => a - b);

    assert.deepEqual(seqs, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      `🔴 diez emisiones simultáneas han dado ${JSON.stringify(seqs)}. Un duplicado o un salto `
      + 'ahí es un documento fiscal que no se puede identificar, o un hueco en la serie que hay '
      + 'que justificar ante Hacienda.');
    assert.equal(new Set(numeros).size, 10, `🔴 hay números repetidos: ${numeros.join(', ')}`);

    // Y la base tiene que tener las diez: si alguna transacción se hubiera caído, el conjunto de
    // números seguiría siendo correlativo y este fichero se lo tragaría.
    const enBase = await prisma.invoice.count({ where: { merchantId: m.id } });
    assert.equal(enBase, 10,
      `🔴 se pidieron 10 números y en la base hay ${enBase} facturas. Una emisión que reserva `
      + 'número y no llega a insertar deja un HUECO en la serie.');
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 3 · CONTROL NEGATIVO — lo que NO debe mover el contador, no lo mueve
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-781 · 🔴 CONTROL NEGATIVO: crear un CLIENTE no mueve ningún contador', { skip: !ENABLED && 'sin QA_DB_TEST=1 · necesita Postgres real: el cerrojo que se prueba es pg_advisory_xact_lock' }, async () => {
  await conMerchantYCliente(async (m) => {
    const campos = { nextInvoiceNumber: true, invoiceSeriesYear: true, nextRectInvoiceNumber: true };
    const antes = await prisma.merchant.findUnique({ where: { id: m.id }, select: campos });
    const c = await prisma.customer.create({
      data: { merchantId: m.id, name: `QA-781-neg-${Date.now()}` }, select: { id: true },
    });
    const despues = await prisma.merchant.findUnique({ where: { id: m.id }, select: campos });
    await prisma.customer.delete({ where: { id: c.id } }).catch(() => {});

    assert.deepEqual(despues, antes,
      '🔴 dar de alta un cliente ha movido un contador de la serie fiscal. Un número que se '
      + 'consume sin emitir documento es un HUECO, y un hueco no se puede explicar a nadie.');
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 4 · EL INSTRUMENTO QUE DECIDE SI UN NÚMERO SE PUBLICA — probado, y SIN gate
//
// Todo lo de arriba necesita Postgres. Esto no, y es lo que NO puede quedarse sin verificar:
// `dispersionSeLoCome` es la función que decide **retirar** un número medido cuando la máquina
// dispersa más de lo que el número mide. Si esa función se equivoca, el informe publica una
// cifra que no se sostiene — que es exactamente el fallo que otra sesión cometió hoy midiendo
// 95,2 s y 239,0 s con el mismo código.
//
// Corre en `npm test` a propósito: una red que sólo funciona cuando alguien se acuerda de
// levantarla no es una red.
// ═════════════════════════════════════════════════════════════════════════════════════════

const MED = await import('../scripts/medir-concurrencia-emision.mjs');

test('SCRUM-781 · SUELO: la dispersión se calcula, y DISTINGUE mediana de extremos', () => {
  assert.deepEqual(MED.dispersion([5, 1, 3]), { n: 3, min: 1, mediana: 3, max: 5, amplitud: 4 });
  // Par: la mediana es la media de los dos centrales, no «el de en medio», que no existe.
  assert.deepEqual(MED.dispersion([10, 20, 30, 40]), { n: 4, min: 10, mediana: 25, max: 40, amplitud: 30 });
  // Una sola pasada tiene amplitud 0: no es que sea estable, es que no se ha repetido.
  assert.deepEqual(MED.dispersion([7]), { n: 1, min: 7, mediana: 7, max: 7, amplitud: 0 });
});

test('SCRUM-781 · 🔴 un número CERCA del umbral con mucha dispersión SE RETIRA', () => {
  // El caso real de este ticket: mediana 5.131 ms contra un umbral de 5.000 (distancia 131) con
  // una amplitud entre pasadas de 1.352 ms. La máquina dispersa diez veces lo que se quiere
  // afirmar, así que ese «primer N» no se publica.
  assert.equal(
    MED.dispersionSeLoCome({ mediana: 5131, amplitud: 1352 }, 5000), true,
    '🔴 se publicaría un número cuya dispersión es diez veces mayor que lo que mide',
  );
});

test('SCRUM-781 · ✅ CONTROL POSITIVO: un número LEJOS del umbral NO se retira', () => {
  // Sin esto, un `dispersionSeLoCome` que devolviera `true` siempre pasaría el test de arriba y
  // el informe no publicaría nunca nada — un instrumento que se calla no es un instrumento
  // prudente, es uno roto.
  assert.equal(
    MED.dispersionSeLoCome({ mediana: 18286, amplitud: 194 }, 5000), false,
    '🔴 se retira un número que está a 13 segundos del umbral con 194 ms de amplitud',
  );
  assert.equal(MED.dispersionSeLoCome({ mediana: 9422, amplitud: 1427 }, 5000), false);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 5 · LAS MUTACIONES
//
// ⚠️ EN 760 y 771 dejé fuera del corredor toda mutación cuyo test importara de `dist/`, porque
// el meta-guard mutaba el fuente y **no recompilaba**. Ese límite YA NO ESTÁ: `main` trae
// `frontera-dist.mjs` (SCRUM-763) y el corredor emite a `dist/` antes de juzgar — comprobado en
// este árbol, no heredado del mensaje del commit.
//
// Aun así, las tres declaradas aquí caen en tests que **no** tocan `dist/` ni la base: son las
// del instrumento que decide si un número se publica. Las de la CARRERA no se declaran porque
// están **gateadas**: sin `QA_DB_TEST=1` no pasan en la pasada limpia y el corredor las daría
// —con razón— por CIEGAS. Eso no es un hueco del corredor: es que esa garantía vive detrás de
// un Postgres, y se dice.
// ═════════════════════════════════════════════════════════════════════════════════════════

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // ① El instrumento no retira NADA: publicaría siempre, dispersión incluida.
    fichero: 'scripts/medir-concurrencia-emision.mjs',
    de: '  return d.amplitud > Math.abs(d.mediana - umbral);',
    a: '  return false;',
    cae: 'SCRUM-781 · 🔴 un número CERCA del umbral con mucha dispersión SE RETIRA',
  },
  {
    // ② El instrumento retira SIEMPRE. Un medidor que nunca publica se lee como prudente y es
    // inútil — y sin el control positivo, ① solo no lo distinguiría.
    fichero: 'scripts/medir-concurrencia-emision.mjs',
    de: '  return d.amplitud > Math.abs(d.mediana - umbral);',
    a: '  return true;',
    cae: 'SCRUM-781 · ✅ CONTROL POSITIVO: un número LEJOS del umbral NO se retira',
  },
  {
    // ③ La mediana de una lista PAR se toma «el de en medio», que no existe.
    fichero: 'scripts/medir-concurrencia-emision.mjs',
    de: '  const mediana = n % 2 ? o[(n - 1) / 2] : Math.round((o[n / 2 - 1] + o[n / 2]) / 2);',
    a: '  const mediana = o[Math.floor(n / 2)];',
    cae: 'SCRUM-781 · SUELO: la dispersión se calcula, y DISTINGUE mediana de extremos',
  },
];

test('SCRUM-781 · EL LECTOR OFICIAL me ve: las tres declaraciones, con sus cuatro campos', async () => {
  const { mutacionesDeclaradas } = await import('../scripts/meta-guard-mutaciones.mjs');
  // 🔴 `fileURLToPath`, NUNCA `new URL(...).pathname`: éste NO decodifica, y la ruta de este
  // repo lleva un espacio («Javier Pereira»). Con `pathname` se abre `Javier%20Pereira` y el
  // test cae con un ENOENT que parece un fichero que falta. Es la lección de SCRUM-730.
  const yo = fileURLToPath(import.meta.url);
  const vistas = mutacionesDeclaradas(fs.readFileSync(yo, 'utf8'), 'scrum781.test.mjs');

  assert.equal(
    vistas.length, MUTACIONES_QUE_ME_TUMBAN.length,
    `🔴 declaro ${MUTACIONES_QUE_ME_TUMBAN.length} y el lector oficial ve ${vistas.length}. Una `
      + 'declaración que el corredor no lee es una promesa que no comprueba nadie.',
  );
  assert.deepEqual(
    vistas.map((m) => ({ fichero: m.fichero, de: m.de, a: m.a, cae: m.cae })),
    MUTACIONES_QUE_ME_TUMBAN.map((m) => ({ fichero: m.fichero, de: m.de, a: m.a, cae: m.cae })),
    '🔴 el lector oficial lee algo distinto de lo que está escrito aquí',
  );
  for (const m of MUTACIONES_QUE_ME_TUMBAN) {
    assert.ok(
      fs.readFileSync(m.fichero, 'utf8').includes(m.de),
      `🔴 el ancla ya no está en ${m.fichero}: «${m.de.trim().slice(0, 60)}…»`,
    );
  }
});

test.after(async () => { if (prisma) await prisma.$disconnect(); });
