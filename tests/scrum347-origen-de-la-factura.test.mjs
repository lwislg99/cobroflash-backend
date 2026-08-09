// SCRUM-347 · EL ORIGEN DE LA FACTURA: `C7` era un cajón con cuatro caminos dentro.
//
// Sin gate: `tx` falsa, como `emission.test.mjs`. Ni BD, ni red, ni navegador.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL ENUNCIADO DEL TICKET ESTABA MAL, Y LA MEDICIÓN LO CORRIGE
//
// Decía: «la auditoría no distingue el ORIGEN de una factura». **Sí lo distingue, desde
// SCRUM-207**: `allocateInvoiceNumber` recibe `camino` como parámetro OBLIGATORIO y lo escribe en
// `meta.camino` del `factura_emitida`, dentro de la misma `tx`. Seis orígenes se distinguían bien.
//
// El defecto estaba en el séptimo: **`C7` etiquetaba a `emitInvoice()` ENTERO**, y por ahí pasan
// cuatro caminos con historias distintas. En una inspección, «esta factura nació de un albarán
// firmado» y «ésta nació suelta» eran las dos `C7`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { soloEjecutable } from './_guard-texto.mjs';
import { allocateInvoiceNumber, ORIGENES_C7 } from '../dist/modules/invoicing/domain/invoiceNumber.service.js';
import { emitInvoice } from '../dist/modules/invoicing/domain/invoicing.service.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

// ⚠️ MERCHANT DE ID REAL. `isDemoMerchant` es `id === 1`: con el demo, comprobaciones enteras se
// desactivan sin tocar una línea del guard, y los casos pasan sin ejercitar nada.
const MERCHANT_ID = 7;
const ACTOR = { tipo: 'pro_propietario', teamMemberId: null };

/** `tx` falsa que CAPTURA lo que se audita — es lo que este fichero mide. */
function fakeTx() {
  const auditados = [];
  return {
    auditados,
    $executeRaw: async () => 0,
    merchant: {
      findUnique: async () => ({
        id: MERCHANT_ID, email: 'pro@fontaneria.es', country: 'ES',
        flags: { INVOICING_ES_ENABLED: true },
        invoiceSeriesPrefix: 'CF', nextInvoiceNumber: 1, nextRectInvoiceNumber: 1, invoiceSeriesYear: 2026,
      }),
      update: async () => ({}),
    },
    auditLog: { create: async (args) => { auditados.push(args); return {}; } },
    invoice: { create: async (args) => ({ id: 1, number: args.data.number, ...args.data }) },
  };
}

/** El `meta.camino` del único `factura_emitida` que se escribió. */
function caminoAuditado(tx) {
  assert.equal(tx.auditados.length, 1, `🔴 se escribieron ${tx.auditados.length} registros de auditoría y debía ser 1`);
  const meta = tx.auditados[0].data.meta;
  return (meta && (meta.camino ?? (meta.payload && meta.payload.camino))) ?? null;
}

// ── LA UNIÓN, DERIVADA ──────────────────────────────────────────────────────────────────
//
// Nada de reescribir la lista a mano: se lee del AST del tipo. Si alguien añade un quinto camino
// a `emitInvoice` y no lo declara, este censo lo ve; si reescribiéramos la lista aquí, no.
function origenesDelTipo() {
  const src = leer('src/modules/invoicing/domain/invoiceNumber.service.ts');
  const sf = ts.createSourceFile('n.ts', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let out = null;
  const visita = (n) => {
    if (ts.isTypeAliasDeclaration(n) && n.name.getText(sf) === 'OrigenC7' && ts.isUnionTypeNode(n.type)) {
      out = n.type.types
        .map((t) => t.getText(sf).replace(/^['"`]|['"`]$/g, '').trim())
        .filter(Boolean);
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return out;
}

test('SCRUM-347 · SUELO: la unión se deriva del tipo y la constante la refleja', () => {
  const delTipo = origenesDelTipo();
  assert.ok(
    Array.isArray(delTipo) && delTipo.length > 0,
    '🔴 ESCÁNER CIEGO: no se pudo derivar `OrigenC7` del AST. Sin esto, todo lo de abajo recorrería ' +
      'un conjunto vacío y pasaría sin comprobar nada.',
  );
  assert.equal(
    delTipo.length, 4,
    `🔴 el tipo declara ${delTipo.length} orígenes y emitInvoice tiene 4 llamadores medidos`,
  );
  // La constante que consumen los guards NO puede desviarse del tipo. Si una crece y la otra no,
  // el guard mediría una lista que ya no es la de verdad.
  assert.deepEqual(
    [...ORIGENES_C7].sort(), [...delTipo].sort(),
    '🔴 `ORIGENES_C7` y el tipo `OrigenC7` se han desincronizado.',
  );
});

// ── EL CENSO DE LLAMADORES, DERIVADO ────────────────────────────────────────────────────

function llamadoresDeEmitInvoice() {
  const dir = path.join(RAIZ, 'src');
  const ficheros = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) { walk(f); continue; }
      if (f.endsWith('.ts')) ficheros.push(f);
    }
  })(dir);

  const out = [];
  for (const f of ficheros) {
    const src = fs.readFileSync(f, 'utf8');
    if (!src.includes('emitInvoice')) continue;
    const sf = ts.createSourceFile('x.ts', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const visita = (n) => {
      if (ts.isCallExpression(n) && /(^|\.)emitInvoice$/.test(n.expression.getText(sf))) {
        const arg = n.arguments[1];
        let origen = null;
        if (arg && ts.isObjectLiteralExpression(arg)) {
          for (const p of arg.properties) {
            if (ts.isPropertyAssignment(p) && p.name.getText(sf) === 'origen') {
              origen = p.initializer.getText(sf).replace(/^['"`]|['"`]$/g, '');
            }
          }
        }
        out.push({ f: path.relative(RAIZ, f).split(path.sep).join('/'), origen });
      }
      ts.forEachChild(n, visita);
    };
    visita(sf);
  }
  return { llamadores: out, barridos: ficheros.length };
}

test('SCRUM-347 · SUELO del censo: hay llamadores de `emitInvoice` y todos declaran su origen', () => {
  const { llamadores, barridos } = llamadoresDeEmitInvoice();
  assert.ok(barridos >= 150, `🔴 ESCÁNER CIEGO: solo ${barridos} ficheros .ts barridos`);
  assert.ok(
    llamadores.length >= 4,
    `🔴 ESCÁNER CIEGO: el censo ve ${llamadores.length} llamadores de \`emitInvoice\` y hay 4. ` +
      '«Ninguno sin origen» y «no supe encontrarlos» son el mismo verde.',
  );
  const sinOrigen = llamadores.filter((l) => !l.origen);
  assert.deepEqual(
    sinOrigen.map((l) => l.f), [],
    '🔴 hay llamadores de `emitInvoice` que NO declaran origen. El tipo debería impedirlo — si esto ' +
      'salta, alguien lo ha esquivado con un `as any` o un spread.',
  );
  // Y ninguno usa un origen que el tipo no conozca.
  for (const l of llamadores) {
    assert.ok(ORIGENES_C7.includes(l.origen), `🔴 ${l.f} declara «${l.origen}», que no está en el tipo`);
  }
});

test('SCRUM-347 · CADA camino usa un origen DISTINTO: no se colapsan dos en la misma etiqueta', () => {
  const { llamadores } = llamadoresDeEmitInvoice();
  const porOrigen = new Map();
  for (const l of llamadores) porOrigen.set(l.origen, [...(porOrigen.get(l.origen) ?? []), l.f]);

  const colapsados = [...porOrigen.entries()].filter(([, fs_]) => fs_.length > 1);
  assert.deepEqual(
    colapsados.map(([o, fs_]) => `${o} ← ${fs_.join(' + ')}`), [],
    '🔴 DOS CAMINOS COMPARTEN LA MISMA ETIQUETA DE ORIGEN.\n\n' +
      '  Es exactamente el defecto que este ticket vino a cerrar: `C7` era eso, un cajón. Colapsar\n' +
      '  dos vuelve a hacer indistinguibles en una inspección dos facturas con historias distintas.',
  );
  assert.equal(
    porOrigen.size, ORIGENES_C7.length,
    `🔴 se usan ${porOrigen.size} orígenes distintos y el tipo declara ${ORIGENES_C7.length}: hay ` +
      'una etiqueta declarada que nadie usa, o un camino sin la suya.',
  );
});

// ── LA AUDITORÍA, POR CADA CAMINO ───────────────────────────────────────────────────────

test('SCRUM-347 · los CUATRO caminos escriben su `meta.camino` distinto, en la misma tx', async () => {
  const vistos = [];
  for (const origen of ORIGENES_C7) {
    const tx = fakeTx();
    await emitInvoice(tx, {
      merchantId: MERCHANT_ID, customerId: 42, total: '100.00', currency: 'EUR',
      type: 'F1', lines: [], quoteId: null, actor: ACTOR, origen,
    });
    const camino = caminoAuditado(tx);
    assert.equal(
      camino, origen,
      `🔴 emitiendo por «${origen}» se auditó «${camino}». La auditoría registra un origen que no ` +
        'es el del camino que emitió.',
    );
    vistos.push(camino);
  }
  // SUELO EN LOS DATOS, no solo en el guard: si un camino no se hubiera ejercitado, el bucle
  // habría pasado sin comprobarlo y el verde no significaría nada.
  assert.equal(
    vistos.length, ORIGENES_C7.length,
    `🔴 ESCÁNER CIEGO: se ejercitaron ${vistos.length} de ${ORIGENES_C7.length} caminos.`,
  );
  assert.equal(new Set(vistos).size, ORIGENES_C7.length, '🔴 dos caminos auditaron el mismo valor');
});

// ── CONTROL POSITIVO: LOS SEIS QUE YA DISTINGUÍAN, INTACTOS ─────────────────────────────

test('SCRUM-347 · CONTROL POSITIVO: los seis caminos de siempre siguen auditando igual', async () => {
  // Se está partiendo una etiqueta en un registro fiscal: lo que ya funcionaba no puede moverse.
  const seis = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'];
  for (const camino of seis) {
    const tx = fakeTx();
    await allocateInvoiceNumber(tx, MERCHANT_ID, { camino, actor: ACTOR });
    assert.equal(
      caminoAuditado(tx), camino,
      `🔴 el camino ${camino} ha dejado de auditarse como ${camino}.`,
    );
  }
  // Y siguen existiendo en el tipo: partir C7 no puede haberse llevado ninguno por delante.
  const src = leer('src/modules/invoicing/domain/invoiceNumber.service.ts');
  for (const c of seis) {
    assert.match(src, new RegExp(`\\| '${c}'`), `🔴 el camino ${c} ha desaparecido de \`CaminoEmision\``);
  }
});

// ── REGLA 29: LO YA REGISTRADO NO SE REESCRIBE ──────────────────────────────────────────

test('SCRUM-347 · `C7` a secas ya no se puede EMITIR, pero sigue siendo un DATO válido', () => {
  const src = leer('src/modules/invoicing/domain/invoiceNumber.service.ts');
  //
  // ⚠️ ESTE ASSERT NO SALTABA. Buscaba el texto `| 'C7';` —atado a la PUNTUACIÓN— y la inyección
  // dejaba un salto de línea detrás, así que no casaba y el rojo no salía. Un guard de texto atado
  // a cómo está escrito algo deja de ver en cuanto se escribe de otra forma.
  //
  // Ahora se DERIVA la unión entera del AST y se pregunta por sus miembros, que es el hecho.
  const sf = ts.createSourceFile('n.ts', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let miembros = null;
  const visita = (n) => {
    if (ts.isTypeAliasDeclaration(n) && n.name.getText(sf) === 'CaminoEmision' && ts.isUnionTypeNode(n.type)) {
      miembros = n.type.types.map((t) => t.getText(sf).replace(/^['"`]|['"`]$/g, '').trim());
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  assert.ok(
    Array.isArray(miembros) && miembros.length > 0,
    '🔴 ESCÁNER CIEGO: no se pudo derivar `CaminoEmision` del AST — el assert de abajo pasaría vacío.',
  );
  assert.ok(
    !miembros.includes('C7'),
    `🔴 «C7» a secas sigue en la unión (miembros: ${miembros.join(', ')}): un camino nuevo podría ` +
      'volver a registrarse en el cajón que este ticket vino a partir.',
  );
  assert.ok(!ORIGENES_C7.includes('C7'), '🔴 `C7` sigue entre los orígenes emitibles');

  // Y NO se toca lo ya registrado: nadie reescribe `meta.camino` ni rellena los antiguos.
  //
  // ⚠️ SE LEE SIN COMENTARIOS. La primera versión buscaba sobre el fichero entero y saltó con MI
  // PROPIO comentario —el que explica que no se hace eso—: un guard de texto se caza a sí mismo en
  // la frase que describe la prohibición.
  const backfill = ['update.*meta\\.camino', 'set.*camino.*C7', 'backfill'];
  const fuentes = soloEjecutable(leer('src/modules/invoicing/domain/invoiceNumber.service.ts'), { almohadillaEsComentario: false })
    + soloEjecutable(leer('src/modules/invoicing/domain/invoicing.service.ts'), { almohadillaEsComentario: false });
  for (const pat of backfill) {
    assert.doesNotMatch(
      fuentes, new RegExp(pat, 'i'),
      `🔴 hay algo que reescribe el origen ya registrado (${pat}). Regla 29: lo emitido no se toca. ` +
        'Las facturas antiguas se quedan con `C7` y eso se DECLARA — no saber su origen es un dato.',
    );
  }
});
