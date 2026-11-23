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

# SCRUM-1316e · ¿Está convalidado el Real Decreto-ley 29/2026? Pendiente, y lo vota la Diputación Permanente

**Medido contra:** `origin/main` = `e306a6a5e5b45a2e98792d30eee02fdec5ea2362` · 2026-10-23T16:00:45Z (cabecera `Date:` de la primera respuesta del BOE)

A9: aviso → A10 «Un dato copiado de un registro lleva la fecha en que se midió, no la de hoy.» — no se pudo comprobar: el estado de una norma vive en el BOE y en la web del Congreso, y la tanda de CI no sale a la red; el «no convalidado» de §Ⓚ era verdad el 7-oct y lo de abajo sólo es verdad el 23-oct.

Sesión J5 (IA), 23-oct-2026, por encargo del orquestador del equipo de Javier (`cobroflash-backend-62`).
**Aquí sólo se mide el estado de una norma.** No se toca `src/`, ni `public/`, ni el esquema, ni
ningún documento del asesor; no se propone texto de pantalla (regla 39); no se predice ninguna
votación. Lo de arriba (①, ② y ③) no se toca.

## Veredicto

1. **El Real Decreto-ley 29/2026 (`BOE-A-2026-20823`) NO está convalidado ni derogado a 23-oct-2026.**
   El BOE no ha publicado ningún acuerdo sobre él (§Ⓣ), y la ficha del Congreso dice, literal:
   «Situación actual Diputación Permanente Convalidación» (§Ⓤ).
2. 🔴 **Lo que el registro de §Ⓚ no vio: las Cortes están disueltas desde el 6-oct.** Real Decreto
   806/2026, de 5 de octubre (`BOE-A-2026-20742`, BOE del 6-oct): elecciones el **29-nov-2026** y
   sesiones constitutivas el **23-dic**. El 29/2026 se aprobó el 6-oct, ya disueltas. **Quien lo vota
   no es el Pleno que derogó el 26/2026: es la Diputación Permanente del Congreso.**
3. **El plazo del art. 86.2 CE vence, en cualquiera de los tres calendarios calculados, entre el 5 y
   el 19 de noviembre de 2026** (§Ⓥ). Es un CÁLCULO, no un dato publicado.
4. **Nada de lo medido mueve el 1-dic.** El art. 7.Tres sigue diciendo «con efectos desde el 1 de
   diciembre de 2026», y la ficha del BOE no ha cambiado desde el 7-oct (mismos sha256). Lo que sí
   queda dicho: **la suerte del 1-dic se decide antes del 1-dic**, en el plazo de §Ⓥ.

## Ⓣ El BOE: 23 sumarios diarios, del 1 al 23 de octubre

API de datos abiertos del BOE: los metadatos y el análisis del consolidado de cada real decreto-ley
(`/datosabiertos/api/legislacion-consolidada/id/<ID>/{metadatos,analisis}`) y el sumario de cada día
(`/datosabiertos/api/boe/sumario/AAAAMMDD`). Todas las peticiones respondieron 200, salvo los tres
domingos (4, 11 y 18-oct: 404 de 169 B, que es «no hay BOE ese día»).

| qué | identificador | sha256 hoy | ¿igual que el 7-oct (§Ⓘ)? |
|---|---|---|---|
| RDL 29/2026, metadatos | `BOE-A-2026-20823` | `2b7dcb71c32154e27b644acbf25ab22c99343fd37a31d170ff1a25cc7bfa6c9b` | sí |
| RDL 29/2026, análisis | ídem | `0b97a3c40c587d99da937ce344f7b3dd03e5b0ad760237cf9df191cd6f141bed` | sí |
| RDL 26/2026, metadatos | `BOE-A-2026-20266` | `1d1c0348dd436b7954bf4960972279623875975a568b00d6338429cf26bb3e33` | sí |
| RDL 26/2026, análisis | ídem | `23de3cbe23ffd1a2e87c6366e6cc6f5a8ed60a27442ff50e71031c60e04db19d` | sí |
| RD 806/2026 (disolución), diario | `BOE-A-2026-20742` | `de4d65e239fce85d85cf4bd109481e74ad4f0c9d61deaa5daa07c2929dab1bdf` | no se bajó |

Metadatos del 29/2026, literales: `estatus_derogacion` = `N`, `vigencia_agotada` = `N`,
`fecha_actualizacion` = `20261007T123908Z`. Su análisis sigue listando como única posterior el Real
Decreto-ley 28/2026 (`BOE-A-2026-20822`, «SE DICTA EN RELACIÓN»): ninguna convalidación ni derogación.

**Los sumarios, recorridos enteros:** 4.697 disposiciones en 20 días con BOE. Títulos que nombran el
Real Decreto-ley 29/2026: **uno**, el propio real decreto-ley (sumario del 7-oct). Ninguna resolución
del Congreso sobre él. Recontado con un `grep` de texto llano sobre los 23 ficheros, sin el patrón de
los ítems: «Real Decreto-ley 29/2026» sale sólo en el del 7-oct.

**Los dos controles del recuento:**
- **Positivo:** el mismo instrumento encuentra la derogación del 26/2026 (`BOE-A-2026-20526`, sumario
  del 2-oct) y **dos convalidaciones de la Diputación Permanente** publicadas el 20-oct: la del Real
  Decreto-ley 24/2026 (`BOE-A-2026-21787`) y la del 25/2026 (`BOE-A-2026-21788`), «Resolución de 16 de
  octubre de 2026, del Congreso de los Diputados, por la que se ordena la publicación del Acuerdo de
  convalidación…». O sea: si hubiera un acuerdo publicado sobre el 29, tiene la forma que se caza.
- **Cero:** «zzqx» da 0 ficheros de 23.

⚠️ **Límite:** el BOE publica el acuerdo unos días después de la votación (los del 24 y el 25: votados
el 16-oct, publicados el 20-oct). Por eso el BOE solo no basta para decir «no se ha votado», y se mira
el Congreso.

## Ⓤ El Congreso: la ficha de la iniciativa

`congreso.es`, iniciativas de la XV Legislatura, tipo 130 (reales decretos-ley), bajadas el 23-oct a
las 16:02Z (cabecera `Date:`). Texto de la ficha, literal tras quitar el HTML:

> «Real Decreto-ley 29/2026, de 6 de octubre, por el que se adoptan medidas urgentes para la protección
> de la función social de la vivienda y la ampliación de la oferta de vivienda asequible. (130/000060)
> Presentado el 08/10/2026 , calificado el 13/10/2026 Autor Gobierno Situación actual Diputación
> Permanente Convalidación Tramitación seguida por la iniciativa Diputación Permanente Convalidación
> desde 13/10/2026»

**Control con las fichas vecinas**, que la misma lectura tiene que distinguir:

| iniciativa | norma | lo que dice la ficha |
|---|---|---|
| 130/000055 | RDL 26/2026 | «Resultado tramitación Derogado» · Pleno, hasta el 02/10/2026 |
| 130/000056 | RDL 27/2026 | «Resultado tramitación Derogado» · Pleno, hasta el 02/10/2026 |
| 130/000057 | RDL 24/2026 | «Resultado tramitación Convalidado» · Diputación Permanente |
| 130/000058 | RDL 25/2026 | «Resultado tramitación Convalidado» · Diputación Permanente, del 13/10 al 16/10/2026 |
| 130/000059 | RDL 28/2026 | «Situación actual Diputación Permanente Convalidación» |
| **130/000060** | **RDL 29/2026** | **«Situación actual Diputación Permanente Convalidación»** |
| 130/000061 | RDL 30/2026 | «Situación actual Diputación Permanente Convalidación» |

La ficha sabe decir «Derogado» y «Convalidado»; para el 29 no dice ninguna de las dos. **No se ha leído
el orden del día de la Diputación Permanente ni el Diario de Sesiones:** no sé si hay sesión
convocada, y no lo infiero.

## Ⓥ El plazo del art. 86.2 CE: cálculo

La Constitución dice «en el plazo de los treinta días siguientes a su promulgación». **Cómo se cuentan
esos treinta días (hábiles o naturales, desde la firma o desde el BOE) no lo he medido en ninguna
fuente: lo calculo de las tres maneras.** Festivos nacionales: el 12-oct (el 1-nov cae en domingo); no
se cuentan los autonómicos ni los locales de Madrid.

| cómputo | desde la promulgación (6-oct) | desde la publicación (7-oct) |
|---|---|---|
| hábiles, de lunes a viernes | 18-nov (mié) | 19-nov (jue) |
| hábiles, de lunes a sábado | 11-nov (mié) | 12-nov (jue) |
| naturales | 5-nov (jue) | 6-nov (vie) |

**Las seis caen antes del 1-dic** y antes de las elecciones del 29-nov. Un festivo de Madrid más
movería un día, no un mes.

## Ⓦ Lo que es inferencia y no lectura

- Que la Diputación Permanente sea quien convalida mientras las Cortes están disueltas lo dice la
  ficha del Congreso (§Ⓤ); **el artículo de la Constitución que lo habilita no lo he leído hoy.**
- **Si la Diputación Permanente puede tramitarlo además como proyecto de ley (art. 86.3 CE) no lo he
  medido.** Para el producto no cambia nada: el 1-dic depende de convalidar o derogar.
- Si no se vota en plazo, la lectura habitual es que el real decreto-ley decae. **No lo afirmo**: es
  del asesor, como todo lo jurídico.
- Una búsqueda web previa devolvió un resumen que decía «derogado por el Pleno el 29 de septiembre»;
  el BOE dice 2-oct (§Ⓙ). **Ese resumen no se usa para nada de este tramo.**

## Ⓧ Lo que me salió mal

1. **El registro de mi puesto del 7-oct (§Ⓚ, punto 3 del veredicto de 1316b) decía «colgada de una
   votación» sin ver que las Cortes se habían disuelto el día antes.** El Real Decreto 806/2026 se
   publicó en el BOE del 6-oct, un día antes de esa medición, y no estaba entre las fuentes porque se
   buscó la norma y no el órgano que la vota. No cambiaba el veredicto («no convalidado»), pero sí a
   quién se le pregunta y cuándo.
2. **Casi me fío del resumen de la búsqueda web**, que afirmaba la disolución antes de que yo la
   hubiera leído. Lo que lo paró fue que el mismo resumen traía una fecha falsa (29-sep por 2-oct):
   leí el real decreto de disolución en el BOE antes de escribir nada.

# SCRUM-1316f · A 26-oct: el RDL 29/2026 sigue sin convalidar, el producto no cruza el tipo con el medio de cobro, y no hay asesor que conteste antes del 1-dic

**Medido contra:** `origin/main` = `81f9c0dc7d100cf05765b2c7708ac2f31f70beb7` · 2026-10-26T15:40:26Z (cabecera `Date:` de GitHub)

A9: aviso → A10 «Cero resultados con tu vocabulario no es silencio del documento.» — no se pudo comprobar: mi primer control positivo para «medio de pago» en `src/` fue «medio de cobro», y también dio cero; lo que separa «el código no lo nombra» de «mi patrón no casa» es una palabra que SÉ que está (aquí, «efectivo» en `metodoDeCobro.ts`), y ningún guard sabe qué palabra elige una sesión como control.

Sesión J5 (IA, `jv-j5an`), 26-oct-2026, por encargo del orquestador del equipo de Javier (`cobroflash-backend-8b`).
**Sólo se mide y se pregunta.** No se toca `src/`, ni `public/`, ni el esquema, ni el camino de emisión
(regla 40); no se propone texto de pantalla (regla 39); no se predice ninguna votación; nada de esto es
una respuesta de asesor. Lo de arriba (①, ②/③ y 1316e) no se toca.

## Veredicto

1. **El RDL 29/2026 sigue SIN convalidar ni derogar a 26-oct-2026, 15:38Z.** BOE y Congreso, iguales
   que el 23-oct (§Ⓨ). El plazo calculado en §Ⓥ (5 a 19-nov) sigue en pie y cae antes del 1-dic.
2. **El texto consolidado vigente no ha cambiado desde el 7-oct.** El art. 91 de la LIVA consolidada
   trae la versión del 29/2026 con la nota «Se modifican, con efectos de 1 de diciembre de 2026, los
   apartados Uno.2.2º, Uno.2.10º y Dos.1.6º» y el párrafo del medio de pago (§Ⓩ).
3. **Qué hace HOY el producto con una obra al 10 % cobrada en efectivo** (§ⓐ): la deja hacer sin decir
   nada. El 10 % lo elige el profesional, el medio de cobro es opcional al marcarla cobrada, y **ningún
   sitio de `src/` cruza el tipo de IVA con el medio de cobro**. Para un comercio español real, con
   `INVOICING_ES_ENABLED` en su valor por defecto, el documento es un **justificante, no una factura**.
4. 🔴 **Lo que el encargo da por cierto y ya no lo es: «E6 al asesor».** **No hay asesor fiscal**
   (fundador, 14-oct, SCRUM-1264 c.19623), y se contratará «cuando tengamos la SL» (20-oct, c.20088),
   que según ese comentario no es la notaría sino el paso 5 de 8, el Registro Mercantil. **Y la E6 no
   está en el sitio único de las preguntas:** la descripción de SCRUM-1264 sigue diciendo «28
   preguntas» y llega a E5 (§ⓑ).
5. **El ticket NO está resuelto por efecto.** La fecha sigue viva y falta quien conteste.

## Ⓨ La norma, re-medida hoy

Fuentes bajadas el 26-oct entre las 15:35Z y las 15:38Z (cabeceras `Date:`). Todas respondieron 200.

| qué | identificador | sha256 hoy | ¿igual que el 23-oct (§Ⓣ)? |
|---|---|---|---|
| RDL 29/2026, metadatos del consolidado | `BOE-A-2026-20823` | `2b7dcb71c32154e27b644acbf25ab22c99343fd37a31d170ff1a25cc7bfa6c9b` | sí |
| RDL 29/2026, análisis | ídem | `0b97a3c40c587d99da937ce344f7b3dd03e5b0ad760237cf9df191cd6f141bed` | sí |
| RDL 26/2026, metadatos | `BOE-A-2026-20266` | `d92367a02359ffb153308592a0d2f3027959c73167d189abd1b61685b292ab97` | **no** (ver abajo) |
| LIVA, metadatos | `BOE-A-1992-28740` | `0b953b4214e62c190c605cbf0120e1b88b0578453e5dfed24dc7119edd4861e8` | no se bajó el 23 |
| LIVA, bloque `a91` | ídem | `03898893f793534bcd873aa844bcd5dcc0070d5ab355de7314640f8c317e8c6e` | no se bajó el 23 |

- **RDL 29/2026**, literales: `estatus_derogacion` = `N`, `vigencia_agotada` = `N`,
  `fecha_actualizacion` = `20261007T123908Z`. El BOE no ha tocado su ficha desde el 7-oct.
- **RDL 26/2026**: su ficha cambió de sha256 porque su `fecha_actualizacion` es hoy,
  `20261026T064248Z`. Lo que dice no cambia: `estatus_derogacion` = `S`, `fecha_derogacion` =
  `20261002`, `vigencia_agotada` = `S`. **No he comparado campo a campo con la del 23-oct** (aquella
  no está guardada en el repositorio); sólo leo que la de hoy sigue diciendo derogado.
- **LIVA**: `fecha_actualizacion` = `20261007T092353Z`. Nada nuevo desde el 7-oct.

**Sumarios del BOE del 23, 24 y 26-oct** (el 25 es domingo): 284, 326 y 324 ítems. «29/2026»,
«decreto-ley» y «convalidaci»: **0** en los tres. **Control positivo**, el mismo recuento sobre el
sumario del 20-oct: «decreto-ley» 2 y «convalidaci» 2, que son las convalidaciones del 24 y el 25/2026
de §Ⓣ. **Control cero:** «zzqx» 0 en los tres. Los sumarios del 1 al 22-oct ya se recorrieron en §Ⓣ.

**Congreso, fichas de la XV Legislatura, tipo 130**, bajadas a las 15:37Z-15:38Z, texto literal tras
quitar el HTML:

> «Real Decreto-ley 29/2026, de 6 de octubre, […] (130/000060) Presentado el 08/10/2026 , calificado
> el 13/10/2026 Autor Gobierno Situación actual Diputación Permanente Convalidación Tramitación seguida
> por la iniciativa Diputación Permanente Convalidación desde 13/10/2026»

**Control, misma lectura:** la 130/000058 (RDL 25/2026) dice «Resultado tramitación Convalidado» y
ya trae «Diarios de Sesiones DS. Congreso de los Diputados Núm.211 de 16/10/2026». La del 29 no trae
ni resultado ni diario de sesiones.

**No medido:** el orden del día de la Diputación Permanente (si hay sesión convocada para el 29/2026
no lo sé, y no lo infiero), y cómo se computan los 30 días del art. 86.2 CE (§Ⓥ sigue siendo cálculo).

## Ⓩ El texto consolidado vigente del art. 91.Uno.2.10.º

`node docs/master/evidencias/scrum1316/versiones-art91.cjs <bloque a91 de hoy>`: la última versión
sigue siendo la del RDL 29/2026 (`publicada 20261007 · fecha_vigencia 20261008`), con la condición del
medio de pago, y su nota dice «con efectos de 1 de diciembre de 2026». La anterior es la de la
resolución de derogación del 26/2026, sin la condición. **Igual que el 7-oct.**

🔴 **Sigue en pie la trampa de §Ⓝ.** `docs/master/evidencias/SCRUM-1232b/extraer-articulo.cjs` sigue
cortando a la fecha fija `20260928` (su línea con `filter(v=>v[1]<='20260928')`); el último commit
que lo tocó es `3dde87bd1`, el del aviso del 7-oct. Hoy acierta por casualidad, igual que entonces.

## ⓐ Qué hace HOY el producto con una obra al 10 % cobrada en efectivo

Leído en `origin/main` del ancla. Nada se ha ejecutado.

| paso | qué pasa | dónde | carril |
|---|---|---|---|
| 1. el profesional elige el tipo | el desplegable ofrece 21, 10, 4 y 0 | `public/dashboard/js/tiposDeIva.js:40` | S2 |
| 2. el servidor lo acepta | sólo comprueba que el tipo exista (§Ⓑ.2 de arriba) | `src/core/validation/fiscalInput.ts` | S1 |
| 3. qué documento sale (España) | `getEmissionMode`: demo → `demo`; si no, `INVOICING_ES_ENABLED` ? `fiscal` : `receipt` | `src/modules/invoicing/domain/emission.service.ts:36` | J1 |
| 4. el valor por defecto del flag | `INVOICING_ES_ENABLED: false` | `src/core/flags.ts:16` | S1 |
| 5. marcar cobrada | `cash` existe; declararlo es opcional: sin método, «no se toca la columna» | `src/modules/billing/domain/metodoDeCobro.ts:157` y `:329` | J2 |
| 6. ¿alguien cruza tipo y medio? | **no** | ver abajo | — |

**El cruce, medido.** En `src/` y `public/`, «medio de pago», «29/2026», «26/2026», «91.Uno» y
«cheque nominativo»: **0**. Control positivo: «efectivo» sí casa en `metodoDeCobro.ts:157`. De los
ficheros de `src/` que nombran `paidVia`/`paid_via`, **uno** nombra además un tipo de IVA,
`src/modules/reports/app/routes/reports.routes.ts`, y allí el tipo es el de los **gastos**
(`vatRate` de `Expense`, línea 392), no el de la factura.

**Por tanto, hoy:** una obra al 10 % se presupuesta, se cobra en efectivo y se marca cobrada (con o
sin decir «efectivo») sin que nada avise. Para un comercio español real con el flag en su valor por
defecto, lo que sale es un justificante de cobro y no una factura (regla 24); el demo saca factura
con marca de agua. **El 1-dic no cambia nada del producto por sí solo:** nada en el código mira la fecha.

**No medido:** el valor de `INVOICING_ES_ENABLED` en Railway y en `merchants.flags` de cada comercio,
y cuántos comercios españoles reales hay. Sin eso, «hoy no sale ninguna factura española real al
10 %» es una lectura del código, no un hecho de producción.

## ⓑ La E6 y el asesor

- **SCRUM-1264** es «EL SITIO ÚNICO de las preguntas para el asesor». Su descripción dice «Contador:
  28 preguntas (A1-A4, B1-B6, C1-C2, D1-D3, E1-E5, F1-F5, G1-G3)». En la descripción, «29/2026»,
  «26/2026» y «cheque nominativo» dan **0**; «91.Uno.2.10» sale sólo en las normas localizadas de B3.
  El c.17682 (1-oct) dice que se añadió «E6 — el cambio de IVA (SCRUM-1316)», pero la pregunta no está
  escrita en la descripción. El c.20774 (24-oct) añadió otra («Q-nueva», el redondeo) como comentario.
- El c.19609 (14-oct) cita una decisión del fundador «en SCRUM-1316, literal: «en los 2 sitios, lo
  quiero tanto en el repo como en mi documento»». **En SCRUM-1316 hay dos comentarios (c.18758 y
  c.20597) y esa frase no está en ninguno de los dos, ni en la descripción.** No sé dónde se dijo.
- **No hay asesor fiscal** (c.19623, literal del fundador: «No, no tenemos asesor fiscal, las
  respuestas dadas son mías o de la IA a nivel fiscal»), y su contratación espera a la SL (c.20088:
  «Ok no te preocupes lo arreglo cuando tengamos la SL»). El mismo c.20088 pide **no volver a
  plantear** esa decisión: aquí no se plantea. Lo que sí se dice es la consecuencia para esta fecha:
  **si la SL llega al paso 5 a mediados de noviembre, el asesor llegaría, como pronto, a la vez que la
  votación del 29/2026 y a dos semanas del 1-dic.** Es un cálculo con las fechas de ese comentario, no
  una medición.

## ⓒ Preguntas para el fundador (✅/❌, una decisión cada una)

**P1 · Fecha límite: 20-nov-2026** (día siguiente al último plazo calculado en §Ⓥ, y sólo si el
29/2026 se ha convalidado). **¿Quieres que antes del 1-dic el producto avise al profesional, al
elegir el 10 %, de que desde el 1-dic ese tipo depende de cómo se cobre?**
- ✅ Hace falta un texto nuevo de pantalla, que firmas tú (regla 39), y un cambio en
  `public/dashboard/js/tiposDeIva.js`, que es carril **S2** (equipo de Luis). No toca el camino de emisión.
- ❌ El 10 % se sigue ofreciendo sin aviso; la condición la conoce o no el profesional.
- **Recomiendo ✅ sólo si se convalida**, y sólo como aviso: el producto sigue sin elegir el tipo.

**P2 · Fecha límite: antes de poner `INVOICING_ES_ENABLED` en ON para un comercio español real**
(no el 1-dic: hasta entonces no sale factura española real). **¿Hacer obligatorio declarar el medio
de cobro al marcar cobrada una factura que tenga alguna línea al 10 %?**
- ✅ El dato que la norma usa queda guardado en cada caso. Es `campoPaidViaAlMarcar`
  (`metodoDeCobro.ts`, carril **J2**) y su llamada en `src/modules/system/invoiceAdmin.ts` (carril
  **J1**); hay que comprobar antes si eso es camino de emisión (regla 38) y, si lo es, es STOP.
- ❌ `NULL` sigue significando «no consta», y el profesional no podría sacar del programa cómo cobró.
- **Recomiendo decidirlo con el asesor, no antes:** qué hay que acreditar es justo la pregunta A4 de abajo.

**P3 · Fecha límite: ninguna; es para dejarlo escrito antes del 1-dic. ¿Confirmas que el programa NO
elegirá nunca el tipo de IVA según el medio de cobro** (por ejemplo, pasar solo al 21 % si se cobra en
efectivo)?
- ✅ Nada que construir. Evita el problema de orden de §Ⓕ.2: el tipo se fija al emitir, el cobro llega
  después y una factura emitida no se edita (regla 29).
- ❌ Hay que construir lógica en el camino de emisión: regla 40, STOP, y no tiene salida limpia para
  la factura emitida antes del cobro (haría falta una rectificativa).
- **Recomiendo ✅.**

**P4 · Fecha límite: 15-nov-2026** (plazo que pusiste a SCRUM-1264, c.19609). **¿La pregunta del
RDL de tu documento entra en SCRUM-1264 como E6, escrita, para que esté en los dos sitios?**
- ✅ La copia el orquestador desde tu documento, literal; el contador pasa de 28.
- ❌ Sigue viviendo sólo en tu documento, y el sitio «único» no la tiene.
- **Recomiendo ✅**: es lo que dice tu decisión de «los 2 sitios» del c.19609.

## ⓓ Preguntas para el asesor (cuando lo haya), cada una con su fecha

Todas valen **sólo si el 29/2026 se convalida**, y todas son interpretación: ninguna la contesta una
sesión ni el código. La fecha límite útil de las cuatro primeras es el **1-dic-2026**; sin asesor
antes de esa fecha, el profesional decide solo.

- **A1 ·** Una obra en vivienda cobrada en **efectivo** desde el 1-dic, ¿pierde el 10 % por quedar
  fuera de la lista del art. 91.Uno.2.10.º, o hay otra lectura?
- **A2 ·** **Bizum**, ¿cuenta como «transferencia bancaria» a estos efectos? (El texto no lo nombra:
  §Ⓛ.)
- **A3 ·** Obra **empezada antes** del 1-dic, o con **señal cobrada antes y resto después**: ¿qué tipo
  lleva cada parte? (No hay régimen transitorio: §Ⓛ.3.)
- **A4 ·** ¿Qué tiene que **poder acreditar** el profesional sobre el medio de pago, y qué tendría que
  guardar el programa? (El texto no lo dice: §Ⓛ.4. Decide P2.)
- **A5 ·** Fecha: ninguna antes del 1-dic. Un programa que **ofrece** el 10 % en un desplegable sin
  avisar de la condición, ¿tiene alguna responsabilidad como productor? (Decide P1.)
- **A6 ·** Fecha: el día siguiente a que venza el plazo del art. 86.2 CE. Si el 29/2026 **no se vota en
  plazo**, ¿decae y el 1-dic deja de existir? (§Ⓦ no lo afirma.)

## ⓔ Lo que es inferencia y no lectura

- «El 1-dic no cambia nada del producto por sí solo» es lectura del código (nada mira la fecha), no
  ejecución.
- La fecha en que llegaría el asesor sale de las estimaciones del c.20088, no de un calendario medido.
- **Quién construiría P1 y P2** lo dice `node scripts/carriles.mjs de <ruta>`, ejecutado hoy; si P2 es o
  no camino de emisión **no lo he determinado**.

## ⓕ Lo que me salió mal

1. **Mi primer control positivo no era positivo.** Para validar el cero de «medio de pago» en `src/`
   busqué «medio de cobro», que también dio cero. Un control que da cero no distingue nada; lo cambié
   por «efectivo», que sé que está en `metodoDeCobro.ts:157`, y ése sí casa.
2. **El encargo traía «E6 al asesor» y casi lo copio como tarea.** Lo paró leer SCRUM-1264 entero,
   comentarios incluidos: no hay asesor desde el 14-oct, y la E6 no está escrita en el sitio único.

# SCRUM-1316g · A 12-nov: el RDL 29/2026 sigue SIN convalidar ni derogar; no se propone texto

**Medido contra:** `origin/main` = `9cdf6a24d6831e16f4214b8c87cceaa286ebf303` · 2026-11-12T11:22:11Z (cabecera `Date:` de GitHub)

A9: aviso → A10 «El `updatedAt` de una fila no es la versión de un trozo de esa fila.» — no se pudo comprobar: el sha256 de los metadatos del 29/2026 cambió hoy sólo porque el BOE reescribió `fecha_actualizacion`; lo que separa «la ficha cambió» de «la norma cambió» es repetir el hash con el campo de fecha devuelto a su valor anterior, y ningún guard sabe qué campo de una fuente externa es sello y cuál es contenido (la tanda de CI no sale a la red).

Sesión J5 (IA, `jv-j5as`), 12-nov-2026, por encargo del orquestador del equipo de Javier
(`cobroflash-backend-a0`), en cumplimiento de la decisión del fundador de c.20890 («volver a medir la
convalidación antes del 20-nov»). **Sólo se mide.** No se toca `src/`, ni `public/`, ni el esquema, ni
el camino de emisión, ni el máster; no se predice ninguna votación; nada de esto es respuesta de
asesor. Lo de arriba no se toca.

## Veredicto

1. **El RDL 29/2026 (`BOE-A-2026-20823`) NO está convalidado ni derogado a 12-nov-2026, 11:22Z.**
   Ni el BOE (§Ⓖ1) ni la ficha del Congreso (§Ⓖ2) dicen otra cosa que el 26-oct.
2. **Por tanto, según P1 de c.20890 («Mientras no se convalide, no se construye nada»), NO se
   redacta propuesta de aviso.** Ni literal, ni cambio en `tiposDeIva.js`.
3. **El art. 91 de la LIVA consolidada no ha cambiado desde el 7-oct** (mismo sha256 de metadatos
   que el 26-oct, `fecha_actualizacion` = `20261007T092353Z`): la condición del medio de pago sigue
   escrita «con efectos de 1 de diciembre de 2026».
4. 🔴 **El plazo calculado de §Ⓥ ya se ha comido cuatro de sus seis variantes.** Las de días naturales
   (5 y 6-nov) y las de hábiles de lunes a sábado (11 y 12-nov) han vencido o vencen hoy **sin
   resultado en la ficha**; quedan las de lunes a viernes (18 y 19-nov). Es CÁLCULO, no dato
   publicado: **qué cómputo vale y qué pasa si vence sin votar es la pregunta A6, del asesor**, y no se
   afirma aquí que haya decaído.
5. **Próxima medición: antes del 1-dic-2026**, y en todo caso después del 19-nov (última variante del
   plazo calculado). El ticket NO está resuelto por efecto.

## Ⓖ1 El BOE

API de datos abiertos, `Accept: application/xml`. Todas las peticiones 200 entre las 11:19:52Z y las
11:21:36Z (cabeceras `Date:`), salvo los domingos 1 y 8-nov (404 de 170 B: no hay BOE).

| qué | identificador | sha256 hoy (12-nov) | ¿igual que el 7, 23 y 26-oct? |
|---|---|---|---|
| RDL 29/2026, metadatos | `BOE-A-2026-20823` | `9c1c09b7d360252e591d30f676aea5a8ef6c557e8bb38ca151fb17774566cb45` | **no — sólo por la fecha** (abajo) |
| RDL 29/2026, análisis | ídem | `0b97a3c40c587d99da937ce344f7b3dd03e5b0ad760237cf9df191cd6f141bed` | sí |
| RDL 26/2026, metadatos | `BOE-A-2026-20266` | `d92367a02359ffb153308592a0d2f3027959c73167d189abd1b61685b292ab97` | igual que el 26-oct |
| RDL 26/2026, análisis | ídem | `23de3cbe23ffd1a2e87c6366e6cc6f5a8ed60a27442ff50e71031c60e04db19d` | igual que el 23-oct |
| LIVA, metadatos | `BOE-A-1992-28740` | `0b953b4214e62c190c605cbf0120e1b88b0578453e5dfed24dc7119edd4861e8` | igual que el 26-oct |

- **Metadatos del 29/2026:** `fecha_actualizacion` = `20261111T065938Z` (antes `20261007T123908Z`);
  `estatus_derogacion` = `N`, `estatus_anulacion` = `N`, `vigencia_agotada` = `N`. **Devolviendo ese
  único campo a `20261007T123908Z`, el sha256 da `2b7dcb71…6c9b`, el del 7, 23 y 26-oct, byte a
  byte:** el BOE tocó la ficha el 11-nov, pero no cambió nada más que la fecha. El análisis (que es
  donde aparecería una convalidación o derogación como posterior) es idéntico.
- **RDL 26/2026:** sigue `estatus_derogacion` = `S`, `fecha_derogacion` = `20261002`, `vigencia_agotada` = `S`.

**Sumarios del 27-oct al 12-nov** (15 días con BOE, 3.366 ítems): títulos que nombren el Real
Decreto-ley 29/2026: **0**. Ítems con «29/2026» en cualquier campo: 5, leídos uno a uno — un
expediente de contratación «29/2026» (3 y 4-nov) y tres disposiciones ajenas (28 y 29-oct) cuyo
texto de ítem lo contiene; ninguno es el RDL. Con «decreto-ley»: los RDL 32/2026 (4-nov) y 33 a
36/2026 (11-nov), y dos decretos-ley autonómicos (5-nov). Con «convalidaci»: uno, un convenio de
convalidación de títulos extranjeros (5-nov). Títulos del Congreso o de la Diputación Permanente:
elecciones, Junta Electoral y una corrección de becas (12-nov); **ningún acuerdo de convalidación ni
de derogación**.
- **Control positivo:** el mismo recuento sobre el sumario del 20-oct da «decreto-ley» 2 y
  «convalidaci» 2, y la frase «del Congreso de los Diputados, por la que se ordena la publicación del
  Acuerdo de convalidación» 2: las del 24 y el 25/2026 (§Ⓣ).
- **Control cero:** «zzqx» 0 en los 18 ficheros.
- ⚠️ **Límite (§Ⓣ):** el BOE publica días después de votar; por eso se mira el Congreso.

## Ⓖ2 El Congreso

Fichas de la XV Legislatura, tipo 130, bajadas a las 11:21:55Z-11:21:58Z, texto literal tras quitar el HTML:

> **130/000060 (RDL 29/2026):** «Situación actual Diputación Permanente Convalidación Tramitación
> seguida por la iniciativa Diputación Permanente Convalidación desde 13/10/2026 B.O.E. BOE Núm: 249
> de 07/10/2026»

Sin «Resultado tramitación» y sin Diario de Sesiones: **igual que el 23 y el 26-oct.**

**Control, misma lectura:** la 130/000058 (RDL 25/2026) dice «Resultado tramitación Convalidado» y trae
«DS. Congreso de los Diputados Núm.211 de 16/10/2026 … Debate de convalidación o derogación de real
decreto-ley». La lectura sabe ver un resultado. La 130/000059 (RDL 28/2026, mismo día que el 29) y la
130/000061 (RDL 30/2026) siguen también en «Situación actual Diputación Permanente Convalidación».

## Ⓖ3 Lo que NO está medido

- **Orden del día de la Diputación Permanente:** no leído. No sé si hay sesión convocada antes del
  19-nov y no lo infiero.
- **Cómo se computan los 30 días del art. 86.2 CE** y **qué pasa si vencen sin votación**: no medido
  en fuente; A6 de §ⓓ, del asesor (que no hay, c.20884 punto 4).
- **El bloque `a91` de la LIVA no se ha vuelto a bajar:** el veredicto 3 sale de que los metadatos de
  la LIVA no han cambiado (mismo sha256 y misma `fecha_actualizacion` que el 26-oct), no de releer el
  artículo.
- Nada se ha ejecutado contra ninguna base; ni `src/` ni `public/` se han releído hoy (lo de §ⓐ es
  del 26-oct).

## Ⓖ4 Lo que me salió mal

1. **El sha256 de los metadatos del 29/2026 salió distinto y por un momento era «la ficha cambió».**
   Lo separó recalcular el hash con la fecha anterior: era sólo el sello `fecha_actualizacion`. Sin ese
   paso, un hash distinto se habría leído como novedad jurídica.
2. **No me medí el contexto al acabar la lectura de arranque por separado**, como pedía el encargo:
   la lectura de Jira fue seguida y la primera cifra (115.484) es arranque + Jira.

# SCRUM-1316h · El RDL 29/2026 se CONVALIDÓ el 12-nov (Diputación Permanente, 35-34); no consta tramitación como proyecto de ley

**Medido contra:** `origin/main` = `34939a6ad7c0ad7abc4f06e34e92b43fd519400b` · 2026-11-18T16:00:04Z (cabecera `Date:` de GitHub)

A9: aviso → cicatriz J5 «Medí si un real decreto-ley estaba convalidado sin leer el orden del día del órgano que lo vota, y lo estaba votando esa misma mañana: 1316g dijo «no convalidado» a las 11:22Z del 12-nov con la Diputación Permanente reunida de 08:10Z a 13:22Z (DS núm. 213), y dejó la siguiente medición para después del plazo» — no se pudo comprobar: ningún guard lee el calendario del Congreso ni sabe a qué hora mide una sesión (la tanda de CI no sale a la red).

Sesión J5 (IA, `jv-j5bg`), 18-nov-2026, por encargo del orquestador del equipo de Javier
(`cobroflash-backend-ee`): la re-medición que P1 de c.20890 pedía «antes del 20-nov». **Sólo se mide.**
No se toca `src/`, ni `public/`, ni el esquema, ni el camino de emisión, ni `docs/legal/`; no se redacta
el aviso de P1 (regla 39, claims fiscales); nada de esto es respuesta de asesor. **Lectura, no decisión.**
Lo de arriba no se toca. Comentario en Jira: SCRUM-1316 c.22068.

⚠️ El encargo decía «RDL 26/2026»: está derogado desde el 2-oct (§Ⓙ). Lo medido es el **29/2026**, que
repite el párrafo del medio de pago (§Ⓚ). Y citaba «c.20892», que no es comentario de este ticket; la
decisión que aplica es c.20890.

## Veredicto

1. **El RDL 29/2026 (`BOE-A-2026-20823`) está CONVALIDADO.** Lo acordó la Diputación Permanente el
   12-nov-2026 (69 votos: 35 a favor, 34 en contra) y lo publica el BOE núm. 283 del 13-nov
   (`BOE-A-2026-23755`). La ficha del Congreso dice «Concluido - (Convalidado)» (§ⓗ1, §ⓗ2).
2. **No consta tramitación como proyecto de ley.** En el Diario de Sesiones, tras «Queda convalidado» se
   pasa a la comparecencia siguiente, sin la pregunta del art. 151.4 del Reglamento (§ⓗ2). Límite: sin
   caso de control con tramitación.
3. **El 1-dic sigue.** El art. 91 de la LIVA consolidada no ha cambiado: la versión del 29/2026 con la
   condición del medio de pago y «1 de diciembre de 2026» (§ⓗ1).
4. **P1 de c.20890 se cumple** («Si la Diputación Permanente convalida el RDL 29/2026, se trae al
   fundador un texto de aviso para firmar…»). No lo redacto: lo asigna el orquestador.
5. **A6 de §ⓓ («si no se vota en plazo, ¿decae?») queda sin objeto.** A1–A5 siguen, con fecha 1-dic y
   su condición cumplida; sin asesor hasta la SL (SCRUM-1264 c.22060), el 1-dic llega sin respuesta.

## ⓗ1 El BOE

API de datos abiertos, `Accept: application/xml`; todas 200 entre las 15:54:43Z y las 15:59:12Z.

| qué | identificador | sha256 (18-nov) | lo que dice |
|---|---|---|---|
| RDL 29/2026, metadatos | `BOE-A-2026-20823` | `8b3a0679954a65ff…` | `fecha_actualizacion` = `20261113T084620Z`; `estatus_derogacion` = `N`; `vigencia_agotada` = `N` |
| RDL 29/2026, análisis | ídem | `b74982788a78469f…` (antes `0b97a3c4…`) | posterior nueva: «SE PUBLICA Acuerdo de convalidación, por Resolución de 12 de noviembre de 2026» → `BOE-A-2026-23755` |
| Resolución | `BOE-A-2026-23755` | `0d09e1e6356fdd93d1b0ddec1ac76527376698989c8a56a6eba4d95487c06653` | «la Diputación Permanente del Congreso de los Diputados, en su sesión del día de hoy, acordó convalidar el Real Decreto-ley 29/2026, de 6 de octubre»; BOE 13-nov, núm. 283, pág. 152985 |
| Resolución | `BOE-A-2026-23754` | `fff441b77485894e651b625d0e3b6224c36379cc6e678f9c1e22d301340c34a3` | el mismo día, «acordó derogar el Real Decreto-ley 28/2026» (alquileres); deja sin efecto su relación con la disp. final 5 del 29/2026; no toca el art. 7 |
| RDL 26/2026, metadatos y análisis | `BOE-A-2026-20266` | `d92367a0…`, `23de3cbe…` | iguales que el 12-nov: sigue derogado |
| LIVA, metadatos | `BOE-A-1992-28740` | `0b953b4214e62c19…` | igual que el 26-oct y el 12-nov (`20261007T092353Z`) |
| LIVA, bloque `a91` | ídem | — (1.051.987 B) | última versión `BOE-A-2026-20823`, `fecha_vigencia=20261008`; «tarjeta de crédito o débito, transferencia bancaria, cheque nominativo» 1; «1 de diciembre de 2026» 2; «zzqx» 0 |

- **Sumario del 13-nov:** 271 ítems; `BOE-A-2026-23755` 4, «Acuerdo de convalidación» 1, «Real
  Decreto-ley 29/2026» 1, «zzqx» 0. **Sumario del 18-nov:** 145 ítems, los tres a 0 (no hay nada nuevo hoy).
- El sumario es el positivo de la lectura del análisis: lo que el análisis dice, el diario lo trae.
- **Del 14 al 17-nov no se ha bajado cada sumario.** Lo que cubre esos días es la lista de posteriores del
  consolidado (3 entradas, ninguna posterior al 13-nov).

## ⓗ2 El Congreso

**Ficha 130/000060** (15:57:02Z). La primera petición, sin cabeceras de navegador, dio **403 de 410 B**;
con ellas, 200 de 95.553 B. Literal tras quitar el HTML:

> «Situación actual Concluido - (Convalidado) Tramitación seguida por la iniciativa Diputación Permanente
> Convalidación desde 13/10/2026 hasta 12/11/2026 Concluido - (Convalidado) desde 12/11/2026 Diarios de
> Sesiones DS. Congreso de los Diputados Núm.213 de 12/11/2026 Pág: 31 Diputación Permanente Debate de
> convalidación o derogación de real decreto-ley»

«proyecto de ley» 0, «121/» 0, «Derogado» 0, «zzqx» 0. Control con la 130/000058 (RDL 25/2026, ya
convalidada el 16-oct): «Convalidado» 2, también sin «proyecto de ley».

**Diario de Sesiones núm. 213** (`https://www.congreso.es/public_oficiales/L15/CONG/DS/PL/DSCD-15-PL-213.PDF`,
15:57:44Z, 635.470 B, sha256 `f5e128a3b6656f2280223da767ce6b3882778fb4eb486999675e2661c29a0be5`; texto con
`pdftotext`). «Sesión de la Diputación Permanente núm. 10 celebrada el jueves 12 de noviembre de 2026»;
«Se abre la sesión a las nueve y diez minutos de la mañana» y «Eran las dos y veintidós minutos de la tarde».

> «Votamos ahora la convalidación o derogación del Real Decreto Ley 29/2026 … Efectuada la votación, dio el
> siguiente resultado: votos emitidos, 69; a favor, 35; en contra, 34. La señora PRESIDENTA: Queda
> convalidado el real decreto ley. (Aplausos).»

La línea siguiente es «COMPARECENCIA DEL GOBIERNO ANTE LA DIPUTACIÓN PERMANENTE». En el DS, «como
proyecto de ley» da 0; «proyecto de ley» da 1, en una intervención del debate («¿por qué no ha traído…
un proyecto de ley de tramitación urgente…?»), no en una votación. **Antes de votar, un grupo dice: «ya
de hecho se ha presentado un recurso»**; objeto, órgano y efecto: no medidos.

## ⓗ3 El plazo del art. 86.2 CE, con el criterio del propio Congreso

Reglamento del Congreso, consolidado (`BOE-A-1982-5196`), bloques `art90` y `art151`, 15:58:43-44Z:

> **Art. 90.1:** «Salvo disposición en contrario, los plazos señalados por días en este Reglamento se
> computarán en días hábiles, y los señalados por meses de fecha a fecha.» **90.2:** «Se excluirán del
> cómputo los períodos en los que el Congreso no celebre sesiones…»
> **Art. 151.1:** «…antes de transcurrir los treinta días siguientes a su promulgación…» **151.4:**
> «Convalidado un Real Decreto-ley, la Presidencia preguntará si algún grupo parlamentario desea que se
> tramite como proyecto de ley.» **151.5:** «La Diputación Permanente podrá, en su caso, tramitar como
> proyectos de ley por el procedimiento de urgencia los Decretos-leyes que el Gobierno dicte durante los
> períodos entre legislaturas.»

Así que el criterio es «hábiles», lo que descarta las variantes de días naturales de §Ⓥ. **Qué días son
hábiles (¿el sábado?) el art. 90 no lo dice, y no lo he medido.** Cálculo (festivo: sólo el 12-oct; sin
festivos de Madrid ni la exclusión del 90.2):

| desde | hábiles | día 1 | día 10 | día 20 | día 30 | el 12-nov es el día |
|---|---|---|---|---|---|---|
| promulgación 6-oct (art. 151.1) | L-V | 7-oct | 21-oct | 4-nov | 18-nov | 26 |
| promulgación 6-oct | L-S | 7-oct | 19-oct | 30-oct | 11-nov | 31 |
| publicación 7-oct | L-V | 8-oct | 22-oct | 5-nov | 19-nov | 25 |
| publicación 7-oct | L-S | 8-oct | 20-oct | 31-oct | 12-nov | 30 |

El voto cae dentro en tres de cuatro; en «sábado hábil, desde la promulgación», es el día 31. **Si eso
tiene efecto jurídico no lo afirmo**: el BOE publica el acuerdo y la ficha dice «Concluido (Convalidado)».

## ⓗ4 Qué cambia (lectura, no decisión)

- **Convalidado → el 1-dic sigue**, con el texto de §Ⓛ/§Ⓩ.
- **Derogado → no ha pasado.** Lo derogado el 12-nov es el 28/2026.
- **Tramitación como ley → no consta** (§ⓗ2). Si la hubiera, el art. 151.4-5 no dice que suspenda el RDL
  mientras se tramita; es lectura, no medido.
- **P1 de c.20890 se activa:** aviso para firmar al elegir el 10 %, pantalla de S2 (`tiposDeIva.js`). No
  se redacta aquí; quién y cuándo, el orquestador; fecha útil, antes del 1-dic.
- **Fila 23 del índice del asesor (SCRUM-1264):** A6 sin objeto; A1–A5 siguen a 1-dic. Literal propuesto
  al orquestador en c.22068. El encabezado de `docs/legal/PREGUNTAS_ASESOR.md:1708` repite «⏰ A6:
  18/19-nov (cálculo)» y no lo he tocado (no era el encargo).

## ⓗ5 Lo que NO está medido

Si el sábado es hábil para el Congreso; si el art. 90.2 aplica con las Cortes disueltas; el recurso; la
hora exacta de la votación dentro de la sesión; cada sumario del 14 al 17-nov. Nada se ha ejecutado contra
ninguna base; `src/` y `public/` no releídos. **Para mañana no queda medición de la votación**: queda la
decisión de P1 y, si se quiere, el recurso.

## ⓗ6 Lo que me salió mal

1. **La medición 1316g de mi puesto se hizo dentro de la sesión que votó el decreto** (11:19-11:22Z;
   sesión 08:10Z-13:22Z) y fijó la siguiente para «después del 19-nov», con el orden del día sin leer
   (§Ⓖ3). Correcta para su hora; seis días desfasada. Cicatriz J5 del 18-nov.
2. **La ficha del Congreso dio 403 de 410 B a la primera.** Lo separó mirar el tamaño y el código antes
   de contar nada: un 403 contado como texto daba «0 Convalidado», que es lo que decía el 12-nov.

# SCRUM-1316i · La cabecera 1708 de PREGUNTAS_ASESOR deja de decir «⏰ A6: 18/19-nov»

**Medido contra:** `origin/main` = `dd26ef66fa8d9e92cbefc116e6f55da900db6fb0` · 2026-11-18T16:44:42Z (cabecera `Date:` de GitHub)

A9: sin fallo que generalice — es corregir una cabecera caducada por un hecho nuevo (convalidación del 12-nov, medida en 1316h); el desfase de la medición 1316g ya lo apuntó jv-j5bg en su tramo.

Sesión J5 (IA, `jv-j5bh`), 18-nov-2026, por encargo del orquestador del equipo de Javier
(`cobroflash-backend-ee`). **Sólo documentos.** Ni `src/`, ni `public/`, ni el esquema, ni el máster, ni
la emisión. **No se redacta el aviso de P1** (c.20890): eso es regla 39 y pantalla de S2; el orquestador
dice que ya tiene texto firmado (c.22084) y ticket de construcción (SCRUM-1766), y aquí no se copia.

## Qué cambia en `docs/legal/PREGUNTAS_ASESOR.md` (en sitio: 2044 líneas antes y después)

1. **Línea 1708 (cabecera del bloque 23):** pasa a decir lo de la fila 23 del índice de SCRUM-1264
   (c.22074, que copia el literal que propuso jv-j5bg en c.22068): «34 (E6) + A1–A5 · … · ✅ A6 sin
   objeto: el RDL 29/2026 se convalidó el 12-nov (BOE-A-2026-23755, BOE 13-nov; DS 213) · ⏰ A1–A5: 1-dic
   (condición cumplida)». El título del bloque («El 10 % de obras y el medio de pago») se conserva.
2. **Línea 1714 (el aviso ⚠️ del bloque):** se le añade al final una nota fechada el 18-nov-2026 con la
   fuente (`BOE-A-2026-23755`, DS 213, SCRUM-1316 c.22068) y «Sin respuesta de asesor».
3. **Línea 1741 (A1–A6):** A6 se **marca** sin objeto desde el 12-nov, con fecha y fuente; **la pregunta
   no se borra** y el estado medido el 12-nov (c.21629) se deja como se escribió.

## Las citas a esas líneas

`git grep` de `PREGUNTAS_ASESOR(.md)?:<n>` en el árbol: 43 ficheros, 130 citas; la más alta apunta a
`:1327`. **Ninguna apunta a 1690-1750** (control positivo: las de `:978` salen 17 veces). Como no se
mueve ninguna línea, las de fuera del bloque siguen apuntando a lo mismo. Las de Jira (`:1708` y `:1740`
en c.21854) siguen cayendo en la cabecera y en la línea «34 (E6), completada».

## Lo que NO está medido

- La descripción de SCRUM-1264 no la he leído entera: el literal de la fila 23 lo confirmó el
  orquestador por mensaje (c.22074 = el de c.22068, sin cambios).
- El «_Origen: c.20892_» de la línea 1710 cita un comentario que, según jv-j5bg (c.22068), no es de
  SCRUM-1316; no lo he tocado porque no estaba en el encargo y no he medido de qué ticket es.

**Corrido:** scrum1294, scrum267, scrum273 y scrum525d, 32 de 32 en verde; `guards:entrada`, 170 de 170. **Suite entera no corrida: sólo documentos; la corre CI** (decisión del orquestador por mensaje, 18-nov, para que la suite entera vaya una vez en SCRUM-1500i, que toca `tests/`).

# SCRUM-1316j · A 23-nov el BOE no ha cambiado nada; propuesta del aviso P1 para firma; lo que el fundador decide antes del 1-dic

**Medido contra:** `origin/main` = `1acb5e4ea4f5f5b026b84a462a98bd7ae4ae3744` · 2026-11-23T20:35:29Z (cabecera `Date:` de GitHub)

A9: sin fallo que generalice — en el primer mensaje al orquestador di mi contexto «~125k» estimado, y A19 ya dice que estimarlo no vale; medido después en mi jsonl era 145k (143.585 + 1.717 + 2). La regla existe; el fallo fue no aplicarla, y aquí va la cifra medida.

Sesión J5 (IA, `jv-j5bp`), 23-nov-2026, por encargo del orquestador del equipo de Javier
(`cobroflash-backend-2d`). Solo documentos. No se toca `src/`, `public/`, el esquema, el camino de emisión
ni `docs/legal/`. **Nada de este tramo es respuesta de asesor.** El texto de ② es una PROPUESTA para que la
firme el fundador (regla 39, y es un texto fiscal: STOP condition de CLAUDE.md); no está en ningún fichero de
código.

## ⓙ1 El BOE, re-medido hoy

Instrumento: `docs/master/evidencias/scrum1316/remedida-boe-1316j.mjs` (API de datos abiertos,
`Accept: application/xml`). Salida entera, con el sha256 y la cabecera `Date` de cada recurso:
`docs/master/evidencias/scrum1316/remedida-boe-1316j.txt`. Población: 9 recursos, los 9 HTTP 200.

| qué | sha256 hoy | comparado con 1316h (18-nov) |
|---|---|---|
| LIVA, metadatos (`BOE-A-1992-28740`) | `0b953b4214e62c19…` | **igual**; `fecha_actualizacion` = `20261007T092353Z` |
| LIVA, bloque `a91` (1.051.987 B) | `03898893f793534b…` | mismo tamaño que el 18-nov (ese día no se guardó el hash); 44 versiones, la última `BOE-A-2026-20823@20261008`; la frase del medio de pago 2, «1 de diciembre de 2026» 7 |
| RDL 29/2026, metadatos | `8b3a0679954a65ff…` | **igual**; `fecha_actualizacion` = `20261113T084620Z`, sin derogar, vigencia no agotada |
| RDL 29/2026, análisis | `b74982788a78469f…` | **igual**: no hay posterior nueva después de la convalidación (`BOE-A-2026-23755`) |
| Sumarios 19, 20, 21 y 23-nov | ver el `.txt` | «Real Decreto-ley 29/2026» 0, `BOE-A-2026-20823` 0 en los cuatro |

- **Control de método** (el art. 91 viene en su versión nueva): la última versión del bloque es la del
  29/2026, con la condición del medio de pago. Es la API consolidada, no `buscar/xml.php`.
- **Control positivo del lector de sumarios**, sembrado por el propio instrumento: el sumario del 13-nov
  trae `BOE-A-2026-23755` 4 veces y «Real Decreto-ley 29/2026» 1. **Negativo:** «zzqx» 0 en los 9.
- **Corrección de errores del 29/2026: no consta.** Los sumarios traen correcciones de errores (2, 2, 0 y
  5), y ninguna nombra el 29/2026; el análisis tampoco tiene posterior nueva.
- **Tramitación como proyecto de ley: no consta en el BOE.** No se ha mirado la ficha del Congreso hoy.

**Veredicto:** nada ha cambiado desde 1316h. **El 1-dic sigue**, con el texto de §Ⓛ/§Ⓩ.

## ⓙ2 Propuesta del aviso P1 (para firma del fundador; NO es texto en código)

P1 de c.20890, citado de §ⓗ (no lo he vuelto a leer en Jira): «Si la Diputación Permanente convalida el
RDL 29/2026, se trae al fundador un texto de aviso para firmar…». Se convalidó el 12-nov.

**Dónde saldría:** al elegir 10 % en el selector de la línea (`public/dashboard/js/tiposDeIva.js`, carril S2,
del equipo de Luis), solo para comercios de España peninsular y Baleares. ⚠️ El propio fichero dice que el
10 % entra también por el campo libre «IVA por defecto» del documento (`quotesView.js:385`), por el catálogo y
por plantillas o IA. Eso lo he leído en el comentario del fichero; no lo he ejecutado. **Un aviso que solo
esté en el selector no ve esas otras entradas.**

**Literal A (corto, recomendado por la IA):**

> Desde el 1 de diciembre de 2026, el IVA del 10 % en obras de vivienda solo se aplica si el cliente paga con tarjeta, transferencia bancaria, cheque nominativo o ingreso en cuenta. Si cobras en efectivo, consúltalo con tu asesor.

**Literal B (con la norma):**

> Desde el 1 de diciembre de 2026 (Real Decreto-ley 29/2026), el tipo del 10 % en renovación y reparación de viviendas exige cobrar con tarjeta, transferencia bancaria, cheque nominativo o ingreso en cuenta. YaQu no comprueba cómo te pagan.

Qué NO dicen, y por qué: no dicen si **Bizum** cuenta (A2, sin respuesta), ni qué pasa con una **obra
empezada o una señal cobrada antes del 1-dic** (A3), ni **cómo se acredita** (A4). Contestar cualquiera de esas
tres en pantalla sería dar una conclusión de IA como si fuera del asesor. La enumeración de medios de pago es
la del BOE, literal.

## ⓙ3 Lo que el fundador tiene que decidir antes del 1-dic (recomendaciones de IA, no del asesor)

1. **D1 · ¿Firmas el aviso: A, B o otro?** Fecha útil: con margen para que S2 lo monte antes del 1-dic.
   *IA recomienda A.*
2. **D2 · ¿Dónde sale el aviso: solo en el selector de la línea, o también en «IVA por defecto»?**
   *IA recomienda los dos*: son las dos entradas en las que el profesional teclea el 10 %.
3. **D3 · = P3 de §ⓒ: ¿confirmas que el programa nunca elegirá el tipo según el medio de cobro?**
   *IA recomienda ✅*: el tipo se fija al emitir y una factura emitida no se edita (regla 29).
4. **D4 · ¿Aceptas que el 1-dic llegue sin respuesta del asesor a A1–A5?** Según §ⓗ, no hay asesor hasta la
   SL (SCRUM-1264 c.22060). *IA recomienda ✅, con el aviso de D1*: cita la ley sin interpretarla.
5. **P2 de §ⓒ** (hacer obligatorio el medio de cobro) **no es de antes del 1-dic**: su fecha es la de
   encender `INVOICING_ES_ENABLED` para un comercio español real. *IA recomienda dejarla para el asesor.*

## ⓙ4 Lo que NO está medido

- La ficha del Congreso del 29/2026 hoy (la tramitación como ley se mira solo en el BOE).
- El sumario del 22-nov (domingo, no se bajó) y el del 18-nov (ya en 1316h).
- El literal de c.20890 en Jira: lo cito de §ⓗ, no lo he releído.
- Que las cuatro entradas del 10 % que nombra `tiposDeIva.js` sigan siendo así: leído en un comentario, no
  ejecutado.

**Corrido:** ver el comentario de entrega en SCRUM-1316. Suite entera no corrida: solo documentos.

# SCRUM-1316k · Un cargo NO pagado ya no manda sobre el método declarado (`metodoDeUnCobro`)

**Medido contra:** `origin/main` = `97e196f930334971538b5c0ba13e0224cbe7d184` · 2026-11-23T21:18:12Z (cabecera `Date:` de GitHub)

A9: comprobación → `tests/scrum1316k-cargo-no-pagado-no-manda.test.mjs`
Mutaciones: catálogo → `tests/scrum1316k-cargo-no-pagado-no-manda.test.mjs`

Sesión J2 (IA, `jv-j2ed`), 23-nov-2026, por encargo del orquestador del equipo de Javier
(`cobroflash-backend-2d`). Decisión del fundador: SCRUM-1316 c.22438, punto 2 («1-Sí a las 5»). Hallazgo:
c.22437 (jv-j2eb). Sin texto nuevo para el usuario, sin esquema y sin camino de emisión.

## ⓚ1 El cambio

`src/modules/billing/domain/metodoDeCobro.ts` (carril J2): `metodoDeUnCobro` solo toma `Charge.method` si el
cargo está **pagado** (`status === 'paid'`). Si no lo está, manda `Invoice.paidVia` (lo declarado); si no hay
nada, `null` = «no consta» (la política de siempre, sin cambios). `CobroConMetodo.charge` lleva ahora
`status?` **opcional**: si un llamador no trae el estado, la regla es la de antes (el cargo manda).

## ⓚ2 Quién llama (medido con `grep`, 3 llamadores en `src/`)

| llamador | carril | ¿trae `charge.status`? | efecto |
|---|---|---|---|
| Cobros, `cobros.service.ts:333` | J2 | pasa facturas sin `charge` (`include` solo `customer`, :230-232) | ninguno |
| Recibo HTML, `invoicesAdmin.routes.ts:511` | J1 | sí, `:447` selecciona `status: true` | **arreglado** sin tocar el fichero |
| Informe X2, `reports.routes.ts:182` → `cobrosPorCubo.ts:222` | **S1** | **no**, solo `charge: { method: true }` | **sin cambio**: falta `status: true` en `reports.routes.ts:182` |

Por qué «estado ausente = como antes» y no «= no pagado»: en dev hay 9 facturas pagadas con cargo pagado y
`paid_via` NULL (c.22437 ④). Si el estado ausente contara como «no pagado», el informe las pasaría a «no consta».
La línea de S1, según el orquestador, está apuntada como pieza de Luis en SCRUM-1316 c.22445 (no lo he leído yo). El caso ⑤ del test fija este
comportamiento. Diseño acordado con el orquestador por mensaje, 23-nov.

## ⓚ3 Corrido

- Test nuevo, **en ROJO antes del cambio**. Primera versión: 7 casos, 3 pasan y 4 caen (los tres ① y el ③).
- Después del cambio, 7 de 7. Build con tipos (`tsc -p .`, sin `--noCheck`): salida 0, 0 bytes de salida.
- Versión final: 5 casos, 5 de 5. Los tres ① pasan a ser uno solo con un bucle dentro (ver ⓚ5).
- Mutación con `aplicarUna` de `scripts/meta-guard-mutaciones.mjs`, «vuelve a preferir el cargo no pagado»,
  corrida sobre la versión final. Esa mutación es la regla anterior al cambio, así que esta pasada es también
  el rojo de la versión final: caen el ① que la nombra y el ③ como colateral (2), y ②, ④ y ⑤ siguen en
  verde (3). Después se comprobó el árbol (`git status`, y en `src/` y `dist/` sigue el código del cambio).
- Dirigida, antes de escribir este tramo: 28 ficheros. Son los que nombran `metodoDeCobro`/`metodoDeUnCobro`,
  más 441 (4), 1773, 836, 700, 710b, 719, 810, 1294, 267, 273, 525d y 854. Resultado: 273 casos, 272 pasan y
  1 cae (pass + fail = total). El que cae es `scrum854` ②, «esta rama trae su entrada de registro», y lo
  arregla este tramo.
- Después del commit: los guards del registro (854, 1294, 267, 273, 525d) más el test nuevo dan 45 de 45.
  Los vecinos de mis cicatrices (1387, 411, 737, 553, 1415, 1177, 747, 709, 499, 503, 506, 491) son 14
  ficheros y 124 casos: 123 pasan y cae 1, `scrum1415` (ver ⓚ5). `npm run guards:entrada` da 170 de 170.

## ⓚ5 Lo que me salió mal

Construí los nombres de los tres casos ① con un bucle y una plantilla. Es justo lo que prohíbe
`tests/scrum1415-nombres-construidos.test.mjs`, y una cicatriz de J2 del 13-oct ya lo cuenta. Lo cazó ese
guard en la pasada local, antes del empujón. Lo arreglé en el código del test, no en el guard: ahora es un
solo caso con el bucle dentro.

## ⓚ4 Lo que NO está medido

- **La suite entera no se ha corrido en local**: la corre el check obligatorio.
- Nada contra staging ni producción: la fila de staging (c.22437) no se ha vuelto a leer, y la función no se
  ha ejecutado contra ella. El test reproduce su forma: `paid_via = bizum_manual` y un cargo `card` en
  `pending`.
- El informe X2 sigue diciendo «tarjeta» en ese caso hasta que entre la línea de S1.
- `seRegistroAMano` (`cobrosPorCubo.ts:234`, S1) cuenta como «a mano» solo las facturas **sin** cargo. Una
  factura marcada a mano que tiene un cargo sin pagar no entra en el registro. Esto es leído en el código y no
  medido. Es de S1, y aquí no se toca.
