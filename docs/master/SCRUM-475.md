# SCRUM-475 · No se puede acreditar que un correo llegó — y hay algo peor: 4 de 7 fallos no los ve nadie

**Medido contra:** `origin/main` = `fd2f0e4a8dabd90cc8be1ff388c8f2dc393a0ecd` · 2026-08-11T20:46:37+02:00
**Rama:** `scrum-475-constancia-correo`

> ⚠️ **PARO ANTES DE LA TABLA.** La constancia necesita una tabla propia y `prisma/schema.prisma`
> es del fundador: **el diff está preparado abajo y NO se ha aplicado.** Lo que entra hoy es el
> criterio (puro, con test) y **la captura: los 6 envíos ya NO tiran lo que contesta el proveedor**.
> **No digo que el ticket esté hecho: falta la mitad que persiste, y sin ella el mínimo
> irrenunciable —que un rebote no se pierda— no se puede cumplir**, porque un rebote llega por
> webhook y no hay dónde apuntarlo.

---

## (a) Qué devuelve el proveedor y qué se tiraba — **6 de 6** (medición ANTES de tocar)

`await axios.post('https://api.resend.com/emails', …)` **como sentencia suelta**. Censo por AST,
derivado del **destino de la llamada** (no del nombre de la variable ni del cliente HTTP):

| | |
|---|---|
| `auth/domain/auth.service.ts:16` · `messaging/domain/email.service.ts:56` · `:147` | 🔴 tira |
| `messaging/domain/lifecycle.service.ts:20` · `merchantNotifications.ts:12` · `weeklyDigest.service.ts:12` | 🔴 tira |

**6/6.** No hay SDK: es HTTP a pelo con `axios`, así que **la respuesta está ahí y solo hay que no
tirarla** — el fundador acertaba: eso cambia el tamaño del ticket.

⚠️ **Lo que NO he medido, y no lo doy por sabido:** la FORMA exacta de esa respuesta. Comprobarlo
exige una llamada real a Resend con la clave de producción, y ni toco credenciales ni mando correos
desde aquí. Por eso el código **no asume que venga un `id`**: `idDeLaRespuesta()` lo busca en
`data.id` y en `id`, exige cadena no vacía, y si no lo hay **el estado lo dice**
(`aceptado_sin_identificador`) en vez de guardar un `undefined` como si fuera un identificador. Eso
además protege del día en que el proveedor cambie su contrato.

## (b) ¿Webhooks de entrega y rebote? — **lo tiene que confirmar el fundador en el panel**

Resend documenta avisos de tipo `email.sent` / `email.delivered` / `email.bounced` /
`email.complained`, y firma cada aviso con un secreto que se configura en su panel. **No lo he
verificado: es documentación del proveedor, no una medición de este repo**, y el panel y sus
credenciales son del fundador (regla 9). Si se confirma, la segunda mitad es **una tabla y una
ruta** — nada más, y sin proveedor nuevo (regla 36: Resend ya está pagado).

## (c) 🔴 Y la pregunta que destapa lo peor: **4 de 7 fallos no los ve nadie**

| veredicto | | |
|---|---|---|
| **avisa** | `invoicesAdmin:574` · `quotesAdmin:577` | ✅ contestan `200 + sent:false`. **Es trabajo hecho de SCRUM-126**, y el profesional sí se entera |
| **sube** | `dev.routes.ts:83` | ruta de desarrollo |
| **traga-log** | `psp:60` · `psp:165` · `mpWebhook:125` | 🔴 el cliente no recibe su factura y nadie se entera: solo una línea de consola |
| **traga-mudo** | `psp:276` `sendMerchantPaymentEmail(…).catch(() => {})` | 🔴🔴 **el correo que le dice al PROFESIONAL que le han pagado**, y si falla no queda **ni una línea** |

**Sí, es un defecto separado y más grave**, por lo que dijo el encargo: es el caso en que **sí lo
sabemos**. Y no se arregla con un `console.error` más — se arregla con la fila. Va con la tabla.

### 🔴 Dos veces me equivoqué midiendo esto, y las dos por la misma razón

1. Mi primer censo clasificó los siete llamadores **por la forma del `catch`** (¿relanza?,
   ¿loguea?) y metió en el mismo cubo a quien avisa al usuario y a quien no. Los dos botones que
   pulsa el profesional salían como «tragones» **y no lo son**.
2. Corregido eso, clasificó `sendMerchantPaymentEmail(…).catch(() => {})` como **«avisa»**, porque
   al no encontrar un `try` subió hasta el `catch` de la ruta — que contesta **al PSP**, no al
   profesional.

Es la décima variante del mismo defecto de la casa: **el guard atado a la FORMA en vez de al
HECHO.** El hecho es «¿se entera alguien?», y se mide mirando si el manejador —el de la promesa
primero, que es el que manda— produce una respuesta. Las dos correcciones están dentro del censo,
escritas donde vuelven a morder.

---

## Lo que entra hoy

| | |
|---|---|
| `src/modules/messaging/domain/constanciaCorreo.ts` | **puro** (sin BD, sin red, sin camino fiscal): estados cerrados, `constanciaDeEnvio`, `constanciaDeFallo`, `idDeLaRespuesta`, `avanzar` |
| `tests/_censo-correo.mjs` | el instrumento por AST, con sus dos correcciones dentro |
| `tests/scrum475-constancia-correo.test.mjs` | 11 tests: suelo, trinquete, criterio y control negativo |

Y **los 6 emisores** (`auth.service`, `email.service` ×2, `lifecycle.service`,
`merchantNotifications`, `weeklyDigest`): la respuesta se captura y se devuelve como `Constancia`.
**El trinquete de «6 respuestas tiradas» baja a CERO en este mismo PR.**

**El criterio, que es lo que decide el diseño:** «aceptado» **no** es «entregado». Mientras el
proveedor no lo confirme, el estado es `aceptado_sin_confirmacion` — y eso **no es un hueco, es el
dato**, igual que el cubo sin-método y que el `cobros.csv` que sale vacío. `entregado` solo puede
venir de un aviso del proveedor, y hay test que lo fija. **Un rebote no se tapa**: ningún aviso
posterior lo borra, ni siquiera un `delivered` que llegue tarde.

**Y una cosa que el cableado arregla de paso, medida al hacerlo:** cuatro caminos salían por un
`return` mudo sin enviar nada —destinatario sin email, sin `RESEND_API_KEY`, sin `SMTP_URL`— y **se
leían exactamente igual que un envío bueno**. Ahora devuelven `fallo_envio` con su motivo.

### 🔴 Y un guard ajeno me corrigió a mitad de entrega

`tests/scrum411-exports-inalcanzables.test.mjs` cayó: *«hay dominio nuevo que nadie puede
alcanzar: 8 módulos y el tope es 7»* — y el módulo nuevo era el mío. Tenía razón: un módulo de
dominio sin llamadores **pasa todos los tests y entra verde**, y su ticket se cierra con el
cableado sin hacer.

La salida fácil era subir el trinquete a 8 con una nota. **La honesta era cablearlo**, y resultó
ser justo la mitad (a) del encargo — «puede que ya venga un identificador utilizable y solo falte
guardarlo». El guard de otra sesión convirtió media entrega en una entera.

**Suelo del cero:** «ninguna respuesta se tira» y «mi detector no reconoce el patrón» son el mismo
verde, así que hay un test que comprueba que el detector **sí** distingue una llamada tirada de una
guardada antes de creerse el cero.

**Control negativo:** el embudo de WhatsApp no se toca, y hay test que lo comprueba (existe el
modelo, y su servicio no depende del de correo).

## Verificado EN ROJO — por **exit code**, no por texto

| defecto inyectado | |
|---|---|
| un envío vuelve a tirar la respuesta | 🔴 `build=2 test=1` |
| se marca `entregado` un envío solo aceptado | 🔴 `test=1` |
| un rebote se tapa con un `delivered` tardío | 🔴 `test=1` |
| se fabrica un identificador donde no lo hay | 🔴 `test=1` |
| el motivo del fallo se pierde | 🔴 `test=1` |

⚠️ El arnés lee **el código de salida** de `node --test`. En SCRUM-397 leía `# fail`, que
`node --test` no imprime, y **seis rojos salieron verdes**. Además comprueba que el árbol limpio
compila antes de empezar y que la inyección cambió el fichero de verdad.

---

## 🛑 EL DIFF DE SCHEMA — **preparado y NO aplicado**

Espeja `WhatsAppMessage`, que es el criterio que pidió el encargo. **`provider_id` es `@unique`
a propósito**: es por donde el webhook encuentra la fila. Ésa es la razón por la que **`AuditLog`
no vale** —lo miré antes de proponer tabla nueva—: es append-only, no tiene estado que avance, y
localizar la fila por el id del proveedor sería escanear un JSON sin índice.

```diff
+model EmailMessage {
+  id         Int     @id @default(autoincrement())
+  merchantId Int     @map("merchant_id")
+  customerId Int?    @map("customer_id")
+
+  kind       String                                    // invoice | quote | magic_link | digest | ...
+  toEmail    String  @map("to_email")
+  providerId String? @unique @map("provider_id")       // id de Resend; NULL = no consta
+
+  // ESTADOS_CORREO (constanciaCorreo.ts). `aceptado_*` NO es «entregado».
+  status String  @default("aceptado_sin_identificador")
+  error  String?
+
+  relatedType String? @map("related_type")             // invoice | quote | charge
+  relatedId   Int?    @map("related_id")
+
+  createdAt DateTime @default(now()) @map("created_at")
+  updatedAt DateTime @updatedAt      @map("updated_at")
+
+  @@index([merchantId, createdAt])
+  @@index([relatedType, relatedId])
+  @@map("email_messages")
+}
```

**100 % aditivo**: una tabla nueva, cero columnas tocadas, cero `NOT NULL` sobre datos existentes.
`db push` no debería pedir `--accept-data-loss`; si lo pide, el diff no es éste.
**Sin backfill:** los correos ya enviados no tienen fila, y **no se les inventa una** — de ellos no
consta nada, que es la verdad.

## Lo que falta después del GO, en orden

1. Persistir la `Constancia` que los 6 emisores YA devuelven (una fila por correo).
2. La ruta del webhook de Resend, con verificación de firma → `entregado`/`rebotado`/`reclamado`.
   Y ahí es donde el `.catch(() => {})` de `psp:276` deja de ser mudo: el fallo tendrá dónde constar.
3. Que el rebote se VEA (dónde se enseña es decisión de producto, y hay microcopy: no la escribo).

**No se ha tocado:** `prisma/schema.prisma` · el camino de emisión · el embudo de WhatsApp ·
ninguna credencial.
