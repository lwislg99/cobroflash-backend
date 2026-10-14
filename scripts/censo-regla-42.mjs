// scripts/censo-regla-42.mjs — SCRUM-804b
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// ⛔ SOLO LECTURA. NO CIERRA TICKETS, NO TOCA JIRA, NO BORRA NI RENOMBRA NINGUNA RAMA.
//
// La regla 42 dice que un ticket no se cierra mientras su rama siga sin mergear. Este censo
// contesta la pregunta de al lado: **¿qué tickets abiertos ya están DENTRO de `main`?**
//
// ── 🔴 POR CONTENIDO, NO POR EL NÚMERO DEL COMMIT ──────────────────────────────────────────
//
//   >>> Un commit que lleva el número no prueba que el trabajo esté;
//   >>> y un trabajo sin número puede estar entero. <<<
//
// Por eso el mensaje de commit **no decide**: corrobora. Lo que decide es si los ARTEFACTOS que
// el ticket dejó están en `main` — su entrada de registro y los ficheros que esa entrada nombra.
//
// ── EL EMPAREJAMIENTO DE RAMAS VA POR IDENTIDAD ────────────────────────────────────────────
//
// Lección de la propia SCRUM-804: `scrum-41` no puede casar dentro de `scrum-410`. Se exige que
// tras el número venga un separador, el final, o una letra de fase (`scrum-534d-…`).
// ═══════════════════════════════════════════════════════════════════════════════════════════
import { execFileSync } from 'node:child_process';

const git = (args) => {
  try {
    return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
};

// ── 🔴 SCRUM-1541 · `--is-ancestor` TIENE TRES RESPUESTAS, NO DOS ─────────────────────────────
//
// Sale 0 (es ancestro), 1 (no lo es) o 128 (git no pudo mirar: el sha no está en el almacén, o
// falta la ref). Hasta el 14-oct-2026 todo lo que no era 0 se leía «rama viva», y eso sólo era
// verdad porque el job obligatorio trae la historia ENTERA (`fetch-depth: 0`). En un clon de
// profundidad 1, medido ese día, las 105 ramas `scrum-N` del remoto dan 128 —también las 18 que
// están mergeadas—, y el censo sacaba FUERA un ticket que el clon completo saca DENTRO.
//
// La regla, y por qué cada rama:
//   · 0 → SÍ. Git encontró el camino: eso no lo inventa una historia cortada.
//   · clon SOMERO y cualquier otra cosa → NO SE SABE. Con la historia cortada, ni el 1 ni el 128
//     prueban nada: el camino puede pasar por debajo del corte.
//   · clon completo y 1 → NO.
//   · clon completo, 128 y el sha NO está en el almacén → NO. Con la historia de main entera, todo
//     commit de main está aquí; uno que no está, no es de main. Es una deducción, y se dice como tal.
//   · lo demás → NO SE SABE.
// Un «no se sabe» NO se reparte entre los otros dos: el censo lo saca NO DECIDIBLE con su motivo.
export const SI = 'SI';
export const NO = 'NO';
export const NO_SE_SABE = 'NO_SE_SABE';

/** ¿`sha` está dentro de `main`? `{ es: SI | NO | NO_SE_SABE, por }`. `somero` sale de la foto. */
export function ancestro(sha, main, { somero }) {
  let codigo = 0;
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', sha, main], { stdio: 'ignore' });
  } catch (e) {
    codigo = typeof e?.status === 'number' ? e.status : null;
  }
  if (codigo === 0) return { es: SI, por: 'is-ancestor 0' };
  if (somero) return { es: NO_SE_SABE, por: `clon SOMERO: con la historia de la rama principal cortada, el ${codigo} de is-ancestor no prueba nada` };
  if (codigo === 1) return { es: NO, por: 'is-ancestor 1' };
  if (codigo === 128 && git(['cat-file', '-e', `${sha}^{commit}`]) === null) {
    return { es: NO, por: 'is-ancestor 128 en un clon completo y el sha no está en el almacén: no puede ser de la rama principal' };
  }
  return { es: NO_SE_SABE, por: `is-ancestor salió ${codigo}: git no pudo mirarlo` };
}

/** Los tres cubos, y NADA MÁS. `NO_DECIDIBLE` cuenta del lado malo. */
export const DENTRO = 'DENTRO';
export const FUERA = 'FUERA';
export const NO_DECIDIBLE = 'NO_DECIDIBLE';

// ── 🔴 SCRUM-1331 · «NO HAY RED» NO ES «NO PUDE LEER EL ÁRBOL» ────────────────────────────────
//
// `ls-remote` es la ÚNICA orden de este censo que sale de la máquina. Hasta SCRUM-1331 su fallo
// se tragaba la salida de error y devolvía el mismo `null` que un árbol ilegible, así que quien
// leía «CIEGO» no podía saber si el defecto era del repositorio o del runner. Medido el 1-oct-2026
// en el CI del PR #2046: `Could not resolve host: github.com`, y fue el único rojo de 9.404 tests.
//
// Las tres cegueras se accionan distinto, y por eso llevan nombre:
//   · SIN_RED   → el runner no llegó al remoto. No es del cambio que se prueba: se relanza.
//   · SIN_REFS  → `ls-remote` falló por otra cosa (no hay remoto, no es un repositorio…).
//   · SIN_ARBOL → no se pudo leer `origin/main` en local.
export const SIN_RED = 'SIN_RED';
export const SIN_REFS = 'SIN_REFS';
export const SIN_ARBOL = 'SIN_ARBOL';

/**
 * Lo que git escribe cuando NO LLEGA al remoto. Es una lista de frases de git/curl, no una
 * adivinanza: lo que no case aquí sale `SIN_REFS` con su texto, nunca `SIN_RED`.
 *
 * ⚠️ `unable to access` NO está, a propósito: git lo antepone a CUALQUIER fallo de https, también
 * a un 403 (`The requested URL returned error: 403`), que es de permisos y no de red. Lo que
 * decide es el motivo que va detrás.
 */
const HUELLA_DE_RED = /Could not resolve host|Failed to connect to|Connection timed out|Connection refused|Network is unreachable|Temporary failure in name resolution/i;

/** ¿Este texto de error de git es de RED? Exportado para que el test lo ejercite sin red. */
export function esFalloDeRed(texto) {
  return HUELLA_DE_RED.test(String(texto ?? ''));
}

// ── 🔴 SCRUM-1539 · UNA FOTO, NO DOS: LEER ES UNA COSA E INTERPRETAR ES OTRA ──────────────────
//
// Hasta el 14-oct-2026 cada llamada a `censarConMotivo` volvía a preguntar al remoto. El test de
// `scrum804b` elegía su negativo con UNA lectura y el censo lo clasificaba con OTRA, y entre las
// dos alguien mergeaba ese ticket: su rama se borraba, la segunda lectura ya no la veía y el caso
// caía en el obligatorio de un PR que no tenía nada que ver (#2370, 13-oct, job 115277830730).
//
// Ahora `leerRemoto` es la ÚNICA función que ejecuta `ls-remote`, y devuelve la FOTO entera: las
// ramas tal como contestó el remoto y el sha de `origin/main` en ese mismo momento. Quien necesite
// dos respuestas coherentes se las pide a la misma foto. `main` va en la foto porque `origin/main`
// es una ref LOCAL que cualquier `git fetch` mueve, y en esta máquina los árboles de trabajo la
// comparten: con la ref y no con el sha, la carrera sólo cambiaba de sitio.
//
// Lo que se comparte es la RESPUESTA, no cómo se lee: cada lector la interpreta con lo suyo.

/**
 * La foto: `{ salida, main, somero, ciego: null }` o `{ salida: null, main: null, ciego: { que, detalle } }`.
 * `salida` es el texto crudo de `git ls-remote --heads origin`; `main`, el sha de `origin/main`;
 * `somero`, si este clon tiene la historia cortada (SCRUM-1541).
 */
export function leerRemoto() {
  let salida;
  try {
    salida = execFileSync('git', ['ls-remote', '--heads', 'origin'],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    const detalle = String(e?.stderr || e?.message || '').trim().split('\n').filter(Boolean).pop() ?? '';
    return { salida: null, main: null, ciego: { que: esFalloDeRed(detalle) ? SIN_RED : SIN_REFS, detalle: detalle.slice(0, 300) } };
  }
  const main = git(['rev-parse', '--verify', '--quiet', 'origin/main^{commit}'])?.trim() || null;
  if (!main) {
    return { salida: null, main: null, ciego: { que: SIN_ARBOL, detalle: 'este clon no tiene la punta remota de la rama principal: sin ella no se sabe qué está mergeado' } };
  }
  // SCRUM-1541 · si no se sabe si el clon es somero, cuenta como somero: del lado malo.
  const somero = git(['rev-parse', '--is-shallow-repository'])?.trim() !== 'false';
  return { salida, main, somero, ciego: null };
}

/**
 * Las ramas remotas CON el motivo si no se pudieron leer:
 * `{ ramas: Map, ciego: null }` o `{ ramas: null, ciego: { que: SIN_RED | SIN_REFS | SIN_ARBOL, detalle } }`.
 * Sin `foto`, la saca ella (una lectura nueva).
 */
export function ramasRemotasConMotivo(foto = leerRemoto()) {
  if (foto.ciego) return { ramas: null, ciego: foto.ciego };
  const m = new Map();
  for (const l of foto.salida.split('\n')) {
    const [sha, ref] = l.split('\t');
    if (ref?.startsWith('refs/heads/')) m.set(ref.slice('refs/heads/'.length), sha);
  }
  return { ramas: m, ciego: null };
}

/** Ramas remotas vivas: nombre → sha. Una sola lectura, no una por ticket (SCRUM-753). */
export function ramasRemotas() {
  return ramasRemotasConMotivo().ramas;
}

/** Todos los ficheros de `main`, una sola vez. `main` es el sha de la foto (`leerRemoto`), no la ref. */
export function arbolDeMain(main) {
  const salida = git(['ls-tree', '-r', '--name-only', main]);
  return salida === null ? null : salida.split('\n').filter(Boolean);
}

/** 🔴 POR IDENTIDAD: tras el número, separador, fin, o letra de fase. Nunca dentro de otro número. */
export function ramasDelTicket(nombres, n) {
  const re = new RegExp(`^scrum-${n}([a-z])?(-|$)`, 'i');
  return nombres.filter((x) => re.test(x));
}

/** Rutas de artefacto que nombra un texto: código y documentos de este repo. */
export function artefactosQueNombra(texto) {
  const re = /\b((?:src|tests|scripts|public|docs|prisma|\.github)\/[A-Za-z0-9_./-]+\.[a-z]{2,4})\b/g;
  return [...new Set([...texto.matchAll(re)].map((m) => m[1]))];
}

/**
 * El veredicto de un ticket, con la evidencia que lo sostiene.
 *
 * 🔴 `FUERA` EXIGE EVIDENCIA POSITIVA DE AUSENCIA, y la primera versión de este censo no lo hacía:
 * mandaba a `FUERA` los 32 tickets sin rama, sin entrada y sin ficheros propios — **los 32 con el
 * mismo motivo**, que no es un veredicto sino un «no he encontrado marca». El propio encargo lo
 * avisaba: *«un trabajo sin número puede estar entero»*. Absence of a marker no es absence of
 * work, y colocarlo en `FUERA` habría mandado a reabrir trabajo ya hecho.
 *
 * Y había una explicación de CONSTRUCCIÓN que el primer criterio no podía ver: **las entradas de
 * `docs/master/` empiezan en SCRUM-192** (sólo hay una por debajo). Un ticket anterior a esa
 * convención **no podía tener entrada**, así que exigírsela es medirlo con una regla que no
 * existía cuando se hizo.
 *
 * 🔴 EL ORDEN, DECLARADO:
 *  ① rama viva SIN mergear → **FUERA**. Es la única evidencia positiva de que hay trabajo que no
 *    está en `main`, y es lo único que este censo puede probar de ese lado;
 *  ①bis una rama de la que NO SE SABE si está mergeada → **NO DECIDIBLE** (SCRUM-1541): ni DENTRO,
 *    porque podría haber obra fuera, ni FUERA, porque eso es afirmar lo que no se ha visto;
 *  ② entrada de registro en `main` **y** al menos un artefacto suyo presente → **DENTRO**;
 *  ③ ficheros propios en `main` (`tests/scrumN…`, `scripts/…scrumN…`) → **DENTRO**;
 *  ④ todo lo demás → **NO DECIDIBLE**, del lado malo, y con el motivo separado: entrada sin
 *    artefactos · commits que lo nombran pero nada comprobable · anterior a la convención · nada.
 */
export function clasificar(n, { ramas, ficheros, entrada, commits, primeraEntrada, main, somero = true }) {
  const mias = ramasDelTicket([...ramas.keys()], n);
  const juicio = new Map(mias.map((r) => [r, ancestro(ramas.get(r), main, { somero })]));
  const sinMergear = mias.filter((r) => juicio.get(r).es === NO);
  const sinSaber = mias.filter((r) => juicio.get(r).es === NO_SE_SABE);
  const mergeadas = mias.filter((r) => juicio.get(r).es === SI);

  const propios = ficheros.filter((f) => new RegExp(`(^|/)scrum-?${n}([a-z])?[-._]`, 'i').test(f));

  if (sinMergear.length) {
    return { n, cubo: FUERA, motivo: `rama viva SIN mergear: ${sinMergear.join(', ')}`, ramas: mias, mergeadas, propios: propios.length };
  }
  // SCRUM-1541 · una rama de la que no se sabe si está mergeada no deja decidir NADA del ticket: si
  // está fuera, el ticket no está entero aunque su entrada y sus ficheros sí estén en main.
  if (sinSaber.length) {
    return { n, cubo: NO_DECIDIBLE, motivo: `no se puede saber si ${sinSaber.join(', ')} está mergeada (${juicio.get(sinSaber[0]).por})`, ramas: mias, mergeadas, propios: propios.length };
  }
  if (entrada != null) {
    const nombrados = artefactosQueNombra(entrada);
    const presentes = nombrados.filter((f) => ficheros.includes(f));
    if (presentes.length) {
      return { n, cubo: DENTRO, motivo: `entrada en main + ${presentes.length}/${nombrados.length} artefactos suyos presentes`, ramas: mias, mergeadas, propios: propios.length };
    }
    if (propios.length) {
      return { n, cubo: DENTRO, motivo: `entrada en main + ${propios.length} fichero(s) con su nombre`, ramas: mias, mergeadas, propios: propios.length };
    }
    return { n, cubo: NO_DECIDIBLE, motivo: `entrada en main pero NINGÚN artefacto comprobable (${nombrados.length} rutas citadas, 0 presentes)`, ramas: mias, mergeadas, propios: 0 };
  }
  if (propios.length) {
    return { n, cubo: DENTRO, motivo: `sin entrada, pero ${propios.length} fichero(s) suyos en main`, ramas: mias, mergeadas, propios: propios.length };
  }
  // ⚠️ A partir de aquí NO hay con qué decidir, y cada motivo se separa porque se accionan
  // distinto. El recuento de commits CORROBORA, nunca decide: el número en un mensaje no prueba
  // que el trabajo esté, y su ausencia no prueba que no esté.
  const base = { n, cubo: NO_DECIDIBLE, ramas: mias, mergeadas, propios: 0, commits };
  if (mergeadas.length) {
    return { ...base, motivo: `rama MERGEADA (${mergeadas.join(', ')}) pero sin entrada ni ficheros propios: el trabajo puede estar disuelto en ficheros de otros` };
  }
  if (commits > 0) {
    return { ...base, motivo: `${commits} commit(s) de main lo nombran, pero ningún artefacto comprobable — el número en un commit no prueba que el trabajo esté` };
  }
  if (primeraEntrada != null && n < primeraEntrada) {
    return { ...base, motivo: `anterior a la convención de docs/master/ (la primera entrada densa es SCRUM-${primeraEntrada}): no PUDO tener entrada, así que su ausencia no dice nada` };
  }
  return { ...base, motivo: 'sin rama, sin entrada, sin ficheros propios y sin commits que lo nombren: el censo no ve NADA, que no es lo mismo que no haber nada' };
}

/**
 * El censo entero, o `null` si no se pudo medir. Para saber POR QUÉ no se pudo, `censarConMotivo`.
 */
export function censar(tickets) {
  return censarConMotivo(tickets).censo;
}

/**
 * SCRUM-1331 · el censo y, si salió ciego, el motivo: `{ censo, ciego }`, y siempre uno de los dos
 * es `null`. `ciego.que` es `SIN_RED`, `SIN_REFS` o `SIN_ARBOL`; `ciego.detalle`, lo que dijo git.
 *
 * SCRUM-1539 · `foto` es la de `leerRemoto()`. Quien ya la tiene —porque ha sacado otra respuesta de
 * la misma lectura— la PASA, y el censo no vuelve a preguntar. Sin ella, saca una nueva.
 */
export function censarConMotivo(tickets, { foto = leerRemoto() } = {}) {
  const { ramas, ciego } = ramasRemotasConMotivo(foto);
  if (!ramas) return { censo: null, ciego };       // 🔴 CIEGO: sin refs no se mide
  const ficheros = arbolDeMain(foto.main);
  if (!ficheros) {                                 // 🔴 CIEGO: sin árbol tampoco
    return { censo: null, ciego: { que: SIN_ARBOL, detalle: 'el `ls-tree` de la punta remota no ha contestado' } };
  }
  return { censo: censoSobre(tickets, ramas, ficheros, foto.main, foto.somero !== false), ciego: null };
}

/** El censo, ya con las refs y el árbol leídos. `tickets` son números; `main`, el sha de la foto. */
function censoSobre(tickets, ramas, ficheros, main, somero) {

  // 🔴 LA CONVENCIÓN SE DERIVA DEL ÁRBOL, no se escribe a mano. «La primera densa» = el número más
  // bajo a partir del cual hay al menos tres entradas seguidas dentro de un margen de 100: así una
  // entrada suelta escrita a posteriori para un ticket antiguo no mueve el umbral.
  const numeros = [...new Set(ficheros
    .filter((f) => /^docs\/master\/SCRUM-\d+\.md$/.test(f))
    .map((f) => Number(f.match(/SCRUM-(\d+)\.md$/)[1])))].sort((a, b) => a - b);
  let primeraEntrada = null;
  for (let i = 0; i + 2 < numeros.length; i++) {
    if (numeros[i + 2] - numeros[i] <= 100) { primeraEntrada = numeros[i]; break; }
  }

  const filas = tickets.map((n) => {
    const entrada = git(['show', `${main}:docs/master/SCRUM-${n}.md`]);
    const log = git(['log', main, '--oneline', '-i', '-E', `--grep=SCRUM-${n}([^0-9]|$)`]);
    const commits = log === null ? 0 : log.split('\n').filter(Boolean).length;
    return clasificar(n, { ramas, ficheros, entrada, commits, primeraEntrada, main, somero });
  });
  return {
    somero,
    poblacion: tickets.length,
    ramasVistas: ramas.size,
    ficherosEnMain: ficheros.length,
    entradasEnMain: numeros.length,
    primeraEntrada,
    filas,
    dentro: filas.filter((f) => f.cubo === DENTRO),
    fuera: filas.filter((f) => f.cubo === FUERA),
    noDecidibles: filas.filter((f) => f.cubo === NO_DECIDIBLE),
  };
}

export function linea(c) {
  return `población: ${c.poblacion} tickets mirados · ${c.filas.length} clasificados · `
    + `${c.dentro.length} DENTRO · ${c.fuera.length} FUERA · ${c.noDecidibles.length} NO DECIDIBLE `
    + `(lado malo) · leídas ${c.ramasVistas} ramas remotas, ${c.ficherosEnMain} ficheros de main y ${c.entradasEnMain} entradas de registro (la convención empieza en SCRUM-${c.primeraEntrada})`;
}
