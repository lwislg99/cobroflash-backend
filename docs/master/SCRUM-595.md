# SCRUM-595 · DOC-05 · Etiquetas del documento

**Fecha:** 7-sep-2026 · **Carril:** producto · **Tamaño:** S · Aprobado por el fundador el 24-ago-2026
**Rama:** `scrum-595-doc05-etiquetas-del-documento` · **Árbol:** `cobroflash-b20`
**Medido contra:** `origin/main` = `d271d29aff85ed155d23397b7e6a1fca64a86bb0` · 2026-09-07T16:56:51Z

**Tanda:** medida ANTES de tocar nada y DESPUÉS, con el **código de salida de verdad**, no con la
última línea:

| | tests | pass | fail | skipped | exit |
|---|---|---|---|---|---|
| antes (`origin/main`) | 5909 | 5807 | **0** | 102 | **0** |
| después | 5933 | 5831 | **0** | 102 | **0** |

**+24 tests, +24 pass, y los `skipped` no se mueven**: los 24 nuevos son exactamente los de este
ticket, y no se ha colado ninguno en SKIP silencioso.

**Estado:** ✅ **ENTREGADO ENTERO** — PASO 0, el `ALTER`, el esquema, el servidor y las dos
pantallas.

> ## ✅ EL BLOQUEO DE MERGE QUEDA LEVANTADO (8-sep-2026)
>
> Esta entrada llevó en mayúsculas **«NO MERGEABLE HASTA APLICAR LA COLUMNA EN STAGING Y
> PRODUCCIÓN»**, y **se retira por lo que se midió, no porque haya pasado el tiempo**: las
> **tres** casillas de `docs/MIGRATIONS_PENDING.md` están marcadas **con su procedencia**.
>
> | Base | Quién la sostiene |
> |---|---|
> | producción · `autorack` | **Verificación del fundador** — `jsonb` · `YES` · `default NULL`, 2 filas, con capturas |
> | staging · `acela/railway` | **Verificación del fundador** — mismo resultado |
> | desarrollo · `yaqu_dev_javier` | **Lectura del catálogo por la sesión** — re-ejecutable |
>
> Y los recuentos **cuadran con dev**: el fundador contó `quotes` 44 · `invoices` 36 en las dos,
> exactamente los números a los que llegó dev tras el ALTER (43→44 · 35→36).
>
> ⚠️ **El razonamiento del bloqueo NO se borra** —vive más abajo, en «EL ESQUEMA VIAJA CON ÉL»—:
> es el motivo por el que el orden importaba y vuelve a valer para la siguiente columna. Lo que
> caduca es su conclusión, no su lógica. Y sigue siendo cierto que **estas casillas las sostiene
> una verificación del fundador, no una medida mía**: esta sesión no ha tocado staging ni
> producción en ningún momento.

**Nota de proceso (7-sep-2026).** La primera pasada de este ticket entregó sólo el PASO 0 y el
`ALTER`, y **retuvo la línea del esquema** para no dejar en la rama algo que tumbara producción.
El fundador cerró esa ambigüedad con una regla: **cuando un ticket necesita columna nueva, el PR
lleva todo junto** —esquema, SQL, entrada en `MIGRATIONS_PENDING.md` con las tres bases sin marcar,
y el aviso en mayúsculas encabezando el PR—, porque retener el esquema produce media función y dos
PR por ticket, que es el patrón que costó los nueve días. El riesgo se gestiona con el **orden del
merge**, no reteniendo trabajo. Esta entrada queda reescrita con esa regla aplicada.

---

## La víctima

Hoy el profesional no puede etiquetar sus documentos de ninguna forma: no existe. Holded lo tiene
como «Etiquetas» en el bloque Categorización. Con 300 presupuestos, buscar por texto el nombre de
una obra no sustituye a filtrar por «garantía» o por «obra puerto».

**Alcance:** etiquetas **a nivel de documento**, en los **dos**: factura y presupuesto.
⛔ Las etiquetas **por concepto** (por línea) quedan **FUERA**, y este diseño **no las habilita de
rebote**: la columna cuelga del documento (`quotes.tags`, `invoices.tags`), no de la línea. Las
líneas viven dentro de `quotes.lines` (JSONB) y nada de lo entregado las mira. Para etiquetar un
concepto habría que meter la etiqueta **dentro** de ese JSON, que es otro ticket y otro mecanismo.

---

# 🔴 OBLIGACIÓN 0 · LA MEDICIÓN DEL MECANISMO DE CONT-07

CONT-07 (SCRUM-580) hace exactamente esto para clientes y está mergeado. Medido **antes de escribir
una línea**, fichero a fichero.

## Dónde vive

| Pieza | Fichero | Qué hace |
|---|---|---|
| la decisión, servidor | `src/modules/system/tagsDelCliente.ts` | `normalizarTags` · `tagsDe` · `tieneTag` · `tagsUsadas` · `LARGO_MAXIMO` · `MAXIMO_POR_CLIENTE` |
| la decisión, navegador | `public/dashboard/js/filtroClientes.js` | `tagsDe` · `mismaEtiqueta` · `etiquetasUsadas` · `filtrarPorEtiqueta` · `TEXTOS_ETIQUETAS` |
| el `Prisma.DbNull` | `customerAdmin.ts` · `normalizarEtiquetas` | traduce «sin etiquetas» a NULL de SQL |
| el quinto eslabón | `customerAdmin.ts` · `CUSTOMER_SELECT_NO_TOKEN` | `tags: true` — `select` **explícito** |
| la forma | `src/core/validation/schemas.ts:561` | `z.array(z.string()).nullable().optional()` |
| el almacén | `customers.tags` | **JSONB, nullable, sin default** |

## Cómo guarda

`null` = «no se declararon etiquetas»; `[]` = «se miraron y no hay ninguna». **No son lo mismo**, y
esa distinción es todo el diseño: con `[]` guardado, un `IS NOT NULL` diría que ese registro tiene
etiquetas y el filtro se construiría sobre esa mentira. `undefined` es un tercer valor y significa
«no toques este campo». Los tres se resuelven en `Prisma.DbNull` / valor / `undefined`.

## ¿Reutilizable tal cual, o atado a `Customer`?

**Medido función por función, no leído por encima:**

| Función | ¿Atada a `Customer`? | La medida |
|---|---|---|
| `normalizarTags(valor: unknown)` | **NO** | la firma es `unknown`; el cuerpo no nombra cliente |
| `tagsDe(cliente: unknown)` | **NO** | lee `.tags` de un `unknown`; sólo el **nombre del parámetro** dice «cliente» |
| `tieneTag` · `tagsUsadas` | **NO** | íd. |
| `normalizarEtiquetas<T extends { tags?: unknown }>` | **NO** — ya es genérica | pero es **privada**: no está exportada |
| `filtrarPorEtiqueta` · `etiquetasUsadas` · `tagsDe` (navegador) | **NO** en su lógica | **SÍ por vecindad**: conviven con las pestañas, las columnas y la selección de clientes |
| `MAXIMO_POR_CLIENTE` | el **nombre** sí | el número no |
| `tags: true` en `CUSTOMER_SELECT_NO_TOKEN` | **SÍ**, y es propio del cliente | cada documento tiene su propio quinto eslabón |

### 🔴 Y no se afirma: se EJECUTA

`tests/scrum595-etiquetas-del-documento.test.mjs` importa el módulo de CONT-07 **sin tocarlo** y lo
corre sobre un lote de **presupuestos y facturas**. Si la capa de decisión estuviera atada a
`Customer`, esos casos no podrían existir.

## ✅ LA SALIDA: **(b) SE GENERALIZA — y es pequeña justamente porque la decisión ya es reutilizable**

No es (a) «tal cual» porque tres cosas **sí** están atadas, y una de ellas de verdad:

1. **El `Prisma.DbNull` es privado.** `normalizarEtiquetas` vive dentro de `customerAdmin.ts` y no
   se exporta. El lado documento tendría que **volver a escribirla** — y ésa es exactamente la
   segunda copia que el ticket prohíbe: *«conviene que sea el mismo mecanismo, no dos.»*
2. **La pieza del navegador tiene mala dirección.** Para reutilizar `filtrarPorEtiqueta`, la lista
   de facturas tendría que cargar `filtroClientes.js` entero — arrastrando las pestañas
   `Todos/Empresas/Personas`, el selector de columnas y la selección múltiple de **clientes** a una
   pantalla que no es de clientes.
3. **Dos nombres mienten** en cuanto sirven a un documento: el fichero `tagsDelCliente.ts` y la
   constante `MAXIMO_POR_CLIENTE`.

### Qué hay que mover, y **qué se rompe al moverlo** — medido, no estimado

| Movimiento | Sitios que hay que tocar | Qué se rompe |
|---|---|---|
| `src/modules/system/tagsDelCliente.ts` → `src/core/etiquetas.ts` | **5**: 1 import (`customerAdmin.ts:6`), 1 import de test (`scrum580…:24`, ruta de `dist/`), 2 comentarios (`schemas.ts:561`, `filtroClientes.js:103`), la cabecera del propio fichero | nada de comportamiento; **1 test hay que reanclar** |
| exportar `normalizarEtiquetas` desde el módulo compartido | `customerAdmin.ts` deja de definirla y la importa | 🔴 **cae 1 guard de CONT-07**: el que exige `Prisma.DbNull` **en `customerAdmin.ts`**, porque el código se va a otro fichero. Se **reancla** al sitio nuevo (precedente: SCRUM-584 reanclando los guards de SCRUM-580), y queda MÁS apretado: se exige el `DbNull` donde vive y que `customerAdmin` siga pasando por la función compartida |
| `MAXIMO_POR_CLIENTE` → `MAXIMO_POR_FICHA` | 3 sitios (definición, uso, test) | 1 línea de test |
| sacar las 5 piezas de etiquetas de `filtroClientes.js` a su propia pieza | `filtroClientes.js` re-exporta para no cambiar su API | 🔴 el test de CONT-07 carga esa pieza con `new Function('window','module', src)` sobre un `window` **vacío**: hay que cargar **las dos** en el mismo `window` o se queda sin las funciones |

**Total: 4 ficheros de código y 2 de test, sin un solo cambio de comportamiento.**

### ⚠️ EL MOVIMIENTO SIGUE SIN EJECUTARSE — decisión del fundador, 7-sep-2026

El fundador hizo suyo el razonamiento y lo dejó fuera de este ticket: *«un módulo compartido con un
solo consumidor es un refactor sin motivo en main que además rompe guards cerrados»*. Así que
`tagsDelCliente.ts` **no se mueve, no se renombra y no se parte**, y las dos pantallas de documento
consumen `window.filtroClientes` tal cual — con el nombre que tiene, y dicho en el código.

**Lo que sí se ha hecho, porque el cableado lo exigía:** con el documento entran **dos escritores
nuevos**, y la traducción de «sin etiquetas» al lenguaje de Prisma dejaba de ser cosa de un fichero
para ser algo que **tres sitios** tienen que acertar. Estaba PRIVADA dentro de `customerAdmin.ts`.
Ahora es `tagsParaPrisma` en `tagsDelCliente.ts` —donde ya vive `normalizarTags`, que es quien
decide— y **los tres pasan por ella**.

🔴 Eso NO es el movimiento aplazado, y la diferencia se mide: **no rompe ni un guard**. Los 23 de
CONT-07 siguen en verde, incluido el que exige `Prisma.DbNull` en `customerAdmin.ts` —el tipo
`SinNullDeJs<T>` lo sigue nombrando ahí—. El coste declarado del movimiento era romper dos guards;
esto cuesta cero. Un test nuevo ata que los tres escritores usan la misma traducción.

Y sigue en pie el guard que hace que la generalización siga siendo la única salida: **`hay UNA sola
definición de normalizarTags en src/`**.

---

## ⚠️ EL AVISO DEL ENCARGO: ¿toca el sellado o el camino de emisión? **NO. MEDIDO.**

El encargo manda **PARAR** si generalizar exige tocar el sellado o el camino de emisión de la
factura. **No lo exige**, y la respuesta no es una impresión:

| Qué | Medida | Cómo se sostiene |
|---|---|---|
| **la huella** | `computeVeriFactuHash` es una lista **CERRADA de ocho campos** (NIF, serie, fecha, tipo, cuota, importe, huella anterior, timestamp) | **ejercitado**: la huella sale **idéntica** pasándole `tags`, y **sí** se mueve al cambiar el importe — el control negativo, para que la igualdad no sea la de una función que no mira nada |
| **el PDF** | los parámetros de `generateInvoicePdf` son una **lista blanca** y `tags` no está | guard estático **con suelo** (exige ver `number`, `qrData`, `vfHash`, `merchantId` en el trozo antes de negar nada) |
| **el camino de emisión** | `emitInvoice` no nombra `tags` | guard con suelo (`allocateInvoiceNumber` + `invoice.create`) |
| **el registro AEAT** | `registro.builder.ts` recibe **parámetros**, nunca el modelo Prisma | ningún modelo entra ahí |

### 🔴 Y la razón de fondo, que es la que decide

**Una etiqueta no se copia al emitir.** La escribe el profesional sobre la **ficha**, cuando quiere,
también años después. Por eso este ticket **no necesita un escritor en `emitInvoice`** — y ése fue
exactamente el bloqueo que dejó a **SCRUM-602 (DOC-12)** sin cablear el lado factura de la dirección
de obra:

> *«El escritor tendría que ir en `emitInvoice` […] Modificar el camino de emisión es STOP del
> fundador»* · *«Añadir el bloque al PDF de la factura […] cambiaría el aspecto de facturas ya
> emitidas (regla 29)»*

**Los dos bloqueos de DOC-12 no aplican aquí**, y por eso DOC-05 sí puede llegar a la factura donde
DOC-12 no pudo. La etiqueta no cambia el documento: cambia su ficha. Eso es lo que dice el ticket y
es lo que sostiene el diseño.

⚠️ Los tres guards **sólo LEEN** el camino de emisión. No extraen un helper, no exportan nada y no
cambian una firma: es lo que la **regla 38** permite hacer sin pedir GO, y es lo que separa un guard
de tocar el sellado.

---

# PASO 0 · EL CENSO

`node scripts/censo-etiquetas-del-documento.mjs` — **sólo lectura**, contra
`DATABASE_URL_DEV` → `acela.proxy.rlwy.net/yaqu_dev_javier`. `DATABASE_URL` **ausente** en este
árbol, comprobado antes con `scripts/comprobar-claves-bd.mjs` (regla 3). Staging y producción
quedan fuera del encargo y no se han tocado.

```
  (a) COLUMNAS DE ETIQUETAS
      quotes.tags   → AUSENTE
      invoices.tags → AUSENTE
      ✔ controles positivos presentes: customers.tags · quotes.lines

  (b) DOCUMENTOS EN ESTA BASE
      presupuestos: 15
      facturas: 5
      contexto (CONT-07): clientes con etiquetas declaradas = 0
```

**ENTRADA: no existe ninguna.** Ni campo, ni columna, ni filtro, en ninguno de los dos documentos.

### 🔴 El suelo, probado por MUTACIÓN

| Mutación | Resultado |
|---|---|
| se fuerzan **cero documentos** | **exit 2** · «CIEGO: NO HAY NI UN DOCUMENTO EN ESTA BASE» |
| se rompe el **control positivo** (la consulta deja de ver `customers.tags`) | **exit 2** · «la consulta NO estaba mirando esta base» |
| **restaurado** | **exit 0**, fichero **idéntico** al original (`diff` limpio) |

Los dos controles positivos son de **cosas distintas** a propósito: `customers.tags` acredita que se
mira una base donde el mecanismo de CONT-07 vive; `quotes.lines` acredita que la consulta alcanza la
tabla `quotes` y no sólo `customers`. Uno solo no distingue «no está» de «no se vio nada».

---

# 🛑 EL `ALTER` · ESCRITO Y **NO APLICADO**, Y VIAJA EN ESTE MISMO PR

**Fichero:** `docs/sql/scrum-595-etiquetas-del-documento.sql` ·
**Verificación:** `docs/sql/scrum-595-verificar.sql` · **Registro:** `docs/MIGRATIONS_PENDING.md`

```sql
ALTER TABLE "quotes"   ADD COLUMN IF NOT EXISTS "tags" JSONB;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "tags" JSONB;
```

**JSONB, nullable, sin default** — el **mismo tipo y la misma forma** que `customers.tags`. No es
simetría cosmética: si el documento guardara sus etiquetas de otra forma, no sería el mismo
mecanismo, sería el segundo. El esquema ya usa JSONB en cuatro sitios, así que no es patrón nuevo.

**LAS DOS TABLAS O NINGUNA.** Con una sola, el bloque funcionaría en un documento y no en el otro —
y eso el encargo lo declara **no hecho**. Un guard lo exige sobre el fichero, mirando **sólo lo
ejecutable**: el porqué de la cabecera nombra las dos tablas, y contarlas ahí daría verde con un DDL
que sólo toca una.

## ✅ APLICADO EN **DESARROLLO** (7-sep-2026) · staging y producción, del fundador

`node scripts/aplicar-sql-dev.mjs --file docs/sql/scrum-595-etiquetas-del-documento.sql --go`.
Esa herramienta **sólo acepta `DATABASE_URL_DEV`** y contrasta la clave contra su destino
DECLARADO —host **y** nombre de base, porque staging y dev comparten host— antes de abrir nada:

```
[destino] DATABASE_URL_DEV → acela.proxy.rlwy.net/yaqu_dev_javier (DESARROLLO) ✅
```

Ensayo primero (sin `--go`, no toca nada), y sólo entonces la aplicación.

### 🔴 ANTES Y DESPUÉS, CON RECUENTO DE COLUMNAS Y UN TESTIGO

Una fila sin estado de partida **no distingue «la he creado» de «ya estaba»**.

| Tabla | ANTES | DESPUÉS | |
|---|---|---|---|
| `quotes` | **43** | **44** | +1 · la toca el ALTER |
| `invoices` | **35** | **36** | +1 · la toca el ALTER |
| `customers` | **27** | **27** | **TESTIGO — no debía moverse, y no se movió** |

| Columna | ANTES | DESPUÉS |
|---|---|---|
| `quotes.tags` | **AUSENTE** | `jsonb` · nullable=YES · default=NINGUNO |
| `invoices.tags` | **AUSENTE** | `jsonb` · nullable=YES · default=NINGUNO |
| `customers.tags` · `quotes.lines` | presentes | presentes — **controles positivos** |

**El tipo salió `jsonb` en las dos**, que es lo que de verdad había que comprobar: `schemaDrift`
mira que la columna exista, **no su tipo**. Y **sin default**, que es lo que sostiene «ausente ≠
vacío».

⚠️ **Honestidad sobre el recuento de FILAS:** entre el antes y el después pasó de 16 a 15
presupuestos. **No lo hizo este ALTER** —un `ADD COLUMN` no borra filas—: la base de desarrollo la
comparten varios árboles y otra sesión estaba tocándola. Se dice, en vez de dejar un número que no
cuadra sin explicación.

⛔ **Staging y producción: pendientes, y no se han tocado.** Desde un árbol de trabajo no hay
credencial de producción (regla 3) y el turno de staging no se toma para esto.

---

# ✅ LA PRIMERA PASADA REAL · por el camino de verdad

`node scripts/pasada-real-etiquetas-del-documento.mjs` — levanta la app de verdad, se autentica
como el merchant demo y usa **las rutas HTTP que usa el dashboard**. Hasta aquí el ticket estaba
probado sobre MECANISMO, no sobre USO: un guard que lee el árbol no distingue «esto funciona» de
«el código dice que funcionaría».

**Documentos reales:** presupuesto **#356** y factura **2026-FG-005** (id 238), del merchant demo.
Los dos partían de `tags = null`.

```
1 · SE GUARDA
  ✅ PUT /admin/quotes/356/tags → 200
  ✅ PUT /admin/invoices/238/tags → 200

2 · SE RELEE (el quinto eslabón, y aquí es donde se pierde en silencio)
  ✅ la LISTA de presupuestos las devuelve: ["obra puerto","garantía"]
  ✅ el DETALLE del presupuesto las devuelve: ["obra puerto","garantía"]
  ✅ la LISTA de facturas las devuelve: ["obra puerto"]
  ✅ el DETALLE de la factura las devuelve: ["obra puerto"]

3 · 🔴 EL CONTROL: se filtra por la etiqueta y salen LOS DOS
  ✅ filtrando por «obra puerto» sale el PRESUPUESTO #356  (1 de 12)
  ✅ filtrando por «obra puerto» sale la FACTURA 2026-FG-005  (1 de 5)
  ✅ sin etiqueta seleccionada, las dos listas salen ENTERAS (el positivo)

4 · 🔴 REGLA 29: etiquetar una factura emitida no la cambia
  ✅ number: "2026-FG-005" → SIN CAMBIO
  ✅ total: "2383.7" → SIN CAMBIO
  ✅ pdfUrl: "PENDING_PDF" → SIN CAMBIO
  ✅ vfHash: null → SIN CAMBIO
  ✅ qrData: "PENDING_QR" → SIN CAMBIO
  ✅ status: "pending" → SIN CAMBIO
  ✅ y la etiqueta SÍ está guardada: la invariancia de arriba no es la de un no-op

5 · la validación no deja borrar por accidente
  ✅ un cuerpo mal formado → 400
  ✅ y las etiquetas SIGUEN ahí tras el 400: el suelo no las borró
  ✅ un id que no existe → 404, no un `ok` sobre cero filas

↩ restaurado: presupuesto.tags=null · factura.tags=null

✅ PASADA REAL COMPLETA, 0 fallos.
```

**La base queda como estaba**: el script guarda el valor previo y lo restaura en un `finally`,
pase lo que pase, y lo reimprime al final para que no haya que creérselo.

### 🕳️ Y LO QUE ESTA PASADA **NO** PRUEBA, medido

🔴 **En desarrollo hay CERO facturas selladas** (`vfHash` no nulo) y **cero con PDF pintado** —
contado, no supuesto—. Así que en la tabla de arriba el «SIN CAMBIO» de `vfHash` y `pdfUrl` es
**trivialmente cierto**: eran `null` y `PENDING_PDF` antes y después. No se disimula.

Lo que SÍ cubre el sello es más fuerte que comparar una fila: el test **ejercita
`computeVeriFactuHash`** pasándole `tags` y la huella sale idéntica, **y sí se mueve al cambiar el
importe** (control negativo). Y el PDF lo cubre la lista blanca de `generateInvoicePdf`. Etiquetar
una factura **sellada** de verdad queda sin ejercitar hasta que exista una — en staging o en
producción, y eso es del fundador.

### 🔴 EL TIPO NO ESTÁ ADIVINADO

Lo generó `node scripts/preview-migracion.mjs --desde` —o sea `prisma migrate diff` sobre el
esquema viejo sacado de `origin/main`—, con **control positivo** (la herramienta respondió y vio 27
tablas) y **veredicto aditivo**: ni DROP, ni RENAME, ni TRUNCATE, ni DELETE, ni SET NOT NULL.

```
-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "tags" JSONB;
-- AlterTable
ALTER TABLE "invoices" ADD COLUMN   "tags" JSONB;
```

Importa porque **`schemaDrift` comprueba que la columna EXISTA, no su tipo**: un `tags` creado como
TEXT arrancaría en verde y se pudriría semanas después, al guardar un array y leerlo como cadena.

### 🔴 EL ESQUEMA VIAJA CON ÉL, Y EL RIESGO LO GESTIONA EL ORDEN DEL MERGE

`prisma/schema.prisma` **sí nombra** `tags` en `Quote` y en `Invoice` en esta rama, con su
comentario y su porqué. Lo que no puede pasar es el **merge** antes del `ALTER`: `schemaDrift`
compara esperado ⊆ real al arrancar y producción no levantaría. De ahí el aviso que encabeza el PR.

Un guard lo vigila por los dos lados y **con control positivo** —sabe ver el `tags` que sí está en
`Customer`, así que lo que diga de los documentos significa algo—: exige que el esquema nombre la
columna en los DOS modelos **y** que el DDL cree esa tabla. Un esquema que nombre algo que su
propio SQL no crea es exactamente lo que tumba el arranque.

**Derivados regenerados, no editados a mano:** `docs/sql/deriva-prod.sql` pasa de **426 a 428
columnas** (las dos nuevas, sin tablas nuevas) con `node scripts/generar-sql-deriva.mjs`, y el
cliente de Prisma con `npm run prisma:generate` — nunca `npx`.

---

# ✅ LOS CUATRO CONTROLES DEL ENCARGO

`tests/scrum595-etiquetas-del-documento.test.mjs` — **14 casos, 14 en verde, exit 0.**

### 🔴 EL CONTROL QUE DECIDE

Se etiqueta un **presupuesto** y una **factura**, se filtra por esa etiqueta, y **salen los dos**.
No se comprueba «salen dos filas» —dos presupuestos también serían dos— sino que sale **uno de cada
tipo**. El lote no está ordenado por id ni agrupado por tipo, para que «sale uno de cada» no pueda
cumplirse por el orden en que se escribió la lista.

### ✅ EL POSITIVO

Sin etiqueta seleccionada la lista sale **entera y en el mismo orden**, con `null`, `undefined`,
`''` y `'   '`; y el filtro **no muta** el lote que le llegó del servidor. Un documento sin
etiquetas **no cae en ninguna**, y es correcto: el apaño de «si no tiene, que salga en todas»
convierte el filtro en un adorno.

### 🔴 EL DE LA REGLA 29

Ejercitado, no supuesto: la huella no se mueve con `tags` y **sí** se mueve con el importe; el PDF y
la emisión no pueden recibirlas.

### 🔴 EL SUELO

El censo se declara ciego si no encuentra ni un documento — probado por mutación arriba, y con un
guard estático para que nadie retire el suelo sin darse cuenta.

## Los rojos, probados ROMPIENDO el mecanismo

| Mutación inyectada | Qué cayó |
|---|---|
| el mecanismo **ignora las facturas** (sólo funciona en un documento) | **2**: el control que decide y «servidor y navegador deciden lo mismo» |
| «no filtrar» pasa a **reordenar** la lista | el positivo del orden |
| `tags` entra en la **huella** de VeriFactu | **2**: la huella y «ni el sellado ni el registro nombran etiquetas» |
| `tags` entra en los **parámetros del PDF** de la factura | el guard del PDF |
| el **camino de emisión** escribe `tags` | el guard de la emisión |
| el **esquema se adelanta** al `ALTER` (`tags` en `Quote`) | el guard del orden |
| el **DDL** se queda sólo con `quotes` | el guard de las dos tablas |
| aparece una **segunda** `normalizarTags` | el guard del mecanismo único |
| la lista de presupuestos deja de **proyectar `tags`** (el quinto eslabón) | el guard del defecto mudo |
| `setInvoiceTags` escribe **además otro campo** | el guard del «un solo campo» (regla 29) |
| la lista de facturas se queda **sin filtro** (sólo funciona en un documento) | el guard de las dos listas |
| el campo de la ficha **estrena un placeholder** | el guard de «ni un literal nuevo» |
| una revisión **deja de heredar** las etiquetas | **2**: el de este ticket y el de SCRUM-655b |
| vuelve un **`colSpan` a mano** en la lista de facturas | el guard del vacío descuadrado |
| **control negativo** · se cambia sólo un comentario | **nada** |

Restaurado todo tras cada una, y comprobado. En la primera vuelta —cuando el esquema todavía no
entraba— `prisma/schema.prisma` quedó verificado **byte a byte** con `git diff --quiet` después de
mutarlo.

🔴 **Y cada mutación se comprueba PRESENTE en el fichero antes de correr nada** (`grep` sobre una
huella propia). Es obligatorio desde esta sesión, y sale de aquí mismo: ver abajo.

### ⚠️ Y una lección de esta misma sesión, porque casi cuela

La primera pasada de la mutación de la huella dio **verde** — y no porque el sello fuera inmune:
porque la sustitución **falló en el shell y la mutación nunca llegó al fichero**. Un rojo que no
sale acusa al test, y aquí el acusado era inocente. Desde entonces cada mutación se **comprueba
presente en el fichero** (`grep`) antes de correr nada. Es la misma familia que el aviso del
encargo sobre `| tail`: el instrumento que no mide se lee igual que el verde.

---

## LO CONSTRUIDO · el cableado, documento por documento

| # | Eslabón | Presupuesto | Factura |
|---|---|---|---|
| 1 | se escribe | `etiquetasDelDocumento.js` en la ficha | **la MISMA pieza** en su ficha |
| 2 | se envía | `{ tags: […] }` o `null` — nunca `[]` | íd. |
| 3 | se valida | `PUT /:id/tags` rechaza lo que no sea lista ni `null` | íd. |
| 4 | se guarda | `setQuoteTags` → `tagsParaPrisma` | `setInvoiceTags` → `tagsParaPrisma` |
| 5 | **SE RELEE** | 🔴 `listQuotesAdmin` **y** `getQuoteDetailAdmin`, las DOS a mano | ✅ sale sola: `findMany` sin `select` |
| 6 | se filtra | selector + columna en la lista | selector + columna en la lista |

### 🔴 EL QUINTO ESLABÓN NO ES SIMÉTRICO, y estaba localizado ANTES de construir

En la **factura** no hay nada que hacer: `listInvoicesAdmin` devuelve `findMany` sin `select` al
nivel del documento y el detalle hace `{...invoice}`, así que la columna sale sola. Hay un guard
que cae si alguien le pone un `select` explícito, porque desde ese momento habría que acordarse.

En el **presupuesto** hay **DOS** proyecciones escritas a mano —la lista y el detalle— y las dos
había que tocarlas. Sin ellas el defecto es el de SCRUM-580 palabra por palabra: el profesional
escribe la etiqueta, la pantalla se recarga sin ella, la reescribe, **y la tanda sigue verde
porque el dato SÍ está en la base**. Los dos sitios tienen su guard, con suelo.

### 🔴 LA TRADUCCIÓN DEL NULL, EN UN SOLO SITIO PORQUE AHORA SON TRES ESCRITORES

`tagsParaPrisma` (en `tagsDelCliente.ts`, junto a `normalizarTags`, que es quien decide). Los tres
—cliente, presupuesto y factura— pasan por ella, y un test lo ata. Con la elección repartida, uno
de los tres acabaría escribiendo `Prisma.JsonNull`, que **no deja la columna en NULL**: guardaría
el valor JSON `null` dentro y un `IS NOT NULL` diría que ese documento tiene etiquetas. Es
«ausente ≠ vacío» con otro nombre.

### La UI, según la casa

`.badge .badge-slate` para los chips — el componente que **ya está en el inventario (AB3)**: cero
tokens nuevos, cero estilo inventado. `textContent` por etiqueta y nunca `innerHTML`: la escribe
el profesional. Un campo separado por comas y **no** un editor de chips, que sería componente nuevo
y por tanto propuesta de inventario. La columna nace `col-hide-mobile`, como sus vecinas.

🔴 **Y los dos `colSpan` de los vacíos dejan de ser números a mano.** Había un `7` y un `6`
escritos, y este ticket mete una columna en cada lista: ahora salen de `numeroDeColumnas()`, que
cuenta el `thead`. Un vacío descuadrado no lo ve ninguna tanda — es la lección de SCRUM-584, que
tuvo que arreglar exactamente esto en la lista de clientes cuando entró la columna de CONT-07.

### 🔴 DOS GUARDS AJENOS CAYERON, Y LOS DOS TENÍAN RAZÓN

Ninguno se relajó: los dos ofrecían una vía de DECLARACIÓN y se usó esa.

**1 · `SCRUM-655b` — «TODO campo de Quote está clasificado».** Una columna nueva de `Quote` nace
sin clasificar, y sin clasificar **no viaja a la revisión**. Decidido: **HEREDA**, con el
precedente de `internalNotes` (metadato del profesional que no sale en el papel). El defecto que
evita es mudo: sin heredar, revisar un presupuesto lo **saca del filtro** «obra puerto» y el
profesional ve una lista con un documento menos, sin forma de saber que le falta. Heredar es
reversible; no heredar no lo es. ⚠️ Clasificar no es que viaje, y aquí no hay viaje que probar:
`nuevaRevisionDe` **sigue sin llamador** (SCRUM-688 abierto).

**2 · `SCRUM-124` — «ninguna mutación destructiva de facturas».** `PUT /:id/tags` es el **primer
miembro del allowlist que no es un cambio de estado**, así que se declara despacio. Que no sea
edición de contenido está MEDIDO —huella, PDF y emisión, los tres—, y la entrada **no ensancha la
protección neta**: a cambio, este ticket ata que `setInvoiceTags` escribe **un solo campo**. La
lista crece en una ruta; lo que esa ruta puede escribir queda más apretado que antes.

**Y tres registros más hubo que declarar** para el script nuevo, porque esta casa los tiene: el
`SHELL` de `public/sw.js` (sin él, la primera visita sin cobertura se queda sin el bloque y **con
red no se nota**), la lista de scripts del dashboard y las **cinco** dependencias de orden de carga
en `_banco-vistas.mjs`.

**3 · `SCRUM-662` — y este obligó a TOCAR LA ASERCIÓN de un guard ajeno, así que se dice fuerte.**
Su auto-test movía la primera dependencia declarada detrás de su consumidor y exigía **exactamente
una** rota. Eso era cierto mientras cada pieza tenía UN consumidor; al declarar las cinco de este
ticket, `filtroClientes.js` pasa a tener varios y moverlo rompe **dos**. El detector estaba
funcionando, no fallando.

🔴 **No se relajó nada.** Lo que el caso afirma —«se detecta, y nombrando los dos»— sigue igual; lo
que se retiró es una aritmética incidental que este ticket falsificó. Y queda **más apretado**: se
exige además que el detector **no invente** ninguna, o sea que todo lo que reporte cuelgue del
fichero movido. Comprobado por mutación sobre el índice REAL —cargando `filtroClientes.js` después
de `invoicesView.js`— y caen dos guards, el de SCRUM-662 y el de este ticket.

### Lo que queda fuera, dicho

- El **placeholder** del campo — ver microcopy, abajo. Es del fundador.
- La **generalización** de `tagsDelCliente.ts`, aplazada por el fundador (arriba).
- El viaje de `tags` en `nuevaRevisionDe`, que no tiene llamador (SCRUM-688).

### Los eslabones, para quien siga

| # | Eslabón | Presupuesto | Factura |
|---|---|---|---|
| 1 | se escribe | editor / lista | lista y detalle |
| 2 | se envía | payload → `null` si no hay ninguna | íd. |
| 3 | se valida | `schemas.ts` · `z.array(z.string()).nullable().optional()` | íd. |
| 4 | se guarda | `normalizarEtiquetas` compartida (`Prisma.DbNull`) | íd. |
| 5 | **SE RELEE** | 🔴 `listQuotesAdmin` **proyecta a mano** un objeto explícito: sin añadir `tags` ahí, el alta se guarda y la lista devuelve el documento sin ellas, **y la tanda sigue verde** | ✅ `listInvoicesAdmin` devuelve `findMany` **sin `select`**, y el detalle hace `{...invoice}`: la columna sale sola |

🔴 **El quinto eslabón NO es simétrico, y está localizado antes de construir** — que es lo que el
encargo pedía. En la factura no hay nada que hacer; en el presupuesto sí, y es exactamente el
defecto mudo de SCRUM-580: el dato **sí** estaría en la base.

**Las dos rutas nuevas**, una por documento, copiando la forma de `PUT /:id/notes` —el metadato de
documento que ya existía—: verbo, acotadas por `:id`, tenencia en el `WHERE` (regla 2) y nada más.
Un id ajeno no escribe y devuelve **404**, no un `ok` sobre cero filas.

- `PUT /admin/quotes/:id/tags`
- `PUT /admin/invoices/:id/tags` — nunca en `POST /` ni en `emitInvoice`. El guard de SCRUM-289b
  prohíbe `update`/`delete` en el **entrypoint de alta** y `patch`/`put`/`delete` sobre la
  **colección**; una ruta por `:id` no lo toca, y es donde ya viven `rectify` y `annul`.

⚠️ **Las dos llevan `requireRole('admin')`, y es una elección que se declara.** `/notes` no lo lleva
y todas las escrituras de `invoicesAdmin` sí: se ha tomado **el gate más cerrado de los dos**,
porque el mismo bloque con dos permisos según el documento sería una asimetría que nadie decidió.
Si el fundador quiere que el técnico etiquete, es **quitar** un gate —reversible y visible— y no
añadirlo después.

🔴 **Y la validación es ESTRICTA en las dos**: un cuerpo que no traiga lista ni `null` da **400**.
`normalizarTags` convierte en `null` cualquier cosa que no sea lista —su suelo, correcto para un
formulario—, pero en estas rutas ese suelo **borraría las etiquetas y devolvería `ok`**.

---

## ⛔ MICROCOPY · CERO LITERALES NUEVOS, Y UNA RANURA DESCRITA SIN ESCRIBIR

Regla 30. **Hay pantalla y aun así no hay ni un texto nuevo.** Lo que se pinta sale de sitios que
ya estaban aprobados y se lee de la pieza, nunca copiado:

| Ranura | Texto | De dónde sale |
|---|---|---|
| rótulo del bloque en la ficha | `Etiquetas` | `TEXTOS_ETIQUETAS.rotulo` (CONT-07) |
| cabecera de columna, las dos listas | `Etiquetas` | `TEXTOS_ETIQUETAS.columna` (CONT-07) |
| opción «sin filtro», los dos selectores | `Todas las etiquetas` | `TEXTOS_ETIQUETAS.sinFiltro` (CONT-07) |
| los tres avisos de guardado | `Escribiendo…` · `✓ Guardado automáticamente` · `Error al guardar` | el bloque de **notas internas**, que ya los pinta hoy |

Misma palabra para la misma cosa: **cero ranuras nuevas**, así que **`SIN_APROBAR` se queda en 7**
y no se ha tocado. Un test fija que ninguna vista repite esos literales a mano —una segunda copia
deriva y deja de estar aprobada sin que nadie lo decida— y que los tres avisos siguen existiendo
en el bloque de notas: si desaparecieran de allí, este fichero habría pasado de reutilizar a
estrenar sin que nada chillara.

### 🔴 LA ÚNICA RANURA NUEVA: EL PLACEHOLDER. DESCRITA Y **NO ESCRITA**

El campo de la ficha **sale sin placeholder**, y no es un olvido: el de CONT-07
(`comunidad, administrador, urgencias…`) nombra ejemplos de **CLIENTE**, y en un documento los
ejemplos son otros —una obra, una garantía, una urgencia—. Escribir ese texto sería estrenar
microcopy, y el microcopy es del fundador.

**Lo que hace falta, descrito:** una ranura, en el campo de etiquetas de la ficha de documento,
que sugiera con ejemplos qué se escribe ahí; en el mismo tono que la de cliente y del mismo
tamaño (36 caracteres cabían). **Aquí se para.** Un guard exige que ese campo siga sin
`placeholder` hasta que exista un literal firmado — si alguien le pone uno, cae.

---

## 🕳️ Huecos declarados

1. 🔴 **Nada se ha ejercitado contra una base con la columna, porque la columna no existe todavía.**
   El `ALTER` está escrito y **sin aplicar**: lo aplica el fundador antes de mergear. Todo lo
   verificado es mecanismo puro más lecturas del árbol, y eso incluye el cableado nuevo: compila,
   sus guards pasan, y **nadie ha guardado una etiqueta de verdad en un documento**. La primera
   pasada real es del fundador tras aplicar.
2. **El control que decide se ejerce sobre el MECANISMO, no de extremo a extremo.** Filtra un lote
   de presupuestos y facturas y salen los dos; que salgan de la **base** por la **pantalla** es del
   ③ y no se puede probar hoy. Se dice en vez de dejarlo entender de otra forma.
3. **Ninguna medición en navegador.** No hay pantalla que medir todavía; cuando la haya, la caja del
   selector en las dos listas hay que medirla a 360 px en un navegador real, no contando caracteres.
4. **Staging y producción no se han medido**, por encargo. El censo de arriba es de **desarrollo**.
5. **La generalización está especificada y no ejecutada** (ver arriba el porqué). Los números de
   sitios a tocar son de hoy y **caducan** si alguien mueve esos ficheros: se recuentan con
   `grep -rn tagsDelCliente`.
