# Borradores de modelos — la marca «Borrador para tu asesor» · SCRUM-1065

**Aprobado por el fundador** el 24-oct-2026, en **SCRUM-1065** (comentarios 20813 y 20820).

La firma no me llegó a mí: el fundador contestó un cuestionario en el chat del orquestador del equipo
de Javier, y el orquestador la transcribió en esos comentarios. El literal es el de **SCRUM-1064
c.20780 (T2)**, y c.20813 lo da como marca de los borradores. J1 (`jv-j1bv`) lo leyó en Jira por la
API el 24-oct-2026 y lo copió de allí, no de un mensaje.

## Texto aprobado, literal

> Borrador para tu asesor

## Dónde se pinta

Constante `AVISO_ORIENTATIVO` en `src/modules/fiscal/modelo303/modelo303.ts`. Viaja en el campo
`avisoObligatorio` del resultado de los seis borradores, que la importan:

- el 303 (`modelo303.ts`), en `GET /admin/modelo-303`;
- el 130 (`modelo130/modelo130.ts`), el 347 (`modelo347/modelo347.ts`) y el 390
  (`modelo390/modelo390.ts`) — c.20813;
- el 111 y el 115 (`retenciones/retencionesPracticadas.ts`, SCRUM-1066c) — c.20820.

Hoy ninguno tiene pantalla propia: el texto sale en el JSON. La pantalla del 303 la construye S2
(SCRUM-1064), y allí la marca sustituye al `avisoObligatorio` (c.20780, T21).

## Qué cambió y por qué

Sustituye al aviso pendiente de firma que la constante llevaba desde SCRUM-295 (el texto viejo está en
el historial de `modelo303.ts`; no se copia aquí para que nadie lo lea como aprobado).

La firma de c.20813 nombraba el 303, 130, 347 y 390; el 111/115 usa la misma constante, y c.20820 lo
añadió. Con eso, `modelo303.ts` sale del censo de marcadores de `src/`
(`scripts/_marcadores-pendientes-declarados.json`). Lo fija `tests/scrum1065c-marca-borrador.test.mjs`.

## Queda sin firmar

En los mismos resultados, los avisos de `motivosParaNoFiarse` del 303: pasan antes por el asesor
(SCRUM-1064 c.20780, T20, y SCRUM-1264). No se han tocado.
