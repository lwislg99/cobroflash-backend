// SCRUM-1382 · UN PR EN BORRADOR NO ES UN «FALLO REAL» DEL ABRIDOR
//
// GitHub no arma el auto-merge de un borrador (`GraphQL: Pull request Pull request is a draft
// (enablePullRequestAutoMerge)`, run 36862414707), y hace bien. Lo que estaba mal era el clasificador:
// «borrador» no estaba entre sus motivos legítimos, así que el PR #2001 —borrador a propósito— sacó
// «FALLO REAL» en cuatro empujones seguidos el 1-oct-2026. Un aviso que acusa a un caso legítimo se
// deja de leer entero; por eso aquí va también la otra mitad: el fallo de verdad SIGUE saliendo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { clasificar } from '../scripts/clasificar-fallo-automerge.mjs';

const CLI = fileURLToPath(new URL('../scripts/clasificar-fallo-automerge.mjs', import.meta.url));
const YML = fs.readFileSync(new URL('../.github/workflows/pr-automatico.yml', import.meta.url), 'utf8');
const ERROR_REAL = 'GraphQL: Pull request Pull request is a draft (enablePullRequestAutoMerge)';
// Lo que `gh pr view 2001 --json isDraft,mergeable,mergeStateStatus` devolvía el 1-oct-2026 a las 13:43Z.
const VISTA_2001 = { isDraft: true, mergeStateStatus: 'UNKNOWN', mergeable: 'UNKNOWN' };

test('SCRUM-1382 · 🔴 el caso real de #2001: borrador con todo lo demás en UNKNOWN → NO es una avería', () => {
  const r = clasificar({ ...VISTA_2001, error: ERROR_REAL });
  assert.equal(r.benigno, true, '🔴 un borrador ha vuelto a salir como FALLO REAL');
  assert.match(r.motivo, /BORRADOR/);
  assert.match(r.motivo, /no hay nada que revisar en la configuración/, 'el mensaje no puede mandar a nadie a la configuración del repo');
});

test('SCRUM-1382 · se decide por el ESTADO, no por el texto: sin mensaje también es benigno, y con sólo el mensaje NO', () => {
  assert.equal(clasificar(VISTA_2001).benigno, true);
  assert.equal(clasificar({ mergeable: 'MERGEABLE', mergeStateStatus: 'DRAFT' }).benigno, true, 'DRAFT es un valor del enum de mergeStateStatus');
  // El día que GitHub diga «is a draft» de otra cosa, o lo deje de decir, el veredicto no cambia.
  assert.equal(clasificar({ mergeable: 'MERGEABLE', mergeStateStatus: 'BLOCKED', error: ERROR_REAL }).benigno, false);
});

test('SCRUM-1382 · 🔴 CONTROL POSITIVO: el fallo de verdad sigue saliendo, también con el campo `isDraft` presente', () => {
  for (const vista of [
    { isDraft: false, mergeable: 'MERGEABLE', mergeStateStatus: 'BLOCKED' },
    { isDraft: false, mergeable: 'UNKNOWN', mergeStateStatus: 'UNKNOWN' },
    // Un `isDraft` que no es el booleano `true` no absuelve: la cadena "true", null o un 1 no son un borrador medido.
    { isDraft: 'true', mergeable: 'MERGEABLE', mergeStateStatus: 'BLOCKED' },
    { isDraft: null, mergeable: 'UNKNOWN', mergeStateStatus: 'UNKNOWN' },
    { isDraft: 1, mergeable: 'MERGEABLE', mergeStateStatus: 'BLOCKED' },
  ]) assert.equal(clasificar(vista).benigno, false, `🔴 se ha colado en verde: ${JSON.stringify(vista)}`);
});

test('SCRUM-1382 · 🔴 permisos manda sobre el borrador: borrador + error de permisos → ROJO', () => {
  const r = clasificar({ ...VISTA_2001, error: 'GraphQL: Resource not accessible by integration (enablePullRequestAutoMerge)' });
  assert.equal(r.benigno, false);
  assert.match(r.motivo, /PERMISOS/);
});

test('SCRUM-1382 · el comando de verdad: sale 0 y dice «NO ES UNA AVERÍA» con el borrador; sale 1 y dice «FALLO REAL» sin él', () => {
  const correr = (vista) => spawnSync(process.execPath, [CLI], { input: JSON.stringify(vista), encoding: 'utf8', timeout: 30000 });
  const borrador = correr({ ...VISTA_2001, error: ERROR_REAL });
  assert.equal(borrador.status, 0, borrador.stdout + borrador.stderr);
  assert.match(borrador.stdout, /NO ES UNA AVERÍA: el PR está en BORRADOR/);
  assert.doesNotMatch(borrador.stdout, /FALLO REAL/);
  const real = correr({ isDraft: false, mergeable: 'MERGEABLE', mergeStateStatus: 'BLOCKED' });
  assert.equal(real.status, 1);
  assert.match(real.stdout, /FALLO REAL/);
});

test('SCRUM-1382 · el workflow PIDE `isDraft`: sin el campo en la consulta, el arreglo queda inerte y con aspecto de funcionar', () => {
  assert.match(YML, /gh pr view "\$NUM" --json mergeable,mergeStateStatus,isDraft/);
  // Y no espera 25 s a que se resuelva un UNKNOWN que en un borrador ya no decide nada.
  const bucle = YML.slice(YML.indexOf('for intento in 1 2 3 4 5'), YML.indexOf('done', YML.indexOf('for intento in 1 2 3 4 5')));
  assert.ok(bucle.indexOf('"isDraft":true') !== -1 && bucle.indexOf('"isDraft":true') < bucle.indexOf('"UNKNOWN"'),
    '🔴 el caso del borrador tiene que ir ANTES que el de UNKNOWN en el `case`: gana el primero que casa');
  // (El `case` busca `"isDraft":true` sin espacios: es como lo escribió `gh` el 1-oct en #2001. Si `gh`
  // cambiara el formato, el `case` no casa y sólo se pierde el atajo: el clasificador lee el JSON entero.)
});
