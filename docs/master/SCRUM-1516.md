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

---

## SCRUM-1516b · El censo de frontera entra en el obligatorio, con los conjuntos declarados y un trinquete

**Medido contra:** `origin/main` = `5b14238041a96466da2b2072d9a5bb0443e6a5e0` · 2026-10-19T07:20:59Z

A9: sin fallo que generalice — los dos rojos de este tramo (scrum1344 al mover el censo a `tests/`, y el veredicto que cambiaba con el `cwd`) los cazaron instrumentos antes de empujar, y los dos arreglos están en el código

19-oct-2026 · **S3** (equipo de Luis), por encargo de su orquestador (`cobroflash-backend-f3`, mensaje del 19-oct, que lo aprueba con una condición: «SIN el trinquete, no sirve»). Lo que faltaba de este ticket, en el «Lo que NO está hecho» de arriba: **«El censo no corre en CI ni lo lanza nadie por calendario.»** El ticket es del equipo de Javier; a su equipo lo avisa el orquestador, no esta sesión.

### Qué cambia

| fichero | qué |
|---|---|
| `tests/_censo-frontera.mjs` | es el censo, movido con `git mv` desde `docs/evidencias/scrum1390/censo-que-ve-el-tecnico.mjs.txt`. Con el `_` delante, `npm test` no lo coge como test. Dos cambios de instrumento, abajo |
| `tests/scrum1516b-frontera-en-el-obligatorio.test.mjs` | lo corre en los dos ejes y exige que lo que CRUZA y lo que NO-DISTINGUE sean EXACTAMENTE las rutas declaradas, cada una con su motivo; un suelo de población; y que el censo no esté mudo |
| `docs/master/SCRUM-1514.md:5`, `evidencias/SCRUM-1516/verlo-caer.mjs`, `la-moneda.mjs` | la ruta nueva del censo (una línea cada uno). Sin ella, `scrum1294` cae: la A9 de 1514 apuntaba al fichero viejo |

### Por qué el trinquete, y no «sale 0»

**El censo salió 0 con las dos fugas inyectadas** (rojos A y B, abajo): sus controles son los sembrados y la conducta correcta que ya conoce, y una ruta nueva que cruce no toca ninguno. Por eso el juicio es del test, por CONJUNTOS:

| eje | conjunto declarado hoy | si entra una | si sale una |
|---|---|---|---|
| comercio | CRUZA: `GET /admin/referral`, `GET /admin/billing/plans` (las dos globales a propósito, SCRUM-1514) | rojo: «filtra por `req.merchantId`, o decláralo con su motivo» | rojo: «quítala de la lista en este PR» (que no baje en silencio) |
| rol | NO-DISTINGUE: 6 rutas, una ACEPTADA (`actividad-equipo`, decisión «1-B» de SCRUM-1341) y cinco deuda o sin decidir (SCRUM-1390) | rojo | rojo |

Suelo de población: 78 rutas del rol y 194 del comercio, las del 19-oct sobre `397c772b`. **Lo que no ve, y lo imprime en cada pasada:** las NO-LLEGO (15 y 25), que acaban en 4xx/5xx sin consultar nada.

### Los dos cambios del instrumento, y que no mueven ningún veredicto

1. **El resultado dependía de DESDE DÓNDE se lanzara.** Por la mañana, lanzado desde el checkout compartido, `POST /admin/billing/accept-alcance` salía FILTRA; desde otra carpeta, NO-LLEGO (500 `legal_doc_missing`). La causa es que `readLegalDoc` fija `docs/legal` con el `cwd` AL IMPORTAR. Y `dotenv` lee el `.env` del `cwd`, así que desde un worktree con claves de base el censo se declaraba CIEGO. Ahora el censo pone el `cwd` en la raíz que mide y le quita a `dotenv` la lectura de ficheros antes de importar la app. Medido con `comparar-veredictos.mjs` (pares veredicto-ruta, no cuentas): rol idéntico 78 de 78; comercio, sólo esa ruta pasa de NO-LLEGO a FILTRA (`salida-comparar-cwd.txt`); y con el arreglo, la misma salida desde tres carpetas distintas.
2. **El `req` sale de `reqDeSesion`** (`tests/_arnes-de-router.mjs`, SCRUM-1344). En `tests/`, `scrum1344` acusaba al censo de armar un `req` de sesión sin rol: lo llevaba, pero dentro de un `...base`. Es el arreglo que pide el propio guard; el constructor se trae del árbol medido, porque los bancos de 1516 corren una copia del censo fuera del árbol. Veredictos idénticos: 78 de 78 y 194 de 194. `scrum1344` 27 de 27, y el censo queda en su clase «import de dist sin resolver, ningún `req` sin rol a la vista».

### El rojo primero (`evidencias/SCRUM-1516b/rojo-primero.ps1`, sobre `5d93b115`)

| inyección | test | por qué cae |
|---|---|---|
| A · `getExpense` sin `merchantId` en el `where` | 1 | `[comercio] CRUZA con rutas que NO están declaradas: GET /admin/expenses/:id` |
| B · `GET /admin/quotes/:id/pdf` sin la puerta del Técnico de SCRUM-1555 | 1 | `[rol] NO-DISTINGUE con rutas que NO están declaradas: GET /admin/quotes/:id/pdf` |
| C · una ruta declarada que no cruza | 1 | `declaradas en CRUZA que ya NO salen` |
| D · el suelo del rol a 79 | 1 | `el censo vio 78 rutas y el suelo es 79` |

Cada una con su `git diff --numstat` al lado (se aplicó), compilando entre A y B, revertidas con `git restore --source=HEAD` y el árbol limpio al final. Las salidas están en `rojo-*-test.txt`. El banco de mutaciones del censo (`verlo-caer.mjs`) sigue en 15 de 15 desde el sitio nuevo (`salida-verlo-caer-19oct.txt`).

### Coste y entorno

El test tarda ~5 s (cuatro lanzamientos del censo). Lanza el censo SIN las variables de base y de integración, con el mismo patrón que mira el censo: si las viera, se declararía CIEGO. Visto con `DATABASE_URL` y `WHATSAPP_ACCESS_TOKEN` puestos: el censo solo sale 2 y el test pasa 4 de 4. También sin `NODE_TEST_CONTEXT` ni `NODE_OPTIONS`.

### Lo que NO está hecho

- Las cinco rutas «deuda» del eje del rol siguen como estaban: este test impide que crezcan, no las arregla. `GET /admin/jobs/:id/ics` es el hallazgo aparte que SCRUM-1390 ya nombró (el Técnico baja el `.ics` de un Trabajo ajeno); es de servidor (S1) y no se toca aquí.
- Las NO-LLEGO no están medidas: una ruta que cruce y no llegue no la caza.
- La tanda completa no la he corrido. Lo corrido, en la entrega.
- `dist/` compilado con el cliente de Prisma compartido, que va por detrás del esquema (`activityKind`): tsc emite con errores de tipos. No regenero (⛔ de la tanda).
