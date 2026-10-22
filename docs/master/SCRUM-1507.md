# SCRUM-1507 — la tarea programada del reintento de sellado (PR-2 de SCRUM-1404)

## SCRUM-1507c · el bloque de `cron.ts`, construido; la fecha de corte, DENEGADA por el control de permisos

**Medido contra:** `origin/main` = `75884928b170ec0ec02e35921426e5bd711cbb0f` · 2026-10-22T09:14:18Z (hora de GitHub)

J1 del equipo de Javier (sesión `jv-j1r`), por encargo del orquestador `cobroflash-backend-5f`.
**Carril, a mano (SCRUM-1506):** `src/core/cron/cron.ts` es de S1; lo escribe J1 con la conformidad
del dueño (c.19344 §4: «ese bloque y sólo ese bloque») y la decisión del fundador de cómo se
entrega (c.20220: opción 1). El cruce **todavía no está declarado** en `dos-equipos.md` §3.4: por
eso esta rama NO se empuja hasta que la S0 lo declare. La cerradura de carril no me paró al editar
`cron.ts` (lo esperado: SCRUM-1506).

### Qué lleva

| pieza | dónde | estado |
|---|---|---|
| la tarea, tal como la escribió S1 en c.19344 §3 | `src/core/cron/cron.ts` (el `import` y el bloque detrás del de «sellos de albarán») | HECHO, compilado con chequeo de tipos |
| su test, visto en ROJO antes de escribirla | `tests/scrum1507-el-cron-del-reintento.test.mjs` | 8 casos; contra `main` caen 7 de 8 (el que pasa es el control sembrado del lector) |
| las transiciones que los guards prescriben para «el PR que cablea» | `scrum1404b` ① (de «nadie importa» a «sólo `cron.ts`»), `scrum411` (tope 6 → 5), `_sin-consumir-declarados.json` (3 claves a `retiradas`), `_huerfanos-declarados.mjs` (+11 de `reintentoSellado.ts`, −`SELLADO_NO_APLICA`) | HECHO |
| **la fecha de corte** | `src/modules/invoicing/domain/reintentoSellado.ts:74`, `REINTENTO_ACTIVO_DESDE` | **NO HECHO: el control de permisos de Claude Code denegó la edición** («Production Deploy»), el mismo que paró a S1 en c.19344 §5. No lo he rodeado |
| la respuesta (el `catch` de las dos rutas del PDF) | — | fuera del GO de este encargo; c.18783 permite el reintento antes que la respuesta, no al revés |

### Lo corrido

* `tsc --noEmit` sobre el árbol: 17 errores, **ninguno en `cron.ts`**; los 17 son el cliente de Prisma
  compartido desfasado (`archivedAt` y similares; `_prisma-client-guard` lo nombra). Control: con
  `{ noOverlap: 7 }` inyectado salen 18 y el nuevo es `cron.ts:176` («number no es boolean»):
  el chequeo ve la opción con los tipos de `node-cron` 4.2.1.
* Dirigida de 14 ficheros (los de cron, `scrum1404b`, `scrum411`, `scrum1185`, `scrum1330`,
  `scrum1480e`, `scrum622`, `scrum237`, `scrum976`): **170 casos, 169 pasan, 1 cae, 0 saltan**.
  El que cae es `scrum1507` ④: la fecha sigue a `null`. Cae a propósito: el PR-2 no está completo
  sin ella.
* No corrida: la tanda completa. Ninguna base, ni producción ni staging.

### Qué enciende el reintento en producción, exactamente

Dos cosas, y las dos en `main` (Railway despliega desde `main`):

1. la tarea en `cron.ts` (este commit), que sin fecha corre cada minuto y contesta «inactivo»
   (c.19406 §1), con un aviso en el minuto 0 de cada hora;
2. **la fecha** en `REINTENTO_ACTIVO_DESDE`: un instante ISO en UTC copiado de la cabecera `Date:`
   de GitHub al escribirlo. Hoy la escritura la bloquea el permiso; la levanta el fundador (regla
   de permiso para esa edición, o escribirla él).

El merge del PR con las dos es el encendido. Premisa del GO (13-oct): «no hay facturas reales en
producción». **No la he medido** (el encargo lo prohíbe).

### Lo que no he medido

* Que PR-1 corre en producción: se deduce del despliegue automático desde `main` (mergeado el 8-oct).
* Cuántas réplicas corren los crons: `noOverlap` no protege entre procesos.
* `SCRUM-1404 c.18869 ②` (plazo derivado de la cadencia): con una pasada por minuto no cambia nada.

### De paso

* `tests/scrum929-el-total-del-borrador.test.mjs:189` cita `cron.ts:87` en un comentario; con el
  `import` nuevo esa línea pasa a ser la 89. Es un comentario, no lo lee nada; lo nombro y no lo toco
  (no es de mi carril).

Error mío: escribí el suelo de población de `retiradas` a ojo (>50) y había 39; lo cazó el propio
caso al correrlo, antes del commit.

A9: comprobación → `tests/scrum1404b-el-reintento-del-sellado.test.mjs`

## SCRUM-1507e · el PR-2 va SIN fecha: el caso ④ afirma «inactivo hasta que el fundador la escriba»

*(La letra «d» ya la usó la S0 para el cruce de §3.4: rama `scrum-1507d-cruce-del-cron`, PR #2660.
El encargo me la daba como «1507d»; la cazó el control del sufijo antes del empujón. Los dos
primeros commits de este tramo dicen «SCRUM-1507d» en su título: no los reescribo.)*

**Medido contra:** `origin/main` = `f02e48be2c66ae2e0dae8701401c8fcbc4fff14b` (traído a la rama con `git merge`) · 2026-10-22T09:50:46Z (hora de GitHub)

J1 del equipo de Javier (sesión `jv-j1s`, relevo de `jv-j1r`), por encargo del orquestador
`cobroflash-backend-5f`. **Carril, a mano (SCRUM-1506):** lo mismo que en 1507c; este tramo no toca
`cron.ts`, sólo tests y este registro. El hook de arranque dijo «SIN IDENTIDAD» (SCRUM-1498); sigo
por el encargo, que lo prevé.

**Decisión que lo mueve:** SCRUM-1507 c.20227 (el fundador, «Sí» a la opción (a)): el PR-2 va **sin
fecha** y encender el reintento —escribir `REINTENTO_ACTIVO_DESDE`— es un paso aparte suyo.

### Qué cambia

| pieza | antes (1507c) | ahora |
|---|---|---|
| `tests/scrum1507-el-cron-del-reintento.test.mjs` ④ | exigía la fecha puesta; caía a propósito | afirma `REINTENTO_ACTIVO_DESDE === null` y, con la constante REAL por el callback REAL (sólo la base doblada): minuto 7 calla, minuto 0 un `warn` «INACTIVO: sin fecha de corte», **0 consultas**. Control SEMBRADO: la misma pasada real con una fecha válida por parámetro consulta (≥ 1) y dice «nada que mirar» |
| `tests/scrum1404b-el-reintento-del-sellado.test.mjs` ① | comentario: «la fecha ya no es `null` en el fichero» | comentario corregido: ya no es cierto con c.20227. Ninguna aserción cambia |

**Lo que el caso NO puede:** distinguir una fecha firmada de una sin firmar. La firma vive en Jira y
el test no la ve; un registro escrito por quien pone la fecha no es su firma (A10). Así que afirma
`null` a secas: el día que el fundador encienda, ④ cae y se cambia **en el mismo PR que la fecha**,
citando su comentario. Que la fecha sea legible y no anterior al mecanismo ya lo sujeta `scrum1404b` ②.

### Lo corrido

* Base sin mutar: `scrum1507` 8 de 8; con `scrum1404b`, 25 de 25, 0 saltan.
* Dirigida de 16 ficheros tras traer `main` y recompilar (`tsc --noCheck`): los de 1507c más
  `scrum1295-carriles` y `scrum1058c` (nuevo en `main`, toca `src/`): **178 casos, 178 pasan, 0 caen,
  0 saltan** (los `ok` y `not ok` de primer nivel suman los 178 declarados).
* M1, una fecha escrita en el compilado (`dist/`, no `src/`): cae ④, y sólo ④, por la aserción del `null`.
* M2, la base doblada muda (no apunta las consultas): cae ④ por el control («0 consultas»): sin
  control que vea, el caso sale CIEGO, no verde.
* Ninguna base, ni producción ni staging. La tanda completa, no.

### El cruce, ya declarado

A las 09:44:56Z el PR #2660 de la S0 (c.20234) estaba OPEN y en `origin/main` =
`8ad167195af03cf4153337ccc1bf1b80d04c10f8` el `grep` de `cron` en `dos-equipos.md` daba 0 (control:
el mismo fichero, 39.891 B, sí tenía la §3.4 en su línea 235): commit local, sin empujar. #2660
mergeó a las 09:48:06Z; en `origin/main` = `f02e48be2c66ae2e0dae8701401c8fcbc4fff14b` la fila
`src/core/cron/cron.ts | J1 | … | SCRUM-1507` está en `dos-equipos.md:247`. Traído con `git merge`
(sin conflictos; ninguno de los 29 ficheros que cambió `main` es de esta rama: el mismo patrón ve
7 en el diff de la rama), y empujado una vez.

Error mío: la primera pasada de M1 la lancé con la ruta de la carpeta temporal sin comillas (lleva
un espacio): node no arrancó (`EPERM … 'C:\Users\Javier'`) y la restauración del compilado también
falló, dejando la fecha inyectada en `dist/`. Lo vi en la salida, lo restauré y lo comprobé por sha256
antes de seguir; las mutaciones buenas van en un guion con todas las rutas entre comillas.

A9: comprobación → `tests/scrum1507-el-cron-del-reintento.test.mjs`

## SCRUM-1507f · el `getMinutes()` del bloque, clasificado en el censo de fecha sin zona

**Medido contra:** `origin/main` = `808af5b4466d2649a1006d4c554d1f22e7eba47c` (traído a la rama con `git merge`) · 2026-10-22T10:18:39Z (hora de GitHub)

J1 del equipo de Javier (sesión `jv-j1v`, relevo de `jv-j1s`), por encargo del orquestador
`cobroflash-backend-5f`. **Carril, a mano (SCRUM-1506):** el único fichero que toca este tramo es
`scripts/_censo-fecha-sin-zona.mjs`, sin fila propia en `dos-equipos.md` §3.3: cae en la fila general
de `scripts/` (S0, censos). Es una entrada de `USO`, como la que añadió SCRUM-1522b (J2), y el propio
mensaje del trinquete pide que la clase la escriba quien mete la llamada. `cron.ts` no se toca: el
bloque es literal de S1 (c.19344 §3). El hook de arranque dijo «SIN IDENTIDAD» (SCRUM-1498).

**El rojo:** el obligatorio de `5502385e8` (job 119758521318, medido por el orquestador) cayó en 1 de
12.099: `SCRUM-1093h · 🔴 RATCHET`, con la fila nueva
`src/core/cron/cron.ts::startCronJobs (src/core/cron/cron.ts:170, getMinutes)`.

### La clase: AGREGADO, y por qué

`new Date().getMinutes() !== 0` sólo decide en qué minuto de cada hora el log dice «inactivo» o «nada
que mirar» (una línea por hora en vez de 1.440 al día, c.19344 §3 ③). Es el borde de una ventana
horaria de una línea de log del servidor, que no es de ningún comercio: no NUMERA, no GUARDA, no la
lee el cliente (no IMPRIME), no es un código (no REFERIDO).

¿Importa la zona? Medido con un guion que barre 2026 entero cada 7 minutos (75.086 instantes), un
proceso hijo por `TZ`: el minuto local sale igual que el de UTC en **0 de 75.086** con `UTC`,
`Europe/Madrid`, `Atlantic/Canary`, `America/Mexico_City` y `America/Bogota`. **Control positivo:**
`Asia/Kolkata` y `Asia/Kathmandu` (desfase de media hora y de 45 min) salen distintos en **75.086 de
75.086**. O sea, la zona sólo movería el minuto del latido en una zona de media hora, y ni así cambia
qué se avisa: sólo cuándo. Por eso no es STOP.

### Lo corrido

* Sin la entrada (el fichero de `HEAD`): `scrum1093h` cae en 1 de 21, el RATCHET, con esa misma fila.
  Con la entrada, 21 de 21. Restaurado y cotejado por sha256.
* Dirigida de 9 ficheros tras traer `main` y recompilar (`tsc --noCheck`): `scrum1093h`, `scrum1507`,
  `scrum1404b`, `scrum237`, `scrum976`, `scrum622`, `scrum267`, `scrum273`, `scrum1294`: **101 casos,
  101 pasan, 0 caen, 0 saltan.**
* No corrida: la tanda completa (la corre el obligatorio). Ninguna base.

**Lo que esta entrada NO sujeta:** la identidad es la función (`startCronJobs`), no la línea. Otra
llamada de la familia dentro de `startCronJobs` entraría ya como AGREGADO sin que nadie la mire. Es
cómo identifica el censo (SCRUM-710b) y no lo cambio aquí.

Error mío: la primera pasada de la medición de zonas la lancé con `TZ=Europe/Madrid` desde Git Bash, y
el control positivo (Kolkata) salió 0 distintos: la `TZ` con barra no llegaba al proceso (node la
imprimía `undefined`). Lo cazó el control, no yo; la buena va lanzada desde node, `env` a mano.

A9: comprobación → `tests/scrum1093h-censo-fecha-sin-zona.test.mjs`
