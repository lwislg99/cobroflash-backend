// Medición 3 de SCRUM-1329: la FRASE más larga de cada cita (corte sólo en . ! ? …), sobre TODA cita de docs/microcopy.
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RAIZ = path.resolve(import.meta.dirname, '../..');
const { aprobacionesDeMicrocopy } = await import(pathToFileURL(path.join(RAIZ, 'tests/_microcopy-aprobada.mjs')).href);
const frases = (t) => t.split(/(?<=[.!?…])\s+/).filter((x) => x.trim().length > 0);

const fichas = aprobacionesDeMicrocopy().filter((a) => a.origen === 'fichero');
const filas = [];
for (const a of fichas) {
  let seccion = '(sin encabezado)';
  const ls = a.texto.split(/\r?\n/);
  for (let i = 0; i < ls.length; i++) {
    if (/^#{1,6}\s/.test(ls[i])) { seccion = ls[i].replace(/^#+\s*/, '').trim(); continue; }
    const m = /^>\s?(.+)$/.exec(ls[i].trim());
    if (!m) continue;
    const t = m[1].trim();
    for (const f of frases(t)) filas.push({ ficha: a.nombre, linea: i + 1, seccion, cita: t.length, frase: f.length, f, cruza: /texto\s+aprobado/i.test(seccion) });
  }
}
console.log(`POBLACION fichas=${fichas.length} frases=${filas.length}`);
const largas = filas.filter((x) => x.frase > 160);
console.log(`frases de más de 160 en UNA frase: ${largas.length}`);
for (const x of largas) console.log(`   [frase ${x.frase} · cita ${x.cita}] cruza514=${x.cruza} ${x.ficha}:${x.linea} «${x.seccion}»\n      ${x.f}`);
console.log('las 6 frases más largas:');
for (const x of [...filas].sort((p, q) => q.frase - p.frase).slice(0, 6)) console.log(`   [frase ${x.frase} · cita ${x.cita}] cruza514=${x.cruza} ${x.ficha}:${x.linea}`);
const cong = aprobacionesDeMicrocopy().find((a) => a.origen === 'congelado');
const fc = cong.literales.flatMap((t) => frases(t));
console.log(`congelado: literales=${cong.literales.length} · frases=${fc.length} · la más larga=${Math.max(...fc.map((x) => x.length))}`);
console.log('EXIT=0');
