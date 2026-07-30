// scripts/_staging-lock.mjs — SCRUM-188: el turno de staging, escrito donde una máquina lo lee.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL HUECO QUE CIERRA
//
// R6 —«un solo trabajo contra staging a la vez»— es una convención entre personas: no existe
// en ningún sitio que un proceso pueda consultar. Con tres sesiones sobre dos BD de staging,
// dos tandas solapadas crean y BORRAN merchants derivados del id: se pisan a mitad de suite.
// Y el resultado no es «rojo» — puede salir **VERDE por accidente**, que es justo el fallo
// que esta casa lleva persiguiendo toda la semana (SCRUM-157, 160, 182).
//
// SCRUM-182 es la otra mitad: aquel DELATA que los artefactos se movieron bajo los pies de la
// tanda; este PREVIENE que dos tandas se solapen sobre la misma BD. Uno mira el árbol, el
// otro la base.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// DÓNDE VIVE EL LOCK, Y POR QUÉ NO ES UNA TABLA
//
// Una tabla sería `prisma/schema.prisma` → freno duro del §3 de ASESOR.md: carril A, STOP,
// preview y `db push` a las TRES bases, producción incluida, donde un lock de tests no pinta
// absolutamente nada. Peaje desproporcionado para coordinar sesiones de test.
//
// El lock vive como **SUFIJO del marcador de staging de SCRUM-118**, que es un comentario del
// catálogo de PostgreSQL sobre la propia base (`COMMENT ON DATABASE … IS 'YAQU_STAGING'`):
//
//     YAQU_STAGING                                   ← libre
//     YAQU_STAGING lock:<dueño>@<ISO-8601>           ← tomado
//
// Eso NO es schema: es metadato del catálogo. Sin tabla, sin `db push`, sin STOP. Y el sitio
// ya se lee en cada arranque de la barrera, así que el turno se comprueba en la consulta que
// YA se hacía.
//
// Exige ser PROPIETARIO de la base (`COMMENT ON DATABASE` no es un privilegio otorgable).
// Verificado el 28-jul-2026 contra staging, en SOLO LECTURA:
//   SELECT current_user, pg_get_userbyid(datdba), pg_get_userbyid(datdba) = current_user
//   FROM pg_database WHERE datname = current_database();   →  postgres / postgres / true
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🚨 EL CRITERIO INNEGOCIABLE: UN SUFIJO ILEGIBLE NUNCA INVALIDA LA BARRERA
//
// Escribir aquí es escribir sobre la BARRERA DE SEGURIDAD de SCRUM-118 — la que decide si
// alguien puede correr la tanda gateada. Si el formato se rompe y la barrera deja de casar,
// el fallo es fail-closed (el lado bueno) pero es **caída total**: NADIE puede correr tests
// contra staging hasta que un humano lo repare a mano.
//
// Por eso el prefijo y el sufijo se leen con DOS FUNCIONES SEPARADAS, y la decisión de la
// barrera NO PASA POR EL PARSER DEL LOCK:
//   · `esMarcaDeStaging(marca)` — la barrera. Exactitud IDÉNTICA a la de hoy: la marca es
//     `YAQU_STAGING` exacto, o `YAQU_STAGING` + separador + lo que sea. `YAQU_STAGINGX` no,
//     `xYAQU_STAGING` no, `null` no.
//   · `parsearLock(marca)` — el turno. Si no entiende el sufijo devuelve `null` («no hay
//     lock»), jamás «esto no es staging».
// La separación es ESTRUCTURAL, no una convención: `_staging-db.mjs` decide con la primera y
// solo después, para un aviso informativo, llama a la segunda.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL TTL ES EL MECANISMO PRINCIPAL, NO UN EXTRA
//
// Soltar en un `finally` NO BASTA: un SIGKILL, un portátil que se cierra o el timeout por
// hijo de SCRUM-181 no pasan por ahí. Sin caducidad, «otra sesión tiene el turno» se
// convierte en «nadie puede correr la tanda hasta que alguien lo borre a mano» — el lock
// nacería siendo el próximo bloqueo permanente. Por eso:
//   · el timestamp viaja DENTRO del marcador, así que detectar un lock rancio es comparar
//     fechas en la lectura que ya se hacía;
//   · quien lo encuentra caducado lo RECLAMA solo, sin instrucción de runbook;
//   · el reloj es el de la BASE DE DATOS (`now()`), no el de cada portátil: un lock escrito
//     por una máquina y juzgado por otra no puede desfasarse por sesgo de reloj.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ESTE MÓDULO NO IMPORTA NADA (a propósito)
//
// Es lógica pura + una capa de BD que recibe el cliente INYECTADO. Así los tests del
// mecanismo corren ungated, sin BD y sin red, y el camino de escritura se puede ejercitar en
// rojo con un doble. Quien lo usa contra una BD real (el runner) es quien pone el cliente, y
// quien aplica ANTES la allowlist de host de `_db-guard.mjs`.
// ─────────────────────────────────────────────────────────────────────────────────────────

/** El marcador de SCRUM-118. Fuente única: `_staging-db.mjs` y `marcar-staging.mjs` lo importan de aquí. */
export const MARCADOR = 'YAQU_STAGING';

/** Lo que separa el prefijo del sufijo. Un solo espacio. */
export const SEPARADOR = ' ';

/** Caducidad por defecto de un turno. Ver `ttlParaTanda()` para el valor efectivo del runner. */
export const TTL_POR_DEFECTO_MS = 45 * 60 * 1000;

/** Margen sobre el hijo más lento (SCRUM-181) al derivar el TTL de una tanda concreta. */
export const MARGEN_TTL_MS = 10 * 60 * 1000;

/** Salida del runner cuando el turno lo tiene otro. Distinta de 1 (rojos), 2, 3 y 4 (SCRUM-182). */
export const CODIGO_SALIDA_LOCK_AJENO = 5;

/** Salida del runner cuando PERDIÓ el turno a mitad (otro lo reclamó por rancio). */
export const CODIGO_SALIDA_LOCK_PERDIDO = 6;

/** Clave del advisory lock que serializa el leer-decidir-escribir. Arbitraria y solo nuestra. */
export const CLAVE_ADVISORY = 188188188;

// Sufijo del turno: `lock:<dueño>@<ISO con milisegundos>`. ANCLADO en los dos extremos: lo que
// no case EXACTAMENTE es sufijo ilegible → se ignora (nunca invalida el prefijo).
const RE_LOCK = /^lock:([A-Za-z0-9._-]{1,64})@(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)$/;

// Charset PERMITIDO de una marca antes de que toque SQL. NO incluye comilla simple, barra
// invertida ni dólar — que son exactamente los tres caracteres con los que se sale de un
// literal o de un `$$…$$` de PostgreSQL. Lo que se escribe es siempre generado por
// `componerMarca()`, así que esto no es un escapado: es una PRUEBA de que no hay superficie.
const RE_MARCA_SEGURA = /^[A-Za-z0-9._:@ -]{1,160}$/;

/**
 * LA BARRERA. ¿Es esta marca la de una BD de staging?
 * Exactitud idéntica a la de SCRUM-118 antes de este ticket, con la única diferencia de
 * admitir un sufijo detrás del separador. NO mira el sufijo: no le importa qué diga.
 */
export function esMarcaDeStaging(marca) {
  if (typeof marca !== 'string') return false;
  if (marca === MARCADOR) return true;
  return marca.startsWith(MARCADOR + SEPARADOR);
}

/**
 * EL TURNO. Devuelve `{ dueño, desdeIso, desdeMs }`, o `null` si no hay turno tomado
 * — y también `null` si el sufijo existe pero NO se entiende. Ilegible === libre, jamás
 * «esto no es staging».
 */
export function parsearLock(marca) {
  if (typeof marca !== 'string') return null;
  if (!marca.startsWith(MARCADOR + SEPARADOR)) return null;
  const m = RE_LOCK.exec(marca.slice(MARCADOR.length + SEPARADOR.length));
  if (!m) return null;
  const desdeMs = Date.parse(m[2]);
  if (!Number.isFinite(desdeMs)) return null; // fecha con forma válida pero imposible (mes 13…)
  return { dueño: m[1], desdeIso: m[2], desdeMs };
}

/** ¿Tiene la marca un sufijo que no se entiende? Solo para poder DECIRLO al reescribirla. */
export function tieneSufijoIlegible(marca) {
  if (!esMarcaDeStaging(marca)) return false;
  if (marca === MARCADOR) return false;
  return parsearLock(marca) === null;
}

/**
 * Identificador de sesión. Legible por un humano a las once de la noche («¿quién es ese?»)
 * y dentro del charset del sufijo: cualquier otro carácter pasa a `-`.
 * Se reciben `host` y `pid` por argumento para que el módulo no importe `node:os`.
 */
export function idDeSesion(host, pid) {
  const limpio = String(host || 'desconocido').replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 48);
  return `${limpio || 'desconocido'}.${pid}`;
}

/**
 * Compone la marca con el turno dentro. Lanza si el resultado no es representable sin
 * ambigüedad: preferimos reventar ANTES de escribir a dejar el marcador en un estado que la
 * barrera no reconozca. Fail-closed en el sitio barato.
 */
export function componerMarca(dueño, desdeMs) {
  const iso = new Date(desdeMs).toISOString();
  const marca = `${MARCADOR}${SEPARADOR}lock:${dueño}@${iso}`;
  if (!parsearLock(marca) || !esMarcaDeStaging(marca)) {
    throw new Error(`SCRUM-188: marca no representable para dueño=${JSON.stringify(dueño)} — no se escribe nada.`);
  }
  if (!RE_MARCA_SEGURA.test(marca)) {
    throw new Error(`SCRUM-188: marca fuera del charset seguro — no se escribe nada.`);
  }
  return marca;
}

/** ¿Ha caducado este turno? El `ahora` viene del reloj de la BD, no del portátil. */
export function estaRancio(lock, ahoraMs, ttlMs = TTL_POR_DEFECTO_MS) {
  if (!lock) return false;
  return ahoraMs - lock.desdeMs >= ttlMs;
}

/**
 * TTL efectivo de una tanda concreta, DERIVADO del hijo más lento (SCRUM-181).
 * El turno se refresca entre hijos, así que el hueco máximo sin refresco es lo que tarde el
 * hijo más largo — como mucho, su timeout. Si alguien sube el límite por `GATED_CHILD_TIMEOUT_MS`,
 * el TTL sube con él: si no, un hijo legítimamente largo caducaría su propio turno a mitad y
 * otra sesión entraría a la misma BD. El TTL nunca baja del suelo por defecto.
 */
export function ttlParaTanda(timeoutMayorMs) {
  const derivado = Number(timeoutMayorMs) > 0 ? Number(timeoutMayorMs) + MARGEN_TTL_MS : 0;
  return Math.max(TTL_POR_DEFECTO_MS, derivado);
}

export function formatearDuracion(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const min = Math.floor(s / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h ${min % 60}min`;
}

/**
 * El mensaje que se encuentra quien llega y el turno está tomado. Nombra AL DUEÑO y DESDE CUÁNDO
 * y —desde SCRUM-232— QUÉ está corriendo y cuánto le queda, que es lo que permite decidir entre
 * esperar, avisar o seguir con otra cosa sin tener que romper el lock para averiguarlo.
 * `contexto` es opcional: sin él, el mensaje degrada exactamente al de antes de SCRUM-232.
 */
export function mensajeLockAjeno({ db, lock, ahoraMs, ttlMs, contexto = null }) {
  const antiguedad = formatearDuracion(ahoraMs - lock.desdeMs);
  const restante = formatearDuracion(lock.desdeMs + ttlMs - ahoraMs);
  return (
    '\n❌ SCRUM-188: EL TURNO DE STAGING ESTÁ TOMADO — la tanda NO arranca.\n' +
    `   Base "${db}": la tiene «${lock.dueño}» desde ${lock.desdeIso} (hace ${antiguedad}).\n` +
    lineasDeContexto(contexto, ahoraMs) +
    `   Caduca sola dentro de ${restante} (TTL ${formatearDuracion(ttlMs)}); a partir de ahí se reclama sola.\n\n` +
    '   POR QUÉ NO SE CORRE IGUAL: los gateados CREAN Y BORRAN merchants derivados del id. Dos\n' +
    '   tandas solapadas se los quitan la una a la otra a mitad de suite, y el resultado no es\n' +
    '   «rojo»: puede salir VERDE por accidente. Un verde que no ejercitó lo que dice haber\n' +
    '   ejercitado es peor que no correr nada.\n\n' +
    '   QUÉ HACER:\n' +
    '     · esperar a que caduque o a que la otra sesión termine, y volver a lanzarla ENTERA;\n' +
    '     · si SABES que esa sesión está muerta y no quieres esperar, libera el turno a mano:\n' +
    '         DATABASE_URL="<url de staging>" node scripts/marcar-staging.mjs\n' +
    '       (reescribe el marcador limpio; no toca ni una fila). Hazlo solo si lo sabes:\n' +
    '       quitárselo a una tanda VIVA reproduce exactamente el problema que esto evita.\n'
  );
}

/** El mensaje de haber PERDIDO el turno a mitad: otra sesión lo reclamó y puede estar escribiendo. */
export function mensajeLockPerdido({ db, marcaPropia, marcaActual }) {
  return (
    '\n❌ SCRUM-188: PERDÍ EL TURNO DE STAGING A MITAD DE LA TANDA.\n' +
    `   Base "${db}": el marcador ya no es el mío.\n` +
    `     mío:    ${marcaPropia}\n` +
    `     ahora:  ${marcaActual === null ? '(sin marcador)' : marcaActual}\n\n` +
    '   Otra sesión lo dio por rancio y entró. Los resultados de esta tanda NO son evidencia de\n' +
    '   nada: otra cosa ha podido crear y borrar merchants por debajo mientras corría.\n' +
    '   Espera a tener la base para ti y vuelve a lanzarla entera.\n'
  );
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// CAPA DE BD — el cliente se INYECTA. Quien lo construye aplica antes la allowlist de host.
// ─────────────────────────────────────────────────────────────────────────────────────────

// Sin parámetros ni interpolación: constante. `now()` sale de la MISMA consulta que la marca
// para que el reloj que juzga la caducidad sea el de la base, no el de quien pregunta.
const SQL_LEER = `
  SELECT current_database()                    AS db,
         shobj_description(oid, 'pg_database') AS marca,
         now()                                 AS ahora
  FROM pg_database WHERE datname = current_database()`;

/** Lee el marcador CRUDO y el reloj de la base. No interpreta nada. */
export async function leerMarcaCruda(cliente) {
  const filas = await cliente.$queryRawUnsafe(SQL_LEER);
  const f = filas?.[0] ?? {};
  return {
    db: f.db ?? '(desconocida)',
    marca: f.marca ?? null,
    ahoraMs: f.ahora instanceof Date ? f.ahora.getTime() : Date.parse(f.ahora),
  };
}

/**
 * Escribe el marcador. `marca` SIEMPRE viene de `componerMarca()` o es `MARCADOR`, y se
 * revalida aquí contra el charset seguro antes de tocar SQL: el `format('%I')` protege el
 * NOMBRE de la base, y este chequeo protege el TEXTO. Interpolar sin él sería la superficie.
 */
async function escribirMarca(cliente, marca) {
  if (!RE_MARCA_SEGURA.test(marca)) {
    throw new Error('SCRUM-188: marca fuera del charset seguro — abortado antes de tocar SQL.');
  }
  await cliente.$executeRawUnsafe(
    `DO $$ BEGIN EXECUTE format('COMMENT ON DATABASE %I IS %L', current_database(), '${marca}'); END $$;`,
  );
}

/**
 * Serializa un leer-decidir-escribir contra el catálogo. Sin esto, dos runners que arrancan a
 * la vez leen los dos «libre» y escriben los dos: los dos se creen dueños y se pisan — que es
 * EXACTAMENTE el fallo que este ticket existe para cerrar. `pg_advisory_xact_lock` se suelta
 * solo al acabar la transacción (incluso si revienta), así que no añade un segundo lock que
 * se pueda quedar puesto.
 */
async function enSeccionCritica(cliente, fn) {
  return cliente.$transaction(async (tx) => {
    // `$executeRawUnsafe` y no `$queryRawUnsafe`, aunque sea un SELECT: `pg_advisory_xact_lock`
    // devuelve `void` y Prisma revienta al deserializar esa columna («Failed to deserialize
    // column of type 'void'»). Medido contra staging el 28-jul-2026 — con `$queryRaw` el turno
    // NO se podía tomar y la tanda abortaba con exit=2. `$executeRaw` no deserializa: devuelve
    // el recuento de filas y ya. Lo cazó el E2E real; los tests con doble no podían verlo.
    await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock($1::bigint)', CLAVE_ADVISORY);
    return fn(tx);
  });
}

/**
 * Toma el turno. NUNCA marca una base que no lo estuviera ya: si la marca no lleva el prefijo
 * de SCRUM-118, aborta. Esa propiedad es la que impide que esto se convierta en un segundo
 * `marcar-staging.mjs` capaz de convertir producción en falso-staging.
 *
 * @returns {{ok:true, db, marca, ahoraMs, reclamado:boolean, lockPrevio:object|null, sufijoIgnorado:boolean}}
 *        | {ok:false, motivo:'no-es-staging', db, marca}
 *        | {ok:false, motivo:'ocupado', db, lock, ahoraMs, ttlMs}
 */
export async function adquirirLock(
  cliente,
  { dueño, ttlMs = TTL_POR_DEFECTO_MS, tipo = null, ref = null, finPrevistoMs = null },
) {
  return enSeccionCritica(cliente, async (tx) => {
    const { db, marca, ahoraMs } = await leerMarcaCruda(tx);

    if (!esMarcaDeStaging(marca)) {
      return { ok: false, motivo: 'no-es-staging', db, marca };
    }

    const lock = parsearLock(marca);
    if (lock && !estaRancio(lock, ahoraMs, ttlMs)) {
      // SCRUM-232 · al rechazar se devuelve TAMBIÉN qué está corriendo, para que quien llega
      // pueda decidir sin romper el lock. Leerlo no puede tumbar el rechazo: si el contexto
      // falla o no se entiende, `contexto` queda a null y el mensaje degrada al de antes.
      let contexto = null;
      try {
        contexto = parsearContexto(await leerComentarioSchema(tx), lock.dueño);
      } catch { /* advisory: nunca decide nada */ }
      return { ok: false, motivo: 'ocupado', db, lock, ahoraMs, ttlMs, contexto };
    }

    const sufijoIgnorado = tieneSufijoIlegible(marca);
    const nueva = componerMarca(dueño, ahoraMs);
    await escribirMarca(tx, nueva);

    // SCRUM-232 · el contexto se escribe DESPUÉS del marcador y es best-effort: `fijarContexto`
    // no propaga. Si no se pasa `tipo`, no se escribe nada nuevo — pero SÍ se borra el que
    // hubiera, porque dejar el de la sesión anterior describiría una tanda que ya no corre.
    const contexto = tipo
      ? componerContexto({ dueño, tipo, ref, finPrevistoMs: finPrevistoMs ?? ahoraMs + ttlMs })
      : null;
    const ctxRes = await fijarContexto(tx, contexto);

    return {
      ok: true, db, marca: nueva, ahoraMs,
      reclamado: Boolean(lock), lockPrevio: lock, sufijoIgnorado,
      contexto, contextoEscrito: ctxRes.ok, contextoMotivo: ctxRes.motivo ?? null,
    };
  });
}

/**
 * Renueva el timestamp del turno propio. Se llama ENTRE hijos: es lo que permite que el TTL
 * sea corto sin caducar a mitad de una tanda larga (el padre está bloqueado en `spawnSync`,
 * no hay bucle de eventos donde poner un temporizador).
 * Si el marcador ya no es el nuestro, NO lo pisa: lo reporta.
 */
export async function refrescarLock(cliente, { marcaPropia, dueño }) {
  return enSeccionCritica(cliente, async (tx) => {
    const { db, marca, ahoraMs } = await leerMarcaCruda(tx);
    if (marca !== marcaPropia) {
      return { ok: false, motivo: 'perdido', db, marcaActual: marca };
    }
    const nueva = componerMarca(dueño, ahoraMs);
    await escribirMarca(tx, nueva);
    return { ok: true, db, marca: nueva, ahoraMs };
  });
}

/**
 * Suelta el turno dejando el marcador LIMPIO (`YAQU_STAGING` a secas).
 * Solo si sigue siendo el nuestro: si otra sesión lo reclamó por rancio, quitárselo sería
 * reproducir el problema. Es best-effort por diseño — el mecanismo que de verdad garantiza
 * que el turno se libera es el TTL, no esta llamada.
 */
export async function soltarLock(cliente, { marcaPropia }) {
  return enSeccionCritica(cliente, async (tx) => {
    const { db, marca } = await leerMarcaCruda(tx);
    if (marca !== marcaPropia) {
      return { ok: true, soltado: false, db, marcaActual: marca };
    }
    await escribirMarca(tx, MARCADOR);
    // SCRUM-232 · al soltar se retira el contexto y se restaura lo que hubiera delante en el
    // comentario del schema. Best-effort, igual que al tomarlo: un contexto huérfano ya se
    // descarta al leerlo por no coincidir el dueño, así que esto es limpieza, no corrección.
    await fijarContexto(tx, null);
    return { ok: true, soltado: true, db };
  });
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-232 · EL CONTEXTO: qué está corriendo, no solo quién lo tiene
// ═════════════════════════════════════════════════════════════════════════════════════════
//
// EL HUECO: el marcador identifica `máquina.pid`. Con eso se sabe QUE está ocupado y nada más.
// Quien llega no puede decidir si le compensa esperar 3 minutos o 40, ni si es su propia otra
// sesión, así que solo le quedan dos conductas: esperar a ciegas o romper el lock. La segunda
// es justo la que el turno existe para impedir, y la falta de información empuja hacia ella
// cada vez que la espera se hace larga.
//
// ⚠️ POR QUÉ EL CONTEXTO NO VA DENTRO DEL MARCADOR, que es lo que parecía obvio.
//
// `RE_LOCK` está anclado con `$`. MEDIDO contra el código de este mismo fichero: una marca con
// un campo de más da `esMarcaDeStaging === true` (la barrera aguanta, bien) pero
// `parsearLock === null`. Y en `adquirirLock` la decisión es `if (lock && !estaRancio(…))`, así
// que un `null` NO significa «ocupado»: cae al else y TOMA EL TURNO.
//
// O sea que meter el contexto en el marcador haría que cualquier sesión con el código anterior
// viese el turno LIBRE y se lo quitase a una tanda viva — exactamente el «verde por accidente»
// que SCRUM-188 evita. Y la ventana no la controla quien despliega: dura hasta que cada uno de
// los ~33 worktrees rebase. La doctrina «ilegible === libre» es correcta para la barrera y es
// justo lo que muerde al evolucionar el formato.
//
// Por eso el contexto vive en OTRO sitio: el comentario del schema `public`. El
// `COMMENT ON DATABASE` no cambia ni un byte, así que el código anterior sigue leyendo un turno
// válido y rechazando bien. El contexto es ADVISORY: si falta, si no se entiende o si es de
// otro dueño, se ignora y el mensaje degrada exactamente al de hoy. Nunca decide nada.
//
// PERMISO VERIFICADO contra staging el 30-jul-2026, escribiendo y deshaciéndolo dentro de una
// transacción (el DDL es transaccional en PostgreSQL): `COMMENT ON SCHEMA public` permitido.
// La igualdad de nombres decía que no —el dueño es `pg_database_owner`, no `postgres`— pero
// `pg_has_role(current_user, nspowner, 'USAGE')` dice que sí. Deducir por el nombre habría
// descartado la opción buena.
//
// Y EL SLOT NO ESTABA VACÍO: traía `standard public schema`, la descripción estándar de
// PostgreSQL. No se pisa. El contexto va como SUFIJO y al soltarlo se restaura lo que hubiera,
// sin hardcodear ese texto — la misma doctrina con la que SCRUM-118 convive con el marcador.

/** Marca de nuestro sufijo en el comentario del schema. */
export const CTX_PREFIJO = 'YAQUCTX:';

/** Vocabulario CERRADO del tipo de ejecución. Lista abierta = campo que no se puede razonar. */
export const TIPOS_EJECUCION = ['gated', 'suelto'];

const RE_CTX = new RegExp(
  '^' + CTX_PREFIJO +
  '([A-Za-z0-9._-]{1,64})' +                                   // dueño
  '@(\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z)' +   // fin previsto
  '\\+(' + TIPOS_EJECUCION.join('|') + ')' +                   // tipo
  '\\+([A-Za-z0-9._/-]{1,64})$',                               // ref (ticket o rama)
);

/** Charset del comentario del schema antes de tocar SQL. Sin comilla, barra invertida ni dólar. */
const RE_CTX_SEGURO = /^[A-Za-z0-9._:@+/ -]{0,300}$/;

/** Separa el comentario del schema en «lo que ya había» y «nuestro sufijo». */
export function separarContexto(comentario) {
  if (typeof comentario !== 'string' || comentario === '') return { base: '', crudo: null };
  const i = comentario.indexOf(CTX_PREFIJO);
  if (i === -1) return { base: comentario, crudo: null };
  return { base: comentario.slice(0, i).trimEnd(), crudo: comentario.slice(i) };
}

/**
 * Lee el contexto. Devuelve `null` si no hay, si no se entiende, o si es de OTRO dueño.
 *
 * Lo del dueño no es cosmético: el código anterior a este ticket toma el turno escribiendo solo
 * el marcador, así que puede dejar aquí el contexto de la sesión anterior. Un contexto que
 * describe una tanda que ya no corre es peor que no tener contexto — por eso va CLAVADO al
 * dueño y se descarta si no coincide con el del marcador.
 */
export function parsearContexto(comentario, dueñoDelMarcador) {
  const { crudo } = separarContexto(comentario);
  if (!crudo) return null;
  const m = RE_CTX.exec(crudo);
  if (!m) return null;
  const finMs = Date.parse(m[2]);
  if (!Number.isFinite(finMs)) return null;
  if (dueñoDelMarcador && m[1] !== dueñoDelMarcador) return null; // contexto huérfano
  return { dueño: m[1], finIso: m[2], finMs, tipo: m[3], ref: m[4] };
}

/** Compone el sufijo. Lanza antes de escribir si no fuese representable (fail-closed barato). */
export function componerContexto({ dueño, tipo, ref, finPrevistoMs }) {
  const finIso = new Date(finPrevistoMs).toISOString();
  const limpia = (v, porDefecto) =>
    String(v ?? '').replace(/[^A-Za-z0-9._/-]/g, '-').slice(0, 64) || porDefecto;
  const refLimpia = limpia(ref, 'sin-ref');
  const crudo = CTX_PREFIJO + dueño + '@' + finIso + '+' + tipo + '+' + refLimpia;
  if (!parsearContexto(crudo, dueño)) {
    throw new Error('SCRUM-232: contexto no representable para ' +
      JSON.stringify({ dueño, tipo, ref }) + ' — no se escribe nada.');
  }
  return crudo;
}

/** Une la base preservada con el sufijo (o lo quita, si `crudo` es null). */
export function componerComentarioSchema(base, crudo) {
  const b = (base ?? '').trimEnd();
  const texto = crudo ? (b ? b + ' ' + crudo : crudo) : b;
  if (!RE_CTX_SEGURO.test(texto)) {
    throw new Error('SCRUM-232: comentario de schema fuera del charset seguro — no se escribe nada.');
  }
  return texto;
}

const SQL_LEER_CTX =
  "SELECT obj_description(oid, 'pg_namespace') AS comentario FROM pg_namespace WHERE nspname = 'public'";

/** Lee el comentario CRUDO del schema. No interpreta nada. */
export async function leerComentarioSchema(cliente) {
  const filas = await cliente.$queryRawUnsafe(SQL_LEER_CTX);
  return filas?.[0]?.comentario ?? null;
}

async function escribirComentarioSchema(cliente, texto) {
  if (!RE_CTX_SEGURO.test(texto)) {
    throw new Error('SCRUM-232: comentario de schema fuera del charset seguro — abortado antes de tocar SQL.');
  }
  await cliente.$executeRawUnsafe(
    "DO $$ BEGIN EXECUTE format('COMMENT ON SCHEMA public IS %L', '" + texto + "'); END $$;",
  );
}

/**
 * Escribe (o borra, con `contexto = null`) el contexto, PRESERVANDO lo que hubiera delante.
 *
 * Es best-effort por diseño y NUNCA propaga: el turno ya está tomado cuando esto corre, y que
 * falle un dato informativo no puede tumbar una tanda. Si esto se cae, el mensaje de quien
 * llegue degrada al de antes de este ticket, que es exactamente lo que había.
 */
export async function fijarContexto(cliente, contexto) {
  try {
    const actual = await leerComentarioSchema(cliente);
    const { base } = separarContexto(actual);
    await escribirComentarioSchema(cliente, componerComentarioSchema(base, contexto));
    return { ok: true };
  } catch (err) {
    return { ok: false, motivo: String(err?.message ?? err).slice(0, 200) };
  }
}

/** Las líneas que el contexto añade al mensaje de turno ajeno. Nunca vacías: el «no consta» informa. */
export function lineasDeContexto(ctx, ahoraMs) {
  if (!ctx) {
    return '   Qué está corriendo: NO CONSTA (esa sesión no dejó contexto — código anterior a SCRUM-232).\n';
  }
  const restante = ctx.finMs > ahoraMs ? formatearDuracion(ctx.finMs - ahoraMs) : null;
  const queEs = ctx.tipo === 'gated' ? 'tanda gateada completa' : 'ejecución puntual';
  return (
    '   Qué está corriendo: ' + queEs + ' de «' + ctx.ref + '».\n' +
    (restante
      ? '   Estimado: le quedan ~' + restante + ' (no es el TTL: es lo que dijo durar).\n'
      : '   Estimado: ya debería haber terminado (dijo acabar a las ' + ctx.finIso + '); puede haber muerto.\n')
  );
}
