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
herramienta respondió y el recuento pasó de **29 a 30**.

> 🔴 **CORRECCIÓN DEL 4-sep-2026 · ese 29→30 estaba MAL ROTULADO, y el error es mío.** Son **líneas
> de campo del modelo `Customer`**, y **seis de ellas son RELACIONES** (`merchant`, `charges`,
> `Quote`, `Invoice`, `QuoteRequest`, `events`), que no generan columna. Las **COLUMNAS FÍSICAS**
> van de **23 a 24**, medidas en `information_schema`. El ALTER no cambia —sigue siendo una sola
> columna aditiva, y es la que se aplicó— pero el número circuló dos veces con la etiqueta
> equivocada, y un número mal rotulado se hereda como si fuera una medición.

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

## 4-bis · El merge de SCRUM-602, y las dos mitades que se suman

`main` volvió a moverse (`1304643497934441f88950e441182b7e344dbb57`). **Cinco conflictos, los cinco
resueltos SUMANDO**: `sw.js` e `index.html` (los dos scripts), `quotesView.js` (el mismo escuchador
de cambio de cliente llama a `refrescarPropuestaDeDescuento` **y** a `refrescarDireccionObra` —
quedarse con uno deja al otro pegado al cliente anterior) y los dos recuentos de nodos.

**242 → 253, y el número está MEDIDO sobre el árbol mezclado, no sumado a ojo.** Las dos mitades,
aisladas por separado sobre ese mismo árbol:

| árbol | nodos |
|---|---|
| mezclado, entero | **253** |
| sin la tira del 587 | 250 (−3) |
| sin los dos campos del 602 | 245 (−8) |
| sin ninguno de los dos | 242 |

### 🔴 La ceguera del spread: NO estaba arreglada en `main`, y ahora sí

El encargo daba por hecho que `main` había arreglado la ceguera del spread en `scrum286` y pedía
fusionar esa mitad con mi estrechamiento. **Medido: esa mitad no existía.** Lo único que SCRUM-602
tocó de ese instrumento son **dos entradas de `CAMPO_A_BLOQUE`** (+7 líneas); SCRUM-718 tocó
`scrum709` y nada más. No hay `opacos` ni manejo de spread en ningún sitio de `main`.

Y la ceguera **sí era real**, medida sobre el árbol de hoy: metiendo `...({ campoFantasma: 1 })` en
`quotePayload`, el guard seguía **VERDE**. `nombreDePropiedad` devuelve `null` para un
`SpreadAssignment` —no tiene `.name`— y el bucle lo saltaba en silencio. Un campo que viaja al
servidor sin estar colocado en ningún bloque es justo lo que ese censo existe para cazar.

Así que se construye, declarándolo como trabajo NUEVO y no como una mitad recuperada:

- `...({ … })` **literal** → se leen sus claves y entran en el censo. **Con los paréntesis
  desenvueltos**, y esto lo cazó la medición y no la lectura: la forma que se escribe de verdad es
  `...({…})`, donde `p.expression` es un `ParenthesizedExpression`, no el literal. Sin desenvolver,
  el caso legible más común se clasificaba como opaco — seguro, pero falso.
- `...variable` **opaco** → se **declara** en `opacos` y el guard cae. No se sigue la variable:
  seguirla a través de asignaciones es adivinar, y un censo que adivina miente mejor que uno que calla.

**Verificado en los TRES sentidos que pediste, con el guard ya fusionado:**

| sonda | resultado | cae por |
|---|---|---|
| marcador en «1. Cliente» | 🔴 ROJO | «todo título de bloque…» — **mi estrechamiento sigue vivo** |
| campo dentro de `...({…})` | 🔴 ROJO | «ningún campo del envío se queda SIN SITIO» — **se lee** |
| campo tras `...variable` | 🔴 ROJO | el suelo del censo — **declara que no supo mirar** |

## 4-ter · La grafía, y por qué el `@map` no es decorativo

**Censo de `customers` en `information_schema`: 24 columnas · 24 snake · 0 camel.**

📌 **El encargo decía que `customers` «mezcla convenciones». Medido: `customers` NO las mezcla —
pero el repo SÍ, y el aviso era bueno aunque la tabla fuera otra.** Sobre las **419 columnas** del
censo commiteado hay **22 en camelCase**, y ninguna en `customers`: **7 en `invoices`**
(`createdAt`, `customerId`, `merchantId`, `pdfUrl`, `qrData`, `quoteId`, `registerId`) y **15 en
`quotes`**. O sea que el riesgo es real y está a una tabla de distancia; sólo que en ésta el `@map`
hace falta por lo contrario — porque son TODAS snake y el modelo es camel.

El
campo del modelo es camel, así que sin `@map` Prisma buscaría `dtoPorDefecto`, que no existe: el
campo quedaría **construido y no alcanzable**, y el fallo saldría al guardar un cliente.

**Control negativo, ejecutado contra la base de desarrollo y con la fila borrada al final:**

| | |
|---|---|
| ① escrito por Prisma | `dtoPorDefecto = 10.25` |
| ② leído por SQL crudo en `dto_por_defecto` | `10.25` ✅ |
| ③ preguntando por `"dtoPorDefecto"` (camel) | **falla**: `42703 column "dtoPorDefecto" does not exist` ✅ |
| ④ releído por Prisma | `10.25` ✅ |

El ③ es la mitad que hace que esto demuestre algo: sin él, el control daría el mismo verde con
`@map` y sin él. Fila de prueba borrada y comprobado que se fue; teléfono en el rango imposible
`34000000587` (SCRUM-262).

## 4-quater · Las cajas, medidas ahora que Playwright volvió

**El campo de la ficha** (cadena real `.modal-backdrop > .modal > .modal-body > .field`, con el CSS
de producción servido desde el mismo origen):

| viewport | caja del campo | rótulo |
|---|---|---|
| **929 px** | **462,6 px** de ancho · input 43,6 px de alto | 12,5 px / 600 |
| **390 px** | **342 px** de ancho · input 44,5 px de alto | caben **29 caracteres anchos** en una línea |

**El contador de SCRUM-582** — y aquí sólo doy la mitad que está medida. Anchos naturales del
texto, con la fuente real (13,5 px / 600), que no dependen del contenedor:

| texto | ancho natural |
|---|---|
| `1 cliente seleccionado` | 143,4 px |
| `9 clientes seleccionados` | 161,1 px |
| `128 clientes seleccionados` | 175,2 px |
| `1.024 clientes seleccionados` | 188,2 px |

⚠️ **La caja que los contiene NO se ha podido medir**, y no se da un número: la barra vive dentro de
la rejilla del panel, el panel exige sesión, y la base de desarrollo no arranca sin `DATABASE_URL`.
Reproducir la rejilla sobre `login.html` la contamina con el CSS de esa página — salió un `.layout`
de **82 px** en un viewport de 390, que es un número falso y por eso no se usa. Queda pendiente
medirlo con sesión real.

---

## 5 · Lo que NO se ha construido, y por qué

**El bloque del cliente ya está entero** — el ALTER llegó a las tres bases el 4-sep-2026 (staging
`7661649868329066548`, producción `7641555058757427243`) y se aplicó también en desarrollo. En el
orden que el PASO 0 había medido: **el modelo ANTES que el zod**, porque
[customerAdmin.ts:142](../../src/modules/system/customerAdmin.ts#L142) y
[:159](../../src/modules/system/customerAdmin.ts#L159) meten el cuerpo **ya validado** directo en
el `data` de Prisma, y el zod por delante habría hecho que Prisma **rechazara cada guardado de
cliente que incluyera el campo**.

### ✅ MICROCOPY FIRMADA POR EL ASESOR · 4-sep-2026 · el rótulo del campo

> **«Descuento pactado (%)»** — 21 caracteres.
> **Provisional, a la espera del fundador.**

**Firmada CON LA CAJA MEDIDA delante** (§4-quater), que es lo que este ticket cambió respecto a las
anteriores: 21 caracteres en los **342 px** de 390 —donde caben **29 caracteres anchos** en una
línea— y en los **462,6 px** de 929 sin discusión. El input mide **44,5 px**, así que cumple AB6 y
**no se le añade `min-height`**.

El motivo del texto, para que nadie lo «mejore» dentro de seis meses: **«pactado» y no «por
defecto»** porque es la palabra del dominio —es un acuerdo con ESE cliente, no una preferencia de
la aplicación—; y el **`(%)` va DENTRO del rótulo** porque sin él el profesional no sabe si escribe
`10` o `0,10`.

🔴 **Su registro vive AQUÍ y NO en `docs/microcopy/`**: ese directorio es el del **FUNDADOR** y
`constaAprobado()` lo barre (SCRUM-726), así que una firma del asesor metida ahí pasaría por la
suya. Hay un test que lo impide, copiado del que puso S1 en SCRUM-607.

**El contador:** `DTO_POR_DEFECTO_SIN_APROBAR = 1` en la propia vista. Que no se pinte marcador
**no** significa que el fundador haya firmado: eso lo dice el contador. **No se ha sumado al
`SIN_APROBAR = 7` de `filtroClientes.js`** —que cuenta los textos de ESE módulo, el filtro y la
selección de la lista— porque mezclar las dos poblaciones haría que el mismo número significara dos
cosas. Es el defecto que SCRUM-714 viene a cerrar, y el guard fija los dos números.

**Censo de SCRUM-402:** `customersView.js` **entró y salió el mismo día** (1 → 0). Su entrada se
**BORRA**, no se pone a 0.

### Lo que sigue SIN firmar, y por qué

**El texto de la tira y su botón** siguen con `[PENDIENTE microcopy oficial]` (los 2 de
`quotesView.js` en el censo): no se firman porque **no se tiene su caja**.

**Y lo que sigue sin medirse se dice, en vez de calcularlo:** la caja que contiene el contador de
SCRUM-582. Los anchos naturales del texto sí están medidos; el contenedor no, porque exige sesión.
Un texto aprobado contra una caja falsa es peor que un texto sin aprobar.
