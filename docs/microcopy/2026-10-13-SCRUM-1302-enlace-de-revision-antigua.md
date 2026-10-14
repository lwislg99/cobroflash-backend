# La página del enlace de una revisión antigua

**Aprobado por el orquestador por delegación del fundador** el 13-oct-2026 — SCRUM-1302 comentario 19454.

La delegación de microcopy es la permanente de `docs/equipo/limites-del-fundador.md`. La firma llevaba
una condición (que el panel avisara al profesional antes de crear la revisión) y quedó aplicable con
la firma del aviso del panel, en SCRUM-1302 comentario 19475, que tiene su propia ficha del mismo día.
Las dos mitades entran en el mismo PR.

## Texto aprobado, literal

T1 · el título de la página (la pestaña). `{Presupuesto}` es la palabra del país:

> {Presupuesto} actualizado

T2 · en negrita:

> Este {presupuesto} tiene una versión más reciente.

T3 · debajo, con la enmienda del orquestador a la primera frase. `{negocio}` es el nombre fiscal, o el
comercial, o «el profesional», como en la página del rechazo:

> La que estás viendo ya no se puede aceptar. Abre el enlace de la versión nueva que te haya enviado {negocio}, o pídesela.

## Dónde se pinta

- `src/modules/system/app/routes/quoteDecisionLanding.routes.ts`, `paginaDeVersionAntigua`, desde el
  `GET /pay/quote/:token` (y su alias `/accept`).
- T1 y T2, una frase entera por país en `src/core/i18n/locales.ts` (`quoteUpdatedTitle`,
  `quoteHasNewer`), como los títulos de SCRUM-1476.
- La pregunta «¿tiene una versión más reciente?», en `src/modules/quotes/domain/versionMasReciente.ts`.
- T3, desde SCRUM-1302r, en el mismo fichero (`fraseDeLaVersionAntigua`): lo dicen la página y el `message` del `POST`.

## La conducta firmada con ellos (los siete puntos de c.19451)

1. Sale si el presupuesto del enlace está en `draft`, `sent` o `expired` y en su grupo (negocio,
   número, año de la serie) hay otra fila con `revision` mayor, en el estado que sea. El enlace muere
   al CREAR la revisión. `expired` entra por c.19636: sin él, el punto 5 sólo valía para las vencidas
   que el cron aún no había barrido.
2. Sólo el aviso: ni detalle, ni importes, ni firma, ni «Rechazar», ni PDF.
3. Sin botón y sin emoji que señale a nada.
4. No enlaza a la versión nueva.
5. Va antes que el aviso de caducado.
6. Una versión ya aceptada o rechazada no cambia: sigue su página de siempre.
7. `GET /pay/quote/:token/reject` de una versión antigua lleva a esta página.

Lo sujeta `tests/scrum1302p-la-pagina-de-una-revision-antigua.test.mjs`.

## Qué cambió

Antes, con una versión más reciente en el grupo, el enlace de la anterior pintaba el formulario de
firma con el total viejo (medido el 13-oct-2026: `docs/master/evidencias/SCRUM-1302/revision-vieja/`).

## La concordancia en femenino (firmada en c.19636)

En los países de «cotización» (México, Colombia, Perú y Chile) T1 es «Cotización actualizada» y T2
«Esta cotización tiene una versión más reciente.». T3 no cambia: concuerda con «versión».

## Lo que queda sin firmar en esta página

- Rechazar en el servidor la decisión sobre una versión no vigente (`POST /quote/:token/decision`):
  hecho en SCRUM-1302r (S1), 409 con `message` = T2 y T3 seguidos, lo firmado en c.19454 punto 6 y c.19636 punto 3.
