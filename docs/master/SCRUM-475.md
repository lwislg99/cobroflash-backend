# SCRUM-475 · No se puede acreditar que un correo llegó — y hay algo peor: fallos que no ve nadie

> 📌 **DOS SESIONES.** Abajo, íntegra, la **sesión 1** (medía 6 emisores y 1 mudo). Al final del
> documento, la **sesión 2**, que rehízo los tres censos contra un `main` más nuevo y **corrigió
> los dos números**: son **7 emisores** y **4 mudos**. El título original decía «4 de 7 fallos»;
> se deja constancia de que ese recuento se quedó corto, y de por qué.

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

---
---

# SESIÓN 2 · Los tres censos rehechos — y los dos números de la sesión 1 que se quedaron cortos

**Medido contra:** `origin/main` = `cffde532a0912803cdf5bea415505f90757874b2` · 2026-08-11
**Instrumentos:** AST (`typescript` 5.9.2). Cada censo lleva su control positivo dentro.

## PASO 0 — el arranque encontró una rama del mismo ticket

El encargo pedía crear `scrum-475-rastro-del-correo` desde `main`. **No se creó.** Ya existía
`origin/scrum-475-constancia-correo` (sesión 1, `f2483e9e`, **no mergeada**), y la constitución
manda parar ante una rama con el mismo número de ticket. Comprobado antes de adoptarla:

| comprobación | |
|---|---|
| ¿algún worktree la tiene checkouteada? | **ninguno** de los cuatro → huérfana |
| último commit | hace **41 minutos**, autor **Luis** |
| ¿está en `main`? | **no** (`merge-base --is-ancestor` = falso) |

Con el GO del fundador se continuó **dentro de esa rama**. El nombre del encargo era incorrecto:
él no sabía que la rama existía.

> ⚠️ **Fuera de carril, reportado y NO tocado:** durante la sesión, **dos worktrees cambiaron de
> rama solos** (`cobroflash-backend` → `scrum-469`, `b3` → `scrum-351`). Hay otra sesión viva.
> Comprobado que **no solapa**: SCRUM-469 toca `public/dashboard/js/`, no esta zona.

## Por qué la medición de la sesión 1 caducó — y qué parte de ella no

`main` avanzó **4 commits** desde `fd2f0e4a`, todos de **SCRUM-406 «Escríbenos»**. `fd2f0e4a`
**sí** es ancestro de `main`: no hay deriva, hay crecimiento. Y creció **encima del objeto
medido** — SCRUM-406 añadió `src/integrations/enviarCorreo.ts`, un emisor nuevo.

**El delta de la sesión 1 sobrevive; su absoluto no.** Los seis emisores que midió siguen ahí y
siguen cableados. Pero ya no son seis.

## (1) Qué devuelve el proveedor y qué se tiraba — **7**, no 6

| emisor HTTP | |
|---|---|
| `src/integrations/enviarCorreo.ts:50` | 🆕 **nació en SCRUM-406**, entró en `main` tirando la respuesta |
| los seis de la sesión 1 | ya cableados |

🔴 **Y esto es lo que vale la pena contar:** el séptimo **no lo encontró una revisión a mano**. Al
mergear `main` en la rama, el guard de la sesión 1 —que exige CERO respuestas descartadas y se
deriva del árbol— **cayó solo**, diciendo:

```
🔴 HAY ENVÍOS QUE DESCARTAN LA RESPUESTA DEL PROVEEDOR:
    src/integrations/enviarCorreo.ts:50  enviarCorreo()
```

Un guard escrito contra una lista de seis ficheros no habría dicho nada. **Ésa es la diferencia
entre derivar del censo y enumerar a mano**, y aquí se cobró sola.

Además hay **6 puntos SMTP** (`nodemailer.sendMail`); 2 guardan el resultado, pero solo para
volcar el `.eml` de dev, no para acreditar nada. **Total: 13 puntos de envío en el árbol.**

## (2) ¿Hay tabla de correo? — **0 de 24 modelos** (sin cambio)

Ningún modelo de correo. El único con campos de entrega/rebote sigue siendo **`WhatsAppMessage`**.
**Control positivo:** el lector encuentra el embudo de WhatsApp; si hubiera devuelto 0 ahí, se
habría declarado ciego en vez de informar «no hay tabla».

## (3) ¿Alguna ruta recibe `delivered`/`bounced`? — **cero** (sin cambio)

De 235 declaraciones con literal (228 rutas reales + los 7 `axios.post`), **ninguna** recibe
eventos de correo. El único fichero que maneja esos literales es `whatsappLog.service.ts`.
**Control positivo:** el censo sí ve **11 webhooks** que existen. Ve los que hay; de correo no hay.

## (4) 🔴 EL NÚMERO QUE MÁS CAMBIA: no son 4 de 7 tragones, son **11 de 21**

El censo B de la sesión 1 recibía la lista de emisores **escrita a mano**:

```js
const EMISORES = ['sendInvoiceEmail','sendQuoteEmail','sendMagicLink','sendMail','sendMerchantPaymentEmail'];
```

`enviarCorreo` no estaba en ella — pero el problema es más grande que un nombre que falta.
**Derivando la lista del árbol** (una función exportada es emisora si alcanza la llamada al
proveedor, directa o a través de otra del mismo fichero), la superficie pasa de **7 llamadores a
21**, y los mudos de **1 a 4**:

| veredicto | nº | |
|---|---|---|
| ✅ avisa | 4 | contestan que no salió |
| ⚪ sube | 6 | el error propaga |
| 🔴 traga-log | 7 | solo una línea de consola |
| 🔴🔴 **traga-mudo** | **4** | ni una línea |

**Los cuatro mudos, verificados uno a uno leyendo el código** (los cuatro son `.catch(() => {})`):

| dónde | qué correo se pierde |
|---|---|
| `psp.routes.ts:276` | «te han pagado» — al profesional |
| `quotes.routes.ts:294` | «te han aceptado el presupuesto» — al profesional |
| `whatsappIncoming.routes.ts:478` | ídem, aceptado por WhatsApp |
| `quotesAdmin.routes.ts:634` | «tu presupuesto fue aprobado» — al técnico |

🔴 **Los cuatro son la misma cosa: el aviso AL PROFESIONAL de que algo bueno ha pasado.** Se
mandan fire-and-forget y, si fallan, no queda ni una línea. Él cree que le avisamos.

**Tres de los cuatro no son nuevos ni los rompió nadie:** llevaban ahí todo el tiempo, fuera del
foco de una lista que se escribió una vez y se quedó vieja en silencio. Subir el trinquete de 1 a
4 **no es relajarlo**: relajarlo sería dejarlo en 1 sabiendo que son 4.

## (5) ¿Webhooks en Resend? — **SÍ, y esta vez verificado en su documentación**

La sesión 1 lo dejó explícitamente sin verificar. Verificado ahora — lectura de documentación
pública, **ninguna credencial tocada, ningún correo enviado**:

- **Eventos:** `email.sent` · `email.delivered` · `email.bounced` · `email.complained` ·
  `email.delivery_delayed` · `email.failed` · `email.suppressed` (+ `opened`, `clicked`,
  `scheduled`, `received`, y los de dominio/contacto/supresión).
- **Qué exigen:** tres cabeceras Svix (`svix-id`, `svix-timestamp`, `svix-signature`) y un
  **secreto de firma** que se saca del panel → **es del fundador** (regla 9). No se ha tocado.
- **Sin dependencia nueva:** la verificación HMAC manual está documentada, así que **no hace falta
  el SDK de Resend ni la librería `svix`** → **la regla 36 no se activa**.
- 🔴 **Requisito que toca nuestra arquitectura:** la firma se valida contra el **raw body**; un
  `express.json()` que parsea y re-serializa la rompe. **Y esto la casa ya sabe hacerlo:**
  `app.ts:146-152` guarda `rawBody` con `express.json({ verify })` para `/webhooks/whatsapp`, y
  Stripe usa `express.raw`. **Dos precedentes en casa**: la ruta de fase 2 no es terreno nuevo.

**Conclusión:** si el fundador confirma el alta en el panel, la fase 2 es **una tabla y una ruta**,
sin proveedor ni dependencia nuevos.

## Lo que entra en la sesión 2

| | |
|---|---|
| `src/integrations/enviarCorreo.ts` | el 7º emisor **cableado**: la respuesta se captura y viaja como `Constancia` |
| `tests/_censo-correo.mjs` | **`nombresDeEmisor()`**: la lista de emisores se DERIVA del árbol; se acabó la lista a mano |
| `tests/scrum475-constancia-correo.test.mjs` | suelo 6→7 y 5→13 nombres · trinquete de mudos 1→**4**, nombrados · **control positivo** del contrato de SCRUM-406 |

El contrato de SCRUM-406 (`enviado`/`motivo`/`via`) **no cambia**: la pantalla de soporte sigue
leyendo lo mismo. `constancia` se añade al lado.

## Verificado EN ROJO — por **exit code**, con el árbol limpio comprobado en verde antes

| defecto inyectado | | |
|---|---|---|
| el 7º emisor vuelve a tirar la respuesta | 🔴 `test=1` | nombra `enviarCorreo.ts` ✔ |
| la lista de emisores vuelve a escribirse a mano | 🔴 `test=1` | nombra `TRECE` ✔ |
| alguien silencia un 5º aviso al profesional | 🔴 `test=1` | nombra `MUDOS` ✔ |

El arnés comprueba además que **cada inyección cambió el fichero de verdad** (un patrón que no
casa no es un verde: es no haber probado nada) y que el árbol vuelve a verde al restaurar.
Restaura **por copia del texto original, no con `git checkout --`**: había trabajo sin commitear.

## 🛑 LO QUE NO ENTRA, Y POR QUÉ

1. **La tabla.** El diff de `EmailMessage` de la sesión 1 sigue **preparado y NO aplicado**:
   `prisma/schema.prisma` es del fundador. Sin ella, el mínimo irrenunciable —que un rebote no se
   pierda— **no se puede cumplir**, porque un rebote llega por webhook y no hay dónde apuntarlo.
2. **Los 4 tragones mudos NO se arreglan aquí.** Regla 37: son cuatro rutas ajenas, no bloquean
   esta tarea y no caben en este PR. Y regla 30: si hay que decirle algo al profesional, **el
   texto lo aprueba el asesor**. Se proponen y se para. Van con la tabla, que es donde el fallo
   tendrá dónde constar.

## Hueco conocido del instrumento — dicho, no tapado

El censo B clasifica por lo que pasa **si la llamada lanza una excepción**. `enviarCorreo()` no
lanza en su camino normal de fallo: **devuelve** `enviado:false`. Por eso su llamador
(`soporteAdmin.routes.ts:55`) sale como **«sube»** cuando en realidad **avisa** — se comprobó
leyendo el código. El veredicto no es falso, es que mide otra cosa. **Un emisor que devuelve su
fallo en vez de lanzarlo necesita otro criterio**, y ése no se ha escrito hoy.

**No se ha tocado en la sesión 2:** `prisma/schema.prisma` · el camino de emisión fiscal (leído,
nunca modificado — regla 38) · el embudo de WhatsApp · el contenido de ningún correo · ninguna
credencial · ningún proveedor ni dependencia nuevos.
