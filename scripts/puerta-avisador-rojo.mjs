// scripts/puerta-avisador-rojo.mjs — SCRUM-834
//
// QUIÉN PUEDE DESPERTAR A UNA SESIÓN, Y CUÁNTAS VECES.
//
// El avisador comenta `@claude` en un PR cuyo CI se ha puesto rojo, para que la sesión se
// entere sin que una persona haga de mensajero. Esta función decide si ese comentario se
// publica. Vive fuera del YAML por un motivo concreto: el encargo exige DOS controles
// corridos —uno que despierta y otro que NO— y un `if` dentro de un `run:` de Actions no se
// puede ejecutar en la tanda. Aquí sí.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LA PUERTA DE LOS FORKS, QUE ES LA RAZÓN DE QUE ESTO EXISTA COMO MÓDULO
//
// Para que un bot pueda despertar a Claude hay que ponerlo en `allowed_bots` de
// `claude-code-action`. Y su propia doc avisa:
//
//   «Allowed bots are NOT checked for repository permissions. A bot that matches an entry
//    does not need to be installed on your repository or have write access.»
//
// O sea: al meter `yaqu-bot[bot]` en esa lista, se DESACTIVA la comprobación de permisos que
// protegía la puerta. Y este repositorio es PÚBLICO, así que sin nada más quedaría abierto
// este camino:
//
//   un desconocido abre un PR desde un fork → su CI se pone rojo → nuestro avisador comenta
//   `@claude` → Claude despierta sobre contenido escrito por un desconocido, que puede
//   llevar instrucciones dirigidas a él.
//
// Por eso el permiso se vuelve a preguntar AQUÍ, en la puerta siguiente, y con las DOS
// condiciones a la vez: la rama de origen tiene que estar en NUESTRO repositorio (no en un
// fork) Y el PR lo tiene que haber abierto el bot o una cuenta con permiso de ESCRITURA.
// Un PR de fork no despierta a Claude nunca; si está rojo, lo mira una persona.
//
// FALLA CERRADO en todo: si un dato falta o no se reconoce, NO se avisa. El coste de callarse
// es que alguien mire un PR a mano; el de hablar de más es despertar a un agente con un
// prompt que ha escrito un desconocido.

import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** El único bot que puede provocar un aviso. Literal, nunca un comodín. */
export const BOT = 'yaqu-bot[bot]';

/** Permisos de repositorio que cuentan como «escritura» en la API de GitHub. */
const PERMISOS_DE_ESCRITURA = new Set(['admin', 'write', 'maintain']);

/**
 * ¿Es de un fork? `head.repo` puede venir a `null` (fork borrado): eso también es fork.
 * Se comparan los nombres completos `owner/repo`, no el owner suelto.
 */
export function esDeFork({ repoBase, repoOrigen } = {}) {
  if (!repoBase || !repoOrigen) return true; // sin dato → se trata como fork
  return String(repoBase).toLowerCase() !== String(repoOrigen).toLowerCase();
}

/**
 * Decide si se publica el aviso. Devuelve SIEMPRE un código de vocabulario cerrado, para que
 * el workflow lo escriba tal cual en su veredicto y un verde diga cuál de los verdes es.
 *
 * @param {object} e
 * @param {string} e.conclusionCI       conclusión del CI ('failure', 'success', …)
 * @param {string} e.repoBase           'owner/repo' del PR destino
 * @param {string} e.repoOrigen         'owner/repo' de la rama de origen
 * @param {string} e.autor              login de quien abrió el PR
 * @param {string} e.permisoAutor       'admin'|'write'|'maintain'|'read'|'none'|''
 * @param {string[]} e.marcasPrevias    marcas de avisos ya publicados en ese PR
 * @param {string} e.marcaActual        marca de ESTE rojo (head_sha + check)
 * @param {number} e.tope               máximo de avisos por PR
 */
export function decidir(e = {}) {
  const {
    conclusionCI, repoBase, repoOrigen, autor, permisoAutor,
    marcasPrevias = [], marcaActual = '', tope = 3,
  } = e;

  // 1 · ¿Hay siquiera un rojo? Un CI verde, cancelado o saltado no es asunto del avisador.
  if (conclusionCI !== 'failure') {
    return { avisar: false, codigo: 'SIN-ROJOS', motivo: `el CI concluyó «${conclusionCI}», no «failure»` };
  }

  // 2 · LA PUERTA DE LOS FORKS. Va antes que nada porque es la condición de seguridad.
  if (esDeFork({ repoBase, repoOrigen })) {
    return {
      avisar: false,
      codigo: 'FORK-NO-DESPIERTA',
      motivo: 'el PR viene de un fork: no despierta a Claude nunca. Si está rojo, lo mira una persona',
    };
  }

  // 3 · Y el permiso, otra vez, aquí. `allowed_bots` desactivó el que había.
  const esElBot = autor === BOT;
  const tieneEscritura = PERMISOS_DE_ESCRITURA.has(String(permisoAutor || '').toLowerCase());
  if (!esElBot && !tieneEscritura) {
    return {
      avisar: false,
      codigo: 'AUTOR-SIN-ESCRITURA',
      motivo: `«${autor || '(desconocido)'}» no es ${BOT} ni tiene permiso de escritura`,
    };
  }

  // 4 · Sin marca no hay forma de saber si ya se avisó → no se avisa (falla cerrado).
  if (!marcaActual) {
    return { avisar: false, codigo: 'SIN-MARCA', motivo: 'no se pudo componer la marca del aviso' };
  }

  // 5 · El MISMO rojo no se avisa dos veces. La marca lleva head_sha + check dentro, así que
  //     un rojo nuevo sobre un commit nuevo sí es un aviso nuevo.
  if (marcasPrevias.includes(marcaActual)) {
    return { avisar: false, codigo: 'YA-AVISADO', motivo: `ya hay un aviso para ${marcaActual}` };
  }

  // 6 · El tope del bucle. Vive en el PR (los avisos previos), no en el job: un workflow no
  //     recuerda nada entre ejecuciones y un contador dentro del job es un adorno.
  if (marcasPrevias.length >= tope) {
    return {
      avisar: false,
      codigo: 'TOPE-ALCANZADO',
      motivo: `ya hay ${marcasPrevias.length} avisos en este PR (tope ${tope}): para el bucle`,
    };
  }

  return { avisar: true, codigo: 'AVISAR', motivo: `rojo nuevo (${marcaActual}) en un PR propio` };
}

/**
 * EL ESPEJO DE LA REGLA DEL VIGÍA. El vigía aborta si su cuerpo CONTIENE `@claude`, porque
 * despierta a una persona y un despertar accidental es justo lo que impide. Éste aborta si NO
 * lo contiene, porque despierta a una SESIÓN y sin esa cadena `claude.yml` no se dispara: el
 * comentario se publicaría, no pasaría nada, y parecería que funcionó. Un aviso que no puede
 * despertar a nadie es peor que ninguno.
 *
 * La comprobación va DENTRO del script a propósito: una nota en un README no impide nada.
 */
export function cuerpoDespierta(cuerpo) {
  return String(cuerpo || '').includes('@claude');
}

// ── CLI ────────────────────────────────────────────────────────────────────────────────────
// Lee por stdin el JSON que reúne el workflow y escribe DOS líneas: el código y el motivo.
// Sale 0 si hay que avisar, 1 si no. Así el workflow no reimplementa la decisión: la
// consulta. Comparación por RUTA RESUELTA para que importarlo desde un test no se quede
// esperando un stdin que nadie va a cerrar.
const esCli = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (esCli) {
  let crudo = '';
  for await (const trozo of process.stdin) crudo += trozo;
  let entrada;
  try {
    entrada = JSON.parse(crudo || '{}');
  } catch {
    // Sin volcar `crudo`: puede traer cualquier cosa. No poder leer la entrada es no saber,
    // y no saber no avisa.
    console.log('ENTRADA-ILEGIBLE');
    console.log('no se pudo leer el JSON de entrada: no se avisa');
    process.exit(1);
  }
  const r = decidir(entrada);
  console.log(r.codigo);
  console.log(r.motivo);
  process.exit(r.avisar ? 0 : 1);
}
