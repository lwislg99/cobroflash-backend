# SCRUM-587 · CONT-14 · El descuento pactado con el cliente, PROPUESTO

**Medido contra:** `origin/main` = `6f8221c66ea6215a22b02247b172969e67ab47ea` · 2026-09-04T17:15:02+01:00
**Rama:** `scrum-587-descuento-por-defecto`

> El ancla se remidió tras mezclar `main` dentro de la rama (AA2): `main` se movió **tres veces**
> durante este carril (`d502c3f4` → `4c590f64` → `da5af22e` → `6f8221c6`). La mezcla fue limpia.

---

## 1 · PASO 0 (regla 39)

### a) ENTRADA — dónde vive hoy, con fichero y línea

| | dónde | qué hay hoy |
|---|---|---|
| la ficha del cliente | [customersView.js:908](../../public/dashboard/js/customersView.js#L908) (`internalRef`), [:999](../../public/dashboard/js/customersView.js#L999) (`recargoEquivalencia`) | el formulario y su `createField`; el campo nuevo va en este bloque |
| el guardado | [customersView.js:1234-1242](../../public/dashboard/js/customersView.js#L1234-L1242) | el payload, con el criterio `|| null` de sus vecinos |
| la validación | [schemas.ts:542](../../src/core/validation/schemas.ts#L542) | el `customerCreateSchema`, que acaba en la 543 |
| el `select` de lectura | [customerAdmin.ts:25](../../src/modules/system/customerAdmin.ts#L25) | qué campos del cliente viajan |
| **dónde se leería al crear el presupuesto** | [quotesView.js:1638-1640](../../public/dashboard/js/quotesView.js#L1638-L1640) | 🔴 **el editor YA resuelve el objeto del cliente elegido** (`customersList.find(...)`) para pintar la vista previa. El dato ya está en la mano; no hay que ir a buscarlo |

### b) MECANISMO — ¿por línea o una vez al abrir? **Se PROPONE, y aterriza en las líneas**

Medido, no elegido: **el único porcentaje que existe en el documento es el `dto` de la LÍNEA**
([schemas.ts:129](../../src/core/validation/schemas.ts#L129)). El descuento global de SCRUM-594 es
un **importe en €** (`discount_global_amount DECIMAL(12,2)`), y esa asimetría está escrita a
propósito por los dos fundadores para que nadie la armonice. Censo: **cero** campos de descuento
global en % en `src/`, `public/` y `prisma/`.

Así que un % pactado sólo puede aterrizar en las líneas. **Propuesta, no aplicación:**

- `propuestaPara(cliente)` **devuelve un dato** y no toca nada.
- `aplicarA(lineas, pct)` es **otra función**, que alguien tiene que llamar.

Son dos y no una a propósito. Si algún día se fusionan en una llamada cómoda, el ticket está roto:
un descuento aplicado en silencio es dinero que sale del bolsillo del profesional sin que lo haya
decidido ESTA vez, y el día que quiera cobrar el precio entero no sabrá por qué le sale otro número.

**Y no pisa lo tecleado a mano:** una línea que ya trae su propio `dto` se queda como está. Un 15 %
escrito hace diez segundos es más reciente y más específico que un acuerdo general.

### c) 🔴 Un presupuesto YA CREADO no se mueve — y es ESTRUCTURAL, no una promesa

`Quote.lines` es una columna **`Json`** ([schema.prisma](../../prisma/schema.prisma), modelo
`Quote`): una **instantánea congelada al crear**. El documento no vuelve a preguntarle nada al
cliente, así que el acuerdo puede cambiar mañana sin reescribir el pasado.

No se deja como argumento: se **ejecuta**. Se guardan las líneas con un 10 %, se lleva el descuento
del cliente a 25, 0, `null` y 100, y se recalcula desde las líneas guardadas. Los céntimos no se
mueven. Además `aplicarA` devuelve **copias** y no muta el array que recibe — con la mutación
puesta a mano, ese test cae.

### d) LA FORMA DE LOS VECINOS — y una corrección al encargo

`nullable().optional()` y **nunca** `.default(0)`: `NULL` = «no hay descuento pactado» y `0` = «se
pactó expresamente un 0 %» son cosas distintas y las dos son legítimas.

📌 **El encargo cita `billingPeriodicity` como ejemplo de esa forma, y medido NO lo es:** es
`String @default("NINGUNA")` ([schema.prisma:102](../../prisma/schema.prisma#L102)) con un
`z.enum(...).optional()` **sin `.nullable()`**. Los que sí llevan la forma buena son
`recargoEquivalencia`, `tipoDestinatario`, `contactKind`, `tags` e `internalRef`. Se ha copiado a
**esos**. El `0` se distingue del `null` en el código y en la base, y hay test de las dos cosas.

### e) `ls-remote` completo (paso 2 de `cerebro-yaqu`)

Sin rama `scrum-587-*` en el remoto: **el carril estaba libre.**

---

## 2 · FASE A — el ALTER, con su antes y su después

**El tipo NO se escribió a mano.** Lo generó `prisma migrate diff` con el **CLI local** (nunca
`npx`, que se baja otro de la red en silencio y devuelve un vacío que se lee como «sin cambios» —
incidente del 5-ago-2026), entre **dos datamodels** en el scratchpad, **sin tocar ninguna base ni
`prisma/schema.prisma`**:

```
ALTER TABLE "customers" ADD COLUMN "dto_por_defecto" DECIMAL(5,2);
```

**Veredicto aditivo** — ni DROP, ni RENAME, ni TRUNCATE, ni SET NOT NULL. **Control positivo:** la
herramienta respondió y el recuento de columnas de `Customer` pasó de **29 a 30**.

🔴 **`DECIMAL(5,2)` y no otra cosa:** tres enteros para el 100 y **dos decimales, los mismos que
`DECIMALES_PORCENTAJE` le exige al `dto` de la línea**. Con más decimales, un `33,333 %` guardado
en el cliente sería un presupuesto que no se puede guardar y el profesional no sabría por qué.
Importa porque `schemaDrift` comprueba que la columna **exista, no su tipo**: creada INTEGER
arrancaría en verde y se pudriría al primer 12,50 %.

**Aplicado SÓLO a la base de desarrollo**, con la herramienta acotada de la casa
(`scripts/aplicar-sql-dev.mjs`, que sólo acepta `DATABASE_URL_DEV`). Destinos acreditados antes con
`scripts/comprobar-claves-bd.mjs` (`DATABASE_URL`: **ausente**, correcto en un árbol de trabajo).

| base física | ANTES | DESPUÉS |
|---|---|---|
| **`yaqu_dev_javier`** (`DATABASE_URL_DEV`) | `dto_por_defecto` **ausente** · 11 filas | `numeric(5,2)` · nullable · **sin default** · 11 filas |
| `railway` (staging/tests) | — | ⛔ **no tocada**: el encargo dice «sólo tu base de desarrollo» |
| producción | — | ⛔ **PENDIENTE, la aplica el fundador** |

**Control positivo en las dos lecturas:** `customers.recargo_equivalencia` (`boolean`) y
`quotes.discount_global_amount` (`numeric(12,2)`). Sin ellos, «no está la columna» no se distingue
de «no se vio nada» — y el segundo es además el control de cómo se ve un DECIMAL bien creado en
esa misma base.

SQL en [`docs/sql/scrum-587-descuento-por-defecto.sql`](../sql/scrum-587-descuento-por-defecto.sql),
verificación con su control positivo en
[`docs/sql/scrum-587-verificar.sql`](../sql/scrum-587-verificar.sql).

### ⛔ Por qué `prisma/schema.prisma` sigue sin tocarse

`schemaDrift` compara **esperado ⊆ real** al arrancar: una columna de MÁS en la base es inocua, una
de MENOS **impide arrancar producción** y Railway deja vivo el despliegue anterior. El esquema, el
cableado y los tests entran juntos y sin partir **cuando las tres bases tengan la columna**. El
guard `constancia-del-alter` (SCRUM-687) ya tumbó un PR hoy por exactamente esto.

---

## 3 · El rojo, probado por el mecanismo

Seis mutaciones sobre `descuentoPorDefecto.js`, cada una rompiendo **una** cosa. Las seis caen, y
**cada una por el test que le toca**, que la nombra. Módulo restaurado y verde al cerrar.

| se rompe | cae |
|---|---|
| 🔴 la **lectura del valor por defecto** (siempre `null`) | «un 0 % PACTADO consta» (6 fallos) |
| `null` y `0` se colapsan (el `\|\| 0` que la columna nullable existe para impedir) | «un cliente SIN descuento pactado» (3) |
| la propuesta **pisa** el `dto` tecleado a mano | «NO pisa el descuento» (1) |
| `aplicarA` **muta** el array recibido | «NO mueve un presupuesto YA CREADO» (3) |
| se **reimplementa** la aritmética en vez de leer la del 594 | «NO reimplementa la aritmética» (1) |
| 🔴 **SUELO**: el censo de clientes con descuento se queda vacío | «SUELO» (2) |

**Control negativo:** renombrar rótulos del cliente (`name`, `legalName`, `internalRef`) **no**
mueve un céntimo. El cálculo está atado al dato, no al texto — que además todavía no está firmado.

**Suelo:** el censo de clientes con propuesta tiene que traer **5 de 6** (sólo el 0 % se queda
fuera). Si sale vacío, el test falla: sin eso, todas las afirmaciones de arriba serían ciertas
sobre un conjunto vacío.

---

## 4 · FASE B · el enganche en el editor

⚠️ **Se avisó antes de tocar `quotesView.js`:** dos ramas sobre ese fichero a la vez (S2 con
SCRUM-602). Autorizado por el asesor, con el motivo suyo: el cableado va en el PR ③ **sin partir**,
y un campo en la ficha que no llega al documento es la mitad que no se ve.

Una **tira** en el bloque de totales, `alert info` (tokens de `DESIGN.md`, cero colores nuevos),
que nace y permanece **oculta** salvo que ese cliente traiga descuento pactado **y** quede alguna
línea sin él. Lleva un botón: **la propuesta no se aplica hasta que alguien lo pulsa.**

La regla —a qué líneas alcanza, y que no pisa un `dto` tecleado a mano— **no se ha copiado al
editor**: `quotesView.js` construye una vista plana de sus líneas, se la da a `aplicarA`, y sólo
escribe las que la pieza pura cambió. Hay un guard por AST que lo vigila.

`descuentoPorDefecto.js` se carga **después** de `quoteDescuentos.js` y **antes** de
`quotesView.js`, declarado en las dos direcciones en `SCRIPTS_DEL_DASHBOARD` y comprobado por
identidad sobre los `<script src>` reales.

### El censo de nodos de SCRUM-698: 242 → 245, aislado

El guard hizo su trabajo y cazó la tira. Son **exactamente tres nodos** (el `div`, su `<span>` y el
botón). **Aislado, no supuesto:** quitando ese único `blockTotals.appendChild(propuestaWrap)` con
el resto del ticket puesto, el control vuelve a **242** y pasa. Las otras tres vistas, intactas.

### El rojo de la superficie: 5 de 6 sondas, y la sexta enseñó algo

| se rompe | cae |
|---|---|
| la tira no se cuelga del bloque de totales | «la tira se PINTA» |
| se inventa microcopy en vez de poner marcador | «grafía que el censo de SCRUM-402 CUENTA» |
| la pieza se carga ANTES de la aritmética que lee | «DESPUÉS de su aritmética» |
| un merge se lleva UNA de las dos llamadas de refresco | «los DOS sitios» |
| 🔴 la regla se **copia** al editor | «no se ha copiado al editor» |

📌 **La sexta sonda no dio rojo, y el fallo era de la sonda:** poner `propuestaWrap.hidden = false`
en el nacimiento deja el test **verde**, porque `recalcTotals` refresca durante el montaje y la
vuelve a ocultar. Lo que se comprueba es el estado **convergido**. Con la sonda correcta —romper
`if (alcance <= 0)`— sí cae, y con su mensaje. Queda escrito en el test para quien venga a
reprobarlo: la primera hipótesis ante un rojo que no aparece es «caso mal elegido», no «guard de
sobra».

### Los seis guards que saltaron, y qué se hizo con cada uno

Ninguno se apagó. Los seis estaban haciendo su trabajo.

| guard | qué dijo | qué se hizo |
|---|---|---|
| **SCRUM-274** | el shell del SW no lleva el script nuevo | se añade a `sw.js` |
| **SCRUM-697** · **SCRUM-698** | 242 → 245 nodos | número actualizado **con el aislamiento medido**, en los dos ficheros |
| **SCRUM-402** (R4/R4b) | «hay marcadores nuevos que pueden pintarse: `quotesView.js` (+2)» | **declarados en el censo con su motivo**: `'quotesView.js': 2` |
| **SCRUM-286** | «ha vuelto un marcador a los títulos del formulario» | 🔴 se **estrecha a su sujeto** (ver abajo) |
| **SCRUM-591** | «ha vuelto un marcador y no está declarado en SCRUM-402» | 🔴 se le hace **cumplir su propia promesa** (ver abajo) |

**🔴 SCRUM-286 · se estrecha, y hay que leer por qué antes de darlo por una relajación.** Miraba
`quotesView.js` **entero** para defender una propiedad de **cuatro títulos de bloque**. Mientras
los títulos fueron el único sitio del fichero con marcadores, las dos cosas coincidían; en cuanto
otro ticket pinta un marcador legítimo en otra parte de la pantalla, el guard se pone rojo
**acusando a los títulos de algo que no ha pasado** — y un rojo que nombra el sitio equivocado se
arregla apagándolo. No se le ha añadido excepción por fichero ni por literal: ahora mira los
títulos, que es su sujeto. **Probado en rojo:** metiendo el marcador en «1. Cliente», cae. Y la
cobertura de todo el fichero no se pierde, la hace mejor el censo del 402, que cuenta por fichero
con trinquete.

**🔴 SCRUM-591 · ahora hace lo que su mensaje ya prometía.** Decía «si vuelve uno, hay que
declararlo en el censo de SCRUM-402» y a la vez prohibía **cualquier** marcador: la vía que
ofrecía no existía, así que el único modo de pasar era borrar el marcador o apagar el test. Ahora
**consulta ese censo por AST** —leyendo el fuente, porque importar un `.test.mjs` correría sus
pruebas— y exige que los marcadores de la vista sean exactamente los declarados. El número vive en
**un solo sitio**. **Probado en rojo dos veces:** con el censo declarando 1 cae diciendo «pinta 2 y
el censo declara 1»; y renombrando el objeto `CENSO` salta su suelo de ceguera en vez de aprobar
cualquier número.

---

## 5 · Lo que NO se ha construido, y por qué

🔴 **El campo en la ficha, el zod y el `select` esperan a las tres bases — y no es prudencia, es
mecánica medida.** [customerAdmin.ts:142](../../src/modules/system/customerAdmin.ts#L142) y
[:159](../../src/modules/system/customerAdmin.ts#L159) meten el cuerpo **ya validado** directo en
el `data` de Prisma. Añadir `dtoPorDefecto` al zod antes de que el modelo lo tenga haría que Prisma
**rechazara cada guardado de cliente que incluyera el campo**. Así que ese bloque es atómico:
`schema.prisma` + zod + ficha + `select`, todo junto, en cuanto confirmes el ALTER.

Mientras tanto el enganche es **inerte y seguro**: sin la columna, el cliente llega sin
`dtoPorDefecto`, `propuestaPara` devuelve `null` y el editor se comporta **exactamente como hoy**.

**El rótulo no está firmado y no se ha inventado ninguno.** Se pinta `[PENDIENTE microcopy oficial]`
—la grafía que el censo de SCRUM-402 **cuenta**— en el botón y en el texto de la tira. El asesor
pidió la caja a 929 px y 390 px para firmarlo: **no se ha podido medir, el servidor de Playwright
lleva caído toda la sesión** (`CONNECT_TIMEOUT`), y no se le da un número calculado como si
estuviera medido. Sigue pendiente con él la caja del contador de SCRUM-582.
