// scripts/abierto-con-trabajo-en-main.mjs — J6 (encargo del orquestador del equipo de Javier, 28-sep-2026)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// ¿QUÉ TICKETS SIGUEN ABIERTOS EN JIRA CON SU TRABAJO YA EN `main`?
//
// El 28-sep-2026 se repartieron SEIS encargos que ya estaban hechos: 1224, 1204 y 1223 (arreglados
// horas antes), 1200 (hecho bajo el número de OTRO ticket, dentro de `scrum-1216b-*`), 825 (con su
// ticket desde el 8-sep) y 1101 (hecho bajo SCRUM-1097). Jira mentía porque no se cierra al ritmo al
// que se entrega. Este instrumento da la lista de CANDIDATOS a mirar antes de repartir. NO cierra
// nada ni decide nada: cerrar es A13, del orquestador, tras leer el caso.
//
// ── POR QUÉ ES UN FICHERO PROPIO Y NO UN VEREDICTO MÁS EN `enlace-ticket-rama.mjs` ─────────────
// Se leyó entero antes de escribir esto. Mide otra pregunta (si las cuatro fuentes del ENLACE
// concuerdan), y además:
//   · no exporta nada: corre al cargarse y acaba en `process.exit`, así que reusarlo obliga a
//     modificarlo, y es de la S5 (`scripts/verificacion-s5/`), no de J6;
//   · empareja ramas por NÚMERO (`numDe`), que es justo la trampa ① de abajo;
//   · su foto de Jira (`docs/verificacion/asuntos-jira.tsv`) es del 7-sep y no trae los abiertos de hoy.
// Lo que SÍ se hereda de él son sus dos lecciones de git: la autoridad de «qué rama vive» es
// `ls-remote`, y una rama mergeada y BORRADA sólo sobrevive en el asunto de su commit de merge.
//
// ── LAS TRES TRAMPAS DEL ENCARGO ─────────────────────────────────────────────────────────────
// ① Por SLUG COMPLETO, nunca por número: el 28-sep había dos ramas `scrum-1216b-*`, una en main y
//   otra no. Cada rama se juzga por su nombre entero, y un ticket con UNA rama sin mergear no es
//   candidato aunque tenga otras dentro.
// ② El trabajo puede entrar bajo el número de OTRO ticket: SCRUM-1200 quedó «cerrado aquí» en
//   `docs/master/SCRUM-1216.md` §⑦. Se busca el número en TODO `docs/master/`, y se separa la
//   mención que DICE cierre («cerrado aquí», «arreglado en», «ya está») de la que sólo cita.
// ③ 🔴 LÍMITE DECLARADO, NO RESUELTO: que el DEFECTO esté arreglado sin rama, commit ni expediente
//   con ese número. SCRUM-1101 es el caso real (hecho bajo SCRUM-1097 sin nombrar el 1101 en ningún
//   sitio). Aquí sale «SIN RASTRO», que NO significa «sin hacer»: para eso, el PASO 0 por CONTENIDO
//   (grep del texto y de la función, no del número).
//
// ── LA FOTO DE JIRA CADUCA ───────────────────────────────────────────────────────────────────
// El instrumento sólo LEE Jira, y lo hace a través de una foto que le pasa quien lo corre: el JSON
// que guarda el MCP de Atlassian (`searchJiraIssuesUsingJql`, todas las páginas) o un TSV
// `clave<TAB>estado<TAB>asunto`. Su fecha es la de modificación del fichero (o `--tomada ISO`), se
// imprime en la cabecera, y si pasa de `--horas-max` (12 por defecto) el instrumento se declara
// CIEGO y sale 2: con una foto vieja, «abierto» ya no es una afirmación. Si la última página del
// JSON dice `hasNextPage: true`, también CIEGO: faltan tickets.
//
// ── SUELO ────────────────────────────────────────────────────────────────────────────────────
// Declara su población (tickets abiertos, ramas vivas, ramas en el histórico, expedientes leídos).
// Cero ramas, cero expedientes o cero tickets → CIEGO (2), nunca «nada que cerrar».
//
//   node scripts/abierto-con-trabajo-en-main.mjs --jira p1.json p2.json p3.json
//   node scripts/abierto-con-trabajo-en-main.mjs --jira foto.tsv --tomada 2026-09-28T21:04Z
//   node scripts/abierto-con-trabajo-en-main.mjs --jira … --ticket 1200      (el detalle de uno)
//
// Salidas: 0 informe hecho (haya o no candidatos) · 2 CIEGO. Nunca falla un check: sólo informa.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// ═══ 1 · LO PURO — sin git ni disco, para poder fabricar casos ══════════════════════════════

/** `scrum-1216b-numero-de-arranque` → { num: 1216, parte: 'b' }. Sin número → null. */
export function ticketDeRama(nombre) {
  const m = String(nombre).match(/^scrum-(\d+)([a-z]?)(?:-|$)/i);
  return m ? { num: Number(m[1]), parte: m[2].toLowerCase() } : null;
}

/** `docs/master/SCRUM-1216b.md` → 1216. */
export function ticketDeExpediente(fichero) {
  const m = path.basename(String(fichero)).match(/^SCRUM-(\d+)[a-z]?\.md$/i);
  return m ? Number(m[1]) : null;
}

/** La mención de SCRUM-N, con `(?![0-9])`: SCRUM-120 no es SCRUM-1200. */
export function reMencion(num) {
  return new RegExp(`SCRUM-${num}(?![0-9])`, 'i');
}

/**
 * ¿La línea DICE que el ticket se cerró o se hizo, o sólo lo cita? Lista cerrada, visible, y con
 * su falso positivo sabido: «NO está arreglado» casa igual. Por eso la mención de cierre es un
 * CANDIDATO que alguien lee, nunca un veredicto.
 */
// La frontera es de LETRA Unicode y no `\b`: en JS `\b` no trata «ó» como letra, y «sólo cubre»
// casaba con «lo cubre» (medido en docs/master/SCRUM-1092.md:69).
export const RE_CIERRE = /(?<![\p{L}\p{N}])(cerrad[oa]s? aqu[ií]|cerrad[oa]s? en|arreglad[oa]s? (aqu[ií]|en)|resuelt[oa]s? (aqu[ií]|en)|hech[oa]s? (aqu[ií]|en|bajo)|ya est[aá] (hech|arreglad|en main)|duplicad[oa] de|lo cubre|queda cubiert)/iu;

/**
 * El veredicto de UN ticket abierto, sobre un estado del repo ya leído.
 *   ramas:       [{ nombre, estado: 'MERGEADA' | 'MERGEADA_BORRADA' | 'SIN_MERGEAR' | 'CIEGA' }]
 *   commits:     [{ sha, asunto }]   — sólo los de `main`
 *   expedientes: Map<fichero, string[]>  — `docs/master/*.md` de `main`, por líneas
 */
/**
 * 🟡 LOS DOS MOTIVOS ESCRITOS PARA SEGUIR ABIERTO CON TRABAJO DENTRO, que es el «abierto legítimo»
 * que no se marca en rojo. Medidos sobre los 117 tickets que salían sin ellos el 28-sep-2026:
 *   · el ESTADO de Jira dice que espera a otro (9 «Acción del fundador» y 3 «En revisión»);
 *   · el TÍTULO del expediente propio lo declara (BLOQUEADO, PARADO, «MEDICIÓN, NO se construye»,
 *     «PASO 0», «sin aplicar»…).
 * ⛔ Se probó con el CUERPO del expediente y NO sirve: 95 de 112 tenían «pendiente», «queda»,
 *    «falta»… porque todo expediente habla de lo que queda. Sólo el título es lo que el autor anuncia.
 * No se esconden: salen en su propia sección, porque SCRUM-825 («Acción del fundador» y con el
 * trabajo dentro desde el 8-sep) fue uno de los repartos malos. Para repartir, importa que el trabajo
 * existe; para cerrar, importa por qué sigue abierto.
 */
export const RE_ESTADO_ESPERA = /acci[oó]n del fundador|en revisi[oó]n/i;
export const RE_TITULO_PARADO = /BLOQUEAD[OA]|PARAD[OA]\b|NO se construye|sin aplicar|PASO 0|investigaci[oó]n|SUELO DISPARADO|no he podido/i;

function tituloDe(lineas) {
  return (lineas.find((l) => /^#\s/.test(l)) || '').replace(/^#\s+/, '');
}

export function clasificar(num, repo, info = {}) {
  const suyas = repo.ramas.filter((r) => ticketDeRama(r.nombre)?.num === num);
  const dentro = suyas.filter((r) => r.estado === 'MERGEADA' || r.estado === 'MERGEADA_BORRADA');
  const fuera = suyas.filter((r) => r.estado === 'SIN_MERGEAR');
  const ciegas = suyas.filter((r) => r.estado === 'CIEGA');
  const re = reMencion(num);
  const commits = repo.commits.filter((c) => new RegExp(`^SCRUM-${num}(?![0-9])`, 'i').test(c.asunto));
  const propios = [...repo.expedientes.keys()].filter((f) => ticketDeExpediente(f) === num);
  const cierreAjeno = [];
  let mencionesAjenas = 0;
  for (const [f, lineas] of repo.expedientes) {
    if (ticketDeExpediente(f) === num) continue;
    lineas.forEach((l, i) => {
      if (!re.test(l)) return;
      mencionesAjenas++;
      if (RE_CIERRE.test(l)) cierreAjeno.push({ fichero: f, linea: i + 1, texto: l.trim().slice(0, 140) });
    });
  }

  let veredicto;
  if (ciegas.length) veredicto = 'CIEGO';
  else if (fuera.length && (dentro.length || propios.length || commits.length)) veredicto = 'PARCIAL';
  else if (fuera.length) veredicto = 'EN_CURSO';
  else if (dentro.length || propios.length || commits.length) veredicto = 'CANDIDATO';
  else if (cierreAjeno.length) veredicto = 'CERRADO_EN_OTRO';
  else veredicto = 'SIN_RASTRO';

  // Trabajo dentro y un motivo ESCRITO para seguir abierto: se aparta del rojo, no se esconde.
  const titulos = propios.map((f) => tituloDe(repo.expedientes.get(f)));
  let motivo = null;
  if (veredicto === 'CANDIDATO' || veredicto === 'CERRADO_EN_OTRO') {
    if (RE_ESTADO_ESPERA.test(info.estado || '')) motivo = `Jira: «${info.estado}»`;
    else {
      const t = titulos.find((x) => RE_TITULO_PARADO.test(x));
      if (t) motivo = `su expediente: «${t.slice(0, 90)}»`;
    }
    if (motivo) veredicto = 'ABIERTO_CON_MOTIVO';
  }

  return { num, veredicto, motivo, titulos, dentro, fuera, ciegas, commits, propios, cierreAjeno, mencionesAjenas };
}

/**
 * La foto de Jira: JSON del MCP (una o varias páginas) o TSV. Devuelve los ABIERTOS (categoría ≠
 * done) y lo que la hace inservible, si lo hay.
 */
export function leerFoto(textos) {
  const abiertos = new Map();
  const problemas = [];
  let ultimaPaginaCierra = null;
  for (const { nombre, texto } of textos) {
    const t = texto.trimStart();
    if (t.startsWith('{')) {
      let j;
      try { j = JSON.parse(t); } catch { problemas.push(`${nombre}: no es JSON válido`); continue; }
      const nodos = j?.issues?.nodes;
      if (!Array.isArray(nodos)) { problemas.push(`${nombre}: no trae issues.nodes`); continue; }
      for (const n of nodos) {
        const m = String(n.key || '').match(/^SCRUM-(\d+)$/);
        if (!m) continue;
        const cat = n.fields?.status?.statusCategory?.key;
        if (cat === 'done') continue;
        abiertos.set(Number(m[1]), { estado: n.fields?.status?.name ?? '?', asunto: n.fields?.summary ?? '' });
      }
      if (j.issues.pageInfo && j.issues.pageInfo.hasNextPage === false) ultimaPaginaCierra = true;
      else if (ultimaPaginaCierra !== true) ultimaPaginaCierra = false;
    } else {
      for (const l of texto.split(/\r?\n/)) {
        if (!l || l.startsWith('#')) continue;
        const [k, estado = '', asunto = ''] = l.split('\t');
        const m = String(k).match(/^SCRUM-(\d+)$/);
        if (!m || /finalizad|done|hecho|cerrad/i.test(estado)) continue;
        abiertos.set(Number(m[1]), { estado, asunto });
      }
      ultimaPaginaCierra = true; // un TSV no pagina: quien lo escribe responde de que está entero
    }
  }
  if (ultimaPaginaCierra === false) problemas.push('ninguna página del JSON dice hasNextPage:false — faltan páginas de la búsqueda');
  if (abiertos.size === 0) problemas.push('la foto no trae ningún ticket abierto');
  return { abiertos, problemas };
}

// ═══ 2 · LO QUE SE LEE DE GIT, siempre de `ref` (no del árbol de trabajo) ═══════════════════

function leerRepo(ref) {
  const git = (...a) => execFileSync('git', a, { cwd: RAIZ, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  const lineas = (s) => s.split(/\r?\n/).filter(Boolean);

  // Primero lo LOCAL: una ref que no existe falla aquí, antes de salir a la red.
  const dentroDeRef = new Set(lineas(git('rev-list', ref)));

  // Autoridad de «qué rama vive»: ls-remote. Las refs locales pueden estar desfasadas; sólo se
  // usan para saber si el sha que vive está dentro de `ref`.
  const vivas = new Map();
  for (const l of lineas(git('ls-remote', '--heads', 'origin'))) {
    const m = l.match(/^([0-9a-f]{40})\s+refs\/heads\/(.+)$/);
    if (m) vivas.set(m[2], m[1]);
  }
  const ramas = [];
  for (const [nombre, sha] of vivas) {
    if (!ticketDeRama(nombre)) continue;
    if (dentroDeRef.has(sha)) ramas.push({ nombre, estado: 'MERGEADA' });
    else {
      // Fuera de `ref`: o sin mergear, o un sha que este clon no tiene (hay que hacer fetch).
      let existe = true;
      try { git('cat-file', '-e', `${sha}^{commit}`); } catch { existe = false; }
      ramas.push({ nombre, estado: existe ? 'SIN_MERGEAR' : 'CIEGA' });
    }
  }
  // Mergeadas y BORRADAS: sólo quedan en el asunto del merge.
  const historico = new Set();
  for (const s of lineas(git('log', '--merges', '--format=%s', ref))) {
    const m = s.match(/^Merge pull request #\d+ from [\w.-]+\/(\S+)/);
    if (m && ticketDeRama(m[1])) historico.add(m[1]);
  }
  for (const nombre of historico) if (!vivas.has(nombre)) ramas.push({ nombre, estado: 'MERGEADA_BORRADA' });

  const commits = [];
  for (const l of lineas(git('log', '--no-merges', '--format=%h|%s', ref))) {
    const i = l.indexOf('|');
    commits.push({ sha: l.slice(0, i), asunto: l.slice(i + 1) });
  }

  // docs/master de `ref`, entero, en un solo `git grep` que devuelve TODAS las líneas.
  const expedientes = new Map();
  const salida = git('grep', '-n', '-I', '-e', '', ref, '--', 'docs/master/*.md');
  for (const l of salida.split('\n')) {
    const m = l.match(/^[^:]+:(docs\/master\/[^:]+\.md):(\d+):(.*)$/);
    if (!m) continue;
    if (!expedientes.has(m[1])) expedientes.set(m[1], []);
    expedientes.get(m[1])[Number(m[2]) - 1] = m[3];
  }
  for (const [f, ls] of expedientes) expedientes.set(f, Array.from(ls, (x) => x ?? ''));
  return { ramas, commits, expedientes, poblacion: { vivas: vivas.size, historico: historico.size, commits: commits.length, expedientes: expedientes.size } };
}

// ═══ 3 · EL INFORME ══════════════════════════════════════════════════════════════════════════

const ETIQUETA = {
  CANDIDATO: '🔴 CANDIDATO — todo lo que se ve de él está en main, y no hay rama suya fuera',
  CERRADO_EN_OTRO: '🟠 CERRADO EN OTRO EXPEDIENTE — sin rama ni expediente propio, pero otro dice que se hizo',
  ABIERTO_CON_MOTIVO: '🟡 TRABAJO EN MAIN Y MOTIVO ESCRITO para seguir abierto — no se marca, pero existe',
  PARCIAL: '🟡 PARCIAL — parte en main y parte fuera: abierto con motivo, NO se marca',
  EN_CURSO: '⚪ EN CURSO — sólo ramas sin mergear',
  SIN_RASTRO: '·  SIN RASTRO — nada con su número (≠ «sin hacer»: límite ③)',
  CIEGO: '🔴 CIEGO — una rama suya vive con un sha que este clon no tiene: git fetch y repetir',
};

function pintaUno(r, info) {
  console.log(`\nSCRUM-${r.num}  [${info.estado}]  ${info.asunto.slice(0, 96)}`);
  console.log(`  ${ETIQUETA[r.veredicto]}`);
  if (r.motivo) console.log(`  motivo  · ${r.motivo}`);
  for (const b of r.dentro) console.log(`  rama    · ${b.nombre}  ${b.estado === 'MERGEADA' ? 'en main (viva, borrable)' : 'en main (mergeada y borrada)'}`);
  for (const b of r.fuera) console.log(`  rama    · ${b.nombre}  SIN MERGEAR`);
  for (const b of r.ciegas) console.log(`  rama    · ${b.nombre}  🔴 sha desconocido en este clon`);
  if (r.propios.length) console.log(`  expte.  · ${r.propios.join(', ')}`);
  if (r.commits.length) console.log(`  commits · ${r.commits.length} en main con «SCRUM-${r.num}…» al principio (${r.commits.slice(0, 3).map((c) => c.sha).join(' ')}${r.commits.length > 3 ? ' …' : ''})`);
  for (const c of r.cierreAjeno.slice(0, 4)) console.log(`  otro    · ${c.fichero}:${c.linea}  «${c.texto}»`);
  if (r.cierreAjeno.length > 4) console.log(`  otro    · … y ${r.cierreAjeno.length - 4} líneas más con palabra de cierre`);
  if (r.mencionesAjenas) console.log(`  citado  · ${r.mencionesAjenas} líneas de otros expedientes lo nombran`);
}

function principal(argv) {
  const i = argv.indexOf('--jira');
  const ficheros = [];
  if (i >= 0) for (let k = i + 1; k < argv.length && !argv[k].startsWith('--'); k++) ficheros.push(argv[k]);
  const valor = (n, d) => { const j = argv.indexOf(n); return j >= 0 ? argv[j + 1] : d; };
  const ref = valor('--ref', 'origin/main');
  const horasMax = Number(valor('--horas-max', '12'));
  const uno = valor('--ticket', null);

  const ciego = [];
  if (!ficheros.length) { console.log('uso: abierto-con-trabajo-en-main.mjs --jira <foto.json|tsv …> [--tomada ISO] [--ref origin/main] [--horas-max 12] [--ticket N]'); return 2; }
  const textos = ficheros.map((f) => ({ nombre: f, texto: fs.readFileSync(f, 'utf8') }));
  const tomadaArg = valor('--tomada', null);
  const tomada = tomadaArg ? new Date(tomadaArg) : new Date(Math.min(...ficheros.map((f) => fs.statSync(f).mtimeMs)));
  const horas = (Date.now() - tomada.getTime()) / 3.6e6;
  if (Number.isNaN(horas)) ciego.push(`la fecha de la foto no se entiende: ${tomadaArg}`);
  else if (horas > horasMax) ciego.push(`la foto de Jira es de ${tomada.toISOString()} (${horas.toFixed(1)} h): pasa de ${horasMax} h y «abierto» ya no es una afirmación. Rehacerla.`);
  const { abiertos, problemas } = leerFoto(textos);
  ciego.push(...problemas);
  // Con la foto inservible no se toca git: no hay nada que cruzar, y así se comprueba sin red.
  if (ciego.length) {
    console.log(`foto de Jira: ${abiertos.size} abiertos · tomada ${Number.isNaN(tomada.getTime()) ? '?' : tomada.toISOString()} · tope ${horasMax} h`);
    console.log('\n🔴 CIEGO — no se puede responder:'); for (const c of ciego) console.log(`   · ${c}`);
    return 2;
  }

  const repo = leerRepo(ref);
  const sha = execFileSync('git', ['rev-parse', ref], { cwd: RAIZ, encoding: 'utf8' }).trim();
  if (repo.poblacion.vivas === 0) ciego.push('ls-remote no devolvió ninguna rama');
  if (repo.poblacion.expedientes === 0) ciego.push(`${ref} no tiene ningún docs/master/*.md legible`);
  if (repo.poblacion.historico === 0) ciego.push('el histórico de merges no dio ninguna rama: las borradas serían invisibles');

  console.log(`ref: ${ref} = ${sha}`);
  console.log(`foto de Jira: ${abiertos.size} tickets ABIERTOS · tomada ${Number.isNaN(tomada.getTime()) ? '?' : tomada.toISOString()} (${Number.isNaN(horas) ? '?' : horas.toFixed(1)} h, tope ${horasMax} h) · ${ficheros.length} fichero(s)`);
  console.log(`repo: ${repo.poblacion.vivas} ramas vivas · ${repo.poblacion.historico} mergeadas en el histórico · ${repo.poblacion.commits} commits · ${repo.poblacion.expedientes} expedientes de docs/master`);
  if (ciego.length) { console.log('\n🔴 CIEGO — no se puede responder:'); for (const c of ciego) console.log(`   · ${c}`); return 2; }

  const nums = uno ? [Number(uno)] : [...abiertos.keys()].sort((a, b) => a - b);
  const res = nums.map((n) => clasificar(n, repo, abiertos.get(n) ?? {}));
  if (uno) { pintaUno(res[0], abiertos.get(res[0].num) ?? { estado: '(no está entre los abiertos de la foto)', asunto: '' }); return 0; }

  const por = (v) => res.filter((r) => r.veredicto === v);
  console.log(`\nveredictos sobre ${res.length} abiertos: ${Object.keys(ETIQUETA).map((v) => `${v} ${por(v).length}`).join(' · ')}`);
  for (const v of ['CANDIDATO', 'CERRADO_EN_OTRO', 'CIEGO', 'ABIERTO_CON_MOTIVO']) {
    if (!por(v).length) continue;
    console.log(`\n═══ ${ETIQUETA[v]} — ${por(v).length} ═══`);
    for (const r of por(v)) pintaUno(r, abiertos.get(r.num));
  }
  console.log('\n⚠️  Un CANDIDATO se LEE antes de cerrarlo: un ticket con partes (A18) puede tener la primera en main y');
  console.log('    las demás sin empezar, y eso aquí no se distingue. SIN RASTRO no es «sin hacer» (límite ③).');
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(principal(process.argv.slice(2)));
}
