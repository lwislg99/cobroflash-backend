// SCRUM-1357e · APARCADO NO ES CAÍDO: un puesto que el orquestador paró a propósito no alarma; uno caído, sí.
//
// EL DEFECTO (16-oct-2026): el orquestador paró al equipo por gasto y el panel del fundador pintó cinco
// puestos «SIN CUBRIR» en rojo. Era verdad, y el fundador preguntó DOS VECES si pasaba algo.
//
// LAS DOS CONDICIONES DEL ENCARGO, y cada una tiene aquí su control:
//   ⓐ si no sabe cuál de los dos es, lo DICE y avisa → marca vencida, puesto relanzado después, sesión
//     sin `createdAt`, sin registro y marca ilegible: los cinco salen VACIO (o AVERIA), nunca APARCADO.
//   ⓑ en los dos sentidos → el MISMO equipo parado sale APARCADO y salida 0 con marca, y VACIO y salida 1
//     sin ella.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { temporal } from './_temporal.mjs';
import { medir, SALIDA_NADIE, SALIDA_HAY, SALIDA_CIEGO } from '../scripts/equipo/parados.mjs';
import { aLineas, SALIDA_NADA, SALIDA_HAY as SALA_HAY, SALIDA_AVERIA } from '../scripts/equipo/sala.mjs';
import { juzgarAparcado, aplicarOrden, leerHasta, leerAparcados } from '../scripts/equipo/aparcar.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SALA = path.join(RAIZ, 'scripts', 'equipo', 'sala.mjs');
const APARCAR = path.join(RAIZ, 'scripts', 'equipo', 'aparcar.mjs');
const PUESTOS = ['S0', 'S1', 'S2', 'S3', 'S4', 'S5'];
const PARADOS_POR_GASTO = ['S1', 'S2', 'S3', 'S4', 'S5'];

// Las mutaciones se corrieron a mano y están en `docs/master/SCRUM-1357.md` (1357e). No se declaran en
// `MUTACIONES_QUE_ME_TUMBAN`: cada una se paga en el CI de todos (SCRUM-935), como las de 1357b, c y d.
const AHORA = Date.parse('2026-10-17T12:00:00Z');
const hace = (min) => AHORA - min * 60_000;
const iso = (ms) => new Date(ms).toISOString();

const reg = (id, nombre, estado, extra = {}) => ({
  id, nombre, estado, tempo: estado === 'working' ? 'active' : 'idle',
  detalle: '', needs: undefined, actualizado: hace(2), creado: hace(600), ...extra,
});

/**
 * El 16-oct de verdad: S0 trabajando y las otras cinco PARADAS (lanzadas hace 10 h, paradas hace 1 h,
 * borradas del panel por `sesion.mjs parar`). El orquestador aparcó hace 2 h, ANTES de pararlas: el
 * `updatedAt` de la parada cae después de la marca y no la puede anular.
 */
const equipoParado = () => ({
  panel: [{ id: 'a0', name: 'sesion-0', kind: 'background', state: 'working', pid: 100, status: 'busy' }],
  registro: {
    sesiones: [
      reg('a0', 'sesion-0', 'working'),
      ...PARADOS_POR_GASTO.map((p) => reg(`a${p[1]}`, `sesion-${p[1]}`, 'stopped', { actualizado: hace(60) })),
    ],
    ilegibles: [], sinEstado: [],
  },
});
const marca = (extra = {}) => ({ desde: iso(hace(120)), hasta: iso(AHORA + 5 * 3600e3), motivo: 'gasto: ventana de 5 h al 75 %', ...extra });
const todasAparcadas = (extra) => ({ marcas: Object.fromEntries(PARADOS_POR_GASTO.map((p) => [p, marca(extra)])) });
const correr = (e, aparcados) => medir({ ...e, ahora: AHORA, puestos: PUESTOS, aparcados });

test('🔴 ⓑ APARCADO NO ALARMA: el equipo parado CON marca → cinco APARCADO, ningún VACIO, salida 0', () => {
  const p = correr(equipoParado(), todasAparcadas());
  assert.equal(p.codigo, SALIDA_NADIE, p.lineas.join('\n'));
  assert.deepEqual(p.datos.vacios, []);
  assert.deepEqual(p.datos.aparcados.map((a) => a.puesto), PARADOS_POR_GASTO);
  assert.match(p.lineas.join('\n'), /⏸ APARCADO\(S\) A PROPÓSITO, no es una avería: S1 hasta 2026-10-17T17:00Z/);
  assert.match(p.lineas.join('\n'), /\| S3 \| 0 ⏸ aparcado \|/);
  const s = aLineas(p.datos);
  assert.equal(s.codigo, SALIDA_NADA);
  assert.deepEqual(s.lineas, PARADOS_POR_GASTO.map((x) => `APARCADO|${x}|hasta 2026-10-17T17:00Z|«gasto: ventana de 5 h al 75 %»|aparcado a las 2026-10-17T10:00Z`));
});

test('🔴 ⓑ CAÍDO SÍ ALARMA: el MISMO equipo parado SIN marca → cinco VACIO, salida 1', () => {
  for (const sinMarca of [undefined, { marcas: {} }]) {
    const p = correr(equipoParado(), sinMarca);
    assert.equal(p.codigo, SALIDA_HAY);
    assert.deepEqual(p.datos.vacios, PARADOS_POR_GASTO);
    assert.deepEqual(p.datos.aparcados, []);
    const s = aLineas(p.datos);
    assert.equal(s.codigo, SALA_HAY);
    assert.deepEqual(s.lineas, PARADOS_POR_GASTO.map((x) => `VACIO|${x}|ninguna sesión suya con proceso|su puesto está SIN CUBRIR`));
  }
});

test('🔴 ⓐ marca VENCIDA → VACIO, y dice que estaba aparcado y venció', () => {
  const p = correr(equipoParado(), todasAparcadas({ hasta: iso(hace(1)) }));
  assert.equal(p.codigo, SALIDA_HAY);
  assert.deepEqual(p.datos.vacios, PARADOS_POR_GASTO);
  assert.equal(aLineas(p.datos).lineas[0], 'VACIO|S1|ninguna sesión suya con proceso|su puesto está SIN CUBRIR|estaba aparcado, pero la marca venció a las 2026-10-17T11:59Z');
});

test('🔴 ⓐ RELANZADO DESPUÉS y caído → VACIO: la marca no calla al puesto reabierto', () => {
  // El caso que una deducción por `stopped` callaría: S3 se relanzó a las 11:30 (después de aparcar a
  // las 10:00) y su sesión nueva murió. El puesto está SIN CUBRIR de verdad.
  const e = equipoParado();
  e.registro.sesiones.push(reg('b3', 'sesion-3', 'failed', { creado: hace(30), actualizado: hace(10) }));
  const p = correr(e, todasAparcadas());
  assert.deepEqual(p.datos.vacios, ['S3']);
  assert.deepEqual(p.datos.aparcados.map((a) => a.puesto), ['S1', 'S2', 'S4', 'S5']);
  assert.equal(p.codigo, SALIDA_HAY);
  const s = aLineas(p.datos);
  assert.equal(s.codigo, SALA_HAY);
  assert.equal(s.lineas[0], 'VACIO|S3|ninguna sesión suya con proceso|su puesto está SIN CUBRIR|estaba aparcado, pero sesion-3 se lanzó después de aparcarlo (2026-10-17T11:30Z)');
});

test('🔴 ⓐ una sesión sin `createdAt` que se movió después de la marca → no sé, y avisa', () => {
  const e = equipoParado();
  e.registro.sesiones.push(reg('c4', 'sesion-4-17oct', 'done', { creado: undefined, actualizado: hace(5) }));
  const p = correr(e, todasAparcadas());
  assert.deepEqual(p.datos.vacios, ['S4']);
  assert.match(p.datos.marcasQueNoValen.S4, /no dice cuándo nació/);
  // Control: la misma sin `createdAt` pero quieta desde ANTES de la marca no la anula.
  const quieta = equipoParado();
  quieta.registro.sesiones.push(reg('c4', 'sesion-4-17oct', 'done', { creado: undefined, actualizado: hace(500) }));
  assert.deepEqual(correr(quieta, todasAparcadas()).datos.vacios, []);
});

test('🔴 ⓐ marca ILEGIBLE → AVERIA y salida 2, y los puestos salen VACIO (nunca APARCADO)', () => {
  const p = correr(equipoParado(), { marcas: null, motivo: 'aparcados.json no es JSON' });
  assert.equal(p.codigo, SALIDA_CIEGO);
  assert.deepEqual(p.datos.vacios, PARADOS_POR_GASTO);
  const s = aLineas(p.datos);
  assert.equal(s.codigo, SALIDA_AVERIA);
  assert.match(s.lineas[0], /^AVERIA\|no pude mirar las MARCAS DE APARCADO: aparcados\.json no es JSON/);
  assert.ok(!s.lineas.some((l) => l.startsWith('APARCADO|')));
});

test('🔴 ⓐ marca sin fechas legibles, o sin registro que mirar → no vale', () => {
  const sesiones = equipoParado().registro.sesiones;
  assert.equal(juzgarAparcado({ puesto: 'S1', marca: { motivo: 'x' }, sesiones, ahora: AHORA }).vale, false);
  assert.equal(juzgarAparcado({ puesto: 'S1', marca: marca({ hasta: 'mañana' }), sesiones, ahora: AHORA }).vale, false);
  assert.match(juzgarAparcado({ puesto: 'S1', marca: marca(), sesiones: null, ahora: AHORA }).porque, /sin registro/);
  // Control positivo del juez: la buena vale.
  assert.equal(juzgarAparcado({ puesto: 'S1', marca: marca(), sesiones, ahora: AHORA }).vale, true);
});

test('una marca sobre un puesto CUBIERTO no pinta nada: el puesto trabaja', () => {
  const e = equipoParado();
  e.panel.push({ id: 'd2', name: 'sesion-2', kind: 'background', state: 'working', pid: 222, status: 'busy' });
  e.registro.sesiones.push(reg('d2', 'sesion-2', 'working', { creado: hace(500) }));
  const p = correr(e, todasAparcadas());
  assert.ok(!p.datos.aparcados.some((a) => a.puesto === 'S2'));
  assert.ok(!p.datos.vacios.includes('S2'));
});

test('aparcar: --hasta y --motivo obligatorios, huso obligatorio, duraciones, --quitar', () => {
  assert.match(aplicarOrden({ argv: ['S3', '--motivo', 'gasto'], marcas: {}, ahora: AHORA }).error, /--hasta es obligatorio/);
  assert.match(aplicarOrden({ argv: ['S3', '--hasta', '2026-10-18T09:00', '--motivo', 'g'], marcas: {}, ahora: AHORA }).error, /--hasta es obligatorio/);
  assert.match(aplicarOrden({ argv: ['S3', '--hasta', '5h'], marcas: {}, ahora: AHORA }).error, /--motivo es obligatorio/);
  assert.match(aplicarOrden({ argv: ['S3', '--hasta', '2026-10-17T11:00Z', '--motivo', 'g'], marcas: {}, ahora: AHORA }).error, /ya pasó/);
  assert.match(aplicarOrden({ argv: ['S9x', '--hasta', '5h', '--motivo', 'g'], marcas: {}, ahora: AHORA }).error, /no se dejan leer/);
  assert.equal(leerHasta('30h', AHORA), AHORA + 30 * 3600e3);
  assert.equal(leerHasta('2026-10-18T09:00+02:00', AHORA), Date.parse('2026-10-18T07:00:00Z'));
  const r = aplicarOrden({ argv: ['s1,S2', '--hasta', '2d', '--motivo', 'gasto'], marcas: { S5: marca() }, ahora: AHORA });
  assert.deepEqual(Object.keys(r.marcas).sort(), ['S1', 'S2', 'S5']);
  assert.deepEqual(r.marcas.S1, { desde: iso(AHORA), hasta: iso(AHORA + 2 * 86400e3), motivo: 'gasto' });
  assert.deepEqual(Object.keys(aplicarOrden({ argv: ['--quitar', 'S5'], marcas: r.marcas, ahora: AHORA }).marcas).sort(), ['S1', 'S2']);
  assert.deepEqual(aplicarOrden({ argv: ['--quitar', 'todos'], marcas: r.marcas, ahora: AHORA }).marcas, {});
});

test('POR EFECTO: aparcar.mjs escribe la marca y sala.mjs de verdad deja de alarmar; al quitarla, vuelve a alarmar', () => {
  const tmp = temporal('scrum1357e-');
  try {
    const jobs = path.join(tmp, 'jobs');
    const ahora = Date.now();
    const estado = (id, name, state, creado, actualizado) => {
      fs.mkdirSync(path.join(jobs, id), { recursive: true });
      fs.writeFileSync(path.join(jobs, id, 'state.json'), JSON.stringify({ name, state, tempo: 'idle', createdAt: new Date(creado).toISOString(), updatedAt: new Date(actualizado).toISOString() }));
    };
    estado('a0', 'sesion-0', 'working', ahora - 3600e3, ahora - 60e3);
    estado('a3', 'sesion-3', 'stopped', ahora - 3600e3, ahora - 120e3);
    const panel = path.join(tmp, 'panel.mjs');
    fs.writeFileSync(panel, `if (process.argv.slice(2).join(' ') !== 'agents --json') process.exit(9);\nprocess.stdout.write(${JSON.stringify(JSON.stringify([{ id: 'a0', name: 'sesion-0', kind: 'background', state: 'working', pid: 500, status: 'busy' }]))});\n`);
    const marcas = path.join(tmp, 'aparcados.json');
    const env = { ...process.env, PARADOS_CLAUDE: JSON.stringify([process.execPath, panel]) };
    const sala = (...extra) => spawnSync(process.execPath, [SALA, '--jobs', jobs, ...extra], { encoding: 'utf8', env });
    const aparcar = (...args) => spawnSync(process.execPath, [APARCAR, '--fichero', marcas, ...args], { encoding: 'utf8' });

    // Sin marca: S3 caído (y los otros cuatro vacíos) → alarma.
    const antes = sala('--aparcados', marcas);
    assert.equal(antes.status, SALA_HAY, antes.stdout + antes.stderr);
    assert.match(antes.stdout, /^VACIO\|S3\|/m);

    const a = aparcar('S1,S2,S3,S4,S5', '--hasta', '5h', '--motivo', 'gasto');
    assert.equal(a.status, 0, a.stdout + a.stderr);
    assert.deepEqual(Object.keys(leerAparcados(marcas).marcas).sort(), ['S1', 'S2', 'S3', 'S4', 'S5']);
    const aparcado = sala('--aparcados', marcas);
    assert.equal(aparcado.status, SALIDA_NADA, aparcado.stdout + aparcado.stderr);
    assert.ok(!/^VACIO\|/m.test(aparcado.stdout), aparcado.stdout);
    assert.match(aparcado.stdout, /^APARCADO\|S3\|hasta .*\|«gasto»\|/m);

    // Con otro registro (--jobs) y SIN --aparcados, la marca del equipo NO se lee: la de esta máquina
    // tampoco, aunque exista (se dobla LOCALAPPDATA con una que aparcaría a los cinco).
    fs.mkdirSync(path.join(tmp, 'local', 'yaqu-equipo'), { recursive: true });
    fs.copyFileSync(marcas, path.join(tmp, 'local', 'yaqu-equipo', 'aparcados.json'));
    const ajena = spawnSync(process.execPath, [SALA, '--jobs', jobs], { encoding: 'utf8', env: { ...env, LOCALAPPDATA: path.join(tmp, 'local') } });
    assert.equal(ajena.status, SALA_HAY, ajena.stdout);

    const q = aparcar('--quitar', 'S3');
    assert.equal(q.status, 0, q.stdout + q.stderr);
    const despues = sala('--aparcados', marcas);
    assert.equal(despues.status, SALA_HAY, despues.stdout);
    assert.match(despues.stdout, /^VACIO\|S3\|/m);
    assert.ok(!/^VACIO\|S1\|/m.test(despues.stdout));

    // Marca rota → AVERIA, y aparcar.mjs se niega a escribir encima.
    fs.writeFileSync(marcas, '{ esto no');
    const rota = sala('--aparcados', marcas);
    assert.equal(rota.status, SALIDA_AVERIA, rota.stdout);
    assert.match(rota.stdout, /^AVERIA\|no pude mirar las MARCAS DE APARCADO/m);
    assert.equal(aparcar('S3', '--hasta', '5h', '--motivo', 'g').status, 2);
    // Sigue siendo la rota: el mismo tamaño y la misma avería al leerla (no se relee el texto a mano:
    // leer y reescribir en un test es lo que vigila SCRUM-1179-B).
    assert.equal(fs.statSync(marcas).size, '{ esto no'.length);
    assert.match(leerAparcados(marcas).motivo, /no es JSON/);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
