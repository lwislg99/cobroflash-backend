// tests/scrum1233j-cuatro-sin-sufijo-crudo.test.mjs — SCRUM-1233j (carril S2)
//
// Cuatro avisos de `jobDetailView.js` componían «<rótulo>: » + `(e?.data?.message || e.message)`
// A MANO, cuatro veces. `e.message` lo fabrica `apiRequest` (api.js:299) con
// `data?.message || \`API ${res.status}: ${data?.error || res.statusText}\``, así que un 500 SIN
// `data.message` enseñaba «No se pudo crear el albarán: API 500: internal_error» — la tripa del
// sistema, detrás de dos puntos, delante de un fontanero.
//
// EL ARREGLO: `mensajeDeFallo(rotulo, err)` (jobDetailView.js), un solo sitio que usa el helper
// ya existente `mensajeParaPersona` (api.js:333; mismo patrón que `avisoDeFallo`, jobsView.js:397).
// Con una frase para personas: «<rótulo>: <frase>», IGUAL que antes. Sin ella: el rótulo SOLO, sin
// los dos puntos — un PREFIJO EXACTO de lo que ya se pintaba, no microcopy nuevo (regla 30).
//
// LOS CUATRO SITIOS (antes → después):
//   ① :939  falloDelCta (CTA de cabecera) — «No se pudo completar la acción: …»
//   ② :1337 cambiar el tipo de trabajo    — «No se pudo guardar el tipo de trabajo: …»
//   ③ :1812 crear albarán                 — «No se pudo crear el albarán: …»
//   ④ :2251 marcar factura como pagada    — «Error actualizando estado: …» (además perdía el
//            respaldo `e?.data?.error`: un código técnico sin frase para personas tampoco se pinta)
//
// Ninguno de los cuatro `try` tenía un `throw new Error(...)` LOCAL dentro: los tres primeros solo
// relanzan lo que tira `apiRequest` (o `abrirAltaAlbaran`, que tampoco lanza en local); el cuarto
// solo espera el `PUT /status`. No hay ningún texto aprobado local que este cambio pudiera pisar.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard } from './_banco-vistas.mjs';
import { soloCodigo } from './_solo-codigo.mjs';
import { crudosDe, crudosOcultosDe } from './_censo-mensaje-crudo.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FUENTE = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/jobDetailView.js'), 'utf8');
const SIN_COMENTARIOS = soloCodigo(FUENTE, 'jobDetailView.js');

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ① EL HELPER, con el `apiRequest` REAL (el error que fabrica api.js de verdad, no uno a mano)
// ═══════════════════════════════════════════════════════════════════════════════════════════════

const respuesta = (status, cuerpo) => ({
  ok: status >= 200 && status < 300, status, statusText: status === 500 ? 'Internal Server Error' : 'Conflict',
  headers: { get: () => 'application/json' },
  json: async () => cuerpo, blob: async () => ({}), text: async () => JSON.stringify(cuerpo),
});

function cargar() {
  const banco = cargarDashboard(RAIZ, { red: { fetch: async () => respuesta(500, {}) } });
  const { ctx } = banco;
  assert.equal(typeof ctx.mensajeDeFallo, 'function', 'CIEGO: jobDetailView.js no publica `mensajeDeFallo`');
  assert.equal(typeof ctx.apiRequest, 'function', 'CIEGO: api.js no publica `apiRequest`');
  return { banco, ctx };
}

test('SCRUM-1233j · 🔴 ROJO PRIMERO: un 500 sin `data.message` no enseña «API 500» ni «internal_error»', async () => {
  const { ctx } = cargar();
  const banco2 = cargarDashboard(RAIZ, { red: { fetch: async () => respuesta(500, { error: 'internal_error' }) } });
  let err = null;
  try { await banco2.ctx.apiRequest('/admin/jobs/1'); } catch (e) { err = e; }
  // Control del instrumento: el error que fabrica api.js SÍ lleva la tripa en `message`. Si no la
  // llevara, este test pasaría también con el código viejo y no probaría nada (SUELO).
  assert.match(String(err.message), /API 500|internal_error/,
    `CIEGO: el error de api.js ya no lleva la tripa: ${err.message}`);

  const texto = ctx.mensajeDeFallo('No se pudo crear el albarán', err);
  assert.equal(texto.includes('API 500'), false, `🔴 la tripa del sistema en pantalla: ${texto}`);
  assert.equal(texto.includes('internal_error'), false, `🔴 el código interno en pantalla: ${texto}`);
  // Y es EXACTAMENTE el rótulo: no un rótulo con basura detrás, ni con los dos puntos colgando.
  assert.equal(texto, 'No se pudo crear el albarán');
});

test('SCRUM-1233j · 🔴 CONTROL POSITIVO: una frase del servidor para personas SÍ sale detrás del rótulo', async () => {
  const { ctx } = cargar();
  const banco2 = cargarDashboard(RAIZ, {
    red: { fetch: async () => respuesta(409, { error: 'x', message: 'El cliente no tiene teléfono' }) },
  });
  let err = null;
  try { await banco2.ctx.apiRequest('/admin/jobs/1'); } catch (e) { err = e; }
  assert.ok(err, 'SUELO: la petición no falló');
  const texto = ctx.mensajeDeFallo('No se pudo crear el albarán', err);
  assert.equal(texto, 'No se pudo crear el albarán: El cliente no tiene teléfono',
    `🔴 el arreglo se come el mensaje bueno: «${texto}»`);
});

test('SCRUM-1233j · sin red, el rótulo solo — nunca el «Failed to fetch» del navegador', async () => {
  const { ctx } = cargar();
  const banco2 = cargarDashboard(RAIZ, { red: { fetch: async () => { throw new TypeError('Failed to fetch'); } } });
  let err = null;
  try { await banco2.ctx.apiRequest('/admin/jobs/1'); } catch (e) { err = e; }
  assert.match(String(err.message), /Failed to fetch/, 'CIEGO: el error ya no lleva el texto del navegador');
  assert.equal(ctx.mensajeDeFallo('Error actualizando estado', err), 'Error actualizando estado');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ② EL RESPALDO `e?.data?.error` DEL CUARTO SITIO TAMBIÉN DESAPARECE
//
// Antes: 'Error actualizando estado: ' + (e?.data?.message || e?.data?.error || e.message).
// Un código técnico («payment_anomaly») SIN frase para personas se seguía pintando. Ahora cae al
// rótulo solo, igual que los otros tres: un identificador interno no es un mensaje para personas,
// tenga o no la forma de `data.message`.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1233j · el código técnico de `data.error` YA NO sale cuando no hay `data.message`', async () => {
  const { ctx } = cargar();
  const err = Object.assign(new Error('API 409: payment_anomaly'), { status: 409, data: { error: 'payment_anomaly' } });
  const texto = ctx.mensajeDeFallo('Error actualizando estado', err);
  assert.equal(texto, 'Error actualizando estado');
  assert.equal(texto.includes('payment_anomaly'), false);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ③ LOS CUATRO SITIOS, cubiertos: cada uno llama a `mensajeDeFallo` con SU rótulo, y la forma
// cruda que pintaban antes no vuelve a aparecer en el fuente (sin comentarios, para no cazarse
// a sí mismo en la documentación de arriba — mismo criterio que `soloCodigo`, SCRUM-693/700).
// ═══════════════════════════════════════════════════════════════════════════════════════════════

const SITIOS = [
  ['falloDelCta (CTA de cabecera)', "mensajeDeFallo('No se pudo completar la acción', err)"],
  ['cambiar el tipo de trabajo', "mensajeDeFallo('No se pudo guardar el tipo de trabajo', e)"],
  ['crear albarán', "mensajeDeFallo('No se pudo crear el albarán', e)"],
  ['marcar factura como pagada', "mensajeDeFallo('Error actualizando estado', e)"],
];

test('SCRUM-1233j · 🔴 los cuatro sitios llaman al helper con SU rótulo exacto', () => {
  for (const [quien, llamada] of SITIOS) {
    assert.ok(SIN_COMENTARIOS.includes(llamada), `🔴 ${quien}: no se encuentra \`${llamada}\` en jobDetailView.js`);
  }
});

test('SCRUM-1233j · 🔴 la forma cruda vieja no vuelve: ningún `data?.message || …message)` detrás de los cuatro rótulos', () => {
  const ROTULOS = ['No se pudo completar la acción', 'No se pudo guardar el tipo de trabajo',
    'No se pudo crear el albarán', 'Error actualizando estado'];
  for (const rotulo of ROTULOS) {
    const i = SIN_COMENTARIOS.indexOf(rotulo);
    assert.notEqual(i, -1, `🔴 el rótulo «${rotulo}» ha desaparecido del fichero`);
    const alrededor = SIN_COMENTARIOS.slice(Math.max(0, i - 40), i + rotulo.length + 80);
    assert.equal(alrededor.includes('.message'), false,
      `🔴 ${rotulo}: sigue habiendo un \`.message\` crudo cerca: ${alrededor.replace(/\s+/g, ' ')}`);
  }
});

test('SCRUM-1233j · el censo de SCRUM-644 ya no acusa a estos cuatro sitios', () => {
  const sitios = crudosDe('jobDetailView.js', FUENTE);
  for (const [, llamada] of SITIOS) {
    const rotulo = llamada.match(/'([^']+)'/)[1];
    assert.equal(sitios.some((s) => s.fragmento.includes(rotulo)), false,
      `🔴 el censo sigue viendo «${rotulo}» como un \`.message\` crudo`);
  }
  // El techo bajó de 9 a 5 (tests/scrum644-trinquete-mensaje-crudo.test.mjs, CENSO_HEREDADO).
  assert.equal(sitios.length, 5, `🔴 jobDetailView.js tiene ${sitios.length} sitios crudos, se esperaban 5`);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ④ EL CENSO (SCRUM-644/1233): MEDIDO, no amplía código porque ya cazaba la forma
//
// El encargo pedía comprobar que `crudosDe`/`crudosOcultosDe` cazan `(e?.data?.message ||
// e.message)` y `err?.data?.message || err.message` con `?.`, y ampliarlos si no. MEDIDO con los
// dos casos sembrados de abajo: el censo YA los veía — con y sin concatenación de prefijo, con
// `?.` en cada nivel, en forma directa (`crudosDe`) y mediada por variable/asignación
// (`crudosOcultosDe`) — antes de tocar nada en este ticket. No se modifica
// `tests/_censo-mensaje-crudo.mjs`: no hay nada que afianzar, y tocar un instrumento que ya mide
// bien es el riesgo que SCRUM-645 señala (aflojarlo sin que nadie lo decidiera). Lo que se añade
// es el caso SEMBRADO que lo deja fijado como control permanente.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1233j · 🔴 SEMBRADO: el censo YA caza `(e?.data?.message || e.message)` con `?.`', () => {
  const SEMBRADO_DIRECTO = "function f(e){ setStatus('error', 'Prefijo: ' + (e?.data?.message || e.message)); }";
  assert.equal(crudosDe('sembrado.js', SEMBRADO_DIRECTO).length, 1,
    '🔴 el censo directo ya NO ve el OR con encadenamiento opcional; esto exigiría ampliar crudosDe.');

  const SEMBRADO_BARE = "function f(err){ setStatus('error', err?.data?.message || err.message); }";
  assert.equal(crudosDe('sembrado2.js', SEMBRADO_BARE).length, 1,
    '🔴 el censo directo no ve el OR desnudo (sin concatenar), con `?.` en cada nivel.');

  const SEMBRADO_VARIABLE = "function f(e){ const d = e?.data?.message || e.message; setStatus('error', 'P: ' + d); }";
  const oculto = crudosOcultosDe('sembrado3.js', SEMBRADO_VARIABLE);
  assert.equal(oculto.hallazgos.length, 1,
    '🔴 el censo oculto (variable manchada) no ve el OR con `?.` cuando pasa por una variable.');
});

test('SCRUM-1233j · CONTROL: `mensajeParaPersona(e, respaldo)` NO es un hallazgo', () => {
  const PASA_POR_EL_HELPER = "function f(e){ setStatus('error', mensajeParaPersona(e, '')); }";
  assert.deepEqual(crudosDe('sembrado4.js', PASA_POR_EL_HELPER), [],
    '🔴 acusa a un sitio YA traducido por mensajeParaPersona: el censo dejaría de poder cerrarse.');
  assert.deepEqual(crudosOcultosDe('sembrado4.js', PASA_POR_EL_HELPER).hallazgos, [],
    '🔴 (oculto) acusa a un sitio YA traducido por mensajeParaPersona.');

  // Y por la variable intermedia, que es como lo usa `mensajeDeFallo` de este mismo ticket.
  const POR_VARIABLE = "function f(e, rotulo){ const d = mensajeParaPersona(e, ''); setStatus('error', d ? rotulo + ': ' + d : rotulo); }";
  assert.deepEqual(crudosOcultosDe('sembrado5.js', POR_VARIABLE).hallazgos, [],
    '🔴 (oculto) acusa a una variable que viene de mensajeParaPersona, no del `.message` crudo.');
});
