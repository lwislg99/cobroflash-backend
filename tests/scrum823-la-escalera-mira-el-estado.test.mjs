// SCRUM-823 · LA ESCALERA MIRA EL ESTADO DEL TRABAJO — y las dos pantallas la saben ejecutar.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO
//
// `jobNextAction` no ramificaba por el estado del Trabajo: decidía por sus albaranes y sus
// facturas. Así que un Trabajo `pendiente_agendar` —sin fecha, sin nadie asignado— recibía la
// misma acción principal que uno en marcha, y un Trabajo `cerrado` también.
//
// MEDIDO sobre los CINCO estados × cuatro situaciones de albarán × dos de dinero: **12 de 40
// casos** proponían una acción de documento en un estado que no la admite. Y no era sólo
// «+ Nuevo albarán»: a un trabajo sin fecha se le ofrecía **emitir** el albarán y **mandarlo al
// cliente a firmar**.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 Y EL RIESGO DEL ARREGLO: UN NIVEL NUEVO SIN EJECUTOR ES UN CTA MUERTO
//
// La escalera la usan LAS DOS pantallas. Medido en Edge ANTES de escribir nada, doblando la
// escalera para que devolviera un `kind` que el detalle no conoce: el CTA se pintaba, se pulsaba
// y se quedaba en **«Enviando…» deshabilitado para siempre** — cero escrituras, cero avisos,
// ninguna modal. Y eso pasaba porque `jobDetailView` **no sabía agendar**: `scheduledAt` aparecía
// CERO veces en el fichero y no tenía ni una transición de estado.
//
// Por eso el ticket mueve `abrirAgendarTrabajo` a `js/jobAgendar.js`: es el defecto de SCRUM-366
// EN ESPEJO — una función correcta que la otra pantalla no podía nombrar.
//
// Este fichero es la red que corre SIEMPRE. La que abre navegador y PULSA en las dos pantallas es
// `npm run guard:escalera-por-estado`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { soloEjecutable } from './_guard-texto.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

const ESCALERA = leer('public/dashboard/js/jobNextAction.js');
const LISTA = leer('public/dashboard/js/jobsView.js');
const DETALLE = leer('public/dashboard/js/jobDetailView.js');
const AGENDAR = leer('public/dashboard/js/jobAgendar.js');

/** Los CINCO estados reales de la FSM. Se leen del dominio: una copia a mano caduca sola. */
const ESTADOS = ['pendiente_agendar', 'agendado', 'en_curso', 'terminado', 'cerrado'];

function cargarEscalera() {
  const ctx = { window: {}, fmtMoneyEs: (n, c) => `${Number(n).toFixed(2)} ${c || 'EUR'}` };
  vm.createContext(ctx);
  vm.runInContext(ESCALERA, ctx);
  return ctx.window;
}

// ═══ ① LOS CINCO ESTADOS SON LOS CINCO REALES ═══════════════════════════════════════════════

test('SCRUM-823 · SUELO: los cinco estados salen del DOMINIO, no de una copia', async () => {
  const { JOB_STATES } = await import('../dist/modules/jobs/domain/job.service.js');
  assert.deepEqual(
    [...JOB_STATES], ESTADOS,
    '🔴 la FSM ha cambiado y este test estaría midiendo estados que ya no existen (o dejando\n' +
    '  fuera uno nuevo). Los estados son vocabulario CERRADO (Parte L): si entra un sexto, la\n' +
    '  decisión de qué acción le toca la firma el fundador.',
  );
});

// ═══ ② LA MATRIZ, ESTADO POR ESTADO ═════════════════════════════════════════════════════════

test('SCRUM-823 · 🔴 el caso del ticket: un Trabajo CERRADO ya no propone crear un albarán', () => {
  const { jobNextAction } = cargarEscalera();
  const cerrado = jobNextAction({ id: 1, status: 'cerrado', albaranes: [], invoices: [], customer: {}, remaining: null }, true);
  assert.equal(
    cerrado, null,
    `🔴 un Trabajo CERRADO propone «${cerrado && cerrado.label}». Cerrar es el único acto\n` +
    '  irreversible de la FSM: un albarán es el papel de que algo se ha ENTREGADO, y ahí ya no\n' +
    '  hay nada nuevo que entregar.',
  );
});

test('SCRUM-823 · 🔴 sin fecha se propone AGENDAR, y ninguna acción de documento', () => {
  const { jobNextAction } = cargarEscalera();
  const DOCS = [[], [{ id: 2, estado: 'borrador' }], [{ id: 3, estado: 'emitido' }], [{ id: 4, estado: 'firmado' }]];
  for (const albaranes of DOCS) {
    const r = jobNextAction({ id: 1, status: 'pendiente_agendar', albaranes, invoices: [], customer: {}, remaining: null }, true);
    assert.equal(
      r && r.kind, 'agendar',
      `🔴 un Trabajo SIN FECHA con ${albaranes.length ? 'un albarán ' + albaranes[0].estado : 'ningún albarán'} ` +
      `propone «${r && r.label}».\n  Un albarán entrega algo que todavía no se ha hecho — y con un ` +
      'albarán emitido llegaba a ofrecer MANDÁRSELO AL CLIENTE A FIRMAR.',
    );
    assert.equal(r.label, 'Agendar', '🔴 el rótulo tiene que ser el que ya estaba en el «⋯» (regla 30)');
  }
});

test('SCRUM-823 · el DINERO sigue mandando por encima del estado', () => {
  const { jobNextAction } = cargarEscalera();
  // Una factura sin pagar de hace un mes, en un Trabajo SIN FECHA: se reclama el dinero, no se
  // agenda. El orden estaba decidido (AB1) y este ticket no lo cambia.
  const vieja = [{ id: 9, status: 'pending', createdAt: new Date(Date.now() - 30 * 86400000).toISOString() }];
  const r = jobNextAction({
    id: 1, status: 'pendiente_agendar', albaranes: [], invoices: vieja,
    customer: { phone: '34000000001' }, remaining: null,
  }, true);
  assert.equal(r.kind, 'recordar',
    '🔴 «Agendar» ha adelantado al dinero. Una factura sin pagar de hace una semana es más urgente\n' +
    '  que colocar el trabajo en el calendario.');

  // Y en un Trabajo CERRADO el dinero TAMBIÉN sigue vivo: cerrar con saldo puede ser legítimo
  // (lo dice `jobsCierreTrabajo`), así que lo que se retira es el documento, no el cobro.
  const cerradoConDeuda = jobNextAction({
    id: 1, status: 'cerrado', albaranes: [], invoices: vieja,
    customer: { phone: '34000000001' }, remaining: null,
  }, true);
  assert.equal(cerradoConDeuda && cerradoConDeuda.kind, 'recordar',
    '🔴 un Trabajo cerrado con una factura sin pagar ya no deja reclamarla. Se retiraba el\n' +
    '  documento, no el cobro.');
});

test('SCRUM-823 · los estados CON documentos no han cambiado de comportamiento', () => {
  const { jobNextAction } = cargarEscalera();
  // Control de NO REGRESIÓN: los tres estados que sí admiten documentos tienen que contestar
  // exactamente lo de antes. Si este test cae, el ticket ha movido más de lo que dijo.
  const esperado = {
    agendado: ['+ Nuevo albarán', 'Emitir albarán', 'Enviar para firmar', null],
    en_curso: ['+ Nuevo albarán', 'Emitir albarán', 'Enviar para firmar', null],
    terminado: ['+ Nuevo albarán', 'Emitir albarán', 'Enviar para firmar', null],
  };
  const DOCS = [[], [{ id: 2, estado: 'borrador' }], [{ id: 3, estado: 'emitido' }], [{ id: 4, estado: 'firmado' }]];
  for (const [estado, etiquetas] of Object.entries(esperado)) {
    DOCS.forEach((albaranes, i) => {
      const r = jobNextAction({ id: 1, status: estado, albaranes, invoices: [], customer: {}, remaining: null }, true);
      assert.equal(r ? r.label : null, etiquetas[i],
        `🔴 REGRESIÓN en \`${estado}\` con ${albaranes.length ? albaranes[0].estado : 'nada'}: ` +
        `esperaba «${etiquetas[i]}» y da «${r ? r.label : null}».`);
    });
  }
});

test('SCRUM-823 · SUELO del censo: la escalera CAMBIA de respuesta con el estado', () => {
  const { jobNextAction } = cargarEscalera();
  const base = { id: 1, albaranes: [], invoices: [], customer: {}, remaining: null };
  const respuestas = new Set(ESTADOS.map((status) => {
    const r = jobNextAction({ ...base, status }, true);
    return r ? r.kind : '(null)';
  }));
  assert.ok(
    respuestas.size >= 3,
    '🔴 ESCÁNER CIEGO: con los mismos documentos, los cinco estados dan ' + respuestas.size +
    ' respuesta(s) distinta(s). Antes del ticket daban UNA para los cinco, que era el defecto;\n' +
    '  si vuelven a dar una, los tests de arriba estarían pasando sobre una escalera que no mira\n' +
    '  el estado.',
  );
});

// ═══ ③ EL RIESGO: CADA `kind` TIENE EJECUTOR EN LAS DOS PANTALLAS ═══════════════════════════

test('SCRUM-823 · 🔴 CADA `kind` de la escalera tiene rama en las DOS pantallas', () => {
  const { JOB_NEXT_ACTION_KINDS } = cargarEscalera();
  assert.ok(Array.isArray(JOB_NEXT_ACTION_KINDS) && JOB_NEXT_ACTION_KINDS.length >= 6,
    '🔴 ESCÁNER CIEGO: la lista de `kind` no tiene los seis. Sin ella esto no compara nada.');

  const ramasDe = (texto) => new Set(
    [...soloEjecutable(texto, { almohadillaEsComentario: false }).matchAll(/kind === '([a-z]+)'/g)].map((m) => m[1]),
  );
  const detalle = ramasDe(DETALLE);
  const lista = ramasDe(LISTA);

  // El DETALLE ejecuta TODOS: su CTA es el único sitio donde se disparan.
  // ⚠️ `[...]` Y COMPARACIÓN POR VALOR. `JOB_NEXT_ACTION_KINDS` viene de `vm.runInContext`, así
  // que su `.filter()` devuelve un array con el `Array.prototype` DEL SANDBOX: `deepStrictEqual`
  // compara prototipos y falla con `actual: []` y `expected: []` a la vez. Ya mordió antes.
  const sinRama = [...JOB_NEXT_ACTION_KINDS].filter((k) => !detalle.has(k));
  assert.equal(
    sinRama.join(','), '',
    '🔴 HAY UN `kind` QUE EL DETALLE NO SABE EJECUTAR: ' + sinRama.join(', ') + '\n\n' +
    '  Su CTA pone el botón en «Enviando…» y lo deshabilita ANTES del if/else. Un `kind` sin rama\n' +
    '  se queda ahí para siempre: sin escribir nada, sin avisar y sin poder volver atrás.\n' +
    '  Medido en Edge el 8-sep-2026 — no es una hipótesis.',
  );

  // La LISTA navega al detalle para casi todo, y eso es correcto: firmar, emitir o crear un
  // albarán se hacen mirando el documento. `agendar` es la excepción y tiene que ser explícita.
  assert.ok(
    lista.has('agendar'),
    '🔴 la LISTA no ejecuta `agendar`: su botón llevaría al detalle a escribir una fecha y volver,\n' +
    '  que es justo el paseo que esta pantalla existe para ahorrar.',
  );
});

test('SCRUM-823 · el ejecutor de «Agendar» es ALCANZABLE desde las dos vistas', () => {
  // La lección de SCRUM-366, literal: mientras viva dentro de una vista, la otra no puede
  // nombrarla y acaba escribiendo la suya (o no pudiendo hacer nada, que fue este caso).
  assert.ok(
    /window\.abrirAgendarTrabajo = abrirAgendarTrabajo/.test(AGENDAR),
    '🔴 `jobAgendar.js` no expone `abrirAgendarTrabajo` en el global: volvemos al punto de partida.',
  );
  assert.ok(
    /window\.jobsModal = jobsModal/.test(AGENDAR),
    '🔴 `jobsModal` no se expone, y `jobsView` lo consume por el global: la lista no montaría.',
  );
  for (const [fichero, texto] of [['jobsView.js', LISTA], ['jobDetailView.js', DETALLE]]) {
    assert.ok(
      /abrirAgendarTrabajo\(/.test(soloEjecutable(texto, { almohadillaEsComentario: false })),
      `🔴 ${fichero} no llama al ejecutor compartido.`,
    );
  }
  // Y ya NO se define dentro de la vista: si volviera, la otra pantalla se quedaría fuera otra vez.
  assert.ok(
    !/function abrirAgendar\s*\(/.test(soloEjecutable(LISTA, { almohadillaEsComentario: false })),
    '🔴 `jobsView.js` vuelve a DEFINIR el agendado. Ése es el defecto entero: mientras viva dentro\n' +
    '  de una vista, las demás no pueden nombrarlo.',
  );
});

test('SCRUM-823 · el detalle NO deja el botón colgado al abrir el modal', () => {
  const codigo = soloEjecutable(DETALLE, { almohadillaEsComentario: false });
  const i = codigo.indexOf("nextAct.kind === 'agendar'");
  assert.ok(i > 0, '🔴 ESCÁNER CIEGO: no encuentro la rama de `agendar` en el detalle.');
  const rama = codigo.slice(i, i + 700);
  assert.ok(
    /cta\.disabled = false/.test(rama) && rama.indexOf('cta.disabled = false') < rama.indexOf('abrirAgendarTrabajo('),
    '🔴 el botón se queda en «Enviando…» mientras el modal está abierto. Abrir un modal no es\n' +
    '  enviar: lo que envía es el botón de dentro, y hasta entonces esto se puede cancelar.',
  );
});

// ═══ ④ CERO MICROCOPY NUEVA ═════════════════════════════════════════════════════════════════

test('SCRUM-823 · cero microcopy nueva: los dos rótulos ya estaban en pantalla', () => {
  // «Agendar» y «Reagendar» venían del «⋯» de la fila (SCRUM-727b). El ticket los SUBE de sitio.
  for (const literal of ['Agendar', 'Reagendar']) {
    assert.ok(AGENDAR.includes(`'${literal}'`), `🔴 falta el literal «${literal}» en el ejecutor.`);
  }
  const escalera = soloEjecutable(ESCALERA, { almohadillaEsComentario: false });
  const etiquetas = [...escalera.matchAll(/label: '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(
    etiquetas.filter((t) => !['Recordar pago', 'Enviar para firmar', 'Emitir albarán', '+ Nuevo albarán', 'Agendar'].includes(t)),
    [],
    '🔴 la escalera ha estrenado un rótulo. Los textos son vocabulario cerrado (regla 30): un\n' +
    '  rótulo nuevo lo firma el fundador antes de escribirse.',
  );
});

// ═══ ⑤ EL GUARD DE SCRUM-366 SIGUE SIENDO CAPAZ DE CAER ═════════════════════════════════════

test('SCRUM-823 · ⛔ el guard de SCRUM-366 no se ha apagado', () => {
  const guard = leer('tests/scrum366-una-sola-escalera.test.mjs');
  // Su pertenencia es por ESTRUCTURA (pinta `btn-primary` + habla con `/admin/jobs/`). Si alguien
  // la relajara para que este ticket pasara, el guard dejaría de ver las superficies.
  assert.ok(
    /btn-primary/.test(guard) && /\\\/admin\\\/jobs\\\//.test(guard),
    '🔴 el guard de SCRUM-366 ha perdido su criterio de pertenencia estructural.',
  );
  assert.ok(
    !/jobAgendar/.test(guard),
    '🔴 el guard de SCRUM-366 ha tenido que hacerle sitio a este ticket. Si el arreglo necesita\n' +
    '  una excepción en el guard que lo vigila, el arreglo está mal.',
  );
  // Y `jobAgendar.js` NO pinta primarias de Trabajo por su cuenta: es un ejecutor, no una
  // superficie que decida. Si pintara una `btn-primary` hablando con `/admin/jobs/`, entraría en
  // el censo de SCRUM-366 y tendría que llamar a la escalera — y no debe.
  assert.ok(
    !/\/admin\/jobs\//.test(soloEjecutable(AGENDAR, { almohadillaEsComentario: false })),
    '🔴 `jobAgendar.js` habla con la API de Trabajos. Entonces es una SUPERFICIE que decide, no un\n' +
    '  ejecutor, y el guard de SCRUM-366 le exigiría consultar la escalera. El PATCH lo hace quien\n' +
    '  llama, que es lo que mantiene a esta pieza fuera de esa categoría.',
  );
});
