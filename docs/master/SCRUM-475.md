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
