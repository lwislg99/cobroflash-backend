# SCRUM-731 · El descuento global: explicado en el papel, y el `hidden` que APAGA

**Fecha:** 4-sep-2026 · **Carril:** documentos · **Gate:** todo en `npm test`; sin gates de BD

**Medido contra:** `origin/main` = `93ceed21f7fb5d0bebb0a09f37cce84c170e520e` · 2026-09-04T19:35:00Z

⚠️ `main` **se movió mientras se construía** —`13046434` → `93ceed21`, siete commits, entre ellos
SCRUM-607 (S1, precios fuera del albarán)—. Se ha **mergeado DENTRO**, sin conflictos: ese ticket
toca `albaranPdf.service.ts` y `tests/scrum607`, y este no toca ninguno de los dos. La medición de
arriba está re-corrida sobre el árbol ya mezclado.

**Tanda:** 5248 tests, 5159 pass, **1 fail**, 88 skipped — corrida DESPUES del ultimo cambio,
entrada incluida. El fallo **no es de este ticket**: es `SCRUM-176b`, que construye una ruta con
`new URL(import.meta.url).pathname` y por eso da rojo en cualquier checkout cuya ruta lleve un
espacio, y verde en CI. Medido y reportado en `docs/master/SCRUM-602.md`; sigue sin arreglar en `main`.

---

## Las víctimas

**El cliente final**, que es la peor: recibía un presupuesto en PDF con el total **ya rebajado** y
sin ninguna fila que explicara la diferencia. Sumaba las líneas que tenía delante, le daba otra
cosa, y lo firmaba igual.

**El profesional**: veía en el editor un campo de descuento global que debía estar oculto y no lo
estaba, conviviendo con el botón «+ Añadir descuento» que sirve para abrirlo.

Las dos salen de la misma familia: **algo que existe y no llega**. El dato existía
(`Quote.discountGlobalAmount`), las filas existían (`pieDePresupuesto`, SCRUM-594) y el atributo
existía (`hidden`). Lo que fallaba era el último tramo.

---

## PASO 0

### ENTRADA

| defecto | por dónde llega el usuario hoy |
|---|---|
| el papel | `GET /admin/quotes/:id/pdf` — [`quotesAdmin.routes.ts:518`](../../src/modules/system/app/routes/quotesAdmin.routes.ts). Es el endpoint que **regenera el PDF bajo demanda y sobrescribe `quote.pdfUrl`**, así que su salida es la que acaba en manos del cliente |
| la pantalla | el editor de presupuesto, `public/dashboard/js/quotesView.js`, bloque de totales |

### MECANISMO — ya estaba construido entero, las dos veces

| pieza | qué garantizaba ya |
|---|---|
| `pieDePresupuesto` (`presentacionIva.ts:109`) | **las tres filas**: «Suma de líneas», «Descuento», «Descuento global», con el prorrateo y el céntimo que sobra |
| `generateQuotePdf` (`pdf.service.ts:993`) | ya las pinta: `descuentoGlobal: params.discountGlobalAmount ?? null` |
| las otras DOS puertas | ya pasaban el campo |
| `[hidden]` del navegador | ya existe; lo que faltaba era que ganase |

**El trabajo era darle superficie, no rehacerlo.** El arreglo del papel es **una línea**, y no hace
falta microcopy nueva: los tres rótulos son de SCRUM-594, están aprobados y ya se imprimían por las
otras dos puertas. Lo que faltaba era **el dato, no el texto**.

---

## ① EL PAPEL · el censo de puertas

`generateQuotePdf` se llama desde **TRES** sitios. La matriz completa, derivada por AST:

| clave | P1 crear | P2 regenerar con firma | P3 `GET /:id/pdf` |
|---|---|---|---|
| `discountGlobalAmount` | ✔ | ✔ | **🔴 → ✔ (este ticket)** |
| `modoIva` | ✔ | ✔ | **🔴 sigue faltando** |
| `clausulas` · `clausulasExcluidas` | ✔ | ✔ | **🔴 sigue faltando** |
| `signatureData` · `signedAt` | 🔴 | ✔ | ✔ |
| `tiers` | ✔ | 🔴 | ✔ |
| las otras 12 | ✔ | ✔ | ✔ |

`P1 = quotes.routes.ts:254` · `P2 = quotes.routes.ts:607` · `P3 = quotesAdmin.routes.ts:530`

**Se arregla UNA: la del carril.** Las demás quedan en `HUECOS_DECLARADOS`, dentro del test, con
un trinquete que impide que la lista crezca: si mañana falta un campo más, cae y hay que decidir si
se arregla o se declara — pero no puede pasar callando. Y si un hueco declarado desaparece, también
cae: una cuarentena que sobrevive a su causa deja de ser una nota y pasa a ser un permiso.

🔴 **`modoIva` en P3 tiene VÍCTIMA HOY** y va reportado como hallazgo: el profesional elige «IVA no
incluido» (SCRUM-656) y el PDF que se sirve por esa puerta imprime el desglose igual. Es la misma
frase que SCRUM-656 usó para describir su propio defecto: *«un papel equivocado a un cliente, sin
que fallara nada»*.

---

## ② EL `hidden` · imposible, no vigilado

### El censo, DERIVADO del árbol

No es una lista a mano: se sacan por AST las variables que reciben `.hidden = …` y su `className`.
En el editor de presupuesto son **seis**. Medidos en Edge real, con el CSS de producción y **dos
controles**:

| elemento | `display` con `hidden` (ANTES) | ¿se veía? |
|---|---|---|
| `.quote-conceptos` | `flex` | 🔴 sí |
| `.quote-plantillas` | `flex` | 🔴 sí |
| `.quote-line__field.quote-dto-global__campo` (SCRUM-594) | `flex` | 🔴 sí |
| `.btn-ghost.btn-sm` (**dos** botones) | `inline-flex` | 🔴 sí |
| `.field.quote-direccion-obra` (SCRUM-602) | `none` | ✔ no |
| **`<div hidden>` pelado — CONTROL** | `none` | ✔ no |
| **`<button hidden>` pelado — CONTROL** | `none` | ✔ no |

**Cinco de seis.** Los dos controles son lo que hace válida la medición: un elemento sin clase da
`none` en el mismo navegador y la misma pasada, así que el instrumento distingue y esos cinco «sí»
no son un artefacto.

La causa: la regla del navegador para `[hidden]` es de **origen user-agent**, y cualquier
declaración de **autor** con `display` le gana, tenga la especificidad que tenga.

### El arreglo: UNA regla global

```css
[hidden] { display: none !important; }
```

**Y no cinco reglas `.clase[hidden]`.** Arreglar por clase deja el cepo armado para el sexto
elemento que alguien añada — que nacerá roto **y en silencio**, porque el código que lo apaga
(`el.hidden = true`) es correcto. Esta línea lo hace imposible en vez de vigilado, y es además la
regla que traen los `reset` de toda la vida.

### El `!important`, comprobado ANTES de escribirlo

Es necesario —sin él, `.quote-conceptos { display: flex }` le gana por igual especificidad— y es
seguro, medido y no supuesto:

- **Ninguna regla del proyecto enseña a propósito un `[hidden]`**: las dos que existen
  (`.aviso-duplicado[hidden]`, `.quote-direccion-obra[hidden]`) dicen `display: none`, o sea que
  refuerzan esto.
- **Nadie mezcla los dos mecanismos**: censados los **14** elementos que usan `hidden` en los
  **7** ficheros del dashboard, **cero** apagan con `hidden` y enseñan con `style.display`.

### La verificación, en los DOS sentidos y en la misma pasada

| elemento | con `hidden` (DESPUÉS) | **sin `hidden`** |
|---|---|---|
| los seis del editor | `none` ✔ | `flex` / `inline-flex` — **intacto** |
| los dos controles | `none` ✔ | — |

La segunda columna es el control que un `!important` global necesita: **sólo muerde cuando el
atributo está**. La maquetación normal no se toca.

---

## Mutación · seis defectos inyectados, seis cazados

Cada mutación con **post-condición**: cambió el fichero que dice y **sólo** ése; y para las de
TypeScript, que `dist/` —el código que de verdad corre— **se movió**.

| # | defecto inyectado | quién lo caza |
|---|---|---|
| ① | P3 deja de pasar el descuento | el **compilador** (rechaza la clave) **y** dos tests de AST |
| ② | el PDF deja de pintar el pie | «con descuento global, el papel LO EXPLICA» |
| ③ | se borra la regla global | dos tests |
| ④ | se cae el `!important` | dos tests |
| ⑤ | alguien añade una SEXTA regla por clase | el trinquete |
| ⑥ | una clave nueva sin declarar en P3 | el **compilador** y el test de huecos |

Control negativo: sin mutar, cero rojos. Tras restaurar, cero rojos y las huellas vuelven.

### 🔴 El arnés se midió a sí mismo, y falló

La primera versión llamaba a `./node_modules/.bin/tsc` con `shell:true`, que **en Windows no
ejecuta nada**. La mutación ② salió «nadie la caza» — y no era verdad: `dist/` nunca se
reconstruía, así que el test corría contra el código de antes. **Un compilador que no compila
produce exactamente el mismo resultado que un test que no cubre.** De ahí la post-condición sobre
la huella de `dist/`, que es lo que distingue las dos cosas.

Y «no compila» pasó a contarse como **cazada**, no como escapada: el sistema de tipos rechazando la
mutación es el guard más fuerte que hay. Se comprueba igualmente que los tests de AST la vean, para
que la misma mutación escrita en JS no pase sin que nadie la mire.

### 🔴 Y el trinquete se cazó a sí mismo

La primera versión del trinquete de reglas `[hidden]` daba rojo enseñando un trozo de frase
(«…con la misma especificidad o más le gana») donde debía ir un selector: el comentario que explica
la prohibición escribe `[hidden]` en prosa y el extractor lo contaba. Es literalmente el aviso de
`cerebro-yaqu` — *«un guard de TEXTO se caza a sí mismo en el comentario que explica la
prohibición»*. Ahora quita los comentarios antes de mirar, y con suelo: si al quitarlos se fuera
también la regla global, falla.

---

## Microcopy

**Ninguna.** El bloque del descuento en el PDF **no necesita rótulo nuevo**: «Suma de líneas:»,
«Descuento:», «Descuento global:» y «Base imponible:» son de SCRUM-594, están en `main` y ya se
imprimían por las otras dos puertas. Poner un marcador `[PENDIENTE` donde hay copy aprobada la
sustituiría por un provisional, que es peor. **No se ha pintado ningún marcador**, así que el censo
de SCRUM-402 no se mueve — y eso es lo correcto, no un olvido.

---

## Tests

- `tests/scrum731-el-descuento-explicado.test.mjs` — los 9: suelo del censo de puertas, las tres
  puertas con lo que explica el total, el trinquete de huecos declarados, el PDF generado **de
  verdad** con descuento (y el control negativo sin él), que la puerta que sobrescribe `pdfUrl` es
  la que lo pasa, el censo derivado de los `hidden`, la regla global y el trinquete de reglas por
  clase.

---

## Huecos declarados · lo que NO verifiqué

- **No he mirado el PDF con los ojos.** Se comprueba el texto extraído, no la maqueta: si las filas
  salieran solapadas o fuera de la caja, esto seguiría verde.
- **No he medido el editor real en navegador**, sólo los seis elementos reproducidos con sus clases
  y el CSS de producción. Un elemento que reciba su clase en tiempo de ejecución (no por
  `className = "…"` literal) no entra en el censo: son **7 de los 14** del dashboard.
- **No he corrido `npm run guards:visuales`** (los siete guards de navegador) contra este cambio:
  miden la landing, que no comparte `styles.css`, pero no lo he comprobado ejecutándolos.
- **`modoIva`, `clausulas` y `clausulasExcluidas` siguen faltando en P3**: declarados, no
  arreglados.
