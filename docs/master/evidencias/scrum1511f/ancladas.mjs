// Saca las marcas 'anclado' por el MISMO codigo del trinquete (scrum921c), sin tocarlo:
// se lee su fuente, se le cambian SOLO los imports relativos y RAIZ, y se le anade un export.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RAIZ = process.argv[2];
const SALIDA = process.argv[3];
const fuente = fs.readFileSync(path.join(RAIZ, 'tests/scrum921c-firma-con-respaldo-en-codigo.test.mjs'), 'utf8');
const url = (rel) => pathToFileURL(path.join(RAIZ, 'tests', rel)).href;
let n = 0;
let copia = fuente.replace(/from '\.\/([^']+)'/g, (_, rel) => { n += 1; return `from '${url(rel)}'`; });
const antes = copia;
copia = copia.replace("path.resolve(import.meta.dirname, '..')", JSON.stringify(RAIZ));
if (copia === antes) throw new Error('no se sustituyo RAIZ');
copia += '\nexport const __veredictos = veredictos;\nexport const __censo = censo;\nexport const __noAfirma = noAfirma;\nexport const __respaldoLeido = respaldoLeido;\nexport const __caso = caso;\n';
const tmp = path.join(path.dirname(SALIDA), '_copia921c.mjs');
fs.writeFileSync(tmp, copia);
const m = await import(pathToFileURL(tmp).href);
const { RE_ANCLA_JIRA } = await import(url('_respaldo-de-firma.mjs'));
const { loQueSeLee } = await import(url('_cita-declarada.mjs'));

const v = m.__veredictos();
const niveles = m.porNivel();
const anc = v.filter((x) => x.respaldo.nivel === 'anclado');
const G = new RegExp(RE_ANCLA_JIRA.source, 'gi');
const out = { importsReescritos: n, marcasTotales: m.__censo().marcas.length, porNivel: niveles, SIN_RESPALDO: m.SIN_RESPALDO, ancladas: [] };
for (const a of anc) {
  const leido = loQueSeLee(a.texto, a.fichero);
  const citas = [...leido.matchAll(G)].map((x) => ({ literal: x[0].replace(/\s+/g, ' '), ticket: x[0].match(/SCRUM-\d+/i)[0].toUpperCase(), comentario: x[1] }));
  // sonda ancha: todo "comentario <id>" del bloque, lo vea o no la expresion del trinquete
  const anchas = [...leido.matchAll(/comentarios?\s+(\d{3,})/gi)].map((x) => x[1]);
  out.ancladas.push({ donde: a.donde, lineas: a.texto.split('\n').length, citas, idsSondaAncha: [...new Set(anchas)], texto: a.texto });
}
// controles sobre el propio clasificador
out.controlPositivo = m.__respaldoLeido(m.__caso(['// aprobado por el', 'fundador, SCRUM-1 comentario 12345'].join(' '))[0], m.__censo().indice).nivel;
out.controlCero = m.__respaldoLeido(m.__caso(['// aprobado por el', 'fundador el martes'].join(' '))[0], m.__censo().indice).nivel;
fs.writeFileSync(SALIDA, JSON.stringify(out, null, 2));
console.log(JSON.stringify({ ...out, ancladas: out.ancladas.map((a) => ({ donde: a.donde, lineas: a.lineas, citas: a.citas.map((c) => `${c.ticket}/${c.comentario}`), ancha: a.idsSondaAncha })) }, null, 1));
