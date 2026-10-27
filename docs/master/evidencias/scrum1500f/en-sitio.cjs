// SCRUM-1500f: comprueba que los cinco sitios se corrigieron EN SITIO y nada mas.
// Uso: node docs/master/evidencias/scrum1500f/en-sitio.cjs <raiz-del-repo> <ref-base>
//
// Cuatro preguntas, cada una con su control:
//   (1) por BYTES: mismas lineas antes y despues, 0 CR, sin BOM, y QUE lineas cambian;
//   (2) la copia de la skill en .agents/ es identica byte a byte a la de .claude/;
//   (3) en el test solo cambia el comentario: los tokens de codigo son los mismos;
//   (4) la cita de PREGUNTAS_ASESOR.md lleva el corchete LITERAL de modoVisible.ts:22.
// Y un recuento final de quien sigue diciendo la frase vieja, con positivo y con cero.
// No escribe nada. Sale 0 si todo cuadra, 1 si algo no, 2 si no pudo mirar.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const [raiz, ref] = process.argv.slice(2);
if (!raiz || !ref) { console.log('CIEGO: faltan <raiz> y <ref-base>'); process.exit(2); }
const git = (...a) => execFileSync('git', ['-C', raiz, ...a], { maxBuffer: 1 << 27 });
// se compara contra el ANCESTRO COMUN, no contra la punta: main se mueve mientras se mide y
// un fichero que entra por main saldria como cambiado por esta rama (paso: salio 7 en vez de 6)
const base = git('merge-base', ref, 'HEAD').toString().trim();
const disco = (f) => fs.readFileSync(path.join(raiz, f));

const SKILL = '.claude/skills/yaqu-verifactu-sif/SKILL.md';
const ESPEJO = '.agents/skills/yaqu-verifactu-sif/SKILL.md';
const TEST = 'tests/scrum298-modo-visible.test.mjs';
const ASESOR = 'docs/legal/PREGUNTAS_ASESOR.md';
const MODO = 'src/modules/invoicing/domain/modoVisible.ts';
// fichero -> lineas que se espera que cambien, y ninguna mas
const ESPERADO = {
  [SKILL]: [57, 58, 59, 60, 61],
  [ESPEJO]: [57, 58, 59, 60, 61],
  'docs/legal/AUDITORIA_CAMINO_EMISION.md': [52],
  'docs/legal/INVENTARIO_AFIRMACIONES_VERIFACTU.md': [416],
  [ASESOR]: [461, 463, 464],
  [TEST]: [9, 10],
};
let mal = 0;
const dice = (ok, texto) => { if (!ok) mal++; console.log((ok ? 'ok  ' : 'MAL ') + texto); };

// ── (1) por bytes ────────────────────────────────────────────────────────────────────────
const cuenta = (b) => ({
  bytes: b.length,
  cr: b.filter((x) => x === 0x0d).length,
  lf: b.filter((x) => x === 0x0a).length,
  bom: b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf,
});
if (cuenta(Buffer.from('a\r\nb\r\n')).cr !== 2 || !cuenta(Buffer.from([0xef, 0xbb, 0xbf, 0x61])).bom) {
  console.log('CIEGO: el contador de CR o el de BOM no cuentan'); process.exit(2);
}
console.log('(1) por bytes, contra el ancestro comun con ' + ref + ' = ' + base);
for (const [f, esperadas] of Object.entries(ESPERADO)) {
  const a = git('show', base + ':' + f);
  const d = disco(f);
  const ca = cuenta(a);
  const cd = cuenta(d);
  const la = a.toString('utf8').split('\n');
  const ld = d.toString('utf8').split('\n');
  const distintas = [];
  for (let i = 0; i < Math.max(la.length, ld.length); i++) if (la[i] !== ld[i]) distintas.push(i + 1);
  dice(ca.lf === cd.lf && cd.cr === 0 && !cd.bom && distintas.join() === esperadas.join(),
    f + ' · LF ' + ca.lf + ' -> ' + cd.lf + ' · CR ' + cd.cr + ' · BOM ' + cd.bom + ' · bytes ' + ca.bytes + ' -> ' + cd.bytes +
    ' · lineas distintas: ' + distintas.join(',') + ' (esperadas: ' + esperadas.join(',') + ')');
}
const tocados = git('diff', '--name-only', base, '--', '.', ':!docs/master').toString().split('\n').filter(Boolean).sort();
dice(tocados.join() === Object.keys(ESPERADO).sort().join(),
  'fuera de docs/master cambian ' + tocados.length + ' ficheros y son los ' + Object.keys(ESPERADO).length + ' esperados');
const enSrc = git('diff', '--name-only', base, '--', 'src', 'prisma', 'public').toString().split('\n').filter(Boolean);
dice(enSrc.length === 0, 'src/, prisma/ y public/: ' + enSrc.length + ' ficheros cambiados');

// ── (2) el espejo ───────────────────────────────────────────────────────────────────────
console.log('(2) el espejo de la skill');
const s1 = disco(SKILL);
const s2 = disco(ESPEJO);
dice(Buffer.compare(s1, s2) === 0, 'byte a byte: ' + s1.length + ' y ' + s2.length + ' bytes');
const sembrado = Buffer.concat([s2, Buffer.from('\n')]);
dice(Buffer.compare(s1, sembrado) !== 0, 'control positivo: con UN byte de mas, la comparacion lo ve');

// ── (3) el test: solo el comentario ─────────────────────────────────────────────────────
console.log('(3) el test, solo el comentario');
const dondeTs = require.resolve('typescript', { paths: [raiz] });
const ts = require(dondeTs);
console.log('    typescript ' + ts.version + ' desde ' + dondeTs);
const tokens = (src) => {
  const sc = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, src);
  const out = [];
  for (let k = sc.scan(); k !== ts.SyntaxKind.EndOfFileToken; k = sc.scan()) out.push(k + ':' + sc.getTokenText());
  return out;
};
const ta = tokens(git('show', base + ':' + TEST).toString('utf8'));
const despuesTest = disco(TEST).toString('utf8');
const td = tokens(despuesTest);
dice(ta.length > 0 && ta.join('\u0000') === td.join('\u0000'), 'tokens de codigo: ' + ta.length + ' antes, ' + td.length + ' despues, identicos');
const mutado = despuesTest.replace("import test from 'node:test';", "import testZ from 'node:test';");
dice(mutado !== despuesTest && tokens(mutado).join('\u0000') !== ta.join('\u0000'), 'control positivo: con UN token de codigo cambiado, sale distinto');

// ── (4) la cita del asesor ──────────────────────────────────────────────────────────────
console.log('(4) la cita de PREGUNTAS_ASESOR.md contra modoVisible.ts');
const l22 = disco(MODO).toString('utf8').split('\n')[21];
const m = /(\[Corregido el 8-oct-2026, SCRUM-1500e,.*Railway\.\])/.exec(l22 || '');
if (!m) { console.log('CIEGO: modoVisible.ts:22 no trae el corchete'); process.exit(2); }
const asesor = disco(ASESOR).toString('utf8').split('\n');
dice(asesor[462].includes(m[1]), 'la linea 463 lleva el corchete de modoVisible.ts:22, literal (' + m[1].length + ' caracteres)');
dice(!asesor[462].includes(m[1].replace('SCRUM-1500e', 'SCRUM-1500z')), 'control de cero: un corchete con un ticket derivado (SCRUM-1500z) no aparece');
dice(asesor[460].includes('`' + MODO + ':21-24`'), 'la linea 461 conserva la coordenada ' + MODO + ':21-24');

// ── quien sigue diciendo la frase vieja ─────────────────────────────────────────────────
console.log('(5) quien sigue diciendo la frase vieja (git grep, fuera de docs/master y docs/historico)');
const grep = (patron) => {
  try {
    return git('grep', '-n', '-i', '-E', patron, '--', '.', ':!docs/master', ':!docs/historico').toString().split('\n').filter(Boolean);
  } catch (e) { if (e.status === 1) return []; throw e; }
};
const VIEJA = 'vfsubmission[^|]{0,60}no est.{1,2} en|sin .?vfsubmission.? en el|la entidad no existe|no hay cola de remisi|no se encola y no|vfsubmission.? es un modelo del|vfsubmission.? que nunca se construy';
const quedan = grep(VIEJA);
const total = grep('vfsubmission');
const cero = grep('vfsubmissionz');
console.log('    control positivo: ' + total.length + ' lineas nombran vfSubmission · control de cero (vfSubmissionZ): ' + cero.length);
if (total.length === 0 || cero.length !== 0) { console.log('CIEGO: los controles del recuento no salen'); process.exit(2); }
// una linea ya corregida CITA lo que decia: se separa por su marca, no se cuenta como pendiente
const corregida = (l) => /Corregido el 8-oct-2026|Nota del 8-oct-2026/.test(l);
const yaCorregidas = quedan.filter(corregida);
const sinCorregir = quedan.filter((l) => !corregida(l));
console.log('    lineas con la frase vieja: ' + quedan.length + ' = ' + yaCorregidas.length + ' que la citan dentro de su correccion + ' + sinCorregir.length + ' SIN CORREGIR');
for (const l of yaCorregidas) console.log('      corregida   ' + l.slice(0, 110));
for (const l of sinCorregir) console.log('      SIN TOCAR   ' + l.slice(0, 150));

console.log('resultado: ' + (mal ? mal + ' MAL' : 'todo cuadra'));
process.exit(mal ? 1 : 0);
