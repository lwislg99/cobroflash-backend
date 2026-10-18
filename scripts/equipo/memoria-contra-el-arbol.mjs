#!/usr/bin/env node
// SCRUM-1300c · PIEZA 8 — la memoria del orquestador se comprueba contra el árbol.
//
//   node scripts/equipo/memoria-contra-el-arbol.mjs <carpeta de memoria>          → MEMORY.md y project_*.md
//   node scripts/equipo/memoria-contra-el-arbol.mjs <carpeta de memoria> --todo   → también feedback_* y reference_*
//   node scripts/equipo/memoria-contra-el-arbol.mjs <carpeta> --json              → lo mismo, para otra herramienta
//
// POR QUÉ EXISTE. La memoria del orquestador es el único sitio del sistema que nadie comprueba (SCRUM-1300,
// c.17878). Medido: dos veces en dos días contó como ENTREGADO lo que vivía en un PR ABIERTO; el 18-oct le
// atribuyó a un guion suyo un acierto que era de `sala.mjs`, y con eso pidió llevarlo a `main`. La única
// defensa era acordarse de acordarse.
//
// QUÉ COMPRUEBA (sólo LEE la memoria; la carpeta llega por argumento y el guion no sabe dónde vive):
//   · PR    `#N` + «EN MAIN / MERGED / mergeado» → `gh`: ¿está mergeado?           🔴 si no
//   · PR    `#N` + «ABIERTO»                     → `gh`: ¿sigue abierto?             🟡 si ya entró o se cerró (foto vieja)
//   · sha   + «EN MAIN»                          → `git merge-base --is-ancestor`    🔴 si no está, o no existe
//   · sha   + «EMPUJADO / punta»                 → ¿lo tiene alguna rama del remoto? 🔴 si no
//   · `ruta/con/carpeta.ext` + «EN MAIN»         → `git cat-file -e origin/main:…`   🔴 si no está
// Se juzga por TRAMO (la línea partida por `·`, `|`, `;`, ` — `), no por línea entera: «#1 EN MAIN · #2
// ABIERTO» son dos afirmaciones. Antes se quita lo que va entre «…» y "…": ahí la memoria CITA lo que
// alguien dijo, a menudo el error mismo. Un tramo con negación (no, sin, falta, nunca) o con las dos
// palabras a la vez NO se juzga: se cuenta aparte. Mejor callar que inventar una falsedad.
//
// LO QUE NO CUBRE (y lo dice en cada salida): el estado de un ticket en Jira (no hay credencial aquí); y
// **una afirmación que atribuye un hecho a la pieza EQUIVOCADA** («lo vio X» cuando lo vio Y): eso no se
// saca de un patrón de texto. Las cifras y las fechas, tampoco.
//
// EL CONTROL VA DENTRO, EN CADA PASADA. Antes de juzgar la memoria, el guion juzga tres testigos con las
// MISMAS consultas de verdad: el último PR mergeado en `main` afirmado «ABIERTO» (tiene que salir 🟡), la
// punta de `origin/main` afirmada «EN MAIN» (✔) y un sha que no existe afirmado «EN MAIN» (🔴). Si no los
// clava, no ha mirado: salida 2. Una sonda que no se ha visto cazar parece limpia.
//
// SALIDA: 0 = todo lo juzgado se sostiene (los 🟡 se enseñan, no alarman) · 1 = hay alguna 🔴 · 2 = NO PUDE
// MIRAR (sin carpeta, sin ficheros, cero afirmaciones reconocidas, el remoto o `gh` no contestan, o el
// control no cazó). El 2 gana al 1: un «no sé» no se tapa con una lista.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const SALIDA_BIEN = 0;
export const SALIDA_FALSAS = 1;
export const SALIDA_CIEGO = 2;

/** Un sha que no existe en ningún repositorio razonable: el testigo de «no existe». */
export const SHA_QUE_NO_EXISTE = 'f00dfacecafe1300c0ffee000000000000c0de13';

const RE_MAIN = /(?:\bEN MAIN\b|\ben main\b|\bEn main\b|\bMERGED\b|\bmerged\b|\bmergead[oa]s?\b|\bMERGEAD[OA]S?\b)/;
const RE_ABIERTO = /\b(?:ABIERT[OA]S?|[Aa]biert[oa]s?)\b/;
const RE_EMPUJADO = /\b(?:EMPUJAD[OA]S?|[Ee]mpujad[oa]s?|punta)\b/;
const RE_NEGACION = /\b(?:no|NO|No|sin|SIN|Sin|falta|FALTA|faltan|nunca|NUNCA|todavía no|aún no)\b/;
const RE_PR = /(?<![\w/#])#(\d{3,5})\b/g;
const RE_SHA = /(?<![\w#/.-])([0-9a-f]{7,40})(?![\w-])/g;
const RE_RUTA = /`((?:[\w.-]+\/)+[\w.-]+\.[A-Za-z0-9]+)`/g;

/** Lo que va citado no lo afirma la memoria: lo cita. Se quita antes de buscar afirmaciones. */
export function sinCitas(texto) {
  return String(texto).replace(/«[^»]*»/g, ' ').replace(/"[^"\n]*"/g, ' ').replace(/“[^”]*”/g, ' ');
}

const esSha = (s) => /[0-9]/.test(s) && /[a-f]/.test(s);

/**
 * Las afirmaciones comprobables de unos ficheros de memoria.
 * @param {{nombre:string, texto:string}[]} ficheros
 * @returns {{afirmaciones:object[], sinJuzgar:object[]}}
 */
export function extraerAfirmaciones(ficheros) {
  const afirmaciones = [];
  const sinJuzgar = [];
  for (const { nombre, texto } of ficheros) {
    String(texto).split(/\r?\n/).forEach((linea, i) => {
      const tramos = sinCitas(linea).replace(/\*\*/g, '').split(/\s[·|;]\s|\s—\s/);
      for (const tramo of tramos) {
        const prs = [...tramo.matchAll(RE_PR)].map((m) => Number(m[1]));
        const shas = [...tramo.matchAll(RE_SHA)].map((m) => m[1]).filter(esSha);
        const rutas = [...tramo.matchAll(RE_RUTA)].map((m) => m[1]);
        if (!prs.length && !shas.length && !rutas.length) continue;
        const main = RE_MAIN.test(tramo); const abierto = RE_ABIERTO.test(tramo); const empujado = RE_EMPUJADO.test(tramo);
        if (!main && !abierto && !empujado) continue;
        const donde = { fichero: nombre, linea: i + 1, texto: tramo.trim().slice(0, 200) };
        if (RE_NEGACION.test(tramo)) { sinJuzgar.push({ ...donde, porque: 'lleva negación' }); continue; }
        if (main && abierto) { sinJuzgar.push({ ...donde, porque: 'dice EN MAIN y ABIERTO a la vez' }); continue; }
        for (const n of prs) {
          if (main) afirmaciones.push({ ...donde, tipo: 'pr', objeto: n, dice: 'en-main' });
          else if (abierto) afirmaciones.push({ ...donde, tipo: 'pr', objeto: n, dice: 'abierto' });
        }
        for (const s of shas) {
          // ¿El texto dice que ESO es un commit? Un id de sesión (`ed676fd1`) tiene la misma forma.
          const commit = new RegExp(`(?:\\b(?:punta|commit|sha|merge)\\b[^\\w]{0,4}\`?${s}|\`${s}\`)`).test(tramo);
          if (main) afirmaciones.push({ ...donde, tipo: 'sha', objeto: s, dice: 'en-main', commit });
          else if (empujado) afirmaciones.push({ ...donde, tipo: 'sha', objeto: s, dice: 'empujado', commit });
        }
        if (main) for (const r of rutas) afirmaciones.push({ ...donde, tipo: 'ruta', objeto: r, dice: 'en-main' });
      }
    });
  }
  return { afirmaciones, sinJuzgar };
}

/**
 * Juzga UNA afirmación. `consultas` devuelve `{ok:true, valor}` o `{ok:false, motivo}`, nunca un valor
 * inventado por un fallo.
 * @returns {{veredicto:'BIEN'|'FALSA'|'CADUCADA'|'NO-PUDE-MIRAR', real:string}}
 */
export function juzgar(a, consultas) {
  const ciego = (r) => ({ veredicto: 'NO-PUDE-MIRAR', real: r.motivo || 'sin motivo' });
  if (a.tipo === 'pr') {
    const r = consultas.estadoPR(a.objeto);
    if (!r.ok) return ciego(r);
    const estado = r.valor;
    if (a.dice === 'en-main') return estado === 'MERGED' ? { veredicto: 'BIEN', real: 'MERGED' } : { veredicto: 'FALSA', real: estado };
    return estado === 'OPEN' ? { veredicto: 'BIEN', real: 'OPEN' } : { veredicto: 'CADUCADA', real: estado };
  }
  if (a.tipo === 'sha') {
    const existe = consultas.existe(a.objeto);
    if (!existe.ok) return ciego(existe);
    // Que no exista sólo es FALSA si el texto dice que es un commit; si no, lo más probable es un id de
    // sesión o de trabajo con forma de sha (medido el 18-oct: `ed676fd1`, una transcripción).
    if (!existe.valor) return a.commit ? { veredicto: 'FALSA', real: 'ese commit no existe en el repositorio' } : { veredicto: 'NO-ES-COMMIT', real: 'no es un commit de este repositorio (¿un id de sesión?)' };
    const r = a.dice === 'en-main' ? consultas.enMain(a.objeto) : consultas.enElRemoto(a.objeto);
    if (!r.ok) return ciego(r);
    if (r.valor) return { veredicto: 'BIEN', real: a.dice === 'en-main' ? 'en origin/main' : 'en una rama del remoto' };
    return { veredicto: 'FALSA', real: a.dice === 'en-main' ? 'existe, pero NO está en origin/main' : 'existe, pero ninguna rama del remoto lo tiene' };
  }
  if (a.tipo === 'ruta') {
    const r = consultas.rutaEnMain(a.objeto);
    if (!r.ok) return ciego(r);
    return r.valor ? { veredicto: 'BIEN', real: 'está en origin/main' } : { veredicto: 'FALSA', real: 'no está en origin/main' };
  }
  return { veredicto: 'NO-PUDE-MIRAR', real: `tipo desconocido «${a.tipo}»` };
}

/** Los testigos del control: con su veredicto ESPERADO. Salen de `main`, no de una lista escrita a mano. */
export function testigos({ ultimoPRMergeado, puntaDeMain }) {
  return [
    { tipo: 'pr', objeto: ultimoPRMergeado, dice: 'abierto', espera: 'CADUCADA', n: `#${ultimoPRMergeado} (el último PR mergeado) afirmado ABIERTO` },
    { tipo: 'sha', objeto: puntaDeMain, dice: 'en-main', espera: 'BIEN', n: `${String(puntaDeMain).slice(0, 8)} (la punta de main) afirmado EN MAIN` },
    { tipo: 'sha', objeto: SHA_QUE_NO_EXISTE, dice: 'en-main', commit: true, espera: 'FALSA', n: 'un commit que no existe afirmado EN MAIN' },
  ];
}

/**
 * La pasada entera, sin red ni disco propios: todo llega por parámetro (así la prueban los tests).
 * @param {{ficheros:{nombre:string,texto:string}[]|null, motivoFicheros?:string, consultas:object, referencias:{ok:boolean, ultimoPRMergeado?:number, puntaDeMain?:string, motivo?:string}}} e
 * @returns {{codigo:0|1|2, lineas:string[], datos:object}}
 */
export function medir({ ficheros, motivoFicheros = 'sin motivo', consultas, referencias }) {
  const ciegos = [];
  const NO_CUBRE = 'No cubre: el estado de los tickets en Jira, ni una afirmación que atribuye un hecho a la pieza EQUIVOCADA («lo vio X» y lo vio Y), ni cifras ni fechas.';
  if (!Array.isArray(ficheros)) ciegos.push(`la carpeta de memoria: ${motivoFicheros}`);
  else if (!ficheros.length) ciegos.push('la carpeta de memoria no tiene ningún fichero que juzgar');

  // El control, ANTES que la memoria: si no clava los testigos, lo de abajo no vale.
  const control = [];
  if (!referencias || !referencias.ok) ciegos.push(`el CONTROL: no pude leer de qué fabricar los testigos (${(referencias && referencias.motivo) || 'sin motivo'})`);
  else {
    for (const t of testigos(referencias)) {
      const r = juzgar(t, consultas);
      control.push({ ...t, salio: r.veredicto, real: r.real, ok: r.veredicto === t.espera });
    }
    const malos = control.filter((c) => !c.ok);
    if (malos.length) ciegos.push(`el CONTROL no cazó ${malos.length} de ${control.length} testigos (${malos.map((c) => `${c.n}: salió ${c.salio}, tocaba ${c.espera} — ${c.real}`).join(' · ')})`);
  }

  const { afirmaciones, sinJuzgar } = Array.isArray(ficheros) ? extraerAfirmaciones(ficheros) : { afirmaciones: [], sinJuzgar: [] };
  if (Array.isArray(ficheros) && ficheros.length && !afirmaciones.length) {
    ciegos.push(`ninguna afirmación reconocida en ${ficheros.length} fichero(s): o no las hay, o el extractor no las ve. Un cero aquí no es «todo cierto»`);
  }
  const juzgadas = afirmaciones.map((a) => ({ ...a, ...juzgar(a, consultas) }));
  const falsas = juzgadas.filter((j) => j.veredicto === 'FALSA');
  const caducadas = juzgadas.filter((j) => j.veredicto === 'CADUCADA');
  const sinMirar = juzgadas.filter((j) => j.veredicto === 'NO-PUDE-MIRAR');
  const noCommits = juzgadas.filter((j) => j.veredicto === 'NO-ES-COMMIT');
  if (sinMirar.length) ciegos.push(`${sinMirar.length} afirmación(es) que no pude comprobar (${[...new Set(sinMirar.map((j) => j.real))].slice(0, 3).join(' · ')})`);
  const codigo = ciegos.length ? SALIDA_CIEGO : falsas.length ? SALIDA_FALSAS : SALIDA_BIEN;

  const loc = (j) => `${j.fichero}:${j.linea}`;
  const que = (j) => (j.tipo === 'pr' ? `#${j.objeto}` : j.tipo === 'sha' ? j.objeto.slice(0, 10) : j.objeto);
  const dice = { 'en-main': 'EN MAIN', abierto: 'ABIERTO', empujado: 'EMPUJADO' };
  const out = [];
  if (ciegos.length) {
    out.push('🔴 MEMORIA · NO PUDE MIRAR (salida 2): esto NO quiere decir que la memoria esté bien.');
    for (const c of ciegos) out.push(`   · no pude mirar ${c}`);
  } else {
    out.push(`${falsas.length ? '🔴' : '✅'} MEMORIA · ${falsas.length} afirmación(es) FALSA(S) · ${caducadas.length} caducada(s) · ${juzgadas.length - falsas.length - caducadas.length - noCommits.length} se sostienen, de ${juzgadas.length} juzgadas`);
  }
  if (noCommits.length) out.push(`   apartadas, con forma de sha y sin serlo (¿ids de sesión?): ${noCommits.map((j) => `${j.objeto} (${j.fichero}:${j.linea})`).join(', ')}`);
  out.push(`   control: ${control.length ? control.map((c) => `${c.ok ? '✔' : '🔴'} ${c.n} → ${c.salio}`).join(' · ') : 'no se pudo correr'}`);
  out.push(`   ficheros: ${Array.isArray(ficheros) ? ficheros.length : 'NO LEÍDOS'} · tramos no juzgados (negación, o EN MAIN y ABIERTO a la vez): ${sinJuzgar.length}`);
  out.push(`   ${NO_CUBRE}`);
  if (falsas.length) {
    out.push('', 'FALSAS (la memoria dice algo que el árbol desmiente HOY)', '| dónde | qué | dice | real | el tramo |', '|---|---|---|---|---|');
    for (const j of falsas) out.push(`| ${loc(j)} | ${que(j)} | ${dice[j.dice]} | ${j.real} | ${j.texto.replace(/\|/g, '/')} |`);
  }
  if (caducadas.length) {
    out.push('', 'CADUCADAS (decía ABIERTO; hoy ya no lo está: es una foto vieja, no una mentira)', '| dónde | qué | hoy |', '|---|---|---|');
    for (const j of caducadas) out.push(`| ${loc(j)} | ${que(j)} | ${j.real} |`);
  }
  if (sinMirar.length) {
    out.push('', 'SIN COMPROBAR', ...sinMirar.slice(0, 20).map((j) => `   · ${loc(j)} ${que(j)}: ${j.real}`));
  }
  return { codigo, lineas: out, datos: { codigo, ciegos, control, falsas, caducadas, sinMirar, noCommits, juzgadas: juzgadas.length, sinJuzgar: sinJuzgar.length } };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// Lo que habla con el disco, git y gh
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** Los ficheros que se juzgan: por defecto el índice y los `project_*` (el ESTADO); `todo` añade el resto. */
export function leerMemoria(dir, { todo = false } = {}) {
  let nombres;
  try { nombres = fs.readdirSync(dir); } catch (e) { return { ficheros: null, motivo: `no se puede leer ${dir} (${e.code || e.message})` }; }
  const elegidos = nombres.filter((n) => n.endsWith('.md') && (todo || n === 'MEMORY.md' || n.startsWith('project_'))).sort();
  const ficheros = [];
  for (const n of elegidos) {
    try { ficheros.push({ nombre: n, texto: fs.readFileSync(path.join(dir, n), 'utf8') }); } catch (e) { return { ficheros: null, motivo: `no se puede leer ${n} (${e.code || e.message})` }; }
  }
  return { ficheros };
}

function ghPorDefecto() {
  if (process.env.GH) return process.env.GH;
  const windows = 'C:\\Program Files\\GitHub CLI\\gh.exe';
  return process.platform === 'win32' && fs.existsSync(windows) ? windows : 'gh';
}

function consultasReales({ repo, gh = ghPorDefecto() }) {
  const git = (...a) => spawnSync('git', ['-C', repo, ...a], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const remoto = (() => {
    const r = git('remote', 'get-url', 'origin');
    const m = /github\.com[:/](.+?)(?:\.git)?\s*$/.exec(r.stdout || '');
    return m ? m[1] : null;
  })();
  let estados = null; let motivoEstados = null;
  const cargarEstados = () => {
    if (estados || motivoEstados) return;
    if (!remoto) { motivoEstados = 'no sé qué repositorio de GitHub es (`git remote get-url origin`)'; return; }
    const r = spawnSync(gh, ['pr', 'list', '--repo', remoto, '--state', 'all', '--limit', '5000', '--json', 'number,state'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (r.error || r.status !== 0) { motivoEstados = `gh no contestó (${r.error ? r.error.code : `código ${r.status}`}${r.stderr ? `: ${r.stderr.trim().slice(0, 120)}` : ''})`; return; }
    try { estados = new Map(JSON.parse(r.stdout).map((p) => [p.number, p.state])); } catch { motivoEstados = 'la salida de gh no es JSON'; }
  };
  return {
    estadoPR(n) {
      cargarEstados();
      if (motivoEstados) return { ok: false, motivo: motivoEstados };
      if (estados.has(n)) return { ok: true, valor: estados.get(n) };
      return { ok: true, valor: 'NO EXISTE' };
    },
    existe(sha) {
      const r = git('cat-file', '-e', `${sha}^{commit}`);
      if (r.error) return { ok: false, motivo: `git no arrancó (${r.error.code})` };
      return { ok: true, valor: r.status === 0 };
    },
    enMain(sha) {
      const r = git('merge-base', '--is-ancestor', sha, 'origin/main');
      if (r.status === 0) return { ok: true, valor: true };
      if (r.status === 1) return { ok: true, valor: false };
      return { ok: false, motivo: `git merge-base salió ${r.status}` };
    },
    enElRemoto(sha) {
      const r = git('branch', '-r', '--contains', sha);
      if (r.error || r.status !== 0) return { ok: false, motivo: `git branch -r --contains salió ${r.status}` };
      return { ok: true, valor: r.stdout.trim().length > 0 };
    },
    rutaEnMain(ruta) {
      const r = git('cat-file', '-e', `origin/main:${ruta}`);
      if (r.error) return { ok: false, motivo: `git no arrancó (${r.error.code})` };
      return { ok: true, valor: r.status === 0 };
    },
  };
}

/** De qué se fabrican los testigos: el último «Merge pull request #N» de main y su punta. Antes, `fetch`. */
function referenciasReales(repo) {
  const git = (...a) => spawnSync('git', ['-C', repo, ...a], { encoding: 'utf8' });
  const f = git('fetch', '-q', '--prune', 'origin');
  if (f.error || f.status !== 0) return { ok: false, motivo: `git fetch salió ${f.status}: sin traer el remoto, «en main» sería el main de la última vez` };
  const punta = git('rev-parse', 'origin/main');
  const ultimo = git('log', 'origin/main', '--merges', '--format=%s', '-200');
  const m = /Merge pull request #(\d+)/.exec(ultimo.stdout || '');
  if (punta.status !== 0 || !m) return { ok: false, motivo: 'no encontré la punta de origin/main o un «Merge pull request #N» en sus últimos 200 merges' };
  return { ok: true, puntaDeMain: punta.stdout.trim(), ultimoPRMergeado: Number(m[1]) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith('--'));
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const leido = dir ? leerMemoria(dir, { todo: args.includes('--todo') }) : { ficheros: null, motivo: 'falta la carpeta: node memoria-contra-el-arbol.mjs <carpeta de memoria>' };
  const r = medir({ ficheros: leido.ficheros, motivoFicheros: leido.motivo, consultas: consultasReales({ repo }), referencias: referenciasReales(repo) });
  console.log(args.includes('--json') ? JSON.stringify(r.datos, null, 2) : r.lineas.join('\n'));
  process.exit(r.codigo);
}
