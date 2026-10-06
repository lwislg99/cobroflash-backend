# SCRUM-1370 · `Job.totalAceptado` es la suma de lo aceptado y se escribe en cada aceptación

**Medido contra:** `origin/main` = `643e9a65a5756b9729c9f8d4b911ea0c536988b3` · 2026-10-02T13:26:18Z

A9: sin fallo que generalice — el único tropiezo fue una guarda inalcanzable que delató un mutante vivo, y se quitó en esta misma rama

Sesión S1 (`s1-2octc`, relevo de `s1-2octb`) · carril: `src/modules/jobs/**` · rama `scrum-1370-total-aceptado-es-la-suma`.

## El defecto

La columna sólo se escribía al CREAR el Trabajo desde una aceptación (`job.service.ts`, un único
escritor). `ensureJobForQuote` salía en `if (quote.jobId) return;`, así que un adicional aceptado, o
el presupuesto colgado de un Trabajo abierto sin presupuesto, no la tocaba. Reproducido ejecutando
por la sesión anterior (comentario 18113 del ticket).

La ficha no lo notaba (`dineroDelTrabajo` mira los presupuestos). Lo notan los que SUMAN la columna:
`metrics.service.ts`, `teamOverview.service.ts` y `exportData.ts`.

## Las decisiones, y de quién son

Las tres son del **orquestador, por mensaje entre sesiones el 2-oct-2026. No son una firma del fundador.**

| Pregunta del ticket | Decisión |
|---|---|
| ¿El original o la suma? | **La suma de lo aceptado.** El campo contesta «¿a cuánto se ha comprometido este cliente?» |
| ¿Escribir la columna o derivarla al leer? | **Se escribe en cada aceptación.** Un solo escritor; derivarla obligaría a cambiar tres lectores de otros carriles |
| ¿Y las filas que ya existen? | **Sin backfill.** Escribir sobre datos de dinero ya guardados es un STOP y no hace falta: no hay clientes reales |

## Cuántos Trabajos ven cambiar su cifra al desplegar

**0 por construcción, no por medición.** Sin backfill no se escribe ninguna fila al desplegar: una
cifra sólo cambia cuando ese Trabajo recibe su siguiente aceptación. La cuenta QA (comercio 46) no
contiene el caso —no tiene ningún Trabajo con presupuesto aceptado, SCRUM-1367—, así que medirla
habría dado un 0 que no significa nada.

**Pendiente de medir, y es otra cosa:** cuántos Trabajos tienen HOY un `totalAceptado` que no es la
suma de sus aceptados. No medido: la cookie de la cuenta QA caducó el 2-oct a las 13:18Z, y la base
de producción no es accesible desde ningún árbol (regla 3). No bloquea este arreglo.

## El arreglo

`src/modules/jobs/domain/job.service.ts`: `escribirTotalAceptado(jobId, merchantId)`. Suma los
presupuestos `accepted` del Trabajo (los de `quotesDelJob`, acotados por merchant) y escribe la
columna. La llama `ensureJobForQuote` en las dos salidas que antes no escribían: el presupuesto que
ya pertenece a un Trabajo, y el par anterior al backfill de SCRUM-195. El `create` no cambia: al
nacer hay un solo aceptado y su total es la suma.

Recalcula entera cada vez, como `recalcJobCobradoForJob`: la misma aceptación entregada dos veces no
suma dos veces. No toca el camino de emisión ni el esquema.

**Cambio visible, dicho:** la ficha lee «el guardado primero». En un Trabajo con importe guardado, al
aceptarse un adicional la ficha pasa a enseñar la suma como importe aceptado; antes enseñaba el
original y el adicional sólo aparecía en lo pendiente.

## Test — `tests/scrum1370-total-aceptado-es-la-suma.test.mjs` (14 casos)

`ensureJobForQuote` de `dist/` con una base en memoria con estado. Más el guard del escritor único,
por árbol de sintaxis sobre los ficheros de `src/`, con su control positivo.

| Mutante (sobre `dist`, comprobado que cambia el fichero) | Resultado (BASE 14/14) |
|---|---|
| lo de antes: con `jobId` sale sin escribir | 4 rojos |
| la suma no mira el estado | 6 rojos |
| la suma no mira el merchant | 6 rojos |
| el par legado adopta pero no escribe | 1 rojo |

Los dos de 6 rojos están inflados por la base de mentira: sin la clave en el `where` no devuelve
ninguna fila. Contra una base real cada uno lo cazaría un caso (el del borrador delante y el del otro
merchant).

**Error propio:** la primera versión llevaba una guarda «sin aceptados, no escribas» y su mutante
quedó VIVO: desde su único llamador siempre hay al menos un aceptado. Era código que ningún caso
podía alcanzar. Quitada; sin aceptados la suma es `null`, que es lo que la columna ya significa.

Vecinos corridos en local: `scrum195-pertenencia-por-job`, `scrum195-loop-adicional`, `scrum1274`,
`scrum1355`, `scrum52`, `scrum1344`.

## Lo que NO está hecho

- **Aceptación 1, a medias:** se entra por la función, no por `POST /quote/:token/decision`. Que los
  tres sitios que aceptan llaman a `ensureJobForQuote` se comprueba leyendo el código, no ejecutándolos.
- **Aceptación 4, no hecha:** no hay test sobre `getOperariosMetrics`. Usa `groupBy` con `_sum`; con
  una base de mentira mediría el doble y no la consulta.
- **Aceptación 5:** el recuento en producción, no medido (arriba).
- **No visto en yaqu.app.** Sin cookie, y la cuenta QA no tiene el caso (SCRUM-1367).
- **Dos aceptaciones del mismo Trabajo a la vez:** cada una lee y luego escribe, sin cerrojo. La que
  lee antes y escribe después puede dejar una suma sin la otra. Se corrige sola en la siguiente
  aceptación. Mismo límite que `recalcJobCobradoForJob`.
- **Un presupuesto que deja de estar aceptado** no hace bajar la columna: sólo se escribe al aceptar.
- `quoteDelPlan` (`dineroDelTrabajo.ts`) sigue exigiendo que el aceptado sea el primero. No se toca
  aquí: es el plan de cobro y lo mira el fundador.
- El comentario de `dineroDelTrabajo.ts` sobre `totalAceptado` («se congela al aceptar») ya no
  describe la columna entera. No se ha tocado ese fichero.

---

## Segunda tanda (2-oct) · las aceptaciones 1 y 4, por la ruta y en el informe

**Medido contra:** `origin/main` = `d19852d7844a03cc9b0c93acf6e13220409c07e5` · 2026-10-02T17:16:01Z

A9: aviso → cicatriz S1 «Un `git commit` que falla dentro de una orden encadenada no detiene el `git push` que va detrás: sube la rama sin el commit y no da error.» — no se pudo comprobar: es una orden tecleada en la consola de la sesión, no pasa por ningún guard

Sesión S1 (`s1-2octe`) · rama `scrum-1370b-aceptaciones-1-y-4`. **Sólo un test nuevo: ninguna línea de `src/` cambia.**

### Test — `tests/scrum1370b-por-la-ruta-y-en-el-informe.test.mjs` (7 casos)

Se entra por la PUERTA: el handler de `POST /quote/:token/decision` de `dist/`, con una base en memoria
con estado que comparten la ruta, `ensureJobForQuote` y `getOperariosMetrics`. El merchant es español
sin facturación (`receipt`), así que la ruta no entra en la emisión: el fichero sólo lee el camino.

| Aceptación | Caso | Cómo se ve |
|---|---|---|
| 1 | Trabajo directo + adicional que el cliente acepta por la ruta | la fila del Trabajo pasa de `NULL` a 121 |
| 2 | presupuesto sin Trabajo aceptado por la ruta (control) | nace el Trabajo con su total |
| 3 | el cliente RECHAZA por la ruta | la columna sigue `NULL` |
| 4 | el informe por operario, antes y después de aceptar | de 0 aceptado y pendiente −21 a 121 y pendiente 100; con original y adicional, de −100 a 150,50 |

| Mutante (sobre `dist`, comprobado que cambia el fichero) | Resultado (BASE 7/7) |
|---|---|
| lo de antes: con `jobId`, `ensureJobForQuote` sale sin escribir | 4 rojos |
| la ruta deja de llamar a `ensureJobForQuote` al aceptar | 5 rojos |
| el informe no lee la columna (aceptado = 0) | 3 rojos |
| el informe resta al revés | 3 rojos |

Restaurado: 7/7.

**Límite, dicho:** el `groupBy` es del doble (evalúa merchant y estado, agrupa por operario y suma). Esto
mide que el informe ENSEÑA lo que la aceptación ESCRIBIÓ; no mide el `groupBy` de Postgres. Y la
aceptación 3 por la ruta cubre el RECHAZO; borrador, enviado y caducado siguen cubiertos por la función
(primer fichero), porque por la ruta no se llega a ellos sin decidir.

**Pendiente de la primera tanda, saldado:** al escribir el primer fichero, el guard de SCRUM-1415 cazó en
local un `test()` con el nombre construido en un bucle; por eso sus cuatro casos de «sin aceptar» llevan
nombre literal.

### Aceptación 5 · el recuento en producción: NO MEDIBLE (no es 0)

Medido el 2-oct-2026 en yaqu.app (`eca8566d`), cuenta QA, sólo lectura: el merchant 46 tiene 1 Trabajo y
4 presupuestos, los cuatro en `draft`, ninguno aceptado. La cuenta no contiene el caso. Apuntado en SCRUM-1367.

### Lo que sigue sin hacer

- `teamOverview.service.ts` y `exportData.ts` suman la misma columna y no tienen caso propio aquí.
- Lo demás de «Lo que NO está hecho» de arriba, salvo las aceptaciones 1 y 4.