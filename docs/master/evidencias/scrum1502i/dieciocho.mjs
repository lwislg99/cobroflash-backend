// SCRUM-1502i · de un solo uso. Re-mide la variante A de 1502h (sonda-var.mjs, mismo código) y, por cada
// marca que pierde respaldo, dice QUÉ literal la respalda y EN QUÉ fichero de docs/master.
// Uso: node dieciocho.mjs <raíz> <salida.json>
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const RAIZ = process.argv[2];
const imp = (p) => import(pathToFileURL(path.join(RAIZ, p)).href);
const { marcasDe } = await imp('tests/_procedencia-aprobacion.mjs');
const { indiceDeFuentes, respaldoDe, esProsaDistintiva } = await imp('tests/_respaldo-de-firma.mjs');
const { loQueSeLee } = await imp('tests/_cita-declarada.mjs');
const MARCA = /(?:aprobad|autorizad|firmad|validad|refrendad)[oa]s?\s+por\s+el\s+fundador|\bel\s+fundador\s+(?:lo\s+|la\s+|los\s+|las\s+|ya\s+|s[ií]\s+)*(?:decide|decidi[oó]|aprueba|aprob[oó]|autoriza|autoriz[oó]|firma|firm[oó]|valida|valid[oó])(?![A-Za-z0-9_áéíóúüñÁÉÍÓÚÜÑ])/i;
const EXCLUIR = /^tests\/(_procedencia-aprobacion|_respaldo-de-firma|_censo-firmas-autorizacion|_microcopy-aprobada|scrum387-|scrum921)/;
const marcas = marcasDe(RAIZ, { dirs: ['src', 'public', 'tests', 'scripts'], marca: MARCA, excluir: EXCLUIR, literalesTras: 45 });
const indice = indiceDeFuentes(RAIZ);
const niveles = {};
const filas = [];
for (const b of marcas) {
  const t = loQueSeLee(b.texto, b.fichero);
  if (!MARCA.test(t)) continue;
  const r = respaldoDe({ ...b, texto: t }, indice);
  niveles[r.nivel] = (niveles[r.nivel] ?? 0) + 1;
  if (r.nivel !== 'documental') continue;
  const prosa = (b.literales ?? []).filter(esProsaDistintiva);
  const fuera = prosa.some((fr) => indice.some((f) => !f.ruta.startsWith('docs/master/') && f.atribuye && f.texto.includes(fr)));
  if (fuera) continue;
  const respaldos = prosa.map((fr) => ({
    frase: fr,
    en: indice.filter((f) => f.atribuye && f.texto.includes(fr)).map((f) => {
      const ls = f.texto.split(/\r?\n/);
      const i = ls.findIndex((l) => l.includes(fr.slice(0, 40)));
      return { ruta: f.ruta, linea: i + 1, tickets: [...new Set((f.texto.match(/SCRUM-\d+[a-z]?/g) ?? []))].slice(0, 15) };
    }),
  })).filter((x) => x.en.length);
  filas.push({ donde: `${b.fichero}:${b.linea}`, comentario: t, prosa, respaldos, ticketsMarca: [...new Set(t.match(/SCRUM-\d+[a-z]?|c\.\d+|comentario \d+/g) ?? [])] });
}
fs.writeFileSync(process.argv[3], JSON.stringify({ marcas: marcas.length, niveles, fuentes: indice.length, n: filas.length, filas }, null, 2));
console.log(`POBLACION marcas=${marcas.length} fuentes=${indice.length} niveles=${JSON.stringify(niveles)} A=${filas.length}`);
for (const f of filas) console.log(f.donde, '| respaldos:', f.respaldos.map((r) => r.en.map((e) => `${e.ruta}:${e.linea}`).join(',')).join(' ; '));
