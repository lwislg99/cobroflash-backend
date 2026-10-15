// tests/scrum1557-contexto-aparta-los-restos.test.mjs — SCRUM-1557 (cara 3b de SCRUM-1095)
//
// `sesion.mjs contexto <nombre>` filtraba sólo por nombre: con una sesión VIVA y un resto MUERTO con
// el mismo nombre contestaba «2 sesiones vivas» y no daba la cifra de la viva. Era el único
// subcomando que no pasaba por `repartirPorNombre`. Lo que se fija aquí:
//   1. una con pid + una muerta (sin pid, state.json terminal) → se elige la del pid;
//   2. dos con pid → NO-PUDE-MIRAR (no se elige a ciegas);
//   3. sin pid y state.json ilegible o no terminal → cuenta como viva, igual que en `repartirPorNombre`;
//   4. el criterio es el MISMO objeto que usa `repartirPorNombre`, no una copia;
//   5. el «motivo desconocido» de una bloqueada (SCRUM-1095), que ningún test ataba.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as s from '../scripts/equipo/sesion.mjs';

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/equipo/sesion.mjs',
    de: '  const { cuentan, restos } = repartirPorNombre({ nombre, agentes, job });\n  if (cuentan.length === 0) return { veredicto: \'NO-VIVA\'',
    a: '  const cuentan = agentes.filter((a) => a && a.name === nombre).map((agente) => ({ agente })); const restos = [];\n  if (cuentan.length === 0) return { veredicto: \'NO-VIVA\'',
    cae: 'SCRUM-1557 · 🔴 una viva y un resto MUERTO con el mismo nombre: se mide la viva',
  },
  {
    fichero: 'scripts/equipo/sesion.mjs',
    de: "return v.waitingFor ? `espera ${v.waitingFor}` : 'está bloqueada, motivo desconocido — `agents --json` no informa de por qué';",
    a: "return `espera ${v.waitingFor || 'algo interactivo'}`;",
    cae: 'SCRUM-1095 · 🔴 una bloqueada sin `waitingFor` dice que el motivo NO se sabe',
  },
];

const VIVA = { id: 'aaaa1111', name: 'sesion-2', kind: 'background', pid: 4242, sessionId: 'viva-uuid' };
const MUERTA = { id: 'bbbb2222', name: 'sesion-2', kind: 'background', sessionId: 'muerta-uuid' };
const OTRA_VIVA = { id: 'cccc3333', name: 'sesion-2', kind: 'background', pid: 4343, sessionId: 'otra-uuid' };

/** El `state.json` de cada id, como lo devuelve `estadoDeJob`. */
const jobs = (mapa) => (id) => mapa[id] ?? { leido: false, motivo: 'sin fichero en el banco' };
const TERMINO = { leido: true, terminal: true, cuando: '2026-10-14T17:00:00Z' };

test('SCRUM-1557 · 🔴 una viva y un resto MUERTO con el mismo nombre: se mide la viva', () => {
  const e = s.elegirParaContexto({ nombre: 'sesion-2', agentes: [MUERTA, VIVA], job: jobs({ bbbb2222: TERMINO }) });
  assert.equal(e.veredicto, 'ELEGIDA', `🔴 ${JSON.stringify(e)}`);
  assert.equal(e.agente.id, 'aaaa1111');
});

test('SCRUM-1557 · CONTROL: sólo la viva → la misma elección', () => {
  const e = s.elegirParaContexto({ nombre: 'sesion-2', agentes: [VIVA], job: jobs({}) });
  assert.equal(e.veredicto, 'ELEGIDA');
  assert.equal(e.agente.id, 'aaaa1111');
});

test('SCRUM-1557 · 🔴 dos con pid bajo el mismo nombre: NO-PUDE-MIRAR, no elige una a ciegas', () => {
  const e = s.elegirParaContexto({ nombre: 'sesion-2', agentes: [VIVA, OTRA_VIVA], job: jobs({}) });
  assert.equal(e.veredicto, 'NO-PUDE-MIRAR');
  assert.deepEqual(e.cuentan.map((c) => c.id).sort(), ['aaaa1111', 'cccc3333']);
});

test('SCRUM-1557 · 🔴 sin pid y con el state.json ILEGIBLE cuenta como viva (falla cerrado)', () => {
  const e = s.elegirParaContexto({ nombre: 'sesion-2', agentes: [MUERTA, VIVA], job: jobs({}) });
  assert.equal(e.veredicto, 'NO-PUDE-MIRAR', `🔴 un resto que no se puede jurar muerto se ha descartado: ${JSON.stringify(e)}`);
});

test('SCRUM-1557 · 🔴 sin pid y con un state.json que NO dice que terminó cuenta como viva', () => {
  const e = s.elegirParaContexto({ nombre: 'sesion-2', agentes: [MUERTA, VIVA], job: jobs({ bbbb2222: { leido: true, terminal: false } }) });
  assert.equal(e.veredicto, 'NO-PUDE-MIRAR');
});

test('SCRUM-1557 · sólo restos muertos → NO-VIVA, y los nombra', () => {
  const e = s.elegirParaContexto({ nombre: 'sesion-2', agentes: [MUERTA], job: jobs({ bbbb2222: TERMINO }) });
  assert.equal(e.veredicto, 'NO-VIVA');
  assert.deepEqual(e.restos.map((r) => r.id), ['bbbb2222']);
});

test('SCRUM-1557 · sin lista de agentes → NO-PUDE-MIRAR, nunca «no hay ninguna»', () => {
  assert.equal(s.elegirParaContexto({ nombre: 'sesion-2', agentes: null, job: jobs({}) }).veredicto, 'NO-PUDE-MIRAR');
});

test('SCRUM-1557 · 🔴 el criterio es el de `repartirPorNombre`, no una copia: los mismos casos dan lo mismo', () => {
  const casos = [
    [[MUERTA, VIVA], jobs({ bbbb2222: TERMINO })],
    [[MUERTA, VIVA], jobs({})],
    [[VIVA, OTRA_VIVA], jobs({})],
    [[MUERTA], jobs({ bbbb2222: TERMINO })],
  ];
  for (const [agentes, job] of casos) {
    const { cuentan } = s.repartirPorNombre({ nombre: 'sesion-2', agentes, job });
    const e = s.elegirParaContexto({ nombre: 'sesion-2', agentes, job });
    const esperado = cuentan.length === 1 ? 'ELEGIDA' : cuentan.length === 0 ? 'NO-VIVA' : 'NO-PUDE-MIRAR';
    assert.equal(e.veredicto, esperado, `🔴 ${agentes.map((a) => a.id).join('+')}: contexto ${e.veredicto}, repartir ${cuentan.length}`);
  }
});

test('SCRUM-1095 · 🔴 una bloqueada sin `waitingFor` dice que el motivo NO se sabe (no «algo interactivo»)', () => {
  const bloqueada = { ...VIVA, name: 'sesion-5', state: 'blocked' };
  const d = s.decidirLanzar({ nombre: 'sesion-5', agentes: [bloqueada], registro: {}, ahora: Date.now(), job: jobs({}) });
  assert.equal(d.veredicto, 'BLOQUEADA', JSON.stringify(d));
  assert.match(d.motivo, /motivo desconocido/);
  assert.doesNotMatch(d.motivo, /algo interactivo/, '🔴 ha vuelto el relleno con forma de dato de SCRUM-1095');
});

test('SCRUM-1095 · CONTROL: con `waitingFor` de verdad, se usa', () => {
  const bloqueada = { ...VIVA, name: 'sesion-5', state: 'blocked', waitingFor: 'un permiso' };
  const d = s.decidirLanzar({ nombre: 'sesion-5', agentes: [bloqueada], registro: {}, ahora: Date.now(), job: jobs({}) });
  assert.match(d.motivo, /espera un permiso/);
});
