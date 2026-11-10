# SCRUM-1615 · /pay/mp y el token de la PLATAFORMA: medición y propuesta

**Medido contra:** `origin/main` = `ce1111a68d00d2063bc6bb369ce71d2124c3547f` · 2026-10-27T15:34:46Z (el censo corrió sobre `77ce98573`; entre los dos, 0 líneas de diff en `src/` y `prisma/`)

A9: aviso → A10 «El código de salida es el del último tramo de la tubería.» — no se pudo comprobar: corrí la pasada de control sin semilla con `| tail` y salió 0 cuando el censo había dicho CIEGO; lo vi al leer la última línea y la repetí sin tubería (salida 2). El comando se teclea en la consola, que ningún guard ve

Lo escribe J2 (`jv-j2bm`), por encargo del orquestador `cobroflash-backend-8b`. Nace de SCRUM-1573 c.21029 (punto ⑤, GO en c.21057). Es STOP de cobro: **esta rama no toca `src/`**. Todo lo que sigue se ha medido o se propone, y no se ha aplicado nada.

## ① De dónde sale el token, camino por camino

`src/modules/billing/app/routes/payMp.routes.ts:65`:

    const accessToken = (charge.merchant as any)?.mpAccessToken || config.MP_ACCESS_TOKEN;

| camino | token que usa |
|---|---|
| `GET /pay/mp/:token`, el cobro no existe | ninguno: 404 |
| `paid` / `expired` | ninguno: redirige a la página de resultado |
| **cualquier otro estado** (`pending`, y también `cancelled` y `failed`) | `merchant.mpAccessToken` → **siempre `undefined`** → `config.MP_ACCESS_TOKEN`, el de la **plataforma** |
| sin `MP_ACCESS_TOKEN` en el entorno | 503 con el texto firmado en c.18285 |
| preferencia ya creada (`intentId` empieza por `mp_pref_`) | no llama a MP: rehace la URL de checkout de una preferencia que se creó con el token de plataforma |
| `POST /webhooks/mp` | `config.MP_ACCESS_TOKEN` **a secas** (`mpWebhook.routes.ts:73`); no hay camino por comercio |

- **La columna no existe ni ha existido nunca.** `prisma/schema.prisma`, bloque `model Merchant`: 80 campos y ninguno se llama `mpAccessToken`. Según `git log -S mpAccessToken -- prisma src`, el único commit que la nombra es `e38534966` (22-may-2026, «Mercado Pago Checkout Pro»), y ese commit no toca `prisma/`. El `as any` lleva ahí desde el primer día, y es lo que deja que `tsc` lo compile.
- **Consecuencia:** la parte izquierda del `||` vale siempre `undefined`, así que el token de la plataforma es el **único** que se puede llegar a usar. No es un caso raro que haga falta forzar: es lo único que hace la ruta.
- **Y aunque la columna existiera, no bastaría.** El webhook consulta el pago con el token de plataforma. Un pago hecho en la cuenta de un comercio no se encontraría desde ahí, y el cobro se quedaría pagado y sin registrar. El arreglo de «token por comercio» tiene dos mitades, no una.
- **Estados:** `/pay/mp` solo mira `paid` y `expired`. Con un cobro `cancelled` o `failed` crea la preferencia igual. `/pay/bizum` (`:184`) sí exige `pending`. Es lectura del código, y **no lo he ejecutado**.

## ② ¿En qué configuración real se usa el token de plataforma?

**En todas las que tengan `MP_ACCESS_TOKEN` puesto.** La ruta no mira nada más:

| lo que podría filtrar | ¿lo mira `/pay/mp`? |
|---|---|
| un flag (`isFlagEnabled`) | **no**. Tampoco hay flag de Mercado Pago en `src/core/flags.ts` |
| `connectStatus` / `stripeAccountId` | **no**. Y `/pay/card` sí lo mira: `cardChargeDecision` (SCRUM-130) contesta `refuse` a un comercio real sin Connect |
| comercio demo (`DEMO_MERCHANT_ID`) | **no** |
| país / `INVOICING_ES_ENABLED` (regla 24) | **no** |
| `charge.payMethods` (lo que el profesional permitió) | **no**. Lo mira el selector de `/pay/invoice`, que no ofrece MP |
| comercio suprimido | **no** hoy; lo añade 1573b (GO de c.21057) en este mismo fichero |

**Cómo se llega a la ruta.** Ninguna página ni ningún mensaje del producto enlaza a `/pay/mp` (0 apariciones en `public/`; solo la construye `paymp_url` en la respuesta de `POST /charges`, que va tras el secreto interno; ya lo midió SCRUM-1449 §2). Pero la ruta es pública y se identifica con el **mismo** `receiptToken` que `/pay/invoice/<token>`, `/pay/card/<token>` y `/recibo/<token>`, que sí llegan al cliente por WhatsApp. Basta con cambiar `invoice` por `mp` en un enlace recibido. Esto es lectura, y **no lo he probado en yaqu.app**.

**No medido:**
- Si `MP_ACCESS_TOKEN` está puesto en producción, staging o dev. Producción no se mira (encargo); en staging y dev no tengo acceso de lectura a Railway desde este árbol. Y la lectura de los `.env` de este árbol, **solo para contar si la línea existía**, la bloqueó el clasificador de permisos de la sesión y no la he sorteado. Desde fuera no se distingue: el 503 solo sale con un `receiptToken` válido, y no tengo ninguno.
- Si Mercado Pago aceptaría una preferencia en EUR con ese token. Depende del país de la cuenta, y no se ha ejecutado contra MP.

**Lo que dicen las reglas.** La 18 y la 23 hablan de **tarjeta** y de **Stripe**: «Tarjeta para clientes reales SOLO con Connect activo…» y «Prohibido procesar pagos de clientes finales en la cuenta Stripe de plataforma: PSP = cuenta conectada del merchant o nada». La segunda frase de la 23 es general: «PSP = cuenta conectada del merchant o nada». Mercado Pago es un PSP, y aquí la cuenta es siempre la de plataforma. Y la 24 cubre cualquier cobro en España con el interruptor en OFF, por cualquier vía. **Que la 23 alcance a MP es mi lectura, no una decisión firmada**: va como pregunta ① abajo.

## ③ Censo: otros campos de `Merchant` que no existen en el esquema

Instrumento: `docs/master/evidencias/SCRUM-1615/censo-campos-merchant.mjs` (AST de TypeScript, `createSourceFile` por fichero, sin Program). Salidas: `salida-con-semilla.txt` y `salida-sin-semilla.txt`, en la misma carpeta.

- **Población:** 339 ficheros `src/**/*.ts`. 80 campos de `Merchant` en el esquema. 409 accesos `R.campo` cuyo receptor se llama `merchant`, más 145 llamadas a métodos de Prisma (`*.merchant.findUnique(…)`…), que se excluyen.
- **Control positivo sembrado:** un fichero fabricado con `(charge.merchant as any).campoSembrado1615`. **Se caza (1).** Con `--sin-semilla` sale **CIEGO, código 2**, y no verde.
- **Cero derivado:** `connectStatus`, 7 accesos, **0** dados por ausentes.
- **Resultado:** 3 accesos fuera del esquema, de 2 campos:
  - `mpAccessToken`: 1, `payMp.routes.ts:65`, con `as any`. **El único real.**
  - `phone`: 2, en la misma línea (`pdf.service.ts:511`). **Falso positivo:** el receptor es `params.merchant`, un DTO con tipo propio (`phone?: string | null`, `:351`) que se rellena con `whatsappPhone` (`lib/invoicing.ts:116,278,382`, `verifactu.service.ts:813,1274`). Ahí `tsc` sí comprueba el tipo. Solo leído: es camino de emisión.
- **Lo que el censo no ve:** un receptor que se llame de otra forma (`m.campo`, `row.campo`), una desestructuración y el acceso con corchetes. El falso positivo de `phone` dice que un receptor llamado `merchant` no siempre es una fila de Prisma.
- **Error mío en la primera pasada:** filtraba los delegados de Prisma por el nombre del cliente (`prisma|tx|db…`) y dejó pasar `prismaClient` y `cliente`. Fueron 5 falsos «ausentes» `findUnique`. Lo vi al leer la salida y ahora el filtro va por el método llamado. La salida comiteada es la de después.

## ④ Propuesta (NO aplicada)

Un único sitio lo arregla: `payMp.routes.ts:65`. Tiene que ir **después de 1573b**, que toca el mismo fichero, o dentro del mismo PR. Diff propuesto, con piezas que ya existen (`DEMO_MERCHANT_ID` lo importa ya `payCard.routes.ts:10`) y con el texto ya firmado (c.18285), sin texto nuevo:

```diff
+import { DEMO_MERCHANT_ID } from '../../../invoicing/domain/emission.service';
 …
-  const accessToken = (charge.merchant as any)?.mpAccessToken || config.MP_ACCESS_TOKEN;
-  if (!accessToken) {
+  // SCRUM-1615 · `mpAccessToken` no es una columna: el token era SIEMPRE el de plataforma. Solo el
+  // comercio demo cobra por la cuenta de plataforma (patrón de cardChargeDecision, SCRUM-130).
+  const accessToken = charge.merchant?.id === DEMO_MERCHANT_ID ? config.MP_ACCESS_TOKEN : '';
+  if (charge.status !== 'pending' || !accessToken) {
     res.setHeader('Content-Type', 'text/html; charset=utf-8');
     return res.status(503).send(avisoMpHtml(MSG_MP_NO_DISPONIBLE));
   }
```

El test lo construye la sesión que reciba el GO: primero en rojo, con un comercio real y `MP_ACCESS_TOKEN` puesto, y la mutación de la casa. El censo de ③ puede pasar a guard (es de J6).

### Para el fundador (✅/❌)

1. ✅/❌ La regla 23 («PSP = cuenta conectada del merchant o nada») **alcanza también a Mercado Pago**, no solo a Stripe.
2. ✅/❌ Con eso, `/pay/mp` **no cobra a ningún comercio salvo el demo**, que sigue en la cuenta de plataforma. El comercio real recibe el 503 con el texto que ya firmaste en c.18285: «Ahora mismo no se puede pagar con Mercado Pago. Contacta con el profesional.» Si es ❌: alternativa **B**, cerrarla también para el demo; o **C**, retirar `/pay/mp` y `/webhooks/mp` hasta F3, que choca con «Mercado Pago se mantiene para F3» (`YAQU_MASTER.md:166`) y es cambio de máster.
3. ✅/❌ De paso, solo cobros `pending`. Un `cancelled` o `failed` recibe el mismo 503 en vez de crear la preferencia.
4. ✅/❌ El token **por comercio** (F3) queda para un ticket aparte. Pide una columna nueva (ALTER, regla 40), guardar un secreto del comercio en la base y que el webhook consulte con ese token. No es un arreglo de una línea.
5. Solo tú puedes mirarlo, en Railway y **por nombre**, sin pegar el valor (regla 9): ¿existe `MP_ACCESS_TOKEN` en producción y en staging? Si no existe, hoy la ruta solo contesta 503 y el riesgo está dormido, pero no cerrado.
