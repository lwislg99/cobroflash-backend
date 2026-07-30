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
