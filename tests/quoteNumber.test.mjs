// A1.2 — numeración de presupuestos por merchant (quoteNumber.service)
//
// 🔴 SCRUM-592 (DOC-02) · ESTE FICHERO CAMBIA ENTERO, Y LOS TRES CASOS TENÍAN MOTIVO PARA CAMBIAR:
//
//   ① El display era `#1`. Ahora es `P260001`: serie ANUAL y correlativa. La víctima del ticket
//      es que `#26`, `#28`, `#32` no dicen ni de cuántos son ni de qué año.
//
//   ② 🔴 EL SEGUNDO CASO FIJABA UN DEFECTO. Se llamaba «fallback al id global pre-backfill» y
//      exigía que un presupuesto sin número se pintara como `#47` — el id de la tabla, o sea **el
//      volumen de toda la plataforma enseñado al profesional**, que es literalmente lo que A1.2
//      vino a esconder. Estaba escrito como comportamiento deseado, y por eso nadie lo miró.
//      Ahora un presupuesto sin número se DICE sin número.
//
//   ③ El `{ increment: 1 }` era atómico y bastaba mientras el contador sólo subía. Con la serie
//      anual hay que LEER el año y DECIDIR, y eso es un read-then-write que en READ COMMITTED no
//      serializa: pasa a `pg_advisory_xact_lock`, como albaranes y facturas desde SCRUM-234.
//      La carrera se prueba EN PARALELO y contra Postgres, en `scrum592-concurrencia-serie`:
//      un contador probado de uno en uno no ha probado nada.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  allocateQuoteNumber,
  displayQuoteNumber,
  SIN_NUMERO,
} from '../dist/modules/quotes/domain/quoteNumber.service.js';

test('displayQuoteNumber: el número de la serie, con su año', () => {
  assert.equal(displayQuoteNumber({ id: 47, quoteNumber: 1, createdAt: '2026-01-10' }), 'P260001');
  assert.equal(displayQuoteNumber({ id: 120, quoteNumber: 35, createdAt: '2026-11-02' }), 'P260035');
  // El año sale del documento, no del reloj: uno de 2027 se dice de 2027.
  assert.equal(displayQuoteNumber({ id: 5, quoteNumber: 1, createdAt: '2027-01-02' }), 'P270001');
});

test('🔴 displayQuoteNumber: sin número NO se enseña el id global de la plataforma', () => {
  // Era el «fallback pre-backfill», y era el defecto: `#47` es el id de la tabla `quotes`.
  for (const q of [
    { id: 47, quoteNumber: null, createdAt: '2026-01-01' },
    { id: 47, createdAt: '2026-01-01' },
    { id: 47, quoteNumber: 3 },              // sin fecha no se puede saber su año
  ]) {
    const salida = displayQuoteNumber(q);
    assert.equal(salida, SIN_NUMERO);
    assert.equal(salida.includes('47'), false,
      `🔴 se está enseñando el id global (47) con ${JSON.stringify(q)}. Un presupuesto sin número `
      + 'se dice sin número: enseñar un id ajeno no lo arregla, lo disfraza.');
  }
});

test('allocateQuoteNumber: toma el cerrojo ANTES de leer, y avanza la serie', async () => {
  // El mock comprueba el ORDEN, que es lo único que hace segura la reserva: si el cerrojo se
  // tomara después del `findUnique`, dos transacciones ya habrían leído el mismo estado.
  const pasos = [];
  let estado = { nextQuoteNumber: 1, quoteSeriesYear: null };
  const fakeTx = {
    $executeRaw: async () => { pasos.push('cerrojo'); return 1; },
    merchant: {
      findUnique: async ({ where }) => {
        assert.equal(where.id, 7);
        pasos.push('leer');
        return { id: 7, ...estado };
      },
      update: async ({ where, data }) => {
        assert.equal(where.id, 7);
        pasos.push('escribir');
        estado = { nextQuoteNumber: data.nextQuoteNumber, quoteSeriesYear: data.quoteSeriesYear };
        return { id: 7 };
      },
    },
  };

  const primero = await allocateQuoteNumber(fakeTx, 7, new Date('2026-05-05'));
  assert.deepEqual(primero, { numero: 'P260001', seq: 1, year: 2026 });
  assert.deepEqual(pasos, ['cerrojo', 'leer', 'escribir'],
    '🔴 EL CERROJO NO ES LO PRIMERO. Si se toma después de leer, dos transacciones ya han visto '
    + `el mismo estado y el cerrojo no sirve de nada. Orden real: ${pasos.join(' → ')}`);

  const segundo = await allocateQuoteNumber(fakeTx, 7, new Date('2026-05-06'));
  assert.deepEqual(segundo, { numero: 'P260002', seq: 2, year: 2026 });
  assert.deepEqual(estado, { nextQuoteNumber: 3, quoteSeriesYear: 2026 },
    '🔴 el contador no quedó apuntando al siguiente de su serie');

  // Y el año siguiente reinicia, sin esperar a enero de 2027.
  const tercero = await allocateQuoteNumber(fakeTx, 7, new Date('2027-01-01'));
  assert.deepEqual(tercero, { numero: 'P270001', seq: 1, year: 2027 });
});
