// tests/_skill-ui-por-efecto.mjs — SCRUM-1340
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// A QUIÉN SE LE PREGUNTA SI UN REGISTRO TOCA LA INTERFAZ
//
// El guard de la skill (`scrum811c`) se lo preguntaba al REGISTRO: «¿nombras una ruta bajo
// `public/`? ¿llevas un campo de fecha?». Quien no escribía las dos cosas quedaba exento, así
// que el que menos cuidado ponía era el que menos se medía. Medido el 1-oct-2026: de 101 PR que
// habían tocado la interfaz desde el corte, el guard miraba 5.
//
// Aquí la pregunta se le hace a quien no puede contestar mal: al CAMBIO. Un PR es una UNIDAD:
//
//   · en `main`, cada commit de la cadena de primer padre, y lo que cambió contra ese padre;
//   · en una rama (y en CI, donde HEAD es el commit de mezcla), lo que va de la base de la rama
//     al disco.
//
// Si la unidad cambió un `public/**.{js,css,html}`, toca la interfaz — lo escriba como lo
// escriba su registro. Y sus entradas son las que ELLA escribió: las líneas que añadió a
// `docs/master/SCRUM-<n>.md`. Ni un nombre de fichero en una lista, ni una fecha tecleada.
//
// 🔴 LO QUE ESTE FICHERO NO HACE: decidir. Devuelve unidades, atribuciones y un veredicto por
// unidad, y `NO_SE` cuando no sabe. Quien falla es el guard.
//
// 🔴 Y CUANDO NO PUEDE MEDIR, LO DICE (`ciego`): un clon somero no trae la cadena, y una cadena
// recortada daría «0 unidades sin declarar» con el mismo aspecto que un árbol limpio.
// ═════════════════════════════════════════════════════════════════════════════════════════
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { baseDeLaRama } from './_base-de-la-rama.mjs';

/** Lo que cuenta como interfaz: el mismo criterio de extensiones que `tocaPublic` en 811c. */
export const RE_UI = /^public\/.+\.(js|css|html)$/;
/** Un registro: sólo los `SCRUM-<n>.md` de primer nivel, que es lo que trocea `scrum267`. */
export const RE_REGISTRO = /^docs\/master\/(SCRUM-\d+\.md)$/;

/** El separador de commits de las dos llamadas a `git log` (se pide con `%x01`). */
const SEP = String.fromCharCode(1);
/** Una línea «larga»: las cortas (blancos, `---`, `| --- |`) se repiten y no atribuyen nada. */
const LARGA = 30;

const sinCr = (l) => l.replace(/\r$/, '');

function git(raiz, args) {
  return execFileSync('git', args, {
    cwd: raiz, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/**
 * `git log --name-only --format=%x01%H%x09%cI` → `[{ id, instante, ficheros }]`, en el orden de
 * git (el más nuevo primero).
 */
export function parsearNombres(crudo) {
  return crudo.split(SEP).filter((b) => b.trim()).map((bloque) => {
    const [cab, ...resto] = bloque.split('\n');
    const [id, instante] = sinCr(cab).split('\t');
    return { id, instante, ficheros: resto.map((l) => sinCr(l).trim()).filter(Boolean) };
  });
}

/**
 * Un parche `-U0` (uno o varios commits separados por `%x01%H`) → `Map(id → Map(registro →
 * Set(líneas añadidas)))`. Sin `%x01` delante se lee como un solo bloque con `id` = `unico`.
 *
 * ⚠️ Las líneas `+++ b/…` son cabecera SÓLO antes del primer `@@` de su fichero: dentro de un
 * tramo, una línea añadida que empiece por `++` es contenido y cuenta.
 */
export function parsearParches(crudo, unico = null) {
  const porId = new Map();
  const bloques = unico ? [`${unico}\n${crudo}`] : crudo.split(SEP).filter((b) => b.trim());
  for (const bloque of bloques) {
    const lineas = bloque.split('\n');
    const id = sinCr(lineas[0]).trim();
    const porRegistro = new Map();
    let registro = null;
    let enCabecera = true;
    for (let i = 1; i < lineas.length; i++) {
      const l = lineas[i];
      if (l.startsWith('diff --git ')) { registro = null; enCabecera = true; continue; }
      if (enCabecera) {
        if (l.startsWith('+++ ')) {
          const m = RE_REGISTRO.exec(sinCr(l).slice(4).replace(/^b\//, ''));
          registro = m ? m[1] : null;
          if (registro && !porRegistro.has(registro)) porRegistro.set(registro, new Set());
        } else if (l.startsWith('@@')) {
          enCabecera = false;
        }
        continue;
      }
      if (registro && l.startsWith('+')) porRegistro.get(registro).add(sinCr(l.slice(1)));
    }
    porId.set(id, porRegistro);
  }
  return porId;
}

/**
 * Las unidades que se pueden medir desde `raiz`.
 *
 * Devuelve `{ ciego, base, historia, pendiente }`:
 *   · `ciego`     — `null`, o el MOTIVO por el que no se pudo medir (y entonces lo demás va vacío);
 *   · `historia`  — las unidades de la cadena de primer padre de la base, posteriores al corte,
 *                   de la más nueva a la más vieja. TODAS, toquen o no la interfaz;
 *   · `pendiente` — lo que va de la base al disco (la rama, o el PR en CI), o `null` si no hay
 *                   nada cambiado.
 *
 * @param {string} raiz
 * @param {string} corteInstante  ISO; entran las unidades cuyo commit es posterior a ese instante.
 */
export function leerUnidades(raiz, corteInstante) {
  const vacio = { base: null, historia: [], pendiente: null };
  let somero;
  try {
    somero = git(raiz, ['rev-parse', '--is-shallow-repository']).trim();
  } catch (e) {
    return { ...vacio, ciego: `git no contesta en ${raiz}: ${String(e.message).split('\n')[0]}` };
  }
  if (somero !== 'false') {
    return { ...vacio, ciego: 'clon somero: la cadena de primer padre no está entera (hace falta `fetch-depth: 0`)' };
  }
  const base = baseDeLaRama(raiz);
  if (!base) {
    return { ...vacio, ciego: 'no se pudo resolver la base de la rama (falta la referencia remota de la rama principal)' };
  }

  // `--since-as-filter` y no `--since`: el segundo DEJA DE ANDAR al ver commits viejos, y una
  // fecha de commit desordenada recortaría la cadena en silencio. Éste la anda entera y filtra.
  // `--topo-order`: la posición en la lista ES la posición en la cadena (el guard la usa para el
  // techo de las heredadas); el orden por fecha, que es el de por defecto, no lo garantiza.
  const comun = ['log', '--first-parent', '--topo-order', '--diff-merges=first-parent', '--no-color',
    `--since-as-filter=${corteInstante}`];
  const nombres = parsearNombres(git(raiz, [...comun, '--name-only', '--format=%x01%H%x09%cI', base.sha]));
  const parches = parsearParches(git(raiz, [...comun, '-U0', '-p', '--format=%x01%H', base.sha, '--', 'docs/master']));
  // El corte lo aplica git (`--since-as-filter`) y NADIE más: un segundo filtro aquí sería una
  // guarda redundante, y con dos guardas ninguna mutación de una sola línea se puede cazar.
  const historia = nombres
    .map((n) => ({
      id: n.id,
      instante: n.instante,
      ui: n.ficheros.filter((f) => RE_UI.test(f)),
      registros: parches.get(n.id) || new Map(),
      nombraRegistro: n.ficheros.some((f) => RE_REGISTRO.test(f)),
    }));

  // Lo pendiente: de la base al DISCO, más lo que aún no está rastreado (un registro recién
  // escrito es justo donde va la declaración; dejarlo fuera acusaría a quien sí la puso).
  const cambiados = git(raiz, ['diff', '--name-only', '--no-renames', base.sha]).split('\n').map(sinCr).filter(Boolean);
  const sueltos = git(raiz, ['ls-files', '--others', '--exclude-standard']).split('\n').map(sinCr).filter(Boolean);
  const todos = [...new Set([...cambiados, ...sueltos])];
  let pendiente = null;
  if (todos.length) {
    const registros = parsearParches(
      git(raiz, ['diff', '-U0', '--no-color', '--no-renames', base.sha, '--', 'docs/master']), 'PENDIENTE',
    ).get('PENDIENTE');
    for (const f of sueltos) {
      const m = RE_REGISTRO.exec(f);
      if (!m) continue;
      const texto = fs.readFileSync(path.join(raiz, f), 'utf8');
      registros.set(m[1], new Set(texto.split('\n').map(sinCr)));
    }
    pendiente = {
      id: 'PENDIENTE',
      instante: null,
      ui: todos.filter((f) => RE_UI.test(f)),
      registros,
      nombraRegistro: todos.some((f) => RE_REGISTRO.test(f)),
    };
  }
  return { ciego: null, base, historia, pendiente };
}

/**
 * Las entradas (de HOY) que una unidad escribió.
 *
 * NACE en la unidad la entrada cuya línea de título está entre las que la unidad añadió. Si la
 * unidad no hizo nacer ninguna —una segunda vuelta que sólo añade párrafos—, valen las que
 * TOCÓ: las que conservan alguna línea larga de las añadidas. Lo primero manda sobre lo segundo
 * porque un PR que estrena su entrada y de paso corrige una línea de otra vieja no convierte a
 * la vieja en suya.
 *
 * @param {{registros: Map<string, Set<string>>}} unidad
 * @param {Map<string, Array<{clave:string, tituloCompleto:string, cuerpo:string}>>} entradasPorFichero
 */
export function entradasDeLaUnidad(unidad, entradasPorFichero) {
  const nacidas = [];
  const tocadas = [];
  for (const [registro, anadidas] of unidad.registros) {
    for (const e of entradasPorFichero.get(registro) || []) {
      if (anadidas.has(sinCr(e.tituloCompleto))) { nacidas.push(e); continue; }
      const toca = e.cuerpo.split('\n').some((l) => { const s = sinCr(l); return s.length >= LARGA && anadidas.has(s); });
      if (toca) tocadas.push(e);
    }
  }
  return nacidas.length ? { entradas: nacidas, como: 'nacidas' } : { entradas: tocadas, como: 'tocadas' };
}

/**
 * El veredicto de UNA unidad. Cuatro, y ninguno es «no la miré»:
 *
 *   NO_ES_INTERFAZ  no cambió ningún `public/**.{js,css,html}`
 *   DECLARA         tocó interfaz y al menos una de sus entradas declara la skill
 *   SIN_DECLARAR    tocó interfaz, sé cuáles son sus entradas, y ninguna declara
 *   NO_SE           tocó interfaz y no sé a qué entrada pedírselo (sin registro, o sin atribuir)
 *
 * @param {(cuerpo: string) => boolean} declara
 */
export function veredictoDeUnidad(unidad, entradasPorFichero, declara) {
  if (!unidad.ui.length) return { veredicto: 'NO_ES_INTERFAZ', entradas: [], motivo: null };
  const { entradas, como } = entradasDeLaUnidad(unidad, entradasPorFichero);
  if (!entradas.length) {
    const motivo = unidad.registros.size
      ? `escribió en ${[...unidad.registros.keys()].join(', ')} pero ninguna línea suya sigue en una entrada de hoy`
      : 'tocó la interfaz y no escribió en ningún `docs/master/SCRUM-<n>.md`';
    return { veredicto: 'NO_SE', entradas: [], motivo };
  }
  const claves = entradas.map((e) => e.clave);
  return entradas.some((e) => declara(e.cuerpo))
    ? { veredicto: 'DECLARA', entradas: claves, motivo: null, como }
    : { veredicto: 'SIN_DECLARAR', entradas: claves, motivo: null, como };
}

/** `[{fichero, …}]` → `Map(fichero → entradas)`, que es como lo piden las dos de arriba. */
export function agruparPorFichero(entradas) {
  const m = new Map();
  for (const e of entradas) {
    if (!m.has(e.fichero)) m.set(e.fichero, []);
    m.get(e.fichero).push(e);
  }
  return m;
}
