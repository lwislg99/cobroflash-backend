# SCRUM-588 · CONT-16 · Referencia interna por cliente — **PASO ② PREPARADO, Y PARO**

**Fecha:** 2-sep-2026 · **Carril:** ficha de cliente · **Gate:** no aplica — hoy no se toca código

**Medido contra:** `origin/main` = `61ae2dc38787201209c4ca5426bffd72a441f0fb` · 2026-09-02T19:49:16Z

> 🛑 **Esta entrada cierra el paso ① y entrega el ②. No hace el ②, y no hace el ③.**
> `prisma/schema.prisma` de esta rama es **idéntico a `main`**, a propósito y comprobado.

---

## 1 · PASO 0

### El aviso del lote: **medido, y esta vez NO se cae**

El lote de agosto dice que esto no existe, y esa frase sale de una captura del 24-ago —el propio
documento declara que no se abrió el repositorio—. Hoy CONT-08 y CONT-10 se han caído así, de modo
que se midió antes de nada:

**`Customer` no tiene ninguna columna de referencia interna.** Sus campos hoy son `contactKind`,
`legalName`, `taxId`, `id`, `merchantId`, `name`, `phone`, `email`, `notes`, `portalToken`,
`waOptOut`, `tipoDestinatario`, `recargoEquivalencia`, `billingPeriodicity` y los cinco
`billing*`. **Ninguna sirve para esto.** El ticket es real.

> Los dos `reference`/`referencia` que aparecen en el esquema son de **otras tablas**:
> `Charge.reference @map("referencia")` y `ParteTrabajo.referencia`. La referencia de un cobro no
> es el código con el que el profesional llama a su cliente.

### ENTRADA

**Sí la hay.** El profesional llega por menú **Clientes** → `customersView.js`, y el buscador que
tiene que encontrar la referencia ya existe: `listCustomers` en
`src/modules/system/customerAdmin.ts:48`, con un `OR` sobre **nombre, teléfono y email**.

### MECANISMO · casi todo existe; el trabajo del ③ será darle superficie

| eslabón | dónde | ¿existe? |
| --- | --- | --- |
| ① esquema | `prisma/schema.prisma` | falta la columna — **es el ②** |
| ② validación | `src/core/validation/schemas.ts:390` (patrón `billingAddress`) | existe, hay que añadir la clave |
| ③ escritura | `createCustomer` hace `data: { ...normalizarIdentificadores(data) }` | **no hay que tocarlo**: pasa el body validado entero |
| ④ formulario | `customersView.js:359 / :591 / :638` (pintar · cargar · enviar) | existe |
| ⑤ **`select`** | `CUSTOMER_SELECT_NO_TOKEN`, `customerAdmin.ts:17` | **el que decide** |
| ⑥ **búsqueda** | el `OR` de `listCustomers:48` | existe, y **este ticket añade un eslabón que `billingAddress` no tenía** |

**El quinto es explícito y lo que no esté ahí no sale**, aunque el alta lo haya guardado: la
pantalla se recargaría vacía, el profesional reescribiría el dato y **la tanda seguiría verde**
porque el dato sí está en la base. El propio fichero lo lleva escrito desde SCRUM-579.

---

## 2 · El DDL — generado, no escrito a mano

`scripts/preview-migracion.mjs` (el script de la casa, que ejecuta el CLI **local** y trae control
positivo: **27 tablas**), comparando el schema de `main` contra una copia temporal con la columna.
**Ninguna de las dos está en el árbol**: se usó `previewMigracion({ schema, desde })`, así que
`prisma/schema.prisma` no se tocó en ningún momento.

```sql
ALTER TABLE "customers" ADD COLUMN "internal_ref" TEXT;
```

* **El tipo lo decide Prisma**, no yo: `String?` → `TEXT`. El aviso del carril es literal — en la
  deriva anterior dos columnas eran JSONB y crearlas TEXT habría arrancado en verde y podrido
  semanas después, porque `schemaDrift` comprueba que la columna **exista**, no de qué tipo es.
* **Clasificado por la lista blanca de la casa**: `ADD COLUMN ×1` → **permitida**, «solo añade
  columnas (nullable o con DEFAULT)». Ensayo previo sin `--go`: 1 sentencia de forma conocida.
* **Nombre físico `internal_ref`**, inglés snake_case, que es la convención de `customers`
  (`contact_kind`, `legal_name`, `tax_id`, `billing_address`…).

### Los dos ficheros, y por qué van separados

| fichero | qué |
| --- | --- |
| `docs/sql/scrum-588-customers-internal-ref.sql` | el `ALTER`, con `IF NOT EXISTS` |
| `docs/sql/scrum-588-verificacion.sql` | la comprobación, **solo lectura** |

La lista blanca **rechaza un `SELECT`**: un fichero que mezcle el ALTER con su verificación queda
**inaplicable**. Ya pasó una vez.

### La verificación comprueba el TIPO, no sólo la existencia

Y lleva **dos controles positivos de tipos distintos** — `customers.name` (text) y
`customers.wa_opt_out` (**boolean**) —, porque con uno solo, y de texto, un catálogo que devolviera
`text` para todo daría los dos números buenos y no se notaría.

**Probada contra las dos bases accesibles**, y distingue en la misma ejecución:

| | `yaqu_dev_javier` | `railway` (staging) |
| --- | :-: | :-: |
| `control_name_text` | **1** | **1** |
| `control_optout_boolean` | **1** | **1** |
| `internal_ref_existe` | **0** | **0** |
| `internal_ref_es_text` | 0 | 0 |

Los controles a 1 con la columna a 0 es exactamente lo que hace que ese cero signifique «falta» y
no «no supe mirar». **Y el mecanismo está probado en las dos direcciones sin aplicar nada**:
`control_name_text` usa la misma forma (`column_name = X AND data_type = 'text'`) sobre una columna
que sí existe, y devuelve 1.

---

## 3 · Microcopy propuesta, con su caja medida

Medido en navegador a **360 px**, con el marcado real de `createField` (`div.field > label +
input`) y las hojas reales:

| rótulo | ancho del texto | caja | holgura |
| --- | :-: | :-: | :-: |
| «Teléfono» (el vecino, como referencia) | 49 px | 336 | 287 |
| **«Referencia interna»** ← propuesto | **103 px** | 336 | **233** |
| «Tu referencia» | 73 px | 336 | 263 |
| «Referencia interna del cliente» | 164 px | 336 | 172 |

Ninguno parte en dos líneas (19 px de alto los cuatro).

**Propuesta para aprobar:**

* **Rótulo:** `Referencia interna`
* **Ayuda, como `placeholder`:** `Nº de expediente, finca, código…` — mide **219 px** sobre **308 px**
  útiles del input: **cabe**, con 89 px de holgura.

> ⚠️ **Y una limitación del sistema que condiciona la propuesta:** `createField` **no admite una
> línea de ayuda**, y **no existe clase de hint/ayuda en el CSS**. Por eso la ayuda se propone como
> `placeholder`, que sí tiene superficie hoy. Si el asesor prefiere una ayuda **bajo** el campo,
> eso es un componente nuevo para el inventario AB3 y no cabe en este ticket.
>
> **Nada de marcadores en pantalla**: no se pinta ningún `[PENDIENTE …]`. El ③ no se escribe hasta
> que estos dos textos estén aprobados.

---

## 4 · Lo que NO se ha hecho, y por qué

* **No se ha aplicado el `ALTER` a ninguna base.** El carril lo dice: «TÚ NO HACES EL ②». Ni
  siquiera a dev, aunque el aplicador esté atado a ella.
* **`prisma/schema.prisma` está idéntico a `main`**, comprobado con `diff` contra
  `origin/main:prisma/schema.prisma`: **sin diferencias**. Una rama cuyo esquema nombre una columna
  que las bases no tienen tumba el arranque de producción si alguien la mergea — y eso costó nueve
  días de despliegue.
* **No se ha escrito una línea de código de producto**: ni validación, ni `select`, ni formulario,
  ni búsqueda. Eso es el ③.

---

## 5 · Lo que le espera al ③, ya censado

* **`CUSTOMER_SELECT_NO_TOKEN` es el eslabón que decide.** Sin `internalRef: true` ahí, el alta
  guarda y la pantalla vuelve vacía, en silencio.
* **La búsqueda es un eslabón que `billingAddress` no tenía**: hay que añadir la clave al `OR` de
  `listCustomers:48`, y el suelo con control positivo que pide el carril — buscar una referencia
  que existe devuelve **esa** fila; buscar una que no existe devuelve **cero**.
* 🔴 **HAY DOS FORMULARIOS QUE EDITAN CLIENTE, no uno.** El modal de `customersView.js` y la ficha
  360 de `customerDetailView.js` (campos `#e360-*`, que hoy edita notas, razón social y NIF).
  **SCRUM-579 dejó la dirección de facturación fuera del segundo.** Si el ③ sólo toca el primero,
  el profesional que edite desde la ficha no verá la referencia. Hay que decidirlo, no heredarlo.
* `docs/sql/deriva-prod.sql` se **regenera** con `node scripts/generar-sql-deriva.mjs` (hoy va por
  **411** columnas / 27 tablas): no se edita a mano ni se resuelve su conflicto eligiendo un lado.

---

## 6 · Huecos declarados

* **El lado positivo de la verificación (1 · 1 · 1 · 1) no está demostrado por ejecución**, porque
  eso exigiría aplicar el ALTER y no me toca. Lo que sí está demostrado es que la consulta sabe
  devolver 1 para una columna de texto que existe (`control_name_text`) y 0 para una que no.
* **No se ha medido producción**: desde un árbol de trabajo no hay acceso, y no debe haberlo
  (regla 3). Los números de arriba son de dev y staging.
* **La caja se midió en Chromium a 360 px**, que no es un dispositivo real ni la matriz AB6.
