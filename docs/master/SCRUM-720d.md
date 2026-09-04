# SCRUM-720d — Repaso visual de la pantalla del parte, mirándola

**Rama:** `scrum-720d-repaso-visual` · **Carril:** front / hoja de estilos
**Fecha:** 4-sep-2026, tarde (CEST)

## Qué se pedía

Abrir la pantalla del parte y **mirarla**, en móvil y en escritorio: pulgar, scroll horizontal,
los dos bloques, la firma, y los estados (vacío, cargando, error, firmado). Lo mismo con
`#job-detail` y con «Partes por valorar». Reportar antes de arreglar; arreglar **solo lo roto**.

## Cómo se miró (y por qué así)

Navegador de verdad, `puppeteer-core` + `scripts/_navegador.mjs`, con **viewport real**
(`page.setViewport`, 390 y 1280). El banco anterior usaba `--window-size` y maquetaba **siempre a
484 px**: las «capturas de móvil» eran el diseño de escritorio recortado, y el recorte que yo creía
ver era mío. Objetivos táctiles con `elementsFromPoint` — el método de la casa (SCRUM-542) —, no
con la caja, que miente hacia el lado cómodo.

**Suelo en el instrumento.** Tres cosas que se distinguen y antes no:
- pila vacía = *el punto cae fuera de la ventana* → «NO SUPE MIRAR», nunca «tapado»;
- un **ancestro** que recibe el toque (la etiqueta que envuelve su radio) **no** es tapar;
- si se pintan menos de 5 nodos, el banco aborta: no mide, luego no aprueba.

## Lo que salió

**Cero scroll horizontal** en las 4 pantallas del parte, en «Partes por valorar» y en `#job-detail`,
a 390 y a 1280. Mi impresión inicial de recorte queda **desmentida por la medición**.

Objetivos táctiles bajo los 44 px de AB6 en el parte, y uno duele: **`.parte-quitar-linea`, la «×»
que borra una línea, medía 22 px**. Con el móvil en la mano, de pie, y con una acción destructiva
detrás. Eso sí es «no se puede usar»: **arreglado en la hoja** — 44×44 de área sin engordar el
dibujo ni la fila. Con él, botones y píldoras del parte al mínimo de AB6.

Resultado medido, borrador a 390 px: **14 → 11**, y de los 11 que quedan 3 son el dibujo del radio
(su objetivo real es la píldora, ahora 44) y 1 es un `<label for>` que no es una acción. Firmado: 5 → 3.

## Lo que NO se tocó, y por qué

- **Los rótulos `[PENDIENTE microcopy oficial]`**: los firma la sesión 4 en SCRUM-720c (regla 30).
- **La cabecera «UNDS» partida en 4 líneas**: se midió si la culpa era de la columna o del rótulo
  provisional. Con el marcador, 4 líneas y 75 px; con `Unds`, **1 línea y 64 px**. La tabla no
  tiene defecto: se arregla sola cuando aterrice el rótulo. **No se toca.**
- **Botones compartidos del dashboard** (`.btn-primary` 36 px, `.btn-secondary`/`.btn-ghost` 30 px,
  `.state-error-retry` 33 px, la miga 19 px): están por debajo de 44, pero son de **todas** las
  pantallas. Subirlos aquí sería un rediseño global disfrazado de arreglo (regla 4: una pantalla
  por cambio). Van a ticket propio.

## Un falso positivo que casi reporto como avería

En `#job-detail` salieron **11 controles «TAPADOS»**, algunos de 44 px. Antes de escribirlo, el
instrumento tuvo que decir **quién** tapaba: un `div` fijo con `z-index:300`… que era
`#onboarding-backdrop`. Mi banco cargaba los 77 scripts del dashboard, y `onboardingView.js`, al
contestarle mi `apiRequest` de mentira, decidió que el merchant era nuevo y plantó el asistente de
alta sobre todo. Quitado ese único script (declarado), **los 11 desaparecen**. No había avería:
había banco. Un «TAPADO» que no nombra al que tapa no es un hallazgo, es una sospecha.

## Hallazgos abiertos (regla 37 — ninguno bloquea, ninguno es de esta zona)

1. **Botones compartidos por debajo de 44 px** — `.btn-primary` 36, `.btn-secondary` 30,
   `.btn-ghost` 30, `.state-error-retry` 33, `.detail-miga-link` 19, `a.detail-rail-enlace` 20.
   Afecta a todo el dashboard. Gate: decisión de si AB6 aplica al escritorio o solo a táctil.
2. **«Partes por valorar»: las filas son `div` con `cursor:pointer`** — 3 filas pulsables con el
   dedo y el ratón, **inalcanzables con el teclado** (sin `tabindex`, sin `role`). La pantalla del
   parte, medida igual, da **0**. Carril de la sesión 1.
3. **Esa misma pantalla está escrita con `style=` en línea** (`fila.style.cssText`, `style="…"` en
   el HTML): fuera de tokens y sin poder responder al ancho.
4. **`btn-ghost` no parece pulsable**: «Facturar el trabajo» y «Cambiar» se leen como texto
   corrido. Es la acción siguiente del trabajo y no invita a tocarla.
5. **`#tut-help-btn` flota sobre el contenido** en móvil (48×48 fijo abajo a la derecha) y en el
   detalle del Trabajo cae encima del bloque «Qué falta para cobrar».
6. **Falso positivo del hook `guard-dangerous`**: bloquea `--force-device-scale-factor` porque
   contiene `--force`. No es una operación destructiva; es una bandera de calibrado del navegador.

## Cierre

`npm test` **5092 tests, 0 fallos** · `guards-entrada` 4/4 · `guards-visuales` **9/9**.
Sin dependencias nuevas. Sin `style=` en línea: el arreglo vive entero en la hoja.
