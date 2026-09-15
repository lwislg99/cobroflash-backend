// tests/scrum855-el-doble-llama-al-callback.test.mjs — SCRUM-855
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// EL DOBLE COMPARTIDO EJECUTA EL CUERPO DE LA TRANSACCIÓN. Y DICE LO QUE NO SABE IMITAR.
//
// El defecto que cierra esto vivía en una línea:
//
//     if (nombre.startsWith('$')) return async () => undefined;   // _envio-doblado.mjs:66
//
// Ese `startsWith('$')` atrapaba `$transaction`, y el doble devolvía `undefined` **sin llamar al
// callback**. Cualquier test que metiera su trabajo dentro de una transacción pasaba en verde
// habiendo ejecutado CERO líneas de ese trabajo. No fallaba. No avisaba.
//
// ── POR QUÉ ERA GRAVE, Y NO ES UNA FRASE ─────────────────────────────────────────────────────
//
// Falla en la peor dirección posible: **el test que más se esfuerza en cubrir un camino
// transaccional es el que más probable era que no cubriera nada.** Y las transacciones envuelven
// justo lo que importa — cobros, reservas de número, escrituras que tienen que ser atómicas.
//
// Medido con el doble de `main`, ejecutándolo:
//
//     await db.$transaction(async (tx) => { assert.fail('ASERCIÓN IMPOSIBLE'); })
//       ¿entró en el callback?    false
//       ¿qué devolvió?            undefined
//       ¿reventó el assert.fail?  NO
//
// Una aserción imposible dentro de la transacción **no tumbaba nada**.
//
// ⚠️ EL COSTE YA PAGADO, que es la otra mitad del hallazgo: dos sesiones toparon con esto y lo
// rodearon escribiendo SU PROPIA copia del doble (`scrum815-referido-una-sola-vez` y
// `scrum856-canje-una-sola-vez`), dejándolo escrito en sus cabeceras con número de línea. O sea
// que el defecto ya había producido exactamente lo que este módulo compartido existe para evitar:
// dos copias de un doble, que son dos sitios donde divergir.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { dobleDeLaBase } from './_envio-doblado.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOBLE = path.join(RAIZ, 'tests', '_envio-doblado.mjs');

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL QUE DECIDE — el cuerpo de la transacción SE EJECUTA
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-855 · 🔴 EL QUE DECIDE: `$transaction(cb)` LLAMA al callback y devuelve lo suyo', async () => {
  const db = dobleDeLaBase({});
  let entradas = 0;

  const resultado = await db.$transaction(async (tx) => {
    entradas += 1;
    assert.ok(tx, 'al callback tiene que llegarle un cliente con el que trabajar');
    return 'lo que devuelve el cuerpo';
  });

  assert.equal(entradas, 1,
    `🔴 el callback se ejecutó ${entradas} veces y tiene que ser 1. Si es 0, el doble ha vuelto a `
    + 'tragarse el cuerpo de la transacción y todo test que meta ahí su trabajo está en verde '
    + 'sobre nada.');
  assert.equal(resultado, 'lo que devuelve el cuerpo',
    '🔴 `$transaction` no devuelve lo que devolvió el callback. Quien escriba `const x = await '
    + 'prisma.$transaction(...)` recibiría `undefined` y seguiría como si todo hubiera ido bien.');
});

test('SCRUM-855 · 🔴 una aserción que falla DENTRO de la transacción TUMBA la llamada', async () => {
  // Es el control que el ticket pide, vuelto del revés para que viva como test: con el doble
  // roto esto pasaba en verde porque el `assert.fail` no se ejecutaba nunca.
  const db = dobleDeLaBase({});
  await assert.rejects(
    () => db.$transaction(async () => { assert.fail('el cuerpo SÍ se ejecuta'); }),
    /el cuerpo SÍ se ejecuta/,
    '🔴 una aserción IMPOSIBLE dentro del callback no ha tumbado la llamada. O el callback no se '
    + 'ejecuta, o `$transaction` se está tragando su error: las dos dejan tests en verde sobre '
    + 'trabajo que nunca ocurrió.');
});

test('SCRUM-855 · 🔴 y lo que el cuerpo ESCRIBE llega de verdad al banco', async () => {
  // Que el callback se ejecute no basta: lo que haga dentro tiene que pasar por el doble. Sin
  // esto, un `tx` inerte daría el mismo verde que un `tx` que funciona.
  const escrituras = [];
  const db = dobleDeLaBase({ 'merchant.update': (args) => { escrituras.push(args); return { id: 1 }; } });

  await db.$transaction(async (tx) => {
    await tx.merchant.update({ where: { id: 1 }, data: { plan: 'pro' } });
  });

  assert.equal(escrituras.length, 1, '🔴 la escritura de dentro de la transacción no llegó al banco');
  assert.deepEqual(escrituras[0].data, { plan: 'pro' });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LA OTRA FIRMA — `$transaction([...])` es un contrato distinto, no una variante
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-855 · 🔴 la forma de ARRAY espera las promesas y devuelve sus resultados', async () => {
  const db = dobleDeLaBase({});
  const r = await db.$transaction([Promise.resolve('a'), Promise.resolve('b')]);
  assert.deepEqual(r, ['a', 'b'],
    '🔴 `$transaction([...])` no devuelve los resultados del lote. Es la firma que usa el árbol '
    + 'para agrupar escrituras sin callback, y devolver `undefined` aquí deja a quien la use sin '
    + 'lo que pidió.');
});

test('SCRUM-855 · 🔴 una forma que el doble NO conoce se DENUNCIA, no se contesta', async () => {
  const db = dobleDeLaBase({});
  await assert.rejects(
    () => db.$transaction({ isolationLevel: 'Serializable' }),
    /NO SABE IMITAR ESTA FORMA/,
    '🔴 el doble ha contestado a una forma de `$transaction` que no sabe imitar. Si mañana el '
    + 'código de producción la llama con opciones, el doble tiene que aprender esa firma — no '
    + 'devolver `undefined` y dejar el test en verde.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL `tx` NO LLEVA `$transaction`, y eso es fidelidad
//
// El `tx` de Prisma es `Omit<PrismaClient, ITXClientDenyList>`, y `$transaction` está en esa
// lista. Hay código de producción que se apoya EXACTAMENTE en eso: `applyVeriFactu` lanza
// `verifactu_seal_inside_transaction` cuando `typeof prismaClient.$transaction !== 'function'`.
// Un `tx` que lo llevara haría pasar en verde justo el caso que esa guarda existe para impedir —
// o sea, arreglaríamos un falso verde creando otro.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-855 · 🔴 el `tx` del callback NO tiene `$transaction` (como el de Prisma)', async () => {
  const db = dobleDeLaBase({});
  let tipoEnTx = 'no se llegó a mirar';
  await db.$transaction(async (tx) => { tipoEnTx = typeof tx.$transaction; });

  assert.equal(tipoEnTx, 'undefined',
    `🔴 el \`tx\` lleva \`$transaction\` (typeof = ${tipoEnTx}). El de Prisma NO lo lleva, y hay `
    + 'código que lo usa para saber si le han pasado un cliente de transacción. Con este doble, '
    + 'ese código creería estar recibiendo el cliente global.');
  // Y el de fuera SÍ la tiene: si no, la comprobación de arriba sería cierta por vacío.
  assert.equal(typeof db.$transaction, 'function',
    '🔴 el cliente de FUERA tampoco tiene `$transaction`: entonces lo de arriba no distingue nada');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ✅ CONTROL POSITIVO — lo que ya funcionaba sigue igual
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-855 · ✅ los modelos siguen dando lo vacío por defecto, sin cambios', async () => {
  const db = dobleDeLaBase({});
  assert.deepEqual(await db.customer.findMany({}), []);
  assert.equal(await db.customer.count({}), 0);
  assert.equal(await db.quote.findUnique({}), null);
  assert.equal(await db.quote.findFirst({}), null);
  assert.deepEqual(await db.customer.updateMany({}), { count: 0 });
  assert.deepEqual(await db.invoice.aggregate({}), { _max: {}, _count: 0 });
  assert.deepEqual(await db.loQueSea.create({}), {});
});

test('SCRUM-855 · ✅ y la respuesta declarada por el test sigue mandando sobre el defecto', async () => {
  const db = dobleDeLaBase({ 'quote.findUnique': () => ({ id: 7 }), 'customer.count': 3 });
  assert.deepEqual(await db.quote.findUnique({}), { id: 7 });
  assert.equal(await db.customer.count({}), 3, 'una respuesta que no es función también vale');
});

test('SCRUM-855 · ✅ CONTROL NEGATIVO: `$connect` y `$disconnect` NO cambian de semántica', async () => {
  // El ticket lo pide expresamente: no se toca de paso lo que no es el defecto. Estos dos no
  // mueven datos —son ciclo de vida— así que un no-op sigue siendo la imitación fiel.
  const db = dobleDeLaBase({});
  assert.equal(await db.$connect(), undefined);
  assert.equal(await db.$disconnect(), undefined);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ④ EL SUELO QUE FALTABA — un doble que no sabe algo lo DICE
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-855 · 🔴 un `$` que el doble no sabe imitar LANZA, y se nombra', async () => {
  const db = dobleDeLaBase({});
  await assert.rejects(
    () => db.$queryRaw`SELECT 1`,
    (e) => {
      assert.match(e.message, /NO SABE IMITAR/, `salió otro error: ${e.message}`);
      assert.match(e.message, /\$queryRaw/,
        '🔴 el error no dice CUÁL método era: quien lo lea no sabe qué enseñarle al doble');
      return true;
    },
    '🔴 `$queryRaw` ha devuelto algo en vez de denunciar. Devolver `undefined` en silencio es lo '
    + 'que convierte un doble incompleto en un falso verde: quien lo llame seguirá como si la '
    + 'consulta hubiera ido bien.');
});

test('SCRUM-855 · ✅ …pero el test PUEDE declararle la respuesta, y entonces no estorba', async () => {
  const db = dobleDeLaBase({ $queryRawUnsafe: () => [{ n: 1 }] });
  assert.deepEqual(await db.$queryRawUnsafe('SELECT 1'), [{ n: 1 }],
    '🔴 el suelo se ha comido la puerta: un test que SÍ sabe qué debe devolver su consulta tiene '
    + 'que poder decirlo, o el arreglo obliga a duplicar el doble otra vez.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// EL CENSO, VIVO — el suelo del ticket: cero importadores sería CIEGO
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-855 · 🔴 SUELO: alguien IMPORTA este doble (cero sería ceguera, no una noticia)', () => {
  // Por AST y no por `grep`: hay ficheros que NOMBRAN `_envio-doblado.mjs` en su cabecera para
  // explicar por qué NO lo usan —los dos que se escribieron su propia copia por este mismo
  // defecto—. Contarlos como usuarios inflaría el censo justo donde uno querría creérselo.
  const dir = path.join(RAIZ, 'tests');
  const importan = [];
  const nombranSinUsar = [];

  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.mjs'))) {
    if (f === '_envio-doblado.mjs') continue;
    const ruta = path.join(dir, f);
    const texto = fs.readFileSync(ruta, 'utf8');
    if (!texto.includes('_envio-doblado')) continue;

    const sf = ts.createSourceFile(ruta, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    let importa = false;
    (function walk(n) {
      if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)
          && n.moduleSpecifier.text.includes('_envio-doblado')) importa = true;
      ts.forEachChild(n, walk);
    })(sf);
    (importa ? importan : nombranSinUsar).push(f);
  }

  assert.ok(importan.length >= 1,
    `🔴 CIEGO: ${importan.length} ficheros importan el doble. Si de verdad no lo usa nadie, este `
    + 'fichero sobra y el módulo también; y si el detector se ha quedado ciego, su cero se lee '
    + 'igual que la buena noticia.');

  // Y la otra mitad: el detector SABE distinguir importar de nombrar. Si esto fuera 0, podría
  // estar contando menciones y su número de arriba no significaría lo que dice.
  assert.ok(nombranSinUsar.length >= 1,
    '🔴 el censo no encuentra NINGÚN fichero que nombre el doble sin importarlo. Había al menos '
    + 'dos (los que se escribieron su propia copia por el defecto de este ticket): o alguien los '
    + 'cableó de vuelta —buena noticia, anótala— o el detector dejó de distinguir las dos cosas.');
});
