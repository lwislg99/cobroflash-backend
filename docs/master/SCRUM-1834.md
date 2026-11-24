# SCRUM-1834 · El error del 10 % (T3), VISIBLE a 390 en la ficha del trabajo

**Medido contra:** `origin/main` = `2db8e1c8be5c289fb2643de9e211d29b2ab6f949` · 2026-11-24T15:56:05Z

**Skill UI:** cargada (`yaqu-premium-ui`). ⚠️ TARDE: la cargué con la cura ya escrita, cuando fui a escribir esta línea, y es el
mismo tropiezo que confesó SCRUM-1804. Repasado contra AB6 después: `.alert.error` es el componente que ya pintaba T3 (inventario
AB3, el de `setStatus`), sin `style=`, `role="alert"`, atado al selector por `aria-describedby`; ningún control nuevo (nada de
dianas que medir); capturas abajo a 390 y 1280.

A9: comprobación → `tests/scrum811c-skill-ui-declarada.test.mjs`
(mi fallo: escribí la cura sin cargar antes `yaqu-premium-ui`; este guard exige declararla en el registro. Un segundo fallo, mío
también: la primera versión del guion de capturas NO reproducía el defecto —con una sola factura la ficha es corta y el ANTES salía
«se ve»—; lo vi porque el antes y el después daban lo mismo. Ahora el guion lleva el control positivo dentro y sale con 2 si el antes
no reproduce: `scripts/capturas-1834-error-visible-390.mjs`.)

Puesto S2 (frontend), rama `scrum-1834-error-visible-390` (base `c07f322d5`). Encargo del orquestador `cobroflash-backend-41`
(24-nov, tarde, arranque de la versión 1.1). Hallazgo de la r42 de SCRUM-1804b (`docs/master/SCRUM-1804.md`, «Hallazgo»).

## El defecto

A 390, «Marcar como PAGADA» sin medio en una factura con línea al 10 % pintaba T3 («Elige cómo lo has cobrado: en esta factura hay
IVA al 10 %.») en la **barra de estado de arriba** de la ficha (`setStatus`), mientras el foco bajaba al selector. El candado
funcionaba (ni PUT ni preguntas), pero el motivo quedaba fuera de la pantalla: en vivo, `top −196 px` con `scrollY 688`.

## La cura, y por qué esa

**T3 se pinta JUNTO al selector**, dentro de su mismo envoltorio, igual que T4 (el aviso de efectivo, que sí se veía a 390). Es el
patrón que la ficha ya usa en esa fila: los avisos del selector viven pegados al selector. El foco va al selector y el navegador
desplaza hasta el foco, así que lo que está a su lado entra en pantalla a cualquier ancho. **No** desplazo hasta la barra de
arriba: eso apartaría de la vista el selector que hay que tocar, y en una ficha larga el error y el control quedarían a pantallas
de distancia.

- `public/dashboard/js/jobDetailView.js`: un `p.alert.error` (`#metodo-cobro-inv-<id>-error`, `role="alert"`) nace escondido
  junto a T4; «Marcar como PAGADA» sin medio lo enseña (antes llamaba a `setStatus`); elegir un medio lo esconde. El selector
  lo nombra en `aria-describedby` (`<error> <aviso>`). T3 ya no sale en la barra de arriba (un solo sitio, también a 1280).
- **El texto NO cambia** (firmado SCRUM-1316 c.22438): sigue saliendo de `window.COPY_IVA_10.eligeMetodo`.
- El candado de SCRUM-1804 no se toca: la condición es la misma línea (su mutación del catálogo de `scrum1804` sigue aplicando).

## Rojo primero

`tests/scrum1834-error-visible-390.test.mjs`, banco de vistas. Abre la pestaña dueña del botón (como el usuario), pulsa «Marcar
como PAGADA» sin medio y exige: T3 visible en UN solo sitio, hermano del selector que recibe el foco, nombrado en su
`aria-describedby`, `role=alert`, `.alert.error`, y 0 PUT. Elegir un medio lo esconde. Positivo: sin 10 %, ni nodo con T3.

- Sobre `c07f322d5` sin la cura: **2 rojos de 3** — «T3 no está junto al selector: a 390 queda fuera de pantalla (barra de
  arriba)» y «con el medio ya elegido, T3 sigue diciendo que elija». El positivo, verde.
- Con la cura: **3/3**; junto con `scrum1804-iva10-parte-s` y `scrum1316l-medio-de-cobro-con-iva-10`: **30 de 30**, 0 saltados.

🔴 **El banco de vistas no maqueta** (el mismo límite que declara `scrum792`): el «top dentro de la ventana» no se puede medir en
`npm test`. Lo mide en Chromium real el guion de capturas (abajo); el test ata la CAUSA estructural, que es la que se rompe sola.

Mutaciones: catálogo → `tests/scrum1834-error-visible-390.test.mjs`

BASE sin mutar 3/3; las tres **mueren** (corridas una a una, fichero restaurado tras cada una):

| mutación | cae |
|---|---|
| `errorMetodo.hidden = false;` → `setStatus('error', …eligeMetodo);` (el defecto tal cual) | «T3 sale JUNTO al selector…» y «al elegir un medio, T3 se va» |
| `aria-describedby` sin el id del error | «T3 sale JUNTO al selector…» |
| quitar `if (window.metodoElegido(selMetodo)) errorMetodo.hidden = true;` | «al elegir un medio, T3 se va» |

## Capturas (antes = merge-base · después = esta rama; 390×844 y 1280×900)

`node scripts/capturas-1834-error-visible-390.mjs` → `docs/master/evidencias/SCRUM-1834/`. Chromium real, datos FICTICIOS (el
trabajo de muestra de SCRUM-1804, alargado con seis facturas anteriores sin 10 %), sin producción. «En la ventana» = la caja de T3
entera dentro de la ventana, después de pulsar y de que el foco vaya al selector.

| captura | T3 en la ventana | caja [left, top, w, h] | scrollY | foco |
|---|---|---|---|---|
| `trabajo-sin-elegir-antes-390.png` | **no** | [34, −981, 322, 63] | 1342 | `metodo-cobro-inv-91` |
| `trabajo-sin-elegir-antes-1280.png` | **no** | [294, −272, 940, 42] | 503 | `metodo-cobro-inv-91` |
| `trabajo-sin-elegir-despues-390.png` | **sí** | [75, 621, 286, 63] | 1266 | `metodo-cobro-inv-91` |
| `trabajo-sin-elegir-despues-1280.png` | **sí** | [339, 733, 540, 42] | 447 | `metodo-cobro-inv-91` |

Texto firmado byte a byte en las cuatro; 0 desborde horizontal; 0 errores de consola. Dato nuevo del antes: **a 1280 tampoco se veía**
con una ficha larga; la r42 solo lo vio a 390 porque allí la ficha cabía.

## Aceptación → dónde se ve

| aceptación (literal del encargo) | dónde se ve |
|---|---|
| a 390, «Marcar como PAGADA» sin medio: el T3 se ve | `docs/master/evidencias/SCRUM-1834/trabajo-sin-elegir-despues-390.png` (caja dentro de la ventana) · test `tests/scrum1834-error-visible-390.test.mjs` |
| CURA: junto al selector o desplazando, la que case con el patrón, declarada | arriba, «La cura, y por qué esa» |
| EL TEXTO NO CAMBIA | `COPY_IVA_10.eligeMetodo`, comparado byte a byte en el test y en las cuatro capturas |
| rojo-primero con el caso 390 | test, 2 rojos de 3 sin la cura · guion de capturas, control positivo antes-390 fuera de la ventana |
| mutación al catálogo | `MUTACIONES_QUE_ME_TUMBAN` del test, 3 de 3 mueren |
| verificación en yaqu.app | **NO HECHO todavía** → regla 42, después del merge: la r42 la repito yo (o quien diga el -41) con la ficha del trabajo 77 de la cuenta QA y la respuesta inyectada, como en SCRUM-1804b (la cuenta QA no puede tener facturas: regla 24) |
