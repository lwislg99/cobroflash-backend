# SCRUM-1344 · Un arnés que llama a un router de /admin dice quién llama

**Medido contra:** `origin/main` = `8e03d28cf2eddc658493a2a2bb00e2b94303bd18` · 2026-10-01T17:40:53Z

A9: comprobación → `tests/scrum1344-arnes-de-prueba-con-rol.test.mjs`

Sesión J5h (relevo de J5g), por encargo del orquestador del equipo de Javier (`cobroflash-backend-5b`).
El censo y el ANTES de la sonda (Ⓒ, Ⓓ) se midieron sobre `cadf00bcee699dc200ff142050986a62b692b3c4`, que
era `origin/main` al coger el ticket (17:04:18Z, comentario 17973 de Jira). Entre ese commit y el del ancla
`main` solo recibió el PR #2115, que no toca ni `src/` ni `tests/` (medido con `git diff --name-only`);
el DESPUÉS, las mutaciones y la tanda se corrieron con el del ancla ya mezclado en la rama.

## Ⓐ De quién es el ticket, y qué se toca

Literal del orquestador (comentario 17973), que corrige el dato que venía en el encargo:

> SCRUM-1344 es de `area-j4` y lo trabaja J5 por decisión del orquestador del equipo de Javier
> (`cobroflash-backend-5b`), que es quien reparte. Alcance: los ARNESES (`tests/`), no el código de
> producción de ningún carril.

Se toca: `tests/` (dos ayudantes nuevos, un guard nuevo y 23 arneses que ya existían), este registro, su
carpeta de evidencias y una línea de A10. **Nada de `src/`, ningún `requireRole`, ningún workflow.**

## Ⓑ La premisa del ticket era la contraria

El ticket decía: «son veinte rojos esperando al próximo que declare un rol en una ruta». Eso describe un
problema **ruidoso**: tests que caen con un `403` que parece culpa de quien cerró la ruta.

Lo medido es un problema **silencioso**. De los arneses sin rol, 13 llegan HOY, corriendo y en verde, a
una ruta que exige `admin`. No caerían al cerrarla porque ya está cerrada y no se enteran: **sacan el
handler de `route.stack` y lo llaman a mano**, así que no pasan ni por el `requireRole` de la ruta ni por
el del montaje. Esos 13 no distinguen el gate puesto del gate quitado. El caso de `scrum960` (el que cayó
en SCRUM-1317 y dio origen al ticket) era la excepción y no la regla: llamaba al router entero.

Lo que **no** se ha medido, y por eso no se afirma: que ningún otro test vigile esos gates. Hay al menos
uno que sí, leído y no ejercitado por mutación: `tests/scrum55-admin-fail-closed.test.mjs` exige que toda
ruta de `/admin` lleve `requireRole` o esté en `TECNICO_ALLOWED`. La frase que se sostiene:

> 13 arneses no pueden detectar un gate; la EXISTENCIA del gate la vigila `scrum55`; lo que no vigilaba
> nadie es que un arnés describa a un llamante que producción rechazaría.

Entre las rutas a las que llegaban sin rol hay tres del camino de emisión (`POST /admin/invoices`,
`POST /admin/invoices/:id/rectify`, presupuesto → factura). Se han LEÍDO; no se ha tocado ni una línea suya.

## Ⓒ El censo: dos sondas independientes que coinciden

| sonda | qué hace | dónde vive |
|---|---|---|
| lee (AST) | pliega cada import hasta la ruta que nombra; «es un router» y «qué gate tiene» lo dice `dist/app.js` ejecutado, emparejando por identidad de objeto | `tests/_censo-arneses-de-router.mjs` |
| corre | lanza cada arnés con una sonda delante y apunta con qué `req` llega cada llamada a cada ruta | `docs/master/evidencias/scrum1344/sonda.mjs` y `correr-sonda.mjs` |

ANTES, sobre `cadf00bc` (`docs/master/evidencias/scrum1344/antes.txt`): 1.330 ficheros de `tests/`
leídos, 0 sin parsear. 152 candidatos corridos dos veces (sin sonda y con ella): 0 sin testigo, 0 con
recuentos distintos, 0 en rojo de base, **0 contradicciones entre las dos sondas**.

| lo que lee el AST | ficheros | lo que vio la sonda |
|---|---|---|
| arman un `req` de sesión contra un router de `/admin`, **sin rol** | **23** | 13 llegando a una ruta con gate, 8 a una sin gate, 2 no observados (se saltan sin su Postgres) |
| lo arman con `userRole` a mano | 40 | 40 con rol |
| cargan un router de `/admin` y no le arman ningún `req` | 2 | ninguno con sesión |
| solo cargan routers públicos | 31 | ninguno con sesión contra `/admin` |
| montan `dist/app.js` entero | 49 | 2 observados sin sesión; 47 no observados (se saltan o no piden nada) |
| importan de `dist/` con una ruta que no se puede leer | 7 | 0 llamadas a ninguna ruta |

**Las dos cifras** (aceptación B): de los 23 sin rol, **14** sobre rutas que hoy exigen rol (los 13 vistos
más `scrum389`, que llama a `/admin/reports` y aquí se salta) y **9** sobre rutas sin gate (los 8 vistos
más `scrum728`).

El censo por texto del ticket (69 → 42 → 22 → 20) fallaba en las dos direcciones. Repetido sobre
`cadf00bc` daba 74 ficheros que «importan un router»: 47 de ellos no cargan ninguno (lo leen como texto o
lo nombran en un comentario), y no veía a los que lo cargan con `DIST + '…'`, con `path.join` o a través
de un ayudante. Y «`psp.routes` en 7 ficheros, camino de cobro» no es de sesión: es un webhook público.

## Ⓓ Qué se ha construido

- **`tests/_arnes-de-router.mjs`** · `reqDeSesion({ rol, merchantId, … })`: devuelve lo que se le pasa más
  `userRole`, y nada más. El rol **no tiene valor por defecto**: sin él, lanza. Tampoco arma una sesión sin
  comercio ni acepta el rol dicho dos veces.
- **`tests/scrum1344-arnes-de-prueba-con-rol.test.mjs`** · 27 casos, 2,4 s. Todo fichero que carga un
  router de `/admin` cae en una clase; «sin rol» tiene que estar vacía, y las que no son «usa
  `reqDeSesion`» son listas cerradas que se comparan como conjuntos:
  - `HEREDADOS_A_MANO` (41): los que ya escribían `userRole` a mano. No se tocan y la lista solo mengua;
    un arnés nuevo que lo escriba a mano cae.
  - `SIN_FORMA_DE_SESION` (2), cada uno con lo que sí hace con el router.
  - `SIN_JUZGAR` (hoy vacía): lo que no se pudo mirar y hay motivo para mirar.
- **La línea**, que sale siempre, también con cero. Hoy:
  «36 arneses montan rutas con rol · 0 sin declararlo · y 27 montan rutas sin gate hoy · 0 sin declararlo ·
  población: 1.331 ficheros de tests/ leídos, 0 sin parsear; 63 arman un req de sesión contra un router de
  /admin (22 con reqDeSesion, 41 a mano, 0 sin rol) · SIN JUZGAR: 0, más 7 con un import de dist/ que no se
  puede resolver leyendo (y ningún req de sesión a la vista) · aparte: 2 cargan un router de /admin sin
  armarle un req de sesión, 31 solo routers públicos, 49 montan dist/app.js entero».

## Ⓔ La migración de los 23, y que ninguna aserción cambia

`docs/master/evidencias/scrum1344/migrar.mjs` envuelve el literal del `req` en
`reqDeSesion({ rol: 'admin', … })` y añade el import **en la misma línea del último import**: ningún
fichero cambia de número de líneas, porque 11 de los 23 están citados por `fichero:línea` en `docs/`.
22 los migró el guion; `scrum912` (un middleware que asignaba `req.merchantId`) se migró a mano, una línea.
El rol es `admin`, el del propietario. Ninguno necesitó otro.

| comprobación | resultado | instrumento |
|---|---|---|
| aserciones idénticas contra `main`, por AST | 567 comparadas en 23 ficheros, 0 distintas; control positivo: una aserción cambiada sale distinta | `aserciones.mjs` |
| lo único que cambia además del envoltorio | la línea 65 de `scrum912` | `aserciones.mjs` |
| mismos recuentos que antes de migrar | 23 corridos, 0 distintos, 0 ciegos | `migrados-igual-que-antes.mjs` |
| los 41 que ya declaraban rol | diff vacío contra `main`: no se han tocado | `git diff --stat` |

`scrum389` y `scrum728` se saltan en esta máquina (piden `LIBRO_PG_URL` y `SERIE_PG_URL`): su migración
solo la ejecuta el CI, y ahí hay que leerlos por nombre.

## Ⓕ El rojo primero, y el guard visto en rojo

El rojo no es «que caigan los arneses»: es `antes.txt`, donde 13 ficheros en verde llegan sin rol a una
ruta con gate. DESPUÉS (`despues.txt`): 0 llamadas sin rol, 0 contradicciones.

`mutar.mjs`: 16 mutaciones, base sin mutar en verde, **16 vivas, 0 mudas, 0 ciegas**
(`mutar-salida.txt`). La M1 es el árbol de antes: devolver los 23 a como están en `main` hace caer el ④.

## Ⓖ A quién le cae el día que entra

`exposicion.mjs` pasa por el analizador del guard los tests que añade o modifica cada PR abierto de los dos
equipos: 8 PR mirados, 0 ciegos, **0 con un arnés que el guard rechazaría**, 0 que toquen un arnés migrado.

## Ⓗ Lo que no cubre

- Un arnés que declara `rol: 'tecnico'` y saca a mano el handler de una ruta de `admin` se sigue saltando
  el gate. Aquí se exige que el llamante exista, no que la ruta le deje pasar. Medido con la sonda: hoy no
  lo hace ningún arnés (0 ficheros).
- Los 49 que montan `dist/app.js` entero se cuentan y no se juzgan: su rol lo pone el `requireAuth` real.
  47 no se pudieron observar corriendo.
- «Forma de sesión» se reconoce por la forma del literal. Una forma que el analizador no conozca cae en
  «carga un router y no le arma ningún req», que es lista cerrada: obliga a mirarla, no la juzga sola.
- El gate de cada arnés se decide por la ruta que NOMBRA. Si no nombra ninguna, se cuenta el router entero.

## Ⓘ Errores propios

1. **La primera versión del guard habría puesto en rojo a un PR ajeno.** Cerraba en lista todo fichero con
   un import de `dist/` que no se puede resolver leyendo. `exposicion.mjs` dio 1 expuesto, el #2051, por un
   test que no carga ningún router: solo tiene un `rutaDe(r)`. Corregido antes de empujar.
2. **Dos mutaciones salieron MUDAS en la primera pasada** (11 vivas de 13). En la M9, la fuente de prueba
   ejercitaba dos reglas del analizador a la vez y cada una tapaba a la otra. En la M10, la expectativa
   estaba mal declarada: el caso que esperaba no dependía de lo que mutaba.
3. **El guard se censó a sí mismo**: nombraba un router real y llevaba un literal con `userRole` dentro de
   una aserción. Lo cazó su propio caso ⑤ en la primera pasada.
4. **Un instrumento ciego leído como 23 rojos.** Un comparador dio «cambia» en los 23 con recuentos `null`
   y código 0: un carácter roto al pasar el guion por un heredoc de bash. Tres veces en la tanda.
5. **Una hora escrita a ojo** en dos mensajes al orquestador («~17:55Z» cuando GitHub marcaba antes).

6. **La sonda dejaba un temporal sin garantía de borrado.** `correr-sonda.mjs` usaba `mkdtempSync` con un
   `rmSync` al final; lo cazó `scrum864c` en la dirigida. Ahora usa `temporal()` de `tests/_temporal.mjs`.
   Tras ese cambio de una línea la sonda NO se ha vuelto a correr entera: solo se comprobó que carga.

## Ⓛ Qué se corrió antes de empujar, y qué no

**La tanda completa local NO se corrió**, por orden del orquestador: el arnés de esta máquina la mata (a
otra sesión, el mismo día, con 4.762 MB libres y ninguna otra suite en marcha). La tanda es el check
obligatorio del CI, que además prueba el merge y no este árbol.

| qué | resultado |
|---|---|
| `npm run tanda:dirigida` (237 ficheros de 1.193, elegidos por `scripts/tests-que-cubren.mjs`) | 2.240 tests · 2.230 pasan · 1 cae: `scrum864c`, por el error 6 de arriba |
| tras arreglarlo: `scrum864c`, `scrum237`, `scrum976`, `scrum622` y el guard de este ticket, a mano | 62 tests, 62 pasan |
| `npm run guards:entrada` | 12 guards, 132 tests, en verde |

La dirigida no se repitió entera después del arreglo: lo que cambió es una línea de un guion de evidencias,
y el único caso que la nombraba es el que se volvió a correr.

## Ⓙ Cómo se repite

    node --test tests/scrum1344-arnes-de-prueba-con-rol.test.mjs
    node docs/master/evidencias/scrum1344/correr-sonda.mjs despues
    node docs/master/evidencias/scrum1344/aserciones.mjs
    node docs/master/evidencias/scrum1344/migrados-igual-que-antes.mjs
    node docs/master/evidencias/scrum1344/mutar.mjs
    node docs/master/evidencias/scrum1344/exposicion.mjs

La sonda tarda unos diez minutos y corre los ficheros de uno en uno. `mutar.mjs` exige el árbol limpio.
`aserciones.mjs` y `migrados-igual-que-antes.mjs` comparan contra `origin/main` y dejan de tener sentido
cuando esto esté dentro: quedan como constancia de cómo se midió.

## Ⓚ Aceptación → dónde se ve

| aceptación (c.17973) | dónde se ve |
|---|---|
| A · el censo por AST, y ve a los que montan `dist/app.js` | `tests/_censo-arneses-de-router.mjs`; caso ③ de `tests/scrum1344-arnes-de-prueba-con-rol.test.mjs` |
| B · cuáles montan una ruta que hoy exige rol: dos cifras | la línea del caso ① y el caso ⑱; `docs/master/evidencias/scrum1344/antes.txt` |
| C · el rojo primero, enseñado corriendo | `docs/master/evidencias/scrum1344/antes.txt` |
| D · una sola forma de construir el `req` | `tests/_arnes-de-router.mjs`; casos ④, ⑤, ⑨, ⑩ y ⑪ |
| E · los que ya nombraban `userRole` siguen igual y ninguna aserción cambia | caso ⑥; `docs/master/evidencias/scrum1344/aserciones.mjs` |
| F · la línea que sale siempre, con su población | caso ① |
| condición añadida · lo que no se pudo mirar se cuenta aparte | casos ⑧ y ⑰ |
