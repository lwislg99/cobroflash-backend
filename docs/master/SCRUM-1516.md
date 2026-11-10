# SCRUM-1516 · El censo de SCRUM-1390 siembra su positivo: ya no se lo pide prestado a un defecto del árbol

**Medido contra:** `origin/main` = `d47dad333d2c1ca5a763292e7f94c8433498a53d` · 2026-10-08T08:18:27Z

A9: comprobación → `docs/master/evidencias/SCRUM-1516/verlo-caer.mjs`

8-oct-2026 · **J4** (sesión `jv-j4`, equipo de Javier), por encargo del orquestador (`cobroflash-backend-90`).
[Escrito por J4. El encargo es la descripción de SCRUM-1516 más SCRUM-1514 c.18964 y c.18972, leídos en Jira.]

**Carril: SIN FILA, y se dice.** El censo es `docs/evidencias/scrum1390/censo-que-ve-el-tecnico.mjs.txt`.
No está en `scripts/`: está en `docs/evidencias/`, y `dos-equipos.md` (leído de `origin/main`, 30.994 B)
nombra `docs/evidencias` **0 veces** (positivo del recuento: `docs/master`, 2). Así que la regla de
SCRUM-1480 sobre «un fichero de `scripts/` sin fila» no le aplica por letra: lo que hay es un instrumento
de medida que vive como evidencia y que ninguna fila recoge. Por función sería de S3 (`dos-equipos.md:57`,
«bancos, sondas e instrumentos de medida», hoy en pausa). Lo escribió J4 en SCRUM-1390 y lo extendió J1 en
SCRUM-1514. Se toca porque el encargo lo pide. **Sin fila; por función sería S3; la pide el orquestador**
(su mensaje del 8-oct, tras esta entrega). No me la apropio.

Tres cosas en el árbol: ese fichero, este registro y `docs/master/evidencias/SCRUM-1516/`. **Ni una línea
de `src/`, `tests/`, `scripts/`, `prisma/` ni de ningún workflow.** Ninguna base tocada, 0 envíos reales.
El hook de arranque dijo «SIN IDENTIDAD… no construyas» (SCRUM-1498, carril de S5): se siguió, como manda
la ficha del día, y queda escrito.

## ① Lo que se ha visto pasar en `main`, sin fabricarlo

`#2315` (el arreglo de `resend-whatsapp`) entró en `main` a las 08:13:14Z, **con esta sesión ya abierta**.
Así que el «antes» y el «después» son dos `main` de verdad, con el censo de `main` byte a byte:

| árbol | eje del comercio | eje del rol |
| --- | --- | --- |
| `aa0b22acc` (antes de #2315) | sale **0** · `¿distingue el par? true` · `resend-whatsapp` CRUZA 200, 1 envío | sale **1** · `false` (3 de sus 4 negativos ya son RECORTA) |
| `d47dad333` (con #2315) | sale **1** · `¿distingue el par? false` · `resend-whatsapp` FILTRA 404 | sale **1** · `false` |

O sea: cuando el orquestador abrió el ticket, en `main` el censo del comercio todavía salía 0; el `false`
era de la rama de J1. Desde las 08:13Z es de `main`. Las salidas: `salida-censo-de-main-eje-*.txt`.

## ② Lo construido: el positivo lo monta el censo

El fichero monta, sobre la app ya cargada, rutas de mentira bajo `/admin/__sembrada-por-el-censo/`. No
existen en el producto. Las encuentra el MISMO recolector y pasan por el MISMO motor (`manosDe`,
`peticion`, `pedir`, Prisma doblado, veredicto), y luego se apartan: no son población ni entran en totales.

| eje | sembrada | tiene que decir |
| --- | --- | --- |
| comercio | `POST …/:id/cruza` · busca la factura sólo por `id` y escribe a su cliente | CRUZA, 200, 1 envío doblado |
| comercio | `POST …/:id/filtra` · la misma, con el comercio de la sesión en el `where` | FILTRA, 404, 0 envíos |
| rol | `GET …/no-distingue` · la misma consulta para los dos roles | NO-DISTINGUE |
| rol | `GET …/no-distingue-con-fecha` · la misma, con una fecha que no se repite nunca | NO-DISTINGUE (vigila el `canon`, ④) |
| rol | `GET …/recorta-en-la-consulta` · el rol cambia el `where` | RECORTA (pasada A) |
| rol | `GET …/:id/recorta-despues-de-leer` · al técnico se le niega el del compañero | RECORTA (pasada B) |

**Qué pasa con los controles que había. No se ha quitado ninguno sin sustituto, y se dice cuál cambia de papel:**

- Los que afirmaban un **DEFECTO** del producto (`resend-whatsapp` cruza; los cuatro «negativos» del rol)
  pasan a **testigos**: se imprimen con lo que dicen hoy y no se les exige nada. Su función la hace la sembrada.
- Los que afirman una **CONDUCTA CORRECTA** (`send-reminder` filtra; las cinco rutas que recortan) **se
  siguen exigiendo**, en línea aparte: si una cae, el censo sale 1 y dice que NO es que esté ciego, sino que
  una ruta del producto ha cambiado.
- **La regla, con las palabras del orquestador, que la asciende a norma: un control atado a un DEFECTO muere
  el día que alguien lo arregla; uno atado a CONDUCTA CORRECTA sobrevive.** Los primeros pasan a testigos
  —se imprimen, no se exigen—; los segundos se siguen exigiendo. Y el positivo, se siembra.
- Códigos de salida: **0** controles bien · **1** un control en falso · **2** CIEGO (no pudo medir, o le falta la siembra).

Sobre `d47dad333` el censo nuevo sale **0 en los dos ejes** (`salida-eje-rol.txt`, `salida-eje-comercio.txt`),
con los mismos totales que el viejo: rol 13 · 33 · 17 · 15 · 0, suma 78; comercio 2 · 0 · 1 · 159 · 4 · 25, suma 191.
**Las filas del producto no se han movido:** 0 líneas distintas de 267 (rol) y 0 de 209 (comercio), censo
viejo contra nuevo sobre el mismo árbol, con el rojo del comparador visto (`salida-comparar-filas.txt`).

## ③ El control de este trabajo: verlo caer

`verlo-caer.mjs` rompe el censo de una manera cada vez, en una copia fuera del árbol. **15 de 15 salen con
el código esperado, 0 sustituciones sin aplicar** (`salida-verlo-caer.txt`):

| qué se rompe | corridas | sale |
| --- | --- | --- |
| nada (control de cero del banco) | 2 | 0 |
| **se quita la siembra** (borrando el montaje, o con `--sin-sembrar`) | 4 | **2, «CIEGO: … no mido»**, sin imprimir tabla |
| la siembra está pero el motor no ve (doble que da todo por atado o nada, veredicto que no mira las sueltas, Meta que no apunta, firma constante, firma que nunca se repite, no mirar la negativa al técnico, el `canon` de antes, o alguien «arregla» la sembrada) | 9 | 1, control sembrado en `false` |

## ④ Segundo asunto: la «moneda» de `frequent-concepts`. Medida, y ARREGLADA en el censo con el GO del orquestador

**La moneda no la tira la ruta: la tira el censo.** La ruta pide los presupuestos de los últimos N días con
`new Date()`, que es lo que tiene que hacer. Quien falla es `canon`, que pretende cambiar las fechas por
`'FECHA'` y no cambia ninguna: `JSON.stringify` convierte la fecha en texto ANTES de llamar al sustituto.
Si entre la petición del admin y la del técnico cambia el milisegundo, las dos consultas «difieren» y la
fila sale RECORTA. J1 ya lo había escrito así en `docs/master/SCRUM-1514.md` (⑤.1); en el ticket se quedó
como «ruta no determinista». No es carril ajeno ni ruta de producto: es una línea del instrumento.

`la-moneda.mjs`, 12 corridas idénticas por manera sobre `d47dad333` (`salida-la-moneda.txt`):

| manera | filas que cambian de veredicto | `frequent-concepts` |
| --- | --- | --- |
| eje del rol, con el `canon` de antes | **1 de 78** | 9 NO-DISTINGUE · 3 RECORTA (1ª pasada) · 11 y 1 (2ª) |
| eje del rol, con el `canon` que lee las fechas (el de hoy) | **0 de 78** | 12 NO-DISTINGUE, las dos pasadas |
| eje del comercio | 0 de 191 | 12 FILTRA, las dos pasadas |

**Cuántas mediciones nuestras la incluyen:** un instrumento, en sus dos ejes. Sólo en el del rol le cambia
el veredicto, y arrastra dos cifras: `TOTALES` (13/33 o 12/34) y «quote: n de 18». Salidas guardadas con
esa fila: **1 del eje del rol** (la de SCRUM-1390: 20/26 y «14 de 18», que pudo salir 19/27 y «13 de 18») y
**5 del eje del comercio** (SCRUM-1514 ×2, SCRUM-1514b ×3), a las que no afecta. Registros que citan cifras
del eje del rol: 2 (`SCRUM-1390.md`, `SCRUM-1514.md`). El mismo `canon` roto en otros ficheros: **0**
(positivo de la búsqueda: 30 ficheros con `instanceof Date`).

Otras 3 filas del rol llevan fecha en la consulta (`metrics/actividad-equipo`, `precarga`,
`customers/:id/historial`) y salieron estables 12 de 12; con el `canon` que lee, **0 de 78** cambian su
veredicto más repetido: no hay ningún RECORTA falso escondido detrás de una fecha.

**Arreglado en el censo, después de la primera entrega (c.18981), con el GO del orquestador por mensaje**
(«¿Cambias la línea de `canon`? SÍ»). El motivo, suyo: no es relajar nada, es lo contrario; mientras
`canon` tire una moneda ninguna medición que pase por él es repetible. La ruta del producto NO se toca.
La primera pasada midió «qué pasaría» sustituyendo en la copia; la segunda es al revés: el fichero lleva ya
el `canon` que lee y la copia repone el de antes. `salida-la-moneda.txt` es la segunda.

Y el arreglo lleva su control SEMBRADO, para que no dependa de una moneda: `…/no-distingue-con-fecha` pide
con una fecha que avanza un milisegundo en cada petición. Con el `canon` de antes sale RECORTA **siempre**
(12 de 12 corridas salen 1, no una de cada cuatro); con el de hoy, NO-DISTINGUE. Es la fila 15 de `verlo-caer.mjs`.

## Lo que NO está hecho ni medido

- **El censo no corre en CI ni lo lanza nadie por calendario.** La siembra hace que no pueda dar verde
  estando ciego CUANDO alguien lo corra; no hace que alguien lo corra. Eso sigue siendo un aviso.
- La moneda se midió con 12 corridas por manera y pasada: «0 de 78» con el `canon` que lee son 24 corridas, no una prueba.
- La línea de detalle de `GET /admin/referral` (eje del comercio) lleva un sufijo al azar: su veredicto es
  estable, su texto no. El comparador lo normaliza; el censo no.
- Las 25 NO-LLEGO y las 4 SIN-CONSULTA del comercio siguen sin medir (SCRUM-1514). No se ha tocado.
- La tanda completa no se ha corrido: este cambio no toca `src/` ni `tests/`.

## Mis errores

- Lancé el cambio de árbol (traer los dos ficheros de la rama de J1 y reconstruir) encadenado tras un
  `git fetch` de una rama que ya no existía. Nada cambió y las corridas de detrás salieron igual de limpias:
  lo delató que el censo viejo siguiera diciendo CRUZA. Era la frase de A10 «una operación que no se ejecutó
  se lee exactamente igual que un éxito». Lo repetí sobre el `main` real, que ya traía el arreglo.
- Di por buena durante unos minutos la lectura «la ficha se equivoca: el positivo sigue vivo en `main`». Era
  cierto a las 08:04Z y dejó de serlo a las 08:13Z. Va con su hora en ①.

## SCRUM-1516c · El censo de frontera entra en el obligatorio, rehecho desde main

**Medido contra:** `origin/main` = `81f9c0dc7d100cf05765b2c7708ac2f31f70beb7` · 2026-10-26T15:43:29Z

A9: comprobación → `tests/scrum1516c-frontera-en-el-obligatorio.test.mjs`

26-oct-2026 · **J6** (sesión `jv-j6cf`, equipo de Javier), por encargo del orquestador (`cobroflash-backend-8b`)
con la decisión del fundador de SCRUM-1516 c.20861 («Sí, que J6 lo rehaga»). El hook de inicio dijo «SIN
IDENTIDAD» (SCRUM-1498): el puesto lo dice el encargo, no la carpeta. La base fue `289ca8946`; antes de
escribir esto se mezcló `origin/main` (21 commits, uno en `modelo303.routes.ts`) y se volvió a medir: los
veredictos de las 192 y las 78 rutas salen idénticos, ruta a ruta, antes y después del merge.

**Carril: SIN FILA, y va a S0.** `node scripts/carriles.mjs de` dice «sin fila en §3: nadie lo reclama» para
`tests/_censo-frontera.mjs` y para `tests/scrum1516c-frontera-en-el-obligatorio.test.mjs`. Este PR no toca
`dos-equipos.md` (es de S0): la fila la pide el orquestador.

**Lo de #2600 (1516b, cerrado sin entrar) se leyó como referencia y NO se mezcló.** Se rehízo a mano, y cada
número se midió otra vez sobre main.

### Qué cambia

| fichero | qué |
|---|---|
| `tests/_censo-frontera.mjs` | el censo, movido con `git mv` desde `docs/evidencias/scrum1390/censo-que-ve-el-tecnico.mjs.txt`. Con el `_` delante la tanda no lo coge como test |
| `tests/scrum1516c-frontera-en-el-obligatorio.test.mjs` | lo corre en los dos ejes y exige CONJUNTO contra CONJUNTO lo que CRUZA, lo que LEE-Y-NO-ACABA y lo que NO-DISTINGUE, cada ruta con su motivo; un suelo de población; que sin siembra diga CIEGO; y cinco mutaciones en `MUTACIONES_QUE_ME_TUMBAN` |
| `docs/master/SCRUM-1514.md:5` | su línea `A9: comprobación →` apuntaba a la ruta vieja; corregida en sitio (scrum1294 exige que la ruta exista) |
| `docs/master/evidencias/SCRUM-1516/verlo-caer.mjs`, `la-moneda.mjs` | leen el censo de su sitio nuevo. `verlo-caer` corrido contra él: 15 de 15 como se esperaba, 0 sin aplicar |
| `tests/scrum1514-el-reenvio-es-del-comercio.test.mjs:20` | un comentario que nombraba la ruta vieja |

**Cambios del instrumento** (los cuatro primeros ya los midió 1516b; aquí se re-aplicaron y se comprobó que no
mueven ningún veredicto: 192 de 192 y 78 de 78 rutas iguales que con el censo de main, comparadas con `diff`):
- el `req` sale de `reqDeSesion` (scrum1344); el comercio de los datos es el 71, no el 1 del DEMO (scrum409);
  los teléfonos, del rango imposible `340…` (scrum262); el envío sembrado va a `meta-simulado.invalid`, no
  al host de Meta (scrum124-r28);
- **`cwd` = la raíz medida y el `dotenv` de `loadEnv` sin ficheros.** El `chdir` trabaja: quitándolo,
  `POST /admin/billing/accept-alcance` pasa de FILTRA a NO-LLEGO (lo que midió 1516b);
- **se QUITA la línea que fijaba el modo de la app a desarrollo.** 1516b la conservaba y subió por ella el
  tope de scrum702 de 20 a 21. Medido aquí: sin fijar, en desarrollo y en producción las rutas salen con el
  mismo veredicto (1 corrida de cada). Sin la línea, scrum702 no se mueve; el test le quita esa variable
  al hijo (la fija en «sin poner», no la hereda).

### Lo medido sobre main

| eje | población (suelo) | lo que se juzga | conjunto |
|---|---|---|---|
| comercio | 192 | CRUZA 2 | `GET /admin/referral`, `GET /admin/billing/plans` (las dos de SCRUM-1514: cruzan sin ser fuga) |
| comercio | | LEE-Y-NO-ACABA 0 | vacío, declarado vacío |
| rol | 78 | NO-DISTINGUE 3 | `metrics/inicio`, `metrics/actividad-equipo`, `products/frequent-concepts` |

1516b declaraba 6 en NO-DISTINGUE el 19-oct; tres (`jobs/:id/ics` y las dos de albaranes) RECORTAN ya en main,
y por eso no están. La población del comercio era 194 entonces y es 192 hoy: no se copió, se midió.

**`frequent-concepts`: ya NO tira la moneda, y no se aparta.** 12 corridas idénticas del eje del rol: 12 de 12
con el mismo código, el mismo veredicto (NO-DISTINGUE), las mismas líneas de ruta y los mismos totales. Lo
arregló el `canon` de SCRUM-1516 (#2321, 8-oct), y la sembrada «con fecha» falla si vuelve. Se declara con
su motivo («sin decidir»), como las otras dos.

### El positivo sembrado, y verlo caer

Los dos ejes exigen, para salir 0, que sus rutas de mentira salgan como se sabe que son; el test además lee la
línea de controles sembrados del texto (segunda sonda, aparte del código de salida). Sin siembra, los dos ejes
salen 2 y dicen CIEGO, sin TOTALES; con el doble sordo, 1.

`docs/master/evidencias/SCRUM-1516/1516c/rojo-primero.mjs`, salida en `salida-rojo-primero.txt` (commit del árbol
entero antes de inyectar; árbol limpio al acabar). Base: 4 de 4. Cada mutación del catálogo, aplicada sola
(numstat 1/1), y lo que cae, con el motivo leído de la aserción:

| mutación | cae |
|---|---|
| el censo no monta la siembra del comercio | eje del COMERCIO («salió 2») y el de CIEGO («--doble-sordo … salió 2») |
| el doble da todo por atado | eje del COMERCIO («salió 1») |
| la sembrada que no distingue pasa a distinguir el rol | eje del ROL («salió 1») |
| `--sin-sembrar` deja de quitar la siembra | el de CIEGO («--sin-sembrar tenía que salir 2 … y salió 0») |
| **una ruta real** (`GET /admin/customers/:id`) deja de atar el comercio (`src/`, recompilado y restaurado) | eje del COMERCIO: **el censo sale 0** y cae el trinquete: «CRUZA con rutas que NO están declaradas: GET /admin/customers/:id» |

La última es la que prueba el trinquete y no sólo el código de salida.

### El entorno, y lo que el test hace con él

El censo sale CIEGO si ve variables de base o de integración. En un worktree anidado las ve aunque el entorno
venga limpio: `salida-quien-carga.txt` mide que no hay ninguna tras `loadEnv` y que aparecen tres
`DATABASE_URL_*` tras importar `prisma.js` (el cliente de Prisma carga el `.env` de junto a SU `node_modules`,
que es el del checkout compartido). En CI no hay `.env`. El test, si el censo sale CIEGO nombrando variables
que no venían de su entorno, lo relanza UNA vez con esas claves VACÍAS y lo dice en su salida. Vaciar sólo
puede quitar credenciales. Si sigue CIEGO, cae.

### Guards

Corridos aquí (22 ficheros, 202 casos): 1390b/e, 1397, 1514, 702, 237, 976, 824/824b, 836, 419, 700, 719, 1415,
124-r28, 262, 409, 480, 1344, 1387 y el nuevo. Primera pasada: 195 pasan, 6 saltados (gateados por banco
desechable: 1390e y 1397, corren en el CI), y 1 cae, scrum976 ④, porque `guards:entrada` incluye scrum1294 y
mi línea A9 de SCRUM-1514 llevaba una coletilla (error mío, abajo). Corregida, y segunda pasada con el
registro ya escrito y además 1294, 273 y 267 (25 ficheros, 226 casos): 220 pasan, **0 caen**, los mismos 6
saltados. `node scripts/meta-guard-mutaciones.mjs --solo-censo` sale 0 y lista la declaración nueva sobre
`customersAdmin.routes.ts` (modo censo: no ejecuta mutaciones; ésas las ejecutó el banco de arriba).

### Lo que NO está hecho ni medido

- **La tanda entera en local: NO CORRIDA** (encargo: diez sesiones y la cola de CI saturada). Hace de tanda el
  obligatorio del PR.
- El relanzamiento con claves vacías NO se ha visto en CI, porque allí no hay `.env`: se ha visto en local.
- El modo de la app se comparó con 1 corrida por valor, no con una tanda.
- Las 25 NO-LLEGO y las 4 SIN-CONSULTA del comercio siguen sin medir (SCRUM-1514). Lo que cruce y no llegue no
  lo caza este test, y lo dice en cada pasada.
- Los PDF que generan algunas rutas caen en `/storage` de la raíz (ignorado por git), como los de otros tests.

### Mis errores

- Escribí la línea `A9: comprobación →` de SCRUM-1514 con una coletilla detrás de la ruta. Lo cazó scrum1294
  dentro de `guards:entrada` (scrum976 ④) antes de empujar.
- En el banco del rojo conté las cruces del reporter sin cortar su resumen final, que las repite: «7 de 4». Es
  la cicatriz ③ de la ficha. Lo cazó la suma; corregido, «4 de 4». Y al cortar el resumen perdí el motivo de
  la aserción, que sólo se imprime ahí: lo vi vacío dos veces antes de leerlo de la salida entera.
- Guardé la salida de la sonda del `.env` con las claves ya vaciadas en mi propio shell (las había vaciado
  para medir): decía «ninguna» en los cuatro puntos, que es no medir. Repetida sin vaciar antes de comitear.
- Escribí una salida del banco DENTRO del árbol, y el banco la contó como suciedad (`EXIT=1`). Repetido con la
  salida fuera.
