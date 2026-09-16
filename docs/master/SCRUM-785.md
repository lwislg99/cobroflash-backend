# SCRUM-785 · Productos y Proveedores descuelgan su modal — y el censo deja de tener agujeros

**Fecha:** 6-sep-2026 · **Carril:** modales del panel (producto) · **Gate:** sin gate — corre en `npm test`
**Medido contra:** `origin/main` = `c8462a8d09931c1afb5613fdc29c8143c8980db2` · 2026-09-06T12:05:10+01:00
**Tanda:** 5624 tests, 5536 pass, 0 fail, 88 skipped (salida 0)

---

## El defecto — y su alcance real, que no es el que parece

`productsView` y `providersView` cuelgan su modal de edición del `body` **ya escondido**
(`productsView.js:314`, `providersView.js:125`) y lo cierran escondiéndolo otra vez
(`:414`, `:180`). El nodo se queda ahí para siempre.

**Para el atajo «N» eso ya daba igual**: SCRUM-777 hizo que la pieza mire visibilidad. Lo que
seguía vivo es **la ayuda**, y no pasa por la pieza:

    styles.css →  body:has(.modal-overlay) #tut-help-btn { display: none !important; }

`:has()` es **estructural**: mira si el nodo **existe**, no si se ve.

## El rojo, medido dos veces

**Sobre el código real**, montando cada pantalla en el banco con una fila y pulsando «Editar»:

| paso | Productos | Proveedores |
|---|---|---|
| ① al montar | `.modal-overlay: 0` | `.modal-overlay: 0` |
| ② tras pulsar «Editar» | `1 · display="none"` | `1 · display="none"` |
| ③ **DESPUÉS de cerrarlo** | **`1 · display="none"`** 🔴 | **`1 · display="none"`** 🔴 |
| ④ reabierto | `1` · **mismo nodo** | `1` · **mismo nodo** |
| ⑤ cerrado otra vez | `1 · display="none"` 🔴 | `1 · display="none"` 🔴 |

> El residuo aparece **al construir el modal**, no al cerrarlo: los dos hacen `appendChild` con el
> overlay ya en `display:none`. Por eso montar la pantalla no deja nada y editar una vez sí.

**En navegador real (Edge)**, reproduciendo el ciclo de vida de estos dos ficheros —con SUELO que
lee sus fuentes y se declara ciego si esas líneas cambian—, midiendo `#tut-help-btn`:

| | sin editar | modal ABIERTO | **tras EDITAR y CERRAR** | reabierto |
|---|---|---|---|---|
| ciclo **antes** | `inline-block` 9,98×21 | `none` 0,00×0 | **`none` 0,00×0** 🔴 | `none` |
| ciclo **ahora** | `inline-block` 9,98×21 | `none` 0,00×0 | **`inline-block` 9,98×21** ✔ | `none` |

**El control positivo por el otro lado está en la misma tabla:** con el modal **de verdad abierto**
el botón sigue oculto en los dos ciclos. La regla hace lo que debe; el problema era el residuo.

## El arreglo

Los dos, simétricos con lo que ya hacía `customersView` desde SCRUM-777:

* `closeEditModal` / `closeProviderEditModal`: además de esconder, **`remove()`**.
* `openEditModal` / `openProviderEditModal`: si el nodo no tiene padre, **se vuelve a colgar**.

**Se descuelga, no se destruye** — y está verificado sobre el código real: al reabrir vuelve y **es
el MISMO nodo** (`build…()` cablea campos y oyentes una sola vez).

## 🔴 El censo tenía TRES agujeros, no dos — y el tercero lo destapó este arreglo

SCRUM-777 dejó dos casos que sólo se sabían **a mano**. Al aplicar la corrección apareció un
tercero que nadie había declarado: **el censo seguía acusando a Productos y Proveedores con el
`remove()` ya puesto.**

| agujero | por qué | cómo se cierra |
|---|---|---|
| `expensesView.js` | crea el overlay por CLASE y lo cierra por **id** (`getElementById('exp-modal')?.remove()`) | el censo aprende el `id` que se le pone a un overlay y reconoce ese cierre |
| `onboardingView.js` | **ni entraba en la población**: su overlay se identifica por `id` (`#onboarding-backdrop`) | los ids del propio `SELECTOR_MODAL` también entran |
| **el ALIAS** | `editOverlay = buildEditModal()` — el censo veía `ov` (dentro) y no `editOverlay` (fuera), así que el `remove()` le era invisible | una función que declara un overlay y lo **devuelve** convierte en overlay a quien recoja su resultado |

Las tres se **derivan**, ninguna se lista a mano.

**Resultado, MEDIDO:** `esconden: 0 · borran: 20 · ciegos: 0` (antes: `2 · 16 · 1`).

> ⚠️ Escribí «19» de cabeza en el primer borrador de esta entrada y lo corregí midiéndolo: el
> censo clasifica **20**. Entran los cuatro que faltaban —`expensesView`, `onboardingView`,
> `productsView` y `providersView`— sobre los 16 de antes.

Y la lista vacía va atada a que el censo **siga clasificando** (`borran >= 16`): un cero sobre una
población que se ha encogido no sería limpieza, sería ceguera.

## El hueco de SCRUM-777, cerrado: ¿hay una SEGUNDA víctima?

*«No se ha censado si algún otro CSS o JS depende de la presencia de un overlay más allá de la
única regla `:has(.modal-overlay)` encontrada.»*

**Censado. No la hay. El ticket no cambia de tamaño.**

**CSS**, sobre el CSSOM en Edge (donde los comentarios no son reglas): **659 reglas leídas, 0 hojas
ciegas**. Seis selectores nombran un overlay y **UNO SOLO es estructural**:

```
.modal-backdrop · .modal-overlay · .modal-overlay, .modal-backdrop
.modal-overlay .modal, .modal-backdrop .modal · .modal-overlay
🔴 body:has(.modal-overlay) #tut-help-btn      ← la única
```

Los otros cinco estilan al propio overlay o a su `.modal` hijo: se apagan solos cuando el overlay
se esconde.

**JS**, por AST: **seis consultas en cuatro ficheros**, medidas una a una:

| fichero | qué pregunta | ¿se come un residuo? |
|---|---|---|
| `api.js:284` | `querySelectorAll('.modal-overlay')` para borrarlos al navegar | no — los borra |
| `atajoNuevo.js:184/186` | la propia pieza | no — mira visibilidad desde SCRUM-777 |
| `homeView.js:721/971` | si la cotización rápida está abierta | no — la **borra** al cerrar (`:972`) |
| `onboardingView.js:54` | si el onboarding está abierto | no — lo **borra** (`:459`) |

Los dos censos llevan control positivo: el de CSS tiene que encontrar la regla del `#tut-help-btn`
y el de JS la consulta de la propia pieza.

## Verificado en rojo

Dos `MUTACIONES_QUE_ME_TUMBAN` declaradas, una por pantalla: si vuelve a esconder en vez de
descolgar, cae su test. Y los **once casos de teclado** de SCRUM-777 siguen dando lo mismo.

## Huecos declarados

1. **El banco no puede terminar de abrir estos dos modales.** `openEditModal` rellena con
   `body.querySelector('[name="name"]')` y el mini-DOM devuelve `null` —**sin anotarlo en
   `selectoresNoSoportados`**, medido—, así que la apertura lanza a mitad. No afecta a lo que se
   mide (el `buildEditModal()` ya ha corrido y el overlay ya cuelga), y el guard exige que el
   overlay ESTÉ para que el `catch` no tape un no-op. **Que el banco no se declare ciego ahí es un
   hallazgo suyo, no de este ticket.**
2. **La ruta de punta a punta en la pantalla real sigue sin ejercitarse**: hace falta sesión. Lo
   que sí se mide en navegador es el ciclo de vida reproducido de estos dos ficheros, con suelo.
3. **El censo de CSS estructural reconoce `:has()`, `~` y `+`.** Otras formas de depender de la
   presencia —JS que cuente overlays para decidir otra cosa, `:not(:empty)`— no están cubiertas;
   el censo de JS cubre las consultas por selector, no la aritmética que alguien haga con ellas.
4. **`#tut-help-btn` sigue sin guard propio en el árbol**: lo que se vigila es que nadie vuelva a
   esconder un overlay, no la regla CSS en sí. Es el mismo hueco que declaró SCRUM-777.

## Ficheros

| fichero | qué |
|---|---|
| `public/dashboard/js/productsView.js` | `closeEditModal` descuelga; `openEditModal` reengancha |
| `public/dashboard/js/providersView.js` | ídem |
| `tests/scrum777-el-modal-escondido-no-mata-la-n.test.mjs` | el censo aprende ids y alias; `esconden` y `ciegos` pasan a vacío con su suelo |
| `tests/scrum785-productos-y-proveedores-descuelgan.test.mjs` | **nuevo** · 7 tests, los dos censos y dos mutaciones |
| `docs/master/SCRUM-785.md` | **nuevo** · esta entrada |
