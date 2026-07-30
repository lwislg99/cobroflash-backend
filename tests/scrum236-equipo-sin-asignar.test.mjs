// SCRUM-236 · el panel de equipo deja de descartar en silencio lo no atribuible.
//
//     filas por empleado + «Sin asignar»  ===  el total cobrado, SIEMPRE, exacto
//
// Es el MISMO invariante que SCRUM-228, aplicado a la otra pantalla que responde la misma
// pregunta — y con el MISMO tratamiento importado, no reimplementado. Si las dos pantallas
// repartieran distinto, el problema no se arreglaría: se duplicaría.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LOS DOS FALLOS QUE ESTE FICHERO VIGILA, Y SON DISTINTOS
//
// ① EL DESCARTE — `getTeamMetrics` traía `quoteId: { not: null }` en la consulta, así que toda
//   factura sin presupuesto desaparecía del reparto. Las partes no sumaban y nada lo decía.
//
// ② LA CONFUSIÓN DE LOS DOS `null` — y es el que muerde al quitar el filtro sin más. La lógica
//   anterior hacía `ensure(tm ?? 0)`, o sea que una factura sin presupuesto caía en la clave 0:
//   **el PROPIETARIO**. Quitar el descarte sin arreglar esto no pierde el dinero, lo peor: se lo
//   carga al dueño del negocio en su propia pantalla. Por eso hay un assert propio para cada uno.
//
// ⚠️ SUELO ANTI-VERDE-HUECO. «Las partes suman» pasa TRIVIALMENTE sobre datos que no contienen
// el caso difícil: si ninguna factura del escenario viene sin presupuesto, el assert de suma no
// significa que el reparto sea correcto, significa que el test no ha mirado. Cada escenario
// DECLARA y COMPRUEBA que trae facturas de los dos tipos antes de sumar nada.
import test from 'node:test';
import assert from 'node:assert/strict';

const { ensamblarMetricasEquipo } = await import('../dist/modules/metrics/domain/metricasEquipo.js');
const { aCentimos, ETIQUETA_SIN_ASIGNAR } = await import('../dist/modules/reports/domain/desgloseEmpleado.js');

const HOY = new Date('2026-07-15T10:00:00Z');
const SEMANA = new Date(HOY.getTime() - 7 * 86_400_000);

/** Escenario realista: propietario, dos operarios, y facturas CON y SIN presupuesto. */
function escenario() {
  return {
    nombrePropietario: 'Fontanería Pepe',
    weekAgo: SEMANA,
    members: [
      { id: 7, name: 'Marta', role: 'tecnico', status: 'active' },
      { id: 9, name: 'Javier', role: 'tecnico', status: 'active' },
    ],
    monthQuotes: [
      { teamMemberId: 7, status: 'accepted', createdAt: HOY },
      { teamMemberId: 7, status: 'sent', createdAt: HOY },
      { teamMemberId: null, status: 'accepted', createdAt: HOY },   // null = PROPIETARIO
      { teamMemberId: 9, status: 'rejected', createdAt: new Date('2026-07-01T10:00:00Z') },
    ],
    paidInvoices: [
      // CON presupuesto → atribuibles
      { total: '1200.50', quoteId: 101, quote: { teamMemberId: 7 } },      // Marta
      { total: '300.00',  quoteId: 102, quote: { teamMemberId: null } },   // PROPIETARIO
      { total: '75.25',   quoteId: 103, quote: { teamMemberId: 9 } },      // Javier
      // SIN presupuesto → «Sin asignar». Es el flujo de Trabajos: albaranes y recapitulativa
      // fijan `quoteId: null` a pelo, así que esto es lo NORMAL, no un borde.
      { total: '480.00',  quoteId: null },
      { total: '19.99',   quoteId: null },
    ],
  };
}

/** El suelo: sin las dos clases de factura, los asserts de abajo no comprueban nada. */
function exigirLosDosTipos(esc) {
  const con = esc.paidInvoices.filter((i) => i.quoteId != null).length;
  const sin = esc.paidInvoices.filter((i) => i.quoteId == null).length;
  assert.ok(con > 0, '🔴 SUELO: el escenario no trae facturas CON presupuesto — no prueba la atribución');
  assert.ok(sin > 0, '🔴 SUELO: el escenario no trae facturas SIN presupuesto — «las partes suman» pasaría en vacío');
  return { con, sin };
}

// ── 1 · EL INVARIANTE ────────────────────────────────────────────────────────────────────
test('SCRUM-236 · las filas + «Sin asignar» suman el total cobrado (céntimos exactos)', () => {
  const esc = escenario();
  exigirLosDosTipos(esc);

  const { members, sinAsignar, totalCollected } = ensamblarMetricasEquipo(esc);
  // El invariante se mide sobre lo que la pantalla puede enseñar: las filas de personas MÁS el
  // cubo no atribuible. Si el cubo no se sumara aquí, el test daría verde con el dinero perdido.
  const suma = members.reduce((a, m) => a + aCentimos(m.collected), 0)
    + aCentimos(sinAsignar?.collected ?? 0);

  assert.equal(
    suma, aCentimos(totalCollected),
    '🔴 LAS PARTES NO SUMAN EL TOTAL. Falta dinero en el reparto: hay facturas cobradas que no ' +
      'caen en ninguna fila. Casi siempre es que se están DESCARTANDO las que no se pueden ' +
      'atribuir (el `quoteId: { not: null }` de la consulta de getTeamMetrics) en vez de ' +
      'mostrarlas en «Sin asignar».',
  );
  // Sin tolerancia a propósito: en céntimos enteros la partición cuadra por construcción, así
  // que cualquier desfase es un fallo de reparto, no de redondeo.
  assert.equal(aCentimos(totalCollected), 207574, 'el total del escenario debe ser 2.075,74 €');
});

// ── 2 · LA CONFUSIÓN DE LOS DOS `null` ───────────────────────────────────────────────────
test('SCRUM-236 · lo no atribuible va a «Sin asignar», NO al propietario', () => {
  const esc = escenario();
  exigirLosDosTipos(esc);

  const { members, sinAsignar } = ensamblarMetricasEquipo(esc);

  assert.ok(
    sinAsignar,
    `🔴 no existe la fila «${ETIQUETA_SIN_ASIGNAR}» y hay facturas sin presupuesto. O se ` +
      'descartaron, o se le cargaron a alguien que no las hizo.',
  );
  assert.equal(
    aCentimos(sinAsignar.collected), aCentimos(480) + aCentimos(19.99),
    '🔴 el importe no atribuible no cuadra: debe ser 499,99 € (480,00 + 19,99)',
  );

  const propietario = members.find((m) => m.role === 'owner');
  assert.equal(
    aCentimos(propietario.collected), aCentimos(300),
    '🔴 EL PROPIETARIO HA ABSORBIDO DINERO QUE NO ES SUYO. `teamMemberId == null` es el ' +
      'propietario, pero `quoteId == null` es «Sin asignar»: son dos cubos distintos. ' +
      'Meterlos juntos le carga al dueño, en su propia pantalla, dinero que nadie sabe de quién ' +
      'es — y encima las partes seguirían sumando, así que el invariante NO lo caza. ' +
      'Por eso este assert existe aparte.',
  );
});

// ── 3 · LA FILA NO ES UNA PERSONA ────────────────────────────────────────────────────────
test('SCRUM-236 · «Sin asignar» no compite por «Mejor del mes» ni sale como operario inactivo', () => {
  const esc = escenario();
  const { members, inactive, sinAsignar } = ensamblarMetricasEquipo(esc);
  assert.ok(sinAsignar, `🔴 no existe el cubo «${ETIQUETA_SIN_ASIGNAR}»: ver el test anterior`);

  // El cubo NO puede colarse entre las personas: el panel deriva de cada fila de `members` una
  // etiqueta de rol, un porcentaje y el badge de mejor del mes. Ahí dentro se pintaría roto.
  assert.ok(
    !members.some((m) => m.name === ETIQUETA_SIN_ASIGNAR),
    '🔴 «Sin asignar» está dentro de `members`: el panel lo pintaría como un operario con rol `sin_asignar`',
  );
  assert.ok(
    !members.some((m) => m.isBest && m.name === ETIQUETA_SIN_ASIGNAR),
    '🔴 un cubo no atribuible no puede ser «mejor del mes»',
  );
  assert.ok(
    !inactive.includes(ETIQUETA_SIN_ASIGNAR),
    '🔴 «Sin asignar» aparece en la lista de operarios inactivos: no es una persona',
  );
});

// ── 4 · SIN NADA QUE ASIGNAR, LA FILA NO APARECE ─────────────────────────────────────────
// No es maquillaje: enseñarla vacía sugiere un problema que no existe. El criterio lo fija
// `desgloseEmpleado.ts:124-128` y aquí solo se comprueba que no se ha perdido al reutilizarlo.
test('SCRUM-236 · sin facturas sin presupuesto, no hay fila «Sin asignar»', () => {
  const esc = escenario();
  esc.paidInvoices = esc.paidInvoices.filter((i) => i.quoteId != null);

  const { members, sinAsignar, totalCollected } = ensamblarMetricasEquipo(esc);
  assert.equal(sinAsignar, null, '🔴 cubo vacío: sugiere un problema inexistente');

  // Y el invariante sigue valiendo en este caso.
  const suma = members.reduce((a, m) => a + aCentimos(m.collected), 0);
  assert.equal(suma, aCentimos(totalCollected), '🔴 las partes no suman sin el cubo');
});
