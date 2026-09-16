# SCRUM-690 · El contraste del lado activo de `.segmented`

**Fecha:** 2-sep-2026 · **Carril:** UI del sistema · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `1b76c430c7ae4e4541e86191b3802ba79b6f5017` · 2026-09-02T19:19:49Z

> **Una tanda verde no puede ver qué aspecto tiene una pantalla.**
>
> Ésta es la lección del ticket, y no el arreglo. En SCRUM-689 los tests estaban en verde con los
> rótulos solapados unos encima de otros; lo destapó una captura. Aquí ha vuelto a pasar en
> pequeño: el guard de «las cuatro señales» habría seguido verde con un borde que **no se pinta**,
> porque la propiedad estaba escrita. Un guard de CSS comprueba que las reglas existan; que el
> resultado se vea es otra pregunta, y se contesta mirando.

---

## 1 · PASO 0

### ENTRADA

**Sí la hay, y son tres puntos de montaje, no dos** — la premisa decía dos pantallas:

| montaje | fichero | switch |
| --- | --- | --- |
| modal de cliente (alta/edición) | `customersView.js:439` | Empresa \| Persona |
| **ficha de detalle del cliente** | `customerDetailView.js:359` | Empresa \| Persona |
| catálogo | `productsView.js:81` | Producto \| Servicio |

Y en los tres, **el lado activo cambia lo que hace el formulario**: en el catálogo esconde coste,
margen y proveedor; en la ficha decide qué campos se piden. No ver qué lado está puesto no es un
problema estético.

### Censo de consumidores del componente

**Dos**, y son los que decía la premisa: `switchTipoArticulo.js` y `switchFormaJuridica.js`.

> `reportsView.js:306` **menciona** «segmented» en un comentario pero **no usa la clase**: su
> selector de trimestre son `btn-primary`/`btn-ghost`. Es una mención, no un uso.

### MECANISMO

`.segmented` existe en `styles.css` desde CONT-01. **No había que construirlo ni rediseñarlo**:
había que llevarle el patrón que SCRUM-689 estrenó en las pestañas de clientes.

---

## 2 · Lo medido en navegador, antes y después

A 360 px, con el marcado real de los dos consumidores:

| | ANTES | DESPUÉS |
| --- | :-: | :-: |
| fondo del activo contra la barra | **1,07:1** | **1,07:1** |
| tinta del activo | 17,52:1 | 17,52:1 |
| tinta del inactivo | 7,21:1 | 7,21:1 |
| borde | **0 px** | **1 px** |
| sombra | `--shadow-sm` (4 %) | **`--shadow-md`** |
| **señales** | **2** | **4** |
| salto de layout | — | **0 × 0** |

El fondo **no cambia y no se toca**: arreglarlo sería separar `--surface` de `--bg`, o sea repintar
el producto entero. Por eso el arreglo es añadir señales que no dependan del color.

### 🔴 Honestidad sobre el borde

**`--border` (#e7e9e5) contra `--bg` (#f6f7f5) da 1,14:1.** El borde **no aporta contraste de
color** — aporta un contorno continuo que define el límite de la pastilla donde antes no había
ninguno. **La señal fuerte nueva es la elevación**, de `--shadow-sm` (4 % de opacidad, sin
desplazamiento apreciable) a `--shadow-md` (8 % + 5 %, desplazada 4 px).

Se dice con el número delante en vez de vender un 1,14 como una mejora de contraste.

---

## 3 · Lo que descubrí probando el rojo, y corrige mi propia explicación

Escribí en el CSS que reservar el borde con `transparent` evita «un salto de 2 px». Al inyectar la
mutación, el salto **no apareció** — y lo que apareció era peor:

* **Sin la reserva, `borderTopWidth` del activo computa `0px`.** La regla del activo sólo declara
  `border-color`; sin `width` ni `style` heredados de la base, **el borde no se pinta**. La señal
  de forma desaparece entera **y el guard de las cuatro señales sigue en verde**, porque la
  propiedad está escrita. «Mencionar no es hacer», dentro del propio CSS.
* El salto de 2 px **sí existe**, pero con la otra forma: declarando el borde **completo** sólo en
  el activo. Medido: **162 px el activo contra 160 px el inactivo**.
* Con la reserva puesta: **0 × 0**.

El comentario del CSS y el mensaje del guard se corrigieron para decir **los dos motivos con sus
números**. Una afirmación no verificada en un comentario se lee como una medición.

---

## 4 · Evidencia

`tests/scrum690-contraste-segmented.test.mjs` — 9 pruebas.

* **🔴 CONTROL POSITIVO DEL MEDIDOR**, que es lo que el encargo pedía: antes de usar el calculador
  de contraste para nada, se comprueba que da **21** para negro/blanco, **1** para dos colores
  iguales, y que separa el **17,52** del **1,07** sobre los tokens reales. Un instrumento que no
  distingue eso no sostiene ninguna afirmación sobre contraste.
* **El defecto sigue siendo cierto**: si algún día alguien separa `--surface` de `--bg`, el test
  cae y obliga a revisar el motivo escrito del ticket en vez de arrastrarlo.
* Las **cuatro señales** declaradas, y `--shadow-md` en concreto (no vale volver a `--shadow-sm`).
* El **borde reservado** en la base, con los dos motivos medidos en el mensaje.
* **Cero colores literales**.
* **Los dos consumidores** siguen usando la clase — que el componente mejore no prueba que ellos
  mejoren— y un **suelo del censo**: si aparece un tercero, cae, porque su pantalla no se ha medido.
* **NEGATIVO**: un comentario no cuenta como regla. Probado además **por el mecanismo**: se amplió
  un comentario del CSS nombrando el selector y las propiedades → **9 pass, 0 fail**.

**Rojos por el mecanismo**, commiteado en verde antes de mutar y cada mutación con post-condición
sobre el fichero nombrado:

| mutación en `styles.css` | resultado |
| --- | --- |
| quitar `border-color` del activo | 🔴 «al lado activo le falta «border-color» (el BORDE — señal de FORMA…)» |
| `--shadow-md` → `--shadow-sm` | 🔴 «la elevación no es `--shadow-md`. `--shadow-sm` es «Reposo» (4 %) y era justamente lo que no se veía» |
| quitar el borde reservado de la base | 🔴 «el borde no está reservado con `transparent`…» |

**Verde:** `npm test` completo después del último cambio. `guards:entrada` verde, worktree limpio,
`main` mezclado dentro, Prisma regenerado desde este worktree.

---

## 5 · Huecos declarados

Repetidos a propósito, no re-descubiertos — ya estaban en SCRUM-689 y siguen valiendo:

* **Chromium a 360 px no es un dispositivo real** ni la matriz Android / iPhone / tablet de AB6.
* **`:hover` no existe en táctil**, así que esa regla no se ha podido comprobar donde vive el
  profesional.
* **No se ha medido la ficha de detalle del cliente** (`customerDetailView.js:359`) como pantalla
  completa: el componente se midió con su marcado real, pero ese tercer montaje no se abrió.
* **El fondo sigue en 1,07:1.** No es un arreglo del contraste de fondo: es rodearlo. Separar
  `--surface` de `--bg` es una decisión de paleta que no es de este carril.

---

## Tests que introduce esta entrada

* `tests/scrum690-contraste-segmented.test.mjs` — 9 pruebas (control positivo del medidor, el
  defecto vigente, suelo del censo, las cuatro señales, el borde reservado, tokens sin literales,
  los dos consumidores, el suelo del censo de consumidores y el negativo del comentario).
