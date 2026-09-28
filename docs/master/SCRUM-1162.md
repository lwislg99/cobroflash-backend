# SCRUM-1162 · El asistente de alta se atascaba en su paso 2: «Siguiente» no hacía nada

**Medido contra:** `origin/main` = `7ba1ad5f2a87e7752894f790a5256b20a65f9ed5` · 2026-09-28T13:36:48Z (hora de GitHub)

**Puesto:** J3 (`jv-j3`, equipo de Javier) · **Rama:** `scrum-1162-onboarding-paso2`

**Carril:** `onboardingView.js` es de J3 (`puesto-j3.md`, «Pantallas»). Lo midió y reportó S0 del
equipo de Luis (`s0-26b`, 26-sep), que no lo tocó.

## 1 · PASO 0: el defecto existe hoy (medido ejecutando el código)

- **La coordenada sigue en pie.** En este `main` (220 commits por delante del árbol heredado),
  `public/dashboard/js/onboardingView.js:450` es `if (!step.validate()) {`, dentro de `onNext`.
- **Producción sirve este mismo fichero.** El sha256 de `https://yaqu.app/dashboard/js/onboardingView.js`
  y el de `origin/main:public/dashboard/js/onboardingView.js` es el mismo: `6769c61e9cbffc0e…`.
- **Reproducido con el banco de vistas** (`tests/_banco-vistas.mjs`), montando el asistente y pulsando
  `#ob-next`: el paso 1 lleva al paso 2 («¿Ya has facturado en 2026?»), y en el paso 2 el clic lanza
  `TypeError: step.validate is not a function at onNext (onboardingView.js:450:15)`. El título no cambia.
- **Causa.** De los cuatro pasos, sólo el 1 y el 3 declaran `validate`; el 4 pinta su propio pie y no
  pasa por `onNext`. El paso 2 **nunca tuvo** `validate`: nació así el 6-ago-2026 con `87f88f91`
  (SCRUM-313, D2). Así que no se perdió ninguna validación, y el defecto lleva siete semanas en producción.
  Ningún test lo vio porque ninguno pulsaba el botón: los de SCRUM-313 leen el marcado.

## 2 · El arreglo

`onNext` trata un `validate` ausente como «nada que validar»:
`if (typeof step.validate === 'function' && !step.validate())`. Es una línea, y no cambia qué se
pregunta ni qué se guarda: el paso 2 ya mandaba su `save` a `/admin/onboarding/serie`, sólo que
nunca se llegaba a ejecutar.

**Sin texto nuevo** que vea el usuario. **Sin try/catch especulativo en `save`**: los tres `save` que
hay hoy capturan sus propios errores (medido leyéndolos), así que ninguno puede dejar el botón clavado
en «Guardando…».

## 3 · Verificación

`tests/scrum1162-asistente-avanza-cada-paso.test.mjs` monta el asistente y **espera la promesa del
oyente** (con `click()`, el rechazo de un `onNext` asíncrono se perdería como promesa huérfana):

| caso | `main` sin arreglo | con arreglo |
|---|---|---|
| recorre los 4 pasos, rama «No, empiezo ahora», y guarda la serie con `vieneDeOtroSitio:false` | ✖ `step.validate is not a function` | ✔ |
| rama «Sí» + 41 → «Es correcto» avanza y guarda `ultimoNumero: 41` | ✖ `step.validate is not a function` | ✔ |
| control negativo: el paso 1 con el nombre vacío NO avanza | ✔ | ✔ |

La población se declara: el primer caso exige 4 títulos distintos y que el último paso no tenga `#ob-next`.

`npm test` entero con el arreglo, antes del commit: **8.673 tests · 8.535 pass · 4 fail · 134 skipped**.
Los cuatro rojos no son de este diff:
- `SCRUM-854 ②` pide la entrada de registro **comiteada** en la rama, y cuando se corrió este
  expediente aún no estaba comiteado.
- `SCRUM-804` (×2): el censo de ramas no ve `scrum-1129-tabla-clave-regimen`, que es una ref remota
  ajena. Depende de git, no del código.
- `scrum910d`: ya caía en `main` limpio (lo midió SCRUM-1116), y no lee nada del alta.

## 4 · Hueco declarado, sin arreglar (DECISIÓN pendiente)

Con el botón ya vivo se puede llegar a un camino que antes no se alcanzaba. En el paso 2, si el
profesional dice **«Sí»** y deja el número vacío o pone uno inválido, o si la serie choca con facturas
ya emitidas, el servidor responde 400 o 409 (`app.ts`, `/admin/onboarding/serie`). Pero el `save` del
paso hace `.catch(() => {})`, así que el asistente **avanza callado** y la numeración no queda guardada.
Lo he **leído en el código, no lo he medido contra el servidor**. Arreglarlo es criterio de numeración
fiscal (J1) y lleva texto nuevo (firma, regla 39), así que se queda fuera de este ticket.
