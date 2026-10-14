// docs/master/evidencias/SCRUM-1520/d-la-ruta-que-calla.mjs — SCRUM-1520d · ¿por dónde PUEDE un verde esconder un caído, en el árbol de hoy?
//
//     node docs/master/evidencias/SCRUM-1520/d-la-ruta-que-calla.mjs                 # censo del árbol + controles
//     node docs/master/evidencias/SCRUM-1520/d-la-ruta-que-calla.mjs --sin-siembra   # la prueba del banco: tiene que salir 2
//
// QUÉ MIDE. Las tres formas, ya medidas en local (SCRUM-1520 ②, variantes I y K; y la de `todo`,
// en d-salida-node.txt), en que un caso que CAE no pone la tanda en rojo, porque `node --test` no
// lo cuenta como caído por ninguno de sus dos caminos (informe y código de salida del hijo):
//   ① el proceso de un fichero de test se va con `process.exit(0)` (o sin argumento) a mitad: lo de
//      detrás no corre;
//   ② `process.exitCode = 0` en el proceso del fichero, que tapa el 1 que pone el corredor;
//   ③ un caso marcado `todo` (opción `{ todo }`, `test.todo(…)` o `t.todo()` en marcha): si cae, el
//      corredor lo informa como TODO y NO lo cuenta como caído.
// Lo busca en el AST (TypeScript del propio `node_modules`), no en el texto: una cadena o una
// plantilla que lleve `process.exit(0)` dentro (un guion que el test escribe y lanza aparte) NO es
// una llamada en el proceso del test, y el texto no lo distingue (SCRUM-203).
//
// POBLACIÓN. Todo `.mjs`/`.js`/`.cjs` de `tests/`, separado en los que ejecuta la tanda
// (`tests/*.test.mjs`, el patrón del script `test` de package.json) y los demás (ayudantes,
// arneses). De un ayudante con hallazgo se dicen los tests que lo importan.
//
// QUÉ NO MIDE. Si la llamada se ALCANZA (un `exit` dentro de una rama que nunca corre cuenta igual).
// Procesos hijos que el test lanza: esos tienen su propio código y su propia lectura. Alias raros
// (`const { exit } = process`, `process['exit']`) los busca, pero no sigue variables.
//
// Sale 0 si pudo medir (diga lo que diga la medida) y 2 si algún control no sale como tiene que
// salir: entonces la tabla NO VALE y lo dice.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CERO, SIEMBRA, censar, censoDelArbol, deLaTanda, puedeCallar } from '../../../../tests/_la-ruta-que-calla.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const SIN_SIEMBRA = process.argv.includes('--sin-siembra');

// ── ① Los controles del instrumento, ANTES de mirar el árbol ─────────────────────────────────
const fallos = [];
const siembra = SIN_SIEMBRA ? [] : SIEMBRA;
for (const [forma, src] of siembra) {
  const h = censar('siembra.mjs', src);
  if (h.length !== 1 || h[0].forma !== forma) fallos.push(`positivo «${forma}»: dio ${JSON.stringify(h.map((x) => x.forma))}`);
}
for (const src of CERO) {
  const h = censar('cero.mjs', src);
  if (h.length) fallos.push(`cero: vio ${JSON.stringify(h.map((x) => x.forma))} en ${JSON.stringify(src.slice(0, 50))}`);
}
if (siembra.length === 0) fallos.push('sin siembra: ningún positivo que comprobar (el banco no puede decir que ve lo que busca)');

// ── ② El árbol ───────────────────────────────────────────────────────────────────────────────
const { todos, fuera, distEnElArbol, fuentes, hallazgos, importadores } = censoDelArbol(RAIZ);

// Control positivo SOBRE EL ÁRBOL: un fichero que se sabe que lleva la forma tiene que salir. El
// banco de nombres de SCRUM-1339 escribe `{ todo: true }` DENTRO de una cadena: NO tiene que salir.
const CONOCIDO_EN_CADENA = 'tests/scrum1339d-senal-de-nombres.test.mjs';
if (fuentes.has(CONOCIDO_EN_CADENA) && !/todo: true/.test(fuentes.get(CONOCIDO_EN_CADENA))) fallos.push(`el control de cadena ya no lleva su texto: ${CONOCIDO_EN_CADENA}`);
if (hallazgos.some((h) => h.fichero === CONOCIDO_EN_CADENA && h.forma.startsWith('{ todo'))) fallos.push(`contó como caso el texto de una cadena en ${CONOCIDO_EN_CADENA}`);
// Y los dos del propio árbol que sí se saben (medidos en la primera pasada, 14-oct): un `exit(0)`
// real en el bloque de programa de un ayudante tiene que salir; los `b.todo()` de 1367b, no.
const CONOCIDO_EXIT = 'tests/_meta-de-laboratorio.mjs';
if (fuentes.has(CONOCIDO_EXIT) && !hallazgos.some((h) => h.fichero === CONOCIDO_EXIT && h.forma === 'exit(0)')) fallos.push(`no ve el exit(0) conocido de ${CONOCIDO_EXIT}`);
const CONOCIDO_METODO = 'tests/scrum1367b-sembrar-albaranes.test.mjs';
if (fuentes.has(CONOCIDO_METODO) && !/b\.todo\(\)/.test(fuentes.get(CONOCIDO_METODO))) fallos.push(`el control de método ya no lleva b.todo(): ${CONOCIDO_METODO}`);
if (hallazgos.some((h) => h.fichero === CONOCIDO_METODO)) fallos.push(`volvió a contar b.todo() como caso pendiente en ${CONOCIDO_METODO}`);
const deTexto = { exit: 0, todo: 0 };
for (const src of fuentes.values()) { if (/process\.exit\(/.test(src)) deTexto.exit++; if (/\btodo\b/.test(src)) deTexto.todo++; }

// ── ③ La salida ──────────────────────────────────────────────────────────────────────────────
const nTanda = todos.filter(deLaTanda).length;
console.log('SCRUM-1520d · ¿por dónde puede callar un caso que cae? — censo por AST de tests/');
console.log(`población: ${todos.length} ficheros .mjs/.js/.cjs en tests/ · ${nTanda} los ejecuta la tanda (tests/*.test.mjs) · ${todos.length - nTanda} ayudantes y arneses`);
console.log(`           + ${fuera.length} ficheros FUERA de tests/ a los que se llega por imports relativos (${distEnElArbol} de dist/; si dist/ no está compilado, esos no se ven y se dice aquí)`);
console.log(`referencia de TEXTO (no es censo): ${deTexto.exit} ficheros contienen «process.exit(» · ${deTexto.todo} contienen la palabra «todo»`);
console.log(`controles del instrumento: ${siembra.length} positivos sembrados · ${CERO.length} ceros (cadena, plantilla, comentario, exit(1)) · ${fallos.length ? 'FALLAN' : 'todos como tienen que salir'}`);
console.log('');
const grupos = [
  ['en un fichero de la tanda', hallazgos.filter((h) => deLaTanda(h.fichero))],
  ['en un ayudante o arnés de tests/', hallazgos.filter((h) => !deLaTanda(h.fichero) && h.fichero.startsWith('tests/'))],
  ['fuera de tests/, importado por la tanda', hallazgos.filter((h) => !h.fichero.startsWith('tests/'))],
];
for (const [rotulo, lista] of grupos) {
  const ficheros = new Set(lista.map((h) => h.fichero));
  console.log(`── ${rotulo}: ${lista.length} hallazgo(s) en ${ficheros.size} fichero(s)`);
  for (const h of lista) {
    const imp = deLaTanda(h.fichero) ? '' : ` · lo importan ${(importadores.get(h.fichero) ?? []).length} test(s) de la tanda${(importadores.get(h.fichero) ?? []).length ? ': ' + importadores.get(h.fichero).slice(0, 4).map((x) => x.replace(/^tests\//, '')).join(', ') + ((importadores.get(h.fichero) ?? []).length > 4 ? ', …' : '') : ''}`;
    console.log(`   ${h.fichero}:${h.linea} · ${h.forma} · ${h.donde}${imp}`);
    console.log(`        ${h.texto}`);
  }
}
console.log('');
const porForma = {};
for (const h of hallazgos) porForma[h.forma] = (porForma[h.forma] ?? 0) + 1;
console.log(`por forma: ${Object.entries(porForma).map(([k, v]) => `${k} ${v}`).join(' · ') || 'ninguna'}`);
const callan = hallazgos.filter((h) => puedeCallar(h, importadores));
console.log(`PUEDEN CALLAR un caído en el proceso de un test de la tanda (lo que mira el guard scrum1520d): ${callan.length}`);
for (const h of callan) console.log(`   ${h.fichero}:${h.linea} · ${h.forma} · ${h.donde}`);
if (fallos.length) {
  console.log('');
  console.log('CIEGO: el banco no ha pasado sus propios controles y esta tabla NO VALE:');
  for (const f of fallos) console.log(`   · ${f}`);
  process.exitCode = 2;
}
