// SCRUM-168 — el aviso «este PR toca la zona roja» (sin gate: corre en `npm test`).
//
// ENCUADRE, YA CORREGIDO (decisión del fundador, 27-jul-2026): el ticket lo planteaba como
// complemento de un gate de «Require review from Code Owners». **Ese gate no va a existir.**
// Así que esto no es redundante para nadie: es la ÚNICA señal que hay sobre la zona roja, para
// los dos carriles. Eso sube el listón de lo que se le puede exigir — sobre todo, no callar.
//
// LOS DOS SENTIDOS SON EL DoD. Un detector que dice "sí" a todo avisa igual de bien que uno que
// funciona, y no se nota: el comentario sale siempre y la gente deja de leerlo. Por eso hay
// tantos casos de "NO toca" como de "sí toca".
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ZONA_ROJA,
  HUECOS_DECLARADOS,
  casa,
  tocaZonaRoja,
  patronesDocumentados,
  informe,
  MARCA,
} from '../scripts/zona-roja.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const leer = (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8');

// ── 1. El emparejador, en los dos sentidos ───────────────────────────────────────────────

test('SCRUM-168 · SÍ casa: ruta exacta, directorio, nombre suelto y extensión', () => {
  assert.ok(casa('src/app.ts', 'src/app.ts'), 'ruta exacta');
  assert.ok(casa('tests/albaran.test.mjs', '/tests/'), 'directorio con barras');
  assert.ok(casa('tests/albaran.test.mjs', 'tests/'), 'directorio sin barra inicial');
  assert.ok(casa('public/dashboard/js/homeView.js', 'homeView.js'), 'nombre suelto, esté donde esté');
  assert.ok(casa('prisma/schema.prisma', '*.prisma'), 'por extensión');
});

test('SCRUM-168 · NO casa: parecidos que no son', () => {
  assert.equal(casa('src/app.test.ts', 'src/app.ts'), false, 'un prefijo no es la misma ruta');
  assert.equal(casa('src/apps/otro.ts', 'src/app.ts'), false);
  assert.equal(casa('public/js/homeViewNuevo.js', 'homeView.js'), false, 'parecido, no igual');
  assert.equal(casa('testsuite/x.mjs', 'tests/'), false, 'el directorio tiene que ser el directorio');
});

// ── 2. Los dos sentidos sobre un PR entero ───────────────────────────────────────────────

test('SCRUM-168 · un PR fuera de la zona roja no dispara nada', () => {
  const golpes = tocaZonaRoja([
    'src/modules/reports/reports.routes.ts',
    'public/dashboard/css/x.css',
    'README.md',
  ]);
  assert.deepEqual(
    golpes,
    [],
    '🔴 Falso positivo: si el aviso sale en PRs que no tocan zona roja deja de significar nada, ' +
      'y se ignora justo el día que importa. Al ser la ÚNICA señal, no hay otra que lo recoja.',
  );
});

test('SCRUM-168 · un PR que sí la toca la nombra, con su patrón y su motivo', () => {
  const golpes = tocaZonaRoja(['src/app.ts', 'README.md']);
  assert.equal(golpes.length, 1);
  assert.equal(golpes[0].fichero, 'src/app.ts');
  assert.ok(golpes[0].porque.length > 0, 'cada golpe dice POR QUÉ esa ruta es roja');
});

// ── 3. Una sola lista. La documentación describe; el código decide ───────────────────────

test('SCRUM-168 · la lista NO está vacía', () => {
  assert.ok(
    ZONA_ROJA.length > 0,
    '🔴 CERO patrones = el aviso no salta NUNCA y se lee igual que "ningún PR toca zona roja". ' +
      'Un guard que calla por falta de datos es peor que no tenerlo: tranquiliza.',
  );
  for (const z of ZONA_ROJA) {
    assert.ok(z.porque && z.porque.length > 0, `\`${z.patron}\` está sin motivo: eso es folclore`);
  }
});

test('SCRUM-168 · el PLAN §3.2 no puede separarse de la lista que manda', () => {
  const documentados = patronesDocumentados(leer('docs', 'PLAN_EJECUCION_Y_PARALELO.md'));
  const reales = ZONA_ROJA.map((z) => z.patron);
  assert.deepEqual(
    [...documentados].sort(),
    [...reales].sort(),
    '🔴 La prosa del PLAN y `ZONA_ROJA` han derivado. Es el fallo de ADMIN_ONLY_ROUTES ' +
      '(SCRUM-158) y el que ya había pasado aquí con tres copias a mano de esta misma lista. ' +
      'Se edita `scripts/zona-roja.mjs` y el documento detrás, no al revés.',
  );
});

test('SCRUM-168 · ASESOR §4 ya no lleva su propia copia de la lista', () => {
  const asesor = leer('docs', 'ASESOR.md');
  const linea = asesor.split('\n').find((l) => /Zona roja compartida/.test(l));
  assert.ok(linea, 'sigue existiendo la mención en §4');
  assert.ok(
    /zona-roja\.mjs/.test(linea),
    '🔴 §4 debe APUNTAR a la lista, no repetirla: cuando la repetía ya se había separado ' +
      '(omitía prisma/schema.prisma, jobDetailView.js y homeView.js).',
  );
});

// ── 4. El hueco declarado sigue declarado ────────────────────────────────────────────────

test('SCRUM-168 · los serializers están como HUECO, con motivo y precedente', () => {
  const hueco = HUECOS_DECLARADOS.find((h) => /serializer/i.test(h.que));
  assert.ok(hueco, '🔴 el hueco de los serializers ha desaparecido de la declaración');
  assert.ok(/SCRUM-97/.test(hueco.precedente), 'el precedente concreto tiene que estar escrito');
  assert.equal(
    ZONA_ROJA.some((z) => /serializ/i.test(z.patron)),
    false,
    '🔴 los serializers han vuelto a la lista como si fueran una ruta. No lo son: viven en 11 ' +
      'ficheros de 8 módulos, y el precedente que los justificaba (portalToken, SCRUM-97) caía ' +
      'fuera de la entrada que decía cubrirlos. Un hueco visible, no una protección decorativa.',
  );
});

// ── 5. El informe y el workflow no se separan ────────────────────────────────────────────

test('SCRUM-168 · el informe lleva el ancla, el motivo y los huecos', () => {
  const texto = informe(tocaZonaRoja(['src/app.ts']));
  assert.ok(texto.startsWith(MARCA), '🔴 sin la marca, cada push deja un comentario nuevo');
  assert.ok(texto.includes('no bloquea'), 'debe decir que no bloquea');
  assert.ok(texto.includes('única señal'), 'debe decir que no hay gate detrás');
  assert.ok(/serializer/i.test(texto), 'los huecos se dicen donde se lee el aviso, no solo en el código');
});

test('SCRUM-168 · el workflow usa el script y la misma marca', () => {
  const wf = leer('.github', 'workflows', 'zona-roja.yml');
  assert.ok(wf.includes('scripts/zona-roja.mjs'), '🔴 el workflow ya no llama al script');
  assert.ok(
    wf.includes(MARCA),
    '🔴 la marca del workflow y la del informe han divergido: el job no encontraría su propio ' +
      'comentario y acumularía uno por push',
  );
  assert.ok(
    wf.includes('...HEAD'),
    '🔴 el diff debe ser de tres puntos: con dos, una rama con unos días encima aparece tocando ' +
      'media casa por lo que avanzó main',
  );
});

// ── 6. El job no puede salir en rojo ─────────────────────────────────────────────────────
//
// Aprendido en el propio PR de este ticket: el job salió ROJO y eso lo invalidaba entero. Un
// check rojo es un gate de facto, y `tests/`, `package.json` y `.github/` son zona roja por
// definición → rojo casi permanente, justo lo que se evitó con el CI y la tanda gateada.
// **Si sale rojo, no es un aviso.** Fueron dos errores distintos y cada uno tiene su assert:
//
//   · BUG — `git fetch --depth=0` no existe (`fatal: depth 0 is not a positive number`,
//     exit 128). El paso moría antes de ejecutar el detector: el job nunca llegó a mirar.
//   · CONCEPTO — `continue-on-error: true` a nivel de job NO evita el rojo; solo evita que
//     falle el WORKFLOW. El check sigue con su aspa. Confiar en él era confiar en algo que no
//     hace lo que su nombre sugiere.

// Solo las líneas EJECUTABLES del workflow: fuera los comentarios (YAML y shell).
//
// Hace falta por una razón que este mismo fichero se ganó a pulso: la primera versión de estos
// asserts miraba el YAML entero y salió ROJA porque los literales `--depth=0` y
// `continue-on-error` aparecen en la CABECERA, en la prosa que explica por qué no se usan.
// Es, calcado, el bug de SCRUM-176 —un guard que inspecciona texto falla justo en los
// documentos que describen la acción peligrosa— cometido el mismo día, en el ticket de al
// lado, por quien acababa de arreglarlo. Documentar mejor la regla no puede costar más rojos.
const soloCodigo = (yaml) =>
  yaml
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .join('\n');

test('SCRUM-168 · el job no puede terminar en fallo', () => {
  const wf = soloCodigo(leer('.github', 'workflows', 'zona-roja.yml'));

  assert.ok(
    !/--depth=0/.test(wf),
    '🔴 ha vuelto `--depth=0`. No es un flag válido de git fetch: sale 128 y el paso muere ' +
      'ANTES de evaluar nada, dejando el check en rojo sin haber mirado si hay zona roja. ' +
      'Con `fetch-depth: 0` en el checkout la base ya está; no hace falta ningún fetch.',
  );
  assert.ok(
    !/^\s*set -e/m.test(wf) && !/set -euo/.test(wf),
    '🔴 `set -e` en este job significa que cualquier tropiezo lo pinta de rojo, y un aviso ' +
      'rojo es un gate. Los fallos se capturan a mano y se cuentan en el resumen.',
  );
  assert.ok(
    /exit 0\s*$/m.test(wf),
    '🔴 el paso debe terminar en `exit 0` explícito: es lo que garantiza el verde ahora que ' +
      'no se depende de continue-on-error (que no evitaba el rojo).',
  );
  assert.ok(
    !wf.includes('continue-on-error'),
    '🔴 `continue-on-error` da falsa tranquilidad: evita que falle el WORKFLOW, no que el job ' +
      'salga con el aspa roja en el PR. Si vuelve, alguien está confiando en él otra vez.',
  );
});

test('SCRUM-168 · si el aviso se rompe, lo dice en vez de callar', () => {
  const wf = soloCodigo(leer('.github', 'workflows', 'zona-roja.yml'));
  assert.ok(
    wf.includes('GITHUB_STEP_SUMMARY'),
    '🔴 sin resumen, un job verde que reventó por dentro se lee igual que uno que miró y no ' +
      'encontró nada. Verde no puede significar "no lo he comprobado".',
  );
  assert.ok(
    /no pudo evaluarse/.test(wf),
    '🔴 falta el camino de "no he podido comprobarlo": es el que impide que salir verde ' +
      'siempre degenere en un job mudo.',
  );
});
