# SCRUM-1218 · DECLARACIÓN REESCRITA — el abort de libuv de SCRUM-1204 sigue vivo, el criterio de disparo SE HA CUMPLIDO, y la población no son «40»: el censo no seguía los imports

**Medido contra:** `origin/main` = `ee0687fd91c09561a46953f309f8c44310340c58` · 2026-09-28T21:22:07Z

J6 (jv-j6), por encargo del orquestador del equipo de Javier. Windows 11 · Node `v24.18.0`.
**Es una declaración, no una migración: no se ha tocado ningún test ni ningún banco.**
La declaración original vive en la descripción del ticket, escrita el mismo 28-sep sobre `29b492b0`.
Esto la sustituye.

## 1 · El arreglo de SCRUM-1204 sólo tocó `scrum910d`; el mecanismo sigue vivo

El commit del arreglo (`305d5c4f`) cambia **dos ficheros**: `tests/scrum910d-microcopy-recibo-pendiente.test.mjs`
y `docs/master/SCRUM-1204.md`. No toca `fetch`, ni `npm test`, ni ninguna bandera. La causa —el tier-up de
WebAssembly de V8 sobre el `llhttp` de `fetch` (undici), que termina mientras `--test-force-exit` cierra el
proceso— sigue en todos los demás.

**La prueba es `scrum1216b-numero-de-arranque`**, que abortó en una tanda entera el 28-sep (SCRUM-1244, tanda
T11) con la firma exacta:

    Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 94

y el fichero salió `'test failed'` sin ningún subtest caído. Solo, 20 pasadas:

| cómo | abort de libuv | limpio |
| --- | --- | --- |
| `--test-force-exit` | **2/20** | 18 |
| `--test-force-exit --no-wasm-dynamic-tiering` | 0/20 | 20 |
| sin bandera | 0/20 | 20 |

La bandera de wasm lo apaga: es el mismo mecanismo que 910d, no otro.

## 2 · 🔴 El criterio de disparo SE HA CUMPLIDO

El criterio decía «si cae un segundo fichero **de los 40**». `scrum1216b` no estaba en la lista, y por la
letra no se cumpliría. **Se declara cumplido por la intención**, por decisión del orquestador: acogerse a la
letra cuando un segundo fichero aborta con la firma exacta sería ensanchar la lista para que la declaración
no salte, que es justo lo que una declaración con criterio de disparo existe para impedir.

**Y aun así no se migra todavía**, y el motivo es el punto 3: la lista sobre la que se migraría estaba incompleta.

## 3 · El censo no seguía los imports: la población no eran 40

El censo de SCRUM-1204 miraba cada `tests/*.test.mjs` por separado. `scrum1216b` no llama a `fetch` ni a
`listen(0)`: lo hace `tests/_banco-camino-real.mjs`, que el test importa. **El censo estaba ciego a esa forma.**

Censo nuevo, `docs/master/evidencias/SCRUM-1218/censo-con-imports.mjs`: por AST, sin contar comentarios ni
cadenas, siguiendo transitivamente los imports relativos (estáticos, `export … from` e `import('…')`).

| | ficheros |
| --- | --- |
| población `tests/*.test.mjs` | 1.072 (0 ciegos) |
| con `fetch()` y `.listen(0)` en su proceso | **42** |
| · en el propio fichero | 40 (los mismos 40 de la declaración original, comparados como conjunto) |
| · sólo a través de imports | **2**: `scrum1216b` y `scrum597-asignar-usuario-al-documento`, los dos por `_banco-camino-real.mjs` |

`scrum597`, 20 pasadas: 0/20 con `--test-force-exit` y 0/20 con la bandera de wasm (latente, no reproducido).

⚠️ **42 es lo que este censo ve, no la población cerrada.** No sigue lo que un test carga de `dist/` ni de
`node_modules`, ni rutas calculadas, ni un `fetch` llamado por otro nombre (`globalThis.fetch`,
`const f = fetch`), ni procesos hijos. Cualquiera de esas formas sería otro ciego del mismo tipo.

*(Corrección propia: en el aviso al orquestador escribí que «importan el banco 4 tests». Eran 2. Los otros
dos, `scrum702` y `scrum888d`, sólo lo nombran en comentarios y cadenas. Aquel recuento fue un `grep` de
texto; éste es por AST.)*

## 4 · El control positivo estaba CADUCADO; el nuevo puede fallar

El control del censo original era «`scrum910d` sale». Hoy sale **NO**, y es correcto, porque ya se migró.
Un control que ya no puede cumplirse no controla nada. Controles nuevos del censo:

| control | esperado | hoy |
| --- | --- | --- |
| POSITIVO por import: `scrum1216b` | SÍ | ✅ SÍ |
| POSITIVO directo: `albaran` | SÍ | ✅ SÍ |
| NEGATIVO: `scrum910d` (migrado) | NO | ✅ NO |
| NEGATIVO: `scrum1107b-rutas-garantia` (`node:http`) | NO | ✅ NO |

Cada control exige además que su fichero **exista** en la población. Si no existe, el control falla como
«en vacío». La primera versión de este censo tenía un negativo que se cumplía sobre un nombre de fichero
que no existía; así se cazó.

**Visto en rojo, con el censo commiteado (`ea22be65`) y restaurado después con `git restore --source=HEAD`:**

- **M-a · que el censo no siga los imports** (`numstat` 1/1): reproduce exactamente el censo viejo (40, 0 por
  import) y **cae** en el positivo de `scrum1216b`, con salida 1.
- **M-b · un control sobre un fichero que no existe** (`numstat` 2/2): **cae** como «en vacío», con salida 1.

## 5 · 🔴 El criterio de disparo NUEVO — por la firma, no por una lista

> **Cualquier fichero** de `tests/` que termine `'test failed'` sin ningún subtest caído y con
> `UV_HANDLE_CLOSING` / `src\win\async.c` en su salida es este defecto. **Esté o no esté en ningún censo.**
> Si cae uno, no se discute si «es de la lista»: se registra aquí (fichero, fecha, tanda) y se avisa al
> orquestador.

Y si un fichero cae y el censo no lo ve, **el que ha fallado es el censo**, como con `scrum1216b`: se
corrige el censo antes de seguir.

Antes de migrar nada, cada fichero se reproduce **solo, con `--test-force-exit` y 20 pasadas**. El arreglo
se mide igual: **0/20 con la bandera puesta**. «5/5 sin bandera» no mide nada.

## 6 · Lo que queda por decidir (NO es de J6)

- **Si se migra, y qué.** Dos de los 42 dependen de un solo sitio, `tests/_banco-camino-real.mjs`, que es de
  la S3 (equipo de Luis). Lo lleva el orquestador con esta medición. **J6 no lo toca.**
- **Linux/CI:** sin medir si allí cae. Si no cae, el verde de CI nunca lo cazaría.

## ⛔ Lo que sigue sin ser arreglo

- **Quitar** `--test-force-exit`: SCRUM-556 midió `scrum334` cayendo también sin ella.
- **Meter** `--no-wasm-dynamic-tiering` en `npm test`: relaja el instrumento de toda la tanda por una clase
  de ficheros.
- **Listas de excepciones o saltos:** regla 41.

## Reproducir

    node docs/master/evidencias/SCRUM-1218/censo-con-imports.mjs     # sale 0 con los 4 controles en verde

## J6 · SCRUM-1218b · el censo de `scrum560` ve el `fetch` a través de una llamada, y dos tests migrados

**Medido contra:** `origin/main` = `1e00b1b9d9ed144295527fa41b5aa2de60c1cc81` · 2026-10-21T12:53:53Z (sesión J6 `jv-j6o`, por encargo del orquestador `cobroflash-backend-5f`; el disparo está en c.20156)

A9: comprobación → `tests/scrum560-patron-fetch-servidor.test.mjs`

Carril: J6. **`scrum910` es de J2 (`area-j2`): carril J2 cruzado a mano, autorizado por el orquestador
`cobroflash-backend-5f`, SCRUM-1218 c.20156, y sólo para migrar su `fetch` a `node:http`.**

### ① El censo tenía DOS ciegos, no uno

El caso de SCRUM-1456c (`ce0d607f`, murió al salir con `0xC0000409` y sus 10 casos en verde) no lo veía
`enPatronPeligroso` por dos sitios:

1. **el servidor** se buscaba por el TEXTO `app.listen(0)`, y 1456c escribía `app.listen(0, '127.0.0.1', …)`;
2. **el `fetch`** se buscaba dentro del bucle, y en 1456c estaba en `const emitir = async () => {…}`, a la
   que el bucle llama.

El c.20156 nombraba sólo el segundo. El primero lo vi al leer 1456c: aun con la llamada seguida, se le habría
escapado. Ahora, por AST: el servidor es cualquier llamada `<x>.listen(0, …)` del código (no de los
comentarios), y cada llamada a una función con nombre del propio fichero cuenta los `fetch` de esa función
**en el sitio desde el que se la llama**, con el «en bucle» de ese sitio.

**Siembra:** el censo escribe en cada pasada un fichero con la forma de 1456c a un temporal fuera del árbol, lo
lee por el mismo camino que `tests/`, y si no sale dice **CIEGO**. Visto en rojo con el censo commiteado
(`21f07af1ed70d84545e99f7423b53346fb6ede5c`), cada mutación con su `numstat` y deshecha con el editor
(`git status --porcelain` vacío después):

| mutación | `numstat` | resultado |
| --- | --- | --- |
| quitar la escritura de la siembra | 0/1 | ③ y ④ caen con «🔴 CIEGO: la siembra…» (④ estaba en verde) |
| quitar el seguimiento de la llamada | 0/1 | cae la autoprueba («no ve el `fetch` a través de la llamada») y ③ y ④ con CIEGO |

⚠️ **Sigue ciego a:** funciones importadas de otro fichero (eso lo mira `censo-con-imports.mjs`, de arriba),
métodos (`obj.pedir()`), `fetch` por otro nombre (`globalThis.fetch`, `const f = fetch`) y procesos hijos.

### ② La cuenta, con el censo arreglado

Población: **1.426** `tests/*.test.mjs`. Detector viejo **20**, nuevo **42**: 22 que no veía, 0 perdidos
(11 por el `listen(0, host, cb)`, 11 por la llamada). Dueño de cada uno por la etiqueta de Jira de su ticket
(fila «el test de un ticket» de `dos-equipos.md` §3; `carriles.mjs de` dice «nadie lo reclama» para todos):

| grupo | ficheros | qué se hace |
| --- | --- | --- |
| `equipo-luis` | `scrum1188d` (area-s2), `scrum1489` (area-s1), `scrum912` (area-s1) | se listan y se le avisan; **no se tocan** |
| `equipo-javier`, corren sin base | `scrum910` (area-j2) | **migrado** |
| sin etiqueta de equipo, corren sin base | `scrum893` | **migrado** |
| `equipo-javier`, piden `LIBRO_PG_URL` | `scrum1346`, `scrum1397`, `scrum1403` (area-j2) | **pendientes**: sin Postgres en esta máquina (5432 rechazado), sus casos salen SKIP; sólo se miden en el check obligatorio |
| sin etiqueta, gateados por `QA_DB_TEST` / `BOT_SUITE_TEST` | los 34 restantes de la lista (3 + 3 + 34 = los 40) | **pendientes**: sus veredictos sólo se miden en staging, que esta sesión no toca |

Los 40 que quedan son la lista `CON_EL_PATRON_YA`, **recalculada con el censo** (regla 41), no elegida.

### ③ Los dos migrados: mismos casos, mismos veredictos

`fetch(…, { redirect: 'manual' })` → `http.request(…, { agent: false })`, que tampoco sigue redirecciones.
Antes y después, cada uno solo con `--test-force-exit`, nombres de nivel superior del TAP comparados como
CONJUNTO (`diff` vacío) y sumando el total que el TAP declara:

| fichero | antes | después |
| --- | --- | --- |
| `scrum893-solo-lo-que-puede-cobrar` | 8 casos · 8 ok · salida 0 | 8 · 8 ok · salida 0 |
| `scrum910-la-transferencia-que-no-mira` | 5 casos · 5 ok · salida 0 | 5 · 5 ok · salida 0 |

`scrum560` + `scrum237` + `scrum976`: 23 casos, 23 ok.

⚠️ **Sin medir:** las 20 pasadas por fichero con `--test-force-exit` del §5. Ninguno de los dos tenía un aborto
registrado, así que «0/20 después» no habría separado nada de «0/20 antes»; no lo he corrido.

*(Corrección propia: al sacar la lista de los 42 parcheé mi sonda con `sed` y la dejé sin compilar, que es la
cicatriz de J6 del 14-oct repetida. Fue en un temporal, no en el árbol; la rehice con la herramienta de escritura.)*

## J6 · SCRUM-1218c · los tres de J2 que piden `LIBRO_PG_URL`, migrados y medidos con un Postgres desechable

**Medido contra:** `origin/main` = `1ad1968523fed7c2ffb833d5a3feafe4dd1c79f8` · 2026-10-23T03:19:23Z (hora de GitHub al acabar las pasadas; sesión J6 `jv-j6ag`, por encargo del orquestador `cobroflash-backend-62`; el disparo está en c.20156)

A9: comprobación → `scripts/_prisma-client-guard.mjs`

Carril: J6. **Los tres ficheros son de J2 (`area-j2`): carril J2 cruzado a mano, por el encargo del
orquestador `cobroflash-backend-62` (el que dejó pendientes el tramo 1218b), y sólo para migrar su `fetch`
a `node:http`.**

### ① Lo que se ha cambiado

En `scrum1346`, `scrum1397` y `scrum1403`, la función `pedir` pasa de `fetch` a `http.request(…, { agent: false })`.
Lo demás del fichero no se toca. Un JSON que no se puede leer sigue dando `null`, como el `.catch(() => null)`
de antes. `fetch` seguía redirecciones y `node:http` no; por eso se mide también del lado del servidor (②).
`CON_EL_PATRON_YA` de `scrum560` baja de **40 a 37**: lo **recalculó el censo**, que en rojo nombraba
exactamente esos tres («✅ ESTOS YA NO USAN `fetch` SOBRE SU SERVIDOR»). No se eligió.

### ② El banco: mismos casos, mismos veredictos, mismas respuestas

En esta máquina no hay Postgres (ni servicio en 5432 ni `C:\Program Files\PostgreSQL`), así que se usó PGlite
0.5.11 con pglite-socket 0.2.14 en loopback. Están instalados en el tmp del puesto, fuera del repo. La base se
llama `yaqu_libro_test`, y el guard de los tests la acepta sin tocarlo. El esquema sale de
`prisma migrate diff --from-empty` (33 `CREATE TABLE`, uno por `model`).

Cada pasada usa un PGlite NUEVO y corre `node --test --test-force-exit` con el fichero solo. El TAP va a un
fichero y los casos se cuentan anclados al inicio de línea. Una sonda precargada con `--import` anota, del lado del
SERVIDOR, el método, la ruta y el status de cada respuesta. El servidor no cambia, así que la lista tiene que
salir igual, y una redirección que `fetch` seguía saldría como una petición de más en el ANTES.

| fichero | casos (0 SKIP) | respuestas por pasada | antes: pasadas limpias / abortos | después | casos y respuestas, como conjunto |
| --- | --- | --- | --- | --- | --- |
| `scrum1346-el-tecnico-ve-documentos-ajenos` | 5 · 5 ok | 46 | 20 / 0 | 20 / 0 | IGUAL · 1 variante en las 40 pasadas |
| `scrum1397-el-tecnico-ve-sus-facturas` | 5 · 5 ok | 106 | 20 / 0 | 20 / 0 | IGUAL · 1 variante |
| `scrum1403-el-tecnico-y-las-otras-puertas` | 6 · 6 ok | 67 | 20 / 0 | 20 / 0 | IGUAL · 1 variante |

Por status, en la pasada 0 del ANTES de los tres: 186 de 200, 6 de 400 y 27 de 404. **Ningún 3xx.**

Los controles de los instrumentos, vistos:
- **El comparador** lleva un control SEMBRADO: una copia del ANTES con un veredicto cambiado y un `302` de más.
  Salió DISTINTO en las dos patas de los tres ficheros (VIVO).
- **Mutación del arreglo:** con `pedir` devolviendo el cuerpo a `null`, caen 3 de 5, 2 de 5 y 3 de 6 casos.
  Los casos leen el cuerpo que trae `node:http`, y no pasan en vacío. La mutación se deshizo con el editor.
- **El banco sin argumentos dice CIEGO**, no verde. Lo vi por un error mío (abajo).

`scrum560`: 4 de 4 en verde con la lista en 37. Antes de quitarlos de la lista, 3 de 4.

Banco, comparador, sonda y la salida del comparador: `docs/master/evidencias/SCRUM-1218/`. Van como `.mjs.txt`
para no dejar en el árbol piezas sin consumidor. Para correrlos, se copian a un directorio con
`@electric-sql/pglite` y `@electric-sql/pglite-socket` y se les quita el `.txt`.

⚠️ **Sin medir:** Linux/CI con las 20 pasadas (en el check obligatorio estos tres corren con el Postgres del
runner, una vez). Y lo mismo que en 893/910: **ninguno de los tres tenía un aborto registrado, y antes salió 0/20
en los tres**, así que el «0/20 después» de esta máquina no separa el arreglo de la suerte. Lo que sí demuestra
es que el cambio no altera nada de lo que los tests miden.

### ③ Lo que queda de la lista (37)

- Del equipo de Luis: `scrum1188d`, `scrum1489` y `scrum912`. Se avisan y no se tocan.
- Los 34 gateados por `QA_DB_TEST` / `BOT_SUITE_TEST`: sus veredictos sólo se miden en staging, con su turno.
  Quedan fuera de esta tanda.

*(Corrección propia, y es la que lleva el `A9:`. Para correr estos tres hizo falta un `node_modules` PROPIO.
El cliente de Prisma compartido iba dos campos por detrás de `schema.prisma` (`Merchant.activityKind` y
`Quote.archivedAt`), y las listas de presupuestos que miden 1346 y 1403 filtran por `archivedAt`. Lo dijo
`_prisma-client-guard.mjs` antes de correr nada. Se arregló con `npm ci` en este worktree y `generate` desde
él. `npm run topologia` dice «directorio propio», así que no se tocó el compartido. Otra, sin consecuencia: en un
comando usé una variable que no había definido, y el banco salió CIEGO («faltan argumentos») en vez de dar un
verde. Repetí la pasada.)*
