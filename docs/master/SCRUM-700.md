# SCRUM-700 · El censo de los filtros de comentarios, y el sitio único arreglado

**Medido contra:** `origin/main` = `2c161c38cfba4ad81479dd302a933412d496f58c` · 2026-09-04T12:41:16+02:00
**Medido en:** host `DESKTOP-T5MONF5` · rama `scrum-700-censo-filtros-de-comentario`

## PASO 0 (regla 39)

**No estaba arreglado.** `git log -S "soloEjecutable"` devuelve seis commits, todos de migraciones en
curso; el mismo comando con otra aguja (`referenciasDe`) también devuelve resultados, así que el
método no estaba ciego.

**Los números del título estaban desfasados y se remidieron**, como pedía el encargo. Decía «27
cortan y 31 encogen». Medido hoy, **ejecutando cada filtro**: **31 cortan** y **47 encogen**, sobre
**94** ficheros con filtro propio de **697**.

## El entregable: el censo clasificado

Está en `docs/CENSO_FILTROS_DE_COMENTARIO.md`. La clasificación **no se hizo mirando las regex**: se
extrajo cada una de su fichero y se aplicó a dos sondas —una con un `//` dentro de una cadena y
código vivo detrás, otra con un comentario al final de línea—.

**Y las dos clases no tienen la misma urgencia:** un filtro que ciega código **oculta una violación**;
uno que sólo encoge **hace ruido**, y el ruido se ve.

**El alcance real de la ceguera: 64 líneas en 28 ficheros** de `src/` y `public/` llevan un `://` en
código con más código detrás. El caso se eligió inequívoco a propósito —`://` nunca abre un
comentario—, así que el número no depende de saber detectar comentarios.

## Lo que se arregló: el sitio único

`soloEjecutable` **es lo que hace migrable todo lo demás**. Comprobarlo **contra el hecho y no contra
los filtros que sustituye** era obligatorio: si tuviera el mismo defecto, los 94 coincidirían con él
en el error y la comparación diría «de acuerdo». Nueve sondas, y **fallaba una**: no quitaba el
comentario al final de una línea con código — justo el caso que este helper existe para cerrar, el
que mordió cuatro veces. Ahora recorre el fuente carácter a carácter llevando la cuenta de las
cadenas, y pasan las nueve.

**Su documentación era peor que su código:** decía «no distingue un `//` dentro de un string», que es
un riesgo que **no tenía** —sólo borraba líneas enteras—, y **no decía** el hueco que sí tenía.

**Control negativo, el que exigía el encargo:** la suite entera en verde. Los **34** guards que ya
colgaban del helper siguen mordiendo con la versión estricta; ninguno se quedó mudo.

## 🔴 Un hallazgo que afecta a mi propio trabajo de ayer

**`ts.createScanner` a pelo NO sirve para censar comentarios.** Medido: ve **148 de los 352**
comentarios de `src/app.ts`, porque sin contexto no sabe si un `/` abre una expresión regular o
divide. Un parse completo (`ts.createSourceFile`) ve 395.

Lo usan `tests/scrum387-procedencia-aprobacion.test.mjs` y **mi propio
`tests/scrum709-microcopy-por-fichero.test.mjs`**, cuyo control positivo de citas se apoya en esa
técnica: su cobertura es menor de lo que su mensaje afirma. Se reporta, no se arregla aquí — el de
SCRUM-387 es carril ajeno (regla 9) y el mío merece su ticket.

## El corte del alcance, dicho por su nombre

**Se entrega el censo completo y el sitio único arreglado. NO se migraron los 31.** El orden es
deliberado: migrarlos antes de arreglar `soloEjecutable` habría cambiado un defecto por otro —el
helper dejaba pasar los comentarios finales—, y esa comparación habría dado «de acuerdo» sin que
nadie lo notara. Con el helper ya correcto y el trinquete puesto, la migración es mecánica y
verificable. Los **47 que sólo encogen** pueden esperar: hacen ruido, no silencio.

**El trinquete**: el número de filtros que ciegan **no puede subir**, y si baja obliga a anotarlo.
