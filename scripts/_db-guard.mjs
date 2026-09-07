// scripts/_db-guard.mjs — SCRUM-118: identidad, no patrón de texto.
//
// ANTES (SCRUM-60/79/38, tres copias independientes): cada guard comprobaba
// `url.includes('autorack.proxy.rlwy.net')` por su cuenta — un DESCARTE de una cadena
// conocida-mala. Si Railway rota el host de prod, alguien usa un pooler, una IP o un
// alias, esa cadena deja de aparecer en la URL y el guard pasa CUALQUIER OTRA COSA
// "limpio" — incluida producción. El propio SCRUM-118 lo resume: "lo que hoy impide un
// desastre no es el guard: es que nadie ha tenido a mano una URL de prod con otro host."
//
// AHORA: PERTENENCIA. `assertSafeStagingUrl` compara el host, parseado de verdad
// (`new URL().hostname`, nunca `.includes()`), contra una ALLOWLIST del único host de
// staging conocido. Cualquier host que no sea EXACTAMENTE ese falla CERRADO — incluida
// una futura producción con host distinto, un pooler, o una URL mal formada. Ya no
// importa si el texto "contiene" o "no contiene" nada: importa a qué host pertenece.
//
// Multi-BD en el mismo host de staging (SCRUM-84: varias bases en un solo Postgres) sigue
// funcionando igual que antes — el criterio es el HOST, no el nombre de la base ni el path.
//
// Un solo lugar que sabe cuáles son los hosts reales — antes había tres copias del mismo
// string que podían divergir en silencio; ahora hay una.
import { inspect } from 'node:util';

export const PROD_HOST = 'autorack.proxy.rlwy.net';
export const STAGING_HOST = 'acela.proxy.rlwy.net';

function hostOf(urlStr) {
  if (!urlStr) return null;
  try {
    return new URL(urlStr).hostname;
  } catch {
    return null; // URL ilegible: nunca se trata como "probablemente segura"
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// SCRUM-195 — PARSEO DE URL DE BD QUE NO PUEDE FILTRAR LA CONTRASEÑA.
//
// De dónde sale esto: en esta misma tarea, un script de medición leyó `DATABASE_URL` sin
// quitarle las comillas del `.env` y llamó a `new URL(...)` a pelo. `new URL()` NO redacta:
// su `ERR_INVALID_URL` lleva la cadena ENTERA en el `.message`, así que el error volcó la
// URL de PRODUCCIÓN CON SU CONTRASEÑA a la salida del comando. Hubo que rotar la credencial.
//
// La lección no es «acuérdate de envolver en try». Nadie se acuerda a las 2 de la mañana. Es
// que **el parseo de una URL con credenciales dentro tiene que vivir en una función que no
// tenga forma de imprimirla**, y que todo el que toque una BD importe ESA. Por eso vive aquí,
// junto a los hosts: quien mira una URL de BD ya pasa por este fichero.
//
// El guard de `tests/scrum195-url-bd-sin-fuga.test.mjs` es quien lo sostiene.
// ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * Parsea una URL de base de datos SIN QUE NINGÚN CAMINO PUEDA DEVOLVER LA CADENA.
 * Tolera el envoltorio de comillas que suele traer un valor copiado de `.env`.
 * @returns {{host: string, base: string, usuario: string, puerto: string} | null}
 */
export function parseBDSegura(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return null;
  // Las comillas sobrantes de `.env` son EXACTAMENTE lo que provocó la fuga: sin quitarlas,
  // `new URL()` lanza y el mensaje que lanza lleva la contraseña dentro.
  const limpia = urlStr.trim().replace(/^['"]|['"]$/g, '');
  try {
    const u = new URL(limpia);
    // Se devuelven SOLO partes inocuas. `u.password` y `u.href` no salen de aquí jamás.
    return {
      host: u.hostname,
      base: u.pathname.replace(/^\//, ''),
      usuario: u.username || '',
      puerto: u.port || '',
    };
  } catch {
    // Sin `err`, a propósito: si se capturase el error, alguien acabaría imprimiéndolo, y su
    // `.message` ES la URL completa. Aquí no hay nada que imprimir.
    return null;
  }
}

/**
 * SCRUM-408 · LA URL PARTIDA PARA UN PROCESO HIJO, sin que nadie la parsee a pelo.
 *
 * `parseBDSegura` no vale aquí y eso es DELIBERADO: devuelve solo partes inocuas y **nunca** la
 * contraseña. Pero un hijo como `pg_dump` necesita las dos cosas —la URL SIN contraseña para el
 * argv y la contraseña para su entorno—, así que alguien tiene que partirla. La pregunta no es si
 * se parte, es DÓNDE.
 *
 * Se parte AQUÍ, en el único módulo exento del guard de SCRUM-195, y por su mismo motivo: es donde
 * el `new URL` vive dentro de un `try` cuyo `catch` **no toca el error**. Hacerlo en cada script
 * que lo necesite deja la seguridad en manos de que cada `catch` sea correcto para siempre — y esa
 * apuesta ya se perdió una vez, con una credencial de producción por medio.
 *
 * ⚠️ DEVUELVE LA CONTRASEÑA, y por eso conviene decir qué NO devuelve: la URL completa no sale de
 * aquí. Quien recibe esto tiene un secreto en una variable —que es inevitable si va a autenticar—
 * pero no una cadena lista para imprimir por accidente.
 *
 * Tolera las comillas de `.env`, que son la causa exacta de aquella fuga. `null` si no se puede
 * parsear: sin `err`, porque capturarlo es como acaba imprimiéndose.
 */
export function partirBDParaHijo(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return null;
  const limpia = urlStr.trim().replace(/^['"]|['"]$/g, '');
  try {
    const u = new URL(limpia);
    const password = u.password ? decodeURIComponent(u.password) : '';
    u.password = ''; // lo que verán argv, `ps` y cualquier e.message: URL SIN contraseña
    return { urlSinPass: u.toString(), password };
  } catch {
    return null;
  }
}

/**
 * Etiqueta segura para logs: `host/base`. Nunca usuario:contraseña, nunca la URL.
 * Es lo que hay que imprimir en un host-check antes de tocar una BD.
 */
export function describirBD(urlStr) {
  const p = parseBDSegura(urlStr);
  if (!p) return '(URL de BD ilegible)'; // sin la cadena: ilegible ya es toda la información útil
  return `${p.host}/${p.base}`;
}

/**
 * ÚLTIMA LÍNEA: quita credenciales de algo que va a imprimirse.
 *
 * `parseBDSegura` sirve cuando TÚ parseas. Esto sirve cuando la cadena te llega dentro de un
 * error ajeno que no controlas. DÓNDE VIAJA EXACTAMENTE, medido en Node 24, no supuesto —
 * porque la intuición falla justo aquí:
 *
 *   vector                        ¿en `.message`?                    ¿al volcar el objeto?
 *   ───────────────────────────── ────────────────────────────────── ─────────────────────
 *   `new URL(mala)`               NO — solo dice «Invalid URL»        SÍ, en `e.input`
 *   `execFileSync` ENOENT         NO                                  SÍ, en `e.spawnargs`
 *   `execFileSync` exit ≠ 0       SÍ — «Command failed: … <argv>»     SÍ
 *
 * O sea que el reflejo de `console.error(e.message)` NO habría evitado la fuga de esta tarea:
 * ahí el mensaje era limpio y la URL iba en `e.input`, y lo que la publicó fue el volcado del
 * OBJETO por el manejador de excepciones no capturadas. Por eso esto acepta objetos: si no es
 * una cadena, se inspecciona y se redacta la inspección, propiedades incluidas.
 *
 * Se redacta la CONTRASEÑA y se deja el host: el host hace falta para diagnosticar y es
 * público; redactarlo también dejaría el error inútil y empujaría a quitar el redactor.
 */
export function redactarSecretos(valor) {
  if (valor == null) return valor;
  const texto = typeof valor === 'string'
    ? valor
    // `inspect` saca las propiedades propias del Error (`input`, `spawnargs`), que es donde
    // viaja la credencial en dos de los tres vectores de la tabla de arriba.
    : inspect(valor, { depth: 4 });
  return texto
    // usuario:contraseña@ en cualquier URL con esquema (postgres, postgresql, redis, amqp…)
    .replace(/([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)([^:/@\s]+):([^@\s]+)@/g, '$1$2:***@')
    // y la forma sin usuario, por si acaso
    .replace(/([a-zA-Z][a-zA-Z0-9+.-]*:\/\/):([^@\s]+)@/g, '$1:***@');
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// SCRUM-381 — DÓNDE PUEDE SEMBRAR UN SEMBRADOR.
//
// `seed-demo.mjs` traía escrita su propia condición de endurecimiento (SCRUM-208, 29-jul-2026):
// «Si algún día se confirma que producción nunca debe ser destino de una semilla, se endurece
// con la allowlist de host de SCRUM-118». El asesor lo confirmó el 6-ago-2026, y esto es esa
// allowlist.
//
// Por qué importa más que la etiqueta `semilla` del AuditLog: la etiqueta hace DISTINGUIBLE un
// número sembrado; esto impide que llegue a escribirse en una base real. El problema de fondo
// nunca fue cómo se llama la fila — era que un script de siembra pudiera crearla en producción.
//
// ⚠️ ALLOWLIST, no lista negra de producción — y no es una preferencia de estilo: es
// literalmente el defecto que SCRUM-118 quitó de este mismo fichero (ver cabecera). Comprobar
// `host !== PROD_HOST` deja pasar CUALQUIER host desconocido: una prod rotada, un pooler, una
// IP, un alias. Aquí lo desconocido falla CERRADO.
//
// Ampliarla es un cambio de CÓDIGO a propósito, no una variable de entorno: si un destino de
// desarrollo legítimo no está, se añade aquí y se ve en el diff. Una vía de escape por entorno
// convertiría el guard en un trámite («exporta la variable y sigue»), que es como se saltan los
// guards de verdad.
// ─────────────────────────────────────────────────────────────────────────────────────────

/** Los únicos hosts donde un sembrador puede escribir. `PROD_HOST` no está, y no puede estar. */
export const DESTINOS_SEMBRABLES = Object.freeze([
  STAGING_HOST,       // staging, y las demás bases del mismo Postgres (SCRUM-84: el criterio es el HOST)
  'localhost',
  '127.0.0.1',
  '[::1]',            // `new URL()` devuelve el IPv6 entre corchetes
]);

/**
 * ¿Puede un sembrador escribir en esta BD? Fail-closed.
 *
 * NO devuelve la URL por ningún camino: `etiqueta` es `host/base`, que es lo que hace falta
 * para saber dónde ibas a sembrar y es información pública. Usuario, contraseña y cadena
 * completa no salen de `parseBDSegura`.
 * @returns {{ok: true, etiqueta: string} | {ok: false, etiqueta: string, motivo: string}}
 */
export function destinoSembrable(urlStr) {
  const p = parseBDSegura(urlStr);
  // Ilegible ya es toda la información útil: sin la cadena, a propósito (R7).
  if (!p) return { ok: false, etiqueta: '(URL de BD ilegible)', motivo: 'la URL de la BD no se pudo parsear' };

  const etiqueta = `${p.host}/${p.base}`;
  if (!DESTINOS_SEMBRABLES.includes(p.host)) {
    return {
      ok: false,
      etiqueta,
      motivo: p.host === PROD_HOST
        ? 'ESE HOST ES PRODUCCIÓN. Un sembrador no escribe ahí: borra y recrea datos, y sus ' +
          'números de factura entran en el AuditLog como si fueran emisiones.'
        : `el host «${p.host}» no está en DESTINOS_SEMBRABLES (scripts/_db-guard.mjs), así que ` +
          'no se trata como sembrable. Un host desconocido falla cerrado a propósito: puede ser ' +
          'una producción con otro nombre. Si es un destino de desarrollo legítimo, añádelo AHÍ ' +
          '— no hay variable de entorno que se lo salte.',
    };
  }
  return { ok: true, etiqueta };
}

// ── SCRUM-746 (fase B) · EL DESTINO DESECHABLE, Y POR QUÉ NO VALE `destinoSembrable` ────────
//
// Un SEMBRADOR puede escribir en staging: añade filas de demo y no se lleva nada por delante.
// Una RESTAURACIÓN no: sobrescribe la base ENTERA con otra, y eso no se deshace. Por eso su
// allowlist es más estrecha —ni producción ni staging— y por eso son dos funciones y no una con
// un parámetro: el día que alguien pase el flag equivocado, la diferencia es una base perdida.
//
// 🔴 LA REGLA NO ES NUEVA: es la que `_scratch-run.mjs` lleva ejecutando desde SCRUM-242, sacada
// aquí para que la use TAMBIÉN quien escribe. El defecto medido en SCRUM-746 es que vivía sólo en
// el runner: `backup-restore.mjs` tiene su propia entrada de línea de comandos y no comprobaba
// haber llegado por él. No se escribe una segunda comprobación —dos reglas que dicen lo mismo
// acaban diciendo cosas distintas—: se saca ésta y la llaman los dos.
//
// PURA a propósito: recibe la URL y devuelve veredicto. Así su rojo se ejercita sin `.env`, sin
// entorno y sin base, que es la única forma de probar un candado que existe para NO ejecutarse.

/** Los hosts donde una RESTAURACIÓN puede escribir: ni producción ni staging. */
export function destinoDesechable(urlStr) {
  const p = parseBDSegura(urlStr);
  if (!p) {
    // Ilegible o ausente ya es toda la información útil: sin la cadena, a propósito (R7).
    return {
      ok: false,
      etiqueta: '(URL de BD ilegible o ausente)',
      motivo: 'no se pudo leer el destino. «No sé a dónde escribo» NO es «escribo en un sitio seguro».',
    };
  }
  // 🔴 UN HOST VACÍO NO ES UN HOST SEGURO, y esto lo cazó un test antes de que saliera de aquí.
  // `parseBDSegura('postgresql://')` devuelve un objeto con `host: ''` —parseable pero sin
  // destino—, y una LISTA NEGRA («ni producción ni staging») lo dejaba pasar. Es la diferencia
  // que enseña `destinoSembrable`, que es lista BLANCA y por eso falla cerrado con lo raro: una
  // lista negra sólo sabe decir que no a lo que le enseñaron.
  //
  // ⚠️ Y esa limitación se declara en vez de taparla: aquí NO se puede usar lista blanca, porque
  // la base desechable es la que sea (un contenedor, un Postgres local, otro puerto). Lo que se
  // exige es que HAYA destino y que no sea ninguno de los dos prohibidos.
  if (!p.host) {
    return {
      ok: false,
      etiqueta: '(URL sin host)',
      motivo: 'la URL no nombra ningún host. «No sé a dónde escribo» NO es «escribo en un sitio seguro».',
    };
  }
  const etiqueta = `${p.host}/${p.base}`;
  if (p.host === PROD_HOST || p.host === STAGING_HOST) {
    return {
      ok: false,
      etiqueta,
      motivo: p.host === PROD_HOST
        ? 'ESE HOST ES PRODUCCIÓN. Una restauración sobrescribe la base ENTERA: no se deshace.'
        : 'ESE HOST ES STAGING. Una restauración lo sobrescribe entero, y staging es de todo el '
          + 'equipo. La prueba de restauración va contra la base DESECHABLE.',
    };
  }
  return { ok: true, etiqueta };
}

/**
 * ¿Es `candidateUrl` una URL segura para tratar como STAGING (nunca producción)?
 * `prodUrl` es opcional — si se pasa (p. ej. `DATABASE_URL` ya cargado), se usa como
 * defensa adicional en profundidad; si no, el allowlist por sí solo ya es suficiente.
 * @returns {{safe: true} | {safe: false, reason: string}}
 */
export function assertSafeStagingUrl(candidateUrl, prodUrl) {
  if (!candidateUrl) {
    return { safe: false, reason: 'no se proporcionó ninguna URL' };
  }

  const candidateHost = hostOf(candidateUrl);
  if (!candidateHost) {
    return { safe: false, reason: 'la URL no se pudo parsear (formato inválido)' };
  }

  // ALLOWLIST: el host debe SER el de staging — no basta con que "no sea" el de prod.
  // Un host desconocido (rotación, pooler, IP, alias) no pasa nunca, ni por descarte.
  if (candidateHost !== STAGING_HOST) {
    return {
      safe: false,
      reason: `host "${candidateHost}" no está en la allowlist de staging (se esperaba "${STAGING_HOST}")`,
    };
  }

  // Defensa en profundidad: comparación por IDENTIDAD contra la prod real configurada,
  // no por texto. Cubre el caso límite de que la allowlist quedase mal actualizada.
  if (prodUrl) {
    const prodHost = hostOf(prodUrl);
    if (prodHost && candidateHost === prodHost) {
      return { safe: false, reason: 'el host de staging coincide con el host de producción configurado' };
    }
    if (candidateUrl === prodUrl) {
      return { safe: false, reason: 'la URL de staging es IDÉNTICA a la URL de producción configurada' };
    }
  }

  return { safe: true };
}
