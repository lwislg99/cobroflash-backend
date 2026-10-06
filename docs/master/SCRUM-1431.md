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

### Corrección del 2-oct (sesión `s1-2octd`): el CI salió ROJO, `# fail 4`, en la punta `1e2bb528`

| Rojo | Causa medida | Arreglo |
|---|---|---|
| Los tres de SCRUM-264 «landing de presupuesto · RECHAZAR» | Su guard extrae lo que hay dentro del `${}` y lo EJECUTA con `json` como única variable. Con `esc(…)` dentro, la expresión extraída daba `esc is not defined`. La conducta no había cambiado: mensaje → código → vacío seguía igual | El escapado sale del `${}`: lo pone una etiqueta de plantilla (`escapandoLoInterpolado`). La expresión queda como la dejó SCRUM-264. El test de 264 no se toca |
| SCRUM-553, trinquete (22 con tope 20) | Mi test buscaba `<b>` e `<i>` con el `>` pegado | El test busca con hueco para atributos. El tope no se toca |

Nunca se quitó el código crudo de la vista: sigue en «Lo medido y NO tocado», punto 1.

Corridos tras traer `main` (`6fb53c1a`): `scrum264`, `scrum275`, `scrum553`, `scrum567`, `scrum237`,
`scrum1344`, `scrum1415`, `scrum212`, `scrum656`, `scrum1001`, `scrum1276` y los dos de 1431: 121/121.
Mutante sobre `dist` (quitar la etiqueta; comprobado que cambia el fichero): 2 rojos en 1431.

**Error propio de la tanda anterior:** se empujó sin correr `scrum264`, que nombra esta misma línea.

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

---

## SCRUM-1431b (6-oct) · el cliente ya no lee el código crudo

**Medido contra:** `origin/main` = `3746d0351af6b56c88f6a53fce695eef51913d4f` · 2026-10-06T12:01:47Z

A9: comprobación → `tests/scrum553-etiquetas-pegadas.test.mjs`

Sesión S1 (`s1-6octc`) · rama `scrum-1431b-sin-codigo-crudo`. Es la aceptación 3, la que el tramo de
arriba dejó en «Lo medido y NO tocado», punto 1.

### De quién es la decisión

Del orquestador, por la delegación permanente de microcopy. Dos pasos:

- **c.18286 (6-oct):** se quita el código crudo y el 404 se queda sin texto, porque «inténtalo en unos
  minutos» sobre un presupuesto que no existe es un consejo falso. Puso una condición: si el 404 y el
  500 ya se podían distinguir, decirlo antes de borrar.
- **c.18291 (S1):** sí se distinguen, `apiResponse.status` ya estaba ahí y la línea del 409 lo usaba.
  Tres opciones.
- **Opción 2**, en el encargo del orquestador a S1 del 6-oct: el 500 reutiliza «Inténtalo más tarde.»,
  el literal que la misma página ya daba cuando la API no contesta. **No lo escribió en Jira de su
  mano: lo transcribí yo en el c.18332**, dicho así en el comentario y en la ficha.

### Lo que pinta la página del rechazo bajo «No se pudo registrar el rechazo.»

| Lo que contesta la API de decisión | Antes | Ahora |
|---|---|---|
| con `message` (410 caducado, 429 demasiados intentos) | el mensaje | igual |
| 404, sin `message` | `quote_not_found` | nada: el titular solo |
| 5xx, sin `message` | `internal_error` (o nada si no era JSON) | «Inténtalo más tarde.» |
| la API no contesta (el `catch`) | «Error inesperado. Inténtalo más tarde.» | igual |

**Dos lecturas mías, no del orquestador, escritas también en el c.18332:** «el 500» está construido
como «cualquier 5xx» (un 502 o un 503 de la pasarela es el mismo hecho); y un 5xx que SÍ traiga
mensaje pinta su mensaje, sin el consejo detrás.

**Un literal, no dos.** `CONSEJO_DE_REINTENTAR` es una constante y la usan los dos sitios. La línea del
`catch` cambia de forma (interpola la constante) y no de texto.

**Qué errores puede dar la API a un rechazo — leído en `quotes.routes.ts`, no ejecutado contra la
API:** 404 y 500 sin `message`; 410 y 429 con él; 409 redirige antes. El 400 `invalid_decision` no se
alcanza desde esta página, que manda siempre `reject`.

### Los tests cambian lo que AFIRMAN, y llevan las dos fechas dentro

| Test | 1.ª fecha: lo que afirmaba | 2.ª fecha: lo que afirma |
|---|---|---|
| `tests/scrum264-copy-que-llega-al-cliente.test.mjs`, fila RECHAZAR, «sin copy» | 3-ago-2026: el código NO se pierde | 6-oct-2026: el código NO se pinta |
| `tests/scrum1431-rechazo-escapado.test.mjs`, caso del `error` | 2-oct-2026: sale escapado | 6-oct-2026: no se pinta, ni escapado |

El montaje de `scrum264` no se toca: sigue extrayendo el primer `${}` y ejecutándolo con `json` como
única variable. Por eso el consejo va en un `${}` aparte y no dentro del primero. Las otras tres
superficies de esa tabla siguen afirmando lo del 3-ago.

En `scrum1431-rechazo-escapado` son 8 casos (eran 4). El de «no es JSON» se llamaba «…: titular solo»:
era un 502, que ahora lleva el consejo, así que cambia de nombre y gana una comprobación.

### Corrido

En rojo ANTES de tocar `src/` (BUILD verde, `dist` del código viejo): 25 casos en los dos ficheros,
5 rojos — los 4 nuevos de 1431 que describen el cambio y el de `scrum264`.

Después, 28 ficheros, **285 de 285**: los dos de arriba, los que nombran la página (`scrum1276`,
`scrum1001`, `scrum212`, `scrum1444`, `scrum1325b`, `scrum633`, `scrum888d`, `scrum888g`,
`scrum656`, `scrum656b`), los de casa (`scrum1344`, `scrum1415`, `scrum553`, `scrum237`, `scrum275`,
`scrum850`, `scrum850b`, `scrum1294`, `scrum1452`) y los de microcopy (`scrum514`, `scrum715`,
`scrum726`, `scrum861`, `scrum1306`). **No corrida la tanda entera.**

| Mutante (sobre `dist`; BASE 25/25; comprobado que el fichero cambia y que se restaura idéntico) | Rojos |
|---|---|
| vuelve el código crudo | 4 |
| el consejo sale siempre, también en el 404 | 1 |
| el consejo no sale nunca | 2 |
| el consejo se pega detrás del mensaje | 1 |
| el fallo de red dice otra frase | 1 |
| sin escapado (el del 2-oct) | 1 (eran 2: el `error` ya no se pinta) |

### Error propio de la tanda

Mi primer test nuevo subió el trinquete de SCRUM-553 de 20 a 22: una expresión con `<br\/>` y un
`includes('<strong>…')`, las dos con el `>` pegado. Es el mismo tropiezo que este registro ya contaba
arriba, del 2-oct. Lo cazó el guard en local, antes de empujar, que es lo que dice la línea `A9`.

### yaqu.app

**Línea base, medida el 6-oct a las 12:00Z** con la versión `f70625d8a009bdab1f672f4eb6fffb34e70bf2f2`
desplegada: `POST https://yaqu.app/pay/quote/<32 efes>/reject` (un token que no existe; no crea ni
cambia nada) → 400, y en la caja de error «No se pudo registrar el rechazo.» seguido de
`quote_not_found`.

**Después del despliegue: NO VISTO al escribir esto.** El 404 se puede mirar con esa misma orden. El
5xx no se puede provocar desde fuera: sólo lo cubre el test.
