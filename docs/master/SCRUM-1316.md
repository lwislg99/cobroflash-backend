# SCRUM-1316 · Punto ① — ¿El producto aplica hoy el 10 % de IVA en algún sitio? Censo de `src/`

**Medido contra:** `origin/main` = `e9e71cab67574538943cd94392bdecf5f3dcbfa2` · 2026-10-01T00:44:52Z

A9: aviso → A10 «Un número derivado no se elige: se recalcula.» — no se pudo comprobar: el número que conté de memoria (§Ⓗ) iba en un mensaje entre sesiones, y eso no lo lee ningún guard; aquí va el recontado.

**Skill UI:** no cargada · solo lectura: este registro cita rutas de `public/` para decir qué hay, y no toca ningún componente ni ningún texto

Sesión J5, por encargo del orquestador del equipo de Javier (`cobroflash-backend-5b`), con GO de Javier
al ticket. **Aquí solo se lee y se cuenta.** No se toca `src/`, ni `public/`, ni el esquema, ni ningún
tipo de IVA (regla 40). No se consulta ninguna base. No se propone texto de pantalla (regla 39). **No
se contesta la pregunta legal:** eso es del asesor. No es una afirmación fiscal de producto (regla 7).

Solo cubre el **punto ①** del ticket. Leer el Real Decreto-ley 26/2026 entero, mirar su convalidación y
corregir los documentos que citan la redacción vieja son los puntos ② y ③, y **no están hechos**.

**De dónde viene.** El RDL 26/2026 (`BOE-A-2026-20266`, efectos 1-dic-2026) condiciona el tipo reducido
del art. 91.Uno.2.10.º LIVA al medio de pago. El literal y cómo se encontró están en el apéndice de
`docs/master/SCRUM-1253.md`, §Ⓜ. La pregunta de este registro es anterior a cualquier otra: si el
producto **aplica** ese tipo en algún sitio, y si sabe **cómo se cobró**.

## Veredicto

1. **El programa no elige el 10 % en ningún sitio.** De **36** sitios de `src/` que escriben un tipo de
   IVA, **ninguno** escribe una constante de 21, 10 o 4. El 10 % lo elige el profesional en un
   desplegable.
2. **El 10 % sí está vivo como OPCIÓN.** El desplegable de la línea y el del «IVA por defecto» del
   documento lo ofrecen, y el servidor lo valida, lo clasifica en el 303 y le calcula el recargo.
3. **Lo que el programa pone solo es el 21 %**, como valor inicial del formulario y en las
   instrucciones a la IA.
4. **El medio de cobro se guarda, pero no en todos los cobros.** Existe el valor `cash`. Al marcar una
   factura cobrada a mano, declararlo es opcional. En lo que pasa por pasarela, el campo mezcla lo que
   se pretendía con lo que pasó.

**Qué cambia de tamaño.** No hay nada que corregir en el camino de emisión para que el producto «deje
de aplicar» el 10 %, porque no lo aplica. Lo que queda es otra cosa: el producto **ofrece** el 10 %,
sabe para qué es (lo dice la cabecera de su propio fichero, §Ⓑ.1), y no avisa ni puede saber si se
cumplirá la condición del medio de pago. Eso es una decisión de producto y de texto, y es de Javier.

## Ⓐ Dónde se escribe un tipo de IVA en `src/`

**Población:** 310 ficheros `.ts` en `src/` (`git ls-files src`). **Patrón:** una línea que no sea
comentario y que contenga `tax:`, `tipoIva:` o `vat:` seguido de un valor, o una asignación a `.tax`,
`.tipoIva` o `.vat`; se descartan las declaraciones de tipo de TypeScript. **Resultado: 36 líneas.**

```
grep -rn -E "\b(tax|tipoIva|vat)\s*:\s*[^,;]+|\b(\.tax|\.tipoIva|\.vat)\s*=[^=]" src --include=*.ts \
  | grep -v -E "^\S+:[0-9]+:\s*(//|\*|/\*)" \
  | grep -v -E "(tax|tipoIva|vat)\??\s*:\s*(number|unknown|string|true|false|z\.|any|Decimal|Prisma|null \||number \|)"
```

| clase | cuántas |
|---|---|
| **D** · dependen de un dato (copian o convierten lo que trae la línea, el albarán, el producto o la entrada) | **22** |
| **C0** · constante `0` | **5** |
| **CN** · constante `null` | **2** |
| **N** · no son escrituras de un tipo | **7** |
| constante **distinta de cero** (21, 10 o 4) | **0** |
| total | **36** |

Las 36, una por una. Las coordenadas son del sha del ancla; al lado va lo que dice la línea, que es lo
que no caduca.

| # | sitio | lo que escribe | clase |
|---|---|---|---|
| 1 | `src/lib/invoicing.ts:337` | `tax: 0` en la línea única de un cobro sin líneas de presupuesto | C0 |
| 2 | `src/modules/ai/domain/ai.service.ts:134` | `tax: { type: 'NUMBER' }` (esquema de la respuesta de la IA) | N |
| 3 | `src/modules/ai/domain/ai.service.ts:280` | `linea.tipoIva = Number(bruto)` si `invalidTipoIva` no lo rechaza | D |
| 4 | `src/modules/ai/domain/ai.service.ts:363` | `propiedades.tipoIva = { type: 'NUMBER' }` (esquema) | N |
| 5 | `src/modules/expenses/domain/lecturaTicket.ts:97` | texto del prompt de lectura de tickets de gasto | N |
| 6 | `src/modules/expenses/domain/lecturaTicket.ts:114` | `tipoIva: { type: 'NUMBER', … }` (esquema) | N |
| 7 | `src/modules/fiscal/librosAeat/librosAeat.ts:238` | `tipoIva: a.tipoIva` | D |
| 8 | `src/modules/fiscal/librosAeat/librosAeat.ts:312` | `tipoIva: null` | CN |
| 9 | `src/modules/fiscal/librosAeat/librosAeat.ts:317` | `tipoIva: null` | CN |
| 10 | `src/modules/fiscal/librosAeat/librosAeat.ts:325` | `tipoIva: t.tipo` | D |
| 11 | `src/modules/invoicing/domain/finalInvoice.service.ts:96` | `tax: e.rate / 100`, el tipo del anticipo que se descuenta | D |
| 12 | `src/modules/invoicing/domain/finalInvoice.service.ts:112` | `tax: 0` para un anticipo antiguo sin desglose | C0 |
| 13 | `src/modules/invoicing/domain/invoiceLines.service.ts:137` | `tax: rate / 100` en la línea del descuento global | D |
| 14 | `src/modules/invoicing/domain/libroRecibidas.ts:208` | `tipoIva: tipo(g.vatRate)` (gastos) | D |
| 15 | `src/modules/invoicing/domain/recargoEquivalencia.ts:85` | lee y convierte `tipoIva` para calcular | N |
| 16 | `src/modules/invoicing/domain/recargoEquivalencia.ts:94` | devuelve `tipoIva: iva` en el resultado | N |
| 17 | `src/modules/invoicing/infra/pdf/pdf.service.ts:545` | acumulador `{ base: 0, vat: 0 }` del desglose del PDF | N |
| 18 | `src/modules/jobs/app/routes/albaranes.routes.ts:1288` | `tax: l.tipoIva / 100` | D |
| 19 | `src/modules/jobs/app/routes/partes.routes.ts:205` | `tipoIva:` lo que trae la línea, o `null` | D |
| 20 | `src/modules/jobs/domain/albaran.service.ts:121` | `linea.tipoIva = tipoIva` | D |
| 21 | `src/modules/jobs/domain/albaran.service.ts:383` | `tipoIva: l.tipoIva ?? null` | D |
| 22 | `src/modules/jobs/domain/albaranAFactura.ts:187` | `tax:` el del presupuesto si es un número, si no `0` | D |
| 23 | `src/modules/jobs/domain/albaranAFactura.ts:318` | `tax: 0` | C0 |
| 24 | `src/modules/jobs/domain/albaranAFactura.ts:327` | `tax: l.tax` | D |
| 25 | `src/modules/jobs/domain/albaranFacturacion.ts:102` | `tipoIva: Number(l?.tipoIva) \|\| 0` | D |
| 26 | `src/modules/jobs/domain/albaranVerificacion.ts:199` | `tipoIva: l.tipoIva ?? null` | D |
| 27 | `src/modules/jobs/domain/albaranVerificacion.ts:233` | `tipoIva: l.tipoIva ?? null` | D |
| 28 | `src/modules/jobs/domain/albaranVerificacion.ts:292` | `tipoIva: l.tipoIva ?? null` | D |
| 29 | `src/modules/jobs/domain/parteTrabajo.ts:196` | `tipoIva: antes.tipoIva ?? null` | D |
| 30 | `src/modules/jobs/domain/recapitulativa.service.ts:94` | `tax: (Number(l.tipoIva) \|\| 0) / 100` | D |
| 31 | `src/modules/maintenance/domain/maintenance.service.ts:374` | `tax: 0` en la línea inicial de un plan | C0 |
| 32 | `src/modules/products/app/routes/products.routes.ts:322` | `vat:` lo que manda el alta, o `null` | D |
| 33 | `src/modules/products/app/routes/products.routes.ts:358` | `patch.vat =` lo que manda la edición, o `null` | D |
| 34 | `src/modules/products/domain/products.service.ts:59` | `vat: input.vat ?? null` | D |
| 35 | `src/modules/quotes/domain/presupuestoSello.ts:140` | `tipoIva: cantidad(l.taxRate)` | D |
| 36 | `src/modules/system/app/routes/invoicesAdmin.routes.ts:1050` | `tax: 0` en la línea única de una rectificación sin líneas | C0 |

**Segunda pasada, por si el tipo va en una variable.** Patrón: un nombre (`tax`, `tipoIva`, `vat`,
`iva`, `taxFrac`, `tipo`) seguido de `:`, `=`, `??` o `||` y de un literal `0.xx`, `21`, `10` o `4`.
**3 líneas, las tres en `src/modules/fiscal/modelo303/casillas.ts`** (42 a 44): la tabla que dice a qué
casilla del 303 va cada tipo. Clasifica, no elige.

## Ⓑ ¿Hay un 10 % (o un 4 %) vivo? Sí. ¿Quién lo elige? El profesional

Dónde aparece el 10 % en código que se ejecuta, y qué hace en cada sitio:

1. **`public/dashboard/js/tiposDeIva.js`** — `var TIPOS_ES = [21, 10, 4, 0];`. Son las opciones del
   desplegable de IVA de cada línea y del «IVA por defecto» del documento. La cabecera del fichero
   dice para qué está el 10: «el 10 % es habitual en obras de renovación en vivienda: teclearlo cada
   vez es fricción en la pantalla que el máster quiere resolver en 30 segundos». **Lo elige quien
   escribe el documento.**
2. **`src/core/validation/fiscalInput.ts`** — `TIPOS_IVA_ES_BP`, en puntos básicos: 0, 2, 4, 5, 7,5,
   10 y 21 %. `invalidTipoIva` solo comprueba que el tipo **exista**. No elige. De ella deriva el
   portón de `src/core/validation/tiposIvaEmitibles.ts`, que se llama antes de pedir número.
3. **`src/modules/fiscal/modelo303/casillas.ts`** y **`src/modules/invoicing/domain/recargoEquivalencia.ts`**
   (`RECARGO_POR_TIPO_IVA`: 21 → 5,2; 10 → 1,4; 4 → 0,5). **Clasifican** una línea que ya trae su tipo.
4. **Gastos** (`public/dashboard/js/expensesView.js`, `src/modules/expenses/domain/lecturaTicket.ts`).
   Es el IVA **soportado** de los tickets de compra, no el que repercute el profesional. No es la
   pregunta de este ticket.

**Lo que el programa pone solo es el 21 %:**

- El formulario del documento nace con «IVA por defecto» en 21 (`public/dashboard/js/quotesView.js`:
  `tiposDeIva.opciones(21)` y `ponerValor(…, "21")`), y hay **4** respaldos `|| "21"` en ese fichero.
- La línea de albarán nace con 21 si no trae tipo (`public/dashboard/js/jobDetailView.js`: `… : 21`).
- Los dos prompts de la IA piden «0.21 (ES/AR)» (`src/modules/ai/domain/ai.service.ts`,
  `SUGGEST_SYSTEM` y `ALBARAN_SYSTEM_VALORADO`).

**El servidor no siembra ningún tipo.** Desde SCRUM-646 el catálogo por gremio nace sin IVA
(`src/modules/products/app/routes/products.routes.ts`, ruta `/load-catalog`). `defaultVat` solo
aparece, fuera de comentarios, en `src/core/i18n/locales.ts`: su declaración, los seis países y la
línea que lo pasa al cliente; en `public/` no lo lee nadie (solo comentarios).

**Ninguna regla del código mira si la obra es en una vivienda, si el cliente es un particular o qué
parte son materiales para poner el 10 %.** Buscados fuera de comentarios en `src/`: «reducido»,
«superreducido», «rehabilitación», «10 %», «4 %» y «vivienda». Solo sale «vivienda», en dos nombres de
producto de `src/core/data/tradeCatalogs.ts`, y un «REDUCIDO» que habla del perfil del negocio.

## Ⓒ ¿Se guarda CÓMO se cobró? Sí, en dos sitios, y no en todos los cobros

1. **`Charge.method`** (`String`, obligatorio; `prisma/schema.prisma`, modelo `Charge`). Para lo que
   pasa por pasarela. El vocabulario es cerrado, `PAID_VIA` en `src/modules/billing/domain/paidVia.ts`:
   `card`, `bizum_auto`, `bizum_manual`, `transfer`, `cash`, con pasarela opcional detrás (`card:stripe`).
   🔴 **Es ambiguo en parte del histórico**, y lo dice el propio esquema, en el comentario de
   `Invoice.paidVia`: `Charge.method` «guardó a la vez la intención (`card`) y el hecho (`card:stripe`),
   y mirando una fila no se puede saber cuál de las dos es». Existe además el valor `desconocido`
   (`METODO_DESCONOCIDO`, en `src/modules/billing/domain/metodoDeCobro.ts`).
2. **`Invoice.paidVia`** (`String?`, sin valor por defecto). Para la factura que el profesional marca
   cobrada **a mano**. Solo se escribe si declara el método: `campoPaidViaAlMarcar`
   (`src/modules/billing/domain/metodoDeCobro.ts`) devuelve un objeto vacío, «no se toca la columna»,
   cuando marca cobrada sin indicarlo. El mismo fichero dice que la pantalla tiene una opción «sin
   especificar» que «no escribe nada». **`NULL` significa «no consta».**
3. **El efectivo existe como valor** (`cash`, que se puede declarar a mano), igual que la transferencia
   y el Bizum confirmado por una persona.

**Respuesta.** El dato existe y distingue el efectivo de lo demás, pero es **opcional** en el cobro a
mano y **ambiguo** en parte de lo que pasó por pasarela. **Cuántas filas están en `NULL` o guardan la
intención en vez del hecho: SIN DETERMINAR.** No se ha mirado ninguna base.

## Ⓓ El control: el detector sabe decir «éste sí»

Un cero solo vale si el instrumento sabe encontrar lo que busca. Los mismos patrones que dan **0**
constantes de tipo reducido en las escrituras de línea encuentran:

- **el 21**: `tipo: 21` en `casillas.ts`, `defaultVat: 0.21` en `locales.ts`, los dos prompts de la IA,
  y en `public/dashboard/js` las siembras de `quotesView.js` y `jobDetailView.js`;
- **el 10**: `tipo: 10` en `casillas.ts`, el `1000` de `TIPOS_IVA_ES_BP`, la clave `10` de
  `RECARGO_POR_TIPO_IVA` y el `10` de `TIPOS_ES`.

Ve el 10 donde está. Y donde está, no es una decisión del programa.

## Ⓔ Los límites de este censo

1. **Es `grep` con patrón, no un análisis del árbol sintáctico.** No ve una escritura por atajo
   (`{ tax }`) ni por propagación (`...linea`). Esas copian una variable y no introducen una constante;
   la segunda pasada busca la constante en la variable. **No cubre** un tipo calculado por aritmética a
   partir de una constante escrita lejos.
2. **De `public/` solo se ha leído `public/dashboard/js`**, buscando literales junto a `iva`, `vat` o
   `tax`. Las páginas públicas de pago y el PDF pintan un tipo que ya viene dado; eso está leído por
   encima, no censado.
3. **LATAM queda fuera.** Los tipos 0,16, 0,18 y 0,19 existen en `locales.ts` y no se han seguido.
4. **Nada se ha ejecutado.** Todo es lectura del fuente en el sha del ancla.

## Ⓕ Lo que es inferencia de una IA y no lectura del código

Quien escribe esto es una sesión de IA (J5). Las tres conclusiones de abajo **no** son una línea del
código ni de la norma, y ningún asesor las ha visto.

1. **«La IA del producto podría proponer un 10 %».** El prompt pide 0,21 para España y la comprobación
   posterior aceptaría cualquiera de los siete tipos españoles. Que el modelo lo haga alguna vez **no
   está medido**.
2. 🔴 **El problema de orden.** El tipo se fija en la línea al presupuestar o al emitir. El medio de
   pago se conoce **después**, al cobrar. Y una factura emitida no se edita (regla 29). Si el tipo
   pasa a depender del medio de pago, el dato que lo condiciona llega cuando el documento ya no se
   puede tocar. La excepción es la factura que nace **del** cobro (el webhook de pago llama a
   `ensureInvoiceForCharge`): ahí el medio ya consta en ese momento. Lo deduzco de leer el flujo; no
   lo he ejecutado, y **no he medido cuánto se usa cada camino**.
3. **Qué obligación tiene quién.** Que el tipo lo teclee el profesional es un **hecho** y está
   medido. Que por eso la obligación sea solo suya es una **conclusión jurídica**, y no la saco. Qué
   responsabilidad tiene un programa que ofrece el 10 % en un desplegable sin avisar de la condición
   nueva: **→ ASESOR**.

## Ⓖ Lo que sigue abierto en el ticket (no hecho aquí)

- **Punto ②:** leer el RDL 26/2026 entero en el BOE y comprobar si el Congreso lo ha convalidado.
  ⚠️ Quien lo coja: el extractor `docs/master/evidencias/SCRUM-1232b/extraer-articulo.cjs` corta por
  vigencia en una **fecha fija**, el 28-sep-2026. Después del 1-dic-2026 seguirá devolviendo la
  redacción **anterior** del art. 91 si nadie mueve esa fecha.
- **Punto ③:** corregir los documentos de `docs/legal/` que dan el art. 91.Uno.2.10.º por confirmado
  con la redacción anterior y citando una fuente secundaria.
- **Si Bizum cuenta como «transferencia bancaria»:** el texto no lo dice. **→ ASESOR.**

## Ⓗ Lo que me salió mal

**Conté de memoria un número que tenía delante.** En la entrega por mensaje al orquestador dije que
`quotesView.js` tenía «cinco respaldos `|| "21"`». Al escribir este registro lo volví a contar con
`grep -c`: son **4**. No cambia ninguna conclusión, pero el mensaje llevaba un número que no había
medido. Aquí va el medido.

---

# SCRUM-1316b · Puntos ② y ③ — el Real Decreto-ley 26/2026 fue DEROGADO, y el 29/2026 lo repite

**Medido contra:** `origin/main` = `e883e586d11298ca09d58cd3fa89937b7b0549bd` · 2026-10-07T15:52:45Z

A9: aviso → A10 «La fecha de vigencia de un texto consolidado no es la fecha desde la que se aplica: se lee la nota, no el atributo.» — no se pudo comprobar: el dato vive en el BOE y la tanda de CI no sale a la red; un test sobre un XML fabricado probaría mi guion, no al próximo que corte por ese atributo.

Sesión J5 (IA), 7-oct-2026, por encargo del orquestador del equipo de Javier (`cobroflash-backend-90`).
**Aquí se lee el BOE y se anotan documentos internos.** No se toca `src/`, ni `public/`, ni el esquema,
ni ningún tipo de IVA (regla 40). No se propone texto de pantalla (regla 39). **No se contesta la
pregunta legal:** eso es del asesor. Nada de esto es una afirmación fiscal de producto (regla 7).

**Todo lo de arriba (el punto ①) sigue siendo cierto y no se toca.** Lo que cambia es la norma que lo
motivó. Lo de arriba era verdad el 1-oct-2026; esto es lo que es verdad el 7-oct-2026.

## Veredicto

1. **El Real Decreto-ley 26/2026 está derogado.** El Congreso acordó derogarlo el **2-oct-2026**, tres
   días después de publicarse. No se convalidó ni se tramitó como proyecto de ley: no hay un texto
   cambiado, hay una derogación. Su modificación del art. 91 LIVA quedó sin efecto.
2. **El 7-oct-2026 el BOE publica el Real Decreto-ley 29/2026, de 6 de octubre** (`BOE-A-2026-20823`),
   con el mismo título, que **vuelve a modificar el art. 91.Uno.2.10.º con efectos de 1 de diciembre
   de 2026**. En ese número, su texto es el del 26/2026 palabra por palabra.
3. **El 29/2026 no está convalidado** a 7-oct-2026. Se publicó ese mismo día. La fecha del 1-dic sigue
   en pie, colgada de una votación que el texto anterior, idéntico en este punto, perdió cinco días
   antes. **No se predice el resultado.**
4. **Lo que el texto NO dice**, y es lo que se le pregunta al asesor: no hay régimen transitorio para
   obras empezadas o cobradas en parte antes del 1-dic; no define «transferencia bancaria» ni nombra
   Bizum; y no impone ninguna obligación de acreditar el medio de pago.
5. 🔴 **Un instrumento nuestro acierta hoy por casualidad** (§Ⓝ): desde el 8-oct-2026, cortar el BOE
   consolidado por `fecha_vigencia` devuelve la redacción con la condición del medio de pago como si ya
   rigiera, cuando sus efectos son del 1-dic.
6. **Nuestros documentos:** lo que describen del art. 91.Uno.2.10.º **es la redacción que se aplica
   hoy**; cotejada contra el BOE, coincide. Lo que estaba mal era la fuente (una base de datos jurídica)
   y que nada avisaba del cambio publicado. Anotados cuatro documentos y dos registros (§Ⓞ).

## Ⓘ Las fuentes, bajadas el 7-oct-2026 a las 15:44Z

Dos vías, y cada una para lo suyo. La **API de legislación consolidada**
(`boe.es/datosabiertos/api/legislacion-consolidada/id/<ID>/…`) para saber qué rige de una ley y en qué
estado está una norma. El **XML del diario** (`boe.es/diario_boe/xml.php?id=<ID>`) para leer entero un
real decreto-ley, que es texto original por definición. Las ocho peticiones de la tabla respondieron 200.

| qué | identificador | sha256 |
|---|---|---|
| LIVA consolidada, texto | `BOE-A-1992-28740` | `5fb06ddd1015fb9b42fb76f8fccfaddd5335ca4ce488b085197f0aa658a8d34d` |
| RDL 26/2026, diario | `BOE-A-2026-20266` | `26eec5e2347e9984583730215165e21c5b642bb8c0ca6503c817c44437ea20c6` |
| RDL 26/2026, metadatos del consolidado | ídem | `1d1c0348dd436b7954bf4960972279623875975a568b00d6338429cf26bb3e33` |
| RDL 26/2026, análisis | ídem | `23de3cbe23ffd1a2e87c6366e6cc6f5a8ed60a27442ff50e71031c60e04db19d` |
| Resolución de derogación, diario | `BOE-A-2026-20526` | `c93804d6e0cb6340528344e7b3e9f5237fc403d286cea91671cea95795bdaa7c` |
| RDL 29/2026, diario | `BOE-A-2026-20823` | `85fd8f495be14e00b85595152ec21ebd70059917afae9a12f28105468c835786` |
| RDL 29/2026, metadatos del consolidado | ídem | `2b7dcb71c32154e27b644acbf25ab22c99343fd37a31d170ff1a25cc7bfa6c9b` |
| RDL 29/2026, análisis | ídem | `0b97a3c40c587d99da937ce344f7b3dd03e5b0ad760237cf9df191cd6f141bed` |

La LIVA de hoy **no es** la del 1-oct (`e2386e75…`, en `docs/master/SCRUM-1253.md` §Ⓘ): el BOE la
actualizó el 7-oct a las 09:23Z (`fecha_actualizacion` de sus metadatos).

**El control de que la API da el consolidado**, que el ticket exige: el art. 91 trae una versión
**publicada el mismo día de la consulta**. No cabe uno más reciente.

Los XML no están en el repo (la LIVA pesa 5,6 MB). Están en la máquina de Javier, carpeta `yaqu-censos`,
subcarpeta `scrum1316`, con `sha256-2026-10-07.txt` al lado. Lo que sí está en el repo, en
`docs/master/evidencias/scrum1316/`: los tres guiones, el art. 7 de cada real decreto-ley en texto
plano, la resolución de derogación y la salida del art. 91 versión a versión.

## Ⓙ El 26/2026: derogado

Metadatos del consolidado de `BOE-A-2026-20266`, literales: `estatus_derogacion` = `S`,
`fecha_derogacion` = `20261002`, `vigencia_agotada` = `S`.

La norma que lo deroga es `BOE-A-2026-20526`, «Resolución de 2 de octubre de 2026, del Congreso de los
Diputados, por la que se ordena la publicación del Acuerdo de derogación del Real Decreto-ley 26/2026»
(BOE núm. 245). Su texto entero:

> «De conformidad con lo dispuesto en el artículo 86.2 de la Constitución, el Congreso de los
> Diputados, en su sesión del día de hoy, acordó derogar el Real Decreto-ley 26/2026, de 29 de
> septiembre, por el que se adoptan medidas urgentes para la protección de la función social de la
> vivienda y la ampliación de la oferta de vivienda asequible, publicado en el "Boletín Oficial del
> Estado" número 241, de 30 de septiembre de 2026.»

Y el análisis del BOE de esa resolución dice que **deja sin efecto** «la modificación, con efectos
desde el 1 de diciembre de 2026, de los arts. 20 y 91 de la Ley 37/1992, de 28 de diciembre».

## Ⓚ El 29/2026: el mismo art. 7, publicado el día de esta medición

Metadatos del consolidado de `BOE-A-2026-20823`: disposición del `20261006`, publicación `20261007`
(BOE núm. 249), `fecha_vigencia` = `20261008`,
`estatus_derogacion` = `N`. Nota del análisis: «Entrada en vigor, con la salvedad indicada en la
disposición final 11, el 8 de octubre de 2026».

**Su art. 7.Tres**, literal del diario (`evidencias/scrum1316/art7-rdl29-2026.txt`):

> «Tres. Con efectos desde el 1 de diciembre de 2026, se modifica el artículo 91.Uno.2, número 10.º,
> con la siguiente redacción:
> "10.º Las ejecuciones de obra de renovación y reparación realizadas en edificios o partes de los
> mismos destinados a viviendas, cuando se cumplan los siguientes requisitos:
> a) Que el destinatario sea persona física, no actúe como empresario o profesional y utilice la
> vivienda a que se refieren las obras para su uso particular.
> No obstante lo dispuesto en el párrafo anterior, también se comprenderán en este número las citadas
> ejecuciones de obra cuando su destinatario sea una comunidad de propietarios o cuando se trate de
> viviendas destinadas a su arrendamiento como vivienda habitual, cualquiera que sea la condición del
> arrendador.
> La aplicación del tipo reducido queda condicionada a que el importe de la contraprestación de las
> ejecuciones de obras haya sido satisfecho mediante tarjeta de crédito o débito, transferencia
> bancaria, cheque nominativo o ingreso en cuentas en entidades de crédito a favor de los sujetos
> pasivos que las realicen.
> b) Que la construcción o rehabilitación de la vivienda a que se refieren las obras haya concluido al
> menos dos años antes del inicio de estas últimas.
> c) Que la persona que realice las obras no aporte materiales para su ejecución o, en el caso de que
> los aporte, su coste no exceda del 40 por ciento de la base imponible de la operación".»

**Comparado con el art. 7 del 26/2026**, párrafo a párrafo (`diff` de los dos ficheros de evidencias):
19 párrafos cada uno, **2 distintos, y los dos son de puntuación** (una coma tras «letra e')» y el
orden del punto y las comillas al cerrar la letra c). El párrafo del medio de pago y el del alquiler
habitual son idénticos.

**El preámbulo lo dice él mismo.** Que las circunstancias de urgencia, «apreciadas con ocasión de la
adopción del Real Decreto-ley 26/2026 […] se mantienen en la actualidad», y que «la aprobación y
remisión al Congreso de los Diputados, para su convalidación, de un real decreto-ley, tras la
derogación de otro de contenido parcial o sustancialmente coincidente, no es ajena al ordenamiento
jurídico».

**Convalidación del 29/2026: no consta nada.** Su análisis en el BOE lista una sola norma posterior (el
Real Decreto-ley 28/2026, «se dicta en relación» con la disposición final 5.ª, de alquileres) y ninguna
convalidación ni derogación. No se ha mirado la web del Congreso, por orden del orquestador: el BOE no
da fecha de votación y predecirla no es este trabajo.

## Ⓛ El 29/2026 leído entero: qué trae y qué no sobre el 10 % de las obras

**Población:** 1.205 párrafos (`plano-del-diario.cjs` sobre el XML del diario). Búsquedas sobre ese
texto plano, con sus dos controles: una cadena inventada da **0** y «tarjeta de crédito» da **1**.

| se buscó | párrafos | dónde y qué |
|---|---|---|
| «Valor Añadido» | 3 | uno del preámbulo y los dos que abren el art. 7 |
| «tarjeta de crédito» | 1 | el art. 7.Tres |
| «transferencia bancaria» | 2 | el art. 7.Tres, y una regla de traspaso de cuentas de ahorro que no tiene que ver |
| «medio de pago» / «medios de pago» | **0** | — |
| «Bizum» | **0** | — |
| «efectivo» | 26 | **ninguno** habla del IVA de las obras: son de la cuenta de ahorro, «precio efectivo», «cumplimiento efectivo» |
| «ejecuciones de obra» | 3 | los tres dentro del art. 7.Tres |

De ahí, cuatro hechos del texto:

1. **No nombra el efectivo.** Lo deja fuera por lista: enumera cuatro medios y condiciona el tipo a
   ellos.
2. **No define «transferencia bancaria»** ni dice nada de Bizum. → ASESOR.
3. **No tiene régimen transitorio para esto.** Trae dos disposiciones transitorias y ninguna es de IVA
   (prórrogas de alquiler; ejecuciones y lanzamientos en curso). Qué pasa con una obra empezada antes
   del 1-dic, o cobrada una parte antes y otra después, el texto no lo dice. → ASESOR.
4. **No obliga a acreditar el medio de pago ni dice cómo.** Ni en el art. 7 ni en una habilitación
   propia: la disposición final 8.ª es la genérica («cuantas disposiciones sean necesarias»). Lo único
   que añade el preámbulo es que entre los requisitos «figuran el pago mediante los medios bancarios
   especificados». → ASESOR.

**¿Trae el 29 algo que el 26 no traía y que nos toque en otro sitio?** Entre los dos textos hay 95
bloques de diferencia: 35 son solo de puntuación o del número del real decreto-ley, y 60 cambian
palabras. Comparados por párrafo (ignorando puntuación), **126** párrafos del 29 no están en el 26 y
**114** del 26 no están en el 29. De esos, los que contienen alguna palabra de facturación, de IVA o
de obra («Valor Añadido», «IVA», «factur», «ejecución de obra», «renovación», «reparación»,
«rehabilit», «autónom», «empresario o profesional», «tipo reducido», «medio de pago», «tarjeta»,
«cheque») son **10** en el 29 y **14** en el 26. Leídos los 24: son correcciones de erratas del
preámbulo, la definición de gran tenedor, la línea de avales TU CASA y un párrafo del preámbulo sobre
el IVA de los alquileres de corta duración. **Ninguno toca las obras, la factura ni el medio de pago.**
Control: las mismas palabras casan con 57 párrafos del 29 entero, así que el filtro ve.

**Límite:** eso es un filtro por palabras sobre los párrafos que cambian, no una lectura jurídica de
las 60 diferencias. Los títulos que no son fiscales (alquileres, desahucios, cuenta de ahorro) se han
recorrido por sus rótulos, no artículo por artículo.

## Ⓜ Qué dice hoy la LIVA consolidada del art. 91.Uno.2.10.º

`node docs/master/evidencias/scrum1316/versiones-art91.cjs <LIVA.xml>`; la salida está guardada en
`evidencias/scrum1316/art91-versiones-2026-10-07.txt`. **Población: 44 versiones del art. 91.** Las
cuatro últimas:

| norma que la introduce | publicada | `fecha_vigencia` | ¿condición del medio de pago? |
|---|---|---|---|
| Ley 7/2024 (`BOE-A-2024-26694`) | 21-dic-2024 | 22-dic-2024 | no |
| RDL 26/2026 (`BOE-A-2026-20266`) | 30-sep-2026 | **1-dic-2026** | sí |
| Resolución de derogación (`BOE-A-2026-20526`) | 2-oct-2026 | 2-oct-2026 | no |
| RDL 29/2026 (`BOE-A-2026-20823`) | 7-oct-2026 | **8-oct-2026** | sí |

La versión de la resolución restaura, letra a letra, el número 10.º de la de 2024.

## Ⓝ 🔴 El instrumento que acierta por casualidad

`docs/master/evidencias/SCRUM-1232b/extraer-articulo.cjs` devuelve «la última versión con
`fecha_vigencia` ≤ una fecha», y esa fecha está escrita a mano: el 28-sep-2026. El punto ① de este
registro ya avisaba de que había que moverla después del 1-dic. **El aviso se ha quedado corto, y en la
dirección contraria.**

La versión del 26/2026 venía con `fecha_vigencia="20261201"`: el atributo coincidía con la fecha de
efectos. **La del 29/2026 viene con `fecha_vigencia="20261008"`**, el día de entrada en vigor del real
decreto-ley, aunque su nota al pie dice «con efectos de 1 de diciembre de 2026». Medido con
`evidencias/scrum1316/corte-por-fecha-vigencia.cjs`, que repite ese filtro con cinco fechas:

| el corte se hace con «hoy» = | versión que devuelve | ¿trae la condición del medio de pago? |
|---|---|---|
| 28-sep-2026 (la fecha fija del guion) | Ley 7/2024 | no |
| 7-oct-2026 | resolución de derogación | no |
| **8-oct-2026** | **RDL 29/2026** | **sí** |
| 30-nov-2026 | RDL 29/2026 | **sí** |
| 1-dic-2026 | RDL 29/2026 | sí |

**Cualquier extractor que corte por esa fecha devolverá, desde el 8-oct-2026, la redacción con la
condición del medio de pago como si ya rigiera.** El nuestro da hoy la redacción que se aplica **por
casualidad**: porque su fecha está clavada en septiembre, no porque sepa leer cuándo empieza a
aplicarse una versión. **Un instrumento que acierta por casualidad es un instrumento que va a fallar**,
y el día es mañana: basta con que alguien «arregle» la fecha fija poniendo la de hoy.

Hay un segundo dato en el mismo sitio. En la versión del 26/2026 el BOE había incrustado dentro del
número 10.º un aviso («Téngase en cuenta que esta actualización del apartado 10º produce efectos el 1
de diciembre de 2026») y la «Redacción anterior». **En la versión del 29/2026 ese aviso no está**: del
art. 91 entero, la del 26 tiene 6 «Téngase en cuenta» y 3 «Redacción anterior»; la del 29, 3 y 0. **El
aviso que protegía al lector desapareció justo cuando el texto volvió.** Hoy,
quien lea el número 10.º en el consolidado ve la redacción nueva sin nada al lado que diga que aún no
se aplica; solo lo dice la nota al pie del artículo. Puede ser que el BOE lo complete (consolidó ese
mismo día): **no lo sé**, y es un motivo más para leer la nota y no el atributo.

**Lo que se ha hecho:** el guion de SCRUM-1232b lleva ahora, en su cabecera, este aviso (un comentario;
su comportamiento no cambia, porque es la evidencia de otro ticket). Y `versiones-art91.cjs` no corta
por fecha: imprime las dos fechas y la nota de cada versión.

**Lo que NO se ha hecho:** un guard. La tanda no sale a la red, y el defecto no está en un fichero del
repo sino en cómo publica el BOE una modificación con efectos diferidos.

## Ⓞ Punto ③ — los documentos nuestros que citan el artículo o el real decreto-ley

**Población:** los 5.574 ficheros de `origin/main` en `0a62be75` (`git ls-tree -r`), buscados con
`git grep`. Tres patrones, y un control con una cadena inventada que da 0:

| patrón | ficheros |
|---|---|
| `26/2026` o `BOE-A-2026-20266` | 2 |
| `91.Uno.2.10` (con sus variantes de escritura) | 8 |
| `29/2026` o `BOE-A-2026-20823` | 0 |

Una segunda búsqueda, más ancha («art. 91», «renovación y reparación», «tipo reducido» junto a
«vivienda») sobre `docs/`, `public/`, `src/`, `scripts/` y `tests/`, añade **un** fichero que la
primera no veía, `docs/producto/CONTABILIDAD.md`, que escribe «art. 91.Uno.2, 10.º». Son dos
poblaciones distintas y se dan las dos. **Ni `src/` ni `public/` citan el artículo.**

Los nueve, uno por uno:

| documento | qué dice | qué se ha hecho |
|---|---|---|
| `docs/legal/PREGUNTAS_ASESOR.md` (bloque F: la fila de la tabla y su cotejo; y la tabla del cotejo del 23-sep) | da el artículo por «✅ CONFIRMADA» contra una base de datos jurídica, con tres citas literales | **anotado en sitio**, tres líneas, sin mover ninguna: recotejado contra el BOE, y el aviso del cambio publicado |
| `docs/legal/ENVIO_ASESOR_2026-09-28.md` (pregunta C, «Normas que ya hemos localizado») | lista el artículo y dice que se cotejó en una base de datos jurídica | **anotado en sitio**, una línea |
| `docs/producto/CONTABILIDAD.md` (tabla de citas) | cita las letras b y c y dice «nº 10.º por confirmar» | **anotado en sitio**: el número está confirmado, y el aviso |
| `docs/master/SCRUM-1088.md` | el registro del cotejo del 23-sep: «✅ CONFIRMADA · Iberley» | **nota fechada al final**, sin reescribir |
| `docs/master/SCRUM-1253.md` (apéndice, §Ⓙ y §Ⓜ) | cuenta el hallazgo del 26/2026 | **nota fechada al final**, sin reescribir |
| `docs/master/SCRUM-1316.md` | el punto ① | esta sección |
| `docs/master/SCRUM-1023.md` | nombra «LIVA 91.Uno.2.10º» al cruzar dos preguntas | nada: cita el número, no la redacción |
| `docs/producto/CONTABILIDAD-COMPETENCIA.md` | copia el texto de la plantilla de un competidor | nada: es una cita de un tercero, y ya dice que no se copie sin firma |
| `docs/competencia/lotes-contabilidad-21sep/lote1-verifacturamos-billin.md` | la misma plantilla, en bruto | nada: ídem |

**Las citas literales, cotejadas contra el BOE de hoy** (la versión que se aplica: la de la resolución
de derogación). Las tres de `PREGUNTAS_ASESOR.md` y las dos de `CONTABILIDAD.md` están en el número
10.º tal cual. **La redacción que citan nuestros documentos es la que se aplica el 7-oct-2026.** No era
una redacción «vieja»: es la vigente hasta que la nueva produzca efectos, si llega a producirlos.

**De paso** (mismo fichero, misma tabla, misma fuente secundaria): el cotejo del 23-sep cita el art.
84.Uno.2.º.f) LIVA como «Ejecuciones de obra, con o sin aportación de materiales…», y en el BOE la letra
empieza «f) Cuando se trate de ejecuciones de obra, con o sin aportación de materiales…». El resto de
la frase coincide, y el párrafo siguiente del BOE confirma lo de los subcontratistas. La cita de la
base de datos no era literal del BOE en su arranque. No cambia nada de fondo; no se ha tocado esa
línea, se deja dicho aquí.

## Ⓟ 🔴 La pregunta al asesor que el ticket da por escrita no está en el repositorio

El ticket dice, en su punto ④, que la pregunta «ya está redactada y metida como **E6** en el documento
de preguntas». **En `origin/main` no hay ninguna E6 sobre esto.** `ENVIO_ASESOR_2026-09-28.md` tiene
E1 a E5 (E5 es «Tipos de IVA poco comunes»). «cheque nominativo» aparece en un solo fichero del árbol,
`docs/master/SCRUM-1253.md`; «efectivo» da 0 en `PREGUNTAS_ASESOR.md`; y de las 1.577 ramas remotas,
**0** traen en `docs/legal/` «cheque nominativo» o el nombre de cualquiera de los dos reales
decretos-leyes (`evidencias/scrum1316/ramas-con-la-frase.mjs`; su control: de las 40 primeras ramas, 39
traen «Iberley» en esa carpeta, así que el recorrido ve).

**Dónde está, según el orquestador** (su mensaje del 7-oct, tras recibir esta medición; yo no he visto
ese documento): las preguntas al asesor se llevan desde hace días en un documento que el fundador tiene
fuera del repositorio, y la del real decreto-ley se metió ahí esa misma tarde, ya con el 29/2026.

🔴 **Así que hay DOS sitios que dicen contener las preguntas al asesor** —
`docs/legal/ENVIO_ASESOR_2026-09-28.md`, en el repo, y ese documento de fuera— **y el ticket da por
hecho que la E6 está en el primero. No está. El repositorio afirma algo sobre un documento que ya no
gobierna.** Es un documento que promete algo que no cumple. No se arregla aquí: decidir dónde viven
las preguntas es del fundador, y lo sube el orquestador.

Lo que se puede afirmar desde aquí es que quien abra el repo no la encuentra. **No la he escrito yo en el documento de
envío:** qué se le manda al asesor lo decide el fundador, y el documento del 28-sep es el registro de
lo que se preparó ese día. Queda para el orquestador decidir dónde vive.

Lo que se le entregó para ese correo (mensaje del 7-oct, hacia las 15:46Z), y que según su respuesta
entró casi entero:

> «El programa ofrece el 10 % y guarda el medio de cobro, pero declararlo es opcional al marcar una
> factura cobrada a mano, y el tipo se fija al emitir, antes de saber cómo se cobrará. El RDL 29/2026
> (que repite el 26/2026, derogado el 2-oct, y está sin convalidar) no dice qué hay que acreditar, ni
> qué pasa con obras empezadas o cobradas en parte antes del 1-dic, ni si Bizum es "transferencia
> bancaria": ¿qué tiene que poder acreditar el profesional, y preparamos algo antes de que el Congreso
> lo vote?»

«El tipo se fija al emitir, antes de saber cómo se cobrará» es la inferencia de §Ⓕ.2 de arriba: leída
en el código, no ejecutada.

## Ⓠ Lo que es inferencia de una IA y no lectura de la norma

1. **«Hasta el 1-dic se aplica la redacción sin la condición».** Lo deduzco de «con efectos desde el 1
   de diciembre de 2026». Qué significa «efectos» para una obra que cruza esa fecha no lo dice el
   texto. → ASESOR.
2. **«El efectivo pierde el 10 %».** El texto no lo dice con esas palabras: enumera cuatro medios. Que
   la lista sea cerrada es la lectura literal; si lo es para la Administración, → ASESOR.
3. **«Idéntico» se refiere al número 10.º y al art. 7.** No he comparado jurídicamente el resto de los
   dos reales decretos-leyes.

## Ⓡ Lo que NO se ha hecho

- **No se ha mirado la tramitación en el Congreso** (por orden: no hay fecha en el BOE).
- **No se ha leído el Real Decreto-ley 28/2026** ni el 27/2026: son de alquileres y solo aparecen por
  su relación con la disposición final 5.ª.
- **No se ha tocado el guion de SCRUM-1232b más que en un comentario.** Sigue cortando por la fecha fija.
- **No se ha comprobado nada contra una base de datos**, ni cuántas facturas al 10 % hay (§Ⓒ sigue
  diciendo «sin determinar»).
- **No se ha escrito ni propuesto ningún texto de pantalla.** Si de esto sale que hay que avisar al
  profesional, es decisión y firma del fundador.
- **No se ha recotejado contra el BOE el resto de citas que el 23-sep se dieron por buenas contra la
  misma base de datos** (arts. 78 LIVA, 66 LGT, 32 LOPDGDD). El de hoy es el 91 y, de paso, el 84.
- **El ticket no queda cerrado por esto:** la fecha sigue viva y la pregunta es del asesor.

## Ⓢ Lo que me salió mal

1. **Mi primer guion sobre la LIVA salió ciego, y lo delató el control.** Buscaba el bloque con una
   expresión regular que, al pasar por un heredoc de bash, quedó con una barra de más: dijo «NO
   ENCONTRADO» para el art. 91, el 20 **y el 75**. El 75 era el control —un artículo que sé que
   existe—, así que no lo leí como «el BOE ha quitado el artículo». Es el mismo tropiezo que §Ⓝ del
   registro de SCRUM-1253, con otro disfraz: un guion de usar y tirar escrito dentro de la orden.
2. **Llegué con la premisa del ticket puesta.** El encargo decía «el RDL 26/2026 tiene efectos el
   1-dic» y «corrige los documentos que citan la redacción vieja». Las dos frases eran ciertas el
   1-oct y ninguna lo era ya: la norma estaba derogada desde el día 2, y la redacción que citan
   nuestros documentos es la que se aplica. No lo sabía nadie del equipo porque en seis días nadie
   volvió a bajar la fuente.
