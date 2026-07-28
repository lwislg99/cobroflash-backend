// scripts/_evidencia-tanda.mjs — SCRUM-161: evidencia de que la tanda gateada CORRIÓ de verdad.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 ESTE GUARD ESTÁ APAGADO. LEE `MOTIVO_APAGADO` ANTES DE ENCENDERLO.
//
// Está construido, probado y enganchado — pero `ACTIVO = false`, así que HOY no bloquea a
// nadie. No es una obra a medias: es una obra terminada esperando a que se cumpla su gate.
// Encenderlo es cambiar UNA línea, y esa línea es el sitio donde vive la decisión.
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
 * 🔴 EL INTERRUPTOR. Hoy `false`: el guard calcula el veredicto y lo IMPRIME, pero no bloquea.
 * Encenderlo = poner `true` aquí, en un PR, con el motivo de abajo ya resuelto.
 */
export const ACTIVO = false;

/**
 * POR QUÉ ESTÁ APAGADO — y qué tiene que pasar para encenderlo.
 *
 * La tanda gateada **no está verde**. Un guard que exige «evidencia de la tanda» cuando la
 * tanda sale roja exige adjuntar una tanda roja: o bloquea a TODO EL MUNDO para cerrar
 * cualquier tarea, o enseña a adjuntar rojos — y lo segundo es peor que no tenerlo, porque
 * convierte el rojo en trámite. Es la misma doctrina del «check rojo permanente» que ya se
 * pagó en SCRUM-168: un mecanismo que se aprende a ignorar deja de ser un mecanismo.
 *
 * CONDICIÓN PARA ENCENDERLO: la tanda en verde, o cada rojo con ticket y cuarentena explícita
 * (criterio «ningún rojo sin número de ticket» de SCRUM-160). Ese día, `ACTIVO = true` y de
 * paso se sube `SUELO_TOTAL` al agregado real, que hasta entonces no se conoce.
 */
export const MOTIVO_APAGADO =
  'la tanda gateada todavía no está verde: exigir evidencia hoy obligaría a adjuntar una tanda ' +
  'ROJA, que o bloquea a todo el mundo o enseña a adjuntar rojos. Se enciende cuando la tanda ' +
  'esté verde o cada rojo tenga ticket y cuarentena (SCRUM-160).';

/**
 * ¿Bloquea ahora mismo?
 *
 * `YAQU_EVIDENCIA_TANDA=1` lo enciende para UNA ejecución — sirve para ensayar el día que
 * toque encenderlo de verdad, sin encenderlo para nadie más.
 *
 * ⚠️ ES DE UN SOLO SENTIDO A PROPÓSITO: la variable puede ENCENDER, nunca APAGAR. Una puerta
 * de escape en un guard se acaba usando siempre, y entonces el guard no guarda nada. El día
 * que `ACTIVO` sea `true`, no habrá variable que lo desactive: habrá que cambiar la línea.
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
 * importante de las cuatro y la que más fácil se olvida.
 *
 * DELIBERADAMENTE CONSERVADOR y dicho sin adornos: el agregado REAL de la tanda no se conoce
 * todavía —no se ha podido correr entera en verde—, así que ponerlo «apretado» sería inventar
 * un número y estrenarlo bloqueando a alguien. Lo que sí se sabe, medido: `npm test` a solas
 * ya da 588 tests, y la tanda gateada es un superconjunto (mismos ficheros, con los gates
 * ENCENDIDOS). 400 separa con enorme holgura «una tanda» de «un fichero» (unidades a decenas),
 * que es lo único que este umbral tiene que distinguir. **No vigila la cobertura**; para eso
 * está `SUELO_FICHEROS`, que no necesita ningún número mágico.
 *
 * El día que se encienda el guard, aquí va el agregado real y esto pasa a ser un ratchet de
 * verdad (estilo SCRUM-113).
 */
export const SUELO_TOTAL = 400;

/** Las tres claves de los hijos del runner. Si cambian ahí, este recibo deja de cuadrar. */
export const CLAVES_HIJOS = ['a55', 'bot', 'qa'];

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

  // ② EL ROJO · `fail` Y los tres hijos. Los dos, no uno: un hijo ABORTADO POR TIEMPO
  //    (SCRUM-181) no agrega sus contadores, así que `fail` puede ser 0 con un proceso muerto.
  if (!Number.isInteger(r.fail)) {
    mal('incompleto', 'el recibo no trae `fail`');
  } else if (r.fail !== 0) {
    mal('rojo', `la tanda del recibo terminó con ${r.fail} test(s) en rojo`);
  }
  const hijos = r.hijos && typeof r.hijos === 'object' ? r.hijos : null;
  if (!hijos) {
    mal('incompleto', 'el recibo no trae `hijos` con el exit de cada proceso');
  } else {
    for (const clave of CLAVES_HIJOS) {
      const v = hijos[clave];
      if (v === 0) continue;
      mal('rojo', v === null || v === undefined
        ? `el hijo «${clave}» no llegó a terminar (abortado por tiempo o sin ejecutar)`
        : `el hijo «${clave}» salió con exit=${JSON.stringify(v)}`);
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
  return (
    cabecera +
    res.problemas.map((p) => `   · [${p.clave}] ${p.detalle}\n`).join('') +
    '\n' + COMO_ARREGLARLO
  );
}

/** Lo que se imprime cuando el guard está APAGADO: dice lo que HARÍA y por qué no lo hace. */
export function mensajeApagado() {
  return (
    '\n🔴 SCRUM-161 · GUARD APAGADO (`ACTIVO = false` en scripts/_evidencia-tanda.mjs).\n' +
    `   Motivo: ${MOTIVO_APAGADO}\n` +
    '   Lo de arriba es lo que DIRÍA si estuviera encendido. Hoy no bloquea nada.\n' +
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
