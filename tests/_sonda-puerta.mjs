// tests/_sonda-puerta.mjs — SCRUM-765
//
// Sonda del punto de entrada. Imprime UNA línea: `PUERTA:ABRE` o `PUERTA:NO-ABRE`.
//
// 🔴 EXISTE PARA NO SIMULAR. La primera versión del guard llevaba pares `argv[1]`/`import.meta.url`
// CONGELADOS de una sonda de Windows y se los daba a `ejecutadoDirectamente()`. Eso pasaba en
// Windows y **caía en el CI de Linux**, porque `realpath` y la resolución de rutas son de la
// PLATAFORMA: una ruta `C:\…` en Linux es un nombre de fichero relativo, no una ruta absoluta.
//
// El guard arranca esta sonda de verdad, en cada forma de invocación, en la plataforma en la que
// esté corriendo. Así no hay nada que congelar y no hay nada que traducir.
import { ejecutadoDirectamente } from '../scripts/_puerta-de-entrada.mjs';

export const abre = ejecutadoDirectamente(import.meta.url);
console.log(abre ? 'PUERTA:ABRE' : 'PUERTA:NO-ABRE');
