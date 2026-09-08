// tests/scrum768-listas-sin-atajo.test.mjs — SCRUM-768
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL ATAJO «N» NO SE HEREDA. ESTO HACE QUE OLVIDARLO NO PUEDA PASAR EN SILENCIO.
//
// SCRUM-599 dejó UN mecanismo (`atajoNuevo`) y CUATRO listas cableadas a mano: cada vista llama a
// `registrar(vista, accion)` al montarse. Eso es una decisión, no un descuido — un atajo que
// buscara «el botón primario de la cabecera» podría pulsar «Guardar» o «Cargar catálogo», y
// adivinar qué botón abre una creación es peor que no tener atajo.
//
// 🔴 PERO ENTONCES NADA LO HEREDA, y lo que no se hereda se olvida. Medido sobre el DOM ejecutado
// el 6-sep-2026: de las vistas del panel con un botón primario de crear, **CINCO no registran
// destino** — y ninguna de las cinco tiene a nadie que lo diga.
//
// Este censo es el escalón que sí se puede pagar: no hace el atajo heredable —eso exige adivinar—
// pero hace **imposible añadir una lista con botón de crear y que su ausencia pase inadvertida**.
// El día que alguien registre una de las cinco, o añada una sexta, este fichero lo dice.
//
// ── LO QUE ESTE CENSO **NO** HACE ────────────────────────────────────────────────────────────
// ⛔ NO registra el atajo en ninguna de las cinco. Cuatro de sus rótulos («Trabajo nuevo»,
//    «+ Nuevo gasto», «Crear producto», «Crear proveedor») no siguen el patrón «Nuevo X» de los
//    tres que el fundador firmó el 4-sep, así que unificarlos es COPY NUEVO y lo firma él
//    (regla 30). Está en su propio ticket.
// ⛔ NO toca `SIN_APROBAR` ni el rótulo con marcador de Albaranes: es de SCRUM-606 y espera firma.
//
// ── EL LÍMITE, DECLARADO ─────────────────────────────────────────────────────────────────────
// El criterio de «botón de crear» es TEXTUAL (`nuevo|nueva|crear` dentro de un `.btn-primary`).
// No hay forma estructural de distinguir «crear» de «guardar» en este panel: no existe atributo
// ni clase que lo marque. Consecuencia real: si alguien renombra un botón a algo sin esas
// palabras, este censo deja de verlo. Lo que lo tapa es el SUELO — la población de botones de
// crear no puede encogerse — y que las cuatro listas registradas se comprueban POR NOMBRE.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos, datosDeMuestra } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Un botón primario cuyo texto anuncia una creación. Criterio TEXTUAL — ver el límite arriba. */
const VERBO_DE_CREAR = /\b(nuev[oa]s?|crear)\b/i;

/**
 * La población: las vistas que el banco publica. NINGUNA lista a mano — una lista escrita
 * envejece y el guard pasa a comprobar lo que escribí en vez de lo que hay (SCRUM-698).
 */
function vistasDelBanco(extra = null) {
  const b = cargarDashboard(RAIZ);
  // El inyector de los controles se aplica TAMBIÉN aquí: si sólo se aplicara al montar, la vista
  // de mentira nunca entraría en la población y el control positivo sería imposible de pasar por
  // un motivo que no tiene nada que ver con lo que mide.
  if (extra) extra(b);
  return Object.keys(b.ctx)
    .filter((k) => /^render[A-Z].*View$/.test(k) && typeof b.ctx[k] === 'function')
    .sort();
}

/**
 * El censo, sobre el DOM EJECUTADO de cada vista.
 *
 * 🔴 Una vista que no se monta va a `ciegas`, NO se salta: «no tiene botón de crear» y «no supe
 * mirarla» se escriben igual, y el segundo se leería como un verde.
 */
async function censar(extra = null) {
  const conCrear = [];
  const sinAtajo = [];
  const ciegas = [];
  const vistas = vistasDelBanco(extra);
  for (const fn of vistas) {
    const banco = cargarDashboard(RAIZ, { datos: datosDeMuestra });
    if (extra) extra(banco);
    const r = await pintarVista(banco, fn);
    if (r.error) { ciegas.push(`${fn} → ${String(r.error.message).slice(0, 70)}`); continue; }
    const botones = todos(r.contenedor).filter((n) => n.tagName === 'BUTTON'
      && /btn-primary/.test(n.className || '') && VERBO_DE_CREAR.test(n.textContent || ''));
    if (botones.length === 0) continue;
    conCrear.push(fn);
    const registradas = banco.ctx.atajoNuevo ? banco.ctx.atajoNuevo.vistasConAtajo() : [];
    if (registradas.length === 0) sinAtajo.push(fn);
  }
  return { vistas, conCrear: conCrear.sort(), sinAtajo: sinAtajo.sort(), ciegas: ciegas.sort() };
}

// ═══ ① EL SUELO — sin él, un cero no es un dato ══════════════════════════════════════════════

test('SCRUM-768 · SUELO: el censo VE las vistas, VE los botones de crear y no se queda ciego', async () => {
  const c = await censar();
  assert.ok(c.vistas.length >= 20,
    `🔴 CIEGO: sólo ${c.vistas.length} vistas en la población. Todo lo de abajo se apoya en esto.`);
  assert.ok(c.conCrear.length >= 8,
    `🔴 CIEGO: sólo ${c.conCrear.length} vistas con botón primario de crear. El criterio es TEXTUAL `
    + '(`nuevo|nueva|crear`): si alguien renombró los botones, este censo se ha quedado sordo y su '
    + `cero de abajo no significaría nada. Vistas vistas: ${c.conCrear.join(', ')}.`);
  assert.deepEqual(c.ciegas, [],
    `🔴 estas vistas NO se montan, así que el censo no puede afirmar nada sobre ellas: `
    + `${c.ciegas.join(' · ')}. Una vista que no se mira no es una vista sin defectos.`);
});

test('SCRUM-768 · SUELO: las SEIS que SÍ tienen atajo salen registradas, por nombre', async () => {
  const c = await censar();
  // Si el censo dijera «ninguna sin atajo» porque cree que todas registran, esto lo caza.
  // 🔴 SCRUM-769: eran cuatro y ahora son SEIS — entran `jobs` y `expenses`.
  for (const fn of ['renderQuotesListView', 'renderInvoicesView', 'renderCustomersView',
    'renderAlbaranesView', 'renderJobsView', 'renderExpensesView']) {
    assert.ok(c.conCrear.includes(fn),
      `🔴 «${fn}» ha dejado de tener botón primario de crear, o el censo dejó de verlo.`);
    assert.equal(c.sinAtajo.includes(fn), false,
      `🔴 «${fn}» ya no registra destino para la «N»: el atajo ha dejado de abrir nada en esa `
      + 'pantalla.');
  }
});

test('SCRUM-769 · 🔴 SUELO: NINGUNA vista con botón de crear DESAPARECE del censo', async () => {
  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // 🔴 ESTE SUELO NACE DE UN FALSO VERDE CON FORMA DE PROGRESO, medido hoy.
  //
  // Al renombrar el botón de Gastos, un acento grave dentro de una plantilla cerró el literal:
  // `expensesView.js` dejó de parsear, `renderExpensesView` dejó de publicarse y la vista
  // **desapareció de la población**. El censo pasó de 26 vistas a 25 y de 9 botones de crear a 8
  // — y su lista de «sin atajo» BAJÓ de 5 a 3, que es exactamente lo que este ticket buscaba.
  //
  // O sea: una pantalla ROTA se leía como una pantalla ARREGLADA. El suelo de entonces
  // (`vistas.length >= 20`) no lo veía, porque 25 también es ≥ 20.
  //
  // Se cierra ENUMERANDO: una vista que se cae del censo se nombra, en vez de restarse de un
  // total. Es la misma lección de SCRUM-411 aplicada a la otra mitad del censo.
  // ═══════════════════════════════════════════════════════════════════════════════════════════
  const c = await censar();
  assert.deepEqual(c.conCrear, [
    'renderAlbaranesView',
    'renderCustomersView',
    'renderExpensesView',
    'renderInvoicesView',
    'renderJobDetailView',
    'renderJobsView',
    'renderProductsView',
    'renderProvidersView',
    'renderQuotesListView',
  ],
  '🔴 HA CAMBIADO EL CONJUNTO DE VISTAS CON BOTÓN PRIMARIO DE CREAR.\n'
  + `   Lo que hay ahora: ${c.conCrear.join(', ')}.\n`
  + '   · Si FALTA una: o su fichero ha dejado de parsear —y entonces la pantalla está rota, no '
  + 'arreglada—, o le han quitado el botón, o lo han renombrado a algo que el criterio textual '
  + 'ya no reconoce. Los tres casos hacen BAJAR el censo de «sin atajo» por la razón equivocada.\n'
  + '   · Si hay una NUEVA: bienvenida — mírala en la lista de abajo y decide si le toca atajo.');
});

// ═══ ② EL CENSO — enumera, no cuenta ═════════════════════════════════════════════════════════

test('SCRUM-768 · 🔴 la lista de vistas con botón de crear y SIN atajo no CRECE', async () => {
  const c = await censar();
  // 🔴 ENUMERA, NO CUENTA (lección de SCRUM-411): un número que cuadra no prueba que sean las
  // mismas. Con nombres, una recién llegada se lee de un vistazo.
  // 🔴 SCRUM-769 · BAJA DE CINCO A TRES, y NO a cero. Las dos que salen —`jobs` y `expenses`—
  // tienen un botón primario que ABRE una creación, que es lo que el patrón de SCRUM-599 supone.
  // Las TRES que quedan no lo tienen, y está medido:
  //   · `renderProductsView` y `renderProvidersView`: su botón primario es el SUBMIT de un
  //     formulario en línea siempre visible. La «N» intentaría crear con lo que hubiera escrito.
  //   · `renderJobDetailView`: su botón primario es el CTA del héroe, cuya etiqueta la decide la
  //     escalera de `jobNextAction` según el estado del Trabajo — hoy «+ Nuevo albarán», mañana
  //     «Cobrar el resto». La «N» dispararía lo que tocase, incluido un cobro.
  // Los tres esperan decisión: no se inventa aquí.
  assert.deepEqual(c.sinAtajo, [
    'renderJobDetailView',
    'renderProductsView',
    'renderProvidersView',
  ],
  '🔴 HA CAMBIADO EL CONJUNTO DE VISTAS CON BOTÓN DE CREAR Y SIN ATAJO «N».\n'
  + `   Lo que hay ahora: ${c.sinAtajo.join(', ')}.\n`
  + '   · Si hay una NUEVA: has añadido una pantalla con botón de crear y te has dejado el atajo. '
  + 'No se hereda —hay que llamar a `atajoNuevo.registrar(vista, accion)` en la vista— y por eso '
  + 'existe este censo.\n'
  + '   · Si FALTA una: se ha registrado, bien. Quítala de esta lista EN EL MISMO COMMIT, o el '
  + 'censo pasa a vigilar un pasado que ya no existe.');

  // 🔴 Y EL SUELO DEL SUELO: si la lista se vaciara sola, sería que el censo dejó de mirar. Un
  // cero aquí es una noticia que alguien tiene que escribir a mano, no un verde (SCRUM-698).
  assert.ok(c.sinAtajo.length > 0,
    '🔴 CERO vistas sin atajo. O se han registrado TODAS —y entonces este fichero se retira a '
    + 'mano diciéndolo— o el censo ha dejado de encontrar botones de crear.');
});

test('SCRUM-768 · una de las tres NO es una lista, y se dice en vez de esconderse', async () => {
  const c = await censar();
  // `renderJobDetailView` es la ficha de un Trabajo, no una lista. Aparece en el censo porque el
  // criterio es «vista con botón primario de crear», que es lo que se puede derivar; «lista» no lo
  // es sin una lista escrita a mano, que es lo que no se quiere.
  //
  // 🔴 SCRUM-769 · Y AL IR A DARLE EL ATAJO SE MIDIÓ QUE TIENE **DOS** BOTONES «+ Nuevo albarán»:
  //   · el PRIMARIO es el CTA del héroe, y su etiqueta la escribe `jobNextAction.js:67` —una de
  //     las seis de la escalera aprobada—, así que dice «+ Nuevo albarán» sólo mientras el Trabajo
  //     esté en ese peldaño. En otro dice «Cobrar el resto», que mueve dinero.
  //   · el que DA DE ALTA de verdad es `jobDetailView.js:1157`, y es `btn-secondary btn-sm`.
  // Por eso este censo lo sigue viendo y por eso NO se le ha registrado atajo: hacerlo ataría la
  // «N» a lo que decida la escalera. Espera decisión.
  assert.ok(c.sinAtajo.includes('renderJobDetailView'),
    '🔴 `renderJobDetailView` ha salido del censo. Si se le ha registrado atajo, quítalo también '
    + 'de la lista de arriba y de esta nota, los dos en el mismo commit.');
});

// ═══ ③ EL DETECTOR REACCIONA — control positivo y negativo, sin tocar el árbol ════════════════

test('SCRUM-768 · CONTROL POSITIVO: una vista NUEVA con botón de crear y sin atajo SE VE', async () => {
  const inyectar = (banco) => {
    banco.ctx.renderCachivachesView = (c) => {
      const b = banco.mk('button');
      b.className = 'btn-primary';
      b.textContent = 'Nuevo cachivache';
      c.appendChild(b);
    };
  };
  const c = await censar(inyectar);
  assert.ok(c.conCrear.includes('renderCachivachesView'),
    '🔴 el detector NO ha visto una vista con botón primario de crear recién inyectada: entonces '
    + 'su lista de arriba no vale nada, porque no sabe encontrar lo que dice contar.');
  assert.ok(c.sinAtajo.includes('renderCachivachesView'),
    '🔴 el detector ve el botón pero NO se da cuenta de que la vista no registró atajo.');
});

test('SCRUM-768 · CONTROL NEGATIVO: si esa misma vista SÍ registra, deja de aparecer', async () => {
  const inyectar = (banco) => {
    banco.ctx.renderCachivachesView = (c) => {
      const b = banco.mk('button');
      b.className = 'btn-primary';
      b.textContent = 'Nuevo cachivache';
      c.appendChild(b);
      banco.ctx.atajoNuevo.registrar('cachivaches', () => b.click());
    };
  };
  const c = await censar(inyectar);
  assert.ok(c.conCrear.includes('renderCachivachesView'),
    '🔴 SUELO: la vista inyectada tiene que seguir contando como «con botón de crear».');
  assert.equal(c.sinAtajo.includes('renderCachivachesView'), false,
    '🔴 el detector marca como «sin atajo» una vista que SÍ lo registra: daría falsos hallazgos y '
    + 'alguien acabaría silenciando el censo entero.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LAS MUTACIONES QUE ME TUMBAN (contrato de SCRUM-745)
//
// La del encargo: quitarle el atajo a UNA de las cuatro que sí lo tienen. El censo pasa de cinco
// a seis y nombra a la recién llegada. Provocada a mano antes de escribirla —dos tests en rojo,
// `renderCustomersView` nombrada— y aquí mecanizada.
//
// Apunta a `public/`, que no tiene paso de compilación: se muta exactamente lo que el guard lee.
// ═════════════════════════════════════════════════════════════════════════════════════════════
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'public/dashboard/js/customersView.js',
    de: '    window.atajoNuevo.registrar("customers", () => newBtn.click());',
    a: '    // sin registro',
    cae: 'la lista de vistas con botón de crear y SIN atajo no CRECE',
  },
];
