// scripts/censo-internos-de-prisma.mjs — SCRUM-742
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// ¿CUÁNTO DE ESTA CASA DEPENDE DE COSAS DE PRISMA QUE PRISMA NO PROMETE?
//
// Uso:  npm run censo:internos-prisma        (solo lee; no escribe un byte, no ejecuta prisma)
//
// ── DE DÓNDE SALE ────────────────────────────────────────────────────────────────────────────
// `prisma generate` avisa en CADA ejecución de que `package.json#prisma` está deprecado y
// desaparece en Prisma 7. La pregunta obvia —«¿y qué más nuestro se apoya en internos de
// Prisma?»— se venía contestando de memoria, con un «media docena» que nadie había contado.
//
// ⛔ ESTO NO SUBE NINGUNA VERSIÓN Y NO ARREGLA NADA. Las dependencias las decide el fundador
// (regla 36). Esto pone la lista delante para que la decisión se tome con ella y no con una
// impresión. Misma forma que `scripts/diagnostico-dependencias.mjs`: mide y calla.
//
// ── POR QUÉ NO ES UN `grep`, Y ESTÁ MEDIDO ───────────────────────────────────────────────────
// El sitio natural donde se escribe el nombre de un interno es **el comentario que explica por
// qué se usa**. Medido en este mismo censo: `Prisma.dmmf` aparece en 11 ficheros por texto y en
// **10** de verdad — `scripts/_pares-del-schema.mjs` sólo lo nombra en su cabecera (l. 9), donde
// explica de dónde saca el censo el OTRO camino. Un `grep` habría abierto un ticket sobre un
// fichero que no toca el DMMF.
//
// Así que se filtra con `soloEjecutable` (SCRUM-700/719), que es el sitio ÚNICO de la casa para
// esto, en vez de escribir el filtro número 95. No se usa AST porque `src/` es TypeScript y
// acorn no lo parsea; y `ts.createScanner` a pelo tampoco sirve — medido en SCRUM-700, ve 148 de
// los 352 comentarios de `src/app.ts`.
//
// ── LO QUE ESTE CENSO NO CONTESTA ────────────────────────────────────────────────────────────
// **Qué pasa exactamente en Prisma 7 con cada uno de estos internos.** Eso no se deduce del
// árbol y no se inventa aquí: lo único que esta máquina puede afirmar es lo que el CLI INSTALADO
// dice de sí mismo. La clasificación por riesgo, con su evidencia y sus huecos, vive en
// `docs/CENSO_INTERNOS_PRISMA.md`.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { soloEjecutable } from '../tests/_guard-texto.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DIRECTORIOS = ['src', 'scripts', 'tests'];

/**
 * Contra qué se ha medido. Va en la salida porque un censo de superficie interna **caduca con la
 * versión**: lo que hoy es interno-pero-existe puede no existir en la siguiente, y un número sin
 * su versión al lado no se puede volver a comprobar.
 */
const requireDelRepo = createRequire(path.join(RAIZ, 'x.js'));
export const VERSIONES = ['prisma', '@prisma/client', '@prisma/engines', '@prisma/config', '@prisma/internals']
  .map((nombre) => {
    try { return { nombre, version: requireDelRepo(nombre + '/package.json').version }; }
    catch { return { nombre, version: '(no instalado)' }; }
  });

/**
 * LO QUE SE BUSCA, y por qué cada uno está en su casilla.
 *
 * `publico` = Prisma lo documenta como API. Los públicos se cuentan A PROPÓSITO: son el CONTROL
 * NEGATIVO del censo. Si el barrido no encontrara ninguno estaría mirando mal, porque esta casa
 * usa `PrismaClient` en cientos de sitios.
 */
export const SUPERFICIES = Object.freeze([
  {
    id: 'dmmf',
    publico: false,
    que: 'Prisma.dmmf — el modelo de datos compilado dentro del cliente generado',
    patron: /\bPrisma\s*\.\s*dmmf\b/,
  },
  {
    id: 'fichero-del-cliente',
    publico: false,
    que: 'un FICHERO de dentro del cliente generado (p. ej. .prisma/client/schema.prisma)',
    patron: /['"`]\.prisma\/client['"`]|\.prisma[\\/]client[\\/]/,
  },
  {
    id: 'paquete-interno',
    publico: false,
    que: 'un paquete/ruta interna de Prisma (@prisma/internals, @prisma/engines, runtime/…)',
    patron: /@prisma\/(internals|engines|debug|generator-helper)\b|@prisma\/client\/runtime\b/,
  },
  {
    id: 'ruta-del-cli',
    publico: false,
    que: 'nombra la RUTA del CLI dentro de node_modules (prisma/build/index.js, .bin/prisma)',
    patron: /prisma[\\/]build[\\/]index\.js|['"]prisma['"]\s*,\s*['"]build['"]\s*,\s*['"]index\.js['"]|\.bin[\\/]prisma\b|['"]\.bin['"]\s*,\s*['"]prisma['"]/,
  },
  {
    id: 'cli-invocado',
    publico: false,
    que: 'LANZA el CLI de Prisma como proceso: su salida y sus códigos son contrato de facto',
    // 🔴 DOS VECES APRETADO, y las dos por medir en vez de creerme el número.
    //
    // ① La primera versión buscaba la palabra `prisma` a secas y dio 22, metiendo en el mismo
    //    saco a quien EJECUTA el CLI y a quien lo escribe en un mensaje de ayuda al fundador.
    // ② La segunda exigía una llamada `spawn`/`exec` con `prisma` en una ventana de 220 caracteres
    //    y dio 5, de los cuales **CUATRO eran falsos** al mirarlos a mano: un `regex.exec()` con
    //    la palabra cerca, dos ficheros de test cuyas *cadenas de ejemplo* contienen
    //    `spawn('prisma', …)`, y un `spawnSync` que lanza un script PROPIO del repo.
    //
    // ③ La tercera exigía la ruta en una ventana HACIA DELANTE y perdió `_prisma-sync.mjs`: la
    //    ruta se arma en la línea de ANTES y el `spawnSync` sólo dice `cli`.
    // ④ La cuarta miró a los dos lados con 300 caracteres y perdió `preview-migracion.mjs`: allí
    //    la ruta la devuelve OTRA FUNCIÓN (`rutaCliLocal`, l. 63) y el `spawnSync` está en la 74.
    //
    // 🔴 LAS DOS ERAN FALSOS NEGATIVOS, que son los que no se notan: el censo habría dicho «dos»
    // y luego «tres», y son CUATRO. Una ventana no puede seguir un valor que cruza funciones, y
    // ensancharla hasta que quepa es elegir el número que uno quiere.
    //
    // Así que se deja de adivinar la distancia: la condición es **de FICHERO** —nombra la ruta
    // del CLI Y llama a la familia `spawn`—, que es tosca pero no se equivoca en silencio, y son
    // CINCO ficheros. Se revisaron los cinco A MANO, uno a uno, antes de publicar el número; y el
    // censo los imprime para que el siguiente pueda repetir esa revisión en dos minutos.
    detector: (codigo) => {
      const RUTA = /prisma[\\/]build[\\/]index\.js|['"]prisma['"]\s*,\s*['"]build['"]|\.bin[\\/]prisma|['"]\.bin['"]\s*,\s*['"]prisma['"]/;
      const LLAMADA = /\b(spawnSync|spawn|execFileSync|execSync|execFile)\s*\(/;
      return RUTA.test(codigo) && LLAMADA.test(codigo);
    },
  },
  {
    id: 'cli-nombrado-en-un-mensaje',
    publico: false,
    cuenta: false,   // NO suma al total de dependencias: es prosa, no acoplamiento
    que: 'escribe un comando de Prisma en un texto (instrucción al fundador, mensaje de un guard)',
    patron: /['"`][^'"`\n]{0,60}\b(npx\s+)?prisma\s+(generate|db\s+push|db\s+execute|migrate\s+diff|migrate\s+dev|studio)\b/,
  },
  {
    id: 'api-publica',
    publico: true,
    que: 'API pública: PrismaClient, errores tipados, Decimal, $transaction…',
    patron: /\bnew\s+PrismaClient\b|\bPrismaClientKnownRequestError\b|\bPrisma\s*\.\s*Decimal\b|\$transaction\b/,
  },
]);

/**
 * 🔴 EL CENSO NO SE CUENTA A SÍ MISMO, y hay que decirlo en vez de que se note.
 *
 * Sus patrones son literales de expresión regular en código ejecutable, así que la primera
 * versión se encontró a sí misma en CUATRO superficies —`dmmf`, el fichero del cliente, el
 * paquete interno y el CLI— sin tocar ninguna. Un instrumento que aparece en su propia medición
 * la infla y, peor, la infla justo donde uno querría creerse el número.
 */
export const SE_EXCLUYE = 'scripts/censo-internos-de-prisma.mjs';

/** Todos los ficheros de código de los directorios censados. */
export function ficherosDelArbol(raiz = RAIZ, dirs = DIRECTORIOS) {
  const out = [];
  const rec = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') rec(p); continue; }
      if (/\.(ts|mjs|js)$/.test(e.name) && !/\.d\.ts$/.test(e.name)) out.push(p);
    }
  };
  for (const d of dirs) rec(path.join(raiz, d));
  return out.sort();
}

/**
 * La superficie que NO vive en el código: el bloque `prisma` de `package.json`.
 *
 * Es la única que hoy tiene fecha de caducidad DICHA POR PRISMA, y no la habría visto un censo de
 * ficheros de código — está en la configuración, no en un `.ts`. Se mide leyendo el fichero, y el
 * aviso se cita del CLI INSTALADO (`@prisma/config`), no de memoria.
 */
export function bloquePrismaDePackageJson(raiz = RAIZ) {
  const p = path.join(raiz, 'package.json');
  if (!fs.existsSync(p)) return { existe: false, motivo: 'no hay package.json' };
  const pkg = JSON.parse(fs.readFileSync(p, 'utf8'));
  const bloque = pkg.prisma ?? null;
  let avisoDelCli = null;
  try {
    const cfg = requireDelRepo.resolve('@prisma/config/package.json');
    const dist = path.join(path.dirname(cfg), 'dist', 'index.js');
    const m = fs.readFileSync(dist, 'utf8').match(/is deprecated and will be removed in Prisma \d+/);
    avisoDelCli = m ? m[0] : null;
  } catch { /* sin @prisma/config: se declara abajo */ }
  return { existe: bloque !== null, claves: bloque ? Object.keys(bloque) : [], avisoDelCli };
}

/**
 * Qué superficies toca UN fuente, sobre su parte EJECUTABLE.
 *
 * `crudo` se devuelve al lado a propósito: la diferencia entre lo que se ve en el texto y lo que
 * se ve en el código es el dato que justifica todo este fichero, y hay un test que la exige.
 */
export function superficiesDe(fuente, { filtro = soloEjecutable } = {}) {
  const codigo = filtro(String(fuente));
  const toca = [];
  const soloEnComentario = [];
  // `detector` gana a `patron` cuando existe: hay superficies —lanzar el CLI— que no se deciden
  // con una sola expresión, porque la evidencia puede estar antes o después de la llamada.
  const mira = (s, t) => (s.detector ? s.detector(t) : s.patron.test(t));
  for (const s of SUPERFICIES) {
    const enCodigo = mira(s, codigo);
    const enCrudo = mira(s, String(fuente));
    if (enCodigo) toca.push(s.id);
    else if (enCrudo) soloEnComentario.push(s.id);
  }
  return { toca, soloEnComentario };
}

/** El censo entero. Puro sobre una lista de `{ nombre, texto }`, para poder autoprobarlo. */
export function censar(entradas, opciones = {}) {
  const filas = [];
  for (const { nombre, texto } of entradas) {
    const { toca, soloEnComentario } = superficiesDe(texto, opciones);
    if (!toca.length && !soloEnComentario.length) continue;
    filas.push({ nombre, toca, soloEnComentario });
  }
  const porSuperficie = new Map(SUPERFICIES.map((s) => [s.id, { usan: [], soloNombran: [] }]));
  for (const f of filas) {
    for (const id of f.toca) porSuperficie.get(id).usan.push(f.nombre);
    for (const id of f.soloEnComentario) porSuperficie.get(id).soloNombran.push(f.nombre);
  }
  return { filas, porSuperficie };
}

// ── LA EJECUCIÓN ─────────────────────────────────────────────────────────────────────────────
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ficheros = ficherosDelArbol().filter((f) => path.relative(RAIZ, f).replace(/\\/g, '/') !== SE_EXCLUYE);
  const entradas = ficheros.map((f) => ({
    nombre: path.relative(RAIZ, f).replace(/\\/g, '/'),
    texto: fs.readFileSync(f, 'utf8'),
  }));
  const { porSuperficie } = censar(entradas);

  console.log('CENSO DE INTERNOS DE PRISMA · SCRUM-742');
  console.log('');
  console.log('POBLACIÓN: ' + ficheros.length + ' ficheros .ts/.mjs/.js en ' + DIRECTORIOS.join(', ')
    + '  (sin `.d.ts`, sin node_modules, y sin el propio censo — ver SE_EXCLUYE)');
  console.log('MEDIDO CONTRA LO INSTALADO: ' + VERSIONES.map((x) => x.nombre + ' ' + x.version).join(' · '));
  console.log('');

  let internos = 0;
  for (const s of SUPERFICIES) {
    const { usan, soloNombran } = porSuperficie.get(s.id);
    const cuenta = s.cuenta !== false && !s.publico;
    if (cuenta) internos += usan.length;
    console.log((s.publico ? '·· PÚBLICO  ' : cuenta ? '🟠 INTERNO  ' : '·· PROSA    ') + s.id + '  —  ' + s.que);
    console.log('     lo USAN: ' + usan.length
      + (s.publico && usan.length > 12 ? '  (control negativo: el barrido ve el uso normal)' : '')
      + (cuenta ? '' : '   (NO suma al total)'));
    const tope = s.publico || !cuenta ? 6 : usan.length;
    for (const f of usan.slice(0, tope)) console.log('        · ' + f);
    if (usan.length > tope) console.log('        … y ' + (usan.length - tope) + ' más');
    if (soloNombran.length) {
      console.log('     lo NOMBRAN sólo en comentario (NO cuentan): ' + soloNombran.length);
      for (const f of soloNombran.slice(0, 6)) console.log('        ~ ' + f);
      if (soloNombran.length > 6) console.log('        … y ' + (soloNombran.length - 6) + ' más');
    }
    console.log('');
  }

  // La superficie que no vive en el código.
  const bloque = bloquePrismaDePackageJson();
  console.log('🟠 INTERNO  config-en-package-json  —  el bloque `prisma` de package.json');
  console.log('     ¿existe en este repo? ' + (bloque.existe ? 'SÍ, con las claves [' + bloque.claves.join(', ') + ']' : 'no'));
  console.log('     lo que dice el CLI INSTALADO de él: ' + (bloque.avisoDelCli || '(no pude leerlo en @prisma/config)'));
  if (bloque.existe) internos += 1;
  console.log('');

  // 🔴 EL TOTAL QUE MANDA ES EL DE FICHEROS DISTINTOS, y el otro se dice al lado en vez de
  // publicarse solo: las superficies SE SOLAPAN a propósito —quien invoca el CLI nombra también
  // su ruta—, así que sumar columnas cuenta dos veces los mismos ficheros. Un «18» sin esa
  // aclaración se lee como dieciocho sitios y son catorce.
  const ficherosInternos = new Set(SUPERFICIES.filter((s) => s.cuenta !== false && !s.publico)
    .flatMap((s) => porSuperficie.get(s.id).usan));
  console.log('FICHEROS DISTINTOS que tocan superficie interna: ' + ficherosInternos.size
    + (bloque.existe ? '   (+ el bloque `prisma` de package.json, que no es un fichero de código)' : ''));
  console.log('pares (fichero × superficie): ' + internos
    + '   — mayor que el anterior porque las superficies se solapan: `cli-invocado` es un'
    + ' subconjunto de `ruta-del-cli`.');
  console.log('');
  console.log('La clasificación por riesgo y su evidencia: docs/CENSO_INTERNOS_PRISMA.md');
  console.log('⛔ Este censo NO sube versiones ni arregla nada. La decisión es del fundador (regla 36).');

  // ── SUELOS ─────────────────────────────────────────────────────────────────────────────────
  // Un cero aquí se leería como «no dependemos de nada de Prisma», que es lo contrario de la
  // verdad. Si el barrido no ve ni la población ni el uso PÚBLICO —que está en cientos de
  // sitios—, no ha mirado.
  const publicos = SUPERFICIES.filter((s) => s.publico).flatMap((s) => porSuperficie.get(s.id).usan).length;
  if (ficheros.length < 500) { console.error('\n🔴 SUELO: sólo ' + ficheros.length + ' ficheros en la población. NO SUPE MIRAR.'); process.exit(2); }
  if (publicos === 0) { console.error('\n🔴 SUELO: cero usos de la API PÚBLICA. Esta casa usa PrismaClient por todas partes: el barrido está ciego. NO SUPE MIRAR.'); process.exit(2); }
  if (internos === 0) { console.error('\n🔴 SUELO: cero usos internos. El propio `prisma generate` avisa de uno; si no se ve ninguno, el filtro se ha comido el fuente. NO SUPE MIRAR.'); process.exit(2); }
}
