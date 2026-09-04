// tests/_microcopy-aprobada.mjs — SCRUM-709
//
// UNA SOLA FUNCIÓN PARA PREGUNTAR DÓNDE CONSTA UNA APROBACIÓN DE MICROCOPY.
//
// Desde SCRUM-709 las aprobaciones viven en DOS sitios y ninguno de los dos se puede olvidar:
//
//   · `docs/microcopy/` — una aprobación, un fichero. Es donde van las nuevas.
//   · `docs/MICROCOPY_APROBADA_SIN_APLICAR.md` — el registro CONGELADO, con todo lo aprobado
//     hasta el 3-sep-2026. No se borra: era cierto cuando se escribió.
//
// Un lector que mirase sólo uno de los dos daría «no consta» sobre aprobaciones reales, que es
// la peor respuesta posible: parece un veredicto y es una ceguera.
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
export const DIR_APROBACIONES = path.join(RAIZ, 'docs', 'microcopy');
export const REGISTRO_CONGELADO = path.join(RAIZ, 'docs', 'MICROCOPY_APROBADA_SIN_APLICAR.md');

// El README explica la convención; no es una aprobación y no puede contar como tal.
const NO_ES_APROBACION = new Set(['README.md']);

/** El nombre de una aprobación: `AAAA-MM-DD-SCRUM-<n>-<ranura>.md`. */
export const PATRON_NOMBRE = /^(\d{4})-(\d{2})-(\d{2})-SCRUM-(\d+)-([a-z0-9-]+)\.md$/;

/**
 * Todas las aprobaciones, de los dos sitios.
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
      const abs = path.join(DIR_APROBACIONES, nombre);
      const m = PATRON_NOMBRE.exec(nombre);
      out.push({
        origen: 'fichero',
        nombre,
        ruta: 'docs/microcopy/' + nombre,
        fecha: m ? `${m[1]}-${m[2]}-${m[3]}` : null,
        ticket: m ? 'SCRUM-' + m[4] : null,
        ranura: m ? m[5] : null,
        texto: fs.readFileSync(abs, 'utf8'),
      });
    }
  }

  if (fs.existsSync(REGISTRO_CONGELADO)) {
    out.push({
      origen: 'congelado',
      nombre: 'MICROCOPY_APROBADA_SIN_APLICAR.md',
      ruta: 'docs/MICROCOPY_APROBADA_SIN_APLICAR.md',
      fecha: null,
      ticket: null,
      ranura: null,
      texto: fs.readFileSync(REGISTRO_CONGELADO, 'utf8'),
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
 * ¿Dónde consta este texto aprobado? Devuelve las rutas donde aparece, o `[]` si en ninguna.
 * Un `[]` aquí SÍ es un veredicto: el barrido ya se declaró no-ciego al construir la lista.
 */
export function constaAprobado(texto, opciones) {
  const aguja = String(texto).trim();
  if (aguja === '') throw new Error('CIEGO: buscar la cadena vacía casaría con todo.');
  return aprobacionesDeMicrocopy(opciones)
    .filter((a) => a.texto.includes(aguja))
    .map((a) => a.ruta);
}
