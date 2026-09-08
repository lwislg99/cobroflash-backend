# SCRUM-707 · Un estado que el producto no conoce — medición y propuesta

**Medido contra:** `origin/main` = `1bbf60afb9eae547e083e1c716fa97c88306d791` · 2026-09-08T09:40:00+02:00
**Rama:** `scrum-707-estado-no-contemplado`

> ⛔ **Aquí no se cambia el comportamiento.** El encargo pedía medir y proponer, y la opción que
> la medición señala **necesita un rótulo que firma el fundador**. Se propone y se para.

---

## 1 · PASO 0 · sigue vivo, y confirmado sobre el main de hoy

| estado | destinos `undefined` | `cubos[destino].push` |
|---|---|---|
| `pending` (**control positivo**) | 0 / 9 | ✅ va a secundaria |
| `rectificada` | **9 / 9** | 🔴 `TypeError: Cannot read properties of undefined (reading 'push')` |
| `draft` | **9 / 9** | 🔴 ídem |
| `''` (cadena vacía) | **9 / 9** | 🔴 ídem |

La causa está en dos líneas de `patronDetalleAcciones.js`:

```js
const d = accion.destinos[estado];          // :35 — clave que no existe → undefined
if (d !== 'primaria' || !accion.cuando) return d;   // :36 — y lo devuelve tal cual
```

Y explota en los **dos** consumidores, sin red de seguridad alrededor:
`albaranDetailView.js:653` y `invoiceDetailView.js:310`.

## 2 · ¿Es alcanzable? Medido por los dos lados

**Por nuestras escrituras, hoy no.** Barridos 275 ficheros de `src/`, acotando a
`prisma.invoice.*` y `prisma.albaran.*`: se escriben `paid`, `emitido` y `firmado`, **todos
declarados**. Nada de lo que el producto escribe cae fuera del registro.

🔴 **Pero nada lo impide en la base:**

```prisma
status  String  @default("pending")     // Invoice
estado  String  @default("borrador")    // Albaran
```

**Son `String` a secas. El esquema entero tiene CERO enums y ninguna restricción.** La máquina de
estados es una convención del código, no una propiedad del dato — así que un SQL aplicado a mano,
un backfill, una migración o un estado nuevo en el servidor llegan a la pantalla sin filtro.

⚠️ Y la vía del front viejo está **casi** cerrada, no del todo: el service worker ya es
network-first y `/admin/` no se cachea (fue cache-first y congelaba el panel tras cada deploy). Un
JS servido de caché con un backend ya actualizado sigue siendo posible si la petición del script
falla; el API no, porque no se cachea.

**Conclusión de alcance:** el disparador no lo produce nuestro código hoy, y **no hay nada que lo
impida el día que alguien lo escriba**. No es una hipótesis: es una puerta sin cerradura.

## 3 · Las tres opciones, medidas

`scripts/censo-estado-no-contemplado.mjs` — no arregla nada, mide.

### Qué se ofrece hoy en los estados conocidos

| | máximo ofrecido |
|---|---|
| **factura** (9 acciones · `pending` `paid` `annulled` `R1`) | **6** |
| **albarán** (11 acciones · `borrador` `emitido` `firmado`) | **6** |

### 🔴 (a) Caer a un cubo por defecto — **descartada por la medición**

No «esconde el problema»: **ofrece acciones que están OCULTAS EN TODOS los estados conocidos.**

| | se ofrecerían | de ellas, ocultas en TODOS los estados |
|---|---|---|
| factura | **9** (máx. vetado: 6) | **`btnAnular`**, `btnBizum` |
| albarán | **11** (máx. vetado: 6) | `btnFacturar`, `btnConvertirFactura` |

Y entre las que reaparecen están **`btnEmitir`, `btnEnviarFirmar` y `btnFirmarAqui`** del albarán.

> 🔒 Un fallback no es neutral: **abre en el estado que nadie ha vetado justo las acciones que
> alguien decidió ocultar en todos los que sí vetó.** Anular una factura emitida es la regla 29;
> firmar un albarán lo congela. La opción cómoda es la única que puede hacer daño.

### (b) No pintar la fila

**0 acciones.** Segura —no ofrece nada que nadie haya vetado— pero **muda**: el profesional abre el
detalle, no ve ninguna acción, y no puede distinguir «este documento no admite nada» de «el
programa no sabe qué es esto». Y no deja rastro para diagnosticarlo.

### (c) Pintarla diciendo que no se reconoce

**0 acciones + un aviso.** Exactamente igual de segura que (b) —el comportamiento es el mismo— y
además **diagnosticable**: quien lo vea puede decir qué documento y qué estado.

## 4 · Propuesta

**(c), y (b) es su mitad segura.** La diferencia entre las dos **no es el comportamiento** —las dos
ofrecen cero acciones— sino **si se dice o no**. Y esta casa ya tiene la doctrina escrita: un cero
sin explicación se lee como «no hay nada», cuando lo que pasa es «no sé mirar esto».

Concretamente, y en este orden:

1. **`destinoEfectivo` deja de devolver `undefined`.** Un estado no contemplado devuelve `'oculta'`,
   que ya es un destino legítimo de la ley y que los dos consumidores ya saben tratar (`continue` /
   `return`). **Cero acciones, cero crash, y sin tocar ningún cubo.** No necesita rótulo.
2. **La pantalla lo dice**, con el aviso de abajo. **Esto sí necesita firma.**
3. Un guard que fije las dos cosas y que caiga si alguien vuelve a devolver `undefined`.

### ⛔ El rótulo, PROPUESTO — no aplicado

> **No reconocemos el estado de este documento — no podemos ofrecerte acciones aquí.**

Dice **qué pasa** («no lo reconocemos», sin culpar al profesional) y **por qué no hay botones**, que
es la pregunta que se hace al ver una pantalla vacía. No promete arreglo ni pide nada, porque desde
ahí no hay nada que él pueda hacer.

Si prefieres otra redacción, la aplico tal cual la firmes. **Hasta entonces no se toca la pantalla.**

## 5 · Lo que queda dicho para quien decida

* El paso ① —dejar de reventar— **no necesita rótulo** y se puede aplicar en cuanto lo digas.
* La causa de fondo no es la vista: es que **el estado no está acotado en la base**. Acotarlo es
  otro ticket y necesita el orden de la casa (① decisión → ② ALTER → ③ PR).

## ⛔ No tocado

`patronDetalleAcciones.js` · las dos vistas de detalle · `prisma/schema.prisma` · ningún rótulo ·
el camino de emisión.


---

# SCRUM-707b · Aplicado: se oculta y se dice

**Medido contra:** `origin/main` = `f0ec26e86a04a21e9e60b748b4c7c5c2c83bace9` · 2026-09-08T09:13:26+02:00
**Rama:** `scrum-707-estado-no-contemplado`

> El fundador aprobó **(c)** y firmó el rótulo tal cual. Esta entrada continúa la de arriba, que es
> la medición que lo decidió.

---

## 1 · Lo aplicado

**① La ley deja de devolver `undefined`.** `destinoEfectivo` devuelve `'oculta'` — uno de los cinco
DESTINOS, que **los dos consumidores ya trataban** (`continue` en el albarán, `return` en la
factura). No hubo que enseñarles nada, y no necesitaba rótulo.

**② La pantalla lo dice**, con el texto firmado el 8-sep-2026 y registrado en
`docs/microcopy/2026-09-08-SCRUM-707-estado-no-reconocido.md`:

> No reconocemos el estado de este documento — no podemos ofrecerte acciones aquí.

**③ Y distingue los dos casos.** `estadoReconocido(registro, estado)` pregunta a **las propias
acciones**, no a una lista aparte — una lista aparte sería la quinta mantenida a mano de este árbol
y ya sabemos cómo acaban (SCRUM-821).

⚠️ **El aviso NO se dispara por «cero botones».** Una factura `annulled` ofrece dos acciones y
podría ofrecer cero mañana sin que eso signifique que no la entendemos. Si se disparara por lista
vacía saldría en documentos correctos, y en dos días nadie lo leería.

## 2 · Verificación

| | |
|---|---|
| 🔴 **el rojo** | `rectificada`, `draft` y `''` dejan de lanzar en los **dos** consumidores. Revirtiendo la línea del arreglo caen 2 tests |
| ✅ **positivo** | `pending` sigue a secundaria, **0/9 `undefined`**, y ofrece **las mismas seis** |
| ✅ **positivo (2)** | los **siete** estados conocidos ofrecen exactamente lo de antes — **enumerado, no contado** (SCRUM-727) |
| ✅ **negativo** | **cero** acciones con un estado no contemplado, y las **siete vetadas** comprobadas **por nombre**: `btnAnular`, `btnBizum`, `btnFacturar`, `btnConvertirFactura`, `btnEmitir`, `btnEnviarFirmar`, `btnFirmarAqui` |
| ✅ **el aviso** | sale con el estado no reconocido y **no** con `annulled`, que se reconoce y ofrece dos. El caso que separa los dos hechos está fijado con su suelo |

Y la clase del aviso nace **con su regla en la hoja**: una clase pintada sin regla se ve desnuda, y
eso lo caza `scrum666b`.

## 3 · 🔴 Y TENÍA VÍCTIMA: la pantalla del albarán llevaba meses sin montarse por esto

Al correr la tanda, `scrum698` se puso rojo con un cambio que YO no esperaba: **sale
`renderAlbaranDetailView` de la lista de «vistas que necesitan datos para montarse»**.

Medido quitando y poniendo la línea del arreglo:

```
sin el arreglo → Cannot read properties of undefined (reading 'push')
con el arreglo → monta, 23 nodos
```

**Nunca necesitó datos: reventaba.** Sin `alb.estado`, `destinoEfectivo` devolvía `undefined` y
`cubos[undefined].push(...)` lanzaba — el defecto de este ticket, exactamente.

> 🔒 La pantalla llevaba tiempo clasificada como «le faltan datos», que suena a limitación del
> banco, cuando lo que tenía era un defecto de producto. **Una lista de excepciones sin la CAUSA al
> lado convierte un fallo en una característica.**

Y corrige mi propio informe de arriba: dije que el disparador «no lo produce nuestro código hoy».
Es cierto para los estados que ESCRIBIMOS — y falso para el estado AUSENTE, que es el caso que el
banco venía pisando cada día sin que nadie lo leyera como tal.

## 3 · 📌 La puerta sin cerradura — declarada, sin ticket

**No abre ticket, y queda escrito para que no parezca que se ignora.**

`Invoice.status` y `Albaran.estado` son **`String` a secas**, con `@default` y sin restricción:

```prisma
status  String  @default("pending")     // Invoice
estado  String  @default("borrador")    // Albaran
```

**El esquema entero tiene CERO enums.** La máquina de estados de la Parte L es una convención del
código, no una propiedad del dato: un SQL a mano, un backfill o una migración pueden dejar
cualquier cadena ahí.

**Pero no hay víctima.** Barrido el **8-sep-2026** sobre **275 ficheros de `src/`**, acotando a
`prisma.invoice.*` y `prisma.albaran.*`: lo único que el producto escribe es **`paid`**, **`emitido`**
y **`firmado`**, los tres declarados. **Nada de lo que escribimos cae fuera del registro.**

> 🔒 Poner enums en tres bases vivas es el orden ①→②→③ entero. Sin víctima, no se paga por algo
> hipotético — y ahora la pantalla ya no revienta si aparece.

**El día que salga un estado raro, el sitio donde mirar es éste**, y la medición que dice que hoy no
lo producimos lleva fecha y alcance. Si alguien encuentra uno, esta entrada es la que hay que
releer: lo que cambió no es el riesgo, es que apareció la víctima.

## ⛔ No tocado

`prisma/schema.prisma` · el camino de emisión · los registros de acciones (sus tablas siguen
igual) · ningún otro rótulo · ni un `style=` en línea nuevo.
