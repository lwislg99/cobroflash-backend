// scripts/_credenciales-en-texto.mjs — SCRUM-835
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// CREDENCIALES EN EL HISTORIAL DE UN REPOSITORIO PÚBLICO
//
// ── POR QUÉ EL HISTORIAL Y NO EL ÁRBOL ──────────────────────────────────────────────────────
// Este repositorio es PÚBLICO. Una clave que se subió y se borró al día siguiente **sigue
// publicada**: el commit que la introdujo continúa siendo alcanzable, y cualquiera puede leerlo.
// Barrer `HEAD` contesta «hoy no hay», que es otra pregunta. Aquí se leen TODOS los blobs del
// repositorio (`git cat-file --batch-all-objects`), incluidos los que ya no cuelgan de ninguna rama.
//
// ── POR QUÉ POR FORMA Y NO POR NOMBRE ───────────────────────────────────────────────────────
// Buscar `password` encuentra la PALABRA, no la clave: aparece en cien comentarios y en ningún
// secreto. Lo que identifica a una credencial es su FORMA — el prefijo que le pone el proveedor,
// el bloque PEM, o el `usuario:clave@host` de una cadena de conexión.
//
// ── 🔴 LAS SEÑALES VAN PARTIDAS, Y NO ES ESTÉTICA ───────────────────────────────────────────
// Escritas enteras, este fichero contendría cadenas con forma de clave y **el barrido se
// denunciaría a sí mismo** — la autorreferencia que ya mordió cuatro veces en un día (SCRUM-693,
// 694). Y además violaría el ⛔ de la casa: ninguna clave de Stripe, ni real ni de ejemplo, en
// ningún fichero, comentario ni mensaje.
//
// ── 🔴 LA FALSA ALARMA QUE ESTE MÓDULO YA HA COMETIDO, MEDIDA EL 9-sep-2026 ────────────────
// La primera versión dio **12 hallazgos** de cadena de conexión y NINGUNO lo era. Dos de ellos
// tenían por «contraseña» un `${…}`: una INTERPOLACIÓN de plantilla, o sea el nombre de una
// variable, no su valor. El instrumento leía `usuario:${SECRETO}@host` y cantaba credencial.
//
// 🔒 Una plantilla no es un valor. Un detector que no distingue el hueco de lo que va dentro
// acusa al código que hace las cosas BIEN — que es el que usa variables.
//
// Por eso `esHueco` va antes que cualquier veredicto, y por eso el control negativo de abajo
// lleva las cinco formas de hueco que se usan aquí (`${x}`, `$X`, `%X%`, `<x>`, `{{x}}`).
// ═════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Cada señal es una FORMA. El nombre dice QUÉ es, para poder informar sin publicar el valor.
 * Las cadenas se construyen partidas para que este fichero no case consigo mismo.
 */
export const SENALES = [
  ['clave-privada-pem', /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/],
  ['aws-access-key-id', new RegExp('AK' + 'IA[0-9A-Z]{16}')],
  ['stripe-secreta', new RegExp('\\b' + 's' + 'k_(?:live|test)_[0-9A-Za-z]{20,}')],
  ['stripe-restringida', new RegExp('\\b' + 'r' + 'k_(?:live|test)_[0-9A-Za-z]{20,}')],
  ['stripe-webhook', new RegExp('\\b' + 'wh' + 'sec_[0-9A-Za-z]{20,}')],
  ['github-token', new RegExp('\\b' + 'gh' + '[pousr]_[0-9A-Za-z]{36,}')],
  ['github-pat-fino', new RegExp('\\b' + 'github' + '_pat_[0-9A-Za-z_]{40,}')],
  ['google-api-key', new RegExp('\\b' + 'AI' + 'za[0-9A-Za-z_\\-]{35}')],
  ['slack-token', new RegExp('\\b' + 'xox' + '[baprs]-[0-9A-Za-z-]{10,}')],
  ['openai-anthropic', new RegExp('\\b' + 's' + 'k-(?:ant-|proj-)?[0-9A-Za-z_\\-]{32,}')],
  ['meta-whatsapp-token', new RegExp('\\b' + 'EA' + 'A[0-9A-Za-z]{60,}')],
  ['sendgrid', new RegExp('\\b' + 'S' + 'G\\.[0-9A-Za-z_\\-]{20,}\\.[0-9A-Za-z_\\-]{20,}')],
  ['twilio-secreto', new RegExp('\\b' + 'S' + 'K[0-9a-f]{32}\\b')],
  ['mailgun', new RegExp('\\b' + 'key' + '-[0-9a-f]{32}\\b')],
  ['resend', new RegExp('\\b' + 're' + '_[0-9A-Za-z]{24,}')],
  ['mercadopago', new RegExp('\\b' + 'APP' + '_USR-[0-9A-Za-z-]{20,}')],
  ['jwt-con-carga', /\beyJ[0-9A-Za-z_-]{10,}\.eyJ[0-9A-Za-z_-]{10,}\.[0-9A-Za-z_-]{10,}/],
];

/** La cadena de conexión se trata aparte: hay que mirar SUS TRES PIEZAS antes de acusar. */
export const CONEXION = /\b(postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|rediss|amqps?):\/\/([^:@\s/]+):([^@\s/]{3,})@([^/\s:"'`)\]]+)/g;

/**
 * ¿Este trozo es un HUECO —una plantilla, una variable— en vez de un valor?
 *
 * Las cinco formas que se usan de verdad en este árbol: `${x}` de JS, `$X` de shell, `%X%` de
 * cmd, `<x>` de la documentación y `{{x}}` de las plantillas.
 */
export function esHueco(trozo) {
  const s = String(trozo ?? '');
  return /\$\{|\{\{|^\$[A-Za-z_]|^%[A-Za-z_].*%$|^<[^>]*>$|^\{[^}]*\}$/.test(s);
}

/** Usuarios y claves que se escriben cuando se quiere decir «aquí va una». */
const RELLENO = /^(?:u|user|users?name|usuario|usr|p|pass(?:word)?|clave|secreto|secret|token|x+|y+|z+|123\d*|abc\d*|foo|bar|baz|test|dummy|fake|ejemplo|example|placeholder|changeme|tu_.*|your_.*|mi_.*|<.*>)$/i;

/** Hosts que no son el servidor de nadie. */
const HOST_INOFENSIVO = /^(?:localhost|127\.0\.0\.1|0\.0\.0\.0|::1|host|servidor|db|base|[a-z])$|\.(?:local|invalid|test|example)$|^(?:ejemplo|example)\.(?:com|org|net)$/i;

/**
 * Las credenciales de un texto. Devuelve **sólo el tipo y la posición**, nunca el valor: un
 * informe que cita el secreto lo vuelve a publicar, esta vez donde nadie lo busca.
 */
export function credencialesEn(texto) {
  const t = String(texto ?? '');
  const out = [];
  for (const [tipo, re] of SENALES) {
    const m = re.exec(t);
    if (m) out.push({ tipo, indice: m.index });
  }
  CONEXION.lastIndex = 0;
  for (const m of t.matchAll(CONEXION)) {
    const [, , usuario, clave, host] = m;
    // 🔴 EN ESTE ORDEN. El hueco primero: `usuario:${SECRETO}@host` es código correcto, y
    // acusarlo es acusar justo al que NO escribe la clave.
    if (esHueco(usuario) || esHueco(clave) || esHueco(host)) continue;
    if (RELLENO.test(clave) || RELLENO.test(usuario)) continue;
    if (HOST_INOFENSIVO.test(host)) continue;
    out.push({ tipo: 'cadena-de-conexion', indice: m.index });
  }
  return out;
}
