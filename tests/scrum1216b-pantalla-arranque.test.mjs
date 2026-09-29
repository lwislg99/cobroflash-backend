// tests/scrum1216b-pantalla-arranque.test.mjs — SCRUM-1216b (pantallas) + SCRUM-1200
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL NÚMERO DECLARADO YA CUENTA, ASÍ QUE UN RECHAZO NO PUEDE PASAR CALLADO
//
// Con SCRUM-1216b el número que el profesional declara llega a su primera factura. Desde ese momento
// tragarse un 400 con `.catch(() => {})` (SCRUM-1200, medido por J3) deja de ser inocuo: el
// profesional creería haber declarado 41 y emitiría la 1. Y un botón que no avanza sin decir por qué
// es SCRUM-1162 otra vez.
//
// Lo que se exige, en el alta y en Ajustes (textos FIRMADOS, SCRUM-1216 comentarios 17347 y 17349):
//   · «Sí» sin número → no avanza, `serie.errorNumeroFalta`, campo en Peligro (DESIGN.md §Inputs);
//   · «Sí» con 0 / negativo / decimal / letras → no avanza, `serie.errorNumeroNoValido`;
//   · el servidor dice `numero_fuera_de_rango` → no avanza, `serie.errorNumeroGrande`;
//   · el servidor dice `choca_con_emitidas` (409) → no avanza, con su texto aprobado (SCRUM-291);
//   · «Sí» con 41 → manda `{ vieneDeOtroSitio: true, ultimoNumero: 41 }` y avanza;
//   · «No» → manda `{ vieneDeOtroSitio: false }` y avanza.
// Se MONTA con el banco de vistas y se pulsa.
// ═════════════════════════════════════════════════════════════════════════════════════════
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { cargarDashboard } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ANIO = new Date().getFullYear();
const { SERIE_TEXTOS } = createRequire(import.meta.url)(path.join(RAIZ, 'public/dashboard/js/puertaSerie.js'));

// Los firmados, escritos aquí TAMBIÉN literales: si alguien cambia `SERIE_TEXTOS`, esto cae.
const FIRMADOS = {
  errorNumeroFalta: 'Escribe el número de tu última factura. Por ejemplo: 41.',
  errorNumeroNoValido: 'Tiene que ser un número entero, del 1 en adelante. Por ejemplo: 41.',
  errorNumeroGrande: 'Ese número es demasiado alto. Revisa el número de tu última factura.',
};
const TIT_409 = 'Tu serie ya tiene facturas';
const MSG_409 = 'mensaje aprobado del 409';

/** Un rechazo con la forma de `apiRequest` (`err.code`, `err.data`). */
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

test('SCRUM-1216b · los textos de error son los FIRMADOS (17349), literales', () => {
  for (const [ranura, texto] of Object.entries(FIRMADOS)) assert.equal(SERIE_TEXTOS[ranura], texto, `ranura ${ranura}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① EL ALTA
// ═════════════════════════════════════════════════════════════════════════════════════════

async function alPaso2(m) {
  m.banco.ctx.showOnboardingWizard(() => {});
  m.id('ob-name').value = 'Fontanería Pepe';
  await m.pulsar(m.id('ob-next'));
  const titulo = () => m.banco.ctx.document.body.querySelector('#ob-steps h2')?.textContent?.trim();
  assert.equal(titulo(), `¿Ya has emitido facturas en ${ANIO}?`, 'no se llegó al paso de la serie');
  return titulo;
}

const CASOS_LOCALES = [
  { caso: 'vacío', valor: '', badInput: false, espera: FIRMADOS.errorNumeroFalta },
  { caso: 'letras (value vacío + badInput)', valor: '', badInput: true, espera: FIRMADOS.errorNumeroNoValido },
  { caso: 'cero', valor: '0', espera: FIRMADOS.errorNumeroNoValido },
  { caso: 'negativo', valor: '-3', espera: FIRMADOS.errorNumeroNoValido },
  { caso: 'decimal', valor: '4.5', espera: FIRMADOS.errorNumeroNoValido },
];

for (const c of CASOS_LOCALES) {
  test(`SCRUM-1216b · ALTA · 🔴 «Sí» + ${c.caso} → NO avanza, lo DICE, y no manda nada`, async () => {
    const m = montar();
    const titulo = await alPaso2(m);
    await m.pulsar(m.id('ob-serie-si'));
    const campo = m.id('ob-serie-numero');
    campo.value = c.valor;
    campo.validity = { badInput: !!c.badInput };
    await m.pulsar(m.id('ob-next'));
    assert.equal(titulo(), `¿Ya has emitido facturas en ${ANIO}?`, '🔴 avanzó con un número que no vale');
    const aviso = m.id('ob-serie-error');
    assert.equal(aviso.textContent, c.espera, '🔴 el aviso no es el firmado para este caso');
    assert.notEqual(aviso.style.display, 'none', '🔴 botón MUDO: no avanza y no dice por qué (SCRUM-1162)');
    assert.equal(campo.style.borderColor, '#dc2626', 'el campo no se marca en Peligro (DESIGN.md §Inputs)');
    assert.deepEqual(m.guardados(), [], 'un número que no vale no se manda');
  });
}

test('SCRUM-1216b · ALTA · 🔴 el servidor dice `numero_fuera_de_rango` → NO avanza y enseña errorNumeroGrande', async () => {
  const m = montar({ guardar: () => { throw rechazo(400, { error: 'numero_fuera_de_rango' }); } });
  const titulo = await alPaso2(m);
  await m.pulsar(m.id('ob-serie-si'));
  m.id('ob-serie-numero').value = '999999999';
  await m.pulsar(m.id('ob-next'));
  assert.equal(titulo(), `¿Ya has emitido facturas en ${ANIO}?`, '🔴 SCRUM-1200: se tragó el 400 y avanzó');
  assert.equal(m.id('ob-serie-error').textContent, FIRMADOS.errorNumeroGrande);
  assert.notEqual(m.id('ob-next').disabled, true, 'el botón se queda bloqueado en «Guardando…»');
});

test('SCRUM-1216b · ALTA · 🔴 el servidor dice `choca_con_emitidas` (409) → NO avanza y enseña el texto aprobado', async () => {
  const m = montar({ guardar: () => { throw rechazo(409, { error: 'choca_con_emitidas', titulo: TIT_409, message: MSG_409 }); } });
  const titulo = await alPaso2(m);
  await m.pulsar(m.id('ob-serie-si'));
  m.id('ob-serie-numero').value = '41';
  await m.pulsar(m.id('ob-next'));
  assert.equal(titulo(), `¿Ya has emitido facturas en ${ANIO}?`, '🔴 SCRUM-1200: se tragó el 409 y avanzó');
  assert.equal(m.id('ob-serie-error').textContent, `${TIT_409}. ${MSG_409}`);
});

test('SCRUM-1216b · ALTA · «Sí» + 41 → manda {true, 41} y avanza', async () => {
  const m = montar();
  const titulo = await alPaso2(m);
  await m.pulsar(m.id('ob-serie-si'));
  m.id('ob-serie-numero').value = '41';
  await m.pulsar(m.id('ob-next'));
  assert.notEqual(titulo(), `¿Ya has emitido facturas en ${ANIO}?`, 'no avanzó con un número válido');
  assert.deepEqual(m.guardados(), [{ vieneDeOtroSitio: true, ultimoNumero: 41 }]);
});

test('SCRUM-1216b · ALTA · «No, empiezo ahora» → manda {false} y avanza', async () => {
  const m = montar();
  const titulo = await alPaso2(m);
  await m.pulsar(m.id('ob-serie-no'));
  await m.pulsar(m.id('ob-next'));
  assert.notEqual(titulo(), `¿Ya has emitido facturas en ${ANIO}?`);
  assert.deepEqual(m.guardados(), [{ vieneDeOtroSitio: false }]);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② AJUSTES — la puerta D1, mismas reglas
// ═════════════════════════════════════════════════════════════════════════════════════════

function puerta(m, guardado) {
  const panel = m.banco.ctx.document.createElement('div');
  return m.banco.ctx.renderPuertaSerie(panel, { veredicto: true, anio: ANIO, onGuardado: guardado });
}

test('SCRUM-1216b · AJUSTES · 🔴 «Sí» + 0 → NO guarda y enseña errorNumeroNoValido', async () => {
  const m = montar();
  let guardado = false;
  const caja = puerta(m, () => { guardado = true; });
  await m.pulsar(caja.querySelector('#ps-si'));
  caja.querySelector('#ps-numero').value = '0';
  caja.querySelector('#ps-numero').validity = { badInput: false };
  await m.pulsar(caja.querySelector('#ps-guardar'));
  assert.equal(guardado, false);
  assert.equal(caja.querySelector('#ps-error').textContent, FIRMADOS.errorNumeroNoValido);
  assert.deepEqual(m.guardados(), []);
});

test('SCRUM-1216b · AJUSTES · 🔴 el servidor dice `numero_fuera_de_rango` → enseña errorNumeroGrande', async () => {
  const m = montar({ guardar: () => { throw rechazo(400, { error: 'numero_fuera_de_rango' }); } });
  const caja = puerta(m, () => {});
  await m.pulsar(caja.querySelector('#ps-si'));
  caja.querySelector('#ps-numero').value = '999999999';
  await m.pulsar(caja.querySelector('#ps-guardar'));
  assert.equal(caja.querySelector('#ps-error').textContent, FIRMADOS.errorNumeroGrande);
});

test('SCRUM-1216b · AJUSTES · «Sí» + 41 → manda {true, 41}; «No» → {false}', async () => {
  const m = montar();
  const caja = puerta(m, () => {});
  await m.pulsar(caja.querySelector('#ps-si'));
  caja.querySelector('#ps-numero').value = '41';
  await m.pulsar(caja.querySelector('#ps-guardar'));
  const m2 = montar();
  const caja2 = puerta(m2, () => {});
  await m2.pulsar(caja2.querySelector('#ps-no'));
  await m2.pulsar(caja2.querySelector('#ps-guardar'));
  assert.deepEqual(m.guardados(), [{ vieneDeOtroSitio: true, ultimoNumero: 41 }]);
  assert.deepEqual(m2.guardados(), [{ vieneDeOtroSitio: false }]);
});

test('SCRUM-1216b · ninguna de las dos pantallas pide ya la SERIE (el prefijo no entra en la ordinaria)', async () => {
  const m = montar();
  await alPaso2(m);
  await m.pulsar(m.id('ob-serie-si'));
  assert.equal(m.id('ob-serie-prefijo'), null, 'el alta sigue pidiendo el prefijo');
  const caja = puerta(montar(), () => {});
  assert.equal(caja.querySelector('#ps-prefijo'), null, 'Ajustes sigue pidiendo el prefijo');
});
