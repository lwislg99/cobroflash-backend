# SCRUM-607 · ALB-02 · Ocultar precios en el albarán — **FASE A: la medición y la columna**

**Medido contra:** `origin/main` = `da5af22e347bbdfa3e57e1e658676e1cbd9bf310` · 2026-09-04T17:03:02+01:00

> 🛑 **ESTO ES FASE A Y NO LLEVA CÓDIGO DE PRODUCTO.** El propio encargo lo pide: «¿Lleva columna
> nueva? Un “este albarán no enseña precios” es un dato del documento. Si la lleva, **es FASE A y
> me la entregas antes de construir**». **La lleva.** Y además `prisma/schema.prisma` es dominio
> del fundador, así que la columna se propone, no se escribe.

## Lo que hay que saber antes de leer el resto

Existe un mecanismo que **parece** éste y **no lo es**: `Albaran.modoValoracion` (SCRUM-65). Y no
falla por poco — **usarlo para ocultar precios le cuesta al profesional la factura**.

## PASO 0 · lo medido

### (a) ENTRADA — dónde vive hoy el control de precios

Dos sitios, los dos con la misma casilla:

| dónde | fichero y línea | cuándo |
|---|---|---|
| barra de «Documentos» del Trabajo | [jobDetailView.js:1130-1136](public/dashboard/js/jobDetailView.js#L1130-L1136) | **antes** de crear el albarán |
| editor del albarán | [jobDetailView.js:2002-2015](public/dashboard/js/jobDetailView.js#L2002-L2015) | sólo en `borrador`; congelado desde `emitido` |

El control de ALB-02 va **junto a ése**, en el editor del albarán, que es donde el profesional
decide qué entrega. No nace una pantalla nueva.

### (b) MECANISMO — ¿es `docFields`? ¿es `modoValoracion`? **Ninguno de los dos, y está medido**

`docFields` es del **presupuesto**, no del albarán: vive en `Quote` (`schemas.ts:236`,
`pdf.service.ts:610`) y decide qué datos **del cliente** imprime el documento. El `Albaran` no lo
tiene. La **idea** sí se reutiliza —«el documento decide qué enseña, la pantalla no»—; la columna,
no, porque no está en esta tabla.

`modoValoracion` es lo que de verdad se parece, y es **otra cosa**: no decide qué enseña el papel,
decide **qué contiene el albarán**. Medido en las tres puntas:

| | `SIN_VALORAR` | lo que pide ALB-02 |
|---|---|---|
| la línea puede llevar precio | **NO** — `400`: «este albarán es SIN_VALORAR — no puede llevar precio ni IVA» ([albaran.service.ts:103-106](src/modules/jobs/domain/albaran.service.ts#L103-L106)) | sí |
| la pantalla del pro enseña los precios | **NO** — `syncRowToModo` pone las celdas a `display:none` ([jobDetailView.js:2032](public/dashboard/js/jobDetailView.js#L2032)) | **sí** (P-DOC-4) |
| se puede facturar | **NO** — `409 albaran_sin_precios`: «El parte no lleva precios. Edítalo para añadirlos.» ([albaranes.routes.ts:1000](src/modules/jobs/app/routes/albaranes.routes.ts#L1000)) | sí |

> 🔴 **La tercera fila es la que cierra la puerta.** Si el profesional usa `SIN_VALORAR` para no
> enseñar sus márgenes, **pierde la valoración y no puede facturar ese parte**. Es exactamente lo
> que el fundador excluyó al resolver P-DOC-4: la pantalla es su herramienta de trabajo, «necesita
> los precios para valorar y para facturar después». `modoValoracion` no puede servir a ALB-02
> sin dejar de servir a lo suyo.

### (c) EL PDF — dónde se pintan los precios, y qué cuelga de ellos

[albaranPdf.service.ts](src/modules/jobs/infra/albaranPdf.service.ts), un solo booleano
(`valorado`, línea 129) manda sobre cuatro cosas:

| qué | línea | `VALORADO` | `SIN_VALORAR` |
|---|---|---|---|
| anchos de columna | 207-211 | 36 / 12 / 12 / 18 / 22 % | **62 / 18 / 20 %** |
| cabeceras `PRECIO UD.` e `IMPORTE` | 223-226 | sí | no |
| importes por línea | 286-289 | sí | no |
| bloque `Base:` / `Total:` + coletilla | 301-307 | sí | **no se pinta** |

**Censo de precios en el PDF, generándolo de verdad y leyendo su texto** (9 señales: los 5
importes, las 2 cabeceras, `Base:` y `Total:`):

```
modoValoracion = SIN_VALORAR  →  0/9 señales de precio
modoValoracion = VALORADO     →  9/9
```

**La tabla ya está resuelta y no descuadra**: los anchos alternativos existen desde SCRUM-65 y
suman 100 %. Ocultar precios **no pide tocar la maquetación**: pide que ese booleano deje de ser
`modoValoracion === 'VALORADO'` a secas.

**Y la misma pregunta en la pantalla pública del cliente**: `renderLineasAlbaran`
([albaranPublicVista.ts:64-95](src/modules/jobs/app/routes/albaranPublicVista.ts#L64-L95)) tiene
el mismo reparto —cabecera de 3 o 5 columnas, totales sólo si `valorado`—. Un albarán que oculta
precios en el PDF y los enseña en la web del cliente no oculta nada: **las dos superficies van en
el mismo carril**.

#### PROPUESTA, no decidida en silencio: ¿enseña TOTAL un albarán sin precios?

**No.** Un total es un precio: es el margen sumado. Se propone que el flag apague **las dos
columnas de dinero y el bloque de totales**, exactamente el reparto que ya produce `SIN_VALORAR`
—que es también lo que hace el albarán de Quipu—. **Se mantiene la columna `UNIDAD`**: no es
dinero, y es información que el cliente necesita para comprobar lo entregado.

### (d) LA REFERENCIA AL PRESUPUESTO — el dato existe, y **no llega al PDF**

* **Existe y ya se resuelve**: SCRUM-302 lo hace por `Job.quoteId` →
  `Quote.quoteNumber ?? Quote.id`, en [albaranes.routes.ts:665-671](src/modules/jobs/app/routes/albaranes.routes.ts#L665-L671).
* **Pero sólo va al rail de la pantalla** (`quote: { id, number }` en la respuesta de
  `GET /admin/albaranes/:id`). **`generateAlbaranPdf` no recibe ningún campo del presupuesto.**
* Lo que el PDF imprime hoy es `Referencia: <Job.titulo>` (línea 186-189) — un **título libre**
  («Fuga en cocina»), no el número del presupuesto —, y lo imprime **en los dos modos**.

O sea: **la mitad de trazabilidad del encargo no está construida**, y no hace falta ninguna
columna para construirla — el dato ya está a un `select` de distancia.

⚠️ **Una decisión que no es mía**: los cinco campos que el sobre de firma congela son `obra`,
`referenciaTrabajo`, `cliente`, `emisor`, `emisorNif` (SCRUM-452,
[albaranVerificacion.ts:339](src/modules/jobs/domain/albaranVerificacion.ts#L339)). El número del
presupuesto sería un **sexto campo impreso que el sello no cubre**. La doctrina de ese fichero lo
permite —«lo que queda aquí es lo que el sobre NO congela, y por eso se lee en vivo con toda
razón: sobre ello el sello no afirma nada»—, y `Job.quoteId` es `@unique` y se fija al aceptar,
así que en la práctica no cambia. **Aun así se pregunta antes de imprimirlo en un documento que se
firma.**

### (e) ¿COLUMNA NUEVA? — **SÍ**, y por eso esto es FASE A

Un «este albarán no enseña precios en el papel» es un dato **del documento**: se elige una vez, se
imprime muchas, y el PDF se regenera. No puede vivir en el navegador ni derivarse.

Medido sobre `model Albaran` (`prisma/schema.prisma:1086-1140`): **no hay ninguna columna donde
quepa**. `lineas` es de las líneas; `evidenciaFirma` es de la firma; `notas` y `docHeaderText` son
texto del profesional; `modoValoracion` es lo que el albarán **contiene** (ver (b)).

## La columna que se propone

```prisma
// SCRUM-607 (ALB-02): el albarán CONSERVA sus precios —el pro los necesita para valorar y para
// facturar— pero el DOCUMENTO que se entrega no los enseña. Es la misma distinción que hace
// `docFields` en el presupuesto: decide qué muestra EL PAPEL, no la pantalla.
// Aditivo, default `false` = comportamiento actual intacto.
ocultarPreciosEnDocumento Boolean @default(false) @map("ocultar_precios_en_documento")
```

| decisión | propuesta | motivo |
|---|---|---|
| tipo | `Boolean` | son dos estados, y no se prevé un tercero; un `String` invitaría a inventar valores (regla 27) |
| default | `false` | los albaranes que ya existen salen **byte a byte como hoy**. Es la condición de cierre que pide el encargo |
| ¿editable hasta cuándo? | **`borrador` y `emitido`; congelado al firmar** | ⚠️ **la única decisión donde me aparto de `modoValoracion`**, que se congela en `emitido`. Aquél cambia el CONTENIDO —congelarlo pronto protege el importe—; éste sólo cambia **qué se imprime**, y el caso real es «ya lo emití y ahora me lo piden sin precios». Al firmar sí se congela: ahí el papel es prueba |
| ¿entra en el sobre de la firma? | **NO** | el sello certifica el CONTENIDO canónico, no el PDF (`albaran.service.ts:532`), y este flag no cambia ni una línea ni un importe. **Si el fundador prefiere que entre, sube `evidenciaFirma.v` a 4 y eso es otro ticket** |
| ¿toca la facturación? | **NO** | `409 albaran_sin_precios` mira `modoValoracion`, que no se toca. Un albarán con este flag **sigue siendo facturable**, que es el punto entero |

**Migración**: aditiva, una columna `boolean not null default false`. Preview obligatorio
(`node scripts/preview-migracion.mjs`) antes de cualquier `db push`, y el orden es
staging → `yaqu_dev_javier` → producción. **No la ejecuto yo.**

## Lo que se construiría en FASE B, una vez aprobada la columna

1. La casilla en el editor del albarán, junto a la de precios ([jobDetailView.js:2002](public/dashboard/js/jobDetailView.js#L2002)).
2. `generateAlbaranPdf`: el booleano `valorado` pasa a ser
   `modoValoracion === 'VALORADO' && !ocultarPreciosEnDocumento`. **Ni un ancho nuevo, ni una
   columna nueva en la tabla**: se reutiliza el reparto que ya existe.
3. `renderLineasAlbaran`: lo mismo en la pantalla pública del cliente.
4. La **referencia al presupuesto** en el PDF (pendiente de la decisión de (d)).
5. Los tests que pide el encargo: PDF idéntico con el flag apagado, cero precios y referencia
   presente con el flag encendido, la pantalla del pro enseñando precios en los dos casos, rojo
   por el mecanismo nombrando qué precio se coló, y el suelo del censo.

## Microcopy — no se inventa ningún literal

El rótulo del control nuevo **no está aprobado**. La casilla que ya existe dice **«Incluir precios
en el parte»** (dos apariciones: `jobDetailView.js:1135` y `:2014`), y **SCRUM-319 cuenta esas
apariciones**, así que ni se cita en un comentario ni se reutiliza sin decidirlo.

La caja a 929 px y 390 px se mide **cuando el control exista** (FASE B): medir la caja de un
control que no está pintado sería inventarse el número. Mientras tanto el rótulo saldrá con la
grafía que cuenta el censo de SCRUM-402 —`[PENDIENTE …`— y se avisará **con el número delante**,
antes y después.

## Lo que este ticket NO toca

`generateInvoicePdf` ni su ámbito alcanzable (hay un guard de SCRUM-723 vigilándolo contra la base
de la rama) · los estados del albarán (regla 27) · `quotesView.js` · `customersView.js` ·
`prisma/schema.prisma`, que se **propone** y no se escribe · Jira.
