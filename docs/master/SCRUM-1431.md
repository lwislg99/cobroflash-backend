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

## Lo hecho (2): la tarjeta de opción ya no afirma «IVA incluido» sin cuota

Medido ANTES de tocar, por la ruta real `GET /pay/quote/:token` y sin exportar nada:

| Líneas de la opción | Total de la tarjeta | Nota | ¿Cierto? |
|---|---|---|---|
| 100 € al 21 % | 121,00 € | «IVA incluido» | sí |
| 100 € con `tax` 0 | 100,00 € | «IVA incluido» | no |

`tier.total` es `calcTotal(tier.lines)`: lleva el IVA sólo si las líneas lo llevan.

**De dónde sale cada fila, dicho porque lo preguntó S2:** el 21 % lo puse YO en la línea de la
sonda; no lo produce ninguna pantalla. El único sitio que crea opciones es el presupuesto rápido
(`public/dashboard/js/homeView.js:1354`), que manda siempre `tax: 0`, y el servidor no lo cambia
(`quotes.routes.ts:134` copia la opción y sólo le calcula el total). Así que la fila que HOY ve un
cliente es la segunda: con las opciones que crea el panel, «IVA incluido» era falso siempre. La
primera sólo se alcanza por la API o por una plantilla guardada con opciones que lleven impuesto.

**El criterio es el de SCRUM-212, no uno nuevo:** «de `cuota === 0` no se deduce nada». Allí el rótulo
grande pasó a depender de `calcVatBreakdown(lines).cuota > 0` (`hasVat`). Aquí la tarjeta usa la MISMA
función y la MISMA comparación, sobre las líneas de su opción. Sin cuota no se pinta la nota; con cuota
sale igual que antes. No hay texto nuevo: se retira uno falso.

**De quién es el GO:** del orquestador, por mensaje entre sesiones el 2-oct-2026, aplicando el
criterio que el fundador firmó en SCRUM-212. No es una firma nueva del fundador.

### Test — `tests/scrum1431-tarjeta-sin-claim-de-iva.test.mjs` (3 casos)

| Mutante (sobre `dist`, comprobado que cambia el fichero) | Resultado (BASE 3/3) |
|---|---|
| siempre lo dice (lo de antes) | 2 rojos |
| nunca lo dice (arreglarlo borrando el texto) | 2 rojos |

Corridos también `scrum212`, `scrum656`, `scrum1001` y `scrum1276`: verdes.

## Lo medido y NO tocado

**1 · El cliente lee el código crudo.** Con 404 y 500 no hay `message` y bajo «No se pudo registrar
el rechazo.» sale `quote_not_found` o `internal_error`. Sustituirlo pide un texto: espera firma
(regla 39). Propuesta en el ticket.

**2 · En la tarjeta, la línea va sin impuesto y el total con él** (`:279`): «100,00 €» encima de
«121,00 €». Las líneas no suman su total. Tiene ticket propio, PARADO: SCRUM-1433. Sólo ocurre con líneas con
impuesto, que el panel hoy no produce en las opciones.

## Lo que NO está hecho

- **No visto en yaqu.app.**
- La aceptación 3 del ticket (el código crudo).
