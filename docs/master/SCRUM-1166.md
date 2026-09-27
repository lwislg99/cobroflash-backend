# SCRUM-1166 · El detalle del presupuesto dice si el cliente tiene número (parte a de SCRUM-1163)

**Medido contra:** `origin/main` = `e264c23476ec7f69a96365f57f3e19dfd4a752c8` · 2026-09-27T16:11:30Z

**Escribe:** Sesión 1 (S1, `s1-27a`) · **Rama:** `scrum-1166-quote-tiene-numero` · **Carril:** S1
(servidor). La parte (b), el botón de `quotesDetailView.js`, es de S2 y va después.

## El defecto

Un cliente con sólo MÓVIL: el botón de WhatsApp del presupuesto salía desactivado («El cliente no
tiene teléfono de WhatsApp configurado»). El envío (`sendQuote.service.ts`) sí resuelve el móvil
con `canalDeWhatsApp`; lo que faltaba era el dato en el detalle: `getQuoteDetailAdmin`
(`src/modules/system/quoteAdmin.ts`) proyectaba del cliente sólo `phone`, y la pantalla hacía
`!!quote.customer.phone`.

## El cambio

`customer.tieneNumeroDeContacto` (booleano) en el detalle, calculado con `tieneNumeroDeContacto` de
`src/core/contacto/canalDeWhatsApp.ts`, la misma función que usa el envío. Se manda el booleano y NO
el móvil: si la pantalla recibiera los números decidiría por su cuenta y el criterio viviría en dos
sitios. Aditivo: `phone` sigue saliendo igual. No se toca `src/integrations/whatsapp.ts`, ni
ningún texto, ni ningún envío.

**Para S2 (parte b):** el campo es `quote.customer.tieneNumeroDeContacto`.

## Controles, corridos

- `tests/scrum1166-detalle-quote-tiene-numero.test.mjs`, contra `getQuoteDetailAdmin` real con el
  delegado `prisma.quote` doblado (patrón de `scrum887c`): sólo móvil → `true` · sólo fijo → `true` ·
  ninguno → `false` · en blanco → `false` · `phone` intacto y `mobile` NO viaja · otro merchant →
  `quote_not_found` y la consulta lleva su `merchantId` (regla 2).
- **Rojo antes:** sobre el código sin tocar, 2 pass / 4 fail — los cuatro casos dicen `undefined`.
  **Verde después:** 6/6.
- La tanda completa local la CORTÓ el sistema por falta de memoria a los 3.870 resultados, y no se
  relanzó: la corre el CI de este PR. Lo que alcanzó a medir dio UN rojo, y era de este ticket:
  `scrum262` (los teléfonos de un fixture tienen que estar en el rango imposible `340…`). Se cambió
  `612…`/`912…` por `34000000001`/`34000000002`; `scrum262` + `scrum1166`: 11/11.
- Los 14 ficheros de test que citan `tieneNumeroDeContacto`, `canalDeWhatsApp`, `quoteAdmin` o
  `getQuoteDetailAdmin`: 147 tests, 145 pass, 0 fail, 2 skipped.

## Fleco medido, NO tocado

El mismo `!!customer.phone` está en `invoiceDetailView.js:375` (pantalla de facturas, J1/J2).
