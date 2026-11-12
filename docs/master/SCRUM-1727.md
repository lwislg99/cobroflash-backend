# SCRUM-1727 · El aviso de disputa de un cobro SIN factura (texto firmado) y la pregunta de la reseña (H5)

## SCRUM-1727 · El aviso sin factura ya no manda a «la factura»; H5 medida y formulada

> Lo escribe la sesión jv-j2bx (puesto J2, equipo de Javier), no el fundador. Carril J2
> (`node scripts/carriles.mjs de src/modules/payments/disputes.service.ts` → J2).

**Medido contra:** `origin/main` = `fe9c3e7dacda63bed660cf7aaf5b9f7667de05ab` · 2026-11-12T16:54:24Z (hora de GitHub)

A9: comprobación → `tests/scrum1727-disputa-sin-factura.test.mjs`

### De dónde sale

Partición de SCRUM-1436 (comentario 21728, punto (a); cierre en el 21736). Texto: SCRUM-1656, texto 3
de la tanda del comentario 21722 (la PROPUESTA recomendada), firmado en el comentario 21724 («Ok firmo
todo», transcrito por el orquestador del equipo de Javier). Copiado del ADF del comentario, no de una
ficha: comillas rectas (U+0022), ⚠️ = U+26A0 U+FE0F, dos líneas.

### Parte 1 · el texto 3

`src/modules/payments/disputes.service.ts`, `avisoDeDisputa`. Sin factura sale ahora:

> ⚠️ El banco de {cliente} ha abierto una disputa por {importe}.
> Este cobro no tiene factura, así que no hay "Paquete de disputa". Reúne el presupuesto y los mensajes con {cliente} para responder al banco.

Con factura, igual que antes (los tres casos de SCRUM-1436). Sin factura la prueba del presupuesto es
siempre `ninguna`, así que la rama vieja «firmado y sin factura» no se podía alcanzar; queda separada
en dos `if` y el caso firmado sigue saliendo byte a byte igual (lo comprueba el positivo de 1436).

Regla 28: no cambia ni cuándo ni a quién. Mismo `notifyMerchantAlert`, mismo teléfono, un envío.

**Rojo primero**, ejecutando `handleStripeDispute` desde `dist/` (base doblada, WhatsApp en dry-run),
con el código sin tocar: 3 casos, cae 1 (el del defecto: salía «…Entra en la factura y pulsa
"Paquete de disputa" — sale todo listo para responder al banco.») y pasan los 2 controles (con
factura no cambia; regla 28). Después, 3 de 3.

**Un test que ya existía cambia:** `tests/scrum1436-disputa-firmado-solo-con-firma.test.mjs`, caso «el
cobro NO tiene factura», comparaba con el texto viejo (el que su propia ficha daba por pendiente).
Ahora compara con el literal firmado, escrito a mano. Sus otras dos comprobaciones (no dice «FIRMADO»,
no consulta presupuesto) siguen igual.

**Mutaciones** declaradas en `MUTACIONES_QUE_ME_TUMBAN` y pasadas con `aplicarUna` de
`scripts/meta-guard-mutaciones.mjs`: 3 de 3 caen (guion
`docs/master/evidencias/SCRUM-1727/mutar-1727.mjs.txt`, salida en `mutar-1727.salida.txt`). Volver a
caer en la rama vieja, quitar una tilde al literal, y la condición al revés (cae el control con
factura). Después, `git diff --stat src` igual que antes de mutar.

⚠️ **Error mío, cazado antes de fiarme:** copié el molde de `mutar-1218j.mjs.txt`, que rotula «VIVA»
cuando `aplicarUna` devuelve `ok: true`, y `ok: true` quiere decir que el test CAYÓ. Leí el código de
`aplicarUna` antes de dar el número por bueno y cambié el rótulo a «CAE» en mi copia. El de 1218j no
lo toco (es de J6).

Ficha: `docs/microcopy/2026-11-12-SCRUM-1656-disputa-sin-factura.md`.

**Guards dirigidos** (25 ficheros: los dos de disputa de 1436, 553, 237, 976, 1387 ×3, 514 ×2, 726,
1415, 411, 737, 747, 1177, 921c, 812, 723, 700, 719, 1294, 273, 267 y el nuevo): primera pasada 261
casos, 259 pasan y **caen 2, los dos míos**: `scrum237` (la negación «Entra en la factura» del caso sin
factura no tenía un positivo con el mismo token) y `scrum976`, que corre `guards:entrada` y cae por lo
mismo. Arreglado con el positivo en el control con factura. Segunda pasada de los afectados: 44 de 44,
0 saltan; mutaciones repetidas tras el cambio, 3 de 3 caen. Build con tipos (`tsc -p . --noEmit`):
salida 0.

### Parte 2 · H5, la reseña: SOLO MEDIDA, nada construido

Leído en `origin/main` (no ejecutado, nada visto en yaqu.app ni en Meta):

| pregunta | lo que hace hoy | dónde |
| --- | --- | --- |
| ¿Cuándo sale? | Justo al confirmarse un pago por enlace, si el negocio tiene `googleReviewUrl` y el cliente tiene número. Fire-and-forget. | `psp.routes.ts:324-339`, `mpWebhook.routes.ts:220-235` |
| ¿Se repite? | En el PSP no: el reintento de un cobro ya pagado sale antes (`already_paid`). En Mercado Pago NO lo he comprobado. | `psp.routes.ts:99` |
| ¿Mira la ventana de 24 h? | **No.** Llama a `sendWhatsAppCtaUrl` directo, no a `sendWhatsAppWindowFirst`. El comentario dice que la ventana «está abierta porque el cliente acaba de pagar por el enlace», pero pagar en una web no es escribir por WhatsApp; si no hay entrante en 24 h, cuenta con que Meta lo rechace y queda una fila `failed`. Que Meta lo rechace: no medido aquí. | `whatsapp.ts:982` |
| ¿Mira la franja 09:00-21:00? | **No.** `isQuietHours` sólo la usan los mantenimientos. | `maintenance.service.ts:108` |
| ¿Respeta la baja? | **Sí.** `corteDeLaBaja`, sin exención. | `whatsapp.ts`, dentro de `sendWhatsAppCtaUrl` |
| ¿Cuenta para el tope de 3/día? | No medido. | — |

El choque del máster: la Parte L dice «reseña Google si configurada» al pagar; J6 dice «cero Marketing,
cero no-transaccional · automatismos 09:00-21:00 hora del merchant».

**Pregunta para el fundador (en SCRUM-1727, comentario de entrega):** ¿se queda la petición de reseña,
pero sólo con la ventana comprobada antes de enviar y dentro de 09:00-21:00 hora del negocio, sin
mandarla si no se cumple? ✅ = se queda con esas dos puertas (código de J2 y la excepción escrita en J6
por el fundador). ❌ = se retira y la Parte L deja de decirlo. Recomendación: ✅.

### Lo que NO lleva

- La tanda completa en local: no corrida (10 sesiones a la vez). Hace de tanda el obligatorio.
- Nada visto en yaqu.app: haría falta una disputa real de Stripe sobre un cobro sin factura.
- H5: ni una línea de código. Mercado Pago (repetición) y el tope de 3/día, sin medir.

## SCRUM-1727 · 1727-ci: el obligatorio de #3131 cayó en scrum709 (una ficha nombraba a otra)

> Lo escribe la sesión jv-j2c4 (puesto J2, equipo de Javier), no el fundador. Carril J2; los dos
> ficheros que toca este tramo salen SIN CERRADURA en `node scripts/carriles.mjs de <ruta>`.

**Medido contra:** `origin/main` = `420ee00b709e461b70f1c0e99766a5a1de834986` · 2026-11-12T18:07:55Z (hora de GitHub)

A9: comprobación → `tests/scrum709-microcopy-por-fichero.test.mjs`

**Qué cayó.** Job 131344846557 (log de 2.316.058 B): 1 «not ok», el 10780, `SCRUM-709 · 🔴 NO hay un
índice que toda sesión tenga que editar`. La ficha `docs/microcopy/2026-11-12-SCRUM-1656-disputa-sin-factura.md`
escribía el nombre de fichero de la ficha de SCRUM-1436, y el guard lee eso como un índice a mano.

**Arreglo (sin tocar el guard).** La línea dice ahora «cuya ficha está en este mismo directorio», sin
el nombre del fichero. Ningún texto que ve el usuario cambia: es la ficha, no el aviso.

**Rojo primero.** Con la ficha de la punta anterior (`11a82b855`), `scrum709` en local: 8 casos, 7
pasan y cae 1, el mismo de CI. Con el arreglo: 8 de 8.

**Al día con main.** La rama iba 22 commits por detrás: `git merge origin/main` (sin rebase) contra
el sha de arriba, sin conflictos.

**NO medido:** la tanda entera en local (10 sesiones a la vez; hace de tanda el obligatorio).
