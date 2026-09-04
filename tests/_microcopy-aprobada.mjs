// tests/_microcopy-aprobada.mjs — SCRUM-709 · endurecido en SCRUM-710
//
// UNA SOLA FUNCIÓN PARA PREGUNTAR DÓNDE CONSTA UNA APROBACIÓN DE MICROCOPY.
//
// Desde SCRUM-709 las aprobaciones viven en DOS sitios y ninguno se puede olvidar:
//
//   · `docs/microcopy/` — una aprobación, un fichero. Es donde van las nuevas.
//   · `docs/MICROCOPY_APROBADA_SIN_APLICAR.md` — el registro CONGELADO, con todo lo aprobado
//     hasta el 3-sep-2026. No se borra: era cierto cuando se escribió.
//
// ── 🔒 UN PREFIJO NO ES UN NOMBRE, Y UNA SUBCADENA TAMPOCO (SCRUM-710) ──────────────────────
//
// La primera versión de `constaAprobado` casaba por SUBCADENA, y eso no era un riesgo teórico:
// hay textos aprobados de dos palabras —«Mano de obra», «Materiales», «Guardar precios»,
// «Precio por unidad»— cuyas palabras aparecen en la prosa normal del propio registro. Preguntar
// por «Materiales del almacén central» habría contestado «aprobado» porque «Materiales» está
// escrito en alguna frase. Un verde falso esperando, hoy.
//
// Es la cuarta cara de la misma avería de esta semana: `data-view="parte*"` por prefijo,
// `window.renderParte` dentro de `renderPartesOficinaView`, un guard apuntando al alias en vez de
// a la función, y esta subcadena. **Se compara el HECHO, no la forma.**
//
// EL MECANISMO: no se busca dentro del texto del registro; se EXTRAEN las unidades delimitadas en
// las que el registro escribe un texto aprobado, y se compara por IDENTIDAD.
//
//   · **Celda de la columna «Texto aprobado»** de una tabla — es como está escrito TODO lo del
//     registro congelado, medido: las 18 aprobaciones conocidas salen de ahí.
//   · **Línea de cita (`> …`)** dentro de `docs/microcopy/` — es como lo escribe el mecanismo
//     nuevo, un fichero por aprobación.
//
// Los delimitadores no son una convención inventada aquí: son los que YA usa el registro.
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
export const DIR_APROBACIONES = path.join(RAIZ, 'docs', 'microcopy');
export const REGISTRO_CONGELADO = path.join(RAIZ, 'docs', 'MICROCOPY_APROBADA_SIN_APLICAR.md');

// El README explica la convención; no es una aprobación y no puede contar como tal.
const NO_ES_APROBACION = new Set(['README.md']);

/** El nombre de una aprobación: `AAAA-MM-DD-SCRUM-<n>-<ranura>.md`. */
export const PATRON_NOMBRE = /^(\d{4})-(\d{2})-(\d{2})-SCRUM-(\d+)-([a-z0-9-]+)\.md$/;

/** Cabecera de la columna que contiene el texto que el fundador firmó. */
const COLUMNA_DEL_TEXTO = /^texto\s+aprobado$/i;

const esFilaDeTabla = (l) => /^\s*\|.*\|\s*$/.test(l);
const esSeparador = (l) => /^\s*\|[\s:|-]+\|\s*$/.test(l);
const celdas = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

/**
 * Quita el adorno de Markdown que envuelve un literal sin formar parte de él: comillas de código,
 * negrita y cursiva. `**Vigente**` y `` `Vigente` `` son el mismo texto aprobado.
 */
function desnudar(s) {
  let t = String(s).trim();
  for (let i = 0; i < 4; i++) {
    const antes = t;
    t = t.replace(/^`(.*)`$/s, '$1').replace(/^\*\*(.*)\*\*$/s, '$1').replace(/^\*(.*)\*$/s, '$1').trim();
    if (t === antes) break;
  }
  return t;
}

/**
 * Las unidades delimitadas donde este documento escribe textos aprobados.
 * Se recorre el fichero ENTERO, línea a línea. Sin ventanas de N líneas.
 */
function unidadesDelimitadas(texto, { aceptarCitas }) {
  const out = [];
  const lineas = texto.split(/\r?\n/);
  let columna = -1; // índice de «Texto aprobado» en la tabla que se está recorriendo

  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];

    if (!esFilaDeTabla(l)) {
      columna = -1; // fuera de la tabla: la columna deja de valer
      if (aceptarCitas && /^\s*>\s?\S/.test(l)) {
        const cita = desnudar(l.replace(/^\s*>\s?/, ''));
        if (cita) out.push(cita);
      }
      continue;
    }
    if (esSeparador(l)) continue;

    const cs = celdas(l);
    const idx = cs.findIndex((c) => COLUMNA_DEL_TEXTO.test(desnudar(c)));
    if (idx >= 0) { columna = idx; continue; } // era la cabecera
    if (columna >= 0 && columna < cs.length) {
      const v = desnudar(cs[columna]);
      if (v && v !== 'ídem') out.push(v);
    }
  }
  return out;
}

/**
 * Todas las aprobaciones, de los dos sitios, con sus textos ya extraídos.
 *
 * 🔴 SUELO DE CEGUERA: si no encuentra NINGUNA, lanza. Hay decenas; cero significa que el barrido
 * no supo mirar —directorio movido, permisos, un cambio de nombre— y devolver `[]` convertiría
 * esa ceguera en un veredicto tranquilo. «Cero» y «no supe mirar» no son el mismo número.
 */
export function aprobacionesDeMicrocopy({ permitirVacio = false } = {}) {
  const out = [];

  if (fs.existsSync(DIR_APROBACIONES)) {
    for (const nombre of fs.readdirSync(DIR_APROBACIONES).sort()) {
      if (!nombre.endsWith('.md') || NO_ES_APROBACION.has(nombre)) continue;
      const texto = fs.readFileSync(path.join(DIR_APROBACIONES, nombre), 'utf8');
      const m = PATRON_NOMBRE.exec(nombre);
      out.push({
        origen: 'fichero',
        nombre,
        ruta: 'docs/microcopy/' + nombre,
        fecha: m ? `${m[1]}-${m[2]}-${m[3]}` : null,
        ticket: m ? 'SCRUM-' + m[4] : null,
        ranura: m ? m[5] : null,
        texto,
        // En un fichero por aprobación, el literal va en su cita; y algunos usan tabla.
        literales: unidadesDelimitadas(texto, { aceptarCitas: true }),
      });
    }
  }

  if (fs.existsSync(REGISTRO_CONGELADO)) {
    const texto = fs.readFileSync(REGISTRO_CONGELADO, 'utf8');
    out.push({
      origen: 'congelado',
      nombre: 'MICROCOPY_APROBADA_SIN_APLICAR.md',
      ruta: 'docs/MICROCOPY_APROBADA_SIN_APLICAR.md',
      fecha: null,
      ticket: null,
      ranura: null,
      texto,
      // 🔴 AQUÍ NO SE ACEPTAN CITAS: el registro congelado usa `>` para NOTAS y avisos, no para
      // literales aprobados. Aceptarlas convertiría cada nota en un «texto aprobado».
      literales: unidadesDelimitadas(texto, { aceptarCitas: false }),
    });
  }

  if (out.length === 0 && !permitirVacio) {
    throw new Error(
      'CIEGO: el barrido de aprobaciones de microcopy no encontró NADA, y hay decenas. '
      + 'No se devuelve una lista vacía: eso convertiría una ceguera en un veredicto. '
      + `Miré en ${DIR_APROBACIONES} y en ${REGISTRO_CONGELADO}.`,
    );
  }
  return out;
}

/**
 * ¿Dónde consta este texto aprobado? Devuelve las rutas donde consta, o `[]` si en ninguna.
 *
 * 🔒 POR IDENTIDAD, NO POR SUBCADENA: «Materiales» NO casa dentro de «Materiales del almacén
 * central» ni dentro de una frase en prosa del registro. Un `[]` aquí SÍ es un veredicto: el
 * barrido ya se declaró no-ciego al construir la lista.
 */
export function constaAprobado(texto, opciones) {
  const aguja = desnudar(texto);
  if (aguja === '') throw new Error('CIEGO: buscar la cadena vacía casaría con todo.');
  return aprobacionesDeMicrocopy(opciones)
    .filter((a) => a.literales.includes(aguja))
    .map((a) => a.ruta);
}

/** Todos los literales aprobados, sin repetir. Útil para enumerar y para censos derivados. */
export function literalesAprobados(opciones) {
  const set = new Set();
  for (const a of aprobacionesDeMicrocopy(opciones)) for (const l of a.literales) set.add(l);
  return [...set];
}
