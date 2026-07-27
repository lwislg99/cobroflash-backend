// SCRUM-138 — export selectivo: elegir un dataset NO abre otro, y el LEEME no miente.
//
// SIN GATE, PURO: `resolverSeleccion` y `construirLeeme` son funciones sin BD ni red, y eso
// es a propósito — lo que se prueba aquí son GATES, y un gate se prueba mejor donde se
// decide que a través de un ZIP de 40 MB.
//
// Los guardarraíles heredados de SCRUM-25 que este ticket NO puede relajar:
//   · Admin-only  → vive en el montaje del router (mountAdmin + requireRole). Lo cubre
//                   tenancy-permisos.test.mjs recorriendo ADMIN_ONLY_ROUTES; aquí no se
//                   duplica, se deja dicho dónde está.
//   · XML VeriFactu solo con INVOICING_ES_ENABLED (regla 24/26, SCRUM-73) → aquí.
//   · Gate POR dataset: pedir uno no arrastra otro → aquí.
import test from 'node:test';
import assert from 'node:assert/strict';

const { resolverSeleccion, DATASETS } = await import('../dist/modules/exports/domain/seleccionExport.js');
const { construirLeeme } = await import('../dist/modules/exports/domain/exportData.js');

test('SCRUM-138: pedir "facturas" NO enciende el XML si el flag está OFF (regla 24)', () => {
  // EL CASO QUE IMPORTA: el usuario marca Facturas y el merchant es ES con NIF, pero
  // INVOICING_ES_ENABLED está OFF (estado de HOY, pre-SIF). El XML NO puede entrar.
  const conFlagOff = resolverSeleccion('facturas', false);
  assert.equal(conFlagOff.pdfs, true, 'los PDF sí entran: no dependen del flag fiscal');
  assert.equal(conFlagOff.xml, false, '🔴 REGLA 24 ROTA: el XML VeriFactu ha entrado con el flag OFF');

  // Y con el flag ON (post-SIF) sí, porque entonces el gate lo permite.
  assert.equal(resolverSeleccion('facturas', true).xml, true);
});

test('SCRUM-138: sin facturas en la selección no hay XML ni PDF, aunque el flag esté ON', () => {
  const soloGastos = resolverSeleccion('gastos', true);
  assert.equal(soloGastos.xml, false, 'el XML es de las facturas: sin ellas no pinta nada');
  assert.equal(soloGastos.pdfs, false, 'ni los PDF, que además cuestan el render de SCRUM-83');
  assert.deepEqual([...soloGastos.datasets], ['gastos']);
});

test('SCRUM-138: elegir un dataset NO arrastra otro', () => {
  const s = resolverSeleccion('gastos,clientes', true);
  assert.equal(s.datasets.has('gastos'), true);
  assert.equal(s.datasets.has('clientes'), true);
  assert.equal(s.datasets.has('facturas'), false, '🔴 pedir gastos+clientes ha metido facturas');
  assert.equal(s.datasets.has('cobros'), false);
  assert.equal(s.datasets.has('trabajos'), false);
  assert.equal(s.datasets.has('presupuestos'), false);
});

test('SCRUM-138: selección vacía o ilegible = TODO, nunca "nada"', () => {
  // Fallo seguro: el comportamiento de SCRUM-25. Un ZIP vacío que parece correcto es peor
  // que uno completo — mismo criterio que el paquete incompleto.
  for (const entrada of [undefined, null, '', '   ', 'loquesea', 'facturas-mal,otracosa']) {
    const s = resolverSeleccion(entrada, true);
    assert.equal(s.esCompleto, true, `"${entrada}" debería caer a completo`);
    assert.equal(s.datasets.size, DATASETS.length, `"${entrada}" debería traer los ${DATASETS.length} datasets`);
  }
  // Lo ilegible se ignora, pero lo legible de la misma lista se respeta.
  const mixto = resolverSeleccion('gastos,inventado', true);
  assert.deepEqual([...mixto.datasets], ['gastos'], 'un dataset mal escrito no puede tumbar la descarga entera');
});

test('SCRUM-138: el LEEME describe SOLO lo que lleva el paquete', () => {
  const base = {
    nombre: 'Fontanería QA', generado: '2026-07-27T10:00:00.000Z',
    from: new Date('2026-01-01'), to: new Date('2026-12-31'),
    pdfsOk: 0, pdfsTotal: 0, xmlAnios: [], cabecera: [],
  };

  const soloGastos = construirLeeme({ ...base, datasets: new Set(['gastos']) });

  // GUARDA DE PRESENCIA: el LEEME de verdad se construye y nombra lo que SÍ lleva. Sin
  // esto, un LEEME roto que devolviera '' pasaría los asserts de ausencia de abajo.
  assert.ok(soloGastos.includes('gastos.csv'), 'debe nombrar el fichero que SÍ lleva');
  assert.ok(soloGastos.includes('ESTE PAQUETE ES PARCIAL'), 'un paquete parcial debe decirlo');

  // Y NO promete lo que no está. Esto es lo que evita el "entregable que miente sobre su
  // propio contenido" que SCRUM-82 prohibió para el XML.
  for (const ausente of ['facturas.csv', 'cobros.csv', 'trabajos.csv', 'presupuestos.csv', 'clientes.csv']) {
    assert.ok(!soloGastos.includes(ausente), `🔴 el LEEME promete ${ausente} y el ZIP no lo lleva`);
  }

  // El paquete COMPLETO sigue describiéndolo todo y sin el aviso de parcial.
  const completo = construirLeeme({ ...base, datasets: undefined });
  for (const presente of ['clientes.csv', 'facturas.csv', 'cobros.csv', 'trabajos.csv', 'presupuestos.csv', 'gastos.csv']) {
    assert.ok(completo.includes(presente), `el paquete completo debe nombrar ${presente}`);
  }
  assert.ok(!completo.includes('ESTE PAQUETE ES PARCIAL'), 'el completo no es parcial');
});

test('SCRUM-138: si clientes.csv va a salir VACÍO, el LEEME lo dice y explica por qué', () => {
  // Encontrado abriendo un ZIP real en el click-through: clientes.csv lleva los clientes
  // REFERENCIADOS por los documentos del paquete (SCRUM-104), así que pedir "clientes +
  // gastos" —y un gasto apunta a una cotización, no a un cliente— da un CSV con la cabecera
  // y nada más, bajo un LEEME que promete "todos los clientes con algún documento".
  const base = {
    nombre: 'Fontanería QA', generado: '2026-07-27T10:00:00.000Z',
    from: null, to: null, pdfsOk: 0, pdfsTotal: 0, xmlAnios: [], cabecera: [],
  };

  const sinDocumentos = construirLeeme({ ...base, datasets: new Set(['clientes', 'gastos']) });
  assert.ok(sinDocumentos.includes('VACÍO'), '🔴 el LEEME promete clientes sobre un CSV que sale vacío');
  assert.ok(sinDocumentos.includes('Añade facturas'), 'y debe decir cómo arreglarlo');

  // Con UN dataset de documentos ya no está vacío: no se avisa de lo que no pasa.
  const conFacturas = construirLeeme({ ...base, datasets: new Set(['clientes', 'facturas']) });
  assert.ok(!conFacturas.includes('VACÍO'), 'con documentos en el paquete no hay nada que avisar');
});

test('SCRUM-138: el LEEME apunta a Finanzas, no a Configuración (el export se mudó)', () => {
  const leeme = construirLeeme({
    nombre: 'Fontanería QA', generado: '2026-07-27T10:00:00.000Z',
    from: new Date('2026-01-01'), to: new Date('2026-12-31'),
    pdfsOk: 1, pdfsTotal: 1, xmlAnios: [], cabecera: [],
    datasets: undefined,
  });
  assert.ok(leeme.includes('Finanzas'), 'debe decir dónde está ahora la descarga suelta');
  assert.ok(!leeme.includes('suelto desde Configuración'), '🔴 el LEEME manda al usuario a donde ya no está');
});
