// docs/master/evidencias/scrum1387b/verlo-caer.mjs — SCRUM-1387b · el test de SCRUM-1387, visto en ROJO.
//
//   node docs/master/evidencias/scrum1387b/verlo-caer.mjs
//
// ⚠️ PIDE EL ÁRBOL LIMPIO Y COMITEADO (lo comprueba y, si no, no arranca): siembra ficheros, hace UN
// commit de prueba que deshace con `reset --soft`, y clona el repositorio en superficial a un temporal.
// Al acabar comprueba que `HEAD` y `git status` son los del principio.
//
// Las mutaciones NO son una lista propia: se leen de `MUTACIONES_QUE_ME_TUMBAN` del test, con el
// lector del meta-guard (`mutacionesDeclaradas`).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { mutacionesDeclaradas } from '../../../../scripts/meta-guard-mutaciones.mjs';
import { leerFicherosDeMutacion, clasificar, leerHistoria, juicio, corteDe } from '../../../../tests/_catalogo-obligatorio.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const TEST = 'tests/scrum1387-banco-nuevo-va-al-catalogo.test.mjs';
const CASO_DEL_ARBOL = 'en el árbol: ningún banco de mutación nuevo queda fuera del catálogo';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1387b-'));
// SCRUM-1387c: el temporal se borra SALGA POR DONDE SALGA. Este guion tiene tres salidas que no llegan
// al final —los dos «NO ARRANCO» (`process.exit(2)`) y cualquier `git` que lance— y un `finally` no
// cubre un `process.exit`. Dentro puede haber un clon entero del repositorio. No se traga el error:
// si no se puede borrar, que se vea.
process.on('exit', () => fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 3 }));
const git =(args, cwd = RAIZ) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/** Corre el test en `raiz` con el entorno limpio. Devuelve `{ pasan, caen, caidos: [nombre], tap }`. */
function correr(raiz = RAIZ) {
  const salida = path.join(TMP, `pasada-${Date.now()}-${Math.random().toString(36).slice(2)}.tap`);
  const env = { ...process.env };
  for (const k of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'FORCE_COLOR']) delete env[k];
  spawnSync(process.execPath, ['--test', '--test-reporter=tap', `--test-reporter-destination=${salida}`, TEST],
    { cwd: raiz, env, encoding: 'utf8' });
  const tap = fs.existsSync(salida) ? fs.readFileSync(salida, 'utf8') : '';
  const n = (k) => Number((tap.match(new RegExp(`^# ${k} (\\d+)`, 'm')) || [])[1] ?? NaN);
  const caidos = tap.split('\n').filter((l) => /^not ok \d+ - /.test(l)).map((l) => l.replace(/^not ok \d+ - /, ''));
  return { pasan: n('pass'), caen: n('fail'), total: n('tests'), caidos, tap };
}

const filas = [];
let fallos = 0;
function fila(nombre, esperado, r, cumple, detalle = '') {
  if (!cumple) fallos += 1;
  filas.push(`${cumple ? 'OK ' : 'MAL'} | ${nombre.padEnd(34)} | ${esperado.padEnd(46)} | ${r.total} casos · ${r.pasan} pasan · ${r.caen} caen${detalle ? ' | ' + detalle : ''}`);
}
const caeElDelArbol = (r) => r.caidos.some((c) => c.includes(CASO_DEL_ARBOL));

// ── antes de nada: árbol limpio y comiteado ─────────────────────────────────────────────────────
const HEAD0 = git(['rev-parse', 'HEAD']);
const estado0 = git(['status', '--porcelain']);
console.log(`HEAD ${HEAD0} · git status: ${estado0 ? estado0.split('\n').length + ' líneas' : 'limpio'}`);
if (estado0) { console.log('NO ARRANCO: el árbol no está limpio. Comitea antes (los instrumentos se comitean antes de tocarlos).'); process.exit(2); }
const h0 = leerHistoria(RAIZ);
const corte0 = corteDe(h0);
console.log(`corte: ${corte0 ? `${corte0.sha} (pos ${corte0.pos} de ${h0.commits})` : 'el fichero del corte NO está en ningún commit'}`);
if (!corte0) { console.log('NO ARRANCO: sin corte comiteado la fila COMITEADO no mediría nada.'); process.exit(2); }

// ── BASE ───────────────────────────────────────────────────────────────────────────────────────
const base = correr();
fila('BASE', 'todo pasa', base, base.caen === 0 && base.pasan === base.total && base.total > 0);
const pob = (base.tap.match(/^# (población: .*)$/m) || [])[1];
console.log(pob || 'CIEGO: la pasada BASE no ha dicho su población');
if (!pob) fallos += 1;

// ── las mutaciones declaradas en el test ─────────────────────────────────────────────────────────
const declaradas = mutacionesDeclaradas(fs.readFileSync(path.join(RAIZ, TEST), 'utf8'), TEST);
console.log(`mutaciones declaradas en el test: ${declaradas.length}`);
if (declaradas.length === 0) fallos += 1;
declaradas.forEach((m, i) => {
  const abs = path.join(RAIZ, m.fichero);
  const antes = fs.readFileSync(abs, 'utf8');
  const veces = antes.split(m.de).length - 1;
  const mutado = antes.replace(m.de, () => m.a);
  fs.writeFileSync(abs, mutado);
  const aplicada = fs.readFileSync(abs, 'utf8') !== antes && git(['diff', '--numstat', '--', m.fichero]) !== '';
  let r;
  try { r = correr(); } finally { fs.writeFileSync(abs, antes); }
  const restaurada = fs.readFileSync(abs, 'utf8') === antes && git(['status', '--porcelain']) === '';
  const cae = r.caidos.some((c) => c.includes(m.cae));
  fila(`M${i + 1} «${m.a}»`, `cae «${m.cae.slice(0, 40)}…»`, r, veces === 1 && aplicada && cae && restaurada,
    `ancla ${veces} vez · aplicada ${aplicada} · restaurada ${restaurada} · caen: ${r.caidos.length}`);
});

// ── SIEMBRA EN DISCO, sin comitear ───────────────────────────────────────────────────────────────
const SEMBRADA = 'docs/master/evidencias/__sembrado-1387b__';
const guion = `${SEMBRADA}/mutar-sembrado.mjs`;
fs.mkdirSync(path.join(RAIZ, SEMBRADA), { recursive: true });
try {
  fs.writeFileSync(path.join(RAIZ, guion), 'const LISTA_PROPIA = [{ de: "a", a: "b" }];\n');
  let r = correr();
  fila('SEMBRADO sin comitear', 'cae el del árbol y nombra carpeta y guion', r,
    r.caen === 1 && caeElDelArbol(r) && r.tap.includes(`${SEMBRADA} → ${guion}`));

  // ── SIEMBRA COMITEADA: es lo que ve el CI de un PR que mete un banco nuevo ────────────────────
  git(['add', '--', guion]);
  git(['commit', '-q', '-m', 'wip: siembra de prueba de scrum1387b (se deshace)']);
  try {
    const h = leerHistoria(RAIZ);
    const a = h.altas.get(guion);
    r = correr();
    fila('SEMBRADO y COMITEADO', 'cae el del árbol y nombra carpeta y guion', r,
      r.caen === 1 && caeElDelArbol(r) && r.tap.includes(`${SEMBRADA} → ${guion}`) && a && a.pos > corte0.pos,
      `alta del sembrado pos ${a ? a.pos : '—'} · corte pos ${corte0.pos}`);

    // ── CLON SUPERFICIAL de ese mismo commit: tiene que decir CIEGO, no verde ───────────────────
    const clon = path.join(TMP, 'clon');
    git(['clone', '--quiet', '--depth', '1', '--no-local', '--branch', git(['rev-parse', '--abbrev-ref', 'HEAD']), pathToFileURL(RAIZ).href, clon]);
    const superficial = git(['rev-parse', '--is-shallow-repository'], clon);
    r = correr(clon);
    fila('CLON SUPERFICIAL (con el sembrado)', 'cae el del árbol diciendo CIEGO', r,
      superficial === 'true' && r.caen === 1 && caeElDelArbol(r) && /CIEGO: no puedo leer la historia/.test(r.tap),
      `superficial=${superficial}`);
  } finally {
    git(['reset', '--soft', 'HEAD~1']);
    git(['restore', '--staged', '--', guion]);
  }

  // ── el mismo guion, ya DENTRO: nombra el catálogo ──────────────────────────────────────────────
  fs.writeFileSync(path.join(RAIZ, guion), 'import { MUTACIONES_QUE_ME_TUMBAN } from "../../../../tests/x.test.mjs";\n');
  r = correr();
  fila('SEMBRADO que toma las del test', 'vuelve a pasar', r, r.caen === 0 && r.pasan === base.total);

  // ── sólo una salida, sin guion ──────────────────────────────────────────────────────────────────
  fs.rmSync(path.join(RAIZ, guion));
  fs.writeFileSync(path.join(RAIZ, `${SEMBRADA}/salida-mutada.txt`), 'x\n');
  r = correr();
  fila('SEMBRADO sólo con salidas', 'pasa', r, r.caen === 0 && r.pasan === base.total);
} finally {
  fs.rmSync(path.join(RAIZ, SEMBRADA), { recursive: true, force: true });
}

// ── A UN HEREDADO le entra un guion nuevo ────────────────────────────────────────────────────────
{
  const h = leerHistoria(RAIZ);
  const { fuera } = clasificar(leerFicherosDeMutacion(RAIZ));
  const { heredados } = juicio({ fuera, altaDe: (x) => h.altas.get(x), corte: corte0.pos });
  const victima = heredados[0];
  const nuevo = `${victima.carpeta}/mutar-sembrado-1387b.mjs`;
  fs.writeFileSync(path.join(RAIZ, nuevo), 'const OTRA_LISTA = [];\n');
  let r;
  try { r = correr(); } finally { fs.rmSync(path.join(RAIZ, nuevo)); }
  const linea = `${victima.carpeta} → ${nuevo}`;
  fila('HEREDADO + guion nuevo', 'cae y nombra SÓLO el guion nuevo', r,
    r.caen === 1 && caeElDelArbol(r) && r.tap.includes(linea) && !victima.guiones.some((g) => r.tap.includes(`→ ${g}`)),
    `heredado usado: ${victima.carpeta} (${heredados.length} heredados)`);
}

// ── después: todo como estaba ─────────────────────────────────────────────────────────────────────
const fin = correr();
fila('DESPUÉS', 'todo pasa, como la BASE', fin, fin.caen === 0 && fin.pasan === base.total);
const HEAD1 = git(['rev-parse', 'HEAD']);
const estado1 = git(['status', '--porcelain']);
console.log('');
for (const f of filas) console.log(f);
console.log(`\nárbol después: HEAD ${HEAD1 === HEAD0 ? 'igual' : '🔴 DISTINTO ' + HEAD1} · git status ${estado1 ? '🔴 ' + estado1 : 'limpio'}`);
if (HEAD1 !== HEAD0 || estado1) fallos += 1;
fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 3 });
const quedaElTemporal = fs.existsSync(TMP);
console.log(`temporal ${quedaElTemporal ? '🔴 SIGUE EN DISCO: ' + TMP : 'borrado'}`);
if (quedaElTemporal) fallos += 1;
console.log(`filas ${filas.length} · mal ${fallos}`);
console.log(`EXIT=${fallos ? 1 : 0}`);
process.exit(fallos ? 1 : 0);
