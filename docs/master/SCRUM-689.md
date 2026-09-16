# SCRUM-689 · Las pestañas de clientes estaban sin CSS

**Fecha:** 2-sep-2026 · **Carril:** UI del listado de clientes · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `f0d5cba8ba7d8dacfce52f5506d841e7484075df` · 2026-09-02T19:01:08Z

> Defecto **en producción**, no una regresión que evitar. Entró con el PR #874 (`ac69385e`).

---

## 1 · PASO 0

### ENTRADA

**Sí la hay, y un profesional la está viendo hoy:**

`public/dashboard/index.html` → menú **Clientes** (`data-view="customers"`) → `customersView.js`,
que pinta la barra en las **líneas 93 y 97**:

```js
const pestanas = createElement("div", "customers-tabs");   // la barra
b.className = "customers-tab";                              // cada pestaña
b.setAttribute("aria-pressed", String(p.id === pestanaActiva));
```

### MECANISMO · el marcado existe, el CSS no existía

**Medido sobre el `main` de hoy** (`2aeb71c0`, no sobre la medición de otra sesión, que era la
premisa que se me pidió comprobar): `.customers-tabs` y `.customers-tab` aparecen **sólo** en
`customersView.js`. **Cero reglas** en todo `public/`. La premisa se sostenía.

Y una pieza que **ya estaba y no había que rehacer**: el estado activo viaja en `aria-pressed`,
puesto para el lector de pantalla. **El CSS puede colgarse de ahí sin tocar una línea de JS** —
que es lo que pedía el carril («no se toca la lógica del filtro»).

---

## 2 · Qué se construyó, y por qué así

### No se inventa un componente: se hereda el que ya existe

En el sistema ya vivía `.segmented` — el control «uno de N» de los switches Producto|Servicio y
Empresa|Persona. Las pestañas Todos|Empresas|Personas **son ese mismo gesto**. Así que se hereda su
lenguaje: mismos tokens, mismos radios, mismo objetivo táctil, misma forma de marcar el activo.

**No se reutiliza el selector tal cual** porque `.segmented` son radios dentro de un `<fieldset>` y
esto son `<button>` con `aria-pressed`; el marcado no es de este carril. Lo que se comparte es el
lenguaje, no la clase. Un segundo dialecto visual para el mismo gesto es lo que convierte un design
system en una colección de excepciones.

---

## 3 · Lo medido EN NAVEGADOR, que es lo que faltaba

La sesión anterior midió en caracteres porque su navegador no levantaba. **El mío sí**: se sirvió
el `tokens.css` y el `styles.css` reales con el marcado real a **360 px**.

| | copy **aprobada** | copy de **hoy** (con marcador) |
| --- | --- | --- |
| anchos | **106 / 106 / 106** px | 266 / 288 / 285 px |
| alto | **44** px | **44** px |
| ¿el texto se solapa? | no | **no** |
| ¿desborda la barra? | no | **sí, por dentro** (scroll interno) |
| **¿la PÁGINA scrollea en horizontal?** | **NO** | **NO** |

Contraste, calculado sobre los colores computados:

| | ratio | AA pide |
| --- | :-: | :-: |
| texto activo sobre su fondo | **17,52:1** | 4,5 |
| texto inactivo sobre la barra | **4,51:1** | 4,5 |
| **fondo del activo contra la barra** | **1,07:1** | — |

### 🔴 Dos cosas que sólo se vieron midiendo, y las dos cambiaron el CSS

**① El fondo del activo es casi invisible: 1,07:1.** `--surface` (#ffffff) sobre `--bg` (#f6f7f5)
son prácticamente el mismo color. La pastilla blanca **no es una señal fiable por sí sola**, y
`.segmented` —de quien se hereda— arrastra la misma debilidad. El carril exigía distinguir el
activo «sin depender sólo del tono», así que se añaden **borde** (forma) y **`--shadow-md`**
(Elevado): cuatro señales, y dos de ellas se ven sin distinguir un color. El borde se reserva en
todas con `transparent` — si sólo lo llevara la activa, la pastilla daría un salto de 2 px al
seleccionarla (medido después: **salto 0**).

**② Con `min-width: 0` los rótulos largos APLASTABAN los botones y el texto se solapaba con el de
al lado.** Hoy cada pestaña sale como `[PENDIENTE microcopy oficial] Empresas` — 37 caracteres —
porque su copy aún no está aplicada. **Lo destapó una captura, no el CSS**: los tests pasaban en
verde con un control ilegible, que se veía *peor* que sin estilar. Se corrige con
`flex: 1 1 0` + `min-width: max-content`: reparten a partes iguales cuando caben, y cuando no,
la barra scrollea **por dentro** y cada rótulo se lee entero.

> Es la misma lección de esta tarde por tercera vez: **el instrumento equivocado da el veredicto
> equivocado**. Un censo de CSS no puede ver que un texto se pisa con otro.

---

## 4 · Evidencia

`tests/scrum689-pestanas-clientes-con-css.test.mjs` — 11 pruebas:

* **SUELO**: el censo encuentra las hojas que el índice carga de verdad y lee bytes. Si no, CIEGO —
  «no hay reglas» y «no supe leerlas» son el mismo cero, y este ticket nace de un cero.
* **CONTROL POSITIVO**: `.segmented-option`, que **ya** estaba estilada, sale también en el censo.
  Sin él, un cero no distinguiría «no hay CSS» de «no sé leer CSS».
* Las **dos puntas atadas**: el marcado usa las clases *y* las clases tienen reglas. Si alguien
  renombra la clase en el JS, el CSS queda huérfano y esto cae.
* AB6: 44 px de objetivo táctil · foco con `--ring` · las cuatro señales del activo.
* Móvil: `overflow-x` en la barra y `min-width: max-content` + `nowrap` en la pestaña.
* **Cero colores literales**: ni un hex ni un `rgb()`. Los tokens son la única fuente.
* **NEGATIVOS**: un **comentario** que nombra la clase no cuenta como regla (si contara, borrar el
  CSS y dejar la explicación pasaría en verde) · y `.customers-tab` **no** casa con
  `.customers-tabs`, que es prefijo suyo — si las confundiera, estilar sólo la barra daría por
  bueno un control sin pestañas.

**Verde:** `npm test` completo después del último cambio — **4645 tests · 4562 pass · 0 fail · 83 skipped**. `guards:entrada` verde, worktree limpio, `main` mezclado dentro, Prisma regenerado.

---

## 5 · Huecos declarados

* **No se ha visto en un dispositivo real**, ni en la matriz Android/iPhone/tablet de AB6. La
  medición es de un Chromium a 360 px con el CSS y el marcado reales — mejor que contar caracteres,
  y no lo mismo que un teléfono en la mano.
* **No se ha comprobado el estado `:hover` en táctil**, donde no existe.
* **La copy sigue con marcador**: `filtroClientes.js:36` mantiene
  `var MARCADOR = '[PENDIENTE microcopy oficial]'`, así que los seis rótulos aprobados **no están
  aplicados en `main`**. No es este carril («no la cambies, no la re-marques»), pero es la razón de
  que la barra necesite scroll interno hoy y no lo necesite mañana.
* **No se ha medido la vista completa de clientes**, sólo la barra: no se rediseña la lista.

---

## 6 · Lo que se comprobó, no se supuso

* **F3 · Editar · Portal · Historial siguen por fila**: `customersView.js` líneas 648, 653 y 669.
* **Las columnas no se tocan.** Orden actual medido: `ID · Nombre · Teléfono · Email · Notas ·
  Alta`. ⚠️ El encargo decía «el teléfono sigue siendo la segunda columna» y **es la tercera** —
  segunda si no se cuenta el `ID`. No se ha modificado ninguna; se deja dicho por si la premisa
  importaba.

---

## Tests que introduce esta entrada

* `tests/scrum689-pestanas-clientes-con-css.test.mjs` — 11 pruebas (suelo, control positivo,
  marcado ↔ CSS, AB6, móvil, tokens y dos negativos).
