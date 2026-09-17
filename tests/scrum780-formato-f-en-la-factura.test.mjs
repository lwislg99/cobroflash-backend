// SCRUM-780 · EL FORMATO `F<AA><NNNN>` EN LA FACTURA, POR CORTE DE FECHA.
//
// Sin gate: funciones puras sobre `dist/`. Ni BD, ni red, ni servidor.
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA REGLA QUE MANDA, Y NO ES UNA PREFERENCIA DE FORMATO
//
// REGLA 29: una factura EMITIDA no se edita, no se borra y NO SE RENUMERA. La regla no distingue
// si el merchant era de prueba — distingue si el documento SALIÓ. Por eso `F260001` sólo puede ser
// un CORTE y nunca una migración: ni una sola factura ya emitida cambia de número, en ningún
// entorno, por ningún motivo.
//
// ── LO QUE ESO OBLIGA EN EL CÓDIGO ──────────────────────────────────────────────────────────
// El formato NO puede decidirse por «lo que hay configurado hoy». Tiene que decidirse por LA
// FECHA DE LA FACTURA, que es un dato de la factura y no cambia nunca. Una factura de agosto se
// formatea hoy exactamente igual que se formateó en agosto — y seguirá igual dentro de diez años.
//
// 🔴 EL CONTROL QUE DECIDE es el primero de este fichero: los cinco números REALES medidos en dev
//    (`2026-FG-001..005`, merchant 1, emitidos entre el 19-ago y el 4-sep) tienen que salir byte a
//    byte iguales DESPUÉS del cambio. Si cambia uno solo, el ticket está mal y no hay verde que lo
//    salve. No son inventados: están copiados de la medición, con su fecha.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';

const S = await import('../dist/modules/invoicing/domain/invoiceNumber.service.js');

/**
 * LOS CINCO NÚMEROS REALES, medidos en `yaqu_dev_javier` el 7-sep-2026 (host `acela`), con su
 * fecha de emisión. Copiados de la medición, no inventados: un caso inventado prueba lo que yo
 * creo que hay, y lo que decide es lo que HAY.
 *
 * ⚠️ Fíjate en que el 004 es POSTERIOR al 005 en fecha. No es una errata de la medición: la
 *    secuencia NO va en orden de fecha. Por eso el corte se decide con la fecha de CADA factura y
 *    jamás con «el número es menor que N».
 */
const EMITIDAS_ANTES_DEL_CORTE = Object.freeze([
  { numero: '2026-FG-001', prefijo: 'FG', year: 2026, seq: 1, fecha: '2026-08-19T11:30:00.000Z' },
  { numero: '2026-FG-002', prefijo: 'FG', year: 2026, seq: 2, fecha: '2026-08-23T11:30:00.000Z' },
  { numero: '2026-FG-003', prefijo: 'FG', year: 2026, seq: 3, fecha: '2026-09-02T11:30:00.000Z' },
  { numero: '2026-FG-004', prefijo: 'FG', year: 2026, seq: 4, fecha: '2026-09-04T11:30:00.000Z' },
  { numero: '2026-FG-005', prefijo: 'FG', year: 2026, seq: 5, fecha: '2026-09-03T11:30:00.000Z' },
]);

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL CONTROL QUE DECIDE
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-780 · 🔴 EL QUE DECIDE: las 5 facturas emitidas ANTES del corte conservan su número BYTE A BYTE', () => {
  // SUELO DEL CASO: si la lista se vacía, este test pasa sin comprobar nada y se lee igual de
  // bien. Un cero de comprobaciones no es un verde: es un arnés que no encontró nada.
  assert.equal(EMITIDAS_ANTES_DEL_CORTE.length, 5,
    `🔴 CIEGO: el caso dice tener 5 facturas medidas y tiene ${EMITIDAS_ANTES_DEL_CORTE.length}. `
    + 'Sin ellas no se está comprobando la regla 29, se está comprobando la nada.');

  for (const f of EMITIDAS_ANTES_DEL_CORTE) {
    const salida = S.formatInvoiceNumber(f.prefijo, f.year, f.seq, false, new Date(f.fecha));
    assert.equal(salida, f.numero,
      `🔴 REGLA 29 ROTA: la factura ${f.numero} (emitida ${f.fecha}) ahora se formatearía como `
      + `«${salida}». Una factura EMITIDA no se renumera, y no importa que el merchant fuera de `
      + 'prueba: importa que el documento salió. Si esto falla, el corte se está aplicando hacia '
      + 'atrás y el ticket está mal — no hay ningún otro verde que lo salve.');
  }
});

test('SCRUM-780 · 🔴 EL QUE DECIDE (segunda mitad): sin fecha, tampoco se renumera', () => {
  // Hay llamadores que componen SIN fecha (`huecosSerie`, `vistaPreviaSerie`). Si al no saber la
  // fecha el formateador eligiera el formato NUEVO, el detector de huecos dejaría de casar los
  // números viejos y los daría por perdidos. Sin fecha se conserva el comportamiento de siempre.
  for (const f of EMITIDAS_ANTES_DEL_CORTE) {
    assert.equal(S.formatInvoiceNumber(f.prefijo, f.year, f.seq), f.numero,
      `🔴 sin fecha, ${f.numero} cambia de formato. Los llamadores que componen sin fecha —el `
      + 'detector de huecos, la vista previa— empezarían a no reconocer lo ya emitido.');
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ✅ CONTROL POSITIVO
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-780 · ✅ POSITIVO: una factura POSTERIOR al corte sale en F<AA><NNNN>', () => {
  const despues = new Date('2026-09-07T00:00:00.000Z');
  const salida = S.formatInvoiceNumber('FG', 2026, 1, false, despues);
  assert.equal(salida, 'F260001',
    `🔴 una factura del ${despues.toISOString()} (el día del corte) sale «${salida}» y tenía que `
    + 'salir «F260001». Si el positivo no encuentra ninguna, el barrido no está probado: está vacío.');
});

test('SCRUM-780 · ✅ POSITIVO: el prefijo del merchant YA NO DECIDE el número tras el corte', () => {
  const despues = new Date('2026-09-08T09:00:00.000Z');
  // Los tres prefijos que existen en dev, medidos: FG, QA y CF. Después del corte, el MISMO
  // número para los tres: un solo formato para todos.
  const salidas = ['FG', 'QA', 'CF', null, ''].map(
    (p) => S.formatInvoiceNumber(p, 2026, 7, false, despues),
  );
  assert.deepEqual([...new Set(salidas)], ['F260007'],
    `🔴 el prefijo sigue decidiendo después del corte: ${JSON.stringify(salidas)}. El fundador `
    + 'firmó UN SOLO FORMATO PARA TODOS; si el prefijo aún cambia el número, no se ha retirado.');
});

test('SCRUM-780 · ✅ POSITIVO: el año va delante y a dos cifras, y la secuencia a cuatro', () => {
  const d = (iso) => new Date(iso);
  assert.equal(S.formatInvoiceNumber(null, 2026, 1, false, d('2026-12-31T23:59:59.000Z')), 'F260001');
  assert.equal(S.formatInvoiceNumber(null, 2027, 1, false, d('2027-01-01T00:00:00.000Z')), 'F270001',
    '🔴 el reinicio anual tiene que verse en el número: 2027 empieza F27 y vuelve a 0001.');
  assert.equal(S.formatInvoiceNumber(null, 2026, 42, false, d('2026-10-01T00:00:00.000Z')), 'F260042');
  // Desbordar CRECE, no trunca: truncar daría dos facturas con el mismo número, que es lo único
  // inaceptable. Es la misma decisión que ya tomó SCRUM-592 para P y AB.
  assert.equal(S.formatInvoiceNumber(null, 2026, 10000, false, d('2026-10-01T00:00:00.000Z')), 'F2610000');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL BORDE DEL CORTE — es un instante, y hay que saber de qué lado cae
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-780 · el corte es un INSTANTE, y el propio instante cae del lado nuevo', () => {
  const corte = S.CORTE_FORMATO_F.desde;
  assert.ok(corte instanceof Date,
    '🔴 CIEGO: el corte no es una fecha, así que no se puede saber de qué lado cae nada.');

  const unMsAntes = new Date(corte.getTime() - 1);
  const justo = new Date(corte.getTime());

  assert.equal(S.formatInvoiceNumber('FG', 2026, 9, false, unMsAntes), '2026-FG-009',
    '🔴 un milisegundo ANTES del corte ya es formato nuevo: el corte se está aplicando hacia atrás.');
  assert.equal(S.formatInvoiceNumber('FG', 2026, 9, false, justo), 'F260009',
    '🔴 el instante EXACTO del corte tiene que ser ya formato nuevo. Un corte con el borde abierto '
    + 'deja un hueco de un instante en el que no se sabe qué formato toca.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA RECTIFICATIVA · SIN FIRMAR, SE QUEDA EN R — y aquí está por qué no es cosmético
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-780 · 🔴 la RECTIFICATIVA no entra en el corte: F sin letra CHOCARÍA con la ordinaria', () => {
  const despues = new Date('2026-09-10T10:00:00.000Z');

  // La serie de rectificativas tiene CONTADOR PROPIO (`nextRectInvoiceNumber`) y reinicio anual
  // propio. O sea que la ordinaria y la rectificativa pueden estar las dos en el seq 3 a la vez.
  const ordinaria = S.formatInvoiceNumber(null, 2026, 3, false, despues);
  const rectificativa = S.formatInvoiceNumber(null, 2026, 3, true, despues);

  assert.notEqual(rectificativa, ordinaria,
    '🔴 LA RECTIFICATIVA Y LA ORDINARIA HAN SALIDO CON EL MISMO NÚMERO. No es un problema de '
    + 'estilo: los dos contadores son independientes, así que este choque OCURRE en cuanto un '
    + 'merchant emite tres facturas y tres rectificativas. Con `@@unique([merchantId, number])` '
    + 'la segunda emisión revienta con un 500, y la emisión era válida.');

  assert.equal(rectificativa, '2026-CF-R-003',
    `🔴 la rectificativa ha salido «${rectificativa}». Su letra R NO está firmada por el fundador: `
    + 'se queda como está por omisión, con su contador propio y su reinicio anual propio.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 SUELO — «cero comprobaciones» y «todo bien» no pueden dar el mismo verde
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-780 · 🔴 SUELO: el formateador sabe cambiar de respuesta según la fecha', () => {
  // Un formateador que devolviera SIEMPRE lo mismo pasaría el control que decide (los números
  // viejos no cambian) y fallaría el positivo. Uno que devolviera siempre F pasaría el positivo y
  // fallaría el que decide. Este suelo exige LAS DOS respuestas del MISMO argumento, cambiando
  // sólo la fecha: es lo único que prueba que la fecha DECIDE.
  const antes = new Date('2026-01-15T00:00:00.000Z');
  const despues = new Date('2026-10-15T00:00:00.000Z');
  const a = S.formatInvoiceNumber('FG', 2026, 4, false, antes);
  const b = S.formatInvoiceNumber('FG', 2026, 4, false, despues);

  assert.notEqual(a, b,
    `🔴 CIEGO: con los mismos argumentos y DOS fechas de distinto lado del corte, el formateador `
    + `devuelve «${a}» las dos veces. No está decidiendo por fecha: está devolviendo una constante, `
    + 'y entonces ni el control que decide ni el positivo significan nada.');
  assert.equal(a, '2026-FG-004');
  assert.equal(b, 'F260004');
});

test('SCRUM-780 · 🔴 SUELO: el corte está ACTIVADO y es la fecha firmada', () => {
  assert.ok(S.CORTE_FORMATO_F.desde instanceof Date,
    '🔴 el corte está APAGADO (`desde` no es una fecha). El fundador lo firmó para el 7-sep-2026: '
    + 'un corte apagado deja todo este fichero comprobando un camino que nadie recorre.');
  assert.equal(S.CORTE_FORMATO_F.desde.toISOString(), '2026-09-07T00:00:00.000Z',
    '🔴 la fecha del corte no es la firmada (7-sep-2026). Cambiarla RENUMERA hacia atrás o hacia '
    + 'delante facturas ya emitidas: es un dato del fundador, no una constante de conveniencia.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA SERIE F EMPIEZA EN 0001 — firmado, y es lo que el contador viejo NO puede dar
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-780 · 🔴 EL CASO REAL DE DEV: contador viejo en 6, cero facturas F → sale F260001', () => {
  // Medido el 7-sep-2026 en `yaqu_dev_javier`: el merchant 1 tiene `nextInvoiceNumber = 6` porque
  // gastó `2026-FG-001..005`. Si la serie F saliera de ese contador, su primera factura del
  // formato nuevo sería `F260006` y la serie F nacería con CINCO huecos que nadie podría cerrar
  // jamás — cerrarlos exigiría renumerar, y eso es la regla 29.
  const yaEmitidas = ['2026-FG-001', '2026-FG-002', '2026-FG-003', '2026-FG-004', '2026-FG-005'];
  const seq = S.siguienteSeqDeLaSerieF(yaEmitidas, 2026);
  assert.equal(seq, 1,
    `🔴 la serie F arranca en ${seq} y tenía que arrancar en 1. Las cinco de dev son de la serie `
    + 'VIEJA: no cuentan para la nueva, que el fundador firmó que empieza en 0001.');
  assert.equal(S.formatInvoiceNumber(null, 2026, seq, false, new Date('2026-09-07T10:00:00.000Z')),
    'F260001');
});

test('SCRUM-780 · la serie F es CORRELATIVA dentro de sí misma, y no la confunde el año', () => {
  assert.equal(S.siguienteSeqDeLaSerieF([], 2026), 1, '🔴 sin nada emitido, empieza en 1.');
  assert.equal(S.siguienteSeqDeLaSerieF(['F260001'], 2026), 2);
  assert.equal(S.siguienteSeqDeLaSerieF(['F260001', 'F260002', 'F260003'], 2026), 4);
  // Toma el MÁXIMO, no el recuento: si faltara una, contar daría un número YA USADO.
  assert.equal(S.siguienteSeqDeLaSerieF(['F260001', 'F260003'], 2026), 4,
    '🔴 con un hueco, contar en vez de tomar el máximo devolvería 3 — un número ya emitido, y el '
    + 'índice `@@unique([merchantId, number])` tumbaría la emisión con un 500.');
  // Reinicio anual: lo del año pasado no cuenta para éste.
  assert.equal(S.siguienteSeqDeLaSerieF(['F260001', 'F260002'], 2027), 1,
    '🔴 la serie de 2027 tiene que empezar en 1: el reinicio anual es de la serie, no del formato.');
  // Ni las viejas, ni las rectificativas, ni los justificantes cuentan para la serie F.
  assert.equal(S.siguienteSeqDeLaSerieF(
    ['2026-CF-009', '2026-CF-R-004', 'J-20260907-1234', 'P260007', 'AB260003'], 2026), 1,
    '🔴 algo que NO es de la serie F ha entrado en su contador.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA VISTA PREVIA · si promete un número distinto del que sale, es peor que no prometer ninguno
// ═════════════════════════════════════════════════════════════════════════════════════════════

const V = await import('../dist/modules/invoicing/domain/vistaPreviaSerie.js');

test('SCRUM-780 · 🔴 la vista previa enseña el número que DE VERDAD va a salir', () => {
  const par = { invoiceSeriesYear: 2026, nextInvoiceNumber: 6 };   // el merchant 1 de dev
  const ahora = new Date('2026-09-07T10:00:00.000Z');

  // Con la secuencia DERIVADA (1), la pantalla dice lo mismo que emitirá el emisor.
  assert.equal(V.vistaPreviaSerie('FG', par, 2026, false, ahora, 1), 'F260001');

  // Y ANTES del corte sigue diciendo exactamente lo de siempre.
  assert.equal(V.vistaPreviaSerie('FG', par, 2026, false, new Date('2026-08-01T00:00:00.000Z')),
    '2026-FG-006', '🔴 antes del corte la vista previa tiene que seguir siendo la de siempre.');
});

test('SCRUM-780 · 🔴 la vista previa NO adivina: sin la secuencia derivada, LANZA', () => {
  const par = { invoiceSeriesYear: 2026, nextInvoiceNumber: 6 };
  assert.throws(
    () => V.vistaPreviaSerie('FG', par, 2026, false, new Date('2026-09-07T10:00:00.000Z')),
    /seqF/,
    '🔴 sin `seqF` la vista previa ha devuelto un número en vez de lanzar. Habría enseñado '
    + '`F260006` —el contador de la serie vieja— mientras la emisión saca `F260001`. Esta pantalla '
    + 'es la puerta de última oportunidad: prometer un número que no va a salir es peor que no '
    + 'prometer ninguno, porque el profesional confirma creyendo que sabe qué confirma.');
});
