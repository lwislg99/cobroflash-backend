// docs/master/evidencias/SCRUM-1396/sonda-n-menos-uno.mjs — SCRUM-1396
//
// Le pregunta a `clasificaFuente` (el de verdad, importado de `scripts/_censo-mkdtemp.mjs`) con
// fuentes fabricadas cuya respuesta se sabe de antemano. No escribe nada, no crea temporales y no
// ejecuta las fuentes: sólo se las pasa al censo como texto.
//
// Dos bloques:
//   A · las tres fuentes de la tabla del ticket (b() sola · b() con a() homónima · el control).
//       No estaban guardadas en el repositorio: se reconstruyen de la tabla del ticket.
//   B · el rojo raro: N fugas con el mismo nombre, se arregla UNA, ¿qué dice el censo de las N-1?
//
// Uso:  node docs/master/evidencias/SCRUM-1396/sonda-n-menos-uno.mjs
// Sale 0 siempre que haya podido preguntar: es una sonda, no un guard. Lo que decide va impreso.
import { clasificaFuente } from '../../../../scripts/_censo-mkdtemp.mjs';

const NL = '\n';
const crea = "  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'caso-'));";
const fuga = (nombre) => [`function ${nombre}() {`, crea, '  usar(dir);', '}'];
const limpia = (nombre, variable = 'dir') => [
  `function ${nombre}() {`,
  crea.replace('const dir', 'const ' + variable),
  `  try { usar(${variable}); } finally { fs.rmSync(${variable}, { recursive: true, force: true }); }`,
  '}',
];

const preguntar = (titulo, lineas) => {
  const r = clasificaFuente('fabricado.mjs', lineas.join(NL));
  console.log('  ' + titulo);
  for (const l of r) console.log(`      línea ${String(l.linea).padStart(2)} · ${l.destino} → ${l.categoria}` + (l.borradoEn.length ? ` (borrado que se le atribuye: línea ${l.borradoEn.join(', ')})` : ''));
  return r;
};

console.log('A · LAS TRES FUENTES DEL TICKET');
const a1 = preguntar('① b() crea `dir` y no lo borra', fuga('b'));
const a2 = preguntar('② lo mismo, y OTRA función a() borra SU `dir` en un finally', [...limpia('a'), ...fuga('b')]);
const a3 = preguntar('③ control: la de a() se llama distinto', [...limpia('a', 'otro'), ...fuga('b')]);

console.log('');
console.log('B · EL ROJO RARO: cuatro fugas que se llaman `dir`, y se arregla sólo la primera');
const N = 4;
const nombres = ['uno', 'dos', 'tres', 'cuatro'];
const antes = preguntar(`antes · ${N} funciones que fugan`, nombres.flatMap((n) => fuga(n)));
const despues = preguntar(`después · arreglada SÓLO ${nombres[0]}()`, [...limpia(nombres[0]), ...nombres.slice(1).flatMap((n) => fuga(n))]);

const cuenta = (r, c) => r.filter((l) => l.categoria === c).length;
const deB = (r) => r.find((l) => l.linea === Math.max(...r.map((x) => x.linea)));
console.log('');
console.log('RESUMEN');
console.log(`  población: ${a1.length + a2.length + a3.length + antes.length + despues.length} llamadas clasificadas en 5 fuentes`);
console.log(`  A① b() sola ............................ ${deB(a1).categoria}`);
console.log(`  A② b() con a() homónima ................ ${deB(a2).categoria}`);
console.log(`  A③ b() con a() de otro nombre (control)  ${deB(a3).categoria}`);
console.log(`  B antes ................................ ${cuenta(antes, 'SIN_LIMPIEZA')} de ${N} acusadas`);
console.log(`  B después de arreglar 1 ................ ${N - cuenta(despues, 'GARANTIZADA')} de ${N - 1} fugas vivas acusadas · ${cuenta(despues, 'GARANTIZADA')} de ${N} salen GARANTIZADA`);
console.log(`  fugas vivas que el censo da por buenas . ${cuenta(despues, 'GARANTIZADA') - 1} de ${N - 1}`);
