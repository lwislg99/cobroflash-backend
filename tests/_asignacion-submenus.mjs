// tests/_asignacion-submenus.mjs — SCRUM-284 (B1)
//
// ⚠️ AQUÍ YA NO VIVE EL MAPA. Vive en `public/dashboard/js/settingsSubmenus.js`, que es el fichero
// que la PANTALLA carga y usa para colocar cada campo.
//
// El porqué está medido y es el defecto de este ticket repetido un piso más arriba: mientras el mapa
// vivía SOLO aquí, el guard comprobaba una tabla **que la pantalla no usaba**. Su verde no decía
// nada sobre lo que el profesional ve — bastaba con que alguien colocara un campo en otro sitio en
// `settingsView.js` para que las dos versiones divergieran en silencio.
//
// Este fichero se conserva como PUERTA del test (la ruta de importación no cambia) y como sitio
// donde vive lo que es solo del control cruzado: la lista de asuntos del ticket y el marcador.
import mapa from '../public/dashboard/js/settingsSubmenus.js';

export const {
  SUBMENUS,
  ASIGNACION_SUBMENU: ASIGNACION,
  FUERA_DE_CONFIGURACION,
  PENDIENTES_DE_DECISION,
  VACIOS_DECLARADOS,
  submenuDeCampo,
  revisarAsignacion,
} = mapa;

/** Rótulo pendiente de aprobación. Todo nombre visible pasa por aquí. */
export const PENDIENTE = (borrador) => `${mapa.MARCA_MICROCOPY_SUBMENU} ${borrador}`;

/**
 * Los ASUNTOS que enumera el ticket, copiados literalmente y sin reordenar.
 * NO es el censo. Es el CONTROL CRUZADO — y su valor está medido: el censo derivado se dejó fuera
 * tres campos (`createToggle`, una forma que el detector no conocía) con todos sus suelos en VERDE,
 * y lo destapó contrastarlo con esta lista. Un censo derivado tampoco avisa de la forma que no
 * reconoce; una lista a mano no avisa de lo que le falta. Cada una ve lo que a la otra se le escapa.
 */
export const ASUNTOS_DEL_TICKET = [
  'datos de empresa', 'fiscales', 'dirección', 'WhatsApp', 'moneda',
  'prefijo de factura', 'IBAN/Bizum', 'reseñas de Google', 'avisos por email',
  'marca y color', 'invita y gana', 'página pública',
];
