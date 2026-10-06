# La página pública del presupuesto: el rechazo que no se pudo registrar por un fallo nuestro

**Aprobado por el orquestador por delegación del fundador** el 6-oct-2026 — SCRUM-1431 comentario 18332.

La delegación de microcopy es la permanente de `docs/equipo/limites-del-fundador.md`. El comentario
18332 es la TRANSCRIPCIÓN, hecha por la Sesión 1, de la decisión que el orquestador le mandó en su
encargo del 6-oct (opción 2 de las tres del comentario 18291). El orquestador no la escribió en Jira
de su mano; si no la reconoce, esta ficha deja de valer.

## Texto aprobado, literal

> Inténtalo más tarde.

## Dónde se pinta

`src/modules/system/app/routes/quoteDecisionLanding.routes.ts`, `CONSEJO_DE_REINTENTAR`. Un solo
literal para dos sitios de la misma página, la del rechazo (`POST /pay/quote/:token/reject`):

- **Sitio nuevo (6-oct-2026):** bajo el titular «No se pudo registrar el rechazo.», cuando la API de
  decisión contesta un 5xx sin mensaje propio.
- **Donde ya estaba:** detrás de «Error inesperado.», cuando la API no contesta.

## Qué cambió y por qué

Hasta el 6-oct, bajo el titular salía el código de la API tal cual: `quote_not_found` con un 404 e
`internal_error` con un 500. Lo lee el cliente final.

El código deja de pintarse. Con un 404 el titular se queda solo: reintentar sobre un presupuesto que
no existe no funciona nunca, y un consejo de reintentar ahí sería falso (SCRUM-1431 comentario 18286).
Con un 5xx sale este texto, que es el que la misma página ya daba para el mismo hecho visto un paso
antes. Los errores que traen su propio mensaje (caducado, demasiados intentos) no cambian.

## Lo que no cubre

- El literal no constaba firmado en ningún registro antes de esta ficha: estaba en pantalla desde
  antes de que existiera el directorio. Esta ficha firma el literal y su uso en la página del rechazo.
- El mismo texto dentro de `src/modules/jobs/app/routes/albaranPublic.routes.ts` (la firma del
  albarán) es otro literal, de otra página, y no se ha tocado.
- «No se pudo registrar el rechazo.» y «Error inesperado.» no se firman aquí: ya estaban y no cambian.
