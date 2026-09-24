# SCRUM-665 · El PDF de una factura EMITIDA se regenera con el código y los datos de HOY

**Fecha:** 15-sep-2026 · **Carril:** fiscal · documento emitido · **Gate:** 🔴 **MIDE. NO ARREGLA.**

**Medido contra:** `origin/main` = `9070f3d780938b6b1f53cf6afbeb55f71221229b` · 2026-09-15T14:16:24Z
**Rama:** `scrum-665-el-pdf-que-se-reimprime`
**Preámbulo (A1):** `prisma generate` rc=0 · `npm run build` rc=0 ·
`git rev-list --count HEAD..origin/main` = **0** al ramificar.

> ⛔ **No se ha tocado ni una línea de `src/`.** Regla 38: leer el camino de emisión no es STOP,
> modificarlo sí. Regla 29: lo emitido no se edita. **El arreglo lo decide el fundador con esta
> medición delante**, y las cuatro salidas ya están planteadas en el ticket (A/B/C/D).
> ⛔ Nada contra producción ni staging · cero credenciales · `INVOICING_ES_ENABLED` sin tocar.

---

## LA RESPUESTA, PRIMERO

> # 🔴 SÍ.
>
> **El PDF de una factura emitida puede salir hoy distinto de como salió el día que se emitió.**
> Basta con que el profesional corrija su dirección fiscal, su denominación legal, su NIF, su
> logo, su teléfono o su email. **Y lo puede disparar el cliente final abriendo su documento
> desde WhatsApp, sin login.**

Ejecutado, no razonado — `docs/master/evidencias/scrum665/dos-regeneraciones.mjs`:

```
CONTROL POSITIVO (a) — ¿ENTRO el cambio?
   PDF 1 contiene la direccion DE ENTONCES: SI ✅
   PDF 2 contiene la direccion DE HOY .....: SI ✅
   PDF 2 YA NO contiene la de entonces ....: correcto ✅

═══ EL VEREDICTO ═══
   pasada1 vs pasada2 (el merchant corrigio su direccion):
     por BYTES ....: 🔴 DISTINTOS
     por CONTENIDO : 🔴 DISTINTO
```

### ⚠️ Y una cautela que el propio banco destapó, porque cambia cómo hay que leerlo

El control (b) generó **una tercera vez con los MISMOS datos**: por **bytes salen distintos**
(5209 / 5212 / 5212 — el PDF lleva dentro algo no determinista, típicamente la fecha de creación
del fichero). Por tanto **el veredicto NO se apoya en los bytes**. Se apoya en el **contenido**,
que con datos iguales sale **IDÉNTICO** — y por eso una diferencia ahí es del dato y no del ruido.

Sin ese tercer PDF, «los bytes cambian» habría sido una conclusión plausible y vacía.

---

## 1 · La tabla: dato → ¿congelado o vivo? → fichero y línea

Punto de regeneración: **`ensureInvoicePdf`** (`src/lib/invoicing.ts:32`). Todo lo que sigue es lo
que le pasa a `generateInvoicePdf`.

| dato que entra en el PDF | ¿congelado o vivo? | fichero : línea |
|---|---|---|
| `number` | **congelado** (de la factura) | `src/lib/invoicing.ts:104` |
| `merchant.name` | 🔴 **VIVO** | `src/lib/invoicing.ts:108` |
| `merchant.legalName` | 🔴 **VIVO** | `src/lib/invoicing.ts:109` |
| `merchant.taxId` | 🔴 **VIVO** | `src/lib/invoicing.ts:110` |
| `merchant.address` | 🔴 **VIVO** | `src/lib/invoicing.ts:111` |
| `merchant.logoUrl` | 🔴 **VIVO** | `src/lib/invoicing.ts:112` |
| `merchant.phone` (`whatsappPhone`) | 🔴 **VIVO** | `src/lib/invoicing.ts:113` |
| `merchant.email` | 🔴 **VIVO** | `src/lib/invoicing.ts:114` |
| **cliente** (los 5 campos) | ✅ **congelado** | `src/lib/invoicing.ts:121` → `clienteDelDocumento` |
| `currency` | congelado | `:122` |
| `total` | congelado | `:123` |
| `qrData` | congelado (con fallback si `PENDING`) | `:78-80` |
| `vfHash` | congelado | `:94` |
| `createdAt` | congelado | `:126` |
| `lines` | congelado | `:102` |
| `type` | congelado | `:128` |
| `rectifiesNumber` | congelado (de la rectificada) | `:129` |
| `watermark` | 🔴 **VIVO** — `isDemoMerchant(inv.merchant)` | `:130` |
| `stageLabel` | congelado | `:131` |

**Siete campos del emisor + la marca de agua se leen en vivo. Todo lo demás está congelado.**

### El cliente ya está resuelto, y conviene decirlo

`clienteDelDocumento(inv, inv.customer)` lee **la columna** (`customerName`, `customerLegalName`,
`customerTaxId`, `customerEmail`, `customerPhone`) y sólo cae a la ficha viva si el documento es
**anterior al escritor** — decide mirando `customerName`, que es el único de los cinco que el
escritor no puede dejar vacío (`clienteCongelado.ts:215-227`). **Eso lo cerró SCRUM-729**, y es
exactamente la mitad de este ticket que ya no hace falta arreglar.

### El segundo generador tiene el mismo patrón

`ensureInvoiceForCharge` (`src/lib/invoicing.ts:245-268`): merchant vivo (`:249-255`), cliente
congelado (`:259`). **Diferencia medida:** su condición `needsPdf` **no** incluye
`!fs.existsSync(diskPath)` (`:227-230`), así que ése no regenera por disco perdido.

---

## 2 · ¿Y el CÓDIGO? — no medido, y se dice

El ticket pregunta si un PDF regenerado con la plantilla de hoy sobre una factura de hace tres
meses sigue siendo el mismo documento. **Esta tanda no lo ha medido**, y no se afirma que sí ni
que no.

Lo que sí se puede afirmar por estructura: `generateInvoicePdf` **no recibe ninguna versión de
plantilla** — ni un número de versión, ni una fecha de formato. Su salida depende del código que
haya en `dist/` en ese momento. **Medirlo de verdad exigiría regenerar con dos versiones del
generador**, y eso es otra tanda. Queda declarado, no resuelto.

---

## 3 · Quién puede disparar la regeneración, y con qué filtros

Cuatro llamadores de `ensureInvoicePdf`:

| llamador | fichero : línea | acceso |
|---|---|---|
| **recibo público** | `src/modules/billing/app/routes/receipt.routes.ts:442` | 🔴 **PÚBLICO — `GET /:token/pdf`, token opaco, SIN login** |
| export de facturas | `src/modules/exports/app/routes/exports.routes.ts:200` | sesión de admin |
| email de factura | `src/modules/messaging/domain/email.service.ts:32` | interno |
| PDF desde admin | `src/modules/system/app/routes/invoicesAdmin.routes.ts:1177` | sesión de admin |

🔴 **El primero es el que importa.** Su propio comentario lo dice: *«Público por token OPACO
(SCRUM-74), igual que `GET /recibo/:token` (el cliente lo abre desde WhatsApp, sin login)»*. O sea:
**el instante en que una factura emitida se reimprime con los datos de hoy lo elige el CLIENTE
FINAL**, no el profesional ni nadie de la casa.

Es la misma forma que SCRUM-205 cerró para el sellado —*«el instante en que una factura entraba en
la cadena VeriFactu lo elegía el cliente final abriendo su documento»*— y que aquí sigue abierta
para el **papel**.

---

## 4 · ¿Queda rastro? — 🔴 NO

**`ensureInvoicePdf` no escribe ninguna entrada de AuditLog.** Medido: cero apariciones de
`writeAuditLog` / `auditLog` en `src/lib/invoicing.ts`. Lo único que escribe es
`prisma.invoice.update({ data: { pdfUrl, qrData } })` (`:133`), que deja el *puntero*, no el hecho.

**Consecuencia:** si el PDF de una factura emitida cambia, **no hay forma de saber que cambió, ni
cuándo, ni qué versión se entregó al cliente**. Es la parte que convierte un defecto en
indetectable: no hay a qué comparar, porque el documento anterior no se guardó ni se anotó.

---

## 5 · La propuesta, POR ESCRITO y sin construir

El ticket ya plantea cuatro salidas (A congelar el PDF · B congelar los datos · C las dos · D
asumirlo y reescribir la regla 29). **No se elige aquí.** Lo que esta medición añade para que la
elección sea informada:

1. **La mitad del problema ya está resuelta y no hay que rehacerla.** El cliente sale de la columna
   desde SCRUM-729. **Lo que queda vivo son siete campos del EMISOR y la marca de agua**, y todos
   viven en una sola tabla (`Merchant`). La salida **B** es, para ellos, el mismo patrón ya
   construido dos veces en esta casa (`clienteCongelado.ts` para la factura, `datosDeAlbaranEmitido`
   para el albarán): columnas nuevas + escritor al emitir + lector que prefiere la columna.
2. **La marca de agua merece decisión propia.** `watermark` se deriva de `isDemoMerchant(...)` en
   vivo: si un merchant deja de ser demo, **sus facturas anteriores pierden la marca «DEMO — no
   válida fiscalmente»**. Eso no es un dato de estilo, es una advertencia legal que desaparece sola.
   No lo dice el ticket y sale de esta medición.
3. **El rastro (§4) es independiente de A/B/C/D.** Aunque se elija D («asumirlo»), que una
   reimpresión no deje constancia significa que nadie podrá demostrar qué se entregó. Registrar la
   regeneración es barato y no cambia el documento.
4. **La pregunta 3 del ticket sigue siendo para la asesoría**, no para una sesión: si el registro
   sellado de VeriFactu basta legalmente o el documento entregado también tiene que ser inmutable.
   **Sin esa respuesta, A/B/C/D no se puede elegir bien**, y esta medición no la sustituye.

---

## 6 · 🔴 LO QUE ESTA TANDA NO HA MEDIDO

1. **El eje del CÓDIGO** (§2): si cambiar la plantilla cambia el papel. Declarado, no medido.
2. **Las preguntas 2 y 3 del ticket**: cuántas facturas emitidas hay en las tres bases y cuántas
   tienen `pdfUrl` persistente frente a disco efímero — **exige tocar las bases, y está prohibido
   en esta tanda**; y el dictamen de la asesoría.
3. **Si el `fs.existsSync` se cumple de verdad en producción.** El comentario del código dice que
   «el fs de Railway es efímero» y por eso se cumple casi siempre; **no se ha verificado contra
   producción** y no se afirma.
4. **Los otros tres llamadores** se han leído, no ejecutado. El veredicto se demostró sobre
   `generateInvoicePdf`, que es por donde pasan los cuatro.

## 7 · El banco

`docs/master/evidencias/scrum665/dos-regeneraciones.mjs` (+ `salida-dos-regeneraciones.txt`).
No necesita base de datos, ni red, ni credenciales: `generateInvoicePdf` recibe todo por parámetro.
Lleva **suelo** (si no genera el primer PDF, se declara CIEGO y sale con 3), **control positivo de
que el cambio entró**, y el **control de ruido** del §0 que impide leer el veredicto por los bytes.

---

# APÉNDICE · 16-sep-2026 · EL COSTE DE LOS DOS CAMINOS

**Medido contra:** `origin/main` = `e778e7b232c99b5b46ce44b6c4c90d526b67b175` · 2026-09-16T10:38:29+01:00
**Rama:** `scrum-665-el-coste-de-los-dos-caminos`
**Gate:** 🔴 **MIDE. NO CONSTRUYE NINGUNO.**

> ⛔ Ni una línea de `src/`, ni un ALTER, ni almacenamiento. Regla 38 y regla 29 intactas.
> ⛔ Nada contra producción ni staging · cero credenciales · `INVOICING_ES_ENABLED` sin tocar.
> El QUÉ ya está arriba (15-sep-2026). Esto es el **CÓMO**, con los números que faltaban.

⚠️ **AVISO DE NOMENCLATURA, porque las dos listas están cruzadas.** El ticket de Jira llama **A**
a «congelar el PDF» y **B** a «congelar los datos». El encargo del fundador los nombra **al revés**:
**(A) congelar los campos** y **(B) guardar el PDF**. Aquí se usa **la del encargo**, y se dice
para que nadie lea una tabla con la clave del otro.

---

## (A) · CONGELAR LOS 7 CAMPOS DEL EMISOR — qué ALTER, exactamente

**Siete columnas, todas `String?` (TEXT, NULL), con `@map` en snake_case.** Aditivo puro: ninguna
columna existente cambia de tipo ni de nulabilidad, y ninguna se borra.

| columna nueva en `Invoice` | copia de | tipo en origen |
|---|---|---|
| `merchantName` → `merchant_name` | `Merchant.name` | `String` **(NOT NULL)** |
| `merchantLegalName` → `merchant_legal_name` | `Merchant.legalName` | `String?` |
| `merchantTaxId` → `merchant_tax_id` | `Merchant.taxId` | `String?` |
| `merchantAddress` → `merchant_address` | `Merchant.address` | `String?` |
| `merchantLogoUrl` → `merchant_logo_url` | `Merchant.logoUrl` | `String?` |
| `merchantPhone` → `merchant_phone` | `Merchant.whatsappPhone` | `String?` |
| `merchantEmail` → `merchant_email` | `Merchant.email` | `String?` |

🔴 **`merchantName` tiene que nacer NULLABLE aunque su origen sea NOT NULL**, y no es un descuido:
las filas que ya existen no tienen valor, y **ese NULL es el que distingue «factura anterior al
escritor» de «factura sin nombre»**. Es exactamente el mecanismo que ya usa el cliente congelado
—`clienteCongelado.ts:215-227` decide mirando `customerName`, el único que el escritor no puede
dejar vacío—, así que aquí el centinela sería `merchantName`.

**El precedente existe y está construido dos veces**: `customerName`, `customerLegalName`,
`customerTaxId`, `customerEmail`, `customerPhone` en `Invoice` (SCRUM-729), y
`datosDeAlbaranEmitido` para el albarán. Mismas tres piezas: columnas + escritor al emitir +
lector que prefiere la columna.

**Tres bases**, según la regla 3 del máster: `DATABASE_URL_STAGING`, `_DEV` y `_TESTS`.
**Producción la aplica el fundador**, no una sesión.

### 🔴 Lo que (A) NO cubre, y hay que saberlo antes de elegirlo

1. **La marca de agua no es un campo: es una derivación.** `watermark` sale de
   `isDemoMerchant(m)`, que mira `m.id === DEMO_MERCHANT_ID` **o** `m.email === DEMO_MERCHANT_EMAIL`
   (`emission.service.ts:26-29`). Congelando `merchantEmail` quedaría derivable del dato
   congelado — pero **sólo si el lector se escribe para mirar ahí**, no la ficha viva. O sea: (A)
   arrastra una decisión de diseño extra que las siete columnas no resuelven solas.
2. **El eje del CÓDIGO sigue abierto.** (A) hace que el papel se regenere **con los mismos datos**;
   no hace que se regenere **con la misma plantilla**. `generateInvoicePdf` no recibe ninguna
   versión de formato (ya declarado en el §2 de arriba). Cambiar el generador seguiría cambiando
   papeles emitidos.

---

## (B) · GUARDAR EL PDF AL EMITIR — los tres datos que pediste

### ① Cuánto ocupa · **MEDIDO, y con su control de estabilidad**

Banco: `docs/master/evidencias/scrum665b/coste-de-los-dos-caminos.mjs`.

**Primero el control, porque decide si el número es una cifra o un rango.** Tres pasadas con datos
idénticos:

```
tres pasadas con datos IDÉNTICOS: 5209 · 5209 · 5209 bytes
¿bytes idénticos? ....: 🔴 NO        ← ya medido el 15-sep, confirmado aquí
¿TAMAÑO estable? .....: ✅ SÍ        ← el número se puede dar como cifra
```

Los **bytes** bailan; el **tamaño** no. Así que la cifra es cifra.

| forma de factura | bytes | |
|---|---|---|
| 1 línea (la fixture del 15-sep) | 5209 | 5,1 KiB |
| 5 líneas | 5359 | 5,2 KiB |
| 20 líneas | 6403 | 6,3 KiB |
| rectificativa R1 | 5255 | 5,1 KiB |
| con marca DEMO | 5512 | 5,4 KiB |

⚠️ **Todas SIN LOGO** (`logoUrl: null`). Un logo se **embebe** en el PDF, así que es el factor que
más puede mover este número — y **no está medido**: exigiría una imagen real y su descarga. Se dice
en vez de estimarlo.

### ② Dónde se guardaría · 🔴 **hoy no existe ningún sitio persistente**

- El producto escribe en **`storage/`** (`src/core/storage/dirs.ts`): `invoices/`, `outbox/`,
  `albaranes/`. Es **`path.join(process.cwd(), 'storage', …)`** — **disco local**.
- **`pdfUrl` nunca guarda una URL externa**: guarda `/admin/invoices/:id/pdf`, la ruta autenticada.
  Los sitios que lo escriben ponen un `publicUrlPath` o `'PENDING_PDF'`.
- **Cero dependencias de almacenamiento externo** en `package.json`: barridas las 27 contra
  `s3 · aws · cloudinary · supabase · gcs · google-cloud · azure · minio · blob · r2 · backblaze`
  → **ninguna**.
- Y el propio código dice por qué eso no basta: el comentario de `ensureInvoicePdf` sobre
  **«el fs de Railway es efímero»**, que es la razón de que `!fs.existsSync(diskPath)` se cumpla
  casi siempre.

> **Conclusión: (B) no es «guardar un fichero». Es CREAR el almacenamiento persistente que el
> producto no tiene** — más una dependencia nueva (regla 36) o un servicio de Railway, más
> credenciales, más su coste. Ése es el coste real de (B), y no son los 6 KiB.

### ③ Qué pasa con las facturas YA emitidas · 🔴 **el pasado no es recuperable, por ningún camino**

La condición de regeneración (`src/lib/invoicing.ts:67-74`) incluye `!fs.existsSync(diskPath)`.
Para una factura vieja sin fichero, el primer acceso la regenera **con los datos de hoy** — y bajo
(B) **ese papel regenerado sería el que se congelara**. O sea: (B) no congela la factura tal como
se emitió; la congela **tal como salga la primera vez que alguien la abra después del despliegue**.

Y (A) tampoco lo arregla hacia atrás, por una razón medida: **no existe ninguna acción de auditoría
para los cambios de perfil del merchant**. Repasadas las acciones declaradas en
`audit.service.ts` —`factura_emitida`, `factura_sellada`, `datos_exportados`, `albaran_editado`,
`cambio_flag`…— **ninguna registra una edición del perfil**. Sin histórico, **no hay de dónde sacar
qué decía la dirección fiscal el día de la emisión**.

🔒 **Lo emitido antes de hoy ya no se puede reconstruir.** Lo único que cualquiera de los dos
caminos puede prometer es **desde su fecha de entrada en adelante**. Eso conviene decirlo en voz
alta antes de elegir, porque cambia qué se le puede contar a la asesoría.

---

## ② EL DATO QUE DECIDÍA · la proyección, con los supuestos marcados

Banco: `docs/master/evidencias/scrum665b/proyeccion-de-tamano.mjs`. Se proyecta con **6403 B**, el
**techo de lo medido**, no con la típica: un número de almacenamiento que se queda corto no sirve.

| escenario | merchants | fac/mes | al mes | al año | a 5 años |
|---|---|---|---|---|---|
| **HOY** (anclado, no supuesto) | 13 | 0 | 0 B | 0 B | 0 B |
| SUPUESTO A · arranque | 10 | 100 | 625,3 KiB | 7,3 MiB | 36,6 MiB |
| SUPUESTO B · tracción | 100 | 2.000 | 12,2 MiB | 146,6 MiB | 732,8 MiB |
| SUPUESTO C · escala | 1.000 | 20.000 | 122,1 MiB | 1,43 GiB | 7,16 GiB |

**El HOY está anclado, no supuesto:** `CUENTAS_DE_PRUEBA_DECLARADAS = 13`
(`src/modules/system/domain/puertaClienteReal.ts`) y la regla del máster que dice que **todas las
cuentas de producción son de prueba** — la puerta de SCRUM-390 sigue cerrada. **Cero clientes
reales.**

🔴 **LOS TRES ESCENARIOS SON SUPUESTOS MÍOS Y NO TIENEN NI UN DATO DETRÁS.** No se pueden medir:
las facturas emitidas viven en las bases y mirarlas está prohibido en esta tanda. El más frágil es
«facturas al mes»: me lo he inventado. **Un escenario no es una previsión.**

**La lectura:** hasta el escenario de 1.000 merchants da **1,43 GiB al año**. **El almacenamiento
no es el coste que decide este ticket** — lo que decide es que ese almacenamiento **no existe**.

---

## ③ LA MARCA «DEMO» · confirmado por ejecución, no asumido

```
SUELO · el lector encuentra el número de la factura en el papel: sí
con `watermark` puesto → el papel LLEVA la marca: ✅ sí
con `watermark` a null → el papel NO la lleva ..: ✅ correcto
```

La marca es **contenido del fichero**, no un adorno que se ponga al servirlo. Luego **sí**: con (B),
un PDF guardado el día de la emisión conserva «DEMO — no válida fiscalmente» aunque el merchant
deje de ser demo, y el problema del §5.2 de arriba **desaparece solo**. Confirmado.

Bajo (A) no desaparece solo: habría que decidir que el lector derive `isDemoMerchant` del
**email congelado** y no de la ficha viva.

---

## LO QUE ESTA TANDA NO HA MEDIDO, y por qué

1. **Cuántas facturas emitidas hay** en las tres bases, y cuántas tienen `pdfUrl` vivo — exige
   tocar las bases. Prohibido aquí, y sigue pendiente desde la tanda del 15-sep.
2. **El tamaño con logo**, que es el factor que más puede mover la cifra.
3. **El eje del código** (§2 de arriba): sigue declarado y sin medir.
4. **Si el `fs.existsSync` se cumple de verdad en producción.** El comentario del código lo afirma;
   nadie lo ha verificado contra producción y aquí tampoco.
5. **El dictamen de la asesoría** (pregunta 3 del ticket): si el registro sellado de VeriFactu
   basta o el documento entregado también tiene que ser inmutable. **Va antes que la elección**, y
   ninguna medición la sustituye.

---

# APÉNDICE · 16-sep-2026 · (A) Los siete campos del emisor, congelados — con su caducidad puesta

**Fecha:** 16-sep-2026 · **Carril:** fiscal · documento emitido · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `dc7919946ffd605ab874e541386f2b23bf84cabf` · 2026-09-16T12:04:20+01:00
**Rama:** `scrum-665a-congelar-el-emisor`

> 🟢 **(A) aprobado por el fundador.** El QUÉ estaba medido en SCRUM-665 (15-sep) y el CÓMO en su
> apéndice (16-sep). Esto construye el escritor y el lector.
> ⛔ **`prisma/schema.prisma` NO se ha tocado** y **no se ha aplicado nada a ninguna base**: ni
> `db push`, ni `migrate dev`, ni `migrate diff`, ni «para comprobar». El diff va **propuesto**.
> ⛔ Sin estado ni flag nuevos (27) · sin dependencias (36).

---

## 0 · Obligación 0 — y las dos ramas previas eran mediciones

`git ls-remote` → **ninguna rama `scrum-665*` viva**. En `main` hay dos merges con ese número:
`#1283` (el QUÉ) y `#1339` (el CÓMO). **Los dos mergeados, y los dos midieron sin construir.**

Y se probó **por contenido**, no por el mensaje del commit: ninguna de las siete columnas existe
hoy en `model Invoice` — lo único que tiene de merchant es `merchantId` y su relación. Así que (A)
no estaba hecho.

## 1 · El ALTER · **propuesto, no aplicado**

Siete columnas `String?` (TEXT, NULL) con `@map` snake_case, junto a las cinco del cliente
congelado y con su mismo estilo. El diff literal, el desglose de por qué es aditivo puro y el
cableado pendiente están en
**`docs/master/evidencias/scrum665a/ALTER-propuesto.md`**.

🔴 **`merchant_name` va NULLABLE aunque `Merchant.name` sea `NOT NULL`**, y no es un descuido que
haya que «arreglar»: ese NULL es el **centinela** que distingue «factura anterior al escritor» de
«factura sin nombre». Un `@default` ahí convertiría el centinela en basura y las facturas viejas
dejarían de distinguirse de las nuevas.

Tres bases (`_STAGING`, `_DEV`, `_TESTS`) en **una sola PR**; producción, el fundador.

## 2 · El escritor y el lector

`src/modules/invoicing/domain/emisorCongelado.ts`. **Mismo patrón que `clienteCongelado.ts`**
(SCRUM-729) y que `datosDeAlbaranEmitido`: columnas + escritor al emitir + lector que prefiere la
columna. Se imita a propósito — un cuarto patrón para el mismo hecho es cómo nacen dos criterios
que un día discrepan.

- **`congelarEmisor(ficha)`** produce las siete claves, siempre las siete, **sin respaldos**: si el
  nombre llegara vacío, el documento dice la verdad en vez de inventarse uno.
- **`emisorDelDocumento(doc, viva)`** mira **`merchantName`, no «los siete a la vez»**. Es la
  lección literal de `clienteCongelado.ts:215-227`: preguntar por `merchantTaxId` daría un falso
  «no congelado» en toda factura de un merchant que aún no ha puesto su NIF, que es un caso
  **normal**, no un error (SCRUM-215).
- Sin columna y **sin ficha viva**, lanza. Un papel sin emisor es peor que un error: el error lo ve
  la casa, el papel lo ve el cliente.

## 3 · 🔴 La prueba es el CONTRASTE, no la respuesta

«Con las columnas puestas el PDF no cambia» no demuestra nada solo: un banco roto que devuelve
siempre el mismo papel también lo diría. Lo que decide es que **las dos ramas respondan distinto al
mismo estímulo** —el merchant corrige su dirección después de emitir—:

| | rama | resultado |
|---|---|---|
| ✅ POSITIVO | fila **con** las siete columnas | el papel **NO cambia** |
| 🔴 NEGATIVO | la misma fila **con las columnas a NULL** | el papel **SÍ cambia** |

Y el negativo lleva su propio mensaje escrito: *«si no cambia, el banco no está midiendo el
mecanismo — las dos ramas responden igual y el positivo no prueba nada»*.

**Ninguna factura vieja cambia de aspecto**, y no se afirma: se compara el papel que sale **por el
lector** contra el que sale **sin pasar por él**, que es literalmente lo que hace hoy
`src/lib/invoicing.ts`. Salen idénticos.

⚠️ **Por CONTENIDO, no por bytes** — medido en SCRUM-665: dos pasadas del mismo PDF con datos
idénticos dan ficheros distintos y el tamaño sí es estable.
⚠️ **Y con testigo de ejecución**, la lección de SCRUM-864: cada papel comprueba que su número es
legible antes de comparar. Dos textos vacíos coinciden, así que sin ese testigo el «no cambia» del
positivo sería falso.

## 4 · 🗓️ LA CADUCIDAD · la RED, no la nota

Estas siete columnas existen por **una razón concreta**: hoy el PDF de una factura emitida **se
regenera**, porque no hay almacenamiento persistente. El día que SCRUM-665(B) guarde el papel de
verdad —va con la mudanza a Europa, **SCRUM-863**— el PDF deja de regenerarse y **estas columnas
pierden su lector**: se seguirían escribiendo en cada emisión sin que nadie las lea.

**Sí existe un guard que puede vigilarla, y son dos — uno de ellos ya existía:**

**① El disparador propio, construido aquí** (mecanismo de P-DOC-8: fecha con su motivo **más** un
disparador evaluable). Un caso por AST afirma que **`ensureInvoicePdf` sigue llamando a
`generateInvoicePdf`**. El día que (B) aterrice, eso deja de ser cierto y el caso se pone rojo con
su mensaje dentro:

> *«ESTE ROJO NO ES UN FALLO: ES EL AVISO DE QUE UNA DECISIÓN HA CADUCADO.»* — y enuncia las dos
> salidas: retirar lector y columnas con su ALTER de baja, o conservarlas **con motivo nuevo
> escrito** (la salida C del ticket) y girar el caso.

**② El registro de huérfanos de SCRUM-411, que ya estaba.** El día que `emisorDelDocumento` pierda
su llamador, aparece como export inalcanzable y **alguien tiene que decidir**. No hay que construir
nada: es automático.

**FECHA LÍMITE: 16-mar-2027** — seis meses desde la firma, el mismo plazo que P-DOC-8 y por el
mismo motivo: no es sagrada, es un tope para que la decisión no se convierta en olvido. **Quien la
mueva, que escriba por qué.**

## 5 · 🔴 Un trinquete saltó, y se DECIDIÓ en vez de ensancharlo

`SCRUM-411 · los módulos de dominio inalcanzables NO crecen` se puso rojo: 8 sobre un tope de 7.
Tenía razón — `emisorCongelado.ts` **nace sin llamador**.

Y nace así por una razón que no está en mi mano: su llamador necesita las siete columnas, y el
esquema es del fundador. Sin ellas, `prisma.invoice.create({ data: { merchantName… } })` **ni
compila**.

🔴 **No es un motor sin llamador de los que ese trinquete persigue:** está ejercitado de punta a
punta sobre PDFs reales. Lo que falta es el ALTER, no la prueba. El tope sube a **8** con el motivo
escrito en el fichero **y con cuándo vuelve a 7**: el día que se aplique el diff y se cablee el
escritor, en el mismo commit. Un tope que se queda alto después de que su motivo desaparezca es un
trinquete que ha dejado de proteger sin que nadie lo note.

## 6 · Lo que esto NO arregla, dicho para que no se lea de más

1. **El eje del CÓDIGO.** El papel se regenera con los mismos **datos**, no con la misma
   **plantilla**. `generateInvoicePdf` no recibe ninguna versión de formato: cambiar el generador
   seguirá cambiando papeles emitidos. Declarado en SCRUM-665 §2, sigue sin medir.
2. **El pasado.** Las facturas ya emitidas no tienen estas columnas y **no se pueden rellenar**: no
   existe ninguna acción de `AuditLog` que registre una edición del perfil del merchant. Esto
   promete de su fecha de entrada en adelante, y nada más.
3. **La marca de agua.** `watermark` se deriva de `isDemoMerchant(...)` en vivo. Con el email
   congelado *se puede* derivar del dato congelado, pero **eso es una decisión aparte** y aquí no
   se toma.
4. **El cableado.** Escritor y lector están construidos y probados; **conectarlos al camino de
   emisión espera al ALTER**, con los tres puntos exactos ya escritos en el fichero de la
   propuesta.

## 7 · Ficheros

| fichero | qué |
|---|---|
| `src/modules/invoicing/domain/emisorCongelado.ts` | escritor, lector, lista cerrada de los siete |
| `tests/scrum665a-congelar-el-emisor.test.mjs` | 7 casos: suelo, el contraste, el centinela, la caducidad |
| `docs/master/evidencias/scrum665a/ALTER-propuesto.md` | el diff propuesto + el cableado pendiente |
| `tests/scrum411-exports-inalcanzables.test.mjs` | el tope, subido con su motivo y su vuelta a 7 |

---

# APÉNDICE · EL ALTER LLEGA A DESARROLLO, QUE ERA LA BASE QUE FALTABA

**Fecha:** 17-sep-2026 · **Carril:** B · esquema · **Gate:** aplicar + verificar
**Medido contra:** `origin/main` = `53e3db1f541574c4f231c3d196a2874680160d02` · 2026-09-17T08:51:27Z
**Rama:** `scrum-881-el-detector-sin-fecha`

El fundador ya había aplicado este ALTER en **staging** y en **producción**. Faltaba
**desarrollo**. Se aplica el texto del encargo sin cambiar nada, con
`docs/sql/scrum-665-congelar-el-emisor.sql`.

**Herramienta:** `node scripts/aplicar-sql-dev.mjs --file … --go`, que sólo acepta
`DATABASE_URL_DEV` y sólo formas de su lista blanca. Destino acreditado por el mecanismo, no por
la vista:

```
[destino] DATABASE_URL_DEV → acela.proxy.rlwy.net/yaqu_dev_javier (DESARROLLO) ✅
✅ 1 sentencia(s), todas de forma conocida:  línea 7: ALTER TABLE … ADD COLUMN
```

⛔ **Staging y producción no se han tocado, ni para mirar.**

## LA VERIFICACIÓN — dos controles de tipos distintos, los dos a 7

Se lee el CATÁLOGO, no el mensaje de la herramienta (que además lo dice: *«AHORA VERIFICA LEYENDO
EL CATÁLOGO, no este mensaje»*). Evidencia ejecutable:
`docs/master/evidencias/SCRUM-665/verificar-665.mjs`.

| | ① `information_schema.columns` | ② `pg_attribute` + `pg_class` | columnas totales de `invoices` |
|---|---|---|---|
| **antes** | **0 de 7** | **0 de 7** | 36 |
| **después** | **7 de 7** | **7 de 7** | **43** |

36 + 7 = 43, y los dos controles **coinciden**. Las siete salen `text` por las dos vías.

**SUELO:** antes de creerse ningún cero, el censo comprueba que ve columnas de `invoices` (36). Un
cero con el suelo caído no sería «faltan las siete»: sería «no estoy mirando la tabla».

**Aditivo, comprobado:** `pg_postmaster_start_time()` = `2026-08-23 06:21:29.275761+00` y **5 filas
en `invoices`**, idénticos antes y después. No reescribió nada.

## ⚠️ DOS COSAS QUE CONSTAN, Y NO SE ARREGLAN AQUÍ

**① `current_database()` SÍ distinguió en esta base.** El encargo avisaba de que devuelve
`"railway"` en todas las bases de Railway. Aquí devolvió **`yaqu_dev_javier`**. No sé qué devuelve
en staging ni en producción —no las he tocado—, así que se deja como dato de ésta y nada más. La
acreditación se hizo igualmente con `pg_postmaster_start_time()` y el recuento, como se pidió.

**② 🔴 `prisma/schema.prisma` NO declara estas siete columnas.** Medido: el modelo `Invoice`
(`@@map("invoices")`, línea 905) sólo tiene `merchantId`. O sea que la base —las tres— y el esquema
**divergen**. El esquema es del fundador (regla 40): **se propone el diff, no se aplica**, y este
apéndice no lo toca. El diff propuesto sería añadir al modelo `Invoice`:

```prisma
  merchantName      String? @map("merchant_name")
  merchantLegalName String? @map("merchant_legal_name")
  merchantTaxId     String? @map("merchant_tax_id")
  merchantAddress   String? @map("merchant_address")
  merchantLogoUrl   String? @map("merchant_logo_url")
  merchantPhone     String? @map("merchant_phone")
  merchantEmail     String? @map("merchant_email")
```

⚠️ Eso es una **propuesta**, no una medición de que sea lo que se quiere: los nombres del lado
Prisma son los que usa el resto del modelo, pero la decisión es del fundador.

---

# APÉNDICE (B) · EL PASO ③: EL ESQUEMA DECLARA LAS SIETE QUE LAS TRES BASES YA TIENEN

**Fecha:** 17-sep-2026 · **Carril:** B · esquema · **Gate:** declarar + control del papel
**Medido contra:** `origin/main` = `76c786f60721e0caeb7eac056b5f65863abb6b6b` · 2026-09-17T09:41:22Z
**Rama:** `scrum-665b-el-esquema-declara`
**Preámbulo (A1):** `git rev-list --count HEAD..origin/main` = **0** al ramificar.

> **Obligación 0:** sin rama remota `scrum-665*` viva, sin expediente `SCRUM-665b.md`. Los commits
> que salen con ese número en `main` son los pasos anteriores (`754bff36` el coste, `270f1b28` el
> escritor y el lector de 665a) y el mío de 881. Causa **(a)** para este paso.

---

## ⚠️ LO PRIMERO: QUÉ SE HA TOCADO Y QUÉ NO

- **`prisma/schema.prisma`: SÍ, en esta rama.** Es el paso ③ del orden de la casa —un PR con
  esquema + código + tests— y es lo que el encargo asigna. **El diff exacto va abajo en texto
  plano** para que se revise sin abrir el fichero.
- **Ninguna base de datos: NO.** Cero `db push`, cero `migrate diff`, ni «para comprobar». Lo único
  que se ha ejecutado es `npm run prisma:generate`, que **regenera el cliente desde el esquema y no
  abre ninguna conexión** — y con el binario **local**, nunca `npx`.
- **El camino de emisión fiscal: NO**, y eso deja un STOP que se nombra abajo.

---

## ① EL DIFF EXACTO, EN TEXTO PLANO

En `model Invoice`, justo debajo de las cinco del **cliente** congelado (SCRUM-729), que es el
patrón que se imita:

```diff
   customerEmail     String? @map("customer_email")
   customerPhone     String? @map("customer_phone")
 
+  /// SCRUM-665 (B) · EL EMISOR CONGELADO. La otra mitad del documento, con el mismo patrón que
+  /// las cinco de arriba (el cliente congelado, SCRUM-729): columnas + escritor al emitir + lector
+  /// que prefiere la columna. Un cuarto patrón para el mismo hecho es cómo nacen dos criterios que
+  /// un día discrepan.
+  ///
+  /// El ALTER aditivo ya está aplicado y VERIFICADO en LAS TRES bases (dos controles de tipos
+  /// distintos, 7 de 7 en ambos): producción y staging por el fundador, desarrollo el 17-sep-2026.
+  /// Ver `docs/MIGRATIONS_PENDING.md`. Esto sólo DECLARA lo que ya existe.
+  ///
+  /// 🔴 `merchantName` es NULLABLE aunque su origen en `Merchant` sea NOT NULL, y no es un
+  /// descuido: ese `null` es el CENTINELA con el que `emisorDelDocumento` distingue «factura
+  /// anterior al escritor» de «factura sin nombre». Ponerlo NOT NULL, o darle un `@default`,
+  /// convierte el centinela en basura y las dos cosas dejan de distinguirse.
+  merchantName      String? @map("merchant_name")
+  merchantLegalName String? @map("merchant_legal_name")
+  merchantTaxId     String? @map("merchant_tax_id")
+  merchantAddress   String? @map("merchant_address")
+  merchantLogoUrl   String? @map("merchant_logo_url")
+  merchantPhone     String? @map("merchant_phone")
+  merchantEmail     String? @map("merchant_email")
+
   number String
```

**Verificado por DMMF, no leyendo el fichero que acabo de escribir:** las siete salen `String`,
`isRequired: false` y con su `dbName` en snake_case. **7 de 7.**

Y un efecto que el árbol obligó a cerrar: `docs/sql/deriva-prod.sql` se **genera** del mismo DMMF
(SCRUM-222) y `scrum222` exige que el fichero commiteado coincida con lo que se genera hoy. Al
declarar las siete, ese fichero caducó y el guard se puso rojo. Regenerado con
`node scripts/generar-sql-deriva.mjs`: **462 columnas**, las siete dentro, guard en verde. **No es
una base tocada: es una consulta de SOLO LECTURA que el fundador pega donde quiera.**

---

## 🔴 EL STOP QUE QUEDA — el enchufe, que es el gemelo de SCRUM-729

**El lector de 665a sigue sin llamador.** Medido: `emisorDelDocumento` no se invoca en **ningún**
sitio de `src/`. El PDF sigue leyendo el perfil **vivo**:

```
src/lib/invoicing.ts:108    merchant: { name: inv.merchant.name, legalName: inv.merchant.legalName, … }
src/lib/invoicing.ts:249    merchant: { … }            ← el mismo patrón, segunda boca
```

Y justo al lado, en `:122` y `:260`, el **cliente** ya sale de la columna congelada:
`customer: clienteDelDocumento(inv, inv.customer)`. El enchufe que falta es su gemelo exacto:

```
    merchant: emisorDelDocumento(inv, { name: inv.merchant.name, legalName: …, taxId: …,
                                        address: …, logoUrl: …, phone: inv.merchant.whatsappPhone,
                                        email: inv.merchant.email }),
```

**Eso MODIFICA el camino de emisión fiscal, así que es STOP (regla 38) y no se hace aquí.** Se
nombra con fichero y línea, y se para. Mientras no se enchufe, **las siete columnas están
declaradas y vacías**: el producto sigue reimprimiendo con datos de hoy.

> ⚠️ Y una consecuencia que conviene no leer de más: este PR **no arregla todavía el defecto de
> SCRUM-665**. Cierra el paso ③ y deja el ④ —el enchufe— con su coordenada exacta.

---

## EL CONTROL QUE DECIDE — el papel, con las dos mitades

`tests/scrum665b-el-esquema-declara.test.mjs` — **4 pass · 0 fail · `# skipped 0`**.

El papel se ejercita pasándole a `generateInvoicePdf` **lo que el lector devuelve** —que es
exactamente lo que el enchufe produciría— sin tocar una línea de `src/`.

| | qué exige | resultado |
|---|---|---|
| **el esquema** | las siete declaradas, `String?`, con su `@map`, leído del **DMMF** | 7 de 7 |
| 🔴 **MITAD 1** | fila **con** las siete + cambio de perfil → **el papel NO cambia** (sigue diciendo `Mayor 1`, no entra `Nueva 99`) | ok |
| ✅ **MITAD 2** | la misma fila con `merchantName` a **NULL** → **el papel SÍ cambia** (pasa a `Nueva 99`) | ok |
| **665a intacto** | lector y escritor siguen dando lo mismo, y su suelo sigue lanzando | ok |

**Sin la mitad 2, la mitad 1 pasaría porque el papel no cambia nunca**, no porque las columnas lo
congelen. Ésa es la que convierte el control en control.

**Y por CONTENIDO, no por bytes.** El PDF no es determinista. Se lee el texto con
`extraerTextoPdf` (SCRUM-604), que **se declara CIEGO** si el documento embebe un tipo propio, y se
compara normalizado porque las tildes viajan en la codificación del PDF.

> ⚠️ **Mi suelo saltó en la primera pasada, y menos mal.** Traté el resultado de `extraerTextoPdf`
> como si fuera una cadena, y devuelve `{ok, texto}`. Sin ese suelo, los `includes` habrían dado
> `false` siempre y el test habría dicho «el papel no trae la dirección» cuando lo que pasaba es
> que **no lo estaba leyendo**.

---

## ② ¿HAY MÁS DIVERGENCIAS ENTRE EL ESQUEMA Y LAS BASES?

Evidencia: `docs/master/evidencias/SCRUM-665b/censo-deriva-665b.mjs` · salida en
`salida-deriva-665b.txt`. **Se reusan `tablasEsperadas` y `compararEsquema` del arranque**
(`src/core/db/schemaDrift.ts`): un censo con su propia idea de qué es una columna daría un número
distinto del que decide si producción levanta.

> ⛔ **SÓLO SE COMPARA CONTRA DESARROLLO, y se declara.** No tengo credenciales de staging ni de
> producción, y el encargo prohíbe tocarlas. **Este resultado no dice nada de las otras dos.**

### POBLACIÓN

| | |
|---|---|
| modelos en el esquema | **30** |
| tablas esperadas | 30 |
| **columnas esperadas** | **462** |
| tablas en la base de desarrollo | 27 |
| columnas en la base de desarrollo | 435 |
| huella de la base | arranque `2026-08-23 06:21:29.275761+00` · 5 facturas |

### RESULTADO — en las DOS direcciones

El arranque sólo vigila **una** (esquema ⊆ base), que es la que tumba el servicio. **SCRUM-665 era
la otra**, y ésa no rompe nada al arrancar: por eso nadie se entera.

| dirección | n |
|---|---|
| ⓐ **el esquema declara y la base NO tiene** — 3 tablas + 14 columnas | **17** |
| ⓑ **la base tiene y el esquema NO declara** | **1** |
| ⓒ tablas de la base ajenas al esquema | 0 |

**ⓐ · tablas que faltan en desarrollo:** `quote_assignees`, `invoice_assignees`, `gateway_events`.

**ⓐ · columnas que faltan en desarrollo (14):**

```
invoices.customer_name              (Invoice.customerName)
invoices.customer_legal_name        (Invoice.customerLegalName)
invoices.customer_tax_id            (Invoice.customerTaxId)
invoices.customer_email             (Invoice.customerEmail)
invoices.customer_phone             (Invoice.customerPhone)
albaranes.customer_name             (Albaran.customerName)
albaranes.customer_legal_name       (Albaran.customerLegalName)
albaranes.customer_tax_id           (Albaran.customerTaxId)
albaranes.customer_email            (Albaran.customerEmail)
albaranes.customer_phone            (Albaran.customerPhone)
partes_trabajo.signature_url        (ParteTrabajo.signatureUrl)
partes_trabajo.signature_tecnico_url(ParteTrabajo.signatureTecnicoUrl)
partes_trabajo.firmado_tecnico_at   (ParteTrabajo.firmadoTecnicoAt)
partes_trabajo.firmado_tecnico_nombre (ParteTrabajo.firmadoTecnicoNombre)
```

🔴 **Las diez primeras son el CLIENTE congelado de SCRUM-729** — el gemelo de este ticket. O sea que
**la base de desarrollo va por detrás** en la misma familia de columnas, y con `schemaDrift`
comparando *esperado ⊆ real* al arrancar, ese entorno estaría en deriva.

**ⓑ · la única que la base tiene y el esquema no declara:** `customers.pay_methods_por_defecto`.

> ⛔ **Ninguna se arregla** (regla 9). Una divergencia que alguien arregla de paso es una decisión
> de esquema tomada sin que el fundador se entere. Se cuentan y se traen.
>
> ⚠️ Y el dato que da sentido al ticket: **las siete del emisor ya NO aparecen en ⓑ**. Antes de
> este PR estaban ahí; ése era el defecto.

### ⚠️ UN NÚMERO IMPOSIBLE MÍO, CAZADO ANTES DE PUBLICARLO

La primera pasada dijo **«435 de 435 columnas sin declarar»**, incluida `merchants.name`, al lado de
«faltan 0». Dos resultados que no pueden ser ciertos a la vez. Causa: `columnas` es un array de
**objetos** `{campo, columna}` y yo lo metí en un `Set` preguntando por el nombre, que da `false`
siempre. Y `compararEsquema` devuelve `columnasQueFaltan`/`tablasQueFaltan`, no `faltan` — por eso
el otro lado daba 0. **Las dos mitades del censo estaban rotas, y se veía porque no cuadraban entre
ellas.**

---

## LA TANDA

```
ARBOL QUIETO DESDE: 09:59:27 UTC
ARBOL QUIETO HASTA: 10:09:26 UTC
# tests 7243 · # pass 7133 · # fail 0 · # skipped 110
```

`npm run guards:entrada`: 26 tests, 0 fallos, `# skipped 0`.

> ⚠️ La única edición posterior a la tanda son las cifras de este bloque.

---

## LO QUE LA TANDA DESTAPÓ — cinco rojos, cuatro míos

| guard | qué cazó | ¿mío? |
|---|---|---|
| `scrum262` | mi test usaba `+34600000000`, **móvil español ordinario** | sí |
| `scrum273` | `SCRUM-665b.md` no es nombre válido de expediente | sí |
| `scrum854` | la rama no traía `docs/master/SCRUM-665.md` | sí, misma raíz |
| `scrum525d` | mi cambio de esquema **desplazó una coordenada** de la auditoría legal | sí |
| `scrum804` | «145 ramas y `for-each-ref` lista 144» | **no**: carrera |

**El del teléfono es el que más enseña.** Mi número nunca llega a la base —es un objeto en memoria
para pintar un PDF—, así que era fácil argumentar que no aplicaba. El guard es categórico a
propósito y tiene razón: `+34 6XX` es un rango de móvil español ORDINARIO y puede estar asignado a
alguien que no ha pedido nada; y hay tres crons que envían WhatsApp a teléfonos guardados sin
filtrar por el merchant demo. **Un rango imposible no depende de que mi razonamiento sobre el
alcance sea correcto.** Cambiado a `telefonoDePrueba(1)` (`34000000001`).

**El de `scrum525d` es una consecuencia que no habría anticipado:** declarar siete líneas en
`prisma/schema.prisma` empujó hacia abajo `vf_hash` y `vf_prev_hash`, y
`docs/legal/AUDITORIA_CAMINO_EMISION.md:36` las citaba por NÚMERO DE LÍNEA. Reanclado
`865-866` → `886-887`. Es el canon de la casa hecho carne: **referenciar por posición caduca**.

**El de `scrum804` NO reproduce en solitario** (9/9 en verde) y la tanda final lo confirma: su
censo y `git for-each-ref` contaron la misma población mientras yo traía y creaba ramas, y no
cuadraron. Se dice que fue una carrera en vez de darlo por bueno — y se vigiló en la tanda
siguiente, no se supuso.

> ⚠️ **Y una trampa propia, la tercera de esta tanda con la misma forma:** este mismo bloque entró
> MUTILADO al escribirlo con `node -e` desde bash — los backticks se leyeron como sustitución de
> comandos y se llevaron por delante cada nombre citado. Se vio al releer lo escrito, no al
> escribirlo. Repuesto con una herramienta que no pasa por el shell.

> ⚠️ **La tanda anterior NO cuenta:** edité el árbol después de correrla.

---

## LO NO TOCADO

- **Ninguna base de datos.** Cero `db push`, cero `migrate diff`, ni para comprobar. Nunca `npx`
  para el CLI de Prisma: `npm run prisma:generate` usa el binario local y sólo regenera el cliente.
- **El camino de emisión fiscal: ni una línea.** El enchufe queda nombrado con fichero y línea
  arriba, y **parado**.
- **Las 18 divergencias de ②: ninguna arreglada.** Contadas y traídas.
- `merchantName` sigue **NULLABLE** a propósito: es el centinela, y hay un assert que lo fija.
- Ningún estado ni flag nuevo (27) · ninguna dependencia (36) · cero producción y cero staging ·
  `git stash` no usado · historia no reescrita.

---

# APÉNDICE (C) · ⓪ PARA: EL ESCRITOR TAMPOCO SE EJECUTA, Y EL ENCHUFE NO ES EL GEMELO DE UNA LÍNEA

**Fecha:** 17-sep-2026 · **Carril:** B · emisión · **Gate:** ⓪ medición — **bloque ① PARADO**
**Medido contra:** `origin/main` = `e48c18d57fd495d8929cd983733e18c2ac057e64` · 2026-09-17T10:20:37Z
**Rama:** `scrum-665c-el-enchufe`

> **Preámbulo, en este orden:** `git status` **limpio** y sin `MERGE_HEAD` ni `REBASE_HEAD` antes de
> tocar nada. 24 worktrees listados, ninguno de ellos éste a medio merge.
>
> **Obligación 0:** la única rama `scrum-665*` viva es **la mía de 665b**
> (`b854c15a…`, Javier Pereira, 17-sep 11:13), **sin mergear**. No es de otra persona, así que no
> hay que parar por eso — pero sí cambia de dónde se ramifica:
>
> 🔴 **Esta rama sale de `scrum-665b-el-esquema-declara`, NO de `main`.** `main` todavía **no
> declara** las siete columnas (comprobado: 0 apariciones en su `schema.prisma`). Si la 665b se
> revierte, ésta se va con ella. Se dice en vez de disimularlo.

---

## ⓪ LAS DOS PREGUNTAS, MEDIDAS POR SEPARADO

El encargo avisa de que «el módulo tiene» y «el test pasa por ahí» no son la misma pregunta. Lo son
aún menos éstas dos:

### ¿EXISTE el escritor en `main`? — **SÍ**

```
$ git show origin/main:src/modules/invoicing/domain/emisorCongelado.ts | grep -n 'export function congelarEmisor'
104:export function congelarEmisor(ficha: FichaDeEmisor): EmisorCongelado {
```

### ¿Se EJECUTA en la emisión real? — **🔴 NO. Nadie lo llama.**

```
$ grep -rn "congelarEmisor" src/ --include=*.ts | grep -v domain/emisorCongelado.ts
  (vacío)
$ grep -rn "emisorCongelado" src/ --include=*.ts | grep -v domain/emisorCongelado.ts
  (vacío)
```

**Y tampoco lo escribe nadie por otra vía.** Los siete campos, uno a uno, sobre todo `src/`: las
únicas apariciones son variables locales y parámetros de WhatsApp, soporte e IA
(`merchantPhone: merchant.whatsappPhone` para un mensaje, `merchantEmail` para el panel de soporte…).
**Ni una sola escribe la columna de `invoices`.**

> **La casa ya lo tenía anotado, y eso confirma la medida en vez de contradecirla.**
> `tests/scrum411-exports-inalcanzables.test.mjs:197` subió su tope a **8** el 16-sep-2026 con su
> motivo escrito: *«Entra `emisorCongelado.ts` (SCRUM-665 A) … Nace inalcanzable a propósito»*, y
> deja dicho que quien lo enchufe baje el número en el mismo commit.

### El veredicto de ⓪

**Se para el bloque ①**, y por el motivo exacto que da el encargo: enchufar el LECTOR a unas
columnas que nadie rellena no arregla nada —el lector caería siempre al perfil vivo, el papel
seguiría igual que hoy— **con el agravante de que pareceríamos haberlo arreglado**.

---

## 🔴 Y HAY UNA SEGUNDA RAZÓN PARA PARAR: EL GEMELO NO ENCAJA

El encargo dice «no inventes patrón: cópialo; si en algo no encaja, PARA y dime en qué». **No
encaja, y no en un detalle.** Medido, pieza a pieza:

| pieza | cliente (SCRUM-729) | emisor (SCRUM-665a) |
|---|---|---|
| congelar desde una ficha (puro) | `congelarDesdeFicha` | `congelarEmisor` ✅ |
| **congelar LEYENDO la base** | `congelarCliente(prisma, merchantId, customerId)` | **NO EXISTE** 🔴 |
| variante para rectificativa | `congelarParaRectificativa` | **NO EXISTE** 🔴 |
| lector | `clienteDelDocumento` | `emisorDelDocumento` ✅ |
| **escrito por el embudo** | sí: `...cliente` dentro de `crearFacturaEmitida` | **no** 🔴 |

El cliente no se escribe «en una línea»: se escribe **por un embudo con un tipo que hace imposible
saltárselo** —`DatosDeFacturaEmitida = Omit<Prisma.InvoiceUncheckedCreateInput, keyof ClienteCongelado>`,
así que escribir esos campos a mano en `datos` **no compila**— y ese embudo tiene **SIETE llamadas**
en `src/`, cada una con su `congelarCliente(...)` **antes** de abrir la transacción:

```
src/lib/invoicing.ts:345
src/modules/invoicing/domain/invoicing.service.ts:98
src/modules/jobs/app/routes/jobs.routes.ts:1443
src/modules/quotes/app/routes/quotes.routes.ts:734
src/modules/system/app/routes/invoicesAdmin.routes.ts:1022
src/modules/system/app/routes/quotesAdmin.routes.ts:289
src/modules/system/app/routes/quotesAdmin.routes.ts:552
```

### Lo que el enchufe completo exigiría de verdad

No es «el gemelo de una línea». Son, como mínimo:

1. **Una función que lea la ficha del merchant de la base** — el equivalente de `congelarCliente`,
   que hoy **no existe**. `congelarEmisor` es pura y recibe la ficha ya leída.
2. **Cambiar la firma del embudo** `crearFacturaEmitida(tx, cliente, datos)` para que acepte también
   el emisor, y extender su `Omit` a `keyof ClienteCongelado | keyof EmisorCongelado` — porque si no
   se extiende, el tipo **deja de proteger** a las siete nuevas y alguien podrá escribirlas a mano.
3. **Tocar las SIETE llamadas**, cada una con su lectura fuera de la transacción (el propio 729 dejó
   escrito por qué va fuera: para no meter un viaje dentro del cerrojo de serie).
4. **El lector en `src/lib/invoicing.ts:108` y `:249`**, que es lo único que parecía faltar.

**Todo eso es el camino de emisión fiscal, en siete sitios.** El GO concedido era para *el enchufe*
descrito como el gemelo de una línea; lo que hay delante es otra cosa y de otro tamaño. Por eso se
para y se cuenta, en vez de resolverlo sobre la marcha.

---

## ② NO SE HA HECHO, y por qué

Los controles de ② prueban el enchufe. Sin ⓪ no hay enchufe que probar.

**Lo que sí está ya construido y sigue verde** es el contraste que ② pedía reusar: en la 665b,
`tests/scrum665b-el-esquema-declara.test.mjs` demuestra por CONTENIDO —y con el suelo del
`{ok, texto}`— que con las siete columnas el papel **no cambia** (`Mayor 1`) y con `merchantName` a
NULL **sí cambia** (`Nueva 99`). La tercera pata que el encargo pide —**una factura emitida antes de
todo esto, con las columnas a NULL, se pinta exactamente igual que hoy**— es literalmente ese
segundo caso, y está en verde: sin copia, el lector cae al perfil vivo y el papel sale como salía.

---

## LA TANDA

```
ARBOL QUIETO DESDE: 10:23:53 UTC
ARBOL QUIETO HASTA: 10:37:39 UTC
# tests 7270 · # pass 7160 · # fail 0 · # skipped 110 · cero `not ok`
```

> Se mira `# fail` y no sólo el código de salida: hoy un exit 0 con nueve fallos engañó a otra
> sesión.

---

## LO NO TOCADO

- **`src/`: NI UNA LÍNEA.** No se ha enchufado nada. El defecto de SCRUM-665 sigue vivo y sin
  disimular.
- **`prisma/schema.prisma`: ni una línea** — ya quedó declarado en la 665b, como manda el encargo.
- **Ninguna factura tocada**: no se ha editado, renumerado ni re-sellado nada (regla 29). Cero
  escrituras en ninguna base.
- Ningún estado ni flag nuevo (27) · ninguna dependencia (36) · cero producción y staging ·
  `git stash` no usado · historia no reescrita.

---

# APÉNDICE (D) · LA DIMENSIÓN REAL DEL ENCHUFE — NO SON SIETE SITIOS, SON DIEZ

**Fecha:** 17-sep-2026 · **Carril:** fiscal · documento emitido · **Gate:** 🔴 **MIDE. NO TOCA `src/`.**
**Medido contra:** `origin/main` = `2a9f73dbe913a7332f327db4df7583089ef2e2c2` · 2026-09-17T15:11:44Z
**Y confirmado idéntico contra** `origin/main` = `1df4b9b9d67b2a1ed9d919bd7e746d6aae2dd219` · 2026-09-17T14:56:08Z
**Rama:** `scrum-665d-la-dimension-real`
**Encargo, en una línea:** *dosier de dimensión real de SCRUM-665, para firma del fundador.*

> ⛔ **Ni una línea de `src/`.** Ni una de `prisma/schema.prisma`. Cero bases de datos, cero
> `db push`, cero `migrate diff`, cero credenciales. Regla 38: leer el camino de emisión no es
> STOP; modificarlo sí, y aquí no se modifica. El diff de ② (b) va **PROPUESTO**.
>
> **Esto NO reabre SCRUM-665c.** La parada de S2 fue correcta. Esto pone números debajo de ella
> para que la firma sea sobre cifras y no sobre una descripción.

---

## 0 · 🔴 LO PRIMERO, PORQUE CAMBIA CÓMO SE LEE TODO LO DEMÁS

El encargo pedía no citar de memoria ni del registro, sino reabrir `main` hoy y comprobar cada
coordenada. **Bien pedido: cinco de las que este expediente da por buenas ya no están donde dice.**

El apéndice (C) se midió contra `e48c18d5`, hoy a las **10:20 UTC**. Cinco horas después:

| coordenada según el apéndice (C) | dónde está HOY | qué hay HOY en la línea vieja |
|---|---|---|
| `jobs.routes.ts:1443` | **`:1448`** (+5) | `exigirTiposDeIvaEmitibles(tramo.scaledLines);` |
| `quotes.routes.ts:734` | **`:742`** (+8) | `if (emitidasAhora !== existingInvoices.length) return null;` |
| `quotesAdmin.routes.ts:289` | **`:294`** (+5) | `exigirTiposDeIvaEmitibles(tramo.scaledLines);` |
| `quotesAdmin.routes.ts:552` | **`:563`** (+11) | un comentario de `exigirTiposDeIvaEmitibles` |
| `scrum411-exports-inalcanzables.test.mjs:197` | **`:199`** (+2) | — |
| `lib/invoicing.ts:345` | `:345` | ✅ sigue |
| `invoicing.service.ts:98` | `:98` | ✅ sigue |
| `invoicesAdmin.routes.ts:1022` | `:1022` | ✅ sigue |

**Las cinco las movió UN solo commit**, `89860c71` (SCRUM-887c), mergeado entre medias. Ninguna de
las cinco líneas viejas está vacía ni da error: **todas apuntan hoy a código real y distinto**. Un
lector que abriera `jobs.routes.ts:1443` buscando la boca del embudo encontraría una validación de
IVA y no tendría motivo para sospechar.

> **Es el canon de la casa otra vez:** *referenciar por posición caduca, referenciar por identidad
> no.* Este apéndice también cita líneas, y también caducará. Por eso las dos sondas de abajo van
> **commiteadas y son reejecutables**: el número se recalcula, no se recuerda.

### ⚠️ Y `main` se movió mientras yo medía

Exporté y medí contra `1df4b9b9`. Al ramificar, `origin/main` ya era `2a9f73db` — el `.git` es
compartido y otra sesión trajo tres commits (`#1440`, SCRUM-307). **No lo di por bueno:** «main se
ha movido» y «main se ha movido DONDE YO TOCO» son cosas distintas.

```
$ git diff --stat 1df4b9b9..origin/main -- src/
(vacío)
```

Y además **volví a correr las dos sondas enteras** contra `2a9f73db`: salidas **idénticas byte a
byte** a las de `1df4b9b9`. Los números de abajo valen para los dos SHA.

---

## ① EL CENSO DE LAS SIETE BOCAS

### POBLACIÓN Y SUELO (norma A3 — un instrumento declara su población, no sólo su resultado)

| | |
|---|---|
| **población barrida** | **288 ficheros `.ts`** bajo `src/` del árbol exportado de `origin/main` |
| contraste de la población | `git ls-tree -r --name-only origin/main -- src/ \| grep -c '\.ts$'` → **288** |
| método | **AST** (`typescript`), no `grep`: una boca es una `CallExpression`, no una línea que contiene un nombre. Un `grep` casa también el `import`, el comentario que la nombra y el fichero que la define |
| **suelo (a)** | el censo ve la **definición** de `crearFacturaEmitida` → **SÍ**. Si no la viera, no estaría mirando este árbol |
| **suelo (b)** | el censo ve llamadas al congelador de **CLIENTE** (SCRUM-729), que SABEMOS que existen → **11 fuera de su propio fichero**. Un censo que no ve el patrón ya construido no puede opinar del que falta |

Banco: `docs/master/evidencias/SCRUM-665d/censo-de-las-bocas.mjs` (+ su salida).

### LA TABLA — las siete, con fichero:línea de HOY

`crearFacturaEmitida(tx, cliente, datos)`, `src/modules/invoicing/domain/crearFacturaEmitida.ts:58`.

| # | boca (fichero : línea) | quién la llama | ¿tiene la ficha del merchant a mano? | ¿la lectura cae dentro o fuera de la `$transaction`? | qué firma cambiaría |
|---|---|---|---|---|---|
| **1** | `src/lib/invoicing.ts:345` | `ensureInvoiceForCharge` (camino **C6**, 4 bocas: 2 webhooks de PSP + 2 API internas) | ✅ **SÍ, completa** — `ch.merchant`, del `prisma.charge.findUnique({ include: { customer: true, merchant: true, … } })` de `:171` | ✅ **FUERA** (la `$transaction` abre en `:337`) | ninguna propia: sólo el 3.er argumento |
| **2** | `src/modules/invoicing/domain/invoicing.service.ts:98` | `emitInvoice` — **no es un llamador, es OTRO EMBUDO** | 🔴 **NO** — sólo recibe `input.merchantId` | **no tiene `$transaction` propia**: se la abre cada llamador | 🔴 **`EmitInvoiceInput` gana un campo obligatorio** → arrastra a sus **4** llamadores (§②) |
| **3** | `src/modules/jobs/app/routes/jobs.routes.ts:1448` | `POST /:id/collect-rest` (admin) | 🔴 **NO** — el `quote` se carga en `:1351` con `include: { Invoice: { select: { id: true } } }`, **sin merchant**. La única lectura de merchant del handler está en `:1498`, **después** de emitir, y con `select: { country, taxId }` | la que hay es **posterior a la emisión**: no sirve | ninguna propia, pero **exige una LECTURA NUEVA** |
| **4** | `src/modules/quotes/app/routes/quotes.routes.ts:742` | `POST /:token/decision` — 🔴 **PÚBLICA, la dispara el CLIENTE FINAL desde WhatsApp, sin login** | ✅ **SÍ, completa** — `quote.merchant`, del `findUnique({ include: { merchant: true, customer: true, Invoice: true } })` de `:499` | ✅ **FUERA** (tx en `:714`) | ninguna propia |
| **5** | `src/modules/system/app/routes/invoicesAdmin.routes.ts:1022` | `POST /:id/rectify` (rectificativa R1) | ✅ **SÍ, completa** — del `invoice.findFirst` con merchant de `:964` | ✅ **FUERA** (tx en `:1018`) | ninguna propia, **pero abre una decisión** (abajo) |
| **6** | `src/modules/system/app/routes/quotesAdmin.routes.ts:294` | `POST /:id/invoice` (admin) | ✅ **SÍ, completa** — `quote.merchant` de `:180` | ✅ **FUERA** (tx en `:261`) | ninguna propia |
| **7** | `src/modules/system/app/routes/quotesAdmin.routes.ts:563` | `POST /:id/invoice-manual` (admin) | ✅ **SÍ, completa** — `quote.merchant` de `:483` | ✅ **FUERA** (tx en `:559`) | ninguna propia. ⚠️ su 2.º argumento se llama `clienteCongeladoEntera`, no `clienteCongelado` |

### 🔴 LA BOCA 5 NO ES UNA MÁS: HEREDA O CONGELA, Y ESO ES UNA DECISIÓN

La rectificativa no usa `congelarCliente`: usa **`congelarParaRectificativa`** (`:1016`), que
**hereda el cliente de la factura que rectifica** en vez de congelar la ficha de hoy. El motivo
está escrito en `clienteCongelado.ts:177-190` y es fiscal, no técnico: *«congelar la ficha de HOY
en una R1 declararía un destinatario y la factura rectificada otro, y a la AEAT le llegarían las
dos»*.

**Para el EMISOR la pregunta es idéntica y no está respondida en ninguna parte:** ¿una R1 lleva el
emisor de hoy, o el de la factura que corrige? **No es una línea de código: es una decisión del
fundador**, y sin ella la boca 5 no se puede enchufar aunque las otras nueve estén listas.

---

## ② 🔴 PERO LAS BOCAS DEL EMBUDO NO SON LOS SITIOS A TOCAR: SON **DIEZ**, NO SIETE

Ésta es la corrección de dimensión que el encargo buscaba, y la destapó la **segunda sonda**
(`censo-de-los-productores.mjs`), que hace una pregunta distinta de la primera: la primera censa
**dónde se ESCRIBE la fila**; ésta censa **dónde se PRODUCE el dato congelado**. No son lo mismo.

**La boca 2 no produce su congelado: lo recibe.** `emitInvoice` toma `input.clienteCongelado` como
campo **obligatorio** de `EmitInvoiceInput` y lo reenvía. Quien lo produce son **sus cuatro
llamadores**, y ésos no aparecen en el censo de bocas.

| llamador de `emitInvoice` (fichero : línea) | quién | ¿ficha del merchant a mano? | ¿dónde se lee? | qué haría falta |
|---|---|---|---|---|
| `src/modules/jobs/app/routes/albaranes.routes.ts:1266` | `POST /:id/facturar-parcial` | 🟠 **PARCIAL** — hay `merchant` en `:1216`, pero con `select: { id, email, country, flags, defaultCurrency, taxId }` | ✅ FUERA (tx en `:1265`) | 🔴 **ENSANCHAR el `select` de `:1216`** |
| `src/modules/jobs/app/routes/albaranes.routes.ts:1539` | `POST /:id/convertir-en-factura` | 🟠 **PARCIAL** — `:1409`, el **mismo** `select` de 6 campos | ✅ FUERA (tx en `:1538`) | 🔴 **ENSANCHAR el `select` de `:1409`** |
| `src/modules/jobs/domain/recapitulativa.service.ts:105` | `emitirRecapitulativas` | 🔴 **NO** — sólo recibe `{ merchantId, customerId, currency, taxId, grupos, actor }` | `congelarCliente` va en `:77`, ✅ FUERA (tx en `:79`) | 🔴 **LECTURA NUEVA en `:77`** |
| `src/modules/system/app/routes/invoicesAdmin.routes.ts:151` | `POST /` (factura suelta) | 🟠 **PARCIAL** — `:103`, `select: { id, email, country, flags, defaultCurrency }` | ✅ FUERA (tx en `:150`) | 🔴 **ENSANCHAR el `select` de `:103`** |

### LA ARITMÉTICA, Y SU CONTROL DE CUADRE

```
bocas del embudo 1 (crearFacturaEmitida) ..... 7
de ellas, DENTRO de emitInvoice .............. 1   (reenvía, no produce)
bocas que PRODUCEN su congelado .............. 6
llamadores de emitInvoice (producen) ......... 4
SITIOS QUE TENDRÍAN QUE PRODUCIR EL EMISOR ... 6 + 4 = 10
```

**No me creo el 10 porque me salga: lo cuadro contra un conjunto que ya existe.** Si la cuenta es
correcta, los productores de **cliente** congelado tienen que ser esos mismos 10 más los que
congelan para un documento que **no** es factura:

```
productores de cliente fuera de su propio fichero ... 11
sitios de FACTURA esperados ........................ 10
resto .............................................. 1
```

Y ese 1 tiene nombre y se ha comprobado abriéndolo: `albaranes.routes.ts:905`, que congela para
`datosDeAlbaranEmitido(clienteCongelado)` — **es el ALBARÁN, no una factura**. **Cuadra.**

### 🔴 EL DESGLOSE QUE DECIDE EL TAMAÑO

De los **10** sitios:

| | sitios | qué hay que hacer ahí |
|---|---|---|
| ✅ **la ficha completa ya está en ámbito** | **5** — bocas 1, 4, 5, 6, 7 | `congelarEmisor(ficha)` y pasarlo. **Cero viajes nuevos.** `include: { merchant: true }` trae la fila entera |
| 🟠 **hay lectura, pero con `select` recortado** | **3** — `albaranes:1216`, `albaranes:1409`, `invoicesAdmin:103` | **ensanchar el `select`**: de los siete campos sólo traen `email` (y `taxId` en dos). Faltan `name`, `legalName`, `address`, `logoUrl`, `whatsappPhone` |
| 🔴 **no hay ninguna lectura utilizable** | **2** — `jobs.routes.ts` (collect-rest), `recapitulativa.service.ts` | **viaje NUEVO a la base**, fuera de la transacción |

> **Los tres `select` recortados son el dato que no estaba en ningún sitio, y es el que más
> cambia la conversación.** El apéndice (C) contó siete llamadas y describió el trabajo como
> «tocar las SIETE llamadas». La realidad medida es: **diez sitios, de los cuales cinco son
> triviales, tres exigen modificar una lectura que ya está EN el camino de emisión, y dos exigen
> un viaje nuevo a la base.** Ensanchar el `select` de una lectura que alimenta `getEmissionMode`
> y el gate de modo **no es cosmético**: es tocar el camino de emisión fiscal (regla 38).

### ⚠️ UNA PRECISIÓN QUE EL INSTRUMENTO NO DA SOLO, Y QUE IMPORTA

`invoicesAdmin.routes.ts:161` congela el cliente **DENTRO** de la `$transaction` (`congelarDesdeFicha`,
la tx abre en `:150`). Parece violar la regla de SCRUM-729 — «el congelado va FUERA» — y **no la
viola**: `congelarDesdeFicha` es **pura**, copia un objeto ya leído y **no hace ningún viaje**. El
viaje está en `:103`, fuera.

**La regla no es «la llamada va fuera»: es «la LECTURA va fuera».** Si se copia el patrón mirando
dónde está la llamada en vez de dónde está el viaje, se mete un viaje en la sección crítica —
detrás del `pg_advisory_xact_lock` de `allocateInvoiceNumber`, que se suelta en el COMMIT.

### SUBPRODUCTO, y no es ticket (no tiene víctima hoy)

`src/modules/jobs/app/routes/jobs.routes.ts:60` **importa `emitInvoice` y no lo llama**: una sola
aparición del nombre en todo el fichero. Se dice y no se toca (regla 9: un hallazgo de otro carril
se reporta, no se arregla).

---

## ③ (a) · LA FUNCIÓN QUE NO EXISTE — el equivalente de `congelarCliente` para el emisor

### CONFIRMADO: **NO EXISTE**, y el cero tiene suelo debajo

**Barrido 1** — quién usa las piezas de 665a, sobre los 288 ficheros `.ts`:

```
$ git grep -n "congelarEmisor\|emisorDelDocumento\|EmisorCongelado" origin/main -- 'src/**/*.ts'
src/modules/invoicing/domain/emisorCongelado.ts:62    export interface EmisorCongelado
src/modules/invoicing/domain/emisorCongelado.ts:73    export interface DocumentoConEmisorCongelado
src/modules/invoicing/domain/emisorCongelado.ts:104   export function congelarEmisor(...)
src/modules/invoicing/domain/emisorCongelado.ts:130   export function emisorDelDocumento(...)
src/modules/invoicing/domain/emisorCongelado.ts:131   doc: DocumentoConEmisorCongelado,
```

**Cinco apariciones, las cinco dentro del propio fichero. Cero llamadores.** Sigue siendo cierto
hoy, y ya lo era el 17-sep a las 10:20 (apéndice C).

**Barrido 2** — por si existiera con otro nombre:

```
$ git grep -nE "congelarMerchant|congelarEmisorDesdeBase|leerFichaEmisor|fichaDelEmisor|congelarEmisorDeBase" \
    origin/main -- 'src/**/*.ts'
(rc=1 — CERO coincidencias)
```

**Barrido 3 (AST, el que lleva el suelo)** — `censo-de-los-productores.mjs`, sección ④:

```
④ PRODUCTORES de emisor congelado ... 0
```

### 🔴 ¿ES «NO HAY» O ES «NO MIRÉ DONDE HABÍA»? — **ES «NO HAY»**, y así se demuestra

Un cero solo no vale. Este cero lo produce **el mismo barrido, en la misma pasada, sobre los mismos
288 ficheros** que a la vez encuentra:

- el tipo `EmisorCongelado` → **visto** (luego el analizador SÍ llega a ese fichero);
- **11 productores de cliente congelado** (`congelarCliente`, `congelarParaRectificativa`,
  `congelarDesdeFicha`), que es el patrón gemelo y que SABEMOS que existe;
- **4 llamadas a `emitInvoice`** y **7 a `crearFacturaEmitida`**.

Un instrumento que ve 11 del patrón A y 0 del patrón B, mirando lo mismo, está diciendo que B no
está. Si el suelo cae, el censo **sale con código 3 y se declara CIEGO** en vez de imprimir un
cero.

**La casa ya lo tenía anotado, y confirma la medida en vez de contradecirla:**
`tests/scrum411-exports-inalcanzables.test.mjs:199` subió su tope a **8** con el motivo escrito —
*«Entra `src/modules/invoicing/domain/emisorCongelado.ts` (SCRUM-665 A)»*— y deja dicho que quien
lo enchufe baje el número en el mismo commit. *(Ojo: el apéndice (C) citó esa línea como `:197`.
Hoy es `:199`.)*

### LO QUE HABRÍA QUE ESCRIBIR — **propuesto, no aplicado**

El gemelo exacto de `congelarCliente` (`clienteCongelado.ts:154-175`), que hace
`customer.findFirst({ where: { id, merchantId }, select: {…} })` y lanza si no está:

```ts
// src/modules/invoicing/domain/emisorCongelado.ts — NO ESCRITO, PROPUESTO

/** Lo mínimo que este módulo necesita de Prisma. Mismo motivo que `LectorDeFichas`. */
export interface LectorDeFichasDeEmisor {
  merchant: {
    findUnique(args: {
      where: { id: number };
      select: Record<string, boolean>;
    }): Promise<FichaDeEmisor | null>;
  };
}

/**
 * EL VIAJE. Se llama ANTES de abrir la `$transaction`, nunca dentro: `allocateInvoiceNumber` toma
 * `pg_advisory_xact_lock` como PRIMERA sentencia y el cerrojo es de transacción.
 *
 * 🔴 Aquí NO hay filtro por merchant como en `congelarCliente`, y no es un descuido: el merchant
 *    ES el sujeto de la consulta, no un ámbito dentro del que buscar (regla 2).
 */
export async function congelarEmisorDesdeBase(
  db: LectorDeFichasDeEmisor,
  merchantId: number,
): Promise<EmisorCongelado> {
  const ficha = await db.merchant.findUnique({
    where: { id: merchantId },
    select: {
      name: true, legalName: true, taxId: true,
      address: true, logoUrl: true, whatsappPhone: true, email: true,
    },
  });
  // Fallar ANTES de pedir número: si reventara después, el número ya estaría consumido y la
  // serie tendría un hueco que justificar.
  if (!ficha) throw new Error(`emisor_no_encontrado_al_congelar:${merchantId}`);
  return congelarEmisor(ficha);
}
```

⚠️ **`Merchant.whatsappPhone` → `FichaDeEmisor.phone`**: el `select` devuelve `whatsappPhone` y
`FichaDeEmisor` declara `phone`. Ese renombrado hay que hacerlo en algún sitio, y el `select` de
arriba **no lo hace**. Lo digo en vez de dejar un diff que no compila.

---

## ④ (b) · EL CAMBIO DE FIRMA DE `crearFacturaEmitida` — **DIFF PROPUESTO, SIN APLICAR**

### `src/modules/invoicing/domain/crearFacturaEmitida.ts`

```diff
 import type { Prisma } from '@prisma/client';
 import type { ClienteCongelado } from './clienteCongelado';
+import type { EmisorCongelado } from './emisorCongelado'; // SCRUM-665

 /**
- * Todo lo que hoy se escribe en un `invoice.create`, MENOS los cinco campos del cliente: ésos
- * entran por su parámetro y no por el `data`. Escribirlos a mano aquí no compila.
+ * Todo lo que hoy se escribe en un `invoice.create`, MENOS los cinco campos del cliente y los
+ * SIETE del emisor: ésos entran por su parámetro y no por el `data`. Escribirlos a mano aquí no
+ * compila.
  */
 export type DatosDeFacturaEmitida = Omit<
   Prisma.InvoiceUncheckedCreateInput,
-  keyof ClienteCongelado
+  keyof ClienteCongelado | keyof EmisorCongelado
 >;

 export function crearFacturaEmitida(
   tx: Prisma.TransactionClient,
   cliente: ClienteCongelado,
+  emisor: EmisorCongelado,
   datos: DatosDeFacturaEmitida,
 ) {
-  return tx.invoice.create({ data: { ...datos, ...cliente } });
+  return tx.invoice.create({ data: { ...datos, ...cliente, ...emisor } });
 }
```

**Por qué el `Omit` se extiende y no se deja como está:** si no se extiende, el tipo **deja de
proteger a las siete nuevas** y cualquiera podrá escribir `merchantName` a mano dentro de `datos`.
Ese día habría **dos** sitios que deciden el emisor de un documento, y la regla de lectura de
`emisorDelDocumento` —«`merchantName` a NULL significa *anterior al escritor*»— dejaría de ser
cierta. El centinela no lo rompe una columna mal puesta: lo rompe una segunda puerta.

**Sobre el orden de los parámetros:** tres objetos seguidos parecen intercambiables y no lo son.
`ClienteCongelado` exige `customerName…` y `EmisorCongelado` exige `merchantName…`: **no tienen
ninguna clave en común**, así que invertirlos **no compila**. El tipo protege el orden solo; no
hace falta inventar nada.

### `src/modules/invoicing/domain/invoicing.service.ts` — el que arrastra a los otros cuatro

```diff
   clienteCongelado: ClienteCongelado;
+  /**
+   * SCRUM-665 · OBLIGATORIO: el EMISOR tal y como está en este instante. Mismo patrón que
+   * `clienteCongelado`, `actor` (SCRUM-207) y `origen` (SCRUM-347): obligatorio por tipo, así
+   * que **un llamador nuevo no compila** hasta declarar con qué emisor se emite.
+   * Lo lee el llamador ANTES de abrir la `$transaction`, no esta función.
+   */
+  emisorCongelado: EmisorCongelado;
 }

 export async function emitInvoice(tx: Prisma.TransactionClient, input: EmitInvoiceInput) {
   const number = await allocateInvoiceNumber(tx, input.merchantId, {
     camino: input.origen, actor: input.actor,
   });
-  return crearFacturaEmitida(tx, input.clienteCongelado, {
+  return crearFacturaEmitida(tx, input.clienteCongelado, input.emisorCongelado, {
```

🔴 **Ese campo obligatorio es el que convierte «una línea» en diez sitios**: en cuanto entra, los
cuatro llamadores de `emitInvoice` dejan de compilar hasta producir su emisor — y tres de ellos
necesitan que se les ensanche el `select`.

### ⚠️ EL DIFF NO SE PUEDE APLICAR SOLO, Y HAY QUE SABERLO

Este diff, **sin las diez llamadas actualizadas, no compila**: cambiar la aridad de
`crearFacturaEmitida` rompe las siete bocas en el mismo commit. **No es un paso previo que se
pueda mergear aparte.** El enchufe es un único PR de diez sitios sobre el camino de emisión
fiscal, o no es nada.

---

## ⑤ · POBLACIONES Y SUELOS DE TODO LO DE ARRIBA, EN UN SITIO

| barrido | población | resultado | ¿el cero es «no hay» o «no miré»? |
|---|---|---|---|
| bocas de `crearFacturaEmitida` (AST) | 288 `.ts` de `src/` | **7** | n/a — no hay cero |
| llamadas a `emitInvoice` (AST) | 288 `.ts` | **4** | n/a |
| productores de cliente congelado (AST) | 288 `.ts` | **11** (10 factura + 1 albarán) | n/a |
| **productores de emisor congelado (AST)** | 288 `.ts` | **0** | 🟢 **«NO HAY»** — mismo barrido, misma pasada, ve el tipo y ve 11 del patrón gemelo |
| nombres alternativos del congelador de emisor (texto) | 288 `.ts` | **0** | 🟠 **«no hay CON ESOS CINCO NOMBRES»** — es un barrido de nombres que yo elegí; el que decide es el AST de arriba |
| `emitInvoice` en `jobs.routes.ts` | 1 fichero | **1** aparición (el import) | 🟢 «no se llama» |
| deriva `src/` entre `1df4b9b9` y `2a9f73db` | todo `src/` | **0 ficheros** | 🟢 «no hay» — `git diff --stat` vacío **y** las dos sondas reejecutadas dan salida idéntica |

---

## ⑥ · MIS ERRORES EN ESTA TANDA (A9)

**1. La aritmética me salió 11 y era 10, por un bug mío de rutas.** En
`censo-de-los-productores.mjs` comparé rutas con prefijo `src/` contra rutas que `rel()` produce
**sin** él (la raíz que paso ya *es* `.../src`). Las tres exclusiones no dispararon **nunca**, así
que la boca que vive dentro de `emitInvoice` se contó como productora y los dos congeladores
internos de `clienteCongelado.ts` entraron en la lista de productores externos.

**No lo cacé leyendo el resultado**: 11 era perfectamente creíble. Lo cazó que el desglose no
cuadraba con el total. Por eso el instrumento lleva ahora **un control de cuadre explícito** que
compara los dos conjuntos y grita si no encajan — antes lo comprobaba yo a ojo, que funciona
justo cuando no hace falta.

**2. Intenté escribir el instrumento con un heredoc desde bash y salió mutilado.** Es la MISMA
trampa que este expediente ya tenía anotada en el apéndice (B) — *«los backticks se leyeron como
sustitución de comandos»*—, y aun así la repetí. Esta vez falló en alto (error de sintaxis) en vez
de escribir un fichero silenciosamente roto. Rehecho con una herramienta que no pasa por el shell.

**3. Reconstruí números de línea con un `awk` casero para leer un tramo de fichero y me los
inventó** (metió «8», «36», «46» en medio del código). No contaminó ninguna medición —las
coordenadas del informe salen del AST, no de ese `awk`—, pero durante un minuto leí un fichero
mal numerado. Dejé de usarlo.

**4. El guard `guard-dangerous` me paró un `>` sobre un fichero versionado, y tenía razón.** Era
mi propia salida de tres minutos antes, pero la regla no depende de que mi razonamiento sobre el
alcance sea correcto. Escribí por otra vía en vez de crear `.claude/allow-destructivo`.

---

## ⑦ · LO QUE ESTA TANDA **NO** HA MEDIDO

1. **Nada se ha ejecutado.** Este dosier es **estático**: AST y lectura. No he emitido una factura,
   ni he corrido la suite, ni he tocado una base. Las diez coordenadas están **leídas**, no
   **ejercitadas**.
2. **No he medido el COSTE en viajes** de los dos sitios que necesitan lectura nueva.
   `tests/scrum728d-viajes-de-la-reserva.test.mjs` existe y mide eso para el cliente (+1 fuera del
   cerrojo, 0 dentro); **no lo he corrido para el emisor** y no afirmo el número.
3. **No he medido si ensanchar los tres `select` rompe algo.** Traen `flags` y alimentan
   `getEmissionMode`; añadir campos a un `select` es aditivo *en principio*, y «en principio» no
   es una medición.
4. **La decisión de la R1** (boca 5): si una rectificativa hereda el emisor de la factura que
   corrige o congela el de hoy. **Es del fundador**, y sin ella el enchufe está incompleto.
5. **El eje del CÓDIGO** sigue donde lo dejó el 15-sep: `generateInvoicePdf` no recibe versión de
   plantilla. Declarado, sin medir, cuatro apéndices después.
6. **Cuántas facturas emitidas hay en las tres bases** — sigue pendiente desde el 15-sep, sigue
   exigiendo tocar las bases, sigue prohibido aquí.
7. **Este apéndice también caducará.** Cita 30 y pico de coordenadas, y el §0 demuestra que cinco
   de las del apéndice anterior aguantaron cinco horas. Las dos sondas van commiteadas y son
   reejecutables **por ese motivo**: quien las vuelva a correr obtiene los números de su día, no
   los míos.

---

## ⑧ · EL BANCO

| fichero | qué |
|---|---|
| `docs/master/evidencias/SCRUM-665d/censo-de-las-bocas.mjs` | sonda 1 · AST · las bocas del embudo, con su población y su suelo |
| `docs/master/evidencias/SCRUM-665d/salida-censo-de-las-bocas.txt` | su salida contra `2a9f73db` |
| `docs/master/evidencias/SCRUM-665d/censo-de-los-productores.mjs` | sonda 2 · AST · los productores, el segundo embudo y el control de cuadre |
| `docs/master/evidencias/SCRUM-665d/salida-censo-de-los-productores.txt` | su salida contra `2a9f73db` |

Las dos son **SOLO LECTURA**: no importan nada de `src/`, no abren base, no tocan red. Analizan un
árbol exportado con `git archive`, así que se pueden correr contra **cualquier** SHA:

```bash
git archive origin/main src | tar -x -C /un/sitio/fuera/del/arbol
node docs/master/evidencias/SCRUM-665d/censo-de-las-bocas.mjs /un/sitio/fuera/del/arbol/src 288
node docs/master/evidencias/SCRUM-665d/censo-de-los-productores.mjs /un/sitio/fuera/del/arbol/src 288
```

La población esperada va por argumento **a propósito**: si el árbol crece y nadie lo actualiza, el
suelo cae y el censo se declara CIEGO en vez de medir media casa y dar un número creíble.

---

## ⑨ · LO NO TOCADO

- **`src/`: NI UNA LÍNEA.** El defecto de SCRUM-665 sigue vivo y sin disimular.
- **`prisma/schema.prisma`: ni una línea.** Las siete columnas siguen declaradas y **vacías**.
- **Ninguna base de datos**: cero `db push`, cero `migrate diff`, cero `migrate dev`, ni para
  comprobar. Cero credenciales. Producción y staging, ni mirados.
- **Ninguna factura tocada** (regla 29). Ningún estado ni flag nuevo (27). Ninguna dependencia (36).
- `git stash` no usado · historia no reescrita · rama propia, nunca `main`.
- **Las 18 divergencias esquema/base del apéndice (B): ninguna arreglada.** No son de este encargo.

---

# APÉNDICE · 22-sep-2026 · J1 · RECONFIRMADO HOY, MÁS UN QUINTO SITIO: EL XML DE LA AEAT

**Fecha:** 22-sep-2026 · **Carril:** J1 · **Gate:** 🔴 **MIDE. NO ARREGLA.**
**Medido contra:** `origin/main` = `504cd33edb23d023b50ea8805cf359ab04096834` · 2026-09-22T09:59:36Z
**Rama:** `scrum-665-verifactu-xml-emisor-vivo`
**Encargo:** el orquestador pide reconfirmar si el PDF usa las columnas del cliente congelado (hoy
sincronizadas en las tres bases) o la ficha viva. Antes de contestar, PASO 0: este ticket ya tenía
1445 líneas de expedientes previos (15/16/17-sep) — no se repite lo medido, se apunta a ello.

## 0 · La pregunta del orquestador, contestada primero

**Sí, el PDF (y el XML de la AEAT) usan la columna, no la ficha viva — para el CLIENTE.**
`clienteDelDocumento(inv, inv.customer)` es el único lector, y lo llaman los tres generadores de PDF
(`invoicing.ts:122,260`; `invoicesAdmin.routes.ts:1161`) y el exportador de la AEAT
(`verifactu.service.ts:856`). Cierra SCRUM-729; nada que construir ahí.

**Para el EMISOR (el profesional) la respuesta sigue siendo NO**, y eso es justamente el resto de
este ticket: el escritor y el lector (`emisorCongelado.ts`) están construidos y probados desde el
16-sep, el ALTER está aplicado y VERIFICADO en las **tres** bases desde el 17-sep, y el esquema lo
declara desde esa misma fecha — pero **nada los llama todavía** (censo AST del apéndice anterior:
`emisorDelDocumento`, 0 apariciones en `src/`). El PDF y el XML siguen leyendo `merchant.*` en vivo.
Reconfirmado hoy con el instrumento QUE YA EXISTÍA (`docs/master/evidencias/scrum665/dos-regeneraciones.mjs`,
sin escribir uno nuevo), contra el commit de arriba: mismo veredicto que el 15-sep —

```
pasada1 vs pasada2 (el merchant corrigio su direccion):
  por BYTES ....: 🔴 DISTINTOS
  por CONTENIDO : 🔴 DISTINTO
```

## 1 · Lo nuevo: un QUINTO sitio que ningún apéndice anterior había mirado

`clienteCongelado.ts:6-9` dice que son "los cuatro sitios que reconstruyen una factura emitida —dos
PDF, la regeneración de admin y el XML de la AEAT". Los cuatro apéndices previos midieron ESE marco
(y con razón: el título del ticket dice "el PDF"). Pero el propio XML de la AEAT tiene DOS caras, y
solo se midió una:

- **La cara del DESTINATARIO** (`clienteDelDocumento`, línea 856): ✅ ya congelada, medida en el §0.
- **La cara del EMISOR de ese mismo XML**: 🔴 **nunca medida en este expediente.**
  `buildVerifactuRegistrosXml` (`verifactu.service.ts:582`) hace
  `await prismaClient.merchant.findUnique({ where: { id: params.merchantId } })` — EN VIVO, en el
  momento de EXPORTAR — y usa `merchant.taxId` (`:771,788,883,912`) y
  `merchant.legalName || merchant.name` (`nombreEmisor`, `:666,987`) para construir `IDEmisorFactura`
  y `obligado.nombreRazon`. Llamado desde DOS rutas de exportación
  (`exports.routes.ts:252` y `:556`), no desde `emitInvoice`: el censo de "productores" del apéndice
  anterior no lo veía porque no es un productor, es un LECTOR que no pasa por `emisorDelDocumento`.

### Un matiz que decide cómo de grave es cada campo, verificado leyendo `computeVeriFactuHash`

`IDEmisorFactura=${nif}` es uno de los **ocho** campos que entran en la huella
(`verifactu.service.ts:92-111`). Consecuencia medida por identidad, no supuesta:

| campo del emisor en el XML | ¿entra en la huella sellada? | qué pasa si `Merchant.taxId`/`legalName` cambia tras emitir |
|---|---|---|
| `merchant.taxId` (`IDEmisorFactura`) | **SÍ** (uno de los 8) | el XML re-exportado llevaría un NIF que **no cuadra** con la huella que el mismo XML imprime — auto-defendido: un verificador que recompute la huella lo detecta |
| `merchant.legalName`/`name` (`nombreEmisor`) | **NO** | puede derivar en silencio, sin que ninguna huella lo delate — el mismo defecto no detectable que ya tiene el PDF |

O sea: el caso peor (el NIF) tiene una red de seguridad que el PDF no tiene para NADA; el caso del
nombre del emisor no tiene ninguna, ni en el PDF ni en el XML.

## 2 · Consecuencia para "el enchufe" (§⑤ del apéndice anterior, SCRUM-665d)

El plan de conexión ya escrito (líneas 1312-1342 de este mismo fichero) cablea `emisorCongelado`
dentro de `emitInvoice`/`crearFacturaEmitida` y sus lectores de PDF — **no nombra
`buildVerifactuRegistrosXml`**. Si el enchufe se construye tal como está escrito hoy, el PDF
dejaría de reimprimir con datos de hoy pero **el XML de la AEAT seguiría haciéndolo**: dos
documentos de la misma factura, uno congelado y otro no. Se deja **nombrado y sin construir**
(regla 38): el sexto punto de conexión sería `verifactu.service.ts:582,666,771,788,883,912,987`,
sustituyendo el `findUnique` en vivo por `emisorDelDocumento(inv, merchant)` con el mismo criterio
de NULL = "anterior al escritor".

## 3 · Lo que sigue sin poder medirse (igual que el 15-sep)

Cuántas facturas emitidas hay en las tres bases y cuántas dependen del disco efímero: sigue exigiendo
tocar las bases, y esta sesión no tiene `DATABASE_URL_DEV` en su árbol (bloqueo reportado y resuelto
por otra vía: el orquestador aplicó el sincronizado de columnas de HOY desde el suyo). Cero
almacenamiento persistente reconfirmado por el mismo barrido de dependencias
(`s3|aws|cloudinary|supabase|gcs|azure|minio|blob|r2|backblaze` → 0 en `src/modules/invoicing` y
`src/core/storage`).

## 4 · Nada aplicado

Ni una línea de `src/`, ni de `prisma/schema.prisma`, ni de ninguna base. El enchufe (PDF + el sexto
punto del XML) sigue esperando el GO del fundador sobre un único PR de ~10-11 sitios en el camino de
emisión fiscal, más su decisión pendiente de la R1 (§④ del apéndice anterior).

# APÉNDICE (F) · 22-sep-2026 · J1 · EL ENCHUFE, APLICADO — LOS DIEZ SITIOS + EL SEXTO PUNTO

**Fecha:** 22-sep-2026 · **Carril:** J1 · **Gate:** ✅ **APLICADO, con GO.**
**Medido contra:** `origin/main` = `081f619bad377709a06a02fcb80f627a7518983c` · 2026-09-22T11:06:18Z
**Rama:** `scrum-665-enchufe-emisor-congelado` (arrancada por la sesión anterior en `9cb232b6`,
2/10 sitios, NO COMPILABA a propósito)
**GO:** comentario 16468 de Jira SCRUM-665, 22-sep-2026 12:22:47 CEST, Javier — «adelante con el
emisor congelado» — leído directamente por esta sesión antes de tocar código, no heredado de un
traspaso.

## ⓪ Lo que ya estaba (2/10) y lo que trajo esta tanda

Heredado, sin tocar: `emisorCongelado.ts` (escritor `congelarEmisor`/`congelarEmisorDesdeBase`,
lector `emisorDelDocumento`) · `crearFacturaEmitida.ts` a 4 argumentos (`tx, cliente, emisor,
datos`) · `invoicing.service.ts` (`EmitInvoiceInput.emisorCongelado` obligatorio) · el escritor y
las dos lecturas de PDF en `lib/invoicing.ts` (boca 1).

Nuevo en esta tanda:

1. **`congelarEmisorDesdeFicha(m)`**, en `emisorCongelado.ts` — el gemelo de `congelarEmisor` para
   quien YA tiene la ficha en ámbito (hace el renombrado `whatsappPhone → phone` en un solo sitio;
   `congelarEmisorDesdeBase` se reescribió para reusarlo, sin cambiar su contrato).
2. **Los 8 sitios que faltaban del embudo**, con las tres formas que midió el dosier (D):
   - **5 triviales** (ficha ya en ámbito, cero viajes nuevos): `jobs.routes.ts` collect-rest
     (boca 3 — el `include: { merchant: true }` de SCRUM-1027 la dejó trivial: ya NO es "sin
     lectura utilizable" como medía el dosier D, `main` se movió), `quotes.routes.ts` decision
     (boca 4, pública), `invoicesAdmin.routes.ts` `/:id/rectify` (boca 5, R1 — ver §① abajo),
     `quotesAdmin.routes.ts` `/:id/invoice` y `/:id/invoice-manual` (bocas 6 y 7).
   - **3 con `select` ensanchado** (la lectura ya estaba, fuera de la tx; se añadieron
     `name/legalName/address/logoUrl/whatsappPhone`, y en dos de ellas también `taxId`):
     `albaranes.routes.ts` `/:id/facturar-parcial` y `/:id/convertir-en-factura`,
     `invoicesAdmin.routes.ts` `POST /` (factura suelta).
   - **1 viaje nuevo, fuera de la tx**: `recapitulativa.service.ts` — `emitirRecapitulativas` sólo
     recibe `merchantId`, no la ficha; usa `congelarEmisorDesdeBase(prisma, merchantId)` igual que
     hace ya para el cliente.
3. **Los 2 errores de tipo declarados pendientes por la sesión anterior** (`lib/invoicing.ts:112,255`,
   `EmisorDelDocumento.name` es `string | null` y `generateInvoicePdf` exige `string`): se decidió
   **fallar, no fabricar un nombre**. `Merchant.name` es `NOT NULL` en el esquema, así que un
   `emisor.name == null` en este punto es una fila rota, no un caso normal; se lanza
   `emisor_sin_nombre_al_generar_pdf` en vez de imprimir un documento fiscal con el emisor en
   blanco — mismo criterio que ya usa `emisorDelDocumento` cuando no hay ni columna ni ficha.
4. **El sexto punto de conexión** (hallazgo de la sesión anterior, sin empezar): `verifactu.service.ts`
   `construirRegistro` ahora usa `emisorDelDocumento(inv, emisorFichaViva)` por factura — mismo
   criterio que ya usaba `clienteDelDocumento` para el destinatario (SCRUM-729) — para
   `IDEmisorFactura`, `NombreRazonEmisor`, `IDEmisorFacturaAnulada` y el `RegistroAnterior` de las
   dos cadenas (alta y anulación). El `ObligadoEmision` del SOBRE (`<sum:Cabecera>`) se deja **a
   propósito** en el merchant EN VIVO: identifica quién presenta el LOTE hoy, no quién emitió cada
   factura — es un concepto distinto y las dos rutas del XML (`GET /verifactu.xml` y el ZIP de
   `GET /datos.zip`) comparten el mismo `buildVerifactuRegistrosXml`, así que se arreglan las dos
   a la vez sin tocarlas.
5. **Trinquetes actualizados en el mismo commit** (regla 41 — se arregla el código/instrumento
   nunca el guard, y aquí lo que cambió es el HECHO que el instrumento vigila):
   - `tests/scrum411-exports-inalcanzables.test.mjs`: `MODULOS_DOMINIO_INALCANZABLES_MAX` **8 → 7**
     — `emisorCongelado.ts` ya tiene llamador en `src/`, tal y como pedía su propio comentario y el
     test de `scrum665a-congelar-el-emisor.test.mjs` que lo vigila.
   - `tests/_huerfanos-declarados.mjs`: se declara `CAMPOS_CONGELADOS_EMISOR` (gemelo de
     `CAMPOS_CONGELADOS`, misma categoría `VOCABULARIO_DEL_MODULO`) — al volverse alcanzable el
     módulo, el censo de huérfanos empezó a verlo por primera vez.
   - `tests/_embudo-factura.mjs` (SCRUM-203): el literal de datos de `crearFacturaEmitida` estaba
     anclado al argumento `[2]` (cuando la firma era `(tx, cliente, datos)`); con el emisor de por
     medio pasa a ser `(tx, cliente, emisor, datos)` y el dato está en `[3]`.
   - `docs/legal/AUDITORIA_CAMINO_EMISION.md`: tres anclas de línea corregidas tras el desplazamiento
     por mis inserciones (`buildVeriFactuQrUrl` 141→142, `buildVerifactuRegistrosXml` 574→575,
     `exigirDocumentoEmitible` 101/237→102/246) — vigilado por
     `tests/scrum525d-anclas-que-apuntan.test.mjs`.

## ① Lo que NO se decidió — la R1 (boca 5)

Instrucción explícita del GO: congelar el emisor **al emitir** (ficha de HOY), dejar el camino de
la rectificativa **como está**, y no resolver por omisión si hereda el emisor de la factura
ORIGINAL. Implementado así en `invoicesAdmin.routes.ts` `/:id/rectify`, con el comentario en código
marcándolo PENDIENTE y remitiendo al comentario 16468. **Sin construir de nuevo aquí**: sigue
esperando la respuesta del asesor.

## ② Controles — rigor completo (regla 29, camino fiscal)

Nuevo banco: `tests/scrum665e-el-escritor-del-emisor.test.mjs`, mismo patrón que
`scrum729-el-escritor-del-cliente.test.mjs` pero para el emisor y sobre `buildVerifactuRegistrosXml`
directamente (el escritor/lector del PDF ya los cubre `scrum665a`/`scrum665b` desde el 16-sep):

- **ROJO reproducido y arreglado** (④-bis): la MISMA factura, sin columnas de emisor congeladas,
  con la ficha viva cambiada entre dos exportaciones → el `RegistroFactura` de la AEAT SÍ cambia.
  Es el mecanismo viejo, ejercitado de verdad, no supuesto.
- **④ el que decide**: la misma factura CON columnas congeladas → el `RegistroFactura` (NIF y
  nombre del emisor) NO cambia al corregir el perfil — comparado por SUBCADENA del documento, no
  por igualdad completa, porque el `ObligadoEmision` del sobre sí sigue al merchant vivo a
  propósito (③ punto 4 arriba); hay un test aparte que fija ESE comportamiento.
- **✅ control positivo**: una factura SIN columnas congeladas (todas las anteriores a hoy) sigue
  saliendo, con la ficha viva como respaldo — ni se rompe ni queda en blanco.
- Cubre las DOS rutas del XML a la vez por compartir constructor (③ punto 4).

Suelo: `npx tsc --noEmit` limpio (11 errores → 0) · `npm run build` limpio · los cinco ficheros de
test tocados (`scrum665e` nuevo, `scrum665a`, `scrum665b`, `scrum411`, `scrum413`, `scrum275`,
`scrum525d`, `scrum203`, `scrum729`) en verde, 56+ casos.

Tanda completa (`node --test … "tests/*.test.mjs"`, TAP a fichero, leído en un segundo comando):
de 13 `not ok` iniciales, **11 causados por esta rama** (arreglados arriba: SCRUM-203, SCRUM-275,
SCRUM-411×2, SCRUM-413×4 — fixture de test con `merchant.name` ausente, `Merchant.name` es
NOT NULL en el esquema real —, SCRUM-525d×2) y **2 preexistentes y ajenos a este carril**
(SCRUM-476: censo de topología de `node_modules` de TODOS los worktrees de la máquina; SCRUM-939b:
ruta de `gh.exe` de esta máquina en el trinquete de skills) — reportados, no arreglados: no son de
facturación ni VeriFactu.

## ③ Lo que NO se ha hecho (fuera del alcance del GO)

`prisma/schema.prisma`: sin tocar. Publicar el PR: sin hacer — sigue en BORRADOR con el auto-merge
DESARMADO, comprobado tras cada push (el bot lo rearma en cada uno). El sí de empujar el camino del
cobro lo pide el orquestador a un jefe.

# APÉNDICE (G) · 22-sep-2026 · J1 · EL EJE DEL CÓDIGO — NO SOLO EL DATO, TAMBIÉN LA PLANTILLA

**Fecha:** 22-sep-2026 23:00:33Z (hora de GitHub, `gh api -i zen`) · **Carril:** J1 · **Gate:**
🔴 **MIDE Y PROPONE. NO CONSTRUYE.**
**Medido contra:** `origin/main` = `6bca74e55d4ad193debd03cd95223f8390080ad4` · 2026-09-22T23:00:33Z
**Rama:** `scrum-665-eje-del-codigo-medicion`
**Encargo:** el ticket se reabrió — el Apéndice (F) resolvió **sólo la opción B** (los DATOS
congelados: emisor, cliente, XML). Su propio enunciado dice de esa opción: «no arregla el cambio
por código». Este apéndice mide el otro eje: ¿`ensureInvoicePdf` reimprime una factura EMITIDA con
la PLANTILLA de hoy, no sólo con datos de hoy? Sin construir ninguna de las cuatro salidas (A/B/C/D):
la elección depende de una pregunta al asesor que J4 está registrando (si el hash sella el REGISTRO
o también tiene que sellar el DOCUMENTO).

## 1 · El mecanismo, confirmado CORRIENDO — no leído

`ensureInvoicePdf` (`src/lib/invoicing.ts:70-77`) regenera cuando `!fs.existsSync(diskPath)`, y el
comentario de la propia función dice por qué eso ocurre casi siempre: «el fs de Railway es efímero»
(`src/lib/invoicing.ts:30`). Medido con la MISMA factura EMITIDA (datos 100% frozen, ni una tecla
tocada entre pasadas — ni merchant, ni cliente, ni número, ni huella) generada dos veces, cambiando
en medio **sólo el literal de la plantilla** (`docTitle` en
`src/modules/invoicing/infra/pdf/pdf.service.ts:389`, de `'FACTURA'` a `'FACTURA-TEST-665'`),
recompilando con `npm run build` entre pasadas — nada de `src/` tocado en el diff final (revertido
justo después de medir, `git status` limpio):

```
pasada1 (plantilla de entonces): bytes=5209  contiene "FACTURA-TEST-665"=false
pasada2 (misma factura, plantilla cambiada): bytes=5226  contiene "FACTURA-TEST-665"=true
```

**Confirmado, no razonado:** con datos idénticos, el PDF de una factura ya emitida cambia de
contenido cuando cambia el CÓDIGO de la plantilla. La regla 29 («lo emitido no se edita jamás») está
rota por esta puerta aunque los datos del emisor y del cliente estén perfectamente congelados —
son dos ejes independientes y el Apéndice (F) sólo cerró uno.

## 2 · `generateInvoicePdf` no recibe versión de plantilla — confirmado

Su firma completa (`src/modules/invoicing/infra/pdf/pdf.service.ts:269-301`) y el `import` que la
trae a `ensureInvoicePdf` (`src/lib/invoicing.ts:9`, reexportado sin cambios por el wrapper
`src/lib/pdf.ts`) no llevan ningún parámetro de versión, sello de plantilla o fecha de generación
que ate el PDF al código con el que nació. Grep de `TEMPLATE_VERSION|templateVersion|pdfVersion|
PDF_VERSION|plantillaVersion` sobre `src/` entero: **cero resultados**. No es un descuido de
lectura — el concepto no existe en el árbol.

## 3 · La medición 2, pendiente — no tengo la clave en este árbol, medido con la herramienta propia

`node scripts/comprobar-claves-bd.mjs` en `cobroflash-jv1`:

```
🔴 DATABASE_URL_STAGING: AUSENTE del entorno de este árbol.
🔴 DATABASE_URL_DEV: AUSENTE del entorno de este árbol.
🔴 DATABASE_URL_TESTS: AUSENTE del entorno de este árbol.
❌ 4 problema(s) de claves en «cobroflash-jv1». No se sigue.
```

Ni `.env`, ni `.env.local`, ni variable de entorno del sistema en esta sesión (`ls -la .env*`,
`printenv`, y `Object.keys(process.env)` desde node: los tres, vacíos). No se rodeó buscando la
clave por otra vía (`~/.bashrc` u otro fichero fuera de lo designado): es el mismo límite que ya
paró a la sesión anterior una vez, y sigue siendo el correcto. Declarado como suelo, no como
«no lo hice».

**El script queda escrito y listo para quien tenga la clave**:
`docs/master/evidencias/scrum665-eje-codigo/desglose-pdfurl.mjs` — cuenta, sobre `invoices` con
`vf_estado = 'sellado'` (facturas EMITIDAS de verdad), cuántas tienen `pdf_url` en
`PENDING%` (nunca generado), cuántas en el formato válido D4 (`/admin/invoices/<id>/pdf`) y cuántas
en formato legado. Uso: `node desglose-pdfurl.mjs DATABASE_URL_DEV` (o `_STAGING`, o
`DATABASE_URL` para producción — la URL nunca se imprime, sólo el nombre de la variable).

🔴 **Aviso de lectura, escrito en el propio script**: el desglose por `pdf_url` NO mide «persiste».
Sin almacenamiento externo (confirmado de nuevo en el punto 4), NINGUNA fila sobrevive garantizada
a un redeploy de Railway — el formato válido sólo dice que la última vez que se escribió esa fila
el fichero SÍ estaba en el disco efímero, no que siga estando hoy. Confirmar el fichero real exige
mirar el disco del contenedor de cada entorno, fuera del alcance de un script que corre en local.
Los totales por entorno ya los midió el orquestador hoy (producción 2, staging 9, dev 5); falta el
desglose por `pdf_url` de esos mismos totales, con esa salvedad puesta por delante.

## 4 · Cero almacenamiento externo — reconfirmado

`package.json` (`dependencies` + `devDependencies`), grep por claves que contengan
`aws|s3|cloudinary|storage|azure|gcp|cloud|r2|minio|backblaze`: **cero coincidencias**.
`src/core/storage/dirs.ts` — los tres directorios de documentos (`invoicesDir`, `outboxDir`,
`albaranesDir`) son `path.join(process.cwd(), 'storage', ...)`: disco local, sin SDK de nube en el
medio. Sin cambios desde la última vez que se midió hoy.

## Lo que esto deja para decidir (sin decidirlo)

El defecto vivo tiene DOS ejes, no uno: el dato (cerrado por el Apéndice F) y el código de la
plantilla (medido aquí, abierto). Las cuatro salidas A/B/C/D del ticket siguen sin construirse —
dependen de la respuesta del asesor que J4 está registrando. Si la respuesta es «el hash sólo sella
el REGISTRO, el documento puede regenerarse», este eje deja de ser un defecto fiscal y pasa a ser
una decisión de producto (¿molesta al profesional que su PDF cambie de aspecto?). Si es «el
documento entregado también tiene que ser inmutable», este apéndice es la prueba de que hoy no lo
es, en el mismo sentido en que el Apéndice (F) probó que los datos sí lo son ya.

---

# APÉNDICE (H) · 23-sep-2026 · J1 · El desglose por `pdfUrl` en DEV — y un bug en el script que lo mide

**Medido contra:** `origin/main` = `62176956c35ea69eca18ba38567656965907bcf0` · 2026-09-23T08:09:09Z

> Encargo: cerrar la medición 2 pendiente — correr
> `docs/master/evidencias/scrum665-eje-codigo/desglose-pdfurl.mjs DATABASE_URL_DEV`. Los totales
> por entorno (producción 2, staging 9, dev 5) ya los midió el orquestador; faltaba el desglose por
> `pdfUrl` de esos mismos totales. Staging y producción no son de este puesto — no se han tocado.

## El script, tal cual está en `main`, falla contra DEV — y no es un problema del entorno

```
node docs/master/evidencias/scrum665-eje-codigo/desglose-pdfurl.mjs DATABASE_URL_DEV
```

La primera consulta (huella + total de filas) corre bien: **5 filas en `invoices`**, coincide con
el total que ya tenía el orquestador para DEV. La segunda consulta —el desglose por `pdf_url`—
**lanza**:

```
PrismaClientKnownRequestError: Raw query failed. Code: `42703`.
Message: `column "pdf_url" does not exist`
```

**No es un problema de la base ni del entorno: es un desajuste entre el SQL del script y el
esquema.** `prisma/schema.prisma`, `model Invoice` (`@@map("invoices")`):

```
vfEstado  String  @default("pendiente_de_sellado")  @map("vf_estado")   ← SÍ tiene @map: columna real "vf_estado"
pdfUrl    String                                                          ← NO tiene @map: columna real "pdfUrl" (camelCase, con comillas)
```

El script usa `vf_estado` (correcto, coincide con el `@map`) y `pdf_url` (incorrecto: ese campo NO
lleva `@map`, así que Prisma lo creó con el nombre `"pdfUrl"` case-sensitive, no `pdf_url`). El
`WHERE` de la primera columna filtra bien; la comparación de la segunda no encuentra la columna y
Postgres corta la consulta entera.

## La medición que SÍ se pudo hacer — con la columna corregida, no con el script de `main`

Para no dejar la medición 2 sin cerrar, corrí la misma consulta cambiando `pdf_url` por `"pdfUrl"`
(entre comillas, tal como exige Postgres para un identificador con mayúsculas). **No se tocó el
fichero de `main`** — es una consulta ad-hoc, de solo lectura, ejecutada aparte:

```
DEV — facturas EMITIDAS (vf_estado = 'sellado'): 0
  → PENDING%             : 0
  → formato válido (D4)  : 0
  → formato legado       : 0
```

**Motivo, no ausencia de dato:** las 5 filas de `invoices` en DEV están **las 5 en
`pendiente_de_sellado`** (`SELECT vf_estado, count(*) FROM invoices GROUP BY vf_estado` → una sola
fila, `pendiente_de_sellado: 5`). Ninguna ha llegado nunca a `sellado`. El desglose por `pdfUrl` es
correctamente 0/0/0/0 porque el universo sobre el que se calcula —facturas emitidas— está vacío en
este entorno, no porque el script no encontrara nada que buscar.

🔴 **Repetido aquí, tal como pide el propio script**: «formato válido» ≠ «persiste». Sin
almacenamiento externo (reconfirmado en el punto 4 de este mismo ticket: cero SDKs de nube en
`package.json`), ninguna fila sobrevive garantizada a un redeploy de Railway — el proxy de formato
solo dice si el disco efímero tenía el fichero la última vez que se escribió esa fila, no si sigue
estando hoy. Con DEV en 0 emitidas, esta salvedad no tiene ninguna fila a la que aplicarse todavía,
pero sigue valiendo para cuando staging o producción se corran con la columna corregida.

## Lo que NO cubre esta entrada

* ⛔ No se corrige `desglose-pdfurl.mjs` en `main` — es un bug de una línea (`pdf_url` → `"pdfUrl"`)
  pero arreglarlo es construir, y el encargo de esta tanda es medir. Queda para quien lo pida.
* ⛔ **Staging y producción no se han corrido**, ni con el script tal cual (fallaría igual, mismo
  bug) ni con la columna corregida — no son de este puesto (dixit el encargo).
* La cifra de DEV (0 emitidas) es la MEDICIÓN de hoy sobre esta base; no dice nada de staging (9
  filas totales) ni de producción (2), que pueden tener una distribución de `vf_estado` distinta.
