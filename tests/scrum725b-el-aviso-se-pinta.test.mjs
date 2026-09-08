// tests/scrum725b-el-aviso-se-pinta.test.mjs — SCRUM-725 ①
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL MECANISMO DETECTABA EL DATO INVENTADO Y LA PANTALLA NO LO DECÍA.
//
// SCRUM-725 cerró la detección: `sanearDictadoDelParte` marca en `datosRetirados` la marca, el
// modelo o la referencia que el dictado no sostiene. Pero eso viajaba en el JSON y **no se
// pintaba**. Un mecanismo que detecta y no avisa es medio mecanismo: el técnico firma el parte
// sin enterarse de que lleva un `G3-144` que él no dijo.
//
// ✅ Texto APROBADO por el fundador el 7-sep-2026 (regla 30), registrado en
// `docs/microcopy/2026-09-07-SCRUM-725-dato-no-dicho.md`:
//
//     Esto no lo has dicho — bórralo o confírmalo.
//
// ── 🔴 POR QUÉ ESTE FICHERO MIRA EL DOM Y NO EL FUENTE ───────────────────────────────────
// Comprobar que `parteDetailView.js` CONTIENE la cadena no prueba que el técnico la vea. Ya nos
// costó una tanda: un aviso pintado con `appendChild` y borrado cuatro líneas después por un
// `innerHTML`, con el test en verde porque el texto seguía estando en el fuente.
//
// Aquí se monta el panel de verdad con el banco de vistas, se llama al camino REAL del dictado
// (`parteOrdenarDictado`, con la respuesta del servidor inyectada) y se pregunta al ÁRBOL
// RESULTANTE. Si alguien pinta el aviso y lo pisa después, este fichero se pone rojo.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, todos } from './_banco-vistas.mjs';
import { sanearDictadoDelParte, AVISOS_DEL_DICTADO }
  from '../dist/modules/jobs/domain/parteDictado.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const AVISO = AVISOS_DEL_DICTADO.datosRetirados;

/**
 * Monta el bloque del dictado, hace pasar por él la propuesta REAL del servidor para ese dictado,
 * y devuelve el árbol que queda. Nada de fuente: lo que el técnico tendría delante.
 */
async function pintar(dictado, crudoDelModelo) {
  const banco = cargarDashboard(RAIZ);
  const ctx = banco.ctx;
  assert.equal(typeof ctx.parteOrdenarDictado, 'function',
    '🔴 SUELO: la vista ya no publica `parteOrdenarDictado`. Sin el camino real, este fichero '
    + 'estaría probando otra cosa.');

  // El contenedor que la vista espera: el campo del dictado y el hueco de la propuesta.
  const caja = banco.mk('div');
  caja.innerHTML = '<textarea data-dictado-texto="1"></textarea>'
    + '<div data-dictado-propuesta="1"></div>';
  const campo = caja.querySelector('[data-dictado-texto="1"]');
  assert.ok(campo, '🔴 SUELO: el banco no resuelve el campo del dictado; no se puede dictar nada');
  campo.value = dictado;

  // 🔴 La propuesta la produce el MECANISMO DE VERDAD, no una a mano: si mañana
  // `sanearDictadoDelParte` deja de marcar el dato, este test tiene que caerse con él.
  const propuesta = sanearDictadoDelParte(crudoDelModelo, dictado);
  await ctx.parteOrdenarDictado({ id: 7 }, caja, {
    apiRequest: async () => ({ propuesta, avisos: AVISOS_DEL_DICTADO }),
  });

  const nodos = todos(caja);
  const destino = caja.querySelector('[data-dictado-propuesta="1"]');
  return {
    propuesta,
    nodos,
    destino,
    conAviso: nodos.filter((n) => n.getAttribute && n.getAttribute('data-dato-inventado') === '1'),
    texto: nodos.map((n) => String(n.textContent || '')).join(' '),
  };
}

// ═══ 🔴 SUELO ═════════════════════════════════════════════════════════════════════════════

test('SCRUM-725b · 🔴 SUELO: el banco monta el bloque y pinta las líneas de verdad', async () => {
  const r = await pintar('cambie 3 detectores Honeywell',
    [{ bloque: 'materiales', descripcion: 'Detectores Honeywell', unds: 3 }]);
  const filas = r.nodos.filter((n) => n.getAttribute && n.getAttribute('data-propuesta') === '1');
  assert.equal(filas.length, 1,
    `🔴 el banco ha pintado ${filas.length} líneas de propuesta. Sin líneas en el árbol, «no hay `
    + 'aviso» significaría «no he pintado nada», no «no hace falta avisar».');
  assert.ok(AVISO && AVISO.length > 10, '🔴 el texto aprobado ha desaparecido del servidor');
});

// ═══ 🔴 EL AVISO APARECE ══════════════════════════════════════════════════════════════════

test('SCRUM-725b · 🔴 «reviso la central» + modelo inventado → EL AVISO ESTÁ EN EL DOM', async () => {
  const r = await pintar('reviso la central',
    [{ bloque: 'mano_obra', descripcion: 'Revision de central Honeywell Galaxy G3-144', unds: null }]);

  // Primero, que el mecanismo lo detectó — si no, el aviso faltaría por otro motivo.
  assert.equal(r.propuesta.datosRetirados.length, 1,
    '🔴 el mecanismo no ha marcado el dato: este test no estaría probando la pantalla');

  assert.equal(r.conAviso.length, 1,
    '🔴 EL AVISO NO ESTÁ EN EL DOM. El servidor sabe que la línea lleva un dato que el técnico no '
    + 'dijo y la pantalla se lo calla: firma un parte con un modelo de central que él no nombró.');
  assert.equal(r.conAviso[0].textContent, AVISO,
    '🔴 el aviso pintado NO es el texto aprobado. La regla 30 no admite parafrasear (ni el punto).');
});

// ═══ ✅ CONTROL POSITIVO — con todo respaldado, NO sale ════════════════════════════════════

test('SCRUM-725b · ✅ CONTROL POSITIVO: un dictado limpio NO pinta el aviso', async () => {
  // 🔴 Es el control que decide si el aviso sirve: uno que sale siempre se ignora en dos días, y
  // entonces da igual que esté. Aquí el 3 y la marca están DICHOS.
  const r = await pintar('cambie 3 detectores Honeywell',
    [{ bloque: 'materiales', descripcion: 'Detectores Honeywell', unds: 3 }]);

  assert.deepEqual(r.propuesta.datosRetirados, [],
    '🔴 el mecanismo marca como inventado un dato que el técnico SÍ dijo');
  assert.equal(r.conAviso.length, 0,
    '🔴 el aviso sale sobre una línea enteramente respaldada. Un aviso que sale siempre no avisa.');
  assert.equal(r.texto.includes(AVISO), false,
    '🔴 el texto del aviso aparece en la pantalla por otra vía');
});

// ═══ 🔴 LA TRAMPA: SE MIRA EL RESULTADO, NO EL FUENTE ═════════════════════════════════════

test('SCRUM-725b · 🔴 el aviso SOBREVIVE al pintado completo, no sólo se emite', async () => {
  // El defecto que ya nos costó una tanda: pintar con `appendChild` y pisarlo con un `innerHTML`
  // cuatro líneas después. El fuente contiene el aviso y la pantalla no lo enseña.
  //
  // Se comprueba sobre el árbol FINAL —el mismo que vería el técnico— y ADEMÁS que el aviso
  // cuelga de la línea a la que pertenece: un aviso suelto al final no dice CUÁL sobra.
  const r = await pintar('reviso la central',
    [{ bloque: 'mano_obra', descripcion: 'Revision de central Honeywell Galaxy G3-144', unds: null }]);

  const em = r.conAviso[0];
  assert.ok(em, '🔴 el aviso no ha sobrevivido al pintado');
  assert.equal(em.textContent, AVISO, '🔴 sobrevive un nodo vacío, no el aviso');

  // ⚠️ Y EL ANIDAMIENTO SE PREGUNTA A LA SALIDA RENDERIZADA, NO AL FUENTE NI AL ÁRBOL.
  //
  // Medido: el mini-DOM del banco APLANA lo que parsea de un `innerHTML` — todos los nodos
  // quedan colgando de la raíz, así que `_padre` no puede contestar si el `<em>` está dentro de
  // su `<li>`. No es un fallo de esta pantalla; es el alcance del banco, y se reporta sin
  // arreglarlo aquí (regla 9): tocarlo es infraestructura compartida y otro ticket.
  //
  // Lo que SÍ es el resultado —y no el fuente— es el marcado que la vista ACABÓ escribiendo.
  // Sobre él se comprueba que el aviso cae DENTRO de la línea, que es lo que hace que diga cuál
  // sobra: suelto al final, con varias líneas, el técnico no sabe dónde mirar.
  const pintado = r.destino.innerHTML;
  const iLinea = pintado.indexOf('data-propuesta="1"');
  const iAviso = pintado.indexOf('data-dato-inventado="1"');
  const iCierre = pintado.indexOf('</li>', iLinea);
  assert.ok(iLinea >= 0 && iAviso >= 0 && iCierre > iLinea,
    '🔴 SUELO: no encuentro la línea y el aviso en el marcado pintado, así que la comprobación '
    + 'de abajo no diría nada');
  assert.ok(iAviso > iLinea && iAviso < iCierre,
    '🔴 el aviso está en la pantalla pero FUERA de la línea que lleva el dato inventado. '
    + 'Suelto no dice cuál sobra.');
});

// ═══ ✅ El texto NO se reteclea en la pantalla ═════════════════════════════════════════════

test('SCRUM-725b · ✅ la pantalla COPIA el texto del servidor, no lo reescribe', async () => {
  // Un texto aprobado que se reteclea en cada pantalla deja de ser el aprobado sin que nadie lo
  // decida. Se comprueba que la vista no lleva la cadena escrita dentro.
  const { leerFuente } = await import('./_guard-texto.mjs');
  const vista = leerFuente(path.join(RAIZ, 'public/dashboard/js/parteDetailView.js'),
    { ancla: 'data-dato-inventado' });
  assert.equal(vista.includes('bórralo o confírmalo'), false,
    '🔴 el texto aprobado está retecleado en la vista. Viene de `avisos.datosRetirados`, del '
    + 'servidor, que es donde vive y donde se aprueba.');
});
