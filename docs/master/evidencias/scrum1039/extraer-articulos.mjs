// Evidencia SCRUM-1039: extrae texto LITERAL (sin resumen de modelo) de un artículo del BOE
// consolidado, a partir del HTML bajado con GET público. Uso general para reproducir cualquiera
// de las citas nuevas de docs/producto/CONTABILIDAD.md §3 (22-sep-2026).
//
// 1) Bajar la fuente: Invoke-WebRequest -Uri "<direccion de §8>" -OutFile <FUENTE>.html
// 2) node convertir-a-texto.mjs <FUENTE>.html <FUENTE>.txt
// 3) node extraer-articulos.mjs <FUENTE>.txt "Artículo N."
import fs from 'node:fs';

const [ruta, etiqueta, longitud] = process.argv.slice(2);
const txt = fs.readFileSync(ruta, 'utf8');
const i = txt.indexOf(etiqueta);
if (i === -1) { console.log('NO ENCONTRADO:', etiqueta); process.exit(1); }
console.log('=== ' + etiqueta + ' (offset ' + i + ') ===');
console.log(txt.slice(i, i + (Number(longitud) || 2500)));
