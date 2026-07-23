// SCRUM-104 — LEEME.txt: qué CRITERIO sigue cada fichero del paquete.
//
// PURO Y SIN GATE (mismo motivo que scrum25-entrega-zip): lo que el LEEME dice es parte
// del entregable, porque quien lo lee es un asesor o un inspector. Extraído a función
// pura para poder fijarlo sin BD, sin staging y sin depender de ninguna ventana.
//
// Lo que protege: el paquete puede ser correcto y aun así ILEGIBLE. Si el asesor pide
// "julio" y encuentra una factura de un cliente que no está en clientes.csv, sin una
// explicación no sabe si le falta un dato o si el fichero sigue otra regla. En una
// inspección, "no sé interpretar esto" cuesta lo mismo que un dato ausente.
import test from 'node:test';
import assert from 'node:assert/strict';

const { construirLeeme } = await import('../dist/modules/exports/domain/exportData.js');

const BASE = {
  nombre: 'Fontanería Torres S.L.',
  generado: '2026-07-23T10:00:00.000Z',
  pdfsOk: 5,
  pdfsTotal: 5,
  conXml: false,
  cabecera: [],
};
const conRango = (p = {}) => construirLeeme({ ...BASE, from: new Date('2026-07-01'), to: new Date('2026-07-31'), ...p });
const sinRango = (p = {}) => construirLeeme({ ...BASE, from: null, to: null, ...p });

test('SCRUM-104: cada fichero del paquete declara su criterio, no solo el formato', () => {
  const t = conRango();
  for (const f of ['clientes.csv', 'facturas.csv', 'cobros.csv', 'trabajos.csv', 'presupuestos.csv', 'facturas/']) {
    assert.ok(t.includes(f), `el LEEME debe nombrar ${f}`);
  }
  // El criterio, no solo el nombre: lo que distingue "qué lleva" de "qué hay".
  // FASE 2: ya no lista "altas del periodo" sino los REFERENCIADOS por los documentos.
  assert.match(t, /clientes\.csv\s+Los clientes a los que corresponden/,
    'clientes.csv debe decir que lista los clientes de los documentos del paquete');
  assert.match(t, /facturas\.csv\s+Facturas emitidas/);
  assert.match(t, /cobros\.csv\s+Cobros registrados/);
  assert.match(t, /presupuestos\.csv\s+Presupuestos creados/);
});

test('SCRUM-104 (D4): con rango, EXPLICA por qué no coincide con el CSV suelto', () => {
  const t = conRango();

  // Fase 2: ya no falta ningún cliente, así que el aviso ya no es "puede faltarte uno".
  // Lo que hay que explicar es la DIVERGENCIA, para que nadie la lea como un bug.
  assert.ok(t.includes('SOBRE clientes.csv'), 'la explicación no puede ir enterrada');
  assert.ok(t.includes('aunque los dieras de alta hace años'),
    'debe decir que incluye clientes antiguos si tienen documentos en el rango');
  assert.ok(t.includes('descargas suelto'), 'debe nombrar el otro fichero con el que no coincide');
  assert.ok(t.includes('no un error'), 'y decir explícitamente que la diferencia NO es un fallo');
  assert.ok(t.includes('Fecha de alta'), 'debe remitir a la columna que lo explica (D3)');
});

test('SCRUM-104: SIN rango no se explica nada — no hay divergencia que explicar', () => {
  const t = sinRango();

  // Sin filtro, "referenciados" y "todos" coinciden: el aviso sería ruido, y un aviso
  // que sale siempre deja de leerse.
  assert.ok(!t.includes('SOBRE clientes.csv'), 'sin rango no debe aparecer la explicación');
  assert.ok(t.includes('todo tu histórico'), 'y el criterio debe decir que va todo');
  assert.ok(!t.includes('el periodo seleccionado'), 'no debe hablar de un periodo que no existe');
});

test('SCRUM-106: trabajos.csv declara que filtra por fecha de EJECUCIÓN prevista', () => {
  // Antes filtraba por fecha de alta (SCRUM-104 lo declaraba); SCRUM-106 lo cambió a
  // scheduledAt. Este assert ya no es solo cosmético: el texto SALE de la constante
  // CAMPO_FECHA_TRABAJOS, la misma que usa el filtro, así que cambiar el criterio cambia
  // el texto y hace caer este test. Antes miraba solo el texto y un cambio de criterio
  // sin tocar la línea pasaba en verde — el recordatorio no recordaba nada (SCRUM-108).
  assert.match(conRango(), /trabajos\.csv\s+Trabajos con fecha de ejecución prevista/);
  // Y dice qué se queda fuera, que es lo que el asesor necesita para interpretarlo.
  assert.match(conRango(), /los que aún no se han agendado no salen/);

  // ⚠️ SIN rango NO se filtra por fecha, así que los no agendados SÍ salen: repetir ahí la
  // coletilla sería el paquete mintiendo sobre sí mismo, que es lo que este fichero vigila.
  assert.ok(!sinRango().includes('no se han agendado no salen'),
    'sin rango esa advertencia sería falsa: no hay filtro de fechas que los excluya');
  assert.match(sinRango(), /trabajos\.csv\s+Todos tus trabajos, con o sin fecha/);
});

test('SCRUM-104: el aviso de paquete INCOMPLETO sigue yendo el primero', () => {
  const t = conRango({ cabecera: ['*** PAQUETE INCOMPLETO — faltan 2 de 7 PDF ***', ''] });

  assert.match(t.split('\n')[0], /PAQUETE INCOMPLETO/,
    'si falta un PDF, es lo primero que se lee — por delante de los criterios');
});

test('SCRUM-104: se conserva lo que ya decía el LEEME (formato y XML)', () => {
  const t = conRango();

  assert.ok(t.includes('Fontanería Torres S.L.'), 'el nombre del merchant');
  assert.ok(t.includes('UTF-8 con BOM'), 'el formato de SCRUM-86 no se pierde');
  assert.ok(t.includes('separador ";"'));
  assert.ok(t.includes('5 de 5 PDF'), 'el recuento de PDF');
  assert.ok(t.includes('no incluye el XML'), 'con el flag OFF se dice que no hay XML (regla 24/26)');

  assert.ok(!construirLeeme({ ...BASE, from: null, to: null, conXml: true }).includes('no incluye el XML'),
    'con el flag ON esa nota NO debe aparecer');
});
