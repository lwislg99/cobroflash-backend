// SCRUM-863 fase b · LAS AUTO-REFERENCIAS ABSOLUTAS A yaqu.app EN src/  —  MIDE, NO ARREGLA.
//
// Regla 9: se listan. Ni una se corrige aqui.
//
// Tres preguntas, y son distintas:
//   a) las que hay, una a una: que construye cada una y si la cadena SALE al exterior.
//   b) ¿existe PUBLIC_BASE_URL y quien la lee? Es el CONTROL POSITIVO: si nadie la usa, esto es
//      «no hay convencion»; si muchos la usan y unos pocos no, es «hay convencion y se la saltan».
//      Son dos tickets distintos y el numero lo decide.
//   c) ¿alguna de las de cobro viaja a una factura YA EMITIDA? (regla 29)
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = process.argv[2];

function ts(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { ts(p, out); continue; }
    if (/\.ts$/.test(e.name)) out.push(path.relative(RAIZ, p).split(path.sep).join('/'));
  }
  return out;
}
const lista = ts(path.join(RAIZ, 'src')).sort();
const texto = new Map(lista.map((f) => [f, fs.readFileSync(path.join(RAIZ, f), 'utf8')]));
console.log('POBLACION: ' + lista.length + ' ficheros .ts bajo src/');
if (lista.length < 50) { console.log('🔴 SUELO: eso no es el arbol. CIEGO.'); process.exit(2); }

const esComentario = (l) => /^\s*(\/\/|\*|\/\*)/.test(l);

// ── a) LAS AUTO-REFERENCIAS ABSOLUTAS ───────────────────────────────────────────────────
const RE_PROPIA = /https?:\/\/(?:www\.)?yaqu\.app/;
const halladas = [];
for (const [f, t] of texto) {
  const ls = t.split('\n');
  for (let i = 0; i < ls.length; i++) {
    if (esComentario(ls[i])) continue;
    if (!RE_PROPIA.test(ls[i])) continue;
    halladas.push({ f, linea: i + 1, src: ls[i].trim() });
  }
}
console.log('\na) AUTO-REFERENCIAS ABSOLUTAS a yaqu.app en src/, fuera de comentarios: ' + halladas.length);

// 🔴 SUELO del censo: si no encuentra ninguna, el criterio esta roto (la fase anterior vio 10).
if (!halladas.length) { console.log('🔴 CIEGO: cero. El criterio esta roto.'); process.exit(2); }

// ¿LLEVA RESPALDO? Una linea que dice `config.PUBLIC_BASE_URL || 'https://yaqu.app'` NO es lo
// mismo que una que escribe el dominio a pelo: la primera respeta la convencion y solo cae al
// literal si la variable no esta puesta.
const conRespaldo = (s) => /PUBLIC_BASE_URL\s*\|\|/.test(s);

for (const h of halladas) {
  console.log('\n  · ' + h.f + ':' + h.linea);
  console.log('      ' + h.src.slice(0, 150));
  console.log('      ¿mira PUBLIC_BASE_URL como base? : ' + (conRespaldo(h.src) ? 'SI (respaldo)' : '🔴 NO — dominio a pelo'));
}

const aPelo = halladas.filter((h) => !conRespaldo(h.src));
console.log('\n  RESUMEN a): ' + halladas.length + ' en total · ' + conRespaldo.length);
console.log('    con respaldo PUBLIC_BASE_URL || …  : ' + (halladas.length - aPelo.length));
console.log('    🔴 dominio ESCRITO A PELO          : ' + aPelo.length);

// ── b) EL CONTROL POSITIVO: ¿hay convencion? ────────────────────────────────────────────
const usos = [];
for (const [f, t] of texto) {
  const ls = t.split('\n');
  for (let i = 0; i < ls.length; i++) {
    if (esComentario(ls[i])) continue;
    if (/PUBLIC_BASE_URL/.test(ls[i])) usos.push({ f, linea: i + 1, src: ls[i].trim() });
  }
}
console.log('\nb) ¿EXISTE PUBLIC_BASE_URL Y QUIEN LA LEE?  (control positivo)');
console.log('   usos en src/ fuera de comentarios: ' + usos.length);
for (const u of usos) console.log('     ' + u.f + ':' + u.linea + '   ' + u.src.slice(0, 120));

// Y en todo el arbol, para saber si la convencion existe fuera de src/ tambien.
let fuera = 0;
const andar = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { andar(p); continue; }
    if (!/\.(ts|js|mjs|yml|json)$/.test(e.name)) continue;
    const rel = path.relative(RAIZ, p).split(path.sep).join('/');
    if (rel.startsWith('src/')) continue;
    if (fs.readFileSync(p, 'utf8').includes('PUBLIC_BASE_URL')) fuera++;
  }
};
andar(RAIZ);
console.log('   ficheros FUERA de src/ que la nombran: ' + fuera);

// ── c) ¿ALGUNA DE LAS DE COBRO TOCA UNA FACTURA YA EMITIDA? (regla 29) ──────────────────
console.log('\nc) LAS DE COBRO — ¿tocan una factura YA EMITIDA?');
console.log('   Criterio: se mira si la funcion que las contiene ESCRIBE en la factura (update/');
console.log('   create de prisma) o solo LEE para componer un mensaje. Escribir seria regla 29.');
const deCobro = halladas.filter((h) => /\/pay\/|\/recibo\//.test(h.src));
for (const h of deCobro) {
  const t = texto.get(h.f);
  const ls = t.split('\n');
  // Ventana generosa alrededor: la funcion que la contiene.
  let ini = h.linea - 1;
  while (ini > 0 && !/^(export )?(async )?function |^export const \w+ = /.test(ls[ini])) ini--;
  let fin = h.linea;
  while (fin < ls.length && !/^}/.test(ls[fin])) fin++;
  const cuerpo = ls.slice(ini, fin + 1).join('\n');
  const escribe = [...cuerpo.matchAll(/prisma\.(\w+)\.(update|create|updateMany|upsert|delete)/g)].map((m) => m[1] + '.' + m[2]);
  console.log('\n  · ' + h.f + ':' + h.linea + '   (funcion desde la linea ' + (ini + 1) + ')');
  console.log('      ' + h.src.slice(0, 120));
  console.log('      escrituras prisma en esa funcion: ' + (escribe.length ? escribe.join(', ') : 'NINGUNA (solo lee)'));
}
