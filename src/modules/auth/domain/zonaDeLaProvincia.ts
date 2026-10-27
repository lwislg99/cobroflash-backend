// src/modules/auth/domain/zonaDeLaProvincia.ts — SCRUM-1522e
//
// LA ZONA CON LA QUE NACE UN COMERCIO. Hasta este fichero ningún camino de `src/` escribía
// `merchants.timezone`: todo comercio nuevo nacía a NULL, y sin zona el día se le cuenta en UTC
// (`ZONA_POR_DEFECTO`, core/zonaDelMerchant.ts). A uno peninsular, entre las 00:00 y las 02:00 de
// su reloj, el sistema le decía que todavía era ayer (medido en SCRUM-1522, Jira c.19288).
//
// Decidido por el fundador (Jira c.19297): la zona se guarda en el alta y sale de la PROVINCIA.
// En España la zona depende sólo de la provincia, y de las 52 sólo cambian dos. No sale del país:
// dentro de `ES` hay dos husos, y por eso `ZONA_POR_DEFECTO` sigue siendo UTC y no se toca.
//
// ⛔ Esto NO decide el impuesto. Ceuta y Melilla van con la hora peninsular y no repercuten IVA:
// la advertencia entera está en core/zonaDelMerchant.ts, y vale igual aquí.
//
// ⚠️ LA GRAFÍA DE LOS 52 NOMBRES NO ESTÁ VERIFICADA contra ninguna fuente oficial: están escritos
// de memoria, sin traer nada de fuera (regla 36). Hoy no los lee ningún usuario —sólo los teclea
// el equipo en su consola—, y por eso se busca sin tildes ni mayúsculas. El día que salgan en una
// pantalla son texto de usuario: se firman entonces (regla 39), con la lista oficial delante.

const PENINSULA = 'Europe/Madrid';
const CANARIAS = 'Atlantic/Canary';

/** Las 50 provincias, Ceuta y Melilla, con la zona que se le guarda al comercio. */
const PROVINCIAS: ReadonlyArray<readonly [nombre: string, zona: string]> = [
  ['A Coruña', PENINSULA],
  ['Álava', PENINSULA],
  ['Albacete', PENINSULA],
  ['Alicante', PENINSULA],
  ['Almería', PENINSULA],
  ['Asturias', PENINSULA],
  ['Ávila', PENINSULA],
  ['Badajoz', PENINSULA],
  ['Barcelona', PENINSULA],
  ['Bizkaia', PENINSULA],
  ['Burgos', PENINSULA],
  ['Cáceres', PENINSULA],
  ['Cádiz', PENINSULA],
  ['Cantabria', PENINSULA],
  ['Castellón', PENINSULA],
  ['Ceuta', PENINSULA],
  ['Ciudad Real', PENINSULA],
  ['Córdoba', PENINSULA],
  ['Cuenca', PENINSULA],
  ['Gipuzkoa', PENINSULA],
  ['Girona', PENINSULA],
  ['Granada', PENINSULA],
  ['Guadalajara', PENINSULA],
  ['Huelva', PENINSULA],
  ['Huesca', PENINSULA],
  ['Illes Balears', PENINSULA],
  ['Jaén', PENINSULA],
  ['La Rioja', PENINSULA],
  ['Las Palmas', CANARIAS],
  ['León', PENINSULA],
  ['Lleida', PENINSULA],
  ['Lugo', PENINSULA],
  ['Madrid', PENINSULA],
  ['Málaga', PENINSULA],
  ['Melilla', PENINSULA],
  ['Murcia', PENINSULA],
  ['Navarra', PENINSULA],
  ['Ourense', PENINSULA],
  ['Palencia', PENINSULA],
  ['Pontevedra', PENINSULA],
  ['Salamanca', PENINSULA],
  ['Santa Cruz de Tenerife', CANARIAS],
  ['Segovia', PENINSULA],
  ['Sevilla', PENINSULA],
  ['Soria', PENINSULA],
  ['Tarragona', PENINSULA],
  ['Teruel', PENINSULA],
  ['Toledo', PENINSULA],
  ['Valencia', PENINSULA],
  ['Valladolid', PENINSULA],
  ['Zamora', PENINSULA],
  ['Zaragoza', PENINSULA],
];

/** Sin tildes, sin mayúsculas y con un solo espacio entre palabras: como se compara un nombre. */
function plano(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const ZONA_POR_NOMBRE = new Map(PROVINCIAS.map(([nombre, zona]) => [plano(nombre), zona]));

/** El rechazo lleva dentro los nombres que la tabla admite: quien lo recibe puede decirlos. */
function rechazo(code: 'provincia_required' | 'provincia_desconocida'): Error & { code: string; provincias: string[] } {
  const err = new Error(code) as Error & { code: string; provincias: string[] };
  err.code = code;
  err.provincias = PROVINCIAS.map(([nombre]) => nombre);
  return err;
}

/**
 * La zona que se guarda al crear un comercio. **Único sitio donde se decide.**
 *
 *   · España  → la de su provincia. Sin provincia, o con una que no está en la tabla, LANZA
 *     (`provincia_required` / `provincia_desconocida`): un comercio de España no nace sin zona.
 *   · Otro país → `null`, como hasta hoy: no hay tabla de ningún otro país y no se ha decidido
 *     ninguna. Con una provincia delante también lanza: no se guarda una zona que nadie ha medido,
 *     y callarla sería un argumento que no hizo nada y se lee igual que uno que sí.
 */
export function zonaDeAlta(country: string, provincia?: string): string | null {
  const dicha = plano(String(provincia ?? ''));
  if (String(country).trim().toUpperCase() !== 'ES') {
    if (dicha) throw rechazo('provincia_desconocida');
    return null;
  }
  if (!dicha) throw rechazo('provincia_required');
  const zona = ZONA_POR_NOMBRE.get(dicha);
  if (!zona) throw rechazo('provincia_desconocida');
  return zona;
}
