// scripts/puerta-claude-empuje.mjs — SCRUM-1263 · si lo despertó el AVISADOR, solo se empuja en VERDE
//
// QUÉ PASÓ, medido (PR #1944, 28-sep-2026): el avisador despertó a Claude por `scrum525d` en rojo.
// Claude empujó `6787a7f0` —«:848 -> :847, donde está la marca», y `:847` es una línea en blanco— y
// se fue. El guard SIGUIÓ ROJO; lo cazó J5 midiendo en local. Si aquel arreglo malo hubiera puesto
// el guard en verde por accidente, `yaqu-bot` lo mergea y nadie lo mira.
//
// POR QUÉ NO PODÍA COMPROBARLO ÉL: dentro de `claude-code-action@v1` Claude solo tiene `git add`,
// `git commit`, `git rm` y el envoltorio de push. No puede correr `node`. Empujaba a ciegas por
// construcción, no por descuido. Así que la comprobación no se le PIDE: la hace el workflow.
//
// DECISIÓN DEL FUNDADOR (opción C, SCRUM-1263): solo se empuja si el guard por el que se le despertó
// está VERDE; si sigue rojo, se comenta lo intentado y NO se empuja. Y (com. 17458) después de
// empujar se comprueba que el push DISPARÓ el check obligatorio; si no, se dice en el PR.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// EL MECANISMO, en tres piezas:
//
//   gancho    Antes de la acción, un `pre-push` enganchado por `core.hooksPath` GLOBAL. El envoltorio
//             de la acción solo acepta `origin <ref>` sin flags (no hay `--no-verify`), así que el
//             push de Claude se para siempre, y el mensaje le dice por qué.
//   decidir   Después, ¿hay commits nuevos? ¿Qué test cayó en el run que nombra el aviso (se lee su
//             LOG, no se supone)? ¿Ese MISMO test, por NOMBRE, sale `ok` sobre el árbol de Claude?
//             Solo entonces se empuja. Un test SALTADO no es verde. No poder leer algo no es verde.
//   disparo   Tras el push, ¿aparece el check obligatorio sobre el sha nuevo? Si no, PR MUDO, y se
//             dice — con la causa que más a menudo lo explica (conflicto con main, com. 17460).
//
// Lo que NO cambia: si a Claude lo despierta una PERSONA, no hay guard que comprobar y el push sale
// como hoy (lo hace el workflow en su nombre).
//
// 🔴 `claude.yml` ejecuta la copia de MAIN de este fichero (`git show origin/main:`), nunca la del
// checkout: el checkout trae el código del PR, y ejecutarlo es ejecutar lo que escribió quien comenta.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { BOT, cuerpoNoDebeDespertar } from './puerta-avisador-rojo.mjs';

// ── ¿QUIÉN LO DESPERTÓ? ─────────────────────────────────────────────────────────────────────────
/** La marca que deja el avisador al final de su comentario (avisador-rojo.yml): `sha:check`. */
const RE_MARCA = /<!-- avisador-rojo:([0-9a-f]{7,40}):([^\n]+?) -->/;
const RE_RUN = /\/actions\/runs\/(\d+)/;

/**
 * Es el avisador si lo dice el BOT y lleva su marca. La marca en boca de otro no cuenta, y el bot sin
 * marca tampoco (con la llave de la App, la propia respuesta de Claude sale como `yaqu-bot[bot]`).
 * @returns {{avisador:false} | {avisador:true, runId:string|null, check:string}}
 */
export function leerDespertar({ autor, cuerpo } = {}) {
  const texto = String(cuerpo || '');
  const m = texto.match(RE_MARCA);
  if (autor !== BOT || !m) return { avisador: false };
  const run = texto.match(RE_RUN);
  return { avisador: true, runId: run ? run[1] : null, check: m[2].trim() };
}

// ── ¿QUÉ CAYÓ? — del log del job rojo ─────────────────────────────────────────────────────────
const limpiar = (l) => l.replace(/\x1b\[[0-9;]*m/g, '').replace(/^﻿/, '')
  .replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z ?/, '').replace(/\r$/, '');

/** `file:///…/tests/x.test.mjs` o `tests\x.test.mjs` → `tests/x.test.mjs`. `null` si no es de tests/. */
export function normalizarFichero(f) {
  const s = String(f || '').replace(/\\/g, '/');
  const i = s.lastIndexOf('/tests/');
  const rel = s.startsWith('tests/') ? s : i >= 0 ? s.slice(i + 1) : null;
  return rel && /^tests\/[\w.\-/]+\.test\.mjs$/.test(rel) && !rel.includes('..') ? rel : null;
}

/**
 * Los tests que cayeron, sacados del resumen de `node --test` (spec) en el log del job:
 *
 *     ℹ fail 1
 *     ✖ failing tests:
 *     test at tests/scrum525d-anclas-que-apuntan.test.mjs:180:1
 *     ✖ SCRUM-525d · 🔴 TRINQUETE: ninguna coordenada NUEVA sin testigo (1.386278ms)
 *
 * Falla CERRADO: sin resumen, con `fail 0` (el rojo no es de un test), o si los que se leen no son
 * tantos como dice el resumen, sale `ciego` — no se sabe qué comprobar, y eso no es «nada que comprobar».
 */
export function fallosDelLog(texto) {
  const lineas = String(texto || '').split('\n').map(limpiar);
  let n = null;
  let desde = -1;
  lineas.forEach((l, i) => {
    const f = l.match(/^ℹ fail (\d+)\s*$/);
    if (f) n = Number(f[1]);
    if (/^✖ failing tests:\s*$/.test(l)) desde = i;
  });
  if (n === null) return { ciego: true, motivo: 'el log no trae el resumen de `node --test`: el job cayó antes de los tests, o no se pudo leer', fallos: [] };
  if (n === 0) return { ciego: true, motivo: 'el log dice 0 tests fallidos: el rojo no es de un test, y no hay guard que comprobar', fallos: [] };
  if (desde < 0) return { ciego: true, motivo: `el log dice ${n} fallido(s) y no trae la lista «failing tests»`, fallos: [] };

  const fallos = [];
  for (let i = desde + 1; i < lineas.length; i++) {
    const at = lineas[i].match(/^test at (.+?):\d+:\d+\s*$/);
    if (!at) continue;
    let j = i + 1;
    while (j < lineas.length && lineas[j].trim() === '') j++;
    const nom = (lineas[j] || '').match(/^✖ (.+?) \([\d.]+m?s\)\s*$/);
    const fichero = normalizarFichero(at[1]);
    if (!nom || !fichero) return { ciego: true, motivo: `no sé leer el fallo de la línea «${lineas[i]}»`, fallos: [] };
    if (!fallos.some((f) => f.fichero === fichero && f.nombre === nom[1])) fallos.push({ fichero, nombre: nom[1] });
  }
  if (fallos.length !== n) {
    return { ciego: true, motivo: `el resumen dice ${n} fallido(s) y se leen ${fallos.length}: no se comprueba sobre una lista incompleta`, fallos: [] };
  }
  return { ciego: false, motivo: `${n} test(s) cayeron en el run`, fallos };
}

// ── ¿Y SOBRE EL ÁRBOL DE CLAUDE? — por NOMBRE, del TAP ───────────────────────────────────────────
const desescapar = (s) => s.replace(/\\(.)/g, (_, c) => (c === 'n' ? '\n' : c));

/** Cada `ok`/`not ok` del TAP de node, con su nombre desescapado y su directiva (SKIP/TODO). */
export function leerTap(texto) {
  const r = [];
  for (const cruda of String(texto || '').split('\n')) {
    const m = cruda.replace(/\r$/, '').match(/^\s*(not ok|ok) \d+ - (.*)$/);
    if (!m) continue;
    const partes = m[2].split(/(?<!\\) # /);
    const dir = partes.length > 1 ? (partes[1].match(/^(SKIP|TODO)\b/i) || [])[1] : null;
    r.push({ ok: m[1] === 'ok', nombre: desescapar(partes[0].trim()), directiva: dir ? dir.toUpperCase() : null });
  }
  return r;
}

/**
 * Para cada test que cayó en el CI, su estado sobre el árbol de Claude:
 *   VERDE       sale `ok`, sin SKIP ni TODO
 *   ROJO        sale `not ok`
 *   SIN-CORRER  no aparece, se saltó, o no hubo pasada — NO es verde
 * Si lo que cayó fue el FICHERO entero (su nombre es la ruta), vale el resumen del fichero.
 */
export function veredictoLocal(fallos, taps = {}) {
  return (fallos || []).map(({ fichero, nombre }) => {
    const tap = taps ? taps[fichero] : null;
    if (!tap) return { fichero, nombre, estado: 'SIN-CORRER' };
    const filas = leerTap(tap);
    if (normalizarFichero(nombre) === fichero) {
      const fail = Number((tap.match(/^# fail (\d+)/m) || [])[1]);
      const pass = Number((tap.match(/^# pass (\d+)/m) || [])[1]);
      const estado = !Number.isFinite(fail) || !Number.isFinite(pass) ? 'SIN-CORRER' : fail > 0 ? 'ROJO' : pass > 0 ? 'VERDE' : 'SIN-CORRER';
      return { fichero, nombre, estado };
    }
    const suyas = filas.filter((f) => f.nombre === nombre);
    if (suyas.length === 0) return { fichero, nombre, estado: 'SIN-CORRER' };
    if (suyas.some((f) => !f.ok && !f.directiva)) return { fichero, nombre, estado: 'ROJO' };
    if (suyas.every((f) => f.ok && !f.directiva)) return { fichero, nombre, estado: 'VERDE' };
    return { fichero, nombre, estado: 'SIN-CORRER' };
  });
}

// ── LA DECISIÓN ─────────────────────────────────────────────────────────────────────────────────
/**
 * @returns {{codigo:string, empujar:boolean, declarar:boolean, motivo:string}}
 */
export function decidirEmpuje({ despertar, commitsNuevos, diagnostico, local } = {}) {
  const ciego = (motivo) => ({ codigo: 'NO-EMPUJA-CIEGO', empujar: false, declarar: true, motivo });
  if (commitsNuevos === 0) return { codigo: 'NADA-QUE-EMPUJAR', empujar: false, declarar: false, motivo: 'Claude no dejó commits nuevos' };
  if (!Number.isInteger(commitsNuevos) || commitsNuevos < 0) return ciego('no se sabe si Claude dejó commits: no se empuja a ciegas');
  if (!despertar || despertar.avisador !== true) {
    return { codigo: 'SIN-GUARD-QUE-COMPROBAR', empujar: true, declarar: false, motivo: 'lo despertó una persona, no el avisador: se empuja como siempre' };
  }
  if (!despertar.runId) return ciego('el aviso no dice qué run cayó: no se sabe qué guard comprobar');
  if (!diagnostico || diagnostico.ciego) return ciego(diagnostico ? diagnostico.motivo : 'no se pudo leer el log del run rojo');
  const esperados = diagnostico.fallos || [];
  if (!Array.isArray(local) || local.length !== esperados.length || esperados.length === 0) {
    return ciego('la pasada local no cubre todos los tests que cayeron');
  }
  const rojos = local.filter((l) => l.estado === 'ROJO');
  if (rojos.length) {
    return { codigo: 'NO-EMPUJA-SIGUE-ROJO', empujar: false, declarar: true, motivo: `con el arreglo de Claude sigue(n) en ROJO: ${rojos.map((l) => l.nombre).join(' · ')}` };
  }
  const sin = local.filter((l) => l.estado !== 'VERDE');
  if (sin.length) return ciego(`no se pudo ver en verde (saltado o no corrió): ${sin.map((l) => l.nombre).join(' · ')}`);
  return { codigo: 'EMPUJA-GUARD-VERDE', empujar: true, declarar: false, motivo: `el/los guard(s) que cayeron salen en VERDE sobre el arreglo: ${local.map((l) => l.nombre).join(' · ')}` };
}

const LIMITE_PARCHE = 50000;
const valla = (texto) => {
  let n = 3;
  for (const m of String(texto).matchAll(/`{3,}/g)) n = Math.max(n, m[0].length + 1);
  return '`'.repeat(n);
};

/** El comentario cuando NO se empuja. Nunca lleva la mención: despertaría a Claude otra vez. */
export function cuerpoSinEmpuje({ numero, decision, local, parche, urlRun } = {}) {
  const filas = (local || []).map((l) => `| \`${l.fichero}\` | ${l.nombre.replace(/\|/g, '\\|')} | **${l.estado}** |`);
  const p = String(parche || '');
  let bloqueParche;
  if (!p.trim()) bloqueParche = '_No hay parche que enseñar._';
  else if (!cuerpoNoDebeDespertar(p)) bloqueParche = '_El parche contiene la mención al bot y no se copia aquí (despertaría otra ejecución): está en el artefacto `parche-claude` del run._';
  else if (p.length > LIMITE_PARCHE) bloqueParche = `_El parche ocupa ${p.length} caracteres y no cabe en un comentario: está en el artefacto \`parche-claude\` del run._`;
  else bloqueParche = `<details><summary>Parche propuesto (sin aplicar)</summary>\n\n${valla(p)}diff\n${p}${p.endsWith('\n') ? '' : '\n'}${valla(p)}\n\n</details>`;
  const texto = [
    `🔴 **No empujo mi arreglo a este PR** (#${numero}) — SCRUM-1263 · \`${decision.codigo}\`.`,
    '',
    decision.motivo,
    '',
    'Me despertó el avisador por un guard en rojo. Antes de empujar se corre ese mismo guard sobre mi arreglo, y solo se empuja si sale en VERDE. No ha salido, así que la rama queda como estaba.',
    '',
    ...(filas.length ? ['| Fichero | Test | Sobre mi arreglo |', '| --- | --- | --- |', ...filas, ''] : []),
    'Quien lleve la rama puede mirar el parche, arreglarlo y empujarlo.',
    '',
    bloqueParche,
    '',
    `Run: ${urlRun || '(sin enlace)'}`,
  ].join('\n');
  return texto;
}

// ── 17458 · ¿EL PUSH DISPARÓ CI? ────────────────────────────────────────────────────────────────
/**
 * Sobre el sha empujado, ¿aparecen TODOS los checks obligatorios? No poder leer los check-runs o las
 * reglas es NO-SE-PUDO-MIRAR, y también se declara: no mirar no es «disparó».
 */
export function decidirDisparo({ checkRuns, obligatorios, estadoFusion } = {}) {
  if (!Array.isArray(checkRuns) || !Array.isArray(obligatorios) || obligatorios.length === 0) {
    return { codigo: 'NO-SE-PUDO-MIRAR', declarar: true, motivo: 'no se pudieron leer los check-runs del sha o los checks obligatorios de main: no se sabe si el push disparó CI' };
  }
  const faltan = obligatorios.filter((o) => !checkRuns.some((c) => c && c.name === o));
  if (faltan.length === 0) return { codigo: 'DISPARO-CI', declarar: false, motivo: 'el check obligatorio ya corre sobre el sha empujado' };
  const causa = String(estadoFusion || '').toLowerCase() === 'dirty'
    ? 'El PR está en CONFLICTO con main: sin fusión de prueba, los flujos `pull_request` no arrancan (fue la causa medida en #1943, SCRUM-1263 com. 17460). Se desatasca resolviendo el conflicto; cerrar y reabrir NO sirve.'
    : `Sin conflicto a la vista (estado de fusión: ${estadoFusion || 'desconocido'}): el push no ha creado ejecuciones y no sé por qué.`;
  return { codigo: 'PR-MUDO', declarar: true, motivo: `sobre el sha empujado no aparece: ${faltan.join(' · ')}. ${causa}` };
}

export function cuerpoMudo({ numero, sha, decision, urlRun } = {}) {
  return [
    `🔇 **Empujé \`${String(sha || '').slice(0, 12)}\` a este PR (#${numero}) y el CI no ha arrancado** — SCRUM-1263 · \`${decision.codigo}\`.`,
    '',
    decision.motivo,
    '',
    'Un PR sin CI no está ni verde ni rojo: está MUDO, y el avisador no lo ve. Lo digo para que no se quede aquí enterrado.',
    '',
    `Run: ${urlRun || '(sin enlace)'}`,
  ].join('\n');
}

// ── EL GANCHO ───────────────────────────────────────────────────────────────────────────────────
export const GANCHO_PRE_PUSH = [
  '#!/bin/sh',
  '# SCRUM-1263 · instalado por claude.yml cuando despierta el avisador. Para TODO push desde la acción.',
  'echo "SCRUM-1263: este push no sale desde aquí. Deja el commit en local: el paso siguiente del workflow corre el guard que cayó sobre tu arreglo y empuja SOLO si sale en VERDE; si no, publica tu parche en el PR." >&2',
  'exit 1',
  '',
].join('\n');

export function escribirGancho(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, 'pre-push');
  fs.writeFileSync(f, GANCHO_PRE_PUSH, { mode: 0o755 });
  fs.chmodSync(f, 0o755);
  return f;
}

// ── LA PASADA LOCAL ─────────────────────────────────────────────────────────────────────────────
/**
 * Corre cada fichero que cayó, en `arbol`, con TAP a `dirTaps`. Devuelve `{fichero: textoTap|null}`.
 * `env` lo decide quien llama: el workflow lo pasa SIN credenciales.
 */
export function pasadaLocal({ arbol, fallos, dirTaps, env = process.env, timeoutMs = 10 * 60 * 1000 }) {
  fs.mkdirSync(dirTaps, { recursive: true });
  const taps = {};
  const ficheros = [...new Set((fallos || []).map((f) => f.fichero))];
  ficheros.forEach((fichero, i) => {
    const destino = path.join(dirTaps, `${i}.tap`);
    spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-reporter=tap', `--test-reporter-destination=${destino}`, fichero],
      { cwd: arbol, env, stdio: 'ignore', timeout: timeoutMs });
    taps[fichero] = fs.existsSync(destino) ? fs.readFileSync(destino, 'utf8') : null;
  });
  return taps;
}

// ── CLI ─────────────────────────────────────────────────────────────────────────────────────────
function leerStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const modo = process.argv[2];

  if (modo === 'gancho') {
    const dir = process.argv[3];
    if (!dir) { console.error('falta el directorio'); process.exit(2); }
    console.log(escribirGancho(dir));
    process.exit(0);
  }

  if (modo === 'despertar') {
    let e; try { e = JSON.parse(leerStdin()); } catch { e = {}; }
    const d = leerDespertar(e);
    console.log(`avisador=${d.avisador ? 'si' : 'no'}`);
    console.log(`run=${d.runId || ''}`);
    process.exit(0);
  }

  if (modo === 'fallos') {
    process.stdout.write(JSON.stringify(fallosDelLog(leerStdin())));
    process.exit(0);
  }

  if (modo === 'decidir') {
    // stdin: {despertar, commitsNuevos, diagnostico, arbol, dirTaps, numero, urlRun, ficheroParche}
    let e;
    try { e = JSON.parse(leerStdin()); } catch {
      console.log('NO-EMPUJA-CIEGO'); console.log('no se pudo leer el JSON de entrada: no se empuja'); process.exit(1);
    }
    let local = null;
    const verificable = e.despertar && e.despertar.avisador === true && Number.isInteger(e.commitsNuevos) && e.commitsNuevos > 0
      && e.diagnostico && !e.diagnostico.ciego && e.arbol && e.dirTaps;
    if (verificable) {
      // Sin credenciales: este proceso ejecuta los tests del PR.
      const env = { PATH: process.env.PATH, HOME: process.env.HOME, CI: 'true', FORCE_COLOR: '0' };
      local = veredictoLocal(e.diagnostico.fallos, pasadaLocal({ arbol: e.arbol, fallos: e.diagnostico.fallos, dirTaps: e.dirTaps, env }));
    }
    const d = decidirEmpuje({ despertar: e.despertar, commitsNuevos: e.commitsNuevos, diagnostico: e.diagnostico, local });
    const cuerpo = process.env.CUERPO;
    if (d.declarar && cuerpo) {
      let parche = '';
      try { parche = e.ficheroParche ? fs.readFileSync(e.ficheroParche, 'utf8') : ''; } catch { parche = ''; }
      fs.writeFileSync(cuerpo, cuerpoSinEmpuje({ numero: e.numero, decision: d, local, parche, urlRun: e.urlRun }));
    }
    console.log(d.codigo);
    console.log(d.motivo);
    process.exit(d.empujar ? 0 : 1);
  }

  if (modo === 'disparo') {
    let e; try { e = JSON.parse(leerStdin()); } catch { e = {}; }
    const d = decidirDisparo(e);
    if (d.declarar && process.env.CUERPO) fs.writeFileSync(process.env.CUERPO, cuerpoMudo({ numero: e.numero, sha: e.sha, decision: d, urlRun: e.urlRun }));
    console.log(d.codigo);
    console.log(d.motivo);
    process.exit(d.declarar ? 1 : 0);
  }

  console.log('MODO-DESCONOCIDO');
  console.log(`modo «${modo}»: se esperaba gancho, despertar, fallos, decidir o disparo`);
  process.exit(2);
}
