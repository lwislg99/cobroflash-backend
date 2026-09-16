# SCRUM-366 · La lista y el detalle dicen lo mismo — una sola escalera

**Fecha:** 5-ago-2026 · **Carril:** A · **Gate:** sin gate, corre en `npm test` · **UI:** vanilla (regla 4)

**Medido contra:** `origin/main` = `32395e21a2ccaeb0b63ebb3dbb928670b83aa6d6` · 2026-08-05T10:44:33+02:00

## El defecto no fue un olvido: fue falta de acceso

`jobNextAction` vivía **dentro** de `jobDetailView.js`, como función de fichero. Sin bundler
(regla 4) eso significa que `jobsView.js` **no podía nombrarla aunque quisiera**. Y como la lista
también tiene que decir qué hacer con un Trabajo, escribió la suya a mano.

Resultado medido en SCRUM-309: mismo Trabajo, mismo estado, la lista decía **«✅ Marcar
terminado»** y el detalle **«Enviar para firmar»**.

Esto cambia el arreglo. Si la causa fuera descuido, la solución sería «acordarse de usar la misma
lógica» —que no es una solución, es una esperanza—. Como la causa es que **la respuesta correcta
no era alcanzable**, la solución es hacerla alcanzable y poner un guard que impida que nazca una
tercera superficie decidiendo por su cuenta.

## Los tres puntos

### 1 · La escalera se extrae a un módulo compartido

`public/dashboard/js/jobNextAction.js`, nuevo. **Traslado VERBATIM**: los seis niveles se mueven,
no se rediseñan (instrucción explícita del fundador). Mismo orden, mismas condiciones, mismas
etiquetas, mismo `isAdmin` de SCRUM-89.

Verificado que es un traslado y no una reescritura: `diff` del cuerpo de la función original
contra el trasladado, ignorando comentarios → **sin diferencias**. Si en el mismo PR se moviera y
se cambiara el criterio, sería imposible saber cuál de las dos cosas rompió qué.

Se cuelga del global (`window.jobNextAction`) porque sin bundler no hay otra forma de que dos
scripts compartan una función. Cargado en `index.html` **después de `api.js`** (necesita
`fmtMoneyEs`) y **antes** de las dos vistas.

Añadido también a la lista `SHELL` de `public/sw.js`: el guard de SCRUM-274 comprueba las dos
direcciones (fichero sin entrada / entrada sin fichero) y habría salido en rojo. Sigue 3/3.

### 2 · La tarjeta del listado saca su acción de ahí

`jobsView.js` deja de decidir. Llama a `jobNextAction(j, !isTecnico)` —el rol se deriva **igual**
en las dos pantallas, que si no vuelven a discrepar por otro camino— y pinta esa etiqueta como
botón primario.

**Dos consecuencias de comportamiento que conviene que el fundador confirme:**

- **`▶ Empezar` y `✅ Marcar terminado` pasan a secundario.** No desaparecen. Son movimientos de
  la FSM, no «la siguiente acción»; el primario de la tarjeta ahora lo dicta la escalera. Si la
  intención era que «terminado» siguiera siendo el primario en su grupo, es un cambio de una
  línea, pero es una decisión de producto y no la tomo yo.
- **El botón de la escalera en la lista NAVEGA al detalle, no ejecuta.** Deliberado: ejecutar
  «Cobrar el resto» o «Enviar para firmar» requiere el flujo completo (modales, confirmaciones)
  que ya vive en el detalle. Duplicar la ejecución sería repetir exactamente el error que este
  ticket arregla, en la capa de al lado. La lista **dice lo mismo** que el detalle; llevar allí
  para hacerlo es lo honesto mientras la ejecución no esté también compartida.

### 3 · Guard por ESTRUCTURA, no lista de nombres

`tests/scrum366-una-sola-escalera.test.mjs`, 5 tests, sin gate.

«Superficie que decide qué hacer con un Trabajo» = fichero de `public/dashboard/js/` que **(a)**
pinta un botón primario y **(b)** habla con `/admin/jobs/`. Una pantalla nueva con esas dos
propiedades entra **sola**. Una lista de ficheros se satisface dejando de enumerar: la tercera
pantalla que nazca no estaría en ella, que es justo el fallo que se quiere impedir.

Lectura con `soloEjecutable()` (`_guard-texto.mjs`): un guard de texto se caza a sí mismo en el
comentario que explica la prohibición.

#### La primera versión de la propiedad estaba MAL, y lo cazó el suelo

Pedía «ramifica por `job.status`», que parece la definición natural de «decide qué hacer con un
Trabajo». Pero el **detalle no ramifica por el estado del Trabajo**: medido en SCRUM-309, ninguna
de sus 37 acciones consulta `job.status` —mira el estado del ALBARÁN y el del cobro—. Con esa
propiedad la derivación veía **una** superficie y el test principal pasaba **sobre un conjunto de
uno**: verde perfecto, midiendo nada.

Lo detectó el test de suelo (`>= 2` superficies, y las dos por nombre). Sin suelo, este PR se
habría entregado con un guard decorativo. `/admin/jobs/` sí captura las dos, y solo las dos
(medido).

## Los cuatro rojos

Cada uno inyectado con un caso **dentro** del mecanismo, y revertido después.

| # | Qué se rompe | Qué sale |
|---|---|---|
| 1 | Cambiar la etiqueta del nivel 3 en el módulo | Las **dos** pantallas cambian a la vez (demostración del objetivo) |
| 2 | La lista deja de consultar la escalera y decide sola | 🔴 2 tests: «MISMO TRABAJO → MISMA ACCIÓN» y «NINGUNA superficie decide por su cuenta» |
| 3 | Una vista vuelve a **definir** `jobNextAction` | 🔴 «la escalera ya NO se define dentro de una vista» |
| 4 | Cegar la derivación (`/admin/jobs/` deja de casar) | 🔴 «SUELO del guard estructural» |

El rojo nº1 merece una nota. El fundador lo pidió como «cambiar un nivel y comprobar que cambian
LAS DOS», y es la demostración correcta del objetivo — pero **no puede ser un test**: con una sola
fuente, que las dos cambien es cierto por construcción y ningún assert podría fallar. Lo que sí
puede volver a romperse, y por eso es lo que vigilan los rojos 2, 3 y 4, es que **una superficie
deje de usar la escalera**. Que es exactamente como nació este defecto.

## Verificación

- `npm run build` → OK, y `npm test` en **esa misma tirada**: **1542 tests · 1475 pass · 0 fail ·
  67 skipped**. (Un verde solo cuenta si el build de su propia tirada pasó: en un ticket anterior
  12 tests pasaron contra un `dist` viejo mientras `tsc` fallaba.)
- Guard de SCRUM-274 (`sw.js` SHELL): 3/3.
- Rebase sobre `origin/main` = `32395e2`, que trajo **108 líneas nuevas a `jobDetailView.js`** —el
  fichero que este PR vacía—. No hubo conflicto, y por eso se volvió a medir en vez de fiarse: la
  derivación sigue viendo las dos superficies, las dos llaman a la escalera y ninguna la redefine.

## Lo que NO se tocó

- **El criterio de la escalera.** Los seis niveles se movieron; ninguno se rediseñó. No se
  encontró nada que reportar como «este nivel parece mal».
- La ejecución de las acciones (sigue viviendo en el detalle).
- El hallazgo de `Pagado` de SCRUM-317: tiene su propio ticket (SCRUM-363).
