// SCRUM-1523 · censo de las apariciones de «justificante» y de su vocabulario hermano.
//
// SOLO LEE. No escribe en el arbol: la siembra del control positivo va a un directorio temporal.
//
// Uso (desde la raiz del repositorio):
//   node docs/master/evidencias/SCRUM-1523/censo.mjs src
//   node docs/master/evidencias/SCRUM-1523/censo.mjs tests
//   node docs/master/evidencias/SCRUM-1523/censo.mjs src --sin-siembra     (tiene que decir CIEGO)
//
// Que mide: cada aparicion (sin distinguir mayusculas) de cada termino, y DONDE cae segun el AST
// de TypeScript: dentro de un comentario, dentro de una cadena, en un identificador, o en otro
// token. «Comentario» es lo que no cae dentro de ningun token: es una deduccion por descarte, y
// por eso lleva su control (la siembra pone una aparicion en comentario y tiene que salir ahi).
//
// Que NO mide: si una cadena llega a la pantalla de alguien, ni si una rama se alcanza. Eso se
// deriva LEYENDO y esta en docs/master/SCRUM-1523.md.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(join(process.cwd(), 'package.json'));
const ts = require('typescript');

const carpeta = process.argv[2];
const sinSiembra = process.argv.includes('--sin-siembra');
if (!carpeta) { console.error('falta la carpeta'); process.exit(2); }

// La palabra del ticket, y el vocabulario con el que el codigo nombra lo mismo sin decirla.
const PALABRA = 'justificante';
const TERMINOS = [PALABRA, 'isReceiptNumber', 'RECEIPT_NUMBER_PREFIX', "'JUST'", "'receipt'", "'J-'", 'J-'];
// El cero DERIVADO: la misma palabra, del reves. Sale de PALABRA, no se elige.
const CERO = [...PALABRA].reverse().join('');

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Clasifica cada aparicion de `termino` en `texto` por el token del AST que la contiene. */
function clasificar(nombre, texto, termino) {
  const sf = ts.createSourceFile(nombre, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const hojas = [];
  const jsdoc = [];
  const visitar = (n) => {
    // Un bloque /** */ es un NODO del arbol (JSDoc), no trivia: sin esto sale como «otro».
    if (n.kind >= K.FirstJSDocNode && n.kind <= K.LastJSDocNode) { jsdoc.push(n); return; }
    if (n.getChildCount(sf) === 0) { if (n.end > n.getStart(sf)) hojas.push(n); return; }
    n.getChildren(sf).forEach(visitar);
  };
  const K = ts.SyntaxKind;
  visitar(sf);
  const esCadena = new Set([K.StringLiteral, K.NoSubstitutionTemplateLiteral, K.TemplateHead, K.TemplateMiddle, K.TemplateTail]);
  const lineas = texto.split('\n');
  const re = new RegExp(escapar(termino), 'gi');
  const salida = [];
  for (const m of texto.matchAll(re)) {
    const pos = m.index;
    const hoja = hojas.find((h) => h.getStart(sf) <= pos && pos < h.end);
    let clase = 'comentario';
    if (jsdoc.some((j) => j.pos <= pos && pos < j.end)) clase = 'comentario';
    else if (hoja) clase = esCadena.has(hoja.kind) ? 'cadena' : hoja.kind === K.Identifier ? 'identificador' : 'otro';
    const linea = sf.getLineAndCharacterOfPosition(pos).line;
    salida.push({ clase, linea: linea + 1, texto: (lineas[linea] ?? '').trim().slice(0, 170), nombre: hoja && hoja.kind === K.Identifier ? hoja.getText(sf) : null });
  }
  return salida;
}

// ── CONTROL POSITIVO SEMBRADO: lo fabrica el propio instrumento, no se toma del arbol ──────────
const dirSiembra = mkdtempSync(join(tmpdir(), 'scrum1523-'));
const ficheroSiembra = join(dirSiembra, 'sembrado.ts');
let siembraOk = false;
try {
  if (!sinSiembra) {
    const M = PALABRA[0].toUpperCase() + PALABRA.slice(1);
    writeFileSync(ficheroSiembra, [
      `// un ${PALABRA} en un comentario`,
      `/** un ${PALABRA} en un bloque de documentacion */`,
      `const es${M} = true;`,
      "export const rotulo = es" + M + " ? `${1} " + PALABRA.toUpperCase() + " en plantilla` : 'sin nada';",
      '',
    ].join('\n'));
  }
  let texto = '';
  try { texto = readFileSync(ficheroSiembra, 'utf8'); } catch { /* sin siembra: no hay fichero */ }
  const v = clasificar('sembrado.ts', texto, PALABRA);
  const por = (c) => v.filter((x) => x.clase === c).length;
  // 2 en comentario (uno de linea y uno de bloque /** */), 2 identificadores (declaracion y uso), 1 en plantilla.
  siembraOk = por('comentario') === 2 && por('identificador') === 2 && por('cadena') === 1 && v.length === 5;
  console.log(`CONTROL POSITIVO SEMBRADO · bytes=${texto.length} · apariciones=${v.length} · comentario=${por('comentario')} identificador=${por('identificador')} cadena=${por('cadena')} · ${siembraOk ? 'VISTO' : 'CIEGO'}`);
} finally {
  rmSync(dirSiembra, { recursive: true, force: true });
}
if (!siembraOk) {
  console.log('CIEGO: el instrumento no ve su propia siembra. Ningun numero de abajo vale. EXIT=2');
  process.exit(2);
}

// ── POBLACION ─────────────────────────────────────────────────────────────────────────────────
const ficheros = execFileSync('git', ['ls-files', '--', carpeta], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  .split('\n').filter((f) => /\.(ts|mjs|js|cjs)$/.test(f));
console.log(`POBLACION · carpeta=${carpeta} · ficheros de codigo seguidos por git=${ficheros.length}`);
if (ficheros.length === 0) { console.log('CIEGO: poblacion vacia. EXIT=2'); process.exit(2); }

const textos = new Map(ficheros.map((f) => [f, readFileSync(f, 'utf8')]));
const bytes = [...textos.values()].reduce((a, t) => a + t.length, 0);
console.log(`POBLACION · caracteres leidos=${bytes}`);

// ── CERO DERIVADO ─────────────────────────────────────────────────────────────────────────────
let cero = 0;
for (const [f, t] of textos) cero += clasificar(f, t, CERO).length;
console.log(`CONTROL DE CERO DERIVADO · «${CERO}» · apariciones=${cero} · ${cero === 0 ? 'CERO' : 'ROTO'}`);

// ── EL CENSO ──────────────────────────────────────────────────────────────────────────────────
const filas = [];
for (const termino of TERMINOS) {
  let total = 0; const conAlgo = new Set(); const porClase = {};
  for (const [f, t] of textos) {
    const v = clasificar(f, t, termino);
    // Segunda sonda, independiente del AST: el recuento a pelo tiene que coincidir.
    const aPelo = (t.match(new RegExp(escapar(termino), 'gi')) ?? []).length;
    if (aPelo !== v.length) { console.log(`DISCREPANCIA ${f} ${termino}: AST=${v.length} a pelo=${aPelo}`); process.exitCode = 1; }
    if (v.length) conAlgo.add(f);
    total += v.length;
    for (const x of v) { porClase[x.clase] = (porClase[x.clase] ?? 0) + 1; filas.push({ termino, f, ...x }); }
  }
  console.log(`TERMINO ${termino} · ficheros=${conAlgo.size} · apariciones=${total} · ${JSON.stringify(porClase)}`);
}

// ── DETALLE de la palabra del ticket ──────────────────────────────────────────────────────────
const dePalabra = filas.filter((x) => x.termino === PALABRA);
const porFichero = new Map();
for (const x of dePalabra) {
  const r = porFichero.get(x.f) ?? { comentario: 0, cadena: 0, identificador: 0, otro: 0 };
  r[x.clase]++; porFichero.set(x.f, r);
}
console.log(`\nPOR FICHERO · «${PALABRA}» · ${porFichero.size} ficheros`);
for (const [f, r] of [...porFichero].sort()) console.log(`  ${f} · comentario=${r.comentario} cadena=${r.cadena} identificador=${r.identificador} otro=${r.otro}`);

const soloComentario = [...porFichero].filter(([, r]) => r.cadena + r.identificador + r.otro === 0).length;
console.log(`\nFICHEROS DONDE «${PALABRA}» SOLO APARECE EN COMENTARIOS: ${soloComentario} de ${porFichero.size}`);

console.log(`\nCADENAS que contienen «${PALABRA}» (candidatas a texto, se derivan LEYENDO):`);
for (const x of dePalabra.filter((y) => y.clase === 'cadena')) console.log(`  ${x.f}:${x.linea} · ${x.texto}`);

console.log(`\nIDENTIFICADORES que contienen «${PALABRA}»:`);
const ids = new Map();
for (const x of dePalabra.filter((y) => y.clase === 'identificador')) {
  const k = `${x.nombre} @ ${x.f}`; ids.set(k, (ids.get(k) ?? 0) + 1);
}
for (const [k, n] of [...ids].sort()) console.log(`  ${k} ×${n}`);

// ── El vocabulario hermano: quien lleva el concepto SIN decir la palabra ──────────────────────
const conPalabra = new Set(porFichero.keys());
const sinPalabra = new Map();
for (const x of filas) {
  if (x.termino === PALABRA || x.clase === 'comentario' || conPalabra.has(x.f)) continue;
  if (x.termino === 'J-' ) continue; // «J-» a pelo casa dentro de otras palabras: solo se cuenta arriba
  const s = sinPalabra.get(x.f) ?? new Set(); s.add(x.termino); sinPalabra.set(x.f, s);
}
console.log(`\nFICHEROS que usan el vocabulario hermano EN CODIGO y NO contienen «${PALABRA}»: ${sinPalabra.size}`);
for (const [f, s] of [...sinPalabra].sort()) console.log(`  ${f} · ${[...s].join(' ')}`);

// ── Usos EN CODIGO del reconocedor y del tipo, uno por linea ──────────────────────────────────
for (const t of ['isReceiptNumber', "'JUST'", "'J-'"]) {
  const usos = filas.filter((x) => x.termino === t && x.clase !== 'comentario');
  console.log(`\nUSOS EN CODIGO de ${t}: ${usos.length}`);
  for (const x of usos) console.log(`  ${x.f}:${x.linea} · ${x.texto}`);
}
console.log(`\nEXIT=${process.exitCode ?? 0}`);
