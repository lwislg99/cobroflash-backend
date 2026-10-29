// docs/master/evidencias/SCRUM-1551i/sonda-vinetas.mjs — SCRUM-1551i
//
// Pasa CADA docs/legal/*.md por el readLegalDoc REAL de dos builds de legalPages.routes.js
// (el de antes del arreglo y el de después) y compara, por documento:
//   · si el HTML sale igual byte a byte;
//   · el TEXTO sin etiquetas, con los espacios normalizados: tiene que ser idéntico (ninguna
//     palabra cambia); y el texto con los saltos de línea quitados en las uniones;
//   · cuántas viñetas salen partidas (`</ul>` seguido de un `<p>` que empieza en minúscula o
//     el `<p>` que sigue a una lista sin línea en blanco en el .md).
// Control de versión (cicatriz J3 2026-10-23, SCRUM-1402g): imprime el sha-256 de cada módulo
// cargado; si los dos son el mismo fichero, la comparación no distingue nada y sale CIEGO (2).
//
// Uso: node sonda-vinetas.mjs <antes.js> <despues.js> <raiz del repo>
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const [antesJs, despuesJs, raiz] = process.argv.slice(2).map((p) => path.resolve(p));
if (!antesJs || !despuesJs || !raiz) { console.error('uso: <antes.js> <despues.js> <raiz>'); process.exit(2); }

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex').slice(0, 12);
const shaA = sha(fs.readFileSync(antesJs)), shaD = sha(fs.readFileSync(despuesJs));
console.log(`módulo antes   ${antesJs} · sha ${shaA}`);
console.log(`módulo después ${despuesJs} · sha ${shaD}`);
if (shaA === shaD) { console.log('CIEGO: los dos módulos son el mismo fichero'); process.exit(2); }

// LEGAL_DIR se fija con process.cwd() al cargar el módulo: se carga con cwd = raíz.
function cargar(js) {
  const antes = process.cwd();
  process.chdir(raiz);
  try { delete require.cache[js]; return require(js).readLegalDoc; } finally { process.chdir(antes); }
}
const leerA = cargar(antesJs), leerD = cargar(despuesJs);

const texto = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
// Párrafos que siguen inmediatamente a una lista: lo que deja una viñeta partida.
const partidas = (html) => (html.match(/<\/ul>\n<p>/g) || []).length;
const lis = (html) => (html.match(/<li>/g) || []).length;

const dir = path.join(raiz, 'docs', 'legal');
const docs = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
let iguales = 0, cambian = 0, textoDistinto = 0;
for (const f of docs) {
  const a = leerA(f), d = leerD(f);
  if (!a || !d) { console.log(`CIEGO ${f}: readLegalDoc devolvió null`); process.exit(2); }
  const mismoHtml = a.html === d.html;
  const mismoTexto = texto(a.html) === texto(d.html);
  if (mismoHtml) iguales++; else cambian++;
  if (!mismoTexto) textoDistinto++;
  console.log(`${mismoHtml ? 'IGUAL ' : 'CAMBIA'} ${f} · versión ${a.version} → ${d.version} · `
    + `texto ${mismoTexto ? 'idéntico' : 'DISTINTO'} (${texto(a.html).length} → ${texto(d.html).length} car.) · `
    + `<li> ${lis(a.html)} → ${lis(d.html)} · <p> tras lista ${partidas(a.html)} → ${partidas(d.html)} · `
    + `<p> ${(a.html.match(/<p>/g) || []).length} → ${(d.html.match(/<p>/g) || []).length}`);
}
console.log(`POBLACIÓN ${docs.length} documentos de docs/legal · ${iguales} iguales byte a byte · ${cambian} cambian · `
  + `${textoDistinto} con el texto distinto`);
process.exit(textoDistinto ? 1 : 0);
