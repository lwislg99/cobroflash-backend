# SCRUM-1621 · Piezas de S5 que dejan abiertos tickets del equipo J: salida C en los `run()`, el veredicto del vigía de main y la edad de la tanda gateada en el latido, y la cita rota del vigía

**Medido contra:** `origin/main` = `f8ae969172dd142dc3390fae33cd91fc80fb0cee` · 2026-10-27T17:30:03Z

A9: comprobación → `tests/scrum1621-latido-vigia-de-main-y-tanda.test.mjs`

**Error propio (de la sesión anterior del puesto, recogido por ésta):** los dos commits de esta rama se escribieron
con `Set-Content`, y sus mensajes llevaban BOM delante de «SCRUM-1621». Como no estaban empujados, se rehicieron
con el mismo árbol y el mensaje sin BOM antes del primer push; no hay historia reescrita en el remoto.

S5 (automatización · CI). Ticket abierto por el orquestador del equipo J (cobroflash-backend-8b) por decisión del
fundador del 27-oct-2026. Rama `scrum-1621-piezas-de-s5`, sobre `1608087e6`; `main` va 20 commits delante y
ninguno toca los ficheros de esta rama (`git diff --stat 1608087e6 origin/main -- <los 7 ficheros>` vacío).

## Qué hay, pieza por pieza

| # | pieza | estado | dónde |
|---|---|---|---|
| 1 | Salida C: los hijos de `run()` cargan la tubería bloqueante | HECHA | `scripts/_trinquete-de-zona-hijo.mjs`, `scripts/censo-guards-gateados.mjs` · test `tests/scrum1621-los-hijos-heredan-la-tuberia.test.mjs` |
| 2 | El latido enseña el último veredicto del vigía de main (Issue #2641), su hora, y si el vigía sigue corriendo | HECHA | `scripts/equipo/latido.mjs`, sección «VIGÍA DE MAIN» · test `tests/scrum1621-latido-vigia-de-main-y-tanda.test.mjs` |
| 3 | La cabecera de `vigia-de-main.yml` cita un registro que existe y dice literal que su propio silencio no lo vigila nadie | HECHA | `.github/workflows/vigia-de-main.yml` · mismo test, caso ②③ |
| 4 | «N días sin verde» en el latido | HECHA LA PARTE SIN NÚMERO; **el umbral NO** | sección «TANDA GATEADA»; `UMBRAL_DIAS_SIN_VERDE = null`. Lo decide el fundador (SCRUM-1599 c.20713 ④) |
| 5 | C2: `scrum116` a una base propia | **NO HECHA · dueño por decidir** | no se ha tocado, por orden del orquestador. Ver «La medida del carril» abajo |
| 6 | Fugas de temporales | **NO HECHA · dueño por decidir** | ídem para `scrum1263` y `scrum454`. Y según J (c.21119) son **11 sitios**, no 2 |

## ① La salida C en los dos `run()`

Con `forceExit` el hijo sale con la cola de su informe sin escribir, y en Linux se pierde (SCRUM-1405 c.19584).
`meta-guard-mutaciones.mjs` ya cargaba `tuberia-bloqueante.mjs` (1339s); los otros dos `run()` del repo no. Ahora los
dos pasan `execArgv: [\`--import=<URL de tuberia-bloqueante.mjs>\`]`. Por URL, porque en Windows `--import=D:\…` no
vale. En `_trinquete-de-zona-hijo.mjs` se resuelve desde el propio fichero, no desde `raiz`: el módulo es del
instrumento, no del árbol que se mide.

Test 4/4; sus 2 mutaciones (quitar el `execArgv` de cada uno) mueren (medido por la sesión anterior, el 27-oct).

## ② y ③ · VIGÍA DE MAIN

`seccionVigiaDeMain` lee tres cosas con `gh`: las corridas de `vigia-de-main.yml`, el Issue «[vigía] main sin
verificar» y lo último que el vigía escribió en él. Y distingue:

- **Issue abierto** → alerta, con el recuento del último aviso y los commits nuevos que nombra.
- **Cerrado por el propio vigía** (su último texto es su cierre) → no es alerta, y lo dice con su recuento.
- **Cerrado a mano sobre un aviso**, o **abierto con el cierre escrito** → alerta las dos.
- **El vigía no corre** desde hace más de `HORAS_DE_VIGIA_DE_MAIN_CALLADO` (= 24 h + `UMBRAL_HORAS_DE_CRON`, la
  ventana de su propia red) → alerta: su silencio no es que `main` esté verificado.
- **Su última pasada terminada no tiene veredicto** (failure, cancelada) → alerta, con la hora de la última buena.
- **No pude mirar**: sin corridas, ninguna terminada, sin poder buscar el Issue, sin poder leer lo último, lo último no
  lo escribió el vigía, o su formato ha cambiado → `pudo: false`, salida 2. Y «no hay Issue» (se buscó y no existe)
  es un dato, no un ciego.

Los textos de prueba no se escriben a mano: los fabrica el propio motor del vigía (`cuerpoDelAviso`,
`accionDelIssue`). Si el vigía cambia lo que escribe, el test cae.

La cabecera del yml citaba `docs/master/SCRUM-1393c.md`, que no existe; ahora cita `SCRUM-1393.md`, tercer tramo, y
el test comprueba que cada registro citado en la cabecera existe y que el apartado sigue ahí. Lleva además la frase de
SCRUM-1324 c.17719: «ESTE VIGÍA ES UN CRON Y SU PROPIO SILENCIO NO LO VIGILA NADIE».

**Corrido contra GitHub** (`node scripts/equipo/latido.mjs`, hora de GitHub 17:31:39Z):

    🔴 VIGÍA DE MAIN · última pasada hace 0.9 h (success) · 8 en cola o corriendo · Issue #2641 abierto
       · el Issue #2641 está ABIERTO: main tiene commits SIN VERIFICAR. Último veredicto (2026-10-27T17:20Z, hace 0.3 h):
         «147 commits mirados · 0 rojos · 139 ciegos (sin verificar) · 0 corriendo · 0 sin leer · 8 verdes» ·
         ese aviso nombra 4 commit(s) nuevo(s): 4 CIEGO

## ④ · TANDA GATEADA (sin umbral)

El recibo de `_evidencia-tanda.mjs` es POR ÁRBOL. `fusionarRecibos` junta los de todos los árboles de la máquina: por
fichero gana el veredicto más nuevo, y el último verde más nuevo de cualquiera de ellos; el resultado no depende del
orden de lectura. `seccionTandaGateada` enseña cada fichero sin verde con su edad, lo peor primero (el que nunca tuvo
verde, luego por días).

🔴 **El umbral no está decidido.** Con `UMBRAL_DIAS_SIN_VERDE = null` la sección enseña las edades con ⚪, ninguna
avisa y nunca sale ✅; no cuenta para la salida. El test fija que la constante es `null`: quien ponga un número tiene
que citar el comentario del fundador y cambiar esa línea.

**Corrido hoy** (misma pasada):

    🔴 TANDA GATEADA · NO PUDE MIRAR: 1 recibo(s) en 269 árboles, 0 con desglose por fichero · última tanda gateada con
       recibo: 2026-07-30T10:53Z, hace 89 días · ningún recibo trae el desglose por fichero (son anteriores a SCRUM-1599g)

Es lo que hay: nadie ha corrido la tanda gateada con el recibo nuevo. Hasta que alguien lo haga, la sección sale
CIEGA, con cualquier umbral.

## Las mutaciones del latido, vistas caer

Base sin mutar: los dos tests juntos, **17/17, 0 saltados**. Luego cada mutación declarada en
`MUTACIONES_QUE_ME_TUMBAN`, inyectada sola sobre `scripts/equipo/latido.mjs` y restaurada con `git restore` antes de
la siguiente (árbol limpio comprobado tras cada una):

| mutación | cae | resto |
|---|---|---|
| el «no corre» nunca se cumple (`else if (false)`) | «② 🔴 un vigía que NO CORRE no se lee como «main verificado»» | 12 ✔ |
| sin `sinUmbral: true` | «④ 🔴 sin umbral: enseña la edad con ⚪, NINGUNA avisa, y no sale ✅» | 12 ✔ |
| la fusión se queda con el último árbol leído | «④ los recibos de varios árboles se juntan…» | 12 ✔ |

3 de 3 muertas, cada una en el caso que declara y sólo en él.

## La medida del carril de las piezas 5 y 6, y por qué no prueba lo que parecía

Las piezas 5 y 6 se apartaron de S5 porque `node scripts/carriles.mjs de` da, para `tests/scrum116-…`,
`tests/scrum1599f-…`, `tests/scrum1263-…` y `tests/scrum454-…`, «sin fila en §3: nadie lo reclama». Re-medido aquí
con un **control**: el mismo comando sobre `tests/scrum1621-latido-vigia-de-main-y-tanda.test.mjs` —el test de este
ticket, de S5 sin discusión— da **la misma frase**. Y sobre `scripts/equipo/latido.mjs` da S5
(`dos-equipos.md:166`): el instrumento funciona para rutas con patrón, pero no ve la fila que manda en `tests/`
(`dos-equipos.md:171`, «`tests/`: el test de un ticket → el puesto que trabaja el ticket»), que es una regla y no un
patrón. Así que «nadie lo reclama» sobre un test **no distingue** «no es de S5» de «es de quien trabaje el ticket».

No se han tocado: el orquestador lo decide con este dato.

## Lo que queda fuera

- El **umbral** de la pieza 4: lo decide el fundador.
- **Piezas 5 y 6**: dueño por decidir, con la medida de arriba.
