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
