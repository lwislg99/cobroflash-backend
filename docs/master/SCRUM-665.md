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
