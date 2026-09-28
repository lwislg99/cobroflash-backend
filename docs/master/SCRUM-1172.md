# SCRUM-1172 · Botones de la ficha del Trabajo a 44 px (parte S2)

**Medido contra:** `origin/main` = `f888a039731b376fae68cda1c065699d6565725a` · 2026-09-27T17:02:53Z
**Rama:** `scrum-1172-botones-cobro-44`.
**Sesión:** S2 (front). **Skill UI:** cargada (`yaqu-premium-ui`).
**Reparto del ticket:** S3 lleva el instrumento (que el guard vuelva a vigilar la ficha, el comentario
de `:317`, la muestra de estados y el fail-closed). Esta parte es la de S2: **los botones**. El ticket
NO se cierra con esta rama: le falta la parte de S3.

## PASO 0 (medido en Edge, no por la clase)

S0 listó 5 botones. En `jobDetailView.js` hay **20 asignaciones de `btn-sm`**. Medidas en Edge con
`styles.css` real, cada una con su combinación exacta de clases y su etiqueta (`button` o `a`),
sacadas del fuente:

| | medidos | por debajo de 44 px |
|---|---|---|
| `origin/main` | 20 | **17** (30 px) |
| esta rama | 20 | **0** (44 px) |

Los 3 que ya daban 44 en main eran los que llevaban el opt-in de SCRUM-962: control positivo de que el
instrumento ve el verde cuando lo es. Entre los 17 estaban **los de cobro** («📲 Confirmar Bizum
recibido» en sus TRES asignaciones de clase al armar y desarmar, las acciones de cobro de `mkBtn`, el
«Enlace de pago»), confirmar la consolidación en factura, «✕», «Guardar cambios» y el resto.

Límite declarado del instrumento: mide la cascada de las CLASES con el CSS real, fuera de su
contenedor. Que la pantalla entera se vigile en navegador es la parte de S3.

## El cambio

El patrón que ya usaba esta misma pantalla (SCRUM-962): el opt-in `.job-toolbar-btn-44` en los 17.
**`.btn-sm` global no se toca**: lo comparten decenas de pantallas y su control negativo es de SCRUM-352.
Ni un texto nuevo, ni un cambio de comportamiento.

## 🔴 Guard SCRUM-412: se quedaba CIEGO, no se relaja

Al añadir la clase, `scrum412` dio rojo: sus cuatro declaraciones de la ficha (`consolidaConfirm`, `goM`,
`bz`, `save`) salían como «fantasmas». No porque los botones dejaran de ser `btn-primary btn-sm`, sino
porque su detector sólo reconocía el literal EXACTO `'btn-primary btn-sm'`: con una clase detrás ya no
los veía. Eso era un punto ciego (cualquiera podía esquivar el censo añadiendo una clase).

Arreglo: el detector acepta clases DETRÁS (`btn-primary btn-sm(?: [\w-]+)*`). **Ve más, no menos.** Con
su caso conocido fabricado (ve `save.className = 'btn-primary btn-sm job-toolbar-btn-44'`) y su
negativo (`btn-smx` no entra). Medido: el detector viejo sobre este código da los 4 fantasmas; el nuevo
da verde, sin ningún `btn-primary btn-sm` nuevo sin declarar en todo el front.

## Tests

- `tests/scrum1172-botones-de-la-ficha-del-trabajo-44.test.mjs` (3): contra main **2 fallan y 1 pasa**
  (el control de que `.btn-sm` global sigue en 30, que debe pasar en los dos). Con el cambio, 3/3.
  Fail-closed: con menos de 15 asignaciones de `btn-sm` en el fuente sale CIEGO.
- Vecinos (352, 368, 412, 846b, 962, 786, 1167, 267 y todos los que leen `jobDetailView`):
  **743 tests · 742 pass · 0 fail · 1 saltado** (SCRUM-22, gateado «sin QA_DB_TEST=1»: pide la base de staging, que este checkout no tiene).
- Tanda completa: la corre el check obligatorio del PR.

---

## Parte S3 (el instrumento) · 27-sep-2026

**Medido contra:** `origin/main` = `8f68b3e5f28c846868207e67db05420e82a20ff3` · 2026-09-27T18:00:01Z
(worktree `wt-s3-1172-guard-ficha-trabajo`, rama `scrum-1172-guard-ficha-trabajo`).

### ① La ficha del Trabajo vuelve a `guard-objetivo-tactil.mjs`, midiendo en navegador

Nueva entrada en `SUPERFICIES_791` (`renderJobDetailView`), con un fixture LOCAL (`DATOS_1172`,
no el `TRABAJO_DE_MUESTRA` compartido con `censo:tactil-panel` — tocar ese habría cambiado el
número de OTRO instrumento sin que este ticket lo midiera) que sirve un Trabajo con una factura
PENDIENTE de cobro: sin eso no salen «📲 Confirmar Bizum recibido», «Marcar como PAGADA», el «⋯»
de secundarias ni «Enlace de pago» — los botones de COBRO que la aceptación #4 manda medir
primero.

**Rojo-antes, verde-después, medido en navegador (aceptación #6):** con el fixture y SIN
excepciones, el guard midió **1 objetivo corto de 20** en los dos anchos (929 y 390) — no 17: los
20 `btn-sm` de la parte S2 ya llegan a 44 px. El que queda es un hallazgo NUEVO, no el que motivó
el ticket:

🔴 **El «⋯» de acciones secundarias (`overflow-trigger`, `api.js`) mide 30,7–31,0 px.** No estaba
en las 20 asignaciones de `jobDetailView.js` que midió S2 (el trigger vive en `api.js`, compartido
por otras vistas), así que ni el censo de clases ni este guard lo habían visto nunca. Se DECLARA en
`EXCEPCIONES_791.renderJobDetailView` con su cifra — no se arregla aquí: es un componente
compartido y decidir su tamaño no es de esta sesión ni de este ticket (que es el instrumento, no
el arreglo). **Reportado aparte para que alguien lo recoja como ticket.**

**Fail-closed (aceptación #5):** además del suelo de `distintosEsperados` (ya existía para las
demás superficies), esta entrada añade `conocidos: ['Marcar como PAGADA', '📲 Confirmar Bizum
recibido']` — si cualquiera de los dos deja de PINTARSE (no que mida poco: que desaparezca), el
guard sale CIEGO con su nombre. Verificado quitando `chargeId` del fixture a mano: cae con «no he
medido ningún botón «📲 Confirmar Bizum recibido»»; repuesto, vuelve a verde.

### ② El comentario de `:317` (hoy en otra línea, movido por los cambios de S2) se corrige

Decía que la ficha salía «igual que providers/templates/albaranDetail». **Falso**, medido con
`git log -S` sobre los tres nombres de vista en este fichero: **cero apariciones** de Plantillas y
del detalle del Albarán — nunca entraron, no es que se retiraran. Proveedores YA VOLVIÓ (SCRUM-1167).
Corregido en el propio comentario del guard, con la cita retirada y dicho por qué era falsa.

### ③ La cita a `censo:tactil-panel` como red, corregida en su sitio (mensaje final del guard)

El guard seguía diciendo, incluso con la ficha fuera de la lista, que las superficies restantes
«se siguen midiendo por `npm run censo:tactil-panel`» — dando a entender que hay vigilancia donde
no la hay. Medido (S0, SCRUM-1172): ese comando no está en ningún workflow, ni en
`guards-visuales.mjs`, ni en `test`; y el propio job de guards de navegador NO es obligatorio (sólo
`build + tests` lo es, confirmado con `gh api rules/branches/main`). El mensaje final ahora dice
que es un CENSO MANUAL —cuenta, no vigila, no bloquea— en vez de dejarlo sonar a red.

### ④ Segundo par de ojos sobre el regex de SCRUM-412 (pedido por S2)

Revisado `tests/scrum412-primaria-nunca-es-sm.test.mjs`: el ensanche (`(?: [\w-]+)*` tras
`btn-primary btn-sm`) es simétrico en las DOS formas que reconoce (asignación directa y
`createElement`), no introduce falsos positivos por posición —sigue exigiendo que `btn-primary
btn-sm` sean las DOS PRIMERAS clases del literal, igual que el regex viejo, así que no cambia esa
suposición ya existente— y no tiene forma de backtracking catastrófico (cada repetición del grupo
consume un espacio obligatorio que no se solapa con la siguiente). 73/73 tests de los vecinos
(352, 368, 412, 786, 1167, 1172, 267, 649) en verde.

### Verificación

`node scripts/guard-objetivo-tactil.mjs` verde (con la excepción del «⋯» declarada). Vecinos
(352, 368, 412, 786, 1167, 1172, 267, 649): 73/73. `npm run guards:entrada`: sin tocar (este guard
no entra ahí — compila/lanza Chromium, y `guards:entrada` es «sin compilar, segundos»).

### Lo que esto NO cierra

El ticket sigue con un hallazgo nuevo sin arreglar (el «⋯» compartido) y las quince superficies del
censo de SCRUM-787 siguen sin guard que corra o bloquee — eso es DELIBERADO y medido, no una deuda
de esta sesión: decidir vigilarlas todas es una decisión de producto (coste en cada PR), no algo
que se cuele por inercia.
