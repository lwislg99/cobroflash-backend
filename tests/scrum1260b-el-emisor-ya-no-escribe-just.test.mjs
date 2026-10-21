// SCRUM-1260b · `emitInvoice` ya no escribe `type: 'JUST'`.
//
// Sin gate: `tx` falsa, como `scrum347-origen-de-la-factura.test.mjs`. Ni BD, ni red, ni navegador.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ SE RETIRA Y CON QUÉ FIRMA
//
// `emitInvoice` decidía el tipo con `isReceiptNumber(number) ? 'JUST' : (input.type ?? 'F1')`. El
// número sale de `allocateInvoiceNumber`, que en modo `receipt` LANZA (SCRUM-1027) y si no devuelve
// `formatInvoiceNumber`: `F<AA><NNNN>` o `<año>-<prefijo>-<NNN>`, que empiezan por una letra F o por
// un dígito, nunca por `J-`. La rama no podía tomarse.
//
// El fundador decidió retirarla: «si lo de JUST es por los justificantes tumbalo ya. No hay
// justificantes» (SCRUM-1260, comentario 19616), y confirmó que eso es el GO de la regla 40: «ok
// confirmo explicitamente» (comentario 20143). Alcance: SÓLO el escritor de `emitInvoice`.
//
// ⛔ Lo que NO se retira (regla 29): `isReceiptNumber`, `RECEIPT_NUMBER_PREFIX` y el tipo `'JUST'`
// como DATO — las filas ya emitidas se siguen leyendo. Lo sujeta `scrum1027`.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ DOS PARTES, Y CUÁL CAE
//
// ① EL ALCANCE, entrando por `emitInvoice` de verdad (el compilado), en los tres modos de emisión,
//    los cuatro orígenes, cinco prefijos de serie (tres de ellos hostiles, con `J-`) y el tipo
//    dado o no dado. Este caso sale VERDE con la rama y sin ella: es lo que prueba que retirarla no
//    le quita nada a nadie. NO detecta que alguien la devuelva — una rama inalcanzable no se ve
//    desde fuera, por construcción.
// ② EL TEXTO, sobre el cuerpo ejecutable de `emitInvoice` (sin comentarios): sin `'JUST'` y sin
//    `isReceiptNumber`. Éste es el que cae si la rama vuelve.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ejecutableDe } from './_guard-texto.mjs';
import { isReceiptNumber, ORIGENES_C7 } from '../dist/modules/invoicing/domain/invoiceNumber.service.js';
import { emitInvoice } from '../dist/modules/invoicing/domain/invoicing.service.js';
import { getEmissionMode } from '../dist/modules/invoicing/domain/emission.service.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');
const ACTOR = { tipo: 'pro_propietario', teamMemberId: null };

// Las tres formas de comercio que dan los tres modos. El modo se COMPRUEBA con `getEmissionMode`
// (abajo), no se da por supuesto: si un flag global encendiera `fiscal` para todos, el modo
// `receipt` dejaría de ejercitarse y el caso lo diría.
const COMERCIOS = [
  { nombre: 'ES con el flag ON', modo: 'fiscal', m: { id: 7, country: 'ES', flags: { INVOICING_ES_ENABLED: true } } },
  { nombre: 'fuera de España', modo: 'fiscal', m: { id: 8, country: 'PT', flags: {} } },
  { nombre: 'demo', modo: 'demo', m: { id: 1, country: 'ES', flags: {} } },
  { nombre: 'ES con el flag OFF', modo: 'receipt', m: { id: 9, country: 'ES', flags: {} } },
];
const PREFIJOS = ['CF', 'FG', 'J-', ' J-', 'j-'];
const TIPOS = ['F1', undefined];

/** `tx` falsa que CAPTURA cada fila que `crearFacturaEmitida` crearía. */
function fakeTx(m, prefijo) {
  const creadas = [];
  return {
    creadas,
    $executeRaw: async () => 0,
    merchant: {
      findUnique: async () => ({
        ...m, email: 'pro@fontaneria.es', invoiceSeriesPrefix: prefijo,
        nextInvoiceNumber: 1, nextRectInvoiceNumber: 1, invoiceSeriesYear: new Date().getFullYear(),
      }),
      update: async () => ({}),
    },
    auditLog: { create: async () => ({}) },
    invoice: {
      findMany: async () => [],
      create: async (args) => { creadas.push(args.data); return { id: creadas.length, ...args.data }; },
    },
  };
}

/** El detector: las filas que son justificante por TIPO o por NÚMERO. */
const justificantes = (filas) => filas.filter((f) => f.type === 'JUST' || isReceiptNumber(f.number));

test('SCRUM-1260b · el detector ve un justificante sembrado (si no, el ① sería verde sobre nada)', () => {
  assert.equal(justificantes([]).length, 0);
  assert.equal(justificantes([{ type: 'JUST', number: 'J-20260304-AB12' }]).length, 1,
    '🔴 el detector no ve una fila JUST con número J-: el caso de alcance estaría ciego.');
  assert.equal(justificantes([{ type: 'F1', number: 'J-20260304-AB12' }]).length, 1,
    '🔴 el detector no ve un F1 con número J- (la forma que hay en producción, SCRUM-413).');
  assert.equal(justificantes([{ type: 'F1', number: 'F260001' }]).length, 0,
    '🔴 el detector marca como justificante una factura F normal.');
});

test('SCRUM-1260b · ① por `emitInvoice` real, ningún modo, origen, prefijo ni tipo produce un JUST', async () => {
  let emitidas = 0;
  let rechazadas = 0;
  const modosVistos = new Set();
  const filas = [];
  for (const c of COMERCIOS) {
    assert.equal(getEmissionMode(c.m), c.modo,
      `🔴 «${c.nombre}» da modo ${getEmissionMode(c.m)} y se esperaba ${c.modo}: la población no es la declarada.`);
    modosVistos.add(c.modo);
    for (const prefijo of PREFIJOS) for (const origen of ORIGENES_C7) for (const type of TIPOS) {
      const tx = fakeTx(c.m, prefijo);
      try {
        await emitInvoice(tx, {
          merchantId: c.m.id, customerId: 42, total: '100.00', currency: 'EUR',
          type, lines: [], quoteId: null, actor: ACTOR, origen,
        });
        emitidas++;
      } catch (e) {
        assert.equal(e.message, 'invoicing_es_disabled',
          `🔴 «${c.nombre}» / ${prefijo} / ${origen} lanzó «${e.message}»: no es el rechazo de SCRUM-1027.`);
        assert.equal(c.modo, 'receipt', `🔴 «${c.nombre}» rechazó y sólo el modo receipt rechaza.`);
        rechazadas++;
      }
      if (c.modo === 'receipt') {
        assert.equal(tx.creadas.length, 0, `🔴 en modo receipt se creó una fila (${prefijo}, ${origen}).`);
      }
      filas.push(...tx.creadas);
    }
  }
  const porComercio = PREFIJOS.length * ORIGENES_C7.length * TIPOS.length;
  // POBLACIÓN, derivada de las listas: si una se vacía o un modo deja de ejercitarse, esto lo dice.
  assert.deepEqual([...modosVistos].sort(), ['demo', 'fiscal', 'receipt']);
  assert.equal(emitidas, 3 * porComercio, `🔴 se emitieron ${emitidas} y debían ser ${3 * porComercio}`);
  assert.equal(rechazadas, porComercio, `🔴 se rechazaron ${rechazadas} y debían ser ${porComercio}`);
  assert.equal(filas.length, emitidas, '🔴 hay emisiones que no dejaron fila capturada: el ① estaría ciego.');
  assert.ok(emitidas > 0, '🔴 CIEGO: no se emitió nada.');

  const malas = justificantes(filas);
  assert.equal(malas.length, 0,
    `🔴 ${malas.length} de ${filas.length} filas salen como justificante: ` +
      malas.slice(0, 3).map((f) => `${f.type} ${f.number}`).join(', '));
  // Y el tipo es el que se pidió, o F1 si no se pidió ninguno.
  for (const f of filas) assert.equal(f.type, 'F1', `🔴 una fila salió con type ${f.type}`);
});

test('SCRUM-1260b · ② el cuerpo de `emitInvoice` ya no escribe JUST ni consulta el reconocedor', () => {
  const cuerpo = ejecutableDe(leer('src/modules/invoicing/domain/invoicing.service.ts'),
    { ancla: 'emitInvoice', donde: 'invoicing.service.ts', almohadillaEsComentario: false });
  // Positivo: el extractor ve el objeto que se le pasa a `crearFacturaEmitida`, con su `type`.
  assert.match(cuerpo, /crearFacturaEmitida\s*\(/, '🔴 CIEGO: no veo la llamada a crearFacturaEmitida.');
  assert.doesNotMatch(cuerpo, /'JUST'/,
    "🔴 invoicing.service.ts vuelve a escribir 'JUST'. Se retiró con firma del fundador (SCRUM-1260, " +
      'comentarios 19616 y 20143): devolverlo necesita otra.');
  assert.doesNotMatch(cuerpo, /isReceiptNumber/,
    '🔴 invoicing.service.ts vuelve a consultar isReceiptNumber: el emisor no tiene justificantes que reconocer.');
  assert.match(cuerpo, /type:\s*input\.type\s*\?\?\s*'F1'/,
    "🔴 el tipo ya no es `input.type ?? 'F1'`: ha cambiado algo más que la rama retirada.");
});
