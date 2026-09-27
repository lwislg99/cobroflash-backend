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
