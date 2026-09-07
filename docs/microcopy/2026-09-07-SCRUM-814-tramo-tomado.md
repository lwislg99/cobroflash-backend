# El aviso de cuando otra petición ya emitió ese tramo

**Aprobado por el fundador** el 7-sep-2026, en **SCRUM-814**.
**Aplicado en el mismo acto** (regla 30).

## Texto aprobado, literal

> Se acaba de emitir otra factura de este presupuesto. Vuelve a intentarlo y saldrá el tramo siguiente.

## Dónde se pinta

El cuerpo del **409 `stage_taken_concurrently`**, en los dos endpoints que emiten un tramo a
petición del profesional:

- `POST /admin/quotes/:id/invoice` — facturar un presupuesto por tramos (`quotesAdmin.routes.ts`)
- `POST /admin/jobs/:id/collect-rest` — «cobrar el resto» de un trabajo (`jobs.routes.ts`)

Sale de **una sola constante**, `COPY_TRAMO_TOMADO` en
`src/modules/invoicing/domain/tramoSinCarrera.ts`. Dos textos para el mismo hecho acabarían
diciendo cosas distintas.

## Dónde NO se pinta, y es deliberado

En `POST /quote/:token/decision` — la aceptación del presupuesto por el **cliente final** desde
WhatsApp — **no se enseña este texto ni ningún otro**. Esa ruta no es «emitir factura»: es la
aceptación, y la aceptación ha salido bien. Si el cliente pulsó dos veces con mala cobertura —el
caso normal ahí, no el raro— su factura EXISTE, la emitió su gemela. Enseñarle un aviso, o marcar
«factura pendiente», sería una llamada de soporte por algo que no ha pasado.

## Por qué este texto

- **Dice qué pasó** sin jerga: «se acaba de emitir otra factura de este presupuesto».
- **No culpa a nadie.** Puede haber sido el propio usuario pulsando dos veces, y el texto no se lo
  echa en cara ni lo insinúa.
- **Dice qué hacer**, y qué esperar al hacerlo: «vuelve a intentarlo y saldrá el tramo siguiente».
  No es «reinténtalo» a secas, que deja al profesional sin saber si repetirá la misma factura.

## Qué cambió

**Ni una letra.** Se propuso con marcador de pendiente en la primera entrega de SCRUM-814 y se
firmó sin cambios. Lo único que se retira es su condición de no aprobada: el texto ya está en la
voz de la casa.

## Nota de censo

Este texto es una de las entradas «a pelo» del censo de SCRUM-601 (`aPelo` 151 → 152, movido en el
mismo commit que lo introdujo y con su motivo escrito). No deriva del flag ni del tipo de
documento, y no tiene por qué: no habla de facturas ni de justificantes, habla de una carrera.
