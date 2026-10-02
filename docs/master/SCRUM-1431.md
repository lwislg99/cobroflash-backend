# SCRUM-1431 · La página pública del presupuesto: el error del rechazo, escapado

**Medido contra:** `origin/main` = `643e9a65a5756b9729c9f8d4b911ea0c536988b3` · 2026-10-02T13:26:18Z

A9: sin fallo que generalice — tramo de una línea de código, con su mutante comprobado

Sesión S1 (`s1-2octc`) · rama `scrum-1431-rechazo-escapado`. Lo vio S4 leyendo; aquí está medido.
Fichero: `src/modules/system/app/routes/quoteDecisionLanding.routes.ts`.

## Lo hecho: el error del rechazo sale escapado

`POST /pay/quote/:token/reject` pintaba `json?.message || json?.error || ''` dentro del HTML sin
`esc()`. Ahora pasa por `esc()`. Ningún texto cambia.

**¿Podía llegar ahí algo que no pusiera nuestro servidor? Hoy no. Leído, no ejecutado.** `json` es
la respuesta de `POST /quote/:token/decision`, y con un rechazo sus errores son literales:
`quote_not_found` (404), el texto de caducado (410), el del límite de intentos (429) e
`internal_error` (500). El único mensaje con contenido de alguien es el del 409, que lleva el nombre
del negocio; no llega porque la línea anterior redirige. Era una sola línea de protección.

### Test — `tests/scrum1431-rechazo-escapado.test.mjs` (4 casos)

El handler de `dist/` con la base y `node-fetch` doblados. El mensaje con marcado se fabrica en el
test: la API no lo produce hoy.

| Mutante (sobre `dist`, comprobado que cambia el fichero) | Resultado (BASE 4/4) |
|---|---|
| sin `esc()`, lo de antes | 2 rojos |

## Lo medido y NO tocado

**1 · El cliente lee el código crudo.** Con 404 y 500 no hay `message` y bajo «No se pudo registrar
el rechazo.» sale `quote_not_found` o `internal_error`. Sustituirlo pide un texto: espera firma
(regla 39). Propuesta en el ticket.

**2 · «IVA incluido» en la tarjeta de cada opción (`:283`), sin condición.** Ejecutado por la ruta
real `GET /pay/quote/:token`, sin exportar nada:

| Líneas de la opción | Total de la tarjeta | Nota | ¿Cierto? |
|---|---|---|---|
| 100 € al 21 % | 121,00 € | «IVA incluido» | sí |
| 100 € con `tax` 0 | 100,00 € | «IVA incluido» | no |

`tier.total` es `calcTotal(tier.lines)`: lleva el IVA sólo si las líneas lo llevan. Es el defecto de
SCRUM-212, vivo en la tarjeta. Espera el GO: es texto visible donde el cliente firma.

**3 · En la misma tarjeta, la línea va sin impuesto y el total con él** (`:279`): «100,00 €» encima
de «121,00 €». Las líneas no suman su total. Sin tocar.

## Lo que NO está hecho

- **No visto en yaqu.app.**
- Las aceptaciones 2 y 3 del ticket.
