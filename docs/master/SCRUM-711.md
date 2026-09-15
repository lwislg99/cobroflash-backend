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
