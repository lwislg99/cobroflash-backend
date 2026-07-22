// SCRUM-25 (B) — `resolverEntregaZip`: cómo se ENTREGA el paquete según los PDF fallidos.
//
// PURO Y SIN GATE a propósito. El caso "paquete incompleto" no se podía cubrir con el test
// de integración (no hay forma fiable de forzar que un PDF falle sin inyectar un flag en
// `ensureInvoicePdf`, que es código fiscal → STOP). Extrayendo la DECISIÓN a una función
// pura, la rama incompleta queda probada de verdad y corre siempre: sin BD, sin staging.
//
// Lo que protege: un paquete al que le faltan facturas NO puede parecer completo. Es un
// entregable para asesoría/inspección — "incompleto pero aparentemente correcto" es peor
// que "fallido".
import test from 'node:test';
import assert from 'node:assert/strict';

const { resolverEntregaZip, MAX_FACTURAS_ZIP } = await import('../dist/modules/exports/domain/exportData.js');

const FECHA = '2026-07-22';

test('SCRUM-25: paquete COMPLETO — sin marcas de incompleto por ninguna vía', () => {
  const e = resolverEntregaZip({ total: 12, fallidos: [], fecha: FECHA });

  assert.equal(e.completo, true);
  assert.equal(e.nombreZip, `yaqu-datos-${FECHA}.zip`);
  assert.ok(!e.nombreZip.includes('INCOMPLETO'), 'el nombre no debe alarmar si está completo');
  assert.equal(e.avisoTxt, null, 'sin fallos no se añade fichero de aviso');
  assert.deepEqual(e.cabeceraLeeme, [], 'sin fallos el LEEME no lleva cabecera de aviso');
});

test('SCRUM-25: paquete INCOMPLETO — el nombre del fichero lo delata sin abrir nada', () => {
  const e = resolverEntregaZip({ total: 10, fallidos: ['2026-CF-003'], fecha: FECHA });

  assert.equal(e.completo, false);
  // La señal que se ve en la carpeta de descargas, sin abrir el ZIP:
  assert.equal(e.nombreZip, `yaqu-datos-INCOMPLETO-${FECHA}.zip`);
  assert.match(e.nombreZip, /INCOMPLETO/);
});

test('SCRUM-25: paquete INCOMPLETO — aviso dentro del ZIP, con cuántas y cuáles', () => {
  const fallidos = ['2026-CF-003', '2026-CF-007', 'J-20260701-AB12'];
  const e = resolverEntregaZip({ total: 20, fallidos, fecha: FECHA });

  assert.ok(e.avisoTxt, 'debe generarse el contenido de AVISO-PAQUETE-INCOMPLETO.txt');
  assert.match(e.avisoTxt, /^PAQUETE INCOMPLETO/, 'el aviso empieza por el titular, no enterrado');
  assert.ok(e.avisoTxt.includes('Faltan 3 de 20'), 'dice cuántas faltan sobre el total');
  for (const f of fallidos) {
    assert.ok(e.avisoTxt.includes(f), `debe nombrar la factura afectada ${f}`);
  }
  assert.ok(
    /no uses este paquete como entrega completa/i.test(e.avisoTxt),
    'debe decir explícitamente que no se entregue como completo',
  );
  // Y ha de aclarar que el dato no se ha perdido: falta el PDF, no la factura.
  assert.ok(e.avisoTxt.includes('csv/facturas.csv'), 'indica dónde sí están esos datos');
});

test('SCRUM-25: paquete INCOMPLETO — el LEEME abre con el aviso, no lo entierra', () => {
  const e = resolverEntregaZip({ total: 5, fallidos: ['2026-CF-001'], fecha: FECHA });

  assert.ok(e.cabeceraLeeme.length > 0, 'el LEEME debe llevar cabecera de aviso');
  assert.match(e.cabeceraLeeme[0], /PAQUETE INCOMPLETO/, 'y esa cabecera es la PRIMERA línea');
  assert.ok(
    e.cabeceraLeeme.some((l) => l.includes('AVISO-PAQUETE-INCOMPLETO.txt')),
    'remite al fichero de aviso',
  );
});

test('SCRUM-25: el aviso escala — un solo fallo o todos, siempre se marca', () => {
  const uno = resolverEntregaZip({ total: 100, fallidos: ['X-1'], fecha: FECHA });
  assert.equal(uno.completo, false, '1 de 100 fallidas YA es incompleto: no se redondea a "va bien"');
  assert.match(uno.nombreZip, /INCOMPLETO/);

  const todas = resolverEntregaZip({ total: 3, fallidos: ['A', 'B', 'C'], fecha: FECHA });
  assert.ok(todas.avisoTxt.includes('Faltan 3 de 3'));
});

test('SCRUM-25: el tope de facturas es una constante única y razonable', () => {
  assert.equal(typeof MAX_FACTURAS_ZIP, 'number');
  assert.ok(MAX_FACTURAS_ZIP > 0 && Number.isInteger(MAX_FACTURAS_ZIP));
  // Provisional (medición §7); si alguien lo sube muchísimo, que sea una decisión consciente
  // y no un descuido: por encima de 1000 el diseño síncrono deja de tener sentido (SCRUM-83).
  assert.ok(MAX_FACTURAS_ZIP <= 1000, 'un tope enorme invalida el diseño síncrono — ver SCRUM-83');
});
