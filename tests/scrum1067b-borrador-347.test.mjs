// tests/scrum1067b-borrador-347.test.mjs — SCRUM-1067b
//
// El borrador del modelo 347 sobre los dos libros del año. Cifras hechas a mano por NIF. Las reglas
// y su cita (RGAT arts. 33-35, Orden EHA/3012/2008) están en la cabecera de `modelo347.ts`:
// umbral ESTRICTO de 3.005,06 €, IVA incluido, entregas y adquisiciones por separado, rectificativas
// con su signo en su trimestre. Los casos pasan por el lector y por los libros DE VERDAD
// (`leerLibroRegistro` con `soloFacturas`, `leerLibroRecibidas`), con una base falsa que sólo sabe
// `findMany` y aplica el `where` que le piden.
import test from 'node:test';
import assert from 'node:assert/strict';

const { leerBorradorModelo347 } = await import('../dist/modules/fiscal/modelo347/modelo347.repo.js');
const { construirModelo347 } = await import('../dist/modules/fiscal/modelo347/modelo347.js');

/** Lo que este test tiene que tumbar (SCRUM-1387: la red de la casa, `npm run meta:mutaciones`). */
export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'src/modules/fiscal/modelo347/modelo347.ts', de: 'if (totalC > UMBRAL_CENTIMOS) {', a: 'if (totalC >= UMBRAL_CENTIMOS) {',
    cae: 'SCRUM-1067b · el borde del umbral' },
  { fichero: 'src/modules/fiscal/modelo347/modelo347.ts', de: 'const UMBRAL_CENTIMOS = 300506;', a: 'const UMBRAL_CENTIMOS = 300000;',
    cae: 'SCRUM-1067b · el borde del umbral' },
  { fichero: 'src/modules/fiscal/modelo347/modelo347.ts', de: "const limpio = nif.replace(/[\\s.\\-]/g, '').toUpperCase();", a: 'const limpio = nif;',
    cae: 'SCRUM-1067b · cifras a mano: 3 NIF por encima y 1 por debajo' },
  { fichero: 'src/modules/fiscal/modelo347/modelo347.ts', de: '    sumar(adquisiciones, nif, p.legalName || p.name, trimestre, g.total);',
    a: '    sumar(entregas, nif, p.legalName || p.name, trimestre, g.total);',
    cae: 'SCRUM-1067b · proveedor que también es cliente' },
  // Las `de` son trozos que `tsc` emite tal cual: una línea de varias sentencias la parte en dist/.
  { fichero: 'src/modules/fiscal/modelo347/modelo347.ts', de: "if (a.estado === 'annulled') {", a: 'if (false) {',
    cae: 'SCRUM-1067b · la anulada se aparta' },
  { fichero: 'src/modules/fiscal/modelo347/modelo347.ts', de: 'if (nif === null) {', a: 'if (false) {',
    cae: 'SCRUM-1067b · lo que no tiene NIF se SEÑALA' },
  { fichero: 'src/modules/fiscal/modelo347/modelo347.ts', de: "señalar('nif_sin_congelar');", a: 'void 0;',
    cae: 'SCRUM-1067b · lo que no tiene NIF se SEÑALA' },
  { fichero: 'src/modules/fiscal/modelo347/modelo347.ts', de: 'acc.trimestres[trimestre - 1] += centimos(total);', a: 'acc.trimestres[trimestre - 1] += centimos(Math.abs(total));',
    cae: 'SCRUM-1067b · la rectificativa resta en SU trimestre' },
  { fichero: 'src/modules/fiscal/modelo347/modelo347.ts', de: 'if (p.merchantId !== merchantId) {', a: 'if (false) {',
    cae: 'SCRUM-1067b · 🔴 regla 2' },
  { fichero: 'src/modules/fiscal/modelo347/modelo347.repo.ts', de: 'where: { merchantId: params.merchantId, id: { in: ids } },',
    a: 'where: { id: { in: ids } },', cae: 'SCRUM-1067b · el lector filtra por merchant' },
  { fichero: 'src/modules/fiscal/modelo347/modelo347.repo.ts', de: 'desde, hasta, soloFacturas: true });', a: 'desde, hasta });',
    cae: 'SCRUM-1067b · el libro son facturas' },
];

const M = 7;
const AÑO = 2025;
let n = 1;

const factura = (o = {}) => ({
  id: n++, merchantId: M, number: `F-${n}`, createdAt: new Date(AÑO, 1, 10, 12), paidAt: null, type: 'F1',
  total: '1000.00', currency: 'EUR', status: 'pending', customerId: 1,
  customerName: 'Cliente', customerLegalName: null, customerTaxId: '11111111H',
  quoteId: null, chargeId: null, albaranRefs: null, lines: [], ...o,
});
const gasto = (o = {}) => ({
  id: n++, merchantId: M, date: new Date(AÑO, 1, 10, 12), concept: 'material', amount: '1210.00', currency: 'EUR',
  providerId: 30, baseAmount: '1000.00', vatRate: 21, vatAmount: '210.00', vatDeducible: true,
  providerInvoiceNumber: `P-${n}`, providerInvoiceDate: null, category: 'materiales', ...o,
});
const proveedor = (o = {}) => ({ id: 30, merchantId: M, name: 'Almacén', legalName: null, taxId: 'B11111111', ...o });

/** Una base falsa que sólo sabe `findMany` y aplica `merchantId`, `id: {in}` y los rangos de fecha. */
function baseFalsa({ facturas = [], gastos = [], proveedores = [] } = {}) {
  const llamadas = [];
  const filtra = (filas) => (args) => {
    const w = args.where ?? {};
    return filas.filter((f) => Object.entries(w).every(([k, v]) => {
      if (v && typeof v === 'object' && !(v instanceof Date)) {
        if (Array.isArray(v.in)) return v.in.includes(f[k]);
        if ('not' in v) return f[k] !== v.not;
        const t = new Date(f[k]).getTime();
        return (v.gte === undefined || t >= v.gte.getTime()) && (v.lte === undefined || t <= v.lte.getTime());
      }
      return v === undefined || f[k] === v;
    }));
  };
  const tabla = (nombre, filas) => ({
    findMany: async (args) => { llamadas.push({ tabla: nombre, args }); return filtra(filas)(args); },
  });
  return {
    llamadas,
    invoice: tabla('invoice', facturas), quote: tabla('quote', []), albaran: tabla('albaran', []),
    expense: tabla('expense', gastos), provider: tabla('provider', proveedores),
  };
}

const leer = (datos, año = AÑO) => leerBorradorModelo347(baseFalsa(datos), { merchantId: M, año });
const porNif = (lado) => Object.fromEntries(lado.declarados.map((t) => [t.nif, t]));
const fecha = (mes, dia = 15) => new Date(AÑO, mes - 1, dia, 12);

test('SCRUM-1067b · cifras a mano: 3 NIF por encima y 1 por debajo', async () => {
  const r = await leer({ facturas: [
    // A: 2.000 en 1T + 1.500 en 3T = 3.500
    factura({ customerTaxId: '22222222J', total: '2000.00', createdAt: fecha(2) }),
    factura({ customerTaxId: '22222222J', total: '1500.00', createdAt: fecha(8) }),
    // B: 3.005,07 en una sola factura → un céntimo por encima
    factura({ customerTaxId: 'B22222222', total: '3005.07', createdAt: fecha(5) }),
    // C: el MISMO NIF con dos formatos → 1.500,03 + 1.505,04 = 3.005,07: sólo supera si suman como uno
    factura({ customerTaxId: 'b-33.333.333', total: '1500.03', createdAt: fecha(10) }),
    factura({ customerTaxId: 'B33333333', total: '1505.04', createdAt: fecha(11) }),
    // D: 3.005,06 justos → NO supera
    factura({ customerTaxId: '44444444A', total: '3005.06', createdAt: fecha(6) }),
  ] });
  const d = porNif(r.entregas);
  assert.equal(r.entregas.clave, 'B');
  assert.deepEqual(Object.keys(d).sort(), ['22222222J', 'B22222222', 'B33333333']);
  assert.equal(d['22222222J'].total, 3500);
  assert.deepEqual(d['22222222J'].trimestres, [2000, 0, 1500, 0]);
  assert.equal(d['B22222222'].total, 3005.07);
  assert.deepEqual(d['B33333333'].trimestres, [0, 0, 0, 3005.07]);
  assert.equal(d['B33333333'].operaciones, 2);
  assert.equal(r.entregas.porDebajo, 1);
  assert.equal(r.umbral.importe, 3005.06);
  assert.match(r.umbral.fuente, /art\. 33\.1/);
  assert.deepEqual(r.señaladas, []);
});

test('SCRUM-1067b · el borde del umbral: 3.005,06 no entra, 3.005,07 sí, en los dos lados', async () => {
  const r = await leer({
    facturas: [factura({ customerTaxId: 'X1', total: '3005.06' }), factura({ customerTaxId: 'X2', total: '3005.07' })],
    gastos: [gasto({ providerId: 30, amount: '3005.06' }), gasto({ providerId: 31, amount: '3005.07' })],
    proveedores: [proveedor({ id: 30, taxId: 'Y1' }), proveedor({ id: 31, taxId: 'Y2' })],
  });
  assert.deepEqual(Object.keys(porNif(r.entregas)), ['X2']);
  assert.deepEqual(Object.keys(porNif(r.adquisiciones)), ['Y2']);
  assert.equal(r.entregas.porDebajo, 1);
  assert.equal(r.adquisiciones.porDebajo, 1);
});

test('SCRUM-1067b · lo que no tiene NIF se SEÑALA, con su dinero', async () => {
  const r = await leer({
    facturas: [
      factura({ number: 'F-SIN', customerTaxId: null, total: '5000.00' }),            // cliente particular sin NIF
      factura({ number: 'F-VIEJA', customerName: null, customerTaxId: null, total: '4000.00' }), // anterior al congelado
    ],
    gastos: [gasto({ providerId: null, amount: '6000.00' }), gasto({ providerId: 32, amount: '7000.00' })],
    proveedores: [proveedor({ id: 32, taxId: '  ' })],
  });
  assert.deepEqual(r.entregas.declarados, []);
  assert.deepEqual(r.adquisiciones.declarados, []);
  const s = r.señaladas.map((x) => [x.sentido, x.motivo, x.total]);
  assert.deepEqual(s, [
    ['entrega', 'sin_nif', 5000], ['entrega', 'nif_sin_congelar', 4000],
    ['adquisicion', 'sin_proveedor', 6000], ['adquisicion', 'sin_nif', 7000],
  ]);
});

test('SCRUM-1067b · proveedor que también es cliente: dos cómputos, cada uno con su umbral', async () => {
  const r = await leer({
    facturas: [factura({ customerTaxId: 'B55555555', total: '2000.00' })],
    gastos: [gasto({ providerId: 30, amount: '2000.00' })],
    proveedores: [proveedor({ id: 30, taxId: 'B-55555555' })],
  });
  // Juntos serían 4.000 y superarían: separados, ninguno llega (RGAT 33.1, párrafo 2.º).
  assert.deepEqual(r.entregas.declarados, []);
  assert.deepEqual(r.adquisiciones.declarados, []);
  assert.equal(r.entregas.porDebajo, 1);
  assert.equal(r.adquisiciones.porDebajo, 1);
  assert.equal(r.adquisiciones.clave, 'A');
});

test('SCRUM-1067b · la rectificativa resta en SU trimestre (arts. 34.4 y 35.2)', async () => {
  const r = await leer({ facturas: [
    factura({ customerTaxId: '66666666B', total: '4000.00', createdAt: fecha(1) }),
    factura({ customerTaxId: '66666666B', type: 'R1', total: '-500.00', createdAt: fecha(4) }),
    // Otra que, con su rectificativa, se queda por debajo: 3.200 − 300 = 2.900
    factura({ customerTaxId: '77777777C', total: '3200.00', createdAt: fecha(1) }),
    factura({ customerTaxId: '77777777C', type: 'R1', total: '-300.00', createdAt: fecha(7) }),
  ] });
  const d = porNif(r.entregas);
  assert.deepEqual(Object.keys(d), ['66666666B']);
  assert.deepEqual(d['66666666B'].trimestres, [4000, -500, 0, 0]);
  assert.equal(d['66666666B'].total, 3500);
  assert.equal(r.entregas.porDebajo, 1);
});

test('SCRUM-1067b · la anulada se aparta y se señala; no suma', async () => {
  const r = await leer({ facturas: [
    factura({ number: 'F-ANUL', customerTaxId: '88888888D', total: '5000.00', status: 'annulled' }),
  ] });
  assert.deepEqual(r.entregas.declarados, []);
  assert.equal(r.entregas.porDebajo, 0);
  assert.deepEqual(r.señaladas.map((x) => [x.referencia, x.motivo]), [['F-ANUL', 'anulada']]);
});

test('SCRUM-1067b · el libro son facturas: el justificante no entra', async () => {
  const r = await leer({ facturas: [factura({ customerTaxId: 'B99999999', total: '5000.00', type: 'JUST' })] });
  assert.deepEqual(r.entregas.declarados, []);
  assert.equal(r.miradas.expedidas, 0);
});

test('SCRUM-1067b · el límite del año: 31-dic a última hora es 4T; el 1-ene siguiente no entra', async () => {
  const r = await leer({ facturas: [
    factura({ customerTaxId: 'B10101010', total: '3100.00', createdAt: new Date(AÑO, 11, 31, 23, 59, 59, 999) }),
    factura({ customerTaxId: 'B10101010', total: '9000.00', createdAt: new Date(AÑO + 1, 0, 1, 0, 0, 0, 0) }),
    factura({ customerTaxId: 'B10101010', total: '9000.00', createdAt: new Date(AÑO - 1, 11, 31, 23, 59, 59, 999) }),
  ] });
  assert.deepEqual(porNif(r.entregas)['B10101010'].trimestres, [0, 0, 0, 3100]);
  // Y el constructor no acepta un asiento de otro año: sería un segundo criterio de fechas.
  assert.throws(() => construirModelo347({
    libro: { asientos: [{ numero: 'F-X', fecha: new Date(AÑO + 1, 0, 1, 0, 0, 0, 0).toISOString(), tipo: 'F1', clienteId: 1,
      clienteCongelado: null, total: 1, moneda: 'EUR', estado: 'pending', importeIlegible: false }], miradas: 1 },
    libroRecibidas: { asientos: [], miradas: 0, sinClasificar: 0, sinClasificarImporte: 0 },
    proveedores: [], merchantId: M, año: AÑO,
  }), /no es del año/);
});

test('SCRUM-1067b · 🔴 regla 2: un proveedor de otro merchant rompe', () => {
  assert.throws(() => construirModelo347({
    libro: { asientos: [], miradas: 0 },
    libroRecibidas: { asientos: [], miradas: 0, sinClasificar: 0, sinClasificarImporte: 0 },
    proveedores: [proveedor({ merchantId: M + 1 })], merchantId: M, año: AÑO,
  }), /regla 2/);
});

test('SCRUM-1067b · el lector filtra por merchant y sólo LEE (emitidas intactas)', async () => {
  const db = baseFalsa({
    facturas: [factura({ customerTaxId: 'B12121212', total: '4000.00' })],
    gastos: [gasto({ providerId: 30, amount: '4000.00' })],
    // El mismo id de proveedor en OTRO merchant: si el lector no filtra, llega y rompe.
    proveedores: [proveedor({ id: 30, taxId: 'B13131313' }), proveedor({ id: 30, merchantId: M + 1, taxId: 'Z' })],
  });
  const r = await leerBorradorModelo347(db, { merchantId: M, año: AÑO });
  assert.deepEqual(Object.keys(porNif(r.adquisiciones)), ['B13131313']);
  for (const l of db.llamadas) assert.equal(l.args.where.merchantId, M, `${l.tabla} sin merchantId`);
  // La base falsa sólo tiene `findMany`: cualquier escritura habría reventado.
  assert.ok(db.llamadas.some((l) => l.tabla === 'provider'));
});

test('SCRUM-1067b · 🔵 CONTROL: un año sin operaciones dice que miró cero, y lleva el aviso', async () => {
  const r = await leer({});
  assert.deepEqual(r.miradas, { expedidas: 0, recibidas: 0 });
  assert.deepEqual(r.entregas.declarados, []);
  assert.equal(r.avisoObligatorio, 'Borrador para tu asesor', 'firmado: SCRUM-1065 c.20813');
  assert.deepEqual(r.gastosFueraDelLibro, { cuantos: 0, importe: 0 });
});
