// docs/master/evidencias/scrum1500h/aplicar-relevo.cjs — SCRUM-1500h, el relevo (SCRUM-1500 c.19155)
//
// Dos cosas, EN SITIO y todo o nada, con el mismo método que `aplicar.cjs`:
//
//  ① QUITA la nota de la línea 88 de la skill `yaqu-verifactu-sif`, en sus dos copias. «No hay
//     pruebas contra la AEAT» no es ninguna de las afirmaciones del permiso (c.18993): la nota
//     ensanchaba el permiso del fundador. La línea tiene que quedar BYTE A BYTE como en el
//     ancestro común con `origin/main`; si no queda así, no se escribe nada.
//  ② CORRIGE `verifactu/SKILL.md` 51-52 («No hay ni una sola llamada del código hacia la Agencia
//     Tributaria»), que quedó fuera de la población de `aplicar.cjs`. El texto es el MISMO que el
//     de las gemelas del cliente: las constantes `C` y `CNM` se leen de `aplicar.cjs`, no se
//     vuelven a teclear aquí.
//
//   node docs/master/evidencias/scrum1500h/aplicar-relevo.cjs --seco    (no escribe; dice qué haría)
//   node docs/master/evidencias/scrum1500h/aplicar-relevo.cjs           (escribe)
//
// Se corre UNA vez. Sobre el árbol ya corregido cae entero, a propósito. Lo que demuestra que
// quedó en sitio es `en-sitio.cjs`.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const RAIZ = path.resolve(__dirname, '..', '..', '..', '..');
const SECO = process.argv.includes('--seco');
const git = (...a) => execFileSync('git', a, { cwd: RAIZ, maxBuffer: 1 << 28 });
const BASE = git('merge-base', 'HEAD', 'origin/main').toString().trim();

// Las constantes del texto se LEEN del guion original: una frase tecleada dos veces son dos frases.
const fuente = fs.readFileSync(path.join(__dirname, 'aplicar.cjs'), 'utf8');
const constante = (nombre) => {
  const m = fuente.match(new RegExp('^const ' + nombre + " = '(.*)';$", 'm'));
  if (!m) throw new Error(`no encuentro la constante ${nombre} en aplicar.cjs`);
  return m[1];
};
const F = constante('F');
const PS = constante('PS');
const C = constante('C');
const CNM = constante('CNM');

const SKILL = ['.claude/skills/yaqu-verifactu-sif/SKILL.md', '.agents/skills/yaqu-verifactu-sif/SKILL.md'];
const OTRA = '.claude/skills/verifactu/SKILL.md';

/** quita: la línea tiene que quedar idéntica a la del ancestro. cambia: `viejo` (una vez) por `nuevo`. */
const OPS = [
  ...SKILL.map((f) => ({ f, l: 88, quita: /^(  hay envío) \[Nota del 13-oct-2026, SCRUM-1500h, .*?\](, y el documento)/ })),
  { f: OTRA, l: 51, viejo: 'No hay ni una sola llamada del código hacia la', nuevo: 'Nada envía a la' },
  { f: OTRA, l: 52, viejo: 'Agencia Tributaria. La auditoría',
    nuevo: `Agencia Tributaria. [Corregido ${F}, ${PS}: aquí decía «No hay ni una sola llamada del código hacia la Agencia Tributaria», que es falso como «el código no trae ninguna llamada» desde SCRUM-1127 y sigue siendo cierto como «nada envía». ${C} ${CNM}] La auditoría` },
];

const cuantas = (texto, trozo) => texto.split(trozo).length - 1;
const porFichero = new Map();
const fallos = [];
for (const op of OPS) {
  if (!porFichero.has(op.f)) {
    const crudo = fs.readFileSync(path.join(RAIZ, op.f), 'utf8');
    porFichero.set(op.f, { lineas: crudo.split('\n'), antes: crudo.split('\n').length });
  }
  const { lineas } = porFichero.get(op.f);
  const i = op.l - 1;
  if (lineas[i].endsWith('\r')) { fallos.push(`${op.f}:${op.l} — la línea trae un retorno de carro`); continue; }
  if (op.quita) {
    if (!op.quita.test(lineas[i])) { fallos.push(`${op.f}:${op.l} — no lleva la nota`); continue; }
    const sin = lineas[i].replace(op.quita, (_, a, b) => a + b);
    const original = git('show', `${BASE}:${op.f}`).toString('utf8').split('\n')[i];
    if (sin !== original) { fallos.push(`${op.f}:${op.l} — sin la nota NO queda como en ${BASE.slice(0, 9)}`); continue; }
    lineas[i] = sin;
  } else {
    const n = cuantas(lineas[i], op.viejo);
    if (n !== 1) { fallos.push(`${op.f}:${op.l} — el trozo viejo aparece ${n} veces, no 1`); continue; }
    if (/[\r\n]/.test(op.nuevo)) { fallos.push(`${op.f}:${op.l} — el texto nuevo trae un salto de línea`); continue; }
    lineas[i] = lineas[i].replace(op.viejo, () => op.nuevo);
  }
}

console.log(`BASE: ${BASE}`);
console.log(`POBLACION: ${OPS.length} operaciones sobre ${porFichero.size} ficheros`);
if (fallos.length) {
  console.log(`NO SE ESCRIBE NADA: ${fallos.length} operación(es) no casan:`);
  for (const x of fallos) console.log('  ' + x);
  console.log('EXIT=1');
  process.exit(1);
}
for (const [f, { lineas, antes }] of porFichero) {
  if (lineas.length !== antes) throw new Error(`${f}: cambió el número de líneas`);
  if (!SECO) fs.writeFileSync(path.join(RAIZ, f), lineas.join('\n'));
  console.log(`  ${SECO ? 'haría' : 'escrito'}: ${f} (${lineas.length} líneas)`);
}
console.log('EXIT=0');
