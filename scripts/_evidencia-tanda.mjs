// scripts/_evidencia-tanda.mjs — SCRUM-161: evidencia de que la tanda gateada CORRIÓ de verdad.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🟢 ESTE GUARD ESTÁ ENCENDIDO (28-jul-2026). Cerrar una tarea sin evidencia válida de la tanda
// gateada del HEAD actual FALLA (exit≠0). Apagarlo = poner `ACTIVO = false` (una línea), y los
// textos del camino apagado (`MOTIVO_APAGADO`, `mensajeApagado`) vuelven a aplicar.
// Se encendió con la tanda 2a1d053 en verde (646/646/0), ensayo VÁLIDA, ficheros 126 = 126.
// ─────────────────────────────────────────────────────────────────────────────────────────
//
// QUÉ PROBLEMA RESUELVE
//
// La tanda gateada (`npm run test:staging:gated`) es lo único que ejercita el camino real
// contra staging: tenencia, permisos por rol, firma remota, envío de WhatsApp, consolidación
// fiscal. Y depende de que **alguien se acuerde de teclearla** antes de cerrar una tarea. Eso
// no es cobertura: es intención. El 27-jul-2026 se perdió una tanda entera exactamente así.
//
// El CI no puede sustituirlo: decisión del fundador (27-jul-2026), `DATABASE_URL_STAGING` NO
// entra en GitHub Actions —regla 9, y además hay dos BD de staging y un CI que escribiera en
// cualquiera pisaría el turno de una persona—. Por eso el plan A es este guard local.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🚨 LO QUE ESTE GUARD **NO** HACE, Y HAY QUE LEERLO ANTES DE FIARSE DE ÉL
//
// **Es un guard contra el OLVIDO, no contra la mala fe.** Nada impide borrar el recibo, o
// escribirlo a mano con los números que a uno le convengan. No hay forma de cerrar eso en
// local: exigiría firmar el recibo con algo que quien lo genera no controle, y aquí no existe.
//
// **NO SUSTITUYE AL CI.** Lo sustituye contra el descuido, no contra el atajo deliberado. Si
// algún día hace falta la garantía de verdad, la respuesta honesta no es endurecer este JSON
// —es meter la tanda en un CI con credenciales—, que es justo lo que se descartó. Que quede
// escrito aquí para que nadie lo lea como «ya tenemos CI de los gateados»: no lo es.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ UN RECIBO Y NO UNA PREGUNTA
//
// El riesgo de un guard así es convertirse en **la misma convención humana con un paso más**:
// si pregunta «¿la corriste?» y se conforma con un «sí», no añade nada, solo ceremonia. Por
// eso la evidencia es un artefacto que **solo puede existir si la tanda corrió**: lo escribe
// el runner con los `res.status` reales de sus tres hijos, no lo teclea nadie.
//
// Y por eso se ata al CÓDIGO: la evidencia caduca sola en cuanto tocas una línea. Es lo que
// la separa de un «sí».
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// SCRUM-239 · POR QUÉ EL ANCLA ES EL CONTENIDO Y NO `commit === HEAD`
//
// Hasta hoy el ancla era la identidad del commit. Eso no es la propiedad que este guard
// quiere: la propiedad es **que el código que la tanda ejercitó sea el mismo que se va a
// cerrar**. `commit === HEAD` era un PROXY de eso, y los proxies fallan en los DOS sentidos:
//
//   (a) DEMASIADO ESTRICTO — el bucle. AA1.2 obliga a anotar la tarea en el máster en un
//       commit aparte, así que TODA tarea termina con un commit que no toca código y que
//       invalidaba el recibo. Medido: 5 de los últimos 40 commits sin merge de `main` tocan
//       únicamente `docs/YAQU_MASTER.md`. El acto de registrar la evidencia la invalidaba, y
//       un criterio inalcanzable no se cumple: se EXCUSA. Ahí muere un guard.
//
//   (b) DEMASIADO LAXO — y este era el grave, porque es el descuido más probable de los dos.
//       `git rev-parse HEAD` no sabe nada del árbol de trabajo: corres la tanda, editas
//       `src/app.ts`, NO commiteas, y cierras. HEAD no se ha movido, así que el recibo seguía
//       valiendo. Es exactamente el descuido que el criterio existía para impedir.
//
// El contenido arregla los dos con un solo mecanismo, porque es la propiedad misma y no un
// indicio de ella. El `commit` se queda en el recibo, pero como CONTEXTO DECLARADO —para que
// quien lea el recibo sepa contra qué se midió— y ya no como criterio.
//
// NO SE REUTILIZA `huellaArtefactos` (SCRUM-182) y conviene decir por qué: aquel mide `mtime`
// y número de ficheros de `dist/`, `tests/` y el cliente de Prisma para detectar que el árbol
// se movió DURANTE la tanda. Sirve para eso y no para esto: un `npm run build` entre la tanda
// y el cierre cambia todos esos mtime sin cambiar una línea de fuente (falso positivo), y el
// mtime no dice nada del contenido (falso negativo). Otra pregunta, otro instrumento.
//
// El recibo NO se commitea (`.gitignore`), como el sentinel de `db push`: si viajara con la
// rama se convertiría en un artefacto que se copia entre ramas — lo contrario de una prueba.

import { createHash } from 'node:crypto';

/** Dónde vive el recibo. Local, ignorado por git, escrito solo por el runner. */
export const RUTA_RECIBO = '.claude/evidencia-tanda.json';

// ─────────────────────────────────────────────────────────────────────────────────────────
// SCRUM-239 · LA HUELLA DEL CÓDIGO
//
// `node:crypto` es el único import de este módulo y no rompe lo que la pureza protegía: no
// toca disco ni BD, es determinista, y los tests siguen ejercitando todo esto sin I/O. Lo que
// SÍ necesita disco —listar y hashear ficheros— entra por un `git` INYECTADO, igual que la
// capa de BD de `_staging-lock.mjs` recibe su cliente. Así el cálculo vive en UN solo sitio
// (el runner y el verificador no pueden divergir, lección de SCRUM-199) y a la vez se puede
// probar entero con un `git` de mentira.
// ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * QUÉ **NO** ES CÓDIGO. Por EXCLUSIÓN, nunca por lista de lo que sí.
 *
 * Una allowlist (`src`, `tests`, `scripts`…) es otra lista a mano que envejece —la familia de
 * `SUELO_TOTAL` y de las tres listas que mató SCRUM-199— y su modo de fallo es SILENCIOSO: el
 * día que aparezca un directorio de fuente nuevo queda fuera de la huella y nadie se entera;
 * el recibo seguiría valiendo con el código cambiado. Con exclusión, lo nuevo cuenta como
 * código por defecto: como mucho invalida un recibo de más, que es el lado conservador.
 *
 * Lo excluido es lo que NO puede cambiar lo que la tanda ejercita: documentación y los
 * artefactos locales de `.claude/` (donde vive el propio recibo).
 */
export const NO_ES_CODIGO = [
  /^docs\//,          // documentación, incluido YAQU_MASTER.md — el commit que abría el bucle
  /^\.claude\//,      // artefactos locales; aquí vive el recibo mismo
  /^[^/]+\.md$/i,     // los .md de la raíz (CLAUDE.md, AGENTS.md, README…)
];

/** ¿Esta ruta entra en la huella? Pura, y la ÚNICA definición de «es código» que hay. */
export function esCodigo(ruta) {
  return typeof ruta === 'string' && ruta.length > 0 && !NO_ES_CODIGO.some((re) => re.test(ruta));
}

/**
 * SUELO de la huella. Si `git ls-files` devuelve cuatro cosas porque el repo está roto, el
 * comando falló a medias o alguien la calcula desde otro directorio, NO se puede producir una
 * huella «válida»: se devuelve `null` y el validador falla cerrado.
 *
 * Sin este suelo el modo de fallo sería el peor posible — dos huellas vacías **son iguales**,
 * así que un cálculo roto en las dos puntas daría VERDE sin haber mirado un solo fichero.
 * Hoy la superficie son 556 ficheros; 100 separa «roto» de «alguien borró medio repo» sin
 * convertirse en otro ratchet a mano que envejece.
 */
export const SUELO_FICHEROS_CODIGO = 100;

/**
 * La huella del código TAL Y COMO ESTÁ EN DISCO — no en el índice, no en HEAD.
 *
 * `git hash-object` hashea el fichero del ÁRBOL DE TRABAJO, que es justo lo que `rev-parse
 * HEAD` no podía ver. Se le pasan las rutas por stdin (`--stdin-paths`) y no por argumentos:
 * con ~556 ficheros, argv se queda corto en Windows y el fallo sería por longitud de línea de
 * comandos, no por el contenido.
 *
 * Y aplica los filtros del repo, así que un árbol con CRLF en disco da la MISMA huella que uno
 * con LF: la huella es del contenido que se commitearía, no del que hay byte a byte en el
 * disco de cada portátil. Eso es lo que la hace comparable entre dos ejecuciones.
 *
 * @param {(args: string[], stdin?: string) => string|null} git  ejecuta git y devuelve stdout
 * @returns {{huella: string, ficheros: number} | null}  `null` = NO COMPARABLE (fail-closed)
 */
export function huellaDeCodigo(git) {
  const listado = git(['ls-files']);
  if (typeof listado !== 'string') return null;
  const ficheros = listado.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).filter(esCodigo).sort();
  if (ficheros.length < SUELO_FICHEROS_CODIGO) return null;

  const salida = git(['hash-object', '--stdin-paths'], ficheros.join('\n') + '\n');
  if (typeof salida !== 'string') return null;
  const hashes = salida.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  // Un hash por fichero, o no sabemos qué se hasheó: no se adivina, se devuelve no-comparable.
  if (hashes.length !== ficheros.length) return null;

  const canonico = ficheros.map((f, i) => `${hashes[i]} ${f}`).join('\n');
  return { huella: createHash('sha1').update(canonico).digest('hex'), ficheros: ficheros.length };
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// EL INTERRUPTOR
// ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * 🟢 EL INTERRUPTOR. Hoy `true`: el guard calcula el veredicto Y BLOQUEA (exit≠0) si no hay
 * evidencia válida del HEAD actual. Apagarlo = poner `false` aquí, en un PR.
 */
export const ACTIVO = true;

/**
 * POR QUÉ SE ENCENDIÓ (28-jul-2026) — y qué haría falta para apagarlo.
 *
 * El gate era: la tanda en verde, o cada rojo con ticket y cuarentena (SCRUM-160). Se cumplió —
 * la tanda 2a1d053 salió 646/646/0, el ensayo dio VÁLIDA y los ficheros cuadraron (126 = 126).
 * Encender con la tanda ROJA habría sido exigir adjuntar una tanda roja —o bloquea a todo el
 * mundo, o enseña a adjuntar rojos—, la doctrina del «check rojo permanente» de SCRUM-168; por
 * eso se esperó al verde.
 *
 * PARA APAGARLO: `ACTIVO = false`. Entonces `mensajeApagado()` vuelve a ser el camino vivo, y su
 * `MOTIVO_APAGADO` debe explicar por qué se apagó — no dejar el motivo de antes del verde.
 */
export const MOTIVO_APAGADO =
  'el guard está apagado a mano (ACTIVO=false): calcula el veredicto pero no bloquea. Si lo ' +
  'apagas, escribe aquí POR QUÉ — el motivo de antes (la tanda no estaba verde) ya no aplica: ' +
  'se encendió el 28-jul-2026 con la tanda en verde (SCRUM-160/161).';

/**
 * ¿Bloquea ahora mismo?
 *
 * Con el guard ENCENDIDO (`ACTIVO = true`, hoy) esta variable es INERTE: el OR ya da `true` pase
 * lo que pase con el entorno. Su valor vive en el camino REVERSIBLE — si alguien vuelve a poner
 * `ACTIVO = false`, `YAQU_EVIDENCIA_TANDA=1` vuelve a encenderlo para UNA ejecución (ensayo), sin
 * encenderlo para nadie más.
 *
 * ⚠️ ES DE UN SOLO SENTIDO A PROPÓSITO: la variable puede ENCENDER, nunca APAGAR. Una puerta
 * de escape en un guard se acaba usando siempre, y entonces el guard no guarda nada. Con `ACTIVO`
 * en `true` no hay variable que lo desactive: apagarlo es cambiar la línea.
 */
export function estaActivo(env = {}) {
  return ACTIVO || env.YAQU_EVIDENCIA_TANDA === '1';
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// LOS UMBRALES
// ─────────────────────────────────────────────────────────────────────────────────────────

/** Un recibo de hace más de esto es un fósil: en una rama larga probaría lo de anteayer. */
export const VENTANA_MS = 24 * 60 * 60 * 1000;

/**
 * Margen hacia el FUTURO. Un recibo fechado por delante del reloj no caducaría nunca; con un
 * reloj razonable son segundos, así que una hora es holgura de sobra y cierra el caso de un
 * recibo con fecha inventada «para que aguante».
 */
export const MARGEN_FUTURO_MS = 60 * 60 * 1000;

/**
 * EL SUELO — la comprobación que impide llamar «tanda» a correr un fichero.
 *
 * Sin él, `node --test un-fichero.mjs` produce un recibo formalmente impecable. Es la más
 * importante de las comprobaciones y la que más fácil se olvida.
 *
 * Con el guard ENCENDIDO, el agregado REAL de la tanda ya se conoce: 2a1d053 salió 646/646/0.
 * Así que el suelo pasa de los 400 conservadores (que solo separaban «una tanda» de «un
 * fichero») al agregado real, 646, y esto se convierte en un ratchet de verdad (estilo
 * SCRUM-113): una tanda con menos de 646 tests es una tanda incompleta. **No vigila la
 * cobertura por fichero**; para eso está el suelo de `ficheros`, que no necesita número mágico.
 *
 * ⚠️ RATCHET MANUAL — NO SUBE SOLO. El día que la suite llegue a 700, el suelo seguirá en 646
 * salvo que alguien lo mueva a mano; y el día que alguien borre un test legítimamente, este 646
 * bloqueará hasta que se baje CONSCIENTEMENTE. Es otra cifra a mano que envejece — la misma
 * familia que las tres listas de aislados; su unificación/automatización va en SCRUM-199.
 */
export const SUELO_TOTAL = 646;

/**
 * SCRUM-199 · LA LISTA CANÓNICA DE HIJOS DE LA TANDA — la FUENTE ÚNICA.
 *
 * Antes, «qué ficheros/hijos son especiales» vivía en TRES copias a mano (AISLADOS del runner,
 * AISLADOS del verificador, CLAVES_HIJOS) y los tres modos de fallo NO eran equivalentes — el
 * peor, SILENCIOSO: un hijo que sale rojo y el guard no lo mira. Ahora TODO se deriva de aquí:
 * añadir un hijo es UNA entrada. El runner (test-staging-gated.mjs) construye su array de
 * ejecución ITERANDO este spec (no re-lista nada); el verificador usa `AISLADOS`; el validador de
 * abajo usa `CLAVES_HIJOS`. Un guard de texto (scrum199-fuente-unica-hijos.test.mjs) impide que
 * cualquiera de esas listas reaparezca a mano en el runner o el verificador.
 *
 * `env`, `nombre` y `fichero` son dato puro — no rompen la pureza de este módulo (sin fs, sin
 * imports). El validador solo usa `clave`; el resto lo consume el runner.
 */
export const HIJOS_SPEC = [
  {
    clave: 'a55',
    nombre: 'a55-window-quote (aislado)',
    fichero: 'a55-window-quote.test.mjs',
    aislado: true,
    env: { A55_DB_TEST: '1', WHATSAPP_DRY_RUN: '1', DEMO_SAFE_NUMBERS: '34611000001', QA_DB_TEST: undefined, BOT_SUITE_TEST: undefined },
  },
  {
    clave: 'bot',
    nombre: 'bot-suite (aislado)',
    fichero: 'bot-suite.test.mjs',
    aislado: true,
    // SCRUM-180: WHATSAPP_DRY_RUN lo fijaba SOLO la línea 26 de bot-suite; ponerlo aquí no depende
    // de eso y DOBLA el freno del sender (whatsappPolicy.esProcesoDeTest) — lo que toca cuando el
    // fallo se paga en el número de WhatsApp Business. bot-suite simula un flujo entero, no un envío.
    env: { BOT_SUITE_TEST: '1', WHATSAPP_DRY_RUN: '1', QA_DB_TEST: undefined, A55_DB_TEST: undefined },
  },
  {
    clave: 'scrum180',
    nombre: 'scrum180-fixtures-nunca-a-meta (aislado, dry-run OFF a propósito)',
    fichero: 'scrum180-fixtures-nunca-a-meta.test.mjs',
    aislado: true,
    // SCRUM-180: este fichero AFIRMA que WHATSAPP_DRY_RUN está apagado — comprueba que las fixtures
    // NUNCA salen a Meta por el freno REAL (whatsappPolicy.salidaAMetaBloqueada), no por el atajo del
    // dry-run. Corre SIN dry-run (el runner hace `delete env[k]` con undefined), resto de gates apagados.
    env: { WHATSAPP_DRY_RUN: undefined, QA_DB_TEST: undefined, A55_DB_TEST: undefined, BOT_SUITE_TEST: undefined },
  },
  {
    clave: 'qa',
    nombre: 'suite QA_DB_TEST (gateados QA + ungated, sin a55/bot)',
    aislado: false, // corre TODOS los *.test.mjs MENOS los aislados (ficherosQa, lo arma el runner)
    pesado: true,   // node --test sobre ~337 ficheros → deja el DLL de Prisma bloqueado → va el ÚLTIMO
    env: { QA_DB_TEST: '1', WHATSAPP_DRY_RUN: '1', A55_DB_TEST: undefined, BOT_SUITE_TEST: undefined },
  },
];

/** Ficheros que el bloque QA NO corre (van aislados, en su propio proceso). DERIVADO del spec. */
export const AISLADOS = HIJOS_SPEC.filter((h) => h.aislado).map((h) => h.fichero);

/** Las claves de los hijos, para el recibo y el guard. DERIVADO del spec: no puede divergir de él. */
export const CLAVES_HIJOS = HIJOS_SPEC.map((h) => h.clave);

/**
 * Invariante de orden: el hijo `pesado` (si existe) va el ÚLTIMO — requisito de Windows (el DLL de
 * Prisma que deja el pesado hace CRASHear al siguiente con 0xC0000142). Se comprueba contra el SPEC,
 * no contra el array runtime del runner, para que sea el MISMO dato único y no una cuarta lista.
 */
export function pesadoEsElUltimo(spec = HIJOS_SPEC) {
  const i = spec.findIndex((h) => h.pesado);
  return i === -1 || i === spec.length - 1;
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// EL VALIDADOR — puro. Recibe el TEXTO del recibo (o null si no está) y devuelve el veredicto.
// Sin imports, sin fs: así los tests lo ejercitan entero sin tocar disco ni BD.
// ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} p
 * @param {string|null} p.texto           contenido crudo del recibo, o null si no existe
 * @param {string} p.commitActual         `git rev-parse HEAD` de ahora — CONTEXTO, no criterio
 * @param {{huella: string, ficheros: number}|null} p.huellaActual  SCRUM-239: EL criterio.
 *        `null` = no se pudo calcular → falla cerrado (no comparable NO es igual).
 * @param {number} p.ahoraMs
 * @param {number} p.ficherosEsperados    cuántos ficheros debería haber corrido el bloque QA
 * @returns {{ok: boolean, problemas: Array<{clave: string, detalle: string}>, recibo: object|null}}
 */
export function validarEvidencia({ texto, commitActual, huellaActual, ahoraMs, ficherosEsperados }) {
  const problemas = [];
  const mal = (clave, detalle) => problemas.push({ clave, detalle });

  if (texto === null || texto === undefined || String(texto).trim() === '') {
    mal('ausente', `no existe ${RUTA_RECIBO}: la tanda gateada no ha corrido desde este árbol`);
    return { ok: false, problemas, recibo: null };
  }

  let r;
  try {
    r = JSON.parse(texto);
  } catch (err) {
    mal('ilegible', `${RUTA_RECIBO} no es JSON válido (${err.message}) — bórralo y vuelve a correr la tanda`);
    return { ok: false, problemas, recibo: null };
  }
  if (r === null || typeof r !== 'object' || Array.isArray(r)) {
    mal('ilegible', `${RUTA_RECIBO} no contiene un objeto`);
    return { ok: false, problemas, recibo: null };
  }

  // AUTOTEST · el modo de diagnóstico del runner apunta los tres hijos a UN fichero. Escribe
  // recibo igual —para que el camino de escritura sea el mismo y se pueda ensayar— pero se
  // marca, y aquí se rechaza por su nombre en vez de por el rodeo del suelo.
  if (r.autotest === true) {
    mal('autotest', 'el recibo es de una ejecución en MODO AUTOTEST del runner (diagnóstico, no cobertura)');
  }

  // ① EL CÓDIGO · lo que separa esto de un «sí». Correr la tanda, seguir programando y cerrar
  //    con la evidencia de antes es el descuido más natural que existe. SCRUM-239: se compara
  //    el CONTENIDO, no la identidad del commit — ver la cabecera para los dos sentidos en que
  //    `commit === HEAD` fallaba.
  if (typeof r.huella !== 'string' || r.huella.length < 16) {
    mal('incompleto',
      'el recibo no trae `huella` del código: es un recibo anterior a SCRUM-239 y no se puede ' +
      'comparar con nada — vuelve a correr la tanda');
  } else if (!huellaActual || typeof huellaActual.huella !== 'string') {
    // FAIL-CLOSED, y es el caso que más importa acertar: si esto devolviera «iguales» cuando
    // no se puede calcular, dos huellas vacías coincidirían y el guard daría verde sin haber
    // mirado un solo fichero. No comparable ≠ igual.
    mal('no-comparable',
      'no se ha podido calcular la huella del código ahora mismo (¿git no disponible, o menos ' +
      `de ${SUELO_FICHEROS_CODIGO} ficheros listados?): sin ella no se puede afirmar que la tanda ` +
      'probó este árbol, y esto falla cerrado a propósito');
  } else if (r.huella !== huellaActual.huella) {
    // El diagnóstico ÚTIL es cuál de los dos casos es, porque el remedio se lee distinto: si el
    // commit es el mismo, lo que ha cambiado son ediciones SIN COMMITEAR — el agujero que
    // `commit === HEAD` no veía y que ahora sí se nombra.
    const mismoCommit = typeof r.commit === 'string' && r.commit === commitActual;
    mal('codigo-cambiado',
      `el código ha cambiado desde que corrió la tanda (huella ${r.huella.slice(0, 8)} → ` +
      `${huellaActual.huella.slice(0, 8)}): ` +
      (mismoCommit
        ? `el commit es el MISMO (${String(commitActual).slice(0, 8)}), así que son cambios SIN ` +
          'COMMITEAR en el árbol de trabajo — míralos con `git status` y `git diff HEAD`'
        : `el recibo se tomó sobre ${String(r.commit).slice(0, 8)} y el árbol está en ` +
          `${String(commitActual).slice(0, 8)}`));
  }

  // ② EL ROJO Y LOS HIJOS. Dos criterios, dos claves, porque el remedio DIVERGE: un `fail>0` en el
  //    agregado es una tanda ROJA (→ ticket y cuarentena, SCRUM-160); un hijo que no terminó o
  //    CRASHEÓ es una tanda INCOMPLETA (→ re-correr) — sus tests no están en el recuento, así que ni
  //    siquiera sabemos si los rojos están todos. mensajeVeredicto elige UN remedio por gravedad
  //    (incompleta > roja), nunca los dos. El detalle de la clasificación por hijo, junto al bucle.
  if (!Number.isInteger(r.fail)) {
    mal('incompleto', 'el recibo no trae `fail`');
  } else if (r.fail !== 0) {
    mal('rojo', `la tanda del recibo terminó con ${r.fail} test(s) en rojo`);
  }
  // SCRUM-197 · POR HIJO, con su desglose {exit, tests, pass, fail} — no una heurística sobre el
  // agregado. Antes se SUPRIMÍA la clave `hijo` cuando el agregado traía rojos (`hayReds`), y eso
  // enmascaraba un CRASH que coincidía con rojos de OTRO hijo: decía «cuarentena» sobre una tanda
  // incompleta. Con el fail PROPIO de cada hijo la distinción es exacta, sin adivinar:
  //    · exit=0                 → verde.
  //    · exit≠0 y fail propio >0 → ROJO real: es el MISMO hecho que el `fail` agregado, redundante,
  //                               sin clave propia (o saldrían dos remedios contradictorios a la vez).
  //    · exit≠0 y fail propio =0 → CRASHEÓ sin registrar fallos: la tanda está INCOMPLETA. Clave `hijo`.
  //    · null                    → no llegó a terminar (timeout / sin ejecutar): INCOMPLETA. Clave `hijo`.
  //
  // ⚠️ LÍMITE DECLARADO (SCRUM-197): esta clasificación ASUME que un hijo con rojos TERMINÓ. Un hijo
  //    que tiene rojos Y ADEMÁS muere antes de acabar trae exit≠0 y fail>0, así que se lee como rojo
  //    normal (→ cuarentena), aunque le falten los tests que no llegó a correr. NO se distingue a
  //    propósito: hacerlo exigiría saber cuántos tests DEBERÍA tener cada hijo, y eso es otra lista a
  //    mano — justo lo que SCRUM-199 eliminó. La cura sería peor que el residual. Un límite escrito es
  //    un límite; uno callado es la próxima sorpresa.
  const hijos = r.hijos && typeof r.hijos === 'object' ? r.hijos : null;
  if (!hijos) {
    mal('incompleto', 'el recibo no trae `hijos` con el desglose de cada proceso');
  } else {
    for (const clave of CLAVES_HIJOS) {
      const h = hijos[clave];
      if (h === null || h === undefined) {
        mal('hijo', `el hijo «${clave}» no llegó a terminar (abortado por tiempo o sin ejecutar): sus tests no están en el recuento, la tanda está incompleta`);
      } else if (typeof h !== 'object' || !Number.isInteger(h.exit) || !Number.isInteger(h.fail)) {
        mal('incompleto', `el hijo «${clave}» no trae su desglose {exit, fail} — recibo viejo (pre-SCRUM-197) o corrupto`);
      } else if (h.exit === 0) {
        continue; // verde
      } else if (h.fail > 0) {
        continue; // ROJO real: redundante con el `fail` agregado (clave `rojo`), sin clave propia
      } else {
        mal('hijo', `el hijo «${clave}» salió con exit=${JSON.stringify(h.exit)} SIN registrar ningún fallo: crasheó, la tanda está incompleta`);
      }
    }
  }

  // ③ LA VENTANA · un recibo fósil de una rama larga probaría lo de anteayer.
  const t = typeof r.terminadaEn === 'string' ? Date.parse(r.terminadaEn) : NaN;
  if (!Number.isFinite(t)) {
    mal('incompleto', 'el recibo no trae `terminadaEn` con una fecha legible');
  } else if (ahoraMs - t > VENTANA_MS) {
    mal('fosil',
      `el recibo es de ${r.terminadaEn} (hace ${Math.floor((ahoraMs - t) / 3600000)} h) y la ventana es de ` +
      `${VENTANA_MS / 3600000} h`);
  } else if (t - ahoraMs > MARGEN_FUTURO_MS) {
    mal('fecha-imposible', `el recibo está fechado en el futuro (${r.terminadaEn}): un recibo así no caducaría nunca`);
  }

  // ④ EL SUELO · sin esto, correr UN fichero produce un recibo impecable.
  if (!Number.isInteger(r.total)) {
    mal('incompleto', 'el recibo no trae `total`');
  } else if (r.total < SUELO_TOTAL) {
    mal('suelo', `el recibo dice ${r.total} tests y el suelo de una tanda son ${SUELO_TOTAL}: eso no es la tanda entera`);
  }

  // ④b LOS FICHEROS · la versión exacta del suelo, sin número mágico: el bloque QA tiene que
  //     haber corrido AL MENOS tantos ficheros como hay hoy en `tests/`. Es lo que caza que
  //     alguien corra la tanda y luego añada tests sin volver a correrla.
  if (Number.isInteger(ficherosEsperados) && ficherosEsperados > 0) {
    if (!Number.isInteger(r.ficheros)) {
      mal('incompleto', 'el recibo no trae `ficheros`');
    } else if (r.ficheros < ficherosEsperados) {
      mal('ficheros',
        `el recibo corrió ${r.ficheros} ficheros de test y ahora hay ${ficherosEsperados}: ` +
        'la tanda es anterior a los tests que hay en el árbol');
    }
  }

  return { ok: problemas.length === 0, problemas, recibo: r };
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// MENSAJES
// ─────────────────────────────────────────────────────────────────────────────────────────

const COMO_ARREGLARLO =
  '   Cómo se arregla, siempre igual: correr la tanda ENTERA y volver a cerrar.\n' +
  '     npm run test:staging:gated\n' +
  '   (Necesita el turno de staging — SCRUM-188. Si lo tiene otra sesión, te lo dirá.)\n';

// Los tres remedios, uno por nivel de GRAVEDAD. mensajeVeredicto elige UNO —el del problema más
// grave presente— y nunca imprime dos, para no ofrecer jamás la salida fácil junto a la correcta
// (SCRUM-161: en una tanda roja real, `rojo` y `hijo` coexisten casi siempre).

// (2) ROJO real (`fail>0`): re-correr reproduce el mismo rojo, así que el remedio es el OPUESTO.
// NO lleva «tanda ENTERA» a propósito — el sitio de un rojo es SCRUM-160.
const REMEDIO_ROJO =
  '   La tanda salió ROJA. No se cierra re-corriendo —reproduce el mismo rojo—: cada rojo\n' +
  '   necesita ticket y cuarentena (SCRUM-160) antes de cerrar la tarea.\n';

// (1) TANDA INVÁLIDA (un hijo no terminó o murió a mitad): sus tests no están en el recuento, así
// que ni siquiera sabemos si los rojos están todos. DOMINA sobre el rojo: primero una tanda completa.
const REMEDIO_INVALIDA =
  '   La tanda NO ES VÁLIDA: un proceso no terminó o murió a mitad, y sus tests no están en el\n' +
  '   recuento — los rojos que veas pueden no ser todos. Antes que nada, vuelve a lanzarla\n' +
  '   completa; no la des por roja hasta que corra entera:\n' +
  '     npm run test:staging:gated\n' +
  '   (Necesita el turno de staging — SCRUM-188. Si lo tiene otra sesión, te lo dirá.)\n';

/** UN solo remedio, el del problema MÁS GRAVE presente. Nunca dos (SCRUM-161, coexistencia). */
function remedioDominante(problemas) {
  if (problemas.some((p) => p.clave === 'hijo')) return REMEDIO_INVALIDA; // (1) inválida > todo
  if (problemas.some((p) => p.clave === 'rojo')) return REMEDIO_ROJO;     // (2) rojo real
  return COMO_ARREGLARLO;                                                 // (3) olvido / rancio
}

export function mensajeVeredicto(res, { activo }) {
  if (res.ok) {
    const r = res.recibo;
    // Se enseñan las DOS cosas y en su papel: la huella es lo que se ha comprobado, el commit
    // es el contexto en que se tomó. Un veredicto que declara contra qué midió es reconciliable
    // con el de otra sesión; uno que solo dice «válida», no.
    return (
      `✅ SCRUM-161 · evidencia de tanda VÁLIDA — código ${String(r.huella).slice(0, 8)} ` +
      `(${r.huellaFicheros ?? '?'} ficheros), tomada sobre el commit ${String(r.commit).slice(0, 8)}, ` +
      `${r.total} tests, 0 rojos, ${r.terminadaEn}.\n`
    );
  }
  const cabecera = activo
    ? '\n❌ SCRUM-161: NO HAY EVIDENCIA VÁLIDA DE LA TANDA GATEADA — no cierres la tarea.\n'
    : '\n⚠️  SCRUM-161: no hay evidencia válida de la tanda gateada.\n';
  const lineas = res.problemas.map((p) => `   · [${p.clave}] ${p.detalle}\n`).join('');
  // UN remedio, por gravedad: un hijo caído invalida la tanda y manda sobre el rojo; sin eso, un
  // rojo va a cuarentena; lo demás, a re-correr. Nunca dos remedios contradictorios a la vez.
  return cabecera + lineas + '\n' + remedioDominante(res.problemas);
}

/**
 * Lo que se imprime cuando el guard está APAGADO: dice lo que HARÍA y por qué no lo hace.
 * Con `ACTIVO = true` (hoy) NO se alcanza — `verificar-evidencia:54` solo la llama con `!activo`.
 * Es el camino reversible: revive el día que alguien vuelva a poner `ACTIVO = false`.
 */
export function mensajeApagado() {
  return (
    '\n🔴 SCRUM-161 · GUARD APAGADO (`ACTIVO = false` en scripts/_evidencia-tanda.mjs).\n' +
    `   Motivo: ${MOTIVO_APAGADO}\n` +
    '   Lo de arriba es lo que DIRÍA si estuviera encendido. Con ACTIVO=false no bloquea.\n' +
    '   Para ensayarlo bloqueando de verdad, una sola ejecución: YAQU_EVIDENCIA_TANDA=1\n'
  );
}

/**
 * El recordatorio de alcance. Va donde lo lee quien USA el guard, no solo en el fuente: la
 * confusión que hay que evitar («ya tenemos CI de los gateados») se produce al leer el verde,
 * no al leer el código.
 */
export const AVISO_ALCANCE =
  'ℹ️  Alcance: esto es un guard contra el OLVIDO, no contra la mala fe — nada impide borrar o\n' +
  '   editar el recibo a mano. NO sustituye a un CI de los gateados; sustituye al descuido.\n';
