// tests/_base-de-la-rama.mjs — SCRUM-723
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// CONTRA QUÉ SE COMPARA UN GUARD DE RAMA
//
// La pregunta de un guard de PR es «¿qué ha cambiado ESTA rama?». Si la contesta leyendo
// `origin/main`, no compara contra su punto de partida: compara contra un sitio que se mueve cada
// vez que otro PR entra. El 4-sep-2026 el guard de SCRUM-603b acusó a la rama de SCRUM-605 de
// tocar el PDF de la factura. No lo había tocado: SCRUM-594 había entrado en `main` tocando ese
// fichero, y el guard leía la PUNTA.
//
// La referencia estable es el PUNTO DE PARTIDA de la rama, que es un commit y no se mueve.
//
// 🔴 EL MOTOR NO NACE AQUÍ, SE IMPORTA. `baseDeLaRama` ya existía en `_censo-eol.mjs` desde
// SCRUM-533, con su lista de referencias de respaldo y su `null` honesto cuando no puede
// resolver. Escribir un segundo `merge-base` sería tener dos que divergen el día que alguien
// arregle uno. Lo que se añade aquí es SUPERFICIE: leer un fichero EN esa base.
//
// EN CI TAMBIÉN VALE, y no por casualidad: en un PR, `actions/checkout` deja como HEAD el commit
// de MEZCLA, cuyo árbol ya lleva lo de `main` dentro. Ahí `merge-base` da la punta de `main` y la
// diferencia contra el disco vuelve a ser, exactamente, lo que aporta la rama. La misma cuenta en
// los dos sitios.
// ═════════════════════════════════════════════════════════════════════════════════════════
import { execFileSync } from 'node:child_process';
import { baseDeLaRama } from './_censo-eol.mjs';

export { baseDeLaRama };

/**
 * El contenido de `ruta` tal y como estaba en el PUNTO DE PARTIDA de la rama.
 *
 * Devuelve `{ contenido, base }`, o `{ contenido: null, base }` si no se puede resolver. **No
 * inventa un respaldo a `origin/main`**: ése es justo el defecto que este fichero existe para
 * quitar, y un respaldo silencioso lo devolvería sin que nadie se enterase.
 *
 * @param {string} raiz  raíz del repositorio
 * @param {string} ruta  ruta relativa, con `/`
 */
export function contenidoEnLaBase(raiz, ruta) {
  const base = baseDeLaRama(raiz);
  if (!base) return { contenido: null, base: null };
  try {
    const contenido = execFileSync('git', ['show', `${base.sha}:${ruta}`], {
      cwd: raiz, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
    });
    return { contenido, base };
  } catch {
    // El fichero no existía en la base (lo crea esta rama). Es un caso legítimo y distinto de
    // «no supe mirar»: se dice con `null` y quien llama decide.
    return { contenido: null, base };
  }
}
