// tests/scrum734-una-sola-carga.test.mjs — SCRUM-734
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// TRES PUERTAS, UN SOLO SITIO QUE DECIDE QUÉ LLEVA EL DOCUMENTO.
//
// El defecto no era qué campo faltaba: era **que hubiera tres listas de veinte claves escritas a
// mano en tres tickets distintos**. Habían divergido en cuatro campos, y añadirlos uno a uno habría
// dejado el quinto para dentro de un mes.
//
// ── LO QUE DE VERDAD IMPIDE EL QUINTO ES EL COMPILADOR, NO ESTE FICHERO ──────────────────────
//
// `paramsDePresupuestoParaPdf` devuelve `Completo<ParamsPdfPresupuesto>`, que quita el `?` de las
// veinte claves. Efecto: **una clave que falte no compila**, y el día que el documento estrene un
// parámetro nuevo, el constructor deja de compilar hasta que alguien decida de dónde sale. Eso es
// antes de que llegue; un guard avisa después.
//
// Este fichero vigila lo que el compilador NO puede ver:
//   ① que las tres puertas sigan pidiéndole el objeto al constructor y no vuelvan a armarlo;
//   ② que ninguna le añada claves por su cuenta —una puerta con «casi todo» es la forma exacta
//      del defecto que se está cerrando—;
//   ③ que el constructor cubra el tipo ENTERO, por si alguien relaja la firma a la versión con
//      opcionales y el compilador deja de mirar.
//
// ── SOBRE EL CONTROL NEGATIVO QUE PIDIÓ EL ASESOR ───────────────────────────────────────────
//
// «un campo que legítimamente sólo aplica a una puerta»: **NO EXISTE NINGUNO ASÍ.** Está medido,
// campo por campo, y hasta el caso que parecía serlo no lo era — la firma, que P2 parecía tener que
// pasar aparte porque llega en la petición, ya está escrita en la fila (`signatureUrl`,
// `acceptedAt`) cuando se regenera el papel. Se dice con estas palabras en vez de inventar una
// excepción para que el control parezca completo. El control negativo que SÍ vale está abajo, y es
// otro: cambios inocuos que no pueden hacer caer el guard.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const RAIZ = path.resolve(import.meta.dirname, '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');
const arbol = (rel, fuente) => ts.createSourceFile(rel, fuente ?? leer(rel), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

const RUTA_PDF = 'src/modules/invoicing/infra/pdf/pdf.service.ts';
const RUTA_CONSTRUCTOR = 'src/modules/quotes/domain/presupuestoParaPdf.ts';
const FUENTES = [
  'src/modules/quotes/app/routes/quotes.routes.ts',
  'src/modules/system/app/routes/quotesAdmin.routes.ts',
];
const CONSTRUCTOR = 'paramsDePresupuestoParaPdf';

// ── censos, todos derivados ─────────────────────────────────────────────────────────────────

/** Las claves que el documento DECLARA en `ParamsPdfPresupuesto`. */
function clavesDelTipo(fuente) {
  const sf = arbol(RUTA_PDF, fuente);
  let claves = null;
  const visitar = (n) => {
    if (ts.isTypeAliasDeclaration(n) && n.name.text === 'ParamsPdfPresupuesto' && ts.isTypeLiteralNode(n.type)) {
      claves = n.type.members.filter(ts.isPropertySignature).map((m) => m.name.getText(sf));
    }
    n.forEachChild(visitar);
  };
  visitar(sf);
  return claves;
}

/** Las claves que el CONSTRUCTOR produce, y el tipo que declara devolver. */
function loQueProduceElConstructor(fuente) {
  const sf = arbol(RUTA_CONSTRUCTOR, fuente);
  let claves = null; let tipoDeVuelta = null;
  const visitar = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name && n.name.text === CONSTRUCTOR) {
      tipoDeVuelta = n.type ? n.type.getText(sf) : null;
      const visitarCuerpo = (m) => {
        if (ts.isReturnStatement(m) && m.expression && ts.isObjectLiteralExpression(m.expression)) {
          claves = m.expression.properties
            .filter((p) => p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)))
            .map((p) => p.name.text);
        }
        m.forEachChild(visitarCuerpo);
      };
      visitarCuerpo(n);
    }
    n.forEachChild(visitar);
  };
  visitar(sf);
  return { claves, tipoDeVuelta };
}

/**
 * Cada puerta: dónde está, y CÓMO se le da la carga.
 *
 * `forma` distingue las tres respuestas que importan, y la de en medio es la que hace útil al
 * guard: una puerta que arma su propio literal se NOMBRA junto a las claves que le faltan.
 */
function censoDePuertas(fuentes) {
  const puertas = [];
  for (const rel of FUENTES) {
    const fuente = fuentes?.[rel] ?? leer(rel);
    const sf = arbol(rel, fuente);
    const visitar = (n) => {
      if (ts.isCallExpression(n)) {
        const e = n.expression;
        const nom = ts.isIdentifier(e) ? e.text : (ts.isPropertyAccessExpression(e) ? e.name.text : null);
        if (nom === 'generateQuotePdf') {
          const a = n.arguments[0];
          const donde = `${rel}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;
          if (a && ts.isCallExpression(a) && ts.isIdentifier(a.expression) && a.expression.text === CONSTRUCTOR) {
            puertas.push({ donde, forma: 'constructor', claves: null });
          } else if (a && ts.isObjectLiteralExpression(a)) {
            const claves = a.properties
              .filter((p) => p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)))
              .map((p) => p.name.text);
            const spreads = a.properties.filter(ts.isSpreadAssignment).length;
            puertas.push({ donde, forma: 'literal', claves, spreads });
          } else {
            puertas.push({ donde, forma: 'otra', claves: null });
          }
        }
      }
      n.forEachChild(visitar);
    };
    visitar(sf);
  }
  return puertas;
}

/** El veredicto, puro: qué puerta no pide la carga al constructor, y qué le falta. */
export function revisarPuertas(fuentes) {
  const declaradas = clavesDelTipo(fuentes?.[RUTA_PDF]);
  const puertas = censoDePuertas(fuentes);
  const problemas = [];
  for (const p of puertas) {
    if (p.forma === 'constructor') continue;
    if (p.forma === 'otra') { problemas.push(`${p.donde} no le pide la carga a \`${CONSTRUCTOR}\``); continue; }
    const faltan = (declaradas ?? []).filter((k) => !p.claves.includes(k));
    problemas.push(faltan.length
      ? `${p.donde} arma su propio objeto y NO CONOCE: ${faltan.join(', ')}`
      : `${p.donde} arma su propio objeto (hoy con todas las claves, mañana con una menos)`);
  }
  return { declaradas, puertas, problemas };
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-734 · SUELO: los tres censos VEN algo', () => {
  const declaradas = clavesDelTipo();
  assert.ok(Array.isArray(declaradas) && declaradas.length >= 15,
    `🔴 el censo del tipo del documento devuelve ${declaradas ? declaradas.length : 'null'} claves. `
    + 'Si `ParamsPdfPresupuesto` se renombra o deja de ser un type literal, este fichero se queda '
    + 'ciego y su verde se lee igual que «todo cuadra».');

  const { claves } = loQueProduceElConstructor();
  assert.ok(Array.isArray(claves) && claves.length >= 15,
    `🔴 el censo del constructor devuelve ${claves ? claves.length : 'null'} claves. Cero es «no supe `
    + 'mirar», nunca «no produce nada».');

  const puertas = censoDePuertas();
  assert.equal(puertas.length, 3,
    `🔴 el censo ha encontrado ${puertas.length} puertas y se sabe que hay 3 (crear · regenerar con `
    + 'firma · GET /admin/quotes/:id/pdf).');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① LAS TRES PUERTAS PIDEN LA CARGA, NO LA ARMAN
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-734 · las TRES puertas le piden el objeto al constructor', () => {
  const R = revisarPuertas();
  assert.deepEqual(R.problemas, [],
    '🔴 ' + R.problemas.join('\n🔴 ') + '\n   Mientras una puerta arme su propia lista de claves, el '
    + 'mismo presupuesto puede salir distinto según por dónde se pida.');
});

test('SCRUM-734 · ROJO POR EL MECANISMO: nombra QUÉ PUERTA y QUÉ CAMPO', () => {
  // Se simula la vuelta atrás: P3 vuelve a armar su literal a mano, con las seis claves
  // obligatorias y ninguna de las opcionales. Es la forma EXACTA que tenía el defecto: una puerta
  // con «casi todo», que compila y que imprime un documento distinto del de las otras dos.
  const rel = 'src/modules/system/app/routes/quotesAdmin.routes.ts';
  const original = leer(rel);
  assert.equal(original.split('paramsDePresupuestoParaPdf({').length - 1, 1,
    '🔴 SUELO: no encuentro la llamada al constructor en P3; la mutación de abajo no medía nada.');

  const aMano = [
    'const pdf = await generateQuotePdf({',
    '  quoteId: quote.id,',
    '  merchant: quote.merchant,',
    '  customer: quote.customer,',
    '  currency: quote.currency,',
    '  total: quote.total.toString(),',
    '  lines: [],',
    '});',
  ].join('\n');
  const R = revisarPuertas({ [rel]: aMano });

  assert.equal(R.problemas.length, 1, `🔴 esperaba UN problema y salen ${R.problemas.length}`);
  const m = R.problemas[0];
  assert.match(m, /quotesAdmin\.routes\.ts:\d+/, '🔴 el mensaje no dice QUÉ PUERTA es');
  assert.match(m, /modoIva/, '🔴 el mensaje no dice QUÉ CAMPO falta');
  assert.match(m, /clausulas/, '🔴 el mensaje no nombra todos los campos que faltan');
});

test('SCRUM-734 · CONTROL NEGATIVO: un cambio inocuo NO pone el guard en rojo', () => {
  // 🔴 EL CONTROL QUE PIDIÓ EL ASESOR —«un campo que sólo aplica a una puerta»— NO EXISTE: no hay
  // ni uno, medido campo por campo. Así que el control negativo es el otro que sí se puede tener:
  // tocar las puertas sin cambiar lo que llevan.
  const rel = 'src/modules/quotes/app/routes/quotes.routes.ts';
  const original = leer(rel);

  // ① cambiar el ORDEN de las fuentes que se le pasan al constructor
  const reordenado = original.replace('quote, merchant, customer,', 'customer, merchant, quote,');
  assert.notEqual(reordenado, original, '🔴 SUELO: la mutación inocua no se aplicó');
  assert.deepEqual(revisarPuertas({ [rel]: reordenado }).problemas, [],
    '🔴 reordenar las fuentes ha puesto el guard en rojo. Eso lo haría inútil: caería por cosas '
    + 'que no cambian lo que lleva el documento.');

  // ② meter un comentario dentro de la llamada
  const comentado = original.replace('quote, merchant, customer,', '/* nada */ quote, merchant, customer,');
  assert.deepEqual(revisarPuertas({ [rel]: comentado }).problemas, [],
    '🔴 un comentario ha puesto el guard en rojo');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② EL CONSTRUCTOR CUBRE EL TIPO ENTERO
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-734 · el constructor produce TODAS las claves que el documento declara', () => {
  const declaradas = clavesDelTipo();
  const { claves } = loQueProduceElConstructor();
  const faltan = declaradas.filter((k) => !claves.includes(k));
  assert.deepEqual(faltan, [],
    `🔴 el constructor NO produce: ${faltan.join(', ')}. Con la firma \`Completo<…>\` esto además no `
    + 'compila; si has llegado a leer este mensaje es que alguien relajó la firma.');
  const sobran = claves.filter((k) => !declaradas.includes(k));
  assert.deepEqual(sobran, [],
    `🔴 el constructor produce claves que el documento NO declara: ${sobran.join(', ')}.`);
});

test('SCRUM-734 · 🔴 la firma del constructor sigue siendo la que NO deja olvidarse un campo', () => {
  const { tipoDeVuelta } = loQueProduceElConstructor();
  assert.equal(tipoDeVuelta, 'ParamsCompletosDelPresupuesto',
    `🔴 el constructor declara devolver \`${tipoDeVuelta}\`. Tiene que ser el tipo COMPLETO: es lo `
    + 'que hace que olvidarse una clave no compile. Con `ParamsPdfPresupuesto` a secas, los catorce '
    + 'campos opcionales se podrían perder uno a uno sin que el compilador dijera nada — que es '
    + 'exactamente cómo llegamos aquí.');

  const src = leer(RUTA_CONSTRUCTOR);
  assert.match(src, /\{\s*\[K in keyof T\]-\?\s*:\s*T\[K\]\s*\}/,
    '🔴 `Completo<T>` ya no quita el `?`. Sin el `-?` el tipo no obliga a nada.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③ EL COMPORTAMIENTO · lo que este ticket arregla de verdad
// ═════════════════════════════════════════════════════════════════════════════════════════

const { paramsDePresupuestoParaPdf } = await import('../dist/modules/quotes/domain/presupuestoParaPdf.js');

const FILA = {
  id: 9, quoteNumber: 3, currency: 'EUR', total: { toString: () => '121.00' },
  lines: [{ concept: 'x', qty: 1, price: 100, tax: 0.21 }],
  ivaModo: 'no_incluido',
  clausulasExcluidas: ['garantia'],
  tiers: [{ id: 'better', label: 'B', lines: [], total: 100 }],
  signatureUrl: 'data:image/png;base64,xx',
  acceptedAt: new Date('2026-09-04T10:00:00Z'),
  discountGlobalAmount: 15,
  shippingAddressMode: 'personalizada', shippingAddress: 'Nave 4',
  docHeaderText: 'cabecera', docFooterText: 'pie', docFields: { name: true },
};
const MERCH = { id: 1, name: 'Taller', country: 'ES', clausulasPresupuesto: [{ id: 'g', titulo: 'Garantía', texto: 'x' }] };
const CLI = { name: 'Cliente', billingAddress: 'Calle 1' };

test('SCRUM-734 · los CUATRO campos que se caían salen del constructor', () => {
  const p = paramsDePresupuestoParaPdf({ quote: FILA, merchant: MERCH, customer: CLI });
  assert.equal(p.modoIva, 'no_incluido', '🔴 `modoIva` no llega: el papel imprimiría el desglose que el profesional quitó');
  assert.deepEqual(p.clausulasExcluidas, ['garantia'], '🔴 `clausulasExcluidas` no llega');
  assert.equal(Array.isArray(p.clausulas) && p.clausulas.length, 1, '🔴 `clausulas` no llega: el documento sale sin las condiciones que acotan el compromiso');
  assert.equal(Array.isArray(p.tiers) && p.tiers.length, 1, '🔴 `tiers` no llega: el papel firmado ya no enseña las opciones entre las que se eligió');
  assert.equal(p.discountGlobalAmount, 15, '🔴 `discountGlobalAmount` no llega (SCRUM-731)');
});

test('SCRUM-734 · la FIRMA sale de la fila, no de la petición', () => {
  const p = paramsDePresupuestoParaPdf({ quote: FILA, merchant: MERCH, customer: CLI });
  assert.equal(p.signatureData, FILA.signatureUrl,
    '🔴 la firma no sale de `signatureUrl`. Era el único campo que parecía tener que pasarse aparte '
    + 'en P2, y no lo es: cuando esa ruta regenera el papel ya la ha escrito en la fila.');
  assert.equal(p.signedAt, FILA.acceptedAt, '🔴 la fecha de firma no sale de `acceptedAt`');

  // Y un presupuesto SIN firmar no inventa ninguna.
  const sinFirma = paramsDePresupuestoParaPdf({ quote: { ...FILA, signatureUrl: null, acceptedAt: null }, merchant: MERCH, customer: CLI });
  assert.equal(sinFirma.signatureData, null);
  assert.equal(sinFirma.signedAt, null);
});

test('SCRUM-734 · 🔴 P2 regenera desde la fila ACTUALIZADA, no desde la anterior', () => {
  // El defecto que destapó el refactor: esa ruta escribe `total` y `lines` cuando el cliente elige
  // un tramo, y regeneraba el papel desde la fila de ANTES. El cliente firmaba «Better» y el PDF
  // guardado enseñaba el total viejo.
  const src = leer('src/modules/quotes/app/routes/quotes.routes.ts');
  const i = src.indexOf('if (signatureData) {');
  assert.ok(i > 0, '🔴 SUELO: no encuentro el bloque que regenera con firma.');
  const bloque = src.slice(i, i + 1600);
  assert.match(bloque, /quote:\s*updatedQuote/,
    '🔴 P2 vuelve a alimentarse de `quote` en vez de `updatedQuote`. El papel firmado enseñaría el '
    + 'total y las líneas ANTERIORES a la elección del cliente.');
});

test('SCRUM-734 · el suelo de las cláusulas ilegibles sigue vivo tras la mudanza', () => {
  // La lectura se movió de la ruta al dominio: si al mudarla se hubiera perdido el suelo, un JSON
  // roto pasaría a reventar (o a inventar cláusulas) en vez de dar cero y quedar registrado.
  const p = paramsDePresupuestoParaPdf({
    quote: FILA, customer: CLI,
    merchant: { ...MERCH, clausulasPresupuesto: '{{{ esto no es json' },
  });
  assert.deepEqual(p.clausulas, [],
    '🔴 con la columna ilegible el documento ya no sale con CERO cláusulas. «No ha configurado '
    + 'ninguna» y «no supe leerlas» acaban las dos en un PDF sin condiciones y significan lo '
    + 'contrario: lo único seguro es no inventarse ninguna.');
});
