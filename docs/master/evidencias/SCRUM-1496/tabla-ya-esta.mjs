#!/usr/bin/env node
// docs/master/evidencias/SCRUM-1496/tabla-ya-esta.mjs · J3 (equipo de Javier), 7-oct-2026
//
// LA FOTO DE UN LOTE DE TICKETS, EN UNA TABLA: commits | PR mergeado | registro | VEREDICTO.
//
//   node docs/master/evidencias/SCRUM-1496/tabla-ya-esta.mjs --jira foto.tsv     (TSV: clave<TAB>estado<TAB>…)
//   node docs/master/evidencias/SCRUM-1496/tabla-ya-esta.mjs 1304 1315 1316      (o los números a mano)
//   … --control 9999      el número INVENTADO que tiene que salir a cero (por defecto 9999)
//   … --lineas fichero    escribe ahí TODAS las líneas citadas de los registros (TSV)
//   … --ref <sha>         mide contra ese commit y no contra `origin/main` (para REPETIR una medición)
//
// VIVE AQUÍ Y NO EN `scripts/equipo/` porque esa carpeta es del carril S5 (`dos-equipos.md` §3): J3 no
// escribe ahí. Si se quiere al lado de `ya-esta.mjs`, se le pide a su dueña por Jira.
//
// ES UNA CAPA, NO UN MOTOR. «¿Qué hay en `main` de un ticket?» ya lo contesta la casa y aquí se LLAMA:
//   · `mirar` (`scripts/equipo/ya-esta.mjs`, SCRUM-1424/1454): los commits SUYOS (los que llevan su
//     número por delante, no los de otro ticket que lo citan), su registro leído de `origin/main`, sus
//     ramas, y qué no se pudo mirar. Debajo van `censarTicket` (SCRUM-388) y SCRUM-1259;
//   · `numeroDeRama` (`scripts/_numero-de-rama.mjs`, SCRUM-829): de qué ticket es una rama.
// Lo único que añade:
//   ① la columna «PR mergeado», que `ya-esta` no tiene (no llama a `gh`), por DOS sondas: los PR
//     mergeados que da `gh` y lo que dejó el merge en la primera línea de `main` («Merge pull request
//     #N from …/rama», o «SCRUM-N: … (#N)» si entró aplastado). Si discrepan, sale dicho: la
//     discrepancia es el dato;
//   ② las líneas del registro que dicen NO HECHO / falta / pendiente / sin medir / decisión, CITADAS;
//   ③ la forma: una fila por ticket, y el número inventado de control dentro de la misma pasada.
//
// TRES VEREDICTOS, y el tercero no se mezcla con el primero:
//   ALGO EN MAIN        al menos una de las tres columnas dice que sí
//   NADA EN MAIN        las tres a cero, y las tres se pudieron mirar
//   NO HE PODIDO MIRAR  ninguna dice que sí y alguna no contestó
// «ALGO EN MAIN» NO es «hecho»: un ticket con partes puede tener sólo la primera. Se lee el enunciado.
//
// NO lee Jira (la foto se la pasa quien lo corre), no cierra, no transiciona, no escribe en el repo.
// Salidas: 0 se miró todo y el control salió a cero · 2 algo no se pudo mirar, o el control NO salió
// a cero (entonces el instrumento no mide y la tabla no vale).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ALGO = 'ALGO EN MAIN';
export const NADA = 'NADA EN MAIN';
export const NO_PUDE = 'NO HE PODIDO MIRAR';

/** Las cinco palabras del encargo. La frontera de delante es de LETRA Unicode: «falta» no es «asfalta». */
export const RE_QUEDA = /(?<![\p{L}\p{N}])(NO HECHO|falta|pendiente|sin medir|decisi[oó]n)/iu;

/** Pura. Las líneas de un registro que casan con `RE_QUEDA`, con su número de línea (desde 1). */
export function lineasQueQuedan(texto) {
  const out = [];
  String(texto || '').split(/\r?\n/).forEach((l, i) => {
    const m = RE_QUEDA.exec(l);
    if (m) out.push({ linea: i + 1, palabra: m[1].toLowerCase(), texto: l.trim() });
  });
  return out;
}

/** Pura. `Merge pull request #N from dueño/rama` → { pr, rama }, o `null`. */
export function prDelMerge(asunto) {
  const m = /^Merge pull request #(\d+) from [^/\s]+\/(\S+)/.exec(String(asunto || ''));
  return m ? { pr: Number(m[1]), rama: m[2] } : null;
}

/**
 * Pura. Un PR que entró APLASTADO no deja commit de merge: deja uno solo cuyo asunto acaba en «(#N)».
 * Medido el 7-oct-2026: #2112 (SCRUM-1341) entró así, y la sonda de los merges no lo veía.
 */
export function prDelAplastado(asunto) {
  const m = /\(#(\d+)\)\s*$/.exec(String(asunto || ''));
  return m ? { pr: Number(m[1]) } : null;
}

/**
 * Pura. El veredicto de una fila.
 * @param {{commits:number|null, pr:number|null, registro:number|null}} c  `null` = esa columna no contestó
 */
export function veredictoDeFila(c) {
  if ((c.commits || 0) > 0 || (c.pr || 0) > 0 || (c.registro || 0) > 0) return ALGO;
  if (c.commits === null || c.pr === null || c.registro === null) return NO_PUDE;
  return NADA;
}

function leerNumeros(argv) {
  const valor = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv.splice(i, 2)[1] : null; };
  const foto = valor('--jira');
  const control = valor('--control') || '9999';
  const lineas = valor('--lineas');
  const ref = valor('--ref') || 'origin/main';
  const estados = new Map();
  let nums = argv.filter((a) => /^(scrum-)?\d+$/i.test(a)).map((a) => Number(a.replace(/^scrum-/i, '')));
  if (foto) {
    for (const l of fs.readFileSync(foto, 'utf8').split(/\r?\n/)) {
      const [k, estado = ''] = l.split('\t');
      const m = /^SCRUM-(\d+)$/.exec(String(k).trim());
      if (m) { nums.push(Number(m[1])); estados.set(Number(m[1]), estado); }
    }
  }
  nums = [...new Set(nums)].sort((a, b) => a - b);
  return { nums, estados, control: Number(control), lineas, foto, ref };
}

async function principal(argv) {
  const { nums, estados, control, lineas, foto, ref } = leerNumeros(argv);
  if (nums.length === 0) { console.log(`🔴 ${NO_PUDE}: no hay ningún número de ticket que mirar.\n   uso: tabla-ya-esta.mjs --jira <foto.tsv> | <número> … [--control 9999] [--lineas salida.tsv]`); return 2; }
  if (nums.includes(control)) { console.log(`🔴 ${NO_PUDE}: el número de control (${control}) está entre los tickets a mirar: no es un control.`); return 2; }
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
  const { mirar, traerOrigen, duenoDelAsunto } = await import('../../../../scripts/equipo/ya-esta.mjs');
  const { numeroDeRama } = await import('../../../../scripts/_numero-de-rama.mjs');
  const { reMencion } = await import('../../../../scripts/abierto-con-trabajo-en-main.mjs');
  const git = (args) => {
    try { return execFileSync('git', ['-C', raiz, ...args], { encoding: 'utf8', maxBuffer: 1 << 28, timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch { return undefined; }
  };

  const previos = [traerOrigen(raiz)].filter(Boolean);
  // La referencia se resuelve UNA vez: todo lo de git se mide contra ESE commit aunque `main` se mueva
  // a mitad. `--ref <sha>` repite la medición sobre una base ya citada (lo de `gh` no se puede fijar:
  // para eso está la segunda sonda, que sí sale de ese commit).
  const main = (git(['rev-parse', '--verify', `${ref}^{commit}`]) || '').trim();
  if (!main) { console.log(`🔴 ${NO_PUDE}: \`${ref}\` no se resuelve en ${raiz}`); return 2; }

  // ── la columna «PR mergeado», por dos sondas ──────────────────────────────────────────────
  // ① `gh`: UNA llamada. `null` = no contestó (y entonces la columna es ciega por esa sonda).
  let deGh = null; let ghPor = '';
  const TOPE = 1000;
  try {
    const crudo = execFileSync('gh', ['pr', 'list', '--state', 'merged', '--base', 'main', '--limit', String(TOPE), '--json', 'number,title,headRefName,mergedAt'],
      { cwd: raiz, encoding: 'utf8', maxBuffer: 1 << 28, timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] });
    deGh = JSON.parse(crudo);
    if (!Array.isArray(deGh) || deGh.length === 0) { deGh = null; ghPor = 'gh contestó una lista vacía de PR mergeados: no es creíble'; }
  } catch (e) { ghPor = `gh no contestó: ${String(e && e.message).split('\n')[0].slice(0, 160)}`; }
  // ② la primera línea de `main`: local, entera, sin red. Un merge deja «Merge pull request #N from
  // …/rama» (el ticket sale de la RAMA); un PR aplastado, un commit «… (#N)» (sale de su asunto).
  const crudoMain = git(['log', main, '--first-parent', '--format=%H%x09%cs%x09%s']);
  const deMain = crudoMain === undefined ? null
    : crudoMain.split('\n').map((l) => {
      const [sha, fecha, asunto] = l.split('\t');
      const m = prDelMerge(asunto);
      if (m) return { pr: m.pr, ticket: numeroDeRama(m.rama), sha, fecha };
      const a = prDelAplastado(asunto);
      return a ? { pr: a.pr, ticket: duenoDelAsunto(asunto), sha, fecha } : null;
    }).filter(Boolean);
  if (deMain && deMain.length === 0) { console.log(`🔴 ${NO_PUDE}: la primera línea de \`main\` no nombra ni un PR: no es creíble`); return 2; }

  const prsDe = (n) => {
    const re = reMencion(n);
    const gh = deGh === null ? null : deGh.filter((p) => numeroDeRama(p.headRefName) === n).map((p) => p.number).sort((a, b) => a - b);
    const cita = deGh === null ? [] : deGh.filter((p) => numeroDeRama(p.headRefName) !== n && re.test(p.title)).map((p) => p.number).sort((a, b) => a - b);
    const mg = deMain === null ? null : deMain.filter((p) => p.ticket === n).map((p) => p.pr).sort((a, b) => a - b);
    return { gh, mg, cita };
  };

  const filas = [];
  const todasLasLineas = [];
  for (const n of [...nums, control]) {
    let res;
    try { res = await mirar(n, { raiz, ref: main, traer: false, ciegosPrevios: previos }); }
    catch (e) { res = { h: { ciegos: [`mirar() reventó: ${String(e && e.message).split('\n')[0]}`], registros: [], commits: [], commitsAjenos: [], ramasEnMain: [], ramasVivas: [] } }; }
    const h = res.h;
    // La segunda sonda de commits es el comando LITERAL del encargo: cuenta todo lo que casa con el texto.
    const literal = git(['log', main, '--oneline', `--grep=SCRUM-${n}`]);
    const nLiteral = literal === undefined ? null : literal.split('\n').filter(Boolean).length;
    const p = prsDe(n);
    const ciegoMotor = h.ciegos.length > 0;
    const quedan = [];
    for (const r of h.registros) {
      const texto = git(['show', `${main}:${r.fichero}`]);
      if (texto === undefined) { h.ciegos.push(`no se pudo leer ${r.fichero}`); continue; }
      for (const q of lineasQueQuedan(texto)) quedan.push({ fichero: r.fichero, ...q });
    }
    const unionPr = p.gh === null && p.mg === null ? null : [...new Set([...(p.gh || []), ...(p.mg || [])])].sort((a, b) => a - b);
    const cols = {
      commits: ciegoMotor && h.commits.length === 0 ? null : h.commits.length,
      pr: unionPr === null ? null : unionPr.length,
      registro: ciegoMotor && h.registros.length === 0 ? null : h.registros.length,
    };
    const notas = [];
    if (p.gh !== null && p.mg !== null && p.gh.join() !== p.mg.join()) notas.push(`PR: gh dice [${p.gh.map((x) => `#${x}`).join(' ')}] y los merges de main [${p.mg.map((x) => `#${x}`).join(' ')}]`);
    if (p.gh === null) notas.push('PR sólo por los merges de main (gh no contestó)');
    if (p.cita.length) notas.push(`PR de OTRA rama que lo nombra en el título: ${p.cita.map((x) => `#${x}`).join(' ')}`);
    if (nLiteral !== null && nLiteral !== h.commits.length) notas.push(`--grep literal: ${nLiteral}`);
    if ((h.commitsAjenos || []).length) notas.push(`${h.commitsAjenos.length} commit(s) de OTRO ticket lo citan`);
    for (const e of h.evidencias || []) notas.push(`evidencias: ${e.carpeta}/ (${e.ficheros})`);
    if (cols.registro === 0 && (h.citas || []).some((c) => /^docs\/master\/[^/]+\.md$/.test(c.fichero))) notas.push(`sin registro propio; lo nombran: ${h.citas.filter((c) => /^docs\/master\/[^/]+\.md$/.test(c.fichero)).map((c) => path.basename(c.fichero)).slice(0, 4).join(' ')}`);
    for (const r of h.ramasVivas || []) notas.push(`rama VIVA sin mergear: ${r.nombre} (+${r.adelanto})`);
    for (const c of h.ciegos) notas.push(`🔴 ${c}`);
    filas.push({ n, estado: estados.get(n) || '', cols, prs: unionPr, registros: h.registros.map((r) => r.fichero), quedan, notas, veredicto: veredictoDeFila(cols), esControl: n === control });
    for (const q of quedan) todasLasLineas.push([`SCRUM-${n}`, q.fichero, q.linea, q.palabra, q.texto.replace(/\t/g, ' ')].join('\t'));
  }

  // ── el control: el número inventado tiene que salir a cero en las tres, y MIRADO ───────────
  const fc = filas.find((f) => f.esControl);
  const controlBien = fc.veredicto === NADA && fc.cols.commits === 0 && fc.cols.pr === 0 && fc.cols.registro === 0;
  const reales = filas.filter((f) => !f.esControl);
  const cuenta = (v) => reales.filter((f) => f.veredicto === v).length;
  const celda = (x) => (x === null ? '🔴 no contestó' : String(x));

  console.log(`medido contra origin/main = ${main}`);
  console.log(`población: ${reales.length} ticket(s)${foto ? ` de la foto ${path.basename(foto)}` : ''} + 1 de control (SCRUM-${control})`);
  console.log(`PR mergeados leídos: ${deGh === null ? `🔴 gh: ${ghPor}` : `gh ${deGh.length} (del #${Math.min(...deGh.map((p) => p.number))} al #${Math.max(...deGh.map((p) => p.number))}${deGh.length >= TOPE ? `; ⚠️ es el TOPE de la llamada: gh no ve los anteriores` : ''})`} · PR en la primera línea de main ${deMain === null ? '🔴 no contestó' : `${deMain.length} (del #${Math.min(...deMain.map((p) => p.pr))} al #${Math.max(...deMain.map((p) => p.pr))})`}`);
  console.log(`control SCRUM-${control}: commits ${celda(fc.cols.commits)} · PR ${celda(fc.cols.pr)} · registro ${celda(fc.cols.registro)} → ${fc.veredicto} ${controlBien ? '✅' : '🔴 EL INSTRUMENTO NO MIDE: la tabla de abajo no vale'}`);
  console.log(`veredictos: ${cuenta(ALGO)} ${ALGO} · ${cuenta(NADA)} ${NADA} · ${cuenta(NO_PUDE)} ${NO_PUDE}\n`);
  console.log('| ticket | Jira | commits | PR mergeado | registro | VEREDICTO | líneas «queda» | notas |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const f of filas) {
    const pr = f.prs === null ? '🔴 no contestó' : f.prs.length ? f.prs.map((x) => `#${x}`).join(' ') : '0';
    const reg = f.cols.registro === null ? '🔴 no contestó' : f.registros.length ? f.registros.map((r) => path.basename(r)).join(' ') : '0';
    console.log(`| SCRUM-${f.n}${f.esControl ? ' (control)' : ''} | ${f.estado} | ${celda(f.cols.commits)} | ${pr} | ${reg} | **${f.veredicto}** | ${f.veredicto === ALGO ? (f.registros.length ? f.quedan.length : 'sin registro') : ''} | ${f.notas.join(' · ')} |`);
  }
  if (lineas) {
    fs.writeFileSync(lineas, `ticket\tfichero\tlinea\tpalabra\ttexto\n${todasLasLineas.join('\n')}\n`);
    console.log(`\nlíneas citadas: ${todasLasLineas.length}, escritas en ${lineas}`);
  }
  console.log(`\n«${ALGO}» NO es «hecho»: dice que hay trabajo con su número dentro. Cerrar es leer el enunciado (A13).`);
  return controlBien && cuenta(NO_PUDE) === 0 ? 0 : 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal(process.argv.slice(2)).then((c) => process.exit(c), (e) => {
    console.log(`🔴 ${NO_PUDE}: el comando reventó sin llegar a contestar: ${String((e && e.message) || e).split('\n')[0]}`);
    process.exit(2);
  });
}
