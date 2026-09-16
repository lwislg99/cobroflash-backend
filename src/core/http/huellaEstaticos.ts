// src/core/http/huellaEstaticos.ts — SCRUM-274
//
// HUELLA DE CONTENIDO EN LOS ESTÁTICOS DEL DASHBOARD, SIN BUILD Y SIN BUNDLER.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO QUE CIERRA
//
// Los 31 `<script>` del dashboard se referencian por su nombre pelado (`./js/api.js`), así que
// **no hay forma de invalidar una copia cacheada**: el fichero nuevo se llama igual que el
// viejo. Por eso SCRUM-231 tuvo que dejarlos en `max-age=0` — correcto, y con un coste que se
// paga entero en CADA despliegue: el `ETag` de `express.static` es **tamaño + mtime**, o sea que
// un deploy lo cambia aunque el contenido sea idéntico y el navegador se rebaja los 33 ficheros
// (~858 KB sin comprimir). Quien lo paga es un profesional con la cobertura de un sótano.
//
// Con la huella EN LA URL, `immutable` es seguro **por construcción**: si el contenido cambia,
// la URL cambia. Y si no cambia, no se baja nada.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ `?v=` Y NO RENOMBRAR EL FICHERO, NI UN BUNDLER
//
// La regla dura 4 del máster es **«Frontend vanilla (sin React/Tailwind/bundler/build)»**. Un
// bundler o un paso de build que renombre ficheros serían un cambio de máster antes de escribir
// una línea. Generar los nombres al desplegar tampoco: sacaría la verdad del repo, que es
// exactamente el defecto que cerró SCRUM-231.
//
// Lo que sí había era un punto de transformación **que ya existe y ya está memoizado**:
// `dashboardHtmlSellado` en `app.ts` lee el HTML del disco UNA vez y le sustituye el sello de
// build. Sellar aquí las referencias no añade ni un fichero al deploy ni un milisegundo por
// petición.
//
// **Y que la query sirva de clave de caché está MEDIDO en producción, no supuesto** (2-ago-2026,
// contra `yaqu.app` con Cloudflare delante): dos `?v=` distintos dan dos `MISS` —o sea, dos
// entradas de caché distintas— y repetir el primero da `REVALIDATED`. Cloudflare incluye la
// query en la clave. Sin esa medición, todo esto sería una creencia sobre un CDN ajeno.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE NO SE SELLA, Y NO ES UNA LISTA
//
// Las referencias EXTERNAS (Google Fonts) quedan fuera **por ser absolutas**, no por una
// allowlist de dominios. Es deliberado: una lista de excepciones envejecería igual que la lista
// de referencias que este ticket viene a eliminar — se añade un dominio y nadie lo mete. La
// propiedad «apunta fuera de este servidor» la tiene la propia URL y no hay que mantenerla.
//
// Y el HTML **jamás** se sella: `index.html` y `/version` siguen `no-store`. La huella protege
// lo que CUELGA del HTML, no el HTML. Si el punto de entrada se cacheara, el usuario quedaría
// apuntando a ficheros viejos para siempre — y encima con URLs marcadas `immutable`. Sería
// convertir el problema en permanente.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/** El parámetro que lleva la huella. Un solo sitio lo define; el guard lo importa de aquí. */
export const PARAM_HUELLA = 'v';

/** `Cache-Control` de una URL con huella VÁLIDA. Un año + immutable: la URL no puede mentir. */
export const CACHE_CON_HUELLA = 'public, max-age=31536000, immutable';

/**
 * ¿La referencia apunta FUERA de este servidor? Absoluta (`https://…`), sin protocolo (`//…`),
 * `data:`, `mailto:` … o un ancla suelta. Ninguna de esas se sella, y ninguna necesita lista.
 */
export function esExterna(ref: string): boolean {
  const r = ref.trim();
  if (r === '' || r.startsWith('#')) return true;
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(r);
}

/** Huella corta y estable del contenido. 10 hex bastan de sobra para distinguir versiones. */
export function huellaDeContenido(contenido: Buffer | string): string {
  return crypto.createHash('sha1').update(contenido).digest('hex').slice(0, 10);
}

/**
 * Resuelve una referencia del HTML al fichero real dentro de `publicDir`.
 *
 * `baseUrl` es la URL desde la que se sirve ese HTML (`/dashboard/`), necesaria porque las
 * referencias son relativas (`./js/api.js`). Devuelve `null` si apunta fuera, si no existe, o
 * si se sale de `publicDir` — este último caso NO es paranoia decorativa: una referencia con
 * `../..` resolvería a un fichero del servidor y le pondríamos huella y `immutable`.
 */
export function resolverEstatico(
  ref: string,
  { publicDir, baseUrl, fsMod = fs }: { publicDir: string; baseUrl: string; fsMod?: typeof fs },
): string | null {
  if (esExterna(ref)) return null;
  const sinQuery = ref.split('#')[0].split('?')[0];
  if (!sinQuery) return null;

  const urlPath = sinQuery.startsWith('/')
    ? sinQuery
    : path.posix.resolve(baseUrl, sinQuery); // `./js/api.js` + `/dashboard/` → `/dashboard/js/api.js`

  const destino = path.resolve(publicDir, '.' + urlPath);
  const raiz = path.resolve(publicDir);
  // `raiz + sep`: sin el separador, `/public-otro` pasaría por estar dentro de `/public`.
  if (destino !== raiz && !destino.startsWith(raiz + path.sep)) return null;

  try {
    if (!fsMod.statSync(destino).isFile()) return null;
  } catch {
    return null;
  }
  return destino;
}

/**
 * Calculadora de huellas con memoria invalidada por `mtime`.
 *
 * ⚠️ LA INVALIDACIÓN POR MTIME NO ES UNA OPTIMIZACIÓN: es lo que hace que este mecanismo
 * DEGRADE BIEN. En desarrollo el HTML está memoizado, así que si alguien edita un `.js` el HTML
 * seguirá sirviendo la huella vieja. Con la invalidación, el fichero servido tiene una huella
 * NUEVA que ya no coincide con la de la URL → no se marca `immutable` → se cae al `max-age=0`
 * de hoy y el navegador revalida. O sea: **cuando este mecanismo se desincroniza, el peor caso
 * es el comportamiento que había antes de existir**, nunca contenido inmutable equivocado.
 */
export function crearHuellas(fsMod: typeof fs = fs) {
  const memoria = new Map<string, { mtimeMs: number; huella: string }>();

  return function huellaDeFichero(rutaAbs: string, stat?: { mtimeMs: number }): string | null {
    try {
      const mtimeMs = stat?.mtimeMs ?? fsMod.statSync(rutaAbs).mtimeMs;
      const previa = memoria.get(rutaAbs);
      if (previa && previa.mtimeMs === mtimeMs) return previa.huella;
      const huella = huellaDeContenido(fsMod.readFileSync(rutaAbs));
      memoria.set(rutaAbs, { mtimeMs, huella });
      return huella;
    } catch {
      return null; // fichero ilegible: se queda sin sellar, que es el estado seguro
    }
  };
}

/** Una referencia del HTML, tal como la ve el sellador. Lo usa el guard para explicar el rojo. */
export type Referencia = {
  atributo: 'src' | 'href';
  valor: string;
  externa: boolean;
  /** Ruta absoluta en disco, o `null` si es externa o no resuelve a un fichero. */
  fichero: string | null;
};

/** Un `src=`/`href=` encontrado en el HTML, con dónde está y cómo estaba escrito. */
type Hallazgo = {
  atributo: 'src' | 'href';
  valor: string;
  /** La comilla con la que venía: `"`, `'`, o cadena vacía si venía sin comillas. */
  comilla: '"' | "'" | '';
  inicio: number;
  fin: number;
};

/**
 * Los tramos del HTML que están DENTRO de un comentario `<!-- … -->`.
 *
 * Se recorre el documento entero de principio a fin, sin ventanas: un comentario puede abarcar
 * cien líneas y una ventana de N no lo vería. Un `<!--` sin cerrar comenta hasta el final, que es
 * justo lo que hace el navegador.
 */
function tramosComentados(html: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let i = 0;
  for (;;) {
    const a = html.indexOf('<!--', i);
    if (a < 0) break;
    const cierre = html.indexOf('-->', a + 4);
    const fin = cierre < 0 ? html.length : cierre + 3;
    out.push([a, fin]);
    i = fin;
  }
  return out;
}

/**
 * EL ÚNICO SITIO QUE DECIDE QUÉ ES UNA REFERENCIA. Lo usan tanto `referenciasDe` (el guard) como
 * `sellarReferencias` (producción): dos regex para el mismo hecho se separan el día que alguien
 * arregla una sola, y ese día el guard aprueba lo que producción sella mal.
 *
 * ── QUÉ FORMAS RECONOCE, Y DE DÓNDE SALE LA LISTA (SCRUM-701) ─────────────────────────────
 * La lista NO se hizo de memoria: se midió sobre los 9 HTML de `public/`. Aparecen dos formas
 * —comillas dobles (163) y comillas simples (2, en `login.html` y `register.html`)— y CERO sin
 * comillas. Se reconocen las tres de todos modos: la tercera no cuesta nada y el HTML lo
 * escribimos a mano.
 *
 * ── LO QUE ESTÁ COMENTADO NO ES UNA REFERENCIA ────────────────────────────────────────────
 * Una etiqueta dentro de `<!-- … -->` no la pide el navegador. Contarla hacía dos cosas malas: el
 * guard exigía que un fichero comentado existiera en disco, y producción reescribía texto muerto.
 *
 * POR QUÉ SIGUE SIN HABER UN PARSER DE HTML: sería una dependencia nueva y eso pide OK del
 * fundador (regla 36). El SUELO por número de referencias del guard existe para que, si el HTML
 * cambia de forma y esto deja de verlas, salte en rojo en vez de aprobar en silencio.
 */
function hallazgosDeReferencia(html: string): Hallazgo[] {
  const comentados = tramosComentados(html);
  const dentroDeComentario = (pos: number) => comentados.some(([a, b]) => pos >= a && pos < b);

  const out: Hallazgo[] = [];
  // Tres alternativas de valor: entre dobles, entre simples, o pelado hasta el primer espacio o `>`.
  const re = /\b(src|href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (dentroDeComentario(m.index)) continue;
    const comilla: '"' | "'" | '' = m[2] !== undefined ? '"' : m[3] !== undefined ? "'" : '';
    const valor = m[2] ?? m[3] ?? m[4] ?? '';
    out.push({
      atributo: m[1].toLowerCase() as 'src' | 'href',
      valor,
      comilla,
      inicio: m.index,
      fin: m.index + m[0].length,
    });
  }
  return out;
}

/** Extrae las referencias `src=` / `href=` de un HTML. Ver `hallazgosDeReferencia`. */
export function referenciasDe(
  html: string,
  opts: { publicDir: string; baseUrl: string; fsMod?: typeof fs },
): Referencia[] {
  return hallazgosDeReferencia(html).map((h) => ({
    atributo: h.atributo,
    valor: h.valor,
    externa: esExterna(h.valor),
    fichero: resolverEstatico(h.valor, opts),
  }));
}

/**
 * Reescribe el HTML añadiendo `?v=<huella>` a cada referencia LOCAL que resuelva a un fichero.
 *
 * Las 31 referencias del dashboard **se quedan como están en el fichero fuente**: nadie mantiene
 * una lista y nadie tiene que acordarse de nada. Ésa es la diferencia con las listas a mano que
 * este proyecto lleva una semana desmontando (SCRUM-172, 187, 199, 211, 225) — si hubiera 31
 * referencias que actualizar, un día no se actualizan.
 *
 * Una referencia que NO resuelve a fichero se deja INTACTA. No es un caso a ignorar: el guard
 * la marca en rojo, así que un `src` roto —hoy invisible hasta que alguien abre la consola del
 * navegador— pasa a caerse en `npm test`.
 */
export function sellarReferencias(
  html: string,
  opts: {
    publicDir: string;
    baseUrl: string;
    huellaDeFichero: (rutaAbs: string) => string | null;
    fsMod?: typeof fs;
  },
): string {
  // Se reconstruye por TRAMOS a partir de los hallazgos, en vez de con un `replace` global: así
  // sellar y auditar miran exactamente lo mismo, y lo que está dentro de un comentario ni se toca.
  const hallazgos = hallazgosDeReferencia(html);
  let out = '';
  let cursor = 0;
  for (const h of hallazgos) {
    out += html.slice(cursor, h.inicio);
    cursor = h.fin;

    const original = html.slice(h.inicio, h.fin);
    const fichero = resolverEstatico(h.valor, opts);
    if (!fichero) { out += original; continue; }
    const huella = opts.huellaDeFichero(fichero);
    if (!huella) { out += original; continue; }

    // Se respeta una query que ya viniera puesta; nadie las usa hoy, pero romperla en silencio
    // sería peor que no sellar.
    const separador = h.valor.includes('?') ? '&' : '?';
    // 🔒 SE CONSERVA LA COMILLA CON LA QUE VENÍA. Normalizarla a dobles sería reescribir el HTML
    // de alguien por gusto, y con un valor que llevara `"` dentro rompería la etiqueta.
    out += `${h.atributo}=${h.comilla}${h.valor}${separador}${PARAM_HUELLA}=${huella}${h.comilla}`;
  }
  out += html.slice(cursor);
  return out;
}
