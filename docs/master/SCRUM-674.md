# SCRUM-674 · Los cinco cambios de schema aprobados, y la microcopy del dictado

**Medido contra:** `origin/main` = `4b3865f8201fe24fe367f45c4f6fba34933a1de0` · 2026-09-02T16:25:07+02:00
**Rama:** `scrum-674-schema-cinco`

**Remedido tras mergear `main`** (`7bdb3a90`, sin conflicto y sin tocar ninguno de mis
ficheros): 4495 tests, **los mismos 7 rojos**. Los 23 tests que trae `main` entran en verde.

| Commit | Qué |
|---|---|
| `a88286baef37772a1031f0dbf61c6a2b8c7c6730` | TAREA 1 · los cuatro cambios de schema que faltaban |
| `f1a7998832af454c0017ffd1f5ee46d6e97f9d57` | TAREA 2 · el aviso de dictado, aprobado y aplicado |
| `3b70b7b3731fd8b89392a3aece19f01207b1e80d` | los dos cableados de `partes_trabajo` que no son territorio del fundador |

---

## 🔴 Lo primero: la premisa era falsa en dos de los cinco

El encargo decía que las cinco tareas habían dejado su bloque de schema en un `.md`
**sin tocar el schema**. Medido, no supuesto: **dos ya estaban aplicados.**

* **SCRUM-650 · `model JobAssignee` YA ESTÁ** en `prisma/schema.prisma`, con sus dos
  relaciones inversas cableadas (`Job.assignees`, `TeamMember.jobAssignments`). Otra sesión
  se adelantó. **No se toca nada.**
* **SCRUM-651 · `AuditAction.trabajo_creado` NO ES SCHEMA.** `AuditLog.action` es un
  `String` en la tabla; `AuditAction` es una **unión de TypeScript** en
  `src/modules/system/audit.service.ts:58` — y `'trabajo_creado'` ya está ahí, en uso desde
  `src/modules/jobs/app/routes/jobs.routes.ts:577`. No había enum que ampliar.

Si esto se hubiera escrito «según el `.md`» sin mirar el árbol, el commit habría intentado
duplicar un modelo que ya existe.

## La discrepancia de `onDelete`, y por qué no hizo falta usarla

El encargo ordenaba: `JobAssignee` lleva `onDelete: Cascade` en **ambas** relaciones, y si
el `.md` decía otra cosa, ganaba la orden. **El `.md` decía otra cosa**: su bloque solo pone
`Cascade` en la relación `job`, y deja `teamMember` sin nada (o sea, RESTRICT).

Pero **el schema real ya está bien**: lleva `Cascade` en las dos, con el motivo de SCRUM-244
escrito al lado. O sea que el `.md` de SCRUM-650 **quedó desactualizado respecto al código**
y hoy documenta una versión peor de la que está en producción. Se reporta; no se arregla aquí
porque el `.md` es registro de otra tanda.

## Lo que se escribió (commit `a88286ba`)

| Ticket | Cambio | Forma |
|---|---|---|
| SCRUM-651 | `Job.tipoIntervencion` | `String?`, sin `@default` |
| SCRUM-652 | `model ParteTrabajo` → tabla `partes_trabajo` | tabla nueva |
| SCRUM-655 | `Quote.revision` | `Int @default(0)` |
| SCRUM-656 | `Quote.ivaModo` | `String?` |
| SCRUM-656 | `Quote.clausulasExcluidas` | `Json?` |
| SCRUM-656 | `Merchant.clausulasPresupuesto` | `Json?` |

**Ningún campo nuevo queda NOT NULL sin default sobre una tabla con filas:** `revision`
lleva `@default(0)`, los otros cuatro son nullables, y `partes_trabajo` nace vacía. **No se
renombró ni se borró nada:** `git diff -w` del commit da **68 inserciones y CERO borrados**.

`prisma format` realineó 16 líneas de modelos ajenos (deriva de espacios que ya estaba). Ese
`git diff -w` es justamente la prueba de que ninguna cambió de significado.

## Verificación, SIN tocar ninguna base

`prisma validate` → **válido**, exit 0. `prisma format` → exit 0. **No se ejecutó `db push`,
ni `migrate`, ni `deploy`.** Con el CLI **del repo (6.18.0)**, nunca `npx`: `npx` se baja
`prisma@latest` cuando falta el local y responde otro binario (SCRUM-385).

---

## 🔴 EL HALLAZGO: la tabla de SCRUM-652 no puede entrar sola

**La suite en la base está VERDE ENTERA: 4472 tests, 0 fallos.** Con el schema escrito se
ponen **7 en rojo** (6 guards, uno de ellos con dos casos), todos por lo mismo: `partes_trabajo` es una tabla **multi-tenant nueva**,
y hay listas derivadas del schema que no la conocen. La población de modelos con `merchantId`
pasa de **22 a 23**.

Dos se cierran aquí porque no son territorio del fundador (commit `3b70b7b3`):

* **SCRUM-241** · `partes_trabajo` entra en `TABLES` de `scripts/backup-dump.mjs`.
* **SCRUM-172** · `parteTrabajo` entra en `MODELOS_POR_MERCHANT` (`tests/_merchant-fixture.mjs`).
  Es **columna suelta** —`merchant_id`, `job_id` y `customer_id` sin ninguna FK—, del grupo
  **MUDO**: `merchant.delete` «tiene éxito» dejando los partes huérfanos.

**Los otros cuatro NO se tocan: son condición de parada de CLAUDE.md («datos de clientes,
export/borrado»).** Necesitan GO del fundador:

| Guard | Qué pide | Por qué es parada |
|---|---|---|
| **SCRUM-192** | `parteTrabajo` en el ORDEN de borrado de merchant | es el camino de supresión RGPD |
| **SCRUM-314** (×2) | `parteTrabajo` en el barrido demo | borra datos |
| **SCRUM-498** (×2) | doce frases del árbol dicen «22» y ya son 23 | una de ellas está en `portabilidadCompleta.ts`, el camino de EXPORT |
| **SCRUM-461** | regenerar `docs/sql/deriva-prod.sql` | es el DDL que se aplica a producción |
| **SCRUM-222** | lo mismo por otra vía: el SQL del censo de producción queda desfasado | ídem |

Las doce frases viejas, nombradas por el guard: `src/app.ts:673` ·
`src/modules/exports/domain/portabilidadCompleta.ts:29` ·
`src/modules/system/domain/barridoDemo.ts:6` y `:70` · `tests/_censo-merchant-de-la-url.mjs:8` ·
`tests/scrum244-cobertura-portabilidad.test.mjs:91` ·
`tests/scrum272-criterio-referencial.test.mjs:7` y `:95` ·
`tests/scrum314-wipedemo-derivado.test.mjs:6`, `:119` y `:128` ·
`tests/scrum440-tenencia-supresion.test.mjs:18`.

**Esto no es un defecto de los guards: es lo que existen para decir.** El bloque aprobado en
`docs/master/SCRUM-652.md` describe la tabla, y no menciona ninguna de estas seis ataduras.

---

## TAREA 2 · el aviso del dictado (commit `f1a79988`)

`voiceInput.js:51` queda literal, sin corchete:
`El dictado necesita conexión — escribe el trabajo y listo`. Anotado **en el mismo acto** en
`docs/MICROCOPY_APROBADA_SIN_APLICAR.md` como **APLICADA**, con fecha y con su ancla propia.

`voiceInput.js` **sale del censo** de `tests/scrum402-marcador-no-se-pinta.test.mjs`: la
entrada se **borra**, no se pone a 0 (precedente SCRUM-424/405). Lo tenía dicho el propio
censo: «Sale del censo el commit que apruebe el texto».

**El test del marcador no se borró, se actualizó al hecho.** Vigilaba que el aviso saliera
marcado *porque el texto no estaba firmado*; al firmarse, borrarlo habría roto la única
atadura entre lo que se pinta y lo que se aprobó. Ahora vigila dos cosas más fuertes: que el
aviso sea **literalmente** el texto aprobado, y que ese texto **conste** en el `.md`.

**Probados en rojo antes de darlos por buenos.** (1) Raya larga cambiada por coma → rojo, y
el mensaje nombra los dos textos. (2) Línea retirada del `.md` con el código intacto → rojo,
que es exactamente el fallo contra el que avisó el fundador. Revertidos, verde: 9/9 y 7/7.

**Medido de paso:** quedan **44 marcas vivas** en `public/` + `src/` con este árbol. El «13»
de la cabecera del `.md` no se toca: está anclado a `a241b6e4`, es otra foto y sigue siendo
cierta para su base.

---

# Segunda vuelta · GO del fundador a los cuatro guards parados

**Medido contra:** `origin/main` = `7bdb3a90` (ya mergeado en la rama) · 2026-09-02T17:10:00+02:00
**Commit previo a inyectar rojos:** `55406151bb0672ca73e2aba4bff4e85910de7437`

**Suite VERDE ENTERA: 4495 tests · 4416 pass · 0 fail · 79 skipped · `exit 0`.**

**Remedido tras mergear `main` otra vez** (`9ef78fc6`, sin conflicto y sin tocar ninguno de mis
ficheros): **4500 · 4421 · 0 fail · 79 skipped · `exit 0`**. Los 5 tests que trae `main` entran
en verde.

## SCRUM-192 + SCRUM-314 (×2): un solo cambio cierra los tres

`barridoDemo` **reusa `ORDEN_BORRADO_MERCHANT`** — es su decisión de diseño declarada, no una
coincidencia. Así que basta meter `parteTrabajo` en el orden.

**El sitio se midió, no se eligió por parecido:** `ParteTrabajo` declara **cero `@relation`**, y
sus `job_id`/`customer_id` son columnas sueltas que apuntan a `jobs` y `customers` **sin FK**. Es
el caso exacto de `emailMessage`, así que va en su bloque y **antes** de `job`/`invoice`/`quote`/
`customer`: si cayera después quedarían partes apuntando a ids que ya no existen y ninguna FK
protestaría. Al revés no hay riesgo — **nadie apunta a `ParteTrabajo`**, también medido.

## SCRUM-498 (×2): el 22 pasa a 23 en las doce frases, y nada más

No se rediseñó el mecanismo. Una de las doce arrastraba un subrecuento que **mi propio cambio
rompía**: `scrum272` decía «20 llevan `@map("merchant_id")` y 2 NO» (20+2=22, coherente), y con
`ParteTrabajo` —que sí mapea `merchant_id`— pasa a **21+2=23**. Medido aparte con un contador
propio: 21 con `@map`, 2 en camelCase (`Quote`, `Invoice`).

### 🔴 Hallazgo que NO se arregla, y por qué: entrada para SCRUM-680

`src/modules/exports/domain/portabilidadCompleta.ts:30` dice «de los 23 modelos, **19** mapean a
`merchant_id` y DOS no». **19+2 = 21, no 23.** Ese subrecuento **ya estaba mal antes de esta
tanda** (decía 22 con 19+2=21). La línea divisoria es esa: el de `scrum272` era coherente y lo
rompí yo, así que lo arreglo; éste lo rompió otro ticket, así que **se reporta y no se toca**.

### Qué hace el número en `portabilidadCompleta.ts` (respuesta para SCRUM-680)

**Solo documenta.** Vive dentro de un comentario de cabecera; no valida nada ni itera sobre nada.
La lista real se deriva en ejecución de `Prisma.dmmf`, y el propio módulo lo dice: un modelo nuevo
con `merchantId` «aparece aquí **solo**, sin que nadie lo añada a ningún sitio». O sea que el
mecanismo **ya es derivado**: lo único copiado a mano es la prosa que lo describe.

## SCRUM-461 + SCRUM-222: `docs/sql/deriva-prod.sql` REGENERADO

Con `node scripts/generar-sql-deriva.mjs`. Ni editado a mano ni copiado ningún número.

**374 → 403 columnas · 26 → 27 tablas.** La suma, comprobada con un contador propio **validado
contra las cabeceras de los dos ficheros** (374 y 403, exactos) antes de creerle nada:

`374 + 29 = 403`, donde **29 = 1** (`jobs.tipo_intervencion`) **+ 1**
(`merchants.clausulas_presupuesto`) **+ 3** (`quotes`: `revision`, `iva_modo`,
`clausulas_excluidas`) **+ 24** (`partes_trabajo`) — exactamente los seis cambios de schema.

⚠️ Mi primer contador dio 381 y no 403 en los dos ficheros a la vez. **Un instrumento que falla
igual en los dos sitios parece que cuadra**: el delta salía bien por casualidad. La causa eran las
columnas camelCase (`invoices.merchantId`), que mi regex no veía. Corregido y revalidado antes de
dar ninguna cifra.

## `docs/master/SCRUM-650.md` corregido

Su bloque describía `onDelete` **solo en `job`** — una versión PEOR que la del código. Y el `.md`
**se contradecía a sí mismo**: su prosa ya decía «Corregido a `Cascade` en los dos padres», pero el
bloque seguía siendo el del PASO 0. Quien copiara de ahí habría reintroducido el defecto que
SCRUM-244 cazó. Ahora el bloque es **idéntico al del schema, comprobado línea a línea**.

## Los tres rojos, con el árbol commiteado en `55406151`

| Inyección | Resultado |
|---|---|
| `parteTrabajo` fuera del ORDEN | SCRUM-192 y SCRUM-314 rojos, **nombrando el modelo** |
| una sola de las doce frases vuelve a decir «22» | SCRUM-498 rojo: `src/app.ts:673 dice 22 y son 23` |
| una columna borrada **a mano** del SQL generado | SCRUM-461 y SCRUM-222 rojos, nombrando `partes_trabajo.contenido_hash` |

Revertidos los tres, árbol limpio y suite verde.

## Contabilidad del diff

`prisma/schema.prisma` **no se ha tocado en esta vuelta**. El diff de esta vuelta sí tiene
**14 borrados** donde el de la primera tenía cero, y son todos **sustituciones**: las 12 frases con
el número viejo, la línea `teamMember` del `.md` y la cabecera de conteo del SQL regenerado.

**No se ha ejecutado `db push`, ni `migrate`, ni `deploy`.**


---

# Estado del db push · 2-sep-2026 · EN ESPERA, y por qué

**Medido contra:** `origin/main` = `a5aef1b9bbd2570eccbde82b407c9d3675192c2d` · 2026-09-02T19:30:11+02:00

> Este apartado iba a ser `docs/master/SCRUM-674-ESTADO-DEL-PUSH.md`. El guard de SCRUM-273 exige
> `/^SCRUM-\d+\.md$/` y ese nombre no casa, así que vive aquí, en el fichero de su ticket. Es la
> segunda vez hoy que ese guard corrige un nombre y las dos veces tenía razón: un fichero por
> ticket es la propiedad entera que defiende.

## 🔒 LA REGLA QUE SALE DE ESTE DÍA

> **Cuando un borrado aparece en un diff, la primera pregunta NO es «¿lo apruebo?».
> Es «¿QUÉ RAMA FALTA POR ENTRAR?».**
>
> Producción puede ir POR DELANTE de `main`, y hoy iba.

El fundador aplica columnas a producción para desbloquear un PR **antes** de que ese PR se mergee.
Durante esa ventana, `main` no declara lo que la base ya tiene, y **cualquier `db push` desde `main`
propone borrarlo**. El diff no está mal: está incompleto, porque le falta una rama.

Y el corolario, que es lo que casi se hace mal: **redeclarar esas columnas en el schema para «arreglar
el diff» es reescribir el PR de otra persona.** El diff no se arregla; se espera.

## Lo que se midió (SOLO LECTURA, ni una fila escrita)

### Los tres `DROP COLUMN` del preview: las tres columnas están VACÍAS

| Columna | filas | con dato |
|---|---|---|
| `albaranes.doc_header_text` | 30 | **0** |
| `quotes.doc_header_text` | 130 | **0** |
| `quotes.doc_footer_text` | 130 | **0** |

No hubo muestra que anonimizar: no hay ni una fila con contenido.
**Control positivo:** la conexión ve **385 columnas** en `public`. Sin él, un 0 no distingue «está
vacía» de «no estoy mirando esta base».

### Por qué están vacías: NO es texto de cliente sin migrar

`docFields` **no es su sustituto** — es `Json?` con booleanos de *qué datos del cliente muestra el
documento* (`{name, phone, taxId, email}`). Otra cosa.

Buscando quién retiró las columnas, el instrumento devolvió lo contrario: **el commit las AÑADE**.

```
05c0b1ba0ac37daa5de5342e4bd83f8fa892692a   2026-09-02 14:31   Javier Pereira Fernández
SCRUM-593 fase ③: esquema + cableado + el viaje completo contra base real
  «Las TRES bases tienen ya las columnas (produccion la aplico el fundador…)»
```

**Ese commit NO está en `origin/main`.** Vive sólo en `origin/scrum-593-doc03-cabecera-y-pie`
(`cd4a2472e9eedd0f889bb4ba0e13a87c09b6e50c`); hay además una segunda rama del mismo ticket,
`origin/scrum-593-texto-y-observaciones`.

> Buscar quién quitó algo y descubrir que **nadie lo quitó** es lo que cambió la decisión del día.

Así que el `db push` no borraría texto de ningún cliente: **borraría las columnas del PR de Javier**,
y su fase ③ se mergearía sobre una base que ya no las tiene. Están a cero porque la función es de
hoy y todavía no escribe.

### Los dos `TIMESTAMP(3)`: no se pierde nada

Las dos son hoy `timestamp without time zone` con **precisión 6** (microsegundos) y pasarían a **3**
(milisegundos). Se contaron las filas cuyos microsegundos **no** son múltiplo exacto de 1000, que
son las únicas que cambiarían:

| Columna | filas | con valor | perderían precisión |
|---|---|---|---|
| `charges.paid_at` | 55 | 1 | **0** |
| `merchants.asesor_programa_preguntado_at` | 13 | 0 | **0** |

## Las tres salidas, y la elegida

| | Salida | Veredicto |
|---|---|---|
| **(a)** | **Esperar a que `scrum-593-doc03-cabecera-y-pie` se mergee** | ✅ **ELEGIDA** |
| (b) | SQL aditivo a mano por el aplicador con lista blanca | para después, con SCRUM-685 |
| (c) | Redeclarar las tres columnas en `prisma/schema.prisma` | ❌ descartada |

**(a) se elige porque no hay nada que decidir.** En cuanto entre esa rama, `main` declara las tres
columnas y **los `DROP` desaparecen solos**. Cero aprobaciones de borrado, cero riesgo, y va a
ocurrir igualmente.

**(c) se descarta por lo que ES, no por lo que arriesga:** sería escribir el PR de Javier otra vez.
Y `prisma db push` no admite selección por columna —reconcilia el esquema entero—, por eso no hay
una cuarta salida.

## ⚠️ Lo que bloquea y lo que NO

* **`job_assignees` YA EXISTE en producción** (no aparece en el preview real, y el preview contra el
  checkout fósil lo confirmó al proponer su `DROP TABLE`). **SCRUM-650 PASO C no está bloqueado por
  esto** y lo ejecuta el fundador aparte.
* Lo que sí espera: las cinco columnas y `partes_trabajo` de SCRUM-674.

## 📌 Para SCRUM-685 · el aplicador de lista blanca (NO construido, descrito)

La salida (b) apunta a algo que ya existe a medias y que es **mejor salvaguarda que un GO leído por
un humano cansado**: un clasificador que rechaza el borrado **por máquina**, no por criterio.

`scripts/_clasificador-sql.mjs`, medido:

* **PERMITE** — `ADD COLUMN` nullable o con `DEFAULT` (y rechaza `ADD COLUMN NOT NULL` sin default,
  «falla en seco si la tabla ya tiene filas»), `CREATE TABLE`, `CREATE INDEX` / `CREATE UNIQUE INDEX`,
  `CREATE TYPE`, `ALTER TYPE … ADD VALUE` y `COMMENT ON`.
* **RECHAZA** — cualquier `DROP` (incluido dentro de un `ALTER TABLE … DROP COLUMN`), y
  `ALTER COLUMN … TYPE`, por poder truncar o fallar sobre los datos que ya hay.
* **Y no es un `grep DROP`**: el propio fichero cuenta que un auditor improvisado se cazó a sí mismo
  porque la palabra «DROPs» aparecía en su comentario. Trocea en sentencias y clasifica cada una,
  así que `INSERT INTO t VALUES ('DROP COLUMN x')` no dispara nada.
* **Por defecto rechaza**: lo que no sabe clasificar, no pasa.

Contra el preview de hoy, ese clasificador habría **permitido las seis cosas de SCRUM-674** y
**rechazado los tres `DROP` y los dos `ALTER COLUMN TYPE`**, sin que nadie tuviera que leer nada.

**Qué le falta para poder apuntar a producción:**

1. **Hoy está atado a una sola base a propósito.** `aplicar-sql-dev.mjs` sólo aplica a
   `yaqu_dev_javier`, y su cabecera dice por qué: *«una herramienta genérica de "aplica este SQL a
   la base que le digas" es la que no queremos»*. Apuntar a producción exige un equivalente con su
   propio destino declarado y contrastado, no un parámetro.
2. **Contraste de destino.** `dev` y `staging` comparten host; el aplicador ya contrasta la clave
   contra su destino declarado. Producción necesita el suyo, con `parseBDSegura` (que no tiene forma
   de devolver la cadena).
3. **Idempotencia.** Un `.sql` aplicado dos veces tiene que ser inocuo o fallar ruidosamente, nunca
   a medias.
4. **Rastro.** Qué fichero, contra qué base, cuándo y con qué veredicto por sentencia — el registro
   que hoy sostiene `docs/MIGRATIONS_PENDING.md` a mano.
5. **El rojo del propio clasificador**, probado con un `.sql` real que mezcle formas permitidas y
   prohibidas.

⚠️ **Corrección sobre lo anterior, medida después de escribirlo:** el punto 5 estaba mal planteado
como carencia. **Ya lo hace**: una sola sentencia rechazada bloquea el fichero ENTERO —«NO se
ejecuta el fichero»— y no hay interruptor global; autorizar una excepción exige declararla *por su
huella*, con motivo y nombre de quien autoriza. Lo que falta es lo de los puntos 1-4, no esto.
Describir como pendiente algo que ya está construido es justo el error que este día ha repetido.

**No se construye aquí.** Queda descrito para juntarlo con SCRUM-685.
