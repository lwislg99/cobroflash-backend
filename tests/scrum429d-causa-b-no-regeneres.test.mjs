// tests/scrum429d-causa-b-no-regeneres.test.mjs — SCRUM-429d
//
// Un consejo que, obedecido, rompe a los demás. El diagnóstico de `_prisma-client-guard.mjs` decía
// «Arreglo, en los dos casos: npm run prisma:generate (desde ESTE worktree)», también en la causa (B)
// —un `node_modules` COMPARTIDO—, que es justo lo que `docs/equipo/trampas-del-entorno.md` §10
// prohíbe: regenerar el cliente compartido lo coordina el orquestador, nunca una sesión por su cuenta.
// Y `_prisma-sync.mjs`, al ver un junction, mandaba «avisar a las otras sesiones y regenerar a mano».
//
// Aquí se ata: el único `prisma:generate` que se prescribe es el del `node_modules` PROPIO, y el
// compartido manda al orquestador y al procedimiento.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const guard = await import(pathToFileURL(path.join(RAIZ, 'scripts', '_prisma-client-guard.mjs')).href);

const CASOS = [
  { tipo: 'modelo', modelo: 'Invoice', direccion: 'falta' },
  { tipo: 'modelo', modelo: 'Invoice', direccion: 'sobra' },
];

test('el diagnóstico no prescribe regenerar «en los dos casos»: el comando va atado al node_modules PROPIO', () => {
  for (const d of CASOS) {
    const m = guard.mensaje(d);
    assert.doesNotMatch(m, /en los dos casos/i, `(${d.direccion}) vuelve a recetar lo mismo para (A) y (B)`);
    const recetas = m.split('\n').filter((l) => /npm run prisma:generate/.test(l));
    assert.ok(recetas.length > 0, `(${d.direccion}) el diagnóstico ya no dice cómo se arregla un node_modules propio`);
    for (const l of recetas) assert.match(l, /TUYO|propio/i, `(${d.direccion}) receta sin condición: «${l.trim()}»`);
  }
});

test('con el node_modules compartido: NO regenerar, avisar al orquestador, y dónde está el procedimiento', () => {
  for (const d of CASOS) {
    const m = guard.mensaje(d);
    assert.match(m, /NO regeneres/, `(${d.direccion})`);
    assert.match(m, /orquestador/, `(${d.direccion})`);
    assert.match(m, /trampas-del-entorno\.md §10/, `(${d.direccion})`);
  }
});

test('el gemelo de _prisma-sync.mjs: ante un junction tampoco manda regenerar a mano (código sin comentarios)', () => {
  const codigo = fs.readFileSync(path.join(RAIZ, 'scripts', '_prisma-sync.mjs'), 'utf8').split(/\r?\n/)
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n');
  assert.doesNotMatch(codigo, /regenerar a mano/);
  assert.match(codigo, /orquestador/);
  assert.match(codigo, /trampas-del-entorno\.md §10/);
});
