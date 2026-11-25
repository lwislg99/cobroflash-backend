// tests/scrum1815-latido-puesto-jv.test.mjs — SCRUM-1815 (hijo de SCRUM-1238, para S5)
//
// Sin gate, sin BD, sin red; sólo lo PURO del latido (ni `gh` ni el registro de trabajos de la máquina).
// `puestoDe` (scripts/equipo/latido.mjs) sólo reconocía `sN-…`/`sesion-N`, y el CEMENTERIO dejaba en «NO SE
// PUEDE SABER si su puesto siguió: su nombre no dice de qué puesto es» las preguntas del equipo de Javier,
// cuyo puesto SÍ está en el nombre (`jv-j<N>…`). Medido por J6 en su máquina: 85.
//
// Diseño (orquestador, 24-nov): el puesto J es un valor PROPIO, `'J<N>'` (cadena), que nunca choca con el
// número de un puesto S. Invariantes:
//   ① ningún consumidor que espera puestos S recibe un J como si fuera S (TRASPASO no busca `project_sJ1…`);
//   ③ el cementerio coloca a J con la misma regla que a S: relevada = hay una sesión posterior del mismo puesto.
//
//   ① la función, con los nombres REALES del ticket, controles S y nombres que no son un puesto;
//   ② POR EFECTO en el cementerio: las de J salen RELEVADAS (o SIN RELEVO), no NO SE PUEDE SABER, y su renglón
//      plegado dice `j1` y da la orden que las marca;
//   ③ un S y un J del mismo número no son el mismo puesto, ni al relevar ni al marcar;
//   ④ TRASPASO no mira el traspaso de un puesto J (vive en la otra máquina) y lo cuenta aparte;
//   ⑤ la orden `contestada`/`preguntas` entiende `j<N>` además de `s<N>`;
//   ⑥ CONTROL de la parte 1 del ticket: una sesión J que terminó su turno con `needs` sale en SESIONES con su
//      pregunta (ya salía: lo que J midió como «ninguna línea» es la pasada entera CIEGA en 280 s).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  puestoDe, etiquetaDePuesto, puestoDeEtiqueta, ordenDeMarcar, seccionCementerio, seccionSesiones,
  seccionTraspasos, preguntasDelLibro, marcarPuesto,
} from '../scripts/equipo/latido.mjs';

// El catálogo del meta-guard (`scripts/meta-guard-mutaciones.mjs`, SCRUM-1387).
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Vuelve el «jv-jN → null» de antes de 1815.
    fichero: 'scripts/equipo/latido.mjs',
    de: "  const j = /^jv-j([1-6])(?:[a-z]{1,3}|-[a-z0-9-]+)?$/.exec(n);",
    a: '  const j = null;',
    cae: 'SCRUM-1815 ① ·',
  },
  {
    // El J pasa a ser el número del puesto S: `jv-j1` y `sesion-1` serían el mismo puesto.
    fichero: 'scripts/equipo/latido.mjs',
    de: '  if (j) return `J${j[1]}`;',
    a: '  if (j) return Number(j[1]);',
    cae: 'SCRUM-1815 ③ ·',
  },
  {
    // TRASPASO vuelve a buscar el traspaso de un puesto J en esta máquina.
    fichero: 'scripts/equipo/latido.mjs',
    de: "    if (typeof puesto !== 'number') { otroEquipo++; continue; }",
    a: '',
    cae: 'SCRUM-1815 ④ ·',
  },
];

const H = 36e5;
const AHORA = Date.parse('2026-11-24T18:00:00Z');
const ses = (id, nombre, estado, { creado, actualizado = creado, needs } = {}) => ({ id, nombre, estado, needs, creado, actualizado });

test('SCRUM-1815 ① · `jv-j<N>…` dice su puesto J; S igual que antes; lo que no es un puesto, null', () => {
  // Nombres reales: los cuatro del ticket y los dos de J6 que lo midieron.
  const reales = { 'jv-j1iv': 'J1', 'jv-j1iw': 'J1', 'jv-j2em': 'J2', 'jv-j5bq': 'J5', 'jv-j6fm': 'J6', 'jv-j6fj': 'J6', 'jv-j4g': 'J4', 'JV-J3CF ': 'J3', 'jv-j5-prueba': 'J5' };
  for (const [n, p] of Object.entries(reales)) assert.equal(puestoDe(n), p, n);
  assert.equal(puestoDe('sesion-5'), 5);
  assert.equal(puestoDe('s3-1oct'), 3);
  assert.equal(puestoDe('s4-1octb'), 4);
  for (const n of ['jv-x', 'jv-j9z', 'jv-j7', 'jv-j0', 'jv-j12', 'jv-j4abcd', 'jv-j', 'xjv-j1', 'cobroflash-backend-57', 'orquestador', '', undefined, null]) {
    assert.equal(puestoDe(n), null, String(n));
  }
});

// El libro de juguete: tres preguntas viejas de J (dos con relevo, una sin) y una de S.
const T0 = AHORA - 30 * H;
const LIBRO = {
  a1: { nombre: 'jv-j1iv', needs: '¿sigo con 1238?', desde: T0 },
  a2: { nombre: 'jv-j2em', needs: '¿qué hago con #3362?', desde: T0 + H },
  a3: { nombre: 'jv-j5bq', needs: '¿merge?', desde: T0 + 2 * H },
  a4: { nombre: 'sesion-1', needs: '¿cierro 1600?', desde: T0 + 3 * H },
};
const SESIONES = [
  ses('b1', 'jv-j1iw', 'done', { creado: T0 + 5 * H }),
  ses('b2', 'jv-j2en', 'working', { creado: T0 + 6 * H }),
  // Ni un J1 releva a sesion-1, ni sesion-5 a jv-j5bq.
  ses('b3', 'sesion-5', 'done', { creado: T0 + 7 * H }),
];

test('SCRUM-1815 ② · POR EFECTO: el cementerio coloca las preguntas de J por su puesto', () => {
  const filas = preguntasDelLibro({ sesiones: SESIONES, libro: LIBRO, ahora: AHORA });
  const cubo = Object.fromEntries(filas.map((f) => [f.nombre, f.cubo]));
  assert.deepEqual(cubo, { 'jv-j1iv': 'RELEVADA', 'jv-j2em': 'RELEVADA', 'jv-j5bq': 'SIN RELEVO', 'sesion-1': 'SIN RELEVO' });
  const c = seccionCementerio({ sesiones: SESIONES, libro: LIBRO, libroGuardado: true, ahora: AHORA });
  assert.equal(c.pudo, true);
  const texto = c.alertas.map((a) => a.linea).join('\n');
  assert.doesNotMatch(texto, /NO SE PUEDE SABER/);
  assert.match(c.poblacion, /· 0 que NO SE PUEDE SABER ·/);
  const j1 = c.alertas.find((a) => /^j1 · /.test(a.linea));
  assert.ok(j1, `sin renglón plegado de j1:\n${texto}`);
  assert.match(j1.linea, /su puesto siguió con jv-j1iw/);
  assert.match(j1.linea, /latido\.mjs contestada j1 "/);
  assert.match(j1.linea, /latido\.mjs preguntas j1$/);
  assert.ok(c.alertas.some((a) => /^j2 · /.test(a.linea)), 'y uno de j2');
});

test('SCRUM-1815 ③ · un S y un J del mismo número son puestos distintos', () => {
  assert.notEqual(puestoDe('jv-j1iv'), puestoDe('sesion-1'));
  const m = marcarPuesto(LIBRO, 'J1', { cuando: AHORA, donde: 'SCRUM-1238 c.1' });
  assert.deepEqual(m.marcadas, ['a1']);
  const s = marcarPuesto(LIBRO, 1, { cuando: AHORA, donde: 'SCRUM-1600 c.1' });
  assert.deepEqual(s.marcadas, ['a4']);
  assert.equal(etiquetaDePuesto('J1'), 'j1');
  assert.equal(etiquetaDePuesto(1), 's1');
  assert.equal(ordenDeMarcar(3), 'node scripts/equipo/latido.mjs contestada s3 "<dónde está la respuesta>"');
});

test('SCRUM-1815 ④ · TRASPASO no busca en esta máquina el traspaso de un puesto J', () => {
  const pedidos = [];
  const r = seccionTraspasos({
    sesiones: [ses('c1', 'jv-j1iv', 'done', { creado: AHORA - 2 * H, actualizado: AHORA - H }), ses('c2', 'sesion-2', 'done', { creado: AHORA - 2 * H, actualizado: AHORA - H })],
    mtimeDelTraspaso: (p) => { pedidos.push(p); return AHORA; },
    ahora: AHORA,
  });
  assert.equal(r.pudo, true);
  assert.deepEqual(pedidos, [2], 'sólo se mira el traspaso del puesto S');
  assert.equal(r.alertas.length, 0);
  assert.match(r.poblacion, /1 del equipo de Javier \(su traspaso vive en su máquina; NO medidas\)/);
});

test('SCRUM-1815 ⑤ · las órdenes entienden `j<N>` y `s<N>`, y nada más', () => {
  assert.equal(puestoDeEtiqueta('j1'), 'J1');
  assert.equal(puestoDeEtiqueta('J6'), 'J6');
  assert.equal(puestoDeEtiqueta('s3'), 3);
  for (const x of ['j7', 'j0', 's', 'x1', 'jv-j1', '', undefined]) assert.equal(puestoDeEtiqueta(x), null, String(x));
});

test('SCRUM-1815 ⑥ · CONTROL: una sesión J que terminó su turno con `needs` sale en SESIONES con su pregunta', () => {
  const sesiones = [ses('d1', 'jv-j1iv', 'done', { creado: AHORA - 3 * H, actualizado: AHORA - H, needs: '¿sigo con 1238?' }),
    ses('d2', 'jv-j1iw', 'working', { creado: AHORA - 0.5 * H })];
  const r = seccionSesiones({ sesiones, filasPR: [], ramasDe: () => [], ahora: AHORA });
  const l = r.alertas.find((a) => a.sesion === 'jv-j1iv');
  assert.ok(l, 'sin línea para la sesión que espera');
  assert.match(l.linea, /espera: ¿sigo con 1238\?/);
  assert.match(l.linea, /su puesto ya tiene relevo \(jv-j1iw/);
  assert.match(l.linea, /contestada j1 "/);
});
