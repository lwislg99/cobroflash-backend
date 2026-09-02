# SCRUM-580 · CONT-07 · Tags por contacto

**Fecha:** 2-sep-2026 · **Carril:** S3
**Medido contra:** `origin/main` = `1b76c430c7ae4e4541e86191b3802ba79b6f5017` · 2026-09-02T19:21:12Z
**Rama:** `scrum-580-cont07-tags-por-contacto`
**Estado:** 🛑 **PARADO EN EL PASO ②**, que es donde el encargo manda parar.

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
