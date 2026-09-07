// tests/scrum808-el-arbol-que-queda-mutado.test.mjs — SCRUM-808
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL INSTRUMENTO QUE MUTA EL ÁRBOL SE DEJABA EL ÁRBOL MUTADO.
//
// `meta-guard-mutaciones` restaura en un `finally`, y **una terminación no ejecuta ese
// `finally`**. Se mata la pasada y el fichero mutado se queda dentro. Pasó DOS VECES el
// 6-sep-2026, a dos sesiones distintas, y las dos se cazó porque alguien miró `git status` por su
// cuenta: vigilancia por costumbre, no por mecanismo.
//
// 🔴 Y lo que lo hace grave: **matar la pasada es la conducta correcta** —se mata para no medir
// sobre un árbol caducado—. El instrumento castigaba la conducta que él mismo exige.
//
// ── LO QUE ESTE FICHERO SUJETA ──────────────────────────────────────────────────────────────
//   ① que una marca con el fichero mutado se REPARE, verificada por bytes;
//   ② que si NO se puede reparar, salga NOMBRANDO el fichero — nunca en silencio;
//   ③ que una pasada SANA no grite (si empieza a denunciar sin motivo, se rompió por el otro lado);
//   ④ que una marca ILEGIBLE cuente como sucia, no como ausencia;
//   ⑤ 🔴 que AHORA MISMO no haya una marca HUÉRFANA en este árbol — el suelo que convierte la
//      costumbre en mecanismo: si una pasada murió y dejó algo puesto, la tanda se pone roja.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  marcarEnVuelo, borrarMarca, restaurarDesdeMarca, restaurarYVerificar,
  redDeSeguridad, marcasHuerfanas, SALIDA_NO_RESTAURADO,
} from '../scripts/meta-guard-mutaciones.mjs';
import { censar as censarEscritores, analizar as analizarEscritor }
  from '../scripts/censo-escritores-del-arbol.mjs';

import { fileURLToPath } from 'node:url';
const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Un arbolito de mentira: un fichero «del árbol» y su directorio de marca, los dos temporales. */
function banco() {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum808-'));
  const abs = path.join(raiz, 'victima.mjs');
  const ORIGINAL = Buffer.from('export const x = 1;\r\n', 'utf8'); // con CR: el árbitro son los BYTES
  fs.writeFileSync(abs, ORIGINAL);
  return { raiz, abs, ORIGINAL, dir: path.join(raiz, '.marca'), limpia: () => fs.rmSync(raiz, { recursive: true, force: true }) };
}

// ═══ ① EL ROJO QUE IMPORTA · una mutación que sobrevivió a una pasada muerta ══════════════════

test('SCRUM-808 · 🔴 una mutación que sobrevivió a la pasada se REPARA, y se dice', () => {
  const b = banco();
  try {
    marcarEnVuelo([{ ruta: 'victima.mjs', abs: b.abs, ORIGINAL: b.ORIGINAL }], b.dir);
    // La pasada muere aquí: el fichero queda mutado y la marca sin borrar.
    fs.writeFileSync(b.abs, 'export const x = 999; // MUTADO\n');
    assert.notEqual(Buffer.compare(fs.readFileSync(b.abs), b.ORIGINAL), 0,
      '🔴 el banco no ha llegado a mutar nada: lo de abajo mediría el vacío.');

    const r = restaurarDesdeMarca(b.dir);
    assert.equal(r.habia, true, '🔴 no ha visto la marca que acaba de dejarse.');
    assert.deepEqual(r.reparadas, ['victima.mjs'], '🔴 no dice QUÉ ha devuelto.');
    assert.deepEqual(r.sucios, []);
    assert.equal(Buffer.compare(fs.readFileSync(b.abs), b.ORIGINAL), 0,
      '🔴 el fichero NO ha vuelto a sus bytes. Y se compara por BYTES, no por texto: un fichero '
      + 'normalizado tiene el blob limpio y CR en la copia de trabajo (SCRUM-570).');
    assert.equal(fs.existsSync(path.join(b.dir, 'en-vuelo.json')), false,
      '🔴 la marca sigue puesta después de reparar: la siguiente pasada volvería a gritar por algo '
      + 'que ya está resuelto.');
  } finally { b.limpia(); }
});

// ═══ ② EL SUELO · si no se puede reparar, se NOMBRA. Nunca en silencio ═══════════════════════

test('SCRUM-808 · 🔴 lo que NO se puede devolver sale NOMBRADO, y la marca se queda', () => {
  const b = banco();
  try {
    marcarEnVuelo([{ ruta: 'victima.mjs', abs: b.abs, ORIGINAL: b.ORIGINAL }], b.dir);
    fs.writeFileSync(b.abs, 'MUTADO\n');
    // Se rompe la copia de respaldo: ya no hay con qué devolverlo.
    fs.rmSync(path.join(b.dir, 'pieza-0.bin'));

    const r = restaurarDesdeMarca(b.dir);
    assert.equal(r.habia, true);
    assert.deepEqual(r.reparadas, []);
    assert.equal(r.sucios.length, 1, '🔴 no denuncia nada: un árbol sucio en silencio es peor que '
      + 'una pasada fallida.');
    assert.match(r.sucios[0], /victima\.mjs/,
      `🔴 denuncia sin NOMBRAR el fichero: «${r.sucios[0]}». Sin el nombre, quien lo lea no sabe `
      + 'qué mirar.');
    assert.equal(fs.existsSync(path.join(b.dir, 'en-vuelo.json')), true,
      '🔴 ha borrado la marca dejando el árbol sucio: se ha destruido la única evidencia de qué '
      + 'quedó puesto.');
  } finally { b.limpia(); }
});

// ═══ ③ CONTROL POSITIVO · una pasada SANA no puede gritar ════════════════════════════════════

test('SCRUM-808 · ✅ sin marca no dice nada, y una marca ya cuadrada no cuenta como reparada', () => {
  const b = banco();
  try {
    // Sin marca: silencio absoluto.
    const vacio = restaurarDesdeMarca(b.dir);
    assert.deepEqual(vacio, { habia: false, reparadas: [], sucios: [] },
      '🔴 inventa trabajo donde no hay marca. Una pasada sana empezaría denunciando.');

    // Con marca, pero el fichero YA está en sus bytes (el `finally` sí corrió).
    marcarEnVuelo([{ ruta: 'victima.mjs', abs: b.abs, ORIGINAL: b.ORIGINAL }], b.dir);
    const r = restaurarDesdeMarca(b.dir);
    assert.deepEqual(r.reparadas, [],
      '🔴 cuenta como REPARADO un fichero que nunca estuvo mutado: la pasada sana gritaría en cada '
      + 'arranque y el aviso dejaría de significar nada.');
    assert.deepEqual(r.sucios, []);
  } finally { b.limpia(); }
});

// ═══ ④ UNA MARCA ILEGIBLE ES SUCIA, NO AUSENTE ═══════════════════════════════════════════════

test('SCRUM-808 · una marca ILEGIBLE se denuncia: «no sé qué quedó puesto» no es «nada»', () => {
  const b = banco();
  try {
    fs.mkdirSync(b.dir, { recursive: true });
    fs.writeFileSync(path.join(b.dir, 'en-vuelo.json'), '{esto no es json');
    const r = restaurarDesdeMarca(b.dir);
    assert.equal(r.habia, true, '🔴 una marca rota se lee como «no había marca».');
    assert.equal(r.sucios.length, 1, '🔴 la ignora: hubo una pasada muerta y nadie lo sabría.');
    assert.equal(fs.existsSync(path.join(b.dir, 'en-vuelo.json')), true,
      '🔴 borra la evidencia de una marca que no supo leer.');
  } finally { b.limpia(); }
});

// ═══ ⑤ LA RED DE SEGURIDAD, EJERCITADA SIN MATAR EL PROCESO ══════════════════════════════════

test('SCRUM-808 · la red devuelve las piezas en vuelo y, si no puede, sale con código ≠ 0', () => {
  const b = banco();
  try {
    // Camino bueno: hay una pieza en vuelo y se devuelve.
    const enVuelo = [{ ruta: 'victima.mjs', abs: b.abs, ORIGINAL: b.ORIGINAL }];
    marcarEnVuelo(enVuelo, b.dir);
    fs.writeFileSync(b.abs, 'MUTADO\n');
    const salidas = [];
    const devolver = redDeSeguridad((c) => salidas.push(c), enVuelo, b.dir);
    assert.equal(devolver('Prueba.'), true, '🔴 la red dice que no tenía nada que devolver.');
    assert.equal(Buffer.compare(fs.readFileSync(b.abs), b.ORIGINAL), 0,
      '🔴 la red no devolvió el fichero a sus bytes.');
    assert.deepEqual(salidas, [], '🔴 ha salido con error habiendo restaurado bien.');

    // Sin nada en vuelo, no hace nada: la red no puede inventarse trabajo.
    assert.equal(devolver('Prueba.'), false);

    // 🔴 Camino malo: la pieza apunta a un sitio donde NO se puede escribir. La red no puede
    // reventar —corre dentro de un manejador de señal— y tiene que DENUNCIAR con el nombre.
    const rotas = [{ ruta: 'imposible.mjs', abs: path.join(b.raiz, 'no-existe-dir', 'x.mjs'), ORIGINAL: b.ORIGINAL }];
    const salidas2 = [];
    const devolver2 = redDeSeguridad((c) => salidas2.push(c), rotas, b.dir);
    assert.equal(devolver2('Prueba.'), true);
    assert.deepEqual(salidas2, [SALIDA_NO_RESTAURADO],
      '🔴 no ha salido con código de «no pude restaurar» cuando no pudo restaurar.');
  } finally {
    borrarMarca(b.dir);
    b.limpia();
  }
});

// ═══ ⑥ 🔴 EL SUELO SOBRE EL ÁRBOL DE VERDAD ══════════════════════════════════════════════════

test('SCRUM-808 · 🔴 NO hay una marca HUÉRFANA en este árbol ahora mismo', () => {
  // ═════════════════════════════════════════════════════════════════════════════════════════
  // Éste es el que convierte la costumbre en mecanismo. Las dos veces que pasó, lo cazó una
  // persona mirando `git status`. A partir de aquí lo caza la tanda.
  //
  // HUÉRFANA = hay marca y el proceso que la dejó YA NO VIVE. Una marca de una pasada VIVA no es
  // un defecto: es el instrumento trabajando, y ponerse rojo por eso sería ruido.
  // ═════════════════════════════════════════════════════════════════════════════════════════
  // 🔴 SE BARREN TODAS LAS MARCAS, no sólo la del meta-guard — y esto lo cazó el control de la
  // continuación del ticket: al darle la red a `censo-mudez`, se le mató a mitad, el árbol quedó
  // con `tests/_guard-texto.mjs` mutado… y este test siguió VERDE, porque miraba UNA carpeta.
  // Una herramienta nueva que adopte la marca queda vigilada sin volver a tocar esto.
  const huerfanas = marcasHuerfanas();
  const ilegibles = huerfanas.filter((h) => h.ilegible).map((h) => h.herramienta);
  assert.deepEqual(ilegibles, [],
    `🔴 hay una marca ILEGIBLE (${ilegibles.join(', ')}): una pasada murió y NO SE SABE qué dejó `
    + 'puesto en el árbol. Repárala corriendo esa herramienta, que la mira al arrancar.');

  assert.deepEqual(huerfanas.map((h) => `${h.herramienta} → ${h.sucias.join(', ')}`), [],
    '🔴 EL ÁRBOL ESTÁ MUTADO AHORA MISMO, por una pasada MUERTA'
    + huerfanas.map((h) => `\n  · ${h.herramienta} (pid ${h.pid}, ${h.cuando}): ${h.sucias.join(', ')}`).join('')
    + '\n  Todo lo que mida esta tanda mide un árbol que no es el que está escrito.\n'
    + '  Se repara volviendo a lanzar esa herramienta, que mira la marca al arrancar:\n'
    + '    · meta-guard-mutaciones → `node scripts/meta-guard-mutaciones.mjs --solo-censo` (≈1 s)\n'
    + '    · censo-mudez           → `npm run censo:mudez`');
});

// ═══ ⑥bis 🔴 EL ORDEN QUE CONVIERTE UN RESTO REPARABLE EN UNO DEFINITIVO ═════════════════════

test('SCRUM-808 · 🔴 la reparación va ANTES de capturar el original, en las dos herramientas', () => {
  // ═════════════════════════════════════════════════════════════════════════════════════════
  // ESTO ME MORDIÓ AL ESCRIBIRLO, y por eso está sujeto. La primera versión de la red en
  // `censo-mudez` reparaba DESPUÉS de leer el helper:
  //
  //     const ORIGINAL = fs.readFileSync(HELPER);   // ← lee el fichero TODAVÍA MUTADO
  //     restaurarDesdeMarca(DIR_MARCA);             // ← repara, pero ORIGINAL ya está sucio
  //
  // Consecuencia REPRODUCIDA: la pasada toma como línea base el fichero mutado, su propio
  // `finally` «restaura» a un estado mutado, y el resto se vuelve PERMANENTE — encima apilado,
  // dos líneas de instrumentación una debajo de otra, con la marca nueva guardando como
  // «original» unos bytes que ya llevaban la mutación de la pasada muerta.
  //
  // El remedio mal ordenado convertía un resto reparable en uno definitivo. Se comprueba por
  // POSICIÓN en el fuente, que es donde vive la propiedad.
  // ═════════════════════════════════════════════════════════════════════════════════════════
  // 🔴 Y EL CRITERIO SE MIDE DONDE VIVE EL ORDEN, que NO es el mismo sitio en las dos:
  //   · `censo-mudez` es un script de nivel superior → la posición en el texto ES el orden.
  //   · en el meta-guard la mutación vive dentro de `aplicarUna`, una FUNCIÓN, así que su
  //     posición en el fichero no dice nada; lo que decide es el orden DENTRO del bloque de
  //     arranque. (La primera versión de este test comparaba texto y acusó al meta-guard, que
  //     está bien: el criterio equivocado acusa al inocente.)
  const mudez = fs.readFileSync(path.join(RAIZ, 'scripts/censo-mudez.mjs'), 'utf8');
  const iRepara = mudez.indexOf('restaurarDesdeMarca(');
  const iCaptura = mudez.indexOf('const ORIGINAL = fs.readFileSync(HELPER');
  assert.ok(iRepara > 0, '🔴 `censo-mudez` ya no repara la marca al arrancar: ha perdido la red.');
  assert.ok(iCaptura > 0, '🔴 CIEGO: no encuentro dónde captura el helper `censo-mudez`.');
  assert.ok(iRepara < iCaptura,
    '🔴 en `censo-mudez` la reparación va DESPUÉS de capturar los bytes de referencia. Así, una '
    + 'pasada que arranque sobre un árbol sucio toma la MUTACIÓN como línea base y su propio '
    + '`finally` la deja PERMANENTE. El resto deja de ser reparable.');

  const meta = fs.readFileSync(path.join(RAIZ, 'scripts/meta-guard-mutaciones.mjs'), 'utf8');
  const iPuerta = meta.indexOf('if (ejecutadoDirectamente(import.meta.url))');
  assert.ok(iPuerta > 0, '🔴 CIEGO: no encuentro la puerta de arranque del meta-guard.');
  const bloque = meta.slice(iPuerta);
  const iReparaMeta = bloque.indexOf('restaurarDesdeMarca(DIR_MARCA)');
  const iAplica = bloque.indexOf('aplicarUna(');
  assert.ok(iReparaMeta > 0, '🔴 el meta-guard ya no repara la marca al arrancar.');
  assert.ok(iAplica > 0, '🔴 CIEGO: no encuentro dónde el bloque de arranque muta.');
  assert.ok(iReparaMeta < iAplica,
    '🔴 el meta-guard empieza a mutar ANTES de haber reparado una marca pendiente: mediría sobre '
    + 'un árbol que no es el que está escrito.');
});

// ═══ ⑦ EL CENSO DE LA OBLIGACIÓN 4 · ¿está el patrón en más sitios? ══════════════════════════

test('SCRUM-808 · el censo de escritores VE al que originó el ticket, y no está ciego', () => {
  const c = censarEscritores();
  assert.equal(c.motivo, null, `🔴 CIEGO: ${c.motivo}.`);
  const yo = c.escritores.find((e) => e.rel === 'scripts/meta-guard-mutaciones.mjs');
  assert.ok(yo, '🔴 el censo NO encuentra al escritor que originó este ticket. Si no ve al que '
    + 'sabemos que escribe, su lista no significa nada.');
  assert.ok(yo.capturaYDevuelve.length,
    '🔴 no lo ve CAPTURAR y devolver, que es lo que lo hace peligroso: escribe sobre un fichero '
    + 'que ha leído antes y promete dejarlo como estaba.');
  assert.equal(yo.tieneRed, true, '🔴 el meta-guard ha perdido la red de SCRUM-808.');
});

test('SCRUM-808 · 🔴 en `copyFileSync` el destino es el SEGUNDO argumento', () => {
  // ═════════════════════════════════════════════════════════════════════════════════════════
  // Este test existe porque el censo YA SE EQUIVOCÓ aquí. Miraba siempre `arguments[0]`, y en
  // `copyFileSync(origen, destino)` ése es el que se LEE. Resultado: seis ficheros salían como
  // «escriben en el árbol» por copiar `package.json` FUERA de él — falsos con forma de hallazgo,
  // y el destino de verdad sin mirar.
  // ═════════════════════════════════════════════════════════════════════════════════════════
  const cab = "import path from 'node:path';\nimport { fileURLToPath } from 'node:url';\n"
    + "const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');\n";
  const copiaFuera = analizarEscritor(cab + "fs.copyFileSync(path.join(RAIZ, 'a.txt'), '/tmp/b');\n", 'x.mjs');
  assert.deepEqual(copiaFuera.escrituras, [],
    '🔴 cuenta como escritura en el árbol una copia que SALE del árbol: el primer argumento se lee.');

  const copiaDentro = analizarEscritor(cab + "fs.copyFileSync('/tmp/b', path.join(RAIZ, 'a.txt'));\n", 'x.mjs');
  assert.equal(copiaDentro.escrituras.length, 1,
    '🔴 y ahora NO ve la que sí entra en el árbol: el detector no discrimina, sólo se ha movido.');
});

test('SCRUM-808 · leer un fichero del árbol NO es escribirlo', () => {
  const cab = "import path from 'node:path';\nimport { fileURLToPath } from 'node:url';\n"
    + "const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');\n";
  const soloLee = analizarEscritor(cab + "const t = fs.readFileSync(path.join(RAIZ, 'a.txt'), 'utf8');\n", 'x.mjs');
  assert.deepEqual(soloLee.escrituras, [], '🔴 una LECTURA se cuenta como escritura.');
  assert.deepEqual(soloLee.capturaYDevuelve, []);

  // Y capturar-y-devolver se reconoce por la pareja leer/escribir sobre la MISMA ruta.
  const captura = analizarEscritor(cab + 'const A = path.join(RAIZ, "a.txt");\n'
    + "const o = fs.readFileSync(A);\ntry { fs.writeFileSync(A, 'x'); } finally { fs.writeFileSync(A, o); }\n", 'x.mjs');
  assert.equal(captura.capturaYDevuelve.length, 2,
    '🔴 no reconoce el patrón CAPTURA-Y-DEVUELVE, que es el único que puede quedarse a medias.');
  assert.equal(captura.tieneFinally, true);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LAS MUTACIONES QUE ME TUMBAN (contrato de SCRUM-745)
// ⛔ `a` va como LITERAL ÚNICO, nunca concatenado: el lector por AST sólo acepta literales y
//    descarta el resto EN SILENCIO. Ese agujero ya ha mordido a tres sesiones.
// ═════════════════════════════════════════════════════════════════════════════════════════════
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // La marca se borra aunque quede algo sucio: se destruye la evidencia.
    fichero: 'scripts/_marca-de-arbol.mjs',
    de: '  if (!sucios.length) borrarMarca(dir);',
    a: '  borrarMarca(dir);',
    cae: 'lo que NO se puede devolver sale NOMBRADO, y la marca se queda',
  },
  {
    // Se deja de contar como reparado lo que sí se reparó: el aviso enmudece.
    fichero: 'scripts/_marca-de-arbol.mjs',
    de: '      reparadas.push(p.ruta);',
    a: '      /* no lo cuenta */',
    cae: 'una mutación que sobrevivió a la pasada se REPARA, y se dice',
  },
  {
    // Una marca ilegible se trata como si no hubiera marca.
    fichero: 'scripts/_marca-de-arbol.mjs',
    de: "    return { habia: true, reparadas: [], sucios: [`(marca ilegible en ${dir}: ${e.message})`] };",
    a: '    return { habia: false, reparadas: [], sucios: [] };',
    cae: 'una marca ILEGIBLE se denuncia',
  },
  {
    // El censo vuelve a mirar el PRIMER argumento en `copyFileSync`: el defecto que se midió.
    fichero: 'scripts/censo-escritores-del-arbol.mjs',
    de: '    const destino = n.arguments[DESTINO_ES_EL_SEGUNDO.has(api) ? 1 : 0];',
    a: '    const destino = n.arguments[0];',
    cae: 'en `copyFileSync` el destino es el SEGUNDO argumento',
  },
];
