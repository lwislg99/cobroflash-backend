// Medición de SCRUM-1329 (sólo lectura). Uso: node tests/banco-scrum1329/medir-citas.mjs
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RAIZ = path.resolve(import.meta.dirname, '../..');
const { aprobacionesDeMicrocopy } = await import(pathToFileURL(path.join(RAIZ, 'tests/_microcopy-aprobada.mjs')).href);
const UMBRAL = 160;
const frases = (t) => t.split(/(?<=[.!?…:;])\s+/).filter((x) => x.trim().length > 0);

const aps = aprobacionesDeMicrocopy();
const fichas = aps.filter((a) => a.origen === 'fichero');
console.log(`POBLACION fichas=${fichas.length} congelado=${aps.length - fichas.length} aprobadas=${fichas.filter((a) => a.aprobada).length}`);

// B · toda línea de cita de docs/microcopy, con su sección
const citas = [];
for (const a of fichas) {
  let seccion = '(sin encabezado)';
  let bloque = 0; let previaEsCita = false;
  const lineas = a.texto.split(/\r?\n/);
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    if (/^#{1,6}\s/.test(l)) { seccion = l.replace(/^#+\s*/, ''); previaEsCita = false; continue; }
    const m = /^>\s?(.+)$/.exec(l.trim());
    if (!m) { previaEsCita = false; continue; }
    if (!previaEsCita) bloque++;
    previaEsCita = true;
    const t = m[1].trim();
    citas.push({ ficha: a.nombre, aprobada: a.aprobada, linea: i + 1, seccion, bajoTextoAprobado: /texto\s+aprobado/i.test(seccion), bloque, t });
  }
}
const bajo = citas.filter((c) => c.bajoTextoAprobado);
console.log(`\nB · citas en docs/microcopy: total=${citas.length} · bajo «Texto aprobado»=${bajo.length} · en otra sección=${citas.length - bajo.length}`);
const largas = citas.filter((c) => c.t.length > UMBRAL);
console.log(`B · citas de más de ${UMBRAL}: ${largas.length} de ${citas.length}`);
for (const c of largas) {
  console.log(`   [${c.t.length}] ${c.ficha}:${c.linea} · sección «${c.seccion.slice(0, 40)}» · bajoTA=${c.bajoTextoAprobado} · llaves=${/{[^}]+}/.test(c.t)} · negrita=${/\*\*/.test(c.t)} · frases=${frases(c.t).length}`);
  console.log(`        ${c.t.slice(0, 110)}…`);
}
const hist = [0, 40, 80, 120, 140, 160, 200, 1e9];
for (let i = 0; i < hist.length - 1; i++) {
  console.log(`   bajoTA de ${hist[i] + 1} a ${hist[i + 1]}: ${bajo.filter((c) => c.t.length > hist[i] && c.t.length <= hist[i + 1]).length}`);
}
const tope = [...bajo].sort((x, y) => y.t.length - x.t.length).slice(0, 8);
console.log('B · las 8 más largas bajo «Texto aprobado»:');
for (const c of tope) console.log(`   [${c.t.length}] frases=${frases(c.t).length} llaves=${/{[^}]+}/.test(c.t)} ${c.ficha}:${c.linea}`);

// C · bloques de citas consecutivas bajo «Texto aprobado»: ¿un texto partido en varias líneas?
const porBloque = new Map();
for (const c of bajo) {
  const k = c.ficha + '#' + c.bloque;
  if (!porBloque.has(k)) porBloque.set(k, []);
  porBloque.get(k).push(c);
}
const bloques = [...porBloque.entries()].map(([k, cs]) => ({ k, cs, junto: cs.map((c) => c.t).join(' ') }));
const multi = bloques.filter((b) => b.cs.length > 1);
const multiLargos = multi.filter((b) => b.junto.length > UMBRAL);
console.log(`\nC · bloques bajo «Texto aprobado»: ${bloques.length} · de varias líneas: ${multi.length} · de varias líneas que juntas pasan de ${UMBRAL}: ${multiLargos.length}`);
for (const b of multiLargos) {
  const acabaEnFrase = b.cs.slice(0, -1).map((c) => /[.!?…:;»")]$/.test(c.t));
  console.log(`   [${b.junto.length}] ${b.k} · líneas=${b.cs.length} (${b.cs.map((c) => c.t.length).join('+')}) · cada corte cae en fin de frase=${acabaEnFrase.every(Boolean)}`);
  for (const c of b.cs) console.log(`        > ${c.t.slice(0, 100)}`);
}

// D · registro congelado: celdas largas
const cong = aps.find((a) => a.origen === 'congelado');
if (cong) {
  const l = cong.literales;
  console.log(`\nD · congelado: literales=${l.length} · de más de ${UMBRAL}: ${l.filter((x) => x.length > UMBRAL).length}`);
  for (const x of l.filter((y) => y.length > UMBRAL)) console.log(`   [${x.length}] frases=${frases(x).length} ${x.slice(0, 100)}…`);
}
console.log('\nEXIT=0');
