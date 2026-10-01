// Censo de SCRUM-1334 (sólo lectura). Uso: node tests/banco-scrum1334/censo.mjs [--json <ruta>]
//
// Toda línea de cita de `docs/microcopy/`, con la sección en la que va, y lo que se puede saber de
// ella leyendo: si lleva huecos, si lleva negrita, cuánto mide y si el código la pinta tal cual.
// No decide nada: es la población sobre la que se decide.
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

const fichas = aprobacionesDeMicrocopy().filter((a) => a.origen === 'fichero');
console.log(`POBLACION fichas=${fichas.length} (firma que cuenta: ${fichas.filter((a) => a.aprobada).length}) · corpus=${ficheros.length} ficheros`);

const citas = [];
const secciones = [];
for (const a of fichas) {
  let sec = { ficha: a.nombre, titulo: '(sin encabezado)', nivel: 0, linea: 0, citas: 0, aprobada: a.aprobada };
  secciones.push(sec);
  const lineas = a.texto.split(/\r?\n/);
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    const h = /^(#{1,6})\s+(.*)$/.exec(l);
    if (h) { sec = { ficha: a.nombre, titulo: h[2].trim(), nivel: h[1].length, linea: i + 1, citas: 0, aprobada: a.aprobada }; secciones.push(sec); continue; }
    const m = /^>\s?(.+)$/.exec(l.trim());
    if (!m || m[1].trim().length < 4) continue;
    const t = m[1].trim();
    sec.citas++;
    citas.push({
      ficha: a.nombre, linea: i + 1, seccion: sec.titulo, aprobada: a.aprobada, t,
      largo: t.length, llaves: /{[^}]+}/.test(t), negrita: /\*\*/.test(t), pintada: corpus.includes(t),
      hoy: /texto\s+aprobado/i.test(sec.titulo),
    });
  }
}

const conCitas = secciones.filter((s) => s.citas > 0);
console.log(`secciones=${secciones.length} · con alguna cita=${conCitas.length} · citas=${citas.length}`);
console.log(`hoy se cruzan (encabezado «Texto aprobado»): ${citas.filter((c) => c.hoy).length} de ${citas.length}`);

const porTitulo = new Map();
for (const c of citas) {
  if (!porTitulo.has(c.seccion)) porTitulo.set(c.seccion, []);
  porTitulo.get(c.seccion).push(c);
}
console.log('\nPOR TÍTULO DE SECCIÓN (citas · con llaves · negrita · >160 · pintadas · no pintadas sin llaves) [fichas]');
for (const [tit, cs] of [...porTitulo.entries()].sort((x, y) => y[1].length - x[1].length)) {
  const sinLl = cs.filter((c) => !c.llaves);
  console.log(`  ${cs[0].hoy ? 'HOY' : '   '} ${String(cs.length).padStart(3)} · ll=${cs.length - sinLl.length} · neg=${cs.filter((c) => c.negrita).length} · >160=${cs.filter((c) => c.largo > 160).length} · pint=${sinLl.filter((c) => c.pintada).length} · NO=${sinLl.filter((c) => !c.pintada).length} [${new Set(cs.map((c) => c.ficha)).size}] «${tit.slice(0, 100)}»`);
}

const i = process.argv.indexOf('--json');
if (i > 0) {
  fs.writeFileSync(process.argv[i + 1], JSON.stringify({ citas, secciones: conCitas }, null, 1));
  console.log(`\nvolcado en ${process.argv[i + 1]}`);
}
console.log('\nEXIT=0');
