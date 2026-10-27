# SCRUM-1310 · 13 de las 37 claves ajenas de producción no tienen DDL en el repositorio (re-medición y preguntas)

**Medido contra:** `origin/main` = `0a7eef15c907acc7646ed7ab33cab9176f8f1bc0` · 2026-10-24T10:50:07Z (hora de GitHub)

A9: aviso → cicatriz J5 «Di por ausente un `CREATE TABLE "customers"` porque mi patrón no admitía el prefijo `"public".` de las migraciones congeladas, y el 1-oct el ticket lo publicó como hecho» — no se pudo comprobar: un patrón que no casa da cero igual que una tabla que falta, y ningún guard sabe qué formas de DDL previó el patrón de una sesión; el instrumento de este tramo siembra las tres formas del árbol y dice CIEGO si pierde una (mutante sin el prefijo: «2 de 3 vistos → CIEGO»).

Sesión J5 (`jv-j5ah`, 24-oct, equipo de Javier). Encargo del orquestador `cobroflash-backend-95`: **solo medir y preguntar**.
No se conecta a ninguna base, no se compila y no se corre ninguna tanda. Lo que se entrega: el comentario **SCRUM-1310 c.20753**
(medición y preguntas ✅/❌ para el fundador), este registro, el instrumento y su salida en `docs/master/evidencias/SCRUM-1310/`,
y una línea en `docs/equipo/cicatrices/J5.md`.

## Ⓐ Estado

- **(i)**: decidida en c.17665 (Javier, 1-oct: «1-Si se para el guard»). En `main` no hay ningún guard de clave ajena.
- **(ii)**: **abierta**. Nadie la ha empezado: no hay commits con el número, ninguna rama `scrum-1310*` en el remoto y ningún PR.
- **No está resuelto por efecto.** El estado «Acción del fundador» sigue siendo el correcto: la P1 de c.20753 espera al fundador.

## Ⓑ Re-medición

`node docs/master/evidencias/SCRUM-1310/medir-fk.mjs 0a7eef15c907acc7646ed7ab33cab9176f8f1bc0` → `salida.txt`.

- **Población:** 75 fuentes (15 congeladas y 60 de `docs/sql/`), 33 modelos.
- **Claves ajenas:** 37, y casa con el recuento por texto de `@relation(fields:)`. Hay **24 con DDL** y **13 sin fuente**, repartidas en 8 tablas. Son las mismas 13 que el 1-oct, y ninguna declara `onDelete` en el esquema.
- **Controles:** un FK sembrado con CASCADE, que se ve; tres `CREATE TABLE` sembrados, que se ven los 3; y un cero derivado de la hora, que da 0 aciertos. Sin semilla, el instrumento dice CIEGO.

## Ⓒ Lo que el ticket daba por cierto

1. **«`customers` no tiene CREATE TABLE»: falso ya el 1-oct.** Está en `20250919125018_init_schema/migration.sql:17`, con el prefijo `"public".`. Las tablas sin `CREATE TABLE` son 6: `auth_sessions`, `expenses`, `quote_requests`, `quote_templates`, `team_members` y `customer_events`. La clave ajena `customers_merchant_id_fkey` sí sigue sin DDL.
2. **SCRUM-1307:** está Finalizada y en `main` (#2025, `ae8cb3180`). El ticket la daba por «en construcción».
3. **«Nadie lo vigila»:** sigue siendo cierto para las 13. `docs/sql/verificacion-deriva-produccion.sql:58` solo mira 2 de las 37 claves ajenas (las de `job_assignees`).
4. **Una sonda ya espera la (ii):** `docs/master/evidencias/SCRUM-1550/sondas.json:52` busca `invoices_rectifies_id_fkey` en `docs/sql`.

## Ⓓ Preguntas (el texto, en c.20753 §4)

- **P1 (recomiendo ✅):** volcar las 13 a `docs/sql/`. Javier corre en las tres bases un `SELECT` de solo lectura sobre `pg_constraint`, y la sesión lo pasa a un fichero.
- **P2:** el alcance. Recomiendo el mínimo: las 13 claves ajenas con su `ON DELETE`.
- **P3:** un trinquete por ficheros que impida que el hueco crezca. Solo si la P1 sale ✅: puede leerse como lo que c.17665 rechazó.

Carril: `docs/sql/`, `prisma/schema.prisma` y esta carpeta de evidencias salen «sin fila en §3» en `carriles.mjs de`. El ticket no lleva etiqueta `area-*`.

**Sin medir, y lo digo:** las reglas reales de borrado de las 13 en las bases (solo consta `rectifies` = SET NULL, del 1-oct). Tanda local: NO CORRIDA (encargo de solo docs).

## Tramo 1310b (J5, `jv-j5ai`, equipo de Javier, 24-oct-2026) · la consulta para Javier y el trinquete por ficheros

**Medido contra:** `origin/main` = `1b3395ecc6d3524e7b4ec711871d1d485ee67f28` · 2026-10-24T15:07:07Z (hora de GitHub)

A9: comprobación → `tests/scrum1310b-claves-ajenas-con-ddl.test.mjs`

Lo que se hace aquí lo decidió el fundador en **c.20776** (P1+P2: «Sí, solo las 13»; P3: «Sí»). No se toca `prisma/schema.prisma` ni se hace ningún `db push`.

### ① La consulta: `docs/sql/scrum-1310b-claves-ajenas-sin-ddl-consulta.sql`

- Es un único `SELECT` de solo lectura sobre `pg_constraint`, `pg_class`, `pg_namespace` y `pg_attribute`. Devuelve 14 filas: el control y las 13. De cada clave ajena da su nombre real, su `ON DELETE`, su `ON UPDATE`, el `ddl` armado en el formato de las congeladas y `pg_get_constraintdef` como segundo testigo.
- **Control positivo:** `quotes_chargeId_fkey`, una de las 24 que sí tienen DDL. La consulta compara el DDL que arma con la línea de la congelada (`20251104175333_add_quote_model/migration.sql:26`), byte a byte. Si no coinciden, dice `CONTROL DISTINTO`; si no la encuentra, `CONTROL NO ENCONTRADO`.
- **Busca por tabla y columna, no por nombre.** Así sale el nombre real de cada clave, y si no coincide con el que implica el esquema lo dice: `CON OTRO NOMBRE`. Además, la consulta no escribe el nombre de ninguna de las 13, porque la sonda 1310 de `docs/master/evidencias/SCRUM-1550/sondas.json` busca por subcadena en `docs/sql`: con el nombre escrito, una consulta habría pasado por su DDL. Lo vigila el último caso del test.
- **Probada en DEV** (transacción `READ ONLY`; salida en `docs/master/evidencias/SCRUM-1310/consulta-1310b-dev.txt`): 14 filas, `CONTROL IDÉNTICO AL FICHERO` y las 13 con `HAY CLAVE AJENA`. Probé también una copia con el literal del control alterado (sale `CONTROL DISTINTO`) y con una columna sin clave ajena (sale `NO HAY CLAVE AJENA EN ESTA BASE`).
- ⚠️ **El DDL de DEV no se copia.** En DEV las 13 siguen exactamente la regla implícita de Prisma: las opcionales salen con `SET NULL`, las obligatorias con `RESTRICT`, y todas con `ON UPDATE CASCADE`. Es lo que cabe esperar de una base hecha con `db push`, y es justo la hipótesis que c.17665 descartó como fuente. Lo que pasa a `docs/sql/` es lo que devuelva **producción**.
- En staging y en producción: **NO CORRIDA**. La corre Javier.

### ② El trinquete: `tests/scrum1310b-claves-ajenas-con-ddl.test.mjs`

- Toda `@relation(fields:)` de `schema.prisma` tiene que tener su `CONSTRAINT <nombre> FOREIGN KEY` en `docs/sql/` o en las congeladas. Se lee sobre el texto desnudado con `desnudar`, así que un nombre en un comentario o dentro de una cadena no cuenta. Las 13 de hoy van en `SIN_DDL_CONGELADAS`, que solo puede bajar: una clave nueva sin DDL da ROJO (①), y una de la lista que ya tiene DDL también da ROJO hasta que se quita (②).
- **Población:** 73 fuentes (255.623 B) y 37 claves ajenas. El parser y el recuento por texto casan. Sale la misma lista de 13 que `medir-fk.mjs`, que es un instrumento distinto.
- **Positivo sembrado:** se añade al esquema real un modelo fabricado con una relación sin DDL, y tiene que salir como nueva. Sin la semilla, el veredicto es `CIEGO`, y hay un caso que lo comprueba.
- **Lo vi caer sobre el árbol real.** Quitando `quote_templates_merchant_id_fkey` de la lista, la mitad ① cae y la nombra. Con un `.sql` temporal que da DDL a `expenses_quote_id_fkey`, la mitad ② cae y la nombra. Las dos mutaciones se deshicieron, y `cmp` dio el test idéntico al original.
- No compara con ninguna base: no es el guard de «clave ajena real = esquema» que se paró en c.17665.

### Guards

- El test nuevo: 8 de 8.
- Los de suite y los que leen `schema.prisma` y `docs/sql` (237, 976, 824, 836, 419, 702, 700, 719, 1415, 441, 475, 222 y 461): 154 casos, 152 pasan, 0 fallan y 2 saltan. Los dos saltados son de 222 y están gateados por `QA_DB_TEST`, con su motivo declarado; su verde no habla de ellos.
- 758 y 425: 26 de 26.
- **Suite entera en local: NO CORRIDA** (hay 10 sesiones a la vez; hace de tanda el obligatorio de CI).

### Lo que queda, y quién

1. **Javier** corre la consulta en dev, staging y producción, y trae las 14 filas de cada base.
2. **La sesión siguiente** pasa a `docs/sql/` la columna `ddl` de **producción**, y en el mismo PR quita de `SIN_DDL_CONGELADAS` las que reciben DDL (la mitad ② lo exige). Si alguna sale `CON OTRO NOMBRE` o `NO HAY CLAVE AJENA`, se para y se pregunta.

## Tramo 1310c (J5, `jv-j5aj`, equipo de Javier, 24-oct-2026) · el DDL de las 13 y el trinquete de 13 a 0

**Medido contra:** `origin/main` = `bcfc99b0d9a4f4a3aaf9d1608dce06b3d3691482` · 2026-10-24T15:32:43Z (hora de GitHub)

A9: comprobación → `tests/scrum1310b-claves-ajenas-con-ddl.test.mjs`

Mi fallo de este tramo: escribí en la cabecera del `.sql` que el clasificador lo rechaza «por su rama de `ADD CONSTRAINT … FOREIGN KEY`» antes de medirlo, y mi propio test lo desmintió: lo rechaza como «acción no reconocida» por el prefijo `"public".`. El test afirma ahora el rechazo medido (13 de 13), no el motivo.

Depende de #2849 (rama `scrum-1310b-consulta-y-trinquete`, sin mergear al empezar): esta rama la lleva dentro por merge.

### ① `docs/sql/scrum-1310c-claves-ajenas-ddl.sql`

- 13 sentencias `ALTER TABLE "public".… ADD CONSTRAINT … FOREIGN KEY … REFERENCES … ON DELETE … ON UPDATE …;`, en el orden de la consulta de 1310b. Es documentación: no se ejecuta contra ninguna base, y el clasificador rechaza las 13.
- **Nombre, ON DELETE y ON UPDATE:** de producción (c.20810), copiados en `PRODUCCION_C20810` del test.
- **Tabla, columna, tabla y columna referenciadas:** de `schema.prisma` por programa (`ddlDeClave`: `@@map`, `@map`, `@relation(fields:, references:)`).
- **Control de la fila 0:** el mismo generador escribe `quotes_chargeId_fkey` y sale idéntico byte a byte (166 B = 166 B) a la congelada `20251104175333_add_quote_model/migration.sql:26`. Negativo: con otra acción ya no casa.
- **Segundo testigo:** las 13 casan byte a byte con la columna `ddl` que sacó del catálogo de DEV la consulta de 1310b (`evidencias/SCRUM-1310/consulta-1310b-dev.txt`): 13 de 13. En producción `ddl` y `pg_def` no se vieron (capturas cortadas, c.20810): las referencias de producción **NO están vistas**.

### ② El trinquete

- `SIN_DDL_CONGELADAS = []`. `LAS_13_DE_C20753` guarda las 13 por identidad: la consulta las sigue pidiendo y el fichero tiene que darles DDL a todas.
- Tres casos nuevos: el control byte a byte, el fichero = esquema + producción, y el rechazo del clasificador.
- **Visto en ROJO** (commit `cc358f5d1` antes de inyectar, `git diff --numstat` de cada una): una acción cambiada en el `.sql` → cae «el fichero … es exactamente el DDL»; la línea de `rectifies` borrada → caen el trinquete, el del fichero y el del clasificador; una clave devuelta a la lista → cae el trinquete. Las tres se deshicieron con `git restore --source=HEAD`, y `git status` quedó limpio: 11 de 11.

### La sonda de SCRUM-1550 NO pasa a «presente»

`node docs/master/evidencias/SCRUM-1550/contenido.mjs` sobre esta rama: `SCRUM-1310 · SIGUE SIN HACER · … [presente] · 0`. `git grep` sí encuentra el nombre (1 línea en `docs/sql/scrum-1310c-claves-ajenas-ddl.sql`), pero `contenido.mjs:98` descarta toda línea que case `reMencion(1310)` (`/SCRUM-1310(?![0-9])/i`), y la salida de `git grep` lleva delante la RUTA, que lo casa. No se toca aquí: es el instrumento de SCRUM-1550.

### Hallazgo de paso (no es de este carril)

`clasificarSentencia` rechaza también `ALTER TABLE "public"."t" ADD COLUMN "x" TEXT;` («acción no reconocida»), y permite la misma sin el prefijo. Falla del lado seguro (rechaza de más). En `docs/sql/` hay 1 `ALTER TABLE` más con el prefijo.

### Guards

- El trinquete: 11 de 11.
- 237, 976, 824, 836, 419, 702, 700, 719, 1415, 222, 441, 475, 461, 425, 758, 1214, 395, 815, 685b: 201 casos, 196 pasan, 5 caen. Los 5 (222 entero, tres de 475, uno de 836) **caen igual sobre `origin/main` `bcfc99b0d`** en este árbol, que no tiene `dist/` ni CLI de prisma propios: no los decide esta medición, los decide el obligatorio de CI.
- **Suite entera en local: NO CORRIDA.**
