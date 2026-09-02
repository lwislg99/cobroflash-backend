# SCRUM-588 · CONT-16 · Referencia interna por cliente — **CERRADO (①②③)**

**Fecha:** 2-sep-2026 · **Carril:** ficha de cliente · **Gate:** no aplica — hoy no se toca código

**Medido contra:** `origin/main` = `61ae2dc38787201209c4ca5426bffd72a441f0fb` · 2026-09-02T19:49:16Z

> ✅ **Los tres pasos, en orden: ① decisión · ② ALTER en LAS TRES bases · ③ esquema + código +
> tests. El ③ NO se empezó hasta que el fundador confirmó producción.**
> `prisma/schema.prisma` de esta rama es **idéntico a `main`**, a propósito y comprobado con
> `diff` contra `origin/main` — no afirmado.

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

### MECANISMO · casi todo existía; el ③ fue darle superficie

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

**Devuelve UNA FILA POR COLUMNA encontrada, así que el número de filas ES el veredicto**: 2 antes
(los dos controles), 3 después. Esa forma es la que permite el control del paso siguiente — si el
«antes» de la segunda base ya trajera 3, no significaría que alguien se adelantó, sino que las dos
claves miran a la MISMA base.

Un resultado de **0 ó 1 filas se lee al revés que el resto**: no es «falta `internal_ref`», es que
no se ha comprobado nada (otro `search_path`, o `information_schema` ilegible). Y
**`internal_ref` presente con un tipo que no sea `text` es peor que ausente**: `schemaDrift` la
daría por buena y el dato se corrompería al escribir.

---

## 3 · Microcopy APROBADA, con su caja medida

Medido en navegador a **360 px**, con el marcado real de `createField` (`div.field > label +
input`) y las hojas reales:

| rótulo | ancho del texto | caja | holgura |
| --- | :-: | :-: | :-: |
| «Teléfono» (el vecino, como referencia) | 49 px | 336 | 287 |
| **«Referencia interna»** ← APROBADO | **103 px** | 336 | **233** |
| «Tu referencia» | 73 px | 336 | 263 |
| «Referencia interna del cliente» | 164 px | 336 | 172 |

Ninguno parte en dos líneas (19 px de alto los cuatro).

**APROBADA, literal — no se toca:**

* **Rótulo (APROBADO por el asesor, 2-sep-2026):** `Referencia interna`
* **Ayuda, como `placeholder` (APROBADA):** `Nº de expediente, finca, código…` — mide **219 px** sobre **308 px**
  útiles del input: **cabe**, con 89 px de holgura.

> ⚠️ **Y una limitación del sistema que condiciona la propuesta:** `createField` **no admite una
> línea de ayuda**, y **no existe clase de hint/ayuda en el CSS**. Por eso la ayuda se propone como
> `placeholder`, que sí tiene superficie hoy. Si el asesor prefiere una ayuda **bajo** el campo,
> eso es un componente nuevo para el inventario AB3 y no cabe en este ticket.
>
> 🔴 **Y queda como HUECO DECLARADO, no como solución** (asesor): un placeholder **desaparece en
> cuanto el profesional teclea**. Aquí es tolerable porque el significado lo lleva el RÓTULO y el
> placeholder sólo da ejemplos. **Si algún día la ayuda tuviera que llevar la REGLA, no valdría.**
>
> **Nada de marcadores en pantalla**: no se pinta ningún `[PENDIENTE …]`. Los dos textos están
> aprobados, así que el ③ los escribe LITERALES.

---

## 3 bis · El ② aplicado en LAS TRES BASES

Procedimiento antes-y-después por base, **y no es ceremonia**: esta casa ya tuvo
`DATABASE_URL_STAGING` apuntando a desarrollo, y `STAGING` y `TESTS` siendo la misma cadena
(SCRUM-668). **Aplicar dos veces sobre la misma base se ve exactamente igual que hacerlo bien** —
salvo por este recuento.

Ninguna cadena de conexión se escribe aquí, ni completa ni parcial: sólo el **nombre físico**.

| | base física | vía | filas | `internal_ref` |
| --- | --- | --- | :-: | --- |
| **A · dev, antes** | `yaqu_dev_javier` | `DATABASE_URL_DEV` | **2** | ausente |
| **C · dev, después** | `yaqu_dev_javier` | `DATABASE_URL_DEV` | **3** | `text` · null:YES · sin default |
| **A · staging, antes** | `railway` | `DATABASE_URL_STAGING` | **2** | ausente |
| **C · staging, después** | `railway` | `DATABASE_URL_STAGING` | **3** | `text` · null:YES · sin default |
| **producción** | servicio `Postgres` de Railway | — | **3** | `text` · medido por el asesor |

**El fundador aplicó producción** y verificó las tres filas: `internal_ref` = text, más los dos
controles (`name` = text, `wa_opt_out` = boolean). **Sólo entonces empezó el ③.**

🔴 **El control del carril pasa, y de la forma más directa:** cuando se midió el «antes» de
staging, **dev ya tenía 3 filas y staging seguía en 2**. Si las dos claves apuntaran a la misma
base, staging habría salido con 3 y habría que parar. Y tras aplicar en staging, se volvió a
medir dev: sigue en 3, no en «3 otra vez».

**El destino se verificó antes de cada escritura** (`comprobar-claves-bd.mjs`): `DEV` →
`yaqu_dev_javier`, `STAGING` → `railway`, y `DATABASE_URL` **ausente** — producción no vive en un
árbol de trabajo (regla 3).

> ⚠️ **`DATABASE_URL_STAGING` y `DATABASE_URL_TESTS` apuntan a la MISMA base física (`railway`)**,
> declarado como intencionado por el guard («BASE DE PRUEBAS DEL CARRIL»). Aplicar a staging ha
> aplicado también a lo que la suite gateada llama «tests». Conviene saberlo, no descubrirlo.

**Para staging no hay aplicador**: `aplicar-sql-dev.mjs` está atado por destino a
`yaqu_dev_javier` y muere si la clave apunta a otra cosa. Se replicaron sus garantías en un script
de un solo uso: ① el SQL pasa por **la lista blanca de la casa** (`ADD COLUMN ×1` → permitida; si
algo no lo fuera, para), ② el destino tiene que ser `railway`, ③ la cadena nunca se imprime.

---

## 4 · El ③ · los SEIS eslabones, cableados

| eslabón | dónde | qué se hizo |
| --- | --- | --- |
| ① esquema | `prisma/schema.prisma` | `internalRef String? @map("internal_ref")` |
| ② validación | `schemas.ts` | `z.string().max(120).nullable().optional()` |
| ③ escritura | `createCustomer` | **nada**: ya pasaba el body validado entero |
| ④ formulario | `customersView.js` | pinta · carga al editar · envía · **y se añade al DOM** |
| ⑤ **`select`** | `CUSTOMER_SELECT_NO_TOKEN` | `internalRef: true` |
| ⑥ **búsqueda** | el `OR` de `listCustomers` | `{ internalRef: { contains: search, mode: 'insensitive' } }` |

El ⑥ es el que distingue este ticket de no haberlo hecho: **sin él, la referencia vive donde ya
vivía** —en un campo que no se puede buscar— y el profesional no gana nada.

### El camino real, EJECUTADO contra `yaqu_dev_javier`

No leído: ejercitado de punta a punta, con el cliente de prueba borrado al terminar.

| | resultado |
| --- | --- |
| ① `createCustomer` devuelve `internalRef` | **OK** — el `select` no se la come |
| ② `getCustomer` la relee | **OK** — la pantalla no se recarga vacía |
| ③ **CONTROL POSITIVO**: buscar la referencia que EXISTE | **1 fila, y es la suya** |
| ④ buscar una que NO existe | **0 filas** |
| ⑤ buscar por NOMBRE sigue funcionando | **1 fila** — el `OR` nuevo no rompió lo anterior |

El ③ y el ④ juntos son el suelo: **un buscador que no devuelve nada nunca pasaría cualquier test
de «no devuelve lo que no toca»**.

### Las decisiones, fijadas por tests

* **Campo LIBRE**: sin `@unique` (dos clientes pueden compartir referencia — es un código ajeno y
  un choque dejaría a un profesional sin poder dar de alta a su cliente), sin `@default`, y sin
  `regex` en Zod. El `.max(120)` es un tope de almacenamiento, **no un formato**.
* **«Ausente ≠ vacío»**: el payload manda `null`, nunca `''`. Una cadena vacía diría «tiene
  referencia, y es nada».
* **Microcopy literal**, con el carácter `…` de un solo punto suspensivo, no tres.

### Medición en navegador, a 360 px

| | valor |
| --- | --- |
| rótulo «Referencia interna» | **103 px**, una línea |
| placeholder | **219 px** sobre **308** útiles — cabe |
| alto del input | **45 px** (≥ 44, AB6) |
| página scrollea en horizontal | **no** |
| orden en el modal | NIF/CIF → **Referencia interna** → Notas |

Va **justo encima de «Notas»** a propósito: es donde el profesional la metía por no tener sitio
propio, y ponerla encima es lo que hace que la próxima vez no acabe ahí.

---

## 5 · Lo que NO se ha hecho, y por qué

* **Producción NO se ha tocado.** La aplica el fundador. Desde un árbol de trabajo no hay acceso
  ni debe haberlo.
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
