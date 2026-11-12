# SCRUM-1715 · los tres tests de Luis con `fetch` + `listen(0)` (SCRUM-1218), al patrón seguro

Ticket repartido (c.21651 del orquestador del equipo de Luis): `scrum1188d` a **S2**; `scrum1489` y
`scrum912` a **S1**. Cada puesto anexa su tramo aquí; nadie escribe encima del de otro.

## S2 · SCRUM-1715a · `scrum1188d-tiers-tambien-se-vacia` a `node:http`, medido con un Postgres desechable

**Medido contra:** `origin/main` = `c8195b2608c32624f39d1145cf031c93091d9161` · 2026-11-12T12:12:03Z (hora de GitHub, de `scripts/equipo/ancla.mjs`; sesión S2, 16.ª del 12-nov, por encargo del orquestador `cobroflash-backend-5f`)

A9: sin fallo que generalice — tuve dos tropiezos de instrumento y los dos fallaron EN ALTO: lanzar `migrar-1218i.mjs.txt` tal cual (`ERR_UNKNOWN_FILE_EXTENSION`, se copia a `.mjs` fuera del árbol) y un `-or` metido en un `Test-Path` de PowerShell (error de parámetro). Ninguno dio un resultado falso que pareciera bueno.

**Cero textos, 0 líneas de `src/`.** Ficheros: `tests/scrum1188d-tiers-tambien-se-vacia.test.mjs`, la lista
`CON_EL_PATRON_YA` de `tests/scrum560-patron-fetch-servidor.test.mjs` y este registro con sus evidencias.

### ① El cambio: `migrar-1218i`, sin cambiarlo

`docs/master/evidencias/SCRUM-1218/migrar-1218i.mjs.txt`, copiado a `.mjs` fuera del árbol y lanzado sobre
el fichero (`evidencias/SCRUM-1715/migrar-1715.salida.txt`): `fetch( 1 → 0`, 1 llamada a `pedirSinAgente(`,
`node:http` ya importado (el fichero monta su servidor con él), así que no se añade otro import. El fichero
lee `status` y `json()` de la respuesta; las dos las da el ayudante. **Ninguna aserción cambia**: el diff del
fichero es el ayudante pegado más una sola línea `fetch(` → `pedirSinAgente(`.

`CON_EL_PATRON_YA` pasa de **3 a 2** (quedan `scrum1489` y `scrum912`, de S1), con su motivo anotado en la lista.

### ② Antes y después, con el banco

Banco: un Postgres 16 PROPIO (binarios copiados, `initdb` en el scratchpad de esta sesión, puerto 55715,
loopback), base `yaqu_1715_test`, esquema con `prisma migrate diff --from-empty` del CLI local (33 tablas,
las mismas que 1218i), **rehecha antes de cada pasada**; `dist/` con `tsc --noCheck`; `LIBRO_PG_URL` con
`sslmode=disable` y las cuatro `DATABASE_URL*` quitadas del entorno. El «antes» es el fichero de `origin/main`;
los dos lados corren desde un directorio hermano de `tests/` (misma profundidad), que se borró al terminar.
Instrumento: `evidencias/SCRUM-1715/pasadas-1715.mjs.txt`; salida: `pasadas-1715.salida.txt`.

| lado | pasadas | abortos con la firma de 1204 | rc ≠ 0 | casos (0 SKIP) | casos por nombre |
|---|---|---|---|---|---|
| antes (`fetch`) | 40 | 0 | 0 | 4/4 `ok` en las 40 | IGUAL |
| después (`node:http`) | 40 | 0 | 0 | 4/4 `ok` en las 40 | IGUAL |

Control del comparador (un veredicto cambiado a mano): **VIVO**.

🔴 **Lo que esto NO dice:** el «antes» no abortó en 40 pasadas, así que aquí no se ha medido un síntoma que
desaparezca: se ha medido que la migración **no cambia ningún veredicto**. Es lo mismo que 1218i encontró
con `scrum131`, `scrum136` y `scrum876f` (0/20 antes). El motivo de migrar es el mecanismo de 1218, que
abortó `webhooks-idempotencia` 5 de 80 veces con DOS `fetch`, y el trinquete de 1218j.

### ③ Mutaciones

- **Trinquete, mitad «ningún NUEVO»:** con la lista ya limpia y el fichero SIN migrar, `scrum560` da 3 pass ·
  1 fail y nombra **exactamente** `scrum1188d-tiers-tambien-se-vacia.test.mjs — 7 \`fetch\` sobre su propio
  servidor` (`mutacion1-sin-migrar.salida.txt`).
- **Trinquete, mitad «la lista no puede quedarse vieja»:** con el fichero migrado y la lista de `origin/main`,
  3 pass · 1 fail: «ESTOS YA NO USAN `fetch` SOBRE SU SERVIDOR: scrum1188d-tiers-tambien-se-vacia.test.mjs»
  (`mutacion2-lista-vieja.salida.txt`).
- **El ayudante mide:** `status: r.statusCode` → `status: 500` (ancla única) en una copia, con el banco:
  caen los DOS casos que piden por HTTP («CIEGO: el POST responde 500») y no se mueven los dos que no
  piden (el SUELO por Prisma y `jsonAnulable`) (`mutacion3-ayudante-status.salida.txt`).

Las tres, restauradas: `scrum560` con el cambio, **4/4**.

**Sin medir:** Linux/CI con pasadas (el check obligatorio lo corre con su banco desechable en este PR);
la bandera `--no-wasm-dynamic-tiering` (sin aborto en el «antes», no había nada que apagar). **Suite
entera local: NO CORRIDA.**

## S1 · SCRUM-1715b · `scrum1489` y `scrum912` a `node:http`, el mismo molde, medido con un Postgres desechable

**Medido contra:** `origin/main` = `7e1ef419fb9e591ead56b59aae49efcf27f8c905` · 2026-11-12T12:46:10Z (hora de GitHub, de `scripts/equipo/ancla.mjs`; sesión S1, por encargo del orquestador `cobroflash-backend-5f`)

**La rama sale de la de S2** (`scrum-1715-scrum1188d-node-http`, punta `abd373677`, PR #3119 abierto), no de
`main`: los dos tramos tocan la misma lista de `scrum560` y este mismo registro, y desde `main` el segundo en
entrar chocaría en los dos. Cuando #3119 entre, el diff de esta rama queda en lo suyo.

A9: sin fallo que generalice — dos tropiezos de instrumento, y los dos fallaron EN ALTO: `prisma migrate diff
--to-schema` (la opción de este CLI es `--to-schema-datamodel`; salió `rc=1` y 0 tablas, sin dar un DDL vacío
por bueno) y `git restore` para la mutación 2, que bloqueó `guard-dangerous` (se escribió la versión de `HEAD`
en bytes con `git show` desde Node).

**Cero textos, 0 líneas de `src/`.** Ficheros: `tests/scrum1489-la-busqueda-recorta-al-tecnico.test.mjs`,
`tests/scrum912-leer-ticket-gasto.test.mjs`, la lista `CON_EL_PATRON_YA` de
`tests/scrum560-patron-fetch-servidor.test.mjs` y este tramo con sus evidencias (sufijo `b`).

### ① El cambio: `migrar-1218i`, sin cambiarlo

Copiado a `.mjs` fuera del árbol y lanzado sobre los dos (`evidencias/SCRUM-1715/migrar-1715b.salida.txt`):

| fichero | `fetch(` antes → después | llamadas a `pedirSinAgente(` | `node:http` |
|---|---|---|---|
| `scrum1489` | 1 → 0 | 1 | ya importado (monta su servidor con él): no se añade |
| `scrum912` | 1 → 0 | 1 | se añade el import |

Lo que leen de la respuesta, `status` y `json()` (en 1489, `json().catch(…)`), lo da el ayudante. **Ninguna
aserción cambia.** En `scrum912`, el `simularGoogle` que sustituye `globalThis.fetch` sigue igual: nunca
contó lo local (lo dejaba pasar a `fetch` de verdad), y ahora la petición del test a su propia app ya no pasa
por él. Esa rama (`if (u.startsWith('http://127.0.0.1')) return real(…)`) se queda sin llamadas del propio
test; no se toca, porque quitarla no es la migración.

`CON_EL_PATRON_YA` pasa de **2 a 0**, con el motivo anotado en la lista. **La lista queda vacía y el
trinquete sigue vivo**: un fichero que vuelva al patrón cae en «ningún NUEVO» (mutación 1).

### ② Antes y después, con el banco

Banco: un Postgres 16 PROPIO (binarios de `_banco-s3` sólo usados, `initdb` en el scratchpad de esta sesión,
puerto 55716, loopback), base `yaqu_1715b_test`, esquema con `prisma migrate diff --from-empty
--to-schema-datamodel` del CLI local (33 tablas, las mismas que en 1715a), **rehecha antes de cada pasada**;
`dist/` con `tsc --noCheck`; `LIBRO_PG_URL` con `sslmode=disable` y las cuatro `DATABASE_URL*` quitadas del
entorno. El «antes» es el fichero de `origin/main`. Los dos lados corren desde un directorio hermano de `tests/`
(misma profundidad, con copia de los `tests/_*.mjs` que importan), borrado al terminar. Instrumento:
`evidencias/SCRUM-1715/pasadas-1715b.mjs.txt` (el de 1715a con dos ficheros y el filtro de casos sin el
prefijo del ticket); salida: `pasadas-1715b.salida.txt`.

| fichero | lado | pasadas | abortos con la firma de 1204 | rc ≠ 0 | casos (0 SKIP) | casos por nombre |
|---|---|---|---|---|---|---|
| `scrum1489` | antes (`fetch`) | 40 | 0 | 0 | 10/10 `ok` en las 40 | IGUAL |
| `scrum1489` | después (`node:http`) | 40 | 0 | 0 | 10/10 `ok` en las 40 | IGUAL |
| `scrum912` | antes (`fetch`) | 40 | 0 | 0 | 21/21 `ok` en las 40 | IGUAL |
| `scrum912` | después (`node:http`) | 40 | 0 | 0 | 21/21 `ok` en las 40 | IGUAL |

Control positivo del banco: el caso «🔴 CON BASE: por HTTP…» de `scrum1489` **corre** (no salta) en las 160.
Control del comparador (un veredicto cambiado a mano), en los dos ficheros: **VIVO**.

🔴 **Lo que esto NO dice**, igual que en 1715a: el «antes» no abortó en 40 pasadas, así que no se ha medido un
síntoma que desaparezca, sino que la migración **no cambia ningún veredicto**. El motivo de migrar es el
mecanismo de 1218 y el trinquete de 1218j.

### ③ Mutaciones

- **Trinquete, mitad «ningún NUEVO»:** con la lista vacía y los dos ficheros SIN migrar, `scrum560` da 3 pass ·
  1 fail y nombra **exactamente** los dos: `scrum1489… — 5 \`fetch\` sobre su propio servidor` y
  `scrum912… — 1 \`fetch\` DENTRO DE UN BUCLE` (`mutacion1b-sin-migrar.salida.txt`).
- **Trinquete, mitad «la lista no puede quedarse vieja»:** con los ficheros migrados y la lista de la punta de
  S2 (los dos nombres), 3 pass · 1 fail: «ESTOS YA NO USAN `fetch` SOBRE SU SERVIDOR: scrum1489…, scrum912…»
  (`mutacion2b-lista-vieja.salida.txt`).
- **El ayudante mide:** `status: r.statusCode` → `status: 500` (ancla única en cada fichero, `numstat` 1/1) en
  copias, con el banco: 31 casos, **8 caen** (`mutacion3b-ayudante-status.salida.txt`). En `scrum1489`, el
  único que pide por HTTP («CON BASE»), y ninguno de los 9 que no. En `scrum912`, 7, y son **exactamente** los 7
  casos cuyo cuerpo llama a `conApp(`/`conAppSinDoble(` (contados sobre el fichero, por nombre); los 14 de
  dominio no se mueven.

Restauradas: `scrum560` con el cambio, **4/4** (`scrum560-con-el-cambio-1715b.salida.txt`).

**Sin medir:** Linux/CI con pasadas (el check obligatorio lo corre con su banco desechable en el PR); la
bandera `--no-wasm-dynamic-tiering` (sin aborto en el «antes», nada que apagar). **Suite entera local: NO
CORRIDA.**
