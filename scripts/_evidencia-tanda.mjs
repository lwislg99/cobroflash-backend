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
// Y por eso se ata al COMMIT: la evidencia caduca sola en cuanto tocas una línea. Es lo que
// la separa de un «sí».
//
// El recibo NO se commitea (`.gitignore`), como el sentinel de `db push`: si viajara con la
// rama se convertiría en un artefacto que se copia entre ramas — lo contrario de una prueba.

/** Dónde vive el recibo. Local, ignorado por git, escrito solo por el runner. */
export const RUTA_RECIBO = '.claude/evidencia-tanda.json';

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
 * @param {string} p.commitActual         `git rev-parse HEAD` de ahora
 * @param {number} p.ahoraMs
 * @param {number} p.ficherosEsperados    cuántos ficheros debería haber corrido el bloque QA
 * @returns {{ok: boolean, problemas: Array<{clave: string, detalle: string}>, recibo: object|null}}
 */
export function validarEvidencia({ texto, commitActual, ahoraMs, ficherosEsperados }) {
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

  // ① EL COMMIT · lo que separa esto de un «sí». Correr la tanda, seguir programando y cerrar
  //    con la evidencia de antes es el descuido más natural que existe.
  if (typeof r.commit !== 'string' || r.commit.length < 7) {
    mal('incompleto', 'el recibo no trae `commit`');
  } else if (r.commit !== commitActual) {
    mal('commit-viejo',
      `el recibo es del commit ${r.commit.slice(0, 8)} y el árbol está en ${String(commitActual).slice(0, 8)}: ` +
      'has tocado código después de correr la tanda');
  }

  // ② EL ROJO Y LOS HIJOS · `fail` Y los tres hijos, los dos criterios, no uno: un hijo ABORTADO
  //    POR TIEMPO (SCRUM-181) no agrega sus contadores, así que `fail` puede ser 0 con un proceso
  //    muerto. Pero un exit≠0 de un hijo NO significa siempre lo mismo, y de ahí sale el clave
  //    (SCRUM-161):
  //      · exit≠0 CON `fail>0` en el agregado → es el MISMO hecho que el rojo, contado dos veces.
  //        No es información nueva ni tiene remedio propio → NO se emite. Si se emitiera, el
  //        veredicto mostraría «cuarentena» y «re-correr» a la vez —y en una tanda roja real eso
  //        pasa CASI SIEMPRE— y la gente haría la fácil: el bucle que este guard vino a cerrar.
  //      · exit=null (no terminó) o exit≠0 SIN fails (murió a mitad) → información NUEVA y más
  //        grave: los contadores de ese hijo NO están en el agregado, así que los números del
  //        recibo están INCOMPLETOS y la tanda no es válida. Clave `hijo`.
  //    Así `rojo` = «salió roja» (→ cuarentena, SCRUM-160) y `hijo` = «no es de fiar» (→ re-correr).
  //    mensajeVeredicto elige UN remedio por gravedad; nunca los dos.
  if (!Number.isInteger(r.fail)) {
    mal('incompleto', 'el recibo no trae `fail`');
  } else if (r.fail !== 0) {
    mal('rojo', `la tanda del recibo terminó con ${r.fail} test(s) en rojo`);
  }
  const hayReds = Number.isInteger(r.fail) && r.fail > 0;
  const hijos = r.hijos && typeof r.hijos === 'object' ? r.hijos : null;
  if (!hijos) {
    mal('incompleto', 'el recibo no trae `hijos` con el exit de cada proceso');
  } else {
    for (const clave of CLAVES_HIJOS) {
      const v = hijos[clave];
      if (v === 0) continue;
      if (v === null || v === undefined) {
        mal('hijo', `el hijo «${clave}» no llegó a terminar (abortado por tiempo o sin ejecutar): sus tests no están en el recuento, la tanda está incompleta`);
      } else if (hayReds) {
        // exit≠0 con rojos en el agregado: el mismo hecho que `fail>0`. Redundante → no se emite.
        continue;
      } else {
        mal('hijo', `el hijo «${clave}» salió con exit=${JSON.stringify(v)} sin registrar ningún fallo: murió a mitad, la tanda está incompleta`);
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
    return (
      `✅ SCRUM-161 · evidencia de tanda VÁLIDA — commit ${r.commit.slice(0, 8)}, ` +
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
