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

## CORRECCIÓN a la primera entrega: la política de Railway YA ESTÁ MEDIDA

La primera entrega la dejó como `[VALIDAR]` y dijo que no era medible desde el repo. **Otra sesión la
midió** y consta en `src/modules/system/domain/avisoPuerta.service.ts` (SCRUM-390, décima cláusula de
la puerta): el panel de Railway dice, literal, **«No Backups — this service's volume does not have
any backups»**, y PITR solo existe en el plan Pro.

Es decir, **cero copias del proveedor**. Aquella era la única vía por la que podía existir alguna
recuperabilidad hoy, y no existe. La respuesta a «¿tenemos backup?» ya no es *no lo sabemos*: es
**no**.

Con esta entrega la mitad que falta cambia de sitio: **el camino de vuelta ya está probado; lo que no
hay es el fichero del que volver.**

> **Nota para el fundador, no la arreglo yo (regla 9):** el comentario de esa cláusula dice también
> «ningún camino de restauración», y eso **ha dejado de ser cierto** con este commit — hoy existen
> §R14 y `scripts/backup-restore.mjs`. La cláusula en sí sigue abierta con razón, porque su otra
> mitad («hay copia de seguridad») sigue siendo NINGUNA. Es un comentario del carril de SCRUM-390.

## Sobre el fichero que rompió SCRUM-273

El procedimiento se había escrito en `docs/master/SCRUM-242-RUNBOOK.md`, y el guard tenía razón:
las entradas son `SCRUM-<n>.md` y punto. Pero mover el fichero habría sido obedecer al guard sin
entender el error — **un runbook no es una entrada de máster**: se busca con la base caída, y ahí
nadie abre `docs/master/`. Su sitio es `docs/RUNBOOKS.md`, junto a los otros trece.

Ficheros: `scripts/backup-restore.mjs` (nuevo) · `scripts/_scratch-run.mjs` (nuevo) ·
`docs/RUNBOOKS.md` §R14 · `docs/evidencias/scrum242-restauracion.md` (nuevo) ·
`scripts/backup-dump.mjs` · `tests/scrum242-runbook-no-se-declara-probado.test.mjs`.

---

# SCRUM-242 · tercera entrega: ③ QUÉ DISPARA EL VOLCADO — **medición y propuesta**

**10-ago-2026, 14:10 CEST (UTC+0200)** · mediciones sobre la base desechable y sobre el repo.
**Aquí no se construye nada:** el gasto y el mecanismo los decide el fundador (regla 36).

## 0 · El hallazgo que cambia el orden de todo: **el volcado se rompe a las 8 fotos**

Antes de hablar de cada cuánto volcar, hay que decir hasta dónde llega el volcado. `logicalDump`
acumula todas las tablas en un objeto y termina en **un único `JSON.stringify`**, así que el límite
no es el disco: es `MAX_STRING_LENGTH` de V8, medido en esta máquina en **536.870.888** caracteres.

Y `attachments.data` es `bytea`. Medido con bytes reales:

| foto | JSON que genera | factor |
|---|---|---|
| 0,5 MB | 6.479.355 | **12,36×** |
| 1 MB | 13.118.395 | **12,51×** |
| 5 MB | 70.036.411 | **13,36×** |

Un byte de fichero ocupa ~12,5 caracteres porque se serializa como `{"0":137,"1":80,…}`.

> **Tope: ~41 MB de fotos almacenadas.** Con `FOTO_MAX_BYTES = 5 MB`
> (`albaranes.routes.ts:382`), son **8 fotos**. A 2 MB por foto de móvil, **20**.

Pasado ese punto el volcado **no se degrada: lanza**. Y con el fail-closed de SCRUM-241 **no escribe
fichero**. O sea: el día que se sube la foto nº 9, deja de haber backup — y si el disparador solo
escribe en un log, nadie se entera. Es la lección de SCRUM-390 otra vez.

**Para las filas normales el margen es enorme**, así que el problema es SOLO el binario: 831 bytes de
JSON por factura (medido sobre 3.004 facturas con 3 líneas) → ~645.000 facturas hasta el mismo techo,
y ~660.000 por memoria con un heap de 4,3 GB. Nunca llegaremos ahí; a 8 fotos, sí.

**Propuesta (no construida): serializar `Bytes` en base64.** El factor pasa de 12,5× a 1,37×, y el
tope de 41 MB a **~390 MB de fotos**: nueve veces más por unas líneas. Exige subir el formato a
`yaqu-logical-v2` y que la restauración entienda los dos. **Y es lo primero que hay que hacer, antes
que automatizar nada**: automatizar un volcado que se rompe a las 8 fotos es fabricar la carpeta de
ficheros inútiles que este ticket vino a evitar.

## 1 · Qué mecanismos de disparo EXISTEN ya (censo, no invención)

- **Seis crons en proceso**, `src/core/cron/cron.ts`: cotizaciones (cada hora), facturas impagadas
  (10:00), mantenimientos + puerta SCRUM-390 (10:00), digest semanal (lunes 9:00), lifecycle (8:00),
  **sellos de albarán (3:15)**. `node-cron`, dentro del servicio, con `DISABLE_CRONS` para desarrollo.
- **Dos workflows de GitHub Actions**: `ci.yml` y `zona-roja.yml`. **Ninguno tiene `schedule:`** —
  comprobado: no hay ni un `schedule:` en todo `.github/`. Los dos disparan por `pull_request`/`push`.
- **Nada más.** No hay tarea programada del proveedor, ni cola, ni worker aparte.

### Cuál encaja, y por qué: **un séptimo cron a las 3:30**

El sexto cron ya trae el argumento escrito: va a las 3:15 *«porque no manda nada a nadie —solo LEE y
escribe una línea de log—, así que no toca horas tranquilas ni compite con los cinco de arriba»*. El
backup es exactamente ese perfil. **Precedente y razonamiento ya aceptados en el mismo fichero.**

**Y GitHub Actions queda descartado por una decisión ya escrita**, no por opinión: `ci.yml` dice
*«Regla 9 — los secretos los pega el fundador en Railway, no viajan a terceros»*, y por eso el CI no
lleva ni `DATABASE_URL_TESTS`. Un workflow programado necesitaría **la `DATABASE_URL` de producción
como secreto de GitHub**: un sitio nuevo donde vive la credencial de prod, que es justo lo que
costó una rotación en SCRUM-196.

**Lo que hay que aceptar del cron, dicho antes de elegirlo:** si el servicio está caído, no hay
backup ese día; y si algún día se escala a más de una instancia, se ejecutaría en todas.

**Y el fallo no puede ser mudo.** `avisoPuerta.service.ts` ya manda WhatsApp al fundador desde el
cron de las 10:00: el camino existe y es el mismo que hay que usar aquí. Un backup que falla en
silencio es peor que no tenerlo, porque además tranquiliza.

## 2 · Cada cuánto, con el argumento delante: **qué se pierde entre dos copias**

Lo que se pierde **no se puede rehacer**, y ésa es toda la discusión:

- **Facturas emitidas** — la regla 29 prohíbe reemitirlas, y la **cadena de huellas** (`vfPrevHash`→
  `vfHash`) se rompe: no se recompone ni a mano. Además hay **obligación legal de conservarlas**.
- **Albaranes firmados** — la firma es del cliente, en su móvil, ese día. No se vuelve a pedir.
- **Fotos del trabajo** — se tomaron en la obra, y la obra terminó.
- Cotizaciones, mensajes y auditoría: rehacibles con esfuerzo, pero la trazabilidad no.

**Propuesta: DIARIO a las 3:30, con RPO declarado de 24 h.** No es una elección técnica sino una
frase que hay que poder decir en voz alta: *«si la base se pierde, perdemos como mucho un día de
trabajo»*. Hoy eso no cuesta nada porque los datos de producción son desechables (la puerta de
SCRUM-390 sigue cerrada); **el día que entre el primer cliente real, 24 h de facturas emitidas
perdidas es un incidente fiscal**, y ahí habría que bajar a cada 6 h o pasar a `pg_dump` + WAL.

No propongo horario porque el volcado es **completo** (no incremental): a cada hora serían 24 copias
completas al día de una base que hoy cabe en 2,5 MB — barato en euros, caro en ruido.

## 3 · Dónde vive la copia, FUERA de Railway (opciones y coste — decide el fundador)

Hoy el fichero se escribe en `./backups/` **de la propia máquina**, y el script lo dice: *«MUÉVELO
fuera de esta máquina»*. En Railway ese disco es efímero: **al siguiente deploy el backup ya no
está**. No hay medio backup; no hay ninguno.

| Opción | Gratis | Coste después | Nota |
|---|---|---|---|
| **Cloudflare R2** | 10 GB | ~0,014 €/GB/mes, **egreso 0 €** | **Recomendada.** Ya está nombrada en el schema como destino previsto de media (*«fallback persistente sin R2»*): la cuenta haría falta igual |
| Backblaze B2 | 10 GB | ~5,50 €/TB/mes | Barata; egreso gratis hasta 3× lo almacenado |
| AWS S3 | no | ~0,021 €/GB/mes **+ egreso** | El egreso se paga justo el día del desastre |
| Otro servicio de Railway | — | — | **No vale**: mismo proveedor, no cubre perder la cuenta |

**Coste real hoy: 0 €.** La base entera son ~2,5 MB de JSON; con 30 copias diarias retenidas no se
roza el nivel gratuito de ninguna de las tres. La decisión es de **cuenta y credencial**, no de gasto:
haría falta un token en Railway, que pega el fundador (regla 9).

**Retención sugerida:** 7 diarias + 4 semanales. Y **la clave de cifrado guardada FUERA de Railway**,
porque sin `BACKUP_ENCRYPTION_KEY` el fichero no sirve para nada — perder la cuenta y perder la clave
son el mismo desastre.

## 4 · El orden que propongo

1. **base64 para `Bytes`** (`yaqu-logical-v2`). Sin esto, lo demás automatiza algo que se rompe a las 8 fotos.
2. **Destino R2** + token en Railway + clave de cifrado fuera.
3. **Séptimo cron a las 3:30**, con aviso por WhatsApp si falla.
4. Retención y purga.

Y una advertencia que sale de este mismo ticket: **cada paso se prueba restaurando**, no leyendo el
código. Los tres fallos que han aparecido —tipos, orden y `bytea`— eran invisibles hasta ejecutarlos.

---

# SCRUM-242 · cuarta entrega: ① EL BASE64 — el techo pasa de **8 fotos a 76**

**10-ago-2026, 13:56 CEST (UTC+0200)** · commit `d03a198172a883701ab8698569a9fc131130e908`

Primer punto del orden aprobado (① base64 → ② R2 → ③ cron → ④ retención). **Solo el ①**: R2 necesita
cuenta y credencial del fundador, y el cron va después.

## El número, medido en las dos formas

`attachments.data` es `bytea` y el volcado entero acaba en **un único `JSON.stringify`**, así que el
techo del backup es `MAX_STRING_LENGTH` de V8 — **536.870.888** caracteres en Node 24.

| formato | caracteres por byte de fichero | techo | a 5 MB/foto | a 2 MB/foto |
|---|---|---|---|---|
| `yaqu-logical-v1` (objeto de índices) | 12,4–13,4× **y crecía con el tamaño** | ~41 MB | **8** | 20 |
| **`yaqu-logical-v2` (base64)** | **1,333×, constante** | **~384 MB** | **76** | **191** |

El factor de v1 crecía porque las claves (`"0"`, `"1"`, … `"4194303"`) se alargan: cuanto más grande
la foto, peor el factor. El de base64 no depende del tamaño.

**Sobre el fichero real, con los mismos datos:** el backup cifrado pasó de **18.415 a 2.275 bytes**.

## Probado, no razonado

Ciclo completo contra la base desechable **con adjuntos** —lo que faltó la primera vez—: volcar →
vaciar → restaurar → comparar. **`sha256` del fichero idéntico** entre lo que contiene el backup y lo
que queda en la base (`4bece259…`, 4.104 bytes), cadena `vf_prev_hash`→`vf_hash` intacta, y **suelo
del comparador** comprobado mutando el `sha256`. Evidencia:
`docs/evidencias/scrum242-restauracion.md`.

## Por qué el códec vive en un módulo aparte

`scripts/_backup-codec.mjs`, **compartido por volcado y restauración**. Dos motivos y el segundo pesa
igual:

1. Dos mitades que se leen la una a la otra no pueden vivir en dos ficheros que nadie obliga a
   cuadrar. **El día que se desincronizaran sería el día de la restauración.** Con un solo códec no
   es disciplina: es que no hay dos sitios.
2. **Para poder probarlo.** `backup-dump.mjs` y `backup-restore.mjs` ejecutan al importarlos (leen
   `process.env`, llaman a `process.exit`), así que ningún test podía tocarlos. El códec es puro.

`v1` se sigue restaurando. No consta que exista ningún fichero v1 —el volcado no lo dispara nadie: 0
invocaciones medidas—, pero **«no consta» no es «no hay»**, y un backup que el propio proyecto dejó
de entender es la definición de copia inútil. Cuesta una rama del decodificador.

## El tope no ha desaparecido: se ha movido, y ahora alguien lo vigila

`tests/scrum242-backup-codec.test.mjs` comprueba la ida y vuelta exacta por JSON (vacío, los 256
valores, UTF-8 inválido, cabecera PNG) **y el factor de expansión con número**. Si alguien vuelve al
objeto de índices, el guard sale rojo diciendo el techo en MB — probado: reportó `12.36 caracteres`.
Tres rojos por `$?`.

**Y hay que decirlo claro: 76 fotos siguen siendo pocas** para un año de trabajo. Cuando se acerque,
las salidas son `pg_dump` (formato físico, sin este límite) o sacar los ficheros de Postgres a R2 —
que es lo que el propio schema ya contempla («fallback persistente sin R2»). Está escrito en R14 §6.

Ficheros: `scripts/_backup-codec.mjs` (nuevo) · `scripts/backup-dump.mjs` ·
`scripts/backup-restore.mjs` · `tests/scrum242-backup-codec.test.mjs` (nuevo) ·
`tests/scrum242-restauracion-cubre-todos-los-tipos.test.mjs` · `docs/RUNBOOKS.md` §R14.6 ·
`docs/evidencias/scrum242-restauracion.md`.

---

# SCRUM-242 (parte 5) · El backup lo hace el código, y trae su restauración dentro

**POBLACIÓN MEDIDA** · host `DESKTOP-T5MONF5` · `2026-08-12T10:03:30Z`

**Medido contra:** `origin/main` = `423a9c9c0a6b6e13847ff669d2e24d6360960ddf` · 2026-08-12T10:03:30Z

> Cambia de categoría: la copia automática de Railway exige plan Pro, así que la hace el código.
> Y al hacerla nosotros, lo que de verdad importa deja de ser opcional.

## 1 · 🔴 El corazón: tres veredictos, no dos

**Un backup que no se ha restaurado nunca no es un backup, es un fichero.** Un volcado que EXISTE no
prueba nada: puede estar truncado, ser de otra base, o venir de un `pg_dump` incompatible con el
servidor y traer la mitad de las tablas. **Las tres cosas producen un fichero con bytes dentro y
fecha de hoy.**

| Veredicto | Cuándo | Salida |
| --- | --- | --- |
| **VERIFICADO** | se restauró en una base vacía **y el recuento de tablas cuadra** | `exit 0` |
| **NO_VERIFICADO** | el volcado se puede leer, pero **nadie lo ha restaurado** | **`exit 1`** |
| **CIEGO** | no se pudo ni comprobar (sin binario, sin base de pruebas, inventario ilegible…) | **`exit 1`** |

El del medio es el que impide la mentira. Y los dos malos **salen con error a propósito**: un script
que avisa y devuelve 0 se mete en un cron que lo da por bueno.

## 2 · Qué comprueba, y por qué no vale `existsSync`

1. **El volcado** — `pg_dump -Fc -Z 9`. Formato `custom`: ya viene comprimido **y tiene inventario**.
2. **¿Se puede LEER?** — `pg_restore --list`, que abre el fichero, lo descomprime y recorre su tabla
   de contenidos. Un volcado truncado falla **aquí**, no el día que haga falta.
3. **¿Cuadra?** — tablas del inventario vs tablas de la base de origen. Si el volcado declara 3 y la
   base tiene 24, eso es un `pg_dump` que murió a medias y dejó bytes.
4. **La restauración** — `pg_restore --clean` en `BACKUP_VERIFICACION_URL` y recuento otra vez.

⚠️ **La base de verificación no puede ser la de origen**, y el script se niega: restaura con
`--clean`, así que apuntar al origen **borraría la base que se acaba de copiar**.

## 3 · 🛑 El destino externo NO lo elige el código

`BACKUP_DESTINO_TIPO` y `BACKUP_DESTINO_RUTA`. Sin ellas el volcado **queda en disco y no se sube a
ninguna parte**, y el script lo dice —una copia en la misma máquina no es una copia—.

**Contratar almacenamiento es coste recurrente (regla 36) y lo decide el fundador.** Hay guard: el
fuente no puede nombrar ningún proveedor, y sin variables no puede haber destino por defecto.

## 4 · 🔴 Ninguna cadena de conexión, ni de ejemplo

Todo lo que toca una URL pasa por `_db-guard.mjs`: `describirBD()` para el log (`host/base` y nada
más), `partirBDParaHijo()` para el hijo (URL sin contraseña en argv, contraseña en su entorno) y
`redactarSecretos()` **sobre el objeto** antes de imprimir cualquier error ajeno — porque la URL
viaja en `e.input` y en `e.spawnargs`, no solo en `.message`.

Y hay dos guards para que siga así:

* **ni una URL de Postgres en el fuente, comentarios incluidos.** La de ejemplo es la que alguien
  copia y rellena con datos reales.
* **por AST: ningún `console` recibe la URL ni la contraseña.** `describirBD(url)` sí; `${url}` no.

## 5 · Variables, para cuando se decida el destino

| Variable | Qué es |
| --- | --- |
| `DATABASE_URL` / `BACKUP_BD_URL` | qué base se copia |
| `BACKUP_PG_BIN` | carpeta con `pg_dump`/`pg_restore`/`psql`. Sin ella no hay backup |
| `BACKUP_VERIFICACION_URL` | 🔴 base **vacía y desechable** donde restaurar. Sin ella el resultado es NO_VERIFICADO |
| `BACKUP_DESTINO_TIPO` / `_RUTA` | 🛑 decisión del fundador |
| `BACKUP_DIR` | dónde deja el fichero (por defecto `.backups/`) |

## 6 · 🔴 EL HUECO, DECLARADO: no he demostrado el camino bueno

Lo que **sí** está demostrado: los 8 tests del núcleo en verde, y el script **sale con error** sin
URL de base (ejecutado: `exit 1`, sin imprimir nada sensible).

Lo que **NO**: la ejecución completa —volcar, restaurar, cuadrar— **no se ha hecho en esta máquina**,
y digo exactamente por qué:

* `pg_dump`/`pg_restore`/`psql` existen (portable 16.4), pero **no hay servidor Postgres local**: esa
  instalación está incompleta —solo `bin/` y `lib/`, sin `share/`— así que `initdb` no arranca y no
  hay dónde restaurar. Medido en SCRUM-480.
* Y las bases que existen son **staging y producción**. Volcar producción se lleva la base de
  clientes entera a disco, y restaurar es destructivo por definición: **eso no se hace sin GO**.

**Así que el ticket entrega el mecanismo, no la prueba de fuego.** Para cerrarlo del todo hace falta
una decisión tuya: una base desechable donde restaurar (Railway permite crear una), y el GO para
volcar staging. Con eso, el script se demuestra a sí mismo en una ejecución.

> Es la misma honestidad que el propio script exige: sin restauración, NO_VERIFICADO. No voy a
> reclamar de mi entrega lo que su guard le prohíbe reclamar a un volcado.

## 7 · Un fallo que cazó el control positivo del propio lector

El lector del inventario contaba **4 tablas donde hay 3**: su patrón casaba también las líneas
`TABLE DATA` —que son contenido, no definición— y capturaba `DATA` como si fuera el esquema. Un
recuento inflado **puede cuadrar con el origen por casualidad**, que es la peor forma de estar mal.
Lo cazó el assert que comprueba que el lector NO cuenta `TABLE DATA`, no una relectura.

## 8 · Lo que NO se ha hecho

Ninguna base tocada · ningún fichero subido a ninguna parte · ningún proveedor elegido · ninguna
credencial leída ni impresa · `.backups/` no se comitea.
