// tests/scrum1730-criterio-caja-huecos-declarados.test.mjs — SCRUM-1730 (sale de SCRUM-1240 c.21773)
//
// Sin gate: ni BD, ni red. EJECUTA el libro registro y el 303 reales (`dist/`) contra una base en
// memoria, como `scrum294b`. No importa nada del camino de emisión (regla 38): sólo los libros.
//
// 🔴 ESTO NO ES UN VERDE QUE BENDICE EL COMPORTAMIENTO DE HOY. Es un TRINQUETE DE DOS DEFECTOS
// CONOCIDOS del criterio de caja, reproducidos con casos fabricados:
//
//   (i)  S2 · LIVA 163 duodecies.Dos.d deja fuera del régimen las operaciones con inversión del
//        sujeto pasivo. Hoy el libro aplica el cobro a TODAS las facturas del merchant: una factura
//        con una línea `causa: 'S2'`, emitida en un trimestre y cobrada en otro, cae en el del cobro.
//   (ii) 31-DIC · LIVA 163 terdecies.Uno: sin cobro, el devengo se produce el 31 de diciembre del año
//        inmediato posterior. Hoy `fechaDeDevengo` devuelve `null` y el libro no la trae nunca.
//
// El tercer hueco de 1730 —vivo contra congelado— no se puede reproducir: depende de la columna que
// trae el PR de SCRUM-1129, que no está en `main`. Lo describe el registro, no este fichero.
//
// Cómo trabaja, por hueco (A23 · 7):
//   · DECLARADO + defecto presente → verde, y dice que es un defecto conocido, no una conformidad.
//   · DECLARADO + el comportamiento cambió → ROJO: si es el arreglo (GO del fundador, 1730), el mismo
//     cambio retira su declaración de `DEFECTO_CONOCIDO`; si no, es un cambio del libro sin decidir.
//   · RETIRADO + defecto presente → ROJO: retirar la declaración no es arreglarlo.
//   · RETIRADO + arreglado → verde: el trinquete ha cumplido; el test del arreglo es de quien lo haga.
//   · MEDIO arreglo (ii: la función sí y el libro no, o al revés) → ROJO siempre.
//   · los controles positivos no salen → CIEGO, que es ROJO, nunca verde.
import test from 'node:test';
import assert from 'node:assert/strict';
import { leerLibroRegistro } from '../dist/modules/invoicing/domain/libroRegistro.repo.js';
import { leerModelo303 } from '../dist/modules/fiscal/modelo303/modelo303.repo.js';
import { fechaDeDevengo, CAMPO_COBRO } from '../dist/modules/invoicing/domain/devengoPorCaja.js';
import { rangoTrimestre } from '../dist/modules/fiscal/modelo303/modelo303.js';

/**
 * 🔴 LA DECLARACIÓN DE LOS DOS DEFECTOS. Quien arregle uno retira SU entrada en el mismo cambio
 * (`declarado: false` o borrándola). Mientras esté, cualquier cambio de ese comportamiento tumba esto.
 */
export const DEFECTO_CONOCIDO = {
  s2: { declarado: true,
    tickets: ['SCRUM-1730'],
    que: 'con criterio de caja, una factura con líneas S2 devenga por cobro como las demás (LIVA 163 duodecies.Dos.d la excluye)' },
  tope31dic: { declarado: true,
    tickets: ['SCRUM-1730'],
    que: 'con criterio de caja y sin cobro, la factura no devenga nunca (LIVA 163 terdecies.Uno: el 31-dic del año siguiente)' },
};

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // (i) Un arreglo con la forma que tendría: las S2 se leen por emisión y se quitan de las de cobro.
    fichero: 'src/modules/invoicing/domain/libroRegistro.repo.ts',
    de: '  // SCRUM-1232 · fuera los justificantes, pero SÓLO',
    a: "  if (campo !== CAMPO_EMISION && Object.keys(fecha).length > 0) { const esS2 = (f: any) => Array.isArray(f.lines) && f.lines.some((l: any) => l?.causa === 'S2'); const porEmision = (await db.invoice.findMany({ where: { merchantId: rango.merchantId, createdAt: fecha }, select: CAMPOS_FACTURA })) as any[]; leidas.splice(0, leidas.length, ...leidas.filter((f: any) => !esS2(f)), ...porEmision.filter(esS2)); }\n  // SCRUM-1232 · fuera los justificantes, pero SÓLO",
    cae: 'SCRUM-1730 · (i) una factura S2 sigue devengando por cobro: defecto declarado',
  },
  {
    // (ii) Medio arreglo: la función da el 31-dic y el libro sigue sin traerla. No vale.
    fichero: 'src/modules/invoicing/domain/devengoPorCaja.ts',
    de: '  return factura.paidAt ?? null;',
    a: '  return factura.paidAt ?? new Date(factura.createdAt.getFullYear() + 1, 11, 31, 12);',
    cae: 'SCRUM-1730 · (ii) una factura sin cobro sigue sin devengar el 31-dic del año siguiente: defecto declarado',
  },
  {
    // La caja desconectada: el control positivo (una S1 cobrada en Q2 cae en Q2) no sale → CIEGO.
    fichero: 'src/modules/invoicing/domain/libroRegistro.repo.ts',
    de: "  const campo = 'criterioCaja' in rango ? campoDeDevengo(rango.criterioCaja) : CAMPO_EMISION;",
    a: '  const campo = CAMPO_EMISION;',
    cae: 'SCRUM-1730 · (i) una factura S2 sigue devengando por cobro: defecto declarado',
  },
  {
    // Se retira la declaración de (i) y el defecto sigue.
    fichero: 'tests/scrum1730-criterio-caja-huecos-declarados.test.mjs',
    de: 'DEFECTO_CONOCIDO = {\n  s2: { declarado: true,',
    a: 'DEFECTO_CONOCIDO = {\n  s2: { declarado: false,',
    cae: 'SCRUM-1730 · (i) una factura S2 sigue devengando por cobro: defecto declarado',
  },
  {
    // Se retira la declaración de (ii) y el defecto sigue.
    fichero: 'tests/scrum1730-criterio-caja-huecos-declarados.test.mjs',
    de: '  },\n  tope31dic: { declarado: true,',
    a: '  },\n  tope31dic: { declarado: false,',
    cae: 'SCRUM-1730 · (ii) una factura sin cobro sigue sin devengar el 31-dic del año siguiente: defecto declarado',
  },
];

// ── La base en memoria: responde al `where` como Postgres (mismo doble que `scrum294b`) ─────────

const MERCHANT = 7;

export function baseCon(facturas, { criterioCaja = true } = {}) {
  const cumple = (v, f) => !f || ((!f.gte || (v && v >= f.gte)) && (!f.lte || (v && v <= f.lte)));
  return {
    merchant: { async findUnique() { return { id: MERCHANT, criterioCaja }; } },
    invoice: {
      async findMany(args) {
        const w = args.where || {};
        return facturas.filter((f) => f.merchantId === w.merchantId
          && cumple(f.createdAt, w.createdAt) && cumple(f.paidAt, w.paidAt));
      },
    },
    quote: { async findMany() { return []; } },
    albaran: { async findMany() { return []; } },
    expense: { async findMany() { return []; } },
  };
}

const factura = (id, number, createdAt, paidAt, lines) => ({
  id, merchantId: MERCHANT, number, createdAt, paidAt, type: 'F1', total: '1000.00', currency: 'EUR',
  status: paidAt ? 'paid' : 'pending', customerId: 3, quoteId: null, chargeId: null, albaranRefs: null, lines,
});

// (i): emitidas el 15-feb-2027 (Q1) y cobradas el 20-may-2027 (Q2). La S1 es el control positivo.
const EMISION_I = new Date(2027, 1, 15, 12);
const COBRO_I = new Date(2027, 4, 20, 12);
const S2 = factura(1, 'F-S2', EMISION_I, COBRO_I, [{ qty: 1, price: 1000, tax: 0, causa: 'S2' }]);
const S1 = factura(2, 'F-S1', EMISION_I, COBRO_I, [{ qty: 1, price: 1000, tax: 0.21 }]);

// (ii): emitida el 10-mar-2026 y sin cobro → su tope es el 31-dic-2027 (Q4 de 2027).
const SIN_COBRO = factura(3, 'F-SIN-COBRO', new Date(2026, 2, 10, 12), null, [{ qty: 1, price: 1000, tax: 0.21 }]);
const TOPE = { año: 2027, trimestre: 4 };

const numeros = (libro) => libro.asientos.map((a) => a.numero);

/** (i) Mide en qué trimestre caen la S2 y la S1, en el libro y en la casilla 122 del 303. */
export async function medirS2(facturas = [S2, S1]) {
  const db = baseCon(facturas);
  const q = {};
  for (const t of [1, 2]) {
    const libro = await leerLibroRegistro(db, { merchantId: MERCHANT, ...rangoTrimestre(2027, t), criterioCaja: true });
    const m303 = await leerModelo303(db, { merchantId: MERCHANT, año: 2027, trimestre: t });
    q[t] = { libro: numeros(libro), c122: m303.informacionAdicional.inversionSujetoPasivo.operaciones.map((o) => o.numero) };
  }
  const en = (n) => [1, 2].filter((t) => q[t].libro.includes(n));
  const s1 = en('F-S1');
  const s2 = en('F-S2');
  const s2En303 = [1, 2].filter((t) => q[t].c122.includes('F-S2'));
  const poblacion = `${facturas.length} factura(s) · libro y 303 de 2027-Q1 y Q2 · S1 en [${s1}] · S2 en libro [${s2}] y casilla 122 [${s2En303}]`;
  // Control positivo: la caja tiene que estar ENCENDIDA (la S1 en el trimestre del cobro y sólo ahí)
  // y la S2 tiene que existir en algún sitio. Si no, lo de la S2 no dice nada.
  if (s1.join() !== '2' || s2.length === 0) return { estado: 'CIEGO', poblacion };
  if (s2.join() === '2' && s2En303.join() === '2') return { estado: 'DEFECTO', poblacion };
  if (s2.join() === '1' && s2En303.join() === '1') return { estado: 'ARREGLADO', poblacion };
  return { estado: 'MEDIO', poblacion };
}

/** (ii) Mide la función y el libro del trimestre que contiene el 31-dic del año siguiente. */
export async function medirTope(sinCobro = SIN_COBRO) {
  const fecha = fechaDeDevengo(sinCobro, CAMPO_COBRO);
  const tope = new Date(sinCobro.createdAt.getFullYear() + 1, 11, 31);
  const esElTope = fecha instanceof Date && fecha.getFullYear() === tope.getFullYear()
    && fecha.getMonth() === 11 && fecha.getDate() === 31;
  const rango = rangoTrimestre(TOPE.año, TOPE.trimestre);
  const enElTope = numeros(await leerLibroRegistro(baseCon([sinCobro]), { merchantId: MERCHANT, ...rango, criterioCaja: true }))
    .includes(sinCobro.number);
  // Controles positivos: la misma factura COBRADA en ese trimestre sale en él, y sin caja sale por
  // emisión. Si no salen, la factura no existe para el libro y el «no está» de arriba no dice nada.
  const cobrada = { ...sinCobro, paidAt: new Date(TOPE.año, 10, 15, 12), status: 'paid' };
  const ctrlCobrada = numeros(await leerLibroRegistro(baseCon([cobrada]), { merchantId: MERCHANT, ...rango, criterioCaja: true }))
    .includes(sinCobro.number);
  const ctrlEmision = numeros(await leerLibroRegistro(baseCon([sinCobro]), { merchantId: MERCHANT, ...rangoTrimestre(2026, 1) }))
    .includes(sinCobro.number);
  const poblacion = `1 factura sin cobro (10-mar-2026) · fechaDeDevengo = ${fecha === null ? 'null' : fecha.toISOString()} · `
    + `libro ${TOPE.año}-Q${TOPE.trimestre} ${enElTope ? 'la trae' : 'no la trae'} · controles cobrada=${ctrlCobrada} emisión=${ctrlEmision}`;
  if (!ctrlCobrada || !ctrlEmision) return { estado: 'CIEGO', poblacion };
  if (fecha === null && !enElTope) return { estado: 'DEFECTO', poblacion };
  if (esElTope && enElTope) return { estado: 'ARREGLADO', poblacion };
  return { estado: 'MEDIO', poblacion };
}

/** El veredicto del trinquete de UN hueco: `{ ok, motivo }`. */
export function juicio(medida, declaracion) {
  const declarado = declaracion?.declarado === true;
  const tickets = (declaracion?.tickets ?? ['SCRUM-1730']).join(', ');
  switch (medida.estado) {
    case 'CIEGO':
      return { ok: false, motivo: `CIEGO: los controles positivos no salen (${medida.poblacion}). No mido nada, y eso no es un verde.` };
    case 'MEDIO':
      return { ok: false, motivo: `MEDIO ARREGLO: ${medida.poblacion}. La función, el libro y el 303 tienen que decir lo mismo.` };
    case 'DEFECTO':
      return declarado
        ? { ok: true, motivo: `DEFECTO CONOCIDO, declarado (${tickets}): ${medida.poblacion}. No es conformidad.` }
        : { ok: false, motivo: `Se retiró la declaración y el defecto sigue: ${medida.poblacion}. Retirarla es parte del arreglo, no lo sustituye.` };
    default:
      return declarado
        ? { ok: false, motivo: `El comportamiento ha CAMBIADO con el defecto todavía declarado (${tickets}): ${medida.poblacion}. `
          + 'Si es el arreglo (con el GO de SCRUM-1730), retira su entrada de DEFECTO_CONOCIDO en este mismo cambio; si no, es un cambio del libro sin decidir.' }
        : { ok: true, motivo: `Declaración retirada y arreglado: ${medida.poblacion}.` };
  }
}

test('SCRUM-1730 · (i) una factura S2 sigue devengando por cobro: defecto declarado', async (t) => {
  const medida = await medirS2();
  t.diagnostic(`estado ${medida.estado} · ${medida.poblacion}`);
  const v = juicio(medida, DEFECTO_CONOCIDO.s2);
  t.diagnostic(v.motivo);
  assert.equal(v.ok, true, `🔴 ${v.motivo}`);
});

test('SCRUM-1730 · (ii) una factura sin cobro sigue sin devengar el 31-dic del año siguiente: defecto declarado', async (t) => {
  const medida = await medirTope();
  t.diagnostic(`estado ${medida.estado} · ${medida.poblacion}`);
  const v = juicio(medida, DEFECTO_CONOCIDO.tope31dic);
  t.diagnostic(v.motivo);
  assert.equal(v.ok, true, `🔴 ${v.motivo}`);
});

test('SCRUM-1730 · cada declaración vigente cita el ticket que la retira', () => {
  for (const [hueco, d] of Object.entries(DEFECTO_CONOCIDO)) {
    if (d?.declarado !== true) continue;
    assert.deepEqual(d.tickets, ['SCRUM-1730'], `la declaración de ${hueco} tiene que citar SCRUM-1730`);
  }
});

// ── Los controles del propio instrumento: el positivo se SIEMBRA aquí, no se toma del árbol ─────

test('SCRUM-1730 · control: sin la S1 (o sin la S2) el hueco (i) dice CIEGO, no verde', async () => {
  assert.equal((await medirS2([S2])).estado, 'CIEGO');
  assert.equal((await medirS2([S1])).estado, 'CIEGO');
});

test('SCRUM-1730 · control: una S2 que el libro sí pone en emisión se reconoce como cambio', async () => {
  // Sembrado: la S2 «arreglada» a mano es una S2 cobrada el mismo trimestre en que se emitió. El
  // libro (por cobro) la pone en Q1, y eso tiene que medirse como ARREGLADO, no como DEFECTO.
  const s2EnQ1 = { ...S2, paidAt: new Date(2027, 2, 1, 12) };
  assert.equal((await medirS2([s2EnQ1, S1])).estado, 'ARREGLADO');
});

test('SCRUM-1730 · control: una factura cobrada en el trimestre del tope deja (ii) en MEDIO, no en DEFECTO', async () => {
  // Sembrado: si la factura «aparece» en el libro del tope pero la función sigue en null, eso es medio
  // arreglo. El instrumento tiene que distinguirlo del defecto entero.
  const cobradaEnElTope = { ...SIN_COBRO, paidAt: new Date(2027, 10, 15, 12), status: 'paid' };
  assert.equal((await medirTope(cobradaEnElTope)).estado, 'MEDIO');
});

test('SCRUM-1730 · control: las casillas del juicio', () => {
  const dec = { declarado: true, tickets: ['SCRUM-1730'] };
  const m = (estado) => ({ estado, poblacion: 'x' });
  assert.deepEqual([
    juicio(m('DEFECTO'), dec).ok, juicio(m('ARREGLADO'), dec).ok,
    juicio(m('DEFECTO'), { ...dec, declarado: false }).ok, juicio(m('ARREGLADO'), undefined).ok,
    juicio(m('MEDIO'), dec).ok, juicio(m('MEDIO'), undefined).ok,
    juicio(m('CIEGO'), dec).ok, juicio(m('CIEGO'), undefined).ok,
  ], [true, false, false, true, false, false, false, false]);
});
