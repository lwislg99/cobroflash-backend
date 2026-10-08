# SCRUM-1513 · El tope de plantillas contra un Postgres de verdad: NO aguanta — medido, sin arreglar nada

**Medido contra:** `origin/main` = `16e80dea496dad3819bf444983f9974d3c13ebb9` · 2026-10-08T07:58:26Z

A9: comprobación → `docs/master/evidencias/SCRUM-1513/tope-postgres.cjs`

J2 (relevo, sesión `jv-j2`, equipo de Javier), por encargo del orquestador (`cobroflash-backend-90`). **Es
EJECUCIÓN y LECTURA:** no se ha tocado ningún fichero de `src/`, test, plantilla, texto ni workflow. Entran este
registro y `docs/master/evidencias/SCRUM-1513/` (el guion y ocho salidas; de dos pasadas más, una en rojo a propósito y una con una sola conexión, hechas antes de añadir la sección 4, sólo quedan las cifras de la tabla). Nada contra producción ni staging.
El hook de arranque dijo «SIN IDENTIDAD» (SCRUM-1498); se siguió porque el encargo es medir.

Al escribir esto `origin/main` ya era `4f8c473da8a565fdb6f00316f7ef5b14be3c1f1c`. Entre los dos cambia UN fichero de
`src/` o `prisma/` (`src/modules/invoicing/domain/modoVisible.ts`), que no está en el camino medido. El `dist` se
compiló en `16e80dea4` con `tsc --noCheck`; no se corrió `prisma generate`.

## La respuesta a la parte ②

**El defecto es REAL. No es un artefacto de la base en memoria.** Contra PostgreSQL 16.13, con el tope en 100:

| caso | pool normal, 7 pasadas | una sola conexión, 2 pasadas | transporte con 150 ms, 1 pasada |
| --- | --- | --- | --- |
| L1 · 120 peticiones de 1 mensaje, seguidas | 100 y 20 bloqueadas (7 de 7) | 100 y 20 | 100 y 20 |
| **L2 · UNA petición con 120 mensajes** | **113, 115, 116, 117, 117, 117, 118** | **120 y 120** | **120** |
| **L3 · 120 peticiones a la vez** | **120 (7 de 7)** | **120 y 120** | **120** |
| L4 · 99 ya enviadas y una petición con 2 | 2 en 5 pasadas, 1 en 2 | 2 y 2 | 2 |
| L5 · 99 ya enviadas y una petición con 5 | 1, 1, 1, 2, 2, 2, 3 | 5 y 5 | 5 |

Lo que cambia respecto a SCRUM-1509f (c.18923), y son dos correcciones de signo contrario:

1. **El lote (L2) se confirma, con otra cifra.** En memoria salieron 120 de 120. En Postgres con el pool normal
   salen entre 113 y 118: se cuelan de 13 a 18 por encima del tope, nunca las 20. Las 120 exactas vuelven con una
   sola conexión o con un transporte que tarda.
2. **Lo simultáneo (L3) era el artefacto, y estaba del lado tranquilizador.** En memoria, 120 peticiones a la vez
   dieron 100 y 20 bloqueadas. En Postgres dan 120 y 0 bloqueadas, 10 de 10 pasadas. c.18923 ya avisaba de que esa
   fila no probaba nada porque la base contestaba al instante; aquí queda medido.

Mi predicción del lote, escrita en la cabecera del guion antes de correrlo, era «120 y 0 bloqueos». **Con el pool
normal no se cumplió en ninguna de las 7 pasadas.** Se cumple con una conexión y con latencia.

## En qué se apoya para colarse

Leído en `src/integrations/whatsapp.ts` y visto en la corrida:

- El tope es un `count` (`:376`). Después va la petición al proveedor. La fila que ese `count` cuenta la escribe
  `recordWaMessage` al final y **sin esperarla** (`:460`). Entre la pregunta y la fila no hay transacción ni cerrojo.
- El webhook lanza cada mensaje de la petición sin esperar al anterior (`whatsappIncoming.routes.ts:128-190`).
- **No es cosa del aislamiento de Postgres.** El servidor estaba en `read committed`; con UNA sola conexión, donde
  las consultas van estrictamente de una en una, el lote sale peor (120 de 120, las 120 preguntas contestan 0).
  Cada consulta ve lo que hay; lo que falla es que la decisión y la fila están en instantes distintos.
- Cuánto se cuela depende de cuánto tarda en escribirse la fila frente a las preguntas que quedan. Con el pool
  normal y un transporte instantáneo, 111 a 116 preguntas se contestaron antes de la primera fila. Con 150 ms de
  transporte, las 120. **Un proveedor real tarda, así que la cifra de producción se parece más a la columna de la
  derecha; eso es una inferencia mía, no una medición.**
- El mínimo que lo rompe: con 99 enviadas, una petición con 2 mensajes saca 2 (101 en el día) en 8 de 10 pasadas.

## Controles

15 casos por pasada, 11 con esperado; 0 no cuadran en las 8 pasadas buenas (las otras 2 son el rojo a propósito). 4.218 operaciones de Prisma observadas
por pasada.

| control | esperado | salió |
| --- | --- | --- |
| **¿Hablo con Postgres?** `version()`, base, host y puerto por una conexión `pg` aparte | PostgreSQL, loopback, base acabada en `_test`, el puerto que arranqué | `PostgreSQL 16.13`, `127.0.0.1`, `yaqu_tope_1513_test`, coincide |
| conexiones del cliente de Prisma vistas EN EL SERVIDOR | más de 0 | 2 al empezar, 13 tras L3 (1 con `--pool 1`) |
| la app usa ese cliente y no otro | el mismo objeto | el mismo (si no, sale 2) |
| esquema puesto | `whatsapp_messages` existe; una tabla inventada, no | 33 tablas, 1 y 0 |
| CERO: firma mala ×5 | 401, 0 avisos, 0 filas | 401×5, 0, 0 |
| CERO: número que no es cliente de nadie · cliente sin albarán | 0 avisos, 0 filas | 0 y 0 |
| **POSITIVO: 1 mensaje** | 1 aviso, 1 plantilla, **1 fila en Postgres** leída por la otra conexión | 1, 1, 1 |
| **POSITIVO del tope: 100 filas sembradas por SQL, fuera de Prisma, y 1 mensaje** | bloqueado; la pregunta contesta 100 | bloqueado, contesta 100 |
| BORDE: 99 sembradas y 1 mensaje | sale; la pregunta contesta 99 | sale, contesta 99 |
| plantillas pedidas al transporte = filas en Postgres, en cada caso | iguales | iguales en los 126 casos de las 10 pasadas |
| el guion esperando un aviso menos | rojo | salida 1, 3 casos en rojo de 15 |

El DDL sale de `prisma migrate diff --from-empty` sobre `prisma/schema.prisma` (35.482 B, 33 tablas); el generado
desde el esquema del cliente instalado da el mismo sha256, así que cliente y base coinciden.

## Parte ①, sólo medida: la baja (`handleOptOutRequest`, `whatsappIncoming.routes.ts:270-306`)

Repetido contra Postgres: la primera BAJA da 1 aviso; un cliente ya de baja que escribe BAJA 10 veces da 10 avisos,
10 plantillas y 10 textos de vuelta.

- **Filas que hay que consultar: las que la ruta YA lee.** La lectura de `:271` trae una fila por cada ficha de
  cliente con ese número (1 con un comercio, 2 con dos) y pide `id`, `merchantId` y `name`. **No pide `waOptOut`:
  0 de 13 lecturas.** No hace falta ninguna consulta más; falta una columna en una que ya existe.
- **Dónde: antes de `:284`.** Esa línea escribe la baja en todas las fichas; después ya no se distingue quién
  estaba de baja. La escritura tampoco lo dice: sobre un cliente ya de baja devuelve «1 fila tocada» igual.
- **La pregunta es por FICHA, no por número.** Medido (B3): cliente de dos comercios, de baja sólo en el primero,
  escribe BAJA una vez → 2 avisos, uno al comercio donde ya estaba de baja y otro al comercio donde la baja es
  nueva. Un «ya está de baja → no aviso» por número dejaría sin aviso al segundo.

No se propone código. Si un cliente de baja debe generar aviso, y si se le vuelve a contestar, lo decide el
fundador (reglas 28 y 39).

## Lo que NO medí

- **Postgres de producción ni de staging.** Es un servidor desechable en esta máquina (binarios oficiales 16.13 para
  Windows, del paquete `embedded-postgres` instalado en el temporal del trabajo, fuera del repositorio; CI usa
  `postgres:16-alpine`). Mismo motor y misma versión mayor; no la misma red ni la misma latencia hasta la base.
- **Si Meta agrupa de verdad 120 mensajes, ni 2, en una entrega.** Sigue sin juzgar, como en c.18923.
- **El proveedor real:** el transporte está doblado. La latencia de 150 ms es una cifra mía, una sola pasada.
- El tope por CLIENTE (3): mismo patrón en `:392`, leído y no ejecutado.
- Los otros llamadores de `sendWhatsAppTemplate`. Sólo el aviso al profesional por `:409` y por la baja.
- El tamaño real del pool en producción. Aquí 13 conexiones (12 núcleos); el resultado va de 113 a 120 según eso.
- Ninguna tanda completa: no hay cambio de código.

## Errores propios

- Predije 120 para el lote y con el pool normal no salió ninguna vez. La lectura del código daba la dirección, no
  la cifra.
- Tras la primera pasada tenía «L4 = 2» seis veces seguidas y lo iba a escribir como fijo; la séptima dio 1.
- Pasé dos veces un parche con barras invertidas por la consola y las dos se las comió. Lo delató `node --check`.
- Crucé los 200k de contexto sin avisar: lo medí a 254.410.

Reproducir: un Postgres desechable con `npm i embedded-postgres@16.13.0-beta.17` en una carpeta fuera del
repositorio, el DDL con `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`,
`tsc --noCheck`, y `node docs/master/evidencias/SCRUM-1513/tope-postgres.cjs dist <carpeta> <ddl.sql>`
(`--pool 1`, `--latencia 150`, `--esperado-menos-uno`).
