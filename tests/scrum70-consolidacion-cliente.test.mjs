import test from 'node:test';
import assert from 'node:assert/strict';
import {
  seleccionarConsolidablesDeCliente,
  agruparPorMes,
  ordenNumeroAlbaran,
} from '../dist/modules/jobs/domain/consolidacionCliente.service.js';

/**
 * SCRUM-70 (FACT-2) — ámbito CLIENTE + MES NATURAL, cruzando Trabajos.
 *
 * Dominio PURO: sin BD, sin gate. Lo que se prueba es la selección, que es donde vive la
 * decisión de producto; la emisión no se toca aquí (SCRUM-173).
 */

const CLIENTE = 7;

function alb(over = {}) {
  return {
    id: 1, numero: 'ALB-2026-001', fecha: new Date('2026-03-10'),
    estado: 'firmado', modoValoracion: 'VALORADO', invoiceId: null,
    customerId: CLIENTE, jobId: 100, tipoOperacion: 'MANTENIMIENTO',
    ...over,
  };
}

test('SCRUM-70: dos Trabajos del MISMO cliente en el mismo mes caen en UN grupo', () => {
  // El corazón del cambio de ámbito. Antes esto eran dos recapitulativas (una por Trabajo)
  // aunque la bandeja de SCRUM-69 ya lo enseñara como un solo grupo de cliente+mes.
  const { elegibles, descartados } = seleccionarConsolidablesDeCliente([
    alb({ id: 1, numero: 'ALB-2026-001', jobId: 100, fecha: new Date('2026-03-05') }),
    alb({ id: 2, numero: 'ALB-2026-002', jobId: 200, fecha: new Date('2026-03-20') }),
  ], CLIENTE);

  assert.equal(descartados.length, 0);
  const grupos = agruparPorMes(elegibles);
  assert.equal(grupos.length, 1, 'dos Trabajos del mismo cliente y mes deben dar UNA sola factura');
  assert.deepEqual(grupos[0].jobIds, [100, 200], 'el grupo debe declarar de qué Trabajos sale');
  assert.equal(grupos[0].mesKey, '2026-03');
});

test('SCRUM-70: la rotura por mes natural (art. 13) se mantiene al cruzar Trabajos', () => {
  const { elegibles } = seleccionarConsolidablesDeCliente([
    alb({ id: 1, jobId: 100, fecha: new Date('2026-03-31') }),
    alb({ id: 2, jobId: 200, fecha: new Date('2026-04-01') }),
  ], CLIENTE);
  const grupos = agruparPorMes(elegibles);
  assert.equal(grupos.length, 2, 'meses naturales distintos NUNCA se agrupan juntos');
  assert.deepEqual(grupos.map((g) => g.mesKey), ['2026-03', '2026-04']);
});

test('SCRUM-70: una obra única del mismo cliente se EXCLUYE, no tumba la selección', () => {
  // A ámbito de cliente, `tipoOperacion` deja de ser propiedad de "la operación" y pasa a ser
  // elegibilidad POR ALBARÁN: el mismo cliente puede tener un mantenimiento y una obra única.
  const { elegibles, descartados } = seleccionarConsolidablesDeCliente([
    alb({ id: 1, numero: 'ALB-2026-001', jobId: 100, tipoOperacion: 'MANTENIMIENTO' }),
    alb({ id: 2, numero: 'ALB-2026-002', jobId: 300, tipoOperacion: 'TRABAJO_UNICO' }),
  ], CLIENTE);

  assert.deepEqual(elegibles.map((a) => a.id), [1], 'la obra única no entra en la recapitulativa');
  assert.equal(descartados.length, 1);
  assert.equal(descartados[0].motivo, 'obra_unica');
  assert.match(descartados[0].mensaje, /ALB-2026-002/, 'el motivo debe decir QUÉ parte se queda fuera');
});

test('SCRUM-70: un parte no apto DESCARTA, no hace fallar toda la operación', () => {
  // Diferencia de fondo con el ámbito de Trabajo: allí el usuario elegía a mano y un parte
  // inválido era un error suyo. Aquí la selección es automática — si uno sin firmar tumbara la
  // llamada, un cliente con veinte partes no podría facturar nunca por culpa de uno.
  const { elegibles, descartados } = seleccionarConsolidablesDeCliente([
    alb({ id: 1, numero: 'ALB-2026-001' }),
    alb({ id: 2, numero: 'ALB-2026-002', estado: 'emitido' }),
    alb({ id: 3, numero: 'ALB-2026-003', modoValoracion: 'SIN_VALORAR' }),
    alb({ id: 4, numero: 'ALB-2026-004', invoiceId: 55 }),
  ], CLIENTE);

  assert.deepEqual(elegibles.map((a) => a.id), [1]);
  assert.deepEqual(
    descartados.map((d) => d.motivo).sort(),
    ['no_firmado', 'sin_precios', 'ya_facturado'],
    'cada exclusión debe llevar su motivo, para poder enseñarla antes de emitir'
  );
});

test('SCRUM-70 (ruta 2): el rango de NÚMEROS no se compara como texto', () => {
  // `ALB-2026-001` va relleno a TRES dígitos: pasado el parte 999, comparar como texto da
  // "ALB-2026-1000" < "ALB-2026-999" y el rango dejaría fuera justo los más nuevos.
  assert.ok(
    ordenNumeroAlbaran('ALB-2026-1000') > ordenNumeroAlbaran('ALB-2026-999'),
    'el 1000 va DESPUÉS del 999 (comparación numérica, no alfabética)'
  );
  assert.ok(ordenNumeroAlbaran('ALB-2027-001') > ordenNumeroAlbaran('ALB-2026-999'), 'el año manda sobre la secuencia');

  const { elegibles } = seleccionarConsolidablesDeCliente([
    alb({ id: 1, numero: 'ALB-2026-999' }),
    alb({ id: 2, numero: 'ALB-2026-1000' }),
    alb({ id: 3, numero: 'ALB-2026-1001' }),
  ], CLIENTE, { numeroDesde: 'ALB-2026-1000' });

  assert.deepEqual(elegibles.map((a) => a.id), [2, 3], 'un rango desde el 1000 no puede incluir el 999');
});

test('SCRUM-70 (ruta 2): un número con formato desconocido NO se descarta por rango', () => {
  // Quedarse fuera de una factura por no saber leer un número sería peor que entrar y que el
  // usuario lo vea en la confirmación.
  const { elegibles, descartados } = seleccionarConsolidablesDeCliente(
    [alb({ id: 1, numero: 'LEGACY-7' })],
    CLIENTE,
    { numeroDesde: 'ALB-2026-100', numeroHasta: 'ALB-2026-200' },
  );
  assert.deepEqual(elegibles.map((a) => a.id), [1]);
  assert.equal(descartados.length, 0);
});

test('SCRUM-70 (ruta 1): "hasta el 31" incluye el 31 ENTERO', () => {
  // Un albarán de las 18:00 del último día del rango es del día 31, y quedarse fuera de su
  // factura por la hora sería un bug de los que solo se ven en producción a fin de mes.
  const { elegibles } = seleccionarConsolidablesDeCliente([
    alb({ id: 1, fecha: new Date('2026-03-31T18:00:00') }),
    alb({ id: 2, fecha: new Date('2026-04-01T09:00:00') }),
  ], CLIENTE, { desde: '2026-03-01', hasta: '2026-03-31' });

  assert.deepEqual(elegibles.map((a) => a.id), [1]);
});

test('SCRUM-70: un parte de otro cliente jamás entra (tenancy de la selección)', () => {
  const { elegibles, descartados } = seleccionarConsolidablesDeCliente(
    [alb({ id: 1, customerId: 999 })],
    CLIENTE,
  );
  assert.equal(elegibles.length, 0);
  assert.equal(descartados[0].motivo, 'otro_cliente');
});
