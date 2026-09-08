// tests/pr-automatico-el-mensaje-del-automerge.test.mjs
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL MENSAJE QUE LLEVABA SEMANAS MANDANDO A MIRAR DONDE NO ES
//
// ── EL DEFECTO ──────────────────────────────────────────────────────────────────────────────
//
// El paso «Armar el auto-merge» de `.github/workflows/pr-automatico.yml` falla contra el PR #1181
// con:
//
//     GraphQL: Resource not accessible by integration (enablePullRequestAutoMerge)
//
// …y su mensaje decía «dos causas probables, las dos en Settings del repositorio: Allow auto-merge
// desactivado · --merge no permitido». **Deja fuera la causa que la documentación oficial de GitHub
// asigna a ese literal**, que es PERMISO DEL TOKEN:
//
//   > «If you are using a GitHub App or fine-grained personal access token and you receive a
//   >  "Resource not accessible by integration" … error, then your token has insufficient
//   >  permissions.»
//   >  — GitHub Docs · REST API · Troubleshooting the REST API
//
// No era una redacción floja: era **una hipótesis con forma de diagnóstico**. Dos causas
// presentadas como «probables» sin ninguna medición detrás, y la tercera —la que el propio error
// nombraba— fuera de la lista.
//
// ── LO QUE SE MIDIÓ, y por eso las tres se distinguen ───────────────────────────────────────
//
// Cada causa tiene un literal DISTINTO, así que el fundador puede decidir mirando su propio log:
//
//   A · permisos del token       → «Resource not accessible by integration»
//                                  (documentación oficial de GitHub, citada arriba)
//   B · auto-merge desactivado   → «Auto merge is not allowed for this repository»
//                                  (respuesta real de GitHub, reproducida en cli/cli#13398)
//   C · método de merge          → «The selected merge method (…) is not allowed»
//                                  ⚠️ este tercero sale de informes de usuarios, NO de
//                                  documentación. Se dice en el propio mensaje.
//
// Y hay más literales que NO son ninguno de los tres —«Pull request User is not authorized for
// this protected branch», «Protected branch rules not configured for this branch»—, que es
// justamente por lo que el mensaje ya no ordena por probabilidad: manda comparar.
//
// ── QUÉ VIGILA ESTE FICHERO ────────────────────────────────────────────────────────────────
//
// Que el mensaje no pierda **ninguna de las rutas de Settings** ni **el aviso del squash**. Ese
// aviso es lo más importante que hay ahí dentro y lo más fácil de borrar sin darse cuenta, porque
// parece una nota al margen y es lo contrario: es el freno.
//
// 🔴 SE MIRA EL GUIÓN EJECUTABLE, NO EL FICHERO. El comentario que encabeza ese paso EXPLICA el
// defecto y por tanto contiene los mismos literales que se persiguen. Un guard de texto sobre el
// fichero entero se cazaría a sí mismo y pasaría en verde con el mensaje vacío — es el defecto de
// SCRUM-349, y aquí estaba servido. Hay un control abajo que lo comprueba.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW = path.join(RAIZ, '.github', 'workflows', 'pr-automatico.yml');
const PASO = 'Armar el auto-merge';

/**
 * El `run:` de un paso, y NADA MÁS: ni su nombre, ni sus comentarios, ni el resto del workflow.
 *
 * Se acota por indentación, que es lo que YAML garantiza: el guión son las líneas que cuelgan de
 * `run: |` con más sangría que él, más las vacías intercaladas.
 */
export function guionDelPaso(texto, nombre) {
  const lineas = texto.split('\n');
  const i = lineas.findIndex((l) => l.trim() === '- name: ' + nombre);
  if (i < 0) return null;
  const j = lineas.findIndex((l, k) => k > i && /^\s*run: \|/.test(l));
  if (j < 0) return null;
  const sangria = (lineas[j].match(/^\s*/) || [''])[0].length + 2;
  const fin = lineas.findIndex((l, k) => k > j && l.trim() !== ''
    && (l.match(/^\s*/) || [''])[0].length < sangria);
  return lineas.slice(j + 1, fin < 0 ? lineas.length : fin).join('\n');
}

const texto = fs.readFileSync(WORKFLOW, 'utf8');
const guion = guionDelPaso(texto, PASO);

// ── SUELOS ────────────────────────────────────────────────────────────────────────────────

test('mensaje del auto-merge · 🔴 SUELO: se ha encontrado el guión del paso, y es el guión', () => {
  assert.ok(guion, '🔴 CIEGO: no encuentro el `run:` del paso «' + PASO + '». Todo lo de abajo '
    + 'pasaría en verde sin haber mirado nada.');
  assert.match(guion, /gh pr merge/,
    '🔴 CIEGO: lo acotado no contiene `gh pr merge`, así que no es el paso que se cree.');
  assert.ok(guion.length < texto.length / 2,
    '🔴 CIEGO: el acotado se ha llevado medio workflow (' + guion.length + ' de ' + texto.length
    + ' caracteres). Cualquier cosa que se encuentre ahí no dice nada sobre ESTE paso.');
});

test('mensaje del auto-merge · 🔴 SUELO: los COMENTARIOS quedan fuera, o este guard se caza a sí mismo', () => {
  // El comentario que encabeza el paso explica el defecto y nombra los mismos literales. Si
  // entrara en el acotado, este fichero pasaría en verde con el mensaje BORRADO.
  assert.match(texto, /HIPÓTESIS CON FORMA DE DIAGNÓSTICO/,
    '🔴 CIEGO: el comentario que explica el defecto ya no está en el workflow, así que este '
    + 'control no está probando la separación que dice probar.');
  assert.equal(/HIPÓTESIS CON FORMA DE DIAGNÓSTICO/.test(guion), false,
    '🔴 el acotado se ha tragado los comentarios del paso. Entonces las comprobaciones de abajo '
    + 'las satisface la PROSA que explica el defecto, no el mensaje que ve el fundador: el guard '
    + 'se caza a sí mismo (SCRUM-349) y da verde con el mensaje vacío.');
});

// ── LO QUE NO SE PUEDE PERDER ─────────────────────────────────────────────────────────────

const RUTAS = [
  ['Settings > Developer settings > GitHub Apps > tu App >',
    'la ruta de los permisos DE LA APP — sin ella, el fundador no sabe dónde se tocan'],
  ['Pull requests: Read and write',
    'el permiso CONCRETO que necesita la App. «Dale permisos» no es una instrucción'],
  ['Settings > Applications > Installed GitHub Apps > tu App >',
    'aceptar los permisos nuevos EN LA INSTALACIÓN. Es el paso que todo el mundo olvida: una '
    + 'App no gana permisos hasta que la instalación los acepta, y sin esto el fundador cambia '
    + 'el permiso, no pasa nada, y vuelve a preguntar'],
  ['Settings > Actions > General > Workflow permissions >',
    'la ruta del GITHUB_TOKEN, que es quien actúa en modo DEGRADADO. Es una ruta DISTINTA de la '
    + 'de la App y el mensaje tiene que llevar las dos, porque el modo lo decide el workflow y '
    + 'no el fundador'],
  ['Settings > General > Pull Requests > Allow auto-merge',
    'la ruta del auto-merge (causa B)'],
  ['Settings > General > Pull Requests > Allow merge commits',
    'la ruta del método de merge (causa C)'],
];

test('mensaje del auto-merge · ✅ están LAS TRES rutas de Settings, completas', () => {
  const faltan = RUTAS.filter(([r]) => !guion.includes(r)).map(([r, porque]) => r + '  ← ' + porque);
  assert.deepEqual(faltan, [],
    '🔴 el mensaje ha perdido rutas de Settings:\n  ' + faltan.join('\n  ')
    + '\n\nUna ruta a medias devuelve al fundador a preguntar, que es exactamente el coste que '
    + 'este mensaje existe para no producir.');
});

const LITERALES = [
  ['Resource not accessible by integration (enablePullRequestAutoMerge)',
    'A · permisos del token'],
  ['Auto merge is not allowed for this repository (enablePullRequestAutoMerge)',
    'B · auto-merge desactivado'],
  ['The selected merge method (...) is not allowed',
    'C · método de merge no permitido'],
];

test('mensaje del auto-merge · ✅ cada causa lleva EL LITERAL de GitHub, que es lo que permite decidir', () => {
  const faltan = LITERALES.filter(([l]) => !guion.includes(l)).map(([l, c]) => c + ': ' + l);
  assert.deepEqual(faltan, [],
    '🔴 falta el mensaje literal de alguna causa:\n  ' + faltan.join('\n  ')
    + '\n\nSin los tres literales el mensaje vuelve a ser una LISTA DE SOSPECHOSOS y el fundador '
    + 'no tiene con qué descartar: es el defecto entero de este ticket.');
});

test('mensaje del auto-merge · 🔴 y NO vuelve a ordenar las causas por probabilidad inventada', () => {
  assert.equal(/[Dd]os causas probables/.test(guion), false,
    '🔴 ha vuelto «dos causas probables». Eran dos de tres, y «probables» sin ninguna medición '
    + 'detrás. Ese texto mandó al fundador a Settings durante semanas mientras el error decía '
    + 'otra cosa.');
  assert.match(guion, /ORDENAR por probabilidad/,
    '🔴 el mensaje ya no dice que las causas NO van ordenadas. Decirlo es lo que impide que la '
    + 'primera de la lista se lea como la más probable.');
});

const AVISO_SQUASH = [
  'la salida NO es pasar a squash',
  'el commit de una rama nunca llega a main',
  'git merge-base --is-ancestor <sha> origin/main',
  'SIN MERGEAR para todo, siempre',
  'plausible y falsa',
  'romper el instrumento con el que medimos si el',
  'La decision es del fundador y va escrita',
];

test('mensaje del auto-merge · 🔴 EL AVISO DEL SQUASH sigue entero', () => {
  const faltan = AVISO_SQUASH.filter((f) => !guion.includes(f));
  assert.deepEqual(faltan, [],
    '🔴 el aviso del squash ha perdido piezas: ' + JSON.stringify(faltan)
    + '\n\nEs lo más importante del mensaje y lo más fácil de borrar sin darse cuenta, porque '
    + 'parece una nota al margen y es un FRENO. Con squash el commit de una rama nunca llega a '
    + '`main`, y la comprobación de alcance con la que las seis sesiones deciden si el trabajo '
    + 'existe pasaría a contestar SIN MERGEAR para todo, siempre. No fallaría a gritos: daría '
    + 'una respuesta plausible y falsa, que es el peor modo de fallo que hay.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 SCRUM-828 · EL MENSAJE SOLO SALE CUANDO EL CLASIFICADOR DICE «AVERÍA»
//
// Aquí hay DOS defectos distintos y cada mitad arregla el suyo:
//
//   ① EL ROJO FALSO   → lo decide `scripts/clasificar-fallo-automerge.mjs` mirando el ESTADO
//                       del PR. Dice SI hay que gritar.
//   ② EL DIAGNÓSTICO  → lo dice el mensaje de arriba. Dice QUÉ MIRAR cuando ya se gritó.
//
// 🔴 Y ESTE CONTROL ES LA JUNTA ENTRE LOS DOS, que es lo que ninguno de los dos prueba por su
// cuenta: **si el mensaje bueno sale también en los casos benignos, se ha vuelto a fabricar
// ruido** — un PR en conflicto es una situación normal, y llenarle el log de rutas de Settings
// es exactamente el rojo falso que ① vino a quitar, sólo que más largo.
//
// Se corre EL PASO DE VERDAD: el guión que hay en el YAML, con el clasificador REAL delante y un
// `gh` de mentira que devuelve lo que se le diga. No se simula la decisión: se ejecuta.
//
// ⚠️ POR QUÉ HACE FALTA ESTE TEST Y NO BASTA CON MIRAR EL LOG. El permiso quedó arreglado en
// `main` el 8-sep-2026 (run 25, PR #1196: `Contents: Read and write`), así que **la causa A puede
// no volver a salir nunca en una ejecución real**. Eso es bueno, y a la vez deja el mensaje sin
// nadie que lo mire: si se rompe, el log ya no lo va a delatar. Lo delata esto.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import os from 'node:os';
import { execFileSync } from 'node:child_process';

/** El guión del paso, escrito a fichero para poder EJECUTARLO tal cual está en el YAML. */
function bancoDelPaso({ error, vista }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum828-'));

  // Un `gh` de mentira: `pr merge` falla escribiendo en stderr lo que le digamos (que es por
  // donde el paso lo captura), y `pr view` devuelve el estado que le digamos.
  fs.writeFileSync(path.join(dir, 'gh'),
    '#!/bin/bash\n'
    + 'if [ "$1" = "pr" ] && [ "$2" = "merge" ]; then\n'
    + '  printf "%s\\n" ' + JSON.stringify(error) + ' >&2\n'
    + '  exit 1\n'
    + 'fi\n'
    + 'if [ "$1" = "pr" ] && [ "$2" = "view" ]; then\n'
    + '  printf "%s\\n" ' + JSON.stringify(JSON.stringify(vista)) + '\n'
    + '  exit 0\n'
    + 'fi\n'
    + 'exit 0\n');
  fs.chmodSync(path.join(dir, 'gh'), 0o755);

  fs.writeFileSync(path.join(dir, 'paso.sh'), guionDelPaso(texto, PASO));

  // 🔴 EL PATH SE MONTA DENTRO DE BASH, no desde Node. En Windows, pasarle a `bash` un PATH con
  // `C:\…` no lo entiende; calculando el directorio desde el propio script el envoltorio vale
  // igual en el portátil y en el runner, que es donde tiene que valer.
  fs.writeFileSync(path.join(dir, 'correr.sh'),
    '#!/bin/bash\n'
    + 'D="$(cd "$(dirname "$0")" && pwd)"\n'
    + 'export PATH="$D:$PATH"\n'
    + 'export RUNNER_TEMP="$D"\n'
    + 'exec bash "$D/paso.sh"\n');

  try {
    const salida = execFileSync('bash', [path.join(dir, 'correr.sh')], {
      cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NUM: '1181', MODO_COMPLETO: 'true' },
    });
    return { codigo: 0, salida };
  } catch (e) {
    return { codigo: e.status, salida: String(e.stdout || '') + String(e.stderr || '') };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Marcas del mensaje largo. Si aparecen, el mensaje se imprimió. */
const MARCAS_DEL_MENSAJE = [
  'LAS TRES CAUSAS',
  'Settings > General > Pull Requests > Allow auto-merge',
  'la salida NO es pasar a squash',
];

test('SCRUM-828 · 🔴 SUELO: hay `bash` y el banco puede correr el paso de verdad', () => {
  // Si no hubiera `bash`, los dos casos de abajo no probarían nada y saldrían verdes por no
  // haber mirado. Se declara CIEGO en rojo: un salto se cuenta como pasado (SCRUM-754).
  let hay = false;
  try { execFileSync('bash', ['--version'], { stdio: 'ignore' }); hay = true; } catch { hay = false; }
  assert.ok(hay, '🔴 CIEGO: no hay `bash` en esta máquina, así que los dos casos de abajo no '
    + 'pueden ejecutar el paso. No se saltan: se declara que no se ha mirado.');
});

test('SCRUM-828 · ✅ AVERÍA: el clasificador dice fallo real → SALE el mensaje entero, exit 1', () => {
  // Permisos: el clasificador escala a rojo aunque el estado parezca cualquier cosa.
  const r = bancoDelPaso({
    error: 'GraphQL: Resource not accessible by integration (enablePullRequestAutoMerge)',
    vista: { mergeable: 'MERGEABLE', mergeStateStatus: 'BLOCKED' },
  });
  assert.equal(r.codigo, 1,
    '🔴 el paso no ha salido en rojo con un fallo de PERMISOS. El clasificador lo escala a '
    + 'avería a propósito: fue la causa real del PR #1181.\n' + r.salida);
  const faltan = MARCAS_DEL_MENSAJE.filter((m) => !r.salida.includes(m));
  assert.deepEqual(faltan, [],
    '🔴 se decidió que hay avería y el mensaje NO salió: falta ' + JSON.stringify(faltan)
    + '.\nGritar sin decir dónde mirar es el diagnóstico ciego otra vez.\n' + r.salida);
});

test('SCRUM-828 · 🔴 EL CONTROL QUE IMPIDE FABRICAR RUIDO: situación normal → NO sale el mensaje, exit 0', () => {
  // Un PR en conflicto no se puede armar, y eso es NORMAL. Ni rojo, ni parrafada.
  const r = bancoDelPaso({
    error: 'X GraphQL: Pull Request is in unmergeable state',
    vista: { mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY' },
  });
  assert.equal(r.codigo, 0,
    '🔴 un PR en CONFLICTO ha salido en rojo. Es una situación normal: pintarla de avería '
    + 'fabrica el rojo falso que este ticket vino a quitar.\n' + r.salida);

  const sobran = MARCAS_DEL_MENSAJE.filter((m) => r.salida.includes(m));
  assert.deepEqual(sobran, [],
    '🔴 EL MENSAJE LARGO HA SALIDO EN UN CASO BENIGNO: ' + JSON.stringify(sobran)
    + '.\nEso es fabricar ruido otra vez, y del peor: rutas de Settings para un PR que solo '
    + 'tiene un conflicto. Quien lo lea dos veces deja de leerlo, y el día que haya avería de '
    + 'verdad el mensaje bueno ya no lo mira nadie.\n' + r.salida);

  // Y SÍ dice lo que pasó: callar el motivo sería el otro extremo.
  assert.match(r.salida, /NO ES UNA AVERÍA|es lo esperable/,
    '🔴 sale en verde pero sin decir POR QUÉ no se armó. Un verde mudo no se puede auditar.\n'
    + r.salida);
});

test('SCRUM-828 · 🔴 SUELO del banco: el `gh` de mentira se está usando de verdad', () => {
  // Si el banco no lograra inyectar su `gh`, los dos casos de arriba medirían otra cosa: el
  // paso llamaría al `gh` real (o a ninguno) y el veredicto no vendría del estado inyectado.
  const r = bancoDelPaso({
    error: 'MARCA-DEL-BANCO-QUE-NADIE-MAS-ESCRIBE',
    vista: { mergeable: 'MERGEABLE', mergeStateStatus: 'BLOCKED' },
  });
  assert.match(r.salida, /MARCA-DEL-BANCO-QUE-NADIE-MAS-ESCRIBE/,
    '🔴 CIEGO: el texto que el banco le puso a `gh` no aparece en la salida, así que el paso '
    + 'no está leyendo el error inyectado. Los dos casos de arriba no prueban lo que dicen.\n'
    + r.salida);
});
