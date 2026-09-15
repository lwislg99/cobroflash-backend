# SCRUM-711 · ¿qué guard no corre en ningún sitio? — y el botón «Nuevo cliente» a 31 px

**Medido contra:** `origin/main` = `9070f3d780938b6b1f53cf6afbeb55f71221229b` · 2026-09-15T16:15:00+02:00
**Medido en:** host `DESKTOP-T5MONF5` · rama `scrum-711-guards-sin-sitio-y-boton-nuevo-cliente`
**Carril:** front / instrumentos

## PASO 0 · la premisa del 3-sep estaba caducada

El ticket decía que `guard:objetivo-tactil` «corre fuera de la tanda» y por eso no veía un botón de
30 px. Hoy **sí corre**: el job «guards de navegador» de CI lo ejecuta a través de `guards:visuales`
(verde en main en los runs 34954547206 y 34958150014). Lo que no hace es correr dentro de `npm test`,
que no es lo mismo. Así que la pregunta útil pasó a ser la de debajo.

## Parte 1 · el censo, CERRADO

**¿Cuántos guards no corren NI en `npm test` NI en ningún workflow?** Comparando conjuntos —los guards
ejecutables que existen frente a los que algo invoca—, con la función de
`tests/scrum711-guards-sin-sitio.test.mjs`:

| | |
|---|---|
| guards ejecutables en `scripts/` | **24** |
| invocados por `npm test` (con su `pretest`) o por un workflow | **22** |
| sin invocar | **2**, y los dos corren por otro camino |
| **guards que no corren en ningún sitio** | **0** |

Los dos sin invocar, cada uno declarado con una **prueba comprobable**, no con un motivo en prosa:

- `scripts/guard-conformidad-landing.mjs` — su comprobación corre en la tanda por su módulo puro:
  `tests/scrum400-conformidad-landing.test.mjs` ejecuta `comprobarEnDisco(RAIZ)` sobre el árbol real.
  Lo que sobra es el CLI, no el guard.
- `scripts/guards-entrada.mjs` — runner local para empujar una entrada del registro; sus cuatro
  comprobaciones son `tests/*.test.mjs`, así que ya corren en la tanda.

### Cómo se sabe que el cero no es ceguera

- **El caso conocido, fabricado:** la situación exacta del 3-sep —el guard táctil con su clave en
  `package.json` y sin ningún workflow que llame al runner— y la **misma función** tiene que verlo.
  Con su mitad negativa: con el job de guards, el mismo guard ya tiene sitio.
- **Un comentario no es una invocación.** `ci.yml` nombra `npm run guards:visuales` en decenas de
  líneas que lo explican; se leen sólo los `run:`, sin comentarios (`sinComentario` de SCRUM-850).
- **Sobre el árbol real y sin declaraciones, salen exactamente las declaradas.** Sembrar y juzgar con
  la misma función.
- **Las declaraciones se vigilan:** si `scrum400` deja la llamada sólo en un comentario, o
  `guards-entrada` pasa a ejecutar algo que la tanda no corre, cae. Y una declaración que ya no hace
  falta se borra, no se deja.

La regla de a quién ejecuta `guards:visuales` no se copia: se importa `fueraDeLaTanda` de la propia
puerta (importarla no la ejecuta, SCRUM-522).

### Los rojos, corridos sobre el árbol real

| inyección | test que cae |
|---|---|
| quitar de `ci.yml` la invocación de `guards:visuales` | «NINGÚN guard…», el SUELO, y «sin declaraciones = declaradas» |
| dejar `comprobarEnDisco(RAIZ)` de `scrum400` sólo en un comentario | «las pruebas de las declaraciones» |
| un `scripts/guard-fantasma.mjs` sin enchufar | «NINGÚN guard…» y «sin declaraciones = declaradas» |
| un guard escondido en una subcarpeta de `scripts/` | «el límite de primer nivel» |

Revertidos los cuatro: 9/9 verde.

### Límites declarados

Fuera de la población, cada uno por su motivo: las librerías `_*.mjs` (corren si corre quien las
importa), los tests (de eso ya se ocupa `tests/scrum708-el-fichero-que-no-corre.test.mjs`), los hooks
`guard-dangerous` (corren en cada orden del agente, no en CI) y las subcarpetas de `scripts/` (hoy sin
ningún guard, y un test lo exige para que el límite no se vuelva hueco).

## 🔴 Parte 2 · el botón, PARADA: el arreglo coherente pasa por relajar el guard

### Sigue así hoy, medido en el DOM ejecutado

Mismo montaje que el guard (la vista real de Clientes de `paginaDeClientes`) y el mismo árbitro
(`__areaDeToque`). Con dos controles en la misma página para demostrar que el banco discrimina:

| ancho | «Nuevo cliente» hoy (`btn-primary btn-sm`) | control `btn-primary` | control `btn-primary btn-sm` |
|---|---|---|---|
| 360 | **31 px** | 44,5 | 30,5 |
| 390 | **31 px** | 44,5 | 30,5 |
| 929 | **31 px** | 36,6 | 30,7 |

### Por qué nadie lo vio, y no era el guard táctil

- El guard táctil **sí** mide la lista de Clientes, a 929 y 390; sale verde porque el botón está
  excusado (`BUTTON.btn-primary.btn-sm`, «el botón «Nuevo»»).
- La regla que de verdad lo prohíbe es de `DESIGN.md`: **«una acción primaria de pantalla nunca usa
  la variante pequeña»** (SCRUM-412). Y su test, `tests/scrum412-primaria-nunca-es-sm.test.mjs`,
  **no lo veía**: sólo reconoce `X.className = 'btn-primary btn-sm'`, y Clientes lo escribe con el
  helper de las vistas, `createElement("button", "btn-primary btn-sm", …)`. Censado el front entero:
  14 con `className` y **1** con el helper, que era justo éste.
- Clientes es la **única** de las seis listas con atajo cuyo botón de crear lleva `btn-sm`.
  Presupuestos, Facturas, Albaranes, Trabajos y Gastos usan `btn-primary`.

### El arreglo coherente, y lo que hace con el guard

Quitar `btn-sm` —lo mismo que las cinco hermanas, sólo JS, sin CSS—, medido:

| ancho | después (`btn-primary`) | guard táctil |
|---|---|---|
| 360 | **45 px** | el panel no se mide a 360 |
| 390 | **45 px** | ✅ |
| 929 | **37 px** | 🔴 `✖ 37px < 44 · BUTTON.btn-primary «N»` |

A 929 choca con `DESIGN.md`, que deja el escritorio en 36 px **a propósito**, mientras el guard exige
44 también en escritorio. Dejar el guard en verde exigiría excusar un `btn-primary` normal o bajarle
el mínimo a 929: **relajarlo**. Regla 41 → **se para y se decide fuera de esta sesión.**

`tests/scrum412-primaria-nunca-es-sm.test.mjs` ampliado a la forma del helper y con caso conocido
fabricado sale 6/6 con el botón arreglado, y rojo nombrando `customersView.js:newBtn` con el botón
como está. Va con la parte 2, porque sin el arreglo pondría la tanda en rojo.

## Ajeno a este ticket

`SCRUM-804` (dos tests) falla en este clon **también sobre `origin/main` sin este commit**: el censo
cuenta 145 ramas y `for-each-ref` lista 146. Es el rojo dependiente del clon que ya reportó la Sesión 4.
No se toca.

---

## Parte 2 · DECIDIDA y CERRADA — rama `scrum-711b-escritorio-36-y-nuevo-cliente`

Medido el 15-sep-2026 a las 17:00 sobre `origin/main` `4671042158721c09a7b463cf5ffc7dbf8166b8e6`.

### La decisión del fundador: opción B, y por qué no es relajar

DESIGN.md §5 dice «**≥44px en móvil** (el escritorio se queda en 36px a propósito — con ratón
cumple…)». El guard exigía 44 **también** a 929 y a 1280: más de lo que dice la única fuente de
tokens. Se **alinea** el guard con esa regla, con una condición: **no quedarse ciego en escritorio**.
Un `btn-sm` de 30 px haciendo de acción primaria tiene que seguir cayendo a 929.

### Lo que cambia

- **`scripts/_medidor-de-toque.mjs`** gana `CORTE_MOVIL = 768`, `MINIMO_ESCRITORIO = 36` y
  `minimoPara(ancho)`. `MINIMO_TACTIL` sigue en 44 para móvil.
- **`scripts/guard-objetivo-tactil.mjs`** mide cada ancho con `minimoPara(ancho)` en sus tres
  superficies: landing (1280 y 360), lista de Clientes (929 y 390) y las vistas del panel.
- **Tres sondas de umbral**, junto a la de 12 px, en **cada pasada** y en cada superficie del panel:

  | sonda | ancho | tiene que | medido |
  |---|---|---|---|
  | 40 px | 390 | caer | 41 px · cae ✅ |
  | 30 px | 929 | caer | 31 px · cae ✅ |
  | 37 px | 929 | pasar | 38 px · pasa ✅ |

- **`tests/scrum711b-escritorio-36.test.mjs`** ata el 36 al **texto** de DESIGN.md y el 768 al
  `@media (max-width: …)` de `styles.css` que sube los botones a 44. Además exige que ninguna
  medición del guard use un mínimo fijo y que las tres sondas sigan dentro.
- **«Nuevo cliente» pierde `btn-sm`**, como sus cinco hermanas.
- **`tests/scrum412-primaria-nunca-es-sm.test.mjs`** reconoce también la forma
  `createElement("button", "btn-primary btn-sm", …)`, con caso conocido fabricado y mitad negativa.

### Las excepciones que sólo existían por el escritorio, retiradas

Las nombró el propio detector de sobrantes en cuanto el mínimo pasó a ser por ancho:

| superficie | excepción | el objetivo | a 929 | a 390 |
|---|---|---|---|---|
| lista de Clientes | `BUTTON.btn-primary.btn-sm` | «Nuevo cliente» | ya no lleva `btn-sm` | — |
| editor de presupuesto | `BUTTON.btn.btn-primary` | «Generar presupuesto» | 36,7 px | cumple |
| editor de presupuesto | `BUTTON.btn.btn-secondary` | «Limpiar formulario» | 36,7 px | cumple |
| ficha de Trabajo | `BUTTON.btn-primary` | CTA «+ Nuevo albarán» | 37,0 px | cumple |

Y una **víctima de un motivo**: `quote-header-btn` nombraba «📋 Usar plantilla» y «💾 Guardar como
plantilla». La segunda (36,7 px a 929) ya cumple. El selector sigue haciendo falta por la primera, así
que ningún detector avisaba: se corrige a mano, que es la misma avería que dejó escrita SCRUM-794.

### Los suelos, rederivados con nombre y no restando

Comparando la salida de **este mismo guard** con el 44 fijo y con el mínimo por ancho:

| superficie | antes | ahora | los que salen |
|---|---|---|---|
| editor de presupuesto | 7 | **4** | «Generar presupuesto», «Limpiar formulario», «💾 Guardar como plantilla» — los tres a 36,7 px a 929 y cumpliendo a 390 |
| ficha de Trabajo | 6 | **5** | el CTA «+ Nuevo albarán», 37,0 px a 929 |
| ficha 360 | 7 | 7 | — (sus pestañas miden 41 px también en móvil) |

### «Nuevo cliente», medido en el DOM ejecutado

| ancho | antes (`btn-primary btn-sm`) | ahora (`btn-primary`) | mínimo | veredicto |
|---|---|---|---|---|
| 360 | 31 px | **45 px** | 44 | ✅ |
| 390 | 31 px | **45 px** | 44 | ✅ |
| 929 | 31 px | **37 px** | 36 | ✅ |

### Los tres rojos, inyectados en `minimoPara` y revertidos

| inyección | lo que rompe | lo que dijo el guard |
|---|---|---|
| móvil ciego: 36 en todos los anchos | 40 px a 390 tiene que caer | `UMBRAL MAL APLICADO · @390px: «sonda-40» mide 41 px contra 36 y PASA`, en las tres superficies |
| escritorio ciego: 30 por encima del corte | 30 px a 929 tiene que caer | `«sonda-30» mide 31 px contra 30 y PASA`, en las tres superficies |
| el guard de antes: 44 en todos los anchos | 37 px a 929 tiene que pasar | `«sonda-37» mide 38 px contra 44 y CAE`, y reaparecen los cuatro de siempre: «Generar presupuesto», «Limpiar formulario», «+ Nuevo albarán» y «Nuevo cliente» |

En los tres casos `scrum711b` cae también en la tanda. Revertido: guard con salida 0 y 7/7 en la tanda.

### Hallazgo, reportado y NO tocado

`scripts/guard-a11y-landing.mjs` **no importa** el mínimo del medidor único: declara su propio
`const MINIMO_TACTIL = 44;` y mide la landing a 1280 con 44. Desde este cambio, los dos guards
exigen cosas distintas a la misma página en escritorio. La decisión del fundador era para
`guard-objetivo-tactil`; alinear el otro es otra decisión.
