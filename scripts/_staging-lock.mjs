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

/** El mensaje que se encuentra quien llega y el turno está tomado. Nombra AL DUEÑO y DESDE CUÁNDO. */
export function mensajeLockAjeno({ db, lock, ahoraMs, ttlMs }) {
  const antiguedad = formatearDuracion(ahoraMs - lock.desdeMs);
  const restante = formatearDuracion(lock.desdeMs + ttlMs - ahoraMs);
  return (
    '\n❌ SCRUM-188: EL TURNO DE STAGING ESTÁ TOMADO — la tanda NO arranca.\n' +
    `   Base "${db}": la tiene «${lock.dueño}» desde ${lock.desdeIso} (hace ${antiguedad}).\n` +
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
export async function adquirirLock(cliente, { dueño, ttlMs = TTL_POR_DEFECTO_MS }) {
  return enSeccionCritica(cliente, async (tx) => {
    const { db, marca, ahoraMs } = await leerMarcaCruda(tx);

    if (!esMarcaDeStaging(marca)) {
      return { ok: false, motivo: 'no-es-staging', db, marca };
    }

    const lock = parsearLock(marca);
    if (lock && !estaRancio(lock, ahoraMs, ttlMs)) {
      return { ok: false, motivo: 'ocupado', db, lock, ahoraMs, ttlMs };
    }

    const sufijoIgnorado = tieneSufijoIlegible(marca);
    const nueva = componerMarca(dueño, ahoraMs);
    await escribirMarca(tx, nueva);
    return { ok: true, db, marca: nueva, ahoraMs, reclamado: Boolean(lock), lockPrevio: lock, sufijoIgnorado };
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
    return { ok: true, soltado: true, db };
  });
}
