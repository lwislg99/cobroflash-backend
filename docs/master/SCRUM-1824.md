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
