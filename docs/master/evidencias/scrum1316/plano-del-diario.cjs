// SCRUM-1316 ② · Vuelca el <texto> de una disposición del BOE (XML del DIARIO) a texto plano, un
// párrafo por línea, con su clase delante: «[articulo] Artículo 7. …», «[parrafo] …».
//
// uso: node plano-del-diario.cjs <entrada.xml> <salida.txt>
//   <entrada.xml> es https://www.boe.es/diario_boe/xml.php?id=<BOE-A-…>
//
// El XML del diario es el texto ORIGINAL de esa disposición, que es lo que se quiere al leer un real
// decreto-ley entero. Para saber qué rige de la ley que modifica, NO vale: eso es la API de legislación
// consolidada (versiones-art91.cjs).
const fs = require('fs');
const [, , ent, sal] = process.argv;
if (!ent || !sal || !fs.existsSync(ent)) { console.error('CIEGO: uso: <entrada.xml> <salida.txt>'); process.exit(2); }
const x = fs.readFileSync(ent, 'utf8');
const t = x.match(/<texto>([\s\S]*)<\/texto>/);
if (!t) { console.error('CIEGO: el XML no trae <texto>'); process.exit(2); }
const ents = { '&lt;': '<', '&gt;': '>', '&amp;': '&', '&quot;': '"', '&apos;': "'" };
const lin = [...t[1].matchAll(/<(p|h\d|td|th)\b([^>]*)>([\s\S]*?)<\/\1>/g)].map((m) => {
  const c = (m[2].match(/class="([^"]*)"/) || [])[1] || '';
  return (c ? '[' + c + '] ' : '') + m[3].replace(/<[^>]+>/g, '').replace(/&\w+;/g, (e) => ents[e] || e).replace(/\s+/g, ' ').trim();
}).filter(Boolean);
if (!lin.length) { console.error('CIEGO: cero párrafos'); process.exit(2); }
fs.writeFileSync(sal, lin.join('\n') + '\n');
console.log(`POBLACION: ${lin.length} párrafos · ${lin.join('').length} caracteres · ${ent} -> ${sal}`);
