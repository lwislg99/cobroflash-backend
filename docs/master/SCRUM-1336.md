# SCRUM-1336 · Un «no supe mirar» no sale con el mismo 1 que «he mirado y está mal»

**Medido contra:** `origin/main` = `cadf00bcee699dc200ff142050986a62b692b3c4` · 2026-10-01T17:20:06Z

1-oct-2026 · **J1j** (equipo de Javier), relevo de J1i. Encargo del orquestador `cobroflash-backend-5b`. El cuarto juicio por ausencia (c.17970) lo arregló **J1k** y lo midió con navegador **J1l**.

A9: comprobación → `docs/master/evidencias/scrum1336/banco.mjs`

## Qué comentario del ticket manda sobre qué

| asunto | manda | por qué |
|---|---|---|
| la aceptación (A–F) | c.17939 | la escribió el orquestador antes de repartir |
| la **E** | **c.17949**, no c.17939 | la E original pedía una línea que sólo cabe en `guards-visuales.mjs`, que no se puede tocar. Enmendada en E1/E2/E3 |
| `contraste` deja de cortar el recorrido | c.17957 | el `process.exit(1)` del bucle es una de las tres salidas que el ticket manda retirar |
| el suelo del menú | c.17960 | retracta lo que dije mal (ver «Lo que dije mal») |
| un ciego que fabrica hallazgos por ausencia | c.17965 | no estaba en el encargo; salió al arreglar |
| «sin errores de página» de `duplicar-926` | c.17970 | el cuarto sitio del mismo criterio; lo cazó `tests/scrum622` en el CI de este PR |

## El defecto, y que ocurre HOY — los siete, vistos correr

Estaban **leídos, no ejecutados**. Los he ejercitado con su navegador, uno a uno, en ciego provocado y
con 0 hallazgos, sobre `origin/main` @ `8c0bf72850988e5f06266f330ab4c6c869f42a36`:

**Los seis con la marca `pintaElCiegoDeHallazgo`** — los seis salen **1**. Ninguno resulta no tener el defecto.

| guard | el ciego que se provoca | lo que decía |
|---|---|---|
| `a11y-comparativa` | la sección `#comparativa` no existe | «🔴 2 problema(s). En una comparativa, una celda sin su columna… INVIERTE el mensaje» |
| `a11y-landing` | `.note` no da nombre accesible | «🔴 2 problema(s) de accesibilidad en la landing publicada» |
| `contraste` | una página que no se deja medir | «✖ …: no se pudo medir» y sale DENTRO del bucle |
| `duplicar-926` | no hay botón «Duplicar» | siete casillas en rojo, entre ellas «G · duplicar CONSERVA el descuento» |
| `marcadores-en-pantalla` | una vista revienta en sus tres estados | «🔴 SCRUM-722 · 1 problema(s) con los marcadores en pantalla» |
| `objetivo-tactil` | la barra de anuncio no existe | «🔴 SCRUM-542 · 3 problema(s). AB6 no se baja…» |

Y dos caminos más de los mismos seis: `contraste` por debajo de su suelo de nodos → 1;
`marcadores-en-pantalla` con «el banco no es el panel» → 1.

**El séptimo, aparte** — `guard-rastro-del-menu` estaba en `SALEN_A_MANO` **sin** la marca. Con 17
destinos sale **1** por una excepción sin capturar: su suelo es un `throw` dentro de `medir()`, y
`medir()` se llamaba con un `await` a pelo. **No se suma a los seis en ningún recuento.**

## Lo que cambia

Los siete salen sólo por `veredictoDe({ hallazgos, ciegos })` de `scripts/_hallazgos-y-ciegos.mjs`:
1 si hay hallazgos, 2 si sólo hay ciegos, 0 si no hay nada. No hay una segunda forma de decidir.

- **Dos listas donde había una cuenta.** `fallos++` / `mal()` servían para las dos cosas. Ahora lo
  que no se supo mirar va a `ciegos` y lo encontrado a `hallazgos`. Los fallos del propio
  instrumento (el scroll no discrimina, una sonda de tamaño conocido sale mal, falta un conocido)
  son ciegos: lo roto es el guard, no la pantalla.
- **Las listas son del módulo**, no de cada caso: si un caso lanza a mitad, lo que ya había
  encontrado no se pierde (ver «Un límite de la pieza común»).
- **Los seis recorren con `recorrerCasos`**: un caso que lanza es un ciego de ese caso y los demás
  se miden. En `contraste` eso retira el `process.exit(1)` de dentro del bucle (c.17957).
- **`rastro-del-menu`**: la llamada a `medir()` va en un `try`; lo que lance es un ciego.
- **La línea `⟦veredicto⟧ N hallazgos · M ciegos` sale siempre**, también en verde con ceros (E1).

### Lo que no estaba en el encargo: un ciego fabricaba hallazgos «por ausencia» (c.17965)

Tres de los seis sacan conclusiones de **no haber visto** algo. Con algo sin medir, eso da un
mensaje falso **que además es una instrucción**. Visto correr sobre el SHA de antes:

| guard | lo que no pudo mirar | lo que decía |
|---|---|---|
| `marcadores-en-pantalla` | la vista «facturas-recibidas» revienta | «🔴 ENTRADA CADUCA: `facturas-recibidas` ya no pinta ningún marcador. BÓRRALA del censo» |
| `objetivo-tactil` | la lista de Clientes no monta | «🔴 EXCEPCIÓN CADUCA: `BUTTON.btn-secondary.btn-sm` ya no aparece en el panel. Bórrala» (dos veces) |
| `contraste` | `admin.html` no se deja medir | salía en el bucle; con el recorrido completo habría dicho «EXCEPCIONES QUE YA NO OCURREN — bórralas» |

Sin tocar eso, pasarlos por `veredictoDe` los habría dejado saliendo 1 con hallazgos que no lo son.
Ahora: **un juicio que se deduce de no haber visto algo queda SIN JUZGAR si algo no se pudo medir, y
se dice. Uno que se deduce de algo que sí se vio (par nuevo, marcador nuevo, botón corto, algo que
sube) vale siempre.** Los tres salen 2.

### El cuarto sitio del mismo criterio: «sin errores de página» en `duplicar-926` (c.17970)

No eran tres: eran cuatro, y el cuarto estaba en un guard que este PR ya había tocado. La casilla
«sin errores de pagina en ninguno de los dos casos» se decidía con `errores.length ? 'hallazgo' :
'ok'`, y `errores` sale de dos `|| []`: una lista vacía porque no hubo errores y una lista vacía
porque el caso **no llegó a existir** son la misma lista. Visto en la evidencia: sin botón «Duplicar»
(ningún caso se abre) la casilla salía «✔ sin errores de pagina…», en el SHA de antes y en
`d174fa4c`. No cambiaba el código de salida (había otros ciegos), pero era un verde sobre algo que
nadie miró.

**No lo cazó este ticket: lo cazó `tests/scrum622-desconocido-no-es-verde.test.mjs`**, un censo que
nadie había tocado, en el obligatorio del PR (run 36892903386, sobre `31c01fdc`). El guard tenía
razón de fondo, no de forma: su lista de excepciones no se ha tocado y la decisión no se ha
reescrito para esquivar su AST.

La línea, en `e82d47d8`: `errores.length ? 'hallazgo' : (leidoG && leidoP ? 'ok' : 'sin juzgar')`.
Un error **visto** cuenta siempre; que **no** haya ninguno sólo vale si los dos casos se leyeron.

| escenario de `duplicar-926` | antes (`8c0bf728`) | después (`e82d47d8`) | la casilla, después |
|---|---|---|---|
| limpio | 0 | 0 | «✔ sin errores de pagina…» |
| ningún caso se abre (ciego) | 1, con la casilla en ✔ | 2 · «0 hallazgos · 2 ciegos» | «·  SIN JUZGAR (su caso no se pudo leer)» |
| un error de página en los dos casos, sin ciegos | 1 | 1 · «1 hallazgo · 0 ciegos» | «🔴 … — G: … · P: …», con el error nombrado |
| un error de página **y** el desplegable de P sin leer | 1 | 1 · «1 hallazgo · 1 ciego» | «🔴 …», con las DOS cuentas |

El control que decide si el parche vale es la última fila: si al poner el «sin juzgar» un error
visto dejara de contar, el parche sería peor que el defecto (la condición C, aplicada al parche). Y
su mutación lo prueba: con la suspensión puesta **delante** del error, ese escenario pasa de 1 a 2
(«0 hallazgos · 1 ciego») con el error escrito en la casilla y sin contar. Antes de las 35 pasadas se
corrió sólo el escenario del error, para saber si la excepción del temporizador llegaba al
`pageerror` del guard: llegó, en G y en P. Sin eso el positivo no existía.

### F · el desajuste de `rastro-del-menu`

El comentario decía «menos de 17» y el mensaje verde «los 17 destinos», con `MINIMO_DESTINOS` en 18
desde SCRUM-1040 y 18 destinos medidos. Ahora el comentario nombra la constante y el mensaje dice lo
que midió: «✓ los 18 destinos del menú dejan rastro (suelo `MINIMO_DESTINOS` = 18)». Lo mismo en el
comentario de `package.json`. **`MINIMO_DESTINOS` no se ha movido.**

## Antes y después, con navegador

`docs/master/evidencias/scrum1336/banco.mjs`, el mismo banco con dos SHA: antes
`8c0bf72850988e5f06266f330ab4c6c869f42a36`, después `e82d47d87fcc0fcf01a22cc99ffcb5934ca78e71`.
Saca el SHA a un árbol desechable fuera del repo y rompe allí. **35 pasadas válidas de 35 en cada uno.**

El «después» se midió primero sobre `d174fa4cf903f899d87e982eec3e5a1b4d77dfed` (33 pasadas y 17
mutaciones) y, al cambiar la línea de c.17970, **se repitió ENTERO sobre `e82d47d8`**, no sólo
`duplicar-926`: el resumen del banco es de UN SHA, y mezclar dos sería una segunda forma de contar.
Las 50 filas que ya existían salen idénticas en código de salida, validez y línea de veredicto;
las 3 nuevas son los dos escenarios y la mutación de c.17970. El «antes» ganó sólo las dos pasadas
nuevas de `duplicar-926` (se corrieron las seis de ese guard), sobre el mismo SHA de antes.

| escenario | los seis · antes | los seis · después | el séptimo · antes | el séptimo · después |
|---|---|---|---|---|
| limpio | 0 los seis | 0 los seis | 0 | 0 |
| sólo ciegos (B) | **1** los seis | **2** los seis, nombrando el ciego | **1** | **2** |
| un hallazgo real, sin ciegos (C) | 1 los seis | **1** los seis, con su hallazgo | 1 | **1** |
| hallazgo y ciego | 1 los seis | 1 los seis, con las DOS cuentas | (no tiene: su único ciego es el suelo, antes de medir) | |

Más: `contraste` bajo su suelo y `marcadores` con «el banco no es el panel», 1 → 2; los tres de
ausencia, 1 → 2. `contraste` con una página ciega **delante** de una con un par nuevo: antes 1 y del
par nuevo ni una palabra; después 1 con «1 hallazgo · 1 ciego» y el par nombrado.

La línea agregada del banco (E2), sobre esas pasadas: los seis en ciego, antes «6 guards midieron · 0
no supieron mirar», después «0 guards midieron · 6 no supieron mirar»; el séptimo, antes «1 guard
midió · 0…», después «0 guards midieron · 1 no supo mirar».

**`contraste` sobre el árbol real** (lo pide c.17957, porque recorrer todas las páginas podía
destapar hallazgos nuevos): antes 9 páginas, 359 nodos, 0 pares nuevos, sale 0; después «9 de 9»,
359 nodos, «0 hallazgos · 0 ciegos», sale 0. **No pasa de 1 a N**: hoy ninguna página es ciega.

**El menú gana un destino (19)**, medido en los dos SHA: antes sale 0 y dice «destinos del menú:
19» y «✓ los 17 destinos dejan rastro»; después sale 0 y dice «✓ los 19 destinos del menú dejan
rastro (suelo `MINIMO_DESTINOS` = 18)».

### Las mutaciones con navegador: 18 de 18 vistas

Cada una rompe una línea del guard arreglado en el árbol desechable y repite un escenario, contra
su pasada sin mutar:

- **el ciego vuelve a apuntarse como hallazgo** (el defecto del ticket) → el escenario «ciego» pasa
  de 2 a 1. En los siete.
- **el hallazgo se apunta como ciego** (lo que la C teme) → el escenario «hallazgo» pasa de 1 a 2.
  En los siete: el banco lo caza.
- **se quita la suspensión de los juicios por ausencia** → vuelve el hallazgo falso, de 2 a 1. En
  los tres.
- **la suspensión se pone delante del error visto** (sólo `duplicar-926`, c.17970) → el escenario
  «error y ciego» pasa de 1 a 2: un error de página deja de contar porque un caso no se leyó.

## La lista (D)

`docs/master/evidencias/scrum1336/lista-antes-despues.mjs`: `SALEN_A_MANO` pasa de **17 entradas y
25 salidas a mano** a **10 entradas y 14 salidas**. Retiradas: **6 con la marca** (10 salidas) y
**1 aparte, sin la marca** (1 salida). Con la marca quedan **0**. No entra ninguna nueva.

## La puerta, sin tocarla (E3)

`scripts/guards-visuales.mjs` no se toca. Con sus funciones puras (`desenlaceDelHijo`, `recuento`):
un guard que sale 1 cuenta en «1 guard midió»; el mismo guard saliendo 2 pasa a «0 guards midieron ·
0 no arrancaron · 1 arrancó y no llegó a medir». Con un hallazgo real sigue en «midió». `guards:visuales`
entero **no se ha corrido**.

## Un límite de la pieza común — medido, NO arreglado

`recorrerCasos` suma lo que cada caso **devuelve**. Un caso que apunta un hallazgo en una lista suya
y después lanza no llega a devolverla: sale 2 habiendo encontrado un defecto
(`docs/master/evidencias/scrum1336/limite-de-recorrer-casos.mjs`). Los siete de este ticket no caen
ahí. De los guards de SCRUM-1327, `guard-caja-documento-suelto` lleva la lista en la mano
(`suyas.hallazgos.push`, 3 veces): eso está **leído, no ejercitado**. Dicho al orquestador.

## Los límites, dichos

1. **Una excepción fuera de los recorridos sigue saliendo 1 sin pasar por nadie** en los seis (al
   montar las páginas, al levantar el servidor a mano de `duplicar-926`). El séptimo sí la captura,
   porque era su defecto. `comoSale` no ve un `throw`, y lo dice en su salida.
2. **El test del obligatorio comprueba el cableado por AST**; que un ciego provocado salga 2 sólo lo
   prueba el navegador. El test lee el resultado guardado del banco: comprueba que está y qué dice.
3. **`guard-duplicar-926`**: si el editor abre sin las dos líneas, eso es un SUELO y sale 2. Su autor
   lo llamó suelo; si un día «duplicar no carga las líneas» es el defecto, saldrá como ciego.
4. **Los otros 10 de `SALEN_A_MANO` no se han tocado.** No ha aparecido un octavo con esta forma.
5. `scripts/` lo asigna `dos-equipos.md` §3 a S0: declarado en el PR.

## Lo que dije mal

- **Mi banco contó como «midió» a un guard que no arrancaba.** `objetivo-tactil` salía 1 en 0,4 s:
  reventaba al importar porque al árbol desechable le faltaba `dist/`. Lo cazó su pasada «limpio».
  Ahora la pasada de un guard cuyo control limpio no sale 0 no se cuenta. Repetidas las 29.
- **Dije que el suelo del menú era «un trinquete con una sola mitad».** Lo afirmé leyendo sólo el
  guard. La otra mitad está en `tests/scrum819-el-menu-deja-rastro.test.mjs` (18 exactos): con 19,
  ese test cae. Lo medí después de decirlo y lo corregí antes de que se abriera un ticket (c.17960).
- **Dos horas a ojo** en mensajes al orquestador, una mal por más de diez minutos.
- **La dirigida dio «0 caen» y el obligatorio cayó.** La lista de 278 ficheros no llevaba
  `tests/scrum622-desconocido-no-es-verde.test.mjs`: ese censo recorre el árbol entero y no nombra
  ningún fichero, así que `npm run tests:que-cubren` no lo saca. Un «0 caen» sobre 278 no dice nada
  del fichero 279. Desde entonces `scrum622` se corre a mano antes de empujar esta rama; el hueco de
  la lista es de SCRUM-1363 y está dicho al orquestador, no arreglado aquí.
- **Se dijo «tres» juicios por ausencia y eran cuatro.** El cuarto estaba en `duplicar-926`, uno de
  los seis de este mismo PR, y lo encontró un guard ajeno.

## Los controles

- `tests/scrum1336-un-ciego-no-se-pinta-de-hallazgo.test.mjs`: **12 casos**, sin navegador. Fija
  también lo de c.17970: 35 pasadas y 18 mutaciones en los resúmenes, los dos escenarios del error
  de página en 1 antes y después, y la casilla en «SIN JUZGAR», «✔» y «🔴» donde toca.
- `tests/scrum622-desconocido-no-es-verde.test.mjs`, **sin tocar**: es el que cazó el cuarto sitio.
- **Mutaciones del test: 8 declaradas (`MUTACIONES_QUE_ME_TUMBAN`), 8 de 8 caen**, con el motor de la
  casa (`docs/master/evidencias/scrum1336/mutar.mjs` → `mutaciones.json`). Árbol restaurado.
- `tests/scrum812-el-rotulo-declara-su-poblacion.test.mjs`: el suelo sube de 29 a **30**, regenerado
  con el test sobre el árbol ya mezclado con `main`.

## Medido

Rama con `origin/main` @ `cadf00bcee699dc200ff142050986a62b692b3c4` mezclado. El «después» se midió
sobre `e82d47d8`, que ya lleva ese `main` dentro: es el árbol mezclado, no uno anterior. Lo que
se empuja encima de `e82d47d8` sólo cambia `docs/` (`git diff e82d47d8 -- scripts public src tests
prisma` vacío).

`main` seguía en `cadf00bc` al empujar (leído a las 17:20:06Z). `src/` y `prisma/` no cambian desde
`8c0bf728`, y `dist/` es posterior.

- **El test y `scrum622`, a mano y juntos**: 24 tests (12 + 12), 24 pasan, 0 caen, 0 saltan.
- **Mutaciones del test**: 8 de 8 caen, repetidas sobre `e82d47d8`; árbol restaurado (sha256 por
  fichero y `git status` vacío).
- **Con navegador**: 35 + 35 pasadas válidas y 18 mutaciones vistas, con turno, una invocación del
  banco por guard y la memoria libre medida pegada a cada lanzamiento (entre 5.194 y 5.556 MB; el
  umbral es 2.200). Ninguna pasada matada ni sin contar. Las 53 filas del «después» suman 548 s de
  guard. El árbol de trabajo, tras cada trozo, sólo cambia en esta carpeta de evidencias.
- **Tanda DIRIGIDA, con turno** (`npm run tanda:dirigida`): 278 ficheros de 1.193 (103 nombran lo
  tocado, 77 recorren un directorio que lo contiene, 98 de «no sé qué leen»), 4 a la vez: **2.643
  tests, 2.637 pasan, 0 caen**. Los 6 restantes no se han leído por nombre en esta pasada (el TAP no
  se conservó); en la de J1j eran 6 saltos. **`scrum622` no está entre los 278**: va aparte, arriba.
- **`guards:entrada`**: corrido después de escribir este registro.
- **NO corrido**: la suite completa local; `guards:visuales` entero. El juez es el CI, y **el CI de
  este empujón no lo ha leído quien empuja**: lo lee el relevo.
