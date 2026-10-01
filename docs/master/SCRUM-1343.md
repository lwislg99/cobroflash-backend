# SCRUM-1343 · Un hijo que no arranca es un CIEGO, no un hallazgo

**Medido contra:** `origin/main` = `f2336d78a28db890ce813d9f7954c99cd5e0ff63` · 2026-10-01T07:53:57Z

1-oct-2026 · **J1h** (equipo de Javier), relevo de J1g. Encargo del orquestador `cobroflash-backend-5b`.

A9: comprobación → `tests/scrum1343-un-hijo-que-no-arranca-es-ciego.test.mjs`

## El defecto, y que ocurre HOY

El 1-oct el sistema se quedó sin memoria con `guards:visuales` por el guard 30 de 37. Los siete que
faltaban salieron `rojo(3221225794)` · 0,0 s · «(sin salida)» —`0xC0000142`: el proceso no llegó a
iniciarse— y la puerta cerró con «0 CIEGOS · 7 rojos» y «DEFECTOS (salida 1) · 7 guard(s) midieron y
encontraron algo». La salida literal la salvó J4d:
`docs/evidencias/scrum1317/guards-visuales-cortado-por-memoria.txt`.

No lo he repetido cargando la máquina. Lo he fabricado con la **puerta de verdad sobre guards de
mentira**, en un temporal y sin navegador (`docs/master/evidencias/scrum1343/banco.mjs`), sobre
`main` @ `8f5906bc`, antes de tocar nada (`antes-sobre-main-8f5906bc.txt`):

| lo que se fabrica | lo que decía la puerta | salida |
|---|---|---|
| un hijo sale con 3221225794 sin una letra | `rojo(3221225794)` · «1 verde · 0 CIEGOS · 2 rojos» · «2 guard(s) midieron y encontraron algo» | 1 |
| el binario no existe (`spawn` ENOENT) | `rojo(null)` · «1 verde · 2 CIEGOS (2 rojo(null)) · 0 rojos» · «NO MEDIDO» | 2 |

**Son dos defectos, no uno**, y se arreglan en la misma línea y con el mismo criterio:

1. **El del ticket** — con el código nativo, la puerta afirma un hallazgo que no existe.
2. **Otro, que no estaba en el ticket** — con un binario inexistente la puerta **ya** salía por el
   ciego, pero lo pintaba «rojo(null)»: la palabra «rojo» sobre algo que no corrió. Ahora dice
   `PROCESO NO ARRANCÓ (spawn ENOENT)`.

La premisa del encargo («binario inexistente → hoy sale "midieron y encontraron algo"») no se
cumplía: esa frase sale sólo con el código nativo. Avisado al orquestador, que lo corrige en el ticket.

⚠️ El caso del código nativo es una **imitación**: el hijo arranca y sale con ese número. Es lo que
la puerta ve; un `0xC0000142` de verdad pide dejar la máquina sin memoria. El de ENOENT no imita
nada: la puerta corre con una copia de node que el primer guard renombra.

## Lo que cambia (`scripts/guards-visuales.mjs`)

- **`desenlaceDelHijo(r, salida)`**, pura. El final es **del sistema** si el proceso no dio código
  (no se pudo crear, o lo mató una señal) o si el código es un NTSTATUS de error (`0xC0000000` en
  adelante). En ese caso:
  - si el guard llegó a **decir** sus cuentas con hallazgos (`⟦veredicto⟧`), es **rojo**;
  - si no dejó **ni un byte**: `PROCESO NO ARRANCÓ (0xC0000142)`, CIEGO;
  - si dejó salida sin hallazgos dichos: `CORTADO POR EL SISTEMA (…)`, CIEGO.
- Todo lo demás queda como estaba: 0 verde, 1 rojo, 2/3/4 sus cegueras, y **un código desconocido
  sigue siendo rojo** (SCRUM-639).
- **`veredictoDe`** decide en los dos sitios donde había que elegir: qué manda entre hallazgo y
  ciego en la tanda (`veredicto`), y si lo que el guard dijo antes de morir era un hallazgo. No hay
  una tercera regla.
- **La línea que sale siempre**, debajo del total, también con ceros:
  `30 guards midieron · 7 no arrancaron · 0 arrancaron y no llegaron a medir`. Las tres suman la
  población.
- La fila de un guard declarado sin fichero (`filaDeFicheroAusente`) cuenta entre los que no
  arrancaron.
- De paso, porque sale en el mismo caso: con verdes en la fila, la puerta decía «NINGUN guard llegó
  a medir». El 1-oct lo habría dicho con 30 verdes delante. Ahora dice «De los 7 que no están
  verdes, NINGUNO llegó a medir».

Con el arreglo, el caso del 1-oct sale `30 verdes · 7 CIEGOS (7 PROCESO NO ARRANCÓ (0xC0000142)) ·
0 rojos` y **salida 2**. La tanda sigue cayendo: no se relaja nada, cambia lo que afirma.
No se toca ningún workflow: `ci.yml` sólo lee que la salida no sea 0.

## El positivo (④), que es el que podía tumbar el arreglo

Con la puerta de verdad, antes y después (`despues-con-el-arreglo.txt`), los cuatro siguen **rojos**
y la tanda sale **1** con «4 guard(s) midieron y encontraron algo»:

- un guard con su hallazgo y su marca (`rojo(1) · 1 hallazgo · 0 ciegos`);
- uno que **revienta en la primera línea** (node deja la traza y sale con 1);
- uno que sale con **1 sin imprimir nada** — el límite del ticket: ese 1 es suyo;
- uno con un código que la puerta no conoce (77).

Limpio sigue saliendo 0. Y un hallazgo real junto a un proceso que no arrancó sale 1, cuenta **un**
defecto (antes dos) y dice que falta uno por medir.

## Los límites, dichos

1. **No distingo «no se creó» de «el sistema lo mató nada más empezar»** cuando no hay ni un byte:
   los dos salen `PROCESO NO ARRANCÓ`. Es el lado seguro que pide el ticket (CIEGO), y sigue
   tumbando la tanda.
2. **Un guard que hiciera `process.exit(3221225794)` a propósito y callado saldría CIEGO.** Ninguno
   lo hace (barrido de `process.exit(` con negativos o números de cuatro cifras o más en `scripts/*.mjs`: 0).
3. **Un kill de fuera que en Windows llega como estado corriente (1, 143) sigue siendo rojo.** Está
   medido desde SCRUM-554 (`scripts/_salida-de-guard.mjs`) y es el lado cerrado de esta puerta a
   propósito. Por eso no reuso `estadoDeLaSalida`: es la regla contraria, para un censo que no
   bloquea nada.
4. **Un hallazgo impreso sin la marca `⟦veredicto⟧` por un guard que el sistema corta después sale
   CIEGO**, con su salida entera reproducida debajo. Los guards que no emiten la marca no se han
   contado aquí.
5. `guards:visuales` **no se ha corrido** con el arreglo: pide turno y memoria.

## Las otras puertas — medido, NO arreglado

`docs/master/evidencias/scrum1343/banco-otras-puertas.mjs` → `otras-puertas-sobre-8f5906bc.txt`.
Las tres puertas corren tal cual están en el árbol; se fabrica el hijo que no arranca.

| puerta | hijo DIRECTO que no existe | un proceso POR FICHERO que no arranca |
|---|---|---|
| `tanda-con-veredicto` (es `npm test`) | «TANDA SIN VEREDICTO … no se pudo lanzar» · salida 2 — bien | 🔴 lo pasa tal cual: `✖ <fichero>` · `'test failed'` · `fail N` · salida 1. Su lector de huellas no dice nada |
| `guards-entrada` | «solo se ejecutaron 0 tests … no han corrido» · salida 1 — lo dice, con el mismo 1 que un rojo | 🔴 «Algún guard de entrada está en rojo. Arréglalo ANTES de empujar» · salida 1 |
| meta-guard (`correr`) | — | bien: el único caído es el propio fichero → FICHERO MUERTO → cuenta como CIEGA |

**Recuento: 2 de 3 tienen la misma forma**, y las dos por el mismo sitio: es `node --test` quien
cuenta como `fail` un fichero cuyo proceso no llegó a existir. **El modelo bueno ya está en la
casa**: el meta-guard separa «el único caído es el propio fichero» de «cayó un test». No hay que
inventar nada; hay que hacer en las otras dos lo que ya hace una de las tres. No se arreglan aquí. En el caso fabricado sobre
`guards-entrada`, seis ficheros no arrancaron (ENOENT) y un séptimo cayó porque sus propios hijos
tampoco pudieron arrancar.

Del meta-guard, lo que podía esquivar su salvaguarda: `cayo()` casa por fragmento, y el nombre de
un fichero muerto es su RUTA. Declaraciones cuyo `cae` está contenido en la ruta de su fichero:
**0 de 365**.

No medido: el job de CI de navegador ni ningún workflow; `censo-guards-navegador` (su regla es la
de SCRUM-554 y no bloquea).

## Los controles

- `tests/scrum1343-un-hijo-que-no-arranca-es-ciego.test.mjs`: **14 casos**. Dos lanzan procesos de
  verdad (un binario que no existe; un hijo que revienta en su primera línea). Dos leen la puerta
  por AST (clasifica con `desenlaceDelHijo`; la línea de arranque cuelga del cuerpo de `puerta`, no
  de un `if`).
- **Mutaciones: 14 declaradas en el test (`MUTACIONES_QUE_ME_TUMBAN`), 14 de 14 caen**, corridas
  con el motor de la casa (`docs/master/evidencias/scrum1343/mutar.mjs` → `mutaciones.json`). Tres
  son el defecto contrario: un hallazgo de verdad que pasa a ciego.
- El rojo del test sobre `main` no existe como tal: importa funciones que `main` no tiene. El rojo
  de comportamiento es el del banco.

## Medido

Sobre la rama con `origin/main` @ `f2336d78` mezclado, `prisma generate` y `npm run build` (salida 0):

- **El test**: 14 casos, 14 pasan.
- **Mutaciones**: 14 de 14 caen; árbol restaurado (sha256 por fichero y `git status` vacío).
- **`guards:entrada`**: 12 guards, 122 tests, verde.
- **Tanda DIRIGIDA, con turno**: 449 ficheros de 1.163 (los que leen `scripts/`, `docs/master`, las
  cicatrices o el meta-guard), en cuatro trozos, concurrencia 3, TAP a fichero fuera del árbol:
  4.100 tests · 4.026 pasan · 71 saltan · **3 caen, los tres míos**, arreglados en el código y
  repetidos en verde:
  - `scrum533`: dos evidencias con CR en disco;
  - `scrum812`: el trinquete de guards que declaran sube a 27 (entra este test) — anotado allí;
  - `scrum864c`: los dos bancos creaban su temporal sin garantizar el borrado; ahora usan `temporal()`.
- **NO corrido**: los otros 714 ficheros de la suite, `guards:visuales`, y el meta-guard entero
  (sólo mis 14 declaraciones). Eso lo corre CI sobre el merge.

## Errores míos

1. **Monté un caso de banco cuya cobaya no hizo lo suyo.** Para dejar sin binario a los procesos
   por fichero de `guards-entrada` renombraba la copia de node desde el proceso `node --test`; ese
   proceso no carga los `--import` de `NODE_OPTIONS`, no se renombró nada, y el caso salió
   «12 guards de entrada en verde». Lo vi al leer la salida, no por un testigo. Ahora el caso
   imprime su testigo («binario renombrado = sí»).
2. **Escribí «no verdes» en una frase de la puerta** y `tests/scrum1313` la tumbó: es la palabra
   que ese ticket retiró. Cambié la frase.
4. **Tres rojos míos en la tanda dirigida** (CR en disco, el trinquete de SCRUM-812 y un temporal
   sin borrado garantizado): los cazaron los guards de la casa antes de empujar.
3. **Un aserto mío mataba el fichero en vez de dar su rojo**: `assert.equal` sobre dos nodos del
   AST intenta pintarlos enteros al fallar. Lo cazó la mutación («FICHERO MUERTO»); ahora es
   `assert.ok` con el tipo del nodo en el mensaje.
