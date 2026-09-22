// scripts/censo-bancos-fijados.mjs — SCRUM-903 fase c
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// ¿CUÁNTOS BANCOS ESTÁN FIJADOS EN UN ESTADO?
//
// Un guard puede estar en el sitio correcto, declarar la población correcta, y no ver nada
// porque SU BANCO FIJA UN ESTADO. Pasó dos veces el mismo día, en dos guards distintos:
//
//   · `guard-marcadores-en-pantalla.mjs:194` hace `v.estado = 'borrador'` a TODO albarán que
//     sirve. La vista `albaran-detail` está entre las 27 vigiladas — pero su banco nunca sirve
//     un albarán `firmado`, que es donde vivía el marcador de SCRUM-895.
//   · el banco de `scrum667-marcador-visible` genera su albarán con `firmadoPorCalidad: null`,
//     así que la rama que pinta la etiqueta de calidad no se ejercita jamás.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// 🔴 SON DOS FAMILIAS, NO UNA. Medido al construir esto, y es el hallazgo que ordena el censo.
//
// El primer criterio que escribí derivaba el dominio de un campo de los valores que ese campo
// toma en el árbol. **Falló los DOS controles positivos, y por motivos OPUESTOS:**
//
//   · `estado` tiene **44 valores distintos** en el árbol, porque el nombre lo comparten el
//     albarán, la factura, el trabajo, el bot y media docena de censos. Un dominio por nombre de
//     campo no existe: `'borrador'` y `'refunded'` no son el mismo eje.
//   · `firmadoPorCalidad` tiene **uno**, `null`, así que no parecía dominio ninguno.
//
// De ahí las dos familias, que se cuentan y se ordenan por separado:
//
//   ① PARCIAL — el banco sirve k de N valores de un dominio DECLARADO en el árbol. El enlace es
//      por VALOR, no por nombre de campo: `'borrador'` pertenece al dominio declarado
//      `borrador | emitido | firmado`, y quien lo asigna está tocando ESE eje.
//   ② AUSENTE — el banco fija un campo en `null`/`''` mientras ese mismo campo recibe valores
//      reales en otro sitio del árbol. No es «sirve pocos»: es que la rama con dato no corre.
//
// Sin la ②, el caso de SCRUM-667 no sale. Sin la ①, no sale el de SCRUM-895. Un criterio que sólo
// ve la mitad de su familia no mide: opina. (Es la lección del censo de marcadores que daba «250
// superficies» propagando por identificador: el número salía, y no era el número.)
//
// NO se usa una lista de nombres de campos de estado: una lista de nombres envejece (SCRUM-199) y
// decidiría de antemano lo que el censo tiene que descubrir.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// DE DÓNDE SALEN LOS DOMINIOS DECLARADOS — del árbol, nunca escritos aquí
//
//   · `prisma/schema.prisma`: columnas con su dominio en el comentario de línea
//     (`estado String @default("borrador") // borrador | emitido | firmado (Parte L)`).
//   · `src/` y `public/`: arrays de literales de cadena declarados como dominio
//     (`export const FIRMANTE_CALIDAD_IDS = [...] as const`, `const ALBARAN_STATES = [...]`).
//
// Se descartan los de menos de 2 valores (sin rama que perderse) y los que parecen texto libre
// (valores con espacios o de más de 40 caracteres). Los cortes se declaran porque MUEVEN el
// resultado y quien lea el número tiene que poder discutirlos.
//
// ⛔ NO ARREGLA NADA (regla 9). Cuenta y ordena.
//
// SUELO: 0 ficheros con banco, o 0 dominios declarados = CIEGO, salida 2.
// CONTROL POSITIVO: los DOS casos conocidos tienen que salir acusados, cada uno en SU familia.
// CONTROL NEGATIVO: tiene que haber bancos que recorren su dominio entero y salen limpios.
// ═════════════════════════════════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const RAIZ = path.resolve(import.meta.dirname, '..');
const MAX_LARGO = 40;
const YO = 'scripts/censo-bancos-fijados.mjs'; // el censo no se audita a sí mismo

/**
 * Los casos que este censo TIENE que reconocer, cada uno en su familia, o se declara ciego.
 *
 * 🔴 EL POSITIVO EXIGE EL EJE, NO SÓLO EL FICHERO. La primera versión daba el control por bueno
 * porque `guard-marcadores-en-pantalla` salía acusado… por el eje `schema:plan` (sirve 1 de
 * trial|basic|pro|empresa). Acertaba la respuesta conocida POR EL MOTIVO EQUIVOCADO, que es no
 * tener control. Ahora se exige que falten EXACTAMENTE los estados del albarán que su banco no
 * sirve, que es el defecto que SCRUM-895 midió.
 */
const CONOCIDOS = [
  { familia: 'PARCIAL', fichero: 'scripts/guard-marcadores-en-pantalla.mjs', faltan: ['emitido', 'firmado'] },
  { familia: 'AUSENTE', fichero: 'tests/scrum667-marcador-visible.test.mjs', pista: 'firmadoPorCalidad' },
];

// `…` y `...` aparecen en los comentarios del esquema como «y algunos más» (`quote | invoice |
// digest | ...`). No son valores: son la confesión de que la lista está abreviada. Se descartan,
// y por eso un dominio así cuenta un valor menos — es más honesto que inventarse el que falta.
const esValorDeDominio = (v) => typeof v === 'string' && v.length > 0 && v.length <= MAX_LARGO
  && !/\s/.test(v) && /[A-Za-z0-9]/.test(v);

// ── 1 · Los dominios DECLARADOS ──────────────────────────────────────────────────────────────

const dominios = []; // { nombre, valores:Set, origen }

// (a) comentarios de columna del esquema: `// a | b | c`
for (const linea of fs.readFileSync(path.join(RAIZ, 'prisma/schema.prisma'), 'utf8').split(/\r?\n/)) {
  const m = /^\s+([a-zA-Z]+)\s+String[?]?\s.*?\/\/\s*(.+)$/.exec(linea);
  if (!m) continue;
  // Se corta el paréntesis final del tipo «(Parte L)», que es procedencia y no un valor.
  const crudo = m[2].replace(/\([^)]*\)\s*$/, '').trim();
  if (!crudo.includes('|')) continue;
  const vals = crudo.split('|').map((s) => s.trim()).filter(Boolean);
  if (vals.length < 2 || !vals.every(esValorDeDominio)) continue;
  dominios.push({ nombre: `schema:${m[1]}`, valores: new Set(vals), origen: 'prisma/schema.prisma' });
}

// (b) arrays de literales declarados en el producto
function arraysDeLiterales(fuente, rel) {
  const sf = ts.createSourceFile(rel, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const out = [];
  const visitar = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      let ini = n.initializer;
      if (ts.isAsExpression(ini)) ini = ini.expression;
      if (ts.isArrayLiteralExpression(ini) && ini.elements.length >= 2
          && ini.elements.every((e) => ts.isStringLiteral(e) && esValorDeDominio(e.text))) {
        out.push({ nombre: n.name.text, valores: new Set(ini.elements.map((e) => e.text)) });
      }
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return out;
}

// ── Barrido de ficheros ──────────────────────────────────────────────────────────────────────

const AMBITOS = [
  { raiz: 'tests', exts: ['.mjs'], banco: true },
  { raiz: 'scripts', exts: ['.mjs'], banco: true },
  { raiz: 'src', exts: ['.ts'], banco: false },
  { raiz: 'public', exts: ['.js'], banco: false },
];

function ficheros(dir, exts) {
  const out = [];
  const rec = (d) => {
    let e;
    try { e = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const x of e) {
      const p = path.join(d, x.name);
      if (x.isDirectory()) { if (x.name !== 'node_modules' && x.name !== 'dist') rec(p); continue; }
      if (exts.includes(path.extname(x.name))) out.push(p);
    }
  };
  rec(path.join(RAIZ, dir));
  return out;
}

function literalDe(nodo) {
  if (!nodo) return undefined;
  if (ts.isStringLiteral(nodo) || ts.isNoSubstitutionTemplateLiteral(nodo)) return nodo.text;
  if (nodo.kind === ts.SyntaxKind.NullKeyword) return null;
  return undefined;
}

/** Asignaciones `campo: <literal>` y `x.campo = <literal>`, por AST — no por grep. */
function asignaciones(fuente, rel) {
  const sf = ts.createSourceFile(rel, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const out = [];
  const visitar = (n) => {
    if (ts.isPropertyAssignment(n) && (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name))) {
      const v = literalDe(n.initializer);
      if (v !== undefined) out.push({ campo: n.name.text, valor: v, linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1 });
    }
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(n.left)) {
      const v = literalDe(n.right);
      if (v !== undefined) out.push({ campo: n.left.name.text, valor: v, linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1 });
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return out;
}

const porFichero = new Map();
const esBanco = new Map();
let leidos = 0;

for (const a of AMBITOS) {
  for (const abs of ficheros(a.raiz, a.exts)) {
    const rel = path.relative(RAIZ, abs).split(path.sep).join('/');
    if (rel === YO) continue;
    let fuente;
    try { fuente = fs.readFileSync(abs, 'utf8'); } catch { continue; }
    leidos++;
    porFichero.set(rel, asignaciones(fuente, rel));
    esBanco.set(rel, a.banco);
    if (!a.banco) for (const d of arraysDeLiterales(fuente, rel)) dominios.push({ ...d, nombre: `${d.nombre}`, origen: rel });
  }
}

// Campos que reciben algún literal NO vacío en algún sitio del árbol — para la familia AUSENTE.
const camposConValorReal = new Map(); // campo → Set(fichero)
const valoresAsignadosEnElArbol = new Set();
for (const [rel, lista] of porFichero) {
  for (const { campo, valor } of lista) {
    if (valor === null || valor === '') continue;
    valoresAsignadosEnElArbol.add(valor);
    if (!camposConValorReal.has(campo)) camposConValorReal.set(campo, new Set());
    camposConValorReal.get(campo).add(rel);
  }
}

// 🔴 UN ARRAY DE LITERALES NO ES UN DOMINIO POR SER UN ARRAY. Medido al construir esto:
// `REVISION_HEREDA` —la lista de campos que hereda una revisión de presupuesto— tiene 24 cadenas
// cortas y salía como «dominio de 24 valores», llenando la cabeza del listado con ruido. La
// diferencia entre un DOMINIO y una LISTA DE NOMBRES es dónde aparecen sus elementos: los valores
// de un dominio se ASIGNAN a algún campo (`estado: 'borrador'`); los nombres de campo aparecen
// como CLAVES, nunca como valor. Así que un dominio declarado sólo cuenta si al menos DOS de sus
// valores se asignan de verdad en algún sitio del árbol. Se deriva, no se enumera.
// El corte que de verdad separa las dos cosas: **un dominio es aquello sobre lo que un CAMPO
// varía**. Existe un campo que toma ≥2 valores de `borrador|emitido|firmado` (`estado`); no existe
// ninguno que tome dos nombres de `REVISION_HEREDA`, porque ésos se escriben como claves.
const valoresPorCampoArbol = new Map();
for (const [, lista] of porFichero) {
  for (const { campo, valor } of lista) {
    if (valor === null || valor === '') continue;
    if (!valoresPorCampoArbol.has(campo)) valoresPorCampoArbol.set(campo, new Set());
    valoresPorCampoArbol.get(campo).add(valor);
  }
}
const dominiosUtiles = dominios.filter((d) => {
  for (const vals of valoresPorCampoArbol.values()) {
    let n = 0;
    for (const v of d.valores) if (vals.has(v)) n++;
    if (n >= 2) return true;
  }
  return false;
});
const descartadosPorNoAsignarse = dominios.length - dominiosUtiles.length;

// Un valor puede pertenecer a varios dominios declarados; se indexan todos.
const dominiosPorValor = new Map();
for (const d of dominiosUtiles) for (const v of d.valores) {
  if (!dominiosPorValor.has(v)) dominiosPorValor.set(v, []);
  dominiosPorValor.get(v).push(d);
}

// ── 2 · Clasificación ────────────────────────────────────────────────────────────────────────

const parciales = [];
const ausentes = [];
const limpios = [];
const conBanco = [];
const noClasificados = [];

for (const [rel, lista] of porFichero) {
  if (!esBanco.get(rel) || lista.length === 0) continue;
  conBanco.push(rel);

  // ① PARCIAL — por dominio declarado, enlazado por valor
  const servidoPorDominio = new Map(); // dominio → {vals:Set, linea}
  for (const { valor, linea } of lista) {
    for (const d of dominiosPorValor.get(valor) ?? []) {
      if (!servidoPorDominio.has(d)) servidoPorDominio.set(d, { vals: new Set(), linea });
      servidoPorDominio.get(d).vals.add(valor);
      servidoPorDominio.get(d).linea = Math.min(servidoPorDominio.get(d).linea, linea);
    }
  }
  for (const [d, { vals, linea }] of servidoPorDominio) {
    const fila = {
      fichero: rel, eje: d.nombre, origen: d.origen, linea,
      sirve: vals.size, dominio: d.valores.size, hueco: d.valores.size - vals.size,
      ausentes: [...d.valores].filter((v) => !vals.has(v)).sort(),
    };
    if (fila.hueco > 0) parciales.push(fila); else limpios.push(fila);
  }

  // ② AUSENTE — campo fijado en null/'' que en otro sitio sí lleva dato
  const valoresPorCampo = new Map();
  const lineaPorCampo = new Map();
  for (const { campo, valor, linea } of lista) {
    if (!valoresPorCampo.has(campo)) { valoresPorCampo.set(campo, new Set()); lineaPorCampo.set(campo, linea); }
    valoresPorCampo.get(campo).add(valor);
  }
  for (const [campo, vals] of valoresPorCampo) {
    const soloVacio = [...vals].every((v) => v === null || v === '');
    if (!soloVacio) continue;
    const otros = [...(camposConValorReal.get(campo) ?? [])].filter((f) => f !== rel);
    if (otros.length === 0) continue;
    ausentes.push({ fichero: rel, campo, linea: lineaPorCampo.get(campo), vistoEn: otros.length, ejemplo: otros[0] });
  }

  if (servidoPorDominio.size === 0 && !ausentes.some((a) => a.fichero === rel)) noClasificados.push(rel);
}

// ── 3 · Suelos y controles ───────────────────────────────────────────────────────────────────

const fallos = [];
if (conBanco.length === 0) fallos.push(`0 ficheros con banco sobre ${leidos} leídos`);
if (dominiosUtiles.length === 0) fallos.push('0 dominios declarados encontrados');
if (fallos.length) { console.error(`🔴 CIEGO: ${fallos.join(' · ')}.`); process.exit(2); }

const fallosControl = [];
for (const c of CONOCIDOS) {
  const ok = c.familia === 'PARCIAL'
    ? parciales.some((f) => f.fichero === c.fichero && c.faltan.every((v) => f.ausentes.includes(v)))
    : ausentes.some((f) => f.fichero === c.fichero && f.campo === c.pista);
  if (!ok) fallosControl.push(`${c.familia} · ${c.fichero}`);
}

// ── 4 · Salida ───────────────────────────────────────────────────────────────────────────────

const pct = (n, d) => (d === 0 ? '—' : `${Math.round((n / d) * 100)} %`);
const acusados = new Set([...parciales, ...ausentes].map((f) => f.fichero));

console.log('SCRUM-903c · BANCOS FIJADOS EN UN ESTADO\n');
console.log('── POBLACIÓN ──');
console.log(`ficheros leídos ............................... ${leidos}`);
console.log(`dominios DECLARADOS en el árbol ............... ${dominios.length}`);
console.log(`  · ÚTILES (≥2 de sus valores se asignan) ....... ${dominiosUtiles.length}`);
console.log(`  · descartados por ser listas de nombres ....... ${descartadosPorNoAsignarse}`);
console.log(`ficheros de tests/ y scripts/ CON BANCO ....... ${conBanco.length}`);
console.log(`  · CLASIFICADOS ............................... ${conBanco.length - noClasificados.length}`);
console.log(`  · NO CLASIFICADOS (cuentan del lado malo) .... ${noClasificados.length}   ${pct(noClasificados.length, conBanco.length)}`);
console.log('');

console.log('── CONTROLES ──');
if (fallosControl.length) console.log(`🔴 POSITIVO FALLIDO — no reconoce: ${fallosControl.join(' · ')}`);
else {
  console.log(`✅ POSITIVO: los ${CONOCIDOS.length} casos conocidos salen, cada uno en SU familia:`);
  for (const c of CONOCIDOS) {
    if (c.familia === 'PARCIAL') {
      const f = parciales.filter((x) => x.fichero === c.fichero && c.faltan.every((v) => x.ausentes.includes(v))).sort((a, b) => b.hueco - a.hueco)[0];
      console.log(`     ① ${c.fichero} · eje \`${f.eje}\` sirve ${f.sirve}/${f.dominio} → falta ${f.ausentes.join(', ')}`);
    } else {
      const f = ausentes.find((x) => x.fichero === c.fichero && x.campo === c.pista);
      console.log(`     ② ${c.fichero} · \`${f.campo}\` fijado en vacío; lleva dato en ${f.vistoEn} fichero(s), p.ej. ${f.ejemplo}`);
    }
  }
}
console.log(limpios.length
  ? `✅ NEGATIVO: ${limpios.length} par(es) banco·eje recorren su dominio ENTERO y salen limpios (p.ej. ${limpios[0].fichero} · \`${limpios[0].eje}\` ${limpios[0].dominio}/${limpios[0].dominio})`
  : '🔴 NEGATIVO FALLIDO: NADIE recorre un dominio entero. El criterio acusa por existir.');
console.log('');

console.log('── HALLAZGO ──');
console.log(`bancos acusados (en una familia o en las dos) .. ${acusados.size} de ${conBanco.length}   ${pct(acusados.size, conBanco.length)}`);
console.log(`① PARCIAL · pares banco·eje ................... ${parciales.length}`);
console.log(`② AUSENTE · pares banco·campo ................. ${ausentes.length}`);
console.log('');

// 🔴 LA ① SE PARTE EN DOS, Y ESTE ES EL LÍMITE DEL INSTRUMENTO.
//
// Un dominio sacado del ESQUEMA es el conjunto de valores documentado de una columna: no hay
// ambigüedad posible. Uno sacado de un ARRAY del código puede ser un dominio de valores
// (`FIRMANTE_CALIDAD_IDS`) o una LISTA DE NOMBRES (`REVISION_HEREDA`, los campos que hereda una
// revisión; `ORDEN_BORRADO_MERCHANT`, los modelos que se borran en orden).
//
// Se intentaron TRES cortes para separarlos y ninguno lo consigue: exigir que sus valores se
// asignen, que los asigne un mismo campo, que sean cortos. Todos fallan por la misma razón, y es
// del lenguaje, no del corte: **en este árbol los identificadores SE ESCRIBEN como cadenas**
// (`modelo: 'invoice'`, `campo: 'lines'`), así que un nombre de campo es un valor asignado igual
// que `'firmado'`. Estáticamente no se distinguen.
//
// Por eso salen separados en vez de mezclados con una cifra que parecería medida.
const porOrigen = (f) => (f.origen === 'prisma/schema.prisma' ? 'fiable' : 'ambiguo');
const fiables = parciales.filter((f) => porOrigen(f) === 'fiable');
const ambiguos = parciales.filter((f) => porOrigen(f) === 'ambiguo');
const ordenar = (xs) => xs.sort((a, b) => b.hueco - a.hueco || a.sirve - b.sirve || a.fichero.localeCompare(b.fichero));

console.log('── ① PARCIAL · FIABLE (dominio documentado en el esquema) ──');
console.log(`pares: ${fiables.length}`);
console.log('hueco  sirve/dom  fichero:línea · eje → lo que NO sirve');
for (const f of ordenar(fiables)) {
  console.log(`  ${String(f.hueco).padStart(2)}    ${f.sirve}/${f.dominio}      ${f.fichero}:${f.linea} · ${f.eje} → ${f.ausentes.join(', ')}`);
}
console.log('');
console.log('── ① PARCIAL · AMBIGUO (dominio sacado de un array del código) ──');
console.log(`pares: ${ambiguos.length}  — contienen falsos positivos que NO se pueden separar estáticamente`);
console.log('hueco  sirve/dom  fichero:línea · eje → lo que NO sirve');
for (const f of ordenar(ambiguos).slice(0, 15)) {
  console.log(`  ${String(f.hueco).padStart(2)}    ${f.sirve}/${f.dominio}      ${f.fichero}:${f.linea} · ${f.eje} → ${f.ausentes.slice(0, 6).join(', ')}${f.ausentes.length > 6 ? ', …' : ''}`);
}
if (ambiguos.length > 15) console.log(`  … y ${ambiguos.length - 15} más`);
console.log('');
console.log('── ② AUSENTE, ORDENADOS POR CUÁNTOS SITIOS SÍ LE DAN DATO ──');
console.log('vistoEn  fichero:línea · campo');
for (const f of ausentes.sort((a, b) => b.vistoEn - a.vistoEn || a.fichero.localeCompare(b.fichero))) {
  console.log(`   ${String(f.vistoEn).padStart(3)}    ${f.fichero}:${f.linea} · ${f.campo}`);
}

if (fallosControl.length) process.exit(2);
process.exit(acusados.size ? 1 : 0);
