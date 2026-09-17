# SCRUM-907 · Trabajo: cobrar MÁS de lo aceptado decía «Te falta por cobrar 0,00 €» y no avisaba

**Medido contra:** `origin/main` = `2be8fe16a3245322e64837f789189875e0c9f560` · 2026-09-17T14:39:14Z
**Rama:** `scrum-907-cobrado-de-mas` · **Estado:** EN PR — literal firmado por delegación (SCRUM-887 comentario 15697, L4).

Nace de SCRUM-887 (su PR 4) y del D2 de SCRUM-883. Carril front (Sesión 2).

## Qué pasaba

`jobCobroHuecos.js` (`faltaPorCobrar = Math.max(0, aceptado − cobrado)`) y `jobRailBlocks.js` («Pendiente», con el
mismo `max`) escondían el exceso: con C3 de SCRUM-883, «Cobrado 628,60 € de 539,05 €» y «Te falta por cobrar 0,00 €»,
sin aviso. Y con todo facturado y pagado la sección «Qué falta para cobrar» ni se pinta (no hay huecos).

## Arreglo (solo front, sin emisión ni dinero)

- `cobradoDeMas(aceptado, cobrado)` en CÉNTIMOS enteros: exceso si pasa de 2 céntimos (margen de SCRUM-141); sin
  importe aceptado, 0 (regla de «Pendiente», SCRUM-363). Viaja en `importesDeCobro`.
- `avisoCobradoDeMas(importe)`, el literal firmado, en un solo sitio.
- «Qué falta para cobrar»: la sección también se pinta con cobro de más; el aviso va bajo «Te falta por cobrar»
  (que sigue en 0,00 €, que es verdad). Rail «Dinero»: una línea de aviso detrás de «Pendiente». Las dos piezas leen
  el MISMO exceso. Estilo por clase (`.cobro-aviso`, `.detail-rail-linea--aviso`), ámbar de Aviso.

## Rojo, positivo y negativo

`tests/scrum907-cobrado-de-mas.test.mjs` (el cálculo es puro y se ejecuta; el render, por su cableado):

- **Rojo contra `2be8fe16`** (commit `4e82b942`): 7 de 7.
- **Con el arreglo:** 7 de 7, y siguen verdes `scrum318/319/320`.
- Rojo: 628,60 sobre 539,05 → 89,55 €; 3 céntimos avisan. Negativo: 1 y 2 céntimos no avisan, y 0,1 + 0,2 sobre 0,3
  tampoco. Positivo: cobrado ≤ aceptado → sin aviso y los importes de siempre; sin aceptado, sin aviso.
