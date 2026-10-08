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
SCRUM-1514. Se toca porque el encargo lo pide. **Falta la fila, y no me la apropio.**

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
| rol | `GET …/recorta-en-la-consulta` · el rol cambia el `where` | RECORTA (pasada A) |
| rol | `GET …/:id/recorta-despues-de-leer` · al técnico se le niega el del compañero | RECORTA (pasada B) |

**Qué pasa con los controles que había. No se ha quitado ninguno sin sustituto, y se dice cuál cambia de papel:**

- Los que afirmaban un **DEFECTO** del producto (`resend-whatsapp` cruza; los cuatro «negativos» del rol)
  pasan a **testigos**: se imprimen con lo que dicen hoy y no se les exige nada. Su función la hace la sembrada.
- Los que afirman una **CONDUCTA CORRECTA** (`send-reminder` filtra; las cinco rutas que recortan) **se
  siguen exigiendo**, en línea aparte: si una cae, el censo sale 1 y dice que NO es que esté ciego, sino que
  una ruta del producto ha cambiado. Esta separación es decisión mía de diseño: si no gusta, es una línea.
- Códigos de salida: **0** controles bien · **1** un control en falso · **2** CIEGO (no pudo medir, o le falta la siembra).

Sobre `d47dad333` el censo nuevo sale **0 en los dos ejes** (`salida-eje-rol.txt`, `salida-eje-comercio.txt`),
con los mismos totales que el viejo: rol 13 · 33 · 17 · 15 · 0, suma 78; comercio 2 · 0 · 1 · 159 · 4 · 25, suma 191.
**Las filas del producto no se han movido:** 0 líneas distintas de 267 (rol) y 0 de 209 (comercio), censo
viejo contra nuevo sobre el mismo árbol, con el rojo del comparador visto (`salida-comparar-filas.txt`).

## ③ El control de este trabajo: verlo caer

`verlo-caer.mjs` rompe el censo de una manera cada vez, en una copia fuera del árbol. **14 de 14 salen con
el código esperado, 0 sustituciones sin aplicar** (`salida-verlo-caer.txt`):

| qué se rompe | corridas | sale |
| --- | --- | --- |
| nada (control de cero del banco) | 2 | 0 |
| **se quita la siembra** (borrando el montaje, o con `--sin-sembrar`) | 4 | **2, «CIEGO: … no mido»**, sin imprimir tabla |
| la siembra está pero el motor no ve (doble que da todo por atado o nada, veredicto que no mira las sueltas, Meta que no apunta, firma constante, firma que nunca se repite, no mirar la negativa al técnico, o alguien «arregla» la sembrada) | 8 | 1, control sembrado en `false` |

## ④ Segundo asunto: la «moneda» de `frequent-concepts`. MEDICIÓN, y corrige la premisa

**La moneda no la tira la ruta: la tira el censo.** La ruta pide los presupuestos de los últimos N días con
`new Date()`, que es lo que tiene que hacer. Quien falla es `canon`, que pretende cambiar las fechas por
`'FECHA'` y no cambia ninguna: `JSON.stringify` convierte la fecha en texto ANTES de llamar al sustituto.
Si entre la petición del admin y la del técnico cambia el milisegundo, las dos consultas «difieren» y la
fila sale RECORTA. J1 ya lo había escrito así en `docs/master/SCRUM-1514.md` (⑤.1); en el ticket se quedó
como «ruta no determinista». No es carril ajeno ni ruta de producto: es una línea del instrumento.

`la-moneda.mjs`, 12 corridas idénticas por manera sobre `d47dad333` (`salida-la-moneda.txt`):

| manera | filas que cambian de veredicto | `frequent-concepts` |
| --- | --- | --- |
| eje del rol, tal cual | **1 de 78** | 9 NO-DISTINGUE · 3 RECORTA |
| eje del rol, con un `canon` que sí lee las fechas | **0 de 78** | 12 NO-DISTINGUE |
| eje del comercio, tal cual | 0 de 191 | 12 FILTRA |

**Cuántas mediciones nuestras la incluyen:** un instrumento, en sus dos ejes. Sólo en el del rol le cambia
el veredicto, y arrastra dos cifras: `TOTALES` (13/33 o 12/34) y «quote: n de 18». Salidas guardadas con
esa fila: **1 del eje del rol** (la de SCRUM-1390: 20/26 y «14 de 18», que pudo salir 19/27 y «13 de 18») y
**5 del eje del comercio** (SCRUM-1514 ×2, SCRUM-1514b ×3), a las que no afecta. Registros que citan cifras
del eje del rol: 2 (`SCRUM-1390.md`, `SCRUM-1514.md`). El mismo `canon` roto en otros ficheros: **0**
(positivo de la búsqueda: 30 ficheros con `instanceof Date`).

Otras 3 filas del rol llevan fecha en la consulta (`metrics/actividad-equipo`, `precarga`,
`customers/:id/historial`) y salieron estables 12 de 12; con el `canon` que lee, **0 de 78** cambian su
veredicto más repetido: no hay ningún RECORTA falso escondido detrás de una fecha.

**No lo he arreglado**, porque el encargo lo prohíbe. El arreglo es sustituir la línea de `canon` por la
que lleva `la-moneda.mjs` (`CANON_QUE_LEE`).

## Lo que NO está hecho ni medido

- **El censo no corre en CI ni lo lanza nadie por calendario.** La siembra hace que no pueda dar verde
  estando ciego CUANDO alguien lo corra; no hace que alguien lo corra. Eso sigue siendo un aviso.
- La moneda se midió con 12 corridas: «0 de 78» con el `canon` que lee es 0 en 36 corridas de rol, no una prueba.
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
