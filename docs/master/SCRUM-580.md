# SCRUM-580 · CONT-07 · Tags por contacto

**Fecha:** 2-sep-2026 · **Carril:** S3
**Medido contra:** `origin/main` = `1b76c430c7ae4e4541e86191b3802ba79b6f5017` · 2026-09-02T19:21:12Z
**Rama:** `scrum-580-cont07-tags-por-contacto`
**Estado:** ✅ **cerrado** — las tres bases con la columna, y el ③ entregado.

**La víctima:** el profesional no puede agrupar a sus clientes por nada. En oficios eso es
comunidad · administrador · aseguradora · urgencias · moroso. Con 300 clientes, buscar por texto
el nombre de una comunidad no sustituye a filtrar por «administrador».

---

## PASO 0

### ⚠️ Primero, la premisa del lote de agosto — y esta vez SÍ se sostiene

El aviso del encargo era que el documento de agosto sale de una captura de pantalla y ya se ha
equivocado dos veces hoy (CONT-08 y CONT-10 estaban construidos). **Medido: aquí no.**

| Dónde busqué | Qué encontré |
|---|---|
| `prisma/schema.prisma` | **ninguna** columna de etiquetas en `Customer`. Los dos aciertos de «etiqueta» son `stageLabel` (tramo de factura) y un comentario de `contactKind` |
| `public/dashboard/js/*.js` | ningún campo, ninguna columna, ningún filtro de etiquetas |
| `filtroClientes.js` | **cero** menciones de tag. El recorte de CONT-08 es una ausencia limpia, no un muñón a medias |

### ENTRADA: **no existe ninguna**

No hay campo en el alta, ni en la edición, ni columna en la lista, ni filtro. El profesional no
tiene hoy ningún sitio desde donde llegar a esto.

### MECANISMO: la maquinaria de alrededor existe; la etiqueta, no

Existen el formulario, la lista, la pieza de filtro (`filtroClientes.js`) y el `select` del
servidor. Así que el trabajo **no es construir un motor**: es pasar un campo por los cinco
eslabones que ya están.

### 🔴 EL QUINTO ESLABÓN, LOCALIZADO ANTES DE CONSTRUIR

`CUSTOMER_SELECT_NO_TOKEN` en `src/modules/system/customerAdmin.ts` es un `select` **explícito**, y
lo usan `listCustomers` **y** `getCustomer`. Lo que no esté en esa lista **no sale**, aunque la
columna exista y aunque el alta lo haya guardado.

Ese fichero ya lleva escrito el aviso, de SCRUM-579:

> *«Sin estas cinco líneas, `createCustomer` guardaría la dirección y devolvería un cliente sin
> ella; la pantalla se recargaría vacía y el profesional volvería a escribirla. Y la tanda seguiría
> VERDE, porque el dato SÍ estaría en la base: el defecto sería mudo.»*

Es exactamente el defecto que el encargo manda buscar. **Está localizado y nombrado antes de tocar
una línea**, y los tests del ③ no se conformarán con «se guarda»: releerán con `getCustomer`.

---

## 🛑 PASO ② · EL `ALTER`, LISTO PARA QUE LO APLIQUE EL FUNDADOR

### El DDL — generado, no escrito a mano

```sql
ALTER TABLE "customers"
  ADD COLUMN IF NOT EXISTS "tags" JSONB;
```

Fichero: **`docs/sql/scrum-580-tags-por-contacto.sql`**. Pasa la lista blanca de
`aplicar-sql-dev.mjs` (ensayo ejecutado, no tocó nada).

**🔴 EL TIPO NO ESTÁ ADIVINADO.** Lo generó `node scripts/preview-migracion.mjs --desde`, o sea
`prisma migrate diff` sobre el esquema modificado, con **control positivo** (la herramienta
respondió y vio 27 tablas) y **veredicto aditivo**: ni DROP, ni RENAME, ni TRUNCATE, ni DELETE, ni
SET NOT NULL.

Importa porque **`schemaDrift` comprueba que la columna EXISTA, no su tipo**: un `tags` creado como
TEXT arrancaría en verde y se pudriría semanas después, al guardar un array y leerlo como cadena.

### La verificación, con control positivo dentro

Fichero: **`docs/sql/scrum-580-verificar.sql`**. Sólo lee, y **pide el tipo**, no sólo la
existencia. Devuelve 3 filas: `customers.tags` (la nueva) más `customers.recargo_equivalencia` y
`merchants.clausulas_presupuesto` — la segunda es además el control de **cómo se ve un JSONB bien
creado** en esa misma base.

**Si faltan las dos de control, la consulta no estaba mirando esa base**, y la ausencia de `tags`
no significa «no está»: significa «no se vio nada».

### 🔴 `prisma/schema.prisma` SE HA REVERTIDO, Y ES DELIBERADO

Se modificó **sólo para generar el diff** y se dejó **idéntico a `main`**. Motivo: mientras el
`ALTER` no esté aplicado en las tres bases, una rama cuyo esquema nombre `tags` **tumba el arranque
de producción** si alguien la mergea. `schemaDrift` compara esperado ⊆ real, y esa es exactamente
la secuencia que produjo nueve días sin desplegar.

El esquema entra en el **③**, junto al código y los tests, cuando el fundador confirme el ②.

---

## El modelo, y por qué no lo contradigo

Una columna **JSONB** en `customers`, decidida por el fundador. Mi PASO 0 **no la contradice** y
además la respalda: el esquema ya usa JSONB en `merchants.clausulas_presupuesto` y
`quotes.clausulas_excluidas`, así que no es patrón nuevo (regla 36 intacta).

**Nullable y sin default**, y no es cosmética: `null` = «no se declararon etiquetas», que **no es**
`[]` = «se miraron y no hay ninguna». Con un `DEFAULT '[]'`, un `IS NOT NULL` diría que **todos**
los clientes tienen etiquetas y el filtro se construiría sobre esa mentira. *Ausente ≠ vacío* es
requisito del ticket.

**Consecuencia asumida y escrita:** renombrar una etiqueta en todos los clientes toca muchas filas.
Operación rara; no se construye ahora.

---

## Lo que NO se ha construido todavía, y por qué

Todo el ③: campo en alta y edición, columna en la lista, filtro por etiqueta y su combinación con
las pestañas y el buscador. **No por falta de tiempo: porque el orden es inviolable** y el ② no es
mío. Construirlo ahora significaría dejar en la rama un esquema que tumba producción si alguien la
mergea antes del `ALTER`.

## 🕳️ Huecos declarados

1. **Nada se ha ejercitado contra una base con la columna.** El DDL está generado y verificado
   como forma; que se aplique bien es del ②.
2. **La medición en navegador a 360 px no se ha hecho** y no se puede hacer aquí: en esta máquina
   Edge no levanta (`Failed to launch the browser process`, 0,0 s). La caja de las etiquetas hay
   que medirla en un navegador real antes de cerrar el ③, y el encargo tiene razón en pedirlo — una
   tanda verde no ve qué aspecto tiene una pantalla.
3. **El microcopy no está propuesto todavía**: va con el ③, cuando exista la pantalla que lo
   enseña, para poder medir su caja en vez de contar caracteres.

---

## ✅ PASO ② · APLICADO EN LAS DOS BASES ALCANZABLES (2-sep-2026)

Producción **no**: la aplica el fundador, y desde un árbol de trabajo no se puede ni se debe.
Destinos acreditados ANTES con `scripts/comprobar-claves-bd.mjs` (`DATABASE_URL`: **ausente**, que
es lo correcto en un árbol de trabajo).

### 🔴 EL PROCEDIMIENTO FUE ANTES-Y-DESPUÉS, y el motivo no es burocrático

Esta casa ya tuvo dos veces el mismo defecto: una clave apuntando a otra base, y
`DATABASE_URL_STAGING` y `DATABASE_URL_TESTS` siendo la misma cadena (SCRUM-668). **Aplicar dos
veces sobre la misma base se ve exactamente igual que hacerlo bien.** Por eso se midió cada base
antes y después.

**Bases físicas distintas alcanzables: DOS**, no tres — `_STAGING` y `_TESTS` resuelven a la misma.
Ya está fichado como SCRUM-668 y no se persigue aquí.

| Base **física** | La resuelven | ANTES | DESPUÉS |
|---|---|---|---|
| **`yaqu_dev_javier`** (host `acela`) | `DATABASE_URL_DEV` | 2 filas · `tags` **ausente** | 3 filas · `tags` = **`jsonb`** |
| **`railway`** (host `acela`) | `DATABASE_URL_STAGING` **+** `DATABASE_URL_TESTS` | 2 filas · `tags` **ausente** | 3 filas · `tags` = **`jsonb`** |
| **producción** (host `autorack`) | — | ⛔ pendiente del fundador | — |

**El «antes» de la segunda salió con `tags` AUSENTE**, y eso es exactamente lo que descarta que
las dos cadenas apunten al mismo sitio: si hubiera salido con 3 filas, tocaba parar y decirlo.

**Control positivo en las cuatro lecturas:** `customers.billing_city` (`text`) y
`quotes.clausulas_excluidas` (`jsonb`). Sin esas dos, la consulta no estaba mirando esa base, y la
ausencia de `tags` no significaría «no está» sino «no se vio nada». La segunda es además el control
de **cómo se ve un JSONB bien creado** en esa misma base.

**El tipo salió `jsonb` en las dos**, que es lo que de verdad había que comprobar: `schemaDrift`
mira que la columna exista, **no su tipo**.

Turno de staging **tomado y soltado**; libre al terminar. Registro operativo en
`docs/MIGRATIONS_PENDING.md`.

`prisma/schema.prisma` **sigue sin tocarse** y sigue idéntico a `main`: entra en el ③ cuando las
**tres** bases tengan la columna.

---

# ✅ PASO ③ · ESQUEMA + CAMPO + COLUMNA + FILTRO (2-sep-2026)

**Medido contra:** `origin/main` = `61ae2dc38787201209c4ca5426bffd72a441f0fb` · 2026-09-02T19:59:38Z

## Producción, con su procedencia

> **Base:** producción (servicio `Postgres` de Railway) · **Medido por:** el asesor · **2-sep-2026**
> **Resultado:** 3 filas · `customers.tags` = `jsonb`
> **Controles positivos presentes:** `customers.billing_city` = `text` ·
> `quotes.clausulas_excluidas` = `jsonb`

No es una afirmación sobre el estado: es **el resultado de la consulta de este ticket, ejecutada
contra esa base**, y queda con **quién la midió y cuándo**. Un hueco cerrado sin decir de quién es
la medición se vuelve a abrir en cuanto alguien pregunte de dónde salió.

**Las tres bases tienen la columna**, así que `schemaDrift` (esperado ⊆ real) ya no impide arrancar
y el esquema puede ir.

## Los cinco eslabones

| # | Eslabón | Dónde |
|---|---|---|
| 1 | se escribe | `customersView.js` · campo en alta y edición |
| 2 | se envía | `tagsParaPayload` → `null` si no hay ninguna |
| 3 | se valida | `schemas.ts` · `z.array(z.string()).nullable().optional()` |
| 4 | se guarda | `customerAdmin.ts` · `normalizarEtiquetas` en **alta Y edición** |
| 5 | **SE RELEE** | `CUSTOMER_SELECT_NO_TOKEN` · `tags: true` |

**El quinto se buscó ANTES de construir**, como pedía el encargo. Es un `select` explícito que usan
`listCustomers` **y** `getCustomer`: sin esa línea el alta guardaría las etiquetas y devolvería un
cliente sin ellas, la pantalla se recargaría vacía, el profesional las reescribiría — **y la tanda
seguiría verde, porque el dato sí está en la base.** El test no se conforma con «se guarda».

## 🔴 «Ausente ≠ vacío», y Prisma obligó a decirlo con precisión

Sin etiquetas se guarda **`null`**, nunca `[]` ni `""`. Si se guardara `[]`, un `IS NOT NULL` diría
que ese cliente **tiene** etiquetas y el filtro se construiría sobre esa mentira.

Y el compilador forzó una distinción que conviene dejar escrita: hay **tres** nulls y sólo uno vale.

| | Qué hace |
|---|---|
| `Prisma.DbNull` | **NULL de SQL** — «no se declararon etiquetas». **ESTE.** |
| `Prisma.JsonNull` | el valor JSON `null` **dentro** de la columna. La columna **no** quedaría NULL |
| `undefined` | «no toques el campo» — en una edición parcial, borrarlo sería perder las etiquetas al cambiar el teléfono |

Confundir los dos primeros es «ausente ≠ vacío» con otro nombre. Un test lo ata, y mira **el código,
no los comentarios** (ver abajo).

## El filtro, y los CUATRO combinados

Se cierra el recorte que CONT-08 dejó abierto. `aplicar(clientes, pestaña, orden, etiqueta)`
encadena **pestaña → etiqueta → orden** sobre el lote que **ya viene filtrado por el buscador**
desde el servidor. Los cuatro a la vez, y ninguno sustituye a otro — probado con un conjunto que
**no está ordenado por id**, porque si lo estuviera el test no distinguiría A-Z de orden de
inserción.

El cuarto argumento es **opcional**: llamar con tres sigue funcionando, así que nadie se rompe.

**Las opciones del selector salen de las etiquetas que ESE merchant ya usa en SUS clientes** —del
lote que el servidor acotó por tenencia—, nunca de otro merchant. Se recalculan en cada pintado, así
que una etiqueta recién escrita aparece sin recargar. Si la etiqueta activa deja de existir, el
filtro **se suelta**: dejarlo puesto enseñaría una lista vacía sin decir por qué. Y con cero
etiquetas en la cartera el selector **se oculta**, en vez de ofrecer un control con una sola opción.

## Lo que NO se ha perdido, comprobado

* **F1** — las cabeceras siguen siendo `ID · Nombre · Teléfono`: el teléfono sigue **tercero**. La
  columna nueva entra **después de Notas**, oculta en móvil como sus vecinas.
* **F3** — Editar · Portal · Historial siguen por fila.
* Las pestañas y el orden siguen funcionando **y combinados** con lo nuevo.
* Y un detalle que un test vigila: los `colSpan` de los estados vacíos se recalcularon a **8**.
  Un vacío que abarca menos columnas de las que tiene la tabla sale descuadrado en cuanto entra
  una columna, y eso no lo ve ninguna tanda.

## ⚠️ MICROCOPY (propuesta original de la sesión — ver la aprobación al final)

Va **sin marcador en pantalla** (decisión del 2-sep-2026) y su procedencia es esta entrada.

| Ranura | Propuesta | Caracteres |
|---|---|---|
| rótulo del campo | `Etiquetas` | 9 |
| placeholder | `comunidad, administrador, urgencias…` | 36 |
| cabecera de columna | `Etiquetas` | 9 |
| opción «sin filtro» | `Todas las etiquetas` | 19 |

🕳️ **La caja está medida en CARACTERES, no en píxeles**, y se dice: en esta máquina Edge no levanta
(`Failed to launch the browser process`, 0,0 s). **La medición a 360 px que pide el ticket NO se ha
hecho** y hay que hacerla en un navegador real: una tanda verde no puede ver qué aspecto tiene una
pantalla — hoy ya pasó con unos rótulos solapados que destapó una captura, no los tests.

## La UI, según la casa

`yaqu-premium-ui` cargada antes de tocar. Las etiquetas se pintan con **`.badge .badge-slate`**, el
componente que **ya está en el inventario (AB3)**: cero tokens nuevos, cero estilo inventado. Con
`textContent` por etiqueta y no concatenando markup — la escribe el profesional, y meterla en un
`innerHTML` sería una inyección con su nombre.

Un input separado por comas y **no** un editor de chips: eso sería un componente nuevo, y eso es
propuesta de inventario, no algo que se cuela en un ticket.

## Los rojos, probados rompiendo el mecanismo

| Rotura | Qué cayó |
|---|---|
| el `select` deja de traer `tags` | «el select TRAE tags, o el alta se pierde en silencio» |
| se guarda `[]` en vez de `null` | «sin etiquetas se guarda null, NUNCA `[]`» |
| el filtro deja «caer» al cliente sin etiquetas en todas | **2**: el suelo del filtro y «no cae en ninguna» |
| **control negativo** · cambiar un comentario | **nada** |

**Y el guard me cazó a mí, por tercera vez hoy:** el test que prohíbe `Prisma.JsonNull` **se cazó a
sí mismo** en el comentario que explica la prohibición. Ahora desnuda los comentarios antes de
mirar, **con suelo** para que el desnudador no se lleve el fichero por delante. Lección de
SCRUM-349.

## Lo derivado, regenerado

`docs/sql/deriva-prod.sql` **regenerado**, no editado: **412 columnas · 27 tablas** (411 + la nueva,
sin tablas nuevas). El test que lo compara con el esquema pasa sin tocarlo a mano.

---

## ✅ MICROCOPY · APROBADA POR EL ASESOR (2-sep-2026) · PROVISIONAL

**PROCEDENCIA:** decisión del **asesor**, 2-sep-2026, **provisional a la espera del fundador** —
como el resto del microcopy de hoy. Los cuatro textos son los que propuso la sesión, sin cambios.

| Ranura | Texto | Caracteres |
|---|---|---|
| rótulo del campo | `Etiquetas` | 9 |
| cabecera de columna | `Etiquetas` | 9 |
| placeholder | `comunidad, administrador, urgencias…` | 36 |
| opción «sin filtro» | `Todas las etiquetas` | 19 |

### 🔴 «Aprobado por el asesor» NO es «firmado por el fundador», y el contador lo dice

`SIN_APROBAR` pasa de **0 a 4**. Y esto es el contador de SCRUM-581 haciendo exactamente aquello
para lo que se dejó existiendo aunque valiera cero:

> *«Se queda en el fichero aunque valga 0, y a propósito: si mañana alguien añade una pestaña o un
> orden nuevo, la ranura nace SIN APROBAR y este número tiene que subir.»*

Ha tardado un ticket en cobrarse. Las **seis** de SCRUM-581 las firmó el fundador; estas **cuatro**
están a la espera. Que no se pinte marcador en pantalla —decisión del 2-sep— **no** las convierte
en firmadas: quien lleva la cuenta es este número, y un test lo ata por los dos lados.

### Fijados con `===`, y en UN solo sitio

Los cuatro viven en `TEXTOS_ETIQUETAS` (`filtroClientes.js`), no repartidos por la vista: un texto
suelto en cada `textContent` deriva sin que nada chille. Se comparan **literales** —ni `match` ni
`includes`— porque un `match` dejaría colar una coma, un acento o un «Etiquetas del cliente» sin
que nada cayera, y **microcopy aprobada que deriva sola es microcopy que deja de estar aprobada sin
que nadie lo decida** (regla 30).

**Con SUELO:** se comprueba que las ranuras son **exactamente cuatro**. Si alguien añade una quinta,
el bucle pasaría sin mirarla y «todas las que hay están bien» daría el mismo verde que «no hay
ninguna».

### Los rojos de esta vuelta

| Rotura | Qué cayó |
|---|---|
| `urgencias…` → `urgencias...` (**un carácter**) | «los CUATRO textos son EXACTAMENTE los aprobados» |
| la vista repite `"Todas las etiquetas"` a mano | «la vista NO repite los textos: los lee de la pieza» |
| `SIN_APROBAR` vuelve a 0 sin que nadie firme | **2**: el de CONT-07 y el de SCRUM-581 |

El primero es el que importa: los puntos suspensivos son **un** carácter, no tres, y un `includes`
no habría notado la diferencia.
