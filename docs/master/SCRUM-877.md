# SCRUM-877 · Las ocho al mecanismo que ya existía, y un guard para que no haya novena

**Medido contra:** `origin/main` = `a462689ffe80002c697f7bcf6d6b9dc66b7b7f24` · 2026-09-16T12:18:04+01:00

**Carril:** instrumentos · front-back · **Gate:** sin gate — corre en `npm test`

---

## PASO 0 · el defecto, y lo que NO era

SCRUM-863 midió **diez** auto-referencias absolutas a `yaqu.app` en `src/`: **dos** con el respaldo
de la convención y **ocho con el dominio escrito a pelo** — y las ocho **salían al exterior**:
enlace del recibo y enlace de cobro por WhatsApp, pie de **todos** los correos, pie del portal del
cliente.

🔒 **Y el control positivo dijo que no era «no hay convención».** `PUBLIC_BASE_URL` tenía ya **16**
usos en `src/`, `env.ts:211` dice literal que **«es la raíz de TODO enlace que el sistema envía»**, y
`env.ts:208` **valida su forma**. Había convención, y ocho se la saltaban. Eso cambia el arreglo: no
hay que inventar un mecanismo, hay que llevar ocho sitios al que ya existe.

## Los dos controles, y son opuestos — que es lo que hace que valgan

El mismo script, el mismo centinela (`https://centinela-877.invalid`), corrido **antes** y
**después**. Reproducible: `docs/master/evidencias/SCRUM-877/control-877.mjs`.

| | ANTES | DESPUÉS |
|---|---|---|
| literales a pelo en los 5 ficheros | **8** | **0** |
| líneas que derivan de la variable | 1 | 2 |
| **dinámico** — `renderEmailLayout` con la variable cambiada | 3 con `yaqu.app`, **0** con el centinela | **0** con `yaqu.app`, 3 con el centinela |
| veredicto | 🔴 **los enlaces IGNORAN la variable** | ✅ **los enlaces SIGUEN la variable** |

⚠️ **Y va declarado qué mitad es dinámica y qué mitad estática, porque «los ocho salen con el valor
nuevo» sería mentira si sólo he renderizado tres.** `renderEmailLayout` está exportada y es pura →
se le cambia la variable y se lee lo que produce (3 de los 8). Los otros 5 viven en funciones que
envían WhatsApp o en funciones **internas no exportadas** (`wrap` en `lifecycle`, `page` en
`customerPortal`): renderizarlas exigiría exportarlas o inyectarles el emisor — un cambio
**estructural** que este ticket no autoriza. De esos cinco se comprueba por AST que derivan de la
variable y que no queda ni un literal.

## Lo que se cambió: la raíz, y sólo la raíz (regla 30)

Tres de los cinco ficheros **ya importaban `BASE_URL`** (que es `config.PUBLIC_BASE_URL` con nombre
corto, `env.ts:263`), así que se sigue la convención que ya usaban. Dos necesitaron el import.

| fichero | antes | ahora |
|---|---|---|
| `src/integrations/whatsappNotifications.ts:97,105` | `` `https://yaqu.app/recibo/${…}` `` | `` `${BASE_URL}/recibo/${…}` `` |
| `src/modules/billing/domain/invoiceWhatsApp.service.ts:102,110` | `` `https://yaqu.app/pay/invoice/${…}` `` | `` `${BASE_URL}/pay/invoice/${…}` `` |
| `src/modules/messaging/domain/emailLayout.ts:69,70` | `href="https://yaqu.app…"` ×3 | `href="${BASE_URL}…"` |
| `src/modules/messaging/domain/lifecycle.service.ts:61` | `href="https://yaqu.app"` | `href="${config.PUBLIC_BASE_URL}"` |
| `src/modules/system/app/routes/customerPortal.routes.ts:161` | `href="https://yaqu.app"` | `href="${BASE_URL}"` |

**El diff son ocho raíces de URL y dos imports con su comentario. Ni una coma de texto.**

⚠️ **Y una que dejo a propósito:** en `lifecycle.service.ts:61` el **texto visible** del enlace sigue
diciendo `yaqu.app` mientras el `href` ya sigue a la variable. Cambiar ese texto sería cambiar lo que
una persona lee — regla 30 — así que **no se toca y se declara**: si el dominio cambiara algún día,
ese rótulo quedaría viejo. Es decisión del fundador, no mía.

## 🔴 El guard, y por qué su control vive en un BANCO y no en el árbol

**El control positivo se moría de éxito.** El caso que pone rojo a este guard —los ocho a pelo—
**desaparece del árbol el día que entra este PR**. A partir de ahí un control que mirara el
repositorio sólo sabría decir verde, y nadie podría comprobar nunca más que sabe decir rojo.

Así que el criterio se mide contra **fuentes sintéticas congeladas**, con sus respuestas esperadas:

| rama del banco | la forma real que copia | respuesta exigida |
|---|---|---|
| `` `https://yaqu.app/recibo/${t}` `` | `whatsappNotifications.ts:97` antes | **URL** 🔴 |
| `<a href="https://yaqu.app/privacidad">` | `emailLayout.ts:70` antes | **URL** 🔴 |
| `{ url: \`https://yaqu.app/pay/…\` }` | `whatsappNotifications.ts:105` antes | **URL** 🔴 |
| `<a href="${BASE_URL}">https://yaqu.app</a>` | contenido visible | **CONTENIDO** ✅ |
| `config.PUBLIC_BASE_URL \|\| 'https://yaqu.app'` | los dos que no se tocan | **EXENTA** ✅ |

Y **se exige que las respuestas sean al menos tres distintas**: un clasificador que contestara
siempre «url» pasaría los cinco casos y no habría medido nada.

Van **literales, no ficheros**: si el banco viviera en `src/` el propio guard lo cazaría, y si se
creara en disco al correr, **SCRUM-824 lo tumbaría con razón** — la tanda va a concurrencia 12.

### Por qué este guard se puede escribir y el de SCRUM-124 no

🔒 **El discriminador es la POSICIÓN SINTÁCTICA, no el texto.** SCRUM-124 compara
`content.includes` sobre el fichero entero, así que no puede distinguir una llamada de una mención —
y por eso cazó, con razón, un censo que sólo **nombraba** el host de Meta. Aquí se mira el **nodo**:
un literal dentro de `href="…"` es una URL; el mismo texto como contenido de un `<a>` es una palabra
que alguien lee. Hay un test que lo fija: **un comentario que nombra el dominio no cuenta**.

### Las dos condiciones vinculantes del ticket, cumplidas

1. **Absuelve el contenido visible.** Test propio, con la forma real de `lifecycle.service.ts:61`.
   Un rojo injusto no sólo miente: **enseña a desactivar el guard**.
2. **Lista de exentas CERRADA en dos y clavada por identidad** (por fichero, no por línea: una línea
   se mueve en cuanto alguien añade un import encima). Y en las dos direcciones: si una deja de
   estar en el árbol, hay que quitarla y bajar el tope.

### ⚠️ El hueco, declarado y no fingido

Una base compuesta en dos pasos —`const d = 'yaqu' + '.app'`— **no la ve ninguna criba de esta
familia**. Es ofuscación. El precedente de la casa es declararla en vez de aparentar: **SCRUM-176**
dejó escritos sus tres huecos (variables, `eval`, base64) en su propio fichero por esta misma razón.

### La mutación

| mutación | resultado |
|---|---|
| apagar la regla de `href=`/`url:` | **1 rojo** — cae el banco |
| apagar la regla del contenido visible | **2 rojos** — caen el banco y el test de la absolución |

Las dos verificadas **en disco** y restauradas byte a byte.

## ② El censo de `public/` — la cifra, no la suposición

**No amplío la población del guard**: `src/` se queda como primer paso. Pero mi exclusión de
`public/` iba sin número, y **una exclusión sin cifra no es un alcance: es un hueco con buena
redacción**. Aquí está la cifra, sobre **107** ficheros de `public/`:

| clase | n | qué son | ¿se podrían derivar? |
|---|---|---|---|
| **METADATOS** (`og:url`, `og:image`, `twitter:image`) | **4** | `<meta>` de `index.html` | **No**: el estándar las exige absolutas |
| **JSON-LD** (`"url"`, `"logo"`) | **3** | datos estructurados de `index.html` | **No**: schema.org las exige absolutas |
| **enlaces en documentos legales** | **4** | `<a href="https://yaqu.app">yaqu.app</a>` en `privacidad.html` y `terminos.html` | técnicamente sí, pero es **texto legal** |
| **contenido visible** | **0** | — | — |
| ⚠️ indeterminadas | **0** | — | — |
| **total** | **11** | | |

🔴 **Y aquí corrijo mi propio razonamiento de la tanda anterior.** Dije que excluía `public/` porque
«el front puede tener enlaces absolutos a la marca». Medido, **eso era flojo**: no hay ni un enlace
de marca en contenido visible. La razón real es mejor y es otra: **7 de las 11 son metadatos y datos
estructurados, que por especificación tienen que ser absolutos** —una `og:url` relativa es inválida—
y el front es **vanilla sin bundler** (regla 4), así que no hay paso de compilación que pueda
inyectarles una base; derivarlas exigiría JavaScript en tiempo de ejecución, que para un `<meta>`
que lee un rastreador **no sirve de nada**. Las **4** restantes son el nombre del servicio dentro de
la política de privacidad y de los términos: texto legal, regla 30.

**Con eso, la decisión es del fundador:** entra, se queda fuera con motivo escrito, o es su propio
ticket. Mi lectura, para que la contradiga si quiere: **no hay caso** — ninguna de las 11 es de la
clase de las ocho de `src/`.

## ③ La población, declarada

| | |
|---|---|
| `.ts` escaneados por el guard en `src/` | **282** |
| derivaciones de `PUBLIC_BASE_URL`/`BASE_URL` que ve | **112** |
| literales del dominio que encuentra | **2** — y las dos son las **exentas** |
| a pelo | **0** |

**SUELO:** menos de 200 ficheros o menos de 16 derivaciones → **CIEGO**. Un escáner que no encuentra
lo que **sí** está no está mirando, y entonces su «ninguna a pelo» no significa nada.

## Lo que NO se hizo

- **`env.ts` no se toca**: la convención está bien.
- **Los dos con respaldo no se tocan**, y están declarados como exentos.
- **`public/` no se toca** (regla 4: vanilla, sin bundler). Sólo se cuenta.
- **Ni una coma de texto** en los ocho: sólo la raíz de la URL (regla 30).
- Cero dependencias (36) · cero estado o flag de producto (27).

> ⚠️ **Nota de tanda:** `scrum877-…` importa de `tests/_autorreferencias.mjs`, que es un **ayudante y
> no registra tests**, así que el total sube sólo por los **6** tests nuevos de este guard. Los dos
> scripts de `docs/master/evidencias/SCRUM-877/` se ejecutan a mano y no los importa nadie.

---

## ⚠️ Residual que este ticket NO cierra, y conviene que se vea

`assertPublicBaseUrl` (`env.ts:207`) **lanza en producción** si `PUBLIC_BASE_URL` es inválida — pero
el respaldo de `config` es `http://localhost:${PORT}` (`env.ts:8`), que **es una URL válida**. O sea
que «no está puesta en producción» **no lo caza**: pasa la validación y todo enlace saldría a
`localhost`.

Eso **no lo empeora este ticket** —al contrario: 16 usos ya dependían de esa variable, entre ellos
los magic links de acceso y los `success_url`/`cancel_url` de Stripe, así que si no estuviera puesta
ya estaría roto lo que se cobra—, pero ahora dependen **ocho más**. Se declara para que el fundador
decida si quiere su propio ticket.
