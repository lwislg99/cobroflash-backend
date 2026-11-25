# SCRUM-1841 · ficha 360: «+ Nuevo presupuesto» y su cabecera a 44 px de toque, por contenedor
**Medido contra:** `origin/main` = `25ddbe90bba5cbf75e6fd125fc8045ad040f0497` · 2026-11-25T02:10:54Z
**Skill UI:** cargada
**Carril:** J2 (`public/dashboard/css/styles.css`, bloque `.c360-cabecera-acciones`; `customerDetailView.js` sin tocar)
A9: comprobación → `tests/scrum1841-boton-presupuesto-360.test.mjs`

Por qué esa comprobación: mi primera cura (solo `min-height`) dejaba «+ Nuevo presupuesto» con caja de 44 pero FUERA de la pantalla a 390 (la fila no se partía y `overflow-x:clip` la recortaba); el caso b mide el toque con `tocable`, no la caja, y la tumbaba.

## Lo medido

Página de la 360 servida como la sirve `censo:tactil-panel`, árbitro `__areaDeToque` (Edge). Toque en px.

| Botón | 390 antes | 390 después | 1280 antes | 1280 después |
|---|---|---|---|---|
| ✎ Editar | 30,7 | 44,7 | 31,0 | 45 |
| 🔗 Portal | 30,7 | 44,7 | 31,0 | 45 |
| 📇 Guardar en mis contactos | 30,7 | 44,7 | 31,0 | 45 |
| Fusionar con otro cliente (admin) | FUERA de la ventana (x=405) | 44,7 | 31,0 | 45 |
| + Nuevo presupuesto | FUERA de la ventana (x=588) | 44,7 | 31,0 | 45 |

A 390, antes, dos botones no se podían tocar: la fila no se partía (`flex-shrink:0`) y
`html, body { overflow-x: clip }` los dejaba fuera de la pantalla. El censo los contaba como «no
tocables», no como cortos. Ficha 360 en el censo: a 929, 17 → 12 cortos; a 390, 11 cortos + 2 no
tocables → 8 + 0. Distintos < 44 en todo el panel: 115 → 110 (con `.btn-sm`: 38 → 33).

## Qué se construyó

Dos reglas en `styles.css`, debajo de `.c360-cabecera-acciones` (esa línea no cambia):
- `.c360-cabecera-acciones > .btn-sm { min-height: 44px; }`: la cura por contenedor de SCRUM-1148
  (`.plantillas-cabecera > .btn-sm`). `.btn-sm` global no se toca.
- `@media (max-width: 768px) { .c360-cabecera-acciones { flex-shrink: 1; min-width: 0; } }`: en
  móvil la fila se parte en vez de salirse. A 1280 no cambia nada (medido).

## Lo que no es de J2

En la fila del censo por clase, `BUTTON.btn-primary.btn-sm` sigue con 2 cortos: «Marcar como
cobrada» (`invoiceDetailView.js`, J1) y «+ Añadir miembro» (`teamView.js`, J3). No son de esta
cabecera y no se tocan.

## Control

`tests/scrum1841-boton-presupuesto-360.test.mjs`, caso c: se QUITA la regla de la hoja
(`deleteRule`) en la misma página. «← Volver a Clientes», un `.btn-sm` fuera del contenedor, mide
30,5 con y sin la regla. La caja de «+ Nuevo presupuesto» pasa de 44 a 30. Comprobado en rojo: con
el selector ensanchado a `, .btn-ghost.btn-sm`, c cae (control 44,5 → 30,5).

## Pendiente

`guard:objetivo-tactil` sale rojo con la cura. Lo corre el job «guards de navegador (fuera de la
tanda)», que el ruleset `protect-main` exige (`gh api …/rules/branches/main`). El comentario de
`ci.yml` que dice que no es obligatorio está desfasado. En `scripts/guard-objetivo-tactil.mjs` (sin
cerradura de carril):
- l. 437: `distintosEsperados: 7` → `6`, y su `origen` pasa a SCRUM-1841. Es el suelo recalculado,
  como hizo SCRUM-1148.
- l. 866-867: se quitan las excepciones `BUTTON.btn-secondary.btn-sm` y `BUTTON.btn-primary.btn-sm`,
  que el detector de sobrantes da por sobrantes.

Solo endurece. Con ese diff, en una copia fuera del árbol: 0 hallazgos. Los 4 ciegos que quedan son
«FUENTE ROTA» en la landing, que no carga `styles.css`.


> **Guard sin tocar (25-nov):** el endurecimiento de `scripts/guard-objetivo-tactil.mjs` de «Pendiente» lo denegó el control de permisos de la sesión al intentarlo; queda PROPUESTO, no aplicado, y lo decide el orquestador. Hasta entonces el check obligatorio «guards de navegador» de este PR sale ROJO por él (suelo 7 → mide 6; dos excepciones sobrantes).

## Aceptación → dónde se ve

| Aceptación | Dónde |
|---|---|
| ≥ 44 de toque a 390 y a 1280 | `tests/scrum1841-boton-presupuesto-360.test.mjs`, casos a y b |
| Sin regresión en otra fila | el mismo test, caso c |
| Capturas antes y después | `docs/master/evidencias/SCRUM-1841/` (`antes-*.png`, `despues-*.png`, `censo-*.txt`) |
