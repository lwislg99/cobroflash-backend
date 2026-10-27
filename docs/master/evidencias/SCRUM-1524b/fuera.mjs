// Cuantas coordenadas fichero:linea hay FUERA de docs/legal, con el extractor de la casa. Solo POBLACION: no mide F2.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const raiz = process.argv[2];
const { coordenadasDe } = await import(pathToFileURL(path.join(raiz, 'scripts/_anclas-con-testigo.mjs')).href);
const andar = (d, f = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) andar(p, f); else if (e.name.endsWith('.md')) f.push(p); } return f; };
const zonas = {
  'docs/legal (control: 205)': andar(path.join(raiz, 'docs/legal')).filter((p) => path.dirname(p) === path.join(raiz, 'docs/legal')),
  'docs/RUNBOOKS.md': [path.join(raiz, 'docs/RUNBOOKS.md')],
  'docs/QA_MASTER.md': [path.join(raiz, 'docs/QA_MASTER.md')],
  'docs/equipo/**': andar(path.join(raiz, 'docs/equipo')),
  '.claude/skills/**': andar(path.join(raiz, '.claude/skills')),
  'CLAUDE.md': [path.join(raiz, 'CLAUDE.md')],
  'docs/YAQU_MASTER.md': [path.join(raiz, 'docs/YAQU_MASTER.md')],
  'docs/master/*.md (registros)': andar(path.join(raiz, 'docs/master')).filter((p) => !p.includes('evidencias')),
  'CERO derivado (fichero sembrado sin citas)': null,
};
for (const [z, fs_] of Object.entries(zonas)) {
  if (!fs_) { console.log(z.padEnd(46), 'ficheros 1 · coordenadas', coordenadasDe('# nada\n\nuna frase sin cita y `otra.cosa` sin linea\n').length); continue; }
  let n = 0, bytes = 0, con = 0;
  for (const p of fs_) { const t = fs.readFileSync(p, 'utf8'); bytes += t.length; const c = coordenadasDe(t).length; n += c; if (c) con++; }
  console.log(z.padEnd(46), `ficheros ${fs_.length} · con alguna ${con} · ${bytes} car. · coordenadas ${n}`);
}
