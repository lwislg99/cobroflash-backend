# SCRUM-245 · La prohibición de listas blancas, RE-DERIVADA (cierra SCRUM-410 ①)

**Fecha:** 10-ago-2026 · **Carril:** guards · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `7efbaf03c7d2b3af7a0022dfaa678d888eca9a4d` · 2026-08-10T00:20:00+02:00

> El requisito **J0 sigue siendo bueno; lo caducado era el detector.** Éste no se trae de su rama:
> se vuelve a derivar, y los falsos positivos desaparecen **por construcción**, sin una sola
> exención.

## Qué fallaba en el huérfano

Corrido contra `main`, marcaba tres cosas y **ninguna era una violación**: `DEMO_SAFE_NUMBERS` y
`demoSendBlocked` —que son **V0-2 deliberado** (máster U1.1, regla 8)— y `huecosDeLaSerie`, que es
de **series de factura**. Un guard con tres falsos positivos es un guard que alguien silencia.

## Las tres derivaciones, y ninguna es una lista de exenciones

**1 · El ámbito es el CAMINO DE ENVÍO**, derivado de quién importa la puerta única (regla 1: todo
WhatsApp pasa por `integrations/whatsapp.ts`). Son **15 ficheros**. `huecosSerie.ts` vive en
`invoicing`, no importa esa puerta, **y por eso sale solo**: nadie lo exime, es que no participa de
ningún envío. Hay test de que el ámbito sigue derivándose — si algún día alcanza a `invoicing`,
vuelven los falsos positivos y salta.

**2 · Una lista blanca bloquea cuando el destino NO está.** Ése es el discriminante, y es
estructural:

| Forma | Qué es |
|---|---|
| `!allowed.includes(dest)` | **lista BLANCA** — solo pasan los de la lista. **Es J0.** |
| `optedOut.some(c => … === to)` | **lista de BLOQUEO** — el opt-out por consentimiento, legal y obligatorio |

Sin esta distinción el detector marcaba `isWaOptedOut` (bloquear a quien **pidió** no recibir) y
`esProcesoDeTest`. Con ella, salen los dos sin nombrarlos.

**3 · La lista viene de FUERA, no de una constante del módulo.** `!['accept','reject'].includes(x)`
es validación de un enum cerrado; una lista de destinos llega en **tiempo de ejecución**
—parámetro, `config.*` o `process.env.*`—. Esto quita los tres últimos falsos positivos
(`decision`, `status`, `MOTIVOS_ANULACION`) **sin nombrar ninguno**.

## Y lo que hace legítimo al freno del demo también se deriva

`demoSendBlocked` **sí** es una lista blanca de teléfonos. Es legítima porque su decisión **cuelga
del demo**: `if (merchantId !== DEMO_MERCHANT_ID) return false;` **antes** de comparar. Así que la
regla final no exime a nadie:

> **En el camino de envío, una lista blanca de destinos solo puede decidir un bloqueo si esa
> decisión está condicionada al merchant demo.** Una lista que pueda frenar el envío de un
> profesional REAL es la violación, se llame como se llame.

## 🔴 El suelo cazó que mi detector estaba ciego

La primera versión miraba solo el identificador inmediato de la pertenencia y **no encontraba
`demoSendBlocked`**, porque su lista es un local (`const allowed = safeNumbers.map(…)`). Habría
dicho «ninguna lista blanca» sobre un árbol que tiene una — un verde hueco perfecto.

**Lo cazó el suelo**, que exige encontrar la que sí existe. Se resolvió **un salto**: un local
cuenta como «de fuera» si su inicializador nace de un parámetro o de la config.

## Verificado en rojo, por `$?`

| # | Qué se rompe | `$?` |
|---|---|---|
| 1 | Una lista blanca **nueva**, sin gate de demo | **1** — «HA VUELTO UNA LISTA BLANCA» |
| 2 | Al freno del demo se le quita el gate | **1** — cae J0 **y** el control positivo |
| 3 | SUELO: el ámbito deja de derivarse | **1** — «solo 2 ficheros en el camino» |

El **2 es el que más dice**: sin el gate, el freno del demo **pasa a ser exactamente lo que J0
prohíbe** —una lista que puede frenar a un profesional real— y el guard lo llama por su nombre.

## Control positivo

El freno del demo **sigue existiendo y sigue condicionado**. Si mañana alguien le quita el gate «para
simplificar», V0-2 desaparece y el demo puede escribir a cualquiera: eso también salta.

Ficheros: `tests/scrum245-sin-listas-blancas.test.mjs` (5, re-derivado — **no** es el de la rama).
