// SCRUM-316 (G1) · EL DETALLE DEL TRABAJO CON EL PATRÓN B2.
//
// Sin gate: AST sobre las fuentes + la escalera cargada en un sandbox. Ni BD, ni red, ni navegador.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTE GUARD ES COMO ES
//
// La tabla original del ticket estaba mal en dos cosas, y las dos las cazó una medición:
//
//   1. Diseñaba el COBRO como un segundo eje de estados. No lo es: `estadoCobroFor(cobrado,
//      aceptado)` es una división que se recalcula en cada lectura, sin columna en la BD. Un eje
//      tiene tabla de transiciones y auditoría; el otro no transita.
//   2. Decía CUATRO estados. Son CINCO — falta `cerrado`, terminal.
//
// De ahí las dos obsesiones de este fichero: **los estados se DERIVAN de `job.service.ts`**, nunca
// se escriben aquí; y **el cobro se trata como aritmética**, generando sus situaciones a partir de
// números, no enumerando un enum que no existe.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { soloEjecutable } from './_guard-texto.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(import.meta.url);
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

const VISTA_TXT = leer('public/dashboard/js/jobDetailView.js');
const VISTA = soloEjecutable(VISTA_TXT, { almohadillaEsComentario: false });
const SERVICE = leer('src/modules/jobs/domain/job.service.ts');

// El registro se IMPORTA, no se re-declara: si el guard escribiera su propia copia de la tabla,
// estaría verificando su propia opinión en vez del código que se publica.
const REG = require_(path.join(RAIZ, 'public/dashboard/js/jobActionsRegistry.js'));

// ── LOS CINCO ESTADOS, DERIVADOS ────────────────────────────────────────────────────────
//
// Del AST de `job.service.ts`, no de una lista escrita aquí. Es el control que le faltó a B2:
// allí la tabla nombraba un estado que no existía y otro que faltaba, y nada avisó.
function estadosDerivados() {
  const sf = ts.createSourceFile('job.service.ts', SERVICE, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let out = null;
  const visita = (n) => {
    if (ts.isVariableDeclaration(n) && n.name.getText(sf) === 'JOB_STATES' && n.initializer) {
      // `[...] as const` → el array vive dentro de la aserción.
      const arr = ts.isAsExpression(n.initializer) ? n.initializer.expression : n.initializer;
      if (ts.isArrayLiteralExpression(arr)) {
        out = arr.elements.map((e) => e.getText(sf).replace(/^['"`]|['"`]$/g, ''));
      }
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return out;
}

test('SCRUM-316 · SUELO: los estados del Trabajo se DERIVAN del modelo, y son CINCO', () => {
  const estados = estadosDerivados();
  assert.ok(
    Array.isArray(estados) && estados.length > 0,
    '🔴 ESCÁNER CIEGO: no se pudo derivar `JOB_STATES` de `job.service.ts`. Sin esto, todos los ' +
      'tests de abajo recorrerían un conjunto vacío y pasarían sin comprobar nada.',
  );
  assert.equal(
    estados.length, 5,
    `🔴 el modelo declara ${estados.length} estados y este guard espera 5. Si el cambio es ` +
      'legítimo, la Parte L del máster cambia primero (regla 27) y este número con ella.',
  );
  assert.ok(estados.includes('cerrado'), '🔴 falta `cerrado` — es justo el que la tabla del ticket se dejaba');
});

test('SCRUM-316 · CONTROL NEGATIVO: un estado que no existe en el modelo no puede tener fila', () => {
  const estados = estadosDerivados();
  // El error de B2, reproducido: nombres que suenan a estado y no lo son. `cobrado` es el más
  // peligroso porque el ticket original lo proponía como «quinto estado detrás de terminado».
  for (const inventado of ['cobrado', 'pagado', 'facturado', 'sin_agendar']) {
    assert.ok(
      !estados.includes(inventado),
      `🔴 «${inventado}» aparece como estado del Trabajo. O el modelo cambió sin pasar por la ` +
        'Parte L, o alguien escribió un estado de COBRO en el eje de TRABAJO — que es exactamente ' +
        'el error que este control existe para cazar.',
    );
  }
});

// ── LA ESCALERA, EJECUTADA ──────────────────────────────────────────────────────────────
function cargarEscalera() {
  const ctx = { window: {}, fmtMoneyEs: (n, cur) => `${Number(n).toFixed(2)} ${cur || 'EUR'}` };
  vm.createContext(ctx);
  vm.runInContext(leer('public/dashboard/js/jobNextAction.js'), ctx);
  assert.equal(typeof ctx.window.jobNextAction, 'function', '🔴 la escalera no se pudo cargar');
  return ctx.window.jobNextAction;
}

/**
 * Las situaciones de COBRO se GENERAN con aritmética, no se enumeran.
 * `estadoCobroFor(cobrado, aceptado)`: a>0 && c>=a → Pagado · c>0 → Parcial · resto → Pendiente.
 * Enumerar un enum de cobro sería reintroducir el error que la corrección del ticket eliminó.
 */
const SITUACIONES_COBRO = [
  { nombre: 'Pendiente', aceptado: 500, cobrado: 0 },
  { nombre: 'Parcial', aceptado: 500, cobrado: 200 },
  { nombre: 'Pagado', aceptado: 500, cobrado: 500 },
];

const trabajo = (status, cobro) => ({
  id: 7, status,
  customer: { phone: null },
  invoices: [], albaranes: [],
  totalAceptado: cobro.aceptado, totalCobrado: cobro.cobrado,
  remaining: { amount: Math.max(0, cobro.aceptado - cobro.cobrado), currency: 'EUR' },
});

test('SCRUM-316 · EXACTAMENTE UNA primaria por casilla del producto estado × cobro', () => {
  const jobNextAction = cargarEscalera();
  const estados = estadosDerivados();
  let casillas = 0;

  for (const estado of estados) {
    for (const cobro of SITUACIONES_COBRO) {
      casillas++;
      const acc = jobNextAction(trabajo(estado, cobro), true);
      // «Una primaria» significa UNA acción o NINGUNA — nunca dos. La escalera devuelve un objeto
      // o null, así que la forma del valor ES la garantía; lo que se comprueba es que no se haya
      // convertido en una lista, que es como se cuela una segunda primaria sin que nadie lo note.
      assert.ok(
        acc === null || (typeof acc === 'object' && !Array.isArray(acc)),
        `🔴 la casilla [${estado} · ${cobro.nombre}] devuelve ${JSON.stringify(acc)} — ni una ` +
          'acción ni ninguna. Dos primarias a la vez es el fallo que el patrón prohíbe.',
      );
      if (acc) {
        assert.ok(
          typeof acc.label === 'string' && acc.label.trim(),
          `🔴 la casilla [${estado} · ${cobro.nombre}] propone una acción SIN etiqueta: un botón ` +
            'en blanco en la cabecera.',
        );
      }
    }
  }
  assert.equal(
    casillas, 15,
    `🔴 ESCÁNER CIEGO: se recorrieron ${casillas} casillas y deberían ser 15 (5 estados × 3 ` +
      'situaciones de cobro). Un producto incompleto pasa en verde sin haber mirado.',
  );
});

test('SCRUM-316 · LA FILA QUE EL DISEÑO DE UN SOLO EJE ESCONDÍA: terminado + sin cobrar → Cobrar', () => {
  const jobNextAction = cargarEscalera();

  const acc = jobNextAction(trabajo('terminado', { aceptado: 500, cobrado: 0 }), true);
  assert.ok(acc, '🔴 un Trabajo terminado y sin cobrar no propone nada. Es el estado más ' +
    'importante del negocio —el trabajo hecho y el dinero fuera— y la cabecera se quedaría muda.');
  assert.equal(
    acc.kind, 'cobrar',
    `🔴 terminado + sin cobrar propone «${acc.kind}» en vez de cobrar. La tabla de un solo eje no ` +
      'tenía fila para este caso; si este test no pasa, la corrección no está hecha.',
  );

  // Y el contraste que prueba que discrimina: terminado y PAGADO no propone cobrar.
  const pagado = jobNextAction(trabajo('terminado', { aceptado: 500, cobrado: 500 }), true);
  assert.ok(
    !pagado || pagado.kind !== 'cobrar',
    '🔴 propone cobrar un Trabajo ya pagado — entonces no está mirando el dinero, y el test de ' +
      'arriba pasaría por casualidad.',
  );
});

test('SCRUM-316 · el COBRO no se modela como estado: es aritmética', () => {
  // El eje de trabajo tiene tabla de transiciones; el de cobro no tiene ni columna. Si alguien
  // añadiera un `estadoCobro` al enum de estados, los dos quedarían como simétricos y el diseño
  // volvería al error que la corrección del ticket eliminó.
  const estados = estadosDerivados();
  for (const s of SITUACIONES_COBRO) {
    assert.ok(
      !estados.includes(s.nombre) && !estados.includes(s.nombre.toLowerCase()),
      `🔴 «${s.nombre}» es una situación de COBRO y aparece en el enum de ESTADOS del Trabajo.`,
    );
  }
  assert.ok(
    /estadoCobroFor\s*\(/.test(SERVICE),
    '🔴 ESCÁNER CIEGO: `estadoCobroFor` ya no está en `job.service.ts`. Si el cobro pasó a ser ' +
      'una columna de verdad, este guard está midiendo un mundo que ya no existe.',
  );
});

// ── LA LEY DEL PATRÓN ───────────────────────────────────────────────────────────────────

test('SCRUM-316 · la LEY: 1 primaria · ≤2 secundarias · el resto en «⋮»', () => {
  const { JOB_ACTION_REGISTRY, JOB_PATRON_LEY, JOB_ACTION_DESTINOS } = REG;
  assert.ok(JOB_ACTION_REGISTRY.length > 0, '🔴 ESCÁNER CIEGO: el registro está vacío');

  const porDestino = (d) => JOB_ACTION_REGISTRY.filter((a) => a.destino === d);
  for (const a of JOB_ACTION_REGISTRY) {
    assert.ok(
      JOB_ACTION_DESTINOS.includes(a.destino),
      `🔴 «${a.id}» declara el destino «${a.destino}», que no existe en la ley.`,
    );
  }
  assert.equal(
    porDestino('primaria').length, JOB_PATRON_LEY.primarias,
    '🔴 la cabecera declara más de un hueco de primaria. Dos primarias es no tener ninguna: el ' +
      'usuario deja de saber cuál es el siguiente paso.',
  );
  assert.ok(
    porDestino('secundaria').length <= JOB_PATRON_LEY.secundarias,
    `🔴 ${porDestino('secundaria').length} secundarias declaradas y la ley permite ` +
      `${JOB_PATRON_LEY.secundarias}. El resto va al «⋮».`,
  );
  // La primaria NO declara ocupante: lo elige la escalera. Declararlo aquí sería una segunda
  // fuente para la misma pregunta, que es lo que SCRUM-366 acaba de eliminar.
  assert.equal(
    porDestino('primaria')[0].fuente, 'jobNextAction',
    '🔴 el hueco de primaria no dice que lo ocupa la escalera. Si alguien fija aquí una acción ' +
      'concreta, la lista y el detalle vuelven a poder discrepar.',
  );
});

test('SCRUM-316 · la vista PINTA desde el registro, no a mano', () => {
  // La única forma de llegar a la barra de cabecera es `enCabecera(id, el)`, que consulta el
  // registro. Un `headRight.appendChild` suelto sería una acción de cabecera que ninguna tabla
  // declara — y por tanto invisible para este guard y para el siguiente que lo lea.
  //
  // ⚠️ ESTE TEST NO SALTABA, Y SE ENTREGÓ ASÍ. La primera versión CONTABA apariciones de
  // `headRight.appendChild` y restaba las permitidas — pero uno de los patrones de resta casaba
  // con las MISMAS dos líneas que ya había restado el anterior. El total quedaba negativo y el
  // assert no podía dispararse nunca: verde perfecto, midiendo nada.
  //
  // Se arregló, y el arreglo se perdió: al revertir otro rojo con `git checkout --` sobre este
  // fichero, git lo restauró desde HEAD y se llevó por delante la corrección, que aún no estaba
  // comiteada. El guard viajó decorativo hasta que el rebase obligó a repetir los rojos.
  //
  // Por eso ahora se revisa CADA LÍNEA contra las formas admitidas en vez de cuadrar un número:
  // un guard que cuenta se rompe en silencio; uno que enumera lo que encontró, no.
  const lineas = VISTA.split(/\r?\n/)
    .map((t, i) => ({ n: i + 1, t }))
    .filter((l) => l.t.includes('headRight.appendChild'));

  assert.ok(
    lineas.length > 0,
    '🔴 ESCÁNER CIEGO: nadie cuelga nada de `headRight`. O la cabecera dejó de tener acciones, o ' +
      'el nombre cambió y este guard mira un elemento que ya no existe.',
  );
  assert.ok(
    /const destino = typeof destinoAccionTrabajo === 'function' \? destinoAccionTrabajo\(id\)/.test(VISTA),
    '🔴 `enCabecera` ya no consulta el registro: la vista habría vuelto a decidir por su cuenta ' +
      'dónde va cada acción.',
  );

  // Las ÚNICAS formas admitidas de llegar a la barra: el volcado de un cubo del registro, o el
  // fallback del «⋮» cuando `overflowMenu` no está cargado. Cualquier otra línea es una acción de
  // cabecera que ninguna tabla declara.
  const PERMITIDAS = [
    /cubosCabecera\.\w+\.forEach\(\(b\) => headRight\.appendChild\(b\)\)/,
    /headRight\.appendChild\(overflowMenu\(cubosCabecera\.overflow\)\)/,
  ];
  const sueltas = lineas.filter((l) => !PERMITIDAS.some((re) => re.test(l.t)));
  assert.deepEqual(
    sueltas.map((l) => `L${l.n}: ${l.t.trim()}`), [],
    '🔴 HAY UNA ACCIÓN PINTADA A MANO EN LA CABECERA, fuera del ensamblado del registro.\n\n' +
      '  Es como nace la segunda tabla: alguien añade un botón donde se ve, el registro no se\n' +
      '  entera, y a partir de ahí la ley del patrón y la pantalla dicen cosas distintas.',
  );
});

test('SCRUM-316 · lo DESTRUCTIVO nunca es botón visible (con suelo)', () => {
  const { JOB_ACTION_REGISTRY } = REG;
  // Detector: una acción es destructiva si su id o su handler nombran un acto irreversible.
  const esDestructiva = (id) => /borrar|eliminar|anular|delete|destru/i.test(id);

  // SUELO / control positivo: el detector tiene que reconocer una destructiva cuando la hay. Sin
  // esto, «ninguna destructiva visible» y «el detector no sabe reconocer ninguna» dan el mismo
  // verde y significan cosas opuestas.
  assert.ok(esDestructiva('btnEliminarTrabajo'), '🔴 ESCÁNER CIEGO: el detector no reconoce una destructiva evidente');
  assert.ok(!esDestructiva('btnGasto'), '🔴 el detector marca como destructiva una que no lo es');

  const visiblesDestructivas = JOB_ACTION_REGISTRY
    .filter((a) => a.destino === 'primaria' || a.destino === 'secundaria')
    .filter((a) => esDestructiva(a.id));
  assert.deepEqual(
    visiblesDestructivas.map((a) => a.id), [],
    '🔴 una acción destructiva está declarada como botón VISIBLE de la cabecera. Lo irreversible ' +
      'va en el «⋮», donde no se pulsa sin querer.',
  );
});

test('SCRUM-316 · el RAIL está declarado como estructura (su contenido es G3)', () => {
  const { JOB_RAIL_BLOQUES } = REG;
  assert.equal(
    JOB_RAIL_BLOQUES.length, 5,
    `🔴 el rail declara ${JOB_RAIL_BLOQUES.length} bloques y el diseño tiene 5. Sin el sitio ` +
      'declarado, G3 se inventará su propio contenedor y la pantalla acabará con dos maquetaciones.',
  );
  assert.ok(
    /class(Name)?\s*=\s*'detail-rail'/.test(VISTA) && /detail-cuerpo/.test(VISTA),
    '🔴 la vista no monta la rejilla del rail: los bloques estarían declarados sin sitio donde ir.',
  );
  // Y que NO se pinta sin contenido.
  //
  // ⚠️ La versión original de este assert buscaba el filtro CONCRETO de G1 (`.filter((b) => b.el)`)
  // y SCRUM-318 lo sustituyó por `.filter(Boolean)` al traer los constructores reales: el guard se
  // puso rojo por un cambio legítimo. Lo que hay que proteger es la REGLA —un bloque sin contenido
  // no llega al rail—, no la expresión con la que se escribió el primer día.
  assert.ok(
    /bloquesRail[\s\S]{0,400}?\.filter\(Boolean\)/.test(VISTA),
    '🔴 el rail se pinta sin filtrar los bloques vacíos: se publicaría una columna con títulos y ' +
      'nada debajo.',
  );
});

// ── EL CENSO DERIVADO ───────────────────────────────────────────────────────────────────
//
// Tres vías, porque hay tres. El primer derivador de G0 dio 12 mirando solo la fábrica `mkBtn`, y
// los botones de cabecera no la usan: un censo que mira una de tres es el defecto que este guard
// existe para evitar.
function censoAcciones() {
  const sf = ts.createSourceFile('jobDetailView.js', VISTA_TXT, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const vias = { createElement: 0, mkBtn: 0, plantilla: 0 };
  const visita = (n) => {
    if (ts.isCallExpression(n)) {
      const callee = n.expression.getText(sf);
      if (/createElement$/.test(callee) && n.arguments[0] && /^['"`]button['"`]$/.test(n.arguments[0].getText(sf))) vias.createElement++;
      if (/(^|\.)mkBtn$/.test(callee)) vias.mkBtn++;
    }
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n)) {
      vias.plantilla += (n.getText(sf).match(/<button/g) || []).length;
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return { vias, total: vias.createElement + vias.mkBtn + vias.plantilla };
}

test('SCRUM-316 · SUELO del censo derivado: las TRES vías encuentran acciones', () => {
  const { vias, total } = censoAcciones();
  for (const [via, n] of Object.entries(vias)) {
    assert.ok(
      n > 0,
      `🔴 ESCÁNER CIEGO: la vía «${via}» encuentra 0 acciones. «No hay acciones» y «no supe ` +
        'mirar» son el mismo número y significan lo contrario: si una vía deja de casar, el censo ' +
        'se queda corto y nadie se entera.',
    );
  }
  assert.ok(
    total >= 30,
    `🔴 ESCÁNER CIEGO: el censo ve ${total} acciones en una vista de ${VISTA_TXT.split('\n').length} ` +
      'líneas. Es implausiblemente poco: lo más probable es que el derivador se haya roto, no que ' +
      'la pantalla se haya vaciado.',
  );
});
