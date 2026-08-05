# Migraciones de schema pendientes de aplicar a producción

> ## ⛔ ESTE FICHERO YA NO CONTESTA «¿existe esa columna en esa base?» — SCRUM-225
>
> Lo contestaba **a mano**, y una lista a mano se desfasa en silencio. Sus dos direcciones de
> error no son simétricas: decir PENDIENTE sobre algo ya aplicado es molesto e inocuo (pasó el
> 30-jul con `quotes.job_id` en `yaqu_dev_javier`); decir **APLICADO sobre algo que no lo está es
> un 500 en producción**, que es exactamente lo que se vivió en SCRUM-220 — el código desplegado
> esperando una columna que la base no tenía.
>
> **Esa pregunta tiene desde SCRUM-222 un mecanismo, y el mecanismo manda sobre este fichero:**
>
> | Quiero saber… | Se lo pregunto a… |
> |---|---|
> | ¿le falta a ESTA base alguna columna que el código nombra? | **`docs/sql/deriva-prod.sql`** — se pega entero en la consola de Postgres de esa base (Railway → base → Query). Un `SELECT` de SOLO LECTURA, autocontenido: sin node, sin CLI de Prisma y **sin credenciales en ninguna parte**. 0 filas = en sync. |
> | ¿arrancó la app contra una base que le falta algo? | El chequeo de arranque (`src/core/db/schemaDrift.ts`): en producción **no arranca** y dice qué falta; fuera, avisa. |
>
> Ese SQL se **genera** del mismo schema que usa la app (`scripts/generar-sql-deriva.mjs`) y hay
> un test que impide que se desfase, así que no puede envejecer sin que algo se ponga rojo.
> Preguntarle al fichero lo que sabe la base es la costumbre que SCRUM-225 viene a quitar.
>
> ### Las DOS clases de afirmación que conviven aquí abajo, y por qué hay que distinguirlas
>
> Éste es el fondo del ticket: hoy «existe esta columna» y «hicimos este backfill» se leían
> **idénticos** —un checkbox— y solo el primero lo puede verificar una máquina.
>
> - **🔎 VERIFICABLE** — presencia de tabla o columna. **No te fíes del checkbox: pregúntaselo al
>   SQL de arriba.** Lo que queda escrito abajo es **historia fechada** (qué se aplicó, cuándo y
>   con qué GO), no el estado de hoy.
> - **✋ DECLARACIÓN MANUAL, SIN MECANISMO** — todo lo demás, y **nada lo comprueba**: backfills y
>   estado de los datos, índices, tipos, nullability, defaults, claves ajenas, valores de enum,
>   y las decisiones de orden entre pasos. El censo de SCRUM-222 declara su alcance y es
>   estrictamente «existe la tabla y existe la columna»; el resto **no lo ve, y no debe suponerse
>   que lo ve**. Un backfill es el caso claro: la columna existe, así que el mecanismo dirá «en
>   sync» con toda la razón mientras las filas siguen a NULL.
>
> **No se construye un segundo comprobador para lo de ✋.** Se podría, y sería otra herramienta
> haciendo lo que ya hace una — el defecto que cerró SCRUM-240. Se marca como lo que es: una
> afirmación humana, visible como tal, que se cree bajo la palabra de quien la escribió.

> El deploy de Railway **NO** aplica el schema automáticamente (start = `node dist/index.js`).
> Hay que correr `prisma db push` manualmente contra la BD de producción **antes** (o justo
> al desplegar) de que el código use la nueva tabla/columna.
>
> **Procedimiento canónico (SCRUM-40):** `bash scripts/db-push-prod` (= `npm run db:push`) —
> host-check → preview `migrate diff` → **GO explícito del operador** → `db push` sin
> `--accept-data-loss` → verificación vacía → documentar aquí. La carpeta `prisma/migrations`
> se ARCHIVÓ en `docs/historico/prisma-migrations-frozen-2026-03/` (congelada mar-2026):
> **NO uses `migrate deploy`/`migrate dev`** — aplicaría un schema viejo (entorno nuevo) o
> propondría un reset. `db push` es el ÚNICO mecanismo. (Volver a migrate = SCRUM-40 opción A.)
>
> **REGLA DE LAS TRES BD (SCRUM-169):** un cambio de schema NO está aplicado hasta estar en las
> TRES bases (abajo). Faltar una costó 16 tests rojos y un lote de diagnóstico para acabar en
> «faltaba un push». El MISMO mapa y el MISMO criterio están en `docs/RUNBOOKS.md` R18 verbatim;
> si divergen en una palabra, el problema no está resuelto, solo movido.

Un cambio de schema NO está aplicado hasta estar en las TRES bases:

```
1. acela.proxy.rlwy.net / railway          — STAGING. Protegida por el máster: no se toca
                                             sin que el fundador lo sepa. Es la base del
                                             worktree cobroflash-b2.
2. acela.proxy.rlwy.net / yaqu_dev_javier  — DESARROLLO. El fundador dijo que NO requiere su
                                             GO para aplicarle schema. Base de cobroflash-b1.
3. autorack.proxy.rlwy.net                 — PRODUCCIÓN.
```

⚠️ Las dos primeras viven en el MISMO servidor (`acela`) y son bases DISTINTAS. Ninguna es
"local". Por eso pueden divergir de esquema sin que nada avise: `scripts/_db-guard.mjs` valida
el HOSTNAME, no la base, y el marcador `YAQU_STAGING` está en las dos. Las salvaguardas
garantizan "NO es producción", no "es la base que crees" — y eso es exactamente lo que produjo
los 16 rojos crípticos de SCRUM-160.

Fuente de los hostnames: `scripts/_db-guard.mjs` (`PROD_HOST` / `STAGING_HOST`), único sitio que
los define en el árbol.

Nomenclatura fijada por carril B el 27-jul-2026 con la regla de desempate del fundador. El
criterio para asignar el papel ha sido la AUTORIZACIÓN, no la ubicación ni el uso: las dos
primeras están en el mismo servidor y las dos las ejercitan tandas gateadas; lo que las
distingue es quién puede tocarlas. Se descarta llamar a `yaqu_dev_javier` "segunda BD de
staging" (SCRUM-84) porque implicaría el régimen de `railway` y no lo tiene. Si el fundador lo
ve de otra forma, es una línea.

## SCRUM-205 · `invoices.vf_estado` (estado de sellado explícito) — 🔴 SIN APLICAR en ninguna de las tres

> **Las DOS clases conviven en esta misma entrada, y por eso va aquí el aviso (SCRUM-225):**
> **🔎 VERIFICABLE** — que exista la columna `invoices.vf_estado`: pregúntaselo a
> `docs/sql/deriva-prod.sql` contra cada base, no a esta cabecera.
> **✋ DECLARACIÓN MANUAL, SIN MECANISMO** — el **backfill**, el orden `ALTER → backfill → código`
> y el gate de más abajo. Ninguna herramienta lo comprueba, y aquí importa más que en ningún
> otro sitio: en el estado intermedio, el histórico entero deja de servir PDF.

**🚨 EL ORDEN ES INNEGOCIABLE Y NO ES EL DE SIEMPRE: `ALTER TABLE` → `backfill` → desplegar el
código.** Los tres pasos, en ese orden, y **el código va el ÚLTIMO**. Aquí no basta con "aplicar
el schema antes de que el código lo use": entre el `ALTER` y el `backfill` hay un estado en el
que **todas** las facturas históricas figuran como pendientes de sellado.

**Por qué el backfill no es opcional.** La columna entra `NOT NULL DEFAULT 'pendiente_de_sellado'`
y ese default cae sobre TODAS las filas que ya existen — incluidas las que llevan meses selladas
con su huella en la cadena. El código nuevo trae la regla «pendiente de sellado ⇒ ni PDF ni QR»
(`puedeProducirDocumento()`), así que si el código llega antes que el backfill, **el histórico
entero deja de servir PDF**. El default es el CORRECTO para las filas nuevas (fail-closed: lo que
nadie sella queda visible y sin documento) y exactamente el equivocado para las viejas.

**Preview (`prisma migrate diff`, aditivo):**

```sql
ALTER TABLE "invoices" ADD COLUMN "vf_estado" TEXT NOT NULL DEFAULT 'pendiente_de_sellado';
```

**Backfill:** `prisma/backfill/scrum205-vf-estado.sql` — idempotente, en una transacción.
1. `vf_hash IS NOT NULL` → `'sellado'` (la huella ES el hecho).
2. `J-%`, merchant no-ES o sin `tax_id` → `'no_aplica'` (justificantes y quien no entra en VeriFactu).
3. **Lo que quede en `'pendiente_de_sellado'` se LISTA, no se adivina:** son facturas fiscales sin
   huella y sin motivo para no tenerla. Es un dato de negocio —facturas fantasma reales— y hay que
   mirarlo, no barrerlo. El script lo devuelve como `SELECT` final.

**Ventana:** corta y de noche. Entre el paso 1 y el 2, ninguna factura antigua sirve PDF.

### 🚨 UNA SOLA PUERTA, y el gate de `vf_estado` NO puede estar activo antes del backfill

Decisión del fundador (30-jul-2026), tras el rebase de esta rama sobre SCRUM-206:

`exigirDocumentoEmitible` (SCRUM-206) es **la única puerta a la salida**. `puedeProducirDocumento(vf_estado)`
**no convive con ella como segundo gate**: pasa a ser lo que la puerta consulta por dentro.
Delegación, no dos comprobaciones.

**El motivo es esta dependencia, y por eso está escrita aquí y no solo en el código:** el gate de
`vf_estado` es el ESTRICTO. Antes de que el backfill haya corrido en una base, todas las facturas
históricas figuran `pendiente_de_sellado` por el DEFAULT de la columna — incluidas las que llevan
meses selladas con su huella en la cadena. Un gate que dependa solo de `vf_estado` **se cerraría
sobre facturas legítimas** y dejaría sin PDF a todo el histórico.

> **Un portón que depende de que una migración ya se haya aplicado es un portón que puede cerrarse
> sobre facturas legítimas.**

De ahí la regla de composición, que hay que respetar al implementar la delegación: **la huella
manda**. Si la factura tiene `vf_hash`, la puerta se abre — el estado por sí solo nunca cierra una
puerta que la huella abriría. Con eso, la ventana entre el `ALTER` y el `backfill` deja de ser
peligrosa por construcción, y no por acordarse de un flag.

⚠️ Consecuencia operativa: **NO desplegar código que consulte `vf_estado` para decidir si sale un
documento en una base donde el backfill no haya corrido.** Es la misma razón del orden innegociable
de arriba, dicha desde el otro lado.

⚠️ **STAGING, 30-jul-2026: el ALTER está aplicado y el backfill NO.** El primer intento del
backfill murió con `column i.merchant_id does not exist` (nombres de columna supuestos en
snake_case; ver el encabezado del propio .sql). Va en BEGIN/COMMIT, así que **no se aplicó nada**:
el estado es «columna creada con su DEFAULT, relleno sin aplicar», que es el punto de partida
correcto para reintentar. Ahora mismo TODAS las facturas de staging figuran
`pendiente_de_sellado` — inofensivo mientras `main` no consulte la columna.

El fichero corregido lleva un bloque `DO` que aborta nombrando TODAS las columnas que falten,
y hay un guard en `npm test` (`tests/scrum205-sql-a-mano-contra-schema.test.mjs`) que compara
cada `"tabla"."columna"` de `prisma/backfill/*.sql` contra el schema **sin necesidad de base**.

**Estado por base:**

```
1. acela / railway (STAGING)         — 🟡 ALTER APLICADO (30-jul-2026), BACKFILL PENDIENTE
2. acela / yaqu_dev_javier (DEV)     — 🔴 pendiente (lo aplica el carril B)
3. autorack (PRODUCCIÓN)             — 🔴 pendiente (lo aplica el fundador con su GO)
```

## SCRUM-195 · `quotes.job_id` + índice (Job 1:N Quote, paso 1 de 2) — 🟡 PARCIAL

> **Sigue en 🟡 PARCIAL, y ahora por UN SOLO motivo.** El **paso 1 (esquema)** ya está en las TRES
> bases: staging, producción y `yaqu_dev_javier` (este último confirmado por Javier el 29-jul-2026
> con `migrate diff` VACÍO — ver el checkbox de desarrollo). Lo que queda es el **paso 2, el
> BACKFILL** de los 42 pares job↔quote, que no se ha ejecutado en ninguna BD (bloque aparte abajo).
> PARCIAL sigue siendo correcto, pero el MOTIVO cambió: ya no es un checkbox de base pendiente
> —esos están los tres—, es solo el backfill.

- [x] **staging · acela/railway** — aplicado 28-jul-2026 con GO del fundador tras preview.
- [x] **desarrollo · acela/yaqu_dev_javier** — aplicado **28-jul-2026** (en el mismo push de las 6
      aditivas con GO del fundador; `job_id` entre ellas). **VERIFICADO 29-jul-2026 por Javier, no
      por suposición:** con el destino confirmado por host ANTES de correr (`host=acela.proxy.rlwy.net
      · db=yaqu_dev_javier`), el comando `npx prisma migrate diff --from-schema-datasource
      prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` (URL en el entorno,
      no en argv — SCRUM-196) devolvió **`-- This is an empty migration.`** → la columna y el índice
      YA estaban. Nota de orden: iba ANTES que prod a propósito, pero el 29-jul prod se adelantó por
      INCIDENCIA (estaba caída con `P2022` sobre `quotes.job_id`, la home no cargaba), no por descuido.
- [x] **producción · autorack** — aplicado **29-jul-2026** con GO del fundador tras preview
      propio, en tanda aparte de staging. **Verificación: el `migrate diff` posterior salió
      VACÍO.** Motivo del adelanto: incidencia en producción (`P2022` en `quotes.job_id`).

**SQL aplicado** (aditivo puro; el preview contra la BD real de staging dio exactamente esto,
o sea que no había deriva por otro lado):

```sql
ALTER TABLE "quotes" ADD COLUMN "job_id" INTEGER;
CREATE INDEX "quotes_merchantId_job_id_idx" ON "quotes"("merchantId", "job_id");
```

**Nullable y SIN FK, a propósito** (decisión del fundador, SCRUM-195): coherencia con el resto
del schema, reversibilidad (`DROP COLUMN` limpio, sin constraint que arrastre) y sobre todo
porque la FK que importaría aquí es `onDelete`, y eso ya se decidió en SCRUM-192 — servicio de
borrado, no cascadas. **La integridad `Quote.jobId → Job.id` la sostiene el CÓDIGO.**

**Medición previa al backfill** (solo lectura, host-check en las dos):

| | staging (`railway`) | producción (`autorack`) |
|---|---|---|
| pares job↔quote | 3 | 42 |
| jobs con `quote_id` NULL | 0 | 0 |
| quotes sin job | 0 | 83 |
| referencias rotas | **0** | **0** |
| quotes con >1 job | **0** | **0** |

**El backfill NO se ha ejecutado todavía** — la columna está a NULL en las 3 filas de staging.
Los 83 quotes sin job de producción son los no aceptados: es correcto que se queden a NULL.

⚠️ **Verificado contra la BD, no por el mensaje de `db push`**: `job_id integer nullable=YES`,
índice presente, y **`job_id` sin FK** (las 3 FKs de `quotes` son de `chargeId`, `customerId` y
`merchantId`).

### SCRUM-195 · PASO 2 de 2 · backfill de `quotes.job_id` — ⛔ NO EJECUTADO en ninguna BD

> **✋ DECLARACIÓN MANUAL, SIN MECANISMO (SCRUM-225).** Esto es estado de los DATOS, y es el
> ejemplo que mejor enseña por qué la distinción hace falta: la columna `quotes.job_id` **existe
> en las tres bases**, así que el censo de SCRUM-222 responde «en sync» — correctamente — mientras
> las filas siguen a NULL. `information_schema` no ve datos y nunca los verá. Los checkboxes de
> aquí abajo valen lo que valga la palabra de quien los marcó.
>
> ### 🗄️ FUERA DE ALCANCE — decisión del fundador, 2-ago-2026 (caduca, ver abajo)
>
> **Este backfill NO se va a ejecutar**, y la razón no es técnica: **todas las cuentas que hay hoy
> en producción son de prueba**, así que rellenar 42 pares de datos falsos no vale nada. Lo que
> importa es que los registros NUEVOS nazcan correctos. **Esta decisión caduca el día que entre el
> primer cliente real** — de ahí la fecha. Regla completa en `docs/YAQU_MASTER.md`.
>
> ### 🔬 Y AL MEDIRLO APARECIÓ ALGO QUE EL TÍTULO DE ESTA ENTRADA NO DICE
>
> «🟡 PARCIAL, solo falta el backfill» sugiere que lo único pendiente son datos. **No es eso.**
> Leído el camino de creación (no inferido del NULL, 2-ago-2026): **nadie escribe `Quote.jobId` y
> nadie la lee.** Los dos únicos sitios que crean un `Quote` —`quotes/app/routes/quotes.routes.ts`
> (`tx.quote.create`) y `maintenance/domain/maintenance.service.ts` (`tx.quote.create`)— tienen su
> bloque `data` completo y ninguno la menciona; ningún `update` la toca. Y las dos únicas
> apariciones de `Quote.jobId` en `src/` son **comentarios en futuro** de `jobs/domain/job.service.ts`
> («cuando llegue el 1:N este `findUnique` pasa a mirar `Quote.jobId`»). Hoy el vínculo Job↔Quote
> va por `Job.quoteId`, la dirección contraria, y funciona.
>
> O sea: **la columna no tiene consumidor.** Lo que falta no es el backfill, es la funcionalidad
> 1:N para la que se creó. Si alguien hiciera el backfill mañana, no cambiaría nada — y por eso
> tampoco hay aquí ningún defecto que se lleve por delante a un cliente real: nada la consulta.

- [ ] **staging · acela/railway** — pendiente (3 filas, todas a NULL).
- [ ] **desarrollo · acela/yaqu_dev_javier** — pendiente (va detrás de su paso 1).
- [ ] **producción · autorack** — pendiente (42 pares job↔quote a rellenar).

**Qué falta:** el paso 1 solo creó la columna; **nadie ha escrito un solo valor en ella**. Hoy
`quotes.job_id` está a NULL en las tres BD, incluida producción tras el push del 29-jul.

**Por qué el paso 1 aguanta solo, sin dejar nada inconsistente** (y por eso adelantarlo para
arreglar la incidencia fue seguro): la columna es `nullable` y **sin FK**, así que una fila sin
valor es un estado válido, no una integridad rota. La relación `Quote.jobId → Job.id` **la
sostiene el CÓDIGO** (decisión SCRUM-195, ver arriba), y staging lleva desde el 28-jul con la
columna entera a NULL sin incidencias. El `P2022` que tiró la home era *la columna no existe*,
no *la columna está vacía*.

**Lo que sí queda a medias mientras tanto:** cualquier consulta que espere `job_id` RELLENO leerá
NULL. No rompe, pero tampoco relaciona: hasta el backfill, el vínculo Job↔Quote sigue viviendo
solo donde vivía antes.

**No se planifica aquí**: cuándo y con qué SQL se hace el backfill, y si necesita GO, es
decisión del fundador y lleva su propio preview por BD. Lo que este bloque fija es que **está
pendiente y es visible**, en vez de quedar como una frase suelta dentro del paso 1.

**Lo que ya está medido y no hay que volver a medir** (tabla de arriba): **0 referencias rotas**
y **0 quotes con más de un job** en las dos BD, así que el backfill no tiene ambigüedad que
resolver. Y los **83 quotes sin job** de producción se quedan a NULL a propósito: son los no
aceptados.

<!-- ─── LÍNEA DE CORTE · SCRUM-169 (2026-07-27) ─────────────────────────────────────────
     A partir de esta línea HACIA ARRIBA, cada entrada NUEVA lleva los tres checkboxes:
       [ ] staging · acela/railway    [ ] desarrollo · acela/yaqu_dev_javier    [ ] producción · autorack
     Una entrada por ENCIMA sin las tres = migración NO aplicada (fallo detectable).
     Lo de DEBAJO es historia previa a la regla: NO retrofitada a propósito — marcar 25 entradas
     por suposición serían checkboxes que parecen evidencia y no lo son. ──────────────────── -->

## SCRUM-145d · `invoices.vf_anul_prev_hash` (eslabon de la anulacion) — APLICADO en staging y prod (2026-07-24)

```sql
ALTER TABLE "invoices" ADD COLUMN     "vf_anul_prev_hash" TEXT;
```

- **Preview identico contra las dos BD** antes de aplicar: 1 ADD COLUMN nullable, 0 DROPs,
  0 ALTER de columnas existentes. Host-check en cada push (`acela` = staging, `autorack` = prod)
  y `git diff origin/main -- prisma/schema.prisma` VACIO antes de cada uno.
- **Para que:** el `RegistroAnterior` del registro de ANULACION se resolvia por SELLO (el
  registro inmediatamente anterior). Es fragil justo donde no puede serlo: con dos anulaciones
  proximas los sellos pueden empatar o invertirse, y una cadena de huellas se sella PARA
  SIEMPRE. Ahora se guarda la huella que de verdad se hasheo — un dato, no una inferencia.
- **Verificado tras cada push:** la columna existe en `information_schema` y una lectura real
  de `invoices` la devuelve (55 filas en prod). Cliente Prisma regenerado DESPUES de cada push.
- **Inerte:** ninguna factura tiene aun registro de anulacion (no existe el disparador de la
  FSM — ver SCRUM-153); todo sigue tras `INVOICING_ES_ENABLED` OFF.

## SCRUM-145 · `invoices.vf_timestamp` + `vf_anul_hash` + `vf_anul_timestamp` (VeriFactu) — ✅ APLICADO en prod (2026-07-24)

```sql
ALTER TABLE "invoices" ADD COLUMN     "vf_anul_hash" TEXT,
ADD COLUMN     "vf_anul_timestamp" TIMESTAMP(3),
ADD COLUMN     "vf_timestamp" TIMESTAMP(3);
```

- **Preview real** (`prisma migrate diff` contra staging, 24-jul): exactamente esas 3
  sentencias. **0 DROPs, 0 ALTER de columnas existentes**, las 3 nullable → aditiva pura.
- **Para qué:** `vf_timestamp` guarda el instante EXACTO (con huso) que entró en el cálculo de
  la huella — hoy el registro emite el momento de la FACTURA, que no es el que se hasheó, así
  que un tercero **no puede recomputar la huella**. `vf_anul_hash`/`vf_anul_timestamp` son del
  registro de **anulación**, que es un registro distinto con su propia huella (regla 29: la
  factura anulada conserva la suya).
- ⚠️ **ORDEN OBLIGATORIO (dos schemas en vuelo, 24-jul):** antes de empujar, `git pull` y
  comprobar que el `schema.prisma` local contiene **todo** lo que hay en `main`. Empujar desde
  un schema viejo **borraría columnas ajenas** de staging — estuvo a punto de pasar dos veces
  el mismo día. El preview de arriba se hizo con `schema.prisma` **idéntico a `main`**
  (verificado con `git diff origin/main -- prisma/schema.prisma`, vacío).
- ⚠️ **NO regenerar el cliente Prisma antes del push a staging:** el `node_modules` está
  compartido por junction entre worktrees; un cliente con estas columnas contra una BD que aún
  no las tiene rompe cualquier lectura de `invoices` (`SELECT` de columna inexistente) — y con
  ello los tests gateados de la OTRA sesión.
- **Estado:** staging ✅ (24-jul) · **prod ✅ (24-jul)** — mismo diff exacto en los dos, con
  host-check (`autorack` = prod, `acela` = staging) y `schema.prisma` idéntico a `main`
  verificado con `git diff origin/main` VACÍO antes de cada push.
- **Verificado tras el push a prod:** las 3 columnas existen en `information_schema` y una
  lectura real de `invoices` (55 filas) devuelve los campos nuevos sin error.
- ⚠️ **El cliente Prisma compartido estaba STALE al verificar** (otra sesión lo había
  regenerado desde un `main` anterior al merge), así que la primera lectura falló con
  «Unknown field vfTimestamp» aunque la columna SÍ estaba en la BD. Se regeneró DESPUÉS del
  push —el orden correcto— y quedó verde. Es el mismo riesgo que documenta el runbook, visto
  ahora desde el otro lado: un cliente viejo también miente.
- **Inerte hasta entonces:** ningún código lee ni escribe estas columnas todavía; todo el
  registro sigue tras `INVOICING_ES_ENABLED` OFF (regla 24).

## SCRUM-109 · `expenses.team_member_id` — ✅ APLICADO en prod (2026-07-23)

```sql
ALTER TABLE "expenses" ADD COLUMN     "team_member_id" INTEGER;
CREATE INDEX "expenses_merchant_id_team_member_id_idx" ON "expenses"("merchant_id", "team_member_id");
```

100 % aditivo (columna nullable, sin backfill, 0 DROPs) — mismo patrón que `Job.operarioId`
(SCRUM-52): autoría del gasto (`null` = propietario), sin relación Prisma declarada a
propósito. Aplicado con `scripts/db-push-prod`, host-check + preview `migrate diff` +
verificación post vacía, en el orden de SCRUM-102: **STAGING** (`acela.proxy.rlwy.net:40802`)
primero → **GO explícito del fundador** → **PRODUCCIÓN** (`autorack.proxy.rlwy.net:40654`),
ambas con diff idéntico y verificación vacía. `createExpense` ya la rellena con
`req.teamMemberId` en el `POST /admin/expenses` (abierto a técnico desde SCRUM-107 V1); el
filtrado row-level (GET/PUT/DELETE por autor) es la V2 de SCRUM-107, carril B (Javier).

## SCRUM-102 · `merchants.is_platform_owner` (segundo factor del gate owner) — ✅ APLICADO en prod (2026-07-23)

`bash scripts/db-push-prod` (SCRUM-40, procedimiento canónico) aplicado primero a **STAGING**
(`acela.proxy.rlwy.net:40802`) y luego a **PRODUCCIÓN** (`autorack.proxy.rlwy.net:40654`), ambos
con host-check + preview `migrate diff` + **GO explícito del fundador**, **SIN
`--accept-data-loss`**. 100 % aditivo, sin el falso positivo del `@unique` (esta columna no lo
lleva):
```sql
ALTER TABLE "merchants" ADD COLUMN "is_platform_owner" BOOLEAN NOT NULL DEFAULT false;
```
Verificación post-push: `migrate diff` vacío en ambos entornos.

**Orden deliberado (decisión del fundador, para evitar la ventana de auto-bloqueo):** schema a
staging → tests gateados → schema a PROD (columna nace en `false` para los 13 merchants, inofensivo
mientras el código viejo — que no la lee — sigue desplegado) → **UPDATE marcando los owners en
PROD** → recién entonces se mergea el PR que despliega el código nuevo. Con el orden inverso habría
una ventana entre el deploy y el UPDATE en la que el propio fundador perdería su acceso a
`fees.csv`/`platform-funnel`/paywall.

UPDATE aplicado en prod inmediatamente después del `db push`, vía `prisma.merchant.updateMany`
(mismo host, misma sesión, sin exponer el email en el historial de shell más de lo necesario):
```sql
UPDATE merchants SET is_platform_owner = true WHERE email = 'luislaragranado@gmail.com';
-- 1 row affected (verificado: SELECT tras el UPDATE devuelve exactamente esa fila con true;
-- y un segundo SELECT confirma que es la ÚNICA fila con isPlatformOwner=true de los 13
-- merchants totales en prod)
```

**Por qué:** `GET /admin/exports/fees.csv` (facturación de TODA la plataforma) y
`/admin/metrics/platform-funnel` dependían SOLO de `isOwnerEmail()` — comparación contra la env
var `OWNER_EMAILS`. Precedente SCRUM-99: un secreto de webhook faltó en producción sin que nadie
lo supiera; las env vars se caen o se escriben mal. `isVerifiedPlatformOwner()` (`env.ts`) ahora
exige AMBOS factores — email en `OWNER_EMAILS` Y `Merchant.isPlatformOwner=true` en BD — para los
4 usos reales del gate owner (fees.csv, platform-funnel, perk "Pro sin caducidad" en
`GET /admin/me`, exención de paywall en `requireActivePlan`). Ver SCRUM-102 y
`docs/AUDITORIA_SUPERFICIE_PUBLICA.md` (hallazgo MEDIO #10 de SCRUM-88).

## SCRUM-74 · `charges.receipt_token` (fuga RGPD `/recibo/:chargeId` enumerable) — ✅ APLICADO en prod (2026-07-22)

`prisma db execute` (NO `db push`) aplicado a **STAGING** (`acela.proxy.rlwy.net:40802`) el
**2026-07-22**, con host-check + preview `migrate diff`, **SIN `--accept-data-loss`**, **GO
explícito del fundador** tras el preview. Verificación post: consulta directa a
`information_schema.columns`/`pg_indexes` en staging confirma la columna y el índice creados
(la lectura holística de `migrate diff` da ruido en este momento por los cambios de SCRUM-17,
`albaranes.invoice_id`/`invoices.albaran_refs`, aplicados a staging pero aún sin mergear a
`main` — ver coordinación en el PR; NO relacionado con este cambio). 100 % aditivo:
```sql
ALTER TABLE "charges" ADD COLUMN "receipt_token" TEXT;
CREATE UNIQUE INDEX "charges_receipt_token_key" ON "charges"("receipt_token");
```
**Por qué `db execute` y no `db push`:** mismo falso positivo del `@unique` sobre columna nueva
que `albaranes.firma_token` (SCRUM-49) y `merchants.slug` (EXT3) — Prisma no puede verificar en
tiempo de diff que no haya duplicados en `receipt_token`, aunque nace toda `NULL` (0 duplicados
posibles). `--accept-data-loss` vetado (regla 3/AA2) → SQL auditado vía `db execute`, idéntico
al del preview.

`Charge.receiptToken` — token OPACO (128 bits, patrón `Albaran.firmaToken`) para el recibo
público `/recibo/:token[/pdf|/feedback]`, sustituyendo el `Charge.id` autoincremental y
adivinable (IDOR/RGPD: NIF del emisor, nombre/email/teléfono del cliente final, importes).
Generado perezosamente la primera vez que se construye un enlace.

**PROD: ✅ APLICADO** (2026-07-22, justo tras el merge del PR de SCRUM-74). `prisma db execute`
contra `autorack.proxy.rlwy.net:40654` con host-check + preview `migrate diff` (idéntico al de
staging, sin ruido esta vez — SCRUM-17 ya estaba aplicado en prod) y **GO explícito del
fundador**, **SIN `--accept-data-loss`**. Verificación post: `migrate diff` → **"No difference
detected"** (exit 0, BD en sync).

---

## SCRUM-17 · `albaranes.invoice_id` + `invoices.albaran_refs` (factura recapitulativa) — ✅ APLICADO en prod (2026-07-22)

`prisma db push` aplicado a **STAGING** (`acela.proxy.rlwy.net`) y a **PRODUCCIÓN**
(`autorack.proxy.rlwy.net:40654`) el **2026-07-22**, ambos con host-check + preview `migrate diff`,
**SIN `--accept-data-loss`** (Prisma no lo pidió = 100 % aditivo). El de prod, **autorizado por el
fundador** (GO explícito tras el preview) vía el sentinel de un solo uso del hook `guard-dangerous`
(`.claude/allow-db-push`), aplicado tras el merge del **PR #52**. Verificación post-push en ambos:
`migrate diff` → **"empty migration"** (BD en sync). 3 operaciones aditivas (2 columnas nullable + 1 índice):
```sql
ALTER TABLE "albaranes" ADD COLUMN "invoice_id" INTEGER;
ALTER TABLE "invoices"  ADD COLUMN "albaran_refs" JSONB;
CREATE INDEX "albaranes_merchant_id_invoice_id_idx" ON "albaranes"("merchant_id","invoice_id");
```
`Albaran.invoiceId` (recapitulativa que consolidó el albarán; badge "Facturado" derivado) +
`Invoice.albaranRefs` (`[{albaranId, numero, fecha}]`, operaciones agrupadas). La feature es LATENTE
tras `INVOICING_ES_ENABLED=OFF` (nada activo a reales), pero las columnas se aplican para que el código
(que lee `invoiceId`/escribe `albaranRefs` al consolidar en demo) no dé P2022. El endpoint hace
`findMany`/`updateMany` sobre `invoice_id` → se aplicó de inmediato tras el merge.

---

## SCRUM-66 · `jobs.tipo_operacion` (varias sueltas vs trabajo único) — ✅ APLICADO en prod (2026-07-22)

`prisma db push` aplicado a **STAGING** (`acela.proxy.rlwy.net`) y a **PRODUCCIÓN**
(`autorack.proxy.rlwy.net:40654`) el **2026-07-22**, ambos con host-check + preview `migrate diff`,
**SIN `--accept-data-loss`** (Prisma no lo pidió = confirmación de que no había pérdida de datos).
El de prod, **autorizado por el fundador** (GO explícito tras el preview) vía el sentinel de un solo
uso del hook `guard-dangerous` (`.claude/allow-db-push`), aplicado tras el merge del **PR #43**.
Verificación post-push en ambos: `migrate diff` → **"empty migration"** (BD en sync). 100 % aditivo,
una sola columna **NOT NULL con default** → los Jobs existentes quedan en `TRABAJO_UNICO` sin backfill:
```sql
ALTER TABLE "jobs" ADD COLUMN "tipo_operacion" TEXT NOT NULL DEFAULT 'TRABAJO_UNICO';
```
`Job.tipoOperacion` (`OPERACIONES_SUELTAS|TRABAJO_UNICO`): distingue varias operaciones sueltas
(recapitulativa mensual, art. 13) de un trabajo único (factura al concluir). El código lo lee/escribe
en `PATCH /admin/jobs/:id` y lo expone en `serializeJob` → aplicado tras el merge para cerrar la
ventana de P2022 del auto-deploy. El motor que RESPETA la bandera es SCRUM-17 (aún no construido).

---

## SCRUM-68 · `albaranes.evidencia_firma` (evidencias probatorias de la firma) — ✅ APLICADO en prod (2026-07-22)

`prisma db push` aplicado a **STAGING** (`acela.proxy.rlwy.net`) el **2026-07-22**, con host-check +
preview `migrate diff`, **SIN `--accept-data-loss`**. Post-push staging: `migrate diff` → **"empty
migration"**. 100 % aditivo, una sola columna **nullable sin default** (no hay UNIQUE → `db push`
NO pide `--accept-data-loss`):
```sql
ALTER TABLE "albaranes" ADD COLUMN "evidencia_firma" JSONB;
```
Guarda `{ v, canal(remoto|in_situ), firmadoAt, ip, ua, tokenId, firmante, hashAlg, contentHash }` al
firmar. El `contentHash` es SHA-256 del **contenido canónico** del albarán (no del PDF). ⚠️ `ip`/`ua`
son datos personales → viven SOLO en esta columna; NUNCA se exponen (serializer, PDF y HTML público
los omiten — cubierto por test).

**PROD: ✅ APLICADO** (2026-07-22, justo tras el merge del **PR #38**). `prisma db push` contra
`autorack.proxy.rlwy.net:40654` con host-check + preview `migrate diff` (una sola sentencia
`ADD COLUMN evidencia_firma JSONB`) y **GO explícito del fundador** vía el sentinel de un solo uso del
hook `guard-dangerous` (`.claude/allow-db-push`), **SIN `--accept-data-loss`** (Prisma no lo pidió =
confirmación de que era 100 % aditivo). Resultado: *"Your database is now in sync"* en 6,68 s.
Verificación post-push: `migrate diff` → **"empty migration"** (BD en sync). Se aplicó de inmediato tras
el merge para cerrar la ventana de P2022: los handlers de firma escriben `evidenciaFirma` en cada firma.

---

## SCRUM-49 · `albaranes.firma_token` + `enviado_para_firma_at` (firma remota) — ✅ APLICADO en prod (2026-07-16)

`prisma db execute` (NO `db push`) aplicado a **STAGING** (`acela.proxy.rlwy.net`) y a **PRODUCCIÓN**
(`autorack.proxy.rlwy.net`) el **2026-07-16**, con host-check + preview `migrate diff`, **SIN
`--accept-data-loss`**. Verificación post en ambos: `migrate diff` → **"empty migration"** (BD en
sync). El de prod, **autorizado por el fundador** (GO explícito tras el preview), aplicado justo tras
el merge para cerrar la ventana de P2022 del auto-deploy. 100 % aditivo:
```sql
ALTER TABLE "albaranes" ADD COLUMN "enviado_para_firma_at" TIMESTAMP(3),
                        ADD COLUMN "firma_token" TEXT;
CREATE UNIQUE INDEX "albaranes_firma_token_key" ON "albaranes"("firma_token");
```
**Por qué `db execute` y no `db push`:** `db push` exigía `--accept-data-loss` por el **falso
positivo del UNIQUE sobre columna nueva** — Prisma no puede verificar en tiempo de diff que no haya
duplicados en `firma_token`, aunque la columna nace toda `NULL` (0 duplicados posibles). El flag está
vetado (regla 3/AA2), así que se aplica el SQL auditado vía `db execute` (**mismo patrón que el
`@unique` de `merchants.slug` en el lote EXT3**, ver abajo). El SQL es idéntico al del preview.

**PROD: ✅ APLICADO** (2026-07-16, justo tras el merge). El código referencia `firmaToken`/
`enviadoParaFirmaAt` (los handlers de albarán hacen `findFirst`/`findUnique` sin `select` → `RETURNING`
todas las columnas), así que se aplicó de inmediato para cerrar la ventana de P2022 del auto-deploy.
Token opaco (128 bits) para la página pública `/albaran/:token`.

---

## SCRUM-52 · `jobs.operario_id` + índice (base de SCRUM-22) — ✅ APLICADO en prod (2026-07-15)

`prisma db push` aplicado a **STAGING** (`acela.proxy.rlwy.net`) y a **PRODUCCIÓN**
(`autorack.proxy.rlwy.net:40654`) el **2026-07-15**, ambos con host-check + preview
`migrate diff` mostrado al fundador, **SIN `--accept-data-loss`** (100 % aditivo; Prisma
no lo pidió = confirmación de que no había pérdida de datos). El de prod, **autorizado por
el fundador** (GO explícito tras el preview) vía el sentinel de un solo uso del hook
`guard-dangerous` (`.claude/allow-db-push`). Test gateado `tests/scrum52-operario.test.mjs`
verde contra staging (poblado operarioId + audit `operario_asignado` + índice en `pg_indexes`).
Verificación post-push en prod: `migrate diff` → **"empty migration"** (BD en sync). Preview exacto:
```sql
ALTER TABLE "jobs" ADD COLUMN "operario_id" INTEGER;
CREATE INDEX "jobs_merchant_id_operario_id_idx" ON "jobs"("merchant_id", "operario_id");
```
Columna nullable (null = propietario) + índice compuesto `(merchant_id, operario_id)`;
documento NO fiscal (regla 24).

---

## SCRUM-14 · ALBARAN-1: tabla `albaranes` + contadores en `merchants` — ✅ APLICADO en prod (2026-07-13)

`prisma db push` aplicado a **STAGING** el 13-jul-2026 y a **PRODUCCIÓN** el 13-jul-2026
tras el merge del PR #8, ambos **autorizados por el fundador** (preview `migrate diff`
enseñado en cada caso; el de prod se ejecutó SIN `--accept-data-loss` por orden expresa —
con diff aditivo no hace falta, y si Prisma pidiera confirmación sería señal de diff
inesperado → abortar). Verificación post-push en prod: `migrate diff` → **empty migration**.
100 % aditivo; el preview mostró exactamente:
```sql
ALTER TABLE "merchants" ADD COLUMN "albaran_series_year" INTEGER,
                        ADD COLUMN "next_albaran_number" INTEGER NOT NULL DEFAULT 1;
CREATE TABLE "albaranes" (…);  -- + índices (merchant_id,job_id) y UNIQUE (merchant_id,numero)
```
Documento NO fiscal (regla 24): fuera de VeriFactu.

---

## FASE 3 · MEDIA-1: `attachments.data/mime` — ✅ APLICADO en prod (2026-07-07)

`prisma db push` aplicado contra Railway, **autorizado por el fundador** (eligió backend
"Postgres ahora" para las fotos del bot). 100 % aditivo, 2 columnas nullable; preview con
`migrate diff` mostró exactamente:
```sql
ALTER TABLE "attachments" ADD COLUMN "data" BYTEA,
                          ADD COLUMN "mime" TEXT;
```
Almacenamiento de fotos entrantes de WhatsApp en Postgres (bytea) al no haber R2; el modelo
`Attachment` abstrae el backend (migrar a R2 luego = plug-in). Aplicado ANTES de pushear el
código de FASE 3. `db push` → "Your database is now in sync" en 6,68 s.

---

## A3.1 · BOT-1: `bot_sessions` + `quote_requests.zone/source` — ✅ APLICADO en prod (2026-07-03)

`prisma db push` aplicado contra Railway, **autorizado por el fundador** (respuesta explícita
"Sí, aplica el db push"). 100 % aditivo; post-push `migrate diff` → "empty migration":
- `CREATE TABLE bot_sessions` (sesiones del bot K1: phone, merchant_id, state, data, expires_at +24h) + índice (phone, expires_at)
- `ALTER TABLE quote_requests ADD COLUMN zone TEXT, ADD COLUMN source TEXT`
El bot queda inerte hasta `BOT_INBOUND_ENABLED=true` (Railway, acción fundador).

---

## A2.1 · Connect/Bizum/payMethods — ✅ APLICADO en prod (2026-07-03)

`prisma db push` aplicado contra Railway, **autorizado por el fundador** (respuesta explícita
"Sí, aplica el db push" al diff mostrado). 100 % aditivo, 5 operaciones; post-push verificado
`migrate diff` → "empty migration":
```sql
ALTER TABLE "merchants" ADD COLUMN "stripe_account_id" TEXT,
                        ADD COLUMN "connect_status" TEXT NOT NULL DEFAULT 'none',
                        ADD COLUMN "bizum_phone" TEXT;
ALTER TABLE "quotes"    ADD COLUMN "pay_methods" JSONB;
ALTER TABLE "charges"   ADD COLUMN "pay_methods" JSONB;
```
Soporta CONNECT-1 (C1-0..C1-2), Bizum manual (C1-4) y el selector de métodos por
presupuesto/cobro. Aplicado ANTES de pushear el código (commits A2.1–A2.3).

---

## A1.2 · `quotes.quote_number` + `merchants.next_quote_number` — ✅ APLICADO en prod (2026-07-02)

`prisma db push` aplicado contra Railway, **autorizado por el fundador** (sprint DEMO-READY,
OK explícito tras preview). Aplicó SIN `--accept-data-loss` (Prisma no lo pidió = confirmación
de que era 100 % aditivo). Diff previsualizado, 2 operaciones:
```sql
ALTER TABLE "merchants" ADD COLUMN "next_quote_number" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "quotes"    ADD COLUMN "quote_number"      INTEGER;
```
Numeración de presupuestos POR MERCHANT (el id global delataba el volumen de la plataforma:
el primer presupuesto de un merchant nuevo salía "#47"). Aplicado ANTES de pushear el código.
Post-deploy: backfill con `scripts/backfill-quote-numbers.mjs --apply` (dry-run primero).

---

## WA-0b · tabla `whatsapp_messages` — ✅ APLICADO en prod (2026-06-13)

`prisma db push` aplicado contra Railway, **autorizado por el fundador** ("dame OK para el
push"). 100 % aditivo (tabla nueva + 3 índices, sin ALTER/DROP). Post-push: `migrate diff`
→ "empty migration" (BD en sync). El log de entrega de WhatsApp y el chip ya operan sobre
datos reales en cuanto haya envíos.

---

## V0-3 · `merchants.acquisition_source` + `quotes.created_via` — ✅ APLICADO en prod (2026-06-12)

`prisma db push` aplicado contra Railway, **autorizado por el usuario** (además pre-autorizó
los db push 100% aditivos del resto del sprint VALIDA-0, siempre con preview verificado).
Diff previsualizado, 2 operaciones aditivas nullable:
```sql
ALTER TABLE "merchants" ADD COLUMN "acquisition_source" TEXT;
ALTER TABLE "quotes" ADD COLUMN "created_via" TEXT;
```
Post-push verificado: `migrate diff` → "empty migration" (BD en sync). Aplicado ANTES de
pushear el código de V0-3.

---

## J3 · `customers.wa_opt_out` (baja de WhatsApp) — ✅ APLICADO en prod (2026-06-11)

`prisma db push` aplicado contra `autorack.proxy.rlwy.net` (Railway), **autorizado por el
usuario** (vía sentinel del hook guard-dangerous). Diff previsualizado con `migrate diff`,
100% aditivo (una sola operación):
```sql
ALTER TABLE "customers" ADD COLUMN "wa_opt_out" BOOLEAN NOT NULL DEFAULT false;
```
Aplicado ANTES de pushear el código de J3 (el código referencia `waOptOut`; en orden
inverso Prisma habría dado P2022 en prod).

Verificación post-push pendiente en yaqu.app: editar un cliente marcando "Baja de
WhatsApp" y comprobar que el envío de presupuesto a ese cliente devuelve `reason: wa_opt_out`.

---

## SPAIN-2 · Factura rectificativa — ✅ APLICADO en prod (2026-06-10)

`prisma db push` aplicado contra `autorack.proxy.rlwy.net` (Railway), autorizado por el usuario.
Diff previsualizado con `migrate diff`, 100% aditivo:
- `ALTER TABLE invoices ADD COLUMN type TEXT NOT NULL DEFAULT 'F1'` (F1 | R1)
- `ALTER TABLE invoices ADD COLUMN rectifies_id INTEGER` (nullable, FK self a invoices.id, ON DELETE SET NULL)
- `ALTER TABLE merchants ADD COLUMN next_rect_invoice_number INTEGER NOT NULL DEFAULT 1` (serie R)

---

## SPAIN-1 · Serie anual de facturación — ✅ APLICADO en prod (2026-06-10)

`prisma db push` aplicado contra `autorack.proxy.rlwy.net` (Railway), autorizado por el usuario.
Diff previsualizado con `migrate diff` y confirmado seguro (3 operaciones, sin pérdida de datos):
- `ALTER TABLE merchants ADD COLUMN invoice_series_year INTEGER` (nullable, aditivo)
- `DROP INDEX invoices_number_key` (unique global de `number` — colisionaba entre merchants con el mismo prefijo)
- `CREATE UNIQUE INDEX invoices_merchantId_number_key ON invoices(merchantId, number)` (la serie es del emisor)

El create del índice compuesto no podía fallar: no existían duplicados `(merchantId, number)`
(el unique global previo lo garantizaba). Nadie consulta facturas por `number` solo (verificado por grep).

---

## ENT-3 · `CustomerEvent` (historial de comunicaciones) — ✅ APLICADO en prod (2026-06-05)

`prisma db push` aplicado contra `autorack.proxy.rlwy.net` (Railway). Diff confirmado
solo aditivo (CREATE TABLE customer_events + 2 índices + 2 FKs, sin DROP/ALTER).
Verificado: `customerEvent.count()` = 0. Instrucciones abajo conservadas como referencia.

---

### (Referencia) ENT-3 · `CustomerEvent`

**Commit del código:** ver feat(enterprise) ENT-3.
**Tabla nueva:** `customer_events` (modelo `CustomerEvent` en `prisma/schema.prisma`).
**Solo aditivo** (no toca tablas existentes): seguro con `db push`.

El código es tolerante: si la tabla aún no existe, `recordCustomerEvent` y
`listCustomerEvents` capturan el error y la app sigue funcionando (no se registra
ni se muestra historial hasta aplicar el push).

### Cómo aplicar (con la DATABASE_URL de PRODUCCIÓN)

```bash
# 1) Apuntar a la BD de prod (NO usar la de dev). Por ejemplo, temporalmente:
#    set DATABASE_URL=postgresql://...autorack.proxy.rlwy.net.../railway   (la real de Railway)
# 2) Aplicar el schema (sin TTY, como exige este entorno):
npx prisma db push --accept-data-loss
# 3) En Windows, si el DLL queda bloqueado tras el push: matar node y:
npx prisma generate
```

> Nota: `--accept-data-loss` aquí es seguro porque el cambio es **solo añadir** la tabla
> `customer_events`; no elimina ni altera columnas existentes. Verificar el diff antes si hay dudas.

### Verificación post-push
- En el dashboard, abrir la ficha 360 de un cliente con actividad (envía un presupuesto,
  acéptalo, etc.) → debe aparecer la sección "Actividad reciente".
- `GET /admin/customers/:id/detail` debe devolver `events: [...]`.

---

## 5-jul-2026 — A6.7 Home personalizable (APLICADA ✅)

```sql
ALTER TABLE "merchants" ADD COLUMN "home_prefs" JSONB;
```

- Aditiva y anulable; aprobada por el fundador en sesión (AskUserQuestion) y aplicada
  con `npx prisma db push` tras preview del diff. Default lógico: todo visible
  (null = sin preferencias).

### Verificación post-push
- Home → botón "Personalizar" → desmarcar un bloque → Guardar → recargar: el bloque
  sigue oculto (persistencia en BD, no en el navegador).

---

## 5-jul-2026 — A10.1 evidencia legal (APLICADA ✅)

```sql
CREATE TABLE "legal_acceptances" (id, merchant_id, team_member_id NULL, doc_key, version, ip NULL, user_agent NULL, created_at);
CREATE INDEX ON legal_acceptances(merchant_id, doc_key);
```

- Aditiva; aprobada por el fundador en sesión (AskUserQuestion, EXT3 A10.1).
- Evidencia de aceptación del ALCANCE BETA (regla 25): version = hash del texto
  servido en /legal/alcance-beta → texto nuevo del asesor invalida aceptaciones.

### Verificación post-push
- Planes → "Quiero mi plaza founding" → modal con iframe del alcance + checkbox
  → aceptar → fila en legal_acceptances → checkout continúa. Sin aceptar: 412.

---

## 5-jul-2026 — LOTE EXT3 completo (APLICADO ✅, una aprobación)

```sql
ALTER TABLE merchants ADD subscription_status, slug (+unique), slug_changed_at, profile_zones, profile_years;
ALTER TABLE quotes    ADD origin, valid_until, doc_fields;
ALTER TABLE customers ADD legal_name, tax_id;
CREATE TABLE jobs (A13) · maintenance_plans (A15) · audit_log (A11.1) · attachments (Ola 19) + índices;
```

- 0 DROPs, todo aditivo; aprobado por el fundador en sesión (AskUserQuestion, EXT3).
- Aplicado vía `prisma db execute` con el SQL del diff AUDITADO (0 sentencias destructivas,
  14 aditivas): `db push` exigía --accept-data-loss por el falso positivo del UNIQUE sobre
  la columna slug recién creada (todo NULL — sin duplicados posibles) y ese flag está vetado.
- Todo nace INERTE: cada ola cablea su pieza; attachments espera credenciales R2.

---

## 27-jul-2026 — customers.billing_periodicity (SCRUM-171b) — APLICADO ✅ (staging + prod)

```sql
ALTER TABLE "customers" ADD COLUMN "billing_periodicity" TEXT NOT NULL DEFAULT 'NINGUNA';
```

- **Aditiva con DEFAULT**: con 44 filas en prod el ALTER es instantáneo y no reescribe la tabla
  (Postgres ≥ 11 guarda el default en el catálogo). Cero DROP, cero cambios sobre lo existente.
- `NINGUNA` de default = el comportamiento de hoy, intacto: ningún cliente empieza a avisar.
  Verificado tras aplicar: los 44 quedaron en `NINGUNA`.
- **Por qué DEFAULT aquí y `null` en `tipo_destinatario`** (su vecino de SCRUM-69): allí había
  ambigüedad que preservar —«nunca clasificado» ≠ «clasificado como particular», y el plazo legal
  depende de eso—. Aquí no: «sin pactar» y «sin periodicidad» son lo mismo.
- Sirve para AVISAR, nunca para facturar sola: un envío automático nuevo exigiría su entrada en
  la tabla J6 del máster (regla 28) y este ticket no la toca.
- Orden seguido en las dos BD: preview enseñado → host verificado contra la allowlist → staging
  sin otras sesiones → sentinel de un solo uso → `db push` → **verificado por
  `information_schema`** (`text`, `default='NINGUNA'::text`, `nullable=NO`) → `prisma generate`.

## 27-jul-2026 — albaran_lineas_facturadas (SCRUM-170) — APLICADO ✅ (staging + prod)

```sql
CREATE TABLE "albaran_lineas_facturadas" (
    "id" SERIAL NOT NULL,
    "merchant_id" INTEGER NOT NULL,
    "albaran_id" INTEGER NOT NULL,
    "linea_index" INTEGER NOT NULL,
    "invoice_id" INTEGER NOT NULL,
    "cantidad" DECIMAL(12,3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "albaran_lineas_facturadas_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "albaran_lineas_facturadas_merchant_id_albaran_id_idx" ON "albaran_lineas_facturadas"("merchant_id", "albaran_id");
CREATE INDEX "albaran_lineas_facturadas_merchant_id_invoice_id_idx" ON "albaran_lineas_facturadas"("merchant_id", "invoice_id");
```

- **Aditiva pura**: tabla nueva + 2 índices. Cero ALTER y cero DROP sobre lo existente, así que
  el código de hoy no la ve y sigue funcionando igual (nada la lee salvo lo de SCRUM-170).
- **Sin FK a propósito**, patrón multi-tenant de columna de esta casa (WhatsAppMessage). El
  barrido de merchants efímeros la cubre porque el modelo QUEDA REGISTRADO en
  `MODELOS_POR_MERCHANT` (`tests/_merchant-fixture.mjs`) — y va PRIMERO en la lista, antes que
  albaranes y facturas, o el borrado dejaría filas huérfanas sin que nada fallara (SCRUM-172).
- Es un LIBRO append-only: sus filas no se editan. Son el rastro de facturas ya emitidas
  (regla 29) y su suma tiene que seguir cuadrando con las líneas selladas en la huella.
- Orden seguido: preview enseñado → host comprobado contra la allowlist (`acela.proxy.rlwy.net`)
  → staging sin otras sesiones (`pg_stat_activity`) → sentinel de un solo uso → `db push` →
  **verificado leyendo `information_schema`**, no el mensaje del comando → `prisma generate`.
- PROD: aplicado el 27-jul-2026 con GO del fundador. Preview idéntico al de staging (0 ALTER,
  0 DROP), host verificado (`autorack.proxy.rlwy.net`), y comprobado DESPUÉS por
  `information_schema` + `pg_indexes`: 7 columnas, 2 índices + PK, 0 filas. La tabla nace
  vacía y nadie la lee todavía en prod (la ruta parcial exige albarán firmado, con precios
  y flag fiscal ON: en producción no se cumple ninguna de las tres).

## 29-jul-2026 — audit_log: índice por entidad (SCRUM-207) — staging ✅ · yaqu_dev_javier 🔴 · producción 🔴

> **✋ DECLARACIÓN MANUAL, SIN MECANISMO (SCRUM-225).** Es un ÍNDICE, y el censo de SCRUM-222
> declara que no mira índices — solo presencia de tabla y columna. Ningún verde de esa
> herramienta dice nada sobre estas tres marcas: se creen bajo la palabra de quien las escribió.

```sql
CREATE INDEX "audit_log_merchant_id_entity_type_entity_id_idx" ON "audit_log"("merchant_id", "entity_type", "entity_id");
```

- **Preview generado el 29-jul-2026 contra STAGING** (`acela.proxy.rlwy.net`) con
  `prisma migrate diff --from-schema-datasource … --script`. Salida completa: **la línea de
  arriba y nada más**. Cero ALTER, cero DROP, cero cambio de tipo.
- **Por qué:** el índice que ya existe es `(merchant_id, action, created_at)` y responde
  «dame las acciones de tipo X». La consulta de INSPECCIÓN pregunta otra cosa —«qué pasó con
  la factura X»— y para eso el eje es la ENTIDAD (contrato §7.1 Q1). Sin este índice esa
  consulta es un seq scan sobre toda la tabla del merchant.
- **Es el ÚNICO cambio de schema de SCRUM-207.** El resto del contrato cabe en `meta` (JSONB
  ya existente) por decisión D-1 del fundador: una columna nueva en una tabla polimórfica
  sería nullable y no aportaría integridad que un guard no aporte ya.
- **Riesgo de no aplicarlo: NINGUNO funcional.** El código no lo necesita para funcionar —
  solo para no degradarse cuando la tabla crezca. Un índice ausente no rompe ninguna query.
- ✅ **STAGING APLICADO el 29-jul-2026** por la sesión de SCRUM-207, con el GO del fundador y
  el preview de arriba enseñado antes. Orden seguido: preview crudo → **host verificado contra
  la allowlist** (`acela.proxy.rlwy.net`, y comprobado explícitamente que NO es el de prod) →
  centinela de un solo uso → `npx prisma db push --skip-generate` (sin `--accept-data-loss`) →
  **verificado leyendo `pg_indexes`, no el mensaje del comando** (los 3 índices de `audit_log`
  presentes) → `migrate diff` posterior **vacío**.
- 🔴 **LAS OTRAS DOS NO LAS APLICA ESTA SESIÓN, y es deliberado.** `yaqu_dev_javier` la aplica
  **Javier (carril B)**, que es su dueño; **producción la aplica el fundador** con su propio
  preview y su GO. Comando para las dos (el mismo, cambiando `DATABASE_URL`):
  ```bash
  # 1) preview — tiene que salir EXACTAMENTE el CREATE INDEX de arriba y nada más
  DATABASE_URL="<url de esa base>" npx prisma migrate diff \
    --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script
  # 2) aplicar, tras comprobar el host que imprime prisma en la primera línea
  DATABASE_URL="<url de esa base>" npx prisma db push --skip-generate
  ```
  ⚠️ **NO uses `npm run db:push`**: el wrapper está roto (SCRUM-223 — el `sed` se lleva la
  comilla del `.env`, el error se lo traga un `2>/dev/null` y `set -e` mata el script antes
  del preview). Hasta que se arregle, el camino es el `migrate diff` crudo + `db push`.
- **Hasta que esté en las TRES, la tanda gateada aborta** en las bases que le falten: el
  preflight compara el esquema contra `prisma/schema.prisma` y dice «la BD va POR DETRÁS».
  No es un fallo: es el guard de SCRUM-169 haciendo su trabajo.

## 6-jul-2026 — merchants.flags (APLICADO ✅)

```sql
ALTER TABLE "merchants" ADD COLUMN "flags" JSONB;
```

- Aditiva, 0 DROPs; aprobada por el fundador (AskUserQuestion, A14.3) — la aprobación
  del lote EXT3 no la cubría y el clasificador exigió (con razón) un OK fresco.
- Mecanismo Parte P de overrides POR merchant ({FLAG_NAME: bool}); lo lee core/flags.ts
  (precedencia merchant > país > env > default). Escritura solo manual/fundador.
- Primer uso: PUBLIC_PROFILE_ENABLED=true SOLO en demo (id=1). Ningún otro merchant
  tiene flags (verificado count=0).

## 2-ago-2026 — SCRUM-300 · albaranes: entrega + quién firma (PENDIENTE ⏳)

```sql
ALTER TABLE "albaranes" ADD COLUMN     "fecha_entrega" TIMESTAMP(3),
ADD COLUMN     "firmado_por_calidad" TEXT,
ADD COLUMN     "firmado_por_nombre" TEXT,
ADD COLUMN     "lugar_entrega" TEXT;
```

- **Aditiva pura**: 4 `ADD COLUMN` nullable. 0 DROP · 0 RENAME · 0 ALTER destructivo ·
  0 NOT NULL. Los albaranes ya firmados no se tocan.
- SQL generado OFFLINE (schema viejo → schema nuevo), sin conectar a ninguna base:
  `npx prisma@6.18.0 migrate diff --from-schema-datamodel <viejo> --to-schema-datamodel
  prisma/schema.prisma --script`.
- **Orden: staging PRIMERO, prod después** (condición del fundador). Prod ⏳ con GO
  explícito y preview delante.
- ⚠️ **AVISO DE HERRAMIENTA (no es de esta migración, pero muerde a la siguiente):** el CLI
  instalado es **prisma 7.9.1** y el cliente **@prisma/client ^6.18.0**. En el 7, los flags
  `--from-schema-datamodel`/`--to-schema-datamodel` que documenta `CLAUDE.md` **ya no
  existen** (ahora son `--from-schema`/`--to-schema`), y **con cualquiera de las dos formas
  `migrate diff` devuelve SALIDA VACÍA con exit 0** — porque el 7 dejó de leer la config de
  `package.json#prisma` (lo avisa el propio 6: *«deprecated and will be removed in Prisma 7»*).
  Es decir: **el preview obligatorio antes de cada `db push` a producción dice hoy "no hay
  cambios" pase lo que pase.** Un fail-open silencioso justo en el guard que protege prod.
  Mientras no se arregle (`prisma.config.ts` o fijar el CLI al 6), el preview se hace con
  `npx prisma@6.18.0` como arriba, y **nunca** se da por bueno un diff vacío sin control
  positivo (`--from-empty` debe escupir el esquema entero; si sale vacío, el roto es el CLI).
