// Comprueba que cada cita «...» (25+ caracteres) de docs/producto/CONTABILIDAD.md aparece literal en las fuentes oficiales bajadas.
// Uso: node docs/verificacion/comprobar-citas-contabilidad.mjs docs/producto/CONTABILIDAD.md <carpetaFuentes>
// La carpeta lleva LIVA.html RIVA.html LIRPF.html RIRPF.html RFACT.html: NO estan en git; direcciones y SHA-256 en la §8 del documento.
// Convierte cada HTML a texto plano aqui mismo (quita etiquetas, decodifica entidades, colapsa blancos) y busca la cita normalizada.
// En CONTABILIDAD.md las « » se usan SOLO para citas literales: cualquier otra cosa entre « » saldria como NO ENCONTRADA.
// Control negativo: una cita alterada a proposito (21 -> 20 por ciento) debe salir NO ENCONTRADA; si la encuentra, el comprobador esta ciego.
// Exit 1 si alguna cita no aparece, si no hay citas, o si el control negativo falla.
import fs from 'node:fs';
import path from 'node:path';

const [doc, dir] = process.argv.slice(2);
const ENT = { nbsp: ' ', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', uuml: 'ü', laquo: '«', raquo: '»', quot: '"', ordm: 'º', ordf: 'ª', lt: '<', gt: '>', amp: '&' };
const dec = (s) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&([A-Za-z]+);/g, (m, n) => (n in ENT ? ENT[n] : m));
const aTexto = (html) => dec(html
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<\/(p|div|h\d|li|tr)>|<br\s*\/?>/gi, ' ')
  .replace(/<[^>]+>/g, ''));
const norm = (s) => s
  .replace(/[“”„«»]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, '-')
  .replace(/\s+/g, ' ').replace(/ ([,.;:])/g, '$1').trim();

const FUENTES = ['LIVA', 'RIVA', 'LIRPF', 'RIRPF', 'RFACT'];
const N = {};
for (const k of FUENTES) N[k] = norm(aTexto(fs.readFileSync(path.join(dir, k + '.html'), 'utf8')));

const md = fs.readFileSync(doc, 'utf8');
const citas = [...md.matchAll(/«([^»]{25,}?)»/g)].map((m) => m[1]);
const busca = (c) => FUENTES.find((k) => N[k].includes(norm(c).replace(/\s*(\(\.\.\.\)|\.\.\.|…)\s*/g, ' ')));
let ok = 0;
const mal = [];
for (const c of citas) (busca(c) ? ok++ : mal.push(c));

const base = citas.find((c) => /\d+ por ciento/.test(c));
const alterada = base ? base.replace(/(\d+) por ciento/, (_, n) => `${+n + 1000} por ciento`) : null;
const controlOk = alterada !== null && busca(alterada) === undefined && busca(base) !== undefined;

console.log(JSON.stringify({
  poblacion_fuentes: FUENTES.map((k) => `${k}:${N[k].length}`),
  citas_extraidas: citas.length,
  encontradas: ok,
  no_encontradas: mal.length,
  control_negativo: controlOk ? 'OK (la cita alterada NO aparece, la original SI)' : 'FALLA',
}, null, 1));
for (const c of mal) console.log('NO ENCONTRADA >>', c.slice(0, 160).replace(/\s+/g, ' '));
process.exit(mal.length === 0 && citas.length > 0 && controlOk ? 0 : 1);
