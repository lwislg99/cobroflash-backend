# El arranque de la serie cuando no hay respuesta · SCRUM-1200

**Aprobado por el orquestador por delegación del fundador** el 28-sep-2026 — SCRUM-1200 comentario 17418.

La delegación está en `docs/equipo/limites-del-fundador.md` §«Delegación permanente», línea
«Javier, 25-sep-2026» (referencia SCRUM-1121).

## Texto aprobado, literal

| Ranura | Texto aprobado |
|---|---|
| `serie.errorSinRespuesta` | No hemos podido confirmar si se ha guardado. Comprueba tu conexión y pulsa otra vez: si ya estaba guardado, se queda igual. |

## Dónde y cuándo se pinta

`public/dashboard/js/puertaSerie.js`, `SERIE_TEXTOS.errorSinRespuesta`, devuelto por `textoErrorSerie`
cuando falla el `POST /admin/onboarding/serie` **sin respuesta**:

- `err.sinRed`: el `fetch` rechazó;
- `err.incierto`: la mutación venció el plazo y pudo guardarse (SCRUM-459).

Se ve en los dos sitios que declaran el arranque: el paso 2 del alta (`onboardingView.js`) y la
puerta D1 de Ajustes (`renderPuertaSerie`). Sustituye al mensaje crudo que salía hasta ahora: «Failed
to fetch», en inglés y distinto según el navegador, o la cadena interna de `api.js`.

Un rechazo **con** respuesta (400 con código, 409 con su texto) sigue saliendo con su propio texto:
esta ranura sólo cubre la falta de respuesta.

## Por qué no afirma nada y manda a pulsar otra vez

Sin respuesta, no se puede saber si el arranque quedó guardado: decir «no se ha guardado» sería
afirmar lo que no sabemos (el mismo criterio que SCRUM-1239). «Pulsa otra vez» es inofensivo porque
el 409 de ese endpoint depende de las facturas **ya emitidas** (`src/app.ts`, `POST
/admin/onboarding/serie`), no de una declaración anterior. En el alta no hay ninguna, y en Ajustes
la segunda pulsación choca con el mismo guard. En los dos casos, «se queda igual» es cierto.

⚠️ Depende de que `api.js` siga marcando `sinRed` e `incierto`. Si esa distinción se pierde, el
texto vuelve a firma.
