# SCRUM-1386 · Un runner al que matan no ha encontrado nada: `guards:entrada` sale CIEGO, no rojo

**Medido contra:** `origin/main` = `5fb7630ad564740f0fe4ba115e7dc141d18da775` · 2026-10-01T14:52:55Z
(J6 del equipo de Javier, sesión J6i, relevo de J6h; encargo del orquestador `cobroflash-backend-5b`.
Es el hueco que J6h dejó dicho en `docs/master/SCRUM-1345.md`, «Lo que NO sé y lo que NO cubre».)

A9: comprobación → `tests/scrum976-guards-entrada-con-techo.test.mjs`

## En corto

`npm run guards:entrada` lanza un `node --test` con sus 12 guards. Si a ese runner lo mataban desde
fuera, el comando salía **1**, el mismo código que «un guard encontró algo», y decía «solo se
ejecutaron 0 tests». Desde este cambio:

| lo que pasa | antes | ahora |
|---|---|---|
| matan al runner y ningún test había caído | salida 1, «solo se ejecutaron 0 tests» | **salida 2**, «no terminé; no sé nada de tus guards» |
| matan al runner y algún test YA había caído | salida 1, «solo se ejecutaron 0 tests», sin decir cuál | **salida 1**, con los caídos nombrados y «la lista NO es completa» |
| el runner ni arranca (`spawn` ENOENT) | salida 1, «solo se ejecutaron 0 tests» | **salida 2**, «el runner no llegó a arrancar (ENOENT)» |
| matan a UN proceso por fichero y el runner sigue | salida 1, «1 hallazgo · 0 ciegos» | **salida 2**, el fichero nombrado, «0 hallazgos · 1 ciego» |
| un guard revienta al cargar (deja su traza) | salida 1 | salida 1 |
| termina con un guard en rojo | salida 1 | salida 1 |
| termina limpio | salida 0 | salida 0 |

No cambian los 90 s, la lista de 12 ni ningún workflow. El código lo decide `veredictoDe`
(`scripts/_hallazgos-y-ciegos.mjs`): aquí no se escribe una tercera forma de decidir.

## ① El defecto de hoy, visto antes de tocar nada

`docs/master/evidencias/SCRUM-1386/banco.mjs` corre la puerta **tal cual está en el árbol** y fabrica la
muerte: otro proceso (`matar.ps1`) busca al `node --test` hijo de la puerta y lo mata. Nueve casos,
nueve válidos, sobre `origin/main` sin tocar (`antes-sobre-main-5fb7630a.txt`):

| caso | lo que el runner dejó escrito | lo que dijo la puerta | salida |
|---|---|---|---|
| control, nadie mata | 132 ✔, «tests 132» | 12 guards en verde | 0 |
| runner y sus hijos, nada más aparecer | 0 bytes | «solo se ejecutaron 0 tests» | 1 |
| runner y sus hijos, a los 4 s | 0 bytes | «solo se ejecutaron 0 tests» | 1 |
| runner y sus hijos, a los 7 s | **97 ✔**, 0 ✖, sin resumen | **«solo se ejecutaron 0 tests»** | 1 |
| sólo el runner, a los 4 s | 0 bytes | «solo se ejecutaron 0 tests» | 1 |
| runner con `Stop-Process -Force` | 0 bytes | «solo se ejecutaron 0 tests» | 1 |
| UN proceso por fichero (`scrum237`), 1,5 s | 124 ✔, 1 ✖, «tests 125 · fail 1» | «1 hallazgo · 0 ciegos → salida 1 (hallazgo)» | 1 |
| un rojo de verdad, nadie mata | 126 ✔, 6 ✖, «tests 132 · fail 6» | «6 hallazgos · 0 ciegos» | 1 |
| un rojo de verdad y el runner matado a los 7 s | 94 ✔, 3 ✖, sin resumen | «solo se ejecutaron 0 tests» | 1 |

Tres cosas que la medición enseña:

- **Son dos puertas, no una.** Matar al runner cae en el suelo nº2 («que hayan corrido»). Matar a un
  proceso por fichero cae en la rama del rojo, y ahí la frase falsa la firma `veredictoDe`: «1
  hallazgo». El runner lo pinta `✖ tests\scrum237-….test.mjs` · `'test failed'`: el caído es la RUTA del
  fichero.
- **El suelo nº2 afirmaba algo falso con la prueba delante:** 97 tests en ✔ en su propio stdout y «solo
  se ejecutaron 0». Contaba el resumen, no los tests.
- **El último caso es el peor:** había tres tests caídos de verdad escritos, y la puerta no nombró
  ninguno.

## ② Lo que distingue «lo mataron» de «encontró algo»

**No es el código de salida.** Sondeado con cinco formas de matar a un `node --test`
(`sonda-forma.mjs` → `sonda-forma.txt`):

| quién mata | `status` | `signal` | ¿resumen? |
|---|---|---|---|
| `taskkill /F` | 1 | null | no |
| `taskkill /F /T` | 1 | null | no |
| `Stop-Process -Force` | 4294967295 | null | no |
| `process.kill(pid)` de node | 1 | null | no |
| `process.kill(pid, 'SIGKILL')` de node | 1 | null | no |

**Es el resumen.** Un `node --test` que termina por su pie escribe siempre «tests N», caiga lo que
caiga. Uno al que cortan no lo escribe nunca: cinco de cinco. J6h había escrito en el registro de
SCRUM-1345 que en esta plataforma no había forma de distinguirlo; la hay, y no pasa por el número.

**Y un fichero muerto.** Con cuatro cebos fuera del árbol, el runner pinta igual —`✖ <ruta>` ·
`'test failed'`— a un fichero matado desde fuera, a uno que hace `process.exit(1)` callado y a uno que
revienta al cargar. Lo único que separa al tercero: deja su traza en el stdout del runner justo antes de
su ✖.

## ③ Cómo está hecho (`scripts/guards-entrada.mjs`)

- **`traeResumen(salida)`**: ¿está la línea «tests N»? Mismo lector que `recuentoDeTests`, pero sin
  confundir «no hay resumen» con «el resumen dice 0».
- **`cuentasDeLaPasada`** tiene ahora un «no terminó» con dos entradas: el plazo agotado (SCRUM-1345) o
  un runner que acabó sin su resumen. Es **la misma rama**: un ciego, y de hallazgos los ✖ que ya había
  escrito. No mira el estado de salida, así que cubre también el `spawn` que no arranca y una señal.
- **`ficherosMuertos(salida)`**: los caídos de primer nivel cuyo nombre, RESUELTO, es la ruta de un
  guard de la lista. De cada uno, si `callado`: lo que precede a su ✖ es otra línea del runner, o nada.
  Callado es un ciego; con traza, un hallazgo (decisión B1 del ticket, la regla de SCRUM-1343).
- Con el runner terminado y estado ≠ 0: hallazgos = los `fail` del resumen menos los muertos callados;
  ciegos = los muertos callados. `veredictoDe` decide: si hay un hallazgo manda (1) y se dice que la
  lista no es completa; si sólo hay ciegos, 2.
- El comando dice qué pasó: «el runner acabó sin escribir su resumen (estado N)», cuántos resultados en
  verde había escrito, o qué guards «no acabaron de medir».

En `tests/scrum976-guards-entrada-con-techo.test.mjs`, el caso ④ ya no llama «plazo» a todo «no terminé»:
en local un runner matado se dice y no tumba la tanda; **en CI sigue siendo rojo**, como antes.

## ④ Después, con el mismo banco (`despues-con-el-arreglo.txt`)

Nueve casos, nueve válidos:

| caso | salida | lo que dice |
|---|---|---|
| control | 0 | 12 guards en verde |
| runner matado: los cinco casos | **2** | «no terminé; no sé nada de tus guards. El runner acabó sin escribir su resumen (estado 1)» —`4294967295` con `Stop-Process`— · «0 hallazgos · 1 ciego» |
| un proceso por fichero matado | **2** | «1 guard(s) NO ACABARON DE MEDIR», nombra `tests/scrum237-negacion-respaldada.test.mjs` · «0 hallazgos · 1 ciego» |
| un rojo de verdad | **1** | «6 hallazgos · 0 ciegos» |
| un rojo de verdad y el runner matado después | **1** | «HALLAZGO, y además no terminé… ya habían caído 3», los tres nombrados · «3 hallazgos · 1 ciego … NO es la lista completa» |

## ⑤ Los controles que quedan en el test

`tests/scrum976-guards-entrada-con-techo.test.mjs`, tres casos nuevos (11 en total, 11 pasan):

- **⑦** con la salida REAL del runner sobre cebos, recortada antes del resumen: sin resumen y con estado
  1, 4294967295, `null` o 0 → ciego (2). Con un caído ya escrito → 1, nombrado. Y terminado con un
  caído → «1 hallazgo · 0 ciegos».
- **⑧** con el runner REAL sobre cebos: callado → ciego; revienta con traza → hallazgo; callado junto a
  un test que cae → 1, «HALLAZGO Y CIEGO»; un test que cae sin muertos → 1. Y un caído cuya ruta no
  está en la lista no es un «fichero muerto».
- **⑨** el comando de verdad, dos veces: su runner no arranca (un `--import` le cambia el binario por
  uno que no existe) y su runner **se mata a sí mismo a los 1,5 s** (un `--require` que sólo actúa en el
  proceso que reparte; deja un testigo antes de matarse, y sin testigo el caso cae). Las dos salen 2.
  El segundo mata con `SIGKILL`, así que en el CI de este PR es la primera pasada en Linux.

**Mutaciones: 6 declaradas en el test (`MUTACIONES_QUE_ME_TUMBAN`), 6 de 6 caen**
(`mutar.mjs` → `salida-mutar.txt`), con el motor de la casa y la base primero. Tres devuelven el
defecto; tres son el contrario —un hallazgo de verdad que pasa a ciego—. Van en el test y no sólo en el
banco **a propósito**: las seis de SCRUM-1345 se comprobaron en su banco y el meta-guard de CI no corre
ninguna (medido: 0 líneas de `scrum976` en su log de 365 mutaciones).

Eso hace saltar el trinquete de `tests/scrum812-el-rotulo-declara-su-poblacion.test.mjs` (guards que
declaran). Su mensaje pide anotarlo y está anotado allí, con su mutación propia re-anclada. En esta rama
subía de 27 a 28; SCRUM-1343 entró en `main` antes subiéndolo también a 28, y al mezclar
`origin/main` = `cae4c5cc6fb65aea21f7267525930ee44d8d4631` chocaron. La cifra no se eligió ni se sumó: se
conservaron las dos explicaciones, se corrió el test sobre el árbol fusionado y dijo **29**.

## Medido antes de empujar

Sobre la rama con `origin/main` = `cae4c5cc6fb65aea21f7267525930ee44d8d4631` mezclado, en un árbol de
trabajo anidado: `dist/` emitido con `tsc --noCheck` y `node_modules` heredados del árbol de arriba.

- **`guards:entrada`**: 12 guards, 132 tests, verde.
- **El test**: 11 casos, 11 pasan. **Sin la protección** (`terminado = !agotado`, puesta a mano y con
  el `git diff --numstat` al lado: 1 línea) caen el ⑦ —«estado 1: sin resumen se dio por terminado»— y
  el ⑨. Es lo que respalda retirar el aserto del caso ⑤.
- **Mutaciones**: 6 de 6 caen, árbol restaurado, repetidas después del merge.
- **Tanda DIRIGIDA, con turno** (`npm run tanda:dirigida`): 220 ficheros de 1.191 (13 nombran lo
  tocado, 93 recorren su directorio, 114 «no sé qué leen»), 4 a la vez: **2.142 tests · 2.136 pasan ·
  1 cae**; de los otros 5 el comando no dice nada. El que cae es
  `tests/scrum476-reconciliar-censos.test.mjs`, «el censo de directorios `node_modules` no puede dar
  cero»: este árbol anidado no tiene esa carpeta (la hereda). Corrido a solas dice lo mismo. No lo he
  visto en verde en este árbol: lo dirá el CI.
- **NO corrido**: los otros 971 ficheros de la suite, `guards:visuales` y el meta-guard entero (sólo
  mis 6 declaraciones). Eso lo corre CI sobre el merge.

## Lo que NO cubre, y lo que NO sé

- **Si el arnés mata el árbol ENTERO, puerta incluida, no habla nadie.** No hay arreglo posible dentro
  de la puerta, y no sé cuál de las tres formas usa el arnés de verdad.
- **Un fichero matado y uno que hace `process.exit(1)` callado son indistinguibles**, y los dos salen
  ciegos. De los 12 guards de la lista, ninguno llama a `process.exit(` en su propio fichero (barrido
  por texto: 0 de 12; lo que importan no está mirado).
- **`ficherosMuertos` lee texto, y del reporter `spec`.** Con otro reporter no reconoce ningún muerto y
  todo caído sigue siendo hallazgo. Y si otro fichero deja texto suelto justo delante del ✖ de un
  muerto callado, ése sale «con traza»: hallazgo. Los dos límites caen del lado cerrado.
- **Un fichero matado en un proceso por fichero no tiene caso en el test con el comando de verdad**: lo
  prueban el runner real sobre cebos (⑧) y el banco. El texto con que el comando nombra a los muertos
  no tiene mutación.
- **El suelo nº2 sigue como estaba** para lo que sí es suyo: un runner que TERMINA y dice menos tests
  que guards sale 1.
- **Un runner que acaba con estado 0 y sin resumen** (un reporter redirigido, por ejemplo) salía 1 por
  el suelo nº2 y ahora sale 2. Ninguno de los dos es un verde.
- **Cambia un aserto que ya existía:** el caso ⑤ de `scrum976` exigía que un estado ≠ 0 sin resumen
  fuera rojo. Es exactamente lo que el ticket decide cambiar; el aserto se retira y lo cubre ⑦.
- **Matar desde fuera en Linux no lo he corrido.** El banco es de Windows. En Linux corre ⑨, que se
  mata desde dentro.
- **En CI un «no terminé» sigue siendo rojo**, también el de un runner matado. Es a propósito: allí
  nadie debería matarlo, y si pasa hay que mirarlo.

## Mis errores

- **El primer canario dio el caso por NO VÁLIDO con el defecto reproducido delante.** El testigo exigía
  que `taskkill` saliera 0 y salió 255, por un bisnieto que no se dejó matar; el runner sí murió. Lo
  cambié por «vivo antes, muerto después». Lo cazó el canario.
- **Y ese segundo testigo tampoco bastaba.** En una pasada con la máquina rápida el runner terminó por
  su pie justo antes del kill: salida 0, 132 en verde, y el banco dijo «VALE=sí». Lo vi leyendo la
  salida, no por el testigo. Ahora un caso de runner matado cuyo runner dejó resumen no vale, y el corte
  tardío bajó de 9 s a 7 s.
- **Predije que `Stop-Process` cambiaría lo que dice la puerta** (da otro código). No: dijo lo mismo,
  porque no miraba el número.
- **El comentario del script nombró este registro antes de que existiera** y `scrum242` tumbó el caso ④.
  Lo cazó la propia puerta.
- **No miré `scrum812` antes de declarar las mutaciones**, sabiendo que J1h había tropezado en el mismo
  sitio esta mañana. Lo encontró la pasada de guards de suite.
- **Rompí el ancla de una mutación ajena.** Para pasarle el preload al comando metí una línea entre
  `delete env.NODE_OPTIONS;` y `const t0`, que es justo el texto al que `tests/scrum1289-por-que-cayo.test.mjs`
  ancla su mutación sobre `scrum976`. Lo cazó `tests/scrum836-ancla-de-mutacion-viva.test.mjs`, que metí en
  la pasada sin saber que lo necesitaba. Esas dos líneas han vuelto a estar como en `main`; el preload
  entra en una copia del entorno, en la propia llamada. El caso ⑨ pone `NODE_OPTIONS` A PROPÓSITO, con un
  solo `--require` y ningún reporter: lo heredado se sigue borrando siempre.

## Reproducir

    node docs/master/evidencias/SCRUM-1386/banco.mjs <raíz de un árbol>     (Windows; ~80 s)
    node docs/master/evidencias/SCRUM-1386/sonda-forma.mjs
    node docs/master/evidencias/SCRUM-1386/mutar.mjs                        (árbol comiteado)
    node --test tests/scrum976-guards-entrada-con-techo.test.mjs
