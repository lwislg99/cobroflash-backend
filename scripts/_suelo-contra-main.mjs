// scripts/_suelo-contra-main.mjs — SCRUM-810
//
// ╔══════════════════════════════════════════════════════════════════════════════════════════╗
// ║ Un suelo que sólo se dispara cuando ya se ha perdido la mitad no es un suelo: es una lápida ║
// ╚══════════════════════════════════════════════════════════════════════════════════════════╝
//
// ── LO MEDIDO (7-sep-2026) ────────────────────────────────────────────────────────────────
// `SUELO_GUARDS = 20` y `SUELO_DECLARACIONES = 54` se escribieron cuando el árbol tenía por ahí.
// El 7-sep-2026 tenía **41 guards y 117 declaraciones**. Provocado quitando declaraciones una a una
// sobre una copia del árbol: **el suelo habla en la 64ª**. Sesenta y tres declaraciones —el
// **54%** de la vigilancia— pueden desaparecer sin que nada lo diga.
//
// ── DE QUÉ SE DERIVA EL SUELO, Y POR QUÉ ─────────────────────────────────────────────────
// Tres candidatos, y los dos primeros están descartados por construcción:
//
//   ① Un número CABLEADO es un censo congelado el día que se escribió. Es lo que hay hoy, y
//      medido arriba: se queda 63 declaraciones por detrás sin que nadie se entere.
//
//   ② Derivarlo de LA POBLACIÓN DE HOY es circular: lo que el suelo vigila ES la población, así
//      que un suelo calculado desde ella nunca puede hablar. Cero sobre población vacía no es
//      un cero, y un suelo que se recalcula solo no es un suelo: es un espejo.
//
//   ③ ✅ Derivarlo de **`origin/main`**, y POR GUARD. Rompe el círculo porque main es un árbol
//      DISTINTO del que se está juzgando. Y resuelve el filo que el encargo pone encima de la
//      mesa —«¿qué pasa cuando alguien retira una declaración legítimamente?»— así:
//
//        · CRECER es gratis. Añadir guards o declaraciones no dispara NADA. Un suelo que salta
//          en cada PR se desactiva antes que uno que no salta nunca.
//        · PERDER habla a la PRIMERA. No hace falta perder 63: con que un guard que declaraba
//          tres pase a declarar dos, el suelo lo dice y nombra cuál.
//        · RETIRAR A PROPÓSITO se puede, y cuesta UNA LÍNEA: se apunta el guard en
//          `RETIRADAS_A_PROPOSITO` con su motivo, en el mismo commit. El diff lo dice en voz
//          alta, que es exactamente lo que el mensaje del suelo viejo ya pedía y nadie hacía.
//        · Y NO CADUCA: main se mueve solo, así que la referencia se pone al día sin que nadie
//          se acuerde de subir un número.
//
// ── POR QUÉ ESTO NO PISA A SCRUM-757 ──────────────────────────────────────────────────────
// El lector de declaraciones NO se toca (prohibición explícita). Aquí sólo se LEE lo que él
// devuelve, en dos árboles, y se restan. La pérdida por declaración INCOMPLETA ya la denuncia
// SCRUM-745; ésta es la otra mitad: la declaración que desaparece ENTERA.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { lecturaDeDeclaraciones } from './meta-guard-mutaciones.mjs';
import { temporal } from '../tests/_temporal.mjs'; // SCRUM-864 · el temporal se borra pase lo que pase

export const RAMA_DE_REFERENCIA = 'origin/main';

/**
 * La referencia NO es la punta de main: es la BASE DE FUSIÓN entre esta rama y main.
 *
 * 🔴 Lo cazó el control positivo la primera vez que se corrió: esta rama salió de un main
 * anterior, main avanzó (se mezcló SCRUM-804 con sus 3 declaraciones), y el suelo cantó
 * «has perdido 3» cuando esta rama no había perdido nada — sólo iba por detrás. Contra la
 * punta, TODA rama que no acabe de nacer sale roja, y un suelo que salta siempre se desactiva.
 * Contra la base de fusión se mide sólo lo que ESTA rama hizo, que es de lo que responde.
 *
 * Devuelve `null` si no se puede saber: no haber mirado no se devuelve como «no falta nada».
 */
export function referenciaDe(raiz = process.cwd()) {
  const prueba = (args) => {
    try {
      return execFileSync('git', args, { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() || null;
    } catch { return null; }
  };
  return prueba(['merge-base', 'HEAD', RAMA_DE_REFERENCIA])
    ?? prueba(['rev-parse', '--verify', RAMA_DE_REFERENCIA]);
}

/**
 * Retiradas DELIBERADAS de cobertura. Una línea por guard, con su motivo y su fecha.
 * Mientras esté aquí, el suelo no se queja de ese guard. Vaciar la lista es gratis; llenarla
 * cuesta un renglón que el revisor del PR ve.
 */
export const RETIRADAS_A_PROPOSITO = [
  // { guard: 'scrumNNN-lo-que-sea.test.mjs', motivo: 'por qué se retiró', fecha: '2026-09-07' },
  //
  // 🔴 SCRUM-867 · LAS DOS POBLACIONES BAJAN UNA PORQUE SE RETIRÓ UN FICHERO, Y ESO SE DICE AQUÍ.
  // `public/dashboard/js/nuevaFacturaModal.js` estaba MUERTO —nadie lo abría desde que la lista de
  // Facturas navega a `invoices-new`— pero el índice lo cargaba y el SHELL lo precacheaba, así que
  // el navegador se bajaba y ejecutaba 266 líneas en cada visita. Medido con suelo en
  // `docs/master/evidencias/SCRUM-867/censo-modal-muerto.mjs`; el guard que impide que vuelva es
  // `tests/scrum867-el-modal-muerto.test.mjs`. No es cobertura perdida: es una pantalla menos.
  { guard: 'ficheros-js-de-public', motivo: 'SCRUM-867: se retiró `nuevaFacturaModal.js`, muerto por uso y vivo por carga (95 → 94)', fecha: '2026-09-16', antes: 95, ahora: 94 },
  { guard: 'scripts-del-dashboard', motivo: 'SCRUM-867: el mismo fichero sale del índice y del SHELL del service worker a la vez, porque `cache.addAll` es atómico (92 → 91)', fecha: '2026-09-16', antes: 92, ahora: 91 },
  // 🔴 SCRUM-773 · SE RETIRA `tests/scrum650c-backfill-equivalencia.test.mjs` ENTERO (6 test()),
  // porque el script que verificaba (`scripts/backfill-job-assignees.mjs`) se retira con él:
  // decisión del fundador (Jira 16264) tras medir que no desbloquea nada hoy (docs/master/SCRUM-773.md,
  // apéndice 773c). No es cobertura perdida sobre código vivo: es un test sin sujeto.
  { guard: 'tests-declarados', motivo: 'SCRUM-773: se retiran el script backfill-job-assignees.mjs y su test scrum650c (6 test) — sin script no hay qué verificar (7802 → 7796)', fecha: '2026-09-22', antes: 7802, ahora: 7796 },
  { guard: 'scrum813-trinquete-de-zona.test.mjs', motivo: 'SCRUM-935d: ㉓ ㉔ se MUDAN a scrum1494-cortados-de-zona, no se retiran (26 → 24)', fecha: '2026-10-22', antes: 26, ahora: 24 },
  { guard: 'tests-declarados', motivo: 'SCRUM-1250b: se desmontan POST /admin/invoices/:id/pay y /unpay; sus 4 test de scrum1455b (decimal+control) se retiran con las rutas y se añaden 2 en scrum1250b (12419 → 12417)', fecha: '2026-10-24', antes: 12419, ahora: 12417 },
];

// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 SCRUM-1173 · UNA RETIRADA EXIME SU BAJA, NO LA POBLACIÓN, Y CADUCA AL ENTRAR EN LA BASE.
//
// Hasta aquí bastaba con que el guard apareciera en la lista para eximirlo ENTERO y PARA
// SIEMPRE: el 27-sep, 3 de las 4 poblaciones derivadas (`tests-declarados` incluida) estaban
// exentas por bajas de septiembre. Medido el 15-oct sobre `main` e8d27c63: borrar un fichero de
// tests entero, sin declararlo, dejaba `scrum810b` en verde 2 de 2. «Esta baja está justificada»
// se había convertido en «cualquier baja futura lo está».
//
// Ahora una retirada:
//   · declara su baja con NÚMEROS (`antes`, `ahora`), y sólo exime una baja de ese tamaño como
//     mucho — una mayor habla, aunque sea en la misma población;
//   · vale sólo mientras está PENDIENTE: en cuanto la base de fusión ya la lleva en su lista, la
//     baja está en la base y no hay nada que eximir. Se reconoce por `guard` + `fecha`;
//   · sin números, o si no se puede leer la lista de la base, NO exime nada (fail-closed).
// ══════════════════════════════════════════════════════════════════════════════════════════

/** Una retirada se reconoce por su guard y su fecha: añadirle los números no la hace nueva. */
const claveDeRetirada = (r) => `${r.guard}|${r.fecha}`;

/**
 * Las retiradas que declara un fuente de este mismo fichero, leídas por AST (nunca por regex:
 * A23 nº 5). `null` si no se encuentra la lista o tiene algo que no es un literal: un fuente que
 * no se sabe leer NO es una lista vacía.
 */
export function leerRetiradas(texto) {
  const sf = ts.createSourceFile('suelo.mjs', texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let lista = null;
  const visitar = (n) => {
    if (lista) return;
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'RETIRADAS_A_PROPOSITO'
      && n.initializer && ts.isArrayLiteralExpression(n.initializer)) {
      lista = n.initializer;
      return;
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  if (!lista) return null;
  const out = [];
  for (const el of lista.elements) {
    if (!ts.isObjectLiteralExpression(el)) return null;
    const r = {};
    for (const p of el.properties) {
      if (!ts.isPropertyAssignment(p) || !ts.isIdentifier(p.name)) return null;
      const v = p.initializer;
      if (ts.isStringLiteral(v) || ts.isNoSubstitutionTemplateLiteral(v)) r[p.name.text] = v.text;
      else if (ts.isNumericLiteral(v)) r[p.name.text] = Number(v.text);
      else return null;
    }
    out.push(r);
  }
  return out;
}

/** Las retiradas de la lista de hoy que la base todavía NO lleva. Fail-closed: sin base, ninguna. */
export function pendientesFrente(actuales, deLaBase) {
  if (!Array.isArray(deLaBase)) return [];
  const yaEnLaBase = new Set(deLaBase.map(claveDeRetirada));
  return actuales.filter((r) => !yaEnLaBase.has(claveDeRetirada(r)));
}

let pendientesCacheadas = null;
/** Las retiradas pendientes contra la base de fusión de este árbol (una vez por proceso). */
export function retiradasPendientes(raiz = process.cwd()) {
  if (pendientesCacheadas) return pendientesCacheadas;
  const base = referenciaDe(raiz);
  let deLaBase = null;
  if (base) {
    try {
      deLaBase = leerRetiradas(execFileSync('git', ['show', `${base}:scripts/_suelo-contra-main.mjs`],
        { cwd: raiz, encoding: 'utf8', maxBuffer: 1 << 24, stdio: ['ignore', 'pipe', 'pipe'] }));
    } catch { deLaBase = null; }
  }
  pendientesCacheadas = pendientesFrente(RETIRADAS_A_PROPOSITO, deLaBase);
  return pendientesCacheadas;
}

/**
 * ¿Cubren las retiradas declaradas para `nombre` la variación `antes → ahora`? Sólo en la
 * dirección que viola, y sólo hasta la suma de lo que declaran. Sin números no cubren nada.
 */
export function cubiertoPorRetiradas(nombre, antes, ahora, retiradas, direccion = 'no-encoger') {
  const signo = direccion === 'no-crecer' ? -1 : 1; // no-encoger: lo que viola es BAJAR
  const exceso = signo * (antes - ahora);
  // Lo que no viola no se «cubre»: decidirlo es de quien llama. Devolver `true` aquí duplicaba esa
  // decisión, y la mutación de «CRECER» de scrum810/810b dejaba de caer (medido, SCRUM-1173).
  if (exceso <= 0) return false;
  const declarado = retiradas
    .filter((r) => r.guard === nombre && Number.isFinite(r.antes) && Number.isFinite(r.ahora))
    .map((r) => signo * (r.antes - r.ahora))
    .filter((d) => d > 0)
    .reduce((s, d) => s + d, 0);
  return exceso <= declarado;
}

/** Los ficheros CANDIDATOS de una ref. El grep sólo preselecciona: quien cuenta es el AST. */
function candidatosEn(ref, raiz) {
  try {
    const t = execFileSync('git', ['grep', '-l', 'MUTACIONES_QUE_ME_TUMBAN', ref, '--', 'tests/'],
      { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    // `git grep` con una ref antepone `<ref>:` a cada ruta. Se le quita por PREFIJO CONOCIDO, no
    // partiendo por el primer `:` — eso último es la forma de la partición `<metodo>:<pasarela>`
    // que vigila SCRUM-474, y no hay por qué escribir aquí una tercera implementación de aquello.
    const prefijo = `${ref}:`;
    return t.split('\n').map((l) => l.trim()).filter(Boolean)
      .map((l) => (l.startsWith(prefijo) ? l.slice(prefijo.length) : l))
      .filter((p) => p.endsWith('.test.mjs'));
  } catch (e) {
    if (e.status === 1) return []; // git grep sin coincidencias
    return null; // no se pudo mirar: eso NO es «no hay ninguna»
  }
}

/**
 * Declaraciones COMPLETAS por guard en una ref de git. `null` si no se pudo mirar la ref —
 * un fallo al mirar no se devuelve como cero (regla de la casa: cero sobre población vacía
 * no es un cero).
 */
export function declaracionesEn(ref, raiz = process.cwd()) {
  const rutas = candidatosEn(ref, raiz);
  if (rutas === null) return null;
  const porGuard = new Map();
  for (const rel of rutas) {
    let texto;
    try {
      texto = execFileSync('git', ['show', `${ref}:${rel}`],
        { cwd: raiz, encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch { continue; }
    const n = lecturaDeDeclaraciones(texto, path.basename(rel)).buenas.length;
    if (n > 0) porGuard.set(path.basename(rel), n);
  }
  return porGuard;
}

/** Declaraciones COMPLETAS por guard en el árbol de trabajo. */
export function declaracionesEnElArbol(raiz = process.cwd()) {
  const dir = path.join(raiz, 'tests');
  const porGuard = new Map();
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.test.mjs')) continue;
    const n = lecturaDeDeclaraciones(fs.readFileSync(path.join(dir, f), 'utf8'), f).buenas.length;
    if (n > 0) porGuard.set(f, n);
  }
  return porGuard;
}

/**
 * Qué cobertura se ha PERDIDO respecto a la referencia. Crecer nunca aparece aquí.
 * Devuelve `{ medible, perdidas, motivo }`. Si la referencia no se pudo mirar, `medible: false`
 * y NO se inventa un veredicto.
 */
export function perdidasContraLaReferencia(actual, referencia, retiradas = retiradasPendientes()) {
  if (!referencia) {
    return {
      medible: false,
      perdidas: [],
      motivo: `no pude leer la referencia (base de fusión con ${RAMA_DE_REFERENCIA}): `
        + 'esto NO dice que no falte nada, dice que no he mirado.',
    };
  }
  const perdidas = [];
  for (const [guard, antes] of referencia) {
    const ahora = actual.get(guard) || 0;
    // SCRUM-1173 · la retirada exime SU baja (con números y pendiente), no el guard entero.
    if (ahora < antes && !cubiertoPorRetiradas(guard, antes, ahora, retiradas)) perdidas.push({ guard, antes, ahora });
  }
  perdidas.sort((a, b) => (b.antes - b.ahora) - (a.antes - a.ahora) || a.guard.localeCompare(b.guard));
  return { medible: true, perdidas, motivo: null };
}

/** El texto del suelo, o `null` si no hay nada que decir. */
export function sueloContraMain({ medible, perdidas, motivo }) {
  if (!medible) return null; // no medible NO es rojo: lo canta quien llama, con su propio hueco
  if (perdidas.length === 0) return null;
  const total = perdidas.reduce((s, p) => s + (p.antes - p.ahora), 0);
  return `SE HA PERDIDO VIGILANCIA CONTRA LA BASE DE FUSIÓN con ${RAMA_DE_REFERENCIA}: `
    + `${total} declaración(es) en ${perdidas.length} guard(s).\n`
    + perdidas.map((p) => `  · ${p.guard}: ${p.antes} → ${p.ahora}`).join('\n')
    + '\n  Si la retirada es A PROPÓSITO, apunta el guard en RETIRADAS_A_PROPOSITO con su motivo,\n'
    + '  EN EL MISMO COMMIT, y que el diff lo diga en voz alta. Si no lo es, la has perdido sin verla.';
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// SEGUNDA VUELTA · el MISMO mecanismo para cualquier población, no sólo para las declaraciones
// ══════════════════════════════════════════════════════════════════════════════════════════
//
// Lo de arriba compara declaraciones por guard. Lo de abajo hace LO MISMO con cualquier censo,
// y por eso vive aquí y no en un fichero parecido: dos implementaciones de la misma derivación
// son regla 2, y dentro de seis meses una está rota.
//
// ── LO QUE HIZO FALTA PARA GENERALIZARLO ──────────────────────────────────────────────────
// Una población que no sea un hecho del árbol (contar ficheros) hay que CALCULARLA, y hay que
// calcularla con el censo de HOY sobre el árbol de la BASE — no con el censo de entonces, o se
// confundiría «la población encogió» con «el censo cambió». Así que la base se materializa.

/** Las dos direcciones. Un TOPE es el mismo trinquete del revés: lo que viola es CRECER. */
export const DIRECCIONES = {
  'no-encoger': {
    viola: (ahora, antes) => ahora < antes,
    verbo: 'PERDIDO', consejo: 'la has perdido sin verla',
  },
  'no-crecer': {
    viola: (ahora, antes) => ahora > antes,
    verbo: 'CRECIDO', consejo: 'ha crecido sin que nadie lo decidiera',
  },
};

/**
 * Materializa el árbol de la BASE DE FUSIÓN en un directorio temporal y devuelve su ruta.
 * `null` si no se puede: no haber podido mirar NO se devuelve como un árbol vacío.
 *
 * Se cachea por SHA, así que la segunda llamada es gratis. Es una extracción de SÓLO LECTURA de
 * un commit del propio repositorio: no es «otro árbol de trabajo», no lleva metadatos de git y
 * no toca `.git/worktrees` — que es lo que sí compartiría con las demás sesiones.
 */
const yaExtraidos = new Map(); // caché DENTRO del proceso: la de disco no puede existir (ver abajo)

export function arbolDeLaBase(raiz = process.cwd(), base = null) {
  const sha = base ?? referenciaDe(raiz);
  if (!sha) return null;
  if (yaExtraidos.has(sha)) return yaExtraidos.get(sha);
  // 🔴 `mkdtemp`, NO una ruta fija con el SHA dentro. Lo cazó SCRUM-258: en esta máquina hay
  // CINCO árboles de trabajo, y dos en la misma base habrían compartido el mismo directorio del
  // temporal — que es exactamente el defecto de la nota de turno que aquel ticket persigue.
  // El precio es no poder cachear entre procesos: 1,6 s por proceso. Barato al lado de que dos
  // sesiones se pisen un árbol.
  const destino = temporal('yaqu-base-');
  const testigo = path.join(destino, 'package.json');
  const tar = path.join(destino, 'arbol.tar');
  try {
    execFileSync('git', ['archive', '--format=tar', '-o', tar, sha], { cwd: raiz, stdio: 'ignore' });
    // 🔴 `--force-local`: sin él, GNU tar lee `C:\Users\…` como `host:ruta` y contesta
    // «Cannot connect to C: resolve failed». En Windows no es opcional.
    execFileSync('tar', ['--force-local', '-xf', tar, '-C', destino], { stdio: 'ignore' });
  } catch {
    try { fs.rmSync(destino, { recursive: true, force: true }); } catch { /* temporal */ }
    return null;
  } finally {
    try { fs.rmSync(tar, { force: true }); } catch { /* temporal */ }
  }
  const vale = fs.existsSync(testigo) ? destino : null;
  if (!vale) { try { fs.rmSync(destino, { recursive: true, force: true }); } catch { /* temporal */ } }
  yaExtraidos.set(sha, vale);
  return vale;
}

// Lo que se crea en el temporal se recoge al salir: un árbol de 63 MB por proceso se acumula.
process.on('exit', () => {
  for (const d of yaExtraidos.values()) {
    if (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* temporal */ } }
  }
});

/**
 * Un suelo DERIVADO: compara la población de HOY con la de la base, con el censo de hoy en los
 * dos lados. Devuelve `{ medible, ahora, antes, motivo }` — y jamás un veredicto inventado.
 *
 * `censo` recibe una raíz y devuelve un número. Si revienta en cualquiera de los dos árboles,
 * el resultado es NO MEDIBLE: un censo que falla no es una población de cero.
 */
export function poblacionesContraLaBase(nombre, censo, raiz = process.cwd()) {
  const base = arbolDeLaBase(raiz);
  if (!base) return { nombre, medible: false, motivo: `no pude materializar la base de fusión con ${RAMA_DE_REFERENCIA}` };
  let ahora; let antes;
  try { ahora = censo(raiz); } catch (e) { return { nombre, medible: false, motivo: `el censo revienta en el árbol: ${e.message}` }; }
  try { antes = censo(base); } catch (e) { return { nombre, medible: false, motivo: `el censo revienta en la base: ${e.message}` }; }
  if (!Number.isFinite(ahora) || !Number.isFinite(antes)) {
    return { nombre, medible: false, motivo: 'el censo no devolvió un número en alguno de los dos árboles' };
  }
  return { nombre, medible: true, ahora, antes, motivo: null };
}

/**
 * El texto de un suelo derivado, o `null` si no hay nada que decir.
 * Crecer (o menguar, según la dirección) es gratis: sólo habla la violación.
 */
export function sueloDerivado(medida, direccion = 'no-encoger', retiradas = retiradasPendientes()) {
  if (!medida.medible) return null;
  const dir = DIRECCIONES[direccion];
  if (!dir) throw new RangeError(`dirección desconocida: ${direccion}`);
  if (!dir.viola(medida.ahora, medida.antes)) return null;
  // SCRUM-1173 · antes bastaba con que el nombre estuviera en la lista: exento entero y para siempre.
  if (cubiertoPorRetiradas(medida.nombre, medida.antes, medida.ahora, retiradas, direccion)) return null;
  return `LA POBLACIÓN «${medida.nombre}» HA ${dir.verbo} CONTRA LA BASE DE FUSIÓN: `
    + `${medida.antes} → ${medida.ahora}.\n`
    + `  Si es A PROPÓSITO, apúntala en RETIRADAS_A_PROPOSITO con su motivo, EN EL MISMO COMMIT,\n`
    + `  y que el diff lo diga en voz alta. Si no lo es, ${dir.consejo}.`;
}
