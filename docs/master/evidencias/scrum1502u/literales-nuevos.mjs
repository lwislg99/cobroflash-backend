// docs/master/evidencias/scrum1502u/literales-nuevos.mjs — apéndice ③ del tramo 1502u (S0, 26-nov-2026)
//
// Los literales NUEVOS que puede ver un usuario entre el cierre de la 1.0 y main: cada cadena entre
// comillas que aparece en una línea AÑADIDA (diff -U0) de public/ y src/ (sin tests), con el commit
// que la trajo (blame en main) y si su texto consta en docs/microcopy/ (la ficha de firma).
//
// Uso: node docs/master/evidencias/scrum1502u/literales-nuevos.mjs <base> <punta> [salida.json]
//   Imprime la POBLACIÓN (ficheros, líneas añadidas, cadenas) y la lista entera antes de filtrar.
// El filtro «parece texto visible» es una heurística declarada (`pareceTexto`): lo que tira se cuenta.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const [BASE, PUNTA = 'origin/main', SALIDA] = process.argv.slice(2);
if (!BASE) { console.error('uso: literales-nuevos.mjs <base> <punta> [salida.json]'); process.exit(2); }
const git = (...a) => execFileSync('git', a, { maxBuffer: 1 << 28 }).toString('utf8');

const ficheros = git('diff', '--name-only', BASE, PUNTA, '--', 'public', 'src')
  .split('\n').filter(Boolean).filter((f) => /\.(js|ts|mjs|html)$/.test(f));

// Texto de las fichas de firma, para buscar el literal tal cual.
const fichas = git('ls-tree', '-r', '--name-only', PUNTA, '--', 'docs/microcopy').split('\n').filter(Boolean);
const textoFichas = fichas.map((f) => ({ f, t: git('show', `${PUNTA}:${f}`) }));

const RE_CADENA = /'((?:[^'\\\n]|\\.){2,})'|"((?:[^"\\\n]|\\.){2,})"|`((?:[^`\\]|\\.){2,})`/g;
// Heurística: dos palabras con letras, o una palabra con mayúscula/tilde y ≥4 letras; fuera clases CSS,
// rutas, selectores, claves, SQL y nombres de evento.
const pareceTexto = (s) => {
  const t = s.replace(/\$\{[^}]*\}/g, ' ');
  if (/^[\w.:/#\-[\]=>*@ ]+$/.test(t) && !/\s\w+\s/.test(` ${t} `.replace(/^\s+/, ''))) {
    if (!/[A-ZÁÉÍÓÚÑ¿¡]/.test(t[0] || '') && !/[áéíóúñ¿¡]/.test(t)) return false;
  }
  if (/^(?:\.|#|\/|https?:|[a-z]+(?:-[a-z]+)+$|[a-z]+(?:[A-Z][a-z]+)+$|[A-Z_]{3,}$)/.test(t.trim())) return false;
  if (/\b(?:SELECT|INSERT|UPDATE|WHERE|JOIN)\b/.test(t)) return false;
  if (/<\/?[a-z][^>]*>/.test(t) && !/[A-ZÁÉÍÓÚÑ¿¡][a-záéíóúñ]+\s+[a-záéíóúñ]/.test(t.replace(/<[^>]+>/g, ' '))) return false;
  return /[A-Za-zÁÉÍÓÚÑáéíóúñ]{3,}\s+[A-Za-zÁÉÍÓÚÑáéíóúñ]{2,}/.test(t) || /^[A-ZÁÉÍÓÚÑ¿¡][a-záéíóúñ]{3,}/.test(t.trim());
};

const poblacion = { base: BASE, punta: PUNTA, ficheros: ficheros.length, lineasAnadidas: 0, lineasComentario: 0, cadenas: 0, tiradas: 0 };
const filas = [];
for (const f of ficheros) {
  const diff = git('diff', '-U0', BASE, PUNTA, '--', f).split('\n');
  let n = 0;
  for (const l of diff) {
    const h = l.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (h) { n = Number(h[1]); continue; }
    if (!l.startsWith('+') || l.startsWith('+++')) continue;
    const linea = l.slice(1);
    poblacion.lineasAnadidas++;
    const nLinea = n++;
    if (/^\s*(?:\/\/|\*|\/\*)/.test(linea)) { poblacion.lineasComentario++; continue; }
    for (const m of linea.matchAll(RE_CADENA)) {
      const s = m[1] ?? m[2] ?? m[3];
      poblacion.cadenas++;
      if (!pareceTexto(s)) { poblacion.tiradas++; if (process.env.VER_TIRADAS) console.log(`TIRADA\t${f}:${nLinea}\t${JSON.stringify(s).slice(0, 90)}`); continue; }
      filas.push({ fichero: f, linea: nLinea, texto: s });
    }
  }
}
// Commit que trajo cada línea (blame en la punta) y si el literal consta en una ficha.
const blameCache = new Map();
for (const x of filas) {
  const k = `${x.fichero}:${x.linea}`;
  if (!blameCache.has(k)) {
    const b = git('blame', '-l', '-L', `${x.linea},${x.linea}`, '--porcelain', PUNTA, '--', x.fichero);
    const sha = b.split(' ')[0];
    const resumen = git('log', '-1', '--format=%s', sha).trim();
    blameCache.set(k, { sha: sha.slice(0, 9), resumen });
  }
  Object.assign(x, blameCache.get(k));
  const fijo = x.texto.replace(/\$\{[^}]*\}/g, '\u0000').split('\u0000').map((p) => p.trim()).filter((p) => p.length >= 4);
  const enFicha = textoFichas.filter(({ t }) => fijo.length && fijo.every((p) => t.includes(p))).map(({ f }) => f);
  x.fichas = enFicha;
}
console.log('── POBLACIÓN ──'); console.log(JSON.stringify(poblacion));
console.log(`literales que parecen texto: ${filas.length} · en alguna ficha de docs/microcopy/: ${filas.filter((x) => x.fichas.length).length}`);
console.log('\n── LISTA ENTERA ──');
for (const x of filas) console.log(`${x.fichas.length ? 'FICHA' : '-----'}\t${x.fichero}:${x.linea}\t${x.sha}\t${JSON.stringify(x.texto).slice(0, 120)}\t${x.fichas[0] || ''}\t${x.resumen.slice(0, 70)}`);
if (SALIDA) fs.writeFileSync(SALIDA, JSON.stringify({ poblacion, filas }, null, 2));
