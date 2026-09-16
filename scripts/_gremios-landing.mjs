// scripts/_gremios-landing.mjs — SCRUM-333 (F6) · de dónde salen las tarjetas de gremio.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA REGLA ENTERA DE ESTE FICHERO, EN UNA FRASE
//
// **Un concepto o un precio de oficio sólo se publica si su catálogo declara que un
// profesional real lo validó.** Hoy ninguno lo declara, así que hoy las tarjetas describen el
// gremio y no enseñan ni un concepto ni un euro.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ, Y ESTÁ MEDIDO (SCRUM-310 · D0 · P4)
//
// El ticket de F6 quería enseñar los conceptos de las capturas —«Punto de agua nuevo»,
// «Cambio de termo 80L», «Llave de paso 1/2"»— como prueba de que conocemos el oficio. D0 midió
// de dónde salen: **cinco de esos seis literales viven ÚNICAMENTE en `scripts/seed-video.mjs`**,
// que su propia cabecera describe como «cuenta realista para grabar el vídeo comercial». Los
// escribió a mano quien preparó el vídeo. Publicarlos como conocimiento de oficio sería enseñar
// como saber del gremio exactamente lo que un facturador genérico también puede escribir.
//
// Sí existe un catálogo de verdad —`data/catalogs/{gremio}.json`, seis gremios, 155 items con
// unidad, categoría y precio orientativo—, y ÉSE es la fuente de este módulo. Pero los seis
// declaran `status: "draft_pendiente_validacion"` y su propio `_nota` dice, literal:
//
//   «Precios ORIENTATIVOS de mercado ES 2026, sin validar: 2-3 fontaneros reales deben
//    confirmarlos ANTES del seed a merchants reales (checklist fundador).»
//
// Un precio que suena a inventado lo nota un fontanero inmediatamente, y lo que se pierde no es
// una conversión: es la credibilidad del resto de la página. Así que el gate no es una opinión
// sobre si están bien: **es el estado que el propio fichero declara.**
//
// ⚠️ ESTE MÓDULO NO ESCRIBE COPY (regla 30). Devuelve datos y permisos; las frases las aprueba
// el fundador.
import fs from 'node:fs';
import path from 'node:path';

/** Estado que un catálogo tiene que declarar para que su contenido pueda publicarse. */
export const ESTADO_VALIDADO = 'validado';

/** El estado de hoy, el que NO autoriza. Se nombra para que el rojo diga cuál encontró. */
export const ESTADO_BORRADOR = 'draft_pendiente_validacion';

export class CatalogosCiego extends Error {}

/**
 * Lee los catálogos por gremio. **Fuente única**: `data/catalogs/*.json`.
 *
 * 🔴 SUELO: si no encuentra ninguno, **LANZA** en vez de devolver `[]`. «No hay gremios
 * configurados» y «no supe mirar» son el mismo array vacío y consecuencias opuestas: con el
 * primero la sección no se pinta y no pasa nada; con el segundo la sección no se pinta y nadie
 * se entera de que el derivador está roto.
 */
export function leerCatalogos(raiz) {
  const dir = path.join(raiz, 'data', 'catalogs');
  let nombres;
  try {
    nombres = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  } catch (e) {
    throw new CatalogosCiego(
      'CIEGO: no se pudo leer data/catalogs/ (' + (e && e.code ? e.code : 'error') + '). ' +
      'Esto NO significa "no hay gremios": significa que el derivador no supo mirar.',
    );
  }
  if (nombres.length === 0) {
    throw new CatalogosCiego(
      'CIEGO: data/catalogs/ existe y no tiene ni un .json. Un cero aqui no se publica como ' +
      '"no hay gremios configurados" sin que alguien lo mire.',
    );
  }
  const out = [];
  for (const f of nombres) {
    const crudo = fs.readFileSync(path.join(dir, f), 'utf8');
    let j;
    try {
      j = JSON.parse(crudo);
    } catch {
      throw new CatalogosCiego('CIEGO: ' + f + ' no es JSON valido. Un catalogo ilegible no es un catalogo vacio.');
    }
    out.push({
      fichero: 'data/catalogs/' + f,
      gremio: j.gremio,
      status: j.status,
      version: j.version,
      nota: j._nota,
      items: Array.isArray(j.items) ? j.items : [],
      plantillas: Array.isArray(j.plantillas) ? j.plantillas : [],
    });
  }
  return out;
}

/** ¿Este catálogo declara que un profesional real lo validó? */
export function estaValidado(cat) {
  return Boolean(cat) && cat.status === ESTADO_VALIDADO;
}

/**
 * Los conceptos que la tarjeta de este gremio PUEDE enseñar.
 *
 * 🔴 CONTROL NEGATIVO DEL TICKET: sin catálogo, o con el catálogo sin validar, devuelve `[]` —
 * **nunca** una lista inventada, y nunca los literales del seed del vídeo. La tarjeta se queda
 * sin conceptos, que es un resultado legítimo; lo que no es legítimo es rellenarla.
 */
export function conceptosPublicables(cat) {
  if (!estaValidado(cat)) return [];
  return cat.items.map((it) => it.nombre).filter(Boolean);
}

/**
 * Los precios que la tarjeta PUEDE enseñar.
 *
 * Van por separado de los conceptos **a propósito, y es una asimetría deliberada**: un nombre de
 * concepto validado es conocimiento del oficio; un precio publicado es además una afirmación
 * comercial sobre el mercado, y ésa la aprueba el fundador (regla 30) aunque el catálogo ya esté
 * validado. Por eso exige las DOS cosas.
 */
export function preciosPublicables(cat, aprobadoPorElFundador = false) {
  if (!estaValidado(cat) || !aprobadoPorElFundador) return [];
  return cat.items
    .filter((it) => it.precioOrientativo && typeof it.precioOrientativo.min === 'number')
    .map((it) => ({ nombre: it.nombre, min: it.precioOrientativo.min, max: it.precioOrientativo.max }));
}

/**
 * El derivador de la sección: qué tarjetas hay y qué puede enseñar cada una.
 *
 * El ORDEN es el alfabético del nombre de fichero, no una lista escrita a mano: una lista a mano
 * es la séptima copia del mismo dato (D0 encontró tres) y se desincroniza sola.
 */
export function tarjetasDeGremio(raiz) {
  return leerCatalogos(raiz).map((cat) => ({
    gremio: cat.gremio,
    fichero: cat.fichero,
    status: cat.status,
    version: cat.version,
    validado: estaValidado(cat),
    conceptos: conceptosPublicables(cat),
    precios: preciosPublicables(cat),
    items: cat.items.length,
    plantillas: cat.plantillas.length,
  }));
}

/** Los literales que NO pueden aparecer en la landing: los escribió el seed del vídeo, no el oficio. */
export const LITERALES_DEL_SEED_DEL_VIDEO = [
  'Punto de agua nuevo',
  'Cambio de termo 80L',
  'Mano de obra oficial de 1ª (hora)',
  'Desplazamiento (zona sur de Madrid)',
  'Llave de paso 1/2"',
];
