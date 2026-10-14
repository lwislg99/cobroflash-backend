// tests/scrum429b-el-build-nombra-el-cliente-viejo.test.mjs — SCRUM-429b
//
// El 14-oct-2026 el cliente de Prisma COMPARTIDO (el `node_modules` del árbol principal, del que
// cuelgan por enlace o hacia arriba casi todos los worktrees) iba por detrás de `main`: le faltaban
// `Quote.seriesYear`, `Quote.archivedAt` y `WhatsAppMessage.toPhone`. Quien hacía `npm run build`
// veía ~23 errores de tipos y se ponía a buscar un fallo que no existía, porque el guard que lo sabe
// sólo corría en `pretest`, y además cantaba sólo la PRIMERA diferencia.
//
// Lo que se fija aquí:
//   ① el guard nombra TODAS las diferencias, en los dos sentidos, y calla cuando cuadran;
//   ② contra el schema REAL con dos columnas inventadas, las nombra a las dos (no depende de que el
//      cliente local esté viejo o al día: las inventadas faltan en CUALQUIER cliente);
//   ③ `--avisar` sale con 0 y `sin --avisar` con 1, ante el mismo cliente que no se puede comparar;
//   ④ `prebuild` lleva el guard en modo aviso, y `pretest` lo sigue llevando en modo que bloquea.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import {
  modelosDelSchema,
  todasLasDiscrepancias,
  comprobarCliente,
  aviso,
} from '../scripts/_prisma-client-guard.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const GUARD = path.join(RAIZ, 'scripts', '_prisma-client-guard.mjs');
const SCHEMA = fs.readFileSync(path.join(RAIZ, 'prisma', 'schema.prisma'), 'utf8');

/** El hijo no hereda el contexto del runner de tests (SCRUM-1349). */
const entorno = { ...process.env };
for (const k of ['FORCE_COLOR', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT']) delete entorno[k];

/** Copia profunda de lo que devuelve `modelosDelSchema`: el «cliente al día» de un schema. */
function copia(modelos) {
  return new Map([...modelos].map(([m, { tabla, campos }]) => [m, { tabla, campos: new Map(campos) }]));
}

test('SCRUM-429b · ① CONTROL: un cliente que cuadra con el schema no da NINGUNA diferencia', () => {
  const delSchema = modelosDelSchema(SCHEMA);
  assert.ok(delSchema.size > 10, `🔴 del schema real sólo salen ${delSchema.size} modelos: el banco no mide nada`);
  assert.deepEqual(todasLasDiscrepancias(delSchema, copia(delSchema)), []);
});

test('SCRUM-429b · ① 🔴 nombra TODAS las que faltan y las que sobran, no sólo la primera', () => {
  const delSchema = modelosDelSchema(SCHEMA);
  const viejo = copia(delSchema);
  viejo.get('Quote').campos.delete('seriesYear');
  viejo.get('Quote').campos.delete('archivedAt');
  viejo.get('WhatsAppMessage').campos.delete('toPhone');
  viejo.get('Quote').campos.set('zzDeOtraRama', 'zz_de_otra_rama');
  assert.deepEqual(todasLasDiscrepancias(delSchema, viejo).sort(), [
    'Quote.archivedAt — falta en el cliente',
    'Quote.seriesYear — falta en el cliente',
    'Quote.zzDeOtraRama — sobra en el cliente',
    'WhatsAppMessage.toPhone — falta en el cliente',
  ]);
});

test('SCRUM-429b · ② 🔴 contra el cliente REAL, dos columnas inventadas en Quote salen las dos, con nombre', async () => {
  const conFantasmas = SCHEMA.replace(/^model Quote \{\n/m, 'model Quote {\n  zzFantasmaUno String?\n  zzFantasmaDos Int?\n');
  assert.notEqual(conFantasmas, SCHEMA, '🔴 no se encontró `model Quote {`: el banco no inyecta nada');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum429b-'));
  try {
    const ruta = path.join(dir, 'schema.prisma');
    fs.writeFileSync(ruta, conFantasmas);
    const r = await comprobarCliente({ schemaPath: ruta });
    assert.equal(r.ok, false);
    assert.ok(r.todas.includes('Quote.zzFantasmaUno — falta en el cliente'), r.mensaje);
    assert.ok(r.todas.includes('Quote.zzFantasmaDos — falta en el cliente'), r.mensaje);
    assert.match(r.mensaje, /Todas las diferencias \(\d+\):/);
    assert.match(aviso(r), /zzFantasmaUno[\s\S]*zzFantasmaDos/);
    assert.match(aviso(r), /trampas-del-entorno\.md §10/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('SCRUM-429b · ③ 🔴 `--avisar` NO para (sale 0) y sin él SÍ (sale 1), ante el mismo cliente roto', () => {
  const sinCliente = pathToFileURL(path.join(os.tmpdir(), 'scrum429b-no-existe-cliente')).href;
  const correr = (...args) => spawnSync(process.execPath, [GUARD, ...args], { cwd: RAIZ, encoding: 'utf8', env: entorno });
  const avisa = correr('--avisar', sinCliente);
  assert.equal(avisa.status, 0, `🔴 --avisar ha parado el build:\n${avisa.stderr}`);
  assert.match(avisa.stderr, /AVISO/);
  assert.match(avisa.stderr, /NO SE PUEDE COMPARAR|NINGÚN modelo/);
  const para = correr(sinCliente);
  assert.equal(para.status, 1, '🔴 sin --avisar el guard tiene que seguir parando');
});

test('SCRUM-429b · ④ prebuild AVISA y pretest sigue BLOQUEANDO con el mismo guard', () => {
  const { scripts } = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));
  assert.equal(scripts.prebuild, 'node scripts/_prisma-client-guard.mjs --avisar');
  assert.match(scripts.pretest, /node scripts\/_prisma-client-guard\.mjs(?! --avisar)/,
    '🔴 pretest ha perdido el guard que bloquea, o lo ha pasado a modo aviso');
});
