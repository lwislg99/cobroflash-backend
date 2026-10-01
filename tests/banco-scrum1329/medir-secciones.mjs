// Medición 2 de SCRUM-1329 (sólo lectura): qué secciones NO cruza scrum514 y si sus citas están pintadas.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RAIZ = path.resolve(import.meta.dirname, '../..');
const { aprobacionesDeMicrocopy } = await import(pathToFileURL(path.join(RAIZ, 'tests/_microcopy-aprobada.mjs')).href);

const ficheros = [];
const walk = (d, ext) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) { walk(p, ext); continue; }
    if (ext.test(e.name)) ficheros.push(p);
  }
};
walk(path.join(RAIZ, 'public'), /\.(js|ts|html)$/);
walk(path.join(RAIZ, 'src'), /\.ts$/);
const corpus = ficheros.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
console.log(`POBLACION corpus=${ficheros.length} ficheros`);

const fichas = aprobacionesDeMicrocopy().filter((a) => a.origen === 'fichero');
const porSeccion = new Map();
let conRef = 0;
for (const a of fichas) {
  if (/\bSCRUM-\d+\s+comentario\s+\d+\b/.test(a.texto.split(/\r?\n/).filter((l) => !/^\s*>/.test(l)).join('\n'))) conRef++;
  let seccion = '(sin encabezado)';
  for (const l of a.texto.split(/\r?\n/)) {
    if (/^#{1,6}\s/.test(l)) { seccion = l.replace(/^#+\s*/, '').trim(); continue; }
    const m = /^>\s?(.+)$/.exec(l.trim());
    if (!m || m[1].trim().length < 4) continue;
    const t = m[1].trim();
    const clase = /texto\s+aprobado/i.test(seccion) ? 'A·cruza (texto aprobado)'
      : /aprobad|firmad|literal/i.test(seccion) ? 'B·parece aprobado y NO cruza'
        : 'C·otra';
    if (!porSeccion.has(clase)) porSeccion.set(clase, []);
    porSeccion.get(clase).push({ ficha: a.nombre, seccion, t, llaves: /{[^}]+}/.test(t), pintada: corpus.includes(t) });
  }
}
console.log(`fichas=${fichas.length} · con «SCRUM-n comentario NNNNN» fuera de cita: ${conRef}`);
for (const [clase, cs] of [...porSeccion.entries()].sort()) {
  const sinLlaves = cs.filter((c) => !c.llaves);
  console.log(`\n${clase}: citas=${cs.length} · con llaves=${cs.length - sinLlaves.length} · sin llaves=${sinLlaves.length} · de ellas pintadas=${sinLlaves.filter((c) => c.pintada).length} · NO pintadas=${sinLlaves.filter((c) => !c.pintada).length}`);
  const tit = new Map();
  for (const c of cs) tit.set(c.seccion, (tit.get(c.seccion) || 0) + 1);
  for (const [s, n] of [...tit.entries()].sort((x, y) => y[1] - x[1]).slice(0, clase.startsWith('A') ? 6 : 40)) console.log(`     ${String(n).padStart(3)} × «${s.slice(0, 90)}»`);
  if (clase.startsWith('B')) {
    console.log('   NO pintadas (sin llaves):');
    for (const c of sinLlaves.filter((x) => !x.pintada)) console.log(`     [${c.t.length}] ${c.ficha} · ${c.t.slice(0, 100)}`);
  }
}
console.log('\nEXIT=0');
