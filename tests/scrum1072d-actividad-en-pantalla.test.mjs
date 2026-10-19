// tests/scrum1072d-actividad-en-pantalla.test.mjs — SCRUM-1072d
//
// LA PREGUNTA DE LA ACTIVIDAD, PINTADA. El servidor ya la guardaba (SCRUM-1072, `activityKind`) y los cuatro
// textos estaban firmados (`docs/microcopy/2026-10-16-SCRUM-1072-tipo-de-actividad.md`); faltaba la
// pantalla. Es un bloque de S2 en el contenedor de J3 (`settingsView.js`), junto a «Retención de IRPF».
// «No consta» (`null`) es la opción VACÍA y sin texto: un rótulo para ella no está firmado.
//
// Lo que se mide, con Configuración montada en el banco (mismo método que SCRUM-1102f ③ y ④):
//   ① pinta cada estado guardado y, al guardar sin tocar nada, lo devuelve igual (null no se vuelve otra cosa);
//   ② lo que se elige es lo que viaja, y elegirlo no mueve la retención;
//   ③ los textos son los firmados, la caja es rótulo + selector, y va JUSTO después de la retención.
// ⛔ Sin red ni base. Que el servidor lo guarde y lo devuelva lo miden scrum1072, scrum1227 y scrum1269.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import mapa from '../public/dashboard/js/settingsSubmenus.js';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { aprobacionesDeMicrocopy } from './_microcopy-aprobada.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const ESTADOS = [
  { guardado: null, opcion: '' },
  { guardado: 'profesional', opcion: 'profesional' },
  { guardado: 'empresarial', opcion: 'empresarial' },
  { guardado: 'no_lo_se', opcion: 'no_lo_se' },
];
const PERFIL = { name: 'Fontanería QA', legalName: 'Fontanería QA SL', taxId: 'B00000000', address: 'C/ Mayor 1', whatsappPhone: '34000000027' };
const respiro = async () => { for (let i = 0; i < 10; i++) await new Promise((res) => setImmediate(res)); };

async function montarConfiguracion(guardado) {
  const puts = [];
  const banco = cargarDashboard(RAIZ, {
    datos: (url, opts) => {
      if (!/\/admin\/merchant$/.test(url)) return [];
      if (opts && opts.method === 'PUT') { puts.push(JSON.parse(opts.body)); return {}; }
      return { ...PERFIL, ...guardado };
    },
  });
  const r = await pintarVista(banco, 'renderSettingsView');
  assert.equal(r.error, null, `🔴 CIEGO: Configuración no se monta: ${r.error && r.error.message}`);
  assert.equal(r.noMedida, null, `🔴 CIEGO: ${r.noMedida}`);
  const nodos = todos(r.contenedor);
  const selector = (clave) => {
    const s = nodos.filter((n) => n.tagName === 'SELECT' && n.name === clave);
    assert.equal(s.length, 1, `🔴 la pantalla no tiene UN selector name="${clave}" (tiene ${s.length}): la pregunta no está pintada`);
    return s[0];
  };
  const guardar = async () => {
    const form = nodos.find((n) => n._oyentes && (n._oyentes.submit || []).length);
    assert.ok(form, '🔴 CIEGO: no encuentro el formulario de Configuración');
    await form._oyentes.submit[0]({ preventDefault() {} });
    await respiro();
    assert.equal(puts.length, 1, '🔴 CIEGO: pulsar guardar no ha mandado un PUT');
    return puts.pop();
  };
  return { nodos, selector, guardar };
}

test('🔴 SCRUM-1072d · ① cada estado guardado se pinta, y guardar sin tocar nada lo devuelve igual', async () => {
  for (const e of ESTADOS) {
    const p = await montarConfiguracion({ activityKind: e.guardado });
    assert.equal(p.selector('activityKind').value, e.opcion, `🔴 guardado ${e.guardado} se pinta «${p.selector('activityKind').value}»`);
    const enviado = await p.guardar();
    assert.ok('activityKind' in enviado, '🔴 la pantalla no manda activityKind al guardar');
    assert.equal(enviado.activityKind, e.guardado, `🔴 estaba ${e.guardado} y guardar sin tocarlo manda ${enviado.activityKind}`);
  }
});

test('SCRUM-1072d · ① un valor fuera de la lista cerrada se pinta «no consta» y no se inventa otro', async () => {
  const p = await montarConfiguracion({ activityKind: 'autonomo' });
  assert.equal(p.selector('activityKind').value, '');
  assert.equal((await p.guardar()).activityKind, null);
});

test('SCRUM-1072d · ② lo que se elige es lo que viaja, y elegirlo NO mueve la retención', async () => {
  const p = await montarConfiguracion({ activityKind: null, retencionIrpfDeclarada: true, retencionIrpfTipo: 15 });
  p.selector('activityKind').value = 'profesional';
  const enviado = await p.guardar();
  assert.equal(enviado.activityKind, 'profesional');
  assert.deepEqual([enviado.retencionIrpfDeclarada, enviado.retencionIrpfTipo], [true, 15],
    '🔴 elegir la actividad ha cambiado la retención: la respuesta no decide ningún importe (SCRUM-1072, aceptación 4)');
});

test('SCRUM-1072d · ③ los textos son los firmados, la caja es rótulo + selector, y va justo después de la retención', async () => {
  const p = await montarConfiguracion({});
  const ficha = aprobacionesDeMicrocopy().find((a) => a.ticket === 'SCRUM-1072' && a.ranura === 'tipo-de-actividad');
  assert.ok(ficha && ficha.aprobada, '🔴 no hay ficha firmada de la pregunta en docs/microcopy/');
  const sel = p.selector('activityKind');
  const caja = p.nodos.find((n) => n.hijos.includes(sel));
  assert.deepEqual(caja.hijos.map((h) => h.tagName), ['LABEL', 'SELECT'], '🔴 la caja lleva algo más que la pregunta y su selector');
  assert.deepEqual(caja.hijos.filter((h) => h.tagName === 'LABEL').map((h) => h.textContent), ['¿Qué tipo de actividad tienes?']);
  const opciones = sel.hijos.filter((h) => h.tagName === 'OPTION');
  assert.deepEqual(opciones.map((o) => o.value), ESTADOS.map((e) => e.opcion), '🔴 no ofrece los cuatro estados, en su orden');
  assert.deepEqual(opciones.map((o) => o.textContent), ['', 'Profesional', 'Empresarial', 'No lo sé'],
    '🔴 las opciones no son las firmadas (y «no consta» va vacía: su rótulo no está firmado)');
  for (const t of ['¿Qué tipo de actividad tienes?', 'Profesional', 'Empresarial', 'No lo sé']) {
    assert.ok(ficha.literales.includes(t), `🔴 «${t}» no consta en su ficha`);
  }
  const ret = p.selector('retencionIrpfTipo');
  const cajaRet = p.nodos.find((n) => n.hijos.includes(ret));
  const hermanos = cajaRet.parentNode ? (cajaRet.parentNode.hijos || []) : [];
  assert.equal(hermanos[hermanos.indexOf(cajaRet) + 1], caja, '🔴 la pregunta ya no va justo después de «Retención de IRPF»');
  assert.equal(mapa.submenuDeCampo('activityKind'), mapa.submenuDeCampo('retencionIrpfTipo'), '🔴 la pregunta no vive en la pestaña de la retención');
});
