# SCRUM-631 · Un producto desactivado ocupa su nombre para siempre — MEDICIÓN Y PROPUESTA

**Fecha:** 1-sep-2026 · **Carril:** producto · **Gate:** sin gate — no entra código

**Medido contra:** `origin/main` = `46f083adc807e8430b7ed34a2da976a9db706e5b` · 2026-09-01T16:53:15+01:00

**Alcance: MIDE y PROPONE. No se ha tocado `prisma/schema.prisma`, no se ha aplicado ninguna
migración y no se ha ejecutado ningún `db push`.** Los diffs se prepararon **sobre copias**, con el
schema real intacto. Nada de esto se ejecuta sin OK del fundador.

---

## 🔴 PRIMERO, DOS COSAS QUE NO CUADRAN CON EL ENUNCIADO

Las digo antes que nada porque cambian cómo se lee todo lo demás.

### (a) El `@@unique` NO es sobre `name`. Es sobre `nameSearch`, y `nameSearch` es NULLABLE

```prisma
nameSearch  String?  @map("name_search")
@@unique([merchantId, nameSearch])
```

Dos consecuencias medidas:

* **El nombre bloqueado no es el que se escribió, es su forma normalizada.** Ejecutando la función
  real (`normalizeSearch`, tomada verbatim de `dist/`, no reescrita):

  | se intenta dar de alta | contra un inactivo llamado | resultado |
  |---|---|---|
  | `tubo pvc` | `Tubo PVC` | 🔴 CHOCAN |
  | `TUBO   PVC` | `Tubo PVC` | 🔴 CHOCAN |
  | `Fontaneria` | `Fontanería` | 🔴 CHOCAN |
  | `Cana` | `Caña` | 🔴 CHOCAN |
  | `Rejilla` | `` Rejilla `` (con espacios) | 🔴 CHOCAN |

  **✅ Control positivo:** la misma función **sí** distingue `Tubo PVC` de `Tubo cobre`, y
  `Rejilla 20` de `Rejilla 30`. No colapsa todo: colapsa mayúsculas, tildes y espacios.

  O sea: un solo producto desactivado no bloquea *un* nombre, bloquea **toda su familia
  tipográfica** — incluida `Cana`, que es otra palabra.

* **Las filas con `name_search` NULL se escapan del UNIQUE.** En Postgres los NULL no chocan entre
  sí. La columna nació el 13-dic-2025 y el UNIQUE el 5-mar-2026, y **no existe ningún script de
  backfill** en el repo. Lo que haya de antes está fuera de la restricción. Cuántas filas son, eso
  lo dirá el SQL del punto 1.

### (b) SCRUM-614 **NO está en `main`**: el borrado físico sigue existiendo hoy

```
git show origin/main:src/modules/products/app/routes/products.routes.ts
  → 276: router.delete('/:id', …)   ·   280: deleteProduct(...)
git merge-base --is-ancestor origin/scrum-614-… origin/main  →  614 NO esta en main
```

La rama `scrum-614-censo-rutas-sin-rol` (`aee65cfb`) está empujada y **sin mergear**.

**Esto no invalida el ticket: cambia CUÁNDO muerde.** Hoy el profesional todavía tiene la salida
mala (borrar la fila). El callejón sin salida se cierra **en el instante en que 614 mergee**. Si se
quiere evitar la ventana, este arreglo debería ir **antes o con** 614, no después.

---

## 4 · ⚠️ LA PREGUNTA QUE VA PRIMERO: ¿tiene que ser único el nombre?

### La unicidad **no está decidida en ninguna parte**

| se buscó | resultado |
|---|---|
| `nombre único` / `name_search` / `nameSearch` en `docs/YAQU_MASTER.md` | **no aparece** |
| una entrada en `docs/master/` que la justifique | **no existe** (SCRUM-310 la cita, pero para hablar de los contadores del import) |
| `name_duplicate` en `docs/` | **no aparece** |

**✅ Control positivo del barrido:** el mismo grep **sí** encuentra el catálogo en el máster —
`ONBOARD-2`, «Catálogo + import CSV», «catálogos por gremio», línea 307 `J7. Catálogo técnico`—.
Encuentra lo que hay; lo que no hay es la decisión.

Entró como migración suelta el 5-mar-2026 (`20260305184512_product_unique_merchant_namesearch`),
sin entrada de registro. **Es exactamente lo que sospechaba el ticket: una decisión antigua que
nadie ha vuelto a mirar.**

### Pero quitarla NO borra el ticket. Esto es lo que la sostiene hoy

| quién depende | dónde | qué pasa si se quita |
|---|---|---|
| **`load-catalog`** (catálogo por gremio, ONBOARD-2) | `products.routes.ts:67` y `:119` — usa `P2002` **como idempotencia** | recargar el catálogo del gremio **duplicaría todos sus artículos** |
| **`importProductsCsv`** | `products.service.ts:148` (`findFirst`) + `:187` (P2002 «carrera») | el `findFirst` propio sigue deduplicando; solo se perdería el guard de la carrera |
| **el alta manual** | `products.routes.ts:247` → `409 name_duplicate` | una errata entraría dos veces en el tarifario |
| **una clave de búsqueda** | — | **NADIE.** Cero `findUnique` por el par `(merchantId, nameSearch)` en todo `src/` |

Que nadie lo use como identidad es el dato que importa: **la restricción es un guard de UX y una
muleta de idempotencia, no una regla del negocio.**

### 🎯 La respuesta, y es la que reduce el ticket

El daño no viene de «el nombre es único». Viene de que **el índice no tiene cláusula `WHERE`**:

```sql
CREATE UNIQUE INDEX "products_merchant_id_name_search_key" ON "products"("merchant_id", "name_search");
```

Nadie decidió que la unicidad abarcara también a los productos retirados. **Eso no es una regla:
es lo que pasa cuando no se escribe la mitad de la frase.** Y el propio encargo lo confirma en su
control negativo: dos productos **activos** con el mismo nombre siguen sin poder existir.

> **La pregunta correcta no es «¿único sí o no?» sino «¿único ENTRE QUÉ?».** Y la respuesta que ya
> está implícita en el control negativo del ticket es: **entre los activos**.

---

## 1 · EL ALCANCE, CON NÚMERO

### La consulta para producción

📄 **`docs/master/evidencias/scrum631/alcance.sql`** — lista para pegar en la consola de Railway.

**No la puedo ejecutar yo** (regla 3: ninguna sesión recibe la credencial de producción). No voy a
escribir un número que no he medido.

**Es de SOLO LECTURA, y está demostrado, no afirmado.** Pasada por `desnudar()` +
`partirSentencias()` de `scripts/_clasificador-sql.mjs` (que **quita los comentarios** — y es
donde yo sí nombro `DELETE` y `ALTER`, así que sin desnudar el guard se cazaría a sí mismo):

```
alcance.sql              sentencias:  4 | escritoras: 0
CONTROL POSITIVO
+ DELETE inyectado       sentencias:  5 | escritoras: 1 -> DELETE FROM products WHERE id=1
+ ALTER inyectado        sentencias:  5 | escritoras: 1 -> ALTER TABLE products DROP COLUMN v
```

### ⚠️ Los nombres de columna, comprobados UNO A UNO

No he generalizado la regla del snake_case, porque me avisaste de que es falsa y **lo he
verificado**: en `prisma/schema.prisma`, el modelo `Quote` tiene **15 campos camelCase SIN `@map`**
—`merchantId`, `customerId`, `createdAt`, `updatedAt`, `acceptedAt`, `rejectedAt`, `pdfUrl`,
`signatureUrl`, `selectedTierId`, `chargeId`, `reminderSentAt`…— que en la base se llaman así y
exigen comillas dobles.

En `products` los camelCase sin `@map` son **cero**. Y no lo deduzco del schema: lo he leído en el
**DDL real** que creó la tabla y en sus dos `ALTER` posteriores:

```
id · merchant_id · name · description · price · cost · vat · is_active
created_at · updated_at · name_search · provider_id
```

Todo minúscula. Por eso la consulta no necesita comillas.

### Lo que la consulta trae, y por qué cada fila

| # | mide | para qué |
|---|---|---|
| 1 | productos totales | **control positivo**: si sale 0, la consulta no vio la tabla y ningún otro número vale |
| 2-3 | activos / **inactivos** | cada inactivo es un nombre ocupado. Es el tamaño del problema |
| 4 | `name_search` NULL | las filas que se escapan del UNIQUE |
| 5-6 | merchants totales / con inactivos | cuántos profesionales pueden toparse con esto |
| 7 | pares repetidos con `name_search` no nulo | **control negativo: DEBE SALIR 0.** Si no, el índice no es el que creo y toda esta propuesta se apoya en algo falso |
| 8-9 | nombres normalizados repetidos, y los que mezclan activo+inactivo | los duplicados que hoy existen colados por los NULL |

**Si (3) sale 0, el defecto es real y LATENTE**, como dices: el callejón existe por construcción
—lo prueba el `CREATE UNIQUE INDEX` sin `WHERE`—, simplemente todavía no lo ha pisado nadie.

---

## 2 · ¿ES ALCANZABLE EL ÍNDICE PARCIAL? Sí. Y es el que peor envejece.

**Prisma 6.18.0, sin `previewFeatures`.** No sabe declarar un índice parcial: no hay forma de
escribir `WHERE is_active` en el schema.

Y aquí está lo que decide, **medido offline con la propia herramienta del proyecto**
(`scripts/preview-migracion.mjs`, con su control positivo «la herramienta responde (25 tablas)»):

| se le esconde a Prisma | qué haría el siguiente `db push` |
|---|---|
| un **índice** que el schema no declara | `DROP INDEX "products_nombre_activo_parcial";` → **🔴 destructiva** |
| una **columna** que el schema no declara | `ALTER TABLE "products" DROP COLUMN "name_search_activo";` → **🔴 destructiva** |

**Esconderle algo a Prisma no es una estrategia: es un aplazamiento.**

Y en el caso del índice parcial no es un riesgo de una vez, es **recurrente**. Porque para que el
índice parcial mande hay que **quitar el `@@unique([merchantId, nameSearch])` del schema** — si se
deja, el siguiente `db push` **recrea el índice del callejón**. Con el `@@unique` fuera, Prisma ya
no conoce ninguna unicidad ahí, y **cada `db push` de aquí en adelante volverá a proponer tirar el
índice parcial**. Para siempre.

### ¿Y `schemaDrift.ts` lo cazaría al arrancar? **NO. Y lo dice él mismo:**

> «QUÉ COMPRUEBA Y QUÉ NO (declararlo importa: un guard que exagera su cobertura miente).
> **SÍ:** que exista cada TABLA y cada COLUMNA que el cliente Prisma va a nombrar.
> **NO:** tipos, nullability, defaults, **índices**, claves ajenas, ni valores de enum.»

Así que si el índice parcial cayera, **producción arrancaría verde** con la garantía perdida, y el
primer síntoma sería que empiezan a aparecer nombres duplicados entre productos activos. Que es
justo el «peor que no tenerlo» que temías.

### La única red que hay hoy, y hasta dónde llega

El `DROP INDEX` **sí lo enseña el preview** (lo he visto: «🔴 1 sentencia(s) DESTRUCTIVA(S)»), y el
preview es obligatorio (SCRUM-385) con hook que lo exige. **Pero el hook solo cubre lo que pasa por
una sesión** — lo declara su propio comentario:

> `.claude/hooks/guard-dangerous.mjs:602` — «un `db push` lanzado por otra vía no pasa por aquí.»

O sea: protegido si el `db push` lo lanza una sesión y alguien lee el veredicto; **desprotegido** si
sale de otra terminal.

---

## 3 · LAS SALIDAS, CADA UNA CON SU CONSECUENCIA

Contra los tres controles que pide el ticket:

| salida | 2º inactivo mismo nombre | 2 ACTIVOS mismo nombre | ¿sobrevive a `db push`? | ¿la ve el guard de arranque? |
|---|---|---|---|---|
| **0 · quitar la unicidad** | ✅ ilimitados | 🔴 **se permite** → rompe el control negativo | ✅ | n/a |
| **A · `@@unique([merchantId, nameSearch, isActive])`** | 🔴 **el 2º falla** | ✅ imposible | ✅ Prisma lo re-crea | ❌ (no mira índices) |
| **B · índice parcial por SQL crudo** | ✅ ilimitados | ✅ imposible | 🔴 **lo tira, y en CADA push** | ❌ (no mira índices) |
| **C · columna declarada + `@@unique`** | ✅ ilimitados | ✅ imposible | ✅ Prisma es el dueño | ✅ **es una COLUMNA: sí la mira** |

### 0 · No exigir unicidad — **qué se rompe**

Recargar el catálogo por gremio duplicaría todos sus artículos (`load-catalog` usa P2002 como
idempotencia, dos sitios), y una errata en el alta entraría dos veces en el tarifario, donde el
autocompletado del presupuesto la enseñaría dos veces sin forma de distinguirlas. Arreglable con
una comprobación explícita en los dos sitios de `load-catalog`, pero **cambia una regla de producto
que no me toca decidir** — y además rompe el control negativo del propio ticket.

### A · Meter `isActive` en el `@@unique` — **tu propuesta, con tu propia pega, confirmada**

Un activo y **UN SOLO** inactivo. El segundo inactivo con el mismo nombre da `P2002` otra vez.
Es la salida más barata (una línea de schema) y la única que **no** resuelve el caso que el ticket
manda probar. La dejo sobre la mesa como parche si hace falta algo hoy, **diciendo su límite**.

### C · La columna declarada — **lo que propongo**

Una columna nullable que vale el nombre normalizado **solo si el producto está activo**, y `NULL`
si no. Como en Postgres los `NULL` no chocan, los inactivos dejan de competir por el nombre —
ilimitados— y dos activos siguen sin poder coincidir.

Y gana en el eje exacto que te preocupa: **es una columna, y `schemaDrift` sí comprueba columnas.**
Si algún día desapareciera, producción **se niega a arrancar** en vez de arrancar callando.

SQL **generado por el propio Prisma** (diff preparado sobre una copia; `prisma/schema.prisma`
intacto, `git status prisma/` limpio):

```sql
DROP INDEX "products_merchant_id_name_search_key";
ALTER TABLE "products" ADD COLUMN "name_search_active" TEXT;
CREATE UNIQUE INDEX "products_merchant_id_name_search_active_key"
  ON "products"("merchant_id", "name_search_active");
```

⚠️ **NO se pega en ese orden.** Prisma lo emite así porque no sabe de despliegues. El orden seguro,
por la lección de SCRUM-205 (`ALTER TABLE` → luego el código, nunca al revés) y para no abrir ni un
segundo sin garantía:

1. `ALTER TABLE "products" ADD COLUMN "name_search_active" TEXT;` — aditivo, nadie lo usa aún.
2. Desplegar el código que **escribe** la columna nueva (3 sitios: alta, edición del nombre,
   activar/desactivar). Sigue mandando el índice viejo.
3. `UPDATE products SET name_search_active = name_search WHERE is_active;` — el backfill.
4. `CREATE UNIQUE INDEX products_merchant_id_name_search_active_key ON products(merchant_id, name_search_active);`
5. `DROP INDEX products_merchant_id_name_search_key;` — **aquí, y no antes**, cae el callejón.
6. `prisma/schema.prisma` recoge el estado final (decisión del fundador: el schema es suyo).

**El coste honesto de C:** una columna, un backfill, tres sitios de escritura y un despliegue en
varios pasos. Es la más cara de las cuatro. Lo es a cambio de ser la única cuya garantía no hay que
volver a defender en cada `db push`.

### 🔴 Y algo que vale para TODAS: ninguna es aditiva

Las cuatro salidas —incluida la de no hacer nada nuevo— pasan por **tirar el índice actual**, porque
**el índice actual ES el callejón**. No existe una versión aditiva de este arreglo. Conviene saberlo
antes de empezar.

---

## LO QUE CUALQUIER SALIDA VA A NECESITAR — dos defectos medidos de paso

1. **El `PUT` no captura `P2002`.** Medido: `P2002` solo se trata en `products.routes.ts:67`,
   `:119` y `:247` — los tres son de creación. Así que **reactivar** un producto cuyo nombre haya
   sido ocupado mientras tanto devuelve `500 internal_error`, no un 409. Con cualquiera de estas
   salidas ese camino se transita más, así que hay que taparlo.
2. **El profesional ve el código crudo.** `productsView.js:331` hace
   `throw new Error(data?.error)` y el aviso pinta `e.message`: en pantalla se lee literalmente
   **`name_duplicate`**. Necesita microcopy, y no la invento: va como
   **`[PENDIENTE microcopy oficial]`** hasta que la escribas.

---

## EL CONTROL

**ANTES — el callejón, probado por construcción.** El `CREATE UNIQUE INDEX` **no lleva cláusula
`WHERE`**, así que la restricción no puede distinguir activo de inactivo: el índice es el mismo
objeto para los dos estados. No hace falta ejecutarlo para saberlo, se lee en el DDL. Para
reproducirlo a mano: desactivar un producto y dar de alta otro con ese nombre (o cualquier variante
de mayúsculas/tildes/espacios) → `409 name_duplicate`, y en pantalla el texto `name_duplicate`.

**DESPUÉS — NO EJECUTADO, y no lo voy a disfrazar.** No se ha aplicado nada, así que no hay un
después que medir. El día que se autorice una salida, el control será: desactivar, crear con el
mismo nombre → **entra**; y comprobar `name_search_active IS NULL` en el desactivado.

**EL SEGUNDO INACTIVO** — el caso donde la opción A se rompe: **A NO lo cubre** y lo digo en vez de
dejarlo sin probar. B y C sí. Es la razón principal por la que no recomiendo A.

**NEGATIVO — dos ACTIVOS con el mismo nombre.** Sigue siendo imposible en A, B y C: en las tres, la
clave única incluye el nombre normalizado para las filas activas. Solo la salida 0 abre esa puerta,
y por eso la salida 0 no es «arreglar el callejón» sino cambiar la regla.

---

## Estado del árbol

* **Suite: total 4183 · pass 4104 · fail 0 · skipped 79** — sin cambios de código en esta rama.
* `prisma/schema.prisma` **intacto** (`git status prisma/` limpio). Los dos diffs se prepararon
  sobre copias en el scratchpad.
* Cero `db push`, cero migraciones aplicadas, cero escrituras en ninguna base.
* `npm run guards:entrada` en verde.

## HALLAZGOS FUERA DE ALCANCE

* **El import CSV salta los inactivos en silencio.** `products.service.ts:148` busca
  `{merchantId, nameSearch}` **sin filtrar `isActive`**, así que reimportar el tarifario cuenta como
  `skipped` cada producto que el profesional había desactivado — y nunca lo reactiva ni lo dice.
  Es el mismo defecto por otra puerta, y no se toca aquí.
* **`providers` tiene la misma forma** (`providers.routes.ts:24` y `:48`, con su propio
  `name_duplicate`). No lo he medido a fondo porque no es este carril; queda apuntado.
* No se ha tocado nada de SCRUM-614 (`lockActionForRole`, permisos), ni `quotesView`/fechas, ni
  `pdf.service`/guards.

---
---

# APÉNDICE · S2 (5-sep-2026) — EL CALLEJÓN PROVOCADO, Y UNA AFIRMACIÓN MÍA QUE LA MEDICIÓN TUMBA

**Medido contra:** `origin/main` = `78ca15a3` · re-fetch inmediato · árbol `cobroflash-b15`,
rama `scrum-631-nombre-ocupado-para-siempre` con `main` mezclado DENTRO (770 commits).
Comprobado que entre `28b04585` (donde empecé) y `78ca15a3` **no cambió nada de lo que medí**:
`prisma/schema.prisma`, `src/modules/products/`, `adminRouteDeclarations.ts`, `schemaDrift.ts`
y `seed-demo.mjs` tienen diff vacío entre los dos.

**Qué añade este apéndice al trabajo de S1, que no repito:** S1 declara *«cero escrituras en
ninguna base»* y escribe el control **en futuro** («el día que se autorice una salida, el control
será…»). Eso es una PREDICCIÓN. Aquí está PROVOCADO, sobre base de desarrollo, por el camino real
del código, con su limpieza verificada.

---

## 0 · ¿TIENE QUE SER ÚNICO EL NOMBRE? — SÍ, Y AQUÍ ESTÁ QUIÉN, CON LA LÍNEA DELANTE

Censo de `nameSearch` en `origin/main`: **4 ficheros, 11 apariciones**. Población pequeña y
enumerable, así que esto no es una muestra: es el total.

**🔴 NADIE NAVEGA POR LA UNICIDAD.** Cero usos de `findUnique` con la clave compuesta
`merchantId_nameSearch` — medido con control negativo (un patrón imposible devuelve vacío y exit
distinto de 0). La unicidad **no se usa como clave de búsqueda: se usa como GUARDA**. Y eso decide
el ticket: la restricción puede cambiar de FORMA (parcial, o columna) sin romper ningún camino de
lectura.

Los cuatro que dependen de que choque:

| quién | línea | qué pasa si se quita |
|---|---|---|
| `POST /admin/products` | `products.routes.ts:285` | deja de dar **409 name_duplicate**; el alta duplicada entra |
| `PUT /admin/products/:id` | `products.routes.ts:323` | ídem — es el arreglo de **SCRUM-641** |
| las **dos** rutas MASIVAS (load-catalog, import) | `:93` y `:152` | se tragan el P2002 **a propósito**: es la idempotencia de ONBOARD-2. Sin unicidad, recargar el catálogo **duplica**. Lo defiende `scrum644-...:219`, que exige exactamente 2 |
| el importador CSV | `products.service.ts:192` | el recuento skipped deja de contar la carrera |

**Respuesta: la unicidad HACE FALTA, y el ticket no desaparece.** Pero se reduce: no hay que
inventar unicidad, hay que **cambiarle la frontera** — de «todas las filas» a «las filas activas».

---

## 1 · EL ALCANCE, CON NÚMERO — y el cero que NO es «no pasa nada»

Base de **desarrollo**, sólo lectura, sin imprimir jamás la cadena de conexión:

| medida | valor |
|---|---|
| productos totales | **8** |
| activos | **8** |
| **INACTIVOS** (nombres presos) | **0** |
| merchants con productos | 1 |
| `name_search` **NULL** | **8** |
| nombres repetidos (merchant, name_search) | **0** |

**Los dos ceros dicen cosas distintas y ninguno dice «no pasa nada»:**

* **0 inactivos** → el defecto es **REAL Y LATENTE**. Nadie ha desactivado todavía; el día que lo
  haga, el nombre queda preso. Un cero aquí mide que aún no hay víctima, no que no pueda haberla.
* **0 nombres repetidos** → **la @@unique lo hace IMPOSIBLE por construcción**. Ese cero no es
  un hallazgo: es la definición de la restricción. Publicarlo como tranquilizador sería mentir.

### 🔴 UN HALLAZGO QUE NO BUSCABA: los 8 tienen `name_search` NULL

`seed-demo.mjs:227` crea productos con merchantId, name y price, y **sin `nameSearch`**. Como en
Postgres **los NULL no chocan entre sí en un índice único**, sobre esas 8 filas la restricción
**no está vigilando nada**. La base de dev, tal cual, **no puede demostrar el callejón** — por eso
tuve que fabricarme el caso.

Y tiene una consecuencia peor, medida con control positivo (un producto creado por el camino real
**sí** se encuentra, así que la búsqueda funciona):

```
¿ENCUENTRA EL AUTOCOMPLETADO LOS PRODUCTOS SEMBRADOS?
   buscando «sustitución de» → 0 resultado(s) 🔴 INVISIBLE
   buscando «desatasco de»   → 0 resultado(s) 🔴 INVISIBLE
   buscando «instalación de» → 0 resultado(s) 🔴 INVISIBLE
```

`searchProducts` (`products.service.ts:206`) filtra por nameSearch contains. **Todo el catálogo
sembrado es invisible al autocompletado del presupuesto.** Es un defecto de la demo, vivo hoy,
fuera del alcance de este ticket. **Ticket aparte** — no lo toco.

---

## 🔴 EL CONTROL QUE DECIDE — PROVOCADO, NO PREDICHO

Por el camino real (`dist/.../products.service.js`, no SQL a mano), contra dev, con nonce y
limpieza verificada:

```
① alta del producto ................... OK id=10
② duplicado estando ACTIVO ............ FALLA ✅ (P2002) — línea base correcta
③ desactivar .......................... OK · is_active=false · name_search=«caldera vaillant ...»
④ EL CASO: alta con el otro INACTIVO .. FALLA con P2002 → ✅ EL CALLEJÓN EXISTE
limpieza: 1 fila borrada · quedan con el nonce: 0 ✓
```

**El callejón existe y está medido.** Y ③ enseña el mecanismo exacto: desactivar **no limpia**
`name_search`, así que la fila sigue compitiendo por el nombre.

---

## 2 · LA AFIRMACIÓN HEREDADA QUE LA MEDICIÓN TUMBA

> S1, en la tabla de salidas: **«B · índice parcial por SQL crudo → 🔴 lo tira, y en CADA push»**

**Medido: NO lo tira.** Y no es un vacío sin comprobar — lleva control positivo en el mismo disparo.

### El experimento que discrimina

Se le esconden a Prisma **dos** índices que el esquema no declara, y se le pregunta al mismo
`migrate diff`:

| índice escondido | ¿propone borrarlo? | SQL emitido |
|---|---|---|
| **TOTAL** · UNIQUE (merchant_id, name) | 🔴 **SÍ** | `DROP INDEX "public"."p631_total";` |
| **PARCIAL** · UNIQUE (merchant_id, name_search) WHERE is_active = true | ✅ **NO** | *(sin SQL)* |

**Prisma VE los índices totales y es CIEGO a los parciales.** La advertencia de
`docs/sql/scrum-685b-parte-numero-unico.sql` —«el próximo migrate diff propondría BORRARLO»— es
**correcta para el índice que ella describe**, que es total. No se extiende al parcial.

### Y probado también en la configuración EXACTA de S1

S1 precisa que para que el parcial mande hay que quitar el @@unique del esquema, y que entonces
«cada db push volverá a proponer tirar el índice parcial. Para siempre». Reproducido —copia del
esquema **sin** @@unique, `prisma/schema.prisma` intacto (git status limpio)—:

```
SQL que propone el siguiente push:
   -- DropIndex
   DROP INDEX "public"."products_merchant_id_name_search_key";

CONTROL POSITIVO · ¿ve la retirada del @@unique (tira el índice total)? sí ✓
🔴 LA PREGUNTA   · ¿tira TAMBIÉN el índice parcial? ................. ✅ NO
```

El control positivo es lo que hace publicable ese «NO»: la herramienta **sí** está mirando y **sí**
reacciona a la retirada del @@unique. El parcial, sencillamente, no lo ve.

### Y con el comando que esta casa usa de verdad

**No hay `prisma/migrations/`**: esta casa aplica con **db push** (`scripts/db-push-prod`). Así que
migrate diff no bastaba. Corrido `prisma db push --skip-generate` contra **dev**, sin
accept-data-loss (si quisiera destruir algo, que se niegue):

```
ANTES   · índices únicos: p631_parcial(parcial) · products_merchant_id_name_search_key · products_pkey
          The database is already in sync with the Prisma schema.
DESPUÉS · índices únicos: p631_parcial(parcial) · products_merchant_id_name_search_key · products_pkey
          datos intactos: ✓ (8 → 8 filas)
```

**Sobrevive al db push.** Y el preview obligatorio de la casa (`scripts/preview-migracion.mjs`, con
su propio control positivo «la herramienta responde (27 tablas)») dice «sin cambios pendientes»
tanto **con** el índice parcial puesto como **sin** él — ni lo menciona.

### 🔴 PERO EL RIESGO SIGUE, Y ES EL CONTRARIO DEL QUE SE TEMÍA

Que el preview diga lo mismo con el índice y sin él **es exactamente el problema**: la herramienta
**no distingue los dos estados**. El peligro no es que se lo lleven en cada push — es que:

* **nada lo recrea**: una base nueva levantada desde `schema.prisma`, un force-reset o una
  restauración de copia **no lo tienen**;
* **nada nota su ausencia**: medido, los **dos** guardianes de esta casa miran **columnas**, no
  índices — `schemaDrift.ts:25-26` lo declara él mismo («**NO:** tipos, nullability, defaults,
  **índices**...») y `constanciaDelAlter.ts:58` consulta `information_schema.columns`.

**Un índice no tiene vigilante en esta casa.** Así que la conclusión de S1 —«es el que peor
envejece»— **se sostiene**, y su opción C sigue ganando en ese eje. Lo que cambia es el **motivo**:
no envejece porque se lo lleven, envejece porque **es invisible en las dos direcciones**.

---

## LA CONSECUENCIA NUEVA QUE NADIE HABÍA NOMBRADO: REACTIVAR PASA A CHOCAR

Con el índice parcial puesto, dentro de transacción revertida:

```
✅ ① alta activa «X»
✅ ② desactivar «X»
✅ ③ alta activa «X» de nuevo (el arreglo funciona)
⛔ ④ REACTIVAR la vieja, con la nueva ACTIVA          → P2002
✅ ⑤ desactivar la nueva y ENTONCES reactivar la vieja
```

Hoy reactivar **no puede** chocar, porque el nombre nunca se liberó. Con cualquier salida que libere
el nombre (B **o** C, no sólo B), **reactivar se convierte en una vía de choque nueva**. ④ no es un
callejón —⑤ enseña la salida— pero es un camino que hoy no existe.

**Y cae justo donde SCRUM-641 lo dejó preparado.** El PUT mete isActive en el mismo patch
(`products.routes.ts:302`) y pasa por el mismo catch (`:314`), así que el choque da **409
name_duplicate** y no un 500 — y el cliente ya lo traduce. SCRUM-641 lo escribió anticipándolo,
citando este ticket por su número:

> «en cuanto SCRUM-631 haga que reactivar un producto sea normal, este camino pasa de raro a
> frecuente» — `tests/scrum641-nombre-cogido-sin-500.test.mjs:17`

**Mi cambio no rompe 641: lo ACTIVA.** Nada que ajustar ahí.

⚠️ **Lo que SÍ queda pendiente y NO decido yo:** el texto que lee el profesional al pulsar
«Activar» sería «ese nombre ya está cogido», que es cierto pero habla de un alta. **Es microcopy y
la firma el asesor (regla 30).** No escribo candidato: no he medido su caja en navegador, y un
candidato sin caja medida es justo lo que la regla prohíbe.

---

## LAS SALIDAS, RE-PUNTUADAS CON LO MEDIDO

Mantengo la numeración de S1. Sólo cambia la fila **B**, y cambia por medición.

| salida | ¿libera el nombre? | ¿2 activos siguen imposibles? | 2.º inactivo | ¿sobrevive al db push? | ¿alguien nota si desaparece? |
|---|---|---|---|---|---|
| **0 · no exigir unicidad** | ✅ | 🔴 **NO** — cambia la regla | ✅ | — | — |
| **A · isActive en el @@unique** | ✅ | ✅ | 🔴 **se rompe** | ✅ (lo declara el esquema) | ✅ |
| **B · índice parcial por SQL** | ✅ | ✅ **medido** | ✅ **medido** | ✅ **MEDIDO — S1 decía que no** | 🔴 **NO — nadie** |
| **C · columna declarada** (S1) | ✅ | ✅ | ✅ | ✅ | ✅ schemaDrift **niega el arranque** |

**Consecuencia escrita de cada una:**

* **0** — se rompen los cuatro dependientes del punto 0: adiós al 409 name_duplicate y adiós a la
  idempotencia de ONBOARD-2 (recargar el catálogo **duplica**). No es arreglar el callejón: es
  cambiar la regla del producto.
* **A** — el fontanero que desactive **un segundo** «Caldera Vaillant» vuelve a chocar. Cambia el
  callejón de sitio en vez de quitarlo. Confirmado por medición: el caso ⑥ del índice parcial es
  justo el que A no cubre.
* **B** — funciona hoy y sobrevive al db push (medido). Su coste es que **queda fuera del esquema y
  sin vigilante**: el día que falte, producción arranca **verde** y el primer síntoma serán nombres
  duplicados entre activos.
* **C** — la más cara (columna + backfill + 3 sitios de escritura + despliegue por pasos) y la única
  cuya pérdida **detiene el arranque**. El diff lo dejó S1; no lo repito.

**No elijo.** Las cuatro cambian comportamiento del producto y las cuatro tocan
`prisma/schema.prisma` o la base. **Decide el fundador.**

---

## LO QUE NO SE HIZO

* ⛔ **Ninguna migración aplicada.** `prisma/schema.prisma` **intacto** — verificado con git status
  y git diff sobre la ruta: 0 ficheros modificados. Los dos esquemas de prueba son **copias en el
  scratchpad**.
* ⛔ **No se ejecutó `scripts/db-push-prod`.** El db push que corrí apunta a DATABASE_URL_DEV, que
  es la única base que tengo permiso para alterar. Staging y producción, el fundador.
* ⛔ **Cero secretos.** No se ha impreso, escrito ni inventado ninguna cadena de conexión: el .env
  se lee para sacar **una** clave y pasarla en el ENTORNO del hijo, nunca en argv
  (`aplicar-sql-dev.mjs:106`). El rótulo de host que aparece en la salida lo imprime prisma.
* ⛔ **No se devolvió el borrado físico**, no se tocó lockActionForRole ni los permisos de 614, y no
  se entró en su fase 2.
* ⛔ **Cero cambios de código de producto.** Este apéndice y el SQL preparado son todo.

### Higiene de la base de desarrollo

Todo lo que escribí lo limpié, y lo verifiqué **por propiedad del catálogo**, no por memoria:

* las pruebas destructivas (quitar el índice total, poner el parcial) fueron **dentro de una
  transacción revertida**, con SAVEPOINT para los casos que debían fallar — porque en Postgres una
  sentencia fallida aborta la transacción (`albaranIdempotencia.ts:22`);
* post-condición final: `products_merchant_id_name_search_key` **restaurado**, índices de prueba
  **0**, filas con nonce **0**, y preview-migracion de vuelta en «sin cambios pendientes».

---
---

# APÉNDICE 2 · S2 (5-sep-2026) — LA OPCIÓN B, CON SU VIGILANTE

**Decisión del asesor:** opción B (índice parcial), **y B no entra sin su guard**. Uno sin el
otro no se mergea. Esto es esa entrega.

**Medido contra:** `origin/main` = `6fa04adc`, mezclado DENTRO de la rama antes de la tanda.
El apéndice 1 de este máster **ya está en `main`** (PR #1070).

---

## 1 · EL SQL SE PARTIÓ EN DOS, Y ME LO ENSEÑÓ LA HERRAMIENTA DE LA CASA

La primera versión era un fichero con `BEGIN; CREATE...; DROP...; COMMIT;`.
**`scripts/aplicar-sql-dev.mjs` lo RECHAZÓ**, nombrando las tres sentencias que no sabe aplicar:

```
🔴 3 sentencia(s) que esta herramienta NO sabe aplicar:
      línea 58: BEGIN
      línea 64: DROP INDEX IF EXISTS "products_merchant_id_name_search_key"
      línea 66: COMMIT
   Solo se aceptan: ALTER TABLE … ADD COLUMN · CREATE [UNIQUE] INDEX · CREATE TABLE … ( … ).
```

No era un obstáculo: era el diseño diciendo que **los dos pasos no tienen el mismo riesgo**.
Quedan dos ficheros:

| fichero | riesgo | quién lo aplica |
|---|---|---|
| `docs/sql/scrum-631-paso-1-crear-indice-parcial.sql` | **aditivo** — no borra nada | la herramienta de la casa lo acepta |
| `docs/sql/scrum-631-paso-2-retirar-indice-total.sql` | **destructivo** — retira un índice | una persona que ha leído el host; en producción, el fundador |

**El orden no es libre, y la ventana intermedia es SEGURA:** primero se crea el parcial, después se
retira el total. Entre los dos conviven, y el total es el MÁS ESTRICTO — durante esa ventana el
callejón sigue pero **no se abre ningún hueco**. Al revés dejaría un instante sin garantía.

### 🔴 Y UNA CONDICIÓN QUE MIDO AHORA Y CONFIRMA A S1

> S1: «para que el índice parcial mande hay que quitar el `@@unique` del schema — si se deja, el
> siguiente `db push` **recrea el índice del callejón**».

**Medido, y es cierto.** Con el parcial puesto y el `@@unique` todavía en el esquema, retirado el
índice total, esto es lo que propone el siguiente push:

```
-- CreateIndex
CREATE UNIQUE INDEX "products_merchant_id_name_search_key" ON "products"("merchant_id","name_search");
```

Así que **el paso 2 NO puede aplicarse antes de que el PR del esquema esté mergeado**, o el
callejón vuelve solo y en silencio. Está escrito dentro del propio fichero del paso 2.

⚠️ Esto NO contradice lo que medí en el apéndice 1. Son dos cosas distintas y las dos son ciertas:
Prisma **no tira** un índice PARCIAL que no conoce (medido, con control positivo), y Prisma **sí
recrea** un índice TOTAL que su esquema declara y la base no tiene. Lo primero es sobre el índice
nuevo; lo segundo, sobre el viejo.

### Estado de la base de DESARROLLO

Paso 1 **aplicado** con `scripts/aplicar-sql-dev.mjs --go`. Verificado leyendo el catálogo, no el
mensaje de la herramienta:

```
ANTES   → control_ve_los_indices 5 · indice_total_unico 1 · indice_parcial 0 · activos_duplicados 0
DESPUÉS → control_ve_los_indices 6 · indice_total_unico 1 · indice_parcial 1 · activos_duplicados 0
```

⛔ **El paso 2 NO está aplicado en dev**, y es deliberado: el esquema aún declara el `@@unique`, así
que dev quedaría en deriva y el `preflight-schema-drift` de las demás sesiones —que mira esta misma
base— empezaría a fallar. Dev queda con los DOS índices y `migrate diff` limpio.

---

## 2 · EL GUARD — `src/core/db/unicidadNombreProducto.ts`

El hueco, medido en el apéndice 1: **un índice no tiene vigilante en esta casa**. `schemaDrift.ts:25`
lo declara él mismo («NO: … índices …») y `constanciaDelAlter.ts:58` consulta
`information_schema.columns`. Con la opción B, la garantía vive en un índice que el esquema no
puede declarar, así que su ausencia sería invisible.

### Qué comprueba, y qué NO

* **SÍ**: que exista AL MENOS UN índice ÚNICO sobre `(merchant_id, name_search)` en `products`,
  sea **TOTAL** (el estado de hoy) o **PARCIAL sobre los activos** (tras la opción B).
* **NO**: cuál de los dos. Y es DELIBERADO: los dos son estados legítimos de esta migración, así
  que **este guard vale antes, durante y después**, y puede mergearse sin depender de cuándo se
  aplique el ALTER en cada base. Lo que no admite es que no quede NINGUNO — que es exactamente la
  pérdida silenciosa que existe para cazar.
* **NO**: `providers`, que tiene la misma forma y no está medido.

Esa tolerancia no es blandura: es lo que **quita el riesgo de despliegue**. Un guard que exigiera
el índice parcial y se mergeara antes del ALTER dejaría producción sin arrancar.

### Se pide POR PROPIEDAD, nunca por el nombre

`indisunique`, la lista de columnas resuelta a nombres, y el predicado (`pg_get_expr`). Un guard
que buscara `products_merchant_nombre_activo_key` se cae al renombrarlo, y —peor— pasaría a verde
con un índice que se llama igual y no garantiza nada.

🔴 **Y el control negativo NO es hipotético: está HOY en la base.**
`products_merchant_id_name_search_idx` está sobre **las mismas dos columnas** y **no es único**.
Un guard que mirara sólo las columnas lo daría por bueno con la garantía perdida. El corpus del
test es el catálogo REAL de dev, con ese índice dentro a propósito.

El predicado se acepta sólo si restringe **a los activos**: Postgres lo normaliza a
`(is_active = true)` —medido, no supuesto— y se rechaza cualquier negación (`false`, `NOT`, `<>`),
porque un parcial sobre los INACTIVOS dejaría a dos activos llamarse igual.

### El desenlace, COPIADO del guard hermano y no inventado

Mismos tres de `schemaDrift` (SCRUM-222): **perdida** → en producción NO arranca, fuera sólo avisa;
**no pude comprobar** → arranca gritando, y jamás dice «todo bien»; **garantizada** → arranca y
**dice qué forma encontró**, que durante la migración es la única manera de saber en qué estado
está cada base mirando el log.

### El suelo

Lista VACÍA de índices ⇒ **`no-pude-comprobar`, nunca `perdida`**: `products` tiene siempre su clave
primaria, así que cero índices significa que la consulta no está mirando esa tabla. Sin esa rama,
«la garantía se perdió» y «el guard está roto» darían el mismo veredicto — el defecto que este
guard existe para cazar, un nivel más abajo.

### El enganche, por AST y no por texto

`src.includes('assertUnicidadDeNombre')` seguiría VERDE tras borrar la llamada, porque el `import`
mantiene viva la palabra. Es el defecto exacto de SCRUM-745. La técnica se **deriva** de
`scrum222-deriva-arranque.test.mjs:324`. Se exige: que el arranque lo ESPERE, que sea ANTES de
`app.listen`, y que vaya **DESPUÉS** de `assertSchemaSinDeriva` — si la columna no existe, la
unicidad sobre ella no significa nada.

⚠️ **Escalón 3 declarado.** `llamadasEnTests` (`_alcance-desde-entradas.mjs`) hace exactamente esta
búsqueda por AST, pero está **acotada al directorio `tests/`**; generalizarla tocaría un helper
compartido por otros tests, más riesgo del que este ticket pide. Y `quienLoImporta` no sirve:
contesta «quién lo importa», y el import SOBREVIVE justo cuando se borra la llamada.

### MUTACIONES_QUE_ME_TUMBAN — corridas, no declaradas

```
✔ scrum631 · GUARD · src/index.ts ESPERA a assertUnicidadDeNombre ANTES de app.listen   (×2)
vivas 14 · mudas 0 · ciegas 0
```

Las dos mutaciones son sobre `src/index.ts`, **y no es casualidad**: el meta-guard NO reconstruye
`dist` antes de correr el test mutado, así que mutar `unicidadNombreProducto.ts` sería INERTE —el
test importa el compilado, seguiría verde, y el guard parecería mudo sin serlo—. `src/index.ts` sí
se lee de disco. Las demás pruebas comparan VALORES de funciones puras, que no tienen esa clase de
mudez.

---

## 3 · 🔴 LA MICROCOPY: EL LITERAL ESTÁ, LA CAJA **NO SE PUDO MEDIR**

Me pediste el literal con su caja a 929 y 390 px. **El literal está escrito y MARCADO. La caja no
la tengo, y no la voy a fingir.**

### El candidato

```
Ya tienes otro producto activo con ese nombre.
```

46 caracteres. En pantalla sale hoy con el marcador delante, porque **no lo ha aprobado nadie**:

```js
const PV_NOMBRE_ACTIVO_DUPLICADO =
  PV_MARCADOR_MICROCOPY + ' Ya tienes otro producto activo con ese nombre.';
```

**Por qué no vale el de SCRUM-641.** Aquel dice «Ya tienes **un** producto con ese nombre» y se lee
**con el campo del nombre delante**, en un alta. Al pulsar «Activar» no hay campo que cambiar y el
choque es con **otro producto que está ACTIVO**. Mantengo su voz («Ya tienes» → es tuyo, que en un
multi-tenant importa) y su decisión de no llevar salida.

**Y el reparto del fichero se respeta:** SIN marcador = aprobado por el asesor
(`PV_NOMBRE_DUPLICADO`); CON marcador = sin aprobar por nadie (éste). `PV_SIN_APROBAR` sube de
**1 a 2**, y el guard de SCRUM-641 —que mira ese número— **puso la tanda en rojo hasta que lo
declaré**. Es literalmente el caso que su propio comentario anticipaba.

### 🔴 POR QUÉ NO HAY CAJA, CON SU CONTROL

El navegador de esta máquina **no arranca**. Y no es mi medidor:

```
control · scripts/guard-caja-avisos.mjs (guard de navegador que YA existe y corre en CI)
  ⟦arranque⟧ 0.3 s CORTADA EN «proceso+ws» ×3 intentos → salida 3
  binario: C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe
```

Falla **exactamente igual** que el mío. Edge está instalado y se resuelve; lo que no levanta es el
proceso. Escribí el medidor entero (servidor desde `public/`, `.view-container`, el marcado real de
`setAlert`, los textos leídos de `window.PV_*` y control negativo de 400 caracteres) y **lo borré**:
un medidor que no puede medir no se commitea.

**Esto es NO MEDIDO, no «cabe».** Y por regla 30 significa que **no lo puedes firmar todavía**.

**El dato que sí tengo, y por el que hay que verlo y no calcularlo:** el texto aprobado de SCRUM-641
son **37** caracteres, y la capacidad medida a 390 px fue **45**. El mío son **46 sin el marcador**.
Está **justo en el borde**: un carácter fuera de la capacidad conocida. Puede caer a dos líneas.

Si prefieres una alternativa corta que quede holgada, la más cercana en voz es
«Ya tienes otro activo con ese nombre.» (37 caracteres, igual que el aprobado) — pero **tampoco la
he medido**, y pierde la palabra «producto».

⛔ **No firmo ninguna, y no quito el marcador.** Cuando haya máquina con navegador, la caja se mide
y decides con ella delante.

---

## 4 · LO QUE NO SE HIZO

* ⛔ **`prisma/schema.prisma` INTACTO.** El PR del esquema —quitar `@@unique([merchantId,
  nameSearch])`— es del fundador. Sin él, el paso 2 no se aplica en ninguna base.
* ⛔ **Paso 2 sin aplicar en ninguna base**, ni siquiera dev, y por el motivo de arriba.
* ⛔ **No se ejecutó `scripts/db-push-prod`.** Staging y producción, el fundador.
* ⛔ **No se devolvió el borrado físico**, no se tocó `lockActionForRole` ni los permisos de 614.
* ⛔ **Cero dependencias nuevas.**
* ⛔ **Cero secretos**: la clave de dev viaja en el ENTORNO del hijo, nunca en `argv`.

## 5 · HUECOS DECLARADOS

1. **La caja de la microcopy: NO MEDIDA**, con el control que demuestra que es la máquina.
2. **El 403/409 por el camino real** (sesión de técnico contra el servidor) sigue sin ejercitarse:
   vive en `tenancy-permisos.test.mjs`, gateado tras `QA_DB_TEST=1`. El guard nuevo se prueba con
   funciones puras y con el catálogo real, no arrancando el servidor.
3. **El guard nunca se ha visto disparar contra una base REAL sin el índice.** Su rama `perdida`
   está ejercitada con corpus, no provocada en Postgres: provocarla exigiría dejar la base sin
   ninguna unicidad, y esa base la comparten otras sesiones.
4. **`providers` sigue sin medir.**
5. **Staging y producción: sin tocar y sin medir.**
