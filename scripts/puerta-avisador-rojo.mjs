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

// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LA PUERTA FISCAL — REGLA 38, APLICADA TAMBIÉN AL ROBOT
//
// La regla 38 se les exige a las seis sesiones desde el primer día: el camino de emisión se
// LEE, no se modifica. Al avisador no se le exigía, y eso era un descuido con dos mitades
// medidas el 9-sep-2026:
//
//   · la cadena avisador → Claude → push a la rama SE CIERRA SIN NINGUNA PERSONA (medido:
//     `claude.yml` arrancó siete veces en media hora con `actor = yaqu-bot[bot]`);
//   · y en `verifactu.service` e `invoiceNumber.service` hay 28 piezas de lógica que se
//     pueden romper con la tanda en VERDE — entre ellas invertir qué eslabón cierra la cadena
//     de huellas, quitar la puerta de sellar dentro de una transacción, emitir sin productor
//     configurado, y el signo del huso horario del sello.
//
// Las dos juntas: un robot puede tocar el camino fiscal solo, y hay 28 maneras de romperlo
// que ningún guard caza. Así que aquí no se despierta a nadie: se ESCALA a una persona.
//
// 🔒 «Una regla que le exiges a una persona y no a tu robot no es una regla: es una costumbre.»
//
// Los dos `.service.ts` viven HOY dentro de `src/modules/invoicing/`, así que la regla del
// directorio ya los cubre. Se nombran igualmente A PROPÓSITO: el día que alguien los mueva,
// la regla por nombre los sigue cazando. Una redundancia que sobrevive a una mudanza no es
// una redundancia.
// 🔴 LA LISTA A MANO SE QUEDÓ CORTA, Y SE QUEDÓ CORTA POR DONDE TENÍA QUE QUEDARSE.
//
// La primera versión enumeraba rutas: `src/modules/invoicing/`, los dos `.service.ts` y el
// esquema. Sus tres defensas contra la mudanza funcionaban —fichero nuevo, `.service` movido,
// ruta relativa rara: los tres cazados— y aun así **`src/modules/fiscal/` entero pasaba: 20
// de 20 ficheros**. Ahí viven `verifactu/` (la huella y el registro que va a la AEAT),
// `librosAeat/`, `modelo303/` y `evidencias/atestiguamiento`. O sea la capa de SIF-1: lo más
// sensible del repositorio, tratado como un PR cualquiera.
//
// 🔒 «Una lista de rutas escrita por quien conoce el módulo tiene la forma de lo que él
//     conoce.» Yo conocía `invoicing/` y escribí `invoicing/`.
//
// POR ESO YA NO SE ESCRIBE UNA LISTA DE FISCALES: SE CENSA. Cada directorio de
// `src/modules/` tiene que estar clasificado en una de las dos listas, y `censarModulos`
// devuelve los que no lo estén. El guard de la tanda lo ejerce contra el árbol real, así que
// **un módulo nuevo rompe el test hasta que alguien lo clasifique** — que es exactamente lo
// que no pasó con `fiscal/`. Y mientras no se clasifique, `tocaCaminoFiscal` lo trata como
// fiscal: no saber si algo es el camino de emisión no es saber que no lo es.

/** Módulos que SON camino de emisión fiscal (regla 38). */
export const MODULOS_FISCALES = ['fiscal', 'invoicing'];

/**
 * Módulos declarados NO fiscales, uno a uno y a conciencia. No es una lista de relleno:
 * meter un módulo aquí es afirmar que un robot puede tocarlo sin que lo mire una persona.
 */
export const MODULOS_NO_FISCALES = [
  'ai', 'auth', 'billing', 'expenses', 'exports', 'jobs', 'maintenance', 'messaging',
  'metrics', 'payments', 'products', 'providers', 'quoteRequests', 'quotes', 'reports',
  'search', 'system', 'team', 'templates', 'whatsappBot',
];

/**
 * EL SUELO: devuelve los módulos del árbol que nadie ha clasificado. Si esto no está vacío,
 * la puerta fiscal está opinando sobre un árbol que no conoce.
 * @param {string[]} directorios  nombres de directorio bajo `src/modules/`
 */
export function censarModulos(directorios = []) {
  const conocidos = new Set([...MODULOS_FISCALES, ...MODULOS_NO_FISCALES]);
  return directorios.filter((d) => !conocidos.has(d));
}

/**
 * Las rutas que escalan. Se DERIVAN de `MODULOS_FISCALES` en vez de repetirse a mano, para
 * que añadir un módulo fiscal sea una línea en un sitio y no dos en dos.
 * Los `.service.ts` van además por NOMBRE: hoy viven dentro de `invoicing/`, y así la regla
 * los sigue cazando el día que alguien los mueva fuera.
 */
export const RUTAS_FISCALES = [
  ...MODULOS_FISCALES.map((m) => `src/modules/${m}/`),
  'verifactu.service.ts',
  'invoiceNumber.service.ts',
  'prisma/schema.prisma',
];

/**
 * ¿Toca el PR el camino de emisión fiscal?
 * FALLA CERRADO: si no se sabe qué ficheros toca (lista vacía o ausente), se responde que SÍ.
 * No poder mirar no es haber mirado, y aquí el coste de equivocarse es que un robot edite el
 * sellado; el de acertar de más, que una persona mire un PR.
 */
export function tocaCaminoFiscal(ficheros) {
  if (!Array.isArray(ficheros) || ficheros.length === 0) return true;
  const conocidos = new Set([...MODULOS_FISCALES, ...MODULOS_NO_FISCALES]);
  return ficheros.some((f) => {
    const ruta = String(f || '').replace(/\\/g, '/');
    const baja = ruta.toLowerCase();
    if (RUTAS_FISCALES.some((r) => baja.includes(r.toLowerCase()))) return true;

    // Un módulo que nadie ha clasificado se trata como fiscal. Es la mitad viva del censo:
    // sin esto, un módulo nuevo pasaría igual que pasó `fiscal/` durante todo un día, y el
    // guard del censo solo lo diría en la tanda — no aquí, que es donde decide.
    const m = ruta.match(/(?:^|\/)src\/modules\/([^/]+)\//);
    return !!(m && !conocidos.has(m[1]));
  });
}

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
 * @param {string[]} e.ficheros        rutas que toca el PR (para la puerta fiscal)
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

  // 3 · LA PUERTA FISCAL. Va con las de seguridad y antes que la de autor, por el mismo
  //     motivo que el fork: una condición de seguridad no debe depender de que otra se
  //     evalúe bien. Y va DESPUÉS del fork porque un PR de fork ya está rechazado por la
  //     razón más fuerte —contenido de un desconocido— y ése es el veredicto que hay que leer.
  if (tocaCaminoFiscal(e.ficheros)) {
    return {
      avisar: false,
      codigo: 'ESCALADO-FISCAL',
      motivo: 'el PR toca el camino de emisión fiscal (regla 38): no despierta a Claude, ' +
              'lo mira una persona',
    };
  }

  // 4 · Y el permiso, otra vez, aquí. `allowed_bots` desactivó el que había.
  const esElBot = autor === BOT;
  const tieneEscritura = PERMISOS_DE_ESCRITURA.has(String(permisoAutor || '').toLowerCase());
  if (!esElBot && !tieneEscritura) {
    return {
      avisar: false,
      codigo: 'AUTOR-SIN-ESCRITURA',
      motivo: `«${autor || '(desconocido)'}» no es ${BOT} ni tiene permiso de escritura`,
    };
  }

  // 5 · Sin marca no hay forma de saber si ya se avisó → no se avisa (falla cerrado).
  if (!marcaActual) {
    return { avisar: false, codigo: 'SIN-MARCA', motivo: 'no se pudo componer la marca del aviso' };
  }

  // 6 · El MISMO rojo no se avisa dos veces. La marca lleva head_sha + check dentro, así que
  //     un rojo nuevo sobre un commit nuevo sí es un aviso nuevo.
  if (marcasPrevias.includes(marcaActual)) {
    return { avisar: false, codigo: 'YA-AVISADO', motivo: `ya hay un aviso para ${marcaActual}` };
  }

  // 7 · El tope del bucle. Vive en el PR (los avisos previos), no en el job: un workflow no
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

/**
 * EL ESPEJO, PARA TODO LO DEMÁS QUE HABLA COMO EL BOT.
 *
 * `allowed_bots` se pone sobre la IDENTIDAD `yaqu-bot[bot]`, NO sobre un workflow. O sea que
 * CUALQUIER cosa que hable como ese bot despierta a Claude si su texto lleva la cadena.
 *
 * CENSO MEDIDO el 9-sep-2026 sobre origin/main 16997ef4 — quién habla como el bot:
 *
 *   fichero                 habla como          escribe            ¿despierta hoy?
 *   ─────────────────────── ─────────────────── ────────────────── ────────────────
 *   avisador-rojo.yml       yaqu-bot[bot]       comentario de PR   SÍ, y es su función
 *   pr-automatico.yml       yaqu-bot[bot]       CUERPO de PR       no
 *   zona-roja.yml           github-actions[bot] comentario de PR   no
 *
 * `zona-roja.yml` queda fuera por identidad: comenta con `GITHUB_TOKEN`, y los eventos de ese
 * token no crean ejecuciones. Ponerle el espejo sería una comprobación que no puede dispararse
 * nunca, y una comprobación que nunca dispara no se distingue de una rota.
 *
 * `pr-automatico.yml` SÍ lo lleva. Su seguridad de hoy descansa en dos accidentes, y cualquiera
 * de los dos lo puede quitar un cambio futuro sin que nadie lo note:
 *   ① `claude.yml` solo escucha `issue_comment` y `pull_request_review_comment`, y un CUERPO de
 *      PR no es ninguno de los dos;
 *   ② ese workflow escribe un cuerpo, no un comentario.
 *
 * Devuelve true si el texto es SEGURO (no despierta a nadie). Es la negación exacta de
 * `cuerpoDespierta`, y se escribe aparte para que el call-site diga qué quiere en vez de
 * negar a mano.
 */
export function cuerpoNoDebeDespertar(cuerpo) {
  return !cuerpoDespierta(cuerpo);
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
