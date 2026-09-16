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
