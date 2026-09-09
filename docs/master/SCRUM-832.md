# SCRUM-832 · el botón «atrás» vuelve a la lista, no te echa de la aplicación

**Medido contra:** `origin/main` = `2119c430ac851bdc2c1ffae10661d2e5444e983e` · 2026-09-09T10:15:12+02:00
**Medido en:** host `DESKTOP-T5MONF5` · rama `scrum-832-atras-vuelve-a-la-lista`
**Carril:** front / dashboard · router

## La víctima

El fontanero con el móvil en la mano. Abre Presupuestos, entra en uno, y pulsa **atrás** —que en
un móvil no es un botón de la app: es EL gesto de navegación. Y se sale de YaQu.

## 🔴 PASO 0 · el enunciado decía otra cosa, y medirlo lo cambió

El encargo decía: «Presupuestos se salta el router y por eso falla el atrás». Antes de escribir
una línea se midió en navegador real, con historial de verdad, a 390 px, las **cinco** listas.

| lista | ¿usa el router? | entradas de historial al abrir la ficha | ¿vuelve el atrás? |
|---|---|---|---|
| Presupuestos | ❌ no | **0** | ❌ |
| Trabajos | ✅ sí | **0** | ❌ |
| Facturas | ✅ sí | **0** | ❌ |
| Albaranes | ✅ sí | **0** | ❌ |
| Clientes (360) | ✅ sí | **0** | ❌ |

**Fallaban las cinco, y cuatro de ellas SÍ usan el router.** La causa no era saltárselo:
`HASH_VIEWS` no contenía ningún `*-detail`, así que el envoltorio de `pushState` caía a
**`replaceState`** y **sustituía** la entrada de la lista. Abrir una ficha no añadía historial:
lo **borraba**. Saltarse el router era un segundo defecto, real pero no la causa.

### El control positivo, que es lo que hace que ese «0» signifique algo

Navegar entre **dos listas** (Presupuestos → Facturas) sí creaba **1 entrada** y el atrás sí
volvía. El instrumento ve historial cuando lo hay; el cero de arriba es del sistema, no de la sonda.

La nota que dejaba los `*-detail` fuera de `HASH_VIEWS` tenía razón en su motivo —«necesitan un id
que el hash no lleva»—. El arreglo no era meterlos en la lista: era **darle el id al hash**.

## Las tres decisiones del fundador, ejecutadas

### ① La URL: `#quotes-detail/123`

El id como **sufijo de la clave de vista que ya existe**. Aditivo: no se renombra ninguna clave,
el router sólo aprende a **partir por la primera barra**. Las cinco fichas quedan declaradas en un
único sitio, `DETALLES`, con su clave de opción, su lista y su aviso.

### ② Un id que ya no existe → **vuelve a la LISTA con aviso**, no a una página de error

Cinco textos, firmados el 9-sep-2026 en
`docs/microcopy/2026-09-09-SCRUM-832-la-ficha-que-ya-no-esta.md`:

> Ese presupuesto ya no existe. · Ese trabajo ya no existe. · Esa factura ya no existe. ·
> Ese albarán ya no existe. · Ese cliente ya no existe.

### ③ 🔒 Un deep-link a la ficha de OTRO merchant → **exactamente lo mismo que el ②**

Mismo destino y mismo texto, carácter por carácter.

> «Dos respuestas distintas a "no existe" y "no es tuyo" convierten la lista de ids en un
> directorio de la competencia.»

Se consigue por **mecanismo, no por disciplina**: el `catch` de la petición **no lee la variable
del error**. Si no la mira, no puede ramificar por el motivo, y las dos respuestas no pueden
divergir ni por descuido.

## El control que decide: 404 y 403 son INDISTINGUIBLES

Corrido en navegador real, no razonado:

```
404 → hash #quotes-list · aviso ["Ese presupuesto ya no existe."]
403 → hash #quotes-list · aviso ["Ese presupuesto ya no existe."]
✅ el TEXTO es idéntico   ✅ el DESTINO es idéntico   ✅ y el destino es la LISTA
```

## DESPUÉS · las cinco vuelven

| lista | hash de la ficha | entradas nuevas | ¿vuelve el atrás? |
|---|---|---|---|
| Presupuestos | `#quotes-detail/1` | **1** | ✅ |
| Trabajos | `#jobs-detail/1` | **1** | ✅ |
| Facturas | `#invoice-detail/1` | **1** | ✅ |
| Albaranes | `#albaran-detail/1` | **1** | ✅ |
| Clientes | `#customer-360/3` | **1** | ✅ |

## Lo que se tocó

- **`public/dashboard/js/app.js`**
  - `DETALLES` — las cinco fichas en un sitio: clave de opción, lista de vuelta, ruta de
    comprobación y aviso firmado.
  - `viewFromHash()` parte por la **primera** barra; `hashDe()` compone `#vista/id`.
  - `abrirFichaDesdeHash()` comprueba el id **antes** de pintar; si falla, lista + aviso +
    `replaceState` al hash de la lista (para que el atrás no te devuelva al id muerto).
  - El envoltorio de `pushState` ahora **apila** las fichas: `pushState` si la vista es conocida y
    el hash cambia, `replaceState` si no.
  - `hashchange` y el **arranque** enrutan las fichas: `#quotes-detail/123` pegado en la barra ya
    no cae en el `default:` → Inicio.
  - 🔴 **Defecto encontrado de camino:** `customerId360` lo **leía** `case 'customer-360'` pero no
    lo **escribía** nadie en la copia de opciones de `renderView`. Funcionaba por costumbre (quien
    llamaba pasaba el objeto entero), no por mecanismo. Ahora se copia como los otros cuatro.
- **`public/dashboard/js/quotesListView.js`** — `openDetail` era la única de las cinco que pintaba
  el título a mano y llamaba a `renderQuoteDetailView(...)` directamente. Ahora pasa por el router,
  como sus cuatro hermanas.

### 🔴 Y mandarla por el router NO era gratis: el título

Parecía una línea por cinco. Medido en navegador, no lo era:

| | rótulo de arriba al abrir el presupuesto 1 |
|---|---|
| camino viejo (título a mano) | `Presupuesto #N-1` |
| por el router, sin arreglar | **`Presupuestos`** — el plural, en la ficha de uno |
| por el router, arreglado | `Presupuesto #N-1` |

La causa no se ve leyendo el router. `quotesDetailView.js` corrige el título al **número real** del
presupuesto —que no es el id— **sólo si el título ya empieza por «Presupuesto #»** (su propia
regex). Ese era el contrato: quien navega escribe el rótulo provisional con el id, y la ficha lo
corrige al cargar. El camino viejo lo cumplía **por casualidad**, porque escribía el título a mano;
el router ponía `L.quotePlural` y la corrección no llegaba a ocurrir nunca.

Arreglado en el `case 'quotes-detail'`, con el mismo literal que la ficha sabe reconocer. Y con
test propio, que **saca el prefijo de la regex de `quotesDetailView.js`** en vez de escribirlo a
mano: si alguien la cambia allí, el test cambia con ella en lugar de defender una cadena muerta.

## Un guard de otro ticket tuvo que aprender la premisa nueva

`tests/scrum819-el-menu-deja-rastro.test.mjs` exigía `actual !== view` y decía que las fichas «no
se pueden restaurar desde el hash porque necesitan un id que el hash no lleva». **Ya lo lleva.** La
propiedad que protegía no ha cambiado —no se apila lo que el router no sabría volver a pintar, ni
navegar al sitio donde ya estás—; lo que cambió es cuánto entra dentro de ella. Se reescribió:
ahora exige que las fichas **sí** se apilen (`DETALLES[view]`) y compara el destino **entero**, con
id, para que ir del presupuesto 7 al 9 apile y pulsar dos veces el mismo botón no.

## Lo que vigila

`tests/scrum832-atras-vuelve-a-la-lista.test.mjs` — 6 tests:

1. **SUELO**: encuentra las cinco fichas en `DETALLES`. Si `DETALLES` cambia de forma, esto se
   pone rojo en vez de dejar cinco verdes vacíos debajo.
2. Cada ficha vuelve a una lista que es un `case` **real** del router (volver a una vista que no
   existe cae en `default:` → Inicio, que es el defecto de SCRUM-727).
3. **Regla 30**: los cinco avisos están firmados, uno a uno, con su propio suelo.
4. 🔒 El `catch` **no lee el error** — la propiedad, no una proxy.
5. 🔒 **CORRIDO**: se ejecutan los dos fallos y se comparan las **dos salidas**, texto y destino.
6. El hash se parte por la primera barra y ninguna de las cinco claves se ha renombrado.

### El test se probó EN ROJO

Inyectando la fuga exacta que el ticket prohíbe:
`showToast(_e && _e.status === 403 ? 'No es tuyo.' : d.aviso, 'warn')` → cae. Revertido → verde.

### 🔴 Y dos veces me equivoqué de propiedad, y queda escrito

- ① «un solo `catch`» → **proxy**. Se puso roja con la función correcta: el segundo `catch`
  protege un `replaceState` del historial y no ramifica nada del recurso.
- ② «el `catch` no contiene `if`» → **proxy también**. Roja por `if (typeof showToast === …)`,
  que es una guarda de existencia.
- ③ La propiedad de verdad: **el `catch` no lee el error**.

## El otro camino de entrada, también medido

Tres sitios no pasan opciones: **búsqueda global**, **Cobros** y la ficha del cliente asignan
`window.appState.quoteId` y llaman a `renderAppView('quotes-detail')` a secas. `hashDe` tiene una
rama para eso, y una rama sin medir es una suposición:

```
hash de la ficha : #quotes-detail/2      entradas nuevas : 1      tras ATRÁS : #quotes-list
✅ el id sale del estado y el atrás vuelve a la lista
```

## 📌 Hallazgo de paso, medido y NO arreglado aquí (regla 37)

Con la ficha abierta, el menú marca la lista de la que vienes. Medido en las cinco:

| ficha | botón del menú marcado |
|---|---|
| `quotes-detail` | Presupuestos |
| `jobs-detail` | Trabajos |
| `invoice-detail` | Facturas |
| `albaran-detail` | Albaranes |
| `customer-360` | **(ninguno)** |

`menuView` traduce cuatro fichas a su lista y **se deja Clientes**. Es de antes de este ticket
—no lo causa el router nuevo— y **no bloquea nada**: por eso se reporta y no se arregla de paso.
Cabría en una línea el día que se abra.

## Lo que NO entra, y por qué

**«Volver con los filtros como estaban»** no sale gratis: al volver, el buscador y el estado se
pierden (`"Ruiz"` → `""`, `accepted` → `all`, medido). Guardarlos pide decidir qué filtros, dónde
y para cuántas listas. Declarado con su medición en `docs/mapa-huecos-sin-automatizar.md`.
