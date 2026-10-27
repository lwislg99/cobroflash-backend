// ¿De cuántas formas dice el panel «vuelve a intentarlo»? MEDIDA, no barrido: no cambia nada.
// Lee por AST los literales de cadena (y los trozos de plantilla) de public/dashboard/js/*.js —los
// comentarios no cuentan— y saca la frase de reintento de cada uno: desde la palabra que la abre
// hasta el final de su oración.   node reintentos.mjs <raíz del árbol> [carpeta relativa]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(process.argv[2]);
const CARPETA = process.argv[3] || 'public/dashboard/js';
const ts = createRequire(path.join(RAIZ, 'package.json'))('typescript');

// Lo que abre una frase de reintento. Ancho a propósito: lo que sobre se ve en la lista y se descarta a ojo.
const ABRE = /(vuelv[ea]s? a (intentar|probar)\w*|int[ée]nt[ae]l[oa]s?\b|int[ée]nt[ae]\b|prueba (otra vez|de nuevo|m[aá]s tarde|en un)|pru[ée]b[ae]l[oa]\b|reint[ée]nt\w*|reintentar\w*|rep[ií]telo|rep[ií]te la|vuelve a (cargar|pulsar|enviar|subir|guardar)\w*)/i;

const ficheros = fs.readdirSync(path.join(RAIZ, CARPETA)).filter((f) => f.endsWith('.js')).sort();
let literales = 0;
const hallazgos = [];
for (const f of ficheros) {
  const rel = `${CARPETA}/${f}`;
  const fuente = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
  const sf = ts.createSourceFile(rel, fuente, ts.ScriptTarget.Latest, true);
  (function ver(n) {
    const esTexto = ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || n.kind === ts.SyntaxKind.TemplateHead || n.kind === ts.SyntaxKind.TemplateMiddle || n.kind === ts.SyntaxKind.TemplateTail;
    if (esTexto) {
      literales += 1;
      const texto = n.text;
      let resto = texto; let base = 0;
      for (;;) {
        const m = ABRE.exec(resto);
        if (!m) break;
        const desde = m.index;
        const fin = resto.slice(desde).search(/[.!?…<\n]/);
        const hasta = fin === -1 ? resto.length : desde + fin + (/[.!?…]/.test(resto[desde + fin]) ? 1 : 0);
        const frase = resto.slice(desde, hasta).replace(/\s+/g, ' ').trim();
        const linea = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
        hallazgos.push({ rel: f, linea, frase, entero: texto.replace(/\s+/g, ' ').trim().slice(0, 140) });
        base += hasta; resto = resto.slice(hasta);
        if (!resto) break;
      }
    }
    ts.forEachChild(n, ver);
  }(sf));
}

const clave = (s) => s.toLocaleLowerCase('es').replace(/[.!…]+$/, '').trim();
const grupos = new Map();
for (const h of hallazgos) { const k = clave(h.frase); if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(h); }
const orden = [...grupos.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'es'));

console.log(`POBLACION · ${ficheros.length} ficheros de ${CARPETA} · ${literales} literales de texto leídos por AST · ${hallazgos.length} frases que casan · ${orden.length} formas distintas (sin mayúsculas ni punto final)`);
const control = hallazgos.filter((h) => h.rel === 'clienteVolverALlamar.js');
console.log(`CONTROL POSITIVO · en clienteVolverALlamar.js: ${control.length} → ${control.map((h) => `«${h.frase}» (l.${h.linea})`).join(' ; ') || 'NINGUNA: la medida está CIEGA'}`);
if (process.argv[4] === '--todo') {
  for (const [k, hs] of orden) {
    console.log(`\n[${hs.length}] «${k}»`);
    const escritas = [...new Set(hs.map((h) => h.frase))];
    if (escritas.length > 1 || escritas[0].toLocaleLowerCase('es') !== k) console.log(`     escrita como: ${escritas.map((e) => `«${e}»`).join(' · ')}`);
    const porFichero = new Map();
    for (const h of hs) { if (!porFichero.has(h.rel)) porFichero.set(h.rel, []); porFichero.get(h.rel).push(h.linea); }
    console.log(`     ${[...porFichero.entries()].map(([f, ls]) => `${f}:${ls.join(',')}`).join(' · ')}`);
  }
} else {
  for (const [k, hs] of orden) console.log(`[${String(hs.length).padStart(3)}] «${k}» · ${new Set(hs.map((h) => h.rel)).size} fichero(s)`);
}
console.log(`\nEXIT=${control.length ? 0 : 2}`);
process.exit(control.length ? 0 : 2);
