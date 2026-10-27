# SCRUM-1573a · comercio SUPRIMIDO que sigue ofreciendo cobro: medición y propuesta

**Medido contra:** `origin/main` = `2a8d703da3711da3940c833948056fe48fdca0d3` · 2026-10-27T13:16:53Z (los dos bancos corrieron sobre `efe736f3f01b5ecbc6dce221e80a3dfc3bfcd42a`; entre los dos, 0 líneas de diff en `src/modules/billing`, `src/modules/system`, `src/core/http` y `prisma`)

A9: aviso → cicatriz J2 «la sesión de SCRUM-1573a volvió a pasarle a node un guion por bash (`node -e` con comillas escapadas) y no casó: falló en alto, sin número, y se rehízo con la herramienta de ficheros» — no se pudo comprobar: el guion se teclea en la consola, que ningún guard del repositorio ve

Lo escribe J2 (`jv-j2bj`). Decisión del fundador: SCRUM-1573 c.21021, «Medir y proponer». Es STOP de cobro: **esta rama no toca `src/`**. Lo que sigue se ha medido y se propone; nada se ha aplicado. Comentario en Jira: c.21029.

## ① La población: qué rutas ofrecen cobro al cliente final

Instrumento: `docs/master/evidencias/SCRUM-1573/censo-cobro-publico.mjs`, por AST (TypeScript).

- **La población es la de la casa.** Las rutas públicas se enumeran ejecutando `dist/app.js` con el método de `tests/scrum98-public-access-fail-closed.test.mjs` (pila de Express + `PUBLIC_PREFIXES`). Después se cruzan con los routers que el AST de `app.ts` monta en esos prefijos. Resultado: **35 en ejecución y 35 en el AST, y casan.** En la primera pasada salió CIEGO (29 frente a 35), porque `/pay/quote` y `/p/:slug` se registran con otro nombre de router y una de ellas con un array de rutas. Se corrigió el lector y no se tocó el cruce.
- **Control positivo sembrado.** Con `--sembrar` se añade un router fabricado que pinta `m.iban`: sale **cazado (1)**. Sin la semilla no aparece.
- **Coincide con lo que ya decía la casa.** `scrum893` nombra «las TRES páginas que llevan a `/pay/card`» (selector, recibo y portal), y las tres están en esta lista.

**8 rutas ofrecen cobro, y las 8 dicen NO a «mira si el comercio está suprimido»** (ninguna lee `REDACTADO`, `merchant_anonimizado` ni `merchant.status`):

| ruta | qué ofrece (marcador AST) |
|---|---|
| `GET /pay/invoice/:token` | `transferenciaDisponible()`, `cardChargeMode()`, `.bizumPhone`, `bizumAutoDisponible()`, enlaces a `/pay/card`, `/pay/bizum` y `/pay/bank` |
| `GET /pay/bank/:token` | `.iban`, `.clabe` |
| `GET /pay/card/:token` | `cardChargeDecision()`, `.stripeAccountId`, `checkout.sessions.create` |
| `GET /pay/bizum/:token` | `.bizumPhone` |
| `POST /pay/bizum/:token/claimed` | enlace a `/pay/bizum` |
| `GET /pay/mp/:token` | `.mpAccessToken`, `createMpPreference()` |
| `GET /recibo/:token` | `cardChargeMode()`, `transferenciaDisponible()`, enlaces a `/pay/bank` y `/pay/card` |
| `GET /cliente/:token` | `cardChargeMode()`, enlace a `/pay/card` |

**Fuera de la población, y sin medir:**
- los envíos que llevan un enlace a `/pay/invoice` (`invoiceWhatsApp.service.ts`, `invoiceReminder.service.ts`, `botFlow.service.ts`): son canal, no ruta;
- `viasDeCobro`: su único llamador es `GET /admin/merchant`, que ve el profesional y no el cliente.

## ② El banco: el caso real, pasado por el código real

Instrumento: `docs/master/evidencias/SCRUM-1573/banco-suprimido.mjs`.

- **El comercio suprimido no se escribe a mano.** Se parte de un comercio ES con IBAN, Bizum, Connect activo y los flags encendidos por comercio, y se pasa por el **`suprimirMerchant` real** sobre una base en memoria. **No hay PGlite en esta máquina**, así que esa base no es Postgres: es un doble de `updateMany`.
- **Las 8 rutas se levantan reales**, con dobles de prisma, Stripe y MP en `require.cache` (el patrón de `scrum893`). Cada una se pide ANTES de suprimir, como control positivo, y DESPUÉS.
- **Control positivo:** las 8 de 8 ofrecen cobro ANTES. En la primera pasada MP salió CIEGO porque no había token de MP en la máquina: se le dio uno falso de plataforma y la preferencia la crea un doble.

Lo que la supresión real deja escrito:
- `name`, `legalName`, `iban`, `bizumPhone`, `whatsappPhone` y `customer.email` pasan a valer `[borrado a petición del interesado]`;
- **`connectStatus = "active"`, `stripeAccountId = "acct_…"` y `status = "active"` no cambian.**

| ruta | DESPUÉS de suprimir (igual que antes en las 8) |
|---|---|
| `/pay/invoice` | 200 · tarjeta, Bizum, transferencia |
| `/pay/bank` | 200 · «Copiar IBAN» sobre el texto de redacción (sale 3 veces en la página) |
| `/pay/card` | 🔴 303 → **Checkout de Stripe en `acct_TEST1573`, la cuenta Connect del comercio suprimido**, con `customer_email` igual al texto de redacción |
| `/pay/bizum` | 200 · «Copiar móvil» sobre el texto de redacción |
| `POST …/claimed` | 303 · y además intenta avisar por WhatsApp al `whatsappPhone`, que ya está redactado |
| `/pay/mp` | 302 · preferencia de MP creada |
| `/recibo` | 200 · tarjeta, transferencia |
| `/cliente` | 200 · tarjeta |

Lo que el ticket no decía:
- **La tarjeta es una vía de cobro real.** La supresión no toca `stripeAccountId`, que no es dato personal y no está en `CAMPOS_PERSONALES`.
- **No he medido si Stripe rechaza ese `customer_email`.** El doble no valida.
- **MP lee `merchant.mpAccessToken`, que no es una columna del esquema, y cae al token de PLATAFORMA.** Es otro asunto (regla 18). Aquí solo se avisa, sin medir.

## ③ Cómo se reconoce hoy «suprimido», sin columna nueva

| señal | fiabilidad | coste |
|---|---|---|
| **A** · `merchant.name === REDACTADO` | La supresión la escribe siempre y las 8 rutas ya cargan `name`. Falso positivo si un comercio se pone ese nombre a mano: **sin medir** si `PUT /admin/merchant` lo impide | 0 consultas |
| **B** · AuditLog `merchant_anonimizado` | Se anota ANTES de redactar y se conserva | 1 consulta por ruta |
| **C** · `Merchant.status` | **La columna ya existe**, y `/p/:slug` y la entrada QR del bot ya miran `status === 'active'`. La supresión no la cambia, y `YAQU_MASTER.md:403` la cierra: «`active` (único valor; nadie lo cambia)» | 0 consultas, pero un valor nuevo es **cambio de master** (reglas 5 y 27), y escribirlo es tocar `supresionMerchant.service.ts`, del carril J3 |

**No hace falta ALTER.** Ninguna de las tres pide una columna nueva.

## ④ La propuesta: el diff mínimo (NO aplicado, NO ejecutado, carril J2)

```ts
// src/modules/billing/domain/comercioSuprimido.ts (NUEVO)
import { REDACTADO } from '../../system/domain/anonimizarMerchant';
/** SCRUM-1573 · ¿Este comercio ejerció su derecho de supresión? Señal A: la supresión redacta
 *  SIEMPRE `name`. Se importa REDACTADO; copiarlo sería una segunda verdad. */
export function comercioSuprimido(m: { name?: unknown } | null | undefined): boolean {
  return m?.name === REDACTADO;
}
```

En las 6 puertas (`payInvoice`, `payBank`, `payCard`, `payBizum` GET y POST, `payMp`), justo después de `if (!charge) return …404`:

```ts
if (comercioSuprimido(charge.merchant)) return res.status(404).send(documentNotFoundHtml());
```

En `receipt.routes.ts:132-133` y en `customerPortal.routes.ts:328`:

```ts
const puedeTarjeta = !comercioSuprimido(ch.merchant) && cardChargeMode(ch.merchant) !== 'refuse';
const puedeTransferencia = !comercioSuprimido(ch.merchant) && transferenciaDisponible(ch.merchant);
```

(En el portal, la misma línea con `m`. Las dos páginas se siguen sirviendo: el cliente conserva sus documentos.)

**Qué ve el cliente:**
- **En las 6 puertas**, el 404 que ya existe en `src/core/http/publicNotFound.ts:27-28`: «Este enlace no corresponde a ningún documento activo.» y «Si esperabas un presupuesto o un cobro, pide al profesional que te reenvíe el enlace.» No es texto nuevo, pero sí un uso nuevo, y la segunda frase manda a un profesional que ya no está: **pide firma (regla 39)**, y no se da por hecha.
- **En `/recibo` y `/cliente`**, la página de siempre sin botones de pago. El nombre del negocio sigue saliendo como el texto de redacción, que ya pasa hoy y queda fuera de este arreglo.

**Cómo se comprobaría si llega el GO:** `banco-suprimido.mjs` dice hoy «DESPUÉS = ofrece» en 8 de 8. Con el arreglo, tiene que decir «nada» en las 8 y mantener el «antes» vivo. Ese banco pasaría a test.

## Para el fundador (✅/❌)

1. ✅/❌ Un comercio suprimido no ofrece **ninguna** vía de cobro, tampoco la tarjeta por su cuenta Connect.
2. ✅/❌ Señal A ahora, sin cambio de master. Si es ❌: C, con cambio de la Parte L y la escritura del estado hecha por J3.
3. ✅/❌ En las 6 puertas, el 404 de hoy con su texto de hoy. Si es ❌, hace falta un texto nuevo con tu firma.
4. ✅/❌ `/recibo` y `/cliente` abiertos, sin botones de pago.
5. ✅/❌ Ticket aparte para la MP que cae al token de plataforma.

## Lo que se ha corrido y lo que no

- **Corrido:**
  - `tsc -p . --noCheck`, salida 0, solo para tener `dist/`; esta rama no toca `src/`;
  - `censo-cobro-publico.mjs --sembrar`, salida 0;
  - `banco-suprimido.mjs`, salida 0, con 8 de 8 controles positivos vivos.
- **No corrido:**
  - la suite entera en local (orden del orquestador: hoy la cola está saturada);
  - Postgres o PGlite: no hay en la máquina;
  - Stripe y MP reales;
  - el diff propuesto: no se ha aplicado.
