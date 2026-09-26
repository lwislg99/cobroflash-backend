// Comprueba que cada cita «...» (25+ caracteres) de docs/producto/CONTABILIDAD.md aparece literal en las fuentes oficiales bajadas.
// Uso: node docs/verificacion/comprobar-citas-contabilidad.mjs docs/producto/CONTABILIDAD.md <carpetaFuentes> [--fijar] [--anclas <fichero>]
// La carpeta lleva LIVA.html RIVA.html LIRPF.html RIRPF.html RFACT.html ORDEN303.html: NO estan en git; direcciones y SHA-256 en la §8 del documento.
// Convierte cada HTML a texto plano aqui mismo (quita etiquetas, decodifica entidades, colapsa blancos) y busca la cita normalizada.
// En CONTABILIDAD.md las « » se usan SOLO para citas literales: cualquier otra cosa entre « » saldria como NO ENCONTRADA.
// Control negativo: una cita alterada a proposito (21 -> 20 por ciento) debe salir NO ENCONTRADA; si la encuentra, el comprobador esta ciego.
//
// SCRUM-1117 · la fecha de «Ultima actualizacion» DEL BLOQUE. La URL de §8 es la del consolidado (sirve siempre la version
// vigente) y el hash de la pagina cambia en cada descarga: ninguno de los dos detecta que la NORMA cambie. El BOE marca cada
// bloque (articulo, anexo...) con la redaccion vigente (`<input name="p" value="AAAAMMDD" checked>`). Cada cita se ancla al
// bloque del que sale y a esa fecha, en `anclas-citas-contabilidad.json` (junto a este script). Por bloque y no por pagina:
// el art. 7 y el anexo I de una misma orden cambian por separado, y una alarma por pagina saltaria con cada cambio del impreso.
//   --fijar  reescribe las anclas con lo que dicen hoy las fuentes (solo si las fuentes son legibles y todas las citas aparecen).
//
// Salida, en orden de prioridad. Cada fallo sale por su propio codigo: «no pude leerlo» NUNCA sale como «no ha cambiado».
//   3 FUENTE ILEGIBLE   falta un HTML, esta vacio o no es el consolidado esperado (pagina de error servida con 200, otra norma).
//                       Sale en cuanto lo ve, sin decir nada de citas ni de anclas.
//   1 CITAS             alguna cita no aparece, no hay citas, o falla un control (el negativo de siempre o el del ancla).
//   2 NORMA CAMBIADA    el bloque de una cita tiene hoy otra redaccion que la anclada: se relee la cita contra la norma nueva
//                       y, si sigue valiendo, se vuelve a fijar.
//   4 ANCLAS            una cita sin ancla (cita nueva: hay que fijarla) o un ancla sin cita (huerfana).
//   0                   todo lo anterior limpio.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const fijar = args.includes('--fijar');
const iA = args.indexOf('--anclas');
const ANCLAS = iA >= 0 ? args[iA + 1] : path.join(path.dirname(fileURLToPath(import.meta.url)), 'anclas-citas-contabilidad.json');
const [doc, dir] = args.filter((a, i) => !a.startsWith('--') && !(iA >= 0 && i === iA + 1));
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
const sinElipsis = (c) => norm(c).replace(/\s*(\(\.\.\.\)|\.\.\.|…)\s*/g, ' ');

// Cada fuente, con el identificador BOE del consolidado que tiene que ser (§8 del documento).
const BOE = { LIVA: 'BOE-A-1992-28740', RIVA: 'BOE-A-1992-28925', LIRPF: 'BOE-A-2006-20764', RIRPF: 'BOE-A-2007-6820', RFACT: 'BOE-A-2012-14696', ORDEN303: 'BOE-A-2008-20953' };
const FUENTES = Object.keys(BOE);

// ── 3 · FUENTE ILEGIBLE: se mira ANTES que nada, y si falla no se afirma nada más.
const ilegibles = [];
const HTML = {};
for (const k of FUENTES) {
  const f = path.join(dir ?? '', k + '.html');
  let h = '';
  try { h = fs.readFileSync(f, 'utf8'); } catch { ilegibles.push(`${k}: no se puede leer ${f}`); continue; }
  if (h.length === 0) ilegibles.push(`${k}: fichero vacio`);
  else if (!h.includes(`name="id" value="${BOE[k]}"`)) ilegibles.push(`${k}: no es el consolidado ${BOE[k]} (¿pagina de error, otra norma?)`);
  else if (!h.includes('<div class="bloque" id="')) ilegibles.push(`${k}: no tiene bloques de consolidado`);
  else HTML[k] = h;
}
if (ilegibles.length) {
  console.log(JSON.stringify({ resultado: 'FUENTE ILEGIBLE — no se ha comprobado nada', ilegibles }, null, 1));
  process.exit(3);
}

const N = {};
for (const k of FUENTES) N[k] = norm(aTexto(HTML[k]));

// Bloques del consolidado: id + redaccion vigente (la marcada `checked`; sin selector = texto original, nunca modificado).
const BLOQUES = {};
for (const k of FUENTES) {
  BLOQUES[k] = HTML[k].split('<div class="bloque" id="').slice(1).map((t) => {
    const id = t.slice(0, t.indexOf('"'));
    const v = t.match(/<input[^>]*name="p"[^>]*value="(\d{8})"[^>]*checked/);
    return { id, version: v ? v[1] : 'original', texto: norm(aTexto('<div ' + t)) };
  });
}

const md = fs.readFileSync(doc, 'utf8');
const citas = [...md.matchAll(/«([^»]{25,}?)»/g)].map((m) => m[1]);
const busca = (c) => FUENTES.find((k) => N[k].includes(sinElipsis(c)));
let ok = 0;
const mal = [];
for (const c of citas) (busca(c) ? ok++ : mal.push(c));

const base = citas.find((c) => /\d+ por ciento/.test(c));
const alterada = base ? base.replace(/(\d+) por ciento/, (_, n) => `${+n + 1000} por ciento`) : null;
const controlOk = alterada !== null && busca(alterada) === undefined && busca(base) !== undefined;

// Ancla de hoy de cada cita encontrada: fuente + TODOS los bloques que la contienen, con su redaccion.
const sha = (c) => crypto.createHash('sha256').update(sinElipsis(c)).digest('hex').slice(0, 16);
const hoy = new Map();
for (const c of citas) {
  const k = busca(c);
  if (!k) continue;
  const bloques = BLOQUES[k].filter((b) => b.texto.includes(sinElipsis(c))).map((b) => `${b.id}@${b.version}`);
  hoy.set(sha(c), { sha: sha(c), inicio: sinElipsis(c).slice(0, 70), fuente: k, bloques });
}
const sinBloque = [...hoy.values()].filter((a) => a.bloques.length === 0);
const mismo = (a, b) => a.fuente === b.fuente && a.bloques.join(',') === b.bloques.join(',');

const resumen = {
  poblacion_fuentes: FUENTES.map((k) => `${k}:${N[k].length}:${BLOQUES[k].length} bloques`),
  citas_extraidas: citas.length,
  encontradas: ok,
  no_encontradas: mal.length,
  control_negativo: controlOk ? 'OK (la cita alterada NO aparece, la original SI)' : 'FALLA',
};

if (fijar) {
  console.log(JSON.stringify(resumen, null, 1));
  if (mal.length || !citas.length || !controlOk || sinBloque.length) {
    for (const c of mal) console.log('NO ENCONTRADA >>', c.slice(0, 160).replace(/\s+/g, ' '));
    for (const a of sinBloque) console.log('SIN BLOQUE >>', a.inicio);
    console.log('--fijar NO escribe: con citas sin encontrar o sin bloque, las anclas mentirian.');
    process.exit(1);
  }
  const anclas = [...hoy.values()];
  fs.writeFileSync(ANCLAS, JSON.stringify({ fijado: new Date().toISOString(), documento: doc.replace(/\\/g, '/'), anclas }, null, 1) + '\n');
  console.log(`anclas fijadas: ${anclas.length} en ${ANCLAS}`);
  process.exit(0);
}

// ── Comparacion con las anclas guardadas.
let guardadas = null;
try { guardadas = JSON.parse(fs.readFileSync(ANCLAS, 'utf8')).anclas; } catch { guardadas = null; }
const G = new Map((guardadas ?? []).map((a) => [a.sha, a]));
const cambiadas = [];
const sinAncla = [];
for (const a of hoy.values()) {
  const g = G.get(a.sha);
  if (!g) sinAncla.push(a);
  else if (!mismo(g, a)) cambiadas.push({ cita: a.inicio, anclada: `${g.fuente} ${g.bloques.join(',')}`, hoy: `${a.fuente} ${a.bloques.join(',')}` });
}
const huerfanas = (guardadas ?? []).filter((g) => !hoy.has(g.sha) && !mal.some((c) => sha(c) === g.sha));

// Control del ancla: la primera ancla, con su redaccion envejecida a proposito, TIENE que salir como cambiada.
const muestra = [...hoy.values()].find((a) => a.bloques.length);
const vieja = muestra && { ...muestra, bloques: muestra.bloques.map((b) => b.replace(/@.*/, '@19000101')) };
const controlAncla = Boolean(muestra) && !mismo(vieja, muestra) && mismo({ ...muestra }, muestra);

Object.assign(resumen, {
  control_ancla: controlAncla ? 'OK (una redaccion envejecida a proposito SALE como cambiada)' : 'FALLA',
  anclas_guardadas: guardadas === null ? `NINGUNA (no se puede leer ${ANCLAS})` : guardadas.length,
  norma_cambiada: cambiadas.length,
  citas_sin_ancla: sinAncla.length,
  anclas_huerfanas: huerfanas.length,
});
console.log(JSON.stringify(resumen, null, 1));
for (const c of mal) console.log('NO ENCONTRADA >>', c.slice(0, 160).replace(/\s+/g, ' '));
for (const c of cambiadas) console.log('NORMA CAMBIADA >>', c.cita, '| anclada:', c.anclada, '| hoy:', c.hoy);
for (const a of sinAncla) console.log('SIN ANCLA >>', a.inicio);
for (const g of huerfanas) console.log('HUERFANA >>', g.inicio);

if (mal.length || !citas.length || !controlOk || !controlAncla) process.exit(1);
if (cambiadas.length) process.exit(2);
if (sinAncla.length || huerfanas.length) process.exit(4);
process.exit(0);
