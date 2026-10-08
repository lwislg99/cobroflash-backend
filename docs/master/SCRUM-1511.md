# SCRUM-1511 · Las 14 marcas «ancladas»: sus citas a Jira existen todas, y cinco no dicen lo que la marca afirma

**Medido contra:** `origin/main` = `fc639ef96164b56ae99c129b7202c56c66abdaf4` (árbol medido) · 2026-10-08T01:38:43Z (hora de GitHub); al cerrar, `origin/main` ya iba en `c1bad3c34e5ac6379d2b7fadd9615fd5d2b5d189`.

A9: sin fallo que generalice — el único tropiezo del tramo (un guion escrito por heredoc perdió una barra invertida) lo paró node con un error de sintaxis antes de medir nada.

Lo hace J4 (equipo de Javier), a continuación de SCRUM-1502 tramo 2. Sólo mide: no toca `scrum921c`,
`tests/_respaldo-de-firma.mjs`, `SIN_RESPALDO` ni ninguna marca, y no escribe ninguna cita nueva. El
estado medido es el de hoy: **28**.

## 0 · En corto

| pregunta | medido |
|---|---|
| marcas ancladas | **14**, con 18 citas, 13 pares ticket + comentario distintos |
| ¿existe el ticket? | 13 de 13 |
| ¿existe ese comentario EN ese ticket? | 13 de 13 |
| ¿el comentario atribuye la decisión al fundador, sobre eso mismo? | **9 marcas sí** (3 con reserva) · **5 marcas no** |
| control: dos citas fabricadas, mezcladas a ciegas en la lista | las dos salieron como inexistentes (una por comentario, otra por ticket) |
| rastreables | 149: 147 nombran ticket (159 distintos), 2 sólo una ruta de `docs/` |
| ¿existen esos 159 tickets? | 159 de 159; el fabricado número 160 salió como inexistente |
| ¿dicen lo que la marca afirma? | **NO MEDIDO** |

Ninguna cita de hoy es inventada: el riesgo que abrió el caso C de SCRUM-1502 (una cita a un
comentario que no existe pasa por anclada) es real en el mecanismo y **no ha ocurrido** en el árbol.
Lo que sí ha ocurrido es otra cosa: cinco marcas ancladas citan un comentario que existe y que
atribuye la firma a OTRO (firma delegada, o decisión del orquestador).

## 1 · De dónde sale la lista

De `veredictos()` del propio trinquete. Como no lo exporta, `evidencias/scrum1502b/veredictos.mjs`
copia su fuente a una carpeta temporal, le añade la línea que lo exporta y la importa; el fichero
seguido no se toca. Control: los recuentos por nivel coinciden con `porNivel()` (14 · 149 · 24 · 28).
La lista de pares, con los dos fabricados dentro, está en
`evidencias/scrum1502b/ancladas-con-dos-fabricadas.json` (sin el texto de las marcas).

## 2 · Las 14, una a una

Veredicto: **a** = el comentario atribuye la decisión al fundador sobre eso mismo · **b** = habla de
eso, y la firma es delegada o de otro. No hubo ninguna «habla de otra cosa» ni «no verificable».

| marca | cita | veredicto | qué dice el comentario (resumido, sin literal) |
|---|---|---|---|
| `src/modules/fiscal/evidencias/paquete.ts:174` | SCRUM-1252 comentario 17726 | a | respuesta literal del fundador, firma una línea |
| `src/modules/fiscal/verifactu/registro.builder.ts:629` | SCRUM-1258 comentario 17713 | a | elige entre dos versiones, con su respuesta literal |
| `tests/scrum514-aprobado-y-aplicado.test.mjs:943` | SCRUM-1258 comentario 17713 | a | ídem |
| `public/dashboard/js/invoicesView.js:209` | SCRUM-825 comentario 17446 | a | respuesta literal a tres decisiones; sostiene la D1 |
| `tests/scrum1027-atajo-flag-off-sin-documento.test.mjs:194` | SCRUM-825 comentario 17446 | a | ídem, D1 y D2 |
| `tests/scrum411-exports-inalcanzables.test.mjs:68` | SCRUM-1404 comentario 18840 | a, con reserva | atribuye cuatro decisiones al fundador; no transcribe sus palabras |
| `tests/scrum582-seleccion-multiple-clientes.test.mjs:187` | SCRUM-1135 comentario 17449 | a | respuesta literal |
| `tests/scrum895b-literales-firmados.test.mjs:1` | SCRUM-895 comentario 15699 | a, con reserva | se titula firma del fundador; dice que delegó la elección y aprobó lo recomendado, sin sus palabras |
| `scripts/guard-pasos-del-editor.mjs:1` | SCRUM-915 comentario 15790 | a, con reserva | sostiene la opinión citada; la otra afirmación del bloque apunta a `docs/prototipos/SCRUM-915/`, sin abrir |
| `src/modules/metrics/domain/actividadEquipo.ts:1` | SCRUM-1341 comentario 17825 | **b** | dice expresamente que lo decide el orquestador y no el fundador. La marca atribuye la firma a SCRUM-1337, que el bloque nombra sin comentario y no se abrió |
| `tests/scrum755-el-contador-que-cuadro-solo.test.mjs:113` | SCRUM-915 comentario 15868 | **b** | firma de microcopy por delegación al orquestador. Es el choque más directo: la marca atribuye esos cuatro textos al fundador |
| `public/dashboard/js/quotesView.js:401` | SCRUM-915 comentario 15868 | **b** | la misma firma delegada. La frase de la marca habla de la v3 del prototipo y apunta a `docs/prototipos/SCRUM-915/`; el ancla del bloque respalda otra cosa |
| `tests/_asignacion-bloques-presupuesto.mjs:30` | SCRUM-915 comentario 15868 | **b** | ídem |
| `tests/scrum601-copy-del-documento-vs-flag.test.mjs:87` | cinco citas | **b** en tres | SCRUM-895/15699 y SCRUM-1216/17347 son **a**; SCRUM-887/15675, SCRUM-920/15992 y SCRUM-1257/17444 son firma delegada |

Lo que esto NO dice: que esos cinco textos estén sin firmar. La firma delegada existe como mecanismo
(regla 30, SCRUM-861) y la pregunta de si cuenta como firma del fundador sigue abierta: es la misma
por la que el trinquete deja fuera las once marcas del asesor. Dice que **el comentario citado no
sostiene la palabra que la marca usa**.

## 3 · ¿Se puede comprobar un ancla sin red, contra el árbol?

Sí, parcialmente, y está medido (`evidencias/scrum1502b/ancla-en-el-arbol.mjs`, 15 pares, 1.393 `.md`):

| criterio | los 13 reales | los 2 fabricados |
|---|---|---|
| el id del comentario está en el registro del PROPIO ticket (`docs/master/SCRUM-<n>.md`) | 13 de 13 | 0 de 2 |
| el id está en cualquier `.md` de `docs/` | 13 de 13 | 1 de 2 (coincide con otro número) |

El primero separa; el segundo no. Límites del primero: comprueba que el registro y la marca dicen el
mismo id, no que Jira lo diga; quien invente una cita puede inventar también la línea del registro; y
no dice nada sobre el contenido, que es donde han fallado las cinco de §2.

## 4 · Sobre si el trinquete debe comprobar el ancla contra Jira (opinión, la decide un jefe)

- Que salga a Jira: no. Hoy da 0 salidas y pasa igual con todas bloqueadas; con red sería un ciego más
  cada vez que Jira no responda. Y existencia no era el problema: 13 de 13 existen.
- Que deje de llamarse «anclado» lo que sólo es una forma: sí, y es lo único que lo medido pide. El
  nivel dice «cita bien escrita», no «aprobación que consta».
- La comprobación de §3 se puede añadir sin red y cazaría el caso C. No cazaría ninguna de las cinco
  de §2: ésas sólo se ven leyendo el comentario.

Las tres tocan `scrum921c` o su apoyo: no se aplican aquí.

## 5 · Errores propios y lo que NO se ha hecho

- **Los comentarios de Jira no los abrí yo: los abrió un subagente**, con la lista y los dos fabricados
  mezclados sin decirle cuáles eran. Yo comprobé que los dos fabricados salieron como inexistentes, que
  ningún ticket devolvió menos comentarios que su total (lo declara él), y la frase de las cinco marcas
  en el árbol. No reabrí ningún comentario por mi mano.
- La existencia de los 159 tickets la midió otro subagente, por lotes, cotejando a ojo las claves
  devueltas; su control (una clave inexistente no tumba la consulta: se omite en silencio) pasó.
- **El contenido de las 147 rastreables con ticket no se ha mirado.** Si la proporción de las ancladas
  (5 de 14) se repitiera, serían decenas; no está medido y no se extrapola.
- No se abrieron SCRUM-1337, SCRUM-346, SCRUM-1232 ni `docs/prototipos/SCRUM-915/`.
- Del 404 no se separa «no existe» de «sin permiso»: Jira da el mismo mensaje.
- Un guion escrito por heredoc perdió una barra invertida; node lo paró con error de sintaxis.
- Tanda completa: no corrida. El cambio es este registro y ficheros bajo `docs/master/evidencias/`.

---

## SCRUM-1511d · Tramo 2 (J4, 8-oct-2026): cuántos literales pintados hoy tienen como único respaldo una ficha con firma delegada. Son 218, y es un suelo

**Medido contra:** `origin/main` = `8518dc7a16164530863d657cb0f2f817a4691d78` · 2026-10-08T02:09:54Z (hora de GitHub, copiada de la entrega en SCRUM-1511 comentario 18916)

A9: comprobación → `docs/master/evidencias/scrum1511d/censo-firma-delegada.mjs`

La pregunta sale del criterio del fundador en SCRUM-1511 comentario 18903: si lo aprobado es texto
que ve el usuario, sólo vale su firma y eso no se delega. Este tramo cuenta cuánto texto pintado
depende hoy de una firma delegada. **Midió la sesión J4 anterior** (instrumento y salida, commit
`0d3f65f8cc3f74aff93af1211797612b01a2000e`, entrega en el comentario 18916); **este registro lo
escribe su relevo, que NO ha vuelto a correr el instrumento**: las cifras de abajo están copiadas de
`evidencias/scrum1511d/salida.txt` y de esa entrega, no medidas de nuevo. Sólo mide: no toca ningún
literal, ninguna marca, ninguna ficha, `src/`, `public/` ni `tests/`, y no escribe ninguna cita nueva.

### T2.0 · En corto

| pregunta | medido |
|---|---|
| literales distintos pintados hoy cuyo único respaldo en `docs/microcopy/` es una ficha con firma delegada | **218** |
| qué cuenta | literales, no frases ni pantallas |
| qué es «pintado» | el literal está en `public/` o `src/` en una línea que no es comentario. No se fue a ninguna pantalla |
| de dónde sale quién firma | de la FICHA, no de Jira |
| es un máximo o un mínimo | un **SUELO**: ver T2.3 |

### T2.1 · Población

| | medido |
|---|---|
| fichas en `docs/microcopy/` | 127 (más un registro congelado) |
| con firma del fundador | 31 fichas · 114 citas |
| con firma delegada (orquestador) | 96 fichas · 317 citas |
| con otra firma o ninguna | 0 |
| comentarios de Jira distintos que nombran las delegadas | 77 |
| de esos 77, abiertos a mano | **5** (más otros dos comentarios que no están entre los 77) |
| corpus | 428 ficheros de `public/` y `src/` |

Cómo se llega a la cifra: 261 literales cruzables de fichas delegadas; 12 constan también firmados por
el fundador (otra ficha o el congelado) y se restan; quedan 249 sólo delegados; de ellos **218
pintados** y 31 no pintados (aparcados, compuestos o notas escritas como cita; 6 de los 31 están en el
código sólo dentro de comentarios).

Los comentarios que más pesan: SCRUM-915/15868 con 35, SCRUM-917/15881 con 27, SCRUM-1124/17002 con
14, SCRUM-1126/17575 con 10. La suma por comentario da 225 y no 218 porque un literal nombrado por dos
comentarios cuenta en los dos. La lista entera, por ficha y por comentario, está en `salida.txt`.

### T2.2 · Controles que corrió el instrumento

| control | resultado |
|---|---|
| POSITIVO: las fichas de SCRUM-1252 y SCRUM-1258, firmadas por el fundador en persona | salen como firma DIRECTA, pintadas (1 de 1 y 2 de 2), y aportan **0** a la cifra |
| positivo del otro lado: la ficha de los pasos del editor (SCRUM-915) | sale delegada, 27 cruzables, aporta 23 |
| DE CERO: un literal derivado en cada pasada, que no existe | no está en el código, ni en lo directo, ni en lo delegado |
| positivo del cruce: la semilla de ese literal, sin el añadido | sí está en el código |
| segunda sonda: citas contadas a pelo contra citas extraídas | 284 = 284 (además, 147 por celda de tabla) |
| segunda sonda: unidades por ficha contra el lector de la casa | 431 = 431 |
| suelo de población | 127 fichas · 428 ficheros · 306 literales directos |
| toda ficha tiene firmante conocido | 0 sin clasificar |
| **controles en rojo** | **0** |

El literal del control de cero se deriva en cada pasada; no hay ningún número fijo escrito.

### T2.3 · Lo que el 218 NO lleva dentro

Es la mitad de la entrega. Nada de esto está en la cifra:

- **Unos 40 literales de 7 fichas delegadas que el lector no extrae**, porque los escriben en lista
  numerada o en tabla con otra cabecera. Son las de SCRUM-984, SCRUM-985, SCRUM-1155 (el alta de
  Gastos), SCRUM-993, SCRUM-1375, SCRUM-1476 y SCRUM-1482. Contados a mano por la sesión anterior y
  **sin cruzar con el código**: no se sabe cuántos se pintan.
- **La lista y el detalle de Gastos** que firma SCRUM-920 comentario 15992: de ese comentario sólo
  tiene ficha el alta. La lista (9 textos) y el detalle (unos 10 más el menú) no están en ninguna
  ficha. Sin contar.
- **El comentario 17349 no tiene ficha**: ninguna lo nombra.
- **42 plantillas con hueco**, todas sólo delegadas, quedan fuera del cruce: no se sabe si se pintan.
  Y 2 citas cortas.
- **38 ids de comentario citados en el código que ninguna ficha nombra** (de 107 citados en `src/` y
  `public/`). Cuáles de esos 38 son firmas de texto: NO MEDIDO.
- De los 77 comentarios delegantes se abrieron 5. En esos 5 la ficha y Jira coinciden en quién firma;
  de los otros 72 sólo se sabe lo que dice la ficha.

### T2.4 · Lo que salió al leer los comentarios (de la entrega, sin reabrir)

- El comentario 15881 firma por delegación los textos de SCRUM-917 menos dos; el anterior, 15876,
  transcribe al fundador aprobando el prototipo y dice expresamente que eso no aprueba los literales
  uno a uno.
- Varios de los comentarios abiertos salen bajo la cuenta del orquestador del otro equipo: la
  delegación no es toda de este equipo.
- `scrum514` cruza con el código las líneas de cita de una ficha, no los literales que la ficha
  escribe en tabla: 147 unidades de 431. Visto de paso y sin tocar: es de otro carril.

### T2.5 · Errores propios y lo que NO se ha hecho

- De la sesión que midió: metió texto con comillas invertidas por `node -e` desde bash y el guion
  quedó roto; lo cazó la lectura, antes de medir. Y la cifra provisional que mandó por mensaje daba 36
  para el comentario 15868; la buena es 35.
- De la sesión que midió: empujó la rama sin este registro y sin línea A9, por falta de contexto, y lo
  dijo en la entrega. Este tramo es esa deuda.
- Del relevo: **no he vuelto a correr el instrumento ni he abierto ningún comentario delegante**. He
  leído los comentarios 18903 y 18916, la salida y los controles del guion. Las cifras son copia.
- No se fue a ninguna pantalla ni a yaqu.app. No se miró el despliegue.
- No se derivó la población por los commits que citan cada comentario: para lo que no tiene ficha, esa
  vía sigue pendiente.
- Nada corregido ni citado: ninguna marca, ninguna ficha, ningún texto. `scrum921c`, `scrum387`,
  `tests/_respaldo-de-firma.mjs`, `SIN_RESPALDO` y `SIN_PROCEDENCIA`, sin tocar. Ticket sin transicionar.
- Tanda completa: no corrida. El cambio de la rama es este tramo y dos ficheros bajo
  `docs/master/evidencias/scrum1511d/`.
- El hook de arranque dijo «SIN IDENTIDAD» en las dos sesiones (SCRUM-1498, carril de S5); se siguió.

## SCRUM-1511f · Tramo 3 (J4, 8-oct-2026): de las ancladas, cuántas citan un ticket o un comentario que no existe. Cero de 15, y ya no son 14

**Medido contra:** `origin/main` = `16e80dea496dad3819bf444983f9974d3c13ebb9` · 2026-10-08T07:36:11Z (hora de GitHub)

A9: comprobación → `docs/master/evidencias/scrum1511f/ancladas.mjs`

### T3.0 · En corto

| pregunta | medido |
| --- | --- |
| marcas que el trinquete da por ancladas | **15**, no 14 |
| citas con la forma que el trinquete reconoce | 19, en 14 pares ticket + comentario distintos, sobre 13 tickets |
| el ticket existe en Jira | 13 de 13 |
| el comentario existe DENTRO de ese ticket | 14 de 14 pares (19 de 19 citas) |
| ancladas que citan algo inexistente | **0 de 15** |

No hay ninguna marca del árbol que cite un 404. El ancla fabricada que abrió el ticket se fabricó en
un espejo (lo dice la descripción del ticket) y no está en el árbol; el encargo de este tramo la daba
por presente, y no lo está.

Como ninguna cita algo inexistente, la tercera pregunta del encargo (qué gobierna cada una de las que
citan un 404) se queda sin población: no hay ninguna que clasificar.

### T3.1 · De dónde salen las 15

Del propio `tests/scrum921c-firma-con-respaldo-en-codigo.test.mjs`, sin tocarlo.
`docs/master/evidencias/scrum1511f/ancladas.mjs` lee su fuente, le cambia sólo los tres imports
relativos y la raíz, le añade un export y lo importa desde una copia FUERA del árbol. La lista es la de
`veredictos()` filtrada por el nivel `anclado`, y se coteja con `porNivel()`, que es la cuenta del
trinquete: 15 y 15. Al importarse corren sus 13 casos: 13 pasan, 0 fallan, 0 saltados.

Reparto que dio en ese árbol: 229 marcas · 149 rastreables · 24 documentales · 27 sin respaldo ·
15 ancladas · 13 negadas · 1 citada.

### T3.2 · La que hace 15

`src/modules/system/app/routes/invoicesAdmin.routes.ts:1293`, que cita SCRUM-1502 comentario 18835.
En el tramo 1 era una de las acusadas. La línea de atribución entró en el commit `25dd9ae2e`
(8-oct-2026, 01:47Z), de otro puesto y con permiso, y con ella el trinquete bajó de 28 a 27.

Es la única de las 15 cuyo ancla se escribió DESPUÉS de la marca, así que es la única que abrí además
por contenido:

- La marca está dentro del `catch` de la ruta del PDF de una factura, en la rama que devuelve 409
  cuando el error es el de factura sin sellar. Lo que gobierna es el campo `message` de esa respuesta:
  un texto que ve el usuario. Leído en el código de alrededor, no deducido del nombre del fichero.
- El comentario 18835 existe, es del 8-oct-2026 y transcribe la respuesta del fundador a la pregunta
  por esa marca concreta, nombrada por fichero y línea. No copia el literal, y lo dice.
- El comentario nace después del texto y reconoce una aprobación que la marca fecha en julio. Eso lo
  puede leer cualquiera en Jira; lo que no puede comprobar nadie desde Jira es la aprobación de julio.

Las otras 14 son las mismas del tramo 1, identificadas por fichero y cita (las líneas se han movido).
Su contenido lo leyeron a mano las entregas de los comentarios 18904 y 18909; aquí sólo se ha medido
que existen.

### T3.3 · Cómo se comprobó contra Jira

Una búsqueda por clave de los 13 tickets más SCRUM-1511, pidiendo el campo de comentarios. La
respuesta (374.199 bytes, 14 tickets, sin página siguiente) no pasó por ningún subagente:
`docs/master/evidencias/scrum1511f/cotejo.mjs` mira, por cada cita, si el id del comentario está en la
lista de ESE ticket. Son dos comprobaciones y dan estados distintos.

| control | resultado |
| --- | --- |
| POSITIVO obligatorio: SCRUM-1511 con los comentarios 18924 y 18903, leídos por mí en el ticket | EXISTE, los dos |
| positivo del clasificador: una marca fabricada en memoria con la forma del ancla | `anclado` |
| de cero del clasificador: la misma marca sin ancla | `sin-respaldo` |
| cruzado: un comentario real en un ticket AJENO (18924 en SCRUM-1252; 17726 en SCRUM-915) | ticket sí, comentario no |
| de cero del comentario: el mayor id bajado más 100.000 | ticket sí, comentario no |
| de cero del ticket: SCRUM-6514, derivado (mayor número de Jira al medir: 1514; 0 ficheros y 0 commits lo nombran, contra 5 y 2 de SCRUM-1511) | Jira devuelve 404 |
| población completa | cada ticket devolvió todos sus comentarios menos SCRUM-1404: 20 de 23 |

En SCRUM-1404 los dos ids que hacían falta (18840 y 18856) están entre los 20 devueltos, así que el
veredicto no depende de los tres que faltan. Una segunda búsqueda dio otra vez 20 de 23.

SCRUM-99999 no servía de cero: lo nombran 3 ficheros y 1 commit.

### T3.4 · Lo que el trinquete no ve dentro de esos mismos bloques

Una sonda más ancha (todo «comentario» seguido de un id) saca cuatro ids que la forma del trinquete
no reconoce. Los cuatro existen, cada uno en su ticket:

- `tests/scrum411-exports-inalcanzables.test.mjs`: 16468, escrito con el ticket detrás («comentario
  16468 de SCRUM-665»), y 18856 sin ticket al lado (es de SCRUM-1404).
- `tests/scrum601-copy-del-documento-vs-flag.test.mjs`: 15868 (SCRUM-915), partido por un salto de
  línea, y 17446 (SCRUM-825).

No cambia ninguna cifra. Dice que la forma exigida deja fuera citas buenas, además de dejar entrar
las inventadas.

### T3.5 · Propuesta escrita, sin construir (decide un jefe)

El trinquete no sale a la red a propósito, y lo declara. Esta medición no da motivo para cambiarlo:
dos tramos seguidos han dado cero inexistentes. Lo que sí enseña:

1. **El número envejece solo.** «Las 14» era verdad a las 01:38Z y a las 01:47Z ya eran 15. Quien cite
   la cifra la saca de `porNivel()` en el momento, no de un registro.
2. **Una anclada nueva es el único momento en que el riesgo existe.** Las 14 viejas están cotejadas
   dos veces. La comprobación barata es de proceso: quien escribe un ancla pega en su registro el
   resultado de abrir ese comentario, y quien revisa lo abre. La de hoy lo cumple.
3. **Si se quiere mecanismo sin red:** el criterio del tramo 1 (el id del comentario consta en el
   registro del propio ticket) se podría exigir sólo a las ancladas NUEVAS, con las 15 de hoy
   congeladas por nombre. **No medido aquí** si la número 15 lo cumple, ni cuánto costaría.
4. **El nombre del estado.** Sigue en pie lo dicho en la descripción del ticket: el nivel promete que
   consta y mide que está bien escrito. Es un cambio en el trinquete: no se ha tocado.

### T3.6 · Errores propios y lo que NO se ha hecho

- **Contenido: sólo el de la número 15.** De las otras 14 no he reabierto ningún comentario para leer
  qué dice; he comprobado que el id está en su ticket.
- **Las 149 rastreables: sin tocar.** Ni existencia ni contenido en este tramo.
- **Del 404 no se separa «no existe» de «sin permiso»**: Jira contesta lo mismo a las dos.
- Mi primera salida llevaba el nombre de las cuentas de Jira de cada comentario y la ruta de mi
  máquina; las quité antes de guardar la evidencia. La respuesta de Jira no se guarda en el árbol.
- La copia del trinquete se escribe fuera del árbol; al terminar, `git status` limpio.
- Nada corregido ni citado: ninguna marca, ninguna ancla, ningún texto. `scrum921c`, `scrum387`,
  `tests/_respaldo-de-firma.mjs`, `SIN_RESPALDO` (27) y `SIN_PROCEDENCIA`, sin tocar. Ticket sin
  transicionar.
- Tanda completa: no corrida. El cambio de la rama es este tramo y cuatro ficheros bajo
  `docs/master/evidencias/scrum1511f/`.
- El hook de arranque dijo «SIN IDENTIDAD» (SCRUM-1498, carril de S5); se siguió, como manda la ficha.
