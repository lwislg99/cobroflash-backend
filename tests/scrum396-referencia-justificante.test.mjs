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
// SCRUM-825 (D1, firma del fundador, comentario 17446): el generador `makeReceiptNumber`, la reserva
// con reintento, su tope y su error propio se RETIRARON. Con ellos se fueron los dos suelos que los
// mantenían vivos (el tope/error y la entropía). Se quedan los tres de SCRUM-1027 —el modo receipt
// rechaza siempre, que es la puerta de la regla 24— y el de los manejadores, que vale para cualquier
// error de la emisión.
import {
  allocateInvoiceNumber,
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

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 SCRUM-1027 (21-sep-2026) · EL MECANISMO DE ABAJO QUEDÓ INALCANZABLE, Y ESTO LO DECLARA
//
// Regla 24 (enmienda SCRUM-612c): con el interruptor en OFF, en España, `allocateInvoiceNumber`
// YA NO reserva una referencia de justificante — lanza `invoicing_es_disabled` ANTES de tocar
// `reservarReferenciaJustificante` (el reintento por colisión que este fichero mide desde
// SCRUM-396). La función sigue en el código —no se borra: retirarla es SCRUM-825, con su propia
// firma (regla 27)— pero desde HOY no tiene ningún llamador alcanzable: es el mismo defecto que
// SCRUM-396 corrigió, con la salida contraria: en vez de arreglar un reintento vivo, se declara
// uno MUERTO para que nadie se crea sus siete tests de abajo (que SÍ pasaban hasta esta enmienda).
//
// Lo que este bloque mide ahora: que `emitir(tx)` en modo `receipt` rechaza SIEMPRE, sin
// consultar el índice ni una vez — si algún día vuelve a consultarlo, es que alguien reabrió el
// camino del justificante sin que un jefe lo firmara.
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1027 · el modo receipt rechaza SIEMPRE, sin llegar a consultar el índice de referencias', async () => {
  const tx = txDoble();
  await assert.rejects(() => emitir(tx), /invoicing_es_disabled/,
    '🔴 un merchant ES sin flag ha vuelto a poder emitir un documento (J- o cualquier otro). ' +
    'Desde SCRUM-1027 el interruptor en OFF significa CERO documentos (regla 24 / SCRUM-612c).');
  assert.equal(tx.consultas.length, 0,
    '🔴 se consultó el índice `[merchantId, number]` antes de rechazar: el rechazo tiene que ser ' +
    'el PRIMER paso del modo receipt, no algo que se descubre después de haber empezado a reservar ' +
    'una referencia que ya no se va a usar.');
  assert.equal(tx.auditados.length, 0,
    '🔴 se auditó una emisión que nunca ocurrió: `factura_emitida` no puede escribirse para un ' +
    'documento que el propio código acaba de rechazar.');
});

test('SCRUM-1027 · lo mismo con la referencia "ocupada": el rechazo llega antes que cualquier colisión', async () => {
  // Aunque el doble esté preparado para simular colisiones, el modo receipt ya no llega a
  // preguntar: si esto empezara a consultar el índice, sería la señal de que el camino del
  // justificante se reabrió sin firma.
  const tx = txDoble({ ocupadas: () => true });
  await assert.rejects(() => emitir(tx), /invoicing_es_disabled/);
  assert.equal(tx.consultas.length, 0);
});

test('SCRUM-1027 · ni siquiera un fallo simulado del índice cambia el rechazo (no hay a qué llegar)', async () => {
  const boom = Object.assign(new Error('conexión caída'), { code: 'P1001' });
  const tx = txDoble({ findUniqueLanza: boom });
  await assert.rejects(() => emitir(tx), (e) => {
    assert.match(String(e?.message), /invoicing_es_disabled/,
      '🔴 salió el error simulado de la consulta en vez de invoicing_es_disabled: el modo receipt ' +
      'ha vuelto a intentar tocar el índice antes de rechazar.');
    return true;
  });
  assert.equal(tx.consultas.length, 0);
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
      '  objeto de error tiene que llegar al log. Si no, un error con nombre propio\n' +
      '  (hoy, `invoicing_es_disabled`) no se distingue de cualquier otro fallo.',
  );
});
