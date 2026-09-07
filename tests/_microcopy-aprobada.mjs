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
const DIR_APROBACIONES_REAL = DIR_APROBACIONES;
const REGISTRO_CONGELADO_REAL = REGISTRO_CONGELADO;

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

/** La firma que la regla 30 exige. Las demás formas se leen, pero NO cuentan como aprobación. */
const FIRMA_DEL_FUNDADOR = /^\s*\**\s*Aprobad[oa]s?\s+por\s+el\s+fundador\b/i;
const CUALQUIER_FIRMA = /^\s*\**\s*Aprobad[oa]s?\s+por\s+(?:el|la|los|las)\s+\**\s*([\wÁÉÍÓÚÜÑáéíóúüñ]+)/i;

/**
 * ¿Quién firma este registro? `'fundador'`, otro nombre en minúsculas, o `null` si no lo dice.
 *
 * 🔴 LAS LÍNEAS DE CITA (`>`) NO CUENTAN, y no es un detalle: ahí es donde los registros escriben
 * su propia historia. El de SCRUM-605 conserva, citada, la frase «Aprobado por el ASESOR» que
 * explica el error — y el de mañana podría conservar citada la contraria. Un lector que mirase el
 * fichero entero se dejaría convencer por la explicación en vez de por la firma.
 *
 * No es una ventana de N líneas: es el mismo criterio estructural que ya usa el extractor de
 * literales (SCRUM-715), leyendo el documento ENTERO y quedándose con lo que no está citado.
 */
export function firmanteDe(texto) {
  const lineas = String(texto).split(/\r?\n/).filter((l) => !/^\s*>/.test(l));
  for (const l of lineas) if (FIRMA_DEL_FUNDADOR.test(l)) return 'fundador';
  for (const l of lineas) {
    const m = CUALQUIER_FIRMA.exec(l);
    if (m) return m[1].toLowerCase();
  }
  return null;
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
export function aprobacionesDeMicrocopy({ permitirVacio = false, dir = null, congelado = null } = {}) {
  const out = [];
  // `dir`/`congelado` existen para PODER PROBAR ESTO SIN ENSUCIAR EL DIRECTORIO REAL: escribir un
  // registro de mentira en `docs/microcopy/` durante la suite lo vería cualquier otro guard que
  // corra en paralelo. Fuera de los tests no se pasan, y entonces son los de siempre.
  const DIR_APROBACIONES = dir || DIR_APROBACIONES_REAL;
  const REGISTRO_CONGELADO = congelado === null ? REGISTRO_CONGELADO_REAL : congelado;

  if (DIR_APROBACIONES && fs.existsSync(DIR_APROBACIONES)) {
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
        firmante: firmanteDe(texto),
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
      // El registro congelado es la constancia de TODO lo que el fundador aprobó hasta el
      // 3-sep-2026. Su firma no está línea a línea porque el fichero entero ES su registro.
      firmante: 'fundador',
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
 * ¿Dónde consta este texto aprobado **POR EL FUNDADOR**? Devuelve las rutas, o `[]`.
 *
 * 🔒 POR IDENTIDAD, NO POR SUBCADENA (SCRUM-715): «Materiales» NO casa dentro de «Materiales del
 * almacén central» ni dentro de una frase en prosa del registro.
 *
 * 🔒 Y POR QUIÉN FIRMA, NO POR QUIÉN ESCRIBE (SCRUM-726): antes esta función contestaba «aprobado»
 * en cuanto el texto estuviera escrito en `docs/microcopy/`, **sin mirar la firma**. La regla 30
 * dice que la microcopy la aprueba el fundador; el guard comprobaba que alguien la hubiera
 * escrito. Son dos afirmaciones distintas y daban el mismo verde. Lo destapó el asesor sobre su
 * propio registro: metió el de SCRUM-605 con SU firma y esta función lo leyó como la del fundador.
 *
 * Un `[]` aquí SÍ es un veredicto: el barrido ya se declaró no-ciego al construir la lista.
 */
export function constaAprobado(texto, opciones) {
  const aguja = desnudar(texto);
  if (aguja === '') throw new Error('CIEGO: buscar la cadena vacía casaría con todo.');
  return aprobacionesDeMicrocopy(opciones)
    .filter((a) => a.firmante === 'fundador')
    .filter((a) => a.literales.includes(aguja))
    .map((a) => a.ruta);
}

/**
 * Los registros que NO llevan firma del fundador, con sus literales.
 *
 * 🔴 EXISTE PARA QUE EL ARREGLO NO SEA PEOR QUE EL DEFECTO: un texto sin firma **no se borra de la
 * pantalla**, se LISTA para que el fundador lo firme. Un guard que dejara media aplicación con
 * corchetes de golpe costaría más que el hueco que cierra.
 */
export function pendientesDeFirma(opciones) {
  return aprobacionesDeMicrocopy(opciones)
    .filter((a) => a.firmante !== 'fundador')
    .map((a) => ({ ruta: a.ruta, firmante: a.firmante, literales: a.literales }));
}

/** Todos los literales aprobados POR EL FUNDADOR, sin repetir. */
export function literalesAprobados(opciones) {
  const set = new Set();
  for (const a of aprobacionesDeMicrocopy(opciones)) {
    if (a.firmante !== 'fundador') continue;
    for (const l of a.literales) set.add(l);
  }
  return [...set];
}
