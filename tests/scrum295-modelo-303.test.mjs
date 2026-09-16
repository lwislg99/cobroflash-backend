// tests/scrum295-modelo-303.test.mjs — SCRUM-295 (A5) · el modelo 303 con las casillas mapeadas.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL SUELO ES LO MÁS IMPORTANTE DE ESTE FICHERO
//
// Un 303 con todo a cero **no se lee como «no encontré nada»: se lee como una declaración de que
// no facturaste**. Ante Hacienda eso es una afirmación, no un hueco. Es el mismo argumento del
// libro (SCRUM-296) y aquí pesa más, porque el 303 es el documento que se presenta.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL CONTROL POSITIVO VA CALCULADO A MANO
//
// Sin un caso con sus cifras escritas aquí, el mapeo puede estar **cuadrado consigo mismo y
// equivocado**: si el 303 y el test salen del mismo código, los dos se equivocan igual y el verde
// no significa nada.
import test from 'node:test';
import assert from 'node:assert/strict';

const { construirModelo303, rangoTrimestre, AVISO_ORIENTATIVO } =
  await import('../dist/modules/fiscal/modelo303/modelo303.js');
const { TRIPLETAS, CASILLA_TOTAL_CUOTA_DEVENGADA } =
  await import('../dist/modules/fiscal/modelo303/casillas.js');
const { construirLibroRegistro } = await import('../dist/modules/invoicing/domain/libroRegistro.js');

const MIO = 7;

/** Una factura como la que lee el libro. `lines` lleva `tax` en FRACCIÓN (0.21 = 21 %). */
const factura = (o = {}) => ({
  merchantId: MIO,
  number: '2026-CF-001',
  createdAt: new Date(2026, 3, 15, 12, 0, 0),
  type: 'F1',
  total: '121.00',
  currency: 'EUR',
  status: 'pending',
  customerId: 3,
  quoteId: null,
  chargeId: null,
  albaranRefs: null,
  lines: [{ concept: 'Mano de obra', qty: 1, price: 100, tax: 0.21 }],
  ...o,
});

/** El 303 de un juego de facturas, pasando SIEMPRE por el libro. */
function trescientosTres(facturas, { año = 2026, trimestre = 2 } = {}) {
  const libro = construirLibroRegistro({ facturas, merchantId: MIO });
  return { libro, m303: construirModelo303({ libro, año, trimestre }) };
}

/** La casilla `n` del resultado, buscada por número — no por posición. */
function casilla(m303, n) {
  if (m303.casillaTotalCuota.casilla === n) return m303.casillaTotalCuota.valor;
  for (const c of m303.casillas) {
    if (c.casillaBase === n) return c.base;
    if (c.casillaCuota === n) return c.cuota;
    if (c.casillaTipo === n) return c.tipo;
  }
  return undefined;
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL SUELO
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-295 · SUELO: con facturas, el 303 NO puede salir con todas las casillas a cero', () => {
  const { m303 } = trescientosTres([factura(), factura({ number: '2026-CF-002' })]);

  assert.equal(m303.miradas, 2,
    '🔴 el 303 no dice cuántas facturas se miraron. Sin ese número, «todo a cero» significa a la ' +
    'vez «no facturaste» y «no supe leerlo», y el primero es una declaración.');
  assert.ok(m303.casillas.some((c) => c.base > 0 || c.cuota > 0),
    '🔴 hay dos facturas con IVA y TODAS las casillas salen a cero. Un 303 en blanco no es un ' +
    'informe vacío: es una declaración de que no facturaste.');
  assert.equal(m303.motivosParaNoFiarse.length, 0,
    '🔴 un caso limpio se está declarando como poco fiable: el aviso perdería su valor.');
});

test('SCRUM-295 · SUELO: cero facturas es cero de verdad, y se distingue', () => {
  // El hermano positivo. Sin él, «nunca digas cero» daría verde tapando el trimestre sin actividad.
  const { m303 } = trescientosTres([]);
  assert.equal(m303.miradas, 0);
  assert.equal(m303.asientos, 0);
  assert.equal(m303.casillaTotalCuota.valor, 0);
  assert.deepEqual(m303.motivosParaNoFiarse, [],
    '🔴 un trimestre sin actividad se presenta como roto.');
});

test('SCRUM-295 · SUELO: facturas miradas y ningún asiento → el 303 GRITA', () => {
  // El libro descarta las filas sin número; si se descartan todas, el 303 no puede presentarse
  // como una declaración a cero.
  const { m303 } = trescientosTres([factura({ number: null }), factura({ number: '' })]);
  assert.equal(m303.miradas, 2);
  assert.equal(m303.asientos, 0);
  assert.ok(m303.motivosParaNoFiarse.some((s) => /no cuadra/.test(s)),
    '🔴 se revisaron 2 facturas, no salió ningún asiento, y el 303 sale a cero SIN avisar.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// CONTROL POSITIVO · calculado A MANO, con sus casillas
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-295 · CONTROL POSITIVO: un caso calculado a mano, casilla a casilla', () => {
  // ── El caso, hecho con lápiz ────────────────────────────────────────────────────────────
  //   Factura A · 2 × 300,00 al 21 %  → base   600,00 · cuota 126,00
  //   Factura B · 1 × 250,00 al 10 %  → base   250,00 · cuota  25,00
  //              + 1 ×  80,00 al 21 % → base    80,00 · cuota  16,80
  //   Factura C · 1 × 500,00 al  4 %  → base   500,00 · cuota  20,00
  //
  //   21 % → base 600,00 + 80,00 = 680,00 · cuota 126,00 + 16,80 = 142,80  → casillas 07-08-09
  //   10 % → base 250,00                  · cuota  25,00                   → casillas 04-05-06
  //    4 % → base 500,00                  · cuota  20,00                   → casillas 01-02-03
  //   TOTAL cuota devengada = 142,80 + 25,00 + 20,00 = 187,80              → casilla 27
  //   TOTAL base            = 680,00 + 250,00 + 500,00 = 1.430,00
  const { m303 } = trescientosTres([
    factura({ number: 'A', lines: [{ qty: 2, price: 300, tax: 0.21 }] }),
    factura({ number: 'B', lines: [{ qty: 1, price: 250, tax: 0.10 }, { qty: 1, price: 80, tax: 0.21 }] }),
    factura({ number: 'C', lines: [{ qty: 1, price: 500, tax: 0.04 }] }),
  ]);

  assert.equal(casilla(m303, 1), 500.00, '🔴 casilla 01 (base 4 %)');
  assert.equal(casilla(m303, 2), 4,      '🔴 casilla 02 (tipo 4 %)');
  assert.equal(casilla(m303, 3), 20.00,  '🔴 casilla 03 (cuota 4 %)');
  assert.equal(casilla(m303, 4), 250.00, '🔴 casilla 04 (base 10 %)');
  assert.equal(casilla(m303, 5), 10,     '🔴 casilla 05 (tipo 10 %)');
  assert.equal(casilla(m303, 6), 25.00,  '🔴 casilla 06 (cuota 10 %)');
  assert.equal(casilla(m303, 7), 680.00, '🔴 casilla 07 (base 21 %)');
  assert.equal(casilla(m303, 8), 21,     '🔴 casilla 08 (tipo 21 %)');
  assert.equal(casilla(m303, 9), 142.80, '🔴 casilla 09 (cuota 21 %)');
  assert.equal(casilla(m303, 27), 187.80,
    '🔴 casilla 27 (TOTAL cuota devengada) no es la suma de las tres cuotas.');
  assert.equal(m303.totalBase, 1430.00, '🔴 la base total no cuadra con el caso de lápiz.');
});

test('SCRUM-295 · una casilla SIN operaciones sale a 0,00, no desaparece', () => {
  // Un impreso al que le falta la fila del 10 % no es más corto: es uno del que no se sabe si esa
  // fila es cero o si se perdió por el camino.
  const { m303 } = trescientosTres([factura({ lines: [{ qty: 1, price: 100, tax: 0.21 }] })]);
  assert.equal(m303.casillas.length, TRIPLETAS.length);
  assert.equal(casilla(m303, 4), 0, '🔴 la fila del 10 % ha desaparecido en vez de salir a cero.');
  assert.equal(casilla(m303, 1), 0, '🔴 la fila del 4 % ha desaparecido.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL CUADRE CON EL LIBRO · al céntimo (lo exigía A6 y no se pudo hacer entonces)
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-295 · el 303 y el LIBRO cuadran al céntimo, mismo periodo', () => {
  // Si contasen por caminos distintos, un día dirían cifras distintas: el profesional tendría dos
  // documentos oficiales contradictorios —uno para Hacienda, otro para su asesor— sin saber cuál
  // miente. El invariante NO es una igualdad ciega: cada euro del libro está o en una casilla o
  // DECLARADO como no clasificable.
  const facturas = [
    factura({ number: 'A', lines: [{ qty: 3, price: 133.33, tax: 0.21 }] }),
    factura({ number: 'B', lines: [{ qty: 1, price: 77.77, tax: 0.10 }, { qty: 2, price: 9.99, tax: 0.04 }] }),
    factura({ number: 'C', lines: [{ qty: 1, price: 40, tax: 0 }] }),          // sin calificación
    factura({ number: 'D', lines: [{ qty: 1, price: 60, tax: 0.05 }] }),        // tipo sin casilla
    factura({ number: 'E', lines: [] }),                                        // sin desglose
  ];
  const { libro, m303 } = trescientosTres(facturas);

  const baseLibro  = libro.asientos.reduce((a, s) => a + (s.base ?? 0), 0);
  const cuotaLibro = libro.asientos.reduce((a, s) => a + (s.cuota ?? 0), 0);
  const r2 = (n) => Math.round(n * 100) / 100;

  const baseDeclarada = r2(m303.totalBase + m303.sinClasificar.reduce((a, o) => a + o.base, 0));
  const cuotaDeclarada = r2(m303.casillaTotalCuota.valor + m303.sinClasificar.reduce((a, o) => a + o.cuota, 0));

  assert.equal(baseDeclarada, r2(baseLibro),
    `🔴 la base del 303 (${baseDeclarada}) no cuadra con la del libro (${r2(baseLibro)}).\n\n` +
    '  Cada euro del libro tiene que estar en una casilla o declarado sin clasificar. Si falta,\n' +
    '  hay dos documentos oficiales diciendo cosas distintas y nadie sabe cuál miente.');
  assert.equal(cuotaDeclarada, r2(cuotaLibro),
    `🔴 la cuota del 303 (${cuotaDeclarada}) no cuadra con la del libro (${r2(cuotaLibro)}).`);

  // Y el suelo de este mismo test: si el juego de facturas no produjera importes, cuadrarían
  // dos ceros y el cuadre no probaría nada.
  assert.ok(r2(baseLibro) > 0 && r2(cuotaLibro) > 0,
    '🔴 el caso no genera importes: dos ceros cuadran siempre y este test no mediría nada.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LO QUE NO SE ADIVINA (SCRUM-212, aportado)
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-295 · una línea a tipo 0 NO se mete en una casilla: se declara sin clasificar', () => {
  // Sin calificación en la factura no se puede saber si es exenta (E1..E6), no sujeta (N1/N2) o
  // ISP (S2). Un ClaveRegimen adivinado es una declaración falsa.
  const { m303 } = trescientosTres([factura({ number: 'X', lines: [{ qty: 1, price: 300, tax: 0 }] })]);

  assert.equal(m303.casillaTotalCuota.valor, 0);
  assert.equal(m303.totalBase, 0,
    '🔴 una operación sin calificación fiscal ha entrado en una casilla del régimen general.');
  assert.deepEqual(
    m303.sinClasificar.map((o) => ({ numero: o.numero, base: o.base, motivo: o.motivo })),
    [{ numero: 'X', base: 300, motivo: 'tipo_cero' }],
    '🔴 la operación sin calificar no se declara con su número, su base y su motivo.');
  assert.ok(m303.motivosParaNoFiarse.some((s) => /calificación fiscal/.test(s)),
    '🔴 el 303 no avisa de que hay operaciones fuera de las casillas.');
});

test('SCRUM-295 · un tipo SIN casilla (5 %) tampoco se fuerza a la vecina', () => {
  const { m303 } = trescientosTres([factura({ number: 'Y', lines: [{ qty: 1, price: 200, tax: 0.05 }] })]);
  assert.equal(casilla(m303, 1), 0);
  assert.equal(casilla(m303, 4), 0);
  assert.equal(casilla(m303, 7), 0);
  assert.deepEqual(m303.sinClasificar.map((o) => o.motivo), ['tipo_sin_casilla'],
    '🔴 un tipo del 5 % se ha colocado en la casilla más parecida. Redondear un tipo hacia la ' +
    'casilla vecina es declarar mal, y encima queda cuadrado.');
});

test('SCRUM-295 · una factura sin desglose se declara aparte, no se estima', () => {
  const { m303 } = trescientosTres([factura({ number: 'Z', lines: [], total: '500.00' })]);
  assert.deepEqual(m303.sinDesglose, ['Z']);
  assert.equal(m303.casillaTotalCuota.valor, 0,
    '🔴 se ha estimado la cuota de una factura sin líneas.');
  assert.ok(m303.motivosParaNoFiarse.some((s) => /sin desglose/.test(s)));
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL RANGO · un trimestre incluye sus bordes (el error que solo se ve en abril)
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-295 · el trimestre incluye su PRIMER y su ÚLTIMO instante', () => {
  const { desde, hasta } = rangoTrimestre(2026, 2);

  assert.equal(desde.getFullYear(), 2026);
  assert.equal(desde.getMonth(), 3, '🔴 el 2T no empieza en abril');
  assert.equal(desde.getDate(), 1);
  assert.equal(desde.getHours(), 0);
  assert.equal(desde.getMinutes(), 0);
  assert.equal(desde.getSeconds(), 0);
  assert.equal(desde.getMilliseconds(), 0,
    '🔴 el primer instante del trimestre queda FUERA: una factura emitida a las 00:00:00.000 del ' +
    '1 de abril no se declararía en ningún trimestre.');

  assert.equal(hasta.getMonth(), 5, '🔴 el 2T no termina en junio');
  assert.equal(hasta.getDate(), 30, '🔴 el 2T no termina el día 30');
  assert.equal(hasta.getHours(), 23);
  assert.equal(hasta.getMinutes(), 59);
  assert.equal(hasta.getSeconds(), 59);
  assert.equal(hasta.getMilliseconds(), 999,
    '🔴 el último milisegundo del trimestre queda fuera: una factura de las 23:59:59.700 del 30 ' +
    'de junio se caería entre dos declaraciones.');
});

test('SCRUM-295 · los cuatro trimestres son contiguos y no se solapan NI dejan hueco', () => {
  // El hueco de un milisegundo entre trimestres es una factura que no se declara en ninguno, y
  // solo se descubre cuando alguien la busca. Se comprueba el año entero.
  for (let t = 1; t <= 4; t++) {
    const { desde, hasta } = rangoTrimestre(2026, t);
    assert.ok(desde < hasta, `🔴 el trimestre ${t} está del revés`);
    if (t < 4) {
      const siguiente = rangoTrimestre(2026, t + 1).desde;
      assert.equal(siguiente.getTime() - hasta.getTime(), 1,
        `🔴 entre el T${t} y el T${t + 1} hay ${siguiente.getTime() - hasta.getTime()} ms de ` +
        'separación. Con más de 1 ms hay facturas que no caen en ningún trimestre; con menos, ' +
        'hay facturas que se declaran dos veces.');
    }
  }
  // Y el año se cierra: el último instante del 4T es el último del año.
  const cuarto = rangoTrimestre(2026, 4).hasta;
  assert.equal(cuarto.getMonth(), 11);
  assert.equal(cuarto.getDate(), 31);
});

test('SCRUM-295 · el trimestre se construye en hora LOCAL, no en UTC', () => {
  // `new Date('2026-04-01T00:00:00Z')` metería la última hora del 31 de marzo en el 2T cuando el
  // servidor va en UTC+2. Un euro cambiado de declaración, y solo se ve en abril.
  const { desde } = rangoTrimestre(2026, 2);
  assert.equal(desde.getTime(), new Date(2026, 3, 1, 0, 0, 0, 0).getTime(),
    '🔴 el inicio del trimestre no coincide con la medianoche LOCAL del 1 de abril.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL CRUCE CON LOS COBROS · avisa, NO afirma
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-295 · el cruce separa la cuota cobrada de la NO cobrada', () => {
  const { m303 } = trescientosTres([
    factura({ number: 'PAGADA', status: 'paid', lines: [{ qty: 1, price: 100, tax: 0.21 }] }),
    factura({ number: 'PENDIENTE', status: 'pending', lines: [{ qty: 1, price: 200, tax: 0.21 }] }),
  ]);

  assert.equal(m303.cruceConCobros.cuotaDeCobradas, 21.00);
  assert.equal(m303.cruceConCobros.cuotaDeNoCobradas, 42.00,
    '🔴 el 303 no dice cuánta cuota se declara sin haber cobrado. Es lo que ningún facturador ' +
    'puede enseñar, porque no sabe cuándo entra el dinero.');
  assert.equal(m303.cruceConCobros.asientosCobrados, 1);
  assert.equal(m303.cruceConCobros.asientosNoCobrados, 1);

  // Y el cruce NO cambia la declaración: la cuota devengada es la misma la cobres o no.
  assert.equal(m303.casillaTotalCuota.valor, 63.00,
    '🔴 el cruce con los cobros ha alterado la cuota devengada. El devengo es por emisión; ' +
    'liquidar por caja es E5 y NO está construido.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL AVISO OBLIGATORIO (A5) Y LA REGLA 30
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-295 · el aviso de «orientativo» viaja DENTRO del resultado, y va marcado', () => {
  // El diseño (A5) lo declara obligatorio: no somos asesores fiscales. Si viviera en la pantalla,
  // un segundo consumidor —un export, un PDF— podría pintar el 303 sin él.
  const { m303 } = trescientosTres([factura()]);
  assert.equal(m303.avisoObligatorio, AVISO_ORIENTATIVO);
  assert.match(m303.avisoObligatorio, /^\[PENDIENTE microcopy oficial\] /,
    '🔴 el aviso se presenta como texto aprobado y no lo está (regla 30).');
  assert.ok(m303.avisoObligatorio.length > 30, '🔴 el aviso está vacío detrás del marcador.');
});

test('SCRUM-295 · CASILLAS: los números salen del mapa, no de literales sueltos', () => {
  // Si el mapa cambia, este test cambia con él; lo que NO puede pasar es que alguien escriba un
  // número de casilla a mano en otro sitio y los dos se desincronicen.
  assert.equal(CASILLA_TOTAL_CUOTA_DEVENGADA, 27);
  assert.deepEqual(TRIPLETAS.map((t) => [t.tipo, t.base, t.tipoCasilla, t.cuota]), [
    [4, 1, 2, 3],
    [10, 4, 5, 6],
    [21, 7, 8, 9],
  ], '🔴 el mapa de casillas ya no es el de `docs/diseno/bloque-a.md` § A5 (21 % → 07-09, ' +
     '10 % → 04-06, 4 % → 01-03, TOTAL 27). Si cambia de verdad, cambia PRIMERO el documento.');
});
