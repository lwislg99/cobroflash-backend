# SCRUM-1737 · La tarjeta de opción del PDF del presupuesto pinta los importes de línea sin IVA

**Medido contra:** `origin/main` = `37947dc1522a094320a4499eac28800f38cdc659` · 2026-11-16T15:14:13Z
A9: comprobación → `tests/scrum836-ancla-de-mutacion-viva.test.mjs`

Escribe jv-j1ez (J1), en su carril: `src/modules/invoicing/**` es de J1 (`node scripts/carriles.mjs de`).
Decisión de Javier (jefe J), 16-nov-2026, con el GO de la regla 40 para esta zona, literal: «sin IVA
como está, solo al final» (SCRUM-1737; SCRUM-1442 c.21875). Vale SOLO para la tarjeta de opción del
PDF del PRESUPUESTO. Sin texto nuevo.

## El defecto

Visto en staging el 16-nov-2026 (SCRUM-1442 c.21874, presupuesto 1917): en la tarjeta «Completa»,
«Desmontaje × 2» salía 90,00 € en la página pública y 108,90 EUR en el PDF. El total de la opción
coincidía (254,10). La tabla principal del PDF ya pintaba el importe de línea sin IVA; la tarjeta,
en modo `sumar`, le sumaba `l.tax`.

## El arreglo

`generateQuotePdf`, tarjeta de opción: `const importe = l.qty * l.price;`. El total de la opción
y el bloque de totales no se tocan (siguen con el IVA). En `no_incluido` el importe de línea ya iba
sin IVA: no cambia.

## Medido

- **Rojo primero**, con el PDF real y el cuerpo de c.21825 tal cual: `tests/scrum1737-…` dio 5 = 2 pass
  + 3 fail sobre el código anterior (① «la línea sale CON IVA (108,90)», ③ la opción de varias líneas,
  ⑤ el control). Después, 5/5.
- Texto del PDF antes y después: `evidencias/SCRUM-1737/antes.txt` y `despues.txt`
  (`sonda-texto-del-pdf.mjs`). Solo cambian los importes de línea de las tarjetas
  (`Desmontaje × 2108,90` → `290,00`, …). Los tres `Total:` de las opciones, el bloque «Base
  imponible / IVA 21% / Total presupuesto» y el presupuesto SIN opciones (tabla principal) salen
  idénticos.
- `generateInvoicePdf` no cambia: su cuerpo (AST) tiene el mismo sha256, `bb2ef2102e711ee9`
  (24.454 B), antes y después; control: el de `generateQuotePdf` sí cambia (`023e35e6…` →
  `3cfc3a01…`). Instrumento: `evidencias/SCRUM-1737/cuerpos-de-funcion.mjs`. Lo ata el caso ⑤.
- `tests/scrum1442c-…` caso ② fijaba los importes de línea CON IVA (121,00, 96,80, 60,50): es lo que
  la decisión cambia, así que pasa a 100,00, 80,00 y 50,00. Sus totales (con IVA) no se tocan.
  No es relajar un guard: el número que exigía es el comportamiento que el jefe ha decidido quitar.
- Mutaciones con `aplicarUna` de la casa (`evidencias/SCRUM-1737/mutaciones.mjs` y `.txt`): 1737
  2/2 VIVAS y 1442c 5/5 VIVAS, las dos con la base en 0 caídos.

- **Error propio, cazado por la suite entera y no por la dirigida:** la mutación M4 de
  `tests/scrum1302m-el-total-y-la-leyenda.test.mjs` citaba la expresión que quité
  (`(ivaFueraDelPapel ? 0 : (l.tax ?? 0))`), y `scrum836` cayó por su ancla caducada. Re-anclada a
  `const importe = l.qty * l.price;`, vigilando lo mismo (la línea de la opción no lleva IVA):
  1302m 5/5 VIVAS, `scrum836` + 1302m 25/25. Carril de 1302m: `carriles.mjs de` dice NO-PUDE-MIRAR
  (es «el test de SCRUM-1302»); el ancla es de `pdf.service.ts`, de J1.
- Suite entera por tramos (`tanda-entera-por-tramos.mjs`, 14 tramos, 1.677 ficheros, 13.647 tests):
  8 caídos, 1 mío (`scrum836`, arriba) y 7 que no tocan nada de este diff y leí como entorno de esta
  máquina: `scrum1298b` ×2 (espera la ruta corta `JAVIER~1` del TEMP y recibe la larga), `scrum351`
  ×1 (hay un `node_modules` en el home, ancestro del TEMP) y `scrum932` ×4 (cargador de claves de BD
  fuera del árbol). No los he corrido sobre `origin/main` sin mi cambio: lo de «entorno» es lectura
  del mensaje, no medición.

## NO medido

- yaqu.app y staging con este código (no está desplegado).
- Un presupuesto con descuento por línea: la tarjeta no pinta descuentos ni antes ni ahora.
