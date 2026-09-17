# SCRUM-888 · las condiciones de pago en la página de firma, con su importe

**Aprobado por el orquestador por delegación del fundador** el 16-sep-2026 — SCRUM-888 comentario 15624.

La delegación es la permanente de `docs/equipo/limites-del-fundador.md`, sección «Delegación
permanente», línea de microcopy. Esta ficha **no** lleva la firma del fundador.

## Formato aprobado, literal

> {nombre del tramo}: {importe} · {nombre del tramo}: {importe}

Lo único nuestro son los dos separadores: `: ` entre nombre e importe y ` · ` entre tramos. Los
nombres **no** se redactan aquí:

* **plan propio** — los que escribió el profesional en su plan, tal cual;
* **planes de serie** — los textos que la píldora ya decía, partidos por tramo:

> 50% al aceptar

> 50% al finalizar

> Pago completo al aceptar

Ejemplos, tal cual se pintan:

* plan propio 30/70 → «Señal: 291,07 € · Resto al terminar: 679,16 €»
* `FIFTY_FIFTY` → «50% al aceptar: 485,12 € · 50% al finalizar: 485,11 €»
* `FULL_UPFRONT` → «Pago completo al aceptar: 970,23 €»
* **con opciones a elegir (tiers)**, porcentaje en lugar de importe → «Señal: 30% · Resto al terminar: 70%»

Sin plan que pintar —sin condiciones, o `MANUAL`/`SIN_CONDICIONES` sin plan propio— **no hay
píldora**.

## Dónde se pinta

`src/modules/system/app/routes/quoteDecisionLanding.routes.ts`, función `condicionesDePago`, en la
píldora `.terms-badge` de `/pay/quote/:token`. Los importes y los tramos salen de
`buildBillingPlanView`; la página no calcula ninguno.

## Qué sustituye

`termsLabel`, que pintaba «50% al aceptar · 50% al finalizar», «Pago completo al aceptar» y, para
cualquier otro código, **el código tal cual** («MANUAL»). La política «🔒 La señal no es
reembolsable.» no cambia: sigue saliendo sólo con `FIFTY_FIFTY`.
