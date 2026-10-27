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
//
// SCRUM-1616b: la lista se cotejó con el INE (Jira SCRUM-1616 c.21062): 48 coinciden y 4 son
// bilingües con forma doble oficial. El fundador firmó las 52 en c.21066, y además que se acepten
// las 4 formas dobles y el código INE (01…52). La grafía de los nombres de abajo no se ha tocado.

const PENINSULA = 'Europe/Madrid';
const CANARIAS = 'Atlantic/Canary';

/**
 * Las 50 provincias, Ceuta y Melilla, con su código INE y la zona que se le guarda al comercio.
 * SCRUM-1616b: el código es el de la «Relación de provincias con sus códigos» del INE, cotejada
 * fila a fila en `docs/master/SCRUM-1616.md` (tramo J4). El nombre es el de hoy: es el que dice el
 * rechazo, y ése no cambia.
 */
const PROVINCIAS: ReadonlyArray<readonly [ine: string, nombre: string, zona: string]> = [
  ['15', 'A Coruña', PENINSULA],
  ['01', 'Álava', PENINSULA],
  ['02', 'Albacete', PENINSULA],
  ['03', 'Alicante', PENINSULA],
  ['04', 'Almería', PENINSULA],
  ['33', 'Asturias', PENINSULA],
  ['05', 'Ávila', PENINSULA],
  ['06', 'Badajoz', PENINSULA],
  ['08', 'Barcelona', PENINSULA],
  ['48', 'Bizkaia', PENINSULA],
  ['09', 'Burgos', PENINSULA],
  ['10', 'Cáceres', PENINSULA],
  ['11', 'Cádiz', PENINSULA],
  ['39', 'Cantabria', PENINSULA],
  ['12', 'Castellón', PENINSULA],
  ['51', 'Ceuta', PENINSULA],
  ['13', 'Ciudad Real', PENINSULA],
  ['14', 'Córdoba', PENINSULA],
  ['16', 'Cuenca', PENINSULA],
  ['20', 'Gipuzkoa', PENINSULA],
  ['17', 'Girona', PENINSULA],
  ['18', 'Granada', PENINSULA],
  ['19', 'Guadalajara', PENINSULA],
  ['21', 'Huelva', PENINSULA],
  ['22', 'Huesca', PENINSULA],
  ['07', 'Illes Balears', PENINSULA],
  ['23', 'Jaén', PENINSULA],
  ['26', 'La Rioja', PENINSULA],
  ['35', 'Las Palmas', CANARIAS],
  ['24', 'León', PENINSULA],
  ['25', 'Lleida', PENINSULA],
  ['27', 'Lugo', PENINSULA],
  ['28', 'Madrid', PENINSULA],
  ['29', 'Málaga', PENINSULA],
  ['52', 'Melilla', PENINSULA],
  ['30', 'Murcia', PENINSULA],
  ['31', 'Navarra', PENINSULA],
  ['32', 'Ourense', PENINSULA],
  ['34', 'Palencia', PENINSULA],
  ['36', 'Pontevedra', PENINSULA],
  ['37', 'Salamanca', PENINSULA],
  ['38', 'Santa Cruz de Tenerife', CANARIAS],
  ['40', 'Segovia', PENINSULA],
  ['41', 'Sevilla', PENINSULA],
  ['42', 'Soria', PENINSULA],
  ['43', 'Tarragona', PENINSULA],
  ['44', 'Teruel', PENINSULA],
  ['45', 'Toledo', PENINSULA],
  ['46', 'Valencia', PENINSULA],
  ['47', 'Valladolid', PENINSULA],
  ['49', 'Zamora', PENINSULA],
  ['50', 'Zaragoza', PENINSULA],
];

/** Sin tildes, sin mayúsculas y con un solo espacio entre palabras: como se compara un nombre. */
function plano(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * SCRUM-1616b (firmado en Jira SCRUM-1616 c.21066 ②): las cuatro que el INE da con forma doble
 * oficial. La tabla lleva su mitad castellana, y las dos se aceptan. La otra mitad SOLA no.
 */
const FORMAS_DOBLES: ReadonlyArray<readonly [doble: string, ine: string]> = [
  ['Araba/Álava', '01'],
  ['Alicante/Alacant', '03'],
  ['Castellón/Castelló', '12'],
  ['Valencia/València', '46'],
];

const ZONA_POR_CODIGO = new Map(PROVINCIAS.map(([ine, , zona]) => [ine, zona] as const));

/** Lo que se puede decir de una provincia: su nombre, su código INE (01…52) o su forma doble. */
const ZONA_POR_LO_DICHO = new Map([
  ...PROVINCIAS.map(([, nombre, zona]) => [plano(nombre), zona] as const),
  ...ZONA_POR_CODIGO,
  ...FORMAS_DOBLES.map(([doble, ine]) => [plano(doble), ZONA_POR_CODIGO.get(ine)] as const),
]);

/** El rechazo lleva dentro los nombres que la tabla admite: quien lo recibe puede decirlos. */
function rechazo(code: 'provincia_required' | 'provincia_desconocida'): Error & { code: string; provincias: string[] } {
  const err = new Error(code) as Error & { code: string; provincias: string[] };
  err.code = code;
  err.provincias = PROVINCIAS.map(([, nombre]) => nombre);
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
  const zona = ZONA_POR_LO_DICHO.get(dicha);
  if (!zona) throw rechazo('provincia_desconocida');
  return zona;
}
