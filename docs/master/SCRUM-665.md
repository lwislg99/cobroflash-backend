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
