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
  redDeSeguridad, DIR_MARCA, SALIDA_NO_RESTAURADO,
} from '../scripts/meta-guard-mutaciones.mjs';
import { censar as censarEscritores, analizar as analizarEscritor }
  from '../scripts/censo-escritores-del-arbol.mjs';

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
  const manifiesto = path.join(DIR_MARCA, 'en-vuelo.json');
  if (!fs.existsSync(manifiesto)) return; // el caso normal

  let datos = null;
  try { datos = JSON.parse(fs.readFileSync(manifiesto, 'utf8')); } catch { /* ilegible */ }
  assert.ok(datos, `🔴 hay una marca ILEGIBLE en \`${DIR_MARCA}\`: una pasada murió y no se sabe `
    + 'qué dejó puesto en el árbol. Corre `node scripts/meta-guard-mutaciones.mjs --solo-censo`.');

  let viva = false;
  try { process.kill(datos.pid, 0); viva = true; } catch { viva = false; }
  if (viva) return; // hay una pasada trabajando ahora mismo: no es un defecto

  const sucios = (datos.piezas || []).filter((p) => {
    try { return Buffer.compare(fs.readFileSync(p.abs), fs.readFileSync(p.copia)) !== 0; }
    catch { return true; }
  });
  assert.deepEqual(sucios.map((p) => p.ruta), [],
    `🔴 EL ÁRBOL ESTÁ MUTADO AHORA MISMO. Lo dejó una pasada muerta (pid ${datos.pid}, `
    + `${datos.cuando}) y todo lo que mida esta tanda mide un árbol que no es el que está escrito.\n`
    + '  Repáralo con `node scripts/meta-guard-mutaciones.mjs --solo-censo` (≈1 s), que devuelve '
    + 'los bytes originales y lo dice en voz alta.');
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
    fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '  if (!sucios.length) borrarMarca(dir);',
    a: '  borrarMarca(dir);',
    cae: 'lo que NO se puede devolver sale NOMBRADO, y la marca se queda',
  },
  {
    // Se deja de contar como reparado lo que sí se reparó: el aviso enmudece.
    fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '      reparadas.push(p.ruta);',
    a: '      /* no lo cuenta */',
    cae: 'una mutación que sobrevivió a la pasada se REPARA, y se dice',
  },
  {
    // Una marca ilegible se trata como si no hubiera marca.
    fichero: 'scripts/meta-guard-mutaciones.mjs',
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
