// SCRUM-396 · La referencia del justificante se comprobaba contra NADA.
//
// Sin gate: `allocateInvoiceNumber` recibe la `tx` por parámetro, así que se le pasa un doble y el
// reintento se ejercita de verdad — la función REAL, no una copia. Ni BD, ni red, ni navegador.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO
//
// `makeReceiptNumber` tira 4 caracteres al aire (36⁴ = 1.679.616) y hasta hoy NADIE preguntaba si
// esa referencia ya estaba usada. La fecha va dentro, así que el espacio se reparte por merchant y
// por día: a 200 justificantes/día el choque es **1 entre 85**. Cuando chocaba, el `invoice.create`
// del llamador reventaba contra `@@unique([merchantId, number])` y el profesional veía un
// `500 internal_error` al emitir.
//
// ⚠️ POR QUÉ NO SE CAPTURA EL `P2002` — medido, y contradice la forma natural de escribirlo:
// `allocateInvoiceNumber` DEVUELVE un string; el `create` que choca vive en el llamador (8 sitios).
// Y aunque no fuera así, en PostgreSQL una sentencia fallida aborta la transacción: el «segundo
// intento» daría `25P02`, no otro número. Lo que sí se puede es preguntarle al índice por su
// nombre (`merchantId_number`) dentro del cerrojo que ya serializa por merchant.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import {
  allocateInvoiceNumber,
  makeReceiptNumber,
  isReceiptNumber,
  INTENTOS_REFERENCIA_JUSTIFICANTE,
  ReferenciaJustificanteAgotada,
} from '../dist/modules/invoicing/domain/invoiceNumber.service.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

// `isDemoMerchant` es `id === 1`: un merchant de demo desactivaría comprobaciones sin tocar nada.
const MERCHANT_ID = 7;

/**
 * Doble de `tx`. `ocupadas` decide qué referencias contesta como ya usadas; `consultas` guarda
 * EXACTAMENTE el `where` con el que se preguntó, que es lo que permite comprobar que se usó el
 * índice y no otra cosa.
 */
function txDoble({ ocupadas = () => false, findUniqueLanza = null } = {}) {
  const consultas = [];
  const auditados = [];
  return {
    consultas,
    auditados,
    $executeRaw: async () => 1,
    merchant: {
      // Merchant ES real SIN INVOICING_ES_ENABLED → modo `receipt` (V0-0, regla 26).
      findUnique: async () => ({
        id: MERCHANT_ID,
        email: 'pro@ejemplo.es',
        country: 'ES',
        flags: null,
        invoiceSeriesPrefix: 'CF',
        nextInvoiceNumber: 1,
        nextRectInvoiceNumber: 1,
        invoiceSeriesYear: 2026,
      }),
      update: async () => { throw new Error('🔴 el justificante NO puede avanzar la serie fiscal'); },
    },
    invoice: {
      findUnique: async (args) => {
        consultas.push(args);
        if (findUniqueLanza) throw findUniqueLanza;
        const numero = args?.where?.merchantId_number?.number;
        return ocupadas(numero) ? { id: 999 } : null;
      },
    },
    auditLog: { create: async (a) => { auditados.push(a); return { id: auditados.length }; } },
  };
}

const emitir = (tx, now = new Date(2026, 7, 10)) => allocateInvoiceNumber(
  tx, MERCHANT_ID, { camino: 'C4', actor: { tipo: 'owner', teamMemberId: null } }, now,
);

// ── SUELO: el doble llega de verdad al camino del justificante ──────────────────────────

test('SCRUM-396 · SUELO: el doble entra por el camino del JUSTIFICANTE', () => {
  // Si el doble no llegara al modo `receipt`, todo lo de abajo pasaría por vacío: estaríamos
  // midiendo la serie fiscal, que es otro camino y no tiene este defecto.
  const tx = txDoble();
  return emitir(tx).then((numero) => {
    assert.ok(isReceiptNumber(numero), `🔴 ESCÁNER CIEGO: salió \`${numero}\`, que no es un J-`);
    assert.ok(
      tx.consultas.length >= 1,
      '🔴 ESCÁNER CIEGO: no se consultó el índice ni una vez. Sin consulta no hay comprobación, y ' +
        'este fichero estaría dando verde sobre un mecanismo que no corre.',
    );
  });
});

// ── (b) SE COMPRUEBA EL CONSTRAINT, NO UN CÓDIGO DE ERROR ───────────────────────────────

test('SCRUM-396 · se pregunta por el ÍNDICE `[merchantId, number]`, por su nombre', async () => {
  const tx = txDoble();
  const numero = await emitir(tx);

  assert.equal(tx.consultas.length, 1, `🔴 se consultó ${tx.consultas.length} veces sin colisión`);
  const donde = tx.consultas[0]?.where;
  assert.ok(
    donde && donde.merchantId_number,
    '🔴 la consulta NO usa el compound key `merchantId_number`.\n\n' +
      '  «Es un P2002» y «es NUESTRO P2002» no son lo mismo. Preguntar por el índice por su nombre\n' +
      '  es lo que ata el código al constraint: si el índice cambiara de forma, esto no compilaría.\n' +
      `  Se consultó con: ${JSON.stringify(tx.consultas[0])}`,
  );
  assert.equal(donde.merchantId_number.merchantId, MERCHANT_ID,
    '🔴 se pregunta por OTRO merchant: el índice es por merchant y esto lo haría global.');
  assert.equal(donde.merchantId_number.number, numero,
    '🔴 se comprueba una referencia distinta de la que se devuelve.');
});

// ── (a) CADA VUELTA GENERA REFERENCIA NUEVA + SUELO EN LOS DATOS ────────────────────────

test('SCRUM-396 · 🔴 EL VECTOR: con la referencia ocupada REINTENTA, y con una NUEVA', async () => {
  // SUELO EN LOS DATOS: aquí se FUERZA la colisión. Sin un caso que la fuerce, el reintento no se
  // ejercita y el verde no significa nada.
  let vistas = 0;
  const tx = txDoble({ ocupadas: () => { vistas += 1; return vistas <= 2; } }); // 1ª y 2ª ocupadas

  const numero = await emitir(tx);

  assert.equal(tx.consultas.length, 3,
    `🔴 con dos referencias ocupadas se consultó ${tx.consultas.length} veces y debían ser 3.`);
  assert.ok(isReceiptNumber(numero), `🔴 la tercera vuelta no devolvió un J-: ${numero}`);

  const candidatas = tx.consultas.map((c) => c.where.merchantId_number.number);
  assert.equal(candidatas[2], numero, '🔴 se devuelve una referencia distinta de la comprobada');
  // ⚠️ ESTO es lo que distingue «tres intentos» de «un intento repetido tres veces».
  assert.equal(
    new Set(candidatas).size, 3,
    `🔴 LAS TRES VUELTAS PIDEN LA MISMA REFERENCIA: ${candidatas.join(', ')}\n\n` +
      '  Si el generador se llama UNA vez fuera del bucle, los tres intentos son uno y el tope es\n' +
      '  decorativo: reintentar con la candidata que acaba de salir ocupada vuelve a salir ocupada.\n' +
      '  (Tres extracciones de 1.679.616 repetidas por azar: ~1,8·10⁻⁶.)',
  );
});

test('SCRUM-396 · sin colisión NO se reintenta: una consulta y fuera', async () => {
  // Hermano positivo del test de arriba (SCRUM-237): que reintente cuando toca vale poco si
  // reintentara siempre — serían 3 consultas por cada justificante emitido.
  const tx = txDoble({ ocupadas: () => false });
  await emitir(tx);
  assert.equal(tx.consultas.length, 1,
    `🔴 sin colisión se consultó ${tx.consultas.length} veces: el reintento se dispara solo.`);
});

// ── (c) EL AGOTAMIENTO TIENE ERROR PROPIO, Y SE LLAMA ───────────────────────────────────

test('SCRUM-396 · agotar los TRES intentos lanza un error PROPIO, que se nombra', async () => {
  const tx = txDoble({ ocupadas: () => true }); // todas ocupadas: el caso imposible

  await assert.rejects(
    () => emitir(tx),
    (e) => {
      assert.ok(
        e instanceof ReferenciaJustificanteAgotada,
        `🔴 se lanzó \`${e?.name}\` en vez del error propio. Agotar tres intentos tiene ` +
          'probabilidad 1,7·10⁻¹²: NO es una colisión, es otra cosa, y un `Error` genérico no lo dice.',
      );
      assert.equal(e.intentos, INTENTOS_REFERENCIA_JUSTIFICANTE);
      assert.equal(e.merchantId, MERCHANT_ID);
      assert.equal(new Set(e.candidatas).size, 3, '🔴 las candidatas agotadas son la misma repetida');
      assert.match(e.message, /referencia_justificante_agotada/,
        '🔴 el mensaje no nombra el caso: en el log sería indistinguible de cualquier otro fallo.');
      return true;
    },
  );
  assert.equal(tx.consultas.length, INTENTOS_REFERENCIA_JUSTIFICANTE,
    `🔴 se hicieron ${tx.consultas.length} consultas y el tope son ${INTENTOS_REFERENCIA_JUSTIFICANTE}. ` +
      'Un reintento sin tope convierte «pasa otra cosa» en un bucle infinito con el cerrojo tomado.');
});

test('SCRUM-396 · el tope son TRES, y está escrito en un solo sitio', () => {
  assert.equal(INTENTOS_REFERENCIA_JUSTIFICANTE, 3,
    '🔴 el tope ha cambiado. Tres sale de la medición: a 200 justificantes/día, agotar tres es ' +
      '1,7·10⁻¹². Cambiarlo sin rehacer esa cuenta es elegir un número por gusto.');
});

test('SCRUM-396 · si la CONSULTA falla, sube: no se reintenta a ciegas', async () => {
  // «No pude comprobar si está ocupada» y «está libre» no pueden dar el mismo resultado. Y un
  // reintento que se traga cualquier error convierte un fallo de BD en tres fallos de BD.
  const boom = Object.assign(new Error('conexión caída'), { code: 'P1001' });
  const tx = txDoble({ findUniqueLanza: boom });

  await assert.rejects(() => emitir(tx), (e) => {
    assert.equal(e, boom, `🔴 el error de la consulta se transformó en otra cosa: ${e?.message}`);
    assert.ok(!(e instanceof ReferenciaJustificanteAgotada),
      '🔴 un fallo de conexión se está reportando como agotamiento de referencias.');
    return true;
  });
  assert.equal(tx.consultas.length, 1,
    `🔴 se reintentó ${tx.consultas.length} veces tras un error que NO es colisión.`);
});

// ── EL JUSTIFICANTE NO TOCA LA SERIE FISCAL ─────────────────────────────────────────────

test('SCRUM-396 · emitir un justificante NO avanza ningún contador de la serie fiscal', async () => {
  // El doble revienta si alguien llama a `merchant.update`. V0-0: un J- vive fuera de toda serie.
  const tx = txDoble({ ocupadas: (() => { let n = 0; return () => (n += 1) === 1; })() });
  const numero = await emitir(tx);
  assert.ok(isReceiptNumber(numero));
  assert.equal(tx.auditados.length, 1, '🔴 el justificante no dejó registro de auditoría');
});

// ── EL GENERADOR SIGUE TENIENDO ENTROPÍA ────────────────────────────────────────────────

test('SCRUM-396 · SUELO DEL GENERADOR: las referencias no salen todas iguales', () => {
  // Si `makeReceiptNumber` se volviera determinista, el reintento pediría tres veces lo mismo y
  // este mecanismo sería un bucle caro que no arregla nada. Se comprueba que el generador reparte.
  const n = 500;
  const muestras = new Set(Array.from({ length: n }, () => makeReceiptNumber(new Date(2026, 7, 10))));
  assert.ok(
    muestras.size >= n - 10,
    `🔴 de ${n} referencias solo ${muestras.size} son distintas: el generador ha perdido entropía y ` +
      'el reintento no tendría de dónde sacar una candidata nueva.',
  );
  // Y la forma no ha cambiado: `J-YYYYMMDD-XXXX`, sufijo de 4.
  for (const m of muestras) {
    assert.match(m, /^J-\d{8}-[0-9A-Z]{4}$/, `🔴 la referencia \`${m}\` no tiene la forma J-YYYYMMDD-XXXX`);
  }
});

// ── EL NOMBRE SOBREVIVE AL MANEJADOR DE ARRIBA (condición del GO) ───────────────────────

test('SCRUM-396 · ningún manejador de arriba se traga el nombre del error', () => {
  // «Nos pasó con el catch de la firma»: un error con nombre propio no vale nada si el `catch` de
  // la ruta lo convierte en `500 internal_error` SIN dejar rastro. Se DERIVA por AST el manejador
  // que envuelve cada sitio que emite, y se exige que al menos LOGUEE el objeto de error.
  const SITIOS = [
    'src/lib/invoicing.ts',
    'src/modules/jobs/app/routes/jobs.routes.ts',
    'src/modules/system/app/routes/quotesAdmin.routes.ts',
    'src/modules/invoicing/domain/invoicing.service.ts',
    'src/modules/system/app/routes/invoicesAdmin.routes.ts',
    'src/modules/quotes/app/routes/quotes.routes.ts',
  ];

  const emisiones = [];
  const mudos = [];
  for (const f of SITIOS) {
    const sf = ts.createSourceFile('x.ts', leer(f), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const L = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
    const v = (n) => {
      if (ts.isCallExpression(n)) {
        const e = n.expression;
        const nm = ts.isIdentifier(e) ? e.text : (ts.isPropertyAccessExpression(e) ? e.name.text : null);
        if (nm === 'allocateInvoiceNumber' || nm === 'emitInvoice') {
          emisiones.push(`${f}:${L(n)}`);
          let p = n.parent;
          let manejador = null;
          while (p) {
            if (ts.isTryStatement(p) && p.catchClause) { manejador = p.catchClause; break; }
            p = p.parent;
          }
          if (!manejador) return; // sin catch propio: el error sube íntegro al llamador. Correcto.
          // ⚠️ el NOMBRE de la variable, no su declaración: `getText()` daría `err: any`.
          const nombre = manejador.variableDeclaration?.name.getText(sf);
          const cuerpo = manejador.block.getText(sf).replace(/\s+/g, ' ');
          const loguea = nombre
            && new RegExp(`console\\.(error|warn)\\([^;]*\\b${nombre}\\b`).test(cuerpo);
          if (!loguea) mudos.push(`${f}:${L(manejador)} — catch(${nombre ?? 'sin variable'})`);
        }
      }
      ts.forEachChild(n, v);
    };
    v(sf);
  }

  assert.ok(
    emisiones.length >= 8,
    `🔴 ESCÁNER CIEGO: solo ${emisiones.length} sitios de emisión localizados y se midieron 8. ` +
      'Con 0 este test pasaría por vacío, que es la forma más silenciosa de no comprobar nada.',
  );
  assert.deepEqual(
    mudos, [],
    '🔴 HAY MANEJADORES QUE SE TRAGAN EL ERROR SIN DEJAR RASTRO:\n' +
      mudos.map((m) => `   · ${m}`).join('\n') + '\n\n' +
      '  El cuerpo HTTP puede ser un 500 genérico —eso es política de superficie pública— pero el\n' +
      '  objeto de error tiene que llegar al log. Si no, `ReferenciaJustificanteAgotada` no se\n' +
      '  distingue de cualquier otro fallo, y su nombre no sirve para nada.',
  );
});
