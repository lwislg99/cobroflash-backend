# Migraciones de schema pendientes de aplicar a producción

> ## ⚠️ `current_database()` NO DISTINGUE PRODUCCIÓN DE STAGING — las dos se llaman `railway`
>
> Es el nombre por defecto de Railway, así que **las dos bases lo llevan**. `SELECT
> current_database()` devuelve `railway` en las dos y **NO vale como comprobación de destino**:
> quien lo use para confirmar dónde está, no ha confirmado nada.
>
> **Los discriminadores que sí valen:**
>
> | Señal | Producción | Staging | Dev |
> |---|---|---|---|
> | **Host** | `autorack…` | `acela.proxy.rlwy.net` | `acela.proxy.rlwy.net` |
> | **Nombre de base** | `railway` | `railway` | `yaqu_dev_javier` |
> | **Recuento de `invoices`** (medido 7-ago-2026) | **55** (49 `no_aplica` · 4 `pendiente_de_sellado` · 2 `sellado`) | **7** (6 `no_aplica` · 1 `pendiente_de_sellado`) | **0** |
>
> El **host** separa producción de las otras dos; el **nombre de base** separa staging de dev.
> Hace falta mirar los dos: ninguno solo alcanza. El recuento de `invoices` es la confirmación
> cruzada — es un dato de estado y por tanto **caduca**, pero un salto de 55 a 7 no se confunde.
>
> ⚠️ Y hay una trampa más, de nombres: la base de STAGING vive dentro de un entorno de Railway
> llamado **«production»**. **El nombre del entorno miente.** Guíate por host + nombre de base.

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
> El esquema se aplica **A MANO, antes** de que el código use la nueva tabla o columna.
>
> ## 🔒 EL PROCEDIMIENTO ÚNICO (SCRUM-705)
>
> ```
> ① decisión
> ② ALTER ADITIVO en las TRES bases:  dev → staging → producción
> ③ UN SOLO PR con esquema + código + tests
>
> NUNCA ③ sin ②.
> ```
>
> **🔴 NUNCA `db push` contra PRODUCCIÓN.** `db push` reconcilia el esquema ENTERO, y producción
> puede ir **por delante** de `main` en columnas aplicadas a mano para desbloquear un PR que aún no
> se ha mergeado: el push propondría **tirarlas**. No es un caso raro, es el comportamiento normal
> del método aquí.
>
> El caso, con fecha: el 2-sep-2026 `scripts/db-push-prod` —sin modificar y haciendo lo que
> promete— se ejecutó desde un checkout **1.933 commits por detrás** y propuso, contra producción,
> `DROP TABLE job_assignees`, `DROP TABLE email_messages` y ~30 columnas. Lo pararon el GO
> explícito y que la shell no tenía `stdin` — **la segunda fue suerte**. SCRUM-685 le puso puerta
> (se niega a arrancar desde un árbol atrasado y aborta si el preview trae cualquier borrado), pero
> la puerta no cambia el método: el método es el ②.
>
> `scripts/db-push-prod` se conserva para **STAGING** y para **diagnosticar deriva**.
>
> ### El DDL sale de `prisma migrate diff`, y de ningún otro sitio
>
> Nunca a mano, nunca adivinando el tipo. `schemaDrift` comprueba que la columna **EXISTE**, no de
> qué tipo es: un `TEXT` donde tocaba `JSONB` **arranca verde y se pudre semanas**.
>
> ### La verificación lleva DOS controles DE TIPOS DISTINTOS más `current_database()`
>
> «He usado dos variables» no prueba que sean dos bases: un catálogo que devolviera `text` para
> todo daría los números correctos. Por eso los dos controles son **de tipos distintos**, y
> `current_database()` dice contra qué base se miró.
>
> ### 🔴 Y la verificación distingue «no medido» de «cero»
>
> Un `0` sin control positivo al lado no dice «la columna no está»: dice **que no se ha podido
> comprobar**, y son cosas opuestas. Ocurrió dentro del propio vigilante de despliegue (SCRUM-716),
> que decía «al día» cuando no había podido resolver `main` — y salía **verde**. En un
> procedimiento contra producción ese mismo defecto cuesta más caro que en un check de CI.
>
> ### Mergear no es acabar
>
> Un ticket no está cerrado hasta que **su despliegue está verde**. Producción estuvo NUEVE DÍAS
> sin desplegar: los despliegues fallaban el healthcheck, Railway mantenía vivo el anterior, y la
> web respondía con código viejo sin una sola alerta (SCRUM-677).
>
> La carpeta `prisma/migrations`
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
                                             sin que el fundador lo sepa.
2. acela.proxy.rlwy.net / yaqu_dev_javier  — DESARROLLO. El fundador dijo que NO requiere su
                                             GO para aplicarle schema.
3. autorack.proxy.rlwy.net                 — PRODUCCIÓN.
```

> ### 🔒 INTERINO desde el 4-sep-2026 · STAGING ESTÁ CONTAMINADA COMO SUJETO DE MEDIDA
>
> **Decisión del fundador (SCRUM-668). No es una sospecha: es una declaración de estado.**
>
> `DATABASE_URL_TESTS` en los carriles `b1`, `b2` y `b3` apunta a `acela/railway`, que **es la
> misma base que `DATABASE_URL_STAGING`**. O sea: la suite gateada ESCRIBE en la base que
> también se usa para medir. Y son 61 ficheros de test los que están gateados por esa clave,
> con `_merchant-fixture.mjs` creando un merchant y barriéndolo sobre 23 modelos por pasada.
>
> **Consecuencia operativa, y es lo único que hay que recordar:**
>
> * **Una cifra sacada de `acela/railway` NO vale como medición.** Filas, totales, huecos,
>   duplicados, «no hay ninguno»: nada de eso distingue el estado real del sedimento de una
>   tanda. Una base que es a la vez el sujeto de la medida y el vertedero de los tests no da
>   resultados: da coincidencias.
> * **Sirve igual para lo de siempre**: correr la suite gateada, probar una pantalla, un
>   `db push` de ensayo. Lo que se retira es su valor como FUENTE DE UN NÚMERO.
> * **Si necesitas medir de verdad**, mide contra producción en sólo-lectura (`autorack`, y
>   di en el informe que era producción) o levanta una base propia.
>
> **No se relaja nada para esto.** `assertSafeStagingUrl` es una allowlist de host y es
> fail-closed: sigue igual. Esto no cambia ni una variable de entorno — sólo dice qué valor
> tiene el dato que sale de ahí.
>
> **Se levanta cuando** cada carril tenga su base de pruebas propia (`yaqu_tests_b1|b2|b3`), que
> es el objetivo acordado y necesita infraestructura: **espera a Javier**. Se descartó mandar
> los cuatro carriles a `yaqu_dev_javier`: cuatro sesiones escribiendo en la misma base es
> cambiar un problema por otro.
>
> ⚠️ Y lo que **no** se sabe, dicho como resultado y no como tranquilidad: **no está medido si
> alguna cifra de staging ya publicada salió contaminada.** No se ha barrido quién midió qué
> contra `acela/railway` ni cuándo. Un «no» sin medir no habría sido un resultado.

> ### 📌 QUÉ BASE TOCA CADA WORKTREE — MAPA MEDIDO el 6-ago-2026
>
> **Método:** censo de `.env*` en los cuatro árboles, imprimiendo `clave → host/base` con
> `describirBD` (nunca el valor). Es una FOTO fechada, no una verdad permanente: si alguien
> cambia una clave en Railway, esta tabla envejece sin que nadie la toque. Re-medir antes de usarla.
>
> **ESTADO ACTUAL — tras SCRUM-383 (6-ago-2026).** Los cuatro árboles llevan las TRES claves, con
> el mismo host y las mismas credenciales; solo cambia el nombre de la base:
>
> | Clave | `cobroflash-backend` | `cobroflash-b1` · `b2` · `b3` |
> | --- | --- | --- |
> | `DATABASE_URL_STAGING` | `acela…/railway` | `acela…/railway` |
> | `DATABASE_URL_DEV` | `acela…/yaqu_dev_javier` | `acela…/yaqu_dev_javier` |
> | `DATABASE_URL_TESTS` | `acela…/yaqu_dev_javier` | `acela…/railway` |
>
> `DATABASE_URL_TESTS` es **la base de pruebas DE ESE CARRIL**, y es la que leen los seis
> consumidores de la tanda. Que difiera por worktree **no es un defecto**: el reparto por carril
> es DELIBERADO (23-jul-2026), para aislar los carriles. Lo que se arregló es el NOMBRE.
>
> **Y por eso hay DOS turnos de staging, no uno.** El marcador del turno vive DENTRO de la base
> (`current_database()` + comentario de schema), así que el turno del árbol principal está en
> `yaqu_dev_javier` y el que comparten b1/b2/b3 está en `railway`. Nadie compite con nadie por un
> turno ajeno, y no es casualidad: es la consecuencia de que cada carril pruebe en su base.
>
> **REGISTRO — lo que se midió el 6-ago-2026 ANTES de SCRUM-383** (se conserva: es la prueba de
> por qué se hizo el ticket, no una descripción del presente):
>
> | Worktree | Clave | Base real | Cuál es |
> | --- | --- | --- | --- |
> | `cobroflash-backend` | `DATABASE_URL_STAGING` | `acela…/yaqu_dev_javier` | **DEV** |
> | `cobroflash-b1` | `DATABASE_URL_STAGING` | `acela…/railway` | **STAGING** |
> | `cobroflash-b2` | `DATABASE_URL_STAGING` | `acela…/railway` | **STAGING** |
> | `cobroflash-b3` | `DATABASE_URL_STAGING` | `acela…/railway` | **STAGING** |
>
> 🔴 **Una misma clave significaba DOS bases distintas según el directorio**, y ningún comando lo
> recordaba. Ninguna apuntaba a producción (`autorack`). SCRUM-383 no movió a nadie de base: dio
> nombre propio a cada destino, para que el nombre dejara de mentir.
>
> ⚠️ Antes de eso, aquí ponía que staging era «la base del worktree `cobroflash-b2`» y dev la «de
> `cobroflash-b1`». **Medido: era falso.** `b1` tiene STAGING, y quien tiene DEV es el worktree
> PRINCIPAL, que ni se mencionaba. Se corrigió el 6-ago-2026; la afirmación anterior no llevaba
> fecha ni método, que es justo por lo que pudo envejecer sin que nadie lo notara.
>
> **Lo vigila `tests/scrum383-clave-vs-destino.test.mjs`**: compara lo que la clave PROMETE con el
> destino REAL y aborta antes de cualquier operación de esquema. Para comprobarlo en un árbol:
> `node scripts/comprobar-claves-bd.mjs` — y hay que correrlo EN LOS CUATRO, porque «según la
> carpeta» era precisamente la dimensión del fallo.

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

## 📋 VEREDICTO · ¿alguna migración «aplicada en staging» fue en realidad a dev? (SCRUM-383)

**Medido contra:** `origin/main` = `f56f49038ab9fbeb2e1a21bc2eb9ec0958c48877` · 2026-08-06T15:21:07Z
**Método:** repo, historial de git y reflogs por worktree. **Cero conexiones a base de datos.**

> La pregunta nace del mapa de arriba: si `DATABASE_URL_STAGING` significa DEV en un árbol y STAGING
> en otros tres, alguien pudo migrar dev creyendo que migraba staging — dos veces, y con las dos en
> verde. **Respuesta: no ocurrió en ninguna migración comprobable, y hay UNA que no se puede
> comprobar.** Se detalla por filas porque un veredicto que esconde su incertidumbre no es un
> veredicto.

### El origen — no fue el descuido de nadie, y por eso hay que escribirlo

La clave apuntando a dev **era el DISEÑO**. El 23-jul-2026 (SCRUM-84, commit `f56e1f9`) se creó
`yaqu_dev_javier` como **segunda base de staging, una por carril**, para acabar con las colas por la
ventana compartida. Sus palabras: *«REPARTO: Sesión 1 → `yaqu_dev_javier` · Sesión 2 → `railway`.
Cada uno la apunta en `DATABASE_URL_STAGING` de SU `.env` local»*. Con ese reparto, la clave decía
la verdad en los dos sitios: las dos ERAN staging.

**Lo que la convirtió en mentira fue SCRUM-169, cuatro días después** (27-jul): fijó la nomenclatura,
ascendió `yaqu_dev_javier` a **DESARROLLO** y descartó expresamente llamarla «segunda BD de staging»
porque no tiene el régimen de `railway` — todo correcto. Pero **el nombre de la variable no cambió**.
Desde ese día `DATABASE_URL_STAGING` prometía un papel que en un árbol ya no cumplía, y ningún
comando lo recordaba. Nadie se equivocó: **una decisión buena caducó el nombre de otra decisión
buena, y el nombre no se enteró.**

⚠️ **Consecuencia viva, que NO es la de esta pregunta:** por el reparto de SCRUM-84, el carril B
tenía asignada `yaqu_dev_javier`. Hoy tres de los cuatro árboles de ese carril apuntan a `railway`,
que es la base **del otro carril**. Eso no afecta a las migraciones (ver abajo) pero sí a tandas
gateadas, semillas y `clean-staging-tests`. Es otro asunto y necesita su ticket.

### Los tres discriminadores, y qué contesta cada uno

| # | Qué se midió | Resultado |
| --- | --- | --- |
| ① | **Quién corrió cada push**, cruzando los 65 commits que tocan `prisma/schema.prisma` contra los reflogs de los cuatro árboles (`.git/worktrees/*/logs/HEAD`) | **0 de 65** salen de estos árboles (62 Luis + 3 `lwislg99`, **ninguno de Javier**). El único que aparece es un *merge commit* de un PR, traído por `fetch`. **Control de sensibilidad: 47 de los últimos 50 commits de Javier SÍ aparecen** — el método ve lo que se hizo aquí; los 3 que faltan son SHAs reescritos por rebase |
| ② | **Cuándo nació la base de dev** | **23-jul-2026**. Antes de esa fecha solo existía `railway`: no había a dónde desviarse |
| ③ | **El censo físico de columnas** (`docs/sql/deriva-prod.sql`, 331 columnas / 24 tablas) | staging **en sync** — medido dos veces por caminos distintos: test gateado de SCRUM-222 el **2-ago** (24 tablas / 331 columnas) y censo directo el **6-ago** (331). Dev: **330**, le falta solo `vf_estado` |

**③ es el que zanja**, y en la dirección que importa: si un push «a staging» hubiera caído en dev,
**staging estaría corta y dev larga**. Lo medido es lo contrario — staging completa, dev la que va
detrás, exactamente donde el registro dice que va detrás.

### Veredicto por migración

| Veredicto | Migraciones | Por qué |
| --- | --- | --- |
| 🟢 **Validada en staging de verdad** | SCRUM-14 (13-jul) · SCRUM-52 (15-jul) · SCRUM-49 (16-jul) · SCRUM-68, SCRUM-66, SCRUM-17, SCRUM-74 (22-jul) · SCRUM-102, SCRUM-109 (23-jul) | **Dos caminos independientes:** son anteriores a que existiera dev (②) **y** su columna está en staging (③) |
| 🟢 **Validada en staging de verdad** | SCRUM-145 y SCRUM-145d (24-jul) · SCRUM-170, SCRUM-171b (27-jul) · SCRUM-195 paso 1 (28-jul) · SCRUM-205 ALTER (30-jul) | Por el censo (③). **Son las expuestas de verdad**: ya existía dev y su verificación registrada fue el HOST, que no separa `railway` de `yaqu_dev_javier`. Las salvó el censo a posteriori, no su procedimiento |
| ⚪ **NO SE PUEDE SABER** | **SCRUM-207 · índice `audit_log_merchant_id_entity_type_entity_id_idx`** (29-jul) | Ver abajo |
| 🔴 **Creída validada pero fue a dev** | **NINGUNA** | Ningún objeto declarado en staging falta en staging |

**Casos que cierran solos, y conviene saberlo:**

* **SCRUM-205** es la prueba directa y en las dos direcciones: `vf_estado` **existe en staging y NO
  en dev** (6-ago). Ese ALTER fue a staging y no pudo ir a dev.
* **Los índices de SCRUM-170 y SCRUM-195 no quedan en el aire** aunque el censo no vea índices:
  viajaron en el mismo `db push` que la tabla o columna que el censo **sí** ve en staging. Un índice
  no aterriza en otra base que la sentencia que lo acompaña.
* **SCRUM-195 en dev** es la única aplicación a dev verificada por el carril B, y **registró el
  NOMBRE DE BASE** (`host=acela.proxy.rlwy.net · db=yaqu_dev_javier`) antes de correr. Se
  autocertifica: no depende del mapa de worktrees. Es el patrón que SCRUM-383 convirtió en guard.

### ⚪ El único que no se puede saber, y qué lo cerraría

**SCRUM-207 es la ÚNICA migración del registro sin huella de columna** — su propia entrada lo dice:
*«Es el ÚNICO cambio de schema de SCRUM-207»*. Y ahí se juntan las tres cosas:

1. **El censo no mira índices.** Está declarado en la cabecera de `deriva-prod.sql` y comprobado en
   su SQL: no consulta `pg_indexes` ni una vez.
2. **Su verificación registrada fue el HOST** (*«host verificado contra la allowlist
   (`acela.proxy.rlwy.net`), y comprobado explícitamente que NO es el de prod»*) más `pg_indexes`
   **en la base a la que apuntaba la clave**. El host no distingue las dos bases: es justo el hueco.
3. Se corrió desde un clon que no es ninguno de los cuatro árboles medidos (①), así que su `.env`
   no es observable desde aquí.

**Lo cierra una consulta de solo lectura contra `acela/railway`**, sin credencial en ninguna parte
(consola de Postgres de Railway, igual que `deriva-prod.sql`):

```sql
SELECT indexname FROM pg_indexes WHERE tablename = 'audit_log';
```

Si aparece `audit_log_merchant_id_entity_type_entity_id_idx`, la fila pasa a 🟢. Si no aparece, el
índice está en dev y hay que aplicarlo a staging. **Riesgo de dejarlo abierto: ninguno funcional** —
un índice ausente no rompe ninguna consulta, solo la degrada cuando la tabla crezca.

### Los límites de este veredicto, dichos en voz alta

* **El censo prueba «está en staging el 2 y el 6-ago», no «entró el día que dice el registro».** Un
  objeto aplicado tarde, o corregido por otra sesión, se lee igual. Para la pregunta de este
  veredicto basta; para una auditoría de FECHAS, no.
* **Sigue sin mecanismo todo lo ✋**: backfills, tipos, nullability, defaults, claves ajenas y enums.
  El censo no los ve y este veredicto tampoco.
* **La ausencia en un reflog no prueba que algo no se hiciera aquí**: un rebase reescribe el SHA y
  rompe el enlace. Por eso ① lleva su control de sensibilidad (47/50) y no se apoya en el silencio.

## SCRUM-441 · `invoices.paid_via` — ✅ APLICADO en staging y producción (12-ago-2026)

**Lo aplicó el FUNDADOR, no esta sesión.** Se registra lo que él reportó, y con eso queda dicho el
límite: **esta sesión no ha tocado ninguna base, tampoco en lectura**, así que no ha verificado la
columna contra ningún host. El registro es del hecho, no de una medición propia. `yaqu_dev_javier`
es carril B y se le pide a Javier.

```sql
ALTER TABLE "invoices" ADD COLUMN "paid_via" TEXT;
```

Es la columna que le faltaba a la mitad del dinero: `Charge` guarda el método de lo que pasa por
pasarela, pero **una transferencia o un pago en efectivo no crean `Charge`**, así que en la pantalla
de Cobros salían como «Método no registrado» — indistinguibles de un cobro del que de verdad no se
sabe nada.

> 🔴 **ENTRA VACÍA, Y NO SE RELLENA POR COPIA DESDE `Charge.method`.** Ese campo guardó a la vez la
> intención del profesional (`card`) y el hecho que escribió la pasarela (`card:stripe`), y mirando
> una fila **no se puede saber cuál de las dos es**. Copiarlo no movería ese defecto: lo DUPLICARÍA,
> y de forma irreversible — una vez copiadas las filas, ya nadie podría distinguir cuáles se
> copiaron. **Cero backfill de históricos.** Lo impide un guard que corre en `npm test`
> (`tests/scrum441-paidvia-sin-copia.test.mjs`), probado en rojo por inyección.

> ⚠️ **NOMBRE EN `snake_case`, y no por costumbre: por recuento.** La tabla `invoices` mezcla los dos
> estilos de verdad. Contadas las columnas resolviendo `@map` —que es lo que acaba en Postgres— y
> descartando relaciones y palabras sueltas: **`snake_case` 16, `camelCase` 7**. Las 7 `camelCase`
> son las más antiguas (claves foráneas y `createdAt`); las `vf_*` y `reminder_*`, posteriores, ya
> son `snake_case`. La tabla ya se estaba moviendo hacia ahí.

> ⚠️ **`prisma/schema.prisma` SÍ lo lleva ya, y esta vez es lo correcto**, al revés que en
> SCRUM-449: las bases se aplicaron ANTES, así que el esquema va detrás y no por delante.
> `paidVia String? @map("paid_via")`. Nada de `prisma migrate diff` contra ninguna base desde aquí.

**Sin `NOT NULL` y sin `DEFAULT`, a propósito:** `NULL` significa «no consta», que es la verdad de
todas las filas de antes de hoy, y el lector ya lo trata bien (cae en «Método no registrado» sin
inventarse nada). Un `DEFAULT` convertiría «no consta» en una afirmación sobre cómo se cobró.

**El cable:** `updateInvoiceStatusAdmin` (`invoiceAdmin.ts`) acepta el método como **4º parámetro
opcional** y `PUT /admin/invoices/:id/status` lo pasa desde `req.body.paidVia`. Opcional a
propósito: **marcar cobrada sin indicar método sigue funcionando exactamente igual que antes**, y
eso está medido, no supuesto (`tests/scrum441-metodo-declarado.test.mjs`, 10 tests).

## SCRUM-475 (fase 2) · tabla nueva `email_messages` — ✅ APLICADO **solo en DEV** (11-ago-2026)

**REGISTRO de lo que se ejecutó y se verificó el 11-ago-2026.** No es una afirmación sobre el estado
de hoy: es lo que se midió ese día, con su método. **Staging y producción están PENDIENTES** y las
aplica el fundador.

Es la tabla donde consta **qué pasó con cada correo**. Sin ella, el vocabulario de
`constanciaCorreo.ts` está construido y probado pero **no se persiste nada**, y el webhook del
proveedor no tiene dónde escribir. El modelo lo diseñó la sesión de SCRUM-475
(`docs/master/SCRUM-475.md` §4) y aquí se ha copiado **sin rediseñarlo**.

Fichero: **`docs/sql/scrum-475-email-messages.sql`**. **Aditivo y re-ejecutable** (`IF NOT EXISTS`):
correrlo dos veces sobre una base ya aplicada no hace nada y no falla — **comprobado en dev**, se
aplicó dos veces y la tabla quedó intacta.

> 🔴 **EL SQL NO ESTÁ ESCRITO A MANO.** Lo generó `prisma migrate diff` a través de
> `scripts/preview-migracion.mjs` (**CLI local por ruta, nunca `npx`** — la sustitución silenciosa
> del binario fue el incidente del 5-ago), con su **control positivo delante**: el esquema entero
> contra vacío devolvió **24 `CREATE TABLE`**, así que la herramienta estaba contestando.
> Lo **único** añadido a su salida son los `IF NOT EXISTS`, por la convención de esta casa
> (SCRUM-425, SCRUM-449); la estructura —columnas, tipos, defaults, nombres de índice— es la suya
> carácter a carácter.

> ⚠️ **`prisma/schema.prisma` NO SE HA TOCADO** (cero líneas de diff): es dominio exclusivo del
> fundador y se edita **al final**, cuando las tres bases estén. El diff se hizo contra una copia
> temporal que se retiró. Mientras dure esa ventana, **las bases van por delante del esquema a
> propósito** y **no se corre `prisma migrate diff` contra ninguna**: propondría BORRAR la tabla.

> ⚠️ **NOMBRES DE LA BASE (snake_case), no del modelo.** Salen de los `@@map`/`@map`, y los de los
> índices son los que Prisma DERIVA. No se «corrigen».

**100 % ADITIVO, comprobado sobre el SQL generado y no prometido:** 1 `CREATE TABLE`, 3 índices,
**cero** columnas tocadas, **cero** `NOT NULL` sobre datos existentes, y **ninguna** de
`DROP` · `ALTER COLUMN` · `SET NOT NULL` · `TRUNCATE` · `DELETE` · `RENAME`. No toca ninguna otra
tabla. **Si al aplicarlo algo pidiera `--accept-data-loss`, el diff no es éste: parar.**

**SIN BACKFILL:** los correos ya enviados no tienen fila y **no se les inventa una** — de ellos no
consta nada, que es la verdad.

### La lista blanca del aplicador tuvo que crecer, y consta

`scripts/aplicar-sql-dev.mjs` **rechazó este fichero**: su lista blanca solo conocía
`ALTER TABLE … ADD COLUMN` y `CREATE [UNIQUE] INDEX`, y una **tabla nueva** no es ninguna de las
dos. Se añadió la tercera forma —`CREATE TABLE … ( … )`— **a conciencia y con su caso**, que es lo
que pide su propia cabecera y lo que exige `tests/scrum425-aplicador-sql-dev.test.mjs`.

Es admisible porque **no existe forma de `CREATE TABLE` que toque datos existentes**: crea un objeto
que antes no estaba, y si ya existe o falla (lado seguro) o no hace nada. Se **acotó** a la forma con
definición de columnas; `CREATE TABLE … AS SELECT` queda **fuera** a propósito. Dos tests nuevos:
uno que acepta la forma real y **otro que comprueba que la ampliación no abrió la puerta a nada más**
—`DROP TABLE`, `AS SELECT`, un `DROP` escondido detrás de una sentencia válida y `DROP COLUMN` siguen
cayendo—.

### Por qué `db execute` y no `db push`

`db push` sincroniza la base **con el schema**, y el schema todavía no tiene la tabla: pediría lo
contrario de lo que se quiere. Además `npm run db:push` y sus envoltorios están **rotos** (SCRUM-223).
Y `--accept-data-loss` **protege a `db push`, NO a `db execute --file`** (SCRUM-395): por eso dev se
aplicó con `scripts/aplicar-sql-dev.mjs`, que enseña el fichero línea a línea y solo aplica formas de
la lista blanca. Se corrió **primero en ensayo** (sin `--go`).

| Base | Host · nombre | Cómo se aplicó | Verificación |
| --- | --- | --- | --- |
| **Producción** | `autorack…` / `railway` (55 filas en `invoices`) | ⏳ **PENDIENTE** — la aplica el fundador a mano | — |
| **Staging** | `acela.proxy.rlwy.net` / `railway` (7 filas) | ⏳ **PENDIENTE** — la aplica el fundador a mano | — |
| **Dev** | `acela.proxy.rlwy.net` / `yaqu_dev_javier` (0 filas) | **esta sesión (SCRUM-475 paso A)** con `node scripts/aplicar-sql-dev.mjs --file docs/sql/scrum-475-email-messages.sql --go`, tras el ensayo | ✅ **tabla 1 · idx 1 · idx 1 · unique 1** |

**La consulta de verificación —UNA sola, UNA fila, y es la que manda.** Se lee el CATÁLOGO, nunca el
mensaje del comando. Una fila con todas las columnas obliga a verlas juntas: con cuatro consultas, un
número se esconde detrás de otro.

```sql
SELECT
  (SELECT COUNT(*) FROM invoices)::int AS invoices_discriminador,
  (SELECT COUNT(*) FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'email_messages')::int AS tabla,
  (SELECT COUNT(*) FROM pg_indexes
     WHERE schemaname = 'public' AND tablename = 'email_messages'
       AND indexname = 'email_messages_merchant_id_created_at_idx')::int AS idx_merchant_created,
  (SELECT COUNT(*) FROM pg_indexes
     WHERE schemaname = 'public' AND tablename = 'email_messages'
       AND indexname = 'email_messages_related_type_related_id_idx')::int AS idx_related,
  (SELECT COUNT(*) FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
     WHERE c.relname = 'email_messages_provider_id_key' AND i.indisunique)::int AS unique_provider_id,
  (SELECT COUNT(*) FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'invoices')::int AS control_positivo;
```

Se puede correr sin pegar la URL en ningún sitio — **solo lee**, y el nombre de la variable nunca es
su valor:

```bash
node scripts/verificar-email-messages.mjs --clave DATABASE_URL_STAGING
```

**Lo medido en dev el 11-ago-2026**, antes y después, que es lo que prueba que el verificador no dice
que sí siempre:

| | invoices | tabla | idx_merchant_created | idx_related | unique_provider_id | control_positivo |
|---|---|---|---|---|---|---|
| **antes** | 0 | **0** | **0** | **0** | **0** | 1 |
| **después** | 0 | **1** | **1** | **1** | **1** | 1 |

> 🔴 **`control_positivo` es la mitad que impide un falso «no está»**: es la MISMA pregunta sobre
> `invoices`, que existe seguro. Si saliera 0, el verificador estaría roto y el `tabla: 0` de al lado
> no significaría «no está» sino **«no supe mirar»** — y son cosas opuestas. Por eso el script sale
> con código 2 y el texto «NO SUPE MIRAR» cuando la consulta ni siquiera se puede ejecutar.

> 🔴 **DISCRIMINADOR ANTES DE APLICAR, y no es el nombre de la base.** `SELECT current_database()`
> devuelve `railway` en staging **Y** en producción. Lo que las separa es la **cuenta de `invoices`**:
> dev 0 · staging 7 · producción 55. ⚠️ El **0 de dev lo he medido yo** hoy; los de staging y
> producción salen de este mismo fichero, **medidos el 7-ago-2026**, y son estado que caduca.

## LOTE ÚNICO · 9 columnas en 4 tablas (SCRUM-403 · A5 · E4 · SCRUM-195 · SCRUM-16/142) — 🔴 SIN APLICAR en ninguna de las tres

**Medido contra:** `origin/main` = `ff5698f` · 2026-08-10 · rama `scrum-lote-migracion-unica`

- [x] **staging · acela/railway** — **aplicado 10-ago-2026** con GO del fundador, por
      `bash scripts/db-push-prod` (host-check → preview → GO → `db push` **sin**
      `--accept-data-loss`). Destino confirmado ANTES por host **y nombre de base**
      (`acela.proxy.rlwy.net` / `railway`), porque el host solo no separa staging de dev.
      Verificación del script: `-- This is an empty migration.` — el vacío **legítimo, por la
      frase**. Verificación independiente por `information_schema`: **9/9 columnas, todas
      `is_nullable = YES` y `column_default` vacío**. Preflight de SCRUM-395 en verde (rama
      declarada = rama real; 4 sentencias, 9 `ADD COLUMN`, todas aditivas).
      ⚠️ `expenses` tiene **0 filas** en staging, así que la comprobación de «ningún backfill»
      **no tiene fuerza aquí**: 0 rellenadas y 0 existentes son el mismo número. Esa comprobación
      solo dice algo en producción.
- [ ] **desarrollo · acela/yaqu_dev_javier** — **pendiente — credencial del carril B, la aplica
      Javier.** No es un olvido: es una casilla sin marcar CON MOTIVO.
      Medido el 10-ago-2026: **`DATABASE_URL_DEV` no existe en ninguna `.env` de esta máquina**
      (barrido de todos los árboles de `D:/MILLONARIO/cobroFlash/`). El único árbol con claves de
      base es `cobroflash-backend`, y tiene `DATABASE_URL` (🔴 producción), `DATABASE_URL_STAGING`
      (staging) y `SCRATCH_DATABASE_URL` — ninguna apunta a `yaqu_dev_javier`.
      Concuerda con el reparto: `yaqu_dev_javier` es la base del **carril B**, y se pide, no se
      aplica desde otra sesión. **Queda pendiente de Javier o de la clave.**
      ⚠️ Ojo: la tabla de SCRUM-383 de este mismo fichero dice que «los cuatro árboles llevan las
      TRES claves». **Hoy no se sostiene** para `cobroflash-backend`: le faltan `DATABASE_URL_DEV`
      y `DATABASE_URL_TESTS`. Es una foto fechada que envejeció, como ella misma avisa.
- [x] **producción · autorack** — **aplicado 10-ago-2026 con GO EXPLÍCITO del fundador**, dado tras
      ver la evidencia de staging. Destino confirmado ANTES por host (`autorack.proxy.rlwy.net`) —
      el **nombre de base no sirve**: producción y staging se llaman las dos `railway`. Solo el
      host las separa. `db push` **sin** `--accept-data-loss` (no lo pidió). Verificación del
      script: `-- This is an empty migration.`
      Verificación independiente por `information_schema`: **9/9 columnas, `is_nullable = YES`,
      `column_default` vacío** en las nueve.
      **CERO BACKFILL, y aquí la comprobación SÍ tiene fuerza porque hay datos**: `expenses` 10
      filas · 0 con `base_amount` · `quotes` 125 filas · 0 con `es_adicional` · `invoices` 55
      filas · 0 con `deducts_refs`. (Las 55 facturas cuadran con el recuento de producción de la
      cabecera de este fichero: confirmación cruzada del destino.)

> ### 🔴 QUÉ LE PASA AL ENTORNO DE JAVIER SI NO APLICA ESTO — MEDIDO, NO SUPUESTO
>
> **① Su servidor SÍ arranca. Y eso es lo malo.** `src/core/db/schemaDrift.ts:265-267`:
> `nodeEnv === 'production' ? { arranca: false } : { arranca: true, nivel: 'warn' }`. Fuera de
> producción la deriva **es un `console.warn` en el arranque**, no una parada. El aviso pasa de
> largo entre el ruido del boot y la app se queda escuchando como si nada.
>
> **② Y entonces se rompe TODO lo que lea esas cuatro tablas — no solo lo que use los campos
> nuevos.** Medido ejecutando un `expense.findMany()` corriente con el log de consultas activado:
> Prisma **enumera las columnas, no hace `SELECT *`** — pide las **20** de `expenses`, **las 6
> nuevas incluidas**. Contra una base que no las tiene, esa consulta muere con
> `column expenses.base_amount does not exist`.
>
> O sea: en cuanto haga `pull` de `main` y regenere el cliente, **cualquier lectura por defecto de
> `expenses`, `quotes`, `invoices` o `providers` falla** — gastos, presupuestos, facturas y
> proveedores. No hace falta que su código toque los campos nuevos.
>
> **③ Lo arregla en dos minutos** y sin GO de nadie (es su base, cambio aditivo):
> `DATABASE_URL=<su clave de dev> bash scripts/db-push-prod` → el mismo preview, el mismo `GO`,
> la misma verificación. El SQL es el de esta entrada, idéntico.
>
> **Por qué la casilla se queda sin marcar en vez de esperarle:** `yaqu_dev_javier` es la base de
> desarrollo **de su carril** y su credencial es suya — no está en ninguna `.env` de esta máquina
> (medido: barrido de todos los árboles). Bloquear producción esperando al entorno de desarrollo
> de otra persona sería tener la prioridad al revés. La clave **no se pide ni se pega** en ningún
> sitio (regla 9).

> **🔎 VERIFICABLE** — que existan las nueve columnas: pregúntaselo a `docs/sql/deriva-prod.sql`
> contra cada base, **no a estas casillas**. **✋ SIN MECANISMO** — que estén en las tres.
> **NO HAY BACKFILL, y es deliberado** (ver abajo): las nueve nacen `NULL` y `NULL` es su valor
> legítimo para todo lo ya registrado.

⚠️ **UNA migración, no cuatro.** Cinco tickets comparten el mismo `db push` porque tres de ellos
necesitan columnas de la MISMA tabla (`Expense`) y aplicarlos por separado serían tres ventanas de
riesgo para el mismo cambio.

### Preview generado SIN tocar ninguna base

`node scripts/preview-migracion.mjs --desde <schema de origin/main>` — datamodel contra datamodel,
**offline**. Se evita a propósito `--from-schema-datasource`, que conectaría a la base de `.env`
(que es producción), y la variante que recibe la conexión por argumento, que la deja a la vista en
`argv`/`ps` (motivo de SCRUM-226).

**Control positivo: PASÓ — la herramienta respondió con 24 tablas.** Es lo que distingue «no hay
cambios» de «la herramienta no contesta»: el incidente de SCRUM-385 fue un `npx` que se bajó
prisma 7 y devolvió **vacío con exit 0**. El script ejecuta el binario LOCAL por ruta y reconoce el
vacío legítimo **por la frase** `-- This is an empty migration.`, nunca por el tamaño.

```sql
-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "es_adicional" BOOLEAN;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "deducts_refs" JSONB;

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "base_amount" DECIMAL(12,2),
ADD COLUMN     "provider_invoice_date" TIMESTAMP(3),
ADD COLUMN     "provider_invoice_number" TEXT,
ADD COLUMN     "vat_amount" DECIMAL(12,2),
ADD COLUMN     "vat_deducible" BOOLEAN,
ADD COLUMN     "vat_rate" INTEGER;

-- AlterTable
ALTER TABLE "providers" ADD COLUMN     "tax_id" TEXT;
```

### Recuento, contado del SQL y no a ojo

| | n |
|---|---|
| `ADD COLUMN` | **9** |
| `DROP` (cualquier forma) | **0** |
| `ALTER COLUMN` (columna existente) | **0** |
| `NOT NULL` | **0** |
| `DEFAULT` | **0** |
| `UNIQUE` / `CREATE INDEX` | **0** |
| `RENAME` / `TRUNCATE` / `DELETE FROM` | **0** |
| `ALTER TABLE` (sentencias) | 4 |

100 % aditivo: **nueve columnas nullable, sin default, sin unique, sin índice** → `db push` **no
debe** pedir `--accept-data-loss`. **Si lo pide, PARA**: significaría que el diff no es éste.

### Qué columna sirve a qué ticket

| tabla | columna | tipo | para |
|---|---|---|---|
| `expenses` | `base_amount` | `DECIMAL(12,2)` | SCRUM-403 (beneficio) · A5 (303) · E4 |
| `expenses` | `vat_rate` | `INTEGER` | A5 · E4 — **entero de porcentaje** (21/10/4/0), convención de `AlbaranLinea.tipoIva`, **no** la fracción de `Quote.lines[].tax` |
| `expenses` | `vat_amount` | `DECIMAL(12,2)` | A5 · E4 — la cuota **se guarda, no se recalcula** |
| `expenses` | `vat_deducible` | `BOOLEAN` | A5 — `null` = nunca clasificado ≠ `false` = se decidió que no |
| `expenses` | `provider_invoice_number` | `TEXT` | E4 — identifica el asiento de compra |
| `expenses` | `provider_invoice_date` | `TIMESTAMP(3)` | E4 — expedición del proveedor, distinta de `Expense.date` (el apunte) |
| `providers` | `tax_id` | `TEXT` | E4 — `Provider` no tenía **ningún** campo fiscal (medido: 0) |
| `quotes` | `es_adicional` | `BOOLEAN` | SCRUM-195 — `jobId` no distingue original de adicional |
| `invoices` | `deducts_refs` | `JSONB` | SCRUM-16/142 (#1) — mismo patrón que `albaran_refs` |

> ⚠️ **Dos columnas de `Expense` y la de `Provider` NO estaban en la lista corta del encargo** —
> `provider_invoice_number`, `provider_invoice_date` y `providers.tax_id`—, pero **sí** en la
> especificación medida de `docs/master/SCRUM-403.md`, y son las tres que E4 necesita para que un
> asiento de compra esté completo. Dejarlas fuera obligaría a una **segunda** migración para E4,
> que es justo lo que este lote viene a evitar. Se avisó antes de escribir el diff.

### Qué pasa con las filas que YA existen — una por una

**Ninguna fila se toca. Las nueve columnas quedan a `NULL`.**

| tabla | filas existentes | qué les pasa |
|---|---|---|
| `expenses` | todas | las **seis** columnas a `NULL`. `amount` **no se toca**: sigue siendo el mismo número que hoy |
| `providers` | todas | `tax_id` a `NULL` |
| `quotes` | todas | `es_adicional` a `NULL` |
| `invoices` | todas | `deducts_refs` a `NULL` |

🔴 **Y en `Expense` el `NULL` NO se rellena por suposición.** `amount` es **ambiguo por diseño**:
en ninguna parte está escrito si lleva IVA ni a qué tipo. Un backfill que lo adivine —«asumimos
21 %», «asumimos que es sin IVA»— produciría una base **indistinguible de una base real**, y sobre
ese número se calcularían el beneficio y el 303. **Es estrictamente peor que dejarlo vacío**: un
hueco dice «no se sabe», un número inventado afirma.

`NULL` aquí **es un dato**: significa «este gasto es un apunte de caja, no un asiento». El beneficio
y el 303 deben **excluir o declarar** esas filas, nunca completarlas.

Por eso, además, ninguna es `NOT NULL` y ninguna lleva `@default`: un default rellenaría el pasado
con una suposición y la haría indistinguible de un dato real.

### ¿Rompe algo mientras está a medias? — medido contra el código de HOY

**① `assertSchemaSinDeriva` solo falla por columnas que FALTAN.** Leído hoy en
`src/core/db/schemaDrift.ts:110-122`: el bucle recorre **`esperadas`** (lo que el schema declara) y
comprueba presencia en `real` (lo que la base tiene). **No recorre en la otra dirección ni una
vez** — una columna que está en la base y no en el schema es sencillamente invisible, y el
resultado es `en-sync`.

**② Prisma enumera columnas explícitas**, no `SELECT *`, así que un cliente generado del schema
viejo no ve las columnas nuevas y no puede tropezar con ellas. Esto **no lo he ejecutado contra una
base** (no se ha tocado ninguna): lo sostiene ① —que sí está medido— más el hecho de que **éste es
el orden canónico de la casa y se ha usado en las ~25 migraciones del registro**, todas con esa
misma ventana.

**Conclusión: el orden seguro sigue siendo MIGRAR PRIMERO, DESPLEGAR DESPUÉS.** Y no es simétrico:

| orden | qué ve el chequeo de arranque | resultado |
|---|---|---|
| **migrar → desplegar** | el schema viejo pide N columnas, la base tiene N+9 | `en-sync` ✅ |
| desplegar → migrar | el schema nuevo pide 9 que la base no tiene | `deriva` → **producción NO arranca** 🔴 |

Es exactamente el 500 de SCRUM-220: código desplegado esperando una columna que la base no tenía.

### Lo que este lote NO hace

1. **No cierra E4.** Da el *dónde* guardar, no el *cómo se rellena*: falta la pantalla, y el alta de
   gasto es deliberadamente rápida (SCRUM-135) — pedir seis campos fiscales ahí rompe ese flujo.
   Decisión de producto, no de schema.
2. **No decide qué es deducible.** `vat_deducible` es un campo, no un criterio: eso es dictamen.
3. **No arregla el pasado.** Los gastos ya registrados siguen sin base, y toda cifra que los use
   tiene que decirlo.
4. **No completa SCRUM-195 ni SCRUM-16/142**: da los campos, no la lógica que los rellena ni la que
   los consume. El diff de `EmitInvoiceInput` (#2 de SCRUM-16) **entra con esta migración, no antes**:
   sin la columna no compila.
5. **No toca `Invoice.total` ni ningún dato existente.**

---

## ⚠️ SCRUM-438 · EL DESPLIEGUE QUE ESTRENE v:3 DEL SOBRE DE FIRMA ES **DE IDA** — léelo antes de revertir

> **ESTO NO ES UNA MIGRACIÓN DE SCHEMA**, y se dice con esas palabras para que nadie lo busque en
> `information_schema`: v:3 **no toca ninguna columna** (los cinco campos caben en `evidenciaFirma`,
> que ya es `Json?`). Está aquí porque **éste es el fichero que se lee antes de tocar producción**,
> que es exactamente cuándo hace falta saberlo. Un documento aparte no se abre el día del rollback.
>
> **Escrito el 11-ago-2026, ANTES de que exista el primer sobre v:3** y antes de escribir una línea
> de su código (propuesta aprobada con enmiendas en `docs/master/SCRUM-438.md` §3).

**El escenario:** se despliega v:3 → se firma un albarán → **se revierte el código**. Ese sobre
queda sellado con una versión que el código anterior no sabe verificar.

**Qué pasa exactamente — medido el 11-ago-2026 ejecutando el código de entonces contra un sobre v:3:**

| Camino | Resultado |
| --- | --- |
| `verificarSobre` (el ZIP de evidencias) | **`version_no_soportada`** — *«NO se aproxima con la más parecida»*. **No dice «manipulado»** |
| `computeAlbaranContentHash(params, 3)` | **lanza** `albaran_contenido_version_desconocida:3` |
| `scripts/atestiguar-sobres.mjs` | **`SobreIlegibleError`**: lo declara, no lo cuenta como verificado |
| El **PDF** (vía `obraSegunVersion`) | con la enmienda 3 aplicada, **falla** en vez de imprimir un valor adivinado |

**LA REGLA, y es lo único que hay que recordar:**

1. **Revertir NO produce una acusación falsa.** El sobre pasa a **no verificable**, que es lo
   correcto: «no pude mirar» y «está manipulado» salen por puertas distintas.
2. **Se puede revertir** — pero **sabiendo** que los sobres sellados mientras tanto quedan como
   `version_no_soportada` **hasta que se vuelva a desplegar**. Vuelven solos: no hay que hacer nada.
3. 🔴 **JAMÁS se «arregla» reescribiendo la `v` del sobre.** Eso es alterar una evidencia emitida
   (regla 29), y además convierte un «no puedo comprobarlo» —honesto— en un hash que no cuadra, que
   es la acusación más grave que sabe hacer el verificador.

---

## SCRUM-449 · `auth_sessions.instalada_pwa` — ✅ APLICADO en las TRES bases (10-ago-2026)

**REGISTRO de lo que se ejecutó y se verificó el 10-ago-2026.** No es una afirmación sobre el
estado de hoy: es lo que se midió ese día, con su método.

Es la columna que desbloquea la **fase 2 de H5 (SCRUM-360)** — y, hasta que dev la tuvo,
`prisma/schema.prisma` **no se podía tocar**: `compararEsquema` recorre el esquema y pregunta si
cada cosa está en la base, **nunca al revés**. Con el esquema por delante de dev, las tres sesiones
se ponen rojas a la vez.

```sql
ALTER TABLE "auth_sessions"
  ADD COLUMN IF NOT EXISTS "instalada_pwa" BOOLEAN;
```

Fichero: `docs/sql/scrum-449-instalada-pwa.sql`. **Aditivo y re-ejecutable** (`IF NOT EXISTS`):
volver a correrlo sobre una base ya aplicada no hace nada y no falla.

> 🔴 **SIN `NOT NULL` Y SIN `DEFAULT`, A PROPÓSITO.** `null` es el **tercer estado** —«no se pudo
> saber»— y **no es lo mismo que `false`**. Un `DEFAULT false` lo destruiría en la primera fila:
> «no instalada» y «no supimos si estaba instalada» pasarían a ser el mismo valor, que es
> exactamente el recuento tranquilo y falso que SCRUM-360 separó en tres estados.

> ⚠️ **NOMBRES DE LA BASE (snake_case), no del modelo.** Salen de los `@@map`/`@map`: la tabla es
> `auth_sessions`, y la convención de ese modelo es snake_case (`merchant_id`, `team_member_id`,
> `expires_at`, `used_at`, `created_at`). No se «corrigen».

> ⚠️ **`prisma/schema.prisma` TODAVÍA NO LO LLEVA, y es deliberado:** lo edita el fundador **ahora
> que las tres bases están**. Mientras dure esa ventana **las bases van por delante del esquema a
> propósito**, así que **NO se corre `prisma migrate diff` contra ninguna**: propondría **BORRAR**
> la columna. Esta sesión no lo ha ejecutado.

### Por qué `db execute` y no `db push`

`db push` sincroniza la base **con el schema**, y el schema todavía no tiene la columna: le pediría
justo lo contrario de lo que se quiere. `db execute --file` aplica **exactamente esa sentencia y
nada más**. Además, `npm run db:push` y sus envoltorios están rotos (SCRUM-223).

> 🔴 Y lo que eso obliga a añadir: `--accept-data-loss` **protege a `db push`, NO a
> `db execute --file`** (medido en SCRUM-395). `db execute` corre lo que le des. Por eso dev se
> aplicó con `scripts/aplicar-sql-dev.mjs`, que **lee el fichero entero, lo enseña línea a línea y
> solo aplica las formas de una LISTA BLANCA**; lo que no sabe clasificar lo **rechaza**. Se corrió
> primero **en ensayo** (sin `--go`) y se enseñó el SQL completo antes de tocar nada.

| Base | Host · nombre | Cómo se aplicó | Verificación |
| --- | --- | --- | --- |
| **Producción** | `autorack…` / `railway` (55 filas en `invoices`) | **a mano por el fundador**, 10-ago-2026 | ✅ **columna = 1** |
| **Staging** | `acela.proxy.rlwy.net` / `railway` (7 filas) | **a mano por el fundador**, 10-ago-2026 | ✅ **columna = 1** |
| **Dev** | `acela.proxy.rlwy.net` / `yaqu_dev_javier` (0 filas) | **esta sesión (SCRUM-449)** con `node scripts/aplicar-sql-dev.mjs --file docs/sql/scrum-449-instalada-pwa.sql --go`, tras el ensayo | ✅ **`yaqu_dev_javier` · 0 · 1** |

**La consulta de verificación —UNA sola, y es la que manda.** Se lee el CATÁLOGO, nunca el mensaje
del comando:

```sql
SELECT
  current_database()                                        AS base,
  (SELECT count(*) FROM invoices)                           AS invoices,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name = 'auth_sessions'
       AND column_name = 'instalada_pwa')                   AS columna;
```

> 🔴 **VA EN UNA SOLA CONSULTA A PROPÓSITO:** confirma **dónde** estás y **qué** hiciste al mismo
> tiempo, y así ningún número puede esconderse detrás de otro en una consola que ejecuta varias
> sentencias. Mismo patrón que SCRUM-425.

**Los dos discriminadores, porque dev y staging COMPARTEN HOST.** Mirar solo el host las daría por
iguales: hace falta el **nombre de base** (`yaqu_dev_javier` es la única con nombre propio; las
otras dos se llaman `railway`) y el **recuento de `invoices`** como confirmación cruzada.

> **✋ Y el suelo, que no es ceremonia:** si la tabla `invoices` **no existiera**, eso no sería «dev
> está vacía» — sería no estar donde uno cree, y había que parar. Se comprobó **antes** del `ALTER`
> con la misma consulta sin la columna: devolvió `yaqu_dev_javier` · 0, o sea que la tabla existe y
> el 0 es un recuento de verdad, no una tabla ausente. `IF NOT EXISTS` protege la **columna**, no
> la **tabla**: sobre una base equivocada habría creado la columna tan tranquilo.

**Sobre la credencial:** se usó `DATABASE_URL_DEV` del entorno. **La URL no viaja en `argv`** —ni
`--url` ni `--from-url`, que quedan en `ps` y dentro de `e.message`—: el aplicador la pasa en el
entorno del hijo y la parsea con `parseBDSegura`, que no tiene forma de devolver la cadena. En este
registro solo constan **nombre de la clave, host y base**.

---

## SCRUM-425 · `albaranes.clave_idempotencia` + su único — ✅ APLICADO en las TRES bases (10-ago-2026)

**REGISTRO de lo que se ejecutó y se verificó el 10-ago-2026.** No es una afirmación sobre el
estado de hoy: es lo que se midió ese día, con su método.

Es la columna que desbloquea **SCRUM-358 (H3)**: la clave de idempotencia del alta de albarán,
opción 1 del informe (clave acuñada en el cliente + pregunta al constraint DENTRO del cerrojo de
serie, forma F3 de `invoiceNumber.service.ts:115-122`).

```sql
ALTER TABLE "albaranes"
  ADD COLUMN IF NOT EXISTS "clave_idempotencia" VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS "albaranes_merchant_id_clave_idempotencia_key"
  ON "albaranes"("merchant_id", "clave_idempotencia");
```

Fichero: `docs/sql/scrum-425-clave-idempotencia.sql`. **Aditivo y re-ejecutable** (las dos con
`IF NOT EXISTS`): volver a correrlo sobre una base ya aplicada no hace nada y no falla.

> 🔴 **EL ÍNDICE NO ES UN ACCESORIO, y por eso la verificación lo mira aparte.** El mecanismo de
> H3 pregunta **al constraint**; sin el único, esa pregunta no tiene a quién hacerse y la columna
> sola no impide el duplicado. **Si el índice sale 0, NO está hecho** aunque la columna esté.

> ⚠️ **NOMBRES DE LA BASE (snake_case), no del modelo.** Salen de los `@@map`/`@map`, y el del
> índice es el que **Prisma deriva** de los nombres de base — mismo patrón que
> `charges_receipt_token_key` y `albaranes_merchant_id_invoice_id_idx`. No se «corrigen».

> ⚠️ **`prisma/schema.prisma` TODAVÍA NO LO LLEVA, y es deliberado:** lo edita el fundador ahora
> que las tres bases están. **Las bases van por delante del esquema A PROPÓSITO**, así que
> **NO se corre `prisma migrate diff` contra ninguna** mientras dure esa ventana: propondría
> **BORRAR** la columna. Ninguna sesión lo ha ejecutado.

### Por qué `db execute` y no `db push`

`db push` sincroniza la base **con el schema**, y el schema todavía no tiene la columna: le pediría
justo lo contrario de lo que se quiere. `db execute --file` aplica **exactamente estas dos
sentencias y nada más**. Además, `npm run db:push` y sus envoltorios están rotos (SCRUM-223).

> 🔴 **Y lo que eso obliga a añadir:** `--accept-data-loss` **protege a `db push`, NO a
> `db execute --file`** (medido en SCRUM-395). `db execute` corre lo que le des. Por eso dev se
> aplicó con `scripts/aplicar-sql-dev.mjs`, que **lee el fichero entero, lo enseña línea a línea y
> solo aplica las formas de una LISTA BLANCA** (`ALTER TABLE … ADD COLUMN` y
> `CREATE [UNIQUE] INDEX`); lo que no sabe clasificar lo **rechaza**. Sus rojos corren en
> `npm test` (`tests/scrum425-aplicador-sql-dev.test.mjs`).

| Base | Host · nombre | Cómo se aplicó | Verificación |
| --- | --- | --- | --- |
| **Producción** | `autorack…` / `railway` | **a mano por el fundador** | ✅ **columna = 1 · índice = 1** |
| **Staging** | `acela.proxy.rlwy.net` / `railway` | **a mano por el fundador** | ✅ **columna = 1 · índice = 1** |
| **Dev** | `acela.proxy.rlwy.net` / `yaqu_dev_javier` (0 filas) | sesión de SCRUM-425 con `node scripts/aplicar-sql-dev.mjs --file … --go`, tras GO del fundador y con el ensayo enseñado antes | ✅ **columna = 1 · índice = 1** |

**La consulta de verificación —una sola, y es la que manda.** Se lee el CATÁLOGO, nunca el mensaje
del comando:

```sql
SELECT
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name='albaranes' AND column_name='clave_idempotencia') AS columna,
  (SELECT count(*) FROM pg_indexes
     WHERE tablename='albaranes'
       AND indexname='albaranes_merchant_id_clave_idempotencia_key') AS indice;
```

> **✋ DECLARACIÓN MANUAL PARA EL ÍNDICE (SCRUM-225).** El censo de SCRUM-222 declara que **no mira
> índices** — solo presencia de tabla y columna. Así que ningún verde de esa herramienta dice nada
> sobre la marca del índice: se cree bajo la palabra de quien la escribió. La **columna** sí es
> 🔎 verificable por ese camino.

**Un tropiezo del día que conviene dejar escrito:** el primer intento de aplicar a dev **no aplicó
nada** y dijo `` `prisma db execute` terminó con código null ``. Causa: desde Node 20.12/22
(arreglo de CVE-2024-27980) `spawn` **se niega a ejecutar un `.cmd`** sin `shell: true`, y se
invocaba `npx.cmd`. Arreglado llamando al **JS local de Prisma con `node`** —sin shell, sin `.cmd`
y sin riesgo de que `npx` se baje otro CLI de la red (incidente del 5-ago)— y **reportando
`r.error`**, porque un `status: null` mudo no dice si falló la base o el lanzamiento.

---

## SCRUM-300 (C5) · cuatro columnas en `albaranes` — ✅ APLICADO en las TRES bases (7-ago-2026)

**REGISTRO de lo que se ejecutó y se verificó el 7-ago-2026.** No es una afirmación sobre el
estado de hoy: es lo que se midió ese día, con su método.

Las cuatro columnas, todas **nullable y sin default** (`ADD COLUMN` puro, aditivo):
`fecha_entrega` · `lugar_entrega` · `firmado_por_nombre` · `firmado_por_calidad`.

| Base | Host · nombre | Cómo se aplicó | Verificación | App |
| --- | --- | --- | --- | --- |
| **Staging** | `acela.proxy.rlwy.net` / `railway` | `prisma db execute` con el SQL de `migrate diff --from-schema-datasource` | `information_schema`: las 4, `is_nullable=YES`; `fecha_entrega` = `timestamp without time zone`, las otras tres `text` | ✅ arrancó — `[schema] en sync: 24 tablas / 335 columnas`, `/version` HTTP 200 |
| **Dev** | `acela.proxy.rlwy.net` / `yaqu_dev_javier` | igual, con el SQL **recortado** a solo el `ALTER TABLE` de `albaranes` | mismas 4 columnas, mismos tipos, `is_nullable=YES` | ✅ (ver SCRUM-205 abajo: hasta aplicar `vf_estado` no arrancaba, y no por C5) |
| **Producción** | `autorack…` / `railway` (55 filas en `invoices`) | **a mano por el fundador**, desde la consola de Railway del servicio `Postgres` | `information_schema`: `fecha_entrega` (`timestamp without time zone`), `lugar_entrega` / `firmado_por_nombre` / `firmado_por_calidad` (`text`), las cuatro `is_nullable=YES` | ✅ `yaqu.app` comprobada en pie después |

> **HUECO DECLARADO (producción):** no se verificó la **precisión (3)** del `timestamp` de
> `fecha_entrega`. El guard de deriva **no comprueba tipos** —solo que tabla y columna existan—,
> así que ni él ni `deriva-prod.sql` van a delatar una precisión distinta. Queda dicho para que
> nadie lo dé por comprobado.

**Comprobación cruzada final (7-ago-2026):** `docs/sql/deriva-prod.sql` **generado desde el schema
de C5** (335 columnas / 24 tablas) devolvió **0 filas** contra staging y contra dev — o sea que las
dos tienen todo lo que el código de C5 nombra, no solo las cuatro columnas nuevas.

---

## SCRUM-205 · `invoices.vf_estado` — ✅ APLICADO TAMBIÉN EN DEV (7-ago-2026)

**REGISTRO.** El 7-ago-2026 se aplicaron a **dev** (`acela…/yaqu_dev_javier`) las dos sentencias
que le faltaban, con autorización expresa del fundador para salir del carril de C5:

```sql
ALTER TABLE "invoices" ADD COLUMN "vf_estado" TEXT NOT NULL DEFAULT 'pendiente_de_sellado';
CREATE INDEX "audit_log_merchant_id_entity_type_entity_id_idx" ON "audit_log"("merchant_id", "entity_type", "entity_id");
```

Verificado en `information_schema`: `invoices.vf_estado` — `text`, `is_nullable=NO`,
`column_default = 'pendiente_de_sellado'::text`; e índice
`audit_log_merchant_id_entity_type_entity_id_idx` presente en `pg_indexes`.

> **EL BACKFILL FUE NO-OP, Y ESO NO ES «no se ejecutó».** `SELECT COUNT(*) FROM invoices` contra
> dev devolvió **0** *antes* de aplicar. El `DEFAULT 'pendiente_de_sellado'` cae sobre las filas
> existentes, y en dev **no había ninguna**: no existe la fila que `prisma/backfill/scrum205-vf-estado.sql`
> vendría a corregir. El daño que ese fichero documenta —marcar como pendiente lo que ya está
> sellado— **no tiene sobre qué caer aquí**. En staging no se plantea: ya estaba aplicado y su
> reparto medido (6 `no_aplica` · 1 `pendiente_de_sellado`).
>
> ⚠️ Esto vale **para dev y para el 7-ago-2026**. En cualquier base con filas, el backfill vuelve
> a ser obligatorio y en la misma ventana que el `ALTER TABLE`.

**Motivo de que dev fuera por detrás:** medido el 7-ago, dev no tenía ni `vf_estado` ni el índice,
mientras staging sí. El arranque contra dev fallaba con
`COLUMNAS que faltan (1): invoices.vf_estado (Invoice.vfEstado)` — **ninguna de las cuatro de C5**,
que ya estaban aplicadas y verificadas. Tras aplicar lo de arriba, la app arranca contra dev:
`[schema] en sync: 24 tablas / 331 columnas`, `/version` HTTP 200.

---

## SCRUM-300 · albaranes: entrega + quién firma (C5) — 🔴 SIN APLICAR en ninguna de las tres

> ### ⏳ ESTA CABECERA CADUCÓ — se aplicaron el 7-ago-2026 (anotado al rebasar C5, 7-ago-2026)
>
> **«SIN APLICAR en ninguna de las tres» era cierto cuando se escribió y ya no lo es.** El registro
> de la ejecución está **justo arriba**, en «SCRUM-300 (C5) · cuatro columnas en `albaranes` — ✅
> APLICADO en las TRES bases»: staging y dev por `prisma db execute`, producción a mano por el
> fundador, las tres verificadas contra `information_schema`.
>
> **Las dos entradas se conservan enteras y ninguna se resume**, que es la regla de la casa cuando
> dos sesiones escriben a la vez — y aquí además son complementarias: arriba está lo que se
> EJECUTÓ, y aquí abajo el PREVIEW, el SQL exacto, por qué `fecha_entrega` entra y el aviso de
> herramienta. Lo único que se corrige es el tiempo verbal de este título, porque una afirmación
> sobre el presente caduca y un registro fechado no (`docs/METODO_YAQU.md`).
>
> ⚠️ **Lo que NO ha caducado es el gate del final de esta entrada:** las seis etiquetas de «en
> calidad de qué» siguen sin aprobar (regla 30). Que el esquema esté aplicado no levanta ese gate.

> **🔎 VERIFICABLE** — que existan las cuatro columnas: pregúntaselo a `docs/sql/deriva-prod.sql`
> contra cada base, no a esta cabecera. **✋ SIN MECANISMO** — que estén aplicadas en las tres.
> **No hay backfill**: las cuatro nacen NULL y NULL es su valor legítimo para todo lo ya firmado.

⚠️ **Entrada FUNDIDA de las dos implementaciones paralelas de C5** (`scrum-300-campos-albaran` y
`scrum-300-firmado-por`), que escribieron su preview por separado y con esquemas distintos. El
mapa de la fusión está en `docs/master/SCRUM-300.md`.

Preview generado **sin tocar ninguna base**: `migrate diff` de datamodel contra datamodel (el
`prisma/schema.prisma` de `origin/main` como origen, el de esta rama como destino). Se evita a
propósito `--from-schema-datasource`, que habría **conectado a la base de `.env`** —que es
producción— y también la variante que recibe la conexión **por argumento**, que la deja a la
vista en `argv`/`ps` (el motivo de SCRUM-226; la conexión viaja por el ENTORNO o no viaja):

```sql
-- AlterTable
ALTER TABLE "albaranes" ADD COLUMN     "fecha_entrega" TIMESTAMP(3),
ADD COLUMN     "firmado_por_calidad" TEXT,
ADD COLUMN     "firmado_por_nombre" TEXT,
ADD COLUMN     "lugar_entrega" TEXT;
```

100 % aditivo: **cuatro columnas nullable, sin default, sin UNIQUE, sin índice** → `db push` no debe
pedir `--accept-data-loss`. **Si lo pide, PARA**: significaría que el diff no es el que está aquí.

- `lugar_entrega` — contenido mínimo obligatorio del albarán. Campo **del albarán**, no del Trabajo
  (decisión del asesor, 5-ago-2026): `Job.direccion` es precarga opcional y hoy es null para
  cualquier merchant real. ⚠️ Suelo: vacío antes que caer al domicilio fiscal.
- `fecha_entrega` — el día real de la entrega, distinto del de emisión. Es el **campo nº 1 del
  ticket**.
- `firmado_por_nombre` / `firmado_por_calidad` — QUIÉN firmó y EN CALIDAD DE QUÉ.
  ⚠️ `firmado_por_calidad` guarda **el `id` de la ranura** (`encargado_o_personal_de_obra`), no su
  etiqueta, y en la ranura libre `otro:<texto>`. Por eso los seis ids quedaron fijados **antes** de
  esta migración: cambiarlos después obliga a migrar filas de documentos ya firmados.

### ⚠️ Por qué `fecha_entrega` SÍ va, aunque una de las dos ramas argumentara que no

`scrum-300-firmado-por` la dejó fuera con este razonamiento: `albaranes.fecha` ya es la fecha de
entrega —está sellada en el hash, se imprime como «Entrega/ejecución» y es la clave del mes natural
de la recapitulativa (art. 13 RD 1619/2012)—, así que una segunda fecha podría **divergir de la que
agrupa la factura**: PDF diciendo julio y recapitulativa agrupando en agosto.

**El asesor decidió el esquema de 4 columnas** (5-ago-2026). El riesgo que señalaba esa rama es
real y se neutraliza así, que es como está construido el código de esta rama:

- `fecha` **sigue siendo** la fecha del documento y la única que agrupa la recapitulativa.
  `fecha_entrega` es **documental**: no entra en ninguna agrupación ni en ningún cálculo fiscal.
- El editor del albarán **NO escribe `fecha`** al tocar `fecha_entrega` (`jobDetailView.js`), así
  que abrir el editor no puede mover una factura de mes.

### ⚠️ AVISO DE HERRAMIENTA — muerde al preview obligatorio, no a esta migración

El CLI instalado es **prisma 7.9.1** y el cliente **@prisma/client ^6.18.0**. En el 7, los flags
`--from-schema-datamodel`/`--to-schema-datamodel` que documenta `CLAUDE.md` **ya no existen** (ahora
son `--from-schema`/`--to-schema`), y **con cualquiera de las dos formas `migrate diff` devuelve
SALIDA VACÍA con exit 0** — porque el 7 dejó de leer la config de `package.json#prisma` (lo avisa el
propio 6: *«deprecated and will be removed in Prisma 7»*).

Es decir: **el preview obligatorio antes de cada `db push` a producción dice hoy "no hay cambios"
pase lo que pase.** Un fail-open silencioso justo en el guard que protege prod. Mientras no se
arregle (`prisma.config.ts` o fijar el CLI al 6), el preview se hace con `npx prisma@6.18.0`, y
**nunca** se da por bueno un diff vacío sin control positivo (`--from-empty` debe escupir el
esquema entero; si sale vacío, el roto es el CLI).

> 📌 **CADUCADO — MEDIDO EL 6-ago-2026 (SCRUM-385 arreglado).** Lo de arriba se CONSERVA como
> registro de lo que se midió entonces; **como estado de HOY es falso**, y por eso se anota aquí
> al lado en vez de borrarlo. El CLI instalado es **prisma 6.18.0** en los cuatro worktrees, y
> `package.json` fija `^6.18.0`, que no alcanza el 7.x. `migrate diff` **discrimina**, medido con
> los dos controles que este mismo aviso exigía:
>
> | Control | Salida | Veredicto |
> | --- | --- | --- |
> | `--from-empty` → schema actual | **24.338 bytes / 718 líneas** de DDL | no es fail-open |
> | dos esquemas idénticos | `-- This is an empty migration.` (32 bytes) | vacío legítimo |
> | un campo de más (mismo modo) | su `ALTER TABLE … DROP COLUMN` | discrimina |
>
> El tercero va porque `--from-empty` recorre **otro camino** que el `datamodel`-vs-`datamodel`:
> los dos primeros solos no prueban que ESE modo distinga. Y el hallazgo que cambia la vigilancia:
> **el vacío legítimo ya no es la cadena vacía** — se autodeclara. Así que **una salida de 0 bytes
> es firma inequívoca de rotura**, que es justo lo que vigila el suelo anti-silencio de
> `scripts/db-push-prod:100-111` (aborta sin salida; solo declara «nada que aplicar» si lee
> literalmente `empty migration`).
>
> ⚠️ **Sigue SIN medir `--from-schema-datasource`**, que es el que usa el comando obligatorio de
> `CLAUDE.md`: conecta a la base de `.env` —producción—, así que no se ejercitó. Lo validado es el
> motor de diff y el wrapper por lectura, no el camino que conecta.

**Orden de aplicación (regla de las TRES BD, SCRUM-169):** staging → `yaqu_dev_javier` → producción.
Turno del fundador; esta rama solo deja el preview. El código de la rama **lee y escribe** las cuatro
columnas, así que aplicar el schema va **antes** del deploy o hay P2022.

🔴 **GATE ADICIONAL DE ESTA MIGRACIÓN, y no es de esquema:** las seis etiquetas de «en calidad de
qué» **siguen sin aprobar** (regla 30) y hoy se pintan con `[PENDIENTE microcopy oficial]`. Ese
marcador acabaría **impreso en el PDF de un albarán firmado** en cuanto se pueda firmar en v:2. No
migres antes de tener los seis textos del fundador.

---

## SCRUM-205 · `invoices.vf_estado` (estado de sellado explícito) — MEDIDO 6-ago-2026, ver tabla

> **Estado POR BASE, con la fecha y el método de cada medición** (antes esta cabecera decía
> «🔴 SIN APLICAR en ninguna de las tres», y para producción **era falso**):
>
> | Base | `invoices.vf_estado` | Backfill | Medido cómo | Cuándo |
> | --- | --- | --- | --- | --- |
> | `acela…/railway` (**staging**) | ✅ **existe** | ✅ **corrió** — 6 `no_aplica` · 1 `pendiente_de_sellado` (7 facturas). Si no hubiera corrido, las 7 estarían en el default | `deriva-prod.sql` + `COUNT(*) GROUP BY` (331 columnas leídas) | 6-ago-2026 |
> | `acela…/yaqu_dev_javier` (**dev**) | 🔴 **NO existe** | — (sin columna no hay recuento) | `deriva-prod.sql` directo (330 columnas leídas) | 6-ago-2026 |
> | `autorack…` (**producción**) | ✅ existe, **por INFERENCIA — NO medido** | ❔ **SIN MEDIR** | la app arranca y `assertSchemaSinDeriva` se niega a arrancar con deriva en `NODE_ENV=production` (`schemaDrift.ts:266-268`); `/health` → `db:"up"` | 6-ago-2026 |
>
> ⚠️ **El backfill de PRODUCCIÓN sigue sin medir, y es la pregunta que queda viva.** Que la columna
> exista no dice si el backfill corrió. Si existe pero no corrió, todo el histórico está en
> `pendiente_de_sellado` y `puedeProducirDocumento()` le niega PDF y QR **en silencio**: sin 500 y
> sin alarma. Que en staging sí corriera es un indicio, no una prueba: son bases distintas.
>
> El único `pendiente_de_sellado` de staging es justo lo que el backfill DECLARA en vez de
> adivinar: una factura fiscal sin huella y sin motivo para no tenerla. Es un dato de negocio que
> hay que mirar, no barrer.

### 🔴 LA MISMA CLAVE APUNTA A DOS BASES DISTINTAS SEGÚN EL WORKTREE (medido 6-ago-2026)

Censo de los cuatro árboles, imprimiendo solo `clave → host/base` con `describirBD`:

| Worktree | Clave | Base real |
| --- | --- | --- |
| `cobroflash-backend` | `DATABASE_URL_STAGING` | `acela…/yaqu_dev_javier` → **DEV** |
| `cobroflash-b1` | `DATABASE_URL_STAGING` | `acela…/railway` → **STAGING** |
| `cobroflash-b2` | `DATABASE_URL_STAGING` | `acela…/railway` → **STAGING** |
| `cobroflash-b3` | `DATABASE_URL_STAGING` | `acela…/railway` → **STAGING** |

**Un solo nombre de variable, dos bases.** Cuál te toca depende de en qué directorio estés parado
—algo que ningún comando te recuerda—, y las dos viven en el mismo host, así que el guard de
hostname (`_db-guard.mjs`) no las distingue. Es el escenario contra el que avisa SCRUM-383.

⚠️ Y el reparto que este mismo documento declara más abajo **también está desfasado**: dice que
staging es «la base del worktree `cobroflash-b2`» y dev «base de `cobroflash-b1`». Medido: `b1`
tiene STAGING, y quien tiene DEV es el worktree PRINCIPAL, que ahí ni se menciona.

**Regla que sale de esto:** antes de cualquier operación, imprimir `host/base` con `describirBD` y
mirarlo. El nombre de la variable no es una fuente: esta noche ha mentido dos veces.
### 🔴 ANTES DE APLICAR ESTO: COMPRUEBA A QUÉ BASE APUNTA TU CLAVE

**El mapa medido de los cuatro worktrees está arriba**, en el bloque de las TRES BD («QUÉ BASE TOCA
CADA WORKTREE»), y **no se repite aquí a propósito**: ese bloque lo protege el guard de SCRUM-225,
que exige que sea idéntico en `MIGRATIONS_PENDING.md` y `RUNBOOKS.md`. Una segunda copia fuera de
esa protección es exactamente cómo un dato correcto se vuelve falso en un sitio y no en el otro —
que es lo que pasó con el reparto anterior, y mintió por duplicado durante días.

Lo que hay que saber al aplicar esta migración (SCRUM-383): `DATABASE_URL_TESTS` **no significa lo mismo en
todos los worktrees**, y staging y dev comparten host, así que el guard de hostname
(`_db-guard.mjs`) no las distingue. Lo vigila `tests/scrum383-clave-vs-destino.test.mjs`.

**Regla:** antes de cualquier operación, imprimir `host/base` con `describirBD` y mirarlo. El
nombre de la variable no es una fuente: la noche del 6-ago-2026 mintió dos veces.

### 🔴 NO HAY FORMA DE OBSERVAR PRODUCCIÓN SIN CREDENCIALES DE BASE (medido 6-ago-2026)

Buscado en el árbol: **ninguna ruta** expone deriva de esquema ni reparto de `vf_estado`.
`/health` (`health.routes.ts:10-17`) hace `SELECT 1` y devuelve `db:"up"` — prueba que hay
conexión, y nada más. `comprobarDerivaDeSchema` solo se llama en el arranque (`index.ts:23`), y su
resultado se escribe en el log y se descarta: no queda expuesto en ninguna respuesta.

Consecuencia: el estado del esquema de producción **solo es observable con credencial de base**, y
no hay ninguna en los cuatro worktrees (todas apuntan a `acela`; producción es `autorack`). El CLI
de Railway tampoco está instalado. Va a SCRUM-383.

### 📌 Un registro de lo que se MIDIÓ no caduca; una afirmación sobre el estado ACTUAL, sí

La lección de esta noche (con S2), y el motivo de que esta cabecera lleve ahora fecha y método en
cada fila. Las dos cosas parecen la misma y se comportan al revés:

* **«El 6-ago-2026 medí que dev no tenía la columna»** — sigue siendo cierto para siempre. Es un
  hecho fechado.
* **«SIN APLICAR en ninguna de las tres»** — es una afirmación sobre el AHORA, y envejece sola: se
  volvió falsa en cuanto alguien aplicó el ALTER en producción, sin que nadie tocara el documento.

Esta cabecera era lo segundo **escrito como si fuera lo primero**, y por eso mintió durante días en
el único documento que se consulta ANTES de tocar una base. El arreglo no es «acordarse de
actualizarla»: es que **toda afirmación de estado lleve fecha y método**, para que se lea como lo
que es —una foto— y no como una verdad permanente.

⚠️ El aviso «pregúntaselo a `deriva-prod.sql`, no a esta cabecera» ya estaba escrito más abajo, y
no bastó: un aviso dentro de un documento cuya cabecera afirma lo contrario es un aviso que se lee
tarde. Por eso la corrección va ARRIBA.

### ✅ Autorización de lectura sobre producción (6-ago-2026) — y cuándo decae

La regla «producción no se toca ni en lectura» tenía como premisa la existencia de **merchants
reales y datos sensibles**. El fundador confirmó la noche del 5-ago-2026 que **hoy no los hay**
(ver SCRUM-242), y sobre esa base autorizó esta medición de solo lectura: `deriva-prod.sql` y el
`COUNT(*) GROUP BY vf_estado`, ninguna consulta más y ni una escritura.

🔴 **LA REGLA VUELVE A ESTAR EN VIGOR EL DÍA QUE HAYA UN MERCHANT REAL.** Esta autorización es de
esta medición y de esta fecha; no es un permiso permanente ni un precedente.

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
> primer cliente real** — de ahí la fecha. **Y desde SCRUM-390 esa condición es EVALUABLE**, no prosa: la puerta de SCRUM-390: **cualquier merchant con `stripeSubscriptionId != null`, o mas merchants que `CUENTAS_DE_PRUEBA_DECLARADAS`** (`src/modules/system/domain/puertaClienteReal.ts`, comprobable con `npm run puerta:cliente-real`). Regla completa en `docs/YAQU_MASTER.md`.
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

## 12-ago-2026 — customers.recargo_equivalencia (SCRUM-294-a) — SIN PUSH: la columna YA ESTABA ✅

```prisma
recargoEquivalencia Boolean? @map("recargo_equivalencia")   // en `model Customer`
```

🔴 **NO HAY `db push` QUE APROBAR, Y ESO ES LO QUE HAY QUE REGISTRAR.** La columna
`customers.recargo_equivalencia` **ya existe en producción y en staging** —verificado por el
fundador contra `information_schema`—, así que lo que cambia aquí es **el esquema poniéndose al día
con la base**, no la base poniéndose al día con el esquema. Es el caso inverso al habitual y por eso
se anota: quien lea esta lista buscando qué falta por aplicar, no encontrará nada que aplicar.

- **`Boolean?` SIN `@default`, y es la decisión entera.** Un `@default(false)` convertiría a **todos
  los clientes existentes** en «declarado que NO lleva recargo», y eso **no lo ha dicho nadie**. Los
  tres estados salen del tipo, sin inventar ninguno:
  `NULL` = no consta · `false` = declara que no · `true` = declara que sí.
- **Aditiva por definición**: no se crea nada, no se borra nada, no se toca ninguna fila.
- 🛑 **NO está cableada al total.** El recargo cambia lo que el cliente paga —base + cuota +
  recargo— y por tanto **el número que se sella**: eso es camino de emisión (regla 38) y no entra
  con este dato. El cálculo ya existe y espera sin llamadores en
  `src/modules/invoicing/domain/recargoEquivalencia.ts` (censado en SCRUM-484 como `MOTOR_EN_ESPERA`).
## SCRUM-293 (A2) · retención de IRPF — 12-ago-2026

`Merchant.retencionIrpfDeclarada` (`retencion_irpf_declarada`, boolean, default false) y
`Merchant.retencionIrpfTipo` (`retencion_irpf_tipo`, int, nullable).

**NO se ha ejecutado ningún `db push`, y no es un olvido: las dos columnas YA EXISTEN en producción
y en staging**, verificado contra `information_schema` por otro carril. Lo que iba por detrás era
el `schema.prisma`, no las bases — así que este commit hace que el esquema **alcance** a la
realidad, no al revés.

`guard:prisma` en verde tras `prisma generate`: el cliente coincide con el esquema en los dos
sentidos (529 líneas comparadas). Si algún día una base no las tuviera, `assertSchemaSinDeriva`
lo cantaría al arrancar — que es exactamente su trabajo.

Aditivo puro: una columna con default y otra anulable. No reescribe ninguna fila existente.

## SCRUM-643 (fase ②) · `Merchant.timezone` — 2-sep-2026

`Merchant.timezone` (`timezone`, TEXT, **nullable, SIN default**). El huso horario con el que se
calcula el calendario del merchant — a qué día y a qué mes natural pertenece un instante.

⚠️ **NO confundir con el RÉGIMEN fiscal (IVA / IGIC canario / IPSI de Ceuta y Melilla), que es
otro dato y es SCRUM-646.** Coinciden geográficamente en Canarias pero no son lo mismo, y la
relación no es biyectiva: Ceuta y Melilla llevan IPSI con el huso de la península.

**Aplicado a mano, no con `db push`** — porque `schema.prisma` va DETRÁS a propósito (ver abajo):

| Base | Antes | `ALTER` | `UPDATE` · filas tocadas | Después |
|---|---|---|---|---|
| **dev** (`yaqu_dev_javier`) | columna no existía · 5 merchants | aplicado | **5 / 5 esperadas** | `Europe/Madrid`=5 · 0 NULL |
| **staging** (`railway`, host `acela`) | columna no existía · 8 merchants | aplicado | **8 / 8 esperadas** | `Europe/Madrid`=8 · 0 NULL |
| **producción** | — | ⛔ **PENDIENTE, la aplica el fundador** | esperadas **13** | — |

El número esperado se **declaró antes** de ejecutar (contando merchants en cada base) y el script
**para y sale con código 1** si el `UPDATE` toca otra cantidad. En las dos cuadró. Acreditado
contra `information_schema` después: `data_type=text`, `is_nullable=YES`, `column_default=null`.

Turno de staging **tomado y soltado** (`scripts/turno-staging.mjs`); libre al terminar.

### 🔴 EL ORDEN, y por qué `schema.prisma` NO se toca todavía

`schemaDrift.ts` compara **esperado ⊆ real** al arrancar: un `schema.prisma` que nombre una
columna que la base no tiene → **producción no arranca** (es lo que se vivió en SCRUM-220). Por
eso primero van las **tres** bases y después el esquema, todo junto en el PR ③ con el código y
los tests. Una columna de MÁS en la base no rompe nada: la dirección que duele es la contraria.

**Backfill a `Europe/Madrid`:** vale **por el estado de los datos, no por el criterio** — los
merchants de hoy son todos de prueba. Con merchants reales sería la decisión equivocada, porque
declararía peninsular a un canario. La pregunta al profesional (salida C) sigue en el plan para
los usuarios futuros y **el backfill no la sustituye**.

## SCRUM-593 (fase ②) · los dos textos libres del documento — 2-sep-2026

Tres columnas, todas `TEXT`, **nullable y SIN default**:
`quotes.doc_header_text` · `quotes.doc_footer_text` · `albaranes.doc_header_text`.
El SQL, aplicable y re-ejecutable, en **`docs/sql/scrum-593-cabecera-y-pie.sql`**.

**Son TRES y no cuatro:** el pie del albarán ya existe —`albaranes.notas`— y ya se imprime. Ahí
sólo cambia el rótulo, que es copy y no esquema. Un `albaranes.doc_footer_text` daría dos campos
para lo mismo, y al día siguiente no se sabría cuál manda.

### 🔴 SE NOMBRA LA BASE FÍSICA, NO LA VARIABLE — y esta migración es la razón

Al medir el estado previo se destapó que **`DATABASE_URL_STAGING` y `DATABASE_URL_TESTS` son la
misma cadena** y resuelven a la **misma base**. Escribir «aplicado en dev y staging» habría
nombrado tres cosas donde hay dos, y habría dejado sin registrar que la base de la tanda gateada
y la de staging son **una**. Un nombre de variable no es evidencia de a qué apunta.

| Base **física** | La resuelven | Estado | Verificación |
|---|---|---|---|
| **`yaqu_dev_javier`** (host `acela`) | `DATABASE_URL_DEV` | ✅ aplicado | **3/3** · `text` · `is_nullable=YES` · `column_default=null` |
| **`railway`** (host `acela`) | `DATABASE_URL_STAGING` **+** `DATABASE_URL_TESTS` | ✅ aplicado | **3/3** · `text` · `is_nullable=YES` · `column_default=null` |
| **producción** (host `autorack`) | — | ⛔ **PENDIENTE, la aplica el fundador** | — |

Producción **no se pudo tocar y no debía**: ninguna clave de un árbol de trabajo va allí, acreditado
ANTES con `scripts/comprobar-claves-bd.mjs` (`DATABASE_URL`: ausente). Turno de staging **tomado y
soltado** (`scripts/turno-staging.mjs`); libre al terminar.

### El estado ANTES, y por qué se midió en vez de creerlo

El encargo afirmaba que el `ALTER` ya estaba aplicado en las tres bases. **No lo estaba en ninguna
de las dos alcanzables**, y por eso la orden era comprobarlo. La medición leyó **58** columnas en
`quotes`+`albaranes` y **0/3** de las nuevas; después del `ALTER`, **61**.

**Con CONTROL POSITIVO en las dos bases y en las dos pasadas**, porque un cero de un instrumento
roto se lee igual que un cero verdadero: la misma consulta tenía que seguir viendo
`quotes.valid_until`, `quotes.internal_notes` y `albaranes.notas`. Las vio siempre.

Y un **suelo** que no es simétrico con los otros: se comprueba que `albaranes.doc_footer_text`
**NO existe**. Es la única forma de que «se reutiliza `notas`» sea una comprobación y no una
intención.

### 🔴 EL ORDEN, y por qué `prisma/schema.prisma` sigue sin tocarse

`schemaDrift.ts` compara **esperado ⊆ real** al arrancar: una columna de MÁS en la base es inocua,
una de MENOS **impide arrancar producción** (SCRUM-220). El esquema entra en el PR ③ **cuando las
tres bases la tengan**, junto con el cableado y los tests. **Sin partir.**

## SCRUM-580 (paso ②) · `Customer.tags` — 2-sep-2026

`customers.tags` (**JSONB, nullable, SIN default**). Las etiquetas del contacto (CONT-07).
SQL en **`docs/sql/scrum-580-tags-por-contacto.sql`**, verificación en
**`docs/sql/scrum-580-verificar.sql`**.

**El tipo NO se escribió a mano:** lo generó `preview-migracion.mjs --desde` (o sea
`prisma migrate diff`) con control positivo —27 tablas— y veredicto aditivo. Importa porque
`schemaDrift` comprueba que la columna **exista, no su tipo**: creado TEXT arrancaría en verde y
se pudriría al leer un array como cadena.

### 🔴 SE NOMBRA LA BASE FÍSICA, Y EL PROCEDIMIENTO FUE ANTES-Y-DESPUÉS

Esta casa ya tuvo dos veces el mismo defecto: una clave apuntando a otra base, y `_STAGING` y
`_TESTS` siendo la misma cadena (SCRUM-668). **Aplicar dos veces sobre la misma base se ve
EXACTAMENTE IGUAL que hacerlo bien**, así que se midió antes y después de cada una.

**Bases físicas distintas alcanzables desde un árbol de trabajo: DOS.**

| Base **física** | La resuelven | ANTES | DESPUÉS |
|---|---|---|---|
| **`yaqu_dev_javier`** (host `acela`) | `DATABASE_URL_DEV` | 2 filas · `tags` **ausente** | 3 filas · `tags` = **`jsonb`** |
| **`railway`** (host `acela`) | `DATABASE_URL_STAGING` **+** `DATABASE_URL_TESTS` | 2 filas · `tags` **ausente** | 3 filas · `tags` = **`jsonb`** |
| **producción** (host `autorack`) | — | ⛔ **PENDIENTE, la aplica el fundador** | — |

El «antes» de la segunda base salió con `tags` **ausente**, que es lo que descarta que las dos
cadenas apunten al mismo sitio — si hubiera salido con 3 filas, había que parar.

**Control positivo en las cuatro lecturas:** `customers.billing_city` (`text`) y
`quotes.clausulas_excluidas` (`jsonb`). Sin esas dos, la consulta no estaba mirando esa base y la
ausencia de `tags` no significaría «no está» sino «no se vio nada». La segunda es además el
control de **cómo se ve un JSONB bien creado** en esa misma base.

Destinos acreditados ANTES con `scripts/comprobar-claves-bd.mjs` (`DATABASE_URL`: **ausente**, que
es lo correcto en un árbol de trabajo). Turno de staging **tomado y soltado**; libre al terminar.

### El orden, y por qué `prisma/schema.prisma` sigue sin tocarse

`schemaDrift` compara **esperado ⊆ real** al arrancar: una columna de MÁS en la base es inocua,
una de MENOS **impide arrancar producción**. El esquema entra en el PR ③ **cuando las tres bases la
tengan**, junto con el cableado y los tests. Sin partir.
