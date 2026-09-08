// «No pude armar el auto-merge PORQUE HAY CONFLICTO» y «no pude armar y no sé por qué» no son
// el mismo suceso y no pueden dar el mismo color. Esto vigila esa distinción.
//
// POR QUÉ EXISTE COMO TEST Y NO COMO COMENTARIO EN EL YAML: el fundador pidió el control —«los
// dos casos, corridos»— y un `if` dentro de un `run:` de GitHub Actions no se puede correr
// aquí. Por eso la decisión vive en `scripts/clasificar-fallo-automerge.mjs`, que sí se
// ejecuta, y este fichero la ejerce. Un guard que no corre en `npm test` no existe.
//
// SIN GATE: no toca BD, ni red, ni levanta servidor. Solo llama a una función pura y lee un
// fichero de texto.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clasificar } from '../scripts/clasificar-fallo-automerge.mjs';

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WORKFLOW = path.join(REPO, '.github', 'workflows', 'pr-automatico.yml');

// ── LOS DOS CASOS BENIGNOS, CORRIDOS ───────────────────────────────────────────────────────

test('conflicto → NO es avería (el PR queda abierto para una persona)', () => {
  const r = clasificar({ mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY' });
  assert.equal(r.benigno, true, 'un PR en conflicto no se puede armar, y eso es normal');
  assert.match(r.motivo, /CONFLICTOS/);
});

test('conflicto dicho SOLO por mergeStateStatus → también benigno', () => {
  // Los dos campos hablan del mismo hecho; basta con que lo diga uno.
  const r = clasificar({ mergeable: 'UNKNOWN', mergeStateStatus: 'DIRTY' });
  assert.equal(r.benigno, true);
});

test('conflicto en vocabulario REST (mergeable:false) → también benigno', () => {
  const r = clasificar({ mergeable: false, mergeStateStatus: 'DIRTY' });
  assert.equal(r.benigno, true, 'REST dice false donde GraphQL dice CONFLICTING');
});

test('ya no queda nada que esperar (CLEAN) → NO es avería', () => {
  const r = clasificar({ mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN' });
  assert.equal(r.benigno, true, 'no se puede armar lo que no tiene condición pendiente');
  assert.match(r.motivo, /nada que armar/);
});

// ── EL ROJO SIGUE PUDIENDO SALIR ───────────────────────────────────────────────────────────
// Ésta es la mitad que impide que «arreglar el rojo falso» acabe apagando el rojo entero.

test('🔴 estado en el que SÍ se debería haber podido armar → sigue siendo ROJO', () => {
  const r = clasificar({ mergeable: 'MERGEABLE', mergeStateStatus: 'BLOCKED' });
  assert.equal(r.benigno, false, 'un PR bloqueado esperando checks SE puede armar: si falla, es real');
});

test('🔴 UNKNOWN tras reintentar → ROJO, porque no saber no es un motivo legítimo', () => {
  const r = clasificar({ mergeable: 'UNKNOWN', mergeStateStatus: 'UNKNOWN' });
  assert.equal(r.benigno, false);
  assert.match(r.motivo, /UNKNOWN|no ha resuelto/);
});

test('🔴 falla CERRADO: un estado que no reconoce NO se cuela en verde', () => {
  // El día que GitHub añada un estado nuevo, el color seguro es el rojo.
  const r = clasificar({ mergeable: 'ALGO_QUE_NO_EXISTE', mergeStateStatus: 'TAMPOCO' });
  assert.equal(r.benigno, false);
});

test('🔴 vista vacía (no se pudo leer el PR) → ROJO', () => {
  assert.equal(clasificar({}).benigno, false);
  assert.equal(clasificar().benigno, false);
});

// ── EL AGUJERO QUE TENÍA CLASIFICAR SOLO POR ESTADO ────────────────────────────────────────
// La causa real del rojo del PR #1181 fue de PERMISOS, no del estado. Ese fallo sale con
// cualquier estado — así que si el PR estuviera ADEMÁS en conflicto, mirar solo el estado lo
// habría llamado benigno y habría tapado el problema en verde. Sería cambiar un rojo falso
// por un verde falso, que es peor.

test('🔴 permisos manda sobre el estado: conflicto + error de permisos → ROJO', () => {
  const r = clasificar({
    mergeable: 'CONFLICTING',
    mergeStateStatus: 'DIRTY',
    error: 'GraphQL: Resource not accessible by integration (enablePullRequestAutoMerge)',
  });
  assert.equal(r.benigno, false, 'un fallo de permisos no es benigno aunque el PR esté en conflicto');
  assert.match(r.motivo, /PERMISOS/);
});

test('🔴 permisos manda sobre el estado: CLEAN + error de permisos → ROJO', () => {
  const r = clasificar({
    mergeable: 'MERGEABLE',
    mergeStateStatus: 'CLEAN',
    error: 'Resource not accessible by integration',
  });
  assert.equal(r.benigno, false);
});

test('el escalador por texto SOLO endurece: si el mensaje cambia, se cae al camino de estado', () => {
  // Si GitHub reescribe el mensaje, el patrón deja de casar y manda el estado — que es el
  // camino normal. Un discriminador por texto que solo endurece no puede volverse mudo a
  // favor del verde.
  const r = clasificar({
    mergeable: 'CONFLICTING',
    mergeStateStatus: 'DIRTY',
    error: 'algún mensaje futuro que nadie ha visto todavía',
  });
  assert.equal(r.benigno, true, 'sin marca de permisos, decide el estado');
});

// ── QUE EL WORKFLOW SIGA LLAMANDO A ESTO ───────────────────────────────────────────────────
// Un clasificador correcto que el workflow no invoca no protege de nada. Este es el eslabón
// que impide que se separen sin que nadie lo note.

test('el workflow INVOCA al clasificador y le pasa el error para poder endurecer', () => {
  const yml = fs.readFileSync(WORKFLOW, 'utf8');
  assert.match(yml, /scripts\/clasificar-fallo-automerge\.mjs/,
    'pr-automatico.yml debe llamar al clasificador; si deja de hacerlo, el rojo falso vuelve');
  assert.match(yml, /--json mergeable,mergeStateStatus/,
    'debe pedir el ESTADO (enum), que es lo que clasifica — no el texto del mensaje');
  assert.match(yml, /RUNNER_TEMP.*err\.txt|err\.txt/,
    'debe capturar la salida de error de `gh pr merge` para poder endurecer por permisos');
});

test('el paso de armar sigue SIN mergear a mano y SIN saltar comprobaciones', () => {
  const yml = fs.readFileSync(WORKFLOW, 'utf8');
  assert.match(yml, /gh pr merge "\$NUM" --auto --merge/, 'debe seguir siendo --auto');

  // 🔴 SIN COMENTARIOS, y no es un detalle: la primera versión de esta línea salió ROJA
  // contra la PROSA que prohíbe el flag. La cabecera del workflow escribe `--admin` para
  // decir que no se usa, y un guard de texto sobre el fichero entero se caza a sí mismo.
  // Es la trampa que esta casa ya lleva documentada; el remedio es mirar el CÓDIGO.
  const soloCodigo = yml
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .join('\n');
  assert.ok(!/--admin/.test(soloCodigo),
    'jamás --admin en el código: saltaría el check obligatorio');
});
