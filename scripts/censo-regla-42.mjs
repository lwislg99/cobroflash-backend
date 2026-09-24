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

/** Los tres cubos, y NADA MÁS. `NO_DECIDIBLE` cuenta del lado malo. */
export const DENTRO = 'DENTRO';
export const FUERA = 'FUERA';
export const NO_DECIDIBLE = 'NO_DECIDIBLE';

/** Ramas remotas vivas: nombre → sha. Una sola lectura, no una por ticket (SCRUM-753). */
export function ramasRemotas() {
  const salida = git(['ls-remote', '--heads', 'origin']);
  if (salida === null) return null;
  const m = new Map();
  for (const l of salida.split('\n')) {
    const [sha, ref] = l.split('\t');
    if (ref?.startsWith('refs/heads/')) m.set(ref.slice('refs/heads/'.length), sha);
  }
  return m;
}

/** Todos los ficheros de `origin/main`, una sola vez. */
export function arbolDeMain() {
  const salida = git(['ls-tree', '-r', '--name-only', 'origin/main']);
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
 *  ② entrada de registro en `main` **y** al menos un artefacto suyo presente → **DENTRO**;
 *  ③ ficheros propios en `main` (`tests/scrumN…`, `scripts/…scrumN…`) → **DENTRO**;
 *  ④ todo lo demás → **NO DECIDIBLE**, del lado malo, y con el motivo separado: entrada sin
 *    artefactos · commits que lo nombran pero nada comprobable · anterior a la convención · nada.
 */
export function clasificar(n, { ramas, ficheros, entrada, commits, primeraEntrada }) {
  const mias = ramasDelTicket([...ramas.keys()], n);
  const sinMergear = mias.filter((r) => git(['merge-base', '--is-ancestor', ramas.get(r), 'origin/main']) === null);
  const mergeadas = mias.filter((r) => !sinMergear.includes(r));

  const propios = ficheros.filter((f) => new RegExp(`(^|/)scrum-?${n}([a-z])?[-._]`, 'i').test(f));

  if (sinMergear.length) {
    return { n, cubo: FUERA, motivo: `rama viva SIN mergear: ${sinMergear.join(', ')}`, ramas: mias, mergeadas, propios: propios.length };
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

/** El censo entero. `tickets` son números; devuelve población, filas y reparto. */
export function censar(tickets) {
  const ramas = ramasRemotas();
  const ficheros = arbolDeMain();
  if (!ramas || !ficheros) return null;            // 🔴 CIEGO: sin refs o sin árbol no se mide

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
    const entrada = git(['show', `origin/main:docs/master/SCRUM-${n}.md`]);
    const log = git(['log', 'origin/main', '--oneline', '-i', '-E', `--grep=SCRUM-${n}([^0-9]|$)`]);
    const commits = log === null ? 0 : log.split('\n').filter(Boolean).length;
    return clasificar(n, { ramas, ficheros, entrada, commits, primeraEntrada });
  });
  return {
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
