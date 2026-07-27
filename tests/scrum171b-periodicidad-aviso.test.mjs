// SCRUM-171b (FACT-2d) — la periodicidad pactada AVISA; nunca factura sola, y nunca manda sobre
// el plazo legal.
//
// LO QUE PROTEGE ESTE FICHERO, en una frase: que YaQu no le sugiera a un profesional facturar
// FUERA DE PLAZO por respetar un acuerdo comercial. La periodicidad es un pacto privado («te
// facturo a mes vencido»); la fecha límite del art. 13.2 RD 1619/2012 es ley. Si chocan, gana
// la ley — y eso tiene que estar probado, no solo escrito.
//
// Sin gate y sin BD: la decisión vive en una función pura.
import test from 'node:test';
import assert from 'node:assert/strict';
import { avisoDeFacturacion } from '../dist/modules/jobs/domain/pendientesFacturar.service.js';

// Grupo de enero de 2026 en todos los casos; lo que cambia es HOY y lo pactado.
const ENERO = '2026-01';

test('SCRUM-171b: el PLAZO LEGAL manda aunque lo pactado diga que todavía no toca', () => {
  // Día 20 de enero: para un MENSUAL el mes aún no ha cerrado (el pacto diría «espera»), pero el
  // semáforo ya está en ámbar porque la fecha límite se acaba.
  const r = avisoDeFacturacion('MENSUAL', 'ambar', ENERO, new Date(2026, 0, 20));
  assert.equal(r.avisar, true,
    '🔴 CALLAR AQUÍ ES SUGERIR FACTURAR FUERA DE PLAZO: el acuerdo comercial no puede tapar el ' +
    'aviso legal (art. 13.2 RD 1619/2012).');
  assert.equal(r.motivo, 'plazo_legal', 'y el motivo tiene que decir que es la ley, no el pacto');

  // Y con el plazo YA vencido, igual.
  assert.deepEqual(
    avisoDeFacturacion('MENSUAL', 'rojo', ENERO, new Date(2026, 0, 20)),
    { avisar: true, motivo: 'plazo_legal' },
  );
});

test('SCRUM-171b: el plazo avisa incluso SIN periodicidad pactada', () => {
  // `NINGUNA` significa «no hay acuerdo», no «no me avises de la ley»: el semáforo de SCRUM-69
  // ya avisaba antes de este ticket y tiene que seguir haciéndolo.
  assert.deepEqual(
    avisoDeFacturacion('NINGUNA', 'ambar', ENERO, new Date(2026, 0, 20)),
    { avisar: true, motivo: 'plazo_legal' },
  );
});

test('SCRUM-171b: sin periodicidad y con el plazo lejos, NO se avisa (lo de hoy, intacto)', () => {
  assert.deepEqual(
    avisoDeFacturacion('NINGUNA', 'verde', ENERO, new Date(2026, 0, 20)),
    { avisar: false, motivo: null },
    'el default NINGUNA no puede empezar a dar avisos a los 44 clientes que ya existen',
  );
});

test('SCRUM-171b: MENSUAL avisa cuando el mes natural ha cerrado', () => {
  assert.deepEqual(
    avisoDeFacturacion('MENSUAL', 'verde', ENERO, new Date(2026, 0, 31)),
    { avisar: false, motivo: null },
    'el día 31 el mes aún no ha terminado: no toca',
  );
  assert.deepEqual(
    avisoDeFacturacion('MENSUAL', 'verde', ENERO, new Date(2026, 1, 1)),
    { avisar: true, motivo: 'periodicidad' },
    'el 1 de febrero sí: el ciclo pactado se cerró',
  );
});

test('SCRUM-171b: QUINCENAL avisa también a mitad de mes', () => {
  assert.deepEqual(
    avisoDeFacturacion('QUINCENAL', 'verde', ENERO, new Date(2026, 0, 15)),
    { avisar: false, motivo: null },
    'el día 15 la primera quincena todavía no ha cerrado',
  );
  assert.deepEqual(
    avisoDeFacturacion('QUINCENAL', 'verde', ENERO, new Date(2026, 0, 16)),
    { avisar: true, motivo: 'periodicidad' },
    'el 16 sí — y esto es lo que distingue QUINCENAL de MENSUAL',
  );
  // Un MENSUAL en la misma fecha NO avisa: si los dos valores hicieran lo mismo, el campo sobra.
  assert.equal(avisoDeFacturacion('MENSUAL', 'verde', ENERO, new Date(2026, 0, 16)).avisar, false);
});

test('SCRUM-171b: un valor desconocido no inventa avisos', () => {
  // Fail-closed: si mañana llega un valor que este código no conoce (una migración a medias, un
  // cliente de API viejo), NO se avisa por periodicidad. El plazo legal sigue avisando aparte.
  assert.deepEqual(
    avisoDeFacturacion('SEMANAL', 'verde', ENERO, new Date(2026, 1, 1)),
    { avisar: false, motivo: null },
  );
  assert.deepEqual(avisoDeFacturacion(null, 'verde', ENERO, new Date(2026, 1, 1)), { avisar: false, motivo: null });
  assert.deepEqual(avisoDeFacturacion(undefined, 'verde', ENERO, new Date(2026, 1, 1)), { avisar: false, motivo: null });
});
