// tests/scrum733-el-censo-no-se-encoge-en-silencio.test.mjs — SCRUM-733
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// «NO HAY ENTRADA» Y «NO SUPE LEERLA» NO PUEDEN DAR EL MISMO RESULTADO.
//
// 🔴 EL DEFECTO DEL TICKET NO ERA EL QUE PONÍA EN EL ENCARGO, Y SE MIDIÓ ANTES DE TOCAR NADA.
// El encargo decía: «el generador pierde una entrada EN SILENCIO si su última línea lleva
// comentario SQL». Se probó con un `prisma generate` DE VERDAD sobre una copia del schema
// —el del fundador no se toca—, añadiendo un campo como ÚLTIMO del modelo `Customer`:
//
//   · sin comentario (CONTROL) ....... 423 columnas, la sonda ESTÁ
//   · con `// nota` al final .......... 423 columnas, la sonda ESTÁ
//   · con `/// nota` al final ......... 423 columnas, la sonda ESTÁ
//   · con `-- nota` al final .......... `prisma generate` NO GENERA: `--` no es sintaxis Prisma
//
// No desaparece nadie. Y el CONTROL es lo que hace válida esa lista: la primera versión del
// medidor daba «no está» en los cuatro casos —incluido el control— porque leía el DMMF con un
// `import` con cache-buster, y `require('@prisma/client')` es CJS y se cachea por proceso.
// Sin el control, ese «no está» se habría publicado como confirmación del defecto.
//
// LO QUE SÍ FALTABA, medido: el generador **no tenía suelo propio**. `generarSql([])` escribía
// tan tranquilo 48 líneas con `-- Columnas esperadas: 0` y un `VALUES` vacío, y el script salía
// con 0 diciendo «escrito … (0 columnas)».
//
// 🔴 Y EL MODO DE FALLO ES EL PEOR: con CERO entradas el SQL ni siquiera es válido y Postgres
// protesta —ruidoso, se arregla—. Con POCAS es SQL válido que devuelve **0 filas**, o sea
// «en sync», sobre una base a la que le falten justo las columnas que dejó de preguntar. La
// mentira exacta que este fichero existe para impedir, firmada por su propia cabecera.
//
// Este fichero fija las dos mitades: que el suelo PARE lo que tiene que parar, y que NO estorbe
// a lo normal — un guard que salta en cada regeneración legítima se desactiva en una tarde.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  generarSql, paresEsperados, RUTA_SQL,
  leerCensoDelFichero, columnasDeclaradas, motivoParaNoEncoger,
} from '../scripts/generar-sql-deriva.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MINIMO = 300;   // mismo criterio y misma holgura que `tests/scrum461-censo-no-encoge.test.mjs`

const TRES = [['Customer', 'id'], ['Customer', 'name'], ['Job', 'id']];

// ═══ ① SUELO Y CONTROL POSITIVO, PRIMERO ═════════════════════════════════════════════════

test('SCRUM-733 · 🔴 SUELO: el lector VE el censo real, y ve lo que la cabecera declara', () => {
  // Va primero a propósito. Todo lo de abajo compara conjuntos leídos por este lector: si el
  // lector no viera nada, «no desaparece ninguna entrada» sería cierto sobre la nada.
  const texto = fs.readFileSync(RUTA_SQL, 'utf8').replace(/\r\n/g, '\n');
  const r = leerCensoDelFichero(texto);
  assert.equal(r.ok, true, `🔴 NO SUPE LEER el censo real: ${r.motivo}`);
  assert.ok(r.pares.length >= MINIMO,
    `🔴 ESCÁNER CIEGO: el lector saca ${r.pares.length} entradas del fichero y hay al menos ${MINIMO}.`);
  assert.equal(r.declaradas, r.pares.length,
    '🔴 la cabecera del fichero y su contenido no cuadran. El lector no puede arbitrar nada.');
});

test('SCRUM-733 · CONTROL POSITIVO: sobre el árbol sano, el suelo NO estorba', () => {
  // La mitad que se olvida: un guard que salta en la regeneración normal se desactiva en una
  // tarde, y entonces no protege de nada. Esto fija que el camino bueno sigue abierto.
  const texto = fs.readFileSync(RUTA_SQL, 'utf8').replace(/\r\n/g, '\n');
  assert.equal(motivoParaNoEncoger(paresEsperados(), texto), null,
    '🔴 el suelo bloquea una regeneración LEGÍTIMA sobre el árbol tal cual. Así no dura.');
});

// ═══ ② LO QUE EL SUELO TIENE QUE PARAR ═══════════════════════════════════════════════════

test('SCRUM-733 · 🔴 un censo VACÍO no se escribe, y el motivo NO dice «no hay columnas»', () => {
  const texto = fs.readFileSync(RUTA_SQL, 'utf8').replace(/\r\n/g, '\n');
  const motivo = motivoParaNoEncoger([], texto);
  assert.ok(motivo, '🔴 con CERO entradas el generador sigue escribiendo. «No supe leer el modelo de '
    + 'datos» y «el schema no tiene columnas» estarían dando el mismo resultado.');
  assert.match(motivo, /no se ha podido leer el modelo de datos/i,
    '🔴 el mensaje no nombra la causa REAL. Un «0 columnas» a secas se lee como un dato del schema, '
    + 'y lo que hay es un instrumento roto.');
  // Y sin fichero previo tampoco: el vacío nunca es aceptable, haya con qué comparar o no.
  assert.ok(motivoParaNoEncoger([], null), '🔴 con el fichero aún sin crear, el vacío pasa.');
});

test('SCRUM-733 · 🔴 si el censo ENCOGE, no se escribe, y el mensaje NOMBRA lo que desaparece', () => {
  const texto = fs.readFileSync(RUTA_SQL, 'utf8').replace(/\r\n/g, '\n');
  const todos = leerCensoDelFichero(texto).pares;
  const quitada = todos[Math.floor(todos.length / 2)];
  const menosUna = todos.filter((p) => !(p[0] === quitada[0] && p[1] === quitada[1]));
  assert.equal(menosUna.length, todos.length - 1, '🔴 la preparación del caso no quitó exactamente una.');

  const motivo = motivoParaNoEncoger(menosUna, texto);
  assert.ok(motivo, '🔴 el censo puede encoger en una columna sin que nadie lo diga.');
  assert.match(motivo, new RegExp(`${quitada[0]}\\.${quitada[1]}`),
    '🔴 el mensaje no dice CUÁL desaparece. «Se ha encogido» sin nombres obliga a diffear a mano '
    + `un fichero de ${todos.length} líneas para saber qué columna deja de vigilarse.`);
});

test('SCRUM-733 · 🔴 un fichero que no cuadra consigo mismo es «no supe leerlo», NO un encogimiento', () => {
  // La distinción que da nombre al ticket. Si el lector se equivoca, el veredicto tiene que ser
  // «no sé», nunca «se ha encogido»: un falso «encogimiento» pararía una regeneración buena, y
  // —peor— enseñaría a la siguiente sesión a pasar `--acepta-encogimiento` por costumbre.
  const texto = fs.readFileSync(RUTA_SQL, 'utf8').replace(/\r\n/g, '\n');
  const declaradas = columnasDeclaradas(texto);
  assert.ok(declaradas, '🔴 SUELO: el fichero no declara sus columnas en la cabecera.');

  const mentiroso = texto.replace(`-- Columnas esperadas: ${declaradas}.`, `-- Columnas esperadas: ${declaradas + 7}.`);
  assert.notEqual(mentiroso, texto, '🔴 la mutación de la cabecera no cambió nada.');

  const r = leerCensoDelFichero(mentiroso);
  assert.equal(r.ok, false, '🔴 el lector se cree un fichero cuya cabecera no cuadra con su contenido.');
  assert.match(r.motivo, /no supe leer/i);

  const motivo = motivoParaNoEncoger(paresEsperados(), mentiroso);
  assert.ok(motivo, '🔴 con el fichero ilegible se escribe igual.');
  assert.match(motivo, /NO SUPE LEER EL FICHERO/,
    '🔴 se está reportando como encogimiento algo que es una lectura fallida. Son cosas distintas: '
    + 'una la arregla el schema y la otra la arregla borrar el fichero.');
});

// ═══ ③ LO QUE EL SUELO NO DEBE PARAR — LOS CONTROLES NEGATIVOS ═══════════════════════════

test('SCRUM-733 · 🔴 CONTROL NEGATIVO: crecer es lo normal y no pide permiso', () => {
  const texto = fs.readFileSync(RUTA_SQL, 'utf8').replace(/\r\n/g, '\n');
  const conUnaMas = [...leerCensoDelFichero(texto).pares, ['zzz_tabla_nueva', 'columna_nueva']];
  assert.equal(motivoParaNoEncoger(conUnaMas, texto), null,
    '🔴 añadir una columna —el caso de CADA ticket que toca el schema— pide permiso. Un guard que '
    + 'estorba en el camino bueno acaba desactivado, y entonces no para el malo tampoco.');
});

test('SCRUM-733 · 🔴 CONTROL NEGATIVO: el lector NO se ciega con un comentario SQL detrás', () => {
  // Es literalmente lo que el encargo pedía como salida: «no se prohíbe el comentario; la salida
  // es que el parser sepa leerlos, o que GRITE cuando no puede». Éste los sabe leer.
  //
  // Y NO es un capricho: el vigilante de `tests/scrum461-censo-no-encoge.test.mjs` exige la línea
  // EXACTA (`^ {4}\('a','b'\),?$`), y medido, un solo comentario detrás le hace ver 421 donde hay
  // 422. Allí ese error grita (la entrada sale como «falta en el SQL»). Aquí, con el mismo error,
  // el fichero parecería haber ENCOGIDO y se pararía una regeneración legítima.
  const texto = fs.readFileSync(RUTA_SQL, 'utf8').replace(/\r\n/g, '\n');
  const base = leerCensoDelFichero(texto);
  const lineas = texto.split('\n');

  const i = lineas.map((l, n) => (/^ {4}\('[^']+','[^']+'\)/.test(l) ? n : -1)).filter((n) => n >= 0).pop();
  assert.ok(i > 0, '🔴 SUELO: no localizo ninguna línea de entrada en el fichero.');

  for (const cola of [' -- una nota', '   ', '\t-- otra nota']) {
    const anotado = lineas.slice();
    anotado[i] += cola;
    const txt = anotado.join('\n');
    assert.notEqual(txt, texto, `🔴 la mutación ${JSON.stringify(cola)} no cambió nada.`);
    const r = leerCensoDelFichero(txt);
    assert.equal(r.ok, true, `🔴 con ${JSON.stringify(cola)} detrás, el lector se declara ciego: ${r.motivo}`);
    assert.equal(r.pares.length, base.pares.length,
      `🔴 con ${JSON.stringify(cola)} detrás de la última entrada, el lector pierde ` +
      `${base.pares.length - r.pares.length}. Eso se leería como que el censo se ha encogido.`);
  }
});

// ═══ ④ QUE EL SUELO ESTÉ ENCHUFADO, Y NO SÓLO EXPORTADO ══════════════════════════════════

test('SCRUM-733 · 🔴 el suelo se LLAMA en el camino de escritura, no sólo existe', () => {
  // Mencionar no es hacer: que la función exista no prueba que nadie la use. Se comprueba sobre
  // el fuente del script, en el bloque que sólo corre cuando se ejecuta directamente.
  const src = fs.readFileSync(path.join(RAIZ, 'scripts', 'generar-sql-deriva.mjs'), 'utf8');
  const bloque = src.slice(src.indexOf('if (process.argv[1]'));
  assert.ok(bloque.length > 200, '🔴 no encuentro el bloque de ejecución directa del script.');
  assert.match(bloque, /motivoParaNoEncoger\s*\(/,
    '🔴 el suelo está exportado pero NADIE lo llama antes de escribir. Un guard que no se invoca es '
    + 'un guard que no existe, y encima parece que sí.');
  assert.ok(bloque.indexOf('motivoParaNoEncoger(') < bloque.indexOf('writeFileSync'),
    '🔴 el suelo se comprueba DESPUÉS de escribir. Para entonces el censo corto ya está en disco.');
  assert.match(bloque, /--acepta-encogimiento/,
    '🔴 no hay forma declarada de aceptar un encogimiento legítimo. Un guard sin salida se rodea '
    + 'borrando el fichero, que es peor.');
});

// ═══ ⑤ EL FICHERO SIGUE SIENDO EL QUE EL SCHEMA PIDE ═════════════════════════════════════

test('SCRUM-733 · el suelo no ha cambiado lo que el generador escribe', () => {
  // El cambio de este ticket es una PUERTA, no una reforma del contenido. Si el fichero cambiara,
  // este ticket habría hecho algo que nadie pidió.
  const enDisco = fs.readFileSync(RUTA_SQL, 'utf8').replace(/\r\n/g, '\n');
  assert.equal(generarSql(), enDisco,
    '🔴 el fichero commiteado ya no coincide con lo que produce el generador.');
});

test('SCRUM-733 · SUELO del propio arnés: `generarSql` sigue siendo PURA y aceptando listas cortas', () => {
  // El suelo va en la ESCRITURA a propósito, no dentro de `generarSql`: los tests la llaman con
  // listas sintéticas de tres pares y meterlo dentro los haría depender del entorno. Se fija aquí
  // para que nadie lo «arregle» moviéndolo y rompa a los que la usan así.
  const sql = generarSql(TRES);
  assert.match(sql, /-- Columnas esperadas: 3\. Tablas: 2\./);
  assert.match(sql, /\('Customer','id'\)/);
});
