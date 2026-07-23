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
  assert.match(t, /clientes\.csv\s+Clientes dados de ALTA/, 'clientes.csv debe decir que lista ALTAS');
  assert.match(t, /facturas\.csv\s+Facturas emitidas/);
  assert.match(t, /cobros\.csv\s+Cobros registrados/);
  assert.match(t, /presupuestos\.csv\s+Presupuestos creados/);
});

test('SCRUM-104: con rango, AVISA de que puede faltar un cliente y por qué', () => {
  const t = conRango();

  assert.match(t, /IMPORTANTE/, 'el aviso no puede ir enterrado como una nota más');
  assert.ok(t.includes('no toda tu cartera'), 'debe decir que clientes.csv no es la cartera completa');
  // Lo esencial: que el asesor entienda que NO es un dato perdido.
  assert.ok(t.includes('No es un dato perdido'), 'debe descartar explícitamente la pérdida de datos');
  assert.ok(t.includes('sin acotar fechas'), 'y decir cómo obtener la cartera completa');
});

test('SCRUM-104: SIN rango no se avisa de nada — no hay nada de qué avisar', () => {
  const t = sinRango();

  // Sin filtro no puede faltar ningún cliente: el aviso sería alarmar sin motivo, y un
  // aviso que sale siempre deja de leerse.
  assert.ok(!t.includes('IMPORTANTE'), 'sin rango no debe aparecer el aviso de cartera');
  assert.ok(t.includes('todo tu histórico'), 'y el criterio debe decir que va todo');
  assert.ok(!t.includes('el periodo seleccionado'), 'no debe hablar de un periodo que no existe');
});

test('SCRUM-104: trabajos.csv declara que filtra por fecha de ALTA, no de ejecución', () => {
  // Hallazgo del recon: un trabajo creado en junio y ejecutado en julio NO sale en el
  // paquete de julio. Mientras esa decisión no se revise, al menos queda declarada.
  assert.match(conRango(), /trabajos\.csv.*no de ejecución/s);
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
