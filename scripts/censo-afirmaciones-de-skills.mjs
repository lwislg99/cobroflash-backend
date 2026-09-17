// scripts/censo-afirmaciones-de-skills.mjs — SCRUM-939
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// UNA SKILL DECLARADA OBLIGATORIA CONTIENE UN DATO FALSO
//
// `cerebro-yaqu` —que se carga SIEMPRE— «corrigió» a una sesión diciendo que `gh` está en
// `C:\Program Files\GitHub CLI\gh.exe`. No existe. Una skill obligatoria no es documentación: es
// una instrucción que se ejecuta sin que nadie la revise, y un dato falso ahí se propaga a cada
// sesión que la carga.
//
// Esto CUENTA Y LISTA. ⛔ NO corrige ninguna skill: su contenido es gobierno (S0), y algunas
// obligan sobre materia fiscal o microcopy.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// ① QUÉ ES «OBLIGATORIA» — el léxico se DERIVA, no se escribe aquí
//
// El censo de anoche contó `obligatori*` y se le escaparon las que obligan diciendo «SIEMPRE».
// Así que aquí se prueban los marcadores contra el corpus y se declara cuáles atan de verdad:
//
//   · `obligatori*`  → yaqu-premium-ui, yaqu-verifactu-sif
//   · `siempre`      → cerebro-yaqu («Usar SIEMPRE al arrancar»), verifactu («Úsala SIEMPRE que»)
//
// ⚠️ Y SE MIRA SÓLO LA DESCRIPCIÓN DEL FRONTMATTER, no el cuerpo. `yaqu-wa-templates` dice
// «leer SIEMPRE antes de dictar nada» EN SU CUERPO: eso obliga a quien ya abrió la skill, no
// obliga a abrirla. Contarla habría dado 5 donde hay 4 — el mismo inflado del denominador que
// este censo evita en las afirmaciones.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// ② QUÉ ES «COMPROBABLE» — que el árbol o la máquina puedan decir sí o no
//
// Se extraen SÓLO tokens que tienen dueño verificable:
//
//   RUTA      un fichero o directorio del repo           → ¿existe?
//   COMANDO   `npm run <x>`                              → ¿está en package.json?
//   BINARIO   un ejecutable nombrado como disponible     → ¿se resuelve en el PATH?
//   REGLA     `regla <n>` del máster                     → ¿existe esa regla?
//
// 🔴 LO NO COMPROBABLE NO CUENTA COMO CIERTO: cuenta del lado malo, y se dice.
//
// 🔴 Y UNA FRASE DE CRITERIO NO ENTRA EN EL DENOMINADOR. «Prefiere lo simple» no es verificable
// ni falsable: meterla llenaría el denominador de lo que no se decide y haría bajar el porcentaje
// de falsas sin que nada mejore. El extractor la deja fuera POR CONSTRUCCIÓN —no contiene ningún
// token con dueño— y hay un control que lo comprueba.
//
// SUELO: cero skills obligatorias = CIEGO, salida 2.
// ═════════════════════════════════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const RAIZ = path.resolve(import.meta.dirname, '..');
const DIR = path.join(RAIZ, '.claude', 'skills');

// ── ① Las obligatorias, derivadas del frontmatter ────────────────────────────────────────────

/** La `description:` del frontmatter YAML, sin el cuerpo. */
export function descripcionDe(fuente) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(fuente);
  if (!m) return '';
  const fm = m[1];
  const d = /^description:\s*([\s\S]*?)(?=\n[a-z][a-z-]*:|$)/m.exec(fm);
  return d ? d[1].replace(/\s+/g, ' ').trim() : '';
}

/** ¿Obliga a cargarse? Se mira SÓLO la descripción. */
export function obliga(descripcion) {
  const d = descripcion.toLowerCase();
  if (/obligatori/.test(d)) return 'obligatoria';
  if (/siempre/.test(d)) return 'siempre';
  return null;
}

// ── ② Las afirmaciones comprobables ──────────────────────────────────────────────────────────

const EXT = /\.(md|ts|mjs|js|json|css|html|sql|prisma|xsd|txt|png|zip|exe)$/i;

/**
 * Extrae de una línea los tokens con dueño verificable. Devuelve [] si la línea es prosa,
 * criterio o estilo — y ESO es lo que mantiene el denominador honesto.
 */
export function afirmacionesDe(linea) {
  const out = [];
  // Sólo lo que va entre comillas invertidas: el resto es redacción.
  for (const m of linea.matchAll(/`([^`]+)`/g)) {
    const t = m[1].trim();
    if (/^npm run [a-z0-9:_-]+$/i.test(t)) { out.push({ tipo: 'COMANDO', valor: t.replace(/^npm run /i, '') }); continue; }
    if (/^[A-Za-z]:\\/.test(t) || /^"[A-Za-z]:\\/.test(t)) { out.push({ tipo: 'RUTA_ABS', valor: t.replace(/^"|"$/g, '') }); continue; }
    if (EXT.test(t) || /^(docs|src|scripts|public|tests|prisma|\.claude|\.github)\//.test(t)) {
      out.push({ tipo: 'RUTA', valor: t.split(/[\s(]/)[0] }); continue;
    }
  }
  for (const m of linea.matchAll(/\bregla\s+(\d+)\b/gi)) out.push({ tipo: 'REGLA', valor: m[1] });
  return out;
}

// ── Verificación ─────────────────────────────────────────────────────────────────────────────

let SCRIPTS = {};
try { SCRIPTS = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8')).scripts || {}; } catch { /* suelo abajo */ }

let MASTER = '';
try { MASTER = fs.readFileSync(path.join(RAIZ, 'docs', 'YAQU_MASTER.md'), 'utf8'); } catch { /* suelo abajo */ }

function enElPath(bin) {
  try { execFileSync(process.platform === 'win32' ? 'where' : 'which', [bin], { stdio: ['ignore', 'pipe', 'pipe'] }); return true; }
  catch { return false; }
}

/**
 * Índice de nombres de fichero del árbol. Hace falta porque una skill cita `verifactu.service.ts`
 * sin su carpeta, y eso NO afirma «está en la raíz»: afirma «este fichero existe».
 */
const PORNOMBRE = (() => {
  const m = new Map();
  const rec = (d) => {
    let e;
    try { e = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const x of e) {
      if (x.isDirectory()) { if (!['node_modules', 'dist', '.git'].includes(x.name)) rec(path.join(d, x.name)); continue; }
      const rel = path.relative(RAIZ, path.join(d, x.name)).split(path.sep).join('/');
      if (!m.has(x.name)) m.set(x.name, []);
      m.get(x.name).push(rel);
    }
  };
  rec(RAIZ);
  return m;
})();

/**
 * 🔴 ESTE CENSO NO LEE NEGACIONES, y lo dice en vez de acusar.
 *
 * `yaqu-verifactu-sif:88` afirma que `docs/VERIFACTU_EVIDENCIAS.md` **NO existe** — y tiene razón.
 * Mi extractor veía la ruta, comprobaba que no está y la marcaba FALSA: la skill acertaba y el
 * instrumento la acusaba. Una afirmación NEGADA necesita leer la polaridad de la frase, y eso ya
 * no es «el árbol dice sí o no»: es interpretar castellano.
 *
 * Así que cuando la línea niega, va a NO COMPROBABLE —del lado malo— en vez de a FALSA. Contarla
 * como cierta sería fiarse de una lectura que este censo no hace.
 */
const NIEGA = /\bno existe\b|\bno hay\b|\bNO CONSTRUIDO\b|\bno está\b|\bya no\b/i;

export function verificar(a, linea = '') {
  if (NIEGA.test(linea)) {
    return { veredicto: 'NO COMPROBABLE', evidencia: 'la línea NIEGA, y este censo no lee polaridad' };
  }
  if (a.tipo === 'RUTA') {
    // 🔴 UNA PLANTILLA NO ES UNA AFIRMACIÓN. `docs/master/SCRUM-<n>.md` describe una FORMA, no
    // dice que exista un fichero llamado así. Meterla como falsa fue el primer inflado de este
    // censo: 20 «falsas» de las que 19 lo eran por cómo yo extraía, no por lo que la skill dice.
    if (/[<>{}*]/.test(a.valor)) {
      return { veredicto: 'NO COMPROBABLE', evidencia: 'es una plantilla con hueco, no una ruta concreta' };
    }
    // Con carpeta: la ruta se afirma entera. Sin carpeta: se afirma que el fichero EXISTE.
    if (a.valor.includes('/')) {
      const ok = fs.existsSync(path.join(RAIZ, a.valor));
      return { veredicto: ok ? 'CIERTA' : 'FALSA', evidencia: ok ? 'existe en el árbol' : 'no existe en el árbol' };
    }
    const donde = PORNOMBRE.get(a.valor);
    return donde
      ? { veredicto: 'CIERTA', evidencia: `existe: ${donde[0]}${donde.length > 1 ? ` (+${donde.length - 1})` : ''}` }
      : { veredicto: 'FALSA', evidencia: 'no existe ningún fichero con ese nombre en el árbol' };
  }
  if (a.tipo === 'RUTA_ABS') {
    const ok = fs.existsSync(a.valor);
    return { veredicto: ok ? 'CIERTA' : 'FALSA', evidencia: ok ? 'existe en el disco' : 'NO existe en el disco' };
  }
  if (a.tipo === 'COMANDO') {
    const ok = Object.prototype.hasOwnProperty.call(SCRIPTS, a.valor);
    return { veredicto: ok ? 'CIERTA' : 'FALSA', evidencia: ok ? 'está en package.json' : 'NO está en package.json' };
  }
  if (a.tipo === 'REGLA') {
    const ok = new RegExp(`(^|\\n)\\s*\\*?\\*?${a.valor}[.)]`, 'm').test(MASTER) || new RegExp(`regla\\s+${a.valor}\\b`, 'i').test(MASTER);
    return { veredicto: ok ? 'CIERTA' : 'NO COMPROBABLE', evidencia: ok ? 'el máster la nombra' : 'no se localiza en el máster' };
  }
  return { veredicto: 'NO COMPROBABLE', evidencia: 'tipo sin verificador' };
}

// ── Barrido ──────────────────────────────────────────────────────────────────────────────────

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  let carpetas = [];
  try { carpetas = fs.readdirSync(DIR, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); } catch { /* suelo */ }

  const obligatorias = [];
  for (const nombre of carpetas) {
    const f = path.join(DIR, nombre, 'SKILL.md');
    if (!fs.existsSync(f)) continue;
    const fuente = fs.readFileSync(f, 'utf8');
    const por = obliga(descripcionDe(fuente));
    if (por) obligatorias.push({ nombre, f, fuente, por });
  }

  if (obligatorias.length === 0) {
    console.error(`🔴 CIEGO: 0 skills obligatorias sobre ${carpetas.length} carpetas. El barrido no encuentra el léxico.`);
    process.exit(2);
  }
  if (!Object.keys(SCRIPTS).length || !MASTER) {
    console.error('🔴 CIEGO: sin `package.json#scripts` o sin el máster no se puede verificar nada.');
    process.exit(2);
  }

  const filas = [];
  let lineasTotales = 0;
  let lineasConAfirmacion = 0;
  for (const s of obligatorias) {
    const lineas = s.fuente.split(/\r?\n/);
    for (let i = 0; i < lineas.length; i++) {
      const l = lineas[i];
      if (!l.trim() || /^#{1,6}\s/.test(l) || /^---$/.test(l)) continue;
      lineasTotales++;
      const afs = afirmacionesDe(l);
      if (!afs.length) continue;
      lineasConAfirmacion++;
      for (const a of afs) filas.push({ skill: s.nombre, linea: i + 1, ...a, ...verificar(a, l) });
    }
  }

  const ciertas = filas.filter((f) => f.veredicto === 'CIERTA');
  const falsas = filas.filter((f) => f.veredicto === 'FALSA');
  const nc = filas.filter((f) => f.veredicto === 'NO COMPROBABLE');
  const pct = (n, d) => (d ? `${Math.round((n / d) * 100)} %` : '—');

  console.log('SCRUM-939 · AFIRMACIONES DE LAS SKILLS OBLIGATORIAS\n');
  const fallosControl = controles();
  console.log('── CONTROLES (en cada ejecución) ──');
  if (fallosControl.length) {
    console.log('🔴 FALLIDOS:');
    for (const f of fallosControl) console.log(`   ${f}`);
  } else {
    console.log('✅ POSITIVO: la ruta de `gh` sale FALSA por el EJE de la ruta, no por mencionar «gh»');
    console.log('✅ NEGATIVO: una afirmación cierta sale CIERTA (no acusa a todo)');
    console.log('✅ SEGUNDO NEGATIVO: tres frases de criterio NO entran en el denominador');
  }
  console.log('');
  console.log('── ① LAS OBLIGATORIAS (léxico derivado del corpus) ──');
  console.log(`carpetas de skill examinadas ......... ${carpetas.length}`);
  console.log(`OBLIGATORIAS ......................... ${obligatorias.length}`);
  for (const s of obligatorias) console.log(`   · ${s.nombre.padEnd(20)} (obliga por «${s.por}»)`);
  console.log('');
  console.log('── ② LAS DOS CIFRAS ──');
  console.log(`líneas con contenido en las 4 ........ ${lineasTotales}`);
  console.log(`de ellas CON afirmación comprobable .. ${lineasConAfirmacion}   ${pct(lineasConAfirmacion, lineasTotales)}`);
  console.log(`líneas SIN nada comprobable .......... ${lineasTotales - lineasConAfirmacion}   ${pct(lineasTotales - lineasConAfirmacion, lineasTotales)}  ← del lado malo`);
  console.log('');
  console.log(`afirmaciones comprobables extraídas .. ${filas.length}`);
  console.log(`   CIERTAS ........................... ${ciertas.length}   ${pct(ciertas.length, filas.length)}`);
  console.log(`   🔴 FALSAS ......................... ${falsas.length}   ${pct(falsas.length, filas.length)}`);
  console.log(`   NO COMPROBABLES ................... ${nc.length}   ${pct(nc.length, filas.length)}  ← del lado malo`);
  console.log('');
  console.log('── 🔴 LAS FALSAS, UNA A UNA ──');
  for (const f of falsas) console.log(`  ${f.skill}:${f.linea}  [${f.tipo}]  ${f.valor}\n      → ${f.evidencia}`);
  if (nc.length) {
    console.log('');
    console.log('── NO COMPROBABLES ──');
    for (const f of nc) console.log(`  ${f.skill}:${f.linea}  [${f.tipo}]  ${f.valor} → ${f.evidencia}`);
  }

  if (fallosControl.length) process.exit(2);
  process.exit(falsas.length ? 1 : 0);
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LOS CONTROLES, que corren en CADA ejecución (no se confía en que se corrieran una vez)
// ═════════════════════════════════════════════════════════════════════════════════════════════

export function controles() {
  const fallos = [];

  // 🔴 POSITIVO · la ruta de `gh` sale FALSA, y POR EL EJE CORRECTO: porque la ruta no existe,
  // no porque la línea mencione `gh`.
  // La barra invertida va DOBLE: en un literal de JS `\P` es una `P` y el control se caía solo,
  // diciendo que no extraía la ruta cuando lo que pasaba es que la ruta no tenía barras.
  const gh = afirmacionesDe('- `gh` está instalado FUERA del PATH (`"C:\\Program Files\\GitHub CLI\\gh.exe"`).');
  const rutaGh = gh.find((a) => a.tipo === 'RUTA_ABS');
  if (!rutaGh) fallos.push('POSITIVO: no se extrae la RUTA_ABS de gh (se estaría cazando por mencionar «gh», que es el eje equivocado)');
  else {
    const v = verificar(rutaGh, '');
    if (v.veredicto !== 'FALSA') fallos.push(`POSITIVO: la ruta de gh sale ${v.veredicto} y esa ruta no existe`);
  }

  // ✅ NEGATIVO · una afirmación CIERTA sale CIERTA. Un instrumento que marca todo falso no
  // verifica: acusa.
  const ok = afirmacionesDe('Lee `docs/YAQU_MASTER.md` y corre `npm run build`.');
  if (ok.length !== 2) fallos.push(`NEGATIVO: se esperaban 2 afirmaciones de una línea cierta y salen ${ok.length}`);
  for (const a of ok) {
    const v = verificar(a, '');
    if (v.veredicto !== 'CIERTA') fallos.push(`NEGATIVO: «${a.valor}» sale ${v.veredicto} y es cierta`);
  }

  // 🔴 SEGUNDO NEGATIVO · una frase de CRITERIO no entra en el denominador. Si entrara, el
  // denominador se llenaría de lo que no se decide y el porcentaje de falsas bajaría solo.
  for (const frase of [
    'Prefiere lo simple sobre lo complejo.',
    'Cuando dudes, para y pregunta al fundador.',
    'El microcopy se propone y se para.',
  ]) {
    const a = afirmacionesDe(frase);
    if (a.length) fallos.push(`SEGUNDO NEGATIVO: una frase de criterio entra en el censo → «${frase}» dio ${JSON.stringify(a)}`);
  }

  return fallos;
}
