// ③ CENSO · bloques OCULTOS con texto de cara al cliente y SIN marcador de microcopy.
//
// SOLO LEE. No marca, no reescribe, no enseña nada (regla 30). `public/index.html` no se toca.
//
// ⚠️ TODO EN NODE: el grep de Git Bash normaliza CRLF al leer, y una clase con acento (`[oó]`)
// devuelve cero donde hay cinco.
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = process.argv[2];
const html = fs.readFileSync(path.join(RAIZ, 'public/index.html'), 'utf8');

// 🔴 `hidden` DE VERDAD, NO `aria-hidden`. Son cosas distintas y confundirlas infla el censo: el
// primer intento dio 19 elementos porque `\bhidden\b` casa dentro de `aria-hidden="true"`, que no
// oculta a la vista sino al lector de pantalla. Con el criterio bien, son 6.
function conHidden() {
  const out = [];
  for (const m of html.matchAll(/<(\w+)\b([^>]*)>/g)) {
    const attrs = m[2].replace(/aria-hidden\s*=\s*"[^"]*"/g, '');
    if (!/(^|\s)hidden(\s|=|$)/.test(attrs)) continue;
    out.push({
      tag: m[1],
      linea: html.slice(0, m.index).split('\n').length,
      id: (/\bid\s*=\s*"([^"]*)"/.exec(m[0]) || [])[1] ?? '(sin id)',
      marcado: /data-microcopy|data-propuesta/.test(m[0]),
      abre: m[0],
    });
  }
  return out;
}

const ocultos = conHidden();

// 🔴 SUELO: hay cuatro secciones marcadas en esta página. Si el censo no ve ninguna, lo roto es
// el criterio, no la página.
const marcados = ocultos.filter((o) => o.marcado);
if (marcados.length < 4) {
  console.log('🔴 SUELO: solo ' + marcados.length + ' elementos MARCADOS. Hay cuatro secciones');
  console.log('   marcadas en esta pagina, asi que esto es el criterio roto. No se afirma nada.');
  process.exit(2);
}

console.log('ELEMENTOS CON EL ATRIBUTO `hidden` (no `aria-hidden`)');
for (const o of ocultos) {
  console.log('  ' + String(o.linea).padStart(4) + '  <' + o.tag + ' #' + o.id + '>  '
    + (o.marcado ? 'MARCADO' : '🔴 SIN marcador de microcopy'));
}
const sinMarcar = ocultos.filter((o) => !o.marcado);
console.log('  total: ' + ocultos.length + '  ·  marcados: ' + marcados.length
  + '  ·  SIN marcador: ' + sinMarcar.length);

// ── ¿QUE DICEN LOS QUE NO LLEVAN MARCADOR, Y QUE LOS ENSEÑA? ────────────────────────────
console.log('\nLOS QUE NO LLEVAN MARCADOR — su texto, tal cual');
for (const o of sinMarcar) {
  const i = html.indexOf(o.abre);
  const trozo = html.slice(i, i + 420).replace(/\s+/g, ' ');
  console.log('\n  #' + o.id + '  (linea ' + o.linea + ')');
  console.log('    ' + trozo.slice(0, 330));
}

// ── ¿QUE LOS MANTIENE OCULTOS Y QUE LOS ENSEÑARIA? ──────────────────────────────────────
console.log('\n¿QUE LOS ENSEÑA?');
for (const id of sinMarcar.map((o) => o.id)) {
  const quita = [...html.matchAll(new RegExp("getElementById\\('" + id + "'\\)", 'g'))];
  console.log('  #' + id + ' : ' + quita.length + ' referencia(s) desde el JS de la pagina');
}
const linesShow = html.split('\n')
  .map((s, i) => ({ s, i: i + 1 }))
  .filter((x) => /\.hidden\s*=\s*false/.test(x.s));
console.log('\n  lineas que QUITAN el hidden:');
for (const x of linesShow) console.log('    ' + x.i + '  ' + x.s.trim().slice(0, 150));

// ── ¿EL CSS RESPETA EL hidden? ──────────────────────────────────────────────────────────
console.log('\n¿EL CSS RESPETA EL `hidden`?');
for (const m of html.matchAll(/^\s*([.#][\w-]+)\[hidden\]\s*\{([^}]*)\}/gm)) {
  console.log('  🔴 ' + m[1] + '[hidden] { ' + m[2].trim() + ' }   ← el CSS lo redefine');
}

// ── ¿LO RECOGE ALGUN DOCUMENTO? ─────────────────────────────────────────────────────────
function md(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) md(p, out);
    else if (/\.md$/i.test(e.name)) out.push(path.relative(RAIZ, p).split(path.sep).join('/'));
  }
  return out;
}
const docs = md(path.join(RAIZ, 'docs'));
console.log('\n¿LO RECOGE ALGUN DOCUMENTO?  (' + docs.length + ' .md bajo docs/)');
for (const aguja of ['Oferta fundadores', 'Oferta de lanzamiento', '9,90']) {
  const hits = docs.filter((f) => fs.readFileSync(path.join(RAIZ, f), 'utf8').includes(aguja));
  console.log('  «' + aguja + '» -> ' + hits.length + ' documento(s)'
    + (hits.length && hits.length <= 8 ? ':  ' + hits.join(' · ') : ''));
}
