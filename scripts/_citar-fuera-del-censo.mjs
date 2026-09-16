// scripts/_citar-fuera-del-censo.mjs — SCRUM-561
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 PONER DELANTE LO QUE NINGUNA PUERTA MIRÓ
//
// SCRUM-555 midió que el censo de anclas del bloque F ve 19 de los 35 nodos de texto de sus dos
// secciones. Este fichero hace lo que falta: CITARLOS. Identificador derivado del marcado, texto
// literal, y para cada uno qué es y si afirma algo — para que el fundador pueda leerlos igual
// que leyó los suyos.
//
// No amplía el extractor de nadie (ya se midió por qué: acabaría tragándose clases, ids y
// atributos de mecanismo). Cita una lista cerrada, derivada, y declara lo que no se puede
// derivar.
// ─────────────────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { MARCAS_CAPACIDAD } from './censo-anclas-bloque-f.mjs';
import { podar, cuerpoDeSeccion, ETIQUETAS_DEL_CENSO } from './_texto-fuera-del-censo.mjs';

/** Las tres secciones de propuesta con texto. `#contacto-publico` no entra: su único nodo lo ve
 *  el esquema, y sus tres textos de atributo ya están citados en SCRUM-555. */
export const SECCIONES = ['heroe-f4', 'gremios', 'comparativa'];

const VACIAS = new Set(['br', 'img', 'input', 'meta', 'link', 'hr', 'source', 'area', 'base',
  'col', 'embed', 'track', 'wbr']);
const limpiar = (s) => s.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const sinEtiquetas = (s) => limpiar(s.replace(/<[^>]*>/g, ' '));

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL CRITERIO DE NATURALEZA · lo que SÍ se puede derivar, y lo que no
// ═════════════════════════════════════════════════════════════════════════════════════════
/**
 * El encargo pide separar «texto de usuario» de «mecanismo (clase, id, atributo de datos)».
 *
 * 🔴 MEDIDO: esa separación **no hace falta aquí, y decirlo es más honesto que fabricarla**. Este
 * censo sólo produce NODOS DE TEXTO — lo que hay entre `>` y `<`. Una clase, un id o un
 * `data-*` no son nodos de texto: no pueden salir de esta lista ni aunque quisieran. Los 20
 * citados son, los 20, texto que un visitante lee.
 *
 * Lo que SÍ se deriva del marcado es una sub-distinción, con dos señales objetivas:
 *
 *   · `GLIFO`  — el texto no contiene ni una letra (los seis `→`). Es un símbolo, no una frase.
 *   · `ROTULO` — está en un `<span class="eyebrow">` o en la cabecera de una tabla: nombra la
 *                sección o la columna. Sigue siendo texto de usuario; sólo dice de qué tipo.
 *   · `ETIQUETA_DE_ACCION` — vive dentro de un `<a>` o un `<button>`: es lo que se lee en el
 *                botón que se pulsa.
 *   · `PROSA`  — el resto.
 *
 * Y un dato derivado que NO clasifica pero informa: si algún ancestro lleva `aria-hidden="true"`,
 * el texto se ve pero no se anuncia. Eso lo decide a11y, no este censo.
 */
export const NATURALEZAS = ['GLIFO', 'ROTULO', 'ETIQUETA_DE_ACCION', 'PROSA'];

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL CRITERIO DE AFIRMACIÓN · declarado, con su motivo
// ═════════════════════════════════════════════════════════════════════════════════════════
/**
 * Tres señales, cada una con su consecuencia distinta:
 *
 *   · IDENTIDAD — un sustantivo de CATEGORÍA que dice qué ES el producto. Es la afirmación más
 *     fuerte que puede hacer una landing, y la que más caro sale si nadie la ancla.
 *     ⚠️ La lista son sustantivos de categoría, NO el nombre del producto: «Con YaQu» nombra a
 *     YaQu y no afirma nada de él. Meter «yaqu» en esta lista daría un falso positivo.
 *   · CONDICION — una condición comercial («gratis», «sin tarjeta»). Afirma sobre el precio.
 *   · CAPACIDAD — `MARCAS_CAPACIDAD`, el contraste que ya existe.
 *
 * 🔴 Y LO QUE ESTE CRITERIO NO ES: un juez. Es un léxico, y SCRUM-555 midió que el léxico de
 * capacidad se deja una de cada tres. Por eso la lista se entrega DECLARADA: lo que marca es un
 * suelo, no un techo, y quien lea la lista tiene el texto literal delante para no depender de él.
 */
export const IDENTIDAD = /\b(erp|crm|app|aplicaci[oó]n|software|programa|plataforma|herramienta|sistema)\b/i;
export const CONDICION = /\bgratis\b|\bsin tarjeta\b|\bsin permanencia\b|\bgratuit[oa]s?\b/i;

/** Nodos de texto con la cadena de ancestros ENTERA (etiqueta de apertura, no sólo el nombre). */
export function nodosConAncestros(html) {
  const out = [];
  const pila = [];
  const re = /<\/?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>/g;
  let ultimo = 0;
  let m;
  while ((m = re.exec(html)) !== null) {
    const t = limpiar(html.slice(ultimo, m.index));
    if (t) out.push({ texto: t, ancestros: pila.map((x) => ({ ...x })), idx: ultimo });
    ultimo = re.lastIndex;
    const tag = m[1].toLowerCase();
    if (m[0][1] === '/') {
      const i = pila.map((x) => x.tag).lastIndexOf(tag);
      if (i !== -1) pila.length = i;
    } else if (!(/\/>\s*$/.test(m[0]) || VACIAS.has(tag))) {
      pila.push({ tag, abre: m[0], desde: m.index });
    }
  }
  const t = limpiar(html.slice(ultimo));
  if (t) out.push({ texto: t, ancestros: pila.map((x) => ({ ...x })), idx: ultimo });
  return out;
}

/** El texto COMPLETO del elemento que envuelve al nodo — «Empezar gratis →», no sólo «Empezar
 *  gratis». Hace falta porque el documento de aprobación juntó el enlace con su flecha. */
function textoDelElemento(cuerpo, ancestro) {
  const fin = cuerpo.indexOf('</' + ancestro.tag + '>', ancestro.desde);
  if (fin === -1) return null;
  return sinEtiquetas(cuerpo.slice(ancestro.desde, fin));
}

/**
 * La cita completa de una sección: cada nodo que el esquema `h1|h2|h3|p|li` no alcanza, con su
 * identificador derivado (`sección[ámbito]/etiqueta#orden`, el mismo esquema del censo).
 */
export function citarSeccion(html, id) {
  const cuerpo = cuerpoDeSeccion(podar(html), id);
  if (cuerpo === null) return null;
  const nodos = nodosConAncestros(cuerpo);
  const cubre = (n) => n.ancestros.some((a) => ETIQUETAS_DEL_CENSO.includes(a.tag));
  const out = [];
  const cuenta = {};
  for (const n of nodos) {
    if (cubre(n)) continue;
    const propio = n.ancestros[n.ancestros.length - 1] || { tag: '(raiz)', abre: '', desde: 0 };
    const antes = cuerpo.slice(0, n.idx);
    const ambito = [...antes.matchAll(/data-(?:gremio|fila)="([^"]+)"/g)].pop()?.[1] || '';
    const clave = id + (ambito ? `[${ambito}]` : '') + '/' + propio.tag;
    cuenta[clave] = (cuenta[clave] || 0) + 1;

    const accion = [...n.ancestros].reverse().find((a) => a.tag === 'a' || a.tag === 'button');
    const enAccion = Boolean(accion);
    const esGlifo = !/\p{L}/u.test(n.texto);
    const esRotulo = /class="[^"]*\beyebrow\b/.test(propio.abre)
      || n.ancestros.some((a) => /class="[^"]*\bcmp-head\b/.test(a.abre));
    out.push({
      id: `${clave}#${cuenta[clave]}`,
      texto: n.texto,
      seccion: id,
      ambito,
      etiqueta: propio.tag,
      apertura: propio.abre,
      textoDelElemento: textoDelElemento(cuerpo, propio),
      textoDeLaAccion: accion ? textoDelElemento(cuerpo, accion) : null,
      ariaOculto: n.ancestros.some((a) => /aria-hidden="true"/.test(a.abre)),
      naturaleza: esGlifo ? 'GLIFO' : enAccion ? 'ETIQUETA_DE_ACCION' : esRotulo ? 'ROTULO' : 'PROSA',
      afirma: [
        IDENTIDAD.test(n.texto) ? 'IDENTIDAD' : null,
        CONDICION.test(n.texto) ? 'CONDICION' : null,
        MARCAS_CAPACIDAD.some((re) => re.test(n.texto)) ? 'CAPACIDAD' : null,
      ].filter(Boolean),
    });
  }
  // 🔴 EL MISMO TEXTO PUEDE ESTAR DOS VECES, una dentro del esquema y otra fuera. Medido: «Tu
  // método actual» y «Con YaQu» son cabecera de columna (fuera, en un `<span>`) Y etiqueta de
  // cada fila (dentro, en el `<p>` de la celda). Quien lea la cita tiene que saberlo, o creerá
  // que se le está enseñando un texto que ya aprobó.
  const cubiertos = nodos.filter(cubre).map((n) => n.texto);
  for (const n of out) n.tambienDentro = cubiertos.some((t) => t === n.texto || t.startsWith(n.texto + ' '));
  return { cubiertos, fuera: out, total: nodos.length };
}

/** Las tres secciones, en orden. Devuelve `null` en `secciones` que no existan: lo denuncia el test. */
export function citar(html) {
  const secciones = {};
  for (const id of SECCIONES) secciones[id] = citarSeccion(html, id);
  const fuera = SECCIONES.flatMap((id) => (secciones[id] ? secciones[id].fuera : []));
  return { secciones, fuera };
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// ¿SE LE PUSO DELANTE ALGUNA VEZ? · el cruce con el documento que sí existe
// ═════════════════════════════════════════════════════════════════════════════════════════
export const DOC_APROBACION = 'docs/MICROCOPY_BLOQUE_F_PARA_APROBAR.md';

/** Los textos del documento, por su número (`F4-1`, `F5-12`…). */
export function textosDelDocumento(raiz) {
  const md = fs.readFileSync(path.join(raiz, DOC_APROBACION), 'utf8');
  const out = [];
  for (const m of md.matchAll(/^### (F[0-9]-[0-9]+)[^\n]*\n\n> ([^\n]+)/gm)) {
    out.push({ num: m[1], texto: m[2].trim() });
  }
  return out;
}

/**
 * ¿Está este nodo en el documento? Con `===` y `Buffer.compare`, nunca con `includes()`.
 *
 * Se prueba con DOS formas: el nodo suelto y el texto ENTERO de su elemento. La segunda hace
 * falta porque el documento juntó el enlace con su flecha en una sola entrada («Empezar gratis
 * →»), y sin ella seis nodos parecerían inéditos sin serlo.
 */
export function enElDocumento(nodo, delDoc) {
  const iguales = (a, b) => a === b
    && Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8')) === 0;
  const exacto = delDoc.find((d) => iguales(d.texto, nodo.texto));
  if (exacto) return { num: exacto.num, via: 'el nodo, literal' };
  if (nodo.textoDelElemento) {
    const porElemento = delDoc.find((d) => iguales(d.texto, nodo.textoDelElemento));
    if (porElemento) return { num: porElemento.num, via: 'el elemento entero: «' + nodo.textoDelElemento + '»' };
  }
  // Y el elemento de ACCIÓN que lo envuelve: el documento juntó el enlace con su flecha en una
  // sola entrada, así que la flecha aparece sólo como cola de «Empezar gratis →». Sin esta
  // tercera forma, seis nodos se declararían inéditos y no lo son.
  if (nodo.textoDeLaAccion) {
    const porAccion = delDoc.find((d) => iguales(d.texto, nodo.textoDeLaAccion));
    if (porAccion) return { num: porAccion.num, via: 'la cola de «' + nodo.textoDeLaAccion + '»' };
  }
  return null;
}
