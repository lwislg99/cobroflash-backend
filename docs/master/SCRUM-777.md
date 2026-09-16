# SCRUM-777 · Abrir una ficha de cliente ya no mata la tecla «N»

**Fecha:** 6-sep-2026 · **Carril:** atajo de teclado del panel (producto) · **Gate:** sin gate — corre en `npm test`
**Medido contra:** `origin/main` = `16bd95731883a6c84ceb57820a493c8fe1500f6d` · 2026-09-06T11:26:03+01:00
**Tanda:** 5609 tests, 5521 pass, 0 fail, 88 skipped (salida 0)

---

## El defecto

`atajoNuevo.sePuedeDisparar` miraba la **PRESENCIA** de un `.modal-overlay`, no su **VISIBILIDAD**.
Y `customersView` cerraba su modal con `style.display = "none"` dejándolo colgado del `body` para
reutilizarlo (`:1208` lo cuelga, `:1261` lo reutiliza, `:1346` lo escondía).

⇒ **Abrir y cerrar una ficha de cliente desactivaba el atajo en TODAS las pantallas hasta
recargar.** Sin error, sin síntoma, y con un gesto que el profesional hace veinte veces al día.

> 🔴 **Ni SCRUM-599 ni SCRUM-768 lo vieron, y no fue mala suerte:** los dos ejercitaban la
> condición con un **objeto de mentira** (`{key:'n', …}`) y un documento de mentira. Apareció la
> primera vez que se pulsaron **teclas de verdad**, en SCRUM-769. Eso vale más que el arreglo.

## El rojo, con teclas reales en Edge

Once casos, con el residuo reproducido **derivado del propio `customersView`** (el banco lee su
fuente y se declara CIEGO si esas líneas ya no están):

```
✔ ① la «n» a secas                               abre=true  (esperado true)
✔ ② la «N» mayúscula                             abre=true  (esperado true)
✔ ③ otra tecla (la «m»)                          abre=false (esperado false)
✔ ④ foco en un <input>                           abre=false (esperado false)
✔ ⑤ foco en un <textarea>                        abre=false (esperado false)
✔ ⑥ foco en un contenteditable                   abre=false (esperado false)
✔ ⑦ con un modal DE VERDAD abierto               abre=false (esperado false)
✔ ⑧ Ctrl+N                                       abre=false (esperado false)
✔ ⑨ Alt+N                                        abre=false (esperado false)
🔴 ⑩ tras ABRIR y CERRAR la ficha de cliente      abre=false (esperado true)
✔ ⑪ con la ficha de cliente ABIERTA              abre=false (esperado false)
```

Y sobre la **vista real** montada en el banco —abrir con su botón, cerrar con «Cancelar»—:

```
② con la ficha abierta      .modal-overlay: 1 · display="flex"
③ DESPUÉS de cerrarla       .modal-overlay: 1 · display="none"
④ sePuedeDisparar → false   🔴 (la «N» está MUERTA)
```

## (a) La pieza: visibilidad, no presencia — y qué cuenta como visible

El criterio **no se ha elegido por intuición**. Censo por AST sobre `public/dashboard/js`:

| técnica para esconder un overlay | apariciones |
|---|---|
| `style.display = "none"` | **3 ficheros** (`customersView`, `productsView`, `providersView`) |
| `style.visibility` | **0** |
| `style.opacity` sobre un overlay | **0** (se usa en botones, etiquetas y el foco del tutorial) |
| atributo `hidden` / `aria-hidden` sobre un overlay | **0** (`aria-hidden` sólo en iconos decorativos y esqueletos) |

Así que el criterio es, en este orden:

1. **`style.display === "none"` en línea** — la única técnica que la casa usa, y la única legible
   sin motor de maquetado (por eso también se mide en el banco de vistas).
2. **Estilo COMPUTADO**, si hay ventana de verdad: `display:none` y `visibility:hidden`. Es la
   rama que ve a los **ancestros**.
3. **Que ocupe sitio**: una caja de 0×0 no tapa nada.
4. Si no se pudo medir nada, **cuenta como delante** — el mismo *fail-closed* que la función ya
   tenía cuando no le pasaban documento.

### 🔴 ② y ③ van JUNTAS, y me costó un rojo aprenderlo

La primera versión miraba la caja **siempre**. En un DOM sin maquetado —el banco— todo mide 0×0,
así que un modal **ABIERTO** salía como escondido y la «N» disparaba encima de él. Lo cazó el
control que existe justo para eso:

```
🔴 CON LA FICHA ABIERTA LA «N» DISPARA. El arreglo se ha pasado de frenada.
```

Ahora la caja sólo se mira cuando hay `getComputedStyle` detrás: **una caja de 0×0 sólo significa
«no ocupa sitio» donde hay quien lo calcule.**

### Lo que el criterio NO mira, con su medición

* ⛔ **`opacity`.** `.modal-overlay` lleva `animation: fade-in .15s` y `@keyframes fade-in` arranca
  en `opacity: 0`: la «N» dispararía **durante los primeros fotogramas de un modal que se abre de
  verdad**. Y un overlay transparente se sigue comiendo los clics — está delante aunque no se vea.
* ⛔ **`offsetParent === null`.** `.modal-overlay` es `position: fixed`, así que es `null`
  **también abierto**: daría por ausentes a todos los modales.

Las dos exclusiones están atadas por un test que las mira **por AST**, porque los comentarios que
las explican nombran las dos palabras y un `includes` se cazaría a sí mismo (SCRUM-203).

Y se recorren **todos** los candidatos, no sólo el primero: con un overlay escondido delante de uno
visible, `querySelector` devolvía justo el que no importaba.

## (b) Clientes descuelga su modal — y hacía falta igual

La inclinación del asesor era que hicieran falta las dos cosas. **Medido: sí, y por un motivo que
no había sobre la mesa.**

`styles.css:2552` — `body:has(.modal-overlay) #tut-help-btn { display: none !important; }`

`:has()` es **estructural**: mira si el nodo existe, no si se ve. Medido en Edge:

| estado del `body` | `#tut-help-btn` |
|---|---|
| sin overlay | `display: inline-block` · caja 9,98 × 21 |
| **con un overlay ESCONDIDO** | **`display: none` · caja 0 × 0** |
| tras borrar el overlay | `display: inline-block` · caja 9,98 × 21 (control positivo) |

⇒ **el residuo también apagaba el botón flotante de ayuda, para siempre.** Eso **no pasa por la
pieza**: (a) no lo arreglaba. Por eso (b) entra.

**Se descuelga, no se destruye.** `openModal` reutiliza el mismo nodo (`if (!modalBackdrop)
buildModal()`), con sus campos y sus oyentes ya cableados; reconstruirlo en cada apertura sería
otro ciclo de vida. `closeModal` hace `remove()` —que sólo lo separa del árbol— y `openModal`
vuelve a colgarlo si no tiene padre. Verificado que **reabre y que es el MISMO nodo**:

```
⑤ REABRO la ficha:  .modal-overlay: 1 · display="flex"
   ¿es el MISMO nodo que la primera vez? sí (se reutiliza)
   y cerrada otra vez: .modal-overlay: 0
```

## El censo — quién más se cierra escondiéndose

Por AST, derivado del `SELECTOR_MODAL` de la pieza:

| resultado | ficheros |
|---|---|
| **ESCONDEN** | **2** · `productsView.js`, `providersView.js` |
| borran | 16 · `aiQuoteAssistant`, `albaranDesdePresupuestoModal`, `api`, `csvImport`, `customerDetailView`, **`customersView`** (desde este ticket), `homeView`, `invoiceDetailView`, `jobDetailView`, `jobNuevoModal`, `nuevaFacturaModal`, `plansView`, `quotesView`, `settingsView`, `teamView`, `templatesView` |
| **CIEGOS** | 1 · `expensesView.js` |

**Control positivo:** el censo encontraba `customersView.js` antes del arreglo y lo encuentra fuera
después; y clasifica bien a `jobNuevoModal.js` como «borra» (control negativo).

**Los dos límites, declarados y medidos a mano:**

* `expensesView.js` crea el overlay por clase pero lo cierra por **id**
  (`getElementById('exp-modal')?.remove()`). El censo ve el overlay y no ve el cierre → **CIEGO**,
  no «limpio». Medido a mano: **borra**.
* `onboardingView.js` **ni siquiera entra en la población**: su overlay se identifica por `id`
  (`#onboarding-backdrop`) y el censo filtra por clase. Medido a mano: **borra**
  (`backdrop.remove()`).

### ⚠️ Productos y Proveedores siguen escondiendo, y NO se han tocado

Los dos cuelgan su modal de edición del `body` **ya escondido** (`productsView.js:314`,
`providersView.js:125`) y lo cierran con `display:none` (`:414`, `:180`). Medido: **montar la
pantalla no deja residuo** —el modal se construye al editar—, así que el defecto sólo aparece
después de editar un producto o un proveedor una vez.

**Para el atajo ya da igual: (a) lo cubre.** Lo que sigue vivo en esos dos es la **segunda
víctima**: tras editar, el botón de ayuda se apaga. Está fuera del alcance de hoy por decisión
explícita del encargo, y queda vigilado por el censo.

## Huecos declarados

1. **La «N» sigue sin pulsarse sobre la pantalla real con sesión.** El manejador vive en
   `initApp()`, que pide `/admin/me` y redirige sin sesión. Lo que sí se pulsa de verdad es la
   pieza, con el residuo reproducido del propio `customersView` y con suelo que se declara ciego
   si esas líneas cambian.
2. **La segunda víctima (`#tut-help-btn`) no tiene guard propio.** Se ha medido en navegador, pero
   lo que el árbol vigila es que `customersView` no vuelva a esconder — no la regla CSS.
3. **El censo sólo clasifica overlays identificados por CLASE** y cerrados **a través de su
   variable**. Los dos casos que se le escapan están medidos a mano y escritos arriba.
4. **`productsView` y `providersView` siguen dejando residuo** tras editar. Fuera de alcance por
   encargo; el censo los enumera para que no se olviden.
5. **No se ha medido si algún otro CSS depende de la presencia de un overlay.** Se buscó
   `:has(.modal…)` y sólo hay una regla; otras formas (selectores de hermano, JS que cuente
   overlays) no se han censado.

## Ficheros

| fichero | qué |
|---|---|
| `public/dashboard/js/atajoNuevo.js` | `estaDelante()`: visibilidad en vez de presencia, y se recorren todos los candidatos |
| `public/dashboard/js/customersView.js` | `closeModal` descuelga el modal; `openModal` lo vuelve a colgar reutilizando el mismo nodo |
| `tests/scrum777-el-modal-escondido-no-mata-la-n.test.mjs` | **nuevo** · 7 tests, el censo y dos mutaciones declaradas |
| `docs/master/SCRUM-777.md` | **nuevo** · esta entrada |
