# SCRUM-346 (A0.5) · El JUSTIFICANTE suelto: no faltaba camino, faltaba permiso

**Fecha:** 6-ago-2026 · **Carril:** A (facturación) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `16cb63fdc5c7c5461449ca0e0482b53a26f530ec` · 2026-08-06T19:30:00+02:00
**Tanda:** 2055 tests, 1987 pass, 0 fail, 68 gateados a staging

## PASO 0 — y corrige el enunciado en lo esencial

El ticket decía «hoy no tiene puerta». **Era falso.** `facturaSuelta.ts` no es una mención
cruzada: es **el mecanismo entero de A0.3**, y su propia cabecera lo dejó escrito —

> «SCRUM-346 está enlazado como bloqueado por éste y **REUTILIZARÁ ESTA MISMA RUTA**. Cuando 346
> entre, lo que cambia es el **rótulo** y el **`type`**, no el entrypoint.»

| Qué | Resultado |
|---|---|
| ¿Rama con el 346? | ninguna |
| ¿Entrada de máster? | no existía |
| ¿Mecanismo? | **SÍ, entero**: gate + validación pura + `POST /admin/invoices` + veredicto en `/admin/me` + 2 consumidores en el front + 12 tests |

**La puerta existía y estaba deliberadamente cerrada para `receipt`** — o sea, para el profesional
español real. **No faltaba camino: faltaba permiso**, y son cosas distintas.

## El defecto: dos cosas opuestas contadas como una

`puedeCrearFacturaSuelta` devolvía `false` para `receipt`, y eso aplanaba:

- «**no puedes emitir nada**» (no hay merchant → fallo cerrado), y
- «**tú emites JUSTIFICANTES**», que es el caso del 80 % de la semana de un fontanero.

Aplanados, el segundo se lee como una carencia y la avería de 40 € del martes se queda sin puerta.
Es la misma familia que `adicionalFallido` contra `adicional: null` en A0.4.

**Ahora son TRES valores**: `'factura' | 'justificante' | 'no'`.

## Regla 38 — el límite no se cruza, y esta vez ni se acerca

**El `type` no hubo ni que tocarlo**: `emitInvoice` ya fuerza `JUST` cuando la serie sale `J-`
(`invoicing.service.ts:52`). Comprobado en el diff: **cero cambios** en `invoicing.service.ts`,
`invoiceNumber.service.ts` y `prisma/`.

## El cinturón se RAMIFICA, no se afloja

A0.3 rechazaba cualquier `J-` que saliera de la serie, y tenía razón: el botón prometía FACTURA y
el documento no era eso. **En el camino de justificante ese `J-` es exactamente lo correcto**, así
que la comprobación sigue existiendo pero solo para `modoSuelto === 'factura'`. Quitarla habría
dejado sin red el caso en que el modo falle; dejarla como estaba rompía el caso que este ticket
abre. Hay guard que exige las dos cosas.

## 🔴 EL GUARD DE MICROCOPY DE A0.3 SE QUEDÓ CIEGO CON MI PROPIO CAMBIO

Al hacer que el rótulo dependa del veredicto —un **ternario**— el guard de A0.3 pasó **en verde**.
No porque el texto estuviera aprobado: porque **dejó de ver nada**. Medido: con un literal plano
saltaba; con el ternario, no. Y lo peor no es que colara mi rótulo firmado, es que **también
habría dejado meter texto inventado en la rama del marcador**.

> Un guard que se queda ciego ante otra forma de escribir el mismo código es un verde hueco: nadie
> lo desactivó, simplemente dejó de mirar.

Arreglado: `textosDe` recorre **las dos ramas** del ternario, con su propio suelo
(`b.textContent = x ? 'uno' : 'dos'` tiene que devolver los dos). Y el rótulo aprobado va en un
**allowlist con procedencia** —quién lo aprobó y cuándo—, no colado por invisible.

## Microcopy

**`+ Nuevo justificante`** — APROBADO por el fundador el 6-ago-2026. Es el único firmado: el
rótulo del camino de factura sigue con su marcador desde A0.3, y que sean distintos no es una
asimetría sino que solo uno está firmado.

### ⚠️ REGLA 26 — lo que NO se ha escrito, ni como marcador

**No hay ni un texto que explique por qué sale un justificante y no una factura.** Ni aviso, ni
tooltip, ni nota al pie. Esa pregunta se responde SOLO con el guion H2, y un texto que explica mal
una obligación fiscal no es feo: es peligroso.

**El diseño no lo pide hoy** —el botón dice lo que crea y con eso basta—, así que no queda ningún
`[PENDIENTE]` pendiente por este motivo. Si en algún momento se decide acompañarlo de una
explicación, **es cambio de máster y guion H2**, no microcopy normal.

## Verificado en rojo

| # | Qué se rompe | Qué cae |
|---|---|---|
| 1 | Texto inventado escondido **en la rama del ternario** | 🔴 el guard de microcopy, que antes era ciego |
| 2 | Se cambia el rótulo **aprobado** por otro | 🔴 el allowlist con procedencia |
| 3 | El guard solo mira una rama del ternario | 🔴 el suelo nuevo |
| 4 | `receipt` devolviera `'factura'` | 🔴 el test de la regla 24 |
| 5 | El `J-` se sigue rechazando en el camino de justificante | 🔴 «rompe el caso que A0.5 viene a abrir» |

## Los controles

- **Positivo**: el profesional ES real emite su justificante — 40 € + 21 % = 48,40 €.
- **Positivo de NO-REGRESIÓN**: en modo factura se sigue emitiendo **F1**, como antes. El veredicto
  pasó de dos valores a tres y ésa es justo la clase de cambio que rompe lo que ya funcionaba sin
  que nadie mire.
- **Negativo**: sin cliente → 400 y **cero emisión**; cliente de otro merchant → 404 (regla 2).
- **Suelo**: sin líneas, o con una línea sin concepto, **no se emite «lo que tenga»**. Un documento
  fiscal emitido no se borra (regla 29).
- **Fixture**: merchant `id: 7`, nunca `id: 1` — `isDemoMerchant` habría puesto todos los casos en
  modo demo y la puerta de la regla 24 no se habría ejercitado en ninguno (mordió en A0.4).

## Regla 24, intacta

Esto **no enciende `INVOICING_ES_ENABLED`**. El mismo merchant que antes no tenía botón ahora tiene
el de **justificante**, y sigue sin poder emitir facturas. Hay test que lo fija por los dos lados.

Ficheros: `src/modules/invoicing/domain/facturaSuelta.ts` (el veredicto de tres valores) ·
`src/modules/system/app/routes/invoicesAdmin.routes.ts` (gate + cinturón ramificado) ·
`src/app.ts` (`documentoSuelto` sustituye a `facturaSueltaDisponible`) ·
`public/dashboard/js/app.js` · `public/dashboard/js/invoicesView.js` (el rótulo por veredicto) ·
`tests/scrum346-justificante-suelto.test.mjs` (10, nuevo) ·
`tests/scrum289b-factura-suelta.test.mjs` (12 → 15: veredicto, cinturón y el ternario).
