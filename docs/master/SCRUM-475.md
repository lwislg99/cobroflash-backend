# SCRUM-475 (fase 1) · Un solo emisor, y el acuse deja de tirarse

**Fecha:** 11-ago-2026 · **Carril:** infraestructura de envío · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `cffde532a0912803cdf5bea415505f90757874b2` · 2026-08-11T19:12:37Z

**Paso 0:** `docs/master/SCRUM-475.md` no existía en `main` ni en ninguna rama remota (listado
completo, filtrado después), y ningún worktree tenía la rama.

> Nace del hallazgo de SCRUM-406, reportado y no arreglado allí (regla 37).

## 1 · El censo, antes de tocar nada

Derivado por AST, no por `grep` —`api.resend.com` aparece también en los comentarios que explican
la regla—:

```
POST a api.resend.com en src/: 7
  src/integrations/enviarCorreo.ts:50          respuesta → DESCARTADA
  src/modules/auth/domain/auth.service.ts:16   respuesta → DESCARTADA
  src/modules/messaging/domain/email.service.ts:56    → DESCARTADA · ADJUNTOS
  src/modules/messaging/domain/email.service.ts:147   → DESCARTADA · ADJUNTOS
  src/modules/messaging/domain/lifecycle.service.ts:20        → DESCARTADA
  src/modules/messaging/domain/merchantNotifications.ts:12    → DESCARTADA
  src/modules/messaging/domain/weeklyDigest.service.ts:12     → DESCARTADA

  descartan la respuesta: 7 de 7
  ¿alguien lee el id del acuse?: NADIE
```

**Siete, no seis.** El séptimo era el genérico que nació en SCRUM-406 — y **también tiraba la
respuesta**, así que el hallazgo que reporté se aplicaba a mi propio código.

«DESCARTADA» es literal: la llamada era una **sentencia suelta** y el valor se perdía. Resend
contesta con un `id` por envío, y ninguna de las siete lo miraba.

### Las dos comprobaciones que pedía el encargo

| Pregunta | Respuesta |
| --- | --- |
| ¿`createMailer()` sigue cayendo a `streamTransport` sin Resend ni SMTP? | **SÍ** |
| ¿`enviarCorreo` sigue devolviendo `sin_transporte`? | **SÍ**, y con su rojo propio (R7) |

Un `sendMail` que resuelve bien contra un buffer en memoria es la forma que tiene «no configurado»
de disfrazarse de «enviado». Ese suelo no se ha movido.

## 2 · Lo construido

`src/integrations/enviarCorreo.ts` pasa a tener **dos niveles**:

| | |
| --- | --- |
| `enviarPorResend()` | **el único POST del árbol**. Devuelve el acuse (`{ id, crudo }`) |
| `enviarCorreo()` | la política: Resend → SMTP → `sin_transporte`. Encima del anterior |

Los seis emisores lo consumen y **ninguno conserva POST propio**. `email.service` usa el nivel bajo
**a propósito**: tiene respaldo propio debajo —el `.eml` del outbox de dev (SCRUM-76)— y delegar la
política entera se lo habría llevado por delante.

Y el acuse **sale**: `sendInvoiceEmail` y `sendQuoteEmail` devuelven `acuseId`. Cada envío se
registra con **log estructurado** (`evento`, `via`, `id`, `origen`, `to`, `asunto`) y con el
destinatario **enmascarado** — un correo es dato personal y los logs de Railway los lee cualquiera
con acceso al panel.

## 3 · 🔴 Lo que NO cambió, y es lo que más cuidado exigió

**La semántica de fallo.** Los cinco emisores migrados **siguen lanzando** cuando el correo no sale,
y eso no es inercia: sus llamadores dependen de la excepción.

| Si dejara de lanzar… | Qué pasaría |
| --- | --- |
| `merchantNotifications` (×3) | sus `.catch()` quedarían muertos: el fallo dejaría de registrarse |
| `weeklyDigest` | el `console.log('✓ enviado')` de la línea siguiente se imprimiría sobre un correo que no salió |
| `lifecycle` (day3/7/12) | 🔴 **`markSent()` marcaría como ENVIADO un correo que no existe**: el merchant no lo recibe nunca y el sistema cree que sí |
| `auth.service` | `return { sent: true }` está en la línea siguiente al `await`: pasaría a mentir |

Convertir el `throw` en un `return` silencioso habría **introducido la mentira exacta que este
ticket viene a quitar**, mientras la quitaba de otro sitio. Esta fase unifica el emisor y rescata el
acuse; cambiar el control de flujo de cinco módulos es otra cosa y no se cuela de tapadillo.

> Lo que sí mejora sin pedir permiso: `auth.service` caía a `createMailer()` **incondicionalmente**,
> así que sin Resend y sin SMTP registraba «email enviado OK» sobre un correo que moría en un
> buffer. Ahora eso dice que no salió. El enlace mágico se sigue imprimiendo (SCRUM-39).

## 4 · El guard, y los nueve rojos

`tests/scrum475-un-solo-emisor.test.mjs` — sin gate, sin BD, sin red. **Cuenta apariciones**, que era
la condición: no comprueba que el emisor exista, comprueba que el número **sea uno**, con igualdad y
no con `<=`.

| Se rompe… | El guard dice… |
| --- | --- |
| aparece un séptimo POST | *«HAY 2 LLAMADAS A RESEND Y TIENE QUE HABER UNA»* |
| el emisor descarta la respuesta | (no compila: `r` deja de existir) |
| el acuse deja de devolverse | *«EL EMISOR NO DEVUELVE EL ACUSE»* + los retornos vistos |
| **uno de los dos** llamadores deja de recogerlo | *«EL ACUSE NO LLEGA A TODOS LOS QUE ENVÍAN: lo recogen 1 de 2»* |
| el log pierde el `id` | *«EL LOG DEL ENVÍO NO LLEVA EL id DEL ACUSE (línea 104)»* |
| el log pasa a ser prosa | *«HAY UN LOG DE CORREO EN PROSA»* |
| **uno de los dos** logs escribe el correo entero | *«UN LOG ESTÁ ESCRIBIENDO EL CORREO DEL DESTINATARIO SIN ENMASCARAR»* |
| se pierde el suelo de SCRUM-406 | *«…un `sendMail` que triunfa contra un buffer es "no configurado" disfrazado de "enviado"»* |
| un emisor deja de lanzar | *«…(en lifecycle) el email se marca como enviado sin haberlo estado»* |

### 🔴 Tres veces me salió VERDE con el fallo dentro, y siempre por lo mismo

1. **`acuseId`**: pedía UNA aparición y `email.service` tiene DOS llamadores. Al quitárselo a uno,
   el test seguía verde porque el otro lo cumplía.
2. **`to: maskEmail(`**: idéntico — se conformaba con que UNO de los dos logs enmascarara.
3. **El `id` del log**: el regex `JSON.stringify({[\s\S]*?id,` **saltaba de línea** hasta encontrar
   el `id,` del `acuse: { id, crudo }` que hay más abajo, así que casaba aunque el log no lo llevara.

> **«Hay al menos uno» no vigila a los demás**, y un regex multilínea perezoso casa con lo que
> encuentre por el camino. Los tres se arreglaron mirando cada llamada por AST — y los tres los
> destapó el rojo, no una relectura.

## 5 · 🔴 EL LÍMITE DE ESTA FASE, Y ES EL QUE EL ENCARGO ANTICIPABA

**Con esto, el acuse EXISTE y es ACCIONABLE en el momento del envío. Lo que NO es, todavía, es
ACREDITABLE.**

* `sendInvoiceEmail` puede devolver el `acuseId` a quien la llamó, y ese llamador puede decidir con
  él **en ese instante**. Eso ya no se puede hacer sin esta fase.
* Pero **nada lo ata a la factura**. Mañana, ante «¿se le mandó la factura F-2026-014 y cuándo?», la
  única respuesta es buscar en los logs de Railway — que **rotan**, no se consultan desde el
  producto, y no se pueden cruzar con una fila.

Así que sí: **sin tabla no se acredita nada**, y esta fase no la crea porque no le toca. Lo que
faltaría es una fila por envío con `acuseId`, a qué documento pertenece y cuándo — y eso es schema,
que es del fundador. **Lo dejo dicho y paro aquí**, como pedía el encargo.

Y hay una segunda mitad que también es de la fase siguiente: **el acuse solo dice que Resend lo
aceptó**, no que llegara. Saber si rebotó exige su webhook, y el webhook necesita dónde escribir.

## 6 · Lo que NO se ha tocado

`prisma/schema.prisma` (cero líneas de diff, comprobado) · ninguna tabla · la semántica de fallo de
los emisores · el outbox de dev · los textos de ningún correo · `sendOutcome.ts` y su vocabulario.

## 7 · Tests que corren

- `tests/scrum475-un-solo-emisor.test.mjs` — 7 tests (suelo, un solo POST, no descarta, el acuse
  viaja a los dos, log estructurado y enmascarado, el suelo de 406 intacto, control negativo)

Suite completa: **3.163 tests · 3.087 pasan · 0 fallos · 76 saltados** (los gateados por BD).
`guards:entrada` y `guard:prisma` en verde.

---

# FASE 2 · El vocabulario, y el censo que el propio refactor cegó

**Medido contra:** `origin/main` = `687d262b9ef2409cc9613a1b72844f60f6907c00` · 2026-08-11T22:05:00+02:00

**11-ago-2026** · La fase 1 (arriba) **no se toca**: es la forma sobre la que esto se construye, y
la describe entera. Aquí solo va lo que le falta.

## 0 · De dónde sale esta fase: dos personas construyeron el mismo ticket

Se construyó SCRUM-475 por duplicado y sin saberlo. La versión de la fase 1 (PR #708) **gana y es
la que hay**: un solo emisor, guard de «exactamente una llamada a Resend», acuse y log enmascarado.
Es mejor forma que siete sitios capturando cada uno lo suyo.

`git merge-tree` de la otra rama contra `main` daba **siete ficheros en conflicto** —el `.md` en
add/add y los seis emisores reescritos—, así que mergear no era resolver un documento: era deshacer
el cambio bueno fichero a fichero. **Se tira el cableado de los seis emisores** y se rehacen encima
solo las piezas que `main` no tenía. Ninguna de las dos personas hizo nada mal.

## 1 · 🔴 Lo que más importa de esta sesión: el refactor cegó un guard sin tocarlo

Al traer `main`, el censo de envíos que se tragan el fallo pasó de **4 mudos a 0**.

**Nadie los arregló.** Los cuatro `.catch(() => {})` siguen exactamente donde estaban —se leyeron
uno a uno en `main` antes de afirmar nada—. Lo que pasó es que `nombresDeEmisor()` propagaba **solo
dentro de un fichero**, y funcionaba porque cada emisor tenía su propio POST dentro. Al unificarlos
en `enviarCorreo.ts`, `sendMerchantPaymentEmail` pasó a llamar a una función **importada**, dejó de
parecer emisor, y sus llamadores dejaron de censarse.

| | intra-fichero (ciego) | cruzando ficheros |
| --- | --- | --- |
| emisores exportados | 4 | **17** |
| llamadores censados | 14 | **31** |
| **mudos** | **0** | **4** |

Y el atajo que había —«si el fichero no nombra al proveedor ni `sendMail`, sáltatelo»— era la otra
mitad del agujero: tras el refactor, un fichero que llama a un emisor importado no menciona ninguna
de las dos cosas. Retirado.

> **Un refactor correcto puede dejar ciego a un guard sin tocarlo, y el guard lo cuenta como cero.**
> «Cero mudos» y «no supe mirar» salían por la misma línea. Ésta es la razón por la que el detector
> se autoprueba ANTES de creerse ningún número, y por la que hay un test dedicado a que la
> propagación cruce ficheros: mover una llamada de sitio es algo que pasa constantemente y sin mala
> intención.

## 2 · Qué entra

| Pieza | Dónde |
| --- | --- |
| El vocabulario de qué consta | `constanciaCorreo.ts` — puro, sin BD ni red |
| Cableado en el emisor único | `enviarCorreo.ts` · `constancia` en `ResultadoCorreo` |
| El censo derivado que cruza ficheros | `tests/_censo-correo.mjs` · `nombresDeEmisor()` |
| El trinquete de los 4 mudos, nombrados | `tests/scrum475-constancia-correo.test.mjs` |

### Por qué el vocabulario, si ya hay `acuseId`

Tener el `id` significa **una** cosa: el proveedor lo aceptó. No que llegara. La propia fase 1 lo
deja escrito en su §5. Sin vocabulario, ese límite vive solo en un documento — y un identificador de
mensaje *parece* un acuse de recibo, así que mañana alguien lee «tenemos el id» como «llegó». Ahora
el límite está en el tipo que devuelve el emisor.

### 🔴 Cuánto se tocó del emisor único, exactamente

`constancia` es **obligatoria**, no opcional. Y eso no es cosmético: al compilar, TypeScript señaló
**tres sitios** que construían un `ResultadoCorreo` a mano (`lifecycle`, `merchantNotifications`,
`weeklyDigest`, todos con su `sin_destino` propio y un criterio más estricto —exigen la `@`—). Eran
cuatro sitios diciendo lo mismo; ahora es uno, `resultadoSinDestino()`.

Diff real en esos tres emisores: **2 líneas cada uno** (el import y el `return`). Su semántica de
fallo —que la fase 1 defendió a propósito— **no se toca**: siguen lanzando.

**El guard de «exactamente una llamada a Resend» sigue verde, 7/7.** Es el control que prueba que
no se ha deshecho el cambio de la fase 1.

## 3 · Verificación

| | Qué | |
| --- | --- | --- |
| **🔴 AUTOPRUEBA** | el detector ve una respuesta tirada Y una guardada, sobre fuente sintético — antes de creerse ningún cero | ✅ |
| **🔴 CRUZA FICHEROS** | `sendMerchantPaymentEmail` sale del censo aunque su POST esté al otro lado de un import | ✅ |
| **🔴 TRINQUETE** | 4 mudos, **nombrados** con fichero y línea. No baja de 4 | ✅ |
| **🔴 `entregado`** | ninguna respuesta de envío lo produce; solo un aviso del proveedor | ✅ |
| **🔴 REBOTE** | ningún aviso posterior lo tapa, tampoco un `delivered` tardío | ✅ |
| **OBLIGATORIA** | `constancia` no es opcional: sin ella no compila | ✅ |
| **CONTROL POSITIVO** | el contrato de SCRUM-406 y de la fase 1 intacto; un envío normal igual que en `main` | ✅ |
| **CONTROL NEGATIVO** | el embudo de WhatsApp sigue intacto y no depende del de correo | ✅ |
| **Fase 1** | `scrum475-un-solo-emisor.test.mjs` · **7/7** | ✅ |

### Los rojos por el mecanismo — cada uno probado

| Mutación | Cae diciendo |
| --- | --- |
| la propagación vuelve a ser intra-fichero | *«LA DERIVACIÓN HA VUELTO A ENCERRARSE EN UN FICHERO … el número bajaría a cero y NADIE habría arreglado nada»* (+2 tests) |
| un envío aceptado se marca `entregado` | *«un envío ACEPTADO se está marcando como entregado … el correo que rebote parecerá que se recibió»* (+1 test) |
| un `delivered` tardío tapa el rebote | *«UN `delivered` TARDÍO ESTÁ BORRANDO UN REBOTE … es la mentira exacta que este ticket viene a impedir»* |
| `constancia` pasa a opcional | *«ha dejado de ser obligatoria … compilará y devolverá un envío del que no consta nada»* |

## 4 · 🔴 El diff de schema — PREPARADO Y SIN APLICAR

`prisma/schema.prisma` es **dominio exclusivo del fundador**. Esto no se ha aplicado ni se aplicará
sin GO. Se deja escrito porque sin tabla no se acredita nada — es el mismo límite que declaró la
fase 1 en su §5.

```prisma
model EmailMessage {
  id         Int     @id @default(autoincrement())
  merchantId Int     @map("merchant_id")
  customerId Int?    @map("customer_id")

  kind       String                                    // invoice | quote | magic_link | digest | ...
  toEmail    String  @map("to_email")
  providerId String? @unique @map("provider_id")       // id de Resend; NULL = no consta

  // ESTADOS_CORREO (constanciaCorreo.ts). `aceptado_*` NO es «entregado».
  status String  @default("aceptado_sin_identificador")
  error  String?

  relatedType String? @map("related_type")             // invoice | quote | charge
  relatedId   Int?    @map("related_id")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt      @map("updated_at")

  @@index([merchantId, createdAt])
  @@index([relatedType, relatedId])
  @@map("email_messages")
}
```

**100 % aditivo**: tabla nueva, cero columnas tocadas, cero `NOT NULL` sobre datos existentes.
`db push` no debería pedir `--accept-data-loss`; si lo pide, el diff no es éste. **Sin backfill:**
los correos ya enviados no tienen fila y **no se les inventa una** — de ellos no consta nada, que es
la verdad. El `@unique` en `providerId` es lo que permitirá que el webhook encuentre la fila.

## 5 · Lo que NO se ha tocado

`prisma/schema.prisma` (cero líneas de diff) · ninguna tabla · la semántica de fallo de los emisores
(siguen lanzando) · el outbox de dev · los textos de ningún correo · `sendOutcome.ts` · el guard de
la fase 1 · el embudo de WhatsApp.

## 6 · Huecos declarados

* **Los 4 mudos NO se arreglan aquí** (regla 37: no es mi zona, no me bloquea, son cuatro rutas
  ajenas; y regla 30: lo que haya que decirle al profesional lo aprueba el asesor). Van con la
  tabla, que es donde el fallo tendrá dónde constar. Quedan **nombrados**, con fichero y línea, y el
  trinquete impide que aparezca un quinto.
* **No hay webhook.** `entregado`, `rebotado` y `reclamado` existen en el vocabulario y **hoy nadie
  los produce**: hace falta el webhook del proveedor, y el webhook necesita dónde escribir. La
  función `avanzar()` está probada y sin llamador — es deliberado, y se dice.
* **Nada se persiste.** Igual que en la fase 1: el estado se decide y no se guarda.
* **No verificado en `yaqu.app`.** Todo lo de arriba se prueba con la suite; no se ha mandado un
  correo real ni se ha mirado un rebote de verdad.
* **Microcopy: ninguna.** Esta fase no tiene superficie. Si al arreglar los mudos hay que avisar al
  profesional, el texto lo aprueba el asesor (regla 30).

---

# FASE 2A · La firma del aviso: que el «entregado» venga de quien dice venir

**Medido contra:** `origin/main` = `db820c35fffa526187057330457593e8b5315aeb` · 2026-08-12T10:04:32+01:00
**Fecha:** 12-ago-2026 · **Carril:** infraestructura de envío · **Gate:** sin gate, corre en `npm test`

**12-ago-2026** · Las fases 1 y 2 (arriba) **no se tocan**: son de otras sesiones y son historia.
Aquí solo va la mitad que se podía construir hoy.

**Paso 0:** cuatro worktrees vivos; `b2` está en `scrum-475-ignoran-el-resultado`, cuyo último
commit (`3d8c1d7d`, lwislg99, 2026-08-12 09:40) es **un merge de `main` sin trabajo propio todavía**.
Búsqueda por contenido de `svix` en todo el árbol: **cero coincidencias** — nadie había construido
esto. `main` al ramificar: `90e810ad`; al cerrar: `db820c35` (se mueve solo, porque los cuatro
worktrees comparten refs).

## 0 · Por qué esta mitad y no la otra

La fase 2 completa necesita la tabla `EmailMessage` —el diff está en §4, **preparado y sin
aplicar**, y es del fundador— y el secreto del panel de Resend. **La verificación de firma, en
cambio, es PURA**: se construye y se prueba hoy con un secreto de prueba. Cuando la tabla entre,
esto ya estará probado.

> 🔴 **Lo que protege, y no es un check más.** `entregado`, `rebotado` y `reclamado` son los tres
> estados que **nuestro propio envío NO puede producir** — `constanciaCorreo.ts` lo fija con un test
> desde la fase 2. Solo los produce un aviso del proveedor. Si la firma no se comprueba, **cualquiera
> con la URL nos dice que una factura se entregó y el producto se lo cree**. La constancia entera
> pasa a valer cero, y peor que cero: parece que la tienes.

## 1 · 🔴 El cuerpo crudo, y cuál de los dos precedentes se reutiliza

La firma cubre **los bytes tal cual llegaron**. Un `express.json()` parsea y re-serializa —espacios,
orden de claves, escape de no-ASCII— y con eso la firma deja de casar. Se leyeron los dos
precedentes de la casa:

| | Dónde | Forma |
|---|---|---|
| ① | `src/app.ts:147` | `express.json({ verify })` guarda `rawBody` **solo si la URL empieza por `/webhooks/whatsapp`**, dentro del parser GLOBAL |
| ② | `stripe.routes.ts:12` · `connectWebhook.routes.ts:20` | `express.raw({ type: 'application/json' })` exportado por el propio router y montado antes del global |

**Se reutiliza ②**, y el motivo no es preferencia. **① es un retrofit**: el webhook de WhatsApp
necesita *además* `req.body` ya parseado (lo recorre entero tras validar), así que su raw body tuvo
que colarse dentro del parser global, y el precio es **una lista de URLs dentro de un middleware por
el que pasa toda la aplicación**, que hay que ampliar cada vez. ② es self-contained: el webhook trae
su propio parser y no toca nada de nadie — por eso Stripe lo usa **dos veces**, y es la forma que la
casa ya eligió para un webhook *nuevo*. Añadir `/webhooks/resend` a la lista de ① sería editar el
parser por el que pasa todo para no ganar nada.

**Aquí no se monta ninguna ruta** (es la fase 2B). Lo que esa decisión fija **hoy** es la firma de la
función: recibe `Buffer`, y **nada más que `Buffer`**.

## 2 · 🔴 Los cuatro rechazos salen cada uno por su camino

No se comprueba «que algo falla»: se comprueba **qué** falla. Un test compara el **mapa entero** de
los cuatro escenarios y exige cuatro salidas distintas.

| Escenario | Clase / motivo |
|---|---|
| firma incorrecta (la cabecera no trae nada comparable) | `RECHAZADO/firma_ilegible` |
| cabecera ausente | `NO_SE_PUDO_COMPROBAR/falta_cabecera` — **nombrando cuál de las tres** |
| repetición (aviso legítimo de ayer, con su firma buena) | `RECHAZADO/fuera_de_ventana` |
| cuerpo alterado después de firmar | `RECHAZADO/firma_no_coincide` |

**La ventana se comprueba ANTES del HMAC, a propósito.** Una firma válida lo sigue siendo para
siempre: si se comprobara después, un aviso repetido pasaría el HMAC y solo entonces se miraría la
hora — que es el orden en el que se cuela el fallo el día que alguien «optimice» saliendo antes.

### El límite, dicho y no fingido

Una firma **bien formada pero falsa** es indistinguible de un **cuerpo alterado**: las dos son
`firma_no_coincide`. Eso es lo que *es* un MAC, y **no se inventa una distinción ahí** — hacerlo
sería peor que no tenerla, porque haría creer que el log separa un ataque de un fallo nuestro. Lo que
sí queda es el diagnóstico de **qué se firmó** (id, timestamp, bytes), y hay un test que exige que el
detalle lo declare.

## 3 · 🔴 El suelo es una CLASE, no un comentario

| Clase | Qué significa |
|---|---|
| `RECHAZADO` | se comprobó y salió que no. Alguien manda basura |
| `NO_SE_PUDO_COMPROBAR` | no había con qué: falta el secreto, falta una cabecera, o el cuerpo no llegó crudo. **Es un fallo NUESTRO** |

Los dos rechazan igual —fail-closed, como `isValidSignature` de WhatsApp (SCRUM-99)—, pero **dicen
cosas distintas**. Sin esa separación, el día que el secreto de Railway esté mal pegado el log dirá
«firma inválida» y se buscará el fallo en Resend durante horas. El precedente de la casa devuelve un
`boolean` y distingue solo por el `console.error`; aquí la distinción está **en el tipo**, que es lo
que impide que el siguiente que lo lea la pierda. **Ese guard es ajeno y no se ha tocado** (regla 9).

## 4 · Los dos controles que no son de rutina

* **EL FORMATO ESTÁ FIJADO.** Una firma calculada sobre `ts.id.cuerpo` en vez de `id.ts.cuerpo`
  **no vale**. Sin este control, módulo y test podrían estar de acuerdo en un formato equivocado y
  los dos en verde — hasta el primer aviso real. Por lo mismo, la firma de los tests **se construye
  a mano** con `node:crypto`: si se la pidiera al módulo, probaría que está de acuerdo consigo mismo.
* **RE-SERIALIZAR EL MISMO JSON ROMPE LA FIRMA, medido.** Se firma un cuerpo con espacios, se
  re-serializa igual que haría `express.json()` y la firma cae. La razón del `Buffer` deja de ser
  prosa y pasa a ser un test.

## 5 · Ni dependencia ni SDK — medido, no supuesto

HMAC-SHA256 sobre `id.timestamp.cuerpo`, secreto en base64 tras `whsec_`. Son ~40 líneas de
`node:crypto`, así que **no se añade `svix` ni el SDK de Resend**: la regla 36 ni se activa.
`timingSafeEqual` va envuelto en `try/catch` — lanza si los buffers miden distinto —, **mismo patrón
que `mercadopago.ts:129` y `whatsappIncoming.routes.ts`**.

Y los bytes se concatenan como bytes (`Buffer.concat`), no como cadenas: con una plantilla de texto
habría que elegir una codificación, y el primer asunto con eñe dejaría de casar. Hay test con
acentos y emoji.

## 6 · Ningún secreto, en ningún sitio

El módulo **no lee configuración**: el secreto entra por parámetro. No hay ninguno escrito en el
código, ni en los tests, ni de ejemplo, ni en un comentario — el de prueba se genera con
`randomBytes` **en cada test**.

## 7 · Los rojos por el mecanismo, probados uno a uno

| Mutación | Cae diciendo | Tests que caen |
|---|---|---|
| se quita la comprobación del HMAC | *«🔴 CUALQUIERA PUEDE MANDARNOS UN AVISO DE ENTREGA … la constancia entera pasa a valer cero, y peor que cero, porque parece que la tienes»* | 6 |
| se quita la ventana de repetición | *«los cuatro rechazos NO están saliendo cada uno por su camino»* + la ventana | 2 |
| «falta el secreto» pasa a reportarse como firma inválida | *«son cosas distintas: una es nuestra configuración y la otra es alguien mandando basura … imposible depurar el día que el secreto esté mal puesto en Railway»* | 1 |

## 8 · Verificación

| | Qué | |
|---|---|---|
| **CONTROL POSITIVO** | firma válida aceptada · cuerpo con acentos y emoji · dos firmas durante una rotación | ✅ |
| **🔴 LOS CUATRO** | cuatro escenarios → cuatro salidas distintas, comparadas como mapa | ✅ |
| **🔴 SUELO** | sin secreto · secreto mal pegado · cuerpo ya parseado → `NO_SE_PUDO_COMPROBAR`, nunca «firma inválida» | ✅ |
| **🔴 FORMATO** | firmar en otro orden no vale | ✅ |
| **🔴 CUERPO CRUDO** | re-serializar el mismo JSON rompe la firma | ✅ |
| **VENTANA** | corta por los dos lados; el borde se acepta; el futuro no | ✅ |
| **ORDEN** | nada se parsea antes de verificar | ✅ |
| **VOCABULARIO** | los 4 eventos hablan `constanciaCorreo.ts`; uno desconocido da `null`, no un estado por defecto | ✅ |
| **Guards ajenos** | fase 1 + fase 2 **22/22** · SCRUM-411 **17/17** (sigue en 8 módulos y 192 huérfanos) | ✅ |

**Suite:** línea base **3.306 tests · 3.229 pasan · 0 fallos · 77 saltados**, medida aparte apartando
el fichero nuevo del glob (no se borró nada del disco).

## 9 · Lo que NO se ha tocado

`prisma/schema.prisma` (cero líneas de diff) · **ninguna tabla: no existe todavía** · nada se
persiste · **ninguna ruta montada** · `app.ts` · el camino de emisión y el sellado · el guard de «una
sola llamada a Resend» · `constanciaCorreo.ts` (se **consume**, no se modifica) · cero dependencias
nuevas en `package.json`.

## 10 · Huecos declarados

* **No hay ruta.** Es la fase 2B, y necesita la tabla. Lo que esta fase deja listo es la función y la
  decisión de raw body **escrita y probada**, no montada.
* **`avanzar()` sigue sin llamador.** Verificar la firma no avanza ningún embudo: quién avanza y
  sobre qué fila necesita la tabla. Sigue siendo deliberado, y sigue dicho.
* 🔴 **Este módulo no queda vigilado por SCRUM-411**, y se dice en vez de dejarlo implícito. Vive en
  `src/integrations/` —donde la casa ya pone la verificación de firma de un proveedor
  (`mercadopago.ts`)— y el censo de 411 solo recorre `src/modules/*/domain/`. Se eligió por
  precedente, no para esquivar el guard: **se comprobó que 411 sigue en 8 módulos y 192 huérfanos**.
  Un módulo de dominio habría subido el tope a 9 y habría que declararlo con su motivo; éste no
  aparece en ninguna de las dos poblaciones, así que **lo único que lo mantiene visible es esta
  línea**.
* **Solo los nombres `svix-*`.** El esquema estandarizado admite además alias `webhook-id` /
  `webhook-timestamp` / `webhook-signature`. Lo verificado en el encargo son las tres `svix-*`, y es
  lo único implementado: **no se codifica lo que no se ha medido**.
* **No verificado contra Resend de verdad.** No se ha recibido ni un aviso real: todo se prueba con
  firmas construidas según el esquema documentado. El primer aviso real es de la fase 2B.
* **Firma bien formada pero falsa == cuerpo alterado.** Ver §2.
* **Microcopy: ninguna.** Un webhook no tiene superficie.

## 11 · Ficheros

* `src/integrations/firmaResend.ts` (nuevo) — la verificación y el mapeo de eventos al vocabulario.
* `tests/scrum475-firma-del-webhook.test.mjs` (nuevo) — 18 tests.
* `docs/master/SCRUM-475.md` — esta fase, **añadida**; las fases 1 y 2 quedan intactas.
# FASE 3 · Los ocho del trinquete, y la trampa de que fueran ocho

**Medido contra:** `origin/main` = `22c79b5739e572ed1b9b9dd0f38a9c63bd43a253` · 2026-08-12T11:01:00+02:00

**12-ago-2026** · Las fases 1 y 2 (arriba) **no se tocan**. Esto cierra los ocho que la fase 2 dejó
nombrados y que SCRUM-477 volvió a nombrar cuando completó el criterio.

## 0 · PASO 0

`git worktree list` da cuatro árboles vivos; este trabajo va en `cobroflash-b2`. Búsqueda **por
contenido** (`conConstancia`, `canalDeFallo`, `registroDeAviso`, `resultadoSinDestino`) sobre el
listado completo de `git ls-remote --heads origin`: el mecanismo solo vive en `main` y en las cuatro
ramas de SCRUM-475 ya mergeadas o cerradas. Las relacionadas, con su última punta:

| Rama | Último commit | Autor | Hora |
| --- | --- | --- | --- |
| `scrum-475-constancia-correo` | `68518cf4` | Javier Pereira Fernández | 11-ago 20:56 +0100 |
| `scrum-475-emisor-unico` | `24b2c1de` | Luis | 11-ago 21:13 +0200 |
| `scrum-475-constancia-sobre-emisor-unico` | `8c447809` | Javier Pereira Fernández | 11-ago 22:27 +0100 |
| `scrum-475-sql-email-messages` | `5c281680` | Javier Pereira Fernández | 11-ago 23:08 +0100 |

`main` se movió **tres veces** durante la sesión —`1117b313` → `3d8c1d7d` → `90e810ad` →
`22c79b57`— y se ha traído dentro las tres. Verificado además que SCRUM-477 (`3dc9015a`) **ya es
ancestro de `main`**: el mecanismo que esto consume está mergeado, no es trabajo mío sin empujar.

## 1 · LOS OCHO, del trinquete de SCRUM-477, con fichero y línea

Sacados de `tests/scrum477-avisos-con-constancia.test.mjs` §5 y **re-medidos** con el instrumento de
`main` antes de tocar nada:

| # | Sitio | Emisor | Aviso que se pierde |
| --- | --- | --- | --- |
| 1 | `src/core/cron/cron.ts:61` | `sendWeeklyDigests` | resumen semanal |
| 2 | `src/core/cron/cron.ts:71` | `runLifecycleEmails` | ciclo de vida (día 3/7/12/expirado/inactivo) |
| 3 | `src/index.ts:30` | `startCronJobs` | — (ver §3: no es un aviso) |
| 4 | `src/modules/auth/domain/auth.service.ts:278` | `requestMagicLink` | enlace de acceso |
| 5 | `src/modules/auth/domain/auth.service.ts:314` | `sendWelcomeEmail` | bienvenida |
| 6 | `src/modules/auth/domain/auth.service.ts:316` | `requestMagicLink` | enlace de acceso |
| 7 | `src/modules/billing/app/routes/stripe.routes.ts:80` | `sendFirstPaymentEmail` | primer pago (plan Pro) |
| 8 | `src/modules/auth/app/routes/auth.routes.ts:23` | `requestMagicLink` | enlace de acceso — **FUERA** |

## 2 · 🔴 UNA PREMISA DEL ENCARGO ERA FALSA, Y LO DIGO CON LA FUENTE

A mitad de sesión llegó una corrección: *«te dije que tus ocho eran los `ignora-resultado` del censo;
era falso. Tus ocho son los del trinquete de SCRUM-477. Son otros ocho.»*

**No son otros ocho: son los mismos.** El trinquete de SCRUM-477 no es una lista escrita a mano —se
**deriva** de esa misma clasificación, en su propia línea:

```js
const perdidos = LLAMADORES.filter((l) => l.veredicto === 'ignora-resultado' || l.veredicto === 'traga-mudo');
assert.equal(perdidos.length, 8, …)
```

Con `traga-mudo: 0` (medido), «los ocho del trinquete» y «los ocho `ignora-resultado`» son la misma
lista por construcción, nombre por nombre. Lo confirma la propia entrada de SCRUM-477 §2: *«los ocho
que quedan son de otros carriles —el arranque de los crons, el enlace mágico de acceso, el primer
pago de Stripe—»*, que son exactamente estos.

Se dice porque el encargo pedía PARAR si no salían ocho, y salen ocho: los de la tabla de arriba.

**La otra mitad de la corrección sí era buena, y era importante**, así que está construida: ver §3.

## 3 · 🔴 ENVOLTORIO DE PROGRAMACIÓN vs EMISOR EN EL CAMINO DEL CORREO

El aviso de la corrección: `nombresDeEmisor()` marca emisora a **toda** función que ALCANCE al
proveedor, y con eso `ignora-resultado: 8` sumaba dos cosas distintas.

**Se deriva, no se lista** (`emisorasDiferidas()` en `tests/_censo-correo.mjs`): se propaga «alcanza
al proveedor» una **segunda vez**, esta vez sin atravesar los callbacks que se le entregan a un
programador (`cron.schedule`, `setTimeout`…). Lo que es emisora por el camino largo y no por el
corto, **envía después**.

Medido sobre los 17 emisores derivados: **exactamente uno** sale diferido.

| | |
| --- | --- |
| **Envía al llamarlo** (16) | `enviarCorreo` · `enviarPorResend` · `sendWelcomeEmail` · `sendFirstPaymentEmail` · `requestMagicLink` · `sendWeeklyDigests` · `runLifecycleEmails` · `registerMerchant` · … |
| **Solo lo deja programado** (1) | **`startCronJobs`** |

Así que de los ocho, **siete** son llamadas cuyo fallo de correo se perdía de verdad, y **uno**
—`index.ts:30`— no lo era. La corrección apuntaba también a `registerMerchant` y `requestMagicLink`
como envoltorios; **medido, no lo son**: el envío ocurre DENTRO de la llamada (`requestMagicLink` →
`issueLoginLink` → `await sendEmail`), así que tirar su resultado sí perdía el fallo. Sus dos
llamadores están arreglados.

## 4 · 🔴 EL PEOR DE LOS OCHO NO ERA UN AVISO PERDIDO: ERA UNO PERDIDO PARA SIEMPRE

En el ciclo de vida el patrón era `await sendEmail(...)` como sentencia suelta y `markSent(...)` en
la línea siguiente. Cinco avisos lo tenían.

* si `sendEmail` **LANZA**, el `catch` de fuera corta antes de `markSent`. Ese caso estaba bien.
* si `sendEmail` **DEVUELVE** `sin_destino` —el correo del merchant sin `@`, y ahí no lanza— la
  ejecución seguía y `markSent` escribía `day3: 1`. **El merchant no lo recibe nunca, el sistema cree
  que sí, y no se reintenta jamás porque `alreadySent` ya dice que se mandó.**

Es la mentira exacta que la fase 1 se negó a introducir (*«`markSent()` marcaría como ENVIADO un
correo que no existe»*, §3 de arriba) y estaba **viva por el otro canal**. El mismo defecto tenía el
`console.log('✓ enviado')` del digest semanal, que afirmaba un envío que no se había intentado.

## 5 · Qué entra

| Pieza | Dónde |
| --- | --- |
| Cinco avisos nuevos en el conjunto CERRADO | `avisoConstancia.ts` · `AVISOS` |
| `dejarConstancia()` — la constancia cuando ya se sabe lo que pasó | `avisoConstancia.ts` |
| `ParteDeAvisos` + `resumenDelParte()` — el fallo VIAJA hasta el cron | `avisoConstancia.ts` |
| Los dos emisores del cron DEVUELVEN parte | `weeklyDigest.service.ts` · `lifecycle.service.ts` |
| `markSent` solo si salió, y constancia si no | `lifecycle.service.ts` (7 sitios) |
| El enlace de acceso y la bienvenida dejan constancia | `auth.service.ts` |
| El primer pago, por `conConstancia` y sin `await` | `stripe.routes.ts` |
| El parte de programación, DERIVADO | `cron.ts` · `index.ts` |
| Envoltorio diferido vs emisor inmediato | `tests/_censo-correo.mjs` · `emisorasDiferidas()` |

### El caso que NO encaja en el patrón, y cómo se resolvió (`index.ts:30`)

`startCronJobs` devolvía `void`: «nadie mira el resultado» era cierto **y vacío**. Lo que sí se
perdía ahí es otra cosa, y es real: su última línea era **prosa escrita a mano** —*«Jobs registrados:
recordatorio cotizaciones…, digest semanal…»*— que afirmaba seis jobs sin haber medido ninguno. Si
alguien borra un `cron.schedule`, esa línea sigue diciendo que está, y lo que se pierde no es un
correo: son **todos** los de ese canal, para siempre, sin que nadie los eche de menos —un resumen
semanal que no llega no tiene pantalla donde se vea su ausencia—.

Ahora la lista se **deriva** (cada nombre se anota en la misma sentencia que registra su job, así que
no se puede borrar el registro y dejar viva la afirmación) y `index.ts` lee el parte: si el job del
resumen semanal o el del ciclo de vida no quedó montado, **deja constancia al arrancar**, que es
cuando se puede arreglar.

**Lo que NO se hizo, y por qué:** aislar cada `cron.schedule` en su propio `try` para que un fallo de
registro no impida los siguientes. Exige pasar el callback a un helper, y `tests/scrum371` (guard
AJENO) busca `*.schedule(<expr>, <arrow literal>)` para comprobar que el barrido de sellos está
programado: al meterlo en un helper dejaría de verlo. **Gana el guard ajeno.** Queda declarado.

## 6 · Verificación

| | Qué | |
| --- | --- | --- |
| **🔴 AUTOPRUEBA** | el criterio distingue «se mira» de «se tira» sobre fuente sintético — 8 formas — antes de creerse ningún número | ✅ |
| **🔴 AUTOPRUEBA (2)** | el criterio «envía ahora / lo deja programado» probado sobre fuente sintético | ✅ |
| **🔴 AUTOPRUEBA (3)** | el detector de `markSent` probado sobre las cuatro formas, buena y malas | ✅ |
| **🔴 SUELO** | el censo tiene que VER las OCHO llamadas una a una, o su número no significa nada | ✅ |
| **🔴 SUELO (2)** | 17 emisores y 31 llamadas: con menos, «ninguno pierde el fallo» es «no supe mirar» | ✅ |
| **🔴 CERO ES SOSPECHA** | si el trinquete baja a 0, falla: el único admitido está declarado fuera | ✅ |
| **🔴 EL TEST QUE DECIDE** | cada aviso arreglado deja rastro con QUÉ, POR QUÉ y PARA QUIÉN, enmascarado y estable | ✅ |
| **🔴 `markSent`** | ningún aviso se marca ENVIADO sin que la decisión dependa del envío | ✅ |
| **CONTROL POSITIVO** | un aviso que SÍ sale no escribe nada y no paga fricción | ✅ |
| **CONTROL POSITIVO (2)** | `avisosSinProgramar` con los jobs reales del árbol no nombra ninguno | ✅ |
| **🔴 CONTROL NEGATIVO** | un aviso que revienta NO tumba el registro de la cuenta ni la activación del plan | ✅ |
| **Guard de la fase 1** | `scrum475-un-solo-emisor.test.mjs` · **7/7**, sin tocar | ✅ |

### Los rojos por el mecanismo — probados por INYECCIÓN, no por lectura

| Mutación | Cae diciendo |
| --- | --- |
| `stripe.routes.ts` vuelve a `sendFirstPaymentEmail(merchantId);` | *«HAY AVISOS QUE VUELVEN A PERDER SU FALLO: stripe.routes.ts:92 sendFirstPaymentEmail → se pierde el aviso «primer_pago». Veredicto visto: sube»* |
| `cron.ts` vuelve a `await sendWeeklyDigests();` | *«… cron.ts:110 sendWeeklyDigests → se pierde el aviso «resumen_semanal». Veredicto visto: ignora-resultado»* |
| `markSent` vuelve a correr sin condición | *«UN AVISO SE MARCA COMO ENVIADO SIN COMPROBAR QUE SALIÓ (línea 198 (envío visto: r))»* |

### 🔴 Y el verde falso que me salió, que es lo que más importa de esta sesión

La primera versión del guard buscaba `ignora-resultado` y `traga-mudo`, igual que el de SCRUM-477.
Se probó en rojo devolviendo `stripe.routes.ts` a tirar el resultado — el defecto exacto del ticket —
y **pasó en verde**.

El motivo: al arreglarlos, dos de estos emisores perdieron su `.catch()` inline y pasaron de canal
`devuelve` a canal `lanza`. Y `censarLlamadores` solo etiqueta `ignora-resultado` cuando el canal es
`devuelve`; con `lanza` y sin `catch` alrededor, la misma llamada tirada sale **`sube`**, que aquí es
mentira —un fire-and-forget sin `.catch` de un emisor que lanza no lo recoge nadie: es una promesa
rechazada sin manejador—.

> **Arreglar el sitio cambió la categoría por la que se le vigilaba**, y un guard escrito en negativo
> se quedó mirando un cubo por el que la regresión ya no pasa. La versión que hay exige el veredicto
> BUENO (`mira-resultado`): eso cierra `sube`, `traga-log` y `avisa` de una vez, sin enumerar formas
> de fallar. Lo destapó el rojo, no una relectura.

Y me pasó **una segunda vez, al revés**: mi propio detector de `markSent` exigía que el `if`
mencionara la palabra `enviado`, y se puso rojo sobre código correcto —los cinco avisos delegan la
decisión en `anotarEnvio(parte, correo, r)`—. Atado a la FORMA en vez de al HECHO, el defecto que
esta casa lleva nueve variantes cazando. Ahora exige que **la condición use la variable donde cayó el
resultado del envío**, lea el `.enviado` o se lo pase a quien decide.

## 7 · 🔴 Un guard AJENO se quedó ciego por mi refactor, y él lo cantó

`tests/scrum337-aviso-atado-al-bloqueo.test.mjs` deriva CUÁLES son los avisos del ciclo de vida
buscando cada `markSent(…, 'clave')` **dentro de `runLifecycleEmails`**, con la clave como literal.
Al extraer los cinco a un helper, ese censo pasó a ver **cero avisos** — y en vez de callarse, su
suelo cantó: *«cero avisos no significa "no hay correos que prometan nada": significa que la
derivación está ciega»*.

**Tenía razón, y no se relaja.** Es la misma lección de la fase 2 al revés, y esta vez me la aplicó
otro guard a mí. El `markSent` se ha devuelto a donde el guard ajeno lo busca; lo que se extrae es la
decisión (`anotarEnvio`), no la marca.

**Las cinco huellas congeladas de ese guard SÍ se han rehecho**, y es lo que ese guard existe para
forzar: mirar el otro lado antes de darlas por buenas. Mirado y comprobado en el diff: lo único que
cambia es `await sendEmail(...)` → `const r = await sendEmail(...)` y el `if` alrededor del
`markSent`. **Ningún asunto, ningún cuerpo, ningún botón y ninguna condición** (`age >= 12`,
`isTrial`, `quoteCount === 0`, `recent === 0`) se ha tocado, así que ninguna promesa se ha movido y
las dos ataduras (`censo de montajes`, `censo de borrados`) siguen verdes. El motivo queda escrito
dentro del propio fichero, junto a las huellas.

## 8 · Números

Las dos líneas base están medidas **aparte**, con el árbol limpio y en `main`. Hay dos porque `main`
se movió cuatro veces durante la sesión: la primera es la del arranque y la segunda es la única con
la que el delta significa algo (el ABSOLUTO caduca cuando su objeto se mueve; el DELTA sobrevive).

| | |
| --- | --- |
| Línea base al arrancar · `main` = `1117b313` | 3.296 tests · 3.219 pasan · 0 fallos · 77 saltados |
| **Línea base comparable** · `main` = `db820c35` | **3.306 tests · 3.229 pasan · 0 fallos · 77 saltados** |
| **Esta rama**, con ese `main` dentro | **3.321 tests · 3.244 pasan · 0 fallos · 77 saltados** |
| **Delta** | **+15 tests · +15 pasan · 0 fallos · 0 saltados nuevos** — son exactamente los 15 de `tests/scrum475-ignoran-el-resultado.test.mjs` |
| `guards:entrada` | 4 guards · 17 tests · verde |
| `tests/scrum393` (marcadores de conflicto) | 0 · 0 · 0 |

El censo, con el criterio completo: **17 emisores · 31 llamadas · `avisa: 3` · `traga-log: 3` ·
`traga-mudo: 0` · `mira-resultado: 24` · `ignora-resultado: 1`**. Suman 31 — eran **cinco**
categorías y el resumen que llegó traía cuatro; no faltaba ninguna llamada por explicar.

Recorrido del trinquete: **4** (SCRUM-475 f2, criterio incompleto) → **12** (SCRUM-477, criterio
completo) → **8** (arreglados los cuatro avisos al profesional) → **1** (esto).

## 9 · Lo que NO se ha tocado

`prisma/schema.prisma` (cero líneas de diff) · el emisor único `enviarCorreo.ts` (**cero líneas**) ·
`constanciaCorreo.ts` y sus estados · el guard de la fase 1 · la semántica de `throw` de los cinco
emisores migrados · el embudo de WhatsApp · el contenido y el asunto de **ningún** correo · el camino
de emisión fiscal y el sellado · `public/dashboard/js/`.

## 10 · Huecos declarados

* **La constancia sigue siendo un log, no una fila.** Misma frontera que las fases 1 y 2: la tabla
  `EmailMessage` está PREPARADA Y SIN APLICAR en §4 de la fase 2, y `prisma/schema.prisma` es del
  fundador (SCRUM-479). `registroDeAviso()` es exactamente la fila que habrá que escribir.
* **`auth.routes.ts:23` sigue perdiendo el fallo, y queda NOMBRADO.** Es el enlace de acceso pedido
  desde la pantalla de login: `POST /auth/login` contesta *«Si el email está registrado recibirás el
  enlace en breve»* a un usuario **sin sesión**, y decirle ahí que el correo no salió es microcopy
  del asesor (regla 30) — además de revelarle que su email existe, que es justo lo que esa respuesta
  genérica evita. El trinquete impide que se cuele un noveno y exige que ése siga siendo el único.
* **Al profesional no se le DICE nada todavía.** Esto deja constancia; avisarle es lo siguiente y su
  texto lo aprueba el asesor. La propuesta sigue sin implementar en SCRUM-477 §8.
* **Los tres `traga-log` no se tocan** (`mpWebhook.routes.ts:125`, `psp.routes.ts:62` y `:167`, los
  tres `sendInvoiceEmail`). No estaban en los ocho, son otro carril y su fallo **sí** deja una línea.
  Reportados, no arreglados (regla 37).
* **Aislar el registro de cada cron** — declarado en §5, con su motivo (guard ajeno de SCRUM-371).
* **No verificado en `yaqu.app`.** No se ha provocado un fallo de correo real ni se ha visto un
  arranque con un cron sin montar: todo lo de arriba se prueba con la suite.
