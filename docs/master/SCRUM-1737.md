# SCRUM-1737 · La tarjeta de opción del PDF del presupuesto pinta los importes de línea sin IVA

**Medido contra:** `origin/main` = `37947dc1522a094320a4499eac28800f38cdc659` · 2026-11-16T15:14:13Z
A9: comprobación → `tests/scrum1737-la-tarjeta-sin-iva.test.mjs`

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

## NO medido

- yaqu.app y staging con este código (no está desplegado).
- Un presupuesto con descuento por línea: la tarjeta no pinta descuentos ni antes ni ahora.
