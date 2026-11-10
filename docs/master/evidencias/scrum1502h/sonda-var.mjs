// Sonda de un solo uso (SCRUM-1502h): si «a pelo en docs/master» deja de contar, ¿cuántas marcas cambian de nivel?
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const RAIZ = process.argv[2];
const imp = (p) => import(pathToFileURL(path.join(RAIZ, p)).href);
const { marcasDe } = await imp('tests/_procedencia-aprobacion.mjs');
const { indiceDeFuentes, respaldoDe, esProsaDistintiva } = await imp('tests/_respaldo-de-firma.mjs');
const { loQueSeLee } = await imp('tests/_cita-declarada.mjs');
const MARCA = /(?:aprobad|autorizad|firmad|validad|refrendad)[oa]s?\s+por\s+el\s+fundador|\bel\s+fundador\s+(?:lo\s+|la\s+|los\s+|las\s+|ya\s+|s[ií]\s+)*(?:decide|decidi[oó]|aprueba|aprob[oó]|autoriza|autoriz[oó]|firma|firm[oó]|valida|valid[oó])(?![A-Za-z0-9_áéíóúüñÁÉÍÓÚÜÑ])/i;
const ATR = /(?:aprobad|autorizad|firmad|validad)[oa]s?\s+por\s+el\s+fundador|literal\s+del\s+fundador|decisi[oó]n(?:es)?\s+del\s+fundador|el\s+fundador\s+(?:aprob[oó]|firm[oó]|decidi[oó]|autoriz[oó])/i;
const EXCLUIR = /^tests\/(_procedencia-aprobacion|_respaldo-de-firma|_censo-firmas-autorizacion|_microcopy-aprobada|scrum387-|scrum921)/;
const marcas = marcasDe(RAIZ, { dirs: ['src', 'public', 'tests', 'scripts'], marca: MARCA, excluir: EXCLUIR, literalesTras: 45 });
const indice = indiceDeFuentes(RAIZ);
const variantes = {
  'A · docs/master fuera': (f, fr) => !f.ruta.startsWith('docs/master/') && f.atribuye && f.texto.includes(fr),
  'B · atribución a ±10 líneas': (f, fr) => cerca(f.texto, fr, 10),
  'C · atribución a ±3 líneas': (f, fr) => cerca(f.texto, fr, 3),
};
function cerca(texto, fr, n) {
  const ls = texto.split(/\r?\n/);
  for (let i = 0; i < ls.length; i++) if (ls[i].includes(fr)) { if (ATR.test(ls.slice(Math.max(0, i - n), i + n + 1).join('\n'))) return true; }
  return false; // frases partidas en varias líneas no casan línea a línea: lo cuenta la sonda como perdida
}
let docBase = 0; const pierde = Object.fromEntries(Object.keys(variantes).map((k) => [k, []]));
for (const b of marcas) {
  const t = loQueSeLee(b.texto, b.fichero);
  if (!MARCA.test(t)) continue;
  const r = respaldoDe({ ...b, texto: t }, indice);
  if (r.nivel !== 'documental') continue;
  docBase++;
  for (const [k, ok] of Object.entries(variantes)) {
    const sigue = (b.literales ?? []).some((fr) => esProsaDistintiva(fr) && indice.some((f) => ok(f, fr)));
    if (!sigue) pierde[k].push(`${b.fichero}:${b.linea}`);
  }
}
console.log(`población: marcas=${marcas.length} documental=${docBase} fuentes=${indice.length}`);
for (const [k, l] of Object.entries(pierde)) console.log(`${k}: pierden ${l.length} de ${docBase}\n  ${l.join('\n  ')}`);
