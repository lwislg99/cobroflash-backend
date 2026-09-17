# SCRUM-894 · Configuración → Cobros: «Guardar cambios» no guardaba ni avisaba si faltaba el NIF/CIF de otra pestaña

**Medido contra:** `origin/main` = `018d18075c4aefb276dd21a47e1ba2186be630ad` · 2026-09-17T08:23:08Z
**Rama:** `scrum-894-cobros-nif-aviso` · **Estado:** PARADO — literal propuesto, PENDIENTE de firma del fundador (regla 30). Sin empujar.

Nace de SCRUM-882b (punto b3).

## PASO 0 · reproducido en staging a 390 y 360 px

Staging servía `018d1807` (`GET /version`). Sesión de QA (`qa@staging.yaqu`), Chromium con viewport móvil
real (`innerWidth` 390/360, `matchMedia('(max-width:768px)')` = true). El NIF se vació **solo en el DOM**:
no se escribió nada en la base de staging.

| caso | eventos `invalid` | foco tras pulsar | aviso en pantalla | petición al servidor | consola |
|---|---|---|---|---|---|
| NIF vacío, «Guardar» desde Cobros (390) | `taxId` | BODY | ninguno | ninguna | `An invalid form control with name='taxId' is not focusable.` |
| ídem a 360 | `taxId` | BODY | ninguno | ninguna | ídem |
| prefijo de serie vacío desde Cobros | `invoiceSeriesPrefix` | BODY | ninguno | ninguna | ídem con `invoiceSeriesPrefix` |
| nombre vacío desde Empresa (control) | `name` | `name` | burbuja del navegador | ninguna | — |

**Qué lo frena:** validación de formularios del **navegador** (cliente), no el servidor ni el `if` de
`settingsView.js`. Los campos se crean con `required` (`settingsView.js:269`, NIF en `:278`) y los diez
paneles cuelgan del mismo `<form>` (`:243`), ocultos con `display:none` salvo el activo (`:101`, `:138`).
**Por qué calla:** el navegador cancela el envío antes del `submit` (`:986`, que nunca llega a correr) y,
como el campo está oculto, no puede enfocarlo ni enseñar su burbuja: solo lo cuenta en la consola. El
aviso por JS de `:1031` es inalcanzable mientras exista el `required`.

Mismo mecanismo para **cualquier** obligatorio de otra pestaña (el prefijo vive en Facturación), así que el
arreglo los cubre a todos sin cambiar cuáles son.

## Arreglo

En el **clic** de «Guardar cambios», que corre antes de la validación: se leen los campos no válidos
(`validity`, sin disparar eventos) y `pestanaDelQueFalta` (en `settingsSubmenus.js`, junto al mapa) decide:

- si algo de lo que falta **se ve** → nada cambia; el navegador avisa como hoy;
- si **todo** lo que falta está oculto → se abre la pestaña del primero en el formulario; el propio
  navegador enfoca el campo y enseña su burbuja, y debajo del campo queda el aviso (borde Peligro +
  texto de ayuda en Peligro, DESIGN.md «Inputs / Fields»). Se quita al escribir en el campo.

⛔ No cambia qué es obligatorio. Sin schema, sin backend.

**Literal propuesto (PENDIENTE de firma):** `Para guardar, rellena «{rótulo del campo}». Está en la pestaña {rótulo de la pestaña}.`
→ «Para guardar, rellena «NIF/CIF». Está en la pestaña Empresa.»

## Rojo, positivo y negativo

`npm run guard:falta-en-otra-pestana` (navegador, entra por `guards:visuales`) pulsa el botón de verdad a
390 y 360 px:

- **Rojo contra el main de hoy** (commit `e6c5ad37`, antes del arreglo): 6 de 12 casos en rojo — NIF,
  prefijo y ambos vacíos desde Cobros: pestaña sin cambiar, foco en el botón, 0 avisos, 0 guardados.
- **Con el arreglo:** 12 de 12. Positivo: todo puesto → 1 guardado con el NIF, sigue en Cobros, sin aviso.
  Negativo: nombre vacío desde Empresa, y nombre (visible) + prefijo (oculto) → se queda en Empresa, foco en
  el nombre, ningún aviso añadido.
- **Mutante** (quitar la comprobación «algo se ve»): el guard cae en los 4 negativos; `npm test` también.

Red en `npm test`: `tests/scrum894-falta-en-otra-pestana.test.mjs` (decisión, literal, cableado del clic
y que el guard siga en la puerta de CI). Mutantes probados: escuchador quitado y negativo quitado → rojo.

Capturas a 390 y 360 px: la burbuja nativa del navegador tapa el aviso un instante a 390 (se va sola);
a 360 el aviso cabe en dos líneas bajo el campo.
