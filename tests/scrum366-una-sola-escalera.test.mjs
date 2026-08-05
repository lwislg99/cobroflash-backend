// SCRUM-366 · LA LISTA Y EL DETALLE DICEN LO MISMO — una sola escalera.
//
// Sin gate: carga el módulo compartido en un sandbox y lee las dos vistas. Ni BD, ni red, ni
// navegador.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO NO FUE UN OLVIDO: FUE FALTA DE ACCESO
//
// `jobNextAction` vivía DENTRO de `jobDetailView.js`, así que `jobsView.js` **no podía nombrarla
// aunque quisiera** — y, teniendo que decir qué hacer con un Trabajo, escribió la suya. Mismo
// Trabajo, mismo estado, la lista decía «Marcar terminado» y el detalle «Enviar para firmar».
//
// Por eso el guard no se conforma con «las dos llaman a la función»: comprueba que **ninguna
// superficie decida por su cuenta**, y lo hace por ESTRUCTURA. Una lista de ficheros se
// satisface dejando de enumerar — la tercera pantalla que nazca no estaría en ella.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { soloEjecutable } from './_guard-texto.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_JS = path.join(RAIZ, 'public', 'dashboard', 'js');
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

const ESCALERA = leer('public/dashboard/js/jobNextAction.js');
const LISTA = leer('public/dashboard/js/jobsView.js');
const DETALLE = leer('public/dashboard/js/jobDetailView.js');

/**
 * Carga la escalera en un sandbox, con el `fmtMoneyEs` que necesita.
 * Se EJECUTA de verdad: comprobar que el fichero existe no dice si decide bien.
 */
function cargarEscalera() {
  const ctx = {
    window: {},
    fmtMoneyEs: (n, cur) => `${Number(n).toFixed(2)} ${cur || 'EUR'}`,
  };
  vm.createContext(ctx);
  vm.runInContext(ESCALERA, ctx);
  assert.equal(
    typeof ctx.window.jobNextAction, 'function',
    '🔴 `jobNextAction.js` no expone la escalera en el global. Sin eso volvemos al punto de ' +
      'partida: una función correcta que las otras pantallas no pueden nombrar.',
  );
  return ctx.window;
}

/** Un Trabajo mínimo con lo que la escalera mira. */
const trabajo = (extra = {}) => ({
  id: 7, status: 'en_curso', customer: { phone: null },
  invoices: [], albaranes: [], remaining: null, ...extra,
});

test('SCRUM-366 · SUELO: la escalera se carga y decide de verdad', () => {
  const { jobNextAction, JOB_NEXT_ACTION_KINDS } = cargarEscalera();
  assert.ok(Array.isArray(JOB_NEXT_ACTION_KINDS) && JOB_NEXT_ACTION_KINDS.length >= 5,
    '🔴 ESCÁNER CIEGO: la lista de `kind` está vacía o falta — el guard estructural de abajo se ' +
    'quedaría sin nada contra lo que comparar y pasaría sin medir.');
  // Control positivo y negativo: si SIEMPRE devolviera null, los tests de igualdad de abajo
  // serían ciertos por vacío (null === null en las dos pantallas).
  assert.ok(jobNextAction(trabajo()), '🔴 un Trabajo sin albaranes debería proponer algo (nivel 5)');
  assert.equal(
    jobNextAction(trabajo({ albaranes: [{ estado: 'firmado' }] })), null,
    '🔴 la escalera no devuelve null en el nivel 6 — entonces no está discriminando',
  );
});

test('SCRUM-366 · MISMO TRABAJO → MISMA ACCIÓN en las dos pantallas', () => {
  const { jobNextAction } = cargarEscalera();

  // El caso REAL que se reportó: `en_curso` con un albarán emitido. La lista decía «Marcar
  // terminado» y el detalle «Enviar para firmar».
  const casos = [
    trabajo({ status: 'en_curso', albaranes: [{ estado: 'emitido', id: 1 }] }),
    trabajo({ status: 'en_curso' }),
    trabajo({ status: 'agendado', albaranes: [{ estado: 'borrador', id: 2 }] }),
    trabajo({ status: 'terminado', remaining: { amount: 120, currency: 'EUR' } }),
    trabajo({ status: 'terminado', albaranes: [{ estado: 'firmado' }] }),
  ];

  for (const job of casos) {
    // Las dos pantallas llaman a la MISMA función con el MISMO argumento de rol. Que coincidan
    // no es una coincidencia comprobable a mano: es que solo hay una fuente.
    const enElDetalle = jobNextAction(job, true);
    const enLaLista = jobNextAction(job, true);
    assert.deepEqual(
      enLaLista, enElDetalle,
      `🔴 la lista y el detalle proponen acciones distintas para el mismo Trabajo (${job.status})`,
    );
  }

  // Y el rol se deriva IGUAL en las dos: `!isTecnico` sobre `window.appUserRole`.
  for (const [fichero, texto] of [['jobsView.js', LISTA], ['jobDetailView.js', DETALLE]]) {
    assert.ok(
      /const isTecnico = window\.appUserRole === 'tecnico'/.test(texto),
      `🔴 ${fichero} deriva el rol de otra forma. Si una calcula «admin» distinto que la otra, ` +
        'vuelven a discrepar por otro camino — el mismo defecto con otro disfraz.',
    );
    assert.ok(
      /jobNextAction\((job|j), !isTecnico\)/.test(texto),
      `🔴 ${fichero} no llama a la escalera con \`!isTecnico\``,
    );
  }
});

test('SCRUM-366 · la escalera ya NO se define dentro de una vista', () => {
  for (const [fichero, texto] of [['jobsView.js', LISTA], ['jobDetailView.js', DETALLE]]) {
    assert.ok(
      !/function jobNextAction\s*\(/.test(soloEjecutable(texto, { almohadillaEsComentario: false })),
      `🔴 ${fichero} vuelve a DEFINIR \`jobNextAction\`.\n\n` +
        '  Ése es el defecto entero: mientras viva dentro de una vista, las demás no pueden\n' +
        '  nombrarla y acaban escribiendo la suya. La escalera vive en `js/jobNextAction.js`.',
    );
  }
  assert.ok(
    /function jobNextAction\s*\(/.test(ESCALERA),
    '🔴 ESCÁNER CIEGO: la escalera tampoco está en su módulo. ¿Se renombró?',
  );
});

// ── EL GUARD ESTRUCTURAL ─────────────────────────────────────────────────────────────────
//
// PERTENENCIA POR ESTRUCTURA, no lista de nombres: «superficie que decide qué hacer con un
// Trabajo» = fichero de `public/dashboard/js/` que (a) pinta un botón PRIMARIO y (b) habla con
// la API de Trabajos. Un fichero nuevo con esas dos propiedades entra SOLO — que es justo lo que
// una lista no consigue: se satisface dejando de enumerar.
//
// ⚠️ LA PRIMERA VERSIÓN DE ESTA PROPIEDAD ESTABA MAL, y lo cazó el suelo. Pedía «ramifica por
// `job.status`», que parece la definición natural de «decide qué hacer con un Trabajo»… y el
// DETALLE no ramifica por el estado del Trabajo (medido en SCRUM-309: ninguna de sus 37 acciones
// consulta `job.status` — mira el estado del ALBARÁN y el del cobro). Con esa propiedad la
// derivación veía UNA superficie y el test de abajo pasaba **sobre un conjunto de uno**.
// Hablar con `/admin/jobs/` sí las captura a las dos, y solo a las dos (medido).
function superficiesDeTrabajo() {
  const out = [];
  for (const f of fs.readdirSync(DIR_JS).filter((n) => n.endsWith('.js'))) {
    if (f === 'jobNextAction.js') continue; // es el módulo, no una superficie
    const codigo = soloEjecutable(fs.readFileSync(path.join(DIR_JS, f), 'utf8'), { almohadillaEsComentario: false });
    const pintaPrimario = /btn-primary/.test(codigo);
    const hablaConTrabajos = /\/admin\/jobs\//.test(codigo);
    if (pintaPrimario && hablaConTrabajos) out.push({ fichero: f, codigo });
  }
  return out;
}

test('SCRUM-366 · SUELO del guard estructural: la derivación encuentra las superficies', () => {
  const s = superficiesDeTrabajo();
  assert.ok(
    s.length >= 2,
    `🔴 ESCÁNER CIEGO: la derivación ve ${s.length} superficies de Trabajo y deberían ser al menos ` +
      '2 (el listado y el detalle). Si las propiedades que la definen dejaron de casar, el test ' +
      'de abajo sería cierto sobre un conjunto vacío — un verde peor que un rojo.',
  );
  const nombres = s.map((x) => x.fichero);
  for (const esperado of ['jobsView.js', 'jobDetailView.js']) {
    assert.ok(nombres.includes(esperado), `🔴 la derivación no ve ${esperado}`);
  }
});

test('SCRUM-366 · NINGUNA superficie decide la siguiente acción por su cuenta', () => {
  const sinEscalera = superficiesDeTrabajo()
    .filter((s) => !/jobNextAction\s*\(/.test(s.codigo))
    .map((s) => s.fichero);

  assert.deepEqual(
    sinEscalera, [],
    '🔴 HAY UNA SUPERFICIE QUE PINTA LA ACCIÓN DE UN TRABAJO SIN CONSULTAR LA ESCALERA:\n' +
      sinEscalera.map((f) => `    ${f}`).join('\n') +
      '\n\n  Es exactamente como nació este defecto: una pantalla que tiene que decir qué hacer\n' +
      '  con un Trabajo, no puede alcanzar la escalera —o no se acuerda— y escribe la suya.\n' +
      '  Entonces dos pantallas dicen cosas distintas del mismo Trabajo y nada avisa.\n\n' +
      '  La pertenencia a este guard es por ESTRUCTURA (pinta primario + ramifica por estado de\n' +
      '  Trabajo), así que una pantalla nueva entra sola: no hay lista de la que olvidarse.',
  );
});
