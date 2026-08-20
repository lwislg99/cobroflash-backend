// scripts/_afirmaciones-publicadas.mjs — SCRUM-564
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LAS AFIRMACIONES DEL COPY PUBLICADO — LAS QUE PUEDEN SER FALSAS
//
// SCRUM-563 midió que las cinco secciones publicadas (`#como`, `#todo`, `#precios`, `#probar`,
// `#faq`) suman 148 nodos de texto que nadie aprobó ni marcó. De ésos, **28 afirman algo del
// producto**. Decisión del fundador con la tabla delante: se revisan SÓLO esos 28. Los otros
// 120 quedan **DECLARADOS fuera de alcance**, no callados — su motivo, en `FUERA_DE_ALCANCE`.
//
// El criterio del fundador, y es el bueno: **los 28 pueden ser FALSOS; los otros 120 sólo
// pueden ser feos.**
//
// ── El extractor: aquí NO vale el esquema del bloque F ────────────────────────────────────
// El censo de anclas extrae con `h1|h2|h3|p|li`. Medido en estas cinco secciones, eso ve 37 de
// 148 nodos, y en `#probar` y `#faq` es **casi ciego**: `#faq` guarda sus preguntas en
// `<details>/<summary>`, que no es ninguna de las cinco etiquetas, y las 5 afirmaciones de
// `#faq` y las 9 de `#probar` caen TODAS fuera.
//
// 🔴 CONTAR 28 Y MEDIR 12 SERÍA PEOR QUE NO MEDIR. Así que la unidad aquí es **cualquier
// elemento que contenga texto directamente**, no una lista de cinco etiquetas. El identificador
// sigue el mismo esquema derivado —`sección/etiqueta#orden`— para que se pueda cruzar con todo
// lo demás.
//
// ── Las anclas: se REUTILIZA el mecanismo, no se monta un tercero ─────────────────────────
// `anclaViva()` de SCRUM-551 (el símbolo EXISTE) y `alcanzabilidad()` de SCRUM-558 (un merchant
// nuevo LLEGA a él). Las dos condiciones, las mismas funciones, importadas del censo del bloque
// F. Un tercer mecanismo sería una tercera verdad que discreparía el día que importe.
// ─────────────────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { MARCAS_CAPACIDAD, LANDING } from './censo-anclas-bloque-f.mjs';
import { IDENTIDAD, CONDICION } from './_citar-fuera-del-censo.mjs';

/** Las cinco secciones publicadas que SCRUM-563 dejó en `NI_UNA_COSA_NI_OTRA`. */
export const SECCIONES_PUBLICADAS = ['como', 'todo', 'precios', 'probar', 'faq'];

const VACIAS = new Set(['br', 'img', 'input', 'meta', 'link', 'hr', 'source', 'area', 'base',
  'col', 'embed', 'track', 'wbr']);
const limpiar = (s) => s.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

export function podar(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ');
}

export function cuerpoDeSeccion(html, id) {
  const m = new RegExp(`<section[^>]{0,400}?\\bid="${id}"[\\s\\S]{0,400}?>`).exec(html);
  if (!m) return null;
  const fin = html.indexOf('</section>', m.index);
  return html.slice(m.index, fin === -1 ? html.length : fin);
}

/** Las tres señales. Son las MISMAS que usa el censo del bloque F: un texto no puede afirmar
 *  una cosa aquí y otra allí según qué fichero lo mire. */
export function afirmacionesDe(texto) {
  return [
    IDENTIDAD.test(texto) ? 'IDENTIDAD' : null,
    CONDICION.test(texto) ? 'CONDICION' : null,
    MARCAS_CAPACIDAD.some((re) => re.test(texto)) ? 'CAPACIDAD' : null,
  ].filter(Boolean);
}

/**
 * Toda unidad de texto de una sección: **cualquier elemento que contenga texto directamente**.
 * El identificador es `sección/etiqueta#orden`, el mismo esquema derivado de todo lo demás.
 */
export function unidadesDe(html, id) {
  const cuerpo = cuerpoDeSeccion(podar(html), id);
  if (cuerpo === null) return null;
  const out = [];
  const cuenta = {};
  const pila = [];
  const re = /<\/?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>/g;
  let ultimo = 0;
  let m;
  while ((m = re.exec(cuerpo)) !== null) {
    const t = limpiar(cuerpo.slice(ultimo, m.index));
    if (t) {
      const propio = pila[pila.length - 1] || { tag: 'seccion' };
      const clave = `${id}/${propio.tag}`;
      cuenta[clave] = (cuenta[clave] || 0) + 1;
      out.push({ id: `${clave}#${cuenta[clave]}`, texto: t, etiqueta: propio.tag, seccion: id });
    }
    ultimo = re.lastIndex;
    const tag = m[1].toLowerCase();
    if (m[0][1] === '/') {
      const i = pila.map((x) => x.tag).lastIndexOf(tag);
      if (i !== -1) pila.length = i;
    } else if (!(/\/>\s*$/.test(m[0]) || VACIAS.has(tag))) {
      pila.push({ tag, abre: m[0] });
    }
  }
  const t = limpiar(cuerpo.slice(ultimo));
  if (t) {
    const propio = pila[pila.length - 1] || { tag: 'seccion' };
    const clave = `${id}/${propio.tag}`;
    cuenta[clave] = (cuenta[clave] || 0) + 1;
    out.push({ id: `${clave}#${cuenta[clave]}`, texto: t, etiqueta: propio.tag, seccion: id });
  }
  return out;
}

/** Las cinco secciones, con sus unidades y cuáles afirman. */
export function censar(html) {
  const secciones = {};
  const ausentes = [];
  for (const id of SECCIONES_PUBLICADAS) {
    const u = unidadesDe(html, id);
    if (u === null) { ausentes.push(id); continue; }
    secciones[id] = u.map((x) => ({ ...x, afirma: afirmacionesDe(x.texto) }));
  }
  const todas = Object.values(secciones).flat();
  return { secciones, ausentes, todas, afirman: todas.filter((u) => u.afirma.length > 0) };
}

/**
 * 🔴 LOS QUE NO AFIRMAN NADA · declarados fuera de alcance, no callados.
 *
 * Decisión del fundador con la tabla de SCRUM-563 delante: se revisan sólo los que afirman. Los
 * demás —rótulos, glifos, etiquetas de navegación, precios sueltos, la maqueta de la demo— NO se
 * revisan en este ticket. **Y por eso se cuentan:** «no revisado» y «no existe» se leen igual si
 * nadie escribe la diferencia.
 *
 * El motivo, entero: **los que afirman pueden ser FALSOS; éstos sólo pueden ser feos.** Un texto
 * feo se arregla cuando toque; una promesa que el producto no cumple es el art. 5 LCD.
 */
export const FUERA_DE_ALCANCE = {
  motivo: 'no afirman ninguna capacidad, condición ni identidad del producto: sólo pueden ser '
    + 'feos, no falsos (decisión del fundador, 20-ago-2026)',
  comoSeCuentan: 'censar(html).todas.length − censar(html).afirman.length',
  ticket: 'SCRUM-564',
};

/** Lectura desde disco. */
export const leerLanding = (raiz) => fs.readFileSync(path.join(raiz, LANDING), 'utf8');

// ═════════════════════════════════════════════════════════════════════════════════════════
// PUNTO 5 · EL LÉXICO ES SUELO, NO TECHO — los que se descartan, con el texto delante
// ═════════════════════════════════════════════════════════════════════════════════════════
/**
 * Dos de los 28 los marca el léxico y **no son afirmaciones del producto**. Se descartan con su
 * motivo, no en silencio: un descarte callado y un olvido se leen igual.
 *
 * No se «arregla» el léxico para que deje de verlos. Ya se midió en SCRUM-555 que un léxico
 * ajustado a las frases de hoy da falsa sensación de vigilancia; lo que sostiene esto es la lista
 * revisada con el texto literal delante.
 */
export const DESCARTADAS = {
  'probar/div#1': {
    texto: 'app.yaqu.app · Nuevo presupuesto',
    motivo: 'marca IDENTIDAD por la palabra «app», y es la BARRA DE DIRECCIONES de un navegador '
      + 'simulado dentro de la demo. No afirma nada del producto: enseña una URL.',
  },
  'faq/summary#1': {
    texto: 'Ya mando presupuestos por WhatsApp gratis. ¿Para qué esto?',
    motivo: 'marca CONDICION por «gratis», y es la PREGUNTA DEL CLIENTE, no una promesa de YaQu. '
      + 'Lo gratis que se nombra es WhatsApp, no el producto.',
  },
};

/** Un ancla que no es un símbolo del código sino un recuento del propio marcado. */
export const ANCLA_EN_EL_MARCADO = 'ANCLA_EN_EL_MARCADO';
/** Afirma una capacidad que hoy no está disponible para un merchant nuevo. */
export const SIN_ANCLA = 'SIN_ANCLA';

const FIRMA = 'src/modules/quotes/app/routes/quotes.routes.ts::signatureUrl';
const WHATSAPP = 'src/integrations/whatsapp.ts::sendWhatsAppTemplate';
const RECORDATORIO = 'src/modules/billing/domain/invoiceReminder.service.ts::sendInvoicePaymentReminders';
const TRANSFERENCIA = 'src/modules/billing/app/routes/payBank.routes.ts::router';
const PRUEBA = 'src/modules/auth/domain/auth.service.ts::planExpiresAt';
const CSV = 'src/modules/exports/domain/exportData.ts::csvBody';
const ANUAL = 'src/modules/billing/domain/stripePrices.ts::pro_annual';

/**
 * EL REGISTRO DE ANCLAS de las 26 que quedan. Mismo formato que `ANCLAS_F`, para que se lo puedan
 * comer `anclaViva()` (SCRUM-551) y `alcanzabilidad()` (SCRUM-558) sin adaptador ninguno.
 */
export const ANCLAS_564 = {
  // ── firma y envío por WhatsApp: el símbolo existe y el usuario llega ───────────────────
  'como/h3#2': { texto: '2 · Firma por WhatsApp', anclas: [FIRMA, WHATSAPP] },
  'como/p#3': { texto: 'Le llega como un mensaje normal con un botón. Lo abre, lo revisa y firma con el dedo.', anclas: [FIRMA, WHATSAPP] },
  'todo/h3#1': { texto: 'Presupuestos y firma', anclas: [FIRMA] },
  'precios/li#2': { texto: 'Envío por WhatsApp + firma digital', anclas: [FIRMA, WHATSAPP] },
  'probar/span#9': { texto: 'Lo firma desde el móvil', anclas: [FIRMA] },
  'probar/div#6': { texto: 'Firma para aceptar', anclas: [FIRMA] },

  // ── cobro: aquí está el problema, y es el mismo que hizo caer una fila de F5 ───────────
  'como/h3#3': { texto: '3 · Cobra', anclas: [TRANSFERENCIA] },
  'como/p#4': {
    texto: 'Tarjeta, Bizum o transferencia — él elige, tú cobras. Los pendientes se reclaman solos.',
    anclas: SIN_ANCLA,
    promete: 'tarjeta (PAYMENTS_CONNECT_ENABLED) y Bizum (BIZUM_MANUAL_ENABLED), las dos APAGADAS '
      + 'por defecto. De los tres medios que enumera, un merchant nuevo sólo tiene transferencia.',
  },
  'todo/p#3': {
    texto: 'Tarjeta, Bizum o transferencia. Cobra trabajos completos o por adelantado, con recordatorios que persiguen solos.',
    anclas: SIN_ANCLA,
    promete: 'los mismos dos flags apagados. El final de la frase —los recordatorios— sí tiene '
      + 'ancla viva, pero la frase entera promete tres medios de cobro y hay uno.',
  },
  'precios/li#3': {
    texto: 'Cobro con tarjeta, Bizum y transferencia',
    anclas: SIN_ANCLA,
    promete: 'los mismos dos flags. Y ésta va en la LISTA DE LO QUE INCLUYE EL PLAN, al lado del precio.',
  },
  'precios/p#2': {
    texto: 'Solo si cobras con tarjeta:',
    anclas: SIN_ANCLA,
    promete: 'PAYMENTS_CONNECT_ENABLED=false. La frase entera del elemento es «Solo si cobras con '
      + 'tarjeta: 0,9 %. Bizum y transferencia: 0 €.»: anuncia la comisión de un medio de cobro '
      + 'que un merchant nuevo no puede usar.',
  },
  'precios/p#4': {
    texto: 'Bizum y transferencia:',
    anclas: SIN_ANCLA,
    promete: 'BIZUM_MANUAL_ENABLED=false. La transferencia sí existe; el Bizum no.',
  },
  'probar/span#15': { texto: 'Paga como quiera', anclas: SIN_ANCLA, promete: 'los mismos dos flags: de los tres medios que el visitante ve elegir en la demo, un merchant nuevo solo tiene uno.' },
  'probar/span#16': { texto: 'Tarjeta, Bizum o transferencia.', anclas: SIN_ANCLA, promete: 'los mismos dos flags, dentro de la demo.' },
  'probar/span#42': { texto: 'Tarjeta', anclas: SIN_ANCLA, promete: 'PAYMENTS_CONNECT_ENABLED=false.' },
  'probar/span#44': { texto: 'Bizum', anclas: SIN_ANCLA, promete: 'BIZUM_MANUAL_ENABLED=false.' },
  'probar/span#46': { texto: 'Transferencia', anclas: [TRANSFERENCIA] },
  'probar/div#9': { texto: 'Tu cliente paga desde el chat', anclas: [WHATSAPP, TRANSFERENCIA] },

  // ── recordatorios ─────────────────────────────────────────────────────────────────────
  'faq/div#1': {
    texto: 'Exacto — por eso esto ES WhatsApp. La diferencia: el tuyo no firma, no cobra y no persigue al que no contesta. Y aquí además llevas clientes, gastos y facturas en el mismo sitio.',
    anclas: [FIRMA, RECORDATORIO],
  },
  'faq/div#2': {
    texto: 'Nada. Les llega un WhatsApp normal con un enlace: lo abren, ven el presupuesto y tienen dos botones — Firmar y Pagar. Y si prefieren transferencia de toda la vida, también vale.',
    anclas: [FIRMA, WHATSAPP, RECORDATORIO],
  },

  // ── condiciones comerciales ───────────────────────────────────────────────────────────
  'precios/p#1': { texto: '14 días gratis, sin tarjeta. Y sin letra pequeña.', anclas: [PRUEBA] },
  'precios/a#1': { texto: 'Empieza gratis', anclas: [PRUEBA] },
  'precios/p#6': { texto: 'o 16,58 €/mes pagando el año (199 € · 2 meses gratis)', anclas: [ANUAL] },
  'faq/div#4': {
    texto: 'Sin permanencia. Tus datos son tuyos: clientes, presupuestos, facturas, cobros, trabajos y gastos se exportan en CSV cuando quieras.',
    anclas: [CSV],
  },

  // ── identidad ─────────────────────────────────────────────────────────────────────────
  'todo/h2#1': {
    texto: 'Seis herramientas. Una sola app.',
    anclas: ANCLA_EN_EL_MARCADO,
    cuenta: { clase: 'prod', seccion: 'todo', dice: 6 },
    nota: 'no es un símbolo del código: es un RECUENTO. La frase dice cuántas cosas hay, y las '
      + 'cosas están en el marcado — seis `.prod` en #todo. Ya lleva trinquete en '
      + 'tests/scrum555-lo-que-el-censo-no-ve.test.mjs, entre las cifras acopladas.',
  },
  'faq/div#3': {
    texto: 'Todo: presupuestos, firma y cobro, más clientes, proveedores, productos, gastos, informes y equipo. Es tu herramienta de gestión completa, no solo para cotizar.',
    anclas: SIN_ANCLA,
    promete: 'enumera nueve capacidades como si estuvieran todas disponibles. El «cobro» arrastra '
      + 'los mismos dos flags apagados que las de arriba.',
  },
};

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL VEREDICTO · derivado, no declarado
// ═════════════════════════════════════════════════════════════════════════════════════════
export const CON_ANCLA = 'VERDAD HOY, CON ANCLA';
export const ANCLA_A_DECLARAR = 'VERDAD HOY, SIN ANCLA DE CODIGO';
export const FALSA = 'FALSA O NO VERIFICABLE';
export const DESCARTADA = 'DESCARTADA (falso positivo del lexico)';
export const SIN_DECLARAR = 'SIN DECLARAR';

/**
 * Los tres grupos del encargo, SACADOS DEL MECANISMO y no de una etiqueta que yo escriba:
 *
 *   · el símbolo existe (`anclaViva`, SCRUM-551) **y** un merchant nuevo llega (`alcanzabilidad`,
 *     SCRUM-558) → `CON_ANCLA`.
 *   · el ancla no es un símbolo sino un recuento del marcado → `ANCLA_A_DECLARAR`, y se comprueba
 *     el recuento.
 *   · `SIN_ANCLA`, o el símbolo no existe, o existe y el flag lo deja inalcanzable → `FALSA`.
 *
 * Que el grupo se derive importa: si lo escribiera yo en cada entrada, el día que alguien
 * encienda un flag la etiqueta seguiría diciendo lo de ayer.
 */
export function veredictos(html, raiz, { anclaViva, alcanzabilidad, defaultsDeLaTablaP }) {
  const c = censar(html);
  const tablaP = defaultsDeLaTablaP(raiz);
  const out = [];
  for (const u of c.afirman) {
    if (DESCARTADAS[u.id]) {
      out.push({ ...u, grupo: DESCARTADA, motivo: DESCARTADAS[u.id].motivo });
      continue;
    }
    const reg = ANCLAS_564[u.id];
    if (!reg) { out.push({ ...u, grupo: SIN_DECLARAR }); continue; }
    if (reg.texto !== u.texto) {
      out.push({ ...u, grupo: SIN_DECLARAR, caduco: reg.texto });
      continue;
    }
    if (reg.anclas === SIN_ANCLA) {
      out.push({ ...u, grupo: FALSA, promete: reg.promete, anclas: [] });
      continue;
    }
    if (reg.anclas === ANCLA_EN_EL_MARCADO) {
      const cuerpo = cuerpoDeSeccion(podar(html), reg.cuenta.seccion);
      const hay = cuerpo === null ? 0
        : (cuerpo.match(new RegExp('class="[^"]*\\b' + reg.cuenta.clase + '\\b[^"]*"', 'g')) || []).length;
      out.push({
        ...u,
        grupo: hay === reg.cuenta.dice ? ANCLA_A_DECLARAR : FALSA,
        nota: reg.nota,
        recuento: `dice ${reg.cuenta.dice}, hay ${hay} .${reg.cuenta.clase}`,
        anclas: [],
      });
      continue;
    }
    const muertas = reg.anclas.filter((a) => !anclaViva(a, raiz).viva);
    const problemas = alcanzabilidad(u.id, reg, raiz, tablaP);
    out.push({
      ...u,
      grupo: muertas.length || problemas.length ? FALSA : CON_ANCLA,
      anclas: reg.anclas,
      muertas,
      problemas,
    });
  }
  return { veredictos: out, total: c.afirman.length, unidades: c.todas.length, ausentes: c.ausentes };
}
