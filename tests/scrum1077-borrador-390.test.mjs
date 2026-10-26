// tests/scrum1077-borrador-390.test.mjs — SCRUM-1077
//
// El borrador del 390 es la suma de los cuatro 303 de `main` (decisión del fundador, SCRUM-1077
// c.20726). Los 303 se fabrican aquí con el 303 DE VERDAD (`construirModelo303` sobre libros
// construidos), así que la igualdad «anual = Σ trimestres» se prueba contra el cálculo real, no
// contra un 303 de papel. Cifras a mano del propio ticket. Procedencia de las casillas: `casillas.ts`.
import test from 'node:test';
import assert from 'node:assert/strict';

const { construirModelo390, añoEnMadrid } = await import('../dist/modules/fiscal/modelo390/modelo390.js');
const casillas = await import('../dist/modules/fiscal/modelo390/casillas.js');
const { leerModelo390 } = await import('../dist/modules/fiscal/modelo390/modelo390.repo.js');
const { construirModelo303 } = await import('../dist/modules/fiscal/modelo303/modelo303.js');
const { construirLibroRegistro } = await import('../dist/modules/invoicing/domain/libroRegistro.js');
const { construirLibroRecibidas } = await import('../dist/modules/invoicing/domain/libroRecibidas.js');

/** Lo que este test tiene que tumbar (SCRUM-1387: la red de la casa, `npm run meta:mutaciones`). */
export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'src/modules/fiscal/modelo390/casillas.ts', de: "{ tipo: 21, base: '05', cuota: '06' }", a: "{ tipo: 21, base: '5', cuota: '6' }",
    cae: 'SCRUM-1077 · las casillas son las del impreso LEÍDO' },
  { fichero: 'src/modules/fiscal/modelo390/modelo390.ts', de: '  for (const t of ordenados) {', a: '  for (const t of ordenados.slice(1)) {',
    cae: 'SCRUM-1077 · cifras a mano del ticket' },
  { fichero: 'src/modules/fiscal/modelo390/modelo390.ts', de: 'valor: r2(total47 - total64) }', a: 'valor: r2(total47) }',
    cae: 'SCRUM-1077 · cifras a mano del ticket' },
  { fichero: 'src/modules/fiscal/modelo390/modelo390.ts', de: 'cuota29 += t.ivaDeducible.corrientes.cuota;', a: 'cuota29 += t.ivaDeducible.corrientes.base;',
    cae: 'SCRUM-1077 · cifras a mano del ticket' },
  { fichero: 'src/modules/fiscal/modelo390/modelo390.ts', de: 'const provisional = params.año >= añoEnMadrid(params.ahora);',
    a: 'const provisional = params.año >= params.ahora.getUTCFullYear();',
    cae: 'SCRUM-1077 · año en curso, en hora de Madrid' },
  { fichero: 'src/modules/fiscal/modelo390/modelo390.ts', de: "if (provisional) motivosParaNoFiarse.push('año_en_curso');", a: 'void 0;',
    cae: 'SCRUM-1077 · año en curso, en hora de Madrid' },
  { fichero: 'src/modules/fiscal/modelo390/modelo390.ts', de: '  if (params.año < PRIMER_EJERCICIO_DEL_IMPRESO) {', a: '  if (false) {',
    cae: 'SCRUM-1077 · antes de 2026 no hay impreso citado' },
  { fichero: 'src/modules/fiscal/modelo390/modelo390.ts', de: 'params.trimestres.length !== 4 || vistos.size !== 4', a: 'params.trimestres.length !== 4',
    cae: 'SCRUM-1077 · exige los cuatro trimestres' },
  { fichero: 'src/modules/fiscal/modelo390/modelo390.ts', de: 'for (const m of t.motivosParaNoFiarse) motivosParaNoFiarse.push(`T${t.trimestre}: ${m}`);', a: 'void 0;',
    cae: 'SCRUM-1077 · lo que el 303 no colocó sale declarado' },
  { fichero: 'src/modules/fiscal/modelo390/modelo390.ts', de: 'for (const s of t.sinClasificar) sinClasificar.push({ ...s, trimestre: t.trimestre });', a: 'void 0;',
    cae: 'SCRUM-1077 · lo que el 303 no colocó sale declarado' },
  { fichero: 'src/modules/fiscal/modelo390/modelo390.repo.ts', de: 'año: params.año, trimestre }));', a: 'año: params.año, trimestre: 1 }));',
    cae: 'SCRUM-1077 · el lector pide los cuatro trimestres del 303' },
];

const M = 7;
const AÑO = 2026;
/** 1-mar-2027 a mediodía: 2026 ya está cerrado. */
const AÑO_CERRADO = new Date(Date.UTC(2027, 2, 1, 12));
let n = 0;

/** Una factura emitida en el trimestre `t` con una línea de `base` al `tipo` %. */
const factura = (t, base, tipo = 21, o = {}) => ({
  merchantId: M, number: `2026-CF-${String(++n).padStart(3, '0')}`, createdAt: new Date(AÑO, (t - 1) * 3 + 1, 10, 12),
  type: 'F1', total: (base * (1 + tipo / 100)).toFixed(2), currency: 'EUR', status: 'pending', customerId: 3,
  quoteId: null, chargeId: null, albaranRefs: null, lines: [{ concept: 'Mano de obra', qty: 1, price: base, tax: tipo / 100 }], ...o,
});

/** Un gasto deducible y corriente del trimestre `t`: `base` al 21 %. */
const gasto = (t, base, o = {}) => ({
  merchantId: M, date: new Date(AÑO, (t - 1) * 3 + 1, 5, 9), concept: 'Cable', amount: (base * 1.21).toFixed(2), currency: 'EUR',
  providerId: 3, baseAmount: base.toFixed(2), vatRate: 21, vatAmount: (base * 0.21).toFixed(2), vatDeducible: true,
  providerInvoiceNumber: `P-${++n}`, providerInvoiceDate: new Date(AÑO, (t - 1) * 3 + 1, 4), category: 'materiales', ...o,
});

/** El 303 real de un trimestre. */
function m303(t, facturas, gastos) {
  return construirModelo303({
    libro: construirLibroRegistro({ facturas, merchantId: M }),
    libroRecibidas: construirLibroRecibidas({ gastos, merchantId: M }),
    año: AÑO, trimestre: t,
  });
}

/** El año del ticket: repercutido 210, 105, 0 y 42 · soportado 63, 21, 0 y 10,5 (todo al 21 %). */
const delTicket = () => [
  m303(1, [factura(1, 1000)], [gasto(1, 300)]),
  m303(2, [factura(2, 500)], [gasto(2, 100)]),
  m303(3, [], []),
  m303(4, [factura(4, 200)], [gasto(4, 50)]),
];

const m390 = (trimestres, ahora = AÑO_CERRADO, año = AÑO) => construirModelo390({ año, trimestres, ahora });

test('SCRUM-1077 · las casillas son las del impreso LEÍDO (01-06, 33/34, 47, 48/49, 50/51, 64, 65)', () => {
  assert.deepEqual(casillas.TRIPLETAS_DEVENGADO_390.map((f) => ({ ...f })), [
    { tipo: 4, base: '01', cuota: '02' }, { tipo: 10, base: '03', cuota: '04' }, { tipo: 21, base: '05', cuota: '06' },
  ]);
  assert.deepEqual({ ...casillas.CASILLAS_TOTAL_DEVENGADO_390 }, { base: '33', cuota: '34' });
  assert.equal(casillas.CASILLA_TOTAL_CUOTAS_Y_RECARGO_390, '47');
  assert.deepEqual({ ...casillas.CASILLAS_DEDUCIBLE_CORRIENTES_390 }, { base: '48', cuota: '49' });
  assert.deepEqual({ ...casillas.CASILLAS_DEDUCIBLE_BIENES_INVERSION_390 }, { base: '50', cuota: '51' });
  assert.equal(casillas.CASILLA_SUMA_DEDUCCIONES_390, '64');
  assert.equal(casillas.CASILLA_RESULTADO_REGIMEN_GENERAL_390, '65');
  assert.equal(casillas.PRIMER_EJERCICIO_DEL_IMPRESO, 2026);
  assert.match(casillas.FUENTE_390, /HAC\/27\/2026, Anexo IV.*1761_16563944_14\.png/);
});

test('SCRUM-1077 · cifras a mano del ticket: 210 + 105 + 0 + 42 = 357 y 63 + 21 + 0 + 10,5 = 94,5', () => {
  const r = m390(delTicket());
  assert.deepEqual(r.devengado.porTipo.find((f) => f.tipo === 21), {
    tipo: 21, base: { casilla: '05', valor: 1700 }, cuota: { casilla: '06', valor: 357 },
  });
  assert.deepEqual(r.devengado.totalBase, { casilla: '33', valor: 1700 });
  assert.deepEqual(r.devengado.totalCuota, { casilla: '34', valor: 357 });
  assert.deepEqual(r.devengado.totalCuotasYRecargo, { casilla: '47', valor: 357 });
  assert.deepEqual(r.deducible.corrientes.base, { casilla: '48', valor: 450 });
  assert.deepEqual(r.deducible.corrientes.cuota, { casilla: '49', valor: 94.5 });
  assert.deepEqual(r.deducible.sumaDeducciones, { casilla: '64', valor: 94.5 });
  assert.deepEqual(r.resultadoRegimenGeneral, { casilla: '65', valor: 262.5 }, '357 − 94,5');
  assert.deepEqual(r.trimestres.map((t) => [t.trimestre, t.cuotaDevengada, t.totalADeducir]),
    [[1, 210, 63], [2, 105, 21], [3, 0, 0], [4, 42, 10.5]], 'el trimestre vacío llega como un 303 a cero, no falta');
  assert.deepEqual(r.motivosParaNoFiarse, []);
  assert.equal(r.provisional, false);
});

test('SCRUM-1077 · igualdad: cada casilla del 390 = Σ de su casilla en los cuatro 303 (tipos mezclados)', () => {
  const ts = [
    m303(1, [factura(1, 100, 4), factura(1, 333.33, 21)], [gasto(1, 12.34)]),
    m303(2, [factura(2, 250, 10)], []),
    m303(3, [factura(3, 99.99, 21), factura(3, 10, 10)], [gasto(3, 7.77), gasto(3, 0.01)]),
    m303(4, [], [gasto(4, 1000)]),
  ];
  const r = m390(ts);
  const Σ = (f) => Math.round(ts.reduce((a, t) => a + f(t), 0) * 100) / 100;
  for (const fila of r.devengado.porTipo) {
    const del303 = (t) => t.casillas.find((c) => c.tipo === fila.tipo);
    assert.equal(fila.base.valor, Σ((t) => del303(t).base), `base al ${fila.tipo} %`);
    assert.equal(fila.cuota.valor, Σ((t) => del303(t).cuota), `cuota al ${fila.tipo} %`);
  }
  assert.equal(r.devengado.totalCuota.valor, Σ((t) => t.casillaTotalCuota.valor), '34 = Σ 27');
  assert.equal(r.deducible.corrientes.cuota.valor, Σ((t) => t.ivaDeducible.corrientes.cuota), '49 = Σ 29');
  assert.equal(r.deducible.sumaDeducciones.valor, Σ((t) => t.ivaDeducible.casillaTotalADeducir.valor), '64 = Σ 45');
  assert.equal(r.resultadoRegimenGeneral.valor, Σ((t) => t.resultadoRegimenGeneral.valor), '65 = Σ 46');
  assert.equal(r.devengado.porTipo.find((f) => f.tipo === 4).cuota.valor, 4);
  assert.equal(r.devengado.porTipo.find((f) => f.tipo === 10).cuota.valor, 26);
});

test('SCRUM-1077 · 🔴 CONTROL NEGATIVO: un año cerrado sin actividad → todo a cero y ningún motivo', () => {
  const r = m390([1, 2, 3, 4].map((t) => m303(t, [], [])));
  assert.ok(r.devengado.porTipo.every((f) => f.base.valor === 0 && f.cuota.valor === 0));
  assert.equal(r.resultadoRegimenGeneral.valor, 0);
  assert.equal(r.miradas, 0, 'cero facturas miradas: el cero es «no facturó», y se ve');
  assert.deepEqual(r.motivosParaNoFiarse, []);
  assert.deepEqual(r.sinClasificar, []);
  assert.deepEqual(r.gastosSinClasificar, []);
});

test('SCRUM-1077 · lo que el 303 deja vacío sale vacío, con su motivo', () => {
  const r = m390(delTicket());
  assert.deepEqual(r.deducible.bienesDeInversion, {
    base: { casilla: '50', valor: 0 }, cuota: { casilla: '51', valor: 0 }, vaciaPorque: 'sin_dato_de_bien_de_inversion',
  });
  assert.equal(r.deducible.corrientes.sinDesglosePorque, 'el_303_no_desglosa_el_soportado_por_tipo');
  assert.deepEqual([...r.sinRellenar.casillas], ['84', '86', '95']);
  assert.equal(r.sinRellenar.porque, 'el_303_deja_vacias_de_la_64_a_la_71');
  assert.deepEqual(r.avisos, ['rectificativas_sin_casilla_propia', 'bienes_de_inversion_no_incluidos']);
  assert.equal(r.avisoObligatorio, 'Borrador para tu asesor', 'el aviso del 303 viaja también aquí (firmado: SCRUM-1065 c.20813)');
});

test('SCRUM-1077 · lo que el 303 no colocó sale declarado, con el trimestre del que viene', () => {
  const ts = delTicket();
  ts[2] = m303(3, [factura(3, 80, 0)], [gasto(3, 20, { category: 'herramientas' })]);
  const r = m390(ts);
  assert.deepEqual(r.sinClasificar.map((s) => [s.trimestre, s.tipo, s.base, s.motivo]), [[3, 0, 80, 'tipo_cero']]);
  assert.deepEqual(r.gastosSinClasificar.map((g) => [g.trimestre, g.motivo]), [[3, 'posible_bien_de_inversion']]);
  assert.equal(r.motivosParaNoFiarse.length, 2, '🔴 el 303 del T3 avisa dos veces y el anual se lo ha tragado');
  assert.ok(r.motivosParaNoFiarse.every((m) => m.startsWith('T3: ')));
  assert.equal(r.devengado.totalCuota.valor, 357, 'lo no colocado no entra en ninguna casilla');
});

test('SCRUM-1077 · año en curso, en hora de Madrid: provisional hasta las 00:00 del 1 de enero en Madrid', () => {
  const ultimoMinuto = new Date(Date.UTC(2026, 11, 31, 22, 59, 59)); // 23:59:59 en Madrid (UTC+1)
  const yaEs2027 = new Date(Date.UTC(2026, 11, 31, 23, 0, 0));       // 00:00:00 en Madrid; en UTC sigue siendo 2026
  assert.equal(añoEnMadrid(ultimoMinuto), 2026);
  assert.equal(añoEnMadrid(yaEs2027), 2027);
  const enCurso = m390(delTicket(), ultimoMinuto);
  assert.equal(enCurso.provisional, true);
  assert.deepEqual(enCurso.motivosParaNoFiarse, ['año_en_curso']);
  const cerrado = m390(delTicket(), yaEs2027);
  assert.equal(cerrado.provisional, false, '🔴 en Madrid ya es 2027: el 2026 está cerrado aunque UTC diga otra cosa');
  assert.deepEqual(cerrado.motivosParaNoFiarse, []);
});

test('SCRUM-1077 · exige los cuatro trimestres, uno de cada y del mismo año', () => {
  const ts = delTicket();
  assert.throws(() => m390(ts.slice(0, 3)), /modelo390_trimestres_incompletos/);
  assert.throws(() => m390([ts[0], ts[1], ts[1], ts[3]]), /modelo390_trimestres_incompletos/, '🔴 un trimestre repetido no sustituye al que falta');
  const deOtroAño = construirModelo303({
    libro: construirLibroRegistro({ facturas: [], merchantId: M }),
    libroRecibidas: construirLibroRecibidas({ gastos: [], merchantId: M }), año: 2027, trimestre: 3,
  });
  assert.throws(() => m390([ts[0], ts[1], deOtroAño, ts[3]]), /modelo390_trimestres_incompletos/);
  // POSITIVO del mismo control: en otro orden, los cuatro valen.
  assert.equal(m390([ts[3], ts[1], ts[0], ts[2]]).devengado.totalCuota.valor, 357);
});

test('SCRUM-1077 · antes de 2026 no hay impreso citado: no se pinta con casillas que nadie ha leído', () => {
  const ts2025 = [1, 2, 3, 4].map((t) => construirModelo303({
    libro: construirLibroRegistro({ facturas: [], merchantId: M }),
    libroRecibidas: construirLibroRecibidas({ gastos: [], merchantId: M }), año: 2025, trimestre: t,
  }));
  assert.throws(() => m390(ts2025, AÑO_CERRADO, 2025), /modelo390_sin_impreso_citado/);
});

test('SCRUM-1077 · el lector pide los cuatro trimestres del 303, filtra por merchant y no escribe', async () => {
  const llamadas = [];
  const db = new Proxy({}, {
    get: (_, modelo) => new Proxy({}, {
      get: (_, op) => async (a) => {
        llamadas.push({ op: `${String(modelo)}.${String(op)}`, args: a });
        // El 303 lee el merchant para su criterio de caja (`criterioDelMerchant.ts`), y sin fila para.
        if (String(modelo) === 'merchant') return { id: M };
        return String(op) === 'findMany' ? [] : null;
      },
    }),
  });
  const r = await leerModelo390(db, { merchantId: M, año: AÑO, ahora: AÑO_CERRADO });
  assert.ok(llamadas.every((l) => /\.find(Many|Unique|First)/.test(l.op)), `🔴 el borrador sólo lee: ${llamadas.map((l) => l.op)}`);
  const facturas = llamadas.filter((l) => l.op === 'invoice.findMany');
  assert.equal(facturas.length, 4, 'una lectura del libro por trimestre');
  assert.ok(llamadas.filter((l) => l.op.endsWith('findMany')).every((l) => l.args.where.merchantId === M), '🔴 regla 2');
  const desdes = facturas.map((l) => Object.values(l.args.where).find((v) => v && v.gte)?.gte?.getTime());
  assert.deepEqual(desdes, [0, 3, 6, 9].map((mes) => new Date(AÑO, mes, 1).getTime()), 'T1, T2, T3 y T4, en orden');
  assert.deepEqual(r.trimestres.map((t) => t.trimestre), [1, 2, 3, 4]);
});
