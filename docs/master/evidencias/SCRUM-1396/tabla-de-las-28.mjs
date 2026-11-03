// docs/master/evidencias/SCRUM-1396/tabla-de-las-28.mjs — SCRUM-1396b
//
// La tabla que pide el orquestador (27-oct-2026): cada llamada que el censo nuevo acusa en las
// cuatro categorías de fuga de `scrum864c` ③, con su categoría, si la fuga está MEDIDA (J4,
// c.18875/c.18877), y su carril. Solo LEE: corre `censar()` sobre el árbol, `git ls-tree` y
// `scripts/carriles.mjs de` con la ruta real. No crea temporales ni toca ningún fichero.
//
//   node docs/master/evidencias/SCRUM-1396/tabla-de-las-28.mjs
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { censar } from '../../../../scripts/_censo-mkdtemp.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const FUGA = new Set(['SIN_LIMPIEZA', 'NO_GARANTIZADA', 'ESCAPA', 'FABRICA']);
// Las dos que J4 midió dejando resto con un fallo inyectado (c.18875). Por fichero, no por línea:
// la línea se mueve con el fichero y el fichero no tiene otra llamada acusada.
const MEDIDAS = new Set(['tests/scrum1263-gancho-pre-push.test.mjs', 'tests/scrum454-destructivo-sin-comprobacion.test.mjs']);
// Las 24 del 6-oct, por fichero (evidencia de la rama): las que J4 midió sin resto.
const DEL_6OCT = new Set(
  (await import('node:fs')).readFileSync(path.join(RAIZ, 'docs/master/evidencias/SCRUM-1396/las-24-llamadas.txt'), 'utf8')
    .split('\n').map((l) => l.split(':')[0]).filter(Boolean),
);

const git = (...a) => execFileSync('git', a, { cwd: RAIZ, encoding: 'utf8' }).trim();
const censo = censar(RAIZ);
const acusadas = censo.nuestras.filter((l) => FUGA.has(l.categoria));
const filas = acusadas.map((l) => {
  const enArbol = git('ls-tree', '--name-only', 'HEAD', '--', l.fichero) === l.fichero;
  const creador = git('log', '--diff-filter=A', '--format=%an', '--', l.fichero).split('\n').pop();
  const carril = execFileSync('node', ['scripts/carriles.mjs', 'de', l.fichero], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n')[0].replace(/^.*?→\s*/, '').replace(/\s*·.*$/, '');
  const tipo = MEDIDAS.has(l.fichero) ? 'FUGA MEDIDA (J4 c.18875)'
    : DEL_6OCT.has(l.fichero) ? 'por FORMA (J4: 0 restos)' : 'NUEVA, sin medir';
  return { sitio: `${l.fichero}:${l.linea}`, categoria: l.categoria, tipo, enArbol, creador, carril };
});
console.log('| fichero:línea | categoría | fuga | en el árbol | lo creó (git) | carril (`carriles.mjs de`) |');
console.log('|---|---|---|---|---|---|');
for (const f of filas) console.log(`| \`${f.sitio}\` | ${f.categoria} | ${f.tipo} | ${f.enArbol ? 'sí' : 'NO'} | ${f.creador} | ${f.carril} |`);
const cuenta = (t) => filas.filter((f) => f.tipo.startsWith(t)).length;
console.log(`\nacusadas=${filas.length} · medida=${cuenta('FUGA')} · forma=${cuenta('por FORMA')} · nueva=${cuenta('NUEVA')} · `
  + `rutas que no están en el árbol=${filas.filter((f) => !f.enArbol).length} · población: ${censo.conTemporales.length} ficheros con temporales, ${censo.nuestras.length} llamadas, ${censo.ficheros} mirados`);
