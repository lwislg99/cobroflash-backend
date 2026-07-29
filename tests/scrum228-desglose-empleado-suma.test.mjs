// SCRUM-228 · el invariante del desglose por empleado (sin gate: función pura, ni BD ni red).
//
//     filas por empleado + «Sin asignar»  ===  el total de la pantalla, SIEMPRE
//
// Un informe cuyas partes no suman el total es peor que no tener informe: quien lo abre ve que
// no cuadra y deja de fiarse de TODOS los números, incluidos los correctos. El invariante no es
// una comprobación de calidad, es la definición de que la pantalla sirva para algo.
//
// SUELO ANTI-VERDE-HUECO. Los asserts de suma pasan trivialmente sobre datos que no contienen
// el caso difícil: si ninguna factura del escenario viene sin presupuesto, «las partes suman»
// no significa que el reparto sea correcto, significa que el test no ha mirado. Por eso cada
// escenario declara y COMPRUEBA que trae facturas de los dos tipos antes de sumar nada.
import test from 'node:test';
import assert from 'node:assert/strict';

const {
  desglosarPorEmpleado, aCentimos, CLAVE_PROPIETARIO, CLAVE_SIN_ASIGNAR, ETIQUETA_SIN_ASIGNAR,
} = await import('../dist/modules/reports/domain/desgloseEmpleado.js');

/** Escenario realista: propietario, dos empleados, y facturas CON y SIN presupuesto. */
function escenario() {
  return {
    miembros: [{ id: 7, name: 'Marta' }, { id: 9, name: 'Javier' }],
    nombrePropietario: 'Fontanería Pepe',
    invoices: [
      { total: '1200.50', quoteId: 101, quote: { teamMemberId: 7 } },   // Marta
      { total: '300.00',  quoteId: 102, quote: { teamMemberId: 7 } },   // Marta
      { total: '875.25',  quoteId: 103, quote: { teamMemberId: 9 } },   // Javier
      { total: '640.00',  quoteId: 104, quote: { teamMemberId: null } },// el PROPIETARIO
      { total: '410.10',  quoteId: null, quote: null },                 // albarán   → sin asignar
      { total: '99.99',   quoteId: null, quote: null },                 // recapit.  → sin asignar
    ],
    expenses: [
      { amount: '250.00', teamMemberId: 7 },
      { amount: '80.40',  teamMemberId: null },   // null = PROPIETARIO (SCRUM-109), no «sin asignar»
    ],
  };
}

/** El suelo: sin los dos tipos de factura, cualquier verde de abajo no vale nada. */
function exigirLosDosTipos(esc) {
  const con = esc.invoices.filter((i) => i.quoteId != null).length;
  const sin = esc.invoices.filter((i) => i.quoteId == null).length;
  assert.ok(
    con > 0 && sin > 0,
    `🔴 SUELO ANTI-VERDE-HUECO: el escenario tiene ${con} facturas CON presupuesto y ${sin} SIN. ` +
      'Hacen falta las dos. Sin facturas sin presupuesto no existe el caso que rompe la suma, y ' +
      'un verde aquí solo dice que el test no ha mirado — no que el reparto sea correcto.',
  );
  return { con, sin };
}

test('SCRUM-228 · las partes suman el total (ingresos y gastos)', () => {
  const esc = escenario();
  exigirLosDosTipos(esc);

  const { filas, totales } = desglosarPorEmpleado(esc);

  const sumaFilas = (campo) => filas.reduce((a, f) => a + aCentimos(f[campo]), 0);

  assert.equal(
    sumaFilas('revenue'), aCentimos(totales.revenue),
    '🔴 LAS PARTES NO SUMAN EL TOTAL (ingresos). Falta dinero en el reparto: hay facturas que ' +
      'no caen en ninguna fila. Casi siempre es que se están DESCARTANDO las que no se pueden ' +
      'atribuir (el `quoteId: { not: null }` de getTeamMetrics — SCRUM-236) en vez de mostrarlas.',
  );
  assert.equal(
    sumaFilas('expenses'), aCentimos(totales.expenses),
    '🔴 LAS PARTES NO SUMAN EL TOTAL (gastos).',
  );
  assert.equal(sumaFilas('profit'), aCentimos(totales.profit), '🔴 el beneficio no cuadra');
});

test('SCRUM-228 · lo que no se puede atribuir se VE, no se descarta', () => {
  const esc = escenario();
  const { sin } = exigirLosDosTipos(esc);

  const { filas } = desglosarPorEmpleado(esc);
  const sinAsignar = filas.find((f) => f.esSinAsignar);

  assert.ok(
    sinAsignar,
    `🔴 hay ${sin} facturas sin presupuesto y NO aparece la fila «${ETIQUETA_SIN_ASIGNAR}». ` +
      'Descartarlas es lo que hace que las partes no sumen.',
  );
  assert.equal(sinAsignar.key, CLAVE_SIN_ASIGNAR);
  assert.equal(sinAsignar.revenue, 510.09, '🔴 la fila «sin asignar» no recoge TODO lo no atribuible');
});

test('SCRUM-228 · `teamMemberId` null es el PROPIETARIO, no «sin asignar»', () => {
  // Las dos cosas parecen la misma y no lo son. Confundirlas etiquetaría los ingresos del dueño
  // del negocio como «sin asignar» — un error de dinero en su propia cara.
  const { filas } = desglosarPorEmpleado(escenario());

  const propietario = filas.find((f) => f.key === CLAVE_PROPIETARIO);
  assert.equal(propietario.label, 'Fontanería Pepe', '🔴 la fila del propietario lleva el nombre del NEGOCIO');
  assert.equal(
    propietario.revenue, 640,
    '🔴 la factura con `quote.teamMemberId === null` no se ha atribuido al propietario. Si acabó ' +
      'en «sin asignar», se está confundiendo «no hay empleado» con «no hay presupuesto».',
  );
  assert.equal(propietario.expenses, 80.4, '🔴 el gasto con `teamMemberId` null es del propietario (SCRUM-109)');
});

test('SCRUM-228 · sin nada que atribuir, la fila «sin asignar» NO aparece', () => {
  // Enseñarla vacía sugiere un problema que no existe.
  const esc = escenario();
  esc.invoices = esc.invoices.filter((i) => i.quoteId != null);

  const { filas, totales } = desglosarPorEmpleado(esc);
  assert.equal(filas.find((f) => f.esSinAsignar), undefined);
  assert.equal(
    filas.reduce((a, f) => a + aCentimos(f.revenue), 0), aCentimos(totales.revenue),
    '🔴 y aun así las partes tienen que sumar',
  );
});

test('SCRUM-228 · el invariante aguanta con céntimos que no caen redondos', () => {
  // 0.1 + 0.2 !== 0.3 en coma flotante. El reparto se hace en céntimos enteros justamente para
  // que el invariante se pueda exigir EXACTO y no con una tolerancia donde esconder el fallo.
  const esc = {
    miembros: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }],
    nombrePropietario: 'Negocio',
    invoices: [
      { total: '0.10', quoteId: 1, quote: { teamMemberId: 1 } },
      { total: '0.20', quoteId: 2, quote: { teamMemberId: 2 } },
      { total: '0.07', quoteId: null, quote: null },
    ],
    expenses: [{ amount: '0.01', teamMemberId: null }],
  };
  exigirLosDosTipos(esc);

  const { filas, totales } = desglosarPorEmpleado(esc);
  assert.equal(filas.reduce((a, f) => a + aCentimos(f.revenue), 0), aCentimos(totales.revenue));
  assert.equal(totales.revenue, 0.37);
});

test('SCRUM-228 (autoprueba) · el suelo anti-verde-hueco salta si el escenario pierde el caso difícil', () => {
  const esc = escenario();
  esc.invoices = esc.invoices.filter((i) => i.quoteId != null); // se le quita el caso que duele
  assert.throws(
    () => exigirLosDosTipos(esc),
    /SUELO ANTI-VERDE-HUECO/,
    '🔴 el suelo no salta: entonces no es un suelo, es un adorno',
  );
});
