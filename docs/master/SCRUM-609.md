# SCRUM-609 · CAT-01 · La tabla real, medida — y qué hacer con el IVA guardado (P-DOC-8)

**Fecha:** 01-sep-2026 · **Carril:** medición y propuesta · **Gate:** sin gate — no entra código

**Medido contra:** `origin/main` = `f7fabacb19eb9b0223dac46ae40c996cd3a8cf00` · 2026-09-01T15:31:30+01:00

**No se ha construido nada:** ni el switch, ni el autocompletado, ni migración. `prisma/schema.prisma`
intacto. Esto mide y propone, que es lo que pedía el encargo.

---

## 🔴 LO PRIMERO, PORQUE CAMBIA CÓMO SE LEE TODO LO DEMÁS

**La tabla que el ticket describe está en PRODUCCIÓN, y desde un árbol de trabajo no se puede
medir** (regla 3: no hay credencial de producción aquí y no la puede haber).

**«Discos de freno» —la fila que el ticket cita como ejemplo de IVA vacío— NO EXISTE en ninguna de
las dos bases alcanzables.** Lo que sí he medido:

| base | productos |
|---|---|
| `acela.proxy.rlwy.net/railway` (STAGING) | **0** — tabla vacía |
| `acela.proxy.rlwy.net/yaqu_dev_javier` (DESARROLLO) | **8**, todos de fontanería, sembrados |

Así que los números de abajo son ciertos y son **de una población que no es la del ticket**. Lo digo
antes de darlos para que nadie los lea como si fueran el catálogo del profesional que abrió CAT-01.

---

## Los cuatro números (a)-(d), sobre las 8 filas de desarrollo

### (a) La tabla entera
**8 productos · 8 activos · 0 inactivos.**

### (b) El IVA
**0 con valor · 8 vacíos.** Valores distintos: **ninguno**.

### (c) Coste y precio
**0 con coste · 8 sin coste. 8 con precio > 0.**
→ **Margen derivable (coste Y precio): 0 de 8.**

### (d) ¿Producto o servicio? **NO SE PUEDE DERIVAR.**

No hay columna, y **tampoco hay señal**. Medido el cruce de lo único que la tabla tiene y podría
correlacionar:

| | con coste | sin coste |
|---|---|---|
| **con proveedor** | 0 | 0 |
| **sin proveedor** | 0 | **8** |

Las ocho son **idénticas en todos los campos estructurales**: sin proveedor, sin coste, sin IVA. Lo
único que las distingue es **el nombre**, que es texto libre («Desatasco de tubería», «Mano de obra
(hora)»). Derivar la clasificación de ahí sería inventarla.

> **La migración NO PUEDE CLASIFICAR. Hay que preguntárselo al profesional.**

Y eso cambia el ticket: el switch no puede nacer con un lado preseleccionado. El patrón correcto es
el que ya existe y ya se decidió en CONT-01 — **`contactKind` nullable, sin `@default`, y con
NINGUNO de los dos lados marcado mientras nadie lo declare**. Aquí aplica igual.

---

## 🔴 EL CONTROL POSITIVO DEL CENSO, que aquí no es un adorno

Mi propio suelo saltó: **un barrido que no encuentra ningún IVA no está midiendo IVA**, y el mío
devolvió cero. Así que el cero hubo que probarlo, no publicarlo.

Se comprobó **por SQL crudo, sin que Prisma mapeara nada, y sobre las MISMAS filas**:

```
recuento por SQL CRUDO: [{"filas":8,"con_price":8,"con_cost":0,"con_vat":0}]
muestra cruda: [{"id":1,"price":"65","cost":null,"vat":null}, …]
la columna EXISTE en la BD: vat numeric YES · cost numeric YES · price numeric NO
```

**El lector no está ciego:** en la misma consulta y las mismas filas lee **8 precios**. Que `vat` y
`cost` vengan a cero es **del dato**, no del instrumento.

---

## De dónde sale el IVA guardado — el censo que decide P-DOC-8

Esto es lo que hace que la pregunta tenga respuesta, y no estaba medido. **Tres caminos escriben
`vat`, y no son equivalentes:**

| camino | qué escribe | ¿lo decidió el profesional? |
|---|---|---|
| `POST /admin/products/load-catalog` (onboarding por gremio) | **`getLocale(country).defaultVat`** → **0,21 para ES** | **NO.** Lo escribe el sistema |
| `POST /admin/products` (alta manual) | lo que el usuario teclee en «IVA (0..1)», o `null` si lo deja vacío | sí |
| `importProductsCsv` | la columna `vat` del CSV, `null` si falta o viene vacía | sí, si la puso |

🔴 **La consecuencia, y es la que cambia la decisión:** para todo producto cargado por el catálogo de
gremio, **ese 0,21 no es la decisión de nadie — es un valor por defecto que escribió el sistema en
el onboarding**. Tratarlo después como «el IVA que el profesional eligió para este artículo» sería
ascender un default a decisión. Es SCRUM-615 exactamente, y con dinero encima.

*(Detalle que confirma el punto: las 8 filas de desarrollo son un catálogo de fontanería y tienen el
IVA VACÍO — o sea que NO entraron por `load-catalog`, que se lo habría puesto. Los caminos dejan
huella distinta.)*

**Y ya existe un IVA por defecto AL NIVEL DEL DOCUMENTO:** `vatDefault` en el formulario de
presupuesto (`quotesView.js:1016`, con `"21"` como valor de partida). O sea que el sitio donde vive
un defecto de IVA **ya está construido**, y no es el producto.

---

## La propuesta para P-DOC-8 — tres salidas, con su consecuencia

### ① Se TIRA
- **Qué pierde el profesional que ya lo había puesto:** el valor que tecleó en el alta manual o trajo
  en su CSV. **Medido: en las bases alcanzables eso son 0 filas.** En producción, desconocido.
- **Lo que NO pierde:** el 0,21 de los productos cargados por gremio, porque **eso no lo puso él**.
- **A favor:** el ticket ya saca el IVA del formulario y lo fija en la línea del documento. Un dato
  que nadie lee ni mantiene se pudre; y el defecto de documento (`vatDefault`) ya cubre el caso.
- **En contra:** es irreversible. Si mañana DOC-16 quisiera un IVA por artículo, el dato ya no está.

### ② Se usa como VALOR POR DEFECTO de la línea
- **Dónde vive ese defecto:** hoy **ya hay uno**, `vatDefault` del documento. Así que esta salida no
  crea un sitio: crea un **SEGUNDO** sitio, y con él la pregunta de cuál manda. Eso es una decisión
  nueva, no una consecuencia.
- 🔴 **Y el riesgo medido:** ascendería el 0,21 que el sistema escribió en el onboarding a «el IVA de
  este artículo», y encima **por delante** del que el profesional puso en su documento.
- **Qué pasa con los vacíos:** no tendrían defecto y caerían al del documento — que es exactamente
  el comportamiento de hoy. **No hay que inventar nada para ellos.**

### ③ Se CONSERVA sin usarse, y se decide con DOC-16
- El switch entra, el IVA sale del formulario (que es lo que CAT-01 pide), y la columna se queda
  quieta hasta que 623/624 se desbloqueen y DOC-16 diga qué quiere.
- **A favor:** no destruye ni asciende nada. Es la única reversible.
- **En contra:** un dato que nadie lee ni mantiene se pudre, y dentro de seis meses nadie sabrá si
  ese 0,21 significa algo. **Si se elige, tiene que llevar fecha de caducidad**, como el trinquete de
  `PENDIENTE_CLASIFICAR`.

### 🛑 Y la salida que NO se propone

**Rellenar los vacíos con 21 %.** Un vacío no es un 21 %. Es la misma inversión que
`resolveTipoDestinatario`, y aquí acabaría en el importe que firma un cliente.

**Ninguna de las tres necesita inventar un valor para los vacíos** — conviene decirlo, porque era la
mitad de la pregunta: con ① caen todos igual; con ② y ③ caen al `vatDefault` del documento, que es
lo que ya hacen hoy.

---

## Lo que hace falta para desbloquear CAT-01

1. **P-DOC-8**: cuál de las tres salidas. Con los números de arriba se decide en cinco minutos.
2. **La clasificación producto/servicio**: medido que **no se puede derivar**, así que la migración
   no puede rellenarla. Hay que decidir si el switch nace sin lado marcado (patrón CONT-01) o si se
   le pregunta al profesional de otra forma.
3. **El número de producción**: nadie lo tiene. Si la decisión de ① depende de cuántos merchants
   pusieron el IVA a mano, ese dato hay que sacarlo de producción, y no desde aquí.

---

## Estado del árbol

- **Suite: total 4158 · pass 4079 · fail 0 · skipped 79**, medida EN ESTA RAMA y no heredada del
  informe anterior: `main` se movió entre un ticket y otro y el número de ayer (4148) ya no valía.
- `npm run guards:entrada` en verde.
- Cero ficheros de producto tocados. No se ha migrado nada, no se ha tocado el esquema, no se ha
  construido el switch ni el autocompletado.

---

# SCRUM-609 · APÉNDICE · Lo construido, y el switch que NO se pudo construir

**Fecha:** 01-sep-2026 · **Carril:** producto · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `17f028b68cea6225c9fbb5b063b821346e4a4698` · 2026-09-01T15:43:53+01:00

## La enmienda: **la migración que borra `vat` no existía**

No estaba escrita ni preparada. Lo único que hace este diff es **quitar campos de formulario que
escribían**; comprobado sobre el propio diff: cero `UPDATE products`, cero `SET vat`, cero
`DROP COLUMN`, y `prisma/` sin tocar. No hubo nada que borrar de la rama.

Y el 0,10 de las tres filas del merchant 22 **sigue visible**: la columna IVA de la tabla del
catálogo no se toca. Huérfano y a la vista, que era el criterio.

---

## 🔴 EL CENSO QUE PIDIÓ LA ENMIENDA — (a), (b) y (c)

### (a) Quién lee `products.vat` hoy

| lector | fichero:línea | qué hace con él |
|---|---|---|
| `searchProducts` (autocompletado del presupuesto) | `products.service.ts:211` | lo **selecciona** para devolverlo al front |
| **el editor de presupuestos** | `quotesView.js:1762-1766` | al elegir un producto, **escribe ese IVA en la línea** (fracción → porcentaje) |
| `exportProductsCsv` | `products.service.ts:68` y `:92` | lo saca en el CSV del tarifario |
| la tabla del catálogo | `productsView.js:340` y `:469-471` | lo pinta como «N %» |
| `PUT /admin/products/:id` | `products.routes.ts:263` | lo escribiría **sólo si viaja** — y ya no viaja |

**✅ Control positivo del censo:** no es un cero. La búsqueda **encuentra lectores reales y
nombrados** — el más importante, `quotesView.js:1762`, es justo el que decide el IVA de la línea.
Si hubiera dado 0, no lo habría escrito como 0.

### (b) ¿Alguno se queda sin valor? ¿Cae a un default 0,21?

**Sí, y es deliberado.** La cadena, en `quotesView.js:2150-2158`:

```
if (initial.vat != null)      → el IVA del producto
else if (initial.tax != null) → el de plantilla/IA
else                          → fieldVatDefault.input.value || "21"
```

Un producto **sin** `vat` cae al **defecto del documento** (`21`). Es el comportamiento de hoy y
está decidido desde SCRUM-132/134, con su motivo escrito en esa misma línea:

> **«El general SIEMBRA, nunca PISA: solo se aplica si la línea no trae IVA propio.»**

### (c) ¿Ese 0,21 pisaría el 0,10 del merchant 22? → **NO**

Y no es una opinión: **el orden del `if` lo impide**. El IVA del producto se escribe PRIMERO
(`quotesView.js:1762`); el `21` es la rama `else` y sólo entra cuando no hay IVA propio.

**Las tres filas del merchant 22, con `vat = 0.1000`, seguirán poniendo `10` en la línea.** Lo que
cambia con este ticket es sólo que los productos **nuevos** nacen sin `vat` y por tanto caen al
defecto del documento — que es exactamente lo que CAT-01 quiere.

**No procede parar.**

---

## Lo construido

### ✅ El margen, sobre PRECIO DE VENTA

`public/dashboard/js/margenCatalogo.js` — aritmética sin DOM, para que esta pantalla tenga red en
`npm test` (los nueve guards no cubren el dashboard, SCRUM-628).

- `margen % = (precio − coste) / precio × 100`
- coste + margen → precio · coste + precio → margen
- **sólo precio → NADA**, y es válido
- coste 0 con precio > 0 → **100 %**, que sale solo de la fórmula
- **nunca pisa el campo que se está tecleando**
- un margen imposible (≥ 100 % con coste > 0) devuelve `null`, no un infinito disfrazado

### ✅ El IVA sale del formulario — de los DOS

Del alta **y** de la edición, porque «deja de escribirse» no se cumple si la mitad lo sigue
escribiendo. En la edición **el `vat` ya no viaja** — no se manda `vat: null`, que borraría el dato
al guardar cualquier otro cambio — y `PUT` sólo toca las claves presentes
(`products.routes.ts:263`). El campo del margen se rellena **derivado** de coste y precio.

### 🛑 El switch NO se ha construido, y no es un olvido

**`Product` no tiene ninguna columna donde guardar el lado.** Un switch sin columna es un control
que **olvida lo que elegiste** en cuanto recargas: peor que no tenerlo.

Diff **preparado y PARADO**, sobre una copia (schema real intacto, `Buffer.compare === 0`), y es
**aditivo**:

```sql
ALTER TABLE "products" ADD COLUMN "item_kind" TEXT;
```

Con la forma ya decidida en CONT-01 y por el mismo motivo: **nullable y sin `@default`**, porque un
default convertiría a los **58 productos de producción** en «declarados» sin que nadie lo haya
dicho. NULL = sin clasificar, y el switch **no preselecciona ningún lado**.

---

## Hallazgo del banco de vistas, arreglado porque bloqueaba el montaje

El parser de `innerHTML` de `tests/_banco-vistas.mjs` copiaba `id`, `class` y `data-*` — **`name`
no**. Y como `casaSimple` **sí** considera soportado `[name="cost"]`, no lo anotaba como no
soportado: devolvía **`null` en silencio**, indistinguible de «ese nodo no existe».

**Es el defecto que ese banco existe para eliminar, una capa más abajo.** No se había notado porque
`productsView` sólo usaba esos nodos dentro de manejadores, que el banco no dispara; en cuanto una
vista les puso un `addEventListener` al montar, reventó.

Se copia `name` vía `setAttribute` —no como propiedad suelta, porque el matcher resuelve por
`getAttribute`—. **Hueco que queda declarado:** cualquier OTRO atributo (`type`, `placeholder`,
`min`…) sigue dando el mismo null mudo.

⚠️ Y una hipótesis mía que era falsa, dicha en voz alta: primero culpé a un comentario HTML dentro
del literal. Lo quité y **siguió fallando**. La causa era el atributo. Lo cazó mirar la línea del
`stack`, no razonar.

---

## Los controles

Árbol commiteado en **`321c1432`** antes de inyectar.

| control | resultado |
|---|---|
| **Rotura inyectada** · dividir entre el coste | **el test CAE y nombra los dos números**: «ha salido **233.33**, y tiene que ser **70**» |
| **Control negativo** · sólo precio | no autocompleta nada; un producto sin coste ni IVA **se sigue guardando igual** |
| **coste 0, precio > 0** | margen **100 %** — confirma que la convención es sobre precio |
| reversión | `Buffer.compare(disco, testigo) === 0` |

## Recuento y contador

- **Suite: total 4172 · pass 4093 · fail 0 · skipped 79**, medida en esta rama.
- `SCRIPTS_DEL_DASHBOARD` **64 → 65**, **recalculado** desde el `index.html` de esta rama
  (`grep -c "<script src="`), no elegido.
- `margenCatalogo.js` añadido al SHELL del service worker (`addAll` es atómico).
- **Censo de marcadores: NO sube.** Ningún texto nuevo — «Coste» y «Margen %» describen el campo, y
  un rótulo que sigue describiendo bien el campo no se marca.
- `npm run guards:entrada` en verde.

## HALLAZGOS FUERA DE ALCANCE

- **El banco de vistas sólo copia `id`, `class`, `data-*` y `name`.** Cualquier otro atributo en un
  selector devuelve `null` mudo. Arreglado sólo `name`, que era lo que bloqueaba; el resto queda.
- **El CSV del tarifario exporta `vat` pero no `cost`** (`products.service.ts:68`). Con el margen
  entrando en la pantalla, el export enseña el IVA que ya no se pide y esconde el coste del que sale
  el margen. No se toca aquí.

---

# SCRUM-609 · APÉNDICE 2 · El switch sigue parado: los valores NO están en el máster

**Fecha:** 01-sep-2026 · **Carril:** producto · **Gate:** sin gate — no entra código

**Medido contra:** `origin/main` = `775bf7e04e4c0f55ca23ad4c9bfe58a0b365c3dc` · 2026-09-01T16:10:13+01:00

**No se ha construido el switch y no se ha tocado `prisma/schema.prisma`.** La columna está
autorizada; lo que **no** lo está es qué cadenas escribe dentro, y eso es lo que faltaba comprobar.

## (a) y (b) · La comprobación en el máster: **NO ESTÁN**

| se buscó | resultado |
|---|---|
| `item_kind` / `itemKind` en `docs/YAQU_MASTER.md` | **no aparece** |
| la pareja por CONTENIDO («Producto \| Servicio», «producto o servicio», `PRODUCTO`/`SERVICIO`) | **no aparece** |
| `CAT-01` / `CAT-1` en el máster | **no aparece** |
| un documento de campos del catálogo, como el que CONT-01 tiene | **no existe** (sí existe `docs/CONTACTOS_CAMPOS_POR_LADO.md`, pero es de contactos) |
| los **rótulos de interfaz** de los dos lados | **no aparecen** |

**✅ Control positivo del barrido — el cero no es ceguera:** el mismo barrido **sí** encuentra las
partes del máster (`PARTE A — NORTE CLARO`, `B — PAÍSES Y REGULACIÓN`, `C — PRODUCTO`, `D`, `E`,
`F`…) y **sí** encuentra la sección del catálogo por gremio (`ONBOARD-2`, línea 609). Encuentra lo
que hay; lo que no hay es la pareja.

### 🔴 Y una discrepancia del encargo que hay que decir

El ticket sitúa CAT-01 en el **«bloque K»**. En `YAQU_MASTER.md`, **`PARTE K` es «BOT WHATSAPP
ENTRANTE»** (línea 356) — el bot, no el catálogo. Y `J7. Catálogo técnico` (línea 307) tampoco es
el catálogo de productos: es el **catálogo de plantillas de WhatsApp**.

Así que el «bloque K» del ticket es el documento aprobado el 24-ago, **no una sección del máster**.
Los valores de `item_kind` no están escritos en el máster **por ninguna de las dos vías**.

> **PARA.** No invento «PRODUCTO/SERVICIO», ni «MATERIAL/MANO_DE_OBRA», ni ninguna otra pareja
> razonable. Va al fundador.

## 🛑 Y por eso tampoco se añade la columna todavía — con su motivo medido

La columna está autorizada y su SQL está listo:

```sql
ALTER TABLE "products" ADD COLUMN "item_kind" TEXT;
```

**No se aplica en esta rama, y no es desobediencia: es el orden.** Medido en
`src/core/db/schemaDrift.ts`:

- la comparación del arranque es **`esperado ⊆ real`** (línea 30);
- si `schema.prisma` nombra una columna que la base no tiene → **DERIVA → producción NO ARRANCA**
  (líneas 224-225, 261).

Y `db push` está prohibido para esta sesión «se invoque como se invoque», porque **sincroniza el
esquema entero**, no sólo este cambio. Así que si el schema entrara hoy en la rama y el PR mergease
antes de que el `ALTER TABLE` corriera en las tres bases, **el siguiente arranque no levantaría**.
Es la lección de SCRUM-205, escrita allí como innegociable: **`ALTER TABLE` → luego el código.
Nunca el código primero.**

**Y hoy la columna no tendría consumidor**: el switch no se puede cablear sin los valores. Meterla
sola sólo abre la ventana de deriva sin ganar nada.

**Propuesta de orden**, para que lo decida el fundador:

1. El fundador escribe **los dos valores y sus dos rótulos** (o los aprueba con marcador).
2. Se aplica el `ALTER TABLE` a las tres bases.
3. Entra un PR con el `schema.prisma`, el switch cableado y su test — todo junto, sin ventana de
   deriva.

Si se prefiere meter la columna antes, es viable — pero el `ALTER TABLE` tiene que correr en las
tres bases **antes** de que ese PR mergee, no después.

## Lo que sigue en pie de este ticket

El **margen** y el **IVA fuera del formulario** están construidos y verificados en el apéndice
anterior, y no se han tocado hoy. El único cambio de este apéndice es documental.

## Estado del árbol

- **Suite: total 4172 · pass 4093 · fail 0 · skipped 79** — sin cambios de código desde la
  medición anterior de esta rama.
- `prisma/schema.prisma` **intacto**.
- `npm run guards:entrada` en verde.

## HALLAZGOS FUERA DE ALCANCE

- **El «bloque K» del ticket no es la Parte K del máster.** Conviene que el ticket lo diga, o el
  siguiente que lo lea buscará CAT-01 en el bot de WhatsApp.
- Se mantienen los dos del apéndice anterior (banco de vistas → SCRUM-634 · CSV del tarifario →
  SCRUM-635), y no se han tocado.
