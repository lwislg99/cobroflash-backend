# SCRUM-1876a
**Medido contra:** `origin/main` = `154c44557f771e9bb7a6e20a2f5a8e55a18c979a` · 2026-11-28T08:02:34Z
Versión: 1.2 (SCRUM-1836)

**Qué es este tramo:** SOLO DOCS. La medición del catálogo de las bases para los 11 objetos que
`yaqu_dev_javier` tiene y `prisma/schema.prisma` de `main` no (SCRUM-1876, decisión «A» del fundador,
c.22975), los dos previews y el preflight con el esquema parcheado, y el parche como EVIDENCIA sin
aplicar. **El esquema NO entra en este PR:** entra en SCRUM-1876b, otra sesión con `node_modules`
propio (este árbol cuelga del compartido por junction: aquí no se puede `prisma generate`).

## Por qué paré (07:38Z) y qué cambió después

Medido por `docs/master/evidencias/scrum1876a/catalogo.mjs` (solo SELECT; controles: columna
`invoices.merchantId`, índice `invoices_pkey`, negativo derivado con sufijo `_zz1876`, y
`current_database()`), a las 07:38:30Z (Date de GitHub):

| objeto | DEV `yaqu_dev_javier` | STAGING `railway` (07:38Z) | línea del parche (1876b) |
|---|---|---|---|
| customers.callback_on | date · YES · NULL | igual | `callbackOn DateTime? @map("callback_on") @db.Date` |
| customers.callback_note | text · YES · NULL | igual | `callbackNote String? @map("callback_note")` |
| customers.pay_methods_por_defecto | jsonb · YES · NULL | **NO ESTÁ** | `payMethodsPorDefecto Json? @map("pay_methods_por_defecto")` |
| invoices.retencion_irpf_importe | numeric(12,2) · YES · NULL | igual | `retencionIrpfImporte Decimal? @map("retencion_irpf_importe") @db.Decimal(12, 2)` |
| quote_templates.discount_global_amount | numeric(12,2) · YES · NULL | igual | `discountGlobalAmount Decimal? @map("discount_global_amount") @db.Decimal(12, 2)` |
| albaranes.firmado_en_dispositivo_at | timestamp(3) sin zona · YES · NULL | igual | `firmadoEnDispositivoAt DateTime? @map("firmado_en_dispositivo_at")` |
| albaranes.ventana_suelo_at | timestamp(3) sin zona · YES · NULL | igual | `ventanaSueloAt DateTime? @map("ventana_suelo_at")` |
| albaranes.ventana_suelo_fuente | text · YES · NULL | igual | `ventanaSueloFuente String? @map("ventana_suelo_fuente")` |
| albaranes.parte_id | integer · YES · NULL | igual | `parteId Int? @map("parte_id")` |
| customers_merchant_id_callback_on_idx | btree (merchant_id, callback_on) | igual | `@@index([merchantId, callbackOn])` |
| albaranes_merchant_id_parte_id_idx | btree (merchant_id, parte_id) | igual | `@@index([merchantId, parteId])` |

Veredicto del instrumento: DEV «los 11 objetos están» (salida 0) · STAGING «FALTAN 1 de 11 →
customers.pay_methods_por_defecto» (salida 1). Claves ajenas sobre las 9 columnas: 0 en las dos bases
(7 leídas en las cuatro tablas): el parche va sin `@relation`, como `Albaran.invoiceId`.

El repositorio ya lo decía: `docs/sql/scrum-586-paso-1-anadir-columna.sql` lleva «staging ... ⛔
PENDIENTE — la aplica el FUNDADOR» y «producción ... ⛔ PENDIENTE — la aplica el FUNDADOR», y avisa
de que «un esquema que nombra una columna que la base no tiene rompe el arranque». `MIGRATIONS_PENDING.md`
no nombra 586. Paré y lo mandé al orquestador: con la línea en `Customer`, Prisma pide todas las
escalares en cada lectura sin `select`, y `main` se despliega a producción (A5: nunca ③ sin ②).

**Posterior a mi medición (leído en Jira, no medido por esta sesión):** el fundador aplicó
`ADD COLUMN IF NOT EXISTS "pay_methods_por_defecto" JSONB` en staging y producción; el orquestador
midió por SELECT DEV 11/11 y STAGING 11/11 a las ~07:50Z (SCRUM-1876 c.22979); el fundador pegó
PRODUCCIÓN 11/11 con la huella `count(*) FROM merchants` = 15 (dev 7, staging 8) (c.22981).

## Preview offline: esquema de main → parcheado (08:02:03Z)

`node scripts/preview-migracion.mjs --desde <copia de prisma/schema.prisma de main>`, salida 0:

    ✔ control positivo: la herramienta responde (36 tablas).
    ALTER TABLE "customers" ADD COLUMN "callback_note" TEXT, ADD COLUMN "callback_on" DATE, ADD COLUMN "pay_methods_por_defecto" JSONB;
    ALTER TABLE "invoices" ADD COLUMN "retencion_irpf_importe" DECIMAL(12,2);
    ALTER TABLE "quote_templates" ADD COLUMN "discount_global_amount" DECIMAL(12,2);
    ALTER TABLE "albaranes" ADD COLUMN "firmado_en_dispositivo_at" TIMESTAMP(3), ADD COLUMN "parte_id" INTEGER, ADD COLUMN "ventana_suelo_at" TIMESTAMP(3), ADD COLUMN "ventana_suelo_fuente" TEXT;
    CREATE INDEX "customers_merchant_id_callback_on_idx" ON "customers"("merchant_id", "callback_on");
    CREATE INDEX "albaranes_merchant_id_parte_id_idx" ON "albaranes"("merchant_id", "parte_id");
    ✔ aditiva: ni DROP, ni RENAME, ni TRUNCATE, ni DELETE, ni SET NOT NULL.

9 ADD COLUMN + 2 CREATE INDEX = 11, y los dos nombres de índice que genera Prisma son los de la base.

## Preview contra DEV con el esquema parcheado

`DATABASE_URL` = `DATABASE_URL_DEV` (acela/yaqu_dev_javier), salida 0:

    [producción] DATABASE_URL → acela.proxy.rlwy.net/yaqu_dev_javier (declarado como no-producción) ✅
    ✔ control positivo: la herramienta responde (36 tablas).
    ✔ sin cambios pendientes — y el vacío está COMPROBADO, no supuesto

## Preflight de la tanda (08:02:34Z), rojo primero

`node scripts/preflight-schema-drift.mjs`, `DATABASE_URL_TESTS` → acela/yaqu_dev_javier:

- con el esquema de main (`PREFLIGHT_DATAMODEL` = copia de main): **salida 3**, «DERIVA DE ESQUEMA … la
  BD va POR DELANTE del schema — tiene 11 objeto(s)», y nombra los 2 DROP INDEX y los 9 DROP COLUMN.
- con el esquema parcheado (el del árbol, sin override): **salida 0**, «✅ preflight: el esquema de la BD
  coincide con prisma/schema.prisma. En sync.»

El parche se aplicó en local solo para estos tres pasos y se retiró copiando el fichero de main encima
(`git diff --quiet` limpio; `git apply --check` del parche sobre main: aplica). Queda en
`docs/master/evidencias/scrum1876a/schema-1876b.patch` para 1876b.

## Lo que NO medí

- **Producción**, en ningún momento: lo que hay de producción es lo que el fundador pegó (c.22981).
- **El turno** no lo tomé: catálogo, previews y preflight son de solo lectura y los dos turnos estaban
  LIBRES (`turno:estado`, 07:38Z); el CLI dice que se toma sobre la base que vas a ESCRIBIR.
- `prisma generate`, `_prisma-client-guard`, `generar-sql-deriva.mjs`, `tsc` con el parche: son de 1876b.
- **Uso en `src/`:** `git grep` de los 9 nombres de columna en `src/` de main da 0 en los 9 (control:
  `merchant_id` da 33). Pero el identificador `parteId` sí sale en 4 ficheros de `src/` (jobs e
  invoicing): no comprobé si alguno lo lee de `Albaran` por Prisma; con el campo en el modelo, eso
  cambiaría de tipo para `tsc`. Es de 1876b, que compila con tipos.
- `prisma format --check` sale 1 con el parche **y también con el esquema de main**: el desformato es
  anterior; no lo toqué.

## Correcciones a la ficha del encargo (dadas al orquestador a las 07:38Z, aceptadas)

`invoices.merchant_id` no existe (la columna es `merchantId`, sin `@map`): mi primera pasada dio CIEGO por
ese control. Este árbol no está declarado para `DATABASE_URL_TESTS` en `scripts/_clave-vs-destino.mjs`
(`comprobar-claves-bd.mjs` sale 1). Y «si en staging falta alguno, no pares» estaba mal: faltaba uno, y paré.

A9: comprobación → `docs/master/evidencias/scrum1876a/catalogo.mjs`

# SCRUM-1876b · las once líneas del esquema
**Medido contra:** `origin/main` = `b811319eb3ba10f663d38d2cd39a665b4ee9273c` · 2026-11-28T08:34:12Z
Versión: 1.2 (SCRUM-1836)

**Qué es este tramo:** el paso ③ de A5 para los 11 objetos que ya estaban en las tres bases (decisión
«A» del fundador, c.22975; dev y staging 11/11 medidos por el orquestador, c.22979; producción 11/11
pegada por el fundador, c.22981). `prisma/schema.prisma` + `docs/sql/deriva-prod.sql` regenerado +
dos anclas de `docs/legal/AUDITORIA_CAMINO_EMISION.md` (36 y 40) llevadas a su línea. `src/` intacto.
Ningún DDL contra ninguna base.

## Las líneas (blob final `c0d43e03cd993fef7c8f64b4b26b4ae7f5d3fbfb`)

- `Customer`: `callbackOn DateTime? @map("callback_on") @db.Date` · `callbackNote String? @map("callback_note")` ·
  `payMethodsPorDefecto Json? @map("pay_methods_por_defecto")` · `@@index([merchantId, callbackOn])`.
- `Invoice`: `retencionIrpfImporte Decimal? @map("retencion_irpf_importe") @db.Decimal(12, 2)` (antes del
  comentario del `@@unique`, no entre los dos como dejaba el parche de 1876a).
- `QuoteTemplate`: `discountGlobalAmount Decimal? @map("discount_global_amount") @db.Decimal(12, 2)`.
- `Albaran`: `firmadoEnDispositivoAt DateTime?` · `ventanaSueloAt DateTime?` (TIMESTAMP(3), el de Prisma
  por defecto) · `ventanaSueloFuente String?` · `parteId Int?`, cada uno con su `@map`, y
  `@@index([merchantId, parteId])` detrás de los dos `@@unique`.

Los nombres de índice que genera Prisma son los de la base (sin `map:`): lo dice el offline de abajo.

## Los previews (08:33:53Z → 08:34:05Z, esquema final)

- **DEV** (`acela…/yaqu_dev_javier`), salida 0: «✔ control positivo: la herramienta responde (36 tablas).»
  «✔ sin cambios pendientes — y el vacío está COMPROBADO, no supuesto».
- **STAGING** (`acela…/railway`, «declarado como no-producción»), salida 2, control 36 tablas. Lo único
  que propone es `DROP INDEX "public"."customers_merchant_id_company_id_idx";` +
  `CREATE INDEX "customers_company_id_idx" ON "customers"("company_id");`. **No es de las 11:** es la
  deriva del índice de `company_id` anotada el 29-sep en `docs/MIGRATIONS_PENDING.md` (staging y
  producción tienen el compuesto, dev el simple; «es una decisión, no una corrección»). Rojo primero:
  la misma herramienta (`previewMigracion({ schema })` importada, sin tocarla) con el esquema de main
  contra staging da 12 destructivas: los 2 DROP INDEX y 9 DROP COLUMN de las 11 más ese par.
- **Offline** `--desde <schema.prisma de main>` (blob `1c3d66ef6`), salida 0: 9 `ADD COLUMN` (customers 3,
  invoices 1, quote_templates 1, albaranes 4) + `CREATE INDEX "customers_merchant_id_callback_on_idx"` +
  `CREATE INDEX "albaranes_merchant_id_parte_id_idx"` · «✔ aditiva: ni DROP, ni RENAME, ni TRUNCATE, ni
  DELETE, ni SET NOT NULL.»

## Cliente, compilación y preflight

- `./node_modules/.bin/prisma generate` (node_modules propio, `npm run topologia`: «directorio propio»),
  salida 0. `_prisma-client-guard`: ✔ columnas en los dos sentidos. `_prisma-procedencia-guard`: **rojo
  con mi primera colocación** (Prisma reordena los atributos de bloque al copiar el esquema al cliente y
  dejaba el `@@index([merchantId, parteId])` detrás de los `@@unique`); verde, 862 líneas, tras moverlo.
- `tsc -p .` con tipos: salida 0, 373 `.js` en `dist/`. Control: un error de tipos sembrado da salida 2
  (fichero temporal en `src/`, borrado en el mismo comando; `git status` solo con los míos).
- `generar-sql-deriva.mjs` (lo pedía scrum222): «Columnas esperadas: 566» → 575, más las 9 tuplas.
- **Preflight** (`DATABASE_URL_TESTS` → `acela…/yaqu_dev_javier`, la misma URL que `DATABASE_URL_DEV`):
  con el esquema de main (`PREFLIGHT_DATAMODEL`), 08:31:28Z, **salida 3**, «❌ preflight: DERIVA DE
  ESQUEMA … la BD va POR DELANTE del schema — tiene 11 objeto(s)»; con el mío, 08:31:35Z y otra vez a
  las 08:34Z, **salida 0**, «✅ preflight: el esquema de la BD coincide con prisma/schema.prisma. En sync.»
- `comprobar-claves-bd.mjs`: STAGING y DEV ✅ con su destino; salida 1 solo porque este árbol no está
  declarado para `DATABASE_URL_TESTS` en `scripts/_clave-vs-destino.mjs`. Nada apunta a producción.

## `parteId` y los nombres en `src/`

`git grep -n parteId -- src`: 10 líneas en 4 ficheros, ninguna sobre `prisma.albaran.*`.
`src/modules/invoicing/domain/facturaDesdeParte.ts:86` es `prisma.parteTrabajo.findFirst({ where: { id: parteId … } })`;
`src/modules/jobs/app/routes/jobs.routes.ts:1459` arma la respuesta; `src/modules/jobs/domain/albaranDesdeParte.ts:63`
es una interfaz y `src/modules/jobs/domain/visitaDelParte.ts:29` un parámetro. Los 8 nombres camel y los 9 snake
dan 0 en `src/` **salvo `discountGlobalAmount`, 32**: son de `Quote` e `Invoice` (ya en el esquema); las rutas de
`quoteTemplate` (`src/modules/templates/app/routes/templates.routes.ts`) leen con `select` y escriben con un `data`
en lista blanca. Control: `merchant_id` 31, `claveIdempotencia` 6. (1876a dijo «0» sobre los snake: correcto.)

## Verdes, con población

TAP a fichero fuera del árbol, recuento del propio TAP:

- **Esquema** (222, 205 ×3, 475 ×6, 665b, 1296 ×3, 1310b, 252, 385): 17 ficheros · 175 casos · 173 pass ·
  0 fail · 2 saltos (los dos «GATEADO» de 222: «sin QA_DB_TEST=1 ni LIBRO_PG_URL»). 222 antes de regenerar
  el SQL de deriva: 1 rojo de 23 («el SQL del censo de producción NO está desfasado»).
- **Árbol entero** (237, 976, 700 sin filtro, 824, 419, 1839, 525d, 1185, 411): 9 ficheros · 91 casos · 90 ·
  **1 rojo, 525d**: mis líneas movían las dos anclas con testigo de la auditoría (`vf_prev_hash` 978→984,
  `model VfSubmission` 1962→1981). Las llevé a su línea; al hacerlo escribí el nombre del modelo entre
  acentos graves en la nota y 525d lo tomó como testigo (2.º rojo, mío). Sin ellos: 525d 8/8.
- **Registro** (1294, 267, 854, 525d, 1839): 5 ficheros · 38 casos · 37 + el 525d de arriba. 854 no pidió
  entrada en `docs/MIGRATIONS_PENDING.md`, así que no la hay.
- `npm run guards:entrada`: 186 casos · 186 pass · 0 fail · 0 saltos.
- **Suite entera: NO corrida antes del empujón.** A 181k de contexto no cabía (16 tramos); lo dije antes de
  empujar. La mide el obligatorio del PR.

## Lo que NO medí

- **Producción**, por ninguna sesión: es lo que pegó el fundador (c.22981).
- Que en producción esté también la deriva del índice de `company_id`: lo anotado el 29-sep dice que sí.
- `docs/legal/AUDITORIA_CAMINO_EMISION.md:145-146` (`schema.prisma:931-932` y `:921`, sin testigo) ya
  apuntaban a otra cosa en main; no son de este ticket y no los toqué.
- La tanda gateada: la lanza el fundador.

A9: comprobación → `scripts/_prisma-procedencia-guard.mjs`
