// SCRUM-413 · `Invoice.type` es un String abierto, y el mapeo a AEAT sella F1 todo lo que no es R1.
//
// Sin gate: censo por AST + ejecución del constructor de XML con un cliente Prisma falso. Ni BD,
// ni red, ni navegador.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO, MEDIDO POR EJECUCIÓN (10-ago-2026)
//
// `Invoice.type` es `String @default("F1")` **sin enum, sin unión y sin guard** en todo `src/`, y
// el mapeo al catálogo de la AEAT es, en DOS sitios:
//
//     inv.type === 'R1' ? 'R1' : 'F1'
//
// O sea: **todo lo que no sea `R1` se declara como F1, en silencio.** Alimentando el constructor
// de XML con una factura de cada tipo:
//
//     F1          → F1   ✅ ANTES y AHORA
//     R1          → R1   ✅ ANTES y AHORA
//     JUST        → F1   🔴 ANTES  ·  EXCLUIDA:documento_no_declarable:JUST      ✅ AHORA
//     ANT         → F1   🔴 ANTES  ·  EXCLUIDA:tipo_de_factura_desconocido:ANT   ✅ AHORA
//     (inventado) → F1   🔴 ANTES  ·  EXCLUIDA:tipo_de_factura_desconocido:…     ✅ AHORA
//
// En PRODUCCIÓN hay 44 `JUST` y **5 `F1` con número `J-`** (tipo y número ya se contradicen). El
// SELLADO está a salvo porque `applyVeriFactu` corta con `isReceiptNumber(number)` — por el
// NÚMERO, no por el tipo—. **El EXPORT no tiene esa guarda**: `buildVerifactuRegistrosXml` no la
// lleva en ninguna función de su cadena, medido por AST.
//
// ✅ ARREGLADO el 10-ago-2026 CON GO DEL FUNDADOR (regla 38: esto modifica el camino de emisión).
//
// La unión cerrada vive en `tipoDocumento.ts` y el mapeo es un `Record<TipoDocumento, …>`: si se
// añade un valor a la unión y no se le da entrada, **no compila** — ésa es la diferencia con el
// `else`, que nunca falta. Y están cubiertos LOS DOS sitios, que era lo que más importaba:
//
//   · `:286` (`applyVeriFactu`) → `exigirTipoDeclarable` LANZA. Sella UN documento: no hay lote.
//   · `:703` (`construirRegistro`) → EXCLUYE con motivo. Allí sí hay un ejercicio entero que sigue
//     siendo entregable, y un paquete al que le falta algo lo DICE.
//
// Este fichero conserva la divergencia EJECUTADA, ahora invertida: comprueba que `JUST`, `ANT` y un
// tipo inventado **ya no** se declaran F1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { buildVerifactuRegistrosXml } from '../dist/modules/invoicing/domain/verifactu.service.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * EL CONJUNTO DECLARADO. No es una lista de deseos: es lo que el censo de abajo ENCUENTRA hoy, y
 * está aquí para que un valor nuevo obligue a una decisión en vez de colarse.
 *
 * `ANT` NO está: sigue siendo una reserva en un comentario (`invoicing.service.ts:28`, de
 * SCRUM-17), no un valor que nadie escriba. El día que se escriba, este guard se pone rojo — que
 * es exactamente lo que tiene que pasar, porque `ANT` hoy se sellaría como F1 por el `else`.
 */
const TIPOS_DECLARADOS = ['F1', 'JUST', 'R1'];

function ficherosTs(dir = path.join(RAIZ, 'src'), out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficherosTs(p, out);
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}
const rel = (p) => path.relative(RAIZ, p).split(path.sep).join('/');

/**
 * Censo DERIVADO de los valores que el código ESCRIBE en `Invoice.type`.
 *
 * ⚠️ Se cuentan ESCRITURAS AL MODELO, no apariciones del literal. La lección está escrita en
 * `librosAeat.ts` sobre el censo de `status`: `already_paid` parecía un estado y era un campo de
 * RESPUESTA de la API. Un grep habría contado ése y no habría visto los que llegan por ternario.
 */
function censoDeTipos() {
  const valores = new Map(); // valor -> [sitios]
  const opacas = [];
  let nodos = 0;

  for (const f of ficherosTs()) {
    const sf = ts.createSourceFile('x.ts', fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const L = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
    const visitar = (n) => {
      nodos += 1;
      if (ts.isCallExpression(n) && /\binvoice\.(create|update|updateMany|upsert)$/.test(n.expression.getText(sf))) {
        const buscar = (x) => {
          if (ts.isPropertyAssignment(x) && x.name.getText(sf) === 'type') {
            const lits = [];
            const rec = (y) => { if (ts.isStringLiteral(y)) lits.push(y.text); ts.forEachChild(y, rec); };
            rec(x.initializer);
            if (lits.length === 0) opacas.push(`${rel(f)}:${L(x)}`);
            for (const v of lits) {
              if (!valores.has(v)) valores.set(v, []);
              valores.get(v).push(`${rel(f)}:${L(x)}`);
            }
          }
          ts.forEachChild(x, buscar);
        };
        buscar(n);
      }
      ts.forEachChild(n, visitar);
    };
    visitar(sf);
  }
  return { valores, opacas, nodos };
}

// ── EL SUELO ────────────────────────────────────────────────────────────────────────────

test('SCRUM-413 · SUELO: si el censo no encuentra tipos, se declara CIEGO y falla', () => {
  const { valores, nodos } = censoDeTipos();
  assert.ok(nodos > 50_000, `🔴 ESCÁNER CIEGO: solo ${nodos} nodos recorridos en src/`);
  assert.ok(
    valores.size > 0,
    '🔴 ESCÁNER CIEGO: el censo devuelve CERO tipos.\n\n' +
      '  «Nadie escribe `Invoice.type`» y «no supe encontrar quién lo escribe» son el mismo número\n' +
      '  y significan lo contrario. Con cero, el test de abajo pasaría por vacío y este fichero\n' +
      '  daría verde sobre un mecanismo que no corre.',
  );
  assert.ok(valores.size >= 3, `🔴 el censo ve ${valores.size} tipos y se midieron 3 (F1, JUST, R1)`);
});

// ── EL CONJUNTO, CERRADO POR CENSO ──────────────────────────────────────────────────────

test('SCRUM-413 · ningún valor de `Invoice.type` se escribe sin estar declarado', () => {
  const { valores, opacas } = censoDeTipos();

  assert.deepEqual(
    opacas, [],
    '🔴 HAY ESCRITURAS DE `Invoice.type` QUE NO SON LITERALES:\n' +
      opacas.map((o) => `   · ${o}`).join('\n') + '\n\n' +
      '  Si el valor llega por variable, este censo no puede saber cuál es — y el mapeo a AEAT\n' +
      "  (`type === 'R1' ? 'R1' : 'F1'`) lo declararía como F1 sin que nadie lo mirase.",
  );

  const nuevos = [...valores.keys()].filter((v) => !TIPOS_DECLARADOS.includes(v)).sort();
  assert.deepEqual(
    nuevos, [],
    `🔴 HAY TIPOS DE FACTURA SIN DECLARAR: ${nuevos.join(', ')}\n\n` +
      nuevos.map((v) => `   · '${v}' en ${valores.get(v).join(', ')}`).join('\n') + '\n\n' +
      '  `Invoice.type` es un `String` abierto: nada impide escribir cualquier cosa. Y el mapeo a\n' +
      "  AEAT es `type === 'R1' ? 'R1' : 'F1'`, así que un tipo nuevo **se declara como F1 EN\n" +
      '  SILENCIO** — una factura completa ante Hacienda, con el nombre del profesional encima.\n\n' +
      '  Antes de añadir un tipo hay que decidir con qué `TipoFactura` del catálogo se sella, y eso\n' +
      '  es dictamen fiscal (P16 en docs/legal/PREGUNTAS_ASESOR.md), no una decisión de código.',
  );

  // 🔴 Y ATADO A LA UNIÓN REAL, no a la copia de arriba. Sin esto el guard vigilaría su propia
  // lista: alguien podría ampliar `TipoDocumento` en el producto y este fichero seguiría verde
  // comparando contra `TIPOS_DECLARADOS`. Se deriva del `Record` que hace el mapeo — el mismo que
  // no compila si a un valor le falta entrada.
  const tipoDoc = fs.readFileSync(path.join(RAIZ, 'src/modules/invoicing/domain/tipoDocumento.ts'), 'utf8');
  const union = /export type TipoDocumento =([^;]+);/.exec(tipoDoc);
  assert.ok(union, '🔴 ESCÁNER CIEGO: no se localiza la unión `TipoDocumento`');
  const deLaUnion = [...union[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(
    deLaUnion, [...TIPOS_DECLARADOS].sort(),
    `🔴 la unión del producto (${deLaUnion.join(', ')}) y la lista de este guard ` +
      `(${TIPOS_DECLARADOS.join(', ')}) han dejado de coincidir. Un guard que vigila su propia copia ` +
      'no vigila nada. Si se añadió un tipo, decláralo aquí Y dale entrada en `AEAT_POR_TIPO`.',
  );

  // Y el DEFAULT del schema es un valor más aunque nadie lo escriba a mano.
  const schema = fs.readFileSync(path.join(RAIZ, 'prisma/schema.prisma'), 'utf8');
  // 🔴 SCRUM-500: la ventana era `+ 3000` caracteres, y una columna nueva con su comentario la
  // desbordó — el escáner se declaró CIEGO (bien) por prosa añadida, no por un cambio de modelo.
  // Una ventana de tamaño fijo caduca sola: se recorta el MODELO, que es lo que se quería mirar.
  const ini = schema.indexOf('model Invoice');
  const fin = schema.indexOf('\n}', ini);
  const inv = schema.slice(ini, fin === -1 ? schema.length : fin);
  assert.ok(fin > ini, '🔴 ESCÁNER CIEGO: no se localiza el final del modelo `Invoice`');
  const m = /type\s+String\s+@default\("([^"]+)"\)/.exec(inv);
  assert.ok(m, '🔴 ESCÁNER CIEGO: no se localiza el `@default` de `Invoice.type` en el schema');
  assert.ok(
    TIPOS_DECLARADOS.includes(m[1]),
    `🔴 el schema pone por defecto '${m[1]}', que no está entre los tipos declarados.`,
  );
});

test('SCRUM-413 · HERMANO POSITIVO: el censo RECONOCERÍA un tipo nuevo', () => {
  // SCRUM-237: sin esto, la negación de arriba pasaría por vacío el día que el extractor se rompa.
  const falso = `tx.invoice.create({ data: { type: 'INVENTADO', total: '1' } });`;
  const sf = ts.createSourceFile('f.ts', falso, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const vistos = [];
  const v = (n) => {
    if (ts.isCallExpression(n) && /\binvoice\.create$/.test(n.expression.getText(sf))) {
      const b = (x) => {
        if (ts.isPropertyAssignment(x) && x.name.getText(sf) === 'type' && ts.isStringLiteral(x.initializer)) {
          vistos.push(x.initializer.text);
        }
        ts.forEachChild(x, b);
      };
      b(n);
    }
    ts.forEachChild(n, v);
  };
  v(sf);
  assert.deepEqual(vistos, ['INVENTADO'],
    `🔴 ESCÁNER CIEGO: el censo no ve un tipo nuevo ni teniéndolo delante (vio ${JSON.stringify(vistos)}).`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL TEST QUE DECIDE: el sellado de HOY y el CORRECTO son DISTINTOS
//
// No se comprueba que exista el ternario ni que un comentario lo mencione: se EJECUTA el
// constructor de XML con una factura de cada tipo y se lee el `TipoFactura` que saldría hacia la
// AEAT. Si los cinco coincidieran con lo correcto, este ticket no tendría objeto.
// ═════════════════════════════════════════════════════════════════════════════════════════

const LINEAS = [{ concept: 'Reforma', qty: 1, price: 100, tax: 0.21 }];
const facturaDe = (type, number) => ({
  id: 1, merchantId: 7, number, createdAt: new Date('2026-03-04T10:00:00Z'),
  type, total: '121.00', currency: 'EUR', status: 'paid', customerId: 3, quoteId: null,
  chargeId: null, albaranRefs: null, lines: LINEAS, rectifiesId: null, rectifies: null,
  // La forma REAL de producción: los 44 JUST y los 5 F1-con-número-J NO están sellados.
  vfHash: null, vfPrevHash: null, vfTimestamp: null,
  vfAnulHash: null, vfAnulTimestamp: null, vfAnulPrevHash: null,
  customer: { name: 'Obras Peña SL', taxId: 'B12345678' },
});

const prismaFalso = (invoices) => ({
  invoice: { findMany: async (a) => (a?.where?.vfHash ? invoices.filter((i) => i.vfHash) : invoices) },
  merchant: {
    findUnique: async () => ({
      id: 7, country: 'ES', taxId: 'B99999999', legalName: 'Pro SL', email: 'p@x.es',
      invoiceSeriesPrefix: 'CF',
    }),
  },
});

/** El `TipoFactura` que HOY se le declararía a la AEAT para esta factura. */
async function tipoDeclaradoHoy(inv) {
  const r = await buildVerifactuRegistrosXml({ merchantId: 7, year: 2026 }, prismaFalso([inv]));
  const m = /<sum1:TipoFactura>([^<]*)<\/sum1:TipoFactura>/.exec(r.xml ?? '');
  if (m) return m[1];
  return (r.excluidos ?? []).length > 0 ? `EXCLUIDA:${r.excluidos[0].motivo}` : '(sin registro)';
}

test('SCRUM-413 · SUELO DE LA SONDA: para F1 y R1 el sellado de hoy YA es el correcto', () => {
  // Si la sonda no supiera leer el XML, todo saldría «distinto» y el test de abajo daría un rojo
  // que no significa nada. Primero se comprueba que en los casos correctos ACIERTA.
  return Promise.all([
    tipoDeclaradoHoy(facturaDe('F1', '2026-CF-001')),
    tipoDeclaradoHoy(facturaDe('R1', '2026-CF-R-001')),
  ]).then(([f1, r1]) => {
    assert.equal(f1, 'F1', `🔴 ESCÁNER CIEGO: una F1 declara «${f1}». La sonda no está leyendo el XML.`);
    assert.equal(r1, 'R1', `🔴 ESCÁNER CIEGO: una R1 declara «${r1}»`);
  });
});

test('SCRUM-413 · 🔴 EL VECTOR: un JUSTIFICANTE se declara a la AEAT como factura F1', async () => {
  // Un `J-` no es una factura: vive fuera de toda serie fiscal (V0-0, regla 26) y `applyVeriFactu`
  // se niega a sellarlo. Pero el EXPORT no lleva esa guarda, y aquí se ve el resultado.
  const declarado = await tipoDeclaradoHoy(facturaDe('JUST', 'J-20260304-AB12'));

  assert.match(
    declarado, /^EXCLUIDA:documento_no_declarable:JUST$/,
    `🔴 el justificante declara «${declarado}». Desde SCRUM-413 NO se declara: se EXCLUYE con motivo. ` +
      'Si vuelve a salir F1, el mapeo mudo ha vuelto y un documento que no es una factura se le ' +
      'está declarando a Hacienda como factura completa.',
  );
  assert.notEqual(declarado, 'F1', '🔴 el justificante ha vuelto a declararse como factura completa');
  // 🔴 LO QUE ESTO SIGNIFICA, dicho aquí y no solo en la entrada: en producción hay 44 documentos
  // `JUST` y 5 `F1` con número `J-` (medido el 10-ago-2026). Ninguno es una factura fiscal, y el
  // XML los declararía a todos como facturas completas.
});

test('SCRUM-413 · 🔴 un tipo DESCONOCIDO también se declara F1, sin que nada avise', async () => {
  const declarado = await tipoDeclaradoHoy(facturaDe('LO-QUE-SEA', '2026-CF-003'));
  assert.match(
    declarado, /^EXCLUIDA:tipo_de_factura_desconocido:LO-QUE-SEA$/,
    `🔴 un tipo inventado declara «${declarado}». Tiene que PARAR, no declararse F1 por si acaso: ` +
      'declarar de más ante Hacienda con el nombre de un profesional encima es peor que no declarar ' +
      '— lo segundo se corrige, lo primero ya se dijo.',
  );
});

test('SCRUM-413 · `ANT` sigue reservado: hoy PARA en vez de sellarse como F1', async () => {
  // `invoicing.service.ts:28`: «default 'F1' (se fuerza 'JUST' si la serie sale J-); FISCAL-1 usará
  // 'ANT'». Es una reserva en un COMENTARIO, de SCRUM-17 (7500782, 22-jul-2026). El día que
  // FISCAL-1 la escriba, se sellará como F1 por el `else` — puede que sea lo correcto, pero lo
  // sería POR ACCIDENTE. Es la pregunta P16.2 al asesor.
  const declarado = await tipoDeclaradoHoy(facturaDe('ANT', '2026-CF-002'));
  assert.match(
    declarado, /^EXCLUIDA:tipo_de_factura_desconocido:ANT$/,
    `🔴 'ANT' declara «${declarado}». Sigue sin estar en la union a proposito: hasta que P16.2 diga ` +
      'con que TipoFactura se sella un anticipo, escribirlo PARA -- antes se sellaba F1 por el else.',
  );

  // Y el suelo de la reserva: que el comentario siga ahí. Si desaparece sin que nadie decida, la
  // pregunta se pierde y el valor entra sin dictamen.
  const svc = fs.readFileSync(path.join(RAIZ, 'src/modules/invoicing/domain/invoicing.service.ts'), 'utf8');
  // ⚠️ Este assert me cazó a MÍ al aplicar el diff: al reescribir ese comentario cambié el texto
  // y la reserva «desapareció» según el guard. Tenía razón. Ahora ancla en lo estable —el valor y
  // la palabra RESERVADO— en vez de en una frase concreta, que es lo que hace frágil a un guard
  // de texto (cuarta vez que este patrón muerde en esta sesión).
  assert.match(
    svc, /'ANT'[\s\S]{0,40}RESERVADO/,
    "🔴 ha desaparecido la reserva de 'ANT' de `invoicing.service.ts`. O se decidió y hay que " +
      'añadirlo a `TipoDocumento` con su mapeo en `AEAT_POR_TIPO`, o se abandonó — pero no puede ' +
      'evaporarse: mientras no esté en la unión, escribirlo NO COMPILA, y esa es la protección.',
  );
});
