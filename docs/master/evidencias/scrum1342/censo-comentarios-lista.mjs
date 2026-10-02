// docs/master/evidencias/scrum1342/censo-comentarios-lista.mjs — SCRUM-1342 ④
//
// ¿CUÁNTOS COMENTARIOS DEL ESQUEMA ENUMERAN LOS VALORES DE UN CAMPO? Un comentario que lista
// estados, roles o tipos es una segunda lista: la primera es el código que los decide.
//
//     node docs/master/evidencias/scrum1342/censo-comentarios-lista.mjs            (el esquema del árbol)
//     node docs/master/evidencias/scrum1342/censo-comentarios-lista.mjs <fichero>  (otro esquema)
//
// QUÉ VE: un comentario (`//` o `///`) con dos palabras separadas por `|`, en la línea de un campo
// (forma A) o en una línea propia (forma B).
// 🔴 QUÉ NO VE, y por eso el recuento es un SUELO: listas separadas por comas, por «/» o por «o»
//    («draft, sent, accepted»), y las que parten la lista en dos líneas. Barrido a mano el 2-oct-2026
//    sobre los 42 campos String/Int con comentario en su línea: fuera de la forma A no salió ninguna
//    lista de valores (salieron tres comentarios, y ninguno lo es: un formato, unos MIME y un `null =`).
//
// SOLO CUENTA. Si el comentario coincide con el código lo decide una persona mirando la fuente de
// cada campo: está en el registro (`docs/master/SCRUM-1342.md`), no aquí.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const fichero = process.argv[2] ? path.resolve(process.argv[2]) : path.join(RAIZ, 'prisma', 'schema.prisma');
const lineas = fs.readFileSync(fichero, 'utf8').split(/\r?\n/);

const ENUMERA = /[\p{L}_'"`)]\s*\|\s*['"`(\p{L}_]/u;
const ES_CAMPO = /^\s+\w+\s+[A-Z]\w*[?\[\]]*(\s|$)/;

let modelo = null;
const enLinea = [];
const enLineaPropia = [];
let camposConComentario = 0;
let lineasDeComentario = 0;
let modelos = 0;

for (const [i, l] of lineas.entries()) {
  const abre = /^(model|enum|type)\s+(\w+)\s*\{/.exec(l);
  if (abre) { modelo = abre[2]; if (abre[1] === 'model') modelos += 1; continue; }
  if (/^\}/.test(l)) { modelo = null; continue; }
  const corte = l.indexOf('//');
  if (corte < 0) continue;
  const antes = l.slice(0, corte);
  const comentario = l.slice(corte);
  if (antes.trim() === '') {
    lineasDeComentario += 1;
    if (ENUMERA.test(comentario)) enLineaPropia.push({ n: i + 1, modelo, texto: l.trim() });
  } else if (ES_CAMPO.test(antes)) {
    camposConComentario += 1;
    if (ENUMERA.test(comentario)) enLinea.push({ n: i + 1, modelo, campo: antes.trim().split(/\s+/)[0], texto: comentario.trim() });
  }
}

console.log(`POBLACION: ${lineas.length} líneas · ${modelos} modelos · ${camposConComentario} campos con comentario en su línea · ${lineasDeComentario} líneas que son solo comentario`);
console.log(`\nA · en la línea del campo: ${enLinea.length}`);
for (const c of enLinea) console.log(`  ${String(c.n).padStart(4)}  ${c.modelo}.${c.campo}  ${c.texto.slice(0, 110)}`);
console.log(`\nB · en línea propia: ${enLineaPropia.length}`);
for (const c of enLineaPropia) console.log(`  ${String(c.n).padStart(4)}  ${c.modelo ?? '(fuera de modelo)'}  ${c.texto.slice(0, 110)}`);
console.log(`\nTOTAL: ${enLinea.length + enLineaPropia.length} comentarios que enumeran con «|»`);
const suelo = modelos > 0 && camposConComentario > 0;
console.log(suelo ? 'EXIT=0' : 'CIEGO: no he visto ni un modelo o ni un campo comentado\nEXIT=2');
process.exit(suelo ? 0 : 2);
