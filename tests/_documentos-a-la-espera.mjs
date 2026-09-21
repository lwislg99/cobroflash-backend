// tests/_documentos-a-la-espera.mjs — SCRUM-547 (2ª vuelta)
//
// QUÉ DOCUMENTOS ESPERAN UNA APROBACIÓN, Y SI ALGUIEN LOS ENLAZA.
//
// Vive aparte del guard por dos razones, y la segunda es la que manda:
//   ① lo puede usar otro censo sin duplicar el criterio (regla 2);
//   ② 🔴 **la mutación de SCRUM-745 no puede apuntar al fichero que la declara**: el literal `de`
//      aparecería dos veces —en el código y dentro de la propia declaración— y el meta-guard lo
//      rechaza por no ser único. Es la autorreferencia de SCRUM-693/694 en su versión de
//      mutaciones. Sacando la lógica aquí, la mutación apunta a OTRO fichero y sí calza.
//
// No registra tests: es un ayudante. Importarlo no mueve el total de la tanda.
import fs from 'node:fs';
import path from 'node:path';

/** Las puertas por las que el fundador entra. No es opinión: son las que la casa declara suyas. */
export const PUERTAS = ['docs/YAQU_MASTER.md', 'docs/PENDIENTES_FUNDADOR.md'];

const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * DOS SEÑALES, y hacen falta las dos.
 * ① el NOMBRE lo dice · ② el CUERPO lo dice de sí mismo en su cabecera.
 * Sólo por nombre caduca en cuanto alguien llame distinto al siguiente; sólo por cuerpo se
 * escapan los que no se presentan.
 */
export const RE_NOMBRE = /(para_aprobar|pendiente|sin_aplicar|sin_aprobar|por_aprobar|para_validar)/i;
export const RE_CUERPO = /\b(para aprobar|pendiente de aprobar|pendiente del fundador|sin aprobar|esperando aprobacion|para que (lo )?apruebes|falta que (lo )?apruebes)\b/;

/**
 * 🔴 EL REGISTRO NO ENTRA, y va declarado. `docs/master/` es UNA ENTRADA POR TICKET: se referencia
 * por su ticket, no por una lista de pendientes. Si entrara, esto pediría enlazar ~500 entradas de
 * registro desde la lista del fundador, que es justo el ruido que acaba apagando un guard.
 */
export const esRegistro = (rel) => rel.startsWith('docs/master/');

export function todosLosMd(raiz, dir = null, out = []) {
  const d = dir ?? path.join(raiz, 'docs');
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) { todosLosMd(raiz, p, out); continue; }
    if (/\.md$/i.test(e.name)) out.push(path.relative(raiz, p).split(path.sep).join('/'));
  }
  return out.sort();
}

/** Los documentos que se declaran a la espera de una aprobación, con qué señal los delató. */
export function documentosALaEspera(raiz) {
  const out = [];
  for (const rel of todosLosMd(raiz)) {
    if (esRegistro(rel)) continue;
    const txt = fs.readFileSync(path.join(raiz, rel), 'utf8');
    const porNombre = RE_NOMBRE.test(path.basename(rel));
    const porCuerpo = RE_CUERPO.test(norm(txt.split('\n').slice(0, 25).join('\n')));
    if (porNombre || porCuerpo) out.push({ doc: rel, porNombre, porCuerpo });
  }
  return out;
}

/** El texto de las puertas, junto. */
export function textoDeLasPuertas(raiz) {
  return PUERTAS.map((p) => {
    try { return fs.readFileSync(path.join(raiz, p), 'utf8'); } catch { return ''; }
  }).join('\n');
}

export function estaEnlazado(rel, puertas) {
  return puertas.includes(rel) || puertas.includes(path.basename(rel));
}

/**
 * 🔴 LOS QUE HOY NO SE ENLAZAN, CERRADOS EN DOS Y CLAVADOS POR IDENTIDAD.
 *
 * El motivo es de carril, no de pereza:
 *   · `MICROCOPY_APROBADA_SIN_APLICAR.md` lo está tocando **otra sesión ahora mismo** en la rama
 *     viva `scrum-650-microcopy-aprobada`. Enlazarlo sería escribir en su carril (regla 9) y
 *     además chocaría en el merge.
 *   · `CENSO_MICROCOPY_PENDIENTE.md` es un CENSO de trabajo interno, no una decisión que el
 *     fundador tenga que tomar: ponerlo en su lista le daría una tarea que no es suya. Si alguien
 *     decide que sí lo es, se quita de aquí y se enlaza.
 *
 * Un tercero NO se añade: se decide. Un límite declarado y no cerrado deja de ser advertencia y
 * pasa a ser permiso.
 */
export const TOPE_SIN_ENLAZAR = 2;
export const SIN_ENLAZAR_DECLARADOS = {
  'docs/MICROCOPY_APROBADA_SIN_APLICAR.md': 'lo lleva otra sesión en scrum-650-microcopy-aprobada (regla 9)',
  'docs/CENSO_MICROCOPY_PENDIENTE.md': 'es un censo de trabajo interno, no una decisión del fundador',
};
