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
