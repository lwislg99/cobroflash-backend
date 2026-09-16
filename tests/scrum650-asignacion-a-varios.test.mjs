// tests/scrum650-asignacion-a-varios.test.mjs — SCRUM-650 (T1), fase B
//
// UN TRABAJO SE ASIGNA A VARIOS EMPLEADOS.
//
// El caso real: en el parte EN PAPEL de la empresa de Madrid, el campo «Técnico» dice literalmente
// «Israel, Miguel y Jesús.L». VARIOS no es el caso raro, es el normal.
//
// 🔴 ESTE FICHERO VIGILA LA DOBLE ESCRITURA DEL PASO A. Mientras el filtro lea `assignedUserId`, el
// mismo hecho vive en dos sitios, y dos sitios con el mismo hecho se separan. Sin este guard, la
// doble escritura sería una prohibición sin mecanismo — o sea, una costumbre.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(import.meta.url);
const {
  principalDe, normalizarAsignados, censoDeIncoherencias, escribirAsignados,
} = require_(path.join(RAIZ, 'dist/modules/jobs/domain/asignacionDeTrabajo.js'));

/**
 * `discrepanciaDeAsignacion` NO se exporta (lo pidio el censo de SCRUM-411): su consumidor vive
 * dentro del modulo. Se mide por la SUPERFICIE PUBLICA —el censo—, que devuelve la lista de
 * discrepancias. `discrepancia(x)` es «que dice el censo de ESTE trabajo», o `null` si nada.
 */
const discrepanciaDeAsignacion = (a) => censoDeIncoherencias([a])[0] ?? null;

const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');
const sinComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

// ── SUELO ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-650 · SUELO: el dominio existe y se puede ejercitar', () => {
  const piezas = { principalDe, normalizarAsignados, censoDeIncoherencias, escribirAsignados };
  for (const [n, f] of Object.entries(piezas)) {
    assert.equal(typeof f, 'function', `🔴 «${n}» no está exportada: lo de abajo no mediría nada.`);
  }
  // Control positivo del instrumento: un caso COHERENTE tiene que devolver null. Si la función
  // dijera «discrepa» siempre, el rojo de abajo saldría por el motivo equivocado.
  assert.equal(discrepanciaDeAsignacion({ jobId: 1, assignedUserId: 7, asignados: [7] }), null,
    '🔴 un caso coherente se reporta como discrepancia: la función dice que no a todo.');
});

test('SCRUM-650 · 🔴 SUELO DE CEGUERA: un censo VACÍO no dice «todo bien», LANZA', () => {
  assert.throws(() => censoDeIncoherencias([]), /censo de asignaciones VAC/,
    '🔴 con cero trabajos leídos el censo devuelve «cero incoherencias», que se lee igual que ' +
    '«todo correcto». Es el mismo cero que, en el listado del técnico, se lee como «no tienes ' +
    'trabajos» — y el técnico se queda en casa.');
  // Y con población SÍ contesta, o el throw de arriba sería el único comportamiento.
  assert.deepEqual(censoDeIncoherencias([{ jobId: 1, assignedUserId: 7, asignados: [7] }]), []);
});

// ── 🔴 EL GUARD DE LA DOBLE ESCRITURA ───────────────────────────────────────────────────────

test('SCRUM-650 · 🔴 si los DOS SITIOS discrepan, el guard cae NOMBRANDO el trabajo', () => {
  const d = discrepanciaDeAsignacion({ jobId: 42, assignedUserId: 7, asignados: [9, 11] });
  assert.ok(d, '🔴 la columna dice 7 y la tabla dice 9, y el guard no lo ve. La doble escritura se ' +
    'puede separar sin que nada salte, que es justo lo que este guard existe para impedir.');
  assert.match(d, /trabajo 42/, '🔴 el rojo no NOMBRA el trabajo: obliga a buscarlo a mano.');
  assert.match(d, /assignedUserId/);
  assert.match(d, /job_assignees/);

  // Las tres formas de separarse, una a una, para que el rojo diga CUÁL.
  assert.ok(discrepanciaDeAsignacion({ jobId: 1, assignedUserId: null, asignados: [3] }),
    '🔴 la tabla tiene a alguien y la columna está vacía: el filtro de hoy NO lo vería.');
  assert.ok(discrepanciaDeAsignacion({ jobId: 2, assignedUserId: 5, asignados: [] }),
    '🔴 la columna tiene a alguien y la tabla está vacía.');
  assert.ok(discrepanciaDeAsignacion({ jobId: 3, assignedUserId: 9, asignados: [8, 9] }),
    '🔴 la columna no guarda el PRINCIPAL de la tabla.');
});

test('SCRUM-650 · con VARIOS, la columna guarda el principal y eso NO es discrepancia', () => {
  // Israel, Miguel y Jesús.L: tres asignados, una sola columna. Coherente por definición.
  assert.equal(discrepanciaDeAsignacion({ jobId: 7, assignedUserId: 3, asignados: [3, 5, 8] }), null,
    '🔴 tener tres asignados se reporta como incoherencia. La columna solo cabe uno: lo que se ' +
    'exige es que sea el PRIMERO, no que sean iguales.');
  assert.equal(principalDe([3, 5, 8]), 3);
  assert.equal(principalDe([]), null);
});

// ── LA NORMALIZACIÓN ────────────────────────────────────────────────────────────────────────

test('SCRUM-650 · asignar dos veces al mismo NO es asignar a dos', () => {
  assert.deepEqual(normalizarAsignados([5, 5, 3, 5]), [5, 3]);
  assert.deepEqual(normalizarAsignados(7), [7], '🔴 la forma vieja (uno suelto) tiene que seguir valiendo.');
  assert.deepEqual(normalizarAsignados(null), [], '🔴 «null» es «sin nadie», no un error.');
  // Lo que no es un id no entra. El conjunto lo valida después la ruta contra el merchant.
  assert.deepEqual(normalizarAsignados(['3', 0, -1, 'x', null, 4.5]), [3]);
});

// ── QUE LA RUTA ESCRIBA LOS DOS SITIOS, Y EN LA MISMA TRANSACCIÓN ───────────────────────────

test('SCRUM-650 · 🔴 la ruta escribe los DOS sitios, y de forma atómica', () => {
  const ruta = sinComentarios(leer('src/modules/jobs/app/routes/jobs.routes.ts'));

  assert.match(ruta, /escribirAsignados/,
    '🔴 la ruta ya no escribe la tabla puente: la asignación a varios se pierde.');
  assert.match(ruta, /prisma\.\$transaction/,
    '🔴 las dos escrituras ya no van en una transacción. Si una se queda fuera, los dos sitios se ' +
    'separan solos, y el guard estaría vigilando un invariante que el propio código rompe.');
  assert.match(ruta, /principalDe\(asignadosPedidos\)/,
    '🔴 la columna ya no guarda el principal de la lista: ahí empieza la discrepancia.');

  // Y la validación de merchant es por CADA id, no solo el primero (regla 2).
  assert.match(ruta, /for \(const uid of asignadosPedidos\)/,
    '🔴 solo se valida un id contra el merchant. Con varios asignados eso deja colar el resto: un ' +
    'empleado de OTRO merchant entraría en la lista.');
});

test('SCRUM-650 · 🔴 NADIE escribe `assignedUserId` fuera de ese camino', () => {
  // Si otro sitio escribiera la columna sin tocar la tabla, los dos se separarían sin que el guard
  // de arriba pudiera enterarse: en `npm test` no hay nadie leyendo la base.
  const DUENO = 'src/modules/jobs/app/routes/jobs.routes.ts';
  const pendientes = [path.join(RAIZ, 'src')];
  const culpables = [];
  let ficherosVistos = 0;
  while (pendientes.length) {
    const d = pendientes.pop();
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) { pendientes.push(f); continue; }
      if (!f.endsWith('.ts')) continue;
      ficherosVistos++;
      const rel = path.relative(RAIZ, f).replace(/\\/g, '/');
      // Se busca la ESCRITURA de la columna, no la lectura.
      if (/data\.assignedUserId\s*=/.test(sinComentarios(fs.readFileSync(f, 'utf8'))) && rel !== DUENO) {
        culpables.push(rel);
      }
    }
  }
  assert.ok(ficherosVistos > 100,
    `🔴 solo se han mirado ${ficherosVistos} ficheros: el barrido no está viendo el árbol.`);
  assert.deepEqual(culpables, [],
    '🔴 hay otro sitio escribiendo `assignedUserId`:\n    ' + culpables.join('\n    ') +
    '\n  Mientras la columna y la tabla convivan, la columna se escribe SOLO donde también se ' +
    'escribe la tabla. Si no, se separan y nadie se entera hasta que un técnico no ve su trabajo.');
});
