# SCRUM-1149 · La fila de Clientes a 44 px de toque (AB6, grupo B de SCRUM-786)

**Medido contra:** `origin/main` = `3fadf8eba46be56c209e5eb491cbeab155bc2314` · 2026-10-20T10:36:51Z (hora de GitHub al escribir: 2026-10-20T11:16:00Z; al escribir, `main` ya era `523ccd90`, y entre los dos no cambia ninguno de los cinco ficheros de este registro: `git diff --stat`, vacío)
A9: comprobación → `scripts/guard-lista-trabajos.mjs`

J2 (sesión `jv-j2a`, equipo de Javier), por encargo del orquestador `cobroflash-backend-09`. Carril: `customersView.js` es
J2 (`dos-equipos.md:144`). `styles.css` es un **contenedor de S2** (`:150`): se añade un bloque marcado «J2» y no se
reescribe nada ajeno. `scripts/guard-objetivo-tactil.mjs` sólo lo cubre la fila general de `scripts/`, y aquí se le
quitan las dos entradas que el propio guard declaraba sobrantes.

## 0 · La pregunta del orquestador: ¿este defecto es el rojo de `guard:objetivo-tactil` en `main` (SCRUM-1570)?

**No es el mismo elemento, pero está en la misma lista y se arregla con la misma regla.** Leído en el log del CI de
`main` sobre `dc1b2b4db` (job 118070958883) y repetido en local sobre la base, con el mismo resultado:

- **El rojo es «⬇ Clientes CSV»** (`A.btn-secondary.btn-sm`), en la cabecera de la lista de Clientes: 31 px, por debajo
  de 36 y de 44, sin excepción declarada. 2 hallazgos, uno por anchura. El enlace lo añadió SCRUM-886 (`2cef00c90`,
  16-sep). **Por qué empezó a salir el 17-oct: no lo he medido.**
- **Los cuatro de 1149** («⬆ Importar», «Editar», «Portal», «📊 Historial») **no eran el rojo**: estaban en
  `EXCEPCIONES_PANEL` como «Lo retira el fundador al decidir sobre `.btn-sm`». Esa frase había quedado vieja, porque
  el fundador ya decidió el 21-sep (SCRUM-786 c.16266, opción ③: reglas por contenedor, nunca `.btn-sm` global).
- **La regla de contenedor cubre la cabecera entera**, así que arreglar 1149 cubre también el CSV. Con el cambio,
  `guard:objetivo-tactil` sale **verde**: es uno de los tres rojos de SCRUM-1570. Los otros dos
  (`escalera-por-estado` y el CIEGO de `marcadores-en-pantalla`) siguen igual, y no son de este ticket.

## 1 · PASO 0

En Jira, SCRUM-1149 está en «Tareas por hacer», sin comentarios y con etiquetas `ab6`, `area-j2`, `equipo-javier`: no
espera decisión de nadie. No había commits con el número, ni registro, ni regla para esta lista en `styles.css`. El
patrón que se copia es el hermano **SCRUM-1148**: la lista de presupuestos, con su «⬇ CSV» y sus botones de fila,
36/44 px anclados con `:has()` y sin tocar el marcado.

## 2 · El cambio

- **`styles.css`, bloque J2:** los `.btn-sm` de `.data-card-header > div` y de `td.cell-actions > div` de la tarjeta de
  Clientes pasan a 36 px en escritorio y a 44 hasta 768. Son los mínimos de DESIGN.md y el corte de
  `_medidor-de-toque.mjs`.
- **El ancla** es `.data-card:has(> .barra-seleccion)`: la barra de selección es hija directa de la tarjeta, y sólo la
  pinta `customersView.js` (comprobado con `grep` en `public/dashboard/js`; `.customers-tabs` se descartó porque
  también la usa Informes). El marcado no cambia. `.btn-sm` global no se toca. Sólo tamaño.
- **`guard-objetivo-tactil.mjs`:** `EXCEPCIONES_PANEL` queda vacía, con su porqué. El guard la daba por sobrante
  («EXCEPCIÓN SOBRANTE … mientras esté, ese botón no está vigilado»), y es la aceptación del ticket. Ningún test fija
  su contenido (`grep`).

## 3 · Lo medido (Edge en local, el mismo guard que el CI)

| | lista de Clientes, 929 px | lista de Clientes, 390 px | veredicto |
|---|---|---|---|
| base | 11 cortos, 10 excusados → **1 rojo** (CSV) | 2 cortos, 1 excusado → **1 rojo** (CSV) | 2 hallazgos, salida 1 |
| con la regla y las excepciones puestas | 0 cortos | 0 cortos | 2 «EXCEPCIÓN SOBRANTE», salida 1 |
| con la regla y sin excepciones | 0 cortos | 0 cortos | **0 hallazgos, salida 0** |
| **control en rojo:** sin la regla y sin excepciones | los 5 botones, 30,8–31 px | los 5, 30,6–31 px | 22 ✖, salida 1 |

- **Solapes:** el recuento de «presentes pero no tocables» de la lista (medido con `elementsFromPoint`) es idéntico
  antes y después: 7 en cada anchura. Son las casillas nativas de 18 px que ya tapaba su envoltorio. Ningún solape nuevo.
- **`censo:tactil-panel`, antes y después:** `renderCustomersView` a 390 pasa de **2 cortos a 0**. El total de
  distintos sigue en **72**: el censo mide todo contra 44, y a 929 estos botones dan 36-37 px, que es lo que DESIGN.md
  pide en escritorio.
- **`guards:visuales` entero (38):** 36 verdes, 1 CIEGO (`marcadores-en-pantalla`) y 1 rojo (`escalera-por-estado`),
  los dos ya en rojo en `main`. En la base, el CI de `main` daba 34 verdes y 3 rojos. Lo que cambia es
  `objetivo-tactil`, a verde. `cls-barra-anuncio` sale verde aquí y rojo en el CI de `main`: es diferencia de
  máquina, no la he medido y no es de este cambio.
- **Tests de la tanda que leen estos ficheros** (129 ficheros que nombran el guard, el censo, `styles.css`,
  `customersView`, `.btn-sm` o la barra): **1.273 de 1.273**.

## 4 · Error propio

La primera versión anclaba con una clase nueva en la tarjeta (`data-card clientes-lista`). `guard:lista-trabajos`
compara por hash el HTML de las listas hermanas con la base, y salió rojo: «Clientes ha cambiado MÁS de lo declarado»
(`e1699a55…` frente a `827110b0…`). Es justo el motivo por el que SCRUM-1148 se ancló con `:has()`, y estaba escrito
en su bloque de CSS, dos pantallas más arriba. Se cambió el código, no el guard: fuera la clase y ancla con `:has()`.
Con eso: «Clientes · eb09e87c… · idéntico a la base».

## 5 · Lo que NO se ha hecho

- **No se ha mirado en yaqu.app.** El cambio no está desplegado. La medición es de Edge en local.
- **No hay capturas de antes y después.** La medición es la del guard, píxel a píxel.
- Los otros dos instrumentos de SCRUM-1570 siguen en rojo. Los otros grupos de SCRUM-786 no se han tocado.
