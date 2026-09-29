// tests/scrum1233-mensaje-para-persona.test.mjs — SCRUM-1233
//
// CADA PANTALLA SE ESCRIBÍA SU PROPIO «¿qué le enseño al profesional cuando falla?», y dos seguían
// pintando `err.message`: «API 500: internal_error», o «Failed to fetch» sin red, en lugar del
// texto aprobado. Y el censo de SCRUM-644, que existía para esto, estaba EN VERDE con los dos
// delante: solo reconocía `pintor(… .message …)`, y los dos llegaban a la pantalla por otro
// camino (una asignación a `textContent`, y una variable intermedia).
//
// LO QUE ESTE FICHERO FIJA
//
// ① `mensajeParaPersona(err, respaldo)` (api.js): `data.message` si el servidor escribió una frase
//    para una persona; si no, el respaldo. Nunca `err.message`.
// ② El VIAJE: la lista de albaranes, montada en el banco, con el `apiRequest` REAL contra un 500
//    sin mensaje y contra una red caída, no enseña la tripa. Con un mensaje del servidor, sí lo enseña.
// ③ El censo ve las tres formas que no veía, con control positivo (los dos sitios rotos, tal como
//    estaban en `origin/main`) y negativo, y es FAIL-CLOSED: un fichero que no se entiende sale CIEGO.
// ④ El trinquete: cada fichero con su techo medido hoy, que solo puede bajar. Lo arreglado, a cero.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { crudosDe, crudosOcultosDe, censoOculto } from './_censo-mensaje-crudo.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const AVISO_ALBARANES = 'No se han podido cargar los albaranes. Vuelve a intentarlo.';
const respirar = (ms = 0) => new Promise((r) => setTimeout(r, ms));

const respuesta = (status, cuerpo) => ({
  ok: status >= 200 && status < 300, status, statusText: status === 500 ? 'Internal Server Error' : 'Conflict',
  headers: { get: () => 'application/json' },
  json: async () => cuerpo,
  blob: async () => ({}), text: async () => JSON.stringify(cuerpo),
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ① EL HELPER
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1233 · el helper: `data.message` si es una frase; si no, el respaldo — nunca `err.message`', () => {
  const { ctx } = cargarDashboard(RAIZ);
  const m = ctx.mensajeParaPersona;
  assert.equal(typeof m, 'function', 'SUELO: api.js no expone `mensajeParaPersona`');
  const del500 = Object.assign(new Error('API 500: internal_error'), { status: 500, data: { error: 'internal_error' } });
  const sinRed = Object.assign(new Error('Failed to fetch'), { sinRed: true });
  const conFrase = Object.assign(new Error('La serie está cerrada.'), { status: 409, data: { message: 'La serie está cerrada.' } });
  assert.equal(m(del500, 'R'), 'R', '🔴 un 500 sin frase enseña el código');
  assert.equal(m(sinRed, 'R'), 'R', '🔴 sin red enseña el texto del navegador');
  assert.equal(m(conFrase, 'R'), 'La serie está cerrada.', '🔴 la frase del servidor no llega');
  assert.equal(m({ data: { message: '   ' } }, 'R'), 'R', 'una frase vacía no es una frase');
  assert.equal(m({ data: { message: { x: 1 } } }, 'R'), 'R', 'un objeto no es una frase');
  assert.equal(m(null, 'R'), 'R');
  assert.equal(m(undefined, ''), '');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ② EL VIAJE — la lista de albaranes, con el `apiRequest` REAL
// ═══════════════════════════════════════════════════════════════════════════════════════════════

async function listaTrasFallo(alPedir) {
  const banco = cargarDashboard(RAIZ, {
    red: {
      fetch: async (url) => (/\/admin\/albaranes/.test(String(url)) ? alPedir() : respuesta(200, [])),
    },
  });
  const r = await pintarVista(banco, 'renderAlbaranesView');
  assert.equal(r.error, null, `SUELO: la lista revienta: ${r.error && r.error.message}`);
  await respirar(40);
  const textos = todos(r.contenedor).map((n) => String(n.textContent || ''));
  assert.ok(textos.some((t) => t === AVISO_ALBARANES), 'CIEGO: no se pintó el aviso de fallo; no hay viaje que medir');
  return textos.join(' ‖ ');
}

test('SCRUM-1233 · 🔴 un 500 sin mensaje NO enseña «API 500: internal_error» bajo el aviso', async () => {
  const t = await listaTrasFallo(() => respuesta(500, { error: 'internal_error' }));
  assert.equal(/API 500|internal_error/.test(t), false, `🔴 la tripa del sistema en pantalla: ${t}`);
});

test('SCRUM-1233 · 🔴 sin red NO enseña el «Failed to fetch» del navegador', async () => {
  const t = await listaTrasFallo(() => { throw new TypeError('Failed to fetch'); });
  assert.equal(/Failed to fetch/.test(t), false, `🔴 inglés del navegador en pantalla: ${t}`);
});

test('SCRUM-1233 · CONTROL: una frase del servidor para una persona SÍ se enseña', async () => {
  const t = await listaTrasFallo(() => respuesta(409, { error: 'x', message: 'Tu cuenta está en pausa.' }));
  assert.ok(t.includes('Tu cuenta está en pausa.'), `🔴 el helper se traga la frase del servidor: ${t}`);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ③ EL CENSO VE LO QUE NO VEÍA — control positivo, negativo y ciego
// ═══════════════════════════════════════════════════════════════════════════════════════════════

// Los dos sitios rotos, TAL COMO estaban en `origin/main` antes de este ticket.
const ROTO_ALBARANES = "function pintarError(err) { detalle.textContent = String((err && err.message) || err || ''); }";
const ROTO_TRABAJOS = "function avisoDeFallo(prefijo, err) {\n"
  + "  const detalle = (err && err.data && err.data.message) || (err && err.message) || '';\n"
  + "  showToast(detalle ? prefijo + ': ' + detalle : prefijo, 'error');\n}";

test('SCRUM-1233 · 🔴 CONTROL POSITIVO: el censo acusa los dos sitios rotos de hoy', () => {
  // Lo que había: el censo de SCRUM-644 daba CERO a los dos. Ése es el defecto de instrumento.
  assert.equal(crudosDe('a.js', ROTO_ALBARANES).length, 0, 'SUELO: este caso ya lo veía el censo viejo');
  assert.equal(crudosDe('b.js', ROTO_TRABAJOS).length, 0, 'SUELO: este caso ya lo veía el censo viejo');
  const a = crudosOcultosDe('a.js', ROTO_ALBARANES);
  assert.deepEqual(a.hallazgos.map((h) => h.forma), ['asignación'], '🔴 no ve la asignación a `textContent`');
  const b = crudosOcultosDe('b.js', ROTO_TRABAJOS);
  assert.deepEqual(b.hallazgos.map((h) => h.forma), ['variable'], '🔴 no ve el paso por una variable');
  assert.deepEqual(crudosOcultosDe('c.js', "showErr('No se pudo guardar: ' + err.message);").hallazgos.map((h) => h.forma),
    ['pintor local'], '🔴 no ve un pintor local');
  assert.equal(crudosOcultosDe('d.js', 'el.innerHTML = `<div>Error: ${err.message}</div>`;').hallazgos.length, 1,
    '🔴 no ve un `.message` dentro de una plantilla de `innerHTML`');
  // Y la poda de condiciones no ciega la RAMA: una variable manchada en `whenTrue` sí se pinta.
  assert.equal(crudosOcultosDe('e.js', "const m = e.message; setAlert('error', ok ? m : 'x');").hallazgos.length, 1,
    '🔴 la poda de condiciones se lleva también las ramas del ternario');
});

test('SCRUM-1233 · CONTROL NEGATIVO: lo que pasa por el helper, o no se pinta, no se acusa', () => {
  const casos = [
    "detalle.textContent = mensajeParaPersona(err, '');",
    "const motivo = mensajeParaPersona(err, ''); detalle.textContent = motivo;",
    "const d = mensajeParaPersona(err, ''); showToast(d ? p + ': ' + d : p, 'error');",
    'const t = e.message; guardar(t);',
    "detalle.textContent = 'Texto fijo';",
    // Disjunto de SCRUM-644: el `.message` DIRECTO en un pintor lo cuenta aquel, no éste.
    "setAlert('error', e.message);",
    // Leída solo para DECIDIR (productsView :891): la condición no se pinta.
    "const codigo = String(e.message).trim(); setAlert('error', codigo === DUP ? A : mensajeDeErrorCatalogo(codigo, 'x'));",
  ];
  for (const c of casos) {
    assert.deepEqual(crudosOcultosDe('n.js', c).hallazgos, [], `🔴 acusa lo que no debe: ${c}`);
  }
});

test('SCRUM-1233 · 🔴 FAIL-CLOSED: un fichero que el parser no entiende sale CIEGO, no limpio', () => {
  const r = crudosOcultosDe('roto.js', 'function (\n  detalle.textContent = err.message;');
  assert.ok(r.ciego, '🔴 un fichero ilegible se da por limpio: «no pude mirar» sería «no hay nada»');
  assert.deepEqual(r.hallazgos, []);
});

test('SCRUM-1233 · 🔴 SUELO del censo: mira el dashboard entero, sin ciegos, y encuentra la población', () => {
  const r = censoOculto(RAIZ);
  assert.ok(r.ficherosMirados > 50, `🔴 solo ha mirado ${r.ficherosMirados} ficheros`);
  assert.deepEqual(r.ciegos, [], '🔴 hay ficheros que el censo no ha podido leer');
  assert.ok(r.hallazgos.length > 0, '🔴 cero sitios: o están todos arreglados (y se vacía la tabla de abajo) o está ciego');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ④ EL TRINQUETE
// ═══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Medido el 29-sep-2026 sobre `public/dashboard/js` (95 ficheros), DESPUÉS de este ticket. Cada
 * número es un TECHO: bajar se anota aquí en el mismo commit; subir cae nombrando fichero y línea.
 * Un fichero que no esté en la tabla tiene techo CERO. Casi todos son de otro carril (J: facturas,
 * clientes, pagos, alta y configuración; S4: `jobsView.js`), y aquí solo se declaran.
 */
const TECHO = Object.freeze({
  'cobrosView.js': 1,
  'customerDetailView.js': 1,
  // 2 → 1 (SCRUM-1233b): el guardado del gasto pasa por el helper. Queda :295, la carga de la
  // lista, que no tiene texto aprobado y espera firma.
  'expensesView.js': 1,
  'facturasRecibidasView.js': 1,
  'invoiceDetailView.js': 3,
  'jobsView.js': 1,
  'libroRegistroView.js': 1,
  'plansView.js': 2,
  'settingsView.js': 3,
  // CONTRATO, no defecto: `onConfirm` lanza un Error cuyo `message` YA ES el texto traducido
  // (`mensajeDeFalloAlFirmar`, `mensajeDelAlbaran`). Pasarlo por el helper lo borraría. Se queda
  // declarado para que un llamador nuevo que lance crudo lo tenga que mirar aquí.
  'signaturePad.js': 1,
  // `r` es el CUERPO de una respuesta 200 con `sent:false`: `r.message` es ya `data.message`.
  'tutorial.js': 1,
});
// 19 → 16 (SCRUM-1233b): teamView y el guardado de expensesView, al helper; productsView :891 era
// un FALSO POSITIVO (la variable solo se leía en la condición del ternario) y el censo ya no lo cuenta.
const TOTAL_MEDIDO = 16;

test('SCRUM-1233 · 🔴 EL TRINQUETE: ningún fichero pinta más `.message` ocultos que su techo', () => {
  const por = new Map();
  for (const h of censoOculto(RAIZ).hallazgos) {
    const base = h.fichero.split('/').pop();
    if (!por.has(base)) por.set(base, []);
    por.get(base).push(h);
  }
  const excesos = [];
  for (const [base, sitios] of por) {
    const techo = TECHO[base] || 0;
    if (sitios.length > techo) {
      excesos.push(`  ${base}: ${sitios.length} sitios y el techo es ${techo}\n`
        + sitios.map((s) => `      ${s.fichero}:${s.linea}  [${s.forma}]  ${s.fragmento}`).join('\n'));
    }
  }
  assert.deepEqual(excesos, [],
    '🔴 SE PINTA UN `.message` SIN PASAR POR `mensajeParaPersona`. `err.message` es «API 500: …» o\n'
    + '  «Failed to fetch» siempre que el servidor no mandó una frase: pásalo por\n'
    + '  `mensajeParaPersona(err, TEXTO_APROBADO)` (api.js). NO subas el techo.\n\n'
    + excesos.join('\n'));
});

test('SCRUM-1233 · 🔴 la tabla NO CRECE, y lo arreglado se queda en cero', () => {
  const total = Object.values(TECHO).reduce((a, b) => a + b, 0);
  assert.ok(total <= TOTAL_MEDIDO, `🔴 la tabla ha subido a ${total}; solo puede bajar de ${TOTAL_MEDIDO}`);
  for (const base of ['albaranesView.js', 'jobDetailView.js', 'quoteRevisiones.js', 'teamView.js', 'productsView.js']) {
    assert.equal(base in TECHO, false, `🔴 ${base} ha vuelto a la tabla: se arregló en SCRUM-1233 y su techo es CERO`);
  }
});
