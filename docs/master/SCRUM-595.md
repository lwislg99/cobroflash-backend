# SCRUM-595 · DOC-05 · Etiquetas del documento

**Fecha:** 7-sep-2026 · **Carril:** producto · **Tamaño:** S · Aprobado por el fundador el 24-ago-2026
**Rama:** `scrum-595-doc05-etiquetas-del-documento` · **Árbol:** `cobroflash-b20`
**Medido contra:** `origin/main` = `d271d29aff85ed155d23397b7e6a1fca64a86bb0` · 2026-09-07T16:56:51Z

**Tanda:** medida ANTES de tocar nada y DESPUÉS, con el **código de salida de verdad**, no con la
última línea: **5909 tests · 0 fail · 102 skipped · exit 0** en las dos.

**Estado:** ✅ **PASO 0 y PASO ② entregados.** ⛔ **El ③ está BLOQUEADO por el ②** y el motivo no
es de tiempo: el orden es inviolable y el `ALTER` no es mío. Ver «Lo que NO se ha construido».

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
corre sobre un lote de **presupuestos y facturas**. Los 14 casos pasan. Si la capa de decisión
estuviera atada a `Customer`, esos casos no podrían existir.

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

### ⚠️ Pero el movimiento va CON su consumidor, en el ③ — y no antes

**No se ha ejecutado en esta sesión**, y es una decisión, no un olvido. El consumidor del módulo
compartido es el lado documento, y el lado documento **no se puede construir hasta que el `ALTER`
esté aplicado** (abajo). Un módulo compartido con **un solo** consumidor es un refactor sin motivo
en `main`, que además rompe dos guards de un ticket cerrado para habilitar algo que todavía no
existe. Esta casa ya escribió la regla en SCRUM-581: *«no se ha construido preparado por si acaso»*.

Lo que sí queda en `main` desde hoy es el **guard que hace que esa generalización siga siendo la
única salida**: `hay UNA sola definición de normalizarTags en src/`. El día que el ③ escriba una
segunda normalización «porque la de hoy se llama `tagsDelCliente`», el guard cae.

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

# 🛑 PASO ② · EL `ALTER`, ESCRITO Y **NO APLICADO**

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

⛔ **No se ha aplicado en ninguna base, y no se ha intentado.** Ni producción, ni staging, ni
desarrollo. Lo aplica el fundador.

### 🔴 `prisma/schema.prisma` NO SE HA TOCADO, y es deliberado

`schemaDrift` compara **esperado ⊆ real** al arrancar: una rama cuyo esquema nombre `tags` en
`Quote` o `Invoice` **impide arrancar producción** mientras el `ALTER` no esté. Es la secuencia que
costó nueve días sin desplegar (SCRUM-580). Hay un guard que lo vigila —con control positivo: sabe
ver el `tags` que **sí** está en `Customer`, así que su «no está» en los documentos significa algo—
y **se invierte en el ③**, cuando las tres bases tengan la columna.

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
| **control negativo** · se cambia sólo un comentario | **nada** |

Restaurado todo: `git status` sin una sola modificación rastreada, y `prisma/schema.prisma`
verificado **byte a byte** con `git diff --quiet`.

### ⚠️ Y una lección de esta misma sesión, porque casi cuela

La primera pasada de la mutación de la huella dio **verde** — y no porque el sello fuera inmune:
porque la sustitución **falló en el shell y la mutación nunca llegó al fichero**. Un rojo que no
sale acusa al test, y aquí el acusado era inocente. Desde entonces cada mutación se **comprueba
presente en el fichero** (`grep`) antes de correr nada. Es la misma familia que el aviso del
encargo sobre `| tail`: el instrumento que no mide se lee igual que el verde.

---

## Lo que NO se ha construido, y por qué

**Todo el ③**: el esquema, el `select`/proyección de cada documento, la normalización en servidor,
las rutas, el campo en el editor, la columna en las dos listas y el selector de filtro.

**No por falta de tiempo: porque el orden es inviolable y el ② no es mío.** Construirlo ahora
significaría dejar en la rama un esquema que tumba producción si alguien la mergea antes del
`ALTER`. Es literalmente lo que hizo CONT-07 en su día, y por lo mismo.

### El ③, especificado para quien lo tome — con los eslabones ya localizados

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

**Además, para el ③:**

- El escritor de la factura va en una ruta **propia** (`PUT /admin/invoices/:id/tags`), nunca en
  `POST /` ni en `emitInvoice`. El guard de SCRUM-289b prohíbe `update`/`delete` en el **entrypoint
  de alta** y prohíbe `patch`/`put`/`delete` sobre la **colección** — una ruta por `:id` no lo
  toca, pero conviene saber que ese guard existe y qué vigila exactamente.
- La generalización de arriba (4 ficheros de código, 2 de test) va **con** ese cableado.

---

## ⛔ MICROCOPY · NO SE PROPONE NINGÚN LITERAL NUEVO, Y SE PARA

Regla 30. **Cero literales nuevos en lo entregado**: no hay pantalla, así que no hay texto.

Para el ③ hay que decidir algo que **es del fundador y no de la sesión**, y se describe sin
construirlo: CONT-07 ya tiene cuatro ranuras aprobadas por el **asesor** en `TEXTOS_ETIQUETAS`
(rótulo `Etiquetas`, cabecera `Etiquetas`, placeholder `comunidad, administrador, urgencias…`,
sin filtro `Todas las etiquetas`). Las dos primeras y la cuarta **se reutilizarían tal cual** —
misma palabra, mismo mecanismo, cero ranuras nuevas—. **El placeholder no vale**: nombra ejemplos
de *cliente* («comunidad, administrador»), y en un documento los ejemplos son otros. Ese texto es
**una ranura nueva**, es del fundador, y **aquí se para**: se describe la necesidad y no se escribe
el literal.

Si el fundador decide que el documento merece sus **propias** cuatro ranuras en vez de reutilizar
las del cliente, `SIN_APROBAR` sube — hoy vale **7** y no se ha tocado.

---

## 🕳️ Huecos declarados

1. **Nada se ha ejercitado contra una base con la columna.** No existe: el `ALTER` está escrito y
   sin aplicar. Todo lo verificado es mecanismo puro, más lecturas del árbol.
2. **El control que decide se ejerce sobre el MECANISMO, no de extremo a extremo.** Filtra un lote
   de presupuestos y facturas y salen los dos; que salgan de la **base** por la **pantalla** es del
   ③ y no se puede probar hoy. Se dice en vez de dejarlo entender de otra forma.
3. **Ninguna medición en navegador.** No hay pantalla que medir todavía; cuando la haya, la caja del
   selector en las dos listas hay que medirla a 360 px en un navegador real, no contando caracteres.
4. **Staging y producción no se han medido**, por encargo. El censo de arriba es de **desarrollo**.
5. **La generalización está especificada y no ejecutada** (ver arriba el porqué). Los números de
   sitios a tocar son de hoy y **caducan** si alguien mueve esos ficheros: se recuentan con
   `grep -rn tagsDelCliente`.
