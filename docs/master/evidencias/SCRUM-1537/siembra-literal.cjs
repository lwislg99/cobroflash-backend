// docs/master/evidencias/SCRUM-1537/siembra-literal.cjs — SCRUM-1537
//
// ¿QUÉ ESCRITURAS VE `cotejo.cjs` (SCRUM-1500, el que corre en la tanda) Y CUÁLES NO?
//
//     node docs/master/evidencias/SCRUM-1537/siembra-literal.cjs
//
// jv-j3i midió su límite sobre el árbol: da `firmado` por «en el cierre y sin ningún literal que lo
// escriba» porque la escritura entra por una función. Ése es un caso PRESTADO del árbol. Aquí se
// SIEMBRA: se fabrica una raíz desechable (un esquema, un máster y un fichero de `src/`) y se le pasa
// al instrumento de verdad por su parámetro `raiz`. El árbol del repositorio no se toca.
//
// POBLACIÓN: las formas de escribir de la tabla FORMAS. Cada una escribe en SU campo de un modelo
// fabricado un valor `fuera_<forma>` que el máster fabricado NO declara. Ningún campo lleva cierre:
// es el caso en que D sale sólo de las escrituras, y por tanto el único en que no verlas cambia el
// VEREDICTO. Si el instrumento ve la escritura, el campo sale CODIGO_FUERA_DEL_MASTER nombrando el
// valor; si no la ve, sale COINCIDE_CON_EL_MASTER con un valor fuera del máster escrito en `src/`.
//
// De cada forma se miran tres cosas: que el veneno ENTRÓ (el valor está en el fichero fabricado),
// si el instrumento lo VE (está en D), y si al menos AVISA de que ahí hay algo que no supo leer
// (una línea «(no literal)» para ese campo).
//
// SALIDA: 0 = se pudo leer el resultado de todas las formas · 2 = alguna siembra no entró, o el
// instrumento salió ciego: no hay medición.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const RAIZ = path.resolve(__dirname, '..', '..', '..', '..');
const RUTA = path.join(RAIZ, 'docs', 'master', 'evidencias', 'scrum1500', 'cotejo.cjs');
const { cotejar, juzgar } = require(RUTA);

// nombre · cómo se escribe el campo dentro de `src/escribe.ts` (lo de antes de la llamada, y la llamada)
const FORMAS = [
  ['literal', '', "await prisma.cosa.update({ where: { id }, data: { literal: 'fuera_literal' } });"],
  ['ternario', '', "await prisma.cosa.update({ where: { id }, data: { ternario: id > 1 ? 'uno' : 'fuera_ternario' } });"],
  ['constante', "const valorConstante = 'fuera_constante';", 'await prisma.cosa.update({ where: { id }, data: { constante: valorConstante } });'],
  ['funcion', "function calcula(): string { return 'fuera_funcion'; }", 'await prisma.cosa.update({ where: { id }, data: { funcion: calcula() } });'],
  ['importada', "import { VALOR_IMPORTADO } from './otro';", 'await prisma.cosa.update({ where: { id }, data: { importada: VALOR_IMPORTADO } });'],
  ['objeto', "const datosObjeto = { objeto: 'fuera_objeto' };", 'await prisma.cosa.update({ where: { id }, data: datosObjeto });'],
  ['derrame', "const datosDerrame = { derrame: 'fuera_derrame' };", 'await prisma.cosa.update({ where: { id }, data: { ...datosDerrame } });'],
  ['sql', '', "await prisma.$executeRawUnsafe(`UPDATE \"Cosa\" SET \"sql\" = 'fuera_sql' WHERE id = ${id}`);"],
];

/** La medición, sin imprimir: la usa `tests/scrum1537-los-dos-cotejos.test.mjs`. */
function medir() {
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1537-raiz-'));
const escribe = (rel, texto) => { const p = path.join(dir, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, texto); };

const esquema = ['model Cosa {', '  id Int @id', ...FORMAS.map(([n]) => `  ${n} String // uno|dos`), '}', ''].join('\n');
const master = FORMAS.map(([n]) => `**Cosa.${n}:** \`uno | dos\`.`).join('\n');
const fuente = [
  ...FORMAS.map(([, antes]) => antes).filter((x) => x.startsWith('import')),
  'declare const prisma: any;',
  ...FORMAS.map(([, antes]) => antes).filter((x) => x && !x.startsWith('import')),
  'export async function escribeTodo(id: number) {',
  // Cada campo se escribe además con los dos valores que el máster SÍ declara: así D nunca sale
  // vacío y «no vi la siembra» no se confunde con «no vi nada».
  ...FORMAS.map(([n]) => `  await prisma.cosa.create({ data: { ${n}: 'uno' } }); await prisma.cosa.create({ data: { ${n}: 'dos' } });`),
  ...FORMAS.map(([, , llamada]) => `  ${llamada}`),
  '}',
  '',
].join('\n');
escribe('prisma/schema.prisma', esquema);
escribe('docs/YAQU_MASTER.md', master);
escribe('src/escribe.ts', fuente);
const otro = "export const VALOR_IMPORTADO = 'fuera_importada';\n";
escribe('src/otro.ts', otro);
const TODO_LO_ESCRITO = fuente + otro;

const campos = FORMAS.map(([n]) => ({
  campo: `Cosa.${n}`, comentario: 'cola', cierre: null, escribe: ['cosa', n],
  master: { ancla: new RegExp(`^\\*\\*Cosa\\.${n}:\\*\\*`), lista: /`([^`]+)`/ },
}));

const out = [];
const di = (s) => out.push(s);
let sinMedir = 0;
let r = null;
try {
  r = cotejar({ raiz: dir, campos, controles: [] });
} finally {
  // La raíz fabricada no enlaza nada de fuera: son cuatro ficheros escritos aquí. Se borra y se comprueba.
  fs.rmSync(dir, { recursive: true, force: true });
}

di(`INSTRUMENTO: docs/master/evidencias/scrum1500/cotejo.cjs · sha256 ${crypto.createHash('sha256').update(fs.readFileSync(RUTA)).digest('hex')}`);
di(`RAIZ FABRICADA: 4 ficheros (esquema, máster, src/escribe.ts, src/otro.ts) · borrada al acabar: ${fs.existsSync(dir) ? 'NO' : 'sí'}`);
if (!r || r.ciego) {
  di(`CIEGO: ${r ? r.ciego : 'el instrumento no devolvió nada'}`);
  di('EXIT=2');
  return { texto: out.join('\n'), salida: 2, formas: [] };
}
const formas = [];
di(`POBLACION: ${FORMAS.length} formas de escribir, un campo sin cierre por forma · el instrumento leyó ${r.poblacion.ficheros} ficheros .ts de la raíz fabricada (${r.poblacion.sinParsear} sin parsear)`);
di('');
const j = juzgar(r, []);
const cuenta = { laVe: 0, avisa: 0, calla: 0 };
for (const [n] of FORMAS) {
  const valor = `fuera_${n}`;
  const entro = TODO_LO_ESCRITO.includes(`'${valor}'`);
  const f = r.filas.find((x) => x.id === `Cosa.${n}`);
  if (!entro || !f) { di(`${n.padEnd(10)} SIN MEDIR (el veneno ${entro ? 'entró' : 'NO entró'}; fila ${f ? 'devuelta' : 'NO devuelta'})`); sinMedir += 1; continue; }
  const laVe = f.D.includes(valor);
  const avisa = f.noLiterales.length > 0;
  const nombrado = j.hallazgos.filter((h) => h.campo === f.campo).map((h) => h.clase);
  if (laVe) cuenta.laVe += 1; else if (avisa) cuenta.avisa += 1; else cuenta.calla += 1;
  formas.push({ forma: n, zona: laVe ? 've' : (avisa ? 'avisa' : 'calla'), veredicto: f.veredicto, nombrado, noLiterales: f.noLiterales });
  di(`${n.padEnd(10)} D = ${f.D.join(' | ').padEnd(28)} ${laVe ? 'LA VE    ' : 'NO LA VE '} · ${avisa ? `avisa: (no literal) ${f.noLiterales.map((x) => x.replace(/^\S+ /, '')).join(' ; ')}` : 'no avisa de nada'} · veredicto ${f.veredicto} · el juicio ${nombrado.length ? `lo nombra (${nombrado.join(', ')})` : 'NO lo nombra'}`);
}
di('');
di(`RESUMEN sobre ${FORMAS.length} formas, todas con un valor fuera del máster escrito en src/:`);
di(`  ${cuenta.laVe}  las ve (el campo sale CODIGO_FUERA_DEL_MASTER)`);
di(`  ${cuenta.avisa}  no las ve, y deja una línea «(no literal)»: el juicio las nombra en ${formas.filter((x) => x.zona === 'avisa' && x.nombrado.length > 0).length}`);
di(`  ${cuenta.calla}  no las ve y no deja rastro`);
di(`  ${sinMedir}  sin medir`);
const salida = sinMedir > 0 || fs.existsSync(dir) ? 2 : 0;
di(`EXIT=${salida}`);
return { texto: out.join('\n'), salida, formas };
}

module.exports = { medir, FORMAS };

if (require.main === module) {
  const { texto, salida } = medir();
  console.log(texto);
  process.exit(salida);
}
