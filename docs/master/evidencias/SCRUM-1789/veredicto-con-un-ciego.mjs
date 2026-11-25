// SCRUM-1789b · guion «una vez»: ¿qué código de salida da la puerta de los guards de navegador
// cuando uno sale CIEGO? Llama a `veredicto` —la función pura de la que sale el `process.exit`
// del runner— con un guard SEMBRADO en CIEGO, con y sin un rojo al lado, y con todo verde.
//
//   node docs/master/evidencias/SCRUM-1789/veredicto-con-un-ciego.mjs
//
// Esperado (medido el 23-nov-2026): soloCiego → 2 · rojoYCiego → 1 (y nombra al ciego) · todoVerde → 0.
// Sale 1 si alguno no da lo esperado: así el guion no puede «pasar» sin haber mirado.
import { veredicto } from '../../../../scripts/guards-visuales.mjs';

const SEMBRADO = { g: 'guard:sembrado-sin-pagina', estado: 'CIEGO', codigo: 2 };
const casos = [
  ['soloCiego', [{ g: 'guard:a', estado: 'verde', codigo: 0 }, SEMBRADO], 2],
  ['rojoYCiego', [{ g: 'guard:r', estado: 'rojo', codigo: 1 }, SEMBRADO], 1],
  ['todoVerde', [{ g: 'guard:a', estado: 'verde', codigo: 0 }], 0],
];

let malos = 0;
for (const [nombre, filas, esperado] of casos) {
  const v = veredicto(filas);
  const nombraAlCiego = filas.includes(SEMBRADO) ? v.detalle.includes(SEMBRADO.g) : true;
  const ok = v.codigo === esperado && nombraAlCiego;
  if (!ok) malos += 1;
  console.log((ok ? 'ok   ' : 'MAL  ') + nombre + ' → salida ' + v.codigo + ' (esperada ' + esperado + ')'
    + (filas.includes(SEMBRADO) ? ' · nombra al sembrado: ' + nombraAlCiego : '') + ' · ' + v.titulo);
}
console.log(casos.length + ' casos · ' + malos + ' mal');
process.exit(malos ? 1 : 0);
