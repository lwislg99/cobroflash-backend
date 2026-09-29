// tests/scrum1162-asistente-avanza-cada-paso.test.mjs — SCRUM-1162 · EL ASISTENTE DE ALTA AVANZA EN CADA PASO.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL DEFECTO (en producción del 6-ago al 28-sep-2026)
//
// El paso 2 del asistente —«¿Ya has facturado en <año>?», SCRUM-313— nació SIN `validate`, y
// `onNext` lo llamaba igual: `step.validate is not a function`. El botón «Siguiente» / «Es
// correcto» no hacía NADA, sin ningún mensaje. Es el primer minuto de un profesional en YaQu, y
// la única salida («← Atrás» → «Saltar por ahora») no la deduce nadie.
//
// Ningún test lo vio porque ninguno PULSABA el botón: los de SCRUM-313 leían el marcado. Éste
// monta el asistente con el banco de vistas y pulsa «Siguiente» en CADA paso, como el profesional.
//
// 🔴 El clic se dispara llamando al OYENTE y esperando su promesa, no con `click()`: `onNext` es
// `async`, y su rechazo por `click()` se pierde como promesa huérfana. Así el TypeError hace caer
// el test en vez de pasar como «el botón respondió».
//
// Control negativo: el paso 1 con el nombre vacío NO avanza. Si un arreglo hiciera avanzar todo
// sin validar, este test lo diría.
// ═════════════════════════════════════════════════════════════════════════════════════════

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function montarAsistente() {
  const peticiones = [];
  const banco = cargarDashboard(RAIZ, {
    datos: (url, opts) => {
      peticiones.push({ url, metodo: opts?.method || 'GET', cuerpo: opts?.body ? JSON.parse(opts.body) : null });
      return /\/admin\/products$/.test(url) ? [] : {};
    },
  });
  assert.equal(typeof banco.ctx.showOnboardingWizard, 'function', 'el dashboard no publica showOnboardingWizard');
  banco.ctx.showOnboardingWizard(() => {});
  const id = (x) => banco.reg.porId.get(x) || null;
  const titulo = () => banco.ctx.document.body.querySelector('#ob-steps h2')?.textContent?.trim();
  // Dispara el oyente del botón y ESPERA su promesa: un rechazo tira el test.
  const pulsar = async (x) => {
    const n = id(x);
    assert.ok(n, `no existe #${x} en el paso «${titulo()}»`);
    const fns = n._oyentes.click || [];
    assert.ok(fns.length > 0, `#${x} no tiene oyente de click en el paso «${titulo()}»`);
    for (const f of fns) await f.call(n, { type: 'click', target: n, preventDefault() {}, stopPropagation() {} });
  };
  return { banco, id, titulo, pulsar, peticiones };
}

const ANIO = new Date().getFullYear();
// SCRUM-1216b: título firmado de nuevo por el fundador (SCRUM-1216, comentario 17347).
const PASO_2 = `¿Ya has emitido facturas en ${ANIO}?`;

test('SCRUM-1162 · «Siguiente» avanza en CADA paso hasta el último (rama «No, empiezo ahora»)', async () => {
  const a = montarAsistente();
  const visto = [a.titulo()];

  a.id('ob-name').value = 'Fontanería Pepe';
  await a.pulsar('ob-next');
  assert.equal(a.titulo(), PASO_2, 'el paso 1 no llevó al paso 2');
  visto.push(a.titulo());

  await a.pulsar('ob-serie-no');
  await a.pulsar('ob-next'); // ← aquí caía: step.validate is not a function
  assert.notEqual(a.titulo(), PASO_2, '🔴 el paso 2 no avanza al pulsar «Siguiente» (SCRUM-1162)');
  visto.push(a.titulo());

  await a.pulsar('ob-next'); // paso 3 → paso 4
  visto.push(a.titulo());

  // Población: los cuatro pasos, distintos, y el último sin #ob-next (pinta su propio pie).
  assert.equal(new Set(visto).size, 4, `no se recorrieron 4 pasos distintos: ${JSON.stringify(visto)}`);
  assert.equal(a.id('ob-next'), null, 'el último paso debería pintar su propio pie');

  const serie = a.peticiones.filter((p) => p.url.endsWith('/admin/onboarding/serie'));
  assert.equal(serie.length, 1, 'el paso 2 debe guardar la numeración también en «No»');
  assert.equal(serie[0].cuerpo.vieneDeOtroSitio, false);
});

test('SCRUM-1162 · rama «Sí»: «Es correcto» avanza y guarda el último número', async () => {
  const a = montarAsistente();
  a.id('ob-name').value = 'Fontanería Pepe';
  await a.pulsar('ob-next');
  await a.pulsar('ob-serie-si');
  a.id('ob-serie-numero').value = '41';
  await a.pulsar('ob-next');
  assert.notEqual(a.titulo(), PASO_2, '🔴 «Es correcto» no avanza el paso 2 (SCRUM-1162)');
  const serie = a.peticiones.filter((p) => p.url.endsWith('/admin/onboarding/serie'));
  assert.equal(serie.length, 1);
  assert.equal(serie[0].cuerpo.vieneDeOtroSitio, true);
  assert.equal(serie[0].cuerpo.ultimoNumero, 41);
});

test('SCRUM-1162 · control negativo: el paso 1 con el nombre vacío NO avanza', async () => {
  const a = montarAsistente();
  const antes = a.titulo();
  a.id('ob-name').value = '';
  await a.pulsar('ob-next');
  assert.equal(a.titulo(), antes, 'el paso 1 avanzó sin nombre: la validación dejó de aplicarse');
});
