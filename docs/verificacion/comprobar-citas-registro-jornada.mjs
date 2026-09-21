// Comprueba que cada cita «...» del documento aparece literal en alguna de las fuentes bajadas.
// Uso: node docs/verificacion/comprobar-citas-registro-jornada.mjs docs/legal/REGISTRO_JORNADA_ES.md <carpetaFuentes>
// Las fuentes (nombres fijos, mas abajo) NO estan en git: se bajan de las direcciones de la tabla §13 de
// docs/legal/REGISTRO_JORNADA_ES.md. El PDF del CT 101/2019 es un escaneo: su transcripcion (ct101-transcripcion.md)
// es automatica y solo se contrasto a ojo en las paginas 8, 12, 13, 14, 15 y 16.
// Control negativo: una cita alterada a proposito debe salir en «NO ENCONTRADA».
import fs from 'node:fs';
import path from 'node:path';
const [doc, dir] = process.argv.slice(2);
const norm = (s) => s
  .replace(/[“”„«»]/g, '"')
  .replace(/[‘’]/g, "'")
  .replace(/[–—]/g, '-')
  .replace(/&laquo;|&raquo;/g, '"')
  .replace(/\s+/g, ' ')
  .replace(/ ([,.;:])/g, '$1')
  .trim();
const leer = (f) => fs.readFileSync(path.join(dir, f), 'utf8');
const quitarCt = (t) => t.split(/\r?\n/).filter((l) => !/^\[/.test(l) && !/^## P/.test(l)).join('\n');
const fuentes = {
  ET: leer('www_boe_es_buscar_act_php_id_BOE_A_2015_11430.txt'),
  L10: leer('www_boe_es_buscar_act_php_id_BOE_A_2021_11472.txt'),
  LISOS: leer('www_boe_es_buscar_act_php_id_BOE_A_2000_15060.txt'),
  LOPD: leer('www_boe_es_buscar_act_php_id_BOE_A_2018_16673.txt'),
  RDL8: leer('www_boe_es_buscar_act_php_id_BOE_A_2019_3481.txt'),
  GUIA: leer('mites-guia-registro-jornada.raw.txt'),
  AEPD: leer('aepd-guia-relaciones-laborales.raw.txt'),
  PROY: leer('mites-proyecto-rd.raw.txt'),
  CT: quitarCt(leer('ct101-transcripcion.md')).replace(/\*\*/g, ''),
  BARRIDO: leer('barrido-boe-2025-09-30_2026-09-21.json'),
  JIRA: leer('jira-scrum-913-extracto.txt'),
  BIOM: leer('aepd-guia-biometricos.raw.txt'),
};
const N = {};
for (const [k, v] of Object.entries(fuentes)) {
  N[k] = norm(v);
  N[k + '~'] = norm(v.replace(/-\s*\r?\n\s*/g, ''));   // une palabras partidas por guion de fin de linea
}
const md = fs.readFileSync(doc, 'utf8');
const citas = [...md.matchAll(/«([^»]{25,}?)»/g)].map((m) => m[1]);
let ok = 0; const mal = [];
for (const c of citas) {
  const q = norm(c).replace(/\s*(\(\.\.\.\)|\.\.\.|…)\s*/g, ' ');
  const hit = Object.keys(N).find((k) => N[k].includes(q));
  if (hit) ok++; else mal.push(c);
}
console.log(JSON.stringify({ poblacion_fuentes: Object.entries(fuentes).map(([k, v]) => `${k}:${v.length}`), citas_extraidas: citas.length, encontradas: ok, no_encontradas: mal.length }, null, 1));
for (const c of mal) console.log('NO ENCONTRADA >>', c.slice(0, 160).replace(/\s+/g, ' '));
