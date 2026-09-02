# SCRUM-593 · DOC-03 · Cabecera y pie del documento

**Fecha:** 2-sep-2026 · **Carril:** B · **Gate:** entrega en DOS documentos, no en tres
**Medido contra:** `origin/main` = `443a9e224c14204c0a01ee75751c067762ef04a0` · 2026-09-02T13:03:45Z
**Rama:** `scrum-593-doc03-cabecera-y-pie`

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.
> El ancla está **medida** con `git rev-parse`.

---

## 🛑 SE ENTREGA EN DOS DOCUMENTOS, NO EN TRES. LA FACTURA QUEDA FUERA

El fundador aprobó «Observaciones» para los tres documentos. **La factura no se toca**, y se
escribe aquí en vez de dejarlo implícito: *un ticket que entrega dos tercios y no lo dice se lee
después como si hubiera entregado tres.*

**El motivo, medido:** `ensureInvoicePdf` (`src/lib/invoicing.ts`) **REGENERA** el PDF cuando el
fichero no está en disco —`!fs.existsSync(diskPath)` forma parte de `needs`— y su propio comentario
dice por qué eso pasa siempre: *«el fs de Railway es efímero»*. Al regenerar llama a
`generateInvoicePdf` con los datos guardados y **el código de hoy**. Añadirle un bloque cambiaría el
aspecto de **facturas ya emitidas** en cuanto alguien las abriera tras un despliegue: **regla 29**.
Está fichado como **SCRUM-665** y no es de este ticket.

## PASO 0

**ENTRADA: no existe ninguna.** Cero apariciones de estos campos en todo el dashboard. Así que
esto **no era darle superficie a un motor: era construir la puerta entera.**

**MECANISMO:** medido por identidad sobre el esquema, no sobre la documentación.

| campo | Quote | Invoice | Albaran |
|---|---|---|---|
| cabecera | ❌ falta | ❌ falta (fuera) | ❌ falta |
| pie | ❌ falta | ❌ falta (fuera) | ✅ **`notas @db.Text`** — existe **y ya se imprime** |

`internalNotes` **no vale**: su contrato dice *«nunca visibles al cliente»*. Reutilizar un campo
cuyo comentario dice lo contrario es peor que crear uno nuevo.

**El pie del albarán se REUTILIZA, no se duplica.** Lo único que cambia ahí es el rótulo.

## LAS TRES COLUMNAS, con su nombre FÍSICO fijado a mano

`quotes` **mezcla convenciones**, y por eso el `@map` va explícito. Medido sobre
`docs/sql/deriva-prod.sql` —la lista real de nombres físicos— y contrastado con el esquema:

* **las columnas CON `@map` son snake_case**: `valid_until`, `doc_fields`, `internal_notes`,
  `job_id`, `quote_number`, `pay_methods`, `custom_billing_plan`, `created_via`, `decision_token`,
  `es_adicional`, `team_member_id`;
* **las camelCase son las que NO llevan `@map`**, donde Prisma conserva el nombre del campo:
  `createdAt`, `updatedAt`, `acceptedAt`, `pdfUrl`, `signatureUrl`, `paymentTerms`…

O sea que **la convención viva para una columna NUEVA en `quotes` es snake_case con `@map`
explícito**. `albaranes` es snake_case al 100 % (`lugar_entrega`, `firma_token`, `pdf_url`,
`modo_valoracion`…), y `notas` es una sola palabra, igual en las dos convenciones.

Referencias que pidió el asesor para contrastar: **`Albaran.notas` → `notas`** (declarado
`String? @db.Text` **sin `@map`**; palabra única, sin comillas) y **`Quote.validUntil` →
`valid_until`** (con `@map("valid_until")`).

## 🔴 EL MARCADOR QUE NO CUENTA NADIE — dicho explícitamente

Este ticket pone un `[PENDIENTE microcopy oficial]` en **`src/modules/invoicing/infra/pdf/pdf.service.ts`**
(`MARCADOR_MICROCOPY_CABECERA_DOC`) y otro en `public/dashboard/js/textoDelDocumento.js`.

**El censo de SCRUM-402 mira SÓLO `public/dashboard/js`**, así que el de `src/` **queda fuera de
todo censo**. Se dice aquí porque el sitio donde se ve es un documento que se le entrega a un
cliente, y nadie se enteraría por un guard.

## MICROCOPY

* **«Observaciones»** — bloque final. **Aprobado por el fundador el 2-sep-2026**, literal y sin
  variantes. **Sin marcador**: marcar texto firmado obligaría a refirmarlo.
* En el albarán ese bloque salía como **«Notas:»**: se sustituye **texto aprobado por texto
  aprobado**, no por un marcador.
* **El rótulo de la CABECERA sigue SIN decidir** → `[PENDIENTE microcopy oficial]`, y **no se
  deriva de «Observaciones»**. Hay un test que exige que los dos rótulos sean distintos.

## LO QUE SE ENTREGA

* `generateQuotePdf` acepta `docHeaderText` y `docFooterText`. Sin ellos el documento sale como
  hasta hoy.
* El albarán acepta `docHeaderText`; su pie sigue siendo `notas`.
* **La superficie**: `public/dashboard/js/textoDelDocumento.js`, registrada en el índice **antes de
  `quotesView.js`** y en el precache del service worker (SCRUM-274: `addAll` es atómico).
  Contador **68 → 69**, recontado sobre el índice, no sumado.
* **Multilínea en los tres canales**: PDF (PDFKit respeta el `\n`, comprobado con `lineasDePdf`),
  pantalla (`white-space: pre-line`, y `pre` descartado con su motivo: no envuelve) y el payload,
  que conserva el texto entero.

## LOS SUELOS

| Rotura | Qué cae |
|---|---|
| el bloque no se pinta | «los dos bloques SALEN» |
| rótulo y texto PEGADOS en una línea | «son LÍNEAS DISTINTAS» — para eso se hizo `lineasDePdf` |
| se marca el rótulo aprobado | «no lleva marcador» |
| se deriva el rótulo de cabecera del otro | «los dos rótulos son distintos» |

Y un defecto propio, cazado por el suelo: el guard de `innerHTML` **se cazó a sí mismo en el
comentario que explica la prohibición** (lección de SCRUM-349). Ahora mira sólo el código, con su
propio suelo para que el recorte no se coma el fichero.

## 🕳️ HUECOS DECLARADOS

* **«Byte-idéntico» no se puede comprobar**, y está medido: dos PDF del MISMO contenido difieren
  —PDFKit escribe `/CreationDate`—, mismo tamaño (1967 = 1967) y `Buffer.compare !== 0`. Se usa lo
  más fuerte que sí existe: **mismo texto, mismas líneas y mismo tamaño**.
* **El albarán se ancla en el fuente**, no sobre un PDF generado: levantarlo exige su sobre entero.
  El control sobre documento real está hecho en el presupuesto, que comparte rótulo y mecanismo.
* **El cableado al formulario y al servidor NO está hecho**, y es deliberado: va en el mismo PR que
  el esquema, porque la casa no admite ② ALTER después de ③ PR.

## Lo que NO se ha tocado

`src/lib/invoicing.ts` y el camino de emisión (SCRUM-665) · `prisma/schema.prisma` (a la espera del
ALTER) · `products.routes.ts` (S1) · `QuoteLineSchema` y el coste unitario (S1, SCRUM-661) · la
entrada duplicada de `_banco-vistas.mjs` (SCRUM-663).

---

# ✅ FASE ② · EL `ALTER`, APLICADO A LAS BASES ALCANZABLES (2-sep-2026)

**Medido contra:** `origin/main` = `443a9e224c14204c0a01ee75751c067762ef04a0` · 2026-09-02T13:03:45Z

## 🔴 LA PREMISA DEL ENCARGO ERA FALSA, Y POR ESO SE MANDABA COMPROBARLA

El encargo decía: *«el fundador ha aplicado el `ALTER` en LAS TRES BASES. Confírmalo tú, no te
fíes de esta frase.»* **No estaba aplicado en ninguna de las dos alcanzables.** La medición leyó
**58** columnas entre `quotes` y `albaranes` y **0 de las 3** nuevas.

Y se midió **con control positivo**, porque un cero de un instrumento roto se lee exactamente
igual que un cero verdadero: la misma consulta tenía que seguir viendo `quotes.valid_until`,
`quotes.internal_notes` y `albaranes.notas`. Las vio antes y las vio después. Sin eso, el
«faltan» no habría sido una medición sino una suposición con formato de tabla.

## 🔴 SE NOMBRA LA BASE FÍSICA, NO LA VARIABLE

Al medir se destapó que **`DATABASE_URL_STAGING` y `DATABASE_URL_TESTS` son la MISMA cadena** y
resuelven al mismo `host:puerto/base`. Así que **«las tres bases» no existen como tres entidades**
desde un árbol de trabajo: hay **dos** alcanzables y producción, que no vive aquí.

Escribir «aplicado en dev y staging» habría nombrado tres cosas donde hay dos y habría escondido
que la base de la tanda gateada y la de staging son **una**. *Un nombre de variable no es
evidencia de a qué apunta.*

| Base **física** | La resuelven | Estado | Verificado |
|---|---|---|---|
| **`yaqu_dev_javier`** (host `acela`) | `DATABASE_URL_DEV` | ✅ aplicado | **3/3** · `text` · `is_nullable=YES` · `column_default=null` |
| **`railway`** (host `acela`) | `DATABASE_URL_STAGING` **+** `DATABASE_URL_TESTS` | ✅ aplicado | **3/3** · `text` · `is_nullable=YES` · `column_default=null` |
| **producción** (host `autorack`) | — | ⛔ **PENDIENTE — la aplica el fundador** | — |

58 → **61** columnas en las dos. Destinos acreditados **antes** de tocar nada con
`scripts/comprobar-claves-bd.mjs` (`DATABASE_URL`: **ausente**, que es lo correcto en un árbol de
trabajo). Turno de staging **tomado y soltado**; libre al terminar.

**Cómo se aplicó:** `docs/sql/scrum-593-cabecera-y-pie.sql`, aditivo, `IF NOT EXISTS` y
re-ejecutable. A `yaqu_dev_javier` con `scripts/aplicar-sql-dev.mjs --go` (la herramienta de la
casa, acotada a dev a propósito). A `railway` con un aplicador que **reutiliza esa misma lista
blanca** — no una segunda lista — y que exige el destino por `host` **y** por nombre de base antes
de abrir conexión.

### El suelo que NO es simétrico con los otros

Se comprueba que **`albaranes.doc_footer_text` NO existe**. Es la única forma de que «el pie del
albarán se REUTILIZA» sea una comprobación y no una intención: son **tres** columnas y no cuatro,
porque `albaranes.notas` ya existe y ya se imprime.

## 🔴 EL PR ③ SIGUE ESPERANDO, Y NO ES CAUTELA

`schemaDrift.ts` compara **esperado ⊆ real** al arrancar: una columna de MÁS en la base es inocua,
una de MENOS **impide arrancar producción** (SCRUM-220). Con producción sin aplicar, un
`prisma/schema.prisma` que nombre estos campos **tumba el arranque en el siguiente despliegue**.
Por eso el esquema, el cableado y sus tests van juntos y **después**.

## LO QUE YA ESTÁ EN VERDE Y NO SE REHACE

Los **dos suelos** que pedía el encargo están construidos y pasan, sobre PDF real y leídos por
`lineasDePdf` (SCRUM-659), no por el lector de texto —que concatena sin separador y daría verde a
un bloque pegado—:

| Rojo | Test |
|---|---|
| el bloque **no se pinta** | «los dos bloques SALEN en el PDF del presupuesto» |
| cabecera y pie salen **PEGADOS** | «el rótulo y su texto son LÍNEAS DISTINTAS, no una pegada» |
| un texto de 3 líneas sale en 1 | «MULTILÍNEA», con su control de que el instrumento distingue |
| se cuela un bloque sin pedirlo | «SIN los campos, el documento sale como hasta hoy» |

## 🕳️ EL HUECO QUE SIGUE ABIERTO, DICHO SIN ADORNO

**La superficie existe pero NO ES ALCANZABLE.** `textoDelDocumento.js` está escrito, registrado en
el índice (posición 249, antes de `quotesView.js`), en el precache del service worker y en la
lista declarada de SCRUM-662 — pero **ningún formulario lo llama todavía**. Montarlo en el
presupuesto exige tocar `quotesView.js`, que es de S1 este sprint (SCRUM-598), y persistir el
texto exige el esquema, que espera a producción. **Es el defecto nº 2 de la casa —«construido ≠
alcanzable»— y este ticket NO se cierra con él dentro.**

Por lo mismo se corrigió el comentario del índice, que decía *«que los consume»*: hoy no lo
consume nadie. Ahora dice *«que los consumirá en la fase ③»*.

## Fuera de carril, una línea

**SCRUM-668** 🔴 — `DATABASE_URL_STAGING` y `DATABASE_URL_TESTS` resuelven a la misma base. No se
persigue aquí: necesita decisión del fundador, y la medida que decide es plantar una fila
reconocible **desde la suite** y ver si aparece en esa base — si aparece es infraestructura, si no
es documentación.
