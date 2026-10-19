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

## SCRUM-1493c · la casilla de la descripción, en la propuesta, con el mismo estilo que las líneas ya guardadas (19-oct-2026, S4)

**Medido contra:** `origin/main` = `ea8dece1df90430ae0b269e200be137ff5462b72` (prod servía ese mismo SHA en `/version`) · carril S4 · árbol `s4-1493c-casilla-propuesta` · rama `scrum-1493c-casilla-propuesta-mismo-estilo`.

**Skill UI:** no cargada · a propósito: no hay decisión de diseño nueva — se reutiliza, tal cual, una clase de `styles.css` que ya existe y ya está aprobada (SCRUM-1287) para el mismo tipo de casilla, en la misma pantalla.

### De dónde sale

Nombrado sin ticket en c.19818/c.19819 de este mismo ticket (15-oct-2026), al ver de paso la captura del 500 simulado de SCRUM-1493b: «en la propuesta, la casilla de la descripción sale como una caja estrecha de borde fino, distinta de las casillas de las líneas guardadas que hay justo debajo». Quedó dicho «lo reparto cuando sepa de qué carril es el estilo» — es el mío: `parteDetailView.js`.

### La causa

`pintarLineaPropuesta` (línea ~844) pinta `<input type="text" data-propuesta-desc="1">` **sin ninguna clase**, sólo el estilo inline `flex:1;min-width:160px;font-size:14px`. Sin clase, hereda el borde y la altura por defecto del navegador. Las líneas YA guardadas (`pintarFilaParte`, el `<textarea class="parte-linea-desc">`) llevan `min-height:44px`, `padding:8px 10px` y un borde de 1,5px con los tokens de color — de ahí el contraste que se nombró.

### Qué cambia

Se añade `class="parte-linea-desc"` al `<input>` de la propuesta. Es la MISMA clase que ya usan las líneas guardadas (`styles.css`, de S2 — **no se toca, ni se crea clase nueva**: mismo patrón de reuso cross-carril que `job-toolbar-btn-44` en SCRUM-786d). El `font-size:14px` inline se queda tal cual: no era parte de la queja, y tocarlo habría sido un segundo cambio sin medir. La casilla de UNIDADES (al lado) no se toca: la queja era sólo de la descripción.

### Verificado, ejecutando

- `tests/scrum1493c-casilla-propuesta-mismo-estilo.test.mjs` (4 casos, montando la ficha real con el banco — dictar → «Ordenar en líneas» → propuesta en pantalla, mismo montaje de SCRUM-1266/1302C): rojo primero quitando la clase (1 de 4 cae, exactamente el de la clase); con el cambio, 4 de 4. Incluye el CONTROL de que la casilla de unidades no cambia.
- `npm run guards:entrada`: 15/15 (170 tests). Guards de árbol entero (195, 414, 694, 710b, 737): 38/38.
- `tsc`: sólo el error conocido y ajeno de `merchantAdmin.ts:147`.

### Lo que no cubre

- No medido en yaqu.app desplegado (se mira tras el merge, cuenta QA, dictando sobre un parte en borrador).
- Es un arreglo cosmético (borde/alto); no toca la lógica de `ordenarElDictado` ni ningún camino de los que protege SCRUM-1493/1493b.
- Una línea propuesta sin cantidad no entra al añadir, y tras guardar la propuesta se repinta sin ella. Es el diseño (lo dice su aviso «Falta la cantidad»), pero lo dictado de esa línea se va con el repintado.

## SCRUM-1493b · «Añadir al parte» con un 409 relee el parte, como «Ordenar» (S4, 15-oct-2026)

**Medido contra:** `origin/main` = `310721d211be7cdd081003dc02ed987e582d7426` · 2026-10-15T16:21:52Z
A9: sin fallo que generalice — el rojo se probó con la vista de main antes de darlo por bueno

Carril S4 (`public/dashboard/js/parteDetailView.js`) · rama `scrum-1493b-anadir-409-relee`.

**Skill UI:** no cargada · sin marcado, clases ni estilos: solo qué hace la vista ante un código; la pantalla que sale es la relectura que ya existía.

### El defecto (el «visto de paso» de arriba)

Un `PATCH` de «Añadir al parte» rechazado con 409 decía «No se han podido guardar las líneas — vuelve a intentarlo», y reintentar no iba a funcionar nunca. El único 409 de esa ruta es `parte_locked` (`partes.routes.ts:501`, `permisoDeCampos`): el parte ya no admite líneas, normalmente porque se firmó desde otro sitio.

### Por qué no es estirar una firma

El orquestador (mensaje a la sesión, 15-oct ~16:20Z): un arreglo de COMPORTAMIENTO que reutiliza una forma ya firmada en una situación equivalente lo firma él; c.18491 se queda para «Ordenar». La prueba de la equivalencia es la que pidió: **que releer arregle la pantalla también aquí**. Mismo 409 (`parte_locked`), misma relectura (`renderParteDetailView`), y tras ella la ficha sale firmada, sin «Añadir al parte», sin «Ordenar» y sin casillas: cuenta la verdad, igual que en «Ordenar». El 404 va con él, como en «Ordenar» (conducta 2 de SCRUM-1302 C): la relectura pinta «No se ha podido cargar el parte…», ya firmado. Ningún texto nuevo. 5xx y sin red no cambian: siguen con el aviso de SCRUM-704 y la propuesta en pantalla.

### Verificado, ejecutando

`tests/scrum1493b-anadir-409-relee.test.mjs`, la vista real en el banco con un servidor de `fetch` cuyo 409 firma el parte de verdad.
- **Rojo** con la vista de `origin/main` (diff 0/9): cae el del 409 y pasa el control (500).
- **Verde:** 2 de 2, y los 21 de `scrum1493` y `scrum1302c` siguen verdes.
- **NO medido:** yaqu.app (sin mergear) · la suite completa (la corre el obligatorio).

### (a) «No se ha podido sacar ninguna línea» encima de tres líneas: la condición NO está mal

El orquestador pidió arreglar la condición si miraba lo que no debía, o pasarlo a S1 si el servidor contestaba «ninguna» devolviendo tres. **No es ninguna de las dos**, leído en el código (`ordenarElDictado`, el bloque de SCRUM-1493) y en la fila 1 de la tabla de arriba (navegador, 7-oct): las tres líneas que siguen en pantalla son de un intento **ANTERIOR**, y la respuesta vacía (`propuesta.vacia`) es la del intento **NUEVO**. El servidor no se contradice y la condición mira lo que debe. Quitar el aviso dejaría el segundo «Ordenar» sin ninguna respuesta visible, que es la familia de SCRUM-1302 B. Así que **no se ha tocado**. Si se quiere otra cosa, pide una frase nueva («de este intento no ha salido ninguna») y esa la firma el orquestador, no la escribe S4.
