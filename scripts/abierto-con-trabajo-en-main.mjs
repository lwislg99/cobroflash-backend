// scripts/abierto-con-trabajo-en-main.mjs — SCRUM-1259 · J6 (encargo del orquestador del equipo de Javier, 28-sep-2026)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// ¿QUÉ TICKETS SIGUEN ABIERTOS EN JIRA CON SU TRABAJO YA EN `main`?
//
// El 28-sep-2026 se repartieron SEIS encargos que ya estaban hechos: 1224, 1204 y 1223 (arreglados
// horas antes), 1200 (hecho bajo el número de OTRO ticket, dentro de `scrum-1216b-*`), 825 (con su
// ticket desde el 8-sep) y 1101 (hecho bajo SCRUM-1097). Jira mentía porque no se cierra al ritmo al
// que se entrega. Esto da la lista de CANDIDATOS a LEER antes de repartir o de cerrar. NO cierra
// nada ni decide nada: cerrar es A13, del orquestador, leyendo el ticket.
//
// ── 🔴 ESTO ES UNA CAPA, NO UN MOTOR — Y MI PASO 0 SE EQUIVOCÓ ─────────────────────────────────
// La primera versión de este fichero traía su propio censo de ramas, commits y expedientes. El
// motor YA EXISTÍA: `censarTicket` (`tests/_censo-tickets.mjs`, SCRUM-388: «¿qué hay en `main` de
// UN ticket?», con la colisión de número de SCRUM-738) y `rastroDeLosTickets`
// (`scripts/_rastro-del-ticket.mjs`, SCRUM-804: rama a rama, DENTRO de `main` o VIVA fuera). Lo
// encontré tarde —por el censo de SCRUM-723, que describía a `censo-tablero-vs-arbol.mjs` con mi
// misma pregunta—, porque busqué en `scripts/verificacion-s5/` y no por CONCEPTO. Es el mismo
// tropiezo que confiesa la cabecera de SCRUM-738. Mi motor se retiró: la misma regla dos veces es
// cómo una de las dos se queda atrás.
//
// Lo que SÍ faltaba, y es lo único que este fichero añade:
//   ① el CRUCE con Jira — `censo-tablero-vs-arbol.mjs` lo dice en su salida: «este censo no lee
//     Jira. Se cruza a mano». Aquí entra una foto de los ABIERTOS, con fecha y caducidad;
//   ② la trampa del número AJENO — SCRUM-1200 quedó «cerrado aquí» en `SCRUM-1216.md` §⑦, y el
//     motor sólo mira la entrada propia. Se busca el número en TODO `docs/master/`, separando la
//     línea que DICE cierre de la que sólo cita;
//   ③ el MOTIVO ESCRITO para seguir abierto con trabajo dentro (Jira espera a otro, o el título del
//     expediente se declara BLOQUEADO/PARADO…), para que el rojo no acuse a todos.
//
// ── LAS TRES TRAMPAS DEL ENCARGO ─────────────────────────────────────────────────────────────
// ① Por SLUG COMPLETO, nunca por número: la da el motor de 804, que clasifica CADA rama por su
//   nombre entero (`en-main` / `viva`). Una sola rama suya viva hace PARCIAL al ticket.
// ② El número en TODO `docs/master/`: lo añade este fichero (arriba).
// ③ 🔴 LÍMITE DECLARADO, NO RESUELTO: que el DEFECTO esté arreglado sin rama, commit ni expediente
//   con ese número. SCRUM-1101 es el caso real. Sale «SIN RASTRO», que NO es «sin hacer»: para eso,
//   el PASO 0 por CONTENIDO.
//
// ── LA FOTO DE JIRA CADUCA ───────────────────────────────────────────────────────────────────
// Sólo LEE Jira, por una foto que le pasa quien lo corre: el JSON que guarda el MCP de Atlassian
// (`searchJiraIssuesUsingJql`, `statusCategory != Done`, TODAS las páginas) o un TSV
// `clave<TAB>estado<TAB>asunto`. Su fecha es la de modificación del fichero (o `--tomada ISO`). Con
// más de `--horas-max` (12) o sin la última página (`hasNextPage: false`) se declara CIEGO y sale 2
// SIN tocar git: con una foto vieja, «abierto» ya no es una afirmación.
//
// ── SUELO ────────────────────────────────────────────────────────────────────────────────────
// El del motor (`comprobarSuelo` y `motivosParaNoFiarse`) más el suyo: cero abiertos o cero
// expedientes → CIEGO (2), nunca «nada que cerrar». `docs/master/` se lee del árbol donde se corre,
// igual que hace `censarTicket`: se corre desde un árbol al día con `main`.
//
//   node scripts/abierto-con-trabajo-en-main.mjs --jira p1.json p2.json p3.json
//   node scripts/abierto-con-trabajo-en-main.mjs --jira foto.tsv --tomada 2026-09-28T21:04Z
//   node scripts/abierto-con-trabajo-en-main.mjs --jira … --ticket 1200      (el detalle de uno)
//
// Salidas: 0 informe hecho (haya o no candidatos) · 2 CIEGO. Nunca falla un check: sólo informa.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ═══ 1 · LO PURO — sin git ni disco, para poder fabricar casos ══════════════════════════════

/** Un expediente con letra de parte, `SCRUM-<n>b.md`, es del ticket n. */
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
 * su ruido medido (dos de tres líneas el 28-sep). Es un CANDIDATO para leer, nunca un veredicto.
 */
// La frontera es de LETRA Unicode y no `\b`: en JS `\b` no trata «ó» como letra, y «sólo cubre»
// casaba con «lo cubre» (medido en docs/master/SCRUM-1092.md:69).
export const RE_CIERRE = /(?<![\p{L}\p{N}])(cerrad[oa]s? aqu[ií]|cerrad[oa]s? en|arreglad[oa]s? (aqu[ií]|en)|resuelt[oa]s? (aqu[ií]|en)|hech[oa]s? (aqu[ií]|en|bajo)|ya est[aá] (hech|arreglad|en main)|duplicad[oa] de|lo cubre|queda cubiert)/iu;

/**
 * 🟡 LOS DOS MOTIVOS ESCRITOS PARA SEGUIR ABIERTO CON TRABAJO DENTRO, que es el «abierto legítimo»
 * que no se marca en rojo. Medidos sobre los 117 tickets que salían sin ellos el 28-sep-2026:
 *   · el ESTADO de Jira dice que espera a otro (9 «Acción del fundador» y 3 «En revisión»);
 *   · el TÍTULO del expediente propio lo declara (BLOQUEADO, PARADO, «MEDICIÓN, NO se construye»,
 *     «PASO 0», «sin aplicar»…).
 * ⛔ Se probó con el CUERPO del expediente y NO sirve: 95 de 112 tenían «pendiente», «queda»,
 *    «falta»… porque todo expediente habla de lo que queda. Sólo el título es lo que el autor anuncia.
 * No se esconden: salen en su propia sección. Para repartir importa que el trabajo existe; para
 * cerrar, por qué sigue abierto.
 */
export const RE_ESTADO_ESPERA = /acci[oó]n del fundador|en revisi[oó]n/i;
export const RE_TITULO_PARADO = /BLOQUEAD[OA]|PARAD[OA]\b|NO se construye|sin aplicar|PASO 0|investigaci[oó]n|SUELO DISPARADO|no he podido/i;

function tituloDe(lineas) {
  return (lineas.find((l) => /^#\s/.test(l)) || '').replace(/^#\s+/, '');
}

/**
 * El veredicto de UN ticket abierto, sobre lo que ya dijo el MOTOR:
 *   censo:       lo que devuelve `censarTicket(n)` (veredicto ENTERO/PARCIAL/NADA/NO_MEDIBLE, fuentes, …)
 *   rastro:      `rastroDeLosTickets().porTicket.get(n)` → { ramas: [{ nombre, clase: 'en-main' | 'viva' | … }] }
 *   expedientes: Map<fichero, string[]> de `docs/master/*.md`, por líneas (para ② y para el título)
 *   info:        { estado, asunto } de la foto de Jira
 */
export function clasificar(num, { censo, rastro, expedientes }, info = {}) {
  const ramas = rastro?.ramas ?? [];
  const dentro = ramas.filter((r) => r.clase === 'en-main');
  const fuera = ramas.filter((r) => r.clase === 'viva');
  const ciegas = ramas.filter((r) => r.clase !== 'en-main' && r.clase !== 'viva');
  const fuentes = censo?.fuentes ?? [];
  const trabajoDentro = dentro.length > 0 || fuentes.includes('commits') || fuentes.includes('docs/master');

  const re = reMencion(num);
  const cierreAjeno = [];
  let mencionesAjenas = 0;
  const propios = [];
  for (const [f, lineas] of expedientes) {
    if (ticketDeExpediente(f) === num) { propios.push(f); continue; }
    lineas.forEach((l, i) => {
      if (!re.test(l)) return;
      mencionesAjenas++;
      if (RE_CIERRE.test(l)) cierreAjeno.push({ fichero: f, linea: i + 1, texto: l.trim().slice(0, 140) });
    });
  }

  let veredicto;
  let motivo = null;
  if (censo?.veredicto === 'NO_MEDIBLE') { veredicto = 'NO_MEDIBLE'; motivo = censo.porque; }
  else if (ciegas.length) veredicto = 'CIEGO';
  else if (fuera.length && trabajoDentro) veredicto = 'PARCIAL';
  else if (fuera.length) veredicto = 'EN_CURSO';
  else if (trabajoDentro) veredicto = 'CANDIDATO';
  else if (cierreAjeno.length) veredicto = 'CERRADO_EN_OTRO';
  else veredicto = 'SIN_RASTRO';

  // Trabajo dentro y un motivo ESCRITO para seguir abierto: se aparta del rojo, no se esconde.
  if (veredicto === 'CANDIDATO' || veredicto === 'CERRADO_EN_OTRO') {
    const titulos = propios.map((f) => tituloDe(expedientes.get(f)));
    if (censo?.veredicto === 'PARCIAL') motivo = `el motor lo da PARCIAL (marcas sin conectar: ${(censo.marcas || []).join(', ')})`;
    else if (RE_ESTADO_ESPERA.test(info.estado || '')) motivo = `Jira: «${info.estado}»`;
    else {
      const t = titulos.find((x) => RE_TITULO_PARADO.test(x));
      if (t) motivo = `su expediente: «${t.slice(0, 90)}»`;
    }
    if (motivo) veredicto = 'ABIERTO_CON_MOTIVO';
  }

  return { num, veredicto, motivo, dentro, fuera, ciegas, fuentes, commits: censo?.commits ?? [], propios, cierreAjeno, mencionesAjenas };
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

// ═══ 2 · EL INFORME ══════════════════════════════════════════════════════════════════════════

const ETIQUETA = {
  CANDIDATO: '🔴 CANDIDATO — todo lo que se ve de él está en main, y no hay rama suya viva fuera',
  CERRADO_EN_OTRO: '🟠 CERRADO EN OTRO EXPEDIENTE — sin nada propio, pero otro dice que se hizo',
  ABIERTO_CON_MOTIVO: '🟡 TRABAJO EN MAIN Y MOTIVO ESCRITO para seguir abierto — no se marca, pero existe',
  PARCIAL: '🟡 PARCIAL — parte en main y una rama suya viva fuera: abierto con motivo, NO se marca',
  EN_CURSO: '⚪ EN CURSO — sólo ramas vivas sin mergear',
  SIN_RASTRO: '·  SIN RASTRO — nada con su número (≠ «sin hacer»: límite ③)',
  NO_MEDIBLE: '🔴 NO MEDIBLE — el motor no puede atribuirle nada (número compartido o fuente ciega)',
  CIEGO: '🔴 CIEGO — una rama suya no se pudo clasificar (ni en main ni viva)',
};

function pintaUno(r, info) {
  console.log(`\nSCRUM-${r.num}  [${info.estado}]  ${info.asunto.slice(0, 96)}`);
  console.log(`  ${ETIQUETA[r.veredicto]}`);
  if (r.motivo) console.log(`  motivo  · ${r.motivo}`);
  for (const b of r.dentro) console.log(`  rama    · ${b.nombre}  en main`);
  for (const b of r.fuera) console.log(`  rama    · ${b.nombre}  VIVA, sin mergear`);
  for (const b of r.ciegas) console.log(`  rama    · ${b.nombre}  🔴 sin clasificar (${b.clase})`);
  if (r.fuentes.length) console.log(`  motor   · fuentes: ${r.fuentes.join(' · ')}${r.commits.length ? ` (${r.commits.length} commits: ${r.commits.slice(0, 3).map((c) => c.sha).join(' ')}${r.commits.length > 3 ? ' …' : ''})` : ''}`);
  for (const c of r.cierreAjeno.slice(0, 4)) console.log(`  otro    · ${c.fichero}:${c.linea}  «${c.texto}»`);
  if (r.cierreAjeno.length > 4) console.log(`  otro    · … y ${r.cierreAjeno.length - 4} líneas más con palabra de cierre`);
  if (r.mencionesAjenas) console.log(`  citado  · ${r.mencionesAjenas} líneas de otros expedientes lo nombran`);
}

function leerExpedientes(raiz) {
  const dir = path.join(raiz, 'docs', 'master');
  const out = new Map();
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.md')) continue;
    out.set(`docs/master/${f}`, fs.readFileSync(path.join(dir, f), 'utf8').split(/\r?\n/));
  }
  return out;
}

async function principal(argv) {
  const i = argv.indexOf('--jira');
  const ficheros = [];
  if (i >= 0) for (let k = i + 1; k < argv.length && !argv[k].startsWith('--'); k++) ficheros.push(argv[k]);
  const valor = (n, d) => { const j = argv.indexOf(n); return j >= 0 ? argv[j + 1] : d; };
  const horasMax = Number(valor('--horas-max', '12'));
  const uno = valor('--ticket', null);
  const raiz = process.cwd();

  const ciego = [];
  if (!ficheros.length) { console.log('uso: abierto-con-trabajo-en-main.mjs --jira <foto.json|tsv …> [--tomada ISO] [--horas-max 12] [--ticket N]'); return 2; }
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

  // El MOTOR de la casa: se importa aquí para que la parte de la foto no dependa de git.
  const { censarTicket, comprobarSuelo } = await import('../tests/_censo-tickets.mjs');
  const { rastroDeLosTickets } = await import('./_rastro-del-ticket.mjs');
  const suelo = comprobarSuelo({ raiz });
  const rastro = rastroDeLosTickets({ raiz, traer: true });
  const expedientes = leerExpedientes(raiz);
  ciego.push(...suelo, ...rastro.suelo);
  if (expedientes.size === 0) ciego.push(`${raiz} no tiene ningún docs/master/*.md`);

  console.log(`main medido por el motor: ${rastro.inst?.sha ?? '?'}  ·  árbol: ${raiz}`);
  console.log(`foto de Jira: ${abiertos.size} tickets ABIERTOS · tomada ${tomada.toISOString()} (${horas.toFixed(1)} h, tope ${horasMax} h) · ${ficheros.length} fichero(s)`);
  console.log(`ramas remotas: ${rastro.resumen.total} (${rastro.resumen.enMain} en main, ${rastro.resumen.vivas} vivas, ${rastro.resumen.indeterminadas} sin clasificar) · ${expedientes.size} expedientes de docs/master`);
  console.log('motor: tests/_censo-tickets.mjs (SCRUM-388) + scripts/_rastro-del-ticket.mjs (SCRUM-804) — esta pieza cruza con Jira');
  if (ciego.length) { console.log('\n🔴 CIEGO — no se puede responder:'); for (const c of ciego) console.log(`   · ${c}`); return 2; }

  const nums = uno ? [Number(uno)] : [...abiertos.keys()].sort((a, b) => a - b);
  const res = nums.map((n) => clasificar(n, { censo: censarTicket(n, { raiz }), rastro: rastro.porTicket.get(n), expedientes }, abiertos.get(n) ?? {}));
  if (uno) { pintaUno(res[0], abiertos.get(res[0].num) ?? { estado: '(no está entre los abiertos de la foto)', asunto: '' }); return 0; }

  const por = (v) => res.filter((r) => r.veredicto === v);
  console.log(`\nveredictos sobre ${res.length} abiertos: ${Object.keys(ETIQUETA).map((v) => `${v} ${por(v).length}`).join(' · ')}`);
  for (const v of ['CANDIDATO', 'CERRADO_EN_OTRO', 'NO_MEDIBLE', 'CIEGO', 'ABIERTO_CON_MOTIVO', 'PARCIAL']) {
    if (!por(v).length) continue;
    console.log(`\n═══ ${ETIQUETA[v]} — ${por(v).length} ═══`);
    for (const r of por(v)) pintaUno(r, abiertos.get(r.num));
  }
  console.log('\n⚠️  Un CANDIDATO se LEE antes de cerrarlo: un ticket con partes (A18) puede tener la primera en main y');
  console.log('    las demás sin empezar, y eso aquí no se distingue. SIN RASTRO no es «sin hacer» (límite ③).');
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal(process.argv.slice(2)).then((c) => process.exit(c));
}
