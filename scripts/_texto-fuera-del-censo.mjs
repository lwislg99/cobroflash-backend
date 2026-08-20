// scripts/_texto-fuera-del-censo.mjs — SCRUM-555
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LO QUE UN CENSO NO MIRA NO SALE EN SU CERO
//
// El censo de anclas del bloque F (`scripts/censo-anclas-bloque-f.mjs`, S1) extrae sus
// unidades con `<(h1|h2|h3|p|li)>`. Es una decisión razonable y NO se toca aquí. Lo que este
// fichero fija es su CONSECUENCIA MEDIDA: en las dos secciones que hoy censa hay texto que
// el visitante lee y que ese esquema no puede ver — rótulos en `<span>`, etiquetas de botón
// en `<a>`, y textos que viven en ATRIBUTOS y los pinta un script.
//
// Medido el 20-ago-2026 sobre `public/index.html`:
//
//   sección       unidades del esquema   nodos de texto   fuera del esquema
//   #heroe-f4              3                   8                 3
//   #gremios              14                  27                13
//
// Diecinueve nodos cubiertos y DIECISÉIS fuera. Un censo que dijera «cero promesas sin ancla»
// habiendo mirado 19 de 35 no estaría limpio: estaría a media luz.
//
// Este fichero NO amplía el extractor —eso obligaría a declarar dieciséis anclas nuevas y
// dejaría `main` en rojo, que es justo lo que SCRUM-557 vino a quitar—. Hace lo otro: DECLARA
// la lista, con su motivo, y la cuenta EXACTA. Una lista declarada con su motivo vale más que
// un barrido que se traga la mitad del marcado; y contar exacto en vez de «al menos N» es lo
// que impide que mañana se pierda uno en silencio (misma enfermedad que SCRUM-559 cura en los
// guards del dashboard, otra superficie y otros ficheros).
// ─────────────────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { SECCIONES_BLOQUE_F, LANDING, MARCAS_CAPACIDAD, ANCLAS_F, SIN_CAPACIDAD } from './censo-anclas-bloque-f.mjs';

/** Las cinco etiquetas de las que el censo de S1 saca sus unidades. */
export const ETIQUETAS_DEL_CENSO = ['h1', 'h2', 'h3', 'p', 'li'];

/** Etiquetas sin cierre: si se apilaran, la pila no volvería a bajar nunca. */
const VACIAS = new Set(['br', 'img', 'input', 'meta', 'link', 'hr', 'source', 'area', 'base',
  'col', 'embed', 'track', 'wbr']);

// ═════════════════════════════════════════════════════════════════════════════════════════
// QUÉ CENSO CUBRE QUÉ · la declaración por escrito (SCRUM-555 punto 1)
// ═════════════════════════════════════════════════════════════════════════════════════════
/**
 * No hay UN censo del bloque F: hay dos, y no se solapan. Escribirlo importa porque el motivo
 * que hoy lleva `#comparativa` en `SECCIONES_BLOQUE_F` — «sus 20 unidades nunca han pasado por
 * el censo» — se lee como un hueco, y MEDIDO no lo es: sus seis filas las vigila F5 una a una.
 *
 * Medido el 20-ago-2026: `tests/scrum332-comparativa-anclas.test.mjs` declara ancla para las 6
 * filas (`data-fila`) y está en verde; `scripts/guard-a11y-comparativa.mjs:183` las cuenta.
 */
export const CENSOS_DEL_BLOQUE_F = {
  'heroe-f4': { censo: 'scripts/censo-anclas-bloque-f.mjs', unidad: 'texto (h1|h2|h3|p|li)' },
  'gremios': { censo: 'scripts/censo-anclas-bloque-f.mjs', unidad: 'texto (h1|h2|h3|p|li)' },
  'comparativa': {
    censo: 'tests/scrum332-comparativa-anclas.test.mjs',
    unidad: 'fila (data-fila)',
    nota: 'no es un hueco: es OTRO censo, con otra unidad. El de S1 ancla frases; el de F5 '
      + 'ancla filas. Que una sección no esté en `SECCIONES_BLOQUE_F` no significa que nadie '
      + 'la mire — significa que no la mira ESE censo.',
  },
  'contacto-publico': {
    censo: null,
    unidad: null,
    nota: 'F7. Fuera de los dos censos por decisión de SCRUM-557 (su copy no es propuesta del '
      + 'bloque F). Sus cuatro textos SÍ están inventariados en '
      + 'docs/MICROCOPY_BLOQUE_F_PARA_APROBAR.md (F7-1 a F7-4), y TRES de los cuatro viven en '
      + 'atributos — ver `TEXTOS_EN_ATRIBUTOS`.',
  },
};

// ═════════════════════════════════════════════════════════════════════════════════════════
// LO QUE EL ESQUEMA NO ALCANZA · declarado, con su motivo (SCRUM-555 punto 2)
// ═════════════════════════════════════════════════════════════════════════════════════════
/**
 * Los dieciséis nodos de texto de `#heroe-f4` y `#gremios` que ninguna unidad del censo
 * contiene. `veces` es EXACTA: seis tarjetas de gremio son seis «Empezar gratis», y si mañana
 * son cinco o siete, este fichero cae.
 */
export const FUERA_DEL_ESQUEMA = [
  {
    seccion: 'heroe-f4', etiqueta: 'span', texto: 'El ERP por WhatsApp para los oficios', veces: 1,
    motivo: 'rótulo de sección (`.eyebrow`). ⚠️ No es decorativo: «ERP» es una afirmación sobre '
      + 'qué ES el producto, y hoy no la ancla nadie. Queda anotado aquí porque anotarlo es lo '
      + 'que este ticket puede hacer sin tocar copy sin aprobar.',
  },
  { seccion: 'heroe-f4', etiqueta: 'a', texto: 'Probar la demo', veces: 1,
    motivo: 'etiqueta de botón. Su DESTINO lo vigila `tests/scrum334-destino-de-los-cta.test.mjs`; '
      + 'su TEXTO está inventariado como F4-4 en docs/MICROCOPY_BLOQUE_F_PARA_APROBAR.md.' },
  { seccion: 'heroe-f4', etiqueta: 'a', texto: 'Empieza gratis', veces: 1,
    motivo: 'etiqueta de botón (F4-5). Mismo caso que la anterior.' },
  { seccion: 'gremios', etiqueta: 'span', texto: 'Tu oficio', veces: 1,
    motivo: 'rótulo de sección (`.eyebrow`, F6-1). No afirma capacidad.' },
  { seccion: 'gremios', etiqueta: 'a', texto: 'Empezar gratis', veces: 6,
    motivo: 'etiqueta de botón, una por tarjeta de gremio (F6-6). La cuenta es el número de '
      + 'tarjetas: si cambia, cambia el censo de F6 y hay que volver a mirarlo.' },
  { seccion: 'gremios', etiqueta: 'span', texto: '→', veces: 6,
    motivo: 'flecha decorativa dentro del botón. Lo único de esta lista que de verdad no es '
      + 'copy — y aun así se cuenta, porque «decorativo» es un juicio y el recuento no.' },
];

/**
 * Textos que NINGÚN censo de etiquetas puede ver, porque no son elementos: son atributos que
 * un script convierte en texto en el navegador. Tres de los cuatro textos de F7 son de éstos.
 */
export const TEXTOS_EN_ATRIBUTOS = [
  { seccion: 'contacto-publico', atributo: 'data-wa-etiqueta', texto: 'Escríbenos por WhatsApp',
    pintadoPor: 'public/js/contacto-publico.js', doc: 'F7-2' },
  { seccion: 'contacto-publico', atributo: 'data-wa-texto', texto: 'Hola, tengo una duda sobre YaQu',
    pintadoPor: 'public/js/contacto-publico.js', doc: 'F7-3',
    nota: 'no se lee en la página: se envía POR el visitante como mensaje. Es copy que sale '
      + 'del producto hacia un tercero, y no lo mira ningún censo.' },
  { seccion: 'contacto-publico', atributo: 'data-email-etiqueta', texto: 'Escríbenos por correo',
    pintadoPor: 'public/js/contacto-publico.js', doc: 'F7-4' },
];

// ═════════════════════════════════════════════════════════════════════════════════════════
// CIFRAS ACOPLADAS · el censo entero, no la que se vio primero (SCRUM-555 punto 3)
// ═════════════════════════════════════════════════════════════════════════════════════════
/**
 * Una cifra acoplada es un número de la copia que dice CUÁNTAS cosas hay, y esas cosas están
 * en el marcado. Si alguien añade o quita una, la frase queda mintiendo.
 *
 * Barrido del 20-ago-2026 sobre el texto visible de la landing: 40 pares «número + sustantivo»,
 * 39 únicos. Cinco de ellos acoplan de verdad. Las cinco cuadran hoy; sólo una tiene quien la
 * cuente, y por accidente (el suelo de ceguera de a11y de la comparativa).
 */
export const CIFRAS_ACOPLADAS = [
  { frase: 'Seis situaciones', dice: 6, seccion: 'comparativa', clase: 'cmp-row',
    laCuenta: 'scripts/guard-a11y-comparativa.mjs:183 (como suelo de ceguera, no por la frase)' },
  { frase: 'Tres pasos. Cero fricción.', dice: 3, seccion: 'como', clase: 'prod', laCuenta: null },
  { frase: 'Seis herramientas. Una sola app.', dice: 6, seccion: 'todo', clase: 'prod', laCuenta: null },
  { frase: 'Un solo plan. Todo incluido.', dice: 1, seccion: 'precios', clase: 'price-card', laCuenta: null },
  { frase: 'la demo se numera 1…5', dice: 5, seccion: 'probar', clase: 'try-step', laCuenta: null },
];

// ═════════════════════════════════════════════════════════════════════════════════════════
// COBERTURA DEL DETECTOR LÉXICO · medida contra verdad conocida (SCRUM-555 punto 1)
// ═════════════════════════════════════════════════════════════════════════════════════════
/**
 * `MARCAS_CAPACIDAD` es el contraste que impide que `SIN_CAPACIDAD` se use como puerta de
 * escape. Medido contra las dos verdades que ya existen en el repo —`ANCLAS_F` y el registro
 * de filas de F5— el 20-ago-2026:
 *
 *   · 15 frases que SÍ afirman capacidad → el detector ve 10. Se le escapan CINCO.
 *   · 20 frases que NO afirman capacidad → el detector calla en las 20. Ni un falso positivo.
 *
 * O sea que NO falla en las dos direcciones: falla en una sola, y fuerte (una de cada tres).
 *
 * ⚠️ Y por eso NO se amplía el vocabulario aquí. Las cinco que se escapan son «al cobro», «sale
 * solo», «queda en su ficha», «lo que entró menos lo que salió» y «salen de tu catálogo»: no
 * comparten palabra, comparten que prometen. Añadir cinco patrones para estas cinco frases sería
 * enseñarle al detector las frases de hoy y quedarse con la sensación de que ya mira. Lo que
 * sostiene el censo es el REGISTRO —cada unidad declarada a mano—; el léxico es una red de
 * seguridad con agujeros medidos, y este trinquete existe para que los agujeros no crezcan.
 */
export const COBERTURA_DEL_DETECTOR = { promesas: 15, detectadas: 10, escapes: 5, falsosPositivos: 0 };

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL INSTRUMENTO
// ═════════════════════════════════════════════════════════════════════════════════════════
const limpiar = (s) => s.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

/** Fuera de la medida: comentarios, `<script>`, `<style>` y `<svg>`. Nada de eso lo lee nadie. */
export function podar(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ');
}

/**
 * Todo nodo de texto, con la pila de etiquetas abiertas por encima.
 *
 * La pila es lo que distingue «cubierto» de «fuera»: un texto está cubierto si alguna de las
 * cinco etiquetas del censo lo envuelve, aunque sea a través de un `<span>` o un `<strong>`.
 * Sin pila habría que suponer que el texto es hijo directo, y no lo es casi nunca.
 */
export function nodosDeTexto(html) {
  const out = [];
  const pila = [];
  const re = /<\/?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>/g;
  let ultimo = 0;
  let m;
  while ((m = re.exec(html)) !== null) {
    const t = limpiar(html.slice(ultimo, m.index));
    if (t) out.push({ texto: t, pila: [...pila] });
    ultimo = re.lastIndex;
    const tag = m[1].toLowerCase();
    if (m[0][1] === '/') {
      const i = pila.lastIndexOf(tag);
      if (i !== -1) pila.length = i;
    } else if (!(/\/>\s*$/.test(m[0]) || VACIAS.has(tag))) {
      pila.push(tag);
    }
  }
  const t = limpiar(html.slice(ultimo));
  if (t) out.push({ texto: t, pila: [...pila] });
  return out;
}

/** El cuerpo de una `<section>` por su id, tolerando atributos en cualquier orden (SCRUM-553). */
export function cuerpoDeSeccion(html, id) {
  const m = new RegExp(`<section[^>]{0,400}?\\bid="${id}"[\\s\\S]{0,400}?>`).exec(html);
  if (!m) return null;
  const fin = html.indexOf('</section>', m.index);
  return html.slice(m.index, fin === -1 ? html.length : fin);
}

/** Las secciones que el censo de S1 dice mirar hoy. Si S1 cambia el alcance, esto le sigue. */
export const seccionesCensadas = () =>
  Object.entries(SECCIONES_BLOQUE_F).filter(([, c]) => c.censada).map(([id]) => id);

/**
 * El reparto de una sección: cuántos nodos de texto hay, cuántos cubre el esquema del censo y
 * cuáles se quedan fuera. `total === cubiertos + fuera.length` siempre, por construcción — y
 * el test lo comprueba, porque una identidad que nadie verifica es una intención.
 */
export function repartoDeSeccion(html, id) {
  const cuerpo = cuerpoDeSeccion(podar(html), id);
  if (cuerpo === null) return { ausente: true, total: 0, cubiertos: 0, fuera: [] };
  const nodos = nodosDeTexto(cuerpo);
  const cubre = (n) => n.pila.some((t) => ETIQUETAS_DEL_CENSO.includes(t));
  const fuera = nodos.filter((n) => !cubre(n))
    .map((n) => ({ texto: n.texto, etiqueta: n.pila[n.pila.length - 1] || '(raíz)' }));
  return { ausente: false, total: nodos.length, cubiertos: nodos.filter(cubre).length, fuera };
}

/**
 * Lo declarado, aplanado a `sección|etiqueta|texto` repetido `veces`. Compararlo con lo medido
 * es lo que convierte «hay dieciséis» en «hay ESTOS dieciséis».
 */
export function declarado() {
  const out = [];
  for (const d of FUERA_DEL_ESQUEMA) {
    for (let i = 0; i < d.veces; i++) out.push(`${d.seccion}|${d.etiqueta}|${d.texto}`);
  }
  return out.sort();
}

/** Lo medido, en la misma forma. */
export function medido(html) {
  const out = [];
  for (const id of seccionesCensadas()) {
    const r = repartoDeSeccion(html, id);
    for (const f of r.fuera) out.push(`${id}|${f.etiqueta}|${f.texto}`);
  }
  return out.sort();
}

/** Lectura desde disco, para no obligar a cada llamante a saber dónde está la landing. */
export function leerLanding(raiz) {
  return fs.readFileSync(path.join(raiz, LANDING), 'utf8');
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// LA MEDIDA DEL DETECTOR · para que los agujeros no crezcan en silencio
// ═════════════════════════════════════════════════════════════════════════════════════════
/**
 * Contrasta `MARCAS_CAPACIDAD` con las dos verdades que YA existen en el repo:
 *
 *   · verdad A — `ANCLAS_F`: lo declarado `SIN_CAPACIDAD` no promete; lo demás sí. Lo declaró
 *     una persona mirando la frase, que es la única verdad que hay aquí.
 *   · verdad B — la comparativa: la columna «Con YaQu» ES la columna de la promesa (lo dice su
 *     propia cabecera). La situación y «Tu método actual» describen el mundo SIN el producto.
 *
 * ⚠️ La celda se busca DENTRO de su fila. La última `cmp-cell` anterior a una línea de situación
 * es la de la fila de ARRIBA —que sí es `cmp-yaqu`—, y sin acotar, las seis situaciones se
 * clasifican como promesa y el resultado sale del revés.
 */
export function medirDetector(html) {
  const limpio = (s) => s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  const salta = (t) => MARCAS_CAPACIDAD.some((re) => re.test(t));
  const promesas = [];
  const noPromesas = [];

  for (const reg of Object.values(ANCLAS_F)) {
    (reg.anclas === SIN_CAPACIDAD ? noPromesas : promesas).push(reg.texto);
  }

  const cuerpo = cuerpoDeSeccion(podar(html), 'comparativa');
  if (cuerpo === null) return { ciego: true, motivo: 'no está #comparativa' };
  const filas = cuerpo.split(/<div class="cmp-row"/).slice(1);
  for (const fila of filas) {
    const sit = /<p class="cmp-sit"[^>]*>([\s\S]*?)<\/p>/.exec(fila);
    if (sit) noPromesas.push(limpio(sit[1]));
    for (const c of fila.matchAll(/<div class="cmp-cell([^"]*)"[\s\S]*?<p\b[^>]*>([\s\S]*?)<\/p>/g)) {
      (/cmp-yaqu/.test(c[1]) ? promesas : noPromesas).push(limpio(c[2]));
    }
  }
  if (filas.length === 0) return { ciego: true, motivo: 'cero filas en #comparativa' };

  const escapes = promesas.filter((t) => !salta(t));
  const falsos = noPromesas.filter((t) => salta(t));
  return {
    ciego: false,
    promesas: promesas.length,
    detectadas: promesas.length - escapes.length,
    escapes: escapes.length,
    falsosPositivos: falsos.length,
    listaEscapes: escapes,
    listaFalsosPositivos: falsos,
  };
}
