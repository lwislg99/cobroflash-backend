// Exploración: ¿de qué tamaño son las poblaciones? No concluye nada.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const RAIZ = path.resolve(process.argv[2]);
const m = await import(pathToFileURL(path.join(RAIZ, 'scripts', 'meta-guard-mutaciones.mjs')).href);
const censo = m.censoDeDeclaraciones();
const enCatalogo = new Map(censo.map((c) => [c.guard, c.mutaciones.length]));
console.log('CATÁLOGO del meta-guard: ' + enCatalogo.size + ' guards · ' + [...enCatalogo.values()].reduce((a, b) => a + b, 0) + ' declaraciones');

const seguidos = execFileSync('git', ['ls-files', '-z'], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 1 << 28 }).split('\0').filter(Boolean);
const tests = seguidos.filter((f) => /^tests\/[^/]+\.test\.mjs$/.test(f));
console.log('tests/*.test.mjs seguidos: ' + tests.length);

// Tests que NOMBRAN la constante (texto) frente a los que el censo ve.
const nombran = tests.filter((f) => fs.readFileSync(path.join(RAIZ, f), 'utf8').includes('MUTACIONES_QUE_ME_TUMBAN'));
console.log('tests que contienen el texto MUTACIONES_QUE_ME_TUMBAN: ' + nombran.length + ' · de ellos en el catálogo: ' + nombran.filter((f) => enCatalogo.has(path.basename(f))).length);

const registros = seguidos.filter((f) => /^docs\/master\/SCRUM-\d+\.md$/.test(f));
const conMut = registros.filter((f) => /mutaci[oó]n|mutante/i.test(fs.readFileSync(path.join(RAIZ, f), 'utf8')));
console.log('registros docs/master/SCRUM-N.md: ' + registros.length + ' · que hablan de mutación/mutante: ' + conMut.length);

const evid = seguidos.filter((f) => /^docs\/(master\/)?evidencias\//.test(f));
const bancosMut = evid.filter((f) => /mut/i.test(path.basename(f)));
const dirs = new Map();
for (const f of bancosMut) { const d = path.dirname(f); dirs.set(d, [...(dirs.get(d) || []), path.basename(f)]); }
console.log('ficheros de evidencias: ' + evid.length + ' · con «mut» en el nombre: ' + bancosMut.length + ' · en ' + dirs.size + ' carpetas');
for (const [d, fs_] of [...dirs].sort()) console.log('   ' + d + ' → ' + fs_.join(', '));
