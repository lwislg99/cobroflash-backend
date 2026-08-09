# SCRUM-410 · Los tres guards pendientes de SCRUM-391: dos se retiran, uno se re-deriva

**Fecha:** 9-ago-2026 · **Carril:** guards · **Gate:** sin gate
**Medido contra:** `origin/main` = `227657b227e1223d3e4f1b6f6306533c76fb8213` · 2026-08-09T22:15:00+02:00

> **ENTREGA PARCIAL Y DECLARADA.** Dos de los tres cierran con veredicto firme **y no construyen
> nada**: estaban superados. El tercero (245) necesita re-derivarse y **no se ha hecho** — su
> derivación queda medida abajo para que el siguiente turno arranque de ahí, no de cero.

## `scrum224-sw-revalida` → **SE RETIRA. Superado por SCRUM-274.**

Corrido contra main: **2 de 3 fallan**. Pero el mecanismo no falta — **la premisa del guard ya no
se sostiene**.

El guard exige `fetch(req, { cache: 'no-cache' })` porque «con las cabeceras de prod
(`max-age=14400`) un `fetch(req)` a secas sirve el estático RANCIO hasta 4 h». Medido en main hoy:

| Qué se sirve | Cabecera |
|---|---|
| El HTML del dashboard | **`no-store`** (`app.ts:220,266`), con motivo escrito: «un HTML cacheado con un sello viejo es PEOR que no sellar» |
| Estático **con** huella | caché larga — y **la rancidez es imposible por construcción**: un build nuevo cambia la URL |
| Estático **sin** huella coincidente | default de `express.static` (`max-age=0`) |

**Ya no hay ningún estático servido con 4 h de caché.** SCRUM-274 lo resolvió por una vía mejor
—huellas selladas por el servidor al arrancar, con su propio guard
(`scrum274-huella-estaticos`)— que además **no paga la ida y vuelta de revalidación** que pedía el
huérfano. Traerlo hoy sería exigir un mecanismo cuyo problema ya no existe.

Convierte mi «probablemente entra, sin confirmar» en **retirado, confirmado**.

## `scrum172-tenencia-nullable` → **SE RETIRA. Ya está en main con otro nombre.**

Se midió primero lo que pedía el encargo —si **SCRUM-348** lo cubría— y **no lo cubre**: vigilan
fallos distintos. 348 mira que el `where` de una lectura filtre de verdad (fuga de datos ajenos);
172 mira que borrar un merchant no deje **filas huérfanas** con `merchantId = null`. Descartado eso,
apareció lo que sí lo cubre:

**`tests/scrum172-cobertura-tenancy.test.mjs` ya está en main**, es del mismo ticket, y **cubre
exactamente el caso nullable**: deriva los nullables del schema y exige que cada uno tenga su
barrido propio documentado, con el mensaje «si aparece otro modelo nullable, es la MISMA clase de
agujero, no un caso».

Y el riesgo, medido: **un solo modelo** tiene `merchantId` nullable (`BotSession`, 1 de 21), y
`borradoMerchant.ts:88` **lo declara** —barrido por teléfono, SCRUM-174— y **falla cerrado** si no
hay teléfonos.

**`TENENCIA_NULLABLE_CUBIERTA` no se construye.** Era alcance nuevo para un hueco que ya está
tapado, y por un mecanismo mejor que una lista: la derivación del schema.

## `scrum245-sin-listas-blancas` → **PENDIENTE. La derivación, medida**

**No entra como está**: señala `DEMO_SAFE_NUMBERS` y `demoSendBlocked` —que son **V0-2 deliberado**
(máster U1.1, regla 8)— y `huecosDeLaSerie`, que es de **series de factura**: falso positivo puro.
El requisito **J0 sigue siendo bueno**; lo que está caducado es el detector.

Lo que hay que derivar, y **es visible en el código** (no hace falta ninguna excepción escrita):

1. **Qué hace legítima a la lista del demo:** `whatsappPolicy.ts` importa `DEMO_MERCHANT_ID` y la
   decisión de bloquear cuelga de esa comparación. O sea: *una lista de destinos solo puede decidir
   un bloqueo si esa decisión está condicionada al merchant demo*. Una lista que pueda frenar el
   envío de un profesional real **es** la violación. Eso se comprueba estructuralmente — no por
   nombre y sin allowlist.
2. **Cómo desaparece el falso positivo sin nombrarlo:** acotando el detector al **camino de envío
   de WhatsApp**, en vez de a todo `src/`. `huecosDeLaSerie` vive en `invoicing` y no participa de
   ningún envío, así que sale por construcción y no por una exención.

**No se ha construido**, a propósito: hoy ya se vio lo que pasa cuando un detector se escribe con
prisa —el de SCRUM-391 fabricó tres falsos positivos con mi propia documentación— y un guard que da
falsos positivos es un guard que alguien acaba silenciando.

## Suelo

El encargo pedía: «si el detector no consigue correr un guard, FALLA — *pasa* y *no llegó a
ejecutarse* son el mismo verde». Aquí se cumplió leyendo el `$?` de cada corrida: 224 dio **1** (y
por eso se investigó, en vez de darlo por bueno), y las dos retiradas **no dejan ningún fichero de
test en el árbol**, así que no hay nada que pueda pasar en vacío.

Ficheros: ninguno de código. Este ticket **retira dos guards y no construye nada** — su entregable
es el veredicto medido.
