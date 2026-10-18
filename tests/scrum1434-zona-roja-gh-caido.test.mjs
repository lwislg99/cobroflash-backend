// SCRUM-1434 — un `gh api` caído ya no pone ROJO `zona-roja.yml`, y tampoco se lee como «no hay comentario».
//
// EL DEFECTO, localizado por S0 en SCRUM-1123c (`docs/master/SCRUM-1123.md`, la 3 de su censo): el
// paso buscaba su comentario con `ID=$(gh api … 2>/dev/null | head -1)`. El fichero cree no llevar
// `set -e` («`set -e` NO», decía su comentario), pero Actions invoca el paso con `bash -e {0}` —medido
// en el log de la corrida 35366350410— y el propio paso pone `pipefail`. Así que si `gh` fallaba, la
// asignación salía ≠0 y el paso MORÍA antes de su `exit 0`: el workflow que «no puede salir rojo»
// podía, y por un motivo que no es el que vigila.
//
// Y EL ARREGLO OBVIO ERA OTRO DEFECTO. Con un `|| true` detrás, el paso sobrevive, pero:
//   · `gh` deja el cuerpo JSON del error en stdout (medido en SCRUM-853) → `ID` = el error → PATCH a ciegas;
//   · y si saliera vacío, «no pude buscarlo» se lee como «no hay ninguno» → un comentario NUEVO por push,
//     justo lo que la sección 4 del paso existe para impedir.
// Por eso aquí se prueban LOS DOS SENTIDOS: que un `gh` caído no tumbe el job, y que el aviso siga
// saliendo —y comentando— cuando el PR toca la zona roja y `gh` responde.
//
// CÓMO SE PRUEBA: ejecutando el `run:` REAL del YAML con `bash -e`, como Actions, con un `gh` y un
// `git` falsos en el PATH y el detector real (`scripts/zona-roja.mjs`, copiado al temporal: el paso
// escribe sus ficheros en el directorio de trabajo, y ese directorio NO puede ser el repo — SCRUM-824).
// SIN GATE: sin red y sin BD. Necesita `bash` y `node`; si no hay bash usable, el SUELO lo dice.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { temporal } from './_temporal.mjs'; // SCRUM-864 · el temporal se borra pase lo que pase

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WORKFLOW = path.join(RAIZ, '.github', 'workflows', 'zona-roja.yml');

// Cada una devuelve un defecto concreto; su test tiene que ponerse rojo.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: '.github/workflows/zona-roja.yml',
    de: '          set +e -uo pipefail',
    a: '          set -uo pipefail',
    cae: 'el paso se quita a mano el -e que pone Actions',
  },
  {
    fichero: '.github/workflows/zona-roja.yml',
    de: '              IDS="?"',
    a: '              IDS=""',
    cae: 'gh caído al buscar: verde, sin comentar a ciegas',
  },
  {
    fichero: '.github/workflows/zona-roja.yml',
    de: '              *[!0-9]*)',
    a: '              __nunca__)',
    cae: 'gh responde basura sin fallar: tampoco es un id',
  },
  {
    fichero: '.github/workflows/zona-roja.yml',
    de: '            ID="${IDS%%$\'\\n\'*}"',
    a: '            ID="$IDS"',
    cae: 'con comentario previo: lo ACTUALIZA, el primero',
  },
];

/** El `run:` del paso «Avisar de zona roja», tal cual está en el YAML (el repo no trae parser de YAML). */
function pasoAviso() {
  const lineas = fs.readFileSync(WORKFLOW, 'utf8').replace(/\r\n/g, '\n').split('\n');
  const i = lineas.findIndex((l) => /^ {6}- name: Avisar de zona roja\s*$/.test(l));
  if (i < 0) return null;
  let j = i + 1;
  while (j < lineas.length && !/^ {8}run: \|\s*$/.test(lineas[j])) {
    if (/^ {6}- /.test(lineas[j])) return null;
    j++;
  }
  const cuerpo = [];
  for (let k = j + 1; k < lineas.length; k++) {
    const l = lineas[k];
    if (l.trim() === '') { cuerpo.push(''); continue; }
    if (!l.startsWith(' '.repeat(10))) break;
    cuerpo.push(l.slice(10));
  }
  return cuerpo.length ? cuerpo.join('\n') : null;
}

/**
 * El `gh` falso. Apunta cada llamada en `$GH_LOG`. Las escrituras (`-X …`) salen con `$SALIDA_ESCRIBIR`.
 * La búsqueda, si `$FALLA` es BUSCAR, falla COMO LA DE VERDAD: cuerpo JSON del error por stdout y código 1.
 */
const GH_FALSO = [
  '#!/usr/bin/env bash',
  'printf \'%s\\n\' "$*" >> "$GH_LOG"',
  'if [ "${2:-}" = "-X" ]; then exit "${SALIDA_ESCRIBIR:-0}"; fi',
  'if [ "${FALLA:-}" = "BUSCAR" ]; then',
  `  printf '%s' '{"message":"Server Error","documentation_url":"https://docs.github.com/rest","status":"502"}'`,
  "  echo 'gh: Server Error (HTTP 502)' >&2",
  '  exit 1',
  'fi',
  'printf \'%s\' "${IDS_OK:-}"',
  '',
].join('\n');

/** El `git` falso: sólo sabe el `diff --name-only` del paso, y devuelve `$CAMBIADOS`. */
const GIT_FALSO = [
  '#!/usr/bin/env bash',
  '[ "${1:-}" = "diff" ] || exit 1',
  'printf \'%s\\n\' "$CAMBIADOS"',
  '',
].join('\n');

const barras = (p) => p.split(path.sep).join('/');
const clavePath = Object.keys(process.env).find((k) => k.toUpperCase() === 'PATH') || 'PATH';

// Su propio temporal, y no uno que llegue por parámetro: así el censo de SCRUM-824 ve de dónde cuelga.
function binFalso() {
  const bin = temporal(`yaqu-1434-bin-${process.pid}-`);
  for (const [nombre, guion] of [['gh', GH_FALSO], ['git', GIT_FALSO]]) {
    fs.writeFileSync(path.join(bin, nombre), guion);
    fs.chmodSync(path.join(bin, nombre), 0o755);
  }
  return bin;
}

/** Ejecuta el paso REAL con un escenario. Devuelve su código, su salida, su resumen y las llamadas a `gh`. */
function correrPaso(escenario = {}) {
  const guion = pasoAviso();
  assert.ok(guion, '🔴 no encuentro el paso «Avisar de zona roja» en zona-roja.yml: el laboratorio no mide nada');
  const tmp = temporal(`yaqu-1434-${process.pid}-`);
  const bin = binFalso();
  const trabajo = path.join(tmp, 'trabajo');
  fs.mkdirSync(path.join(trabajo, 'scripts'), { recursive: true });
  fs.copyFileSync(path.join(RAIZ, 'scripts', 'zona-roja.mjs'), path.join(trabajo, 'scripts', 'zona-roja.mjs'));
  const resumen = path.join(tmp, 'summary');
  const log = path.join(tmp, 'gh.log');
  fs.writeFileSync(resumen, '');
  fs.writeFileSync(log, '');
  fs.writeFileSync(path.join(tmp, 'paso.sh'), guion);
  const env = {
    ...process.env,
    [clavePath]: bin + path.delimiter + process.env[clavePath],
    GH_TOKEN: 'falso', PR: '2600', REPO: 'lwislg99/cobroflash-backend', BASE: 'main',
    GITHUB_STEP_SUMMARY: barras(resumen), GH_LOG: barras(log),
    CAMBIADOS: 'src/app.ts', IDS_OK: '', FALLA: '', SALIDA_ESCRIBIR: '0',
    ...escenario,
  };
  // `bash -e`: así invoca Actions un `run:` sin `shell:` (medido en el log, SCRUM-1123c).
  const r = spawnSync('bash', ['-e', barras(path.join(tmp, 'paso.sh'))], { cwd: trabajo, env, encoding: 'utf8', timeout: 60000 });
  const llamadas = fs.readFileSync(log, 'utf8').split('\n').filter(Boolean);
  return {
    status: r.status, stdout: r.stdout || '', stderr: r.stderr || '', error: r.error,
    resumen: fs.readFileSync(resumen, 'utf8'),
    llamadas,
    escrituras: llamadas.filter((l) => /^api -X /.test(l)),
  };
}

const diag = (r) => `\n  status=${r.status}\n  stdout=${r.stdout}\n  stderr=${r.stderr}\n  llamadas=${JSON.stringify(r.llamadas)}\n  resumen=${r.resumen}`;

// ── LOS SUELOS: sin ellos, un verde de abajo no se distinguiría de un laboratorio que no reproduce Actions ──

test('🔴 SUELO · hay bash, ve node, y el gh falso falla COMO EL DE VERDAD (error por stdout y código 1)', () => {
  const bin = binFalso();
  const r = spawnSync('bash', ['-c', 'FALLA=BUSCAR GH_LOG=/dev/null gh api repos/o/r/issues/1/comments; echo "exit=$?"; command -v node >/dev/null && echo node=si'], {
    env: { ...process.env, [clavePath]: bin + path.delimiter + process.env[clavePath] }, encoding: 'utf8', timeout: 30000,
  });
  assert.ok(!r.error, `🔴 CIEGO: no hay bash que ejecutar (${r.error && r.error.message})`);
  assert.match(r.stdout, /\{"message":"Server Error"/, 'el gh falso tiene que dejar el cuerpo del error en stdout, como el real');
  assert.match(r.stdout, /exit=1/, 'y salir con 1, como el real');
  assert.match(r.stdout, /node=si/, '🔴 CIEGO: el bash del laboratorio no ve node, y el paso lo necesita');
});

test('🔴 SUELO · el laboratorio REPRODUCE el defecto: con `bash -e` y pipefail, `X=$(false | head -1)` muere', () => {
  // Si esto no muriera, el test de «gh caído» saldría verde también sobre el fichero viejo, y no probaría nada.
  const muere = spawnSync('bash', ['-e', '-c', 'set -uo pipefail; X=$(false | head -1); echo LLEGA; exit 0'], { encoding: 'utf8', timeout: 30000 });
  assert.notEqual(muere.status, 0, '🔴 CIEGO: este bash no reproduce el `-e` de Actions');
  assert.doesNotMatch(muere.stdout, /LLEGA/);
  const control = spawnSync('bash', ['-e', '-c', 'set -uo pipefail; X=$(true | head -1); echo LLEGA; exit 0'], { encoding: 'utf8', timeout: 30000 });
  assert.equal(control.status, 0, 'control: con la tubería buena, llega');
  assert.match(control.stdout, /LLEGA/);
});

// ── SENTIDO 1: `gh` caído o mudo NO tumba el job, y no se toma por «no hay comentario» ────────────────

test('SCRUM-1434 · el paso se quita a mano el -e que pone Actions', () => {
  const guion = pasoAviso();
  assert.ok(guion, '🔴 no encuentro el paso');
  const primera = guion.split('\n').map((l) => l.trim()).find((l) => l && !l.startsWith('#'));
  assert.match(
    primera,
    /^set \+e\b/,
    '🔴 la primera orden del paso tiene que ser `set +e`: Actions lo invoca con `bash -e {0}`, así que no ' +
      'escribir `set -e` NO lo quita. Sin esto, cualquier orden sin guardar que se añada mañana vuelve a ' +
      'poder pintar de rojo un job que promete no salir rojo nunca.',
  );
});

test('SCRUM-1434 · gh caído al buscar: verde, sin comentar a ciegas, y DICIÉNDOLO', () => {
  const r = correrPaso({ FALLA: 'BUSCAR' });
  assert.ok(!r.error, `🔴 CIEGO: ${r.error && r.error.message}`);
  assert.equal(r.status, 0, '🔴 un `gh api` caído ha tumbado el paso: el job sale ROJO por algo que no vigila' + diag(r));
  assert.deepEqual(
    r.escrituras,
    [],
    '🔴 sin poder buscar su comentario, ha escrito igual: o un PATCH con el cuerpo del error como id, o un ' +
      'comentario NUEVO por push («no pude mirar» leído como «no hay ninguno»)' + diag(r),
  );
  assert.match(r.stdout, /::warning title=Zona roja::no pude buscar el comentario/, 'tiene que verse en el PR, no sólo en el log' + diag(r));
  assert.match(r.resumen, /no pude buscar el comentario/, 'y en el resumen del job' + diag(r));
  assert.match(r.resumen, /Este PR toca la zona roja/, 'el aviso en sí NO se pierde: sigue en el resumen' + diag(r));
});

test('SCRUM-1434 · gh responde basura sin fallar: tampoco es un id', () => {
  const r = correrPaso({ IDS_OK: '{"message":"Bad credentials"}' });
  assert.equal(r.status, 0, diag(r));
  assert.deepEqual(r.escrituras, [], '🔴 algo que no es un número se ha usado como id de comentario' + diag(r));
  assert.match(r.resumen, /no pude buscar el comentario/, diag(r));
});

test('SCRUM-1434 · una escritura que falla tampoco tumba el paso, y se dice', () => {
  const r = correrPaso({ SALIDA_ESCRIBIR: '1' });
  assert.equal(r.status, 0, diag(r));
  assert.match(r.resumen, /no pude crear el comentario/, diag(r));
});

// ── SENTIDO 2: cuando toca, el aviso SIGUE saliendo y comentando ──────────────────────────────────────

test('SCRUM-1434 · sin comentario previo: crea UNO', () => {
  const r = correrPaso({ IDS_OK: '' });
  assert.equal(r.status, 0, diag(r));
  assert.equal(r.escrituras.length, 1, diag(r));
  assert.match(r.escrituras[0], /^api -X POST repos\/lwislg99\/cobroflash-backend\/issues\/2600\/comments /, diag(r));
  assert.match(r.resumen, /Este PR toca la zona roja/, diag(r));
});

test('SCRUM-1434 · con comentario previo: lo ACTUALIZA, el primero, y no crea otro', () => {
  const r = correrPaso({ IDS_OK: '123\n456' });
  assert.equal(r.status, 0, diag(r));
  assert.deepEqual(
    r.escrituras.map((l) => l.split(' ').slice(0, 4).join(' ')),
    ['api -X PATCH repos/lwislg99/cobroflash-backend/issues/comments/123'],
    '🔴 tenía que actualizar el comentario que ya existe (uno por PR, nunca uno por push)' + diag(r),
  );
});

test('SCRUM-1434 · un PR que no toca la zona roja: verde, sin llamar a gh', () => {
  const r = correrPaso({ CAMBIADOS: 'README.md', FALLA: 'BUSCAR' });
  assert.equal(r.status, 0, diag(r));
  assert.deepEqual(r.llamadas, [], '🔴 sin zona roja no hay nada que comentar' + diag(r));
  assert.match(r.resumen, /Este PR no toca la zona roja/, diag(r));
});
