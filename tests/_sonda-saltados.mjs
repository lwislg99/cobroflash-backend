// tests/_sonda-saltados.mjs — SCRUM-754c
//
// Sonda del clasificador de eventos. Ejecuta `correr()` —el camino REAL del meta-guard— sobre el
// fichero que se le pase y escupe UNA línea de JSON con lo que clasificó.
//
// 🔴 EXISTE PARA NO SIMULAR, igual que `_sonda-puerta.mjs` (SCRUM-765). La tentación era llamar a
// `correr()` desde dentro del test y mirar el resultado; MEDIDO: no funciona. `correr()` usa
// `run()` de `node:test`, y un `run()` ANIDADO dentro de un test que ya está corriendo no entrega
// los eventos por test — el resultado llega vacío. Un test que se conformara con eso estaría
// midiendo el vacío y saldría verde diciendo que todo está bien.
//
// Desde un subproceso limpio, `run()` entrega lo que entrega de verdad, que es lo único que
// permite afirmar algo sobre cómo `node:test` marca un test saltado.
import { correr } from '../scripts/meta-guard-mutaciones.mjs';

const objetivo = process.argv[2];
if (!objetivo) {
  console.error('uso: node tests/_sonda-saltados.mjs <ruta absoluta a un .test.mjs>');
  process.exit(2);
}

const r = await correr(objetivo);
console.log(JSON.stringify({ pasados: r.pasados, saltados: r.saltados, caidos: r.caidos }));
