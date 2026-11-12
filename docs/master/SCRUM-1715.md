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
