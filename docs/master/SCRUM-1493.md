# SCRUM-1493 · La propuesta del dictado no se borra por ningún camino (S4)

**Medido contra:** `origin/main` = `720c1a122ffc796371004a92f6ab143b5f79d4d3` · 2026-10-07T06:28:15Z
A9: sin fallo que generalice — los dos caminos se vieron en rojo en el test y en el navegador antes del arreglo, y los controles van dentro de los dos

Carril S4 (`public/dashboard/js/parteDetailView.js`) · rama `scrum-1493-la-propuesta-no-se-borra-por-ningun-camino`.

**Skill UI:** cargada (`yaqu-premium-ui`) en esta sesión. Dicho como fue: la cargué DESPUÉS de escribir el cambio y antes de commitearlo, no antes de editar. Sin marcado, clases, tokens ni estilos nuevos: el aviso reutiliza la caja `alert error` y el sitio que ya puso SCRUM-1302 (C).

## El defecto

SCRUM-1302 (C) protegió la propuesta cuando la ruta del dictado NO contesta. Quedaban dos caminos, medidos en yaqu.app el 6-oct (descripción del ticket) y otra vez el 7-oct con el JS de producción (build `33f07c33`), por los que una propuesta con una descripción corregida a mano se perdía igual:

1. **Se vuelve a pulsar «Ordenar en líneas» y la ruta contesta 200 sin líneas.** Es lo que hace a propósito cuando la IA falla. No es un fallo de la petición, así que no pasaba por el `catch` que protege, y la propuesta vacía se pintaba encima.
2. **Se pulsa «Añadir al parte» y el guardado falla.** `confirmarLoDictado` escribía el aviso DENTRO del hueco de la propuesta: se llevaba las líneas, la corrección y el botón, y decía «vuelve a intentarlo» sin dejar con qué.

## De dónde sale el sí

El sí a construir los dos llegó en el encargo de la tanda (mensaje del orquestador a la sesión, 6-oct y repetido el 7-oct), no en un comentario de Jira; así lo dejé escrito en SCRUM-1493 comentario 18544. Lo que decía: ningún camino borra trabajo escrito a mano sin decirlo, y sin texto nuevo si los literales ya firmados cubren cada caso.

**Ningún texto nuevo.** El camino 2 usa «No se han podido guardar las líneas — vuelve a intentarlo» (firmado el 3-sep, SCRUM-704, `TEXTOS.noSeGuardo`). El camino 1 pinta lo que manda el servidor por su motivo (`AVISOS_DEL_DICTADO`), sin que la vista elija.

## Lo construido

- `avisarEnElDictado(contenedor, marca, texto)`: un aviso en el sitio que ya existía bajo el botón de ordenar (`[data-dictado-aviso]`), fuera del hueco de la propuesta, con `role="alert"` y traído a la vista. Sustituye a `avisarDictadoNoOrdenado`. **En ese sitio hay uno, el del último intento:** antes de colgar se vacía.
- `confirmarLoDictado`: si el guardado falla, el aviso va a ese sitio y el hueco no se toca. El segundo toque es el mismo botón, que ya tiene su escucha.
- `ordenarElDictado`: si la ruta contesta una propuesta vacía y hay una propuesta en pantalla (`[data-propuesta-confirmar]` dentro del hueco), no se pinta nada encima; el texto del servidor va al sitio del aviso y se devuelve `false`, para que el cable no ate otra escucha al botón que ya la tiene. **Sin propuesta en pantalla, todo queda como estaba.**
- `textoDePropuestaVacia`: el texto del servidor por su motivo, en un solo sitio (lo usan `pintarPropuesta` y el aviso).

## Desviación declarada

«No se ha podido sacar ninguna línea — escríbelas tú» se firmó para una pantalla sin propuesta. En el camino 1 sale encima de tres líneas que siguen ahí (captura `local_V1_390_3.png`). Leído así dice que de ESTE intento no ha salido ninguna: no es falso, es impreciso. Visto en pantalla, a mí me sigue pareciendo raro leer «ninguna línea» con tres debajo; cambiarlo es una línea y un texto firmado.

## Verificado, ejecutando

`tests/scrum1493-la-propuesta-no-se-borra-por-ningun-camino.test.mjs` monta la vista real en el banco y sirve por `fetch`.

- **Rojo antes:** 10 de 12 (los dos que quedaban verdes son los controles).
- **Verde:** 12 de 12, y los 9 de `tests/scrum1302c-…` siguen verdes.
- **Por mutación** (los dos ficheros juntos, 21 tests): base verde y 16 mutantes de 16 mueren, cada uno con su `git diff --numstat`. El primero es la vista de antes en los dos caminos: caen 10. Los demás: el aviso vuelve dentro del hueco · el guardado falla y no se dice · se dice con el texto de ordenar · sin su marca · el 200 vacío vuelve a borrar · protege también sin propuesta · no borra pero no dice · la vista elige el texto · se estira el literal de SCRUM-1302 (C) · devuelve `true` y el cable ata otra escucha · los avisos se apilan · una respuesta buena no quita el aviso · no se trae a la vista · pierde `role="alert"` · el cable ata siempre.

**En el navegador**, sobre yaqu.app (cuenta QA, parte 9, service worker bloqueado, control del interceptor antes de tocar; a producción sólo llegan GET: el POST del dictado y el `PATCH` los contesta la sonda). 2 ventanas (390×844 y 1280×800) × 10 casos = 20 filas.

| caso | con el JS de producción (antes) | con el JS de esta rama servido encima |
|---|---|---|
| propuesta → corrige → 200 sin líneas | MAL: 0 líneas, sin botón | las 3 líneas y la corrección siguen; arriba, el texto del servidor |
| lo mismo con motivo `dictado_vacio` | MAL | siguen; arriba, SU texto |
| 200 vacío ×2 → «Añadir» | no se puede pulsar: el botón ya no existe | UN aviso; `PATCH` ×1 con lo corregido |
| 200 vacío → la ruta vuelve a contestar bien | MAL | la propuesta nueva sustituye y el aviso se quita |
| «Añadir» con el `PATCH` en 500 | MAL: aviso dentro del hueco, sin líneas ni botón | siguen; aviso firmado arriba, entero, sin nada encima |
| «Añadir» sin red | MAL | igual que el 500 |
| «Añadir» 500 ×2 → «Añadir» bien | no se puede pulsar | UN aviso; `PATCH` ×3 (uno por toque); al guardar, el aviso y la propuesta se van |
| ordenar 500 → «Añadir» 500 → ordenar 500 | MAL: dos avisos a la vez | uno, el del último intento |
| CONTROL · sin propuesta, 200 vacío | el aviso del servidor en el hueco | lo mismo |
| CONTROL · «Añadir» con el `PATCH` bien | se repinta, sin aviso | lo mismo |

Con el JS de producción: 12 filas MAL, 4 rotas (las dos que no pueden pulsar un botón que ya no existe, en las dos ventanas) y 4 bien, los controles. Con el de la rama: 20 de 20 bien, 0 rotas. La primera columna es el control de la sonda.

El aviso mide 366×42 (una línea) o 366×63 (dos) en móvil; letra 13,5 px, a 8 px del botón y 12 de la propuesta. Tras un guardado que falla, «Añadir al parte» sigue a la vista en la ventana de 390×844 con tres líneas propuestas.

**NO medido:** yaqu.app con el JS ya desplegado (se mira cuando mergee).

## Sin medir

- Cuántas veces pasa cada camino de verdad. La IA caída DE VERDAD: el 200 vacío lo sirve la sonda con lo que devuelve `sanearDictadoDelParte(null, …)` de `dist`.
- Un móvil de verdad.
- Una propuesta larga: con muchas líneas, traer el aviso a la vista puede dejar «Añadir al parte» fuera de la ventana. Medido con tres.

## Visto de paso, sin tocar

- Un `PATCH` rechazado con 409 (el parte se firmó en otro sitio) dice lo mismo, «vuelve a intentarlo», y ahí repetir no va a salir nunca. Ya era así antes de este cambio; en «Ordenar» SCRUM-1302 (C) lo resuelve releyendo el parte, y aquí no se ha hecho.
- Una línea propuesta sin cantidad no entra al añadir, y tras guardar la propuesta se repinta sin ella. Es el diseño (lo dice su aviso «Falta la cantidad»), pero lo dictado de esa línea se va con el repintado.
