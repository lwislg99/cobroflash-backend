// tests/scrum793-condicion-en-el-where.test.mjs — SCRUM-793
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL TRINQUETE: LA CONDICIÓN VIVE EN EL `WHERE`, Y AHÍ SE QUEDA
//
// El arreglo de este ticket cabe en una frase: `portalToken: null` dentro del `WHERE` de la
// escritura, en vez de un `if` de JavaScript entre el SELECT y el UPDATE. Y esa frase se puede
// deshacer sin querer con un refactor de aspecto inocente —«esto se lee mejor con un `update`»—
// que devolvería la carrera entera sin que ningún test de comportamiento se entere, porque el
// rojo de la carrera es INTERMITENTE: 4 de cada 5 pasadas, no 5 de 5.
//
// Por eso hay dos ficheros:
//   · éste, por AST sobre el fuente, SIN gate — la FORMA del arreglo;
//   · `scrum793-la-carrera-del-token.test.mjs`, gateado — el EFECTO contra Postgres.
//
// ⚠️ Y viven separados por algo MEDIDO en SCRUM-767: con censos rápidos y gateados lentos en el
// mismo fichero, `--test-force-exit` (que es como corre `npm test`) CANCELA los gateados con
// «Promise resolution is still pending but the event loop has already resolved».
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url'; // NUNCA `new URL().pathname`: no decodifica (SCRUM-730)
import ts from 'typescript';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUTA = path.join(RAIZ, 'src/modules/system/customerAdmin.ts');
const FUENTE = fs.readFileSync(RUTA, 'utf8');
const CURA = 'ensurePortalToken';

/** El nodo de `ensurePortalToken`, o `null` (escáner ciego). */
function nodoDeLaCura() {
  const sf = ts.createSourceFile('customerAdmin.ts', FUENTE, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let fn = null;
  const v = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name?.getText(sf) === CURA) fn = n;
    ts.forEachChild(n, v);
  };
  ts.forEachChild(sf, v);
  return { sf, fn };
}

/** Las llamadas de dentro de un nodo, con el texto de su primer argumento. */
function llamadasDe(fn, sf) {
  const out = [];
  const v = (n) => {
    if (ts.isCallExpression(n)) {
      out.push({
        nombre: n.expression.getText(sf),
        arg0: n.arguments[0] ? n.arguments[0].getText(sf) : '',
      });
    }
    ts.forEachChild(n, v);
  };
  ts.forEachChild(fn, v);
  return out;
}

test('SCRUM-793 · SUELO: el escáner ENCUENTRA la cura y sus llamadas', () => {
  const { sf, fn } = nodoDeLaCura();
  assert.ok(fn, `🔴 ESCÁNER CIEGO: no encuentro \`${CURA}\` en customerAdmin.ts. Si cambió de `
    + 'nombre o de fichero, este trinquete dejó de vigilar y su verde no significa nada.');
  const ll = llamadasDe(fn, sf);
  assert.ok(ll.length >= 3,
    `🔴 ESCÁNER CIEGO: sólo veo ${ll.length} llamadas dentro de \`${CURA}\`. `
    + `Vistas: ${JSON.stringify(ll.map((x) => x.nombre))}`);
});

test('SCRUM-793 · 🔴 la ESCRITURA lleva la condición DENTRO de su `where`', () => {
  const { sf, fn } = nodoDeLaCura();
  assert.ok(fn, '🔴 ESCÁNER CIEGO');
  const ll = llamadasDe(fn, sf);

  const escrituras = ll.filter((x) => /\.updateMany$|\.update$|\.upsert$/.test(x.nombre));
  assert.ok(
    escrituras.length >= 1,
    `🔴 ESCÁNER CIEGO: \`${CURA}\` no parece escribir nada. Llamadas: `
      + JSON.stringify(ll.map((x) => x.nombre)),
  );

  for (const e of escrituras) {
    assert.match(
      e.nombre, /\.updateMany$/,
      `🔴 la escritura de \`${CURA}\` usa \`${e.nombre}\`. Tiene que ser \`updateMany\`: `
        + '`update` exige clave única y NO admite más condiciones en el `where`, así que con él '
        + 'la comprobación «¿sigue vacío?» vuelve a caer en un `if` de JavaScript — y entre el '
        + 'SELECT y el UPDATE no hay nada que serialice. Es la carrera con otra ropa.',
    );
    assert.match(
      e.arg0, /where\s*:\s*\{[^}]*portalToken\s*:\s*null/,
      '🔴 LA CONDICIÓN SE HA SALIDO DEL `where`. Sin `portalToken: null` dentro del `where`, dos '
        + 'peticiones simultáneas escriben las dos y gana la última: la primera devuelve a su '
        + 'llamador un token que NO está en la base, y el enlace del portal que el profesional '
        + `manda por WhatsApp no abre.\n\n  Escritura vista: ${e.arg0.replace(/\s+/g, ' ').slice(0, 160)}`,
    );
    assert.match(
      e.arg0, /merchantId/,
      '🔴 la escritura no filtra por `merchantId` (regla 2). La lectura sí lo hacía; la escritura '
        + 'no, y este ticket lo cerró de paso.',
    );
  }
});

test('SCRUM-793 · y NO se devuelve el token que este hilo generó sin comprobar que ganó', () => {
  const { sf, fn } = nodoDeLaCura();
  assert.ok(fn, '🔴 ESCÁNER CIEGO');
  const cuerpo = fn.getText(sf);

  // El `count` de `updateMany` es lo único que distingue «he ganado la carrera» de «he escrito
  // en el vacío». Sin consultarlo, el `return token` de después es una suposición.
  assert.match(
    cuerpo, /\.count\s*===?\s*1/,
    '🔴 no se consulta el `count` de la escritura. Es lo único que dice si esta llamada ganó la '
      + 'carrera; sin él, devolver el token generado aquí es una apuesta, y cuando se pierde el '
      + 'llamador se lleva un enlace muerto.',
  );
  // Y cuando NO gana, tiene que RELEER: devolver el suyo sería exactamente el defecto.
  const releturas = llamadasDe(fn, sf).filter((x) => /\.findFirst$|\.findUnique$/.test(x.nombre));
  assert.ok(
    releturas.length >= 2,
    `🔴 sólo veo ${releturas.length} lectura(s) en \`${CURA}\`. Hacen falta dos: la de entrada y `
      + 'la RELECTURA de cuando la carrera la gana otro — esa segunda es la que devuelve el token '
      + 'que de verdad está en la base.',
  );
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LAS MUTACIONES · las tres deshacen el arreglo por una vía distinta
// ═════════════════════════════════════════════════════════════════════════════════════════

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // ① Vuelve el `update` incondicional: el defecto de SCRUM-767, tal cual.
    fichero: 'src/modules/system/customerAdmin.ts',
    de: '  const escrito = await prisma.customer.updateMany({\n    where: { id: customerId, merchantId, portalToken: null },\n    data: { portalToken: token },\n  });',
    a: '  const escrito = { count: 1 };\n  await prisma.customer.update({ where: { id: customerId }, data: { portalToken: token } });',
    cae: 'SCRUM-793 · 🔴 la ESCRITURA lleva la condición DENTRO de su `where`',
  },
  {
    // ② La condición se sale del `where` y vuelve a ser un `if` de JavaScript. Es la mutación
    // más peligrosa de las tres porque el código SIGUE usando `updateMany` y se lee bien.
    fichero: 'src/modules/system/customerAdmin.ts',
    de: '    where: { id: customerId, merchantId, portalToken: null },',
    a: '    where: { id: customerId, merchantId },',
    cae: 'SCRUM-793 · 🔴 la ESCRITURA lleva la condición DENTRO de su `where`',
  },
  {
    // ③ Se deja de mirar el `count`: se devuelve siempre el token de este hilo, ganase o no.
    fichero: 'src/modules/system/customerAdmin.ts',
    de: '  if (escrito.count === 1) return token;',
    a: '  return token;',
    cae: 'SCRUM-793 · y NO se devuelve el token que este hilo generó sin comprobar que ganó',
  },
];

test('SCRUM-793 · EL LECTOR OFICIAL me ve: las tres declaraciones, con sus cuatro campos', async () => {
  const { mutacionesDeclaradas } = await import('../scripts/meta-guard-mutaciones.mjs');
  const yo = fileURLToPath(import.meta.url);
  const vistas = mutacionesDeclaradas(fs.readFileSync(yo, 'utf8'), path.basename(yo));

  assert.equal(
    vistas.length, MUTACIONES_QUE_ME_TUMBAN.length,
    `🔴 declaro ${MUTACIONES_QUE_ME_TUMBAN.length} y el lector oficial ve ${vistas.length}.`,
  );
  assert.deepEqual(
    vistas.map((m) => ({ fichero: m.fichero, de: m.de, a: m.a, cae: m.cae })),
    MUTACIONES_QUE_ME_TUMBAN.map((m) => ({ fichero: m.fichero, de: m.de, a: m.a, cae: m.cae })),
    '🔴 el lector oficial lee algo distinto de lo que está escrito aquí',
  );
  for (const m of MUTACIONES_QUE_ME_TUMBAN) {
    assert.ok(
      fs.readFileSync(path.join(RAIZ, m.fichero), 'utf8').includes(m.de),
      `🔴 el ancla ya no está en ${m.fichero}: «${m.de.trim().slice(0, 60)}…»`,
    );
  }
});
