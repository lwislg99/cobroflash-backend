# SCRUM-607 · ALB-02 · Ocultar precios en el albarán

**Medido contra:** `origin/main` = `1304643497934441f88950e441182b7e344dbb57` · 2026-09-04T20:01:01+01:00

> **FASE A** (la medición y la columna) va abajo, tal y como se entregó. **FASE B** —lo
> construido, con el GO del asesor y sus tres decisiones— va aquí arriba.

---

# FASE B · lo construido

## Las tres decisiones del asesor, escritas donde el próximo las va a buscar

### ① El candado NO es el de `modoValoracion`, y ése es el motivo

**Editable en `borrador` Y en `emitido`; congelada al FIRMAR.**

`modoValoracion` se congela en `emitido` porque **cambia el importe**, y un importe que se mueve
después de emitir es otro documento. Éste sólo cambia **qué se imprime**, y el caso real es de un
profesional de verdad: **«ya lo emití y ahora me lo piden sin precios»**. Al firmar sí se congela:
ahí el papel es prueba de lo entregado y no se retoca.

> ⚠️ **Al siguiente que lea esto y quiera «unificarlo» con `modoValoracion`: éste es el motivo de
> por qué no.** No son el mismo candado porque no protegen lo mismo. Está escrito también en
> `albaranPrecios.ts` y en el `PATCH`, que es donde se tropieza con ello.

### ② Sin precios NO se enseña total; la UNIDAD se queda

**Un total es el margen sumado**, así que un albarán que oculta precios tampoco enseña `Base:` ni
`Total:`. **La columna `UNIDAD` sí se mantiene: no es dinero**, y es lo que el cliente necesita
para comprobar lo que ha recibido. Es también lo que hace el albarán de Quipu.

### ③ La pantalla pública del cliente entra en el carril

No es un hueco a declarar. `renderLineasAlbaran` tiene el mismo reparto que el PDF, y **si el PDF
oculta los precios y esa pantalla no, el cliente los ve igual** — desde el móvil, que es el sitio
donde más duele. Por eso las dos superficies deciden con **la misma función**, y hay un guard que
lo exige.

### ④ La referencia al presupuesto se imprime, y el sobre se queda en CINCO

El papel decía `Referencia: <Job.titulo>`, un título libre que no identifica nada. Ahora lleva
además de qué presupuesto sale, **en el pie y FUERA de lo que el sobre de la firma congela**.

Ampliar el sobre a seis campos cambiaría el hash y dejaría los albaranes ya firmados con un sobre
de otra forma: **eso es evidencia legal y merece su propia tanda**, no ser un efecto colateral de
ALB-02. Se pudo imprimir sin entrar en el sobre —lo que había que comprobar antes de seguir—
porque va en el mismo cajón que `merchant.address` o `notas`: cosas sobre las que el sello no
afirma nada y que por eso no pueden contradecirlo. **Hay un guard que fija los cinco campos.**

## La columna, APLICADA — y la grafía, MEDIDA antes de fiarme del `@map`

**El ALTER está en las tres bases.** Confirmado por el asesor en staging (`7661649868329066548`) y
producción (`7641555058757427243`), con su control de tipo distinto (`created_at → timestamp`), y
aplicado por mí en **dev** (`yaqu_dev_javier`) por el mecanismo de la casa —`exigirDestinoCorrecto`
delante, sin parsear la URL a mano y sin imprimir ninguna cadena de conexión—:

```
columnas de `albaranes` ANTES:  25   (¿está la nueva? 0)
  → ALTER aplicado
columnas de `albaranes` DESPUÉS: 26   (¿está la nueva? 1)
```

### 🔴 `albaranes` NO mezcla convenciones — y eso se mide, no se hereda

La lección de SCRUM-602 es que una tabla **puede** mezclarlas. Medido sobre `schema.prisma`, campo
a campo:

| tabla | campos | con `@map` | camelCase **de verdad** (sin `@map` y multi-palabra) |
|---|---|---|---|
| **`albaranes`** | 25 | 18 | **ninguno** — los 7 sin `@map` son de una sola palabra (`id`, `numero`, `fecha`, `lineas`, `estado`, `version`, `notas`), donde camel y snake coinciden |
| `quotes` | 47 | 18 | **15** (`merchantId`, `createdAt`, `pdfUrl`, `chargeId`…) |

O sea: **`albaranes` es snake al 100 %** y `quotes` sí mezcla. El comentario del schema ya lo decía
de pasada; ahora está **medido**, que es otra cosa.

### El control negativo de la grafía, contra dev

Escribir por **Prisma** (en camel, que traduce el `@map`), leer por **SQL crudo** (en snake), y
comprobar que preguntar en **camel falla**:

```
① escrito por PRISMA (camel)   → id 173 · ocultarPreciosEnDocumento = true
② leído por SQL CRUDO (snake)  → {"v":true}
③ preguntado en CAMEL          → FALLA ✅  column "ocultarPreciosEnDocumento" does not exist  (42703)
④ columnas reales que casan    → ocultar_precios_en_documento

POST-CONDICIÓN · fila de prueba borrada: sí
```

**Sin el `@map`, Prisma habría buscado `ocultarPreciosEnDocumento` y esa columna no existe.** El
error `42703` es la prueba, no el razonamiento.

### Los tres censos que movió la columna

Añadir una columna no es añadir una columna: hay tres censos que la cuentan y los tres saltaron.
Ninguno se ensanchó — cada uno pedía una respuesta concreta:

| censo | qué pedía | qué se decidió |
|---|---|---|
| **SCRUM-302** · duplicar | clasificar el campo en UNO de los dos cubos | **VIAJA**, por el mismo motivo que `modoValoracion`: es una **decisión** sobre el parte, no un hecho ocurrido sobre el anterior |
| **SCRUM-222** · deriva de producción | regenerar `docs/sql/deriva-prod.sql` | **420 → 421 columnas** |
| **SCRUM-461** · el censo no encoge | la columna estaba en el schema y **no** en el SQL del censo | mismo arreglo: el censo dejaría de preguntar por ella y respondería «en sync» justo sobre la que le falta |

> 🔴 **La de SCRUM-302 es la que tenía respuesta que pensar**, y el caso real la decide: un
> profesional que entrega sin precios a un cliente lo hace con **todos** sus albaranes, no con uno.
> Si el campo no viajara, el duplicado saldría con los márgenes a la vista y lo descubriría cuando
> el papel ya está entregado.

### El hueco declarado, CERRADO

Los cuatro `as any` que existían **porque la columna sólo vivía en el DDL** se han retirado:
`ensureAlbaranPdf`, `serializeAlbaran`, la ruta pública y el `create` del alta leen y escriben el
campo por su nombre. Ya no queda ningún estado intermedio.

## El DDL — generado sobre una COPIA, sin tocar `prisma/schema.prisma`

Con el mecanismo de la casa (`previewMigracion`, binario local y control positivo dentro,
SCRUM-385), no con `npx prisma` a pelo.

**Columnas de `albaranes` ANTES: 25 · DESPUÉS: 26** (contadas sobre los dos ficheros, no a ojo).

```sql
-- AlterTable
ALTER TABLE "albaranes" ADD COLUMN     "ocultar_precios_en_documento" BOOLEAN NOT NULL DEFAULT false;
```

Aditivo y con default: los albaranes que ya existen no cambian. Orden: **staging →
`yaqu_dev_javier` → producción**.

⚠️ **En FASE A esto era una propuesta y el schema no se tocó.** El DDL se generó contra una copia
para poder enseñarlo sin escribir en `prisma/schema.prisma`; el campo entró después, ya con el GO
y con el ALTER firmado para las tres bases — el mismo camino que siguió SCRUM-602 con sus cuatro
columnas.

## Lo construido

| pieza | qué hace |
|---|---|
| `prisma/schema.prisma` | el campo `ocultarPreciosEnDocumento`, con su `@map` medido |
| `src/modules/jobs/domain/albaranPrecios.ts` | **nuevo** · el decisor (`documentoEnsenaPrecios`), el candado (`sePuedeCambiarOcultarPrecios`) y la referencia (`referenciaPresupuesto`). Puro |
| `albaranPdf.service.ts` | el booleano sale del decisor; el pie imprime de qué presupuesto sale |
| `albaranPublicVista.ts` + `albaranPublic.routes.ts` | la pantalla del cliente, **con el mismo decisor** y recibiendo el interruptor |
| `albaran.service.ts` | resuelve el presupuesto de origen y pasa los dos parámetros; el serializador expone el interruptor |
| `albaranes.routes.ts` (PATCH) · `jobs.routes.ts` (POST) | guardan el interruptor, con su candado y booleano estricto |
| `jobDetailView.js` | la casilla en el editor, visible sólo con precios y hasta `emitido` |
| `albaranDuplicado.ts` · `docs/sql/deriva-prod.sql` | los tres censos que movió la columna |

**Ni una columna nueva en la tabla del PDF**: los anchos alternativos (62/18/20 %) existían desde
SCRUM-65 y suman 100 %. Se reutiliza el reparto; sólo cambia de dónde sale el booleano.

## La evidencia

**Trece casos** en `tests/scrum607-precios-fuera-del-albaran.test.mjs`, generando el PDF de verdad
y leyendo su texto.

| lo que pedía el encargo | cómo se comprueba |
|---|---|
| apagado, el papel sale como hoy | se generan los dos: **sin el campo** (la llamada tal cual era) y con él en `false`, y se exige texto **idéntico** |
| encendido: cero precios **Y** la referencia | en el **mismo** test — un albarán sin precios y sin origen es peor que uno con precios |
| la pantalla del pro sigue con precios | `syncRowToModo` —quien decide qué ve el profesional— no puede nombrar el interruptor |
| suelo | apagado, las **9** señales de precio tienen que estar. Si diera cero, todo lo demás sería verde sobre la nada |
| control negativo | ningún control fija el **texto** del rótulo: aprobar el microcopy no puede poner nada rojo |

> 🔴 **El control negativo me cazó a mí primero**: escrito entero, el propio fichero contenía el
> texto que dice no contener y se ponía rojo solo. Es la trampa de SCRUM-203; se parte el literal,
> como hace `scrum702` con sus señales de entorno.

Y dos que el encargo no pedía y que salen de lo medido: la **pantalla pública** oculta de verdad
(HTML sin dinero, con su suelo delante), y el **sobre sigue en cinco campos**.

### Visto en ROJO, y nombrando qué precio se coló

Siete mutaciones sobre el árbol de verdad, revertidas con post-condición (`Buffer.compare` contra
los bytes de disco — SCRUM-570) y `git status` limpio después:

| mutación | qué pasa |
|---|---|
| el papel vuelve a mirar sólo el modo | 🔴 «**SE HAN COLADO 9 SEÑALES DE PRECIO**» + «el PDF ha vuelto a la comparación a pelo» |
| el importe de línea se pinta siempre | 🔴 «SE HAN COLADO **4** SEÑALES» |
| se cuela el `Total:` | 🔴 «SE HAN COLADO **3** SEÑALES» |
| la pantalla pública deja de ocultarlos | 🔴 dos: el decisor común **y** «SE HA COLADO «12,50» en la pantalla que el cliente abre desde el móvil» |
| el interruptor se cuela en la pantalla del **profesional** | 🔴 «EL INTERRUPTOR DEL PAPEL SE HA METIDO EN LA PANTALLA» |
| el pie deja de decir de qué presupuesto sale | 🔴 dos tests |
| **control negativo**: se cambia el **texto** del rótulo | ✅ **verde**, como debe: ningún control mira el copy |

> El rojo **cuenta y nombra** lo que se coló, que es lo que pedía el encargo: no dice «falla», dice
> cuántas señales de precio hay en un papel que no debe llevar ninguna.

## ✅ MICROCOPY · APROBADA POR EL ASESOR el 4-sep-2026 — provisional

**Éste es su registro.** Va aquí y **NO en `docs/microcopy/`**: ese directorio es el registro del
**fundador** y `constaAprobado()` lo barre (SCRUM-726), así que meter ahí la firma del asesor la
haría pasar por la suya. Hay un guard en `scrum607` que comprueba que no existe tal fichero.

| ranura | texto aprobado |
|---|---|
| rótulo de la casilla | **«Ocultar precios en el albarán»** |
| nota bajo la casilla | **«Tú sigues viendo los precios y puedes facturarlo.»** |

**Se descartó «Ocultar precios en el PDF»** pese a ser 20 px más corto, y el motivo es del propio
mecanismo: el interruptor gobierna **las dos superficies** —el papel y la pantalla que el cliente
abre desde el móvil—, así que «en el PDF» describiría la mitad del efecto y el profesional creería
que en el móvil sí se ven.

**Contador declarado**: `ALB_OCULTAR_PRECIOS_SIN_APROBAR = 2` en `jobDetailView.js`. Que no se
pinte el corchete **no** significa que estén firmados por el fundador — eso lo dice el contador,
y hay un guard que exige que cuadre con el número de literales. Se queda aunque llegue a 0, por el
motivo de `filtroClientes.js` y `quoteDireccionObra.js`: el día que entre un tercer texto, nace sin
firma y este número tiene que subir.

**Censo de SCRUM-402**: la entrada `jobDetailView.js: 2` entró por la mañana —comprobado con el
número delante, el trinquete dijo `(+2)`— y **se BORRA** por la tarde, no se pone a 0 (SCRUM-424 /
SCRUM-405). Comprobado antes de borrarla: **cero marcadores en literales** del fichero.

**Sigue con marcador**, y no se toca: `ROTULO_PRESUPUESTO_ORIGEN` en `albaranPrecios.ts` — el pie
del papel. Ése no estaba en la firma del asesor, así que mantiene su `[PENDIENTE` y su entrada en
`CENSO_SERVIDOR` / `EN_EL_PAPEL` de SCRUM-667.

## Microcopy — las cajas que sostienen esa firma

Navegador real, CSS de verdad (`tokens.css` + `styles.css`), la cadena `.modal-overlay > .modal >
.modal-body` que es donde vive el editor.

| | 929 px | 390 px |
|---|---|---|
| `.modal-body` | 520,0 px | 390,0 px |
| ancho útil (sin padding) | 472,0 px | 342,0 px |
| **para el TEXTO del rótulo** (menos casilla y hueco) | **453,0 px** | **323,0 px** |
| alto de la fila **hoy, con el marcador** | 59,3 px | **79,5 px** |

**Rótulo (13 px)** — el marcador mide **363,4 px**: cabe a 929 px y **NO a 390 px**, donde parte
en dos líneas y sube la fila de 59,3 a 79,5 px.

| candidato | ancho | 929 | 390 |
|---|---|---|---|
| `No mostrar precios en el albarán` | 187,4 px | ✅ | ✅ |
| `Ocultar precios en el albarán` | 164,0 px | ✅ | ✅ |
| `Ocultar precios en el PDF` | 144,2 px | ✅ | ✅ |
| `Entregar sin precios` | 112,8 px | ✅ | ✅ |

**Nota (12 px)** — ancho útil 472/342 px. La nota con marcador mide **585,1 px: no cabe en
ninguno de los dos**.

| candidato | ancho | 929 | 390 |
|---|---|---|---|
| `El albarán conserva sus precios: sólo deja de enseñarlos el papel que entregas.` | 413,5 px | ✅ | ❌ (dos líneas) |
| `Tú sigues viendo los precios y puedes facturarlo.` | 255,8 px | ✅ | ✅ |

> Son **medidas, no propuestas de copy**. ✅ **De esta tabla salieron los dos aprobados**:
> «Ocultar precios en el albarán» (164,0 px) y «Tú sigues viendo los precios y puedes facturarlo.»
> (255,8 px) — la única de las notas que cabe a 390 px.

**El censo, con el número delante.** Los dos literales salieron primero con la grafía que SCRUM-402
cuenta, y el trinquete lo confirmó: **sin declararlos dijo `jobDetailView.js (+2)`** — o sea que el
marcador **sube** el contador y no es de los invisibles. Con la firma del asesor esa misma tarde la
entrada **se borra**, y el fichero vuelve a cero marcadores en literales.

**Son DOS y no una a propósito**: el rótulo y la nota dicen cosas distintas, y colapsarlos haría
que aprobar uno diera por aprobado el otro. La segunda es la que importa: sin ella un profesional
puede creer que la casilla le **borra** los precios del albarán — y no, los conserva y sigue
pudiendo facturar.

## Seis trinquetes saltaron. Ninguno se ensanchó para pasar

| trinquete | qué dijo | decisión |
|---|---|---|
| **SCRUM-667** | marcador nuevo en `src/` | declarado en `CENSO_SERVIDOR` y en `EN_EL_PAPEL`, con motivo |
| **SCRUM-402** | `jobDetailView.js (+2)` | declarado, y **es la prueba de que el marcador sube el contador** |
| **SCRUM-411** | export huérfano | `ROTULO_PRESUPUESTO_ORIGEN` **deja de exportarse**; se prueba por la superficie pública, como aconsejaba el propio guard |
| **SCRUM-533** | CR en disco en dos ficheros que toca la rama | rematerializados en LF (el blob ya estaba limpio: sólo estaba sucio el disco) |
| **SCRUM-463** | el ancla fijaba la llamada de DOS argumentos | **re-anclado**, y exigiendo MÁS: la llamada **y** que le llegue el interruptor |
| **SCRUM-593e** | «lo desestructura pero no lo mete en el cuerpo» | era falso: **su recorte era `i + 900`, una ventana de BYTES**. Re-anclado por IDENTIDAD |

> 🔴 **Dos de ellos no eran fallos míos de producto, eran anclajes que caducaron.** El de 593e es
> del todo la familia de SCRUM-710: al meter un campo más en el mismo receptor, `docHeaderText` se
> salió de los 900 caracteres y el guard se puso rojo **sin que nada de lo que vigila hubiera
> cambiado**. Ahora recorta del receptor a su cierre y crece con él, con un suelo que exige que el
> recorte no venga vacío.
>
> Y el de **SCRUM-667** destapó un límite suyo: contaba los marcadores de **una** factura contra el
> **total** de declarados, o sea que daba por supuesto que todo lo declarado sale en ese único
> papel. La salida fácil era no declarar el mío — dejar sin declarar justo el marcador que ve el
> cliente. **Se amplía la población a los dos documentos**; el criterio no se toca.

## Huecos declarados

Los dos que declaró la primera entrega **están cerrados**, y se deja escrito para que no parezca
que se olvidaron:

* ~~La columna todavía no está aplicada~~ → **aplicada en las tres**, y los cuatro `as any` que
  vivían de ese hueco, retirados.
* ~~El texto de los dos literales no está aprobado~~ → **aprobados por el asesor**, con las cajas
  medidas delante. **Provisionales**: siguen esperando la firma del fundador, y quien lo dice es
  `ALB_OCULTAR_PRECIOS_SIN_APROBAR = 2`, no la ausencia de corchete.

Lo que sigue abierto:

* **`ROTULO_PRESUPUESTO_ORIGEN` sigue con marcador** y se imprime en el pie del papel que recibe
  el cliente. No entraba en la firma del asesor. Declarado en `CENSO_SERVIDOR` y `EN_EL_PAPEL`.
* **La firma del fundador** sobre los dos literales del interruptor.

---

# FASE A · la medición y la columna (tal y como se entregó)

**Medido contra:** `origin/main` = `da5af22e347bbdfa3e57e1e658676e1cbd9bf310` · 2026-09-04T17:03:02+01:00

> 🛑 **ESTO ERA FASE A Y NO LLEVABA CÓDIGO DE PRODUCTO** (el GO para FASE B llegó después). El propio encargo lo pide: «¿Lleva columna
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
