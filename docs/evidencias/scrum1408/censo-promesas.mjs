// docs/evidencias/scrum1408/censo-promesas.mjs — SCRUM-1408, parte ④
//
// ¿Cuántos comentarios de `src/` prometen un guard, un test o una comprobación, y cuántos dicen
// CUÁL? Es un RECUENTO, no un arreglo, y casa por la FORMA de la frase: es un suelo, no un censo
// completo. Una promesa escrita de otra manera («esto lo vigila CI», «está cubierto») no sale.
//
//   node docs/evidencias/scrum1408/censo-promesas.mjs            → el recuento y las que no nombran nada
//   node docs/evidencias/scrum1408/censo-promesas.mjs --todas    → además, las otras dos clases
//
// Cada promesa se clasifica mirando SU ventana (la línea anterior, la suya y las tres siguientes):
//   · FICHERO  — nombra un fichero de test, un script o un `npm run guard:…`: tiene dirección;
//   · TICKET   — sólo nombra un número de ticket: hay que ir a buscar el fichero;
//   · NADA     — no nombra ni una cosa ni otra.
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..', '..', '..');

const COSA = '(guard|guardia|test|trinquete|censo|comprobaci[oó]n)';
const VERBO = '(comprueba|vigila|caza|sujeta|impide|exige|cubre|protege|ata|verifica|hace cumplir)';
const PROMESAS = [
  new RegExp(`\\b(hay|existe)\\s+un[a]?\\s+${COSA}\\b`, 'i'),
  new RegExp(`\\bun[a]?\\s+${COSA}\\s+(que\\s+)?(lo|la|los|las)\\s+${VERBO}`, 'i'),
  new RegExp(`\\b(lo|la|los|las)\\s+${VERBO}\\s+(un[a]?|el|la)\\s+${COSA}\\b`, 'i'),
];
const NOMBRA_FICHERO = /tests\/|scripts\/|\.test\.mjs|[\w-]+\.mjs\b|\bscrum\d+[a-z]?-[\w-]+|guards?:[a-z-]+|npm run [\w:-]+/;
const NOMBRA_TICKET = /SCRUM-\d+|\bscrum\d+/i;

/** El texto de comentario de una línea, o `null` si la línea no es comentario. Por líneas, CRLF incluido. */
function comentarioDe(linea) {
  const t = linea.trim();
  if (t.startsWith('//')) return t.slice(2);
  if (t.startsWith('/*') || t.startsWith('*')) return t.replace(/^\/?\*+\/?/, '');
  const i = linea.indexOf(' // ');
  return i >= 0 ? linea.slice(i + 4) : null;
}

export function promesasDe(fuente) {
  const lineas = fuente.split(/\r?\n/).map(comentarioDe);
  const out = [];
  lineas.forEach((c, i) => {
    if (c === null || !PROMESAS.some((p) => p.test(c))) return;
    const ventana = lineas.slice(Math.max(0, i - 1), i + 4).filter((x) => x !== null).join(' ');
    const clase = NOMBRA_FICHERO.test(ventana) ? 'FICHERO' : NOMBRA_TICKET.test(ventana) ? 'TICKET' : 'NADA';
    out.push({ linea: i + 1, clase, texto: c.trim().slice(0, 150) });
  });
  return out;
}

// ── Controles: se corren SIEMPRE, antes del recuento. Si alguno falla, el número no vale. ──
const controles = [
  ['cero: código sin comentarios', `const hay = 'hay un guard que lo comprueba';`, []],
  ['cero: comentario que no promete', `// este fichero no decide nada\nconst x = 1;`, []],
  ['positivo NADA (la frase de SCRUM-1408)', `// y hay un guard que lo comprueba:\n// si un día alguien lee la tabla…\nconst x = 1;`, ['NADA']],
  ['positivo TICKET', `// lo vigila un test (SCRUM-597)\nconst x = 1;`, ['TICKET']],
  ['positivo FICHERO', `// hay un guard que lo comprueba:\n// tests/scrum123-algo.test.mjs\nconst x = 1;`, ['FICHERO']],
];
let rotos = 0;
for (const [nombre, fuente, esperado] of controles) {
  const visto = promesasDe(fuente).map((p) => p.clase);
  const ok = JSON.stringify(visto) === JSON.stringify(esperado);
  if (!ok) rotos++;
  console.log(`CONTROL ${ok ? 'ok ' : '🔴 ROTO'} · ${nombre} · esperado ${JSON.stringify(esperado)} · visto ${JSON.stringify(visto)}`);
}
if (rotos) { console.log(`🔴 CIEGO: ${rotos} control(es) rotos; no se cuenta nada · EXIT=2`); process.exit(2); }

const fuentes = [];
const baja = (dir) => {
  for (const e of fs.readdirSync(path.join(RAIZ, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) baja(rel); else if (e.name.endsWith('.ts')) fuentes.push(rel);
  }
};
baja('src');
fuentes.sort();

const todas = [];
for (const rel of fuentes) for (const p of promesasDe(fs.readFileSync(path.join(RAIZ, rel), 'utf8'))) todas.push({ rel, ...p });
const de = (clase) => todas.filter((p) => p.clase === clase);

console.log(`POBLACIÓN: ${fuentes.length} ficheros .ts de src/ · ${todas.length} promesas por la forma de la frase, en ${new Set(todas.map((p) => p.rel)).size} ficheros`);
console.log(`  FICHERO (tiene dirección): ${de('FICHERO').length}`);
console.log(`  TICKET  (sólo un número):  ${de('TICKET').length}`);
console.log(`  NADA    (sin dirección):   ${de('NADA').length}`);
const pinta = (clase) => { console.log(`\n── ${clase} ──`); for (const p of de(clase)) console.log(`${p.rel}:${p.linea}\t${p.texto}`); };
pinta('NADA');
if (process.argv.includes('--todas')) { pinta('TICKET'); pinta('FICHERO'); }
console.log('\nEXIT=0');
