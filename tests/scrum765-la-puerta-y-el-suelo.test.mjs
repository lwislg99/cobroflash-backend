// tests/scrum765-la-puerta-y-el-suelo.test.mjs — SCRUM-765
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA PUERTA QUE NUNCA CASABA, Y EL SUELO QUE ESTE INSTRUMENTO LE EXIGÍA A TODOS MENOS A SÍ MISMO.
//
// `scripts/meta-guard-mutaciones.mjs` es el guard que sostiene el requisito de entrega de toda la
// casa: cada guard declara la mutación que lo tumba y él las ejecuta. Su bloque de arranque
// preguntaba «¿me han ejecutado a mí?» comparando `import.meta.url` con `'file://' + argv[1]`.
//
// 🔴 EN WINDOWS ESO NO CASA NUNCA. Medido el 6-sep-2026 en las cuatro formas de invocación:
//
//     argv[1]            C:\Users\Javier Pereira\cobroflash-b5\scripts\x.mjs
//     'file://'+argv[1]  file://C:\Users\Javier Pereira\…      ← dos barras, invertidas, sin %20
//     import.meta.url    file:///C:/Users/Javier%20Pereira/…   ← tres barras, normales, con %20
//
// Arrancaba SÓLO por su respaldo, `argv[1].endsWith('meta-guard-mutaciones.mjs')`, que compara
// por NOMBRE DE FICHERO. **Copiado a otro nombre: exit 0 en 0,28 s y CERO mutaciones ejecutadas**
// —frente a 76 s y 31 mutaciones por su nombre real—. Un verde perfecto sobre ningún trabajo.
//
// Y el agujero no lo cierra sólo arreglar la puerta, porque cualquier otro camino que llegue al
// final sin haber mutado nada sigue saliendo con 0. Lo cierra EL SUELO: cero mutaciones
// ejecutadas es CIEGO, no verde. Es la medicina que este instrumento le exige a todos los censos
// de la casa desde que existe.
//
// Aquí se vigilan las tres piezas: la puerta, los dos suelos, y que el árbol no se llene otra vez
// de puertas frágiles.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  censoDePuertasFragiles, ejecutadoDirectamente, puertasFragilesEn,
} from '../scripts/_puerta-de-entrada.mjs';
import {
  SUELO_DECLARACIONES, SUELO_GUARDS, censoDeDeclaraciones, sueloDeEjecucion, sueloDelCenso,
} from '../scripts/meta-guard-mutaciones.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ─────────────────────────────────────────────────────────────────────────────────────────────
// ① LA PUERTA · sobre pares REALES, no inventados
//
// Los cuatro pares de abajo son los que imprimió una sonda ejecutada de verdad en este árbol el
// 6-sep-2026, una por forma de invocación. Se guardan como DATO para que el guard no dependa de
// que la máquina donde corre reproduzca las cuatro formas.
// ─────────────────────────────────────────────────────────────────────────────────────────────
const FORMAS_MEDIDAS = Object.freeze([
  {
    como: 'ruta relativa (`node scripts/x.mjs`, que es lo que hace `npm run`)',
    argv1: 'C:\\Users\\Javier Pereira\\cobroflash-b5\\scripts\\_sonda-puerta-765.mjs',
    meta: 'file:///C:/Users/Javier%20Pereira/cobroflash-b5/scripts/_sonda-puerta-765.mjs',
  },
  {
    como: 'ruta absoluta con barras normales y un espacio en el nombre',
    argv1: 'c:\\Users\\Javier Pereira\\cobroflash-b5\\scripts\\_sonda-puerta-765.mjs',
    meta: 'file:///c:/Users/Javier%20Pereira/cobroflash-b5/scripts/_sonda-puerta-765.mjs',
  },
  {
    como: 'ruta absoluta en barras invertidas',
    argv1: 'c:\\Users\\Javier Pereira\\cobroflash-b5\\scripts\\_sonda-puerta-765.mjs',
    meta: 'file:///c:/Users/Javier%20Pereira/cobroflash-b5/scripts/_sonda-puerta-765.mjs',
  },
  {
    como: 'invocado desde otro cwd',
    argv1: 'C:\\Users\\Javier Pereira\\cobroflash-b5\\scripts\\_sonda-puerta-765.mjs',
    meta: 'file:///C:/Users/Javier%20Pereira/cobroflash-b5/scripts/_sonda-puerta-765.mjs',
  },
]);

test('SCRUM-765 · la puerta CASA en las cuatro formas medidas — y la de antes en ninguna', () => {
  assert.ok(FORMAS_MEDIDAS.length >= 4, '🔴 SUELO: sin formas que probar, esto no prueba nada.');

  for (const f of FORMAS_MEDIDAS) {
    assert.equal(ejecutadoDirectamente(f.meta, f.argv1), true,
      `🔴 la puerta NO abre con ${f.como}. El script no arrancaría, y un script que no arranca `
      + 'sale con 0 sin haber hecho nada.');

    // CONTROL NEGATIVO, en el mismo test para que no se puedan separar: la forma de antes tiene
    // que seguir sin casar. Si algún día casara, este dato dejaría de justificar el cambio.
    assert.notEqual(f.meta, `file://${f.argv1}`,
      `🔴 la forma vieja SÍ casa con ${f.como}: entonces el defecto de SCRUM-765 no era éste.`);
  }
});

test('SCRUM-765 · CONTRASTE: importada como módulo, la puerta NO abre', () => {
  // Para lo que existe la puerta: que importar el script no ejecute su trabajo. Aquí se mide con
  // el caso real —este mismo fichero de test es el argv[1] del proceso que estás leyendo—.
  const yo = pathToFileURL(path.join(RAIZ, 'scripts/meta-guard-mutaciones.mjs')).href;
  assert.equal(ejecutadoDirectamente(yo, process.argv[1]), false,
    '🔴 el meta-guard se creería el punto de entrada mientras lo importa un test: ejecutaría '
    + 'sus mutaciones dentro de la suite.');

  // Y sin fichero de entrada (`node -e`, REPL) tampoco: no hay nada con lo que casar.
  assert.equal(ejecutadoDirectamente(yo, undefined), false);
  assert.equal(ejecutadoDirectamente(yo, ''), false);

  // CONTROL POSITIVO del propio comparador: consigo mismo SÍ abre. Sin esto, una función que
  // devolviera `false` siempre pasaría los dos asertos de arriba.
  assert.equal(ejecutadoDirectamente(yo, path.join(RAIZ, 'scripts/meta-guard-mutaciones.mjs')), true,
    '🔴 la puerta no abre ni consigo misma: el comparador está roto, no protegiendo.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// ② EL CENSO DE PUERTAS FRÁGILES · por AST
//
// 🔴 POR AST Y NO POR TEXTO: la cabecera de `_puerta-de-entrada.mjs` escribe la forma prohibida
// varias veces para poder explicarla, así que un censo por `grep` se cazaría a sí mismo en la
// prosa — el defecto de SCRUM-614/617, y el motivo de la regla de SCRUM-203.
// ─────────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-765 · el censo de puertas frágiles VE lo que dice ver', () => {
  // CONTROL POSITIVO ①: la forma de plantilla.
  const conPlantilla = puertasFragilesEn(
    'if (import.meta.url === `file://${process.argv[1]}`) { corre(); }', 'sintetico.mjs');
  assert.equal(conPlantilla.length, 1, '🔴 el censo no ve la forma de plantilla.');

  // CONTROL POSITIVO ②: la forma de suma, y la variante que sólo cambia el sentido de las barras
  // (la de `scripts/backfill-job-assignees.mjs`), que TAMPOCO casa en Windows.
  const conSuma = puertasFragilesEn(
    "if (import.meta.url === 'file://' + process.argv[1]) { corre(); }", 'sintetico.mjs');
  assert.equal(conSuma.length, 1, '🔴 el censo no ve la forma de suma.');
  const conReplace = puertasFragilesEn(
    'if (import.meta.url === `file://${process.argv[1].replace(/x/g, "/")}`) { corre(); }',
    'sintetico.mjs');
  assert.equal(conReplace.length, 1, '🔴 el censo no ve la variante con `.replace()` dentro.');

  // CONTROL NEGATIVO: la forma buena NO se denuncia. Sin esto, un censo que marcara todo pasaría
  // los tres controles de arriba y dejaría el trinquete de abajo inservible.
  const buena = puertasFragilesEn(
    'if (import.meta.url === pathToFileURL(process.argv[1]).href) { corre(); }', 'sintetico.mjs');
  assert.equal(buena.length, 0, '🔴 el censo marca como frágil la forma que SÍ casa.');

  // Y no se caza en un comentario, que es como se envenenan estos censos.
  const comentada = puertasFragilesEn(
    '// prohibido: import.meta.url === `file://${process.argv[1]}`\nconst x = 1;', 'sintetico.mjs');
  assert.equal(comentada.length, 0, '🔴 el censo se caza a sí mismo en la prosa que lo explica.');
});

/**
 * TECHO DEL ÁRBOL — este número SÓLO BAJA.
 *
 * Medido el 6-sep-2026 sobre `scripts/` y `tests/`: DOS puertas frágiles, las dos fuera de este
 * ticket y las dos REPORTADAS sin tocar, porque cambiar cuándo arranca un script no es cosmética:
 *
 *   · `scripts/_prisma-sync.mjs` — misma forma y mismo respaldo `endsWith()` que tenía el
 *     meta-guard: arranca sólo por el respaldo.
 *   · `scripts/backfill-job-assignees.mjs` — la variante que invierte las barras, y SIN respaldo:
 *     su bloque de arranque no se ejecuta nunca en Windows. Y ese bloque ESCRIBE EN UNA BASE DE
 *     DATOS. Arreglarle la puerta es encender un backfill que hoy está apagado, y eso lo decide
 *     el fundador con el diff delante — no una sesión que pasaba por aquí (reglas 9 y 37).
 *
 * Lo que este techo impide es que aparezcan MÁS. Bajarlo al arreglar una de las dos es el camino
 * previsto; subirlo es meter el defecto otra vez.
 */
const TECHO_PUERTAS_FRAGILES = 2;

test('SCRUM-765 · el árbol NO gana puertas frágiles, y el meta-guard ya no es una de ellas', () => {
  const { puertas, ficherosVistos } = censoDePuertasFragiles(RAIZ);

  // SUELO: un censo que no encuentra ficheros diría «0 puertas frágiles» con la misma cara.
  assert.ok(ficherosVistos > 50,
    `🔴 el censo sólo ha mirado ${ficherosVistos} ficheros: su cero no significaría nada.`);

  assert.ok(puertas.length <= TECHO_PUERTAS_FRAGILES,
    `🔴 hay ${puertas.length} puertas frágiles y el techo es ${TECHO_PUERTAS_FRAGILES}:\n  · `
    + puertas.map((p) => `${p.fichero}:${p.linea} (${p.forma})`).join('\n  · ')
    + '\n\nEsa comparación NUNCA casa en Windows: el script no arranca, o arranca por un respaldo '
    + 'que compara por nombre de fichero. Usa `ejecutadoDirectamente()` de '
    + '`scripts/_puerta-de-entrada.mjs`.');

  // Y el instrumento de este ticket, por su nombre: que el techo no se lo trague por el hueco.
  assert.equal(puertas.filter((p) => p.fichero.includes('meta-guard-mutaciones')).length, 0,
    '🔴 el meta-guard ha vuelto a la puerta que nunca casa.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// ③ LOS DOS SUELOS · exigiéndoles el rojo, no leyéndolos
// ─────────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-765 · SUELO DEL CENSO: si el censo encoge, es CIEGO', () => {
  // Verde con lo que hay hoy.
  assert.equal(sueloDelCenso({ guards: SUELO_GUARDS, declaraciones: SUELO_DECLARACIONES }), null);

  // 🔴 EL ROJO, PROVOCADO. Un `MUTACIONES_QUE_ME_TUMBAN` borrado entero baja el censo en uno.
  const unGuardMenos = sueloDelCenso({
    guards: SUELO_GUARDS - 1, declaraciones: SUELO_DECLARACIONES,
  });
  assert.ok(unGuardMenos && unGuardMenos.includes('ENCOGIDO'),
    '🔴 borrar la declaración de un guard entero no dispara el suelo: el censo baja de N a N-1 '
    + 'y el job sigue verde, que es el hueco hermano de SCRUM-745.');

  // Y una declaración menos dentro de un guard que conserva otras: mismo agujero, más pequeño.
  assert.ok(sueloDelCenso({ guards: SUELO_GUARDS, declaraciones: SUELO_DECLARACIONES - 1 }),
    '🔴 perder UNA declaración no dispara el suelo.');

  // El trinquete tiene que ser honesto: si el suelo estuviera por encima de lo que hay, el job
  // estaría rojo y alguien lo bajaría para callarlo. Si está muy por debajo, no sujeta nada.
  const censo = censoDeDeclaraciones();
  const guards = censo.filter((c) => c.mutaciones.length).length;
  const declaraciones = censo.reduce((n, c) => n + c.mutaciones.length, 0);
  assert.ok(guards >= SUELO_GUARDS && declaraciones >= SUELO_DECLARACIONES,
    `🔴 el árbol tiene ${guards} guards y ${declaraciones} declaraciones, por DEBAJO del suelo `
    + `declarado (${SUELO_GUARDS} / ${SUELO_DECLARACIONES}).`);
});

test('SCRUM-765 · SUELO DE EJECUCIÓN: cero mutaciones ejecutadas es CIEGO, no verde', () => {
  // 🔴 EL CASO QUE PASÓ: el script llega al final sin haber mutado nada y sale con 0.
  const nada = sueloDeEjecucion({ vivas: 0, mudas: 0 });
  assert.ok(nada && nada.includes('NI UNA MUTACIÓN'),
    '🔴 cero mutaciones ejecutadas sale VERDE: es exactamente el exit 0 de 0,28 s del ticket.');

  // Y las CIEGAS no cuentan como trabajo: se descartaron antes de tocar el árbol.
  assert.ok(sueloDeEjecucion({ vivas: 0, mudas: 0, ciegas: 99 }),
    '🔴 99 ciegas se están contando como «he medido». «No supe medir» no es medir.');

  // CONTROL POSITIVO: con trabajo hecho, el suelo calla. Una viva basta, y una muda también —
  // una muda es un hallazgo, no una ceguera.
  assert.equal(sueloDeEjecucion({ vivas: 1, mudas: 0 }), null);
  assert.equal(sueloDeEjecucion({ vivas: 0, mudas: 1 }), null);
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// ④ DE PUNTA A PUNTA · que la puerta abra en un proceso DE VERDAD
//
// Los tests de arriba miden la función. Éste mide el arranque real: si la puerta se rompiera otra
// vez, el script saldría con 0 sin decir nada y ninguna comprobación de función lo vería.
// `--solo-censo` existe para poder hacerlo en segundos en vez de en minutos.
// ─────────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-765 · el script ARRANCA de verdad al invocarlo por su ruta', () => {
  const salida = execFileSync(process.execPath,
    [path.join(RAIZ, 'scripts/meta-guard-mutaciones.mjs'), '--solo-censo'],
    { cwd: RAIZ, encoding: 'utf8', timeout: 120000 });

  assert.match(salida, /censo · \d+ guards · \d+ declaraciones/,
    '🔴 el script ha salido sin decir nada: la puerta no ha abierto. Es el defecto de SCRUM-765 '
    + 'otra vez — un exit 0 sobre cero trabajo.');
  assert.match(salida, /NO se ha ejecutado ninguna mutación/,
    '🔴 el modo censo ya no avisa de que no ha mutado nada: un verde suyo se leería como el '
    + 'del trabajo completo.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA MUTACIÓN QUE ME TUMBA (SCRUM-745)
// ═════════════════════════════════════════════════════════════════════════════════════════════
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Devolver la puerta a la forma que nunca casa. Es el defecto entero de este ticket.
    fichero: 'scripts/_puerta-de-entrada.mjs',
    de: '    return metaUrl === pathToFileURL(argv1).href;',
    a: '    return metaUrl === `file://${argv1}`;',
    cae: 'la puerta CASA en las cuatro formas medidas',
  },
  {
    // Aflojar el suelo del censo hasta que deje de sujetar: un guard menos pasaría en silencio.
    fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '  if (guards >= SUELO_GUARDS && declaraciones >= SUELO_DECLARACIONES) return null;',
    a: '  if (guards >= 0 && declaraciones >= 0) return null;',
    cae: 'SUELO DEL CENSO: si el censo encoge, es CIEGO',
  },
  {
    // Contar las ciegas como trabajo hecho: «no supe medir» pasaría por «he medido».
    fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '  if (vivas + mudas > 0) return null;',
    a: '  if (vivas + mudas >= 0) return null;',
    cae: 'SUELO DE EJECUCIÓN: cero mutaciones ejecutadas es CIEGO, no verde',
  },
];
