# SCRUM-586 · Forma de pago por defecto por cliente — MEDICIÓN Y PROPUESTA

**Fecha:** 5-sep-2026 · **Carril:** producto / contactos · **Gate:** sin gate — no hay código aún

**Medido contra:** `origin/main` = `cb41ede81ea1c072a99d5ec4a4a1aec7c3253481` · 2026-09-05T17:23:51Z

> ⛔ **NO HAY CÓDIGO EN ESTA ENTRADA, Y ES DELIBERADO.** El ticket necesita una columna en
> `Customer`; el diff está preparado y **no aplicado**. El fundador cerró la jornada antes del GO:
> *«un ALTER a estas horas es como se pierde una columna»*. Esto es el registro de lo medido, para
> que mañana el trabajo empiece con el terreno hecho y no se vuelva a medir.

---

## PASO −1.2 · EL FILTRO

**NO está hecho.** Ningún fichero del árbol nombra `SCRUM-586` ni `CONT-13`, y ningún commit de
`origin/main` lo toca. Es el primero de ocho asignados hoy que sí está por hacer.

---

## 🔴 LA PREGUNTA QUE DECIDÍA EL TAMAÑO: EL CATÁLOGO YA EXISTE

No hay que crear nada, así que **no es STOP de fundador por catálogo**:

- `z.enum(['card', 'bizum', 'transfer'])` — en `core/validation/schemas.ts`, dos veces (el schema
  del presupuesto y el del cobro).
- El documento ya tiene su selector: **«Formas de pago que verá el cliente»**, tres casillas
  (`💳 Tarjeta`, `📲 Bizum`, `🏦 Transferencia`), **todas marcadas** por defecto.
- `Quote.payMethods` es `Json?`; `null` = todas las que el merchant tenga activas.

**El ticket es DERIVAR el valor por defecto desde el cliente**, no inventar un catálogo.

### Tres datos que se parecen y no son lo mismo

| dato | qué es | ¿lo toca este ticket? |
|---|---|---|
| `Quote.payMethods` | métodos habilitados del documento | **sí — de aquí deriva** |
| `Quote.paymentTerms` | condiciones (`FULL_UPFRONT`/`FIFTY_FIFTY`/`MANUAL`) | no |
| `Invoice.paidVia` | **cómo entró el dinero**, hecho consumado | **no — camino de emisión** |

`paidVia` es terreno fiscal y además ya lleva su propia regla escrita (SCRUM-441: nunca rellenado
por copia desde `Charge.method`). Se lee, no se toca.

**`payMethods` NO viaja al PDF** — medido en `pdf.service.ts` y `presupuestoParaPdf.ts`. Los
documentos emitidos no se ven afectados por este ticket.

---

## LA DECISIÓN DEL FUNDADOR (5-sep-2026): **SE PROPONE, NO SE APLICA**

El precedente `dtoPorDefecto` (SCRUM-587) ya proponía en vez de aplicar, pero **aquí la razón es
más fuerte y conviene dejarla escrita**, porque el caso no es el mismo:

- Allí el estado por defecto era **vacío**. Aquí el estado por defecto del documento son **las
  tres marcadas**, así que aplicar un default del cliente **RESTA opciones de cobro**.
- Si un cliente tiene sólo «transferencia» y el profesional no se fija, **el cobro se retrasa
  entero**. En un autónomo, cobrar tarde duele más que cobrar un poco menos.
- Y al revés: marcar tarjeta mete la comisión del **0,9 %**.

> 🔴 **CUANDO APLICAR CUESTA EN AMBOS SENTIDOS, SE PROPONE.** Ésa es la regla que sale de aquí, y
> es la que hace que este caso no dependa de recordar el precedente del descuento.

La tira del documento **se deriva de la de SCRUM-587**, no se escribe de cero.

---

## EL DIFF · PREPARADO Y NO APLICADO

```sql
ALTER TABLE "customers" ADD COLUMN "pay_methods_por_defecto" JSONB;
```

Generado con `node scripts/preview-migracion.mjs --desde <schema previo>`: **control positivo de
la herramienta respondiendo (27 tablas)** y **veredicto aditiva** — ni DROP, ni RENAME, ni
TRUNCATE, ni DELETE, ni SET NOT NULL. El SQL, con su consulta de verificación y su suelo, vive en
[docs/sql/scrum-586-forma-de-pago-por-cliente.sql](../sql/scrum-586-forma-de-pago-por-cliente.sql).

El campo propuesto copia el patrón de la columna de al lado:

```prisma
payMethodsPorDefecto Json? @map("pay_methods_por_defecto")
```

- **`@map` en snake_case**, porque las columnas de `customers` lo están (medido en SCRUM-587:
  24 snake, 0 camel). Sin él, Prisma buscaría una columna que no existe.
- **Nullable y sin `@default`**: `NULL` = «no se ha pactado nada». Un `@default` convertiría a
  todos los clientes que ya existen en «declarados» y ya no habría forma de saber a cuáles se les
  llegó a preguntar.
- **Nombre**: mantiene la raíz `payMethods` del campo del que deriva y el sufijo `PorDefecto` de
  `dtoPorDefecto`. Que se parezca a los dos es el punto.

---

## ⚠️ EL CRUCE DE TERRITORIO, MEDIDO ANTES DE ESCRIBIR

Otra sesión entra en el **bloque de etiquetas** (DOC-05, derivando de CONT-07) en el mismo
fichero. **Nos cruzamos en cuatro sitios** — no en el mismo campo, sí en las mismas regiones:

| sitio | etiquetas | forma de pago |
|---|---|---|
| `customersView.js` · payload del submit | 1386 | junto a 1370 |
| `customersView.js` · rellenado en edición | 1324 | junto a 1305 |
| `schemas.ts` · `customerCreateSchema` | 542 | junto a 578 |
| `prisma/schema.prisma` · modelo `Customer` | `tags` | **columna nueva** |

🔴 **Es la forma exacta de SCRUM-751**: dos tickets tocando el mismo objeto a decenas de líneas de
distancia, sin conflicto de git que obligue a mirar — y hoy eso dejó `main` en rojo toda la tarde.
Además, `body.appendChild(fieldTags.wrapper)` vive hoy **suelto en la línea 947**, fuera del bloque
agrupado (1146-1189): si el ticket de etiquetas lo muda a ese bloque, aterriza justo donde iría el
`appendChild` de este campo, que hoy es la **1178**.

**DECISIÓN DEL FUNDADOR: en serie, y este ticket primero** — porque ya tiene el diff generado con
su control positivo. Dos diffs de esquema sobre `Customer` preparados por separado es como se
pierde uno.

---

## MICROCOPY CANDIDATA · con marcador, SIN APLICAR

```
[PENDIENTE microcopy oficial] Formas de pago por defecto
[PENDIENTE microcopy oficial] Se propondrán al crear un documento para este cliente. Podrás cambiarlas en cada uno.
```

Falta un tercer literal para la tira del documento, derivado del de SCRUM-587.

⚠️ **CAJAS SIN MEDIR, y es el orden correcto**: la medición a 929 y 390 px con texto dentro se
hace cuando el nodo exista. Medir una caja que aún no está devolvería 0 px de alto, que se lee
como «cabe de sobra» y es lo contrario de lo que se quiere saber — la lección que
`guard:caja-semaforo` dejó escrita en SCRUM-648.

---

## LO QUE FALTA, Y EN QUÉ ORDEN

1. **GO del fundador al `ALTER`** (y lo aplica él en staging/producción; aquí sólo dev).
2. Campo en `Customer` + `customerCreateSchema` con el **mismo `z.enum` que ya existe**.
3. Campo en el modal de cliente, junto a `dtoPorDefecto`.
4. La tira de propuesta en el documento, derivada de `descuentoPorDefecto.js`.
5. Los controles: documento que **trae la propuesta**, documento que **la pisa sin alterar al
   cliente**, y cliente **sin** default que no rompe nada.
6. Microcopy firmada y **cajas medidas en navegador**.

---

## ⚠️ LOS NÚMEROS DE LÍNEA SE RE-MIDIERON, Y LOS MOVIÓ ESTE MISMO DÍA

La primera medición del cruce daba 886 / 1117 / 1302 / 1318 / 1237 / 1256. Entre esa medición y
esta entrada, `main` mergeó **SCRUM-756** —el ticket anterior de esta misma sesión, que añade 95
líneas a `customersView.js`— y **todos esos números se desplazaron**. Los de arriba están
re-medidos DESPUÉS de mezclar `main` dentro.

🔴 Es la razón exacta por la que un ancla o un número de línea escrito sin re-fetch inmediato
nace caduco: aquí el que los movió fue el commit anterior del propio autor.

---
## HUECOS DECLARADOS

- **No se ha ejecutado nada del flujo**: no hay código, así que no hay controles que enseñar. Todo
  lo de arriba es lectura del árbol y un diff generado por herramienta.
- **No se abrió navegador** y **no se midió ninguna caja**.
- **El esquema NO quedó tocado**: se añadió el campo temporalmente para generar el diff y se
  restauró desde una copia verificada byte a byte contra `HEAD`.

---
---

# APÉNDICE · 6-sep-2026 — SE CONSTRUYE LA MITAD QUE NO DEPENDE DEL ESQUEMA

**Medido contra:** `origin/main` = `2c155141bc27f0e450a9a1c7ca5748330b37ee39`, mezclado dentro ·
árbol `daa9e9a67cfcad216f5f156ff34cd0076ac77144` · 2026-09-06T05:58Z ·
worktree `cobroflash-backend`

> La entrada de arriba es del 5-sep y **no se borra ni se corrige**: era verdad ese día. Esto es
> lo que pasó al continuarla. Dos cosas suyas han cambiado y se dicen aquí, no allí: el `ALTER`
> tiene GO **para dev**, y el fichero SQL «listo para aplicar» **no se podía aplicar**.

---

## 0 · ⚠️ LA SESIÓN CAMBIÓ DE ÁRBOL A MEDIAS, Y HAY QUE ESCRIBIRLO

Esta tarea empezó en el worktree `cobroflash-b3`. **A mitad de trabajo, otra sesión hizo
`checkout -b scrum-760-iva-de-voz-recortado` sobre ese mismo árbol y luego lo reseteó a
`origin/main`.** Consecuencias medidas, no supuestas:

- Un `git merge origin/main` mío aterrizó **en la rama del 760**, no en la mía. Su reset posterior
  se lo llevó por delante, así que no queda rastro — pero pudo no haber sido así.
- Los dos `.sql` de este ticket **desaparecieron del disco** con ese reset.
- La rama `scrum-586-forma-de-pago-por-cliente` **nunca se movió**: siguió en `e706cee5`.

El trabajo se rehízo en el worktree **primario**, cuya rama (`scrum-596`) ya estaba en `main`, así
que ahí no se le quitó el sitio a nadie. Antes de salir de `b3` se retiraron **una a una** las tres
inserciones que yo había dejado en su árbol —`index.html`, `sw.js` y `_banco-vistas.mjs`— con
reemplazo exacto y no con `git checkout`: ese fichero contenía **trabajo sin commitear del
SCRUM-760** (su `insertAdjacentElement`), y un `checkout --` se lo habría llevado. Comprobado
después: `b3` quedó con 32 líneas suyas y **cero** mías.

> 🔴 Lo que esto deja escrito: *un worktree no es tuyo porque tu rama esté en él*. Lo único que no
> mintió en todo el episodio fue **el nombre de la rama**, no el directorio.

---

## 1 · LA COLUMNA, APLICADA EN DEV Y SÓLO EN DEV

**GO del fundador, acotado a dev.** Aplicada con la herramienta de la casa, que no acepta la URL
por `argv` y sólo apunta a `yaqu_dev_javier`:

```
node scripts/aplicar-sql-dev.mjs --file docs/sql/scrum-586-paso-1-anadir-columna.sql --go
```

| | `control_ve_la_tabla` (SUELO) | `columna_nueva` | `nullable_y_sin_default` | `control_vecina_dto` |
|---|---|---|---|---|
| **ANTES** | 24 | 0 | 0 | 1 |
| **DESPUÉS** | **25** | **1** | **1** | 1 |

El suelo subiendo 24 → 25 es la corroboración: la tabla que se está mirando es la que creció.
Destino impreso por la herramienta: `acela.proxy.rlwy.net/yaqu_dev_javier (DESARROLLO)`.
**Staging y producción siguen PENDIENTES y las aplica el fundador.**

### 🔴 EL FICHERO «LISTO PARA APLICAR» DE AYER NO SE PODÍA APLICAR

`scripts/aplicar-sql-dev.mjs` rechaza el **fichero entero** si contiene una sentencia fuera de su
lista blanca, y el `SELECT` de verificación lo está. Medido: sale con código 1 y no aplica nada.
Así que el `ALTER` se **MUDÓ** —no se copió— a `docs/sql/scrum-586-paso-1-anadir-columna.sql`, y
existe **una sola vez** en el árbol. El fichero de ayer se queda como registro y verificación.

### Y un defecto propio, que se escribe porque el rojo lo encontró

El verificador **derivaba** la consulta del `.sql` partiendo por `;`. Al añadir yo un `;` **dentro
de un comentario**, la partición cortó por ahí y mandó prosa a Postgres:
`syntax error at or near "staging"`. Se arregla quitando los comentarios **antes** de partir. Queda
avisado dentro del propio `.sql`, para el siguiente que automatice esa verificación.

---

## 2 · 🔴 LA FRONTERA DEL ESQUEMA, PROVOCADA EN VEZ DE PREDICHA

`prisma/schema.prisma` **no se toca** (dominio del fundador). Eso deja **la mitad del servidor
bloqueada**, y no por precaución: está medido.

- El cliente de Prisma generado conoce **30 campos** de `Customer`. Incluye `dtoPorDefecto`
  (control positivo) y **no** incluye `payMethodsPorDefecto`.
- Provocado contra `yaqu_dev_javier`, **con la columna ya creada**:
  - `findFirst({ select: { id, dtoPorDefecto } })` → **funciona** (`{"id":1,"dtoPorDefecto":null}`).
  - `findFirst({ select: { id, payMethodsPorDefecto } })` → **`PrismaClientValidationError`**.

O sea: la columna existe en la base y Prisma la rechaza igual. Por eso **NO** se han tocado
`schemas.ts` ni `customerAdmin.ts`: `createCustomer` mete el cuerpo ya validado directo en el
`data` de Prisma, así que un zod que aceptara el campo **rompería cada guardado de cliente que lo
incluyera** — es el aviso que dejó escrito SCRUM-587, verificado hoy en la máquina.

**Lo preparado y NO aplicado**, en el orden en que entra cuando la columna esté en las tres bases
(el orden que dejó escrito `internalRef` en el propio esquema):

1. `prisma/schema.prisma`, modelo `Customer`, junto a `dtoPorDefecto`:
   `payMethodsPorDefecto Json? @map("pay_methods_por_defecto")`
2. `src/core/validation/schemas.ts`, `customerCreateSchema`:
   `payMethodsPorDefecto: z.array(z.enum(['card','bizum','transfer'])).min(1).nullable().optional()`
3. `src/modules/system/customerAdmin.ts`, `CUSTOMER_SELECT_NO_TOKEN`: `payMethodsPorDefecto: true`
   — **el quinto eslabón**: sin esta línea el dato se guarda y el documento no lo ve nunca, y la
   tanda sigue verde porque el dato **sí** está en la base.
4. El campo en el modal de cliente, junto a `dtoPorDefecto`.

---

## 3 · LO QUE SÍ SE CONSTRUYE, Y POR QUÉ ES EL TICKET Y NO UN TROZO

| fichero | qué |
|---|---|
| `public/dashboard/js/formaDePagoPorDefecto.js` | la regla, pura, que la suite EJECUTA |
| `public/dashboard/js/quotesView.js` | la tira que PROPONE, en el bloque de Envío |
| `public/dashboard/css/styles.css` | un selector más en la regla del 587, sin componente nuevo |
| `public/dashboard/index.html` · `public/sw.js` · `tests/_banco-vistas.mjs` | los cuatro registros |
| `tests/scrum586-forma-de-pago-por-cliente.test.mjs` | 20 tests, 4 mutaciones |

**La pieza deriva del 587 y se aparta en dos sitios, los dos escritos en el fichero:**

- **`aplicarA` SUSTITUYE la selección entera** en vez de rellenar huecos. Una casilla no tiene
  estado «vacío»: «las tres marcadas» es a la vez el valor de fábrica y una elección deliberada, y
  **desde el dato no se distinguen**. Lo que da el consentimiento no puede ser una heurística: es
  **el clic**.
- **`[]` NO es un acuerdo legítimo**, al revés que el `0 %` del 587. «Se pactó que no hay ninguna
  forma de pago» sería un documento que el cliente no puede pagar; el servidor ya lo prohíbe con su
  `.min(1)`. Se lee como «no consta».

Y una regla que protege el cobro: **un valor ilegible no da una propuesta más pequeña, da NINGUNA
propuesta.** Un cliente con `['bizum','paypal']` NO pasa a «sólo bizum» — eso sería restar una
opción de cobro por un dato que no se entendió, que es el daño exacto que el fundador nombró.

### El catálogo: escalón 3 pagado con guard

`['card','bizum','transfer']` ya vivía **tres veces** (dos `z.enum` en `schemas.ts` y el `pmDefs`
del editor). La cuarta es forzosa —JS de navegador no importa el TS del servidor— así que se paga
con el guard que compara **las tres grafías por AST**. La población se busca por **«bizum»**, no
por «card»: `z.enum(['bank','card','mp'])` de `method_preference` también lleva «card» y no es
este catálogo.

### 🔴 Un defecto que este ticket habría metido, y que sale del árbol

`loadInitialData` **desmarca y DESACTIVA** la transferencia cuando el merchant no tiene IBAN
(«checkboxes de métodos HONESTOS»). Sin recorte, un cliente con «transferencia» pactada habría
hecho que la tira la propusiera igual, y **`selectedPayMethods` lee `.checked` y no mira
`disabled`**: el método habría viajado en el payload. Este ticket habría deshecho esa honestidad
desde otra pantalla. Lo cierra `propuestaOfrecible`, que recorta **antes** de calcular el alcance —
recortar sólo al aplicar dejaría la tira contando como «cambiaría 1 casilla» algo que el clic no
puede cambiar.

---

## 4 · LOS CONTROLES, Y LOS CUATRO ROJOS QUE SE PROVOCARON

`tests/scrum586-forma-de-pago-por-cliente.test.mjs` — **20 tests · 20 pass · 0 fail · 0 skip**.

**El que decide, de punta a punta y sobre la pantalla montada:** se elige el cliente, la tira
aparece diciendo qué se pactó, **las casillas NO se han movido**, el profesional pulsa y quedan en
lo pactado, vuelve a marcar tarjeta a mano y **el objeto del cliente sigue byte a byte igual**.

**Control negativo:** un cliente sin nada pactado deja el documento con **las tres marcadas** y sin
tira, igual que antes de este ticket.

**El que cierra la decisión del fundador** es de **ALCANZABILIDAD sobre el AST**, no de texto: toda
referencia a `aceptarPropuestaDeFormaDePago` tiene que vivir dentro de un
`addEventListener("click", …)`. Meter la aplicación detrás de una función intermedia cae igual.
Lleva **control positivo del detector**: `dentroDeUnClic` tiene que **rechazar** alguna referencia
al refresco, que sí se llama desde sitios que no son un clic — si dijera «sí» a todo, el guard
aprobaría cualquier cosa en verde.

### Las mutaciones (`MUTACIONES_QUE_ME_TUMBAN`) — 4 declaradas, **4 en rojo**

| mutación | el rojo que saca |
|---|---|
| el refresco pasa a aplicar | «aplicar NO se alcanza fuera de un clic» |
| el valor fuera de catálogo se filtra en silencio | «un valor ILEGIBLE no es una propuesta más pequeña» |
| se quita `propuestaOfrecible` del refresco | «sin IBAN NO se propone transferencia» |
| un pacto de las tres vuelve a contar | «un pacto de LAS TRES consta, y aun así no propone nada» |

🔴 **Una salió MUDA a la primera, y el arreglo fue del CASO, no del guard.** El test del IBAN
montaba la vista **sin elegir cliente**, así que el refresco no tenía a quién mirar y la tira salía
oculta pasara lo que pasara. *El rojo que no sale acusa al caso.* Corregido —se dispara el `change`
del selector— sale rojo.

**Contra el meta-guard, que está bajo sospecha:** las declaraciones no se leen aquí con un segundo
lector. Un test **le pregunta al oficial** (`mutacionesDeclaradas`, importado) si las ve, y compara
`de` y `a` uno a uno — es la defensa contra SCRUM-757, que ignora en silencio una declaración con
forma propia. Otros dos tests comprueban que cada `de` **existe una sola vez** en su fichero y que
cada `cae` **nombra un test que existe** (SCRUM-748: si no, sale CIEGO y nadie se entera).

**`npm run meta:mutaciones`, tres pasadas seguidas — no oscila:**

| pasada | vivas | mudas | ciegas |
|---|---|---|---|
| 1 · 2 · 3 (sin `dist/`) | 21 | 0 | 2 |
| 4 (con `dist/` compilado) | **23** | **0** | **0** |

Las 2 ciegas eran de **SCRUM-631**, que ya está en `main`, y **no eran suyas**: su mensaje decía
«o `dist/` sin compilar», y compilando desaparecen. El meta-guard acertó el diagnóstico.

### `payMethods` NO viaja al PDF — verificado hoy, no heredado

Censo **derivado** del modelo `Quote` (47 campos leídos del esquema, no una lista a mano) sobre los
5 ficheros del camino del PDF. **SUELO: 23 campos SÍ aparecen** — sin ese suelo, «`payMethods` no
aparece» significaría «no supe mirar». `payMethods`: **no aparece**. Sin `spread` que lo cuele y
sin la clave en `ParamsPdfPresupuesto`. **Los documentos emitidos no se ven afectados** y esto no
entra en el camino de emisión (regla 38). Va como test, así que deja de ser una afirmación de hoy.

> ⚠️ La primera versión de ese censo dio **0 en el suelo** y se declaró NO MEDIBLE en vez de
> publicar el «no aparece». La causa: el script se escribió con un *heredoc* y los emoji lo
> corrompieron. Se reescribió con `Write` y midió.

---

## 5 · LAS CAJAS, MEDIDAS EN NAVEGADOR REAL

Edge por `puppeteer-core`, con `tokens.css` y `styles.css` **del árbol**, servidos desde disco en
cada petición. **Los literales NO se escriben en el medidor: se extraen de `quotesView.js` por
AST** — un medidor con su propia copia del texto mide otra pantalla. **Control negativo** en las
dos páginas: un nodo de 400 caracteres sin cortes que **tiene que desbordar**; si no desborda, el
medidor se declara ciego y no da número.

### La tira del documento (fuente 13,5 px texto / 12,5 px botón)

| ancho | bloque útil | caso | tira | texto | botón |
|---|---|---|---|---|---|
| **929 px** | 839,0 px | peor par (2 métodos) | 839,0 × 66,0 | 363,2 × 20,3 (1 línea) | 197,8 × **44,0** |
| **929 px** | 839,0 px | un método | 839,0 × 66,0 | 291,8 × 20,3 | 197,8 × 44,0 |
| **390 px** | 324,0 px | peor par | 324,0 × 114,5 | 294,0 × **40,5 (2 líneas)** | 197,8 × **44,0** |
| **390 px** | 324,0 px | un método | 324,0 × 94,3 | 291,8 × 20,3 | 197,8 × 44,0 |

El **peor caso real son DOS métodos**, no tres: un pacto de las tres no se propone. Nada desborda,
nada se sale del viewport y el botón cumple **AB6 (44 px)** — gracias a que se le extendió el
`min-height` del 587, que ya dejó escrito que `btn-sm` se queda corto.

### El modal de cliente (fuente 12,5 px) — la caja donde IRÍAN los otros dos

**Control positivo:** el rótulo **ya firmado** «Descuento pactado (%)» sale en **1 línea (19,4 px)**
en las dos anchuras, y el input mide **44,5 px**. Cuadra con lo que el asesor firmó el 4-sep.

| ancho | campo útil | «Formas de pago por defecto» | «Formas de pago pactadas» | ayuda (85 car.) |
|---|---|---|---|---|
| **929 px** | 472,0 px | 19,4 px (1 línea) | 19,4 px (1 línea) | 17,8 px (1 línea) |
| **390 px** | 342,0 px | 19,4 px (1 línea) | 19,4 px (1 línea) | 35,6 px (2 líneas) |

> ⚠️ **QUÉ ES ESTA MEDIDA Y QUÉ NO ES.** El campo del cliente **no existe** todavía, así que esto
> no mide «el campo del producto»: mide **la caja del modal, que sí existe**, con el texto
> candidato dentro. El control positivo es lo que permite decir que es la caja correcta. Y una
> discrepancia declarada en vez de escondida: **a 929 px mido 472,0 px y el 587 midió 462,6 px**
> sobre el modal vivo — 9,4 px más ancho, porque mi página compone el modal en vez de abrirlo. A
> **390 px los dos dan 342,0 px**, y es el caso estrecho, que es el que decide.
>
> Y las cajas se midieron **con marcador y sin él**: el marcador ocupa 29 caracteres y desaparece
> el día de la firma. Con marcador, «Formas de pago por defecto» pasa a **dos líneas (38,8 px)** a
> 390 px y «Formas de pago pactadas» se queda en una — pero **eso es un dato del marcador, no del
> texto final**, y así hay que leerlo.

---

## 6 · LOS TRES LITERALES, PARA EL ASESOR

Todos **CANDIDATOS**, con marcador puesto en el código donde el código existe. **La firma y la
retirada del marcador van en el MISMO commit** — no en un chat.

| # | dónde | literal candidato | car. | ¿en el código? | caja |
|---|---|---|---|---|---|
| 1 | rótulo del campo del cliente | **«Formas de pago pactadas»** | 23 | **no** (campo bloqueado) | 19,4 px en 472,0 / 342,0 |
| 2 | ayuda del campo del cliente | **«Se propondrán al crear un documento para este cliente. Podrás cambiarlas en cada uno.»** | 85 | **no** | 17,8 px (929) · 35,6 px (390) |
| 3 | texto de la tira del documento | **«Formas de pago pactadas»** + ` · ` + los métodos | 23 + dato | sí, como `[PENDIENTE microcopy oficial]` | 335,1 px (929) · 40,5 px alto (390) |

### 🔴 CAMBIO SOBRE EL CANDIDATO DE AYER, con su motivo

Ayer se propuso **«Formas de pago por defecto»**. Se cambia a **«Formas de pago pactadas»**, y no
por gusto: **la pantalla ya tiene una hermana FIRMADA de la que derivarlo.** El asesor firmó el
4-sep «Descuento pactado (%)» y dejó escrito el porqué: *«pactado» y no «por defecto» porque es la
palabra del dominio — es un acuerdo con ESE cliente, no una preferencia de la aplicación*. El campo
nuevo vive **en el mismo modal, justo al lado**, así que «por defecto» habría metido dos palabras
para la misma idea a dos campos de distancia.

**Y el literal 3 es EL MISMO que el 1, a propósito.** Un nombre por concepto, que es la regla que
SCRUM-591 dejó escrita para «+ Nuevo cliente». Por eso el censo cuenta **4 marcadores y hay 2
frases**: las dos tiras de este fichero dicen lo mismo con distinto sujeto, y los botones dicen
exactamente lo mismo.

**El rótulo del botón NO estrena literal.** Es el mismo hueco sin firmar que abrió la tira del 587
para el mismo acto. Abrir un segundo texto para decir «acepto la propuesta» le daría al asesor dos
firmas donde hay una decisión.

### Los contadores

- `FORMA_DE_PAGO_SIN_APROBAR = 2` en `quotesView.js`: las ranuras **de esta tira**. Un test lo
  contrasta **por identidad** contra lo que pintan sus dos nodos — contando por fichero salían 4,
  porque la tira del 587 vive en el mismo sitio, y habría acusado al contador de mentir.
- `DTO_POR_DEFECTO_SIN_APROBAR` sigue en **1**: este ticket no añade texto a `customersView.js`.
- Trinquete de SCRUM-402: `quotesView.js` **2 → 4**, subido **con su motivo escrito**. El trinquete
  saltó y eso es el aviso funcionando; se sube porque los dos textos existen, se pintan y están
  declarados, no para que pase.

---

## 7 · HALLAZGOS DE OTRO CARRIL (regla 37 — se reportan, no se arreglan)

1. **`pay-methods-row` no es de las formas de pago.** El bloque «Datos del cliente en el documento»
   (A20.4) **reutiliza** esa clase y la de su título: en el editor montado hay **2 filas con esa
   clase y 7 casillas**, no 3. Cualquiera que mida esta pantalla filtrando por la clase mide las
   casillas equivocadas — a mí me lo cazó el primer `assert` sólo porque pedía **exactamente 3**;
   con un «al menos 3» habría medido otra cosa en silencio.
2. **El modal de cliente y la ficha 360 siguen divergiendo** (`docs/CONTACTOS_CAMPOS_POR_LADO.md`,
   zona CONT-19): cuando el campo del cliente entre, habrá que decidir si va a uno o a los dos.

---

## 8 · HUECOS DECLARADOS

- **La mitad del servidor NO está construida** y no es un olvido: es la frontera del esquema,
  provocada y medida en §2. Sin ella, **el campo del cliente no se puede guardar**, así que hoy la
  tira sólo propone para clientes cuyo `payMethodsPorDefecto` llegue por otra vía. El mecanismo
  está entero y probado; lo que falta es la columna en staging y producción y la línea del modelo.
- **No se ha verificado en `yaqu.app`** (AA1.3): lo que se construye no llega a producción hasta
  que el fundador aplique la columna. Lo medido es navegador local sobre el CSS del árbol.
- **La caja del campo del cliente es la del modal, no la del campo**, con su control positivo y su
  discrepancia de 9,4 px declarada en §5.
- **Sin capturas** (AB6 pide antes/después): la tira no se puede fotografiar en la app real sin la
  columna en la base del entorno que se fotografíe.
- **La matriz de dispositivos AB6 está a medias**: 929 y 390 px, que es lo que pedía el encargo.
  Ni tablet ni 320 px.

---
---

# APÉNDICE 2 · 6-sep-2026 — ✅ MICROCOPY FIRMADA POR EL ASESOR, Y EL MARCADOR RETIRADO

**Rama:** `scrum-586-microcopy-firmada` · **medido contra** `origin/main` =
`00c6cb0cc328eb88cea26bc4b672ebad25e51a47` · 2026-09-06T06:43Z

> 🔴 **LA FIRMA Y LA RETIRADA DEL MARCADOR VAN EN EL MISMO COMMIT.** Un PR que llega a `main` con
> el marcador puesto deja la pantalla diciendo que su propio texto está sin aprobar, y la firma
> viviendo en un chat. Aquí van juntas, y hay un test que cae si se separan.

## Los tres literales firmados

| # | dónde | literal FIRMADO | car. | ¿en el código hoy? |
|---|---|---|---|---|
| 1 | rótulo del campo del cliente | **«Formas de pago pactadas»** | 23 | **no** — el campo no existe (frontera del esquema, apéndice 1 §2) |
| 2 | ayuda del campo del cliente | **«Se propondrán al crear un documento para este cliente. Podrás cambiarlas en cada uno.»** | 85 | **no**, ídem |
| 3 | texto de la tira del documento | **«Formas de pago pactadas»** + ` · ` + los métodos | 23 + dato | **sí** — marcador RETIRADO en este commit |

El 3 repite al 1 **a propósito**: un nombre por concepto, la regla que SCRUM-591 dejó escrita para
«+ Nuevo cliente». El literal vive en **una sola constante**, `FORMA_DE_PAGO_ROTULO_TIRA`, y un
test lo compara **entero y con `===`** — un `includes` dejaría colar «Formas de pago pactadas hoy»
sin que nada cayera, y microcopy aprobada que deriva sola deja de estarlo.

**Por qué «pactadas» y no «por defecto»:** no se eligió una palabra, **se derivó de una ya
firmada**. El fundador aprobó «Descuento pactado (%)» el 4-sep-2026 en el modal de cliente y dejó
escrito el motivo — es la palabra del DOMINIO, un acuerdo con ESE cliente y no una preferencia de
la aplicación. El campo nuevo vive en el mismo modal, a dos campos de distancia.

🔴 **Su registro vive AQUÍ y NO en `docs/microcopy/`**: ese directorio es el del **FUNDADOR** y
`constaAprobado()` lo barre (SCRUM-726), así que una firma del ASESOR metida ahí pasaría por la
suya. Hay un test que lo impide, copiado del que dejó SCRUM-587.

## El censo, ANTES y DESPUÉS — medido con el censo oficial, no a ojo

`node scripts/censo-marcadores.mjs`

| | marcas totales | `quotesView.js` | `atajoNuevo.js` (CONTROL) |
|---|---|---|---|
| **ANTES** | 29 | **4** | 1 |
| **DESPUÉS** | 28 | **3** | 1 |

Las **tres que quedan** en `quotesView.js`, nombradas por el censo:

```
linea  890 · propuestaPagoBtn.textContent = "[PENDIENTE microcopy oficial]";      ← 586, el BOTÓN
linea 1283 · propuestaBtn.textContent     = "[PENDIENTE microcopy oficial]";      ← 587
linea 1318 · propuestaTexto.textContent   = "[PENDIENTE microcopy oficial] · "…   ← 587
```

⛔ **El «Nuevo albarán» de otro ticket NO se ha firmado**, y no se afirma de palabra: el censo lo
cuenta **1 antes y 1 después** (`atajoNuevo.js`), que es el control de que esta firma no se
desbordó a lo que no le tocaba.

### Los contadores

- `FORMA_DE_PAGO_SIN_APROBAR` **2 → 1**. **No baja a 0 y ahí está su valor**: el rótulo del BOTÓN
  no estaba entre los tres literales y sigue sin firmar. Mientras el contador diga 1, «ya no veo
  marcador» no se puede leer como «está aprobado».
- Trinquete de SCRUM-402: `'quotesView.js'` **4 → 3**. La entrada **NO se borra** —al revés que las
  de `customersView.js` o `aiQuoteAssistant.js`, que llegaron a cero— porque quedan tres marcadores
  vivos y `censoActual()` sigue listando el fichero.
- `DTO_POR_DEFECTO_SIN_APROBAR` sigue en **1**: esto no toca `customersView.js`.

## La caja, re-medida CON EL TEXTO FIRMADO YA EN EL FUENTE

Edge por `puppeteer-core`, CSS del árbol servido desde disco, literales **extraídos del fuente por
AST**, control negativo (400 caracteres sin cortes) desbordando en las dos anchuras.

| ancho | bloque útil | caso | tira | texto | botón |
|---|---|---|---|---|---|
| **929 px** | 839,0 px | peor (2 métodos) | 839,0 × 66,0 | **335,1 × 20,3** (1 línea) | 197,8 × **44,0** |
| **929 px** | 839,0 px | un método | 839,0 × 66,0 | 263,7 × 20,3 | 197,8 × 44,0 |
| **390 px** | 324,0 px | peor (2 métodos) | 324,0 × 114,5 | **294,0 × 40,5** (2 líneas) | 197,8 × **44,0** |
| **390 px** | 324,0 px | un método | 324,0 × 94,3 | 263,7 × 20,3 | 197,8 × 44,0 |

El texto entra **en una línea a 929 px** y en **dos a 390 px** en el peor caso, sin desbordar y sin
salirse del viewport. Botón en **44,0 px**: AB6 cumplido.

> 🔴 **Y EL MEDIDOR SE DECLARÓ CIEGO ANTES DE DAR ESTOS NÚMEROS.** Al pasar el literal a una
> constante, su extractor por AST dejó de encontrar el string y **salió con código 2** («no
> encuentro el literal del texto de la tira») en vez de rellenar el hueco. Eso es lo correcto: un
> medidor que adivina habría seguido midiendo el texto de ayer, en verde. Se le enseñó a **resolver
> la constante**, y entonces midió.

## Las mutaciones: 4 → **6**, y las seis en ROJO

Dos nuevas, porque un guard que no se ha visto fallar es una decoración:

| mutación | el rojo que saca |
|---|---|
| el texto firmado vuelve a «Formas de pago por defecto» | «el texto de la tira es el FIRMADO, literal» |
| al botón le quitan el marcador SIN firmarlo | «el rótulo del BOTÓN sigue sin firmar…» |

`vivas 6 de 6`, con la línea base verde delante (SCRUM-748) y las seis vistas por el **lector
oficial** del meta-guard.

## Hueco declarado

- **Los literales 1 y 2 están firmados y NO están en el código**, porque su campo no existe: la
  columna sigue aplicada sólo en dev y `prisma/schema.prisma` es del fundador. Su firma queda
  registrada aquí para que, cuando el campo entre, **el texto ya esté decidido y no se vuelva a
  proponer otro**.
- **El rótulo del BOTÓN sigue sin firmar** (el del 586 y los dos del 587, mismo acto y misma
  frase). Cuando el asesor lo firme, bajan a la vez el contador, el trinquete y el marcador.
