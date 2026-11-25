# SCRUM-1824 · lo dictado se asienta dentro de su turno (la carrera de «Añadir al parte»)

**Medido contra:** `origin/main` = `db0a6c04541c258eda6499e1088cf16db9f1836b` · 2026-11-24T18:07:42Z

A9: sin fallo que generalice — la cura y su test los dejó escritos y comiteados EN LOCAL la sesión anterior del puesto, que se quedó sin uso antes de empujar; este tramo los verifica y los entrega, y lo que salió mal (trabajo de un día sin empujar) ya lo dice A17.

**Skill UI:** no cargada · la cura la escribió la sesión anterior y no se puede saber si la cargó; en este tramo no se ha cargado. Lo que cambia es el comportamiento de un botón que ya existía («Añadir al parte»): sin componente, sin clase, sin color y sin texto nuevos. **Microcopy:** ninguna.

## Qué pasaba (PASO 0: se reprodujo, 6 secuencias de 6)

Con el `PATCH` de «Añadir al parte» en el aire, el técnico que seguía apuntando **borraba del servidor
las líneas dictadas**. Cada `PATCH` de líneas manda la lista ENTERA; el del dictado no apuntaba lo
guardado en `parte.lineas` y repintaba la ficha FUERA de su turno, así que el guardado que esperaba
detrás armaba su lista con las líneas de antes. Es la familia que SCRUM-916b curó en «+ Añadir línea»
y en la «×».

Banco: `docs/master/evidencias/SCRUM-1824/reproducir.mjs` (navegador real, molde del guion de 916b),
con su salida en `secuencia.json`. Población: 4 secuencias × 2 anchuras (390 con el dedo, 1280 con
el ratón) × antes y después = 16 secuencias; 3 de cada 4 son de carrera y 1 es el control.

| secuencia (igual a 390 y a 1280) | ANTES: queda en el servidor | DESPUÉS: queda en el servidor |
|---|---|---|
| CONTROL · primero la fila a mano, después lo dictado (nada viajando) | 5 líneas | 5 líneas |
| ① fila a mano mientras viaja lo dictado (`PATCH` retenido) | 3: las 2 dictadas PERDIDAS | 5 |
| ① bis · lo mismo sin retén, red a 1200 ms | 3: las 2 dictadas PERDIDAS | 5 |
| ② cantidad de una línea guardada corregida mientras viaja | 2: las 2 dictadas PERDIDAS, y la pantalla enseñaba 4 líneas con la cantidad vieja | 4, con la cantidad corregida; pantalla = servidor |

Antes: 6 de 6 secuencias de carrera pierden lo dictado, y el control no (el banco ve las dos cosas).
Después: 0 de 6. Relecturas de la ficha tras «Añadir al parte»: de 2–3 a 1 (la de la carga).

## La cura (patrón 916b: asentar sin repintar)

`public/dashboard/js/parteDetailView.js`, y nada más de producto:

- `confirmarLoDictado` hace TODO dentro de su turno (`enOrdenDelParte`): apunta lo guardado en
  `parte.lineas` y llama a `asentar`, que pinta las líneas dictadas al final de su bloque con el
  cable de cualquier línea guardada, sin repintar la ficha.
- Si la respuesta no cuadra con lo mandado o falta el sitio de una línea, se relee del servidor,
  como antes, pero también dentro del turno.
- Con una propuesta ya de camino, un segundo toque a «Añadir al parte» no manda nada (desde que lo
  guardado se apunta, repetirla la metería dos veces en un documento que se firma).
- Lo que el técnico empieza a dictar mientras viaja lo anterior se queda en el cuadro y en el móvil.

Sin texto nuevo, sin estados nuevos, sin tocar el servidor. Los dos ficheros de SCRUM-683
(`tests/scrum683-parte-dictado.test.mjs`, `tests/scrum683b-cableado-dictado.test.mjs`) no se tocan.

## Rojo-primero y lo que se ha corrido

`tests/scrum1824-dictado-sin-carrera.test.mjs` (banco vm, 11 casos):

- con la cura: 11 pass · 0 fail;
- con la vista de `origin/main` (`git checkout origin/main -- public/dashboard/js/parteDetailView.js`,
  y vuelta atrás): 3 pass · 8 fail. Los 8 son los de la carrera, el asentado y el doble toque.

Los 40 ficheros de `tests/` que nombran `parteDetailView`, comparando CONJUNTOS de rojos con y sin
la cura: 271 casos; con la cura 183 pass · 88 fail, sin ella 175 pass · 96 fail. Los 88 rojos son
los mismos en los dos lados y son del instrumento (`Cannot find module '../dist/…'`: este árbol no
tiene `dist`); la única diferencia son los 8 de SCRUM-1824. Es decir: de los 183 que pudieron
correr, ninguno cae por la cura; de los 88 ciegos no se sabe nada.

## Lo que NO se ha corrido, dicho

- **suite con dist: NO CORRIDA (cliente Prisma compartido 18 campos por detrás,
  `scripts/_prisma-client-guard.mjs`); la corre el CI.** Decisión del orquestador del 24-nov: el
  `node_modules` compartido no se regenera con sesiones corriendo.
- **guards:entrada: CIEGO ×3 por carga de máquina (corte a 90 s, CPU saturada); los 16 guards de su
  lista con `node --test` sueltos: 177/177, 0 fallos.** La primera pasada suelta dio 176/177:
  `scrum811c` cazó que a este registro le faltaba la línea `**Skill UI:**`; se añadió y se repitió.
  Empujar así lo decidió el orquestador (SCRUM-1656 c.22684 ①): el juez es el check obligatorio del CI.
- `reproducir.mjs` lo corrió la sesión anterior (commits `cc8efa0ce` y `b21e4b7c3`); en este tramo
  NO se ha vuelto a correr: lo re-medido aquí es el banco vm.
- No se ha visto en yaqu.app ni en un teléfono de verdad (teclado en pantalla). Eso es posterior al
  merge.

## Forense del relevo (24-nov, ~18:05Z)

La sesión anterior del puesto murió por límite de uso sin traspaso. Lo que dejó, medido:

- worktree `.claude/worktrees/scrum-1824-dictado-sin-carrera`, rama `scrum-1824-dictado-sin-carrera`,
  bloqueado por un proceso que ya no existía;
- dos commits locales, ninguno en el remoto: `cc8efa0ce` (banco y medición del «antes») y
  `b21e4b7c3` (cura, test y medición del «después»), este con «SIN EMPUJAR: faltan registro, suite
  con dist, ancla y guards:entrada» en su mensaje;
- sucio, solo `.claude/settings.local.json` (no va en la rama);
- de SCRUM-1822 y de SCRUM-1837, nada: ni rama ni worktree.

Se retoma en el mismo árbol, con `origin/main` fusionado (95 commits, sin conflictos; `main` no
había tocado la vista ni `tests/_banco-vistas.mjs` desde el punto de partida).

## Aceptación → dónde se ve

| aceptación | dónde se ve |
|---|---|
| reproducir primero con el banco | `docs/master/evidencias/SCRUM-1824/reproducir.mjs` y `secuencia.json` (claves «antes · …») |
| cura patrón 916b, asentar sin repintar | `public/dashboard/js/parteDetailView.js` (`asentarLoDictado`) · caso «lo dictado se ASIENTA sin repintar la ficha» del test |
| rojo-primero | `tests/scrum1824-dictado-sin-carrera.test.mjs`: 8 de 11 caen con la vista de `main` |
| sin tocar 683 | el diff de la rama no toca `tests/scrum683*` |
| verlo en yaqu.app | NO HECHO → tras el merge; lo pide el orquestador a quien tenga la sesión QA |

---

## SCRUM-1824b · r42 en vivo: «Añadir al parte» visto en yaqu.app (25-nov)

**Medido contra:** `origin/main` = `77c000deadc9fa6b80ae97b6b02752e18b2c9392` · 2026-11-25T08:08:41Z

A9: aviso → cicatriz S4 «Un guion en vivo no hereda del banco lo que contesta el servidor de mentira: el dictado de verdad devolvió una línea SIN cantidad y, dos minutos después, una propuesta vacía para el mismo texto, y mis cuatro primeros rojos eran de mi expectativa, no de la cura.» — no se pudo comprobar: el guion vive en evidencias, fuera de la tanda de tests

Guion: `docs/master/evidencias/SCRUM-1824/r42-vivo/verificar-en-vivo.mjs` (molde: el de SCRUM-916c).
Navegador real a 390×844 con el dedo, cuenta de QA, parte #21 en borrador. Lo servido es `main`: la
página cargó `parteDetailView.js` con el blob `80bef8425231393cd1f054dfcc225d39b5b25b8e`, que es el de
`origin/main` (`/version` = `77c000de…`). Salida: `r42-vivo/vivo-390.json` y cuatro capturas.

Población: 4 secuencias (las 3 de carrera del banco y su control), 21 comprobaciones. A 1280 NO se ha
corrido en vivo (el encargo era a 390; a 1280 queda lo del banco, 3 de 3).

| secuencia (390, dedo) | la carrera se dio | queda en el servidor | pantalla = servidor | resultado |
|---|---|---|---|---|
| CONTROL · primero la fila a mano, después lo dictado | no aplica (nada viajando) | 6 de 6: 3 de partida + 2 dictadas + la de a mano | sí | ✔ |
| ① fila a mano mientras viaja lo dictado (`PATCH` retenido 873 ms) | sí: fila completa con el `PATCH` aún retenido, 0 respuestas | 6 de 6 | sí | ✔ |
| ① bis · sin retén, /admin/ sale 1200 ms tarde | sí: fila completa a los 476 ms, 0 respuestas | 6 de 6 | sí | ✔ |
| ② cantidad de una línea guardada corregida (2 → 4) mientras viaja | sí: fuera de la casilla con el `PATCH` aún retenido | 5 de 5, con la cantidad corregida | sí | ✔ |

21 de 21 comprobaciones. Dictadas perdidas: 0 de 8 (2 por secuencia). Relecturas de la ficha tras
«Añadir al parte»: 0 en las cuatro. Errores de JavaScript: 0. La propuesta salió las cuatro veces del
dictado de verdad (`POST /admin/partes/21/dictado`), no enlatada.

### Control positivo del guion: la vista de antes, en vivo

Para saber que este guion VE la pérdida cuando la hay, las mismas cuatro secuencias con la vista de
antes de la cura (`251de009e~1`, blob `d08fa890ff16f81e478bedc4415123d71d1efb83`) servida SÓLO a este
navegador; el servidor es el de producción y nadie más recibe ese fichero. Salida:
`r42-vivo/vivo-390-control-vista-de-antes.json`.

| secuencia | con la vista de antes | con la de producción |
|---|---|---|
| CONTROL | 6 de 6 | 6 de 6 |
| ① retén | 4: las 2 dictadas PERDIDAS | 6 |
| ① bis, 1200 ms | 4: las 2 dictadas PERDIDAS | 6 |
| ② cantidad corregida | 3: las 2 dictadas PERDIDAS, y la pantalla enseñaba 5 con la cantidad vieja | 5, pantalla = servidor |

Es lo mismo que midió el banco, ahora contra el servidor de verdad: 3 de 3 pierden antes, 0 de 3 después.

### Escrituras en producción, declaradas

Sólo `PATCH /admin/partes/21` (cuenta de QA): 20 en la pasada buena, 14 en la del control positivo, y
las de las dos pasadas que no llegaron a medir (abajo). El `POST …/dictado` pasa y no guarda nada.
Todo lo demás que no fuera GET se cortó en el navegador (`POST /admin/entorno`, que el panel manda
solo, y el control del interceptor). El parte #21 quedó en sus 3 líneas de partida, con sus ids,
comprobado al acabar cada secuencia y al final de cada pasada.

### Lo que salió mal antes de la pasada buena

- **Primera pasada: 17 de 21, y los 4 rojos eran del guion.** El dictado de verdad propuso «Purgado de
  circuito» SIN cantidad (nadie dictó un número), y una línea propuesta sin cantidad no se confirma:
  es diseño (`lineasConfirmadas`, con su aviso en la línea), y pasó igual en el control. El guion
  esperaba las dos líneas porque el servidor de mentira del banco siempre trae cantidad. Arreglo: el
  guion hace lo que el técnico al ver el aviso, ponerle «1», y lo apunta (`cantidadesPuestasAMano`).
- **Segunda y tercera: CIEGAS (salida 2).** El mismo dictado contestó `vacia: true`,
  `sin_lineas_reconocidas`, dos veces seguidas, a los dos minutos de haber sacado líneas cuatro
  veces. No sé por qué (no lo he mirado en el servidor); es del dictado, no de la carrera. El guion
  ahora reintenta y, a la tercera vacía, enlata la propuesta y lo dice en la secuencia. En la pasada
  buena no hizo falta. En esas dos pasadas la fila a mano del control quedó en el parte y la quitó
  la red de seguridad del guion (un `PATCH` con la lista de partida; `restauradoPorFuera`).

### Lo que NO se ha probado, dicho

- Un teléfono de verdad (teclado en pantalla): esto es Chromium con dedo emulado.
- 1280 en vivo.
- El retén vive en el navegador (el `PATCH` sale tarde); no se ha retrasado la RESPUESTA del servidor.
- El segundo toque a «Añadir al parte» con la propuesta de camino, en vivo (lo cubre el test vm).

### Aceptación → dónde se ve

| aceptación | dónde se ve |
|---|---|
| verlo en yaqu.app (la fila NO HECHO del tramo anterior) | `docs/master/evidencias/SCRUM-1824/r42-vivo/vivo-390.json`: 21/21, y las capturas `vivo-390-*-final.png` |
| el guion ve la pérdida cuando la hay | `…/r42-vivo/vivo-390-control-vista-de-antes.json`: 1.2, 1bis.2 y 2.2 en rojo, control en verde |
