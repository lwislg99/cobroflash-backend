// tests/scrum1200-sin-respuesta.test.mjs — SCRUM-1200 (el resto)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// CUANDO NO HAY RESPUESTA, NO SE AFIRMA NADA: SE MANDA A MIRAR
//
// El 400 y el 409 al declarar el arranque de la serie ya no se tragan (SCRUM-1216b, #1895). Lo que
// quedaba: un fallo SIN respuesta del servidor pintaba el mensaje en crudo — «Failed to fetch»,
// en inglés y distinto según el navegador, o la cadena interna de `api.js`. Y el «No se pudo
// guardar.» de reserva, si hubiera salido, afirmaba algo que no sabemos: una mutación sin
// respuesta PUEDE haberse guardado.
//
// Texto aprobado por el orquestador por delegación del fundador el 28-sep-2026 — SCRUM-1200
// comentario 17418. Registro: `docs/microcopy/2026-09-28-SCRUM-1200-arranque-sin-respuesta.md`.
//
// Se exige, en el alta (paso 2) y en Ajustes (puerta D1), con los errores que construye `api.js`:
//   · `sinRed` (el `fetch` rechazó)         → no avanza y enseña el texto aprobado;
//   · `incierto` (la mutación venció plazo) → no avanza y enseña el texto aprobado;
//   · CONTROL: un rechazo CON respuesta (400 con código, o con `message` del servidor) sigue
//     enseñando lo suyo — el texto nuevo no se come a los que ya estaban firmados.
// ═════════════════════════════════════════════════════════════════════════════════════════

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { cargarDashboard } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ANIO = new Date().getFullYear();
const { SERIE_TEXTOS, textoErrorSerie } = createRequire(import.meta.url)(path.join(RAIZ, 'public/dashboard/js/puertaSerie.js'));

/** Literal, aquí TAMBIÉN: si alguien cambia `SERIE_TEXTOS`, esto cae. SCRUM-1200 comentario 17418. */
const APROBADO = 'No hemos podido confirmar si se ha guardado. Comprueba tu conexión y pulsa otra vez: si ya estaba guardado, se queda igual.';

/** Los dos errores sin respuesta, con la forma EXACTA que les da `api.js`. */
function sinRed() { const e = new Error('Failed to fetch'); e.sinRed = true; e.causaOriginal = new TypeError('Failed to fetch'); return e; }
function incierto() { const e = new Error('no se pudo confirmar si la petición llegó'); e.incierto = true; e.vencido = true; return e; }
const SIN_RESPUESTA = [['sinRed', sinRed], ['incierto', incierto]];

/** Un rechazo CON respuesta, con la forma de `apiRequest` (`err.code`, `err.data`). */
function rechazo(status, cuerpo) {
  const e = new Error(cuerpo.message || `API ${status}: ${cuerpo.error}`);
  e.status = status; e.code = cuerpo.error; e.data = cuerpo;
  return e;
}

function montar({ guardar } = {}) {
  const peticiones = [];
  const banco = cargarDashboard(RAIZ, {
    datos: (url, opts) => {
      const cuerpo = opts?.body ? JSON.parse(opts.body) : null;
      peticiones.push({ url, cuerpo });
      if (url.endsWith('/admin/onboarding/serie/previa')) return { ok: true, proximoNumero: `F${String(ANIO % 100).padStart(2, '0')}0042` };
      if (url.endsWith('/admin/onboarding/serie') && guardar) return guardar(cuerpo);
      return /\/admin\/products$/.test(url) ? [] : {};
    },
  });
  banco.ctx.appModoEmision = 'fiscal';
  const id = (x) => banco.reg.porId.get(x) || null;
  const pulsar = async (n) => {
    assert.ok(n, 'no existe el botón');
    for (const f of n._oyentes.click || []) await f.call(n, { type: 'click', target: n, preventDefault() {}, stopPropagation() {} });
  };
  const guardados = () => peticiones.filter((p) => p.url.endsWith('/admin/onboarding/serie')).map((p) => p.cuerpo);
  return { banco, id, pulsar, guardados };
}

async function alPaso2(m) {
  m.banco.ctx.showOnboardingWizard(() => {});
  m.id('ob-name').value = 'Fontanería Pepe';
  await m.pulsar(m.id('ob-next'));
  const titulo = () => m.banco.ctx.document.body.querySelector('#ob-steps h2')?.textContent?.trim();
  assert.equal(titulo(), `¿Ya has emitido facturas en ${ANIO}?`, 'no se llegó al paso de la serie');
  return titulo;
}

function puerta(m, guardado) {
  const panel = m.banco.ctx.document.createElement('div');
  return m.banco.ctx.renderPuertaSerie(panel, { veredicto: true, anio: ANIO, onGuardado: guardado });
}

test('SCRUM-1200 · el texto es el APROBADO (17418), literal', () => {
  assert.equal(SERIE_TEXTOS.errorSinRespuesta, APROBADO);
});

// ① EL ALTA
for (const [nombre, error] of SIN_RESPUESTA) {
  for (const si of [true, false]) {
    test(`SCRUM-1200 · ALTA · 🔴 ${nombre} con «${si ? 'Sí + 41' : 'No'}» → NO avanza y manda a MIRAR, sin mensaje crudo`, async () => {
      const m = montar({ guardar: () => { throw error(); } });
      const titulo = await alPaso2(m);
      await m.pulsar(m.id(si ? 'ob-serie-si' : 'ob-serie-no'));
      if (si) m.id('ob-serie-numero').value = '41';
      await m.pulsar(m.id('ob-next'));
      assert.equal(titulo(), `¿Ya has emitido facturas en ${ANIO}?`, '🔴 avanzó sin saber si se guardó');
      const aviso = m.id('ob-serie-error');
      assert.equal(aviso.textContent, APROBADO, `🔴 enseña «${aviso.textContent}»`);
      assert.notEqual(aviso.style.display, 'none', 'el aviso no se ve');
      assert.notEqual(m.id('ob-next').disabled, true, 'el botón se queda bloqueado: no se puede «pulsar otra vez»');
      assert.equal(m.guardados().length, 1, 'la petición sí se intentó');
    });
  }
}

// ② AJUSTES
for (const [nombre, error] of SIN_RESPUESTA) {
  test(`SCRUM-1200 · AJUSTES · 🔴 ${nombre} → NO da por guardado y manda a MIRAR`, async () => {
    const m = montar({ guardar: () => { throw error(); } });
    let guardado = false;
    const caja = puerta(m, () => { guardado = true; });
    await m.pulsar(caja.querySelector('#ps-si'));
    caja.querySelector('#ps-numero').value = '41';
    await m.pulsar(caja.querySelector('#ps-guardar'));
    assert.equal(guardado, false, '🔴 se dio por guardado sin respuesta');
    assert.equal(caja.querySelector('#ps-error').textContent, APROBADO);
  });
}

// ③ CONTROL: lo que SÍ trae respuesta sigue diciendo lo suyo
test('SCRUM-1200 · ✅ CONTROL: un rechazo CON respuesta no se convierte en «sin respuesta»', () => {
  assert.equal(textoErrorSerie(rechazo(400, { error: 'numero_fuera_de_rango' }), 'x'), SERIE_TEXTOS.errorNumeroGrande);
  assert.equal(textoErrorSerie(rechazo(400, { error: 'numero_invalido' }), 'x'), SERIE_TEXTOS.errorNumeroNoValido);
  assert.equal(
    textoErrorSerie(rechazo(409, { error: 'choca_con_emitidas', titulo: 'Tu serie ya tiene facturas', message: 'mensaje aprobado del 409' }), 'x'),
    'Tu serie ya tiene facturas. mensaje aprobado del 409');
});
