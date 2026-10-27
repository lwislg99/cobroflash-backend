// tests/_catalogo-obligatorio.mjs — SCRUM-1387 ② (rehecho el 13-oct-2026: la población se DERIVA)
//
// El catálogo del meta-guard (los tests que exportan `MUTACIONES_QUE_ME_TUMBAN`) es destino OBLIGATORIO
// de todo banco de mutación NUEVO. Lo decidió el fundador en el comentario 18016 de SCRUM-1387
// (2-oct-2026): sólo hacia adelante, y el rojo NOMBRA el banco y el fichero.
//
// QUÉ ES UN BANCO Y QUÉ ES «FUERA»: la misma definición que el censo de SCRUM-1394
// (`docs/master/evidencias/SCRUM-1394/bancos.mjs`), que es la que el fundador tuvo delante al decidir.
//   · banco  = una carpeta de `docs/evidencias/` o `docs/master/evidencias/` con algún fichero con
//              «mut» en el nombre;
//   · guion  = de ésos, los `.mjs` (o `.mjs.txt`);
//   · fuera  = tiene guion y NINGUNO nombra el catálogo.
// ⚠️ ES UNA HEURÍSTICA DE TEXTO, y se dice aquí porque es el límite del guard: un banco cuyos ficheros
// no lleven «mut» en el nombre no existe para él, y un guion que sólo MENCIONE el catálogo cuenta
// como dentro. No compara mutación a mutación.
//
// QUÉ ES «NUEVO», Y POR QUÉ NO HAY LISTA (comentario 19366 de SCRUM-1387, 13-oct-2026).
// La primera versión (PR #2286, cerrado) llevaba los bancos tolerados ESCRITOS: 23 nombres y un techo.
// Entraban unos ocho bancos cada seis días, así que el PR caducaba antes de aterrizar. Aquí no se
// escribe ninguno: lo que separa «ya estaba» de «nuevo» es la HISTORIA de git.
//   · corte    = el commit de la línea principal (primer padre) en el que ESTE FICHERO entró;
//   · heredado = banco fuera cuyos guiones entraron todos en ese commit o antes;
//   · nuevo    = banco fuera con algún guion que entró DESPUÉS, o que todavía no está en ningún commit.
// Nadie puede añadirse a los heredados: habría que reescribir la historia. Y sólo menguan.
// ⛔ Renombrar o mover este fichero sin AÑADIR su ruta nueva a `RUTAS_DEL_CORTE` mueve el corte.
// ⚠️ Lo que la historia NO sabe: quién retira cada heredado. Lo que se leyó en Jira el 7-oct-2026
// va abajo, con su fecha, y sólo informa.
//
// Puro a propósito: `clasificar` y `juicio` reciben datos en memoria, así sus controles se fabrican
// sin escribir un solo fichero.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const CARPETAS_DE_EVIDENCIAS = ['docs/evidencias', 'docs/master/evidencias'];

/**
 * Las rutas que ESTE fichero ha tenido. El corte es la entrada MÁS VIEJA de cualquiera de ellas.
 * ⛔ Si se renombra o se mueve: la ruta nueva se AÑADE aquí y la vieja NO se quita. Quitarla mueve el
 * corte al día del cambio, y todo banco que entró entre medias pasa a heredado sin que nadie lo decida.
 */
export const RUTAS_DEL_CORTE = [
  'tests/_catalogo-obligatorio.mjs',
];

/** La hora del comentario 18016 (la decisión). Un hecho, no una tolerancia: sólo rotula el motivo. */
export const LA_DECISION = '2026-10-02T02:10:21Z';

const NOMBRA_EL_CATALOGO = /MUTACIONES_QUE_ME_TUMBAN|censoDeDeclaraciones|mutacionesDeclaradas/;
const ES_GUION = /\.mjs(\.txt)?$/;

/** Todos los ficheros con «mut» en el nombre bajo las carpetas de evidencias: `{ ruta, texto }`. */
export function leerFicherosDeMutacion(raiz) {
  const out = [];
  const andar = (rel) => {
    const abs = path.join(raiz, rel);
    if (!fs.existsSync(abs)) return;
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const hijo = rel + '/' + e.name;
      if (e.isDirectory()) andar(hijo);
      else if (/mut/i.test(e.name)) {
        const esGuion = ES_GUION.test(e.name);
        out.push({ ruta: hijo, texto: esGuion ? fs.readFileSync(path.join(raiz, hijo), 'utf8') : '' });
      }
    }
  };
  for (const c of CARPETAS_DE_EVIDENCIAS) andar(c);
  return out;
}

/** De un listado `{ ruta, texto }`, las carpetas con banco y cuáles están fuera del catálogo. */
export function clasificar(ficheros) {
  const carpetas = new Map();
  for (const f of ficheros) {
    const d = f.ruta.slice(0, f.ruta.lastIndexOf('/'));
    carpetas.set(d, [...(carpetas.get(d) || []), f]);
  }
  const bancos = [];
  for (const [carpeta, suyos] of [...carpetas].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const guiones = suyos.filter((f) => ES_GUION.test(f.ruta));
    const usaCatalogo = guiones.some((g) => NOMBRA_EL_CATALOGO.test(g.texto));
    const fuera = guiones.length > 0 && !usaCatalogo;
    bancos.push({ carpeta, guiones: guiones.map((g) => g.ruta), fuera });
  }
  return { ficheros: ficheros.length, bancos, fuera: bancos.filter((b) => b.fuera) };
}

/**
 * La historia de la línea principal (primer padre de `HEAD`), leída de git en dos órdenes.
 *
 * Devuelve `{ ciego, commits, altas, nacimientos, posDe }`:
 *   · `ciego`   por qué NO se ha podido leer (cadena), o `null`. Un clon superficial es ciego: ahí
 *               todos los ficheros parecen nacidos en el mismo commit y el guard saldría verde sin mirar.
 *               Y lo es una línea de primer padre que no es la de main (`cegueraDelCorte`, SCRUM-1548):
 *               ésa devuelve lo leído Y el motivo, para que quien lo lea vea qué corte salió.
 *   · `commits` cuántos commits tiene la línea principal;
 *   · `altas`   `ruta → { pos, sha, fecha }` del ÚLTIMO commit que dio de alta la ruta (un fichero
 *               borrado y vuelto a meter es nuevo); `nacimientos`, lo mismo del PRIMERO (para el corte);
 *   · `posDe`   `sha → pos` de cualquier commit de la línea principal.
 * `pos` cuenta desde el commit más viejo: mayor = más reciente. Se compara posición, no fecha.
 */
export function leerHistoria(raiz) {
  const git = (args) => execFileSync('git', ['-c', 'core.quotepath=false', ...args],
    { cwd: raiz, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  const vacia = (ciego) => ({ ciego, commits: 0, altas: new Map(), nacimientos: new Map(), posDe: () => undefined });
  let lineaPrincipal;
  try {
    if (git(['rev-parse', '--is-shallow-repository']).trim() === 'true') {
      return vacia('la historia está CORTADA (clon superficial): todos los ficheros parecerían del mismo commit');
    }
    lineaPrincipal = git(['rev-list', '--first-parent', 'HEAD']).split('\n').filter(Boolean);
  } catch (e) {
    return vacia(`git no contesta aquí: ${String(e.stderr || e.message).trim().split('\n')[0]}`);
  }
  if (lineaPrincipal.length === 0) return vacia('la línea principal no tiene ningún commit');
  const pos = new Map(lineaPrincipal.map((sha, i) => [sha, lineaPrincipal.length - i]));
  const salida = git(['log', '--first-parent', '-m', '--diff-filter=A', '--name-only',
    '--format=@%H %cI', 'HEAD', '--', ...CARPETAS_DE_EVIDENCIAS, ...RUTAS_DEL_CORTE]);
  const altas = new Map();
  const nacimientos = new Map();
  let actual = null;
  for (const linea of salida.split('\n')) {
    if (!linea) continue;
    if (linea.startsWith('@')) {
      const [sha, fecha] = linea.slice(1).split(' ');
      actual = { pos: pos.get(sha), sha, fecha };
      continue;
    }
    // git lista del más reciente al más viejo: la primera vez que sale una ruta es su última alta.
    if (!altas.has(linea)) altas.set(linea, actual);
    nacimientos.set(linea, actual);
  }
  const historia = { ciego: null, commits: lineaPrincipal.length, altas, nacimientos, posDe: (sha) => pos.get(sha) };
  // SCRUM-1548: leída entera, pero ¿es la de main? Si el corte no es el de main, lo demás no se puede juzgar.
  return { ...historia, ciego: cegueraDelCorte(corteDe(historia)) };
}

/**
 * El corte EN MAIN, por identidad: el commit de la línea principal de `main` en el que entró este
 * guard (PR #2406). Es un hecho de la historia, como `LA_DECISION`; no se recalcula porque lo único
 * que se podría recalcular aquí es el primer padre de `HEAD`, que es justo lo que se está juzgando.
 * Si estuviera mal, el guard diría CIEGO en `main` y en todos los PR: no puede fallar en silencio.
 */
export const CORTE_EN_MAIN = 'bc5fa21eefa951fd01ff4b2b5d200c80d216612d';

/**
 * SCRUM-1548 · ¿el corte que sale de ESTA historia es el de main? Devuelve por qué no (cadena) o `null`.
 *
 * El primer padre de `HEAD` sólo es la línea de `main` si el árbol nació de main DESPUÉS del corte, o
 * es main, o es el merge que prueba CI (`refs/pull/N/merge`, cuyo primer padre es main: medido en
 * cinco PR abiertos el 14-oct-2026). En una rama anterior al corte que trajo main con
 * `git merge origin/main` —lo que A4 ordena— el guard y todo lo que main traía entran en el MISMO
 * commit, el del merge local: ése sale como corte, todo sale «heredado» y el guard pasaría en verde
 * sin haber mirado. Con el corte de main en su sitio, lo anterior a él es la línea de main y lo
 * posterior es posterior en cualquier topología: ahí sí se puede juzgar.
 */
export function cegueraDelCorte(nace) {
  if (!nace) {
    // Los textos dicen «línea principal» y no el nombre de la rama: el censo de SCRUM-723 cuenta como
    // referencia móvil toda cadena que la nombre, y aquí no se compara contra ninguna.
    return 'este guard no entró en ningún commit de la línea de primer padre de este árbol, y en la línea '
      + `principal sí (${CORTE_EN_MAIN.slice(0, 9)}): no hay corte con el que separar lo nuevo de lo heredado`;
  }
  if (nace.sha !== CORTE_EN_MAIN) {
    return `el corte sale ${String(nace.sha).slice(0, 9)} y el de la línea principal es ${CORTE_EN_MAIN.slice(0, 9)}: `
      + 'el primer padre de este árbol no es la línea principal (una rama anterior al guard que la trajo con '
      + '`git merge`), así que todo lo que vino en ese merge parecería heredado. Aquí no se puede saber; CI lo '
      + 'mide sobre la línea principal';
  }
  return null;
}

/**
 * Separa los bancos fuera en NUEVOS y HEREDADOS.
 *   · `fuera`   los de `clasificar`;
 *   · `altaDe`  `ruta → { pos, fecha } | undefined` (sin alta = todavía no está en ningún commit);
 *   · `corte`   la posición del commit en que entró el guard, o `null` si el guard aún no está en
 *               ningún commit (entonces todo lo que ya está en la historia es heredado).
 */
export function juicio({ fuera, altaDe, corte }) {
  const esNuevo = (ruta) => {
    const alta = altaDe(ruta);
    if (!alta) return true;
    return corte !== null && alta.pos > corte;
  };
  const nuevos = [];
  const heredados = [];
  for (const b of fuera) {
    const guionesNuevos = b.guiones.filter(esNuevo);
    if (guionesNuevos.length > 0) nuevos.push({ carpeta: b.carpeta, guiones: guionesNuevos });
    else heredados.push(b);
  }
  return { nuevos, heredados };
}

/** El corte: la entrada más vieja de cualquiera de las rutas del guard, o `null` si no hay ninguna. */
export function corteDe(historia) {
  const nacidas = RUTAS_DEL_CORTE.map((r) => historia.nacimientos.get(r)).filter(Boolean);
  if (nacidas.length === 0) return null;
  return nacidas.sort((a, b) => a.pos - b.pos)[0];
}

/**
 * QUIÉN RETIRA cada heredado: lo que la historia no sabe. Es el puesto del área del ticket, LEÍDA de
 * sus etiquetas de Jira el 7-oct-2026 por la sesión que construyó la primera versión. ⚠️ ES UN DATO
 * CON FECHA Y SÓLO INFORMA: no decide ningún veredicto, y una carpeta que no esté aquí no se ha leído.
 * Donde el ticket no llevaba etiqueta de área se dice; no se ha inventado ninguno.
 */
export const RETIRA_LEIDO_EN_JIRA_EL_7_OCT = {
  'docs/evidencias/scrum1317': 'J4',
  'docs/evidencias/scrum1338': 'J4',
  'docs/master/evidencias/SCRUM-1324': 'J6',
  'docs/master/evidencias/SCRUM-1345': 'J6',
  'docs/master/evidencias/SCRUM-1486': 'S3',
  'docs/master/evidencias/SCRUM-876f': 'sin etiqueta de área en Jira (SCRUM-876)',
  'docs/master/evidencias/SCRUM-912': 'S1',
  'docs/master/evidencias/SCRUM-917': 'S4',
  'docs/master/evidencias/scrum1304': 'J1',
  'docs/master/evidencias/scrum1326': 'sin etiqueta de área en Jira (SCRUM-1326, equipo de Javier)',
  'docs/master/evidencias/scrum1327': 'J1',
  'docs/master/evidencias/scrum1330': 'J1',
  'docs/master/evidencias/scrum1333': 'J1',
  'docs/master/evidencias/scrum1340': 'J4',
  'docs/master/evidencias/scrum1344': 'J4',
  'docs/master/evidencias/scrum1392': 'sin etiqueta de área en Jira (SCRUM-1392, equipo de Javier)',
  'docs/master/evidencias/scrum1395': 'sin etiqueta de área en Jira (SCRUM-1395, equipo de Javier)',
  'docs/master/evidencias/scrum864': 'sin etiqueta de área en Jira (SCRUM-864)',
  'docs/master/evidencias/scrum864c': 'sin etiqueta de área en Jira (SCRUM-864)',
  'docs/master/evidencias/scrum908c': 'J6',
  'docs/master/evidencias/scrum920': 'sin etiqueta de área en Jira (SCRUM-920)',
  'docs/master/evidencias/scrum933': 'sin etiqueta de área en Jira (SCRUM-933)',
  'docs/master/evidencias/scrum982': 'S2',
};

/**
 * Las tres cosas del comentario 18016 por heredado: motivo, quién la retira y fecha. Motivo y fecha
 * salen de la historia; «quién», de la tabla de arriba o «sin leer en Jira».
 */
export function fichaDelHeredado(banco, altaDe) {
  const altas = banco.guiones.map(altaDe).filter(Boolean).sort((a, b) => b.pos - a.pos);
  const ultima = altas[0];
  const fecha = ultima ? new Date(ultima.fecha).toISOString() : null;
  const antes = ultima && Date.parse(ultima.fecha) < Date.parse(LA_DECISION);
  return {
    carpeta: banco.carpeta,
    motivo: fecha === null ? 'sin fecha' : (antes
      ? 'anterior a la decisión'
      : 'posterior a la decisión y anterior al guard'),
    retira: RETIRA_LEIDO_EN_JIRA_EL_7_OCT[banco.carpeta] || 'sin leer en Jira',
    desde: fecha,
  };
}
