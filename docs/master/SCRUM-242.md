# SCRUM-242 · Recuperabilidad: la foto completa

# 🔴 HOY NO PODRÍAMOS RECUPERAR LA BASE DE DATOS.

**Fecha:** 10-ago-2026 · **Carril:** infraestructura · **Entregable: MEDICIÓN, no código**
**Medido contra:** `origin/main` = `74a7592e2b4287106718b42eef61fdba49cff745` · 2026-08-10T09:30:00+02:00

No existe ninguna copia. No la genera nadie. Y si existiera, en el formato que produciría en
Railway **no hay camino implementado para restaurarla**. Esto no es un hallazgo técnico: es el
riesgo mayor del negocio, y la decisión de qué se contrata es del fundador (regla 36).

---

## ① QUÉ EXISTE

**Un solo mecanismo:** `scripts/backup-dump.mjs`. Y está bien hecho:

- dos formatos — `pg_dump --format=custom` si hay binario, y si no un **dump lógico** de las 24
  tablas a JSON vía Prisma;
- **cifrado AES-256-GCM** con `BACKUP_ENCRYPTION_KEY`;
- **fail-closed** (SCRUM-241): si una sola tabla no se vuelca, **lanza y no escribe fichero** — un
  backup parcial que se anuncia completo es peor que uno que falla a gritos;
- `--restore-test` que descifra, valida el tag GCM y **compara los conteos contra la BD viva**;
- su lista de tablas está **atada a un guard** (`scrum241-backup-tablas`) que la deriva del schema.

**El fichero sale a `BACKUP_DIR`, por defecto `./backups`** — dentro de la máquina.

## ② QUÉ SE EJECUTA DE VERDAD: **NADA**. Y está probado, no supuesto

Censo derivado sobre invocaciones reales, **con suelo**:

| Script | Invocado desde |
|---|---|
| `turno-staging` | **11** sitios |
| `test-staging-gated` | **7** |
| `seed-demo` | **5** |
| **`backup-dump`** | **0** |

**El suelo es la fila de arriba:** el mismo censo encuentra 11, 7 y 5 invocaciones cuando existen,
así que **el cero es un cero real y no una ceguera**. «No encontré quién lo llama» y «nadie lo
llama» dejan de ser lo mismo.

Comprobado uno por uno: **ningún cron** de `src/core/cron/cron.ts` (hay 6 registrados, ninguno de
backup) · **ningún script** de `package.json` (25, cero) · **ningún workflow** de CI (`ci.yml`,
`zona-roja.yml`) · **ninguna importación** desde `src/`. Todas las menciones que existen son
**documentación**: el máster, `SPRINT_DEMO_READY_EXT3.md` y las evidencias.

Y el propio máster lo declara pendiente: *«dump cifrado semanal fuera de Railway ANTES de 25
pagantes»*.

## ③ QUÉ HARÍA FALTA PARA RECUPERAR

| Pregunta | Respuesta medida |
|---|---|
| ¿Desde qué copia? | **Ninguna.** No hay nada que la genere. |
| ¿Con qué antigüedad? | **No aplica.** |
| ¿En cuánto tiempo? | **No aplica.** |
| ¿Quién sabe hacerlo? | **Nadie, y no está escrito.** |

Y hay algo peor que la ausencia de copia, porque sobreviviría a arreglarla:

> **NO HAY CAMINO DE RESTAURACIÓN IMPLEMENTADO.** El script tiene dos modos —volcar y
> `--restore-test`— y **ninguno escribe de vuelta en la base**. `--restore-test` *verifica*: descifra
> y compara conteos. No restaura.

Para el formato `pg_dump custom` existe salida: `pg_restore`, una herramienta externa. **Pero en
Railway la imagen de Node no trae `pg_dump`** —lo dice el propio script— así que **el formato que
se produciría allí es el LÓGICO (JSON)**, y para ése:

- el script promete «restaurable con este mismo script en un entorno limpio — **ver RUNBOOK al
  final**»;
- **ese RUNBOOK no existe.** Una sola mención en el fichero: la promesa. El fichero termina en
  `main().catch(...)`;
- `docs/RUNBOOKS.md` **tampoco** menciona restauración.

O sea: el formato que de verdad saldría en producción **no tiene procedimiento de restauración
escrito ni código que lo haga**.

## ④ ¿LA COPIA ESTÁ FUERA DE LA INFRAESTRUCTURA? **NO**

`BACKUP_DIR` es `./backups`, **dentro del contenedor**. La subida a un destino externo existe solo
como **comentario que describe lo que habría que añadir** (`BACKUP_S3_ENDPOINT/BUCKET/KEY/SECRET`),
y el script lo dice él mismo: *«hasta entonces el fichero queda en BACKUP_DIR y hay que moverlo a
mano fuera de la máquina»*, y al terminar imprime *«→ MUÉVELO fuera de esta máquina»*.

**Un backup que vive donde la base no protege del escenario que más importa** — y aquí ni siquiera
llega a existir.

## Lo que NO he medido, declarado

- **La política de backups de Railway.** El máster la lleva marcada **`[VALIDAR]`** desde hace
  meses y **no se puede medir desde el repositorio**: hay que mirarla en el panel del proveedor. Es
  la única vía por la que hoy podría existir alguna recuperabilidad, y **nadie ha confirmado que
  exista**. Mientras no se compruebe, la respuesta honesta a «¿tenemos backup?» es **no lo sabemos**,
  que a efectos de riesgo se gestiona como un no.
- **No he ejecutado nada.** Ni un dump, ni un `--restore-test`: exigen una base real.
- Si Railway tuviera copias, quedarían igualmente **dentro del mismo proveedor**: no cubren el
  escenario de perder la cuenta.

## Lo que decide el fundador (regla 36 — aquí no se construye nada)

1. **Validar la política de Railway.** Es lo más barato y lo primero: puede cambiar el diagnóstico.
2. **Qué dispara el backup** — cron del propio servicio, tarea programada del proveedor o CI.
3. **Dónde vive la copia**, fuera de Railway, y con qué **retención**.
4. **Escribir el RUNBOOK de restauración y probarlo**, porque una copia que nadie ha restaurado
   nunca es una copia que no sabemos si sirve — y el propio script ya lo dice: *«un backup no
   probado no es un backup»*.

> Ese cuarto punto es el que cierra el círculo con lo que salió de SCRUM-408: **un backup que nadie
> ejecuta es un backup que no existe**, y uno que nadie ha restaurado es una copia de la que no
> sabemos nada.

Ficheros: ninguno. Este ticket **mide**; no construye.

---

# SCRUM-242 · segunda entrega: EL RUNBOOK, ESCRITO Y **PROBADO**

**10-ago-2026, 12:55 CEST (UTC+0200)** · commit `8034f5a1fc0e68f9a35aeb0c4dc918b978d646a9`

El punto 4 de la lista de arriba —*«escribir el RUNBOOK de restauración y probarlo»*— está hecho.
Procedimiento: **`docs/RUNBOOKS.md` §R14**. Evidencia: **`docs/evidencias/scrum242-restauracion.md`**.

Se ejecutó contra la base desechable `postgres-scratch`, que no tiene ni tendrá jamás un dato real.
**Nada contra producción ni staging, ni en lectura.**

## El hallazgo: el backup lógico NO ERA RESTAURABLE

Los dos fallos siguientes llevaban ahí desde que existe el script y **solo podían salir
ejecutándolo**. Es exactamente el motivo de haber probado el runbook en vez de darlo por escrito:

1. **Los tipos.** El volcado va a JSON, y JSON no tiene fechas ni decimales. El primer INSERT murió
   con *«column "created_at" is of type timestamp without time zone but expression is of type
   text»*. Corregido con casts **derivados del DMMF**, no escritos a mano: un campo nuevo trae el
   suyo solo.
2. **El orden de inserción.** El borrador de R14 decía «`ORDEN_BORRADO_MERCHANT` invertido», y al
   ejecutarlo saltó *«insert or update on table "customers" violates foreign key constraint
   "customers_merchant_id_fkey"»*. Esa lista enumera los **hijos** de un merchant: `merchants` no
   está en ella y caía al final. Corregido con **orden topológico derivado del schema**.

   Merece quedarse escrito porque el error de método es reutilizable: reutilizar una lista existente
   parecía lo contrario de duplicar, pero **esa lista respondía a otra pregunta**.

## ③ Qué se compara — la pregunta que decide si esto vale algo

Conteos por tabla es el **mínimo** y no basta: una restauración con el número correcto de filas y el
contenido mal es el peor verde del proyecto. Comprobado, en orden de lo que duele:

1. **Conteos** por tabla.
2. **Claves**: los ids restaurados son los mismos, no unos nuevos equivalentes.
3. **Sumas de importes**: el dinero cuadra al céntimo (`600.00`).
4. **La cadena de huellas VeriFactu**: el `vfPrevHash` de cada factura == el `vfHash` de la
   anterior. Una cadena rota **no aparece en ningún conteo** y no se recompone después.
5. **Que la base pueda seguir emitiendo**: un INSERT sin id explícito que no choque.
6. **Que el comparador sepa ver una diferencia.** Se mutó un importe del censo restaurado y la
   comparación lo detectó. Sin esto, «los dos censos coinciden» y «el comparador no compara nada»
   son el mismo verde.

Los censos ANTES y DESPUÉS salieron **idénticos byte a byte**.

## El paso 4 está medido, no razonado

Dejando la secuencia de `invoices` en 1 —como la deja una restauración que se salte el `setval`— el
siguiente INSERT devolvió *«Unique constraint failed on the fields: (`id`)»*. El paso de reponer
secuencias **no es cosmético**: sin él la base queda rota en diferido y quien la rompe es el primer
usuario que emite. En facturas, un id repetido no se arregla borrando (**regla 29**).

## ② Qué hizo falta para probarlo

- Una base **desechable** (`SCRATCH_DATABASE_URL`), separada de prod y staging.
- `scripts/_scratch-run.mjs`: lee la URL del `.env`, **comprueba que el host no es `PROD_HOST` ni
  `STAGING_HOST` y para si lo es**, y la pasa **solo por el entorno del hijo, nunca por argv**. Es la
  lección de SCRUM-196/408: una credencial se protege impidiendo que el error salga, no redactando
  mensajes.
- El schema aplicado en el destino con `db push` (preview aditivo: 24 `CREATE TABLE`, cero `DROP`),
  porque el volcado lógico lleva **filas, no estructura**.
- Un juego de datos con lo que un conteo no puede comprobar: tres facturas **encadenadas**.

## Lo que sigue pendiente, declarado

- **El volumen.** Fueron 5 filas en 24 tablas. Un volcado lógico de producción carga fila a fila y no
  se ha medido si aguanta. Sigue siendo el argumento a favor del formato `pg_dump`.
- **Que exista un backup que restaurar.** Lo medido en la primera entrega no ha cambiado:
  `backup-dump.mjs` **no lo dispara nadie** (0 invocaciones frente a 11/7/5 de otros scripts). Un
  procedimiento probado sobre un fichero que nadie genera sigue sin salvar la base. **Es lo que hay
  que decidir ahora** (puntos 2 y 3 de la lista de la primera entrega).
- **La política de Railway**, que sigue `[VALIDAR]`: no es medible desde el repo.

## Sobre el fichero que rompió SCRUM-273

El procedimiento se había escrito en `docs/master/SCRUM-242-RUNBOOK.md`, y el guard tenía razón:
las entradas son `SCRUM-<n>.md` y punto. Pero mover el fichero habría sido obedecer al guard sin
entender el error — **un runbook no es una entrada de máster**: se busca con la base caída, y ahí
nadie abre `docs/master/`. Su sitio es `docs/RUNBOOKS.md`, junto a los otros trece.

Ficheros: `scripts/backup-restore.mjs` (nuevo) · `scripts/_scratch-run.mjs` (nuevo) ·
`docs/RUNBOOKS.md` §R14 · `docs/evidencias/scrum242-restauracion.md` (nuevo) ·
`scripts/backup-dump.mjs` · `tests/scrum242-runbook-no-se-declara-probado.test.mjs`.
