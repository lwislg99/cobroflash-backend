// tests/scrum694b-el-filtro-que-no-ve-la-url.test.mjs — SCRUM-694b
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL FILTRO QUE SE LIBRABA DE `https://` Y SE MORÍA CON `/^https?:\/\//`
//
// SCRUM-694 migró nueve guards y dejó medido que quedaban más. Esto cierra la familia que de
// verdad produce VERDES: la que corta a MITAD DE LÍNEA.
//
// ── QUÉ TENÍAN ESTOS NUEVE, Y POR QUÉ PARECÍA QUE ESTABA RESUELTO ───────────────────────
//
//     .replace(/(^|[^:])\/\/.*$/, '$1')
//
// Ese `[^:]` es un parche contra las URLs: como `https://` lleva dos puntos delante de las dos
// barras, el corte no salta y la línea se salva. Parece que el problema está resuelto, y por eso
// nadie volvió a mirarlo. Pero las URLs no aparecen en el código sólo como texto: aparecen
// también como el REGEX QUE LAS RECONOCE, y ahí las dos barras van detrás de una CONTRABARRA:
//
//     /^https?:\/\//     →  …`\/` + `/`…  →  dos barras seguidas con `\` delante  →  `[^:]` casa
//
// Así que el filtro se come la línea entera justo en el sitio donde se valida una URL. Medido el
// 15-sep-2026, esa línea existe DOS VECES en código de producto de la casa:
//
//   · public/dashboard/js/settingsView.js:1013   if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
//   · src/core/validation/schemas.ts:483         …!/^https?:\/\//i.test(v.trim()) ? `https://${v.trim()}` : v),
//
// De ambas, el filtro viejo conserva `if (!/^https?:\/` y TIRA EL RESTO. Lo que se tira es
// código que el guard tenía que vigilar, y un guard que no ve no encuentra: da VERDE.
//
// ── NO ES HIPOTÉTICO, Y ESTABA PASANDO ──────────────────────────────────────────────────
// `scrum745` desnuda `scripts/meta-guard-mutaciones.mjs` y prohíbe en NEGATIVO que ahí se nombre
// un reporter. Con el filtro viejo, su línea 515 —`if (/(^|[^\w.])(\.\.\/)?dist\//.test(n.text))
// visto = true;`— se quedaba en `if (/(^|[^\w.])(\.\.\/)?dist\`. Nada de lo que fuera detrás de
// una línea así se vigilaba, y la prohibición es una NEGACIÓN: sobre el texto que no se ve, una
// negación se cumple sola.
//
// ── LO QUE SE MIDIÓ (15-sep-2026, sobre `origin/main` = 07ccd16c) ───────────────────────
// Guards que se fabrican su filtro: **51** (eran 56 el 2-sep). Por forma del corte:
//
//   | corta a mitad de línea `(^|[^:])//`      |  9 | ← la familia de este ticket. Migrada.
//   | corta en CUALQUIER `//`                  |  3 | 2 leen `prisma/schema.prisma` (no aplica,
//   |                                          |    | mismo motivo que SCRUM-694) + 1 que hoy no
//   |                                          |    | pierde nada: `censo-anclas-bloque-f`.
//   | sólo la línea que EMPIEZA por `//`       | 30 | no corta a mitad de línea: otra familia.
//   | sólo detrás de un espacio `(^|\s)//`     |  9 | `https://` lleva `:` delante, no espacio.
//
// Se migran los NUEVE. Los otros 42 se reportan y el trinquete de SCRUM-694 baja a 42.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { soloCodigo, literalesDe } from './_solo-codigo.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

/** EL FILTRO QUE SE RETIRA, copiado tal cual estaba en los nueve. */
const filtroViejo = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split('\n').map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');

/**
 * Los NUEVE migrados y LA AGUJA de cada uno: el texto que le da sentido a su prohibición.
 * Mismo criterio que la tabla de SCRUM-694 — si alguien vacía un guard, su aguja desaparece.
 */
const MIGRADOS = [
  ['scrum500-suplidos', 'suplido'],
  ['scrum598-el-margen-sale-del-documento', 'markupInput'],
  ['scrum609b-switch-tipo-articulo', '_editSwitch'],
  ['scrum611-tipo-iva-elegible', 'quote-line__vat'],
  ['scrum623-desglose-por-tipo', 'generateInvoicePdf'],
  ['scrum641-nombre-cogido-sin-500', 'createProduct'],
  ['scrum647-presupuesto-tambien-neutral', 'locale.vatName'],
  ['scrum741-la-entrada-no-la-linea', 'paresDelSql'],
  ['scrum745-comparar-por-identidad', 'test-reporter'],
];

const fuenteGuard = (g) => leer('tests/' + g + '.test.mjs');

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO · un censo que no encuentra nada da el mismo cero que uno que no mira
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-694b · SUELO: los NUEVE existen y USAN el mecanismo', () => {
  assert.equal(MIGRADOS.length, 9, '🔴 la lista de migrados ha cambiado de tamaño sin decirlo.');
  const sinMecanismo = MIGRADOS.map(([g]) => g)
    .filter((g) => !soloCodigo(fuenteGuard(g), g + '.mjs').includes('_solo-codigo.mjs'));
  assert.deepEqual(sinMecanismo, [],
    '🔴 ' + sinMecanismo.length + ' guard(s) han vuelto a filtrar comentarios por su cuenta: '
    + sinMecanismo.join(', ') + '. Y se mira sobre el CÓDIGO: nombrar el mecanismo en un '
    + 'comentario no es importarlo.');
});

test('SCRUM-694b · 🔴 ninguno se ha quedado VACÍO: cada uno conserva su aguja', () => {
  // El riesgo de cualquier migración de filtro: dejar el guard corriendo pero sin nada que
  // buscar. Un guard que ya no nombra lo que prohíbe no falla nunca, y su verde no significa
  // nada. Cambiar un filtro malo por un guard muerto es ir a peor.
  const vacios = MIGRADOS.filter(([g, aguja]) => !fuenteGuard(g).includes(aguja)).map(([g]) => g);
  assert.deepEqual(vacios, [],
    '🔴 ' + vacios.length + ' guard(s) ya no nombran lo que prohíben: ' + vacios.join(', ') + '.');
});

test('SCRUM-694b · SUELO: el filtro que se retira NO ha vuelto a ninguno de los nueve', () => {
  const EL_CORTE = '(^|[^:])' + String.fromCharCode(92) + '/' + String.fromCharCode(92) + '/.*$';
  const reincidentes = MIGRADOS.map(([g]) => g)
    .filter((g) => soloCodigo(fuenteGuard(g), g + '.mjs').includes(EL_CORTE));
  assert.deepEqual(reincidentes, [],
    '🔴 ha vuelto el corte `(^|[^:])//` a: ' + reincidentes.join(', ') + '. Ese `[^:]` parece '
    + 'que resuelve las URLs y sólo resuelve las que van en texto: ante el regex que las '
    + 'reconoce, `/^https?:\\/\\//`, corta igual.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL CASO REAL — no un ejemplo que se le parezca: las LÍNEAS QUE HAY EN EL ÁRBOL
// ═════════════════════════════════════════════════════════════════════════════════════════

/**
 * Las dos líneas de código de PRODUCTO donde vive el caso. Se localizan por su CONTENIDO y no
 * por su número: el número envejece en cuanto alguien añade una línea encima, y un test que se
 * ancla a un número o miente o se cae por nada.
 */
const LINEAS_REALES = [
  ['public/dashboard/js/settingsView.js', "v = 'https://' + v;"],
  ['src/core/validation/schemas.ts', '`https://${v.trim()}`'],
];

test('SCRUM-694b · 🔴 SUELO del caso real: esas dos líneas SIGUEN en el árbol', () => {
  // Si el árbol se moviera y ya no existieran, los dos tests de abajo pasarían sin mirar nada.
  // Que no se encuentren no es «arreglado»: es «no medido», y hay que volver a buscar el caso.
  for (const [rel, marca] of LINEAS_REALES) {
    const encontrada = leer(rel).split(/\r?\n/).filter((l) => l.includes(marca));
    assert.equal(encontrada.length >= 1, true,
      '🔴 ya no encuentro «' + marca + '» en ' + rel + '. El caso real de este ticket se apoya '
      + 'en esa línea: si ha cambiado, hay que RE-MEDIR dónde está ahora el defecto, no dar '
      + 'por hecho que se fue.');
  }
});

test('SCRUM-694b · 🔴 el filtro retirado se COME esas líneas reales; el mecanismo NO', () => {
  for (const [rel, marca] of LINEAS_REALES) {
    const linea = leer(rel).split(/\r?\n/).find((l) => l.includes(marca));

    // ① el daño: el filtro viejo tira la línea por la mitad, y con ella el código de después.
    assert.equal(filtroViejo(linea).includes(marca), false,
      '🔴 CONTROL ROTO en ' + rel + ': el filtro viejo ya NO se come «' + marca + '», así que '
      + 'esta migración no estaría arreglando lo que dice arreglar. Vuelve a medir.');

    // ② y el arreglo: el mecanismo conserva la línea entera, porque tokeniza en vez de cortar.
    assert.equal(soloCodigo(linea, path.basename(rel)).includes(marca), true,
      '🔴 el mecanismo TAMBIÉN se come «' + marca + '» en ' + rel + '. Entonces no es un arreglo: '
      + 'es el mismo defecto con otro nombre.');
  }
});

test('SCRUM-694b · 🔴 y la línea 515 que `scrum745` desnudaba de verdad', () => {
  // Éste es el caso que estaba PASANDO: no una línea cualquiera del árbol, sino una que un guard
  // migrado pasa por su filtro en cada tanda.
  const MARCA = 'dist' + String.fromCharCode(92) + '//.test(n.text)';
  const linea = leer('scripts/meta-guard-mutaciones.mjs').split(/\r?\n/).find((l) => l.includes(MARCA));
  assert.ok(linea, '🔴 ya no encuentro la línea de `meta-guard-mutaciones.mjs` que se medía. RE-MEDIR.');
  assert.equal(filtroViejo(linea).includes('visto = true'), false,
    '🔴 CONTROL ROTO: el filtro viejo ya no mutilaba esa línea.');
  assert.equal(soloCodigo(linea, 'meta-guard-mutaciones.mjs').includes('visto = true'), true,
    '🔴 el mecanismo también la mutila.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL SUELO DEL HELPER COMPARTIDO — lo más caro que hay aquí
//
// `_solo-codigo.mjs` lo importan ya decenas de guards. Eso no es reutilización: es un PUNTO
// ÚNICO DE FALLO para decenas de protecciones. Si un día devuelve algo peor sin decirlo, no cae
// un guard: se apagan todos a la vez, y la tanda sale MÁS VERDE que antes.
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-694b · 🔴 el helper REVIENTA si le dan algo que no es un fuente', () => {
  // Antes hacía `String(fuente ?? '')`: con `undefined` devolvía la cadena vacía y una lista
  // vacía, en silencio. Y los guards que llaman aquí preguntan casi siempre en NEGATIVO —«esto
  // no aparece», «esto no se pinta»—, preguntas que sobre la nada se contestan solas que todo
  // va bien. Vacío y no-medido se leen igual y significan lo contrario.
  for (const nada of [undefined, null, 0, Buffer.from('const a = 1;'), { }]) {
    assert.throws(() => soloCodigo(nada),
      /no un fuente/,
      '🔴 soloCodigo(' + String(nada) + ') no ha reventado. Devolver vacío aquí apaga en VERDE a '
      + 'todos los guards que dependen de esto.');
    assert.throws(() => literalesDe(nada), /no un fuente/,
      '🔴 literalesDe(' + String(nada) + ') no ha reventado: devolver la lista vacía hace que '
      + '«¿se pinta este texto?» se conteste que NO sin haber mirado.');
  }
});

test('SCRUM-694b · el helper SIGUE aceptando lo legítimo', () => {
  // Un suelo que también tumba los casos buenos no es un suelo, es un estorbo.
  assert.equal(soloCodigo(''), '');
  assert.deepEqual(literalesDe(''), []);
  const conUrl = 'const u = "http://x.com/a//b"; // esto sí es un comentario';
  assert.equal(soloCodigo(conUrl).includes('http://x.com/a//b'), true,
    '🔴 el mecanismo se come una URL con `//` en la RUTA.');
  assert.equal(soloCodigo(conUrl).includes('esto sí es un comentario'), false,
    '🔴 el mecanismo ha dejado de quitar comentarios.');
});

test('SCRUM-694b · 🔴 el helper responde de su propia salida sobre TODO el árbol', () => {
  // El contrato que su cabecera promete —misma longitud, mismas líneas, y lo único que cambia
  // son comentarios convertidos en espacios— estaba prometido pero NO verificado. Importa
  // porque los guards acotan bloques con `slice(indexOf(…))`: si los índices se descolocan,
  // cada uno mide un trozo que no es el suyo y no se entera. Ahora el propio módulo revienta si
  // no puede responder; esto comprueba que sobre el árbol real no revienta ni una vez.
  const ficheros = [];
  (function anda(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) anda(p);
      else if (/\.(js|ts|mjs|cjs)$/.test(e.name)) ficheros.push(p);
    }
  })(path.join(RAIZ, 'src'));
  for (const d of ['tests', 'scripts', 'public']) {
    (function anda(x) {
      for (const e of fs.readdirSync(x, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name === '.git') continue;
        const p = path.join(x, e.name);
        if (e.isDirectory()) anda(p);
        else if (/\.(js|ts|mjs|cjs)$/.test(e.name)) ficheros.push(p);
      }
    })(path.join(RAIZ, d));
  }

  // SUELO del suelo: si el recorrido no encontrara ficheros, el bucle de abajo pasaría vacío.
  assert.ok(ficheros.length > 500,
    '🔴 el recorrido sólo ve ' + ficheros.length + ' ficheros. Un bucle vacío no comprueba nada.');

  const rotos = [];
  for (const p of ficheros) {
    try { soloCodigo(fs.readFileSync(p, 'utf8'), path.basename(p)); }
    catch (e) { rotos.push(path.relative(RAIZ, p) + ' :: ' + String(e.message).slice(0, 120)); }
  }
  assert.deepEqual(rotos, [],
    '🔴 el mecanismo no puede responder de lo que devuelve en ' + rotos.length + ' fichero(s). '
    + 'Cada uno es un guard midiendo un trozo que no es el suyo:\n  ' + rotos.slice(0, 5).join('\n  '));
});
