// Evidencia SCRUM-1039: HTML del BOE (GET público) -> texto plano normalizado. MISMA
// normalización que docs/verificacion/comprobar-citas-contabilidad.mjs (para que un offset o una
// búsqueda de aquí sea comparable con lo que ve el comprobador).
// Uso: node convertir-a-texto.mjs <entrada.html> <salida.txt>
import fs from 'node:fs';

const [entrada, salida] = process.argv.slice(2);
const html = fs.readFileSync(entrada, 'utf8');
const ENT = { nbsp: ' ', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', uuml: 'ü', laquo: '«', raquo: '»', quot: '"', ordm: 'º', ordf: 'ª', lt: '<', gt: '>', amp: '&' };
const dec = (s) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&([A-Za-z]+);/g, (m, n) => (n in ENT ? ENT[n] : m));
const aTexto = (h) => dec(h
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<\/(p|div|h\d|li|tr)>|<br\s*\/?>/gi, ' ')
  .replace(/<[^>]+>/g, ''));
const norm = (s) => s
  .replace(/[“”„«»]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, '-')
  .replace(/\s+/g, ' ').replace(/ ([,.;:])/g, '$1').trim();
const txt = norm(aTexto(html));
fs.writeFileSync(salida, txt, 'utf8');
console.log('longitud', txt.length);
