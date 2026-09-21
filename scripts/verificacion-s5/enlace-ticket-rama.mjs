// scripts/verificacion-s5/enlace-ticket-rama.mjs — SCRUM-637 · carril de VERIFICACIÓN
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL ENLACE TICKET ↔ RAMA NO SE INVENTA: SE DERIVA DE LO QUE LA CASA YA ESCRIBE.
//
// Hoy vive implícito en tres sitios del repo —el nombre de la rama (`scrum-653-dos-firmas`), el
// mensaje del commit («SCRUM-653: …») y el fichero `docs/master/SCRUM-653.md`— más un cuarto que
// vive FUERA: el asunto del ticket en Jira. Este instrumento los lee los cuatro y dice CUÁNDO NO
// SE PONEN DE ACUERDO. No impone convención nueva y NO falla nada: sólo reporta.
//
// ── POR QUÉ HACEN FALTA LOS CUATRO, Y NO TRES ────────────────────────────────────────────────
// 🔴 El caso que da origen a esto es SCRUM-706, y DENTRO DEL REPO NO SE CONTRADICE: sus commits
// (`c6a38db7`, `903afdb7`), su rama (`scrum-706-cablear-el-dictado`) y su `docs/master/SCRUM-706.md`
// dicen los cuatro «el cable del dictado». Quien sólo mire el repo ve todas las fuentes de acuerdo
// y concluye que no hay problema. La contradicción sólo aparece contra Jira, donde SCRUM-706 es
// «el trinquete del IVA vigila el NOMBRE y no el VALOR». Por eso el asunto de Jira entra como
// CUARTA fuente, en una foto versionada (`docs/verificacion/asuntos-jira.tsv`) y con su fecha a la
// vista: una foto sin fecha es una afirmación sin caducidad.
//
// ── LAS DOS TRAMPAS DE GIT QUE ESTE FICHERO YA SE COMIÓ, MEDIDAS ─────────────────────────────
// 🔴 ① UNA RAMA MERGEADA PUEDE ESTAR BORRADA DEL REMOTO. `scrum-653-dos-firmas` se mergeó en el
//    PR #986 y ya NO aparece en `git ls-remote --heads origin`. Si el censo mirara sólo las ramas
//    vivas, el control positivo nº 1 daría «no existe» — que es un cero con pinta de respuesta.
//    Su nombre sobrevive en el mensaje del commit de merge, y de ahí se recupera.
// 🔴 ② LAS REFS `refs/remotes/origin/*` LOCALES MIENTEN. En este clon hay 560 y en el remoto 550:
//    diez son ramas ya borradas que siguen ahí porque nadie ha hecho `fetch --prune`. La AUTORIDAD
//    de «qué está vivo» es `ls-remote`, nunca las refs locales. Éstas sólo se usan para fechar y
//    para el cálculo de mergeado, y siempre intersectadas con `ls-remote`.
//
// ── SUELO ────────────────────────────────────────────────────────────────────────────────────
// Un CERO nunca es «está limpio»: es «no he mirado». Si `ls-remote` no devuelve ramas, si el
// histórico de merges sale vacío, si la foto de Jira no cubre un número, o si una rama viva no
// tiene ref local con la que fecharla, el instrumento lo DICE en vez de callarlo.
//
// ⛔ ESTA TANDA SÓLO REPORTA. No entra en CI, no tumba ramas, no falla checks. Sale 0 siempre
//    salvo que el propio instrumento se declare ciego (2) o caiga un control (1).
//
// USO:
//   node scripts/verificacion-s5/enlace-ticket-rama.mjs 706        un número
//   node scripts/verificacion-s5/enlace-ticket-rama.mjs --foto     todas las ramas vivas
//   node scripts/verificacion-s5/enlace-ticket-rama.mjs --controles
// ═════════════════════════════════════════════════════════════════════════════════════════════
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const git = (...a) => execFileSync('git', a, { cwd: RAIZ, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const lineas = (s) => s.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
const HOY = new Date();
const dias = (iso) => Math.floor((HOY - new Date(iso)) / 86400000);

// ═══ 0 · CIEGO — el instrumento se niega a opinar antes que dar un cero sin respaldo ═════════
const ciego = [];
function exigir(cond, queja) { if (!cond) ciego.push(queja); }

// ═══ 1 · LAS FUENTES ════════════════════════════════════════════════════════════════════════

/** AUTORIDAD de «qué rama está viva». Nunca `refs/remotes`: ahí hay diez de más. */
const VIVAS = new Map(); // nombre -> sha
for (const l of lineas(git('ls-remote', '--heads', 'origin'))) {
  const m = l.match(/^([0-9a-f]{40})\s+refs\/heads\/(.+)$/);
  if (m) VIVAS.set(m[2], m[1]);
}
exigir(VIVAS.size > 0, 'ls-remote no devolvió ninguna rama: sin esto no se sabe qué está vivo.');

/** Refs locales: SÓLO para fechar y para el cálculo de mergeado. Se intersectan con VIVAS. */
const LOCAL = new Map(); // nombre -> {sha, fecha}
for (const l of lineas(git('for-each-ref', '--format=%(refname:short)|%(objectname)|%(committerdate:short)', 'refs/remotes/origin/'))) {
  const [ref, sha, fecha] = l.split('|');
  LOCAL.set(ref.replace(/^origin\//, ''), { sha, fecha });
}

const MERGEADAS = new Set(lineas(git('branch', '-r', '--merged', 'origin/main')).map((x) => x.replace(/^origin\//, '')));
const SIN_MERGEAR = new Set(lineas(git('branch', '-r', '--no-merged', 'origin/main')).map((x) => x.replace(/^origin\//, '')));
exigir(MERGEADAS.size > 0 && SIN_MERGEAR.size > 0,
  'el reparto mergeadas/sin-mergear salió vacío por un lado: o el repo es raro o la llamada falló.');

/**
 * Histórico de merges: de aquí —y sólo de aquí— salen las ramas MERGEADAS Y BORRADAS.
 * Dos formas, las dos reales en este repo: «Merge pull request #N from lwislg99/<rama>» y
 * «Merge … into <rama>».
 */
const HISTORICO = new Map(); // rama -> {fecha, asunto}
const MERGES = lineas(git('log', '--merges', '--format=%cs|%s', 'origin/main'));
exigir(MERGES.length > 0, 'el histórico de merges salió vacío: las ramas borradas serían invisibles.');
for (const l of MERGES) {
  const i = l.indexOf('|');
  const fecha = l.slice(0, i), asunto = l.slice(i + 1);
  for (const re of [/from\s+[\w.-]+\/([A-Za-z0-9._/-]+)/g, /\binto\s+([A-Za-z0-9._/-]+)/g]) {
    for (const m of asunto.matchAll(re)) {
      const r = m[1].replace(/^origin\//, '');
      if (!HISTORICO.has(r) || HISTORICO.get(r).fecha < fecha) HISTORICO.set(r, { fecha, asunto });
    }
  }
}

/** Commits: dos pasadas y sólo dos. Lo que está en `origin/main` es ancestro; el resto, no. */
const ANCESTROS = new Set();
const COMMITS = []; // {sha, fecha, asunto, ancestro}
for (const l of lineas(git('log', '--format=%H|%cs|%s', 'origin/main'))) {
  const [sha, fecha, ...r] = l.split('|');
  ANCESTROS.add(sha);
  COMMITS.push({ sha, fecha, asunto: r.join('|'), ancestro: true });
}
for (const l of lineas(git('log', '--format=%H|%cs|%s', '--all'))) {
  const [sha, fecha, ...r] = l.split('|');
  if (!ANCESTROS.has(sha)) COMMITS.push({ sha, fecha, asunto: r.join('|'), ancestro: false });
}
exigir(COMMITS.length > 0, 'cero commits leídos.');

/** docs/master/SCRUM-N.md → su asunto es el primer encabezado, que es lo que alguien lee. */
const MASTER = new Map(); // num -> {fichero, asunto}
const dirMaster = path.join(RAIZ, 'docs', 'master');
if (fs.existsSync(dirMaster)) {
  for (const f of fs.readdirSync(dirMaster)) {
    const m = f.match(/^SCRUM-(\d+)\.md$/);
    if (!m) continue;
    const txt = fs.readFileSync(path.join(dirMaster, f), 'utf8');
    const h = (txt.match(/^#\s+(.+)$/m) || [, ''])[1];
    MASTER.set(Number(m[1]), { fichero: f, asunto: h.replace(/^SCRUM-\d+\s*[·:-]\s*/, '') });
  }
}
exigir(MASTER.size > 0, 'docs/master/ no dio ni un fichero SCRUM-N.md.');

/** La CUARTA fuente, la que vive fuera del repo. Foto versionada, con su fecha en la cabecera. */
const JIRA = new Map(); // num -> {estado, asunto}
const fFoto = path.join(RAIZ, 'docs', 'verificacion', 'asuntos-jira.tsv');
let FECHA_FOTO = '(desconocida)';
if (fs.existsSync(fFoto)) {
  for (const l of fs.readFileSync(fFoto, 'utf8').split(/\r?\n/)) {
    const mf = l.match(/Tomada el (\d{4}-\d{2}-\d{2})/); if (mf) FECHA_FOTO = mf[1];
    if (!l || l.startsWith('#')) continue;
    const [k, estado, asunto] = l.split('\t');
    const m = (k || '').match(/^SCRUM-(\d+)$/);
    if (m) JIRA.set(Number(m[1]), { estado, asunto: asunto || '' });
  }
}
exigir(JIRA.size > 0, 'la foto de asuntos de Jira está vacía: sin ella no se puede detectar un número ambiguo.');

// ═══ 2 · ¿HABLAN DE LO MISMO? ═══════════════════════════════════════════════════════════════
//
// Contención, no Jaccard: el slug de una rama son 2-4 palabras y el asunto de Jira son 20. Pedir
// que se parezcan penalizaría a los que SÍ coinciden. Lo que se pregunta es: «¿las palabras del
// lado corto están en el lado largo?».
const VACIAS = new Set(('el la los las un una unos unas de del y e o u en que a al es son ser esta este esto ese esa por para sin con se su sus lo le les no ni si mas ya como cuando donde quien cual todo toda todos todas hay han ha the of and to in for on at is it its from with').split(' '));
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function palabras(s) {
  const out = new Set();
  for (const w of norm(s).split(/[^a-z0-9]+/)) {
    if (w.length < 3 || VACIAS.has(w) || /^\d+$/.test(w) || w === 'scrum') continue;
    // 🔴 EL PLURAL SE QUITA ANTES DE TRUNCAR, y esto lo enseñó un falso positivo medido:
    // truncar a 6 NO une «test»/«tests» ni «aviso»/«avisos» —los dos son más cortos que 6—, así
    // que SCRUM-456 («todo test que salta DIGA POR QUÉ» vs «67 tests saltan MUDOS») salía al 0 %
    // siendo literalmente lo mismo. Un metro que no une singular y plural inventa desacuerdos.
    const r = w.replace(/(es|s)$/, '');
    out.add((r.length >= 3 ? r : w).slice(0, 6));
  }
  return out;
}
/** 0 = no comparten nada · 1 = el lado corto está entero dentro del largo. */
function contencion(a, b) {
  const A = palabras(a), B = palabras(b);
  if (!A.size || !B.size) return null; // NO es 0: es «no se puede comparar», y se dice distinto
  let n = 0; for (const w of A) if (B.has(w)) n++;
  return n / Math.min(A.size, B.size);
}

// El umbral se declara aquí y su reparto se imprime en `--foto`, para que se vea que separa de
// verdad y no está elegido para que salga lo que yo quería.
const UMBRAL = 0.34;

const numDe = (rama) => { const m = rama.match(/^scrum-(\d+)/i); return m ? Number(m[1]) : null; };
const slugDe = (rama) => rama.replace(/^scrum-\d+[a-z]*-?/i, '').replace(/-/g, ' ');

// ═══ 3 · EL INFORME DE UN NÚMERO ════════════════════════════════════════════════════════════
function informe(num) {
  const r = { num, ramasVivas: [], ramasBorradas: [], commits: [], master: MASTER.get(num) || null, jira: JIRA.get(num) || null, desacuerdos: [] };

  for (const [nombre, sha] of VIVAS) {
    if (numDe(nombre) !== num) continue;
    const loc = LOCAL.get(nombre);
    r.ramasVivas.push({
      nombre, sha,
      mergeada: MERGEADAS.has(nombre) ? true : (SIN_MERGEAR.has(nombre) ? false : null),
      fecha: loc ? loc.fecha : null,
      parada: loc ? dias(loc.fecha) : null,
      // Una rama viva sin ref local no se puede fechar: se dice, no se le pone «hoy».
      ciega: !loc,
    });
  }
  for (const [nombre, info] of HISTORICO) {
    if (numDe(nombre) !== num || VIVAS.has(nombre)) continue;
    r.ramasBorradas.push({ nombre, fecha: info.fecha });
  }
  const re = new RegExp(`SCRUM[-\\s]?${num}(?!\\d)`, 'i'); // (?!\d) — SCRUM-70 no es SCRUM-706
  for (const c of COMMITS) if (re.test(c.asunto)) r.commits.push(c);

  // ── Los desacuerdos, que es para lo que existe todo esto ──────────────────────────────────
  const jAs = r.jira ? r.jira.asunto : null;
  if (jAs) {
    if (r.master) {
      const s = contencion(r.master.asunto, jAs);
      if (s !== null && s < UMBRAL) r.desacuerdos.push({ que: 'docs/master', s, a: r.master.asunto, b: jAs });
    }
    for (const b of r.ramasVivas.concat(r.ramasBorradas)) {
      const s = contencion(slugDe(b.nombre), jAs);
      if (s !== null && s < UMBRAL) r.desacuerdos.push({ que: `rama ${b.nombre}`, s, a: slugDe(b.nombre), b: jAs });
    }
  }

  // ── DOS DISCRIMINADORES PROBADOS Y LOS DOS DESCARTADOS, MIDIENDO ──────────────────────────
  // Quise separar una COLISIÓN de un simple sinónimo, porque el cribado léxico marca ~200 de 396
  // números y una lista así no la mira nadie. Probé dos formas y NINGUNA sirve. Queda escrito
  // para que no se vuelvan a intentar a ciegas:
  //
  // ⛔ ① «El trabajo del repo encaja mejor con OTRO ticket». Falso de partida: NO existe ningún
  //    ticket sobre «el cable del dictado». Los mejores candidatos para ese texto salen al 20 % y
  //    por la palabra «cadena». El 706 no apunta a otro ticket: su trabajo real no tiene ticket
  //    propio. Un discriminador que presupone destino no encuentra a los huérfanos.
  // ⛔ ② «Sus commits tocan ficheros bautizados con OTRO número». No discrimina: el 706 tiene UN
  //    fichero con su número (su propio docs/master), exactamente igual que el 653, el 699 o el
  //    728; y tocar ficheros de otros tickets es lo NORMAL (el 653 toca `scrum652`, el 594 toca
  //    `scrum619`, `scrum624` y `scrum697`). Medido sobre ocho números antes de escribir esto.
  //
  // Así que el parecido se queda como lo que es: un CRIBADO con falsos positivos medidos, no un
  // veredicto. El aviso automático necesitaría un discriminador que todavía no existe, y decirlo
  // es parte del resultado.
  r.ambiguo = r.desacuerdos.length > 0;
  r.sinAsuntoJira = !jAs;
  return r;
}

function pinta(r) {
  const t = r.jira ? `${r.jira.estado} · ${r.jira.asunto.slice(0, 88)}` : `🔴 SIN ASUNTO en la foto de Jira del ${FECHA_FOTO} — no se puede juzgar si coincide`;
  console.log(`\nSCRUM-${r.num}  ${t}`);
  if (!r.ramasVivas.length && !r.ramasBorradas.length) console.log('  ramas   · ninguna (ni viva ni en el histórico de merges)');
  for (const b of r.ramasVivas) {
    console.log(`  rama    · ${b.nombre}  ${b.mergeada === true ? 'VIVA pero YA MERGEADA (se puede borrar)' : b.mergeada === false ? '🔴 VIVA Y SIN MERGEAR' : 'estado de merge DESCONOCIDO'}`
      + (b.ciega ? '  · 🔴 sin ref local: NO se puede fechar' : `  · último commit ${b.fecha} (${b.parada} d)`));
  }
  for (const b of r.ramasBorradas) console.log(`  rama    · ${b.nombre}  MERGEADA Y BORRADA del remoto (merge del ${b.fecha})`);
  const anc = r.commits.filter((c) => c.ancestro).length;
  console.log(`  commits · ${r.commits.length} lo mencionan · ${anc} ancestros de origin/main · ${r.commits.length - anc} fuera`);
  console.log(`  master  · ${r.master ? r.master.fichero + ' — ' + r.master.asunto.slice(0, 76) : 'sin fichero en docs/master/'}`);
  if (r.ambiguo) {
    console.log('  ⚠️ CRIBADO — parecido bajo. NO es un veredicto: puede ser sólo otro vocabulario.');
    for (const d of r.desacuerdos) console.log(`       ${d.que} ↔ Jira  (coincidencia ${(d.s * 100).toFixed(0)} %)\n         repo: ${d.a.slice(0, 84)}\n         jira: ${d.b.slice(0, 84)}`);
  }
}

// ═══ 4 · MODOS ══════════════════════════════════════════════════════════════════════════════
const arg = process.argv[2];

function cabecera() {
  console.log(`ramas vivas (ls-remote): ${VIVAS.size} · refs locales: ${LOCAL.size} (${LOCAL.size - VIVAS.size} obsoletas)`);
  console.log(`merges leídos: ${MERGES.length} · ramas en el histórico: ${HISTORICO.size} · commits: ${COMMITS.length}`);
  console.log(`docs/master: ${MASTER.size} ficheros · foto de Jira: ${JIRA.size} tickets, tomada el ${FECHA_FOTO}`);
  if (ciego.length) { console.log('\n🔴 CIEGO — el instrumento no puede responder:'); for (const c of ciego) console.log('   · ' + c); process.exit(2); }
}

if (arg === '--controles') {
  cabecera();
  console.log('\n═══ CONTROLES ═══════════════════════════════════════════════════════════════════');
  let malo = 0;

  const c653 = informe(653);
  const ok653 = c653.ramasBorradas.some((b) => b.nombre === 'scrum-653-dos-firmas')
    || c653.ramasVivas.some((b) => b.nombre === 'scrum-653-dos-firmas' && b.mergeada === true);
  console.log(`POSITIVO 1 · scrum-653-dos-firmas encontrada y MERGEADA → ${ok653 ? '✅' : '🔴 NO'}`);
  if (!ok653) malo = 1;

  const c818 = informe(818);
  const b818 = c818.ramasVivas.find((b) => b.nombre === 'scrum-818-parte-de-trabajo');
  const ok818 = !!b818 && b818.mergeada === false;
  console.log(`POSITIVO 2 · scrum-818-parte-de-trabajo VIVA Y SIN MERGEAR → ${ok818 ? '✅ (' + b818.parada + ' d parada)' : '🔴 NO'}`);
  if (!ok818) malo = 1;

  const c706 = informe(706);
  const d706 = c706.desacuerdos.find((d) => d.que === 'docs/master');
  console.log(`EL QUE DECIDE · SCRUM-706: su docs/master NO coincide con Jira → ${d706 ? '✅ (' + (d706.s * 100).toFixed(0) + ' % de coincidencia)' : '🔴 NO — el instrumento no sirve para el caso por el que existe'}`);
  if (!d706) malo = 1;

  // NEGATIVO: un acuerdo REAL no puede salir marcado, o «marca todo» pasaría por bueno.
  const dm653 = c653.desacuerdos.find((d) => d.que === 'docs/master');
  console.log(`NEGATIVO · SCRUM-653: su docs/master SÍ coincide y NO se marca → ${dm653 ? '🔴 marcado: el metro marca todo' : '✅'}`);
  if (dm653) malo = 1;

  const suelo = c818.ramasVivas.length > 0 && c653.commits.length > 0;
  console.log(`SUELO · un número con rama y commits conocidos NO devuelve cero → ${suelo ? '✅' : '🔴 CIEGO'}`);
  if (!suelo) malo = 1;

  for (const n of [653, 818, 706]) pinta(informe(n));
  process.exit(malo ? 1 : 0);
}

if (arg === '--foto') {
  cabecera();
  const nums = [...new Set([...VIVAS.keys()].map(numDe).filter((n) => n !== null))].sort((a, b) => a - b);
  const sinNumero = [...VIVAS.keys()].filter((r) => numDe(r) === null).sort();
  const infs = nums.map(informe);

  const vivasSinMergear = [];
  for (const r of infs) for (const b of r.ramasVivas) if (b.mergeada === false) vivasSinMergear.push({ ...b, num: r.num, jira: r.jira });
  vivasSinMergear.sort((a, b) => (b.parada ?? -1) - (a.parada ?? -1));

  // El estado del ticket es lo que separa «trabajo perdido» de «resto que nadie barrió»: una rama
  // sin mergear cuyo ticket está Finalizada es basura; una cuyo ticket sigue vivo es trabajo.
  const vivo = (b) => b.jira && !/finalizada/i.test(b.jira.estado);
  console.log(`\n═══ ① RAMAS VIVAS SIN MERGEAR — ${vivasSinMergear.length} de ${VIVAS.size} ═══════════════════════════`);
  console.log(`   ⚠️  ${vivasSinMergear.filter(vivo).length} con el ticket AÚN ABIERTO — esto es lo que puede ser trabajo perdido`);
  console.log(`      ${vivasSinMergear.filter((b) => !vivo(b)).length} con el ticket ya Finalizada — resto que nadie barrió\n`);
  console.log('parada  ticket      estado Jira        rama');
  for (const b of vivasSinMergear) {
    console.log(`${String(b.parada ?? '??').padStart(4)} d  SCRUM-${String(b.num).padEnd(5)} ${String(b.jira ? b.jira.estado : '🔴 sin asunto').padEnd(18)} ${vivo(b) ? '⚠️ ' : '   '}${b.nombre}`);
  }

  const amb = infs.filter((r) => r.ambiguo);
  const porMaster = amb.filter((r) => r.desacuerdos.some((d) => d.que === 'docs/master'))
    .map((r) => ({ r, s: r.desacuerdos.find((d) => d.que === 'docs/master').s }))
    .sort((a, b) => a.s - b.s);
  console.log(`\n═══ ② CRIBADO DE NÚMEROS AMBIGUOS — ${amb.length} marcados, ${porMaster.length} por docs/master ═══`);
  console.log('   Sólo se listan los de docs/master: es un registro de trabajo completo. El slug de');
  console.log('   una rama son 2-4 palabras y su desacuerdo casi nunca significa nada.');
  console.log('   De peor a mejor parecido — para mirar a ojo, NO para actuar en automático:');
  for (const { r, s } of porMaster.slice(0, 30)) {
    console.log(`\n  ${(s * 100).toFixed(0).padStart(3)} %  SCRUM-${r.num}  [${r.jira.estado}]`);
    console.log(`         repo: ${r.master.asunto.slice(0, 92)}`);
    console.log(`         jira: ${r.jira.asunto.slice(0, 92)}`);
  }
  if (porMaster.length > 30) console.log(`\n  … y ${porMaster.length - 30} más, entre ${(porMaster[30].s * 100).toFixed(0)} % y ${(porMaster[porMaster.length - 1].s * 100).toFixed(0)} %.`);

  const sinAsunto = infs.filter((r) => r.sinAsuntoJira);
  console.log(`\n═══ ③ DECLARADOS, no callados ══════════════════════════════════════════════════`);
  console.log(`ramas vivas SIN número de ticket (${sinNumero.length}): ${sinNumero.join(', ')}`);
  console.log(`números sin asunto en la foto de Jira (${sinAsunto.length}): ${sinAsunto.map((r) => r.num).join(', ') || 'ninguno'}`);
  const ciegas = infs.flatMap((r) => r.ramasVivas.filter((b) => b.ciega).map((b) => b.nombre));
  console.log(`ramas vivas que no se pueden fechar (${ciegas.length}): ${ciegas.join(', ') || 'ninguna'}`);
  const yaMergeadas = infs.flatMap((r) => r.ramasVivas.filter((b) => b.mergeada === true).map((b) => b.nombre));
  console.log(`ramas vivas YA MERGEADAS, borrables: ${yaMergeadas.length}`);

  // El reparto del parecido, para que el umbral se vea en vez de creerse.
  const todas = [];
  for (const r of infs) {
    if (!r.jira) continue;
    for (const b of r.ramasVivas.concat(r.ramasBorradas)) { const s = contencion(slugDe(b.nombre), r.jira.asunto); if (s !== null) todas.push(s); }
    if (r.master) { const s = contencion(r.master.asunto, r.jira.asunto); if (s !== null) todas.push(s); }
  }
  const cubos = [0, 0, 0, 0, 0];
  for (const s of todas) cubos[Math.min(4, Math.floor(s * 5))]++;
  console.log(`\n═══ ④ REPARTO DEL PARECIDO (n=${todas.length}, umbral ${UMBRAL}) ══════════════════════════`);
  const et = ['0-20 %', '20-40 %', '40-60 %', '60-80 %', '80-100 %'];
  cubos.forEach((c, i) => console.log(`  ${et[i].padStart(8)}  ${'█'.repeat(Math.round(c / Math.max(1, Math.max(...cubos)) * 46))} ${c}`));
  console.log('  El umbral vale si los dos montones están separados. Si el reparto es plano, el');
  console.log('  número que sale de aquí es una opinión con decimales y hay que decirlo.');
  process.exit(0);
}

const n = Number(String(arg || '').replace(/\D/g, ''));
if (!n) { console.log('uso: enlace-ticket-rama.mjs <numero> | --foto | --controles'); process.exit(2); }
cabecera();
pinta(informe(n));
