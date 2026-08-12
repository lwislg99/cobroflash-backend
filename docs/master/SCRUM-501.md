# SCRUM-501 · Una fila por envío, escrita al enviar

**Fecha:** 12-ago-2026 · **Carril:** infraestructura de envío · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `e18b0005d98bb4f5374e74ed248b39d6d86a2823` · 2026-08-12T13:41:39+01:00

> **Cero líneas de `prisma/schema.prisma`, cero backfill y ningún comando contra una base.** El
> modelo ya estaba; lo que faltaba era que alguien escribiera.

## 1 · La víctima

La tabla existe en las tres bases, el modelo está en el esquema, la firma del webhook está
construida y probada — y **la tabla se quedaría vacía para siempre**.

> 🔴 Un campo que existe en el esquema no es un campo que alguien escriba.

## 2 · PASO 0

`main` = `da72f0a6` **antes** del `fetch` y `6193be80` **después**.

La premisa tiene dos mitades y las dos se midieron **por contenido**:

| Qué | Resultado |
| --- | --- |
| `model EmailMessage` en `main:prisma/schema.prisma` | **está**, línea 970 |
| escritores (`emailMessage.create/update/upsert/delete…`) en `main:src/` | **CERO** |
| **control positivo del patrón** — el mismo regex sobre `auditLog`/`merchant`/`customer` | **encuentra escritores** en 6+ ficheros: el patrón discrimina |
| escritores en **toda la historia de todas las ramas** (`git log --all -S "emailMessage.create"`) | **ningún commit** |
| **control positivo del método `-S`** — el mismo sobre `auditLog.create` | encuentra `df8890e6`: el método funciona |

Buscar al **escritor** y no la mención era la condición: un patrón que casa con `model EmailMessage`
acierta siempre y no discrimina nada.

**Rama viva del otro carril, comprobada y no tocada:** `scrum-475-firma-del-webhook` · `8d229e79` ·
**Luis** · 12-ago 13:38 +0200. **No se solapa**: `git diff --name-only` sobre los dos ficheros que
este ticket toca del emisor → vacío. Ellos CONSUMEN lo que esto escribe.

## 3 · Qué entra

| Pieza | Dónde |
| --- | --- |
| El repositorio de la fila, con la invariante dentro | `src/modules/messaging/domain/registroDeEnvios.ts` (nuevo) |
| Las **cinco salidas** del emisor dejan fila | `src/integrations/enviarCorreo.ts` |
| El contexto que el emisor no puede saber | `CorreoSuelto.registro` (opcional, ver §5) |
| **El cable**: factura, justificante y presupuesto | `src/modules/messaging/domain/email.service.ts` |

### Las cinco salidas, y por qué la delegación NO duplica

`enviarPorResend` tiene dos salidas (el envío que sale y el que revienta) y `enviarCorreo` tres
propias (SMTP bien, SMTP mal, `sin_transporte`). **En la rama de Resend, `enviarCorreo` NO registra**:
delega con un `return enviarPorResend(c)` directo y aquélla ya escribió. **Dos filas por un envío es
tan defecto como cero** —el webhook actualizaría una y dejaría la otra mintiendo— y lo que lo hace
imposible es que la delegación siga siendo un `return` directo. Hay test de las tres cosas.

### El cable, y por qué `email.service`

Es el emisor que **lo sabe todo** —tiene la factura leída— y el que responde a la pregunta que
motiva la tabla: *«¿se le envió la factura F-2026-014 y cuándo?»*. Pasa `merchantId`, `customerId`,
`relatedType`/`relatedId` y un `kind` que **distingue `justificante` de `invoice`**, porque el copy
también los distingue (reglas 24/26) y una fila que los mezclara no podría contestarla.

### Lo que NO se inventa

* **`provider_id` nulo si el proveedor no da id**, y el `status` lo dice: `aceptado_sin_identificador`
  —que es exactamente el `@default` de la tabla—. Un id fabricado haría que el webhook actualizara la
  fila equivocada, o ninguna. Probado con cinco respuestas distintas (`null`, `{}`, `''`, `'   '`, `42`).
* **`updated_at` y `created_at` no se escriben a mano**: los pone Prisma (`@updatedAt`,
  `@default(now())`). La columna es `NOT NULL` sin default, así que un `INSERT` que no venga de ahí
  falla — y eso es a propósito. Hay aserto de que no aparecen en el `data`.
* **Sin backfill.** Los correos ya enviados no tienen fila y no se les inventa una.

## 4 · 🔴 La invariante, impuesta POR CONSTRUCCIÓN

> Una escritura de telemetría no puede tumbar la operación que observa.

`registrarEnvio` **no lanza nunca** y **no se cuelga nunca**, y las dos cosas viven DENTRO de esa
función. No en un `try` repetido en cada salida: una invariante repartida entre cinco `try` es una
invariante que alguien olvida en el sexto. Una divergencia imposible gana a una vigilada.

* **El `await` y el `catch` sobre la MISMA promesa.** Un `try` alrededor no habría bastado: solo ve
  la excepción de lo que se espera con `await`, y una escritura lanzada sin esperar rechaza cuando el
  bloque ya terminó.
* **El plazo no es adorno** (3 s). Sin él, una base que no contesta **retrasa el correo
  indefinidamente**, que es tumbar la operación por otro camino. Medido con una escritura que nunca
  resuelve: el envío sigue en **53 ms**. Y su rechazo tardío se atiende, para que no acabe en un
  `unhandledRejection`.

## 5 · Los emisores que hoy NO dejan fila — declarado, no escondido

`merchant_id` y `kind` son `NOT NULL`, así que **sin contexto no hay fila**, e inventar un merchant
para poder escribirla sería peor que no tenerla. Los que aún no lo pasan, con lo que le falta a cada
uno:

| Emisor | Qué le falta | Su correo |
| --- | --- | --- |
| `auth.service` (enlace de acceso, invitación) | `merchantId` lo tiene a mano; falta pasarlo con `kind: 'magic_link'` | **sale igual** |
| `lifecycle.service` (bienvenida, día 3/7/12, primer pago) | tiene `m.id`; falta `kind: 'lifecycle'` | **sale igual** |
| `weeklyDigest.service` | tiene `merchant.id`; falta `kind: 'digest'` | **sale igual** |
| `merchantNotifications` (pago, presupuesto aceptado) | **solo tiene el correo**: habría que bajarle el `merchantId` desde sus rutas | **sale igual** |
| `soporteAdmin.routes` | correo interno de soporte, sin merchant asociado | **sale igual** |

**No se cablean aquí a propósito:** cada uno es una firma que cambia y un llamador que hay que tocar,
y este ticket tenía preautorizados el emisor y el repositorio. Ninguno de esos correos deja de salir;
simplemente no deja fila todavía. Es un hueco **nombrado**, no un olvido.

Y el `sin_destino` del emisor **no escribe fila y es correcto**: `to_email` es `NOT NULL`, y sin
destinatario no hubo envío al que ponerle destino. Va fijado en un test para que la ausencia sea una
decisión.

## 6 · 🔴 Un test del encargo encontró un defecto REAL en mi propio código

El encargo pedía comprobar explícitamente: *«si tu escritura mete esa dirección en algún otro sitio,
ESE sitio no está cubierto»*. **Lo metía.**

La columna `error` guarda el mensaje del proveedor **tal cual**, y ese mensaje trae el destinatario
dentro: *«550 no such user ana@obra.example»*. `CAMPOS_PERSONALES` cubre `emailMessage.toEmail`
(SCRUM-497) y **no cubre `error`**, así que la dirección habría **sobrevivido a una supresión del
art. 17 escondida en un texto** — y el guard de SCRUM-497 no la habría visto, porque vigila
**columnas**, no contenidos.

**No se arregla añadiendo un segundo vigilante** (y `CAMPOS_PERSONALES` era STOP): se ataca la causa.
El motivo se escribe sin direcciones en claro, enmascarando **por forma** cualquier cosa con forma de
correo —no solo el destinatario, porque el mensaje puede nombrar el remitente o el de otro—. Si no
entra en claro, no hay nada que anonimizar después.

> El test que lo destapó salió ROJO sobre código que yo acababa de escribir y que ya daba verde en
> todo lo demás. Es la diferencia entre un control positivo escrito para pasar y uno escrito para
> encontrar.

## 7 · Verificación

| | Qué | |
| --- | --- | --- |
| **🔴 CONTROL POSITIVO** | un envío escribe **EXACTAMENTE UNA** fila, con `provider_id`, `kind`, destinatario, `customer_id` y `related_type`/`related_id` | ✅ |
| **🔴 CONTROL NEGATIVO** | la escritura **revienta** → no lanza, devuelve `fallo_escritura`, y el envío sigue | ✅ |
| **🔴 CONTROL NEGATIVO (2)** | la base **no contesta** → el envío sigue en 53 ms, y se declara `plazo` | ✅ |
| **SIN IDENTIFICADOR** | cinco respuestas sin id utilizable → fila escrita, `provider_id` **nulo**, estado que lo dice | ✅ |
| **SUELO** | si el censo de escrituras del emisor ve menos de cinco → **ESCÁNER CIEGO**, no verde | ✅ |
| **CONTROL NEGATIVO (3)** | sin contexto o sin destino **no toca la base**, y dice cuál falta | ✅ |
| **DOS INSTRUMENTOS** | el cliente **espía** sobre `registrarEnvio` (comportamiento) **y** el AST del emisor (que cada salida registra, y que la delegación no duplica) | ✅ |
| **🔴 DATO PERSONAL** | la dirección solo acaba en `to_email`, la única columna cubierta. El log la enmascara | ✅ |
| **Guard de la fase 1** | `scrum475-un-solo-emisor` · **7/7**, sin tocar | ✅ |

### Los dos rojos por MUTACIÓN — commiteado en verde antes, con post-condición

Las dos mutan **el valor**, no la estructura: `tsc` sigue en 0, así que miden el defecto y no un
error de sintaxis. Las dos con respaldo del fichero y post-condición de que el árbol volvió idéntico
(`git diff --stat` vacío).

| Mutación | Cae diciendo |
| --- | --- |
| se quita la escritura del camino de éxito de Resend (1 línea, compila) | *«`enviarPorResend` registra 1 veces y tiene DOS salidas… **Un correo que sale sin fila no deja constancia de él**»* — y además el suelo se declara ciego |
| el `catch` del repositorio deja de tragar y **relanza** | *«`registrarEnvio` LANZA cuando la base falla. Entonces un fallo de telemetría **tumba el envío que observa**: el correo sale y el llamador recibe una excepción como si no hubiera salido»* |

## 8 · Dos guards ajenos me corrigieron, y los dos tenían razón

* **SCRUM-494 (huérfanos)** cazó `PLAZO_ESCRITURA_MS` y `sinCorreosEnClaro`: **su único consumidor
  externo era mi propio test**. Su consejo no era declararlos, era **quitarles el `export`** y medir
  por la superficie pública. Hecho — y el test resultante es **mejor**: comprueba que la **fila
  escrita** no lleva direcciones, no que exista un ayudante que sabría quitarlas.
* **SCRUM-409** salta con `merchantId: 1.5` porque lee el `1` como el merchant DEMO. Es un **falso
  positivo suyo**, pero mi valor era arbitrario: `7.5`, y queda dicho en el fuente. Su fichero no se
  toca; el falso positivo va al informe.

## 9 · Números

| | tests | pass | fail | skipped |
| --- | --- | --- | --- | --- |
| **línea base** — el conjunto de tests **de `main`** sobre este árbol, medida aparte | 3.562 | 3.485 | **0** | 77 |
| **después** — la tanda entera de esta rama | 3.574 | 3.497 | **0** | 77 |
| diferencia | **+12** | **+12** | 0 | **0** |

Los **+12 son exactamente** los de `tests/scrum501-una-fila-por-envio.test.mjs`. Ni un salto nuevo.

**El ABSOLUTO caduca cuando su objeto se mueve; el DELTA sobrevive:** `main` se movió durante la
sesión, así que los totales de mañana serán otros — el **+12** no.

* `npm run guards:entrada` — 4 guards · 17 tests · 0 fallos.
* `tests/scrum475-un-solo-emisor.test.mjs` — **7/7**, y el POST a Resend sigue siendo **uno**.

## 10 · Lo que NO se ha tocado

`prisma/schema.prisma` · ningún backfill · ninguna base de datos (ni un comando que escriba) · el
receptor del webhook y todo `scrum-475-firma-del-webhook` · los textos de ningún correo · la
semántica de fallo de los emisores (siguen lanzando) · `CAMPOS_PERSONALES`,
`ORDEN_BORRADO_MERCHANT` y `barridoDemo` · `public/` · `cobrosView.js` y el vocabulario de `paid_via`.

## 11 · Huecos declarados

* 🔸 **Cinco emisores no dejan fila todavía**, nombrados en §5 con lo que le falta a cada uno. Sus
  correos salen igual.
* 🔸 **Nada verificado contra una base.** El cliente de Prisma se **inyecta**: que el `INSERT` funcione
  contra Postgres —y en particular que `updated_at` se rellene— no lo prueba esta tanda. El gateado de
  staging tampoco lo cubre porque no hay test que llame al emisor con una base real.
* **El `error` enmascarado se mide por FORMA.** Una dirección escrita raro por el proveedor
  (`ana [at] obra.example`) no la vería. Cubre lo que llega de verdad; no es un sanitizador general.
* **`related_type`/`related_id` solo los llena `email.service`.** Los demás irían nulos incluso tras
  cablearse, salvo que su llamador los baje.
* **La fila no se lee desde ninguna pantalla.** Escribir era este ticket; consultarlo —«¿se le envió
  la factura F-2026-014?»— no tiene superficie todavía.
