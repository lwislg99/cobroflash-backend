// tests/scrum405-microcopy-descarga.test.mjs — SCRUM-405 · la microcopy aprobada de la descarga
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL DEFECTO QUE CIERRA, Y POR QUÉ NO ES «UN TEXTO»
//
// `descargarBinario` falla con `esHtml || !cuadra` — **dos causas distintas**— y hasta el
// 10-ago-2026 las dos pintaban el MISMO mensaje: el del portal cautivo. Cuando la causa era la
// segunda, ese texto **mentía**: culpaba a la wifi de la obra y mandaba al profesional a gastar
// datos móviles para arreglar algo que no estaba en su red.
//
// Y encima el mensaje llevaba el marcador `[PENDIENTE microcopy oficial · propuesta: …]`, corchetes
// incluidos, **enseñado tal cual al usuario en cuatro sitios**. En un mensaje de error, que es
// donde peor sienta.
//
// Los dos textos están APROBADOS por el asesor (10-ago-2026, regla 30). Reformularlos es cambio de
// máster, no edición — por eso este fichero los fija contra el fuente y no contra una copia.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = path.join(RAIZ, 'public/dashboard/js/api.js');

/**
 * Los dos textos, leídos DEL FUENTE.
 *
 * 🔴 SUELO: si no se encuentran, esto falla declarándose ciego en vez de comparar contra
 * `undefined` — que daría igualdad trivial y un verde sobre nada. Es el mismo suelo que el de
 * SCRUM-427 con los rótulos, y por el mismo motivo.
 */
function textosAprobados() {
  assert.ok(fs.existsSync(API), `🔴 CIEGO: no se encuentra ${API}.`);
  const src = fs.readFileSync(API, 'utf8');
  const saca = (nombre) => {
    const m = new RegExp(`const ${nombre} =\\s*((?:'[^']*'\\s*\\+?\\s*)+);`).exec(src);
    assert.ok(m, `🔴 CIEGO: no se encuentra el literal de ${nombre} en api.js. Sin él no se puede ` +
      'afirmar qué texto se pinta, y comparar contra nada da un verde que no significa nada.');
    return m[1].split('+').map((t) => t.trim().replace(/^'|'$/g, '')).join('');
  };
  return { A: saca('MSG_DESCARGA_PORTAL_CAUTIVO'), B: saca('MSG_DESCARGA_TIPO_INESPERADO') };
}

/** Ejecuta `descargarBinario` con una respuesta de mentira y devuelve el error que lanza. */
async function errorDeDescarga(contentType, tipoEsperado) {
  const banco = cargarDashboard(RAIZ);
  banco.ctx.fetch = async () => ({
    ok: true,
    status: 200,
    headers: { get: (h) => (String(h).toLowerCase() === 'content-type' ? contentType : null) },
  });
  try {
    await banco.ctx.descargarBinario('/admin/exports/lo-que-sea', {
      tipoEsperado, nombrePorDefecto: 'x',
    });
    return null;
  } catch (e) {
    return { err: e, mensaje: banco.ctx.mensajeDescargaFallida(e) };
  }
}

// ── SUELO ────────────────────────────────────────────────────────────────────────────────

test('SCRUM-405 · 🔴 SUELO: los dos textos se leen del fuente, o esto se declara ciego', () => {
  const { A, B } = textosAprobados();
  assert.ok(A.length > 40 && B.length > 40, '🔴 alguno de los dos textos salió vacío o truncado.');
  assert.notEqual(A, B, '🔴 los dos textos son el mismo: entonces no hay dos casos, hay uno.');
});

test('SCRUM-405 · 🔴 ya NO queda marcador de microcopy en `api.js`', () => {
  const src = fs.readFileSync(API, 'utf8');
  // El marcador dentro de un literal es el que se pinta; en un comentario no cuenta (R5 de 402).
  const enLiteral = /'[^']*\[PENDIENTE microcopy oficial[^']*'/.test(src);
  assert.equal(enLiteral, false,
    '🔴 vuelve a haber un marcador PINTABLE en api.js: el usuario leería «[PENDIENTE microcopy ' +
    'oficial · …]» dentro de un mensaje de error.');
});

// ── CONTROL POSITIVO, UNA RAMA CADA VEZ ──────────────────────────────────────────────────

test('SCRUM-405 · ✅ CASO A: una respuesta `text/html` da el texto del PORTAL CAUTIVO', async () => {
  const { A, B } = textosAprobados();
  const r = await errorDeDescarga('text/html; charset=utf-8', 'zip');
  assert.ok(r, '🔴 una respuesta HTML NO hizo fallar la descarga.');
  assert.equal(r.err.esHtml, true, '🔴 el error no marca que la respuesta fuera una página.');
  assert.equal(r.mensaje, A,
    '🔴 SE PINTÓ EL MENSAJE EQUIVOCADO en el caso del portal cautivo.\n\n' +
    `   se pintó : «${r.mensaje}»\n   tocaba   : «${A}»\n\n` +
    `   (el que se pintó ${r.mensaje === B ? 'ES el del OTRO caso' : 'no es ninguno de los dos'})`);
});

test('SCRUM-405 · ✅ CASO B: un tipo inesperado que NO es HTML da «es cosa nuestra»', async () => {
  const { A, B } = textosAprobados();
  const r = await errorDeDescarga('application/json', 'zip');
  assert.ok(r, '🔴 un tipo que no cuadra NO hizo fallar la descarga.');
  assert.equal(r.err.esHtml, false, '🔴 el error dice que era una página y no lo era.');
  assert.equal(r.mensaje, B,
    '🔴 SE PINTÓ EL MENSAJE EQUIVOCADO en el caso del tipo inesperado.\n\n' +
    `   se pintó : «${r.mensaje}»\n   tocaba   : «${B}»\n\n` +
    `   (el que se pintó ${r.mensaje === A ? 'ES el del PORTAL CAUTIVO: le está echando la culpa a ' +
      'la wifi del profesional por algo que no está en su red, y mandándole a gastar datos móviles ' +
      'para arreglarlo. Es EXACTAMENTE el defecto que este ticket cierra' : 'no es ninguno de los dos'})`);
});

test('SCRUM-405 · los dos casos NO pueden dar el mismo texto', async () => {
  // El defecto original en una línea: con un solo mensaje, esto pasaba.
  const a = await errorDeDescarga('text/html', 'zip');
  const b = await errorDeDescarga('application/json', 'zip');
  assert.notEqual(a.mensaje, b.mensaje,
    '🔴 las dos causas vuelven a pintar el MISMO mensaje. Es el defecto de origen: una de las dos ' +
    'situaciones estará recibiendo un texto que no le corresponde.');
});

// ── SEGUNDA CAPA — la que sobrevive a que alguien reescriba la primera ───────────────────
//
// 🔴 La primera capa fija el LITERAL: si cambia el texto, cae. Pero un literal se puede actualizar
// de buena fe —«lo he reformulado un poco»— y con él se actualizaría el test, y las dos mitades
// volverían a estar de acuerdo en algo equivocado. Eso ya nos pasó: el mensaje único llevaba meses
// culpando a la wifi en un caso que no era la wifi, y todo estaba «verde».
//
// Esta capa no mira QUÉ dice el texto sino QUÉ NO PUEDE DECIR: el CASO B no habla de la red del
// profesional, pase lo que pase con la redacción. Sobrevive a que alguien reescriba la primera.

test('SCRUM-405 · 🔴 SEGUNDA CAPA: el CASO B NO puede culpar a la red, se redacte como se redacte', () => {
  const { A, B } = textosAprobados();

  // Vocabulario de «la culpa es de tu conexión». Lista corta y declarada: es un detector de HECHO
  // —¿se le está mandando a hacer algo con su red?— y no de tono.
  const CULPA_A_LA_RED = /\b(wifi|wi-fi|red|conexión|conexion|datos móviles|datos moviles|cobertura|router)\b/i;

  // ⚠️ HERMANO POSITIVO PRIMERO: se demuestra que el detector RECONOCE ese vocabulario donde sí
  // está —el CASO A, que habla de la red con toda la razón—. Sin esto, «el B no lo dice» sería
  // verde aunque el patrón estuviera mal escrito.
  assert.match(A, CULPA_A_LA_RED,
    '🔴 el detector no reconoce el vocabulario de red ni en el CASO A, que va precisamente de eso: ' +
    'entonces su silencio sobre el CASO B no significa nada.');

  // La afirmación: el CASO B habla de la conexión SOLO para descartarla («no es tu conexión»).
  const sinLaNegacion = B.replace(/no es tu (conexión|conexion)/i, '');
  assert.doesNotMatch(sinLaNegacion, CULPA_A_LA_RED,
    '🔴 EL CASO B HA VUELTO A CULPAR A LA RED.\n\n' +
    `   texto: «${B}»\n\n` +
    '   Ese mensaje sale cuando la respuesta NO era una página, así que no hay ninguna razón para ' +
    'creer que el problema esté en la wifi del profesional. Mandarle a cambiar de red o a gastar\n' +
    '   datos móviles le cuesta tiempo y dinero para arreglar algo que está en el servidor.\n' +
    '   Es EXACTAMENTE el defecto que este ticket cerró: no puede volver por una reescritura.');
});

test('SCRUM-405 · 🔴 SEGUNDA CAPA: el CASO B asume la culpa, y el A no se la echa al usuario', () => {
  const { A, B } = textosAprobados();
  assert.match(B, /es cosa nuestra|es cosa de nosotros|problema nuestro/i,
    '🔴 el CASO B ya no asume la culpa. Esa frase es la que impide que el profesional gaste datos, ' +
    'cambie de sitio o dé por hecho que su conexión está mal.');
  // Y ninguno de los dos le dice que haya hecho algo mal.
  const CULPA_AL_USUARIO = /has hecho|error tuyo|te has equivocado|incorrecto/i;
  // ⚠️ HERMANO POSITIVO (SCRUM-237): sin demostrar que el patrón reconoce ese vocabulario, «no lo
  // dicen» sería verde aunque estuviera mal escrito — y entonces no comprobaría nada.
  assert.match('Has hecho algo incorrecto', CULPA_AL_USUARIO,
    '🔴 el detector de culpa al usuario no reconoce ni un caso evidente.');
  for (const [n, t] of [['A', A], ['B', B]]) {
    assert.doesNotMatch(t, CULPA_AL_USUARIO,
      `🔴 el CASO ${n} culpa al profesional de algo que no ha hecho.`);
  }
});

test('SCRUM-405 · 🔴 SEGUNDA CAPA: los dos textos CABEN en el toast', () => {
  // El defecto que costó una segunda aprobación: los textos de la primera pasada eran correctos y
  // NO CABÍAN — ~9,5 s de lectura en un toast que dura 5. Un mensaje de error que se va antes de
  // decir qué hacer es casi peor que no darlo.
  const { A, B } = textosAprobados();
  const MAS_LARGO_DEL_PRODUCTO = 137;   // medido el 10-ago-2026 sobre todos los `showToast` del árbol
  for (const [n, t] of [['A', A], ['B', B]]) {
    assert.ok(t.length <= MAS_LARGO_DEL_PRODUCTO,
      `🔴 el CASO ${n} tiene ${t.length} caracteres y el toast de error más largo del producto son ` +
      `${MAS_LARGO_DEL_PRODUCTO}. A ~3,3 palabras/s no da tiempo a leerlo antes de que se vaya, y ` +
      'lo que se pierde es la parte que dice qué hacer.');
  }
});

test('SCRUM-405 · sin señal de página se elige el caso B, que es el prudente', () => {
  const banco = cargarDashboard(RAIZ);
  const { B } = textosAprobados();
  for (const err of [null, undefined, {}, { code: 'x' }, { esHtml: 'sí' }]) {
    assert.equal(banco.ctx.mensajeDescargaFallida(err), B,
      '🔴 sin constancia de que fuera una página se está culpando a la red. La asimetría manda: ' +
      'equivocarse hacia «es cosa nuestra» cuesta un reintento; hacia «es tu wifi» cuesta datos, ' +
      'un viaje y la sospecha de que su conexión está mal.');
  }
});

// ── NADIE SE SALTA LA FUNCIÓN ────────────────────────────────────────────────────────────

test('SCRUM-405 · las cinco ramas eligen el texto por la FUNCIÓN, no a mano', () => {
  const vistas = ['exportView.js', 'reportsView.js'];
  let ramas = 0;
  for (const v of vistas) {
    const src = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js', v), 'utf8');
    for (const m of src.matchAll(/ERROR_NO_ES_FICHERO\)\s*\{\s*showToast\(([^,]+),/g)) {
      ramas++;
      assert.match(m[1].trim(), /^mensajeDescargaFallida\(/,
        `🔴 en ${v} una rama elige el texto a mano («${m[1].trim()}») en vez de por ` +
        '`mensajeDescargaFallida`. Así es como vuelven a divergir los dos casos.');
    }
  }
  assert.equal(ramas, 5,
    `🔴 SUELO: se esperaban las 5 ramas conocidas y se han visto ${ramas}. O han aparecido sitios ` +
    'nuevos que enseñan este error, o el escáner dejó de verlos.');
});
